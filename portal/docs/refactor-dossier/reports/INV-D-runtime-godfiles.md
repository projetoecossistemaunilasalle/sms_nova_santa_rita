# INV-D — Runtime & game-host god-files: split verification

Scope: `src/runtime/game-offline-sync.ts` (1,222), `src/components/public/game-host.tsx` (932), and the
cohort of files §4.2/§4.3 touch. Read-only investigation; no code modified. All line numbers are `HEAD`
(`e5aaf1e`, clean tree) and were re-derived by reading the files, not copied from prior reviews.

Baseline gates re-run for this report: `npx vitest run` on the 5 game-related suites → **19/19 pass**
(`game-offline-sync.test.ts` 7, `player-game-bridge.test.ts` 4, `game-client.test.ts` 3,
`game-host-token.test.ts` 2, `runtime-mode.test.ts` 3). `npx eslint src/components/public/game-host.tsx
src/runtime/game-offline-sync.ts` → **exit 0, no output**.

---

## game-offline-sync inventory

### Top-level declarations (complete, with measured sizes)

Region sizes measured with `awk 'NR>=a&&NR<=b' | wc -l`. The 15 regions plus 14 inter-region blank lines
sum to exactly 1,222.

| Lines | Size | Declaration | Exported | Responsibility |
|---|---|---|---|---|
| 1–21 | 21 | import block | — | 12 parse fns/schemas + 8 types from `@/contracts/v1` |
| 23–29 | 7 | `DATABASE_NAME`, `DATABASE_VERSION = 3`, 5 store-name consts | no | IDB identity |
| 31–37 | 7 | `type QueuedStateSave` | **yes** | queue row shape |
| 39–47 | 9 | `type QueuedResult` | **yes** | queue row shape |
| 49–57 | 9 | `type QueuedActiveTime` | **yes** | queue row shape |
| 59 | 1 | `type QueuedEvent` | **yes** | discriminated union (`kind`) |
| 61–64 | 4 | `type EventRequestReceipt` | **yes** | enqueue return |
| 66–69 | 4 | `type EventRequestIdentity` | **yes** | `{canonicalContent, fingerprint}` |
| 71–76 | 6 | `type GameOfflineSyncStatus` | **yes** | queue counters |
| 78–91 | 14 | `type GameOfflineSyncReport` | **yes** | sync outcome |
| 93–97 | 5 | `type GameOfflineTransport` | **yes** | **seam #2** — outbound HTTP port |
| 99–136 | 38 | `interface GameOfflinePersistence` | **yes** | **seam #1** — storage port, 13 methods |
| 138–168 | 31 | 4 error classes | **yes** | `OfflineStateBlocked`, `OfflineBootstrapMissing`, `OfflineRequestReuse`, `OfflineSessionMismatch` |
| 170–491 | 322 | `class GameOfflineStore` | **yes** | see sub-split below |
| 493–506 | 14 | `openGameOfflineStore` | **yes** | **composition root**; `globalThis.indexedDB` guard at 499 |
| 508–517 | 10 | `parseStateConflictResponse` | no | error→conflict coercion; engine-only (333, 346) |
| 519–526 | 8 | `createClientEventId` | no | `crypto.randomUUID` guard at 520; only used as ctor default (173) |
| 528–530 | 3 | `sameJson` | no | idb-only (781) |
| 532–541 | 10 | `stableJson` | no | canonical JSON w/ sorted keys; 546 + **1044** |
| 543–562 | 20 | `eventRequestIdentity` | no | SHA-256 via `crypto.subtle`, guard at 551 |
| 564–627 | 64 | `openDatabase` | no | `factory.open` + `onupgradeneeded` + `onerror`/`onblocked`/`onsuccess`/`onversionchange` |
| 629–645 | 17 | `StoredBootstrap`, `StoredControl`, `StoredEventRequest`, `NewQueued{State,Result,ActiveTime}` | no | on-disk row shapes |
| 647–1222 | 576 | `class IndexedDbGameOfflinePersistence` | no | implements the port |

`GameOfflineStore` (170–491) sub-split — the plan calls this whole thing "sync-engine", but only 187 of
its 322 lines are sync:

| Lines | Size | Member | Responsibility |
|---|---|---|---|
| 170–179 | 10 | ctor, `close()` | DI of the port + `createEventId` |
| 180–207 | 28 | `cacheBootstrap`, `reserveBootstrapGeneration`, `getBootstrap`, `getNextExpectedRevision` | bootstrap/revision policy |
| 209–293 | 85 | `enqueueState`, `enqueueResult`, `enqueueActiveTime` | local-durable ack facade (`portal.local_durable.v1`), session guard, identity allocation |
| 295–301 | 7 | `getSyncStatus`, `discardConflictedStateBranch` | thin pass-through |
| **303–473** | **171** | **`sync()`** | **the actual engine**: state drain → conflict detection → event drain w/ 100-row active-time batching → report |
| 475–490 | 16 | `persistAndNotifyConflict` | conflict persistence + callback, both swallowed |

`IndexedDbGameOfflinePersistence` (647–1222) sub-split — this is where the real weight is:

| Lines | Size | Members | Responsibility |
|---|---|---|---|
| 648–653 | 6 | ctor, `close` | holds `IDBDatabase` |
| 654–739 | 86 | `getBootstrap`, `reserveBootstrapGeneration`, `cacheBootstrap` | **generation-based last-write-wins** (699–727): 4-way conditional including "different session + higher revision → refuse" |
| 741–826 | 86 | `enqueueState` | **3-way fan-in ready latch** (`bootstrapReady`/`controlReady`/`statesReady`/`started` at 760–767, fed at 802–816, errors at 817–823). Revision re-numbering at 787–791. Idempotency at 777–785 |
| 828–960 | 133 | `listStates`, `acknowledgeState`, `blockState`, `getStateConflict`, `discardStateBranch` | state queue + conflict control row |
| 962–1098 | 137 | `enqueueResult`, `enqueueActiveTime`, `enqueueEvent` | **the idempotency registry**: `eventRequests` lookup (1019–1030), **legacy-backfill compat block** (1032–1072), add+register (1074–1091) |
| 1100–1143 | 44 | `listEvents`, `acknowledgeEvent`, `status` | read side |
| 1145–1221 | 77 | `read`, `write`, `transact` | **store-agnostic primitives**: `succeed`/`fail` settle-guard, `abort()`, "completed without a result" (1207–1208) |

### Does it really use IndexedDB? Yes — and there is **no fallback**.

- One database, `missoes-caramelito-game-v1`, **`DATABASE_VERSION = 3`** (`game-offline-sync.ts:23-24`).
- **5 object stores**, all created additively in one `onupgradeneeded` (568–603):
  `bootstraps` (keyPath `playerId`), `stateQueue` (`id` autoInc + `byPlayer`, `byPlayerRequest` unique),
  `eventQueue` (`id` autoInc + `byPlayer`, `byPlayerSessionKindRequest` unique), `eventRequests`
  (compound keyPath `playerId,classSessionId,kind,requestId`), `controls` (keyPath `playerId`).
- The open happens in `openDatabase` (564–627), called only from `openGameOfflineStore:501`.
- Migration behaviour: **additive only** — every store is behind `if (!objectStoreNames.contains(…))`. No
  `oldVersion` branch, no data transform, no downgrade path. `onversionchange` just `db.close()` (618);
  `onblocked` rejects (609–615). So a §4.2 split that accidentally renames a store or bumps the version
  does not error — it **silently creates an empty store and orphans the queued rows**.
- **No localStorage / InMemory fallback exists.** Verified: the only `indexedDB`/`IDBFactory` mentions in
  all of `src/runtime/` are `game-offline-sync.ts:495, 499, 564`; the only `localStorage` uses are
  `adult-portal-demo-store.ts:348,360` and `game-host.tsx:441,523,533` (a *different* subsystem, demo
  game state). If IndexedDB is unavailable, `openGameOfflineStore` throws (500) and `game-host.tsx:368-376`
  surfaces "Não foi possível abrir o armazenamento seguro do navegador".
- **Unused test seam**: `options.indexedDB` (495) is accepted but **no caller ever passes it** (only call
  site is `game-host.tsx:216`). Dead extensibility surface, 3 lines.

### Singletons / module-level mutable state

**None.** All top-level statements are `const` string literals (23–29), type aliases, class and function
declarations. Module-level state exists only inside `game-host.tsx:125` (`offlineStorePromise` ref) — i.e.
the lazy singleton lives in the component, not the runtime module. That's favourable for splitting.

### Seams with the lowest coupling — cross-reference counts

Every cross-group reference in the file, counted exhaustively:

| Edge | Sites | Lines |
|---|---|---|
| engine → `eventRequestIdentity` | **2** | 246, 281 |
| engine → `createClientEventId` | **1** | 173 (default param) |
| engine → `parseStateConflictResponse` | 2 | 333, 346 |
| idb → `sameJson` | **1** | 781 |
| idb → `stableJson` | **1** | 1044 (inside the 1032 legacy compat block) |
| idb/engine → errors | 4 / 6 | reuse 782,1024,1055; boot 769,902 (+204,234,267,310); session 774 (+236,269,315); blocked 786 (+201) |
| **registry → idb (reverse)** | **0** | — |
| **canonical → idb (reverse)** | **0** | — |

The canonical/identity helpers have **zero** reverse dependencies on the storage layer. The prior review's
"registry↔store cycle" (`docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md:135`) is **refuted as a
cycle**: the identity is *computed by the engine* and *passed in as a parameter* to the port
(`GameOfflinePersistence.enqueueResult/enqueueActiveTime`, 126, 132). The single idb-side use of
`stableJson` at 1044 is one acyclic import inside a legacy-backfill path. Total cross-module edges for the
whole split: **14**, of which 8 are the shared error classes.

---

## proposed split (and how it differs from plan §4.2)

Plan §4.2's four boundaries are **directionally correct** — 650/60/350 reproduce 657/53/346 within a few
lines — but four things are wrong or missing.

**Verdict: 3 of 4 targets are right; `idb-store.ts` must be split one more time or §7.1 is still violated,
and `request-registry.ts` is misnamed.**

| # | Plan target | Plan size | Real region | Real size | Verdict |
|---|---|---|---|---|---|
| 1 | `types.ts` | ~160 | 31–136 + 138–168 + header | **~150** | ✅ correct; the plan's "~162 unallocated lines" is exactly this region and it *is* allocated |
| 2 | `idb-store.ts` | ~650 | 564–627 + 629–645 + 647–1222 | **657** | ❌ **fails §7.1's own 500-line module ceiling.** Needs splitting |
| 3 | `request-registry.ts` | ~60 | 519–526 + 528–530 + 532–541 + 543–562 | **50** | ⚠️ right size, **wrong name** — see below |
| 4 | `sync-engine.ts` | ~350 | 170–491 + 493–506 + 508–517 | **365** | ✅ passes 500 fail, trips 300 warn |
| — | *(unallocated)* | — | 493–506 composition root | 14 | ❌ plan never says where `openGameOfflineStore` lands |
| — | *(unallocated)* | — | 508–517 `parseStateConflictResponse` | 10 | ❌ plan's "conflict detection" bullet covers it but never names it |

### Why `request-registry.ts` must be renamed

The word "registry" already means something concrete in this file: the **`eventRequests` IndexedDB store**
(28, created at 595–599, read/written only at 1008–1098). That store **is** the idempotent retry registry.
The pure function `eventRequestIdentity` (543) only computes the fingerprint it is keyed by. Putting the
pure hash helpers in a file called `request-registry.ts` while the actual registry lives in
`idb-store.ts` guarantees a future contributor edits the wrong one. Recommend **`canonical.ts`** (or
`fingerprint.ts`) for `stableJson` / `sameJson` / `createClientEventId` / `eventRequestIdentity`, and keep
the registry where it lives.

### Recommended split (7 files, every one under the §7.1 fail ceiling)

```
src/runtime/offline/
  types.ts             ~115   31–136 (types + both ports). Type-only: 0 runtime edges.
  errors.ts             ~35   138–168. Leaf. Both sides import → must be one file, not inlined.
  canonical.ts          ~55   519–562. Imports types.ts (1 type). Zero guards at module scope.
  idb-database.ts      ~165   23–29 consts + 564–627 openDatabase + 1145–1221 transact primitives.
                              THE ONLY FILE ALLOWED TO KNOW DATABASE_NAME / DATABASE_VERSION.
                              Put the version policy + additive-migration contract in a header comment.
  idb-store.ts         ~373   629–645 + 648–739 + 741–826 + 828–960 + 1100–1143 (bootstrap/state/read sides)
  idb-event-queue.ts   ~165   962–1098 (enqueueResult/enqueueActiveTime/enqueueEvent + StoredEventRequest)
  sync-engine.ts       ~365   170–491 + 493–506 + 508–517
  index.ts              ~15   barrel, `export *` (precedent: src/contracts/v1/index.ts:1-2)
```

Why the extra `idb-database.ts` / `idb-event-queue.ts` cuts are cheap and safe:
- `read`/`write`/`transact` (1145–1221, 77 lines) reference **zero** store names and **zero** domain types
  — only `this.db`. Converting them to free functions taking `db: IDBDatabase` is a mechanical, signature-
  level change with no behavioural content. This is the single lowest-coupling block in the file.
- `enqueueEvent` (996–1098) is one self-contained transaction over `eventQueue` + `eventRequests`; the two
  public `enqueueResult`/`enqueueActiveTime` (962–994) are 8-line record builders. Nothing else in the class
  calls them; the port calls them.
- Result: 932→ largest output file **373**, vs. the plan's 657. No carve-out needed, and Day 4's §7 gate
  actually passes.

Optional 8th cut if you want `sync-engine.ts` under the 300 warn: move `sync()` (303–473) +
`persistAndNotifyConflict` (475–490) into `sync-run.ts` as a function taking `(persistence, playerId,
transport, onStateConflict, expectedClassSessionId)`. Costs a 5-arg signature; buys 2 files at ~180/~200.
**Not recommended for this sprint** — `sync()` reads `this.persistence` 12 times and is the most behaviour-
dense method in the codebase.

### If you keep the plan's 4-file shape anyway

Then at minimum (a) grant and document the `idb-store.ts` carve-out explicitly (657 > 500), and (b) state
that `errors.ts` content goes into `types.ts`, because both the engine and the store throw all four error
classes and neither can import the other.

---

## public surface & consumers

### Consumers — exhaustive

`grep -rn 'game-offline-sync'` across `src`, `tests`, `scripts`, `contracts`, `docs`, plus a name-by-name
grep of all 16 exports. There are **exactly two importers**, and nothing else:

| Importer | Line | Names imported | Kind |
|---|---|---|---|
| `src/components/public/game-host.tsx` | 26–31 | `openGameOfflineStore`, `OfflineSessionMismatchError`, `type GameOfflineStore`, `type GameOfflineTransport` | app |
| `tests/unit/game-offline-sync.test.ts` | 6–16 | `GameOfflineStore`, `OfflineRequestReuseError`, `OfflineSessionMismatchError`, `type EventRequestIdentity`, `type GameOfflinePersistence`, `type QueuedActiveTime`, `type QueuedEvent`, `type QueuedResult`, `type QueuedStateSave` | test |

No `src/runtime/*` sibling imports it. No Server Action, no `server-only` module, no API route, no
`scripts/`, no `contracts/` reference. This is the cheapest god-file split in the repo.

### 5 of 16 exports are dead outside the module

`GameOfflineSyncStatus` (71), `GameOfflineSyncReport` (78), `EventRequestReceipt` (61) are never named
externally — `game-host.tsx` reads `report.state` / `report.conflict` off the value returned by `sync()`
without ever importing the type (`game-host.tsx:307-367`), and `status` likewise (269, 347).
`OfflineStateBlockedError` (138) and `OfflineBootstrapMissingError` (147) are thrown internally only
(engine 201/204/234/267/310; idb 769/786/902) and are never caught or instanceof-checked by any consumer —
**unlike** `OfflineSessionMismatchError`, which is caught at 7 sites in `game-host.tsx` (369, 430, 432, 487,
511, 613). Deleting those 5 exports is a legitimate, deliberate narrowing — but it is a behaviour-visible
change and does not belong in a "split" PR. **Recommendation: re-export all 16 through `offline/index.ts`
and delete nothing.**

### Stable public API should be: a barrel at `src/runtime/offline/index.ts`, with `game-host.tsx` repointed to submodules

Reasoning:
1. `src/runtime/` is **16 flat files, zero subfolders, zero barrels today**. The only barrel in `src`
   outside `src/app/` is `src/contracts/v1/index.ts` (2 lines of `export *`). A folder + barrel is a **new**
   convention for `src/runtime/`, so it must be a deliberate decision.
2. A barrel keeps `@/runtime/game-offline-sync` trivially preserved as a one-line
   `export * from "./offline"` re-export shim — **zero consumer edits**, and the test's `:16` import never
   has to move. That is the lowest-risk option and I recommend it if you want minimum churn.
3. My actual recommendation is the opposite of (2): **no shim, edit both importers.** A permanent shim means
   the 1,222-line offender still exists as a path, §7.1's "new or modified files" ratchet can't see the
   win, and nobody ever learns the new layout. Only 11 names × 2 files need touching.
4. Import **submodules directly** (`@/runtime/offline/sync-engine`, `@/runtime/offline/errors`) and keep
   `index.ts` as the *public* surface only. That way `idb-database.ts`'s `DATABASE_VERSION` stays private
   and someone can't bump it from `game-host.tsx`.

### Local convention check on `src/runtime/`

| File | Lines | Role |
|---|---|---|
| `mode.ts` | 17 | `RuntimeMode` enum + `getRuntimeMode`/`isDemoRuntime` from `APP_RUNTIME_MODE` |
| `adult-portal-server.ts` | 80 | `import "server-only"` adapter over `AdultPortalService` (Prisma) |
| `adult-portal-demo.ts` | 75 | same service over `DemoAdultPortalStore` |
| `adult-portal-demo-store.ts` | 1,024 | localStorage-backed demo DB (separate subsystem) |
| `adult-portal-demo-actions.ts` | 223 | `"use client"` write-path twin of the real Server Actions |
| `adult-portal-server-client.ts` | 11 / `adult-portal-demo-client.ts` 20 | client-side portal state readers, twin pair |
| `player-access-server.ts` 16 / `player-access-demo.ts` 23 | 39 | read-path twin pair |
| `player-access-demo-actions.ts` | 154 | `"use client"` issuer + slot actions |
| `player-entry-demo-actions.ts` | 45 | `"use client"` twin of `(public-play)/jogar/actions.ts` (`"use server"`) |
| `game-events-server.ts` 46 / `game-events-demo.ts` 121 | 167 | results-page data twin pair |
| `demo-auth-actions.ts` | 7 | throwing no-op for the demo sign-in seam |
| `demo-professional-creation.ts` | 76 | demo membership helper |
| **`game-offline-sync.ts`** | **1,222** | **the only client-side browser-runtime module here** |

Convention signals for the new folder:
- Naming is `twin` pairs resolved by the 9 `@runtime/*` aliases in `next.config.ts:43-82` (each alias picks
  `-demo` vs `-server`). **`game-offline-sync` has no twin** and is not aliased — it is unconditionally
  server-target logic shipped to both builds.
- Server files carry `import "server-only"` as line 2 (`adult-portal-server.ts:2`,
  `game-events-server.ts:2`, `player-access-server.ts:2`). **Do not add that to any `offline/` file** —
  `game-host.tsx` imports it from a `"use client"` component, so `server-only` would break the build.
- `src/application/*` and `src/server/*` **do** use domain subfolders (`src/server/db`,
  `src/server/security`, …). A `src/runtime/offline/` folder is consistent with *those*, just not with
  `src/runtime`'s current flatness. Defensible. A flat `offline-*.ts` prefix would be *more* conservative
  (`offline-types.ts`, `offline-canonical.ts`, `offline-idb-database.ts`, `offline-idb-store.ts`,
  `offline-idb-event-queue.ts`, `offline-sync-engine.ts`) and needs **no** barrel — worth considering since
  it removes the `index.ts` convention question entirely.

---

## test impact

### What the test actually imports

`tests/unit/game-offline-sync.test.ts` is 728 lines, 7 `it()` cases, all inside one
`describe("GameOfflineStore")` (281). Its import block (6–16) is quoted above. Fixtures come from
`readFileSync(resolve(process.cwd(), "contracts/fixtures/v1/valid", name))` (27–33) — i.e. **file-path
coupling to `contracts/`, not to `src/`**, so the split does not touch them.

### How it fakes IndexedDB: **it doesn't. There is no IndexedDB in the test at all.**

`fake-indexeddb` is **not** in `package.json` (dependencies 28–41, devDependencies 42–54) and is **not** in
`package-lock.json`. Nor are `jsdom` or `happy-dom` (the only `package-lock.json:13636-13671` hits are
vitest's own *optional* peer-deps entries, not installed).

Instead the test exploits the dependency-injection port:
`class MemoryOfflinePersistence implements GameOfflinePersistence` (`:35`) — a plain in-memory Map/array
implementation, 244 lines (`:35-279`), injected as `new GameOfflineStore(persistence, fakeCreateEventId)`
(`:284, 320, 376, 446, 496, 611, 691`). It never calls `openGameOfflineStore`, never constructs
`IndexedDbGameOfflinePersistence`, never touches `IDBFactory`.

**This is the single most important finding in this report.** Under this design, the 7 passing tests cover:

| Covered by tests | Lines | Coverage |
|---|---|---|
| `GameOfflineStore` (engine + facade + sync + conflict) | 170–491, 508–517 | **good** — all 7 cases |
| shared types + errors | 31–168 | exercised transitively |
| `stableJson` / `eventRequestIdentity` / SHA-256 | 532–562 | exercised transitively (enqueue* → identity → `crypto.subtle`) |
| **`openGameOfflineStore`** 493–506 | 14 | **ZERO** |
| **`createClientEventId`** 519–526 | 8 | **ZERO** (every test injects a fake id fn) |
| **`sameJson`** 528–530 | 3 | **ZERO** |
| **`openDatabase`** (schema + migration) 564–627 | 64 | **ZERO** |
| **`IndexedDbGameOfflinePersistence`** 647–1222 | 576 | **ZERO** |
| **TOTAL UNTESTED** | — | **665 lines / 54% of the file**, and it is 100% of the storage layer |

So the "650-line `idb-store.ts`" the plan wants to carve out is **the exact half of the file that has never
been executed by any automated check in this repository.** A pure move refactoring it is only as safe as the
TypeScript compiler. See *regression risks* for the tests to write first.

### Which private (non-exported) symbols does the test reach into? **None.**

Verified exhaustively against 508–627 and 647–1222: the test imports only the 9 names at `:6-16`, all
exported. It reimplements the storage semantics *from scratch* rather than importing internals. So:
**a split that keeps those 9 names importable from one path breaks nothing in the test.** That contradicts
the framing in `docs/agent-reviews/refactor-plan-v2/RV-B-cross-document-consistency.md:181` ("the test also
stays >400 lines"); see the next row for the size correction.

### Test file vs the §7.1 ratchet — prior reviews got this wrong

`REFACTOR_PLAN.md` §7.1: "**Test suites: 400 warn / 800 fail**". `game-offline-sync.test.ts` is 728 lines →
**WARN, not FAIL.** The claims at `RV-B:240` ("**violates §7.1**") and `00-SYNTHESIS.md:64` (listing it
among "**9 unbudgeted files**") are **incorrect against the plan's own numbers** — 728 < 800. Splitting the
test is *nice-to-have*, not a gate requirement. That materially lowers the cost of §4.2.

`idb-store.ts` at 657, by contrast, is a **module** → 300 warn / **500 fail** → genuinely fails.

### vitest.config.mts — how does an IndexedDB module test run under `environment: "node"`?

`vitest.config.mts:12` sets `environment: "node"`. It runs **because the tests never touch IndexedDB**
(dual purpose of the `GameOfflinePersistence` port at `game-offline-sync.ts:99`). Web-Crypto *is* used and
*does* work: verified on this machine —

```
node v22.23.1  indexedDB: undefined  crypto: object  randomUUID: function  subtle: object
```

`globalThis.indexedDB === undefined` under Node means any test that tried
`openGameOfflineStore()` would hit the guard at `game-offline-sync.ts:500` and throw
`"IndexedDB is not available in this browser"` — **unless** it injects `options.indexedDB` (495), the seam
that exists and is unused. That is exactly the hook a pre-split characterization test needs: pass a stub
`IDBFactory`. Alternatively add `fake-indexeddb` as a devDependency — a **new dependency**, which §4.2 does
not mention and which touches `package.json`/`package-lock.json`.

Also note: `vitest.config.mts:8` aliases only `"@" → ./src/`. It does **not** alias the nine `@runtime/*`
paths from `next.config.ts:43-82`. So `src/runtime/*` modules are only testable when imported transitively
via `@/runtime/...`; anything using `@runtime/...` is opaque to vitest today. A `src/runtime/offline/`
folder needs no config change (`@/runtime/offline/sync-engine` resolves under the `@` alias).

### Net test impact of the recommended split

**Zero test logic changes.** One edit: the import block at `tests/unit/game-offline-sync.test.ts:6-16`
repointed (7 `from` clauses if importing submodules directly, or **nothing at all** if a
`@/runtime/game-offline-sync` shim is kept). Plus one edit at `game-host.tsx:26-31`. The 7 cases pass
unchanged either way because they exercise the DI port, not the storage.

---

## browser-API hazards

### Module-init side effects: NONE today, and the split must keep it that way

`game-offline-sync.ts` has no top-level statements other than `const`/`type`/`class`/`function`
declarations. It is already import-safe in Node. Every browser access is **inside a function body**:

| Guard | Line | Runtime check | Current safety |
|---|---|---|---|
| `globalThis.indexedDB` | 499 | inside `openGameOfflineStore` body | ✅ safe — only reached from `game-host.tsx:216`, an event handler |
| `globalThis.crypto?.randomUUID` | 520 | inside `createClientEventId` | ✅ safe |
| `globalThis.crypto?.subtle` | 551 | inside `eventRequestIdentity` | ✅ safe — and Node has it, so tests pass |
| `navigator.onLine` (consumer) | `game-host.tsx:276, 422, 603, 776` | inside async fns / `useEffect` | ✅ never at render |
| `window.localStorage` | `game-host.tsx:441, 523, 533` | inside handlers | ✅ never at render |
| `document.visibilityState` / `hasFocus()` | `game-host.tsx:774-775` | inside `sendVisibility`, in `useEffect` | ✅ |
| `window.addEventListener` / `setTimeout` | `game-host.tsx:786-791, 806` | inside `useEffect` | ✅ |
| `new URL()` (in `expectedGameOrigin`) | `game-bridge.ts:50` ← `game-host.tsx:139` | **runs during render** | ✅ `URL` exists in Node — this one *is* render-time; do not "optimise" it into a module const |

### The concrete trap a naive split creates

`openGameOfflineStore` (493–506) is the *only* thing that touches `indexedDB`. If it moves into
`idb-store.ts` / `idb-database.ts`, and the implementer "tidies" it into a module-level constant:

```ts
// DO NOT DO THIS — kills `npm run build:demo`
const factory = globalThis.indexedDB;
if (!factory) throw new Error("IndexedDB is not available in this browser");
```

…or hoists `const subtle = globalThis.crypto.subtle` to module scope in `canonical.ts`, the demo **static
export fails**. This is not hypothetical: `idb-database.ts` is precisely the file whose whole purpose is
"database open", so a module-scope `open()` or a module-scope availability assert is the natural-looking
shape. **Keep `openGameOfflineStore` in `sync-engine.ts` (or its own `index.ts` composition root) and keep
both guards inside function bodies.**

Related: `IDBFactory`/`IDBDatabase`/`IDBObjectStore`/`IDBTransaction`/`IDBTransactionMode` appear in
signatures at 495, 564, 648, 1147, 1164, 1175. These are **type-only**, erased at build, and come from
`tsconfig.json:4` `"lib": ["dom", "dom.iterable", "esnext"]`. They are safe in Node. Do not confuse
"type-only DOM dependency" with "runtime DOM dependency".

### Reachability: demo build graph — YES. Server Component — YES (as a client child).

Proven three ways:

1. **Static chain.** `src/app/(public-play)/jogar/page.tsx:1,15` — a Server Component (no `"use client"`)
   renders `<PlayerEntryScreen>` (`src/components/public/player-entry-screen.tsx:1` is `"use client"`),
   which renders `<GameHost>` at `:170-176`, which imports
   `@/runtime/game-offline-sync` at `game-host.tsx:26-31`.
2. **Demo mode keeps the chain.** `@runtime/player-entry-action` resolves in demo to
   `src/runtime/player-entry-demo-actions.ts`, which is `"use client"` (line 1) — a legal client import
   from a client component. `game-offline-sync.ts` itself is not aliased, so it ships unconditionally.
   `next.config.ts:28` sets `output: "export"` for the non-dev demo target → `/jogar/` is **prerendered in
   Node** → the module graph is evaluated.
3. **Hard artifact evidence.** The existing demo export contains the engine:
   `grep -l missoes-caramelito-game-v1 out/` → `out/_next/static/chunks/0pvtinj9q2oay.js` (46,032 bytes;
   shared chunk, also carries `game-host`/`contracts` strings such as `portal.local_durable.v1` — per-module
   byte attribution is **UNVERIFIED** without a bundle analyser).

**Bonus finding §4.2/§4.3 do not mention: the entire 1,222-line engine is dead code in the demo bundle.**
In demo mode every path into the store is gated out:
- `synchronizeQueue` returns at `game-host.tsx:260` (`if (runtimeMode !== "server") return`) → the 5
  `getOfflineStore()` call sites (268, 399, 455, 592, 679) are unreachable;
- `queueResultOrActiveTime` is only called from `:738`, inside the `else` of `:731`;
- `saveServerState` only from `:720`, the `else` of `:715`;
- `bootstrapServer` only from `:503`, the `else` of `:500`;
- `deliverConflict` (233) is only called from `synchronizeQueue` (311, 315) → `pendingConflict` (124) is
  never set → the `bootstrap_applied` offline branch at `:677-698` never fires.

So a lazy/dynamic import boundary on `runtimeMode === "server"` would drop ~1,200 source lines plus the
`@/contracts/v1` offline schemas from the GitHub-Pages bundle. That is a **user-visible win** the plan
doesn't claim, and it's arguably a better Day-3 hour than file-count gymnastics.

### Not reachable from any Server *module*

No file with `"use server"` or `import "server-only"` imports `game-offline-sync` (verified by the
exhaustive grep in the previous section — only `game-host.tsx:26-31` and the test). API routes
(`src/app/api/v1/player/{bootstrap,state,results,active-time}/route.ts`) do not import it; they use the
server-side services. So it is client-only and there is no server-side blast radius.

---

## game-host inventory

932 lines. `"use client"` at `:1`. **22 functions** (4 module-level, 18 in-component), **13 `useRef`**,
**6 `useState`**, **2 `useEffect`**, **0** `useMemo`/`useCallback`/`useReducer`/`useEffectEvent`.

### Module-level (pure, zero coupling — 52 lines)

| Lines | Decl | Notes |
|---|---|---|
| 48–58 | `ReadyEntry`, `HostPhase` (8 states), `HostAlert` | types only |
| 60–62 | `demoStorageKey` | 1 template literal |
| 64–80 | `newBootstrap` | schema parse + `createBridgeRequestId` |
| 82–88 | `readResponseJson` | try/catch `.json()` |
| 90–101 | `errorMessageForEntry` | 4-way switch, pt-BR copy |
| 825–834 | `phaseCopy` *(in-body but static)* | 8-entry `Record<HostPhase,string>` |

### State: 13 refs + 6 states = **19 mutable slots**

| Slot | Line | Owner (single?) | Writers | Readers |
|---|---|---|---|---|
| `frameRef` | 114 | bridge + render | — | 161, 764, 770, 885 |
| `launchRef` | 115 | **bridge-only** ✅ | 187 | 171, 179 |
| `bootstrapStarted` | 119 | bridge, leaked | 495, 506, 643, 659, 818 | 494, 807 |
| `bootstrapRef` | 120 | **both** | 221, 229, 539→228, **754**, 820 | 238, 563, 699 |
| `inFlightSaves` | 121 | dispatcher-only | 713, 717, 721 | 711 |
| `savedReplies` | 122 | **both** | 417, 621 | 706 |
| `handledConflicts` | 123 | sync | 235 | 234 |
| `pendingConflict` | 124 | **both** | 236, 678, 690 | 677 |
| `offlineStorePromise` | 125 | sync-only | 216 | 216 |
| `syncPromise` | 126 | **sync-only** ✅ | 380, 384 | 261 |
| `syncRequested` | 127 | **sync-only** ✅ | 262, 385 | 386 |
| `synchronizeRef` | 128 | trampoline | 755 | 783 |
| `receiveRef` | 129 | trampoline | 753 | 766 |
| `phase` | 130 | **both** | 223, 250, 496, 507, 551, 574, 581, 599, 609, 628, 644, 650, 660, 684, 700, 714, 732, 744, 821 | 804, 853, 857, 874 |
| `alert` | 131 | **both** | 224, 252, 280, 360, 366, 371, 420, 428, 497, 508, 575, 582, 601, 610, 629, 645, 651, 661, 691, 701, 732, 745, 810, 822, 830-ish | 861 |
| `bootstrap` | 132 | **both** + render | 222, 230, 819 | 754, 872, 873, 923 |
| `lastHostMessage` | 133 | bridge (demo-only) | 157 | 874 |
| `syncState` | 134 | both (mostly sync) | 251, 277, 353, 600, 685 | 911 |
| `queuedCount` | 137 | **sync-only** ✅ | 274, 352 | 915, 916 |

**Only 4 of 19 slots (`launchRef`, `syncPromise`, `syncRequested`, `queuedCount`) have a single owner.**
The other 15 straddle the proposed `useGameBridge` / `useGameSync` boundary. (The audit's "13 refs, 6 state
hooks, 8 `runtimeMode` branches" at `docs/architecture-audit-2026-09-23.md:115` is accurate on refs/state;
the branch count is 11, see below.)

### Effects and lifecycle

| Lines | Effect | Subscribes | Deps | Why the deps are what they are |
|---|---|---|---|---|
| 759–801 | listener effect (server + `gameOrigin` only) | `message`, `focus`, `blur`, `online`, `offline` on `window`; `visibilitychange` on `document` — **6 listeners** | `[gameOrigin, runtimeMode]` | Deliberately *not* `[receiveGameMessage]` — it would re-subscribe every render and lose messages. It works only because of the ref trampolines at 128–129/753–757. |
| 803–815 | 12-second "game didn't answer" watchdog | `window.setTimeout` | `[phase, runtimeMode]` | Reads `bootstrapStarted.current` inside the callback (807) |
| 817–823 | `handleFrameLoad` (iframe `onLoad`) | resets `bootstrapStarted`, `bootstrap`, `bootstrapRef`, `phase`, `alert` | — | **This is the reconnect/replay entry point**: a game reload silently resets the whole handshake while the offline queue survives in IndexedDB |

`bootstrapRef.current = bootstrap` at **754** is a render-time ref write. Combined with the imperative
writes at 221/229/820, `bootstrapRef` has **two writers with different clocks** (state mirror + imperative).
Line **699** (`if (message.request_id !== bootstrapRef.current?.request_id) return;`) is the only reader
that decides whether a `game.bootstrap_applied.v1` is accepted — so the write ordering at 754 is
**load-bearing for message correctness**.

### Handlers / control flow, by responsibility

| Responsibility | Lines | Size |
|---|---|---|
| outbound messaging (`postToGame`, `showProtocolError`, `replyToRequest`) | 141–164, 620–623 | 48 |
| launch-token renewal + transport (`validLaunchToken`, `postWithFreshBearer`) | 166–213 | 48 |
| offline-store lazy singleton | 215–218 | 4 |
| bootstrap lifecycle (`install/update`, `bootstrapDemo`, `bootstrapServer`, `beginBootstrap`) | 220–231, 439–452, 454–491, 493–518 | 110 |
| conflict delivery | 233–257 | 25 |
| **sync orchestration** | **259–390** | **132** |
| event queueing (`queueResultOrActiveTime`) | 392–437 | 46 |
| demo save path | 520–588 | 69 |
| server save path | 590–618 | 29 |
| **inbound dispatcher** (`receiveGameMessage`, 5 message-type branches) | **625–751** | **127** |
| trampolines + effects + frame load | 753–823 | 71 |
| copy + JSX | 825–931 | 107 |

### `runtimeMode` branch count: 15 textual occurrences, **11 decision sites** (not 8, not 13)

`:106` destructure and `:111` type annotation are declarations; `:801` and `:815` are dep-array entries. The
**11 branches** are `:156` (postToGame demo short-circuit), `:260` (sync early return), `:500`
(bootstrapDemo/bootstrapServer), `:715` (saveDemoState/saveServerState), `:731` (demo refuses results),
`:760` (listener effect server-only), `:804` (watchdog server-only), `:846`, `:871` (adapter vs iframe vs
unavailable), `:905`, `:920` (copy/footers).

---

## proposed game-host split (and how it differs from plan §4.3)

### Are `useGameBridge` / `useGameSync` the right cuts? **No — this is exactly the documented failure mode.**

`docs/agent-reviews/refactor-plan-v2/CRITIQUE.md:133` already flagged "13 refs and 6 `useState` across the
planned hook boundary, bidirectionally". My independent count confirms it: **15/19 slots shared.**

The concrete coupling that cannot be cut without behaviour change:

- `synchronizeQueue` (259–390, 132 lines) needs **19 external bindings**, including `postToGame` (322, 334),
  `replyToRequest` (318), `deliverConflict` (311, 315), `updateCurrentBootstrap` (344) — **all of which are
  bridge/UI**, plus `entry.playerSlotId`/`entry.gameSessionId`, `runtimeMode`, `navigator.onLine`,
  `postWithFreshBearer` (via the transport at 288–305), and 4 setters.
- `deliverConflict` (233–257) writes `handledConflicts` + `pendingConflict` (sync), `bootstrapRef` (bridge),
  calls `replyToRequest` (bridge), and sets `phase`/`syncState`/`alert` (UI). It is definitionally on **both**
  sides.
- `receiveGameMessage` (625–751) is the **dispatcher**: it routes `game.ready.v1`→bridge,
  `bootstrap_applied`→both, `save`→mode, `result`/`active_time`→sync. It needs both hooks and would itself
  have to be shared.
- Two functions in sync would have to be *called by* bridge: `synchronizeQueue` from `bootstrapServer:490`
  and from the effect's `reconnectAndSync` (781–784). And two in bridge must be *called by* sync
  (`postToGame`, `replyToRequest`).

The file **already contains the workaround**: `synchronizeRef`/`receiveRef` (128–129) written during render
(753–757) so the stable effect (deps `[gameOrigin, runtimeMode]`) sees fresh closures. Two hooks means two
such trampoline pairs — doubling the pattern that is the file's most fragile property, and moving it from
"one render-time ref write" to "cross-hook ref writes".

Two extra lint hazards:
1. **`npm run lint` is `eslint . --max-warnings=0`** and the React Compiler rule set is **active at
   severity 2**, including `react-hooks/refs`, `react-hooks/purity`,
   `react-hooks/set-state-in-render`, `react-hooks/immutability` (verified via
   `eslint --print-config src/components/public/game-host.tsx`). Today the file lints clean (exit 0). A
   hooks-split that passes refs across hook boundaries or duplicates the 753–757 write pattern is a
   plausible lint error — which breaks Day 4's `npm run lint` gate. Exact outcome: **UNVERIFIED**; it is
   cheap to verify per-extraction.
2. `demo-game-adapter.tsx:3,34` already uses **`useEffectEvent`** (React 19.2.8, verified installed) for
   exactly this problem. `game-host.tsx` does not. Converting `receiveRef`/`synchronizeRef` to
   `useEffectEvent` is a **smaller, better-targeted, same-risk-budget fix** than the plan's two-hook split —
   it deletes the render-time ref writes at 753–757 (lines 220–231 and 259–390 stay put) and removes the
   fragility the split was partly meant to address.

### Is a component split safer than a hooks split? **Yes, decisively.**

A presentational child moves **JSX text**; a hook moves **state ownership**. The 107-line render block
(825–931) plus `phaseCopy` needs 8 props (`phase`, `alert`, `bootstrap`, `syncState`, `queuedCount`,
`runtimeMode`, `formattedPlayerNumber`, `gameOrigin`) and one `children` slot for the frame. **No mutable
slot crosses the boundary in the write direction** — it's pure state → markup. That's a mechanical,
reviewable, visually-verifiable move. The hooks split moves 15 shared slots and 6 cross-called functions.

### Honest achievable line count after the split

| Extraction | Δ game-host.tsx | New file(s) | §7.1 status |
|---|---|---|---|
| pure helpers 48–101 → `game-host-model.ts` | −53 → **879** | ~70 | both under 300 warn ✅ |
| + `GameHostChrome` (825–931) | −107 → **772** | ~130 | ✅ |
| + sync presentation (288–305 transport, 317–340 ack fan-out, 347–367 status mapping) → `game-sync-presenter.ts` (node-testable, no refs) | −62 → **710** | ~90 | ✅ |
| + `useGameBridge` (141–213, 759–815) | −150 → **560** | ~200 + ~12 params/context | new file ✅, parent still **FAILS 400** ❌ |
| + `useGameSync` (259–437, 590–618) | −245 → **~315** | ~300 needing 12 shared slots back | ❌ both trip warn; the 315 assumes a shared-state context object that adds lines back |

**Realistic, behaviour-preserving outcome: 4–6 files at ~315 / ~200 / ~200 / ~130 / ~90 / ~70** — with
~28–35 total **added** lines from import headers, param threading and a shared-state context. The plan's
"~250-line clean presentational `game-host.tsx`" (`REFACTOR_PLAN.md:171`) is **not achievable without
redesigning the state machine**, i.e. a behaviour change wearing a refactor's clothes.

Alternative that reaches the ceiling honestly: split on the **`runtimeMode` axis** (the two modes share only
`phase`/`alert`/`bootstrap`/`inFlightSaves`/`savedReplies` and the dispatcher), giving
`game-host.tsx` (shell/dispatch, ~120) + `game-host-demo.tsx` (~200) + `game-host-server.tsx` (~520). Still
one file failing 400, so this too needs a hooks cut inside server mode.

---

## duplicate-handshake claim: **REFUTED**

**Plan text** (`REFACTOR_PLAN.md:171`, §4.3 item 3): *"Eliminate duplicate handshake code between
`game-host.tsx` and `demo-game-adapter.tsx`."*

**Verdict: there is no duplicate handshake. The work described is already done.**

Evidence, independently derived (not copied from the prior review):

1. `src/components/public/demo-game-adapter.tsx` is **112 lines** and contains **zero** `postMessage`,
   **zero** `addEventListener`, **zero** `message` listeners, **zero** `origin` checks, **zero**
   `isTrustedGameMessage`, **zero** `contentWindow`. Exhaustively verified: `grep -n
   "postMessage|addEventListener\(\"message\"|isTrustedGameMessage|origin" src/components/public/*` outside
   `game-host.tsx` returns **only** `game-bridge.ts:59, 65, 66, 72` (the definition and its `url.origin`
   return). The two `postMessage` calls in the whole `public/` folder are `game-host.tsx:163` and `:778`.
   The adapter talks to the host **through props only**: outbound via `onMessage(request)` at `:69` and
   `useEffectEvent(emitFromEffect)` at `:34-36, 39, 46-49`; inbound via the `lastHostMessage` prop parsed at
   `:52-53`. That is the *opposite* of the iframe transport (`window.postMessage` + `MessageEvent`); there
   is nothing in common to deduplicate.
2. The genuinely shared handshake primitive **was already extracted**: `createBridgeRequestId` is defined at
   **`game-bridge.ts:77`** (with a `typeof crypto !== "undefined"` guard at `:78` — note this is the one
   place in the cohort that *already* handles non-browser evaluation) and is imported by both
   `game-host.tsx:34` and `demo-game-adapter.tsx:11`. Its consumers are `game-host.tsx:72, 459` and
   `demo-game-adapter.tsx:65`.
3. `game-bridge.ts` is **84 lines** (`REFACTOR_PLAN.md:169`'s "already exists" note is accurate) and its
   three exports are already the shared, **tested** surface: `parseGameBridgeMessage` (`:24`) used at
   `game-host.tsx:626`; `expectedGameOrigin` (`:48`) at `:139, 761`; `isTrustedGameMessage` (`:65`) at
   `:765`. `tests/unit/player-game-bridge.test.ts` covers them (`:16` contract validation, `:38` "requires
   the configured origin and the exact iframe window").

**Attribution correction.** The task prompt sources this to "`VV-C`". The finding actually lives in
`docs/agent-reviews/refactor-plan-v2/RV-E-godfiles-css.md:133-141` and `:228`, restated at
`CRITIQUE.md:132-133` and `00-SYNTHESIS.md:98`. `VV-C` is the action-seam verification and does not contain
it. (Marking this down because a wrong citation in a plan is how a refuted claim survives re-review —
`00-SYNTHESIS.md:98` says exactly that: *"this one is the plan being wrong, and it survived verification"*.)

### What should replace §4.3 item 3

Three options, in descending value:

**(a) REPLACE with the mode-boundary item (highest value, same file).**
*"In demo mode the entire `@/runtime/game-offline-sync` graph (1,222 lines, 5 IndexedDB stores, Web Crypto)
is statically imported but unreachable — `game-host.tsx:260` returns before any store access and every other
call site (268, 399, 455, 592, 679) sits behind a demo short-circuit at 156/500/715/731. Yet it ships to
GitHub Pages: `out/_next/static/chunks/0pvtinj9q2oay.js` contains `missoes-caramelito-game-v1`. Gate the
import behind `runtimeMode`."* This is a measurable bundle win; item 3 is worth zero.

**(b) REPLACE with the one *real* handshake defect found in the adapter.**
`demo-game-adapter.tsx:16-20` is the only message in the pair built as a raw `as const` literal rather than
through its schema: `supported_protocol_versions: [1]` / `supported_state_schema_versions: [1]` hardcode the
versions, while `game-host.tsx:642, 657` validates them against `PROTOCOL_VERSION` and
`STATE_SCHEMA_VERSION` (`src/contracts/v1/schemas.ts:4-5`, both `= 1 as const`) and `gameReadyV1Schema`
exists (`schemas.ts:115`, exported parser `parse.ts:42`). **The day the protocol bumps to 2, the adapter
keeps claiming version 1 and the demo silently tests a stale handshake.** Fix = 4 lines: build
`demoGameReady` via `parseGameReadyV1({…, supported_protocol_versions: [PROTOCOL_VERSION],
supported_state_schema_versions: [STATE_SCHEMA_VERSION]})`. Cheap, real, and exactly the kind of thing a
"handshake duplication" bullet *should* have pointed at.

**(c) NAME the duplication that does exist** — it is host↔store, not host↔adapter, and it is *deliberate*:
`game-host.tsx:122` (`savedReplies`) is a second, in-memory idempotency cache layered on
`IndexedDbGameOfflinePersistence.enqueueEvent`'s `eventRequests` registry
(`game-offline-sync.ts:1008–1030`, store created at `:595-599`). Memory answers the same-tab retry
(`game-host.tsx:706-708`) and IDB answers the post-reload retry (`game-offline-sync.ts:246, 281` identity
fingerprint). Two levels is a **feature** — but nothing in `game-host.tsx` or `game-offline-sync.ts` says
so, and a future contributor "consolidating" them would silently break lost-ack recovery, which is the
explicit subject of `tests/unit/game-offline-sync.test.ts:373`. Write the invariant down; don't dedupe it.

Also worth adding: `game-host.tsx:48-58` (`HostPhase`, `ReadyEntry`, `HostAlert`) and `:825-834`
(`phaseCopy`) are the file's *presentation contract* and belong with (b)'s cleanup, not in a hook.

---

## regression risks & pre-split characterization tests

### Risk register — §4.2 (offline split). P = probability, I = impact if silent.

| # | Risk | Where it lives | Test today | P × I | Mitigation |
|---|---|---|---|---|---|
| S1 | **Store rename / version bump silently orphans queued rows.** `onupgradeneeded` is additive-only with `if (!contains(…))` guards (568–603); no `oldVersion` branch, no downgrade. Renaming `eventQueue` → a new empty store is created, the old data becomes unreachable, **no error thrown**. A child's unsent results vanish. | 23–29, 564–627 | **NONE** (54% untested) | Med × **Critical** | Characterization **T1** below + a store-name/version freeze comment + `DATABASE_VERSION` in exactly one file (`idb-database.ts`) |
| S2 | **`transact` settle semantics.** `succeed()` only *records* (1200–1203); the promise resolves on `transaction.oncomplete` (1204–1210), and completing without a `succeed()` rejects with "completed without a result" (1207–1208). `fail()` aborts inside try/catch (1189–1193) and is settle-guarded (1187). Any refactor that resolves eagerly (e.g. `request.onsuccess` → `resolve`) turns **uncommitted writes into phantom successes** — the game is told "saved", the row never lands. | 1145–1221 | **NONE** | Med × **Critical** | **T2** (abort + partial-write) before extracting `idb-database.ts` |
| S3 | **`enqueueState`'s 3-way fan-in latch.** `bootstrapReady`/`controlReady`/`statesReady`/`started` (760–767) with three independent `onsuccess` writers (802–816) and a shared `onerror` loop (817–823). Depends on IDB request-event ordering inside one transaction. | 741–826 | **NONE** | Med × High | **T3** |
| S4 | **Generation-based last-write-wins `cacheBootstrap`.** Four branches: stale-generation → return existing (699–704); same-session higher-revision → keep existing but re-put with the *new* generation (705–718, note the non-null `existing.bootstrap!` at 715); **different-session higher-revision → return existing *without* writing (719–727)**; else overwrite. The asymmetry between 705 and 719 is the "delayed old-session bootstrap" defence and is only modelled, not implemented, in the memory twin. | 689–739 | Modelled at test `:57-80`, asserted at `:493-530` | Med × High | **T3** on the IDB twin; do not edit `cacheBootstrap` during the split |
| S5 | **Legacy `eventRequests` backfill** (1032–1072, comment "Preserve pending rows created before the request registry was added"). Re-canonicalises the *stored* event with `stableJson` (1044–1050) and compares to `identity.canonicalContent`; mismatch → `OfflineRequestReuseError` (1055). This is the **only** idb→canonical edge, so it's the one place the split can create a bad import. | 962–1098 | **NONE** | Med × High | **T4**; keep `stableJson` in `canonical.ts` and import it — do **not** inline a copy |
| S6 | **`sync()` stream isolation & ordering.** State loop (328–373) `break`s on first failure or conflict; event loop (380–451) re-lists `listEvents` after **every** iteration (447–450) and only batches a *consecutive* active-time prefix, capped at 100 (401–410), and treats a partial ack as `failedStream = "events"` + break (438–441). Reordering these is a live data-loss path. | 303–473 | **Good** — tests `:373, 444, 493, 608, 689` | Low × Critical | Pure code move, **no reformatting**. Assert the 7 tests still pass byte-identically |
| S7 | **Swallowed conflict errors.** `persistAndNotifyConflict` catches *both* `blockState` and the notify callback (480–489) with intentional comments. If the catch scopes change during the move, either the lock stops persisting or a bridge failure starts aborting uploads. | 475–490 | Partially (`:608-687`) | Low × Med | Move verbatim; keep both comments |
| S8 | **`parseStateConflictResponse` duck-typing.** Reads `error.response` if present, else the value itself (511–514). `game-host.tsx:289-304`'s transport returns `readResponseJson(...)` which yields `null` on a non-JSON body (82–88), so an HTTP 500 HTML page → `null` → **not a conflict** → `failedStream = "state"` (370). The 409-conflict detection depends on this. | 508–517 | asserted at `:632-635` | Low × Med | Move with the engine; add to **T5** |
| S9 | Module-scope browser guard kills `build:demo` (see *browser-API hazards*). | new `idb-database.ts` / `canonical.ts` | build gate only | Med × High | Keep guards in function bodies; run `npm run build:demo` per file, not on Day 4 |

### Risk register — §4.3 (game-host split)

| # | Risk | Where it lives | Test today | P × I |
|---|---|---|---|---|
| H1 | **Stale `bootstrapRef` breaks handshake matching.** `bootstrapRef.current` has two writers with different clocks: render-time mirror `:754` and imperative `:221, 229, 820`. Line `:699` decides whether a `game.bootstrap_applied.v1` is accepted. If `bootstrap` state moves to one hook and `bootstrapRef` to another, the ref can lag one render → the game's "applied" ack is dropped → `phase` never reaches `playing`, **and nothing errors.** | 120, 221, 229, 699, 754, 820 | **NONE** | **High** × High |
| H2 | **Message ordering: `sync()` ack fan-out.** `game-host.tsx:317-340` posts state acks **first** (per `request_id` via `replyToRequest`), then `portal.result_ack.v1` one-per-event, then `portal.active_time_ack.v1` chunked by 100. The chunking **must** mirror `game-offline-sync.ts:403`'s 100-event batch cap. Two different files, same magic number, zero cross-reference. | 317–340 ↔ offline 403 | **NONE** | Med × High |
| H3 | **Lost-ack idempotency across reload.** `savedReplies` (`:122, 417, 621, 706-708`) is memory-only. After `handleFrameLoad` (`:817-823`) or a reload, a re-sent `game.save.v1` with the same `request_id` must be caught by the IDB `eventRequests` registry instead. If a split moves `savedReplies` into a hook that remounts more often than today (e.g. keyed on a new dep), the two caches desynchronise and the game gets a duplicate id. | 122, 417, 621, 679–698, 706–713 | Test `:373-442` covers the **store** half only | Med × High |
| H4 | **Token-renewal race.** `validLaunchToken` (`:166-192`) does read-check-write on `launchRef.current` across an `await resolvePlayerEntryAction(credential)` (`:182`) with **no in-flight coalescing**. N concurrent `postWithFreshBearer` calls inside the renewal lead time (`game-host-token.ts:1` = 30 s) each fire their own refresh and the last write wins. A single `sync()` can issue 1 + N + M requests (`:289-304`). Any hook boundary that re-creates the closure or splits `launchRef` makes this strictly worse. | 115–118, 166–213 | `game-host-token.test.ts` covers `hasUsableLaunchToken`/`retryAfterUnauthorized` in isolation; **not** the concurrency | **High** × Med |
| H5 | **Reconnect-after-replay path.** Two triggers: `online` → `reconnectAndSync` (`:781-784, 789`) which reads `synchronizeRef.current` — set only at `:755` during render; and iframe `onLoad` → `handleFrameLoad` (`:817-823`) which resets `bootstrapStarted`/`bootstrap`/`phase` **but not** `syncPromise`, `handledConflicts`, `pendingConflict`, `savedReplies`, `inFlightSaves`. If `synchronizeRef.current` is stale (unmounted-then-remounted) the online event silently no-ops. | 753–757, 781–784, 817–823 | **NONE** | **High** × High |
| H6 | **Conflict recovery round-trip.** `deliverConflict` (`:233-257`) writes `pendingConflict` + `handledConflicts`, mutates `bootstrapRef`, replies with the conflict and sets `phase = "conflict"`. The **only** exit is `game.bootstrap_applied.v1` matching `pendingConflict.current` (`:677`), which then calls `discardConflictedStateBranch` and **re-arms `pendingConflict.current = message.request_id` on failure** (`:690`). `handledConflicts` is a permanent, per-`request_id`, never-cleared dedupe (`:234-235`). Splitting `deliverConflict` (bridge/UI) from `discardConflictedStateBranch` (sync) puts this 3-ref state machine across two files. | 123, 124, 233–257, 677–698 | offline half: test `:608-687`. **host half: NONE** | Med × **Critical** |
| H7 | **iframe origin / sandbox guards.** Trust check is `event.origin === gameOrigin && event.source === frameWindow && frameWindow !== null` (`game-bridge.ts:70-74`) with `gameOrigin` from `expectedGameOrigin` rejecting non-http(s) and embedded credentials (`game-bridge.ts:52-56`). `postToGame` bails if `!target \|\| !gameOrigin` (`:161-162`). The effect gates on `runtimeMode !== "server" \|\| !gameOrigin` (`:760`). If the listener effect moves into `useGameBridge` and the iframe stays in `game-host.tsx`, `frameRef` must be **shared** — a ref passed as a hook argument. If it's recreated inside the hook, `event.source === frameWindow` fails for every message and **the game is dead with no error**. | 114, 139, 155–164, 759–801, 879–889; `game-bridge.ts:48-75` | `player-game-bridge.test.ts:38` (pure predicate only) | Med × **Critical** |
| H8 | **`useEffectEvent` conversion.** The correct fix for the `:753-757` render-time ref writes. Changes *when* `receiveGameMessage` sees fresh state (event-time vs render-time) — a behaviour change, not a move. `next.config.ts:34` sets `reactStrictMode: true`, so effects double-invoke in dev. | 128–129, 753–757 | **NONE** | Med × Med |
| H9 | **Lint/Compiler break.** `npm run lint` = `--max-warnings=0` with `react-hooks/refs`, `purity`, `set-state-in-render`, `immutability` all at severity 2 (verified via `eslint --print-config`). Today exit 0. Refs passed across hook boundaries are the known trigger. | whole file | n/a | Med × Med |

### Coverage reality, stated plainly

`tests/` contains **only `unit/`** (`ls tests` → `unit`). No Playwright, no Cypress, no e2e, **no DOM test
environment at all** (no jsdom/happy-dom installed, `vitest.config.mts:12` is `environment: "node"`).
Therefore **no line of `game-host.tsx`, `demo-game-adapter.tsx` or `player-entry-screen.tsx` is executable by
any automated test today** — not because the logic is bad but because the harness cannot mount a component.
`docs/architecture-audit-2026-09-23.md:781` (R3) says the same from the product side: offline / two-device /
tablet behaviour "never exercised". `docs/architecture-audit-2026-09-23.md:77` confirms no
cross-device/offline/reconnect run has ever happened.

**Consequence for §4.3:** a hooks split does not merely risk regressions — it **moves untested code between
two untestable files.** Coverage after §4.3 as written is exactly 0%, same as before. Whereas the pure
helpers in `game-offline-sync.ts` *can* be node-tested immediately, and the pure presentation blocks of
`game-host.tsx` (288–305, 317–340, 347–367, 825–834) can too if extracted as plain functions. **That is the
split worth doing.**

### Tests to write BEFORE splitting (characterization tests — assert current behaviour, including its warts)

**Prerequisite for T1–T4:** a fake `IDBFactory`. Either add `fake-indexeddb` as a devDependency (new
dependency; §4.2 never mentions it) **or** use the existing unused seam `options.indexedDB`
(`game-offline-sync.ts:495`) with a hand-rolled fake. Given `package.json` churn and the `postinstall`
Prisma hook (`package.json:26`), I recommend the hand-rolled fake for T1–T3 and `fake-indexeddb` as a
follow-up if you want real migration testing.

| ID | Target | Must assert |
|---|---|---|
| **T1** | `openDatabase` schema | `db.objectStoreNames` is **exactly** `["bootstraps","controls","eventQueue","eventRequests","stateQueue"]`; `DATABASE_NAME === "missoes-caramelito-game-v1"`; `DATABASE_VERSION === 3`; `stateQueue` has indexes `byPlayer` + `byPlayerRequest` (unique); `eventQueue` has `byPlayer` + `byPlayerSessionKindRequest` (unique); `eventRequests` keyPath is the 4-tuple. **Freeze test** — fails loudly if a split renames anything. |
| **T2** | `transact` semantics | (a) a `write` whose `run` never calls `succeed`/`fail` rejects with `/completed without a result/`; (b) `fail(err)` propagates the **same `Error` instance**, non-Error coerced to `/IndexedDB transaction failed/`; (c) calling `succeed` twice resolves with the **first** value after `oncomplete`; (d) `succeed` then a later `fail` still **resolves** (settle-guard at 1186–1187); (e) a `run` that throws synchronously rejects (1215–1219); (f) after `fail`, `transaction.abort()` was called. |
| **T3** | IDB twin parity | Run the **existing 7 scenarios** (`tests/unit/game-offline-sync.test.ts:282, 317, 373, 444, 493, 608, 689`) against `openGameOfflineStore({indexedDB: fake})` instead of `MemoryOfflinePersistence`, and assert **identical** reports. Catches S3/S4/S5 divergence. Specifically: `getNextExpectedRevision` == 44 after two queued saves; `expected_revision` sequence `[42,43]`; old-session events stay pending (`:488-490`); `report.state === "blocked"` with `uploadedActiveTimeEvents === 3` (`:649-653`). |
| **T4** | legacy backfill | Seed `eventQueue` with a row and **no** `eventRequests` entry; call `enqueueResult` with the same `request_id`; assert (a) matching content → existing `client_event_id` returned and a registry row written (1057–1071); (b) differing content → `OfflineRequestReuseError` (1055); (c) differing `kind` → `OfflineRequestReuseError` (1052). |
| **T5** | conflict coercion | `parseStateConflictResponse` against: `{response: <conflict>}`; bare `<conflict>`; `null` (from `readResponseJson` on a non-JSON body); a 500 HTML string; a *different* `request_id` (must not be treated as the conflict at 334/347). |
| **T6** | `stableJson` canonicalisation | Key-order independence; `undefined` leaf → `"undefined"` (534); arrays preserve order (536); nested objects sorted (537–540); a fingerprint changes when a nested value changes and **does not** change when keys are reordered. This guards the idempotency key. |
| **T7** | host presentation (pure extraction, then test) | `report.eventAcknowledgements` → the exact sequence and **chunk boundaries** of `postToGame` payloads for 250 active-time acks (i.e. three calls of 100/100/50, mirroring 333–340). Guards H2. |

For `game-host.tsx`, the only *honest* pre-split protection is a **manual scenario checklist run against
`npm run dev` (server target) with DevTools**, because no harness can mount it. Record the baseline before
touching the file:

1. iframe loads → `game.ready.v1` → `phase: playing`, `Progresso v42` in the footer;
2. click "save" twice → `portal.local_durable.v1`, then `portal.save_ok.v1`, footer `Progresso sincronizado`;
3. **DevTools → Offline → save → reload → back online** → the queued save uploads and the ack reaches the
   game (H3, H5, S1);
4. two tabs/devices with the same player, conflicting revisions → `Recuperação necessária` → game applies →
   queue drains (H6, S4);
5. DevTools Network → force a 401 on `/api/v1/player/state` → exactly **one** `/jogar/` re-resolve and a
   successful retry (H4 — watch the Network waterfall for *duplicate* refreshes, which is the current bug);
6. `game.save.v1` with a **reused** `request_id` and a **changed** `state` → `OfflineRequestReuseError` path,
   error alert, no ack (S5);
7. kill the game origin / point `gameClientUrl` at a different origin → **no** message processed (H7);
8. demo target (`npm run dev:demo`) → "Registrar um passo" advances, and **confirm the IndexedDB database
   `missoes-caramelito-game-v1` is never created in demo** (validates the dead-code finding).

---

## step ordering & verification

Ordering principle: **test → leaf modules → composition root → consumers → build gates.** Never move the
engine and the store in the same commit.

### Phase A — offline (§4.2). Budget: 0.5 day for the split, +0.5 day for T1–T6.

0. Confirm baseline: `npx vitest run`, `npm run typecheck`, `npx eslint .` all clean (re-verified today:
   clean).
1. **Write T5, T6** (30 min, pure functions, node-only, no fake needed). Commit. These pass against the
   unsplit file — that is the definition of a characterization test.
2. **Write T1, T2** against a hand-rolled fake `IDBFactory` passed via `openGameOfflineStore({indexedDB})`
   (the seam at `:495`). Commit. **Gate: T1/T2 green on the unsplit 1,222-line file.** If they can't be
   written green, the fake is wrong — fix the fake, not the source.
3. **Create `src/runtime/offline/` with `types.ts` + `errors.ts` + `canonical.ts` only.** Cut/paste, no
   edits. `game-offline-sync.ts` becomes a 1,170-line file that imports them. **Gate:** `npm run typecheck &&
   npx vitest run && npm run build:demo` — the build matters here, because this is the first commit where a
   new module is evaluated during prerender.
4. **Extract `idb-database.ts`** (consts + `openDatabase` + `read`/`write`/`transact` as free functions).
   Convert `this.transact(...)` → `transact(this.db, ...)` mechanically, one method per hunk.
   **Gate:** `npx vitest run` (T2 must stay green) **and T3 on the IDB twin**. *This is the highest-risk
   commit (S2). Do not merge it without T3 green.*
5. **Extract `idb-event-queue.ts`** (962–1098). **Gate:** T4 green.
6. What remains of the class is `idb-store.ts` (~373). **Gate:** T3 green, `npm run build:demo`,
   `npm run build:server`.
7. **Extract `sync-engine.ts`** (170–491 + 493–506 + 508–517). Pure move. **Gate:** the existing 7 tests,
   repointed.
8. **Add `offline/index.ts`** and repoint the **only two** importers: `game-host.tsx:26-31` (4 names) and
   `tests/unit/game-offline-sync.test.ts:6-16` (9 names). Delete `game-offline-sync.ts`.
   **Gate:** `npm run check` (`package.json:24` = format:check + lint + typecheck + test).
9. `wc -l src/runtime/offline/*.ts` → assert max **≤ 500** (ideally ≤ 400). If it isn't, stop and re-cut;
   don't ship a carve-out.

### Phase B — game-host (§4.3). Budget: 0.5 day for the *safe* subset; do **not** attempt the two-hook split.

1. **Freeze baseline**: record the 8-step manual checklist output. There is no automated safety net (see
   *coverage reality*); this record *is* the safety net.
2. **Fix §4.3 item 3 properly** (option (b)): `demo-game-adapter.tsx:16-20` → build `demoGameReady` via
   `gameReadyV1Schema` with `PROTOCOL_VERSION`/`STATE_SCHEMA_VERSION`. 4 lines, real defect, removes a
   future silent-stale-handshake. Verify: `npx vitest run tests/unit/player-game-bridge.test.ts` + the
   `dev:demo` smoke.
3. **Extract pure helpers** → `game-host-model.ts` (`:48-58` types, `:60-101` four functions, `:825-834`
   `phaseCopy`). Mechanical, 53 lines out. Verify: `npm run typecheck && npx eslint .`.
4. **Extract `GameHostChrome`** (`:837-931`, 95 lines JSX). Props in, children out; `frameRef` stays in the
   parent and is passed to the iframe slot as `children`
   (React 19 allows a plain `ref` prop — `react` 19.2.8 verified). Verify: `npm run lint` (**this is the
   first commit where `react-hooks/*` severity-2 rules can bite** — run it after every subsequent step too),
   then the dev smoke.
5. **Extract `game-sync-presenter.ts`** as *pure functions*: `buildTransport(deps)` (`:288-305`),
   `acksToGameMessages(report)` (`:317-340`), `statusFromReport(report, after)` (`:347-367`). **Write T7
   against `acksToGameMessages` before wiring it in** — that turns H2 (the duplicated 100-chunk constant
   between `game-host.tsx:333` and `game-offline-sync.ts:403`) from an unwritten invariant into a tested one.
   Net: `game-host.tsx` ≈ **660–680**, and +1 genuinely tested module.
6. **Stop there.** Steps 3–5 take `game-host.tsx` from 932 → ~670 with zero shared-state surgery and add the
   first *real* test coverage the file has ever had. **Do not** attempt `useGameBridge`/`useGameSync` in this
   sprint: see H1/H4/H5/H6/H7 and the 15/19 shared-slot count.
7. **Instead, log the correct follow-up** as its own ticket with the honest precondition: "Split `game-host`
   into bridge/sync hooks **after** a DOM test environment exists (`jsdom` or `happy-dom` + a component
   testing lib) and after H4 (token-renewal coalescing) and H5 (`handleFrameLoad` clearing
   `syncPromise`/`handledConflicts`/`pendingConflict`) are fixed as behaviour changes with tests." Also
   propose the `useEffectEvent` conversion of `:128-129, 753-757` as the *smaller* fix for the actual
   fragility, noting it is a behaviour change (H8).

### Verification commands, in order (all read-only or build-only)

```bash
npx vitest run                                    # after every commit
npm run typecheck                                 # after every commit
npx eslint . --max-warnings=0                     # after EVERY game-host commit (react-hooks severity 2)
npm run build:demo   # static export; catches any module-scope browser access (S9)
npm run build:server # catches any accidental server-only boundary violation
node scripts/next-target.mjs build demo && grep -r missoes-caramelito-game-v1 out/  # watch this DISAPPEAR if you gate the import by runtimeMode
wc -l src/runtime/offline/*.ts src/components/public/game-host*.ts*                  # the §7.1 ratchet, measured not asserted
```

`npm run build:server` needs the env asserted at `next.config.ts:10-19`
(`DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` ≥32, `APPLICATION_SECRET` ≥32) and
`AUTH_DEV_BYPASS=false`, which `scripts/next-target.mjs` pins for you.

---

## cost/benefit under a 3–4 day sprint — recommendation

**§4.2 (offline): DO IT, but as 7 files, not 4 — after writing T1–T6.** Numbers:
- 1,222 → 7 files, max **373** (`idb-store.ts`), vs the plan's max **657**.
- 2 consumers, 11 names, 14 cross-module edges, **0 private-symbol test coupling**, **0 module-init side
  effects**, **0 config changes**.
- **7 tests at risk, 19 lines of edits** (`game-offline-sync.test.ts:6-16` + `game-host.tsx:26-31`).
- Real cost is **not** the move (0.5 day); it is the 665 untested storage lines (0.5 day for T1–T4, which
  needs a fake `IDBFactory`). **Splitting without T1–T2 is a coin flip on S1/S2** — the two risks that
  silently delete a child's queued progress.

**§4.3 (game-host): PARTIALLY — do steps 2–5, refuse step 1.** Numbers:
- Safe subset: 932 → ~670, 3 new small tested/pure modules, **0 shared-state surgery**, ~half a day.
- The plan's shape: 932 → optimistic 250, realistic ~580 with **15/19 mutable slots crossing the boundary**,
  6 functions needing cross-hook calls, 4–6 new render-time ref trampolines, **0% test coverage after as
  well as before**, and a plausible `--max-warnings=0` lint break. **Negative expected value.**
- §4.3 item 3 is worth **exactly 0 lines** (REFUTED above). Replace with the `demo-game-adapter.tsx:16-20`
  schema fix (4 lines) and the mode-boundary bundle item.

**Is the §7.1 ratchet better served mechanically? For Day 3, mostly yes — because the plan's own arithmetic
doesn't close.** After §4.2 as written the 1,222 offender becomes a 657 offender that **still fails**; after
§4.3 as written a 932 offender becomes three files of which the parent is ~580 and **still fails**. So the
planned work buys **zero** additional §7.1 passes on these two files. Two corrections make it worth doing:
1. `game-offline-sync.test.ts` at 728 **already passes** the real test ceiling (400 warn / 800 fail) — the
   plan is right to not split it, and the reviews claiming it "violates §7.1"
   (`RV-B:240`, `00-SYNTHESIS:64`) are **wrong against `REFACTOR_PLAN.md` §7.1**. Drop that work item.
2. The ratchet text is "All new or modified files" — so the cheapest compliant win is that **a split that
   produces a still-failing file is a wash; a split that produces only passing files is a win.** My
   recommended 7-file offline cut achieves that. The game-host cut does not, at any reasonable cost.

**Suggested Day-3 ordering** (both gates cheap and early):
1. `demo-game-adapter.tsx:16-20` schema fix (10 min, real defect) →
2. offline `types`/`errors`/`canonical` + T5/T6 (1.5 h) →
3. `idb-database`/`idb-event-queue` + T1–T4 (**half day; the only genuinely risky work**) →
4. `sync-engine` + repoint consumers (1 h) →
5. game-host pure helpers + `GameHostChrome` + presenter + T7 (2 h) →
6. **stop**; open the hooks ticket.

That is ~1 day and it converts **one 1,222-line untestable god-file into seven audited files all inside the
budget, with 54% of it newly covered by tests** — plus ~260 lines off `game-host.tsx` and the first real
defect fix in the cohort. The remaining 670-line `game-host.tsx` should be an explicit, documented ratchet
exception with a written precondition, **not** a rushed two-hook split the last afternoon of a sprint.

---

## open questions

1. **Is a `src/runtime/offline/` folder acceptable**, when `src/runtime/` is 16 flat files whose convention
   is *`-demo`/`-server` twin pairs resolved by the 9 aliases in `next.config.ts:43-82`* — and
   `game-offline-sync.ts` is the **only** client-browser module there with **no twin**? A flat
   `offline-*.ts` prefix needs no barrel and no new convention. Which does the team want to be the rule?
2. **Do we add `fake-indexeddb` (new devDependency) or hand-roll a fake `IDBFactory`** for T1–T4, using the
   existing-but-never-passed `options.indexedDB` seam (`game-offline-sync.ts:495`)? A new dep has to clear
   `postinstall: prisma generate` (`package.json:26`) in CI. If we hand-roll, T1 is a *name-freeze* test
   only and **the real migration path stays untested** — which is S1, unmitigated.
3. **`DATABASE_VERSION` policy.** `onupgradeneeded` (568–603) is additive-only, has **no `oldVersion`
   branch**, and `onversionchange` merely closes (618) while `onblocked` rejects (609–615). Is a *breaking*
   schema change ever permitted, and if so what happens to a child's queued `stateQueue` rows? §4.2 is
   silent. CRITIQUE:111 raised this; it is still unanswered. Needs one paragraph, ideally in
   `idb-database.ts`'s header.
4. **Should the demo bundle keep 1,222 lines of unreachable IndexedDB code?** (Finding (a) under
   *duplicate-handshake*; evidence in `out/_next/static/chunks/0pvtinj9q2oay.js`.) If "no", that's a
   dynamic-import boundary keyed on `runtimeMode` — a *behaviour* change (loading states, error surfaces)
   with **no** test coverage on either side. If "yes", say so in §4.2 so the next reviewer stops counting it
   as free.
5. **Do we accept `game-host.tsx` at ~670 lines as a ratchet exception?** Its §7.1 ceiling is 400 (component
   fail) and reaching it requires the 15-shared-slot surgery that H1/H4/H5/H6/H7 say needs a DOM test
   environment first. Or: **do we buy a DOM test environment now** (`jsdom`/`happy-dom` are not installed;
   `vitest.config.mts:12` is `environment: "node"`), which un-blocks *all* component work — not just this
   split — and is arguably the highest-leverage half-day in the sprint?
6. **`launchRef` renewal coalescing (H4) — bug or accepted?** `game-host.tsx:166-192` fires a refresh per
   concurrent caller with no in-flight dedupe, and one `sync()` issues 1+N+M requests. Nobody has counted
   real refreshes on a flaky connection. Manual checklist item 5 answers it in 10 minutes. Fix it as a
   behaviour change **before** the split moves it, or leave a `// known: N concurrent refreshers` comment —
   but don't split it silently into a new file.
7. **`handleFrameLoad` (`:817-823`) resets 5 slots but leaves `syncPromise`, `syncRequested`,
   `handledConflicts`, `pendingConflict`, `savedReplies`, `inFlightSaves` populated.** Is that intended
   (a game reload should keep the in-flight sync and the dedupe memory) or is it a leak? It determines
   whether H3/H5 are "risks of the split" or "pre-existing behaviour the split must preserve". No test and
   no comment says which. **Needs an author answer.**
8. **Should `openGameOfflineStore` (493–506) live in `sync-engine.ts`, or in its own
   `offline/index.ts` composition root?** The plan §4.2 doesn't say (this is the unallocated 14 + 10 lines).
   A separate root is what keeps `idb-store.ts`'s `DATABASE_VERSION` out of reach of `game-host.tsx`.
9. **Do we delete the 6 externally-dead exports** (`GameOfflineSyncStatus` 71, `GameOfflineSyncReport` 78,
   `EventRequestReceipt` 61, `OfflineStateBlockedError` 138, `OfflineBootstrapMissingError` 147) and the
   unused `options.indexedDB` seam (495, once T1–T4 use it)? Recommendation: **no** — narrow the public
   surface in its own commit with its own review, not under a "split" label.
10. **Should the `savedReplies` (host) ↔ `eventRequests` (store) two-level idempotency be documented as an
    invariant** (option (c) under *duplicate-handshake*), and should the two `100` constants
    (`game-host.tsx:333`, `game-offline-sync.ts:403`) be a shared `contracts/v1` export? Currently two files,
    one magic number, zero cross-reference, zero tests.
