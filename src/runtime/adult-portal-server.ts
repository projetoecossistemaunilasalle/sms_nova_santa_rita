import "server-only";

import { connection } from "next/server";
import { redirect } from "next/navigation";

import type { OrganizationDetailDto } from "@/application/adult-portal/types";
import { getAuthGateway } from "@/server/auth/gateway";
import { getAdultPortalService } from "@/server/services/adult-portal-container";

async function profileId(): Promise<string> {
  await connection();
  const session = await getAuthGateway().getSession();
  if (!session) redirect("/entrar");
  return session.actor.profileId;
}

export async function getPortalShellData() {
  const id = await profileId();
  return (await getAdultPortalService()).getShell(id);
}

export async function getPortalOverviewData() {
  const id = await profileId();
  return (await getAdultPortalService()).getOverview(id);
}

export async function getOrganizationsPageData() {
  const id = await profileId();
  const service = await getAdultPortalService();
  const [organizations, shell] = await Promise.all([
    service.listOrganizations(id),
    service.getShell(id),
  ]);
  return {
    organizations,
    canCreate: shell.effectiveRole === "platform_admin",
    role: shell.effectiveRole,
  };
}

export async function getOrganizationPageData(
  organizationId: string,
): Promise<OrganizationDetailDto> {
  const id = await profileId();
  return (await getAdultPortalService()).getOrganization(id, organizationId);
}

export async function getTeamPageData() {
  const id = await profileId();
  const service = await getAdultPortalService();
  const [members, organizations, profiles, shell] = await Promise.all([
    service.listTeam(id),
    service.listOrganizations(id),
    service.listProvisionedProfiles(id),
    service.getShell(id),
  ]);
  return { members, organizations, profiles, role: shell.effectiveRole };
}

export async function getClassesPageData() {
  const id = await profileId();
  const service = await getAdultPortalService();
  const [classes, organizations, shell] = await Promise.all([
    service.listClasses(id),
    service.listOrganizations(id),
    service.getShell(id),
  ]);
  return { classes, organizations, role: shell.effectiveRole };
}

export async function getClassPageData(classGroupId: string) {
  const id = await profileId();
  return (await getAdultPortalService()).getClass(id, classGroupId);
}
