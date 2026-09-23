CREATE TABLE "result_events" (
  "id" UUID NOT NULL,
  "participation_id" UUID NOT NULL,
  "client_event_id" VARCHAR(200) NOT NULL,
  "request_id" VARCHAR(200) NOT NULL,
  "activity_id" VARCHAR(100) NOT NULL,
  "mission_id" VARCHAR(100) NOT NULL,
  "attempt_id" VARCHAR(200) NOT NULL,
  "result_state" VARCHAR(32) NOT NULL,
  "duration_ms" BIGINT NOT NULL,
  "metrics" JSONB NOT NULL,
  "payload" JSONB NOT NULL,
  "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "result_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "result_events_participation_id_fkey"
    FOREIGN KEY ("participation_id") REFERENCES "participations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "result_events_duration_ms_check" CHECK ("duration_ms" >= 0),
  CONSTRAINT "result_events_result_state_check"
    CHECK ("result_state" IN ('sucesso', 'falha', 'cancelado', 'tempo_esgotado', 'erro_inicializacao'))
);

CREATE UNIQUE INDEX "result_events_client_event_id_key"
  ON "result_events"("client_event_id");
CREATE INDEX "result_events_participation_id_received_at_idx"
  ON "result_events"("participation_id", "received_at");
CREATE INDEX "result_events_activity_id_received_at_idx"
  ON "result_events"("activity_id", "received_at");

CREATE TABLE "active_time_events" (
  "id" UUID NOT NULL,
  "participation_id" UUID NOT NULL,
  "client_event_id" VARCHAR(200) NOT NULL,
  "request_id" VARCHAR(200) NOT NULL,
  "active_ms" INTEGER NOT NULL,
  "mode" VARCHAR(20) NOT NULL,
  "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "active_time_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "active_time_events_participation_id_fkey"
    FOREIGN KEY ("participation_id") REFERENCES "participations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "active_time_events_active_ms_check"
    CHECK ("active_ms" BETWEEN 1 AND 30000),
  CONSTRAINT "active_time_events_mode_check"
    CHECK ("mode" IN ('exploration', 'dialogue', 'activity'))
);

CREATE UNIQUE INDEX "active_time_events_client_event_id_key"
  ON "active_time_events"("client_event_id");
CREATE INDEX "active_time_events_participation_id_received_at_idx"
  ON "active_time_events"("participation_id", "received_at");
