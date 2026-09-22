import type { NextConfig } from "next";
import { z } from "zod";

const runtimeMode = z
  .enum(["demo", "server"])
  .parse(process.env.APP_RUNTIME_MODE);

if (runtimeMode === "server") {
  z.object({
    DATABASE_URL: z.string().url(),
    NEON_AUTH_BASE_URL: z.string().url(),
    NEON_AUTH_COOKIE_SECRET: z.string().min(32),
    APPLICATION_SECRET: z.string().min(32),
    AUTH_DEV_BYPASS: z.literal("false").optional(),
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
    },
  },
};

export default nextConfig;
