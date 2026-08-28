import { describe, expect, it } from "vitest";

import { correlationIdFromRequest } from "@/server/http/correlation";
import { errorResponse, HttpError } from "@/server/http/errors";

describe("HTTP infrastructure", () => {
  it("keeps a valid incoming correlation ID", () => {
    const correlationId = "2f3e3a64-0bf2-4a74-82f1-2ce71f6cb618";

    expect(
      correlationIdFromRequest({
        headers: new Headers({ "x-correlation-id": correlationId }),
      }),
    ).toBe(correlationId);
  });

  it("replaces invalid incoming correlation IDs", () => {
    expect(
      correlationIdFromRequest({
        headers: new Headers({ "x-correlation-id": "raw-token" }),
      }),
    ).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("serializes errors with the same correlation ID in body and header", async () => {
    const correlationId = "2f3e3a64-0bf2-4a74-82f1-2ce71f6cb618";
    const response = errorResponse(
      new HttpError(403, "FORBIDDEN", "Access denied."),
      correlationId,
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("x-correlation-id")).toBe(correlationId);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "FORBIDDEN", correlation_id: correlationId },
    });
  });
});
