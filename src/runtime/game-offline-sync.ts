import {
  activeTimeAcknowledgementV1Schema,
  activeTimeBatchV1Schema,
  activeTimeSubmissionV1Schema,
  parsePlayerBootstrapV1,
  parseResultAcknowledgementV1,
  parseResultEventV1,
  parseResultSubmissionV1,
  parseStateSaveRequestV1,
  parseStateSaveSuccessV1,
  type ActiveTimeBatchV1,
  type ActiveTimeSubmissionV1,
  type LocalDurabilityAcknowledgementV1,
  type PlayerBootstrapV1,
  type ResultEventV1,
  type ResultSubmissionV1,
  type StateSaveConflictV1,
  type StateSaveRequestV1,
  type StateSaveSuccessV1,
  stateSaveConflictV1Schema,
} from "@/contracts/v1";

const DATABASE_NAME = "missoes-caramelito-game-v1";
const DATABASE_VERSION = 3;
const BOOTSTRAP_STORE = "bootstraps";
const STATE_QUEUE_STORE = "stateQueue";
const EVENT_QUEUE_STORE = "eventQueue";
const EVENT_REQUEST_STORE = "eventRequests";
const CONTROL_STORE = "controls";

export type QueuedStateSave = {
  id: number;
  playerId: string;
  requestId: string;
  request: StateSaveRequestV1;
  queuedAt: number;
};

export type QueuedResult = {
  id: number;
  playerId: string;
  classSessionId: string;
  kind: "result";
  requestId: string;
  event: ResultEventV1;
  queuedAt: number;
};

export type QueuedActiveTime = {
  id: number;
  playerId: string;
  classSessionId: string;
  kind: "active_time";
  requestId: string;
  event: ActiveTimeBatchV1["events"][number];
  queuedAt: number;
};

export type QueuedEvent = QueuedResult | QueuedActiveTime;

export type EventRequestReceipt = {
  requestId: string;
  clientEventId: string;
};

export type EventRequestIdentity = {
  canonicalContent: string;
  fingerprint: string;
};

export type GameOfflineSyncStatus = {
  queuedStates: number;
  queuedResults: number;
  queuedActiveTime: number;
  stateBlocked: boolean;
};

export type GameOfflineSyncReport = {
  state: "synced" | "pending" | "blocked";
  savedStates: number;
  uploadedResults: number;
  uploadedActiveTimeEvents: number;
  stateAcknowledgements: StateSaveSuccessV1[];
  eventAcknowledgements: Array<{
    record_type: "result" | "active_time";
    request_id: string;
    client_event_id: string;
  }>;
  conflict?: StateSaveConflictV1;
  failedStream?: "state" | "events";
};

export type GameOfflineTransport = {
  saveState(request: StateSaveRequestV1): Promise<unknown>;
  uploadResult(event: ResultEventV1): Promise<unknown>;
  uploadActiveTime(batch: ActiveTimeBatchV1): Promise<unknown>;
};

export interface GameOfflinePersistence {
  close?(): void;
  getBootstrap(playerId: string): Promise<PlayerBootstrapV1 | null>;
  reserveBootstrapGeneration(playerId: string): Promise<number>;
  cacheBootstrap(
    bootstrap: PlayerBootstrapV1,
    generation: number,
  ): Promise<PlayerBootstrapV1 | null>;
  enqueueState(
    playerId: string,
    request: StateSaveRequestV1,
    classSessionId?: string,
  ): Promise<QueuedStateSave>;
  listStates(playerId: string): Promise<QueuedStateSave[]>;
  acknowledgeState(
    playerId: string,
    queued: QueuedStateSave,
    success: StateSaveSuccessV1,
  ): Promise<void>;
  blockState(playerId: string, conflict: StateSaveConflictV1): Promise<void>;
  getStateConflict(playerId: string): Promise<StateSaveConflictV1 | null>;
  discardStateBranch(playerId: string): Promise<void>;
  enqueueResult(
    playerId: string,
    classSessionId: string,
    event: ResultEventV1,
    identity: EventRequestIdentity,
  ): Promise<EventRequestReceipt>;
  enqueueActiveTime(
    playerId: string,
    classSessionId: string,
    event: QueuedActiveTime["event"],
    identity: EventRequestIdentity,
  ): Promise<EventRequestReceipt>;
  listEvents(playerId: string, classSessionId: string): Promise<QueuedEvent[]>;
  acknowledgeEvent(queued: QueuedEvent): Promise<void>;
  status(playerId: string): Promise<GameOfflineSyncStatus>;
}

export class OfflineStateBlockedError extends Error {
  constructor() {
    super(
      "State synchronization is blocked until GameMaker resolves the server conflict",
    );
    this.name = "OfflineStateBlockedError";
  }
}

export class OfflineBootstrapMissingError extends Error {
  constructor() {
    super(
      "An online player bootstrap is required before using the offline queue",
    );
    this.name = "OfflineBootstrapMissingError";
  }
}

export class OfflineRequestReuseError extends Error {
  constructor() {
    super("A bridge request_id was reused with a different payload");
    this.name = "OfflineRequestReuseError";
  }
}

export class OfflineSessionMismatchError extends Error {
  constructor() {
    super("Cached player session does not match the active launch session");
    this.name = "OfflineSessionMismatchError";
  }
}

export class GameOfflineStore {
  constructor(
    private readonly persistence: GameOfflinePersistence,
    private readonly createEventId: () => string = createClientEventId,
  ) {}

  close(): void {
    this.persistence.close?.();
  }

  async cacheBootstrap(
    input: PlayerBootstrapV1,
    generation?: number,
  ): Promise<PlayerBootstrapV1 | null> {
    const bootstrap = parsePlayerBootstrapV1(input);
    const reservedGeneration =
      generation ??
      (await this.persistence.reserveBootstrapGeneration(bootstrap.player_id));
    return this.persistence.cacheBootstrap(bootstrap, reservedGeneration);
  }

  reserveBootstrapGeneration(playerId: string): Promise<number> {
    return this.persistence.reserveBootstrapGeneration(playerId);
  }

  getBootstrap(playerId: string): Promise<PlayerBootstrapV1 | null> {
    return this.persistence.getBootstrap(playerId);
  }

  async getNextExpectedRevision(playerId: string): Promise<number> {
    if (await this.persistence.getStateConflict(playerId)) {
      throw new OfflineStateBlockedError();
    }
    const bootstrap = await this.persistence.getBootstrap(playerId);
    if (!bootstrap) throw new OfflineBootstrapMissingError();
    const queue = await this.persistence.listStates(playerId);
    return bootstrap.revision + queue.length;
  }

  async enqueueState(
    playerId: string,
    input: StateSaveRequestV1,
    classSessionId?: string,
  ): Promise<LocalDurabilityAcknowledgementV1> {
    const request = parseStateSaveRequestV1(input);
    const queued = await this.persistence.enqueueState(
      playerId,
      request,
      classSessionId,
    );
    return {
      type: "portal.local_durable.v1",
      record_type: "state",
      request_id: queued.request.request_id,
    };
  }

  async enqueueResult(
    playerId: string,
    input: ResultSubmissionV1,
    classSessionId?: string,
  ): Promise<LocalDurabilityAcknowledgementV1> {
    const submission = parseResultSubmissionV1(input);
    const bootstrap = await this.persistence.getBootstrap(playerId);
    if (!bootstrap) throw new OfflineBootstrapMissingError();
    if (classSessionId && bootstrap.class_session_id !== classSessionId) {
      throw new OfflineSessionMismatchError();
    }
    const event = parseResultEventV1({
      ...submission,
      client_event_id: this.createEventId(),
    });
    const receipt = await this.persistence.enqueueResult(
      playerId,
      classSessionId ?? bootstrap.class_session_id,
      event,
      await eventRequestIdentity(event),
    );
    return {
      type: "portal.local_durable.v1",
      record_type: "result",
      events: [
        {
          request_id: receipt.requestId,
          client_event_id: receipt.clientEventId,
        },
      ],
    };
  }

  async enqueueActiveTime(
    playerId: string,
    input: ActiveTimeSubmissionV1,
    classSessionId?: string,
  ): Promise<LocalDurabilityAcknowledgementV1> {
    const submission = activeTimeSubmissionV1Schema.parse(input);
    const bootstrap = await this.persistence.getBootstrap(playerId);
    if (!bootstrap) throw new OfflineBootstrapMissingError();
    if (classSessionId && bootstrap.class_session_id !== classSessionId) {
      throw new OfflineSessionMismatchError();
    }
    const events = await Promise.all(
      submission.events.map(async (event) => {
        const queuedEvent = {
          ...event,
          client_event_id: this.createEventId(),
        };
        return this.persistence.enqueueActiveTime(
          playerId,
          classSessionId ?? bootstrap.class_session_id,
          queuedEvent,
          await eventRequestIdentity(queuedEvent),
        );
      }),
    );
    return {
      type: "portal.local_durable.v1",
      record_type: "active_time",
      events: events.map(({ requestId, clientEventId }) => ({
        request_id: requestId,
        client_event_id: clientEventId,
      })),
    };
  }

  getSyncStatus(playerId: string): Promise<GameOfflineSyncStatus> {
    return this.persistence.status(playerId);
  }

  async discardConflictedStateBranch(playerId: string): Promise<void> {
    await this.persistence.discardStateBranch(playerId);
  }

  async sync(
    playerId: string,
    transport: GameOfflineTransport,
    onStateConflict?: (conflict: StateSaveConflictV1) => void | Promise<void>,
    expectedClassSessionId?: string,
  ): Promise<GameOfflineSyncReport> {
    const bootstrap = await this.persistence.getBootstrap(playerId);
    if (!bootstrap) throw new OfflineBootstrapMissingError();
    if (
      expectedClassSessionId &&
      bootstrap.class_session_id !== expectedClassSessionId
    ) {
      throw new OfflineSessionMismatchError();
    }

    let savedStates = 0;
    let uploadedResults = 0;
    let uploadedActiveTimeEvents = 0;
    const stateAcknowledgements: StateSaveSuccessV1[] = [];
    const eventAcknowledgements: GameOfflineSyncReport["eventAcknowledgements"] =
      [];
    let failedStream: GameOfflineSyncReport["failedStream"];
    let conflict = await this.persistence.getStateConflict(playerId);

    if (!conflict) {
      for (const queued of await this.persistence.listStates(playerId)) {
        let response: unknown;
        try {
          response = await transport.saveState(queued.request);
        } catch (error) {
          const parsedConflict = parseStateConflictResponse(error);
          if (parsedConflict?.request_id === queued.request.request_id) {
            conflict = parsedConflict;
            await this.persistAndNotifyConflict(
              playerId,
              parsedConflict,
              onStateConflict,
            );
          } else {
            failedStream = "state";
          }
          break;
        }
        const parsedConflict = parseStateConflictResponse(response);
        if (parsedConflict?.request_id === queued.request.request_id) {
          conflict = parsedConflict;
          await this.persistAndNotifyConflict(
            playerId,
            parsedConflict,
            onStateConflict,
          );
          break;
        }
        try {
          const success = parseStateSaveSuccessV1(response);
          if (
            success.request_id !== queued.request.request_id ||
            success.revision !== queued.request.expected_revision + 1
          ) {
            throw new Error(
              "State save acknowledgement did not match the queued request",
            );
          }
          await this.persistence.acknowledgeState(playerId, queued, success);
          savedStates += 1;
          stateAcknowledgements.push(success);
        } catch {
          failedStream = "state";
          break;
        }
      }
    }

    let eventQueue = await this.persistence.listEvents(
      playerId,
      bootstrap.class_session_id,
    );
    while (eventQueue.length > 0) {
      const first = eventQueue[0];
      if (!first) break;
      try {
        if (first.kind === "result") {
          const acknowledgement = parseResultAcknowledgementV1(
            await transport.uploadResult(first.event),
          );
          if (acknowledgement.client_event_id !== first.event.client_event_id) {
            throw new Error(
              "Result acknowledgement did not match the queued event",
            );
          }
          await this.persistence.acknowledgeEvent(first);
          uploadedResults += 1;
          eventAcknowledgements.push({
            record_type: "result",
            request_id: first.requestId,
            client_event_id: first.event.client_event_id,
          });
        } else {
          const consecutive: QueuedActiveTime[] = [];
          for (const item of eventQueue) {
            if (item.kind !== "active_time" || consecutive.length === 100)
              break;
            consecutive.push(item);
          }
          const batch = activeTimeBatchV1Schema.parse({
            type: "game.active_time.v1",
            events: consecutive.map(({ event }) => event),
          });
          const acknowledgement = activeTimeAcknowledgementV1Schema.parse(
            await transport.uploadActiveTime(batch),
          );
          const sentIds = new Set(
            batch.events.map(({ client_event_id }) => client_event_id),
          );
          if (
            acknowledgement.acknowledged_event_ids.some(
              (id) => !sentIds.has(id),
            )
          ) {
            throw new Error(
              "Active-time acknowledgement contained an event that was not sent",
            );
          }
          const acknowledged = new Set(acknowledgement.acknowledged_event_ids);
          for (const queuedEvent of consecutive) {
            if (acknowledged.has(queuedEvent.event.client_event_id)) {
              await this.persistence.acknowledgeEvent(queuedEvent);
              uploadedActiveTimeEvents += 1;
              eventAcknowledgements.push({
                record_type: "active_time",
                request_id: queuedEvent.requestId,
                client_event_id: queuedEvent.event.client_event_id,
              });
            }
          }
          if (acknowledged.size !== consecutive.length) {
            failedStream = "events";
            break;
          }
        }
      } catch {
        failedStream = "events";
        break;
      }
      eventQueue = await this.persistence.listEvents(
        playerId,
        bootstrap.class_session_id,
      );
    }

    const remaining = await this.persistence.status(playerId);
    return {
      state:
        conflict || remaining.stateBlocked
          ? "blocked"
          : failedStream ||
              remaining.queuedStates +
                remaining.queuedResults +
                remaining.queuedActiveTime >
                0
            ? "pending"
            : "synced",
      savedStates,
      uploadedResults,
      uploadedActiveTimeEvents,
      stateAcknowledgements,
      eventAcknowledgements,
      ...(conflict ? { conflict } : {}),
      ...(failedStream ? { failedStream } : {}),
    };
  }

  private async persistAndNotifyConflict(
    playerId: string,
    conflict: StateSaveConflictV1,
    notify?: (conflict: StateSaveConflictV1) => void | Promise<void>,
  ): Promise<void> {
    try {
      await this.persistence.blockState(playerId, conflict);
    } catch {
      // Keep this sync's conflict decision even if IndexedDB cannot persist the lock.
    }
    try {
      await notify?.(conflict);
    } catch {
      // A bridge recovery callback must not prevent independent event uploads.
    }
  }
}

export async function openGameOfflineStore(
  options: {
    indexedDB?: IDBFactory;
    createEventId?: () => string;
  } = {},
): Promise<GameOfflineStore> {
  const factory = options.indexedDB ?? globalThis.indexedDB;
  if (!factory) throw new Error("IndexedDB is not available in this browser");
  const database = await openDatabase(factory);
  return new GameOfflineStore(
    new IndexedDbGameOfflinePersistence(database),
    options.createEventId,
  );
}

function parseStateConflictResponse(
  error: unknown,
): StateSaveConflictV1 | null {
  const candidate =
    error && typeof error === "object" && "response" in error
      ? (error as { response?: unknown }).response
      : error;
  const parsed = stateSaveConflictV1Schema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function createClientEventId(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error(
      "crypto.randomUUID is required to allocate stable event IDs",
    );
  }
  return globalThis.crypto.randomUUID();
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "undefined";
  }
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([left], [right]) => (left < right ? -1 : left > right ? 1 : 0),
  );
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
}

async function eventRequestIdentity(value: {
  client_event_id: string;
}): Promise<EventRequestIdentity> {
  const canonicalContent = stableJson(
    Object.fromEntries(
      Object.entries(value).filter(([key]) => key !== "client_event_id"),
    ),
  );
  const subtle = globalThis.crypto?.subtle;
  if (!subtle)
    throw new Error("Web Crypto SHA-256 is required for event retries");
  const digest = await subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalContent),
  );
  const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return { canonicalContent, fingerprint };
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
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

class IndexedDbGameOfflinePersistence implements GameOfflinePersistence {
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
