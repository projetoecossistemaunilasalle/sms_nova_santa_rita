import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { proxy } from "@/proxy";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Proxy & Content Security Policy", () => {
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

  it.each(["localhost:3000", "LOCALHOST:3001", "127.0.0.1:80", "[::1]:8080"])(
    "recognizes a loopback Host header %s",
    (host) => {
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
    },
  );

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

  it.each(["sms-portal.onrender.com", "localhost.example:3000", "[::2]:8080"])(
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
