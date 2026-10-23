import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";

import { config, proxy } from "@/proxy";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Proxy & Content Security Policy", () => {
  it.each([
    "/_astro/landing.js",
    "/assets/logo.png",
    "/assets/audio.mp3",
    "/jogo",
    "/jogo/",
    "/jogo/index.html",
    "/jogo/runtime/index.html",
    "/jogo/runtime/service-worker.js",
    "/index.html",
    "/favicon.svg",
    "/jogo-cliente/index.html",
    "/jogo-cliente/service-worker.js",
  ])("leaves static headers untouched by not matching %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(
      false,
    );
  });

  it.each([
    "/",
    "/entrar",
    "/portal/home",
    "/api/health/live",
    "/jogar",
    "/jogar/test",
    "/jogo-other",
    "/assets-other",
    "/index.html-other",
  ])("retains proxy coverage for %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(
      true,
    );
  });

  it("passes the landing root through without nonce or portal response headers", () => {
    vi.stubEnv("LANDING_BUNDLED", "true");
    const response = proxy(new NextRequest("https://portal.example/"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    for (const header of [
      "Content-Security-Policy",
      "X-Frame-Options",
      "x-nonce",
      "x-middleware-request-content-security-policy",
    ]) {
      expect(response.headers.has(header)).toBe(false);
    }
  });

  it.each([undefined, "false"])(
    "protects the fallback root when LANDING_BUNDLED is %s",
    (flag) => {
      vi.stubEnv("LANDING_BUNDLED", flag);
      const response = proxy(new NextRequest("https://portal.example/"));
      expect(response.headers.get("Content-Security-Policy")).toContain(
        "'nonce-",
      );
      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    },
  );

  it("keeps /jogar protected even with a bundled landing", () => {
    vi.stubEnv("LANDING_BUNDLED", "true");
    const response = proxy(new NextRequest("https://portal.example/jogar"));
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "'nonce-",
    );
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("emits a valid CSP header without nonce in style-src", () => {
    const request = new NextRequest("http://localhost:3000/entrar");
    const response = proxy(request);

    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).toBeTruthy();
    expect(csp).toContain("script-src 'self' 'nonce-");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    // Crucial: style-src must NOT contain a nonce so unsafe-inline is not disabled
    expect(csp).not.toMatch(/style-src [^;]*'nonce-/);
  });

  it("sets correlation ID and x-nonce header on request", () => {
    const request = new NextRequest("http://localhost:3000/entrar");
    const response = proxy(request);

    expect(response.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("sets Referrer-Policy to no-referrer for /jogar", () => {
    const request = new NextRequest("http://localhost:3000/jogar");
    const response = proxy(request);

    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("sets Referrer-Policy to no-referrer for /jogar subpaths", () => {
    const request = new NextRequest("http://localhost:3000/jogar/some-slug");
    const response = proxy(request);

    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("keeps strict-origin-when-cross-origin for other routes", () => {
    const request = new NextRequest("http://localhost:3000/entrar");
    const response = proxy(request);

    expect(response.headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  it.each([
    "http://localhost/entrar",
    "http://localhost:3000/entrar",
    "http://127.0.0.1/entrar",
    "http://127.0.0.1:8080/entrar",
    "http://[::1]/entrar",
    "http://[::1]:4321/entrar",
    "https://localhost:3443/entrar",
  ])("omits HTTPS upgrade headers in production on %s", (url) => {
    vi.stubEnv("NODE_ENV", "production");
    const response = proxy(new NextRequest(url));
    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(response.headers.has("Strict-Transport-Security")).toBe(false);
    expect(csp).toContain("script-src 'self' 'nonce-");
    expect(csp).toContain("form-action 'self'");
    expect(
      response.headers.get("x-middleware-request-content-security-policy"),
    ).toBe(csp);
  });

  it.each([
    "localhost:3000",
    "LOCALHOST:3001",
    "localhost.",
    "LOCALHOST.:3000",
    "127.0.0.1:80",
    "127.12.34.56:8080",
    "127.255.255.255",
    "127.0.0.0",
    "[::1]:8080",
    "[0:0:0:0:0:0:0:1]",
    "[0000:0000:0000:0000:0000:0000:0000:0001]:3000",
    "[::ffff:127.0.0.1]",
    "[0:0:0:0:0:FFFF:127.255.255.255]:8080",
    "[::FFFF:7F00:1]:80",
  ])("recognizes a loopback Host header %s", (host) => {
    vi.stubEnv("NODE_ENV", "production");
    const response = proxy(
      new NextRequest("http://internal.example/entrar", {
        headers: { host, "x-forwarded-proto": "https" },
      }),
    );
    expect(response.headers.get("Content-Security-Policy")).not.toContain(
      "upgrade-insecure-requests",
    );
    expect(response.headers.has("Strict-Transport-Security")).toBe(false);
  });

  it.each([
    "https://sms-portal.onrender.com/entrar",
    "http://portal.example:8080/entrar",
    "https://localhost.example/entrar",
    "https://notlocalhost/entrar",
    "https://127.0.0.1.example/entrar",
    "http://192.168.1.10:3000/entrar",
  ])("keeps production HTTPS headers on non-loopback %s", (url) => {
    vi.stubEnv("NODE_ENV", "production");
    const response = proxy(
      new NextRequest(url, {
        headers: { "x-forwarded-proto": "http" },
      }),
    );
    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(response.headers.get("Strict-Transport-Security")).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
    expect(
      response.headers.get("x-middleware-request-content-security-policy"),
    ).toBe(csp);
  });

  it.each([
    "sms-portal.onrender.com",
    "PUBLIC.EXAMPLE.:443",
    "localhost.example:3000",
    "localhost..:3000",
    "localhost.:3000@public.example",
    "[localhost]:3000",
    "127.0.0.1.example.:8080",
    "126.255.255.255",
    "128.0.0.1",
    "[::2]:8080",
    "[::ffff:192.168.1.1]",
    "[::ffff:128.0.0.1]",
    "[2001:db8::7f00:1]",
    "[::127.0.0.1]",
  ])(
    "keeps HTTPS headers behind an internal loopback URL with Host %s",
    (host) => {
      vi.stubEnv("NODE_ENV", "production");
      const response = proxy(
        new NextRequest("http://localhost:10000/entrar", {
          headers: { host, "x-forwarded-proto": "http" },
        }),
      );
      expect(response.headers.get("Content-Security-Policy")).toContain(
        "upgrade-insecure-requests",
      );
      expect(response.headers.has("Strict-Transport-Security")).toBe(true);
    },
  );

  it("does not add HTTPS headers in development, even on a public host", () => {
    vi.stubEnv("NODE_ENV", "development");
    const response = proxy(new NextRequest("https://portal.example/entrar"));
    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(csp).toContain("'unsafe-eval'");
    expect(response.headers.has("Strict-Transport-Security")).toBe(false);
  });
});
