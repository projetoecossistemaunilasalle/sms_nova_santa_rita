"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { PlayerBootstrapV2 } from "@/contracts/v2";
import type { RuntimeMode } from "@/runtime/mode";
import { Icon } from "@/components/shared/icon";
import { DemoGameAdapter } from "./demo-game-adapter";
import type { HostAlert, HostPhase, HostSyncState } from "./game-host-model";

import styles from "./public.module.css";

const phaseCopy: Record<HostPhase, string> = {
  connecting: "Preparando o jogo",
  updating: "Atualizando o jogo",
  waiting: "Aguardando o jogo",
  bootstrapping: "Carregando o progresso",
  applying: "Preparando sua jornada",
  playing: "Jogo pronto",
  saving: "Guardando progresso",
  conflict: "Recuperação necessária",
  error: "Verifique com o profissional",
};

export function GameHostHeader({
  phase,
  playerNumber,
  runtimeMode,
}: {
  phase: HostPhase;
  playerNumber: number;
  runtimeMode: RuntimeMode;
}) {
  return (
    <header className={styles.gameHostHeader}>
      <div>
        <span className={styles.entryStatus}>
          Jogador {String(playerNumber).padStart(2, "0")}
        </span>
        <h1>Missões do Caramelito</h1>
        <p>
          {runtimeMode === "demo"
            ? "Neste exemplo, os passos ficam neste navegador. No jogo conectado, o progresso fica ligado ao jogador."
            : "Seu progresso fica ligado a este jogador e pode continuar em outro dispositivo."}
        </p>
      </div>
      <span className={styles.gameConnection} data-state={phase} role="status">
        <span aria-hidden="true" />
        {phaseCopy[phase]}
      </span>
    </header>
  );
}

export function GameHostAlert({ alert }: { alert: NonNullable<HostAlert> }) {
  return (
    <p
      className={`${styles.gameHostAlert} ${alert.tone === "error" ? styles.gameHostAlertError : ""}`}
      role="status"
    >
      {alert.message}
    </p>
  );
}

export function GameHostFrame({
  frameGeneration,
  contentFailure,
  bootstrap,
  frameRef,
  gameClientUrl,
  gameOrigin,
  isSaving,
  lastHostMessage,
  onFrameLoad,
  onMessage,
  runtimeMode,
}: {
  frameGeneration: number;
  contentFailure: string | null;
  bootstrap: PlayerBootstrapV2 | null;
  frameRef: { current: HTMLIFrameElement | null };
  gameClientUrl: string | null;
  gameOrigin: string | null;
  isSaving: boolean;
  lastHostMessage: unknown;
  onFrameLoad: () => void;
  onMessage: (message: unknown) => void;
  runtimeMode: RuntimeMode;
}) {
  const playable =
    !contentFailure &&
    (runtimeMode === "demo" || Boolean(gameClientUrl && gameOrigin));
  const { stageRef, expanded, enter, exit } = useGameFullscreen(frameRef);

  return (
    <div
      className={styles.gameHostFrame}
      data-expanded={expanded}
      ref={stageRef}
    >
      {playable && (
        <div className={styles.gameHostToolbar}>
          <p className={styles.gameRotateHint}>
            Vire o celular e toque em Tela cheia para ver o jogo inteiro.
          </p>
          <button
            className={styles.gameFullscreenButton}
            type="button"
            onClick={expanded ? exit : enter}
          >
            <Icon name={expanded ? "shrink" : "expand"} />
            {expanded ? "Sair" : "Tela cheia"}
          </button>
        </div>
      )}
      {contentFailure ? (
        <div className={styles.gameHostUnavailable} role="alert">
          <h2>Chame o professor</h2>
          <p>{contentFailure}</p>
        </div>
      ) : runtimeMode === "demo" ? (
        <DemoGameAdapter
          bootstrap={bootstrap}
          isSaving={isSaving}
          lastHostMessage={lastHostMessage}
          onMessage={onMessage}
        />
      ) : gameClientUrl && gameOrigin ? (
        <iframe
          key={`${gameClientUrl}:${frameGeneration}`}
          allow="autoplay; fullscreen; gamepad"
          allowFullScreen
          className={styles.gameHostIframe}
          onLoad={onFrameLoad}
          ref={frameRef}
          referrerPolicy="no-referrer"
          src={gameClientUrl}
          title="Jogo Missões do Caramelito"
        />
      ) : (
        <div className={styles.gameHostUnavailable}>
          <span aria-hidden="true" className={styles.gameUnavailableMark}>
            !
          </span>
          <h2>O jogo ainda não está conectado</h2>
          <p>
            Seu acesso está pronto. Peça ao profissional para verificar a
            configuração do jogo antes de continuar.
          </p>
        </div>
      )}
    </div>
  );
}

type OrientationLock = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
};

/**
 * Native fullscreen where the browser offers it for elements (Android), and a
 * viewport-filling stage everywhere, which is all an iPhone allows a page.
 */
function useGameFullscreen(frameRef: { current: HTMLIFrameElement | null }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  const enter = useCallback(async () => {
    setExpanded(true);
    const stage = stageRef.current;
    if (stage?.requestFullscreen && !document.fullscreenElement) {
      try {
        await stage.requestFullscreen({ navigationUI: "hide" });
        await (screen.orientation as OrientationLock | undefined)
          ?.lock?.("landscape")
          .catch(() => undefined);
      } catch {
        // The stage still fills the window without native fullscreen.
      }
    }
    frameRef.current?.focus();
  }, [frameRef]);

  const exit = useCallback(async () => {
    setExpanded(false);
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!expanded) return;
    function onFullscreenChange() {
      // Leaving native fullscreen with the system back gesture also collapses.
      if (!document.fullscreenElement) setExpanded(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") void exit();
    }
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      root.style.overflow = overflow;
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded, exit]);

  return { stageRef, expanded, enter, exit };
}

export function GameHostFooter({
  bootstrap,
  queuedCount,
  runtimeMode,
  syncState,
}: {
  bootstrap: PlayerBootstrapV2 | null;
  queuedCount: number;
  runtimeMode: RuntimeMode;
  syncState: HostSyncState;
}) {
  return (
    <footer className={styles.gameHostFooter}>
      {runtimeMode === "demo" ? (
        <span className={styles.gameDemoLabel}>
          Demonstração local · dados sintéticos
        </span>
      ) : (
        <span>
          {syncState === "synced"
            ? "Progresso sincronizado"
            : syncState === "blocked"
              ? "Sincronização pausada para recuperar o progresso"
              : queuedCount > 0
                ? `${queuedCount} registro(s) aguardando conexão`
                : "Preparando a sincronização"}
        </span>
      )}
      {runtimeMode === "server" && (
        <span>Conexão protegida · nenhum QR é enviado ao jogo</span>
      )}
      {bootstrap && (
        <span className={styles.gameRevision}>
          Progresso{" "}
          {bootstrap.revision === 0 ? "novo" : `v${bootstrap.revision}`}
        </span>
      )}
    </footer>
  );
}
