import type { NextRequest, NextResponse } from "next/server";

import {
  correlationIdFromRequest,
  CORRELATION_HEADER,
} from "@/server/http/correlation";
import { errorResponse, HttpError } from "@/server/http/errors";
import { logger } from "@/server/observability/logger";
import { enforcePlayerRateLimit } from "@/server/security/rate-limit";

type RouteHandler = (
  request: NextRequest,
  context: { correlationId: string },
) => Promise<NextResponse>;

export function withHttpContext(handler: RouteHandler) {
  return async function contextualRoute(
    request: NextRequest,
  ): Promise<NextResponse> {
    const correlationId = correlationIdFromRequest(request);
    const requestLogger = logger.child({
      correlationId,
      method: request.method,
      path: request.nextUrl.pathname,
    });

    try {
      if (
        request.nextUrl.pathname.startsWith("/api/v1/player/") &&
        request.nextUrl.pathname !== "/api/v1/player/refresh"
      )
        await enforcePlayerRateLimit(request);
      const response = await handler(request, { correlationId });
      response.headers.set(CORRELATION_HEADER, correlationId);
      requestLogger.info({ status: response.status }, "request completed");
      return response;
    } catch (error) {
      if (error instanceof HttpError) {
        requestLogger.warn(
          { status: error.status, errorCode: error.code },
          "request rejected",
        );
        return errorResponse(error, correlationId);
      }

      requestLogger.error(
        { err: error, status: 500, errorCode: "INTERNAL_SERVER_ERROR" },
        "request failed",
      );
      return errorResponse(
        new HttpError(
          500,
          "INTERNAL_SERVER_ERROR",
          "The request could not be completed.",
        ),
        correlationId,
      );
    }
  };
}
