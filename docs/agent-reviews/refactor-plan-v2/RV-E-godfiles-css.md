# RV-E — Adversarial Review: §4 God Files + §5 CSS Strategy

Reviewer scope: `REFACTOR_PLAN.md` v2.0 §4.1–§4.4 and §5. Method: read-only inspection
(`wc -l`, `grep`, one-shot Python AST-free CSS parser run over stdin; no files created in
`src/`/`tests/`). All line numbers below are `wc -l` newline counts unless stated otherwise.

Date of measurement: 2026-09-23 working tree (`C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal`).

---

## PART A — MEASURED FACTS

### A1. §4.1 line/class counts of CSS modules

> Claim: "4,910 total lines (308 distinct classes). Note that `results.module.css` (378 lines)
> and `team-screen.module.css` (123 lines) already exist."

| Item | Plan | Measured | Verdict |
| :-- | :-- | :-- | :-- |
| `src/components/portal/portal.module.css` lines | 4,910 | **4,910** | CONFIRMED |
| `results.module.css` lines | 378 | **378** (`src/components/portal/results.module.css`) | CONFIRMED |
| `team-screen.module.css` lines | 123 | **123 — the file EXISTS** (`src/components/portal/team-screen.module.css`) | CONFIRMED (no BLOCKER here) |
| distinct classes in portal.module.css | 308 | **315** distinct top-level class rule names; **319** distinct dotted names incl. descendant/compound selectors; 674 class-rule occurrences | PARTIAL — **MINOR** (308 matches no natural counting method; off by 7–11, ≈2%) |

Counting method disclosed: (a) `grep -oE '^\.[A-Za-z_][A-Za-z0-9_-]*'` deduped = 315;
(b) `grep -oE '\.[A-Za-z_][A-Za-z0-9_-]*'` anywhere in the file deduped = 319. The only other
defensible number is "class names actually referenced via `styles.X` anywhere in `src/`" = 251.
None equals 308 exactly.

Full inventory of existing CSS modules (all 6, `wc -l`):
portal 4,910 · public 1,017 · marketing 688 · results 378 · team-screen 123 · error (`src/app/error.module.css`) 80. **Total 7,196 lines, imported by 49 files.**

### A2. Design tokens in `globals.css`

> Claim: "All 68 design tokens remain in `src/app/globals.css` `:root`" and
> "(never move `:root` to a CSS module, as modules only inject when imported)".

- Measured: `grep -oE '^\s*--[A-Za-z0-9-]+:' src/app/globals.css` → **68 custom properties, all
  68 inside the single `:root` block** (`src/app/globals.css:1-74`). No `@theme`, no `@layer`, no
  second token block. **CONFIRMED — exact.**
- Adjacent detail: `portal.module.css:7,334,339` define 3 *local* custom properties
  (`--focus-ring-color`, `--portal-skeleton-base/shine`) — component-scoped, not design tokens.
- The "modules only inject when imported" warning is technically accurate, and the setup matches
  it: `src/app/layout.tsx:4` has a side-effect global import `import "./globals.css";` in the root
  layout, so `:root` is always present while module CSS loads per-import. **CONFIRMED.**

### A3. "~1,570 lines of dead CSS" from the Generation-A purge (§4.1 Execution step 1)

Methodology (scripted, reproducible): build the set of `styles.X` identifiers used by the §2
deletion list (7 `atividades`/`materiais` route pages + 7 deleted components + the 5-file
`src/app/(public-play)/atividade/[token]` tree + `public-state.tsx`); subtract the set used by
every surviving `src/**` `.ts/.tsx` file; then parse `portal.module.css` / `public.module.css`
counting a rule's lines only when **all** class selectors in the rule's prelude are dead-only
(conservative: shared preludes count 0; blank lines and @media wrapper braces not counted).

Measured:

| Bucket | Classes | Rules | Lines |
| :-- | :-- | :-- | :-- |
| Dead-only in `portal.module.css` (used exclusively by deleted portal files) | 79 | 164 | **1,054** |
| Dead-only from deleted `atividade/[token]` tree in `public.module.css` | 11 | 33 | **209** |
| **Strict purge-attributable total** | 90 | 197 | **≈1,263** |
| Pre-existing orphans in `portal.module.css` (declared, referenced by NO file today) | 63 | 106 | **641** |
| Pre-existing orphans in `public.module.css` | 4 | 8 | 53 |
| Union (purge-dead + already-dead orphans, both files) | — | 297 | **≈1,915–1,957** |

Verdict: **PARTIAL / UNDER-SPECIFIED — MAJOR.** ~1,570 is not reproducible from the purge alone
(measured ≈1,263, ±10%: my parser is conservative — counted blocks exclude separated blank/comment
lines; `materialAudience` is referenced by a deleted file but declared nowhere; `.completionRing`,
`.srOnly`, `.textarea` sit partially in mixed preludes, e.g. `.input, .textarea` at
`portal.module.css:1127-1128`, where deletion requires selector surgery, not block deletion).
1,570 is reachable only if you silently merge "killed by the purge" (1,263) with "already-dead
orphan CSS" (≈694) — those are different work items: the purge deletes the former; the latter is
dead **today** and needs a usage audit the plan never mentions.

**Naive-purge hazard (measured):** 29 class names used by deleted files are **also used by
surviving components** — `.button, .buttonGhost, .buttonSecondary, .buttonDanger, .input, .field,
.fieldHelp, .select, .toolbar, .toast, .sectionHeader, .muted, .eyebrow, .searchField,
.filterGroup, .iconButton, .stateActions, .textLink, .cardFooterLink, .summaryCard, .summaryStrip,
.detailPanel, .reportPanel, .reportPanelHeader, .classGroupCard, .classGroupFacts, .classGroupGrid,
.classGroupMark, .classGroupTopline`. A "delete everything the removed files touched" purge would
break `classes-screen.tsx`, `team-screen.tsx`, `status-badge.tsx`, `portal-shell.tsx` etc. Also
`.toneBlue/.toneOrange/.toneAqua/.tonePurple/.toneGreen` (`portal.module.css:983-1007`) are consumed
only via dynamic `styles[`tone${...}`]` (`activity-mark.tsx:22`, `materials-explorer.tsx:92`) —
grep-based deadness is unreliable for these (they happen to be purge-safe since both users die, but
the method flaw stands).

### A4. Proposed new CSS file names & named primitives (§4.1 steps 2–3)

- Collisions: **none.** `src/components/shared/` contains only `icon.tsx` (no CSS); none of
  `primitives.module.css`, `classes-screen.module.css`, `organizations-screen.module.css`,
  `overview-screen.module.css`, `player-access.module.css` exists today. The naming pattern is
  already proven by `results.module.css`/`team-screen.module.css`. CONFIRMED as stated.
- Primitive classes existence in `portal.module.css`:
  - `.button` (712,723,742…), `.buttonGhost` (714,725,744…), `.input` (1127,1143), `.field` (1612) — **exist**.
  - **`.card` — DOES NOT EXIST** (0 declarations in any CSS module in `src/`; nearest live names:
    `.panel` (1425-region), `.summaryCard`).
  - **`.badge` — DOES NOT EXIST** (nearest: `.statusBadge` at `portal.module.css:1038`, used by
    `status-badge.tsx:31`).
  - Verdict: **WRONG on 2 of 6 exemplar classes — MAJOR** (the extraction spec names classes that
    were never in the file; author likely invented plausible names).
- Reference breadth (measured, all of `src`): `.button` 14 files/17 refs; `.buttonGhost` 8/12;
  `.input` 7/14; `.field` 10/32. Union of the button/input/field family: **22 files, of which 11
  survive the purge**. Extraction is therefore a **wide edit** (11+ surviving files must add a
  second module import and re-point every `styles.button`-style reference), not a mechanical file
  move. Severity: MINOR (feasible) but contradicts "JSX classes stay almost identical" (§5.2).

### A5. §4.2 `src/runtime/game-offline-sync.ts` (1,222)

- Measured: **1,222 — CONFIRMED exact.** `src/runtime/offline/` does **NOT exist** today
  (`ls src/runtime` = 16 flat files). CONFIRMED as new-work.
- Actual internal structure (measured line ranges):
  | Region | Lines | Plan target | Fit |
  | :-- | :-- | :-- | :-- |
  | Types, `GameOfflineTransport`/`GameOfflinePersistence` interfaces, 4 error classes | 1–169 (169) | **unallocated** | the "missing" ~162 of (1,222−1,060) |
  | `GameOfflineStore` class (170) + `openGameOfflineStore` (493–~507) | ~338 | `sync-engine.ts` ~350 | excellent |
  | parse/identity helpers (`stableJson` 532, `eventRequestIdentity` 543, `createClientEventId` 519, `sameJson` 528) | 508–563 (56) | `request-registry.ts` ~60 | excellent |
  | `openDatabase` (564) + IDB persistence class (648–1222) | 659 | `idb-store.ts` ~650 | excellent |
- Verdict: split proposal is **structurally accurate — CONFIRMED**, with one gap: **169 lines of
  shared types/interfaces/errors** (≈ the unaccounted 162) go nowhere in the plan; they need a
  fourth file (`offline/types.ts`) or re-export barrel. MINOR.
- Consumers of exports (grep): only `game-host.tsx:26-31` and `tests/unit/game-offline-sync.test.ts:6-16`
  import from `@/runtime/game-offline-sync`. The 728-line test file's import block (lines 6–16)
  pins `GameOfflineStore`, `OfflineRequestReuseError`, `OfflineSessionMismatchError` + 5 types —
  **the split breaks test imports unless the old path stays as a barrel**; fix is 2 files. The test
  reads `contracts/fixtures/v1` JSON via `readFileSync` (lines 29–30), not source text, so no
  hidden path coupling. MINOR.

### A6. §4.3 `game-host.tsx` (932) + `game-bridge.ts` (84) + adapter

- Measured: `game-host.tsx` **932 — CONFIRMED**; `game-bridge.ts` **84 — CONFIRMED**;
  `src/components/public/demo-game-adapter.tsx` **exists, 112 lines** (plan asserts no size).
- "Eliminate duplicate handshake code between `game-host.tsx` and `demo-game-adapter.tsx`":
  **WRONG — MAJOR for plan credibility, small for cost.** The two files are *opposite endpoints*
  of the protocol, not duplicates: `demo-game-adapter.tsx` contains **zero** `postMessage` or
  `message`-listener code (it emits via a React prop callback, lines 34–50); `game-host.tsx` holds
  the only `postMessage` calls (163, 778) and the only handshake validator (`receiveGameMessage`,
  641–674). The one genuinely shared helper, `createBridgeRequestId`, is **already factored** into
  `game-bridge.ts:77-84` and imported by both (`game-host.tsx:34`, `demo-game-adapter.tsx:11`).
  Similar-but-not-duplicate: message-shape construction (`demo-game-adapter.tsx:16-20,46-49,63-68`
  vs `game-host.tsx:70-79,146-151`) — these encode different messages (`game.*` vs `portal.*`) and
  cannot be collapsed without breaking the demo's simulated-client design.
- Hook-split feasibility (`use-game-bridge` / `use-game-sync`): judgment from full read —
  **non-mechanical, MAJOR risk of churn**:
  - `game-host.tsx` carries **12 refs** (`launchRef`, `bootstrapStarted`, `bootstrapRef`,
    `inFlightSaves`, `savedReplies`, `handledConflicts`, `pendingConflict`,
    `offlineStorePromise`, `syncPromise`, `syncRequested`, `synchronizeRef`, `receiveRef`,
    lines 114–129) + 5 `useState` values, cross-mutated by both concern groups.
  - Bidirectional coupling: `synchronizeQueue` (259–390, "sync") calls `deliverConflict` (233–257,
    bridge state), `replyToRequest`/`postToGame` (bridge) and `updateCurrentBootstrap`; the
    "bridge" message handler `game.bootstrap_applied.v1` (676–703) calls
    `store.discardConflictedStateBranch` + `synchronizeQueue` (sync). The ref-indirection already in
    the render body (753–757: `receiveRef.current = receiveGameMessage` on every render) is a
    stale-closure workaround that must survive extraction — two hooks exchanging callbacks through
    refs is delicate under React 19 (`useEffectEvent` is used by the *adapter*, not the host).
  - Direction is still sound: message plumbing (141–231, 439–518, 620–823) vs queueing
    (259–437, parts of 590–618) is a real seam. But "presentational `game-host.tsx` ~250 lines":
    today's JSX is only **96 lines** (837–932); 250 implies heavy prop-threading boilerplate —
    plausible (estimate), and Day-3 budget for this is unrealistic.

### A7. §4.4 `src/application/adult-portal/service.ts` (616)

- Measured: **616 — CONFIRMED.** `getShell()` exists at **line 121**, returns at 207; navigation
  construction genuinely lives there (**140–195**: base item 140–148, role-gated pushes
  149–195). Extracting `portal-navigation-presenter.ts` is realistic — the pure inputs are
  `effectiveRole(actor)` (helper at 74–91) and `activeMemberships` (124–128). CONFIRMED.
- ActivityStatus screens: the 6 named screens (`class-detail-screen`, `classes-screen`,
  `organization-detail-screen`, `organizations-screen`, `overview-screen`, `team-screen`) **do NOT
  import `ActivityStatus` themselves** — they import `StatusBadge` (e.g.
  `classes-screen.tsx:24`), and only `status-badge.tsx:1` imports
  `type ActivityStatus from "@/server/services/portal-view-service"` (plus the two files being
  purged: `activity-controls.tsx`, `link-status.ts`). Verdict: **PARTIAL — wording WRONG,
  substance right** (the transitive dependency chain is real, so the §2.1 relocation prerequisite
  remains necessary). MINOR.
- Split into `organization-service.ts` / `class-service.ts` / `team-service.ts` sharing
  `authorization-guards.ts`: measured — **17 public methods + 3 private guards**
  (`actor` 114, `assertActiveOrganization` 589, `assertActiveProfile` 603) + 6 module-level
  helpers (49–109). Cross-dependencies: `this.actor(` called **17×**;
  `assertActiveOrganization/assertActiveProfile` called **6×** across *membership/team AND class*
  methods (345, 346, 385, 386, 413–417, 436, 501) — i.e. `team-service` would call `organization`
  guards; `getOverview` (209) calls `this.getShell` (211). The guards are near-pure functions over
  `ActorSnapshot`/transaction, so a shared `authorization-guards.ts` module **is realistic, not
  hand-waving** — the helpers at 49–109 are already free functions. Verdict: PARTIAL→workable;
  the unmentioned costs are (a) navigation/shell ownership (org- vs shell-service), (b) the fact
  that this "application" service imports `@/generated/prisma/enums` and
  `@/server/authorization/v1-policy` (lines 1–11) — a dependency-direction violation the refactor
  inherits silently. MINOR (observation, outside stated plan claims).

### A8. §5 Tailwind table — asserted facts only

| Fact claimed | Measured | Verdict |
| :-- | :-- | :-- |
| Tailwind currently used | **NOT installed as a project dependency**: `package.json` deps = 14 entries, none Tailwind-related; no `tailwind.config.*`, no `postcss.config.*`, zero `@tailwind`/`@theme` directives in `src/**/*.css`. `node_modules/tailwindcss@4.2.1` + `tailwind-merge` exist **only transitively** via `@neondatabase/auth-ui`. | CONFIRMED (implicitly) |
| "print stylesheets … QR badge printing" in CSS modules | Exactly **one** `@media print` block, `portal.module.css:4355–4392`, driving the live credential printing (`:global(body) > *` visibility trick, `.printSheet:not([data-player-print-active])`, `credentialPrintCard`) used by `player-credential-print-sheet.tsx:117`. | CONFIRMED |
| "Caramelito tokens … via CSS variables (`--yellow`, `--green-action`)" | Both named vars exist (`globals.css:3,9`); 68 tokens total. | CONFIRMED |
| "Rewriting JSX in 30+ components" | `src/components/**/*.tsx` = **33**; `src/app/**/*.tsx` = 44 more; **49 files** import a CSS module. | CONFIRMED (even conservative) |
| "Must be mapped into `tailwind.config.ts` theme extensions" | Stale for Tailwind v4 (the version this tree already transitively pins, 4.2.x), which is CSS-first (`@theme`) — `tailwind.config.ts` is optional/legacy. | MINOR factual slip |
| Effort "~4–6 hours" CSS-Modules path | See estimate section below. | JUDGMENT: optimistic |
| Effort "3–5 days" Tailwind path over 7,196 CSS lines + print + 49 importers | JUDGMENT: understated, not inflated — 3–5 days for a faithful rewrite of a 4,910-line monolith + 6 modules is a sprint, not a task. The "Very High regression risk" cell is honest. | PARTIAL |

---

## PART B — JUDGMENT ESTIMATES (labeled; not measured facts)

1. **CSS purge safety**: reaching 1,570 lines requires deleting orphan CSS too; B-class estimate:
   doing this without an automated usage map (like the script in A3) will either leave hundreds of
   lines or delete live ones (29 shared classes + mixed preludes + dynamic `tone*`). Budget 1 day,
   not "immediately deletes". 
2. **Primitives extraction**: ~11 surviving files × edit + rename of `.card`/`.badge` spec → adds
   to the "4–6 hours"; realistic total for §4.1 as written: **1.5–2 days**, i.e. it cannot share
   Day 3 with §4.2+§4.3+§4.4 as the roadmap claims.
3. **game-host split**: with 12 refs/5 states, expect a prototype-with-bugs phase; **1–2 days**,
   not a few hours; the "duplicate handshake" step should be deleted from the plan (nothing to
   deduplicate).
4. **adult-portal split**: realistic in half a day; the navigation-presenter move is the cheapest
   item in §4 and is genuinely well-specified.
5. **Tailwind 3–5 days**: more likely 8–12 days incl. print stylesheet re-derivation and visual
   QA; the plan's *conclusion* (don't do it now) survives the bad number.

---

## SEVERITY ROLL-UP

| # | Finding | Severity |
| :-- | :-- | :-- |
| 1 | "~1,570 lines of dead CSS" conflates 1,263 purge-dead + 694 pre-existing orphans; not reproducible as stated; naive purge breaks 29 shared classes | **MAJOR** |
| 2 | `.card` and `.badge` primitives do not exist anywhere in the codebase | **MAJOR** |
| 3 | "Duplicate handshake code between game-host.tsx and demo-game-adapter.tsx" is false (0 postMessage/listener code in adapter; shared helper already extracted) | **MAJOR** |
| 4 | §4.1 "308 distinct classes" matches no counting method (measured 315/319) | MINOR |
| 5 | §4.2 unallocated ~162 lines = shared types/errors; no `offline/types.ts` named; test + host imports must be repointed (no barrel proposed) | MINOR |
| 6 | §4.4 "6 screens import ActivityStatus" — they import StatusBadge transitively; substance holds, wording wrong | MINOR |
| 7 | §5 "tailwind.config.ts theme extensions" is v3-era advice; repo transitively pins Tailwind v4 | MINOR |
| 8 | Day-3 roadmap packs four multi-day tasks (B1–B4 estimates) | **MAJOR (planning)** |
| — | team-screen.module.css **does exist** at exactly 123 lines; 4,910 / 378 / 1,222 / 932 / 84 / 616 / 728 all **exact** | CONFIRMED |

(Out-of-scope observation: §2.2 route line counts are exact (1,188/92/23/7/7/364 all verified by
`find|xargs wc -l`), but §2.3 component counts run 4–6% stale low: e.g. `activity-builder.tsx`
measured 256 vs 244, `material-editor.tsx` 266 vs 252, `materials-explorer.tsx` 132 vs 120,
`class-groups-explorer.tsx` 237 vs 228 — worth a global re-count before Day 1.)

---

## Open questions for the plan author

1. Does "~1,570 lines" mean *purge-attributable* (measured 1,263) or *any dead CSS found while
   purging* (measured ~1,915–1,957)? Which file scope — `portal.module.css` only or all 6 modules?
2. What tool will identify dead selectors safely, given 29 shared class names and dynamic
   `styles[\`tone${…}\`]` access that static grep cannot see?
3. §4.1 step 2: which real classes back `.card` and `.badge` — `.panel`? `.statusBadge`? Or are
   those new abstractions (i.e., not an "extraction" but a redesign)?
4. §4.2: where do the 169 lines of shared types, `GameOfflinePersistence`, and the 4 error classes
   land, and does `@/runtime/game-offline-sync` remain as a re-export barrel for the 728-line test
   and `game-host.tsx`?
5. §4.3: please point to the actual "duplicate handshake code" (file:line pairs); none was found.
   If you meant the `portal.*` reply construction in `game-host.saveDemoState` (534–560) vs
   `game-offline-sync` internal acks, that's a host↔store duplication, not host↔adapter.
6. §4.3: is the react-refs inventory (12 refs) intended to move wholesale into `use-game-bridge`
   with `use-game-sync` receiving injected callbacks? Who owns `pendingConflict`?
7. §4.4: after extracting navigation, does `getShell()` remain in `AdultPortalService` (used by
   `getOverview:211`) or move to the presenter — and which service owns it post-split?
8. §5: given Tailwind v4's CSS-first `@theme`, is "map tokens into tailwind.config.ts" still the
   intended migration surface, and would you accept 8–12 days as the honest rewrite estimate?
