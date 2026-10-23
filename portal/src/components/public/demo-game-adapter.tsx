"use client";

import { useEffect, useEffectEvent, useRef } from "react";

import {
  safeParseStateSaveConflictV2,
  safeParseStateSaveSuccessV2,
  stateSaveRequestV2Schema,
  type PlayerBootstrapV2,
} from "@/contracts/v2";
import { createBridgeRequestId } from "./game-bridge";
import { advanceDemoGameState, initialDemoGameState } from "./demo-game-state";
import { DEMO_CONTENT_VERSION } from "./game-host-model";

import styles from "./public.module.css";

const demoGameReady = {
  type: "game.ready.v2",
  supported_protocol_versions: [2],
  supported_state_schema_versions: [3],
  content_version: DEMO_CONTENT_VERSION,
} as const;

export function DemoGameAdapter({
  bootstrap,
  lastHostMessage,
  isSaving,
  onMessage,
}: {
  bootstrap: PlayerBootstrapV2 | null;
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
      type: "game.bootstrap_applied.v2",
      request_id: bootstrap.request_id,
      effective_mission_ids: ["demo_steps"],
      ignored: { mission_ids: [], presets: {}, options: [] },
    });
  }, [bootstrap]);

  const saveSuccess = safeParseStateSaveSuccessV2(lastHostMessage);
  const saveConflict = safeParseStateSaveConflictV2(lastHostMessage);
  const state = bootstrap
    ? (bootstrap.state ?? initialDemoGameState())
    : initialDemoGameState();
  const rawSteps = state.demo_steps;
  const stepCount = typeof rawSteps === "number" ? rawSteps : 0;

  function advanceDemo() {
    if (!bootstrap || isSaving) return;

    const request = stateSaveRequestV2Schema.parse({
      type: "game.save.v2",
      request_id: createBridgeRequestId(),
      expected_revision: bootstrap.revision,
      content_version: DEMO_CONTENT_VERSION,
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
          Esta tela simula mensagens do jogo usando o contrato V2. Cada passo é
          sintético e fica guardado somente neste navegador.
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
