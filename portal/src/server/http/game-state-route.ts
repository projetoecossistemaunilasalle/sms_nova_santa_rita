import "server-only";

import { z } from "zod";

import { GameStateError } from "@/application/game-state/service";
import { stateSaveRequestV2Schema } from "@/contracts/v2";
import { HttpError } from "@/server/http/errors";
import { readLimitedRequestText } from "@/server/http/read-limited-body";

const bootstrapRequestSchema = z
  .object({ request_id: z.string().min(1).max(200) })
  .strict();

export function readLaunchBearer(request: Request): string {
  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(
    request.headers.get("authorization") ?? "",
  );
  if (!match)
    throw new HttpError(
      401,
      "AUTHENTICATION_REQUIRED",
      "A player launch token is required.",
    );
  return match[1]!;
}

export async function readGameRequest(
  request: Request,
  kind: "bootstrap" | "save",
) {
  const body = await readLimitedRequestText(request);
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new HttpError(400, "VALIDATION_FAILED", "Invalid JSON request.");
  }
  const result = (
    kind === "bootstrap" ? bootstrapRequestSchema : stateSaveRequestV2Schema
  ).safeParse(value);
  if (!result.success)
    throw new HttpError(400, "VALIDATION_FAILED", "Invalid V2 game request.");
  return value;
}

export function gameStateHttpError(error: unknown): never {
  if (error instanceof GameStateError) {
    switch (error.code) {
      case "EXPIRED_LAUNCH":
        throw new HttpError(
          401,
          "SESSION_EXPIRED",
          "The player launch has expired.",
        );
      case "SESSION_ENDED":
        throw new HttpError(409, "CONFLICT", "The class session has ended.");
      case "INVALID_REVISION":
        throw new HttpError(
          409,
          "CONFLICT",
          "The expected state revision is not current.",
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

export const gameResponseHeaders = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};
