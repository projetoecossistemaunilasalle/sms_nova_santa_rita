import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getPlayerAccessService: vi.fn(),
  getGameContentService: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/server/auth/gateway", () => ({
  getAuthGateway: () => ({ getSession: mocks.getSession }),
}));
vi.mock("@/server/services/player-access-container", () => ({
  getPlayerAccessService: mocks.getPlayerAccessService,
}));
vi.mock("@/server/services/game-content-container", () => ({
  getGameContentService: mocks.getGameContentService,
}));

import {
  setClassDefaultContentAction,
  startClassSessionAction,
} from "@/app/(professional)/portal/player-access-actions";
import {
  importGameManifestAction,
  setCurrentGameManifestAction,
} from "@/app/(professional)/portal/game-content-actions";
import { PlayerAccessService } from "@/application/player-access/service";
import { GameContentService } from "@/application/game-content/service";
import { classSessionSchema } from "@/application/player-access/schemas";
import type { PlayerAccessTransaction } from "@/application/player-access/ports";
import { MockDatabase, MockPlayerAccessStore } from "@/server/mock/database";
import { DEMO_CLASS_IDS, DEMO_PROFILE_IDS } from "@/server/mock/seed-store";
import { demoGameContentSeed } from "@/server/mock/content-seed";

const classGroupId = DEMO_CLASS_IDS.THIRD_A;
const previous = { ok: false, message: "" };
const dental = { enabled_module_ids: ["saude_bucal"] };
let database: MockDatabase;
let service: PlayerAccessService;
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;

function form(values: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function actor(profileId: string | null) {
  mocks.getSession.mockResolvedValue(
    profileId ? { actor: { profileId } } : null,
  );
}

function currentDefault() {
  return database.state.classes.find((row) => row.id === classGroupId)
    ?.defaultContentSelection;
}

beforeEach(() => {
  vi.clearAllMocks();
  database = new MockDatabase();
  service = new PlayerAccessService(
    new MockPlayerAccessStore(database),
    { issue: () => ({ token: "unused", tokenHash: "unused" }) },
    database.credentialCipher,
  );
  fetcher = vi.fn<typeof fetch>(async (url) => {
    const name = new URL(String(url)).pathname.split("/").at(-1);
    if (name === "offline-shell.json")
      return Response.json({ buildId: "imported-build" });
    if (name === "content-manifest.json")
      return Response.json(demoGameContentSeed()[0]!.payload);
    return new Response(null, { status: 404 });
  });
  mocks.getPlayerAccessService.mockResolvedValue(service);
  mocks.getGameContentService.mockResolvedValue(
    new GameContentService(
      database.gameContentStore,
      () => "https://game.example/index.html",
      fetcher,
    ),
  );
  actor(DEMO_PROFILE_IDS.TEACHER);
});

describe("class content actions", () => {
  it("keeps one-click start using the class default without editing it", async () => {
    await service.setClassDefaultContent(
      DEMO_PROFILE_IDS.TEACHER,
      classGroupId,
      dental,
    );
    const start = vi.spyOn(service, "startSession");
    expect(
      await startClassSessionAction(previous, form({ classGroupId })),
    ).toMatchObject({ ok: true });
    expect(start).toHaveBeenCalledWith(
      DEMO_PROFILE_IDS.TEACHER,
      classGroupId,
      undefined,
      false,
    );
    expect(
      database.state.gameSessions.at(-1)?.contentPolicy?.enabled_mission_ids,
    ).toEqual(["brushing_teeth", "smile_kit"]);
    expect(currentDefault()).toEqual(dental);
  });

  it("accepts modules, missions, presets and options and saves the explicit choice", async () => {
    const selection = {
      ...dental,
      enabled_mission_ids: ["lia_memory"],
      activity_presets: { lia_memory: "padrao" },
      options: {},
    };
    const result = await startClassSessionAction(
      previous,
      form({
        classGroupId,
        selection: JSON.stringify(selection),
        saveAsClassDefault: "on",
      }),
    );
    expect(result.ok).toBe(true);
    expect(currentDefault()).toEqual(selection);
    expect(database.state.gameSessions.at(-1)?.contentPolicy).toMatchObject({
      enabled_module_ids: ["saude_bucal"],
      enabled_mission_ids: ["lia_memory", "brushing_teeth", "smile_kit"],
      activity_presets: { lia_memory: "padrao" },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/portal/turmas/${classGroupId}`,
    );
  });

  it("does not save a one-off choice unless requested", async () => {
    expect(
      (
        await startClassSessionAction(
          previous,
          form({
            classGroupId,
            selection: JSON.stringify(dental),
            saveAsClassDefault: "false",
          }),
        )
      ).ok,
    ).toBe(true);
    expect(currentDefault()).toBeUndefined();
  });

  it("rolls back saving the default if session creation fails", async () => {
    const store = new MockPlayerAccessStore(database);
    const transaction = store.transaction.bind(store);
    vi.spyOn(store, "transaction").mockImplementation(
      <T>(work: (tx: PlayerAccessTransaction) => Promise<T>) =>
        transaction(async (tx) => {
          tx.createSession = async () => {
            throw new Error("Failed to create session");
          };
          return work(tx);
        }),
    );
    const failing = new PlayerAccessService(
      store,
      { issue: () => ({ token: "unused", tokenHash: "unused" }) },
      database.credentialCipher,
    );
    mocks.getPlayerAccessService.mockResolvedValue(failing);
    expect(
      (
        await startClassSessionAction(
          previous,
          form({
            classGroupId,
            selection: JSON.stringify(dental),
            saveAsClassDefault: "on",
          }),
        )
      ).ok,
    ).toBe(false);
    expect(currentDefault()).toBeUndefined();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("allows the class's organization administrator to update its default", async () => {
    actor(DEMO_PROFILE_IDS.ORGANIZATION_ADMIN);
    expect(
      (
        await setClassDefaultContentAction(
          previous,
          form({
            classGroupId,
            selection: JSON.stringify(dental),
          }),
        )
      ).ok,
    ).toBe(true);
    expect(currentDefault()).toEqual(dental);
  });

  it("can save or clear the class default; explicit null starts all content", async () => {
    expect(
      (
        await setClassDefaultContentAction(
          previous,
          form({ classGroupId, selection: JSON.stringify(dental) }),
        )
      ).ok,
    ).toBe(true);
    expect(currentDefault()).toEqual(dental);
    expect(
      (
        await startClassSessionAction(
          previous,
          form({ classGroupId, selection: "null", saveAsClassDefault: "true" }),
        )
      ).ok,
    ).toBe(true);
    expect(currentDefault()).toBeNull();
    expect(
      database.state.gameSessions.at(-1)?.contentPolicy?.enabled_mission_ids,
    ).toHaveLength(6);
    expect(
      (
        await setClassDefaultContentAction(
          previous,
          form({ classGroupId, selection: "null" }),
        )
      ).ok,
    ).toBe(true);
  });

  it.each([
    {},
    { enabled_module_ids: [], enabled_mission_ids: [] },
    { options: {} },
  ])("rejects empty selections with PT-BR feedback: %j", async (selection) => {
    for (const action of [
      startClassSessionAction,
      setClassDefaultContentAction,
    ]) {
      expect(
        await action(
          previous,
          form({ classGroupId, selection: JSON.stringify(selection) }),
        ),
      ).toMatchObject({
        ok: false,
        message: "Selecione ao menos uma missão.",
        fieldErrors: { selection: ["Selecione ao menos uma missão."] },
      });
    }
    expect(mocks.getPlayerAccessService).not.toHaveBeenCalled();
  });

  it.each([
    "not-json",
    "[]",
    "false",
    '"null"',
    JSON.stringify({ enabled_module_ids: [1] }),
    JSON.stringify({ enabled_mission_ids: ["lia_memory", "lia_memory"] }),
    JSON.stringify({ ...dental, activity_presets: [] }),
    JSON.stringify({ ...dental, options: { skin_shop: 1 } }),
    JSON.stringify({ ...dental, policy_version: 1 }),
  ])(
    "rejects malformed selection %s before service calls",
    async (selection) => {
      expect(
        (
          await startClassSessionAction(
            previous,
            form({ classGroupId, selection }),
          )
        ).ok,
      ).toBe(false);
      expect(mocks.getPlayerAccessService).not.toHaveBeenCalled();
    },
  );

  it("requires an explicit default value and a valid save flag", async () => {
    expect(
      (await setClassDefaultContentAction(previous, form({ classGroupId }))).ok,
    ).toBe(false);
    expect(
      classSessionSchema.safeParse({ classGroupId, saveAsClassDefault: "yes" })
        .success,
    ).toBe(false);
    expect(
      classSessionSchema.safeParse({ classGroupId, saveAsClassDefault: "on" })
        .success,
    ).toBe(false);
    expect(classSessionSchema.safeParse({ classGroupId: "" }).success).toBe(
      false,
    );
  });

  it.each([
    { enabled_module_ids: ["unknown"] },
    { ...dental, activity_presets: { brushing_teeth_practice: "unknown" } },
    { ...dental, options: { unknown: true } },
  ])(
    "delegates manifest validation and never saves invalid choices: %j",
    async (selection) => {
      const before = database.state.gameSessions.length;
      expect(
        (
          await startClassSessionAction(
            previous,
            form({
              classGroupId,
              selection: JSON.stringify(selection),
              saveAsClassDefault: "on",
            }),
          )
        ).ok,
      ).toBe(false);
      expect(currentDefault()).toBeUndefined();
      expect(database.state.gameSessions).toHaveLength(before);
    },
  );

  it("does not edit the default when starting conflicts with an active session", async () => {
    await service.startSession(DEMO_PROFILE_IDS.TEACHER, classGroupId);
    expect(
      (
        await startClassSessionAction(
          previous,
          form({
            classGroupId,
            selection: JSON.stringify(dental),
            saveAsClassDefault: "on",
          }),
        )
      ).ok,
    ).toBe(false);
    expect(currentDefault()).toBeUndefined();
  });

  it("denies a teacher editing or starting another class, including save-as-default", async () => {
    for (const action of [
      setClassDefaultContentAction,
      startClassSessionAction,
    ]) {
      expect(
        (
          await action(
            previous,
            form({
              classGroupId: DEMO_CLASS_IDS.FIFTH_B,
              selection: JSON.stringify(dental),
              saveAsClassDefault: "on",
            }),
          )
        ).ok,
      ).toBe(false);
    }
    expect(
      database.state.classes.find((row) => row.id === DEMO_CLASS_IDS.FIFTH_B)
        ?.defaultContentSelection,
    ).toBeUndefined();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("denies unauthenticated mutations", async () => {
    actor(null);
    for (const action of [
      startClassSessionAction,
      setClassDefaultContentAction,
    ]) {
      expect(
        await action(previous, form({ classGroupId, selection: "null" })),
      ).toMatchObject({ ok: false, message: "Sessão expirada." });
    }
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("manifest admin actions", () => {
  it.each([DEMO_PROFILE_IDS.TEACHER, DEMO_PROFILE_IDS.ORGANIZATION_ADMIN])(
    "denies import and set current for non-platform-admin %s",
    async (profileId) => {
      actor(profileId);
      expect((await importGameManifestAction(previous, form())).ok).toBe(false);
      expect(
        (
          await setCurrentGameManifestAction(
            previous,
            form({ manifestId: demoGameContentSeed()[0]!.id }),
          )
        ).ok,
      ).toBe(false);
      expect(fetcher).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("imports only from the configured game and sets current separately", async () => {
    actor(DEMO_PROFILE_IDS.PLATFORM_ADMIN);
    expect(
      (
        await importGameManifestAction(
          previous,
          form({ url: "https://untrusted.example" }),
        )
      ).ok,
    ).toBe(true);
    const imported = (await database.gameContentStore.list()).find(
      (row) => row.buildId === "imported-build",
    )!;
    expect(imported.isCurrent).toBe(false);
    expect(
      fetcher.mock.calls.every(
        ([url]) => new URL(String(url)).origin === "https://game.example",
      ),
    ).toBe(true);
    expect(
      (
        await setCurrentGameManifestAction(
          previous,
          form({ manifestId: imported.id }),
        )
      ).ok,
    ).toBe(true);
    expect((await database.gameContentStore.current())?.id).toBe(imported.id);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/portal", "layout");
  });

  it("validates manifest ids and handles unknown ids without revalidation", async () => {
    actor(DEMO_PROFILE_IDS.PLATFORM_ADMIN);
    expect(
      await setCurrentGameManifestAction(previous, form({ manifestId: "" })),
    ).toMatchObject({ ok: false, fieldErrors: expect.any(Object) });
    expect(mocks.getGameContentService).not.toHaveBeenCalled();
    expect(
      (
        await setCurrentGameManifestAction(
          previous,
          form({ manifestId: "missing" }),
        )
      ).ok,
    ).toBe(false);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated imports and set-current requests", async () => {
    actor(null);
    for (const action of [
      importGameManifestAction,
      setCurrentGameManifestAction,
    ]) {
      expect(await action(previous, form({ manifestId: "manifest" }))).toEqual({
        ok: false,
        message: "Sessão expirada.",
      });
    }
    expect(mocks.getGameContentService).not.toHaveBeenCalled();
  });
});
