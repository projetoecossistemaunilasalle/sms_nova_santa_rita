# Phase 30 — the composition seam

**Goal.** Replace the 9 build-time `@runtime/*` module-resolution aliases with an on-disk, contract-annotated seam
so that (i) the demo *and* server wirings are both typechecked, (ii) the seam is importable **as the seam** by a
test — 6 test files already reach into `src/runtime/`, all 9 of those imports name concrete *demo* files and none
uses the `@runtime/*` alias (step 11) — and (iii) the actions/readers boundary is explicit in the tree. This phase
does **not** exist to unblock a build failure — see *Accepted breakage*.

**Depends on.** Phase 0 (`format:check` green, `ci.yml` + branch protection, D-7); Phase 1 (Generation A purge —
deletes `src/server/services/service-container.ts` and `src/server/security/tokens.ts`); Phase 1b (schema purge +
migration `6_drop_generation_a`; the history stays sequential, per `COMPAT-POLICY.md` §6's **rejection** of
edit 1). **File-disjoint from Phase 1: true. "Parallelizable with it" (§10.2): false** — Entry-gate item 1
demands `ls …/service-container.ts …/tokens.ts` → both `No such file`, which *is* Phase 1's exit state, and
`phases/10-purge-generation-a.md` says the same in the other direction (its opening constraints and handoff note:
"`readers.server.ts`'s delegation target must not name them"). What the disjointness genuinely buys, measured:
**0** of the 23 `@runtime/*` importer files sits in plan §2.2's seven purge trees
(`grep -rl '@runtime/' src | grep -Ec 'atividades|materiais|modulos|admin/jogos|admin/auditoria|public-play\)/atividade'`
→ `0`), and the one `src/runtime` file Phase 1 edits (`mode.ts:13-17`, deleting `isDemoRuntime`) is on this phase's
*do not touch* list. The two PRs share no file and can be **developed** in parallel branches, but the seam PR must
not **merge** first, or step 3 writes `readers.server.ts` against a delegation target that is already doomed.
Disjoint files ≠ independent phases. The one hard edge is **seam item 4 → any CSS extraction** (D-3).

*Sibling phase files are cited by section here, never by line number* — `phases/00`, `phases/10`, `phases/40` and
`phases/50` are under concurrent revision by other owners, so a line reference goes stale within hours of editing.

**Blocks.** Phase 3 CSS ownership map (item 4 relocates 12 marketing classes + `styles.logoutButton`); Phase 4
gates/CI (this file's assertions *are* Phase 4's jobs). **Canonical statement of the governing ruling — every
other mention in this file points here.** `COMPAT-POLICY.md` §6 governs this phase: edit 1 **rejected** (so the
migration history stays sequential, *Depends on*), edits 4, 8 and 10 **adopted**, and edits 6 and 10 together
retire **R-03 / R-06** from the §11 register (`REFACTOR-DOSSIER.md:574,577` still carries them; edit 10's header
line is what retires them) and move them to dossier §9.3 as *documented demo properties*. The obligations survive;
only the register handles do not. R-02 is disposed of the same way (Handoff, Phase 3), and edit 8 kills the
"keep a thin re-export" option in step 2. Register rows that stay live here: **R-05 / R-17**, re-verify at exit.

**Entry gate.**

- [ ] `git log --oneline -1` → `e5aaf1e …` or the purge commit on top of it; purge landed:
      `ls src/server/services/service-container.ts src/server/security/tokens.ts` → both `No such file`
      (otherwise the delegation target in step 3 is wrong).
- [ ] `npm run format:check` → exit 0 (D-7; if red, every gate below is noise). `npx tsc --noEmit` → 0;
      `npm run test` → pass (33 files in `tests/unit` today); `npx prisma validate` → valid.
- [ ] **Server baseline:** `npm run build:server`, then
      `node -e "const m=require('./.next/server/server-reference-manifest.json'),a=[...Object.keys(m.node),...Object.keys(m.edge)],f=i=>parseInt(i.slice(0,2),16)>>7===0;console.log('ids',a.length,'server-action',a.filter(f).length)"`
      → `ids 17 server-action 17`. Re-measure after the purge; **do not assume 17 drops** — none of the 17
      registered ids comes from a purged file (see *Evidence* for the `filename` distribution). **This is the E625
      predicate**: `f` is a faithful inverse of Next's own `actionIds.some(… === 'server-action')` test, and the
      error can only ever be raised on the demo target — the full `file:line` chain is stated once, in *Evidence*.
- [ ] **Demo baseline:** `npm run build:demo`, then the same one-liner → `ids 0`;
      `test "$(grep -c '<form' out/entrar/index.html)" -eq 0` → **exit 0**;
      `grep -rl '\$ACTION_ID' out | wc -l` → `0`.
      **Gate contract, stated once here; every zero-valued gate below points back to it:** the bare
      `grep -c '<form' out/entrar/index.html` prints the asserted `0` and **exits 1** — measured on this tree,
      output `0` / `exit=1` — so as written it was red on a good tree and green on a bad one under `set -e`.
      Wrap every zero-valued `grep -c` as `test … -eq 0` or `! grep -q …`; piping to `wc -l` is what makes the
      `$ACTION_ID` half exit-safe (`wc` always exits 0), and a *non-zero* expected count (`grep -c 'Entrar na
      demonstra'` → `1`) needs no wrap at all. **Without these recorded, stop.** Note also that on this tree
      `out/` (mtime 2026-09-23 **02:04**) is *older* than `.next/server/server-reference-manifest.json`
      (**02:05**): the demo-side and server-side numbers above were produced by **different** builds, which is
      exactly why the gate names both builds in order.

## Scope

**In scope.** `src/runtime/contracts.ts`; **two** generated seams split by kind — `target.ts` →
`target.server.ts` / `target.demo.ts` (actions + client bridges) and `readers.ts` → `readers.server.ts` /
`readers.demo.ts` (build-time readers); emitting them from `scripts/next-target.mjs`; `TARGET_MODE`
self-assertion; `.gitignore` **and** `.prettierignore` **and** `eslint.config.mjs`'s `globalIgnores` entries
(step 6 — two of the three tools do not read the third's ignore file); re-pointing the 24 `@runtime/*`
statements in the 23 surviving files **and deleting the 9 alias declarations themselves** (plan §3.1 item 5; steps
7 and 12); plan §3.1 item 4
(`sign-in-form.tsx`, `sign-out-button.tsx`); the ESLint `no-restricted-imports` fence; the vitest alias block
**(D-1 = (b) only — under (a) it is a no-op, step 11)**. Additions to `package.json` are limited to *new* keys
(`typecheck:demo`, the `pre*` hooks of step 5) — `package.json:17,20,21,24` keep their exact text, per the **T1**
rule in `phases/00-prerequisites.md`.

**Out of scope — reason and who decides.**

- *Reducing `runtimeMode` branching.* The seam removes **zero** of it: **95 → 95 lines, +0** — step 5's
  `if (TARGET_MODE !== getRuntimeMode()) throw …` assertions hold no lowercase `runtimeMode`, so the case-sensitive
  grep counts them as **0**; count those two lines separately, as **seam assertions**, never added to the 95.
  Counting rule, publishable verbatim: **95 lines mention `runtimeMode` across 23 files**; a raw
  `grep -ro runtimeMode src` yields **107 occurrences**; only **34** of the 95 lines hold an actual comparison
  (`getRuntimeMode` is excluded by case-sensitivity at 28 capital-R occurrences, which is why `-o` and the anchored
  form agree at 107). Never call all 95 "branches", and never compare the three figures. ~30 are genuine defects (a
  component branching on deployment target where a prop belongs), fixable in ~1 hour **without** the seam — the
  better first target if the goal is fewer checks. Owner: whoever books Phase 3.
- *Keeping server code out of the demo bundle.* Not a claim this phase may make: shipped `out/` already has 0 action
  ids and no **`@prisma` / `pino` / `@neondatabase` module** strings (`grep -rl` over `out/_next/static` → **0
  files** each), so gate on the import paths, never on the brand: bare `Neon` occurs **2×** inside legitimate
  Portuguese demo UI copy in `out/_next/static/chunks/44cyjybhd4vf0.js`, and a **case-insensitive** `pino` grep
  matches `piNo` inside `apiNode` in `1_mbjwzz6mvwz.js` — a "no Prisma/pino/Neon strings" gate is red on a clean
  tree. Module-graph reachability is not browser-chunk inclusion either, and its count was wrong:
  `grep -rl 'import "server-only"' src` → **20** files (runtime 3, `server/auth` 2, `server/db` 7, `server/http` 3,
  `server/services` 5), **17** after Phase 1 deletes `prisma-access-link-store`, `prisma-capability-reader` and
  `public-link-service`.
- *Editing `REFACTOR_PLAN.md` §3* — forbidden input; corrections live here. *Two route trees, dropping static
  export, all-mutations-become-`POST`* — rejected in `INV-B` ("Alternatives considered") and `NOTE-00` §§2-5.
  *Re-routing `src/proxy.ts` and `/api/v1/player/*`* — step 9 and D-1b.

## Work order

**0. Freeze the Entry-gate baselines** (server id count, demo id count, the `out/` markers) in a scratch note.
**If it fails:** the demo build already registers ids — §7.1's premise is false on your tree, the seam *is* a
build-unblocker, and Scope must be re-derived before continuing.

**1. Day-2 spike (≤20 min) — precedes every alias deletion.** Question: does a server reference survive a
*function-level* `"use server"` re-export hop? Never exercised here:
`grep -rn 'export \*\|export {' src/runtime` → **0 hits across its 16 files** (the grep exits 1), and client
components reach action modules directly through the alias today. `signInAction`
(`src/app/(professional)/entrar/actions.ts:15-16`) is the only seam member declared function-level — directive
inside the body, file itself unlabelled — which is why it registers as `$$RSC_SERVER_ACTION_0`, and it appears in
**0** client chunks (`grep -rl 'signInAction' .next/static`).

```ts
// src/runtime/__spike.ts — PROPOSAL, throwaway, never merged
export { signInAction } from "@/app/(professional)/entrar/actions";
```

Import it from a throwaway `"use client"` component and run `npm run build:server` (the four env vars asserted at
`next.config.ts:12-19` must be syntactically valid). **Verify:** a registered id whose `filename` is
`src/app/(professional)/entrar/actions.ts` and whose `exportedName` is `$$RSC_SERVER_ACTION_0`, plus a client
chunk emitting the 42-hex id rather than an inlined body. **Decision rule:** registered *and* reference-in-chunk →
proceed. Not registered, or registered but inlined → **stop**, do **not** delete the aliases; land only
`contracts.ts` + `tsconfig.demo.json` + `typecheck:demo` + the vitest alias (the D-1 = (b) mechanism, which needs
no hop) and record the refutation here. **The trap:** the spike writes into the **shared** `.next` — both *build*
targets use it; only `dev:demo` diverges (`next.config.ts:26-28` sets `distDir: ".next-demo-dev"` under
`PHASE_DEVELOPMENT_SERVER` only). So delete the spike and re-run `npm run build:server` (and `build:demo` before
any demo-shape typecheck) **before any later `npx tsc --noEmit`**, or `.next/types/**` route validators from the
wrong target produce **63** false errors (§10.1). The `~60` inherited from `ADJ-03` F2 is stale and this file
repeated it; re-measured exact: `find .next .next-demo-dev -name validator.ts` → **3** copies — `.next/types/`,
`.next/dev/types` **and** `.next-demo-dev/dev/types/`, the third of which every earlier sweep missed — each 448
lines with **44** `typeof import` refs (`grep -c` confirms 44/44/44 = **132**), of which **21** name plan §2.2's
seven deleted trees and all 21 are distinct
(`grep -o "typeof import(\"[^\"]*\")" .next/types/validator.ts | sed 's/.*(\"\(.*\)\")/\1/' | grep -Ec
'portal/atividades/|portal/materiais/|portal/modulos/|admin/jogos/|admin/modulos/|admin/auditoria/|public-play\)/atividade/'`
→ `21`) ⇒ 3 × 21 = **63**. The 21st is `(public-play)/atividade/[token]/layout.js`, which a page-only sweep
misses too. **If it fails:** `rm -rf .next` and rebuild the target being typechecked.

**2. `src/runtime/contracts.ts`** — one interface per capability group, **explicit named exports, never
`export *`** (a barrel hides removed/renamed exports, the only detectable drift axis; edit 8 — adopted, *Blocks* —
kills the "keep a thin re-export" option, and dossier §7.3 `:366` is the reason a rename is safe):
`PortalActions`, `PlayerAccessActions`, `PortalReaders`, `PlayerAccessReaders`, `GameEventReaders`,
`ClientBridges`. **Verify:** `npx tsc --noEmit` → 0 errors. **If it fails:** a signature was guessed; copy it from
the real call site.

**3. `src/runtime/target.server.ts` + `readers.server.ts` — DELEGATE, do not re-wire.** The real composition roots
are the four surviving containers
`src/server/services/{adult-portal,player-access,game-state,game-event}-container.ts` (18 + 22 + 12 + 47 =
**99 lines**, none named by the plan, which names only `service-container.ts` — 45 lines, the one Phase 1 deletes,
correctly excluded from that sum). Each begins `import "server-only";` at `:1`, builds the Prisma store, returns
`new XxxService(store)`, and is already called by
`src/runtime/{adult-portal,player-access,game-events}-server.ts:6-7`. Building adapters inside the seam creates a
**second** composition root.
<!-- COMPAT: existing unit tests mock the containers, not the seam — e.g. tests/unit/player-access-actions.test.ts:17 vi.mock("@/server/services/player-access-container") -->
**Verify:** `grep -n "new PrismaClient\|getPrisma()" src/runtime/target.server.ts src/runtime/readers.server.ts`
→ no hits. **If it fails:** move the wiring back into the container and re-export it.

**4. `src/runtime/target.demo.ts` + `readers.demo.ts`.** The demo targets already exist under `src/runtime/`: four
`"use client"` at line 1 (`adult-portal-demo-actions`, `adult-portal-demo-client`, `player-access-demo-actions`,
`player-entry-demo-actions`) and four with **no directive at all** (`adult-portal-demo`, `player-access-demo`,
`game-events-demo`, `demo-auth-actions`) — 8 distinct files for 9 aliases, because `@runtime/sign-in-action` and
`@runtime/sign-out-action` share `demo-auth-actions.ts` (`next.config.ts:44-51`). **None carries `"use server"`**
(`grep -c 'use server'` → 0 for each of the 8; `grep -rn 'use server' src` → 7 hits, **all** under `src/app`) — the
load-bearing premise of the whole phase. `target.ts` must **never** re-export `readers.*`. **Verify:** after
`npm run build:demo`, the manifest one-liner → `ids 0`. **If it fails:** a `"use server"` file leaked into the
demo graph — `grep -rln '"use server"' src/runtime src/app`.

**5. Generation + `TARGET_MODE`.** Extend the **existing** `scripts/next-target.mjs` (~70 lines, tracked; it
already validates `<dev|build> <demo|server>` at `:13-22`, `loadEnvConfig` at `:24`, sets
`APP_RUNTIME_MODE`/`NEXT_PUBLIC_APP_RUNTIME_MODE` at `:28-29`, pins `AUTH_DEV_BYPASS=false` for `build server` at
`:39`, blanks 7 server-only env vars for demo at `:41-53`, then `spawnSync`s `next` at `:63`) so it writes
`src/runtime/target.ts` and `src/runtime/readers.ts` before spawning. This is an **edit to live tooling with two
roles in one file**, not a new file: accept a third `command` value `gen` at the whitelist `:13-18`; insert one
emitter between the demo env-blanking block (`:41-53`) and `spawnSync` (`:63`) that writes both pointers from the
already-parsed `target`. Change nothing else — `:39` and `:41-53` stay byte-for-byte (*Do not touch*), because
the `AUTH_DEV_BYPASS` pin and the demo blanking are what make a server build possible at all. The emitter is the
script's **only** side effect today: `:1-4` import `node:child_process`, `node:url`, `node:path` and `@next/env`
and there is **no `node:fs`**, which is how "writes nothing" is proven.

**Do not wire this to a lifecycle hook and walk away — the hook does not fire.** This file said "wire regeneration
into `predev`/`prebuild`", and that sentence is refuted three ways. (i) `package.json:10-27` has **no `prebuild`
and no `predev` script**. (ii) Adding one would not help: npm builds the hook name from the **literal** event —
`run-script.js:118-126` of the installed npm
(`C:/Program Files/nodejs/node_modules/npm/lib/commands/run-script.js`), where `:121-122` reads
``if (scripts[`pre${event}`]) { events.unshift([`pre${event}`, []]) }`` and `:125` does the same for `post` — so on
npm 11.6.0 (`package.json:9` `packageManager`; engines `:7` `>=11.6.0 <12`) `prebuild` fires only for the bare
`build` script (`:13`, which merely re-invokes `build:server`) and **never** for `npm run build:demo` (`:14`),
`build:server` (`:15`) or `dev:demo` (`:12`) — the commands every Entry and Exit gate here invokes. Those would
need `prebuild:demo`, `prebuild:server`, `predev:demo`. (iii) `typecheck` is bare `tsc --noEmit`
(`package.json:20`) and routes through **no launcher at all**, so `npx tsc --noEmit` — used in steps 1, 2, 5, 12
and 13 — has no generation path even after (i) and (ii) are fixed. **So generation is an explicit, named action,
never an inferred lifecycle:** invoke `node scripts/next-target.mjs gen demo` / `gen server` as the first command
of every gate that reads `src/runtime/target.ts` and before every `tsc`; book `prebuild:demo` / `prebuild:server` /
`predev:demo` as belt-and-braces *on top of* that, and record in the `ci.yml` handoff that a hook-only design
regenerates nothing where it matters. (Settled by reading the installed source, not by execution: the
`` `pre${event}` `` template on the literal name is unambiguous.)

The seam entry the whole plan rests on does not exist yet and is referenced nowhere:
`ls src/runtime/target.ts src/runtime/readers.ts` → both **`No such file`**; `git ls-files src/runtime` → 16 files,
neither name among them (untracked, **not** gitignored);
`grep -rn "runtime/target" src scripts package.json tsconfig.json next.config.ts vitest.config.mts eslint.config.mjs .gitignore`
→ **0 hits, exit 1**. **`.gitignore` is the entry `REFACTOR_PLAN.md:126` promises and nobody has added**: plan §3.1
item 1 says "generates a **gitignored** `src/runtime/target.ts`", but
`git check-ignore -v src/runtime/target.ts src/runtime/readers.ts` → **exit 1** and `.gitignore` has no
`src/runtime` line of any kind. Step 6 books the two lines; until they land, the first `git add -A` commits the
generated file, which step 6 names the worse failure mode.

Each generated file exports `const TARGET_MODE = "demo" | "server"` and asserts
`if (TARGET_MODE !== getRuntimeMode()) throw …` at module init **and** at prerender — a stale *demo* pointer
during `build:server` is caught by **nothing** today, the most dangerous silent case in the phase. Those two
assertions add **0** lines to the `runtimeMode` census (Scope; the refuted `+2`).
**Verify:** `node scripts/next-target.mjs gen demo && cat src/runtime/target.ts` points at `target.demo.ts`;
re-run `gen server` and it flips; deleting the generated file makes `npx tsc --noEmit` fail loudly
(`tsconfig.json:48` `"**/*.ts"` is in `include`, `exclude` is `["node_modules"]` only at `:55`, so the file
enters the program and its absence breaks every `@/runtime/target` importer). **If it fails:** regeneration is
not on the path CI invokes — first check `gen` is in the `command` whitelist at `:13` and that the emitter is
above `spawnSync` at `:63`, then believe the generated file.

**6. Ignore rules — three files, not two.** Add `/src/runtime/target.ts` and `/src/runtime/readers.ts` to
`.gitignore` **and** `.prettierignore` (8 entries today — `.next`, `node_modules`, `src/generated`,
`package-lock.json`, `contracts`, `docs`, `portal-v1-specification.md`, `prisma/schema.prisma`; neither seam path
is there), **and** the same two patterns to `eslint.config.mjs`'s `globalIgnores` (`:10-16`, 5 patterns today).
The step's original wording — "missing either line means `eslint . --max-warnings=0` or `prettier --check .`
polices generated formatting" — is wrong about **both** tools, measured:

- **Prettier 3.9.6 reads `.gitignore` as well as `.prettierignore`.** `--file-info`: `out/entrar/index.html` →
  `"ignored": true`, although `.prettierignore` never mentions `out` (only `.gitignore:7` `/out` explains it); the
  same call with `--ignore-path <empty file>` → `"ignored": false`; and
  `docs/refactor-dossier/REFACTOR-DOSSIER.md` → `true`, which only `.prettierignore:6` explains. The `.gitignore`
  line alone does remove the generated files from `npm run format:check` — but keep the `.prettierignore` line too,
  because `--ignore-path` switches the `.gitignore` half off.
- **ESLint 9 reads neither.** In a scratch tree outside the repo, with the project's own
  `node_modules/.bin/eslint` (v9.39.5) and a copy of the real `eslint.config.mjs`, a file listed in that tree's
  `.gitignore` was still linted and reported (`gitignored-only/generated.ts` →
  `@typescript-eslint/no-unused-vars`). Flat-config ignores come only from `globalIgnores`/`ignores`, so an
  un-exempted generated file is policed by `eslint . --max-warnings=0` (`package.json:17`) — the very command step
  10 adds a rules block to.

A *committed* generated file is the worse failure and is stopped only by the `.gitignore` line: it silently pins
one target for every clone. **Verify:** `npm run format:check` → 0; `npm run lint` → 0 with both generated files
present; `git status --short` clean after a build; `git ls-files src/runtime/target.ts` → empty. **If it fails:**
identify which of the three ignore files the offender is read from — `npx prettier --file-info
src/runtime/target.ts` and `npx eslint . --format json` answer different questions.

**7. Re-point the 24 statements in 23 files — and then delete the 9 aliases.** Verified inventory by importer
directive: **11** files carry `"use client"` (all under `src/components`, including `use-demo-portal.ts`,
`game-host.tsx`, `player-entry-screen.tsx` and the 8 portal screens) and **12** do not (11 Server Component
pages/layouts under `src/app` plus `src/components/portal/portal-shell.tsx`). Client files import **only**
`@/runtime/target`; Server Components may import both — and step 10's fence must be scoped so that it leaves
those alone, or this step cannot land (measured in step 10). Per-specifier the 24 are
7 `@runtime/adult-portal` + 6 `adult-portal-actions` + 2 `adult-portal-client` + 3 `game-events` +
1 `player-access` + 1 `player-access-actions` + 2 `player-entry-action` + 1 `sign-in-action` + 1
`sign-out-action`; of those, **11 are reader specifiers** (7+1+3) in **10 files**, and every one of the 10 is
under `src/app`; the other **13** are actions and bridges. (`turmas/[id]/page.tsx` holds 2 of the 24.)
**Deleting the aliases is part of this step** — plan §3.1 item 5 ("Delete all 9 `@runtime/*` aliases from
`next.config.ts` and `tsconfig.json`") sat in Scope but in no numbered step, and nothing else in the work order
lands it; Rollback's "the alias deletion **last**, as its own commit" is a *commit* rule, not a substitute. Do it
as this step's final commit: the 9 keys at `next.config.ts:43-79` and the 9 at `tsconfig.json:24-42`, leaving
`tsconfig.json:23` (`"@/*"`), `next.config.ts:35-41` (`env`) and `:42`/`:80-81` (`turbopack` shell) intact — an
empty `resolveAlias: {}` is fine, a missing `env` block is not.
**Verify:** `grep -rn '@runtime/' src | wc -l` → `0` **(a migration gate over `src` only — it cannot see the 9
alias declarations, which live outside `src`; see Exit gate rows 1-2)**;
`grep -rn "@/runtime/target\|@/runtime/readers" src | wc -l` → `24`;
`grep -rn "@/runtime/readers" src/components | wc -l` → `0` (that last check makes the §7.2a hazard mechanical);
`! grep -q '"@runtime/' next.config.ts tsconfig.json` → exit 0 — do **not** write that as a bare `grep -c`, which
prints `0 0` and exits 1 at the passing state (Entry-gate contract). **If it fails:** a client component reached
for a reader — fix the import, never widen `target.ts`.

**8. Plan §3.1 item 4, corrected.** §3.1's rationale is **inverted**: prop-passing a *server reference* across the
Server→Client boundary is legal; prop-passing a *plain function* is what throws ("Functions cannot be passed
directly to Client Components unless you explicitly expose it by marking it with `"use server"`"). So
`sign-in-form.tsx` / `sign-out-button.tsx` **import the seam themselves** — there is nothing to pass — and the mode
branch **survives as a render decision**, because `redirect()` cannot be called from a client event handler. Sites:
`entrar/page.tsx:73` inside the ternary at `:54`, and `portal-shell.tsx:68` inside the ternary at `:59-77`. Keep
the demo branch's `<Link>` (`portal-shell.tsx:60-66`): a `<form method="get">` fallback would bypass `basePath`
(`next.config.ts:28` `basePath: "/SMS_Portal"`; `COMPAT-POLICY` §3 C-6).
<!-- COMPAT: the current no-JS submit behaviour at these two sites — R-05's "/entrar with JS disabled" check -->
**Verify:** after `npm run build:demo`, `test "$(grep -c '<form' out/entrar/index.html)" -eq 0` → exit 0
(Entry-gate contract), and that file still contains `Entrar na demonstração`
(`grep -c 'Entrar na demonstra' out/entrar/index.html` → `1`, exit 0; emitted from `entrar/page.tsx:69` inside the
`<Link>` at `:68`); after `build:server` the new client components appear under `.next/static/chunks`.
**If it fails:** they landed as Server Components and `useActionState` / `onClick` cannot run — add `"use client"`.

**9. The bypass sites plan §3.1 never mentions.** "Everything crosses the seam" is false by construction:
`grep -rn 'container"' src` (excluding tests, `src/runtime`, `src/server/services`) shows the containers imported
**directly**, outside `@runtime/*`, by `portal/adult-portal-actions.ts:19`, `portal/player-access-actions.ts:14`,
`(public-play)/jogar/actions.ts:14` and the four
`src/app/api/v1/player/{bootstrap:3,state:4,results:4,active-time:4}/route.ts` handlers — **7 files / 7
statements** (first published as 8, which mis-summed its own list: 3 action modules + 4 route handlers). The full
grep proves it:
`grep -rn 'container"' src` → **18** hits = 3 (`src/runtime/*-server.ts`) + 1 (`game-event-container.ts`
importing `adult-portal-container`) + 7 (`atividades/actions.ts`, purge-doomed) + **7** bypass; there is no
eighth. **The three action files become seam members and move behind `target.server.ts`; the route handlers are
inert under `output: 'export'`.**
**Verify:** the same grep returns only the 4 route handlers (4 files, 4 statements). **If it fails:** a non-seam
composition path survived — settle it via D-1b, do not silently widen the seam.

**10. The fence.** A `server-only` directive **cannot** sit on the demo reader variant: `node_modules/server-only`
does not exist (`node -e "require.resolve('server-only')"` → `MODULE_NOT_FOUND`; absent from `node_modules` and
from both `package.json` dependency blocks) while `node_modules/next/dist/compiled/server-only` does — its
`index.js` is a bare top-level `throw new Error("This module cannot be imported from a Client Component module. …")`
and its `package.json` maps `"react-server": "./empty.js", "default": "./index.js"`, so the specifier resolves only
through Next's per-layer alias plus `next-env.d.ts:1`. **That alias is the webpack layer**
(`webpack-config.js:1131` `// Alias server-only and client-only to proper exports based on bundling layers`, to
`:1172`) and this project does not run webpack: aliases are declared only under `turbopack.resolveAlias`
(`next.config.ts:42`-`:80`; `grep -c webpack next.config.ts` → **0**), the server build left
`.next/cache/turbopack/v16.3.2-d0ac8828/` behind, and
`grep -rln createServerOnlyClientOnlyAliases node_modules/next/dist/build/` → `create-compiler-aliases.js`,
`webpack-config.js` and `jest/` only — nothing on the Turbopack path, where the `react-server`/`default` split is
applied natively in Rust. (The original citation named a layer that never executes here; the conclusion is
unchanged — unresolvable outside Next, so demo readers must not carry `server-only`.) Reach instead for a **core**
ESLint rule (`eslint-plugin-import` is not installed either; `eslint.config.mjs` is 17 lines with no `rules` key
at all, and `npx eslint --print-config src/components/portal/classes-screen.tsx` → 471 rules with
`no-restricted-imports` **and** `@typescript-eslint/no-restricted-imports` both `undefined`, so a new block is
purely additive and clobbers nothing):

```js
// PROPOSAL — core rule, one new *scoped* block appended inside defineConfig([...]) in eslint.config.mjs
{ name: "readers-fence",
  files: ["src/components/**/*.ts", "src/components/**/*.tsx"],
  rules: { "no-restricted-imports": ["error", { patterns: [{
    group: ["@/runtime/readers", "@/runtime/readers.*"],
    message: "Build-time readers must not be imported from a component graph." }] }] } }
```

**The `files:` line is load-bearing, and the block this file first published had no `files` key at all.**
Measured with the project's own pinned `node_modules/.bin/eslint` (**v9.39.5**) on fixture trees in a scratch
directory outside the repo (`~/qoder-scratch-seam30`, its `node_modules` a junction to this install, so the *real*
presets were in play — `eslint-config-next/core-web-vitals` + `/typescript` + `eslint-config-prettier/flat` + the
same `globalIgnores`, with **only** the fence block varying), `--max-warnings=0` as `package.json:17` runs it,
nothing in the repo touched:

| tree | fence as first written (no `files:`) | fence with the `files:` line |
| :-- | :-- | :-- |
| baseline, no fence block at all | 0 errors, exit 0 | 0 errors, exit 0 |
| fixtures, violators included (side-effect, named, `.server`/`.demo` variant and `export … from` forms, in `src/components` clients, `src/app` Server Components and a `src/runtime` consumer) | **6 of 6 reader imports red / 6 errors**, exit 1 — including `src/app/…/page.tsx` and `src/runtime/consumer.ts`; only the `@/runtime/target` import stayed silent | 3 red / 3 errors (exactly the 3 `src/components` clients), exit 1; `src/app` and `src/runtime` **silent** |
| a clean **post-step-7** tree: 10 legitimate `@/runtime/readers*` imports from `src/app/**` Server Components + 1 from `src/runtime` + 9 client `@/runtime/target` imports, **no violations** | **11 errors, exit 1** | **0 errors, exit 0** |

The unscoped column is fatal: step 7 mandates precisely those `src/app` reader imports ("Server Components may
import both") and the real tree has **11** reader specifiers there (7+1+3, in 10 files), so the unscoped block
lands `npm run lint` at ≥**11** errors, `eslint . --max-warnings=0` at exit 1 and `npm run check`
(`package.json:24`) red — this phase's Exit gate **unreachable** (seam-test row): a gate that **cannot pass**, not
one that cannot fail. It also indicts the seam itself: a generated `src/runtime/readers.ts` that re-exports
`@/runtime/readers.server` is one of the red fixtures (measured: `src/runtime/consumer.ts` flagged), a second
reason step 5 must emit the pointer with a **relative** re-export. And the scoped block is what rescues Phase 3's
assertion in `phases/40-decomposition.md` step 12 (`npm run lint` → "still 0 (**rule not added**)"): false under
the unscoped version the moment this phase lands, true under the scoped one for any lane that adds no client
reader import.

**What the `files:` scope costs** — it scopes by **directory**, not by directive, so a path rule cannot condition on
the importer carrying `"use client"`. `src/components/portal/portal-shell.tsx` sits *inside* the scoped path and is
a **Server Component** (no line-1 directive; its mode ternary runs `:59-77`), and it stays green only because it
imports `@/runtime/target` (`:7`); any future component-directory file that legitimately needs a reader must be
individually exempted, and the rule is inert for the 12 files outside `src/components`. Two blind spots the
directory scope does not close: a **relative** specifier is not matched at all — measured,
`import { x } from "../runtime/readers.server"` inside a `"use client"` file under `src/components` → **exit 0**,
unchanged by either version of the fence — so the rule covers the alias form and nothing else; and a path rule
cannot reproduce `server-only`'s guarantee, so the residual needs a `react-server`-layer check or a hand-written
rule.

**Ownership — settled here, because three phase files claim the same rule.** This phase owns
`no-restricted-imports`: it is the only one of the three with a step that writes it, and the readers-vs-actions
boundary is seam semantics, not decomposition or CI semantics. `phases/40-decomposition.md` hands it to Phase 4
near its opening ("*the `no-restricted-imports` rule itself* … Phase 50 owns it, step 12 only clears and records
its red set"), while `phases/50-gates-ci-demo-docs.md` has **no step for it** and freezes `eslint.config.mjs` as
an interface (its *Interfaces* list and its *Do not touch*). Neither can be right and only one can act, so:
**Phase 3 and Phase 4 must not add a second block** — Phase 3's step 12 re-anchors its "rule not added" premise on
`npx eslint --print-config <file>` against whatever this phase landed, and Phase 4's freeze belongs on the
`globalIgnores` list (`:10-16`), which step 6 of *this* file edits, not on the whole file.
**Verify:** `npm run lint` → 0; then add
`import { getPortalShellData } from "@/runtime/readers.server";` to a `"use client"` file under `src/components`,
confirm lint goes red **and** `npm run check` goes red, remove it; then add `import "@/runtime/readers"` to an
`src/app` Server Component and confirm it stays **green** — a block that reddens *that* import is the unscoped bug,
not a stronger fence. **If it fails:** the pattern does not match the specifier form used, or the `files:` glob
missed the directory.

**11. Test resolver.** `vitest.config.mts:5-11` aliases only `@` → `./src/` (the `@` mapping is `:8`);
`test.include` is `tests/**/*.test.ts`, `environment: "node"`, `APP_RUNTIME_MODE=demo` at `:12-15`. This file
concluded from that "**no test can import the seam today**". **False as written — and the true fact is worse.**
`grep -rn 'from "@/runtime/\|from "@runtime/' tests` → **9 import statements across 6 files**
(`runtime-mode.test.ts:3`, `adult-portal-service.test.ts:11`, `demo-player-access.test.ts:16,20,21`,
`demo-portal-helpers.test.ts:18`, `demo-professional-creation.test.ts:8,9`, `game-offline-sync.test.ts:16`), so
the suite crosses into `src/runtime/` freely and passes. The defect is *which* form: **all 9 are
`@/runtime/<concrete-file>`** — the generic `@/*` path at `tsconfig.json:23` — and **0** are the `@runtime/*` alias
the seam is made of (`grep -rn '@runtime' tests` → **0 hits**); every one pins a specific **demo** implementation
(`adult-portal-demo-store`, `player-access-demo-actions`, `player-entry-demo-actions`,
`demo-professional-creation`, `game-offline-sync`, `mode`) directly. The tests **bypass** the seam rather than
failing to reach it, and step 7 re-points the 24 production imports while leaving all 9 test imports exactly where
they are.

Consequence for this step: the alias block is **not** what makes a seam test possible — `@/runtime/target`
resolves through the existing `@` alias the moment step 5 emits it. A `resolve.alias` for `@/runtime/target` /
`@/runtime/readers` is load-bearing **only** while the slash-free `@runtime/*` form survives, i.e. under
**D-1 = (b)**, where the aliases stay and a `@runtime/…` test import genuinely cannot resolve today. Book it as a
(b)-branch step. **Verify (against the branch that needs it):** under **(b)**, the new seam test resolves with the
block and fails to resolve without it — that fail-then-pass is the only form of this gate that can actually fail.
Under **(a)** there is nothing to verify: the block is a no-op and "fails to resolve without it" can never be
false, so the gate is vacuous, and the discriminating **(a)** check is step 5's negative test (delete the
generated files → `typecheck` red, `test` green). Plus, under either branch, a `server-only` stub alias — 7 tests
already do `vi.mock("server-only", () => ({}))` (`access-link-service:23`, `game-event-ingestion:3`,
`game-request-body:3`, `game-state-prisma:3`, `neon-auth-gateway:3`, `player-access-prisma:3`,
`portal-dev-bypass:3`). **[U] — whether that stub is needed at all is unresolved and must be settled by a real
`npm test` run, which this phase's harness forbids:** the package is provably unresolvable
(`require.resolve("server-only")` → `MODULE_NOT_FOUND`), yet `game-event-ingestion.test.ts:3` mocks it and then
`:11` imports `@/server/db/prisma-game-event-store`, whose `:1` is `import "server-only"`, and that file is inside
the 33-file suite the Entry gate calls green. Either Vitest's factory mock already intercepts the bare specifier —
in which case the new alias is redundant, not free — or something else resolves it. Do not book the alias until
one of those is demonstrated. **If it fails:** the alias key doesn't match the import specifier, or the D-1 branch
was not chosen before this step was written.

**12. Per-target typecheck — the defect this phase actually cures, and the owner of the config it needs.**
`tsconfig.json:24-42` pins **all 9** `@runtime/*` paths to the **server** variants (measured: all 9 values are
byte-identical to `next.config.ts`'s non-demo branch — the asymmetry is total) while `next.config.ts:43-79`
switches them per `APP_RUNTIME_MODE`; so `npm run typecheck` has never typechecked the demo wiring and no
`typecheck:demo` exists (`grep -c 'typecheck:demo' package.json` → **0**; `ls tsconfig.demo.json` → **No such
file**). **No other step in this work order creates either object**, and this file's own step-1 fallback, Exit
gate, `phases/00-prerequisites.md`'s handoff notes and `phases/50-gates-ci-demo-docs.md`'s **Phase-2 handoff** all
assume they exist — so this step owns them: `tsconfig.demo.json` (extends `./tsconfig.json`, and under (b)
overrides `compilerOptions.paths` to point the 9 aliases at the demo variants; under (a) the aliases are gone, so
it adds nothing to `paths` and relies on generation) and one new `package.json` key
`"typecheck:demo": "tsc -p tsconfig.demo.json --noEmit"`. Both are *additive*: `package.json:17,20,21,24` keep
their exact text (**T1** in `phases/00-prerequisites.md`, repeated by `phases/50`'s *Do not touch*), which is why
the addition must be booked by the phase *allowed* to add a key rather than left to a file that forbids it.
**The (a) trap, stated once:** under (a) the demo/server choice is made by the *generated*
`src/runtime/target.ts`, not by `paths`, so a `tsconfig.demo.json` that merely inherits `compilerOptions.paths`
re-typechecks whatever the last `gen` emitted — reporting demo while checking server — hence `gen demo &&` is a
**prerequisite command** of the gate, not an environment prefix. **Verify:** break one demo-variant export name
deliberately and confirm `npx tsc -p tsconfig.demo.json --noEmit` goes red, then revert — a gate that cannot go
red is not a gate. **If it fails:** the check stayed green after a deliberate break, which means it inherited
`paths` and is checking the wrong variant.

**13. Close-out.** `node scripts/next-target.mjs gen server && npm run build:server && npm run build:demo &&
node scripts/next-target.mjs gen demo && npm run check`. **Verify:** all four legs of `check` exit 0 and the
Entry-gate numbers reproduce. Read the order — it is what makes the typecheck honest: `build:demo` is the last
**build** to write `.next` and to rewrite `src/runtime/target.ts`, so the `typecheck` leg inside `check` sees the
**demo** wiring; `typecheck:demo` (step 12) must therefore be the leg pinned with `gen demo`, and
`npm run typecheck` is a server-variant check only after `gen server`. "All four green" otherwise proves one variant
was typechecked twice — the silent single-variant coverage this phase exists to end. **If it fails:** confirm
`.next/types` is from the target being typechecked before believing any error (step 1's trap).

## Decision points

**D-1 — the mechanism. Human call; §3 lists it as blocking. Its two branches strand gates in two different
files, so it cannot be deferred past Day 2.**

| | (a) plan §3.1 as written (generated seam) | (b) audited cheap alternative |
| :-- | :-- | :-- |
| Files | ~14 new/rewritten | 4 new/edited, 0 source files beyond configs |
| Time | ~2-3 days | ~5-6 hours |
| New failure modes | 6 (stale / absent / committed generated file, prettier, `--max-warnings=0`, wrong `TARGET_MODE`) | 0 |
| Drift detection | same, on the only detectable axis (export removed/renamed → 8× `TS2305`/`TS2724` at real call sites; **`[S]`**, reason carried once in Tests) | same |
| Alias removal | yes → §7.2's "9 → 0" criterion met, **and the only branch that can satisfy `phases/50` G6** | no → a **recorded deviation**, **and G6 goes red with it** |

(b) = `tsconfig.demo.json` (9 paths → demo variants) + `typecheck:demo` in CI + the `vitest.config.mts` alias
block + `contracts.ts` with each variant declared `satisfies PortalReaders` / `PortalActions`, so a missing or
misnamed export fails at the **call site**. Presented as the design the governing audit already approved
(`architecture-audit-2026-09-23.md:626-628`, cited via §7.5 and `ADV-2`; not re-opened here).
**Dossier recommendation: (b), then (c).** **Default if unmade: implement (a)** — this Work order is written for
(a), because the plan is fixed input — but the table is why the answer must be spoken before Day 2.

**D-1 needs an owner answer: which gate fails on which branch.** Two reviews put this as *"(a) makes this file's
first Exit gate and `phases/50`'s **G6** mutually unsatisfiable"*. **That pairing is refuted**, and the refutation is
what makes the phase walkable: under (a) step 7 deletes the 9 aliases from both configs, so the `src`-scoped
`grep -rn '@runtime/' src` → `0` and the config-scoped `! grep -q '"@runtime/' next.config.ts tsconfig.json` →
exit 0 move together — both count the same deletion, so they never fight. The branch-stranded gates sit one row
further down, and `phases/50`'s G6 row states that pair itself: **G6** versus this file's
`npx tsc -p tsconfig.demo.json --noEmit` bullet, "(a) → G6 ✓, that bullet ✗; (b) → that bullet ✓, G6 ✗", verdict
"**The two gates cannot both pass on any answer.** Owner must pick". Right **as both files stood**; closed both
halves here:

1. **(a)** — this file's default, what every numbered step is written for — could not satisfy its own
   demo-typecheck row: no (a) step created `tsconfig.demo.json`, the file is absent (`ls tsconfig.demo.json` →
   `No such file`), and its only appearance in a work order was step 1's *fallback*, which books it as the (b)
   mechanism. **Step 12 now owns it in both branches**, so (a) clears its own demo gate.
2. **(b)** — the dossier's recommendation, and the branch *Accepted breakage* already books as a deviation —
   leaves **G6 unreachable**, because (b) *is* "the existing per-mode aliases plus `tsconfig.demo.json`".
   `phases/50` carries that honestly (its G6 row, its D-1 flag, its Exit bullet "G6 settled by an answer, not by
   editing the gate"), so the open item is the **answer**, not the paperwork.
3. **The alias deletion was unowned until now** — which is what stranded G6 under (a): named in step 1 ("precedes
   every alias deletion") and in Rollback, but performed by no numbered step, so `0`/`0` was unreachable however
   the re-write was worded. Step 7 performs it (*Deleting the aliases is part of this step*).
4. **`phases/50` freezes the same lines it orders deleted:** its *Interfaces* list names `next.config.ts:44-79`
   and `tsconfig.json:24-42` — exactly the 9 + 9 alias entries its own G6 asserts to `0` — and its *Do not touch*
   is the same shape. That is a Phase-4 wording problem (the freeze should read "not to be edited *by this
   phase*"), recorded here because this file may not edit theirs.

**Net.** As the six files stood, **neither branch was walkable**: (a) failed this file's demo-typecheck gate, (b)
failed G6, and the deletion that would let (a) satisfy G6 had no owner. Items 1 and 3 are now closed *inside this
file*, so **(a) satisfies G6 and its own demo gate together** — which dissolves the "no answer satisfies both"
verdict `phases/50` records, correct as it was against the earlier text (its G6 row and D-1 flag should be re-read
after this lands; this file may not edit them). **(b) still fails G6**, unavoidably: the branch preserves the
aliases by definition, so under (b) the answer is a deviation row in two files, not one. **Owner answer required,
and a real choice rather than a formality** — the table above *is* the trade-off: (a) is the only branch that can
go fully green, at ~2-3 days and 6 new failure modes; (b) is ~5-6 hours and 0 new failure modes but permanently
forgoes plan §7.2's "9 aliases → 0". Confirm the branch, and confirm whether `phases/50` G6 keeps its
config-scoped assertion (meaningful only under (a)) or gains a deviation row (honest only under (b)).

**D-1b — do the four `/api/v1/player/*` route handlers cross the seam?** They are inert under
`output: 'export'` and reach the containers directly. **Default if unmade: leave them**, document the residual
bypass count (step 9), and have Phase 4 assert the *count*, not zero.

**D-4 — `/atividade/[token]` sunset. CLOSED; no answer needed and none should be asked.** Option (b), the static
shim page this entry once booked as live, is deleted by `COMPAT-POLICY.md` §6 adopting **edit 4 as written**
(*Blocks*): `REFACTOR_PLAN.md:21` already dropped legacy compat,
`docs/implementation/slice-03-05-portal-handoff.md:53-55` already orders the routes removed, and no shim could work
because `access_links` is `DROP TABLE`'d. So `PortalReaders` gains **no** shim member, `readers.demo.ts` is
unchanged by this question, and **step 2 is unblocked**. Retained as a closed row: the only surviving duty is
deleting `walkthrough.md:11`, which is not a seam edit.

**D-3 — CSS sequencing (Phase 3's call, binding here).** Item 4 invalidates the sole-owner class map; under
D-3 = (b) extraction is deferred and the edge goes latent. Either way, land item 4 first. **Ownership note:**
`phases/40-decomposition.md` demands this answer as its own entry condition ("without an answer steps 3-4 do not
run", its opening constraints) and this file cannot answer it either — so step 8 ⇄ Phase 3's steps 3-4 is a
wait-on-each-other pair mediated by one unowned human decision, exactly like D-1. Answer both before Day 2.

## Exit gate

- [ ] `grep -rn '@runtime/' src | wc -l` → `0` (only under D-1 = (a); under (b) a recorded deviation). **This gate
      alone does not prove the migration: it is `src`-scoped and the 9 alias declarations are not in `src`** — they
      live at `next.config.ts:43-79` and `tsconfig.json:24-42` (9 keys each), so the count reaches 0 on step 7 and
      stays 0 however many aliases survive in the configs: the completeness assertion **under-counts by
      construction**, silently, on the very criterion this file calls "the clause that genuinely discriminates".
      The config-scoped half is the next row.
- [ ] `! grep -q '"@runtime/' next.config.ts tsconfig.json` → exit 0 — both files at **0 keys**, today `9` / `9`
      (`grep -c '"@runtime/' next.config.ts tsconfig.json` → `next.config.ts:9`, `tsconfig.json:9`). **A bare
      `grep -c` prints `0 0` and exits 1 at the passing state** — measured on post-deletion copies of both files
      (Entry-gate contract); `phases/50`'s **G6 row** carries the identical gate in that bare form, so the
      exit-status fix belongs to both files and that one is not mine to edit.
- [ ] `grep -rn "@/runtime/readers" src/components | wc -l` → `0`.
- [ ] `npm run build:server` → 0, and the manifest one-liner → exactly the re-baselined Entry-gate count. A drop
      means an action lost its last importer; an increase means the seam widened the graph.
- [ ] `npm run build:demo` → 0 with **no E625**, manifest → `ids 0 server-action 0`.
- [ ] `grep -rl '\$ACTION_ID' out | wc -l` → `0`;
      `test "$(grep -c '<form' out/entrar/index.html)" -eq 0` → exit 0 (Entry-gate contract note).
- [ ] `node scripts/next-target.mjs gen demo && npx tsc -p tsconfig.demo.json --noEmit` → 0 (first time this has
      ever run; the config is step 12's, in both D-1 branches). The `APP_RUNTIME_MODE=demo` prefix this row once
      carried is **deleted**: `tsc` reads no environment variables, so generation is a **prerequisite written as a
      command**, never an assertion in a prefix (step 12's (a) trap; under (b) the prefix was inert but harmless,
      `tsconfig.demo.json`'s own `paths` doing the work).
- [ ] The new seam test passes; `npm run check` → 0. **Reachable only with step 10's `files:`-scoped fence**:
      `lint` is the second leg of `check` (`package.json:24`) and the unscoped block puts it at ≥11 errors by
      construction (step 10's post-step-7 row).
- [ ] `git status --short` clean after a build; `git ls-files src/runtime/target.ts src/runtime/readers.ts` →
      empty.
- [ ] R-05 / R-17 walked against §11.1 (26 documents expected in `out/` post-purge — `REFACTOR-DOSSIER.md:590`;
      the current export has **104** `.html`, so the 26 cannot be measured now). **R-03 / R-06 deleted from this
      row** — retired to §9.3 as documented demo properties by `COMPAT-POLICY.md` §6, edits 6 and 10 (*Blocks*).

## Interfaces that must not change

| Surface | Constraint |
| :-- | :-- |
| 15 **exported** readers (9 `adult-portal-server.ts` + 1 `player-access-server.ts` + 5 `game-events-server.ts` `^export ` hits; the demo trio is 9/1/5 too), reached by **11** reader specifiers in **10** files — of the 15 exports, 11 are page-render reads and 4 are `listStatic*` reads declared in **4** files | called by async Server Components and `generateStaticParams`; must stay **Node-safe at build time**; `DemoAdultPortalStore` still branches `typeof window === "undefined"` → seed clone (`adult-portal-demo-store.ts:347`) |
| ~18 mutation handlers (16 client-invoked, 2 JSX-bound) | `revalidatePath` and `redirect()` semantics must not silently change when a client component awaits a plain function instead of submitting a form action |
| 3 client bridges | `loadClientPortalState`, `changeDemoProfile`, `resetDemoPortal` (`adult-portal-server-client.ts:3,7,11`) stay no-ops on the server variant; browser-only |
| `PortalMutation` (`src/components/portal/adult-portal-form.tsx:11-14`) | already the prop type of every mutation form — §3.1 step 1's typed contract is ~90% written; do not invent a second one |
| The four containers' factory signatures | `getAdultPortalService`, `getPlayerAccessService`, `getGameStateService`, `getGameEventService` — tests mock them by module path |
| `src/proxy.ts`, `/api/v1/player/{bootstrap,state,results,active-time}` | inert by construction under `output: 'export'`; no assertion may depend on them |

**Row 1's units, named** (its first version conflated all three, and Phase 3's decomposition contract quotes this
row). **Exports** =
`grep -c '^export ' src/runtime/{adult-portal,player-access,game-events}-server.ts` → **9 / 1 / 5 = 15** (the demo
trio matches, which is what makes `satisfies` meaningful); **specifiers** =
`grep -rn '@runtime/adult-portal"\|@runtime/player-access"\|@runtime/game-events"' src` → **7 / 1 / 3 = 11** in
**10** files (step 7's inventory), and *15 specifiers is arithmetically impossible*: only 24 `@runtime/*`
statements exist in the tree and 13 are actions or bridges; **export split** = 11 page-render readers vs 4
static-param readers, not 12 vs 3 — the 4 are the `listStatic*` names (`listStaticOrganizationIds`,
`listStaticClassIds`, `listStaticResultClassIds`, `listStaticResultPlayerParams`), declared in **4** files
(`admin/organizacoes/[id]`, `resultados/[classGroupId]`, `…/players/[playerSlotId]`, `turmas/[id]`). Migration
gate: `grep -rn "@/runtime/readers" src | wc -l` → `11` post-step-7; hazard gate: step 7's
`grep -rn "@/runtime/readers" src/components | wc -l` → `0`.

## Tests

**Added.** `tests/unit/runtime-seam.test.ts`, importing `@/runtime/target` under `environment: "node"`: demo
mutations round-trip against the seed clone, bridges are Node-safe — the concrete payoff the alias never
delivered. `contracts.check.ts`, so one `tsc` run checks both variants; without it CI must run `gen demo && tsc`
**and** `gen server && tsc` or drift is invisible — now literal, because `gen` is a real named subcommand of step 5
rather than a `prebuild` hook that never fires. The manifest one-liner becomes a CI step. (The old framing here,
"**no test could import the seam at all**", is refuted in step 11.)

**What each catches, and what none of them can.**

- "`out/_next/static` has no `@prisma`, `pino` or `@neondatabase` **module** strings": **already true today**
  (0 files each, per Scope), stays true with zero seam work — it can never reject a bad seam. Not coverage.
- "no `api/` in `out/`": can never fail; the exporter drops route handlers silently under `output: 'export'`
  (`next.config.ts:28`) — `REFACTOR_PLAN.md:236` is the plan's **demand** ("assert no `api/` in `out/`"), not the
  mechanism, so that citation attributes the requirement, not the cause.
- "demo build registers 0 ids": a valid **regression** guard for a failure that does not exist today — it only
  earns its keep once step 4 creates the client-imports-readers exposure it defends against.
- "0 `@runtime/*` in `src`": a migration gate, not a behavior gate — and, alone, not even that (Exit gate rows 1-2).
- `typecheck:demo` catches removed/renamed exports at real call sites (the dossier's **8×**
  `TS2305`/`TS2724` — carried as **`[S]`**: `REFACTOR-DOSSIER.md` flags it "figure from `ADV-2`/`VER-B` prose, not
  independently reproduced", and reproducing it needs a rename of a tracked export, out of bounds here) and
  **nothing else**: not sync⇄async — a non-`async` function returning a service promise *is* `Promise<T>`
  (`adult-portal-demo.ts:15-21`), so no interface distinguishes them, and the genuinely sync readers are sync
  server-side too — and **not** wrong-variant selection. **`TARGET_MODE` is the load-bearing control.**
- Record, don't dismiss: a non-`async` function that throws before returning its promise rejects
  **synchronously**, so `f().catch(…)` and `Promise.all([...])` see a different failure shape than
  `try { await f() }`. Behavioral, not typed.
- Negative test: delete the generated files, confirm `typecheck` fails loudly while `test` does **not** — that
  asymmetry is a property of the design, not a bug to fix silently.

## Do not touch

`REFACTOR_PLAN.md`; `next.config.ts:5-19` (mode parse, server-env assertion) and `:35-41`
(`env.APP_RUNTIME_MODE`, `APP_BASE_PATH`) — deleting aliases must not delete the `env` block;
`scripts/next-target.mjs:39` and `:41-53` (`AUTH_DEV_BYPASS` pin, demo env blanking); the internals of the four
containers; `src/runtime/mode.ts`; `adult-portal-demo-store.ts` persistence semantics — **no seam step touches
them**, and that is the whole reason, not the old `(D-2, R-06)` freeze (edits 6/10, *Blocks*), which replaced the
"do not change the key or version" ban with a sanctioned bump to `:v3` / `version: 3` at
`adult-portal-demo-store.ts:124,137-138,148`, whose seed fallback at `:347-356` is the entire migration; `out/`
and `docs/` (both prettier-ignored — `--file-info` measurement in step 6);
`src/server/security/tokens.ts` — deleted in Phase 1, do **not** resurrect it to make
`access-link-service.ts:4` / `portal-view-service.ts:3` / `public-link-service.ts:3` compile behind the seam
(plus purge-doomed `atividades/actions.ts:11` and two tests: `access-link-service.test.ts:6`,
`access-link-tokens.test.ts:10`). **The dependent this row originally named, `jogar/actions.ts`, is wrong** — it
imports `@/server/security/player-credential-tokens` (`:6-13`), never `tokens.ts`
(`grep -rn 'server/security/tokens' src tests` → 6 hits, none in `jogar/`). `package.json:17,20,21,24` (`lint`, `typecheck`, `test`,
`check`) — their **text**, not their existence: step 12 adds a `typecheck:demo` key and step 5 adds
`prebuild:demo` / `prebuild:server` / `predev:demo`, every one a *new* key, because later phases quote those four
strings verbatim in their own gates (**T1** in `phases/00-prerequisites.md`; `phases/50`'s *Do not touch*). The
reverse case — this phase **does** edit `eslint.config.mjs` (step 6's `globalIgnores` entry, step 10's
`readers-fence` block) while `phases/50`'s *Interfaces* freezes that same `globalIgnores` line and its *Do not
touch* freezes the whole file yet owns no step for the rule, so those rows need narrowing to "Phase 2 owns the
rules block" — is settled in step 10, *Ownership*.

## Rollback

Seam files are additive and every rewire is a per-file import edit, so rollback = `git revert` of the seam commits,
plus restoring the 9 aliases from `next.config.ts:43-79` and `tsconfig.json:24-42` if already deleted — the
*revert* of the alias-deletion commit puts back 9 + 9 keys and `phases/50`'s G6 then reads `9 9` again, which is
the correct post-revert state, not a failed gate. Revert-cheap ordering: steps 2-6 **before** step 7, and the alias
deletion **last**, as its own commit. **Two things a `git revert` does not undo:** the generated
`src/runtime/target.ts` / `readers.ts` are untracked, so they survive a revert and keep pointing at whichever
variant `gen` last emitted — delete them by hand or run `node scripts/next-target.mjs gen demo` so the reverted
tree resolves; and the new `package.json` keys of steps 5 and 12 revert with the commit that added them, so
`typecheck:demo` must be re-booked before any `ci.yml` leg that calls it. After any revert:
`rm -rf .next out && npm run build:demo && npm run build:server`, so no stale `server-reference-manifest.json` or
`.next/types` misleads the next gate run.

## Accepted breakage

- **E625 safety is not the deliverable, and the build does not fail today.** The gate is reached **only on the demo
  target** and the demo target registers 0 ids for a structural reason — none of the 9 demo alias targets is a
  `"use server"` module (step 4; predicate chain in *Evidence*). So `REFACTOR_PLAN.md:130` — "contains **0
  registered action IDs** during `build:demo`, effortlessly passing `E625`" (first quoted here as "*thereby*
  effortlessly passing E625", which paraphrases: the word *thereby* is not on the line) — describes **preserving an
  existing property**, not unblocking a build. What the seam *is* for, once that is admitted: **typing,
  testability, boundary clarity.** The clause that genuinely discriminates is "9 aliases → 0" **and** the 24
  `@runtime/` import sites in 23 files — and only the second half was checkable as written, because the gate
  carrying "9 aliases → 0" was `src`-scoped (Exit gate rows 1-2).
- Mode branching does not fall: **95 → 95 lines, +0** (first published as `+2`; Scope's counting rule refutes it).
  R-03's hydration flash stays an accepted, documented **demo property** — dossier §9.3, handle moved by §6
  (*Blocks*); the substance is unchanged. A stale **demo** pointer during `build:server` is caught by nothing but
  `TARGET_MODE` plus the manifest gate; that residual ships with choosing (a), and ships *wider* than the first
  version admitted: with hook-only wiring the pointer is also silently stale on every `npx tsc --noEmit`, which
  step 5's named `gen` action closes.
- If D-1 = (b) is taken, plan §7.2's "0 `@runtime/*` aliases" criterion is deliberately unmet and must be
  recorded as a deviation, not quietly dropped — and the deviation reaches into `phases/50`: G6 asserts the
  config-scoped version of the same criterion (D-1, item 2).

## Handoff notes for later phases

**Phase 3 (CSS):** item 4's two new client components move 12 marketing classes + `styles.logoutButton` — rebuild
the sole-owner map *after* this phase; `mobileNavItem` is defined in **0 of 7** stylesheets
(`grep -rn mobileNavItem src --include='*.css'` → 0, against 7 CSS files under `src`: 6 `*.module.css` +
`globals.css`), so check before "fixing" anything — **the warning stands, the `(R-02)` handle does not**: §2's
R-02 row and edit 10 move it out of the §11 register into a defect ticket precisely because no phase causes it,
and `phases/50`'s own register table already treats R-02 as **"Dropped as a register row … survives as a defect
ticket + the oracle blind-spot warning"** — the same disposition *Blocks* records for R-03/R-06. **Phase 3
(decomposition):** the ~30 genuine `runtimeMode` defects are a separate ~1-hour ticket; do not re-justify them
with this phase. **Phase 4:** adopt the manifest one-liner, `typecheck:demo`, the seam unit test, and a
**bypass-count** assertion (expected 4 route handlers **and 4 statements**, not 0 — step 9) as CI jobs; `ci.yml`
must not be the first merge (D-7). Four things Phase 4 must inherit rather than re-derive: (i)
**`node scripts/next-target.mjs gen <mode>` is a CI command** — no lifecycle hook will do it (step 5), so a
`ci.yml` that only calls `npm run typecheck` typechecks a stale or absent seam entry; (ii) G6 is this file's
Exit-gate row 2 restated — same command, same `grep -c` exit-status trap, wrap it in `! grep -q`; (iii) the
`no-restricted-imports` rule is **already added** by step 10, so the `--print-config` baseline for any later lint
assertion must be taken after Phase 2 lands, and Phase 4 must not add a second block (step 10, Ownership);
(iv) any phase touching `/api/v1/player/*` inherits D-1b. Anyone tempted to write a real `server-only`
fence: step 10 — not installed, and the webpack alias that would provide it is not this project's bundler.

## Evidence

Dossier §7.1-§7.7 (whole of §7: E625 mechanics, the four corrections a-d, the adjudicated typing result and its
drift table, the Day-2 spike, the cheaper mechanism, the expectations to correct, the stable interfaces); §3 D-1
and D-4; §10.1-§10.2; §11 R-03/R-05/R-06/R-17 and §11.1 — **of which R-03, R-06 and R-02 are retired by
`COMPAT-POLICY.md` §6 and D-4's option (b) by edit 4 (*Blocks*)**, so the citations that remain live in this file
are §3 D-1, §10.1-§10.2, §11 R-05/R-17, §11.1 and §9.3 for the two demo properties.
Reports: `INV-B` (Consumer inventory Tables 1-2; "E625 exact mechanics in 16.3.2"; "Verification gates that
actually discriminate"; "Alternatives considered"); `VER-B` (server-only / client-graph analysis; "Is plan §3.1
item 4 implementable as written?"; the asserted asymmetry; R1 spike design); `ADV-2` (Attack 1 cost table;
Attack 3; Attack 4; the 95-branch section); `ADJ-02` §§1-5; `NOTE-00` §§1-5. Refutation this pass was written
against: `reports/RV-30-seam-refutation.md` (27 PASS · 9 FAIL · 3 VACUOUS-GATE · 2 STALE-RULING · 4
UNREPRODUCIBLE) and the cross-file `RV-X`.

**Verified first-hand at `e5aaf1e`, not copied from the dossier.** E625's predicate chain end to end — the one full
derivation, pointed at from the Entry gate and *Accepted breakage*:
`export/index.js:358` (`if (enabledDirectories.app)` — true here, `src/app` exists — gating the manifest
`require` at `:359`, which is therefore loaded on **both** targets and never tested on the server one), `:360`
(`output === 'export'`; `next.config.ts:28` sets it only for demo-and-not-dev-server, `:32` gives the server
`standalone`), an **E626** interception-route throw sitting between at `:361-373` that would pre-empt E625,
`:375` `const actionIds = [` / `:379` `if (actionIds.some((actionId)=>(0,
_serverreferenceinfo.extractInfoFromServerReferenceId)(actionId).type === 'server-action')) {`, and `:380-384`
(the `ExportError`, `:381` `value: "E625"`). Plus `shared/lib/server-reference-info.js:35-47`, where the type is
`typeBit === 1 ? 'use-cache' : 'server-action'` (`:36` `parseInt(id.slice(0, 2), 16)`, `:37` `infoByte >> 7 &
0x1`) — so an id whose first byte's top bit is clear *is* a server-action, and the Entry gate's
`f=i=>parseInt(i.slice(0,2),16)>>7===0` is a faithful inverse of the real predicate, not a proxy.
`.next/server/server-reference-manifest.json` (mtime 2026-09-23 02:05) → 17 node / 0 edge ids, **all 17** decoding
to `server-action` (first bytes **`40` ×2, `60` ×14, `00` ×1** — the enumeration read `40`/`60` only, which is
incomplete though the conclusion holds, since `00 >> 7 = 0` decodes `server-action` too; `node -e` over the
manifest prints the map `{"40":2,"60":14,"00":1}`), with `filename` values only `entrar/actions.ts` ×1,
`portal/adult-portal-actions.ts` ×10, `portal/player-access-actions.ts` ×4, `portal/sign-out-action.ts` ×1,
`jogar/actions.ts` ×1 = 17, `edge` 0 — and **zero** entries for the purged `portal/atividades/actions.ts` or for
`entrar/recuperar/actions.ts`. `grep -rl '\$ACTION_ID' out | wc -l` → 0 files (and 0 in `.next/static`, so no id
is embedded anywhere in the current output).

**Verified first-hand too, but carried once in the body** (command, output and reading in the section named): the
`runtimeMode` census (Scope), the **20** `import "server-only"` files with the 3/2/7/3/5 split (Scope), the 18
`container"` hits and **7 / 7** bypass (step 9), the 15-export / 11-specifier / 4-file split (Interfaces),
`src/runtime`'s 16 files and 0 `export *` (step 1), the 9 + 9 alias declarations and byte-identical `paths`
(steps 7, 12), the 8 demo files behind 9 aliases (step 4), `run-script.js:121-122` (step 5), the `server-only` /
`eslint-plugin-import` absence (step 10), the containers' **99** lines (step 3), `.prettierignore`'s 8 entries
(step 6), and the `entrar/page.tsx` / `portal-shell.tsx` form sites (step 8).
**Unique to this ledger:** `service-container` has only two importers repo-wide (`atividades/actions.ts`,
`tests/unit/portal-dev-bypass-actions.test.ts` — cf. the COMPAT tag at step 3's `player-access-actions.test.ts:17`),
whose 7 `await import("…/service-container")` sites are at `:121, :261, :333, :377, :418, :458, :493`, so Phase 1
can delete it with nothing dangling; the spans `next.config.ts:42` `turbopack`, `:43` `resolveAlias: {`, `:80-81`
closing the two objects, `tsconfig.json:22-43` `paths` with `"@/*"` at `:23`, `"incremental": true` at `:16`,
`include` `:45-54` and `exclude` `["node_modules"]` at `:55`, `vitest.config.mts:6-10` with `@` → `./src/` at `:8`
and `test` at `:11-20`, `eslint.config.mjs` `globalIgnores` at `:10-16`, `scripts/next-target.mjs`'s `:26-30` env
object; the three reader modules carrying `import "server-only"` at `:1` **and** `connection` from `next/server` at
`:3` (`adult-portal-server.ts`, `player-access-server.ts`, `game-events-server.ts`), which with step 10's
`react-server`/`default` split is what justifies **two** generated entries rather than one (§7.2a,
`COMPAT-POLICY` §3 C-4); `adult-portal-server-client.ts:3,7,11` (each a genuine no-op — `return null`,
`void profileId`, `{}` — with no directive); `adult-portal-demo-store.ts:347`; `adult-portal-demo.ts:15-21` (two
non-`async` functions returning service promises); `PortalMutation` at `adult-portal-form.tsx:11-14`; 33 files in
`tests/unit`; `.next-demo-dev` and `out/` both on disk; `prisma.config.ts` 12 lines.

**Corroborated, not re-litigated** (right first time, so unquoted elsewhere here): `run-script.js:121-122`, `grep
-c` printing `0` while exiting 1, `Neon` ×2 in demo copy, the wrong `tokens.ts` dependent, the webpack/Turbopack
layer, and the `95/23/107/34`, `24 in 23`, `11+12`, `99`, `17/17`, `104`, `33`, 7-`vi.mock` figures.

**Divergences from the dossier (code wins).** Only the delta is booked here; the command, its measured output and
the fix live in the step named — as do this file's own self-corrections, which are recorded in place and not
re-listed.

| §-ref | dossier / plan says | code says | lands in |
| :-- | :-- | :-- | :-- |
| §3.1 item 1 (`REFACTOR_PLAN.md:126`) | `scripts/next-target.mjs` is the generator still to be created, and it writes a gitignored `target.ts` before spawning `next` | the tracked 70-line script writes nothing and has no `node:fs`; no npm hook fires for it; `src/runtime/target.ts` is neither present nor ignored; and plan §3.1 item 5's alias deletion had **no owner** | steps 5, 7 |
| §7.1 | the gate fires on manifest membership | the `output === 'export'` co-condition makes E625 a **demo-target-only** test (chain once, in *Evidence*), and the on-disk **server** manifest holds 17 `server-action` ids without ever throwing — the guard is "demo must keep registering 0", not "the manifest must be empty". That manifest is also **untracked build output** (`git ls-files \| grep server-reference` → nothing) yet `require`d at `:359`, so a demo build emitting *no* manifest is itself a failure mode | Entry gate, step 4 |
| §7.2(d) | "4 surviving call sites" | that counts 3 action modules plus the route-handler *group*; file-level truth is **7 files / 7 statements** — dossier 4, this file's first 8, measured **7** | step 9 |
| §7.2(a) | zero of the 15 readers is client-imported, implying a small client surface | true — all 11 reader specifiers are in `src/app`, and the 11 client files import only `adult-portal-actions` (6) / `adult-portal-client` (2) / `player-entry-action` (2) / `player-access-actions` (1), while `use-demo-portal.ts:6` imports the **bridge** `loadClientPortalState`. But **11** files under `src/components` already carry `"use client"` *and* import a `@runtime/*` specifier: 11 real fence candidates, not hypothetical ones. The 15 there are **module exports**; the fence quantity is the **11 specifiers** in **10** files, and the `generateStaticParams` group is **4**, not 3 | step 10, Interfaces |
| §7.2(c) | reach for a core ESLint rule | right tool (no `eslint-plugin-import`), but `eslint.config.mjs` has **no** rules block to edit, and the block **must carry a `files:` scope** — unscoped, it bans the 11 `src/app` Server Component reader imports §7.2(a) explicitly permits, so the fence as specified is **unsatisfiable against the design step 7 mandates** | step 10 |
| §7.2's "9 → 0" | asserted by a `0 @runtime/*` gate | all 18 alias declarations (`next.config.ts:44-79` + `tsconfig.json:24-42`) live outside `src`, so a `src`-scoped grep reaches 0 on step 7 alone and stays 0 whatever the configs hold — the clause this file nominated as "the one that genuinely discriminates" was ungated | Exit gate rows 1-2 |
| §7.5 | "no test can import the seam today" | 6 files / 9 statements already import `src/runtime/` with the suite green, every one via the generic `@/runtime/<concrete file>` path (`tsconfig.json:23`) and **0** via the seam alias: the tests *bypass* the seam and pin demo implementations, which no `resolve.alias` block fixes | step 11 |
| §7 / step 6 | two ignore files cover prettier and ESLint | **Prettier reads `.gitignore`, ESLint reads neither**, so the generated files need a `globalIgnores` entry that neither the plan nor §7 mentions | step 6 |
| D-1, cross-phase read | "(a) makes this file's first Exit gate and `phases/50` G6 mutually unsatisfiable" | the pairing does not hold: under (a) both count the same deletion and go to 0 together; the branch-stranded gates are this file's `tsconfig.demo.json` row under (a) and G6 under (b), and the alias deletion was unowned. `RV-X` reached the right conclusion through arithmetic that does not | Decision points |

**Divergences from `RV-30` / `RV-X` themselves (re-measurement wins).** Four claims did not survive a second pass
and are **not** propagated into this file:

1. **"`next.config.ts` has 18 `@runtime` mentions"** (`RV-30` row 33, repeated in the tasking). Measured:
   `grep -c '@runtime' next.config.ts` → **9** (`grep -o` → 9 occurrences), keys at `:44, :48, :52, :56, :60, :64,
   :68, :72, :76` only — every alias value sits on its own line *without* the `@runtime` text — and
   `tsconfig.json` carries the other 9 (`:24-42`), so 18 is the **sum of both files**, which is how `phases/50`'s
   G6 row already states it ("today `9`, `9`"). The *finding* (a `src`-scoped gate cannot see the configs) is right
   and is applied (Divergence 8); the number attached to it is not.
2. **`server-only` module sub-breakdown** (`RV-30` row 20: "runtime 3, `server/auth` 2, `server/db` 8,
   `server/http` 3, `server/services` 4"). The total, **20**, reproduces exactly; the split does not —
   `server/db` holds **7** and `server/services` **5**, which is the split Scope uses.
3. **"`package.json:7`" for the npm pin.** Both readings are true and step 5 states them together: `:7` is the
   engines range `>=11.6.0 <12`, `:9` is `"packageManager": "npm@11.6.0"`; the scripts block spans `:10-27`
   (keys `:11-26`), the span used throughout.
4. **"102 `typeof import` refs across the three validators"** (carried in the tasking): no such figure appears
   here, and it does not hold — the counts are step 1's, **44 / 44 / 44** = **132** refs, **21** per copy naming
   §2.2's seven trees ⇒ **63**.

`RV-X` §2's *"D-1 = (a) makes this file's first Exit gate and `phases/50` G6 mutually unsatisfiable"* is refuted by
Decision points — under (a) both go to 0 together because both count the same deletion — yet `RV-X`'s **conclusion**
(D-1 cannot be left unmade; the alias deletion was under-owned) stands.
