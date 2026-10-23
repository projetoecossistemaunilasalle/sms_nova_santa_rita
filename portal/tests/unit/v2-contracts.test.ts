import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  CONTENT_MANIFEST_MAX_UTF8_BYTES,
  GAME_STATE_MAX_UTF8_BYTES,
  contentManifestV1Schema,
  contractSchemasV2,
  sessionContentPolicyV1Schema,
  serializedStateUtf8Bytes,
} from "@/contracts/v2";

type SchemaName = keyof typeof contractSchemasV2;
const root = resolve(process.cwd(), "contracts");
const fixture = (kind: "valid" | "invalid", name: string): unknown =>
  JSON.parse(readFileSync(resolve(root, "fixtures/v2", kind, name), "utf8"));
const jsonSchema = (name: SchemaName): object =>
  JSON.parse(
    readFileSync(resolve(root, "schemas/v2", `${name}.v2.schema.json`), "utf8"),
  );

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  strictNumbers: true,
});
for (const [name, schema] of [
  ["uuid", z.uuid()],
  ["ulid", z.ulid()],
] as const) {
  ajv.addFormat(name, {
    type: "string",
    validate: (value: string) => schema.safeParse(value).success,
  });
}
for (const keyword of [
  "x-state-max-serialized-utf8-bytes",
  "x-manifest-max-serialized-utf8-bytes",
]) {
  ajv.addKeyword({
    keyword,
    schemaType: "number",
    type: "object",
    validate: (limit: number, value: object) =>
      serializedStateUtf8Bytes(value) <= limit,
  });
}
function withinDepth(value: unknown, limit: number, depth = 0): boolean {
  if (depth > limit) return false;
  return (
    typeof value !== "object" ||
    value === null ||
    Object.values(value).every((child) => withinDepth(child, limit, depth + 1))
  );
}
ajv.addKeyword({
  keyword: "x-state-max-depth",
  schemaType: "number",
  type: "object",
  validate: (limit: number, value: object) => withinDepth(value, limit),
});
ajv.addKeyword({
  keyword: "x-uniqueBy",
  schemaType: "array",
  type: "array",
  validate: (keys: string[], values: Record<string, unknown>[]) =>
    keys.every(
      (key) =>
        new Set(values.map((value) => value[key])).size === values.length,
    ),
});
const schemaNames = Object.keys(contractSchemasV2) as SchemaName[];
const validators = Object.fromEntries(
  schemaNames.map((name) => [name, ajv.compile(jsonSchema(name))]),
) as Record<SchemaName, ReturnType<typeof ajv.compile>>;

function removeGeneratedConstraints(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  const object = value as Record<string, unknown>;
  for (const key of Object.keys(object)) {
    if (
      key.startsWith("x-") ||
      key === "uniqueItems" ||
      key === "maxProperties" ||
      (key === "pattern" && object[key] === "\\S")
    )
      delete object[key];
  }
  Object.values(object).forEach(removeGeneratedConstraints);
}

const validFixtures: Array<[string, SchemaName]> = [
  ["game-state.json", "game-state"],
  ["session-content-policy.json", "session-content-policy"],
  ["content-manifest.json", "content-manifest"],
  ["returning-player-bootstrap.json", "player-bootstrap"],
  ["new-player-bootstrap.json", "new-player-bootstrap"],
  ["game-ready.json", "game-ready"],
  ["bootstrap-applied.json", "bootstrap-applied"],
  ["state-save-request.json", "state-save-request"],
  ["accepted-save.json", "state-save-success"],
  ["stale-revision-conflict.json", "state-save-conflict"],
  ["result-submission.json", "result-submission"],
  ["result-lia-memory.json", "result-event"],
  ["result-pingpong-defense.json", "result-event"],
  ["result-comfort-traffic-light.json", "result-event"],
  ["result-brushing-teeth-practice.json", "result-event"],
  ["result-smile-kit-selection.json", "result-event"],
  ["result-acknowledgement.json", "result-acknowledgement"],
  ["active-time-submission.json", "active-time-submission"],
  ["active-time-batch.json", "active-time-batch"],
  ["active-time-acknowledgement.json", "active-time-acknowledgement"],
  ["local-durability-acknowledgement.json", "local-durability-acknowledgement"],
  ["local-durability-state.json", "local-durability-acknowledgement"],
  ["local-durability-active-time.json", "local-durability-acknowledgement"],
  ["visibility-focused.json", "host-visibility"],
  ["visibility-background-offline.json", "host-visibility"],
  ...[
    "protocol-error.json",
    "protocol-error-policy-invalid.json",
    "protocol-error-policy-empty.json",
    "protocol-error-content-upgrade-required.json",
    "protocol-error-internal-error.json",
    "protocol-error-load-failed.json",
  ].map((name): [string, SchemaName] => [name, "protocol-error"]),
];
const invalidFixtures: Array<[string, SchemaName]> = [
  ["unknown-field.json", "game-ready"],
  ["v1-type-literal.json", "game-ready"],
  ["unsupported-state-schema-version.json", "game-state"],
  ["oversized-state.json", "game-state"],
  ["policy-unknown-key.json", "session-content-policy"],
  ["policy-duplicate-mission-ids.json", "session-content-policy"],
  ["policy-invalid-option.json", "session-content-policy"],
  ["bad-id-preset.json", "result-event"],
  ["non-finite-metric.json", "result-event"],
  ["null-state-without-new-player.json", "player-bootstrap"],
];

function expectAcceptance(
  name: SchemaName,
  payload: unknown,
  accepted: boolean,
) {
  expect(contractSchemasV2[name].safeParse(payload).success).toBe(accepted);
  expect(
    validators[name](payload),
    JSON.stringify(validators[name].errors),
  ).toBe(accepted);
}

describe("V2 contract representations", () => {
  it("covers every registry entry and every committed fixture/schema", () => {
    expect([...new Set(validFixtures.map(([, name]) => name))].sort()).toEqual(
      schemaNames.toSorted(),
    );
    expect(readdirSync(resolve(root, "schemas/v2")).sort()).toEqual(
      schemaNames.map((name) => `${name}.v2.schema.json`).sort(),
    );
    for (const [kind, entries] of [
      ["valid", validFixtures],
      ["invalid", invalidFixtures],
    ] as const) {
      expect(readdirSync(resolve(root, "fixtures/v2", kind)).sort()).toEqual(
        entries.map(([name]) => name).sort(),
      );
    }
  });

  it.each(schemaNames)(
    "keeps generated JSON Schema %s synchronized with Zod",
    (name) => {
      const committed = jsonSchema(name);
      removeGeneratedConstraints(committed);
      expect(committed).toEqual(
        z.toJSONSchema(contractSchemasV2[name], {
          target: "draft-2020-12",
          reused: "ref",
        }),
      );
    },
  );

  it.each(validFixtures)("accepts valid fixture %s", (name, schemaName) => {
    expectAcceptance(schemaName, fixture("valid", name), true);
  });
  it.each(invalidFixtures)("rejects invalid fixture %s", (name, schemaName) => {
    expectAcceptance(schemaName, fixture("invalid", name), false);
  });

  it("round-trips the real generated game manifest unchanged", () => {
    const payload = fixture("valid", "content-manifest.json");
    expect(contentManifestV1Schema.parse(payload)).toEqual(payload);
  });
  it("round-trips the game-compatible one-module policy unchanged", () => {
    const payload = fixture("valid", "session-content-policy.json");
    expect(sessionContentPolicyV1Schema.parse(payload)).toEqual(payload);
    expect(
      sessionContentPolicyV1Schema.parse(payload).enabled_module_ids,
    ).toHaveLength(1);
  });
  it("round-trips the real current-product V3 snapshot, including in envelopes", () => {
    const state = fixture("valid", "game-state.json");
    expect(contractSchemasV2["game-state"].parse(state)).toEqual(state);
    for (const [file, name] of validFixtures.filter(([, name]) =>
      [
        "player-bootstrap",
        "state-save-request",
        "state-save-conflict",
      ].includes(name),
    )) {
      const payload = fixture("valid", file);
      expect(contractSchemasV2[name].parse(payload)).toEqual(payload);
      expect((payload as { state: unknown }).state).toEqual(state);
    }
    expectAcceptance(
      "player-bootstrap",
      fixture("valid", "new-player-bootstrap.json"),
      true,
    );
  });
  it("uses the manifest's real metric, mission, content, mechanic and preset IDs for all five activities", () => {
    const manifest = contentManifestV1Schema.parse(
      fixture("valid", "content-manifest.json"),
    );
    const results = validFixtures
      .filter(([, name]) => name === "result-event")
      .map(([file]) =>
        contractSchemasV2["result-event"].parse(fixture("valid", file)),
      );
    expect(results.map(({ activity_id }) => activity_id).sort()).toEqual(
      manifest.activities.map(({ activity_id }) => activity_id).sort(),
    );
    for (const result of results) {
      const activity = manifest.activities.find(
        ({ activity_id }) => activity_id === result.activity_id,
      )!;
      expect(Object.keys(result.result.metricas).sort()).toEqual(
        activity.metrics.map(({ key }) => key).sort(),
      );
      expect(result.mission_id).toBe(activity.mission_id);
      expect(result.context.id_atividade).toBe(activity.content_id);
      expect(result.context.id_mecanica).toBe(activity.mechanic_id);
      expect(activity.presets.map(({ preset_id }) => preset_id)).toContain(
        result.context.id_preset,
      );
    }
  });
  it("really exercises a non-finite number rather than JSON null", () => {
    const payload = fixture("invalid", "non-finite-metric.json") as {
      result: { metricas: { pares: number } };
    };
    expect(payload.result.metricas.pares).toBe(Infinity);
  });
});

describe("V2 generated refinement constraints", () => {
  it("enforces serialized UTF-8 state bytes at the exact boundary, also in envelopes", () => {
    const state = { schema_version: 3, padding: "" };
    state.padding = "a".repeat(
      GAME_STATE_MAX_UTF8_BYTES - serializedStateUtf8Bytes(state),
    );
    expectAcceptance("game-state", state, true);
    state.padding += "\u00e9";
    expect(serializedStateUtf8Bytes(state)).toBe(GAME_STATE_MAX_UTF8_BYTES + 2);
    expectAcceptance("game-state", state, false);
    for (const [file, name] of validFixtures.filter(([, name]) =>
      [
        "player-bootstrap",
        "state-save-request",
        "state-save-conflict",
      ].includes(name),
    )) {
      expectAcceptance(
        name,
        { ...(fixture("valid", file) as object), state },
        false,
      );
    }
  });
  it("enforces opaque state depth 32 without closing game-owned fields", () => {
    let nested: unknown = null;
    for (let i = 0; i < 31; i++) nested = { nested };
    expectAcceptance("game-state", { schema_version: 3, future: nested }, true);
    expectAcceptance(
      "game-state",
      { schema_version: 3, future: { nested } },
      false,
    );
  });
  it("allows generic finite metrics up to 32 keys, not 33", () => {
    const result = contractSchemasV2["result-event"].parse(
      fixture("valid", "result-lia-memory.json"),
    );
    result.result.metricas = Object.fromEntries(
      Array.from({ length: 32 }, (_, i) => [`future_metric_${i}`, i + 0.5]),
    );
    expectAcceptance("result-event", result, true);
    result.result.metricas.future_metric_32 = 1;
    expectAcceptance("result-event", result, false);
  });
  it("enforces manifest byte limits and nonblank labels", () => {
    const manifest = contentManifestV1Schema.parse(
      fixture("valid", "content-manifest.json"),
    );
    manifest.modules[0]!.title = " ";
    expectAcceptance("content-manifest", manifest, false);
    manifest.modules[0]!.title = "a".repeat(CONTENT_MANIFEST_MAX_UTF8_BYTES);
    expectAcceptance("content-manifest", manifest, false);
  });
  it("allows empty policy missions for the game's POLICY_EMPTY response, but not duplicate modules", () => {
    const policy = sessionContentPolicyV1Schema.parse(
      fixture("valid", "session-content-policy.json"),
    );
    policy.enabled_mission_ids = [];
    expectAcceptance("session-content-policy", policy, true);
    policy.enabled_module_ids.push(policy.enabled_module_ids[0]!);
    expectAcceptance("session-content-policy", policy, false);
  });
  it.each(["request_id", "client_event_id"] as const)(
    "rejects duplicate batch %s independently",
    (key) => {
      const batch = contractSchemasV2["active-time-batch"].parse(
        fixture("valid", "active-time-batch.json"),
      );
      batch.events[1]![key] = batch.events[0]![key];
      expectAcceptance("active-time-batch", batch, false);
    },
  );
  it("enforces unique submission requests, durable mappings, effective missions and acknowledgements", () => {
    for (const [file, name, property] of [
      ["active-time-submission.json", "active-time-submission", "events"],
      [
        "local-durability-acknowledgement.json",
        "local-durability-acknowledgement",
        "events",
      ],
      ["bootstrap-applied.json", "bootstrap-applied", "effective_mission_ids"],
      [
        "active-time-acknowledgement.json",
        "active-time-acknowledgement",
        "acknowledged_event_ids",
      ],
    ] as const) {
      const payload = fixture("valid", file) as Record<string, unknown[]>;
      payload[property]!.push(payload[property]![0]);
      expectAcceptance(name, payload, false);
    }
  });
});
