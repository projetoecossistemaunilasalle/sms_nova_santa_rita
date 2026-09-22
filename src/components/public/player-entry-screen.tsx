"use client";

import { useEffect, useRef, useState } from "react";

import type { PlayerEntryActionResult } from "@/application/player-access/types";
import { Icon, type IconName } from "@/components/shared/icon";
import type { RuntimeMode } from "@/runtime/mode";
import { resolvePlayerEntryAction } from "@runtime/player-entry-action";
import { readPlayerEntryCredential } from "./player-entry-credential";

import styles from "./public.module.css";

type EntryView = PlayerEntryActionResult | { state: "loading" };

const stateCopy: Record<
  Exclude<EntryView["state"], "loading" | "ready" | "waiting">,
  { icon: IconName; title: string; description: string }
> = {
  invalid: {
    icon: "search",
    title: "Este QR não foi reconhecido",
    description:
      "Confira se o cartão correto foi escaneado ou peça um novo código ao professor.",
  },
  revoked: {
    icon: "history",
    title: "Este QR foi substituído",
    description:
      "Use o cartão mais recente entregue pelo professor. O acesso antigo não funciona mais.",
  },
  inactive: {
    icon: "pause",
    title: "Este acesso está indisponível",
    description:
      "A turma ou o jogador não está ativo neste momento. Peça ajuda ao professor.",
  },
  ended: {
    icon: "archive",
    title: "A sessão foi encerrada",
    description:
      "A atividade desta turma terminou. Aguarde uma nova orientação do professor.",
  },
  unauthorized: {
    icon: "shield",
    title: "Não foi possível autorizar a entrada",
    description:
      "Este acesso não corresponde à sessão atual. Escaneie novamente ou peça ajuda ao professor.",
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
}: {
  runtimeMode: RuntimeMode;
}) {
  const [view, setView] = useState<EntryView>({ state: "loading" });
  const credential = useRef<string | null>(null);

  async function resolve(token: string) {
    setView({ state: "loading" });
    try {
      setView(await resolvePlayerEntryAction(token));
    } catch {
      setView({ state: "unauthorized" });
    }
  }

  useEffect(() => {
    const result = readPlayerEntryCredential(
      window.location.href,
      credential.current,
    );
    if (result.historyUrl) {
      window.history.replaceState(window.history.state, "", result.historyUrl);
    }
    if (!result.shouldResolve) return;

    const token = result.token;
    if (!token) {
      queueMicrotask(() => setView({ state: "invalid" }));
      return;
    }
    credential.current = token;
    queueMicrotask(() => void resolve(token));
  }, []);

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
          Seu acesso está certo. Aguarde o professor iniciar a sessão e tente
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

  if (view.state === "ready") {
    return (
      <section className={`${styles.entryCard} ${styles.entryReady}`}>
        {runtimeMode === "demo" && (
          <span className={styles.entryDemoMark}>Demonstração local</span>
        )}
        <span className={styles.entryPlayerNumber}>
          {String(view.playerNumber).padStart(2, "0")}
        </span>
        <span className={styles.entryStatus}>Entrada liberada</span>
        <h1>Tudo pronto para jogar</h1>
        <p>
          A sessão da turma está ativa e seu jogador foi reconhecido. O jogo
          pode continuar com este acesso temporário.
        </p>
        <span className={styles.entrySafetyNote}>
          <Icon name="shield" /> Seu nome, e-mail e senha não são necessários.
        </span>
      </section>
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
