import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertNoCollisions,
  bundleLanding,
  inlineScriptHashes,
  inlineScripts,
} from "../../scripts/build-landing.mjs";

describe("landing inline script CSP", () => {
  it("extracts classic, module and data scripts, preserving their exact text", () => {
    const html = `<script>\r\n  classic();\r\n</script><SCRIPT type='module'>module();</SCRIPT><script type="application/json">{ "a": 1 }</script>`;
    expect(inlineScripts(html)).toEqual([
      "\r\n  classic();\r\n",
      "module();",
      '{ "a": 1 }',
    ]);
  });

  it("ignores src attributes, but not data-src or src inside another value", () => {
    expect(
      inlineScripts(
        `<script SRC = "a.js">ignored</script><script src='b.js'></script><script src=c.js></script><script src></script><script data-src="x" data-note=" src='x'>">kept</script>`,
      ),
    ).toEqual(["kept"]);
  });

  it("does not interpret scripts inside comments, attributes or raw-text elements", () => {
    expect(
      inlineScripts(
        `<!-- <script>bad()</script> --><div title="<script>bad()</script>"></div><style>/* <script>bad()</script> */</style><textarea><script>bad()</script></textarea><script>good()</script>`,
      ),
    ).toEqual(["good()"]);
  });

  it("hashes exact UTF-8 script text with sha256/base64 and deduplicates", () => {
    const text = "\nconsole.log('saude');\n";
    const expected = `'sha256-${createHash("sha256").update(text).digest("base64")}'`;
    expect(
      inlineScriptHashes(`<script>${text}</script><script>${text}</script>`),
    ).toEqual([expected]);
    expect(
      inlineScriptHashes("<script>console.log('saude');</script>"),
    ).not.toContain(expected);
  });

  it("hashes line endings the way the HTML parser sees them", () => {
    const parsed = "\nconst a = 1;\nconst b = 2;\n";
    const expected = `'sha256-${createHash("sha256").update(parsed).digest("base64")}'`;
    expect(
      inlineScriptHashes("<script>\r\nconst a = 1;\rconst b = 2;\r\n</script>"),
    ).toEqual([expected]);
  });

  it("fails on malformed raw-text markup", () => {
    expect(() => inlineScripts("<script>unfinished")).toThrow("Unclosed");
  });
});

describe("landing ownership", () => {
  it("permits replacing owned entries and creating new entries", () => {
    expect(() =>
      assertNoCollisions(
        ["index.html", "assets"],
        ["index.html"],
        ["index.html", "jogo-cliente", "favicon.ico"],
      ),
    ).not.toThrow();
  });

  it.each(["favicon.ico", "icon.svg", "jogo-cliente", "INDEX.html"])(
    "refuses an unowned collision with %s",
    (entry) => {
      expect(() =>
        assertNoCollisions([entry], [], [entry.toLowerCase()]),
      ).toThrow("collision");
    },
  );

  it.each([
    "../outside",
    ".",
    "..",
    "/assets",
    "C:\\outside",
    "jogo/runtime",
    "portal",
    ".nojekyll",
  ])("rejects unsafe or excluded manifest entry %s", (entry) => {
    expect(() => assertNoCollisions(["index.html"], [entry], [])).toThrow(
      "manifest",
    );
  });
});

describe("landing bundle", () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0))
      rmSync(root, { recursive: true, force: true });
  });

  function fixture() {
    const root = mkdtempSync(path.join(tmpdir(), "sms-landing-"));
    roots.push(root);
    const dist = path.join(root, "dist");
    const publicRoot = path.join(root, "public");
    const state = path.join(root, ".landing");
    mkdirSync(dist);
    mkdirSync(publicRoot);
    writeFileSync(path.join(dist, "index.html"), "<script>landing()</script>");
    writeFileSync(path.join(publicRoot, "favicon.ico"), "portal");
    return { dist, publicRoot, state };
  }

  it("skips placeholders, hashes nested HTML and removes only previously owned entries on rerun", () => {
    const { dist, publicRoot, state } = fixture();
    mkdirSync(path.join(dist, "portal"));
    writeFileSync(
      path.join(dist, "portal", "index.html"),
      "<script>placeholder()</script>",
    );
    writeFileSync(path.join(dist, ".nojekyll"), "");
    mkdirSync(path.join(dist, "jogo", "runtime"), { recursive: true });
    writeFileSync(
      path.join(dist, "jogo", "runtime", "index.html"),
      "<script type='module'>game()</script>",
    );
    writeFileSync(path.join(dist, "old.txt"), "old");
    bundleLanding(dist, publicRoot, state);
    expect(existsSync(path.join(publicRoot, "portal"))).toBe(false);
    expect(existsSync(path.join(publicRoot, ".nojekyll"))).toBe(false);
    expect(
      JSON.parse(readFileSync(path.join(state, "manifest.json"), "utf8"))
        .entries,
    ).toEqual(["index.html", "jogo", "old.txt"]);
    expect(
      JSON.parse(readFileSync(path.join(state, "csp.json"), "utf8")).hashes,
    ).toEqual(
      [
        ...inlineScriptHashes(
          "<script>landing()</script><script>game()</script>",
        ),
      ].sort(),
    );
    rmSync(path.join(dist, "old.txt"));
    writeFileSync(
      path.join(dist, "index.html"),
      "<script>newLanding()</script>",
    );
    bundleLanding(dist, publicRoot, state);
    expect(existsSync(path.join(publicRoot, "old.txt"))).toBe(false);
    expect(readFileSync(path.join(publicRoot, "favicon.ico"), "utf8")).toBe(
      "portal",
    );
    expect(readFileSync(path.join(publicRoot, "index.html"), "utf8")).toContain(
      "newLanding",
    );
    expect(
      JSON.parse(readFileSync(path.join(state, "csp.json"), "utf8")).hashes,
    ).not.toContain(inlineScriptHashes("<script>landing()</script>")[0]);
  });

  it("preflights collisions before deleting or overwriting anything", () => {
    const { dist, publicRoot, state } = fixture();
    bundleLanding(dist, publicRoot, state);
    writeFileSync(path.join(dist, "favicon.ico"), "must not overwrite");
    writeFileSync(path.join(dist, "index.html"), "changed");
    expect(() => bundleLanding(dist, publicRoot, state)).toThrow("collision");
    expect(readFileSync(path.join(publicRoot, "favicon.ico"), "utf8")).toBe(
      "portal",
    );
    expect(readFileSync(path.join(publicRoot, "index.html"), "utf8")).toContain(
      "landing()",
    );
  });

  it("rejects GitHub Pages references even in nested HTML", () => {
    const { dist, publicRoot, state } = fixture();
    mkdirSync(path.join(dist, "jogo"));
    writeFileSync(
      path.join(dist, "jogo", "index.html"),
      '<a href="/sms_nova_santa_rita/">old</a>',
    );
    expect(() => bundleLanding(dist, publicRoot, state)).toThrow(
      "GitHub Pages",
    );
    expect(existsSync(path.join(publicRoot, "index.html"))).toBe(false);
    expect(existsSync(path.join(state, "csp.json"))).toBe(false);
  });
});
