import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { OrganizationRole, RecordStatus } from "@/generated/prisma/enums";
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
  TeacherAssignmentDto,
} from "@/application/adult-portal/types";

import { getPrisma } from "./client";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

const organizationSelect = {
  id: true,
  name: true,
  type: true,
  status: true,
  _count: { select: { memberships: true, classGroups: true } },
} as const;

const membershipSelect = {
  id: true,
  professionalProfileId: true,
  organizationId: true,
  role: true,
  status: true,
  professionalProfile: { select: { displayName: true, status: true } },
  organization: { select: { name: true } },
} as const;

const classSummarySelect = {
  id: true,
  organizationId: true,
  name: true,
  status: true,
  organization: { select: { name: true } },
  _count: {
    select: {
      teacherAssignments: { where: { status: RecordStatus.ACTIVE } },
    },
  },
} as const;

function organizationDto(record: {
  id: string;
  name: string;
  type: string;
  status: RecordStatus;
  _count: { memberships: number; classGroups: number };
}): OrganizationSummaryDto {
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    status: record.status,
    memberCount: record._count.memberships,
    classCount: record._count.classGroups,
  };
}

function membershipDto(record: {
  id: string;
  professionalProfileId: string;
  organizationId: string;
  role: OrganizationRole;
  status: RecordStatus;
  professionalProfile: { displayName: string; status: RecordStatus };
  organization: { name: string };
}): TeamMemberDto {
  return {
    id: record.id,
    profileId: record.professionalProfileId,
    profileStatus: record.professionalProfile.status,
    displayName: record.professionalProfile.displayName,
    organizationId: record.organizationId,
    organizationName: record.organization.name,
    role: record.role,
    status: record.status,
  };
}

function classDto(record: {
  id: string;
  organizationId: string;
  name: string;
  status: RecordStatus;
  organization: { name: string };
  _count: { teacherAssignments: number };
}): ClassSummaryDto {
  return {
    id: record.id,
    organizationId: record.organizationId,
    organizationName: record.organization.name,
    name: record.name,
    status: record.status,
    teacherCount: record._count.teacherAssignments,
  };
}

class PrismaAdultPortalReader {
  constructor(protected readonly db: DatabaseClient) {}

  async getActor(profileId: string): Promise<ActorSnapshot | null> {
    const profile = await this.db.professionalProfile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        displayName: true,
        status: true,
        platformRole: true,
        memberships: {
          select: {
            id: true,
            organizationId: true,
            role: true,
            status: true,
            organization: { select: { name: true, status: true } },
            teacherAssignments: {
              select: { id: true, classGroupId: true, status: true },
            },
          },
        },
      },
    });
    if (!profile) return null;
    return {
      profileId: profile.id,
      displayName: profile.displayName,
      profileStatus: profile.status,
      platformRole: profile.platformRole,
      memberships: profile.memberships.map((membership) => ({
        id: membership.id,
        organizationId: membership.organizationId,
        organizationName: membership.organization.name,
        organizationStatus: membership.organization.status,
        role: membership.role,
        status: membership.status,
        teacherAssignments: membership.teacherAssignments,
      })),
    };
  }

  async listOrganizations(
    organizationIds?: readonly string[],
  ): Promise<OrganizationSummaryDto[]> {
    const records = await this.db.organization.findMany({
      where: organizationIds ? { id: { in: [...organizationIds] } } : undefined,
      orderBy: { name: "asc" },
      select: organizationSelect,
    });
    return records.map(organizationDto);
  }

  async getOrganization(id: string): Promise<OrganizationSummaryDto | null> {
    const record = await this.db.organization.findUnique({
      where: { id },
      select: organizationSelect,
    });
    return record ? organizationDto(record) : null;
  }

  async listMemberships(organizationIds?: string[]): Promise<TeamMemberDto[]> {
    const records = await this.db.organizationMembership.findMany({
      where: organizationIds
        ? { organizationId: { in: organizationIds } }
        : undefined,
      orderBy: [
        { organization: { name: "asc" } },
        { professionalProfile: { displayName: "asc" } },
      ],
      select: membershipSelect,
    });
    return records.map(membershipDto);
  }

  async getMembership(id: string): Promise<TeamMemberDto | null> {
    const record = await this.db.organizationMembership.findUnique({
      where: { id },
      select: membershipSelect,
    });
    return record ? membershipDto(record) : null;
  }

  async findMembership(
    profileId: string,
    organizationId: string,
  ): Promise<TeamMemberDto | null> {
    const record = await this.db.organizationMembership.findUnique({
      where: {
        professionalProfileId_organizationId: {
          professionalProfileId: profileId,
          organizationId,
        },
      },
      select: membershipSelect,
    });
    return record ? membershipDto(record) : null;
  }

  async listProfessionalProfiles(): Promise<ProfessionalOptionDto[]> {
    return this.db.professionalProfile.findMany({
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, status: true },
    });
  }

  async getProfessionalProfile(
    id: string,
  ): Promise<ProfessionalOptionDto | null> {
    return this.db.professionalProfile.findUnique({
      where: { id },
      select: { id: true, displayName: true, status: true },
    });
  }

  async listClasses(organizationIds?: string[]): Promise<ClassSummaryDto[]> {
    const records = await this.db.classGroup.findMany({
      where: organizationIds
        ? { organizationId: { in: organizationIds } }
        : undefined,
      orderBy: [{ organization: { name: "asc" } }, { name: "asc" }],
      select: classSummarySelect,
    });
    return records.map(classDto);
  }

  async getClass(id: string): Promise<ClassDetailDto | null> {
    const record = await this.db.classGroup.findUnique({
      where: { id },
      select: {
        ...classSummarySelect,
        teacherAssignments: {
          orderBy: {
            membership: { professionalProfile: { displayName: "asc" } },
          },
          select: {
            id: true,
            membershipId: true,
            status: true,
            membership: {
              select: {
                professionalProfile: { select: { displayName: true } },
              },
            },
          },
        },
      },
    });
    if (!record) return null;
    const teachers = await this.db.organizationMembership.findMany({
      where: {
        organizationId: record.organizationId,
        role: OrganizationRole.TEACHER,
        status: RecordStatus.ACTIVE,
        professionalProfile: { status: RecordStatus.ACTIVE },
      },
      orderBy: { professionalProfile: { displayName: "asc" } },
      select: membershipSelect,
    });
    return {
      ...classDto(record),
      teachers: record.teacherAssignments.map((assignment) => ({
        id: assignment.id,
        membershipId: assignment.membershipId,
        displayName: assignment.membership.professionalProfile.displayName,
        status: assignment.status,
      })),
      availableTeachers: teachers.map(membershipDto),
      canManage: false,
    };
  }

  async getAssignment(id: string) {
    const record = await this.db.teacherAssignment.findUnique({
      where: { id },
      select: {
        id: true,
        membershipId: true,
        classGroupId: true,
        status: true,
        membership: {
          select: {
            role: true,
            status: true,
            professionalProfile: { select: { displayName: true } },
          },
        },
        classGroup: { select: { organizationId: true } },
      },
    });
    if (!record) return null;
    return {
      id: record.id,
      membershipId: record.membershipId,
      classGroupId: record.classGroupId,
      organizationId: record.classGroup.organizationId,
      displayName: record.membership.professionalProfile.displayName,
      status: record.status,
      membershipRole: record.membership.role,
      membershipStatus: record.membership.status,
    };
  }

  async findAssignment(
    membershipId: string,
    classGroupId: string,
  ): Promise<TeacherAssignmentDto | null> {
    const record = await this.db.teacherAssignment.findUnique({
      where: { membershipId_classGroupId: { membershipId, classGroupId } },
      select: {
        id: true,
        membershipId: true,
        status: true,
        membership: {
          select: { professionalProfile: { select: { displayName: true } } },
        },
      },
    });
    return record
      ? {
          id: record.id,
          membershipId: record.membershipId,
          displayName: record.membership.professionalProfile.displayName,
          status: record.status,
        }
      : null;
  }
}

class PrismaAdultPortalTransaction
  extends PrismaAdultPortalReader
  implements AdultPortalTransaction
{
  async createProfessionalProfile(input: NewProfessionalProfile) {
    return this.db.professionalProfile.create({
      data: { authUserId: input.authUserId, displayName: input.displayName },
      select: { id: true, displayName: true, status: true },
    });
  }

  async createOrganization(input: NewOrganization) {
    const record = await this.db.organization.create({
      data: input,
      select: organizationSelect,
    });
    return organizationDto(record);
  }

  async updateOrganizationStatus(id: string, status: RecordStatus) {
    const record = await this.db.organization.update({
      where: { id },
      data: { status },
      select: organizationSelect,
    });
    return organizationDto(record);
  }

  async createMembership(input: NewMembership) {
    const record = await this.db.organizationMembership.create({
      data: {
        organizationId: input.organizationId,
        professionalProfileId: input.profileId,
        role: input.role,
      },
      select: membershipSelect,
    });
    return membershipDto(record);
  }

  async updateMembership(
    id: string,
    role: OrganizationRole,
    status: RecordStatus,
  ) {
    const record = await this.db.organizationMembership.update({
      where: { id },
      data: { role, status },
      select: membershipSelect,
    });
    return membershipDto(record);
  }

  async createClass(input: NewClass) {
    const record = await this.db.classGroup.create({
      data: input,
      select: classSummarySelect,
    });
    return classDto(record);
  }

  async updateClassStatus(id: string, status: RecordStatus) {
    const record = await this.db.classGroup.update({
      where: { id },
      data: { status },
      select: classSummarySelect,
    });
    return classDto(record);
  }

  async createAssignment(membershipId: string, classGroupId: string) {
    const record = await this.db.teacherAssignment.create({
      data: { membershipId, classGroupId },
      select: {
        id: true,
        membershipId: true,
        status: true,
        membership: {
          select: { professionalProfile: { select: { displayName: true } } },
        },
      },
    });
    return {
      id: record.id,
      membershipId: record.membershipId,
      displayName: record.membership.professionalProfile.displayName,
      status: record.status,
    };
  }

  async updateAssignmentStatus(id: string, status: RecordStatus) {
    const record = await this.db.teacherAssignment.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        membershipId: true,
        status: true,
        membership: {
          select: { professionalProfile: { select: { displayName: true } } },
        },
      },
    });
    return {
      id: record.id,
      membershipId: record.membershipId,
      displayName: record.membership.professionalProfile.displayName,
      status: record.status,
    };
  }

  async deactivateAssignmentsForMembership(membershipId: string) {
    await this.db.teacherAssignment.updateMany({
      where: { membershipId, status: RecordStatus.ACTIVE },
      data: { status: RecordStatus.INACTIVE },
    });
  }
}

export class PrismaAdultPortalStore
  extends PrismaAdultPortalReader
  implements AdultPortalStore
{
  constructor(private readonly prisma: PrismaClient = getPrisma()) {
    super(prisma);
  }

  transaction<T>(
    work: (transaction: AdultPortalTransaction) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction((transaction) =>
      work(new PrismaAdultPortalTransaction(transaction)),
    );
  }
}
