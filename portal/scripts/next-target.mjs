import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import nextEnv from "@next/env";
import { packageStandalone } from "./standalone-release.mjs";

const { loadEnvConfig } = nextEnv;
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const [command, target, ...args] = process.argv.slice(2);

if (!command || !["dev", "build", "gen"].includes(command)) {
  console.error(
    "Usage: node scripts/next-target.mjs <dev|build|gen> <demo|server>",
  );
  process.exit(1);
}
if (!target || !["demo", "server"].includes(target)) {
  console.error("Runtime target must be either demo or server.");
  process.exit(1);
}
if (command === "gen" && args.length > 0) {
  console.error("gen takes no additional arguments.");
  process.exit(1);
}

// Both modes use the same server entry points. Only the service containers
// and authentication gateway select infrastructure adapters.
// Directives belong to async implementation files, not re-export barrels.
const RUNTIME_ENTRIES = {
  "src/runtime/actions.ts": 'export * from "./actions.shared";\n',
  "src/runtime/readers.ts":
    'import "server-only";\n\nexport * from "./readers.shared";\n',
};

function writeRuntimeEntries() {
  for (const [relativePath, content] of Object.entries(RUNTIME_ENTRIES)) {
    const filePath = path.join(projectRoot, relativePath);
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, content);
    fs.renameSync(tempPath, filePath);
  }
}

writeRuntimeEntries();
// Remove the obsolete, git-ignored browser adapter entry from older checkouts.
fs.rmSync(path.join(projectRoot, "src/runtime/client.ts"), { force: true });

if (command === "gen") {
  process.exit(0);
}

loadEnvConfig(projectRoot, command === "dev");

const environment = {
  ...process.env,
  APP_RUNTIME_MODE: target,
  NEXT_PUBLIC_APP_RUNTIME_MODE: target,
};

// Local mock sessions execute the same server routes and actions.
if (
  target === "demo" &&
  command === "dev" &&
  !args.includes("--hostname") &&
  !args.includes("-H")
) {
  args.push("--hostname", "127.0.0.1");
}

if (command === "build") {
  environment.NODE_ENV = "production";
  // Prerendering runs route modules, which validate the production runtime env
  // and reject the bypass. Pinning it off keeps a local server build possible;
  // booting the built server still refuses the flag. The value must be set
  // rather than deleted, because the build re-reads `.env` and never overrides
  // a variable that already exists.
  if (target === "server") environment.AUTH_DEV_BYPASS = "false";
}
if (target === "demo") {
  for (const name of [
    "DATABASE_URL",
    "DIRECT_URL",
    "NEON_AUTH_BASE_URL",
    "NEON_AUTH_COOKIE_SECRET",
    "APPLICATION_SECRET",
    "ALLOWED_ORIGINS",
  ]) {
    environment[name] = "";
  }
  environment.AUTH_DEV_BYPASS = "false";
}

const nextBin = path.join(
  projectRoot,
  "node_modules",
  "next",
  "dist",
  "bin",
  "next",
);
const result = spawnSync(process.execPath, [nextBin, command, ...args], {
  cwd: projectRoot,
  env: environment,
  stdio: "inherit",
});

if (result.error) throw result.error;
if (command === "build" && result.status === 0)
  packageStandalone(projectRoot, target);
process.exit(result.status ?? 1);
