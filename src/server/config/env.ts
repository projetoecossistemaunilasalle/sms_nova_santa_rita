import { z } from "zod";

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

export const runtimeEnvSchema = z
  .object({
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
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    AUTH_DEV_BYPASS: authDevBypassSchema,
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === "production" && env.AUTH_DEV_BYPASS) {
      context.addIssue({
        code: "custom",
        path: ["AUTH_DEV_BYPASS"],
        message:
          "AUTH_DEV_BYPASS grants unauthenticated portal access and must not be enabled in production",
      });
    }
  });

export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;

let cachedEnv: RuntimeEnv | undefined;

export function getRuntimeEnv(): RuntimeEnv {
  cachedEnv ??= runtimeEnvSchema.parse(process.env);
  return cachedEnv;
}

export function validateRuntimeEnv(): void {
  getRuntimeEnv();
}

/**
 * Raw flag read for the request boundary (proxy), which runs before any route
 * and therefore cannot depend on the full runtime env being validated. Fails
 * closed: an unparseable value disables the bypass, and the runtime env schema
 * still rejects the flag outright in production.
 */
export function isAuthDevBypassEnabled(): boolean {
  return authDevBypassSchema.catch(false).parse(process.env.AUTH_DEV_BYPASS);
}
