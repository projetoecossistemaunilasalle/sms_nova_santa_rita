import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  renew: vi.fn(),
  limit: vi.fn(),
  secret: "test-refresh-secret-with-at-least-thirty-two-characters",
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/security/rate-limit", () => ({
  enforceRateLimit: mocks.limit,
  enforcePlayerRateLimit: vi.fn(),
}));
vi.mock("@/server/config/env", () => ({
  getServerRuntimeEnv: () => ({ APPLICATION_SECRET: mocks.secret }),
}));
vi.mock("@/server/observability/logger", () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));
vi.mock("@/server/services/player-access-container", () => ({
  getPlayerAccessService: async () => ({ renewEntry: mocks.renew }),
}));
import { POST } from "@/app/api/v1/player/refresh/route";
import { verifyLaunchToken } from "@/server/security/launch-token";
const playerSlotId = "00000000-0000-4000-8000-000000000001";
const gameSessionId = "00000000-0000-4000-8000-000000000002";
const request = (body: unknown) =>
  new NextRequest("http://localhost/api/v1/player/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("participation-scoped token renewal", () => {
  it("signs a flush token for the verified original session", async () => {
    vi.stubEnv("APP_RUNTIME_MODE", "server");
    mocks.renew.mockResolvedValue({
      state: "ready",
      playerSlotId,
      gameSessionId,
      credentialId: "credential",
      participationId: "participation",
      purpose: "flush",
    });
    const response = await POST(
      request({ credential: "a".repeat(43), playerSlotId, gameSessionId }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(verifyLaunchToken(body.launchToken, mocks.secret)).toMatchObject({
      valid: true,
      payload: { playerSlotId, gameSessionId, purpose: "flush" },
    });
    expect(mocks.renew.mock.calls[0]?.slice(1)).toEqual([
      playerSlotId,
      gameSessionId,
    ]);
    expect(mocks.limit).toHaveBeenCalled();
  });
  it("rejects unjoined or revoked participations and malformed identifiers", async () => {
    vi.stubEnv("APP_RUNTIME_MODE", "server");
    mocks.renew.mockResolvedValue({ state: "revoked" });
    expect(
      (
        await POST(
          request({ credential: "a".repeat(43), playerSlotId, gameSessionId }),
        )
      ).status,
    ).toBe(403);
    mocks.renew.mockClear();
    expect(
      (
        await POST(
          request({
            credential: "a".repeat(43),
            playerSlotId: "not-a-uuid",
            gameSessionId,
          }),
        )
      ).status,
    ).toBe(400);
    expect(mocks.renew).not.toHaveBeenCalled();
  });
});
