import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  correlationIdFromRequest,
  CORRELATION_HEADER,
} from "@/server/http/correlation";

function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

function authOrigin(): string | undefined {
  const authUrl = process.env.NEON_AUTH_BASE_URL;
  if (!authUrl) return undefined;

  try {
    return new URL(authUrl).origin;
  } catch {
    return undefined;
  }
}

function gameClientOrigin(): string | undefined {
  const gameUrl = process.env.GAME_CLIENT_URL;
  if (!gameUrl) return undefined;

  try {
    const url = new URL(gameUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }
    return url.origin;
  } catch {
    return undefined;
  }
}

function isLoopbackRequest(request: NextRequest): boolean {
  // Prefer Host: a reverse proxy may use a loopback URL for a public request.
  // Match the whole authority, not a substring or client-supplied scheme hint.
  const host = request.headers.get("host") ?? request.nextUrl.host;
  return /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
}

function contentSecurityPolicy(nonce: string, enforceHttps: boolean): string {
  const connectSources = [
    "'self'",
    "https://*.neon.tech",
    "wss://*.neon.tech",
    authOrigin(),
  ]
    .filter(Boolean)
    .join(" ");
  // Nonce-based CSP: per-request nonce is injected into script-src
  // and forwarded via the `Content-Security-Policy` request header so
  // Next.js can extract it with getScriptNonceFromHeader() and stamp every inline
  // script emitted during SSR (e.g. self.__next_f.push). That avoids the
  // `script-src 'self'`-only violation (2 inline scripts with 0 nonce) on
  // /entrar. `'strict-dynamic'` is required alongside the nonce so trusted
  // scripts can load their dependencies; `'unsafe-eval'` is kept only in dev
  // because React uses eval for server error stacks. `style-src` is configured
  // with `'self' 'unsafe-inline'` to support Next.js CSS modules, style tags,
  // and React inline style attributes across pages.
  const scriptSources = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    process.env.NODE_ENV === "development" ? "'unsafe-eval'" : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  const styleSources = ["'self'", "'unsafe-inline'"].join(" ");
  const frameSources = ["'self'", gameClientOrigin()].filter(Boolean).join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSources}`,
    `style-src ${styleSources}`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `frame-src ${frameSources}`,
    `connect-src ${connectSources}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    enforceHttps ? "upgrade-insecure-requests" : undefined,
  ]
    .filter(Boolean)
    .join("; ");
}

export function proxy(request: NextRequest): NextResponse {
  const correlationId = correlationIdFromRequest(request);
  const nonce = createNonce();
  const enforceHttps =
    process.env.NODE_ENV === "production" && !isLoopbackRequest(request);
  const csp = contentSecurityPolicy(nonce, enforceHttps);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CORRELATION_HEADER, correlationId);
  requestHeaders.set("x-nonce", nonce);
  // Next.js reads the nonce from the *request* Content-Security-Policy header
  // during SSR (getScriptNonceFromHeader). The same value must also be sent on
  // the response so the browser can enforce it.
  requestHeaders.set("Content-Security-Policy", csp);

  // Authentication is enforced in the portal server layout through the
  // official Neon Auth adapter. This proxy never interprets auth cookies.
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set(CORRELATION_HEADER, correlationId);
  response.headers.set("Content-Security-Policy", csp);
  // /jogar is the public play surface handed off to the GameMaker client.
  // Keep 'no-referrer' so nothing about the player context leaks via Referer
  // to third origins. Other routes keep a stricter default.
  const referrerPolicy =
    request.nextUrl.pathname === "/jogar" ||
    request.nextUrl.pathname.startsWith("/jogar/")
      ? "no-referrer"
      : "strict-origin-when-cross-origin";
  response.headers.set("Referrer-Policy", referrerPolicy);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );

  if (enforceHttps) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  return response;
}

export const config = {
  // jogo-cliente/ is the same-origin game build (static files). The portal's
  // nonce CSP and frame-ancestors 'none' would stop it from running inside the
  // /jogar iframe; next.config.ts gives it its own same-origin framing headers.
  matcher:
    "/((?!_next|jogo-cliente/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
};
