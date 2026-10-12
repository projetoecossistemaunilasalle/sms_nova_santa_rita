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

  constructor(secret: string) {
    if (secret.length < 32)
      throw new Error(
        "Credential encryption requires a durable secret of at least 32 characters.",
      );
    this.key = Buffer.from(
      hkdfSync(
        "sha256",
        secret,
        "missoes-caramelito",
        "player-credential-encryption:v1",
        32,
      ),
    );
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
      "v1",
      iv.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      encrypted.toString("base64url"),
    ].join(".");
  }

  decrypt(encryptedToken: string, tokenHash: string): string {
    const parts = encryptedToken.split(".");
    if (
      parts.length !== 4 ||
      parts[0] !== "v1" ||
      parts.slice(1).some((part) => !/^[A-Za-z0-9_-]+$/.test(part))
    ) {
      throw new Error("Invalid encrypted player credential.");
    }
    const iv = Buffer.from(parts[1]!, "base64url");
    const tag = Buffer.from(parts[2]!, "base64url");
    if (iv.length !== 12 || tag.length !== 16)
      throw new Error("Invalid encrypted player credential.");
    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAAD(Buffer.from(tokenHash, "utf8"));
    decipher.setAuthTag(tag);
    const token = Buffer.concat([
      decipher.update(Buffer.from(parts[3]!, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    if (
      !isValidPlayerCredentialToken(token) ||
      hashPlayerCredentialToken(token) !== tokenHash
    ) {
      throw new Error("Invalid decrypted player credential.");
    }
    return token;
  }
}
