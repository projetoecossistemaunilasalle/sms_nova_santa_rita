# RV-40 — refutation of `phases/40-decomposition.md`

**Attacked:** `docs/refactor-dossier/phases/40-decomposition.md` (399 lines) — the four god-file splits, the
dead-CSS purge, the selector-integrity oracle, the size ratchet, and 8 refusals.
**Commit:** `e5aaf1e`. **Toolchain:** Next 16.3.2, react 19.2.8, `eslint-config-next@16.3.2` →
`eslint-plugin-react-hooks@7.1.1` (`node -e require(…/package.json).version`), eslint 9.39.5, Node 22.23.1.
**Method:** read-only. Every destructive probe ran in `C:/Users/Vitor/AppData/Local/Temp/rv40` (scratch copies + a
scratch-patched copy of the react-hooks bundle). `npx tsc --noEmit --incremental false` and
`npx eslint . --max-warnings=0` were run in-repo; `tsconfig.tsbuildinfo` mtime is still `2026-09-22 23:35:26`, so
the cold/warm evidence is intact. `git status --porcelain` at the end of the pass: `?? docs/refactor-dossier/`.

**Verdicts: 39 PASS · 11 FAIL · 1 VACUOUS-GATE · 2 MISSING · 2 STALE-RULING(+2 more) · 1 UNREPRODUCIBLE.**

All three load-bearing NEW findings were reproduced independently. **Finding 1 survives as an observation but its
stated mechanism is false**; findings 2 and 3 survive intact. The most damaging confirmed defect is not in the
new material: step 6 silently renumbers the characterization-test series, **re-adopting the one case the owner
ruled out (edit 8) and dropping four tests that must be kept** — including the only guard on the sole
idb→canonical edge the split can break.

---

## §1 The three new findings

### 1.1 `react-hooks/refs` size-dependence — OBSERVATION **PASS**, MECHANISM **FAIL**

The two measurements reproduce exactly.

```
$ npx eslint src/components/public/game-host.tsx                 # real file, 932 lines
                                                                  exit=0, zero messages
$ cp src/components/public/game-host.tsx $T/orig.tsx
$ sed '140,752d' $T/orig.tsx > $T/cut.tsx                         # 319 lines
$ cat $T/cut.tsx | npx eslint --stdin --stdin-filename src/components/public/game-host.tsx --format json
  3 × severity 2  react-hooks/refs  "Cannot access refs during render"   @ 140:3, 141:3, 142:3
  + 37 × @typescript-eslint/no-unused-vars (warnings)
$ npx eslint --print-config src/components/public/game-host.tsx | jq .rules
  react-hooks/refs [2] · purity [2] · set-state-in-render [2] · exhaustive-deps [1] · rules-of-hooks [2]
```

Statements at `:753-757` are top-level in the render body (2-space indent), and the three refs they write are
declared at `:128-129`, `:120` — above the deleted region, so they survive the cut. Deps really are
`[gameOrigin, runtimeMode]` at `:801`.

**Confounders, each tested (same stdin harness; `refs=N` is the count of severity-2 `react-hooks/refs`):**

| Probe | Result |
| :--- | --- |
| `cut 140-752` (as filed) | refs=**3** |
| cut **+ stub `function receiveGameMessage`/`synchronizeQueue` restored** (kills the "surviving code references deleted declarations" confounder) | refs=**3** |
| cut **+ 613 `const __padN = N;` lines *inside* the component body** (body back to ~930 lines) | refs=**3** |
| cut **+ 613 module-level comment lines** (file back to 933 lines) | refs=**3** |
| untouched file + 613 module-level lines (control) | refs=0 |
| full file + duplicate render-scope ref writes injected at `:140` | refs=**0** |
| full file **blanking `showProtocolError` (13 lines, `:141-153`)** | refs=**3** |
| full file **blanking `synchronizeQueue` (132 lines, `:259-390`)** | refs=0 |
| full file blanking `saveDemoState` (69) / `validLaunchToken` (27) / `getOfflineStore` (4) | refs=0 |
| full file **blanking `receiveGameMessage` (127 lines)** | refs=**3** |
| emptied body + each single function added back (17 variants) | refs=3 in all 17 |

Line count is neither the trigger nor sufficient (padding restores it and nothing changes), the removed hook
declarations are irrelevant (they survive; stubs change nothing), and the file clearly still parses *as a
component* — the rule fires on it. What actually happens is a **compiler bailout**, and the bail is visible:
`cp` of `eslint-plugin-react-hooks.development.js` with its top-level `catch (err) {}`
(`runReactCompilerImpl`, the empty block before `return results`) turned into `console.error` + an exported
`__runCompiler`:

```
FULL (real file)   refs=0   events={"CompileUnexpectedThrow":1,"CompileError":1}
                             CompileError category=Todo @152:4
                             reason: "[PruneHoistedContexts] Rewrite hoisted function references"
CUT  140-752       refs=3   events={"CompileError":3}  category=Refs  @140,141,142
blank showProtocolError  refs=3  (bail moves to 3 BuildHIR lowering errors, which do NOT suppress Refs)
```

The component's compilation is aborted by a `Todo`-category `CompilerError` raised at `game-host.tsx:152` — the
last line of `showProtocolError`, a hoisted in-component `function` that closes over render-scope values — so
`validateNoRefAccessInRender` never runs for `GameHost` and the render-scope writes are invisible. Remove that
bailout and the three errors appear. **This is content-dependent, non-monotone in size** (13 lines flips it,
132 lines do not).

Consequences the phase must carry instead of the size story: (a) its prediction "the split is born red" is
*probably* right — a hooks split moves the hoisted closures out of the component — but it is a coin flip on the
bailout, not a size law; (b) the far more important asymmetry it misses: **today's `npm run lint` exit 0 is not a
property of the code**, it is a property of a `react-compiler` `Todo`. Any plugin patch that implements
`PruneHoistedContexts` turns `:753-757` red on `e5aaf1e` with no refactor at all, and `--max-warnings=0` makes
that a CI failure. That belongs in the ticket, and it strengthens rather than weakens the refusal.

### 1.2 The 90-class selector baseline — **PASS** (independently re-derived), baseline context **FAIL**

Re-derived with a different engine: `postcss.parse` (already in the tree, transitively under
`next@16.3.2` and `vite@8.2.2`) → `walkRules` → `r.selectors` → `\.([A-Za-z_][-\w]*)` after stripping
`:global(…)`; importers resolved through the real alias/relative paths with the **binding name taken from the
import statement**; applied = `binding.X` ∪ `binding["X"]`; backtick computed access tracked separately.

```
src/components/portal/portal.module.css     named=319  unapplied=63   dynamicSitesSeen=2 [file-level any]
src/components/marketing/marketing.module.css named=35 unapplied=23
src/components/public/public.module.css      named=54  unapplied=4
results / team-screen / error                unapplied=0
TOTAL = 90        sum per-file names = 444    union distinct = 415    names in ≥2 modules = 22
```

`63 = 58 static + the 5 `toneBlue/toneOrange/toneAqua/tonePurple/toneGreen` (all five named, none applied
statically)`. **415 and 22 reproduce exactly**, so the "6 module files, 415 distinct names" and "22 names shared
across modules" rows in Evidence are sound. The ratchet-not-zero-tolerance conclusion holds.

Blind spot **confirmed and quantified**: `src/components/portal/team-screen.tsx:31` binds `styles`
(portal.module.css) and `:32` binds `teamStyles` (`./team-screen.module.css`), using `teamStyles.` 6×. A literal
`styles.`-only scan leaves `team-screen.module.css` with **0 credited applications → 6 false-red names**
(measured: `STYLES-ONLY team-screen.module.css importers=1 unapplied=6`), i.e. the naive scan reports the
*stylesheet* as having no usable importer and totals 96. The file's sentence ("a `styles.`-only scan reports
*that file* with 0 importers", meaning `team-screen.tsx`) has the target inverted — `team-screen.tsx` is a
portal.module.css importer with 26 `styles.` uses. Fix in §3.

**But the baseline is measured at the wrong tree state.** The Entry gate requires "purge + seam merged", and step
2's own numbers are from `e5aaf1e` with Generation A on disk. Re-running my census with the 40 Phase-1 deletions
excluded from the importer sets:

```
portal  unapplied pre-purge 63  →  after Phase 1, before step 3: 149
public  4 → 18      marketing 23 → 23      TOTAL 90 → 190
```

A ship-as-ratchet baseline of 90 is **red on 100 additional names the moment Phase 1 lands**, i.e. on the very
tree the gate is installed into. Note also `dynSurvivor=false, dynDying=true` for portal: both computed-access
sites (`activity-mark.tsx:22`, `materials-explorer.tsx:92`) are deleted by Phase 1, so after the purge the
"may apply any class" escape hatch disappears entirely.

### 1.3 149 removable / 4,910 → 3,048 — **PASS** (including the direction)

`wc -l src/components/portal/portal.module.css` → **4,910** ✓. Classification of the 319 named classes by which
importers reference them (survivors / Phase-1-dying / nobody):

```
live=170   purge-dead=86   never-referenced=63   removable = 86+63 = 149   319 = 170+86+63 ✓
```

The **direction is right**: 170 is the live bucket, not the removable one, so the file's self-correction of its
own brief ("170 is *live*") is correct against code. The 91/58 split differs from my 86/63 by exactly the 5
`tone*` classes: they are counted as purge-dead when dynamic access counts as a reference, and as
never-referenced under a static scan. Both total 149, and the file's own "63 raw − 5 tone* = 58" is the same
58 — the two of its numbers that looked suspicious are the *same set* measured twice. Deletion arithmetic:
postcss rule spans, two-pass with child-rule ownership so a parent's span is not double-counted →
**289 all-dead rules = 1,823 lines** (exact), plus the 7 cited mixed rules (`:3347, :3351, :3428, :4582,
:4823, :4842, :4878`) = 39 → **1,862**, and **4,910 − 1,862 = 3,048** ✓. My independently written 289/1,823
matching their 289/1,823 is the strongest single corroboration in the file; it also matches the dossier's D-3
row (`REFACTOR-DOSSIER.md:80`), so the number is triple-sourced.

---

## §2 Claim table

| # | Claim (quoted) | Where used | Verdict | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| 1 | "`npm test` → `33 passed` files / `229` tests" | Entry gate :17 | **FAIL** | `find tests -name '*.test.ts' \| wc -l` → **33**; static `^\s*(it\|test)\s*\(` → **229** (and 234 counting the 5 `it.each` sites) — so the static half is right, the `npm test` framing is wrong: `VER-A` N5 *ran* the suite → **33/284 pre-purge, 27/182 post-purge**, and the phase's own precondition is a purged tree |
| 2 | `npm run lint` → exit 0; `format:check` red on `REFACTOR_PLAN.md` | Entry gate :16 | **PASS** | `npx eslint . --max-warnings=0` → exit 0; `npx prettier --check .` → `[warn] REFACTOR_PLAN.md`, exit 1; `check` = `format:check && lint && typecheck && test`; `npx tsc --noEmit --incremental false` → exit 0 |
| 3 | Anchor table: 616 / 932 / 1,222 / 4,910; demo store 1,024 | Step 1 | **PASS** | `wc -l` → 616, 932, 1222, 4910, 1024 |
| 4 | `grep -c fake-indexeddb package.json package-lock.json` → `0 0`, absent ×3 | Entry gate, step 5 | **PASS** | 0 / 0 / `node_modules/fake-indexeddb` ABSENT; not in `devDependencies` (12 entries, no fake-indexeddb) |
| 5 | "`package-lock.json:13636-13637, 13668-13671` are vitest's unfilled optional peers"; jsdom/happy-dom absent | Refusal 2 | **PASS** | those lines are `"happy-dom": "*"`, `"jsdom": "*"` and their `"optional": true` meta; `node_modules/{jsdom,happy-dom,@testing-library}` all ABSENT |
| 6 | `vitest.config.mts:12` `environment:"node"`, `:16` `include:["tests/**/*.test.ts"]`; **0** `.test.tsx` among the 33 | Refusal 1/2, Tests | **PASS** | file verbatim; `find tests -name '*.test.tsx' \| wc -l` → 0. Buying jsdom genuinely enables no component test |
| 7 | "`react-hooks/{refs,purity,set-state-in-render}` severity 2", `eslint . --max-warnings=0`, `:753-757` invisible today | Refusal 1 | **PASS** | `--print-config` → 2/2/2, `exhaustive-deps` 1; eslint on the real file → 0 messages |
| 8 | deleting `:140-752` and re-linting identical statements → 3 × severity-2 | Refusal 1, Evidence :387 | **PASS** | reproduced exactly (§1.1) |
| 9 | "the rule's analysis **scales with component size**"; "if lint turns red … you shortened the component enough" | Refusal 1, step 8 If-it-fails | **FAIL** | the trigger is a `Todo` bailout `[PruneHoistedContexts] Rewrite hoisted function references` at `:152`; padding to 933 lines keeps the errors, and blanking a 13-line hoisted function flips an otherwise untouched file. Size is neither necessary nor sufficient |
| 10 | A1 baseline "**total red set 90 names**"; 6 module files, 415 distinct names, 22 shared | Step 2 | **PASS** | independently re-derived: 63+23+4=90; union 415; names in ≥2 modules 22 (§1.2) |
| 11 | "Ship A1 as a ratchet over **that list**" | Step 2, Exit gate, handed to `phases/50:516` | **FAIL** | post-purge the same rule is red on **190** names (portal 149, public 18, marketing 23): the baseline is measured two phases before the tree it ships into |
| 12 | "`team-screen.tsx:32` imports as `teamStyles`, so a `styles.`-only scan reports that file with 0 importers" | Step 2 A1 | **PASS** (wording **FAIL**) | `:32` is `import teamStyles from "./team-screen.module.css"` ✓; the naive scan costs 6 false names, but on `team-screen.module.css`, not on `team-screen.tsx` (which has 26 `styles.` uses) |
| 13 | "`@media print` at `:4355-4391` … 6 rules … opens with a `:global(body) > *` hide rule" | Steps 1, 4, Refusal 4 | **PASS** | `4355:@media print {`, block closes at `4391`; rule heads exactly `4356, 4360, 4365, 4369, 4381, 4388`; `4356 :global(body) > * { visibility: hidden; }` verbatim (`4360` carries two selectors `.printSheet,`/`.printSheet *`) |
| 14 | "`.printSheet`/`.credentialPrintCard` at `:4140`,`:4146`, sole owner `player-credential-print-sheet.tsx:117,134`" | Step 4, Refusal 4 | **PASS** | defs at `4140`/`4146`; only `styles.printSheet` @117 and `styles.credentialPrintCard` @134 in the whole tree, in that file — which step 3 does not delete |
| 15 | splitting the sheet "silently produces blank printed sheets with every gate green" | Refusal 4 | **PASS** | per-file hashing + classless `:global(body) > *` half; `printSheet`/`credentialPrintCard` are **live** in my classification, so no automated signal sees the separation; the only check is step 4's human DevTools pass |
| 16 | deferral D-3=(b) + Refusal 4 protect it; no remaining step reintroduces a split | Refusal 4, Exit gate | **PASS** | step 3 is "delete, **no split**"; its delete set (149 names) contains neither `printSheet`, `credentialPrintCard` nor `sidebar`; the only forward-looking split is "later per-screen stylesheet extraction", declared **Blocks** and gated on "steps 2 and 4 green" + a D-3 answer |
| 17 | "`data-player-print-active` … today hardcoded **3×**: tsx `:99`, `:101`, css `:4365`" | Step 2 A2 | **FAIL** | 4 literal sites: `player-credential-print-sheet.tsx:99, 101, **104**` + `portal.module.css:4365`. The file's own Evidence row :391 lists `:104` |
| 18 | "170 live / 91 purge-dead / 58 never-referenced → **149** removable … = 1,862 block-deletable lines (289 rules for 1,823 + 7 mixed for 39)" | Step 3, Exit gate | **PASS** | 170/86/63 (the 5-name delta is the `tone*` dynamic-access convention, self-consistent with "63 − 5"); 289 rules / **1,823** lines reproduced exactly; 4,910−1,862=3,048 |
| 19 | token ordering: `--purple-dark/light` `:15/:16` only by `.tonePurple` `:997-1001`; `--radius-micro` `:53` only `:904/:2212/:4597`, all removable; 3 orphans | Step 3 | **PASS** (off-by-one) | globals.css `:15,:16,:53` ✓; `.tonePurple` is **`:998-1001`** (`:997` is blank); the three `--radius-micro` consumers are rules `.miniBars span` (902-906), `.qrCell` (2211-2214), `.organizationBars span` (4595-4599) — all three classes **are** in the 149. 68 tokens declared ✓ |
| 20 | `--focus-ring-color` declared inside `.sidebar` `:6-7`, consumed `globals.css:120`; `.sidebar` `portal-shell.tsx:49` is a sibling of `.workspace` `:81` | Step 3 If-it-fails | **PASS** | all four citations verbatim |
| 21 | "16 exports / 11 consumed / 2 importers" | Scope, step 7 | **PASS** | `grep -c '^export '` → 16; union of the two import statements → exactly 11 distinct names; importers = `game-host.tsx` + `tests/unit/game-offline-sync.test.ts` |
| 22 | "`game-host.tsx:23` holds a live `@runtime/*` alias"; "repoint the only 2 importers (`game-host.tsx:24-29` …)" | Depends-on, step 7 | **FAIL** | the `@runtime` import is at **`:24`** (`:23` is a `@/application` type import); the engine import statement is **`:26-31`** (`} from "@/runtime/game-offline-sync"` at `:31`); test import `:6-16` ✓ |
| 23 | `openDatabase :564-627`, DB name `:23`, `DATABASE_VERSION 3` `:24`, stores `:25-29`, additive `onupgradeneeded :568-603`, `eventRequests` `:28`/`:595-599`, `enqueueEvent :1009-1096`, const `100` `:403` | Steps 1, 6, 7 | **PASS** | every line confirmed; `request.onupgradeneeded = () => {` is at `:568` and each branch is `objectStoreNames.contains`-guarded |
| 24 | "`succeed` `:1200-1203` overwrites unconditionally — last-wins"; late `fail` `:1186-1198` aborts+rejects; resolve only at `oncomplete` `:1204-1210` | Step 6 T2 | **PASS** | `const succeed = (result: T) => { value = result; hasValue = true; }` — no `settled` guard; `fail` sets `settled`, `transaction.abort()` in try/catch, `reject(...)`; `oncomplete` early-returns `if (settled)`. The `VER-D` 2c correction is properly applied here |
| 25 | "665 lines / 54% = 14+8+3+64+576 at `:493-506`, `:519-526`, `:528-530`, `:564-627`, `:647-1222`"; port fake `:35-279`; `game-offline-sync.test.ts` 728 lines | Step 5 | **PASS** | spans sum to 665 (14+8+3+64+576); test file = **728** lines, so the audit's "683" is wrong and this row is the correction |
| 26 | "`git grep -c openGameOfflineStore src` → 2 (definition + `game-host.tsx:216`)" | Step 7 verify | **FAIL** | → `game-host.tsx:2`, `game-offline-sync.ts:1` = **3** occurrences (def `:493`, import `:27`, call `:216`) |
| 27 | 7-file partition; `wc -l src/runtime/offline/*.ts \| sort -n \| tail -1` → **≤373** | Step 7, Exit gate | **FAIL** | the file's own ranges: types 106, errors 31, canonical 44, idb-database 148, **idb-store 374**, idb-event-queue 137, sync-engine 346 = 1,186 assigned + 36 unhomed (imports `:1-22` + 14 blanks). 374 > 373 **before any import line is added** → the gate is unachievable by construction; step 7's own fallback ("if `idb-store.ts` drifts past 500") contradicts it |
| 28 | Evidence: "24 lines given no home (`:493-506`, `:508-517`)" | Evidence :398 | **FAIL** | step 7 assigns both to `sync-engine.ts`. The genuinely unhomed 36 lines are the shared import block and blank separators |
| 29 | 13 refs `:114-129` + 6 states `:130-137` = 19; 2 effects `:759`,`:803`; 0 memo/callback/reducer; exit gate `grep -c "useState\|useRef"` → 20 | Refusal 1, Exit gate | **PASS** | all counts exact; `useMemo\|useCallback\|useReducer` → 0 |
| 30 | `deliverConflict :233-257`; `:754` feeds the accept/drop test at `:699`; `reconnectAndSync` reads `:783`; deps `:801`; gates `:156,260,500,715,731,760,804` | Refusal 1, Evidence | **PASS** | every line confirmed, incl. `:699` `if (message.request_id !== bootstrapRef.current?.request_id) return;` and `:783` `synchronizeRef.current();` |
| 31 | "`synchronizeQueue` needs ~16 runtime / 21 with-type bindings"; "11-13 of 19 cross" | Refusal 1 | **UNREPRODUCIBLE** | not derivable statically; and `REFACTOR-DOSSIER.md:439` (dossier §8.2) says "**~19** external bindings (method-dependent)" for the same function. Three different numbers for one quantity; the phase cites none of them against the dossier |
| 32 | "`demo-game-adapter.tsx` has **0** occurrences of postMessage/addEventListener/origin"; `:16-20` `as const` with `[1]`; `createBridgeRequestId` at `game-bridge.ts:77`, both sides import it | Refusal 8, step 8 | **PASS** | three `grep -c` → 0,0,0; the literal is at `:16-20`; def `src/components/public/game-bridge.ts:77`; importers `demo-game-adapter.tsx:11` + `game-host.tsx:34` |
| 33 | "`game-host.tsx:652` hardcodes the numeral while `:668-669` interpolates the constant"; `contracts/v1/schemas.ts:4-5` | Step 8 | **PASS** | `:652` `"The portal requires protocol version 1."`; `:668` `${STATE_SCHEMA_VERSION}`; `src/contracts/v1/schemas.ts:4,5` define both (the citation drops the `src/` prefix — the repo root also has a `contracts/` tree) |
| 34 | 17 public methods (org 4 / team 5 / class 6 / shell 2) `getShell:121` → `deactivateTeacherAssignment:569`, + 3 private; nav `:140-195`, role label `:196-206` | Refusal 3, step 9 | **PASS** | exactly 17 + 3 private at `:114,:589,:603`; `const navigation … = [` at `:140`, closes `:195`; `roleLabel` `:198-206` inside the `return {` at `:196` |
| 35 | "`player-access/service.ts:14-26` is **byte-identical** to `adult-portal/service.ts:49-61` … block sha256 `af59f9b2e981…`" | Step 9 | **PASS** | both blocks are 13 lines and hash to `af59f9b2e981c42e094a7cecacaa100c7a6f7017476dfd85283facefa9a7b5b5` — the published 12-hex prefix matches exactly |
| 36 | "`Administrador da plataforma` was 3: `service.ts:200`, `portal-shell-context.tsx:13`, `overview-screen.tsx:40`"; `roleLabel` triplicated (`overview-screen.tsx:38-43`) | Step 9 | **PASS** | 3 files, 3 sites, lines exact; `overview-screen.tsx:38` `const roleLabel =`, literal at `:40` |
| 37 | `NavigationItemDto`/`PortalShellDto` at `types.ts:88-101`; `V1AuthorizationSnapshot` `v1-policy.ts:21-26`; `AdultPortalService` runs in the browser at `adult-portal-demo-actions.ts:50`; no `@/components` import in `src/application` | Step 9 | **PASS** (off-by-one) | `types.ts:88`/`:96` inside 88-101 ✓; the type is declared at `v1-policy.ts:**20**`; `:50` verbatim; `grep -rn 'from "@/components' src/application` → 0, so the refusal's "existing nowhere today" is true |
| 38 | `application → @/server` = **5** (2 runtime, 3 type-only) at the cited lines; `@/generated` in **10** app files; surviving `components → @/server` = 1 (`portal-shell.tsx:4`); 4 `application → application`; `player-access/service.ts:3` throws another aggregate's error | Step 12 | **PASS** | all five import lines match verbatim; 10 files listed; 6 `components → @/server` exist today, of which 5 are Generation A files or `status-badge.tsx` (whose `portal-view-service` import Phase 1 collapses) → **1 survivor** ✓; cross-context = `game-events/service.ts:2`, `player-access/ports.ts:1`, `player-access/service.ts:3,4` ✓ → 5+10+1+4 = **20 sites**, so "red on ~20 not 5" holds |
| 39 | `v1-policy.ts` is 85 lines / exactly 3 importers / enums-only; relocating it is "the only change that lets the future boundary rule ship green" | Step 12 | **PASS** | `wc -l` → 85; importers are precisely the 2 app services + `tests/unit/v1-authorization.test.ts:14`; its only import is `@/generated/prisma/enums`; no `src/server/**` file imports it, so the move is cycle-free and zeroes the runtime class. It is *necessary but not sufficient*: the 3 type-only edges, 10 `@/generated` files and 4 cross-context edges still need grandfathering — the step's own text says as much, so the superlative is the only overreach |
| 40 | "`plan:246` *already* reads 'All new or modified files', identical to audit `:744-745`, so there is no ratchet reading left to adopt" | Refusal 7 | **PASS** | `REFACTOR_PLAN.md:246` = "**File Size Ratchet:** All new or modified files respect the governing budget:"; audit `:744` carries the budgets, `:745` "Ratchet: the budget applies to *new or modified* files only, so the plan does not stall on existing offenders". §8.5's proposal is indeed redundant |
| 41 | post-purge census "**9 FAIL / 8 WARN**" with the named 9; "5 of the 9 have no §4 step"; test file 728 is a WARN | Step 11, Refusal 7 | **PASS** | my independent census (GENA excluded, budgets 250/400 · 300/500 · 300/600 · 400/800) → **9 FAIL**, same nine files at the same line counts, and 7 source WARNs + `game-offline-sync.test.ts 728` = **8**; the 5 with no plan §4 step are `adult-portal-demo-store.ts`, `public.module.css`, `marketing.module.css`, `player-access-workflow.tsx`, `team-screen.tsx` ✓ |
| 42 | `node scripts/size-ratchet.mjs` → exit 0 listing **exactly 4 exceptions**; "`service.ts` only if it stays over 300 — a WARN is not an exception"; `--self-test` → exit 1 on a synthetic 501-line module | Step 11, Exit gate | **FAIL** | self-refuting: step 9 predicts ≈465 for `service.ts`, which is 300<465≤500 = a **WARN**, and the same sentence says a WARN is not an exception → the list is 3, not 4; and step 7 modifies the 728-line test file (also a WARN) → 3, 4 or 5 depending on a rule the file contradicts in one line |
| 43 | the ratchet design: new files hard-capped, excepted pre-existing files judged "strictly smaller than their merge-base" | Step 11, Refusal 7 | **VACUOUS-GATE** | an excepted name's *only* surviving constraint is `<` merge-base size, so `portal.module.css` may regrow 3,048 → **4,909** with every gate green — 1,861 lines, i.e. exactly what step 3 deletes, can come back inside the branch. And `--self-test` (a *synthetic new* module) exercises only the new-file branch; nothing in the design can fail on the exception branch that governs every file this sprint touches. "A ratchet that cannot go red is a report" is quoted in the same step and is not satisfied |
| 44 | step 6 "**T3** v2→v3 migration over pre-existing queued rows; **T4** resolve only at `oncomplete`; **T5** `createClientEventId`/`sameJson`; **T6** session-mismatch guard" | Step 6 | **MISSING** | `COMPAT-POLICY.md` §4 edit 8 (adopted): "Drop the **v2→v3-with-pre-existing-events** characterization case and keep **T1-T6**" — the case the ruling deletes is re-adopted here under the label T3, and the real series (`reports/INV-D:719-724`) is displaced: source **T3** = IDB twin parity over the 7 existing scenarios (guards S3/S4/S5), **T4** = legacy `eventRequests` backfill — INV-D:673 flags it as "**the only idb→canonical edge, the one place the split can create a bad import**" — **T5** = conflict coercion, **T6** = `stableJson` key-order. Four must-keep tests vanish and the phase's Tests section claims the file covers "S1 and S2" out of a table of S1-S8 |
| 45 | `localStorage` key/version `missoes-caramelito:adult-portal:v2` → "**do not touch**" (§12) | Interfaces :312 | **STALE-RULING** | edit 6 adopted (`COMPAT-POLICY.md:96`): "bump `DEMO_ADULT_PORTAL_STORAGE_KEY` to `:v3` and `version: 3` at `adult-portal-demo-store.ts:124,137-138,148`; `readDemoAdultPortalState`'s existing seed fallback `:347-356` is the whole migration" |
| 46 | "names **byte-identical**" as a constraint for `GameOfflinePersistence` + the 11 exports; "Reader/mutation specifier names | unchanged | 38 specifiers" | Interfaces :307, :313; step 7 | **STALE-RULING** | edit 8 adopted: downgrade "must remain byte-identical"/"must stay reachable" from *constraints* to *defaults*, citing §7.3's `TS2305`/`TS2724` row as the reason a rename is safe. Keeping them identical is still the right default — it must not be filed as an unbreakable interface row |
| 47 | "`contracts/**` (published wire schemas, **R-16**)"; "old `/atividade/<token>` URLs … (**D-4/R-08**, Phase 1's breakage)" | Do-not-touch :342; Accepted breakage :360 | **STALE-RULING** ×2 | edits 4 and 5 (adopted) delete `R-16`, `Q-3`, `D-4` and `R-08`. The protections themselves survive as class-B B1 (`contracts/schemas/README.md:85`) and as B4's residue — re-cite those, not deleted register rows |
| 48 | generated-seam leakage: any step assuming `src/runtime/target.ts` or an auto-generated seam | whole file | **PASS** (clean) | `src/runtime/target.ts` does not exist, is not tracked, is not ignored; `grep -rn "runtime/target" src tests scripts` → 0; no `prebuild` in `package.json`; `scripts/next-target.mjs` is 70 lines of `spawnSync` + `loadEnvConfig` with **no** `writeFile`/`mkdirSync`. Phase 40 never names them — its seam dependency is only the `@runtime` alias at `game-host.tsx:24` |
| 49 | "`tests/unit/player-credential-printing.ts` precedent"; `player-credential-printing.test.ts` (57 lines) tests only the data helper | Step 8, Tests | **PASS** | `src/components/portal/player-credential-printing.ts` exists (827 B); test = 57 lines |
| 50 | ".mobileNavItem in **0 of 7** stylesheets; `mobile: true` on all 14 nav items; **45 of 104** documents ship `class="… undefined"`" | Do not touch :337 | **PASS** | `grep -n "mobile: true" service.ts portal-navigation.tsx \| wc -l` → **14** (7+7); `find out -name '*.html' \| wc -l` → **104**; documents carrying an `undefined` class token → **45** |
| 51 | Evidence header: "Dossier §= `docs/REFACTOR-DOSSIER.md`" | Evidence :380 | **FAIL** | the file is `docs/refactor-dossier/REFACTOR-DOSSIER.md`; the cited path does not exist, and every `§` shorthand in the file resolves through it |
| 52 | `plan` §4.1 item 1 "Purging Generation A eliminates **1,567** physical lines of dead CSS"; "308 distinct classes" | (unreconciled) | **MISSING** | Phase 1 states "the purge deletes **zero** CSS", and step 3 deletes **1,862** — so §4.1.1 is reassigned to this phase silently, with a **+295-line** delta against fixed input and no refusal row; `REFACTOR_PLAN.md:150`'s "308 distinct classes" is also 11 short of the 319 this phase measures everywhere else |

---

## §3 Replacements for the FAILs

1. **Entry gate (:17)** → "`npm test` → post-purge **27 files / 182 tests**, 0 failed (`VER-A` N5, executed).
   Static census on that tree: **127** plain `it(`/`test(` call sites (132 counting the 5 `it.each` sites, which
   expand to 182 at runtime). The pre-purge pair **33 / 284** describes `e5aaf1e` only — do not gate on it here."
2. **Step 2 baseline (:69-72)** → "Baseline re-derived **after Phase 1 has landed**, with the 40 Generation-A
   paths removed from the importer sets: portal **149** / marketing **23** / public **18** → **190** names. The
   `e5aaf1e` figure is 90 (portal 63 = 58 + 5 `tone*`, marketing 23, public 4) and is quoted here only as the
   provenance of that delta; a ratchet over 90 is red on 100 names on the tree this phase installs into."
3. **Step 2 A1 (`teamStyles`)** → "`src/components/portal/team-screen.tsx:31-32` binds **two** stylesheets under
   two names — `styles` → `portal.module.css` and `teamStyles` → `team-screen.module.css`. A literal `styles.`
   scan still counts the file as a portal importer but reports `team-screen.module.css` with 0 applications, i.e.
   6 false-red names out of 6."
4. **Step 2 A2 (:65-66)** → "…must appear in that stylesheet and in exactly one exported TS constant (today
   hardcoded at **4** sites: `player-credential-print-sheet.tsx:99, :101, :104` and
   `portal.module.css:4365`; no constant exists yet)".
5. **Refusal 1 mechanism (:253)** → replace "the rule's analysis scales with component size" and step 8's "if
   lint turns red … you shortened the component enough" with: "`react-hooks/refs` is silent on `game-host.tsx`
   because compiling `GameHost` throws a `Todo` bailout — `[PruneHoistedContexts] Rewrite hoisted function
   references`, reported at `:152` — before `validateNoRefAccessInRender` runs (measured by re-running the
   plugin's own `runReactCompilerImpl` with its top-level `catch (err) {}` instrumented; the event list is
   `{CompileUnexpectedThrow:1, CompileError(Todo@152):1}` with **no** `Refs` event). The bailout is
   content-dependent, not size-dependent: blanking `showProtocolError` (13 lines, `:141-153`) or
   `receiveGameMessage` flips the untouched file to 3 errors, while blanking `synchronizeQueue` (132 lines) does
   not, and padding the cut body back to 933 lines does not restore the silence. **Two consequences:** a hooks
   split that removes the hoisted context-capturing closures will very likely expose the writes; and the current
   green `npm run lint` is an artifact of an unimplemented compiler pass, so a `react-hooks` patch can turn
   `:753-757` red with no code change at all. The offline ticket must carry *this*, not a size heuristic."
6. **Step 7 (:148, :152)** → "repoint the 2 importers (`game-host.tsx:26-31`, `game-offline-sync.test.ts:6-16`);
   the live `@runtime/*` alias the seam repoints is `game-host.tsx:24`." And: "`wc -l src/runtime/offline/*.ts |
   sort -n | tail -1` → **≤420**; the assigned ranges already put `idb-store.ts` at 374 source lines before its
   own imports, so ≤373 is unreachable; delete the 'if it drifts past 500' fallback or state which number
   governs. `git grep -c openGameOfflineStore src` → `game-host.tsx:2`, `offline/sync-engine.ts:1` (3
   occurrences today: def `:493`, import `:27`, call `:216`)."
7. **Evidence :398** → "…and 36 lines given no home: the shared import block `:1-22` plus 14 blank separators.
   (`:493-506` and `:508-517` *are* assigned, to `sync-engine.ts`.)"
8. **Step 11 / Exit gate exception count** → "exit 0 listing exactly **3** exceptions — `portal.module.css`,
   `game-host.tsx`, `adult-portal-demo-store.ts` — with every modified WARN (`service.ts ≈465`, the split test
   files) required to be under its fail line, or state that WARN-band modified files are excepted and print
   **5**."
9. **Ratchet self-test** → "`--self-test` must fail on **both** branches: (a) a synthetic 501-line new module →
   exit 1; (b) a synthetic file present in the exception registry whose scratch copy is 1 line **larger** than
   its recorded merge-base size → exit 1. Add the invariant 'the exception list must shrink within the sprint',
   otherwise the excepted names can regrow to just under their merge-base with every gate green."
10. **Step 6 T-list** → restore the source series: T1 schema freeze, T2 `transact` semantics (as corrected),
    **T3 IDB twin parity over the existing 7 scenarios**, **T4 `eventRequests` legacy backfill**, **T5 conflict
    coercion**, **T6 `stableJson` key-order**; delete the v2→v3-with-pre-existing-queued-rows case per
    `COMPAT-POLICY.md` §4 edit 8.
11. **Interfaces :312 / :342 / :360** → re-state per edits 4/5/6/8 (bump to `:v3`; cite B1 rather than R-16;
    cite B4's residue rather than D-4/R-08), and label the byte-identical specifier names as the adopted
    **default**, not a constraint.
12. **Evidence :380** → `docs/refactor-dossier/REFACTOR-DOSSIER.md`.

---

## §4 Refusal audit

| # | Refusal | Sound? | Why |
| :--- | :--- | :--- | :--- |
| 1 | `game-host` hooks split (§4.3 1,2,4) | **SOUND, mechanism false** | All the load-bearing counts verify (19 slots, `deliverConflict :233-257` on both sides, 0 memo/callback, deps `:801`, no DOM env, `.ts`-only include). Its headline observation reproduces. But it rests on a size story that §1.1 refutes, and it under-weights the stronger argument it discovered: the green baseline is a compiler `Todo` bailout, so `:753-757` are unenforced *today* and enforceable *by a dependency bump* — an argument that does not need the split at all. |
| 2 | DOM test environment | **SOUND** | Every input verified (§2 rows 4-6); deferring to the test-layering ADR matches audit §10.5's own ownership. |
| 3 | 3-way service split + `authorization-guards.ts` | **SOUND** | 17 methods and the ≈465 landing point both reproduce; and `plan` §4.4 item 2 offers "keep cohesive **or** split", so choosing the first is inside the plan, not a deviation from it. The `player-access/service.ts:3` cross-aggregate import is real. |
| 4 | per-screen CSS extraction (§4.1 2-4) | **SOUND — the file's best refusal** | The whole hazard chain is confirmed from source (§2 rows 13-16) and the "still over 600 either way" point matches the dossier's D-3 row. Correctly gated on steps 2 and 4 rather than on an implementer's judgement. |
| 5 | `request-registry.ts` name | **SOUND** | `eventRequests` really is an IDB store (`:28`, created `:595-599`, written only from `enqueueEvent` `:1009-1096`); `:519-562` is `createClientEventId`/`sameJson`/`stableJson`/`eventRequestIdentity`, so `canonical.ts` is the honest name. |
| 6 | no `offline/index.ts` barrel | **SOUND and ruling-aligned** | Edit 8 deletes the "keep a thin re-export" option for exactly this file (2 importers); the §7.4 non-applicability argument is correct. |
| 7 | "§7.1 as an absolute ceiling" | **SOUND on the documents, UNRELIABLE on the mechanism** | Both quotes are exact (§2 row 40), so §8.5's proposal is genuinely redundant, and dropping the 683/728 test-file work item is right. But the replacement — an exception registry — is the VACUOUS-GATE of row 43, and its exception count contradicts itself in a single sentence (row 42). The refusal wins the argument and loses the enforcement. |
| 8 | §4.3 item 3 handshake dedup | **SOUND** | 0 occurrences in the adapter, 2 `postMessage` calls in `game-host.tsx` (`:163`, `:778`), helper already shared at `game-bridge.ts:77`. The `demo-issuer.ts` extra is also correct: the file exists nowhere, and `hashPlayerCredentialToken` (`player-credential-tokens.ts:12`) sits behind `import { createHash } from "node:crypto"` at `:1`, so it cannot run in a browser. |

Plan §7's acceptance criteria are not silently dropped by any refusal: §7.1 is deviated from *with a recorded
mechanism and a named debt list*; §7.3/§7.5 survive in the exit gate (`npm run check`, `build:demo`); §7.2/§7.4
are other phases'. The one under-recorded deviation is §4.4 item 1's destination: the plan asks for
`src/components/portal/portal-navigation-presenter.ts`, step 9 ships
`src/application/adult-portal/shell-view-model.ts` — the reasoning is right and *is* stated in the work order,
but it should also appear in the Refusals list with its number, like the other seven.

---

## §5 What this phase would have gotten wrong

1. **Its own characterization gate, and it would have looked compliant.** Step 6's T3 is the exact test the
   owner ruled out (edit 8), and adopting it pulls the numbering so that the source T3-T6 — twin parity, the
   `eventRequests` backfill, conflict coercion, `stableJson` key-order — disappear. The backfill is the single
   place INV-D says the split can create a bad import. A reviewer reading "T1-T6 kept, per the ruling" would
   see six labels, not the four lost risks.
2. **It would install a selector gate that is red on 100 names on arrival.** The 90-name baseline is measured
   with Generation A on disk; the gate is installed after Generation A is deleted, where the same rule yields
   **190**. `phases/50:516` already inherits "baseline **90**", so the error is queued for CI as well.
3. **It would ship a ratchet whose weak branch cannot be exercised.** `--self-test` fires the new-file branch
   with a synthetic module; every real file this sprint touches is judged by the excepted/pre-existing branch,
   where the only surviving test is "smaller than merge-base" — so `portal.module.css` can return to 4,909 lines
   inside the sprint with the gate green. The step even asserts the right principle ("A ratchet that cannot go
   red is a report") and then designs the thing that satisfies it only nominally.
4. **Its size gate is unachievable by its own partition.** idb-store.ts = 374 assigned source lines before
   imports; the verify demands ≤373; the fallback text tolerates 500. Whoever runs step 7 hits a red gate on
   the first `wc -l` and has to invent a third number.
5. **It would chase a lint mechanism that does not exist.** "Shorten until the rule starts analysing it" is
   wrong in both directions — an untouched 932-line file goes red by blanking a 13-line function, and a
   319-line file with the same statements padded back to 933 lines stays red. A split performed under the size
   model would be *deliberately* sized to keep the bug invisible, which is the opposite of what the phase
   recommends. (And it misses the free, alarming corollary: `main` is green on `:753-757` only because
   `PruneHoistedContexts` is unimplemented upstream.)
6. **Two numbers it prints as verified would mislead a reader who trusts the exit gate:** `33 files / 229
   tests` is a pre-purge file count glued to a static case count, presented as the output of `npm test`; and
   the exception list is fixed at "exactly 4" by a rule that the same sentence reduces to 3.

---

## §6 Could not check

- **`npm test`, `npm run check`, `next build`, `build:demo`.** Out of the read-only budget. The 284/182 pair is
  taken from `VER-A` N5, which ran `npx vitest run --reporter=json`; 229/127/132/234 are my own static counts and
  are stated as such. The `out/` figures are read from the checked-out local export (which is untracked,
  `.gitignore:7`, `git ls-files out` → 0), not from a rebuild.
- **Step 4's manual print emulation.** Requires a browser. Everything structural around it (the block, its
  owners, the attribute lifecycle, the fact that no automated gate can see a per-file hash split) is verified.
- **Refusal 1's binding-count claim** ("~16 runtime / 21 with-type" for `synchronizeQueue`) is a property of a
  split that does not exist; not derivable, and it disagrees with the dossier's "~19".
- **A second react-hooks version.** The "a plugin patch turns `:753-757` red" corollary follows from the
  measured cause (a `Todo` for an unimplemented pass) but cannot be demonstrated without installing another
  plugin version.
- **`REFACTOR-DOSSIER.md` §8.3's 19-rule surgery list and §8.4/§8.5 in full** — spot-checked (the D-3 row at
  `:80` reproduces the 1,862/19-rule/3-token triple, and 11 of the cited anchors were opened) rather than
  re-audited; they belong to the dossier-accuracy pass.
- **Registry-key semantics** of the proposed `size-ratchet.mjs` (name vs path, how merge-base is obtained) — the
  script does not exist; rows 42-43 judge the design as written in step 11.
