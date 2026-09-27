# P00 Round-2 Independent Review — General / Dynamic Verification

- Phase: P00 (Reproducible Baseline and CI)
- Date: 2026-09-27
- Base commit: `9467757ed436c82bdbace5a78e23b502176318e2` (HEAD). Entire implementation is the staged working-tree change (`git diff --cached`); only untracked file is `.zcodeignore` (out of scope).
- Reviewer toolchain actually used: Node `v22.23.1`, npm `11.6.0`. Repo pins Node `24.19.0` / npm `>=11.6.0 <12` — **discrepancy noted** (see Findings). The implementation's own baseline record (`docs/refactor-implementation-findings/p00/baseline-record.md`) claims acceptance ran on Node `v24.19.0` (portable install) / npm `11.17.0`; npm 11.17.0 is inside the engines range.
- Independence: this reviewer read the runbook, the staged code, and `baseline-record.md` (a P00 deliverable, sanity-checked only). No other file under `docs/refactor-implementation-findings/` was opened.

## Command log (all run serially, one at a time)

| Command | Exit | Key result / notes |
| --- | --- | --- |
| `node --version` / `npm --version` | 0 | `v22.23.1` / `11.6.0`; pinned: `24.19.0` / `>=11.6.0 <12` |
| Root snapshot + `npm run clean:build` | 0 | Printed `Removed .next`, `Removed out`. Root listing diff before/after shows exactly `.next` and `out` removed, nothing else. `.next-demo-dev` and root `*.tsbuildinfo` were absent and are skipped silently (allowed) |
| `node scripts/clean-build-artifacts.mjs someArg` (from repo) | 1 | `clean-build-artifacts takes no arguments; its targets are a fixed allowlist.` |
| Black-box: script invoked with **no args** from a temp dir **outside** the repo (`$TMP/p00-r2-probe/outside-target`) | 1 | Repo root resolved from script location, not cwd (found repo-root `.next-demo-dev`). Refused: `Refusing to delete "...\.next-demo-dev": it is a symbolic link or junction, which could point outside the repository root.` Sentinel file in the outside target survived; junction intact (abort before deletion) |
| Black-box: script invoked with caller-supplied path (`C:/Windows/Temp`) from outside repo | 1 | Rejected: takes no arguments |
| `npx prettier --check REFACTOR_PLAN.md` on a copy **outside** the repo (with repo `.prettierrc.json` copied) | 1 | Proves REFACTOR_PLAN.md is genuinely NOT Prettier-formatted; the repo-wide pass therefore comes solely from `.prettierignore`. `git diff --cached --stat -- REFACTOR_PLAN.md` = empty (fixed record untouched) |
| `npm run format:check` | 0 | `All matched files use Prettier code style!` |
| `npm run lint` | 0 | `eslint . --max-warnings=0` clean |
| `npm run prisma:validate` | 0 | `The schema at prisma\schema.prisma is valid`; ran via npm script (repository-local CLI); loaded `prisma.config.ts`; no datasource complaint, no `DIRECT_URL` placeholder needed |
| `npx vitest run tests/unit/auth.test.ts tests/unit/clean-build-artifacts.test.ts` (run 1) | 0 | 2 files, 16 tests passed (auth 15 + clean-build 1) |
| Same vitest command (run 2) + `npx vitest run tests/unit/auth.test.ts` alone | 0 | 16 tests pass again; auth file alone: 15 pass. Restoration is by construction (see item 4), so order independence holds |
| `npm run typecheck` (after the clean; serial server→demo) | 0 | Both targets pass; repo still typechecks after `clean:build` |
| `npm test` (full suite, normal mode) | 0 | 28 files, 200 tests passed (pre-existing ajv "unknown format uuid/ulid" stderr noise in v1-contracts is non-fatal) |
| Temp cleanup | 0 | Junction removed via `cmd /c rmdir`; `$TMP/p00-r2-probe` deleted; no temp residue |
| Final `git status --short` | 0 | Staged set unchanged; no tracked file modified by any gate; only `?? .zcodeignore` untracked |

## Verification per change-set item

**Item 1 — Baseline record: SATISFIED.**
`docs/refactor-implementation-findings/p00/baseline-record.md` exists and is plausible: base commit matches HEAD `9467757`, records `git status --short` at start, pinned vs local vs acceptance toolchain, and fresh (not reused-dossier) exit codes for format, lint, typecheck, test, Prisma validation, server build, demo build. Its before-state claims were independently corroborated: base `tests/unit/auth.test.ts` really had an `afterEach` that `delete`d `AUTH_DEV_BYPASS`/`APP_RUNTIME_MODE`/`NODE_ENV` (verified via `git show HEAD:`), and REFACTOR_PLAN.md really fails Prettier outside the ignore scope.

**Item 2 — Dockerfile/.dockerignore deleted: SATISFIED.**
Neither file exists in the working tree (staged deletions). `grep -rniE "docker"` over `src`, `scripts`, `package.json`, `.github`, `eslint.config.mjs`, `next.config.ts`, and `tests` finds zero references. No container workflow remains.

**Item 3 — REFACTOR_PLAN.md in .prettierignore: SATISFIED.**
`.prettierignore` line 9 adds `REFACTOR_PLAN.md` (staged diff confirms). Decisive probe: a copy checked outside the repo (with the repo's `.prettierrc.json`) fails `prettier --check` with exit 1, so the repo-wide `format:check` pass is attributable to the ignore entry alone; the file itself has zero staged diff (not reformatted).

**Item 4 — auth.test.ts environment restoration: SATISFIED.**
Full mutation set touched by `tests/unit/auth.test.ts`:
- `loadGatewayWithEnv` (gateway tests) mutates: `APP_RUNTIME_MODE`, `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `APPLICATION_SECRET` (from `validEnvironment`) plus caller-added `NODE_ENV` and `AUTH_DEV_BYPASS` (and `APP_RUNTIME_MODE: "demo"` in one test). All are captured in a `previous` Map **before** assignment and restored in `finally` (delete when previously unset, else restore captured value).
- `isAuthDevBypassEnabled` suite mutates exactly `mutatedKeys = ["AUTH_DEV_BYPASS", "APP_RUNTIME_MODE", "NODE_ENV"]` via `withMutatedEnv`, which captures prior values up front and restores them in `finally`.
- `APP_RUNTIME_MODE` is included in both capture/restore paths.
- The regression "restores the captured prior environment after a mutation cycle" starts with a **nonempty** value (`AUTH_DEV_BYPASS = "preexisting-sentinel"`), asserts the sentinel survives the mutation cycle, and asserts `APP_RUNTIME_MODE` and `NODE_ENV` are restored to their captured priors; its own `finally` also restores the pre-test original.
- Empirically order-independent: the focused pair passes twice, auth passes alone, and the full 200-test suite passes. Superseded base behavior (unconditional `delete` in `afterEach`) confirmed at HEAD.

**Item 5 — scripts/clean-build-artifacts.mjs + clean:build + escape regression: SATISFIED.**
Script (verified by reading and by execution):
- Fixed allowlist: directories `.next`, `.next-demo-dev`, `out`, plus root `*.tsbuildinfo` files discovered by `readdirSync`. Accepts **no caller-supplied path** — any argument exits 1 (probed from both repo and outside cwd).
- Repo root derived from the script's own location, so cwd cannot redirect it (probed from a temp dir outside the repo: it still operated on the repo root).
- Every target is `lstat`-checked for symlink/junction and `realpath`-checked for containment; rejection aborts with exit 1 before deleting that target. Black-box probe: repo-root junction `.next-demo-dev` → outside temp dir with sentinel file was refused (exit 1), sentinel survived, link survived.
- `npm run clean:build` removed exactly `.next` and `out` (root diff proves nothing else changed).
- Escape regression: `tests/unit/clean-build-artifacts.test.ts` — one focused test (junction on Windows, documented as symlink on POSIX) asserting the throw and that the outside `keep.txt` survives; cleans up its `os.tmpdir()` fixture in `finally`. No general fixture suite. Passes repeatedly.

**Item 6 — prisma:validate npm script, used everywhere: SATISFIED.**
`package.json` defines `"prisma:validate": "prisma validate"` (repository-local CLI via npm script). Every validation call site uses the script: the `check` chain (`npm run ... && npm run prisma:validate && ...`) and `.github/workflows/ci.yml` (`run: npm run prisma:validate`). Repo-wide grep found no direct `prisma validate` invocation bypassing the script in first-party trees.

**Item 7 — .github/workflows/ci.yml: SATISFIED for all P00-required properties** (with the phase-boundary finding below).
Verified present: `pull_request` + `push: branches: ["main"]` triggers; `node-version: "24.19.0"` (pinned); `npm ci`; `npm run clean:build`; `format:check`; `lint`; `prisma:validate`; current typecheck commands (`typecheck:server`, `typecheck:demo`) and test command (`npm test`); both builds serially (`build:server` then later `build:demo`, matching the target-hygiene rule); CI-only loopback server config (`DATABASE_URL: postgresql://ci:ci@127.0.0.1:5432/ci?sslmode=disable`, `NEON_AUTH_BASE_URL: http://127.0.0.1:8080/`); non-secret placeholder secrets well above 32 chars (`ci-placeholder-cookie-secret-…` = 61 chars, `ci-placeholder-application-secret-…` = 66 chars); **no** `services:` block, no Postgres container, no shadow database, no schema-drift steps; no YAML-parsing/snapshotting unit test exists (grep over `tests/` for `ci.yml`/`.github`/`yaml` = no matches).

## Verification per acceptance bullet

- "The baseline is reproducible on the pinned toolchain." — **PARTIAL**: the baseline record documents acceptance on Node 24.19.0; CI pins 24.19.0; this reviewer reproduced every gate green on Node 22.23.1. A real CI run on the pinned version is post-merge evidence and cannot be produced locally (the runbook itself distinguishes workflow text from actual run evidence).
- "`npm test` passes once in its normal mode and the environment restoration test is order independent." — **YES**: full suite 28 files / 200 tests pass in normal mode; restoration is capture-restore by construction; focused files pass twice and in isolation.
- "CI runs real commands, but no separate unit tests parse or snapshot its YAML." — **YES**: every ci.yml step invokes real npm scripts; no test references the workflow.
- "No Docker build, container workflow, `Dockerfile`, or `.dockerignore` remains." — **YES**.
- "Pages deployment remains unchanged until P50; do not claim it is gated yet." — **NO at the P00 phase boundary** (see Finding 1). The staged change deletes `.github/workflows/deploy.yml` (verified its HEAD content: independent push-triggered Pages deploy) and `ci.yml` already contains `upload-pages-artifact` (push-to-main only) plus a dependent `deploy` job with job-scoped `pages: write`/`id-token: write`, the preserved `github-pages` environment/URL, and the `pages` concurrency group with `cancel-in-progress: false`. This is exactly the runbook's **P50** end state ("Fold Pages publication into ci.yml… Delete the independent push-triggered deploy.yml"), so the final implementation is conformant — but P00 cannot certify "Pages unchanged".

## Findings

1. **MINOR — Phase-boundary blending of P50 CI work into the staged change.** `deploy.yml` is deleted and Pages upload/deploy is already folded into `ci.yml` at what this review scopes as P00; the P00 acceptance bullet "Pages deployment remains unchanged until P50" is therefore not certifiable. Mitigation: the ci.yml structure matches the runbook's P50 Final CI Sequence point for point (gate builds demo once; upload gated to `push` + `refs/heads/main`; deploy job `needs: gate`, job-scoped permissions, `github-pages` environment, `pages` concurrency, `cancel-in-progress: false`), so no defect exists in the final state — this is a sequencing/claim-scoping deviation only.
2. **INFO — Reviewer toolchain discrepancy.** Gates were verified on Node `v22.23.1` / npm `11.6.0` (repo pins Node `24.19.0`, npm `>=11.6.0 <12`). All gates pass anyway; the implementation's baseline record separately claims Node `24.19.0` (portable install) / npm `11.17.0` for its acceptance runs, and CI pins `24.19.0`. Engines-range compliance holds for all npm versions involved.
3. **INFO — clean-build-artifacts abort semantics are per-target, not transactional.** The script cleans targets one at a time and aborts at the first rejected target, so allowlist targets ordered before a rejected one (e.g. `.next` before a junctioned `.next-demo-dev`) are already removed when it exits 1. The runbook requires per-target resolution + rejection, not all-or-nothing; each individual removal is fully guarded (lstat link check + realpath containment). Observed, not a defect.
4. **INFO — Baseline record uses npm 11.17.0** while `packageManager` pins `npm@11.6.0`; within the declared engines range, no impact observed.

## Acceptance criteria not satisfied

- None functionally. The single P00 acceptance bullet that cannot be certified — "Pages deployment remains unchanged until P50" — is unsatisfiable by construction in a staged change that also implements P50, and the implemented end state matches the runbook's P50 CI specification exactly (Finding 1, MINOR).

## Verdict

VERDICT: PASS-WITH-FINDINGS
