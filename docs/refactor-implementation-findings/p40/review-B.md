# P40 Review B — Focused Decomposition

Reviewer B, independent pass. Checked out on the uncommitted working tree
(HEAD `780b0a8` + P00–P40 changes). Evidence gathered via `git diff`/`git show`
against HEAD, source search, and re-running the gates. Earlier phases' changes
(P00/P10/P20/P30) are out of scope except where they share a file with P40 work.

## Summary of changes reviewed

- **P40a CSS** — `src/components/portal/portal.module.css` (317 → 168 distinct
  class keys; 4,910 → 2,716 lines), `src/components/public/public.module.css`,
  `src/components/marketing/marketing.module.css`: orphan selector removal plus
  the `mobileNavItem` / `entryProblem` repairs; `desktopNavItem` left without a
  base rule outside its media query (deliberate decision).
- **P40b Offline sync** — `src/runtime/game-offline-sync.ts` (1,222 lines)
  deleted; new `src/runtime/offline/{types,errors,canonical,indexed-db,sync-engine}.ts`
  (115 / 31 / 53 / 694 / 380 lines). `game-host.tsx` and
  `tests/unit/game-offline-sync.test.ts` repointed; `fake-indexeddb@^6.2.5`
  added as a direct devDependency with one persistence lifecycle regression.
- **P40c Host / application / demo transaction** — `game-host-model.ts` (78
  lines) + `game-host-chrome.tsx` (160 lines) extracted from `game-host.tsx`
  (933 → 805 lines); `src/application/adult-portal/shell-view-model.ts` and
  `src/application/authorization/authorization-actor.ts` created with `getShell`
  reduced to load/validate + delegate; `DemoAdultPortalStore.transaction`
  snapshot/in-place-restore; persisted demo state structurally validated on
  read; new tests in the adult-portal, bridge, demo-player-access, and offline
  suites.

## Findings

### MAJOR-1 (confirmed) — player-access actor conversion was not deduplicated

- **Where:** `src/application/player-access/service.ts:14-26`
- **Evidence:** The file still defines a private `authorizationActor(actor)`
  that is field-for-field identical to the new shared
  `toAuthorizationActor` (`src/application/authorization/authorization-actor.ts:5-19`):
  `profileStatus`, `platformRole`, and the mapped memberships including
  `teacherAssignments`. `git status`/`git diff` show the whole
  `src/application/player-access/` tree untouched in this phase; only
  `src/application/adult-portal/service.ts` was repointed to the shared module
  (13 call sites). The stated P40 change set includes "dedup into
  player-access service", and the runbook's "Move the duplicated policy actor
  conversion to `src/application/authorization/authorization-actor.ts`" treats
  the copy as duplicated, i.e. both consumers should use one module.
- **Impact:** No behavioral impact (the local copy is equivalent and typechecks);
  this is missed scope, and the duplicate can drift against the shared
  conversion in future edits.
- **Fix:** Replace the local function with `toAuthorizationActor` from
  `@/application/authorization/authorization-actor` (4 call sites in the file:
  lines 57, 88, 105 area) and delete lines 14-26. No test change needed; the
  existing player-access suite covers `canAccessClass` behavior.

### MINOR-1 (confirmed) — persisted-demo-state validation is presence-only, not value-typed

- **Where:** `src/runtime/adult-portal-demo-store.ts:360-385`
- **Evidence:** `isValidDemoAdultPortalState` checks: plain object, `version === 2`,
  `activeProfileId` is a string, and every collection is an array of plain
  objects in which each required field is present via `Object.hasOwn`. A
  current-version payload whose fields are present but wrongly typed (e.g.
  `organizations: [{ id: 123, ... }]` or `nextPlayerNumber: "3"`) passes
  validation and would be returned as usable state. The regression test
  (`tests/unit/demo-player-access.test.ts`, "falls back to the seed when
  persisted state is current-version but malformed") exercises
  `organizations: null`, which is caught.
- **Impact:** Not a regression — pre-P40 the read path only checked
  `value.version === 2`, so this is strictly stronger. It is a partial reading
  of the runbook's "missing or malformed required fields": presence is
  validated, malformed values are not. Low practical risk (browser-local demo
  state), but worth a decision: either accept presence-only or add `typeof`
  checks per field in the same table.

### INFO-1 (confirmed correct) — `desktopNavItem` decision

- `src/components/portal/portal-navigation.tsx:37` always applies
  `styles.navLink` together with `item.mobile ? styles.mobileNavItem :
  styles.desktopNavItem`, so the base `display: flex` and layout come from
  `.navLink`; a base rule for `.desktopNavItem` would be redundant. The mobile
  media query (`portal.module.css:1215-1233`) hides `.desktopNavItem` (with the
  brand/profile) while `.mobileNavItem { display: flex }` (line 157) makes the
  class resolvable and renders mobile items in the bottom-bar grid. Note the
  component currently tags every produced item `mobile: true` (both
  `shell-view-model.ts` and the demo branch), so `.desktopNavItem` is
  mechanism, not dead CSS.

### INFO-2 (confirmed correct) — `entryProblem` repair

- `player-entry-screen.tsx:143,162,181` render `entryCard entryProblem` with an
  `<h1>`; at HEAD `styles.entryProblem` resolved to `undefined`. The repair
  `.entryProblem h1 { color: var(--coral-dark) }` (`public.module.css:534-536`)
  uses the file's established error tone (`.gameHostAlertError` also uses
  `var(--coral-dark)`), is minimal, and `.entryProblemIcon` already existed.

### INFO-3 (confirmed correct) — `summaryTextValue` reparent

- At HEAD the rule existed only as the compound
  `.classSummaryBand .summaryTextValue` (owner deleted in P10); the class has a
  live user at `organization-detail-screen.tsx:149`. The new standalone rule
  (`portal.module.css:1571-1574`) has a body identical to the old compound.

### INFO-4 (confirmed) — offline split is a faithful move

- All 16 public symbols of the old file are exported from the five new modules;
  none missing. A token-multiset comparison of the old monolith against the
  concatenation of the five modules is **identical** (no dropped/changed
  identifiers, strings, or numeric literals), and 47 of 49 method-sized chunks
  appear verbatim; the 2 flagged chunks were extraction artifacts I re-checked
  by hand (`openDatabase` and the constants/type block, both present and
  unchanged).
- Ownership matches the runbook table: `types.ts` (queue/result/transport/
  persistence contracts, `@/contracts/v1` imports only), `errors.ts` (4 public
  error classes, no imports), `canonical.ts` (`stableJson`, `sameJson`,
  `eventRequestIdentity`, `parseStateConflictResponse`; imports only `./types`),
  `indexed-db.ts` (`openDatabase` + `IndexedDbGameOfflinePersistence` + private
  storage shapes), `sync-engine.ts` (`GameOfflineStore` + `openGameOfflineStore`).
- Dependency direction holds: leaves never import the engine; engine imports
  canonical/errors/indexed-db/types; `indexed-db.ts` still raises
  `OfflineRequestReuseError` (lines 254, 496, 527). No index barrel; consumers
  (`game-host.tsx:25-30`, the test) import owned modules directly. No cycles.
- The lifecycle regression uses the production `openGameOfflineStore` +
  production `IndexedDbGameOfflinePersistence` over a `fake-indexeddb`
  `IDBFactory` — open, cacheBootstrap, enqueue/persist, close, reopen, read
  (status, next expected revision, and a raw persistence `listStates`
  re-read). Abort is not covered; the transaction algorithm is unchanged
  (token-identical), so per the runbook that coverage is not required.
- `fake-indexeddb@^6.2.5` is a direct devDependency (`package.json`).

### INFO-5 (confirmed) — game-host split keeps behavior and lifecycle

- `game-host-model.ts` has no React import and no hooks; `game-host-chrome.tsx`
  has `"use client"` but is hook-free (the iframe `ref` is passed in as a plain
  object prop; the `useRef` stays in `game-host.tsx:75`). Moved JSX is
  byte-equivalent to HEAD apart from formatting and the
  `formattedPlayerNumber` variable becoming the `playerNumber` prop computed in
  the chrome header. Both `useEffect` dependency arrays are unchanged
  (`[gameOrigin, runtimeMode]`, `[phase, runtimeMode]`); refs, launch-token
  renewal, save/event queue order, conflict handling, and retry orchestration
  all remain in `game-host.tsx`. `applyProgressToBootstrap` consolidates three
  inline `playerBootstrapV1Schema.parse({...current, revision,
  new_player: false, state})` blocks (old lines 240-247, 541-548, 561-572)
  into one identical helper. `game-host-chrome` is imported only by
  `game-host.tsx` — no cycles.

### INFO-6 (confirmed) — CSS removals are safe; no live rule lost

- Portal: 151 keys removed; a project-wide search finds **no** surviving
  `styles.X` reference to any removed key. Conversely all 169 keys used by the
  22 surviving consumers (including keys referenced inside template-literal
  class expressions) exist in the new file; the CSS has zero unused keys.
- Public: removed keys (`mission*`, `gameStage*`, `stateCard`, `stateIcon`,
  `stateActions`, `status`, `entryReady`, `entrySafetyNote`, `gameFrame*`,
  `contextLine`, `dogMark`, `secondary`, ...) have no references; the
  `stateCard` hits in `src/app/error.tsx:22` and `portal-state.tsx:19` resolve
  to their own modules. Removed `@keyframes float` had exactly one user
  (`.dogMark`). All used keys present; zero unused keys.
- Marketing: the removed homepage palette (`page/header/nav/hero*/mission*/…`)
  belonged to the deleted landing page; the three remaining consumers
  (`entrar/page.tsx`, `entrar/recuperar/page.tsx`, `sign-in-error.tsx`) use only
  surviving `auth*/brand*/field/form/submit` keys; zero unused keys remain.
- Print cohesion: `.printSheet` (2189), `.credentialPrintCard`/heading (2195+),
  and the `@media print` block (2404-2444, including the
  `[data-player-print-active]` activation) sit together in
  `portal.module.css`; bodies unchanged from HEAD (only relocated).

### INFO-7 (confirmed) — demo store semantics and tests

- `DemoAdultPortalStore.transaction` snapshots with `structuredClone` before
  work, restores in place via `Object.assign(this.state, before)` on rejection
  and rethrows; on success it simply returns (commit). `Object.assign`
  preserves the `state` object identity; the nested-rollback test asserts
  `expect(store.state).toBe(before)` plus post-rollback collection lengths,
  using the real store (no mocks). One theoretical gap: properties *added* to
  the state object during failed work would survive the restore
  (Object.assign never deletes) — unreachable through the typed
  `DemoAdultPortalState` shape, hence INFO.
- Structural validation applies only on read of persisted state; no
  migration-on-read; no key/version bump (`DEMO_ADULT_PORTAL_STORAGE_KEY`
  still ends `:v2`; seed `version: 2` unchanged), so runbook item 6 does not
  trigger. The malformed regression payload is current-version (seed spread
  with `organizations: null`).
- No `node:crypto`/server HMAC anywhere under `src/runtime/` or the demo
  paths; demo credentials remain plain browser-local tokens.
- `getShell` (`src/application/adult-portal/service.ts:109-112`) is now
  actor-load/validate + `buildPortalShell(actor, effectiveRole(actor))`, and
  `buildPortalShell` contains the entire construction (moved 1:1 from the old
  inline body — compared against the HEAD diff). The new `getShell` table in
  `tests/unit/adult-portal-service.test.ts` covers platform admin, organization
  admin, teacher, inactive membership, and no membership (5 rows) against the
  real demo seed/store, asserting role, labels, scope label, and nav hrefs.

### INFO-8 (confirmed) — test hygiene

- The seven existing offline scenarios changed only in their import block
  (verified via the test diff). New tests are behavior-focused: nested rollback
  identity, successful commit, malformed-state fallback, `getShell` table, and
  three host-model tests (`newBootstrap`, `applyProgressToBootstrap`,
  `errorMessageForEntry` + `readResponseJson`). No React Testing Library was
  added; no size gates, selector inventories, baselines, CSS-text, or
  document-parsing tests anywhere in `tests/`.

## Gates re-run (this review)

- `npm run format:check` — pass.
- `npm run lint` (`eslint . --max-warnings=0`) — pass.
- `npx vitest run tests/unit/game-offline-sync.test.ts
  tests/unit/player-game-bridge.test.ts tests/unit/adult-portal-service.test.ts
  tests/unit/demo-player-access.test.ts` — 4 files, 39 tests, all pass
  (offline file: 8 tests = 7 preserved scenarios + lifecycle regression).
- `npm run typecheck:demo` — pass (exit 0).

## Verdict

**P40 satisfied: YES, with one MAJOR item to close.** The offline split, host
split, shell/application extraction, demo transaction repair, persisted-state
validation, and CSS cleanup all meet the runbook's P40a/b/c requirements and
their acceptance items, with no behavioral drift detected and all gates green.
The single MAJOR finding (MAJOR-1: the duplicated policy-actor conversion
remains in `src/application/player-access/service.ts:14-26` instead of using
the new shared `toAuthorizationActor`) is a small, mechanical completion of the
stated dedup and should be landed before phase sign-off. MINOR-1 (presence-only
structural validation) is acceptable as implemented but should be acknowledged
as a scope decision.

## Re-review (fix round 1) — 2026-09-26

Delta scope only: verification of MAJOR-1 closure and judgment of the MINOR-1
acceptance decision. Independently re-derived from the working tree; gates
re-run with Node v24.19.0.

### MAJOR-1 closure — VERIFIED

- `git diff -- src/application/player-access/service.ts` shows the local
  `authorizationActor` helper deleted (its 13 lines removed), the import
  `import { toAuthorizationActor } from "@/application/authorization/authorization-actor"`
  added, and the call site updated to
  `canAccessClass(toAuthorizationActor(actor), classGroup)`.
- Full re-read of the file confirms no local definition remains; the single
  call site is inside `requireClassAccess` (now line 44). Correction to my
  prior report: I wrote "4 call sites in the file: lines 57, 88, 105 area" —
  that was wrong; `requireClassAccess` is invoked from several methods, but
  the conversion helper itself had exactly one call site, matching the
  coordinator's description.
- Project-wide grep: zero remaining bare `authorizationActor` references in
  `src/` or `tests/`; the shared `toAuthorizationActor` is used 22× in
  `adult-portal/service.ts` and 1× in `player-access/service.ts`. The shared
  conversion is field-for-field identical to the deleted copy
  (`profileStatus`, `platformRole`, memberships mapped with
  `organizationId`/`organizationStatus`/`role`/`status`/`teacherAssignments`).
- `npx tsc --noEmit --incremental false` — exit 0.
- `npx vitest run tests/unit/player-access-service.test.ts
  tests/unit/demo-player-access.test.ts` — 2 files, 16 tests, all pass
  (8 + 8).

### MINOR-1 acceptance — DEFENSIBLE (accepted, with one nuance on the stated rationale)

Evidence re-derived independently:

- **No realistic wrong-typed producer.** The storage key
  (`DEMO_ADULT_PORTAL_STORAGE_KEY`) is written exactly once in the codebase —
  `writeDemoAdultPortalState` (`adult-portal-demo-store.ts:410-417`) — and
  serializes the compiler-typed in-memory `DemoAdultPortalState` via
  `JSON.stringify`. No other module references the key (grep). A wrong-typed
  field in persisted state therefore requires deliberate hand-editing of
  localStorage, not any app-driven path.
- **Presence checks cover the realistic failure modes.** localStorage
  corruption in practice presents as JSON parse errors (separately caught at
  `adult-portal-demo-store.ts:402-407` → seed), truncated payloads, or missing
  fields — all caught by the validator. Wrong-typed values are the
  implausible case.
- **False-rejection hazard is concrete, not hypothetical.** The shape has
  nullable fields — `revokedAt: string | null` (line 105) and
  `endedAt: string | null` (line 113) — and seed entries legitimately hold
  `revokedAt: null` (e.g. lines 281, 299, 308). A naive per-field
  `typeof === "string"` table would reject valid state, and the cost of a
  false rejection is silent loss of the user's demo work (validator failure →
  `cloneSeed()` fallback). The failure asymmetry favors presence-only: a
  wrong-typed field slipping through can only degrade a browser-local demo
  session, whereas a false rejection discards real demo user work.
- **Seed safety holds, doubly.** Spot-checked seed entries against the
  `DEMO_STATE_COLLECTION_FIELDS` table: every entry carries all required
  fields (including the nullable ones). Moreover, the validator's fallback IS
  the seed, so even a hypothetical seed self-rejection would be behaviorally
  invisible — the failure mode is self-healing by construction.
- **Nuance:** the rationale as communicated cites "JSON date/string forms" as
  the false-rejection risk. That example is imprecise — dates are consistently
  stored as ISO strings in this shape (`createdAt`/`startedAt`/`joinedAt` are
  typed `string`), so a string typeof check on date fields would actually be
  safe. The genuine hazard is the nullable fields above. The substance of the
  acceptance (no realistic producer, realistic corruption is presence-shaped,
  tightening risks discarding valid state) survives regardless.
- MINOR-1 remains strictly stronger than pre-P40 (which checked only
  `value.version === 2`); accepting presence-only validation is a recorded
  scope decision, not a gap.

### Delta verdict

**P40 satisfied: YES — no open findings.** MAJOR-1 is closed and verified at
source, typecheck, and test level. MINOR-1 is accepted with a defensible
rationale (one imprecise example in the stated reasoning, noted above, does
not change the conclusion). No new issues introduced by the fix round.
