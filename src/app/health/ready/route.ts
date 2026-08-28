import { Prisma } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

import { getRuntimeEnv } from "@/server/config/env";
import { getPrisma } from "@/server/db/client";
import { HttpError } from "@/server/http/errors";
import { withHttpContext } from "@/server/http/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function databaseCheck(): Promise<void> {
  await getPrisma().$queryRaw(Prisma.sql`SELECT 1`);
}

export const GET = withHttpContext(async () => {
  const timeoutMs = getRuntimeEnv().READINESS_TIMEOUT_MS;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      databaseCheck(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Readiness check timed out")),
          timeoutMs,
        );
      }),
    ]);
  } catch {
    throw new HttpError(
      503,
      "SERVICE_UNAVAILABLE",
      "The service is not ready.",
    );
  } finally {
    clearTimeout(timeout);
  }

  return NextResponse.json({ status: "ready" });
});
