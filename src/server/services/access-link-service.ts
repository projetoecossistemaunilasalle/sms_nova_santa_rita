import type { PortalActor } from "@/server/auth/session";
import { Capability } from "@/generated/prisma/enums";
import { HttpError, type ApiErrorDetail } from "@/server/http/errors";
import { generateAccessLinkToken, hashToken } from "@/server/security/tokens";
import {
  ACCESS_LINK_CREATED,
  ACCESS_LINK_EXPIRY_CHANGED,
  ACCESS_LINK_METADATA_CHANGED,
  ACCESS_LINK_PAUSED,
  ACCESS_LINK_RESUMED,
  ACCESS_LINK_REVOKED,
  ACCESS_LINK_ROTATED,
} from "@/server/services/audit-actions";
import type { AuthorizationService } from "@/server/services/authorization-service";

/**
 * One persisted `access_links` row. `tokenHash` is the only persisted
 * representation of the link secret: the raw token never reaches a store.
 */
export type AccessLinkRecord = {
  id: string;
  organizationId: string;
  createdById: string;
  label: string;
  audience: string;
  tokenHash: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  /** When set, the link is paused (temporary); the same token stays valid. */
  pausedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Audit event payload written next to each lifecycle mutation. Contains
 * application identifiers and controlled reasons only — never token material
 * (neither the raw token nor its hash).
 */
export type AuditEventInput = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  correlationId?: string;
};

/**
 * Persistence port for the access-link lifecycle.
 *
 * Invariants:
 * - Audit writes go through {@link recordAudit} on the same store instance as
 *   the link mutation, so an audit row joins the surrounding transaction when
 *   one is active: inside `transaction(fn)`, every operation the service
 *   performs through the tx store (including `recordAudit`) commits together
 *   or not at all. A rejection of `fn` leaves none of them persisted.
 * - Implementations must not log raw tokens; the service never hands a raw
 *   token to the store in the first place (only `hashToken` output).
 */
export type AccessLinkStore = {
  findById(id: string): Promise<AccessLinkRecord | null>;
  /** Resolves a link by the SHA-256 digest of its raw token. */
  findByTokenHash(tokenHash: string): Promise<AccessLinkRecord | null>;
  listByOrganizationIds(organizationIds: string[]): Promise<AccessLinkRecord[]>;
  /** Lists links across all organizations (platform scope). */
  listAll(): Promise<AccessLinkRecord[]>;
  insert(data: {
    organizationId: string;
    createdById: string;
    label: string;
    audience: string;
    tokenHash: string;
    expiresAt: Date | null;
    /** Pre-allocated id for deterministic tests; generated when omitted. */
    id?: string;
    /** Timestamp used for createdAt/updatedAt. */
    now: Date;
  }): Promise<AccessLinkRecord>;
  revoke(id: string, now: Date): Promise<void>;
  /**
   * Swaps the token digest (and expiry) ON THE SAME ROW — used by rotation so
   * the link id is preserved and every share URL / audit trail / aggregated
   * result keeps pointing at one stable id. Must not mutate a revoked link
   * (404-vs-409 like {@link revoke}); the conditional update makes concurrent
   * rotations serialize instead of racing the same row.
   */
  replaceToken(
    id: string,
    data: { tokenHash: string; expiresAt: Date | null },
    now: Date,
  ): Promise<void>;
  /**
   * Pauses a still-active link (temporary): sets `pausedAt` and keeps the
   * token/URL unchanged so the link can be resumed later. Must not mutate a
   * revoked link (404-vs-409 like {@link revoke}).
   */
  pause(id: string, now: Date): Promise<void>;
  /**
   * Clears `pausedAt` on a paused link; the same token/URL becomes usable
   * again. Must not mutate a revoked link (404-vs-409 like {@link revoke}).
   */
  resume(id: string, now: Date): Promise<void>;
  setExpiry(id: string, expiresAt: Date | null, now: Date): Promise<void>;
  updateMetadata(
    id: string,
    data: { label?: string; audience?: string; expiresAt?: Date | null },
    now: Date,
  ): Promise<void>;
  /** Persists one audit row (see port invariants above). */
  recordAudit(event: AuditEventInput): Promise<void>;
  /**
   * Runs `fn` atomically; on rejection none of the operations performed
   * through the tx store (link mutations or audit writes) persist.
   */
  transaction<T>(fn: (tx: AccessLinkStore) => Promise<T>): Promise<T>;
};

/** Time source port; injected so tests can freeze the clock. */
export type Clock = {
  now(): Date;
};

/** db varchar limits mirrored from the Prisma schema. */
const MAX_TEXT_LENGTH = 200;
const MAX_REASON_LENGTH = 500;

/** Audit entity type for access-link rows. */
const ACCESS_LINK_ENTITY_TYPE = "access_link";

/**
 * Shapes of token material that must never reach an audit payload: a raw
 * access-link token (43-char base64url) or its SHA-256 hex digest. Reasons
 * are free text, so a link/token can be pasted into them by accident.
 */
const RAW_TOKEN_IN_TEXT = /[A-Za-z0-9_-]{43}/g;
const TOKEN_DIGEST_IN_TEXT = /\b[a-f0-9]{64}\b/gi;

/**
 * Redacts anything shaped like a raw token or its digest from free text.
 * Applied only to audit reasons right before persisting — validation still
 * runs on the original trimmed value first.
 */
function scrubTokenMaterial(text: string): string {
  return text
    .replace(RAW_TOKEN_IN_TEXT, "[redacted]")
    .replace(TOKEN_DIGEST_IN_TEXT, "[redacted]");
}

function validationError(
  message: string,
  details: ApiErrorDetail[],
): HttpError {
  return new HttpError(400, "VALIDATION_FAILED", message, details);
}

function linkNotFound(): HttpError {
  return new HttpError(404, "RESOURCE_NOT_FOUND", "Access link not found.");
}

function linkAlreadyRevoked(): HttpError {
  return new HttpError(
    409,
    "CONFLICT",
    "The access link has already been revoked.",
  );
}

/**
 * Trims a free-text field and enforces non-empty and ≤ `maxLength` chars
 * (matching the `access_links` varchar(200) columns). Returns the trimmed
 * value that gets persisted.
 */
function requireTrimmedText(
  field: "label" | "audience",
  value: string,
): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw validationError(`The ${field} must not be empty.`, [
      { path: field, reason: `${field} is required` },
    ]);
  }
  if (trimmed.length > MAX_TEXT_LENGTH) {
    throw validationError(
      `The ${field} must be at most ${MAX_TEXT_LENGTH} characters.`,
      [
        {
          path: field,
          reason: `${field} must not exceed ${MAX_TEXT_LENGTH} characters`,
        },
      ],
    );
  }
  return trimmed;
}

/** Rejects an expiry that is not strictly in the future. */
function requireFutureExpiry(expiresAt: Date, now: Date): void {
  if (expiresAt.getTime() <= now.getTime()) {
    throw validationError("The expiry must be in the future.", [
      { path: "expiresAt", reason: "expiresAt must be a future timestamp" },
    ]);
  }
}

/** Serializes an expiry for audit payloads (ISO string or null). */
function expiryForAudit(expiresAt: Date | null): string | null {
  return expiresAt === null ? null : expiresAt.toISOString();
}

/**
 * Access-link lifecycle: create, rotate, revoke, expiry, reads.
 *
 * Invariants:
 * - Every method performs authorization itself (deny by default) even when a
 *   caller already checked: writes need LINK_MANAGE, reads need LINK_VIEW,
 *   always scoped to the link's organization.
 * - Raw tokens live only in the return values of create/rotate (shown exactly
 *   once); only their SHA-256 digest is persisted and audit payloads carry
 *   identifiers, never token material.
 * - Rotation swaps the token ON THE SAME ROW (same id) inside one transaction
 *   with its audit row: the link id, its URL history semantics and every
 *   aggregated result stay anchored to a single id, while the previous token
 *   stops resolving immediately. Non-expiring by default; every expiry change
 *   is audited.
 * - Pause is temporary and reversible: it stamps `pausedAt` while keeping the
 *   same token/URL (resuming restores access without reissuing anything).
 *   Revocation stays terminal — a revoked link can never be paused, resumed
 *   or otherwise mutated.
 * - Missing links fail with 404 before authorization: the org-scoped 403 for
 *   an existing link leaks nothing about nonexistent ids, so a missing id
 *   must not reveal whether the actor could have acted on it either.
 */
export class AccessLinkService {
  private readonly tokenFactory: () => string;

  constructor(
    private readonly deps: {
      store: AccessLinkStore;
      authorization: AuthorizationService;
      clock: Clock;
      /** Override for deterministic tests; defaults to the real generator. */
      tokenFactory?: () => string;
    },
  ) {
    this.tokenFactory = deps.tokenFactory ?? generateAccessLinkToken;
  }

  /**
   * Creates a non-expiring (by default) access link and returns the raw token
   * exactly once. Only the token digest is persisted; the audit payload
   * carries label/audience/expiry without token material.
   */
  async createAccessLink(
    actor: PortalActor,
    input: {
      organizationId: string;
      label: string;
      audience: string;
      expiresAt?: Date | null;
    },
    correlationId?: string,
  ): Promise<{ link: AccessLinkRecord; token: string }> {
    await this.deps.authorization.assertCanUse(
      actor.profileId,
      Capability.LINK_MANAGE,
      input.organizationId,
    );

    const label = requireTrimmedText("label", input.label);
    const audience = requireTrimmedText("audience", input.audience);

    const now = this.deps.clock.now();
    let expiresAt: Date | null = null;
    if (input.expiresAt !== undefined && input.expiresAt !== null) {
      requireFutureExpiry(input.expiresAt, now);
      expiresAt = input.expiresAt;
    }

    const token = this.tokenFactory();
    const link = await this.deps.store.transaction(async (tx) => {
      const inserted = await tx.insert({
        organizationId: input.organizationId,
        createdById: actor.profileId,
        label,
        audience,
        tokenHash: hashToken(token),
        expiresAt,
        now,
      });
      await tx.recordAudit({
        actorId: actor.profileId,
        action: ACCESS_LINK_CREATED,
        entityType: ACCESS_LINK_ENTITY_TYPE,
        entityId: inserted.id,
        after: {
          label,
          audience,
          expiresAt: expiryForAudit(expiresAt),
        },
        correlationId,
      });
      return inserted;
    });

    return { link, token };
  }

  /**
   * Replaces the link's token ON THE SAME ROW: id, URL history and aggregated
   * results survive under one stable link id, while the previous token stops
   * resolving immediately and the raw replacement is returned exactly once.
   * `input.expiresAt` semantics: `undefined` keeps the current expiry,
   * `null` clears it, a Date sets it (must be strictly in the future).
   */
  async rotateAccessLink(
    actor: PortalActor,
    linkId: string,
    input: { expiresAt?: Date | null },
    correlationId?: string,
  ): Promise<{ link: AccessLinkRecord; token: string }> {
    const link = await this.loadLink(linkId);
    await this.deps.authorization.assertCanUse(
      actor.profileId,
      Capability.LINK_MANAGE,
      link.organizationId,
    );
    if (link.revokedAt !== null) {
      throw linkAlreadyRevoked();
    }

    const now = this.deps.clock.now();
    let expiresAt: Date | null;
    if (input.expiresAt === undefined) {
      expiresAt = link.expiresAt;
    } else if (input.expiresAt === null) {
      expiresAt = null;
    } else {
      requireFutureExpiry(input.expiresAt, now);
      expiresAt = input.expiresAt;
    }

    const token = this.tokenFactory();
    const tokenHash = hashToken(token);
    await this.deps.store.transaction(async (tx) => {
      await tx.replaceToken(link.id, { tokenHash, expiresAt }, now);
      await tx.recordAudit({
        actorId: actor.profileId,
        action: ACCESS_LINK_ROTATED,
        entityType: ACCESS_LINK_ENTITY_TYPE,
        entityId: link.id,
        before: { previousExpiresAt: expiryForAudit(link.expiresAt) },
        after: {
          label: link.label,
          audience: link.audience,
          expiresAt: expiryForAudit(expiresAt),
        },
        correlationId,
      });
    });

    // Same row, mutated locally so callers keep operating on one stable id.
    return {
      link: { ...link, tokenHash, expiresAt, updatedAt: now },
      token,
    };
  }

  /**
   * Revokes a link (terminal). The optional reason is trimmed and capped at
   * 500 characters (validated on the original value); it is stored on the
   * audit row only, redacted if it embeds token-shaped material.
   */
  async revokeAccessLink(
    actor: PortalActor,
    linkId: string,
    reason?: string,
    correlationId?: string,
  ): Promise<void> {
    const link = await this.loadLink(linkId);
    await this.deps.authorization.assertCanUse(
      actor.profileId,
      Capability.LINK_MANAGE,
      link.organizationId,
    );
    if (link.revokedAt !== null) {
      throw linkAlreadyRevoked();
    }

    let trimmedReason: string | undefined;
    if (reason !== undefined) {
      trimmedReason = reason.trim();
      if (
        trimmedReason.length === 0 ||
        trimmedReason.length > MAX_REASON_LENGTH
      ) {
        throw validationError(
          `The reason must be between 1 and ${MAX_REASON_LENGTH} characters.`,
          [
            {
              path: "reason",
              reason: `reason must not exceed ${MAX_REASON_LENGTH} characters`,
            },
          ],
        );
      }
    }

    const now = this.deps.clock.now();
    await this.deps.store.transaction(async (tx) => {
      await tx.revoke(link.id, now);
      await tx.recordAudit({
        actorId: actor.profileId,
        action: ACCESS_LINK_REVOKED,
        entityType: ACCESS_LINK_ENTITY_TYPE,
        entityId: link.id,
        ...(trimmedReason === undefined
          ? {}
          : { reason: scrubTokenMaterial(trimmedReason) }),
        correlationId,
      });
    });
  }

  /**
   * Pauses a link (temporary): access is blocked while the same token/URL
   * stays valid, so resuming later restores it without reissuing anything.
   * The optional reason is trimmed and capped at 500 characters (validated on
   * the original value); it is stored on the audit row only, redacted if it
   * embeds token-shaped material.
   */
  async pauseAccessLink(
    actor: PortalActor,
    linkId: string,
    reason?: string,
    correlationId?: string,
  ): Promise<void> {
    const link = await this.loadLink(linkId);
    await this.deps.authorization.assertCanUse(
      actor.profileId,
      Capability.LINK_MANAGE,
      link.organizationId,
    );
    if (link.revokedAt !== null) {
      throw linkAlreadyRevoked();
    }

    let trimmedReason: string | undefined;
    if (reason !== undefined) {
      trimmedReason = reason.trim();
      if (
        trimmedReason.length === 0 ||
        trimmedReason.length > MAX_REASON_LENGTH
      ) {
        throw validationError(
          `The reason must be between 1 and ${MAX_REASON_LENGTH} characters.`,
          [
            {
              path: "reason",
              reason: `reason must not exceed ${MAX_REASON_LENGTH} characters`,
            },
          ],
        );
      }
    }

    const now = this.deps.clock.now();
    await this.deps.store.transaction(async (tx) => {
      await tx.pause(link.id, now);
      await tx.recordAudit({
        actorId: actor.profileId,
        action: ACCESS_LINK_PAUSED,
        entityType: ACCESS_LINK_ENTITY_TYPE,
        entityId: link.id,
        before: { pausedAt: null },
        after: { pausedAt: now.toISOString() },
        ...(trimmedReason === undefined
          ? {}
          : { reason: scrubTokenMaterial(trimmedReason) }),
        correlationId,
      });
    });
  }

  /**
   * Resumes a paused link by clearing `pausedAt` (audited). Idempotent:
   * resuming a link that is not paused is a no-op without an audit row.
   */
  async resumeAccessLink(
    actor: PortalActor,
    linkId: string,
    correlationId?: string,
  ): Promise<void> {
    const link = await this.loadLink(linkId);
    await this.deps.authorization.assertCanUse(
      actor.profileId,
      Capability.LINK_MANAGE,
      link.organizationId,
    );
    if (link.revokedAt !== null) {
      throw linkAlreadyRevoked();
    }
    const pausedAt = link.pausedAt;
    if (pausedAt === null) {
      return;
    }

    const now = this.deps.clock.now();
    await this.deps.store.transaction(async (tx) => {
      await tx.resume(link.id, now);
      await tx.recordAudit({
        actorId: actor.profileId,
        action: ACCESS_LINK_RESUMED,
        entityType: ACCESS_LINK_ENTITY_TYPE,
        entityId: link.id,
        before: { pausedAt: pausedAt.toISOString() },
        after: { pausedAt: null },
        correlationId,
      });
    });
  }

  /**
   * Sets or clears a link's expiry (audited). A non-null expiry must be
   * strictly in the future; `null` makes the link non-expiring again.
   */
  async setAccessLinkExpiry(
    actor: PortalActor,
    linkId: string,
    expiresAt: Date | null,
    correlationId?: string,
  ): Promise<void> {
    const link = await this.loadLink(linkId);
    await this.deps.authorization.assertCanUse(
      actor.profileId,
      Capability.LINK_MANAGE,
      link.organizationId,
    );
    if (link.revokedAt !== null) {
      throw linkAlreadyRevoked();
    }

    const now = this.deps.clock.now();
    if (expiresAt !== null) {
      requireFutureExpiry(expiresAt, now);
    }

    await this.deps.store.transaction(async (tx) => {
      await tx.setExpiry(link.id, expiresAt, now);
      await tx.recordAudit({
        actorId: actor.profileId,
        action: ACCESS_LINK_EXPIRY_CHANGED,
        entityType: ACCESS_LINK_ENTITY_TYPE,
        entityId: link.id,
        before: { expiresAt: expiryForAudit(link.expiresAt) },
        after: { expiresAt: expiryForAudit(expiresAt) },
        correlationId,
      });
    });
  }

  /**
   * Updates a link's label, audience and/or expiry in one atomic transaction.
   * Each provided field is validated (trimmed text for label/audience,
   * future timestamp for expiry). At least one field must be provided.
   * Revoked links cannot be updated.
   */
  async updateAccessLink(
    actor: PortalActor,
    linkId: string,
    input: { label?: string; audience?: string; expiresAt?: Date | null },
    correlationId?: string,
  ): Promise<void> {
    const link = await this.loadLink(linkId);
    await this.deps.authorization.assertCanUse(
      actor.profileId,
      Capability.LINK_MANAGE,
      link.organizationId,
    );
    if (link.revokedAt !== null) {
      throw linkAlreadyRevoked();
    }

    const hasLabel = input.label !== undefined;
    const hasAudience = input.audience !== undefined;
    const hasExpiry = input.expiresAt !== undefined;

    if (!hasLabel && !hasAudience && !hasExpiry) {
      return;
    }

    let validatedLabel: string | undefined;
    let validatedAudience: string | undefined;
    let validatedExpiry: Date | null | undefined;

    if (hasLabel) {
      validatedLabel = requireTrimmedText("label", input.label!);
    }
    if (hasAudience) {
      validatedAudience = requireTrimmedText("audience", input.audience!);
    }
    if (hasExpiry) {
      const exp = input.expiresAt as Date | null;
      if (exp !== null) {
        const now = this.deps.clock.now();
        requireFutureExpiry(exp, now);
      }
      validatedExpiry = exp;
    }

    const now = this.deps.clock.now();
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    if (validatedLabel !== undefined) {
      before.label = link.label;
      after.label = validatedLabel;
    }
    if (validatedAudience !== undefined) {
      before.audience = link.audience;
      after.audience = validatedAudience;
    }
    if (validatedExpiry !== undefined) {
      before.expiresAt = expiryForAudit(link.expiresAt);
      after.expiresAt = expiryForAudit(validatedExpiry);
    }

    await this.deps.store.transaction(async (tx) => {
      await tx.updateMetadata(
        link.id,
        {
          ...(validatedLabel === undefined ? {} : { label: validatedLabel }),
          ...(validatedAudience === undefined
            ? {}
            : { audience: validatedAudience }),
          ...(validatedExpiry === undefined
            ? {}
            : { expiresAt: validatedExpiry }),
        },
        now,
      );
      await tx.recordAudit({
        actorId: actor.profileId,
        action: ACCESS_LINK_METADATA_CHANGED,
        entityType: ACCESS_LINK_ENTITY_TYPE,
        entityId: link.id,
        before: Object.keys(before).length > 0 ? before : undefined,
        after: Object.keys(after).length > 0 ? after : undefined,
        correlationId,
      });
    });
  }

  /**
   * Reads one link (LINK_VIEW on the link's organization). Missing links
   * return 404 before the authorization check — see class invariants.
   */
  async getAccessLink(
    actor: PortalActor,
    linkId: string,
  ): Promise<AccessLinkRecord> {
    const link = await this.loadLink(linkId);
    await this.deps.authorization.assertCanUse(
      actor.profileId,
      Capability.LINK_VIEW,
      link.organizationId,
    );
    return link;
  }

  /**
   * Lists links visible through the actor's LINK_VIEW scope: platform scope
   * sees everything (optionally filtered by `organizationId`), an
   * organization scope sees exactly its organizations. Providing an
   * `organizationId` outside the scope (or a denied scope) is FORBIDDEN.
   */
  async listAccessLinks(
    actor: PortalActor,
    organizationId?: string,
  ): Promise<AccessLinkRecord[]> {
    const scope = await this.deps.authorization.resolveEffectiveScope(
      actor.profileId,
      Capability.LINK_VIEW,
    );

    if (scope.kind === "denied") {
      throw new HttpError(403, "FORBIDDEN", "Access denied.");
    }
    if (scope.kind === "platform") {
      return organizationId === undefined
        ? this.deps.store.listAll()
        : this.deps.store.listByOrganizationIds([organizationId]);
    }

    if (
      organizationId !== undefined &&
      !scope.organizationIds.includes(organizationId)
    ) {
      throw new HttpError(403, "FORBIDDEN", "Access denied.");
    }

    return this.deps.store.listByOrganizationIds(
      organizationId === undefined ? scope.organizationIds : [organizationId],
    );
  }

  /** Loads a link or throws 404 (before any authorization check). */
  private async loadLink(linkId: string): Promise<AccessLinkRecord> {
    const link = await this.deps.store.findById(linkId);
    if (link === null) {
      throw linkNotFound();
    }
    return link;
  }
}
