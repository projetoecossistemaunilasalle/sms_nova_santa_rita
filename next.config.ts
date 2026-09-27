import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { z } from "zod";

const runtimeMode = z
  .enum(["demo", "server"])
  .parse(process.env.APP_RUNTIME_MODE);

// AUTH_DEV_BYPASS is deliberately not asserted here: honoring it is a runtime
// decision, and requiring "false" at config load blocked `next dev` and
// `next build` for anyone using the flag locally.
if (runtimeMode === "server") {
  z.object({
    DATABASE_URL: z.string().url(),
    NEON_AUTH_BASE_URL: z.string().url(),
    NEON_AUTH_COOKIE_SECRET: z.string().min(32),
    APPLICATION_SECRET: z.string().min(32),
  }).parse(process.env);
}

const nextConfig = (phase: string): NextConfig => ({
  ...(runtimeMode === "demo"
    ? {
        // Static export is a build target, not a development-server mode.
        // Proxy and request-dependent API routes cannot run under `output: export`.
        ...(phase === PHASE_DEVELOPMENT_SERVER
          ? { distDir: ".next-demo-dev" }
          : { output: "export" as const, basePath: "/SMS_Portal" }),
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : { output: "standalone" as const }),
  poweredByHeader: false,
  reactStrictMode: true,
  env: {
    APP_RUNTIME_MODE: runtimeMode,
    APP_BASE_PATH:
      runtimeMode === "demo" && phase !== PHASE_DEVELOPMENT_SERVER
        ? "/SMS_Portal"
        : "",
  },
});

export default nextConfig;
