import {
  activeTimeAcknowledgementV2Schema,
  activeTimeBatchV2Schema,
  activeTimeSubmissionV2Schema,
  parsePlayerBootstrapV2,
  parseResultAcknowledgementV2,
  parseResultEventV2,
  parseResultSubmissionV2,
  parseStateSaveRequestV2,
  parseStateSaveSuccessV2,
  type ActiveTimeSubmissionV2,
  type LocalDurabilityAcknowledgementV2,
  type PlayerBootstrapV2,
  type ResultSubmissionV2,
  type StateSaveConflictV2,
  type StateSaveRequestV2,
  type StateSaveSuccessV2,
} from "@/contracts/v2";

import { eventRequestIdentity, parseStateConflictResponse } from "./canonical";
import {
  OfflineBootstrapMissingError,
  OfflineSessionMismatchError,
  OfflineStateBlockedError,
  OfflineBranchChangedError,
} from "./errors";
import { IndexedDbGameOfflinePersistence, openDatabase } from "./indexed-db";
import { GameTransportError } from "./network";
import type {
  GameOfflinePersistence,
  GameOfflineSyncReport,
  GameOfflineSyncStatus,
  GameOfflineTransport,
  QueuedActiveTime,
  StateBranch,
} from "./types";

export class GameOfflineStore {
  private readonly branches = new Map<string, StateBranch>();
  constructor(
    private readonly persistence: GameOfflinePersistence,
    private readonly createEventId: () => string = createClientEventId,
  ) {}

  close(): void {
    this.persistence.close?.();
  }

  async cacheBootstrap(
    input: PlayerBootstrapV2,
    generation?: number,
  ): Promise<PlayerBootstrapV2 | null> {
    const bootstrap = parsePlayerBootstrapV2(input);
    const reservedGeneration =
      generation ??
      (await this.persistence.reserveBootstrapGeneration(bootstrap.player_id));
    const accepted = await this.persistence.cacheBootstrap(
      bootstrap,
      reservedGeneration,
    );
    if (
      accepted?.request_id === bootstrap.request_id &&
      accepted.revision === bootstrap.revision
    ) {
      this.branches.set(bootstrap.player_id, {
        generation: reservedGeneration,
        baseRevision: bootstrap.revision,
      });
    }
    return accepted;
  }

  reserveBootstrapGeneration(playerId: string): Promise<number> {
    return this.persistence.reserveBootstrapGeneration(playerId);
  }

  getBootstrap(playerId: string): Promise<PlayerBootstrapV2 | null> {
    return this.persistence.getBootstrap(playerId);
  }

  async getNextExpectedRevision(playerId: string): Promise<number> {
    if (
      (await this.persistence.getStateConflict(playerId)) ||
      (await this.persistence.getStateRejection(playerId))
    ) {
      throw new OfflineStateBlockedError();
    }
    const bootstrap = await this.persistence.getBootstrap(playerId);
    if (!bootstrap) throw new OfflineBootstrapMissingError();
    const queue = await this.persistence.listStates(playerId);
    return bootstrap.revision + queue.length;
  }

  async enqueueState(
    playerId: string,
    input: StateSaveRequestV2,
    classSessionId?: string,
  ): Promise<LocalDurabilityAcknowledgementV2> {
    const request = parseStateSaveRequestV2(input);
    const branch = this.branches.get(playerId);
    if (!branch) throw new OfflineBranchChangedError();
    const queued = await this.persistence.enqueueState(
      playerId,
      request,
      classSessionId,
      branch,
    );
    return {
      type: "portal.local_durable.v2",
      record_type: "state",
      request_id: queued.request.request_id,
    };
  }

  async enqueueResult(
    playerId: string,
    input: ResultSubmissionV2,
    classSessionId?: string,
  ): Promise<LocalDurabilityAcknowledgementV2> {
    const submission = parseResultSubmissionV2(input);
    const bootstrap = await this.persistence.getBootstrap(playerId);
    if (!bootstrap) throw new OfflineBootstrapMissingError();
    if (classSessionId && bootstrap.class_session_id !== classSessionId) {
      throw new OfflineSessionMismatchError();
    }
    const event = parseResultEventV2({
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
      type: "portal.local_durable.v2",
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
    input: ActiveTimeSubmissionV2,
    classSessionId?: string,
  ): Promise<LocalDurabilityAcknowledgementV2> {
    const submission = activeTimeSubmissionV2Schema.parse(input);
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
      type: "portal.local_durable.v2",
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

  async discardConflictedStateBranch(
    playerId: string,
    expectedRequestId?: string,
  ): Promise<void> {
    await withPlayerLock(playerId, () =>
      this.persistence.discardStateBranch(playerId, expectedRequestId),
    );
    this.branches.delete(playerId);
  }

  async sync(
    playerId: string,
    transport: GameOfflineTransport,
    onStateConflict?: (conflict: StateSaveConflictV2) => void | Promise<void>,
    expectedClassSessionId?: string,
  ): Promise<GameOfflineSyncReport> {
    return withPlayerLock(playerId, () =>
      this.syncUnlocked(
        playerId,
        transport,
        onStateConflict,
        expectedClassSessionId,
      ),
    );
  }

  private async syncUnlocked(
    playerId: string,
    transport: GameOfflineTransport,
    onStateConflict?: (conflict: StateSaveConflictV2) => void | Promise<void>,
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
    const stateAcknowledgements: StateSaveSuccessV2[] = [];
    const eventAcknowledgements: GameOfflineSyncReport["eventAcknowledgements"] =
      [];
    let failedStream: GameOfflineSyncReport["failedStream"];
    let retryable = false;
    let conflict = await this.persistence.getStateConflict(playerId);
    let rejection = await this.persistence.getStateRejection(playerId);

    if (!conflict && !rejection) {
      for (const queued of await this.persistence.listStates(playerId)) {
        if (!queued.classSessionId) {
          rejection = { requestId: queued.request.request_id };
          await this.persistence.rejectStateBranch(playerId, rejection);
          failedStream = "state";
          break;
        }
        let response: unknown;
        try {
          response = await transport.saveState(
            queued.request,
            queued.classSessionId,
          );
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
            if (
              (error instanceof GameTransportError && !error.retryable) ||
              error instanceof OfflineSessionMismatchError
            ) {
              rejection = {
                requestId: queued.request.request_id,
                ...(error instanceof GameTransportError
                  ? { status: error.status }
                  : {}),
              };
              await this.persistence.rejectStateBranch(playerId, rejection);
            }
            retryable ||=
              !(error instanceof OfflineSessionMismatchError) &&
              (!(error instanceof GameTransportError) || error.retryable);
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
        let success: StateSaveSuccessV2;
        try {
          success = parseStateSaveSuccessV2(response);
          if (
            success.request_id !== queued.request.request_id ||
            success.revision !== queued.request.expected_revision + 1
          ) {
            throw new Error(
              "State save acknowledgement did not match the queued request",
            );
          }
        } catch {
          failedStream = "state";
          rejection = { requestId: queued.request.request_id };
          await this.persistence.rejectStateBranch(playerId, rejection);
          break;
        }
        try {
          await this.persistence.acknowledgeState(playerId, queued, success);
          savedStates += 1;
          stateAcknowledgements.push(success);
        } catch {
          failedStream = "state";
          retryable = true;
          break;
        }
      }
    }

    const eventSessionId = transport.includePreviousSessions
      ? undefined
      : bootstrap.class_session_id;
    const failedSessions = new Set<string>();
    let eventQueue = await this.persistence.listEvents(
      playerId,
      eventSessionId,
    );
    while (eventQueue.length > 0) {
      const first = eventQueue[0];
      if (!first) break;
      try {
        if (first.kind === "result") {
          const acknowledgement = parseResultAcknowledgementV2(
            await transport.uploadResult(first.event, first.classSessionId),
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
            if (
              item.kind !== "active_time" ||
              item.classSessionId !== first.classSessionId ||
              consecutive.length === 100
            )
              break;
            consecutive.push(item);
          }
          const batch = activeTimeBatchV2Schema.parse({
            type: "game.active_time.v2",
            events: consecutive.map(({ event }) => event),
          });
          const acknowledgement = activeTimeAcknowledgementV2Schema.parse(
            await transport.uploadActiveTime(batch, first.classSessionId),
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
            retryable = true;
            failedSessions.add(first.classSessionId);
          }
        }
      } catch (error) {
        failedStream = "events";
        retryable ||=
          !(error instanceof OfflineSessionMismatchError) &&
          (!(error instanceof GameTransportError) || error.retryable);
        failedSessions.add(first.classSessionId);
      }
      eventQueue = await this.persistence.listEvents(playerId, eventSessionId);
      eventQueue = eventQueue.filter(
        (event) => !failedSessions.has(event.classSessionId),
      );
    }

    const remaining = await this.persistence.status(playerId);
    return {
      state:
        conflict || rejection || remaining.stateBlocked
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
      ...(rejection ? { rejection } : {}),
      ...(failedStream ? { failedStream } : {}),
      ...(failedStream ? { retryable } : {}),
    };
  }

  private async persistAndNotifyConflict(
    playerId: string,
    conflict: StateSaveConflictV2,
    notify?: (conflict: StateSaveConflictV2) => void | Promise<void>,
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

function withPlayerLock<T>(
  playerId: string,
  work: () => Promise<T>,
): Promise<T> {
  const locks = globalThis.navigator?.locks;
  return locks
    ? locks.request(
        `caramelito-sync-${playerId}`,
        { signal: AbortSignal.timeout(60_000) },
        work,
      )
    : work();
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
