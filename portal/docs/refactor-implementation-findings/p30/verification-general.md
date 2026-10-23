# P30 Verification — Generated Runtime Entries (general review)

Date: 2026-09-26. Verifier: independent read-only pass over the working tree.
Node v24.19.0. No builds executed (already green per implementer); quick checks
re-run by the verifier: `format:check`, `lint`, `vitest run
tests/unit/runtime-mode.test.ts tests/unit/proxy.test.ts`, `typecheck:demo` —
all pass (8/8 tests, tsc clean, ESLint 0 warnings, Prettier clean).

## Scope verified

1. **`scripts/next-target.mjs`** (read in full, 162 lines). Confirmed:
   - Argument validation: `command ∈ {dev, build, gen}` and
     `target ∈ {demo, server}` else usage error + exit 1 (lines 14–23); `gen`
     rejects extra arguments (lines 24–27).
   - Deterministic content: static `ACTION_NAMES` (17), `READER_NAMES` (15),
     `CLIENT_NAMES` (3) arrays and a pure `reExports()` template (lines
     34–78); no time, env, or randomness in the emitted text.
   - Ordering: `writeRuntimeEntries(target)` runs unconditionally at line 110,
     before `loadEnvConfig` (116) and the Next spawn (155); `gen` exits at
     lines 112–114 before Next is invoked. Both targets' entries written
     before every `dev`/`build`.
   - Atomic write: `writeFileSync` to `${filePath}.tmp` then `renameSync`
     (lines 104–106).
   - Entry shapes: server `actions.ts` is a plain literal named re-export
     barrel from `./actions.server` with **no** directive; `readers.ts` starts
     with `import "server-only"` in both targets; `client.ts` starts with
     `"use client"` in both targets; demo `actions.ts` is directive-free. All
     as designed (see Finding 3 for the adjudicated server-actions deviation).
   - Comment accuracy: the comment at lines 82–87 explains why no `"use
     server"` header is emitted (Turbopack rejects non-async-function exports
     in a `"use server"` file) and correctly describes where the directive
     lives. Accurate against the evidence logs.

2. **`package.json` scripts** vs the runbook table — exact match:
   - `typecheck:server` = `node scripts/next-target.mjs gen server && tsc
     --noEmit --incremental false`; `typecheck:demo` same with `gen demo`;
     `typecheck` = both serially.
   - `test` = `gen demo && vitest run`; `test:watch` = `gen demo && vitest`.
   - `dev`, `dev:demo`, `build:server`, `build:demo`, `build` all route through
     `scripts/next-target.mjs`, which generates before Next starts.
   - `check` = `format:check && lint && prisma:validate && prisma:generate &&
     typecheck && npm test` — runbook order (format, lint, Prisma validation,
     **one** Prisma generation, both typechecks, one normal test run); no
     `pre*` hooks used anywhere.

3. **Ignores/tracking.** `.gitignore:30–32` ignores the three generated
   entries; `.prettierignore` and `eslint.config.mjs` (`globalIgnores`) both
   exclude the same three paths. `git check-ignore -v` matches all three via
   `.gitignore:30–32`; `git status --short` does not list them. The six variant
   barrels (`src/runtime/{actions,readers,client}.{server,demo}.ts`) appear as
   untracked (`??`) new files — tracked-intent, not ignored.

4. **Name cross-check of all six barrels against source exports** (grep
   `^export` on every source module):
   - Actions, server: `actions.server.ts` re-exports 17 names —
     `entrar/actions.ts` (1) + `portal/sign-out-action.ts` (1) +
     `portal/adult-portal-actions.ts` (10) + `portal/player-access-actions.ts`
     (4) + `jogar/actions.ts` (1). Set-equal to the generated `ACTION_NAMES`;
     every name verified present in the underlying module's exports.
   - Actions, demo: `demo-auth-actions` (2/2), `adult-portal-demo-actions`
     (10/10), `player-access-demo-actions` (4 of 5 — see Finding 1),
     `player-entry-demo-actions` (1/1).
   - Readers: server `adult-portal-server` 9/9, `player-access-server` 1/1,
     `game-events-server` 5/5; demo `adult-portal-demo` 9/9,
     `player-access-demo` 1/1, `game-events-demo` 5/5. Set-equal to
     `READER_NAMES` (15). No missing or extra reader names on either side.
   - Client: `adult-portal-server-client` and `adult-portal-demo-client` each
     export exactly the 3 re-exported names (`changeDemoProfile`,
     `loadClientPortalState`, `resetDemoPortal`).

5. **Rewire.** Zero `@runtime/` (and zero bare `@runtime`) hits across `src`,
   `tests`, `scripts`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`,
   `package.json` (grep exit 1). 23 consumer files import the generated entries
   via `@/runtime/actions` / `@/runtime/readers` / `@/runtime/client`.
   `next.config.ts` contains no alias keys; `tsconfig.json` `paths` is exactly
   `{"@/*": ["./src/*"]}` — the nine `@runtime/*` aliases are gone, `@/*`
   kept. No source file imports the variant barrels directly (grep: no hits),
   so the generated entries are the sole consumer path.

6. **`entrar/actions.ts` conversion.** `git diff` shows exactly two changes:
   `"use server";` added at module top and the function-level directive
   deleted; the function body is byte-identical (same FormData handling,
   runtime-mode check, bypass check, `getNeonAuthServer().signIn.email`,
   redirect targets). All five server action files
   (`entrar/actions.ts`, `portal/sign-out-action.ts`,
   `portal/adult-portal-actions.ts`, `portal/player-access-actions.ts`,
   `jogar/actions.ts`) carry a module-level `"use server"` as their first line
   (exactly one occurrence each).

7. **Generated entries right now** hold the demo target's content (last gen was
   demo, from the verifier's `typecheck:demo` and prior test runs) and match
   `RUNTIME_ENTRIES.demo` exactly: directive-free `actions.ts` from
   `./actions.demo`, `import "server-only"` + readers from `./readers.demo`,
   `"use client"` + client from `./client.demo`. Not tracked by git;
   `check-ignore` confirms all three.

8. **No forbidden test/graph infrastructure.** The only new test file under
   `tests/` is `tests/unit/clean-build-artifacts.test.ts`, which is P00 dossier
   item 5 (plus its P00 script). Grep of `tests/` for `runtime/actions`,
   `runtime/readers`, `runtime/client`, `next-target`: no hits. No
   generated-file unit tests, import-graph parser, or negative graph fixtures
   exist.

9. **Adjudicated deviation evidence (read, not relitigated).**
   `/tmp/p30-expClean.log`, `/tmp/p30-expH.log`, `/tmp/p30-expI.log` each show
   a clean `.next` server build failing with `Error: Only async functions are
   allowed to be exported in a "use server" file.` at `src/runtime/actions.ts:3:1`
   for the directive-headed re-export shape (39 Turbopack errors, all the same
   class) — the runbook shape is rejected outright by the installed transform.
   The implemented shape (directive on the five implementation files; barrel
   and generated entry as plain re-export chains) builds green per
   `/tmp/p30-acceptance2.log` (typecheck:server, typecheck:demo, and the demo
   static export route table). Wiring proven in the compiled client proxy:
   `.next/server/chunks/ssr/_1j6gvsh._.js` contains
   `a.s(["signInAction",0,b,"signOutAction",0,c],22264)`. The demo entry stays
   directive-free per the runbook. The deviation is implemented coherently:
   the directive lives exactly where the runbook's "Action implementations
   remain in their dedicated files with module-level `use server`" requires,
   consumers remain on the generated entry, and the comment in
   `scripts/next-target.mjs:82–87` documents it.

## Findings

1. **MINOR — unused extra re-export in the demo actions barrel**
   (`src/runtime/actions.demo.ts:18`). The barrel re-exports
   `DemoPlayerCredentialIssuer`, which is not in the generated `ACTION_NAMES`
   and is not consumed through the barrel (its only external consumer,
   `src/runtime/player-entry-demo-actions.ts:11`, imports it directly from
   `@/runtime/player-access-demo-actions`). This makes the demo barrel 18
   exports vs the server barrel's 17. Harmless — both generated entries expose
   identical 17-name surfaces, so no consumer drift is possible via the entry
   — but the name is dead weight on the barrel and a small asymmetry.
   Confirmed. Suggest dropping it in a follow-up cleanup.

2. **INFO — crash window can leave a stale `.tmp` sibling**
   (`scripts/next-target.mjs:104–106`). If the process dies between
   `writeFileSync` and `renameSync`, a `src/runtime/<name>.ts.tmp` file is left
   behind; `*.tmp` is not git- or Prettier-ignored (it would surface as an
   untracked file). Not compiled (tsconfig includes `*.ts` only) and
   self-healing on the next gen. No action required.

3. **INFO — adjudicated deviation confirmed sound** (not a regression). See
   Scope item 9. No other runbook item regressed: scripts, ignores, rewiring,
   barrels, and the directive conversion all match the dossier.

## Verdict

**P30 satisfied: YES**, including the adjudicated deviation (implemented
coherently and evidenced; the runbook's literal `"use server"` header on the
generated server `actions.ts` is unbuildable on the installed Turbopack
transform). All other runbook requirements verified: gen command semantics,
package-script chains, ignores/exclusions, exact barrel-to-source name parity
(one dead demo-barrel export noted as MINOR), zero `@runtime/` remnants, nine
aliases removed with `@/*` kept, module-level `"use server"` conversion of
`entrar/actions.ts` with unchanged semantics, and no forbidden test or
import-graph infrastructure.
