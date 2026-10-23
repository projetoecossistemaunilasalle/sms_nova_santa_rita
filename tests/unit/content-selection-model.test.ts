import { describe, expect, it } from "vitest";

import { validateManifest } from "@/application/game-content/manifest";
import { resolvePolicy } from "@/application/game-content/policy";
import {
  getContentAdjustments,
  getContentModules,
  getContentSelectionLiveSummary,
  getContentSelectionSummary,
  getModuleSelectionState,
  getSessionContentChips,
  hasContentAdjustments,
} from "@/components/portal/content-selection-model";
import fixture from "@/server/mock/fixtures/content-manifest.json";

const manifest = validateManifest(fixture);
const dental = { enabled_module_ids: ["saude_bucal"] };

describe("content selection view models", () => {
  it("builds ordered module cards, nested missions and activities from the manifest", () => {
    const reordered = { ...manifest, modules: [...manifest.modules].reverse() };
    const before = structuredClone(reordered);
    const modules = getContentModules(reordered);
    expect(modules.map((module) => module.module_id)).toEqual([
      "convivencia",
      "saude_bucal",
    ]);
    expect(modules[1]).toMatchObject({
      title: "Saúde bucal",
      summary: manifest.modules[1]!.summary,
      missionCount: 2,
    });
    expect(modules[1]!.missions.map((mission) => mission.mission_id)).toEqual([
      "brushing_teeth",
      "smile_kit",
    ]);
    expect(modules[1]!.missions[0]!.activities[0]).toEqual(
      manifest.activities.find(
        (item) => item.activity_id === "brushing_teeth_practice",
      ),
    );
    expect(reordered).toEqual(before);
  });

  it("summarizes all, whole-module, partial, mixed and empty selections", () => {
    expect(getContentSelectionSummary(manifest, null)).toBe("Todo o conteúdo");
    expect(getContentSelectionSummary(manifest, dental)).toBe(
      "Saúde bucal · 2 missões",
    );
    expect(
      getContentSelectionSummary(manifest, {
        enabled_mission_ids: ["smile_kit"],
      }),
    ).toBe("Saúde bucal · 1 missão");
    expect(
      getContentSelectionSummary(manifest, {
        ...dental,
        enabled_mission_ids: ["lia_memory"],
      }),
    ).toBe("Convivência e respeito, Saúde bucal · 3 missões");
    expect(
      getContentSelectionSummary(manifest, {
        enabled_mission_ids: manifest.missions.map((item) => item.mission_id),
      }),
    ).toBe("Todo o conteúdo");
    expect(getContentSelectionSummary(manifest, {})).toBe(
      "Nenhuma missão selecionada",
    );
    expect(getContentSelectionSummary(null, null)).toBe(
      "Conteúdo indisponível",
    );
  });

  it("counts unique missions and their activities, not selected module ids", () => {
    expect(
      getContentSelectionLiveSummary(manifest, {
        ...dental,
        enabled_mission_ids: ["smile_kit", "smile_kit"],
      }),
    ).toBe("2 missões · 2 atividades");
    expect(
      getContentSelectionLiveSummary(manifest, {
        enabled_mission_ids: ["lia_memory"],
      }),
    ).toBe("1 missão · 1 atividade");
    expect(
      getContentSelectionLiveSummary(manifest, {
        enabled_mission_ids: ["when_play_stops_being_play"],
      }),
    ).toBe("1 missão · 0 atividades");
    expect(getContentSelectionLiveSummary(manifest, null)).toBe(
      "6 missões · 5 atividades",
    );
    expect(getContentSelectionLiveSummary(manifest, {})).toBe(
      "0 missões · 0 atividades",
    );
  });

  it("exposes all/partial/none checkbox states, including mission-only selections", () => {
    expect(getModuleSelectionState(manifest, "saude_bucal", dental)).toBe(
      "all",
    );
    expect(getModuleSelectionState(manifest, "convivencia", dental)).toBe(
      "none",
    );
    expect(
      getModuleSelectionState(manifest, "saude_bucal", {
        enabled_mission_ids: ["smile_kit"],
      }),
    ).toBe("partial");
    expect(
      getModuleSelectionState(manifest, "saude_bucal", {
        enabled_mission_ids: ["smile_kit", "brushing_teeth"],
      }),
    ).toBe("all");
    expect(getModuleSelectionState(manifest, "saude_bucal", null)).toBe("all");
    expect(getModuleSelectionState(manifest, "missing", null)).toBe("none");
  });

  it("derives session chips from the resolved missions even without explicit parent modules", () => {
    const partialPolicy = resolvePolicy(
      { enabled_mission_ids: ["smile_kit"] },
      manifest,
    );
    expect(partialPolicy.enabled_module_ids).toEqual([]);
    expect(getSessionContentChips(manifest, partialPolicy)).toEqual([
      { id: "saude_bucal", label: "Saúde bucal", missionCount: 1 },
    ]);
    expect(
      getSessionContentChips(manifest, resolvePolicy(null, manifest)),
    ).toEqual([{ id: "all", label: "Todo o conteúdo", missionCount: 6 }]);
    expect(
      getSessionContentChips(
        manifest,
        resolvePolicy(
          { ...dental, enabled_mission_ids: ["lia_memory"] },
          manifest,
        ),
      ).map((chip) => chip.id),
    ).toEqual(["convivencia", "saude_bucal"]);
  });

  it("renders no adjustments for today's manifest", () => {
    expect(getContentAdjustments(manifest, null)).toEqual({
      activities: [],
      options: [],
    });
    expect(hasContentAdjustments(manifest, null)).toBe(false);
  });

  it("offers only selected activities with multiple presets and manifest-defined options", () => {
    const future = structuredClone(manifest);
    future.activities[0]!.presets.push({
      preset_id: "facil",
      label: "Fácil",
      default: false,
    });
    const selection = { enabled_mission_ids: ["lia_memory"] };
    expect(getContentAdjustments(future, selection).activities).toEqual([
      future.activities[0],
    ]);
    expect(hasContentAdjustments(future, selection)).toBe(true);
    expect(hasContentAdjustments(future, dental)).toBe(false);
    future.session_options.push({
      option_id: "skin_shop",
      label: "Loja de roupas",
      type: "boolean",
      default: true,
    });
    expect(getContentAdjustments(future, dental)).toEqual({
      activities: [],
      options: future.session_options,
    });
    expect(hasContentAdjustments(future, dental)).toBe(true);
    expect(manifest.session_options).toEqual([]);
  });
});
