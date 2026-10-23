# P40 Round-2 Dynamic Verification Report (General)

- **Phase:** P40 — Focused Decomposition (P40a CSS cleanup, P40b offline sync split, P40c host/application/demo transaction)
- **Date:** 2026-09-27
- **Base commit (HEAD):** `9467757` (`9467757ed436c82bdbace5a78e23b502176318e2`)
- **Workspace state:** entire refactor staged as one working-tree change (181 paths); no unstaged mutation of tracked files performed by this review
- **Toolchain used:** Node `v22.23.1`, npm `11.6.0`
  - **Discrepancy noted:** the repo pins Node `24.19.0` (npm `>=11.6.0 <12`). This checkout runs Node 22.23.1 — the same discrepancy the dossier recorded for its inspected shell. All gates below still pass on this toolchain.
- **Role:** dynamic verification (round 2, independent). Prior-round reports under `docs/refactor-implementation-findings/` were not read.

## Command log

| # | Command | Exit code | Duration | Key result |
|---|---------|-----------|----------|------------|
| 1 | `node --version && npm --version` | 0 | <1s | v22.23.1 / 11.6.0 |
| 2 | `npm ls fake-indexeddb` | 0 | <1s | `fake-indexeddb@6.2.5` installed; declared direct devDependency `"fake-indexeddb": "^6.2.5"` in `package.json` (contingency "dev-dep not installed" does not apply) |
| 3 | `npm test` (= `next-target.mjs gen demo && vitest run`) | 0 | 3s (wall) / 1.64s (vitest) | **28 test files, 200 tests, 200 passed, 0 failed** |
| 4 | `npx vitest run tests/unit/game-offline-sync.test.ts --reporter=verbose` | 0 | ~2s | 8/8 pass (7 preserved scenarios + 1 new lifecycle regression) |
| 5 | `npx vitest run tests/unit/adult-portal-service.test.ts --reporter=verbose` | 0 | ~2s | 16/16 pass, incl. 5 `getShell` table cases |
| 6 | `npx vitest run tests/unit/demo-player-access.test.ts --reporter=verbose` | 0 | ~2s | 8/8 pass, incl. 2 transaction checks + malformed-state fallback |
| 7 | `npm run typecheck` (= `typecheck:server && typecheck:demo`, each runs `next-target.mjs gen <target>` then `tsc --noEmit --incremental false`) | 0 | 16s | both target checks pass serially, no TS errors emitted |
| 8 | `npm run build:server` | 0 | 11s | server build OK (dynamic `ƒ` + SSG `●` routes as expected) |
| 9 | `npm run build:demo` | 0 | 14s | static export OK; seeded demo detail routes prerendered (`/portal/turmas/demo-turma-3a` etc.) |
| 10 | `test ! -e src/runtime/game-offline-sync.ts` | 0 | <1s | old file absent |
| 11 | `rg -n "game-offline-sync" src tests scripts next.config.ts tsconfig.json eslint.config.mjs package.json` | 1 (no matches) | <1s | **0 residual references** in first-party source/tests/config |
| 12 | `wc -l` size survey (see table below) | 0 | <1s | sizes recorded |
| 13 | import-graph survey of `src/runtime/offline/*.ts` (see below) | — | <1s | DAG confirmed, no cycles |

All commands ran strictly serially; no dev server, no `prisma migrate/db push/reset`, no `npm install`; no tracked file modified.

## Verification per P40 acceptance bullet

### 1. "The old offline file is gone, imports point directly at owned modules, and no new dependency cycle or compatibility barrel exists." — **YES**

- `src/runtime/game-offline-sync.ts` is absent (`test ! -e` → true; `ls` → No such file).
- `rg "game-offline-sync"` over `src`, `tests`, `scripts`, and config files: **0 matches**. (Matches exist only in historical documents such as `docs/architecture-audit-2026-09-23.md` and `docs/agent-reviews/*`, which are not imports.)
- No compatibility barrel: `src/runtime/offline/` contains exactly `types.ts`, `errors.ts`, `canonical.ts`, `indexed-db.ts`, `sync-engine.ts` — **no `index.ts`**, and no file re-exports another's surface. The old file's 16 exported symbols now live solely in their owned modules:
  - `types.ts` — 9 types + `GameOfflinePersistence` interface
  - `errors.ts` — `OfflineStateBlockedError`, `OfflineBootstrapMissingError`, `OfflineRequestReuseError`, `OfflineSessionMismatchError`
  - `canonical.ts` — `parseStateConflictResponse`, `sameJson`, `stableJson`, `eventRequestIdentity`
  - `indexed-db.ts` — `openDatabase`, `IndexedDbGameOfflinePersistence`
  - `sync-engine.ts` — `GameOfflineStore`, `openGameOfflineStore`
- Consumers import owned modules directly, e.g. `src/components/public/game-host.tsx:25,29,30` imports `offline/errors`, `offline/sync-engine`, `offline/types`; `tests/unit/game-offline-sync.test.ts` imports `offline/errors`, `offline/indexed-db`, `offline/sync-engine`, `offline/types`.
- Dependency graph (from actual `^import` statements, no dynamic imports found):

  | Module | Imports |
  |---|---|
  | `offline/types.ts` | `@/contracts/v1` (type-only) |
  | `offline/errors.ts` | (none) |
  | `offline/canonical.ts` | `@/contracts/v1`, `./types` (type-only) |
  | `offline/indexed-db.ts` | `@/contracts/v1`, `./canonical`, `./errors`, `./types` |
  | `offline/sync-engine.ts` | `@/contracts/v1`, `./canonical`, `./errors`, `./indexed-db`, `./types` |

  Edges flow engine → persistence → leaves; **no edge points back to `sync-engine`**, and **no offline file imports `game-host`, any component, or `react`** (verified by rg; both searches returned 0).

### 2. "Existing offline, bridge, adult-portal, player-access, security, and contract tests pass, plus the focused IndexedDB lifecycle, getShell, and two demo transaction checks and the malformed persisted-state fallback check." — **YES**

Full run: 28 files / 200 tests, all passed. Required suites present and green in the full run:

| Suite | File | Tests in full run |
|---|---|---|
| offline (existing, repointed) | `tests/unit/game-offline-sync.test.ts` | 8 ✓ |
| bridge | `tests/unit/player-game-bridge.test.ts` | 7 ✓ |
| adult-portal service | `tests/unit/adult-portal-service.test.ts` | 16 ✓ |
| player-access | `tests/unit/player-access-actions.test.ts` (4), `player-access-service.test.ts` (8), `player-access-prisma.test.ts` (5), `demo-player-access.test.ts` (8) | 25 ✓ |
| security | `tests/unit/player-access-security.test.ts` (4), `proxy.test.ts` (5), `auth.test.ts` | ✓ |
| contract | `tests/unit/v1-contracts.test.ts` (59), `v1-authorization.test.ts` (4) | ✓ |

New/moved regressions, each verified by a verbose re-run of its file:

- **Seven preserved offline behavioral scenarios** — `tests/unit/game-offline-sync.test.ts`, `describe("GameOfflineStore")`, imports from `@/runtime/offline/*` (errors, indexed-db, sync-engine, types):
  1. `queues state saves at sequential revisions and keeps local acknowledgements stable`
  2. `allocates stable event IDs and does not reuse a request ID for changed content`
  3. `retains event IDs after server acknowledgement for lost local acks`
  4. `leaves old-session queued events pending instead of uploading under a new session`
  5. `ignores delayed old-session bootstraps and scopes every upload to its launch session`
  6. `blocks only state after a revision conflict and still uploads independent events`
  7. `reports transient state failure while still delivering independent queued events`

  Import paths changed only; scenario semantics preserved. All pass.
- **Focused IndexedDB persistence lifecycle regression** — same file, `describe("offline persistence lifecycle (IndexedDB)")` → `persists a queued state save across close and reopen through the production store`. Uses `fake-indexeddb` (`IDBFactory` imported at line 6) and exercises the exact required sequence: open (`openGameOfflineStore`) → enqueue/persist (`cacheBootstrap` + `enqueueState`, asserting the `portal.local_durable.v1` ack) → `close()` → reopen (`openGameOfflineStore` again) → read (`getSyncStatus` showing 1 queued state, `getNextExpectedRevision`, plus raw `IndexedDbGameOfflinePersistence.listStates` on the reopened DB). No full fake-vs-real parity matrix added, no abort parity test (transaction algorithm unchanged). Passes.
- **`getShell` table** — `tests/unit/adult-portal-service.test.ts`, `describe("AdultPortalService getShell")` with `it.each(shellScopeCases)` over **five** cases covering all four required scopes: `'platform admin' shell`, `'organization admin' shell`, `'teacher' shell`, `'inactive membership' shell`, `'no membership' shell`. Asserts `effectiveRole`, `roleLabel`, `scopeLabel`, and navigation hrefs. All pass.
- **Demo transaction checks** — `tests/unit/demo-player-access.test.ts`:
  - `rolls back a rejected nested transaction in place, preserving state identity` — nested `store.transaction` throwing inside the inner transaction; asserts `expect(store.state).toBe(before)` (object identity preserved after in-place restore) and seed-level lengths. **Pass.**
  - `commits a successful transaction in place without replacing state identity` — asserts `expect(store.state).toBe(before)` and the created organization present. **Pass.**
- **Malformed persisted-state fallback** — same file: `falls back to the seed when persisted state is current-version but malformed` — writes current-version state with `organizations: null` under `DEMO_ADULT_PORTAL_STORAGE_KEY`, asserts `readDemoAdultPortalState()` returns the seed. Focused on the persisted-state contract, no migration-on-read. **Pass.**

### 3. "Both targets typecheck/build" — **YES**

- `npm run typecheck`: exit 0 in 16s; both legs ran serially and each regenerated its own entries first (`node scripts/next-target.mjs gen server|demo && tsc --noEmit --incremental false`), so neither check depended on the previous command's leftovers.
- `npm run build:server`: exit 0 in 11s.
- `npm run build:demo`: exit 0 in 14s; static export succeeded with seeded dynamic routes prerendered.
- Manual host flow readiness for P50 is a later-phase item; nothing in this phase blocks it.

### 4. "File sizes are recorded for review but are not pass/fail criteria." — **YES** (recorded below)

## File-size table (informational)

| File | Lines (staged) | Reference |
|---|---|---|
| `src/runtime/offline/types.ts` | 115 | new (split) |
| `src/runtime/offline/errors.ts` | 31 | new (split) |
| `src/runtime/offline/canonical.ts` | 53 | new (split) |
| `src/runtime/offline/indexed-db.ts` | 694 | new (split) |
| `src/runtime/offline/sync-engine.ts` | 380 | new (split) |
| **offline split total** | **1273** | old `game-offline-sync.ts`: 1222 (Δ +51 = module boundary boilerplate; size not a gate) |
| `src/components/public/game-host.tsx` | 804 | base commit: 932 |
| `src/components/public/game-host-model.ts` | 77 | new (pure state/message parsing) |
| `src/components/public/game-host-chrome.tsx` | 159 | new (rendering chrome) |
| `src/application/adult-portal/shell-view-model.ts` | 96 | new (`buildPortalShell(actor, effectiveRole)`) |
| `src/application/authorization/authorization-actor.ts` | 19 | new (`toAuthorizationActor`, dedup of policy actor conversion) |
| `src/components/portal/portal.module.css` | 2716 | base commit: 4910 (Generation-A purge + P40a cleanup; −2194 lines) |

Largest CSS module: `portal.module.css` at 2716 lines (next largest: `public.module.css` 638).

## P40a/P40c structural spot-checks (supporting evidence)

- **P40a repairs:** `mobileNavItem` now defined (`portal.module.css:157`, base rule) and consumed in `portal-navigation.tsx:37`; `entryProblem`/`entryProblemIcon` now defined (`public.module.css:534-550`) and consumed by `player-entry-screen.tsx`. Credential print rules (`printSheet` 2189, `credentialPrintCard` 2195, `@media print` 2404) remain together in `portal.module.css`.
- **P40c-1:** `game-host.tsx` retains effects/refs/orchestration (`useEffect`, 8 `useRef`s incl. launch/queue/conflict refs, `retryAfterUnauthorized`), while importing pure helpers from `./game-host-model` and chrome from `./game-host-chrome`. No hooks extracted.
- **P40c-2:** `src/application/adult-portal/service.ts` keeps actor loading/validation and delegates construction to `buildPortalShell(actor, effectiveRole(actor))` (line 112); `toAuthorizationActor` from `authorization-actor.ts` is reused at 5 call sites (145, 169, 171, 192, 204) instead of a duplicated conversion.
- **P40c-4:** `rg "node:crypto|createHmac|server-only"` over all demo runtime files: 0 matches. Demo credentials remain browser-local; the demo-state test asserts the storage key carries a version suffix (`expect(DEMO_ADULT_PORTAL_STORAGE_KEY).toContain(":v2")`), satisfying the key/version-bump provision of P40c-6.

## Findings

| Severity | Finding | Evidence |
|---|---|---|
| INFO | Toolchain discrepancy: checkout runs Node v22.23.1 against the repo pin of 24.19.0 (npm 11.6.0 matches). All gates green regardless; CI runs the pinned version. | Command log rows 1–9 |
| INFO | `desktopNavItem` has no rule outside its `@media (max-width: 900px)` block (single CSS occurrence, `portal.module.css:1231`, where it is hidden). This answers the runbook's "verify whether desktopNavItem has the intended default outside its media rule": no default exists, and none is structurally required — desktop links are styled by `.navLink`; the class exists to be hidden on mobile. Visual confirmation belongs to the P50 browser smoke. | `rg desktopNavItem` output |
| INFO | offline/ split total (1273 lines) slightly exceeds the old single file (1222) — expected module-boundary overhead; size is explicitly not pass/fail. | File-size table |
| INFO | `fake-indexeddb@6.2.5` is both declared (package.json devDependency `^6.2.5`) and installed in this checkout's node_modules, so the lifecycle regression runs against the declared tooling. | Command log row 2 |
| INFO | Demo storage key was version-bumped (`:v2`) alongside the persisted-state validation work, matching the P40c-6 provision. | `tests/unit/demo-player-access.test.ts:78` |

No CRITICAL or MAJOR findings. No MINOR findings that require remediation in this phase.

## Acceptance criteria not satisfied

None. All four P40 acceptance bullets verified as satisfied on real command output.

## Verdict

VERDICT: PASS
