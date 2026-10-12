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
} from "@/runtime/actions";
import { AdultPortalForm } from "./adult-portal-form";
import { recordStatusLabel } from "./adult-portal-helpers";
import { PlayerAccessWorkflow } from "./player-access-workflow";
import { StatusBadge } from "./status-badge";
import { Icon } from "@/components/shared/icon";
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
  const classGroup = initialClass;
  const assignedMembershipIds = new Set(
    classGroup.teachers
      .filter((teacher) => teacher.status === RecordStatus.ACTIVE)
      .map((teacher) => teacher.membershipId),
  );
  const assignableTeachers = classGroup.availableTeachers.filter(
    (teacher) => !assignedMembershipIds.has(teacher.id),
  );
  const workflow = initialWorkflow;

  return (
    <>
      <section className={styles.classDetailHero}>
        <div>
          <Link className={styles.backLink} href="/portal/turmas">
            ← Todas as turmas
          </Link>
          <div className={styles.classIdentity}>
            <h1>{classGroup.name}</h1>
            <StatusBadge status={recordStatusLabel(classGroup.status)} />
          </div>
          <p>{classGroup.organizationName}</p>
        </div>
        <div className={styles.classActions}>
          <Link
            className={styles.buttonSecondary}
            href={`/portal/resultados/${classGroup.id}`}
          >
            <Icon name="chart" /> Ver resultados da turma
          </Link>
          {classGroup.canManage && (
            <a className={styles.textLink} href="#professores">
              Gerenciar professores
            </a>
          )}
        </div>
      </section>
      {classGroup.status !== RecordStatus.ACTIVE && (
        <section className={styles.inactiveNotice}>
          <strong>Turma inativa</strong>
          <p>
            Professores não acessam esta turma enquanto ela estiver inativa.
          </p>
          {classGroup.canManage && (
            <a className={styles.textLink} href="#situacao-turma">
              Ir para ativação da turma
            </a>
          )}
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
      <div className={styles.classManagementGrid} id="professores">
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
                        confirmation={{
                          title: `Remover ${teacher.displayName}?`,
                          description:
                            "Este professor perderá o acesso a esta turma. Você poderá atribuí-lo novamente depois.",
                        }}
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
                Não há outro professor ativo disponível nesta organização.{" "}
                <Link
                  className={styles.textLink}
                  href={{
                    pathname: "/portal/admin/equipe",
                    query: { organization: classGroup.organizationId },
                  }}
                >
                  Gerenciar equipe
                </Link>
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
      {classGroup.canManage && (
        <section className={styles.classSettings} id="situacao-turma">
          <div>
            <h2>Situação da turma</h2>
            <p>
              Desativar impede o acesso dos professores. Os registros são
              mantidos.
            </p>
          </div>
          <AdultPortalForm
            action={changeClassStatusAction}
            submitLabel={
              classGroup.status === RecordStatus.ACTIVE
                ? "Desativar turma"
                : "Ativar turma"
            }
            compact
            confirmation={
              classGroup.status === RecordStatus.ACTIVE
                ? {
                    title: `Desativar a turma ${classGroup.name}?`,
                    description:
                      "Os professores perderão o acesso a esta turma e os jogadores não poderão iniciar novas entradas. Os registros serão preservados. Você poderá ativá-la novamente.",
                  }
                : undefined
            }
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
        </section>
      )}
    </>
  );
}
