import type { NextRequest } from "next/server";

export const CORRELATION_HEADER = "x-correlation-id";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function correlationIdFromRequest(
  request: Pick<NextRequest, "headers">,
): string {
  const candidate = request.headers.get(CORRELATION_HEADER);
  return candidate && uuidPattern.test(candidate)
    ? candidate.toLowerCase()
    : crypto.randomUUID();
}
