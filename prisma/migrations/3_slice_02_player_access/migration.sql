CREATE TYPE "player_credential_status" AS ENUM ('active', 'revoked');
CREATE TYPE "game_session_status" AS ENUM ('active', 'ended');

ALTER TABLE "class_groups"
ADD COLUMN "next_player_number" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "player_slots" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "class_group_id" UUID NOT NULL,
  "player_number" INTEGER NOT NULL,
  "status" "record_status" NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "player_slots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "player_slots_player_number_positive" CHECK ("player_number" > 0),
  CONSTRAINT "player_slots_class_group_id_fkey" FOREIGN KEY ("class_group_id") REFERENCES "class_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "player_credentials" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "player_slot_id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "status" "player_credential_status" NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMPTZ(3),
  CONSTRAINT "player_credentials_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "player_credentials_player_slot_id_fkey" FOREIGN KEY ("player_slot_id") REFERENCES "player_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "game_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "class_group_id" UUID NOT NULL,
  "status" "game_session_status" NOT NULL DEFAULT 'active',
  "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "game_sessions_class_group_id_fkey" FOREIGN KEY ("class_group_id") REFERENCES "class_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "participations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "game_session_id" UUID NOT NULL,
  "player_slot_id" UUID NOT NULL,
  "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "participations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "participations_game_session_id_fkey" FOREIGN KEY ("game_session_id") REFERENCES "game_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "participations_player_slot_id_fkey" FOREIGN KEY ("player_slot_id") REFERENCES "player_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "player_slots_class_group_id_player_number_key" ON "player_slots"("class_group_id", "player_number");
CREATE INDEX "player_slots_class_group_id_status_idx" ON "player_slots"("class_group_id", "status");
CREATE UNIQUE INDEX "player_credentials_token_hash_key" ON "player_credentials"("token_hash");
CREATE INDEX "player_credentials_player_slot_id_status_idx" ON "player_credentials"("player_slot_id", "status");
CREATE UNIQUE INDEX "player_credentials_one_active_per_slot" ON "player_credentials"("player_slot_id") WHERE "status" = 'active';
CREATE INDEX "game_sessions_class_group_id_status_idx" ON "game_sessions"("class_group_id", "status");
CREATE UNIQUE INDEX "game_sessions_one_active_per_class" ON "game_sessions"("class_group_id") WHERE "status" = 'active';
CREATE UNIQUE INDEX "participations_game_session_id_player_slot_id_key" ON "participations"("game_session_id", "player_slot_id");
CREATE INDEX "participations_player_slot_id_joined_at_idx" ON "participations"("player_slot_id", "joined_at");
