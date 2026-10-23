import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  execute: vi.fn(async () => 0),
  env: {
    APPLICATION_SECRET: "test-rate-limit-secret-with-at-least-32-characters",
    RATE_LIMIT_CLIENT_IP_HEADER: undefined as string | undefined,
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/config/env", () => ({
  getServerRuntimeEnv: () => mocks.env,
}));
vi.mock("@/server/db/client", () => ({
  getPrisma: () => ({ $queryRaw: mocks.query, $executeRaw: mocks.execute }),
}));
import {
  consumeRateLimit,
  enforceRateLimit,
  enforcePlayerRateLimit,
} from "@/server/security/rate-limit";
import { createLaunchToken } from "@/server/security/launch-token";
import { errorResponse, HttpError } from "@/server/http/errors";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  mocks.env.RATE_LIMIT_CLIENT_IP_HEADER = undefined;
});

describe("shared database rate limits", () => {
  it("uses an atomic upsert and rejects counts above the budget", async () => {
    mocks.query
      .mockResolvedValueOnce([{ count: 10 }])
      .mockResolvedValueOnce([{ count: 11 }]);
    expect(await consumeRateLimit("a".repeat(64), 10, 900)).toBe(true);
    expect(await consumeRateLimit("a".repeat(64), 10, 900)).toBe(false);
    const sql = mocks.query.mock.calls[0]![0] as {
      sql: string;
      values: unknown[];
    };
    expect(sql.sql).toContain('ON CONFLICT ("key") DO UPDATE');
    expect(sql.sql).toContain("statement_timestamp()");
    expect(sql.values).toContain("a".repeat(64));
  });
  it("stores HMAC keys rather than raw adult email addresses or client IPs", async () => {
    vi.stubEnv("APP_RUNTIME_MODE", "server");
    mocks.env.RATE_LIMIT_CLIENT_IP_HEADER = "x-real-ip";
    mocks.query.mockResolvedValue([{ count: 1 }]);
    await enforceRateLimit(
      "sign-in",
      "teacher@example.org",
      new Headers({ "x-real-ip": "192.0.2.1" }),
    );
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(mocks.query.mock.calls)).not.toContain(
      "teacher@example.org",
    );
    expect(JSON.stringify(mocks.query.mock.calls)).not.toContain("192.0.2.1");
  });
  it("does not trust forwarded IP headers unless explicitly configured", async () => {
    vi.stubEnv("APP_RUNTIME_MODE", "server");
    mocks.query.mockResolvedValue([{ count: 1 }]);
    await enforceRateLimit(
      "player-entry",
      "credential-hash",
      new Headers({ "x-forwarded-for": "192.0.2.1" }),
    );
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
  it("keeps one player budget across launch token renewal", async () => {
    vi.stubEnv("APP_RUNTIME_MODE", "server");
    mocks.query.mockResolvedValue([{ count: 1 }]);
    const context = {
      credentialId: "credential-a",
      participationId: "participation-a",
      playerSlotId: "player-a",
      gameSessionId: "session-a",
    };
    const token = createLaunchToken(context, mocks.env.APPLICATION_SECRET);
    const second = createLaunchToken(
      { ...context, purpose: "flush" },
      mocks.env.APPLICATION_SECRET,
    );
    for (const bearer of [token, second])
      await enforcePlayerRateLimit(
        new NextRequest("http://localhost/api/v2/player/results", {
          headers: { Authorization: `Bearer ${bearer}` },
        }),
      );
    expect(mocks.query.mock.calls[0]![0].values[0]).toBe(
      mocks.query.mock.calls[1]![0].values[0],
    );
  });
  it("returns a 429 with Retry-After and bypasses limiting only in demo mode", async () => {
    vi.stubEnv("APP_RUNTIME_MODE", "server");
    mocks.query.mockResolvedValue([{ count: 11 }]);
    let error: unknown;
    try {
      await enforceRateLimit("sign-in", "adult", new Headers());
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(HttpError);
    const response = errorResponse(error as HttpError, "correlation");
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("900");
    mocks.query.mockClear();
    vi.stubEnv("APP_RUNTIME_MODE", "demo");
    await enforceRateLimit("sign-in", "adult", new Headers());
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
