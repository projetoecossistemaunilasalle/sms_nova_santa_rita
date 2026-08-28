import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityControls } from "@/components/portal/activity-controls";
import styles from "@/components/portal/portal.module.css";
import { StatusBadge } from "@/components/portal/status-badge";
import { Icon } from "@/components/shared/icon";
import {
  getDevBypassAccessLink,
  listAccessLinks,
} from "@/server/services/portal-view-service";
import { resolveLinkStatus } from "@/server/services/link-status";

export const metadata = { title: "Detalhes do link" };

export function generateStaticParams() {
  return listAccessLinks().map((link) => ({
    id: link.id,
  }));
}

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dbLink = getDevBypassAccessLink(id);

  if (!dbLink) {
    notFound();
  }

  const link = {
    id: dbLink.id,
    label: dbLink.label,
    audience: dbLink.audience,
    status: resolveLinkStatus(dbLink),
    created: new Date(dbLink.createdAt).toLocaleDateString("pt-BR"),
    lastUsed: new Date(dbLink.updatedAt).toLocaleDateString("pt-BR"),
    expires: dbLink.expiresAt
      ? new Date(dbLink.expiresAt).toLocaleDateString("pt-BR")
      : "Sem expiração",
    url: `https://niciniv.github.io/SMS_Portal/atividade/${dbLink.id}`,
  };

  return (
    <>
      <article className={styles.detailHero}>
        <div className={styles.detailHeroContent}>
          <StatusBadge status={link.status} />
          <h1>{link.label}</h1>
          <p>Missões do Caramelito · {link.audience}</p>
        </div>
        <div className={styles.detailHeroActions}>
          <Link
            className={styles.buttonSecondary}
            href={`/portal/atividades/${link.id}/resultados`}
          >
            <Icon name="chart" /> Resultados
          </Link>
          <Link
            className={styles.button}
            href={`/portal/atividades/${link.id}/compartilhar`}
          >
            <Icon name="link" /> Compartilhar
          </Link>
        </div>
      </article>

      <div className={styles.detailGrid}>
        <section className={styles.detailPanel}>
          <div className={styles.sectionHeader} style={{ marginTop: 0 }}>
            <h2>Resumo do acesso</h2>
            <Link
              className={styles.textLink}
              href={`/portal/atividades/${link.id}/editar`}
            >
              Editar link
            </Link>
          </div>
          <div className={styles.detailRows}>
            <div className={styles.detailRow}>
              <span>Experiência</span>
              <strong>Missões do Caramelito</strong>
            </div>
            <div className={styles.detailRow}>
              <span>Turma ou grupo</span>
              <strong>{link.audience}</strong>
            </div>
            <div className={styles.detailRow}>
              <span>Criado em</span>
              <strong>{link.created}</strong>
            </div>
            <div className={styles.detailRow}>
              <span>Último acesso</span>
              <strong>{link.lastUsed}</strong>
            </div>
            <div className={styles.detailRow}>
              <span>Expiração</span>
              <strong>{link.expires}</strong>
            </div>
          </div>
          <div className={styles.sectionHeader}>
            <h2>Sessões deste link</h2>
            <span className={styles.muted}>0 no total</span>
          </div>
          <div className={styles.summaryList}>
            <div className={styles.summaryLine}>
              <span>Sessões iniciadas</span>
              <strong>0</strong>
            </div>
            <div className={styles.summaryLine}>
              <span>Conclusão média</span>
              <strong>0%</strong>
            </div>
            <div className={styles.summaryLine}>
              <span>Destino</span>
              <strong>Jogo GameMaker</strong>
            </div>
          </div>
        </section>

        <aside className={styles.detailPanel}>
          <h2>Status do link</h2>
          <div className={styles.summaryList}>
            <ActivityControls initialStatus={link.status} linkId={link.id} />
            <div className={styles.summaryLine}>
              <span>Acesso</span>
              <strong>Personalizado</strong>
            </div>
            <div className={styles.summaryLine}>
              <span>Expiração</span>
              <strong>{link.expires}</strong>
            </div>
            <div className={styles.summaryLine}>
              <span>Jogo</span>
              <strong>Conectado</strong>
            </div>
          </div>
          <div className={styles.linkCard}>
            <code>{link.url}</code>
            <div className={styles.linkMeta}>
              <span>Link de acesso</span>
              <span>{link.expires.toLowerCase()}</span>
            </div>
          </div>
          <div className={styles.contextNotice} style={{ marginTop: 15 }}>
            <Icon name="history" />
            <span>
              Pausar, encerrar ou rotacionar este link mantém os resultados
              agregados e registra a mudança na auditoria.
            </span>
          </div>
        </aside>
      </div>
    </>
  );
}
