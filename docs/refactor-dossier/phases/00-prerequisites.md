# Phase 00 — Prerequisites and CI lockdown

**Goal.** Make the repo's four gates falsifiable and put them in CI *before* any refactor commit exists, so that every later phase's "check green" exit criterion actually means something.

**Depends on.** Nothing — this is the first phase. It does require dossier §3 decision **D-7 = (a)** (fix `format:check` → land `ci.yml` → then branch protection, in that order) and the compatibility policy decision; three steps below are tagged `COMPAT` for it.

**Blocks.** **P1** (purge), **P1b** (schema/migration), **P2** (seam), **P3** (decomposition), **P4** (gates/docs). §10.1's hard edges are all born here: `0.1 → 0.4 → everything`, `0.2 → a trustworthy baseline`, `0.3 → the CI ordering P1's own typecheck gate depends on`. Concretely, `package.json:24` composes `check` as `format:check && lint && typecheck && test`, and `format:check` is red on `main` today — so every later phase's stated criterion is currently unreachable (§4 item 0.1, §10.3: "without §4 item 0.1 the window is unbounded because the gate can never go green").

**Entry gate.**

- [ ] HEAD is `e5aaf1e` and the tree is clean apart from this folder — `git rev-parse HEAD` → `e5aaf1e…`; `git status --porcelain` → `?? docs/refactor-dossier/` and nothing else.
- [ ] `format:check` is red on exactly one file — `npx prettier --check .` → `[warn] REFACTOR_PLAN.md`, exit 1. *Measured on this tree; if a second file appears, stop and re-record the baseline before proceeding.*
- [ ] `lint` and `typecheck` are green — `npm run lint` → exit 0; `npx tsc -p tsconfig.json --noEmit --incremental false` → exit 0 (~7 s on this machine).
- [ ] The suite is green under parallel isolation — `npx vitest run` → `Test Files 33 passed (33)`, `Tests 284 passed (284)`.
- [ ] There is **no** CI workflow — `git ls-files .github/workflows` → `.github/workflows/deploy.yml` only.
- [ ] All six migrations are tracked (plan §6 Day 0's premise is already done, §4 item 0.5) — `git ls-files prisma/migrations` → 7 paths (`0_init`…`5_v1_game_events` + `migration_lock.toml`).
- [ ] `prisma validate` passes offline — `./node_modules/.bin/prisma validate` → `The schema at prisma\schema.prisma is valid 🚀`.
- [ ] Toolchain matches the pins — `node -v` → `v24.19.0` (`.node-version`, `.nvmrc`, `package.json:6`). **The measurements below were re-taken on Node 22.23.1**, which is what this shell has; the CI leg on 24.19.0 is the authoritative re-record. `[U]` as an *entry* item on the machine this dossier was written on: this bullet fails there, and `phases/20:19` bakes `v22.23.1` into one of *its* expected outputs, so the two files cannot both be right about which runtime produced which number. The pin this phase actually enforces is `node-version-file: .node-version` in `ci.yml`, which is the one that runs; a human should decide once, here, and have the other file cite it.

## Scope

**In scope.** Dossier §4 items 0.1–0.5: the `.prettierignore` one-liner, the order-dependent test, the stateful-gates finding and the CI ordering it forces, the new `.github/workflows/ci.yml`, branch protection on `main`, and discarding the plan's stale Day-0 premise. Plus replacing the unfalsifiable gate §9.1 says `ci.yml` must not inherit — where this phase ended up retiring **two**, because the replacement step 5 first wrote was unfailable in exactly the same way (see that step's first bullet; the audit trail is in it, not under it).

**Out of scope — with owner:**

- Editing `REFACTOR_PLAN.md` in any way, including "just reformat it with Prettier". It is fixed input (README "Why the folder is shaped this way"). Owner: nobody.
- Editing `prisma.config.ts` to add a shadow-database key, or adding any Postgres service container: **nobody owns this, because the leg was deleted.** `COMPAT-POLICY.md` §6 (owner ruling) rejected edit 1 and adopted edits 2/3, which removes the `migrate diff --exit-code` drift gate and its whole prerequisite **with no substitute** — and §6 also invalidates `REFACTOR-DOSSIER.md` §6.5's shadow-DB recipe (`:296-303`, "add both keys there first"), which is where the work used to be booked. This bullet previously read "That belongs with **P1b** (§6.5), where the hand-authored `6_drop_generation_a` migration makes the drift check worth its infrastructure" — **refuted by the ruling**, and step 5 carries the same correction. P1b's `6_drop_generation_a` is hand-authored and gate-free.
- Editing `tsconfig.json` (`src/generated/**` exclude — plan Day 2 line 226) or `next.config.ts` (a dedicated demo `distDir`). Owner: **P2**, which already touches both files.
- Artifact assertions for **post**-purge numbers (26 docs, 0 `@runtime/*` aliases, seam manifests). Owner: **P1**/**P2**; they must update the assertions in the same PR that changes the truth. Step 5 pins today's truth instead. **Read the `ci.yml` ownership blocker under Handoff notes before relying on that sentence** — for the `104 → 26` edit it names an owner that no work order in the owning phase carries, which is an open blocker, not a settled handoff.
- The `server-only` / ESLint-boundary decision (ADJ-03 §F3, §13.2) and CSS/test-infra work. Owner: **P2**/**P3**.

## Work order

### Four tooling traps — reproduce them before you write anything

`ci.yml` and every later phase's commands are shaped by these. Each was re-executed at HEAD against `prisma` 7.9.1 (`./node_modules/.bin/prisma -v` → `prisma : 7.9.1`, `@prisma/client : 7.9.1`).

| # | Trap | Verbatim evidence |
| :-- | :--- | :--- |
| T1 | A bare `npx prisma` that does not resolve the local install installs the registry's `latest`, which is a **Prisma 8 RC** where `migrate` is gone. `npm view prisma version` → an **`8.0.0-rc.*`** — `rc.15` when `AUDIT` recorded this, **`rc.17`** re-measured in this pass — and the exact suffix is not the point: it is a registry-moving literal that will drift again, so no command here may depend on it. `AUDIT` "Commands that will not run" row 6 records the actual failure: *"No command registered for `migrate`, did you mean `migration`?"* | Run Prisma **only** from the repo root or via `./node_modules/.bin/prisma`. A repo *subdirectory* is fine (npm walks up: `cd docs && npx --no-install prisma -v` → `prisma : 7.9.1`, re-run this pass); a scratch tree or a temp dir is **not**. |
| T2 | **No `--shadow-database-url` flag in 7.9.1.** `./node_modules/.bin/prisma migrate diff --help` contains zero occurrences of `shadow` (re-measured: 81 help lines, `grep -ci shadow` → 0); the option list is `--from-schema/--to-schema`, `--from-migrations/--to-migrations`, `--from-config-datasource/--to-config-datasource`, `--from-empty/--to-empty`, `--script`, `-o`, `--exit-code`. Supplying it: `Error: unknown or unexpected option: --shadow-database-url`. | The shadow URL is config-only (`prisma.config.ts` → a `datasource.shadowDatabaseUrl` key, currently absent) — and that key is **never added**, because `COMPAT-POLICY.md` §6 deleted the leg that needed it. |
| T3 | `--from-url` / `--to-url` are **removed** — and gone from `migrate diff --help` with them, which is the half this row used to get wrong: the installed help is 81 lines and holds **0** hits for either flag, and the only `--url` left in it belongs to a *different* command (`db execute --stdin --url="$DATABASE_URL"`, help line 74). `--from-url "postgresql://x:x@localhost:59999/nope"` → ``Error: `--from-url` was removed. Please use `--[from/to]-config-datasource` in combination with a Prisma config file that contains the appropriate datasource instead.``, exit 1. | Any URL must arrive through `prisma.config.ts`, which reads `DIRECT_URL` (`prisma.config.ts:4,11`) and loads `.env` from cwd (`prisma.config.ts:1` `import "dotenv/config"`). **`--to-url` is not an override mechanism.** The trap is that the *error message* still points at a mechanism (`--*-config-datasource`) that needs a `prisma.config.ts` datasource this repo only fills when `DIRECT_URL` is set. ~~(Not recorded in `INV-F`/`AUDIT`; both quote the help examples.)~~ **Struck:** "still appear in the help's own examples" measured 0 hits — an inference from the reports rather than a reading of the tool, and the reports cite a help text that no longer prints them. |
| T4 | **Both build targets write the same `.next`.** `next.config.ts:26-28` gives `distDir: ".next-demo-dev"` only for `PHASE_DEVELOPMENT_SERVER`; a demo *build* uses the default. Proof on this tree right now: `.next/server/server-reference-manifest.json` holds **17** ids and `.next/app-path-routes-manifest.json` lists the 4 `/api/v1/player/*` handlers — i.e. `.next` currently belongs to the **server** build, so the demo action read **reports 17** against it and the server-side assertion would pass for the wrong reason. The assertion set is order-sensitive in the red direction, not just the green one. | Every manifest read must be immediately after the build that wrote it, with no other build in between. Compare `.next/BUILD_ID` (present: `E7B1icx1I4_iMk6hNNHSJ`); `out/BUILD_ID` **does not exist**. |

Related and equally load-bearing: `next.config.ts:5-7` parses `APP_RUNTIME_MODE` **unconditionally**, before the server-only block — so bare `next build` aborts on config load. Always invoke the npm wrappers: `scripts/next-target.mjs:26-30` sets the mode from its `demo|server` argument (the variable itself at `:28`), `:39` pins `AUTH_DEV_BYPASS=false` for a server build, `:41-53` blanks the seven server vars for demo, and `:24` reads a local `.env` (`INV-F` §7.3's false-positive warning).

### 1. Branch

`git switch -c chore/phase-00-prerequisites` from `main` at `e5aaf1e`. One PR for the whole phase; steps 2 and 3 are separable commits inside it.
**Verify:** `git log --oneline -1` → `e5aaf1e docs: record architecture audit…`.
**If it fails:** you branched off something else — later phases' baselines are quoted against `e5aaf1e` and become uncomparable.

### 2. Item 0.1 — stop `format:check` being born red

File: `.prettierignore` (8 lines today: `.next`, `node_modules`, `src/generated`, `package-lock.json`, `contracts`, `docs`, `portal-v1-specification.md`, `prisma/schema.prisma`). Append one line, `REFACTOR_PLAN.md`.

Chosen over `prettier --write REFACTOR_PLAN.md` because the plan is fixed input and reformatting it *is* editing it; the file already carries seven precedents for "not hand-policed prose/generated output". No compat question arises here — this step removes a pre-existing failure rather than preserving behavior.
**Verify:** `npx prettier --check .` → `All matched files use Prettier code style!`, exit **0**. `[S]` — the *post-edit* green has never been observed by a verifying agent: appending to `.prettierignore` is a write, and the safe-looking simulation was tried and **rejected** (`--ignore-path <scratch file>` mis-anchors the other patterns, because prettier resolves ignore patterns relative to the ignore file, which turns the run into 388 warnings including `src/generated/**`). What *is* established is that the gate is not vacuous: the pre-state is provably red (one offender, exit 1) and the ignore mechanism is demonstrated by `.prettierignore:7`, a root-level `.md` that the same command already skips.
**If it fails:** another file has drifted since the entry gate. Fix that file with `npx prettier --write <file>` and inspect the diff — do **not** extend `.prettierignore` to cover it; ignoring source is how `format:check` stops being a gate again.

### 3. Item 0.2 — fix the order-dependent test

File: `tests/unit/auth.test.ts:161-165`. The `afterEach` inside the last `describe` (`:158-189`) **deletes** three variables instead of restoring them: `AUTH_DEV_BYPASS` (`:162`), `APP_RUNTIME_MODE` (`:163`), `NODE_ENV` (`:164`). `vitest.config.mts:13-15` injects `APP_RUNTIME_MODE="demo"`, nothing re-sets it, and this is the last mutation in the file — so every later file in the same worker sees it undefined. *(§4 item 0.2 cites the injection as `:12-14`; `:12` is `environment: "node"`.)*

Minimal repro (2 files, 0.3 s) — replace the deletes with the snapshot-and-restore pattern that **already exists twice in this repo** (`auth.test.ts:21-40`, `tests/unit/portal-dev-bypass-actions.test.ts:44-59`):

```ts
  const trackedKeys = ["AUTH_DEV_BYPASS", "APP_RUNTIME_MODE", "NODE_ENV"] as const;
  const baseline = Object.fromEntries(trackedKeys.map((k) => [k, process.env[k]]));

  afterEach(() => {
    for (const key of trackedKeys) {
      const value = baseline[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
```

Do **not** instead delete `env.APP_RUNTIME_MODE` from `vitest.config.mts:13-15`. The reason this file first gave was inflated and is corrected here: it said "32 other test files resolve the demo variant through it", counting *files in the suite other than the two named*, not files that read the mode. Measured by walking the import graph from all 33 test files (own resolver: `@/`→`src/`, `@runtime/*`→ both variants, dynamic `import()` and `export * from` followed): **10 of 33** transitively reach `src/runtime/mode.ts` — `auth`, `env`, `game-event-ingestion`, `game-state-prisma`, `neon-auth-gateway`, `player-access-actions`, `player-access-prisma`, `portal-dev-bypass-actions`, `portal-dev-bypass`, `runtime-mode`. And **0** test files import `@runtime/*` at all (`grep -rn 'from "@runtime/' tests` → 0; all 24 such statements are in `src`). So removing the injection would red ~10 files, not 32 — and it must still stay, because those 10 are the entire demo-side signal the suite has. <!-- COMPAT: the vitest-level `APP_RUNTIME_MODE=demo` injection, which keeps every existing test file pointed at the demo alias target. -->
**Verify (targeted):** `npx vitest run --no-isolate --fileParallelism=false tests/unit/auth.test.ts tests/unit/portal-dev-bypass.test.ts` → before the fix `Test Files 1 failed | 1 passed (2)`, `Tests 14 passed (14)`; after it, `Test Files 2 passed (2)`, `Tests 16 passed (16)`, exit **0**. The arithmetic is checkable without a runner (`[V]` on the mechanism): `grep -c "  it(" tests/unit/auth.test.ts` → 14, `…/portal-dev-bypass.test.ts` → 2, and `Tests 14 passed (14)` with a *failing* file is correct output rather than a typo — the bleed throws at import time, so that file contributes 0 counted tests.
**Verify (whole suite):** `npx vitest run --no-isolate --fileParallelism=false` → `Test Files 33 passed (33)`, `Tests 284 passed (284)`, exit 0. Then `npx vitest run` → same 33/284. The contract is *serial equals parallel*. `[S]` on both counts: the file count reproduces statically (`find tests -name '*.test.ts'` → 33) and 284 is a `it.each` expansion (229 static cases + 55 from 5 `.each` sites, per `RV-X` N2/N3), but no verifying pass in this pipeline has been allowed to run vitest, so nobody has re-observed the number.
**If it fails:** a `ZodError … invalid_value … path: []` at `src/runtime/mode.ts:10` (via `isDemoRuntime`, `mode.ts:16`) means another file bleeds the variable — find it with `grep -rn "delete process.env" tests` and apply the same restore pattern. Note `--no-isolate` **alone** does not reproduce this; `--fileParallelism=false` is what makes the claim hold, exactly as `ADJ` §"Commands that will not run" row 3 required. `[S]` — that A/B (`npx vitest run --no-isolate` → 33/284, exit 0) was reported as "measured" here, and the measuring pass was the dossier's own, not this one: this session could not run the suite, and the two flags were confirmed only by the installed `vitest --help` (`:46 --isolate … use --no-isolate`, `:53 --fileParallelism … use --no-file-parallelism`), i.e. both spellings parse and both are real.

Be honest about what is broken today: `tests/unit/portal-dev-bypass.test.ts` has **2** tests and passes in isolation, so the bleed does not merely redden the run — it silently **removes 2 cases from the count** (282 vs 284). Plan §6 Day 0 line 211 asks you to "record baseline gates (test counts)", and a count-only baseline would record 282 and never notice. Worse, the two files that surface this (`portal-dev-bypass.test.ts` via `src/server/services/portal-view-service.ts:7`, and `portal-dev-bypass-actions.test.ts` via `src/app/(professional)/portal/atividades/actions`) are both in P1's deletion set, so the symptom **vanishes after the purge while the defect stays**. Land this here.

### 4. Item 0.3 — record what the gates actually depend on

No repo edits; this step produces the numbers and the ordering rule that step 5 encodes.

- **`typecheck` is stateful in three independent ways, and only one of them blocks anything.**
  1. *Generated Prisma client:* `.gitignore:27` ignores `/src/generated/prisma` and `git ls-files src/generated` returns **0** files, yet 47 first-party files import from it (`grep -rln "@/generated" src tests` → 47: 34 under `src`, 13 under `tests`, 0 inside `src/generated` itself), and `prisma/schema.prisma:1-4` emits it at `../src/generated/prisma`. It is supplied by `postinstall → prisma generate` (`package.json:26`). **Never run `npm ci --ignore-scripts`**; typecheck would die with ~47 `TS2307`s. *(The "48" this file carried was off by one and is corrected here, not softly rounded; `phases/50`'s "~48" survives on the tilde.)*
  2. *Incremental cache:* `package.json:20` is a bare `tsc --noEmit` while `tsconfig.json:16` sets `incremental: true`, caching to `tsconfig.tsbuildinfo` (gitignored, `.gitignore:19`). Measured: `--incremental false` 6.8 s vs bare `npm run typecheck` 2.7 s on the same tree. **CI keeps `--incremental false` to match the recorded baseline, not to dodge a stale cache — on a fresh runner there is no stale cache to dodge.** `tsconfig.tsbuildinfo` is neither committed nor cached (`setup-node`'s `cache: npm` caches npm only), so the CI leg can only ever be cold. The real exposure is the **local** gate, which this file writes twice: `npm run check` runs `npm run typecheck`, i.e. bare `tsc --noEmit` against your own warm buildinfo — present on this machine at 356,779 bytes. Next's own build typecheck is a *separate* cache (`runTypeCheckCli.js:33-35` passes `--tsBuildInfoFile <cacheDir>/.tsbuildinfo`, and `.next/cache/.tsbuildinfo` is here too at 363,617 bytes, same minute), so a warm root buildinfo can only have come from a bare `tsc`. **Remedy: `rm -f tsconfig.tsbuildinfo` before any local `npm run check` that is meant to prove something** — booked in step 5's **Verify** and in the Exit gate, not in `package.json`. Do not change `package.json:20`. <!-- COMPAT: the `typecheck` script's exact text, which P1–P4 all cite verbatim in their own gates. -->
  3. *Route validators:* `next-env.d.ts:3-4` imports `.next/types/routes.d.ts` and `root-params.d.ts`; `tsconfig.json:45-54` additionally globs `.next/types/**/*.ts`, `.next/dev/types/**/*.ts`, `.next-demo-dev/types/**/*.ts`, `.next-demo-dev/dev/types/**/*.ts`, and `exclude` is only `["node_modules"]` (`:55`) — an explicit `exclude` replaces TypeScript's defaults, so nothing is dropped. Program membership measured with `npx tsc -p tsconfig.json --noEmit --incremental false --listFilesOnly`: **1,706 files, 12 of them under `.next`/`.next-demo-dev`** (3 dirs × `routes`/`root-params`/`cache-life`/`validator`), 24 under `src/generated`. Note `.next-demo-dev/types/` **does not exist** (`ls .next-demo-dev` → `dev`), so the `:52` glob contributes 0 of the 12; and `.gitignore:5-6` ignore both trees, so none of the 12 exists on a fresh checkout.
- **It does pass on a fresh clone** `[V]` — `skipLibCheck: true` (`tsconfig.json:6`) makes `next-env.d.ts`'s dangling imports inert (§4 item 0.3 / `ADJ-03` §F1 as corrected by `AUDIT` B1). Second source, since the clone itself was never re-run: the mechanism was rebuilt in a scratch project outside the repo with *this repo's* `tsc` 6.0.3 — an `env.d.ts` with two side-effect imports of non-existent `./missing/*.d.ts` → `skipLibCheck: true` exit **0**, `skipLibCheck: false` exit **2** with `TS2882` ×2, which is the dossier's own A/B reproduced. So **do not present the compile step as unblocking**; it is a *coverage* step.
- **After P1's §2.2 route deletions the stale validators go actively wrong — but not one per copy, and not all three at once.** Each of the three `validator.ts` copies (448 lines, 44 `typeof import(` refs) points at **21** files inside plan §2.2's seven deleted trees, not 20 — the extra one is `(public-play)/atividade/[token]/layout.js`, a **layout**, which every prior page-only sweep missed. 3 × 21 = **63** is what a tree that has run both dev servers *and* a build reports, not "up to 60 (reproduced exactly)" (§4 item 0.3, `ADV-1` row 1, `ADV-3` table). Two sharpenings the original sentence lacked:
  *The 21 are not errors today.* Each ref is `typeof import("../../src/app/…/page.js")` while the file on disk is `page.tsx`, and `moduleResolution: "bundler"` maps `.js` → `.ts`/`.tsx`, so all 21 resolve and `tsc` exits 0 on this tree. They become 21 false `TS2307`s only in the window where the source is deleted and the validator has not been regenerated.
  Reproduce (per copy, and swap the path for the other two):
  `node -e "const t=require('fs').readFileSync('.next/types/validator.ts','utf8');const r=[...t.matchAll(/typeof import\(\"([^\"]+)\"\)/g)].map(m=>m[1]);const k=['/portal/atividades/','/portal/materiais/','/portal/modulos/','/portal/admin/jogos/','/portal/admin/modulos/','/portal/admin/auditoria/','/atividade/[token]/'];console.log(r.length, r.filter(p=>k.some(x=>p.includes(x))).length)"` → `44 21`, and identically for `.next/dev/types/validator.ts` and `.next-demo-dev/dev/types/validator.ts`.
- **The remedy this file used to give fixes none of it, and the refutation that "corrected" it to a third was also wrong.** `[V]` — measured from the installed source and the tree's own mtimes. Retained because it is the claim a reader would otherwise re-derive:
  - *This file said:* "delete routes → run the **server** compile to regenerate `.next/types/validator.ts` → *then* typecheck", clearing **63**. It clears **one** file. `node_modules/next/dist/build/index.js:804` is `validatorFilePath = path.join(distDir, 'types', 'validator.ts')` — a single path, and `build:server`'s `distDir` is `.next`. Nothing writes the two `dev/types` copies; only `next dev` does. The tree says so directly: `.next/types/validator.ts` `2026-09-23 02:05:42`, ten seconds before `.next/BUILD_ID` `02:05:52` of the same build, against `.next/dev/types/validator.ts` `2026-09-22 22:21:21` and `.next-demo-dev/dev/types/validator.ts` `2026-09-22 23:04:36` — 3 h 44 min and 3 h 01 min older, untouched by it. So ordering cleared **21 of 63** at best.
  - *The refutation's replacement said:* the remaining 42 survive because "Next *deliberately excludes* them from its own typecheck", citing `lib/typescript/runTypeCheck.js:31-34` ("During build, we filter out `.next/dev/types` files …"). **That filter is on the code path this project does not take.** `runTypeCheck` is reached only when `experimental.useTypeScriptCli` is false; the shipped default is `useTypeScriptCli: true` (`node_modules/next/dist/server/config-shared.js:257`, and `docs/…/01-next-config-js/useTypeScriptCli.md:7,27` — "By default, `next build` runs the project-local `tsc` command"; `next.config.ts` sets no `experimental` key), so `verify-typescript-setup.js:207-218` takes the **CLI** branch and `runTypeCheckCli.js:26-32` spawns plain `tsc --project <tsconfig> --noEmit` with **no** file filter at all.
  - *Which makes the ordering remedy worth less than the refutation thought, not more:* `build/index.js:1068-1073` runs that project-wide `tsc` **inside** `build:server`, before the step ever reaches a `typecheck` line. On a dirty workstation the 42 therefore red the **build**, not the typecheck — so "run the build first" cannot be the remedy for a stale tree; the stale tree is what stops the build.
  - *The correct remedy is deletion, not order.* `rm -rf .next/types .next/dev .next-demo-dev` and let the build write exactly one validator set. `phases/50` step 3 books that as a `ci.yml` step, and this file deliberately does **not** copy it: on a fresh runner it is a no-op (nothing under `.next` exists — `.gitignore:5-6`), so it belongs to the local runbook above. If it is ever added to the workflow, it is Phase 50's insertion, not a second copy here.
  - **Ceiling:** **63 is a dirty-workstation number and is unreachable in CI.** On a fresh checkout the two dev trees do not exist, so the exposure is 21, and `build:server` regenerates those 21 away before anything reads them. The step order in `ci.yml` is load-bearing for the **manifest reads** (T4), not for the typecheck; it was sold as both.
- **`next build` typechecks but no longer lints.** `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/typescript.md:13,23` → `ignoreBuildErrors` defaults `false`. But `…/01-app/02-guides/upgrading/version-16.md:1084` → "The `next lint` command has been removed … **`next build` no longer runs linting.**" This **refutes** `INV-F`'s "ESLint runs during build too": `npm run lint` is the only lint signal in the pipeline, so its step is mandatory, not a convenience. The other half of the same sentence is the one this file understated: `next build` type-checks *the whole project* (`config-shared.js:257` → project `tsc` CLI, no filter), so a PR with both builds runs `tsc` **three times** — inside `build:server`, in the explicit `typecheck` step, and inside `build:demo`. The named step is there to be read, not to be the only type leg.

### 5. Item 0.4 — write `.github/workflows/ci.yml` (new file)

Create exactly one file. Triggers `pull_request` + `push: branches: [main]` + `workflow_dispatch`; `permissions: contents: read` **only** (`pages: write` / `id-token: write` must not be copied from `deploy.yml:8-11` — only `deploy.yml` publishes, `INV-F` §CI design). `node-version-file: .node-version` instead of the literal duplicated at `deploy.yml:27`.

The block below is **valid YAML and the complete file body** — it was parsed with the repository's own `js-yaml` before being written in, because the sketch it replaces was not parseable at all. It is still a *proposal*, not a repo edit: this phase's brief is that the file is created in the phase PR, and `phases/50` documents it once it exists (that file is bound by this one's P4 handoff: describe, never re-propose). It is fenced as `yaml`, not `text`, so that the fence is the artifact and the parser is the check.

**Refuted, and this is what was wrong with it:** the previous version of this block was fenced as `yaml` and was not. Parsed with the repo's own loader it died at the first pseudo-step — `YAMLException: bad indentation of a mapping entry (7:76)`, where extracted line 7 is the old `- checkout@v4; setup-node@v4 (…)` — and structural inspection of the same 27 lines found **no `name:`, no `on:`, no `runs-on:` and exactly one real `uses:`** (`actions/upload-artifact@v4`). The step said "Create exactly one file", so as printed it reduced to "invent the workflow yourself", runner OS included. **That failure is recorded, not reproducible:** the fix occupies the same fence, so the command below prints `PARSE OK` against this file. The parser's message and the structural findings (27 lines, one `uses:`, no `name:`/`on:`/`runs-on:`) are held in `RV-00` row 33 and "What this phase would have gotten wrong" item 1; `RV-00` does **not** reprint the broken block, so there is no longer a copy of it anywhere in this repository to re-run the loader against.

**Verify (this block parses, and parses into the shape GitHub needs — run from the repo root; it extracts the fence from this file's own finished text, not from a hand-copied variant):**

```bash
node -e 'const yaml=require("js-yaml"),fs=require("fs");const b=fs.readFileSync("docs/refactor-dossier/phases/00-prerequisites.md","utf8").match(/```yaml\n([\s\S]*?)\n```/)[1];const d=yaml.load(b);const s=d.jobs.gates.steps;console.log("PARSE OK");console.log("name="+d.name+" | on="+Object.keys(d.on).join(",")+" | permissions="+JSON.stringify(d.permissions)+" | job="+Object.keys(d.jobs)+" | runs-on="+d.jobs.gates["runs-on"]);console.log("steps="+s.length+" uses="+s.filter(x=>x.uses).length+" run="+s.filter(x=>x.run!==undefined).length+" node-version-file="+s[1].with["node-version-file"])'
```

→ measured output of the command above, run against the finished text of this file:

```text
PARSE OK
name=CI | on=pull_request,push,workflow_dispatch | permissions={"contents":"read"} | job=gates | runs-on=ubuntu-latest
steps=17 uses=3 run=14 node-version-file=.node-version
```

```yaml
# PROPOSAL — this is the whole content of the one file step 5 creates. It is printed here as a
# proposal, not written into the repo: `phases/50` documents `ci.yml` once it exists.
#
# ORDER IS LOAD-BEARING: both build targets write the same .next (next.config.ts:26-28 gives
# distDir only to demo DEV), so every manifest read below sits immediately after the build that
# produced it. Do not parallelise, and never move a `node -e` read away from the build above it.
#
# The four tooling traps live here as well as in the phase file, because CI is where they bite.
#   T1  Run Prisma only via ./node_modules/.bin or from the repo root. A bare `npx prisma` that
#       misses the local install resolves the registry latest, an 8.0.0-rc.* with no `migrate`.
#   T2  Prisma 7.9.1 has no shadow-URL command-line flag; the shadow URL exists only as a config
#       key, and this workflow configures neither (see the drift-leg note in step 5's prose).
#   T3  --from-url and --to-url were removed from the CLI; a URL can only arrive through
#       prisma.config.ts, which reads DIRECT_URL and loads .env silently from cwd.
#   T4  Both build targets write the same .next — the banner above, and the reason the two
#       manifest reads are split across the two builds instead of grouped.
#   And:  pages: write and id-token: write from deploy.yml:8-11 are NOT inherited. That sentence
#       is prose, and the exit gate asserts on YAML mapping keys only, so it cannot red this file.
name: CI

on:
  pull_request:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  # The job key IS the required-check name: step 7 pins
  # required_status_checks.checks: [{context: "gates"}]. A job-level `name:` would rename the
  # check and silently un-bind branch protection.
  gates:
    runs-on: ubuntu-latest
    env:
      # next.config.ts:5-7 parses APP_RUNTIME_MODE unconditionally, so every build goes through
      # the npm wrappers (scripts/next-target.mjs:26-30) and never a bare `next build`. The four
      # server vars satisfy next.config.ts:12-19 (two .url(), two .min(32)) and reach no database:
      # src/server/db/client.ts constructs lazily. Valid-but-unreachable is the design.
      DATABASE_URL: postgresql://ci:ci@127.0.0.1:54325/ci?sslmode=require
      NEON_AUTH_BASE_URL: https://ci.invalid.example
      NEON_AUTH_COOKIE_SECRET: abcdefghijklmnopqrstuvwxyz0123456789ABCD
      APPLICATION_SECRET: ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789wxyz
      AUTH_DEV_BYPASS: "false"
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version-file: .node-version
          cache: npm

      - name: Install
        run: npm ci  # postinstall supplies the generated client (package.json:26); NEVER --ignore-scripts

      - name: Format check
        run: npm run format:check  # step 2 must have landed or this leg is born red (D-7)

      - name: Lint
        run: npm run lint  # the only lint signal: next build no longer lints (version-16.md:1084)

      - name: Validate the schema
        run: ./node_modules/.bin/prisma validate  # T1, and the only schema check this pipeline has

      - name: Build the server target
        run: npm run build:server  # tsconfig.json:24-42 maps all nine @runtime paths at the server files

      - name: Assert the route handlers are registered
        run: |
          node -e 'const r=require("./.next/app-path-routes-manifest.json");const want=["/api/v1/player/active-time/route","/api/v1/player/bootstrap/route","/api/v1/player/results/route","/api/v1/player/state/route"];const miss=want.filter(k=>!(k in r));if(miss.length)throw new Error("route handlers missing: "+miss)'

      - name: Assert the 17 server-action ids
        run: |
          node -e 'const m=require("./.next/server/server-reference-manifest.json");const ids=[...Object.keys(m.node||{}),...Object.keys(m.edge||{})];const a=ids.filter(i=>(parseInt(i.slice(0,2),16)>>7&1)===0);if(a.length!==17)throw new Error("server actions "+a.length+", expected 17")'

      # --incremental false: tsconfig.json:16 is on. A fresh runner has no tsconfig.tsbuildinfo to
      # be stale (it is gitignored, .gitignore:19, and setup-node caches npm only), so the flag buys
      # comparability with the recorded baseline, not safety. The warm-cache hazard is LOCAL; see
      # step 5's Verify, which deletes the file before running npm run check.
      - name: Typecheck
        run: npx tsc -p tsconfig.json --noEmit --incremental false

      - name: Test
        run: npm test

      - name: Test serially
        run: npx vitest run --no-isolate --fileParallelism=false  # step 3 must have landed; both flags

      - name: Build the demo target
        run: npm run build:demo  # LAST writer of .next, and the real server-action gate (E625)

      # Informational, NOT a gate: next/dist/export/index.js:375-385 already threw E625 during the
      # build above if any id in that manifest were a server action, so this can only read 0.
      - name: Report the demo action count
        run: |
          node -e 'const m=require("./.next/server/server-reference-manifest.json");const ids=[...Object.keys(m.node||{}),...Object.keys(m.edge||{})];const a=ids.filter(i=>(parseInt(i.slice(0,2),16)>>7&1)===0);console.log("demo server-action ids: "+a.length+(a.length?" (E625-risk: "+a.map(i=>m.node[i].filename).join(", ")+")":""))'

      - name: Note the dropped route handlers
        run: echo "output export drops route handlers, so out/api does not exist and never will; plan Day 4 line 236 was unfailable and is retired (9.1 row 1)"

      - name: Assert the export census
        run: |
          node -e 'const fs=require("fs"),p=require("path");const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(p.join(d,e.name)):(e.name.endsWith(".html")?[1]:[]));const n=walk("out").length;if(n!==104){console.error("export docs "+n+", expected 104");process.exit(1)}  // PHASE-1: 26'

      - name: Upload the export
        uses: actions/upload-artifact@v4
        with:
          name: demo-export
          path: out
          retention-days: 7
```

**Ten constraints on that text come from *other* phases' greps of the same filename, and breaking one reds an exit gate this phase does not own** — which is the same hazard class as the `ci.yml` ownership blocker under Handoff notes, arriving from the other direction. `phases/20` step 9 asserts `grep -n "migrate diff\|shadowDatabaseUrl\|SHADOW_DATABASE_URL\|services:" .github/workflows/ci.yml` → **no output** and `grep -c "prisma validate"` → **1**, so trap **T2 is worded as prose about a "shadow-URL flag" rather than by the config key's name**; `phases/50` step 2 asserts `expected 17` on 1 line, `out/api` on 1 line (its own diff deletes it), and no `process.exit` on any `E625-risk` line; and `phases/50`'s rewritten G12 wants a `run:` line per `check` leg plus `! grep -qE '^[[:space:]]*(pages:|id-token:)'`, which is *stricter* than the positive-and-negative pair in the Exit gate — the block is written to satisfy the stricter form, so its comments name the two Pages permissions in prose and never as mapping keys.

**Verify (all ten, against the fence extracted from this file — not against a copy; no artifact left behind, so it is safe to run in the repo root):**

```bash
node -e 'const fs=require("fs"),yaml=require("js-yaml");const b=fs.readFileSync("docs/refactor-dossier/phases/00-prerequisites.md","utf8").match(/```yaml\n([\s\S]*?)\n```/)[1];const d=yaml.load(b);const L=b.split("\n");const g=(re)=>L.filter(x=>re.test(x)).length;const legs=["format:check","lint","typecheck","test"].filter(l=>L.some(x=>new RegExp("^[ \\t]*(-[ \\t]+)?run:[^#]*(npm run "+l+"|npm "+l+"|tsc -p tsconfig\\.json|vitest run|npm run check)").test(x))).length;console.log("reparse="+d.jobs.gates["runs-on"]+" steps="+d.jobs.gates.steps.length+" legs="+legs+"/4 pagesOrIdTokenKeys="+g(/^[ \t]*(pages:|id-token:)/)+" prismaValidate="+g(/prisma validate/)+" expected17="+g(/expected 17/)+" outApi="+g(/out\/api/)+" forbiddenPrisma="+g(/migrate diff|shadowDatabaseUrl|SHADOW_DATABASE_URL|services:/)+" e625WithExit="+L.filter(x=>x.includes("E625-risk")&&x.includes("process.exit")).length)'
```

→ measured output: `reparse=ubuntu-latest steps=17 legs=4/4 pagesOrIdTokenKeys=0 prismaValidate=1 expected17=1 outApi=1 forbiddenPrisma=0 e625WithExit=0`.

The four `node -e` bodies, verbatim, inline in the workflow (no new repo files). **Three are gates and one is not**, and the fourth has changed shape since this section was first written. Each was re-executed on this tree from the workflow text itself, not from a hand-copied variant:

```bash
# after build:server — route handlers and actions must still be registered. Both GATES.
node -e 'const r=require("./.next/app-path-routes-manifest.json");const want=["/api/v1/player/active-time/route","/api/v1/player/bootstrap/route","/api/v1/player/results/route","/api/v1/player/state/route"];const miss=want.filter(k=>!(k in r));if(miss.length)throw new Error("route handlers missing: "+miss)'
node -e 'const m=require("./.next/server/server-reference-manifest.json");const ids=[...Object.keys(m.node||{}),...Object.keys(m.edge||{})];const a=ids.filter(i=>(parseInt(i.slice(0,2),16)>>7&1)===0);if(a.length!==17)throw new Error("server actions "+a.length+", expected 17")'
# after build:demo — INFORMATIONAL, prints and exits 0. It used to be `if(a.length){…process.exit(1)}`.
node -e 'const m=require("./.next/server/server-reference-manifest.json");const ids=[...Object.keys(m.node||{}),...Object.keys(m.edge||{})];const a=ids.filter(i=>(parseInt(i.slice(0,2),16)>>7&1)===0);console.log("demo server-action ids: "+a.length+(a.length?" (E625-risk: "+a.map(i=>m.node[i].filename).join(", ")+")":""))'
# count-only. There is no expected-path list in this body and none is booked; see the row below.
node -e 'const fs=require("fs"),p=require("path");const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(p.join(d,e.name)):(e.name.endsWith(".html")?[1]:[]));const n=walk("out").length;if(n!==104){console.error("export docs "+n+", expected 104");process.exit(1)}  // PHASE-1: 26'
```

**Verify (bodies):** run all four against this tree → `exit 0 / exit 0 / "demo server-action ids: 17 (E625-risk: …)" and exit 0 / exit 0`. Bodies 1, 2 and 4 pass because `.next` here belongs to the last `build:server` (T4). Body 3 now *reports* 17 instead of failing on it, which is the whole point of the demotion: the same manifest, the same predicate, the opposite verdict, and it proves the step is no longer a gate.
**Refuted here, not in a footnote:** this section used to say all four "were executed here; bodies 1, 2 and 4 pass … and body 3 fails with 17" and to present body 3 as the gate §9.1 chose to replace the retired one. Body 3 **could not fail in CI**. See "Assertions that can actually fail" below for the measurement.
**MISSING, and the honest fix:** the skeleton's `…assert out/ has 104 *.html **and the expected paths**…` promised a path assertion that was never in the body, and this file's P1 handoff told Phase 1 to edit "the expected-path list to §11.1's 26 routes" — a list that does not exist in either file. `REFACTOR-DOSSIER.md:590`/§11.1 is a prose checklist of route *patterns* (`/portal/resultados/<classId>`, `/portal/admin/organizacoes/<id>`, and the pseudo-route `/jogar?cred=<seed>`, which is a query string on an existing document and not a document at all), not 26 paths. The phantom reference is struck rather than invented: a count-only census also passes if a purge deletes 78 documents and a refactor adds 78 different ones, and that limitation is recorded below instead of papered over. If a path list is ever wanted, derive it mechanically at the moment the truth changes — `find out -name '*.html' | sed 's|^out||; s|/index\.html$|/|' | sort` — and paste the 26 literals; do **not** transcribe §11.1.

Three divergences from §9.2's design, each deliberate. The first two are ordering changes and both preserve §9.2's one hard rule (the demo manifest assertion immediately follows `build:demo`):

1. The compile immediately before `typecheck` is the **server** one, not "a compile", so the regenerated validator and the two manifests describe the same tree `tsc` is about to read. `tsconfig.json:24-42` maps all nine `@runtime/*` paths to the server files unconditionally, and the step doubles as the route-handler assertion. §9.2 put `build:server` last, which leaves `typecheck` reading whatever the demo build left. **Scope limit, added after the refutation:** this orders the *reads*; it is not what makes the type leg correct. `next build` runs its own project-wide typecheck (`build/index.js:1068-1073` calls `startTypeChecking` after the app build; `next.config.ts` sets no `typescript.ignoreBuildErrors`), and in 16.3.2 that goes through the **project `tsc` CLI** with no file filter — see step 4's remedy for the measurement. So a PR running both builds pays for `tsc` three times, and no ordering of steps changes what any of them reads.
2. `prisma validate` runs before `typecheck`, not after. §9.2's own note ("CI order is not commit order") already concedes the two are independent; putting the cheap offline check early buys fast failure.
3. **The migration↔schema drift leg is deleted, not deferred, and nothing replaces it.** §9.2 scheduled `migrate diff --exit-code` against a throwaway Postgres. It could not run even before the ruling: `./node_modules/.bin/prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --exit-code` → `Error: You must set \`datasource.shadowDatabaseUrl\` in your \`prisma.config.ts\` if you want to diff a migrations directory.`, exit **1**. That measurement is kept **as evidence that the leg was already non-functional**, not as a to-do — this file originally booked the fix as P1b's, and `COMPAT-POLICY.md` §6 (owner ruling) then deleted the leg with no substitute, which is also what `phases/20` step 9 gates on. `INV-F`'s alternative command is invalid on its own terms too — `--to-schema-datamodel` → `` `--to-schema-datamodel` was removed. Please use `--[from/to]-schema` instead. `` There is nothing to hand over: **no phase owns it, no Postgres `services:` container and no shadow-URL config key are ever added, and `prisma validate` is the whole schema check.** The exit-code contract (**Empty: 0 / Error: 1 / Not empty: 2**, verbatim from `migrate diff --help`) is recorded only so that anyone who later rebuilds the leg against a real staging database starts from the right predicate — 1 is not a pass. It is not a step. See the P1b handoff, which says the same thing from the other end.

**Verify:** `rm -f tsconfig.tsbuildinfo && npm run check` locally → exit 0. Then open the throwaway PR §4's gate demands: `gh pr create … && gh pr checks --watch` → the single `gates` job green, start to finish, with no secrets configured on the repo. **The `rm -f` is not decoration.** `package.json:20` is a bare `tsc --noEmit` and `tsconfig.json:16` is on, so on your own machine `npm run check`'s typecheck leg can report a *previous tree's* verdict: `tsconfig.tsbuildinfo` is present here at 356,779 bytes, and it is a warm-cache read that no CI runner ever gets. **A locally green `build:server` proves less than a CI one**: `scripts/next-target.mjs:24` calls `loadEnvConfig`, so your own `.env` supplies the four server vars and can mask a broken placeholder (`INV-F` §7.3 caveat). The CI run, with no `.env`, is the honest measurement.
**If it fails:** read which leg. Red on `format:check` → step 2 did not merge. Red on the serial `vitest` leg → step 3 did not merge (or a new file bleeds env). Red on `build:server` with a Zod error naming an env key → the placeholder for that key violates `next.config.ts:12-19` (`DATABASE_URL`/`NEON_AUTH_BASE_URL` must be *valid URLs*; the two secrets ≥32 chars). Red on `build:demo`'s typecheck while `typecheck` passed → you are reading a manifest or validators from the *other* build; check T4. Red on the *first* `tsc` with a wall of `TS2307` on paths you just deleted → stale generated validators; see step 4's remedy. Anything else: do not disable the step — file it as a dossier correction.

**Assertions that can actually fail, and what each catches.**

- ~~`0 server-action ids` after `build:demo`~~ → **this gate was born unfailable and has been demoted to an `echo`.** `node_modules/next/dist/export/index.js:360` opens `if (nextConfig.output === 'export')` — true for every demo *build* (`next.config.ts:28`) — and `:375-385` collects `[...Object.keys(node), ...Object.keys(edge)]` and throws `ExportError("Server Actions are not supported with static export.")` with `value: "E625"` **before the line `// Start the rendering process`**, i.e. before any page is written. The predicate it throws on is `extractInfoFromServerReferenceId(id).type === 'server-action'`, and `shared/lib/server-reference-info.js:36-37,47` computes exactly `parseInt(id.slice(0,2),16)>>7&1` → `typeBit===1?'use-cache':'server-action'` — **the same bit test the assertion body computed.** So `build:demo` cannot exit 0 with a non-empty action set, and the step after it can only ever observe 0; in Actions a failed build also aborts the job, so the step does not even run to be wrong. What this file wrote instead — "reintroduce a `"use server"` action reachable from a demo page and it goes to a non-zero count" — is **refuted**: it goes to a failed `build:demo`, and the assertion never executes. The regression net is real but it lives in the build's exit code, where E625's own message names the file. `phases/50`'s gate G3 independently rediscovered the same defect in the same body — which makes this the **second** unfailable gate this phase has shipped, arriving as the replacement for the first one it was created to retire. Recorded plainly, not softened, because "we retire gates that cannot fail" is this step's stated purpose. The `echo` stays: run against a *server* manifest it prints 17 and exits 0 (measured, above), so it documents the invariant and diagnoses a mis-ordered local read for free. What it cannot do is fail.
- Route-handler + action-id counts after `build:server` (4 keys, 17 ids across 5 files): **the two assertions whose input nothing upstream constrains**, so they can go either way on their own merits; `INV-F` F2/F5. The census below is open-ended too, but it asserts a number this phase deliberately froze to today's truth.

- `104 *.html` in `out/`: passes now, **must be edited to 26 by Phase 1's own PR** (§2 line 54 / `VER-F` item 7) — and see the ownership blocker under Handoff notes, because that PR does not currently know it owns this line. Hard-coding the post-purge 26 here would make `ci.yml` born red, the identical D-7 failure mode step 2 exists to prevent, which is why the number is today's truth with a `PHASE-1:` comment. It is **count-only**: 26 wrong documents satisfy it.
- ~~`assert no api/ in out/`~~ (plan Day 4 line 236): **cannot fail** — verified, `out/api` does not exist and never will, because `output: "export"` drops route handlers. `find src/app -name route.ts | wc -l` → 4, and none of the four is exported. Now implemented as the informational `echo` step it always said it was (§9.1 row 1). Note the asymmetry this file is slow to learn: this one was diagnosed unfailable *and fixed*; its replacement was diagnosed unfailable *two reviews later*.

### 6. Item 0.5 — discard the plan's Day-0 premise, in the PR description

Plan §6 line 210 ("Commit 30 untracked files + uncommitted schema + migrations 4 & 5") is done. Evidence to paste: `git status --porcelain` output, `git ls-files prisma/migrations`, and the §2 baseline table re-measured on this branch. No repo file records the baseline — the PR body is the artifact, and P1 re-records it against the merge commit.

### 7. Branch protection — only after steps 2 and 3 are merged

`gh api -X PUT repos/niciniV/SMS_Portal/branches/main/protection` (`git remote -v` → `https://github.com/niciniV/SMS_Portal.git`) with `required_status_checks.checks: [{context: "gates"}]`, `strict: true`, and `required_pull_request_reviews.required_approving_review_count: 1`. The `gates` string is not arbitrary and not yet observed: it derives from the **job key** in step 5's workflow, which declares `jobs.gates` with no job-level `name:` overriding it, so the context is satisfiable — but "satisfiable" is as far as this file can honestly go. `[U]` end to end: no pass in this pipeline has PUT protection, watched a real PR's checks, had `gh pr merge --auto` refuse a red PR, or had a direct `git push origin main` rejected; that whole leg needs repository auth and a throwaway PR.
**This is also the step that turns the `ci.yml` ownership gap under Handoff notes into a hard blocker rather than a filing error** — `strict: true` on a check whose census assertion Phase 1's own PR invalidates is what makes the purge PR unmergeable. Do not land step 7 before that gap is closed in `phases/10`.
**Verify:** `gh api repos/…/branches/main/protection/required_status_checks` → lists the CI job by name; then push a deliberately unformatted scratch file on a scratch branch and confirm the PR is blocked.
**If it fails / if you are not an admin:** stop and hand it to the repo owner. Do **not** substitute "we'll be careful". Do not touch `deploy.yml` to make it wait for CI — it triggers on `push: branches: [main]` (`deploy.yml:4-6`), and required checks plus PR-only merging is what stops an unverified push from publishing. <!-- COMPAT: `deploy.yml` untouched, so the live GitHub Pages site keeps publishing on every push to `main` during the refactor. -->

## Exit gate

This is the contract later phases rely on. Run everything on the merge commit from a **fresh clone** — no `.next`, no `.env`, no `src/generated` — followed by `npm ci`, which is what creates `src/generated` (`postinstall → prisma generate`):

- [ ] `npm run format:check` → `All matched files use Prettier code style!`, exit 0.
- [ ] `npm run lint` → exit 0.
- [ ] `npx tsc -p tsconfig.json --noEmit --incremental false` → exit 0 on a tree with **no** `.next` (proves the `postinstall` generate chain) and exit 0 after `npm run build:server` (proves the generated validators are in the program). Do **not** expect **1,706** on a fresh clone — that is *this* workstation's count, and 12 of its files are `.next`/`.next-demo-dev` artifacts that `.gitignore:5-6` keeps out of git; a clone sees ~1,694 before any build and ~1,698 after `build:server` (the 4 in `.next/types/` only, never the 8 dev-server files) — both figures are arithmetic on the measured 12, not re-measured. The check is exit 0, not the count.
- [ ] `npx vitest run` → `33 passed (33)` / `284 passed (284)`. `[S]` — see step 3.
- [ ] `npx vitest run --no-isolate --fileParallelism=false` → **identical 33 / 284**, exit 0. Serial equals parallel; no suite silently loses cases. `[S]` — same.
- [ ] `rm -f tsconfig.tsbuildinfo && npm run check` → exit 0, **cold**. Without the `rm -f` this line can pass off the previous tree's cache: `package.json:20` is bare `tsc --noEmit` and `tsconfig.json:16` is on. The CI leg cannot lie this way (a fresh runner has no buildinfo, and `setup-node` caches npm only), so the flag in `ci.yml` is for baseline comparability and this `rm -f` is the half that actually buys something.
- [ ] `./node_modules/.bin/prisma validate` → `is valid 🚀`, exit 0, with no database and no `.env`.
- [ ] `git ls-files .github/workflows` → `ci.yml` **and** `deploy.yml`. Then the permission clause, which must assert on **structure**: `grep -qE '^[[:space:]]*contents:[[:space:]]*read' .github/workflows/ci.yml && ! grep -nE '^[[:space:]]*(pages|id-token):[[:space:]]*(write|read)' .github/workflows/ci.yml` → the first exits 0, the second exits 1 (no match = pass).
  **Why this line was rewritten — the gate and another instruction in this same file were tripping each other.** The old clause was `grep -n "pages:\|id-token:" .github/workflows/ci.yml` → *no match*: an unanchored substring test over the whole file, comments included, while the **last bullet of this gate** requires T1–T4 to be documented *inside* `ci.yml` as comments and step 5 requires the file to record why `pages: write` must not be copied from `deploy.yml:8-11`. The natural comment therefore reddened the gate. Demonstrated on a 10-line workflow whose only occurrence of either string is a comment: old pattern → match, exit 0, **gate fails**; new pattern → `contents: read` present, no mapping key, **gate passes**. Two secondary notes: the old clause is *also* a manual checklist line, so "no match" (grep exit 1) reads as a failure to anything that runs it as a `run:` step — the same inversion `RV-50` found in `phases/50`'s G11 — and `phases/50`'s rewritten G12 clause (iv) is stricter than the positive-and-negative pair above (`! grep -qE '^[[:space:]]*(pages:|id-token:)'`, no value pattern), so the step-5 block is written to satisfy the stricter form too. Verified against the proposed workflow: 0 matches.
- [ ] `ci.yml` observed **green on a real PR** with zero repository secrets configured, and its `build:server` leg green on placeholder env alone.
- [ ] Branch protection active: `gh pr merge --auto` on a red PR does not merge; a direct `git push origin main` is rejected. `[U]` — never observed end to end; needs repository auth and a real PR. The `context: "gates"` name is at least satisfiable: it derives from the job key, and the proposed workflow declares `jobs.gates` with no job-level `name:` overriding it.
- [ ] The four traps T1–T4 are documented *inside* `ci.yml` as comments, not only here.

## Interfaces that must not change

- `package.json` script **names and text**: `check` (`:24`), `format:check` (`:19`), `lint` (`:17`), `typecheck` (`:20`), `test` (`:21`), `build:demo`/`build:server` (`:14-15`), `postinstall` (`:26`). Every later phase's gate text quotes these verbatim, and `postinstall` is the only thing keeping typecheck alive on a clone.
- `vitest.config.mts:12-15` (`environment: "node"`, injected `APP_RUNTIME_MODE=demo`) and `test.include: ["tests/**/*.test.ts"]` (`:16`). §11's "Automated?" column is calibrated to this.
- `next.config.ts:22-31` — a demo *build* writes `.next`. Giving it its own `distDir` is a real improvement (`INV-F` ordering rule 1) but it rewrites the manifest paths in step 5; it belongs to **P2**, which already edits this file, and P2 must update `ci.yml` in the same PR.
- `tsconfig.json:6` (`skipLibCheck: true`) and `:45-55` (include/exclude). Flipping either changes what "typecheck green" means, in both directions.
- `prisma/schema.prisma:1-4` generator output path and `prisma.config.ts`'s `DIRECT_URL`-driven datasource (`:4,11`).
- `.node-version` / `.nvmrc` / `engines.node` = `24.19.0`.
- `deploy.yml` (untouched — see step 7).
- The 3 `validator.ts` paths and their 44/21 reference counts, as P1's regeneration evidence — with step 4's correction attached: a build regenerates **one** of the three (`build/index.js:804`), so "the 44/21 on `.next/types/validator.ts`" is the regeneration evidence and the other two copies are only ever evidence of the last `next dev`.
- **`ci.yml`'s own shape, once it exists:** the job key `gates` (it *is* the required-check name step 7 pins), and the four text contracts other phases run against the file — `prisma validate` on exactly 1 line and no `migrate diff` / shadow-URL / `services:` string at all (`phases/20` step 9), plus `expected 17` on 1 line, `out/api` on 1 line and no `process.exit` on the `E625-risk` line (`phases/50` step 2). Editing any of those silently reds a phase that is not yours.

## Tests

- **Changed:** `tests/unit/auth.test.ts:161-165` — snapshot-and-restore instead of three deletes. What it catches: cross-file `process.env` bleed in a shared worker, which today costs 2 real test cases (284 → 282) and turns 33 passing files into 32. What it does **not** catch: a future file that deletes env again, or bleed in a variable outside `trackedKeys`. The `--no-isolate --fileParallelism=false` leg in `ci.yml` is what keeps this honest; the fix alone is not a guarantee.
- **Added:** no new test files. "Suite order-independence" is not a test, it is an *invocation*; a self-referential test that asserts vitest's own scheduling would be the one unfalsifiable gate in the phase. Likewise no assertion helper for the manifests — they are four `node -e` one-liners in the workflow, and a `tests/` file for them could not fail without a build artifact present.
- **Deleted:** none.
- **Retired as unfalsifiable:** plan Day 4 line 236 (`no api/ in out/`), and — this pass — **the gate §9.1 chose to replace it**: `0 server-action ids` after `build:demo` is now an informational `echo`, because Next throws E625 inside the exporter before rendering, so the assertion could only ever read 0. Both retirements are of the same species and the second was found two reviews late; step 5 holds the source lines for each. The doc-count assertion stays a gate and is deliberately set to today's truth (104) with a `PHASE-1:` comment rather than to a number that cannot pass yet.

## Do not touch

`REFACTOR_PLAN.md` (fixed input — the entire reason step 2 ignores it instead of formatting it). `src/**`, `contracts/**`, `prisma/schema.prisma`, `prisma.config.ts`, `next.config.ts`, `tsconfig.json`, `vitest.config.mts`, `.prettierrc.json`, `eslint.config.mjs`, `scripts/**`, `package.json`, `.github/workflows/deploy.yml`, `README.md`, `docs/**` other than this file.

`out/`, `.next/`, `.next-demo-dev/` are **evidence** for T4 and step 4's counts — do not clean them before recording. This is the one place this file contradicts itself on the surface, and the resolution is order, not permission: step 4's remedy says `rm -rf` those trees, and this section says don't. **Record first** — the three `node -e` manifest probes, the `44 21` per-copy probe, the mtimes and `BUILD_ID` — **then** clean, and only in a Phase 1 tree where the recording has already gone into the PR body. A Phase 00 branch that deletes these before step 4 is written has destroyed its own Evidence table.

Never `prisma migrate dev` or `prisma db push` (dossier §12 row 1; Q-6: no database has ever been created, so a reset has no safe target), and never run any Prisma command that resolves a connection string from a shell holding a real `.env` (`prisma.config.ts:1` loads it silently — `ADJ-01` §3.1).

## Rollback

Single PR off `main`; one commit per step (2, 3, 5) so any one can be reverted alone.

- Revert step 5 (`ci.yml`): `git revert <sha>` — one commit, and you are back to `deploy.yml`-only, which is the status quo. Nothing published changes.
- Revert step 3 (the test fix): one commit. The failure is **loud, not silent** — the serial `vitest` leg goes red again rather than quietly losing 2 cases — provided step 5 is still merged.
- Revert step 2 (`.prettierignore`): permitted mechanically, **forbidden operationally**. `format:check` goes red on `main` again and `npm run check` can never pass, which un-contracts every later phase's exit criterion and re-opens §10.3's unbounded red window. If the objection is "the plan must stay prettier-policed", the answer is a separate `prettier --check REFACTOR_PLAN.md` step with `continue-on-error`, not this revert.
- Branch protection is **not in git**: `gh api -X DELETE repos/…/branches/main/protection`. Say so in the revert PR, because a `git revert` will not undo it.
- Cost to redo the whole phase: ~1 hour. Nothing here touches a runtime path, so nothing a user can see was ever at risk.

## Accepted breakage

- **Direct pushes to `main` stop working** (step 7). That is the point; work goes through PRs.
- `REFACTOR_PLAN.md` is no longer format-policed. A real narrowing of `format:check`, accepted because the alternative blocks the phase.
- CI gets slower: two full builds plus a serial test leg, against a fast baseline measured here at `typecheck` 6.8 s + `vitest run` 1.7 s + `prisma validate` under a second. **The real multiplier is hidden in that sentence:** `next build` runs its own project-wide `tsc` (`build/index.js:1068-1073`), so a `gates` job with both builds pays for `tsc` **three times**, not once, and the named `typecheck` step is the third. The implementer records the observed `gates` job duration in the PR; if it exceeds ~10 min, split `gates` into two jobs with the step-5 ordering preserved *within* each — and note that any split which separates a manifest read from its build re-creates the T4 hazard, so the split point is `build:demo` + its two reads + the upload, nothing else. `[U]`: the ~10-minute budget and the "~1 hour" redo cost have never been measured by anyone.
- A branch that never rebases may go red on the serial `vitest` leg if it re-introduces env bleed. Correct outcome.
- **`ci.yml` does not gate `deploy.yml`.** A push to `main` still publishes to Pages; protection only stops that by requiring PRs. If someone with admin force-pushes, an unverified artifact ships. Closing this properly means either merging `deploy.yml`'s job behind `needs: gates` or moving Pages to a `deployment` rule — a hosting decision, not this phase's. Recorded, not fixed.

## Handoff notes for later phases

- **P1:** after §2.2's route deletions, on a **workstation that has run `next dev`**, `rm -rf .next/types .next/dev .next-demo-dev` *then* `npm run build:server` *then* `npm run typecheck`. The step order this file used to prescribe — "build:server before any typecheck (else **63** false `TS2307`s — 21 × 3 validator copies)" — is **refuted as a remedy** and is corrected rather than softened: a build regenerates **one** of the three copies (`build/index.js:804`, `validatorFilePath = join(distDir,'types','validator.ts')`; the tree's own mtimes say the other two are 3 h 44 min and 3 h 01 min older than the last `BUILD_ID`), so the order cleared 21 of 63 — and since `next build` typechecks the whole project through the unfiltered `tsc` CLI (`config-shared.js:257` → `runTypeCheckCli.js:26-32`), the 42 red the **build** itself before any separate typecheck step is reached. **On CI the ceiling is 21 and `build:server` zeroes it**, because `.gitignore:5-6` keeps every `.next` tree out of git and a fresh runner never runs `next dev`. See step 4's remedy bullet for the whole chain. In the *same* PR, change `ci.yml`'s doc assertion `104 → 26` — and only `104 → 26`: there is **no expected-path list to edit**, and this file's earlier instruction to edit one was a reference to text that never existed (step 5, MISSING). Read the blocker callout at the end of this section before assuming anyone in your PR knows. Also expect `tests/unit/portal-dev-bypass*.test.ts` to leave the suite: the order-dependent symptom dies with them, so keep the serial leg.
- **P1b:** the drift leg is **nobody's — it was deleted, and it has no substitute.** `COMPAT-POLICY.md` §6 (owner ruling, 2026-09-23) adopted edits 2/3 and **rejected** edit 1, so migration history stays sequential (`0_init` … `5_v1_game_events`, plus a hand-authored `6_drop_generation_a`) and the shadow-DB prerequisite is never built. Do **not** add `datasource.shadowDatabaseUrl`, a Postgres `services:` container, `SHADOW_DATABASE_URL`, or a `migrate diff --exit-code` CI step. The DB-free byte-compare that §4 edit 2 originally offered as a replacement was withdrawn with the collapse it depended on: replaying a *sequential* history to prove it reproduces the schema requires a database, and the only database that would settle it is a real staging one — which is exactly the thing `slice-03-05-portal-handoff.md:35` item 1 still asks a human to supply. So `prisma validate` is the whole schema check, and **no gate covers `schema.prisma` ↔ migration-history drift**; name that in the PR rather than implying a cheaper gate took over. The `shadowDatabaseUrl` error quoted in step 5 is retained as the reason the old gate was already non-functional (exit 1 today), not as a to-do. What P1b *does* own: the 10-statement `6_drop_generation_a` (`phases/20-schema-and-migration.md` step 8 — 5 FK drops, 4 table drops, 1 type drop, gated on `test -s` or `--exit-code` → **2**, never on a bare exit 0). **It does not own the `104 → 26` doc-count edit** — an earlier revision of this row handed that here as a "follow-through," which created a second owner for one line alongside P1 above; `phases/50` step 2 settles the question canonically, and the edit lands in **Phase 10's purge PR, in the same commit as the deletions**, because that is the commit where the number changes.
- **P2:** if you give the demo build its own `distDir`, every `.next/...` path in `ci.yml` changes — same PR. Add `typecheck:demo` right after `lint` once the seam lands (§13.1's cheap alternative); it currently does not exist in `package.json`. If you make `src/runtime/target.ts` generated and *committed*, add it to `.prettierignore` first or `format:check` fails on machine-written code (`ADJ-03` §F4).
- **P3:** `npm run test:contracts` (`package.json:22`) is inside no CI leg yet; §11 R-12 partially depends on it. Decide deliberately. **The hazard is the same shape as the blocker above, and it is now measured:** this sentence lives *only* in handoff notes — `grep -ni "test:contracts\|v1-contracts" phases/40-decomposition.md` → **0 hits**, in the file P3's implementer actually reads. A reader of one phase file cannot know the duty exists. Treat it as unowned until Phase 40's file carries a step.
- **P4:** §9.1's replacement table is *implemented* by step 5 — the docs must describe `ci.yml` as it exists, not re-propose it. §9.4's documentation edits should include "CI now enforces X".
- **Compatibility policy:** three `COMPAT` tags in this file (steps 3, 4, 7) — the vitest demo injection, the `typecheck` script text, and `deploy.yml` left publishing. None is load-bearing for a later phase's *correctness*; all three are load-bearing for today's behavior.

> **BLOCKER — who edits `ci.yml`'s document count.** Stated here, at the end of the handoff list rather than inside it, because this file creates `ci.yml` and cannot close the gap alone.
>
> **This is a real blocker, not a documentation nicety, and it is unresolved as of this revision.**

>
> The mechanics: `ci.yml` is created by **this** step 5 and its census assertion is set to today's truth, `104`, with a `// PHASE-1: 26` breadcrumb. Phase 1's own exit gate asserts `find out -name '*.html' | wc -l` → **26** (`phases/10-purge-generation-a.md:213`). Step 7 then puts branch protection on `main` with `required_status_checks.checks: [{context: "gates"}]` and `strict: true`. So the moment the purge lands, the `gates` job that Phase 00 defines goes red on `export docs 26, expected 104`, and **the purge PR is unmergeable by a non-admin** — or is admin-bypassed and `main` goes red until Phase 50, which is the unbounded window §10.3 exists to bound, reopened two phases late.
>
> The gap, verified rather than asserted: the requirement is booked in **four** places and implemented in **zero**. It appears in the Out-of-scope bullet that names **P1**/**P2** as owner, in step 5's "Assertions that can actually fail" ("must be edited to 26 by Phase 1's own PR"), in the P1 handoff bullet above, and at `phases/50-gates-ci-demo-docs.md`'s Phase-1 handoff. But `grep -n "ci\.yml" phases/10-purge-generation-a.md` → **exactly 2 hits, `:7` and `:260`, and neither is an instruction** — `:7` is the `Depends on` sentence, `:260` an Accepted-breakage row — while its handoff at `:269` pushes the duty *forward* to "Phase 50 (gates, CI, demo, docs)". An implementer who reads one phase file at a time reaches 26 documents, touches nothing in `.github/`, and is blocked by a check their own file never names.
>
> **The requirement, unmissable:** *Phase 1's purge PR edits `.github/workflows/ci.yml`, in the same commit as the deletions, changing `if(n!==104)` to `if(n!==26)` in the post-`build:demo` census step and updating the `PHASE-1: 26` breadcrumb so the marker does not outlive its meaning.* It is not Phase 50's: Phase 50 documents the workflow as it exists and, per this file's P4 handoff, must not re-propose it; and it is not "any PR before gates goes red", which is what a handoff note without a work-order step actually buys.
>
> **What is being fixed where:** the counterpart edit — a `ci.yml` step row in Phase 1's own work order and a re-addressed `:269` handoff — belongs to `phases/10-purge-generation-a.md` and `phases/50-gates-ci-demo-docs.md`, both outside this file's write scope and both under revision in parallel. Until that lands, this callout is the only place the requirement is stated with its consequence attached, which is itself the hazard: **a handoff note is currently the only place some steps live.** Two further ownership collisions on the same lines are recorded rather than resolved here — `phases/50`'s step 2 *also* edits G3's body (the demotion is already applied in the step-5 proposal above, so Phase 50 should find it an echo and one edit shorter). The third collision that used to be listed here, this file's own P1b bullet booking a "doc-count follow-through" as a second owner for the `104 → 26` edit, **has been resolved**: that clause is struck and the edit is P10's alone, per `phases/50` step 2's canonical answer.
>
> **If you are Phase 1 and you cannot edit `ci.yml`** (no write access, or the file has not merged yet): do not merge a purge that changes the document count while the assertion still reads 104, and do not "fix" it by deleting the assertion. Escalate; the resolution is one line in one file in one PR.

## Evidence

| Claim | Source / how verified at `e5aaf1e` | Confidence |
| :--- | :--- | :--- |
| `format:check` red on exactly `REFACTOR_PLAN.md`, exit 1 | §2 row 6, §4 0.1; re-run: `npx prettier --check .` full output (2 lines + exit 1) | **[V]** |
| `check` runs `format:check` first | `package.json:24`; §4 0.1 (`:24` ✓) | **[V]** |
| `.prettierignore` contents, 8 lines, no plan entry | read; §4 0.1 ✓, `ADJ-03` §F4 ✓ | **[V]** |
| Step 2's *post*-edit `npx prettier --check .` → exit 0 | the edit is a write and was never performed by a verifying pass; the `--ignore-path` simulation mis-anchors the other patterns (388 warnings) so it does not stand in for it. Pre-state red is proven, the ignore mechanism is demonstrated by `.prettierignore:7` | **[S]** |
| Order-dependent test: origin, mechanism, 2-file repro, 282-vs-284 | §4 0.2 / `VER-F`; re-run `npx vitest run --no-isolate --fileParallelism=false` → `1 failed \| 32 passed`, `282 passed`, exit 1, stack `mode.ts:10` ← `mode.ts:16` ← `portal-view-service.ts:7` ← `portal-dev-bypass.test.ts:5`. The static half re-derived without a runner this pass: `grep -c "  it("` → 14 (`auth.test.ts`) + 2 (`portal-dev-bypass.test.ts`) = 16, and the import-time throw explains why the failing file contributes 0 counted tests | mechanism **[V]**, the two vitest counts **[S]** |
| `--no-isolate` **alone** does not reproduce the bleed | `ADJ` "Commands that will not run" row 3, reproduced by the dossier's own run. Not re-run in the refutation pass (vitest is out of scope) nor here; the installed `vitest --help` confirms both flag spellings at `:46` and `:53` | **[S]** |
| Injection is `vitest.config.mts:13-15`, not `:12-14`; **10** of 33 test files read the mode, not 32 | read (`:12` = `environment: "node"`); §2 row 16 has it right, §4 0.2 off by one. The 10 are from an import-graph walk over all 33 files (`@/`→`src/`, `@runtime/*`→ both variants, `import()`/`export *` followed) — **corrects** "32 other test files", which counted test files, not mode readers. `grep -rn 'from "@runtime/' tests` → 0 | **[V]** |
| `auth.test.ts:161-165` deletes 3 vars (`:162` is `delete process.env[flagKey]`, `flagKey = "AUTH_DEV_BYPASS"` at `:159`); restore pattern exists at `:21-40` and in `portal-dev-bypass-actions.test.ts:44-59` | read; the second range starts one line early (`:44` blank) and ends exact | **[V]** |
| typecheck exit 0; 1,706 files; 12 `.next`; 24 generated | `--listFilesOnly` re-run twice (this pass and the refutation), both → `1706 / 12 / 24`, exit 0, and `tsconfig.tsbuildinfo` sha unchanged after the run (`--incremental false` is what keeps it that way). The 12 are `routes`/`root-params`/`cache-life`/`validator` × 3 trees, and `.next-demo-dev/types/` contributes 0 because it does not exist | **[V]** |
| Fresh-clone typecheck passes (skipLibCheck inert-ifies `next-env.d.ts:3-4`) | §4 0.3 B1 correction, `ADJ-03` §F1-as-corrected, `AUDIT` B1; **rebuilt from scratch in a scratch project** with this repo's `tsc` 6.0.3: `skipLibCheck: true` → exit 0 on two dangling `.d.ts` imports, `false` → exit 2 with `TS2882` ×2. Clone itself still not re-run | **[V]** |
| 21 stale `typeof import` per validator, 3 copies, 63 on a dirty tree | re-measured on **all three** copies → `44 21` / `44 21` / `44 21`, against plan §2.2's 7 trees (`REFACTOR_PLAN.md:37-43`); **corrects** §4 0.3 "~55 lines / up to 60 (reproduced exactly)", `ADV-1` row 1 "20 per copy", `ADV-3` table, `AUDIT` §"60 ✓". Cause: `atividade/[token]/layout.js` is a layout. Sharpness the count lacked: all 21 **resolve today** (`page.js` → `page.tsx` under `moduleResolution: bundler`), so none is an error yet | **[V]** |
| The ordering remedy clears 21 of 63, and the 42 red the *build*, not the typecheck | `build/index.js:804` writes `join(distDir,'types','validator.ts')` — one file; mtimes: `.next/types/` `2026-09-23 02:05:42` vs `.next/BUILD_ID` `02:05:52` (same build) against `.next/dev/types/` `2026-09-22 22:21:21` and `.next-demo-dev/dev/types/` `23:04:36`. `build/index.js:1068-1073` typechecks inside the build, and the CLI path it takes (`config-shared.js:257` `useTypeScriptCli: true`; `verify-typescript-setup.js:207-218`; `runTypeCheckCli.js:26-32` = `tsc --project <tsconfig>` with no filter) checks all three trees. **Refutes both** this file's "else 63 → run build:server first" and the refutation's "`runTypeCheck.js:31-34` means Next excludes them" — that filter is on the non-default API branch | **[V]** |
| Incremental `typecheck`: 6.8 s vs 2.7 s; `tsconfig.tsbuildinfo` gitignored and warm on this machine | `tsconfig.json:16`, `package.json:20`, `.gitignore:19`; the file is here at 356,779 B (`2026-09-22 23:35:26`) beside Next's own separate `.next/cache/.tsbuildinfo` at 363,617 B (`23:35:47`), which is why a warm root buildinfo can only come from bare `tsc`. The two **timings** were never re-measured | mechanism **[V]**, timings **[U]** |
| Generated client untracked, **47** importers, output path | `git ls-files src/generated` → 0; `grep -rln "@/generated" src tests` → **47** (34 `src`, 13 `tests`, 0 inside `src/generated`) — **corrects** "48", twice here and once in the Evidence row; `phases/50`'s "~48" survives on the tilde and `RV-X` N15 measured the same 47 independently | **[V]** |
| T1: npm `latest` prisma is an 8.0.0-rc.\* | `npm view prisma version` → `8.0.0-rc.17` (this pass) vs `rc.15` when `AUDIT` recorded it. **Corrects the literal, not the trap** — the suffix rots, so the rule is stated without it. Rename evidence from `AUDIT` "Commands that will not run" row 6. Subdirectory walk-up re-run: `cd docs && npx --no-install prisma -v` → `7.9.1` | **[V]** (drifting) |
| T2 no `--shadow-database-url` | `migrate diff --help` re-run: 81 lines, `grep -ci shadow` → **0** + live run → `unknown or unexpected option`; §6.5/`AUDIT` B4 ✓ | **[V]** |
| T3 `--from-url` removed | live run → "`--from-url` was removed…", exit 1. **Struck:** "yet still appear in `migrate diff --help`'s own examples" — the installed help has **0** hits for `--from-url`/`--to-url`; its only `--url` is `db execute --stdin --url=…` at help line 74, a different command. The `INV-F`/`AUDIT` "both quote the help examples" parenthetical goes with it | removal **[V]**, help-examples claim **refuted** |
| T4 shared `.next`; `out/BUILD_ID` absent; `.next/BUILD_ID` present; **17 action ids and 4 api keys in `.next` right now** | `next.config.ts:26-28`; live `node -e` manifest reads re-run → `total ids 17 actions 17`, 5 distinct filenames. `out/*.html` → 104; `git ls-files out` → **0** (`.gitignore:7`) — so §2 row 17's "104 **committed**" is wrong wording; the count is right, the tracking is not | **[V]** |
| **The `0 server-action ids` gate cannot fail** — demoted to an `echo` | `node_modules/next/dist/export/index.js:360` (`output === 'export'`, true of every demo build per `next.config.ts:28`), `:375-385` collects node+edge ids and throws `ExportError("Server Actions are not supported with static export.")` / `value:"E625"` **before** `:388` "// Start the rendering process"; `shared/lib/server-reference-info.js:36,47` computes the same `>>7&1` bit test the assertion body did. Independently reached in `phases/50`'s G3. **Corrects this file's "regression net … goes to a non-zero count"** | **[V]** |
| The permission exit gate tripped against this file's own `:313` instruction | demonstrated on a scratch 10-line workflow whose only `pages:` occurrence is a comment: `grep -n "pages:\|id-token:"` → match, exit 0 → old gate red; the structural form → `contents: read` present, 0 mapping keys → green. Same class as `phases/50`'s G12 fix | **[V]** |
| The proposed `ci.yml` parses, and satisfies the other phases' greps of it | extracted from this file's own finished text and loaded with the repo's `js-yaml` → `PARSE OK`, `name=CI`, `on=pull_request,push,workflow_dispatch`, `permissions={"contents":"read"}`, `job=gates`, `runs-on=ubuntu-latest`, 17 steps / 3 `uses` / 14 `run`, `node-version-file=.node-version`. The old block, same loader → `bad indentation of a mapping entry (7:76)`, and 0 of `name:`/`on:`/`runs-on:`. Cross-phase greps: 4 `check` legs matched, `pages:`/`id-token:` keys → 0, `prisma validate` → 1 line, `expected 17` → 1, `migrate diff`/shadow/`services:` → 0, `E625-risk`+`process.exit` → 0 | **[V]** (command in step 5) |
| `out/` path list: does not exist and was never booked | `REFACTOR-DOSSIER.md:590` §11.1 is prose route *patterns* incl. the non-document `/jogar?cred=<seed>`, not 26 paths — so the skeleton's "and the expected paths" and the P1 handoff's "expected-path list" edited nothing. Reference struck; the census is count-only and is labelled as such | **[V]** |
| Drift leg: **deleted with no substitute**; `prisma validate` is the only schema check | `COMPAT-POLICY.md` §6 (edits 2/3 **Adopt**, edit 1 **Reject**) and `:69` ("the honest consequence of the ruling is that the refactor ships with no schema-drift gate at all"); `phases/20` step 9 greps `ci.yml` for the absence. The leg's *non-functionality* is the retained evidence: `migrate diff --from-migrations … --exit-code` → "You must set `datasource.shadowDatabaseUrl` …", exit **1**, measured by this file originally and re-recorded at `COMPAT-POLICY.md:70`; **not re-run in this revision** (`prisma migrate` is out of scope for the pass). **Corrects** this file's two stale bookings at `:27` and step 5's divergence 3, both of which still handed the deleted work to P1b | ruling **[V]**, the exit-1 measurement **[S]** (not re-run this pass) |
| Exit-code semantics Empty 0 / Error 1 / Not empty 2 | verbatim from `prisma migrate diff --help`, re-printed in this pass. Recorded as a predicate for a leg nobody owns, not a to-do | **[V]** |
| The `ci.yml` `104 → 26` ownership gap is a **real blocker** | `grep -n "ci\.yml" phases/10-purge-generation-a.md` → exactly 2 hits (`:7` Depends, `:260` a compat-table row), neither a step; its Exit gate `:213` asserts 26 and its handoff `:269` forwards the duty to Phase 50. Four bookings (`:29`, step 5, the P1 handoff, `phases/50`'s Phase-1 note), zero work-order steps. Under step 7's `context: "gates"` + `strict: true` the purge PR cannot merge | **[V]** |
| `npm run check` → exit 0 | not re-run: it contains the `npm test` leg, out of scope for this pass. The `rm -f tsconfig.tsbuildinfo` clause added to it is the finding that survived review | **[S]** |
| `next build` type-checks; `next build` no longer lints | Both read from the vendored Next 16.3.2 docs (`AGENTS.md` mandates it): `node_modules/next/dist/docs/…/typescript.md:13,23` and `…/upgrading/version-16.md:1084`; the "runs `tsc` three times" half is from `build/index.js:1068-1073` + `config-shared.js:257`. **Refutes** `INV-F` §CI "ESLint runs during build too" | **[V]** |
| Server build needs valid-but-unreachable env; no DB | `next.config.ts:12-19` (dossier §4 0.4's `:9-20` includes a 3-line comment; `AUDIT` §7.4 row already cites `:12-19`); `src/server/db/client.ts:16-19` lazy; `src/app/(professional)/portal/layout.tsx:21-23` gates on `connection()`; `scripts/next-target.mjs:41-53` blanks demo vars, `:24` loads `.env` | **[V]** |
| `APP_RUNTIME_MODE` parsed unconditionally, so bare `next build` cannot work | `next.config.ts:5-7` + `scripts/next-target.mjs:26-30`; **new** — no report states it | **[V]** |
| `deploy.yml`: push main + workflow_dispatch, no PR, `npm ci && build:demo` → `./out`, no checks, `pages: write` at `:10` / `id-token: write` at `:11`, `runs-on: ubuntu-latest` at `:19,45`, Node literal `:27` | read lines 1-51 ✓ §2 row 15. The `ubuntu-latest` literal is the one the retired sketch never stated | **[V]** |
| Alias counts 9/9, 24 import statements | `grep -c '"@runtime/'` → 9, 9; `grep -rn "from \"@runtime/"` → 24 (all 24 in `src`, 0 in `tests`) ✓ §2 rows 11-12, `INV-F` §7.2 | **[V]** |
| All 6 migrations tracked; tree clean; D-7 ordering | `git ls-files prisma/migrations` → 7; `git status --porcelain`; §3 D-7, §9.2 last line, §10.1 edges ✓ | **[V]** |
| Baselines re-run here: lint exit 0, `prisma validate` valid, `vitest run` 33/284, prettier exit 1 | lint/prettier re-executed; `prisma validate` and `vitest run` were **not** re-run in this revision (the suite and the generate chain are out of scope for a doc pass). Toolchain actually used: **Node 22.23.1** (`node -v`), the same drift `INV-F` §CI rule 5 hit and the reason `ci.yml` pins `node-version-file`; `ADJ-03` §F3's "this repo's own Node 24" was a different shell | **[S]** |
| "Cost to redo the whole phase: ~1 hour", the ~10-min CI budget, `prisma validate` "under a second" | timing claims never measured by any pass | **[U]** |

