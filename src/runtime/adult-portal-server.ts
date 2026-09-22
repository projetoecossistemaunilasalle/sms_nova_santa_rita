import "server-only";

import { connection } from "next/server";

import type { OrganizationDetailDto } from "@/application/adult-portal/types";
import { getAuthGateway } from "@/server/auth/gateway";
import { getAdultPortalService } from "@/server/services/adult-portal-container";

async function profileId(): Promise<string> {
  await connection();
  const session = await getAuthGateway().getSession();
  if (!session) throw new Error("Authenticated portal session required.");
  return session.actor.profileId;
}

export async function getPortalShellData() {
  return getAdultPortalService().getShell(await profileId());
}

export async function getPortalOverviewData() {
  return getAdultPortalService().getOverview(await profileId());
}

export async function getOrganizationsPageData() {
  const id = await profileId();
  const service = getAdultPortalService();
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
  return getAdultPortalService().getOrganization(
    await profileId(),
    organizationId,
  );
}

export async function getTeamPageData() {
  const id = await profileId();
  const service = getAdultPortalService();
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
  const service = getAdultPortalService();
  const [classes, organizations, shell] = await Promise.all([
    service.listClasses(id),
    service.listOrganizations(id),
    service.getShell(id),
  ]);
  return { classes, organizations, role: shell.effectiveRole };
}

export async function getClassPageData(classGroupId: string) {
  return getAdultPortalService().getClass(await profileId(), classGroupId);
}

export function listStaticOrganizationIds(): string[] {
  return [];
}

export function listStaticClassIds(): string[] {
  return [];
}
