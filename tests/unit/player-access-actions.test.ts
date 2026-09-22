import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  allocateSlots: vi.fn(),
  rotateCredential: vi.fn(),
  startSession: vi.fn(),
  endSession: vi.fn(),
  resolveEntry: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/server/auth/gateway", () => ({
  getAuthGateway: () => ({ getSession: mocks.getSession }),
}));
vi.mock("@/server/services/player-access-container", () => ({
  getPlayerAccessService: () => ({
    allocateSlots: mocks.allocateSlots,
    rotateCredential: mocks.rotateCredential,
    startSession: mocks.startSession,
    endSession: mocks.endSession,
    resolveEntry: mocks.resolveEntry,
  }),
}));
vi.mock("@/server/config/env", () => ({
  getServerRuntimeEnv: () => ({
    APPLICATION_SECRET: "test-secret-with-at-least-thirty-two-characters",
  }),
}));

import {
  allocatePlayerSlotsAction,
  startClassSessionAction,
} from "@/app/(professional)/portal/player-access-actions";
import { resolvePlayerEntryAction } from "@/app/(public-play)/jogar/actions";
import { verifyLaunchToken } from "@/server/security/launch-token";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const previous = { ok: false, message: "" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({
    actor: { profileId: "profile-a" },
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
  });
});

describe("player access adult actions", () => {
  it("authenticates, validates, delegates, and returns one-time credentials", async () => {
    mocks.allocateSlots.mockResolvedValue([
      {
        id: "slot-a",
        classGroupId: "class-a",
        playerNumber: 1,
        credential: "raw-token",
      },
    ]);
    await expect(
      allocatePlayerSlotsAction(
        previous,
        form({ classGroupId: "class-a", count: "1" }),
      ),
    ).resolves.toMatchObject({
      ok: true,
      issuedCredentials: [
        { playerSlotId: "slot-a", playerNumber: 1, token: "raw-token" },
      ],
    });
    expect(mocks.allocateSlots).toHaveBeenCalledWith("profile-a", "class-a", 1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/portal/turmas/class-a");
  });

  it("does not invoke a mutation for invalid or unauthenticated input", async () => {
    await expect(
      startClassSessionAction(previous, form({ classGroupId: "" })),
    ).resolves.toMatchObject({ ok: false, fieldErrors: expect.any(Object) });
    expect(mocks.startSession).not.toHaveBeenCalled();

    mocks.getSession.mockResolvedValue(null);
    await expect(
      startClassSessionAction(previous, form({ classGroupId: "class-a" })),
    ).resolves.toMatchObject({ ok: false, message: "Sessão expirada." });
    expect(mocks.startSession).not.toHaveBeenCalled();
  });
});

describe("public player entry action", () => {
  it("rejects malformed credentials before persistence lookup", async () => {
    await expect(resolvePlayerEntryAction("not-valid")).resolves.toEqual({
      state: "invalid",
    });
    expect(mocks.resolveEntry).not.toHaveBeenCalled();
  });

  it("issues a verifiable five-minute launch token for ready entry", async () => {
    const credential = "a".repeat(43);
    mocks.resolveEntry.mockResolvedValue({
      state: "ready",
      classGroupId: "class-a",
      credentialId: "credential-a",
      playerSlotId: "slot-a",
      playerNumber: 1,
      gameSessionId: "session-a",
      participationId: "participation-a",
    });
    const result = await resolvePlayerEntryAction(credential);
    expect(result).toMatchObject({
      state: "ready",
      expiresAt: expect.any(String),
    });
    if (result.state !== "ready") throw new Error("Expected ready entry");
    expect(
      verifyLaunchToken(
        result.launchToken,
        "test-secret-with-at-least-thirty-two-characters",
      ),
    ).toMatchObject({
      valid: true,
      payload: {
        credentialId: "credential-a",
        participationId: "participation-a",
      },
    });
  });
});
