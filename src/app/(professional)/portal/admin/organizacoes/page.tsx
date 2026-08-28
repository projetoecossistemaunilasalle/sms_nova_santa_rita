import Link from "next/link";

import { PageHeader } from "@/components/portal/page-header";
import { DemoActionButton } from "@/components/portal/demo-action-button";
import styles from "@/components/portal/portal.module.css";
import { StatusBadge } from "@/components/portal/status-badge";
import { Icon } from "@/components/shared/icon";
import { organizations } from "@/server/services/portal-view-service";

export const metadata = { title: "Organizações" };

export default function OrganizationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Escopos de acesso"
        title="Organizações"
        description="Gerencie as unidades usadas para limitar links, resultados e permissões profissionais."
        actions={
          <DemoActionButton
            className={styles.button}
            message="Organização preparada apenas nesta demonstração. Nada foi gravado no servidor."
          >
            <Icon name="plus" /> Nova organização
          </DemoActionButton>
        }
      />
      <div className={styles.adminTable}>
        <div className={`${styles.tableHeader} ${styles.organizationTableRow}`}>
          <span>Organização</span>
          <span>Tipo</span>
          <span>Estado</span>
          <span>Turmas</span>
          <span>Links ativos</span>
          <span />
        </div>
        {organizations.map((organization) => (
          <div
            className={`${styles.tableRow} ${styles.organizationTableRow}`}
            key={organization.name}
          >
            <Link
              className={styles.tableIdentity}
              href={`/portal/admin/organizacoes/${organization.id}`}
            >
              <i className={styles.tableIdentityIcon}>
                {organization.initials}
              </i>
              <span>
                <strong>{organization.name}</strong>
                <small>Município Modelo</small>
              </span>
            </Link>
            <span>{organization.type}</span>
            <StatusBadge status={organization.status} />
            <span>{organization.classGroups}</span>
            <span>{organization.activeLinks}</span>
            <Link
              className={styles.iconButton}
              href={`/portal/admin/organizacoes/${organization.id}`}
              aria-label={`Abrir ${organization.name}`}
            >
              <Icon name="chevron" />
            </Link>
          </div>
        ))}
      </div>
    </>
  );
}
