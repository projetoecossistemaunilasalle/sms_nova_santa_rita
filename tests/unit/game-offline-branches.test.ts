import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import type { PlayerBootstrapV2, StateSaveRequestV2 } from "@/contracts/v2";
import { openGameOfflineStore } from "@/runtime/offline/sync-engine";
import {
  openDatabase,
  IndexedDbGameOfflinePersistence,
} from "@/runtime/offline/indexed-db";
import { GameTransportError } from "@/runtime/offline/network";
import {
  OfflineBranchChangedError,
  OfflineStateBlockedError,
} from "@/runtime/offline/errors";
import type { GameOfflineTransport } from "@/runtime/offline/types";

const fixture = <T>(name: string): T =>
  JSON.parse(
    readFileSync(resolve("contracts/fixtures/v2/valid", name), "utf8"),
  ) as T;
const bootstrap = fixture<PlayerBootstrapV2>("returning-player-bootstrap.json");
const request = fixture<StateSaveRequestV2>("state-save-request.json");
const player = bootstrap.player_id;
const accepted: GameOfflineTransport = {
  saveState: async (queued) => ({
    type: "portal.save_ok.v2",
    request_id: queued.request_id,
    revision: queued.expected_revision + 1,
  }),
  uploadResult: async () => {
    throw new Error("unused");
  },
  uploadActiveTime: async () => {
    throw new Error("unused");
  },
};

describe("owned offline state branches", () => {
  it("ignores delayed rejection and conflict replies after the original branch was archived", async () => {
    const db = await openDatabase(new IDBFactory());
    try {
      const persistence = new IndexedDbGameOfflinePersistence(db);
      const generation = await persistence.reserveBootstrapGeneration(player);
      await persistence.cacheBootstrap(bootstrap, generation);
      await persistence.enqueueState(
        player,
        request,
        bootstrap.class_session_id,
      );
      await persistence.rejectStateBranch(player, {
        requestId: request.request_id,
        status: 403,
      });
      await persistence.discardStateBranch(player, request.request_id);
      await persistence.enqueueState(
        player,
        { ...request, request_id: "replacement" },
        bootstrap.class_session_id,
      );
      await persistence.rejectStateBranch(player, {
        requestId: request.request_id,
        status: 403,
      });
      await persistence.blockState(player, {
        type: "portal.save_conflict.v2",
        request_id: request.request_id,
        revision: 100,
        stored_content_version: request.content_version,
        state: request.state,
      });
      expect((await persistence.status(player)).stateBlocked).toBe(false);
      expect((await persistence.getBootstrap(player))?.revision).toBe(7);
      expect(
        (await persistence.listStates(player)).map((state) => state.requestId),
      ).toEqual(["replacement"]);
    } finally {
      db.close();
    }
  });
  it("allocates revisions only within the instance that loaded the branch", async () => {
    const factory = new IDBFactory();
    const first = await openGameOfflineStore({ indexedDB: factory });
    const second = await openGameOfflineStore({ indexedDB: factory });
    try {
      await first.cacheBootstrap(bootstrap);
      await first.enqueueState(player, request);
      await first.enqueueState(player, {
        ...request,
        request_id: "second-save",
      });
      await expect(
        second.enqueueState(player, { ...request, request_id: "stale" }),
      ).rejects.toBeInstanceOf(OfflineBranchChangedError);
      const revisions: number[] = [];
      await first.sync(player, {
        ...accepted,
        saveState: async (queued) => {
          revisions.push(queued.expected_revision);
          return accepted.saveState(queued);
        },
      });
      expect(revisions).toEqual([7, 8]);
      await first.enqueueState(player, {
        ...request,
        request_id: "after-sync",
      });
      await first.sync(player, {
        ...accepted,
        saveState: async (queued) => {
          expect(queued.expected_revision).toBe(9);
          return accepted.saveState(queued);
        },
      });
    } finally {
      first.close();
      second.close();
    }
  });

  it("does not adopt another instance's queued branch even at the same revision", async () => {
    const factory = new IDBFactory();
    const first = await openGameOfflineStore({ indexedDB: factory });
    const second = await openGameOfflineStore({ indexedDB: factory });
    try {
      await first.cacheBootstrap(bootstrap);
      await first.enqueueState(player, request);
      await second.cacheBootstrap({
        ...bootstrap,
        request_id: "second-bootstrap",
      });
      await expect(
        second.enqueueState(player, { ...request, request_id: "other-save" }),
      ).rejects.toBeInstanceOf(OfflineBranchChangedError);
      await expect(
        first.enqueueState(player, { ...request, request_id: "stale-save" }),
      ).rejects.toBeInstanceOf(OfflineBranchChangedError);
    } finally {
      first.close();
      second.close();
    }
  });

  it("preserves submitted revisions for legacy callers without branch ownership", async () => {
    const db = await openDatabase(new IDBFactory());
    try {
      const persistence = new IndexedDbGameOfflinePersistence(db);
      const generation = await persistence.reserveBootstrapGeneration(player);
      await persistence.cacheBootstrap(
        { ...bootstrap, revision: 8 },
        generation,
      );
      expect(
        (await persistence.enqueueState(player, request)).request
          .expected_revision,
      ).toBe(7);
    } finally {
      db.close();
    }
  });

  it("does not upgrade a newly loaded branch when an older branch finishes syncing", async () => {
    const factory = new IDBFactory();
    const first = await openGameOfflineStore({ indexedDB: factory });
    const second = await openGameOfflineStore({ indexedDB: factory });
    try {
      await first.cacheBootstrap(bootstrap);
      await first.enqueueState(player, request);
      await second.cacheBootstrap({
        ...bootstrap,
        request_id: "second-bootstrap",
      });
      await first.sync(player, accepted);
      expect((await second.getBootstrap(player))?.revision).toBe(7);
      await second.enqueueState(player, {
        ...request,
        request_id: "other-save",
      });
      const report = await second.sync(player, {
        ...accepted,
        saveState: async (queued) => {
          expect(queued.expected_revision).toBe(7);
          return {
            type: "portal.save_conflict.v2",
            request_id: queued.request_id,
            revision: 8,
            state: request.state,
          };
        },
      });
      expect(report.state).toBe("blocked");
    } finally {
      first.close();
      second.close();
    }
  });

  it("persists rejection, archives on explicit recovery, and starts a fresh session without relabeling old saves", async () => {
    const factory = new IDBFactory();
    let store = await openGameOfflineStore({ indexedDB: factory });
    const saveState = vi.fn(async () => {
      throw new GameTransportError(false, 403);
    });
    try {
      await store.cacheBootstrap(bootstrap);
      await store.enqueueState(player, request, bootstrap.class_session_id);
      await store.enqueueState(
        player,
        { ...request, request_id: "dependent-save" },
        bootstrap.class_session_id,
      );
      expect(
        await store.sync(player, { ...accepted, saveState }),
      ).toMatchObject({
        state: "blocked",
        rejection: { requestId: request.request_id, status: 403 },
        retryable: false,
      });
      store.close();
      store = await openGameOfflineStore({ indexedDB: factory });
      expect((await store.sync(player, { ...accepted, saveState })).state).toBe(
        "blocked",
      );
      expect(saveState).toHaveBeenCalledTimes(1);
      await store.cacheBootstrap({
        ...bootstrap,
        request_id: "next-bootstrap",
        class_session_id: "next-session",
      });
      await expect(
        store.enqueueState(
          player,
          { ...request, request_id: "new-save" },
          "next-session",
        ),
      ).rejects.toBeInstanceOf(OfflineStateBlockedError);
      await expect(
        store.discardConflictedStateBranch(player, "wrong-request"),
      ).rejects.toBeInstanceOf(OfflineBranchChangedError);
      expect((await store.getSyncStatus(player)).queuedStates).toBe(2);
      await store.discardConflictedStateBranch(player, request.request_id);
      await expect(store.enqueueState(player, request)).rejects.toBeInstanceOf(
        OfflineBranchChangedError,
      );
      await store.cacheBootstrap({
        ...bootstrap,
        request_id: "fresh-bootstrap",
        class_session_id: "next-session",
      });
      await store.enqueueState(
        player,
        { ...request, request_id: "new-save" },
        "next-session",
      );
      const success = vi.fn(accepted.saveState);
      expect(
        (await store.sync(player, { ...accepted, saveState: success })).state,
      ).toBe("synced");
      expect(success).toHaveBeenCalledWith(
        expect.objectContaining({
          request_id: "new-save",
          expected_revision: 7,
        }),
        "next-session",
      );
      await expect(
        store.discardConflictedStateBranch(player, request.request_id),
      ).rejects.toBeInstanceOf(OfflineBranchChangedError);

      const db = await openDatabase(factory);
      try {
        const archives = await new Promise<
          Array<{
            states: Array<{ classSessionId: string; requestId: string }>;
          }>
        >((resolve, reject) => {
          const read = db
            .transaction("stateBranchArchives")
            .objectStore("stateBranchArchives")
            .getAll();
          read.onsuccess = () => resolve(read.result);
          read.onerror = () => reject(read.error);
        });
        expect(archives).toHaveLength(1);
        expect(
          archives[0]!.states.map((state) => state.classSessionId),
        ).toEqual([bootstrap.class_session_id, bootstrap.class_session_id]);
        expect(archives[0]!.states.map((state) => state.requestId)).toEqual([
          request.request_id,
          "dependent-save",
        ]);
      } finally {
        db.close();
      }
    } finally {
      store.close();
    }
  });

  it("does not quarantine transient network failures", async () => {
    const store = await openGameOfflineStore({ indexedDB: new IDBFactory() });
    try {
      await store.cacheBootstrap(bootstrap);
      await store.enqueueState(player, request);
      expect(
        await store.sync(player, {
          ...accepted,
          saveState: async () => {
            throw new GameTransportError(true, 503);
          },
        }),
      ).toMatchObject({ state: "pending", retryable: true });
      expect((await store.getSyncStatus(player)).rejection).toBeUndefined();
      expect((await store.sync(player, accepted)).state).toBe("synced");
    } finally {
      store.close();
    }
  });
});
