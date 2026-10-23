# VER-D — Refutation pass on `INV-D-runtime-godfiles.md`

Verifier: VER-D. Baseline: `HEAD = e5aaf1e`, working tree clean except untracked
`docs/refactor-dossier/` (matches the report's own baseline claim). Read-only: nothing under
`src/`, `tests/`, `out/`, or `REFACTOR_PLAN.md` was modified. No builds or installs were run;
methods used: full reads of `src/runtime/game-offline-sync.ts` (1,222), `src/components/public/game-host.tsx`
(932), `tests/unit/game-offline-sync.test.ts` (728), `demo-game-adapter.tsx` (112), `game-bridge.ts` (84),
`package.json`, `vitest.config.mts`, `REFACTOR_PLAN.md` §4.2/§4.3/§7.1, the `docs/agent-reviews/refactor-plan-v2/`
corpus, plus independent `grep`/`wc`/`awk`/`sed` recounts, one `grep` over `out/`, a `node -e` globals
probe, and one `npx eslint` + one `eslint --print-config` on `game-host.tsx` (both read-only).
Every report citation was opened at the line before being accepted.

**Bottom line: the report survives its two highest-stakes claims.** The 665-line/54% untested-storage
figure reproduces exactly under an independent recount; the "refuse the game-host hooks split"
recommendation is upheld (I looked for the clean cut and it does not exist). What does NOT survive:
two of its own proposed characterization tests (T2c/T2d) assert semantics the code does not have,
the S1 "rename doesn't error" phrasing is wrong for the rename-only case, the "prior reviews are
incorrect" verdict on the test-ratchet is itself overstated, and roughly a dozen small counts are
off (none load-bearing). Verdict table first, corrections with methods second.

---

## Verdict table

| # | Claim in INV-D | Verdict | My independent evidence | What changes if wrong |
|---|---|---|---|---|
| 1a | "665 lines (54%) of the storage layer have zero test coverage" | **CONFIRMED** | My recount (§Correction C1) reproduces 665 exactly by a different decomposition; nothing in `tests/` references `indexedDB`/`IDBFactory` (grep → 0 hits); the one offline test file imports only 9 public names and constructs `MemoryOfflinePersistence` (`game-offline-sync.test.ts:35`) — never `openGameOfflineStore` (grep: sole call `game-host.tsx:216`, no args) | Precondition "characterization tests before §4.2" stands |
| 1b | "`fake-indexeddb` is not a dependency; no jsdom/happy-dom/@testing-library" | **CONFIRMED** | `package.json` deps 28–41 / devDeps 42–54 clean; `grep -c fake-indexeddb package-lock.json` = **0**; jsdom/happy-dom appear only as 2 unfilled peer entries; `node_modules/{fake-indexeddb,jsdom,happy-dom}` all absent; `vitest.config.mts:12` `environment:"node"` | Stands; a fake-IDB is genuinely net-new |
| 1c | "test implements the port in memory at `:35-279`" | **CONFIRMED (±1 line)** | Class spans 35–279 inclusive = **245** lines (report said 244); 7 constructors at 284/320/376/446/496/611/691 ✓; 7 `it()` in 1 `describe` at :281 ✓ | Nothing |
| 2a | S1: store rename/version bump "does not error — silently creates an empty store and orphans rows" | **OVERSTATED** | Silent-orphan requires the **version-bump** combo: `open(NAME, 3)` on an existing v3 DB never fires `onupgradeneeded` (568–603, all `if(!contains)` guards, `oldVersion` appears **nowhere** in the file — grep exit 1), so a rename *without* a bump makes `db.transaction(["newName"])` at 1182 throw `NotFoundError` → rejects loudly through `transact`. With a bump, the claim is exactly right (new empty store, old rows stranded, no error) | Mitigation (T1 freeze + single-file `DATABASE_VERSION`) is still the correct response; the *risk framing* shifts from "always silent" to "silent only when the version moves" — which also means a pure code move that renames nothing is safer than stated |
| 2b | S2: resolve happens only at `oncomplete`; eager-resolve → phantom "saved" | **CONFIRMED** | `succeed` only records (1200–1203); resolve at `transaction.oncomplete` (1204–1210); `/completed without a result/` at 1207–1208; `fail` sets settled + `abort()` in try/catch (1186–1193). Resolving at `request.onsuccess` would indeed ack before commit (IDB commits after the task queue drains) | The pre-split-test precondition stands — **but see T2c/T2d below: the report's own test spec for this path is wrong** |
| 2c | T2 spec: "(c) calling `succeed` twice resolves with the **first** value; (d) `succeed` then a later `fail` still **resolves**" | **WRONG** | 1200–1203 has no first-write guard: `value = result` unconditionally → twice-succeed is **last-wins**. `settled` is set only by `fail`/`oncomplete`/`onabort`, so a `fail` after `succeed` but before `oncomplete` **aborts and rejects** (fail wins pre-commit). Asserting (c)/(d) as characterization would fail against current code | T2 must be rewritten before it gates anything; the S2 *risk* is unaffected |
| 3a | 15 regions + 14 blanks = exactly 1,222 | **CONFIRMED arithmetically, label WRONG** | My sum of the report's own 23 table spans = 1,200 decl-lines + 22 inter-region blanks = **1,222 exactly** (§C2); "15 regions / 14 blanks" does not match the report's own table (23 rows). File has 62 blank lines total (`grep -c '^$'`) | Nothing material — the inventory is exhaustive, that is the point |
| 3b | `GameOfflineStore` 322 (170–491); `IndexedDbGameOfflinePersistence` 576 (647–1222); `openDatabase` 64; `sync()` 171; `enqueueState` 86; primitives 77 | **CONFIRMED** | All spans verified by reading: 491−170+1=322, 1222−647+1=576, 627−564+1=64, 473−303+1=171, 826−741+1=86, 1221−1145+1=77; the IDB class sub-partition is exact (569 + 647 + 1222 + 5 blanks = 576) | Split budget table stands |
| 3c | Plan `idb-store.ts` ≈657 > §7.1's 500 module ceiling | **CONFIRMED** | 64+17+576 = **657**; plan §4.2 item 2 literally says "~650" (`REFACTOR_PLAN.md:165`); §7.1 "Modules & Services: 300 warn / **500 fail**" (`REFACTOR_PLAN.md:248`) and v2.1 contains **no carve-out sentence** (grep `idb-store` in plan → only :165/:230) | The "must re-cut or formally except" decision stands |
| 3d | "a 7-file cut caps the largest file at 373" | **CONFIRMED (arithmetic)** | 629–645+648–653+654–739+741–826+828–960+1100–1143 = 17+6+86+86+133+44 = **372** + class scaffold ≈373; next-largest proposed target 365; all ≤ 500 | Recommended split stands |
| 3e | `request-registry.ts` misnamed; real registry is the `eventRequests` IDB store | **CONFIRMED** | `EVENT_REQUEST_STORE` consts :28, created :595–599, touched only inside `enqueueEvent` :1009–1096 (grep: no other use); the plan's item 3 contents (`eventRequestIdentity`, `stableJson`) are pure hash helpers; plan text itself claims the item holds the "idempotent retry registry" (`REFACTOR_PLAN.md:166`) | Rename to `canonical.ts`/`fingerprint.ts` is warranted |
| 3f | Zero module-level mutable state | **CONFIRMED** | Full read: top level is only `const` string/number literals (23–29), type aliases, `class`/`function` declarations; lazy singleton lives in `game-host.tsx:125` | Split safety stands |
| 3g | "exactly 2 importers, 11 of 16 exports consumed" | **CONFIRMED** | `grep -rn 'game-offline-sync' src tests scripts` → exactly 2 import statements (`game-host.tsx:31`, test `:16`); `grep -c '^export '` = **16**; union of the two import blocks = **11 distinct names**; the 5 named dead exports (61/71/78/138/147) appear nowhere outside the module; `OfflineSessionMismatchError` is the only error class caught externally (4 catch blocks, 5 `instanceof` sites) | "Cheapest god-file split in the repo" stands |
| 3h | "14 cross-module edges, 0 private-symbol test coupling"; registry↔store cycle refuted | **EDGES UNSURE; rest CONFIRMED** | Private-symbol claim reproduces (test imports only the 9 public names). Cycle refutation reproduces: `identity: EventRequestIdentity` is a **parameter** on the port (`:126`, `:132`), engine computes it at 246/281, and the only idb-side use of `stableJson` is one acyclic call at **1044** inside the legacy block — canonical is a leaf. "14" is not reproducible under any method I tried (§C3): reference-site count = 7 (engine→identity 2, →createId 1, →parseConflict 2 [same-file post-split], idb→sameJson 1, →stableJson 1) + 7 idb error-throw sites = 14 only if you keep the 2 intra-engine parse sites and drop all 8 engine error imports; distinct-import count = 13 | Decision ("acyclic, errors must be their own leaf") is unaffected; the number should not be quoted |
| 4a | 13 refs + 6 states = 19 mutable slots; 2 effects; 6 listeners; 0 memo/callback/reducer/effectEvent | **CONFIRMED** | `useRef(` sites 114,115,119–129 = 13; `useState` sites 130–137 = 6; `useEffect` 759–801, 803–815 = 2; listeners at 786–791 (5 window + 1 document) = 6; `grep -c "useMemo|useCallback|useReducer|useEffectEvent"` = **0** | Inventory stands |
| 4b | "15 of 19 slots cross the bridge/sync boundary" | **OVERSTATED (conclusion survives)** | Their own table marks only **7** slots "both" (bootstrapRef, savedReplies, pendingConflict, phase, alert, bootstrap, syncState); `inFlightSaves` is dispatcher-only, `lastHostMessage` bridge/demo-only, and the 2 trampolines (128/129) *are* the boundary, not crossings. Honest number ≈ **11–13** shared slots + 2 trampolines. I attempted the clean cut: `savedReplies` is written by `replyToRequest` (1620-621, bridge) AND `queueResultOrActiveTime` (417, sync); `deliverConflict` (233–257) writes 2 sync refs + `bootstrapRef` + 3 UI setters + calls bridge `replyToRequest`; the dispatcher (625–751) must be shared; `bootstrapRef` is written at render (754) and read for accept/drop at 699. **There is no cut that leaves ≤4 single-owner slots on each side.** | The refusal recommendation stands even at 11/19 |
| 4c | "`synchronizeQueue` would need 19 external bindings" | **PLAUSIBLE, count method-dependent** | My enumeration of identifiers in 259–390 defined outside it: 8 functions (getOfflineStore, postWithFreshBearer, readResponseJson, deliverConflict, replyToRequest, postToGame, updateCurrentBootstrap, itself), 5 mutable slots (syncPromise, syncRequested, queuedCount, syncState, alert), 3 contextual (runtimeMode, entry, navigator), 2 zod schemas, 1 error class, 3 types = 16 runtime / 21 with types. Note "4 setters" in the same bullet is wrong — synchronizeQueue touches **3** setters (274/352, 277/353, 279/360/366/371); phase changes only via `deliverConflict` | Nothing decision-relevant |
| 4d | render-time ref writes at 753–757 are a load-bearing workaround | **CONFIRMED** | 753 `receiveRef.current = receiveGameMessage`, 754 `bootstrapRef.current = bootstrap`, 755–757 `synchronizeRef.current = …`; effect deps deliberately `[gameOrigin, runtimeMode]` (801); reader 699 decides `bootstrap_applied` acceptance; effect's `reconnectAndSync` (781–784) reads 783 | Stands |
| 4e | honest floor ≈670, "250 not achievable without redesign" | **CONFIRMED (judgment)** | 932 − 53 (48–101) − 95 (837–931 chrome) − ~62 (transport 288–305, ack fan-out 317–340, status 347–367) ≈ **722**, minus headers/props/context realistically ~670; the residual is the dispatcher + 11–13 shared slots. Chrome extraction also needs ≥10 props (the 8 listed omit `lastHostMessage` and either `onMessage`/`onFrameLoad` handlers or the entire 870–901 ternary as children) | "Ratchet exception with written precondition" stands |
| 4f | "no DOM test env → post-split coverage stays 0%" | **CONFIRMED, actually understated** | `tests/` contains only `unit/`; node-only env; and `vitest.config.mts:16` `include: ["tests/**/*.test.ts"]` wouldn't even *discover* a `.test.tsx`; and `game-host.tsx:24` imports `@runtime/player-entry-action`, which `vitest.config.mts:8` does not alias — so game-host is unimportable by vitest today for **three** independent reasons | Strengthens the report's Q5 |
| 5 | "dead in demo, shipped to GitHub Pages; chunk `0pvtinj9q2oay.js`" | **CONFIRMED exactly** | Gates read and verified: `:156` (postToGame demo path), `:260` (`runtimeMode !== "server"` return), `:500`, `:715`, `:731`; `deliverConflict` called only at 311/315 (grep); `getOfflineStore` sites 268/399/455/592/679 all behind those gates; `out/jogar/index.html` exists and **references `0pvtinj9q2oay.js` by name** (2 hits); that 46,032-byte chunk contains `missoes-caramelito-game-v1`, `byPlayerSessionKindRequest`, `onupgradeneeded`, and the host's `Não foi possível abrir o armazenamento…` string; the DB-name string is unambiguous (the other demo store uses `missoes-caramelito:adult-portal:v2`) | The mode-boundary bundle-gate item (a) stands |
| 6 | §4.3 item 3 REFUTED (no duplicate handshake with the adapter) | **CONFIRMED** | `grep "postMessage|addEventListener"` over `src/components/public/*` excluding `game-host.tsx`: **zero** hits in the adapter (the only folder-wide `postMessage` sites are `game-host.tsx:163` and `:778`; `addEventListener` appears only at 786–791); adapter talks via prop `onMessage` (:69) + `lastHostMessage` (:52–53); `createBridgeRequestId` defined `game-bridge.ts:77` with `typeof crypto !== "undefined"` guard at :78, imported `game-host.tsx:34` + `demo-game-adapter.tsx:11`, used at game-host:72, 459 and adapter:65 — all exact | §4.3 item 3 replacement stands |
| 6b | Attribution: finding is RV-E's/CRITIQUE's, not VV-C's | **CONFIRMED** | `grep "duplicate handshake"`: `RV-E-godfiles-css.md:133` + `:228`, `CRITIQUE.md:132`, `00-SYNTHESIS.md:98`, `VV-E:188/200/270`; **zero** hits in `VV-C-action-seam-verification.md`. One gap: the report cites the *originators* but not the *adjudicator* — `VV-E` already upheld it ("UPHELD outright"), so 00-SYNTHESIS:98's "survived verification" refers to VV-E | Nothing; citation hygiene only |
| 7 | 4-line protocol-version defect; no test pins it | **CONFIRMED as defect; OVERSTATED as "silent"** | `demo-game-adapter.tsx:16-20` `as const` with `[1]`/`[1]`; host validates at `:642` (`PROTOCOL_VERSION`) and `:657` (`STATE_SCHEMA_VERSION`); `schemas.ts:4-5` both `1 as const`; `parseGameReadyV1` exists (`parse.ts:42`, schema `schemas.ts:115`); no test imports the adapter (impossible under node-env anyway; `player-game-bridge.test.ts` `[1]` hits are unrelated parse fixtures). BUT on a version bump the demo would **fail loudly** (adapter's ready rejected → `phase: "error"` + alert at 644–654), not "silently test a stale handshake". And the report missed a *second* hardcode of its own kind: `game-host.tsx:652` `"The portal requires protocol version 1."` while the sibling at :668 interpolates the constant | Fix still belongs in Phase B step 2; severity wording should say "breaks the demo on bump" not "silently stale" |
| 8a | "RV-B:240 / 00-SYNTHESIS:64 are **incorrect** — 728 < 800" | **OVERSTATED** | §7.1 has four two-level budgets incl. "Test suites: 400 warn / 800 fail" (`REFACTOR_PLAN.md:250`) and ratchets "**all new or modified files**" — no exclusions exist in v2.1 text. A 728-line test does violate the **400 warn** budget; RV-B's unqualified "violates §7.1" and SYNTHESIS's "9 **unbudgeted** files" are defensible as written (unbudgeted ≠ failing). INV-D's own recommended plan *modifies* the test's import block (step A8), which puts it inside the ratchet's scope at warn level | The practical conclusion ("splitting the test is not a fail-gate; deprioritize") still holds; the "reviews are wrong" verdict should be downgraded to "WARN, not FAIL — the earlier wording conflated levels" |
| 8b | Baseline: 5 suites, 19/19 pass; eslint exit 0 | **CONFIRMED (counts; eslint reproduced live)** | it-counts: offline-sync 7, player-game-bridge 4, game-host-token 2, game-client 3, runtime-mode 3 (2 via `it.each` + 1) = **19**; I did not rerun vitest (out of read-only brief), but nothing in the suites can touch IDB (§1). `npx eslint src/components/public/game-host.tsx` → **EXIT=0**, reproduced. `--print-config` → `react-hooks/refs/purity/set-state-in-render/immutability` all **[2]**, `exhaustive-deps` [1] — the report's lint-hazard premise is exactly right, and note the current render-time writes at 753–757 pass severity-2 `refs` today, so H9's "plausible lint break" is honestly hedged | Stands |
| 9 | "`sync()` reads `this.persistence` 12 times" | **WRONG (minor)** | `awk 'NR>=303&&NR<=473' | grep -c this.persistence` = **9** (309, 325, 328, 366, 376, 393, 429, 447, 453); 10 with `persistAndNotifyConflict`; 25 file-wide | Only the rhetorical "most behavior-dense method" point; the *not-now* verdict on the 8th cut is unaffected |
| 10 | Misc small-citation audit (opened every line I relied on) | see §C4 | Several off-by-one/mislisted citations in the game-host slot table; `GameOfflinePersistence` "13 methods" is 15; "22 functions" is 25 | Nothing flips; trust-but-verify on line refs in §4 tables should carry forward |

---

## Corrections

**C1 — untested-storage recount (method: region subtraction from exported-symbol reachability).**
Reachable from `tests/unit/game-offline-sync.test.ts` (imports 9 public names, always injects
`MemoryOfflinePersistence` + a fake event-id fn): import block 1–21, engine 170–491,
`parseStateConflictResponse` 508–517, `stableJson` 532–541 + `eventRequestIdentity` 543–562
(via engine 246/281 → `crypto.subtle`, which Node 22 has — probe: `node v22.23.1 indexedDB:
undefined subtle: object randomUUID: function`, matching the report's probe exactly).
Unreachable: 493–506 (14) + 519–526 (8) + 528–530 (3) + 564–627 (64) + 647–1222 (576) = **665**.
665/1222 = 54.4%. Same result by disjoint decomposition, so the number is not method-fragile.
Two honesty caveats neither corpus states: (a) 31–136 and 629–645 are type-only — "covered" is a
category, not an execution; (b) ~15–20% of the 576 "untested" class lines are blank/comment/brace
lines, so *statement*-level untested is ~570–590. The report's headline survives both caveats.

**C2 — region arithmetic (method: sum of the report's own 23 table spans).**
Spans total 1,200 non-blank; inter-region separators = 22 single blank lines (at 22,30,38,48,58,60,65,70,77,92,98,137,169,492,507,518,527,531,542,563,628,646); 1,200+22 = 1,222 ✓. Correct label: "23 declaration regions + 22 blanks" (or 14 merged regions + 13 blanks — that also sums to 1,222). "15 + 14" is neither.

**C3 — "14 cross-module edges" is not reproducible** (see 3h). My distinct-import count under the
recommended 7-file layout: `idb-store→errors` (4 classes), `idb-event-queue→errors` (1),
`sync-engine→errors` (3), `idb-store→canonical` (1), `idb-event-queue→canonical` (1),
`sync-engine→canonical` (2: identity + createId) = **12**. Use 12, or state the method.

**C4 — citation nits (all opened, all listed, none load-bearing).**
MemoryOfflinePersistence `:35-279` = 245 lines not 244. Port = **15** methods (14 + optional `close`), not 13. game-host functions = **25** (4 module + 21 in-component), not 22. Import block = 10 parse-fns/schemas + 9 types, not 12+8. `OfflineSessionMismatchError` is checked at **5 instanceof sites in 4 catch blocks** (369, 430, 432, 511, 613); the report's "7 sites (…487…)" includes a *throw* at 487. `phase` writers list includes 650 (`showProtocolError` call) and 732 (`setAlert` call) which are not `setPhase` sites — actual count **17**, not 19. `setAlert` = 24 sites, not 25. "`from` clauses: 7" — the test import is **1** statement (3 clauses if split by target module). `REFACTOR_PLAN.md` cites are off: item 3 is at **:175** (not :171), "~250 lines" at **:176**, "already exists" at **:171** (not :169). `registry ~50` — span 519–562 is 44. Slot-table nits: `bootstrap` render-read is 873 not 872; `lastHostMessage` read is 875 not 874.

**C5 — T2 test-spec fix (the expensive one).** Correct current semantics of `transact`
(1181–1220): (1) repeated `succeed` → **last** value wins (1200–1203 overwrite unconditionally);
(2) `fail` after `succeed` but before `oncomplete` → **aborts and rejects** (guard at 1186–1188
only blocks a *second* settle, not fail-after-record); (3) `oncomplete` without any `succeed` →
reject `/completed without a result/`; (4) first settle wins — post-`fail` `oncomplete` is a
no-op via 1205. T2 as written would be born red on the unsplit file, which per the report's own
gate ("T1/T2 green on the unsplit file — if they can't be, fix the fake") would send the
implementer chasing a nonexistent fake bug.

---

## Things the report missed

1. **`game-host.tsx:652`** — `"The portal requires protocol version 1."` is the *second* hardcoded
   version string (the sibling message at :668 interpolates `${STATE_SCHEMA_VERSION}`). The 4-line
   fix should be a 5-line fix, and it is the best proof that the §4.3 item 3(b) defect is a
   maintenance-habit, not a one-off.
2. **Vitest can't even see component tests twice over** — beyond "no DOM env": `vitest.config.mts:16`
   `include: ["tests/**/*.test.ts"]` excludes `.tsx`, and `game-host.tsx:24` imports the
   `@runtime/player-entry-action` alias which `vitest.config.mts:8` does not register. Buying
   `happy-dom` alone leaves the file untestable. Q5's "highest-leverage half-day" needs 3 changes,
   not 1 — worth knowing before scheduling it.
3. **Nobody ever closes the IDB connection.** `store.close()` (176–178) and the port's `close?()`
   (100) have **zero call sites** in `src/` (grep). The lazy singleton at 125 lives for the tab.
   For the split this is a real behavioral fact to freeze: any new `index.ts` composition root must
   not start calling `close()` on unmount "as cleanup" — `db.onversionchange = () => db.close()`
   (618) is the only legitimate closer.
4. **`public.module.css` (1,017 lines) is welded to the chrome extraction.** `game-host.tsx:46`
   imports 13 distinct `styles.*` names used in 837–931; `GameHostChrome` must carry that import,
   which entangles §4.3 step B4 with §4.1's CSS purge (same file, same sprint). INV-D's own
   §7.1-ratchet arguments mention `public.module.css` in passing but never say the two proposed
   extractions edit the same CSS file.
5. **Hand-rolling an `IDBFactory` fake for T3 is the wrong default the report argues for.** T3
   requires multi-entry index keys (`byPlayerSessionKindRequest`, 589–593), `autoIncrement`,
   unique-constraint `add` failures, and — the whole ballgame — *request-event ordering inside one
   transaction* (the 760–823 fan-in latch depends on it). That is re-implementing IndexedDB
   event semantics in miniature; `fake-indexeddb` exists precisely for it and its
   `package.json` churn is one devDep line (the `postinstall: prisma generate` argument applies to
   every dep, new or old). T1/T2/T5/T6 need no fake at all (stub factory for T1's name freeze).
   I'd invert the report's recommendation: `fake-indexeddb` for T3/T4, hand-stub only for T1/T2.
6. **The old "second real duplication" claim (REFACTOR_PLAN-review:137 M7) deserves explicit
   adjudication** rather than silence: M7 called the adapter's `game.ready`/`bootstrap_applied`
   construction "the actual duplication". Correct reading (mine, agreeing with INV-D): it is the
   *opposite endpoint* of one protocol — adapter's `appliedRequests` (demo-adapter:33,43–45) and
   host's `savedReplies` cache different events; collapsing them deletes the simulation. INV-D is
   right, but since it was busy correcting other people's citations, it should have corrected
   this one too.
7. **`openGameOfflineStore`'s error string is user-visible pt-BR copy** (500 → 375). Moving it in
   step A7 means the "storage unavailable" alert's trigger conditions are part of the
   characterization surface; neither T-list asserts it (T1–T7 all target data paths). Cheap to add
   to T5.

---

## Recommendations I would overturn

1. **T2's assertions (c) and (d) — overturn as written.** Replace with the real last-wins /
   fail-beats-recorded-value semantics (C5). The *gate* ("T2 before extracting `idb-database.ts`")
   survives untouched.
2. **"Hand-rolled fake for T1–T3, `fake-indexeddb` as follow-up" — invert.** `fake-indexeddb` is
   the only honest way to run T3's seven scenarios against `IndexedDbGameOfflinePersistence`;
   the transaction-ordering fidelity the test exists to pin is exactly what a hand fake gets wrong.
3. **"RV-B:240 / 00-SYNTHESIS:64 are incorrect" — downgrade to "conflated warn with fail."** The
   conclusion (test split is not a Day-4 blocker) survives; the accusation doesn't.
4. **"15 of 19 slots cross the boundary" — restate as "~11–13 shared + 2 trampolines + 4 near-misses."**
   Nobody should quote 15/19 in a ticket; quote the four concrete cross-calls (postToGame,
   replyToRequest, deliverConflict, updateCurrentBootstrap) and the two dual-clock refs
   (`bootstrapRef` 754/699, `savedReplies` 417/621/706) — they carry the argument alone.
5. **Minor but listable:** "13 methods", "22 functions", "12 `this.persistence`", "14 edges",
   "7 catch sites", "244 lines" — all wrong in the cheap direction; fix before this report gets
   copy-pasted into tickets.

## Recommendations that survive

- **665 untested storage lines / no IDB in tests / no fake-indexeddb, no DOM env** — reproduced
  independently. Characterization tests T1, T2 (fixed), T5, T6 before the split remain a genuine
  precondition; S2's phantom-"saved" mechanism is real and only `oncomplete`-deferred resolve
  prevents it today.
- **The §4.2 7-file cut (max 373), `canonical.ts` rename, errors-as-leaf, `DATABASE_VERSION`
  quarantined in `idb-database.ts`, no shim/repoint-both-importers** — all arithmetic and
  coupling claims reproduce; 2 importers / 11 names / 0 private coupling / 0 module side effects
  make this the cheapest split in the repo, as claimed.
- **Refuse the `useGameBridge`/`useGameSync` hooks split for this sprint.** I actively hunted for
  the clean cut at every boundary the report named (bridge/sync, presenter/chrome, demo/server) and
  none leaves the ≤400 component ceiling or a single-owner state partition; the dual-clock
  `bootstrapRef` + lost-ack two-level cache (`savedReplies` ↔ `eventRequests`) + shared dispatcher
  make it a behaviour change. **Upheld.**
- **Phase B steps 2–5 (schema fix, model extraction, chrome extraction, presenter extraction with
  T7), then stop at ~670 with a documented ratchet exception** — survives with the addenda above
  (styles import moves with chrome; 10+ props; 5-line version fix incl. :652).
- **§4.3 item 3 replacement with the mode-boundary bundle gate (a)** — every link in the evidence
  chain verified (gates, chunk filename, byte count, `out/jogar/index.html` →
  `0pvtinj9q2oay.js` reference, unambiguous DB string).
- **The lint premise** — severity-2 `react-hooks/refs`/`purity`/`set-state-in-render`/`immutability`
  confirmed live via `--print-config`; file clean today confirmed live via eslint exit 0; H9 stays
  correctly hedged.
- **Attribution correction and the 4-line defect** — both confirmed (§6b, §7), with the
  "silently stale" wording downgraded to "breaks loudly on bump; still worth 5 lines now".
