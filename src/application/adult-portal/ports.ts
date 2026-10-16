import type { OrganizationRole, RecordStatus } from "@/generated/prisma/enums";

import type {
  ActorSnapshot,
  ClassDetailDto,
  ClassSummaryDto,
  OrganizationSummaryDto,
  ProfessionalOptionDto,
  TeamMemberDto,
  TeacherAssignmentDto,
} from "./types";

export type NewOrganization = {
  name: string;
  type: string;
};

export type NewMembership = {
  organizationId: string;
  profileId: string;
  role: OrganizationRole;
};

export type NewClass = {
  organizationId: string;
  name: string;
};

export interface AdultPortalReader {
  getActor(profileId: string): Promise<ActorSnapshot | null>;
  listOrganizations(
    organizationIds?: readonly string[],
  ): Promise<OrganizationSummaryDto[]>;
  getOrganization(id: string): Promise<OrganizationSummaryDto | null>;
  listMemberships(organizationIds?: string[]): Promise<TeamMemberDto[]>;
  getMembership(id: string): Promise<TeamMemberDto | null>;
  findMembership(
    profileId: string,
    organizationId: string,
  ): Promise<TeamMemberDto | null>;
  listProfessionalProfiles(): Promise<ProfessionalOptionDto[]>;
  getProfessionalProfile(id: string): Promise<ProfessionalOptionDto | null>;
  listClasses(organizationIds?: string[]): Promise<ClassSummaryDto[]>;
  getClass(id: string): Promise<ClassDetailDto | null>;
  getAssignment(id: string): Promise<
    | (TeacherAssignmentDto & {
        classGroupId: string;
        organizationId: string;
        membershipRole: OrganizationRole;
        membershipStatus: RecordStatus;
      })
    | null
  >;
  findAssignment(
    membershipId: string,
    classGroupId: string,
  ): Promise<TeacherAssignmentDto | null>;
}

export interface AdultPortalTransaction extends AdultPortalReader {
  createOrganization(input: NewOrganization): Promise<OrganizationSummaryDto>;
  updateOrganizationStatus(
    id: string,
    status: RecordStatus,
  ): Promise<OrganizationSummaryDto>;
  createMembership(input: NewMembership): Promise<TeamMemberDto>;
  updateMembership(
    id: string,
    role: OrganizationRole,
    status: RecordStatus,
  ): Promise<TeamMemberDto>;
  createClass(input: NewClass): Promise<ClassSummaryDto>;
  updateClassStatus(id: string, status: RecordStatus): Promise<ClassSummaryDto>;
  createAssignment(
    membershipId: string,
    classGroupId: string,
  ): Promise<TeacherAssignmentDto>;
  updateAssignmentStatus(
    id: string,
    status: RecordStatus,
  ): Promise<TeacherAssignmentDto>;
  deactivateAssignmentsForMembership(membershipId: string): Promise<void>;
}

export interface AdultPortalStore extends AdultPortalReader {
  transaction<T>(
    work: (transaction: AdultPortalTransaction) => Promise<T>,
  ): Promise<T>;
}
