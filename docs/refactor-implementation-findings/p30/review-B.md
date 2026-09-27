# P30 Review B — Generated Runtime Entries

Reviewer: B (independent). Scope: uncommitted P30 working-tree changes vs
`docs/refactor-dossier/IMPLEMENTATION-READY.md` §P30. P00/P10/P20 working-tree
changes out of scope. All file:line references are to the working tree at
review time (2026-09-26).

## Summary of changes reviewed

- `scripts/next-target.mjs` — new `gen demo|server` command; writes the three
  deterministic entries (temp-file write + atomic rename) before `loadEnvConfig`
  and exits before Next on `gen`; arg validation (`gen` rejects extra args,
  target/command validation unchanged); dev/build env handling byte-identical
  to `git show HEAD:scripts/next-target.mjs`.
- Three generated entries (`src/runtime/actions.ts`, `readers.ts`,
  `client.ts`) exist on disk as git-ignored untracked files.
- Six concrete barrels added under `src/runtime/` (untracked, not ignored —
  see F3): `actions.server.ts`, `actions.demo.ts`, `readers.server.ts`,
  `readers.demo.ts`, `client.server.ts`, `client.demo.ts`.
- `package.json` — `typecheck:server` / `typecheck:demo` (`gen <target> && tsc
  --noEmit --incremental false`), serial `typecheck`, `test`/`test:watch` gen
  demo first, `check` = format:check → lint → prisma:validate → one
  prisma:generate → typecheck → test, new `prisma:validate`. No `pre*` hooks.
  `dev`, `dev:demo`, `build`, `build:demo`, `build:server`, `start`,
  `test:contracts` meanings preserved.
- `.gitignore`, `.prettierignore`, `eslint.config.mjs` — the three generated
  files excluded from each; the six barrels excluded from none (they are
  checked by tsc/eslint/prettier).
- `next.config.ts` — all nine `turbopack.resolveAlias` `@runtime/*` keys
  removed; `tsconfig.json` — all nine `paths` `@runtime/*` keys removed;
  `@/*` kept in both.
- 23 consumer files / 24 import sites repointed from `@runtime/*` to
  `@/runtime/actions|readers|client`.
- `src/app/(professional)/entrar/actions.ts` — directive moved from function
  level to module level; no other behavior change.

## Findings

### F1 — Barrels vs source-module export surfaces: exact match confirmed (INFO, verified)

Grep of `^export` over the 17 source modules:

- Server actions (5 modules): `entrar/actions.ts` (1),
  `portal/sign-out-action.ts` (1), `portal/adult-portal-actions.ts` (10),
  `portal/player-access-actions.ts` (4), `(public-play)/jogar/actions.ts` (1)
  = 17 = `ACTION_NAMES` in scripts/next-target.mjs:34-52; all re-exported by
  `src/runtime/actions.server.ts`. Exact set match.
- Demo actions (4 modules): `demo-auth-actions.ts` (2),
  `adult-portal-demo-actions.ts` (10), `player-access-demo-actions.ts`
  (4 actions + class `DemoPlayerCredentialIssuer`),
  `player-entry-demo-actions.ts` (1). `src/runtime/actions.demo.ts`
  re-exports all 18; the generated entry exposes the 17 actions
  (see F2 for the extra name). Every `ACTION_NAME` is present.
- Readers: server sources `adult-portal-server.ts` (9),
  `player-access-server.ts` (1), `game-events-server.ts` (5) = 15 =
  `READER_NAMES`; demo sources identical shape. Both reader barrels and both
  generated reader entries match exactly.
- Client: 3 names each, exact match both targets.
- Consumer-facing check: 24 import sites across 23 files consume 35 unique
  names; all 35 are exported by the generated entries; none missing
  (scripted diff of consumed vs provided, run this review). Names imported
  from the old aliases map 1:1 onto the new entries per responsibility
  (adult-portal→readers ×11 sites, adult-portal-actions→actions ×6,
  player-access-actions→actions ×1, player-entry-action→actions ×2,
  sign-in-action→actions ×1, sign-out-action→actions ×1,
  adult-portal-client→client ×2, game-events→readers ×3). Confirmed.

### F2 — `DemoPlayerCredentialIssuer` re-exported by the demo actions barrel but not by the generated entry (MINOR, confirmed)

`src/runtime/actions.demo.ts:18` re-exports `DemoPlayerCredentialIssuer`
from `player-access-demo-actions.ts`, but `ACTION_NAMES`
(scripts/next-target.mjs:34-52) does not include it, so the generated demo
`actions.ts` does not expose it. Its only consumer,
`src/runtime/player-entry-demo-actions.ts:11`, imports it directly from
`@/runtime/player-access-demo-actions`, not via the barrel — so this barrel
re-export is currently dead surface, and it is asymmetric with the server
barrel (the server-side issuer `SecurePlayerCredentialIssuer` lives in
`src/server/security/player-credential-tokens.ts` and is wired via
`src/server/services/player-access-container.ts`, never crossing an actions
barrel). Harmless today (nothing imports it through the barrel; both builds
and both typechecks pass), and it is arguably correct to keep the class off
the entry surface (it is not an action; it would also be illegal to
re-export a class from a `"use server"` file, reinforcing the server
barrel's omission). Suggested cleanup: drop the name from
`actions.demo.ts`, or add a one-line comment saying it is barrel-internal.

### F3 — Six concrete barrels are untracked; they must be staged with the commit (MINOR, confirmed)

`git ls-files src/runtime/` does not list the six new barrels and
`git status` shows them as `??`; `git check-ignore` confirms none of them is
ignored, and all three generated files are ignored via the anchored rules
`.gitignore:30-32`. This is the expected pre-commit state, but because the
generated entries are git-ignored, the barrels are the only tracked path to
a fresh-clone build: a commit that misses them (e.g. `git commit -am`) leaves
the repo broken. Commit-time requirement, not a code defect.

### F4 — Known deviation (server actions entry without `"use server"` header): implementation sound; residual risk is runtime-only (assessed per adjudication)

(a) The comment at scripts/next-target.mjs:82-87 is accurate and
sufficiently specific: it states the transform restriction, that the
directive stays on the five implementation files (count verified — the
server barrel re-exports from exactly those five `"use server"` modules),
and that the generated entry stays a plain re-export. The reproduced error
was confirmed in the experiment logs (`/tmp/p30-expClean.log:14`,
`/tmp/p30-expI.log`): `Error: Only async functions are allowed to be
exported in a "use server" file.` with the `"use server";` header in the
snippet, failing at every consumer import site — i.e. re-exports are indeed
rejected, so the runbook's literal sentence is unimplementable as written.

(b) Soundness per target:

- Demo: the demo entry is directive-free and re-exports from four
  directive-free/`"use client"` modules; nothing in the demo graph imports a
  `"use server"` module through the entry (the `"use server"` entrar/
  sign-out/jogar/adult-portal/player-access files are reachable only from
  the server barrel, which only the server entry references). The demo
  static export — the runbook's authoritative check — passed. Demo wiring is
  as proven as it can be without a browser.
- Server: the shape relies on Turbopack registering action IDs in the
  directive-holding implementation modules and on plain re-export chains
  handing consumers the registered references. Build success proves only
  transform acceptance and module resolution — prerender never POSTs to a
  Server Action endpoint, so the proxy wiring is unproven by the green
  build. The P50 manual browser smoke must therefore cover, in the server
  target (dev and/or booted `next start`):
  1. sign-in form submit (exercises `entrar/actions.ts` through two
     re-export hops, including its `redirect()` semantics), and sign-out
     from the portal shell;
  2. at least one mutation per `"use server"` implementation module:
     `adult-portal-actions` (e.g. create organization / change status),
     `player-access-actions` (allocate slots / start session), and
     `resolvePlayerEntryAction` from the public-play flow;
  3. network-level verification that each submit POSTs to the Next action
     endpoint (Next-Action request) and returns a successful action
     response, with no "Failed to find Server Action" /
     "Only async functions…" / "Attempted to call … from the server"
     console errors;
  4. in the demo target, one demo mutation (e.g. demo role controls)
     updating purely client-side with no action POST.
- The installed Next guide
  (`node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-server.md`)
  documents only async-function exports and says nothing about re-exports
  in either direction; there is no doc sentence the current shape
  contradicts, but also none that guarantees it — hence the smoke items
  above are the real acceptance for the deviation.

(c) Alternatives: a `"use server"` header plus one async wrapper per action
in the generated entry is transform-legal but is exactly the wrapping the
runbook forbids ("Do not wrap actions in ordinary closures") and would
duplicate 17 signatures as a drift surface; pointing the generated entry
directly at the five implementation modules (skipping the barrel) would be
equally legal but would break the target-symmetric shape the runbook table
establishes (concrete `actions.server.ts` / `actions.demo.ts` barrels) and
would put per-module mapping into the generator. The implemented shape —
literal named re-exports through the tracked concrete barrel, one shared
name list for both targets — is the most faithful implementable reading. No
alternative would have been more faithful.

### F5 — Generator: validation, determinism, ordering, exit-before-Next (INFO, verified by execution)

- `gen demo` run twice: byte-identical (sha256 match on all three entries).
- `gen demo extra` → exit 1 ("gen takes no additional arguments."); `gen`
  without target and `gen bogus` → exit 1; bogus command → exit 1.
- `gen server` flips the entries to `./actions.server` / `./readers.server`;
  a following `gen demo` restores the original demo bytes exactly
  (sha256 match) — workspace left as found.
- Writes happen at scripts/next-target.mjs:110 before `loadEnvConfig`
  (:116) and the Next spawn (:155); on `gen` the script exits at :112-114
  before env loading. Env handling (build `NODE_ENV`/`AUTH_DEV_BYPASS`
  pinning, demo env blanking) is byte-identical to
  `git show HEAD:scripts/next-target.mjs`.
- Transient `${file}.tmp` siblings (scripts/next-target.mjs:104) match no
  tsc/eslint/prettier/git pattern and are removed by the rename on success;
  only a hard crash mid-write could leave one behind (cosmetic; not
  ignored by .gitignore). No action needed.

### F6 — package.json vs runbook table (INFO, verified)

Every row of the §P30 script table is implemented as specified:
`typecheck:server`/`typecheck:demo` gen-then-`tsc --noEmit --incremental
false` (the override is load-bearing: tsconfig.json:14 sets
`"incremental": true`); serial `typecheck`; `test`/`test:watch` gen demo
then Vitest; `dev`/`dev:demo`/`build:demo`/`build:server` unchanged and
self-preparing via next-target.mjs; `build` = `npm run build:server` as at
HEAD; `check` = format:check, lint, prisma:validate, one prisma:generate,
typecheck, test. No `pre*` hooks. Two notes: (1) `check` regenerates demo
entries twice in one run (inside `typecheck:demo`, then inside `npm test`)
— this is mandated by the "commands self-prepare" rule, and generation is
byte-identical and cheap, so it is not the "generation once per target"
anti-pattern the runbook warns against (that sentence targets the Prisma
generation). (2) `test:contracts` does not self-prepare entries, but no
test imports the runtime entries (verified: zero matches for
`runtime/actions|readers|client` and `next-target` under `tests/`), so it
has no dependency to violate.

### F7 — Ignore/exclusion completeness and tracking (INFO, verified)

Generated files: ignored (`.gitignore:29-32`, root-anchored), excluded from
Prettier (`.prettierignore`) and ESLint (`eslint.config.mjs:16-18`), while
still compiled by tsc via tsconfig `include` — which is required, since the
generated entry is the surface both typechecks compile consumers against
(the drift check). Barrels: checked by tsc, eslint (`--max-warnings=0`) and
prettier; tracking state covered by F3.

### F8 — Acceptance negatives (INFO, verified)

- No `@runtime/` import or config key remains (grep over `src/`, `tests/`,
  `scripts/` returns nothing; both config diffs remove exactly the nine
  keys each and keep `@/*`).
- No import-graph parser, no negative graph-fixture suite, no
  generated-file unit test introduced (`tests/` has no reference to
  next-target or the entries; the new `scripts/clean-build-artifacts.mjs`
  is a fixed-allowlist artifact cleaner, P10/P20 scope, not a graph tool).
- No action-count/ID snapshots anywhere in the diff.
- Absent-entry preparation re-verified: deleting all three entries and
  running `gen demo` recreates them byte-identical; `typecheck:demo`
  (`gen demo && tsc --noEmit --incremental false`) passes from that state.

### F9 — entrar/actions.ts conversion (INFO, verified)

Diff vs HEAD is exactly: `"use server";` added at module top, the
function-level directive removed; the `getRuntimeMode() !== "server"` guard
and all logic unchanged. The file's only export is an async function, so
the module-level directive is transform-valid. In the demo target the file
is unreachable through the entry (entry → `demo-auth-actions`), matching
the pre-P30 alias behavior.

## Verification commands run (all green)

- `npm run format:check` → pass
- `npm run lint` → pass (`--max-warnings=0`)
- `npm run typecheck:demo` → pass (also regenerates demo entries)
- `npx vitest run tests/unit/v1-authorization.test.ts
  tests/unit/runtime-mode.test.ts` → 7 passed
- Generator determinism/validation experiments (F5), absent-entry
  regeneration (F8), consumed-vs-provided name diff (F1) — pass.
  No builds run (already green per orchestrator).

## Verdict

P30 satisfied: yes. The implementation matches §P30 on every checkable
point — barrel/export-set fidelity, consumer repointing by responsibility
(24 sites), nine-alias removal in both configs, script table, exclusions,
and acceptance negatives. The adjudicated deviation (server actions entry
as plain literal re-exports without a `"use server"` header) is implemented
soundly for both targets and is the most faithful implementable shape;
documented residual risk: server-target action proxy wiring at runtime is
unproven by builds and must be exercised by the P50 manual browser smoke
(F4b items 1-4). Findings to carry forward: F2 (dead barrel re-export of
`DemoPlayerCredentialIssuer`, cosmetic) and F3 (stage the six barrels with
the commit — required for a fresh-clone build).

## Re-review (fix round 1) — 2026-09-26

Delta scope only: verification of the two MINOR fixes from this report
(F2 dead re-export, F3 untracked barrels). Independent re-review; prior
F1/F4-F9 and the P50 smoke requirements unchanged and not re-litigated.

### Fix F3 (six barrels tracked) — VERIFIED

- `git ls-files src/runtime/` now lists all six barrels: `actions.demo.ts`,
  `actions.server.ts`, `client.demo.ts`, `client.server.ts`,
  `readers.demo.ts`, `readers.server.ts`.
- `git status --short` shows all six staged as `A`: five clean-staged
  (`actions.server.ts`, `client.demo.ts`, `client.server.ts`,
  `readers.demo.ts`, `readers.server.ts`), and `actions.demo.ts` as `AM`
  (staged add plus the unstaged F2 edit — see fix F2 below).
- Fresh-clone build path restored: the commit will carry the only tracked
  route to the generated entries. Fixed.

### Fix F2 (dead re-export removed) — VERIFIED, one staging note

- Working-tree `src/runtime/actions.demo.ts` no longer re-exports
  `DemoPlayerCredentialIssuer`; the block re-exporting from
  `player-access-demo-actions` now carries exactly the four actions
  (`allocatePlayerSlotsAction`, `endClassSessionAction`,
  `rotatePlayerCredentialAction`, `startClassSessionAction`).
- `git diff src/runtime/actions.demo.ts` (index vs worktree) shows exactly
  one removed line — `DemoPlayerCredentialIssuer,` — nothing else; the
  edit is surgical.
- Symbol still intact where it belongs: defined at
  `src/runtime/player-access-demo-actions.ts:31`, used there (:76) and
  imported directly by `src/runtime/player-entry-demo-actions.ts:11` —
  removal broke no consumer.
- Staging note (carry-forward, MINOR housekeeping): the index copy of
  `actions.demo.ts` still contains the dead re-export (hence `AM`). The
  fix exists only in the working tree; re-stage the file before commit or
  the committed version resurrects the dead export. Build-neutral either
  way.

### No new issues

- No other barrel has working-tree modifications (the other five staged
  clean), so the delta is exactly the staging of six files plus the one
  removed export line.
- `npm run typecheck:demo` under Node v24.19.0 → exit 0 (regenerates the
  demo entries first, per script definition); confirms nothing consumed
  the removed barrel export.

### Delta verdict

Both fixes hold. F3 fully resolved; F2 resolved in the working tree with
a re-stage reminder before commit. P30 remains satisfied: yes.
