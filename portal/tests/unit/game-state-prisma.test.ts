import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  GameSessionStatus,
  PlayerCredentialStatus,
  RecordStatus,
} from "@/generated/prisma/enums";
import { PrismaGameStateStore } from "@/server/db/prisma-game-state-store";
import { resolvePolicy } from "@/application/game-content/policy";
import { demoGameContentSeed } from "@/server/mock/content-seed";

describe("PrismaGameStateStore", () => {
  it("persists V2 metadata separately from opaque state and keeps revision CAS", async () => {
    const state = { schema_version: 3 as const, history: { revision: 99 } };
    const contentVersion = "saved_version";
    const tx = {
      $executeRaw: vi.fn(async () => 1),
      gameState: {
        findUnique: vi.fn(async () => ({
          payload: state,
          contentVersion,
          revision: 7,
        })),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
    };
    const store = new PrismaGameStateStore({
      $transaction: async <T>(work: (db: unknown) => Promise<T>) => work(tx),
    } as never);
    await store.transaction(async (transaction) => {
      expect(await transaction.getState("player")).toEqual({
        state,
        contentVersion,
        revision: 7,
      });
      expect(
        await transaction.createState("player", state, contentVersion),
      ).toBe(true);
      expect(
        await transaction.updateState("player", 7, state, contentVersion),
      ).toBe(true);
    });
    expect(tx.gameState.findUnique).toHaveBeenCalledWith({
      where: { playerSlotId: "player" },
      select: { payload: true, contentVersion: true, revision: true },
    });
    expect(tx.$executeRaw).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining("::uuid, 2,"),
        values: expect.arrayContaining([contentVersion, JSON.stringify(state)]),
      }),
    );
    expect(tx.gameState.updateMany).toHaveBeenCalledWith({
      where: { playerSlotId: "player", revision: 7 },
      data: {
        protocolVersion: 2,
        schemaVersion: 3,
        contentVersion,
        payload: state,
        revision: { increment: 1 },
      },
    });
  });

  it("uses a shared session lock so session end waits without serializing player reads", async () => {
    const queries: Array<{ sql: string; values: unknown[] }> = [];
    const transactionClient = {
      $queryRaw: vi.fn(async (query: { sql: string; values: unknown[] }) => {
        queries.push(query);
        return [{ id: "locked" }];
      }),
      participation: {
        findUnique: vi.fn(async () => ({
          playerSlotId: "player-a",
          gameSessionId: "session-a",
          gameSession: {
            classGroupId: "class-a",
            status: GameSessionStatus.ACTIVE,
            contentPolicy: resolvePolicy(
              null,
              demoGameContentSeed()[0]!.payload,
            ),
          },
          playerSlot: {
            status: RecordStatus.ACTIVE,
            classGroupId: "class-a",
            classGroup: {
              status: RecordStatus.ACTIVE,
              organization: { status: RecordStatus.ACTIVE },
            },
          },
        })),
      },
      playerCredential: {
        findUnique: vi.fn(async () => ({
          playerSlotId: "player-a",
          status: PlayerCredentialStatus.ACTIVE,
        })),
      },
    };
    const prisma = {
      $transaction: async <T>(work: (db: unknown) => Promise<T>) =>
        work(transactionClient),
    };
    const store = new PrismaGameStateStore(prisma as never);

    await store.transaction((transaction) =>
      transaction.getLaunchScope({
        credentialId: "credential-a",
        participationId: "participation-a",
        playerSlotId: "player-a",
        gameSessionId: "session-a",
      }),
    );

    expect(queries).toHaveLength(2);
    expect(queries[0]?.sql).toContain("FOR UPDATE");
    expect(queries[1]?.sql).toContain("FOR SHARE");
    expect(queries[0]?.values).toContain("credential-a");
    expect(queries[1]?.values).toContain("session-a");
  });
});
