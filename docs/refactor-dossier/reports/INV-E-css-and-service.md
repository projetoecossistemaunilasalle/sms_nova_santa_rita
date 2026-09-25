# INV-E — CSS Module reality-check & `adult-portal/service.ts` decomposition

Read-only investigation. All measurements reproducible from `postcss` + regex scans of `src/` (method notes at bottom).
Evidence convention: `file:line`. Plan references are `REFACTOR_PLAN.md` v2.1 §2.3/§4.1/§4.4/§5/§7.1.

---

## CSS measurements

### Baseline vs plan claims

| Metric | Plan §4.1 claim | Measured | Evidence |
| :--- | :--- | :--- | :--- |
| `portal.module.css` lines | 4,910 | **4,910** (`wc -l`) ✓ | file |
| Distinct classes | 308 | **317** leading-selector classes; **319** if counting classes only appearing in compounds/`:not()` (`summaryTextValue`, `demoRoleBlockNotice` appear only as descendant targets, e.g. `portal.module.css:3428`, `:3550`) | postcss walk |
| Rules (incl. keyframe steps) | — | 693 rules, 13 `@media`/`@keyframes` at-rules | `:650,:2488,:2495,:2521,:2655,:2818,:4224,:4254,:4355,:4680,:4710,:4757,:4892` |
| Dead CSS removed by purge | 1,567 lines | **1,823 lines** are block-deletable (union of rule lines whose classes are all dead), **plus 26 mixed rules (161 lines)** that share selector lists with live classes and need *selector surgery*, not deletion | see hazard list |
| `globals.css` `:root` tokens | 68 | **68** ✓ (`globals.css:1-74`) | grep count |
| `results.module.css` / `team-screen.module.css` exist | yes | yes, 378 / 123 lines ✓ | `wc -l` |

### Class census of `portal.module.css` (usage-verified against every `styles.X` / `styles["X"]` / `styles[\`…\`]` in `src/`)

| Bucket | Classes | Rule-line union | Definition |
| :--- | ---: | ---: | :--- |
| **Live** (≥1 surviving consumer importing `portal.module.css`) | 170 | 2,191 pure-live + 161 mixed | — |
| **Purge-dead** (consumers exclusively in §2.2/§2.3 deletion set) | 91 | 1,823 (fully-dead rules, incl. 42 rules inside `@media`) | 8 gen-A components + routes `atividades/`, `materiais/`, `modulos/`, `admin/{jogos,modulos,auditoria}/`, `(public-play)/atividade/` |
| **Never referenced** (already dead today) | 58 | included above | e.g. `steps:1344`, `gameGrid:1439`, `qrCell`, `toggle:3491`, `buttonSmall`, `navLabel:126` |

Purge-dead class list (91): `activityList, activityRow, activityIdentity, activityMark, toneBlue, toneOrange, toneAqua, tonePurple, toneGreen, activityMetric, muted, toolbar, searchField, textarea, filterGroup, builderLayout, panel, sidePanel, reportPanel, panelTitle, panelDescription, formGrid, fieldFull, sidePanelArt, sidePanelBadge, sidePanelBody, summaryList, summaryLine, builderFooter, savedState, detailHero(+Content,+Actions), detailGrid, detailRows, detailRow, linkCard, linkMeta, lifecycleActions, contextNotice, statsGrid, statCard, reportGrid, reportPanelHeader, barChart, barRow, barTrack, barFill, sampleNote, completionRing, legend, shareLayout, successPanel, successMark, shareCard, qrCode, shareUrl, shareActions, srOnly, resultCount, materialTable(+Header,Row,Identity,Meta,Mark), compactEmptyState, editorLayout, editorPaper, uploadPanel, attachmentPanel, demoNotice, editorHeading, textareaShort, contentTextarea, editorSidebar, uploadArt, stickyEditorActions, previewBackdrop, materialPreview, demoFormDialog, previewClose, previewSummary, previewBody, classToolbar, classToolbarActions, classGroupMetrics, demoDialogActions, resultContext`

Never-used list (58): `navLabel, newActivityShortcut, buttonSmall, dashboardGrid, featureCard, featureDots, featureContent, featureActions, weeklyCard, weeklyNumber, weeklyCaption, miniBars, moduleMeta, steps, stepsList, stepItem, step, stepIndex, stepComplete, stepCurrent, stepItemComplete, moduleOptionGrid, gameGrid, moduleOption, gameCard, selectedOption, gameCopy, optionCheck, gameArt, requiredLabel, toggle, toggleActive, sideActions, gameList, compactGame, inlineNotice, dangerNotice, barBlue, barYellow, barOrange, barAqua, qrCell, qrCellBlank, adminNavGroup, floatingDemoAction, classSummaryBand, classDetailGrid, compactActivityRow, recentResultsCard, resultPulse, progressTrack, progressLabel, provisioningNotice, nextSlicePanel, organizationParticipation, organizationBars, dashboardShortcuts, dashboardContextGrid`
(The `tone*` five are in the purge-dead bucket only because the dynamic accesses were credited to their gen-A consumers — a pure static grep calls them "never used"; see next section.)

### Named primitives check (§4.1 / v2.0 text) — across ALL 7 stylesheets

| Plan name | Verdict | Real analogue(s) |
| :--- | :--- | :--- |
| `.button` | **exists** | `portal.module.css:757` (group base `:712-740`, hover `:742`, svg `:749`, disabled `:3675`). *Not* in `results/team/public/marketing/error` modules. |
| `.buttonGhost` | **exists** | `portal.module.css:770` |
| `.input` | **exists** | `portal.module.css:1143` (group `:1125-1135`) |
| `.field` | **exists** | `portal.module.css:1612` + `:1617 .fieldFull`, `:1621 .field label`, `:1627 .fieldHelp`. Note `marketing.module.css:527` defines an **independent** `.field`. |
| `.card` | **DOES NOT EXIST anywhere** (no `.card` rule, no `styles.card` reference in `src/`) | 12 card-idioms instead: `summaryCard:1172`, `stateCard:2405`, `statCard:1955`, `linkCard:1751`, `shareCard:2180`, `classGroupCard:3253`, `moduleCard:1265`, `gameCard`, `featureCard`, `weeklyCard`, `organizationTableRow`, `credentialPrintCard:4160` — visually divergent, none generic |
| `.badge` | **DOES NOT EXIST anywhere** | `.statusBadge:1038` + tones `:1058-1073` (5 classes, single consumer `status-badge.tsx:19-29`) |
| `.panel` "purge-dead" | **CONFIRMED, with a twist**: `.panel` has **no standalone rule** — it only appears in grouped selectors `:1406-1414` and `:1416-1420` alongside dead `.sidePanel`/`.reportPanel` and **live `.detailPanel`** (consumers `class-detail-screen.tsx:87`, `organization-detail-screen.tsx` — survive). Deleting the block kills live styles; the rule must be *edited*, not deleted. |

Prior-review claims verified: ✅ `.card`/`.badge` absent; ✅ `.panel` purge-dead; ✅ ~27 shared classes (exactly **27** live classes with ≥2 surviving consumers); ✅ dynamic access exists (**2**, both gen-A).

---

## class ownership map (summary + the hard cases)

### Surviving consumers of `portal.module.css` (class count each)

| Consumer (`use client` marked) | live classes | Notes |
| :--- | ---: | :--- |
| `src/app/(professional)/portal/loading.tsx` | **45** | entire `portalLoading*` family + `@keyframes portalSkeletonShimmer` (`:650-658`) + local tokens `--portal-skeleton-base/shine` (`:334,:339`) — **the plan never mentions this file** |
| `player-access-workflow.tsx` (client) | 28 | workflow/dialog/player directory |
| `portal-shell.tsx` (server) | 14 | shell/sidebar/topbar/brand |
| `organization-detail-screen.tsx` (client) | 16 | |
| `team-screen.tsx` (client) | 15 | already has `team-screen.module.css` (imports both) |
| `class-detail-screen.tsx` (client) | 13 | |
| `organizations-screen.tsx` (client) | 11 | |
| `classes-screen.tsx` (client) | 11 | |
| `player-credential-print-sheet.tsx` (client) | 10 | **sole consumer of `@media print` `:4355-4391`** |
| `overview-screen.tsx` (client) | 8 | |
| `deactivate-organization-control.tsx` (client) | 7 | |
| `portal-navigation.tsx` (client) | 5 | incl. phantom `mobileNavItem` (below) |
| `page-header.tsx` 5, `adult-portal-form.tsx` 5, `status-badge.tsx` 5, `ajuda/page.tsx` 4, `portal-shell-context.tsx` 3, `portal-state.tsx` 3, `demo-role-controls.tsx` 2, `sem-acesso/page.tsx` 1, `sessao-expirada/page.tsx` 1, `demo-action-button.tsx` 1 (`toast`) | 40 | |

### The 27 shared live classes (≥2 surviving consumers) — must be composed, duplicated, or centralized

`eyebrow`(2) · `button`(4) · `buttonGhost`(2) · `buttonDanger`(2) · `sectionHeader`(3) · `textLink`(3) · `select`(3) · `input`(4) · `summaryStrip`(2) · `summaryCard`(2) · `detailPanel`(2) · `field`(5) · `adminTable`(2) · `tableHeader`(2) · `tableRow`(2) · `tableIdentity`(2) · `personAvatar`(2) · `directoryIcon`(2) · **`demoScopeNotice`(5 screens)** · `inactiveNotice`(2) · `managementPanel`(3) · `formSuccess`(2) · `formError`(4) · `inlineEmpty`(2) · `inlineWarning`(2) · `confirmationDialog`(2) · `confirmationDialogActions`(2)

**Drift is already real:** `results.module.css:1-6` re-declares `.summaryStrip` identically to `portal.module.css:1165-1171`, but `results.module.css:8-36` re-declares `.summaryCard` **divergently** (grid/min-height vs portal's `::after` ring `:1182` and `p`/`strong` treatment `:1193-1205`). `results-screen.tsx` renders with the forked copy. This is the argument for (and hazard of) a primitives file.

### Hard cases for mechanical splitting
1. **118 rules reference live classes owned by ≥2 different surviving files** (fully enumerated in scan output) — e.g. `portal.module.css:4309` `.playerAllocationForm .field, .playerAllocationForm .button, … .formSuccess, .formError` fans across player-access + primitives (4 modules after extraction).
2. `.teamTable .tableHeader` (`:2285`, `:2508`, `:4240-4277`) — `teamTable` is team-screen-only but `tableHeader/Row` are shared with `organizations-screen`; after split, team-screen.module.css cannot express `.teamTable .tableHeader` because `.tableHeader` hashes to primitives' scope. Options: `composes:` on the *element* classes (works — `.tableHeader { composes: tableHeader from "../shared/primitives.module.css" }` keeps both class tokens on the element so `.teamTableHash .tableHeaderOrig` no longer matches → you must instead re-scope as `.teamTable .tableHeader-local`, i.e. duplicate the override), or keep tables in one shared "panels" module with their overrides.
3. Sibling couplings across components: `.demoRoleControls + .navigation` (`:3555`, `:4897`) — demo-role-controls and shell navigation are separate components but one CSS adjacency rule.
4. Parent overrides of primitives in media: `.portalForm > .button` (`:4235`, `:4260`), `.classToolbarActions .button` (`:4823` — dead parent, delete with it), `.organizationStatusControl > .buttonDanger` (`:4403`).

---

## dynamic-access & structural hazards list

### Dynamic `styles[...]` access (exhaustive, whole `src/`)

| # | Location | Expression | Hazard |
| :--- | :--- | :--- | :--- |
| 1 | `src/components/portal/activity-mark.tsx:22` | `` `${styles.activityMark} ${styles[\`tone${tone[0]?.toUpperCase()}${tone.slice(1)}\`] ?? ""}` `` | Resolves `toneBlue/Orange/Aqua/Purple/Green` at runtime. **Invisible to `styles.X` grep** — a grep-based class purge deems those 5 classes dead *while the component still renders them*. Both files are in the §2.3 deletion set, so the purge makes them legitimately dead — but only if CSS purge runs **strictly after** the component deletions land. |
| 2 | `src/components/portal/materials-explorer.tsx:92` | `` `${styles.materialMark} ${styles[\`tone${…}\`]}` `` | same (also unguarded — undefined tone = literal `undefined` in class attr). |

No dynamic access survives the purge, **but** see phantom static references (kept for honesty):

| # | Location | Issue |
| :--- | :--- | :--- |
| 3 | `portal-navigation.tsx:37` | `styles.mobileNavItem` — **class defined in NO stylesheet** → emits `"undefined"` token in `class` attribute (live today). Fix when extracting navigation classes. |
| 4 | `materials-explorer.tsx:105` | `styles.materialAudience` — defined nowhere (latent bug in a purge victim; disappears with §2). |

### Structural (non-class) rules that block mechanical splitting

| Type | Location | Why it blocks mechanical moves |
| :--- | :--- | :--- |
| `@media print` + `:global` | `portal.module.css:4355-4391` (`:global(body) > *` `:4356`, `.printSheet:not([data-player-print-active])` `:4365`, `.credentialPrintCard img` `:4388`) | QR badge printing couples: (a) global `body` visibility, (b) runtime `data-player-print-active` attribute set only by `player-credential-print-sheet.tsx:97-104,118`, (c) 6 print-sheet classes. Must stay together in ONE module, imported only where printing happens. If `:global(body) > *` lands in a file imported by every portal page, printing any page hides the whole body. |
| Keyframes + local tokens | `portalSkeletonShimmer` `:650-658` ← consumed at `:370` by `.portalLoading`, colors from `--portal-skeleton-base/shine` defined `:334,:339` | Animation name + 3 rules + 2 custom properties = atomic unit → belongs in a `loading` module, not in "residual shell". |
| Keyframes | `toastIn` `:2488-2493` ← `.toast:2479` | `.toast` survives via `demo-action-button.tsx:33` → must travel with `toastIn`. |
| Cross-file custom property | `--focus-ring-color` defined in `.sidebar` (`portal.module.css:7`), consumed by `globals.css:120` `:focus-visible` | The global focus ring inherits from the sidebar element subtree. Moving the `.sidebar` rule without line 7 silently changes focus color app-wide (falls back to `--green-dark`). |
| `:global` in modules | `team-screen.module.css:78,84,101,120` (`.demoProfileForm > :global(button/p)`) | precedent; also means element-selector style is used repo-wide. |
| Element/descendant couplings (class needed on ancestor from another file) | `.navLink svg:139`, `.logoutButton svg:226`, `.schoolChip svg/span:257,263`, `.button svg:749`, `.sectionHeader h2,h3:916`, `.summaryCard p:1193`, `.searchField input,.select,.input,.textarea:1125` (mixed dead `searchField,textarea` — selector-list surgery), `.field label,.field > span:1621`, `.detailPanel h2,.reportPanel h2:1810` (mixed live/dead!), `.stateCard h1,h2:2438`, `.tableIdentity span:last-child:2337`, `.confirmationDialogActions > button:3935`, `.organizationOverview dl div:4461`, `.demoRoleControls select/button:3523-3548` | These are *markup-shape contracts* (`<h2>` inside `.sectionHeader`, `<label>` inside `.field`…). Extraction must move each with the class that owns the element, and 4 of them mix live+dead classes in one selector list (the 26 mixed rules). |
| Media blocks reflowing multiple components together | `@media (max-width:900px):2521-2653` (shell+tables+loading), `(max-width:680px):2655-2816`, `:4254-4353` (forms+player-access+team), `:4757-4890` (org/classes/overview screens), `(max-width:980px):4224-4252` (`:4225` rule alone spans 5 future modules) | Every screen module must carry a copy of the relevant media slice; a "shared media section" cannot be split mechanically. 42 dead rules inside `@media` must be cut from live blocks. |
| Vendor prefixes / `@import` / `@font-face` / `@property` | 3 `-webkit-` decls in `portal.module.css` (`::-webkit` scrollbar/none critical), 2 in `globals.css:87,99` | No blockers found; prefixes are on standard properties (`-webkit-text-size-adjust`, `-webkit-font-smoothing`). |
| `composes` availability | `node_modules/next/dist/docs/01-app/03-api-reference/08-turbopack.md:360` | Turbopack supports `composes` **only between `.module.css` files** (never from `globals.css`). This project builds with Turbopack config surface (`next.config.ts:42 turbopack.resolveAlias`). |

---

## proposed CSS layout with line budgets

Rule-of-thumb conversion used below: file lines ≈ rule lines × 1.35 (comments + blanks + at-rule wrappers), measured across this repo's modules.

| File | Contents (class ownership, not aspirational names) | Rule lines | **Projected file lines** | §7.1 (300/600) |
| :--- | :--- | ---: | ---: | :--- |
| `src/components/shared/primitives.module.css` | buttons(5)+svg/disabled, `input/select/textarea`, `field/fieldHelp/fieldFull`, `formError/formSuccess`, `muted?`(no—dead) `textLink`, `statusBadge`+4 tones, `stateCard/stateIcon/stateActions`, `toast`+`toastIn`, `summaryStrip/summaryCard`, `sectionHeader`, `detailPanel`, `managementPanel`, `demoScopeNotice`, `inactiveNotice`, `inlineEmpty/inlineWarning`, `confirmationDialog(+Actions)`, `adminTable/tableHeader/tableRow/tableIdentity/tableIdentityIcon/personAvatar`, `eyebrow` | 410 + ~90 shared-slice from mixed/media | **~520–560** | warn+ (over 300, under 600) |
| `portal.module.css` (residual) | shell: `shell,sidebar(+--focus-ring-color),brand*,workspace,topbar,schoolChip,topbarActions,helpLink,content,sidebarProfile*,logoutButton`, navigation: `navigation,navGroup,navLink,navLinkActive,desktopNavItem`, page-header 4 + `pageTitle/Description/Actions`, `portalForm,inlineMutationForm` (single-consumer but form-primitive — put here to keep `.portalForm > .button` together), shell media slices `:2521-2603` | ~460–500 | **~560–620** | **borderline at 600-fail** — see note |
| `portal-loading.module.css` | 45 `portalLoading*` + keyframes `:650-658` + `--portal-skeleton-*` + media `:2617-2624` piece | ~300 | **~330–400** | warn+ |
| `classes-screen.module.css` | classes-screen.tsx 11 + class-detail-screen 13 (incl. `classDetailHero:3376`, `assignmentList:3758`, `classManagementGrid`) | ~230 | **~280–330** | pass/warn edge |
| `organizations-screen.module.css` | organizations-screen 11 + organization-detail-screen 16 (`organizationOverview:4419`, `compactDirectory`, `peopleStack`, `organizationSeal`…) | ~265 | **~330–380** | warn+ |
| `overview-screen.module.css` | overview 8 + `roleContextBand:3733`, `dashboardCompactList` (shared w/ org-detail — put in org module, compose/duplicate 3 rules) | ~90 | **~130** | pass — **honestly too small to justify its own file**; fold into `overview-screen.module.css` anyway for symmetry or skip |
| `player-access.module.css` | workflow 28 + print-sheet 10 + `sessionControl*`, `issuedCredentials*` + **entire `@media print` block** | ~490 | **~560–620** | **borderline at 600-fail** |
| unchanged | `results.module.css`(378), `team-screen.module.css`(123) — leave the `.summaryCard` drift alone this sprint | — | — | — |

Post-purge residual total sanity: 4,910 − 1,823 (block-deleted) − ~110 (mixed-rule dead parts) + 0 = **~2,950–3,050 lines redistributed above** (≈2,800 rules+overhead; the ~150-line slack is media wrappers and duplicated reflow slices).

**Honest verdict on §7.1 for CSS:** with the shell, loading, and player-access+print masses as they are, **every meaningful module lands in 300–620** — the 600-fail is achievable *only* with the exact decomposition above (keeping `@media print` inside player-access and *not* letting primitives absorb screen panels), and the **300-warn is unattainable for 5 of 7 files**. Recommended corrected budget: **CSS Modules: 450 warn / 650 fail**, or keep 300/600 and accept the two borderline files as documented exceptions. The plan's implicit assumption that screens split cleanly under 300 is false: `loading.tsx` alone is ~330.

---

## ordered CSS steps + verification

Ordering constraint (§7 of task): **all CSS work happens after §2 purge (Day 1) and after §3.1/§3.3 seam edits to `portal-shell.tsx` (Day 2)** — the purge is what makes 91 classes + both dynamic-access files dead, and Day 2 rewrites the shell JSX whose classes the residual keeps. Doing extraction before the purge moves dead CSS twice; doing shell extraction before Day 2's form→Client-Component conversion edits the same JSX twice.

| Step | Action (each = one committable change) | Independent verification |
| :--- | :--- | :--- |
| E0 | Freeze: record `wc -l` manifest + a class→file usage dump (this investigation's scan) as the golden baseline; add the dump as a CI artifact script (read-only). | `npm run check` green at baseline. |
| E1 | *(post-purge)* Re-run usage scan: confirm surviving class set = 170 live + the 26 mixed-rule list is the only residual dead reference. | Scan output diff = ∅. |
| E2 | Delete 149 dead/unused classes **rule-block-wise**, skipping the 26 mixed rules. | File shrinks ≈ −1,823 lines; page-by-page smoke (routes below) — nothing renders differently; scan: no *used* class deleted (mechanical). |
| E3 | Selector-surgery on the 26 mixed rules (`:1125,:1406,:1416,:1810,:2535,:2547,:2600,:2617,:2722,:2727,:2827,:3347,:3351,:3428,:3559,:3574,:3586,:3591,:3610,:3616,:4582,:4715,:4797,:4823,:4842,:4878`) — remove dead selectors from lists. | Visual diff of `turmas` (`.detailPanel` intact), `.field` forms, reduced-motion check. |
| E4 | Extract `portal-loading.module.css` (atomic: keyframes + `--portal-skeleton-*`). Update `loading.tsx` import; delete `styles` refs. | Devtools: `/portal` slow-3G — shimmer animates (proves name-scoping moved intact). |
| E5 | Extract `primitives.module.css` per table; keep every `.parent .button`-style override **with the parent** by duplicating those 8–10 override rules into the parent module (no cross-module descendant selectors). | `npm run check`; visual pass on forms/buttons across all surviving routes. |
| E6 | Extract `player-access.module.css` incl. `@media print` (verify `:global(body) > *` exists ONLY here + nothing else imports print rules). | Print preview on `/portal/resultados/demo-turma-3a/players/<slot>`: 2-up badges, single active sheet; confirm other pages' print unaffected. |
| E7 | Extract `classes-screen` / `organizations-screen` / `overview-screen` modules (+media slices). | Per-screen visual pass at 1280/900/680 px. |
| E8 | Residual `portal.module.css` = shell+nav+header; fix phantom `mobileNavItem` (`portal-navigation.tsx:37`) by defining `.mobileNavItem { display:none }` counterpart or dropping the ternary. | Full route matrix below; grep `class="undefined"` in rendered HTML. |

**Visual-regression matrix (`npm run dev:demo`, basePath `/SMS_Portal`):** `/entrar` · `/portal` · `/portal/turmas` · `/portal/turmas/demo-turma-3a` · `/portal/resultados` · `/portal/resultados/demo-turma-3a` · `…/players/<slotId>` (+print) · `/portal/admin/organizacoes` · `/portal/admin/organizacoes/<orgId>` · `/portal/admin/equipe` · `/portal/ajuda` · `/portal/sem-acesso` · `/portal/sessao-expirada` · `/` (marketing) · `/jogar` (public regression — shares token vocabulary but not the module). Viewports: 1280, 1120(E), 980, 900, 680, 360. Flags: `prefers-reduced-motion: reduce`, print emulation, and demo role switcher (`DemoRoleControls`) for all three roles — navigation visibility is the most coupled surface.

---

## service.ts inventory

`src/application/adult-portal/service.ts` (616 lines): imports Prisma enums (`:1-5`), 4 policy fns from `src/server/authorization/v1-policy` (`:6-11`), own `errors/ports/schemas/types`. **No `"use client"`, no server-only marker — it runs on both sides (see consumers).**

### Module-level helpers (the actual "guards")

| Function | Lines | Call sites in this file | Duplicated elsewhere? |
| :--- | :--- | ---: | :--- |
| `authorizationActor` | 49-61 | **20** | **YES** — identical 13-line clone at `src/application/player-access/service.ts:15-25` |
| `activeOrganizationIds` | 63-72 | 4 | no |
| `effectiveRole` | 74-91 | 1 (`getShell`; re-implemented client-side in `adult-portal-helpers.ts:34 demoRole` + `portal-shell-context.tsx:10 roleLabel`) | semantic dup ×2 |
| `requireActor` | 93-101 | 1 (`this.actor`) | no |
| `notFound` / `forbidden` | 103-109 | 10 / 13 | `player-access` has `fail()` equivalent (`player-access/service.ts:27+`) |

### Public methods (17) — 114-587, private `actor` 114-119, `assertActiveOrganization` 589-601 (4 calls), `assertActiveProfile` 603-615 (4 calls)

| Concern | Methods (lines) | Count | Lines |
| :--- | :--- | ---: | ---: |
| **Shell / presentation** | `getShell` 121-207 (87 — role label/scope label/**navigation array built by hand `:140-195`**), `getOverview` 209-233 (aggregates getShell+listOrgs+listClasses+store) | 2 | 112 |
| **Organization** | `listOrganizations` 235-254, `getOrganization` 256-280, `createOrganization` 282-289, `changeOrganizationStatus` 291-307 | 4 | 86 |
| **Team / membership** | `listTeam` 309-319, `listProvisionedProfiles` 321-335, `assignOrganizationAdministrator` 337-371, `assignTeacher` 373-401, `changeMembership` 403-445 | 5 | 137 |
| **Class** | `listClasses` 447-480, `getClass` 482-493, `createClass` 495-504, `changeClassStatus` 506-518, `assignTeacherToClass` 520-567, `deactivateTeacherAssignment` 569-587 | 6 | 148 |
| Infra | constructor 112, `this.actor` 114-119 + 17 calls; `store.transaction` 9 calls; `schema.parse(input)` 9 calls | — | — |

### Consumers (grep evidence)

| Consumer | Layer | Detail |
| :--- | :--- | :--- |
| `src/server/services/adult-portal-container.ts:13` | server (used from `adult-portal-server.ts:1,7` which is `import "server-only"`) | production DI |
| `src/runtime/adult-portal-demo.ts:10` | build-time static render (demo readers; `readDemoAdultPortalState` guards `window` at `adult-portal-demo-store.ts:346`) | `getPortalShellData/getPortalOverviewData/page data` — `layout.tsx:9,30` consumes via `@runtime/adult-portal` alias (`next.config.ts:52`) |
| `src/runtime/adult-portal-demo-actions.ts:50` | **`"use client"` (line 1)** | the service (incl. `effectiveRole`, guards, zod schemas) is in the **browser bundle** in demo mode |
| `src/runtime/demo-professional-creation.ts:60` | shared with demo-actions client path | ditto |
| `tests/unit/adult-portal-service.test.ts:17` | vitest | 11 tests: authorization/membership/classes; **zero coverage of `getShell`/navigation** (grep `getShell` → no match) |
| `src/runtime/adult-portal-server.ts:29,54,65` | server | **uses `getShell()` solely for `.effectiveRole`** (3 of its 4 call sites discard the navigation entirely) |
| UI | `portal-shell.tsx:44,52` (server comp) passes `shell.navigation` → `portal-navigation.tsx` (**client**, rebuilds navigation itself for demo `:57-126`) → `portal-shell-context.tsx:10-16,54` (client) re-derives roleLabel/scopeLabel | navigation/shell presentation exists in **4 places**: `service.ts:140-195`, `portal-navigation.tsx:60-125`, `portal-shell-context.tsx:10-16`, `adult-portal-helpers.ts:34,98` |

Local convention (siblings): one class per folder (`PlayerAccessService` 180 ln, `GameStateService` 194 ln, both `class … { constructor(ports) }`, module-level guards, zod in `schemas.ts`, DTOs in `types.ts`); UI-adjacent view-model helpers for demo live in **`src/components/portal/adult-portal-helpers.ts`** — i.e. *the repo already has a "components importing pure helpers from components, application importing types from application" pattern; client components import application **types** (`portal-navigation.tsx:7`, `portal-shell-context.tsx:3`) but no application code imports from `src/components/`.

---

## §4.4 assessment (do / do differently / skip)

**§4.4-1 "extract `getShell()` navigation into `src/components/portal/portal-navigation-presenter.ts`" — DO, but differently (location inverted).**
- *Would moving it to `components/` create a server→client hazard?* Not a hard one: a pure `.ts` without `"use client"` is importable from both graphs, and `service.ts` already ships to the client via `adult-portal-demo-actions.ts` (`"use client"`). The hazard is **architectural direction**: `service.ts` (application) would import from `src/components/` (UI), a dependency the codebase has **zero** instances of (application→components); conversely components→application/type imports are the established norm (4 files). It also drags a file whose sibling (`portal-navigation.tsx`) is `"use client"` into a Server Component's import chain (`portal-shell.tsx` is server) — fragile by convention if not by bundler.
- *Where does navigation belong?* As a **pure view-model function in the application layer** consumed by both sides: `getShell` needs it server-side; `portal-navigation.tsx:60-125` already re-implements it client-side for demo; `PortalShellDto.navigation: NavigationItemDto[]` (`types.ts:88-101`) is already a DTO contract. The presenter concept is right; the folder is wrong.
- **What already does this job:** `portal-navigation.tsx` (renders + demo-role rebuilds items) and `adult-portal-helpers.ts:34 demoRole`/`:98 demoScopeLabel`/`:123 isPortalNavigationItemCurrent` (+ its test `tests/unit/portal-navigation.test.ts:11-31` — active-state matching only). Extracting `buildNavigation(role, orgId)` and `buildRoleLabel/buildScopeLabel` next to `types.ts` lets all four copies collapse into one.
- Test safety net for this move is **nil** (`getShell` untested) → add 1 test file for the pure builder before moving.

**§4.4-2 "split into organization/class/team services + `authorization-guards.ts`" — mostly SKIP; over-fragmentation.**
- Method counts per concern are 4/5/6 — each resulting service would be 90–150 method-lines; three folders × (service+ports+schemas+types) is 12 files where 2 exist. Cross-coupling exists: `getOverview` calls `listOrganizations` + `listClasses` + `getShell` (`:209-233`); a 3-way split forces service-injection or moves aggregation into runtime, churning all 6 runtime consumers + the container + the 11 tests.
- The ratchet pressure is real though: **616 > 500 (fail)**. The minimal justified cut: pull the shell view-model (~90 ln, §4.4-1 fixed) + module helpers (~60 ln, incl. `authorizationActor` which kills the `player-access/service.ts:15` duplicate) → `service.ts` ≈ 460–470, passing fail without inventing 3 services. 300-warn still misses — flag as documented debt, like the CSS warn line.

---

## proposed service layout

```
src/application/adult-portal/
  service.ts                 (~465) AdultPortalService, org/team/class methods untouched
  shell-view-model.ts         (~110) pure: effectiveRole*, buildRoleLabel, buildScopeLabel,
                                     buildNavigation(role, activeMembershipOrgId) → NavigationItemDto[]
                                     (*effectiveRole needs ActorSnapshot — stays pure, no store)
  authorization-guards.ts     (~85)  authorizationActor, activeOrganizationIds, requireActor,
                                     notFound, forbidden (AdultPortalError re-use)
  ports.ts / types.ts / schemas.ts / errors.ts   unchanged
src/application/player-access/
  service.ts                 (−13)  local authorizationActor deleted → import guards
src/components/portal/
  portal-navigation.tsx              demo branch rewritten:
                                     buildNavigation(demoRole(state), orgId) — deletes :60-125
  portal-shell-context.tsx           local roleLabel deleted → buildRoleLabel — deletes :10-16
  adult-portal-helpers.ts            demoScopeLabel delegates to buildScopeLabel
src/runtime/adult-portal-server.ts   :29,:54,:65 switch getShell→ cheap `service.getActorRole(id)`
                                     (new 3-line method wrapping `this.actor` + effectiveRole) — stops
                                     building navigation labels just to read a role
```
No new service folders. `REFACTOR_PLAN §4.4-1` is honored in substance (navigation out of the domain class) without the `components/` placement; `§4.4-2` replaced by guards + view-model extraction.

---

## regression risks

1. **Ordering** (highest): CSS purge before the §2 file deletions ⇒ `tone*` classes stripped from live gen-A components (dynamic access), and dead screen CSS migrated twice. Mitigation: E-steps gated on Day-1 purge merge (see ordered steps).
2. **`@media print` relocation**: `:global(body) > *` (`:4356`) landing in a shared module would blank-print every portal page; conversely splitting print rules from `.printSheet` breaks badge output. Print verification is per-physical-page — CI can't catch it; manual check mandated in E6.
3. **Class-name hashing at module boundaries**: 118 multi-file coupled rules; any `.parent .child` pair accidentally split across two modules **silently stops matching in production** (both classes hash per-file; dev shows it too — but only if someone notices the missing style). E5/E7 must duplicate override rules rather than span files.
4. **Cascade-order change**: today one file guarantees ordering (e.g. `.button:3675 :disabled` after media `:4235`); after splitting, load order follows the JS import graph — same-specificity conflicts (`.select:1148` vs media `:2722`) could flip. Keep each primitive's media overrides inside primitives.module.css.
5. **`--focus-ring-color:7`** moving out of `.sidebar` changes global focus ring (`globals.css:120`).
6. **Skeleton shimmer**: keyframes name-scoping — if `@keyframes portalSkeletonShimmer` is left behind when `.portalLoading*` moves, `animation-name` de-scoping mismatch breaks the loading screen (only visible on cold nav with throttling).
7. **`mobileNavItem` phantom fix** (E8) alters rendered `class` attribute on nav links — verify no test/selector depends on the literal string `"undefined"` (none found in `tests/`).
8. **Service**: zero tests for `getShell` — pure-function extraction is type-checked but behavior-untested until a new `shell-view-model.test.ts` lands; demo client bundle gains no new import (guards are already there via `service.ts`), so §3.1 E625 manifest count unchanged.
9. **`results.module.css` drift temptation**: deduping `.summaryCard/.summaryStrip/reportPanel` against primitives changes the Results screen rendering — explicitly out of scope (matches §5 "assessment only").

## open questions

1. §4.1's "308 distinct classes / 1,567 dead lines": methodology undocumented; measured 317/319 and 1,823+161. Adopt a **tool-generated manifest** (E0) as the ratchet oracle or keep prose numbers?
2. Does the team want `overview-screen.module.css` at all (~130 lines), or fold its 8 classes + `roleContextBand` into the residual shell (making residual ~690 > 600-fail)? The §7.1 numbers are only satisfiable with the small file kept — budget vs cohesion call.
3. §7.1 CSS 300-warn is unreachable for 5/7 proposed modules → amend to 450/650 (or per-module exceptions in the plan), or ship knowingly-violating warns?
4. Who owns the fix for the two phantom classes (`mobileNavItem`, `materialAudience`)? One disappears with §2; the other is a live-rendering bug in a surviving component.
5. Should `getShell()` keep the `names.length`-based `scopeLabel` (`:129-139`) if `adult-portal-helpers.ts:98 demoScopeLabel` already computes the same string client-side with a subtly different algorithm? Needs one canonical `buildScopeLabel` decision + a golden-string test before E of the shell work.
6. `results-screen.tsx` and `team-screen.tsx` already dual-import their own modules + `portal.module.css`; primitives extraction may let them drop the second import — but that's a JSX diff on 2 surviving screens; approve or defer to Sprint 2 (Tailwind assessment, §5)?

---

*Method note: class census = postcss walk of `portal.module.css` (leading-selector 317 / any-position 319); usage = all `styles.X`, `styles["X"]` and `styles[`…`]` matches in `src/**/*.{ts,tsx}` credited to files importing `portal.module.css`; `tone*` credited to the two dynamic-access files; dead/live per §2.2+§2.3 deletion set; line attributions = union of rule source lines.*
