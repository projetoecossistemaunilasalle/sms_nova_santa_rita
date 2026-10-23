# P40 Verification — Focused Decomposition (general review)

Date: 2026-09-26. Verifier: independent read-only pass over the working tree
(inspected base `780b0a8` plus uncommitted P40 changes). Node v24.19.0. No
builds executed (already green per implementer). Re-run by the verifier:
`vitest run tests/unit/game-offline-sync.test.ts
tests/unit/player-game-bridge.test.ts tests/unit/adult-portal-service.test.ts
tests/unit/demo-player-access.test.ts` — 4 files, **39/39 pass**; and
`npm run format:check` — clean. All other checks were static reads, greps, and
one throwaway key-diff script run from the OS temp directory (deleted after
use; nothing saved into the repo).

## Scope verified

### P40a — CSS cleanup

1. **Orphan/missing key audit (independent rebuild of the live-key set).** A
   throwaway Node script (temp dir, deleted afterwards) walked all `src/**/*.{ts,tsx}`,
   resolved every `*.module.css` import, extracted per-consumer binding names,
   collected every `styles.<key>` / `teamStyles.<key>` access, parsed each CSS
   file's class selectors (comments stripped, media/nested-aware), normalized
   kebab/camel on both sides, and diffed bidirectionally. Result for the three
   changed modules and the three unchanged ones:
   - `src/components/marketing/marketing.module.css` — 12 keys / 12 referenced
     (3 consumers): 0 orphans, 0 missing.
   - `src/components/portal/portal.module.css` — 169 keys / 169 referenced
     (22 consumers): 0 orphans, 0 missing.
   - `src/components/public/public.module.css` — 37 keys / 37 referenced
     (5 consumers): 0 orphans, 0 missing.
   - Control group (`team-screen.module.css` 6/6, `results.module.css` 24/24,
     `error.module.css` 6/6): also clean, which validates the method.
   A second, independent extraction (grep of selector-leading `.class` tokens)
   produced the same key sets. No dynamic `styles[...]` access, no destructured
   CSS imports, no styles-as-props anywhere in `src`, so the reference set is
   complete. Dead-branch pruning is confirmed: every surviving key has a live
   TS reference and every referenced key resolves.

2. **`mobileNavItem` repaired** — `portal.module.css:157-159`
   (`.mobileNavItem { display: flex; }`), referenced by
   `portal-navigation.tsx:37` (`item.mobile ? styles.mobileNavItem :
   styles.desktopNavItem`). At HEAD the key existed in 0 stylesheets (dossier
   VER-E #11: literal `class="… undefined"` shipped in 45 prerendered files);
   it now resolves. See Finding 3 for semantics.

3. **`entryProblem` repaired** — `public.module.css:534-553`
   (`.entryProblem h1` coral heading, `.entryProblemIcon` 86px circular coral
   mark + svg sizing), referenced by `player-entry-screen.tsx:143,147,162,181,185`
   (the entry error sections). Plausible against the surrounding entry-card
   styles (`entryStatus`/`entryWaiting` pattern).

4. **`desktopNavItem` verification outcome** — the class appears exactly once,
   inside `@media (max-width: 900px)` (`portal.module.css:1229-1233`, hiding
   server-mode desktop nav links in the mobile bottom bar). There is **no**
   dedicated default outside the media rule; the intended desktop default is
   supplied by `.navLink` (`portal.module.css:99-116`, `display: flex` + chrome),
   which is always composed with `desktopNavItem` in the only consumer
   (`portal-navigation.tsx:37`). That composition is confirmed by dossier
   VER-E #12 and ADV-3, and the runbook's prescribed remediation (repair
   `mobileNavItem`, keep the ternary) — rather than ADV-3's alternative
   delete-the-ternary recommendation — was followed. Evidence-based; the
   decision's documentation lives in the pre-existing dossier reports plus the
   runbook (no separate p40 note was written by the implementer — Finding 2).

5. **Credential print block integrity** — all in `portal.module.css`, one
   region: sheet/card/heading/privacy/qr rules at 2189-2271
   (`.printSheet`, `.credentialPrintCard`, `.credentialPrintHeading` + nested
   selectors, `.credentialPrivacy`, `.demoCredentialMark`, `.qrPreparing`) and
   the `@media print` block at 2404-2440 (activation gate
   `.printSheet:not([data-player-print-active])`, two-column print grid, card
   mm sizing). The activation attribute is set live by
   `player-credential-print-sheet.tsx:94-104`. Not split into another file.

6. **No forbidden infrastructure** — `scripts/` still contains only
   `clean-build-artifacts.*`, `next-target.mjs`, `start.mjs`; no CSS parser,
   selector baseline, size gate, or stylesheet split was added (the module
   file set is unchanged: 6 `.module.css` files, none new, none split).
   Validation is correctly deferred to the P50 manual browser smoke.

### P40b — Offline sync split

1. **Five modules exist with the required ownership**
   (`src/runtime/offline/`): `types.ts` (115 lines; queue/result types +
   `GameOfflineTransport` contract + `GameOfflinePersistence` interface),
   `errors.ts` (31; four public error classes), `canonical.ts` (53;
   `stableJson`/`sameJson`/`eventRequestIdentity`/`parseStateConflictResponse`),
   `indexed-db.ts` (694; `openDatabase` + `IndexedDbGameOfflinePersistence`
   with all store/transaction responsibility), `sync-engine.ts` (380;
   `GameOfflineStore` orchestration + `openGameOfflineStore` public factory).

2. **Dependency edges flow engine → persistence → leaves, never back**
   (grep of all import lines): `types.ts` → `@/contracts/v1` only;
   `errors.ts` → nothing; `canonical.ts` → contracts + type-only `./types`;
   `indexed-db.ts` → contracts + `./canonical` + `./errors` + `./types`;
   `sync-engine.ts` → contracts + all four. No module imports the engine, so
   no cycle. Whole responsibilities moved (all orchestration methods live on
   `GameOfflineStore`, all persistence methods on
   `IndexedDbGameOfflinePersistence`); no `.bind(`/unbound-method passing
   found in either class.

3. **No compatibility barrel** — `grep -rn "game-offline-sync" src tests`
   → 0 hits; no `src/runtime/offline/index.ts`; no `@/runtime/offline`
   directory-style imports. `src/runtime/game-offline-sync.ts` is deleted
   (1222 lines removed). `game-host.tsx` repointed to
   `@/runtime/offline/errors`, `@/runtime/offline/sync-engine`,
   `@/runtime/offline/types` (lines 25-30).

4. **Seven original scenarios unchanged except imports** — `git diff
   tests/unit/game-offline-sync.test.ts` contains exactly two hunks: the
   import block (old single-module import → four owned-module imports + one
   `fake-indexeddb` import) and an appended `describe` block. No test-body
   changes. Total `it()` count is 8 = 7 original + 1 new.

5. **`fake-indexeddb` is a direct devDependency** — `package.json` devDeps
   `"fake-indexeddb": "^6.2.5"` (absent from `dependencies`; lockfile
   consistent). The focused lifecycle regression
   (`game-offline-sync.test.ts:741-795`) does exactly: open production store
   (`openGameOfflineStore({ indexedDB: factory })`) → `cacheBootstrap` +
   `enqueueState` (enqueue/persist, asserting the `portal.local_durable.v1`
   ack) → `close()` → reopen against the same `IDBFactory` → read
   (`getSyncStatus` counts + `getNextExpectedRevision`) → and additionally
   re-opens the raw database and reads the persisted row via
   `IndexedDbGameOfflinePersistence.listStates`. It runs against the
   production store, not a test double. **Abort is correctly not covered:**
   the transaction algorithm is unchanged (old `transact`/`read`/`write`
   bodies at HEAD lines 1145-1213 are equivalent to
   `offline/indexed-db.ts:617-694`, same `onabort → fail` wiring), so per the
   runbook no abort regression is required.

### P40c-1 — Host decomposition

1. **`game-host-model.ts` (77 lines) is pure** — exports only types
   (`HostPhase`, `HostAlert`, `HostSyncState`) and functions
   (`demoStorageKey`, `newBootstrap`, `readResponseJson`,
   `errorMessageForEntry`, `applyProgressToBootstrap`); imports are contracts,
   an application type, `createBridgeRequestId`, and a type-only
   `DemoSnapshotRead`. No React import, no `use*`, no
   `window/document/navigator/localStorage/setTimeout` (grep: 0 hits).

2. **`game-host-chrome.tsx` (159 lines) has zero hooks** — four exported
   presentation components (`GameHostHeader`, `GameHostAlert`,
   `GameHostFrame`, `GameHostFooter`); no `use[A-Z]` matches; imports only
   types, `DemoGameAdapter`, model types, and the CSS module.

3. **Lifecycle retained in `game-host.tsx`** — combined count of
   `useEffect(`/`useRef(`/`useState(`/`addEventListener`/`removeEventListener`
   is 21 in the HEAD `game-host.tsx` and 21 in the new one; model + chrome
   contribute 0. Launch-token usage stays via the pre-existing
   `game-host-token.ts` (present at HEAD, untouched). No hook extraction (no
   new hook file; `game-host.tsx` still declares all state/effects inline).

4. **No cycles** — the only inbound references to the split files are
   `player-entry-screen.tsx → game-host`, `game-host → {model, chrome, token}`,
   `chrome → model`; `game-bridge.ts` / `demo-game-state.ts` do not import any
   `game-host*` module (grep: 0 hits).

### P40c-2 — Shell view model and authorization actor

1. **Whole construction moved** — `shell-view-model.ts` `buildPortalShell(
   actor: ActorSnapshot, effectiveRole: AdultRole)` (actor and effective role
   explicit) is body-equivalent to HEAD's `getShell` (same active-membership
   filter, org-name set, `scopeLabel` variants, all four navigation branches,
   `roleLabel` ternaries). `getShell` now loads/validates and delegates:
   `adult-portal/service.ts:110-113` = `const actor = await this.actor(...);
   return buildPortalShell(actor, effectiveRole(actor));`

2. **Shared conversion created and used by the adult-portal service** —
   `src/application/authorization/authorization-actor.ts` exports
   `toAuthorizationActor`; `adult-portal/service.ts` imports it and calls it
   at 20+ sites; HEAD's local `authorizationActor()` in that file is gone.
   **However the player-access service still carries its own copy** — see
   Finding 1.

3. **`getShell` table covers the required scopes** —
   `tests/unit/adult-portal-service.test.ts:278-344` defines `shellScopeCases`
   with five compact cases (platform admin, organization admin, teacher,
   inactive membership, no membership) asserting `effectiveRole`, `roleLabel`,
   `scopeLabel`, and full navigation href lists through
   `service.getShell(...)` (`:344-358`). Superset of the four required scopes.

### P40c-3/5 — Demo transaction and persisted-state validation

1. **Transaction fix** — `adult-portal-demo-store.ts:444-454`
   (`DemoAdultPortalStore`) and `:799-809` (`DemoPlayerAccessStore`): snapshot
   with `structuredClone(this.state)` **before** work; on rejection
   `Object.assign(this.state, before)` restores the existing state object in
   place, then rethrows. Both stores fixed (HEAD had pass-through
   `return work(this)`).

2. **Focused assertions** — `tests/unit/demo-player-access.test.ts` adds:
   - "rolls back a rejected nested transaction in place, preserving state
     identity": nested transaction throws; asserts
     `expect(store.state).toBe(before)` (same-reference identity check) plus
     organizations/classes back to seed lengths (nested **and** outer effects
     rolled back).
   - "commits a successful transaction in place without replacing state
     identity": `expect(store.state).toBe(before)` plus the created
     organization present.
   - "falls back to the seed when persisted state is current-version but
     malformed": payload built from the seed spread (so `version: 2`, the
     current version) with `organizations: null` and a mutated
     `activeProfileId`; expects `readDemoAdultPortalState()` to equal the
     seed.

3. **Validation rules** — `adult-portal-demo-store.ts:346-392`:
   `isValidDemoAdultPortalState` requires a plain object, `version === 2`
   (current), string `activeProfileId`, and every one of the ten collections
   to be an array of plain objects carrying all required fields
   (`Object.hasOwn`). Failure (or invalid JSON) → `cloneSeed()` — a fresh
   clone of the current seed. No migration-on-read behavior exists.

4. **P40c-6** — stored shape unchanged: `DemoAdultPortalState` still
   `version: 2`, `DEMO_ADULT_PORTAL_STORAGE_KEY` still
   `"missoes-caramelito:adult-portal:v2"` (no diff hunk touches either); the
   existing `":v2"` key assertion in the test file still passes. No key/version
   bump needed, none made.

### P40c-4 — Demo credential locality

`grep -rn "node:crypto|createHmac|hmac" src/runtime` → 0 hits. The only
crypto references are browser Web Crypto globals (`crypto.randomUUID()` in
three demo modules; `globalThis.crypto?.subtle` digest in
`offline/canonical.ts`, carried over unchanged from HEAD's
`game-offline-sync.ts:551`). No server HMAC or Node crypto in the demo; no
second hashed copy of demo tokens introduced.

## Findings

1. **MEDIUM — CONFIRMED: the player-access half of the duplicated policy-actor
   conversion was not moved**
   (`src/application/player-access/service.ts:14-26`). The runbook's P40c-2
   says to move "the duplicated policy actor conversion" to
   `authorization/authorization-actor.ts`; at HEAD the duplication was exactly
   two copies (adult-portal service `:49`, player-access service `:14`). The
   shared `toAuthorizationActor` exists and the adult-portal service now uses
   it (20+ sites), but `player-access/service.ts` still defines and calls its
   own private `authorizationActor()` — byte-equivalent in shape
   (`profileStatus`/`platformRole`/membership mapping incl.
   `teacherAssignments`) so there is no behavioral difference, but the
   deduplication requirement is only half-done and a remaining local copy
   exists (`grep "platformRole: actor.platformRole" src` outside
   `authorization-actor.ts` → exactly this file). Confirmed; not a false
   alarm. Suggested completion: import `toAuthorizationActor` in
   `player-access/service.ts`, delete the local function, run the existing
   suites.

2. **INFO — the `desktopNavItem` verification outcome is evidence-based but
   undocumented as a p40 note.** The runbook asked to "verify whether
   `desktopNavItem` has the intended default outside its media rule". Outcome:
   it does not — its single rule sits inside `@media (max-width: 900px)`
   (`portal.module.css:1229-1233`), and the desktop default is `.navLink`
   (`portal.module.css:99-116`), always composed with it
   (`portal-navigation.tsx:37`). This is correct under the runbook's chosen
   remediation and grounded in dossier VER-E #12 / ADV-3, but the implementer
   left no p40 findings note recording the decision (the documentation that
   exists is the pre-existing dossier material). Cosmetic.

3. **INFO — `mobileNavItem` repair is minimal and `desktopNavItem` remains
   runtime-dead (pre-existing).** `.mobileNavItem { display: flex }`
   (`portal.module.css:157-159`) duplicates what `.navLink` already applies;
   its real effect is making the module key resolve so the literal
   `undefined` class token stops being emitted. Since `getShell` and the demo
   navigation still mark every item `mobile: true`
   (`shell-view-model.ts:35-81`, `portal-navigation.tsx:66-123`), the ternary's
   false arm — `styles.desktopNavItem` — is still never applied at runtime
   (VER-E #12's finding, deliberately unchanged by P40). Consistent with the
   runbook; flagged so the P50 manual smoke specifically exercises the mobile
   nav bar.

4. **INFO — file sizes recorded (not pass/fail).** `portal.module.css`
   4910 → 2716; `marketing.module.css` 688 → 213; `public.module.css`
   1017 → 638. Offline split: 1222-line single file → `types` 115 + `errors`
   31 + `canonical` 53 + `indexed-db` 694 + `sync-engine` 380 (1273 total).
   `game-host.tsx` 932 → 804, plus `game-host-model.ts` 77 and
   `game-host-chrome.tsx` 159 (1040 combined). `shell-view-model.ts` 97,
   `authorization-actor.ts` 19.

5. **INFO — false-alarm checks that came back clean.** No CSS orphans/missing
   keys (bidirectional diff, two extraction methods); no
   `game-offline-sync` references anywhere; no offline barrel; no import
   cycle in `offline/` or the `game-host*` graph; no `node:crypto`/HMAC in
   the demo; no CSS parser/baseline/split/size-gate artifacts; the offline
   transaction algorithm is unchanged so the omitted abort regression is
   correct, not a gap.

## Verdict

**P40 satisfied: NO — one confirmed gap.** Everything else verified satisfied:

- P40a fully met: bidirectionally clean CSS (0 orphans, 0 missing across all
  six modules), `mobileNavItem`/`entryProblem` repaired with plausible rules,
  `desktopNavItem` verification outcome evidence-based and consistent with the
  runbook, credential print block intact in `portal.module.css`, no
  parser/baseline/split/gate added.
- P40b fully met: correct five-module ownership split, clean one-way
  dependency edges, old file deleted with no barrel and zero stale references,
  seven scenarios changed only in imports, `fake-indexeddb` as a direct
  devDependency with a genuine open→enqueue/persist→close→reopen→read
  production-store regression, abort correctly uncovered (algorithm
  unchanged), `game-host.tsx` repointed.
- P40c-1 fully met (pure model, hook-free chrome, all 21 lifecycle primitives
  retained, no cycles); P40c-3/5/6 fully met (in-place snapshot/restore with
  rethrow in both demo stores, same-reference identity + commit assertions,
  current-version malformed-state fallback regression, no shape/key change);
  P40c-4 met (no Node crypto/HMAC in the demo).
- P40c-2 partially met: `buildPortalShell`, the delegating `getShell`, the
  shared `toAuthorizationActor`, and the five-case `getShell` table are all in
  place — but the second former duplicate in `player-access/service.ts:14-26`
  was left behind (Finding 1). Complete that one-line-file cleanup and P40
  becomes satisfied; targeted suites (39/39) and `format:check` already pass
  and are unaffected by that remaining copy.
