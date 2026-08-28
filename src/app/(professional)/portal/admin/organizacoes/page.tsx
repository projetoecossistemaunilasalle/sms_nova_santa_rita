import { redirect } from "next/navigation";

import { PageHeader } from "@/components/portal/page-header";
import styles from "@/components/portal/portal.module.css";
import { StatusBadge } from "@/components/portal/status-badge";
import { Icon } from "@/components/shared/icon";
import { getAuthGateway } from "@/server/auth/gateway";
import { Capability } from "@/generated/prisma/enums";
import { isAuthDevBypassEnabled } from "@/server/config/env";
import { getAuthorizationService } from "@/server/services/service-container";
import { organizations } from "@/server/services/portal-view-service";

export const metadata = { title: "Organizações" };

export default async function OrganizationsPage() {
  const session = await getAuthGateway().getSession();
  if (!session) redirect("/entrar");

  // P1-7 FIX: resolve effective scope; org-scoped grants must not see platform-wide fixture unfiltered.
  // Organizations are scoped: platform sees all, org-scoped sees filtered subset, denied redirects.
  // Stricter alternative for platform-wide admin screens: require platform grant
  // (`if (scope.kind !== "platform") redirect(...)`).
  let visibleOrganizations: (typeof organizations)[number][] = [
    ...organizations,
  ];
  if (!isAuthDevBypassEnabled()) {
    const scope = await getAuthorizationService().resolveEffectiveScope(
      session.actor.profileId,
      Capability.ORGANIZATION_MANAGE,
    );
    if (scope.kind === "denied") redirect("/portal/sem-acesso");
    if (scope.kind === "organizations") {
      visibleOrganizations = organizations.filter((organization) =>
        scope.organizationIds.includes(organization.id),
      );
      // To enforce platform-only for this screen, replace filter with:
      // redirect("/portal/sem-acesso");
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Escopos de acesso"
        title="Organizações"
        description="Gerencie as unidades usadas para limitar links, resultados e permissões profissionais."
        actions={
          <button className={styles.button} type="button">
            <Icon name="plus" /> Nova organização
          </button>
        }
      />
      <div className={styles.adminTable}>
        <div className={styles.tableHeader}>
          <span>Organização</span>
          <span>Tipo</span>
          <span>Estado</span>
          <span>Membros</span>
          <span />
        </div>
        {visibleOrganizations.map((organization) => (
          <div className={styles.tableRow} key={organization.name}>
            <span className={styles.tableIdentity}>
              <i className={styles.tableIdentityIcon}>
                {organization.initials}
              </i>
              <span>
                <strong>{organization.name}</strong>
                <small>Nova Santa Rita</small>
              </span>
            </span>
            <span>{organization.type}</span>
            <StatusBadge status={organization.status} />
            <span>{organization.members}</span>
            <button
              className={styles.iconButton}
              type="button"
              aria-label={`Gerenciar ${organization.name}`}
            >
              <Icon name="more" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
