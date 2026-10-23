import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getPlayerAccessService: vi.fn(),
  getGameContentService: vi.fn(),
  connection: vi.fn(),
  redirect: vi.fn((path: string): never => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: mocks.connection }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
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
  getClassContentPageData,
  getGameManifestsPageData,
} from "@/runtime/game-content-server";
import { PlayerAccessService } from "@/application/player-access/service";
import { GameContentService } from "@/application/game-content/service";
import { MockDatabase, MockPlayerAccessStore } from "@/server/mock/database";
import {
  DemoPlayerAccessStore,
  DEMO_CLASS_IDS,
  DEMO_PROFILE_IDS,
  demoAdultPortalSeed,
} from "@/server/mock/seed-store";
import { hashManifest } from "@/application/game-content/manifest";

let database: MockDatabase;
let service: PlayerAccessService;
const teacher = DEMO_PROFILE_IDS.TEACHER;
const classId = DEMO_CLASS_IDS.THIRD_A;

function playerService(store: MockPlayerAccessStore | DemoPlayerAccessStore) {
  return new PlayerAccessService(
    store,
    { issue: () => ({ token: "unused", tokenHash: "unused" }) },
    { encrypt: () => "unused", decrypt: () => "unused" },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  database = new MockDatabase();
  service = playerService(new MockPlayerAccessStore(database));
  mocks.getPlayerAccessService.mockResolvedValue(service);
  mocks.getGameContentService.mockResolvedValue(
    new GameContentService(database.gameContentStore, () => null),
  );
  mocks.getSession.mockResolvedValue({ actor: { profileId: teacher } });
});

describe("game content readers", () => {
  it("provides the current picker catalog and the class's unexpanded default selection", async () => {
    const selection = { enabled_mission_ids: ["smile_kit"] };
    await service.setClassDefaultContent(teacher, classId, selection);
    const data = await getClassContentPageData(classId);
    expect(mocks.connection).toHaveBeenCalled();
    expect(data.defaultSelection).toEqual(selection);
    expect(data.manifest?.session_options).toEqual([]);
    expect(
      data.modules.map((module) => [module.module_id, module.missionCount]),
    ).toEqual([
      ["convivencia", 4],
      ["saude_bucal", 2],
    ]);
    expect(data.modules[1]!.missions[0]!.activities[0]!.presets).toEqual([
      { preset_id: "padrao", label: "Padrão", default: true },
    ]);
    expect(data.activeSession).toBeNull();
  });

  it("uses the frozen session manifest for chips after a new version becomes current", async () => {
    const session = await service.startSession(teacher, classId, {
      enabled_mission_ids: ["smile_kit"],
    });
    const original = (await database.gameContentStore.current())!;
    const payload = structuredClone(original.payload);
    payload.content_version = "later_version";
    payload.modules.find(
      (module) => module.module_id === "saude_bucal",
    )!.title = "Título alterado";
    const next = await database.gameContentStore.transaction((tx) =>
      tx.importManifest({
        contentVersion: payload.content_version,
        payload,
        buildId: "later-build",
        sourceCommit: null,
        manifestHash: hashManifest(payload),
        importedById: null,
      }),
    );
    await database.gameContentStore.transaction((tx) => tx.setCurrent(next.id));
    await service.setClassDefaultContent(teacher, classId, {
      enabled_module_ids: ["convivencia"],
    });
    const data = await getClassContentPageData(classId);
    expect(data.manifestId).toBe(next.id);
    expect(data.modules[1]!.title).toBe("Título alterado");
    expect(data.defaultSelection).toEqual({
      enabled_module_ids: ["convivencia"],
    });
    expect(data.activeSession).toEqual({
      id: session.id,
      contentManifestId: original.id,
      policy: session.contentPolicy,
      chips: [{ id: "saude_bucal", label: "Saúde bucal", missionCount: 1 }],
    });
  });

  it("does not disclose another class's content/defaults to a teacher", async () => {
    await expect(
      getClassContentPageData(DEMO_CLASS_IDS.FIFTH_B),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns a useful empty picker when no current manifest is available", async () => {
    mocks.getPlayerAccessService.mockResolvedValue(
      playerService(
        new DemoPlayerAccessStore(
          structuredClone(demoAdultPortalSeed),
          async () => null,
        ),
      ),
    );
    expect(await getClassContentPageData(classId)).toEqual({
      manifest: null,
      manifestId: null,
      modules: [],
      defaultSelection: null,
      activeSession: null,
    });
  });

  it("fails safely instead of relabelling a session with a missing frozen manifest", async () => {
    const store = new MockPlayerAccessStore(database);
    const contentService = playerService(store);
    await contentService.startSession(teacher, classId);
    const find = vi
      .spyOn(database.gameContentStore, "list")
      .mockResolvedValue([]);
    mocks.getPlayerAccessService.mockResolvedValue(contentService);
    await expect(getClassContentPageData(classId)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    find.mockRestore();
  });

  it("lists only admin-facing metadata, exclusively for platform administrators", async () => {
    for (const profileId of [teacher, DEMO_PROFILE_IDS.ORGANIZATION_ADMIN]) {
      mocks.getSession.mockResolvedValue({ actor: { profileId } });
      await expect(getGameManifestsPageData()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
    mocks.getSession.mockResolvedValue({
      actor: { profileId: DEMO_PROFILE_IDS.PLATFORM_ADMIN },
    });
    const data = await getGameManifestsPageData();
    expect(data.manifests).toHaveLength(1);
    expect(data.manifests[0]).toMatchObject({
      contentVersion: "heroes_trial_school_2026_10",
      buildId: "demo-v2-fixture",
      sourceCommit: null,
      isCurrent: true,
      importedAt: expect.any(Date),
    });
    expect(data.manifests[0]).not.toHaveProperty("payload");
    expect(data.manifests[0]).not.toHaveProperty("importedById");
  });

  it("redirects unauthenticated readers before service lookup", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(getClassContentPageData(classId)).rejects.toThrow(
      "redirect:/entrar",
    );
    await expect(getGameManifestsPageData()).rejects.toThrow(
      "redirect:/entrar",
    );
    expect(mocks.getPlayerAccessService).not.toHaveBeenCalled();
    expect(mocks.getGameContentService).not.toHaveBeenCalled();
  });
});
