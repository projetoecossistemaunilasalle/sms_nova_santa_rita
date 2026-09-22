import { z } from "zod";

export const GAME_STATE_MAX_UTF8_BYTES = 65_536;
export const PROTOCOL_VERSION = 1 as const;
export const STATE_SCHEMA_VERSION = 1 as const;
export const CONTENT_VERSION = "heroes_trial_school_v1" as const;

export function serializedStateUtf8Bytes(state: unknown): number {
  return new TextEncoder().encode(JSON.stringify(state)).byteLength;
}

const idSchema = z.string().min(1).max(200);
const attemptIdSchema = z.union([z.uuid(), z.ulid()]);
const protocolVersionSchema = z.literal(PROTOCOL_VERSION, {
  error: "Unsupported protocol version; V1 requires protocol_version 1",
});
const stateSchemaVersionSchema = z.literal(STATE_SCHEMA_VERSION, {
  error: "Unsupported state schema version; V1 requires schema_version 1",
});
const revisionSchema = z.number().int().safe().nonnegative();
const nonNegativeNumberSchema = z.number().finite().nonnegative();
const positiveIntegerSchema = z.number().int().safe().positive();
const nonNegativeIntegerSchema = z.number().int().safe().nonnegative();

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

const presenceSetSchema = z.record(z.string().min(1), z.literal(true));

export const missionStateV1Schema = z
  .object({
    status: z.enum(["available", "active", "complete"]),
    stage_id: idSchema,
    checkpoints: presenceSetSchema,
    data: z.record(z.string(), plainDataSchema),
  })
  .strict();

export const gameStateV1Schema = z
  .object({
    schema_version: stateSchemaVersionSchema,
    content_version: idSchema,
    missions: z
      .object({
        when_play_stops_being_play: missionStateV1Schema,
        lia_memory: missionStateV1Schema,
        pingpong_soccer: missionStateV1Schema,
        respect_also_cares: missionStateV1Schema,
      })
      .strict(),
    progression: z
      .object({
        coins: nonNegativeNumberSchema,
        stars: nonNegativeNumberSchema,
        challenges: presenceSetSchema,
        rewards: presenceSetSchema,
      })
      .strict(),
  })
  .strict()
  .refine(
    (state) =>
      serializedStateUtf8Bytes(state) <= GAME_STATE_MAX_UTF8_BYTES,
    {
      message: `Serialized game state exceeds ${GAME_STATE_MAX_UTF8_BYTES} UTF-8 bytes`,
    },
  );

const returningPlayerBootstrapSchema = z
  .object({
    type: z.literal("portal.bootstrap.v1"),
    request_id: idSchema,
    protocol_version: protocolVersionSchema,
    player_id: idSchema,
    class_session_id: idSchema,
    revision: revisionSchema,
    new_player: z.literal(false),
    state: gameStateV1Schema,
  })
  .strict();

const newPlayerBootstrapSchema = z
  .object({
    type: z.literal("portal.bootstrap.v1"),
    request_id: idSchema,
    protocol_version: protocolVersionSchema,
    player_id: idSchema,
    class_session_id: idSchema,
    revision: revisionSchema,
    new_player: z.literal(true),
    state: z.null(),
  })
  .strict();

export const playerBootstrapV1Schema = z.discriminatedUnion("new_player", [
  returningPlayerBootstrapSchema,
  newPlayerBootstrapSchema,
]);
export const newPlayerBootstrapV1Schema = newPlayerBootstrapSchema;

export const gameReadyV1Schema = z
  .object({
    type: z.literal("game.ready.v1"),
    supported_protocol_versions: z.array(positiveIntegerSchema).min(1),
    supported_state_schema_versions: z.array(positiveIntegerSchema).min(1),
  })
  .strict();

export const bootstrapAppliedV1Schema = z
  .object({
    type: z.literal("game.bootstrap_applied.v1"),
    request_id: idSchema,
  })
  .strict();

export const stateSaveRequestV1Schema = z
  .object({
    type: z.literal("game.save.v1"),
    request_id: idSchema,
    expected_revision: revisionSchema,
    state: gameStateV1Schema,
  })
  .strict();

export const stateSaveSuccessV1Schema = z
  .object({
    type: z.literal("portal.save_ok.v1"),
    request_id: idSchema,
    revision: revisionSchema,
  })
  .strict();

export const stateSaveConflictV1Schema = z
  .object({
    type: z.literal("portal.save_conflict.v1"),
    request_id: idSchema,
    revision: revisionSchema,
    state: gameStateV1Schema,
  })
  .strict();

export const activityContextV1Schema = z
  .object({
    id_tentativa: attemptIdSchema,
    id_atividade: idSchema,
    id_mecanica: idSchema,
    versao_atividade: positiveIntegerSchema,
    id_casa: nonNegativeIntegerSchema,
    sequencia_tentativa: positiveIntegerSchema,
    numero_tentativa_atividade: positiveIntegerSchema,
    semente: positiveIntegerSchema,
    dificuldade: z.number().finite().positive(),
    parametros: z.record(z.string(), plainDataSchema),
  })
  .strict();

const resultStateSchema = z.enum([
  "sucesso",
  "falha",
  "cancelado",
  "tempo_esgotado",
  "erro_inicializacao",
]);

const resultBase = {
  estado: resultStateSchema,
  duracao_ms: nonNegativeIntegerSchema,
};

const initializationFailureResultSchema = z
  .object({
    ...resultBase,
    estado: z.literal("erro_inicializacao"),
    duracao_ms: z.literal(0),
    metricas: z.object({}).strict(),
  })
  .strict();

const liaResultSchema = z.union([
  z
    .object({
      ...resultBase,
      estado: z.enum(["sucesso", "falha", "cancelado", "tempo_esgotado"]),
      metricas: z
        .object({
          pares: nonNegativeIntegerSchema,
          jogadas: nonNegativeIntegerSchema,
        })
        .strict(),
    })
    .strict(),
  initializationFailureResultSchema,
]);

const pingPongResultSchema = z.union([
  z
    .object({
      ...resultBase,
      estado: z.enum(["sucesso", "falha", "cancelado", "tempo_esgotado"]),
      metricas: z
        .object({
          bolas_bloqueadas: nonNegativeIntegerSchema,
          bolas_perdidas: nonNegativeIntegerSchema,
          trocas_concluidas: nonNegativeIntegerSchema,
          pontuacao_local: nonNegativeIntegerSchema,
        })
        .strict(),
    })
    .strict(),
  initializationFailureResultSchema,
]);

const comfortResultSchema = z.union([
  z
    .object({
      ...resultBase,
      estado: z.enum(["sucesso", "falha", "cancelado", "tempo_esgotado"]),
      metricas: z
        .object({ situacoes_classificadas: nonNegativeIntegerSchema })
        .strict(),
    })
    .strict(),
  initializationFailureResultSchema,
]);

const contextFor = (
  idAtividade: string,
  idMecanica: string,
  parametros: z.ZodType,
) =>
  activityContextV1Schema.extend({
    id_atividade: z.literal(idAtividade),
    id_mecanica: z.literal(idMecanica),
    parametros,
  });

const resultEnvelopeBase = {
  type: z.literal("game.result.v1"),
  request_id: idSchema,
};

const queuedResultEnvelopeBase = {
  ...resultEnvelopeBase,
  client_event_id: idSchema,
};

const createResultEventSchema = <T extends typeof resultEnvelopeBase>(
  envelope: T,
) =>
  z.discriminatedUnion("activity_id", [
  z
    .object({
      ...envelope,
      activity_id: z.literal("lia_memory"),
      mission_id: z.literal("lia_memory"),
      context: contextFor(
        "atitudes_positivas",
        "memory_pairs",
        z.object({ pares_para_concluir: positiveIntegerSchema }).strict(),
      ),
      result: liaResultSchema,
    })
    .strict(),
  z
    .object({
      ...envelope,
      activity_id: z.literal("pingpong_defense"),
      mission_id: z.literal("pingpong_soccer"),
      context: contextFor(
        "inclusao_no_recreio",
        "defesa_bolas",
        z
          .object({
            velocidade_bola: z.number().finite().positive(),
            quantidade_bolas: positiveIntegerSchema,
            trocas_para_concluir: positiveIntegerSchema,
          })
          .strict(),
      ),
      result: pingPongResultSchema,
    })
    .strict(),
  z
    .object({
      ...envelope,
      activity_id: z.literal("comfort_traffic_light"),
      mission_id: z.literal("respect_also_cares"),
      context: contextFor(
        "comfort_traffic_light_content",
        "comfort_traffic_light_drag",
        z.object({ total_cards: positiveIntegerSchema }).strict(),
      ),
      result: comfortResultSchema,
    })
    .strict(),
]);

export const resultSubmissionV1Schema = createResultEventSchema(resultEnvelopeBase);
export const resultEventV1Schema = createResultEventSchema(queuedResultEnvelopeBase);

export const resultAcknowledgementV1Schema = z
  .object({
    type: z.literal("portal.result_ack.v1"),
    client_event_id: idSchema,
  })
  .strict();

export const activeTimeEventV1Schema = z
  .object({
    request_id: idSchema,
    client_event_id: idSchema,
    active_ms: z.number().int().min(1).max(30_000),
    mode: z.enum(["exploration", "dialogue", "activity"]),
  })
  .strict();

export const activeTimeSubmissionV1Schema = z
  .object({
    type: z.literal("game.active_time.v1"),
    events: z
      .array(activeTimeEventV1Schema.omit({ client_event_id: true }))
      .min(1)
      .max(100),
  })
  .strict()
  .refine(
    ({ events }) =>
      new Set(events.map(({ request_id }) => request_id)).size === events.length,
    { message: "request_id values must be unique within a batch" },
  );

export const activeTimeBatchV1Schema = z
  .object({
    type: z.literal("game.active_time.v1"),
    events: z.array(activeTimeEventV1Schema).min(1).max(100),
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

export const activeTimeAcknowledgementV1Schema = z
  .object({
    type: z.literal("portal.active_time_ack.v1"),
    acknowledged_event_ids: z.array(idSchema).min(1).max(100),
  })
  .strict()
  .refine((value) => new Set(value.acknowledged_event_ids).size === value.acknowledged_event_ids.length, {
    message: "acknowledged_event_ids must be unique",
  });

export const localDurabilityAcknowledgementV1Schema = z.discriminatedUnion(
  "record_type",
  [
    z
      .object({
        type: z.literal("portal.local_durable.v1"),
        record_type: z.literal("state"),
        request_id: idSchema,
      })
      .strict(),
    z
      .object({
        type: z.literal("portal.local_durable.v1"),
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
          new Set(events.map(({ request_id }) => request_id)).size === events.length,
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

export const hostVisibilityV1Schema = z
  .object({
    type: z.literal("portal.visibility.v1"),
    visible: z.boolean(),
    focused: z.boolean(),
    online: z.boolean(),
  })
  .strict();

export const protocolErrorV1Schema = z
  .object({
    type: z.literal("protocol.error.v1"),
    code: z.enum([
      "VALIDATION_FAILED",
      "PROTOCOL_VERSION_UNSUPPORTED",
      "STATE_SCHEMA_VERSION_UNSUPPORTED",
      "STATE_TOO_LARGE",
    ]),
    message: z.string().min(1).max(500),
    request_id: idSchema.optional(),
    client_event_id: idSchema.optional(),
    path: z.string().max(500).optional(),
  })
  .strict();

export const contractSchemasV1 = {
  "game-state": gameStateV1Schema,
  "player-bootstrap": playerBootstrapV1Schema,
  "new-player-bootstrap": newPlayerBootstrapV1Schema,
  "game-ready": gameReadyV1Schema,
  "bootstrap-applied": bootstrapAppliedV1Schema,
  "state-save-request": stateSaveRequestV1Schema,
  "state-save-success": stateSaveSuccessV1Schema,
  "state-save-conflict": stateSaveConflictV1Schema,
  "result-submission": resultSubmissionV1Schema,
  "result-event": resultEventV1Schema,
  "result-acknowledgement": resultAcknowledgementV1Schema,
  "active-time-submission": activeTimeSubmissionV1Schema,
  "active-time-batch": activeTimeBatchV1Schema,
  "active-time-acknowledgement": activeTimeAcknowledgementV1Schema,
  "local-durability-acknowledgement": localDurabilityAcknowledgementV1Schema,
  "host-visibility": hostVisibilityV1Schema,
  "protocol-error": protocolErrorV1Schema,
} as const;

export type GameStateV1 = z.infer<typeof gameStateV1Schema>;
export type MissionStateV1 = z.infer<typeof missionStateV1Schema>;
export type PlayerBootstrapV1 = z.infer<typeof playerBootstrapV1Schema>;
export type NewPlayerBootstrapV1 = z.infer<typeof newPlayerBootstrapV1Schema>;
export type GameReadyV1 = z.infer<typeof gameReadyV1Schema>;
export type BootstrapAppliedV1 = z.infer<typeof bootstrapAppliedV1Schema>;
export type StateSaveRequestV1 = z.infer<typeof stateSaveRequestV1Schema>;
export type StateSaveSuccessV1 = z.infer<typeof stateSaveSuccessV1Schema>;
export type StateSaveConflictV1 = z.infer<typeof stateSaveConflictV1Schema>;
export type ActivityContextV1 = z.infer<typeof activityContextV1Schema>;
export type ResultSubmissionV1 = z.infer<typeof resultSubmissionV1Schema>;
export type ResultEventV1 = z.infer<typeof resultEventV1Schema>;
export type ResultAcknowledgementV1 = z.infer<typeof resultAcknowledgementV1Schema>;
export type ActiveTimeEventV1 = z.infer<typeof activeTimeEventV1Schema>;
export type ActiveTimeSubmissionV1 = z.infer<typeof activeTimeSubmissionV1Schema>;
export type ActiveTimeBatchV1 = z.infer<typeof activeTimeBatchV1Schema>;
export type ActiveTimeAcknowledgementV1 = z.infer<typeof activeTimeAcknowledgementV1Schema>;
export type LocalDurabilityAcknowledgementV1 = z.infer<
  typeof localDurabilityAcknowledgementV1Schema
>;
export type HostVisibilityV1 = z.infer<typeof hostVisibilityV1Schema>;
export type ProtocolErrorV1 = z.infer<typeof protocolErrorV1Schema>;
