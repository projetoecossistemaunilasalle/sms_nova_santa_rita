import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  setCookie: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/neon-server", () => ({
  getNeonAuthServer: () => {
    throw new Error("Mock contacted Neon Auth");
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: (name: string) =>
      request.cookies.has(name)
        ? { value: request.cookies.get(name) }
        : undefined,
    set: (name: string, value: string, options: unknown) => {
      request.cookies.set(name, value);
      request.setCookie(name, value, options);
    },
    delete: (name: string) => request.cookies.delete(name),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: request.revalidatePath }));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
vi.mock("@/server/db/prisma-adult-portal-store", () => ({
  PrismaAdultPortalStore: class {
    constructor() {
      throw new Error("Mock contacted Prisma");
    }
  },
}));
vi.mock("@/server/db/prisma-player-access-store", () => ({
  PrismaPlayerAccessStore: class {
    constructor() {
      throw new Error("Mock contacted Prisma");
    }
  },
}));
vi.mock("@/server/db/prisma-game-event-store", () => ({
  PrismaGameEventStore: class {
    constructor() {
      throw new Error("Mock contacted Prisma");
    }
  },
}));

import { AdultPortalService } from "@/application/adult-portal/service";
import { PlayerAccessService } from "@/application/player-access/service";
import { RecordStatus } from "@/generated/prisma/enums";
import { signInAction } from "@/app/(professional)/entrar/actions";
import { signOutAction } from "@/app/(professional)/portal/sign-out-action";
import {
  assignOrganizationAdministratorAction,
  assignTeacherMembershipAction,
  assignTeacherToClassAction,
  changeClassStatusAction,
  createClassAction,
  createOrganizationAction,
  createAccountAction,
} from "@/app/(professional)/portal/adult-portal-actions";
import {
  allocatePlayerSlotsAction,
  rotatePlayerCredentialAction,
  showClassPlayerCredentialsAction,
  startClassSessionAction,
  endClassSessionAction,
} from "@/app/(professional)/portal/player-access-actions";
import {
  getClassesPageData,
  getClassPageData,
  getOrganizationPageData,
  getPortalShellData,
  getTeamPageData,
} from "@/runtime/readers";
import {
  getResultReportsPageData,
  getClassResultsPageData,
  getPlayerResultsPageData,
} from "@/runtime/game-events-server";
import { getPlayerAccessPageData } from "@/runtime/player-access-server";
import { getAuthGateway } from "@/server/auth/gateway";
import { changeMockProfile, resetMockWorkspace } from "@/server/mock/actions";
import {
  MOCK_SESSION_COOKIE,
  MOCK_SESSION_TTL_SECONDS,
  MockAdultPortalStore,
  MockDatabase,
  MockPlayerAccessStore,
  MockSessionRegistry,
} from "@/server/mock/database";
import {
  endMockSession,
  getMockDatabase,
  startMockSession,
} from "@/server/mock/session";
import {
  DEMO_CLASS_IDS,
  DEMO_ORGANIZATION_IDS,
  DEMO_PROFILE_IDS,
  demoAdultPortalSeed,
} from "@/server/mock/seed-store";
import {
  SecurePlayerCredentialIssuer,
  hashPlayerCredentialToken,
  isValidPlayerCredentialToken,
} from "@/server/security/player-credential-tokens";

const previous = { ok: false, message: "" };

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

async function switchProfile(profileId: string) {
  await expect(changeMockProfile(form({ profileId }))).rejects.toThrow(
    "REDIRECT:/portal",
  );
}

beforeEach(async () => {
  vi.stubEnv("APP_RUNTIME_MODE", "demo");
  request.cookies.clear();
  vi.clearAllMocks();
  await startMockSession();
});

afterEach(async () => {
  vi.stubEnv("APP_RUNTIME_MODE", "demo");
  await endMockSession();
  vi.unstubAllEnvs();
});

describe("shared portal with server-side mock adapters", () => {
  it("creates professional accounts through the action without changing the admin session", async () => {
    await switchProfile(DEMO_PROFILE_IDS.ORGANIZATION_ADMIN);
    const result = await createAccountAction(
      previous,
      form({
        displayName: "Equipe PSE",
        email: "pse@example.org",
        password: "demo-only-password",
        organizationId: DEMO_ORGANIZATION_IDS.VICTOR_AGGENS,
        role: "TEACHER",
      }),
    );
    expect(result.ok).toBe(true);
    expect((await getTeamPageData()).members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ displayName: "Equipe PSE", role: "TEACHER" }),
      ]),
    );
    expect((await getAuthGateway().getSession())?.actor.profileId).toBe(
      DEMO_PROFILE_IDS.ORGANIZATION_ADMIN,
    );
    expect(JSON.stringify((await getMockDatabase()).state)).not.toContain(
      "demo-only-password",
    );
    expect(request.revalidatePath).toHaveBeenCalledWith("/portal/admin/equipe");
  });

  it("rejects account creation without a session and returns field errors without credentials", async () => {
    const invalid = await createAccountAction(
      previous,
      form({ password: "secret" }),
    );
    expect(invalid).toMatchObject({
      ok: false,
      fieldErrors: { email: expect.any(Array) },
    });
    expect(JSON.stringify(invalid)).not.toContain("secret");
    await endMockSession();
    expect(
      await createAccountAction(
        previous,
        form({
          displayName: "Teste PSE",
          email: "pse@example.org",
          password: "demo-only-password",
          organizationId: DEMO_ORGANIZATION_IDS.VICTOR_AGGENS,
          role: "TEACHER",
        }),
      ),
    ).toMatchObject({ ok: false, message: "Sessão expirada." });
  });

  it("uses an opaque HttpOnly session and authenticates the seeded teacher", async () => {
    expect(request.setCookie).toHaveBeenCalledWith(
      MOCK_SESSION_COOKIE,
      expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: MOCK_SESSION_TTL_SECONDS,
      }),
    );
    expect(await getAuthGateway().getSession()).toMatchObject({
      actor: {
        profileId: DEMO_PROFILE_IDS.TEACHER,
        displayName: "Carla Freitas",
      },
    });
    expect((await getPortalShellData()).effectiveRole).toBe("teacher");
  });

  it("creates a mock session through the real sign-in action and destroys it on sign-out", async () => {
    await endMockSession();
    expect(await getAuthGateway().getSession()).toBeNull();
    await expect(signInAction(new FormData())).rejects.toThrow(
      "REDIRECT:/portal",
    );
    expect(await getAuthGateway().getSession()).not.toBeNull();
    await expect(signOutAction()).rejects.toThrow("REDIRECT:/entrar");
    expect(await getAuthGateway().getSession()).toBeNull();
  });

  it("rejects unauthenticated writes and redirects protected reads", async () => {
    await endMockSession();
    expect(
      await createClassAction(
        previous,
        form({
          name: "Denied",
          organizationId: DEMO_ORGANIZATION_IDS.VICTOR_AGGENS,
        }),
      ),
    ).toMatchObject({ ok: false, message: "Sessão expirada." });
    await expect(getClassesPageData()).rejects.toThrow("REDIRECT:/entrar");
  });

  it("uses the selected actor for every reader and denies teacher administration", async () => {
    expect((await getClassesPageData()).classes.map((item) => item.id)).toEqual(
      [DEMO_CLASS_IDS.THIRD_A],
    );
    expect(
      await createClassAction(
        previous,
        form({
          name: "Denied",
          organizationId: DEMO_ORGANIZATION_IDS.VICTOR_AGGENS,
        }),
      ),
    ).toMatchObject({ ok: false });
    await expect(getTeamPageData()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await switchProfile(DEMO_PROFILE_IDS.SECOND_TEACHER);
    expect((await getClassesPageData()).classes.map((item) => item.id)).toEqual(
      [DEMO_CLASS_IDS.FOURTH_A],
    );
    await expect(
      getClassPageData(DEMO_CLASS_IDS.THIRD_A),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("creates a navigable class through the same production action and reader", async () => {
    await switchProfile(DEMO_PROFILE_IDS.ORGANIZATION_ADMIN);
    expect(
      await createClassAction(
        previous,
        form({
          name: "Local class",
          organizationId: DEMO_ORGANIZATION_IDS.VICTOR_AGGENS,
        }),
      ),
    ).toMatchObject({ ok: true });
    const created = (await getClassesPageData()).classes.find(
      (item) => item.name === "Local class",
    )!;
    expect(await getClassPageData(created.id)).toMatchObject({
      name: "Local class",
      canManage: true,
    });
    expect(await getPlayerAccessPageData(created.id)).toEqual({
      slots: [],
      activeSession: null,
    });
  });

  it("keeps inactive classes readable by administrators for reactivation, but not operable", async () => {
    await switchProfile(DEMO_PROFILE_IDS.ORGANIZATION_ADMIN);
    expect(
      await changeClassStatusAction(
        previous,
        form({
          classGroupId: DEMO_CLASS_IDS.THIRD_A,
          status: RecordStatus.INACTIVE,
        }),
      ),
    ).toMatchObject({ ok: true });
    expect(await getClassPageData(DEMO_CLASS_IDS.THIRD_A)).toMatchObject({
      status: RecordStatus.INACTIVE,
      canManage: true,
    });
    expect(
      (await getPlayerAccessPageData(DEMO_CLASS_IDS.THIRD_A)).slots,
    ).toHaveLength(3);
    expect(
      await startClassSessionAction(
        previous,
        form({ classGroupId: DEMO_CLASS_IDS.THIRD_A }),
      ),
    ).toMatchObject({ ok: false });
    await switchProfile(DEMO_PROFILE_IDS.TEACHER);
    await expect(
      getPlayerAccessPageData(DEMO_CLASS_IDS.THIRD_A),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await switchProfile(DEMO_PROFILE_IDS.ORGANIZATION_ADMIN);
    expect(
      await changeClassStatusAction(
        previous,
        form({
          classGroupId: DEMO_CLASS_IDS.THIRD_A,
          status: RecordStatus.ACTIVE,
        }),
      ),
    ).toMatchObject({ ok: true });
  });

  it("supports newly-created organizations and real membership/assignment workflows", async () => {
    await switchProfile(DEMO_PROFILE_IDS.PLATFORM_ADMIN);
    expect(
      await createOrganizationAction(
        previous,
        form({ name: "New local organization", type: "School" }),
      ),
    ).toMatchObject({ ok: true });
    const database = await getMockDatabase();
    const organization = database.state.organizations.find(
      (item) => item.name === "New local organization",
    )!;
    expect(await getOrganizationPageData(organization.id)).toMatchObject({
      id: organization.id,
      canManage: true,
    });
    expect(
      await assignOrganizationAdministratorAction(
        previous,
        form({
          organizationId: organization.id,
          profileId: DEMO_PROFILE_IDS.ORGANIZATION_ADMIN,
        }),
      ),
    ).toMatchObject({ ok: true });
    await switchProfile(DEMO_PROFILE_IDS.ORGANIZATION_ADMIN);
    expect(
      await assignTeacherMembershipAction(
        previous,
        form({
          organizationId: organization.id,
          profileId: DEMO_PROFILE_IDS.TEACHER,
        }),
      ),
    ).toMatchObject({ ok: true });
    expect(
      await createClassAction(
        previous,
        form({ name: "New scoped class", organizationId: organization.id }),
      ),
    ).toMatchObject({ ok: true });
    const classGroup = database.state.classes.find(
      (item) => item.name === "New scoped class",
    )!;
    const membership = database.state.memberships.find(
      (item) =>
        item.profileId === DEMO_PROFILE_IDS.TEACHER &&
        item.organizationId === organization.id,
    )!;
    expect(
      await assignTeacherToClassAction(
        previous,
        form({ classGroupId: classGroup.id, membershipId: membership.id }),
      ),
    ).toMatchObject({ ok: true });
    await switchProfile(DEMO_PROFILE_IDS.TEACHER);
    expect(await getClassPageData(classGroup.id)).toMatchObject({
      id: classGroup.id,
      canManage: false,
    });
  });

  it("allocates, rotates and resolves credentials using production token rules", async () => {
    const result = await allocatePlayerSlotsAction(
      previous,
      form({ classGroupId: DEMO_CLASS_IDS.THIRD_A, count: "2" }),
    );
    expect(result.ok).toBe(true);
    const issued = result.issuedCredentials![0]!;
    expect(isValidPlayerCredentialToken(issued.token)).toBe(true);
    expect(issued.playerNumber).toBe(4);
    const database = await getMockDatabase();
    expect(JSON.stringify(database.state)).not.toContain(issued.token);
    const service = new PlayerAccessService(
      new MockPlayerAccessStore(database),
      new SecurePlayerCredentialIssuer(),
      database.credentialCipher,
    );
    expect(
      await service.resolveEntry(hashPlayerCredentialToken(issued.token)),
    ).toMatchObject({ state: "waiting" });
    const replacement = await rotatePlayerCredentialAction(
      previous,
      form({ playerSlotId: issued.playerSlotId }),
    );
    expect(replacement.ok).toBe(true);
    expect(
      await service.resolveEntry(hashPlayerCredentialToken(issued.token)),
    ).toEqual({ state: "revoked" });
    expect(
      await service.resolveEntry(
        hashPlayerCredentialToken(replacement.issuedCredentials![0]!.token),
      ),
    ).toMatchObject({ state: "waiting" });
  });

  it("reopens seeded and newly issued QR codes across requests without replacing cards", async () => {
    const classForm = form({ classGroupId: DEMO_CLASS_IDS.THIRD_A });
    const initial = await showClassPlayerCredentialsAction(previous, classForm);
    expect(initial.ok).toBe(true);
    expect(initial.issuedCredentials).toHaveLength(3);
    expect(initial.unavailablePlayerNumbers).toEqual([]);
    const created = await allocatePlayerSlotsAction(
      previous,
      form({ classGroupId: DEMO_CLASS_IDS.THIRD_A, count: "2" }),
    );
    const reopened = await showClassPlayerCredentialsAction(
      previous,
      classForm,
    );
    expect(reopened.issuedCredentials).toHaveLength(5);
    expect(reopened.issuedCredentials!.slice(0, 3)).toEqual(
      initial.issuedCredentials,
    );
    expect(reopened.issuedCredentials!.slice(3)).toEqual(
      created.issuedCredentials,
    );
    const database = await getMockDatabase();
    expect(JSON.stringify(database.state)).not.toContain(
      reopened.issuedCredentials![0]!.token,
    );
    const service = new PlayerAccessService(
      new MockPlayerAccessStore(database),
      new SecurePlayerCredentialIssuer(),
      database.credentialCipher,
    );
    for (const credential of reopened.issuedCredentials!) {
      await expect(
        service.resolveEntry(hashPlayerCredentialToken(credential.token)),
      ).resolves.toMatchObject({ state: "waiting" });
    }
    const rotated = await rotatePlayerCredentialAction(
      previous,
      form({ playerSlotId: initial.issuedCredentials![0]!.playerSlotId }),
    );
    const afterRotation = await showClassPlayerCredentialsAction(
      previous,
      classForm,
    );
    expect(afterRotation.issuedCredentials![0]).toEqual(
      rotated.issuedCredentials![0],
    );
    expect(afterRotation.issuedCredentials!.slice(1)).toEqual(
      reopened.issuedCredentials!.slice(1),
    );
  });

  it("starts and ends sessions through shared actions", async () => {
    const data = form({ classGroupId: DEMO_CLASS_IDS.THIRD_A });
    expect(await startClassSessionAction(previous, data)).toMatchObject({
      ok: true,
    });
    expect(
      (await getPlayerAccessPageData(DEMO_CLASS_IDS.THIRD_A)).activeSession,
    ).not.toBeNull();
    expect(await startClassSessionAction(previous, data)).toMatchObject({
      ok: false,
    });
    expect(await endClassSessionAction(previous, data)).toMatchObject({
      ok: true,
    });
    expect(
      (await getPlayerAccessPageData(DEMO_CLASS_IDS.THIRD_A)).activeSession,
    ).toBeNull();
  });

  it("reports live rosters with the same class authorization as production", async () => {
    expect(
      (await getResultReportsPageData()).map((item) => item.classGroupId),
    ).toEqual([DEMO_CLASS_IDS.THIRD_A]);
    await allocatePlayerSlotsAction(
      previous,
      form({ classGroupId: DEMO_CLASS_IDS.THIRD_A, count: "1" }),
    );
    expect(await getClassResultsPageData(DEMO_CLASS_IDS.THIRD_A)).toMatchObject(
      { playerCount: 4, resultCount: 2 },
    );
    const [filtered] = await getResultReportsPageData("saude_bucal");
    expect(filtered).toMatchObject({
      playerCount: 4,
      resultCount: 1,
      totalActiveMs: 60_000,
      moduleTotals: [
        { moduleId: "saude_bucal", totalActiveMs: 60_000, resultCount: 1 },
      ],
    });
    expect(
      await getClassResultsPageData(DEMO_CLASS_IDS.THIRD_A, "saude_bucal"),
    ).toEqual(filtered);
    expect(
      await getPlayerResultsPageData(
        DEMO_CLASS_IDS.THIRD_A,
        filtered!.players[0]!.playerSlotId,
        {},
        "saude_bucal",
      ),
    ).toMatchObject({
      resultCount: 1,
      totalActiveMs: 60_000,
      moduleTotals: [
        { moduleId: "saude_bucal", totalActiveMs: 60_000, resultCount: 1 },
      ],
    });
    await expect(
      getClassResultsPageData(DEMO_CLASS_IDS.FOURTH_A),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("isolates browser workspaces and resets only the current session", async () => {
    const firstCookie = request.cookies.get(MOCK_SESSION_COOKIE)!;
    const first = await getMockDatabase();
    await switchProfile(DEMO_PROFILE_IDS.ORGANIZATION_ADMIN);
    await createClassAction(
      previous,
      form({
        name: "Private",
        organizationId: DEMO_ORGANIZATION_IDS.VICTOR_AGGENS,
      }),
    );
    request.cookies.clear();
    await startMockSession();
    const second = await getMockDatabase();
    expect(second).not.toBe(first);
    expect(second.state.classes.some((item) => item.name === "Private")).toBe(
      false,
    );
    await expect(resetMockWorkspace()).rejects.toThrow("REDIRECT:/portal");
    expect(first.state.classes.some((item) => item.name === "Private")).toBe(
      true,
    );
    await endMockSession();
    request.cookies.set(MOCK_SESSION_COOKIE, firstCookie);
    await expect(resetMockWorkspace()).rejects.toThrow("REDIRECT:/portal");
    expect(first.state.classes).toHaveLength(
      demoAdultPortalSeed.classes.length,
    );
    expect(first.state.activeProfileId).toBe(DEMO_PROFILE_IDS.TEACHER);
    expect(first.resetVersion).toBe(1);
  });

  it("rejects arbitrary profile IDs and mock access in real server mode", async () => {
    await expect(
      changeMockProfile(form({ profileId: "not-a-profile" })),
    ).rejects.toThrow("Selecione um perfil ativo.");
    vi.stubEnv("APP_RUNTIME_MODE", "server");
    await expect(getMockDatabase()).rejects.toThrow(
      "Mock persistence is unavailable",
    );
  });
});

describe("mock persistence contract", () => {
  it("serializes concurrent writes across adapters without losing roster numbers", async () => {
    const database = new MockDatabase();
    const service = new PlayerAccessService(
      new MockPlayerAccessStore(database),
      new SecurePlayerCredentialIssuer(),
      database.credentialCipher,
    );
    const allocated = await Promise.all(
      Array.from({ length: 5 }, () =>
        service.allocateSlots(
          DEMO_PROFILE_IDS.TEACHER,
          DEMO_CLASS_IDS.THIRD_A,
          1,
        ),
      ),
    );
    expect(allocated.flat().map((slot) => slot.playerNumber)).toEqual([
      4, 5, 6, 7, 8,
    ]);
    expect(database.state.playerSlots).toHaveLength(8);
  });

  it("rolls back failed transactions and leaves subsequent operations usable", async () => {
    const database = new MockDatabase();
    await expect(
      database.transaction(async (draft) => {
        draft.classes.length = 0;
        throw new Error("failed");
      }),
    ).rejects.toThrow("failed");
    expect(database.state.classes).toHaveLength(3);
    const service = new AdultPortalService(new MockAdultPortalStore(database));
    expect(
      await service.createClass(DEMO_PROFILE_IDS.ORGANIZATION_ADMIN, {
        name: "After rollback",
        organizationId: DEMO_ORGANIZATION_IDS.VICTOR_AGGENS,
      }),
    ).toMatchObject({ name: "After rollback" });
  });

  it("expires sessions, rejects unknown IDs, and bounds memory usage", () => {
    let now = 0;
    const sessions = new MockSessionRegistry(() => now, 1);
    const id = sessions.create();
    expect(sessions.get(id)).not.toBeNull();
    expect(sessions.get("unknown")).toBeNull();
    expect(() => sessions.create()).toThrow("capacity");
    now = MOCK_SESSION_TTL_SECONDS * 1000;
    expect(sessions.get(id)).toBeNull();
    expect(() => sessions.create()).not.toThrow();
  });
});
