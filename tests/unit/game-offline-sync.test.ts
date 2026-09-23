import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  GameOfflineStore,
  OfflineRequestReuseError,
  OfflineSessionMismatchError,
  type EventRequestIdentity,
  type GameOfflinePersistence,
  type QueuedActiveTime,
  type QueuedEvent,
  type QueuedResult,
  type QueuedStateSave,
} from "@/runtime/game-offline-sync";
import type {
  ActiveTimeSubmissionV1,
  PlayerBootstrapV1,
  ResultEventV1,
  ResultSubmissionV1,
  StateSaveConflictV1,
  StateSaveRequestV1,
  StateSaveSuccessV1,
} from "@/contracts/v1";

const fixture = <T>(name: string): T =>
  JSON.parse(
    readFileSync(
      resolve(process.cwd(), "contracts", "fixtures", "v1", "valid", name),
      "utf8",
    ),
  ) as T;

class MemoryOfflinePersistence implements GameOfflinePersistence {
  private nextSequence = 1;
  private bootstraps = new Map<string, PlayerBootstrapV1>();
  private bootstrapGenerations = new Map<string, number>();
  private states: QueuedStateSave[] = [];
  private events: QueuedEvent[] = [];
  private eventRequests = new Map<
    string,
    { fingerprint: string; clientEventId: string }
  >();
  private conflicts = new Map<string, StateSaveConflictV1>();

  async getBootstrap(playerId: string) {
    return this.bootstraps.get(playerId) ?? null;
  }

  async reserveBootstrapGeneration(playerId: string) {
    const generation = (this.bootstrapGenerations.get(playerId) ?? 0) + 1;
    this.bootstrapGenerations.set(playerId, generation);
    return generation;
  }

  async cacheBootstrap(bootstrap: PlayerBootstrapV1, generation: number) {
    const existing = this.bootstraps.get(bootstrap.player_id);
    if (
      generation < (this.bootstrapGenerations.get(bootstrap.player_id) ?? 0)
    ) {
      return existing ?? null;
    }
    if (
      existing &&
      existing.class_session_id === bootstrap.class_session_id &&
      existing.revision > bootstrap.revision
    ) {
      return existing;
    }
    if (
      existing &&
      existing.class_session_id !== bootstrap.class_session_id &&
      existing.revision > bootstrap.revision
    ) {
      return existing;
    }
    this.bootstraps.set(bootstrap.player_id, bootstrap);
    return bootstrap;
  }

  async enqueueState(
    playerId: string,
    request: StateSaveRequestV1,
    classSessionId?: string,
  ) {
    const existing = this.states.find(
      (item) =>
        item.playerId === playerId && item.requestId === request.request_id,
    );
    if (existing) {
      if (
        JSON.stringify(existing.request.state) !== JSON.stringify(request.state)
      )
        throw new OfflineRequestReuseError();
      return existing;
    }
    if (this.conflicts.has(playerId)) throw new Error("blocked");
    const bootstrap = this.bootstraps.get(playerId);
    if (!bootstrap) throw new Error("missing bootstrap");
    if (classSessionId && bootstrap.class_session_id !== classSessionId) {
      throw new OfflineSessionMismatchError();
    }
    const queued: QueuedStateSave = {
      id: this.nextSequence++,
      playerId,
      requestId: request.request_id,
      queuedAt: 1,
      request: {
        ...request,
        expected_revision:
          bootstrap.revision +
          this.states.filter((item) => item.playerId === playerId).length,
      },
    };
    this.states.push(queued);
    return queued;
  }

  async listStates(playerId: string) {
    return this.states
      .filter((item) => item.playerId === playerId)
      .sort((a, b) => a.id - b.id);
  }

  async acknowledgeState(
    playerId: string,
    queued: QueuedStateSave,
    success: StateSaveSuccessV1,
  ) {
    const bootstrap = this.bootstraps.get(playerId);
    if (bootstrap && bootstrap.revision <= success.revision) {
      this.bootstraps.set(playerId, {
        type: "portal.bootstrap.v1",
        request_id: queued.request.request_id,
        protocol_version: bootstrap.protocol_version,
        player_id: bootstrap.player_id,
        class_session_id: bootstrap.class_session_id,
        revision: success.revision,
        new_player: false,
        state: queued.request.state,
      });
    }
    this.states = this.states.filter((item) => item.id !== queued.id);
  }

  async blockState(playerId: string, conflict: StateSaveConflictV1) {
    const bootstrap = this.bootstraps.get(playerId);
    if (bootstrap && bootstrap.revision <= conflict.revision) {
      this.bootstraps.set(playerId, {
        type: "portal.bootstrap.v1",
        request_id: conflict.request_id,
        protocol_version: bootstrap.protocol_version,
        player_id: bootstrap.player_id,
        class_session_id: bootstrap.class_session_id,
        revision: conflict.revision,
        new_player: false,
        state: conflict.state,
      });
    }
    this.conflicts.set(playerId, conflict);
  }

  async getStateConflict(playerId: string) {
    return this.conflicts.get(playerId) ?? null;
  }

  async discardStateBranch(playerId: string) {
    this.states = this.states.filter((item) => item.playerId !== playerId);
    this.conflicts.delete(playerId);
  }

  async enqueueResult(
    playerId: string,
    classSessionId: string,
    event: ResultEventV1,
    identity: EventRequestIdentity,
  ) {
    const key = JSON.stringify([
      playerId,
      classSessionId,
      "result",
      event.request_id,
    ]);
    const existing = this.eventRequests.get(key);
    if (existing) {
      if (existing.fingerprint !== identity.fingerprint)
        throw new OfflineRequestReuseError();
      return {
        requestId: event.request_id,
        clientEventId: existing.clientEventId,
      };
    }
    const queued: QueuedResult = {
      id: this.nextSequence++,
      playerId,
      classSessionId,
      kind: "result",
      requestId: event.request_id,
      event,
      queuedAt: 1,
    };
    this.events.push(queued);
    this.eventRequests.set(key, {
      fingerprint: identity.fingerprint,
      clientEventId: event.client_event_id,
    });
    return {
      requestId: event.request_id,
      clientEventId: event.client_event_id,
    };
  }

  async enqueueActiveTime(
    playerId: string,
    classSessionId: string,
    event: QueuedActiveTime["event"],
    identity: EventRequestIdentity,
  ) {
    const key = JSON.stringify([
      playerId,
      classSessionId,
      "active_time",
      event.request_id,
    ]);
    const existing = this.eventRequests.get(key);
    if (existing) {
      if (existing.fingerprint !== identity.fingerprint)
        throw new OfflineRequestReuseError();
      return {
        requestId: event.request_id,
        clientEventId: existing.clientEventId,
      };
    }
    const queued: QueuedActiveTime = {
      id: this.nextSequence++,
      playerId,
      classSessionId,
      kind: "active_time",
      requestId: event.request_id,
      event,
      queuedAt: 1,
    };
    this.events.push(queued);
    this.eventRequests.set(key, {
      fingerprint: identity.fingerprint,
      clientEventId: event.client_event_id,
    });
    return {
      requestId: event.request_id,
      clientEventId: event.client_event_id,
    };
  }

  async listEvents(playerId: string, classSessionId: string) {
    return this.events
      .filter(
        (item) =>
          item.playerId === playerId && item.classSessionId === classSessionId,
      )
      .sort((a, b) => a.id - b.id);
  }

  async acknowledgeEvent(queued: QueuedEvent) {
    this.events = this.events.filter((item) => item.id !== queued.id);
  }

  async status(playerId: string) {
    const events = this.events.filter((item) => item.playerId === playerId);
    return {
      queuedStates: this.states.filter((item) => item.playerId === playerId)
        .length,
      queuedResults: events.filter((item) => item.kind === "result").length,
      queuedActiveTime: events.filter((item) => item.kind === "active_time")
        .length,
      stateBlocked: this.conflicts.has(playerId),
    };
  }
}

describe("GameOfflineStore", () => {
  it("queues state saves at sequential revisions and keeps local acknowledgements stable", async () => {
    const persistence = new MemoryOfflinePersistence();
    const offline = new GameOfflineStore(persistence, () => "unused-event-id");
    const bootstrap = fixture<PlayerBootstrapV1>(
      "returning-player-bootstrap.json",
    );
    const request = fixture<StateSaveRequestV1>("state-save-request.json");
    await offline.cacheBootstrap(bootstrap);

    const firstAck = await offline.enqueueState(bootstrap.player_id, request);
    const secondAck = await offline.enqueueState(bootstrap.player_id, {
      ...request,
      request_id: "request-save-002",
    });
    const retryAck = await offline.enqueueState(bootstrap.player_id, request);

    expect(firstAck).toEqual({
      type: "portal.local_durable.v1",
      record_type: "state",
      request_id: request.request_id,
    });
    expect(secondAck).toEqual({
      type: "portal.local_durable.v1",
      record_type: "state",
      request_id: "request-save-002",
    });
    expect(retryAck).toEqual(firstAck);
    expect(await offline.getNextExpectedRevision(bootstrap.player_id)).toBe(44);
    expect(
      (await persistence.listStates(bootstrap.player_id)).map(
        (item) => item.request.expected_revision,
      ),
    ).toEqual([42, 43]);
  });

  it("allocates stable event IDs and does not reuse a request ID for changed content", async () => {
    const persistence = new MemoryOfflinePersistence();
    let eventNumber = 0;
    const offline = new GameOfflineStore(
      persistence,
      () => `event-generated-${++eventNumber}`,
    );
    const bootstrap = fixture<PlayerBootstrapV1>(
      "returning-player-bootstrap.json",
    );
    await offline.cacheBootstrap(bootstrap);
    const result = fixture<ResultSubmissionV1>("result-submission.json");
    const resultAck = await offline.enqueueResult(bootstrap.player_id, result);
    const resultRetry = await offline.enqueueResult(
      bootstrap.player_id,
      result,
    );
    const time = fixture<ActiveTimeSubmissionV1>("active-time-submission.json");
    const timeAck = await offline.enqueueActiveTime(bootstrap.player_id, time);
    const timeRetry = await offline.enqueueActiveTime(
      bootstrap.player_id,
      time,
    );

    expect(resultAck).toEqual(resultRetry);
    expect(resultAck).toMatchObject({
      record_type: "result",
      events: [
        { request_id: result.request_id, client_event_id: "event-generated-1" },
      ],
    });
    expect(timeAck).toEqual(timeRetry);
    expect(timeAck).toMatchObject({
      record_type: "active_time",
      events: [
        {
          request_id: "request-time-001",
          client_event_id: "event-generated-3",
        },
        {
          request_id: "request-time-002",
          client_event_id: "event-generated-4",
        },
        {
          request_id: "request-time-003",
          client_event_id: "event-generated-5",
        },
      ],
    });
    const changedResult = structuredClone(result);
    Object.assign(changedResult.result, { duracao_ms: 100 });
    await expect(
      offline.enqueueResult(bootstrap.player_id, changedResult),
    ).rejects.toBeInstanceOf(OfflineRequestReuseError);
  });

  it("retains event IDs after server acknowledgement for lost local acks", async () => {
    const persistence = new MemoryOfflinePersistence();
    let eventNumber = 0;
    const offline = new GameOfflineStore(
      persistence,
      () => `event-generated-${++eventNumber}`,
    );
    const bootstrap = fixture<PlayerBootstrapV1>(
      "returning-player-bootstrap.json",
    );
    const result = fixture<ResultSubmissionV1>("result-submission.json");
    const activeTime = fixture<ActiveTimeSubmissionV1>(
      "active-time-submission.json",
    );
    await offline.cacheBootstrap(bootstrap);

    const resultAck = await offline.enqueueResult(bootstrap.player_id, result);
    const activeTimeAck = await offline.enqueueActiveTime(
      bootstrap.player_id,
      activeTime,
    );
    const syncReport = await offline.sync(bootstrap.player_id, {
      saveState: async () => {
        throw new Error("unused");
      },
      uploadResult: async (event) => ({
        type: "portal.result_ack.v1",
        client_event_id: event.client_event_id,
      }),
      uploadActiveTime: async (batch) => ({
        type: "portal.active_time_ack.v1",
        acknowledged_event_ids: batch.events.map(
          (event) => event.client_event_id,
        ),
      }),
    });
    expect(syncReport.uploadedResults).toBe(1);
    expect(syncReport.uploadedActiveTimeEvents).toBe(3);
    expect(
      await persistence.listEvents(
        bootstrap.player_id,
        bootstrap.class_session_id,
      ),
    ).toHaveLength(0);

    await expect(
      offline.enqueueResult(bootstrap.player_id, result),
    ).resolves.toEqual(resultAck);
    await expect(
      offline.enqueueActiveTime(bootstrap.player_id, activeTime),
    ).resolves.toEqual(activeTimeAck);
    expect(
      await persistence.listEvents(
        bootstrap.player_id,
        bootstrap.class_session_id,
      ),
    ).toHaveLength(0);

    const changedResult = structuredClone(result);
    Object.assign(changedResult.result, { duracao_ms: 100 });
    await expect(
      offline.enqueueResult(bootstrap.player_id, changedResult),
    ).rejects.toBeInstanceOf(OfflineRequestReuseError);

    const changedActiveTime = structuredClone(activeTime);
    changedActiveTime.events[0]!.active_ms -= 1;
    await expect(
      offline.enqueueActiveTime(bootstrap.player_id, changedActiveTime),
    ).rejects.toBeInstanceOf(OfflineRequestReuseError);
  });

  it("leaves old-session queued events pending instead of uploading under a new session", async () => {
    const persistence = new MemoryOfflinePersistence();
    const offline = new GameOfflineStore(
      persistence,
      () => "event-old-session",
    );
    const bootstrap = fixture<PlayerBootstrapV1>(
      "returning-player-bootstrap.json",
    );
    await offline.cacheBootstrap(bootstrap);
    await offline.enqueueResult(
      bootstrap.player_id,
      fixture<ResultSubmissionV1>("result-submission.json"),
    );
    await offline.cacheBootstrap({
      ...bootstrap,
      request_id: "new-session-bootstrap",
      class_session_id: "session-new",
    });

    const uploadResult = async () => {
      throw new Error("old-session event must not use the new launch token");
    };
    const report = await offline.sync(bootstrap.player_id, {
      saveState: async () => {
        throw new Error("unused");
      },
      uploadResult,
      uploadActiveTime: async () => {
        throw new Error("unused");
      },
    });

    expect(report.state).toBe("pending");
    expect(report.uploadedResults).toBe(0);
    expect(
      (await offline.getSyncStatus(bootstrap.player_id)).queuedResults,
    ).toBe(1);
    expect(
      await persistence.listEvents(
        bootstrap.player_id,
        bootstrap.class_session_id,
      ),
    ).toHaveLength(1);
    expect(
      await persistence.listEvents(bootstrap.player_id, "session-new"),
    ).toHaveLength(0);
  });

  it("ignores delayed old-session bootstraps and scopes every upload to its launch session", async () => {
    const persistence = new MemoryOfflinePersistence();
    let eventId = 0;
    const offline = new GameOfflineStore(
      persistence,
      () => `event-session-${++eventId}`,
    );
    const bootstrap = fixture<PlayerBootstrapV1>(
      "returning-player-bootstrap.json",
    );
    const oldGeneration = await offline.reserveBootstrapGeneration(
      bootstrap.player_id,
    );
    await offline.cacheBootstrap(bootstrap, oldGeneration);

    const oldResult = fixture<ResultSubmissionV1>("result-submission.json");
    const oldActiveTime = fixture<ActiveTimeSubmissionV1>(
      "active-time-submission.json",
    );
    await offline.enqueueResult(
      bootstrap.player_id,
      oldResult,
      bootstrap.class_session_id,
    );

    const newGeneration = await offline.reserveBootstrapGeneration(
      bootstrap.player_id,
    );
    const newSessionBootstrap = {
      ...bootstrap,
      request_id: "new-session-bootstrap",
      class_session_id: "session-new",
    };
    await offline.cacheBootstrap(newSessionBootstrap, newGeneration);
    await offline.cacheBootstrap(bootstrap, oldGeneration);
    expect(await offline.getBootstrap(bootstrap.player_id)).toMatchObject({
      class_session_id: "session-new",
    });

    await expect(
      offline.enqueueResult(
        bootstrap.player_id,
        { ...oldResult, request_id: "result-old-after-rollover" },
        bootstrap.class_session_id,
      ),
    ).rejects.toBeInstanceOf(OfflineSessionMismatchError);
    await expect(
      offline.enqueueActiveTime(
        bootstrap.player_id,
        oldActiveTime,
        bootstrap.class_session_id,
      ),
    ).rejects.toBeInstanceOf(OfflineSessionMismatchError);
    await expect(
      offline.enqueueState(
        bootstrap.player_id,
        fixture<StateSaveRequestV1>("state-save-request.json"),
        bootstrap.class_session_id,
      ),
    ).rejects.toBeInstanceOf(OfflineSessionMismatchError);

    await offline.enqueueResult(
      bootstrap.player_id,
      { ...oldResult, request_id: "result-new-session" },
      newSessionBootstrap.class_session_id,
    );

    const uploaded: string[] = [];
    await offline.sync(
      bootstrap.player_id,
      {
        saveState: async () => {
          throw new Error("unused");
        },
        uploadResult: async (event) => {
          uploaded.push(event.request_id);
          return {
            type: "portal.result_ack.v1",
            client_event_id: event.client_event_id,
          };
        },
        uploadActiveTime: async () => {
          throw new Error("unused");
        },
      },
      undefined,
      "session-new",
    );
    expect(uploaded).toEqual(["result-new-session"]);
    await expect(
      offline.sync(
        bootstrap.player_id,
        {
          saveState: async () => {
            throw new Error("must not upload under mismatched session");
          },
          uploadResult: async () => {
            throw new Error("must not upload under mismatched session");
          },
          uploadActiveTime: async () => {
            throw new Error("must not upload under mismatched session");
          },
        },
        undefined,
        bootstrap.class_session_id,
      ),
    ).rejects.toBeInstanceOf(OfflineSessionMismatchError);
    expect(
      await persistence.listEvents(
        bootstrap.player_id,
        bootstrap.class_session_id,
      ),
    ).toHaveLength(1);
  });

  it("blocks only state after a revision conflict and still uploads independent events", async () => {
    const persistence = new MemoryOfflinePersistence();
    let eventNumber = 0;
    const offline = new GameOfflineStore(
      persistence,
      () => `event-generated-${++eventNumber}`,
    );
    const bootstrap = fixture<PlayerBootstrapV1>(
      "returning-player-bootstrap.json",
    );
    const save = fixture<StateSaveRequestV1>("state-save-request.json");
    const result = fixture<ResultSubmissionV1>("result-submission.json");
    const activeTime = fixture<ActiveTimeSubmissionV1>(
      "active-time-submission.json",
    );
    const conflict = fixture<StateSaveConflictV1>(
      "stale-revision-conflict.json",
    );
    await offline.cacheBootstrap(bootstrap);
    await offline.enqueueState(bootstrap.player_id, save);
    await offline.enqueueResult(bootstrap.player_id, result);
    await offline.enqueueActiveTime(bootstrap.player_id, activeTime);

    let stateAttempts = 0;
    const report = await offline.sync(bootstrap.player_id, {
      saveState: async () => {
        stateAttempts += 1;
        return conflict;
      },
      uploadResult: async (event) => ({
        type: "portal.result_ack.v1",
        client_event_id: event.client_event_id,
      }),
      uploadActiveTime: async (batch) => ({
        type: "portal.active_time_ack.v1",
        acknowledged_event_ids: batch.events.map(
          (event) => event.client_event_id,
        ),
      }),
    });

    expect(report.state).toBe("blocked");
    expect(report.conflict?.revision).toBe(44);
    expect(report.uploadedResults).toBe(1);
    expect(report.uploadedActiveTimeEvents).toBe(3);
    expect(report.eventAcknowledgements).toHaveLength(4);
    expect(stateAttempts).toBe(1);
    expect(await persistence.listStates(bootstrap.player_id)).toHaveLength(1);
    expect(
      await persistence.listEvents(
        bootstrap.player_id,
        bootstrap.class_session_id,
      ),
    ).toHaveLength(0);

    const blockedRetry = await offline.sync(bootstrap.player_id, {
      saveState: async () => {
        stateAttempts += 1;
        return {
          type: "portal.save_ok.v1",
          request_id: save.request_id,
          revision: 43,
        };
      },
      uploadResult: async () => {
        throw new Error("must not be called");
      },
      uploadActiveTime: async () => {
        throw new Error("must not be called");
      },
    });
    expect(blockedRetry.state).toBe("blocked");
    expect(stateAttempts).toBe(1);

    await offline.discardConflictedStateBranch(bootstrap.player_id);
    expect(await offline.getNextExpectedRevision(bootstrap.player_id)).toBe(44);
    expect((await offline.getBootstrap(bootstrap.player_id))?.state).toEqual(
      conflict.state,
    );
  });

  it("reports transient state failure while still delivering independent queued events", async () => {
    const persistence = new MemoryOfflinePersistence();
    const offline = new GameOfflineStore(
      persistence,
      () => "event-generated-1",
    );
    const bootstrap = fixture<PlayerBootstrapV1>(
      "returning-player-bootstrap.json",
    );
    await offline.cacheBootstrap(bootstrap);
    await offline.enqueueState(
      bootstrap.player_id,
      fixture<StateSaveRequestV1>("state-save-request.json"),
    );
    await offline.enqueueResult(
      bootstrap.player_id,
      fixture<ResultSubmissionV1>("result-submission.json"),
    );

    const report = await offline.sync(bootstrap.player_id, {
      saveState: async () => {
        throw new Error("temporarily offline");
      },
      uploadResult: async (event) => ({
        type: "portal.result_ack.v1",
        client_event_id: event.client_event_id,
      }),
      uploadActiveTime: async () => {
        throw new Error("unused");
      },
    });

    expect(report.state).toBe("pending");
    expect(report.failedStream).toBe("state");
    expect(report.uploadedResults).toBe(1);
    expect(
      (await offline.getSyncStatus(bootstrap.player_id)).queuedStates,
    ).toBe(1);
  });
});
