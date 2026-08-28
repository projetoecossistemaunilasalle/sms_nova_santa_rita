import Link from "next/link";
import { headers } from "next/headers";

import { ActivityMark } from "@/components/portal/activity-mark";
import { PageHeader } from "@/components/portal/page-header";
import { PortalState } from "@/components/portal/portal-state";
import styles from "@/components/portal/portal.module.css";
import { StatusBadge } from "@/components/portal/status-badge";
import { Icon } from "@/components/shared/icon";
import { isAuthDevBypassEnabled } from "@/server/config/env";
import { logger } from "@/server/observability/logger";
import { resolveLinkStatus } from "@/server/services/link-status";
import { listAccessLinks as listMockLinks } from "@/server/services/portal-view-service";
import type { AccessLinkSummary } from "@/server/services/portal-view-service";

export const metadata = { title: "Links de acesso" };

export const dynamic = "force-dynamic";

export default async function ActivitiesPage() {
  let links: AccessLinkSummary[] = [];
  let loadError: string | null = null;
  let isFallbackMock = false;

  if (isAuthDevBypassEnabled()) {
    // The bypass is a complete local fixture path, not a fallback after a
    // failed database request. This keeps the portal usable without Neon.
    links = listMockLinks();
    isFallbackMock = true;
  } else {
    try {
      const { getAuthGateway } = await import("@/server/auth/gateway");
      const session = await getAuthGateway().getSession();
      if (session) {
        const { getAccessLinkService } =
          await import("@/server/services/service-container");
        const service = getAccessLinkService();
        const records = await service.listAccessLinks(session.actor);
        links = records.map((r) => ({
          id: r.id,
          label: r.label,
          audience: r.audience,
          // Shared mapper: paused outranks expired, matching the public page.
          status: resolveLinkStatus(r),
          sessions: 0,
          completion: 0,
          created: new Date(r.createdAt).toLocaleDateString("pt-BR"),
          lastUsed: new Date(r.createdAt).toLocaleDateString("pt-BR"),
          expires: r.expiresAt
            ? new Date(r.expiresAt).toLocaleDateString("pt-BR")
            : "Sem expiração",
          symbol: "link" as const,
          tone: "blue" as const,
        }));
      }
    } catch (error) {
      // Exception details (and anything they embed) stay in the logs only;
      // the UI receives a fixed, actionable pt-BR message.
      logger.error(
        {
          err: error,
          correlationId: (await headers()).get("x-correlation-id"),
        },
        "failed to list access links for the portal page",
      );
      loadError =
        "Não foi possível carregar os links agora. Tente novamente em instantes.";
      links = [];
    }
  }
  const openCount = links.filter((link) => link.status === "Aberta").length;
  const sessionCount = links.reduce((total, link) => total + link.sessions, 0);
  const isEmpty = !isFallbackMock && links.length === 0;

  return (
    <>
      <PageHeader
        eyebrow="Links de acesso"
        title="Envie a atividade para cada turma."
        description="Cada link abre a experiência GameMaker diretamente. O portal fica para compartilhar acessos e acompanhar sessões."
        actions={
          <Link className={styles.button} href="/portal/atividades/nova">
            <Icon name="link" /> Novo link
          </Link>
        }
      />

      <section className={styles.summaryStrip} aria-label="Resumo de links">
        <article className={styles.summaryCard}>
          <p>Links totais</p>
          <strong>{links.length}</strong>
        </article>
        <article className={styles.summaryCard}>
          <p>Ativos</p>
          <strong>{openCount}</strong>
        </article>
        <article className={styles.summaryCard}>
          <p>Sessões</p>
          <strong>{sessionCount}</strong>
        </article>
        <article className={styles.summaryCard}>
          <p>Jogo conectado</p>
          <strong>1</strong>
        </article>
      </section>

      {isFallbackMock && (
        <p className={styles.sampleNote}>
          Dados de demonstração (bypass de desenvolvimento ativo).
        </p>
      )}

      <div className={styles.toolbar}>
        <label className={styles.searchField}>
          <span
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              overflow: "hidden",
            }}
          >
            Buscar links
          </span>
          <Icon name="search" />
          <input type="search" placeholder="Buscar por turma ou link" />
        </label>
        <div className={styles.filterGroup}>
          <select
            className={styles.select}
            aria-label="Filtrar por status do link"
            defaultValue="todos"
          >
            <option value="todos">Todos os links</option>
            <option value="aberta">Ativos</option>
            <option value="pausada">Pausados</option>
            <option value="encerrada">Encerrados</option>
          </select>
        </div>
      </div>

      {isEmpty ? (
        loadError ? (
          <PortalState
            icon="alert"
            title="Não foi possível carregar os links."
            description={loadError}
            actions={
              <Link className={styles.button} href="/portal/atividades">
                Tentar novamente
              </Link>
            }
          />
        ) : (
          <PortalState
            icon="flag"
            title="Crie o primeiro link de acesso."
            description="A experiência Missões do Caramelito já está pronta. Gere um link personalizado para compartilhar com a turma."
            actions={
              <Link className={styles.button} href="/portal/atividades/nova">
                <Icon name="link" /> Novo link
              </Link>
            }
          />
        )
      ) : (
        <div className={styles.activityList}>
          {links.map((link) => (
            <Link
              className={styles.activityRow}
              href={`/portal/atividades/${link.id}`}
              key={link.id}
            >
              <span className={styles.activityIdentity}>
                <ActivityMark symbol={link.symbol} tone={link.tone} />
                <span>
                  <strong>{link.label}</strong>
                  <small>{link.audience}</small>
                </span>
              </span>
              <StatusBadge status={link.status} />
              <span className={styles.activityMetric}>
                <strong>{link.sessions}</strong>
                <small>sessões</small>
              </span>
              <span className={styles.activityMetric}>
                <strong>{link.completion}%</strong>
                <small>{link.lastUsed}</small>
              </span>
              <span className={styles.iconButton} aria-hidden="true">
                <Icon name="chevron" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
