import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isAuthDevBypassEnabled } from "@/server/config/env";
import {
  correlationIdFromRequest,
  CORRELATION_HEADER,
} from "@/server/http/correlation";
import { isProtectedPathname } from "@/server/auth/gateway";

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

function contentSecurityPolicy(nonce: string): string {
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
    process.env.NODE_ENV === "production"
      ? "upgrade-insecure-requests"
      : undefined,
  ]
    .filter(Boolean)
    .join("; ");
}

function hasSessionCookie(request: NextRequest): boolean {
  // Neon Auth (via @neondatabase/auth) issues an HttpOnly session cookie.
  // The exact name is SDK-dependent (`neon-auth`, `__Secure-neon-auth`,
  // `portal_session`, etc.). Check a small allowlist and fall back to any
  // cookie that looks like a session/auth token so a future valid Neon
  // session is not rejected by the edge boundary.
  const candidates = [
    "neon-auth.session",
    "neon-auth",
    "__Secure-neon-auth",
    "portal_session",
    "__Host-portal_session",
    "__session",
    "authjs.session-token",
    "__Secure-authjs.session-token",
  ];
  for (const name of candidates) {
    if (request.cookies.has(name)) return true;
  }
  // Fallback: any cookie whose name suggests an auth session.
  for (const cookie of request.cookies.getAll()) {
    const n = cookie.name.toLowerCase();
    if (n.includes("neon") && n.includes("auth")) return true;
    if (n.includes("session") && n.includes("auth")) return true;
  }
  return false;
}

export function proxy(request: NextRequest): NextResponse {
  const correlationId = correlationIdFromRequest(request);
  const nonce = createNonce();
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CORRELATION_HEADER, correlationId);
  requestHeaders.set("x-nonce", nonce);
  // Next.js reads the nonce from the *request* Content-Security-Policy header
  // during SSR (getScriptNonceFromHeader). The same value must also be sent on
  // the response so the browser can enforce it.
  requestHeaders.set("Content-Security-Policy", csp);

  // Protect the professional portal before rendering so unauthenticated page
  // data cannot stream before the boundary responds. Activity links and the
  // sign-in route remain public.
  // In production (bypass disabled) we only redirect when no session cookie
  // is present; if a cookie is present we let the request reach the layout,
  // where `getAuthGateway().getSession()` validates it. This allows a future
  // valid Neon session to be admitted instead of being blocked at the edge.
  const isProtected = isProtectedPathname(request.nextUrl.pathname);
  const shouldRedirect =
    isProtected && !isAuthDevBypassEnabled() && !hasSessionCookie(request);

  const response = shouldRedirect
    ? NextResponse.redirect(new URL("/entrar", request.url))
    : NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set(CORRELATION_HEADER, correlationId);
  response.headers.set("Content-Security-Policy", csp);
  // Public activity links are opaque tokens in the URL path and are forwarded
  // to GameMaker via ?activity_token. Use 'no-referrer' for those routes so
  // the token never leaks via Referer, even same-origin. Other routes keep a
  // stricter default.
  const referrerPolicy = request.nextUrl.pathname.startsWith("/atividade/")
    ? "no-referrer"
    : "strict-origin-when-cross-origin";
  response.headers.set("Referrer-Policy", referrerPolicy);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  return response;
}

export const config = {
  matcher: "/((?!_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
};
