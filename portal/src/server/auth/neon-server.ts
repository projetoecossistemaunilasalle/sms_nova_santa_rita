import "server-only";

import { createNeonAuth } from "@neondatabase/auth/next/server";

import { getServerRuntimeEnv } from "@/server/config/env";

let authServer: ReturnType<typeof createNeonAuth> | undefined;

export function getNeonAuthServer(): ReturnType<typeof createNeonAuth> {
  if (authServer) return authServer;

  const environment = getServerRuntimeEnv();
  authServer = createNeonAuth({
    baseUrl: environment.NEON_AUTH_BASE_URL,
    cookies: {
      secret: environment.NEON_AUTH_COOKIE_SECRET,
      sessionDataTtl: 300,
    },
    logLevel: environment.NODE_ENV === "production" ? "warn" : "error",
  });

  return authServer;
}
