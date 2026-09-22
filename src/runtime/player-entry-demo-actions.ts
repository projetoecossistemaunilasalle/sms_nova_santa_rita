"use client";

import { playerCredentialTokenSchema } from "@/application/player-access/schemas";
import { PlayerAccessService } from "@/application/player-access/service";
import type { PlayerEntryActionResult } from "@/application/player-access/types";
import {
  DemoPlayerAccessStore,
  readDemoAdultPortalState,
  writeDemoAdultPortalState,
} from "@/runtime/adult-portal-demo-store";
import { DemoPlayerCredentialIssuer } from "@/runtime/player-access-demo-actions";

const DEMO_LAUNCH_LIFETIME_MS = 5 * 60 * 1000;

function demoLaunchToken(): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `demo_launch_${suffix}`;
}

export async function resolvePlayerEntryAction(
  token: string,
): Promise<PlayerEntryActionResult> {
  const parsed = playerCredentialTokenSchema.safeParse(token);
  if (!parsed.success || !parsed.data.startsWith("demo_player_")) {
    return { state: "invalid" };
  }

  const state = readDemoAdultPortalState();
  const result = await new PlayerAccessService(
    new DemoPlayerAccessStore(state),
    new DemoPlayerCredentialIssuer(),
  ).resolveEntry(parsed.data);

  if (result.state !== "ready") return result;

  writeDemoAdultPortalState(state);
  return {
    ...result,
    launchToken: demoLaunchToken(),
    expiresAt: new Date(Date.now() + DEMO_LAUNCH_LIFETIME_MS).toISOString(),
  };
}
