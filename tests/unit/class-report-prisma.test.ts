import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { PrismaGameEventStore } from "@/server/db/prisma-game-event-store";
import { RecordStatus } from "@/generated/prisma/enums";

describe("database-aggregated class reports", () => {
  it("maps bounded aggregate rows, including empty classes and nonparticipating players", async () => {
    const lastPlayedAt = new Date("2026-10-12T12:00:00Z");
    const base = {
      classGroupId: "class-a",
      className: "A",
      sessionCount: 2n,
      playerSlotId: "slot-a",
      playerNumber: 1,
      playerStatus: RecordStatus.ACTIVE,
      participationCount: 3n,
      totalActiveMs: 4000000000n,
      resultCount: 6n,
      lastPlayedAt,
    };
    const query = vi.fn<(query: unknown) => Promise<unknown[]>>(async () => [
      base,
      {
        ...base,
        playerSlotId: "slot-b",
        playerNumber: 2,
        participationCount: 0n,
        totalActiveMs: 0n,
        resultCount: 0n,
        lastPlayedAt: null,
      },
      {
        ...base,
        classGroupId: "class-empty",
        className: "B",
        sessionCount: 0n,
        playerSlotId: null,
        playerNumber: null,
        playerStatus: null,
      },
    ]);
    const store = new PrismaGameEventStore({ $queryRaw: query } as never);
    const reports = await store.listClassReports(["class-a", "class-empty"]);
    expect(reports[0]).toMatchObject({
      playerCount: 2,
      participatingPlayerCount: 1,
      sessionCount: 2,
      totalActiveMs: 4000000000,
      resultCount: 6,
    });
    expect(reports[0]?.players[0]?.lastPlayedAt).toEqual(lastPlayedAt);
    expect(reports[1]).toMatchObject({
      playerCount: 0,
      participatingPlayerCount: 0,
      sessionCount: 0,
      players: [],
    });
    const sql = query.mock.calls[0]![0] as { sql: string; values: unknown[] };
    expect(sql.sql).toContain('COUNT(DISTINCT "game_session_id")');
    expect(sql.sql).toContain('SUM(e."active_ms")');
    expect(sql.sql).toContain('GROUP BY e."participation_id"');
    expect(sql.values).toEqual(["class-a", "class-empty"]);
  });
  it("does not query the database for an empty authorized class scope", async () => {
    const query = vi.fn();
    expect(
      await new PrismaGameEventStore({
        $queryRaw: query,
      } as never).listClassReports([]),
    ).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});
