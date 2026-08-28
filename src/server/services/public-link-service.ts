import "server-only";

import { hashToken, isValidAccessTokenFormat } from "@/server/security/tokens";
import type {
  AccessLinkRecord,
  AccessLinkStore,
  Clock,
} from "@/server/services/access-link-service";

export type PublicLinkStatus =
  "invalid" | "revoked" | "paused" | "expired" | "valid";

export type PublicLinkResolution =
  | { status: "invalid" }
  | { status: "revoked"; link: AccessLinkRecord }
  | { status: "paused"; link: AccessLinkRecord }
  | { status: "expired"; link: AccessLinkRecord }
  | { status: "valid"; link: AccessLinkRecord };

/**
 * Validates a raw public activity token against format, existence,
 * revocation, pause and expiry. Never returns token material; only a status
 * and the link record when applicable.
 *
 * Invariants:
 * - Malformed tokens are rejected before any database lookup
 *   (using `isValidAccessTokenFormat`) to avoid unnecessary load
 *   and to not leak whether a similarly-shaped token exists.
 * - Only the SHA-256 digest is used for the lookup (`hashToken`).
 * - Post-lookup precedence (first match wins): revoked → paused → expired →
 *   valid. Revocation is terminal and outranks a pause; a paused link keeps
 *   its token/URL and may become valid again once resumed.
 */
export async function resolvePublicLink(
  token: string,
  deps: { store: AccessLinkStore; clock: Clock },
): Promise<PublicLinkResolution> {
  if (!isValidAccessTokenFormat(token)) {
    return { status: "invalid" };
  }

  const tokenHash = hashToken(token);
  const link = await deps.store.findByTokenHash(tokenHash);

  if (link === null) {
    return { status: "invalid" };
  }

  if (link.revokedAt !== null) {
    return { status: "revoked", link };
  }

  if (link.pausedAt !== null) {
    return { status: "paused", link };
  }

  if (
    link.expiresAt !== null &&
    link.expiresAt.getTime() <= deps.clock.now().getTime()
  ) {
    return { status: "expired", link };
  }

  return { status: "valid", link };
}
