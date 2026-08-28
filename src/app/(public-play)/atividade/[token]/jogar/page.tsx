import { PublicState } from "@/components/public/public-state";
import styles from "@/components/public/public.module.css";
import { Icon } from "@/components/shared/icon";
import {
  createGameLaunchUrl,
  resolveGameClientUrl,
} from "@/server/config/game-client";
import { PrismaAccessLinkStore } from "@/server/db/prisma-access-link-store";
import { resolvePublicLink } from "@/server/services/public-link-service";

export const dynamic = "force-dynamic";

export default async function GameLauncherPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Validate the opaque activity token before handing it to GameMaker.
  // Rejects malformed, missing, revoked, paused, or expired links without
  // exposing which check failed beyond the safe public state.
  const resolution = await resolvePublicLink(token, {
    store: new PrismaAccessLinkStore(),
    clock: { now: () => new Date() },
  });

  if (resolution.status === "invalid") {
    return (
      <PublicState
        icon="search"
        title="Não encontramos esta missão."
        description="Confira se o link foi aberto por inteiro ou peça um novo acesso ao profissional responsável."
      />
    );
  }

  if (resolution.status === "paused") {
    return (
      <PublicState
        icon="pause"
        title="Esta missão está pausada."
        description="O acesso foi pausado temporariamente pela escola. Volte a abrir este mesmo link mais tarde."
      />
    );
  }

  if (resolution.status === "expired") {
    return (
      <PublicState
        icon="clock"
        title="Este link expirou."
        description="A missão não aceita novos acessos por este link. Peça um novo QR code ou link ao profissional responsável."
      />
    );
  }

  if (resolution.status === "revoked") {
    return (
      <PublicState
        icon="link"
        title="Este link não está mais ativo."
        description="O acesso foi substituído ou revogado. Use o link mais recente enviado pela escola."
      />
    );
  }

  const client = resolveGameClientUrl();

  if (client.status !== "configured") {
    const missing = client.status === "missing";

    return (
      <PublicState
        icon={missing ? "settings" : "alert"}
        title={
          missing
            ? "O jogo ainda não está disponível."
            : "Não foi possível carregar o jogo."
        }
        description={
          missing
            ? "A atividade está pronta, mas o jogo ainda não foi conectado. Tente novamente mais tarde."
            : "O jogo está temporariamente indisponível. Tente novamente mais tarde ou avise o responsável."
        }
        retryHref={`/atividade/${token}`}
        retryLabel="Voltar à atividade"
      />
    );
  }

  const gameUrl = createGameLaunchUrl(client.url, token);

  return (
    <section className={styles.gameStage} aria-labelledby="game-title">
      <header className={styles.gameStageHeader}>
        <span className={styles.status}>Atividade em andamento</span>
        <h1 id="game-title">Missões do Caramelito</h1>
        <p>Use os controles do jogo para começar.</p>
      </header>

      <div className={styles.gameFrameCard}>
        <iframe
          className={styles.gameFrame}
          src={gameUrl}
          title="Jogo Missões do Caramelito"
          allow="autoplay; fullscreen; gamepad; pointer-lock"
          allowFullScreen
          loading="eager"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className={styles.gameStageFooter}>
        <p>
          <Icon name="shield" /> A atividade não pede nome, e-mail ou conta.
        </p>
        <a
          className={styles.secondary}
          href={gameUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir em nova aba <Icon name="external" />
        </a>
      </div>
    </section>
  );
}
