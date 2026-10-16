import { NextResponse } from "next/server";
import { z } from "zod";
import { getRuntimeMode } from "@/runtime/mode";
import { getServerRuntimeEnv } from "@/server/config/env";
import { HttpError } from "@/server/http/errors";
import { gameResponseHeaders } from "@/server/http/game-state-route";
import { readLimitedRequestText } from "@/server/http/read-limited-body";
import { withHttpContext } from "@/server/http/route";
import {
  createLaunchToken,
  LAUNCH_TOKEN_TTL_SECONDS,
} from "@/server/security/launch-token";
import { hashPlayerCredentialToken } from "@/server/security/player-credential-tokens";
import { getPlayerAccessService } from "@/server/services/player-access-container";
import { enforceRateLimit } from "@/server/security/rate-limit";

export const runtime = "nodejs";
const requestSchema = z
  .object({
    credential: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    playerSlotId: z.uuid(),
    gameSessionId: z.uuid(),
  })
  .strict();

export const POST = withHttpContext(async (request) => {
  if (getRuntimeMode() !== "server")
    throw new HttpError(
      403,
      "FORBIDDEN",
      "Player renewal is unavailable in this runtime.",
    );
  let input: unknown;
  try {
    input = JSON.parse(await readLimitedRequestText(request, 2048));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "VALIDATION_FAILED", "Invalid renewal request.");
  }
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success)
    throw new HttpError(400, "VALIDATION_FAILED", "Invalid renewal request.");
  const { credential, playerSlotId, gameSessionId } = parsed.data;
  await enforceRateLimit(
    "player-entry",
    hashPlayerCredentialToken(credential),
    request.headers,
  );
  const entry = await (
    await getPlayerAccessService()
  ).renewEntry(
    hashPlayerCredentialToken(credential),
    playerSlotId,
    gameSessionId,
  );
  if (entry.state !== "ready")
    throw new HttpError(
      403,
      "FORBIDDEN",
      "This participation is no longer available for synchronization.",
    );
  const now = new Date();
  return NextResponse.json(
    {
      ...entry,
      launchToken: createLaunchToken(
        {
          credentialId: entry.credentialId,
          participationId: entry.participationId,
          playerSlotId,
          gameSessionId,
          purpose: entry.purpose,
        },
        getServerRuntimeEnv().APPLICATION_SECRET,
        now,
      ),
      expiresAt: new Date(
        now.getTime() + LAUNCH_TOKEN_TTL_SECONDS * 1000,
      ).toISOString(),
    },
    { headers: gameResponseHeaders },
  );
});
