import { describe, expect, it, vi } from "vitest";

import {
  hasUsableLaunchToken,
  LAUNCH_TOKEN_RENEWAL_LEAD_MS,
  retryAfterUnauthorized,
} from "@/components/public/game-host-token";

function response(status: number): Response {
  return { status } as Response;
}

describe("game host launch-token renewal", () => {
  it("keeps a still-valid token for event flushes inside the renewal window", () => {
    const now = 100_000;
    const expiresAt = now + LAUNCH_TOKEN_RENEWAL_LEAD_MS / 2;

    expect(hasUsableLaunchToken(expiresAt, now)).toBe(true);
    expect(
      hasUsableLaunchToken(expiresAt, now, LAUNCH_TOKEN_RENEWAL_LEAD_MS),
    ).toBe(false);
    expect(hasUsableLaunchToken(now, now)).toBe(false);
  });

  it("retries an unauthorized upload only when renewal succeeds", async () => {
    const send = vi.fn(async (token: string) =>
      token === "fresh" ? response(200) : response(401),
    );
    const refreshed = await retryAfterUnauthorized(
      response(401),
      send,
      async () => "fresh",
    );

    expect(refreshed.status).toBe(200);
    expect(send).toHaveBeenCalledWith("fresh");

    const unavailableSend = vi.fn(async () => response(401));
    const originalResponse = response(401);
    const unavailable = await retryAfterUnauthorized(
      originalResponse,
      unavailableSend,
      async () => {
        throw new Error("session ended");
      },
    );

    expect(unavailable).toBe(originalResponse);
    expect(unavailableSend).not.toHaveBeenCalled();
  });
});
