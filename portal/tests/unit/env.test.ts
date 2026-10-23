import { afterEach, describe, expect, it, vi } from "vitest";

import { runtimeEnvSchema, serverRuntimeEnvSchema } from "@/server/config/env";

const validEnvironment = {
  APP_RUNTIME_MODE: "server",
  DATABASE_URL:
    "postgresql://user:password@example.neon.tech/database?sslmode=require",
  NEON_AUTH_BASE_URL:
    "https://example.neonauth.us-east-2.aws.neon.tech/neondb/auth",
  NEON_AUTH_COOKIE_SECRET: "a".repeat(32),
  APPLICATION_SECRET: "b".repeat(32),
  ALLOWED_ORIGINS: "https://portal.example.org,http://localhost:3000",
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("runtimeEnvSchema", () => {
  it("validates key rings and the bounded offline flush window", () => {
    expect(
      serverRuntimeEnvSchema.parse(validEnvironment)
        .OFFLINE_FLUSH_WINDOW_SECONDS,
    ).toBe(86400);
    expect(() =>
      serverRuntimeEnvSchema.parse({
        ...validEnvironment,
        PLAYER_CREDENTIAL_KEY_ID: "missing",
      }),
    ).toThrow();
    expect(() =>
      serverRuntimeEnvSchema.parse({
        ...validEnvironment,
        PLAYER_CREDENTIAL_KEYS: '{"old":"short"}',
      }),
    ).toThrow();
    expect(() =>
      serverRuntimeEnvSchema.parse({
        ...validEnvironment,
        PLAYER_CREDENTIAL_KEYS: "not json",
      }),
    ).toThrow();
    expect(() =>
      serverRuntimeEnvSchema.parse({
        ...validEnvironment,
        OFFLINE_FLUSH_WINDOW_SECONDS: "0",
      }),
    ).toThrow();
    expect(
      serverRuntimeEnvSchema.parse({
        ...validEnvironment,
        PLAYER_CREDENTIAL_KEY_ID: "new",
        PLAYER_CREDENTIAL_KEYS: JSON.stringify({ new: "c".repeat(32) }),
      }).PLAYER_CREDENTIAL_KEYS.new,
    ).toBe("c".repeat(32));
  });
  it("memoizes successfully validated server settings", async () => {
    for (const [key, value] of Object.entries(validEnvironment))
      vi.stubEnv(key, value);
    const { getServerRuntimeEnv } = await import("@/server/config/env");
    const first = getServerRuntimeEnv();
    vi.stubEnv("APPLICATION_SECRET", "changed-after-startup");
    expect(getServerRuntimeEnv()).toBe(first);
  });
  it("allows the demo runtime without server secrets", () => {
    expect(
      runtimeEnvSchema.parse({
        APP_RUNTIME_MODE: "demo",
        NODE_ENV: "production",
      }),
    ).toMatchObject({ APP_RUNTIME_MODE: "demo", AUTH_DEV_BYPASS: false });
    expect(
      runtimeEnvSchema.parse({
        APP_RUNTIME_MODE: "demo",
        AUTH_DEV_BYPASS: "false",
      }).AUTH_DEV_BYPASS,
    ).toBe(false);
  });

  it("requires an explicit supported runtime mode", () => {
    expect(() => runtimeEnvSchema.parse({})).toThrow();
    expect(() =>
      runtimeEnvSchema.parse({ APP_RUNTIME_MODE: "preview" }),
    ).toThrow();
  });

  it("rejects the development bypass in demo mode", () => {
    expect(() =>
      runtimeEnvSchema.parse({
        APP_RUNTIME_MODE: "demo",
        AUTH_DEV_BYPASS: "true",
      }),
    ).toThrow(/AUTH_DEV_BYPASS/);
  });

  it("parses required runtime settings and allowed origins", () => {
    const result = serverRuntimeEnvSchema.parse(validEnvironment);

    expect(result.ALLOWED_ORIGINS).toEqual([
      "https://portal.example.org",
      "http://localhost:3000",
    ]);
    expect(result.READINESS_TIMEOUT_MS).toBe(2_000);
  });

  it("rejects non-PostgreSQL database URLs", () => {
    expect(() =>
      runtimeEnvSchema.parse({
        ...validEnvironment,
        DATABASE_URL: "https://example.org",
      }),
    ).toThrow();
  });

  it("rejects secrets shorter than 32 characters", () => {
    expect(() =>
      runtimeEnvSchema.parse({
        ...validEnvironment,
        APPLICATION_SECRET: "short",
      }),
    ).toThrow();
  });

  it("rejects origins containing paths", () => {
    expect(() =>
      runtimeEnvSchema.parse({
        ...validEnvironment,
        ALLOWED_ORIGINS: "https://portal.example.org/path",
      }),
    ).toThrow();
  });
});
