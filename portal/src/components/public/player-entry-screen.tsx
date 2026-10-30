"use client";

import { useEffect, useRef, useState } from "react";

import type { PlayerEntryActionResult } from "@/application/player-access/types";
import { Icon, type IconName } from "@/components/shared/icon";
import type { RuntimeMode } from "@/runtime/mode";
import { resolvePlayerEntryAction } from "@/runtime/actions";
import { GameHost } from "./game-host";
import { readPlayerEntryWithResume } from "./player-entry-credential";
import {
  currentNavigationType,
  forgetPlayerEntry,
  playerEntrySessionStorage,
  rememberPlayerEntry,
} from "./player-entry-resume";
import { recoverOfflinePlayerQueue } from "./recover-offline-queue";
import { GameSyncRetryScheduler } from "@/runtime/offline/network";

import styles from "./public.module.css";

type EntryView = PlayerEntryActionResult | { state: "loading" | "scan" };

const stateCopy: Record<
  Exclude<EntryView["state"], "loading" | "ready" | "scan" | "waiting">,
  { icon: IconName; title: string; description: string }
> = {
  invalid: {
    icon: "search",
    title: "Este QR não foi reconhecido",
    description:
      "Confira se o cartão correto foi escaneado ou peça um novo código ao profissional.",
  },
  revoked: {
    icon: "history",
    title: "Este QR foi substituído",
    description:
      "Use o cartão mais recente entregue pelo profissional. O acesso antigo não funciona mais.",
  },
  inactive: {
    icon: "pause",
    title: "Este acesso está indisponível",
    description:
      "A turma ou o jogador não está ativo neste momento. Peça ajuda ao profissional.",
  },
  ended: {
    icon: "archive",
    title: "A sessão foi encerrada",
    description:
      "A atividade desta turma terminou. Aguarde uma nova orientação do profissional.",
  },
  unauthorized: {
    icon: "shield",
    title: "Não foi possível autorizar a entrada",
    description:
      "Este acesso não corresponde à sessão atual. Escaneie novamente ou peça ajuda ao profissional.",
  },
  expired: {
    icon: "clock",
    title: "O tempo para entrar terminou",
    description:
      "Escaneie o QR novamente para preparar um novo acesso seguro ao jogo.",
  },
};

export function PlayerEntryScreen({
  runtimeMode,
  gameClientUrl,
}: {
  runtimeMode: RuntimeMode;
  gameClientUrl: string | null;
}) {
  const [view, setView] = useState<EntryView>({ state: "loading" });
  const [entryCredential, setEntryCredential] = useState<string | null>(null);
  const credential = useRef<string | null>(null);
  const entryRead = useRef(false);

  async function resolve(token: string) {
    setView({ state: "loading" });
    try {
      const result = await resolvePlayerEntryAction(token);
      if (result.state === "ready" || result.state === "waiting") {
        rememberPlayerEntry(playerEntrySessionStorage(), token, Date.now());
      } else {
        forgetPlayerEntry(playerEntrySessionStorage());
      }
      setView(result);
    } catch {
      setView({ state: "unauthorized" });
    }
  }

  useEffect(() => {
    // Also preserve scan/invalid decisions when Strict Mode replays this effect.
    if (entryRead.current) return;
    entryRead.current = true;
    const result = readPlayerEntryWithResume(
      window.location.href,
      credential.current,
      playerEntrySessionStorage(),
      {
        navigationType: currentNavigationType(),
        wasDiscarded:
          (document as Document & { wasDiscarded?: boolean }).wasDiscarded ===
          true,
        nowMs: Date.now(),
      },
    );
    if (result.historyUrl) {
      window.history.replaceState(window.history.state, "", result.historyUrl);
    }
    if (!result.shouldResolve) return;

    const token = result.token;
    if (!token) {
      queueMicrotask(() =>
        setView({ state: result.credentialMissing ? "scan" : "invalid" }),
      );
      return;
    }
    credential.current = token;
    setEntryCredential(token);
    queueMicrotask(() => void resolve(token));
  }, []);

  const waitingPlayerId = view.state === "waiting" ? view.playerSlotId : null;
  useEffect(() => {
    if (runtimeMode !== "server" || !waitingPlayerId || !entryCredential)
      return;
    let disposed = false;
    let running = false;
    const scheduler = new GameSyncRetryScheduler(() => void flush());
    async function flush() {
      if (disposed || running || !navigator.onLine) return;
      running = true;
      try {
        const report = await recoverOfflinePlayerQueue(
          entryCredential!,
          waitingPlayerId!,
        );
        if (!disposed && report?.retryable) scheduler.schedule();
      } catch {
        // Keep the entry surface usable if this browser cannot open IndexedDB.
      } finally {
        running = false;
      }
    }
    function reconnect() {
      scheduler.reset();
      void flush();
    }
    void flush();
    window.addEventListener("online", reconnect);
    return () => {
      disposed = true;
      scheduler.reset();
      window.removeEventListener("online", reconnect);
    };
  }, [runtimeMode, waitingPlayerId, entryCredential]);

  if (view.state === "loading") {
    return (
      <section className={`${styles.entryCard} ${styles.entryLoading}`}>
        {runtimeMode === "demo" && (
          <span className={styles.entryDemoMark}>Demonstração local</span>
        )}
        <span className={styles.entrySpinner} aria-hidden="true" />
        <h1>Preparando sua entrada…</h1>
        <p role="status">Estamos conferindo seu cartão com segurança.</p>
      </section>
    );
  }

  if (view.state === "waiting") {
    return (
      <section className={`${styles.entryCard} ${styles.entryWaiting}`}>
        {runtimeMode === "demo" && (
          <span className={styles.entryDemoMark}>Demonstração local</span>
        )}
        <span className={styles.entryPlayerNumber}>
          {String(view.playerNumber).padStart(2, "0")}
        </span>
        <span className={styles.entryStatus}>Cartão reconhecido</span>
        <h1>A turma ainda está se preparando</h1>
        <p>
          Seu acesso está certo. Aguarde o profissional iniciar a sessão e tente
          novamente.
        </p>
        <button
          className={styles.primary}
          type="button"
          onClick={() => {
            if (credential.current) void resolve(credential.current);
          }}
        >
          Verificar novamente <Icon name="history" />
        </button>
      </section>
    );
  }

  if (view.state === "scan") {
    return (
      <section className={`${styles.entryCard} ${styles.entryProblem}`}>
        {runtimeMode === "demo" && (
          <span className={styles.entryDemoMark}>Demonstração local</span>
        )}
        <span className={styles.entryProblemIcon} aria-hidden="true">
          <Icon name="gamepad" />
        </span>
        <h1>Escaneie seu cartão para jogar</h1>
        <p>
          Aponte a câmera para o QR do jogador entregue pelo profissional. Se
          precisar, peça ajuda ao profissional.
        </p>
      </section>
    );
  }

  if (view.state === "ready") {
    if (!entryCredential) {
      return (
        <section className={`${styles.entryCard} ${styles.entryProblem}`}>
          <h1>Não foi possível preparar o jogo</h1>
          <p>Escaneie o QR novamente com a orientação do profissional.</p>
        </section>
      );
    }

    return (
      <GameHost
        credential={entryCredential}
        entry={view}
        gameClientUrl={gameClientUrl}
        runtimeMode={runtimeMode}
      />
    );
  }

  const copy = stateCopy[view.state];
  return (
    <section className={`${styles.entryCard} ${styles.entryProblem}`}>
      {runtimeMode === "demo" && (
        <span className={styles.entryDemoMark}>Demonstração local</span>
      )}
      <span className={styles.entryProblemIcon} aria-hidden="true">
        <Icon name={copy.icon} />
      </span>
      <h1>{copy.title}</h1>
      <p>{copy.description}</p>
    </section>
  );
}
