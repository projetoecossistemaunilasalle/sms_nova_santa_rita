"use client";

import Link from "next/link";

import type { ClassDetailDto } from "@/application/adult-portal/types";
import type { ClassWorkflowDto } from "@/application/player-access/types";
import type { RuntimeMode } from "@/runtime/mode";
import type { ClassContentPageData } from "@/runtime/readers";
import { RecordStatus } from "@/generated/prisma/enums";
import {
  assignTeacherToClassAction,
  changeClassStatusAction,
  deactivateTeacherAssignmentAction,
  setClassDefaultContentAction,
} from "@/runtime/actions";
import { ContentPicker } from "./content-picker";
import { getContentSelectionSummary } from "./content-selection-model";
import { AdultPortalForm } from "./adult-portal-form";
import { recordStatusLabel } from "./adult-portal-helpers";
import { PlayerAccessWorkflow } from "./player-access-workflow";
import { StatusBadge } from "./status-badge";
import { Icon } from "@/components/shared/icon";
import styles from "./portal.module.css";

function ClassDefaultContent({
  classGroupId,
  content,
  readOnly,
}: {
  classGroupId: string;
  content: ClassContentPageData | null;
  readOnly: boolean;
}) {
  const manifest = content?.manifest ?? null;
  const summary = getContentSelectionSummary(
    manifest,
    content?.defaultSelection ?? null,
  );
  return (
    <details className={styles.classDefaultContent} id="conteudo-padrao">
      <summary>
        <span>
          <strong>Conteúdo padrão</strong>
          <small>{summary}</small>
        </span>
        <span className={styles.classDefaultContentAction}>
          {readOnly ? "Ver conteúdo" : "Alterar"}
        </span>
      </summary>
      <div className={styles.classDefaultContentBody}>
        {manifest ? (
          <>
            <p className={styles.fieldHelp}>
              {readOnly
                ? "Somente quem opera a turma pode alterar o conteúdo padrão."
                : "Usado quando você inicia uma sessão sem escolher o conteúdo."}
            </p>
            <ContentPicker
              manifest={manifest}
              classGroupId={classGroupId}
              initialSelection={content?.defaultSelection ?? null}
              action={setClassDefaultContentAction}
              submitLabel="Salvar padrão"
              pendingLabel="Salvando…"
              showSaveAsDefault={false}
              readOnly={readOnly}
            />
          </>
        ) : (
          <p className={styles.inlineEmpty}>
            Nenhuma versão do jogo disponível. Peça a um administrador da
            plataforma para importar o conteúdo.
          </p>
        )}
      </div>
    </details>
  );
}

export function ClassDetailScreen({
  initialClass,
  initialContent,
  initialWorkflow,
  runtimeMode,
}: {
  initialClass: ClassDetailDto;
  initialContent: ClassContentPageData | null;
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
            <a className={styles.textLink} href="#profissionais">
              Gerenciar profissionais
            </a>
          )}
        </div>
      </section>
      {classGroup.status !== RecordStatus.ACTIVE && (
        <section className={styles.inactiveNotice}>
          <strong>Turma inativa</strong>
          <p>
            Profissionais não acessam esta turma enquanto ela estiver inativa.
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
        content={initialContent}
        disabled={classGroup.status !== RecordStatus.ACTIVE}
        organizationName={classGroup.organizationName}
        runtimeMode={runtimeMode}
        workflow={workflow}
      />
      <ClassDefaultContent
        classGroupId={classGroup.id}
        content={initialContent}
        // The server action only accepts users who can operate an active
        // class (org admin or assigned professional); everyone else, and
        // inactive classes, get the read-only view.
        readOnly={classGroup.status !== RecordStatus.ACTIVE}
      />
      <div className={styles.classManagementGrid} id="profissionais">
        <section className={styles.detailPanel}>
          <div className={styles.sectionHeader}>
            <h2>Profissionais atribuídos</h2>
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
              Nenhum profissional atribuído a esta turma.
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
                            "Este profissional perderá o acesso a esta turma. Você poderá atribuí-lo novamente depois.",
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
              <h2>Atribuir profissional</h2>
            </div>
            {classGroup.status !== RecordStatus.ACTIVE ? (
              <p className={styles.inlineWarning}>
                Ative a turma antes de criar uma atribuição.
              </p>
            ) : assignableTeachers.length === 0 ? (
              <p className={styles.inlineEmpty}>
                Não há outro profissional ativo disponível nesta organização.{" "}
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
                submitLabel="Atribuir profissional"
              >
                <input
                  type="hidden"
                  name="classGroupId"
                  value={classGroup.id}
                />
                <label className={styles.field}>
                  <span>Profissional ativo</span>
                  <select
                    className={styles.select}
                    name="membershipId"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Selecione um profissional
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
              Desativar impede o acesso dos profissionais. Os registros são
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
                      "Os profissionais perderão o acesso a esta turma e os jogadores não poderão iniciar novas entradas. Os registros serão preservados. Você poderá ativá-la novamente.",
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
