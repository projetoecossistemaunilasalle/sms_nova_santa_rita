import { z } from "zod";
import type { PlayerEntryActionResult } from "@/application/player-access/types";
import type { GameOfflineTransport } from "@/runtime/offline/types";
import { OfflineSessionMismatchError } from "@/runtime/offline/errors";
import {
  fetchGameJson,
  GameTransportError,
  retryableHttpStatus,
} from "@/runtime/offline/network";
import {
  hasUsableLaunchToken,
  LAUNCH_TOKEN_RENEWAL_LEAD_MS,
} from "./game-host-token";

const renewalSchema = z.object({
  state: z.literal("ready"),
  playerSlotId: z.string(),
  gameSessionId: z.string(),
  participationId: z.string(),
  launchToken: z.string(),
  expiresAt: z.iso.datetime(),
  purpose: z.enum(["play", "flush"]),
});
type ReadyEntry = Extract<PlayerEntryActionResult, { state: "ready" }>;

export function createGameOfflineTransport(
  credential: string,
  playerSlotId: string,
  initial?: ReadyEntry,
) {
  const tokens = new Map<string, { token: string; expiresAt: number }>();
  const renewals = new Map<string, Promise<string>>();
  if (initial)
    tokens.set(initial.gameSessionId, {
      token: initial.launchToken,
      expiresAt: Date.parse(initial.expiresAt),
    });

  async function tokenForSession(
    gameSessionId: string,
    force = false,
    allowNearExpiry = false,
  ): Promise<string> {
    const cached = tokens.get(gameSessionId);
    if (
      !force &&
      cached &&
      hasUsableLaunchToken(
        cached.expiresAt,
        Date.now(),
        allowNearExpiry ? 0 : LAUNCH_TOKEN_RENEWAL_LEAD_MS,
      )
    )
      return cached.token;
    const pending = renewals.get(gameSessionId);
    if (pending) return pending;
    const operation = (async () => {
      const { response, payload } = await fetchGameJson(
        "/api/v1/player/refresh",
        {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential, playerSlotId, gameSessionId }),
        },
      );
      if (!response.ok)
        throw new GameTransportError(
          retryableHttpStatus(response.status),
          response.status,
        );
      const renewed = renewalSchema.parse(payload);
      if (
        renewed.playerSlotId !== playerSlotId ||
        renewed.gameSessionId !== gameSessionId ||
        (initial &&
          gameSessionId === initial.gameSessionId &&
          renewed.participationId !== initial.participationId)
      )
        throw new OfflineSessionMismatchError();
      tokens.set(gameSessionId, {
        token: renewed.launchToken,
        expiresAt: Date.parse(renewed.expiresAt),
      });
      return renewed.launchToken;
    })();
    renewals.set(gameSessionId, operation);
    try {
      return await operation;
    } finally {
      if (renewals.get(gameSessionId) === operation)
        renewals.delete(gameSessionId);
    }
  }

  async function post(
    path: string,
    body: unknown,
    gameSessionId: string,
    allowNearExpiry = false,
  ): Promise<unknown> {
    let token = await tokenForSession(gameSessionId, false, allowNearExpiry);
    for (let attempt = 0; attempt < 2; attempt++) {
      const { response, payload } = await fetchGameJson(path, {
        method: "POST",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (response.status === 401 && attempt === 0) {
        token = await tokenForSession(gameSessionId, true, allowNearExpiry);
        continue;
      }
      if (
        !response.ok &&
        !(
          response.status === 409 &&
          path.endsWith("/state") &&
          payload &&
          typeof payload === "object" &&
          "type" in payload &&
          payload.type === "portal.save_conflict.v1"
        )
      )
        throw new GameTransportError(
          retryableHttpStatus(response.status),
          response.status,
        );
      return payload;
    }
    throw new GameTransportError(false, 401);
  }

  function forSession(gameSessionId: string): GameOfflineTransport {
    return {
      saveState: (request, sessionId = gameSessionId) =>
        post("/api/v1/player/state", request, sessionId),
      uploadResult: (event, sessionId = gameSessionId) =>
        post("/api/v1/player/results", event, sessionId, true),
      uploadActiveTime: (batch, sessionId = gameSessionId) =>
        post("/api/v1/player/active-time", batch, sessionId, true),
      includePreviousSessions: true,
    };
  }
  return { post, forSession };
}
