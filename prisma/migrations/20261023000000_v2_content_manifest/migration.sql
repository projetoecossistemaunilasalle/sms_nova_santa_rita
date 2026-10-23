-- AlterTable
ALTER TABLE "class_groups" ADD COLUMN     "default_content_selection" JSONB;

-- AlterTable
ALTER TABLE "game_sessions" ADD COLUMN     "content_manifest_id" UUID NOT NULL,
ADD COLUMN     "content_policy" JSONB NOT NULL,
ADD COLUMN     "started_by_id" UUID;

-- AlterTable
ALTER TABLE "result_events" ADD COLUMN     "module_id" VARCHAR(64),
ADD COLUMN     "preset_id" VARCHAR(64);

-- AlterTable
ALTER TABLE "active_time_events" ADD COLUMN     "mission_id" VARCHAR(100),
ADD COLUMN     "module_id" VARCHAR(64);

-- CreateTable
CREATE TABLE "game_content_manifests" (
    "id" UUID NOT NULL,
    "content_version" VARCHAR(200) NOT NULL,
    "build_id" VARCHAR(100) NOT NULL,
    "source_commit" VARCHAR(64),
    "manifest_hash" CHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "imported_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imported_by_id" UUID,
    "is_current" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "game_content_manifests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_content_manifests_build_id_key" ON "game_content_manifests"("build_id");

-- At most one manifest is current; zero is valid before activation.
CREATE UNIQUE INDEX "game_content_manifests_single_current_key"
ON "game_content_manifests" ("is_current") WHERE "is_current" = true;

-- CreateIndex
CREATE INDEX "game_content_manifests_content_version_idx" ON "game_content_manifests"("content_version");

-- CreateIndex
CREATE INDEX "game_sessions_content_manifest_id_idx" ON "game_sessions"("content_manifest_id");

-- CreateIndex
CREATE INDEX "result_events_module_id_received_at_idx" ON "result_events"("module_id", "received_at");

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_content_manifest_id_fkey" FOREIGN KEY ("content_manifest_id") REFERENCES "game_content_manifests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- V2 game state: protocol 2 with V3 snapshots (no V1 rows exist; no retrocompat).
ALTER TABLE "game_states" DROP CONSTRAINT "game_states_protocol_version_check";
ALTER TABLE "game_states" ADD CONSTRAINT "game_states_protocol_version_check" CHECK ("protocol_version" = 2);
ALTER TABLE "game_states" DROP CONSTRAINT "game_states_schema_version_check";
ALTER TABLE "game_states" ADD CONSTRAINT "game_states_schema_version_check" CHECK ("schema_version" = 3);
