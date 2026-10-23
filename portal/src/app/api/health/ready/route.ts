import { NextResponse } from "next/server";
import { getRuntimeEnv } from "@/server/config/env";
import { getPrisma } from "@/server/db/client";
import { checkReadiness } from "@/server/health/readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  let ready = false;
  try {
    const env = getRuntimeEnv();
    ready =
      env.APP_RUNTIME_MODE === "demo" ||
      (await checkReadiness(
        () =>
          getPrisma().$queryRaw`SELECT 1 FROM "request_rate_limits" LIMIT 1`,
        env.READINESS_TIMEOUT_MS,
      ));
  } catch {
    /* Never expose environment or database errors through public probes. */
  }
  return NextResponse.json(
    { status: ready ? "ready" : "unavailable" },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
