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
  ...(runtimeMode === "demo"
    ? {
        output: "export" as const,
        basePath: "/SMS_Portal",
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : { output: "standalone" as const }),
  poweredByHeader: false,
  reactStrictMode: true,
  env: {
    APP_RUNTIME_MODE: runtimeMode,
    APP_BASE_PATH: runtimeMode === "demo" ? "/SMS_Portal" : "",
  },
  turbopack: {
    resolveAlias: {
      "@runtime/sign-in-action":
        runtimeMode === "demo"
          ? "./src/runtime/demo-auth-actions.ts"
          : "./src/app/(professional)/entrar/actions.ts",
      "@runtime/sign-out-action":
        runtimeMode === "demo"
          ? "./src/runtime/demo-auth-actions.ts"
          : "./src/app/(professional)/portal/sign-out-action.ts",
      "@runtime/adult-portal":
        runtimeMode === "demo"
          ? "./src/runtime/adult-portal-demo.ts"
          : "./src/runtime/adult-portal-server.ts",
      "@runtime/adult-portal-actions":
        runtimeMode === "demo"
          ? "./src/runtime/adult-portal-demo-actions.ts"
          : "./src/app/(professional)/portal/adult-portal-actions.ts",
      "@runtime/adult-portal-client":
        runtimeMode === "demo"
          ? "./src/runtime/adult-portal-demo-client.ts"
          : "./src/runtime/adult-portal-server-client.ts",
      "@runtime/player-access-actions":
        runtimeMode === "demo"
          ? "./src/runtime/player-access-demo-actions.ts"
          : "./src/app/(professional)/portal/player-access-actions.ts",
      "@runtime/player-entry-action":
        runtimeMode === "demo"
          ? "./src/runtime/player-entry-demo-actions.ts"
          : "./src/app/(public-play)/jogar/actions.ts",
      "@runtime/player-access":
        runtimeMode === "demo"
          ? "./src/runtime/player-access-demo.ts"
          : "./src/runtime/player-access-server.ts",
    },
  },
};

export default nextConfig;
