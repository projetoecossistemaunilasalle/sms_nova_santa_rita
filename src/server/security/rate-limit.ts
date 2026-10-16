import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { getRuntimeMode } from "@/runtime/mode";
import { getServerRuntimeEnv } from "@/server/config/env";
import { getPrisma } from "@/server/db/client";
import { HttpError } from "@/server/http/errors";
import { readLaunchBearer } from "@/server/http/game-state-route";
import { verifyLaunchToken } from "./launch-token";

let lastPrunedAt = 0;

export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  db: Pick<PrismaClient, "$queryRaw" | "$executeRaw"> = getPrisma(),
): Promise<boolean> {
  // The database clock and atomic upsert keep all application instances in agreement.
  const [row] = await db.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    INSERT INTO "request_rate_limits" ("key", "window_start", "count", "expires_at")
    VALUES (${key}::char(64), statement_timestamp(), 1, statement_timestamp() + ${windowSeconds} * interval '1 second')
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "request_rate_limits"."expires_at" <= statement_timestamp() THEN 1 ELSE LEAST("request_rate_limits"."count" + 1, ${limit + 1}) END,
      "window_start" = CASE WHEN "request_rate_limits"."expires_at" <= statement_timestamp() THEN statement_timestamp() ELSE "request_rate_limits"."window_start" END,
      "expires_at" = CASE WHEN "request_rate_limits"."expires_at" <= statement_timestamp() THEN statement_timestamp() + ${windowSeconds} * interval '1 second' ELSE "request_rate_limits"."expires_at" END
    RETURNING "count"
  `);
  if (Date.now() - lastPrunedAt > 60_000) {
    lastPrunedAt = Date.now();
    await db
      .$executeRaw(
        Prisma.sql`
      DELETE FROM "request_rate_limits" WHERE "key" IN (
        SELECT "key" FROM "request_rate_limits"
        WHERE "expires_at" < clock_timestamp() - interval '1 hour'
        ORDER BY "expires_at" LIMIT 500
      )
    `,
      )
      .catch(() => undefined);
  }
  return !!row && row.count <= limit;
}

export async function enforceRateLimit(
  operation: "sign-in" | "player-entry" | "player-api",
  principal: string,
  requestHeaders: Headers,
): Promise<void> {
  if (getRuntimeMode() !== "server") return;
  const env = getServerRuntimeEnv();
  const windowSeconds = operation === "sign-in" ? 900 : 60;
  const limit =
    operation === "sign-in" ? 10 : operation === "player-entry" ? 60 : 240;
  const keyFor = (value: string) =>
    createHmac("sha256", env.APPLICATION_SECRET)
      .update(`${operation}\0${value}`)
      .digest("hex");
  const clientIp = env.RATE_LIMIT_CLIENT_IP_HEADER
    ? requestHeaders.get(env.RATE_LIMIT_CLIENT_IP_HEADER)?.split(",")[0]?.trim()
    : undefined;
  if (clientIp && isIP(clientIp)) {
    const ipLimit =
      operation === "sign-in" ? 120 : operation === "player-entry" ? 300 : 2000;
    if (
      !(await consumeRateLimit(
        keyFor(`ip:${clientIp}`),
        ipLimit,
        windowSeconds,
      ))
    )
      throw new HttpError(
        429,
        "RATE_LIMITED",
        "Too many requests. Try again later.",
        undefined,
        windowSeconds,
      );
  }
  if (
    !(await consumeRateLimit(
      keyFor(`principal:${principal}`),
      limit,
      windowSeconds,
    ))
  )
    throw new HttpError(
      429,
      "RATE_LIMITED",
      "Too many requests. Try again later.",
      undefined,
      windowSeconds,
    );
}

export async function enforcePlayerRateLimit(request: Request): Promise<void> {
  if (getRuntimeMode() !== "server") return;
  const token = readLaunchBearer(request);
  const verified = verifyLaunchToken(
    token,
    getServerRuntimeEnv().APPLICATION_SECRET,
  );
  if (!verified.valid)
    throw new HttpError(
      401,
      "SESSION_EXPIRED",
      "The player launch is invalid or expired.",
    );
  await enforceRateLimit(
    "player-api",
    verified.payload.playerSlotId,
    request.headers,
  );
}
