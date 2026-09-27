import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import { correlationIdFromRequest } from "@/server/http/correlation";
import { errorResponse, HttpError } from "@/server/http/errors";
import { createLogger } from "@/server/observability/logger";

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

describe("logger redaction", () => {
  it("never emits the player entry credential from structured or URL-shaped log input", async () => {
    const sentinel = "sentinel-credential-8f4c1d2e7b6a";
    const censor = "[REDACTED]";

    const lines: string[] = [];
    const log = createLogger(
      new Writable({
        write(chunk, _encoding, callback) {
          lines.push(String(chunk));
          callback();
        },
      }),
    );
    log.level = "info";

    // Structured entry carrying the sentinel under every credential-shaped key.
    log.info(
      {
        cred: sentinel,
        launchToken: sentinel,
        credential: sentinel,
        playerCredential: sentinel,
        entryCredential: sentinel,
        tokenHash: sentinel,
        credentialHash: sentinel,
        nested: {
          cred: sentinel,
          launchToken: sentinel,
          tokenHash: sentinel,
        },
      },
      "credential entry",
    );

    // URL-shaped input: a full URL whose query string carries the credential.
    log.info(
      {
        method: "GET",
        url: `/jogar/abc?cred=${sentinel}&next=%2Fhistorico`,
        status: 200,
      },
      "request completed",
    );

    // The pathname-only request entry convention used by withHttpContext.
    const requestLogger = log.child({
      correlationId: "2f3e3a64-0bf2-4a74-82f1-2ce71f6cb618",
      method: "GET",
      path: "/jogar/abc",
    });
    requestLogger.info({ status: 200 }, "request completed");

    // Pino writes through to the destination stream; yield a tick so any
    // buffered write settles before asserting.
    await new Promise((resolve) => setImmediate(resolve));

    const output = lines.join("");
    const entries = lines.map(
      (line) => JSON.parse(line) as Record<string, unknown>,
    );

    // The sentinel never appears anywhere in the serialized output.
    expect(output).not.toContain(sentinel);

    // Structured credentials are replaced by the censor, top level and nested.
    const structured = entries.find(
      (entry) => entry.msg === "credential entry",
    );
    expect(structured).toBeDefined();
    for (const key of [
      "cred",
      "launchToken",
      "credential",
      "playerCredential",
      "entryCredential",
      "tokenHash",
      "credentialHash",
    ]) {
      expect(structured?.[key]).toBe(censor);
    }
    const nested = structured?.nested as Record<string, unknown>;
    for (const key of ["cred", "launchToken", "tokenHash"]) {
      expect(nested[key]).toBe(censor);
    }

    // Full URLs are censored outright; the pathname-only entry survives.
    const urlEntry = entries.find(
      (entry) => entry.msg === "request completed" && "url" in entry,
    );
    expect(urlEntry?.url).toBe(censor);
    expect(entries.find((entry) => entry.path === "/jogar/abc")).toBeDefined();
  });
});
