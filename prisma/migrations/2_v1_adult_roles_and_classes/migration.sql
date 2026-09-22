CREATE TYPE "platform_role" AS ENUM ('platform_admin');
CREATE TYPE "organization_role" AS ENUM ('organization_admin', 'teacher');

ALTER TABLE "professional_profiles"
ADD COLUMN "platform_role" "platform_role";

ALTER TABLE "organization_memberships"
ADD COLUMN "role" "organization_role";

-- A legacy platform-wide organization management grant maps to the new
-- platform administrator role only when its membership and organization are
-- active. Capability rows remain in place for old routes.
UPDATE "professional_profiles" AS profile
SET "platform_role" = 'platform_admin'::"platform_role"
WHERE EXISTS (
  SELECT 1
  FROM "organization_memberships" AS membership
  JOIN "organizations" AS organization
    ON organization."id" = membership."organization_id"
  JOIN "capability_assignments" AS assignment
    ON assignment."membership_id" = membership."id"
  WHERE membership."professional_profile_id" = profile."id"
    AND membership."status" = 'active'::"record_status"
    AND organization."status" = 'active'::"record_status"
    AND assignment."capability" = 'organization:manage'
    AND assignment."scope_organization_id" IS NULL
);

-- Preserve existing access intent during the capability-to-role transition.
-- Memberships that already manage users or organizations become organization
-- administrators; all other legacy memberships become teachers.
UPDATE "organization_memberships" AS membership
SET "role" = CASE
  WHEN EXISTS (
    SELECT 1
    FROM "capability_assignments" AS assignment
    WHERE assignment."membership_id" = membership."id"
      AND assignment."capability" IN ('organization:manage', 'user:manage')
  ) THEN 'organization_admin'::"organization_role"
  ELSE 'teacher'::"organization_role"
END;

ALTER TABLE "organization_memberships"
ALTER COLUMN "role" SET NOT NULL;

CREATE TABLE "class_groups" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "status" "record_status" NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "class_groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "class_groups_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "teacher_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "membership_id" UUID NOT NULL,
  "class_group_id" UUID NOT NULL,
  "status" "record_status" NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "teacher_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "teacher_assignments_membership_id_fkey"
    FOREIGN KEY ("membership_id") REFERENCES "organization_memberships"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "teacher_assignments_class_group_id_fkey"
    FOREIGN KEY ("class_group_id") REFERENCES "class_groups"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "class_groups_organization_id_status_idx"
ON "class_groups"("organization_id", "status");

CREATE UNIQUE INDEX "teacher_assignments_membership_id_class_group_id_key"
ON "teacher_assignments"("membership_id", "class_group_id");

CREATE INDEX "teacher_assignments_class_group_id_status_idx"
ON "teacher_assignments"("class_group_id", "status");
