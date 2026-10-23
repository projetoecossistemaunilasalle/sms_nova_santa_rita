import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import fixture from "../../contracts/fixtures/v2/valid/content-manifest.json";
import demoFixture from "@/server/mock/fixtures/content-manifest.json";
import { GameContentService } from "@/application/game-content/service";
import {
  canonicalJson,
  hashManifest,
  validateManifest,
} from "@/application/game-content/manifest";
import { DemoGameContentStore } from "@/server/mock/game-content-store";
import { MockDatabase } from "@/server/mock/database";
import {
  demoAdultPortalSeed,
  DEMO_PROFILE_IDS,
} from "@/server/mock/seed-store";
import { RecordStatus } from "@/generated/prisma/enums";

vi.mock("server-only", () => ({}));

const admin = DEMO_PROFILE_IDS.PLATFORM_ADMIN;

function setup() {
  const state = structuredClone(demoAdultPortalSeed);
  const store = new DemoGameContentStore(state, []);
  const bodies: Record<string, unknown> = {
    "offline-shell.json": { buildId: "game-build-1" },
    "content-manifest.json": fixture,
    "release.json": { sourceCommit: "abc123" },
  };
  const fetcher = vi.fn<typeof fetch>(async (url) => {
    const path = new URL(String(url)).pathname.split("/").at(-1)!;
    return Object.hasOwn(bodies, path)
      ? Response.json(bodies[path])
      : new Response(null, { status: 404 });
  });
  const service = new GameContentService(
    store,
    () => "https://game.example/school/index.html?launch=secret#fragment",
    fetcher,
  );
  return { state, store, bodies, fetcher, service };
}

describe("GameContentService import", () => {
  it("fetches build artifacts server-side and stores a canonical SHA-256 and provenance", async () => {
    const { service, fetcher, store } = setup();
    const imported = await service.importFromGameClient(admin);
    expect(imported).toMatchObject({
      buildId: "game-build-1",
      sourceCommit: "abc123",
      importedById: admin,
      isCurrent: false,
      payload: fixture,
    });
    expect(imported.manifestHash).toBe(
      createHash("sha256").update(canonicalJson(fixture)).digest("hex"),
    );
    expect(await store.list()).toHaveLength(1);
    expect(await service.current(admin)).toBeNull();
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      "https://game.example/school/offline-shell.json",
      "https://game.example/school/content-manifest.json",
      "https://game.example/school/release.json",
      "https://game.example/school/offline-shell.json",
    ]);
    expect(
      fetcher.mock.calls.every(
        ([, options]) =>
          options?.cache === "no-store" &&
          options.signal instanceof AbortSignal,
      ),
    ).toBe(true);
  });

  it("is idempotent by buildId, preserving the immutable original payload and provenance", async () => {
    const { service, bodies, fetcher } = setup();
    const original = await service.importFromGameClient(admin);
    bodies["content-manifest.json"] = {};
    bodies["release.json"] = { sourceCommit: "different" };
    fetcher.mockClear();
    expect(await service.importFromGameClient(admin)).toEqual(original);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await service.list(admin)).toHaveLength(1);
  });

  it("deduplicates concurrent imports of one build", async () => {
    const { service } = setup();
    const rows = await Promise.all([
      service.importFromGameClient(admin),
      service.importFromGameClient(admin),
    ]);
    expect(rows[0]).toEqual(rows[1]);
    expect(await service.list(admin)).toHaveLength(1);
  });

  it("permits an absent optional release file and records null sourceCommit", async () => {
    const { service, bodies } = setup();
    delete bodies["release.json"];
    expect((await service.importFromGameClient(admin)).sourceCommit).toBeNull();
  });

  it.each([
    ["offline-shell.json", {}],
    ["offline-shell.json", { buildId: "x".repeat(101) }],
    ["content-manifest.json", { ...fixture, manifest_version: 2 }],
    [
      "content-manifest.json",
      { ...fixture, content_version: "invalid version" },
    ],
    ["release.json", { sourceCommit: 123 }],
  ])("rejects malformed %s before persistence", async (file, value) => {
    const { service, bodies, store } = setup();
    bodies[file as string] = value;
    await expect(service.importFromGameClient(admin)).rejects.toMatchObject({
      code: "VALIDATION",
    });
    expect(await store.list()).toEqual([]);
  });

  it.each(["network", "http", "json", "oversize"])(
    "rejects %s failures without persisting",
    async (kind) => {
      const { service, fetcher, store } = setup();
      fetcher.mockImplementationOnce(async () => {
        if (kind === "network") throw new Error("offline");
        if (kind === "http") return new Response(null, { status: 503 });
        if (kind === "json") return new Response("not-json");
        return Response.json({ buildId: "x".repeat(131_073) });
      });
      await expect(service.importFromGameClient(admin)).rejects.toMatchObject({
        code: "VALIDATION",
      });
      expect(await store.list()).toEqual([]);
    },
  );

  it("rejects malformed or unavailable optional release metadata rather than hiding failure", async () => {
    const { service, fetcher } = setup();
    fetcher.mockImplementation(async (url) =>
      String(url).endsWith("release.json")
        ? new Response(null, { status: 500 })
        : Response.json(
            String(url).endsWith("offline-shell.json")
              ? { buildId: "one" }
              : fixture,
          ),
    );
    await expect(service.importFromGameClient(admin)).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });

  it("rejects a deployment that changes buildId while artifacts are being imported", async () => {
    const { service, fetcher, store } = setup();
    let reads = 0;
    fetcher.mockImplementation(async (url) =>
      Response.json(
        String(url).endsWith("offline-shell.json")
          ? { buildId: String(++reads) }
          : String(url).endsWith("release.json")
            ? {}
            : fixture,
      ),
    );
    await expect(service.importFromGameClient(admin)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(await store.list()).toEqual([]);
  });

  it("rechecks authorization after fetch and before writing", async () => {
    const { service, fetcher, state, store } = setup();
    fetcher.mockImplementation(async (url) => {
      state.profiles.find((item) => item.id === admin)!.status =
        RecordStatus.INACTIVE;
      return Response.json(
        String(url).endsWith("offline-shell.json")
          ? { buildId: "one" }
          : String(url).endsWith("release.json")
            ? {}
            : fixture,
      );
    });
    await expect(service.importFromGameClient(admin)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await store.list()).toEqual([]);
  });

  it.each([null, "file:///game", "https://user:password@game.example"])(
    "rejects missing or unsafe configured URLs",
    async (url) => {
      const { store, fetcher } = setup();
      await expect(
        new GameContentService(store, () => url, fetcher).importFromGameClient(
          admin,
        ),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it("handles a deployment base without a trailing slash", async () => {
    const { store, fetcher } = setup();
    await new GameContentService(
      store,
      () => "https://game.example/school",
      fetcher,
    ).importFromGameClient(admin);
    expect(String(fetcher.mock.calls[0]![0])).toBe(
      "https://game.example/school/offline-shell.json",
    );
  });
});

describe("content authorization and activation", () => {
  it.each(["import", "setCurrent", "current", "list"])(
    "restricts %s to an active platform admin",
    async (operation) => {
      const { service, fetcher, state } = setup();
      const invoke = (profileId: string) =>
        operation === "import"
          ? service.importFromGameClient(profileId)
          : operation === "setCurrent"
            ? service.setCurrent(profileId, "missing")
            : operation === "current"
              ? service.current(profileId)
              : service.list(profileId);
      for (const profileId of [
        "missing",
        DEMO_PROFILE_IDS.TEACHER,
        DEMO_PROFILE_IDS.ORGANIZATION_ADMIN,
      ]) {
        await expect(invoke(profileId)).rejects.toMatchObject({
          code: "FORBIDDEN",
        });
      }
      state.profiles.find((item) => item.id === admin)!.status =
        RecordStatus.INACTIVE;
      await expect(invoke(admin)).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it("switches current atomically, preserves payload and rejects nonexistent targets", async () => {
    const { service, bodies } = setup();
    const first = await service.importFromGameClient(admin);
    await service.setCurrent(admin, first.id);
    bodies["offline-shell.json"] = { buildId: "game-build-2" };
    const second = await service.importFromGameClient(admin);
    expect((await service.current(admin))?.id).toBe(first.id);
    await service.setCurrent(admin, second.id);
    const current = await service.current(admin);
    expect(current).toEqual({ ...second, isCurrent: true });
    expect(
      (await service.list(admin)).filter((item) => item.isCurrent),
    ).toHaveLength(1);
    await expect(service.setCurrent(admin, "missing")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await service.current(admin)).toEqual(current);
    expect(await service.setCurrent(admin, second.id)).toEqual(current);
    expect(
      service.resolvePolicy(null, second.payload).enabled_mission_ids,
    ).toHaveLength(fixture.missions.length);
  });
});

describe("manifest validation and demo storage", () => {
  it("canonicalizes nested object keys, not array order", () => {
    expect(canonicalJson({ z: [{ b: 2, a: 1 }], a: true })).toBe(
      '{"a":true,"z":[{"a":1,"b":2}]}',
    );
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
    const manifest = validateManifest(fixture);
    expect(
      hashManifest({
        ...manifest,
        modules: manifest.modules.map((item) => ({
          mission_ids: item.mission_ids,
          order: item.order,
          summary: item.summary,
          title: item.title,
          module_id: item.module_id,
        })),
      }),
    ).toBe(hashManifest(manifest));
  });

  it.each(["duplicate", "unknown", "default"])(
    "rejects semantic manifest errors: %s",
    (kind) => {
      const manifest = structuredClone(fixture);
      if (kind === "duplicate") manifest.modules.push(manifest.modules[0]!);
      if (kind === "unknown") manifest.missions[0]!.module_id = "unknown";
      if (kind === "default")
        manifest.activities[0]!.presets[0]!.default = false;
      expect(() => validateManifest(manifest)).toThrow(
        expect.objectContaining({ code: "VALIDATION" }),
      );
    },
  );

  it("uses the committed fixture, isolates browser workspaces, clones reads and resets", async () => {
    expect(demoFixture).toEqual(fixture);
    const left = new MockDatabase();
    const right = new MockDatabase();
    const original = (await left.gameContentStore.current())!;
    expect(original.payload).toEqual(fixture);
    original.payload.missions.pop();
    expect((await left.gameContentStore.current())!.payload).toEqual(fixture);
    const input = (await left.gameContentStore.current())!;
    const imported = await left.gameContentStore.transaction((tx) =>
      tx.importManifest({ ...input, buildId: "new" }),
    );
    await left.gameContentStore.transaction((tx) => tx.setCurrent(imported.id));
    expect((await right.gameContentStore.current())?.buildId).toBe(
      "demo-v2-fixture",
    );
    await left.reset();
    expect(await left.gameContentStore.list()).toHaveLength(1);
    expect((await left.gameContentStore.current())?.buildId).toBe(
      "demo-v2-fixture",
    );
  });

  it("shares the workspace transaction queue with authorization changes", async () => {
    const database = new MockDatabase();
    const service = new GameContentService(
      database.gameContentStore,
      () => null,
    );
    const current = (await database.gameContentStore.current())!;
    const revoke = database.transaction(async (draft) => {
      await Promise.resolve();
      draft.profiles.find((item) => item.id === admin)!.status =
        RecordStatus.INACTIVE;
    });
    const activate = service.setCurrent(admin, current.id);
    await revoke;
    await expect(activate).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await database.gameContentStore.current()).toEqual(current);
  });

  it("does not publish uncommitted or failed demo transactions", async () => {
    const { store } = setup();
    await expect(
      store.transaction(async (tx) => {
        const payload = validateManifest(fixture);
        await tx.importManifest({
          payload,
          contentVersion: payload.content_version,
          buildId: "rollback",
          sourceCommit: null,
          manifestHash: hashManifest(payload),
          importedById: admin,
        });
        expect(await store.list()).toEqual([]);
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(await store.list()).toEqual([]);
  });
});
