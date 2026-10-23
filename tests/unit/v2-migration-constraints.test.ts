import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  PROTOCOL_VERSION,
  SUPPORTED_STATE_SCHEMA_VERSIONS,
} from "@/contracts/v2";

// The V1 init migration pinned game_states to protocol 1 / schema 1. Mocked
// store tests can't see database CHECKs, so assert the migration chain ends on V2.
function lastCheck(constraint: string): string | undefined {
  const dir = path.join(process.cwd(), "prisma", "migrations");
  const sql = readdirSync(dir)
    .filter((name) => !name.endsWith(".toml"))
    .sort()
    .map((name) => readFileSync(path.join(dir, name, "migration.sql"), "utf8"))
    .join("\n");
  const pattern = new RegExp(
    `ADD CONSTRAINT "${constraint}" CHECK \(([^;]+)\);`,
    "g",
  );
  return [...sql.matchAll(pattern)]
    .at(-1)?.[1]
    ?.replace(/^\(+|\)+$/g, "")
    .trim();
}

describe("game_states version constraints", () => {
  it("accept the V2 protocol and V3 snapshots", () => {
    expect(lastCheck("game_states_protocol_version_check")).toBe(
      `"protocol_version" = ${PROTOCOL_VERSION}`,
    );
    expect(SUPPORTED_STATE_SCHEMA_VERSIONS).toEqual([3]);
    expect(lastCheck("game_states_schema_version_check")).toBe(
      `"schema_version" = 3`,
    );
  });
});
