import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { z } from "zod";

const runtimeMode = z
  .enum(["demo", "server"])
  .parse(process.env.APP_RUNTIME_MODE);

// Mount point of the static demo export. Defaults to this repository's GitHub
// Pages path; override with DEMO_BASE_PATH when the export is published under
// a different nested base path (e.g. DEMO_BASE_PATH=portal). The leading
// slash is optional because Git Bash rewrites a '/portal' value into a
// Windows drive path when spawning Node, which would otherwise fail here.
const demoBasePath = z
  .string()
  .refine((value) => !/^[A-Za-z]:[\\/]/.test(value), {
    message:
      "DEMO_BASE_PATH looks like a Windows path: Git Bash rewrote a leading '/...' value. Set DEMO_BASE_PATH=portal without the leading slash, or prefix the command with MSYS_NO_PATHCONV=1.",
  })
  .transform((value) =>
    value !== "" && !value.startsWith("/") ? `/${value}` : value,
  )
  .refine((value) => !value.endsWith("/"), {
    message: "DEMO_BASE_PATH must not end with a trailing slash",
  })
  .default("/SMS_Portal")
  .parse(process.env.DEMO_BASE_PATH);

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
          : { output: "export" as const, basePath: demoBasePath }),
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
        ? demoBasePath
        : "",
  },
});

export default nextConfig;
