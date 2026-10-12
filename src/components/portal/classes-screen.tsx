"use client";

import Link from "next/link";
import { useState } from "react";

import type {
  AdultRole,
  ClassSummaryDto,
  OrganizationSummaryDto,
} from "@/application/adult-portal/types";
import type { RuntimeMode } from "@/runtime/mode";
import { RecordStatus } from "@/generated/prisma/enums";
import { createClassAction } from "@/runtime/actions";
import { Icon } from "@/components/shared/icon";

import { AdultPortalForm } from "./adult-portal-form";
import { matchesPortalSearch, recordStatusLabel } from "./adult-portal-helpers";
import { PageHeader } from "./page-header";
import { PortalState } from "./portal-state";
import { StatusBadge } from "./status-badge";
import { usePortalFilters } from "./use-portal-filters";
import styles from "./portal.module.css";

export function ClassesScreen({
  initialClasses,
  initialOrganizations,
  initialRole,
}: {
  initialClasses: ClassSummaryDto[];
  initialOrganizations: OrganizationSummaryDto[];
  initialRole: AdultRole;
  runtimeMode: RuntimeMode;
}) {
  const role = initialRole;
  const classes = initialClasses;
  const organizations = initialOrganizations;
  const { params, setFilters } = usePortalFilters();
  const search = params.get("q") ?? "";
  const status = params.get("status") ?? "all";
  const organizationId = params.get("organization") ?? "";
  const [creationOpen, setCreationOpen] = useState(initialClasses.length === 0);
  const activeOrganizations = organizations.filter(
    (organization) => organization.status === RecordStatus.ACTIVE,
  );
  const filteredClasses = classes.filter(
    (classGroup) =>
      (!organizationId || classGroup.organizationId === organizationId) &&
      (status === "all" || classGroup.status === status) &&
      matchesPortalSearch(search, classGroup.name, classGroup.organizationName),
  );

  if (!role) {
    return (
      <PortalState
        icon="lock"
        title="Este perfil não possui acesso ativo"
        description="Peça ao administrador para verificar seu vínculo profissional."
      />
    );
  }

  if (role === "platform_admin") {
    return (
      <PortalState
        icon="lock"
        title="Turmas são gerenciadas pelas organizações"
        description="Como administrador da plataforma, use a área de organizações para preparar os administradores responsáveis."
      />
    );
  }

  const canCreate = role === "organization_admin";
  return (
    <>
      <PageHeader
        eyebrow="Estrutura de sala"
        title="Turmas"
        description={
          canCreate
            ? "Crie turmas e defina quais professores ativos podem acessá-las."
            : "Escolha uma turma para preparar os cartões QR e iniciar uma sessão."
        }
      />
      {canCreate && (
        <details
          className={styles.creationDisclosure}
          open={creationOpen}
          onToggle={(event) => setCreationOpen(event.currentTarget.open)}
        >
          <summary>
            Nova turma <Icon name="plus" />
          </summary>
          <section className={styles.managementPanel}>
            <div>
              <h2>Nova turma</h2>
              <p>
                Crie a turma e abra seus detalhes para atribuir um professor e
                preparar os cartões dos jogadores.
              </p>
            </div>
            <AdultPortalForm
              action={createClassAction}
              submitLabel="Criar turma"
            >
              <label className={styles.field}>
                <span>Nome da turma</span>
                <input
                  className={styles.input}
                  name="name"
                  required
                  maxLength={160}
                  placeholder="Ex.: 4º B"
                />
              </label>
              <label className={styles.field}>
                <span>Organização</span>
                <select
                  className={styles.select}
                  name="organizationId"
                  required
                  defaultValue={
                    activeOrganizations.some(
                      (item) => item.id === organizationId,
                    )
                      ? organizationId
                      : activeOrganizations.length === 1
                        ? activeOrganizations[0]!.id
                        : ""
                  }
                >
                  <option value="" disabled>
                    Selecione uma organização
                  </option>
                  {organizations
                    .filter(
                      (organization) =>
                        organization.status === RecordStatus.ACTIVE,
                    )
                    .map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                      </option>
                    ))}
                </select>
              </label>
            </AdultPortalForm>
          </section>
        </details>
      )}
      {classes.length > 0 && (
        <div className={styles.directoryToolbar}>
          <label className={styles.field}>
            <span>Buscar turma ou organização</span>
            <input
              className={styles.input}
              type="search"
              value={search}
              onChange={(event) => setFilters({ q: event.target.value })}
              placeholder="Ex.: 3º A"
            />
          </label>
          {canCreate && (
            <label className={styles.field}>
              <span>Organização da turma</span>
              <select
                className={styles.select}
                value={organizationId}
                onChange={(event) =>
                  setFilters({ organization: event.target.value })
                }
              >
                <option value="">Todas as organizações</option>
                {organizations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
                {organizationId &&
                  !organizations.some((item) => item.id === organizationId) && (
                    <option value={organizationId}>
                      Organização indisponível
                    </option>
                  )}
              </select>
            </label>
          )}
          {canCreate && (
            <label className={styles.field}>
              <span>Situação</span>
              <select
                className={styles.select}
                value={status}
                onChange={(event) => setFilters({ status: event.target.value })}
              >
                <option value="all">Todas</option>
                <option value={RecordStatus.ACTIVE}>Ativas</option>
                <option value={RecordStatus.INACTIVE}>Inativas</option>
              </select>
            </label>
          )}
          <span role="status">
            {filteredClasses.length} de {classes.length} turmas
          </span>
          {(search || status !== "all" || organizationId) && (
            <button
              className={styles.buttonGhost}
              type="button"
              onClick={() =>
                setFilters({ q: "", status: "", organization: "" })
              }
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}
      {classes.length === 0 ? (
        <PortalState
          headingLevel={2}
          icon="school"
          title={canCreate ? "Nenhuma turma criada" : "Nenhuma turma atribuída"}
          description={
            canCreate
              ? "Crie a primeira turma em uma organização ativa."
              : "Peça ao administrador da organização para atribuir uma turma ativa ao seu vínculo."
          }
        />
      ) : filteredClasses.length === 0 ? (
        <PortalState
          headingLevel={2}
          icon="search"
          title="Nenhuma turma encontrada"
          description="Tente outro nome ou limpe os filtros para ver todas as turmas."
          actions={
            <button
              className={styles.buttonSecondary}
              type="button"
              onClick={() => {
                setFilters({ q: "", status: "", organization: "" });
              }}
            >
              Limpar filtros
            </button>
          }
        />
      ) : (
        <div className={styles.classGroupGrid}>
          {filteredClasses.map((classGroup) => {
            const content = (
              <>
                <span className={styles.classGroupTopline}>
                  <i className={styles.classGroupMark}>
                    <Icon name="school" />
                  </i>
                  <StatusBadge status={recordStatusLabel(classGroup.status)} />
                </span>
                <h2>{classGroup.name}</h2>
                <p>{classGroup.organizationName}</p>
                <dl className={styles.classGroupFacts}>
                  <div>
                    <dt>Professores ativos</dt>
                    <dd>{classGroup.teacherCount}</dd>
                  </div>
                  {classGroup.teacherCount === 0 && canCreate && (
                    <div>
                      <dt>Próximo passo</dt>
                      <dd>Atribuir professor</dd>
                    </div>
                  )}
                </dl>
                <span className={styles.cardFooterLink}>
                  Abrir turma
                  <Icon name="arrow" />
                </span>
              </>
            );
            return (
              <Link
                className={styles.classGroupCard}
                href={`/portal/turmas/${classGroup.id}`}
                key={classGroup.id}
              >
                {content}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
