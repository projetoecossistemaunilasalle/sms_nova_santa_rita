import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MockGameEventReportStore } from "@/server/mock/report-store";
import { demoAdultPortalSeed } from "@/server/mock/seed-store";

describe("demo report reader", () => {
  it("accepts module filters without inventing events or changing roster/participation", async () => {
    const state = structuredClone(demoAdultPortalSeed);
    const store = new MockGameEventReportStore(state);
    const ids = state.classes.map((group) => group.id);
    const baseline = await store.listClassReports(ids);
    for (const moduleId of ["saude_bucal", "missing-module"]) {
      const reports = await store.listClassReports(ids, moduleId);
      expect(reports).toEqual(baseline);
      for (const report of reports) {
        expect(report.moduleTotals).toEqual([]);
        expect(report.totalActiveMs).toBe(0);
        expect(report.resultCount).toBe(0);
        for (const player of report.players) {
          const unfiltered = await store.getPlayerReport(
            report.classGroupId,
            player.playerSlotId,
          );
          const filtered = await store.getPlayerReport(
            report.classGroupId,
            player.playerSlotId,
            {},
            moduleId,
          );
          expect(filtered).toEqual(unfiltered);
          expect(filtered?.moduleTotals).toEqual([]);
          for (const participation of filtered?.participations ?? []) {
            expect(participation.moduleTotals).toEqual([]);
            expect(participation.results).toEqual([]);
          }
        }
      }
    }
    expect(await store.listClassReports([], "module")).toEqual([]);
    expect(
      await store.getPlayerReport(
        "wrong-class",
        state.playerSlots[0]!.id,
        {},
        "module",
      ),
    ).toBeNull();
  });
});
