import { describe, expect, it } from "vitest";

import {
  demoAccessibleOrganizationIds,
  demoAssignedRoleForProfile,
  demoClasses,
  demoOrganizations,
  demoRole,
  demoRoleForProfile,
  demoScopeLabel,
  demoTeam,
} from "@/components/portal/adult-portal-helpers";
import { RecordStatus } from "@/generated/prisma/enums";
import {
  DEMO_ORGANIZATION_IDS,
  DEMO_PROFILE_IDS,
  demoAdultPortalSeed,
} from "@/runtime/adult-portal-demo-store";

describe("demo portal authorization helpers", () => {
  it("keeps the organization administrator and teacher demo roles distinct", () => {
    const state = structuredClone(demoAdultPortalSeed);

    expect(demoRoleForProfile(state, DEMO_PROFILE_IDS.ORGANIZATION_ADMIN)).toBe(
      "organization_admin",
    );
    expect(demoRoleForProfile(state, DEMO_PROFILE_IDS.TEACHER)).toBe("teacher");

    state.activeProfileId = DEMO_PROFILE_IDS.ORGANIZATION_ADMIN;
    expect(demoRole(state)).toBe("organization_admin");
    state.activeProfileId = DEMO_PROFILE_IDS.TEACHER;
    expect(demoRole(state)).toBe("teacher");
  });

  it("uses assigned classes, not organization count, for a teacher's demo scope", () => {
    const state = structuredClone(demoAdultPortalSeed);
    state.activeProfileId = DEMO_PROFILE_IDS.TEACHER;

    expect(demoScopeLabel(state)).toBe("1 turma atribuída");
  });

  it("grants no demo scope to an inactive selected profile", () => {
    const state = structuredClone(demoAdultPortalSeed);
    state.activeProfileId = DEMO_PROFILE_IDS.ORGANIZATION_ADMIN;
    state.profiles.find(
      (profile) => profile.id === state.activeProfileId,
    )!.status = RecordStatus.INACTIVE;

    expect(demoRole(state)).toBeNull();
    expect(
      demoAssignedRoleForProfile(state, DEMO_PROFILE_IDS.ORGANIZATION_ADMIN),
    ).toBe("organization_admin");
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

    expect(demoRole(state)).toBeNull();
    expect(
      demoAssignedRoleForProfile(state, DEMO_PROFILE_IDS.ORGANIZATION_ADMIN),
    ).toBe("organization_admin");
    expect(demoAccessibleOrganizationIds(state)).toEqual([]);
    expect(demoOrganizations(state)).toEqual([]);
    expect(demoClasses(state)).toEqual([]);

    state.activeProfileId = DEMO_PROFILE_IDS.TEACHER;
    expect(demoRole(state)).toBeNull();
    expect(demoAssignedRoleForProfile(state, DEMO_PROFILE_IDS.TEACHER)).toBe(
      "teacher",
    );
    expect(demoAccessibleOrganizationIds(state)).toEqual([]);
    expect(demoClasses(state)).toEqual([]);

    const restored = structuredClone(demoAdultPortalSeed);
    expect(
      demoRoleForProfile(restored, DEMO_PROFILE_IDS.ORGANIZATION_ADMIN),
    ).toBe("organization_admin");
    expect(demoRoleForProfile(restored, DEMO_PROFILE_IDS.TEACHER)).toBe(
      "teacher",
    );
  });
});
