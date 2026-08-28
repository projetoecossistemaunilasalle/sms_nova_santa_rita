import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AccessLinkBuilder } from "@/components/portal/activity-builder";
import { PageHeader } from "@/components/portal/page-header";
import styles from "@/components/portal/portal.module.css";
import { isAuthDevBypassEnabled } from "@/server/config/env";
import { getAuthGateway } from "@/server/auth/gateway";
import { HttpError } from "@/server/http/errors";
import { logger } from "@/server/observability/logger";
import type { AccessLinkRecord } from "@/server/services/access-link-service";
import { getDevBypassAccessLink } from "@/server/services/portal-view-service";

export const metadata = { title: "Editar link" };

/** Formats a date as YYYY-MM-DD in the school's timezone (avoids off-by-one). */
function expiresAtInputValue(expiresAt: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(expiresAt);
}

export default async function EditActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getAuthGateway().getSession();
  if (!session) redirect("/entrar");

  let dbLink: AccessLinkRecord;
  if (isAuthDevBypassEnabled()) {
    const fixtureLink = getDevBypassAccessLink(id);
    if (!fixtureLink) notFound();
    dbLink = fixtureLink;
  } else {
    try {
      const { getAccessLinkService } =
        await import("@/server/services/service-container");
      dbLink = await getAccessLinkService().getAccessLink(session.actor, id);
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.status === 404 || error.code === "RESOURCE_NOT_FOUND") {
          notFound();
        }
        if (error.status === 403 || error.code === "FORBIDDEN") {
          redirect("/portal/sem-acesso");
        }
      }
      logger.error(
        {
          err: error,
          correlationId: (await headers()).get("x-correlation-id"),
        },
        "failed to load access link for edit page",
      );
      return (
        <>
          <PageHeader
            eyebrow="Configurações do link"
            title="Editar link de acesso"
            description="Atualize o nome, o grupo e a validade do acesso sem alterar o jogo ou os resultados já recebidos."
          />
          <section className={styles.detailPanel} aria-live="polite">
            <h1>Não foi possível carregar este link agora.</h1>
            <p className={styles.muted}>
              Tente novamente em alguns instantes. Se o problema persistir, fale
              com o suporte da escola.
            </p>
            <div style={{ marginTop: 15 }}>
              <Link
                className={styles.buttonSecondary}
                href={`/portal/atividades/${id}`}
              >
                Voltar para o link
              </Link>
            </div>
          </section>
        </>
      );
    }
  }

  const initialLabel = dbLink.label;
  const initialAudience = dbLink.audience;
  const initialExpiration = dbLink.expiresAt !== null ? "date" : "never";
  const initialExpiresAt =
    dbLink.expiresAt !== null
      ? expiresAtInputValue(dbLink.expiresAt)
      : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Configurações do link"
        title="Editar link de acesso"
        description="Atualize o nome, o grupo e a validade do acesso sem alterar o jogo ou os resultados já recebidos."
      />
      <AccessLinkBuilder
        editing
        linkId={id}
        initialLabel={initialLabel}
        initialAudience={initialAudience}
        initialExpiration={initialExpiration}
        initialExpiresAt={initialExpiresAt}
      />
    </>
  );
}
