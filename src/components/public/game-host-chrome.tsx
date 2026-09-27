"use client";

import type { PlayerBootstrapV1 } from "@/contracts/v1";
import type { RuntimeMode } from "@/runtime/mode";
import { DemoGameAdapter } from "./demo-game-adapter";
import type { HostAlert, HostPhase, HostSyncState } from "./game-host-model";

import styles from "./public.module.css";

const phaseCopy: Record<HostPhase, string> = {
  connecting: "Preparando o jogo",
  waiting: "Aguardando o jogo",
  bootstrapping: "Carregando o progresso",
  applying: "Preparando sua jornada",
  playing: "Jogo pronto",
  saving: "Guardando progresso",
  conflict: "Recuperação necessária",
  error: "Verifique com o professor",
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
  bootstrap: PlayerBootstrapV1 | null;
  frameRef: { current: HTMLIFrameElement | null };
  gameClientUrl: string | null;
  gameOrigin: string | null;
  isSaving: boolean;
  lastHostMessage: unknown;
  onFrameLoad: () => void;
  onMessage: (message: unknown) => void;
  runtimeMode: RuntimeMode;
}) {
  return (
    <div className={styles.gameHostFrame}>
      {runtimeMode === "demo" ? (
        <DemoGameAdapter
          bootstrap={bootstrap}
          isSaving={isSaving}
          lastHostMessage={lastHostMessage}
          onMessage={onMessage}
        />
      ) : gameClientUrl && gameOrigin ? (
        <iframe
          key={gameClientUrl}
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
            Seu acesso está pronto. Peça ao professor para verificar a
            configuração do jogo antes de continuar.
          </p>
        </div>
      )}
    </div>
  );
}

export function GameHostFooter({
  bootstrap,
  queuedCount,
  runtimeMode,
  syncState,
}: {
  bootstrap: PlayerBootstrapV1 | null;
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
