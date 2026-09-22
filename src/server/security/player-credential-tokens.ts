import { createHash, randomBytes } from "node:crypto";

import type {
  CredentialMaterial,
  PlayerCredentialIssuer,
} from "@/application/player-access/ports";

const TOKEN_BYTES = 32;
export const PLAYER_CREDENTIAL_TOKEN_LENGTH = 43;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function hashPlayerCredentialToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isValidPlayerCredentialToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

export class SecurePlayerCredentialIssuer implements PlayerCredentialIssuer {
  issue(): CredentialMaterial {
    const token = randomBytes(TOKEN_BYTES).toString("base64url");
    return { token, tokenHash: hashPlayerCredentialToken(token) };
  }
}
