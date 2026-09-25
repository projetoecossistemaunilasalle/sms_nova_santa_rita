# Primary audit — Phase 50 gates, CI, demo, and documentation

**Audit date:** 2026-09-25  
**Repository:** `C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal`  
**Revision:** `e5aaf1e2891dbb1804950223eb9f0765e7dbeb65` (`main`, equal to `origin/main`)  
**Primary target:** `docs/refactor-dossier/phases/50-gates-ci-demo-docs.md`  
**Mode:** read-only except this report

## Verdict

**NOT READY TO EXECUTE AS WRITTEN.** The current Phase 50 document contains seven blockers, four majors, and two minor defects. Its strongest work is correctly retiring the vacuous `out/api` and demo-action gates, preserving artifact ordering, and documenting the lack of browser acceptance coverage. Its central problems are that several “pass” states do not pass, the proposed CI file is itself red under the format gate, post-refactor baselines/ownership conflict across phases, and current main-branch/deploy controls do not provide the protection Phase 50 credits them with.

The present tree is not generally broken: with the pinned Node 24.19.0 runtime in an external copy, lint, cold typecheck, Prisma validation, all 33/284 tests, `build:server`, and `build:demo` pass. The release pipeline is nevertheless incomplete: only `deploy.yml` exists, it publishes every push to `main` without CI, `main` is currently unprotected, and the live Pages deployment for `e5aaf1e` succeeded.

## Scope and method

I read the complete Phase 50 file and the current dossier-level claims, including:

- `docs/refactor-dossier/{README.md,REFACTOR-DOSSIER.md,COMPAT-POLICY.md}`;
- `docs/refactor-dossier/phases/{00-prerequisites.md,10-purge-generation-a.md,20-schema-and-migration.md,30-composition-seam.md,40-decomposition.md}`;
- inherited gates evidence (`INV-F`, `VER-F`, `RV-50`, `ADJ-03`, `AUDIT`, `RV-X`) without accepting it without replay;
- `.github/workflows/deploy.yml`, the complete proposed `ci.yml` embedded in Phase 00, `package.json`, `.node-version`, `.nvmrc`, TypeScript/Vitest/ESLint/Prettier/Prisma configuration;
- `scripts/next-target.mjs`, `scripts/start.mjs`, `Dockerfile`, `.dockerignore`, all 33 test files and all 32 V1 fixtures;
- demo/runtime and cited product/architecture/deployment documents, including README, PRODUCT, DESIGN, the V1 dossier, current architecture, visual-demo plan, implementation roadmap/handoff, schema/API/domain documents, architecture audit, `walkthrough.md`, and `implementation_plan.md`;
- existing `.next`, `out`, and live GitHub Pages responses.

Mutation-sensitive experiments ran in `C:\Users\Vitor\AppData\Local\Temp\sms_portal_phase50_audit_a3dd2bb24baf48c1bc856dfde31eaeea`, populated from all 343 tracked files and a complete 53,139-file `node_modules` copy. Source hashes for the config/runtime samples were verified equal to their Git blobs. Both Next builds were rerun there with Node 24.19.0. Synthetic gate bodies and workflow mutations were also isolated there.

**Toolchain:** host Node 22.23.1 / npm 11.6.0; authoritative external build runtime Node 24.19.0; Next 16.3.2, TypeScript 6.0.3, ESLint 9.39.5, Vitest 4.1.11, Prisma 7.9.1, npm 11.6.0. Phase 50's Bash-only limitation is explicit at `:415-417`; the CI target is `ubuntu-latest`. Git-Bash replay therefore matches the declared shell, not Windows PowerShell.

## Findings — blockers

### B-01 — The proposed `ci.yml` is born red under its own first gate

**Claim under attack.** Phase 00 says fixing `REFACTOR_PLAN.md` makes `format:check` green (`:53-59`) and then proposes the exact `ci.yml` whose first substantive step is `npm run format:check` (`:186-190`). Phase 50 relies on that workflow as its prerequisite (`50:8-14`).

**Measured result.** Extracting the YAML fence from Phase 00, writing it byte-for-byte to `.github/workflows/ci.yml` in the external copy, parsing it successfully, and running:

```text
npx prettier --check .github/workflows/ci.yml
→ exit 1
[warn] .github/workflows/ci.yml
```

Prettier changes eight inline-comment spacings and adds the missing final newline. The repository baseline is also red on only `REFACTOR_PLAN.md` (`npx prettier --check .` → exit 1, one offender). After Phase 00's proposed ignore-line edit, `ci.yml` becomes the next offender.

**Why this blocks.** The format leg runs before lint/build/test, so the proposed protection check cannot go green on the tree created by its own work order. This is exactly the kind of born-red dependency Phase 00 says must be eliminated.

**Required correction.** Prettier-format the proposed file before it is committed, and make “parse + `prettier --check` + exact content hash” part of the extraction verification. Do not solve it by ignoring `.github/workflows/ci.yml`.

### B-02 — G6 exits 1 on the correct zero-alias state

**Claim under attack.** G6 says `grep -c '"@runtime/' next.config.ts tsconfig.json → 0,0` and “passes” under D-1=(a) (`50:94`, exit at `:387-390`).

**Replay.**

### B-03 — G4 simultaneously requires a path list and specifies no path list

**Claim under attack.** G4 says “26 documents with the §11.1 path list” (`50:92`, exit `:351`). Step 2 then says the workflow has no expected-path list, the §11.1 list is only prose, and the phantom reference is struck (`50:161-198`). The Phase-1 handoff nevertheless assigns ownership of that nonexistent list (`50:546-551`), and the exit gate still requires it.

**Consequence.** The exit contract is internally unreachable/ambiguous: an implementer either invents a list the work order forbids inventing, or implements count-only and fails the exit text.

**Required correction.** Choose one contract. For trustworthy behavior, derive and freeze the exact 26 relative document paths from an executed post-purge export and assert set equality. If the owner consciously chooses count-only, remove every path-list requirement and explicitly accept compensating additions/removals.

### B-04 — Phase 40 and Phase 50 schedule incompatible size gates and baselines

**Claim under attack.** Phase 50 says it “inherits” Phase 40's two scripts (`50:11-13`) but specifies new implementations: `scripts/css-selector-integrity.mjs` + a three-exception `size-ratchet.mjs` in Phase 40 (`:63-120`, `:285-328`, exit `:451-462`) versus `scripts/check-css-selectors.mjs` + `check-size-budget.mjs --baseline .size-baseline.json` in Phase 50 (`50:190-230`, exit `:372-375`). Phase 50 acknowledges incompatible baselines at `:583-591` but does not resolve ownership.

The size contracts are not merely different implementations of the same tree. Phase 40's exit expects 3 named exceptions and `--self-test` failures on both branches; Phase 50's baseline is 13 pre-purge offenders and claims 9 post-purge. Phase 40 continues to move/split those files. Landing both leaves two sources of truth with different expected baselines and no authoritative CI command.

**Independent census.** The Phase 50 classifier reproduces exactly on the present tree: 214 scoped files, 13 FAIL, 12 WARN. The 13 files include four Generation-A files Phase 10 deletes and multiple files Phase 40 splits. Its `13` is therefore demonstrably a pre-purge baseline, not a Phase-50 landing baseline.

**Required correction.** Phase 40's implementation should own both checks. Phase 50 should consume their CLI outputs, delete `.size-baseline.json`/`check-size-budget.mjs`, and require the Phase-40 self-tests. If two checkers are intentional, define non-overlapping axes and state which is authoritative.

### B-05 — G7's “baseline 5” is pre-purge and cannot be its landing baseline

**Claim under attack.** G7 and its exit require `violations 5 (baseline 5)` (`50:95`, `:190-225`, `:372`). The five current violations are `materialAudience`, `mobileNavItem`, and `entryProblem` at three lines. The file itself says `materialAudience` dies with Phase 1 (`50:199`). The handoff tells Phase 1 to remove it from G7's baseline (`:546-548`).

I independently reproduced the current oracle exactly: 50 module imports, 670 usages, 5 violations, at `materials-explorer.tsx:105`, `portal-navigation.tsx:37`, and `player-entry-screen.tsx:143,162,181`. After the named deletion, only four can remain unless Phase 40 independently fixes/adds one. The exit still says five.

**Required correction.** Define G7's baseline on the post-P1 tree, expected to be four unless source changes are measured. The exit must name the exact residual tuple, not the pre-purge count.

### B-06 — G12 is a lexical substring gate, not a CI-leg enforcement gate

**Claim under attack.** G12 says each check leg “appears on a `run:` line” and that the rewritten body can catch a dropped leg (`50:100`, `:245-270`).

**Synthetic replay.** The comment-only, Pages-permission, and absent-file cases failed as advertised, but two false-pass workflows also passed:

```yaml
- run: echo npm run format:check
- run: echo npm run lint
- run: echo npm run typecheck
- run: echo npm test
```

The regex also accepts bare `npm lint`/`npm typecheck` spellings and any text after `run:` before the match. It does not parse YAML, resolve `run: |` blocks, or prove the step runs. It can therefore certify a workflow that prints the words and executes none of the four gates.

**Required correction.** Assert the workflow's parsed structure with a checked-in Node test (exact step `run` values or run-script composition), and make the actual job the enforcement mechanism. Comments, substrings, and `echo` must not count as legs.

### B-07 — Branch protection is absent, and the proposed PUT does not guarantee direct-push rejection

**Current measured facts.**

```text
gh workflow list → only “Deploy to GitHub Pages” (active)
gh api repos/niciniV/SMS_Portal/branches/main/protection
→ HTTP 404: Branch not protected
```

The latest deploy run `35918529713` succeeded for `e5aaf1e`; its build job ran checkout, Node setup, `npm ci`, `build:demo`, and Pages upload, with no quality gate. Thus Phase 50's present-state statement that deploy publishes unchecked pushes is true, and release confidence is presently zero.

Phase 00's proposed PUT names `required_status_checks`, `strict`, and one approving review (`00:293-298`) but omits `enforce_admins` and push restrictions. GitHub's official rule says branch restrictions do **not** apply to admins/bypass roles by default unless “Do not allow bypassing” is enabled. Therefore the promised “direct `git push origin main` is rejected” verification (`00:314`) is not guaranteed for the repository owner/admin. The current `gh` identity is the repository owner account.

**Required correction.** Use a repository ruleset or PUT with admin enforcement and explicit push restrictions appropriate to the owner's workflow; then prove red auto-merge, direct push, and admin push behavior. Do not call protection active until the read API and all three negative tests pass.

```text
present tree:  next.config.ts:9  tsconfig.json:9  → exit 0
synthetic correct tree: 0,0                     → exit 1
```

GNU `grep -c` prints zero for each file but exits 1 when no selected line matches. In a CI `run:` step, the correct D-1=(a) result is therefore red.

**Required correction.** Use a Node assertion or explicit boolean wrapper, e.g. test both printed counts equal zero while preserving missing-file failure. Also resolve D-1 before the exit gate: Phase 50 correctly records that G6 and Phase 30's `tsconfig.demo.json` gate cannot both pass on either current branch (`50:94`, `:474-476`).

## Findings — major

### M-01 — G4/G5 detect cardinality changes but accept compensating wrong artifacts

Synthetic fail/pass replay of the proposed JavaScript produced:

```text
G4 25 documents, expected 26       → fail
G4 exactly 26                      → pass
G4 delete expected + add unwanted  → pass
G5 required route missing          → fail
G5 required routes + extra route  → pass
G5 16 action ids, expected 17      → fail
G5 17 action ids, one wrong target → pass
```

This is acceptable only if the rows claim cardinality/membership, not identity. They currently claim to catch a route silently vanishing, an accidental page, or a server action being stripped (`:92-93`). A compensating export or action replacement defeats those claims.

**Required correction.** Assert the exact expected document-path set and exact action source filenames (or a stable allowlist), not only counts and subset membership. Keep the count only as a diagnostic.

### M-02 — `scripts/start.mjs` builds before it validates arguments

`start.mjs:29-30` invokes `npm run build` before parsing CLI arguments at `:51-64`. Replaying `node scripts/start.mjs --unknown` performed a complete server build and only then printed “Argumento não reconhecido” and exited 1. The same applies to a bad flag/port/hostname preflight. This is surprising, expensive, and unsafe for a supposedly read-only validation failure.

It also accepts `--port`/`--hostname` without checking that a value follows; the missing value becomes `undefined`, then defaults at `:67-68`.

**Required correction.** Parse and validate all arguments before loading/building, reject missing values and repeated/unknown flags, and test this without invoking a build.

### M-03 — The repository's Docker deployment path is born red and outside Phase 50's claimed verification

The pinned external `build:server` passes when given the four syntactically valid environment values. The checked-in Dockerfile supplies none and runs `npm run build` at `Dockerfile:13`, while `next.config.ts:12-19` requires all four. Replay on pinned `node:24.19.0-alpine`:

```text
docker build -f Dockerfile .
→ exit 1
ZodError: required inputs missing:
DATABASE_URL, NEON_AUTH_BASE_URL, NEON_AUTH_COOKIE_SECRET, APPLICATION_SECRET
```

This is deterministic, not an infrastructure flake. Phase 50 discusses server/demo runtime and CI but does not inventory or correct the Dockerfile, and README does not disclose that direct Docker builds require build-time env injection. The Dockerfile is therefore not a deployable artifact in its current form.

**Required correction.** Supply build args/environment explicitly, document that they are compile-time config only and need not be reachable, and add a Docker build smoke gate using placeholder valid values. Decide whether the image needs a secret/config injection mechanism at runtime.

### M-04 — The documentation pass leaves a root deployment plan operational and false

Phase 50 schedules README, current architecture, database model, and a walkthrough archive pointer (`50:530-543`). It does not schedule `implementation_plan.md`, a root document that still instructs readers to run `npm run build` for a Pages export (`:66-70`). That command is now an alias for `build:server` (`package.json:13`) and requires secrets; the correct command is `npm run build:demo`.

The same stale historical document claims the project is “100% visual and static” and backend-independent (`:1-3`). Even if retained as history, it lacks a superseded/non-authoritative banner and is easy to mistake for implementation authority.

**Required correction.** Move it under a historical-doc location or add a prominent status/banner that supersedes it with `build:demo`; remove it from unqualified root-level operational guidance. Add a documentation link-integrity/status check so uncited-but-tracked operational plans cannot silently drift.

## Findings — minor

### m-01 — The informational action reporter still assumes every action id is in `m.node`

The proposed `Report the demo action count` body (`00:227-229`) indexes `m.node[i].filename` for a nonzero action list. If a future/incorrectly ordered server manifest puts an action in `m.edge`, the informational step throws a `TypeError` instead of printing diagnostics. It is not a gate after the demo build, but the reporting path should be total.

**Correction.** Resolve `m.node[id] ?? m.edge[id]` and print an explicit unknown-id diagnostic.

### m-02 — Phase 50 cites a nonexistent `docs/walkthrough.md` path in its evidence vocabulary

The real file is root `walkthrough.md`; `docs/walkthrough.md` does not exist. The work order generally names `walkthrough.md` correctly, but Phase 50's path inventory includes the nonexistent form. This is minor next to its substantive archive/count corrections, but it weakens exact-path audits.

**Correction.** Normalize every citation to the absolute repository-relative root path.

## Gate-by-gate replay

| Gate                    | Current result                                                                                                                                       | Pass/fail ability                      | Audit disposition                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------- |
| G1 format               | Repository: exit 1, only `REFACTOR_PLAN.md`. Proposed CI file at real path: also exit 1.                                                             | Yes                                    | Useful, but Phase 00's proposed CI is born red.                         |
| G2 `out/api`            | Current export: absent; four server route handlers exist.                                                                                            | No; retired correctly                  | Keep retired. Static export drops route handlers.                       |
| G3 demo actions         | Pinned Node 24 demo build: exit 0; manifest `ids 0 / actions 0`; config `output=export`, `basePath=/SMS_Portal`.                                     | No as post-build assertion             | Correctly informational; build exit/E625 is the gate.                   |
| G4 documents            | Pinned demo build: 109 generated pages, 104 HTML documents (`103 index.html` + `404.html`). Mechanical post-purge filter gives exactly 26 survivors. | Yes for count, no for identity         | Resolve B-03/M-01.                                                      |
| G5 server registry      | Pinned server build: exit 0; required four route keys present among 44 total; 17/17 action ids.                                                      | Yes for missing/count, no for identity | Strengthen to exact sets.                                               |
| G6 aliases              | Present: 9/9 and exit 0. Correct synthetic 0/0: exit 1.                                                                                              | Broken pass semantics                  | B-02.                                                                   |
| G7 usage→CSS definition | Independent oracle: imports 50, usages 670, violations 5, exact expected sites. Script/baseline absent.                                              | Yes in principle                       | B-05; cannot run proposed artifact yet.                                 |
| G8 size                 | Current census: 214 files, 13 FAIL, 12 WARN, exact list reproduced. Scripts/baselines absent and phase ownership conflicts.                          | Yes in principle                       | B-04.                                                                   |
| G9 order independence   | Node 24 parallel: 33/284 pass. Node 24 serial full suite: 1 file failed, 32 pass, 282/284 pass.                                                      | Yes                                    | Valid gate; Phase 00's env-restoration fix is required.                 |
| G10 Prisma              | Pinned Node 24: `prisma validate` exit 0.                                                                                                            | Yes for schema syntax only             | Correctly does not claim migration drift coverage.                      |
| G11 docs                | Exact body: current 19 unallowlisted lines → exit 1; adding the documented compat marker to each → exit 0.                                           | Yes                                    | Falsifiable but convention-based; keep exact term/file list documented. |
| G12 CI                  | Correct workflow passes; comment/Pages/absent cases fail; `echo` impostor passes.                                                                    | False positives                        | B-06.                                                                   |

### G9 nuance worth preserving

The order leak is real but sensitive to runner/runtime/file order. On pinned Node 24, the **full** serial command reproduced Phase 50's `[U]` result (`1 failed | 32 passed`, 282 tests). A two-file invocation (`auth.test.ts` then `portal-dev-bypass.test.ts`) passed 2/16 in one direct replay, while the same pair under the host's Node 22/npm wrapper failed 1/2 with 14 counted tests. This does not weaken G9: it demonstrates why serial/full-suite order testing is necessary and why the inherited “executed” labels must remain runtime-qualified. The source defect is visible at `tests/unit/auth.test.ts:161-165`; the config injection is `vitest.config.mts:13-15`.

## Build, artifact, and deployment evidence

### Pinned external builds

Using Node 24.19.0 and no `.env`:

1. `npm run build:server` with syntactically valid, unreachable placeholder values → **exit 0**.
2. Immediately read the server artifacts:
   - `required-server-files.json`: `output=standalone`, `basePath=""`, `distDir=.next`;
   - `app-path-routes-manifest.json`: all four required route keys present, 44 keys total;
   - `server-reference-manifest.json`: 17 ids, all decoded as server actions.
3. `npm run build:demo` → **exit 0**, `0/109` static pages reported during generation, 109 pages printed in the final route table.
4. Immediately read the demo artifacts:
   - `required-server-files.json`: `output=export`, `basePath=/SMS_Portal`, `distDir=.next`;
   - server-reference manifest: 0 ids/actions;
   - `out`: 104 HTML files, 554 total files, `.nojekyll` and `404.html` present, no `out/api` or `out/health`.

The two builds both write `.next`; Phase 00's ordering rule is correct. Build server → server manifests → typecheck/tests → build demo → demo manifest/census is the correct order.

### GitHub Pages live state

Authenticated GitHub CLI read-only inspection found:

- one active workflow only: `Deploy to GitHub Pages` (`.github/workflows/deploy.yml`);
- latest run `35918529713`, `event=push`, `headSha=e5aaf1e`, conclusion `success`; build ran only install → demo build → upload, then deploy;
- Pages `build_type=workflow`, `html_url=https://niciniv.github.io/SMS_Portal/`, `https_enforced=true`, API `custom_404=false`;
- `main` protection: absent.

Live HTTP replay:

```text
/SMS_Portal/                                      → 200, base-path assets present
/SMS_Portal/atividade/7FQ-29M/                    → 200, old launch page still live
/SMS_Portal/definitely-not-a-route-phase50/       → 404
```

The 404 response was 7,277 bytes, matching local `out/404.html`, and displayed the Next not-found document with base-path chunks. Thus the dossier's previously unconfirmed old-route claim is now confirmed, and R-04's Pages behavior is correct. The API's `custom_404=false` does not contradict serving the generated `404.html`; it describes the repository's custom-404 setting, while Pages served the generated static document for the missing route.

### Workflow supply-chain/tooling facts

- `actions/setup-node@v4` explicitly supports `.node-version`; both `.node-version` and `.nvmrc` are tracked and contain `24.19.0`.
- The proposed YAML parses as 17 steps, 3 `uses`, 14 `run`, job `gates`, and the expected three triggers. Its failure is formatting, not YAML syntax.
- The proposed `actions/upload-pages-artifact@v3` is current for the v3 line and internally uses `actions/upload-artifact@v4`; no option mismatch was found.
- `cancel-in-progress: false` does not mean an unlimited FIFO queue. GitHub concurrency retains one running and one pending job; a newer pending job replaces/cancels an older pending job. Phase 50's phrase “queues a red artifact” (`:242`) is therefore inaccurate. More importantly, without a green-CI dependency an older run may deploy while a newer red main commit waits/fails. Protection, not this concurrency setting, is the intended barrier—and protection is currently absent.

## Tests, fixtures, and meaningful-invariant assessment

The current suite is substantial at the service/contract layer:

- 33 `*.test.ts` files; 229 literal `it/test` blocks plus `it.each` expansions = **284 runtime tests**;
- 634 assertion-site matches; no `.skip`, `.todo`, or `.only` in the suite;
- 20 valid + 12 invalid V1 JSON fixtures, all referenced by tests;
- runtime parallel result on Node 24: **33 files / 284 tests passed**;
- serial result on Node 24: **1 failed / 32 passed; 282 passed**, exposing the known environment leak.

The tests meaningfully exercise authorization boundaries, token hashing/entropy, credential rotation, idempotent event handling, protocol/schema parity, state conflicts, demo persistence/role behavior, URL credential scrubbing, CSP, and pure offline engine behavior. They are not UI/E2E tests: Vitest is configured for Node (`vitest.config.mts:11-20`), and Playwright, jsdom, and Testing Library are absent. In particular, current `game-offline-sync.test.ts:35-279` supplies an in-memory persistence double; it does not execute the real IndexedDB class. Phase 50 correctly keeps R-01/R-10/R-11/R-13/R-14/R-17/R-18 manual (`:416-421`).

The G7 prototype is not a substitute for the committed script: it can detect the five named undefined usages, but cannot see an orphaned definition/print block. Phase 40's A2 remains necessary, as Phase 50 now states.

## Documentation audit

### Claims that are sound and should be preserved

- README correctly distinguishes `build:demo` from `build:server` (`README.md:80-87`) and says the static demo is not production persistence/auth/GameMaker proof (`:102`).
- `npm run dev` does load `.env.local` in development: `scripts/next-target.mjs:24` calls `loadEnvConfig(projectRoot, true)`, and the installed `@next/env` orders development-local files accordingly. The old architecture-audit suggestion that README's `.env.local` command is wrong should not be carried forward.
- The root redirect composes `/SMS_Portal/entrar/` from `APP_BASE_PATH` (`src/app/page.tsx:1-10`); live root HTML/assets confirm the base path.
- The current-architecture status is appropriately cautious: real GameMaker, two-device continuation, reconnection, tablet QR, and staging Neon remain unverified (`docs/current-architecture.md:247-261`).
- PRODUCT and the V1 dossier consistently reserve production authority to the server and identify the browser demo as non-production.
- `docs/implementation/slice-03-05-portal-handoff.md:33-67` is strong about unaccepted real-game/staging/tablet acceptance, but its test count is stale (276 versus 284).

### Stale claims Phase 50 correctly schedules

- README's nonexistent health handlers (`:53`) and obsolete “anonymous session-link / aggregate-only” characterization (`:62`).
- `docs/current-architecture.md:175-186` legacy `/atividade/[token]` and `/health/*` rows; `:259-261` legacy-route status needs a post-purge rewrite.
- `docs/schemas/database-model.md:33-177` still documents all four tables Phase 20 drops, including `audit_events` and `rate_limit_buckets`; G11 correctly catches 19 current stale lines.
- `walkthrough.md:11` still links the live legacy route; `:37-51` lists routes scheduled for deletion; `:63-67` claims 126 tests/99 pages rather than measured 284 tests/109 generated pages. The one-line deletion at `50:546-553` is necessary but insufficient unless the whole file is replaced by the planned archive pointer.
- The database handoff's “276 tests” at `docs/implementation/slice-03-05-portal-handoff.md:26` is not scheduled in Phase 50's correction table and should be updated or explicitly historicalized.
- `docs/demo-visual-plan.md` is labeled non-authoritative at `:5`, which is good, but still contains the old Materials/links route plan and `npm run build` at `:326`; it should point to the current numbered-player demo or be clearly archived.

### Dossier-level wording defect

`docs/refactor-dossier/REFACTOR-DOSSIER.md` still says “104 committed documents” and “oracle green today” in places; Phase 50 records both corrections at `50:542`, and the COMPAT ruling mirrors the untracked-artifact correction. Since the dossier body is not edited by this audit, the Phase-50 supersession must be linked prominently enough that readers do not consume the old row first.

## Exact command/option and cross-platform notes

- `node scripts/next-target.mjs` correctly rejects missing command/target and unknown command/target with exit 1. It spawns `process.execPath` rather than a shell, so the launcher itself is cross-platform.
- The GitHub workflow runs on `ubuntu-latest`; its `test`, `grep`, `for`, `!`, and `wc` bodies are Bash. Phase 50 explicitly disclaims a Windows local promise (`50:415-417`). That is acceptable only while the commands are labeled CI/Bash; the README does not currently repeat that limitation.
- `./node_modules/.bin/prisma validate` is correct on Linux. A raw shell reproduction on Windows must use `node_modules/.bin/prisma.cmd` or the local JS entry; this is tooling-shell syntax, not a repository failure.
- The Phase 00 YAML's `npx tsc` and `npx vitest` calls resolve local packages in the clean CI install. No unknown-option mismatch was found: Vitest 4.1.11 supports both `--no-isolate` and boolean `--fileParallelism=false`; Prisma 7.9.1 supports `migrate diff --exit-code` but has no `--shadow-database-url` flag, matching the dossier.
- `prettier --check .` walks untracked, nonignored files. The audit's external copy contained synthetic files until cleanup; only repository-attributable results are reported here.
- `find`, brace expansion, and `grep -E '[[:space:]]'` are valid in the declared Ubuntu runner. Do not paste those examples into PowerShell without translation.

## Accepted strengths and correct dispositions

The following Phase 50 positions should survive revision:

1. Retire G2: `output: export` structurally omits API route handlers.
2. Demote G3: E625 is the real demo action gate; a successful build's manifest can only be zero.
3. Keep server and demo builds separated in time because both write `.next`.
4. Keep G5 server manifests immediately after `build:server`; the pinned replay validates 4 required handlers and 17 actions.
5. Keep G9: it detects a real environment leak and compares rather than hard-coding one total across refactor phases.
6. Keep G10 as `prisma validate` only; do not pretend it covers migration-history drift.
7. Keep G11's exact-string/-F semantics and compat-note convention, while accepting its deliberately limited three-file scope.
8. Keep all real UI, print, IndexedDB, GameMaker, and tablet checks manual until a browser/IndexedDB harness exists.
9. Keep the docs-truth boundary between seeded-route demo behavior and production/server acceptance.

## Required correction order

1. **Phase 00:** format the proposed `ci.yml`; make its format leg green before protection.
2. **Phase 00/50:** fix G6 with an explicit success wrapper and settle D-1.
3. **Phases 00/10/50:** choose exact-path versus count-only G4 and give the `104→26` edit one numbered owner.
4. **Phases 40/50:** select one size/selector gate implementation and one post-purge baseline; require self-tests.
5. **Phase 10/50:** reissue G7's residual baseline after `materialAudience` disappears.
6. **Phase 00/50:** replace G12 regex with parsed/executed enforcement and prove real PR behavior.
7. **Repository settings:** enforce protection for admins/bypass roles and verify red auto-merge/direct push.
8. **Phase 50/docs:** schedule the handoff count, demo-plan, walkthrough, and deployment-plan corrections; add Docker/start smoke tests.
9. **Final proof:** pinned fresh-clone `npm ci`, all four check legs, serial suite, server build/manifests, demo build/census, real PR, red merge rejection, and Pages deployment from the protected commit.

## Coverage limits and workspace integrity

- No database, migration application, staging Neon, real GameMaker executable, tablet, or two-device session was exercised. Those remain open acceptance work, not gate passes.
- No browser automation was available. LocalStorage interaction, DOM `undefined` class rendering, print output, cross-tab updates, IndexedDB, and responsive UI were inspected in source/tests/artifacts but not manually clicked end to end.
- Proposed `ci.yml`, G6-G8 scripts, post-purge export, and post-refactor branch could not be executed as final artifacts because they do not exist at `e5aaf1e`; their exact bodies/structures were parsed or replayed in isolation where possible.
- The external snapshot remains at `C:\Users\Vitor\AppData\Local\Temp\sms_portal_phase50_audit_a3dd2bb24baf48c1bc856dfde31eaeea` for audit reproducibility.
- One accidental workspace side effect occurred during launcher failure-mode replay: `node scripts/start.mjs --unknown` rebuilt ignored `.next` before exiting 1. `out/` was not rebuilt (mtime remained 23 September), no tracked file changed, and `git diff` is empty. The incident is also the evidence for M-02; all subsequent builds were isolated.
- All dossier/audit files were already untracked at start except this new assigned report. Sibling reports appeared concurrently during the audit. Final verification must confirm this report is the only path this audit added/changed.
