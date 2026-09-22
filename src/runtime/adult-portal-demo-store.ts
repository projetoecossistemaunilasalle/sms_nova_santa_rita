import {
  OrganizationRole,
  PlatformRole,
  RecordStatus,
} from "@/generated/prisma/enums";
import type {
  AdultPortalStore,
  AdultPortalTransaction,
  NewClass,
  NewMembership,
  NewOrganization,
} from "@/application/adult-portal/ports";
import type {
  ActorSnapshot,
  ClassDetailDto,
  ClassSummaryDto,
  OrganizationSummaryDto,
  ProfessionalOptionDto,
  TeamMemberDto,
} from "@/application/adult-portal/types";

export const DEMO_PROFILE_IDS = {
  PLATFORM_ADMIN: "demo-profile-platform-admin",
  ORGANIZATION_ADMIN: "demo-profile-organization-admin",
  TEACHER: "demo-profile-teacher",
  SECOND_TEACHER: "demo-profile-second-teacher",
} as const;

export const DEMO_ORGANIZATION_IDS = {
  VICTOR_AGGENS: "0b0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a",
  CAMPOS_VERDES: "1b1b1b1b-1b1b-4b1b-9b1b-1b1b1b1b1b1b",
} as const;

export const DEMO_CLASS_IDS = {
  THIRD_A: "demo-turma-3a",
  FIFTH_B: "demo-turma-5b",
  FOURTH_A: "demo-turma-4a-campos",
} as const;

type DemoProfile = ProfessionalOptionDto & {
  platformRole: PlatformRole | null;
};

type DemoOrganization = {
  id: string;
  name: string;
  type: string;
  status: RecordStatus;
};

type DemoMembership = {
  id: string;
  profileId: string;
  organizationId: string;
  role: OrganizationRole;
  status: RecordStatus;
};

type DemoClass = {
  id: string;
  organizationId: string;
  name: string;
  status: RecordStatus;
};

type DemoAssignment = {
  id: string;
  membershipId: string;
  classGroupId: string;
  status: RecordStatus;
};

export type DemoAdultPortalState = {
  version: 1;
  activeProfileId: string;
  profiles: DemoProfile[];
  organizations: DemoOrganization[];
  memberships: DemoMembership[];
  classes: DemoClass[];
  assignments: DemoAssignment[];
};

export const DEMO_ADULT_PORTAL_STORAGE_KEY =
  "missoes-caramelito:adult-portal:v1";

export const demoAdultPortalSeed: DemoAdultPortalState = {
  version: 1,
  activeProfileId: DEMO_PROFILE_IDS.PLATFORM_ADMIN,
  profiles: [
    {
      id: DEMO_PROFILE_IDS.PLATFORM_ADMIN,
      displayName: "Adriana Martins",
      status: RecordStatus.ACTIVE,
      platformRole: PlatformRole.PLATFORM_ADMIN,
    },
    {
      id: DEMO_PROFILE_IDS.ORGANIZATION_ADMIN,
      displayName: "Lucas Ribeiro",
      status: RecordStatus.ACTIVE,
      platformRole: null,
    },
    {
      id: DEMO_PROFILE_IDS.TEACHER,
      displayName: "Carla Freitas",
      status: RecordStatus.ACTIVE,
      platformRole: null,
    },
    {
      id: DEMO_PROFILE_IDS.SECOND_TEACHER,
      displayName: "Rafael Souza",
      status: RecordStatus.ACTIVE,
      platformRole: null,
    },
  ],
  organizations: [
    {
      id: DEMO_ORGANIZATION_IDS.VICTOR_AGGENS,
      name: "EMEF Victor Aggens",
      type: "Escola municipal",
      status: RecordStatus.ACTIVE,
    },
    {
      id: DEMO_ORGANIZATION_IDS.CAMPOS_VERDES,
      name: "EMEF Campos Verdes",
      type: "Escola municipal",
      status: RecordStatus.ACTIVE,
    },
  ],
  memberships: [
    {
      id: "demo-membership-admin",
      profileId: DEMO_PROFILE_IDS.ORGANIZATION_ADMIN,
      organizationId: DEMO_ORGANIZATION_IDS.VICTOR_AGGENS,
      role: OrganizationRole.ORGANIZATION_ADMIN,
      status: RecordStatus.ACTIVE,
    },
    {
      id: "demo-membership-teacher",
      profileId: DEMO_PROFILE_IDS.TEACHER,
      organizationId: DEMO_ORGANIZATION_IDS.VICTOR_AGGENS,
      role: OrganizationRole.TEACHER,
      status: RecordStatus.ACTIVE,
    },
    {
      id: "demo-membership-second-teacher",
      profileId: DEMO_PROFILE_IDS.SECOND_TEACHER,
      organizationId: DEMO_ORGANIZATION_IDS.CAMPOS_VERDES,
      role: OrganizationRole.TEACHER,
      status: RecordStatus.ACTIVE,
    },
  ],
  classes: [
    {
      id: DEMO_CLASS_IDS.THIRD_A,
      organizationId: DEMO_ORGANIZATION_IDS.VICTOR_AGGENS,
      name: "3º A",
      status: RecordStatus.ACTIVE,
    },
    {
      id: DEMO_CLASS_IDS.FIFTH_B,
      organizationId: DEMO_ORGANIZATION_IDS.VICTOR_AGGENS,
      name: "5º B",
      status: RecordStatus.ACTIVE,
    },
    {
      id: DEMO_CLASS_IDS.FOURTH_A,
      organizationId: DEMO_ORGANIZATION_IDS.CAMPOS_VERDES,
      name: "4º A",
      status: RecordStatus.ACTIVE,
    },
  ],
  assignments: [
    {
      id: "demo-assignment-teacher-third-a",
      membershipId: "demo-membership-teacher",
      classGroupId: DEMO_CLASS_IDS.THIRD_A,
      status: RecordStatus.ACTIVE,
    },
    {
      id: "demo-assignment-second-teacher-fourth-a",
      membershipId: "demo-membership-second-teacher",
      classGroupId: DEMO_CLASS_IDS.FOURTH_A,
      status: RecordStatus.ACTIVE,
    },
  ],
};

function cloneSeed(): DemoAdultPortalState {
  return structuredClone(demoAdultPortalSeed);
}

function demoId(kind: string): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `demo-${kind}-${suffix}`;
}

export function readDemoAdultPortalState(): DemoAdultPortalState {
  if (typeof window === "undefined") return cloneSeed();
  const stored = window.localStorage.getItem(DEMO_ADULT_PORTAL_STORAGE_KEY);
  if (!stored) return cloneSeed();
  try {
    const value = JSON.parse(stored) as DemoAdultPortalState;
    return value.version === 1 ? value : cloneSeed();
  } catch {
    return cloneSeed();
  }
}

export function writeDemoAdultPortalState(state: DemoAdultPortalState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    DEMO_ADULT_PORTAL_STORAGE_KEY,
    JSON.stringify(state),
  );
  window.dispatchEvent(new CustomEvent("adult-portal-demo-change"));
}

export function resetDemoAdultPortalState(): DemoAdultPortalState {
  const state = cloneSeed();
  writeDemoAdultPortalState(state);
  return state;
}

export function setDemoActiveProfile(profileId: string): DemoAdultPortalState {
  const state = readDemoAdultPortalState();
  if (
    state.profiles.some(
      (profile) =>
        profile.id === profileId && profile.status === RecordStatus.ACTIVE,
    )
  ) {
    state.activeProfileId = profileId;
    writeDemoAdultPortalState(state);
  }
  return state;
}

export class DemoAdultPortalStore
  implements AdultPortalStore, AdultPortalTransaction
{
  constructor(readonly state: DemoAdultPortalState = cloneSeed()) {}

  transaction<T>(
    work: (transaction: AdultPortalTransaction) => Promise<T>,
  ): Promise<T> {
    return work(this);
  }

  async getActor(profileId: string): Promise<ActorSnapshot | null> {
    const profile = this.state.profiles.find((item) => item.id === profileId);
    if (!profile) return null;
    return {
      profileId: profile.id,
      displayName: profile.displayName,
      profileStatus: profile.status,
      platformRole: profile.platformRole,
      memberships: this.state.memberships
        .filter((membership) => membership.profileId === profileId)
        .map((membership) => {
          const organization = this.state.organizations.find(
            (item) => item.id === membership.organizationId,
          )!;
          return {
            id: membership.id,
            organizationId: membership.organizationId,
            organizationName: organization.name,
            organizationStatus: organization.status,
            role: membership.role,
            status: membership.status,
            teacherAssignments: this.state.assignments
              .filter((assignment) => assignment.membershipId === membership.id)
              .map((assignment) => ({ ...assignment })),
          };
        }),
    };
  }

  async listOrganizations(): Promise<OrganizationSummaryDto[]> {
    return this.state.organizations
      .map((organization) => this.organizationDto(organization))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  async getOrganization(id: string): Promise<OrganizationSummaryDto | null> {
    const organization = this.state.organizations.find(
      (item) => item.id === id,
    );
    return organization ? this.organizationDto(organization) : null;
  }

  async listMemberships(organizationIds?: string[]): Promise<TeamMemberDto[]> {
    return this.state.memberships
      .filter(
        (membership) =>
          !organizationIds ||
          organizationIds.includes(membership.organizationId),
      )
      .map((membership) => this.membershipDto(membership))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR"));
  }

  async getMembership(id: string): Promise<TeamMemberDto | null> {
    const membership = this.state.memberships.find((item) => item.id === id);
    return membership ? this.membershipDto(membership) : null;
  }

  async findMembership(profileId: string, organizationId: string) {
    const membership = this.state.memberships.find(
      (item) =>
        item.profileId === profileId && item.organizationId === organizationId,
    );
    return membership ? this.membershipDto(membership) : null;
  }

  async listProfessionalProfiles(): Promise<ProfessionalOptionDto[]> {
    return this.state.profiles.map(({ id, displayName, status }) => ({
      id,
      displayName,
      status,
    }));
  }

  async getProfessionalProfile(
    id: string,
  ): Promise<ProfessionalOptionDto | null> {
    const profile = this.state.profiles.find((item) => item.id === id);
    return profile
      ? {
          id: profile.id,
          displayName: profile.displayName,
          status: profile.status,
        }
      : null;
  }

  async listClasses(organizationIds?: string[]): Promise<ClassSummaryDto[]> {
    return this.state.classes
      .filter(
        (classGroup) =>
          !organizationIds ||
          organizationIds.includes(classGroup.organizationId),
      )
      .map((classGroup) => this.classDto(classGroup))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  async getClass(id: string): Promise<ClassDetailDto | null> {
    const classGroup = this.state.classes.find((item) => item.id === id);
    if (!classGroup) return null;
    const teachers = this.state.assignments
      .filter((assignment) => assignment.classGroupId === id)
      .map((assignment) => {
        const membership = this.state.memberships.find(
          (item) => item.id === assignment.membershipId,
        )!;
        const profile = this.state.profiles.find(
          (item) => item.id === membership.profileId,
        )!;
        return {
          id: assignment.id,
          membershipId: membership.id,
          displayName: profile.displayName,
          status: assignment.status,
        };
      });
    const availableTeachers = this.state.memberships
      .filter(
        (membership) =>
          membership.organizationId === classGroup.organizationId &&
          membership.role === OrganizationRole.TEACHER &&
          membership.status === RecordStatus.ACTIVE &&
          this.state.profiles.some(
            (profile) =>
              profile.id === membership.profileId &&
              profile.status === RecordStatus.ACTIVE,
          ),
      )
      .map((membership) => this.membershipDto(membership));
    return {
      ...this.classDto(classGroup),
      teachers,
      availableTeachers,
      canManage: false,
    };
  }

  async getAssignment(id: string) {
    const assignment = this.state.assignments.find((item) => item.id === id);
    if (!assignment) return null;
    const membership = this.state.memberships.find(
      (item) => item.id === assignment.membershipId,
    )!;
    const profile = this.state.profiles.find(
      (item) => item.id === membership.profileId,
    )!;
    return {
      id: assignment.id,
      membershipId: assignment.membershipId,
      classGroupId: assignment.classGroupId,
      organizationId: membership.organizationId,
      displayName: profile.displayName,
      status: assignment.status,
      membershipRole: membership.role,
      membershipStatus: membership.status,
    };
  }

  async findAssignment(membershipId: string, classGroupId: string) {
    const assignment = this.state.assignments.find(
      (item) =>
        item.membershipId === membershipId &&
        item.classGroupId === classGroupId,
    );
    if (!assignment) return null;
    const membership = this.state.memberships.find(
      (item) => item.id === membershipId,
    )!;
    const profile = this.state.profiles.find(
      (item) => item.id === membership.profileId,
    )!;
    return {
      id: assignment.id,
      membershipId,
      displayName: profile.displayName,
      status: assignment.status,
    };
  }

  async createOrganization(input: NewOrganization) {
    const organization: DemoOrganization = {
      id: demoId("organization"),
      ...input,
      status: RecordStatus.ACTIVE,
    };
    this.state.organizations.push(organization);
    return this.organizationDto(organization);
  }

  async updateOrganizationStatus(id: string, status: RecordStatus) {
    const organization = this.state.organizations.find(
      (item) => item.id === id,
    )!;
    organization.status = status;
    return this.organizationDto(organization);
  }

  async createMembership(input: NewMembership) {
    const membership: DemoMembership = {
      id: demoId("membership"),
      ...input,
      status: RecordStatus.ACTIVE,
    };
    this.state.memberships.push(membership);
    return this.membershipDto(membership);
  }

  async updateMembership(
    id: string,
    role: OrganizationRole,
    status: RecordStatus,
  ) {
    const membership = this.state.memberships.find((item) => item.id === id)!;
    membership.role = role;
    membership.status = status;
    return this.membershipDto(membership);
  }

  async createClass(input: NewClass) {
    const classGroup: DemoClass = {
      id: demoId("class"),
      ...input,
      status: RecordStatus.ACTIVE,
    };
    this.state.classes.push(classGroup);
    return this.classDto(classGroup);
  }

  async updateClassStatus(id: string, status: RecordStatus) {
    const classGroup = this.state.classes.find((item) => item.id === id)!;
    classGroup.status = status;
    return this.classDto(classGroup);
  }

  async createAssignment(membershipId: string, classGroupId: string) {
    const assignment: DemoAssignment = {
      id: demoId("assignment"),
      membershipId,
      classGroupId,
      status: RecordStatus.ACTIVE,
    };
    this.state.assignments.push(assignment);
    const membership = this.state.memberships.find(
      (item) => item.id === membershipId,
    )!;
    const profile = this.state.profiles.find(
      (item) => item.id === membership.profileId,
    )!;
    return {
      id: assignment.id,
      membershipId,
      displayName: profile.displayName,
      status: assignment.status,
    };
  }

  async updateAssignmentStatus(id: string, status: RecordStatus) {
    const assignment = this.state.assignments.find((item) => item.id === id)!;
    assignment.status = status;
    const membership = this.state.memberships.find(
      (item) => item.id === assignment.membershipId,
    )!;
    const profile = this.state.profiles.find(
      (item) => item.id === membership.profileId,
    )!;
    return {
      id: assignment.id,
      membershipId: assignment.membershipId,
      displayName: profile.displayName,
      status,
    };
  }

  async deactivateAssignmentsForMembership(membershipId: string) {
    for (const assignment of this.state.assignments) {
      if (
        assignment.membershipId === membershipId &&
        assignment.status === RecordStatus.ACTIVE
      ) {
        assignment.status = RecordStatus.INACTIVE;
      }
    }
  }

  private organizationDto(
    organization: DemoOrganization,
  ): OrganizationSummaryDto {
    return {
      ...organization,
      memberCount: this.state.memberships.filter(
        (membership) => membership.organizationId === organization.id,
      ).length,
      classCount: this.state.classes.filter(
        (classGroup) => classGroup.organizationId === organization.id,
      ).length,
    };
  }

  private membershipDto(membership: DemoMembership): TeamMemberDto {
    const profile = this.state.profiles.find(
      (item) => item.id === membership.profileId,
    )!;
    const organization = this.state.organizations.find(
      (item) => item.id === membership.organizationId,
    )!;
    return {
      id: membership.id,
      profileId: membership.profileId,
      profileStatus: profile.status,
      displayName: profile.displayName,
      organizationId: membership.organizationId,
      organizationName: organization.name,
      role: membership.role,
      status: membership.status,
    };
  }

  private classDto(classGroup: DemoClass): ClassSummaryDto {
    const organization = this.state.organizations.find(
      (item) => item.id === classGroup.organizationId,
    )!;
    return {
      id: classGroup.id,
      organizationId: classGroup.organizationId,
      organizationName: organization.name,
      name: classGroup.name,
      status: classGroup.status,
      teacherCount: this.state.assignments.filter(
        (assignment) =>
          assignment.classGroupId === classGroup.id &&
          assignment.status === RecordStatus.ACTIVE,
      ).length,
    };
  }
}
