import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import styles from "@/components/portal/portal.module.css";
import { ShareActions } from "@/components/portal/share-actions";
import { Icon } from "@/components/shared/icon";
import { isAuthDevBypassEnabled } from "@/server/config/env";
import { getAuthGateway } from "@/server/auth/gateway";
import { getPublicBaseUrl } from "@/server/http/base-url";
import { HttpError } from "@/server/http/errors";
import { logger } from "@/server/observability/logger";
import type { AccessLinkRecord } from "@/server/services/access-link-service";
import { getDevBypassAccessLink } from "@/server/services/portal-view-service";

export const metadata = { title: "Compartilhar link" };

export const dynamic = "force-dynamic";

export default async function ShareActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getAuthGateway().getSession();
  if (!session) redirect("/entrar");

  let dbLink: AccessLinkRecord;
  if (isAuthDevBypassEnabled()) {
    const fixtureLink = getDevBypassAccessLink(id);
    if (!fixtureLink) notFound();
    dbLink = fixtureLink;
  } else {
    try {
      const { getAccessLinkService } =
        await import("@/server/services/service-container");
      dbLink = await getAccessLinkService().getAccessLink(session.actor, id);
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.status === 404 || error.code === "RESOURCE_NOT_FOUND") {
          notFound();
        }
        if (error.status === 403 || error.code === "FORBIDDEN") {
          redirect("/portal/sem-acesso");
        }
      }
      logger.error(
        {
          err: error,
          correlationId: (await headers()).get("x-correlation-id"),
        },
        "failed to load access link for share page",
      );
      return (
        <div className={styles.shareLayout}>
          <article className={styles.successPanel} aria-live="polite">
            <span className={styles.successMark}>
              <Icon name="shield" />
            </span>
            <h1>Não foi possível carregar este link agora.</h1>
            <p>
              Tente novamente em alguns instantes. Se o problema persistir, fale
              com o suporte da escola.
            </p>
            <div className={styles.stateActions}>
              <Link className={styles.buttonGhost} href="/portal/atividades">
                Voltar para atividades
              </Link>
            </div>
          </article>
        </div>
      );
    }
  }

  const baseUrl = await getPublicBaseUrl();
  const url = `${baseUrl}/atividade/${dbLink.id}`;
  const warning =
    "O token deste link é exibido apenas uma vez por segurança e não está na URL atual. Copie o link com o token logo após a criação ou rotacione o link para gerar um novo token compartilhável.";

  return (
    <div className={styles.shareLayout}>
      <article className={styles.successPanel}>
        <span className={styles.successMark}>
          <Icon name="check" />
        </span>
        <h1>{dbLink.label} — token não disponível nesta visualização.</h1>
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
          <span>
            URL exibida acima é um exemplo (ID). O acesso real usa o token de 43
            caracteres: /atividade/&lt;token&gt;.
          </span>
        </div>
      </aside>
    </div>
  );
}
