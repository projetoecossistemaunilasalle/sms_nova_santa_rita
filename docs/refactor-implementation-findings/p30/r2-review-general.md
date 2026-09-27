# P30: Generated Runtime Entries — Round-2 Dynamic Verification (General)

- **Phase:** P30 — Generated Runtime Entries
- **Date:** 2026-09-27
- **Base commit (HEAD):** `9467757ed436c82bdbace5a78e23b502176318e2` (entire P00–P50 refactor present as one staged working-tree change)
- **Toolchain:** Node **v22.23.1**, npm **11.6.0**
  - **Discrepancy:** repo pins Node `24.19.0` (`package.json` engines); this shell has Node 22.23.1. npm matches the pin (`>=11.6.0 <12`). All gates below ran on Node 22. The runbook itself notes the inspected shell uses Node 22.23.1, so results are comparable to prior evidence, but acceptance on the pinned Node 24 was not exercised in this round.
- **Method:** authoritative serial gate sequence run from cold, one command at a time; no tracked file modified, no install/migrate/dev-server commands used.

## Command Log

| # | Command | Exit | Duration | Key result |
|---|---------|------|----------|------------|
| 1 | `git status --short` + `rm src/runtime/actions.ts src/runtime/readers.ts src/runtime/client.ts` | 0 | — | All three existed (gitignored, `.gitignore:30-32`) and were deleted; absence confirmed — true cold start |
| 2 | `npm run typecheck:server` | **0** | **8s** | Self-generated server entries then `tsc --noEmit --incremental false` passed |
| 3 | `npm run typecheck:demo` | **0** | **12s** | Regenerated demo entries itself and passed |
| 4 | `npm test` | **0** | **3s** | `gen demo && vitest run`: **28 test files / 200 tests, all passed** |
| 5 | `npm run build:server` (after `rm -rf .next .next-demo-dev out`) | **0** | **19s** | Standalone server build produced: `.next/BUILD_ID` (`uGTf2vcarMcS45CPMi1Dd`), `.next/standalone/`, 20 static pages, dynamic `ƒ` API/portal routes |
| 6 | `npm run build:demo` | **0** | **15s** | Static export `out/` produced: `out/index.html`, `out/entrar/index.html`, `out/jogar/index.html`; 26 HTML files total |
| 7 | cold delete of the 3 entries + `npm run check` | **0** | **33s** | Self-prepared everything: format:check → lint → prisma:validate → **prisma:generate exactly once** → typecheck (server then demo) → npm test (28/200) |
| 8 | Static sweeps (see below) | — | — | 0 `@runtime/` hits; 9 aliases gone from both configs; no direct variant imports outside `src/runtime` and `scripts/` |
| E1 | build:server with `"use server"` temporarily prepended to generated `actions.ts` (experiment) | 0 | 13s | Build **succeeded**, zero warnings, valid standalone build — refutes the generator comment's justification (see F-1) |
| E2 | restore: `npm run build:server` (standard barrel) + `gen demo` | 0 | ~19s | Canonical workspace state restored; tracked-file status unchanged (179 staged entries, same as start) |

## Verification per Acceptance Bullet

**Bullet 1 — "Starting with all generated entries absent, `typecheck:server`, `typecheck:demo`, `npm test`, `build:server`, `build:demo` each prepare what they need and pass when run serially."**
**SATISFIED.** All five ran from a state where the three entries were deleted (step 1), strictly serially, each exit 0 (table above). Every target command regenerates its own entries via `node scripts/next-target.mjs gen <target>` chained in the package scripts (`package.json:21-24, 14-15`) or inside `next-target.mjs` itself (`writeRuntimeEntries(target)` runs before Next spawns, `scripts/next-target.mjs:110`). No command depended on a previous command's leftover entries.

**Bullet 2 — "No `@runtime/` import or config key remains."**
**SATISFIED.** `rg "@runtime/"` across `src/`, `tests/`, `next.config.ts`, `tsconfig.json`: 0 hits. Diff vs base shows the entire `turbopack.resolveAlias` block (nine aliases) deleted from `next.config.ts` and all nine `@runtime/*` entries deleted from `tsconfig.json` paths; only `@/*` remains. Consumers: 23 files / 24 import lines import exclusively via `@/runtime/actions`, `@/runtime/readers`, `@/runtime/client`.

**Bullet 3 — "The demo static export succeeds … authoritative check that no Server Action is reachable in that target."**
**SATISFIED.** `build:demo` exit 0 (15s) and `out/` contains the export (index, entrar, jogar, 26 HTML files). Dynamic-route SSG pages are the seeded demo IDs (e.g. `/portal/turmas/demo-turma-3a`).

**Bullet 4 — "No custom import-graph parser, negative graph-fixture suite, or generated-file unit test is introduced."**
**SATISFIED.** Test suite is 28 files / 200 tests of behavioral coverage; no generated-file or import-graph test present. The only runtime-adjacent machinery is `scripts/next-target.mjs` (name-list generator), which the runbook explicitly prescribes.

**Gate step 2 sub-check — "src/runtime/actions.ts starts with `use server`" (server variant).**
**NOT SATISFIED literally.** The generated server `actions.ts` is directive-free; it re-exports from `./actions.server` (itself a barrel over dedicated module-level `"use server"` implementation files). `readers.ts` starts with `import "server-only"` ✓; `client.ts` starts with `"use client"` ✓; demo `actions.ts` is directive-free ✓. See finding F-1.

## Target-Switch Evidence

| State after | `src/runtime/actions.ts` | re-export source |
|---|---|---|
| `typecheck:server` (step 2) | starts with `export {` — **no** `"use server"` line (0 occurrences) | `./actions.server` |
| `typecheck:demo` (step 3) | starts with `export {` — directive-free (expected for demo) | `./actions.demo` |
| `npm test` / `check` | demo variant regenerated by `gen demo` | `./actions.demo`, `./readers.demo`, `./client.demo` |

`grep -c "use server" src/runtime/actions.ts` = 0 after demo generation; the re-export `from` modules flipped from `.server` to `.demo` in all three entries after `typecheck:demo`, proving self-preparation switches targets. `readers.ts` (`import "server-only"`) and `client.ts` (`"use client"`) are target-identical by design; their `from` modules flip identically (verified in step 3 output).

## Findings

**F-1 (MAJOR) — Runbook target shape violated: generated server `actions.ts` has no `"use server"` header, and the recorded justification is empirically false on the installed toolchain.**
`scripts/next-target.mjs:82-88` comments that "the installed Turbopack transform rejects any non-async-function export in a 'use server' file, so re-exports are impossible in one" and therefore omits the directive the runbook requires ("Server `actions.ts` starts with `"use server"`"). Experiment E1: prepending `"use server";` to the generated server barrel and running `npm run build:server` on the installed Next 16.3.2/Turbopack succeeded (exit 0, 13s, zero warnings, valid standalone build + `server-reference-manifest.json`). The stated build-level blocker did not reproduce. Impact is functional-neutral in the implemented shape (actions are registered by their own module-level `"use server"` implementation files, and the demo export proving the boundary still passes), but (a) the letter of the P30 target shape is not met, and (b) the comment misinforms future maintainers about the toolchain. Caveats: experiment covered `next build` only (dev servers were out of scope for this gate), and runtime equivalence of the directive-barrel shape was not exercised. Remediation is a one-line template change plus comment fix, then re-running the gates.

**F-2 (MINOR) — Node version discrepancy.** Gates ran on Node v22.23.1; the repo pins Node 24.19.0. npm 11.6.0 matches. All P30 gates passed on Node 22, but pinned-toolchain acceptance was not re-executed this round.

**F-3 (INFO) — Build durations are short and healthy** (typecheck 8–12s, builds 15–19s, full `check` 33s from cold), consistent with Turbopack builds; no flakiness observed across repeated runs.

**F-4 (INFO) — ajv emits `unknown format "ulid"/"uuid" ignored` warnings during vitest** (contract-schema validation). Pre-existing noise, no gate impact.

**F-5 (INFO) — `postinstall: prisma generate` remains** in `package.json:30`; combined with the single in-chain `prisma:generate` in `check`, this matches the runbook's "one Prisma generation" intent for gates (the constraint is about the `check` chain, verified satisfied).

## Acceptance Criteria Not Satisfied

- The P30 **Target Shape** line "Server `actions.ts` starts with `"use server"`" is not met by the generator's server template (F-1). All four **Acceptance** bullets are satisfied.

## Workspace Integrity

No tracked file was modified or staged during verification; no `.env`, migrate, db-push, install, or dev-server commands were run. The three gitignored entries were deleted/regenerated as required by the acceptance test and left in demo-variant state with a canonical server `.next` build, matching the single-target workspace rule.

VERDICT: PASS-WITH-FINDINGS
