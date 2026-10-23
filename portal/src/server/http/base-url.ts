import "server-only";

import { headers } from "next/headers";

import { getRuntimeEnv } from "@/server/config/env";

/**
 * Resolves the externally visible origin (scheme + host) used to build
 * shareable URLs rendered in the professional portal.
 *
 * Why request headers are not trusted blindly: `host` and
 * `x-forwarded-proto` are chosen by whoever sends the request unless an edge
 * proxy normalizes them. Rendering a URL derived from an attacker-controlled
 * Host would let crafted requests inject arbitrary origins into share links
 * shown to professionals (link injection via Host header). So:
 * - `x-forwarded-proto` is only accepted when it is exactly "http" or
 *   "https" (first value); any other shape means it cannot be trusted.
 * - The derived origin is used ONLY when it is explicitly allowlisted in
 *   ALLOWED_ORIGINS; otherwise — and whenever headers are unavailable — the
 *   FIRST configured origin wins (defaults to http://localhost:3000).
 */
export async function getPublicBaseUrl(): Promise<string> {
  const environment = getRuntimeEnv();
  const allowedOrigins =
    environment.APP_RUNTIME_MODE === "server"
      ? environment.ALLOWED_ORIGINS
      : ["http://localhost:3000"];
  const fallbackOrigin = allowedOrigins[0] ?? "http://localhost:3000";

  try {
    const h = await headers();
    const host = h.get("host");
    const forwardedProto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (!host || (forwardedProto !== "http" && forwardedProto !== "https")) {
      return fallbackOrigin;
    }
    const derivedOrigin = `${forwardedProto}://${host}`;
    return allowedOrigins.includes(derivedOrigin)
      ? derivedOrigin
      : fallbackOrigin;
  } catch {
    // headers() is unavailable outside a request scope (e.g. prerender).
    return fallbackOrigin;
  }
}
