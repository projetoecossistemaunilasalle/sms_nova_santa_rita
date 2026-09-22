import { z } from "zod";

import { runtimeModeSchema } from "@/runtime/mode";

const postgresUrl = z
  .string()
  .url()
  .refine(
    (value) =>
      value.startsWith("postgresql://") || value.startsWith("postgres://"),
    {
      message: "Must be a PostgreSQL URL",
    },
  );

const commaSeparatedOrigins = z.string().transform((value, context) => {
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  for (const origin of origins) {
    try {
      if (new URL(origin).origin !== origin) {
        throw new Error("Origin must not include a path");
      }
    } catch {
      context.addIssue({
        code: "custom",
        message: `Invalid allowed origin: ${origin}`,
      });
    }
  }

  return origins;
});

export const authDevBypassSchema = z.stringbool().default(false);

const sharedRuntimeEnvSchema = z.object({
  APP_RUNTIME_MODE: runtimeModeSchema,
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  AUTH_DEV_BYPASS: authDevBypassSchema,
});

export const demoRuntimeEnvSchema = sharedRuntimeEnvSchema
  .extend({
    APP_RUNTIME_MODE: z.literal("demo"),
  })
  .superRefine((env, context) => {
    if (env.AUTH_DEV_BYPASS) {
      context.addIssue({
        code: "custom",
        path: ["AUTH_DEV_BYPASS"],
        message: "AUTH_DEV_BYPASS is only available in the server runtime",
      });
    }
  });

export const serverRuntimeEnvSchema = sharedRuntimeEnvSchema
  .extend({
    APP_RUNTIME_MODE: z.literal("server"),
    DATABASE_URL: postgresUrl,
    NEON_AUTH_BASE_URL: z.string().url(),
    NEON_AUTH_COOKIE_SECRET: z.string().min(32),
    APPLICATION_SECRET: z.string().min(32),
    ALLOWED_ORIGINS: commaSeparatedOrigins.default(["http://localhost:3000"]),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    READINESS_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(100)
      .max(10_000)
      .default(2_000),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === "production" && env.AUTH_DEV_BYPASS) {
      context.addIssue({
        code: "custom",
        path: ["AUTH_DEV_BYPASS"],
        message:
          "AUTH_DEV_BYPASS grants unauthenticated portal access and must not be enabled in a production server runtime",
      });
    }
  });

export const runtimeEnvSchema = z.union([
  demoRuntimeEnvSchema,
  serverRuntimeEnvSchema,
]);

export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;
export type ServerRuntimeEnv = z.infer<typeof serverRuntimeEnvSchema>;

let cachedEnv: RuntimeEnv | undefined;

export function getRuntimeEnv(): RuntimeEnv {
  cachedEnv ??= runtimeEnvSchema.parse(process.env);
  return cachedEnv;
}

export function validateRuntimeEnv(): void {
  getRuntimeEnv();
}

export function getServerRuntimeEnv(): ServerRuntimeEnv {
  return serverRuntimeEnvSchema.parse(process.env);
}

/**
 * Raw flag read for the request boundary (proxy), which runs before any route
 * and therefore cannot depend on the full runtime env being validated. Fails
 * closed: an unparseable value disables the bypass, and the runtime env schema
 * still rejects the flag outright in production.
 */
export function isAuthDevBypassEnabled(): boolean {
  if (process.env.APP_RUNTIME_MODE !== "server") return false;
  if (process.env.NODE_ENV === "production") return false;
  return authDevBypassSchema.catch(false).parse(process.env.AUTH_DEV_BYPASS);
}
