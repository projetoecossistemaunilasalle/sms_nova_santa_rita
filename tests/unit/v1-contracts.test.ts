import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  contractSchemasV1,
  CONTENT_VERSION,
  GAME_STATE_MAX_UTF8_BYTES,
  parseActiveTimeBatchV1,
  parseActiveTimeSubmissionV1,
  parseGameStateV1,
  parsePlayerBootstrapV1,
  parseResultEventV1,
  parseResultSubmissionV1,
  parseStateSaveRequestV1,
  safeParseActiveTimeBatchV1,
  safeParseActiveTimeSubmissionV1,
  safeParseGameStateV1,
  safeParsePlayerBootstrapV1,
  safeParseResultEventV1,
  serializedStateUtf8Bytes,
} from "@/contracts/v1";

type SchemaName = keyof typeof contractSchemasV1;

const root = resolve(process.cwd(), "contracts");
const fixture = (kind: "valid" | "invalid", name: string): unknown =>
  JSON.parse(readFileSync(resolve(root, "fixtures", "v1", kind, name), "utf8"));
const jsonSchema = (name: SchemaName): object =>
  JSON.parse(
    readFileSync(
      resolve(root, "schemas", "v1", `${name}.v1.schema.json`),
      "utf8",
    ),
  );

const ajv = new Ajv2020({ allErrors: true, strict: false });
ajv.addKeyword({
  keyword: "x-uniqueBy",
  schemaType: ["string", "array"],
  type: "array",
  validate: (property: string | string[], values: unknown[]) => {
    const properties = Array.isArray(property) ? property : [property];
    return properties.every((key) => {
      const keys = values.map((value) =>
        typeof value === "object" && value !== null
          ? (value as Record<string, unknown>)[key]
          : undefined,
      );
      return new Set(keys).size === keys.length;
    });
  },
});

const validators = Object.fromEntries(
  Object.keys(contractSchemasV1).map((name) => [
    name,
    ajv.compile(jsonSchema(name as SchemaName)),
  ]),
) as Record<SchemaName, ReturnType<typeof ajv.compile>>;

function removeGeneratedExtensions(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(removeGeneratedExtensions);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const object = value as Record<string, unknown>;
  delete object["x-uniqueBy"];
  delete object.uniqueItems;
  Object.values(object).forEach(removeGeneratedExtensions);
}

function jsonRepresentationAccepts(
  name: SchemaName,
  payload: unknown,
): boolean {
  if (!validators[name](payload)) return false;
  if (
    [
      "game-state",
      "player-bootstrap",
      "state-save-request",
      "state-save-conflict",
    ].includes(name)
  ) {
    const state =
      name === "game-state" ? payload : (payload as { state?: unknown }).state;
    if (
      state !== null &&
      state !== undefined &&
      serializedStateUtf8Bytes(state) > GAME_STATE_MAX_UTF8_BYTES
    ) {
      return false;
    }
  }
  return true;
}

const validFixtures: Array<[string, SchemaName]> = [
  ["game-state.json", "game-state"],
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
  ["result-acknowledgement.json", "result-acknowledgement"],
  ["active-time-submission.json", "active-time-submission"],
  ["active-time-batch.json", "active-time-batch"],
  ["active-time-acknowledgement.json", "active-time-acknowledgement"],
  ["local-durability-acknowledgement.json", "local-durability-acknowledgement"],
  ["visibility-focused.json", "host-visibility"],
  ["visibility-background-offline.json", "host-visibility"],
  ["protocol-error.json", "protocol-error"],
];

const invalidFixtures: Array<[string, SchemaName]> = [
  ["unsupported-protocol-version.json", "player-bootstrap"],
  ["unsupported-state-schema-version.json", "game-state"],
  ["oversized-state.json", "game-state"],
  ["malformed-metric.json", "result-event"],
  ["unknown-result-metric.json", "result-event"],
  ["malformed-result.json", "result-event"],
  ["malformed-context.json", "result-event"],
  ["invalid-revision.json", "state-save-success"],
  ["invalid-active-time-event.json", "active-time-batch"],
  ["duplicate-active-time-event.json", "active-time-batch"],
  ["duplicate-active-time-request.json", "active-time-submission"],
  ["ambiguous-new-player-bootstrap.json", "player-bootstrap"],
];

describe("V1 contract representations", () => {
  it("publishes the canonical initial GameMaker content version", () => {
    expect(CONTENT_VERSION).toBe("heroes_trial_school_v1");
    expect(
      (fixture("valid", "game-state.json") as { content_version: string })
        .content_version,
    ).toBe(CONTENT_VERSION);
  });

  it.each(Object.keys(contractSchemasV1) as SchemaName[])(
    "keeps generated JSON Schema %s synchronized with Zod",
    (schemaName) => {
      const committed = structuredClone(jsonSchema(schemaName)) as Record<
        string,
        unknown
      >;
      delete committed.$id;
      delete committed.title;
      delete committed["x-state-max-serialized-utf8-bytes"];

      removeGeneratedExtensions(committed);

      expect(committed).toEqual(
        z.toJSONSchema(contractSchemasV1[schemaName], {
          target: "draft-2020-12",
          reused: "ref",
        }),
      );
    },
  );

  it.each(validFixtures)("accepts valid fixture %s", (name, schemaName) => {
    const payload = fixture("valid", name);
    expect(contractSchemasV1[schemaName].safeParse(payload).success).toBe(true);
    expect(jsonRepresentationAccepts(schemaName, payload)).toBe(true);
  });

  it.each(invalidFixtures)("rejects invalid fixture %s", (name, schemaName) => {
    const payload = fixture("invalid", name);
    const zodAccepts =
      schemaName === "game-state"
        ? safeParseGameStateV1(payload).success
        : schemaName === "player-bootstrap"
          ? safeParsePlayerBootstrapV1(payload).success
          : schemaName === "result-event"
            ? safeParseResultEventV1(payload).success
            : schemaName === "active-time-batch"
              ? safeParseActiveTimeBatchV1(payload).success
              : contractSchemasV1[schemaName].safeParse(payload).success;
    expect(zodAccepts).toBe(false);
    expect(jsonRepresentationAccepts(schemaName, payload)).toBe(false);
  });
});

describe("game state invariants", () => {
  it("enforces the 64 KiB limit using serialized UTF-8 bytes", () => {
    const state = fixture("valid", "game-state.json") as {
      missions: { when_play_stops_being_play: { data: { padding?: string } } };
    };
    let low = 0;
    let high = GAME_STATE_MAX_UTF8_BYTES;
    while (low < high) {
      const next = Math.ceil((low + high) / 2);
      state.missions.when_play_stops_being_play.data.padding = "a".repeat(next);
      if (serializedStateUtf8Bytes(state) <= GAME_STATE_MAX_UTF8_BYTES)
        low = next;
      else high = next - 1;
    }
    state.missions.when_play_stops_being_play.data.padding = "a".repeat(low);
    expect(serializedStateUtf8Bytes(state)).toBe(GAME_STATE_MAX_UTF8_BYTES);
    expect(parseGameStateV1(state)).toEqual(state);

    state.missions.when_play_stops_being_play.data.padding += "é";
    expect(serializedStateUtf8Bytes(state)).toBe(GAME_STATE_MAX_UTF8_BYTES + 2);
    expect(() => parseGameStateV1(state)).toThrow(
      `Serialized game state exceeds ${GAME_STATE_MAX_UTF8_BYTES} UTF-8 bytes`,
    );
  });

  it("keeps server revision and activity sequence out of state", () => {
    const state = fixture("valid", "game-state.json") as Record<
      string,
      unknown
    >;
    expect(() => parseGameStateV1({ ...state, revision: 42 })).toThrow();
    expect(() =>
      parseGameStateV1({ ...state, activity_flow: { sequence: 42 } }),
    ).toThrow();

    const save = parseStateSaveRequestV1(
      fixture("valid", "state-save-request.json"),
    );
    const result = parseResultEventV1(
      fixture("valid", "result-pingpong-defense.json"),
    );
    expect(save.expected_revision).toBe(42);
    expect(result.context.sequencia_tentativa).toBe(1);
  });

  it("leaves mission/reward semantic consistency to GameMaker", () => {
    const state = fixture("valid", "game-state.json") as {
      missions: { lia_memory: { status: string } };
      progression: { challenges: Record<string, true> };
    };
    state.missions.lia_memory.status = "complete";
    delete state.progression.challenges.lia_memory;
    expect(parseGameStateV1(state)).toEqual(state);
  });

  it("requires null state only for an explicit new-player bootstrap", () => {
    expect(
      parsePlayerBootstrapV1(fixture("valid", "new-player-bootstrap.json"))
        .state,
    ).toBeNull();
    expect(
      safeParsePlayerBootstrapV1(
        fixture("invalid", "ambiguous-new-player-bootstrap.json"),
      ).success,
    ).toBe(false);
  });

  it("reports unsupported protocol and state versions explicitly", () => {
    const protocol = safeParsePlayerBootstrapV1(
      fixture("invalid", "unsupported-protocol-version.json"),
    );
    const state = safeParseGameStateV1(
      fixture("invalid", "unsupported-state-schema-version.json"),
    );
    expect(protocol.success).toBe(false);
    expect(state.success).toBe(false);
    if (!protocol.success && protocol.error instanceof z.ZodError) {
      expect(protocol.error.issues[0]?.message).toContain(
        "Unsupported protocol",
      );
    }
    if (!state.success && state.error instanceof z.ZodError) {
      expect(state.error.issues[0]?.message).toContain(
        "Unsupported state schema",
      );
    }
  });
});

describe("event invariants", () => {
  it("separates stable GameMaker request IDs from host event IDs", () => {
    const submission = parseResultSubmissionV1(
      fixture("valid", "result-submission.json"),
    );
    const queued = parseResultEventV1(
      fixture("valid", "result-lia-memory.json"),
    );
    expect(submission.request_id).toBe(queued.request_id);
    expect("client_event_id" in submission).toBe(false);
    expect(queued.client_event_id).toBe("event-result-lia-001");

    const timeSubmission = parseActiveTimeSubmissionV1(
      fixture("valid", "active-time-submission.json"),
    );
    const timeBatch = parseActiveTimeBatchV1(
      fixture("valid", "active-time-batch.json"),
    );
    expect(timeSubmission.events.map(({ request_id }) => request_id)).toEqual(
      timeBatch.events.map(({ request_id }) => request_id),
    );
    expect(
      safeParseActiveTimeSubmissionV1(
        fixture("invalid", "duplicate-active-time-request.json"),
      ).success,
    ).toBe(false);
  });

  it("preserves every supported runtime result state and integer millisecond durations", () => {
    const base = fixture("valid", "result-lia-memory.json") as {
      result: {
        estado: string;
        duracao_ms: number;
        metricas: Record<string, unknown>;
      };
    };
    for (const estado of ["sucesso", "falha", "cancelado", "tempo_esgotado"]) {
      base.result.estado = estado;
      base.result.duracao_ms = 12;
      expect(parseResultEventV1(base).result.estado).toBe(estado);
    }
    base.result.duracao_ms = 12.5;
    expect(() => parseResultEventV1(base)).toThrow();
    base.result = {
      estado: "erro_inicializacao",
      duracao_ms: 0,
      metricas: {},
    };
    expect(parseResultEventV1(base).result.estado).toBe("erro_inicializacao");
  });

  it("selects the exact metric contract from activity_id", () => {
    const lia = fixture("valid", "result-lia-memory.json") as Record<
      string,
      unknown
    >;
    const pingPong = fixture("valid", "result-pingpong-defense.json") as {
      result: unknown;
    };
    expect(() =>
      parseResultEventV1({ ...lia, result: pingPong.result }),
    ).toThrow();
    expect(
      safeParseResultEventV1(fixture("invalid", "unknown-result-metric.json"))
        .success,
    ).toBe(false);
  });

  it("enforces active-time bounds and unique event IDs", () => {
    expect(
      parseActiveTimeBatchV1(fixture("valid", "active-time-batch.json")).events,
    ).toHaveLength(3);
    expect(
      safeParseActiveTimeBatchV1(
        fixture("invalid", "invalid-active-time-event.json"),
      ).success,
    ).toBe(false);
    expect(
      safeParseActiveTimeBatchV1(
        fixture("invalid", "duplicate-active-time-event.json"),
      ).success,
    ).toBe(false);
  });
});
