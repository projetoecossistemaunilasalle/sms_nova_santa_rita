# P30 Review — Generated Runtime Entries (Round 2, Static Spec-Compliance)

**Phase:** P30 — Generated Runtime Entries
**Date:** 2026-09-27
**Base commit:** `9467757` ("docs: finalize refactor implementation runbook")
**Tree reviewed:** staged working tree (`git diff --cached`), one combined P00→P50 change
**Authority:** `docs/refactor-dossier/IMPLEMENTATION-READY.md` §"Scope and Fixed Decisions" (lines 9–44) and §"P30" (lines 258–338)
**Method:** read-only static review — git read commands, `rg`/`ls`, Read tool, plus the installed Next.js guides/source under `node_modules/next/dist/docs/` and `node_modules/next/dist/...`. No builds, tests, generation, or file writes were performed; the three generated files were read but never touched.
**Toolchain observed:** Node `v22.23.1`, npm `11.6.0`, `next@16.3.2`, `typescript@6.0.3`, `eslint@9.39.5`, `prettier@3.9.6`, `vitest@4.1.11`, `prisma@7.9.1`. `package.json:5-9` pins `node 24.19.0` / `npm >=11.6.0 <12` — the inspected shell is off-pin (see INFO-1).

---

## 1. Per-item verification

### A. Target Shape

| # | Requirement | Evidence | Satisfied |
|---|---|---|---|
| A1 | Six tracked concrete variants exist | `git ls-files src/runtime` → `actions.demo.ts`, `actions.server.ts`, `client.demo.ts`, `client.server.ts`, `readers.demo.ts`, `readers.server.ts`; generated `actions.ts`/`readers.ts`/`client.ts` correctly **absent** from the tracked list | yes |
| A2 | Generator `ACTION_NAMES`/`READER_NAMES`/`CLIENT_NAMES` match what both variants export | `scripts/next-target.mjs:34-74` vs `src/runtime/actions.{server,demo}.ts`, `readers.{server,demo}.ts`, `client.{server,demo}.ts` — programmatic set-diff per pair: 17/17, 15/15, 3/3, all `IDENTICAL` | yes |
| A3 | Every generated name exists as a real export upstream | per-name `rg` across the 5 server action modules, 4 demo action modules, 3+3 reader modules, 2 client bridges → zero `MISSING` | yes |
| A4 | Variants re-export only (no smuggled logic) | `actions.server.ts:4-24`, `actions.demo.ts:4-23`, `readers.server.ts:3-21`, `readers.demo.ts:3-21`, `client.server.ts:3-7`, `client.demo.ts:3-7` — pure `export { … } from "…"` | yes |
| A5 | Action implementations carry **module-level** `"use server"` | `src/app/(professional)/entrar/actions.ts:1`, `.../portal/sign-out-action.ts:1`, `.../portal/adult-portal-actions.ts:1`, `.../portal/player-access-actions.ts:1`, `src/app/(public-play)/jogar/actions.ts:1` | yes |
| A6 | `entrar/actions.ts` converted function-level → module-level | `git diff --cached` — `+"use server";` at line 1, `-  "use server";` removed from inside `signInAction`; no other function in the file carries the directive | yes |
| A7 | **Server `actions.ts` starts with `"use server"`** (runbook:271-272) | `scripts/next-target.mjs:88` — server template is bare `reExports(ACTION_NAMES, "./actions.server")`; on-disk `src/runtime/actions.ts` line 1 is `export {`. Deliberate omission, comment at `scripts/next-target.mjs:82-87` | **no** — see MAJOR-1 |
| A8 | Demo `actions.ts` directive-free | `scripts/next-target.mjs:93` | yes |
| A9 | `readers.ts` imports `server-only` (both targets) | `scripts/next-target.mjs:89` and `:94` — `` `import "server-only";\n\n${reExports(...)}` `` | yes |
| A10 | `client.ts` starts with `"use client"` (both targets) | `scripts/next-target.mjs:90` and `:95` — `` `"use client";\n\n${reExports(...)}` `` | yes |
| A11 | No duplicated Prisma client / composition root | single `new PrismaClient` at `src/server/db/client.ts:14`; four containers under `src/server/services/` | yes |
| A12 | No ordinary-closure wrapping of actions | `rg` for `=> <actionName>` across `src` → 0 hits; `team-screen.tsx:78-81` `membershipAction` is a reference selection, byte-identical to base `9467757:src/components/portal/team-screen.tsx:78-81` | yes |
| A13 | Readers not passed through React props | `turmas/[id]/page.tsx:25-40` calls readers in the Server Component and passes DTOs (`initialClass`, `initialWorkflow`); same shape in the other 9 reader consumers | yes |

### B. Generation and Scripts

| # | Requirement | Evidence | Satisfied |
|---|---|---|---|
| B1 | `gen demo\|server` subcommand exists | `scripts/next-target.mjs:14` (`["dev","build","gen"]`), `:20-23` (target enum), `:24-27` (extra-arg rejection), `:112-114` (`process.exit(0)`) | yes |
| B2 | Validates arguments, writes three deterministic entries, exits **before** Next | write at `:110` runs after validation and before `loadEnvConfig` (`:116`) / `spawnSync` (`:155`); `gen` returns at `:112-114` | yes |
| B3 | Generates before every `dev`/`build` | `writeRuntimeEntries(target)` at `:110` executes unconditionally for all three commands; `package.json:11-15` routes `dev`, `dev:demo`, `build`, `build:server`, `build:demo` through the script | yes |
| B4 | Atomic replacement | `scripts/next-target.mjs:104-106` — `writeFileSync(tmp)` + `renameSync` | yes |
| B5 | Three generated files git-ignored | `git check-ignore -v` → `.gitignore:30,31,32` | yes |
| B6 | Excluded from Prettier and ESLint | `.prettierignore:10-12`; `eslint.config.mjs:16-18` (`globalIgnines`) | yes |
| B7 | Concrete variants tracked | `git status --short` shows `A src/runtime/actions.{server,demo}.ts` etc. | yes |
| B8 | `typecheck:server` = `gen server && tsc --noEmit --incremental false` | `package.json:21` — exact | yes |
| B9 | `typecheck:demo` = `gen demo && same` | `package.json:22` — exact | yes |
| B10 | `typecheck` runs both serially | `package.json:23` — `npm run typecheck:server && npm run typecheck:demo` | yes |
| B11 | `test` / `test:watch` generate demo then run Vitest | `package.json:24,26`; `vitest.config.mts:10-15` keeps the existing demo env (`environment: node`, `APP_RUNTIME_MODE: "demo"`) | yes |
| B12 | `dev`/`dev:demo`/`build`/`build:server`/`build:demo` preserve meanings, generate first | `package.json:11-15` — all five lines unchanged in the diff (only context); `build` still aliases `build:server` | yes |
| B13 | `check` = format check, lint, prisma validate, ONE prisma generate, both typechecks, one test run — generate after validate, before typecheck | `package.json:27` — `format:check && lint && prisma:validate && prisma:generate && typecheck && test`; `typecheck` expands to both; single `prisma:generate` | yes |
| B14 | No `pre*` hook reliance | full script list `package.json:10-30` contains no `prebuild`/`pretypecheck`/etc.; only `postinstall` (pre-existing) | yes |
| B15 | No runtime-contract test framework / import-graph parser / negative graph fixtures / generated-file unit tests | `rg 'runtime/actions\|runtime/readers\|runtime/client' tests scripts` → 0 hits (excluding the generator itself); `tests/` has 29 files, none reads `src/`; the only `readFileSync` uses are `contracts/fixtures/v1/...` JSON fixtures (`v1-contracts.test.ts:31-34`, `game-offline-sync.test.ts:40`, `game-state-service.test.ts:24`) | yes |

### C. Rewire

| # | Requirement | Evidence | Satisfied |
|---|---|---|---|
| C1 | No `@runtime/` import or config key remains | `rg '@runtime/'` over repo excluding `docs/`/`node_modules`: only `REFACTOR_PLAN.md:16,132,225,251` (historical prose, explicitly non-normative per runbook:3-7). 0 hits in `src/`, `tests/`, `next.config.ts`, `tsconfig.json`, `vitest.config.mts` | yes |
| C2 | Nine aliases removed from `next.config.ts` **and** `tsconfig.json`; `@/*` kept | `git diff --cached next.config.ts tsconfig.json` — entire `turbopack.resolveAlias` block deleted; `paths` reduced to `"@/*": ["./src/*"]` | yes |
| C3 | Consumers repointed by responsibility | 11 action consumers, 10 reader consumers, 2 client consumers; per-file `git diff --cached -U0` shows import-line-only changes on all 19 (sole exception: `classes-screen.tsx` carries a P10 copy-text purge at `:90`, unrelated to P30) | yes |
| C4 | No consumer imports a concrete variant | `rg 'runtime/(actions\|readers\|client)\.(server\|demo)' src tests` → 0 hits. Only the generated entries reference the variants (`scripts/next-target.mjs:88-96`) | yes |
| C5 | Sign-in and sign-out remain Server Component forms | `entrar/page.tsx` (no `"use client"`), `<form action={signInAction}>` at `:73`; `portal-shell.tsx` (no `"use client"`), `<form action={signOutAction}>` at `:68`. Per `use-server.md:46-48`, a file-level Server Action imported into a component and used as `form action` is the documented pattern | yes |
| C6 | Client components may import file-level Server Actions through the generated entry | `use-server.md:46-97` documents importing `use server` functions into `"use client"` components; 9 action consumers are `"use client"` (line 1 verified) and import `@/runtime/actions` | yes |
| C7 | Server readers still delegate to surviving containers | `readers.server.ts:13,14,21` → `adult-portal-server.ts:1,8` (`server-only`, `getAdultPortalService`), `player-access-server.ts:1,7`, `game-events-server.ts:1,10` (`getGameEventReportService`) | yes |
| C8 | Four API route handlers remain composition consumers | `src/app/api/v1/player/{state,results,bootstrap,active-time}/route.ts` → `game-state-container` / `game-event-container`; action impls import containers (`adult-portal-actions.ts:19`, `player-access-actions.ts:14`, `jogar/actions.ts:14`, `entrar/actions.ts:6-7`, `sign-out-action.ts:6`) | yes |
| C9 | No artificial import-count gate added | no test counts imports (see B15) | yes |

### D. Fixed Decisions

| # | Requirement | Evidence | Satisfied |
|---|---|---|---|
| D1 | actions / readers / client remain three **distinct** entry points | `RUNTIME_ENTRIES` (`scripts/next-target.mjs:80-97`) emits exactly three files per target, each with its own boundary (`"use server"`/`server-only`/`"use client"` semantics kept separate) | yes |
| D2 | No compatibility barrels for the old `@runtime/*` aliases | the six tracked files are the runbook's named target-shape variants; no shim module reproduces an old alias name; no re-export of the old nine specifiers | yes |

### E. Scope

| # | Requirement | Evidence | Satisfied |
|---|---|---|---|
| E1 | P30-relevant changes limited to rewiring / generator / scripts / variants | all consumer diffs import-line-only (C3); variants pure re-exports (A4); `entrar/actions.ts` diff is 2 added + 2 removed lines | yes |

---

## 2. The nine `@runtime/*` aliases

Base sources: `git show 9467757:next.config.ts` (turbopack.resolveAlias) and `git show 9467757:tsconfig.json` (compilerOptions.paths). Base consumers: `git grep -n '@runtime/' 9467757 -- src tests` (22 sites).

| # | Old alias (base) | Base → target module | Removed from `next.config.ts` | Removed from `tsconfig.json` | Replaced by generated entry | Base consumer count |
|---|---|---|---|---|---|---|
| 1 | `@runtime/sign-in-action` | → `entrar/actions.ts` | yes (`next.config.ts:42-46`) | yes (`tsconfig.json:24-25`) | `@/runtime/actions` | 1 (`entrar/page.tsx:8`) |
| 2 | `@runtime/sign-out-action` | → `portal/sign-out-action.ts` | yes (`:47-51`) | yes (`:26-28`) | `@/runtime/actions` | 1 (`portal-shell.tsx:7`) |
| 3 | `@runtime/adult-portal` | → `adult-portal-{server,demo}.ts` (readers) | yes (`:52-56`) | yes (`:29`) | `@/runtime/readers` | 7 |
| 4 | `@runtime/adult-portal-actions` | → `portal/adult-portal-actions.ts` / `adult-portal-demo-actions.ts` | yes (`:57-61`) | yes (`:30-32`) | `@/runtime/actions` | 5 |
| 5 | `@runtime/adult-portal-client` | → `adult-portal-{server,demo}-client.ts` | yes (`:62-66`) | yes (`:33-35`) | `@/runtime/client` | 2 (`demo-role-controls.tsx:8`, `use-demo-portal.ts:6`) |
| 6 | `@runtime/player-access-actions` | → `portal/player-access-actions.ts` / `player-access-demo-actions.ts` | yes (`:67-71`) | yes (`:36-38`) | `@/runtime/actions` | 1 |
| 7 | `@runtime/player-entry-action` | → `jogar/actions.ts` / `player-entry-demo-actions.ts` | yes (`:72-76`) | yes (`:39-41`) | `@/runtime/actions` | 2 (`game-host.tsx:24`, `player-entry-screen.tsx:8`) |
| 8 | `@runtime/player-access` | → `player-access-{server,demo}.ts` (readers) | yes (`:77-81`) | yes (`:42`) | `@/runtime/readers` | 1 (`turmas/[id]/page.tsx:7`) |
| 9 | `@runtime/game-events` | → `game-events-{server,demo}.ts` (readers) | yes (`:82-86`) | yes (`:43`) | `@/runtime/readers` | 3 |

`@/*` mapping: retained in `tsconfig.json:22-24` (`"@/*": ["./src/*"]`) and in `vitest.config.mts:8-10`. No first-party file imports a concrete variant (C4), so the boundary is not defeated.

---

## 3. Findings

### MAJOR-1 — Server `actions.ts` is generated without the mandated `"use server"` header, on a justification the installed Next.js package does not support

- **Requirement:** `docs/refactor-dossier/IMPLEMENTATION-READY.md:270-272` — *"The generated files contain a directive header where required… Server `actions.ts` starts with `"use server"`."*
- **Implementation:** `scripts/next-target.mjs:82-90` deliberately omits the header and comments:
  > `// No "use server" header here: the installed Turbopack transform rejects`
  > `// any non-async-function export in a "use server" file, so re-exports are`
  > `// impossible in one.`
  The same rationale is asserted as fact in `docs/current-architecture.md:262-266` (*"because the installed Turbopack transform rejects re-exports in a `"use server"` file"*).
- **Why the stated cause is not corroborated by the installed package (next@16.3.2):**
  - The only shipped runtime check is `node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js:14-25`:
    ```js
    if (typeof action !== 'function') { throw new Error(`A "use server" file can only export async functions, found ${typeof action}. …`); }
    ```
    A re-exported `async function` binding is `typeof === "function"`, so it passes.
  - The only other gate is the `next` TypeScript plugin rule, `node_modules/next/dist/server/typescript/rules/server-boundary.js:48-72` (`getSemanticDiagnosticsForExportDeclaration`), which errors only when `!isFunctionReturningPromise(e, …)` — i.e. a named export that is not a Promise-returning function. All 17 re-exported names are `export async function` declarations, so they satisfy it. The plugin is active: `tsconfig.json:17-20` registers `{"name": "next"}`.
  - `rg -a "can only export async functions" node_modules/next/` matches only those two modules (plus sourcemaps). `node_modules/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node` contains no such string.
  - `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-server.md` and `01-app/02-guides/server-actions.md` contain no statement forbidding re-exports in a `"use server"` file.
- **Impact:** the runbook's Target Shape is a written, explicit requirement and the runbook declares itself authoritative over project docs (`IMPLEMENTATION-READY.md:3-7`). As implemented, the generated server entry is an ordinary module, so the "explicit Next.js boundary" that Fixed Decision 3 (`IMPLEMENTATION-READY.md:18-20`) is meant to buy is provided solely by the five implementation modules, not by the entry. The divergence is documented in-repo rather than raised with the runbook owner.
- **Note on blast radius:** no static evidence of a runtime defect. The underlying modules still carry the directive, so client-component imports still resolve to server references, and the boundary is not bypassed. Whether adding the header breaks the build is an empirical question the companion dynamic agent's `build:server` / `npm test` legs will settle; but the justification given for omitting it is, on the installed artifacts, unsupported.
- **Recommended resolution:** either (a) add the `"use server"` header to the server `actions.ts` template and let the typechecks/builds confirm, or (b) if a real Turbopack error forces the omission, record the exact error text and file:line so the deviation can be evaluated against the runbook, and flag the Target Shape line for a runbook amendment.

### MINOR-1 — Duplicate import statements left by the mechanical repoint

`src/app/(professional)/portal/turmas/[id]/page.tsx:6-7`:
```ts
import { getClassPageData, listStaticClassIds } from "@/runtime/readers";
import { getPlayerAccessPageData } from "@/runtime/readers";
```
The two old aliases (`@runtime/adult-portal`, `@runtime/player-access`) collapsed onto one module, leaving a redundant statement. It is the only such file (checked all 23 first-party consumers). Neither Prettier (no `organize-imports` plugin configured) nor the ESLint config flags it, so `format:check`/`lint` stay green — cosmetic only, no behavior impact.

### MINOR-2 — Temp files written beside the generated entries are not ignored

`scripts/next-target.mjs:104-106` writes `${filePath}.tmp` inside `src/runtime/`. Neither `.gitignore:29-32`, `.prettierignore:10-12`, nor `eslint.config.mjs:16-18` covers `*.tmp`. A process kill between `writeFileSync` and `renameSync` leaves an untracked `src/runtime/actions.ts.tmp` that shows up in `git status`. Prettier/ESLint skip unknown extensions so the gates stay green, but it is workspace noise the runbook's "one target command at a time" rule does not prevent.

### INFO-1 — Gates appear to be running off the pinned Node

`package.json:5-8` pins `node 24.19.0` and `npm >=11.6.0 <12`; `IMPLEMENTATION-READY.md:39-40` states acceptance must run on the pinned versions. The inspected shell reports Node `v22.23.1` (npm `11.6.0`). Unless the dynamic agent switched toolchains, its gate evidence is off-pin and does not satisfy that acceptance clause.

### INFO-2 — Out-of-phase edit inside a P30-relevant file

`.prettierignore:9` adds `REFACTOR_PLAN.md`, unrelated to P30. Benign and plausibly required for `format:check` to pass, but it is scope outside P30 living in a P30-owned config file.

### INFO-3 — Untracked tool artifact

`?? .zcodeignore` is untracked, is not git-ignored, and contains the ZCode auto-sync marker `===== ↑ 以上同步自 .gitignore …`. It mirrors `.gitignore` (including the three runtime entries). Not an implementation artifact; consider ignoring it so it does not pollute `git status`.

### INFO-4 — Generated files on disk are the demo variant and match the templates byte-for-byte

`src/runtime/actions.ts`, `readers.ts`, `client.ts` currently hold the demo variant and correspond exactly to `scripts/next-target.mjs:93-95`, confirming determinism. Treated as workspace state, not evidence of compliance.

---

## 4. Acceptance criteria: not statically verifiable

These require execution and are covered by the companion dynamic agent's serial cold-start gate sequence (nothing that writes was run here):

1. With all three generated entries deleted, `typecheck:server`, `typecheck:demo`, `npm test`, `build:server`, `build:demo` each self-prepare and pass **serially** (`IMPLEMENTATION-READY.md:330-332`). Statically I can only confirm each command routes through a `gen` call (`package.json:11-15,21-26`; `scripts/next-target.mjs:110`).
2. **Demo static export succeeds** — the authoritative check that no Server Action is reachable in that target (`IMPLEMENTATION-READY.md:333-335`). This is also the empirical test of MAJOR-1 in the demo direction and, for the server direction, of `build:server`.
3. `npm run check` end to end (`package.json:27`).
4. **CI execution on pinned Node 24.19.0** — `IMPLEMENTATION-READY.md:444-447` additionally requires a real CI run URL and branch-protection confirmation, which local evidence cannot supply (see INFO-1).

Statically satisfied: no `@runtime/` import or config key remains (C1); no custom import-graph parser, negative graph-fixture suite, or generated-file unit test introduced (B15); no manifest-ID or action-count snapshots (no test reads `.next/` or `src/runtime/`).

---

## 5. Verification commands run (all read-only)

```
git log --oneline -3 ; git status --short
git diff --cached -- scripts/next-target.mjs package.json next.config.ts tsconfig.json .gitignore .prettierignore eslint.config.mjs
git grep -n "@runtime/" 9467757 -- src tests           # 22 base sites, 9 aliases
rg -n "@runtime/" --glob '!node_modules/**' --glob '!docs/**' .   # only REFACTOR_PLAN.md prose
rg -n '"use server"|\x27use server\x27' -g '*.ts' -g '*.tsx' -g '*.mjs' .
rg -l 'runtime/(actions|readers|client)' src tests
rg -n 'runtime/(actions|readers|client)\.(server|demo)' src tests    # 0 hits
git ls-files src/runtime ; git check-ignore -v src/runtime/{actions,readers,client}.ts
git diff --cached -U0 -- <each of 23 consumer files>                 # import-only check
set-diff of ACTION_NAMES/READER_NAMES/CLIENT_NAMES vs each variant's export set   # 6× IDENTICAL
per-name export existence check across all upstream modules           # 0 MISSING
rg -n "new PrismaClient" src                                          # exactly 1
rg -n 'runtime/actions|resolveAlias|readdir|glob' tests scripts       # 0 hits
node -v ; npm -v ; node -p "require('./node_modules/next/package.json').version"
Read: node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-server.md
Read: node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js
Read: node_modules/next/dist/server/typescript/rules/server-boundary.js
rg -a "can only export async functions" node_modules/next/ node_modules/@next/swc-win32-x64-msvc/
```

**No files were modified. No build, test, generation, or formatting command was executed.**

---

**VERDICT: PASS-WITH-FINDINGS**
