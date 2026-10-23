import { afterEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  bundled: false,
  hashes: ["'sha256-" + "A".repeat(43) + "='"],
}));
vi.mock("node:fs", async (importOriginal) => {
  const fs = await importOriginal<typeof import("node:fs")>();
  return {
    ...fs,
    existsSync: (file: string) =>
      file.endsWith("csp.json") ? fixture.bundled : fs.existsSync(file),
    readFileSync: (file: string, ...args: [BufferEncoding]) =>
      file.endsWith("csp.json")
        ? JSON.stringify({ hashes: fixture.hashes })
        : fs.readFileSync(file, ...args),
  };
});

afterEach(() => {
  vi.unstubAllEnvs();
  fixture.bundled = false;
  vi.resetModules();
});

async function config(bundled: boolean) {
  fixture.bundled = bundled;
  vi.stubEnv("APP_RUNTIME_MODE", "demo");
  return (await import("../../next.config")).default;
}

describe("single-origin Next configuration", () => {
  it("keeps the existing config when no landing is bundled", async () => {
    const next = await config(false);
    expect(next.env?.LANDING_BUNDLED).toBe("false");
    expect(next.rewrites).toBeUndefined();
    expect(next.redirects).toBeUndefined();
    expect(next.skipTrailingSlashRedirect).toBeUndefined();
    expect((await next.headers?.())?.map((rule) => rule.source)).toEqual([
      "/jogo-cliente/:path*",
      "/jogo-cliente/:file(service-worker\\.js|offline-shell\\.json)",
    ]);
  });

  it("overrides the root page before filesystem routing and redirects the wrapper", async () => {
    const next = await config(true);
    expect(next.env?.LANDING_BUNDLED).toBe("true");
    expect(next.skipTrailingSlashRedirect).toBe(true);
    expect(await next.rewrites?.()).toEqual({
      beforeFiles: [{ source: "/", destination: "/index.html" }],
      afterFiles: [],
      fallback: [],
    });
    expect(await next.redirects?.()).toEqual([
      { source: "/jogo", destination: "/jogo/index.html", permanent: false },
      { source: "/jogo/", destination: "/jogo/index.html", permanent: false },
      { source: "/:path+/", destination: "/:path+", permanent: true },
    ]);
  });

  it("adds hash CSP and same-origin framing only to landing paths", async () => {
    const next = await config(true);
    const rules = (await next.headers?.()) ?? [];
    for (const source of [
      "/",
      "/index.html",
      "/_astro/:path*",
      "/assets/:path*",
      "/favicon.svg",
      "/jogo/:path*",
    ]) {
      const headers =
        rules.find((rule) => rule.source === source)?.headers ?? [];
      const csp = headers.find(
        (header) => header.key === "Content-Security-Policy",
      )?.value;
      expect(csp).toContain(`script-src 'self' ${fixture.hashes[0]};`);
      expect(csp).not.toContain("nonce-");
      expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
      expect(csp).toContain("frame-ancestors 'self'");
      expect(headers).toContainEqual({
        key: "X-Frame-Options",
        value: "SAMEORIGIN",
      });
      expect(headers).toContainEqual({
        key: "X-Content-Type-Options",
        value: "nosniff",
      });
      expect(headers).toContainEqual({
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      });
    }
    expect(rules).toContainEqual({
      source: "/jogo/runtime/:file(service-worker\\.js|offline-shell\\.json)",
      headers: [{ key: "Cache-Control", value: "no-cache" }],
    });
    expect(
      rules.find((rule) => rule.source === "/jogo-cliente/:path*")?.headers,
    ).toContainEqual({ key: "Referrer-Policy", value: "no-referrer" });
  });
});
