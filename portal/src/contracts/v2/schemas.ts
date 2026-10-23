import { z } from "zod";

export const PROTOCOL_VERSION = 2 as const;
export const SUPPORTED_STATE_SCHEMA_VERSIONS = [3] as const;
export const GAME_STATE_MAX_UTF8_BYTES = 262_144;
export const CONTENT_POLICY_VERSION = 1 as const;
export const CONTENT_MANIFEST_MAX_UTF8_BYTES = 131_072;

export function serializedStateUtf8Bytes(state: unknown): number {
  return new TextEncoder().encode(JSON.stringify(state)).byteLength;
}

const idSchema = z.string().min(1).max(200);
const stableIdSchema = z.string().regex(/^[a-z0-9_]{1,64}$/);
const attemptIdSchema = z.union([z.uuid(), z.ulid()]);
const revisionSchema = z.number().int().safe().nonnegative();
const nonNegativeNumberSchema = z.number().finite().nonnegative();
const positiveIntegerSchema = z.number().int().safe().positive();
const nonNegativeIntegerSchema = z.number().int().safe().nonnegative();

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isBoundedJson(
  value: unknown,
  depth = 0,
  ancestors = new Set<object>(),
): boolean {
  if (depth > 32) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (!Array.isArray(value) && !isPlainRecord(value)) return false;
  const keys = Object.keys(value);
  if (
    Reflect.ownKeys(value).length !== keys.length + (Array.isArray(value) ? 1 : 0) ||
    Object.values(Object.getOwnPropertyDescriptors(value)).some(
      (field) => !Object.hasOwn(field, "value"),
    ) ||
    (Array.isArray(value) &&
      (keys.length !== value.length ||
        !keys.every((key, index) => key === String(index)))) ||
    ancestors.has(value)
  )
    return false;
  ancestors.add(value);
  const valid = Object.values(value).every((entry) =>
    isBoundedJson(entry, depth + 1, ancestors),
  );
  ancestors.delete(value);
  return valid;
}

// Preflight raw input before recursive Zod parsing to reject cycles and excess depth.
export const gameStateV2Schema = z
  .unknown()
  .refine((value) => isPlainRecord(value) && isBoundedJson(value), {
    message: "Game state must be a plain JSON object with finite numbers and depth at most 32",
    abort: true,
  })
  .pipe(
    z
      .object({
        schema_version: z.literal(SUPPORTED_STATE_SCHEMA_VERSIONS, {
          error: "Unsupported state schema version; V2 requires schema_version 3",
        }),
      })
      .catchall(jsonValueSchema),
  )
  .refine(
    (state) => serializedStateUtf8Bytes(state) <= GAME_STATE_MAX_UTF8_BYTES,
    {
      message: `Serialized game state exceeds ${GAME_STATE_MAX_UTF8_BYTES} UTF-8 bytes`,
    },
  );

const policyIdListSchema = z
  .array(z.string().min(1).max(100))
  .max(256)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "Policy IDs must be unique",
  });
const presetMapSchema = z
  .unknown()
  .refine(isPlainRecord)
  .pipe(z.record(z.string(), z.string().min(1)));
const optionMapSchema = z
  .unknown()
  .refine(isPlainRecord)
  .pipe(z.record(z.string(), z.union([z.boolean(), z.string()])));

export const sessionContentPolicyV1Schema = z
  .unknown()
  .refine(isPlainRecord)
  .pipe(
    z
      .object({
        policy_version: z.literal(CONTENT_POLICY_VERSION),
        authored_content_version: idSchema,
        enabled_module_ids: policyIdListSchema,
        enabled_mission_ids: policyIdListSchema,
        // The game's validator treats null optional maps as omitted.
        activity_presets: presetMapSchema.nullable().optional(),
        options: optionMapSchema.nullable().optional(),
      })
      .strict(),
  );

const manifestTextSchema = z.string().refine((text) => text.trim().length > 0);

export const contentManifestV1Schema = z
  .object({
    manifest_version: z.literal(1),
    content_version: z.string().regex(/^[a-z0-9_]{1,200}$/),
    modules: z.array(
      z
        .object({
          module_id: stableIdSchema,
          title: manifestTextSchema,
          summary: manifestTextSchema,
          order: positiveIntegerSchema,
          mission_ids: z.array(stableIdSchema),
        })
        .strict(),
    ),
    missions: z.array(
      z
        .object({
          mission_id: stableIdSchema,
          module_id: stableIdSchema,
          title: manifestTextSchema,
          summary: manifestTextSchema,
          activity_ids: z.array(stableIdSchema),
          completion_reward: z
            .object({
              coins: nonNegativeNumberSchema,
              stars: nonNegativeNumberSchema,
            })
            .strict(),
        })
        .strict(),
    ),
    activities: z.array(
      z
        .object({
          activity_id: stableIdSchema,
          mission_id: stableIdSchema,
          content_id: stableIdSchema,
          mechanic_id: stableIdSchema,
          activity_version: positiveIntegerSchema,
          title: manifestTextSchema,
          presets: z.array(
            z
              .object({
                preset_id: stableIdSchema,
                label: manifestTextSchema,
                default: z.boolean(),
              })
              .strict(),
          ),
          metrics: z.array(
            z
              .object({
                key: stableIdSchema,
                label: manifestTextSchema,
                kind: z.enum(["count", "score", "ratio", "duration_ms", "measure"]),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
    session_options: z.array(
      z
        .object({
          option_id: stableIdSchema,
          type: z.literal("boolean"),
          default: z.boolean(),
          label: manifestTextSchema,
        })
        .strict(),
    ),
  })
  .strict()
  .refine(
    (manifest) =>
      serializedStateUtf8Bytes(manifest) <= CONTENT_MANIFEST_MAX_UTF8_BYTES,
    {
      message: `Serialized content manifest exceeds ${CONTENT_MANIFEST_MAX_UTF8_BYTES} UTF-8 bytes`,
    },
  );

const bootstrapBase = {
  type: z.literal("portal.bootstrap.v2"),
  request_id: idSchema,
  protocol_version: z.literal(PROTOCOL_VERSION, {
    error: "Unsupported protocol version; V2 requires protocol_version 2",
  }),
  player_id: idSchema,
  class_session_id: idSchema,
  revision: revisionSchema,
  content_policy: sessionContentPolicyV1Schema,
};

const returningPlayerBootstrapSchema = z
  .object({
    ...bootstrapBase,
    new_player: z.literal(false),
    state: gameStateV2Schema,
    stored_content_version: idSchema,
  })
  .strict();

export const newPlayerBootstrapV2Schema = z
  .object({
    ...bootstrapBase,
    new_player: z.literal(true),
    state: z.null(),
    stored_content_version: z.null(),
  })
  .strict();

export const playerBootstrapV2Schema = z.discriminatedUnion("new_player", [
  returningPlayerBootstrapSchema,
  newPlayerBootstrapV2Schema,
]);

export const gameReadyV2Schema = z
  .object({
    type: z.literal("game.ready.v2"),
    supported_protocol_versions: z.array(positiveIntegerSchema).min(1),
    supported_state_schema_versions: z.array(positiveIntegerSchema).min(1),
    content_version: idSchema,
  })
  .strict();

export const bootstrapAppliedV2Schema = z
  .object({
    type: z.literal("game.bootstrap_applied.v2"),
    request_id: idSchema,
    effective_mission_ids: policyIdListSchema,
    ignored: z
      .object({
        mission_ids: policyIdListSchema,
        presets: presetMapSchema,
        options: z.array(z.string()),
      })
      .strict(),
  })
  .strict();

export const stateSaveRequestV2Schema = z
  .object({
    type: z.literal("game.save.v2"),
    request_id: idSchema,
    expected_revision: revisionSchema,
    content_version: idSchema,
    state: gameStateV2Schema,
  })
  .strict();

export const stateSaveSuccessV2Schema = z
  .object({
    type: z.literal("portal.save_ok.v2"),
    request_id: idSchema,
    revision: revisionSchema,
  })
  .strict();

export const stateSaveConflictV2Schema = z
  .object({
    type: z.literal("portal.save_conflict.v2"),
    request_id: idSchema,
    revision: revisionSchema,
    stored_content_version: idSchema,
    state: gameStateV2Schema,
  })
  .strict();

export type PlainData =
  | boolean
  | number
  | string
  | PlainData[]
  | { [key: string]: PlainData };

const plainDataSchema: z.ZodType<PlainData> = z.lazy(() =>
  z.union([
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(plainDataSchema).max(256),
    z.record(z.string(), plainDataSchema),
  ]),
);

export const activityContextV2Schema = z
  .object({
    id_tentativa: attemptIdSchema,
    id_atividade: idSchema,
    id_mecanica: idSchema,
    id_preset: stableIdSchema,
    versao_atividade: positiveIntegerSchema,
    id_casa: nonNegativeIntegerSchema,
    sequencia_tentativa: positiveIntegerSchema,
    numero_tentativa_atividade: positiveIntegerSchema,
    semente: positiveIntegerSchema,
    dificuldade: z.number().finite().positive(),
    parametros: z.record(z.string(), plainDataSchema),
  })
  .strict();

const metricsSchema = z
  .unknown()
  .refine(isPlainRecord)
  .pipe(z.record(z.string(), z.number().finite()))
  .refine((metrics) => Object.keys(metrics).length <= 32, {
    message: "Result metrics must contain at most 32 keys",
  });

const resultSchema = z.discriminatedUnion("estado", [
  z
    .object({
      estado: z.enum(["sucesso", "falha", "cancelado", "tempo_esgotado"]),
      duracao_ms: nonNegativeIntegerSchema,
      metricas: metricsSchema,
    })
    .strict(),
  z
    .object({
      estado: z.literal("erro_inicializacao"),
      duracao_ms: z.literal(0),
      metricas: z.object({}).strict(),
    })
    .strict(),
]);

export const resultSubmissionV2Schema = z
  .object({
    type: z.literal("game.result.v2"),
    request_id: idSchema,
    activity_id: idSchema,
    mission_id: idSchema,
    context: activityContextV2Schema,
    result: resultSchema,
  })
  .strict();

export const resultEventV2Schema = resultSubmissionV2Schema.extend({
  client_event_id: idSchema,
});

export const resultAcknowledgementV2Schema = z
  .object({
    type: z.literal("portal.result_ack.v2"),
    client_event_id: idSchema,
  })
  .strict();

export const activeTimeEventV2Schema = z
  .object({
    request_id: idSchema,
    client_event_id: idSchema,
    active_ms: z.number().int().min(1).max(30_000),
    mode: z.enum(["exploration", "dialogue", "activity"]),
    mission_id: idSchema.optional(),
  })
  .strict();

export const activeTimeSubmissionV2Schema = z
  .object({
    type: z.literal("game.active_time.v2"),
    events: z
      .array(activeTimeEventV2Schema.omit({ client_event_id: true }))
      .min(1)
      .max(100),
  })
  .strict()
  .refine(
    ({ events }) =>
      new Set(events.map(({ request_id }) => request_id)).size === events.length,
    { message: "request_id values must be unique within a batch" },
  );

export const activeTimeBatchV2Schema = z
  .object({
    type: z.literal("game.active_time.v2"),
    events: z.array(activeTimeEventV2Schema).min(1).max(100),
  })
  .strict()
  .refine(
    ({ events }) =>
      new Set(events.map(({ client_event_id }) => client_event_id)).size ===
      events.length,
    { message: "client_event_id values must be unique within a batch" },
  )
  .refine(
    ({ events }) =>
      new Set(events.map(({ request_id }) => request_id)).size === events.length,
    { message: "request_id values must be unique within a batch" },
  );

export const activeTimeAcknowledgementV2Schema = z
  .object({
    type: z.literal("portal.active_time_ack.v2"),
    acknowledged_event_ids: z.array(idSchema).min(1).max(100),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.acknowledged_event_ids).size ===
      value.acknowledged_event_ids.length,
    { message: "acknowledged_event_ids must be unique" },
  );

export const localDurabilityAcknowledgementV2Schema = z.discriminatedUnion(
  "record_type",
  [
    z
      .object({
        type: z.literal("portal.local_durable.v2"),
        record_type: z.literal("state"),
        request_id: idSchema,
      })
      .strict(),
    z
      .object({
        type: z.literal("portal.local_durable.v2"),
        record_type: z.enum(["result", "active_time"]),
        events: z
          .array(
            z
              .object({
                request_id: idSchema,
                client_event_id: idSchema,
              })
              .strict(),
          )
          .min(1)
          .max(100),
      })
      .strict()
      .refine(
        ({ events }) =>
          new Set(events.map(({ request_id }) => request_id)).size ===
          events.length,
        { message: "request_id values must be unique" },
      )
      .refine(
        ({ events }) =>
          new Set(events.map(({ client_event_id }) => client_event_id)).size ===
          events.length,
        { message: "client_event_id values must be unique" },
      ),
  ],
);

export const hostVisibilityV2Schema = z
  .object({
    type: z.literal("portal.visibility.v2"),
    visible: z.boolean(),
    focused: z.boolean(),
    online: z.boolean(),
  })
  .strict();

export const protocolErrorV2Schema = z
  .object({
    type: z.literal("protocol.error.v2"),
    code: z.enum([
      "VALIDATION_FAILED",
      "PROTOCOL_VERSION_UNSUPPORTED",
      "STATE_SCHEMA_VERSION_UNSUPPORTED",
      "STATE_TOO_LARGE",
      "POLICY_INVALID",
      "POLICY_EMPTY",
      "CONTENT_UPGRADE_REQUIRED",
      "INTERNAL_ERROR",
      "LOAD_FAILED",
    ]),
    message: z.string().min(1).max(500),
    request_id: idSchema.optional(),
    client_event_id: idSchema.optional(),
    path: z.string().max(500).optional(),
  })
  .strict();

export const contractSchemasV2 = {
  "game-state": gameStateV2Schema,
  "session-content-policy": sessionContentPolicyV1Schema,
  "content-manifest": contentManifestV1Schema,
  "player-bootstrap": playerBootstrapV2Schema,
  "new-player-bootstrap": newPlayerBootstrapV2Schema,
  "game-ready": gameReadyV2Schema,
  "bootstrap-applied": bootstrapAppliedV2Schema,
  "state-save-request": stateSaveRequestV2Schema,
  "state-save-success": stateSaveSuccessV2Schema,
  "state-save-conflict": stateSaveConflictV2Schema,
  "result-submission": resultSubmissionV2Schema,
  "result-event": resultEventV2Schema,
  "result-acknowledgement": resultAcknowledgementV2Schema,
  "active-time-submission": activeTimeSubmissionV2Schema,
  "active-time-batch": activeTimeBatchV2Schema,
  "active-time-acknowledgement": activeTimeAcknowledgementV2Schema,
  "local-durability-acknowledgement": localDurabilityAcknowledgementV2Schema,
  "host-visibility": hostVisibilityV2Schema,
  "protocol-error": protocolErrorV2Schema,
} as const;

export type GameStateV2 = z.infer<typeof gameStateV2Schema>;
export type SessionContentPolicyV1 = z.infer<typeof sessionContentPolicyV1Schema>;
export type ContentManifestV1 = z.infer<typeof contentManifestV1Schema>;
export type PlayerBootstrapV2 = z.infer<typeof playerBootstrapV2Schema>;
export type NewPlayerBootstrapV2 = z.infer<typeof newPlayerBootstrapV2Schema>;
export type GameReadyV2 = z.infer<typeof gameReadyV2Schema>;
export type BootstrapAppliedV2 = z.infer<typeof bootstrapAppliedV2Schema>;
export type StateSaveRequestV2 = z.infer<typeof stateSaveRequestV2Schema>;
export type StateSaveSuccessV2 = z.infer<typeof stateSaveSuccessV2Schema>;
export type StateSaveConflictV2 = z.infer<typeof stateSaveConflictV2Schema>;
export type ActivityContextV2 = z.infer<typeof activityContextV2Schema>;
export type ResultSubmissionV2 = z.infer<typeof resultSubmissionV2Schema>;
export type ResultEventV2 = z.infer<typeof resultEventV2Schema>;
export type ResultAcknowledgementV2 = z.infer<typeof resultAcknowledgementV2Schema>;
export type ActiveTimeEventV2 = z.infer<typeof activeTimeEventV2Schema>;
export type ActiveTimeSubmissionV2 = z.infer<typeof activeTimeSubmissionV2Schema>;
export type ActiveTimeBatchV2 = z.infer<typeof activeTimeBatchV2Schema>;
export type ActiveTimeAcknowledgementV2 = z.infer<typeof activeTimeAcknowledgementV2Schema>;
export type LocalDurabilityAcknowledgementV2 = z.infer<
  typeof localDurabilityAcknowledgementV2Schema
>;
export type HostVisibilityV2 = z.infer<typeof hostVisibilityV2Schema>;
export type ProtocolErrorV2 = z.infer<typeof protocolErrorV2Schema>;
