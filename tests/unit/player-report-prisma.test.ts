import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { PrismaGameEventStore } from "@/server/db/prisma-game-event-store";
import { RecordStatus } from "@/generated/prisma/enums";
import { reportPage } from "@/application/game-events/report-pagination";

describe("bounded player history and complete totals", () => {
  it("aggregates all history but fetches only one session and one result page", async () => {
    const player = vi.fn(async () => ({
      id: "player",
      playerNumber: 1,
      status: RecordStatus.ACTIVE,
      classGroup: { id: "class", name: "A" },
      _count: { participations: 100 },
    }));
    const sessions = vi.fn(async () => [
      {
        id: "participation",
        gameSessionId: "session",
        joinedAt: new Date(),
        gameSession: { startedAt: new Date(), endedAt: null },
        _count: { resultEvents: 57, activeTimeEvents: 1000 },
      },
    ]);
    const events = vi.fn(async () => [
      {
        id: "event",
        activityId: "activity",
        missionId: "mission",
        attemptId: "attempt",
        resultState: "complete",
        durationMs: 500n,
        metrics: { score: 10 },
        receivedAt: new Date(),
      },
    ]);
    const active = vi
      .fn()
      .mockResolvedValueOnce({ _sum: { activeMs: 4000000000 } })
      .mockResolvedValueOnce({ _sum: { activeMs: 80000 } });
    const count = vi.fn(async () => 10000);
    const store = new PrismaGameEventStore({
      playerSlot: { findFirst: player },
      participation: { findMany: sessions },
      resultEvent: { findMany: events, count },
      activeTimeEvent: { aggregate: active },
    } as never);
    const report = await store.getPlayerReport("class", "player", {
      sessionPage: 3,
      resultPage: 2,
    });
    expect(report).toMatchObject({
      participationCount: 100,
      totalActiveMs: 4000000000,
      resultCount: 10000,
      history: {
        sessionPage: 3,
        sessionPages: 100,
        resultPage: 2,
        resultPages: 3,
      },
    });
    expect(report!.participations).toHaveLength(1);
    expect(report!.participations[0]).toMatchObject({
      activeTimeMs: 80000,
      activeTimeEventCount: 1000,
      resultCount: 57,
    });
    expect(player).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "player", classGroupId: "class" },
      }),
    );
    expect(sessions).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { playerSlotId: "player" },
        skip: 2,
        take: 1,
        orderBy: [{ joinedAt: "desc" }, { id: "desc" }],
      }),
    );
    expect(events).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { participationId: "participation" },
        skip: 20,
        take: 20,
        orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
      }),
    );
    expect(active).toHaveBeenNthCalledWith(1, {
      where: { participation: { playerSlotId: "player" } },
      _sum: { activeMs: true },
    });
    expect(count).toHaveBeenCalledWith({
      where: { participation: { playerSlotId: "player" } },
    });
  });

  it("returns an empty history and zero totals without fetching event rows", async () => {
    const events = vi.fn();
    const store = new PrismaGameEventStore({
      playerSlot: {
        findFirst: async () => ({
          id: "player",
          playerNumber: 1,
          status: RecordStatus.ACTIVE,
          classGroup: { id: "class", name: "A" },
          _count: { participations: 0 },
        }),
      },
      participation: { findMany: async () => [] },
      resultEvent: { count: async () => 0, findMany: events },
      activeTimeEvent: {
        aggregate: async () => ({ _sum: { activeMs: null } }),
      },
    } as never);
    expect(
      await store.getPlayerReport("class", "player", { sessionPage: 999 }),
    ).toMatchObject({
      participationCount: 0,
      totalActiveMs: 0,
      resultCount: 0,
      participations: [],
      history: {
        sessionPage: 1,
        sessionPages: 1,
        resultPage: 1,
        resultPages: 1,
      },
    });
    expect(events).not.toHaveBeenCalled();
  });

  it("does not query another player's history when the class/player pair does not match", async () => {
    const sessions = vi.fn();
    const store = new PrismaGameEventStore({
      playerSlot: { findFirst: async () => null },
      participation: { findMany: sessions },
    } as never);
    expect(await store.getPlayerReport("wrong-class", "player")).toBeNull();
    expect(sessions).not.toHaveBeenCalled();
  });

  it("normalizes malformed pages and clamps out-of-range pages", () => {
    for (const value of [
      undefined,
      [],
      ["2"],
      -1,
      0,
      1.5,
      NaN,
      Infinity,
      "abc",
      "1e3",
      Number.MAX_SAFE_INTEGER + 1,
    ])
      expect(reportPage(value, 10)).toBe(1);
    expect(reportPage("3", 10)).toBe(3);
    expect(reportPage(999, 10)).toBe(10);
  });
});
