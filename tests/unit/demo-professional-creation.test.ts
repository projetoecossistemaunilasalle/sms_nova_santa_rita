import { describe, expect, it } from "vitest";

import { OrganizationRole } from "@/generated/prisma/enums";
import {
  DEMO_ORGANIZATION_IDS,
  DEMO_PROFILE_IDS,
  demoAdultPortalSeed,
} from "@/runtime/adult-portal-demo-store";
import { createDemoProfessionalMembership } from "@/runtime/demo-professional-creation";

describe("demo professional creation", () => {
  it("rejects real email domains before storing a profile", async () => {
    const state = structuredClone(demoAdultPortalSeed);
    await expect(
      createDemoProfessionalMembership(state, DEMO_PROFILE_IDS.PLATFORM_ADMIN, {
        displayName: "Ana Demo",
        email: "ana@example.com",
        organizationId: DEMO_ORGANIZATION_IDS.VICTOR_AGGENS,
        role: OrganizationRole.ORGANIZATION_ADMIN,
      }),
    ).rejects.toThrow("Use um e-mail fictício terminado em .test.");
    expect(state.profiles).toHaveLength(demoAdultPortalSeed.profiles.length);
  });

  it("creates a browser-demo profile and organization membership without credentials", async () => {
    const state = structuredClone(demoAdultPortalSeed);
    const member = await createDemoProfessionalMembership(
      state,
      DEMO_PROFILE_IDS.PLATFORM_ADMIN,
      {
        displayName: "Ana Demo",
        email: "ANA.DEMO@example.test",
        organizationId: DEMO_ORGANIZATION_IDS.VICTOR_AGGENS,
        role: OrganizationRole.ORGANIZATION_ADMIN,
      },
    );

    expect(member).toMatchObject({
      displayName: "Ana Demo",
      organizationId: DEMO_ORGANIZATION_IDS.VICTOR_AGGENS,
      role: OrganizationRole.ORGANIZATION_ADMIN,
    });
    const profile = state.profiles.find((item) => item.id === member.profileId);
    expect(profile).toMatchObject({
      displayName: "Ana Demo",
      email: "ana.demo@example.test",
    });
    expect(profile).not.toHaveProperty("password");
    expect(profile).not.toHaveProperty("authUserId");
    expect(state.memberships.some((item) => item.id === member.id)).toBe(true);
  });

  it("rejects duplicate demo emails and does not keep an orphan profile after authorization failure", async () => {
    const state = structuredClone(demoAdultPortalSeed);
    const input = {
      displayName: "Ana Demo",
      email: "ana.demo@example.test",
      organizationId: DEMO_ORGANIZATION_IDS.VICTOR_AGGENS,
      role: OrganizationRole.ORGANIZATION_ADMIN,
    };

    await createDemoProfessionalMembership(
      state,
      DEMO_PROFILE_IDS.PLATFORM_ADMIN,
      input,
    );
    await expect(
      createDemoProfessionalMembership(state, DEMO_PROFILE_IDS.PLATFORM_ADMIN, {
        ...input,
        email: "ANA.DEMO@example.test",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const profilesBeforeDeniedAttempt = state.profiles.length;
    await expect(
      createDemoProfessionalMembership(
        state,
        DEMO_PROFILE_IDS.ORGANIZATION_ADMIN,
        {
          ...input,
          displayName: "Admin não autorizado",
          email: "admin.demo@example.test",
          role: OrganizationRole.ORGANIZATION_ADMIN,
        },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.profiles).toHaveLength(profilesBeforeDeniedAttempt);
  });
});
