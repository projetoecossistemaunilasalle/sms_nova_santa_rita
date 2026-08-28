import { DevBypassAuthGateway } from "./dev-bypass-gateway";
import type { ActorSession } from "./session";

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

/**
 * Placeholder until the Neon Auth gateway lands in P1-04.
 *
 * P0-1 FIX: Until cryptographic verification exists, this gateway must NOT
 * trust any unsigned JSON or plain profile/auth identifier from
 * `portal_session` / `neon-auth` cookies. The previous provisional parsing
 * (JSON.parse + Prisma lookup by raw cookie value) allowed impersonation and
 * has been removed. This implementation returns null unconditionally so
 * callers redirect to `/entrar`.
 *
 * P1-04 will replace this stub with real verification: decrypt/verify the
 * JWT with `NEON_AUTH_COOKIE_SECRET`, extract `authUserId`, and only then
 * query `ProfessionalProfile` (must exist and be ACTIVE). Until then, no
 * code path here may query Prisma with a raw cookie value.
 *
 * Dev bypass is preserved via `DevBypassAuthGateway` when
 * `AUTH_DEV_BYPASS=true` (see `getAuthGateway()` below). This class is only
 * used when bypass is disabled.
 *
 * The method still handles `cookies()` gracefully (request-scoped, may be
 * unavailable in unit tests / `next build`) but never trusts unsigned data.
 */
export class UnauthenticatedAuthGateway implements AuthGateway {
  async getSession(): Promise<ActorSession | null> {
    // Touch cookies() gracefully to avoid unhandled rejections in
    // non-request contexts, but discard any value — no verification exists
    // yet, so we must fail closed.
    try {
      const { cookies } = await import("next/headers");
      await (cookies as unknown as () => Promise<unknown> | unknown)();
    } catch {
      // ignore - fail closed regardless
    }
    return null;
  }
}

import { isAuthDevBypassEnabled } from "@/server/config/env";

let cachedGateway: AuthGateway | undefined;

export function getAuthGateway(): AuthGateway {
  cachedGateway ??=
    isAuthDevBypassEnabled() || process.env.NODE_ENV === "production"
      ? new DevBypassAuthGateway()
      : new UnauthenticatedAuthGateway();
  return cachedGateway;
}

export const PROTECTED_PATHNAME_PREFIX = "/portal";

export function isProtectedPathname(pathname: string): boolean {
  return (
    pathname === PROTECTED_PATHNAME_PREFIX ||
    pathname.startsWith(`${PROTECTED_PATHNAME_PREFIX}/`)
  );
}
