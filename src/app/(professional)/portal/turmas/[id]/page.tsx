import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityMark } from "@/components/portal/activity-mark";
import { DemoActionButton } from "@/components/portal/demo-action-button";
import styles from "@/components/portal/portal.module.css";
import { StatusBadge } from "@/components/portal/status-badge";
import { Icon } from "@/components/shared/icon";
import {
  getClassGroup,
  listAccessLinks,
  listClassGroups,
} from "@/server/services/portal-view-service";

export const metadata = { title: "Detalhe da turma" };

export function generateStaticParams() {
  return listClassGroups().map((group) => ({
    id: group.id,
  }));
}

export default async function ClassGroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const classGroup = getClassGroup(id);
  if (!classGroup) notFound();
  const links = listAccessLinks().filter((link) =>
    classGroup.linkIds.includes(link.id),
  );

  return (
    <>
      <section className={styles.classDetailHero}>
        <div>
          <Link className={styles.backLink} href="/portal/turmas">
            ← Todas as turmas
          </Link>
          <p className={styles.eyebrow}>Turma · {classGroup.schoolYear}</p>
          <h1>{classGroup.name}</h1>
          <p>
            {classGroup.organization} · {classGroup.grade} · {classGroup.shift}
          </p>
          <StatusBadge status={classGroup.status} />
        </div>
        <div className={styles.pageActions}>
          <DemoActionButton
            className={styles.buttonSecondary}
            message="Edição aberta apenas para a demonstração. Nenhuma alteração foi gravada."
          >
            <Icon name="edit" /> Editar turma
          </DemoActionButton>
          <Link className={styles.button} href="/portal/atividades/nova">
            <Icon name="link" /> Criar link para esta turma
          </Link>
        </div>
      </section>

      <section className={styles.classSummaryBand} aria-label="Resumo da turma">
        <article>
          <span>Sessões agregadas</span>
          <strong>{classGroup.sessions}</strong>
          <small>Sem identificação individual</small>
        </article>
        <article>
          <span>Conclusão média</span>
          <strong>{classGroup.completion}%</strong>
          <small>Nos links desta turma</small>
        </article>
        <article>
          <span>Links ativos</span>
          <strong>{classGroup.activeLinks}</strong>
          <small>Prontos para compartilhar</small>
        </article>
        <article>
          <span>Atividade recente</span>
          <strong className={styles.summaryTextValue}>
            {classGroup.lastActivity}
          </strong>
          <small>Último uso de link</small>
        </article>
      </section>

      <div className={styles.classDetailGrid}>
        <section>
          <div className={styles.sectionHeader}>
            <h2>Links de acesso</h2>
            <Link className={styles.textLink} href="/portal/atividades">
              Ver todos
            </Link>
          </div>
          <div className={styles.activityList}>
            {links.map((link) => (
              <Link
                className={`${styles.activityRow} ${styles.compactActivityRow}`}
                href={`/portal/atividades/${link.id}`}
                key={link.id}
              >
                <span className={styles.activityIdentity}>
                  <ActivityMark symbol={link.symbol} tone={link.tone} />
                  <span>
                    <strong>{link.label}</strong>
                    <small>{link.expires}</small>
                  </span>
                </span>
                <StatusBadge status={link.status} />
                <span className={styles.activityMetric}>
                  <strong>{link.sessions}</strong>
                  <small>sessões</small>
                </span>
                <span className={styles.iconButton} aria-hidden="true">
                  <Icon name="chevron" />
                </span>
              </Link>
            ))}
          </div>
        </section>
        <aside>
          <div className={styles.sectionHeader}>
            <h2>Resultados recentes</h2>
          </div>
          <article className={styles.recentResultsCard}>
            <span className={styles.resultPulse}>
              <Icon name="chart" />
            </span>
            <div>
              <strong>{classGroup.sessions} sessões</strong>
              <p>Leitura coletiva dos links da turma.</p>
            </div>
            <div className={styles.progressTrack}>
              <span style={{ width: `${classGroup.completion}%` }} />
            </div>
            <p className={styles.progressLabel}>
              <span>Conclusão média</span>
              <strong>{classGroup.completion}%</strong>
            </p>
            <Link
              className={styles.buttonSecondary}
              href={`/portal/atividades/${links[0]?.id ?? "habitos-saudaveis"}/resultados`}
            >
              Abrir resultados <Icon name="arrow" />
            </Link>
          </article>
        </aside>
      </div>
    </>
  );
}
