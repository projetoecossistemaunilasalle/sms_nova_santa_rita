"use client";

import Link from "next/link";

import type {
  AdultRole,
  OrganizationSummaryDto,
} from "@/application/adult-portal/types";
import type { RuntimeMode } from "@/runtime/mode";
import { RecordStatus } from "@/generated/prisma/enums";
import {
  changeOrganizationStatusAction,
  createOrganizationAction,
} from "@/runtime/actions";
import { Icon } from "@/components/shared/icon";

import { AdultPortalForm } from "./adult-portal-form";
import { DeactivateOrganizationControl } from "./deactivate-organization-control";
import {
  demoOrganizations,
  demoRole,
  initials,
  recordStatusLabel,
} from "./adult-portal-helpers";
import { PageHeader } from "./page-header";
import { PortalState } from "./portal-state";
import { StatusBadge } from "./status-badge";
import { useDemoPortalState } from "./use-demo-portal";
import styles from "./portal.module.css";

export function OrganizationsScreen({
  initialOrganizations,
  canCreate,
  runtimeMode,
  initialRole,
}: {
  initialOrganizations: OrganizationSummaryDto[];
  canCreate: boolean;
  runtimeMode: RuntimeMode;
  initialRole: AdultRole;
}) {
  const demo = useDemoPortalState();
  const organizations = demo ? demoOrganizations(demo) : initialOrganizations;
  const actorCanCreate = demo ? demoRole(demo) === "platform_admin" : canCreate;

  const role = demo ? demoRole(demo) : initialRole;
  if (!role || role === "teacher") {
    return (
      <PortalState
        icon="lock"
        title="Organizações ficam com a administração"
        description="Professores acessam somente as turmas ativas que foram atribuídas a eles."
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Estrutura da plataforma"
        title="Organizações"
        description="Crie unidades, acompanhe seus vínculos adultos e controle quando uma organização pode operar."
      />
      {runtimeMode === "demo" && (
        <p className={styles.demoScopeNotice}>
          Dados desta tela ficam somente neste navegador e usam identificadores
          demo.
        </p>
      )}
      {actorCanCreate && (
        <section className={styles.managementPanel}>
          <div>
            <h2>Nova organização</h2>
            <p>
              Cadastre apenas a estrutura institucional necessária para o V1.
            </p>
          </div>
          <AdultPortalForm
            action={createOrganizationAction}
            submitLabel="Criar organização"
          >
            <label className={styles.field}>
              <span>Nome</span>
              <input
                className={styles.input}
                name="name"
                required
                maxLength={200}
                placeholder="Ex.: EMEF Caminhos do Sul"
              />
            </label>
            <label className={styles.field}>
              <span>Tipo</span>
              <input
                className={styles.input}
                name="type"
                required
                maxLength={80}
                placeholder="Ex.: Escola municipal"
              />
            </label>
          </AdultPortalForm>
        </section>
      )}
      {organizations.length === 0 ? (
        <PortalState
          icon="building"
          title="Nenhuma organização disponível"
          description="Crie a primeira organização ou confirme se o seu vínculo está ativo."
        />
      ) : (
        <div className={styles.adminTable}>
          <div
            className={`${styles.tableHeader} ${styles.organizationTableRow}`}
          >
            <span>Organização</span>
            <span>Tipo</span>
            <span>Estado</span>
            <span>Turmas</span>
            <span>Equipe</span>
            <span />
          </div>
          {organizations.map((organization) => {
            const generatedInBrowser =
              organization.id.startsWith("demo-organization-");
            const identity = (
              <span className={styles.tableIdentity}>
                <i className={styles.tableIdentityIcon}>
                  {initials(organization.name)}
                </i>
                <span>
                  <strong>{organization.name}</strong>
                  <small>
                    {generatedInBrowser
                      ? "Criada neste navegador"
                      : "Estrutura institucional"}
                  </small>
                </span>
              </span>
            );
            return (
              <div
                className={`${styles.tableRow} ${styles.organizationTableRow}`}
                key={organization.id}
              >
                {generatedInBrowser ? (
                  identity
                ) : (
                  <Link
                    className={styles.tableIdentity}
                    href={`/portal/admin/organizacoes/${organization.id}`}
                  >
                    {identity}
                  </Link>
                )}
                <span>{organization.type}</span>
                <StatusBadge status={recordStatusLabel(organization.status)} />
                <span>{organization.classCount}</span>
                <span>{organization.memberCount}</span>
                {actorCanCreate ? (
                  organization.status === RecordStatus.ACTIVE ? (
                    <DeactivateOrganizationControl
                      organizationId={organization.id}
                      organizationName={organization.name}
                      triggerLabel="Desativar"
                    />
                  ) : (
                    <AdultPortalForm
                      action={changeOrganizationStatusAction}
                      submitLabel="Ativar"
                      compact
                    >
                      <input
                        type="hidden"
                        name="organizationId"
                        value={organization.id}
                      />
                      <input
                        type="hidden"
                        name="status"
                        value={RecordStatus.ACTIVE}
                      />
                    </AdultPortalForm>
                  )
                ) : !generatedInBrowser ? (
                  <Link
                    className={styles.iconButton}
                    href={`/portal/admin/organizacoes/${organization.id}`}
                    aria-label={`Abrir ${organization.name}`}
                  >
                    <Icon name="chevron" />
                  </Link>
                ) : (
                  <span />
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
