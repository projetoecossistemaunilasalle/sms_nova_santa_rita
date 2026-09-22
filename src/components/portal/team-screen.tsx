"use client";

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
} from "@runtime/adult-portal-actions";

import { AdultPortalForm } from "./adult-portal-form";
import {
  demoOrganizations,
  demoRole,
  demoTeam,
  initials,
  recordStatusLabel,
  roleLabel,
} from "./adult-portal-helpers";
import { PageHeader } from "./page-header";
import { PortalState } from "./portal-state";
import { StatusBadge } from "./status-badge";
import { useDemoPortalState } from "./use-demo-portal";
import styles from "./portal.module.css";

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
  const demo = useDemoPortalState();
  const role = demo ? demoRole(demo) : initialRole;
  const members = demo ? demoTeam(demo) : initialMembers;
  const organizations = demo ? demoOrganizations(demo) : initialOrganizations;
  const availableProfiles = demo
    ? demo.profiles.map(({ id, displayName, status }) => ({
        id,
        displayName,
        status,
      }))
    : profiles;

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
      <section className={styles.provisioningNotice}>
        <strong>O perfil precisa existir antes do vínculo.</strong>
        <p>
          O Neon Auth continua responsável por credenciais. Esta tela usa apenas
          perfis profissionais já provisionados e não cria senhas ou contas
          paralelas.
        </p>
      </section>
      {runtimeMode === "demo" && (
        <p className={styles.demoScopeNotice}>
          Vínculos demo persistem somente neste navegador.
        </p>
      )}
      <section className={styles.managementPanel}>
        <div>
          <h2>
            {role === "platform_admin"
              ? "Vincular ou promover administrador"
              : "Vincular professor"}
          </h2>
          <p>
            {role === "platform_admin"
              ? "Selecione um perfil provisionado e o escopo. Um professor já vinculado será promovido sem criar outro vínculo."
              : "Selecione um perfil provisionado e o escopo organizacional."}
          </p>
        </div>
        <AdultPortalForm action={membershipAction} submitLabel="Criar vínculo">
          <label className={styles.field}>
            <span>Perfil profissional</span>
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
              defaultValue=""
            >
              <option value="" disabled>
                Selecione uma organização
              </option>
              {organizations
                .filter(
                  (organization) => organization.status === RecordStatus.ACTIVE,
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
      <section className={styles.summaryStrip} aria-label="Resumo da equipe">
        <article className={styles.summaryCard}>
          <p>Vínculos</p>
          <strong>{members.length}</strong>
          <small>No escopo acessível</small>
        </article>
        <article className={styles.summaryCard}>
          <p>Ativos</p>
          <strong>
            {
              members.filter((member) => member.status === RecordStatus.ACTIVE)
                .length
            }
          </strong>
          <small>Com acesso vigente</small>
        </article>
        <article className={styles.summaryCard}>
          <p>Organizações</p>
          <strong>
            {new Set(members.map((member) => member.organizationId)).size}
          </strong>
          <small>Representadas na lista</small>
        </article>
      </section>
      {members.length === 0 ? (
        <PortalState
          icon="users"
          title="Nenhum vínculo profissional"
          description="Escolha um perfil já provisionado para criar o primeiro vínculo deste escopo."
        />
      ) : (
        <div className={`${styles.adminTable} ${styles.teamTable}`}>
          <div className={styles.tableHeader}>
            <span>Profissional</span>
            <span>Perfil</span>
            <span>Organização</span>
            <span>Estado</span>
            <span>Ação</span>
          </div>
          {members.map((member) => {
            const canManage =
              role === "platform_admin" ||
              (role === "organization_admin" &&
                member.role === OrganizationRole.TEACHER);
            return (
              <div className={styles.tableRow} key={member.id}>
                <span className={styles.tableIdentity}>
                  <i className={styles.personAvatar}>
                    {initials(member.displayName)}
                  </i>
                  <span>
                    <strong>{member.displayName}</strong>
                    <small>Perfil profissional provisionado</small>
                  </span>
                </span>
                <span>{roleLabel(member.role)}</span>
                <span>{member.organizationName}</span>
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
