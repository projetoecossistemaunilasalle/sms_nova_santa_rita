import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const [command, target, ...args] = process.argv.slice(2);

if (!command || !["dev", "build"].includes(command)) {
  console.error(
    "Usage: node scripts/next-target.mjs <dev|build> <demo|server>",
  );
  process.exit(1);
}
if (!target || !["demo", "server"].includes(target)) {
  console.error("Runtime target must be either demo or server.");
  process.exit(1);
}

loadEnvConfig(projectRoot, command === "dev");

const environment = {
  ...process.env,
  APP_RUNTIME_MODE: target,
  NEXT_PUBLIC_APP_RUNTIME_MODE: target,
};

if (command === "build") environment.NODE_ENV = "production";
if (target === "demo") {
  for (const name of [
    "DATABASE_URL",
    "DIRECT_URL",
    "NEON_AUTH_BASE_URL",
    "NEON_AUTH_COOKIE_SECRET",
    "APPLICATION_SECRET",
    "ALLOWED_ORIGINS",
    "AUTH_DEV_BYPASS",
  ]) {
    environment[name] = "";
  }
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
process.exit(result.status ?? 1);
