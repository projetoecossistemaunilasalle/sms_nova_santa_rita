# REFACTOR_PLAN.md v2.0 — The Complete Critique

**Document reviewed:** `REFACTOR_PLAN.md` (repo root, v2.0, 244 lines, dated 23 September 2026, "Updated post multi-agent adversarial audit")
**Prepared:** 23 September 2026
**Method:** 6 scoped reviewers → 6 adversarial verifiers (each instructed to refute its paired report) → main-agent tiebreak measurements on every disputed number. This file is the union of all 13 documents; the per-agent originals remain in this folder for provenance.
**Integrity note:** no code, config, or plan file was modified. The worktree's 33 pre-existing modifications were unchanged by all 12 agents.

**Verdict vocabulary**
*Review stage:* CONFIRMED · PARTIAL · WRONG · UNSUPPORTED · MISSING.
*Verification stage:* UPHELD (reproduced) · OVERSTATED (real, wrong magnitude/severity) · REFUTED (false) · UNREPRODUCIBLE (no command produces it).
Every finding below carries the **final** status after verification. Findings that did not survive are in §6, not in the defect registers.

---

## 1. Executive verdict

**The plan is factually better than most plans of its kind and still not executable.** Its measurements are largely exact — 20 of its quantitative claims reproduced to the digit, including the one its own reviewers attacked hardest (§4.1's "~1,570 lines of dead CSS", re-measured at 1,567 physical lines). What fails is *causality and closure*: the deletion manifest is not closed under its own import graph, its central architectural fix has no working mechanism, its database work has no migration path, and its verification gates are either vacuous, unmeasured, or already-false.

Nine defects survived refutation. Four stop Day 1 or Day 2 outright. One makes a Day-4 success criterion unattainable. One makes the sprint's headline number indefensible.

| Rank | Defect | Where | Final severity | Agents that confirmed |
| :-- | :-- | :-- | :-- | :-- |
| 1 | Action Seam has no compilable mechanism; the plan deletes the aliases that *are* today's selector without naming a replacement | §3.1, §6 Day 2, §7.2 | **BLOCKER** | RV-C, VV-C, RV-F, VV-F |
| 2 | Purge not closed under its import graph (`service-container.ts`, `authorization.test.ts`) | §2.1(3), §2.3, §2.4, §6 Day 1 | **BLOCKER** | RV-A, RV-B, RV-F · VV-A, VV-B, VV-F · **main agent** |
| 3 | Auditoria repointed at `AuditEvent`, whose sole writer §2.3 deletes | §2.1(2) | **BLOCKER** | RV-A, RV-B, RV-F · VV-B, VV-F |
| 4 | Schema drops with no migration; `prisma validate` cannot see the drift; R1 still open and 2 migrations untracked | §2.5, §6 Day 1 | **BLOCKER** | RV-B, RV-D, RV-F · VV-B, VV-D, VV-A, VV-F |
| 5 | §7.1 ("zero files over 400 lines") fails on 9 surviving, unbudgeted files | §7.1 vs §4 | **BLOCKER** (planning) | RV-B, RV-F · VV-B, VV-F · **main agent** |
| 6 | 3–4 days vs the audited 12–21 developer-days for the same scope | §1.2, §6 | **BLOCKER** (planning) | RV-B · VV-B (estimate 7.5–14 for the scheduled subset) |
| 7 | Demo-created entities 404 on refresh → §7.5 unattainable | §3.3, §7.5 | **MAJOR** | RV-C · VV-C |
| 8 | `deploy.yml` publishes Pages on every push to `main` with no lint/test/typecheck; Days 2–3 have no build gate | §6 Phase 0, §7.4 | **MAJOR** | RV-F · VV-F, RV-B (M9) |
| 9 | §3.2's stated benefit is not delivered by its stated change; "42 surviving imports" is a pre-purge count | §3.2 | **MAJOR** (claim) | RV-D, RV-B, RV-F · VV-D, VV-A |

The plan's own §1.1 framing is contradicted by its §3.1: it lists "Duplicated Server Actions (one `\"use server\"`, one `\"use client\"`)" as a core problem and then adopts exactly that shape as the target architecture, with no §7 criterion forbidding it (`REFACTOR_PLAN.md:19` vs `:100-101`, `:123-124`).

---

## 2. §1–§2 — The Generation A purge

### 2.1 BLOCKER — `service-container.ts` must be deleted, not "cleaned"
§2.1 item 3 removes 2 of the 4 imports in `src/server/services/service-container.ts`. Verified directly:

```
:1 import { PrismaCapabilityReader } from "@/server/db/prisma-capability-reader";
:2 import { PrismaAccessLinkStore }  from "@/server/db/prisma-access-link-store";
:3 import { AccessLinkService }       from "@/server/services/access-link-service";
:4 import { AuthorizationService }    from "@/server/services/authorization-service";
```

All four targets are in §2.3's delete list (the plan names only the middle two). Live uses remain at `:19` and `:36`; the file's only two exports are Generation-A services; all 8 of its importers sit inside the delete set. So the file is Generation-A dead weight and must join §2.3 — its 45 lines are also missing from the "~6,450" tally. Two reviewers plus one verifier reached "delete the file"; one reviewer reached only "the plan is incomplete". The delete reading is the correct one.

### 2.2 BLOCKER — a surviving test imports a deleted service
`tests/unit/authorization.test.ts` (634 lines, 24 `it()` cases) imports `AuthorizationService`, `CapabilityAssignmentRecord` and `CapabilityReader` from `src/server/services/authorization-service.ts` (import block at lines 5-10). §2.4 does not list it. Tests are inside the `typecheck` program, so **Day 1's own gate fails at close**, and `npm test` loses 24 more cases than budgeted: 78 of 234 planned (33.3%) becomes 102 of 234 (43.6%) — figures a verifier had to correct because the original reviewer mixed two counting methods. No retention gate exists in §7.4, whose "for active code" wording actively permits the drop.

A completeness sweep of `tests/` found **exactly 6** test files importing deletion-manifest modules: the 5 listed in §2.4 plus this one. Both counts were reproduced independently by a verifier.

### 2.3 BLOCKER — §2.1(2) is a false choice
"Repoint `admin/auditoria/page.tsx` to read from the real `AuditEvent` table, or remove the page" — measured, the repo's **only** `auditEvent` write is `src/server/db/prisma-access-link-store.ts:325-326`, driven by 7 call sites in `access-link-service.ts` (`:294,350,415,473,514,553,644`). All three files are deleted by §2.3. No surviving V1 store writes audit rows (`prisma-{adult-portal,player-access,game-state,game-event}-store.ts` → zero hits). Option (a) therefore yields a permanently empty screen while `model AuditEvent` (`schema.prisma:281`) and `Capability.AUDIT_VIEW` (`:23`) survive. The unstated third option — "ship a V1 audit writer" — is real work; and deleting the page is not free either, since `PRODUCT.md:189` and `docs/implementation/v1-architecture-plan.md:35` ("limited audit") expect traceability. Relatedly, the page is already unreachable, and §1.1's claim that server mode renders it empty is CONFIRMED (`portal-view-service.ts:416` returns `[]` off-demo-runtime).

### 2.4 §2.1(1)'s rationale is wrong, its ordering is not — *disputed, adjudicated as mechanism-only*
The claim that `ActivityStatus` must be relocated or "6 active importing screens" break:
- `type ActivityStatus` is really declared in `portal-view-service.ts`, and `status-badge.tsx:1,6` is its only surviving consumer — both CONFIRMED.
- But no surviving screen *produces* the type's members: `recordStatusLabel` (`adult-portal-helpers.ts:15`) returns `"Ativa" | "Inativa"`, and all 10 surviving `StatusBadge` call sites pass `recordStatusLabel(...)` output. So the relocation is over-scoped; a prune of `status-badge.tsx` suffices — and it is still a pre-purge edit, because `status-badge.tsx:18/23/25` compare against `"Aberta"/"Rascunho"/"Pausada"`, which would otherwise raise TS2367.
- **Correction to both reviewers:** the prune is 5 lines, not 2 (a verifier's own error, corrected).
- One reviewer listed this as CONFIRMED-required (RV-F, PART H item 3); the disagreement is only about relocate-vs-prune, not about doing it before the purge. Unresolved as a *design* choice; resolved as *ordering*.

### 2.5 Manifest hygiene (all MINOR, all reproduced)
- **§2.2 is 6/6 exact** (21 files, 1,681 lines), including "a 517-line action file"; the "obsolete redirect stub" and "replaced by" claims verified by reading the files.
- **§2.3: 0 phantom paths**, all 17 files exist; "zero consumers" verified for 14 of 17; `class-groups-explorer.tsx` is *stronger* than claimed (0 importers already); `public-shell.tsx` and `portal-state.tsx` correctly excluded (survivors need them).
- **§2.4: 5/5 exact** (56/13/5/2/2; 1,625-line test file exact).
- **Units bug in "Verified Lines":** 4 rows are non-blank counts presented as lines (`activity-builder` 244→256 physical, `activity-controls` 147→156, `material-editor` 252→266, `class-groups-explorer` 228→237) and `materials-explorer` = 120 matches **neither** metric (132 physical / 124 non-blank).
- **"~6,450" reproduced as non-blank only:** the tables sum to **7,050 physical / 6,439 non-blank**. Fold in §2.2+§2.3's two misses and the honest figure is ~7,729 physical (~29% of hand-written TypeScript). §1.1, §2 and §6 all repeat 6,450 with no units statement.
- **Cleanup the manifest omits:** the `/atividade/` guard and stale Referer comment in `src/proxy.ts:109-116`; the nav special case `adult-portal-helpers.ts:136` ("Links de acesso", 0 coverage); 3 of 4 topics in `ajuda/page.tsx:9,17-23`; `auth.test.ts:146-147` fixtures naming a deleted route; a `requestPasswordResetAction` that is fully orphaned yet still ships `out/entrar/recuperar/index.html` as a dead form.

### 2.6 §2.5 beyond the two relations
The plan's two inverse-relation citations (`schema.prisma:65`, `:80`) are **exact at both HEAD and worktree**, and the count of "two" is correct — so `prisma validate` genuinely cannot fail on this edit. What §2.5 misses:
- `enum Capability.LINK_VIEW` / `LINK_MANAGE` (`:19-20`) become dead in schema *and* in the PostgreSQL enum (`0_init/migration.sql:8`).
- Stronger: **the whole capability layer loses its last readers.** `CapabilityAssignment` (`:245`), `Organization.scopedCapabilities` (`:79`) and `enum Capability` are reachable only from `prisma-capability-reader.ts`, `authorization-service.ts` and `service-container.ts`, all deleted; `authorization/v1-policy.ts:1-5` never imports `Capability`. The purge strands a live table and the audit trail never mentions it.
- `RateLimitBucket` is relation-free and has **0** hand-written references — "unreferenced in code" is exact. But `RATE_LIMITED` stays live at `src/server/http/errors.ts:11` and `contracts/schemas/api-error.v1.schema.json:21`, so the plan performs half of the audit's paired instruction ("drop the model **and the `RATE_LIMITED` code**").
- `src/generated/prisma` goes stale mid-Day 1 (`internal/class.ts:23` `inlineSchema`, `client.ts:110-113`, `browser.ts:86-89`); the gate list omits `prisma generate`.
- **Migration mechanics (§2.5 + §6 Day 1): the sprint's second-largest hole.** `access_links` and `rate_limit_buckets` are created in `0_init/migration.sql` (`:58`, `:90`; plus FK/index touches at `:70,117,120,123,150,153,163,166,169`) and `1_add_paused_at:3`; `package.json` has no `migrate` script at all; and `prisma validate` ignores `migrations/`. Note that `ALTER TYPE … DELETE VALUE` cannot remove values present in rows, so a retention decision is required, not just DDL.

---

## 3. §3 — Dual runtime and the Action Seam (the plan's load-bearing failure)

### 3.1 The Next.js constraint is real and correctly cited
`E625` was verified in the installed source, not from memory: `node_modules/next/dist/export/index.js:380-384`, with **no `buildExport` exemption** (its i18n sibling at `:336` and images sibling at `:343` *are* guarded — the asymmetry strengthens the finding) and no config opt-out (`config-schema.js:245-248`). The plan's §3.1 premise is correct. Two precisions: the throw precedes "Start the rendering process" (`:388`), so it fails at the compile→export handoff, not after all routes prerender; and the enclosing function is `exportAppImpl`, not `runNextExport`.

### 3.2 BLOCKER — why the seam as specified cannot compile
A verifier's decisive measurement: **E625 is a bundle-graph *membership* gate, not a call-site check.** This repo exports 24 `"use server"` actions but only 17 appear in `.next/server/server-reference-manifest.json` — and *any* statically reachable server variant registers ids and aborts `build:demo`. Consequences the plan does not reckon with:
- A single `contracts.ts` seam that imports both variants registers the server branch → export dies. `process.env` ternaries do not strip ESM registration; dynamic `import()` bundles both variants unless `turbopackIgnore` is used, and then it is untypechecked and fails at runtime on a static host.
- "Forms and buttons consume action handlers passed through the composition seam" is illegal across the Server→Client boundary (plain functions are not serializable — vendored `use-client.md:50,56,70`).
- Two Server Components bind actions straight to JSX today (`entrar/page.tsx:73`, `portal-shell.tsx:68`) and survive only via uncommitted `runtimeMode` guards and throwing stubs (`src/runtime/demo-auth-actions.ts:1-7`, which has no directive at all — the twins are never checked against each other).
- The aliases are also the **build-time data-reader** selector: 12 of the seam specifiers are async reads executed during export by Server Components, where `localStorage` does not exist in the prerender Node context (`adult-portal-demo-store.ts:347` proves the fallback). Those cannot traverse a runtime seam *at all*; a client-only seam fixes neither half and would imply ~17 new POST handlers.
- Consumer surface, counted: 9 aliases (`next.config.ts:44-76` ↔ `tsconfig.json:24-42`), 24 import sites / 38 specifiers / 23 files, 95 `runtimeMode` branches across 23 files. §7.2 as worded is gameable, and §7.2 versus §7.5 are in direct conflict.

### 3.3 The four designs the plan should have chosen among
1. **Generated per-target entry (best fit).** A gitignored `src/runtime/target.ts`, *written* by `scripts/next-target.mjs` before spawning `next`, re-exporting either `target.server.ts` or `target.demo.ts`; both implement `contracts.ts`, so drift is a `tsc` error at edit time; consumers import a plain relative path; zero alias pairs in either config → §7.2 literally satisfied, and the demo graph never contains `"use server"`.
2. **One surviving typed alias.** Cheapest, but is precisely what §7.2 forbids by name — only viable if the criterion is reworded to "one typed selection point" (which the audit's `:747-748` already formulates compatibly).
3. **Dedicated static entry — the repo's own governance answer** (`docs/implementation/v1-architecture-plan.md:69-71`: "give the demo a dedicated static entry rather than weakening server behavior"). Two route subtrees sharing presentational components; selection by which tree imports which provider; removes module-resolution switching entirely; costs extra page files that Day 1-2 never budgets.
4. **Fixing the two `<form action>` sites** in any of the above: move each sign-in/sign-out form into a small Client Component that imports the target module internally — no throwing stubs, no mode-conditional JSX.
In all cases §3.1 must say "**actions *and* readers** both resolve through the typed target module," not "actions."

### 3.4 §3.3 / §3.4 / §7.5 residuals
- **MAJOR:** `generateStaticParams` returns seed ids only and `out/portal/turmas` holds exactly 3 prerendered pages, so any demo-created class 404s on refresh — contradicting §3.3's own deep-link justification and making §7.5's "fully operational in-browser navigation" unattainable for created entities.
- **CONFIRMED:** localStorage backing (so the plan's "must remain persistence-backed" is a change-preserving statement, not a fix). **Corrected:** cross-tab sync is a `storage` listener; `adult-portal-demo-change` is same-tab. **PARTIAL:** rollback half-exists (`adult-portal-demo-store.ts:741-750` real, `:392-396` a no-op) — so "implement atomic transaction rollbacks" is partly new work, partly already-built.
- **Still unfixed from the prior review and still in the shipped artifact:** the demo stores the raw token as its own hash — `src/runtime/player-access-demo-actions.ts:36` `return { token, tokenHash: token };`, with `adult-portal-demo-store.ts:278-305` seeding literal tokens. §3.3's scope (persistence + rollback) never touches it.
- **MAJOR:** `scripts/next-target.mjs` really does blank 7 secrets (`:41-53`) and set `NODE_ENV` (`:33`), but "preparing static assets" belongs to `scripts/start.mjs:40-47` — the plan's §3.4 attribution is fabricated. Also, blanking is keyed on *target*, not command, so `dev:demo` blanks too.
- **MAJOR:** "ensure `mode.ts` has a safe default (`server`)" would remove a guard that `tests/unit/runtime-mode.test.ts:11-12` asserts, and `server` is the unsafe branch for a static host; `next.config.ts:7` parses the same enum with no default and is unnamed.
- **MAJOR (unstated risk):** `next.config.ts:28-38` sets `output: "export"` + `basePath: "/SMS_Portal"` only outside development and injects `env.APP_BASE_PATH`; 3 consumer sites (`src/app/page.tsx:1`, `adult-portal-helpers.ts:126`, `player-credential-print-sheet.tsx:21`) — so `dev:demo` and `build:demo` emit different absolute URLs, and the **QR print sheet** is base-path dependent. No test, no §7 gate.
- **MINOR→MAJOR (product):** §4.2 exempts `idb-store.ts` from the size cap; that file owns `factory.open(DATABASE_NAME, DATABASE_VERSION)` (`game-offline-sync.ts:565-575`) with an additive-only `onupgradeneeded` and `onversionchange = close` (`:618`) — no transform path, no downgrade handling. The one file whose versioning can silently discard a child's queued results gets no ceiling and no version policy.

---

## 4. §4–§5 — God files and CSS

### 4.1 The purge's CSS claim survives; the *method* does not
Adjudicated across three independent measurements: **1,357 purge-attributable declaration lines = 1,567 physical lines once each deleted block's blank separator counts — against the plan's ~1,570 (−0.2%).** So §4.1 step 1 is defensible. Two reviewer numbers against the plan were refuted (see §6). But the claim is only safe if it is *computed*, and the plan gives no method. What mechanical purging actually breaks:
- **27 shared class names** used by both deleted and surviving components (`.button`, `.input`, `.field`, `.toolbar`, `.toast`, …). The figure was corrected down from 29: `.reportPanel` / `.reportPanelHeader` are cross-module ghosts (`results.module.css:132/139`), a module-blindness that also inflated the primitives breadth (20 files / 9 surviving, not 22 / 11).
- Dynamic access (`styles[\`tone${…}\`]`) invisible to a token grep; interleaved `@media` blocks including `@media print` at `portal.module.css:4355` (the file's only one).
- 694 lines are orphan-referenced by *nothing* — already dead today, so crediting their removal to the purge is a bookkeeping choice, not a schedule saving.
- No CSS/DOM/snapshot test exists, so §5.2's "zero layout breakage" is an assertion, not a result.

### 4.2 §4.1's extraction list is partly fiction
`.card` and `.badge` **do not exist in any stylesheet** (verified across all `*.module.css` plus `globals.css`). Real analogues are `.panel` — itself purge-dead, used only by `activity-builder.tsx` — and `.statusBadge`. So 2 of the 6 named primitives are fabricated and a third is being deleted. Also confirmed: all 5 proposed new CSS files are genuinely absent today (good: real work, honestly credited), and the pre-existing `results.module.css` (378) / `team-screen.module.css` (123) citations are exact.
- "308 distinct classes" matches no counting method (315 / 319); 4,910 lines exact; 68 design tokens exact, all inside the single `:root` of `globals.css:1`, `portal.module.css` has 0 — so §4.1's token warning is well-founded.
- §4.1's four named splits still do not bring `portal.module.css` near 400 (residual ~1,500-1,700 per two independent CSS passes), and `loading.tsx` / `player-access-workflow.tsx` consumers are unnamed.

### 4.3 §4.2 `game-offline-sync.ts` (1,222 exact)
Split boundaries are strikingly accurate (650 / 60 / 350 vs the prior review's 657 / 53 / 356) but **~162 lines of shared types are unallocated**, cross-cutting `eventRequestIdentity` is called from both sides, and there is a registry↔store cycle. `src/runtime/offline/` does not exist. `tests/unit/game-offline-sync.test.ts` (728 lines, exact) pins the pre-split path at `:16` and depends on `GameOfflinePersistence` (`:35`) — §4.2 never mentions moving it, and the audit treats *that test's* split as the acceptance signal (`:694`).

### 4.4 §4.3's duplicate-handshake item is already done
`src/components/public/demo-game-adapter.tsx` (112 lines) contains **zero** `postMessage` / listener code, and the shared `createBridgeRequestId` was already extracted to `game-bridge.ts:77`. §4.3 step 3 therefore describes work that is finished. Meanwhile the split that *is* proposed is non-mechanical: `game-host.tsx` (932 exact) holds 13 refs and 6 `useState` across the planned hook boundary, bidirectionally, plus 8 `runtimeMode` branches — so "two hooks" understates a behaviour change, not a move. `game-bridge.ts` (84) exact.

### 4.5 §4.4 `service.ts` (616 exact)
`getShell()` and its navigation construction confirmed. "Keep cohesive **or** split" plus a 4th `authorization-guards.ts` module now matches the audit (`:696`) — a v2 improvement. The residual is that the 6 screens import `StatusBadge` transitively, not `ActivityStatus`.

### 4.6 §5 verdict
Sound, and it creates no §6 work, so it cannot extend the sprint. Tailwind is genuinely absent from deps (no config, no directives). Two factual fixes: the "`tailwind.config.ts` theme extensions" row is v3-era advice (v4 is transitively pinned, `@theme`-based); "30+ components" is 33.

---

## 5. §6–§7 — Roadmap and gates

### 5.1 Gate inventory
| §7 criterion | Final status | Why |
| :-- | :-- | :-- |
| 1 — zero files >400 lines | **FAILS** | 17 offenders today (main-agent count, matching RV-B/RV-F/VV-B); §2 deletes 4 (1,625 / 717 / 521 / 517); §4 splits 4; **9 survive unbudgeted**: `adult-portal-demo-store.ts` 1,024, `public.module.css` 1,017, `game-offline-sync.test.ts` 728, `marketing.module.css` 688, `authorization.test.ts` 634, `player-access-workflow.tsx` 540, `contracts/v1/schemas.ts` 481, `prisma-adult-portal-store.ts` 467, `team-screen.tsx` 411. Contradicts the audit's own per-kind ratcheted budgets (`:744-746`). Its two exemptions are one file that does not exist yet (`idb-store.ts`) and one ambiguous present file (`schemas.ts`, hand-written, no generated marker). |
| 2 — clean action seam | **CONFLICTS with 5** | Satisfiable only via design 1 (a selector under another name) or a new HTTP mutation layer for 17 actions. Also under-states the gate: `tsconfig.json:24-42` aliases must go too. |
| 3 — four commands execute cleanly | **PARTIAL** | All four script names exist and are exact (`build:demo`, `build:server`, `typecheck`, `test`, plus `lint`). But `build:server` has never run in CI, and no CI placeholder env is scheduled — see §5.3. |
| 4 — CI on every PR | **STALE/WRONG** | `.github/workflows/deploy.yml` is the only workflow: `push: main`, no `pull_request`, no lint/typecheck/test. So "wire CI" is half-needed (checks absent) and half-done (Pages deploy present). |
| 5 — no `api/` in `out/`; functional demo | **VACUOUS + UNATTAINABLE** | `out/` already has 554 files and no `api/`, and the exporter drops route handlers before path-mapping (`export/index.js:249-256`) while all four `src/app/api/v1/player/*/route.ts` export only `POST` — so no static file could ever appear there. Zero integration/E2E tests exist (`tests/` is `unit` only, `environment: "node"`, no playwright/cypress/supertest) → criterion 5 is 100% manual. Plus the deep-link 404 of §3.4. |

**The discriminating gate nobody proposed until verification:** assert `.next/server/server-reference-manifest.json` contains **0** action ids after `build:demo`. It is the only check that catches the real regression class (a server action leaking into the static graph). Every other static-export landmine is already disarmed here — `images.unoptimized: true` (E603), no interception routes (E626), no `i18n` (E587) — so a green `build:demo` proves almost nothing on its own.

### 5.2 Sequencing
Verification steps exist on 2 of 4 days; the first *build* gate is Day 4. Day 1's break is guaranteed (defects 2-3 above). **Longest non-compiling window is Day 2's alias removal: ~1.5-2 of the 4 days** — not "a temporary build break" (§1.2). Day 3 packs four decompositions, of which the honest cost is roughly 1.5-2 days for CSS alone plus 1-2 for `game-host` (estimates, labelled as such by their author). Cross-day double-churn: 4 test files pin `@/runtime/adult-portal-demo-store` and `game-offline-sync.test.ts:16` pins the pre-split path, both rewritten by Day 2/3.

### 5.3 The CI-environment detail both reviewers and verifiers argued
`next.config.ts:10-18` zod-validates env at config load. One reviewer rated this BLOCKER ("4 secrets required"); a verifier downgraded it to MAJOR because tracked `.env.example:9,16,17,23` satisfies both gates and the local gitignored `.env` (1,083 B) is what masks the problem in development — so the fix is `cp .env.example .env`, not GitHub Secrets, and the audit already decided `build:server` runs "when secrets are available" (`:741-742`). Two things remain true and unhandled: a second, stricter schema lives at `src/server/config/env.ts:5-14,62-79` and disagrees with the first (`url()` vs a PostgreSQL-scheme refine), so any CI placeholder must satisfy **both**; and `main` is 8 commits ahead of `origin/main`, so publishing a red Pages deploy needs a deliberate push (real risk, wrong immediacy).

### 5.4 Baseline hygiene the plan assumes away
33 modified + 30 untracked `src/` files (5,090 lines, exact) — and the untracked set **includes two §4 split targets and §4.1's premises**. `prisma/migrations/4_v1_game_state` and `5_v1_game_events` are untracked, so Phase 0's "commit working tree" does not by itself produce a reproducible HEAD; worse, a plain `git add -A`-style commit that separates `prisma/schema.prisma` from those two migrations would break the audit trail. `REFACTOR_PLAN.md` and the whole `docs/agent-reviews/` corpus are themselves untracked, so every line number the plan cites points at an uncommitted state — a methodological caveat its verifiers had to work around (they did, by re-measuring at both HEAD and worktree). Also unaddressed: `.next/types/**` and `.next-demo-dev/types/**` are in `tsconfig.json:45-55`, so stale route types for the six deleted trees can mask errors; `prisma` itself is used in Day 1 via an **undeclared** `dotenv` hoist (`prisma.config.ts:1`), so the gate is not reproducible on a clean `npm ci`; and no gate typechecks `scripts/*.mjs` at all (`allowJs: false`, only `.mts` included) — the very script that guards demo secret blanking and `AUTH_DEV_BYPASS`.

### 5.5 What the purge leaves behind in prose
No documentation task exists anywhere in §6, yet 12 markdown files carry ~108 mentions of deleted surfaces (a verifier's corrected count; the first reviewer's 8/~46 was not reproducible). `docs/schemas/database-model.md:84` still calls `access_links` "the core new table" under `docs/schemas/README.md:3-6`'s "current" label — and was *already* false before this plan (7 tables documented, 16 models present). Also missing: `contracts/` is never mentioned (`src/contracts/v1/schemas.ts` 481 lines, `contracts/schemas/v1/`, `contracts/fixtures/v1/`, `tests/unit/v1-contracts.test.ts`) although the audit makes them the source of truth (`:434-435`) and `api-error.v1.schema.json:21` is directly touched by the D6 deletion. And §4's silent asymmetry: the audit's guardrails (§10: import-boundary lint rule, size ratchet, "no *new* `@runtime/*`", `typecheck:demo`, ADRs) are omitted while §7.1 adopts a *stricter* blanket number than the enforceable one. Notably, `REFACTOR_PLAN.md:131`'s "all 42 surviving imports … remain functional with **zero file rewrites**" is the direct opposite of the audit's rule that `components/**` must not import `@/generated/**` (`:553`, `:561-563`); 21 files under `src/components` + `src/application` do exactly that today.

### 5.6 Timeline
3-4 calendar days against the audit's 12-21 developer-days. VV-B's own arithmetic for **only** the work v2 schedules (Phases 1-4) is **7.5-14 developer-days for 4 calendar days**, omitting Phase 0 (now folded into Day 1) and Phases 5-7 (dropped) — and that excludes the seam redesign, the migration work, the 9 unbudgeted >400-line files, and the demo-created-entity fix. Either re-scope explicitly or restate the estimate as an *engineering* estimate with a named subset.

---

## 6. Attacks on the plan that did NOT survive verification

Recorded so none of it is re-litigated, and because a reader of the individual reports would otherwise act on them.

| Refuted claim | Raised by | Adjudication |
| :-- | :-- | :-- |
| "~1,570 dead CSS is inflated / mis-attributed" | RV-E (1,263) and RV-B (52 of 319 classes) | **REFUTED.** Adjudicated at 1,357 declaration lines / 1,567 physical. RV-E's figure is 5.3% low because it dropped `public-state.tsx` (exactly 56 lines) and then charged the plan for counting blank lines it had declared out of scope. RV-B's "52" is UNREPRODUCIBLE (true purge-only count: 81 of 319; its "63 never-referenced" was exact). |
| "D7 is reversed" (drop `AccessLink` only after confirming link sharing is unneeded) | RV-B | **REFUTED as a reversal.** The audit's actual D7 at `:799` says *delete*; the quoted confirmation gate is Phase-2 prose at `:652`. What survives is the process point: no confirmation artifact, and the DDL lacks the "follow-up migration" that same sentence assumes. |
| "D6 mandates keeping `RateLimitBucket`" | RV-B, RV-D | **OVERSTATED.** Audit `:725`/F8 read "implement **or** drop the model and the `RATE_LIMITED` code". Real residue: the unacknowledged reversal plus the stranded `RATE_LIMITED` code and wire-contract entry. |
| "§2.5 misses inverse relations → `prisma validate` fails" | implied by plan's own framing | **REFUTED.** The two cited fields are the only ones; validation cannot fail. The gap is the migration, not the schema text. |
| "`team-screen.module.css` may be fabricated" | review brief | **REFUTED.** It exists at exactly 123 lines. |
| "CI needs 4 secrets → new CI cannot build" (BLOCKER) | RV-F F4 | **DOWNGRADED to MAJOR.** `.env.example` passes both zod gates; `cp .env.example .env` is the fix. |
| "§6 Day 2 has *no stated* replacement" | RV-F F3 | **IMPRECISE.** §3.1:121-125 does state one; the accurate claim (proved by RV-C, not RV-F) is that the stated replacement is not compilable. |
| "`--to-schema-datamodel` was removed in Prisma 7.9.1" | VV-D | **REFUTED by main agent.** `migrate diff [options]`, `from-migrations`, `to-schema-datamodel` and `--exit-code` all appear in the installed `node_modules/prisma/build/cli.js` (prisma 7.9.1). The drift gate is available; it was not executed here. |
| Verifier's own errors | VV-A ("9 files >400 is wrong, it's 14" — the answer is 17); VV-E ("29 shared classes" — 27); VV-A ("`scopedCapabilities` at `:77`" vs `:79`) and VV-F ("7 migration dirs", "4th-largest suite", "8 files/~46 mentions") | Corrected above. Notably VV-F's report indicts §7 for exactly this kind of citation drift (its own F18) — the reviewers' arithmetic is better than their sub-counts. |

**Reviewer scorecards after verification:** RV-A 2/2 blockers upheld, 1 finding re-rated MAJOR→MINOR; RV-B strong on F-02/F-03/F-04/F-08, wrong on D7/F-10/integration; RV-C's central claim could not be refuted at all; RV-D 8 CONFIRMED / 3 WRONG of its own findings; RV-E's headline conflict failed while its primitives and §4.3 findings held; RV-F 13 of 13 findings located, 11 upheld, 2 downgraded, 0 refuted.

---

## 7. What the plan gets right (keep; do not re-derive)

1. Every §2.2 route-tree number; every §2.4 test count; the `:65` / `:80` schema citations; the 9 aliases; `E625`; 68 tokens in `:root`; 29,722 generated lines / 24 files; `portal.module.css` 4,910; `results.module.css` 378; `team-screen.module.css` 123; `game-offline-sync.ts` 1,222; `game-host.tsx` 932; `game-bridge.ts` 84; `service.ts` 616; "30+ components" (33); the ~1,570 CSS figure; the Prisma-output constraint (`provider = "prisma-client"` genuinely requires an explicit `output` — proven from the CLI build, not memory).
2. Zero phantom entries in the deletion manifest; "zero consumers" verified for 14/17 modules; no over-deletion (the two tempting near-misses, `portal-state.tsx` and `public-shell.tsx`, were correctly left alone).
3. §3.3's insistence on localStorage-backed demo persistence is change-preserving and correct; §3.4's secret-blanking and `NODE_ENV` claims are real; §5's Tailwind verdict is right on the effort/risk facts.
4. Toolchain alignment is perfect: `.node-version` == `.nvmrc` == `engines.node` == `deploy.yml:26` (24.19.0), lockfile committed, `cache: "npm"` valid, all four script names exact.
5. §7.2's *goal* is correct and greppable today; §2.1's "before the purge" ordering instinct is right; the manifest is closed over the survivor graph for §2.2 and §2.3 components.
6. `.env` hygiene is clean (only `.env.example` tracked, no `.env` in history, no secret leak to fix).

---

## 8. Corrected execution order (merged from RV-F §F4 and VV-F §5)

**Day 0 — half a day, inside Phase 0.**
1. Two commits: (a) the 30 untracked `src/` files (5,090 lines) **together with** `prisma/schema.prisma` and the untracked `4_v1_game_state` / `5_v1_game_events` migrations, so schema never leads its history; (b) the 33 modified files. Confirm `git status --short` empty and 7 tracked migration files.
2. Record gate baselines *in the repo*: 17 files >400 lines; 234 test call sites / 6,579 test LOC / 33 files; `out/` = 554 files plus a top-level directory manifest (today it contains the 6 legacy trees *and* a real legacy token page); `tsc --noEmit` error count; ESLint warning count; and `prisma migrate diff --from-migrations --to-schema-datamodel --exit-code` — the only gate that sees drift (`migrate diff --exit-code` is also the answer to "did the migration file ever get applied").
3. Add `ci.yml` (`pull_request` **and** `push: main`): `npm run check` (format + lint + typecheck + test) + `prisma validate` + `prisma generate` + `build:demo` with the `server-reference-manifest.json`-empty assertion and the route-manifest diff. `cp .env.example .env` before any server build, shaped to satisfy **both** `next.config.ts:10-18` and `src/server/config/env.ts`. Keep `deploy.yml` deploy-only. Do all of it on a branch.

**Day 1 — purge with the manifest repaired.** Prune `status-badge.tsx` (5 lines) instead of relocating `ActivityStatus`; **delete** the auditoria page (or budget a real V1 audit sink, and then decide about `model AuditEvent`); **delete** `service-container.ts`; add `authorization.test.ts` to §2.4 (or budget its port to `v1-policy.ts` as its own task — its platform-scope and "MANAGE does not grant VIEW" cases at `:1450`/`:1515` are not otherwise covered); extend §2.5 to `enum Capability` / `CapabilityAssignment` / `Organization.scopedCapabilities` / the stranded `RATE_LIMITED`; add the proxy/nav/ajuda cleanup rows; then delete; then create migration `6_drop_generation_a` (FK order; state the row-retention decision that blocks `DELETE VALUE`); then `prisma validate && prisma generate && rm -rf .next .next-demo-dev tsconfig.tsbuildinfo && npm run typecheck && npm test && npm run build:demo`. **Gate at end of Day 1, not Day 4.**

**Day 2 — seam.** Write the mechanism decision down *first*, covering both halves (actions **and** build-time data readers); amend §7.2's wording the same day if the answer is "one typed build-time selector". Then `contracts.ts`, the demo store refactor **with its 4 pinned test files**, an atomic removal of all 9 aliases from both configs in one commit, and the `src/generated/**` tsconfig exclude (worth doing for IDE/`tsbuildinfo` reasons — not for `typecheck` speed). Gate `build:demo` + `build:server` + `npm test` before any CSS work.

**Day 3 — decompositions, one gate per file.** Offline-sync (repoint `game-offline-sync.test.ts:16`; allocate the ~162 shared-type lines; state the `DATABASE_VERSION` policy), `game-host` (drop step 3 — already done — and treat the 13-ref/6-state coupling as a behaviour change), navigation presenter, then CSS **including** `public.module.css` (1,017) and `marketing.module.css` (688) — or amend §7.1's ceiling to the audit's per-kind budgets. Compute dead CSS with a recorded method; the 27 shared names and `styles[...]` dynamic access are why a naive purge breaks live UI.

**Day 4 — verification and docs.** `rm -rf out && npm run build:demo`, diff the route manifest against the Day-0 baseline (this, not the `api/` check, is what proves the six trees left), `grep -c "/SMS_Portal/" out/index.html` for the asset prefix, assert an empty server-reference manifest, run the browser smoke checklist (the only substitute for the absent integration layer), then the doc sweep (12 files, ~108 mentions) and `README.md:94-100`'s verification contract.

---

## 9. Open questions for the plan author

1. **Which document governs?** The plan never cites `docs/architecture-audit-2026-09-23.md` — whose `docs/implementation/README.md:48-51` makes Phases 0-3 a precondition for slice work — while its header cites the *review* as "the audit". Is the audit superseded? If yes, record D3/D4/D6/D7 as formally re-decided; if no, Phases 5-7 re-enter the roadmap.
2. **Name the seam mechanism** (design 1, 2 or 3 of §3.3 above) and say how the server branch stays out of the exported bundle. §3.1's current wording re-creates the duplication §1.1 calls the core problem — is that duplication now *accepted*, and does §7 forbid it?
3. **Who writes `AuditEvent` after Day 1**, and is administrative audit in V1 at all? If it is out, delete the page and decide about the model; if in, the work is a new audit sink + read path + `v1-policy.ts` gating, not a repoint.
4. **Where is the drop migration**, and who proves `migrate deploy` still applies? Is the target DB built by `migrate deploy` or `db push` (neither is in `package.json`)? Do real `access_links` rows need preservation first, and what happens to `CapabilityAssignment` / `Capability` / `RATE_LIMITED`?
5. **Should `ActivityStatus` be relocated at all**, given zero surviving producers — and do you want its three dead `StatusBadge` union members ("Convite pendente", "Lançamentos bloqueados", "Novas atividades bloqueadas") pruned or kept for a planned feature?
6. **Which units is the headline metric:** 7,050 physical or 6,439 non-blank — and should §1.1 / §2 / §6 be corrected to ~7,700 once the two omissions fold in? Rename "Verified Lines" → "Physical lines"?
7. **Which 400-line budget is law** — §7.1's blanket number or the audit's per-kind ratchet? Nine named files still violate it on Day 4: is criterion 1 reported failed, or quietly amended?
8. **How is the demo's refresh behaviour made honest** for created entities (seed-only `generateStaticParams`), and will §7.5 be scoped to seeded routes or will a client-rendered fallback be built?
9. **Does the demo keep storing the raw token as its own hash** (`player-access-demo-actions.ts:36`) — the only deployed artifact's credential model, untouched by §3.3?
10. **What happens to the falsified docs** — archive (audit Phase 0 step 4), update in-sprint (Phase 7), or leave stale? Same question for `contracts/` and the `base path`/print-sheet risk (§3.4).
11. **Do you keep a live Pages site during the sprint?** `deploy.yml` deploys on every push to `main` with no test job, and `main` is currently 8 ahead of `origin/main`.
12. **Is 3-4 days a scope statement or an estimate?** If a subset, mark Phases 5-7 and D4 descoped with the acceptance-risk (R1, R2, R3) the Pages demo then permanently carries.

---

## 10. Reproduction

The 12 per-agent documents hold the raw evidence; `VV-E` and `RV-E` carry rerunnable command appendices, and `VV-D` §2 records the one question that could not be settled read-only (whether `tsc` wall time changes with the `exclude` — run `tsc --noEmit --incremental false` on a scratch branch; nothing in §6 budgets a before/after measurement).

```bash
# load-bearing, all read-only
head -4 src/server/services/service-container.ts                      # four deleted-module imports
sed -n '1,10p' tests/unit/authorization.test.ts                       # imports authorization-service
find src tests -name '*.ts' -o -name '*.tsx' -o -name '*.css' \
  | grep -v '/generated/' | xargs wc -l | awk '$1>400' | sort -rn      # 17 files
grep -rn "auditEvent.create" src tests                                 # sole writer, inside the delete set
grep -c "E625\|use server" node_modules/next/dist/export/index.js      # export-time gate
node -e "console.log(require('./node_modules/prisma/package.json').version)"  # 7.9.1
```

## 11. Report index

| | Review | Verification |
| :-- | :-- | :-- |
| §2 Deletion manifest | `RV-A-deletion-manifest.md` (475) | `VV-A-deletion-manifest-verification.md` (139) |
| Cross-document / audit D-R | `RV-B-cross-document-consistency.md` (450) | `VV-B-cross-document-verification.md` (278) |
| §3 Seam / dual runtime / Next 16 | `RV-C-action-seam-runtimes.md` (380) | `VV-C-action-seam-verification.md` (134) |
| §2.5 / §3.2 Prisma & tsconfig | `RV-D-prisma-tooling.md` (265) | `VV-D-prisma-tooling-verification.md` (201) |
| §4 / §5 God files & CSS | `RV-E-godfiles-css.md` (262) | `VV-E-godfiles-css-verification.md` (423) |
| §6 / §7 Roadmap & gates | `RV-F-roadmap-gates.md` (768) | `VV-F-roadmap-gates-verification.md` (277) |

Also relevant: `../REFACTOR_PLAN-review-2026-09-23.md` (the v1 review the plan claims to answer; RV-B §3 is the finding-by-finding status of that claim), and `../../architecture-audit-2026-09-23.md` (the governing decision record).

### Unresolved measurement disputes
- **Surviving `@/generated/prisma/enums` imports:** 44 statements / 43 files today (main agent). Post-purge, agents landed on 31, 37, 39 and 43 depending on statement-vs-file and src-vs-src+tests scoping. Defensible statement: *"roughly 31-39 of the plan's 42 survive"* — the plan's "42" is a pre-purge count either way.
- **Dead-CSS class count:** 319 declared tokens; 81 purge-only, 63 never-referenced, 27 shared-with-survivors, 115 unused-by-survivors (final figures after VV-E's adjudication; the plan's "308 classes" remains a third counting method).
