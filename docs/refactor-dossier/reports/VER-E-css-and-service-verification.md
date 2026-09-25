# VER-E — Refutation pass on `INV-E-css-and-service.md` (§4.1 CSS, §5 Tailwind, §4.4 service)

Verifier: VER-E. Read-only; nothing in the repo was modified except this file.
Method (deliberately different from INV-E's `postcss` walk): a hand-written lexical brace-walk
parser over the raw text of `src/components/portal/portal.module.css` (comments blanked, at-rule
nesting tracked, class names harvested with `/\.(-?[A-Za-z_][-\w]*)/g` from every selector
prelude), plus per-file regex harvesting of `import <id> from "*portal.module.css"` followed by
`<id>.X`, `<id>["X"]`, `` <id>[`…`] `` and `<id>[<expr>]` across `src/**/*.{ts,tsx}`. Live/dead
computed from the plan's own §2.2 + §2.3 deletion manifest, read from `REFACTOR_PLAN.md:34-66`.
Scripts and raw JSON dumps live outside the repo (`%TEMP%/verE/*.mjs`) — nothing was written into
the working tree.

**Headline: INV-E does not fall.** Every load-bearing CSS number in it reproduced exactly under an
independent parser (4,910 / 319 / 317 / 170 / 91 / 58 / 2,191 / 1,823 / 26 / 161 / 42-in-`@media` /
149 / 68 / 118 / 27). What does fall: (a) one internal refinement that moves 39 lines from
"surgery" to "delete" and yields **1,862 block-deletable lines**, (b) the *meaning* of two hazard
numbers (118 and 1,823/161), (c) the `--focus-ring-color` blast radius ("app-wide" is wrong),
(d) the §7.1 budget recommendation (its own projections are ~300 lines low on two files),
(e) ~15 drifted `class:line` citations, two badly wrong, (f) one false consumer claim
(`results-screen.tsx` does not import `portal.module.css`), and (g) the §4.4 "12 new files"
straw man. The plan's 1,567 is not reproducible by any of the 13 methods I tried and should not be
published.

---

## Verdict table

| # | INV-E claim | Verdict | Independent evidence |
| :-- | :-- | :-- | :-- |
| 1 | `portal.module.css` = 4,910 lines | **CONFIRMED** | `wc -l` 4,910; my parser sees 4,910 content lines + trailing NL. Committed at `c149374` (2026-09-23 17:48), work tree clean → plan and report measured the same bytes. |
| 2 | 317 "leading-selector" / 319 "any position" distinct classes | **CONFIRMED** | My counts: **319** any-position, **317** = classes leading at least one selector in a comma list, **306** = classes leading the *first* selector of a rule. The 2-class delta is `summaryTextValue` (`portal.module.css:3428`) and `demoRoleBlockNotice` (`:3550`), descendant-only targets. |
| 3 | Plan's 308 is wrong / unexplained | **OVERSTATED (both sides)** | 308 sits 2 lines from a legitimate method (306). The plan's class count is defensible; only its line count (§8 below) is not. |
| 4 | Split 170 live / 91 purge-dead / 58 never-referenced | **CONFIRMED** | My independent sets: live∩defined **170**, purge-dead **91** (87 statically referenced by §2.3/§2.2 files + the 5 `tone*` credited to the 2 dynamic sites, minus `materialAudience` which is undefined), never-referenced **58** (63 raw − 5 `tone*`). 170+91+58 = 319 = defined. Closes exactly. |
| 5 | 1,823 block-deletable lines = union of all-dead rule spans (289 rules; 247 top level + 42 inside `@media`) | **CONFIRMED (reproduced digit-for-digit)** | My parser: 289 rules, union of selector→closing-brace lines = **1,823**; 247/42 split exact; pure-live rule lines **2,191** exact; classless/`:global`-only rules 13. |
| 6 | +26 mixed rules / 161 lines need selector surgery | **CONFIRMED as a set, OVERSTATED as work** | My mixed set is the *same 26 rules at the same 26 start lines* (`:1125,:1406,:1416,:1810,:2535,:2547,:2600,:2617,:2722,:2727,:2827,:3347,:3351,:3428,:3559,:3574,:3586,:3591,:3610,:3616,:4582,:4715,:4797,:4823,:4842,:4878`), 161 lines. But INV-E counts a live class anywhere in the selector as "surgery". Per-comma-alternative analysis: **7 of the 26 (39 lines) have no live driver** and block-delete cleanly → `:3347`, `:3351`, `:3428`, `:4582`, `:4823`, `:4842`, `:4878`. Surgery really needed: **19 rules / 122 lines**. |
| 7 | Spot-checks of the mixed rules (6+ read) | **CONFIRMED** | Read: `:1406-1414` `.panel,.sidePanel,.reportPanel,.detailPanel` (3 dead + live `.detailPanel`, consumers `class-detail-screen.tsx:115,164`, `organization-detail-screen.tsx:154,205`); `:1810` `.detailPanel h2,.reportPanel h2`; `:1125` `.searchField input,.select,.input,.textarea`; `:2535` `.sidebar > .brand,.sidebarProfile,.adminNavGroup .navLabel,.desktopNavItem`; `:2617` `.dashboardGrid,.portalLoadingGrid,.builderLayout,.detailGrid,.reportGrid,.shareLayout` (only `portalLoadingGrid` survives); `:4715` / `:4797` (1 dead + 2 live each); `:3559`/`:3574`/`:3586`/`:3591` (`.provisioningNotice` dead, `.demoScopeNotice`/`.inactiveNotice` live); `:3428`/`:4582`/`:4823`/`:4878` (dead driver, live class only in a descendant/`:not()` slot → deletable). |
| 8 | Dynamic `styles[…]` = exactly 2, both in §2.3 | **CONFIRMED** | `src/components/portal/activity-mark.tsx:22` and `src/components/portal/materials-explorer.tsx:92` are the only `styles[` occurrences in all of `src` (`grep -rn "styles\[" src` → 2 hits). Both files are named in `REFACTOR_PLAN.md:60,62`. |
| 9 | No third dynamic site (sweep) | **CONFIRMED — none missed** | Swept and all empty in `src`: `Object.keys(styles`, `Object.entries(styles`, `...styles`, `styles as `, `keyof typeof styles`, ``[`styles.${`` , and the class-helper ecosystem (`clsx`, `cva(`, `class-variance-authority`, `twMerge`, `classnames`) — 0 occurrences in first-party source. Near-miss shapes that are *safe*: `status-badge.tsx:17-31` stores four statically-written `styles.status*` names in a variable and interpolates at `:31`; `src/components/public/game-host.tsx:863` ternary. Both are grep-visible, so a purge tool sees them. |
| 10 | Purge must run strictly *after* §2 deletions | **CONFIRMED (critical)** | `toneBlue/Orange/Aqua/Purple/Green` are defined at `portal.module.css:987-1006` and referenced nowhere statically. A static-grep purge run *before* Day 1 strips 5 live classes out of `activity-mark.tsx` / `materials-explorer.tsx` mid-sprint. |
| 11 | Phantom `styles.mobileNavItem` at `portal-navigation.tsx:37` | **CONFIRMED, and worse than stated** | Exact line: `` className={`${styles.navLink} ${current ? styles.navLinkActive : ""} ${item.mobile ? styles.mobileNavItem : styles.desktopNavItem}`} ``. `mobileNavItem` exists in **0 of 7 stylesheets** (my defined-set has 319 names, none matches; `grep -rn "\.mobileNavItem" src --include="*.css"` → 0). Empirically settled: React **does** emit the literal token — `out/portal/index.html` contains `class="portal-module__1g8gFq__navLink  undefined"` (3 nav links on that page) and **45 prerendered HTML files** under `out/` contain it. No `.undefined` rule exists in any built CSS chunk, so nothing styles it. |
| 12 | …is a live bug worth an incidental fix; "user-visible? " | **CONFIRMED bug / UNDERSTATED semantics** | Blast radius is larger than reported but the *visual* effect is nil: `getShell()` marks **every** item `mobile: true` (`service.ts:146,155,161,171,177,186,192`) and so does the demo rebuild (`portal-navigation.tsx:66,75,81,89,109,115,123`). Therefore (a) all nav links in **both** runtimes carry the `undefined` token, and (b) the false arm — `styles.desktopNavItem` — is **never applied to any element**, so `@media (max-width:900px)`'s `.desktopNavItem { display: none }` (`portal.module.css:2538`) is dead code and the desktop/mobile nav split is entirely inert today. Fix must decide intent (give mobile items a real rule, or drop the ternary), not just delete a token. |
| 13 | `styles.materialAudience` phantom (`materials-explorer.tsx:105`) | **CONFIRMED** | Line 105 = `<span className={styles.materialAudience}>`; class defined nowhere; file is in §2.3 → disappears with the purge. |
| 14 | `.button:757`, `.buttonGhost:770`, `.input:1143`, `.field:1612` exist | **CONFIRMED** | Verbatim: `.button {` @757, `.buttonGhost {` @770, `.input {` @1143, `.field {` @1612; group base `:712-740` (5 classes: `.button,.buttonSecondary,.buttonGhost,.buttonDanger,.iconButton`), hover `:742`, svg `:749`, `.button:disabled` `:3675`; `.fieldFull:1617`, `.field label,.field > span:1621`, `.fieldHelp:1627` ✓. |
| 15 | `.card` and `.badge` exist in no stylesheet | **CONFIRMED** | `grep -rnE "\.card\b\|\.badge\b" --include="*.css" src` → **0 hits** across all 7 sheets; and the only statically-referenced-but-undefined class names in `src` are `mobileNavItem`, `materialAudience` (+2 template exprs) — i.e. no `styles.card`/`styles.badge` either. |
| 16 | Real badge analogue `.statusBadge:1038` + tones `:1058-1073`, single consumer | **CONFIRMED** | `.statusBadge{` @1038, `::before` @1050, `.statusPositive` @1058, `.statusWarning` @1063, `.statusDanger` @1068, `.statusNeutral` @1073; sole consumer `status-badge.tsx:21,24,28,29,31` (5 classes ✓). |
| 17 | `.panel` purge-dead **and has no standalone rule** | **CONFIRMED** | `.panel` occurs only as the first line of two grouped selectors, `:1406-1414` and `:1416-1420`; no `.panel {` anywhere. Deleting either block kills live `.detailPanel` → surgery, as the report says. |
| 18 | "12 divergent card idioms" | **OVERSTATED / composition wrong** | `portal.module.css` actually defines 13 `*Card*` classes (`featureCard:795`, `weeklyCard:862`, `summaryCard:1172`, `moduleCard:1215`, `gameCard:1448`, `linkCard:1871`, `statCard:1941`, `shareCard:2176`, `stateCard:2405`, `classGroupCard:3220`, `recentResultsCard:3443`, `credentialPrintCard:4146`, `portalLoadingSummaryCard:527`). Of INV-E's 12, `organizationTableRow` is not a card class and 7 are purge-dead (`featureCard, weeklyCard, linkCard, shareCard, statCard, gameCard` + `recentResultsCard`), so the post-split portal figure is **6 live card idioms**; the real cross-file family is bigger still (`results.module.css:43 classCard`, `:233 sessionCard`; `public.module.css:122 missionCard`, `:707 entryCard`, `:336 gameFrameCard`, `:653 stateCard`). The qualitative point (no generic `.card`) stands. |
| 19 | "exactly 27 live classes with ≥2 surviving consumers" | **CONFIRMED** | Recomputed from scratch: **27**, same names and same counts as published (`button`4, `input`4, `field`5, `demoScopeNotice`5, `formError`4, `select`3, `textLink`3, `sectionHeader`3, `managementPanel`3, `buttonGhost/buttonDanger/eyebrow/summaryStrip/summaryCard/detailPanel/adminTable/tableHeader/tableRow/tableIdentity/personAvatar/directoryIcon/inactiveNotice/formSuccess/inlineEmpty/inlineWarning/confirmationDialog/confirmationDialogActions` = 2 each). 143 live classes have exactly 1 consumer. |
| 20 | `results.module.css:8` is a divergent fork of `portal.module.css:1172 .summaryCard`; `:1-6 .summaryStrip` identical | **CONFIRMED (line ranges off by one)** | `.summaryStrip` = `results.module.css:1-5` ≡ `portal.module.css:1165-1169` (byte-identical 4 declarations). `.summaryCard` = `results.module.css:8-17` diverges structurally: results has `align-content:start; min-height:116px` + `.summaryCard > span, .summaryCard small` (`:19`) while portal has `position:relative; overflow:hidden` + the `::after` ring (`:1182-1190`) + `.summaryCard p` (`:1193`). Two different markup contracts under one name. |
| 21 | `@media print` `:4355-4391` bound to `data-player-print-active` set at runtime | **CONFIRMED** | Block is 6 rules: `:global(body) > *` `:4356`, `.printSheet, .printSheet *` `:4360`, `.printSheet:not([data-player-print-active])` `:4365`, `.printSheet` `:4369`, `.credentialPrintCard` `:4381`, `.credentialPrintCard img` `:4388`. Attribute lifecycle: removed for all sheets `player-credential-print-sheet.tsx:97-100`, set `:101`, removed on `afterprint` `:104`, marker attribute `data-player-print-sheet` in JSX `:118`. Zero dead classes in the block (all 6 rules live) ✓. |
| 22 | Skeleton move-unit: `@keyframes portalSkeletonShimmer:650-658` + `--portal-skeleton-base:334`/`-shine:339` consumed at `:370` | **CONFIRMED** | Verbatim. Both custom properties are declared *inside* `.portalLoading` (`:333`) — i.e. element-scoped, so they must travel with it; `animation: portalSkeletonShimmer 1500ms…` at `:370`. |
| 23 | `--focus-ring-color` defined in `.sidebar` (`:7`), consumed by `globals.css:120`; moving `.sidebar` "changes focus color **app-wide**" | **MECHANISM CONFIRMED, CONSEQUENCE WRONG** | Both sites exact (`portal.module.css:6-7` `.sidebar { --focus-ring-color: var(--yellow);`; `globals.css:119-121` `:focus-visible { outline: 2px solid var(--focus-ring-color, var(--green-dark)) }`; the token is defined and consumed **nowhere else** in the repo, and `portal.module.css` contains **no** `outline`/`focus-visible` rule). But a custom property declared on `.sidebar` only cascades to its subtree, and `.workspace` is a **sibling** of the `<aside>` (`portal-shell.tsx:49` vs `:81`) — so focus rings outside the sidebar are already `--green-dark` today and stay unchanged. Real (smaller) hazard: dropping line 7, or re-parenting the nav outside `.sidebar`, flips **~4-8 sidebar controls** (brand link, 7 nav links, logout) from yellow to green. The file-move itself is a no-op. Record as a "keep-with-rule" note, not an app-wide regression. |
| 24 | 118 rules span ≥2 proposed modules | **NUMBER CONFIRMED, RANKING WRONG** | Reproduced exactly: 118 rules whose live classes are used by ≥2 surviving files. But 94 of those are merely *single shared class* rules (e.g. `.button {`, `.button:hover {`) — which is what `primitives.module.css` exists to absorb, not a hazard. The actionable set (rule contains ≥2 live classes and **no single surviving file owns all of them**, so it cannot be placed in one module without duplication) = **24 rules**; intermediate (≥2 live classes spanning ≥2 files) = 55. Publish 24 as the hazard, 118 as the shared-class census. |
| 25 | §7.1: 300-warn unattainable for 5/7, 600-fail borderline; recommend 450/650 | **DIRECTION CONFIRMED, RECOMMENDATION DOES NOT FOLLOW** | See budget section: with an independent partition and a conversion ratio *measured from this file* (1.391), `primitives` ≈ 860 and residual `portal` ≈ 836 — both **above the 650 fail line the report proposes**. Its per-file contents lists also omit four surviving class families from the residual (see hazards). |
| 26 | 68 `:root` tokens in `globals.css` | **CONFIRMED (with 2 new caveats)** | 68 `--x:` definitions in `globals.css:1-74` (`:root` closes at `:74`). New: **11 of the 68 are aliases** of another token (`:44-52 --font-size-*`, `:61 --radius-brand`, `:67 --radius-arch`), and **3 are orphaned by the purge** (see hazards). |
| 27 | `service.ts` = 616 lines, **17 public methods** | **CONFIRMED** | `wc -l` 616. Enumerated by my own pattern `^  async `: 17 public (`getShell:121, getOverview:209, listOrganizations:235, getOrganization:256, createOrganization:282, changeOrganizationStatus:291, listTeam:309, listProvisionedProfiles:321, assignOrganizationAdministrator:337, assignTeacher:373, changeMembership:403, listClasses:447, getClass:482, createClass:495, changeClassStatus:506, assignTeacherToClass:520, deactivateTeacherAssignment:569`) + 3 private (`actor:114, assertActiveOrganization:589, assertActiveProfile:603`). All 17 method line-ranges in INV-E are exact. |
| 28 | Concern split org 4 / team 5 / class 6 / shell 2 | **COUNTS CONFIRMED, LINE COLUMN DOES NOT CLOSE** | 2/4/5/6 ✓ = 17. But its per-concern line totals are inflated for two rows: block spans are shell `121-233`=113 (report 112 ✓), org `235-307`=**73** (report 86), team `309-445`=137 ✓, class `447-587`=**141** (report 148). The published column sums to 483 while the entire method body region `121-587` is 467 lines. Use 113/73/137/141. |
| 29 | Guard call-site counts (`authorizationActor` 20, `activeOrganizationIds` 4, `effectiveRole` 1, `requireActor` 1, `notFound` 10, `forbidden` 13, `this.actor` 17, `transaction` 9, `schema.parse` 9, asserts 4+4) | **CONFIRMED except one off-by-one** | `grep -o "authorizationActor(" \| wc -l` = 20 **including** the definition at `:49` → **19 call sites**. All others reproduce exactly (`activeOrganizationIds(` 5 = def+4 ✓, `this.actor(` 17 ✓, `.parse(input)` 9 ✓, `this.store.transaction(` 9 ✓, assert* def+4 each ✓). |
| 30 | `authorizationActor` has an identical clone at `player-access/service.ts:15-25` | **CONFIRMED** | Byte-for-byte the same body at `src/application/player-access/service.ts:15-25` (11 lines, not 13); `fail()` analogue at `:27-31`; sibling sizes 180 / 194 lines ✓. |
| 31 | Service runs on both sides; demo puts it in the browser bundle | **CONFIRMED** | No `"use client"`/`server-only` in `service.ts`; `src/runtime/adult-portal-server.ts:1` has `import "server-only"`; `src/runtime/adult-portal-demo-actions.ts:1` is `"use client"` and instantiates `new AdultPortalService(new DemoAdultPortalStore(state))` at `:50`. `service.ts:1-5` imports Prisma enums **as values**, so `@/generated/prisma/enums` is already in the client graph. |
| 32 | `adult-portal-server.ts:29,54,65` use `getShell()` only for `.effectiveRole` | **CONFIRMED** | `getShell` call sites: `:18` (returns the whole DTO — the only one that needs navigation), `:29` (`canCreate`/`role`), `:54` (`role`), `:65` (`role`). 3 of 4 discard `navigation` ✓. Each rebuilds the full 60-line navigation array to read a string. |
| 33 | `getShell`/navigation untested; 11 tests in `adult-portal-service.test.ts` | **CONFIRMED** | `grep -c "it("` = 11; `grep -n "getShell\|navigation"` in that file → 0 matches. |
| 34 | `portal-navigation-presenter.ts` does not exist; `portal-navigation.tsx` already does the job | **CONFIRMED** | `find src -name "*presenter*"` → empty. `portal-navigation.tsx:57-126` rebuilds the whole item list client-side for demo ✓; `adult-portal-helpers.ts` has `demoRole:34`, `demoScopeLabel:98`, `isPortalNavigationItemCurrent:123` ✓; `portal-shell-context.tsx:10-16` re-implements `roleLabel` ✓. Four copies of the same presentation logic confirmed. |
| 35 | Application→components dependency has zero instances | **CONFIRMED** | `grep -rn "from \"@/components" src/application src/server src/runtime` → **0**. Conversely 20 files under `src/components` import from `@/application/*`, and every one of those is `import type` — the repo has no precedent for a *value* crossing components←application from `src/components`. |
| 36 | Audit Phase-4 row says "at minimum move `getShell` navigation to `presenters/portal-navigation.ts`" | **CONFIRMED verbatim** | `docs/architecture-audit-2026-09-23.md:696`, and its *primary* clause is "keep one service per aggregate **where practical**, or at minimum…" — the report quotes only the fallback and concludes "SKIP the split", which is a stronger position than the audit's. |
| 37 | §5: no Tailwind anywhere | **CONFIRMED for first-party, WRONG as literally worded** | No `tailwind` entry in `package.json` deps/devDeps; no `tailwind.config.*`, no `postcss.config.*`; zero `@tailwind`/`@import "tailwindcss"`/`@theme` in any of the 7 sheets. **But** `node_modules/tailwindcss@4.2.1` and `tailwind-merge@3.7.0` are installed transitively (`package-lock.json:1543-1544` ← `@neondatabase/auth-ui@0.3.0-beta` ← `@neondatabase/auth@0.5.0-beta`, a direct dep; `@react-email/tailwind` too). The §5 verdict survives (nothing in `src/**` references it), but the dossier must say "no first-party Tailwind", not "no Tailwind dependency exists". |
| 38 | Turbopack supports `composes` only between `.module.css` files (`08-turbopack.md:360`) | **CONFIRMED** | Cited line verbatim in `node_modules/next/dist/docs/01-app/03-api-reference/08-turbopack.md:360`. |
| 39 | No `@import`/`@font-face`/`@property`; 3 `-webkit-` in portal, 2 in globals | **CONFIRMED (globals lines drift)** | `grep -rn "@import\|@font-face\|@property" --include="*.css" src` → 0; 3 `-webkit-` in `portal.module.css`; the two in globals are at `:86` and `:97` (INV-E says 87/99). |
| 40 | Per-consumer class counts | **CONFIRMED for 21/22 rows** | My counts match exactly for loading 45, workflow 28, shell 14, org-detail 16, team 15, class-detail 13, orgs 11, classes 11, print-sheet 10, overview 8, deactivate 7, page-header 5, adult-portal-form 5, status-badge 5, ajuda 4, shell-context 3, portal-state 3, demo-role-controls 2, sem-acesso 1, sessao-expirada 1, demo-action-button 1 (`styles.toast` @`:33` ✓). `portal-navigation.tsx` = 6 including the phantom (5 real + `mobileNavItem`) ✓. |
| 41 | "`results-screen.tsx` and `team-screen.tsx` already dual-import their own module + `portal.module.css`" (open question 6) | **WRONG for results-screen** | `results-screen.tsx:11` imports **only** `./results.module.css`; it is not among the 37 `portal.module.css` importers. `team-screen.tsx:30,31` does dual-import (`portal.module.css` + `team-screen.module.css`) ✓. The stated "primitives may let them drop the second import" therefore applies to one screen, not two — and to neither for `results-screen`, which cannot drop anything (see coupling below). |
| 42 | Post-purge residual ≈2,950-3,050 lines | **CONFIRMED** | 4,910 − 1,862 block-deletable = **3,048**; my live-rule-line census (2,191+161+13 = 2,365) × measured file overhead 1.29 → same band. |
| 43 | "8 gen-A components" contribute the purge-dead bucket | **OVERSTATED (7)** | Only 7 of the 8 §2.3 components import `portal.module.css` (material-editor 29 classes, activity-builder 27, class-groups-explorer 25, materials-explorer 15, activity-controls 11, share-actions 6, activity-mark 1); `public-state.tsx` imports `public.module.css` and contributes 0. Of §2.2's 7 route trees, only 3 import the sheet (atividades 7 pages = 60 refs, materiais/page 1, admin/auditoria 8); `modulos/`, `admin/jogos/`, `admin/modulos/`, `(public-play)/atividade/` import **no** portal CSS at all. |

---

## Number adjudication (which counts the dossier should publish)

CSS counting is method-sensitive; here is the full spread my own sweep produced, so the dossier can
pick one and state it.

| Quantity | Value | Method |
| :-- | ---: | :-- |
| File lines | 4,910 | `wc -l` (agrees with both plan and INV-E) |
| Rules / at-rules | 696 / 13 | brace walk (INV-E: 693 / 13 — the 3-rule delta is keyframe steps and a comment-adjacency edge case; immaterial) |
| Distinct classes | **319** | class in *any* selector position |
| — | 317 | leads ≥1 selector in a comma list (INV-E's published figure) |
| — | 306 | leads the *first* selector of ≥1 rule (nearest legitimate match to the plan's 308) |
| Live / purge-dead / never-referenced | **170 / 91 / 58** | `styles.X` ∪ `styles["X"]` ∪ `styles[\`…\`]` in `src`, credited to importers, live set = survivors of §2.2+§2.3. Closes on 319. |
| Removable classes total | **149** | 91 + 58 |
| Block-deletable lines | **1,862** (296 rules) | all-dead rules (289 / 1,823) **+** 7 mixed rules with no live driver (39 lines) |
| Selector-surgery lines | **122** (19 rules) | mixed rules with ≥1 live comma-alternative |
| Total CSS touched | **1,984** | 1,862 + 122 |
| Physical diff size | ≈2,158 | 1,862 + one blank separator line per deleted block (697 blanks in the file) |
| Cross-module coupling hazards | **24** rules (118 = shared-class census) | 24 = ≥2 live classes with no single surviving owner file |
| Shared live classes (≥2 consumers) | **27** | reproduced name-for-name |
| `:root` tokens | 68 (57 real + 11 aliases; **3 orphaned by the purge**) | lexical |

**On 1,823 vs the plan's 1,567 — this is a method difference on INV-E's side and an unreproducible
figure on the plan's side.** Evidence: (1) both numbers describe the *same bytes* — the plan's own
baseline (4,910 lines, 68 tokens) matches HEAD exactly and `git log` shows `portal.module.css`
untouched since `c149374`, so no file drift explains it; (2) I ran 13 plausible methods and none
hits 1,567 — declaration+brace lines only = 1,534, top-level-only dead rules = 1,658, purge-dead
classes only = 1,181, never-referenced only = 621, single-simple-class selectors = 1,078,
1,823+blanks = 1,903, mixed-inclusive = 1,984, leading-class-dead = 1,930 — the plan's number sits
in no method's output and its methodology is undocumented, while 1,823 is now reproduced by two
independent parsers. So the plan under-reports the deletion yield by ~256 lines (~14%), not the
reverse. Note also that INV-E, by the same token, under-reports it by 39 lines because it files 7
wholly-deletable rules under "surgery".

**Recommend the dossier publish:** `portal.module.css` = **4,910 lines / 319 distinct classes
(317 leading) / 170 live + 91 purge-dead + 58 never-referenced → 149 removable classes, 1,862
block-deletable lines (296 rules) plus 122 lines in 19 rules requiring selector surgery
(1,984 lines of CSS touched; ≈2,158 physical diff with blank separators; residual file 3,048)**,
each figure footnoted with its definition. Do **not** publish 1,567; if a single number must stand
in for the plan's claim, record it as a superseded estimate in the errata.

---

## Additional hazards the report missed

1. **Three design tokens are orphaned by the purge.** `--purple-dark`/`--purple-light`
   (`globals.css:15-16`) are consumed only by `.tonePurple` (`portal.module.css:998-1001`), one of
   the five dynamic-only `tone*` classes; `--radius-micro` (`globals.css:53`) only by `.miniBars`
   (`:902`), `.qrCell` (`:2211`), `.organizationBars` (`:4595`) — all three in the never-referenced
   bucket. After Day 1 these are dead weight in the token budget §7.1/§4.1 asserts as "all 68
   remain". Also: 11 of the 68 are aliases (`globals.css:44-52,61,67`), so "68 tokens" overstates
   the design vocabulary.
2. **`desktopNavItem` is grep-live but runtime-dead.** Its only reference is the false arm of the
   `portal-navigation.tsx:37` ternary, and `mobile` is `true` on every item produced by
   `getShell()` (`service.ts:146-192`) and by the demo rebuild (`:66-123`). Any liveness oracle
   built on `styles.X` grep (INV-E's E0 "golden dump") counts it; the dossier should footnote
   "170 = statically reachable", not "rendered".
3. **`results-screen.tsx` is structurally captive to `portal.module.css` even after extraction.**
   It imports only `./results.module.css` (`:11`) yet renders `<PageHeader>` (`:51`) and
   `<PortalState>` (`:56`), which pull `.pageHeader/.pageTitle/.stateCard/.stateIcon/.stateActions`
   from the portal sheet. So the forked `.summaryCard` (`results.module.css:8`) sits on the same
   page next to portal-owned chrome; primitives extraction must be re-verified on `/portal/resultados`
   even though nothing there "imports portal.module.css". INV-E's dual-import claim (#41) points the
   other way.
4. **No CI exists to catch any of it.** `.github/workflows/` contains only `deploy.yml`
   (`npm ci` + `npm run build:demo`); there is no `ci.yml` yet (plan Day-0 item), and no test touches
   CSS, class names or the DOM. INV-E's E0 ("add the dump as a CI artifact") and E5 ("`npm run check`
   green") assume enforcement that is not in the repo.
5. **The print flow has no regression net.** `tests/unit/player-credential-printing.test.ts` covers
   the *data* (`printablePlayerCredentials`), not the attribute flip
   (`player-credential-print-sheet.tsx:97-118`) and not one CSS assertion. A mis-relocated
   `@media print` block (`:4355-4391`) — including the `:global(body) > *` visibility rule at
   `:4356` — is invisible to `tsc`, `eslint`, `vitest` and `build:demo`; only physical print
   emulation catches it. Same for the skeleton keyframes (`:650`) and the reduced-motion block
   (`:2818-2838`).
6. **`composes` has zero precedent in this codebase.** 0 occurrences across all 7 sheets, 0
   `@import`. INV-E recommends it (hazard #2) without saying the team would be introducing a new
   mechanism under a bundler whose support is documented as module→module only
   (`08-turbopack.md:360`); combined with per-file class hashing, that is a decision that needs its
   own spike, not a footnote inside an extraction step.
7. **INV-E's residual-`portal.module.css` contents list omits four surviving class families**:
   `demoRoleControls/.demoRoleControls + .navigation/.demoRoleBlockNotice`, the `ajuda` trio
   `moduleGrid:1209/moduleCard:1215/moduleArt`, the badge tones
   `statusPositive/statusWarning/statusDanger/statusNeutral:1058-1073`, and
   `avatar/sidebarProfileCopy/topbarAvatar/inlineMutationForm`. Its residual estimate is therefore
   ~140 rule-lines light before any duplication, which is what pushes the file past 650 (§ next).
8. **Two of §4.1's named primitives are simultaneously classified dead by INV-E itself**: the
   primitives row lists `textarea` and `fieldFull`, both of which appear in its own purge-dead list
   (my scan agrees: 0 surviving consumers). `buttonSmall` is likewise never-referenced. Extracting
   them creates a `primitives.module.css` whose first contribution is dead code.
9. **§2.1's `status-badge.tsx` prune interacts with the CSS census** (noted, not a defect):
   `ActivityStatus` = `"Aberta"|"Rascunho"|"Pausada"|"Encerrada"` (`portal-view-service.ts:9`);
   after removing the three unused members, `styles.statusWarning` (`:24`) and
   `styles.statusDanger` (`:28`) stay reachable only via `"Convite pendente"` and the
   `includes("bloquead")` predicates. They remain live-by-grep but are worth a data-level check
   before anyone calls them protected.

---

## Corrected primitives list

Post-purge surviving-consumer counts, from my own owner map (this is the number that decides
extraction value). Only classes with ≥2 consumers buy anything; 1-consumer classes are extracted
for cohesion only.

| Class | Consumers (surviving) | Rule lines | Verdict |
| :-- | ---: | ---: | :-- |
| `field` | 5 | 18 | extract |
| `demoScopeNotice` | 5 | 13 | extract |
| `button` | 4 | 106 (incl. group/hover/svg/disabled) | extract |
| `input` | 4 | 16 | extract |
| `formError` | 4 | 35 | extract |
| `select` | 3 | 24 | extract |
| `textLink` | 3 | 9 | extract |
| `sectionHeader` | 3 | 16 | extract |
| `managementPanel` | 3 | 28 | extract |
| `buttonGhost` / `buttonDanger` / `eyebrow` / `summaryStrip` / `summaryCard` / `detailPanel` / `adminTable` / `tableHeader` / `tableRow` / `tableIdentity` / `personAvatar` / `directoryIcon` / `inactiveNotice` / `formSuccess` / `inlineEmpty` / `inlineWarning` / `confirmationDialog` / `confirmationDialogActions` | 2 each | see census | extract |
| `iconButton` | 1 (`organizations-screen.tsx:187`) + 3 deleted files | — | extract **only** for the button-group base at `:712` |
| `buttonSecondary` | 1 (`player-credential-print-sheet.tsx:90`) | 61 | keep with the group base (`:712-756`), else the shared base splits |
| `statusBadge` + 4 tones | 1 (`status-badge.tsx`) | 18 + 4×5 | leave in `portal.module.css` or move whole `status-badge` family — 1 consumer |
| `stateCard/stateIcon/stateActions` | 1 (`portal-state.tsx`) | 56 | 1 consumer → primitives only as a landing pad for `results-screen` (hazard 3) |
| `toast` (+ `toastIn` `:2488-2493`) | 1 (`demo-action-button.tsx:33`) | 30 | 1 consumer; **must** carry the keyframes |
| `input`/`select` group `:1125-1135` | mixed (`.searchField`,`.textarea` dead) | 11 | surgery first: reduce to `.select,.input` |
| `textarea`, `fieldFull`, `buttonSmall`, `panel`, `sidePanel`, `reportPanel`, `all tone*` | **0** | — | **DO NOT extract** (INV-E lists `textarea`/`fieldFull`/`panel` in the primitives row) |

Net: primitives should receive **27 shared classes + `iconButton`/`buttonSecondary` group base +
`toast`(+`toastIn`)**, i.e. ~30-31 class families, not the ~45-item list implied by INV-E's row
(which folds in 1-consumer families and 3 dead names). Dropping `stateCard`(56), `statusBadge`(38)
and `toast`(30) to their consumers moves ~124 rule lines out of primitives and is what makes the
file survivable under a tightened budget.

---

## Budget recommendation

INV-E's §7.1 arithmetic (`rule lines × 1.35`) is sound as a *device* but its inputs are low. My
independent method: assign every non-dead rule to exactly one module by its live driver class, using
a class→module map (primitives per the corrected list; screen = the sole surviving owner file;
everything else = residual shell), then scale by the ratio **measured from this file itself**:
post-purge single-file lines ÷ live rule lines = 3,048 / 2,191 = **1.391**.

| Proposed file | rule lines (mine) | projected (×1.391) | INV-E's projection | §7.1 300/600 |
| :-- | ---: | ---: | :-- | :-- |
| `primitives.module.css` | 618 | **860** | 520-560 | **FAIL** |
| `portal.module.css` residual shell | 601 | **836** | 560-620 | **FAIL** |
| `player-access.module.css` | 379 | 527 | 560-620 | warn |
| `portal-loading.module.css` | 302 | 420 | 330-400 | warn |
| `organizations-screen.module.css` | 199 | 277 | 330-380 | pass |
| `classes-screen.module.css` | 177 | 246 | 280-330 | pass |
| `team-screen.module.css` (delta only) | 43 | 60 | unchanged | pass |
| `overview-screen.module.css` | 33 | **46** | ~130 | pass (pointless) |

Sum of projections 3,272 vs 3,048 available — the +7% is exactly the duplication the 24 coupled
rules and 19 surgery rules force, plus per-file `@media` wrappers (13 at-rules must be re-opened in
each file that needs them; the shell alone holds 24 media-region rules, primitives 12, loading 8).

Conclusions:

1. **CONFIRMED**: the 300-warn is unattainable for the shell/primitives/loading/player-access mass —
   5 of 7 files, as INV-E says, and arguably 6 of 8 once `overview` is admitted to be a 46-line file
   that should not exist (its own author calls it "honestly too small").
2. **REFUTED**: "600-fail is borderline". Under a strict partition, `primitives` and the residual
   shell are 836-860 — 40% over. INV-E's borderline verdict rests on budgets that omit ~140
   residual rule-lines (hazard 7) and ~120 primitives rule-lines of media/descendant variants.
3. **Therefore 450/650 does NOT follow.** Either (a) set CSS at **500 warn / 750 fail** and accept
   two documented exceptions, or — better, because it keeps the ratchet honest — (b) **split the two
   mega-masses by responsibility** and keep 300/600 with two named exceptions:
   `controls.module.css` (buttons+group base, `input/select`, `field/fieldHelp`, `formError/
   formSuccess`, `confirmationDialog(+Actions)`, `toast`+`toastIn`, `inlineEmpty/inlineWarning`,
   `textLink`, `eyebrow`) ≈ 420-460, and `data-display.module.css` (`adminTable` family,
   `summaryStrip/summaryCard`, `sectionHeader`, `detailPanel`, `managementPanel`, `demoScopeNotice`,
   `inactiveNotice`, `personAvatar`, `directoryIcon`, `statusBadge`) ≈ 400-440; and split the shell
   into `shell.module.css` (shell/sidebar+`--focus-ring-color`/brand/workspace/topbar/schoolChip/
   logout, media `:2521-2603`) ≈ 470 and `navigation.module.css` (`navigation/navGroup/navLink/
   navLinkActive/desktopNavItem` + `page-header` + `demoRoleControls`, keeping the adjacency rule
   `:3555`/`:4897` with `demoRoleControls`' owner) ≈ 360. Residual `portal.module.css` then holds
   `portalForm/inlineMutationForm` + shell media ≈ 300.
4. Whichever way it goes, publish the budget **per-file with the class list attached**, not as a
   single "300/600 CSS Modules" line — the current §7.1 line is unfalsifiable as written.
5. `results.module.css` (378) and the `.summaryCard` fork: agree with INV-E — out of scope this
   sprint; the fork is the *evidence* for primitives, not a migration target.

---

## §4.4 verdict (split / don't split / where navigation goes)

**Method census (mine):** 17 public methods, 616 lines, 2/4/5/2 concern split (shell/org/team/class)
with corrected line spans 113/73/137/141; 19 `authorizationActor` calls, 4 `activeOrganizationIds`,
1 `effectiveRole`, 1 `requireActor`, 10 `notFound`, 13 `forbidden`, 17 `this.actor`, 9 transactions,
9 `schema.parse`, 4+4 asserts.

**Don't split into three services — but INV-E gets there with a straw man.** §4.4-2 names four
*files* inside the existing folder (`organization-service.ts`, `class-service.ts`, `team-service.ts`,
`authorization-guards.ts`), not "three folders × (service+ports+schemas+types) = 12 files". Judged
against what the plan actually asks, the case still fails, for reasons INV-E under-weights:
`getOverview` (`:209-233`) aggregates org + class + shell in one call; `assignTeacherToClass`
(`:520-567`) needs `membership` (team) state to authorize a *class* write, and
`changeMembership` (`:403-445`) calls `assertActiveOrganization`/`assertActiveProfile` — so a 3-way
cut needs either cross-service injection (new ports, container churn in
`src/server/services/adult-portal-container.ts:13` plus 6 `src/runtime` consumers) or duplicated
guards, against 11 existing tests whose `describe` blocks are organized by the *current* method set.
The repo's own convention also argues against it: `src/application/game-state/` ships **service.ts
alone**, `game-events/` ships service+ports — the folder shape tolerates one growing class.

The minimal justified cut is INV-E's and I confirm its arithmetic: `getShell`+`getOverview`
presentation (~113 lines) + 5 module helpers (~61 lines incl. the `authorizationActor` twin at
`player-access/service.ts:15-25`) → `service.ts` ≈ **440-470**, under the 500-fail, one fewer
duplicate in the repo, zero new DI. Over the 300-warn → record as named debt (as with CSS).

**Where the navigation code goes: `src/application/adult-portal/shell-view-model.ts` (pure). Not
`src/components/portal/`.** Reasoning, concretely:

- `getShell()` output feeds **both** graphs: Server Component `portal-shell.tsx` (no `"use client"`;
  `:48-52` passes `shell.navigation`) → Client Component `portal-navigation.tsx:1` (`"use client"`),
  and `portal-shell-context.tsx:1` (`"use client"`) receives the same DTO. `service.ts` itself is
  instantiated inside a `"use client"` module (`adult-portal-demo-actions.ts:1,50`).
- **Server→client import hazard: none mechanically.** A dependency-free `.ts` is importable from
  both graphs, and neither destination would import `src/server/**` or `@/generated/**` at runtime —
  `types.ts:1-6` pulls Prisma enums as `import type` only, and the builder's inputs are
  `AdultRole` + `organizationId`.
- **The real hazard is arrow direction.** `src/application|server|runtime → src/components` has
  **0 instances** in the repo, while 20 `src/components → @/application` imports exist (all type-only).
  Placing the presenter in `components/` would invert that for a *value* import from the domain
  layer, and would sit beside a `"use client"` sibling — exactly the fragile-by-convention state
  INV-E describes. It also strands the demo client: `portal-navigation.tsx` and
  `portal-shell-context.tsx` could import it (same folder), but `service.ts` could not use it without
  a UI dependency.
- **Reconciling the audit (`docs/architecture-audit-2026-09-23.md:696`).** The row reads "keep one
  service per aggregate **where practical**, or at minimum move `getShell` navigation to
  `presenters/portal-navigation.ts`" — its *intent* is "navigation is presentation", and its path is
  aspirational (`src/presenters/` does not exist; the nearest real convention is
  `src/components/portal/adult-portal-helpers.ts`, which already holds demo view-model helpers and
  has its own test). Recommendation: satisfy the audit literally-but-in-layer by creating
  `src/application/adult-portal/shell-view-model.ts` exporting pure
  `buildNavigation(role, activeMembershipOrganizationId): NavigationItemDto[]`,
  `buildRoleLabel(role)`, `buildScopeLabel(role, names)` — or, if the dossier wants the audit's
  filename greppable, `src/application/adult-portal/presenters/portal-navigation.ts` (same layer, no
  UI import). **One destination; application layer; `components/` rejected.**
- Prerequisite: 1 test file for the pure builder (today `getShell` has **0** coverage) plus a
  golden-string test for `buildScopeLabel`, because `service.ts:129-139` counts *organizations*
  while `adult-portal-helpers.ts:98-121` counts *classes* for the teacher role — the two algorithms
  genuinely differ (`"N turmas atribuídas"` vs `"N organizações acessíveis"`), so collapsing them is
  a behavior decision, not a refactor. Then delete `portal-navigation.tsx:60-125` and
  `portal-shell-context.tsx:10-16`, and add `getActorRole()` to replace the 3
  navigation-building role reads at `adult-portal-server.ts:29,54,65`.

**Also: §4.4-1 is satisfiable without the plan's folder, so it is not a deviation** — and §4.4-2's
"keep cohesive **or** split" already licenses the don't-split branch, so choosing guards +
view-model extraction is plan-compliant rather than a rewrite of the plan.

---

## Claims that did not survive

1. **"`--focus-ring-color` … moving `.sidebar` silently changes focus color app-wide."** Wrong
   blast radius. The property is declared on the `<aside>` (`portal-shell.tsx:49`) whose sibling is
   `.workspace` (`:81`); `globals.css:120`'s fallback already governs everything outside the sidebar.
   The regression surface is ~4-8 sidebar controls, and only if line 7 is dropped or the nav is
   re-parented.
2. **"26 mixed rules … need selector surgery."** Only 19 (122 lines) do; 7 (39 lines: `:3347,
   :3351, :3428, :4582, :4823, :4842, :4878`) have a dead driver in every comma-alternative and
   block-delete. Correct pairing is 1,862 deletable + 122 surgery.
3. **"Three folders × (service+ports+schemas+types) is 12 files where 2 exist."** The plan proposes
   4 files in one existing folder; the sibling folders are not uniform
   (`game-state/service.ts` alone, `game-events/` service+ports), so "2 exist" mis-describes them.
4. **"`results-screen.tsx` and `team-screen.tsx` already dual-import their own modules +
   `portal.module.css`."** False for `results-screen.tsx:11` (results.module.css only; it is not one
   of the 37 importers).
5. **"CSS Modules: recommend 450 warn / 650 fail."** Does not follow from the evidence; under a
   strict partition `primitives` (≈860) and residual shell (≈836) exceed 650. The underlying
   "300-warn is unattainable for 5 of 7" *is* correct.
6. **"8 gen-A components + [7] routes" define the purge-dead bucket.** 7 components contribute
   (public-state uses `public.module.css`), and 4 of the 7 route trees import no portal CSS at all.
7. **`@media print` … "6 print-sheet classes"** — the block itself names only 2 (`printSheet`,
   `credentialPrintCard`); the other 8 of the print sheet's 10 classes are outside `:4355-4391`.
8. **"§5 … no Tailwind dependency … exists anywhere."** True for first-party code/config/directives;
   false absolutely — `tailwindcss@4.2.1` and `tailwind-merge@3.7.0` are installed transitively via
   `@neondatabase/auth → @neondatabase/auth-ui` (`package-lock.json:1543-1544`).
9. **Line-citation drift.** Machine-checked 23 `class:line` citations against the real file: 8 exact,
   15 off. Two are materially wrong — `toggle:3491` (real `.toggle {` at **1552**; 3491 is a
   declaration inside an unrelated rule) and `linkCard:1751` (real **1871**). Others:
   `navLabel:126`→99, `steps:1344`→1314, `moduleCard:1265`→1215, `classGroupCard:3253`→3220,
   `credentialPrintCard:4160`→4146, `classDetailHero:3376`→3362, `statCard:1955`→1951,
   `shareCard:2180`→2176, `toast:2479`→2463, `globals.css:87,99`→86,97,
   `class-detail-screen.tsx:87`→115. Also the `authorizationActor` call-site count is 19 (20 includes
   its own definition), and §4.4's per-concern line column (112/86/137/148) sums above the physical
   method span (467).
10. **`12 divergent card idioms` as listed.** Composition (not count) fails: `organizationTableRow`
    isn't a card, 7 of the 12 are purge-dead, and the live cross-file family is 6 in portal + 5 in
    `results`/`public`.

**Everything else survived**, including all headline measurements, both dynamic-access sites, the
phantom-class finding (now empirically confirmed in prerendered HTML), the 27 shared classes, the
`.card`/`.badge` absence, `.panel`'s no-standalone-rule twist, the `.summaryCard` fork, the print and
skeleton move-units, the 118-rule census, the service inventory, the `server-only`/`"use client"`
consumer map, and the "no application→components import" fact underlying my §4.4 destination call.
INV-E's ordering constraint (CSS strictly after the §2 purge) is the single most important finding in
it and survives with extra force given #10 above and the `tone*` census.
