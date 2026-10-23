import { describe, expect, it } from "vitest";

import {
  OrganizationRole,
  PlatformRole,
  RecordStatus,
} from "@/generated/prisma/enums";
import {
  canAccessClass,
  canManageClasses,
  canManageOrganizations,
  canManageOrganizationStaff,
  type V1AuthorizationSnapshot,
} from "@/server/authorization/v1-policy";

const organizationId = "organization-a";
const assignedClass = {
  id: "class-a",
  organizationId,
  status: RecordStatus.ACTIVE,
};

function actor(
  overrides: Partial<V1AuthorizationSnapshot> = {},
): V1AuthorizationSnapshot {
  return {
    profileStatus: RecordStatus.ACTIVE,
    platformRole: null,
    memberships: [],
    ...overrides,
  };
}

describe("V1 adult authorization", () => {
  it("limits organization management to an active platform administrator", () => {
    expect(
      canManageOrganizations(
        actor({ platformRole: PlatformRole.PLATFORM_ADMIN }),
      ),
    ).toBe(true);
    expect(canManageOrganizations(actor())).toBe(false);
    expect(
      canManageOrganizations(
        actor({
          platformRole: PlatformRole.PLATFORM_ADMIN,
          profileStatus: RecordStatus.INACTIVE,
        }),
      ),
    ).toBe(false);
  });

  it("lets an active organization admin manage classes and staff only in their organization", () => {
    const admin = actor({
      memberships: [
        {
          organizationId,
          organizationStatus: RecordStatus.ACTIVE,
          role: OrganizationRole.ORGANIZATION_ADMIN,
          status: RecordStatus.ACTIVE,
          teacherAssignments: [],
        },
      ],
    });

    expect(canManageClasses(admin, organizationId)).toBe(true);
    expect(canManageOrganizationStaff(admin, organizationId)).toBe(true);
    expect(canManageClasses(admin, "organization-b")).toBe(false);
  });

  it("scopes a teacher to active assignments and active classes", () => {
    const teacher = actor({
      memberships: [
        {
          organizationId,
          organizationStatus: RecordStatus.ACTIVE,
          role: OrganizationRole.TEACHER,
          status: RecordStatus.ACTIVE,
          teacherAssignments: [
            { classGroupId: assignedClass.id, status: RecordStatus.ACTIVE },
            {
              classGroupId: "class-inactive-assignment",
              status: RecordStatus.INACTIVE,
            },
          ],
        },
      ],
    });

    expect(canAccessClass(teacher, assignedClass)).toBe(true);
    expect(
      canAccessClass(teacher, { ...assignedClass, id: "class-unassigned" }),
    ).toBe(false);
    expect(
      canAccessClass(teacher, {
        ...assignedClass,
        status: RecordStatus.INACTIVE,
      }),
    ).toBe(false);
    expect(
      canAccessClass(teacher, {
        ...assignedClass,
        id: "class-inactive-assignment",
      }),
    ).toBe(false);
  });

  it("denies inactive memberships and organizations", () => {
    const teacher = actor({
      memberships: [
        {
          organizationId,
          organizationStatus: RecordStatus.INACTIVE,
          role: OrganizationRole.TEACHER,
          status: RecordStatus.ACTIVE,
          teacherAssignments: [
            { classGroupId: assignedClass.id, status: RecordStatus.ACTIVE },
          ],
        },
      ],
    });

    expect(canAccessClass(teacher, assignedClass)).toBe(false);
  });
});
