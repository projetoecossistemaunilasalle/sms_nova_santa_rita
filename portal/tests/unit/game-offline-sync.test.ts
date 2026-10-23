import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { IDBFactory } from "fake-indexeddb";

import {
  OfflineRequestReuseError,
  OfflineSessionMismatchError,
  OfflineBranchChangedError,
} from "@/runtime/offline/errors";
import {
  IndexedDbGameOfflinePersistence,
  openDatabase,
} from "@/runtime/offline/indexed-db";
import {
  GameOfflineStore,
  openGameOfflineStore,
} from "@/runtime/offline/sync-engine";
import type {
  EventRequestIdentity,
  GameOfflinePersistence,
  QueuedActiveTime,
  QueuedEvent,
  QueuedResult,
  QueuedStateSave,
  StateRejection,
} from "@/runtime/offline/types";
import type {
  ActiveTimeSubmissionV2,
  PlayerBootstrapV2,
  ResultEventV2,
  ResultSubmissionV2,
  StateSaveConflictV2,
  StateSaveRequestV2,
  StateSaveSuccessV2,
} from "@/contracts/v2";

const fixture = <T>(name: string): T =>
  JSON.parse(
    readFileSync(
      resolve(process.cwd(), "contracts", "fixtures", "v2", "valid", name),
      "utf8",
    ),
  ) as T;

class MemoryOfflinePersistence implements GameOfflinePersistence {
  private nextSequence = 1;
  private bootstraps = new Map<string, PlayerBootstrapV2>();
  private bootstrapGenerations = new Map<string, number>();
  private states: QueuedStateSave[] = [];
  private events: QueuedEvent[] = [];
  private eventRequests = new Map<
    string,
    { fingerprint: string; clientEventId: string }
  >();
  private conflicts = new Map<string, StateSaveConflictV2>();
  private rejections = new Map<string, StateRejection>();

  async getBootstrap(playerId: string) {
    return this.bootstraps.get(playerId) ?? null;
  }

  async reserveBootstrapGeneration(playerId: string) {
    const generation = (this.bootstrapGenerations.get(playerId) ?? 0) + 1;
    this.bootstrapGenerations.set(playerId, generation);
    return generation;
  }

  async cacheBootstrap(bootstrap: PlayerBootstrapV2, generation: number) {
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
    request: StateSaveRequestV2,
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
      classSessionId: bootstrap.class_session_id,
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
    success: StateSaveSuccessV2,
  ) {
    const bootstrap = this.bootstraps.get(playerId);
    if (bootstrap && bootstrap.revision <= success.revision) {
      this.bootstraps.set(playerId, {
        type: "portal.bootstrap.v2",
        request_id: queued.request.request_id,
        protocol_version: bootstrap.protocol_version,
        player_id: bootstrap.player_id,
        class_session_id: bootstrap.class_session_id,
        content_policy: bootstrap.content_policy,
        stored_content_version: queued.request.content_version,
        revision: success.revision,
        new_player: false,
        state: queued.request.state,
      });
    }
    this.states = this.states.filter((item) => item.id !== queued.id);
  }

  async blockState(playerId: string, conflict: StateSaveConflictV2) {
    const bootstrap = this.bootstraps.get(playerId);
    if (bootstrap && bootstrap.revision <= conflict.revision) {
      this.bootstraps.set(playerId, {
        type: "portal.bootstrap.v2",
        request_id: conflict.request_id,
        protocol_version: bootstrap.protocol_version,
        player_id: bootstrap.player_id,
        class_session_id: bootstrap.class_session_id,
        content_policy: bootstrap.content_policy,
        stored_content_version: conflict.stored_content_version,
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

  async getStateRejection(playerId: string) {
    return this.rejections.get(playerId) ?? null;
  }
  async rejectStateBranch(playerId: string, rejection: StateRejection) {
    this.rejections.set(playerId, rejection);
  }

  async discardStateBranch(playerId: string) {
    this.states = this.states.filter((item) => item.playerId !== playerId);
    this.conflicts.delete(playerId);
    this.rejections.delete(playerId);
  }

  async enqueueResult(
    playerId: string,
    classSessionId: string,
    event: ResultEventV2,
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
    const bootstrap = fixture<PlayerBootstrapV2>(
      "returning-player-bootstrap.json",
    );
    const request = fixture<StateSaveRequestV2>("state-save-request.json");
    await offline.cacheBootstrap(bootstrap);

    const firstAck = await offline.enqueueState(bootstrap.player_id, request);
    const secondAck = await offline.enqueueState(bootstrap.player_id, {
      ...request,
      request_id: "request-save-002",
    });
    const retryAck = await offline.enqueueState(bootstrap.player_id, request);

    expect(firstAck).toEqual({
      type: "portal.local_durable.v2",
      record_type: "state",
      request_id: request.request_id,
    });
    expect(secondAck).toEqual({
      type: "portal.local_durable.v2",
      record_type: "state",
      request_id: "request-save-002",
    });
    expect(retryAck).toEqual(firstAck);
    expect(await offline.getNextExpectedRevision(bootstrap.player_id)).toBe(9);
    expect(
      (await persistence.listStates(bootstrap.player_id)).map(
        (item) => item.request.expected_revision,
      ),
    ).toEqual([7, 8]);
  });

  it("allocates stable event IDs and does not reuse a request ID for changed content", async () => {
    const persistence = new MemoryOfflinePersistence();
    let eventNumber = 0;
    const offline = new GameOfflineStore(
      persistence,
      () => `event-generated-${++eventNumber}`,
    );
    const bootstrap = fixture<PlayerBootstrapV2>(
      "returning-player-bootstrap.json",
    );
    await offline.cacheBootstrap(bootstrap);
    const result = fixture<ResultSubmissionV2>("result-submission.json");
    const resultAck = await offline.enqueueResult(bootstrap.player_id, result);
    const resultRetry = await offline.enqueueResult(
      bootstrap.player_id,
      result,
    );
    const time = fixture<ActiveTimeSubmissionV2>("active-time-submission.json");
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
          request_id: "time-1",
          client_event_id: "event-generated-3",
        },
        {
          request_id: "time-2",
          client_event_id: "event-generated-4",
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
    const bootstrap = fixture<PlayerBootstrapV2>(
      "returning-player-bootstrap.json",
    );
    const result = fixture<ResultSubmissionV2>("result-submission.json");
    const activeTime = fixture<ActiveTimeSubmissionV2>(
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
        type: "portal.result_ack.v2",
        client_event_id: event.client_event_id,
      }),
      uploadActiveTime: async (batch) => ({
        type: "portal.active_time_ack.v2",
        acknowledged_event_ids: batch.events.map(
          (event) => event.client_event_id,
        ),
      }),
    });
    expect(syncReport.uploadedResults).toBe(1);
    expect(syncReport.uploadedActiveTimeEvents).toBe(2);
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
    const bootstrap = fixture<PlayerBootstrapV2>(
      "returning-player-bootstrap.json",
    );
    await offline.cacheBootstrap(bootstrap);
    await offline.enqueueResult(
      bootstrap.player_id,
      fixture<ResultSubmissionV2>("result-submission.json"),
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
    const bootstrap = fixture<PlayerBootstrapV2>(
      "returning-player-bootstrap.json",
    );
    const oldGeneration = await offline.reserveBootstrapGeneration(
      bootstrap.player_id,
    );
    await offline.cacheBootstrap(bootstrap, oldGeneration);

    const oldResult = fixture<ResultSubmissionV2>("result-submission.json");
    const oldActiveTime = fixture<ActiveTimeSubmissionV2>(
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
        fixture<StateSaveRequestV2>("state-save-request.json"),
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
            type: "portal.result_ack.v2",
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
    const bootstrap = fixture<PlayerBootstrapV2>(
      "returning-player-bootstrap.json",
    );
    const save = fixture<StateSaveRequestV2>("state-save-request.json");
    const result = fixture<ResultSubmissionV2>("result-submission.json");
    const activeTime = fixture<ActiveTimeSubmissionV2>(
      "active-time-submission.json",
    );
    const conflict = fixture<StateSaveConflictV2>(
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
        type: "portal.result_ack.v2",
        client_event_id: event.client_event_id,
      }),
      uploadActiveTime: async (batch) => ({
        type: "portal.active_time_ack.v2",
        acknowledged_event_ids: batch.events.map(
          (event) => event.client_event_id,
        ),
      }),
    });

    expect(report.state).toBe("blocked");
    expect(report.conflict?.revision).toBe(9);
    expect(report.uploadedResults).toBe(1);
    expect(report.uploadedActiveTimeEvents).toBe(2);
    expect(report.eventAcknowledgements).toHaveLength(3);
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
          type: "portal.save_ok.v2",
          request_id: save.request_id,
          revision: 8,
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
    expect(await offline.getNextExpectedRevision(bootstrap.player_id)).toBe(9);
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
    const bootstrap = fixture<PlayerBootstrapV2>(
      "returning-player-bootstrap.json",
    );
    await offline.cacheBootstrap(bootstrap);
    await offline.enqueueState(
      bootstrap.player_id,
      fixture<StateSaveRequestV2>("state-save-request.json"),
    );
    await offline.enqueueResult(
      bootstrap.player_id,
      fixture<ResultSubmissionV2>("result-submission.json"),
    );

    const report = await offline.sync(bootstrap.player_id, {
      saveState: async () => {
        throw new Error("temporarily offline");
      },
      uploadResult: async (event) => ({
        type: "portal.result_ack.v2",
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

describe("offline persistence lifecycle (IndexedDB)", () => {
  it("opens an isolated V2 database without replaying or deleting V1 queues", async () => {
    const factory = new IDBFactory();
    const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = factory.open("missoes-caramelito-game-v1", 1);
      open.onupgradeneeded = () => open.result.createObjectStore("stateQueue");
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const write = legacy.transaction("stateQueue", "readwrite");
    write.objectStore("stateQueue").put({ type: "game.save.v1" }, "old-save");
    await new Promise<void>((resolve) => {
      write.oncomplete = () => resolve();
    });
    const store = await openGameOfflineStore({ indexedDB: factory });
    const database = await openDatabase(factory);
    try {
      expect(database.name).toBe("missoes-caramelito-game-v2");
      expect(await store.getBootstrap("fixture-player")).toBeNull();
      expect(await store.getSyncStatus("fixture-player")).toMatchObject({
        queuedStates: 0,
        queuedResults: 0,
        queuedActiveTime: 0,
      });
      const old = legacy
        .transaction("stateQueue")
        .objectStore("stateQueue")
        .get("old-save");
      expect(
        await new Promise((resolve) => {
          old.onsuccess = () => resolve(old.result);
        }),
      ).toEqual({ type: "game.save.v1" });
    } finally {
      store.close();
      database.close();
      legacy.close();
    }
  });

  it("preserves the frozen policy and content versions after durable saves and conflicts", async () => {
    const factory = new IDBFactory();
    const store = await openGameOfflineStore({ indexedDB: factory });
    const bootstrap = fixture<PlayerBootstrapV2>(
      "returning-player-bootstrap.json",
    );
    const request = fixture<StateSaveRequestV2>("state-save-request.json");
    const persistence = new IndexedDbGameOfflinePersistence(
      await openDatabase(factory),
    );
    try {
      await store.cacheBootstrap(bootstrap);
      const durable = await store.enqueueState(bootstrap.player_id, request);
      expect(durable).toEqual({
        type: "portal.local_durable.v2",
        record_type: "state",
        request_id: request.request_id,
      });
      await expect(
        store.enqueueState(bootstrap.player_id, {
          ...request,
          content_version: "different-content",
        }),
      ).rejects.toBeInstanceOf(OfflineRequestReuseError);
      const queued = (await persistence.listStates(bootstrap.player_id))[0]!;
      await persistence.acknowledgeState(bootstrap.player_id, queued, {
        type: "portal.save_ok.v2",
        request_id: request.request_id,
        revision: 8,
      });
      expect(await store.getBootstrap(bootstrap.player_id)).toMatchObject({
        content_policy: bootstrap.content_policy,
        stored_content_version: request.content_version,
        revision: 8,
      });
      await store.enqueueState(bootstrap.player_id, {
        ...request,
        request_id: "conflict-save",
        expected_revision: 8,
      });
      await persistence.blockState(bootstrap.player_id, {
        ...fixture<StateSaveConflictV2>("stale-revision-conflict.json"),
        request_id: "conflict-save",
        stored_content_version: "authoritative-version",
      });
      expect(await store.getBootstrap(bootstrap.player_id)).toMatchObject({
        content_policy: bootstrap.content_policy,
        stored_content_version: "authoritative-version",
        revision: 9,
      });
    } finally {
      store.close();
      persistence.close();
    }
  });

  it("fences a stale game instance instead of upgrading its revision", async () => {
    const factory = new IDBFactory();
    const first = await openGameOfflineStore({ indexedDB: factory });
    const second = await openGameOfflineStore({ indexedDB: factory });
    const bootstrap = fixture<PlayerBootstrapV2>(
      "returning-player-bootstrap.json",
    );
    const request = fixture<StateSaveRequestV2>("state-save-request.json");
    try {
      await first.cacheBootstrap(bootstrap);
      await second.cacheBootstrap({
        ...bootstrap,
        request_id: "tab-b-bootstrap",
        revision: 8,
      });
      await expect(
        first.enqueueState(bootstrap.player_id, {
          ...request,
          request_id: "tab-a",
        }),
      ).rejects.toBeInstanceOf(OfflineBranchChangedError);
      await second.enqueueState(bootstrap.player_id, {
        ...request,
        expected_revision: 8,
        request_id: "tab-b",
      });
      const revisions: number[] = [];
      await first.sync(bootstrap.player_id, {
        saveState: async (queued) => {
          revisions.push(queued.expected_revision);
          return {
            type: "portal.save_ok.v2",
            request_id: queued.request_id,
            revision: queued.expected_revision + 1,
          };
        },
        uploadResult: async () => {
          throw new Error("unused");
        },
        uploadActiveTime: async () => {
          throw new Error("unused");
        },
      });
      expect(revisions).toEqual([8]);
    } finally {
      first.close();
      second.close();
    }
  });

  it("preserves discarded state in a local backup and does not overwrite it on a repeated acknowledgement", async () => {
    const factory = new IDBFactory();
    const store = await openGameOfflineStore({ indexedDB: factory });
    const bootstrap = fixture<PlayerBootstrapV2>(
      "returning-player-bootstrap.json",
    );
    const request = fixture<StateSaveRequestV2>("state-save-request.json");
    await store.cacheBootstrap(bootstrap);
    await store.enqueueState(bootstrap.player_id, request);
    await store.discardConflictedStateBranch(bootstrap.player_id);
    await store.discardConflictedStateBranch(bootstrap.player_id);
    expect((await store.getSyncStatus(bootstrap.player_id)).queuedStates).toBe(
      0,
    );
    store.close();
    const database = await openDatabase(factory);
    try {
      const backup = await new Promise<{ states: QueuedStateSave[] }>(
        (resolve, reject) => {
          const read = database
            .transaction("stateBackups")
            .objectStore("stateBackups")
            .get(bootstrap.player_id);
          read.onsuccess = () => resolve(read.result);
          read.onerror = () => reject(read.error);
        },
      );
      expect(backup.states).toHaveLength(1);
      expect(backup.states[0]?.request.state).toEqual(request.state);
      expect(backup.states[0]?.classSessionId).toBe(bootstrap.class_session_id);
    } finally {
      database.close();
    }
  });

  it("migrates V3 saves without losing their original session association", async () => {
    const factory = new IDBFactory();
    const bootstrap = fixture<PlayerBootstrapV2>(
      "returning-player-bootstrap.json",
    );
    const request = fixture<StateSaveRequestV2>("state-save-request.json");
    const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = factory.open("missoes-caramelito-game-v2", 3);
      open.onupgradeneeded = () => {
        open.result.createObjectStore("bootstraps", { keyPath: "playerId" });
        const states = open.result.createObjectStore("stateQueue", {
          keyPath: "id",
          autoIncrement: true,
        });
        states.createIndex("byPlayer", "playerId");
        states.createIndex("byPlayerRequest", ["playerId", "requestId"], {
          unique: true,
        });
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    await new Promise<void>((resolve, reject) => {
      const write = legacy.transaction(
        ["bootstraps", "stateQueue"],
        "readwrite",
      );
      write
        .objectStore("bootstraps")
        .put({ playerId: bootstrap.player_id, bootstrap });
      write.objectStore("stateQueue").put({
        playerId: bootstrap.player_id,
        requestId: request.request_id,
        request,
        queuedAt: 1,
      });
      write.oncomplete = () => resolve();
      write.onerror = () => reject(write.error);
    });
    legacy.close();
    const database = await openDatabase(factory);
    try {
      const states = await new IndexedDbGameOfflinePersistence(
        database,
      ).listStates(bootstrap.player_id);
      expect(states).toHaveLength(1);
      expect(states[0]?.classSessionId).toBe(bootstrap.class_session_id);
      expect(states[0]?.request).toEqual(request);
    } finally {
      database.close();
    }
  });
  it("persists a queued state save across close and reopen through the production store", async () => {
    const bootstrap = fixture<PlayerBootstrapV2>(
      "returning-player-bootstrap.json",
    );
    const request = fixture<StateSaveRequestV2>("state-save-request.json");
    const factory = new IDBFactory();

    const store = await openGameOfflineStore({ indexedDB: factory });
    await store.cacheBootstrap(bootstrap);
    const acknowledgement = await store.enqueueState(
      bootstrap.player_id,
      request,
    );
    expect(acknowledgement).toEqual({
      type: "portal.local_durable.v2",
      record_type: "state",
      request_id: request.request_id,
    });
    store.close();

    const reopened = await openGameOfflineStore({ indexedDB: factory });
    try {
      expect(await reopened.getSyncStatus(bootstrap.player_id)).toEqual({
        queuedStates: 1,
        queuedResults: 0,
        queuedActiveTime: 0,
        stateBlocked: false,
      });
      expect(await reopened.getNextExpectedRevision(bootstrap.player_id)).toBe(
        bootstrap.revision + 1,
      );
    } finally {
      reopened.close();
    }

    const database = await openDatabase(factory);
    try {
      const persistence = new IndexedDbGameOfflinePersistence(database);
      const states = await persistence.listStates(bootstrap.player_id);
      expect(states).toHaveLength(1);
      const [queued] = states;
      expect(queued?.id).toBe(1);
      expect(queued?.playerId).toBe(bootstrap.player_id);
      expect(queued?.requestId).toBe(request.request_id);
      expect(queued?.request).toEqual({
        ...request,
        expected_revision: bootstrap.revision,
      });
      expect(typeof queued?.queuedAt).toBe("number");
    } finally {
      database.close();
    }
  });
});
