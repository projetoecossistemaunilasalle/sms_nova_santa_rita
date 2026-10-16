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
import { parseGameStateV1, type StateSaveRequestV1 } from "@/contracts/v1";
import {
  GameSessionStatus,
  PlayerCredentialStatus,
  RecordStatus,
} from "@/generated/prisma/enums";
import type { LaunchTokenContext } from "@/server/security/launch-token";

const state = parseGameStateV1(
  JSON.parse(
    readFileSync(
      resolve(process.cwd(), "contracts/fixtures/v1/valid/game-state.json"),
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
  async createState(_playerSlotId: string, next: typeof state) {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      return false;
    }
    this.current = { revision: 1, state: next };
    return true;
  }
  async updateState(
    _playerSlotId: string,
    expected: number,
    next: typeof state,
  ) {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      return false;
    }
    if (this.current?.revision !== expected) return false;
    this.current = { revision: expected + 1, state: next };
    return true;
  }
}

function saveRequest(expectedRevision: number): StateSaveRequestV1 {
  return {
    type: "game.save.v1",
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
      { type: "portal.save_ok.v1", revision: 1 },
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
      type: "portal.save_ok.v1",
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
    store.current = { revision: 3, state };
    const service = new GameStateService(store, () => ({
      valid: true,
      payload: context,
    }));
    expect(await service.save("launch", saveRequest(1))).toEqual({
      type: "portal.save_conflict.v1",
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
      type: "portal.save_ok.v1",
      request_id: request.request_id,
      revision: 1,
    });
    await expect(
      service.save("launch", {
        ...request,
        state: reverseObjectKeys(request.state) as typeof state,
      }),
    ).resolves.toEqual({
      type: "portal.save_ok.v1",
      request_id: request.request_id,
      revision: 1,
    });
    expect(store.current).toEqual({ revision: 1, state });
  });

  it("still returns a conflict for a stale save with a different snapshot", async () => {
    const store = new MemoryStore();
    store.current = { revision: 1, state };
    const service = new GameStateService(store, () => ({
      valid: true,
      payload: context,
    }));
    const request = saveRequest(0);
    const differentState = {
      ...state,
      progression: { ...state.progression, coins: state.progression.coins + 1 },
    };

    await expect(
      service.save("launch", { ...request, state: differentState }),
    ).resolves.toEqual({
      type: "portal.save_conflict.v1",
      request_id: request.request_id,
      revision: 1,
      state,
    });
    expect(store.current).toEqual({ revision: 1, state });
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
