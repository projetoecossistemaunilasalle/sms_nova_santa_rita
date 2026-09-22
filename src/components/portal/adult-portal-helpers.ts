import {
  OrganizationRole,
  PlatformRole,
  RecordStatus,
} from "@/generated/prisma/enums";
import type { DemoAdultPortalState } from "@/runtime/adult-portal-demo-store";
import type {
  AdultRole,
  ClassDetailDto,
  ClassSummaryDto,
  OrganizationSummaryDto,
  TeamMemberDto,
} from "@/application/adult-portal/types";

export function recordStatusLabel(status: RecordStatus): "Ativa" | "Inativa" {
  return status === RecordStatus.ACTIVE ? "Ativa" : "Inativa";
}

export function roleLabel(role: OrganizationRole): string {
  return role === OrganizationRole.ORGANIZATION_ADMIN
    ? "Administrador da organização"
    : "Professor";
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function demoRole(state: DemoAdultPortalState): AdultRole {
  const profile = state.profiles.find(
    (item) => item.id === state.activeProfileId,
  );
  if (profile?.platformRole === PlatformRole.PLATFORM_ADMIN)
    return "platform_admin";
  const hasAdminMembership = state.memberships.some(
    (membership) =>
      membership.profileId === state.activeProfileId &&
      membership.status === RecordStatus.ACTIVE &&
      membership.role === OrganizationRole.ORGANIZATION_ADMIN &&
      state.organizations.some(
        (organization) =>
          organization.id === membership.organizationId &&
          organization.status === RecordStatus.ACTIVE,
      ),
  );
  return hasAdminMembership ? "organization_admin" : "teacher";
}

export function demoAccessibleOrganizationIds(
  state: DemoAdultPortalState,
): string[] {
  if (demoRole(state) === "platform_admin") {
    return state.organizations.map((organization) => organization.id);
  }
  const activeOrganizationIds = new Set(
    state.organizations
      .filter((organization) => organization.status === RecordStatus.ACTIVE)
      .map((organization) => organization.id),
  );
  return state.memberships
    .filter(
      (membership) =>
        membership.profileId === state.activeProfileId &&
        membership.status === RecordStatus.ACTIVE &&
        activeOrganizationIds.has(membership.organizationId),
    )
    .map((membership) => membership.organizationId);
}

export function demoOrganizations(
  state: DemoAdultPortalState,
): OrganizationSummaryDto[] {
  const role = demoRole(state);
  if (role === "teacher") return [];
  const ids = demoAccessibleOrganizationIds(state);
  return state.organizations
    .filter((organization) => ids.includes(organization.id))
    .map((organization) => ({
      ...organization,
      memberCount: state.memberships.filter(
        (membership) => membership.organizationId === organization.id,
      ).length,
      classCount: state.classes.filter(
        (classGroup) => classGroup.organizationId === organization.id,
      ).length,
    }));
}

export function demoTeam(state: DemoAdultPortalState): TeamMemberDto[] {
  const role = demoRole(state);
  if (role === "teacher") return [];
  const ids = demoAccessibleOrganizationIds(state);
  return state.memberships
    .filter((membership) => ids.includes(membership.organizationId))
    .map((membership) => ({
      id: membership.id,
      profileId: membership.profileId,
      displayName:
        state.profiles.find((profile) => profile.id === membership.profileId)
          ?.displayName ?? "Perfil provisionado",
      organizationId: membership.organizationId,
      organizationName:
        state.organizations.find(
          (organization) => organization.id === membership.organizationId,
        )?.name ?? "Organização",
      role: membership.role,
      status: membership.status,
    }));
}

export function demoClasses(state: DemoAdultPortalState): ClassSummaryDto[] {
  const role = demoRole(state);
  if (role === "platform_admin") return [];
  const activeOrganizationIds = new Set(
    state.organizations
      .filter((organization) => organization.status === RecordStatus.ACTIVE)
      .map((organization) => organization.id),
  );
  const memberships = state.memberships.filter(
    (membership) =>
      membership.profileId === state.activeProfileId &&
      membership.status === RecordStatus.ACTIVE &&
      activeOrganizationIds.has(membership.organizationId),
  );
  const adminOrganizationIds = memberships
    .filter(
      (membership) => membership.role === OrganizationRole.ORGANIZATION_ADMIN,
    )
    .map((membership) => membership.organizationId);
  const teacherMembershipIds = memberships
    .filter((membership) => membership.role === OrganizationRole.TEACHER)
    .map((membership) => membership.id);
  const assignedClassIds = state.assignments
    .filter(
      (assignment) =>
        teacherMembershipIds.includes(assignment.membershipId) &&
        assignment.status === RecordStatus.ACTIVE,
    )
    .map((assignment) => assignment.classGroupId);
  return state.classes
    .filter(
      (classGroup) =>
        adminOrganizationIds.includes(classGroup.organizationId) ||
        (classGroup.status === RecordStatus.ACTIVE &&
          assignedClassIds.includes(classGroup.id)),
    )
    .map((classGroup) => ({
      ...classGroup,
      organizationName:
        state.organizations.find(
          (organization) => organization.id === classGroup.organizationId,
        )?.name ?? "Organização",
      teacherCount: state.assignments.filter(
        (assignment) =>
          assignment.classGroupId === classGroup.id &&
          assignment.status === RecordStatus.ACTIVE,
      ).length,
    }));
}

export function demoClassDetail(
  state: DemoAdultPortalState,
  classGroupId: string,
): ClassDetailDto | null {
  const summary = demoClasses(state).find((item) => item.id === classGroupId);
  if (!summary) return null;
  const members = demoTeamForOrganization(state, summary.organizationId).filter(
    (member) =>
      member.role === OrganizationRole.TEACHER &&
      member.status === RecordStatus.ACTIVE,
  );
  return {
    ...summary,
    canManage: demoRole(state) === "organization_admin",
    availableTeachers: members,
    teachers: state.assignments
      .filter((assignment) => assignment.classGroupId === classGroupId)
      .map((assignment) => {
        const member = members.find(
          (item) => item.id === assignment.membershipId,
        );
        return {
          id: assignment.id,
          membershipId: assignment.membershipId,
          displayName: member?.displayName ?? "Professor",
          status: assignment.status,
        };
      }),
  };
}

export function demoTeamForOrganization(
  state: DemoAdultPortalState,
  organizationId: string,
): TeamMemberDto[] {
  return state.memberships
    .filter((membership) => membership.organizationId === organizationId)
    .map((membership) => ({
      id: membership.id,
      profileId: membership.profileId,
      displayName:
        state.profiles.find((profile) => profile.id === membership.profileId)
          ?.displayName ?? "Perfil provisionado",
      organizationId,
      organizationName:
        state.organizations.find(
          (organization) => organization.id === organizationId,
        )?.name ?? "Organização",
      role: membership.role,
      status: membership.status,
    }));
}
