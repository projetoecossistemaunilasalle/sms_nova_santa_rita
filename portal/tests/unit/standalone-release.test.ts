import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  packageStandalone,
  standaloneServer,
} from "../../scripts/standalone-release.mjs";

describe("immutable standalone releases", () => {
  it("packages assets at build time and only selects a matching existing release at startup", () => {
    const root = mkdtempSync(path.join(tmpdir(), "sms-release-"));
    try {
      expect(() => standaloneServer(root, "server")).toThrow("build:server");
      mkdirSync(path.join(root, ".next", "standalone"), { recursive: true });
      mkdirSync(path.join(root, ".next", "static"), { recursive: true });
      mkdirSync(path.join(root, "public"));
      writeFileSync(
        path.join(root, ".next", "standalone", "server.js"),
        "// built server\n",
      );
      writeFileSync(
        path.join(root, ".next", "static", "chunk.js"),
        "built chunk",
      );
      writeFileSync(path.join(root, "public", "asset.txt"), "built asset");
      packageStandalone(root, "server");
      writeFileSync(
        path.join(root, "public", "asset.txt"),
        "changed source asset",
      );
      expect(standaloneServer(root, "server")).toBe(
        path.join(root, ".next", "standalone", "server.js"),
      );
      expect(standaloneServer(root, "server")).toBe(
        path.join(root, ".next", "standalone", "server.js"),
      );
      expect(
        readFileSync(
          path.join(root, ".next", "standalone", "public", "asset.txt"),
          "utf8",
        ),
      ).toBe("built asset");
      expect(
        readFileSync(
          path.join(root, ".next", "standalone", ".next", "static", "chunk.js"),
          "utf8",
        ),
      ).toBe("built chunk");
      expect(() => standaloneServer(root, "demo")).toThrow("not a demo build");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
