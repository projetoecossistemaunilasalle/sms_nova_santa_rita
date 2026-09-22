"use client";

import Link from "next/link";

import type {
  AdultRole,
  ClassSummaryDto,
  OrganizationSummaryDto,
} from "@/application/adult-portal/types";
import type { RuntimeMode } from "@/runtime/mode";
import { RecordStatus } from "@/generated/prisma/enums";
import { createClassAction } from "@runtime/adult-portal-actions";
import { Icon } from "@/components/shared/icon";

import { AdultPortalForm } from "./adult-portal-form";
import {
  demoClasses,
  demoOrganizations,
  demoRole,
  recordStatusLabel,
} from "./adult-portal-helpers";
import { PageHeader } from "./page-header";
import { PortalState } from "./portal-state";
import { StatusBadge } from "./status-badge";
import { useDemoPortalState } from "./use-demo-portal";
import styles from "./portal.module.css";

export function ClassesScreen({
  initialClasses,
  initialOrganizations,
  initialRole,
  runtimeMode,
}: {
  initialClasses: ClassSummaryDto[];
  initialOrganizations: OrganizationSummaryDto[];
  initialRole: AdultRole;
  runtimeMode: RuntimeMode;
}) {
  const demo = useDemoPortalState();
  const role = demo ? demoRole(demo) : initialRole;
  const classes = demo ? demoClasses(demo) : initialClasses;
  const organizations = demo ? demoOrganizations(demo) : initialOrganizations;

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
            : "Acesse somente as turmas ativas atribuídas ao seu vínculo de professor."
        }
      />
      {runtimeMode === "demo" && (
        <p className={styles.demoScopeNotice}>
          Turmas demo persistem somente neste navegador.
        </p>
      )}
      {canCreate && (
        <section className={styles.managementPanel}>
          <div>
            <h2>Nova turma</h2>
            <p>
              O acesso numerado de jogadores será configurado em um próximo
              slice.
            </p>
          </div>
          <AdultPortalForm action={createClassAction} submitLabel="Criar turma">
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
      {classes.length === 0 ? (
        <PortalState
          icon="school"
          title={canCreate ? "Nenhuma turma criada" : "Nenhuma turma atribuída"}
          description={
            canCreate
              ? "Crie a primeira turma em uma organização ativa."
              : "Peça ao administrador da organização para atribuir uma turma ativa ao seu vínculo."
          }
        />
      ) : (
        <div className={styles.classGroupGrid}>
          {classes.map((classGroup) => {
            const generatedInBrowser = classGroup.id.startsWith("demo-class-");
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
                  <div>
                    <dt>Escopo</dt>
                    <dd>Organização</dd>
                  </div>
                </dl>
                <span className={styles.cardFooterLink}>
                  {generatedInBrowser
                    ? "Criada neste navegador"
                    : "Abrir turma"}
                  {!generatedInBrowser && <Icon name="arrow" />}
                </span>
              </>
            );
            return generatedInBrowser ? (
              <article className={styles.classGroupCard} key={classGroup.id}>
                {content}
              </article>
            ) : (
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
