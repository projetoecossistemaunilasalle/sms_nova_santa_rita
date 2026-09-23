CREATE TABLE "game_states" (
  "player_slot_id" UUID NOT NULL,
  "protocol_version" INTEGER NOT NULL,
  "schema_version" INTEGER NOT NULL,
  "content_version" VARCHAR(200) NOT NULL,
  "payload" JSONB NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "game_states_pkey" PRIMARY KEY ("player_slot_id"),
  CONSTRAINT "game_states_player_slot_id_fkey" FOREIGN KEY ("player_slot_id") REFERENCES "player_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "game_states_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "game_states_protocol_version_check" CHECK ("protocol_version" = 1),
  CONSTRAINT "game_states_schema_version_check" CHECK ("schema_version" = 1)
);
