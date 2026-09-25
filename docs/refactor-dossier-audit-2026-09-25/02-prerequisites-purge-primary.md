# Phase 00 / Phase 10 primary audit — prerequisites and Generation A purge

**Audit date:** 2026-09-25  
**Repository baseline:** `main` at `e5aaf1e2891dbb1804950223eb9f0765e7dbeb65`  
**Primary targets:** `docs/refactor-dossier/phases/00-prerequisites.md` and `docs/refactor-dossier/phases/10-purge-generation-a.md`  
**Governing/index evidence read in full:** `docs/refactor-dossier/README.md`, `docs/refactor-dossier/phases/README.md`, `docs/refactor-dossier/REFACTOR-DOSSIER.md`, and `docs/refactor-dossier/COMPAT-POLICY.md`  
**Inherited evidence replayed:** INV-A, VER-A, RV-00, RV-10, RV-X, INV-F, VER-F, NOTE-00, ADJ-03, and AUDIT. No inherited result was accepted without a current check.

## Executive verdict

**Not implementation-ready as written.** The core Phase 10 manifest is unusually solid: all 46 paths are tracked, all per-file counts reproduce, the total is exactly **7,802 physical lines**, and a safe in-memory TypeScript deletion replay yields exactly one source diagnostic plus the documented 63 stale-validator diagnostics. The Phase 00 baseline also reproduces, including the order-dependent serial-suite failure.

The blocker is orchestration and rollback, not the deletion census:

1. **Major — Phase 00 still carries stale pre-correction ownership/ordering language.** It calls the census gap unresolved and tells the implementer not to complete protection before Phase 10, even though Phase 10 now contains the numbered fix.
2. **Major — Phase 00's branch-protection PUT is not an executable command.** It supplies neither a request body nor all fields GitHub's update endpoint requires. The remote `main` is presently unprotected.
3. **Major — Phase 00 rollback can leave `main` requiring a check that no longer exists.** It says to revert `ci.yml` but does not require removing/disabling protection first.
4. **Major — Phase 10 rollback covers Phase 20 only.** The governing index makes later phases serial dependents, so a Phase 10 rollback after Phase 30/40/50 needs a reverse-order plan.
5. **Major — the Phase 10 referrer-security gate is transient, underspecified, and leaves no permanent regression test.**
6. **Major — all decisive local replay remains on unsupported Node 22.23.1 rather than the repository's pinned Node 24.19.0.**

Two smaller inherited-evidence defects also survived prior refutation: VER-A says there are 12 deleted-tree `generateStaticParams` occurrences plus four survivors, but the tree has **11 + 4 = 15**; RV-10 labels 6,579 as `tests + scripts`, while scripts add another 142 lines and the 26,675 denominator correctly excludes them.

## Findings

### F-01 — MAJOR — Phase 00 still presents the resolved census gap as unresolved

**Locations:**

- `docs/refactor-dossier/phases/00-prerequisites.md:29,293-298,373-384,414` repeats that the `104 → 26` owner is missing, calls the issue “unresolved,” says it was “implemented in none,” and tells the implementer not to land step 7 before the gap is closed in Phase 10.
- `docs/refactor-dossier/phases/10-purge-generation-a.md:214-224` now contains the numbered tie-break step, exact edits, verification, failure handling, and same-commit requirement.

At the current revision, Phase 10's work order has already closed the documentation gap, so the Phase 00 warning can be satisfied without running Phase 10 first. It is therefore stale rather than a literal dependency cycle. It is still materially misleading because Phase 00 is designed to be read alone: its own scope, work order, handoff, and Evidence table all tell the implementer that no owner step exists, while the successor phase now says the opposite.

Required repair: replace the Phase 00 blocker callout with the settled order—Phase 00 lands the green `ci.yml`; Phase 10 edits `104 → 26` atomically with the purge; after the Phase 10 PR has demonstrated the required `gates` check, require that context in branch protection. This removes the stale “do not land step 7” language without pretending that the census edge does not exist.


### F-02 — MAJOR — branch-protection step 7 is not a runnable PUT specification

**Location:** `docs/refactor-dossier/phases/00-prerequisites.md:293-298`.

Line 295 names the endpoint and desired fields in prose but gives only:

```text
gh api -X PUT repos/niciniV/SMS_Portal/branches/main/protection
```

`gh api -X PUT` supplies a method but no request body. No `-F`, `--input`, or complete JSON payload follows. Current GitHub REST OpenAPI requires a JSON body and these top-level properties: `required_status_checks`, `enforce_admins`, `required_pull_request_reviews`, and `restrictions`. The current schema also requires `strict` and `contexts` inside `required_status_checks`; it specifies arrays for `restrictions`. The work order mentions only the `gates` check and one approving review, leaving admin enforcement, push restrictions (including the intended null/non-null state), and nested review policy unspecified.

Independent remote baseline:

```text
$ gh api repos/niciniV/SMS_Portal/branches/main/protection
{"message":"Branch not protected", ... "status":"404"}
```

The phase therefore has neither an executable enable command nor an observed result. It should publish a complete `gh api --method PUT ... --input -` JSON payload (or an equivalent GitHub CLI sequence), including deliberate values/nulls for all required fields, then verify both protection subresources and a real red PR.

### F-03 — MAJOR — Phase 00 rollback can brick mergeability after removing its only required check

**Locations:** `docs/refactor-dossier/phases/00-prerequisites.md:344-352`.

The rollback says to revert step 5 and return to the `deploy.yml`-only status quo, then separately observes that branch protection is not in git. It does **not** order protection removal before the workflow revert. If `gates` is required and `ci.yml` is removed, GitHub can retain an expected check context that no workflow reports; subsequent PRs can remain permanently “Expected — Waiting for status to be reported.”

Required repair: make disable/delete of protection an explicit prerequisite to merging the `ci.yml` removal, or preserve/replace the check in the same rollback. The current sentence “Say so in the revert PR” is disclosure, not a safe rollback procedure.

### F-04 — MAJOR — Phase 10 rollback is incomplete after later phases

**Locations:** `docs/refactor-dossier/phases/10-purge-generation-a.md:268-270`; `docs/refactor-dossier/phases/README.md:20`.

Phase 10 says that if Phase 20 has landed, the order is `revert 20 → revert 10`. It says nothing about Phases 30, 40, or 50, although the governing index makes them serial dependents. Restoring `service-container.ts`, `security/tokens.ts`, route trees, and old module boundaries after the seam/decomposition phases can conflict with assumptions that those files are gone. “Revert the whole Phase 10 commit” is atomic only within that commit; it is not a programme rollback.

The runbook must say either: rollback is only supported before Phase 20; or later phases are reverted in reverse dependency order after impact review. The absolute statement “`main` is never red” is also too strong for an untested multi-commit rollback.

### F-05 — MAJOR — the referrer-security exit gate is not a durable or fully specified gate

**Locations:** `docs/refactor-dossier/phases/10-purge-generation-a.md:175-194,232,260,294-295`; `src/proxy.ts:108-118`; `tests/unit/proxy.test.ts:6-26`.

The code correction itself is right: delete only `src/proxy.ts:113`, preserve both `/jogar` arms at `:114-115`, and preserve the `no-referrer` branch. The current `proxy.test.ts` has no referrer assertion. The phase's replacement is a **transient, hand-authored** `tests/unit/tmp-referrer-probe.test.ts`, run once and deleted. It supplies neither test source nor an exact shell command/cleanup trap, and no permanent regression test remains after the phase.

That makes a security-sensitive edit dependent on an ephemeral local artifact, while the normal suite remains structurally blind to it. The phase's inherited scratch execution is useful evidence, not an implementation gate that another executor can reproduce from the document. Commit the referrer cases in `proxy.test.ts` and update the post-purge suite arithmetic to **27 files / 183 tests**, or provide a complete temporary-test command with guaranteed cleanup and retain a live-server/header acceptance record. The phase's reason for avoiding 183—because Phase 50 has not yet added a test—is not a safety argument for leaving Phase 10 unprotected.

### F-06 — MAJOR — the authoritative runtime was not replayed

**Locations:** `docs/refactor-dossier/phases/00-prerequisites.md:18,110,180-184,324`; `.node-version:1`; `.nvmrc:1`; `package.json:5-9`.

The repository pins Node **24.19.0** in all three places; the audit shell is Node **22.23.1**, as were the inherited decisive runs. The proposed CI correctly uses `node-version-file: .node-version`, so CI would be authoritative, but Phase 00 still labels local counts and commands as a baseline and Phase 20 bakes Node 22 into a sibling expectation. Before handoff, rerun at least the entry suite, proposed workflow-equivalent build gates, and the two route validator mechanics under Node 24.19.0. Until then, the results here are strong Node-22 evidence, not proof of the pinned toolchain.

### F-07 — MINOR — two inherited report counts are wrong

1. `docs/refactor-dossier/reports/VER-A-purge-closure-verification.md:260` says `generateStaticParams` has **12 deleted-tree and 4 surviving** occurrences. Independent `git grep` over tracked `src/*.tsx` returns **15 total = 11 deleted + 4 surviving**. The current phase files do not repeat the wrong 12, but the inherited report is cited as proof and should be corrected.
2. `docs/refactor-dossier/reports/RV-10-purge-refutation.md:76` describes 6,579 as `tests + scripts`. Current physical counts are **6,579 tests** and **142 scripts**; `20,096 + 6,579 = 26,675` is the correct denominator Phase 10 uses. Including scripts gives 26,817, so the report's label is false even though the resulting Phase 10 percentages happen to use the intended test-only denominator.

### F-08 — MINOR — “closed” and “minimal” need a narrower proof boundary

**Locations:** `docs/refactor-dossier/phases/10-purge-generation-a.md:5,7,92,156-160,198`; `docs/refactor-dossier/README.md:61`.

The evidence proves:

- all paths in the **46-file manifest** exist and are tracked;
- their line totals are exact;
- the source-only static import/reference closure has exactly one surviving edge, `status-badge.tsx → portal-view-service.ts`;
- an in-memory TypeScript replay has exactly one source diagnostic once generated validators are excluded, and 64 total diagnostics with all three validator roots retained;
- no `@runtime/*` alias target is in the delete set, and no deleted path survives in the route-string sweep except the two intentionally handled cases.

It does **not** prove that the 46 files are the minimal set for removing every artifact conceptually associated with Generation A. The phase itself identifies pre-existing dead survivors and an unlinked `entrar/recuperar` page (`10-purge-generation-a.md:198,240,292`), and Phase 50 still owns stale docs. “Closed and minimal” is defensible only as “closed relative to the prescribed manifest and static first-party graph.” The report should use that qualification consistently.

## Independent replay: commands and results

All commands ran from the repository root on 2026-09-25. Non-mutating checks used `--incremental false`; the 356,779-byte `tsconfig.tsbuildinfo` SHA-256 was identical before and after.

### Repository and baseline

| Check | Result |
|---|---|
| `git rev-parse HEAD` / branch | `e5aaf1e2891dbb1804950223eb9f0765e7dbeb65` / `main` |
| `git status --short` | Only pre-existing untracked dossier/audit directories; no tracked diff at audit start/end |
| `node --version` | `v22.23.1` (pin is `24.19.0`) |
| tool versions | npm `11.6.0`; TypeScript `6.0.3`; Vitest `4.1.11`; Prettier `3.9.6`; ESLint `9.39.5`; Prisma `7.9.1`; GitHub CLI `2.89.0` |
| `npx prettier --check .` | exit **1**, only `[warn] REFACTOR_PLAN.md` |
| `npm run lint` | exit **0** |
| `npx tsc -p tsconfig.json --noEmit --incremental false` | exit **0** |
| `npx tsc ... --listFilesOnly` | **1,706** files |
| `./node_modules/.bin/prisma validate` | exit **0**, schema valid; no database command/contact |
| `npx vitest run` | **33 files / 284 tests passed**, exit 0 |
| `npx vitest run --no-isolate --fileParallelism=false --reporter=json` | exit **1**; **33 suites, 282 assertions, 32 suites passed, 1 suite failed**; `portal-dev-bypass.test.ts` fails at import because `APP_RUNTIME_MODE` is undefined. This independently proves the “lost two cases” defect, not a failed assertion. |
| `git ls-files .github/workflows` | only `.github/workflows/deploy.yml` |
| `gh api repos/niciniV/SMS_Portal/branches/main/protection` | HTTP **404**, `Branch not protected` |
| `git ls-files prisma/migrations` | **7** paths: six migration SQL files + `migration_lock.toml` |


### Counts and manifests

A tracked-file expansion of the phase tables produced:

- Route trees: **22 files / 1,754 lines**.
- Services/components: **18 / 3,458**.
- Tests: **6 / 2,590**.
- Total: **46 / 7,802**, all tracked; per-file counts matched the phase table.
- Handwritten TS: `src` **20,096** + `tests` **6,579 = 26,675**; `src` CSS **7,337**; TS+CSS **34,012**.
- Ratios: `7,802 / 26,675 = 29.254%` → **29.3%**; `7,802 / 34,012 = 22.938%` → **22.9%**.
- Deleted test cases: static direct-case counts **56 + 24 + 13 + 5 + 2 + 2 = 102**; six files removed leaves **27 test files** and runtime arithmetic **284 − 102 = 182** (the destructive post-purge run itself was not repeated).

### Generated validators, actions, routes, and export

- All three validator copies exist and each has **448 lines / 44 unique `typeof import` refs / 21 purge-tree refs / 20 page refs + one layout ref**. The stale exposure is therefore **63**, not 60.
- `.next/server/server-reference-manifest.json`: **17 total ids, 17 node, 0 edge, 17 server actions**, filename split **1 / 1 / 10 / 4 / 1** across `entrar/actions.ts`, `sign-out-action.ts`, `adult-portal-actions.ts`, `player-access-actions.ts`, `jogar/actions.ts`.
- `.next/app-path-routes-manifest.json`: **44 route keys**; all four required `/api/v1/player/*` keys found.
- `out`: **104 HTML files**, **0 tracked files**, no `out/BUILD_ID`; `.next/BUILD_ID` exists and `.next/required-server-files.json` says `output: standalone`, proving the current `.next` is server-owned.
- `out/atividade`: four token directories, each with **13 HTML documents** = 52. The pre-purge 104 − seven-tree 78 = post-purge 26 arithmetic is sound.

### Import/reference closure

A safe TypeScript compiler-host replay masked the 46 paths without editing disk:

- source roots only: **1 diagnostic**, `src/components/portal/status-badge.tsx:1 TS2307` for `portal-view-service`;
- with generated roots: **64 diagnostics** = 63 validator-root missing-module errors + the same one source error;
- no `TS2344` appeared in this in-memory mask because no build was run to cross-contaminate separate generated route modules. The inherited scratch execution remains the evidence for that secondary build failure mode.

A deletion-aware route-string sweep found exactly four survivors:

- `src/proxy.ts:113` — intentionally removed by Phase 10 step 7;
- `tests/unit/auth.test.ts:146,147,154` — intentionally re-pointed by step 6.

`git grep` found **15** `generateStaticParams` occurrences: **11 deleted, 4 surviving**. `git grep 'composes:'` over source CSS/SCSS returned **0**. A resolver over **200 tracked code files / 605 import-like edges** found no unresolved first-party relative/`@/` specifier and no deleted target among the **18 alias entries / 17 distinct targets** in `next.config.ts`. The two config families have 9 keys each; 24 `@runtime` import statements are in `src`, none in tests.

## Proposed CI and gate audit

The embedded Phase 00 YAML was extracted from the phase file and parsed with repository `js-yaml`:

```text
parse=true; triggers=pull_request,push,workflow_dispatch;
permissions={"contents":"read"}; jobs=[gates]; runs-on=ubuntu-latest;
steps=17; uses=3; run=14; node-version-file=.node-version;
four check legs=4/4; pages/id-token mapping keys=0;
prisma validate=1; expected 17=1; out/api prose=1;
forbidden Prisma strings=0; E625-risk+process.exit=0
```

This confirms the corrected proposal is syntactically valid and satisfies the text contracts. The following limitations remain:

1. **Count-only document census.** It catches a changed number, not wrong documents. Both phases acknowledge this; it remains a known false-green substitution risk.
2. **No path-set assertion.** The phantom expected-path list was correctly removed, but “26 documents” can be the wrong 26.
3. **No `test:contracts` separate leg.** This is not needed for the 33-file suite because `v1-contracts.test.ts` is already included, but the script itself is not invoked and the dossier's ownership remains open.
4. **Server manifest count is count-only.** `17` can be seventeen wrong action IDs; the filename split is documented but not asserted.
5. **Local `.env` caveat is valid.** `scripts/next-target.mjs:24` loads local environment configuration, so CI with placeholders remains the honest server-build measurement.
6. **`GAME_CLIENT_URL` is omitted.** The server build can succeed with `/jogar` rendered as “missing”; if the purpose is compilation/gate health this is acceptable, but the artifact is not production-representative. VER-F already records this caveat.
7. **Branch protection and real Actions execution were not performed.** No PR, merge, or protection mutation is authorized by this audit.


## Assumptions, corrections, and acceptance conditions

### Confirmed sound

- 46-file manifest, all physical line counts, 7,802 total, and both percentages.
- Subtotals 1,754 / 3,458 / 2,590 and 27/182 test arithmetic.
- 63 dirty-workstation validator errors and the three-root cleanup instruction.
- One genuine source import blocker: `status-badge.tsx:1`.
- Proxy edit is line 113 only; lines 114–115 are live security behavior.
- `104 → 26` belongs in Phase 10's same commit as the deletions, and no expected-path list exists to edit.
- No alias target is in the deletion set; Phase 10 and Phase 30 are file-disjoint but not independent phases.
- No database is needed for Phase 00 `prisma validate` or Phase 10's code-only work.
- The owning compat ruling correctly leaves sequential migration history and no shadow-DB drift gate.

### Must change before implementation handoff

1. Remove the Phase 00 stale “unresolved census owner” language and state the settled Phase 00 → Phase 10 → protection order.
2. Supply a complete branch-protection PUT payload and current observed verification.
3. Make CI-workflow rollback remove/disable the required check first.
4. Supply reverse-order/impact-aware Phase 10 rollback after later phases.
5. Make the referrer test permanent and executable.
6. Re-record decisive results on Node 24.19.0.
7. Correct VER-A's `generateStaticParams` count and RV-10's tests-plus-scripts label.

## Coverage limits

- No source, config, test, schema, migration, dossier file, build artifact, or GitHub setting was edited. The only created file is this report.
- No `next build`, `next dev`, `prisma generate`, migration, database connection, branch-protection mutation, PR creation, or merge was run. Existing `.next`/`out` evidence was inspected but not rebuilt.
- The destructive 46-file execution and post-purge 27/182, 26-document, 0-demo-action, 17-server-action results are credited to `VER-A`/`RV-10` and the current phase's recorded scratch run, not represented as newly executed by this audit.
- The proposed CI YAML was parsed and structurally checked, but GitHub-hosted Actions behavior, artifact upload, Node 24 behavior, and the live `gates` check name remain unobserved.
- The real seeded GitHub Pages `/atividade/7FQ-29M/` page and external `Heroes_Trial` consumer were outside this repository audit.
- The in-memory compiler-host replay is not a substitute for a clean-checkout `npm ci` + both Next builds. It is used narrowly to validate deletion closure and generated-validator contamination.

## Final disposition

The numerical and code-closure work is ready for implementation after the orchestration corrections. Do not execute the six-phase programme from the current files without replacing the incomplete protection/rollback instructions and stale Phase 00 ownership callout. Treat the Phase 10 referrer test and Node-24 replay as pre-merge acceptance requirements, not optional follow-up.

