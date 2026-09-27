import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { cleanBuildArtifacts } from "../../scripts/clean-build-artifacts.mjs";

function createEscapeFixture(): {
  parent: string;
  root: string;
  outsideDir: string;
} {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "clean-build-"));
  const root = path.join(parent, "repo-root");
  const outsideDir = path.join(parent, "outside-target");
  fs.mkdirSync(root);
  fs.mkdirSync(outsideDir);
  fs.writeFileSync(path.join(outsideDir, "keep.txt"), "do not delete");
  // Junctions work without elevated permissions on Windows; plain symlinks
  // cover POSIX. Both are lstat-visible, which is what the cleaner must reject.
  fs.symlinkSync(outsideDir, path.join(root, ".next"), "junction");
  return { parent, root, outsideDir };
}

describe("cleanBuildArtifacts", () => {
  it("refuses to delete a .next symlink that escapes the repository root", () => {
    const { parent, root, outsideDir } = createEscapeFixture();

    try {
      expect(() => cleanBuildArtifacts(root)).toThrow(
        /symbolic link or junction/,
      );
      expect(fs.existsSync(path.join(outsideDir, "keep.txt"))).toBe(true);
    } finally {
      // rmSync on a junction removes only the link, never its target.
      // Removing the parent sweeps root, outsideDir, and the mkdtemp
      // directory itself in one call.
      fs.rmSync(parent, { recursive: true, force: true });
    }
  });
});
