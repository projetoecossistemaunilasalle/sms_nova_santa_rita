import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/portal/portal.module.css";
import { ShareActions } from "@/components/portal/share-actions";
import { Icon } from "@/components/shared/icon";
import {
  getDevBypassAccessLink,
  listAccessLinks,
} from "@/server/services/portal-view-service";

export const metadata = { title: "Compartilhar link" };

export function generateStaticParams() {
  return listAccessLinks().map((link) => ({
    id: link.id,
  }));
}

export default async function ShareActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dbLink = getDevBypassAccessLink(id);

  if (!dbLink) {
    notFound();
  }

  const url = `https://niciniv.github.io/SMS_Portal/atividade/${dbLink.id}`;
  const warning =
    "O token deste link é exibido apenas uma vez por segurança e não está na URL atual. Copie o link com o token logo após a criação ou rotacione o link para gerar um novo token compartilhável.";

  return (
    <div className={styles.shareLayout}>
      <article className={styles.successPanel}>
        <span className={styles.successMark}>
          <Icon name="check" />
        </span>
        <h1>{dbLink.label} — demonstração de compartilhamento.</h1>
        <p>
          Este link abre Missões do Caramelito diretamente no jogo. As sessões
          são anônimas e os resultados ficam agregados por acesso.
        </p>
        <div
          className={styles.contextNotice}
          style={{
            marginTop: 12,
            background: "var(--warning-bg, #fff8e1)",
            border: "1px solid #ffe082",
          }}
        >
          <Icon name="shield" />
          <span>{warning}</span>
        </div>
        <div className={styles.stateActions}>
          <Link
            className={styles.buttonGhost}
            href={`/portal/atividades/${id}`}
          >
            Ver link
          </Link>
          <Link
            className={styles.buttonSecondary}
            href={`/portal/atividades/${id}/resultados`}
          >
            Acompanhar resultados
          </Link>
        </div>
      </article>

      <aside className={styles.shareCard}>
        <h2>Compartilhar com a turma</h2>
        <p>Use o QR code em sala ou envie o link pelos canais da escola.</p>
        <ShareActions url={url} />
        <div className={styles.contextNotice} style={{ marginTop: 14 }}>
          <Icon name="shield" />
          <span>O acesso não solicita conta ou identificação do aluno.</span>
        </div>
        <div className={styles.contextNotice} style={{ marginTop: 8 }}>
          <Icon name="history" />
          <span>URL de demonstração pronta para exibição no visual mock.</span>
        </div>
      </aside>
    </div>
  );
}
