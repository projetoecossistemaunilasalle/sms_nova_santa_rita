import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/portal/page-header";
import styles from "@/components/portal/portal.module.css";
import { StatusBadge } from "@/components/portal/status-badge";
import { Icon } from "@/components/shared/icon";
import { isAuthDevBypassEnabled } from "@/server/config/env";
import { getAuthGateway } from "@/server/auth/gateway";
import { HttpError } from "@/server/http/errors";
import { logger } from "@/server/observability/logger";
import { resolveLinkStatus } from "@/server/services/link-status";
import { getDevBypassAccessLink } from "@/server/services/portal-view-service";

export const metadata = { title: "Resultados" };

export const dynamic = "force-dynamic";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getAuthGateway().getSession();
  if (!session) redirect("/entrar");

  let linkLabel: string;
  let linkStatus: ReturnType<typeof resolveLinkStatus>;
  if (isAuthDevBypassEnabled()) {
    const fixtureLink = getDevBypassAccessLink(id);
    if (!fixtureLink) notFound();
    linkLabel = fixtureLink.label;
    linkStatus = resolveLinkStatus(fixtureLink);
  } else {
    try {
      const { getAccessLinkService } =
        await import("@/server/services/service-container");
      const dbLink = await getAccessLinkService().getAccessLink(
        session.actor,
        id,
      );
      linkLabel = dbLink.label;
      linkStatus = resolveLinkStatus(dbLink);
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
        "failed to load access link for results page",
      );
      return (
        <section className={styles.detailPanel} aria-live="polite">
          <h1>Não foi possível carregar os resultados agora.</h1>
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
      );
    }
  }

  // Session ingestion does not exist yet, so every number below is an honest
  // zero — no fabricated metrics until real aggregation lands.
  return (
    <>
      <PageHeader
        eyebrow="Resultados agregados"
        title="Missões do Caramelito"
        description={`Sessões do ${linkLabel}, sem histórico ou identificação individual.`}
        actions={
          <select
            className={styles.select}
            aria-label="Período"
            defaultValue="all"
          >
            <option value="all">Todo o período</option>
            <option value="7">Últimos 7 dias</option>
          </select>
        }
      />
      <section className={styles.statsGrid} aria-label="Indicadores principais">
        <article className={styles.statCard}>
          <p>Sessões iniciadas</p>
          <strong>0</strong>
          <small>Nenhuma sessão registrada ainda</small>
        </article>
        <article className={styles.statCard}>
          <p>Sessões concluídas</p>
          <strong>0</strong>
          <small>0% de conclusão</small>
        </article>
        <article className={styles.statCard}>
          <p>Conclusão média</p>
          <strong>0%</strong>
          <small>Leitura coletiva do link</small>
        </article>
      </section>
      <div className={styles.reportGrid}>
        <article className={styles.reportPanel}>
          <div className={styles.reportPanelHeader}>
            <div>
              <h2>Sessões por dia</h2>
              <p>Participações iniciadas neste link</p>
            </div>
            <StatusBadge status={linkStatus} />
          </div>
          <p className={styles.muted} role="status">
            Ainda não há sessões registradas para este link.
          </p>
        </article>
        <aside className={styles.reportPanel}>
          <h2>Conclusão da experiência</h2>
          <p className={styles.sampleNote}>
            Sessões que chegaram ao final do jogo.
          </p>
          <div
            className={styles.completionRing}
            style={{
              background:
                "conic-gradient(var(--green) 0 0%, var(--green-light) 0% 100%)",
            }}
          >
            <strong>0%</strong>
          </div>
          <div className={styles.legend}>
            <span>
              <i />
              Concluídas
            </span>
            <span>
              <i />
              Em andamento
            </span>
          </div>
          <div className={styles.contextNotice} style={{ marginTop: 22 }}>
            <Icon name="shield" />
            <span>
              Leitura coletiva. Evite comparar grupos com amostras pequenas.
            </span>
          </div>
        </aside>
      </div>
    </>
  );
}
