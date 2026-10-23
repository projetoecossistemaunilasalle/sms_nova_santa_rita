import "server-only";

import { activeTimeBatchV2Schema, resultEventV2Schema } from "@/contracts/v2";
import { GameEventError } from "@/application/game-events/service";
import { HttpError } from "@/server/http/errors";
import { readLimitedRequestText } from "@/server/http/read-limited-body";

export {
  gameResponseHeaders,
  readLaunchBearer,
} from "@/server/http/game-state-route";

export async function readGameEventRequest(
  request: Request,
  kind: "result" | "active_time",
) {
  const body = await readLimitedRequestText(request);
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new HttpError(400, "VALIDATION_FAILED", "Invalid JSON request.");
  }
  const parsed = (
    kind === "result" ? resultEventV2Schema : activeTimeBatchV2Schema
  ).safeParse(value);
  if (!parsed.success) {
    throw new HttpError(400, "VALIDATION_FAILED", "Invalid V2 game event.");
  }
  return parsed.data;
}

export function gameEventHttpError(error: unknown): never {
  if (error instanceof GameEventError) {
    switch (error.code) {
      case "EXPIRED_LAUNCH":
        throw new HttpError(
          401,
          "SESSION_EXPIRED",
          "The player launch has expired.",
        );
      case "EVENT_ID_CONFLICT":
        throw new HttpError(
          409,
          "CONFLICT",
          "An event ID was already used for a different event.",
        );
      default:
        throw new HttpError(
          403,
          "FORBIDDEN",
          "The player launch is no longer valid.",
        );
    }
  }
  throw error;
}
