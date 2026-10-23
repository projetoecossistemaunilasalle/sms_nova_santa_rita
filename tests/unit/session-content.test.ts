import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PlayerAccessService } from "@/application/player-access/service";
import { resolvePolicy } from "@/application/game-content/policy";
import { MockDatabase, MockPlayerAccessStore } from "@/server/mock/database";
import {
  DemoPlayerAccessStore,
  DEMO_CLASS_IDS,
  DEMO_PROFILE_IDS,
  demoAdultPortalSeed,
} from "@/server/mock/seed-store";
import { GameStateService } from "@/application/game-state/service";
import { PrismaGameStateStore } from "@/server/db/prisma-game-state-store";
import { PlayerCredentialStatus, RecordStatus } from "@/generated/prisma/enums";

const teacher = DEMO_PROFILE_IDS.TEACHER;
const classId = DEMO_CLASS_IDS.THIRD_A;

function setup() {
  const database = new MockDatabase();
  const service = new PlayerAccessService(
    new MockPlayerAccessStore(database),
    { issue: () => ({ token: "unused", tokenHash: "unused" }) },
    database.credentialCipher,
  );
  return { database, service };
}

describe("session content freezing", () => {
  it("starts demo sessions with every mission from the current fixture by default", async () => {
    const { database, service } = setup();
    const manifest = (await database.gameContentStore.current())!;
    const session = await service.startSession(teacher, classId);
    expect(session.contentManifestId).toBe(manifest.id);
    expect(session.startedById).toBe(teacher);
    expect(session.contentPolicy).toEqual(
      resolvePolicy(null, manifest.payload),
    );
    expect(session.contentPolicy.enabled_mission_ids).toEqual(
      manifest.payload.missions.map((mission) => mission.mission_id),
    );
    expect(
      database.state.gameSessions.find((row) => row.id === session.id)
        ?.contentPolicy,
    ).toEqual(session.contentPolicy);
  });

  it("resolves class defaults afresh but never changes an existing session's policy or manifest", async () => {
    const { database, service } = setup();
    const originalManifest = (await database.gameContentStore.current())!;
    await service.setClassDefaultContent(teacher, classId, {
      enabled_module_ids: ["saude_bucal"],
    });
    const session = await service.startSession(teacher, classId);
    const frozen = structuredClone(session.contentPolicy);
    expect(frozen.enabled_mission_ids).toEqual(["brushing_teeth", "smile_kit"]);
    await service.setClassDefaultContent(teacher, classId, {
      enabled_mission_ids: ["lia_memory"],
    });
    const nextManifest = await database.gameContentStore.transaction((tx) =>
      tx.importManifest({
        ...originalManifest,
        buildId: "later-build",
        contentVersion: "later_version",
        payload: {
          ...originalManifest.payload,
          content_version: "later_version",
        },
      }),
    );
    await database.gameContentStore.transaction((tx) =>
      tx.setCurrent(nextManifest.id),
    );
    const row = database.state.gameSessions.find(
      (item) => item.id === session.id,
    )!;
    expect(row.contentPolicy).toEqual(frozen);
    expect(row.contentManifestId).toBe(originalManifest.id);
    session.contentPolicy.enabled_mission_ids.pop();
    expect(row.contentPolicy).toEqual(frozen);
    await service.endSession(teacher, classId);
    const later = await service.startSession(teacher, classId);
    expect(later.contentManifestId).toBe(nextManifest.id);
    expect(later.contentPolicy.enabled_mission_ids).toEqual(["lia_memory"]);
    expect(later.contentPolicy.authored_content_version).toBe("later_version");
  });

  it("prefers an explicit selection over the class default, and explicit null means everything", async () => {
    const { database, service } = setup();
    await service.setClassDefaultContent(teacher, classId, {
      enabled_module_ids: ["saude_bucal"],
    });
    const selection = { enabled_mission_ids: ["lia_memory"] };
    const session = await service.startSession(teacher, classId, selection);
    selection.enabled_mission_ids.push("smile_kit");
    expect(session.contentPolicy.enabled_mission_ids).toEqual(["lia_memory"]);
    await service.endSession(teacher, classId);
    const all = await service.startSession(teacher, classId, null);
    expect(all.contentPolicy).toEqual(
      resolvePolicy(null, (await database.gameContentStore.current())!.payload),
    );
  });

  it("fails clearly without a manifest and does not create a session", async () => {
    const store = new DemoPlayerAccessStore(
      structuredClone(demoAdultPortalSeed),
      async () => null,
    );
    const service = new PlayerAccessService(
      store,
      { issue: () => ({ token: "unused", tokenHash: "unused" }) },
      { encrypt: () => "unused", decrypt: () => "unused" },
    );
    const before = store.state.gameSessions.length;
    await expect(service.startSession(teacher, classId)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Nenhuma versão do jogo importada",
    });
    expect(store.state.gameSessions).toHaveLength(before);
  });

  it("allows assigned professionals and same-organization administrators to edit or clear defaults", async () => {
    const { database, service } = setup();
    const selection = { enabled_mission_ids: ["lia_memory"] };
    await service.setClassDefaultContent(teacher, classId, selection);
    selection.enabled_mission_ids.push("smile_kit");
    expect(
      database.state.classes.find((row) => row.id === classId)
        ?.defaultContentSelection,
    ).toEqual({ enabled_mission_ids: ["lia_memory"] });
    await service.setClassDefaultContent(
      DEMO_PROFILE_IDS.ORGANIZATION_ADMIN,
      classId,
      null,
    );
    expect(
      database.state.classes.find((row) => row.id === classId)
        ?.defaultContentSelection,
    ).toBeNull();
    await expect(
      service.setClassDefaultContent(teacher, classId, {}),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("denies unassigned, foreign-organization, inactive and platform-only actors without changing defaults", async () => {
    const { database, service } = setup();
    for (const profile of [
      DEMO_PROFILE_IDS.SECOND_TEACHER,
      DEMO_PROFILE_IDS.PLATFORM_ADMIN,
    ]) {
      await expect(
        service.setClassDefaultContent(profile, classId, null),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(
      service.setClassDefaultContent(
        DEMO_PROFILE_IDS.ORGANIZATION_ADMIN,
        DEMO_CLASS_IDS.FOURTH_A,
        null,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      service.setClassDefaultContent(teacher, DEMO_CLASS_IDS.FIFTH_B, null),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    database.state.profiles.find((row) => row.id === teacher)!.status =
      RecordStatus.INACTIVE;
    await expect(
      service.setClassDefaultContent(teacher, classId, null),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(
      database.state.classes.find((row) => row.id === classId)
        ?.defaultContentSelection,
    ).toBeUndefined();
  });

  it("bootstraps the exact policy stored on the participation's session row", async () => {
    const { database, service } = setup();
    const session = await service.startSession(teacher, classId, {
      enabled_mission_ids: ["lia_memory"],
    });
    const row = database.state.gameSessions.find(
      (item) => item.id === session.id,
    )!;
    await service.setClassDefaultContent(teacher, classId, {
      enabled_module_ids: ["saude_bucal"],
    });
    const context = {
      playerSlotId: "player",
      gameSessionId: row.id,
      participationId: "participation",
      credentialId: "credential",
    };
    const db = {
      $queryRaw: vi.fn(async () => [{ id: "locked" }]),
      participation: {
        findUnique: vi.fn(async () => ({
          playerSlotId: context.playerSlotId,
          gameSessionId: row.id,
          gameSession: {
            ...row,
            contentPolicy: structuredClone(row.contentPolicy),
          },
          playerSlot: {
            status: RecordStatus.ACTIVE,
            classGroupId: classId,
            classGroup: {
              status: RecordStatus.ACTIVE,
              organization: { status: RecordStatus.ACTIVE },
            },
          },
        })),
      },
      playerCredential: {
        findUnique: vi.fn(async () => ({
          playerSlotId: context.playerSlotId,
          status: PlayerCredentialStatus.ACTIVE,
        })),
      },
      gameState: { findUnique: vi.fn(async () => null) },
      $transaction: async <T>(work: (client: unknown) => Promise<T>) =>
        work(db),
    };
    const state = new GameStateService(
      new PrismaGameStateStore(db as never),
      () => ({ valid: true, payload: context }),
    );
    expect(await state.bootstrap("launch", "bootstrap")).toMatchObject({
      type: "portal.bootstrap.v2",
      content_policy: row.contentPolicy,
      stored_content_version: null,
    });
  });
});
