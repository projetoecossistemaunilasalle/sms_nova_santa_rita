import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import type { NextConfig } from "next";
import { z } from "zod";

const runtimeMode = z
  .enum(["demo", "server"])
  .parse(process.env.APP_RUNTIME_MODE);

const landingCspFile = path.join(__dirname, ".landing", "csp.json");
const landing = existsSync(landingCspFile)
  ? z
      .object({
        hashes: z.array(z.string().regex(/^'sha256-[A-Za-z0-9+/]{43}='$/)),
      })
      .parse(JSON.parse(readFileSync(landingCspFile, "utf8")))
  : undefined;
const landingHeaders = landing
  ? [
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          ["script-src 'self'", ...landing.hashes].join(" "),
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "media-src 'self' blob:",
          "font-src 'self' data:",
          "connect-src 'self'",
          "worker-src 'self'",
          "frame-src 'self'",
          "frame-ancestors 'self'",
          "base-uri 'self'",
          "form-action 'self'",
          "object-src 'none'",
        ].join("; "),
      },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ]
  : [];

// AUTH_DEV_BYPASS is deliberately not asserted here: honoring it is a runtime
// decision, and requiring "false" at config load blocked `next dev` and
// `next build` for anyone using the flag locally.
if (runtimeMode === "server") {
  z.object({
    DATABASE_URL: z.string().url(),
    NEON_AUTH_BASE_URL: z.string().url(),
    NEON_AUTH_COOKIE_SECRET: z.string().min(32),
    APPLICATION_SECRET: z.string().min(32),
  }).parse(process.env);
}

const nextConfig: NextConfig = {
  output: "standalone",
  // This app lives in portal/ of a repository whose root has its own
  // package-lock.json; without an explicit root Next picks the repository root
  // and nests the standalone server under .next/standalone/portal/.
  outputFileTracingRoot: path.join(__dirname),
  turbopack: { root: path.join(__dirname) },
  poweredByHeader: false,
  reactStrictMode: true,
  env: {
    APP_RUNTIME_MODE: runtimeMode,
    APP_BASE_PATH: "",
    // Next inlines this into the proxy; no runtime filesystem dependency.
    LANDING_BUNDLED: landing ? "true" : "false",
  },
  ...(landing
    ? {
        // The built-in slash redirect precedes custom redirects. Replace it
        // with the same rule *after* /jogo so both wrapper URLs get one 307.
        skipTrailingSlashRedirect: true,
        redirects: () =>
          Promise.resolve([
            {
              source: "/jogo",
              destination: "/jogo/index.html",
              permanent: false,
            },
            {
              source: "/jogo/",
              destination: "/jogo/index.html",
              permanent: false,
            },
            { source: "/:path+/", destination: "/:path+", permanent: true },
          ]),
        rewrites: () =>
          Promise.resolve({
            beforeFiles: [{ source: "/", destination: "/index.html" }],
            afterFiles: [],
            fallback: [],
          }),
      }
    : {}),
  // Same-origin game build copied to public/jogo-cliente/ (local E2E and any
  // host without a reverse proxy in front). Embeddable only by this origin.
  // The game is static and self-contained, so its CSP needs no nonce.
  headers() {
    return Promise.resolve([
      {
        source: "/jogo-cliente/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/jogo-cliente/:file(service-worker\\.js|offline-shell\\.json)",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
      ...(landing
        ? [
            ...[
              "/",
              "/index.html",
              "/_astro/:path*",
              "/assets/:path*",
              "/favicon.svg",
              "/jogo/:path*",
            ].map((source) => ({ source, headers: landingHeaders })),
            {
              source:
                "/jogo/runtime/:file(service-worker\\.js|offline-shell\\.json)",
              headers: [{ key: "Cache-Control", value: "no-cache" }],
            },
          ]
        : []),
    ]);
  },
};

export default nextConfig;
