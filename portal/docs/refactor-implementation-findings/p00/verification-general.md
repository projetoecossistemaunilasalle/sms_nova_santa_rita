# P00 Verification Report (general verification agent)

Date: 2026-09-26
Base commit verified: `9467757ed436c82bdbace5a78e23b502176318e2` (matches `git rev-parse HEAD`; all P00 work is uncommitted on top of it)
Toolchain used for this verification: Node `v24.19.0` (`C:/Users/Vitor/tools/node-v24.19.0-win-x64`), npm `11.17.0` (matches the pinned toolchain in the baseline record and `engines.node = 24.19.0` in package.json).

## Scope verified

Working tree diff (`git status --short`) contains exactly the expected files:

- Deleted: `Dockerfile`, `.dockerignore`
- Modified: `.prettierignore` (+`REFACTOR_PLAN.md`), `package.json` (+`clean:build`, +`prisma:validate` only), `tests/unit/auth.test.ts` (env restoration)
- New: `.github/workflows/ci.yml`, `scripts/clean-build-artifacts.mjs`, `scripts/clean-build-artifacts.d.mts`, `tests/unit/clean-build-artifacts.test.ts`, `docs/refactor-implementation-findings/p00/baseline-record.md` (+ this report)
- `deploy.yml` is untouched (not in the diff; last commit `06baea2`).

### Item 1 — Baseline record

`docs/refactor-implementation-findings/p00/baseline-record.md` is plausible and cross-checks cleanly against the repository:

- Base commit matches HEAD; branch `main`.
- Pinned Node `24.19.0` matches `package.json` `engines.node` and `.nvmrc`/`.node-version`; `packageManager: npm@11.6.0` with engines `>=11.6.0 <12`.
- Claimed package versions (`next@16.3.2`, `prisma@7.9.1`, `typescript@6.0.3`, `vitest@4.1.11`, `react@19.2.8`) match both `package.json` and the installed lockfile.
- Baseline test count (33 files / 284 tests) plus exactly the 2 new P00 tests equals the 34 files / 286 tests observed now, which corroborates the recorded baseline.
- Exit codes recorded for all seven commands (format:check, lint, typecheck, test, prisma validate, build:server, build:demo), including the honest note that `format:check` failed on `REFACTOR_PLAN.md` pre-P00.

### Item 2 — Docker removal

- `Dockerfile` and `.dockerignore` deleted; no replacement container files, docs, or tests added. `find . -iname "*docker*"` (excluding node_modules/.git/.next) returns nothing.
- Repo-wide grep for `docker` (md/yml/json/mjs/ts/tsx): remaining mentions are only in explicitly historical documents — `docs/agent-reviews/*`, `docs/architecture-audit-2026-09-23.md`, `docs/refactor-dossier*/*`, `docs/refactor-implementation-findings/p00/baseline-record.md:36` (records the deletion requirement itself), `portal-v1-specification.md:256`, and `docs/implementation/phase-01-foundation-contracts.md:36`. README, workflows, and scripts are clean. Details in Finding 3.

### Item 3 — Prettier ignore

- `.prettierignore` now contains `REFACTOR_PLAN.md`. `npm run format:check` exits 0 ("All matched files use Prettier code style!") on the pinned Node.

### Item 4 — auth.test.ts env restoration

- `tests/unit/auth.test.ts` replaces the old `afterEach` (which deleted the keys) with a `withMutatedEnv` helper that captures `AUTH_DEV_BYPASS`, `APP_RUNTIME_MODE`, and `NODE_ENV` before each mutation cycle and restores the captured values (deleting only keys that were unset) in a `finally` block.
- New regression `restores the captured prior environment after a mutation cycle` seeds `AUTH_DEV_BYPASS = "preexisting-sentinel"` (nonempty) and asserts, after the helper returns, that the flag equals the sentinel and that `APP_RUNTIME_MODE`/`NODE_ENV` equal their captured priors.
- Order independence: `npx vitest run tests/unit/auth.test.ts` passes (15 tests) and passes with `--sequence.shuffle`. See Finding 2 for a hygiene note on the sentinel.

### Item 5 — clean:build

- `package.json` adds only `"clean:build": "node scripts/clean-build-artifacts.mjs"` and `"prisma:validate": "prisma validate"`; all other scripts are unchanged (verified against `git diff`).
- `scripts/clean-build-artifacts.mjs`:
  - Fixed allowlist: directories `.next`, `.next-demo-dev`, `out`, plus any root-level `*.tsbuildinfo` found via `readdirSync(root, { withFileTypes: true })`. No recursive scanning, no caller configuration.
  - CLI accepts no arguments: `process.argv.length > 2` exits 1 with "clean-build-artifacts takes no arguments". Verified live: `node scripts/clean-build-artifacts.mjs unexpected-arg` exits 1 and no artifacts were deleted.
  - Repo root is derived from `import.meta.url` (script location), not the current working directory, so every target resolves inside the repository.
  - Junction/symlink rejection: `lstatSync` (not `stat`) per target, `isSymbolicLink()` throws before any deletion, then a `realpathSync` containment check (`isInsideRoot`) rejects targets whose real path escapes the root. Delete happens only after both checks pass.
  - Main-module guard: resolves `import.meta.url` vs `process.argv[1]`, case-insensitive on win32; inert when imported by vitest.
- `scripts/clean-build-artifacts.d.mts` is needed and correct: `tsconfig.json` has `allowJs: false` and includes `**/*.mts`, so the test's `import { cleanBuildArtifacts } from "../../scripts/clean-build-artifacts.mjs"` requires a `.d.mts` for `tsc --noEmit` to resolve it (moduleResolution `bundler`); signature `(repoRoot: string) => string[]` matches the implementation. `npm run typecheck` exits 0.
- `tests/unit/clean-build-artifacts.test.ts` contains exactly ONE focused escape regression (no general filesystem-fixture suite): it builds a temp root with `fs.symlinkSync(outsideDir, root/.next, "junction")` — junctions work unelevated on Windows and the `type` argument is ignored on POSIX where a plain directory symlink is created — asserts the cleaner throws `/symbolic link or junction/`, and asserts the outside target file survived. Passes on this Windows machine (verified in the vitest run below); the mechanism is lstat visibility, identical on Linux CI.

### Item 6 — prisma:validate

- `package.json` adds `"prisma:validate": "prisma validate"`. The only live invocation of schema validation is `npm run prisma:validate` in `ci.yml:46`. No other scripts/docs/workflows invoke `prisma validate` directly (remaining mentions are historical docs and REFACTOR_PLAN prose).

### Item 7 — CI workflow

`.github/workflows/ci.yml` (only new workflow; `deploy.yml` untouched):

- Valid YAML: `npx prettier --check .github/workflows/ci.yml` passes (it is also covered by the repo-wide `format:check`), and a `js-yaml` parse confirms structure.
- Triggers: `on: pull_request` (all PRs) and `push: branches: ["main"]`. `permissions: contents: read`.
- Node pinned: `actions/setup-node@v4` with `node-version: "24.19.0"`, `cache: npm`.
- Step order exactly as the runbook requires: `npm ci` → `npm run clean:build` → `npm run format:check` → `npm run lint` → `npm run prisma:validate` → `npm run typecheck` → `npm test` → `npm run build:server` → `npm run build:demo` (builds serial, real commands — no `exit 0`, no skips).
- CI-only server config: `DATABASE_URL` and `NEON_AUTH_BASE_URL` point at `127.0.0.1` loopback; `NEON_AUTH_COOKIE_SECRET` and `APPLICATION_SECRET` are non-secret `ci-placeholder-...` literals whose random suffix is 32 hex chars (values 60+ chars). No `services:` block, no Postgres container, no shadow database, no `prisma migrate`, no schema-drift infrastructure.
- No unit tests reference or snapshot `ci.yml` (grep over `tests/` is empty).

### Checks run during this verification (all on Node 24.19.0 / npm 11.17.0, no builds executed)

| Check | Result |
| --- | --- |
| `git status --short` / `git diff` | Expected file set only; `deploy.yml` untouched |
| `npm run format:check` | exit 0 |
| `npm run lint` | exit 0 (`--max-warnings=0`) |
| `npm run typecheck` | exit 0 (confirms the `.d.mts` resolves) |
| `npm test` (normal mode) | exit 0 — 34 files, 286 tests passed |
| `npx vitest run tests/unit/auth.test.ts --sequence.shuffle` | exit 0 — 15 tests passed |
| `npx vitest run tests/unit/auth.test.ts tests/unit/clean-build-artifacts.test.ts` | exit 0 — 16 tests passed (junction escape regression exercised on Windows) |
| `node scripts/clean-build-artifacts.mjs unexpected-arg` | exit 1, no deletions |
| YAML validation of `ci.yml` | prettier check + js-yaml parse pass |

## Findings

1. **INFO — Regression test leaves its own sentinel in the environment afterwards** (`tests/unit/auth.test.ts:186`). The new regression seeds `process.env.AUTH_DEV_BYPASS = "preexisting-sentinel"` before calling `withMutatedEnv`, so the helper captures the sentinel as the "prior" value and restores to it — meaning the sentinel remains in `process.env` for any later test in the same worker under shuffle. **Not a runbook violation**: the requirement is "starts with a nonempty value and proves restoration", which it does. It is also harmless in practice: `"preexisting-sentinel"` fails closed via `authDevBypassSchema.catch(false)` (`src/server/config/env.ts:123`) and the bypass additionally requires `APP_RUNTIME_MODE === "server"`; the `--sequence.shuffle` run passes. Test-hygiene nit only (the test could delete its own seed afterwards).
2. **INFO — Job-level CI env applies to every step, not only builds** (`.github/workflows/ci.yml:18-22`). `DATABASE_URL`, `NEON_AUTH_*`, `APPLICATION_SECRET` are set for format/lint/test steps too. Harmless (nothing contacts a service; values are loopback/placeholders) and arguably necessary since env validation can run at import time. **False alarm**.
3. **INFO — Residual Docker prose in two historical, non-dossier documents**. `portal-v1-specification.md:256` ("Dockerized Node.js application plus Neon") — the document's header explicitly marks it "Status: Historical proposal; not the current product source of truth". `docs/implementation/phase-01-foundation-contracts.md:36` ("Create a production multi-stage Dockerfile") — a historical record of already-executed v1 phases (that Dockerfile is the one P00 deleted). P00 required deletion with "no container replacement/docs/tests"; editing these was out of scope, and nothing in README/DESIGN/PRODUCT/workflows/scripts presents Docker as currently supported. **False alarm** (optionally worth a sweep in a later docs-focused phase).
4. **INFO — Cleaner rejects all symlinked targets, not only escaping ones** (`scripts/clean-build-artifacts.mjs:57-61`). A `.next` junction pointing inside the repo would also be refused. Stricter than the runbook's "rejects junctions/symlinks that could escape"; the safe direction. **False alarm**.
5. **INFO — Exported `cleanBuildArtifacts(repoRoot)` accepts a root parameter** (`scripts/clean-build-artifacts.mjs:44`). The runbook's "accepts no caller-supplied path" applies to the script's CLI surface, which is guarded (argv rejection + root derived from the script's own location); the parameter exists solely so the one focused regression can run against a temp fixture without touching repository artifacts. **False alarm**.
6. **INFO — Test-count arithmetic corroborates "exactly one" regressions.** Baseline 33 files / 284 tests (baseline-record) + 1 file / +2 tests = observed 34 / 286, matching the runbook's "ONE focused escape regression" and "one regression" in auth. **Confirms compliance**.

No CRITICAL or MAJOR findings. No missed scope and no regressions detected.

## Verdict

**P00 satisfied: YES.**

All seven runbook items are implemented as specified and verified against the actual code on the pinned toolchain (Node 24.19.0): baseline record is plausible and corroborated; Dockerfile/.dockerignore gone with no replacement; `REFACTOR_PLAN.md` prettier-ignored (`format:check` exit 0); auth test env restoration with a proven nonempty-prior regression and shuffle-passing order independence; `clean:build` with a fixed allowlist, argv rejection (verified live), lstat-before-delete junction rejection, and a cross-platform escape regression that passes on Windows; `prisma:validate` script invoked by CI; and a valid, correctly ordered, pinned-Node CI workflow with loopback/placeholders and no database infrastructure. `lint`, `typecheck`, and the full suite (286 tests) pass; `deploy.yml` is unchanged.
