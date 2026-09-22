"use client";

import Link from "next/link";

import type { ClassDetailDto } from "@/application/adult-portal/types";
import type { ClassWorkflowDto } from "@/application/player-access/types";
import type { RuntimeMode } from "@/runtime/mode";
import { RecordStatus } from "@/generated/prisma/enums";
import {
  assignTeacherToClassAction,
  changeClassStatusAction,
  deactivateTeacherAssignmentAction,
} from "@runtime/adult-portal-actions";
import { AdultPortalForm } from "./adult-portal-form";
import { demoClassDetail, recordStatusLabel } from "./adult-portal-helpers";
import {
  PlayerAccessWorkflow,
  workflowFromDemoState,
} from "./player-access-workflow";
import { PortalState } from "./portal-state";
import { StatusBadge } from "./status-badge";
import { useDemoPortalState } from "./use-demo-portal";
import styles from "./portal.module.css";

export function ClassDetailScreen({
  initialClass,
  initialWorkflow,
  runtimeMode,
}: {
  initialClass: ClassDetailDto;
  initialWorkflow: ClassWorkflowDto;
  runtimeMode: RuntimeMode;
}) {
  const demo = useDemoPortalState();
  const classGroup = demo
    ? demoClassDetail(demo, initialClass.id)
    : initialClass;
  if (!classGroup) {
    return (
      <PortalState
        icon="lock"
        title="Esta turma não está disponível"
        description="Turmas inativas, sem atribuição ativa ou fora da sua organização não concedem acesso."
      />
    );
  }
  const assignedMembershipIds = new Set(
    classGroup.teachers
      .filter((teacher) => teacher.status === RecordStatus.ACTIVE)
      .map((teacher) => teacher.membershipId),
  );
  const assignableTeachers = classGroup.availableTeachers.filter(
    (teacher) => !assignedMembershipIds.has(teacher.id),
  );
  const workflow = workflowFromDemoState(demo, classGroup.id, initialWorkflow);

  return (
    <>
      <section className={styles.classDetailHero}>
        <div>
          <Link className={styles.backLink} href="/portal/turmas">
            ← Todas as turmas
          </Link>
          <p className={styles.eyebrow}>Turma</p>
          <h1>{classGroup.name}</h1>
          <p>{classGroup.organizationName}</p>
          <StatusBadge status={recordStatusLabel(classGroup.status)} />
        </div>
        {classGroup.canManage && (
          <AdultPortalForm
            action={changeClassStatusAction}
            submitLabel={
              classGroup.status === RecordStatus.ACTIVE
                ? "Desativar turma"
                : "Ativar turma"
            }
            compact
          >
            <input type="hidden" name="classGroupId" value={classGroup.id} />
            <input
              type="hidden"
              name="status"
              value={
                classGroup.status === RecordStatus.ACTIVE
                  ? RecordStatus.INACTIVE
                  : RecordStatus.ACTIVE
              }
            />
          </AdultPortalForm>
        )}
      </section>
      {runtimeMode === "demo" && (
        <p className={styles.demoScopeNotice}>
          Demonstração local: jogadores, sessões e credenciais ficam somente
          neste navegador e não têm validade em produção.
        </p>
      )}
      {classGroup.status !== RecordStatus.ACTIVE && (
        <section className={styles.inactiveNotice}>
          <strong>Turma inativa</strong>
          <p>
            Professores não acessam esta turma enquanto ela estiver inativa.
          </p>
        </section>
      )}
      <PlayerAccessWorkflow
        classGroupId={classGroup.id}
        className={classGroup.name}
        disabled={classGroup.status !== RecordStatus.ACTIVE}
        organizationName={classGroup.organizationName}
        runtimeMode={runtimeMode}
        workflow={workflow}
      />
      <div className={styles.classManagementGrid}>
        <section className={styles.detailPanel}>
          <div className={styles.sectionHeader}>
            <h2>Professores atribuídos</h2>
            <span>
              {
                classGroup.teachers.filter(
                  (teacher) => teacher.status === RecordStatus.ACTIVE,
                ).length
              }{" "}
              ativos
            </span>
          </div>
          {classGroup.teachers.length === 0 ? (
            <p className={styles.inlineEmpty}>
              Nenhum professor atribuído a esta turma.
            </p>
          ) : (
            <div className={styles.assignmentList}>
              {classGroup.teachers.map((teacher) => (
                <article key={teacher.id}>
                  <span>
                    <strong>{teacher.displayName}</strong>
                    <small>
                      {teacher.status === RecordStatus.ACTIVE
                        ? "Atribuição ativa"
                        : "Atribuição inativa"}
                    </small>
                  </span>
                  <StatusBadge status={recordStatusLabel(teacher.status)} />
                  {classGroup.canManage &&
                    teacher.status === RecordStatus.ACTIVE && (
                      <AdultPortalForm
                        action={deactivateTeacherAssignmentAction}
                        submitLabel="Remover da turma"
                        compact
                      >
                        <input
                          type="hidden"
                          name="assignmentId"
                          value={teacher.id}
                        />
                      </AdultPortalForm>
                    )}
                </article>
              ))}
            </div>
          )}
        </section>
        {classGroup.canManage && (
          <section className={styles.detailPanel}>
            <div className={styles.sectionHeader}>
              <h2>Atribuir professor</h2>
            </div>
            {classGroup.status !== RecordStatus.ACTIVE ? (
              <p className={styles.inlineWarning}>
                Ative a turma antes de criar uma atribuição.
              </p>
            ) : assignableTeachers.length === 0 ? (
              <p className={styles.inlineEmpty}>
                Não há outro professor ativo disponível nesta organização.
              </p>
            ) : (
              <AdultPortalForm
                action={assignTeacherToClassAction}
                submitLabel="Atribuir professor"
              >
                <input
                  type="hidden"
                  name="classGroupId"
                  value={classGroup.id}
                />
                <label className={styles.field}>
                  <span>Professor ativo</span>
                  <select
                    className={styles.select}
                    name="membershipId"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Selecione um professor
                    </option>
                    {assignableTeachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.displayName}
                      </option>
                    ))}
                  </select>
                </label>
              </AdultPortalForm>
            )}
          </section>
        )}
      </div>
    </>
  );
}
