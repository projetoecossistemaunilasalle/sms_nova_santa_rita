import { createHmac, timingSafeEqual } from "node:crypto";

export const LAUNCH_TOKEN_TTL_SECONDS = 5 * 60;

export type LaunchTokenContext = {
  credentialId: string;
  participationId: string;
  playerSlotId: string;
  gameSessionId: string;
  purpose?: "play" | "flush";
};

export type LaunchTokenPayload = LaunchTokenContext & {
  v: 1;
  iat: number;
  exp: number;
};

function signature(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload, "utf8").digest();
}

export function createLaunchToken(
  context: LaunchTokenContext,
  secret: string,
  now: Date = new Date(),
): string {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const payload: LaunchTokenPayload = {
    v: 1,
    iat: issuedAt,
    exp: issuedAt + LAUNCH_TOKEN_TTL_SECONDS,
    ...context,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  return `${encoded}.${signature(encoded, secret).toString("base64url")}`;
}

export function verifyLaunchToken(
  token: string,
  secret: string,
  now: Date = new Date(),
):
  | { valid: true; payload: LaunchTokenPayload }
  | { valid: false; reason: "invalid" | "expired" } {
  const [encoded, encodedSignature, extra] = token.split(".");
  if (!encoded || !encodedSignature || extra) {
    return { valid: false, reason: "invalid" };
  }
  try {
    const provided = Buffer.from(encodedSignature, "base64url");
    const expected = signature(encoded, secret);
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      return { valid: false, reason: "invalid" };
    }
    const value: unknown = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    );
    if (!isLaunchTokenPayload(value)) {
      return { valid: false, reason: "invalid" };
    }
    if (value.exp <= Math.floor(now.getTime() / 1000)) {
      return { valid: false, reason: "expired" };
    }
    return { valid: true, payload: value };
  } catch {
    return { valid: false, reason: "invalid" };
  }
}

function isLaunchTokenPayload(value: unknown): value is LaunchTokenPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return (
    payload.v === 1 &&
    typeof payload.iat === "number" &&
    Number.isInteger(payload.iat) &&
    typeof payload.exp === "number" &&
    Number.isInteger(payload.exp) &&
    payload.exp - payload.iat === LAUNCH_TOKEN_TTL_SECONDS &&
    (payload.purpose === undefined ||
      payload.purpose === "play" ||
      payload.purpose === "flush") &&
    typeof payload.participationId === "string" &&
    payload.participationId.length > 0 &&
    typeof payload.credentialId === "string" &&
    payload.credentialId.length > 0 &&
    typeof payload.playerSlotId === "string" &&
    payload.playerSlotId.length > 0 &&
    typeof payload.gameSessionId === "string" &&
    payload.gameSessionId.length > 0
  );
}
