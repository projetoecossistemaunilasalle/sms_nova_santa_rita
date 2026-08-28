import { createHash, randomBytes } from "node:crypto";

/**
 * Raw access-link token utilities.
 *
 * Invariants:
 * - A raw token exists only in memory during the request that created or
 *   rotated it, and is shown to the professional exactly once. It is never
 *   persisted, logged, or embedded in audit payloads or error messages.
 * - Only the SHA-256 digest of the token (`token_hash`, lowercase hex) is
 *   stored; the public host re-derives the digest to resolve a link.
 */

/** Entropy source size in bytes: 32 random bytes = 256 bits. */
const TOKEN_BYTE_LENGTH = 32;

/**
 * Encoded length of a raw token: 32 bytes base64url-encoded without padding
 * produce exactly 43 characters (no `=` padding, URL-safe alphabet).
 */
export const ACCESS_LINK_TOKEN_LENGTH = 43;

/**
 * Unpadded base64url alphabet: `A-Z`, `a-z`, `0-9`, `-`, `_`, exactly
 * {@link ACCESS_LINK_TOKEN_LENGTH} characters.
 */
const ACCESS_TOKEN_PATTERN = new RegExp(
  `^[A-Za-z0-9_-]{${ACCESS_LINK_TOKEN_LENGTH}}$`,
);

/**
 * Generates a new raw access-link token: exactly 32 random bytes (256-bit
 * entropy) from `node:crypto.randomBytes`, base64url-encoded without padding.
 *
 * The returned string is secret material. Persist only
 * {@link hashToken}`(token)` and return the raw value to the caller exactly
 * once, at creation/rotation time.
 */
export function generateAccessLinkToken(): string {
  return randomBytes(TOKEN_BYTE_LENGTH).toString("base64url");
}

/**
 * Derives the persisted representation of a raw token: the SHA-256 digest as
 * lowercase hex (64 characters), matching the `access_links.token_hash`
 * column. Deterministic: the same raw token always yields the same digest,
 * which lets the public host resolve a link without storing the secret.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Strict shape check for a token received from the outside world: unpadded
 * base64url charset and the exact expected length. Use it to reject malformed
 * tokens early, before any database lookup, without leaking whether a
 * similarly-shaped token exists.
 */
export function isValidAccessTokenFormat(token: string): boolean {
  return ACCESS_TOKEN_PATTERN.test(token);
}
