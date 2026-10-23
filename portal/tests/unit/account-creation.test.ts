import { describe, expect, it, vi } from "vitest";
import { AdultPortalService } from "@/application/adult-portal/service";
import { createAccountSchema } from "@/application/adult-portal/schemas";
import { OrganizationRole, RecordStatus } from "@/generated/prisma/enums";
import {
  DEMO_ORGANIZATION_IDS,
  DEMO_PROFILE_IDS,
  DemoAdultPortalStore,
  demoAdultPortalSeed,
} from "@/server/mock/seed-store";

const input = {
  displayName: "Profissional PSE",
  email: "pse@example.org",
  password: "demo-password-123",
  role: OrganizationRole.TEACHER,
  organizationId: DEMO_ORGANIZATION_IDS.VICTOR_AGGENS,
};

function setup() {
  const state = structuredClone(demoAdultPortalSeed);
  const store = new DemoAdultPortalStore(state);
  const rollback = vi.fn(async () => undefined);
  const identities = {
    create: vi.fn(async () => ({ authUserId: "new-auth-user", rollback })),
  };
  return {
    state,
    store,
    rollback,
    identities,
    service: new AdultPortalService(store, identities),
  };
}

describe("Account creation", () => {
  it.each([OrganizationRole.TEACHER, OrganizationRole.ORGANIZATION_ADMIN])(
    "lets platform admins create %s accounts",
    async (role) => {
      const { service, state } = setup();
      const member = await service.createAccount(
        DEMO_PROFILE_IDS.PLATFORM_ADMIN,
        { ...input, role },
      );
      expect(member).toMatchObject({
        role,
        displayName: input.displayName,
        organizationId: input.organizationId,
        status: RecordStatus.ACTIVE,
      });
      expect(
        state.profiles.find((profile) => profile.id === member.profileId)
          ?.platformRole,
      ).toBeNull();
      expect(JSON.stringify(state)).not.toContain(input.password);
    },
  );

  it("lets organization admins create professionals in their own organization", async () => {
    const { service } = setup();
    await expect(
      service.createAccount(DEMO_PROFILE_IDS.ORGANIZATION_ADMIN, input),
    ).resolves.toMatchObject({ role: OrganizationRole.TEACHER });
  });

  it.each([
    [DEMO_PROFILE_IDS.TEACHER, input],
    [
      DEMO_PROFILE_IDS.ORGANIZATION_ADMIN,
      { ...input, role: OrganizationRole.ORGANIZATION_ADMIN },
    ],
    [
      DEMO_PROFILE_IDS.ORGANIZATION_ADMIN,
      { ...input, organizationId: DEMO_ORGANIZATION_IDS.CAMPOS_VERDES },
    ],
  ])(
    "rejects unauthorized creation before provisioning for %s",
    async (actor, data) => {
      const { service, identities } = setup();
      await expect(service.createAccount(actor, data)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(identities.create).not.toHaveBeenCalled();
    },
  );

  it.each(["profile", "membership", "organization"])(
    "rejects an inactive %s before contacting auth",
    async (target) => {
      const { service, state, identities } = setup();
      if (target === "profile")
        state.profiles.find(
          (item) => item.id === DEMO_PROFILE_IDS.ORGANIZATION_ADMIN,
        )!.status = RecordStatus.INACTIVE;
      if (target === "membership")
        state.memberships
          .filter(
            (item) => item.profileId === DEMO_PROFILE_IDS.ORGANIZATION_ADMIN,
          )
          .forEach((item) => {
            item.status = RecordStatus.INACTIVE;
          });
      if (target === "organization")
        state.organizations.find(
          (item) => item.id === input.organizationId,
        )!.status = RecordStatus.INACTIVE;
      await expect(
        service.createAccount(DEMO_PROFILE_IDS.ORGANIZATION_ADMIN, input),
      ).rejects.toThrow();
      expect(identities.create).not.toHaveBeenCalled();
    },
  );

  it("rolls back both profile and identity when membership persistence fails", async () => {
    const { service, store, state, rollback } = setup();
    const before = structuredClone(state);
    vi.spyOn(store, "createMembership").mockRejectedValue(
      new Error("database failure"),
    );
    await expect(
      service.createAccount(DEMO_PROFILE_IDS.PLATFORM_ADMIN, input),
    ).rejects.toThrow("database failure");
    expect(state).toEqual(before);
    expect(rollback).toHaveBeenCalledOnce();
  });

  it("rechecks authorization after the external provider returns", async () => {
    const { service, state, identities, rollback } = setup();
    identities.create.mockImplementation(async () => {
      state.organizations.find(
        (item) => item.id === input.organizationId,
      )!.status = RecordStatus.INACTIVE;
      return { authUserId: "new-auth-user", rollback };
    });
    await expect(
      service.createAccount(DEMO_PROFILE_IDS.PLATFORM_ADMIN, input),
    ).rejects.toThrow();
    expect(rollback).toHaveBeenCalledOnce();
    expect(state.profiles).toHaveLength(demoAdultPortalSeed.profiles.length);
  });

  it("leaves portal data unchanged on a provider failure", async () => {
    const { service, state, identities } = setup();
    identities.create.mockRejectedValue(new Error("provider failure"));
    await expect(
      service.createAccount(DEMO_PROFILE_IDS.PLATFORM_ADMIN, input),
    ).rejects.toThrow("provider failure");
    expect(state).toEqual(demoAdultPortalSeed);
  });

  it("rejects duplicate demo emails and reports rollback failures", async () => {
    const { service, rollback } = setup();
    await service.createAccount(DEMO_PROFILE_IDS.PLATFORM_ADMIN, input);
    await expect(
      service.createAccount(DEMO_PROFILE_IDS.PLATFORM_ADMIN, {
        ...input,
        email: " PSE@example.org ",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(rollback).toHaveBeenCalledOnce();
    rollback.mockRejectedValue(new Error("cleanup failed"));
    await expect(
      service.createAccount(DEMO_PROFILE_IDS.PLATFORM_ADMIN, input),
    ).rejects.toThrow("nem remover a identidade");
  });

  it.each([
    { email: "not-email" },
    { password: "short" },
    { displayName: " " },
    { role: "PLATFORM_ADMIN" },
    { organizationId: "" },
  ])("validates account input %j", (invalid) => {
    expect(
      createAccountSchema.safeParse({ ...input, ...invalid }).success,
    ).toBe(false);
  });
});
