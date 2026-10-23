import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalRoot = fileURLToPath(new URL("../", import.meta.url));
const excluded = new Set(["portal", ".nojekyll"]);

export function inlineScripts(html) {
  const scripts = [];
  // Tokenize whole tags (including quoted attributes) and comments. Raw-text
  // elements must be consumed as a unit, not searched for nested script tags.
  const tags =
    /<!--[\s\S]*?-->|<![^>]*>|<([a-z][\w:-]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
  for (let tag; (tag = tags.exec(html));) {
    const name = tag[1]?.toLowerCase();
    if (
      !name ||
      !/^(script|style|textarea|title|xmp|iframe|noembed|noframes)$/.test(name)
    )
      continue;
    const end = new RegExp(`</${name}\\s*>`, "gi");
    end.lastIndex = tags.lastIndex;
    const closing = end.exec(html);
    if (!closing) throw new Error(`Unclosed <${name}> in landing HTML`);
    if (name === "script") {
      const attributes =
        /([^\s=/'">]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g;
      const hasSrc = [...tag[2].matchAll(attributes)].some(
        (attribute) => attribute[1].toLowerCase() === "src",
      );
      if (!hasSrc) scripts.push(html.slice(tags.lastIndex, closing.index));
    }
    tags.lastIndex = end.lastIndex;
  }
  return scripts;
}

export function inlineScriptHashes(html) {
  return [
    ...new Set(
      inlineScripts(html).map(
        (script) =>
          `'sha256-${createHash("sha256").update(script, "utf8").digest("base64")}'`,
      ),
    ),
  ];
}

function validateEntries(entries) {
  if (
    !Array.isArray(entries) ||
    entries.some(
      (entry) =>
        typeof entry !== "string" ||
        !/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(entry) ||
        excluded.has(entry),
    )
  )
    throw new Error("Invalid landing manifest entries");
}

export function assertNoCollisions(entries, ownedEntries, existingEntries) {
  validateEntries(entries);
  validateEntries(ownedEntries);
  // Public paths are case-insensitive on Windows. Refuse collisions there too.
  const owned = new Set(ownedEntries.map((entry) => entry.toLowerCase()));
  const existing = new Set(existingEntries.map((entry) => entry.toLowerCase()));
  for (const entry of entries) {
    if (existing.has(entry.toLowerCase()) && !owned.has(entry.toLowerCase())) {
      throw new Error(
        `Landing collision: public/${entry} is not owned by the landing build`,
      );
    }
  }
}

function htmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(`Unexpected landing symlink: ${file}`);
    return entry.isDirectory()
      ? htmlFiles(file)
      : entry.name.endsWith(".html")
        ? [file]
        : [];
  });
}

export function bundleLanding(dist, publicRoot, stateRoot) {
  const sources = readdirSync(dist, { withFileTypes: true }).filter(
    (entry) => !excluded.has(entry.name),
  );
  if (!sources.some((entry) => entry.name === "index.html" && entry.isFile())) {
    throw new Error("Landing build must contain index.html");
  }
  const entries = sources.map((entry) => entry.name).sort();
  const manifest = path.join(stateRoot, "manifest.json");
  const owned = existsSync(manifest)
    ? JSON.parse(readFileSync(manifest, "utf8")).entries
    : [];
  mkdirSync(publicRoot, { recursive: true });
  assertNoCollisions(entries, owned, readdirSync(publicRoot));

  const hashes = new Set();
  for (const entry of sources) {
    const source = path.join(dist, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(`Unexpected landing symlink: ${source}`);
    const files = entry.isDirectory()
      ? htmlFiles(source)
      : entry.name.endsWith(".html")
        ? [source]
        : [];
    for (const file of files) {
      const html = readFileSync(file, "utf8");
      if (html.includes("/sms_nova_santa_rita")) {
        throw new Error(`GitHub Pages base path found in ${file}`);
      }
      for (const hash of inlineScriptHashes(html)) hashes.add(hash);
    }
  }

  mkdirSync(stateRoot, { recursive: true });
  // Invalidate the config marker before changing public files. Record ownership
  // before copying so an interrupted copy can be cleaned up on the next build.
  rmSync(path.join(stateRoot, "csp.json"), { force: true });
  for (const entry of owned)
    rmSync(path.join(publicRoot, entry), { recursive: true, force: true });
  writeFileSync(manifest, JSON.stringify({ entries }, null, 2) + "\n");
  for (const entry of entries) {
    cpSync(path.join(dist, entry), path.join(publicRoot, entry), {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
  }
  writeFileSync(
    path.join(stateRoot, "csp.json"),
    JSON.stringify({ hashes: [...hashes].sort() }, null, 2) + "\n",
  );
}

function runNpm(args, cwd, env) {
  // Invoke npm through Node, not a shell: Git Bash rewrites slash-prefixed env
  // values, and npm.cmd cannot be spawned directly on Windows without a shell.
  const npm = process.env.npm_execpath;
  if (!npm) throw new Error("Run this script via npm run build:landing");
  const result = spawnSync(process.execPath, [npm, ...args], {
    cwd,
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`npm ${args.join(" ")} failed (${result.status})`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--skip-install"))
    throw new Error("Usage: npm run build:landing -- [--skip-install]");
  const root = path.resolve(portalRoot, "..");
  if (!args.includes("--skip-install")) runNpm(["ci"], root, process.env);
  const env = { ...process.env, PAGES_BASE_PATH: "", PORTAL_URL: "/entrar/" };
  const site = process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL;
  if (site) env.SITE_URL = site;
  else delete env.SITE_URL;
  runNpm(["run", "build"], root, env);
  bundleLanding(
    path.join(root, "dist"),
    path.join(portalRoot, "public"),
    path.join(portalRoot, ".landing"),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
