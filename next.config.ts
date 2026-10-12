import type { NextConfig } from "next";
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

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  env: {
    APP_RUNTIME_MODE: runtimeMode,
    APP_BASE_PATH: "",
  },
};

export default nextConfig;
