import Link from "next/link";

import { ActivityMark } from "@/components/portal/activity-mark";
import { PageHeader } from "@/components/portal/page-header";
import styles from "@/components/portal/portal.module.css";
import { StatusBadge } from "@/components/portal/status-badge";
import { Icon } from "@/components/shared/icon";
import { getDashboardData } from "@/server/services/portal-view-service";

export default function PortalDashboard() {
  const { featured, links, weeklyParticipation, activeLinkCount } =
    getDashboardData();

  return (
    <>
      <PageHeader
        eyebrow="Visão geral"
        title="Missões do Caramelito"
        description="Gerencie links de acesso, acompanhe sessões e leia resultados agregados da experiência GameMaker."
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
          <p>Sessões totais</p>
          <strong>168</strong>
          <small>Nos links publicados</small>
        </article>
        <article className={styles.summaryCard}>
          <p>Conclusão média</p>
          <strong>81%</strong>
          <small>Leitura coletiva</small>
        </article>
        <article className={styles.summaryCard}>
          <p>Jogo conectado</p>
          <strong>1</strong>
          <small>Experiência GameMaker</small>
        </article>
      </section>

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
