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
  type ActiveTimeBatchV1,
  type ResultEventV1,
  type PlayerBootstrapV1,
  type ProtocolErrorV1,
  type StateSaveConflictV1,
  type StateSaveRequestV1,
} from "@/contracts/v1";
import type { PlayerEntryActionResult } from "@/application/player-access/types";
import { resolvePlayerEntryAction } from "@/runtime/actions";
import type { RuntimeMode } from "@/runtime/mode";
import { OfflineSessionMismatchError } from "@/runtime/offline/errors";
import {
  openGameOfflineStore,
  type GameOfflineStore,
} from "@/runtime/offline/sync-engine";
import type { GameOfflineTransport } from "@/runtime/offline/types";
import {
  createBridgeRequestId,
  expectedGameOrigin,
  isTrustedGameMessage,
  parseGameBridgeMessage,
} from "./game-bridge";
import {
  hasUsableLaunchToken,
  LAUNCH_TOKEN_RENEWAL_LEAD_MS,
  retryAfterUnauthorized,
} from "./game-host-token";
import { readDemoGameSnapshot, saveDemoGameState } from "./demo-game-state";
import {
  applyProgressToBootstrap,
  demoStorageKey,
  errorMessageForEntry,
  newBootstrap,
  readResponseJson,
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
  const launchRef = useRef({
    token: entry.launchToken,
    expiresAt: Date.parse(entry.expiresAt),
  });
  const bootstrapStarted = useRef(false);
  const bootstrapRef = useRef<PlayerBootstrapV1 | null>(null);
  const inFlightSaves = useRef(new Set<string>());
  const savedReplies = useRef(new Map<string, unknown>());
  const handledConflicts = useRef(new Set<string>());
  const pendingConflict = useRef<string | null>(null);
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

  async function validLaunchToken(
    forceRefresh = false,
    allowNearExpiry = false,
  ): Promise<string> {
    const current = launchRef.current;
    if (
      !forceRefresh &&
      hasUsableLaunchToken(
        current.expiresAt,
        Date.now(),
        allowNearExpiry ? 0 : LAUNCH_TOKEN_RENEWAL_LEAD_MS,
      )
    ) {
      return current.token;
    }

    const refreshed = await resolvePlayerEntryAction(credential);
    if (refreshed.state !== "ready") {
      throw new Error(errorMessageForEntry(refreshed));
    }

    launchRef.current = {
      token: refreshed.launchToken,
      expiresAt: Date.parse(refreshed.expiresAt),
    };
    return refreshed.launchToken;
  }

  async function postWithFreshBearer(
    path: string,
    body: unknown,
    allowNearExpiry = false,
  ): Promise<Response> {
    const token = await validLaunchToken(false, allowNearExpiry);
    const send = (accessToken: string) =>
      fetch(path, {
        method: "POST",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

    const response = await send(token);
    return retryAfterUnauthorized(response, send, () => validLaunchToken(true));
  }

  function getOfflineStore(): Promise<GameOfflineStore> {
    offlineStorePromise.current ??= openGameOfflineStore();
    return offlineStorePromise.current;
  }

  function installBootstrap(value: PlayerBootstrapV1) {
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

        const transport: GameOfflineTransport = {
          saveState: async (request) =>
            readResponseJson(
              await postWithFreshBearer("/api/v1/player/state", request),
            ),
          uploadResult: async (event: ResultEventV1) =>
            readResponseJson(
              await postWithFreshBearer("/api/v1/player/results", event, true),
            ),
          uploadActiveTime: async (batch: ActiveTimeBatchV1) =>
            readResponseJson(
              await postWithFreshBearer(
                "/api/v1/player/active-time",
                batch,
                true,
              ),
            ),
        };

        const report = await store.sync(
          entry.playerSlotId,
          transport,
          (conflict) => {
            deliverConflict(conflict);
          },
          entry.gameSessionId,
        );
        if (report.conflict) deliverConflict(report.conflict);

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

        if (report.state === "pending" && pendingAfter > 0) {
          setAlert({
            tone: "warning",
            message:
              "Alguns registros estão guardados neste dispositivo e serão enviados quando a conexão voltar.",
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
    const requestId = createBridgeRequestId();
    const response = await postWithFreshBearer("/api/v1/player/bootstrap", {
      request_id: requestId,
    });
    const payload = await readResponseJson(response);
    const result = safeParsePlayerBootstrapV1(payload);

    if (!response.ok || !result.success) {
      if (response.status === 401) {
        throw new Error(
          "O acesso temporário terminou. Escaneie o QR novamente.",
        );
      }
      if (response.status === 409) {
        throw new Error("A sessão da turma não está mais ativa.");
      }
      throw new Error("Não foi possível carregar o progresso do jogador.");
    }

    if (
      result.data.player_id !== entry.playerSlotId ||
      result.data.class_session_id !== entry.gameSessionId
    ) {
      throw new Error("O contexto recebido não corresponde a este jogador.");
    }

    const cached = await store.cacheBootstrap(result.data, bootstrapGeneration);
    if (!cached || cached.class_session_id !== entry.gameSessionId) {
      throw new OfflineSessionMismatchError();
    }
    installBootstrap(cached);
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
              : "Não foi possível preparar o jogo. Peça ajuda ao professor.",
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
      setPhase("error");
      setAlert({
        tone: "error",
        message:
          error instanceof OfflineSessionMismatchError
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
          "O jogo enviou uma mensagem incompatível. Peça ajuda ao professor.",
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
            await store.discardConflictedStateBranch(entry.playerSlotId);
            const authoritative = await store.getBootstrap(entry.playerSlotId);
            if (authoritative) updateCurrentBootstrap(authoritative);
            setPhase("playing");
            setSyncState("pending");
            setAlert(null);
            await synchronizeQueue();
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
      setPhase("playing");
      setAlert(null);
      return;
    }

    if (message.type === "game.save.v1") {
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
          "O jogo encontrou um problema de integração. Escaneie o QR novamente ou peça ajuda ao professor.",
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
          "O jogo ainda não respondeu. Confira a conexão ou peça ajuda ao professor.",
      });
    }, 12_000);
    return () => window.clearTimeout(timeout);
  }, [phase, runtimeMode]);

  function handleFrameLoad() {
    bootstrapStarted.current = false;
    setBootstrap(null);
    bootstrapRef.current = null;
    setPhase("waiting");
    setAlert(null);
  }

  return (
    <section className={styles.gameHost} aria-label="Entrada do jogo">
      <GameHostHeader
        phase={phase}
        playerNumber={entry.playerNumber}
        runtimeMode={runtimeMode}
      />
      {alert && <GameHostAlert alert={alert} />}
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
