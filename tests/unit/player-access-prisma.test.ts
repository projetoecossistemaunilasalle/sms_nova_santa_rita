import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  GameSessionStatus,
  PlayerCredentialStatus,
  RecordStatus,
} from "@/generated/prisma/enums";
import { PrismaPlayerAccessStore } from "@/server/db/prisma-player-access-store";

describe("PrismaPlayerAccessStore", () => {
  it("reserves a monotonic number range before creating slots", async () => {
    const createdNumbers: number[] = [];
    const transactionClient = {
      classGroup: {
        update: vi.fn(async () => ({ nextPlayerNumber: 6 })),
      },
      playerSlot: {
        create: vi.fn(async ({ data }: { data: { playerNumber: number } }) => {
          createdNumbers.push(data.playerNumber);
          return {
            id: `slot-${data.playerNumber}`,
            classGroupId: "class-a",
            playerNumber: data.playerNumber,
            status: RecordStatus.ACTIVE,
            credentials: [
              {
                id: `credential-${data.playerNumber}`,
                status: PlayerCredentialStatus.ACTIVE,
              },
            ],
          };
        }),
      },
    };
    const prisma = {
      $transaction: async <T>(work: (db: unknown) => Promise<T>) =>
        work(transactionClient),
    };
    const store = new PrismaPlayerAccessStore(prisma as never);

    const slots = await store.transaction((transaction) =>
      transaction.allocateSlots("class-a", [
        { tokenHash: "a".repeat(64) },
        { tokenHash: "b".repeat(64) },
      ]),
    );

    expect(transactionClient.classGroup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "class-a" },
        data: { nextPlayerNumber: { increment: 2 } },
      }),
    );
    expect(createdNumbers).toEqual([4, 5]);
    expect(slots.map((slot) => slot.playerNumber)).toEqual([4, 5]);
  });

  it("locks a credential before reading status so rotation wins cleanly", async () => {
    const sequence: string[] = [];
    const lockedQueries: Array<{ sql: string; values: unknown[] }> = [];
    const transactionClient = {
      $queryRaw: vi.fn(async (query: { sql: string; values: unknown[] }) => {
        sequence.push("lock-credential");
        lockedQueries.push(query);
        return [{ id: "credential-a" }];
      }),
      playerCredential: {
        findUnique: vi.fn(async () => {
          sequence.push("read-credential");
          return {
            id: "credential-a",
            status: PlayerCredentialStatus.REVOKED,
            playerSlot: {
              id: "slot-a",
              classGroupId: "class-a",
              playerNumber: 1,
              status: RecordStatus.ACTIVE,
              classGroup: {
                id: "class-a",
                organizationId: "organization-a",
                status: RecordStatus.ACTIVE,
                organization: { status: RecordStatus.ACTIVE },
              },
            },
          };
        }),
      },
    };
    const prisma = {
      $transaction: async <T>(work: (db: unknown) => Promise<T>) =>
        work(transactionClient),
    };
    const store = new PrismaPlayerAccessStore(prisma as never);

    const credential = await store.transaction((transaction) =>
      transaction.resolveCredential("a".repeat(64)),
    );

    const query = lockedQueries[0]!;
    expect(query.sql).toContain('FROM "player_credentials"');
    expect(query.sql).toContain("FOR UPDATE");
    expect(query.sql).not.toContain('"status"');
    expect(query.values).toContain("a".repeat(64));
    expect(sequence).toEqual(["lock-credential", "read-credential"]);
    expect(credential).toMatchObject({
      id: "credential-a",
      status: PlayerCredentialStatus.REVOKED,
      slot: { id: "slot-a", classGroupId: "class-a" },
    });
  });

  it("locks an active session until its entry participation is upserted", async () => {
    const sequence: string[] = [];
    const lockedQueries: Array<{ sql: string; values: unknown[] }> = [];
    const transactionClient = {
      $queryRaw: vi.fn(async (query: { sql: string; values: unknown[] }) => {
        sequence.push("lock-session");
        lockedQueries.push(query);
        return [
          {
            id: "session-a",
            classGroupId: "class-a",
            startedAt: new Date("2026-09-22T12:00:00.000Z"),
            endedAt: null,
          },
        ];
      }),
      participation: {
        upsert: vi.fn(async () => {
          sequence.push("upsert-participation");
          return {
            id: "participation-a",
            gameSessionId: "session-a",
            playerSlotId: "slot-a",
            joinedAt: new Date("2026-09-22T12:01:00.000Z"),
          };
        }),
      },
    };
    const prisma = {
      $transaction: async <T>(work: (db: unknown) => Promise<T>) =>
        work(transactionClient),
    };
    const store = new PrismaPlayerAccessStore(prisma as never);

    const entry = await store.transaction((transaction) =>
      transaction.findOrCreateActiveParticipation(
        "class-a",
        "slot-a",
        new Date("2026-09-22T12:01:00.000Z"),
      ),
    );

    const query = lockedQueries[0]!;
    expect(query.sql).toContain("\"status\" = 'active'");
    expect(query.sql).toContain("FOR UPDATE");
    expect(query.values).toContain("class-a");
    expect(sequence).toEqual(["lock-session", "upsert-participation"]);
    expect(entry).toMatchObject({
      session: { id: "session-a", status: GameSessionStatus.ACTIVE },
      participation: { id: "participation-a", gameSessionId: "session-a" },
    });
  });

  it("does not create participation when no active session can be locked", async () => {
    const transactionClient = {
      $queryRaw: vi.fn(async () => []),
      participation: { upsert: vi.fn() },
    };
    const prisma = {
      $transaction: async <T>(work: (db: unknown) => Promise<T>) =>
        work(transactionClient),
    };
    const store = new PrismaPlayerAccessStore(prisma as never);

    const entry = await store.transaction((transaction) =>
      transaction.findOrCreateActiveParticipation(
        "class-a",
        "slot-a",
        new Date(),
      ),
    );

    expect(entry).toBeNull();
    expect(transactionClient.participation.upsert).not.toHaveBeenCalled();
  });

  it("maps uniqueness races to a retryable domain conflict", async () => {
    const store = new PrismaPlayerAccessStore({
      $transaction: async () => {
        throw { code: "P2002" };
      },
    } as never);

    await expect(store.transaction(async () => null)).rejects.toMatchObject({
      code: "CONFLICT",
      message:
        "O estado foi alterado por outra operação. Atualize e tente novamente.",
    });
  });
});
