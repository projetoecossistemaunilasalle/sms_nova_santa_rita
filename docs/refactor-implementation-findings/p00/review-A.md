# P00 Review A — Independent Review

Reviewer: REVIEWER A (read-only). Date: 2026-09-26.
Authority: `docs/refactor-dossier/IMPLEMENTATION-READY.md`, section "P00: Reproducible
Baseline and CI" plus the runbook's "Scope and Fixed Decisions".

## Scope reviewed

Working tree at `9467757` (`git status --short`), 10 entries:

- deleted: `Dockerfile`, `.dockerignore`
- modified: `.prettierignore`, `package.json`, `tests/unit/auth.test.ts`
- untracked/new: `scripts/clean-build-artifacts.mjs`, `scripts/clean-build-artifacts.d.mts`,
  `tests/unit/clean-build-artifacts.test.ts`, `.github/workflows/ci.yml`,
  `docs/refactor-implementation-findings/p00/baseline-record.md`

Surrounding code read: `tsconfig.json`, `vitest.config.mts`, `eslint.config.mjs`,
`.gitignore`, `next.config.ts`, `scripts/next-target.mjs`, `prisma.config.ts`,
`prisma/schema.prisma`, `src/server/config/env.ts`, `src/runtime/mode.ts`,
`.github/workflows/deploy.yml`, `next-env.d.ts`, `scripts/start.mjs`.
Baseline evidence cross-checked against the implementer's raw logs in `%TEMP%\\p00-*.log`.

No implementation file was modified. `git status --short` is byte-identical before and
after this review. All temporary probe directories were created outside the repository
and deleted.

## Summary of changes reviewed

| P00 item | Implementation | Reviewer outcome |
| --- | --- | --- |
| 1 Baseline record | `docs/refactor-implementation-findings/p00/baseline-record.md` | Satisfied; exit codes corroborated by raw logs (see MINOR-3) |
| 2 Delete Dockerfile/.dockerignore | `git status` shows ` D Dockerfile`, ` D .dockerignore` | Satisfied; no live Docker build/reference remains (MINOR-2) |
| 3 `.prettierignore` | `+REFACTOR_PLAN.md` | Satisfied; `format:check` now exits 0, and the file is genuinely unformatted without the ignore |
| 4 `auth.test.ts` capture/restore | `withMutatedEnv` + one regression | Satisfied with a real leak in the new regression (MINOR-1) |
| 5 `clean-build-artifacts.mjs` + `clean:build` | new script, allowlist, link/realpath guards, one escape regression | Satisfied; script verified by black-box probes (INFO-1..3) |
| 6 `prisma:validate` | `package.json:27`, used by `ci.yml:46` | Satisfied; the script also works in CI conditions with no `.env` |
| 7 `.github/workflows/ci.yml` | new workflow | Satisfied; sequence, triggers, permissions, placeholders all verified |

## Findings

### MINOR-1 — The new restoration regression itself leaks the variable it is meant to protect
`tests/unit/auth.test.ts:212-230` (specifically `:216`)

```ts
const priorFlagValue = "preexisting-sentinel";
const priorRuntimeMode = process.env.APP_RUNTIME_MODE;
const priorNodeEnv = process.env.NODE_ENV;
process.env[flagKey] = priorFlagValue;          // <- set outside withMutatedEnv
...
expect(process.env[flagKey]).toBe(priorFlagValue);
```

Evidence: `auth.test.ts:216` mutates `process.env.AUTH_DEV_BYPASS` at test scope, outside the
`withMutatedEnv` helper (`:166-183`), and no `finally`/`afterEach` restores it. After this
test, `AUTH_DEV_BYPASS === "preexisting-sentinel"` for the remainder of the file's
environment — the exact leak class P00 item 4 exists to remove. In addition, the assertion at
`:227` compares against a value the test itself set three lines earlier, so it proves
`withMutatedEnv` restores, but not that the suite restores what *it* changed.

Not vacuous: if `withMutatedEnv` were a no-op, `AUTH_DEV_BYPASS` would read `"true"` at `:227`
and the test would fail. Confirmed by reading, not by execution of a mutated copy.

Impact today is bounded: `isAuthDevBypassEnabled` short-circuits on
`process.env.APP_RUNTIME_MODE !== "server"` (`src/server/config/env.ts:121`) and
`vitest.config.mts` pins `APP_RUNTIME_MODE: "demo"`, so the leaked value is inert; vitest also
isolates test files. Order independence was verified empirically anyway
(`--sequence.shuffle=true` x3, plus the full suite: all green).

Status: **confirmed** (code reading). Suggested fix: seed the sentinel inside a nested
`withMutatedEnv` or restore in a `finally`, e.g. capture `process.env[flagKey]` first and
put the restore in the test's own `finally`.

### MINOR-2 — Stale Docker deployment row survives in a live (non-`docs/`) requirements document
`portal-v1-specification.md:256`

```
| Deployment | Dockerized Node.js application plus Neon | ...
```

Evidence: `grep -ril docker --exclude-dir=docs` (excluding `node_modules`/`.git`) returns
exactly this one file. Fixed decision 8 states Docker "is not a supported build or deployment
target for this version", and P00 item 2 deletes the `Dockerfile` that this row describes, so
the specification now contradicts the shipped repository.

Status: **confirmed**. Severity is MINOR rather than higher because the runbook only forbids
*adding* Docker documentation and P00's enumerated change set does not list this file; this is
a leftover inconsistency, not a P00 requirement miss. Worth a one-line follow-up before P10.

### MINOR-3 — Baseline exit codes have no durable in-repo evidence, and one command label does not match its log
`docs/refactor-implementation-findings/p00/baseline-record.md` (exit-code table) and
`%TEMP%\p00-prisma-validate.log`

Evidence: the raw logs backing the record exist only in the OS temp directory
(`%TEMP%\p00-{format,lint,typecheck,prisma-validate,test,test-node24,build-server,build-demo,builds,acceptance}.log`)
and are neither copied into the findings directory nor referenced by the record, so they will
be lost and no later phase can re-verify the numbers. Separately, the record labels the Prisma
row `npm exec -- prisma validate`, but `p00-prisma-validate.log` begins directly with
`Loaded Prisma config from prisma.config.ts.` — there is no `npm exec` banner, so the recorded
invocation was almost certainly a different one (e.g. `npx prisma validate`).

Everything the record claims is otherwise corroborated: `p00-format.log` shows exactly one
failure (`REFACTOR_PLAN.md`), `p00-lint.log`/`p00-typecheck.log` are clean,
`p00-test.log` and `p00-test-node24.log` both show 33 files / 284 tests,
`p00-build-server.log`/`p00-build-demo.log` show successful compilations and route tables,
and `p00-acceptance.log` (18:20, after all edits) shows the post-change run at 34 files /
286 tests. Timestamps (18:07-18:08 baseline, 18:14-18:19 edits) confirm the baseline was
captured before the P00 changes. `base commit 9467757` matches `git log`. The system Node is
`v22.23.1`, matching the "Local shell" column.

Status: **confirmed**. Suggest copying the logs under the findings directory and citing them,
and correcting the Prisma command label.

### INFO-1 — The clean run is per-target, not atomic
`scripts/clean-build-artifacts.mjs:48-75`

Verified by probe: with a real `.next` directory plus an `out` junction, the run deleted
`.next` first and then aborted on `out` with exit 1, leaving `tsconfig.tsbuildinfo` and the
other targets in place. This matches the file's own comment (`:6-10`) and the runbook's
per-target wording ("a target is only removed after its on-disk entry passes the link and
realpath checks"). No change required; noting the behavior for operator expectations.

### INFO-2 — tsbuildinfo discovery is suffix-only, not type-filtered
`scripts/clean-build-artifacts.mjs:36-40`

Any root entry whose name ends in `.tsbuildinfo` becomes a target, including a directory,
which would then be removed recursively (`:69-70`). Verified that a nested
`src/nested.tsbuildinfo` is correctly left alone and only root-level files are collected. No
such directory exists in the repository today. Acceptable for a fixed allowlist.

### INFO-3 — The realpath escape guard is unreachable for the symlink/junction case it names
`scripts/clean-build-artifacts.mjs:56-67`

`lstat` + `isSymbolicLink()` runs first, so `isInsideRoot(root, fs.realpathSync(target))` can
only fire for a reparse point that `lstat` does not classify as a symlink (e.g. a volume mount
point). That is legitimate defense in depth, not dead weight; the ordering is correct
(link check before resolution, resolution before deletion). Windows junction handling is
correct: Node's `lstat` reports junctions as symbolic links, which the passing regression on
this Windows host confirms.

### INFO-4 — The typecheck gate is green without `.next` only because of `skipLibCheck`
`next-env.d.ts:3-4` + `tsconfig.json` (`skipLibCheck: true`)

`next-env.d.ts` contains `import "./.next/types/routes.d.ts";` and
`import "./.next/types/root-params.d.ts";`. P00's CI order runs `npm run clean:build` *before*
`npm run typecheck`, so on a fresh checkout those files do not exist. I verified in a probe
copy of the repo (no `.next`, `node_modules` junctioned): `tsc --noEmit` exits **0**, and with
`--skipLibCheck false` the same tree reports
`TS2882 Cannot find module or type declarations for side-effect import of './.next/types/routes.d.ts'`
(twice). Conclusion: the CI sequence is safe, and the probe also confirmed the program includes
`next-env.d.ts`, `tests/unit/clean-build-artifacts.test.ts` and
`scripts/clean-build-artifacts.d.mts`. Pre-existing condition, but it means the type gate does
not actually validate Next route types in either local or CI runs.

### INFO-5 — `npm run clean:build` is a no-op on a fresh CI checkout
Verified: on an empty probe root the script exits 0 and prints nothing; with artifacts present
it removes exactly `.next`, `out`, `tsconfig.tsbuildinfo` (and `.next-demo-dev` when present).
The CI step therefore functions as a smoke test of the script itself, which satisfies the
runbook's required sequence. Matches `p00-acceptance.log`, which shows
`Removed tsconfig.tsbuildinfo` only.

### INFO-6 — The CLI takes no path; the exported function is the test seam
`scripts/clean-build-artifacts.mjs:44`, `:91-97`

`node scripts/clean-build-artifacts.mjs ../../etc` printed
`clean-build-artifacts takes no arguments; its targets are a fixed allowlist.`, exited 1, and
deleted nothing. The argument guard runs before any collection, so it cannot half-clean.
`cleanBuildArtifacts(repoRoot)` accepts a root, which is how the test drives it; the CLI path
never does.

### INFO-7 — `REFACTOR_PLAN.md:219` still writes a bare `prisma validate`
Both `prisma validate` and the runbook's own `npm exec -- prisma` use the repository-local
CLI, so P00 item 6's intent ("validation always uses the repository-local Prisma CLI") holds
for every machine-executed invocation: `package.json:27` and `ci.yml:46`. `REFACTOR_PLAN.md`
is a requirement record outside P00's enumerated change set (and is now Prettier-ignored).
No change required.

## Verification commands and results

Toolchain used for acceptance: `PATH=/c/Users/Vitor/tools/node-v24.19.0-win-x64:$PATH`
→ `node -v` = `v24.19.0`, `npm -v` = `11.17.0` (matches the record's pinned column).

| Command | Result |
| --- | --- |
| `npm run format:check` | exit 0, "All matched files use Prettier code style!" |
| `npx prettier --check --ignore-path /dev/null REFACTOR_PLAN.md` | exit 1 — confirms the baseline's single format failure is real, and that the `.prettierignore` entry is the only thing changing it |
| `npm run lint` | exit 0 |
| `npx vitest run tests/unit/clean-build-artifacts.test.ts tests/unit/auth.test.ts` | 16 tests passed, exit 0 |
| `npx vitest run tests/unit/auth.test.ts --sequence.shuffle=true` (x3) | 15 tests passed each run — order independent |
| `npm test` (full, normal mode, once) | 34 files / 286 tests passed, exit 0 |
| `tsc --noEmit` in a probe copy with no `.next` | exit 0; `--skipLibCheck false` → 2x TS2882 (INFO-4) |
| `node <probe>/node_modules/prisma/build/index.js validate` with `env -u DIRECT_URL -u DATABASE_URL`, no `.env` | exit 0, "The schema at prisma\schema.prisma is valid" — the CI `prisma:validate` step's environment |
| same, `generate` (what `npm ci`'s postinstall runs) | exit 0, "Generated Prisma Client (7.9.1)" |
| zod replication of `next.config.ts` + `src/server/config/env.ts` server schema against the CI `env:` block | parse OK with `APP_RUNTIME_MODE=server` (set by `scripts/next-target.mjs:32`); secrets measured at 61 and 66 chars (>= 32); `NEON_AUTH_COOKIE_SECRET`/`APPLICATION_SECRET` satisfy `.min(32)`, `ALLOWED_ORIGINS` has a working `.default()` in zod 4.4.3 |
| `js-yaml` parse of `.github/workflows/ci.yml` | valid; triggers `{pull_request: null, push: {branches: [main]}}`; `permissions: {contents: read}` (no `pages`, no `id-token`); no `services:`; step order = checkout, setup-node 24.19.0, `npm ci`, `clean:build`, `format:check`, `lint`, `prisma:validate`, `typecheck`, `npm test`, `build:server`, `build:demo` — exactly the runbook order, builds serial |
| clean-script black-box probes (temp dir) | arg rejection (exit 1, nothing deleted); runs from a different cwd; runs through `npm run clean:build`; empty root exits 0; junction `out` aborts the run with exit 1 while the outside target and `keep.txt` survive |
| `git diff --stat -- .github/workflows/deploy.yml` | empty — Pages deployment untouched |
| `git status --short` before/after review | identical; no reviewer modification |

Not executed (out of reviewer scope — builds are forbidden): `npm run build:server`,
`npm run build:demo`. Their green status rests on the implementer's logs
(`p00-build-server.log`, `p00-build-demo.log`: "Compiled successfully", full route tables) plus
my env-completeness analysis above, which shows the CI environment satisfies every schema the
builds validate at config load and prerender time.

## Verdict

**satisfies P00: yes.**

No CRITICAL or MAJOR findings. All seven P00 change-set items are implemented and behave as
specified; the four acceptance criteria I could test directly hold (full `npm test` green in
one normal run, restoration test order independent, no YAML-parsing test exists, no
`Dockerfile`/`.dockerignore`/container workflow, `deploy.yml` untouched). The three MINORs
are quality nits, not requirement misses: MINOR-1 should be fixed before the suite is trusted
as order independent under future config changes, MINOR-2 is stale documentation, and MINOR-3
is baseline-evidence hygiene. The P00 build claims are corroborated but not independently
reproduced by the reviewer.

---

## Re-review (fix round 1) — 2026-09-26

Reviewer: REVIEWER A (read-only for implementation code). Delta scope: the MINOR-1 fix in
`tests/unit/auth.test.ts` only. Toolchain: `PATH=/c/Users/Vitor/tools/node-v24.19.0-win-x64:$PATH`
(`node -v` = v24.19.0, `npm -v` = 11.17.0).

### Scope reviewed

- `git diff tests/unit/auth.test.ts` (the only delta since the first round; the rest of the P00
  working tree is unchanged — same 10 `git status --porcelain` entries, and MINOR-2/MINOR-3 are
  out of this round's scope and still open).
- `tests/unit/auth.test.ts:158-240` in full, plus `src/server/config/env.ts:119-125`
  (`isAuthDevBypassEnabled`) and `vitest.config.mts:11-14` (`test.env`).

### MINOR-1 resolved: **yes**

The restoration regression now captures the true prior value of the flag before seeding the
sentinel, and restores it in a `finally` that spans the whole body:

```ts
// tests/unit/auth.test.ts:213-217
const priorFlagValue = "preexisting-sentinel";
const priorRuntimeMode = process.env.APP_RUNTIME_MODE;
const priorNodeEnv = process.env.NODE_ENV;
const originalFlagValue = process.env[flagKey];   // captured before the seed
process.env[flagKey] = priorFlagValue;
```

`finally` at `:232-238` deletes the key when `originalFlagValue === undefined` and otherwise
restores the captured value, so the test now cleans up the one key it mutates outside the helper.
The helper's own capture/restore is unchanged in behavior and still proves what it claims.

The leak is not merely closed by reading. In an out-of-repo copy of the tree (`%TEMP%`, repo
`node_modules` junctioned, copy deleted afterwards) I appended a probe test at the end of the file
that inspects `process.env` after the whole `isAuthDevBypassEnabled` suite:

| Ambient environment before the run | `process.env` after the whole suite | Verdict |
| --- | --- | --- |
| `AUTH_DEV_BYPASS` unset | `AUTH_DEV_BYPASS` absent; `APP_RUNTIME_MODE=demo`; `NODE_ENV=test` | exact restore (undefined branch) |
| `AUTH_DEV_BYPASS=ambient-preexisting` | `AUTH_DEV_BYPASS=ambient-preexisting`; `APP_RUNTIME_MODE=demo`; `NODE_ENV=test` | exact restore (defined branch) |
| same, with `--sequence.shuffle` | identical | order independent |
| `NODE_ENV=production` | `NODE_ENV=production`; flag absent; `APP_RUNTIME_MODE=demo` | exact restore |

Two negative controls confirm neither the probe nor the in-repo assertion can pass for the wrong
reason:

- **Control A — the pre-fix leak re-introduced in the copy** (sentinel seeded outside the helper,
  `finally` removed): `PROBE_OBSERVED {"flag":"preexisting-sentinel","flagPresent":true,…}` and the
  probe fails, while `restores the captured prior environment after a mutation cycle` still
  passes — i.e. the old test genuinely never caught its own leak, and the clean result observed
  with the fix is meaningful rather than vacuous.
- **Control B — the `withMutatedEnv` restore loop neutered** (`return run();`), the test's own
  `finally` kept: the restoration test fails with
  `expected 'true' to be 'preexisting-sentinel'` at `:229`. The restoration proof is intact and
  has teeth.

The `APP_RUNTIME_MODE`/`NODE_ENV` assertions at `:230-231` are also non-vacuous: `vitest.config.mts:12-14`
pins `APP_RUNTIME_MODE` to `"demo"` and Vitest sets `NODE_ENV=test`, so both priors are *defined*
and a restore-as-delete regression would be caught (the control-B run reproduced exactly that
state: `mode:"server", nodeEnv:"development"`).

Removal of the old `afterEach` that deleted all three keys is safe, not a regression: every test
that mutates is wrapped in `withMutatedEnv`, whose `try/finally` restores even when the callback
throws (the old `afterEach` only ran on completion of the test), and the one unwrapped test
(`is disabled by default`, `:185-187`) performs no mutation.

### New findings

None. No BLOCKER, MAJOR or MINOR introduced by this fix. Two non-actionable observations:

- INFO-7 (new) — capture/restore logic now exists twice in the file: `withMutatedEnv`
  (`:166-183`) and `loadGatewayWithEnv` (`:17-41`). Identical semantics, duplicated code; a shared
  module-level helper would be marginally cleaner. No behavior impact.
- INFO-8 (new) — `mutatedKeys` (`:160`) is a `const` tuple that no longer matches a suite-level
  `afterEach`; adding a mutated key means editing both the tuple and the mutating test. Acceptable
  for three keys.

MINOR-2 and MINOR-3 are unchanged and remain open; they are outside this round's delta.

### Verification commands and results

| Command | Result |
| --- | --- |
| `npx vitest run tests/unit/auth.test.ts` (Node 24) | 15 passed, exit 0 |
| `npx vitest run tests/unit/auth.test.ts --sequence.shuffle` | 15 passed, exit 0; plus 3 further shuffled runs (seeds 1790458535252, 1790458651183, 1790458652508, 1790458653885) all 15 passed |
| `npx vitest run` (full suite) | 34 files / 286 tests passed, exit 0 — same counts as the first round, so the fix added no test-count inflation |
| `npm run format:check` / `npx prettier --check tests/unit/auth.test.ts` | exit 0 / "All matched files use Prettier code style!" (the new code is CI-format clean) |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 (the new `process.env.NODE_ENV` reads typecheck without a cast; only the writes still need the `Record<string, string \| undefined>` cast) |
| `AUTH_DEV_BYPASS=ambient-flag-set npx vitest run tests/unit/auth.test.ts` | 15 passed |
| `APP_RUNTIME_MODE=server NODE_ENV=development AUTH_DEV_BYPASS=true npx vitest run tests/unit/auth.test.ts` | 15 passed (adversarial ambient env; `test.env` pins `APP_RUNTIME_MODE` to `demo`, so the default-off test stays honest) |
| probe copy: ambient unset / `=ambient-preexisting` / `NODE_ENV=production`, with and without `--sequence.shuffle` | probe test passes; post-suite env exactly equal to the ambient env in every case |
| control A (pre-fix leak in the copy) | probe fails, restoration test passes → leak detector is non-vacuous |
| control B (helper restore neutered) | restoration test fails at `auth.test.ts:229` → restoration proof is non-vacuous |
| `node -e` empty-string env probe | `process.env.X = ""` round-trips as `""` (not deleted) on this Node 24 / Windows host, so the `value === undefined` branch is the only delete path |
| `git status --porcelain` after the review | identical to the start of the round (10 entries); `node_modules` entry count 498 before and after the probe teardown; probe copy deleted via `rmdir` on the junction first, so no risk to the real `node_modules` |

### Verdict (fix round 1)

**MINOR-1 resolved: yes. PASS for the delta scope** — the leak is closed for both defined and
undefined prior values, the restoration proof remains intact and demonstrably non-vacuous, and
`format:check`, `lint`, `typecheck` and the full suite are green on Node 24. P00's overall verdict
from the first round stands; MINOR-2 and MINOR-3 remain open and unrelated to this change.
