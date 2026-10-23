import {
  GameSessionStatus,
  OrganizationRole,
  PlatformRole,
  PlayerCredentialStatus,
  RecordStatus,
} from "@/generated/prisma/enums";
import type {
  AdultPortalStore,
  AdultPortalTransaction,
  NewClass,
  NewMembership,
  NewOrganization,
  NewProfessionalProfile,
} from "@/application/adult-portal/ports";
import type {
  ActorSnapshot,
  ClassDetailDto,
  ClassSummaryDto,
  OrganizationSummaryDto,
  ProfessionalOptionDto,
  TeamMemberDto,
} from "@/application/adult-portal/types";
import type {
  NewSlotCredential,
  PlayerAccessStore,
  PlayerAccessTransaction,
  ResolvedCredential,
} from "@/application/player-access/ports";
import type {
  ClassScope,
  GameSessionDto,
  ParticipationDto,
  PlayerSlotDto,
} from "@/application/player-access/types";
import { AdultPortalError } from "@/application/adult-portal/errors";
import type { ContentSelection } from "@/application/game-content/policy";
import { resolvePolicy } from "@/application/game-content/policy";
import type { StoredGameContentManifest } from "@/application/game-content/ports";
import type { SessionContentSnapshot } from "@/application/player-access/types";
import { demoGameContentSeed } from "./content-seed";

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
  email?: string;
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
  nextPlayerNumber: number;
  defaultContentSelection?: ContentSelection | null;
};

type DemoAssignment = {
  id: string;
  membershipId: string;
  classGroupId: string;
  status: RecordStatus;
};

export type DemoPlayerSlot = {
  id: string;
  classGroupId: string;
  playerNumber: number;
  status: RecordStatus;
  createdAt: string;
};

export type DemoPlayerCredential = {
  id: string;
  playerSlotId: string;
  tokenHash: string;
  encryptedToken?: string | null;
  status: PlayerCredentialStatus;
  createdAt: string;
  revokedAt: string | null;
};

export type DemoGameSession = SessionContentSnapshot & {
  id: string;
  classGroupId: string;
  status: GameSessionStatus;
  startedAt: string;
  endedAt: string | null;
};

export type DemoParticipation = {
  id: string;
  gameSessionId: string;
  playerSlotId: string;
  joinedAt: string;
};

export type DemoAdultPortalState = {
  version: 2;
  activeProfileId: string;
  profiles: DemoProfile[];
  organizations: DemoOrganization[];
  memberships: DemoMembership[];
  classes: DemoClass[];
  assignments: DemoAssignment[];
  playerSlots: DemoPlayerSlot[];
  playerCredentials: DemoPlayerCredential[];
  gameSessions: DemoGameSession[];
  participations: DemoParticipation[];
};

export const DEMO_PLAYER_TOKENS = {
  THIRD_A_PLAYER_01: "demo_player_seed_third_a_01_active",
  THIRD_A_PLAYER_02_REVOKED: "demo_player_seed_third_a_02_revoked",
  THIRD_A_PLAYER_02: "demo_player_seed_third_a_02_active",
  THIRD_A_PLAYER_03: "demo_player_seed_third_a_03_active",
} as const;

export const demoAdultPortalSeed: DemoAdultPortalState = {
  version: 2,
  // The walkthrough starts from the teacher role so the default presentation
  // path shows only Visão geral, Turmas, and Resultados; admin views stay
  // reachable through the "Perfil demonstrado" selector.
  activeProfileId: DEMO_PROFILE_IDS.TEACHER,
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
      nextPlayerNumber: 4,
    },
    {
      id: DEMO_CLASS_IDS.FIFTH_B,
      organizationId: DEMO_ORGANIZATION_IDS.VICTOR_AGGENS,
      name: "5º B",
      status: RecordStatus.ACTIVE,
      nextPlayerNumber: 1,
    },
    {
      id: DEMO_CLASS_IDS.FOURTH_A,
      organizationId: DEMO_ORGANIZATION_IDS.CAMPOS_VERDES,
      name: "4º A",
      status: RecordStatus.ACTIVE,
      nextPlayerNumber: 1,
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
  playerSlots: [
    {
      id: "demo-player-third-a-01",
      classGroupId: DEMO_CLASS_IDS.THIRD_A,
      playerNumber: 1,
      status: RecordStatus.ACTIVE,
      createdAt: "2026-09-15T13:00:00.000Z",
    },
    {
      id: "demo-player-third-a-02",
      classGroupId: DEMO_CLASS_IDS.THIRD_A,
      playerNumber: 2,
      status: RecordStatus.ACTIVE,
      createdAt: "2026-09-15T13:00:00.000Z",
    },
    {
      id: "demo-player-third-a-03",
      classGroupId: DEMO_CLASS_IDS.THIRD_A,
      playerNumber: 3,
      status: RecordStatus.ACTIVE,
      createdAt: "2026-09-15T13:00:00.000Z",
    },
  ],
  playerCredentials: [
    {
      id: "demo-credential-third-a-01",
      playerSlotId: "demo-player-third-a-01",
      tokenHash: DEMO_PLAYER_TOKENS.THIRD_A_PLAYER_01,
      status: PlayerCredentialStatus.ACTIVE,
      createdAt: "2026-09-15T13:00:00.000Z",
      revokedAt: null,
    },
    {
      id: "demo-credential-third-a-02-old",
      playerSlotId: "demo-player-third-a-02",
      tokenHash: DEMO_PLAYER_TOKENS.THIRD_A_PLAYER_02_REVOKED,
      status: PlayerCredentialStatus.REVOKED,
      createdAt: "2026-09-15T13:00:00.000Z",
      revokedAt: "2026-09-18T14:30:00.000Z",
    },
    {
      id: "demo-credential-third-a-02",
      playerSlotId: "demo-player-third-a-02",
      tokenHash: DEMO_PLAYER_TOKENS.THIRD_A_PLAYER_02,
      status: PlayerCredentialStatus.ACTIVE,
      createdAt: "2026-09-18T14:30:00.000Z",
      revokedAt: null,
    },
    {
      id: "demo-credential-third-a-03",
      playerSlotId: "demo-player-third-a-03",
      tokenHash: DEMO_PLAYER_TOKENS.THIRD_A_PLAYER_03,
      status: PlayerCredentialStatus.ACTIVE,
      createdAt: "2026-09-15T13:00:00.000Z",
      revokedAt: null,
    },
  ],
  gameSessions: [
    {
      id: "demo-session-third-a-ended",
      contentManifestId: demoGameContentSeed()[0]!.id,
      contentPolicy: resolvePolicy(null, demoGameContentSeed()[0]!.payload),
      startedById: DEMO_PROFILE_IDS.TEACHER,
      classGroupId: DEMO_CLASS_IDS.THIRD_A,
      status: GameSessionStatus.ENDED,
      startedAt: "2026-09-18T13:00:00.000Z",
      endedAt: "2026-09-18T13:45:00.000Z",
    },
  ],
  participations: [
    {
      id: "demo-participation-third-a-01-ended",
      gameSessionId: "demo-session-third-a-ended",
      playerSlotId: "demo-player-third-a-01",
      joinedAt: "2026-09-18T13:04:00.000Z",
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

export class DemoAdultPortalStore
  implements AdultPortalStore, AdultPortalTransaction
{
  constructor(readonly state: DemoAdultPortalState = cloneSeed()) {}

  async createProfessionalProfile(input: NewProfessionalProfile) {
    if (
      this.state.profiles.some(
        (profile) => profile.email?.toLowerCase() === input.email.toLowerCase(),
      )
    ) {
      throw new AdultPortalError(
        "Já existe uma conta com este e-mail. Vincule o perfil existente.",
        "CONFLICT",
      );
    }
    const profile = {
      id: crypto.randomUUID(),
      displayName: input.displayName,
      email: input.email,
      platformRole: null,
      status: RecordStatus.ACTIVE,
    };
    this.state.profiles.push(profile);
    return {
      id: profile.id,
      displayName: profile.displayName,
      status: profile.status,
    };
  }

  async transaction<T>(
    work: (transaction: AdultPortalTransaction) => Promise<T>,
  ): Promise<T> {
    const before = structuredClone(this.state);
    try {
      return await work(this);
    } catch (error) {
      Object.assign(this.state, before);
      throw error;
    }
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

  async listOrganizations(
    organizationIds?: readonly string[],
  ): Promise<OrganizationSummaryDto[]> {
    return this.state.organizations
      .filter(
        (organization) =>
          !organizationIds || organizationIds.includes(organization.id),
      )
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
      nextPlayerNumber: 1,
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

export class DemoPlayerAccessStore
  implements PlayerAccessStore, PlayerAccessTransaction
{
  constructor(
    readonly state: DemoAdultPortalState = cloneSeed(),
    private readonly currentManifest: () => Promise<StoredGameContentManifest | null> = async () =>
      demoGameContentSeed()[0]!,
    private readonly findManifest: (
      id: string,
    ) => Promise<StoredGameContentManifest | null> = async (id) =>
      demoGameContentSeed().find((item) => item.id === id) ?? null,
  ) {}

  getCurrentManifest() {
    return this.currentManifest();
  }

  getManifest(manifestId: string) {
    return this.findManifest(manifestId);
  }

  async setClassDefaultContent(
    classGroupId: string,
    selection: ContentSelection | null,
  ) {
    const row = this.state.classes.find((item) => item.id === classGroupId);
    if (!row) throw new AdultPortalError("Turma não encontrada.", "NOT_FOUND");
    row.defaultContentSelection = structuredClone(selection);
  }

  async updateEncryptedCredential(
    playerSlotId: string,
    tokenHash: string,
    encryptedToken: string,
  ) {
    const credential = this.state.playerCredentials.find(
      (item) =>
        item.playerSlotId === playerSlotId &&
        item.tokenHash === tokenHash &&
        item.status === PlayerCredentialStatus.ACTIVE,
    );
    if (credential) credential.encryptedToken = encryptedToken;
  }

  async getExistingParticipation(gameSessionId: string, playerSlotId: string) {
    const session = this.state.gameSessions.find(
      (item) => item.id === gameSessionId,
    );
    const participation = this.state.participations.find(
      (item) =>
        item.gameSessionId === gameSessionId &&
        item.playerSlotId === playerSlotId,
    );
    return session && participation
      ? {
          session: this.sessionDto(session),
          participation: this.participationDto(participation),
        }
      : null;
  }

  async transaction<T>(
    work: (transaction: PlayerAccessTransaction) => Promise<T>,
  ): Promise<T> {
    const before = structuredClone(this.state);
    try {
      return await work(this);
    } catch (error) {
      Object.assign(this.state, before);
      throw error;
    }
  }

  getActor(profileId: string): Promise<ActorSnapshot | null> {
    return new DemoAdultPortalStore(this.state).getActor(profileId);
  }

  async getClassScope(classGroupId: string): Promise<ClassScope | null> {
    const classGroup = this.state.classes.find(
      (item) => item.id === classGroupId,
    );
    if (!classGroup) return null;
    const organization = this.state.organizations.find(
      (item) => item.id === classGroup.organizationId,
    );
    if (!organization) return null;
    return {
      id: classGroup.id,
      organizationId: classGroup.organizationId,
      organizationStatus: organization.status,
      status: classGroup.status,
      defaultContentSelection: structuredClone(
        classGroup.defaultContentSelection ?? null,
      ),
    };
  }

  async getSlot(slotId: string): Promise<PlayerSlotDto | null> {
    const slot = this.state.playerSlots.find((item) => item.id === slotId);
    return slot ? this.slotDto(slot) : null;
  }

  async listSlots(classGroupId: string): Promise<PlayerSlotDto[]> {
    return this.state.playerSlots
      .filter((slot) => slot.classGroupId === classGroupId)
      .sort((a, b) => a.playerNumber - b.playerNumber)
      .map((slot) => this.slotDto(slot));
  }

  async listStoredCredentials(classGroupId: string) {
    const slotIds = new Set(
      this.state.playerSlots
        .filter(
          (slot) =>
            slot.classGroupId === classGroupId &&
            slot.status === RecordStatus.ACTIVE,
        )
        .map((slot) => slot.id),
    );
    return this.state.playerCredentials
      .filter(
        (credential) =>
          slotIds.has(credential.playerSlotId) &&
          credential.status === PlayerCredentialStatus.ACTIVE,
      )
      .map(({ playerSlotId, tokenHash, encryptedToken }) => ({
        playerSlotId,
        tokenHash,
        encryptedToken: encryptedToken ?? null,
      }));
  }

  async getActiveSession(classGroupId: string): Promise<GameSessionDto | null> {
    const session = this.state.gameSessions.find(
      (item) =>
        item.classGroupId === classGroupId &&
        item.status === GameSessionStatus.ACTIVE,
    );
    return session ? this.sessionDto(session) : null;
  }

  async resolveCredential(
    tokenHash: string,
  ): Promise<ResolvedCredential | null> {
    const credential = this.state.playerCredentials.find(
      (item) => item.tokenHash === tokenHash,
    );
    if (!credential) return null;
    const slot = this.state.playerSlots.find(
      (item) => item.id === credential.playerSlotId,
    );
    if (!slot) return null;
    const classGroup = await this.getClassScope(slot.classGroupId);
    if (!classGroup) return null;
    return {
      id: credential.id,
      status: credential.status,
      slot: {
        id: slot.id,
        classGroupId: slot.classGroupId,
        playerNumber: slot.playerNumber,
        status: slot.status,
      },
      classGroup,
    };
  }

  async allocateSlots(
    classGroupId: string,
    credentials: readonly NewSlotCredential[],
  ): Promise<PlayerSlotDto[]> {
    const classGroup = this.state.classes.find(
      (item) => item.id === classGroupId,
    );
    if (!classGroup) {
      throw new AdultPortalError("Turma não encontrada.", "NOT_FOUND");
    }
    const createdAt = new Date().toISOString();
    return credentials.map(({ tokenHash, encryptedToken }) => {
      if (
        this.state.playerCredentials.some(
          (credential) => credential.tokenHash === tokenHash,
        )
      ) {
        throw new AdultPortalError("Credencial demo duplicada.", "CONFLICT");
      }
      const playerNumber = classGroup.nextPlayerNumber;
      classGroup.nextPlayerNumber += 1;
      const slot: DemoPlayerSlot = {
        id: demoId("player-slot"),
        classGroupId,
        playerNumber,
        status: RecordStatus.ACTIVE,
        createdAt,
      };
      const credential: DemoPlayerCredential = {
        id: demoId("player-credential"),
        playerSlotId: slot.id,
        tokenHash,
        encryptedToken: encryptedToken ?? null,
        status: PlayerCredentialStatus.ACTIVE,
        createdAt,
        revokedAt: null,
      };
      this.state.playerSlots.push(slot);
      this.state.playerCredentials.push(credential);
      return this.slotDto(slot);
    });
  }

  async rotateCredential(
    slotId: string,
    tokenHash: string,
    revokedAt: Date,
    encryptedToken: string | null = null,
  ): Promise<PlayerSlotDto> {
    const slot = this.state.playerSlots.find((item) => item.id === slotId);
    if (!slot) {
      throw new AdultPortalError("Jogador não encontrado.", "NOT_FOUND");
    }
    if (
      this.state.playerCredentials.some(
        (credential) => credential.tokenHash === tokenHash,
      )
    ) {
      throw new AdultPortalError("Credencial demo duplicada.", "CONFLICT");
    }
    const rotatedAt = revokedAt.toISOString();
    for (const credential of this.state.playerCredentials) {
      if (
        credential.playerSlotId === slotId &&
        credential.status === PlayerCredentialStatus.ACTIVE
      ) {
        credential.status = PlayerCredentialStatus.REVOKED;
        credential.revokedAt = rotatedAt;
        credential.encryptedToken = null;
      }
    }
    this.state.playerCredentials.push({
      id: demoId("player-credential"),
      playerSlotId: slotId,
      tokenHash,
      encryptedToken,
      status: PlayerCredentialStatus.ACTIVE,
      createdAt: rotatedAt,
      revokedAt: null,
    });
    return this.slotDto(slot);
  }

  async createSession(
    classGroupId: string,
    startedAt: Date,
    content: SessionContentSnapshot,
  ): Promise<GameSessionDto> {
    if (await this.getActiveSession(classGroupId)) {
      throw new AdultPortalError(
        "A turma já possui uma sessão ativa.",
        "CONFLICT",
      );
    }
    if (!this.state.classes.some((item) => item.id === classGroupId)) {
      throw new AdultPortalError("Turma não encontrada.", "NOT_FOUND");
    }
    const session: DemoGameSession = {
      ...structuredClone(content),
      id: demoId("game-session"),
      classGroupId,
      status: GameSessionStatus.ACTIVE,
      startedAt: startedAt.toISOString(),
      endedAt: null,
    };
    this.state.gameSessions.push(session);
    return this.sessionDto(session);
  }

  async endSession(sessionId: string, endedAt: Date): Promise<GameSessionDto> {
    const session = this.state.gameSessions.find(
      (item) => item.id === sessionId,
    );
    if (!session || session.status !== GameSessionStatus.ACTIVE) {
      throw new AdultPortalError(
        "A turma não possui sessão ativa.",
        "CONFLICT",
      );
    }
    session.status = GameSessionStatus.ENDED;
    session.endedAt = endedAt.toISOString();
    return this.sessionDto(session);
  }

  async findOrCreateActiveParticipation(
    classGroupId: string,
    playerSlotId: string,
    joinedAt: Date,
  ) {
    const session = this.state.gameSessions.find(
      (item) =>
        item.classGroupId === classGroupId &&
        item.status === GameSessionStatus.ACTIVE,
    );
    if (!session) return null;

    const existing = this.state.participations.find(
      (item) =>
        item.gameSessionId === session.id && item.playerSlotId === playerSlotId,
    );
    if (existing) {
      return {
        session: this.sessionDto(session),
        participation: this.participationDto(existing),
      };
    }

    const slot = this.state.playerSlots.find(
      (item) => item.id === playerSlotId,
    );
    if (!slot || session.classGroupId !== slot.classGroupId) {
      throw new AdultPortalError(
        "Jogador e sessão não pertencem à mesma turma.",
        "CONFLICT",
      );
    }
    const participation: DemoParticipation = {
      id: demoId("participation"),
      gameSessionId: session.id,
      playerSlotId,
      joinedAt: joinedAt.toISOString(),
    };
    this.state.participations.push(participation);
    return {
      session: this.sessionDto(session),
      participation: this.participationDto(participation),
    };
  }

  private slotDto(slot: DemoPlayerSlot): PlayerSlotDto {
    const credentials = this.state.playerCredentials.filter(
      (item) => item.playerSlotId === slot.id,
    );
    const credential =
      [...credentials]
        .reverse()
        .find((item) => item.status === PlayerCredentialStatus.ACTIVE) ??
      credentials.at(-1) ??
      null;
    return {
      id: slot.id,
      classGroupId: slot.classGroupId,
      playerNumber: slot.playerNumber,
      status: slot.status,
      credentialId: credential?.id ?? null,
      credentialStatus: credential?.status ?? null,
    };
  }

  private sessionDto(session: DemoGameSession): GameSessionDto {
    return {
      contentManifestId: session.contentManifestId,
      contentPolicy: structuredClone(session.contentPolicy),
      startedById: session.startedById,
      id: session.id,
      classGroupId: session.classGroupId,
      status: session.status,
      startedAt: new Date(session.startedAt),
      endedAt: session.endedAt ? new Date(session.endedAt) : null,
    };
  }

  private participationDto(participation: DemoParticipation): ParticipationDto {
    return {
      id: participation.id,
      gameSessionId: participation.gameSessionId,
      playerSlotId: participation.playerSlotId,
      joinedAt: new Date(participation.joinedAt),
    };
  }
}
