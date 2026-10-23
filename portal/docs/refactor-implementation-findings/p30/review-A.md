# P30 Review A — Generated Runtime Entries

Reviewer: Reviewer A (independent). Read-only review; no implementation files modified.
Reference: `docs/refactor-dossier/IMPLEMENTATION-READY.md` §P30 (lines 258-330).
Node: v24.19.0 at `/c/Users/Vitor/tools/node-v24.19.0-win-x64`.

## Scope reviewed

| Area | Files |
| --- | --- |
| Generator | `scripts/next-target.mjs` (gen command, pre-build generation, entry templates) |
| Scripts | `package.json` (script chains) |
| Exclusions | `.gitignore`, `.prettierignore`, `eslint.config.mjs` |
| Barrels (6, new) | `src/runtime/actions.server.ts`, `actions.demo.ts`, `readers.server.ts`, `readers.demo.ts`, `client.server.ts`, `client.demo.ts` |
| Source modules (17) | `src/app/(professional)/entrar/actions.ts`, `.../portal/sign-out-action.ts`, `.../portal/adult-portal-actions.ts`, `.../portal/player-access-actions.ts`, `src/app/(public-play)/jogar/actions.ts`, `src/runtime/demo-auth-actions.ts`, `adult-portal-demo-actions.ts`, `player-access-demo-actions.ts`, `player-entry-demo-actions.ts`, `adult-portal-server.ts`, `adult-portal-demo.ts`, `player-access-server.ts`, `player-access-demo.ts`, `game-events-server.ts`, `game-events-demo.ts`, `adult-portal-server-client.ts`, `adult-portal-demo-client.ts` |
| Consumers (23 files, 24 import sites) | 11 pages under `src/app/(professional)/`, 10 components under `src/components/portal/`, 2 under `src/components/public/` |
| Config | `next.config.ts` (9 aliases removed), `tsconfig.json` (9 paths removed) |
| Directive conversion | `src/app/(professional)/entrar/actions.ts` |
| Deviation | server generated `actions.ts` has no `"use server"` header; adjudicated deviation, implementation soundness assessed below |

Out of scope (earlier phases, present in the same working tree): P00/P10/P20
deletions under `src/server/`, `src/application/`, `contracts/`, `prisma/`,
`scripts/clean-build-artifacts.mjs`, `.github/workflows/ci.yml`, `tests/unit/clean-build-artifacts.test.ts`.

## Findings

### MAJOR-1 — The six concrete barrels are not tracked by git (runbook: "Concrete variants remain tracked and checked")

**File:** `src/runtime/actions.server.ts`, `src/runtime/actions.demo.ts`,
`src/runtime/readers.server.ts`, `src/runtime/readers.demo.ts`,
`src/runtime/client.server.ts`, `src/runtime/client.demo.ts`

**Evidence (confirmed, not a question):**

```
$ git ls-files --error-unmatch src/runtime/actions.server.ts
error: pathspec 'src/runtime/actions.server.ts' did not match any file(s) known to git

$ git ls-files src/runtime/
  (16 files: adult-portal-demo-actions.ts ... player-entry-demo-actions.ts — none of the six barrels)

$ git status --porcelain src/runtime/
 M src/runtime/mode.ts
?? src/runtime/actions.demo.ts
?? src/runtime/actions.server.ts
?? src/runtime/client.demo.ts
?? src/runtime/client.server.ts
?? src/runtime/readers.demo.ts
?? src/runtime/readers.server.ts
```

They are not ignored (`git check-ignore -v` on all six exits 1), so they are
committable — they simply have not been staged. The review brief describes them
as "six new tracked barrels"; in the tree as reviewed they are untracked.

**Impact:** a fresh clone would contain the three git-ignored generated entries'
*generator* but none of their re-export targets. `typecheck:server`,
`typecheck:demo`, `npm test`, `build:server` and `build:demo` would all fail
with module-not-found, and the P30 change set would not be self-contained in git.

**Fix:** `git add src/runtime/actions.server.ts src/runtime/actions.demo.ts
src/runtime/readers.server.ts src/runtime/readers.demo.ts src/runtime/client.server.ts
src/runtime/client.demo.ts` before committing P30. No code change required.

### MAJOR-2 — The cited "compiled evidence" for the server target does not demonstrate what it claims, and comes from the wrong build

**Files:** `.next/server/chunks/ssr/_1j6gvsh._.js`, `.next/server/chunks/[turbopack]_runtime.js`

The brief offers `a.s([...signInAction...])` in
`.next/server/chunks/ssr/_1j6gvsh._.js` as proof that client components reach
action proxies in the server target. Two independent reasons invalidate it:

1. **`a.s` is not an action registration.** It is Turbopack's ESM export-name
   declaration. In `.next/server/chunks/[turbopack]_runtime.js`:
   `contextPrototype.s = esmExport;` with body
   `esmExport(bindings, id, dynamic) { ... esm(exports, bindings, dynamic); }`.
   The same chunk declares `a.s(["default"])`, `a.s(["getRuntimeMode"])` (a
   plain function from `src/runtime/mode.ts`, no directive) and
   `a.s(["DemoPlayerCredentialIssuer"])` (a plain class) — the pattern is
   generic to every module, action or not.

2. **The artifact is from the demo build, not the server build.** `.next` on
   disk was written 2026-09-26 20:08, i.e. *after* the two failed experiments
   at 20:04 / 20:06:
   - `.next/export-marker.json` → `{"version":1,"hasExportPathMap":false,"exportTrailingSlash":true,...}`
   - `.next/export-detail.json` → `{"version":1,"outDirectory":"...\\SMS_Portal\\out","success":true}`
   - `routes-manifest.json` → `outputFileTracingRoot: false`, `appPaths: []`
   - no `.next/standalone/` (the server target's `output: "standalone"`)

   So `signInAction` appearing there only shows the demo barrel's exports are
   wired; it says nothing about server-action registration.

**Consequence:** the server half of the adjudicated deviation rests only on
"build:server passed" (asserted, not reproducible here) plus static reasoning.
I found no server build artifact and no `build:server` log in `/tmp`
(only `/tmp/p30-expClean.log` and `/tmp/p30-expI.log`, both failures). This is
not a code defect; it is an unverified load-bearing claim, and the P50 manual
smoke is currently the only remaining gate for it (see R1 below).

**What I could verify positively, and it is stronger than the original evidence:**

- *Demo target, no server-action reachability — proven.* The current demo build
  contains `.next/server/server-reference-manifest.json` with
  `{"node":{},"edge":{}}` — **zero registered server action IDs**. The per-route
  action chunks are empty stubs, e.g.
  `.next/server/chunks/ssr/1oeh_server_app_(professional)_portal_admin_equipe_page_actions_1hj42ld.js`
  is exactly `module.exports=[82320,(a,b,c)=>{}];`. The only
  `createServerReference` / `registerServerReference` occurrences in the tree are
  the React RSC runtime's own helper *definitions*, one occurrence each.
  Independently, the demo implementations are inlined into browser chunks
  (`out/_next/static/chunks/*.js` contain `createDemoProfessional` /
  `allocatePlayerSlots` / `resetDemoPortal`), confirming they are ordinary
  browser-callable functions as the runbook requires.
- *The Turbopack constraint is real.* Confirmed three ways without rerunning a
  build: the string `Only async functions are allowed to be exported in a` is
  present in `node_modules/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node`;
  `/tmp/p30-expClean.log:14` reproduces it against `./src/runtime/actions.ts:3:1`
  (`> 3 | export {`); and Next's own webpack-side runtime validator
  `node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js`
  throws `A "use server" file can only export async functions, found ...` (E352).
  Note the two logs are byte-identical apart from the `next.config.ts` timing
  line (`diff` → single-line difference), so they are two runs of the same
  experiment, not two independent variants.

### MINOR-1 — `DemoPlayerCredentialIssuer` is re-exported by the demo actions barrel but is not part of the generated contract

**File:** `src/runtime/actions.demo.ts:18`

`actions.demo.ts` exports 18 names; `ACTION_NAMES` in
`scripts/next-target.mjs:34-52` has 17, so this class is unreachable through
`@/runtime/actions`. The server barrel has no counterpart. Nothing needs it via
the entry — `src/runtime/player-entry-demo-actions.ts:11` imports it directly
from `@/runtime/player-access-demo-actions`. Dead surface, asymmetric with
`actions.server.ts`. Harmless today; the drift check still holds because a
consumer importing it from `@/runtime/actions` would fail in *both* targets.

### MINOR-2 — `test:contracts` does not self-prepare

**File:** `package.json:25` — `"test:contracts": "vitest run tests/unit/v1-contracts.test.ts"`

Runs Vitest without `gen demo`, against the runbook rule "Target commands
self-prepare; no command may depend on whichever entry was left by a previous
command". Currently harmless: no file under `tests/` references any generated
entry (grep for `next-target|runtime/actions|runtime/readers|runtime/client|
actions.server|actions.demo` over `tests/` returns nothing), and the full suite
passes. It becomes a clean-checkout break the moment a test imports
`@/runtime/{actions,readers,client}`. `package.json:24` (`test`) and
`package.json:26` (`test:watch`) are both correct.

### MINOR-3 — `typecheck:*` compiles against whichever `.next/types` the last build left behind

**File:** `tsconfig.json:28` — `".next/types/**/*.ts"` in `include`

`--incremental false` (runbook-mandated, correctly used) neutralizes
`tsconfig.tsbuildinfo` but not the Next-generated `.next/types`. After
`build:demo`, `typecheck:server` type-checks against demo-generated route types.
Pre-existing Next behavior, not introduced by P30, and the runtime-entry drift
check is unaffected (route types are orthogonal to the concrete exports). Noted
only because the runbook leans on the typechecks as the drift check.

### MINOR-4 — Stray `.tmp` file possible if `gen` is interrupted mid-write

**File:** `scripts/next-target.mjs:104-106` — writes `src/runtime/actions.ts.tmp`
then `fs.renameSync`. A crash between the two leaves a `.tmp` file that no ignore
rule covers (`.gitignore:30-32` lists the three exact filenames), so it would
surface as untracked noise. Inert for `tsc` (`**/*.ts` does not match `.tmp`),
prettier and eslint. Atomic replacement is explicitly endorsed by the runbook,
so this is informational only.

## Verified clean (no findings)

**Barrel export sets — exact match per responsibility.** Cross-checked by
script: generated `ACTION_NAMES` (17) vs both actions barrels, `READER_NAMES`
(15) vs both readers barrels, `CLIENT_NAMES` (3) vs both client barrels.
`actions.server.ts` 17/17 exact, `readers.server.ts` 15/15 exact,
`readers.demo.ts` 15/15 exact, `client.server.ts` 3/3 exact,
`client.demo.ts` 3/3 exact, `actions.demo.ts` 18 with the single
`DemoPlayerCredentialIssuer` surplus (MINOR-1). Every name in the generator's
lists exists in the corresponding source module's `^export` surface, and every
`^export` in those 17 modules is accounted for.

**Generator.** Arg validation is total and correct
(`scripts/next-target.mjs:14-27`): no args → usage + exit 1; `gen` without
target / bad target → "Runtime target must be either demo or server." + exit 1;
bad command → usage + exit 1; `gen demo extra` and `gen demo --port 3000` →
"gen takes no additional arguments." + exit 1. Extra args still pass through to
Next for `dev`/`build`, as before. Writes happen at
`scripts/next-target.mjs:110`, strictly before `loadEnvConfig` (line 116) and
before `spawnSync` (line 155); `gen` exits at line 113 before any Next
invocation and before any env load, so `gen demo` works with no server env
(verified by running it with no `DATABASE_URL`/`NEON_AUTH_*` present).
Determinism verified empirically: two consecutive `gen demo` runs produced
byte-identical files (`actions.ts` md5 `13b3b992f13d70202e02b3ce9bacf31f`,
`readers.ts` `2fb2842a71f62dcb0edd0217f063c435`, `client.ts`
`298215a58f4b5e2d517c02e490013b6f`), LF-only (`hasCR: false`), 517/443/115
bytes, and no leftover `.tmp`. `Object.entries` order is the fixed insertion
order, identical for both targets. **Environment handling is byte-identical to
`git show HEAD:scripts/next-target.mjs`** — the `loadEnvConfig` /
`APP_RUNTIME_MODE` / `NEXT_PUBLIC_APP_RUNTIME_MODE` / `NODE_ENV` /
`AUTH_DEV_BYPASS` / demo-blanking-list / `nextBin` / `spawnSync` / exit-status
blocks are unchanged; the diff is purely additive above line 116.

**`package.json` — every row of the runbook table matches exactly.**
`typecheck:server` (line 21) and `typecheck:demo` (line 22) generate then run
full-project `tsc --noEmit --incremental false`; `typecheck` (line 23) runs both
serially; `test` (line 24) is literally the runbook's example
`node scripts/next-target.mjs gen demo && vitest run`; `test:watch` (line 26) is
the watch equivalent. `dev`/`dev:demo`/`build:server`/`build:demo` (lines 11-15)
keep their meanings and generate inside `next-target.mjs` before Next starts;
`build` remains `npm run build:server`. `check` (line 27) is
`format:check && lint && prisma:validate && prisma:generate && typecheck &&
test` — `prisma:generate` appears exactly once, after `prisma:validate` and
before either typecheck, as required. No `pre*` hooks exist (only the
pre-existing `postinstall`).

**Exclusions.** All three generated files are excluded in all three tools
(`.gitignore:30-32`, `.prettierignore:10-12`, `eslint.config.mjs:16-18`), and
none of the six barrels is excluded by any of them (`git check-ignore` exits 1
for all six; `format:check` and `lint` both pass with the barrels present, so
they really are being checked). The `.prettierignore:9` `REFACTOR_PLAN.md` line
is an earlier-phase leftover, not P30 scope creep, and the file exists.

**Consumer repointing — all 24 sites correct by responsibility.** `actions`:
`entrar/page.tsx` (signInAction), `portal-shell.tsx` (signOutAction),
`classes-screen.tsx`, `organization-detail-screen.tsx`,
`organizations-screen.tsx`, `deactivate-organization-control.tsx`,
`class-detail-screen.tsx` (3), `team-screen.tsx` (4),
`player-access-workflow.tsx` (4), `public/game-host.tsx` and
`public/player-entry-screen.tsx` (resolvePlayerEntryAction). `readers`:
`portal/layout.tsx`, `portal/page.tsx`, `admin/equipe`, `admin/organizacoes`,
`admin/organizacoes/[id]`, `turmas`, `turmas/[id]` (2 imports collapsed into
one), `resultados`, `resultados/[classGroupId]`,
`resultados/[classGroupId]/players/[playerSlotId]`. `client`:
`demo-role-controls.tsx`, `use-demo-portal.ts`. No symbol was routed to the
wrong entry. All ten `readers` consumers are Server Components (no `"use
client"`), so the `import "server-only"` header is satisfied; both `client`
consumers are `"use client"` files, so the `"use client"` header on
`src/runtime/client.ts` is consistent. `src/runtime/actions.server.ts` re-exports
no server-only value into a client module, and
`src/runtime/adult-portal-server-client.ts:1` reaches the demo store through
`import type` only, so nothing is pulled into the browser bundle.

**No import cycles.** None of the five `"use server"` implementation modules
imports `@/runtime/actions`, `@/runtime/readers` or `@/runtime/client`.

**`entrar/actions.ts` conversion is clean.** The diff is exactly the directive
move: `"use server";\n\n` added at line 1, the inline `"use server";` removed
from the top of `signInAction` (line 17). No other line changed, no behavior
change. The other four action implementation modules already had module-level
directives, so all five are consistent, and no inline `"use server"` remains
anywhere under `src/app` or `src/runtime`.

**Deviation comment accuracy (a) — accurate.** `scripts/next-target.mjs:82-87`
states the constraint, the impossibility of re-exports in a `"use server"` file,
that the directive lives on the five implementation files, and that the plain
re-export chain keeps consumers on the generated entry. I verified each clause:
the constraint is real (MAJOR-2 evidence), and all five implementation files do
begin with `"use server"` (`entrar/actions.ts:1`, `portal/sign-out-action.ts:1`,
`portal/adult-portal-actions.ts:1`, `portal/player-access-actions.ts:1`,
`(public-play)/jogar/actions.ts:1`). The demo entry is directive-free as
required, and `readers.ts` carries `import "server-only";` in both targets
while `client.ts` carries `"use client";` in both.

**Aliases removed.** All nine `resolveAlias` keys deleted from `next.config.ts`
(the now-empty `turbopack` block removed with them; `runtimeMode` is still used
by the rest of the config) and all nine `paths` entries deleted from
`tsconfig.json`; `@/*` retained in both. Repo-wide `git grep "@runtime"` and a
working-tree grep return hits only in planning/review markdown
(`REFACTOR_PLAN.md`, `docs/agent-reviews/**`, `docs/refactor-dossier/**`) — no
code import and no config key remains.

**Acceptance negatives — respected.** `scripts/` contains only
`next-target.mjs`, `start.mjs`, `clean-build-artifacts.mjs` (+ `.d.mts`): no
import-graph parser. No test file references the generator, the generated
entries, or either barrel. No negative graph fixtures, no action-count or
manifest-ID snapshots. The only new test in the tree
(`tests/unit/clean-build-artifacts.test.ts`) belongs to P20.

**Self-preparation from absent entries — verified.** I deleted
`src/runtime/{actions,readers,client}.ts` and ran `npm run typecheck:server`:
exit 0, and all three files were regenerated. The workspace was restored to the
demo target afterwards (`actions.ts` md5 back to
`13b3b992f13d70202e02b3ce9bacf31f`).

## Verification commands and results

| Command | Result |
| --- | --- |
| `npm run format:check` | PASS — "All matched files use Prettier code style!" (exit 0) |
| `npm run lint` | PASS — `eslint . --max-warnings=0` clean (exit 0) |
| `npm run typecheck:demo` | PASS (exit 0) |
| `npm run typecheck:server` | PASS (exit 0) — added by me, not in the brief |
| `npm run typecheck:server` from deleted entries | PASS (exit 0), entries regenerated |
| `npx vitest run tests/unit/v1-authorization.test.ts tests/unit/runtime-mode.test.ts` | PASS — 2 files, 7 tests |
| `npm test` | PASS — 28 files, 187 tests (added by me; also proves `test` self-prepares) |
| `node scripts/next-target.mjs {no args / gen / gen bogus / frobnicate demo / gen demo extra / gen demo --port 3000}` | exit 1 each, correct message for each case |
| `gen demo` twice + md5sum | byte-identical, LF-only, no leftover `.tmp` |
| `git check-ignore -v` on the 3 generated files | ignored, by `.gitignore:30/31/32` |
| `git check-ignore -v` on the 6 barrels | exit 1 — not ignored anywhere |
| `git ls-files --error-unmatch src/runtime/actions.server.ts` | error — not known to git |
| `git grep "@runtime"` | planning markdown only; no code/config hit |

No builds were run, per instructions. The current `.next` is the demo export
(MAJOR-2).

## Residual risks the P50 manual smoke must cover

**R1 (highest) — server-target client → action proxy across two re-export hops.**
The server generated entry is `actions.ts` → `actions.server.ts` → the
`"use server"` leaf. Nothing in the current workspace proves the client graph
resolves those two hops to a real server reference rather than bundling the
implementation. P50 must exercise, against `dev`/`build:server`, at least one
client-component path per action group and confirm the request is a POST to an
RSC endpoint carrying an action id (not a 404 and not a direct implementation
call): sign-out via the portal-shell form, create class (`classes-screen.tsx`),
change org status + deactivate teacher assignment + assign teacher to class +
change membership + assign org admin + create demo professional
(`organizations-screen.tsx`, `class-detail-screen.tsx`, `team-screen.tsx`),
allocate/rotate/start/end player session (`player-access-workflow.tsx`), and
`resolvePlayerEntryAction` from both `public/game-host.tsx` and
`public/player-entry-screen.tsx`.

**R2 — silent degradation if a leaf loses its directive.** If any of the five
implementation modules ever drops its module-level `"use server"`, nothing in
`typecheck`, `lint` or `format:check` notices: the generated entry is
lint- and prettier-ignored and the barrels carry no rule requiring the re-export
target to be a directive module. The chain would quietly become a direct server
import. P50 should confirm all five files still start with `"use server"` (they
do today) and that a server-target client action round-trips.

**R3 — action-id churn.** Action ids derive from the leaf module path, which is
identical to the pre-P30 alias target, so no id change is expected. P50 should
confirm a client action still posts to a resolvable action id after the
`build:server` → `build:demo` → `build:server` sequence, since the build
artifacts overwrite each other in `.next`.

## Verdict

**P30 satisfied: NO — conditional on one pre-commit action.**

The implementation itself meets §P30. Barrel sets match the source export
surfaces exactly per responsibility, all 24 consumer repointings are correct,
the generator validates/orders/writes deterministically and preserves
pre-P30 environment handling byte-for-byte, every package script matches the
runbook table, exclusions are complete, `entrar/actions.ts` is a pure
directive move, no `@runtime/` import or config key remains, and the
self-preparation-from-absent acceptance case was reproduced. The adjudicated
`"use server"` deviation is implemented soundly: the constraint is real, the
explanatory comment at `scripts/next-target.mjs:82-87` is accurate in every
clause, the five implementation files do own the directive, and the demo half of
the deviation is positively proven by an empty
`.next/server/server-reference-manifest.json` plus empty per-route action
chunks.

Two things must be closed before P30 lands:

1. **MAJOR-1** — stage the six concrete barrels. Without them the phase is not
   shippable, and the runbook's "concrete variants remain tracked and checked"
   is not met.
2. **MAJOR-2** — the server-target action-registration evidence does not exist;
   the artifact cited is a demo-build ESM export-name list, not action
   registrations. Either capture a server build (a populated
   `.next/server/server-reference-manifest.json` and non-empty
   `*_page_actions_*.js` chunks, contrasted with the empty demo ones) or carry
   R1/R2 into the P50 smoke explicitly. This is a verification gap, not a code
   defect, so it does not block on the code — but it does block on the claim.

The five MINORs are advisory and none blocks the phase.

---

# Re-review (fix round 1) — 2026-09-26

Reviewer: Reviewer A (independent). Read-only; no implementation file modified.
Delta scope: prior-round fix items (1) six barrels tracked, (2) `DemoPlayerCredentialIssuer`
removed from `src/runtime/actions.demo.ts`, (3) honesty of the deviation record after the
MAJOR-2 evidence correction. Node v24.19.0 at `/c/Users/Vitor/tools/node-v24.19.0-win-x64`.

## Fix (1) — six barrels tracked: VERIFIED RESOLVED

```
$ git ls-files --error-unmatch <each of the 6>
actions.server  tracked=YES  ignored=NO
actions.demo    tracked=YES  ignored=NO
readers.server  tracked=YES  ignored=NO
readers.demo    tracked=YES  ignored=NO
client.server   tracked=YES  ignored=NO
client.demo     tracked=YES  ignored=NO
```

`git status --short src/runtime/` now shows `A` (staged) for all six; the previous
`??` untracked state is gone. `git check-ignore` still exits non-zero for each, so they are
tracked *and* still linted/formatted — the "concrete variants remain tracked and checked"
runbook clause is met in both halves. MAJOR-1 is closed.

## Fix (2) — dead re-export removed: VERIFIED RESOLVED

`src/runtime/actions.demo.ts` (working tree) is now 24 lines, 17 names; the
`DemoPlayerCredentialIssuer` line is gone. Re-ran the export-set parity check over all six
barrels against the generator's name lists — all exact, no surplus, no shortfall:

```
actions.server 17/17   actions.demo 17/17
readers.server 15/15   readers.demo 15/15
client.server   3/3    client.demo   3/3
```

`git grep DemoPlayerCredentialIssuer` shows the only remaining code uses are the direct
`@/runtime/player-access-demo-actions` imports in `player-access-demo-actions.ts:76` and
`player-entry-demo-actions.ts:11,34` — nothing reaches it through the generated entry, so
removing it breaks no consumer. MINOR-1 is closed. Generator output is byte-identical to
the prior round (`gen demo` md5s `13b3b992…` / `2fb2842a…` / `298215a5…`), confirming the
fix touched the barrel only, not the generated entries.

## Deviation record (MAJOR-2) — factual; nothing false remains on disk

`scripts/next-target.mjs:82-87` is byte-identical to the text reviewed last round (see
`git diff -- scripts/next-target.mjs`: the block is added verbatim, unmodified). The comment
makes **no build-artifact claim** — it asserts only (a) the Turbopack constraint, (b) that
re-exports are impossible inside a `"use server"` file, (c) that the five implementation
modules own the directive, (d) the intended consequence. Clause (a) remains independently
true; clause (c) re-verified this round — `entrar/actions.ts`, `portal/sign-out-action.ts`,
`portal/adult-portal-actions.ts`, `portal/player-access-actions.ts`,
`(public-play)/jogar/actions.ts` all have `"use server";` on line 1, matching the count the
comment states. Clause (d) is a design intent, not a measurement, and remains unproven — it
is R1 below, not a false statement in the record. Repo-wide
`grep -rn "1j6gvsh\|a\.s(\[\"signInAction"` over `*.md` returns no hit, so the invalid
demo-build evidence cited in the original brief is **not** recorded anywhere in the tree and
needs no retraction. MAJOR-2 is closed on the coordinator's accepted correction: the
server-side action-proxy wiring is proven by build success only, and the P50 browser smoke
carries the sign-in redirect, sign-out, one mutation per `"use server"` module, a
network-level action POST, and the demo client mutation.

## MINOR-5 (new) — the `actions.demo.ts` fix is in the worktree but not in the index

`git status --short` shows `AM src/runtime/actions.demo.ts`; `git diff --cached` on that
path still contains the pre-fix body with `DemoPlayerCredentialIssuer`, while
`git diff` (worktree vs index) shows the one-line removal. A plain `git commit` would land
the pre-fix barrel and silently reopen MINOR-1's asymmetry. `git add src/runtime/actions.demo.ts`
(or `git commit -a`) before committing P30. No code change required.

## Status of prior MINORs

- MINOR-1 dead re-export — **resolved** (see above).
- MINOR-2 `test:contracts` (`package.json:25`) does not self-prepare — **unchanged**, still
  advisory; no test in `tests/` references a generated entry, so the suite is unaffected.
- MINOR-3 `tsconfig.json:28` `.next/types` staleness — **unchanged**, pre-existing Next behavior.
- MINOR-4 interrupted-`gen` `.tmp` — **unchanged and currently inert**: no `src/runtime/*.tmp`
  exists on disk.

## Verification commands and results

| Command | Result |
| --- | --- |
| `git ls-files --error-unmatch` × 6 barrels | all exit 0 (tracked) |
| `git check-ignore -q` × 6 barrels | all exit 1 (not ignored) |
| `git status --short src/runtime/` | 6 × `A`, no `??` |
| `npm run typecheck:demo` | PASS (exit 0) |
| `npm run typecheck:server` | PASS (exit 0) |
| `npm run format:check` | PASS — "All matched files use Prettier code style!" |
| `npm run lint` | PASS (exit 0) |
| `npm test` | PASS — 28 files, 187 tests |
| barrel-export parity script (6 barrels) | 17/17, 17/17, 15/15, 15/15, 3/3, 3/3 |
| `git grep DemoPlayerCredentialIssuer` | only direct leaf-module uses remain |
| `grep -rn "1j6gvsh" --include=*.md` | no hits |

Workspace left on the demo target (`gen demo` md5s unchanged); no `.tmp` residue.

## Delta verdict

**MAJOR-1 resolved. MAJOR-2 closed on the accepted correction (evidence now honestly recorded:
build-only, P50 smoke outstanding). MINOR-1 resolved. MINOR-5 open — advisory, one
`git add` before commit. MINORs 2-4 unchanged and non-blocking.**

**P30 satisfied: YES**, conditional only on staging the already-fixed
`src/runtime/actions.demo.ts` (MINOR-5). No BLOCKER, no MAJOR, no scope creep, no regression:
the two target typechecks, lint, format and the full suite are green with the fix applied.
