import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MockGameEventReportStore } from "@/server/mock/report-store";
import { demoAdultPortalSeed } from "@/server/mock/seed-store";

describe("demo report reader", () => {
  const state = structuredClone(demoAdultPortalSeed);
  const store = new MockGameEventReportStore(state);
  const ids = state.classes.map((group) => group.id);
  const slotId = "demo-player-third-a-01";
  const classId = state.playerSlots.find(
    (slot) => slot.id === slotId,
  )!.classGroupId;

  it("computes per-module totals from the demo events", async () => {
    const report = (await store.listClassReports([classId]))[0]!;
    expect(report.moduleTotals).toEqual([
      { moduleId: "convivencia", totalActiveMs: 210_000, resultCount: 1 },
      { moduleId: "saude_bucal", totalActiveMs: 60_000, resultCount: 1 },
    ]);
    expect(report.totalActiveMs).toBe(270_000);
    expect(report.resultCount).toBe(2);
    const player = await store.getPlayerReport(classId, slotId);
    expect(player?.moduleTotals).toEqual(report.moduleTotals);
    expect(player?.participations[0]?.results).toHaveLength(2);
    expect(player?.participations[0]?.moduleTotals).toEqual(
      report.moduleTotals,
    );
  });

  it("restricts class and player reports to the module filter", async () => {
    const report = (await store.listClassReports([classId], "saude_bucal"))[0]!;
    expect(report.moduleTotals).toEqual([
      { moduleId: "saude_bucal", totalActiveMs: 60_000, resultCount: 1 },
    ]);
    expect(report.totalActiveMs).toBe(60_000);
    expect(report.playerCount).toBe(
      (await store.listClassReports([classId]))[0]!.playerCount,
    );
    const player = await store.getPlayerReport(
      classId,
      slotId,
      {},
      "saude_bucal",
    );
    expect(player?.resultCount).toBe(1);
    expect(player?.participations[0]?.activeTimeEventCount).toBe(1);
    expect(player?.participations[0]?.results.map((r) => r.moduleId)).toEqual([
      "saude_bucal",
    ]);
  });

  it("returns empty totals for a module without events and keeps roster data", async () => {
    const baseline = await store.listClassReports(ids);
    const reports = await store.listClassReports(ids, "missing-module");
    for (const [index, report] of reports.entries()) {
      expect(report.moduleTotals).toEqual([]);
      expect(report.totalActiveMs).toBe(0);
      expect(report.resultCount).toBe(0);
      expect(report.playerCount).toBe(baseline[index]!.playerCount);
      expect(report.sessionCount).toBe(baseline[index]!.sessionCount);
    }
    expect(await store.listClassReports([], "module")).toEqual([]);
    expect(
      await store.getPlayerReport("wrong-class", slotId, {}, "module"),
    ).toBeNull();
  });

  it("maps events of unknown missions to the null module", async () => {
    const custom = new MockGameEventReportStore(
      state,
      {
        activeTimeEvents: [
          {
            participationId: "demo-participation-third-a-01-ended",
            missionId: "unknown",
            activeMs: 5,
          },
        ],
        resultEvents: [],
      },
      { missions: [] },
    );
    const report = (await custom.listClassReports([classId]))[0]!;
    expect(report.moduleTotals).toEqual([
      { moduleId: null, totalActiveMs: 5, resultCount: 0 },
    ]);
  });
});
