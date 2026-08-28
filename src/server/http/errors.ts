import { NextResponse } from "next/server";

import { CORRELATION_HEADER } from "@/server/http/correlation";

export const apiErrorCodes = [
  "AUTHENTICATION_REQUIRED",
  "FORBIDDEN",
  "RESOURCE_NOT_FOUND",
  "VALIDATION_FAILED",
  "CONFLICT",
  "RATE_LIMITED",
  "SERVICE_UNAVAILABLE",
  "INTERNAL_SERVER_ERROR",
  "ACTIVITY_NOT_OPEN",
  "ACTIVITY_LINK_INVALID",
  "ACTIVITY_LINK_EXPIRED",
  "MODULE_LAUNCHES_BLOCKED",
  "GAME_NOT_IN_ACTIVITY",
  "GAME_DISABLED_FOR_ACTIVITY",
  "GAME_LAUNCHES_BLOCKED",
  "ATTEMPT_ALREADY_COMPLETED",
  "RESULT_SCHEMA_INVALID",
  "SCHEMA_VERSION_UNSUPPORTED",
  "SESSION_EXPIRED",
] as const;

export type ApiErrorCode = (typeof apiErrorCodes)[number];

export type ApiErrorDetail = {
  path: string;
  reason: string;
};

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function errorResponse(
  error: HttpError,
  correlationId: string,
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        correlation_id: correlationId,
        ...(error.details ? { details: error.details } : {}),
      },
    },
    {
      status: error.status,
      headers: { [CORRELATION_HEADER]: correlationId },
    },
  );
}
