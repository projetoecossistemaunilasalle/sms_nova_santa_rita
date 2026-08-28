"use client";

import Link from "next/link";
import { useState } from "react";

import type { ClassGroupSummary } from "@/server/services/portal-view-service";
import { Icon } from "@/components/shared/icon";

import { StatusBadge } from "./status-badge";
import styles from "./portal.module.css";

export function ClassGroupsExplorer({
  classGroups,
}: {
  classGroups: ClassGroupSummary[];
}) {
  const [school, setSchool] = useState("Todas");
  const [schoolYear, setSchoolYear] = useState("2026");
  const [shift, setShift] = useState("Todos");
  const [status, setStatus] = useState("Ativa");
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");

  const schools = [
    ...new Set(classGroups.map((classGroup) => classGroup.organization)),
  ];
  const visibleClassGroups = classGroups.filter(
    (classGroup) =>
      (school === "Todas" || classGroup.organization === school) &&
      (schoolYear === "Todos" ||
        String(classGroup.schoolYear) === schoolYear) &&
      (shift === "Todos" || classGroup.shift === shift) &&
      (status === "Todos" || classGroup.status === status),
  );

  function createDemoClassGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(false);
    setNotice(
      "Turma preparada apenas nesta demonstração. Nada foi gravado no servidor.",
    );
    window.setTimeout(() => setNotice(""), 3600);
  }

  return (
    <>
      <div className={`${styles.toolbar} ${styles.classToolbar}`}>
        <div className={styles.filterGroup}>
          <select
            className={styles.select}
            aria-label="Filtrar por escola"
            value={school}
            onChange={(event) => setSchool(event.target.value)}
          >
            <option>Todas</option>
            {schools.map((schoolName) => (
              <option key={schoolName}>{schoolName}</option>
            ))}
          </select>
          <select
            className={styles.select}
            aria-label="Filtrar por ano letivo"
            value={schoolYear}
            onChange={(event) => setSchoolYear(event.target.value)}
          >
            <option>Todos</option>
            <option>2026</option>
            <option>2025</option>
          </select>
          <select
            className={styles.select}
            aria-label="Filtrar por turno"
            value={shift}
            onChange={(event) => setShift(event.target.value)}
          >
            <option>Todos</option>
            <option>Manhã</option>
            <option>Tarde</option>
          </select>
          <select
            className={styles.select}
            aria-label="Filtrar por estado"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option>Todos</option>
            <option>Ativa</option>
            <option>Inativa</option>
          </select>
        </div>
        <div className={styles.classToolbarActions}>
          <span className={styles.resultCount}>
            {visibleClassGroups.length} turmas
          </span>
          <button
            className={styles.button}
            type="button"
            onClick={() => setCreating(true)}
          >
            <Icon name="plus" /> Nova turma
          </button>
        </div>
      </div>

      {visibleClassGroups.length > 0 ? (
        <div className={styles.classGroupGrid}>
          {visibleClassGroups.map((classGroup) => (
            <Link
              className={styles.classGroupCard}
              href={`/portal/turmas/${classGroup.id}`}
              key={classGroup.id}
            >
              <span className={styles.classGroupTopline}>
                <i className={styles.classGroupMark}>
                  <Icon name="school" />
                </i>
                <StatusBadge status={classGroup.status} />
              </span>
              <h2>{classGroup.name}</h2>
              <p>{classGroup.organization}</p>
              <dl className={styles.classGroupFacts}>
                <div>
                  <dt>Ano/série</dt>
                  <dd>{classGroup.grade}</dd>
                </div>
                <div>
                  <dt>Turno</dt>
                  <dd>{classGroup.shift}</dd>
                </div>
                <div>
                  <dt>Ano letivo</dt>
                  <dd>{classGroup.schoolYear}</dd>
                </div>
              </dl>
              <div className={styles.classGroupMetrics}>
                <span>
                  <strong>{classGroup.activeLinks}</strong> links ativos
                </span>
                <span>
                  <strong>{classGroup.sessions}</strong> sessões
                </span>
              </div>
              <span className={styles.cardFooterLink}>
                Abrir turma <Icon name="arrow" />
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <section className={styles.compactEmptyState}>
          <Icon name="filter" />
          <h2>Nenhuma turma neste recorte</h2>
          <p>Altere os filtros para consultar outras turmas.</p>
        </section>
      )}

      {creating && (
        <div
          className={styles.previewBackdrop}
          role="presentation"
          onMouseDown={() => setCreating(false)}
        >
          <form
            className={styles.demoFormDialog}
            onSubmit={createDemoClassGroup}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className={styles.previewClose}
              type="button"
              onClick={() => setCreating(false)}
              aria-label="Fechar"
            >
              <Icon name="close" />
            </button>
            <p className={styles.eyebrow}>Nova turma</p>
            <h2>Organize um novo grupo</h2>
            <p>
              Sem cadastro de estudantes. Use apenas informações coletivas da
              turma.
            </p>
            <label className={styles.field}>
              <span>Nome da turma</span>
              <input
                className={styles.input}
                required
                placeholder="Ex.: 4º C"
              />
            </label>
            <label className={styles.field}>
              <span>Escola</span>
              <select className={styles.select}>
                {schools.map((schoolName) => (
                  <option key={schoolName}>{schoolName}</option>
                ))}
              </select>
            </label>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Ano/série</span>
                <input
                  className={styles.input}
                  required
                  placeholder="Ex.: 4º ano"
                />
              </label>
              <label className={styles.field}>
                <span>Turno</span>
                <select className={styles.select}>
                  <option>Manhã</option>
                  <option>Tarde</option>
                </select>
              </label>
            </div>
            <div className={styles.demoDialogActions}>
              <button
                className={styles.buttonGhost}
                type="button"
                onClick={() => setCreating(false)}
              >
                Cancelar
              </button>
              <button className={styles.button} type="submit">
                Preparar turma
              </button>
            </div>
          </form>
        </div>
      )}
      {notice && (
        <div className={styles.toast} role="status">
          <Icon name="check" /> {notice}
        </div>
      )}
    </>
  );
}
