// Deletes build artifacts (Next.js output directories and TypeScript
// build-info files) from the repository root.
//
// Safety rules:
// - The targets are a fixed allowlist; the script never accepts caller-supplied
//   paths, so `node scripts/clean-build-artifacts.mjs anything` fails.
// - Every target is resolved against the repository root (derived from this
//   script's own location), and each entry is cleaned one at a time: a target
//   is only removed after its on-disk entry passes the link and realpath
//   checks below, so a junction or symlink that escapes the root aborts the
//   run instead of being deleted.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIRECTORY_TARGETS = [".next", ".next-demo-dev", "out"];
const TSBUILDINFO_SUFFIX = ".tsbuildinfo";

function resolveRepoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function isInsideRoot(root, candidate) {
  if (candidate === root) return true;
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  return candidate.startsWith(prefix);
}

// Collects the fixed allowlist of targets that exist under `root`.
function collectTargets(root) {
  const targets = [];
  for (const name of DIRECTORY_TARGETS) {
    targets.push(path.join(root, name));
  }
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name.endsWith(TSBUILDINFO_SUFFIX)) {
      targets.push(path.join(root, entry.name));
    }
  }
  return targets;
}

export function cleanBuildArtifacts(repoRoot) {
  const root = fs.realpathSync(path.resolve(repoRoot));
  const removed = [];

  for (const target of collectTargets(root)) {
    let stats;
    try {
      // lstat (not stat) so links are seen as links, not as their target.
      stats = fs.lstatSync(target);
    } catch {
      continue; // Missing targets are fine.
    }

    if (stats.isSymbolicLink()) {
      throw new Error(
        `Refusing to delete "${target}": it is a symbolic link or junction, which could point outside the repository root.`,
      );
    }

    if (!isInsideRoot(root, fs.realpathSync(target))) {
      throw new Error(
        `Refusing to delete "${target}": its resolved path escapes the repository root.`,
      );
    }

    if (stats.isDirectory()) {
      fs.rmSync(target, { recursive: true, force: true });
    } else {
      fs.unlinkSync(target);
    }
    removed.push(path.relative(root, target));
  }

  return removed;
}

function isMainModule() {
  const entry = process.argv[1];
  if (!entry) return false;
  const scriptPath = path.resolve(fileURLToPath(import.meta.url));
  const entryPath = path.resolve(entry);
  // Windows paths are case-insensitive, including the drive letter.
  const normalize = (value) =>
    process.platform === "win32" ? value.toLowerCase() : value;
  return normalize(scriptPath) === normalize(entryPath);
}

if (isMainModule()) {
  if (process.argv.length > 2) {
    console.error(
      "clean-build-artifacts takes no arguments; its targets are a fixed allowlist.",
    );
    process.exit(1);
  }
  try {
    const removed = cleanBuildArtifacts(resolveRepoRoot());
    for (const name of removed) {
      console.log(`Removed ${name}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
