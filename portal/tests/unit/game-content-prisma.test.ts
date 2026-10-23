import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PrismaGameContentStore } from "@/server/db/prisma-game-content-store";
import { demoGameContentSeed } from "@/server/mock/game-content-store";
import { PlatformRole, RecordStatus } from "@/generated/prisma/enums";

function setup() {
  const row = demoGameContentSeed()[0]!;
  const calls: string[] = [];
  const tx = {
    $queryRaw: vi.fn(async () => {
      calls.push("lock");
      return [];
    }),
    professionalProfile: {
      findUnique: vi.fn(async () => ({
        id: "admin",
        displayName: "Admin",
        status: RecordStatus.ACTIVE,
        platformRole: PlatformRole.PLATFORM_ADMIN,
      })),
    },
    gameContentManifest: {
      findUnique: vi.fn(async () => {
        calls.push("find");
        return row;
      }),
      findUniqueOrThrow: vi.fn(async () => row),
      findFirst: vi.fn(async () => row),
      findMany: vi.fn(async () => [row]),
      createMany: vi.fn(async () => ({ count: 0 })),
      updateMany: vi.fn(async () => {
        calls.push("clear");
        return { count: 1 };
      }),
      update: vi.fn(async () => {
        calls.push("activate");
        return row;
      }),
    },
  };
  const prisma = {
    ...tx,
    $transaction: vi.fn(async <T>(work: (db: typeof tx) => Promise<T>) =>
      work(tx),
    ),
  };
  return {
    row,
    calls,
    tx,
    prisma,
    store: new PrismaGameContentStore(prisma as never),
  };
}

describe("PrismaGameContentStore (mocked Prisma, no database)", () => {
  it("imports with ON CONFLICT DO NOTHING and returns the original build row", async () => {
    const { store, row, tx, prisma } = setup();
    const input = {
      contentVersion: row.contentVersion,
      buildId: row.buildId,
      sourceCommit: "changed",
      manifestHash: row.manifestHash,
      payload: row.payload,
      importedById: "admin",
    };
    expect(
      await store.transaction((transaction) =>
        transaction.importManifest(input),
      ),
    ).toEqual(row);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.gameContentManifest.createMany).toHaveBeenCalledWith({
      data: [input],
      skipDuplicates: true,
    });
    expect(tx.gameContentManifest.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { buildId: row.buildId },
    });
    expect(tx.gameContentManifest.update).not.toHaveBeenCalled();
    expect(tx.gameContentManifest.updateMany).not.toHaveBeenCalled();
  });

  it("takes a transaction-scoped global lock before clearing and setting current", async () => {
    const { store, calls, tx, row } = setup();
    expect(
      await store.transaction((transaction) => transaction.setCurrent(row.id)),
    ).toEqual(row);
    expect(calls).toEqual(["lock", "find", "clear", "activate"]);
    const query = tx.$queryRaw.mock.calls[0] as unknown as [{ sql: string }];
    expect(query[0].sql).toBe(
      "SELECT true AS locked FROM pg_advisory_xact_lock(72601, 1)",
    );
    expect(tx.gameContentManifest.updateMany).toHaveBeenCalledWith({
      where: { isCurrent: true },
      data: { isCurrent: false },
    });
    expect(tx.gameContentManifest.update).toHaveBeenCalledWith({
      where: { id: row.id },
      data: { isCurrent: true },
    });
  });

  it("does not clear the current manifest for an unknown target", async () => {
    const { store, tx } = setup();
    tx.gameContentManifest.findUnique.mockResolvedValueOnce(null as never);
    expect(
      await store.transaction((transaction) =>
        transaction.setCurrent("missing"),
      ),
    ).toBeNull();
    expect(tx.gameContentManifest.updateMany).not.toHaveBeenCalled();
    expect(tx.gameContentManifest.update).not.toHaveBeenCalled();
  });

  it("maps actor status for the existing authorization helper", async () => {
    const { store, tx } = setup();
    expect(await store.getActor("admin")).toEqual({
      profileId: "admin",
      displayName: "Admin",
      profileStatus: RecordStatus.ACTIVE,
      platformRole: PlatformRole.PLATFORM_ADMIN,
      memberships: [],
    });
    expect(tx.professionalProfile.findUnique).toHaveBeenCalledWith({
      where: { id: "admin" },
      select: { id: true, displayName: true, status: true, platformRole: true },
    });
    tx.professionalProfile.findUnique.mockResolvedValueOnce(null as never);
    expect(await store.getActor("missing")).toBeNull();
  });

  it("reads by buildId, current flag and deterministic newest-first order", async () => {
    const { store, tx, row } = setup();
    expect(await store.findByBuildId(row.buildId)).toEqual(row);
    expect(tx.gameContentManifest.findUnique).toHaveBeenCalledWith({
      where: { buildId: row.buildId },
    });
    expect(await store.current()).toEqual(row);
    expect(tx.gameContentManifest.findFirst).toHaveBeenCalledWith({
      where: { isCurrent: true },
    });
    expect(await store.list()).toEqual([row]);
    expect(tx.gameContentManifest.findMany).toHaveBeenCalledWith({
      orderBy: [{ importedAt: "desc" }, { id: "desc" }],
    });
    tx.gameContentManifest.findUnique.mockResolvedValueOnce(null as never);
    tx.gameContentManifest.findFirst.mockResolvedValueOnce(null as never);
    expect(await store.findByBuildId("missing")).toBeNull();
    expect(await store.current()).toBeNull();
  });
});
