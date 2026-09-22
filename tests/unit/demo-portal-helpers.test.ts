import { describe, expect, it } from "vitest";

import {
  demoAccessibleOrganizationIds,
  demoClasses,
  demoOrganizations,
  demoRole,
  demoTeam,
} from "@/components/portal/adult-portal-helpers";
import { RecordStatus } from "@/generated/prisma/enums";
import {
  DEMO_ORGANIZATION_IDS,
  DEMO_PROFILE_IDS,
  demoAdultPortalSeed,
} from "@/runtime/adult-portal-demo-store";

describe("demo portal authorization helpers", () => {
  it("grants no demo scope to an inactive selected profile", () => {
    const state = structuredClone(demoAdultPortalSeed);
    state.activeProfileId = DEMO_PROFILE_IDS.ORGANIZATION_ADMIN;
    state.profiles.find(
      (profile) => profile.id === state.activeProfileId,
    )!.status = RecordStatus.INACTIVE;

    expect(demoRole(state)).toBeNull();
    expect(demoAccessibleOrganizationIds(state)).toEqual([]);
    expect(demoOrganizations(state)).toEqual([]);
    expect(demoTeam(state)).toEqual([]);
    expect(demoClasses(state)).toEqual([]);
  });

  it("removes organization scope when switching to a profile whose organization is inactive", () => {
    const state = structuredClone(demoAdultPortalSeed);
    state.activeProfileId = DEMO_PROFILE_IDS.ORGANIZATION_ADMIN;
    state.organizations.find(
      (organization) => organization.id === DEMO_ORGANIZATION_IDS.VICTOR_AGGENS,
    )!.status = RecordStatus.INACTIVE;

    expect(demoRole(state)).toBe("teacher");
    expect(demoAccessibleOrganizationIds(state)).toEqual([]);
    expect(demoOrganizations(state)).toEqual([]);
    expect(demoClasses(state)).toEqual([]);

    state.activeProfileId = DEMO_PROFILE_IDS.TEACHER;
    expect(demoRole(state)).toBe("teacher");
    expect(demoAccessibleOrganizationIds(state)).toEqual([]);
    expect(demoClasses(state)).toEqual([]);
  });
});
