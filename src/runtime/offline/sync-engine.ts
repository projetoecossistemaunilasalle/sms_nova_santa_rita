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
  type ActiveTimeSubmissionV1,
  type LocalDurabilityAcknowledgementV1,
  type PlayerBootstrapV1,
  type ResultSubmissionV1,
  type StateSaveConflictV1,
  type StateSaveRequestV1,
  type StateSaveSuccessV1,
} from "@/contracts/v1";

import { eventRequestIdentity, parseStateConflictResponse } from "./canonical";
import {
  OfflineBootstrapMissingError,
  OfflineSessionMismatchError,
  OfflineStateBlockedError,
} from "./errors";
import { IndexedDbGameOfflinePersistence, openDatabase } from "./indexed-db";
import type {
  GameOfflinePersistence,
  GameOfflineSyncReport,
  GameOfflineSyncStatus,
  GameOfflineTransport,
  QueuedActiveTime,
} from "./types";

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

function createClientEventId(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error(
      "crypto.randomUUID is required to allocate stable event IDs",
    );
  }
  return globalThis.crypto.randomUUID();
}
