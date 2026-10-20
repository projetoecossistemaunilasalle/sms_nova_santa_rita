"use client";

import { useEffect, useRef, useState } from "react";

import {
  PROTOCOL_VERSION,
  STATE_SCHEMA_VERSION,
  hostVisibilityV1Schema,
  protocolErrorV1Schema,
  activeTimeAcknowledgementV1Schema,
  resultAcknowledgementV1Schema,
  safeParsePlayerBootstrapV1,
  stateSaveConflictV1Schema,
  stateSaveSuccessV1Schema,
  type PlayerBootstrapV1,
  type ProtocolErrorV1,
  type StateSaveConflictV1,
  type StateSaveRequestV1,
} from "@/contracts/v1";
import type { PlayerEntryActionResult } from "@/application/player-access/types";
import type { RuntimeMode } from "@/runtime/mode";
import {
  OfflineBranchChangedError,
  OfflineSessionMismatchError,
} from "@/runtime/offline/errors";
import {
  openGameOfflineStore,
  type GameOfflineStore,
} from "@/runtime/offline/sync-engine";
import { GameSyncRetryScheduler } from "@/runtime/offline/network";
import { createGameOfflineTransport } from "./game-offline-transport";
import {
  createBridgeRequestId,
  expectedGameOrigin,
  isTrustedGameMessage,
  parseGameBridgeMessage,
} from "./game-bridge";
import { readDemoGameSnapshot, saveDemoGameState } from "./demo-game-state";
import {
  applyProgressToBootstrap,
  demoStorageKey,
  newBootstrap,
  type HostAlert,
  type HostPhase,
  type HostSyncState,
} from "./game-host-model";
import {
  GameHostAlert,
  GameHostFooter,
  GameHostFrame,
  GameHostHeader,
} from "./game-host-chrome";

import styles from "./public.module.css";

type ReadyEntry = Extract<PlayerEntryActionResult, { state: "ready" }>;

export function GameHost({
  credential,
  entry,
  runtimeMode,
  gameClientUrl,
}: {
  credential: string;
  entry: ReadyEntry;
  runtimeMode: RuntimeMode;
  gameClientUrl: string | null;
}) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const transportRef = useRef<ReturnType<
    typeof createGameOfflineTransport
  > | null>(null);
  const retryScheduler = useRef<GameSyncRetryScheduler | null>(null);
  const bootstrapStarted = useRef(false);
  const bootstrapRef = useRef<PlayerBootstrapV1 | null>(null);
  const inFlightSaves = useRef(new Set<string>());
  const savedReplies = useRef(new Map<string, unknown>());
  const handledConflicts = useRef(new Set<string>());
  const pendingConflict = useRef<string | null>(null);
  const branchReady = useRef(false);
  const offlineStorePromise = useRef<Promise<GameOfflineStore> | null>(null);
  const syncPromise = useRef<Promise<void> | null>(null);
  const syncRequested = useRef(false);
  const synchronizeRef = useRef<() => void>(() => {});
  const receiveRef = useRef<(message: unknown) => void>(() => {});
  const [phase, setPhase] = useState<HostPhase>("connecting");
  const [alert, setAlert] = useState<HostAlert>(null);
  const [bootstrap, setBootstrap] = useState<PlayerBootstrapV1 | null>(null);
  const [lastHostMessage, setLastHostMessage] = useState<unknown>(null);
  const [syncState, setSyncState] = useState<HostSyncState>("pending");
  const [queuedCount, setQueuedCount] = useState(0);
  const [recoveryRequest, setRecoveryRequest] = useState<string | null>(null);
  const [reloadRequired, setReloadRequired] = useState(false);
  const [recovering, setRecovering] = useState(false);

  const gameOrigin = gameClientUrl ? expectedGameOrigin(gameClientUrl) : null;

  function showProtocolError(
    code: ProtocolErrorV1["code"],
    message: string,
    requestId?: string,
  ) {
    const error = protocolErrorV1Schema.parse({
      type: "protocol.error.v1",
      code,
      message,
      ...(requestId ? { request_id: requestId } : {}),
    });
    postToGame(error);
  }

  function postToGame(message: unknown) {
    if (runtimeMode === "demo") {
      setLastHostMessage(message);
      return;
    }

    const target = frameRef.current?.contentWindow;
    if (!target || !gameOrigin) return;
    target.postMessage(message, gameOrigin);
  }

  function getTransport() {
    return (transportRef.current ??= createGameOfflineTransport(
      credential,
      entry.playerSlotId,
      entry,
    ));
  }

  function getOfflineStore(): Promise<GameOfflineStore> {
    offlineStorePromise.current ??= openGameOfflineStore();
    return offlineStorePromise.current;
  }

  function installBootstrap(value: PlayerBootstrapV1) {
    branchReady.current = false;
    bootstrapRef.current = value;
    setBootstrap(value);
    setPhase("applying");
    setAlert(null);
    postToGame(value);
  }

  function updateCurrentBootstrap(value: PlayerBootstrapV1) {
    bootstrapRef.current = value;
    setBootstrap(value);
  }

  function deliverConflict(conflict: StateSaveConflictV1) {
    branchReady.current = false;
    if (handledConflicts.current.has(conflict.request_id)) return;
    handledConflicts.current.add(conflict.request_id);
    pendingConflict.current = conflict.request_id;

    const current = bootstrapRef.current;
    if (current && conflict.state) {
      updateCurrentBootstrap(
        applyProgressToBootstrap(current, conflict.revision, conflict.state),
      );
    }
    replyToRequest(conflict.request_id, conflict);
    setPhase("conflict");
    setSyncState("blocked");
    setAlert({
      tone: "warning",
      message:
        "Outro dispositivo guardou um progresso mais recente. O jogo precisa recuperar essa versão antes de continuar.",
    });
  }

  async function synchronizeQueue(): Promise<void> {
    if (runtimeMode !== "server") return;
    if (syncPromise.current) {
      syncRequested.current = true;
      return syncPromise.current;
    }

    const operation = (async () => {
      try {
        const store = await getOfflineStore();
        const statusBefore = await store.getSyncStatus(entry.playerSlotId);
        const pendingBefore =
          statusBefore.queuedStates +
          statusBefore.queuedResults +
          statusBefore.queuedActiveTime;
        setQueuedCount(pendingBefore);

        if (!navigator.onLine) {
          retryScheduler.current?.reset();
          setSyncState(statusBefore.stateBlocked ? "blocked" : "pending");
          if (pendingBefore > 0) {
            setAlert({
              tone: "warning",
              message:
                "Sem conexão. O progresso e os registros confirmados estão guardados neste dispositivo para sincronizar depois.",
            });
          }
          return;
        }

        const transport = getTransport().forSession(entry.gameSessionId);

        const report = await store.sync(
          entry.playerSlotId,
          transport,
          (conflict) => {
            deliverConflict(conflict);
          },
          entry.gameSessionId,
        );
        if (report.conflict) deliverConflict(report.conflict);
        if (report.rejection) {
          branchReady.current = false;
          setRecoveryRequest(report.rejection.requestId);
          setPhase("error");
          setAlert({
            tone: "warning",
            message:
              "O servidor recusou o progresso desta sessão. Peça ajuda ao profissional: é possível preservar uma cópia local e carregar o progresso do servidor, sem enviar os registros antigos em outra sessão.",
          });
        }

        for (const acknowledgement of report.stateAcknowledgements) {
          replyToRequest(acknowledgement.request_id, acknowledgement);
        }
        for (const acknowledgement of report.eventAcknowledgements) {
          if (acknowledgement.record_type === "result") {
            postToGame(
              resultAcknowledgementV1Schema.parse({
                type: "portal.result_ack.v1",
                client_event_id: acknowledgement.client_event_id,
              }),
            );
          }
        }
        const activeTimeIds = report.eventAcknowledgements
          .filter(({ record_type }) => record_type === "active_time")
          .map(({ client_event_id }) => client_event_id);
        for (let offset = 0; offset < activeTimeIds.length; offset += 100) {
          postToGame(
            activeTimeAcknowledgementV1Schema.parse({
              type: "portal.active_time_ack.v1",
              acknowledged_event_ids: activeTimeIds.slice(offset, offset + 100),
            }),
          );
        }

        if (report.stateAcknowledgements.length > 0 && !report.conflict) {
          const accepted = await store.getBootstrap(entry.playerSlotId);
          if (accepted) updateCurrentBootstrap(accepted);
        }

        const statusAfter = await store.getSyncStatus(entry.playerSlotId);
        const pendingAfter =
          statusAfter.queuedStates +
          statusAfter.queuedResults +
          statusAfter.queuedActiveTime;
        setQueuedCount(pendingAfter);
        setSyncState(
          report.state === "blocked" || statusAfter.stateBlocked
            ? "blocked"
            : report.state,
        );
        if (report.retryable && pendingAfter > 0)
          retryScheduler.current?.schedule();
        else retryScheduler.current?.reset();

        if (report.state === "pending" && pendingAfter > 0) {
          setAlert({
            tone: "warning",
            message:
              report.retryable === false && report.failedStream
                ? "O acesso desta sessão terminou ou foi recusado. Os registros continuam guardados neste dispositivo; peça ajuda ao profissional."
                : "Alguns registros estão guardados neste dispositivo e serão enviados quando a conexão voltar.",
          });
        } else if (report.state === "synced") {
          setAlert(null);
        }
      } catch (error) {
        const sessionChanged = error instanceof OfflineSessionMismatchError;
        setSyncState("pending");
        setAlert({
          tone: "warning",
          message: sessionChanged
            ? "A sessão mudou. Os registros desta sessão não foram enviados com outro acesso; escaneie o QR atual para continuar."
            : "Não foi possível abrir o armazenamento seguro do navegador. O jogo não confirmou nenhum registro novo.",
        });
      }
    })();

    syncPromise.current = operation;
    try {
      await operation;
    } finally {
      if (syncPromise.current === operation) syncPromise.current = null;
      if (syncRequested.current) {
        syncRequested.current = false;
        void synchronizeQueue();
      }
    }
  }

  async function queueResultOrActiveTime(
    message: Extract<
      ReturnType<typeof parseGameBridgeMessage>,
      { type: "game.result.v1" | "game.active_time.v1" }
    >,
  ) {
    try {
      const store = await getOfflineStore();
      const requestIds =
        message.type === "game.result.v1"
          ? [message.request_id]
          : message.events.map(({ request_id }) => request_id);
      const acknowledgement =
        message.type === "game.result.v1"
          ? await store.enqueueResult(
              entry.playerSlotId,
              message,
              entry.gameSessionId,
            )
          : await store.enqueueActiveTime(
              entry.playerSlotId,
              message,
              entry.gameSessionId,
            );
      for (const requestId of requestIds) {
        savedReplies.current.set(requestId, acknowledgement);
      }
      postToGame(acknowledgement);
      setAlert({
        tone: "warning",
        message: navigator.onLine
          ? "Registro guardado com segurança e sincronizando."
          : "Registro guardado com segurança neste dispositivo; será enviado quando a conexão voltar.",
      });
      await synchronizeQueue();
    } catch (error) {
      setAlert({
        tone:
          error instanceof OfflineSessionMismatchError ? "warning" : "error",
        message:
          error instanceof OfflineSessionMismatchError
            ? "A sessão mudou. Este registro não foi enviado com outro acesso; escaneie o QR atual para continuar."
            : "Não foi possível guardar este registro no navegador. O jogo pode tentar novamente.",
      });
    }
  }

  async function bootstrapDemo() {
    const snapshot = readDemoGameSnapshot(
      window.localStorage.getItem(demoStorageKey(entry.playerSlotId)),
    );
    if (snapshot.status === "invalid") {
      throw new Error(
        "O progresso desta demonstração não pôde ser lido. Não vamos apagá-lo automaticamente.",
      );
    }

    installBootstrap(
      newBootstrap(entry.playerSlotId, entry.gameSessionId, snapshot),
    );
  }

  async function bootstrapServer() {
    const store = await getOfflineStore();
    const bootstrapGeneration = await store.reserveBootstrapGeneration(
      entry.playerSlotId,
    );
    const cached = await store.getBootstrap(entry.playerSlotId);
    if (cached) {
      const report = await store.sync(
        entry.playerSlotId,
        getTransport().forSession(cached.class_session_id),
      );
      const status = await store.getSyncStatus(entry.playerSlotId);
      if (report.rejection || report.conflict || status.queuedStates > 0) {
        setRecoveryRequest(
          report.rejection?.requestId ?? report.conflict?.request_id ?? null,
        );
        setReloadRequired(!report.rejection && !report.conflict);
        throw new Error(
          "Há progresso local pendente. Sincronize novamente ou, se o servidor recusou os registros, preserve uma cópia local antes de carregar o progresso do servidor.",
        );
      }
    }
    const requestId = createBridgeRequestId();
    const payload = await getTransport().post(
      "/api/v1/player/bootstrap",
      {
        request_id: requestId,
      },
      entry.gameSessionId,
    );
    const result = safeParsePlayerBootstrapV1(payload);

    if (!result.success) {
      throw new Error("Não foi possível carregar o progresso do jogador.");
    }

    if (
      result.data.player_id !== entry.playerSlotId ||
      result.data.class_session_id !== entry.gameSessionId
    ) {
      throw new Error("O contexto recebido não corresponde a este jogador.");
    }

    const accepted = await store.cacheBootstrap(
      result.data,
      bootstrapGeneration,
    );
    if (!accepted || accepted.class_session_id !== entry.gameSessionId) {
      throw new OfflineSessionMismatchError();
    }
    installBootstrap(accepted);
    void synchronizeQueue();
  }

  async function beginBootstrap() {
    if (bootstrapStarted.current) return;
    bootstrapStarted.current = true;
    setPhase("bootstrapping");
    setAlert(null);

    try {
      if (runtimeMode === "demo") {
        await bootstrapDemo();
      } else {
        await bootstrapServer();
      }
    } catch (error) {
      bootstrapStarted.current = false;
      setPhase("error");
      setAlert({
        tone: "error",
        message:
          error instanceof OfflineSessionMismatchError
            ? "A sessão mudou. Escaneie o QR atual para carregar o progresso com segurança."
            : error instanceof Error
              ? error.message
              : "Não foi possível preparar o jogo. Peça ajuda ao profissional.",
      });
    }
  }

  async function saveDemoState(request: StateSaveRequestV1) {
    try {
      const key = demoStorageKey(entry.playerSlotId);
      const current = readDemoGameSnapshot(window.localStorage.getItem(key));
      if (current.status === "invalid") {
        throw new Error("O progresso demonstrativo não pôde ser lido.");
      }

      const result = saveDemoGameState(
        current.status === "valid" ? current.snapshot : null,
        request,
      );
      if (result.status === "saved") {
        window.localStorage.setItem(key, JSON.stringify(result.snapshot));
        const reply = stateSaveSuccessV1Schema.parse({
          type: "portal.save_ok.v1",
          request_id: request.request_id,
          revision: result.snapshot.revision,
        });
        const currentBootstrap = bootstrapRef.current;
        if (currentBootstrap) {
          updateCurrentBootstrap(
            applyProgressToBootstrap(
              currentBootstrap,
              result.snapshot.revision,
              result.snapshot.state,
            ),
          );
        }
        replyToRequest(request.request_id, reply);
        setPhase("playing");
        return;
      }

      const reply = stateSaveConflictV1Schema.parse({
        type: "portal.save_conflict.v1",
        request_id: request.request_id,
        revision: result.snapshot.revision,
        state: result.snapshot.state,
      });
      updateCurrentBootstrap(
        applyProgressToBootstrap(
          bootstrapRef.current ??
            newBootstrap(entry.playerSlotId, entry.gameSessionId, {
              status: "valid",
              snapshot: result.snapshot,
            }),
          result.snapshot.revision,
          result.snapshot.state,
        ),
      );
      replyToRequest(request.request_id, reply);
      setPhase("conflict");
      setAlert({
        tone: "warning",
        message:
          "Uma versão mais recente foi mantida. O avanço atual não substituiu o progresso guardado.",
      });
    } catch {
      setPhase("error");
      setAlert({
        tone: "error",
        message:
          "Não foi possível guardar neste navegador. O jogo pode tentar enviar o mesmo passo novamente.",
      });
    }
  }

  async function saveServerState(request: StateSaveRequestV1) {
    try {
      const store = await getOfflineStore();
      const durable = await store.enqueueState(
        entry.playerSlotId,
        request,
        entry.gameSessionId,
      );
      replyToRequest(request.request_id, durable);
      setPhase("playing");
      setSyncState("pending");
      setAlert({
        tone: "warning",
        message: navigator.onLine
          ? "Progresso guardado neste dispositivo e sincronizando com o servidor."
          : "Progresso guardado neste dispositivo; será sincronizado quando a conexão voltar.",
      });
      await synchronizeQueue();
    } catch (error) {
      if (error instanceof OfflineBranchChangedError) {
        branchReady.current = false;
        setReloadRequired(true);
      }
      setPhase("error");
      setAlert({
        tone: "error",
        message:
          error instanceof OfflineBranchChangedError
            ? "Outra janela assumiu este jogador. Carregue o progresso atual antes de continuar; este passo não foi confirmado."
            : error instanceof OfflineSessionMismatchError
              ? "A sessão mudou. Escaneie o QR atual para continuar com segurança."
              : "Não foi possível guardar o progresso neste navegador. O jogo não confirmou este passo e pode tentar novamente.",
      });
    }
  }

  function replyToRequest(requestId: string, reply: unknown) {
    savedReplies.current.set(requestId, reply);
    postToGame(reply);
  }

  function receiveGameMessage(value: unknown) {
    const message = parseGameBridgeMessage(value);
    if (!message) {
      setPhase("error");
      setAlert({
        tone: "error",
        message:
          "O jogo enviou uma mensagem incompatível. Peça ajuda ao profissional.",
      });
      showProtocolError(
        "VALIDATION_FAILED",
        "The host rejected a message that does not match protocol V1.",
      );
      return;
    }

    if (message.type === "game.ready.v1") {
      if (!message.supported_protocol_versions.includes(PROTOCOL_VERSION)) {
        bootstrapStarted.current = false;
        setPhase("error");
        setAlert({
          tone: "error",
          message:
            "Esta versão do jogo ainda não pode ser conectada ao acesso da turma.",
        });
        showProtocolError(
          "PROTOCOL_VERSION_UNSUPPORTED",
          "The portal requires protocol version 1.",
        );
        return;
      }
      if (
        !message.supported_state_schema_versions.includes(STATE_SCHEMA_VERSION)
      ) {
        bootstrapStarted.current = false;
        setPhase("error");
        setAlert({
          tone: "error",
          message:
            "Esta versão do jogo não reconhece o formato de progresso necessário.",
        });
        showProtocolError(
          "STATE_SCHEMA_VERSION_UNSUPPORTED",
          `The portal requires state schema version ${STATE_SCHEMA_VERSION}.`,
        );
        return;
      }
      void beginBootstrap();
      return;
    }

    if (message.type === "game.bootstrap_applied.v1") {
      if (pendingConflict.current === message.request_id) {
        pendingConflict.current = null;
        void getOfflineStore()
          .then(async (store) => {
            await store.discardConflictedStateBranch(
              entry.playerSlotId,
              message.request_id,
            );
            bootstrapStarted.current = false;
            await beginBootstrap();
          })
          .catch(() => {
            pendingConflict.current = message.request_id;
            setAlert({
              tone: "error",
              message:
                "O progresso do servidor foi aplicado, mas a fila local ainda precisa ser recuperada.",
            });
          });
        return;
      }
      if (message.request_id !== bootstrapRef.current?.request_id) return;
      branchReady.current = true;
      setPhase("playing");
      setAlert(null);
      return;
    }

    if (message.type === "game.save.v1") {
      if (!branchReady.current) return;
      const saved = savedReplies.current.get(message.request_id);
      if (saved) {
        postToGame(saved);
        return;
      }
      if (inFlightSaves.current.has(message.request_id)) return;

      inFlightSaves.current.add(message.request_id);
      setPhase("saving");
      if (runtimeMode === "demo") {
        void saveDemoState(message).finally(() => {
          inFlightSaves.current.delete(message.request_id);
        });
      } else {
        void saveServerState(message).finally(() => {
          inFlightSaves.current.delete(message.request_id);
        });
      }
      return;
    }

    if (
      message.type === "game.result.v1" ||
      message.type === "game.active_time.v1"
    ) {
      if (runtimeMode === "demo") {
        setAlert({
          tone: "warning",
          message:
            "A demonstração local não registra resultados nem tempo de jogo.",
        });
      } else {
        void queueResultOrActiveTime(message);
      }
      return;
    }

    if (message.type === "protocol.error.v1") {
      setPhase("error");
      setAlert({
        tone: "error",
        message:
          "O jogo encontrou um problema de integração. Escaneie o QR novamente ou peça ajuda ao profissional.",
      });
    }
  }

  receiveRef.current = receiveGameMessage;
  bootstrapRef.current = bootstrap;
  synchronizeRef.current = () => {
    void synchronizeQueue();
  };

  useEffect(() => {
    if (runtimeMode !== "server" || !gameOrigin) return;
    const targetOrigin = gameOrigin;
    const scheduler = new GameSyncRetryScheduler(() =>
      synchronizeRef.current(),
    );
    retryScheduler.current = scheduler;

    function onWindowMessage(event: MessageEvent) {
      const frameWindow = frameRef.current?.contentWindow ?? null;
      if (!isTrustedGameMessage(event, frameWindow, targetOrigin)) return;
      receiveRef.current(event.data);
    }

    function sendVisibility() {
      const target = frameRef.current?.contentWindow;
      if (!target) return;
      const visibility = hostVisibilityV1Schema.parse({
        type: "portal.visibility.v1",
        visible: document.visibilityState === "visible",
        focused: document.hasFocus(),
        online: navigator.onLine,
      });
      target.postMessage(visibility, targetOrigin);
    }

    function reconnectAndSync() {
      scheduler.reset();
      sendVisibility();
      synchronizeRef.current();
    }

    window.addEventListener("message", onWindowMessage);
    window.addEventListener("focus", sendVisibility);
    window.addEventListener("blur", sendVisibility);
    window.addEventListener("online", reconnectAndSync);
    window.addEventListener("offline", sendVisibility);
    document.addEventListener("visibilitychange", sendVisibility);

    return () => {
      scheduler.reset();
      retryScheduler.current = null;
      window.removeEventListener("message", onWindowMessage);
      window.removeEventListener("focus", sendVisibility);
      window.removeEventListener("blur", sendVisibility);
      window.removeEventListener("online", reconnectAndSync);
      window.removeEventListener("offline", sendVisibility);
      document.removeEventListener("visibilitychange", sendVisibility);
    };
  }, [gameOrigin, runtimeMode]);

  useEffect(() => {
    if (phase !== "waiting" || runtimeMode !== "server") return;

    const timeout = window.setTimeout(() => {
      if (bootstrapStarted.current) return;
      setAlert({
        tone: "warning",
        message:
          "O jogo ainda não respondeu. Confira a conexão ou peça ajuda ao profissional.",
      });
    }, 12_000);
    return () => window.clearTimeout(timeout);
  }, [phase, runtimeMode]);

  function handleFrameLoad() {
    branchReady.current = false;
    savedReplies.current.clear();
    bootstrapStarted.current = false;
    setBootstrap(null);
    bootstrapRef.current = null;
    setPhase("waiting");
    setAlert(null);
  }

  async function recoverState() {
    if (recovering) return;
    setRecovering(true);
    branchReady.current = false;
    try {
      await syncPromise.current;
      if (recoveryRequest) {
        const store = await getOfflineStore();
        await store.discardConflictedStateBranch(
          entry.playerSlotId,
          recoveryRequest,
        );
      }
      setRecoveryRequest(null);
      setReloadRequired(false);
      savedReplies.current.clear();
      pendingConflict.current = null;
      bootstrapStarted.current = false;
      await beginBootstrap();
    } catch {
      setAlert({
        tone: "error",
        message:
          "Não foi possível recuperar a fila. Os registros foram preservados; tente novamente com conexão.",
      });
    } finally {
      setRecovering(false);
    }
  }

  return (
    <section className={styles.gameHost} aria-label="Entrada do jogo">
      <GameHostHeader
        phase={phase}
        playerNumber={entry.playerNumber}
        runtimeMode={runtimeMode}
      />
      {alert && <GameHostAlert alert={alert} />}
      {(recoveryRequest || reloadRequired) && (
        <button
          type="button"
          className={styles.retryButton}
          disabled={recovering}
          onClick={() => void recoverState()}
        >
          {recovering
            ? "Carregando progresso..."
            : recoveryRequest
              ? "Preservar cópia local e carregar do servidor"
              : "Carregar progresso atual"}
        </button>
      )}
      <GameHostFrame
        bootstrap={bootstrap}
        frameRef={frameRef}
        gameClientUrl={gameClientUrl}
        gameOrigin={gameOrigin}
        isSaving={phase === "saving"}
        lastHostMessage={lastHostMessage}
        onFrameLoad={handleFrameLoad}
        onMessage={receiveGameMessage}
        runtimeMode={runtimeMode}
      />
      <GameHostFooter
        bootstrap={bootstrap}
        queuedCount={queuedCount}
        runtimeMode={runtimeMode}
        syncState={syncState}
      />
    </section>
  );
}
