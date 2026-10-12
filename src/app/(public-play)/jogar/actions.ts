"use server";

import { playerCredentialTokenSchema } from "@/application/player-access/schemas";
import type { PlayerEntryActionResult } from "@/application/player-access/types";
import { getServerRuntimeEnv } from "@/server/config/env";
import {
  createLaunchToken,
  LAUNCH_TOKEN_TTL_SECONDS,
} from "@/server/security/launch-token";
import {
  hashPlayerCredentialToken,
  isValidPlayerCredentialToken,
} from "@/server/security/player-credential-tokens";
import { getPlayerAccessService } from "@/server/services/player-access-container";
import { getRuntimeMode } from "@/runtime/mode";
import { randomUUID } from "node:crypto";

export async function resolvePlayerEntryAction(
  token: string,
): Promise<PlayerEntryActionResult> {
  const parsed = playerCredentialTokenSchema.safeParse(token);
  if (!parsed.success || !isValidPlayerCredentialToken(parsed.data)) {
    return { state: "invalid" };
  }
  const isMock = getRuntimeMode() === "demo";
  if (isMock) {
    const { findMockDatabase } = await import("@/server/mock/session");
    if (!(await findMockDatabase())) return { state: "invalid" };
  }
  const result = await (
    await getPlayerAccessService()
  ).resolveEntry(hashPlayerCredentialToken(parsed.data));
  if (result.state !== "ready") return result;

  const now = new Date();
  return {
    ...result,
    launchToken: isMock
      ? `demo_launch_${randomUUID()}`
      : createLaunchToken(
          {
            credentialId: result.credentialId,
            participationId: result.participationId,
            playerSlotId: result.playerSlotId,
            gameSessionId: result.gameSessionId,
          },
          getServerRuntimeEnv().APPLICATION_SECRET,
          now,
        ),
    expiresAt: new Date(
      now.getTime() + LAUNCH_TOKEN_TTL_SECONDS * 1_000,
    ).toISOString(),
  };
}
