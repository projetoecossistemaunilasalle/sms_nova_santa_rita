"use client";

import { useState } from "react";
import { Icon } from "@/components/shared/icon";
import type {
  AdultRole,
  OrganizationSummaryDto,
  ProfessionalOptionDto,
  TeamMemberDto,
} from "@/application/adult-portal/types";
import type { RuntimeMode } from "@/runtime/mode";
import { OrganizationRole, RecordStatus } from "@/generated/prisma/enums";
import {
  assignOrganizationAdministratorAction,
  assignTeacherMembershipAction,
  changeMembershipAction,
} from "@/runtime/actions";

import { AdultPortalForm } from "./adult-portal-form";
import {
  initials,
  matchesPortalSearch,
  recordStatusLabel,
  roleLabel,
} from "./adult-portal-helpers";
import { PageHeader } from "./page-header";
import { PortalState } from "./portal-state";
import { StatusBadge } from "./status-badge";
import { usePortalFilters } from "./use-portal-filters";
import styles from "./portal.module.css";
import teamStyles from "./team-screen.module.css";

export function TeamScreen({
  initialMembers,
  initialOrganizations,
  profiles,
  initialRole,
  runtimeMode,
}: {
  initialMembers: TeamMemberDto[];
  initialOrganizations: OrganizationSummaryDto[];
  profiles: ProfessionalOptionDto[];
  initialRole: AdultRole;
  runtimeMode: RuntimeMode;
}) {
  const role = initialRole;
  const members = initialMembers;
  const organizations = initialOrganizations;
  const availableProfiles = profiles;
  const { params, setFilters } = usePortalFilters();
  const search = params.get("q") ?? "";
  const status = params.get("status") ?? "all";
  const organizationId = params.get("organization") ?? "";
  const [creationOpen, setCreationOpen] = useState(
    members.length === 0 || params.get("new") === "1",
  );
  const activeOrganizations = organizations.filter(
    (organization) => organization.status === RecordStatus.ACTIVE,
  );
  const filteredMembers = members.filter(
    (member) =>
      (!organizationId || member.organizationId === organizationId) &&
      (status === "all" || member.status === status) &&
      matchesPortalSearch(
        search,
        member.displayName,
        member.organizationName,
        roleLabel(member.role),
      ),
  );

  if (!role || role === "teacher") {
    return (
      <PortalState
        icon="lock"
        title="A gestão da equipe não faz parte do seu acesso"
        description={
          role
            ? "Seu perfil de professor permanece focado nas turmas atribuídas."
            : "O perfil ou a organização selecionada não está ativo."
        }
      />
    );
  }

  const membershipAction =
    role === "platform_admin"
      ? assignOrganizationAdministratorAction
      : assignTeacherMembershipAction;
  return (
    <>
      <PageHeader
        eyebrow="Acessos adultos"
        title="Equipe"
        description={
          role === "platform_admin"
            ? "Vincule administradores às organizações sem duplicar credenciais do provedor de autenticação."
            : "Gerencie professores somente dentro das organizações sob sua responsabilidade."
        }
      />
      <details
        id="adicionar-equipe"
        className={styles.creationDisclosure}
        open={creationOpen}
        onToggle={(event) => setCreationOpen(event.currentTarget.open)}
      >
        <summary>
          Adicionar à equipe <Icon name="plus" />
        </summary>
        {runtimeMode === "demo" && (
          <p className={teamStyles.demoAccountNotice}>
            Os perfis de exemplo já estão provisionados na sessão local.
            Vincule-os usando as mesmas operações do portal; nenhuma conta real
            será criada.
          </p>
        )}
        <details className={teamStyles.serverProvisioningGuide}>
          <summary>O profissional não aparece na lista?</summary>
          <p>
            A criação da identidade e das credenciais é feita pelo Neon Auth;
            este portal ainda não envia convites. Depois que o perfil
            profissional correspondente for provisionado, ele aparecerá na lista
            abaixo para receber um vínculo.
          </p>
          <ol>
            <li>
              <strong>1. Criar a identidade</strong>
              Peça ao responsável pelo Neon Auth para cadastrar o profissional.
            </li>
            <li>
              <strong>2. Provisionar o perfil</strong>
              Peça ao responsável pelo portal para vincular a identidade a um
              perfil profissional.
            </li>
            <li>
              <strong>3. Conceder acesso</strong>
              Quando o perfil ativo aparecer abaixo, escolha a organização e
              crie o vínculo.
            </li>
          </ol>
        </details>
        <section className={styles.managementPanel}>
          <div>
            <h2>
              {role === "platform_admin"
                ? "Vincular perfil existente"
                : "Vincular professor existente"}
            </h2>
            <p>
              {role === "platform_admin"
                ? "Use esta opção para alguém cujo perfil profissional já está disponível. Um vínculo existente pode ser promovido sem duplicá-lo."
                : "Escolha um perfil profissional já provisionado para conceder acesso à organização."}
            </p>
          </div>
          <AdultPortalForm
            action={membershipAction}
            submitLabel="Criar vínculo"
            className={teamStyles.existingMemberForm}
            submitButtonClassName={teamStyles.membershipSubmit}
          >
            <label className={styles.field}>
              <span>Profissional</span>
              <select
                className={styles.select}
                name="profileId"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Selecione um perfil
                </option>
                {availableProfiles
                  .filter((profile) => profile.status === RecordStatus.ACTIVE)
                  .map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.displayName}
                    </option>
                  ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Organização</span>
              <select
                className={styles.select}
                name="organizationId"
                required
                defaultValue={
                  activeOrganizations.some((item) => item.id === organizationId)
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
      <section className={teamStyles.teamSummary} aria-label="Resumo da equipe">
        <article>
          <p>Vínculos</p>
          <strong>{members.length}</strong>
        </article>
        <article>
          <p>Ativos</p>
          <strong>
            {
              members.filter((member) => member.status === RecordStatus.ACTIVE)
                .length
            }
          </strong>
        </article>
        <article>
          <p>Organizações</p>
          <strong>
            {new Set(members.map((member) => member.organizationId)).size}
          </strong>
        </article>
      </section>
      {members.length > 0 && (
        <div className={styles.directoryToolbar}>
          <label className={styles.field}>
            <span>Buscar profissional, perfil ou organização</span>
            <input
              className={styles.input}
              type="search"
              value={search}
              onChange={(event) => setFilters({ q: event.target.value })}
              placeholder="Ex.: Carla Freitas"
            />
          </label>
          <label className={styles.field}>
            <span>Organização do vínculo</span>
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
          <label className={styles.field}>
            <span>Situação do vínculo</span>
            <select
              className={styles.select}
              value={status}
              onChange={(event) => setFilters({ status: event.target.value })}
            >
              <option value="all">Todos</option>
              <option value={RecordStatus.ACTIVE}>Ativos</option>
              <option value={RecordStatus.INACTIVE}>Inativos</option>
            </select>
          </label>
          <span role="status">
            {filteredMembers.length} de {members.length} vínculos
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
      {members.length === 0 ? (
        <PortalState
          headingLevel={2}
          icon="users"
          title="Nenhuma pessoa vinculada"
          description="Vincule um perfil profissional ativo para começar a liberar acessos neste escopo."
        />
      ) : filteredMembers.length === 0 ? (
        <PortalState
          headingLevel={2}
          icon="search"
          title="Nenhum vínculo encontrado"
          description="Tente outro nome ou limpe os filtros para ver toda a equipe."
          actions={
            <button
              type="button"
              className={styles.buttonSecondary}
              onClick={() => {
                setFilters({ q: "", status: "", organization: "" });
              }}
            >
              Limpar filtros
            </button>
          }
        />
      ) : (
        <div className={styles.adminTable}>
          <div className={teamStyles.memberHeader} aria-hidden="true">
            <span>Profissional</span>
            <span>Perfil</span>
            <span>Estado</span>
            <span>Ação</span>
          </div>
          {filteredMembers.map((member) => {
            const canManage =
              role === "platform_admin" ||
              (role === "organization_admin" &&
                member.role === OrganizationRole.TEACHER);
            return (
              <div
                className={teamStyles.memberRow}
                key={member.id}
                role="group"
                aria-label={`${member.displayName}, ${member.organizationName}`}
              >
                <span className={styles.tableIdentity}>
                  <i className={styles.personAvatar}>
                    {initials(member.displayName)}
                  </i>
                  <span>
                    <strong>{member.displayName}</strong>
                    <small>{member.organizationName}</small>
                  </span>
                </span>
                <span className={teamStyles.memberRole}>
                  {roleLabel(member.role)}
                </span>
                <StatusBadge status={recordStatusLabel(member.status)} />
                {canManage ? (
                  <div className={styles.membershipActions}>
                    {role === "platform_admin" && (
                      <AdultPortalForm
                        action={changeMembershipAction}
                        submitLabel={
                          member.role === OrganizationRole.TEACHER
                            ? "Promover"
                            : "Tornar professor"
                        }
                        compact
                        confirmation={{
                          title:
                            member.role === OrganizationRole.TEACHER
                              ? "Promover a administrador?"
                              : "Tornar professor?",
                          description:
                            member.role === OrganizationRole.TEACHER
                              ? `${member.displayName} poderá gerenciar a equipe e as turmas de ${member.organizationName}.`
                              : `${member.displayName} deixará de gerenciar ${member.organizationName} e terá acesso somente às turmas que lhe forem atribuídas.`,
                        }}
                      >
                        <input
                          type="hidden"
                          name="membershipId"
                          value={member.id}
                        />
                        <input
                          type="hidden"
                          name="role"
                          value={
                            member.role === OrganizationRole.TEACHER
                              ? OrganizationRole.ORGANIZATION_ADMIN
                              : OrganizationRole.TEACHER
                          }
                        />
                        <input
                          type="hidden"
                          name="status"
                          value={member.status}
                        />
                      </AdultPortalForm>
                    )}
                    <AdultPortalForm
                      action={changeMembershipAction}
                      submitLabel={
                        member.status === RecordStatus.ACTIVE
                          ? "Desativar"
                          : "Ativar"
                      }
                      compact
                      confirmation={
                        member.status === RecordStatus.ACTIVE
                          ? {
                              title: "Desativar vínculo?",
                              description: `${member.displayName} perderá o acesso por este vínculo com ${member.organizationName}. Os registros serão mantidos e o vínculo poderá ser reativado.`,
                            }
                          : undefined
                      }
                    >
                      <input
                        type="hidden"
                        name="membershipId"
                        value={member.id}
                      />
                      <input type="hidden" name="role" value={member.role} />
                      <input
                        type="hidden"
                        name="status"
                        value={
                          member.status === RecordStatus.ACTIVE
                            ? RecordStatus.INACTIVE
                            : RecordStatus.ACTIVE
                        }
                      />
                    </AdultPortalForm>
                  </div>
                ) : (
                  <span className={styles.mutedCell}>Somente leitura</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
