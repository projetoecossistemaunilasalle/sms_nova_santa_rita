import Link from "next/link";

import { ActivityMark } from "@/components/portal/activity-mark";
import { PageHeader } from "@/components/portal/page-header";
import styles from "@/components/portal/portal.module.css";
import { StatusBadge } from "@/components/portal/status-badge";
import { Icon } from "@/components/shared/icon";
import { listAccessLinks } from "@/server/services/portal-view-service";

export const metadata = { title: "Links de acesso" };

export default function ActivitiesPage() {
  const links = listAccessLinks();
  const openCount = links.filter((link) => link.status === "Aberta").length;
  const sessionCount = links.reduce((total, link) => total + link.sessions, 0);

  return (
    <>
      <PageHeader
        eyebrow="Links de acesso"
        title="Envie a atividade para cada turma."
        description="Cada link abre a experiência GameMaker diretamente. O portal fica para compartilhar acessos e acompanhar sessões."
        actions={
          <Link className={styles.button} href="/portal/atividades/nova">
            <Icon name="link" /> Novo link
          </Link>
        }
      />

      <section className={styles.summaryStrip} aria-label="Resumo de links">
        <article className={styles.summaryCard}>
          <p>Links totais</p>
          <strong>{links.length}</strong>
        </article>
        <article className={styles.summaryCard}>
          <p>Ativos</p>
          <strong>{openCount}</strong>
        </article>
        <article className={styles.summaryCard}>
          <p>Sessões</p>
          <strong>{sessionCount}</strong>
        </article>
        <article className={styles.summaryCard}>
          <p>Jogo conectado</p>
          <strong>1</strong>
        </article>
      </section>

      <div className={styles.toolbar}>
        <label className={styles.searchField}>
          <span
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              overflow: "hidden",
            }}
          >
            Buscar links
          </span>
          <Icon name="search" />
          <input type="search" placeholder="Buscar por turma ou link" />
        </label>
        <div className={styles.filterGroup}>
          <select
            className={styles.select}
            aria-label="Filtrar por status do link"
            defaultValue="todos"
          >
            <option value="todos">Todos os links</option>
            <option value="aberta">Ativos</option>
            <option value="pausada">Pausados</option>
            <option value="encerrada">Encerrados</option>
          </select>
        </div>
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
              <small>{link.lastUsed}</small>
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
