import { describe, expect, it, vi } from "vitest";
import { createCipheriv, hkdfSync, randomBytes } from "node:crypto";

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
      ...parts.slice(0, 4),
      `${parts[4]![0] === "A" ? "B" : "A"}${parts[4]!.slice(1)}`,
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

  it("reads historical V1 and V2 credentials after rotating both the active key and application secret", () => {
    const issued = new SecurePlayerCredentialIssuer().issue();
    const iv = randomBytes(12);
    const key = Buffer.from(
      hkdfSync(
        "sha256",
        secret,
        "missoes-caramelito",
        "player-credential-encryption:v1",
        32,
      ),
    );
    const legacyCipher = createCipheriv("aes-256-gcm", key, iv);
    legacyCipher.setAAD(Buffer.from(issued.tokenHash));
    const bytes = Buffer.concat([
      legacyCipher.update(issued.token),
      legacyCipher.final(),
    ]);
    const v1 = [
      "v1",
      iv.toString("base64url"),
      legacyCipher.getAuthTag().toString("base64url"),
      bytes.toString("base64url"),
    ].join(".");
    const v2 = new SecurePlayerCredentialCipher(secret).encrypt(
      issued.token,
      issued.tokenHash,
    );
    const rotated = new SecurePlayerCredentialCipher(`${secret}-new-app`, {
      keyId: "october",
      keys: { default: secret, october: `${secret}-new-key` },
    });
    expect(rotated.decrypt(v1, issued.tokenHash)).toBe(issued.token);
    expect(rotated.decrypt(v2, issued.tokenHash)).toBe(issued.token);
    expect(rotated.needsReencryption(v1)).toBe(true);
    expect(rotated.needsReencryption(v2)).toBe(true);
    const current = rotated.encrypt(issued.token, issued.tokenHash);
    expect(current).toMatch(/^v2\.october\./);
    expect(rotated.needsReencryption(current)).toBe(false);
    expect(() =>
      rotated.decrypt(v2.replace(".default.", ".unknown."), issued.tokenHash),
    ).toThrow();
  });
});
