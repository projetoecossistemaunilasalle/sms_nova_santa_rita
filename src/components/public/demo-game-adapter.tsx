"use client";

import { useEffect, useEffectEvent, useRef } from "react";

import {
  safeParseStateSaveConflictV1,
  safeParseStateSaveSuccessV1,
  stateSaveRequestV1Schema,
  type PlayerBootstrapV1,
} from "@/contracts/v1";
import { createBridgeRequestId } from "./game-bridge";
import { advanceDemoGameState, initialDemoGameState } from "./demo-game-state";

import styles from "./public.module.css";

const demoGameReady = {
  type: "game.ready.v1",
  supported_protocol_versions: [1],
  supported_state_schema_versions: [1],
} as const;

export function DemoGameAdapter({
  bootstrap,
  lastHostMessage,
  isSaving,
  onMessage,
}: {
  bootstrap: PlayerBootstrapV1 | null;
  lastHostMessage: unknown;
  isSaving: boolean;
  onMessage: (message: unknown) => void;
}) {
  const appliedRequests = useRef(new Set<string>());
  const emitFromEffect = useEffectEvent((message: unknown) =>
    onMessage(message),
  );

  useEffect(() => {
    emitFromEffect(demoGameReady);
  }, []);

  useEffect(() => {
    if (!bootstrap || appliedRequests.current.has(bootstrap.request_id)) return;

    appliedRequests.current.add(bootstrap.request_id);
    emitFromEffect({
      type: "game.bootstrap_applied.v1",
      request_id: bootstrap.request_id,
    });
  }, [bootstrap]);

  const saveSuccess = safeParseStateSaveSuccessV1(lastHostMessage);
  const saveConflict = safeParseStateSaveConflictV1(lastHostMessage);
  const state = bootstrap
    ? (bootstrap.state ?? initialDemoGameState())
    : initialDemoGameState();
  const rawSteps = state.missions.when_play_stops_being_play.data.demo_steps;
  const stepCount = typeof rawSteps === "number" ? rawSteps : 0;

  function advanceDemo() {
    if (!bootstrap || isSaving) return;

    const request = stateSaveRequestV1Schema.parse({
      type: "game.save.v1",
      request_id: createBridgeRequestId(),
      expected_revision: bootstrap.revision,
      state: advanceDemoGameState(state),
    });
    onMessage(request);
  }

  return (
    <div className={styles.demoGame}>
      <div className={styles.demoGameScene}>
        <span className={styles.demoGameLabel}>Jogo demonstrativo</span>
        <h2>Uma jornada começa na escola</h2>
        <p>
          Esta tela simula mensagens do GameMaker usando o contrato V1. Cada
          passo é sintético e fica guardado somente neste navegador.
        </p>
        <div className={styles.demoStepReadout}>
          <span aria-hidden="true" className={styles.demoStepNumber}>
            {String(stepCount).padStart(2, "0")}
          </span>
          <span>
            <strong>{stepCount === 1 ? "passo" : "passos"}</strong>
            <small>registrados nesta demonstração</small>
          </span>
        </div>
        <button
          className={styles.primary}
          disabled={!bootstrap || isSaving}
          onClick={advanceDemo}
          type="button"
        >
          {isSaving ? "Guardando…" : "Registrar um passo"}
        </button>
        {saveSuccess.success && (
          <p className={styles.demoGameSuccess} role="status">
            Passo salvo neste navegador.
          </p>
        )}
        {saveConflict.success && (
          <p className={styles.demoGameError} role="status">
            Há uma versão mais recente. O estado demonstrativo não foi
            sobrescrito.
          </p>
        )}
      </div>
    </div>
  );
}
