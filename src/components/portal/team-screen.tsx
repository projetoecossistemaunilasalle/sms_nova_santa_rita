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
  createDemoProfessionalAction,
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
  const demo = useDemoPortalState();
  const role = demo ? demoRole(demo) : initialRole;
  const members = demo ? demoTeam(demo) : initialMembers;
  const organizations = demo ? demoOrganizations(demo) : initialOrganizations;
  const availableProfiles = demo
    ? demo.profiles.map(({ id, displayName, status, email }) => ({
        id,
        displayName,
        status,
        email,
      }))
    : profiles.map((profile) => ({ ...profile, email: undefined }));

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

  const demoCreationRole =
    role === "platform_admin"
      ? OrganizationRole.ORGANIZATION_ADMIN
      : OrganizationRole.TEACHER;
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
      {runtimeMode === "demo" && (
        <p className={teamStyles.demoAccountNotice}>
          Perfis criados na demonstração ficam neste navegador. Use um e-mail
          fictício: nenhuma conta real, senha ou mensagem será criada.
        </p>
      )}
      {runtimeMode === "server" && (
        <section className={teamStyles.serverProvisioningGuide}>
          <div>
            <h2>Como adicionar alguém à equipe</h2>
          </div>
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
        </section>
      )}
      {runtimeMode === "demo" && (
        <section
          className={`${styles.managementPanel} ${teamStyles.demoCreationPanel}`}
        >
          <div>
            <h2>Criar perfil de demonstração</h2>
            <p>
              Simule a inclusão de uma pessoa na equipe. O perfil e o vínculo
              existem apenas nos dados locais desta demonstração.
            </p>
          </div>
          <AdultPortalForm
            action={createDemoProfessionalAction}
            submitLabel="Adicionar ao demo"
            className={teamStyles.demoProfileForm}
          >
            <label className={styles.field}>
              <span>Nome</span>
              <input
                className={styles.input}
                name="displayName"
                autoComplete="off"
                maxLength={160}
                required
              />
            </label>
            <label className={styles.field}>
              <span>E-mail fictício</span>
              <input
                className={styles.input}
                name="email"
                type="email"
                autoComplete="off"
                placeholder="ana.demo@example.test"
                maxLength={254}
                required
              />
              <small className={styles.fieldHelp}>
                Use um endereço .test. É apenas um identificador local e não
                será enviado.
              </small>
            </label>
            <input type="hidden" name="role" value={demoCreationRole} />
            <label className={styles.field}>
              <span>Permissão na organização</span>
              <input
                className={styles.input}
                value={
                  demoCreationRole === OrganizationRole.ORGANIZATION_ADMIN
                    ? "Administrador da organização"
                    : "Professor"
                }
                readOnly
              />
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
      )}
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
                    {profile.email
                      ? `${profile.displayName} · ${profile.email}`
                      : profile.displayName}
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
          title="Nenhuma pessoa vinculada"
          description={
            runtimeMode === "demo"
              ? "Crie um perfil demonstrativo acima ou vincule alguém que já esteja na lista."
              : "Vincule um perfil profissional ativo para começar a liberar acessos neste escopo."
          }
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
                    <small>
                      {runtimeMode === "demo"
                        ? (demo?.profiles.find(
                            (profile) => profile.id === member.profileId,
                          )?.email ?? "Perfil fictício de demonstração")
                        : "Perfil profissional provisionado"}
                    </small>
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
