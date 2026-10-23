import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { PrismaGameEventStore } from "@/server/db/prisma-game-event-store";
import { RecordStatus } from "@/generated/prisma/enums";
import { reportPage } from "@/application/game-events/report-pagination";
import manifest from "../../contracts/fixtures/v2/valid/content-manifest.json";

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
        gameSession: {
          startedAt: new Date(),
          endedAt: null,
          contentManifest: { payload: manifest },
        },
        _count: { resultEvents: 57, activeTimeEvents: 1000 },
      },
    ]);
    const events = vi.fn(async () => [
      {
        id: "event",
        activityId: "lia_memory",
        missionId: "lia_memory",
        moduleId: "convivencia",
        presetId: "padrao",
        attemptId: "attempt",
        resultState: "complete",
        durationMs: 500n,
        metrics: { pares: 10 },
        receivedAt: new Date(),
      },
    ]);
    const active = vi
      .fn()
      .mockResolvedValueOnce({ _sum: { activeMs: 4000000000 } })
      .mockResolvedValueOnce({ _sum: { activeMs: 80000 } });
    const count = vi.fn(async () => 10000);
    const modules = vi
      .fn()
      .mockResolvedValueOnce([
        {
          playerSlotId: "player",
          moduleId: "convivencia",
          totalActiveMs: 3999999990n,
          resultCount: 10000n,
        },
        {
          playerSlotId: "player",
          moduleId: null,
          totalActiveMs: 10n,
          resultCount: 0n,
        },
      ])
      .mockResolvedValueOnce([
        {
          playerSlotId: "player",
          moduleId: "convivencia",
          totalActiveMs: 80000n,
          resultCount: 57n,
        },
      ]);
    const store = new PrismaGameEventStore({
      $queryRaw: modules,
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
      moduleTotals: [
        {
          moduleId: "convivencia",
          totalActiveMs: 3999999990,
          resultCount: 10000,
        },
        { moduleId: null, totalActiveMs: 10, resultCount: 0 },
      ],
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
      moduleTotals: [
        { moduleId: "convivencia", totalActiveMs: 80000, resultCount: 57 },
      ],
    });
    expect(report!.participations[0]!.results[0]).toMatchObject({
      moduleId: "convivencia",
      presetId: "padrao",
      metricLabels: Object.fromEntries(
        manifest.activities[0]!.metrics.map((metric) => [
          metric.key,
          metric.label,
        ]),
      ),
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
      $queryRaw: vi.fn(async () => []),
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
      moduleTotals: [],
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

  it.each(["convivencia", "missing-module"])(
    "filters every event query and pagination by %s without changing session counts",
    async (moduleId) => {
      const resultCount = moduleId === "convivencia" ? 21 : 0;
      const payload = structuredClone(manifest);
      payload.activities[0]!.metrics[0]!.label = "Frozen session label";
      const sessions = vi.fn(async () => [
        {
          id: "participation",
          gameSessionId: "session",
          joinedAt: new Date(),
          gameSession: {
            startedAt: new Date(),
            endedAt: null,
            contentManifest: { payload },
          },
          _count: {
            resultEvents: resultCount,
            activeTimeEvents: resultCount ? 3 : 0,
          },
        },
      ]);
      const events = vi.fn(async () =>
        resultCount
          ? [
              {
                id: "event",
                activityId: "lia_memory",
                missionId: "lia_memory",
                moduleId,
                presetId: "padrao",
                attemptId: "attempt",
                resultState: "complete",
                durationMs: 10n,
                metrics: { pares: 1 },
                receivedAt: new Date(),
              },
            ]
          : [],
      );
      const active = vi.fn(async () => ({
        _sum: { activeMs: resultCount ? 100 : null },
      }));
      const count = vi.fn(async () => resultCount);
      const modules = vi
        .fn<(query: { sql: string; values: unknown[] }) => Promise<unknown[]>>()
        .mockResolvedValue(
          resultCount
            ? [
                {
                  playerSlotId: "player",
                  moduleId,
                  totalActiveMs: 100n,
                  resultCount: BigInt(resultCount),
                },
              ]
            : [],
        );
      const store = new PrismaGameEventStore({
        $queryRaw: modules,
        playerSlot: {
          findFirst: async () => ({
            id: "player",
            playerNumber: 1,
            status: RecordStatus.ACTIVE,
            classGroup: { id: "class", name: "A" },
            _count: { participations: 4 },
          }),
        },
        participation: { findMany: sessions },
        resultEvent: { findMany: events, count },
        activeTimeEvent: { aggregate: active },
      } as never);
      const report = (await store.getPlayerReport(
        "class",
        "player",
        { resultPage: 99 },
        moduleId,
      ))!;
      expect(report.participationCount).toBe(4);
      expect(report.resultCount).toBe(resultCount);
      expect(report.history).toMatchObject({
        sessionPages: 4,
        resultPage: resultCount ? 2 : 1,
        resultPages: resultCount ? 2 : 1,
      });
      expect(report.moduleTotals).toEqual(
        resultCount ? [{ moduleId, totalActiveMs: 100, resultCount }] : [],
      );
      expect(report.participations[0]?.moduleTotals).toEqual(
        report.moduleTotals,
      );
      expect(sessions).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            _count: {
              select: {
                resultEvents: { where: { moduleId } },
                activeTimeEvents: { where: { moduleId } },
              },
            },
          }),
        }),
      );
      expect(count).toHaveBeenCalledWith({
        where: { participation: { playerSlotId: "player" }, moduleId },
      });
      expect(active).toHaveBeenNthCalledWith(1, {
        where: { participation: { playerSlotId: "player" }, moduleId },
        _sum: { activeMs: true },
      });
      expect(active).toHaveBeenNthCalledWith(2, {
        where: { participationId: "participation", moduleId },
        _sum: { activeMs: true },
      });
      expect(events).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { participationId: "participation", moduleId },
          skip: resultCount ? 20 : 0,
          take: 20,
        }),
      );
      for (const [argument] of modules.mock.calls) {
        expect(argument.sql).toContain(
          'GROUP BY p."player_slot_id", e."module_id"',
        );
        expect(
          argument.values.filter((value) => value === moduleId),
        ).toHaveLength(2);
        expect(argument.values).toContain("class");
      }
      if (resultCount) {
        expect(report.participations[0]?.results[0]?.metricLabels.pares).toBe(
          "Frozen session label",
        );
        expect(manifest.activities[0]?.metrics[0]?.label).not.toBe(
          "Frozen session label",
        );
      }
    },
  );

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
