"use client";

import Link from "next/link";
import { useState } from "react";

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
  initials,
  matchesPortalSearch,
  recordStatusLabel,
} from "./adult-portal-helpers";
import { PageHeader } from "./page-header";
import { PortalState } from "./portal-state";
import { StatusBadge } from "./status-badge";
import { usePortalFilters } from "./use-portal-filters";
import styles from "./portal.module.css";

export function OrganizationsScreen({
  initialOrganizations,
  canCreate,
  initialRole,
}: {
  initialOrganizations: OrganizationSummaryDto[];
  canCreate: boolean;
  runtimeMode: RuntimeMode;
  initialRole: AdultRole;
}) {
  const organizations = initialOrganizations;
  const actorCanCreate = canCreate;
  const role = initialRole;
  const { params, setFilters } = usePortalFilters();
  const search = params.get("q") ?? "";
  const [creationOpen, setCreationOpen] = useState(
    initialOrganizations.length === 0,
  );
  const filteredOrganizations = organizations.filter((organization) =>
    matchesPortalSearch(search, organization.name, organization.type),
  );
  if (!role || role === "teacher") {
    return (
      <PortalState
        icon="lock"
        title="Organizações ficam com a administração"
        description="Profissionais acessam somente as turmas ativas que foram atribuídas a eles."
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
      {actorCanCreate && (
        <details
          className={styles.creationDisclosure}
          open={creationOpen}
          onToggle={(event) => setCreationOpen(event.currentTarget.open)}
        >
          <summary>
            Nova organização <Icon name="plus" />
          </summary>
          <section className={styles.managementPanel}>
            <div>
              <h2>Nova organização</h2>
              <p>
                Cadastre a unidade e depois vincule seu administrador na página
                da organização.
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
        </details>
      )}
      {organizations.length > 0 && (
        <div className={styles.directoryToolbar}>
          <label className={styles.field}>
            <span>Buscar organização</span>
            <input
              className={styles.input}
              type="search"
              placeholder="Nome ou tipo da organização"
              value={search}
              onChange={(event) => setFilters({ q: event.target.value })}
            />
          </label>
          <span role="status">
            {filteredOrganizations.length} de {organizations.length}{" "}
            organizações
          </span>
          {search && (
            <button
              className={styles.buttonGhost}
              type="button"
              onClick={() => setFilters({ q: "" })}
            >
              Limpar busca
            </button>
          )}
        </div>
      )}
      {organizations.length === 0 ? (
        <PortalState
          headingLevel={2}
          icon="building"
          title="Nenhuma organização disponível"
          description="Crie a primeira organização ou confirme se o seu vínculo está ativo."
        />
      ) : filteredOrganizations.length === 0 ? (
        <PortalState
          headingLevel={2}
          icon="search"
          title="Nenhuma organização encontrada"
          description="Tente outro nome ou limpe a busca."
          actions={
            <button
              className={styles.buttonSecondary}
              type="button"
              onClick={() => setFilters({ q: "" })}
            >
              Limpar busca
            </button>
          }
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
          {filteredOrganizations.map((organization) => {
            const identity = (
              <span className={styles.tableIdentity}>
                <i className={styles.tableIdentityIcon}>
                  {initials(organization.name)}
                </i>
                <span>
                  <strong>{organization.name}</strong>
                  <small>Estrutura institucional</small>
                </span>
              </span>
            );
            return (
              <div
                className={`${styles.tableRow} ${styles.organizationTableRow}`}
                key={organization.id}
              >
                <Link
                  className={styles.tableIdentity}
                  href={`/portal/admin/organizacoes/${organization.id}`}
                >
                  {identity}
                </Link>
                <span data-label="Tipo">{organization.type}</span>
                <StatusBadge status={recordStatusLabel(organization.status)} />
                <span data-label="Turmas">{organization.classCount}</span>
                <span data-label="Equipe">{organization.memberCount}</span>
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
                ) : (
                  <Link
                    className={styles.iconButton}
                    href={`/portal/admin/organizacoes/${organization.id}`}
                    aria-label={`Abrir ${organization.name}`}
                  >
                    <Icon name="chevron" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
