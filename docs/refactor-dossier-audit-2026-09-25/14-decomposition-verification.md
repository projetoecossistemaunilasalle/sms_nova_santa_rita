# Phase 40 decomposition — independent adversarial verification

**Verification date:** 25 September 2026
**Verifier role:** fresh verifier. No inherited claim was promoted without replaying its underlying check.
**Primary under test:** `docs/refactor-dossier-audit-2026-09-25/05-decomposition-primary.md`
**Target under test:** `docs/refactor-dossier/phases/40-decomposition.md` (610 lines)
**Workspace:** `main` at `e5aaf1e2891dbb1804950223eb9f0765e7dbeb65`, clean tree, `docs/refactor-dossier/` and `docs/refactor-dossier-audit-2026-09-25/` untracked. `git merge-base HEAD main` → `e5aaf1e`; `.git/shallow` absent.
**Mode:** read-only. No source, test, config, stylesheet, generated file, or dossier file was modified. All scratch was written outside the repo (`%TEMP%`) and deleted; `git status --short` shows only the two untracked documentation directories.
**Supersedes:** an earlier draft of this file that repeated the `out/_next/...` and "104 HTML" rows below without opening them. Those two rows are refuted here.

## Evidence key

| Tag | Meaning |
| :--- | :--- |
| **[R]** | **Reproduced** — I executed the check and obtained the claimed result |
| **[P]** | **Partly reproduced** — the core holds, a sub-claim or figure is wrong |
| **[F]** | **Refuted** — I executed the check and obtained a different result |
| **[N]** | **New defect** — not in the primary; found here |
| `[V]` / `[U]` | measured here / inherited and **not** reproduced |

## Baseline replay — every primary baseline row, independently re-run

| Primary claim (`05-…:38-52`) | My result | Verdict |
| :--- | :--- | :--- |
| `git rev-parse HEAD` = `e5aaf1e…` | `e5aaf1e2891dbb1804950223eb9f0765e7dbeb65` | **[R]** |
| offline 1,222 · host 932 · portal CSS 4,910 · service 616 · demo store 1,024 | 1,222 / 932 / 4,910 / 616 / 1,024 | **[R]** exact |
| Executed Vitest 33 files / 284 tests / 0 failed / 0 pending | `numTotalTests=284 numPassedTests=284 numFailedTests=0 numPendingTests=0`, `testResults.length=33` | **[R]** |
| `npx tsc --noEmit --incremental false` → 0, `tsbuildinfo` mtime unchanged | exit 0; mtime `09/22/2026 23:35:26` before **and** after | **[R]** |
| `npx eslint . --max-warnings=0` → exit 0 | exit 0 (and `npx eslint src/components/public/game-host.tsx` → exit 0, 0 messages) | **[R]** |
| 229 `it(` sites, 0 Vitest `test(`, 5 `it.each` | 229 / 0 / 5 | **[R]** |
| No `fake-indexeddb`, no jsdom/happy-dom/Testing Library, no declared `postcss` | all absent from `node_modules`; 0 hits in `package.json`+`package-lock.json`; `postcss` undeclared | **[R]** |
| **`out/_next/static/chunks/0pvtinj9q2oay.js`, 46,032 bytes** | **Path does not exist.** `out/_next` is absent and `out/` holds 0 `.js`. The file is at **`.next/static/chunks/0pvtinj9q2oay.js`**, 46,032 bytes, containing `missoes-caramelito-game-v1` | **[F]** — right size/content, **wrong tree** |
| **Existing export: 104 HTML files, 45 with literal `undefined` class** | `out` holds **0** `.html` (373 items: 39 `.txt` + directories). The HTML is in **`.next`**: **105** files, of which **45** carry a `class="… undefined"` token | **[F]** — the 45 is exact; the count is 105 not 104, and the tree is `.next` not `out` |

**Consequence for M-12.** The primary's M-12 rests on "the existing demo export contains the DB name in `out/_next/static/chunks/0pvtinj9q2oay.js` … so this code is shipped to GitHub Pages." On this tree there **is no `out/_next` at all**; the citation is a path that cannot be opened. The underlying *question* survives — `.next/static/chunks/0pvtinj9q2oay.js` is a client chunk of the demo build and does contain the DB name, and `next.config.ts:22-32` sets `output: "export"` for demo, so the code will ship — but an unopenable path was presented as executed evidence inside a Major. **M-12's conclusion is upheld; its evidence citation is refuted as stated.**

## Claim-by-claim verdicts on the 13 Major findings

### M-01 — service extraction cannot satisfy `≤470` — **UPHELD, arithmetic exact**

Every input re-measured in `src/application/adult-portal/service.ts`:

| Item | Primary | Mine |
| :--- | :---: | :---: |
| file lines | 616 | **616** |
| `authorizationActor` block `:49-61` | 13 | **13** |
| navigation block `:140-195` | 56 | **56** |
| return/role-label block `:196-206` | 11 | **11** |
| `616 − (13+56+11)` | 536 | **536** |

I opened all three ranges: `:49-61` is `function authorizationActor` → `}`; `:140` is `const navigation: PortalShellDto["navigation"] = [` and `:195` closes the `else if (role === "organization_admin")` push; `:196-206` is the `return { effectiveRole, roleLabel, scopeLabel, navigation }` literal. The 56-line navigation block also carries the `activeMemberships[0]?.organizationId` expression at `:189` that step 9's own **"If it fails"** clause (`:274-275`) still points at — so the block is not a clean lift; it strands that guard expression behind the new module boundary.

The gate at `:267` is `≤470 (~465 predicted)`. The honest floor is **536**, and `:318-322` simultaneously reasons that a ~465 service is a **WARN**-band file, i.e. *not* an exception. A 536-line file is above the 500 FAIL line, so it becomes exception 4 and the "exactly 3 exceptions" gate at `:316-317`/`:461` breaks. **Upheld, including the primary's secondary impact paragraph.**

I also re-verified the byte-identity claim the phase uses to justify the mapper move: SHA-256 of `adult-portal/service.ts:49-61` and `player-access/service.ts:14-26` are both `af59f9b2e981c42e094a7cecacaa100c7a6f7017476dfd85283facefa9a7b5b5`. The phase's `af59f9b2e981…` is **correct**, so the primary was right not to dispute it.

### M-02 — named `game-host` cuts leave ≥783 lines — **UPHELD, arithmetic exact**

`src/components/public/game-host.tsx`: 932 lines. `48-101` spans 54 lines, `837-931` spans 95 lines, `932 − 149 = 783`. All three measured **[R]**. The phase's gate at `:246` is `≤700 (floor 670)`, repeated in the exit gate at `:459`. The gap is **83 lines minimum**, and step 8's only other named edits are a protocol-constant fix (no net line change) and cross-reference comments (which *add* lines). The phase names no source region for the missing 83. **Upheld.** The prior VER-D allocation the primary cites (transport `:288-305`, ack `:317-340`, status/alert `:347-367`) is inherited; I did not re-derive it and mark it `[U]`, but the arithmetic that makes it load-bearing is mine.

### M-03 — the offline "move" is not mechanically valid — **UPHELD, and the enumeration is wrong**

All anchors confirmed: the class `IndexedDbGameOfflinePersistence` starts at **`game-offline-sync.ts:647`**; the proposed `idb-event-queue.ts` range `:962-1098` is `enqueueResult` (public), `enqueueActiveTime` (public), and the **private overloaded** `enqueueEvent` (three signatures at `:996`/`:1000`/`:1004`); the proposed `idb-database.ts` range `:1145-1221` is exactly `private read` / `private write` / `private transact`.

**The primary's count is right, its line list is not.** It says "13 direct calls to `this.read`/`this.write`" and then lists 12 line numbers. My grep for `this.(read|write|transact)` returns **15** hits: 8 with an explicit type argument (`:655, :668, :693, :829, :932, :1008, :1101, :1129`) and 7 without (`:746, :847, :890, :944, :1117, :1153, :1169`). Excluding the two internal `this.transact` calls made *by* `read`/`write` themselves (`:1153`, `:1169`) leaves **13 `this.read`/`this.write` call sites** — the primary's number is correct, and its list is short by **`:932`** and omits the two `transact` lines entirely. Harmless to the verdict, but a reader copying the list gets 12.

**[N-1 — step 7's partition is not a partition: the class header and footer are in no range. MAJOR.** I assigned all thirteen ranges at `:207-210` and diffed against the file. 1,186 of 1,223 lines are assigned; the unassigned set is `1-22, 30, 137, 169, 492, 507, 518, 563, 628, 646, 647, 961, 1099, 1144, 1222`. Most are imports/blanks that would be rewritten anyway, but three are structurally load-bearing and in **no** range: **`:647` is `class IndexedDbGameOfflinePersistence implements GameOfflinePersistence {`**, and **`:1222` is the class's closing `}`**; `:961`/`:1099`/`:1144` are the blank separators between event-queue methods. So the printed ranges assign the class's *methods* to three different modules while assigning the class's own *header and footer* to none. The primary calls the operation "an ownership redesign, not a line move" and asks for an ownership sketch before step 7 — correct, but it never noticed the ranges are not even a partition of the file. **Independently fatal in its own right.**

Each proposed file's line count against the phase's own `≤420` gate at `:219`:

| Module | Assigned lines | vs `≤420` |
| :--- | ---: | :--- |
| `types.ts` | 106 | ok |
| `errors.ts` | 31 | ok |
| `canonical.ts` | 44 | ok |
| `idb-database.ts` | 148 | ok |
| `idb-store.ts` | **374** | ok — and the phase's "374 source lines before its imports" at `:226`/`:457` is **exactly right** |
| `idb-event-queue.ts` | 137 | ok |
| `sync-engine.ts` | 346 | ok |
| **sum** | **1,186** | — |

Every per-file ceiling is satisfiable; the failure is entirely in the *command* that measures them (M-13).

### M-04 — "19-rule surgery" prints 16 — **UPHELD, verified rule by rule**

The phase at `:126-127` prints `1125, 1406, 1810, 2547, 2600, 2722, 2727, 2827, 3559, 3574, 3586, 3591, 3610, 3616, 4715, 4797` followed by `…` — 16 anchors for a set it calls 19 rules.

I built an independent CSS brace-walker (at-rule vs style-rule context, `:global(…)` names excluded, import binding resolved through the `@/` alias), computed the post-purge dead-name set, and looked up every anchor. The three the primary names are **real mixed rules with the exact live selectors it claims**:

| Start | Dead selectors | **Live selectors that must be retained** |
| :--- | :--- | :--- |
| `:1416-1420` | `panel`, `reportPanel` | **`detailPanel`** |
| `:2535-2540` | `adminNavGroup`, `navLabel` | **`sidebar`, `brand`, `sidebarProfile`, `desktopNavItem`** |
| `:2617-2624` | `dashboardGrid`, `builderLayout`, `detailGrid`, `reportGrid`, `shareLayout` | **`portalLoadingGrid`** |

The primary's wording for `:2535` is correct and, if anything, understates the trap — see **N-7** below. The exit gate at `:454` requires `portal unapplied: 0`; following the printed 16 leaves the three unprinted rules' dead selectors in the file, so the gate cannot pass. The phase's **"If it fails"** at `:147-148` ("restore that one class, do not weaken A1") sends the implementer the wrong way. **Upheld.**

### M-05 — the manual print procedure is impossible as written — **UPHELD**

`portal.module.css:4365-4367` is `.printSheet:not([data-player-print-active]) { display: none; }` inside the `@media print` block at `:4355-4391`. The attribute is written in exactly three TS operations, all inside the Print button's `onClick`: `player-credential-print-sheet.tsx:99` (`removeAttribute`), `:101` (`setAttribute`), `:104` (`removeAttribute` on `afterprint`). DevTools' *Emulate CSS media type: print* does not dispatch a click, so step 4's first expectation ("one sheet, 2 columns, QR ≈58 mm") at `:154` is unreachable and the gate rejects a correct implementation. The `Ctrl+P without clicking print → nothing` half at `:155` is correct. **Upheld exactly.**

### M-06 — A2's TS-constant contract has no implementation step — **UPHELD**

`data-player-print-active` appears at **4** sites repo-wide: 3 in `player-credential-print-sheet.tsx` (`:99`/`:101`/`:104`) and 1 in `portal.module.css:4365`. The phase at `:80-84` requires it to appear "in exactly one exported TS constant" while stating "no constant exists yet". Step 2 (`:63-116`) creates the script, one test, and a `--css-dir` fixture, and never creates the constant. The only fixture named is `misplaced-print`, which tests a `@media print` block selecting `.printSheet` when the class is absent from that file — it does not touch the constant, `.credentialPrintCard`, or a same-file positive case. **Upheld.**

### M-07 — the exit file count is arithmetically impossible — **UPHELD, fully intact**

`phases/40:458` gates `npx vitest run` at "**27 post-purge files + the 5 this phase adds** (steps 2, 6, 8, 9, 10)" while the same sentence says `game-offline-sync.test.ts` "is split in step 7, so its file count rises". Phase 30 adds `tests/unit/runtime-seam.test.ts` (`phases/30:574`, confirmed). Floor: `27 + 1 (Phase 30) + 5 + ≥1 (the step-7 split) = 34`, against a stated 32. Case-count equality to 182 also cannot hold once T1–T7 (7 cases) plus the four other new files land.

I verified which step creates which file, and the primary's "5 this phase adds" is right: step 2 → `css-selector-integrity.test.ts`; step 6 → `game-offline-idb-characterization.test.ts`; step 8 → `game-sync-presenter.test.ts`; step 9 → `shell-view-model.test.ts` (named at `:277`); step 10 → `adult-portal-demo-transaction` (`§Tests:493`). **This is the one Major whose every sub-count survives intact; the phase's 32 is what is wrong.**


### M-08 — two size gates for the same control — **UPHELD**

`phases/40:291` creates `scripts/size-ratchet.mjs` with a written exception registry and committed per-file targets. `phases/50:228` creates `scripts/check-size-budget.mjs` (G8) with `.size-baseline.json`, a *new-violation* baseline reading, and `grep -c '"src\|"tests' .size-baseline.json → 13`. Different filenames, different registries, different reduction semantics. `phases/40:11` says Phase 50 "inherits this phase's two scripts"; `phases/50:228` says "**Add** `scripts/check-size-budget.mjs`". **Upheld.**

I independently confirmed the shared 9-FAIL post-purge census both phases cite, and **all nine line counts are exact**: `service.ts` 616 · `marketing.module.css` 688 · `player-access-workflow.tsx` 540 · `portal.module.css` 4,910 · `team-screen.tsx` 411 · `game-host.tsx` 932 · `public.module.css` 1,017 · `adult-portal-demo-store.ts` 1,024 · `game-offline-sync.ts` 1,222. The census is sound; the *ownership* is not.

### M-09 — the merge-base rule is not reproducible in CI — **UPHELD**

`.github/workflows/deploy.yml:21-22` is `actions/checkout@v4` with **no** `fetch-depth: 0`, and it is the only workflow in the repo. It triggers on `push: main` + `workflow_dispatch` and has **no** `pull_request` trigger (`deploy.yml:3-6`). Phase 40's rule at `:293-295` judges modified pre-existing files against "their merge-base" but never requires a base SHA, `fetch-depth: 0`, or an error on missing history. On this local tree it happens to work (`.git/shallow` absent, `git merge-base HEAD main` → `e5aaf1e`) — which is exactly why the defect is easy to miss. **Upheld.** The primary's demand for a base SHA + `fetch-depth: 0` + missing-base-is-an-error is the right fix.

### M-10 — A1's computed-access rule contradicts its own 63-name baseline — **UPHELD, decisively, by direct execution**

This is the primary's strongest claim and I reproduced it exactly. The phase at `:77` says "Treat ``<binding>[`…`]`` as **'may apply any class'**", and the pseudo-code at `:106-107` says "plus 'any' when ``<binding>[`` appears".

I implemented A1 literally and ran it on `e5aaf1e`:

```
src/app/error.module.css                       named=6   unapplied=0
src/components/marketing/marketing.module.css  named=35  unapplied=23
src/components/portal/portal.module.css        named=319 unapplied=0    computed=true
src/components/portal/results.module.css      named=24  unapplied=0
src/components/portal/team-screen.module.css  named=6   unapplied=0
src/components/public/public.module.css        named=54  unapplied=4
```

The only two computed-access sites are `activity-mark.tsx:22` (`styles[\`tone${…}\`]`) and `materials-explorer.tsx:92` (same shape) — I opened both. Because both live in `src/components/portal/` and import `portal.module.css`, the "any class" rule credits **all 319** portal names, so **portal unapplied = 0** and the repo total is **27**, not 90. The phase's own baseline at `:90` claims portal **63** ("58 real + 5 `tone*` reached only dynamically"), which under the written rule is unreachable. **The written algorithm and the published baseline are mutually exclusive.** The primary is exactly right that the 63 requires evaluating the finite `tone*` domain, and exactly right that "the post-purge 149 happens to be safe because both computed importers die" — I confirmed that too: with the 46-file purge set applied, both computed sites are gone, `computed=false`, and portal reads **149**.

I then reproduced the **entire** post-purge baseline the phase marks `[S]` and explicitly declines to verify (`:92-93` "not reproduced here"):

| | portal | marketing | public | total |
| :--- | ---: | ---: | ---: | ---: |
| phase `:92-101` `[S]` | 149 | 23 | 18 | **190** |
| **mine, Phase-10 46-file manifest applied** | **149** | **23** | **18** | **190** |

The exit residual `23 + 18 = 41` follows. This is a genuine independent confirmation of the phase's hardest number, and it makes M-10 the load-bearing defect it claims to be: **an implementer who implements the printed rule cannot reproduce the printed baseline, and will conclude the parser is broken** — precisely the failure mode the phase's `:117-121` "If it fails … Fix the parser" clause invites.


### M-11 — the ratchet requires the demo store to shrink while step 10 grows it — **UPHELD**

`adult-portal-demo-store.ts` is **1,024** lines **[R]**. `DemoAdultPortalStore.transaction` at `:392-396` is exactly `transaction<T>(work) { return work(this); }` — no snapshot, no restore, 5 lines. `DemoPlayerAccessStore.transaction` at `:741-751` does `const before = structuredClone(this.state)` … `catch { Object.assign(this.state, before); throw error; }`, preserving `readonly state` identity. Copying that pattern **adds** ~6 lines, so the honest committed target is ~1,030 — above the merge-base 1,024.

The rule text at `:293-295` is "pre-existing files this branch modifies **strictly smaller than their merge-base `and`** either under budget or listed with the measurement", and `:304-306` adds that an excepted file is red when it exceeds "its committed target + a recorded tolerance". The primary's objection — that the two clauses are joined by "and", so a registry entry still carries the merge-base constraint it was meant to replace — is a **faithful reading of the printed text**. **Upheld.** Its four-branch restatement is correct, and its instruction that "the demo store's target must be its post-rollback line count, not 1,024" is exactly right: the registry entry printed at `:316-317` as `adult-portal-demo-store.ts 1,024>500` is guaranteed to fail on a correct implementation.

### M-12 — the demo-bundling decision is unowned — **UPHELD IN SUBSTANCE, CITATION REFUTED**

Substance confirmed: `game-host.tsx:26-31` statically imports `openGameOfflineStore`, `OfflineSessionMismatchError`, `GameOfflineStore`, `GameOfflineTransport` from `@/runtime/game-offline-sync` — an unconditional static import, so the whole IDB graph is in the client bundle regardless of mode. All **7** cited runtime guards are real and I opened each: `:156` `if (runtimeMode === "demo")`, `:260` `if (runtimeMode !== "server") return;`, `:500` and `:715` `if (runtimeMode === "demo")`, `:731` `if (runtimeMode !== "server" || !gameOrigin) return;`, `:760` `if (phase !== "waiting" || runtimeMode !== "server") return;`, `:804` `if (runtimeMode === "demo")`. `next.config.ts:22-32` sets `output: "export"` for the demo target, and `.next/static/chunks/0pvtinj9q2oay.js` (46,032 B) contains `missoes-caramelito-game-v1`. The decision is indeed neither accepted, refused, nor ticketed anywhere in the phase. **Upheld** — but see the Baseline table: the `out/_next/...` path it cites cannot be opened on this tree.

### M-13 — `wc … | sort -n | tail -1` returns the total — **UPHELD BY EXECUTION, reproduced exactly**

The phase uses `wc -l src/runtime/offline/*.ts | sort -n | tail -1` as its `≤420` gate at `:219` and again in the exit gate at `:457`. I built the exact fixture the phase's own world implies (files of 501 / 400 / 100 lines) and ran it under Git Bash:

```
=== raw wc ===
 100 .tmp-wc/f100.ts
 400 .tmp-wc/f400.ts
 501 .tmp-wc/f501.ts
1001 total
=== sort -n | tail -1 (as the phase specifies) ===
1001 total
=== sed '$d' | sort -n | tail -1 (corrected) ===
 501 .tmp-wc/f501.ts
```

The command returns **1001**, the sum, not 501. Combined with my per-file table above (sum **1,186** across seven files, every individual file under 420), the gate is red on a *perfect* split. **Upheld, and the primary's `sed '$d'` fix is verified working.** This is the most cleanly reproducible defect in the whole report.


## Minor findings

| ID | Primary claim | My result | Verdict |
| :--- | :--- | :--- | :--- |
| **m-01** | "665 untested lines" is a source-partition estimate, not measured coverage | Arithmetic reproduces. I confirmed **0** hits for `indexedDB\|IDBFactory` anywhere in `tests/`, and that the 7 in-memory fakes sit at `:283, :318, :374, :445, :494, :609, :690` — the phase's `:284, 320, 376, 446, 496, 611, 691` is **off by one on every one**. The `:35-279` span is 245 lines. `vitest.config.mts` has a `coverage` block but **no provider** is installed | **[P]** — substance right; the phase's 7 constructor line numbers are all off by one |
| **m-02** | the static test count is mislabeled | 229 `it(`, 0 `test(`, 5 `it.each`, runtime 284 — all exact. The phase's `:17-19` "229, then 234 counting the 5 `it.each`" arithmetic is right | **[R]** |
| **m-03** | A1's name overstates its direction | Accurate. A1 is an unapplied-*definition* ratchet; the inverse (applied with no definition) is out of scope. The phase does explain the direction at `:69-78`, so this is nomenclature | **[R]** |
| **m-04** | the shell view-model contract is under-specified | Accurate. The module is specified as taking `(ActorSnapshot, role)` while `effectiveRole` (`:74-91`) and `scopeLabel` (`:129-139`) — including the multi-organization count and `activeMemberships[0]` — stay in the service, outside the named blocks `:140-195`/`:196-206` | **[R]** |
| **m-05** | the shared authorization mapper can still point upward | Accurate and slightly understated. `player-access/service.ts:4` already does `import type { ActorSnapshot } from "@/application/adult-portal/types"`. A new `application/authorization/authorization-actor.ts` typed on `ActorSnapshot` would make the *shared* module depend on one aggregate — the exact coupling the extraction exists to remove. The phase forbids `@/server/**` (`:264-266`) but says nothing about `@/application/adult-portal` | **[R]** |
| **m-06** | step 9 silently expands the declared scope | Upheld but **undercounted** — see N-5 | **[P]** |
| **m-07** | the orphan-token deletion lacks its own exit assertion | Accurate. `--purple-dark` `globals.css:15`, `--purple-light` `:16`, `--radius-micro` `:53` — all three confirmed at those exact lines. A1 reports classes, not custom properties, so the deletion has no oracle | **[R]** |
| **m-08** | step 8 bundles protocol repair into the structural move | Accurate. `game-host.tsx:652` hardcodes `"The portal requires protocol version 1."` while `:668` interpolates `STATE_SCHEMA_VERSION`; `demo-game-adapter.tsx` has **0** `postMessage`/`addEventListener`/origin hits; `game-host.tsx` has exactly 2 `postMessage` calls at `:163` and `:778` — all verified | **[R]** |
| **m-09** | the T-label count does not prove T1–T7 exist | Accurate. `grep -c "^  it(\|^  test(" …` counts declarations, not identities. The phase's framing is also wrong in the other direction: `:458` calls the characterization file "demonstrably red-able against pre-move code", but characterization tests are **green** against current behavior and red only under a named mutation. The primary's correction is right | **[R]** |


## New defects found here (not in the primary)

### N-1 — step 7's partition is not a partition — **MAJOR**
Fully detailed under M-03. The class header (`game-offline-sync.ts:647`) and its closing brace (`:1222`) fall in **no** assigned range, so the printed ranges assign the class's methods to three modules while assigning the class's own header and footer to none. **Correction:** publish the ownership design *first* (base class, collaborator object, or free functions over an `IDBDatabase`), then derive ranges from the resulting module shapes. Do not publish ranges that do not cover the file.

### N-2 — A2's constant fixtures would be binding-blind where the tree is two-binding — **MINOR**
`team-screen.tsx:31-32` imports *two* stylesheets under two names (`styles` → `portal.module.css`; `teamStyles` → `team-screen.module.css`). I counted **27** `styles.` accesses and **6** `teamStyles.` accesses there. The phase's own A1 discussion at `:70-75` makes a point of resolving the local binding name; the A2 fixture set must do the same, and must assert on the *resolved stylesheet* rather than the literal token.

### N-3 — the primary's file-count floor is correct and should be preserved — **OBSERVATION**
The primary's `27 + 1 + 5 + 1 = 34` is the one Major whose every sub-count I confirmed independently, including which step creates which test file. Recorded so the consolidated register does not "correct" it downward.

### N-4 — the pre-purge 63 is a hybrid state matching no tree the phase describes — **MAJOR (extends M-10)**
Portal's unapplied count is **0** under the written "any class" rule with the tree as it stands; **197** with the 8 table-B components removed but the dynamic sites still crediting; and **149** with the full 46-file manifest applied. The phase's 63 matches **none** of these. It is a plausible reading of "58 real + 5 `tone*`" as an intermediate state, but no step produces it, so the pre-purge column is not derivational and cannot be used to validate a new parser. **Correction:** mark the pre-purge column `[D]` (design intent) or delete it, and require step 2 to derive only the post-purge number — which I reproduced exactly as 149/23/18/190.

### N-5 — step 9's `Administrador da plataforma → 1` gate has a 4th site a case-sensitive grep cannot see — **MINOR**
The phase at `:269-270` gates `grep -rn "Administrador da plataforma" src` → **1** (was 3: `service.ts:200`, `portal-shell-context.tsx:13`, `overview-screen.tsx:40`). The case-**sensitive** count is indeed 3. A case-**insensitive** sweep finds a **fourth**: `src/components/portal/classes-screen.tsx:59` — `description="Como administrador da plataforma, use a área de organizações…"`. That file is **not** in the Phase-10 46-file manifest (I checked all 46 paths against both the manifest and disk) and is imported by a surviving `page.tsx`, so it survives the purge. It is prose, not a role label, so the gate as written can still pass at 1 — but the primary's m-06 undercounts the surviving surface, and any implementer who "helpfully" makes the grep case-insensitive immediately fails on a file nobody scoped. **Correction:** scope `classes-screen.tsx` explicitly, or state that the gate is deliberately case-sensitive and that this prose copy is deliberately out of scope.

### N-6 — the 1,823-line all-dead figure is off by one — **MINOR**
Recomputing step 3 from my own dead-name set: portal has **696** style rules (289 all-dead, 26 mixed, 381 live-only). The rule count **289 is exact**; the 7 declared mixed starts' span is **exactly 39**; the 319-class census, the 149/23/18/190 baseline, and the five `tone*` names all reproduce. The all-dead **line** count is **1,824** against the phase's 1,823 — most likely a closing-brace boundary convention. Consequence is small (`≈3,048` is printed with `≈` at `:141`), but the exit gate at `:455` prints `→ ≈3,048` while using exact `→` elsewhere. **I uphold the primary on the 1,862/3,048 arithmetic** and record the one-line delta so the consolidated register does not rediscover it as a discrepancy.

### N-7 — `:2535` is a booby trap the primary understates — **MAJOR (sharpens M-04)**
`adminNavGroup` appears at `:2537` (inside the surgery target) **and** at `:2548` in a *live* rule (`.navigation .navGroup:first-child, .adminNavGroup { display: contents; }`). The dead-name set lists it as dead only because the *compound* `.adminNavGroup .navLabel` has no driver. An implementer applying the surgery by "delete every class the oracle reports unapplied" deletes a live selector. The phase's "If it fails" (`:147-148`) assumes a surviving `styles.X` is the failure mode; here the failure is the opposite — over-deletion that `tsc` and `build:demo` will **not** catch, because the class remains *defined*, merely unapplied. **This is the one surgery rule where a wrong edit is silent.** **Correction:** print the exact selector text to retain for each of the 19 (as in the M-04 table) and assert that every retained selector still has ≥1 `styles.<name>` reference.


## Confirmed-sound groups: do these survive verification?

| # | Primary claim | Verdict |
| :--- | :--- | :--- |
| 1 | Dead-CSS direction and count (319 named; 1,823+39 = 1,862; 4,910−1,862 = 3,048) | **[R]** with a 1-line delta (N-6). I independently derived 319 named, 696 style rules, 289 all-dead, 39 lines, and the full post-purge 149/23/18/190. Print classes are **not** in the dead set (`printSheet` → false, `credentialPrintCard` → false) |
| 2 | CSS extraction refusal (the print mechanism is real) | **[R]** — `:4355-4391` pairs a classless `:global(body) > *` hide with `.printSheet`/`.credentialPrintCard`; the sole owners are `player-credential-print-sheet.tsx:117,134`. The refusal should stand **after** the manual procedure is corrected (M-05) |
| 3 | Post-purge selector ratchet need | **[R]**, strengthened — the 90-only baseline is red on arrival, and I reproduced the correct 190 baseline that replaces it |
| 4 | Offline split value (two imports, separable engine/adapter) | **[R]** — exactly 2 import statements and exactly **16** `export` statements. The seven-file cap is justified *once* the ownership seam is designed (M-03, N-1) |
| 5 | Offline characterization before movement | **[R]** — 0 tests touch `indexedDB`/`IDBFactory`; requiring `fake-indexeddb` first is correct |
| 6 | Hook-split refusal | **[R]** on the measurable parts — 13 refs (`:114-129`), 6 states (`:130-137`), 19 slots; the `:753-757` render writes exist and are consumed downstream; lint on the file exits 0. The "11-13 of 19" figure stays `[U]`, as the primary correctly says |
| 7 | Service split refusal and destination | **[R]** as a *judgment*, but its stated justification is **false at 536** — `:409` argues "step 9 reaches ≈465 lines, already under the 500 fail line". M-01 shows the floor is 536. The refusal may still be right; its reason is not |
| 8 | Demo transaction rollback | **[R]** — `:392-396` is bare `return work(this)`, `:741-751` is the snapshot/restore pattern to copy, and in-place `Object.assign` preserves `readonly state` identity |
| 9 | Import-boundary census | **[R]** — 5 `application → @/server` import statements (2 runtime, 3 type-only), 10 files importing `@/generated/prisma/enums`, 1 surviving `components → @/server` (type-only), `player-access/service.ts:3` importing another aggregate's error. The primary's "necessary, not sufficient" point about `v1-policy.ts` is right |
| 10 | Coverage limits correctly recognized | **[R]** — `vitest.config.mts:12` `environment: "node"`, `:16` `tests/**/*.test.ts`, 0 `.test.tsx` in the tree, no DOM provider. Every UI assertion genuinely cannot fail in CI |

## Severity reassessment of the primary

| Primary verdict | My verdict | Note |
| :--- | :--- | :--- |
| Blocker: 0 | **Blocker: 0 — agreed** | Nothing here makes the plan unrunnable in a way 0 Blocker mis-states |
| Major: 13 | **Major: 13 upheld, 0 refuted** | M-01…M-13 all survive; M-12's *citation* is refuted, its finding is not |
| Minor: 9 | **Minor: 9 upheld** (m-01 and m-06 proved rather than merely asserted) | |
| Confirmed sound: 10 | **10 upheld, 1 with a corrected reason (#7)** | |
| New | **+3 Major (N-1, N-4, N-7) · +3 Minor (N-2, N-5, N-6) · +1 Observation (N-3)** | |

The primary's severity model and discipline are sound: no Blocker inflation, every Major anchored to a re-runnable check, and — unusually — it correctly declined to promote inherited numbers (the "11-13 of 19" slot count, the 27/182 post-purge suite totals, the 26-document export count) into evidence. Its two real weaknesses are presentational rather than analytical: **one unopenable artifact path presented as read evidence (M-12)**, and a **mis-enumerated call-site list in M-03** whose *count* is nonetheless correct.


## Coverage limits of this verification

- No `next build`, `next dev`, browser, print-media emulation, IndexedDB transaction timing, or database connection was performed. M-05's conclusion is derived from the CSS/TS source, not from an observed print.
- The 27/182 post-purge suite totals and the 26-document export count are **inherited and not reproduced**; I could not reproduce the export count because `out/` on this tree holds **zero** HTML files (the 105 documents live in `.next`). I take no position on 26.
- `11-13 of 19 shared slots` (`VER-D` 4b), the `~670` floor's provenance, and the VER-D transport/ack/status allocation are `[U]`.
- My CSS parser is an independent second implementation, not the one the phase or `RV-40` used. It agrees with them on every number except the one-line delta in N-6, which is corroboration but not proof of a shared method.
- The ratchet, selector-integrity, and print-pairing scripts do not exist yet; I did not implement them. M-04/M-06/M-13 verdicts are about the *specifications* and, for M-13, about the exact shell command.
- Coverage remains unmeasured: no provider is installed, so "665 untested" is a partition estimate, exactly as m-01 says.
- Node was v22.23.1 against a pinned 24.19.0 (`package.json:5-9`). Typecheck, lint, and the 284-test suite all reproduced, so the version gap changed no result observed here.

## Final disposition

**The primary's verdict stands: do not execute Phase 40 from the current text.** Its 13 Major findings survive independent replay without exception, and I add three more Major defects of my own — the incomplete offline partition (N-1), the underivable pre-purge CSS baseline (N-4), and the silent over-deletion trap at `:2535` (N-7).

Two of its evidentiary rows do not withstand opening: the `out/_next/static/chunks/0pvtinj9q2oay.js` path and the "104 HTML files" count. Neither changes a verdict, but the consolidated register should cite `.next/static/chunks/0pvtinj9q2oay.js` and "105 documents in `.next`" instead, and should not treat any `out/` observation as measured on this tree.

The phase's own hardest numbers are sound. I reproduced the post-purge 149/23/18/190 selector baseline, the 289 all-dead rules, the 39 mixed-rule lines, the 319-class census, the nine-file size census, the 13-`this.read`/`this.write` call count, the 374-line `idb-store.ts` figure, and the `af59f9b2e981…` clone hash exactly. **The plan's measurements are good; its executable recipe is not.** The highest-priority corrections remain the impossible line gates (M-01, M-02), the offline ownership design plus the incomplete partition (M-03, N-1), the missing three CSS surgeries and the silent over-deletion trap (M-04, N-7), the impossible print check (M-05), A2's missing source work (M-06), the impossible file count (M-07), and the duplicate/unreproducible size gate (M-08, M-09, M-11).

