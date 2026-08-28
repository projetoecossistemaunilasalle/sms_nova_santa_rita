import { notFound } from "next/navigation";

import { PageHeader } from "@/components/portal/page-header";
import styles from "@/components/portal/portal.module.css";
import { StatusBadge } from "@/components/portal/status-badge";
import { Icon } from "@/components/shared/icon";
import { resolveLinkStatus } from "@/server/services/link-status";
import {
  getDevBypassAccessLink,
  listAccessLinks,
} from "@/server/services/portal-view-service";

export const metadata = { title: "Resultados" };

export function generateStaticParams() {
  return listAccessLinks().map((link) => ({
    id: link.id,
  }));
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const fixtureLink = getDevBypassAccessLink(id);

  if (!fixtureLink) {
    notFound();
  }

  const linkLabel = fixtureLink.label;
  const linkStatus = resolveLinkStatus(fixtureLink);

  const metrics =
    id === "turma-5b"
      ? { sessions: 42, completed: 32, completion: 76, classGroup: "5º B" }
      : {
          sessions: 126,
          completed: 103,
          completion: 82,
          classGroup: "Todas as turmas",
        };

  return (
    <>
      <PageHeader
        eyebrow="Resultados agregados"
        title="Missões do Caramelito"
        description={`Sessões do ${linkLabel}, sem histórico ou identificação individual.`}
        actions={
          <select
            className={styles.select}
            aria-label="Período"
            defaultValue="all"
          >
            <option value="all">Todo o período</option>
            <option value="7">Últimos 7 dias</option>
          </select>
        }
      />
      <section
        className={styles.resultContext}
        aria-label="Contexto dos resultados"
      >
        <span>
          <small>Escola</small>
          <strong>EMEF Victor Aggens</strong>
        </span>
        <span>
          <small>Turma</small>
          <strong>{metrics.classGroup}</strong>
        </span>
        <span>
          <small>Link</small>
          <strong>{linkLabel}</strong>
        </span>
        <span>
          <small>Período</small>
          <strong>Todo o período</strong>
        </span>
        <em>Demonstração visual</em>
      </section>
      <section className={styles.statsGrid} aria-label="Indicadores principais">
        <article className={styles.statCard}>
          <p>Sessões iniciadas</p>
          <strong>{metrics.sessions}</strong>
          <small>Participações coletivas</small>
        </article>
        <article className={styles.statCard}>
          <p>Sessões concluídas</p>
          <strong>{metrics.completed}</strong>
          <small>{metrics.completion}% de conclusão</small>
        </article>
        <article className={styles.statCard}>
          <p>Conclusão média</p>
          <strong>{metrics.completion}%</strong>
          <small>Leitura coletiva do link</small>
        </article>
      </section>
      <div className={styles.reportGrid}>
        <article className={styles.reportPanel}>
          <div className={styles.reportPanelHeader}>
            <div>
              <h2>Sessões por dia</h2>
              <p>Participações iniciadas neste link</p>
            </div>
            <StatusBadge status={linkStatus} />
          </div>
          <div
            className={styles.barChart}
            aria-label="Sessões demonstrativas por dia"
          >
            {[
              ["Seg", 45],
              ["Ter", 68],
              ["Qua", 52],
              ["Qui", 82],
              ["Sex", 64],
            ].map(([day, width]) => (
              <div className={styles.barRow} key={day}>
                <span>{day}</span>
                <div className={styles.barTrack}>
                  <i
                    className={styles.barFill}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <strong>{Math.round(Number(width) / 5)}</strong>
              </div>
            ))}
          </div>
        </article>
        <aside className={styles.reportPanel}>
          <h2>Conclusão da experiência</h2>
          <p className={styles.sampleNote}>
            Sessões que chegaram ao final do jogo.
          </p>
          <div
            className={styles.completionRing}
            style={{
              background: `conic-gradient(var(--green) 0 ${metrics.completion}%, var(--green-light) ${metrics.completion}% 100%)`,
            }}
          >
            <strong>{metrics.completion}%</strong>
          </div>
          <div className={styles.legend}>
            <span>
              <i />
              Concluídas
            </span>
            <span>
              <i />
              Em andamento
            </span>
          </div>
          <div className={styles.contextNotice} style={{ marginTop: 22 }}>
            <Icon name="shield" />
            <span>Leitura coletiva. Sem identificação individual.</span>
          </div>
        </aside>
      </div>
    </>
  );
}
