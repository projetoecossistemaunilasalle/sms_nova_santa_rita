import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import nextEnv from "@next/env";
import { standaloneServer } from "./standalone-release.mjs";

const { loadEnvConfig } = nextEnv;

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

loadEnvConfig(projectRoot);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? projectRoot,
    env: options.env ?? process.env,
    shell: process.platform === "win32" && command.endsWith(".cmd"),
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  return result.status ?? 1;
}

const demo = process.argv.includes("--demo");
const standaloneDir = path.join(projectRoot, ".next", "standalone");
let serverFile;
try {
  serverFile = standaloneServer(projectRoot, demo ? "demo" : "server");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const args = process.argv.slice(2).filter((arg) => arg !== "--demo");
const runtimeEnv = {
  ...process.env,
  APP_RUNTIME_MODE: demo ? "demo" : "server",
};

// On Render the public URL only exists once the service does, so default the
// browser origin and the same-origin game URL to it. Explicit values win
// (custom domains list every origin in ALLOWED_ORIGINS).
const renderUrl =
  process.env.RENDER_EXTERNAL_URL ||
  (process.env.RENDER_EXTERNAL_HOSTNAME &&
    `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`);
if (!demo && renderUrl) {
  const origin = new URL(renderUrl).origin;
  runtimeEnv.ALLOWED_ORIGINS ||= origin;
  runtimeEnv.GAME_CLIENT_URL ||= `${origin}/jogo-cliente/index.html`;
}

if (demo) {
  for (const name of [
    "DATABASE_URL",
    "DIRECT_URL",
    "NEON_AUTH_BASE_URL",
    "NEON_AUTH_COOKIE_SECRET",
    "APPLICATION_SECRET",
    "ALLOWED_ORIGINS",
  ]) {
    runtimeEnv[name] = "";
  }
  runtimeEnv.AUTH_DEV_BYPASS = "false";
}

for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--port" || args[index] === "-p") {
    runtimeEnv.PORT = args[index + 1];
    index += 1;
  } else if (args[index] === "--hostname" || args[index] === "-H") {
    runtimeEnv.HOSTNAME = args[index + 1];
    index += 1;
  } else {
    console.error(`Argumento não reconhecido: ${args[index]}`);
    process.exit(1);
  }
}

runtimeEnv.PORT ??= "3000";
runtimeEnv.HOSTNAME ??= demo ? "127.0.0.1" : "0.0.0.0";

process.exit(
  run(process.execPath, [serverFile], { cwd: standaloneDir, env: runtimeEnv }),
);
