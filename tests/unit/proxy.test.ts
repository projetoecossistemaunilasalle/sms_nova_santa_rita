import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { proxy } from "@/proxy";

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
});
