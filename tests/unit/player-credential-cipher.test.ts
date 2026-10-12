import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { SecurePlayerCredentialCipher } from "@/server/security/player-credential-cipher";
import { SecurePlayerCredentialIssuer } from "@/server/security/player-credential-tokens";

const secret = "test-encryption-secret-with-at-least-thirty-two-characters";

describe("player credential encryption", () => {
  it("stores randomized ciphertext and reopens the same token after a restart", () => {
    const issued = new SecurePlayerCredentialIssuer().issue();
    const cipher = new SecurePlayerCredentialCipher(secret);
    const encrypted = cipher.encrypt(issued.token, issued.tokenHash);
    expect(encrypted).not.toContain(issued.token);
    expect(encrypted).not.toBe(cipher.encrypt(issued.token, issued.tokenHash));
    expect(
      new SecurePlayerCredentialCipher(secret).decrypt(
        encrypted,
        issued.tokenHash,
      ),
    ).toBe(issued.token);
  });

  it("rejects tampering, row swaps, malformed values and the wrong key", () => {
    const issued = new SecurePlayerCredentialIssuer().issue();
    const cipher = new SecurePlayerCredentialCipher(secret);
    const encrypted = cipher.encrypt(issued.token, issued.tokenHash);
    const parts = encrypted.split(".");
    const tampered = [
      ...parts.slice(0, 3),
      `${parts[3]![0] === "A" ? "B" : "A"}${parts[3]!.slice(1)}`,
    ].join(".");
    expect(() => cipher.decrypt(tampered, issued.tokenHash)).toThrow();
    expect(() => cipher.decrypt(encrypted, "b".repeat(64))).toThrow();
    expect(() =>
      new SecurePlayerCredentialCipher(`${secret}-other`).decrypt(
        encrypted,
        issued.tokenHash,
      ),
    ).toThrow();
    for (const malformed of [
      "",
      "v0.a.b.c",
      "v1.a.b.c",
      `${encrypted}.extra`,
      "v1.=.a.b",
    ]) {
      expect(() => cipher.decrypt(malformed, issued.tokenHash)).toThrow();
    }
    expect(() => cipher.encrypt(issued.token, "a".repeat(64))).toThrow();
    expect(() => new SecurePlayerCredentialCipher("short")).toThrow();
  });
});
