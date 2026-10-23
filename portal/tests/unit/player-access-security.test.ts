import { describe, expect, it } from "vitest";

import {
  createLaunchToken,
  verifyLaunchToken,
} from "@/server/security/launch-token";
import {
  hashPlayerCredentialToken,
  isValidPlayerCredentialToken,
  SecurePlayerCredentialIssuer,
} from "@/server/security/player-credential-tokens";

describe("player credential tokens", () => {
  it("issues 256-bit opaque values and persists only their digest", () => {
    const issued = new SecurePlayerCredentialIssuer().issue();
    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(issued.token, "base64url")).toHaveLength(32);
    expect(issued.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(issued.tokenHash).toBe(hashPlayerCredentialToken(issued.token));
    expect(isValidPlayerCredentialToken(issued.token)).toBe(true);
  });

  it("rejects malformed production credentials", () => {
    expect(isValidPlayerCredentialToken("a".repeat(42))).toBe(false);
    expect(isValidPlayerCredentialToken("a".repeat(44))).toBe(false);
    expect(isValidPlayerCredentialToken(`${"a".repeat(42)}=`)).toBe(false);
  });
});

describe("launch tokens", () => {
  const now = new Date("2026-09-22T12:00:00.000Z");
  const secret = "test-secret-with-at-least-thirty-two-characters";
  const context = {
    credentialId: "credential-a",
    participationId: "participation-a",
    playerSlotId: "slot-a",
    gameSessionId: "session-a",
  };

  it("signs a five-minute launch context", () => {
    const result = verifyLaunchToken(
      createLaunchToken(context, secret, now),
      secret,
      new Date(now.getTime() + 299_000),
    );
    expect(result).toEqual({
      valid: true,
      payload: {
        v: 1,
        iat: 1_790_078_400,
        exp: 1_790_078_700,
        ...context,
      },
    });
  });

  it("rejects expired, tampered, and incorrectly signed launches", () => {
    const token = createLaunchToken(context, secret, now);
    expect(
      verifyLaunchToken(token, secret, new Date(now.getTime() + 300_000)),
    ).toEqual({ valid: false, reason: "expired" });
    expect(verifyLaunchToken(`${token}x`, secret, now)).toEqual({
      valid: false,
      reason: "invalid",
    });
    expect(verifyLaunchToken(token, `${secret}-wrong`, now)).toEqual({
      valid: false,
      reason: "invalid",
    });
  });
});
