import { describe, expect, it } from "vitest";

import { AdultPortalService } from "@/application/adult-portal/service";
import { OrganizationRole, RecordStatus } from "@/generated/prisma/enums";
import {
  DEMO_CLASS_IDS,
  DEMO_ORGANIZATION_IDS,
  DEMO_PROFILE_IDS,
  DemoAdultPortalStore,
  demoAdultPortalSeed,
} from "@/runtime/adult-portal-demo-store";

function setup() {
  const state = structuredClone(demoAdultPortalSeed);
  return {
    state,
    service: new AdultPortalService(new DemoAdultPortalStore(state)),
  };
}

describe("AdultPortalService", () => {
  it("gives the platform administrator the complete organization scope", async () => {
    const { service } = setup();
    const organizations = await service.listOrganizations(
      DEMO_PROFILE_IDS.PLATFORM_ADMIN,
    );
    expect(organizations.map((organization) => organization.id)).toEqual(
      expect.arrayContaining(Object.values(DEMO_ORGANIZATION_IDS)),
    );
  });

  it("prevents an organization administrator from crossing organization boundaries", async () => {
    const { service } = setup();
    await expect(
      service.getOrganization(
        DEMO_PROFILE_IDS.ORGANIZATION_ADMIN,
        DEMO_ORGANIZATION_IDS.CAMPOS_VERDES,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      service.createClass(DEMO_PROFILE_IDS.ORGANIZATION_ADMIN, {
        organizationId: DEMO_ORGANIZATION_IDS.CAMPOS_VERDES,
        name: "Turma fora do escopo",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("shows a teacher only active classes with active assignments", async () => {
    const { service, state } = setup();
    expect(
      (await service.listClasses(DEMO_PROFILE_IDS.TEACHER)).map(
        (classGroup) => classGroup.id,
      ),
    ).toEqual([DEMO_CLASS_IDS.THIRD_A]);

    state.classes.find((item) => item.id === DEMO_CLASS_IDS.THIRD_A)!.status =
      RecordStatus.INACTIVE;
    expect(await service.listClasses(DEMO_PROFILE_IDS.TEACHER)).toEqual([]);

    state.classes.find((item) => item.id === DEMO_CLASS_IDS.THIRD_A)!.status =
      RecordStatus.ACTIVE;
    state.assignments.find(
      (item) => item.classGroupId === DEMO_CLASS_IDS.THIRD_A,
    )!.status = RecordStatus.INACTIVE;
    expect(await service.listClasses(DEMO_PROFILE_IDS.TEACHER)).toEqual([]);
  });

  it("denies access when the profile, organization, or membership is inactive", async () => {
    const { service, state } = setup();
    state.profiles.find(
      (item) => item.id === DEMO_PROFILE_IDS.TEACHER,
    )!.status = RecordStatus.INACTIVE;
    await expect(
      service.listClasses(DEMO_PROFILE_IDS.TEACHER),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });

    const organizationCase = setup();
    organizationCase.state.organizations.find(
      (item) => item.id === DEMO_ORGANIZATION_IDS.VICTOR_AGGENS,
    )!.status = RecordStatus.INACTIVE;
    expect(
      await organizationCase.service.listClasses(DEMO_PROFILE_IDS.TEACHER),
    ).toEqual([]);

    const membershipCase = setup();
    membershipCase.state.memberships.find(
      (item) => item.id === "demo-membership-teacher",
    )!.status = RecordStatus.INACTIVE;
    expect(
      await membershipCase.service.listClasses(DEMO_PROFILE_IDS.TEACHER),
    ).toEqual([]);
  });

  it("limits class creation to an administrator in the same active organization", async () => {
    const { service } = setup();
    await expect(
      service.createClass(DEMO_PROFILE_IDS.TEACHER, {
        organizationId: DEMO_ORGANIZATION_IDS.VICTOR_AGGENS,
        name: "Turma de professor",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      service.createClass(DEMO_PROFILE_IDS.ORGANIZATION_ADMIN, {
        organizationId: DEMO_ORGANIZATION_IDS.VICTOR_AGGENS,
        name: "6º A",
      }),
    ).resolves.toMatchObject({ name: "6º A" });
  });

  it("rejects teacher assignments for the wrong role or another organization", async () => {
    const { service } = setup();
    await expect(
      service.assignTeacherToClass(DEMO_PROFILE_IDS.ORGANIZATION_ADMIN, {
        classGroupId: DEMO_CLASS_IDS.FIFTH_B,
        membershipId: "demo-membership-admin",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      service.assignTeacherToClass(DEMO_PROFILE_IDS.ORGANIZATION_ADMIN, {
        classGroupId: DEMO_CLASS_IDS.FIFTH_B,
        membershipId: "demo-membership-second-teacher",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("reactivates an inactive assignment without creating a duplicate", async () => {
    const { service, state } = setup();
    const assignment = state.assignments.find(
      (item) => item.classGroupId === DEMO_CLASS_IDS.THIRD_A,
    )!;
    assignment.status = RecordStatus.INACTIVE;

    await expect(
      service.assignTeacherToClass(DEMO_PROFILE_IDS.ORGANIZATION_ADMIN, {
        classGroupId: DEMO_CLASS_IDS.THIRD_A,
        membershipId: assignment.membershipId,
      }),
    ).resolves.toMatchObject({
      id: assignment.id,
      status: RecordStatus.ACTIVE,
    });
    expect(
      state.assignments.filter(
        (item) =>
          item.classGroupId === assignment.classGroupId &&
          item.membershipId === assignment.membershipId,
      ),
    ).toHaveLength(1);
  });

  it("enforces membership assignment and management role restrictions", async () => {
    const { service, state } = setup();
    state.profiles.push({
      id: "demo-profile-provisioned",
      displayName: "Perfil Provisionado",
      status: RecordStatus.ACTIVE,
      platformRole: null,
    });

    await expect(
      service.assignTeacher(DEMO_PROFILE_IDS.PLATFORM_ADMIN, {
        organizationId: DEMO_ORGANIZATION_IDS.VICTOR_AGGENS,
        profileId: "demo-profile-provisioned",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const teacher = await service.assignTeacher(
      DEMO_PROFILE_IDS.ORGANIZATION_ADMIN,
      {
        organizationId: DEMO_ORGANIZATION_IDS.VICTOR_AGGENS,
        profileId: "demo-profile-provisioned",
      },
    );
    expect(teacher.role).toBe(OrganizationRole.TEACHER);

    await expect(
      service.changeMembership(DEMO_PROFILE_IDS.ORGANIZATION_ADMIN, {
        membershipId: "demo-membership-admin",
        role: OrganizationRole.ORGANIZATION_ADMIN,
        status: RecordStatus.INACTIVE,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps demo mutations browser-scoped and rejects duplicates", async () => {
    const { service, state } = setup();
    const created = await service.createOrganization(
      DEMO_PROFILE_IDS.PLATFORM_ADMIN,
      { name: "Organização Demo", type: "Unidade de demonstração" },
    );
    expect(created.id).toMatch(/^demo-organization-/);
    expect(state.organizations).toHaveLength(
      demoAdultPortalSeed.organizations.length + 1,
    );

    await expect(
      service.assignOrganizationAdministrator(DEMO_PROFILE_IDS.PLATFORM_ADMIN, {
        organizationId: DEMO_ORGANIZATION_IDS.VICTOR_AGGENS,
        profileId: DEMO_PROFILE_IDS.ORGANIZATION_ADMIN,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
