import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  GameStateError,
  GameStateService,
  type GameStateStore,
  type GameStateTransaction,
  type LaunchScope,
  type StoredGameState,
} from "@/application/game-state/service";
import {
  parseGameStateV2,
  type StateSaveRequestV2,
  GAME_STATE_MAX_UTF8_BYTES,
  serializedStateUtf8Bytes,
} from "@/contracts/v2";
import { resolvePolicy } from "@/application/game-content/policy";
import { demoGameContentSeed } from "@/server/mock/content-seed";
import {
  GameSessionStatus,
  PlayerCredentialStatus,
  RecordStatus,
} from "@/generated/prisma/enums";
import type { LaunchTokenContext } from "@/server/security/launch-token";

const contentVersion = "saved-game-version";
const state = parseGameStateV2(
  JSON.parse(
    readFileSync(
      resolve(process.cwd(), "contracts/fixtures/v2/valid/game-state.json"),
      "utf8",
    ),
  ),
);

const context: LaunchTokenContext = {
  credentialId: "credential-1",
  participationId: "participation-1",
  playerSlotId: "player-1",
  gameSessionId: "session-1",
};

class MemoryStore implements GameStateStore, GameStateTransaction {
  scope: LaunchScope | null = {
    ...context,
    credentialStatus: PlayerCredentialStatus.ACTIVE,
    playerStatus: RecordStatus.ACTIVE,
    classStatus: RecordStatus.ACTIVE,
    organizationStatus: RecordStatus.ACTIVE,
    sessionStatus: GameSessionStatus.ACTIVE,
    contentPolicy: resolvePolicy(null, demoGameContentSeed()[0]!.payload),
  };
  current: StoredGameState | null = null;
  failNextWrite = false;

  async transaction<T>(
    work: (transaction: GameStateTransaction) => Promise<T>,
  ): Promise<T> {
    return work(this);
  }
  async getLaunchScope(value: LaunchTokenContext) {
    return value.participationId === context.participationId
      ? this.scope
      : null;
  }
  async getState() {
    return this.current;
  }
  async createState(
    _playerSlotId: string,
    next: typeof state,
    contentVersion: string,
  ) {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      return false;
    }
    this.current = { revision: 1, state: next, contentVersion };
    return true;
  }
  async updateState(
    _playerSlotId: string,
    expected: number,
    next: typeof state,
    contentVersion: string,
  ) {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      return false;
    }
    if (this.current?.revision !== expected) return false;
    this.current = { revision: expected + 1, state: next, contentVersion };
    return true;
  }
}

function saveRequest(expectedRevision: number): StateSaveRequestV2 {
  return {
    type: "game.save.v2",
    content_version: contentVersion,
    request_id: `save-${expectedRevision}`,
    expected_revision: expectedRevision,
    state,
  };
}

function reverseObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .reverse()
        .map(([key, item]) => [key, reverseObjectKeys(item)]),
    );
  }
  return value;
}

describe("GameStateService", () => {
  it("accepts exactly 262144 UTF-8 state bytes and rejects one more without a write", async () => {
    const store = new MemoryStore();
    const service = new GameStateService(store, () => ({
      valid: true,
      payload: context,
    }));
    const empty = { schema_version: 3 as const, padding: "" };
    const room = GAME_STATE_MAX_UTF8_BYTES - serializedStateUtf8Bytes(empty);
    const boundary = {
      ...empty,
      padding: "é".repeat(Math.floor(room / 2)) + "a".repeat(room % 2),
    };
    expect(serializedStateUtf8Bytes(boundary)).toBe(GAME_STATE_MAX_UTF8_BYTES);
    await expect(
      service.save("launch", { ...saveRequest(0), state: boundary }),
    ).resolves.toMatchObject({ revision: 1 });
    await expect(
      service.save("launch", {
        ...saveRequest(1),
        state: { ...boundary, padding: boundary.padding + "x" },
      }),
    ).rejects.toThrow("262144");
    expect(store.current?.revision).toBe(1);
  });

  it("bootstraps the frozen policy and the saved version, not the policy's authored version", async () => {
    const store = new MemoryStore();
    const service = new GameStateService(store, () => ({
      valid: true,
      payload: context,
    }));
    const fresh = await service.bootstrap("launch", "fresh");
    expect(fresh).toMatchObject({
      type: "portal.bootstrap.v2",
      protocol_version: 2,
      content_policy: store.scope!.contentPolicy,
      stored_content_version: null,
    });
    await service.save("launch", saveRequest(0));
    const returning = await service.bootstrap("launch", "returning");
    expect(returning.content_policy).toEqual(store.scope!.contentPolicy);
    expect(returning.stored_content_version).toBe(contentVersion);
  });

  it("does not acknowledge an otherwise identical retry with a different content version", async () => {
    const store = new MemoryStore();
    const service = new GameStateService(store, () => ({
      valid: true,
      payload: context,
    }));
    await service.save("launch", saveRequest(0));
    await expect(
      service.save("launch", {
        ...saveRequest(0),
        content_version: "different",
      }),
    ).resolves.toMatchObject({
      type: "portal.save_conflict.v2",
      stored_content_version: contentVersion,
      revision: 1,
    });
  });

  it("permits late state saves within 24 hours but never bootstraps a flush token", async () => {
    const store = new MemoryStore();
    const endedAt = new Date("2026-10-12T12:00:00Z");
    store.scope!.sessionStatus = GameSessionStatus.ENDED;
    store.scope!.sessionEndedAt = endedAt;
    const service = new GameStateService(
      store,
      () => ({ valid: true, payload: { ...context, purpose: "flush" } }),
      () => new Date(endedAt.getTime() + 60_000),
    );
    await expect(service.save("launch", saveRequest(0))).resolves.toMatchObject(
      { type: "portal.save_ok.v2", revision: 1 },
    );
    await expect(
      service.bootstrap("launch", "late-bootstrap"),
    ).rejects.toMatchObject({ code: "SESSION_ENDED" });
    store.scope!.sessionStatus = GameSessionStatus.ACTIVE;
    await expect(
      service.bootstrap("launch", "flush-only"),
    ).rejects.toMatchObject({ code: "SESSION_ENDED" });
    store.scope!.sessionStatus = GameSessionStatus.ENDED;
    const expired = new GameStateService(
      store,
      () => ({ valid: true, payload: context }),
      () => new Date(endedAt.getTime() + 24 * 60 * 60 * 1000),
    );
    await expect(expired.save("launch", saveRequest(1))).rejects.toMatchObject({
      code: "SESSION_ENDED",
    });
  });
  it("bootstraps a new player, saves, and loads the state on a later bootstrap", async () => {
    const store = new MemoryStore();
    const service = new GameStateService(store, () => ({
      valid: true,
      payload: context,
    }));
    expect(await service.bootstrap("launch", "first")).toMatchObject({
      new_player: true,
      revision: 0,
      state: null,
      player_id: context.playerSlotId,
      class_session_id: context.gameSessionId,
    });
    expect(await service.save("launch", saveRequest(0))).toEqual({
      type: "portal.save_ok.v2",
      request_id: "save-0",
      revision: 1,
    });
    const secondDevice = new GameStateService(store, () => ({
      valid: true,
      payload: context,
    }));
    expect(
      await secondDevice.bootstrap("launch", "other-device"),
    ).toMatchObject({
      new_player: false,
      revision: 1,
      state,
    });
  });

  it("returns the authoritative snapshot on a stale revision", async () => {
    const store = new MemoryStore();
    store.current = { revision: 3, state, contentVersion };
    const service = new GameStateService(store, () => ({
      valid: true,
      payload: context,
    }));
    expect(await service.save("launch", saveRequest(1))).toEqual({
      type: "portal.save_conflict.v2",
      stored_content_version: contentVersion,
      request_id: "save-1",
      revision: 3,
      state,
    });
    expect(store.current.revision).toBe(3);
  });

  it("acknowledges a retry after the original save committed but its response was lost", async () => {
    const store = new MemoryStore();
    const service = new GameStateService(store, () => ({
      valid: true,
      payload: context,
    }));
    const request = saveRequest(0);

    await expect(service.save("launch", request)).resolves.toEqual({
      type: "portal.save_ok.v2",
      request_id: request.request_id,
      revision: 1,
    });
    await expect(
      service.save("launch", {
        ...request,
        state: reverseObjectKeys(request.state) as typeof state,
      }),
    ).resolves.toEqual({
      type: "portal.save_ok.v2",
      request_id: request.request_id,
      revision: 1,
    });
    expect(store.current).toEqual({ revision: 1, state, contentVersion });
  });

  it("still returns a conflict for a stale save with a different snapshot", async () => {
    const store = new MemoryStore();
    store.current = { revision: 1, state, contentVersion };
    const service = new GameStateService(store, () => ({
      valid: true,
      payload: context,
    }));
    const request = saveRequest(0);
    const differentState = {
      ...state,
      opaque_game_field: 1,
    };

    await expect(
      service.save("launch", { ...request, state: differentState }),
    ).resolves.toEqual({
      type: "portal.save_conflict.v2",
      stored_content_version: contentVersion,
      request_id: request.request_id,
      revision: 1,
      state,
    });
    expect(store.current).toEqual({ revision: 1, state, contentVersion });
  });

  it("rejects expired, revoked, and ended launch contexts", async () => {
    const store = new MemoryStore();
    const expired = new GameStateService(store, () => ({
      valid: false,
      reason: "expired",
    }));
    await expect(expired.bootstrap("launch", "x")).rejects.toMatchObject({
      code: "EXPIRED_LAUNCH",
    });

    const service = new GameStateService(store, () => ({
      valid: true,
      payload: context,
    }));
    store.scope!.credentialStatus = PlayerCredentialStatus.REVOKED;
    await expect(service.save("launch", saveRequest(0))).rejects.toMatchObject({
      code: "INACTIVE_ACCESS",
    });
    store.scope!.credentialStatus = PlayerCredentialStatus.ACTIVE;
    store.scope!.sessionStatus = GameSessionStatus.ENDED;
    await expect(service.bootstrap("launch", "x")).rejects.toMatchObject({
      code: "SESSION_ENDED",
    });
  });

  it("rejects an initial save that claims a nonzero revision", async () => {
    const service = new GameStateService(new MemoryStore(), () => ({
      valid: true,
      payload: context,
    }));
    await expect(service.save("launch", saveRequest(3))).rejects.toBeInstanceOf(
      GameStateError,
    );
  });
});
