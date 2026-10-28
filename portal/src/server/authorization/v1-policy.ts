import {
  OrganizationRole,
  PlatformRole,
  RecordStatus,
} from "@/generated/prisma/enums";

export type V1TeacherAssignment = {
  classGroupId: string;
  status: RecordStatus;
};

export type V1Membership = {
  organizationId: string;
  organizationStatus: RecordStatus;
  role: OrganizationRole;
  status: RecordStatus;
  teacherAssignments: readonly V1TeacherAssignment[];
};

export type V1AuthorizationSnapshot = {
  profileStatus: RecordStatus;
  platformRole: PlatformRole | null;
  memberships: readonly V1Membership[];
};

export type V1ClassScope = {
  id: string;
  organizationId: string;
  status: RecordStatus;
};

function isActive(status: RecordStatus): boolean {
  return status === RecordStatus.ACTIVE;
}

function activeMemberships(
  actor: V1AuthorizationSnapshot,
): readonly V1Membership[] {
  if (!isActive(actor.profileStatus)) return [];
  return actor.memberships.filter(
    (membership) =>
      isActive(membership.status) && isActive(membership.organizationStatus),
  );
}

export function canManageOrganizations(
  actor: V1AuthorizationSnapshot,
): boolean {
  return (
    isActive(actor.profileStatus) &&
    actor.platformRole === PlatformRole.PLATFORM_ADMIN
  );
}

// Roles are cumulative: a platform administrator can do everything an
// organization administrator does, in every organization, and an
// organization administrator can do everything a teacher does in theirs.
export function canManageOrganizationStaff(
  actor: V1AuthorizationSnapshot,
  organizationId: string,
): boolean {
  if (canManageOrganizations(actor)) return true;
  return activeMemberships(actor).some(
    (membership) =>
      membership.organizationId === organizationId &&
      membership.role === OrganizationRole.ORGANIZATION_ADMIN,
  );
}

export const canManageClasses = canManageOrganizationStaff;

export function canAccessClass(
  actor: V1AuthorizationSnapshot,
  classGroup: V1ClassScope,
): boolean {
  if (!isActive(classGroup.status)) return false;
  if (canManageOrganizations(actor)) return true;

  return activeMemberships(actor).some((membership) => {
    if (membership.organizationId !== classGroup.organizationId) return false;
    if (membership.role === OrganizationRole.ORGANIZATION_ADMIN) return true;
    if (membership.role !== OrganizationRole.TEACHER) return false;

    return membership.teacherAssignments.some(
      (assignment) =>
        assignment.classGroupId === classGroup.id &&
        isActive(assignment.status),
    );
  });
}
