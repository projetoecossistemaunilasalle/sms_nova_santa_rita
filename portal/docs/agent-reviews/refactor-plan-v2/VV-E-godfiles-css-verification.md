# VV-E — Independent Verification of `RV-E-godfiles-css.md` (§4 god files / §5 CSS strategy)

| | |
| :-- | :-- |
| **Role** | Adversarial verifier of reviewer **RV-E**. Default posture: refute. Only findings I reproduce with my own measurements are upheld. |
| **Subject** | `docs/agent-reviews/refactor-plan-v2/RV-E-godfiles-css.md` vs. `REFACTOR_PLAN.md` §4.1 (`:146-157`), §4.2 (`:159-163`), §4.3 (`:165-171`), §4.4 (`:173-175`), §5 (`:179-202`) |
| **Method** | Read-only. Primary data built from scratch: (1) enumerated the exact §2.2/§2.3 deletion population from `REFACTOR_PLAN.md` tables; (2) extracted CSS-module class tokens **per module** (each `styles.X` bound to the `.module.css` file its own `import` names, not by bare token name); (3) brace-matched CSS parser over `portal.module.css` / `public.module.css` (comment-squashed, `@media`/`@keyframes`/`:global` aware) counting declared-line spans; (4) full static import graph over `src/**` for transitive-deadness. **Not executed:** any build, test, install, `npm`, or write into `src/`, `tests/`, `docs/` (scratch scripts live in `C:\tmp\`, outside the repo). |
| **Measured** | 23 September 2026 working tree, dirty (`git status --porcelain` non-empty); all line numbers are `wc -l` newline counts. |
| **Headline** | **RV-E's marquee number is the wrong wrong-number.** Its 1,263 purge-attributable figure understates my measurement by 5.3% (it silently omits `public-state.tsx`, worth exactly 56 lines) and its 694-line orphan bucket reproduces **to the line**. But its *accusation* — that the plan's **1,570 is unreachable from the purge alone** — **fails**: my independent per-selector model reproduces **1,567 physical lines removed**, i.e. the plan is within **0.2%**. RV-E built the gap by *declaring* blank separator lines out of scope, then charged the plan for including them. Separately, RV-E's own shared-class hazard count (**29**) and primitives-breadth counts (**22 files / 11 surviving**) are inflated by a single methodological flaw — it resolved `styles.X` by **token name**, ignoring *which* CSS module that file imports. Correcting that flaw moves the shared set to **27** and shrinks the hazard list. Of RV-E's 8 rolled-up findings, **5 uphold, 2 are overstated, 1 is refuted as phrased**; 3 of its MAJORs survive as MAJOR only for §4.1's *specification*, not its *arithmetic*. |

---

## 0. Primary data (my inputs, not the reviewer's)

**§2.2 + §2.3 deletion population resolved to real files:**

| Source | Files | Lines | Plan claim | Delta |
| :-- | :--: | :--: | :--: | :--: |
| `src/app/(professional)/portal/atividades/` | 9 | **1,188** | 1,188 | exact |
| `…/portal/materiais/` | 3 | **92** | 92 | exact |
| `…/portal/modulos/` | 2 | **23** | 23 | exact |
| `…/portal/admin/jogos/` | 1 | **7** | 7 | exact |
| `…/portal/admin/modulos/` | 1 | **7** | 7 | exact |
| `src/app/(public-play)/atividade/[token]/` | 5 | **364** | 364 | exact |
| §2.3 nine services/db/security files | 9 | 2,156 | 2,156 | exact |
| §2.3 eight component files | 8 | **1,257** | 1,201 | **+56 (4.7% stale low)** |

→ **21 route files** under the six §2.2 trees + **8 deleted §2.3 components** = **29 deleted UI files**, of which **17 import a CSS module**. `src/` total = 165 `.ts/.tsx` files; **136 survive**.

Per-file component drift (confirms RV-E's out-of-scope note exactly): `activity-builder.tsx` **256** vs plan 244 · `activity-controls.tsx` **156** vs 147 · `material-editor.tsx` **266** vs 252 · `materials-explorer.tsx` **132** vs 120 · `class-groups-explorer.tsx` **237** vs 228 · `share-actions.tsx` 147 ✓ · `activity-mark.tsx` 27 ✓ · `public-state.tsx` 36 ✓. All §2.2 route-tree totals are exact (1,188 / 92 / 23 / 7 / 7 / 364 = 1,681).

**Transitive-deadness check (RV-E never ran this).** Full static import graph over `src/**` resolved through `@/` and relative specifiers: **0 surviving `src/components/**` files are imported exclusively by deleted files.** So the purge's CSS footprint is *exactly* the direct `styles.*` usage of those 17 files — no hidden second wave. This is what makes the arithmetic below closeable rather than open-ended.

**Escape-hatch check (decisive for confidence).** `grep -rn 'className="' src --include=*.tsx` excluding lines containing `styles` → **0 hits**; `className={\`` without `styles` → **0 hits**. Every class in the app is applied through a CSS-module object. Combined with the exhaustive `styles[` sweep (§2), my token inventory is **complete**, not heuristic.

---

## 1. THE HEADLINE CONFLICT — adjudicated

### 1a. My measurement

Token buckets, resolved **per module** (portal.module.css): 319 declared names → **81** referenced only by deleted files, **27** shared deleted+surviving, **150** surviving-only, **63** referenced by nothing. (public.module.css: 54 declared → **14** / **1** / **36** / **4**.)

Rule-block accounting over the brace-matched parse (693 selector rules in portal, 127 in public; `@keyframes` steps excluded, `@media` wrappers excluded from block spans):

| Model | Blocks | Lines | Notes |
| :-- | :--: | :--: | :-- |
| **M1 — strict block**: every class in the prelude is purge-dead | 207 | **1,330** | portal 166/1,065 · public 41/265 |
| **M2 — per-selector**: *each comma-selector* contains ≥1 purge-dead class (a selector with a dead class can never match post-purge, so it is independently removable) | 211 | **1,357** | portal 170/1,092 · public 41/265 |
| **M3 — M2 + the blank line each deletion actually consumes** | 211 | **1,567** | portal 1,261 · public 306 |
| Pre-existing orphans (referenced by **no file at all**, dead *today*) — block model | 114 | **694** | portal 106/**641** · public 8/**53** |
| Pre-existing orphans — per-selector model | 118 | 710 | portal 653 · public 57 |
| Mixed blocks needing **selector surgery** (some selectors die, some live) | 22 | 148 | portal 124 · public 24 |
| Max one-shot dead-CSS deletion (M2 + orphans + surgery spans) | — | 2,236 | |

**No blank lines or comment lines fall *inside* any counted block** (net == inclusive span for all 820 rules), so the blank-separator term is purely the gap *between* rules — i.e. what a real editor removes when it deletes a rule.

### 1b. Confidence band

M1/M2 content-line figures are **±2–3%**. Sources of residual error, stated: (i) whether an emptied `@media`/`@supports` wrapper's own 2 lines are credited (14 wrappers exist — 11 in `portal.module.css`, 3 in `public.module.css` — so up to +28 lines); (ii) the `all(...)` vacuity on class-less preludes (1 rule / 3 lines in portal, excluded); (iii) the two `styles[\`tone…\`]` sites, which I resolved by hand (§2). Token attribution itself has **no** measurable uncertainty — §0's escape-hatch check makes the usage map complete. M3 adds one modelling choice (count the separator), ±1 line per block.

Band: **purge-attributable dead CSS = 1,357 declaration lines (1,330–1,390), ≈ 1,567 file lines (1,540–1,610).**

### 1c. Adjudication of the three competing numbers

| Number | Whose | Reproduces? | Why |
| :-- | :-- | :-- | :-- |
| **1,570** | plan §4.1:150 | **YES — at 1,567 (−0.2%, −3 lines)** | The plan says "deletes ~1,570 **lines**", which is what the file loses: purge-dead rule bodies *plus* the blank line each deletion collapses. Under M3 it lands to within 3 lines. It is **not** the purge + orphans merge RV-E asserts. |
| **1,263** | RV-E A3 | **NO — 5.3% low; true 1,330 (M1)** | Two identifiable causes. (1) It **drops `src/components/public/public-state.tsx`**: `.stateCard` 653-666, `.stateIcon` 668-676, `.stateIcon svg` 678-681, `.stateCard h1` 683-690, `.stateCard p` 692-697, `.stateActions` 699-705, plus the nested `.gameStageHeader h1, .stateCard h1` 927-930 and `@media` `.stateCard` 993-996 = **exactly 56 lines** = 265 − 209, the precise public-module gap. (2) It self-excludes blank separators, then indicts the plan for counting them. |
| **694** orphans | RV-E A3 | **YES — to the line (641 + 53)** | Also reproduces at 106 + 8 rules and 63 + 4 names. RV-E's orphan work is exact. |
| **"52 of 319 purge-attributable"** | RV-B F-10 | **REFUTED — true count 81** (77 with fully-dead blocks) | RV-B's **"63 referenced by nothing"** is however **exact**. RV-B halves the real purge-attributable class count; RV-E understates its lines by 5%. |

**Verdict on the headline: RV-E's finding #1 is OVERSTATED, and its framing is REFUTED.** RV-E is *directionally* right that "~1,570 lines of dead CSS" is under-specified (it never says whether blank separators, `@media` wrappers, or already-dead orphans are inside the count) — that is a real documentation defect worth a MINOR. But its MAJOR escalation rested on the claim that 1,570 "is not reproducible from the purge alone"; a purge-only model reproduces it at 1,567. The plan does **not** need the orphan merge to reach its number, so the accusation of conflation collapses. RV-E's substitute number is itself wrong (1,263 vs 1,330/1,357).

What genuinely survives of RV-E here: the **694 lines already dead today** are invisible to the plan (§4.1 step 1 and Day-3 `:224` say only "purge dead rules" / "purging Generation A"). That extra work item is real, unbudgeted, and 4× the size of the surgery bucket. **MINOR → MODERATE**, reframed from "the plan's number is wrong" to "the plan's number is right but its *scope* is half the dead CSS in the file."

---

## 2. Shared-class hazard, mixed preludes, dynamic access

**Intersection computed independently** (module-scoped): **27** class names in `portal.module.css` are used by both deleted and surviving files, plus **1** in `public.module.css` (`.primary`) = **28**. RV-E says **29**.

**RV-E's 29 is over-inclusive by exactly 2, from a method flaw it never discloses.** Its list includes `.reportPanel` and `.reportPanelHeader` as "shared" because `results-screen.tsx:179-180` writes `styles.reportPanel`. But `results-screen.tsx:11` is `import styles from "./results.module.css"` — a **different file**, which declares `.reportPanel` at `results.module.css:132` and `.reportPanelHeader` at `:139`. The `portal.module.css` copies (`:1406-1414`, `:1416-1420`, `:1810-1815`, `:1992`, `:1999`) are referenced only by the deleted `atividades/[id]/resultados/page.tsx:103,104,135`. They are **purge-attributable, not a hazard** — and my parser correctly puts them in M2's removable set (the `:1406` block is 3-of-4 removable and lands in the surgery bucket).

The same token-name-only resolution inflates RV-E's A4 breadth claims: it reports `.field` at "10 files/32 refs" and a family union of "22 files, 11 surviving". Measured with `styles` bound to the right module: `.field` = **8 files / 27 occurrences**, union of `.button`/`.buttonGhost`/`.input`/`.field` = **20 files, 9 surviving** (11 deleted). Its per-token counts for `.button` 14/17, `.buttonGhost` 8/12, `.input` 7/14 reproduce **exactly** — so the flaw bites only where a second module declares the same name (`.field`, also in `marketing.module.css:527`; `.reportPanel`). **Consequence: RV-E's "naive purge breaks 29 classes" is really 27, and the edit blast radius it prices §4.1 at is ~18% smaller than it states.**

**The 5 exemplars RV-E named: all CONFIRMED shared.** `.button` (dead: 5 route pages + activity-builder, activity-controls, class-groups-explorer, material-editor, share-actions · alive: 2 route pages, adult-portal-form, player-access-workflow), `.input` (alive: classes-screen, organizations-screen, player-access-workflow, team-screen), `.field` (alive: class-detail/classes/organizations/team screens, player-access-workflow), `.toolbar`, `.toast` (alive: demo-action-button). Full 27-name set and their alive consumers are in §Appendix B. The "delete everything the removed files touched" hazard is real — upholding RV-E's *substance* while correcting its *count*.

**`:1127` — CONFIRMED, with a precision correction.** `portal.module.css:1125-1128` reads:
```
.searchField input,
.select,
.input,
.textarea {
```
RV-E describes this as "the mixed-prelude selector `.input, .textarea` at `portal.module.css:1127-1128`". Line 1127 is indeed `.input,` and it is indeed a mixed prelude requiring surgery (`.textarea` is purge-dead via `material-editor.tsx`; `.select` and `.input` are shared) — but the prelude is **4 selectors over 1125-1128**, not 2, and the block is 11 lines (1125-1135). Substance **UPHELD**, quotation **incomplete**.

**RV-E's other two "partially mixed" exemplars are REFUTED.** `.completionRing` is declared only at `:2056`, `:2067 (::before)`, `:2076 (strong)` — **always as the sole selector**, clean single-selector blocks deleted whole by M1/M2. `.srOnly` is declared exactly once, `:2841 .srOnly {`, also alone. Neither sits in a mixed prelude. Only `.textarea` genuinely does (plus a clean block at `:1153`).

**Complete mixed-prelude inventory (my parse — 22 blocks / 148 lines; RV-E listed none of these beyond the one):**

`portal.module.css` — `1026-1031` (2/3), `1125-1135` (1/4), `1406-1414` (3/4), `1416-1420` (2/3), `1810-1815` (1/2), `2535-2540` (1/4), `2547-2550` (1/2), `2600-2603` (1/2), `2617-2624` (5/6), `2727-2733` (4/5), `2827-2837` (3/9 — inside `@media (prefers-reduced-motion: reduce)` opened at `:2818`), `3559-3566` (1/3), `3574-3578`, `3586-3589`, `3591-3596`, `3610-3614`, `3616-3622`, `4715-4720` (3/4), `4797-4802` (2/4), `4823-4840` and `4842-4844` (dead ancestor `.classToolbarActions` × live `.button`); `public.module.css` — `260-274`, `288-292`, `1013-1016`.

**Every dynamic `styles[` in the repo (a mechanical purge misses these):** exactly **2**, both template-literal, both in **deleted** files:
- `src/components/portal/activity-mark.tsx:22` — ``styles[`tone${tone[0]?.toUpperCase()}${tone.slice(1)}`] ?? ""``
- `src/components/portal/materials-explorer.tsx:92` — ``styles[`tone${material.accent.charAt(0).toUpperCase()}${material.accent.slice(1)}`]``

RV-E's file:line cites (`:22`, `:92`) are **exact**. `.toneBlue/.toneOrange/.toneAqua/.tonePurple/.toneGreen` are declared at `portal.module.css:983-986 / 988-991 / 993-996 / 998-1001 / 1003-1006` (RV-E's `983-1007` — correct to within 1 line). **But RV-E's practical worry is void and I can show it:** because grep cannot see the access, those 5 names land in my **orphan** bucket (they are in the 63), so any usage-audit purge deletes them anyway; and since *both* consumers are in the §2.3 deletion list, deleting them is safe under either label. The method caveat is honest; the risk it implies is not.

---

## 3. Primitives fiction (`.card` / `.badge`)

Swept **all 6** `src/**/*.module.css` **plus** `src/app/globals.css` for the *selector* (word-boundary-anchored, `(^|[,{}\s])\.(name)($|[^\w-])`) and every `.tsx/.ts` for the *usage*:

| Token | Selector declared? | `styles.<token>` used? | Per-token verdict |
| :-- | :-- | :-- | :-- |
| `.card` | **0 declarations** — absent from all 6 modules and `globals.css` | **0** (nearest neighbours: 18 real `*Card` names — `summaryCard` ×13, `entryCard` ×5, `stateCard`/`statCard`/`linkCard`/`classGroupCard` ×3, …) | **RV-E UPHELD** — plan §4.1:151 names a class that does not exist |
| `.badge` | **0 declarations** anywhere | **0** (only `statusBadge` ×1, `sidePanelBadge`, `portalLoadingBadge`) | **RV-E UPHELD** |
| `.button` | `portal.module.css:712, 723, 742, 757`, nested `:2828` | 14 files / 17 refs | **UPHELD (exists)** |
| `.buttonGhost` | `portal.module.css:714, 725, 744, 751, 770` | 8 files / 12 refs | **UPHELD (exists)** |
| `.input` | `portal.module.css:1127, 1143` | 7 files / 14 refs | **UPHELD (exists)** |
| `.field` | `portal.module.css:1612, 1621-1622` **and `marketing.module.css:527, 534`** | portal 8 files / 27 refs | **UPHELD (exists)** — RV-E missed the second declaration site |
| `.card` analogue `.panel` | `portal.module.css:1406, 1416` (RV-E's "1425-region" is the block's tail; the prelude starts at **1406**) | 1 file: **`activity-builder.tsx:125`** | see below |
| `.badge` analogue `.statusBadge` | `portal.module.css:1038, 1050` | `status-badge.tsx:31` | **RV-E exact on both line numbers** |

**2 of 6 exemplar classes are fabricated — RV-E's finding #2 is UPHELD.**

**New, and it refutes RV-E's own proposed fix.** RV-E closes Open Question 3 by asking "which real classes back `.card` and `.badge` — `.panel`? `.statusBadge`?" As to `.panel`: **no.** `.panel`, `.panelTitle`, `.panelDescription` and `.sidePanel`/`.sidePanelArt`/`.sidePanelBadge`/`.sidePanelBody` are referenced by `activity-builder.tsx` **and nothing else** — a file §2.3 deletes (`REFACTOR_PLAN.md:59`). Post-purge `.panel` is dead CSS in exactly the same way `.card` is fictional. The live card/panel primitives that actually survive are `.managementPanel` (`portal.module.css:3598`; used by `classes-screen.tsx:82`, `organizations-screen.tsx:71`, `team-screen.tsx:130,209`), `.summaryCard`, `.stateCard`. So RV-E's Open Question 3 has a wrong premise, not just an unanswered one, and §4.1 step 2's target list needs `.card → .managementPanel`-class renaming, not `.card → .panel`.

**Extraction-blast-radius correction.** 20 files touch the button/input/field family; **9 survive**. RV-E's "wide edit, not a mechanical move" conclusion is **UPHELD** (9 surviving files must add a second module import and re-point every reference), while its 22/11 magnitude is **OVERSTATED**.

---

## 4. Class counts of `portal.module.css`

| Counting method | My measured value | RV-E's | Matches 308? |
| :-- | :--: | :--: | :--: |
| `wc -l` | **4,910** | 4,910 | n/a — plan **exact** |
| dedupe of `^\.[A-Za-z_][A-Za-z0-9_-]*` (line-anchored selectors) | **315** | 315 | no |
| dedupe of `\.[A-Za-z_][A-Za-z0-9_-]*` anywhere (comment-squashed) = distinct names in any selector prelude = my parser's declared set | **319** | 319 | no |
| declared at nesting depth 0 (outside every `@media`) | **317** *(RV-E did not try this)* | — | no |
| distinct dotted names appearing **only** inside `@media` | 2 | — | no |
| class-rule **occurrences**, non-deduped, line-anchored | **674** | 674 | no |
| selector rule blocks parsed (depth 0 + nested) | 693 (555 top-level + 138 nested) | — | no |
| names **declared AND actually referenced** via a module-correct `styles.X` | **256** | 251 | no |
| names referenced by the 37 files importing `portal.module.css` | **258** (incl. 2 undeclared ghosts) | — | no |

**Verdict: RV-E's finding #4 UPHELD** — 4,910 is exact, 308 matches **no** method (off by 7–11, ≈2.4%). One correction: RV-E's third candidate, "class names actually referenced via `styles.X` anywhere in `src/` = **251**", does **not** reproduce; module-correct it is **256** (block-level dedupe `grep -rhoE 'styles\.[A-Za-z0-9_]+' src | sort -u` = 330 across *all six* modules, of which 256 intersect `portal.module.css`). RV-E's own number is 5 low here.

**Meaningful denominator for the purge math: 319** (declared names = the universe from which lines can be removed), with **256** as the live subset and **63** the never-referenced remainder. Neither 315 nor 308 is a valid base for a line count: 315 misses the 4 names that appear only as non-leading selectors, and 308 misses nothing because it measures nothing. Under the correct frame, my §1 numbers partition cleanly: the 37 portal-importing files reference **258** names = 81 purge-dead + 27 shared + 150 surviving-only; **2** of those 258 are ghosts declared nowhere (`materialAudience`, `mobileNavItem`), so **256** are declared-and-referenced, and 256 + **63** never-referenced = **319** declared exactly. The plan's §4.1 arithmetic should have read "319 declared names, of which **63 (19.7%) are referenced by no file at all today**."

---

## 5. `src/**/*.module.css` — the true CSS surface

| File | Lines | Importers | Declared class names | Plan claim |
| :-- | :--: | :--: | :--: | :-- |
| `src/components/portal/portal.module.css` | **4,910** | 37 | 319 | 4,910 ✓ |
| `src/components/public/public.module.css` | **1,017** | 7 | 54 | not mentioned |
| `src/components/marketing/marketing.module.css` | **688** | 3 | 35 | not mentioned |
| `src/components/portal/results.module.css` | **378** | 1 (`results-screen.tsx:11`) | 24 | 378 ✓ **exists** |
| `src/components/portal/team-screen.module.css` | **123** | 1 (`team-screen.tsx:32`, as `teamStyles`) | 6 | 123 ✓ **exists — exact** |
| `src/app/error.module.css` | **80** | 1 (`src/app/error.tsx:5`) | 6 | not mentioned |
| **Total** | **7,196** across **6** modules, imported by **49** distinct files | | | |
| `src/app/globals.css` | 141 | root layout `:4` | **68** custom-property declarations, all inside the single `:root` at `1-74` | "68 design tokens" ✓ **exact** |

Both §4.1 assertions (`:147`) reproduce **exactly**, and RV-E's "no BLOCKER here" on `team-screen.module.css` is **UPHELD**. RV-E's inventory totals (7,196 / 49 / 6 modules) also **UPHELD**. §4.1's own blind spot stands as RV-E left it: it discusses only 4,910 of the 7,196 lines (68%) and never touches `public.module.css` (1,017) or `marketing.module.css` (688), even though `public.module.css` is where 265 of the purge-attributable lines live. Filename-collision check for §4.1 steps 2-3: all five proposed paths are free; `src/components/shared/` contains only `icon.tsx` (no CSS) — **RV-E A4 UPHELD**.

---

## 6. §4.2 `src/runtime/game-offline-sync.ts`

| Item | RV-E | Measured | Verdict |
| :-- | :-- | :-- | :-- |
| File size | 1,222 | **1,222** | **UPHELD / plan exact** |
| `src/runtime/offline/` absent | yes | `ls src/runtime` → **16 flat files, no `offline/`** | **UPHELD** |
| Region → plan target fit | table | grep of top-level declarations: `23-29` consts · `31-136` exported types + `GameOfflineTransport`/`GameOfflinePersistence` · `138-168` **4 error classes** · `170-491` `class GameOfflineStore` · `493-506` `openGameOfflineStore` · `508-562` `parseStateConflictResponse`/`createClientEventId`/`sameJson`/`stableJson`/`eventRequestIdentity` · `564-627` `openDatabase` · `629-645` `Stored*`/`NewQueued*` types · `647-1222` `class IndexedDbGameOfflinePersistence` | **UPHELD** |
| Arithmetic of the gap | 1,222 − (650+60+350) = 162 unallocated | Plan's three targets = **1,060**; actual region sizes: `1-169` = **169** · `170-506` = **337** (vs ~350) · `508-562` = **55** (vs ~60) · `564-1222` = **659** (vs ~650). 169+337+55+659+1 blank = **1,222** — closes exactly. | **UPHELD, refined** |
| What is unallocated | "shared types/interfaces/errors" | **Precisely lines 1–169**: 10 exported types, 2 exported interfaces, 4 exported `Error` subclasses, 5 `IDB` store-name constants. The 162-vs-169 delta is the plan's rounding, not a second gap. A 4th file (`offline/types.ts`) or a re-export barrel is mandatory. | **UPHELD** |
| Consumers | 2 | `grep -rn game-offline-sync src tests` → **exactly 2**: `src/components/public/game-host.tsx:26-31` and `tests/unit/game-offline-sync.test.ts:6-16`. Nothing else — not `scripts/`, not `contracts/`. | **UPHELD** |
| Test coupling | 728 lines, pins internals | **`wc -l` = 728.** Import block pins `GameOfflineStore` (→ sync-engine), `OfflineRequestReuseError`, `OfflineSessionMismatchError` (→ the **unallocated** 1–169 types region) + 5 `type`s (`EventRequestIdentity`, `GameOfflinePersistence`, `QueuedActiveTime`, `QueuedEvent`, `QueuedResult`, `QueuedStateSave`). It implements `GameOfflinePersistence` itself at `:35`. Fixtures via `readFileSync("contracts/fixtures/v1/valid")` at `:29-30` — **no** source-text coupling, confirmed. | **UPHELD** |

**Finding #5 UPHELD at MINOR**, with the sharpest sub-point RV-E under-states: the split strands the error classes and the port interface, i.e. the *contract* of the module, while the two consumers import precisely those. Also worth adding for the plan: §7:240's line-count gate ("Zero files over 400 lines, excluding … `idb-store.ts`") pre-exempts the ~659-line output but **not** the 169-line types file it forgot to allocate — the split as written can't pass its own gate.

---

## 7. §4.3 `game-host.tsx` and the "duplicate handshake"

**Real path:** `src/components/public/demo-game-adapter.tsx` (plan omits the directory), **112 lines**.

| Probe | `game-host.tsx` (932 ✓) | `demo-game-adapter.tsx` (112) | `game-bridge.ts` (84 ✓) |
| :-- | :-- | :-- | :-- |
| `postMessage` | **2**: `:163` (`target.postMessage(message, gameOrigin)`), `:778` | **0** | 0 |
| `addEventListener` / `removeEventListener` | **6 + 6**: `:786` message, `:787` focus, `:788` blur, `:789` online, `:790` offline, `:791` `document` visibilitychange / `:794-799` | **0** | 0 |
| handshake validator | `receiveGameMessage` `:625-757`, protocol checks at `:641-674` (`game.ready.v1` `:641`, version gates `:642-674`) | **0** | `parseGameBridgeMessage` `:24-46`, `isTrustedGameMessage` `:65-75` |
| `createBridgeRequestId` | imported `:34` | imported `:11` | **defined `:77-84`** |
| outbound channel | iframe `postMessage` | **React prop callback only**: `onMessage` `:31`, `useEffectEvent` `:34-36`, `emitFromEffect` `:39,:46-49`, `onMessage(request)` `:69` | — |

**RV-E's finding #3 is UPHELD outright.** The two files are opposite endpoints of one protocol: the host owns every `postMessage`/listener, the adapter owns none and talks through a prop. There is **zero** duplicated handshake. The one genuinely shared helper was **already extracted** to `game-bridge.ts:77-84` and is imported by both — the plan's §4.3 item 3 (`:170` "Eliminate duplicate handshake code") describes work that is finished. §4.3 item 3 should be **deleted**, as RV-E recommends.

**React-coupling objection — verified independently, with two corrections to RV-E's inventory.** `game-host.tsx` contains **13 `useRef` declarations** (`:114-129`) — RV-E counts 12 because it omits `frameRef` (`:114`, a DOM ref, correctly not part of the concern-graph; so "12 non-DOM refs" is right) — **6 `useState`** (`:130` phase, `:131` alert, `:132` bootstrap, `:133` lastHostMessage, `:134` syncState, `:137` queuedCount), and **2 `useEffect`** (`:759`, `:803`). RV-E's "5 `useState` values" is **wrong by one**; its "12 refs" is right only under that reading.

**Is state shared across the proposed `use-game-bridge`/`use-game-sync` boundary? Yes, bidirectionally** (region-scoped symbol scan):

| Region (concern) | Calls / mutates that belong to the *other* concern |
| :-- | :-- |
| `synchronizeQueue` `:259-391` (**sync**) | `deliverConflict` `:233-258` (bridge), `replyToRequest` `:620` (bridge), `postToGame` `:155` (bridge), `updateCurrentBootstrap` `:228`, `setSyncState`, `setQueuedCount` |
| `queueResultOrActiveTime` `:392-438` (sync) | `postToGame`, `savedReplies` |
| `saveServerState` `:590-619` (sync) | `replyToRequest`, `synchronizeQueue`, `setSyncState` |
| `receiveGameMessage` `:625-757` (**bridge**) | `synchronizeQueue` (sync), `store.discardConflictedStateBranch`, `pendingConflict`, `inFlightSaves`, `savedReplies`, `bootstrapRef`, `synchronizeRef`, `receiveRef` |
| `deliverConflict` `:233-258` (bridge) | `setSyncState`, `pendingConflict`, `handledConflicts` |
| `bootstrapDemo/Server/beginBootstrap` `:439-519` | `synchronizeQueue`, `getOfflineStore` |
| render body `:753-757` | `receiveRef.current = receiveGameMessage` re-assigned every render — a live stale-closure workaround that must survive extraction |

**Verdict: the split is NOT mechanical — it requires behaviour changes.** Seven of the twelve refs and five of the six states are touched from both sides; the two concern-groups call each other by name in both directions; and the existing ref-indirection is a closure-ordering hack, not architecture. Extracting two hooks means inventing an owner for `pendingConflict` and injecting callbacks both ways. **RV-E A6's hook-split objection UPHELD, MAJOR** (my only quarrel is `5 useState` → 6). Its "JSX is only 96 lines (`:837-932`)" is **exact** (`return (` at `:837`, file ends `:932`), which is what makes the plan's "~250-line presentational component" an unexplained +154 lines of prop plumbing.

---

## 8. §4.4 `src/application/adult-portal/service.ts`

`wc -l` = **616** ✓ (plan exact). Structure by top-level declaration grep: `49-109` **6 module-level free functions** (`authorizationActor`, `activeOrganizationIds`, `effectiveRole`, `requireActor`, `notFound`, `forbidden`), `111` `class AdultPortalService`, `616` close.

| Metric | Measured | RV-E | Verdict |
| :-- | :-- | :-- | :-- |
| Public methods | **17** (`getShell` 121, `getOverview` 209, `listOrganizations` 235, `getOrganization` 256, `createOrganization` 282, `changeOrganizationStatus` 291, `listTeam` 309, `listProvisionedProfiles` 321, `assignOrganizationAdministrator` 337, `assignTeacher` 373, `changeMembership` 403, `listClasses` 447, `getClass` 482, `createClass` 495, `changeClassStatus` 506, `assignTeacherToClass` 520, `deactivateTeacherAssignment` 569) | 17 | **UPHELD** |
| Private members | **3**: `actor` 114, `assertActiveOrganization` 589, `assertActiveProfile` 603 | 3 | **UPHELD** |
| `getShell()` contains navigation construction | **YES** — `:121`; `navigation: PortalShellDto["navigation"]` literal at `:140-148`, role-gated `navigation.push(...)` at `:149-164` and `:165-195`, returned in the DTO at `:205`. Pure inputs are `effectiveRole(actor)` (`:74-91`) and `activeMemberships` (`:124-128`) — exactly the free-function shape a presenter needs. | 121 / 140-195 | **UPHELD, exact** |
| `this.actor(` call sites | **17** (every public method) | 17 | **UPHELD** |
| Guard call sites | **8** = `assertActiveOrganization` ×4 (`:345, :385, :413, :501`) + `assertActiveProfile` ×4 (`:346, :386, :417, :436`) | "6×" at lines 345,346,385,386,413-417,436,501 | **UPHELD as to reach, mis-stated as to count** — 8 invocations, and RV-E's own line list contains all 8 |
| Public methods touching a guard | **4 of 17** (`assignOrganizationAdministrator`, `assignTeacher`, `changeMembership`, `createClass`) | implied cross-domain | **Confirmed and quantified**: guard use is org/team **and** class (`:501` in `createClass`), so `team-service`/`class-service` would both need `organization` guards → a shared `authorization-guards.ts` **is** realistic |
| `getOverview` → `this.getShell` | `:211`, 1 site | 211 | **UPHELD** — and this is the unanswered ownership question (post-split `getShell` cannot live in `organization-service` if `getOverview` calls it) |
| §2.1: "6 active importing screens" of `ActivityStatus` | **Only 2 files import `ActivityStatus`**: `status-badge.tsx:1` (survives) and `activity-controls.tsx:4` (deleted by §2.3 `:60`). `link-status.ts:3` mentions it in a *comment* only. The 6 named screens import **`StatusBadge`**: 13 files import it, of which **exactly 6 survive** — `class-detail-screen`, `classes-screen`, `organization-detail-screen`, `organizations-screen`, `overview-screen`, `team-screen`. | "wording WRONG, substance right" | **UPHELD**, and *strengthened*: RV-E's own report doesn't note that the plan's 6-name list is a **perfect** match for the transitive consumer set. This is a mislabelled dependency edge, not a wrong list — and §2.1's relocation prerequisite stays necessary and sufficient. MINOR. |

**3-service split realism:** the split is workable but its stated glue is the wrong glue. Only 4/17 methods hit the two `assertActive*` guards; the genuine 17/17 chokepoint is `private actor()` (`:114`) plus the 6 free functions at `49-109`, which are **already** module-level and move verbatim. So `authorization-guards.ts` is the cheap part; the expensive unmodelled parts are (a) shell/navigation ownership, and (b) `:5` `@/generated/prisma/enums` + `:11` `@/server/authorization/v1-policy` — an application layer importing Prisma enums and the policy engine, i.e. a dependency-direction inversion the 3-way split **replicates three times** instead of removing. **RV-E A7 UPHELD** including its dependency note; severity MINOR on the split, MODERATE on the inherited layering violation.

---

## 9. §5 — Tailwind strategy

| Plan/RV-E assertion | Measured | Verdict |
| :-- | :-- | :-- |
| Tailwind not installed | `package.json` → **12** `dependencies`, **11** `devDependencies`, **zero** tailwind/postcss/autoprefixer entries. `find -maxdepth 2 -name tailwind.config.* -o -name postcss.config.*` (excl. `node_modules`) → **0**. `grep -rn '@tailwind\|@theme\|@apply\|@import "tailwind' src` → **0**. | **CONFIRMED — absent.** (RV-E says "deps = 14 entries"; actual is 12 + 11. Immaterial to the conclusion.) |
| `node_modules/tailwindcss` is transitive | `package-lock.json`: `node_modules/tailwindcss@4.2.1` is a dependency of **`@neondatabase/auth-ui@0.3.0-beta`**, itself pulled by `@neondatabase/auth@0.5.0-beta` (the direct dep in `package.json`). A second, unrelated `@react-email/tailwind@2.0.7` wants `tailwindcss ^4.1.18`. | **UPHELD** — and it is 4.2.1, i.e. Tailwind **v4**, so RV-E's finding #7 stands. |
| `@media print` exists only at `portal.module.css:4355` | `grep -rn '@media print' src` → **1 hit**, `portal.module.css:4355`. Block spans **4355–4391** (RV-E's "4355–4392" is off by one at the closing brace). Content verified: `:global(body) > *` `:4356`, `.printSheet, .printSheet *` `:4360`, `.printSheet:not([data-player-print-active])` `:4365`, `.credentialPrintCard` `:4381`, `.credentialPrintCard img` `:4388`. Live consumers: `player-credential-print-sheet.tsx:117` (`styles.printSheet`) and `:134` (`styles.credentialPrintCard`) — RV-E's `:117` exact. The plan's "print stylesheets would need Tailwind overrides" premise is **real, single-site, and 37 lines**. | **UPHELD** |
| "Rewriting JSX in **30+** components" | `find src/components -name '*.tsx'` = **33**; `find src/app -name '*.tsx'` = **44** more; **49** files import a CSS module. | **CONFIRMED** — understated if anything (84 `.tsx` files, 49 of them styled). |
| "must be mapped into `tailwind.config.ts` theme extensions" | Stale for the v4 the tree pins (CSS-first `@theme`; `tailwind.config.ts` optional/legacy). | **RV-E finding #7 UPHELD** — MINOR factual slip; it does not move §5.3's verdict. |
| §5.3 "Do NOT do a full Tailwind rewrite this sprint" | Independently consistent with the measured surface: 7,196 CSS lines / 6 modules / 49 styled files / 1 hand-written print stylesheet using a `:global()` visibility trick / 68 tokens. | **UPHELD — recommendation stands.** RV-E's Part B.5 ("3–5 days is understated, 8–12 honest") is a judgment call on un-executable ground; I can neither reproduce nor refute it read-only, but note it *strengthens* the plan's conclusion, so it is not a defect. |

**Not verifiable read-only:** the "4–6 hours" vs "3–5 days" effort cells and RV-E's "1.5–2 days"/"1–2 days" counter-estimates. Neither number is a measurement. What *is* measurable and constrains them: §4.1 as written requires (i) a usage map to find 694 already-dead lines the purge doesn't reach, (ii) surgery on 22 mixed blocks, (iii) re-pointing 9 surviving files for primitives, (iv) renaming 2 of its 6 named primitives that don't exist — four items, and §6 Day 3 (`:224-227`) also carries §4.2 + §4.3 + §4.4 in the same day. **RV-E finding #8 (Day-3 packing) UPHELD, MAJOR (planning)** — the four §4 tasks have 3 confirmed hard blockers that are *discovery* work (orphan audit, `.card`/`.badge` rename, `getShell` ownership), not typing work.

---

## 10. MASTER VERDICT TABLE

| # | Claim under review | RV-E's number | **My independent measurement** | Verdict of **RV-E's** finding | Corrected severity |
| :-- | :-- | :-- | :-- | :-- | :-- |
| 1a | §4.1:150 "~1,570 lines of dead CSS" is not reproducible from the purge | 1,263 purge-attributable + 694 orphans; "1,570 reachable only by merging" | purge-attributable = **1,330** (strict blocks) / **1,357** (per-selector) / **1,567 physical lines removed incl. blank separators**; orphans = **694** | **OVERSTATED → headline REFUTED.** Plan is within 0.2% under a defensible reading; RV-E's own 1,263 is 5.3% low | MINOR (wording of "dead CSS" + 694 unscoped) — **not MAJOR** |
| 1b | RV-E's 1,263 | 1,263 | 1,330 — the entire 67-line shortfall is `public-state.tsx`'s 56 lines + 11 portal lines | **REFUTED as stated** | — |
| 1c | RV-E's 694 pre-existing orphans | 694 (641 + 53) | **694** (641 + 53); also 63 + 4 names, 106 + 8 rules — exact on all three axes | **UPHELD — reproduces to the line** | kept as a real unbudgeted work item |
| 1d | RV-B F-10 "52 of 319 classes purge-attributable" | (52 / 63) | **81** tokens (77 with fully-dead blocks); **63** never-referenced ✓ | RV-B **REFUTED** on 52, **UPHELD** on 63 | — |
| 2 | Naive purge breaks **29** shared classes; `.button .input .field .toolbar .toast` among them | 29 | **27** (+1 in `public.module.css` = 28). `.reportPanel`/`.reportPanelHeader` are **cross-module ghosts**, not shared — purge-attributable. The 5 exemplars all confirmed. | **OVERSTATED** (count) / **UPHELD** (hazard real) | MODERATE (was MAJOR-adjacent) |
| 2b | Mixed prelude `.input, .textarea` at `:1127`; `.completionRing`, `.srOnly`, `.textarea` also mixed | `:1127-1128` | `:1125-1128` is a **4-selector** prelude (`.searchField input, .select, .input, .textarea`), 11-line block. `.textarea` ✓ mixed; `.completionRing` (`2056/2067/2076`) and `.srOnly` (`2841`) are **clean single-selector blocks**. Full inventory: **22 mixed blocks / 148 lines** | **UPHELD** for `.input`/`.textarea`; **REFUTED** for `.completionRing`/`.srOnly` | MINOR |
| 2c | Dynamic ``styles[`tone${…}`]`` defeats grep-based deadness | 2 sites; `.tone*` at `983-1007` | Exactly **2** dynamic accesses repo-wide: `activity-mark.tsx:22`, `materials-explorer.tsx:92` (both **deleted**); `.toneBlue/Orange/Aqua/Purple/Green` at `983-1006`. Because both users die **and** grep already sees them as orphans, they are safe under either model | **UPHELD** (method caveat) / **REFUTED** (implied risk) | none — noise |
| 3 | `.card` and `.badge` do not exist; `.button .buttonGhost .input .field` do; analogues are `.panel`/`.statusBadge` | 0 / 0 declared; `.panel` 1425-region, `.statusBadge` `1038`+`status-badge.tsx:31` | `.card` **0**, `.badge` **0** across all 6 modules + `globals.css`, and `styles.card`/`styles.badge` **0** references. Other 4 exist (`.button` 712/723/742/757, `.buttonGhost` 714/725/744/751, `.input` 1127/1143, `.field` 1612 **+ marketing.module.css:527**). `.statusBadge` **1038** / `status-badge.tsx:`**31** exact. `.panel` at **1406/1416**, and **`.panel` is purge-attributable dead itself** (only `activity-builder.tsx:125`) → RV-E's proposed substitute is wrong; live analogue is `.managementPanel` (`:3598`) | **UPHELD** (finding #2) + **its remedy REFUTED** (new) | MAJOR kept |
| 3b | Primitives extraction is a wide edit: family = 22 files, 11 surviving | 22 / 11; `.field` 10 files/32 refs | **20 files, 9 surviving**; `.field` = **8 files / 27 refs** (module-scoped). `.button` 14/17, `.buttonGhost` 8/12, `.input` 7/14 reproduce **exactly** | **UPHELD** (conclusion) / **OVERSTATED** (~18% magnitude) | MINOR |
| 4 | §4.1 "4,910 lines (308 distinct classes)" — 308 matches no method | 4,910 ✓; 315 / 319; 251 referenced; 674 occurrences | 4,910 ✓ exact. **315** (`^\.` dedupe) ✓, **319** (any-dotted dedupe = my declared set) ✓, **317** depth-0 (RV-E didn't try), **674** occurrences ✓, **693** rule blocks, **256** declared&referenced (RV-E's 251 is 5 low). **308 matches none** of 8 methods | **UPHELD**; correct denominator = **319** declared (256 live) | MINOR |
| 5 | `team-screen.module.css` 123 and `results.module.css` 378 exist | 123 ✓ / 378 ✓ | **123** ✓ (1 importer, 6 names) / **378** ✓ (1 importer, 24 names). Full surface: 6 modules, **7,196** lines, **49** importers; `globals.css` 68 tokens in one `:root` | **UPHELD / plan exact** | — |
| 6 | §4.2 split leaves ~162 unallocated; no `offline/types.ts`; test imports break | 1,222 ✓; 162 = 1–169 types/errors; test 728 | 1,222 ✓; regions **169 / 337 / 55 / 659** summing to 1,222 exactly; plan targets 650/60/350 = 1,060, gap 162 ✓; `src/runtime/offline/` absent ✓; consumers exactly **2**; test = 728 lines, pins `GameOfflineStore` + 2 error classes + 5 types, fixtures via `readFileSync` (no path coupling) | **UPHELD** | MINOR (add §7-gate corollary: 169-line types file isn't exempted) |
| 7a | §4.3:170 "eliminate duplicate handshake" is FALSE | adapter 112 lines, 0 postMessage/listener; `createBridgeRequestId` already at `game-bridge.ts:77` | `src/components/public/demo-game-adapter.tsx` **112**; **0** `postMessage`, **0** `addEventListener`; host: `postMessage` `163`/`778`, `addEventListener` `786-791`; `createBridgeRequestId` defined `game-bridge.ts:77-84`, imported `game-host.tsx:34` + `demo-game-adapter.tsx:11`; `game-bridge.ts` **84** ✓ | **UPHELD outright** | **MAJOR (credibility)** — step should be deleted |
| 7b | Hook split non-mechanical: 12 refs / 5 states cross-mutated; JSX only 96 lines | 12 refs, 5 useState, refs `:114-129`, JSX `837-932` | **13** `useRef` (`114-129`; 12 excl. DOM `frameRef`), **6** `useState` (not 5), **2** `useEffect`; 7/12 refs and 5/6 states touched from both sides; `synchronizeQueue→deliverConflict/postToGame/replyToRequest` and `receiveGameMessage→synchronizeQueue/discardConflictedStateBranch` both ways; `receiveRef.current=` re-assigned every render at `753-757`. JSX = **96** lines (`837-932`) exactly | **UPHELD** (2 inventory nits) | **MAJOR** |
| 8a | §4.4 `getShell()` really holds navigation | 121; nav at 140-195 | `getShell` **121**; navigation array literal **140-148**, role-gated pushes **149-195**, returned **205**; inputs `effectiveRole` `74-91` + `activeMemberships` `124-128` | **UPHELD, exact** | — |
| 8b | §2.1 "6 screens import ActivityStatus" — they import StatusBadge | wording wrong, substance right | `ActivityStatus` imported by **2** files only (`status-badge.tsx:1`, `activity-controls.tsx:4`); `StatusBadge` imported by **13**, of which exactly **6** survive and match the plan's list 1:1 | **UPHELD**, refined | MINOR |
| 8c | 3-service split: 17 public methods + 3 guards, guards cross domains | 17 + 3; guards "called 6×" | 17 public ✓ + 3 private ✓ + 6 free helpers ✓; `this.actor(` **17×**; guards **8** invocations (4+4) in **4/17** methods incl. `createClass:501`; `getOverview:211 → this.getShell` | **UPHELD**, count corrected (6→8) | MINOR→MODERATE for the unmodelled shell-ownership + `enums`/`v1-policy` layering inversion |
| 9a | Tailwind absent | not installed; transitively `tailwindcss@4.2.1` via `@neondatabase/auth-ui` | 0 direct deps, 0 configs, 0 directives; `tailwindcss@4.2.1` is a dep of `@neondatabase/auth-ui` ← `@neondatabase/auth@0.3.0-beta`; second requester `@react-email/tailwind` | **UPHELD** | — |
| 9b | `@media print` only at `:4355` | `4355-4392`, consumer `:117` | **1** hit repo-wide, block `4355-4391`; consumers `printSheet:117`, `credentialPrintCard:134` | **UPHELD** | — |
| 9c | "30+ components" | 33 (+44 in `src/app`), 49 styled files | `src/components/**/*.tsx` = **33**; `src/app/**/*.tsx` = **44**; module importers = **49** | **UPHELD** | — |
| 9d | `tailwind.config.ts` advice is v3-era | MINOR slip | Repo pins v4 (CSS-first `@theme`) | **UPHELD** | MINOR |
| 10 | §6 Day 3 packs four multi-day tasks | MAJOR (planning) | §4.1 needs 4 discovery work-items (694-line orphan audit, 22 mixed blocks, 9-file re-point, 2 fabricated primitive names) **plus** §4.2's unallocated types file **plus** §4.3's non-mechanical 13-ref split **plus** §4.4's shell ownership | **UPHELD** | **MAJOR** |

**Roll-up: of RV-E's 8 numbered findings — 4 UPHELD outright (#3 duplicate-handshake, #4 class counts, #6 ActivityStatus wording, #7 Tailwind-v4 + #8 Day-3), 2 OVERSTATED (#1 headline arithmetic, #2 primitives `.card`/`.badge` right but magnitudes wrong), 1 partially REFUTED (#5's severity framing — the plan's number actually reproduces), and its shared-class count (#2 in my table) corrected 29 → 27. Every single line count RV-E asserted (4,910 / 378 / 123 / 1,222 / 932 / 84 / 112 / 616 / 728 / 1,188 / 92 / 23 / 7 / 7 / 364 / 68) reproduces exactly.**

---

## 11. What RV-E missed (found while trying to refute it)

1. **`public-state.tsx` is worth exactly 56 lines of purge-attributable CSS** — the whole public-module discrepancy (265 vs 209): `.stateCard` 653-666, `.stateIcon` 668-676, `.stateIcon svg` 678-681, `.stateCard h1` 683-690, `.stateCard p` 692-697, `.stateActions` 699-705, plus nested `.gameStageHeader h1, .stateCard h1` 927-930 and `@media` `.stateCard` 993-996. A purge scoped to "the `atividade/[token]` tree" as RV-E phrases it drops a deleted component that lives outside that tree. Residual portal delta is smaller and unattributed: mine 81 tokens / 166 rules / 1,065 lines vs RV-E's 79 / 164 / 1,054 (+2 / +2 / +11) — RV-E does not disclose its per-rule spans, so I cannot say which two blocks it lost.
2. **Cross-module name collisions are RV-E's systematic error and it recurs 3×**: `.reportPanel`/`.reportPanelHeader` (portal vs `results.module.css:132/139`), `.field` (portal `:1612` vs `marketing.module.css:527`), `.primary` (public `:260` vs `error.module.css:62`). Any token-name-based dead-CSS audit in this repo will mis-file these; the purge tool must resolve `styles` → the imported file. RV-E prescribes no such tool and its own counts show why one is needed.
3. **Three real ghost classes (referenced, declared nowhere in the binding module)** — beyond RV-E's single `materialAudience` note: `styles.materialAudience` (`materials-explorer.tsx:105`, deleted, **0 declarations repo-wide**), `styles.mobileNavItem` (`portal-navigation.tsx:37`, **survives**, `:global`-free and declared nowhere → emits a literal `undefined` token into `class`), `styles.entryProblem` (`player-entry-screen.tsx:143,162,181`, **survives**; only `.entryProblemIcon` exists at `public.module.css:842`). Two of these are **live rendering bugs today**, and §4.1's "zero visual breakage" (`:189`) inherits them.
4. **`.panel` is purge-attributable dead**, so RV-E's answer to its own Open Question 3 is wrong; and `.panelTitle`/`.panelDescription`/`.sidePanel*` die with `activity-builder.tsx`. The surviving panel/badge primitives are `.managementPanel`, `.statusBadge`, `.summaryCard`, `.stateCard`.
5. **0 surviving components are imported only by deleted files** — so the purge's CSS footprint is closed and computable, contradicting the "±10%, unknowable" posture of RV-E's A3. Combined with finding #6, this is what makes my 1,357/1,567 defensible as a *point estimate*.
6. **No plain-string `className` exists in `src/`** (0 hits) and only 2 dynamic `styles[` sites — so the usage map is exhaustive, not approximate. RV-E's "grep-based deadness is unreliable" is more wrong than it argues.
7. **§4.1 addresses 68% of the CSS surface at most**: `public.module.css` (1,017 lines, 30% of all purge-attributable lines = 265/1,357) and `marketing.module.css` (688) are outside §4.1 entirely; §7:240's "zero files over 400 lines" gate therefore also condemns `public.module.css` (1,017) and `marketing.module.css` (688), which no §4 task splits. Nobody raised this.
8. **§7:240's line gate pre-exempts `idb-store.ts` but not §4.2's stranded 169-line types region** — the split as specified cannot pass the plan's own success criterion.

---

## 12. Net scorecard

| Axis | RV-E | Me |
| :-- | :-- | :-- |
| Dead CSS attributable to the purge | 1,263 (±10%) | **1,330 blocks / 1,357 per-selector / 1,567 physical** (±3%) |
| Already-dead orphan CSS | 694 | **694 — exact match** |
| Purge-attributable class names | 90 (79 + 11) | **95** (81 + 14) |
| Shared deleted/surviving class names | 29 | **27** (+1 public = 28) |
| Mixed preludes needing surgery | "e.g. `.input, .textarea`" (1 named) | **22 blocks / 148 lines**, inventoried |
| portal.module.css class universe | 315 / 319 / 251 | **315 / 319 / 317 / 256 / 674 / 693** |
| Duplicate handshake | none | **none — confirmed 0/0** |
| refs / states in game-host | 12 / 5 | **13 (12 non-DOM) / 6**, 2 `useEffect` |
| Headline severity | MAJOR ×3 | **1 MAJOR (§4.3 phantom step), 1 MAJOR (Day-3), 1 MAJOR (non-mechanical hook split), 1 MAJOR (.card/.badge fabricated), 2 MINOR, 2 corrected downward** |

RV-E earns its keep on **structure** — every existence/line-count assertion is exact, and the three "the plan describes work that is already done or that doesn't exist" findings (§4.3 handshake, `.card`/`.badge`, `offline/types.ts`) all reproduce. It loses on **arithmetic and scoping discipline**: it built the 1,570-vs-1,263 conflict partly out of its own exclusion rule, missed a deleted file's 56 lines, and counted shared classes by name rather than by CSS-module, which is the one thing a `.module.css` purge must not do.

---

## Appendix A — raw commands (rerunnable, read-only)

All run from `C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal` in Git Bash. Scratch scripts are in `C:\tmp\` (**outside the repo**); nothing under `src/`, `tests/`, `docs/` was created or modified by this verification other than this file.

### A1. Deletion population and sizes
```bash
wc -l REFACTOR_PLAN.md
find "src/app/(professional)/portal/atividades" -type f | xargs wc -l | tail -1   # 1188
find "src/app/(professional)/portal/materiais"   -type f | xargs wc -l | tail -1   # 92
find "src/app/(professional)/portal/modulos"     -type f | xargs wc -l | tail -1   # 23
find "src/app/(professional)/portal/admin/jogos" -type f | xargs wc -l | tail -1   # 7
find "src/app/(professional)/portal/admin/modulos" -type f | xargs wc -l | tail -1 # 7
find "src/app/(public-play)/atividade"           -type f | xargs wc -l | tail -1   # 364
for f in src/server/services/portal-view-service.ts src/server/services/access-link-service.ts \
  src/server/db/prisma-access-link-store.ts src/server/services/public-link-service.ts \
  src/server/services/link-status.ts src/server/services/audit-actions.ts \
  src/server/services/authorization-service.ts src/server/db/prisma-capability-reader.ts \
  src/server/security/tokens.ts src/components/portal/activity-builder.tsx \
  src/components/portal/activity-controls.tsx src/components/portal/activity-mark.tsx \
  src/components/portal/material-editor.tsx src/components/portal/materials-explorer.tsx \
  src/components/portal/class-groups-explorer.tsx src/components/portal/share-actions.tsx \
  src/components/public/public-state.tsx; do printf "%6s %s\n" "$(wc -l < $f)" "$f"; done
```

### A2. Token extraction and module binding
```bash
# every CSS-module import in src (identifier -> module); 49 distinct importing files
grep -rn --include=*.tsx --include=*.ts -E "^import .* from ['\"].*\.module\.css['\"]" src | sort -u
# deleted files that import a CSS module (expect 17)
while read f; do grep -qE '\.module\.css' "$f" && echo "$f"; done < /tmp/deleted_files.txt
# exhaustive dynamic access sweep
grep -rn --include=*.ts --include=*.tsx -E '\b[A-Za-z0-9_]*[Ss]tyles\[' src
# prove there is no non-module escape hatch
grep -rn 'className="' src --include=*.tsx | grep -v styles          # -> 0
grep -rn 'className={`' src --include=*.tsx | grep -v styles         # -> 0
```

### A3. The scripts
```
C:\tmp\m1_usage.py     per-module token sets (dead_only / shared / alive_only) -> C:\tmp\usage.json
C:\tmp\m2_transitive.py full import graph; transitively-dead survivors (= 0)
C:\tmp\m4_measure.py   brace-matched CSS parser + first-pass buckets
C:\tmp\m5_final.py     A/B/C/D/E bucket accounting -> C:\tmp\final_css.json   (M1, orphans)
C:\tmp\m6_variants.py  V1..V7 sensitivity variants around 1,570
C:\tmp\m7_selector.py  per-selector (comma-split) removability + PARTIAL list
m9 / heredoc runs      depth-0 counts, physical-lines-with-blanks (1,567), ghost-class list
```
Reproduce the headline with:
```bash
python C:/tmp/m1_usage.py | head -20      # 81 purge-attributable / 27 shared (portal)
python C:/tmp/m5_final.py                 # A=1065+265=1330, C=641+53=694, B=147
python C:/tmp/m7_selector.py | tail -6    # per-selector 1357
# physical lines incl. blank separators: run the "blocks/content/blank" heredoc -> 1092+169 + 265+41 = 1567
```

### A4. Counting methods for `portal.module.css`
```bash
F=src/components/portal/portal.module.css
wc -l $F                                                    # 4910
grep -oE '^\.[A-Za-z_][A-Za-z0-9_-]*' $F | sort -u | wc -l   # 315
grep -oE '\.[A-Za-z_][A-Za-z0-9_-]*' $F | sort -u | wc -l    # 319
grep -cE '^\.' $F                                            # 674 occurrences
grep -rhoE 'styles\.[A-Za-z0-9_]+' src --include=*.ts --include=*.tsx | sed 's/styles\.//' | sort -u | wc -l   # 330 all modules
grep -rl 'portal\.module\.css' src --include=*.tsx --include=*.ts | xargs grep -hoE 'styles\.[A-Za-z0-9_]+' | sed 's/styles\.//' | sort -u | wc -l  # 258
grep -n '@media print' -r src                                # 1 hit: portal.module.css:4355
```

### A5. §4.1 primitives / §4.2 / §4.3 / §4.4
```bash
for f in $(find src -name '*.module.css') src/app/globals.css; do
  grep -nE '(^|[,[:space:]{}])\.(card|badge|panel|statusBadge|button|buttonGhost|input|field)($|[^A-Za-z0-9_-])' "$f"; done
grep -rn --include=*.tsx -E 'styles\.(card|badge)\b' src     # -> NONE
grep -rn --include=*.tsx -E 'styles\.panel\b' src            # -> activity-builder.tsx:125 only
sed -n '1120,1150p;1400,1440p;2818,2845p;4350,4395p;4818,4846p' src/components/portal/portal.module.css
grep -nE '\.(reportPanel|reportPanelHeader|field|primary)' src/components/portal/results.module.css \
  src/components/marketing/marketing.module.css src/app/error.module.css   # cross-module collisions

grep -nE '^(export )?(class|interface|type|const|function)|^}' src/runtime/game-offline-sync.ts | head -80
ls src/runtime ; ls src/runtime/offline                      # absent
sed -n '1,35p' tests/unit/game-offline-sync.test.ts          # 728-line test's import block
grep -rn 'game-offline-sync' src tests                       # exactly 2 consumers

find src -name 'demo-game-adapter*' -exec wc -l {} \;        # 112
grep -nE 'postMessage|addEventListener|removeEventListener|MessageEvent|handshake' \
  src/components/public/game-host.tsx src/components/public/demo-game-adapter.tsx
grep -n 'export function createBridgeRequestId' src/components/public/game-bridge.ts   # :77
grep -nE 'const \[[^]]+\] = useState|const [a-zA-Z0-9_]+ = useRef|^\s*useEffect\(' \
  src/components/public/game-host.tsx                        # 13 refs / 6 states / 2 effects

grep -nE '^\s{2}(private |async )*[a-zA-Z0-9_]+\(' src/application/adult-portal/service.ts
grep -c 'this\.actor(' src/application/adult-portal/service.ts          # 17
grep -n  'this\.assertActive\(Organization\|Profile\)(' src/application/adult-portal/service.ts   # 8
sed -n '121,208p' src/application/adult-portal/service.ts               # navigation 140-195
grep -rn 'ActivityStatus' src | grep -v node_modules                    # 2 importers only
grep -rln 'status-badge' src | sort                                     # 13 files, 6 surviving

grep -in 'tailwind\|postcss' package.json ; find . -maxdepth 2 -name 'tailwind.config.*' -o -maxdepth 2 -name 'postcss.config.*' | grep -v node_modules
grep -rn '@tailwind\|@theme\|@apply' src                                  # 0
node -e "const p=require('./package-lock.json').packages;for(const[k,v]of Object.entries(p))if(v.dependencies&&v.dependencies.tailwindcss)console.log(k,v.dependencies.tailwindcss)"
find src/components -name '*.tsx' | wc -l ; find src/app -name '*.tsx' | wc -l
find src -name '*.module.css' -exec wc -l {} \; | sort -n
```

## Appendix B — the 27 module-scoped shared class names in `portal.module.css`

`button, buttonDanger, buttonGhost, buttonSecondary, cardFooterLink, classGroupCard, classGroupFacts, classGroupGrid, classGroupMark, classGroupTopline, detailPanel, eyebrow, field, fieldHelp, filterGroup, iconButton, input, muted, searchField, sectionHeader, select, stateActions, summaryCard, summaryStrip, textLink, toast, toolbar`
(+ `primary` in `public.module.css` = 28 repo-wide.)
Removed from RV-E's 29: `reportPanel`, `reportPanelHeader` (surviving references bind to `results.module.css:132`/`:139`, not `portal.module.css`).
