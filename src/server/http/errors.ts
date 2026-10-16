import { NextResponse } from "next/server";

import { CORRELATION_HEADER } from "@/server/http/correlation";

export const apiErrorCodes = [
  "AUTHENTICATION_REQUIRED",
  "FORBIDDEN",
  "VALIDATION_FAILED",
  "CONFLICT",
  "INTERNAL_SERVER_ERROR",
  "SESSION_EXPIRED",
  "RATE_LIMITED",
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
    readonly retryAfterSeconds?: number,
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
      headers: {
        [CORRELATION_HEADER]: correlationId,
        "Cache-Control": "no-store",
        ...(error.retryAfterSeconds
          ? { "Retry-After": String(error.retryAfterSeconds) }
          : {}),
      },
    },
  );
}
