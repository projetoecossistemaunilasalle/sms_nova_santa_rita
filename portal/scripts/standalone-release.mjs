import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export function packageStandalone(projectRoot, target) {
  const standalone = path.join(projectRoot, ".next", "standalone");
  if (!existsSync(path.join(standalone, "server.js"))) {
    throw new Error("The build did not produce a standalone server.");
  }
  cpSync(
    path.join(projectRoot, ".next", "static"),
    path.join(standalone, ".next", "static"),
    { recursive: true },
  );
  cpSync(path.join(projectRoot, "public"), path.join(standalone, "public"), {
    recursive: true,
  });
  writeFileSync(
    path.join(standalone, "release.json"),
    JSON.stringify({ target }) + "\n",
  );
}

export function standaloneServer(projectRoot, target) {
  const standalone = path.join(projectRoot, ".next", "standalone");
  const server = path.join(standalone, "server.js");
  const manifest = path.join(standalone, "release.json");
  if (!existsSync(server) || !existsSync(manifest)) {
    throw new Error(
      `No packaged release found. Run npm run build:${target} first.`,
    );
  }
  if (JSON.parse(readFileSync(manifest, "utf8")).target !== target) {
    throw new Error(
      `This release is not a ${target} build. Run npm run build:${target} first.`,
    );
  }
  return server;
}
