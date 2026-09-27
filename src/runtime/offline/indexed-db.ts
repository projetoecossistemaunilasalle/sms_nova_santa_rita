import {
  parseStateSaveRequestV1,
  type PlayerBootstrapV1,
  type ResultEventV1,
  type StateSaveConflictV1,
  type StateSaveRequestV1,
  type StateSaveSuccessV1,
} from "@/contracts/v1";

import { sameJson, stableJson } from "./canonical";
import {
  OfflineBootstrapMissingError,
  OfflineRequestReuseError,
  OfflineSessionMismatchError,
  OfflineStateBlockedError,
} from "./errors";
import type {
  EventRequestIdentity,
  EventRequestReceipt,
  GameOfflinePersistence,
  GameOfflineSyncStatus,
  QueuedActiveTime,
  QueuedEvent,
  QueuedResult,
  QueuedStateSave,
} from "./types";

const DATABASE_NAME = "missoes-caramelito-game-v1";
const DATABASE_VERSION = 3;
const BOOTSTRAP_STORE = "bootstraps";
const STATE_QUEUE_STORE = "stateQueue";
const EVENT_QUEUE_STORE = "eventQueue";
const EVENT_REQUEST_STORE = "eventRequests";
const CONTROL_STORE = "controls";

type StoredBootstrap = {
  playerId: string;
  bootstrap?: PlayerBootstrapV1;
  generation?: number;
};
type StoredControl = { playerId: string; conflict: StateSaveConflictV1 | null };
type StoredEventRequest = {
  playerId: string;
  classSessionId: string;
  kind: QueuedEvent["kind"];
  requestId: string;
  clientEventId: string;
  fingerprint: string;
};
type NewQueuedState = Omit<QueuedStateSave, "id">;
type NewQueuedResult = Omit<QueuedResult, "id">;
type NewQueuedActiveTime = Omit<QueuedActiveTime, "id">;

export function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BOOTSTRAP_STORE)) {
        db.createObjectStore(BOOTSTRAP_STORE, { keyPath: "playerId" });
      }
      if (!db.objectStoreNames.contains(STATE_QUEUE_STORE)) {
        const states = db.createObjectStore(STATE_QUEUE_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        states.createIndex("byPlayer", "playerId");
        states.createIndex("byPlayerRequest", ["playerId", "requestId"], {
          unique: true,
        });
      }
      if (!db.objectStoreNames.contains(EVENT_QUEUE_STORE)) {
        const events = db.createObjectStore(EVENT_QUEUE_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        events.createIndex("byPlayer", "playerId");
        events.createIndex(
          "byPlayerSessionKindRequest",
          ["playerId", "classSessionId", "kind", "requestId"],
          { unique: true },
        );
      }
      if (!db.objectStoreNames.contains(EVENT_REQUEST_STORE)) {
        db.createObjectStore(EVENT_REQUEST_STORE, {
          keyPath: ["playerId", "classSessionId", "kind", "requestId"],
        });
      }
      if (!db.objectStoreNames.contains(CONTROL_STORE)) {
        db.createObjectStore(CONTROL_STORE, { keyPath: "playerId" });
      }
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      reject(request.error ?? new Error("Could not open the offline database"));
    };
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(
        new Error("Offline database upgrade is blocked by another open tab"),
      );
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      if (settled) {
        db.close();
        return;
      }
      settled = true;
      resolve(db);
    };
  });
}

export class IndexedDbGameOfflinePersistence implements GameOfflinePersistence {
  constructor(private readonly db: IDBDatabase) {}

  close(): void {
    this.db.close();
  }

  async getBootstrap(playerId: string): Promise<PlayerBootstrapV1 | null> {
    const stored = await this.read<StoredBootstrap | undefined>(
      BOOTSTRAP_STORE,
      (store, succeed, fail) => {
        const request = store.get(playerId);
        request.onsuccess = () =>
          succeed(request.result as StoredBootstrap | undefined);
        request.onerror = () => fail(request.error);
      },
    );
    return stored?.bootstrap ?? null;
  }

  reserveBootstrapGeneration(playerId: string): Promise<number> {
    return this.write<number>(
      [BOOTSTRAP_STORE],
      (transaction, succeed, fail) => {
        const store = transaction.objectStore(BOOTSTRAP_STORE);
        const request = store.get(playerId);
        request.onsuccess = () => {
          const existing = request.result as StoredBootstrap | undefined;
          const generation = (existing?.generation ?? 0) + 1;
          const put = store.put({
            ...existing,
            playerId,
            generation,
          } satisfies StoredBootstrap);
          put.onsuccess = () => succeed(generation);
          put.onerror = () => fail(put.error);
        };
        request.onerror = () => fail(request.error);
      },
    );
  }

  cacheBootstrap(
    bootstrap: PlayerBootstrapV1,
    generation: number,
  ): Promise<PlayerBootstrapV1 | null> {
    return this.write<PlayerBootstrapV1 | null>(
      [BOOTSTRAP_STORE],
      (transaction, succeed, fail) => {
        const store = transaction.objectStore(BOOTSTRAP_STORE);
        const request = store.get(bootstrap.player_id);
        request.onsuccess = () => {
          const existing = request.result as StoredBootstrap | undefined;
          const latestGeneration = existing?.generation ?? 0;
          if (generation < latestGeneration) {
            succeed(existing?.bootstrap ?? null);
            return;
          }
          if (
            existing?.bootstrap &&
            existing.bootstrap.class_session_id ===
              bootstrap.class_session_id &&
            existing.bootstrap.revision > bootstrap.revision
          ) {
            const put = store.put({
              ...existing,
              generation,
            } satisfies StoredBootstrap);
            put.onsuccess = () => succeed(existing.bootstrap!);
            put.onerror = () => fail(put.error);
            return;
          }
          if (
            existing?.bootstrap &&
            existing.bootstrap.class_session_id !==
              bootstrap.class_session_id &&
            existing.bootstrap.revision > bootstrap.revision
          ) {
            succeed(existing.bootstrap);
            return;
          }
          const put = store.put({
            playerId: bootstrap.player_id,
            bootstrap,
            generation,
          } satisfies StoredBootstrap);
          put.onsuccess = () => succeed(bootstrap);
          put.onerror = () => fail(put.error);
        };
        request.onerror = () => fail(request.error);
      },
    );
  }

  async enqueueState(
    playerId: string,
    request: StateSaveRequestV1,
    classSessionId?: string,
  ): Promise<QueuedStateSave> {
    return this.write(
      [BOOTSTRAP_STORE, STATE_QUEUE_STORE, CONTROL_STORE],
      (transaction, succeed, fail) => {
        const bootstrapRequest = transaction
          .objectStore(BOOTSTRAP_STORE)
          .get(playerId);
        const controlRequest = transaction
          .objectStore(CONTROL_STORE)
          .get(playerId);
        const stateStore = transaction.objectStore(STATE_QUEUE_STORE);
        const listRequest = stateStore.index("byPlayer").getAll(playerId);
        let bootstrap: StoredBootstrap | undefined;
        let control: StoredControl | undefined;
        let states: QueuedStateSave[] | undefined;
        let bootstrapReady = false;
        let controlReady = false;
        let statesReady = false;
        let started = false;
        const enqueueWhenReady = () => {
          if (started || !bootstrapReady || !controlReady || !statesReady)
            return;
          started = true;
          if (!bootstrap?.bootstrap)
            return fail(new OfflineBootstrapMissingError());
          if (
            classSessionId &&
            bootstrap.bootstrap.class_session_id !== classSessionId
          ) {
            return fail(new OfflineSessionMismatchError());
          }
          const queuedStates = states as QueuedStateSave[];
          const existing = queuedStates.find(
            (item) => item.request.request_id === request.request_id,
          );
          if (existing) {
            if (!sameJson(existing.request.state, request.state))
              return fail(new OfflineRequestReuseError());
            succeed(existing);
            return;
          }
          if (control?.conflict) return fail(new OfflineStateBlockedError());
          const normalized = parseStateSaveRequestV1({
            ...request,
            expected_revision:
              bootstrap.bootstrap.revision + queuedStates.length,
          });
          const record: NewQueuedState = {
            playerId,
            requestId: normalized.request_id,
            request: normalized,
            queuedAt: Date.now(),
          };
          const add = stateStore.add(record);
          add.onsuccess = () => succeed({ ...record, id: Number(add.result) });
          add.onerror = () => fail(add.error);
        };
        bootstrapRequest.onsuccess = () => {
          bootstrap = bootstrapRequest.result as StoredBootstrap | undefined;
          bootstrapReady = true;
          enqueueWhenReady();
        };
        controlRequest.onsuccess = () => {
          control = controlRequest.result as StoredControl | undefined;
          controlReady = true;
          enqueueWhenReady();
        };
        listRequest.onsuccess = () => {
          states = listRequest.result as QueuedStateSave[];
          statesReady = true;
          enqueueWhenReady();
        };
        for (const readRequest of [
          bootstrapRequest,
          controlRequest,
          listRequest,
        ]) {
          readRequest.onerror = () => fail(readRequest.error);
        }
      },
    );
  }

  listStates(playerId: string): Promise<QueuedStateSave[]> {
    return this.read<QueuedStateSave[]>(
      STATE_QUEUE_STORE,
      (store, succeed, fail) => {
        const request = store.index("byPlayer").getAll(playerId);
        request.onsuccess = () =>
          succeed(
            (request.result as QueuedStateSave[]).sort((a, b) => a.id - b.id),
          );
        request.onerror = () => fail(request.error);
      },
    );
  }

  async acknowledgeState(
    playerId: string,
    queued: QueuedStateSave,
    success: StateSaveSuccessV1,
  ): Promise<void> {
    await this.write(
      [BOOTSTRAP_STORE, STATE_QUEUE_STORE],
      (transaction, succeed, fail) => {
        const bootstrapStore = transaction.objectStore(BOOTSTRAP_STORE);
        const get = bootstrapStore.get(playerId);
        get.onsuccess = () => {
          const stored = get.result as StoredBootstrap | undefined;
          if (
            stored?.bootstrap &&
            stored.bootstrap.revision <= success.revision
          ) {
            const next: PlayerBootstrapV1 = {
              type: "portal.bootstrap.v1",
              request_id: queued.request.request_id,
              protocol_version: stored.bootstrap.protocol_version,
              player_id: stored.bootstrap.player_id,
              class_session_id: stored.bootstrap.class_session_id,
              revision: success.revision,
              new_player: false,
              state: queued.request.state,
            };
            const put = bootstrapStore.put({
              ...stored,
              playerId,
              bootstrap: next,
            } satisfies StoredBootstrap);
            put.onerror = () => fail(put.error);
          }
          const remove = transaction
            .objectStore(STATE_QUEUE_STORE)
            .delete(queued.id);
          remove.onsuccess = () => succeed(undefined);
          remove.onerror = () => fail(remove.error);
        };
        get.onerror = () => fail(get.error);
      },
    );
  }

  async blockState(
    playerId: string,
    conflict: StateSaveConflictV1,
  ): Promise<void> {
    await this.write(
      [BOOTSTRAP_STORE, CONTROL_STORE],
      (transaction, succeed, fail) => {
        const bootstrapStore = transaction.objectStore(BOOTSTRAP_STORE);
        const get = bootstrapStore.get(playerId);
        get.onsuccess = () => {
          const existing = get.result as StoredBootstrap | undefined;
          if (
            !existing?.bootstrap ||
            conflict.revision >= existing.bootstrap.revision
          ) {
            if (!existing?.bootstrap)
              return fail(new OfflineBootstrapMissingError());
            const next: PlayerBootstrapV1 = {
              type: "portal.bootstrap.v1",
              request_id: conflict.request_id,
              protocol_version: existing.bootstrap.protocol_version,
              player_id: existing.bootstrap.player_id,
              class_session_id: existing.bootstrap.class_session_id,
              revision: conflict.revision,
              new_player: false,
              state: conflict.state,
            };
            const put = bootstrapStore.put({
              ...existing,
              playerId,
              bootstrap: next,
            } satisfies StoredBootstrap);
            put.onerror = () => fail(put.error);
          }
          const control = transaction
            .objectStore(CONTROL_STORE)
            .put({ playerId, conflict } satisfies StoredControl);
          control.onsuccess = () => succeed(undefined);
          control.onerror = () => fail(control.error);
        };
        get.onerror = () => fail(get.error);
      },
    );
  }

  getStateConflict(playerId: string): Promise<StateSaveConflictV1 | null> {
    return this.read<StoredControl | undefined>(
      CONTROL_STORE,
      (store, succeed, fail) => {
        const request = store.get(playerId);
        request.onsuccess = () =>
          succeed(request.result as StoredControl | undefined);
        request.onerror = () => fail(request.error);
      },
    ).then((control) => control?.conflict ?? null);
  }

  async discardStateBranch(playerId: string): Promise<void> {
    await this.write(
      [STATE_QUEUE_STORE, CONTROL_STORE],
      (transaction, succeed, fail) => {
        const stateStore = transaction.objectStore(STATE_QUEUE_STORE);
        const request = stateStore.index("byPlayer").getAllKeys(playerId);
        request.onsuccess = () => {
          for (const key of request.result) stateStore.delete(key);
          const control = transaction
            .objectStore(CONTROL_STORE)
            .put({ playerId, conflict: null } satisfies StoredControl);
          control.onsuccess = () => succeed(undefined);
          control.onerror = () => fail(control.error);
        };
        request.onerror = () => fail(request.error);
      },
    );
  }

  enqueueResult(
    playerId: string,
    classSessionId: string,
    event: ResultEventV1,
    identity: EventRequestIdentity,
  ): Promise<EventRequestReceipt> {
    const record: NewQueuedResult = {
      playerId,
      classSessionId,
      kind: "result",
      requestId: event.request_id,
      event,
      queuedAt: Date.now(),
    };
    return this.enqueueEvent(record, identity);
  }

  enqueueActiveTime(
    playerId: string,
    classSessionId: string,
    event: QueuedActiveTime["event"],
    identity: EventRequestIdentity,
  ): Promise<EventRequestReceipt> {
    const record: NewQueuedActiveTime = {
      playerId,
      classSessionId,
      kind: "active_time",
      requestId: event.request_id,
      event,
      queuedAt: Date.now(),
    };
    return this.enqueueEvent(record, identity);
  }

  private enqueueEvent(
    record: NewQueuedResult,
    identity: EventRequestIdentity,
  ): Promise<EventRequestReceipt>;
  private enqueueEvent(
    record: NewQueuedActiveTime,
    identity: EventRequestIdentity,
  ): Promise<EventRequestReceipt>;
  private enqueueEvent(
    record: NewQueuedResult | NewQueuedActiveTime,
    identity: EventRequestIdentity,
  ): Promise<EventRequestReceipt> {
    return this.write<EventRequestReceipt>(
      [EVENT_QUEUE_STORE, EVENT_REQUEST_STORE],
      (transaction, succeed, fail) => {
        const store = transaction.objectStore(EVENT_QUEUE_STORE);
        const registry = transaction.objectStore(EVENT_REQUEST_STORE);
        const key = [
          record.playerId,
          record.classSessionId,
          record.kind,
          record.requestId,
        ];
        const request = registry.get(key);
        request.onsuccess = () => {
          const existing = request.result as StoredEventRequest | undefined;
          if (existing) {
            if (existing.fingerprint !== identity.fingerprint)
              return fail(new OfflineRequestReuseError());
            succeed({
              requestId: record.requestId,
              clientEventId: existing.clientEventId,
            });
            return;
          }

          // Preserve pending rows created before the request registry was added.
          const pendingRequest = store
            .index("byPlayerSessionKindRequest")
            .get([
              record.playerId,
              record.classSessionId,
              record.kind,
              record.requestId,
            ]);
          pendingRequest.onsuccess = () => {
            const pending = pendingRequest.result as QueuedEvent | undefined;
            if (pending) {
              const pendingContent = stableJson(
                Object.fromEntries(
                  Object.entries(pending.event).filter(
                    ([field]) => field !== "client_event_id",
                  ),
                ),
              );
              if (
                pending.kind !== record.kind ||
                pendingContent !== identity.canonicalContent
              ) {
                return fail(new OfflineRequestReuseError());
              }
              const saveLegacy = registry.add({
                playerId: record.playerId,
                classSessionId: record.classSessionId,
                kind: record.kind,
                requestId: record.requestId,
                clientEventId: pending.event.client_event_id,
                fingerprint: identity.fingerprint,
              } satisfies StoredEventRequest);
              saveLegacy.onsuccess = () =>
                succeed({
                  requestId: record.requestId,
                  clientEventId: pending.event.client_event_id,
                });
              saveLegacy.onerror = () => fail(saveLegacy.error);
              return;
            }

            const add = store.add(record);
            add.onsuccess = () => {
              const saveRequest = registry.add({
                playerId: record.playerId,
                classSessionId: record.classSessionId,
                kind: record.kind,
                requestId: record.requestId,
                clientEventId: record.event.client_event_id,
                fingerprint: identity.fingerprint,
              } satisfies StoredEventRequest);
              saveRequest.onsuccess = () =>
                succeed({
                  requestId: record.requestId,
                  clientEventId: record.event.client_event_id,
                });
              saveRequest.onerror = () => fail(saveRequest.error);
            };
            add.onerror = () => fail(add.error);
          };
          pendingRequest.onerror = () => fail(pendingRequest.error);
        };
        request.onerror = () => fail(request.error);
      },
    );
  }

  listEvents(playerId: string, classSessionId: string): Promise<QueuedEvent[]> {
    return this.read<QueuedEvent[]>(
      EVENT_QUEUE_STORE,
      (store, succeed, fail) => {
        const request = store.index("byPlayer").getAll(playerId);
        request.onsuccess = () =>
          succeed(
            (request.result as QueuedEvent[])
              .filter((event) => event.classSessionId === classSessionId)
              .sort((a, b) => a.id - b.id),
          );
        request.onerror = () => fail(request.error);
      },
    );
  }

  async acknowledgeEvent(queued: QueuedEvent): Promise<void> {
    await this.write([EVENT_QUEUE_STORE], (transaction, succeed, fail) => {
      const request = transaction
        .objectStore(EVENT_QUEUE_STORE)
        .delete(queued.id);
      request.onsuccess = () => succeed(undefined);
      request.onerror = () => fail(request.error);
    });
  }

  async status(playerId: string): Promise<GameOfflineSyncStatus> {
    const [states, events, conflict] = await Promise.all([
      this.listStates(playerId),
      this.read<QueuedEvent[]>(EVENT_QUEUE_STORE, (store, succeed, fail) => {
        const request = store.index("byPlayer").getAll(playerId);
        request.onsuccess = () => succeed(request.result as QueuedEvent[]);
        request.onerror = () => fail(request.error);
      }),
      this.getStateConflict(playerId),
    ]);
    return {
      queuedStates: states.length,
      queuedResults: events.filter((event) => event.kind === "result").length,
      queuedActiveTime: events.filter((event) => event.kind === "active_time")
        .length,
      stateBlocked: Boolean(conflict),
    };
  }

  private read<T>(
    storeName: string,
    run: (
      store: IDBObjectStore,
      succeed: (value: T) => void,
      fail: (error: unknown) => void,
    ) => void,
  ): Promise<T> {
    return this.transact(
      [storeName],
      "readonly",
      (transaction, succeed, fail) =>
        run(transaction.objectStore(storeName), succeed, fail),
    );
  }

  private write<T>(
    storeNames: string[],
    run: (
      transaction: IDBTransaction,
      succeed: (value: T) => void,
      fail: (error: unknown) => void,
    ) => void,
  ): Promise<T> {
    return this.transact(storeNames, "readwrite", run);
  }

  private transact<T>(
    storeNames: string[],
    mode: IDBTransactionMode,
    run: (
      transaction: IDBTransaction,
      succeed: (value: T) => void,
      fail: (error: unknown) => void,
    ) => void,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeNames, mode);
      let value: T;
      let hasValue = false;
      let settled = false;
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        try {
          transaction.abort();
        } catch {
          /* The transaction may already be inactive. */
        }
        reject(
          error instanceof Error
            ? error
            : new Error("IndexedDB transaction failed"),
        );
      };
      const succeed = (result: T) => {
        value = result;
        hasValue = true;
      };
      transaction.oncomplete = () => {
        if (settled) return;
        settled = true;
        if (!hasValue)
          reject(new Error("IndexedDB transaction completed without a result"));
        else resolve(value);
      };
      transaction.onabort = () =>
        fail(transaction.error ?? new Error("IndexedDB transaction aborted"));
      transaction.onerror = () =>
        fail(transaction.error ?? new Error("IndexedDB transaction failed"));
      try {
        run(transaction, succeed, fail);
      } catch (error) {
        fail(error);
      }
    });
  }
}
