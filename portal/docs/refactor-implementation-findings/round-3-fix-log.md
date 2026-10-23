# Round 3 fix log

Fix round applied on top of the staged refactor (base commit `9467757`) in
response to the round-2 review. Fixes were attempted exactly as specified; one
was skipped with evidence (F1). No commits were made.

## F1 — Generated server actions entry `"use server"` header: SKIPPED

Status: **skipped — impossible as specified on this machine; original state is
accurate and was restored.**

Files changed: none (the two files temporarily edited during the attempt,
`scripts/next-target.mjs` and `docs/current-architecture.md`, were restored to
their staged content).

The fix required the generated server `src/runtime/actions.ts` to start with
`"use server";` followed by the re-export block, premised on the round-2 claim
that a build with the header passed. The claim does not reproduce here. With
the header applied, `npm run build:server` fails on both next 16.3.2 and next
16.3.6 (Turbopack) with
`Error: Only async functions are allowed to be exported in a "use server" file.`
at `src/runtime/actions.ts:3:1`, plus 38 cascading
`Export <name> doesn't exist in target module` errors from the client
components that import the barrel. A controlled probe (header removed from the
template only, everything else identical) makes `build:server` pass on 16.3.6,
which confirms the header/re-export barrel as the cause. The strict check lives
in the Turbopack native binary (`@next/swc-win32-x64-msvc` contains the exact
message); the repo's build path is Turbopack. Per the round rules no
alternative design (e.g. generated async-function wrappers) was improvised:
the generator template, its comment, and the
`docs/current-architecture.md` paragraph were restored to the staged wording,
which correctly describes the Turbopack constraint. Consequence for gate 11:
the generated server `actions.ts` intentionally starts with `export {`, not
`"use server";`.

## F2 — Patch the vulnerable next pin: APPLIED

Status: **applied.** Files changed: `package.json`, `package-lock.json`.

- Baseline `npm audit` (next 16.3.2): 8 vulnerabilities (1 moderate, 6 high,
  1 critical).
  - `next 16.0.0 - 16.3.2` — critical — GHSA-p293-qw3h-jr36 (RCE on
    windows-hosted servers) and GHSA-2xp9-vwfh-vxw4 (RCE in image optimization
    with AVIF); both patched in `>=16.0.0 <16.3.3`.
  - `sharp <0.35.4` — high — GHSA-rgj7-g3m4-5g8c (libheif), patched in 0.35.4;
    resolved version was 0.35.3 (transitive via next).
  - Dev-only: ajv (moderate), deepmerge-ts (high, via @prisma/config), js-yaml
    (high), mysql2 (high x2, via prisma).
- `npm view next versions` confirms 16.3.6 is the newest stable 16.3.x patch
  (16.3.0–16.3.6; only canaries above).
- Applied with `npm install next@16.3.6 --save-exact` and
  `npm install -D eslint-config-next@16.3.6 --save-exact` (the initial installs
  without `--save-exact` wrote `^16.3.6`; redone to keep the repo's exact-pin
  convention). No `npm audit fix` was used.
- After: `next` 16.3.2 → **16.3.6**, `eslint-config-next` 16.3.2 → **16.3.6**,
  `sharp` 0.35.3 → **0.35.4**. Final `npm audit`: **6 vulnerabilities (1
  moderate, 5 high)** — the next critical pair and the sharp advisory are gone;
  the remaining advisories (ajv, deepmerge-ts, js-yaml, mysql2 x2) are the
  expected dev-only set and were left in place.
- Lockfile observation: the fresh lockfile was written by local npm 11.6.0.
  The `"dev": true` markers on the 27 `@img/sharp-*`/`@img/sharp-libvips-*`
  optional platform-binary entries were absent in the staged lockfile (written
  by npm 11.17.0) and remain absent in the fresh one — npm 11.6.0 did **not**
  restore them. No manual lockfile surgery was performed.

## F3 — Dead icon variants: APPLIED

Files changed: `src/components/shared/icon.tsx`.

`rg` over the whole `src/` tree confirmed zero call sites for
`name="book"`, `name="edit"`, `name="link"`, and `name="paperclip"` (exit 1).
The four members were removed from the `IconName` union and their conditional
JSX blocks deleted. `"module"` was left untouched as out of scope.

## F4 — Duplicate import statements: APPLIED

Files changed: `src/app/(professional)/portal/turmas/[id]/page.tsx`.

The two `@/runtime/readers` import statements (former lines 6–7) were merged
into a single multi-name import keeping `getClassPageData`,
`getPlayerAccessPageData`, and `listStaticClassIds`. Passes format:check.

## F5 — Gitignore generator temp files: APPLIED

Files changed: `.gitignore`.

Added `/src/runtime/*.tmp` to the generated-runtime-entries block next to the
existing `actions.ts` / `readers.ts` / `client.ts` entries, covering the
write-then-rename temp files created by `scripts/next-target.mjs`.

## F6 — Temp directory leak in the escape regression: APPLIED

Files changed: `tests/unit/clean-build-artifacts.test.ts`.

The fixture now returns the `mkdtemp` parent and the `finally` block replaces
the two per-directory `rmSync` calls with a single
`fs.rmSync(parent, { recursive: true, force: true })`, sweeping `root`,
`outsideDir`, and the parent temp directory itself. The test passes.

## F7 — Historical-doc hygiene: APPLIED

Files changed: `docs/architecture-audit-2026-09-23.md`,
`docs/implementation/README.md`,
`docs/implementation/phase-01-foundation-contracts.md`,
`docs/implementation/phase-03-game-integration.md`,
`docs/implementation/phase-04-reporting-hardening.md`.

- `architecture-audit-2026-09-23.md`: added a top banner in the
  `implementation_plan.md` style declaring the audit a historical document
  describing the pre-refactor architecture at commit `d4af23c` (including the
  retired Generation-A product) and pointing to the refactor dossier and
  current architecture doc.
- `implementation/README.md`: the audit line no longer calls its phases 0–3 a
  live "precondition for further slice work" (now historical evidence, debt
  addressed by the refactor); `v1-architecture-plan.md` is now introduced as
  the historical plan superseded by
  `docs/refactor-dossier/IMPLEMENTATION-READY.md`.
- `phase-01-foundation-contracts.md`: the legacy banner now states the
  container/Docker build steps are obsolete (Docker is not a supported build or
  deployment target for the current version); the two dangling relative links
  to `../schemas/domain-rules.md` and `../schemas/api-contracts.md` were
  replaced by a prose mention marked as removed.
- `phase-03-game-integration.md` (idempotency bullet) and
  `phase-04-reporting-hardening.md` (CSV export note): `api-contracts.md`
  references reframed as plain historical mentions of the former, removed
  document — no links, no live-sounding pointers.
- Verified repo-wide: no markdown link to `schemas/api-contracts.md` or
  `schemas/domain-rules.md` remains anywhere in `docs/`
  (`rg '\]\([^)]*schemas/(api-contracts|domain-rules)\.md'` → no matches);
  remaining mentions are backticked prose marked as removed or dated audit
  records.

## F8 — Logger redaction gap: APPLIED

Files changed: `src/server/observability/logger.ts`, `tests/unit/http.test.ts`.

Added `"entryCredential"` and `"*.entryCredential"` to the sensitive-path
redaction list alongside the existing `credential`/`playerCredential` entries.
The structured-input block in the redaction test now includes
`entryCredential: <sentinel>` and asserts it is censored, following the
existing pattern (no restructuring). The test file passes (4 tests).

## F9 — DESIGN.md mobile navigation accuracy: APPLIED

Files changed: `DESIGN.md`.

The two claims of a five-destination mobile bottom navigation (breakpoint
section and Navigation section) now describe the actual behavior: a fixed bar
in a four-column grid (`repeat(4, minmax(0, 1fr))`, portal.module.css) where
the fifth destination wraps to a second row for roles that have five items.
Only these two claims changed; text style matches the file.

## F10 — Malformed-state fallback assertion: APPLIED

Files changed: `tests/unit/demo-player-access.test.ts`.

The malformed-state test now binds the fallback result and adds
`expect(fallback).not.toBe(demoAdultPortalSeed)` after the existing
`toEqual` assertion, proving the fallback returns a fresh clone rather than the
seed reference. The test file passes (8 tests).

## Verification gates

| # | Command | Exit | Key output |
| --- | --- | --- | --- |
| 1 | `npm run clean:build` | 0 | Removed `.next`, `out` |
| 2 | `npm run format:check` | 0 | All matched files use Prettier code style |
| 3 | `npm run lint` | 0 | eslint clean (`--max-warnings=0`) |
| 4 | `npm run prisma:validate` | 0 | Schema is valid |
| 5 | `npm run typecheck:server` | 0 | tsc clean |
| 6 | `npm run typecheck:demo` | 0 | tsc clean |
| 7 | `npm test` | 0 | 28 files, 200 tests passed |
| 8 | `npm run build:server` | 0 | Next.js 16.3.6 (Turbopack) build succeeded |
| 9 | `npm run build:demo` | 0 | Static build succeeded |
| 10 | `npm audit` | 0 | 6 vulnerabilities (1 moderate, 5 high) — dev-only |
| 11 | `node scripts/next-target.mjs gen server && head -1 src/runtime/actions.ts` | 0 | Prints `export {` — no `"use server";` header because F1 was skipped (see F1) |
| 12 | `git add` all modified tracked files | 0 | `git diff --name-only` empty |

## Notes for follow-up reviewers

- F1 is the only skipped fix. The round-2 empirical claim (build passes with a
  `"use server"` header on a re-export barrel) is contradicted by the
  Turbopack build on both 16.3.2 and 16.3.6 on this machine; if that claim is
  re-raised, it needs a reproducible build log attached.
- The lockfile's missing `"dev": true` markers on optional platform binaries
  persist (npm 11.6.0 did not restore them); flagged for observation only.
- During the round, a temporary git stash was created and popped to recover
  worktree state; all content was re-verified afterwards (conflict markers
  absent, every fix re-checked, line endings normalized back to LF to match
  the index).
