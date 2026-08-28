"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { getAuthGateway } from "@/server/auth/gateway";
import { isAuthDevBypassEnabled } from "@/server/config/env";
import { HttpError } from "@/server/http/errors";
import { logger } from "@/server/observability/logger";
import { generateAccessLinkToken } from "@/server/security/tokens";

/**
 * State handed back to {@link AccessLinkBuilder} by the create action.
 *
 * On success the RAW one-time token travels only inside this return value
 * (the encrypted server-action flight payload) and is rendered once from
 * client state. It must never be embedded in a URL or redirect: URLs leak
 * into browser history, access logs, and same-origin Referer headers.
 */
export type CreateAccessLinkActionState =
  | {
      status: "success";
      linkId: string;
      label: string;
      audience: string;
      token: string;
    }
  | { status: "error"; message: string }
  /** Initial value before the first submission of the form. */
  | { status: "idle" };

/**
 * State returned by the rotate action. Same contract as creation: the raw
 * replacement token reaches the client only through this return value.
 */
export type RotateAccessLinkActionState =
  | { status: "success"; linkId: string; token: string }
  | { status: "error"; message: string };

/**
 * State returned by the edit (metadata update) action. On success the action
 * performs its own redirect to the detail page; on error the message arrives
 * pre-localized in pt-BR for inline display.
 */
export type UpdateAccessLinkActionState =
  | { status: "success"; linkId: string }
  | { status: "error"; message: string }
  /** Initial value before the first submission of the form. */
  | { status: "idle" };

/**
 * Throw-free result for lifecycle mutations (pause/resume/revoke). Errors
 * arrive pre-localized in pt-BR so callers can surface them directly.
 */
export type AccessLifecycleActionResult =
  { status: "success" } | { status: "error"; message: string };

/**
 * Helper to resolve the actor and ensure the session exists.
 */
async function requireActor() {
  const session = await getAuthGateway().getSession();
  if (!session) {
    redirect("/entrar");
  }
  return session.actor;
}

function parseExpiry(
  value: string | null,
  customDateRaw: string | null = null,
): Date | null | undefined {
  // Form values: "never" | "week" | "month" | "date"
  if (value === null || value === "never") return null;
  if (value === "week") {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  }
  if (value === "month") {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d;
  }
  if (value === "date") {
    if (customDateRaw !== null && customDateRaw.trim() !== "") {
      const trimmed = customDateRaw.trim();
      // Support both ISO date (YYYY-MM-DD) from <input type="date"> and full ISO string.
      // For date-only, anchor end-of-day to -03:00: America/Sao_Paulo stays
      // UTC-3 year-round (no DST since 2019), so 23:59:59.999-03:00 matches
      // the promise made in the form ("expira às 23:59 do dia selecionado")
      // instead of silently expiring three hours early.
      let candidate = trimmed;
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        candidate = `${trimmed}T23:59:59.999-03:00`;
      }
      const parsed = new Date(candidate);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
      // Fallback: try raw trimmed as-is (covers ISO datetime already)
      const fallback = new Date(trimmed);
      if (!Number.isNaN(fallback.getTime())) {
        return fallback;
      }
    }
    // No valid custom date provided — treat as no expiry mutation so that
    // label/audience updates are not silently discarded. Caller will still
    // persist those fields and expiry will remain unchanged.
    return undefined;
  }
  return undefined;
}

async function resolveOrganizationId(
  actorProfileId: string,
  explicitId?: string,
): Promise<string> {
  const { getAuthorizationService } =
    await import("@/server/services/service-container");
  const { Capability } = await import("@/generated/prisma/enums");
  const authz = getAuthorizationService();

  // If an explicit organizationId was posted, validate the actor can manage it.
  if (explicitId) {
    await authz.assertCanUse(
      actorProfileId,
      Capability.LINK_MANAGE,
      explicitId,
    );
    return explicitId;
  }

  const scope = await authz.resolveEffectiveScope(
    actorProfileId,
    Capability.LINK_MANAGE,
  );
  if (scope.kind === "denied") {
    redirect("/portal/sem-acesso");
  }
  if (scope.kind === "platform") {
    // Platform scope still needs a concrete organization; if none was posted,
    // the UI must provide one. For the mock flow we fall back to the first
    // organization the actor belongs to via LINK_VIEW, or redirect.
    const viewScope = await authz.resolveEffectiveScope(
      actorProfileId,
      Capability.LINK_VIEW,
    );
    if (
      viewScope.kind === "organizations" &&
      viewScope.organizationIds.length > 0
    ) {
      return viewScope.organizationIds[0]!;
    }
    // No organization in scope – cannot create without target.
    throw new Error("No organization in scope for link creation");
  }
  // organizations scope: use the first allowed organization.
  return scope.organizationIds[0]!;
}

/**
 * Maps an expected service failure to a safe pt-BR message using only the
 * HttpError's public code/status fields. Raw error.message is never surfaced:
 * internal messages may carry implementation details not meant for the UI.
 */
function actionFailureMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpError) {
    switch (error.code) {
      case "VALIDATION_FAILED":
        return "Revise os dados do formulário e tente novamente.";
      case "AUTHENTICATION_REQUIRED":
        return "Sua sessão expirou. Entre novamente para continuar.";
      case "FORBIDDEN":
        return "Você não tem permissão para gerenciar este link.";
      case "RESOURCE_NOT_FOUND":
        return "Este link de acesso não existe ou foi removido.";
      case "CONFLICT":
        return "Este link já foi encerrado e não pode mais ser modificado.";
      case "RATE_LIMITED":
        return "Muitas tentativas em sequência. Aguarde alguns instantes e tente novamente.";
      default:
        return fallback;
    }
  }
  return fallback;
}

/**
 * Centralized logging for action failures: expected HttpErrors log at warn
 * level (they are business outcomes), anything else logs at error level.
 * Never throws — the caller decides the returned client state.
 */
function logActionFailure(
  scope: string,
  error: unknown,
  correlationId?: string | null,
): void {
  const correlationIdSafe = correlationId ?? undefined;
  if (error instanceof HttpError) {
    logger.warn(
      {
        err: error,
        code: error.code,
        status: error.status,
        correlationId: correlationIdSafe,
      },
      `${scope} failed`,
    );
  } else {
    logger.error(
      { err: error, correlationId: correlationIdSafe },
      `${scope} failed unexpectedly`,
    );
  }
}

export async function createAccessLinkAction(
  _prevState: CreateAccessLinkActionState,
  formData: FormData,
): Promise<CreateAccessLinkActionState> {
  // Auth/scope resolution stays outside the try block on purpose: those steps
  // may legitimately redirect (/entrar, /portal/sem-acesso), and NEXT_REDIRECT
  // must propagate instead of being swallowed into an error state.
  const actor = await requireActor();
  const label = String(formData.get("label") ?? "").trim();
  const audience = String(formData.get("audience") ?? "").trim();
  const expirationRaw = formData.get("expiration") as string | null;
  const expiresAtRaw = formData.get("expiresAt") as string | null;
  const organizationIdRaw = formData.get("organizationId") as string | null;

  const correlationId = (await headers()).get("x-correlation-id");

  if (isAuthDevBypassEnabled()) {
    // Keep the walkthrough functional without constructing a persistence
    // service. The fixture detail route provides the stable destination.
    if (label.length === 0 || audience.length === 0) {
      return {
        status: "error",
        message: "Revise os dados do formulário e tente novamente.",
      };
    }
    return {
      status: "success",
      linkId: "turma-5b",
      label,
      audience,
      token: generateAccessLinkToken(),
    };
  }

  const organizationId = await resolveOrganizationId(
    actor.profileId,
    organizationIdRaw ?? undefined,
  );
  const expiresAt = parseExpiry(expirationRaw, expiresAtRaw);

  // Service validates label/audience/expiry and persists only the digest.
  const { getAccessLinkService } =
    await import("@/server/services/service-container");
  const service = getAccessLinkService();
  try {
    const { link, token } = await service.createAccessLink(
      actor,
      {
        organizationId,
        label,
        audience,
        ...(expiresAt === undefined ? {} : { expiresAt }),
      },
      correlationId ?? undefined,
    );

    revalidatePath("/portal/atividades");
    // No redirect: the raw token is shown only once, rendered from this
    // return value by the client form. Putting it in a query string would
    // leak the secret into history, access logs, and Referer headers.
    return {
      status: "success",
      linkId: link.id,
      label: link.label,
      audience: link.audience,
      token,
    };
  } catch (error) {
    logActionFailure("access link creation", error, correlationId);
    return {
      status: "error",
      message: actionFailureMessage(
        error,
        "Não foi possível criar o link agora. Tente novamente em instantes.",
      ),
    };
  }
}

export async function updateAccessLinkAction(
  _prevState: UpdateAccessLinkActionState,
  formData: FormData,
): Promise<UpdateAccessLinkActionState> {
  // Auth stays outside the try block on purpose: it may legitimately redirect
  // (/entrar) and NEXT_REDIRECT must propagate, not become an error state.
  const actor = await requireActor();
  const linkId = String(formData.get("linkId") ?? "");
  const labelRaw = formData.get("label") as string | null;
  const audienceRaw = formData.get("audience") as string | null;
  const expiresAtRaw = formData.get("expiration") as string | null;
  const expiresAtCustomRaw = formData.get("expiresAt") as string | null;
  const correlationId = (await headers()).get("x-correlation-id");

  const expiresAt = parseExpiry(expiresAtRaw, expiresAtCustomRaw);

  const payload: {
    label?: string;
    audience?: string;
    expiresAt?: Date | null;
  } = {};
  // Only include label/audience when the form actually sent them; empty
  // strings are passed through so the service validation (requireTrimmedText)
  // can surface a proper VALIDATION_FAILED instead of silently ignoring.
  if (labelRaw !== null) payload.label = String(labelRaw);
  if (audienceRaw !== null) payload.audience = String(audienceRaw);
  if (expiresAt !== undefined) payload.expiresAt = expiresAt;

  if (isAuthDevBypassEnabled()) {
    // There is no persisted state in fixture mode; return to the fixture
    // detail route instead of constructing the Prisma-backed service.
    redirect(`/portal/atividades/${linkId}`);
  }

  const { getAccessLinkService } =
    await import("@/server/services/service-container");
  const service = getAccessLinkService();
  try {
    if (Object.keys(payload).length > 0) {
      // Unified metadata update persists label/audience and/or expiry
      // atomically with a single audit row (metadata_changed).
      await service.updateAccessLink(
        actor,
        linkId,
        payload,
        correlationId ?? undefined,
      );
    }
  } catch (error) {
    logActionFailure("access link update", error, correlationId);
    return {
      status: "error",
      message: actionFailureMessage(
        error,
        "Não foi possível salvar as alterações agora. Tente novamente em instantes.",
      ),
    };
  }

  revalidatePath(`/portal/atividades/${linkId}`);
  revalidatePath("/portal/atividades");
  // Redirect stays OUTSIDE the try block so NEXT_REDIRECT propagates through
  // useActionState and lands on the detail page as before.
  redirect(`/portal/atividades/${linkId}`);
}

export async function revokeAccessLinkAction(
  formData: FormData,
): Promise<AccessLifecycleActionResult> {
  const actor = await requireActor();
  const linkId = String(formData.get("linkId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || undefined;
  const correlationId = (await headers()).get("x-correlation-id");

  if (isAuthDevBypassEnabled()) {
    return { status: "success" };
  }

  const { getAccessLinkService } =
    await import("@/server/services/service-container");
  const service = getAccessLinkService();
  try {
    await service.revokeAccessLink(
      actor,
      linkId,
      reason,
      correlationId ?? undefined,
    );
  } catch (error) {
    logActionFailure("access link revocation", error, correlationId);
    return {
      status: "error",
      message: actionFailureMessage(
        error,
        "Não foi possível encerrar o link agora. Tente novamente em instantes.",
      ),
    };
  }
  revalidatePath(`/portal/atividades/${linkId}`);
  revalidatePath("/portal/atividades");
  return { status: "success" };
}

/**
 * Pauses the link (temporary): the same token/URL keeps working once resumed,
 * so no new secret is issued and nothing needs to be re-shared afterwards.
 */
export async function pauseAccessLinkAction(
  formData: FormData,
): Promise<AccessLifecycleActionResult> {
  const actor = await requireActor();
  const linkId = String(formData.get("linkId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || undefined;
  const correlationId = (await headers()).get("x-correlation-id");

  if (isAuthDevBypassEnabled()) {
    return { status: "success" };
  }

  const { getAccessLinkService } =
    await import("@/server/services/service-container");
  const service = getAccessLinkService();
  try {
    await service.pauseAccessLink(
      actor,
      linkId,
      reason,
      correlationId ?? undefined,
    );
  } catch (error) {
    logActionFailure("access link pause", error, correlationId);
    return {
      status: "error",
      message: actionFailureMessage(
        error,
        "Não foi possível pausar o link agora. Tente novamente em instantes.",
      ),
    };
  }
  revalidatePath(`/portal/atividades/${linkId}`);
  revalidatePath("/portal/atividades");
  return { status: "success" };
}

/**
 * Resumes a paused link: clears the pause so the SAME token/URL becomes
 * reachable again — participants keep using the link they already have.
 */
export async function resumeAccessLinkAction(
  formData: FormData,
): Promise<AccessLifecycleActionResult> {
  const actor = await requireActor();
  const linkId = String(formData.get("linkId") ?? "");
  const correlationId = (await headers()).get("x-correlation-id");

  if (isAuthDevBypassEnabled()) {
    return { status: "success" };
  }

  const { getAccessLinkService } =
    await import("@/server/services/service-container");
  const service = getAccessLinkService();
  try {
    await service.resumeAccessLink(actor, linkId, correlationId ?? undefined);
  } catch (error) {
    logActionFailure("access link resume", error, correlationId);
    return {
      status: "error",
      message: actionFailureMessage(
        error,
        "Não foi possível reabrir o link agora. Tente novamente em instantes.",
      ),
    };
  }
  revalidatePath(`/portal/atividades/${linkId}`);
  revalidatePath("/portal/atividades");
  return { status: "success" };
}

export async function rotateAccessLinkAction(
  formData: FormData,
): Promise<RotateAccessLinkActionState> {
  const actor = await requireActor();
  const linkId = String(formData.get("linkId") ?? "");
  const correlationId = (await headers()).get("x-correlation-id");

  if (isAuthDevBypassEnabled()) {
    return {
      status: "success",
      linkId: linkId || "turma-5b",
      token: generateAccessLinkToken(),
    };
  }

  const { getAccessLinkService } =
    await import("@/server/services/service-container");
  const service = getAccessLinkService();
  try {
    const { link, token: newToken } = await service.rotateAccessLink(
      actor,
      linkId,
      {},
      correlationId ?? undefined,
    );
    revalidatePath("/portal/atividades");
    revalidatePath(`/portal/atividades/${link.id}`);
    // No redirect: like creation, the raw replacement token returns only via
    // this state value and is displayed once by the caller's client state.
    return { status: "success", linkId: link.id, token: newToken };
  } catch (error) {
    logActionFailure("access link rotation", error, correlationId);
    return {
      status: "error",
      message: actionFailureMessage(
        error,
        "Não foi possível rotacionar o link agora. Tente novamente em instantes.",
      ),
    };
  }
}
