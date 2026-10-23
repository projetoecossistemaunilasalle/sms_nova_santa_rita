import type {
  OrganizationRole,
  PlatformRole,
  RecordStatus,
} from "@/generated/prisma/enums";

export type TeacherAssignmentSnapshot = {
  id: string;
  classGroupId: string;
  status: RecordStatus;
};

export type MembershipSnapshot = {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationStatus: RecordStatus;
  role: OrganizationRole;
  status: RecordStatus;
  teacherAssignments: TeacherAssignmentSnapshot[];
};

export type ActorSnapshot = {
  profileId: string;
  displayName: string;
  profileStatus: RecordStatus;
  platformRole: PlatformRole | null;
  memberships: MembershipSnapshot[];
};

export type OrganizationSummaryDto = {
  id: string;
  name: string;
  type: string;
  status: RecordStatus;
  memberCount: number;
  classCount: number;
};

export type OrganizationDetailDto = OrganizationSummaryDto & {
  memberships: TeamMemberDto[];
  classes: ClassSummaryDto[];
  canManage: boolean;
  canAssignAdministrator: boolean;
};

export type TeamMemberDto = {
  id: string;
  profileId: string;
  profileStatus: RecordStatus;
  displayName: string;
  organizationId: string;
  organizationName: string;
  role: OrganizationRole;
  status: RecordStatus;
};

export type ProfessionalOptionDto = {
  id: string;
  displayName: string;
  status: RecordStatus;
};

export type TeacherAssignmentDto = {
  id: string;
  membershipId: string;
  displayName: string;
  status: RecordStatus;
};

export type ClassSummaryDto = {
  id: string;
  organizationId: string;
  organizationName: string;
  name: string;
  status: RecordStatus;
  teacherCount: number;
};

export type ClassDetailDto = ClassSummaryDto & {
  teachers: TeacherAssignmentDto[];
  availableTeachers: TeamMemberDto[];
  canManage: boolean;
};

export type AdultRole = "platform_admin" | "organization_admin" | "teacher";

export type NavigationItemDto = {
  href: string;
  label: string;
  icon: "home" | "building" | "school" | "users" | "chart" | "archive";
  exact?: boolean;
  mobile?: boolean;
};

export type PortalShellDto = {
  effectiveRole: AdultRole;
  roleLabel: string;
  scopeLabel: string;
  navigation: NavigationItemDto[];
};

export type PortalOverviewDto = {
  effectiveRole: AdultRole;
  roleLabel: string;
  scopeLabel: string;
  organizations: OrganizationSummaryDto[];
  classes: ClassSummaryDto[];
  teamMemberCount: number;
};

export type ActionResult = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
};
