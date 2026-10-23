import { describe, expect, it } from "vitest";

import fixture from "../../contracts/fixtures/v2/valid/content-manifest.json";
import {
  resolvePolicy,
  type ContentSelection,
} from "@/application/game-content/policy";
import { validateManifest } from "@/application/game-content/manifest";
import { sessionContentPolicyV1Schema } from "@/contracts/v2";

const manifest = validateManifest(fixture);

describe("resolvePolicy", () => {
  it("resolves null to every module and mission with the authored version", () => {
    const policy = resolvePolicy(null, manifest);
    expect(policy).toMatchObject({
      policy_version: 1,
      authored_content_version: manifest.content_version,
      enabled_module_ids: manifest.modules.map((item) => item.module_id),
      enabled_mission_ids: manifest.missions.map((item) => item.mission_id),
    });
    expect(sessionContentPolicyV1Schema.safeParse(policy).success).toBe(true);
  });

  it("expands modules and unions individual missions without duplicates", () => {
    const policy = resolvePolicy(
      {
        enabled_module_ids: ["saude_bucal"],
        enabled_mission_ids: ["lia_memory", "smile_kit"],
      },
      manifest,
    );
    expect(policy.enabled_module_ids).toEqual(["saude_bucal"]);
    expect(policy.enabled_mission_ids).toEqual([
      "lia_memory",
      "brushing_teeth",
      "smile_kit",
    ]);
  });

  it("does not expand the parent module of an individually selected mission", () => {
    const policy = resolvePolicy(
      { enabled_mission_ids: ["lia_memory"] },
      manifest,
    );
    expect(policy.enabled_module_ids).toEqual([]);
    expect(policy.enabled_mission_ids).toEqual(["lia_memory"]);
    expect(Object.keys(policy.activity_presets ?? {})).toEqual(["lia_memory"]);
  });

  it("uses defaults and permits declared preset and boolean option overrides", () => {
    const catalog = structuredClone(manifest);
    catalog.activities[0]!.presets.push({
      preset_id: "avancado",
      label: "Avancado",
      default: false,
    });
    catalog.session_options.push({
      option_id: "skin_shop",
      type: "boolean",
      default: true,
      label: "Loja",
    });
    const defaults = resolvePolicy(
      { enabled_mission_ids: ["lia_memory"] },
      catalog,
    );
    expect(defaults.activity_presets).toEqual({ lia_memory: "padrao" });
    expect(defaults.options).toEqual({ skin_shop: true });
    const explicit = resolvePolicy(
      {
        enabled_mission_ids: ["lia_memory"],
        activity_presets: { lia_memory: "avancado" },
        options: { skin_shop: false },
      },
      catalog,
    );
    expect(explicit.activity_presets).toEqual({ lia_memory: "avancado" });
    expect(explicit.options).toEqual({ skin_shop: false });
  });

  it("treats nullable maps as omitted and allows missions without activities", () => {
    expect(
      resolvePolicy(
        {
          enabled_mission_ids: ["when_play_stops_being_play"],
          activity_presets: null,
          options: null,
        },
        manifest,
      ),
    ).toMatchObject({ activity_presets: {}, options: {} });
  });

  it.each<ContentSelection>([
    {},
    { enabled_module_ids: [], enabled_mission_ids: [] },
    { enabled_module_ids: ["unknown"] },
    { enabled_mission_ids: ["unknown"] },
    {
      enabled_mission_ids: ["lia_memory"],
      activity_presets: { unknown: "padrao" },
    },
    {
      enabled_mission_ids: ["lia_memory"],
      activity_presets: { lia_memory: "unknown" },
    },
    {
      enabled_mission_ids: ["lia_memory"],
      activity_presets: { pingpong_defense: "padrao" },
    },
    { enabled_mission_ids: ["lia_memory"], options: { unknown: true } },
    { enabled_mission_ids: ["lia_memory", "lia_memory"] },
  ])("rejects empty or unknown selections: %j", (selection) => {
    expect(() => resolvePolicy(selection, manifest)).toThrow(
      expect.objectContaining({ code: "VALIDATION" }),
    );
  });

  it("rejects a non-boolean value for a boolean option", () => {
    const catalog = structuredClone(manifest);
    catalog.session_options.push({
      option_id: "skin_shop",
      type: "boolean",
      default: true,
      label: "Loja",
    });
    expect(() =>
      resolvePolicy(
        {
          enabled_mission_ids: ["lia_memory"],
          options: { skin_shop: "false" },
        },
        catalog,
      ),
    ).toThrow();
  });

  it("rejects an empty catalog even with null selection", () => {
    expect(() =>
      resolvePolicy(null, {
        ...manifest,
        modules: [],
        missions: [],
        activities: [],
      }),
    ).toThrow(expect.objectContaining({ code: "VALIDATION" }));
  });

  it("does not mutate inputs, and a later resolution cannot change the frozen policy", () => {
    const catalog = structuredClone(manifest);
    const selection = { enabled_module_ids: ["saude_bucal"] };
    const before = structuredClone({ catalog, selection });
    const policy = resolvePolicy(selection, catalog);
    expect({ catalog, selection }).toEqual(before);
    catalog.modules[1]!.mission_ids.pop();
    catalog.missions.pop();
    catalog.activities = catalog.activities.filter(
      (item) => item.mission_id !== "smile_kit",
    );
    expect(resolvePolicy(selection, catalog).enabled_mission_ids).toEqual([
      "brushing_teeth",
    ]);
    expect(policy.enabled_mission_ids).toEqual(["brushing_teeth", "smile_kit"]);
  });
});
