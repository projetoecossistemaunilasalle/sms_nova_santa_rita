"use client";

import Link from "next/link";

import type { OrganizationDetailDto } from "@/application/adult-portal/types";
import type { RuntimeMode } from "@/runtime/mode";
import { OrganizationRole, RecordStatus } from "@/generated/prisma/enums";
import { changeOrganizationStatusAction } from "@runtime/adult-portal-actions";
import { Icon } from "@/components/shared/icon";

import { AdultPortalForm } from "./adult-portal-form";
import { DeactivateOrganizationControl } from "./deactivate-organization-control";
import {
  demoAccessibleOrganizationIds,
  demoRole,
  demoTeamForOrganization,
  initials,
  recordStatusLabel,
  roleLabel,
} from "./adult-portal-helpers";
import { PageHeader } from "./page-header";
import { PortalState } from "./portal-state";
import { StatusBadge } from "./status-badge";
import { useDemoPortalState } from "./use-demo-portal";
import styles from "./portal.module.css";

export function OrganizationDetailScreen({
  initialOrganization,
  runtimeMode,
}: {
  initialOrganization: OrganizationDetailDto;
  runtimeMode: RuntimeMode;
}) {
  const demo = useDemoPortalState();
  let organization = initialOrganization;
  let canManage = initialOrganization.canManage;

  if (demo) {
    const record = demo.organizations.find(
      (item) => item.id === initialOrganization.id,
    );
    const authorized =
      demoRole(demo) === "platform_admin" ||
      (demoRole(demo) === "organization_admin" &&
        demoAccessibleOrganizationIds(demo).includes(initialOrganization.id) &&
        record?.status === RecordStatus.ACTIVE);
    if (!record || !authorized) {
      return (
        <PortalState
          icon="lock"
          title="Esta organização não está no seu escopo"
          description="Use o seletor de perfil demo ou volte para uma área permitida."
        />
      );
    }
    const memberships = demoTeamForOrganization(demo, record.id);
    const classes = demo.classes
      .filter((item) => item.organizationId === record.id)
      .map((item) => ({
        ...item,
        organizationName: record.name,
        teacherCount: demo.assignments.filter(
          (assignment) =>
            assignment.classGroupId === item.id &&
            assignment.status === RecordStatus.ACTIVE,
        ).length,
      }));
    canManage = demoRole(demo) === "platform_admin";
    organization = {
      ...record,
      memberCount: memberships.length,
      classCount: classes.length,
      memberships,
      classes,
      canManage,
      canAssignAdministrator: canManage,
    };
  }

  return (
    <>
      <PageHeader
        eyebrow="Organização"
        title={organization.name}
        description={`${organization.type} · ${recordStatusLabel(organization.status)}`}
        actions={
          canManage ? (
            organization.status === RecordStatus.ACTIVE ? (
              <DeactivateOrganizationControl
                organizationId={organization.id}
                organizationName={organization.name}
              />
            ) : (
              <AdultPortalForm
                action={changeOrganizationStatusAction}
                submitLabel="Ativar organização"
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
          ) : undefined
        }
      />
      {runtimeMode === "demo" && (
        <p className={styles.demoScopeNotice}>
          Contexto de organização demonstrativo, persistido apenas neste
          navegador.
        </p>
      )}
      {organization.status !== RecordStatus.ACTIVE && (
        <section className={styles.inactiveNotice}>
          <strong>Organização inativa</strong>
          <p>
            Vínculos e turmas desta organização não concedem acesso enquanto ela
            estiver inativa.
          </p>
        </section>
      )}
      <section className={styles.organizationOverview}>
        <div className={styles.organizationSeal}>
          {initials(organization.name)}
        </div>
        <div>
          <StatusBadge status={recordStatusLabel(organization.status)} />
          <h2>Profissionais e turmas</h2>
          <p>Resumo da equipe vinculada e das turmas cadastradas.</p>
        </div>
        <dl>
          <div>
            <dt>Profissionais</dt>
            <dd>{organization.memberCount}</dd>
          </div>
          <div>
            <dt>Turmas</dt>
            <dd>{organization.classCount}</dd>
          </div>
          <div>
            <dt>Tipo</dt>
            <dd className={styles.summaryTextValue}>{organization.type}</dd>
          </div>
        </dl>
      </section>
      <div className={styles.organizationDetailGrid}>
        <section className={styles.detailPanel}>
          <div className={styles.sectionHeader}>
            <h2>Turmas</h2>
            <Link className={styles.textLink} href="/portal/turmas">
              Ver turmas
            </Link>
          </div>
          {organization.classes.length === 0 ? (
            <p className={styles.inlineEmpty}>
              Nenhuma turma criada nesta organização.
            </p>
          ) : (
            <div className={styles.compactDirectory}>
              {organization.classes.map((classGroup) => {
                const generated = classGroup.id.startsWith("demo-class-");
                const content = (
                  <>
                    <span className={styles.directoryIcon}>
                      <Icon name="school" />
                    </span>
                    <span>
                      <strong>{classGroup.name}</strong>
                      <small>
                        {classGroup.teacherCount} professor(es) ativo(s)
                      </small>
                    </span>
                    <StatusBadge
                      status={recordStatusLabel(classGroup.status)}
                    />
                    {!generated && <Icon name="chevron" />}
                  </>
                );
                return generated ? (
                  <article
                    className={styles.compactDirectoryRow}
                    key={classGroup.id}
                  >
                    {content}
                  </article>
                ) : (
                  <Link
                    href={`/portal/turmas/${classGroup.id}`}
                    key={classGroup.id}
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          )}
        </section>
        <section className={styles.detailPanel}>
          <div className={styles.sectionHeader}>
            <h2>Equipe vinculada</h2>
            <Link className={styles.textLink} href="/portal/admin/equipe">
              Gerenciar
            </Link>
          </div>
          {organization.memberships.length === 0 ? (
            <p className={styles.inlineEmpty}>Nenhum profissional vinculado.</p>
          ) : (
            <div className={styles.peopleStack}>
              {organization.memberships.map((member) => (
                <article key={member.id}>
                  <span className={styles.personAvatar}>
                    {initials(member.displayName)}
                  </span>
                  <span>
                    <strong>{member.displayName}</strong>
                    <small>{roleLabel(member.role)}</small>
                  </span>
                  <StatusBadge status={recordStatusLabel(member.status)} />
                </article>
              ))}
            </div>
          )}
          {!organization.memberships.some(
            (member) =>
              member.role === OrganizationRole.ORGANIZATION_ADMIN &&
              member.status === RecordStatus.ACTIVE,
          ) && (
            <p className={styles.inlineWarning}>
              Esta organização ainda não possui administrador ativo.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
