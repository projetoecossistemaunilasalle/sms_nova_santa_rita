import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

import type { PlayerCredentialCipher } from "@/application/player-access/ports";
import {
  hashPlayerCredentialToken,
  isValidPlayerCredentialToken,
} from "./player-credential-tokens";

export class SecurePlayerCredentialCipher implements PlayerCredentialCipher {
  private readonly key: Buffer;
  private readonly keys: Map<string, Buffer>;
  private readonly keyId: string;
  private readonly legacyKeys: Buffer[];

  constructor(
    secret: string,
    options: { keyId?: string; keys?: Record<string, string> } = {},
  ) {
    if (secret.length < 32)
      throw new Error(
        "Credential encryption requires a durable secret of at least 32 characters.",
      );
    this.keyId = options.keyId ?? "default";
    const secrets = { default: secret, ...options.keys };
    this.keys = new Map(
      Object.entries(secrets).map(([id, material]) => {
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) || material.length < 32)
          throw new Error("Invalid credential encryption key.");
        return [
          id,
          Buffer.from(
            hkdfSync(
              "sha256",
              material,
              "missoes-caramelito",
              "player-credential-encryption:v1",
              32,
            ),
          ),
        ];
      }),
    );
    const active = this.keys.get(this.keyId);
    if (!active)
      throw new Error("Active credential encryption key is unavailable.");
    this.key = active;
    this.legacyKeys = [
      ...this.keys.values(),
      Buffer.from(
        hkdfSync(
          "sha256",
          secret,
          "missoes-caramelito",
          "player-credential-encryption:v1",
          32,
        ),
      ),
    ];
  }

  needsReencryption(encryptedToken: string): boolean {
    return !encryptedToken.startsWith(`v2.${this.keyId}.`);
  }

  encrypt(token: string, tokenHash: string): string {
    if (
      !isValidPlayerCredentialToken(token) ||
      hashPlayerCredentialToken(token) !== tokenHash
    ) {
      throw new Error("Invalid player credential material.");
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    // Bind the encrypted bearer token to its lookup digest to prevent row swaps.
    cipher.setAAD(Buffer.from(tokenHash, "utf8"));
    const encrypted = Buffer.concat([
      cipher.update(token, "utf8"),
      cipher.final(),
    ]);
    return [
      "v2",
      this.keyId,
      iv.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      encrypted.toString("base64url"),
    ].join(".");
  }

  decrypt(encryptedToken: string, tokenHash: string): string {
    const parts = encryptedToken.split(".");
    const legacy = parts[0] === "v1" && parts.length === 4;
    const versioned = parts[0] === "v2" && parts.length === 5;
    if (
      (!legacy && !versioned) ||
      parts.slice(1).some((part) => !/^[A-Za-z0-9_-]+$/.test(part))
    ) {
      throw new Error("Invalid encrypted player credential.");
    }
    const offset = legacy ? 1 : 2;
    const iv = Buffer.from(parts[offset]!, "base64url");
    const tag = Buffer.from(parts[offset + 1]!, "base64url");
    if (iv.length !== 12 || tag.length !== 16)
      throw new Error("Invalid encrypted player credential.");
    const candidates = legacy ? this.legacyKeys : [this.keys.get(parts[1]!)];
    for (const key of candidates) {
      if (!key) continue;
      try {
        const decipher = createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAAD(Buffer.from(tokenHash, "utf8"));
        decipher.setAuthTag(tag);
        const token = Buffer.concat([
          decipher.update(Buffer.from(parts[offset + 2]!, "base64url")),
          decipher.final(),
        ]).toString("utf8");
        if (
          isValidPlayerCredentialToken(token) &&
          hashPlayerCredentialToken(token) === tokenHash
        )
          return token;
      } catch {
        // Unversioned V1 rows may have been encrypted by any retained historical key.
      }
    }
    throw new Error("Invalid encrypted player credential or unavailable key.");
  }
}
