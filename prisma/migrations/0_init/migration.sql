-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "record_status" AS ENUM ('active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "platform_role" AS ENUM ('platform_admin');

-- CreateEnum
CREATE TYPE "organization_role" AS ENUM ('organization_admin', 'teacher');

-- CreateEnum
CREATE TYPE "player_credential_status" AS ENUM ('active', 'revoked');

-- CreateEnum
CREATE TYPE "game_session_status" AS ENUM ('active', 'ended');

-- CreateTable
CREATE TABLE "professional_profiles" (
    "id" UUID NOT NULL,
    "auth_user_id" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(160) NOT NULL,
    "platform_role" "platform_role",
    "status" "record_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "professional_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" VARCHAR(80) NOT NULL,
    "status" "record_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_memberships" (
    "id" UUID NOT NULL,
    "professional_profile_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "role" "organization_role" NOT NULL,
    "status" "record_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_groups" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "status" "record_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "next_player_number" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "class_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_slots" (
    "id" UUID NOT NULL,
    "class_group_id" UUID NOT NULL,
    "player_number" INTEGER NOT NULL,
    "status" "record_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "player_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_credentials" (
    "id" UUID NOT NULL,
    "player_slot_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "status" "player_credential_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "player_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_sessions" (
    "id" UUID NOT NULL,
    "class_group_id" UUID NOT NULL,
    "status" "game_session_status" NOT NULL DEFAULT 'active',
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participations" (
    "id" UUID NOT NULL,
    "game_session_id" UUID NOT NULL,
    "player_slot_id" UUID NOT NULL,
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_states" (
    "player_slot_id" UUID NOT NULL,
    "protocol_version" INTEGER NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "content_version" VARCHAR(200) NOT NULL,
    "payload" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "game_states_pkey" PRIMARY KEY ("player_slot_id")
);

-- CreateTable
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

    CONSTRAINT "result_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_time_events" (
    "id" UUID NOT NULL,
    "participation_id" UUID NOT NULL,
    "client_event_id" VARCHAR(200) NOT NULL,
    "request_id" VARCHAR(200) NOT NULL,
    "active_ms" INTEGER NOT NULL,
    "mode" VARCHAR(20) NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "active_time_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_assignments" (
    "id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "class_group_id" UUID NOT NULL,
    "status" "record_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "teacher_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "professional_profiles_auth_user_id_key" ON "professional_profiles"("auth_user_id");

-- CreateIndex
CREATE INDEX "organizations_status_idx" ON "organizations"("status");

-- CreateIndex
CREATE INDEX "organization_memberships_organization_id_status_idx" ON "organization_memberships"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "organization_memberships_professional_profile_id_organizati_key" ON "organization_memberships"("professional_profile_id", "organization_id");

-- CreateIndex
CREATE INDEX "class_groups_organization_id_status_idx" ON "class_groups"("organization_id", "status");

-- CreateIndex
CREATE INDEX "player_slots_class_group_id_status_idx" ON "player_slots"("class_group_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "player_slots_class_group_id_player_number_key" ON "player_slots"("class_group_id", "player_number");

-- CreateIndex
CREATE UNIQUE INDEX "player_credentials_token_hash_key" ON "player_credentials"("token_hash");

-- CreateIndex
CREATE INDEX "player_credentials_player_slot_id_status_idx" ON "player_credentials"("player_slot_id", "status");

-- CreateIndex
CREATE INDEX "game_sessions_class_group_id_status_idx" ON "game_sessions"("class_group_id", "status");

-- CreateIndex
CREATE INDEX "participations_player_slot_id_joined_at_idx" ON "participations"("player_slot_id", "joined_at");

-- CreateIndex
CREATE UNIQUE INDEX "participations_game_session_id_player_slot_id_key" ON "participations"("game_session_id", "player_slot_id");

-- CreateIndex
CREATE UNIQUE INDEX "result_events_client_event_id_key" ON "result_events"("client_event_id");

-- CreateIndex
CREATE INDEX "result_events_participation_id_received_at_idx" ON "result_events"("participation_id", "received_at");

-- CreateIndex
CREATE INDEX "result_events_activity_id_received_at_idx" ON "result_events"("activity_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "active_time_events_client_event_id_key" ON "active_time_events"("client_event_id");

-- CreateIndex
CREATE INDEX "active_time_events_participation_id_received_at_idx" ON "active_time_events"("participation_id", "received_at");

-- CreateIndex
CREATE INDEX "teacher_assignments_class_group_id_status_idx" ON "teacher_assignments"("class_group_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_assignments_membership_id_class_group_id_key" ON "teacher_assignments"("membership_id", "class_group_id");

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_professional_profile_id_fkey" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_groups" ADD CONSTRAINT "class_groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_slots" ADD CONSTRAINT "player_slots_class_group_id_fkey" FOREIGN KEY ("class_group_id") REFERENCES "class_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_credentials" ADD CONSTRAINT "player_credentials_player_slot_id_fkey" FOREIGN KEY ("player_slot_id") REFERENCES "player_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_class_group_id_fkey" FOREIGN KEY ("class_group_id") REFERENCES "class_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participations" ADD CONSTRAINT "participations_game_session_id_fkey" FOREIGN KEY ("game_session_id") REFERENCES "game_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participations" ADD CONSTRAINT "participations_player_slot_id_fkey" FOREIGN KEY ("player_slot_id") REFERENCES "player_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_states" ADD CONSTRAINT "game_states_player_slot_id_fkey" FOREIGN KEY ("player_slot_id") REFERENCES "player_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_events" ADD CONSTRAINT "result_events_participation_id_fkey" FOREIGN KEY ("participation_id") REFERENCES "participations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_time_events" ADD CONSTRAINT "active_time_events_participation_id_fkey" FOREIGN KEY ("participation_id") REFERENCES "participations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "organization_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_class_group_id_fkey" FOREIGN KEY ("class_group_id") REFERENCES "class_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- The following ten database rules cannot be expressed in the Prisma schema
-- language and are appended by hand. They preserve the product's data
-- integrity rules: positive player numbers, game-state revision/protocol/
-- schema invariants, result duration/state domains, active-time duration/mode
-- domains, one active credential per player slot, and one active session per
-- class group.
ALTER TABLE "player_slots" ADD CONSTRAINT "player_slots_player_number_positive" CHECK ("player_number" > 0);
ALTER TABLE "game_states" ADD CONSTRAINT "game_states_revision_check" CHECK ("revision" > 0);
ALTER TABLE "game_states" ADD CONSTRAINT "game_states_protocol_version_check" CHECK ("protocol_version" = 1);
ALTER TABLE "game_states" ADD CONSTRAINT "game_states_schema_version_check" CHECK ("schema_version" = 1);
ALTER TABLE "result_events" ADD CONSTRAINT "result_events_duration_ms_check" CHECK ("duration_ms" >= 0);
ALTER TABLE "result_events" ADD CONSTRAINT "result_events_result_state_check"
  CHECK ("result_state" IN ('sucesso', 'falha', 'cancelado', 'tempo_esgotado', 'erro_inicializacao'));
ALTER TABLE "active_time_events" ADD CONSTRAINT "active_time_events_active_ms_check"
  CHECK ("active_ms" BETWEEN 1 AND 30000);
ALTER TABLE "active_time_events" ADD CONSTRAINT "active_time_events_mode_check"
  CHECK ("mode" IN ('exploration', 'dialogue', 'activity'));
CREATE UNIQUE INDEX "player_credentials_one_active_per_slot" ON "player_credentials"("player_slot_id") WHERE "status" = 'active';
CREATE UNIQUE INDEX "game_sessions_one_active_per_class" ON "game_sessions"("class_group_id") WHERE "status" = 'active';
