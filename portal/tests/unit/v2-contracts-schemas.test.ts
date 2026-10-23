import { describe, expect, it } from "vitest";

import {
  activeTimeBatchV2Schema,
  activeTimeSubmissionV2Schema,
  contentManifestV1Schema,
  GAME_STATE_MAX_UTF8_BYTES,
  parseGameStateV2,
  parsePlayerBootstrapV2,
  parseSessionContentPolicyV1,
  protocolErrorV2Schema,
  safeParseGameStateV2,
  safeParsePlayerBootstrapV2,
  safeParseResultSubmissionV2,
  safeParseSessionContentPolicyV1,
  serializedStateUtf8Bytes,
} from "@/contracts/v2";

const policy = {
  policy_version: 1,
  authored_content_version: "heroes_trial_school_2026_10",
  enabled_module_ids: ["saude_bucal"],
  enabled_mission_ids: ["brushing_teeth"],
  activity_presets: { brushing_teeth_practice: "padrao" },
  options: { skin_shop: false, future_option: "future_value" },
};

const bootstrap = {
  type: "portal.bootstrap.v2",
  request_id: "bootstrap-1",
  protocol_version: 2,
  player_id: "player-1",
  class_session_id: "session-1",
  revision: 0,
  new_player: true,
  state: null,
  stored_content_version: null,
  content_policy: policy,
};

const result = {
  type: "game.result.v2",
  request_id: "result-1",
  activity_id: "brushing_teeth_practice",
  mission_id: "brushing_teeth",
  context: {
    id_tentativa: "0190a444-1111-4111-8111-111111111111",
    id_atividade: "brushing_teeth_content",
    id_mecanica: "brushing_teeth",
    id_preset: "padrao",
    versao_atividade: 1,
    id_casa: 0,
    sequencia_tentativa: 1,
    numero_tentativa_atividade: 1,
    semente: 1,
    dificuldade: 1,
    parametros: {},
  },
  result: {
    estado: "sucesso",
    duracao_ms: 1000,
    metricas: { new_metric: 0.5 },
  },
};

describe("V2 contract schema smoke checks", () => {
  it("round-trips policy and allows an empty mission list for POLICY_EMPTY", () => {
    expect(parseSessionContentPolicyV1(policy)).toEqual(policy);
    expect(
      safeParseSessionContentPolicyV1({ ...policy, enabled_mission_ids: [] })
        .success,
    ).toBe(true);
    expect(
      safeParseSessionContentPolicyV1({
        ...policy,
        activity_presets: null,
        options: null,
      }).success,
    ).toBe(true);
  });

  it.each([
    { ...policy, unknown_key: true },
    { ...policy, enabled_mission_ids: ["brushing_teeth", "brushing_teeth"] },
    { ...policy, enabled_module_ids: ["saude_bucal", "saude_bucal"] },
    { ...policy, options: { skin_shop: 1 } },
    { ...policy, activity_presets: { brushing_teeth_practice: "" } },
  ])("rejects malformed policy %#", (input) => {
    expect(safeParseSessionContentPolicyV1(input).success).toBe(false);
  });

  it("round-trips opaque state without modeling gameplay fields", () => {
    const state = {
      schema_version: 3,
      history: { future_field: [null, true, "value", 0.5] },
      skins: {},
    };
    expect(parseGameStateV2(state)).toEqual(state);
  });

  it.each([
    { schema_version: 1 },
    { schema_version: 3, value: Infinity },
    { schema_version: 3, value: undefined },
    { schema_version: 3, value: new Date(0) },
    null,
    [],
  ])("rejects non-V3 or non-JSON state %#", (input) => {
    expect(safeParseGameStateV2(input).success).toBe(false);
  });

  it("bounds depth and safely rejects cycles", () => {
    let nested: unknown = null;
    for (let index = 0; index < 31; index++) nested = { nested };
    expect(safeParseGameStateV2({ schema_version: 3, nested }).success).toBe(
      true,
    );
    nested = { nested };
    expect(safeParseGameStateV2({ schema_version: 3, nested }).success).toBe(
      false,
    );
    const cyclic: Record<string, unknown> = { schema_version: 3 };
    cyclic.self = cyclic;
    expect(safeParseGameStateV2(cyclic).success).toBe(false);
  });

  it("enforces the compact UTF-8 state byte limit inclusively", () => {
    const overhead = serializedStateUtf8Bytes({ schema_version: 3, value: "" });
    const state = {
      schema_version: 3,
      value: "x".repeat(GAME_STATE_MAX_UTF8_BYTES - overhead),
    };
    expect(safeParseGameStateV2(state).success).toBe(true);
    expect(
      safeParseGameStateV2({ ...state, value: `${state.value}x` }).success,
    ).toBe(false);
    expect(
      safeParseGameStateV2({
        schema_version: 3,
        value: "\u00e9".repeat(140_000),
      }).success,
    ).toBe(false);
  });

  it("requires an explicit new_player discriminant for null state", () => {
    expect(parsePlayerBootstrapV2(bootstrap)).toEqual(bootstrap);
    const missingDiscriminant: Record<string, unknown> = { ...bootstrap };
    delete missingDiscriminant.new_player;
    expect(safeParsePlayerBootstrapV2(missingDiscriminant).success).toBe(false);
    expect(
      safeParsePlayerBootstrapV2({ ...bootstrap, new_player: false }).success,
    ).toBe(false);
    expect(
      safeParsePlayerBootstrapV2({ ...bootstrap, type: "portal.bootstrap.v1" })
        .success,
    ).toBe(false);
    expect(
      safeParsePlayerBootstrapV2({
        ...bootstrap,
        new_player: false,
        stored_content_version: policy.authored_content_version,
        state: { schema_version: 3 },
      }).success,
    ).toBe(true);
  });

  it("accepts generic finite metrics, but rejects non-finite or excessive metrics", () => {
    expect(safeParseResultSubmissionV2(result).success).toBe(true);
    for (const metricas of [
      { value: NaN },
      { value: Infinity },
      { value: -Infinity },
      Object.fromEntries(
        Array.from({ length: 33 }, (_, index) => [`m${index}`, 1]),
      ),
    ]) {
      expect(
        safeParseResultSubmissionV2({
          ...result,
          result: { ...result.result, metricas },
        }).success,
      ).toBe(false);
    }
  });

  it.each(["", "Bad-Preset", "x".repeat(65)])(
    "rejects invalid id_preset %s",
    (id_preset) => {
      expect(
        safeParseResultSubmissionV2({
          ...result,
          context: { ...result.context, id_preset },
        }).success,
      ).toBe(false);
    },
  );

  it("retains initialization failure duration and empty-metric rules", () => {
    const failure = {
      estado: "erro_inicializacao",
      duracao_ms: 0,
      metricas: {},
    };
    expect(
      safeParseResultSubmissionV2({ ...result, result: failure }).success,
    ).toBe(true);
    expect(
      safeParseResultSubmissionV2({
        ...result,
        result: { ...failure, duracao_ms: 1 },
      }).success,
    ).toBe(false);
  });

  it("accepts optional mission IDs and retains active-time batch deduplication", () => {
    const event = {
      request_id: "time-1",
      mode: "activity",
      active_ms: 1000,
      mission_id: "brushing_teeth",
    };
    expect(
      activeTimeSubmissionV2Schema.safeParse({
        type: "game.active_time.v2",
        events: [event],
      }).success,
    ).toBe(true);
    const queued = { ...event, client_event_id: "event-1" };
    expect(
      activeTimeBatchV2Schema.safeParse({
        type: "game.active_time.v2",
        events: [queued],
      }).success,
    ).toBe(true);
    expect(
      activeTimeBatchV2Schema.safeParse({
        type: "game.active_time.v2",
        events: [queued, queued],
      }).success,
    ).toBe(false);
  });

  it("accepts the game's manifest interface, with required boolean preset defaults", () => {
    const manifest = {
      manifest_version: 1,
      content_version: policy.authored_content_version,
      modules: [
        {
          module_id: "saude_bucal",
          title: "Module",
          summary: "Summary",
          order: 1,
          mission_ids: ["brushing_teeth"],
        },
      ],
      missions: [
        {
          mission_id: "brushing_teeth",
          module_id: "saude_bucal",
          title: "Mission",
          summary: "Summary",
          activity_ids: ["brushing_teeth_practice"],
          completion_reward: { coins: 1, stars: 1 },
        },
      ],
      activities: [
        {
          activity_id: "brushing_teeth_practice",
          mission_id: "brushing_teeth",
          content_id: "brushing_teeth_content",
          mechanic_id: "brushing_teeth",
          activity_version: 1,
          title: "Activity",
          presets: [{ preset_id: "padrao", label: "Default", default: true }],
          metrics: [{ key: "new_metric", label: "Metric", kind: "measure" }],
        },
      ],
      session_options: [
        {
          option_id: "skin_shop",
          type: "boolean",
          default: false,
          label: "Shop",
        },
      ],
    };
    expect(contentManifestV1Schema.parse(manifest)).toEqual(manifest);
    expect(
      contentManifestV1Schema.safeParse({
        ...manifest,
        build_id: "not-in-interface",
      }).success,
    ).toBe(false);
  });

  it.each([
    "POLICY_INVALID",
    "POLICY_EMPTY",
    "CONTENT_UPGRADE_REQUIRED",
    "INTERNAL_ERROR",
    "LOAD_FAILED",
  ])("accepts protocol error %s", (code) => {
    expect(
      protocolErrorV2Schema.safeParse({
        type: "protocol.error.v2",
        code,
        message: "Test failure",
      }).success,
    ).toBe(true);
  });
});
