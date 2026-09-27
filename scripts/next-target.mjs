import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import nextEnv from "@next/env";

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

// Deterministic generated consumer entries. Each target re-exports the same
// named symbols from its concrete tracked variant barrel, so both target
// typechecks compile every consumer against the selected concrete exports.
// The three generated files are git-ignored workspace state; one target
// command at a time in a checkout is the documented operating rule.
const ACTION_NAMES = [
  "allocatePlayerSlotsAction",
  "assignOrganizationAdministratorAction",
  "assignTeacherMembershipAction",
  "assignTeacherToClassAction",
  "changeClassStatusAction",
  "changeMembershipAction",
  "changeOrganizationStatusAction",
  "createClassAction",
  "createDemoProfessionalAction",
  "createOrganizationAction",
  "deactivateTeacherAssignmentAction",
  "endClassSessionAction",
  "resolvePlayerEntryAction",
  "rotatePlayerCredentialAction",
  "signInAction",
  "signOutAction",
  "startClassSessionAction",
];
const READER_NAMES = [
  "getClassPageData",
  "getClassResultsPageData",
  "getClassesPageData",
  "getOrganizationPageData",
  "getOrganizationsPageData",
  "getPlayerAccessPageData",
  "getPlayerResultsPageData",
  "getPortalOverviewData",
  "getPortalShellData",
  "getResultReportsPageData",
  "getTeamPageData",
  "listStaticClassIds",
  "listStaticOrganizationIds",
  "listStaticResultClassIds",
  "listStaticResultPlayerParams",
];
const CLIENT_NAMES = [
  "changeDemoProfile",
  "loadClientPortalState",
  "resetDemoPortal",
];

function reExports(names, from) {
  return `export {\n${names.map((name) => `  ${name},`).join("\n")}\n} from "${from}";\n`;
}

const RUNTIME_ENTRIES = {
  server: {
    // No "use server" header here: the installed Turbopack transform rejects
    // any non-async-function export in a "use server" file, so re-exports are
    // impossible in one. Verified on next 16.3.6: adding the header to this
    // generated entry fails build:server with "Only async functions are
    // allowed to be exported in a "use server" file." plus one cascading
    // error per re-exported name. The directive lives on the five
    // implementation files this barrel and the generated entry re-export
    // from; importing those exports through plain re-export chains keeps
    // every consumer on the generated entry while the actions stay
    // registered by their own modules.
    "src/runtime/actions.ts": reExports(ACTION_NAMES, "./actions.server"),
    "src/runtime/readers.ts": `import "server-only";\n\n${reExports(READER_NAMES, "./readers.server")}`,
    "src/runtime/client.ts": `"use client";\n\n${reExports(CLIENT_NAMES, "./client.server")}`,
  },
  demo: {
    "src/runtime/actions.ts": reExports(ACTION_NAMES, "./actions.demo"),
    "src/runtime/readers.ts": `import "server-only";\n\n${reExports(READER_NAMES, "./readers.demo")}`,
    "src/runtime/client.ts": `"use client";\n\n${reExports(CLIENT_NAMES, "./client.demo")}`,
  },
};

function writeRuntimeEntries(selectedTarget) {
  for (const [relativePath, content] of Object.entries(
    RUNTIME_ENTRIES[selectedTarget],
  )) {
    const filePath = path.join(projectRoot, relativePath);
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, content);
    fs.renameSync(tempPath, filePath);
  }
}

writeRuntimeEntries(target);

if (command === "gen") {
  process.exit(0);
}

loadEnvConfig(projectRoot, command === "dev");

const environment = {
  ...process.env,
  APP_RUNTIME_MODE: target,
  NEXT_PUBLIC_APP_RUNTIME_MODE: target,
};

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
