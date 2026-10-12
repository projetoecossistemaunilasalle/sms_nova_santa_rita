import { afterEach, describe, expect, it, vi } from "vitest";

import { isAuthDevBypassEnabled } from "@/server/config/env";
import { runtimeEnvSchema } from "@/server/config/env";
import { isProtectedPathname } from "@/server/auth/gateway";

const validEnvironment = {
  APP_RUNTIME_MODE: "server",
  DATABASE_URL:
    "postgresql://user:password@example.neon.tech/database?sslmode=require",
  NEON_AUTH_BASE_URL:
    "https://example.neonauth.us-east-2.aws.neon.tech/neondb/auth",
  NEON_AUTH_COOKIE_SECRET: "a".repeat(32),
  APPLICATION_SECRET: "b".repeat(32),
};

async function loadGatewayWithEnv(env: Record<string, string>) {
  vi.resetModules();

  const overrides: Record<string, string> = { ...validEnvironment, ...env };
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(overrides)) {
    previous.set(key, process.env[key]);
    process.env[key] = overrides[key];
  }

  try {
    const { getAuthGateway } = await import("@/server/auth/gateway");
    // The gateway must be created while the environment is set: it reads and
    // caches the runtime env at construction time.
    return getAuthGateway();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

afterEach(() => {
  vi.resetModules();
});

describe("runtimeEnvSchema AUTH_DEV_BYPASS", () => {
  it("defaults to disabled", () => {
    const result = runtimeEnvSchema.parse(validEnvironment);

    expect(result.AUTH_DEV_BYPASS).toBe(false);
  });

  it("parses string booleans", () => {
    expect(
      runtimeEnvSchema.parse({
        ...validEnvironment,
        AUTH_DEV_BYPASS: "true",
      }).AUTH_DEV_BYPASS,
    ).toBe(true);
    expect(
      runtimeEnvSchema.parse({
        ...validEnvironment,
        AUTH_DEV_BYPASS: "false",
      }).AUTH_DEV_BYPASS,
    ).toBe(false);
  });

  it("rejects unknown flag values", () => {
    expect(() =>
      runtimeEnvSchema.parse({
        ...validEnvironment,
        AUTH_DEV_BYPASS: "maybe",
      }),
    ).toThrow();
  });

  it("rejects enabling the bypass in production", () => {
    expect(() =>
      runtimeEnvSchema.parse({
        ...validEnvironment,
        NODE_ENV: "production",
        AUTH_DEV_BYPASS: "true",
      }),
    ).toThrow(/AUTH_DEV_BYPASS/);
  });

  it("allows enabling the bypass outside production", () => {
    expect(() =>
      runtimeEnvSchema.parse({
        ...validEnvironment,
        NODE_ENV: "development",
        AUTH_DEV_BYPASS: "true",
      }),
    ).not.toThrow();
  });
});

describe("getAuthGateway", () => {
  it("serves a synthetic dev session when the flag is enabled", async () => {
    const gateway = await loadGatewayWithEnv({
      NODE_ENV: "development",
      AUTH_DEV_BYPASS: "true",
    });

    const session = await gateway.getSession();
    expect(session?.actor.displayName).toBe("Adriana Martins");
    expect(session?.actor.email).toBe("dev@localhost");
    expect(session?.actor.authUserId).toBe("dev-bypass-local");
    expect(session?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("selects Neon Auth when the server bypass is disabled", async () => {
    const gateway = await loadGatewayWithEnv({
      AUTH_DEV_BYPASS: "false",
    });

    expect(gateway.constructor.name).toBe("ServerNeonAuthGateway");
  });

  it("cannot select the development bypass in a production server", async () => {
    await expect(
      loadGatewayWithEnv({
        NODE_ENV: "production",
        AUTH_DEV_BYPASS: "true",
      }),
    ).rejects.toThrow(/AUTH_DEV_BYPASS/);
  });

  it("selects the isolated demo gateway only for the demo target", async () => {
    const gateway = await loadGatewayWithEnv({
      APP_RUNTIME_MODE: "demo",
      AUTH_DEV_BYPASS: "false",
    });

    expect(gateway.constructor.name).toBe("DemoAuthGateway");
  });
});

describe("isProtectedPathname", () => {
  it("matches the portal root and nested portal routes", () => {
    expect(isProtectedPathname("/portal")).toBe(true);
    expect(isProtectedPathname("/portal/turmas")).toBe(true);
    expect(isProtectedPathname("/portal/turmas/turma-1")).toBe(true);
  });

  it("does not match other routes or lookalike prefixes", () => {
    expect(isProtectedPathname("/")).toBe(false);
    expect(isProtectedPathname("/entrar")).toBe(false);
    expect(isProtectedPathname("/portal-backup")).toBe(false);
    expect(isProtectedPathname("/jogar")).toBe(false);
  });
});

describe("isAuthDevBypassEnabled", () => {
  const flagKey = "AUTH_DEV_BYPASS";
  const mutatedKeys = [flagKey, "APP_RUNTIME_MODE", "NODE_ENV"] as const;

  // Captures the prior value of every environment variable this suite mutates,
  // runs the callback, and restores exactly the captured values afterwards
  // (deleting only the keys that were unset before) so nothing leaks between
  // tests.
  function withMutatedEnv<T>(run: () => T): T {
    const previous = new Map<string, string | undefined>();
    for (const key of mutatedKeys) {
      previous.set(key, process.env[key]);
    }

    try {
      return run();
    } finally {
      for (const [key, value] of previous) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  }

  it("is disabled by default", () => {
    expect(isAuthDevBypassEnabled()).toBe(false);
  });

  it("follows the flag value", () => {
    withMutatedEnv(() => {
      process.env.APP_RUNTIME_MODE = "server";
      (process.env as Record<string, string | undefined>).NODE_ENV =
        "development";
      process.env[flagKey] = "true";
      expect(isAuthDevBypassEnabled()).toBe(true);

      process.env[flagKey] = "false";
      expect(isAuthDevBypassEnabled()).toBe(false);
    });
  });

  it("fails closed on unparseable values", () => {
    withMutatedEnv(() => {
      process.env.APP_RUNTIME_MODE = "server";
      (process.env as Record<string, string | undefined>).NODE_ENV =
        "development";
      process.env[flagKey] = "maybe";
      expect(isAuthDevBypassEnabled()).toBe(false);
    });
  });

  it("restores the captured prior environment after a mutation cycle", () => {
    const priorFlagValue = "preexisting-sentinel";
    const priorRuntimeMode = process.env.APP_RUNTIME_MODE;
    const priorNodeEnv = process.env.NODE_ENV;
    const originalFlagValue = process.env[flagKey];
    process.env[flagKey] = priorFlagValue;

    try {
      const enabled = withMutatedEnv(() => {
        process.env.APP_RUNTIME_MODE = "server";
        (process.env as Record<string, string | undefined>).NODE_ENV =
          "development";
        process.env[flagKey] = "true";
        return isAuthDevBypassEnabled();
      });

      expect(enabled).toBe(true);
      expect(process.env[flagKey]).toBe(priorFlagValue);
      expect(process.env.APP_RUNTIME_MODE).toBe(priorRuntimeMode);
      expect(process.env.NODE_ENV).toBe(priorNodeEnv);
    } finally {
      if (originalFlagValue === undefined) {
        delete process.env[flagKey];
      } else {
        process.env[flagKey] = originalFlagValue;
      }
    }
  });
});
