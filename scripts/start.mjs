import { cpSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

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

const buildStatus = run(npmCommand, ["run", "build"]);
if (buildStatus !== 0) process.exit(buildStatus);

const standaloneDir = path.join(projectRoot, ".next", "standalone");
const serverFile = path.join(standaloneDir, "server.js");

if (!existsSync(serverFile)) {
  console.error("O build standalone não gerou .next/standalone/server.js.");
  process.exit(1);
}

cpSync(
  path.join(projectRoot, ".next", "static"),
  path.join(standaloneDir, ".next", "static"),
  {
    recursive: true,
  },
);
cpSync(path.join(projectRoot, "public"), path.join(standaloneDir, "public"), {
  recursive: true,
});

const args = process.argv.slice(2);
const runtimeEnv = { ...process.env };

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
runtimeEnv.HOSTNAME ??= "0.0.0.0";

process.exit(
  run(process.execPath, [serverFile], { cwd: standaloneDir, env: runtimeEnv }),
);
