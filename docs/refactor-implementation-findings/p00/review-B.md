# P00 Review — Reviewer B

Reviewed: 2026-09-26, independently of Reviewer A (no other review or verification files were read).
Base commit under review: `9467757ed436c82bdbace5a78e23b502176318e2` (working tree, uncommitted changes).

## Summary of changes reviewed

Working-tree state (`git status --short`):

- Deleted: `Dockerfile`, `.dockerignore`
- Modified: `.prettierignore` (+`REFACTOR_PLAN.md`), `package.json` (+`clean:build`, +`prisma:validate`), `tests/unit/auth.test.ts` (env capture/restore rework + 1 regression)
- New: `scripts/clean-build-artifacts.mjs`, `scripts/clean-build-artifacts.d.mts`, `.github/workflows/ci.yml`, `tests/unit/clean-build-artifacts.test.ts`, `docs/refactor-implementation-findings/p00/baseline-record.md`
- `.github/workflows/deploy.yml` is **not** modified (Pages deployment untouched). No other tracked files changed.

Verification I performed myself (Node v24.19.0, npm 11.17.0 from the pinned toolchain at `C:/Users/Vitor/tools/node-v24.19.0-win-x64`):

| Check | Result |
| --- | --- |
| `npm test` (`vitest run`, normal mode) | exit 0 — 34 files, 286 tests passed (baseline 33/284 + exactly the 2 new regressions) |
| `npx vitest run tests/unit/auth.test.ts --sequence.shuffle` | exit 0 — 15/15 passed (order independence) |
| `npm run format:check` | exit 0 (baseline recorded 1 pre-`.prettierignore`-fix; consistent) |
| `npm run lint`, `npm run typecheck` | exit 0 / exit 0 |
| `npm run prisma:validate` | exit 0 — "Loaded Prisma config from prisma.config.ts", local schema validated |
| `node scripts/clean-build-artifacts.mjs --bogus` | exit 1, message "clean-build-artifacts takes no arguments; its targets are a fixed allowlist." — also proves `isMainModule()` detection works on Windows (the arg check only fires from the main-module branch) |
| `.github/workflows/ci.yml` parsed with js-yaml | valid YAML; step sequence and env as intended (see below) |
| `grep tests/` for `ci.yml`/`workflows` | no test parses or snapshots CI YAML |
| `find` for Dockerfile/.dockerignore/docker-compose | none remain (only pre-existing historical prose in `portal-v1-specification.md:256`) |

Requirement-by-requirement:

1. **Baseline record** — `docs/refactor-implementation-findings/p00/baseline-record.md` records base commit, clean starting status, pinned vs. used Node/npm versions, and exit codes for all seven required commands (format:check, lint, typecheck, test, `npm exec -- prisma validate` — script did not exist yet —, build:server, build:demo). I reproduced the current-toolchain subset above. Satisfied.
2. **Docker removal** — both files deleted; no container workflow, no Docker docs added. Server build remains `npm run build:server` (Next standalone). Satisfied.
3. **`.prettierignore`** — `REFACTOR_PLAN.md` added; `format:check` now exits 0. Satisfied.
4. **auth.test.ts env hygiene** — the `isAuthDevBypassEnabled` suite replaced its delete-only `afterEach` with `withMutatedEnv` capturing/restoring all three mutated keys (`AUTH_DEV_BYPASS`, `APP_RUNTIME_MODE`, `NODE_ENV`), deleting keys that were unset and reassigning those that were set; the two mutation tests now run inside it; one regression starts from a nonempty flag value (`"preexisting-sentinel"`) and asserts all three keys are restored. Satisfied (one MINOR nit below).
5. **clean:build** — script added with fixed allowlist (`.next`, `.next-demo-dev`, `out`, root `*.tsbuildinfo`), no caller-supplied paths (argv rejected, verified live), repo-root derived from the script's own location, per-target lstat link rejection before realpath guard before deletion. One focused escape regression using a Windows junction in a tmpdir; no general fixture suite. Satisfied.
6. **prisma:validate** — script added and used in ci.yml; no other executable surface invokes bare `prisma validate` (README has none; only the unedited authority doc `REFACTOR_PLAN.md:219` mentions it in prose). Verified working against the repo-local CLI. Satisfied.
7. **ci.yml** — triggers `pull_request` (unfiltered) + `push` to `main`; `permissions: contents: read`; pinned `node-version: "24.19.0"`; `npm ci`; then exactly `clean:build` → `format:check` → `lint` → `prisma:validate` → `typecheck` → `npm test` → `build:server` → `build:demo` serially in one job. Job-level env is loopback-only (`127.0.0.1` DATABASE_URL and NEON_AUTH_BASE_URL) with clearly non-secret 61-character placeholders (satisfy the `min(32)` validation in `next.config.ts`/`src/server/config/env.ts` for the server build). No `services:`, no Postgres/shadow-DB/schema-drift infra. Satisfied.

## Findings

1. **MINOR — `tests/unit/auth.test.ts:212-230` — the new regression leaves `AUTH_DEV_BYPASS="preexisting-sentinel"` behind after it finishes (confirmed).**
   The test sets the sentinel *outside* `withMutatedEnv` and never restores the flag's true pre-test value (unset under vitest), because the helper restores its own captured prior — which is the sentinel. Today this is benign and verified: `isAuthDevBypassEnabled()` hard-gates on `APP_RUNTIME_MODE === "server"` (`src/server/config/env.ts:120-126`), the gateway tests override the flag explicitly via `loadGatewayWithEnv`, vitest isolates files in separate workers, and a `--sequence.shuffle` run of the file passes 15/15. Risk is only forward-looking: a future test in this file calling `runtimeEnvSchema.parse(process.env)` directly would fail, because `authDevBypassSchema = z.stringbool()` rejects `"preexisting-sentinel"`. A `try/finally` restoring the true prior flag value would close this. Does not block P00: the runbook's wording ("starts with a nonempty value and proves restoration") is met, and the restoration helper itself is exact.

2. **INFO — `scripts/clean-build-artifacts.mjs:36-40` — tsbuildinfo discovery is suffix-based over root entries (confirmed, by design).**
   Any root entry ending in `.tsbuildinfo` becomes a target, including a pathological directory of that name (which would be `rmSync`-ed recursively). This matches the runbook's "root TypeScript build-info files" allowlist. Confirmed load-bearing: `tsconfig.json` has `"incremental": true` with no `tsBuildInfoFile`, so `tsconfig.tsbuildinfo` lands in the root (it exists in this checkout) and is covered. Symlinked tsbuildinfo entries are collected and then rejected by the same link guard.

3. **INFO — `scripts/clean-build-artifacts.mjs:48-75` — rejection ordering is correct; partial cleanup on multi-target abort is possible (confirmed, acceptable).**
   Order is: `lstat` (link, not target) → `isSymbolicLink()` throw (catches junctions, which Windows lstat reports as symlinks) → `realpathSync(target)` inside-root guard → delete. Checking links *before* `realpathSync` also avoids ENOENT crashes on dangling links. If a *later* target is a rejected link, earlier targets are already deleted before the run aborts with exit 1 — acceptable for a fixed allowlist, and the CLI's try/catch surfaces the message.

4. **INFO — `tests/unit/clean-build-artifacts.test.ts:23-36` — the escape regression genuinely pins the junction rejection (confirmed).**
   `toThrow(/symbolic link or junction/)` matches only the lstat guard's message; a hypothetical implementation relying solely on the realpath guard would throw "…resolved path escapes the repository root." and fail the regex — so the test proves the link check fires *before* deletion, not merely that some rejection happens. The follow-up `keep.txt` assertion proves the outside target survives. Fixture uses `"junction"` (admin-free on Windows; the type argument is ignored on POSIX, producing a plain symlink that is equally lstat-visible), and the `finally` block removes both fixture dirs.

5. **INFO — `scripts/clean-build-artifacts.mjs:80-89` — main-module detection verified working on Windows (confirmed).**
   Live run of `node scripts/clean-build-artifacts.mjs --bogus` printed the fixed-allowlist error and exited 1, which is only reachable from the `isMainModule()` branch — so `path.resolve` + lowercase normalization handles the Windows drive-letter/case concerns. `npm run clean:build -- <arg>` is equally rejected since npm appends caller args to `process.argv`.

6. **INFO — `.github/workflows/ci.yml:3-6` — `pull_request` trigger is unfiltered (confirmed, satisfies the runbook).**
   The runbook says "for pull requests and pushes to `main`"; an unfiltered `pull_request:` runs for PRs against any base branch, which is the standard, permissive reading. Pinned Node, minimal permissions, loopback-only env, 61-char non-secret placeholders, serial builds, and the absence of services/DB infra were all verified by parsing the YAML. No concurrency group — not required by the runbook.

7. **INFO — `REFACTOR_PLAN.md:219` — prose mention of bare `prisma validate` remains (confirmed, out of scope).**
   The plan is the runbook authority document and is deliberately unedited (and now prettier-ignored). Every executable surface (`package.json:27`, `ci.yml` step "Validate Prisma schema") uses the `prisma:validate` script, which I verified resolves the repository-local CLI via `prisma.config.ts`.

8. **INFO — `portal-v1-specification.md:256` — pre-existing historical sentence "Dockerized Node.js application" (confirmed, not a violation).**
   It predates this diff, is descriptive prose in the v1 spec (itself prettier-ignored), and is not a Docker build/doc added by P00. No Dockerfile, `.dockerignore`, compose file, or container workflow remains anywhere in the tree.

9. **INFO — `docs/refactor-implementation-findings/p00/baseline-record.md:28` — Prisma baseline recorded as `npm exec -- prisma validate` (confirmed, honest).**
   The `prisma:validate` script did not exist at baseline, so `npm exec` was the only faithful way to record the command's exit code; the record says so explicitly.

## Verdict

**Satisfies P00: yes.**

All seven runbook requirements are correctly and completely implemented; every acceptance criterion checked out under my own runs on the pinned toolchain (tests pass in normal mode, restoration test is order-independent, CI runs real commands with no YAML snapshot tests, no Docker remnants, `deploy.yml` untouched). No CRITICAL or MAJOR findings. The single MINOR item (sentinel leak after the regression test) is currently benign, verified benign under shuffled order, and does not conflict with the runbook wording; it is a forward-looking hygiene recommendation only.

---

## Re-review (fix round 1)

Re-reviewed: 2026-09-26, delta scope only — the uncommitted fix for round-0 finding 1 (`git diff tests/unit/auth.test.ts` is the entire delta since round 0; the working tree's other changes are unchanged in status). Re-derived independently; no other review or verification files were read.

The fix (`tests/unit/auth.test.ts:212-239`): the regression test now captures the flag's true pre-test value into `originalFlagValue` (`:216`) *before* assigning the sentinel (`:217`), and an unconditional `try/finally` wrapping the whole body restores it — `delete process.env[flagKey]` when the prior value was undefined, reassignment otherwise (`:232-238`). Additionally, all other mutations in the describe block are now routed through `withMutatedEnv` (`:166-183`), replacing the round-0 delete-only `afterEach`.

Verification I performed myself (Node v24.19.0 from the pinned toolchain):

| Check | Result |
| --- | --- |
| `npx vitest run tests/unit/auth.test.ts` (default order) | 15/15 passed |
| `npx vitest run tests/unit/auth.test.ts --sequence.shuffle` × 5 unsampled runs | 15/15 each |
| `--sequence.shuffle --sequence.seed=1..25` (verbose order inspection) | 15/15 each; in 11 of 25 seeds the restoration test ran **before** "is disabled by default" (e.g. seeds 3, 8, 9, 11, 12, 22, 24) — the round-0 leak scenario ordering, still passing |
| Same suite with `AUTH_DEV_BYPASS=false` preset in the ambient environment (default order + shuffle seed 3) | 15/15 each — exercises the defined-prior restore branch under the real runner |
| Mechanical replica of the new control flow (`node -e`): undefined-prior happy path; defined-prior happy path; exception thrown inside the `try` with defined prior; exception with undefined prior | undefined-prior → key absent afterwards; defined-prior → exact prior value restored; in both exception cases the `finally` still restored correctly |
| `npm run format:check`, `npm run lint`, `npm run typecheck` | all exit 0 |

### Findings

1. **Round-0 finding 1 (MINOR, sentinel leak) — resolved: yes.**
   Both prior-value branches are handled: with an undefined prior (the normal vitest case) the `finally` deletes the key, so `"preexisting-sentinel"` no longer survives the test; with a defined prior the exact captured string is reassigned (empty string is also handled correctly, since only `undefined` triggers the delete branch). The restoration is exception-safe: a failed assertion inside the `try` (or an exception from the inner callback, where `withMutatedEnv`'s own `finally` restores the sentinel first and the outer `finally` then restores the true original — correct nesting order) cannot leave the sentinel behind. One honest caveat on the empirical evidence: "is disabled by default" passing after the restoration test is not by itself sensitive to a leaked *flag value*, because `isAuthDevBypassEnabled()` short-circuits on `APP_RUNTIME_MODE !== "server"` (`src/server/config/env.ts:121`) — the same reason the round-0 leak was benign. The direct proof for the flag key is therefore the capture-before-mutate structure plus the mechanical replica; the shuffle runs re-prove overall order independence as in round 0.

2. **Restoration proof intact — yes.**
   The sentinel is still assigned *outside* `withMutatedEnv` (`:217`), so the helper's captured prior for the flag is the sentinel and its `finally` must restore a nonempty prior value — the runbook's "starts from a nonempty value and proves restoration" property is unchanged. The post-cycle assertions remain for all three mutated keys (`:229-231`), and comparing `APP_RUNTIME_MODE`/`NODE_ENV` against values captured at test start (rather than hardcoded) keeps the assertions valid under any ambient state and any shuffle order.

3. **INFO (new, non-blocking) — `tests/unit/auth.test.ts:166-183` vs `:21-25,32-40` — the helper duplicates the capture/restore idiom already used by `loadGatewayWithEnv`.**
   Two ~10-line copies of the same capture/restore loop now live in one file; extracting a shared module-scope helper would remove the duplication. This follows the file's pre-existing idiom, is behaviorally consistent, and does not block.

4. **Note (net hygiene improvement) — the rework also removed a latent wart of the round-0 delete-only `afterEach`, which deleted `NODE_ENV` even when it was set (e.g. vitest's `"test"`).** `withMutatedEnv` restores the captured value exactly (delete only if unset), so the describe block now leaves the environment strictly as it found it.

No CRITICAL, MAJOR, or MINOR findings in this round.

### Verdict (fix round 1)

**Env-leak finding resolved: yes.** The fix eliminates the sentinel leak for both defined and undefined prior values (including on exception paths), keeps the restoration proof fully intact, introduces no new issues beyond one non-blocking INFO duplication nitpick, and the suite passes in default order, under 30 shuffled orders (11 of which place the restoration test before "is disabled by default"), and with the flag preset in the ambient environment. **P00 remains satisfied.**
