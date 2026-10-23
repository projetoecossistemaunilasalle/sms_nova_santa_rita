import { DevBypassAuthGateway } from "./dev-bypass-gateway";
import { DemoAuthGateway } from "./demo-gateway";
import type { ActorSession } from "./session";
import { getRuntimeMode } from "@/runtime/mode";
import {
  getServerRuntimeEnv,
  isAuthDevBypassEnabled,
} from "@/server/config/env";

/**
 * Boundary between the application and authentication. Domain services and
 * layouts consume this contract; the Neon Auth implementation arrives in P1-04
 * and must keep the same application-owned session shape.
 */
export interface AuthGateway {
  /**
   * Resolves the current session, or null when it is missing, expired, or
   * inactive. Callers decide how to respond (e.g. redirect to sign-in).
   */
  getSession(): Promise<ActorSession | null>;
}

let cachedGateway: AuthGateway | undefined;

class ServerNeonAuthGateway implements AuthGateway {
  async getSession(): Promise<ActorSession | null> {
    const { NeonAuthGateway } = await import("./neon-gateway");
    return new NeonAuthGateway().getSession();
  }
}

export function getAuthGateway(): AuthGateway {
  if (cachedGateway) return cachedGateway;

  const mode = getRuntimeMode();
  if (mode === "demo") {
    cachedGateway = new DemoAuthGateway();
    return cachedGateway;
  }

  getServerRuntimeEnv();
  cachedGateway = isAuthDevBypassEnabled()
    ? new DevBypassAuthGateway()
    : new ServerNeonAuthGateway();
  return cachedGateway;
}

export const PROTECTED_PATHNAME_PREFIX = "/portal";

export function isProtectedPathname(pathname: string): boolean {
  return (
    pathname === PROTECTED_PATHNAME_PREFIX ||
    pathname.startsWith(`${PROTECTED_PATHNAME_PREFIX}/`)
  );
}
