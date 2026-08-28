-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "record_status" AS ENUM ('active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "capability" AS ENUM ('link:view', 'link:manage', 'results:view_organization', 'organization:manage', 'user:manage', 'audit:view');

-- CreateTable
CREATE TABLE "professional_profiles" (
    "id" UUID NOT NULL,
    "auth_user_id" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(160) NOT NULL,
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
    "status" "record_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capability_assignments" (
    "id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "capability" "capability" NOT NULL,
    "scope_organization_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capability_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_links" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "audience" VARCHAR(200) NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "access_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(120) NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" UUID NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" VARCHAR(500),
    "correlation_id" VARCHAR(64) NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "bucket_key" CHAR(64) NOT NULL,
    "scope" VARCHAR(80) NOT NULL,
    "window_started_at" TIMESTAMPTZ(3) NOT NULL,
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("bucket_key")
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
CREATE INDEX "capability_assignments_scope_organization_id_capability_idx" ON "capability_assignments"("scope_organization_id", "capability");

-- CreateIndex
CREATE UNIQUE INDEX "access_links_token_hash_key" ON "access_links"("token_hash");

-- CreateIndex
CREATE INDEX "access_links_organization_id_revoked_at_idx" ON "access_links"("organization_id", "revoked_at");

-- CreateIndex
CREATE INDEX "access_links_expires_at_idx" ON "access_links"("expires_at");

-- CreateIndex
CREATE INDEX "audit_events_entity_type_entity_id_occurred_at_idx" ON "audit_events"("entity_type", "entity_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_actor_id_occurred_at_idx" ON "audit_events"("actor_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_occurred_at_idx" ON "audit_events"("occurred_at");

-- CreateIndex
CREATE INDEX "rate_limit_buckets_expires_at_idx" ON "rate_limit_buckets"("expires_at");

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_professional_profile_id_fkey" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_assignments" ADD CONSTRAINT "capability_assignments_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "organization_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_assignments" ADD CONSTRAINT "capability_assignments_scope_organization_id_fkey" FOREIGN KEY ("scope_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_links" ADD CONSTRAINT "access_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_links" ADD CONSTRAINT "access_links_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex (raw): one grant per (membership, capability, scope); NULL scope
-- (platform-wide) must collide with another NULL scope for the same grant.
CREATE UNIQUE INDEX "capability_assignments_membership_capability_scope_key" ON "capability_assignments"("membership_id", "capability", "scope_organization_id") NULLS NOT DISTINCT;

-- CreateCheck (raw): token_hash is a 64-character lowercase hex SHA-256 digest.
ALTER TABLE "access_links" ADD CONSTRAINT "access_links_token_hash_format_check" CHECK (token_hash ~ '^[0-9a-f]{64}$');

-- CreateCheck (raw): expiry, when set, must lie strictly after creation.
ALTER TABLE "access_links" ADD CONSTRAINT "access_links_expires_at_after_created_at_check" CHECK (expires_at IS NULL OR expires_at > created_at);

-- CreateCheck (raw): revocation, when set, must not predate creation.
ALTER TABLE "access_links" ADD CONSTRAINT "access_links_revoked_at_not_before_created_at_check" CHECK (revoked_at IS NULL OR revoked_at >= created_at);

-- CreateCheck (raw): counters never go negative.
ALTER TABLE "rate_limit_buckets" ADD CONSTRAINT "rate_limit_buckets_request_count_nonnegative_check" CHECK (request_count >= 0);

-- CreateCheck (raw): a window always expires after it starts.
ALTER TABLE "rate_limit_buckets" ADD CONSTRAINT "rate_limit_buckets_expires_at_after_window_start_check" CHECK (expires_at > window_started_at);
