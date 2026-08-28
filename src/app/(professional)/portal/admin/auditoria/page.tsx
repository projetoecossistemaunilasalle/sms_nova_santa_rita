import { redirect } from "next/navigation";

import { PageHeader } from "@/components/portal/page-header";
import styles from "@/components/portal/portal.module.css";
import { Icon } from "@/components/shared/icon";
import { getAuthGateway } from "@/server/auth/gateway";
import { Capability } from "@/generated/prisma/enums";
import { isAuthDevBypassEnabled } from "@/server/config/env";
import { getAuthorizationService } from "@/server/services/service-container";
import { auditEvents } from "@/server/services/portal-view-service";

export const metadata = { title: "Auditoria" };

export default async function AuditPage() {
  const session = await getAuthGateway().getSession();
  if (!session) redirect("/entrar");

  // P1-7 FIX: resolve effective scope; audit trail is scoped by organization.
  // Platform sees all events, org-scoped sees filtered events, denied redirects.
  // Stricter platform-only variant: `if (scope.kind !== "platform") redirect(...)`.
  let visibleAuditEvents: (typeof auditEvents)[number][] = [...auditEvents];
  if (!isAuthDevBypassEnabled()) {
    const scope = await getAuthorizationService().resolveEffectiveScope(
      session.actor.profileId,
      Capability.AUDIT_VIEW,
    );
    if (scope.kind === "denied") redirect("/portal/sem-acesso");
    if (scope.kind === "organizations") {
      visibleAuditEvents = auditEvents.filter((event) =>
        scope.organizationIds.includes(event.organizationId),
      );
      // To require platform grant instead of filtered view, replace filter with:
      // redirect("/portal/sem-acesso");
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Histórico administrativo"
        title="Trilha de auditoria"
        description="Mudanças sensíveis com ator, alvo, contexto e data. Links e credenciais nunca aparecem aqui."
      />
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
            Buscar eventos
          </span>
          <Icon name="search" />
          <input type="search" placeholder="Buscar ator, link ou organização" />
        </label>
        <div className={styles.filterGroup}>
          <select
            className={styles.select}
            aria-label="Tipo de evento"
            defaultValue="all"
          >
            <option value="all">Todos os eventos</option>
            <option value="publication">Links</option>
            <option value="availability">Status</option>
            <option value="access">Acessos</option>
          </select>
          <select
            className={styles.select}
            aria-label="Período"
            defaultValue="30"
          >
            <option value="30">Últimos 30 dias</option>
            <option value="7">Últimos 7 dias</option>
          </select>
        </div>
      </div>
      <section className={styles.detailPanel}>
        <div className={styles.auditTimeline}>
          {visibleAuditEvents.map((event) => (
            <article
              className={styles.auditEvent}
              key={`${event.date}-${event.action}`}
            >
              <time>{event.date}</time>
              <div>
                <strong>{event.action}</strong>
                <div className={styles.muted}>
                  {event.actor} · {event.target}
                </div>
              </div>
              <small>{event.detail}</small>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
