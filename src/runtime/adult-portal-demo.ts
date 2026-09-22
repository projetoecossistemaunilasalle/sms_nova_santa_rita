import { AdultPortalService } from "@/application/adult-portal/service";
import {
  DEMO_CLASS_IDS,
  DEMO_ORGANIZATION_IDS,
  DEMO_PROFILE_IDS,
  DemoAdultPortalStore,
} from "@/runtime/adult-portal-demo-store";

function service() {
  return new AdultPortalService(new DemoAdultPortalStore());
}

const profileId = DEMO_PROFILE_IDS.PLATFORM_ADMIN;

export function getPortalShellData() {
  return service().getShell(profileId);
}

export function getPortalOverviewData() {
  return service().getOverview(profileId);
}

export async function getOrganizationsPageData() {
  return {
    organizations: await service().listOrganizations(profileId),
    canCreate: true,
    role: "platform_admin" as const,
  };
}

export function getOrganizationPageData(organizationId: string) {
  return service().getOrganization(profileId, organizationId);
}

export async function getTeamPageData() {
  const portal = service();
  const [members, organizations, profiles] = await Promise.all([
    portal.listTeam(profileId),
    portal.listOrganizations(profileId),
    portal.listProvisionedProfiles(profileId),
  ]);
  return { members, organizations, profiles, role: "platform_admin" as const };
}

export async function getClassesPageData() {
  const teacherPortal = service();
  const organizationPortal = service();
  const [teacherClasses, adminClasses, organizations] = await Promise.all([
    teacherPortal.listClasses(DEMO_PROFILE_IDS.TEACHER),
    organizationPortal.listClasses(DEMO_PROFILE_IDS.ORGANIZATION_ADMIN),
    organizationPortal.listOrganizations(DEMO_PROFILE_IDS.ORGANIZATION_ADMIN),
  ]);
  const classes = [...adminClasses];
  for (const classGroup of teacherClasses) {
    if (!classes.some((item) => item.id === classGroup.id))
      classes.push(classGroup);
  }
  return { classes, organizations, role: "organization_admin" as const };
}

export function getClassPageData(classGroupId: string) {
  const actorId =
    classGroupId === DEMO_CLASS_IDS.FOURTH_A
      ? DEMO_PROFILE_IDS.SECOND_TEACHER
      : DEMO_PROFILE_IDS.ORGANIZATION_ADMIN;
  return service().getClass(actorId, classGroupId);
}

export function listStaticOrganizationIds(): string[] {
  return Object.values(DEMO_ORGANIZATION_IDS);
}

export function listStaticClassIds(): string[] {
  return Object.values(DEMO_CLASS_IDS);
}
