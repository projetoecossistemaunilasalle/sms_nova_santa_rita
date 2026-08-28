import Link from "next/link";

import { ActivityMark } from "@/components/portal/activity-mark";
import { PageHeader } from "@/components/portal/page-header";
import styles from "@/components/portal/portal.module.css";
import { StatusBadge } from "@/components/portal/status-badge";
import { Icon } from "@/components/shared/icon";
import {
  getDashboardData,
  listClassGroups,
  listMaterials,
} from "@/server/services/portal-view-service";

export default function PortalDashboard() {
  const { featured, links, weeklyParticipation, activeLinkCount } =
    getDashboardData();
  const classGroups = listClassGroups();
  const materials = listMaterials();
  const recentClassGroups = classGroups.slice(0, 3);
  const recentMaterials = materials.slice(0, 3);

  return (
    <>
      <PageHeader
        eyebrow="Visão geral"
        title="Missões do Caramelito"
        description="Acompanhe turmas, links, materiais e resultados coletivos em uma única visão."
        actions={
          <div className={styles.dashboardShortcuts}>
            <Link className={styles.buttonGhost} href="/portal/turmas">
              <Icon name="school" /> Nova turma
            </Link>
            <Link className={styles.buttonGhost} href="/portal/atividades/nova">
              <Icon name="link" /> Novo link
            </Link>
            <Link className={styles.button} href="/portal/materiais/novo">
              <Icon name="book" /> Novo material
            </Link>
          </div>
        }
      />

      <section className={styles.dashboardGrid} aria-label="Resumo do portal">
        <article className={styles.featureCard}>
          <span className={styles.featureDots} aria-hidden="true" />
          <div className={styles.featureContent}>
            <StatusBadge status={featured.status} />
            <h2>Uma experiência. Links para cada turma.</h2>
            <p>
              O jogo fica fora do portal. Crie um link personalizado para cada
              grupo e acompanhe apenas os dados coletivos da participação.
            </p>
            <div className={styles.featureActions}>
              <Link
                className={`${styles.button} ${styles.buttonSmall}`}
                href="/portal/atividades"
              >
                Gerenciar links <Icon name="arrow" />
              </Link>
              <Link
                className={`${styles.buttonSecondary} ${styles.buttonSmall}`}
                href={`/portal/atividades/${featured.id}/resultados`}
              >
                Ver resultados
              </Link>
            </div>
          </div>
        </article>

        <aside className={styles.weeklyCard}>
          <p className={styles.eyebrow}>Nesta semana</p>
          <div className={styles.weeklyNumber}>
            {weeklyParticipation} <span>sessões</span>
          </div>
          <p className={styles.weeklyCaption}>
            Participações anônimas em links ativos
          </p>
          <div className={styles.miniBars} aria-hidden="true">
            {[32, 47, 41, 72, 61, 90, 76].map((height) => (
              <span key={height} style={{ height: `${height}%` }} />
            ))}
          </div>
        </aside>
      </section>

      <section className={styles.summaryStrip} aria-label="Indicadores">
        <article className={styles.summaryCard}>
          <p>Links ativos</p>
          <strong>{activeLinkCount}</strong>
          <small>Por turma ou grupo</small>
        </article>
        <article className={styles.summaryCard}>
          <p>Turmas ativas</p>
          <strong>
            {classGroups.filter((classGroup) => classGroup.status === "Ativa")
              .length || "—"}
          </strong>
          <small>Grupos acompanhados</small>
        </article>
        <article className={styles.summaryCard}>
          <p>Sessões no período</p>
          <strong>168</strong>
          <small>Nos links publicados</small>
        </article>
        <article className={styles.summaryCard}>
          <p>Conclusão média</p>
          <strong>81%</strong>
          <small>Leitura coletiva</small>
        </article>
        <article className={styles.summaryCard}>
          <p>Materiais publicados</p>
          <strong>
            {materials.filter((material) => material.status === "Publicado")
              .length || "—"}
          </strong>
          <small>Conteúdos de apoio</small>
        </article>
      </section>

      {recentClassGroups.length > 0 && (
        <div className={styles.dashboardContextGrid}>
          <section>
            <div className={styles.sectionHeader}>
              <h2>Turmas com atividade recente</h2>
              <Link className={styles.textLink} href="/portal/turmas">
                Ver turmas
              </Link>
            </div>
            <div className={styles.dashboardCompactList}>
              {recentClassGroups.map((classGroup) => (
                <Link
                  href={`/portal/turmas/${classGroup.id}`}
                  key={classGroup.id}
                >
                  <span className={styles.directoryIcon}>
                    <Icon name="school" />
                  </span>
                  <span>
                    <strong>{classGroup.name}</strong>
                    <small>{classGroup.organization}</small>
                  </span>
                  <span>
                    <strong>{classGroup.sessions}</strong>
                    <small>sessões</small>
                  </span>
                  <Icon name="chevron" />
                </Link>
              ))}
            </div>
          </section>
          <section>
            <div className={styles.sectionHeader}>
              <h2>Materiais recentes</h2>
              <Link className={styles.textLink} href="/portal/materiais">
                Ver materiais
              </Link>
            </div>
            <div className={styles.dashboardCompactList}>
              {recentMaterials.map((material) => (
                <Link
                  href={`/portal/materiais/${material.id}/editar`}
                  key={material.id}
                >
                  <span className={styles.directoryIcon}>
                    <Icon name="book" />
                  </span>
                  <span>
                    <strong>{material.title}</strong>
                    <small>
                      {material.type} · {material.audience}
                    </small>
                  </span>
                  <StatusBadge status={material.status} />
                  <Icon name="chevron" />
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}

      <div className={styles.sectionHeader}>
        <h2>Links de acesso recentes</h2>
        <Link className={styles.textLink} href="/portal/atividades">
          Ver links
        </Link>
      </div>
      <div className={styles.activityList}>
        {links.map((link) => (
          <Link
            className={styles.activityRow}
            href={`/portal/atividades/${link.id}`}
            key={link.id}
          >
            <span className={styles.activityIdentity}>
              <ActivityMark symbol={link.symbol} tone={link.tone} />
              <span>
                <strong>{link.label}</strong>
                <small>{link.audience}</small>
              </span>
            </span>
            <StatusBadge status={link.status} />
            <span className={styles.activityMetric}>
              <strong>{link.sessions}</strong>
              <small>sessões</small>
            </span>
            <span className={styles.activityMetric}>
              <strong>{link.completion}%</strong>
              <small>conclusão</small>
            </span>
            <span className={styles.iconButton} aria-hidden="true">
              <Icon name="chevron" />
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
