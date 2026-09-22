import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlayerCredentialIssuer } from "@/application/player-access/ports";
import { PlayerAccessService } from "@/application/player-access/service";
import { RecordStatus } from "@/generated/prisma/enums";
import {
  DEMO_ADULT_PORTAL_STORAGE_KEY,
  DEMO_CLASS_IDS,
  DEMO_ORGANIZATION_IDS,
  DEMO_PLAYER_TOKENS,
  DEMO_PROFILE_IDS,
  DemoPlayerAccessStore,
  demoAdultPortalSeed,
  readDemoAdultPortalState,
  writeDemoAdultPortalState,
} from "@/runtime/adult-portal-demo-store";
import {
  rotatePlayerCredentialAction,
  startClassSessionAction,
} from "@/runtime/player-access-demo-actions";
import { resolvePlayerEntryAction } from "@/runtime/player-entry-demo-actions";

class SequenceIssuer implements PlayerCredentialIssuer {
  private next = 0;

  issue() {
    this.next += 1;
    const token = `demo_player_test_${String(this.next).padStart(4, "0")}`;
    return { token, tokenHash: token };
  }
}

function state() {
  const value = structuredClone(demoAdultPortalSeed);
  value.activeProfileId = DEMO_PROFILE_IDS.TEACHER;
  return value;
}

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("demo player access", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal(
      "CustomEvent",
      class {
        constructor(readonly type: string) {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps a versioned browser seed with visible demo credentials", () => {
    expect(demoAdultPortalSeed.version).toBe(2);
    expect(
      demoAdultPortalSeed.playerCredentials.every(({ token }) =>
        token.startsWith("demo_player_"),
      ),
    ).toBe(true);
    expect(DEMO_ADULT_PORTAL_STORAGE_KEY).toContain(":v2");
  });

  it("allocates monotonically after a previously used number disappears", async () => {
    const demo = state();
    demo.playerSlots = demo.playerSlots.filter(
      (slot) => slot.playerNumber !== 3,
    );
    const service = new PlayerAccessService(
      new DemoPlayerAccessStore(demo),
      new SequenceIssuer(),
    );

    const slots = await service.allocateSlots(
      DEMO_PROFILE_IDS.TEACHER,
      DEMO_CLASS_IDS.THIRD_A,
      2,
    );

    expect(slots.map((slot) => slot.playerNumber)).toEqual([4, 5]);
    expect(
      slots.every((slot) => slot.credential.startsWith("demo_player_")),
    ).toBe(true);
  });

  it("applies inactive organization denial through the shared service", async () => {
    const demo = state();
    demo.organizations.find(
      (organization) => organization.id === DEMO_ORGANIZATION_IDS.VICTOR_AGGENS,
    )!.status = RecordStatus.INACTIVE;
    const service = new PlayerAccessService(
      new DemoPlayerAccessStore(demo),
      new SequenceIssuer(),
    );

    await expect(
      service.startSession(DEMO_PROFILE_IDS.TEACHER, DEMO_CLASS_IDS.THIRD_A),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("preserves revoked tombstones and resolves waiting versus ready idempotently", async () => {
    writeDemoAdultPortalState(state());

    await expect(
      resolvePlayerEntryAction(DEMO_PLAYER_TOKENS.THIRD_A_PLAYER_02_REVOKED),
    ).resolves.toEqual({ state: "revoked" });
    await expect(
      resolvePlayerEntryAction(DEMO_PLAYER_TOKENS.THIRD_A_PLAYER_01),
    ).resolves.toMatchObject({ state: "waiting", playerNumber: 1 });

    const started = await startClassSessionAction(
      { ok: false, message: "" },
      form({ classGroupId: DEMO_CLASS_IDS.THIRD_A }),
    );
    expect(started.ok).toBe(true);

    const first = await resolvePlayerEntryAction(
      DEMO_PLAYER_TOKENS.THIRD_A_PLAYER_01,
    );
    const second = await resolvePlayerEntryAction(
      DEMO_PLAYER_TOKENS.THIRD_A_PLAYER_01,
    );
    expect(first).toMatchObject({ state: "ready", playerNumber: 1 });
    expect(second).toMatchObject({
      state: "ready",
      participationId:
        first.state === "ready" ? first.participationId : "unreachable",
    });
    expect(readDemoAdultPortalState().participations).toHaveLength(2);
  });

  it("rotates a demo credential and rejects the previous token", async () => {
    writeDemoAdultPortalState(state());
    const result = await rotatePlayerCredentialAction(
      { ok: false, message: "" },
      form({ playerSlotId: "demo-player-third-a-01" }),
    );
    expect(result.ok).toBe(true);
    const replacement = result.issuedCredentials?.[0]?.token;
    expect(replacement).toMatch(/^demo_player_/);
    await expect(
      resolvePlayerEntryAction(DEMO_PLAYER_TOKENS.THIRD_A_PLAYER_01),
    ).resolves.toEqual({ state: "revoked" });
    await expect(resolvePlayerEntryAction(replacement!)).resolves.toMatchObject(
      { state: "waiting", playerNumber: 1 },
    );
  });
});
