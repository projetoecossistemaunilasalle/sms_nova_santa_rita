/**
 * Portal-side status vocabulary for access links, shared by the professional
 * pages. The strings double as valid `ActivityStatus` values rendered by
 * {@link StatusBadge}.
 */
export type LinkStatus = "Aberta" | "Pausada" | "Encerrada";

/**
 * Maps a persisted access-link row to the portal status vocabulary.
 *
 * Precedence mirrors `resolvePublicLink` (public-link-service.ts):
 * revoked → paused → expired → open. Keeping one shared implementation means
 * the professional portal and the public activity page always agree about
 * the same row:
 * - Revocation is terminal ⇒ "Encerrada", outranking everything.
 * - A paused link stays "Pausada" EVEN when its expiry has passed: pausing
 *   temporarily hides the expiry, and resuming surfaces it ("Encerrada").
 * - An unpaused link whose `expiresAt` has passed ⇒ "Encerrada".
 *
 * Expiry is evaluated against `Date.now()` at call time; every consumer is
 * a dynamic-rendered page, so each request re-evaluates fresh state.
 */
export function resolveLinkStatus(record: {
  revokedAt: Date | null;
  pausedAt: Date | null;
  expiresAt: Date | null;
}): LinkStatus {
  if (record.revokedAt !== null) {
    return "Encerrada";
  }
  if (record.pausedAt !== null) {
    return "Pausada";
  }
  if (record.expiresAt !== null && record.expiresAt.getTime() <= Date.now()) {
    return "Encerrada";
  }
  return "Aberta";
}
