import { describe, expect, it } from "vitest";

import { runtimeEnvSchema } from "@/server/config/env";

const validEnvironment = {
  DATABASE_URL:
    "postgresql://user:password@example.neon.tech/database?sslmode=require",
  NEON_AUTH_BASE_URL:
    "https://example.neonauth.us-east-2.aws.neon.tech/neondb/auth",
  NEON_AUTH_COOKIE_SECRET: "a".repeat(32),
  APPLICATION_SECRET: "b".repeat(32),
  ALLOWED_ORIGINS: "https://portal.example.org,http://localhost:3000",
};

describe("runtimeEnvSchema", () => {
  it("parses required runtime settings and allowed origins", () => {
    const result = runtimeEnvSchema.parse(validEnvironment);

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
