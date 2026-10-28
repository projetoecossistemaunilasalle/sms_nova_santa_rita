"use client";

import { useEffect, useRef, useState } from "react";

import {
  PROTOCOL_VERSION,
  SUPPORTED_STATE_SCHEMA_VERSIONS,
  hostVisibilityV2Schema,
  protocolErrorV2Schema,
  activeTimeAcknowledgementV2Schema,
  resultAcknowledgementV2Schema,
  safeParsePlayerBootstrapV2,
  stateSaveConflictV2Schema,
  stateSaveSuccessV2Schema,
  type PlayerBootstrapV2,
  type ProtocolErrorV2,
  type StateSaveConflictV2,
  type StateSaveRequestV2,
} from "@/contracts/v2";
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
  initialGameHostDocument,
  transitionGameHostDocument,
  type GameHostDocumentEvent,
} from "./game-host-document";
import {
  applyProgressToBootstrap,
  contentErrorRecovery,
  DEMO_CONTENT_VERSION,
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

/**
 * The page counts as focused while the game iframe holds its focus. Leaving
 * the browser still pauses play: the game also watches its own window focus.
 */
function hostHasFocus(frame: HTMLIFrameElement | null): boolean {
  return (
    document.hasFocus() || (frame !== null && document.activeElement === frame)
  );
}

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
  const gameDocument = useRef(initialGameHostDocument());
  const inFlightSaves = useRef(new Set<string>());
  const handledConflicts = useRef(new Set<string>());
  const pendingConflict = useRef<string | null>(null);
  const upgradeRetried = useRef(false);
  const [frameGeneration, setFrameGeneration] = useState(0);
  const [contentFailure, setContentFailure] = useState<string | null>(null);
  const offlineStorePromise = useRef<Promise<GameOfflineStore> | null>(null);
  const syncPromise = useRef<Promise<void> | null>(null);
  const syncRequested = useRef(false);
  const synchronizeRef = useRef<() => void>(() => {});
  const receiveRef = useRef<(message: unknown) => void>(() => {});
  const [phase, updatePhase] = useState<HostPhase>("connecting");
  const [alert, setAlert] = useState<HostAlert>(null);
  const [bootstrap, setBootstrap] = useState<PlayerBootstrapV2 | null>(null);
  const [lastHostMessage, setLastHostMessage] = useState<unknown>(null);
  const [syncState, setSyncState] = useState<HostSyncState>("pending");
  const [queuedCount, setQueuedCount] = useState(0);
  const [recoveryRequest, setRecoveryRequest] = useState<string | null>(null);
  const [reloadRequired, setReloadRequired] = useState(false);
  const [recovering, setRecovering] = useState(false);

  const gameOrigin = gameClientUrl ? expectedGameOrigin(gameClientUrl) : null;

  function setPhase(value: HostPhase) {
    gameDocument.current.phase = value;
    updatePhase(value);
  }

  function applyDocumentEvent(event: GameHostDocumentEvent) {
    const previous = gameDocument.current;
    const next = transitionGameHostDocument(previous, event);
    gameDocument.current = next;
    if (next.phase !== previous.phase) updatePhase(next.phase);
    if (next.bootstrap !== previous.bootstrap) setBootstrap(next.bootstrap);
    return next !== previous;
  }

  function remountFrame() {
    // Invalidate synchronously, before React replaces the frame.
    applyDocumentEvent({ type: "remount" });
    setFrameGeneration((generation) => generation + 1);
  }

  function showProtocolError(
    code: ProtocolErrorV2["code"],
    message: string,
    requestId?: string,
  ) {
    const error = protocolErrorV2Schema.parse({
      type: "protocol.error.v2",
      code,
      message,
      ...(requestId ? { request_id: requestId } : {}),
    });
    postToGame(error);
  }

  function postToGame(
    message: unknown,
    generation = gameDocument.current.generation,
  ) {
    if (generation !== gameDocument.current.generation) return;
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

  function installBootstrap(value: PlayerBootstrapV2, generation: number) {
    if (
      !applyDocumentEvent({
        type: "bootstrap-installed",
        bootstrap: value,
        generation,
      })
    )
      return;
    setAlert(null);
    postToGame(value, generation);
  }

  function updateCurrentBootstrap(value: PlayerBootstrapV2) {
    gameDocument.current.bootstrap = value;
    setBootstrap(value);
  }

  function deliverConflict(conflict: StateSaveConflictV2) {
    gameDocument.current.branchReady = false;
    if (handledConflicts.current.has(conflict.request_id)) return;
    handledConflicts.current.add(conflict.request_id);
    pendingConflict.current = conflict.request_id;

    const current = gameDocument.current.bootstrap;
    if (current && conflict.state) {
      updateCurrentBootstrap(
        applyProgressToBootstrap(
          current,
          conflict.revision,
          conflict.state,
          conflict.stored_content_version,
        ),
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

    const documentGeneration = gameDocument.current.generation;
    const operation = (async () => {
      try {
        const store = await getOfflineStore();
        const statusBefore = await store.getSyncStatus(entry.playerSlotId);
        if (gameDocument.current.generation !== documentGeneration) return;
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
            if (gameDocument.current.generation === documentGeneration)
              deliverConflict(conflict);
          },
          entry.gameSessionId,
        );
        if (gameDocument.current.generation !== documentGeneration) return;
        if (report.conflict) deliverConflict(report.conflict);
        if (report.rejection) {
          gameDocument.current.branchReady = false;
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
              resultAcknowledgementV2Schema.parse({
                type: "portal.result_ack.v2",
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
            activeTimeAcknowledgementV2Schema.parse({
              type: "portal.active_time_ack.v2",
              acknowledged_event_ids: activeTimeIds.slice(offset, offset + 100),
            }),
          );
        }

        if (report.stateAcknowledgements.length > 0 && !report.conflict) {
          const accepted = await store.getBootstrap(entry.playerSlotId);
          if (gameDocument.current.generation !== documentGeneration) return;
          if (accepted) updateCurrentBootstrap(accepted);
        }

        const statusAfter = await store.getSyncStatus(entry.playerSlotId);
        if (gameDocument.current.generation !== documentGeneration) return;
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
        if (gameDocument.current.generation !== documentGeneration) return;
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
      { type: "game.result.v2" | "game.active_time.v2" }
    >,
  ) {
    const documentGeneration = gameDocument.current.generation;
    try {
      const store = await getOfflineStore();
      const requestIds =
        message.type === "game.result.v2"
          ? [message.request_id]
          : message.events.map(({ request_id }) => request_id);
      const acknowledgement =
        message.type === "game.result.v2"
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
      if (gameDocument.current.generation !== documentGeneration) {
        void synchronizeQueue();
        return;
      }
      for (const requestId of requestIds) {
        gameDocument.current.savedReplies.set(requestId, acknowledgement);
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
      if (gameDocument.current.generation !== documentGeneration) return;
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

  async function bootstrapDemo(documentGeneration: number) {
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
      documentGeneration,
    );
  }

  async function bootstrapServer(documentGeneration: number) {
    const store = await getOfflineStore();
    if (gameDocument.current.generation !== documentGeneration) return;
    const bootstrapGeneration = await store.reserveBootstrapGeneration(
      entry.playerSlotId,
    );
    const cached = await store.getBootstrap(entry.playerSlotId);
    if (gameDocument.current.generation !== documentGeneration) return;
    if (cached) {
      const report = await store.sync(
        entry.playerSlotId,
        getTransport().forSession(cached.class_session_id),
      );
      const status = await store.getSyncStatus(entry.playerSlotId);
      if (gameDocument.current.generation !== documentGeneration) return;
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
      "/api/v2/player/bootstrap",
      {
        request_id: requestId,
      },
      entry.gameSessionId,
    );
    const result = safeParsePlayerBootstrapV2(payload);
    if (gameDocument.current.generation !== documentGeneration) return;

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
    if (gameDocument.current.generation !== documentGeneration) return;
    if (!accepted || accepted.class_session_id !== entry.gameSessionId) {
      throw new OfflineSessionMismatchError();
    }
    installBootstrap(accepted, documentGeneration);
    void synchronizeQueue();
  }

  async function beginBootstrap() {
    if (gameDocument.current.bootstrapStarted) return;
    const documentGeneration = gameDocument.current.generation;
    applyDocumentEvent({ type: "bootstrap-started" });
    setAlert(null);

    try {
      if (runtimeMode === "demo") {
        await bootstrapDemo(documentGeneration);
      } else {
        await bootstrapServer(documentGeneration);
      }
    } catch (error) {
      if (gameDocument.current.generation !== documentGeneration) return;
      gameDocument.current.bootstrapStarted = false;
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

  async function saveDemoState(request: StateSaveRequestV2) {
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
        const reply = stateSaveSuccessV2Schema.parse({
          type: "portal.save_ok.v2",
          request_id: request.request_id,
          revision: result.snapshot.revision,
        });
        const currentBootstrap = gameDocument.current.bootstrap;
        if (currentBootstrap) {
          updateCurrentBootstrap(
            applyProgressToBootstrap(
              currentBootstrap,
              result.snapshot.revision,
              result.snapshot.state,
              DEMO_CONTENT_VERSION,
            ),
          );
        }
        replyToRequest(request.request_id, reply);
        setPhase("playing");
        return;
      }

      const reply = stateSaveConflictV2Schema.parse({
        type: "portal.save_conflict.v2",
        request_id: request.request_id,
        revision: result.snapshot.revision,
        state: result.snapshot.state,
        stored_content_version: DEMO_CONTENT_VERSION,
      });
      updateCurrentBootstrap(
        applyProgressToBootstrap(
          gameDocument.current.bootstrap ??
            newBootstrap(entry.playerSlotId, entry.gameSessionId, {
              status: "valid",
              snapshot: result.snapshot,
            }),
          result.snapshot.revision,
          result.snapshot.state,
          DEMO_CONTENT_VERSION,
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

  async function saveServerState(request: StateSaveRequestV2) {
    const documentGeneration = gameDocument.current.generation;
    try {
      const store = await getOfflineStore();
      const durable = await store.enqueueState(
        entry.playerSlotId,
        request,
        entry.gameSessionId,
      );
      if (gameDocument.current.generation !== documentGeneration) {
        void synchronizeQueue();
        return;
      }
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
      if (gameDocument.current.generation !== documentGeneration) return;
      if (error instanceof OfflineBranchChangedError) {
        gameDocument.current.branchReady = false;
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
    gameDocument.current.savedReplies.set(requestId, reply);
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
        "The host rejected a message that does not match protocol V2.",
      );
      return;
    }

    if (message.type === "game.ready.v2") {
      applyDocumentEvent({ type: "ready" });
      setAlert(null);
      if (!message.supported_protocol_versions.includes(PROTOCOL_VERSION)) {
        setPhase("error");
        setAlert({
          tone: "error",
          message:
            "Esta versão do jogo ainda não pode ser conectada ao acesso da turma.",
        });
        showProtocolError(
          "PROTOCOL_VERSION_UNSUPPORTED",
          "The portal requires protocol version 2.",
        );
        return;
      }
      if (
        !SUPPORTED_STATE_SCHEMA_VERSIONS.some((version) =>
          message.supported_state_schema_versions.includes(version),
        )
      ) {
        setPhase("error");
        setAlert({
          tone: "error",
          message:
            "Esta versão do jogo não reconhece o formato de progresso necessário.",
        });
        showProtocolError(
          "STATE_SCHEMA_VERSION_UNSUPPORTED",
          `The portal requires state schema version ${SUPPORTED_STATE_SCHEMA_VERSIONS.join(", ")}.`,
        );
        return;
      }
      if (pendingConflict.current && runtimeMode === "server") {
        void recoverState();
      } else {
        void beginBootstrap();
      }
      return;
    }

    if (message.type === "game.bootstrap_applied.v2") {
      if (
        !applyDocumentEvent({
          type: "bootstrap-applied",
          requestId: message.request_id,
        })
      )
        return;
      postToGame(
        hostVisibilityV2Schema.parse({
          type: "portal.visibility.v2",
          visible: document.visibilityState === "visible",
          focused: hostHasFocus(frameRef.current),
          online: navigator.onLine,
        }),
      );
      setAlert(null);
      return;
    }

    if (message.type === "game.save.v2") {
      if (!gameDocument.current.branchReady) return;
      const saved = gameDocument.current.savedReplies.get(message.request_id);
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
      message.type === "game.result.v2" ||
      message.type === "game.active_time.v2"
    ) {
      if (!gameDocument.current.branchReady) return;
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

    if (message.type === "protocol.error.v2") {
      gameDocument.current.branchReady = false;
      const recovery = contentErrorRecovery(
        message.code,
        upgradeRetried.current,
      );
      if (recovery) {
        setAlert({
          tone: recovery.reload ? "warning" : "error",
          message: recovery.message,
        });
        if (recovery.reload) {
          upgradeRetried.current = true;
          remountFrame();
        } else {
          setPhase("error");
          setContentFailure(recovery.message);
        }
        return;
      }
      setPhase("error");
      setAlert({
        tone: "error",
        message:
          "O jogo encontrou um problema de integração. Escaneie o QR novamente ou peça ajuda ao profissional.",
      });
    }
  }

  receiveRef.current = receiveGameMessage;
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
      // WindowProxy can survive navigation. Ready resets the document and
      // bootstrap receipts are also checked against its current request ID.
      receiveRef.current(event.data);
    }

    function sendVisibility() {
      const target = frameRef.current?.contentWindow;
      if (!target) return;
      const visibility = hostVisibilityV2Schema.parse({
        type: "portal.visibility.v2",
        visible: document.visibilityState === "visible",
        focused: hostHasFocus(frameRef.current),
        online: navigator.onLine,
      });
      target.postMessage(visibility, targetOrigin);
    }

    // A tap inside the game moves focus from this page into the iframe, and
    // the page's blur fires before that move settles: Firefox still reports
    // no focus there, and no later event would ever un-pause the game.
    let blurTimer: number | undefined;
    function sendVisibilityAfterBlur() {
      window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(sendVisibility, 50);
    }

    function reconnectAndSync() {
      scheduler.reset();
      sendVisibility();
      synchronizeRef.current();
    }

    window.addEventListener("message", onWindowMessage);
    window.addEventListener("focus", sendVisibility);
    window.addEventListener("blur", sendVisibilityAfterBlur);
    window.addEventListener("online", reconnectAndSync);
    window.addEventListener("offline", sendVisibility);
    document.addEventListener("visibilitychange", sendVisibility);

    return () => {
      scheduler.reset();
      retryScheduler.current = null;
      window.clearTimeout(blurTimer);
      window.removeEventListener("message", onWindowMessage);
      window.removeEventListener("focus", sendVisibility);
      window.removeEventListener("blur", sendVisibilityAfterBlur);
      window.removeEventListener("online", reconnectAndSync);
      window.removeEventListener("offline", sendVisibility);
      document.removeEventListener("visibilitychange", sendVisibility);
    };
  }, [gameOrigin, runtimeMode]);

  useEffect(() => {
    if (phase !== "waiting" || runtimeMode !== "server") return;

    const timeout = window.setTimeout(() => {
      if (gameDocument.current.bootstrapStarted) return;
      setAlert({
        tone: "warning",
        message:
          "O jogo ainda não respondeu. Confira a conexão ou peça ajuda ao profissional.",
      });
    }, 12_000);
    return () => window.clearTimeout(timeout);
  }, [phase, runtimeMode]);

  function handleFrameLoad() {
    applyDocumentEvent({ type: "load" });
  }

  async function recoverState() {
    if (recovering) return;
    const documentGeneration = gameDocument.current.generation;
    setRecovering(true);
    gameDocument.current.branchReady = false;
    try {
      await syncPromise.current;
      if (gameDocument.current.generation !== documentGeneration) return;
      const requestId = pendingConflict.current ?? recoveryRequest;
      if (requestId) {
        const store = await getOfflineStore();
        if (gameDocument.current.generation !== documentGeneration) return;
        await store.discardConflictedStateBranch(entry.playerSlotId, requestId);
      }
      if (gameDocument.current.generation !== documentGeneration) return;
      setRecoveryRequest(null);
      setReloadRequired(false);
      pendingConflict.current = null;
      // A running game accepts only one bootstrap; wait for the new ready.
      remountFrame();
    } catch {
      if (gameDocument.current.generation !== documentGeneration) return;
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
        frameGeneration={frameGeneration}
        contentFailure={contentFailure}
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
