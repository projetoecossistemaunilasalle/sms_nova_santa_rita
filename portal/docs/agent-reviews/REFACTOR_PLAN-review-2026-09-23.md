# REFACTOR_PLAN.md — Multi-Agent Review Report

**Date:** 2026-09-23
**Target under review:** `REFACTOR_PLAN.md` (V1 Architectural Refactor & Simplification Plan, v1.0)
**Method:** 7 scoped read-only review agents + 4 adversarial verification agents + main-agent direct command evidence. No code was written; `REFACTOR_PLAN.md` was not modified.
**Companion file:** `agent-ledger.md` (who checked what, where agents disagreed)

---

## 1. Overall verdict

The plan's **diagnosis is largely correct**; its **quantitative base is stale**, and its **execution design is not viable as written**.

| Dimension | Assessment |
| :-- | :-- |
| Problem diagnosis (§1.1) | Sound. Three coexisting generations confirmed (`docs/implementation/README.md:47-48`); `portal-view-service` fake data confirmed; 9 aliases confirmed exactly. |
| Deletion manifest (§2) | Right targets, wrong numbers, incomplete list, and **4 surviving importers that break the build**. |
| Target architecture (§3) | **2 of 3 sub-proposals are technically unimplementable as written** (§3.1 single-`"use server"`-under-static-export, §3.3 Prisma output). §3.2 is a no-op. |
| God-file decomposition (§4) | Real seams don't match proposed seams. Two proposed files already exist. Targets (`~400`) unreachable. |
| CSS strategy (§5) | **Best section in the document.** Tailwind recommendation is correct and matches `docs/architecture-audit-2026-09-23.md:36-37`. Effort figure understated 2–3×. |
| Roadmap (§6) | Self-inconsistent ordering; contradicts the repo's own phased plan; leaves GitHub Pages red for the stated 3–4 days. |
| Success criteria (§7) | **Criteria 1, 2, 4 and 5 are not simultaneously satisfiable** as written. Criterion 1 currently fails by 9 files. |

**Recommendation:** do not execute Day 1 as written. The plan needs 5 blocking decisions resolved first (section 5 below).

---

## 2. Blocking defects

Each entry states the claim, the reality, evidence, and which agent confirmed it.

### B1. §3.1 + §7.2 vs §7.5 — mutually exclusive requirements (BLOCKER)

**Plan says:** "Remove all `*-demo-actions.ts` files: You write each Server Action once"; criterion 2 = "Every Server Action exists in exactly one file (`"use server"`)"; criterion 5 = "`npm run build:demo` exports the static GitHub Pages site".

**Reality:** Next.js 16.3.2 refuses to statically export an app containing a registered Server Action.
- Enforcement: `node_modules/next/dist/export/index.js:375-387` → `ExportError("Server Actions are not supported with static export.")`, code **E625**, triggered by any `server-action` id in the server-reference manifest.
- Docs: `node_modules/next/dist/docs/01-app/02-guides/static-exports.md:291` lists Server Actions as unsupported (`:276` general rule; `:287` also lists Proxy).
- This is exactly why the aliases exist: `next.config.ts:44-79` swaps `"use server"` modules (`adult-portal-actions.ts:1`, `player-access-actions.ts:1`, `jogar/actions.ts:1`, `sign-out-action.ts:1`, inline at `entrar/actions.ts:16`) for `"use client"` demo twins (`adult-portal-demo-actions.ts:1`, `player-access-demo-actions.ts:1`, `player-entry-demo-actions.ts:1`).

**Verified by:** dual-runtime agent, then adversarial verifier A. **Verdict: TRUE but overstated** — the blocker is not alias deletion per se, it is keeping `"use server"` on actions referenced from browser code. Call sites use `useActionState` with a plain client function (`classes-screen.tsx:12` → `adult-portal-form.tsx:31-34`), so a client-function action shim *does* build. The repo's own audit carries the same unresolved contradiction: `architecture-audit-2026-09-23.md:676` deletes the demo action modules while `:681` requires `build:demo` to succeed.

**Consequence:** §3.1(c) and criterion 2 must be reworded to allow a per-target action entry point — i.e. keep a two-implementation seam at the action layer, which is the mechanism the plan set out to destroy. `docs/implementation/v1-architecture-plan.md:69-71` already names this escape: "give the demo a dedicated static entry rather than weakening server behavior."

---

### B2. §3.3 — Prisma generator change is impossible as written (BLOCKER)

**Plan says:** "Update `prisma/schema.prisma` to generate into default `node_modules/@prisma/client`. Delete `src/generated/prisma`. Eliminates **29,700 lines** of generated code from IDE indexing and TypeScript checks."

**Reality, two ways wrong:**
1. `prisma/schema.prisma:1-4` uses `provider = "prisma-client"`, which **requires** an explicit `output`. Installed CLI: `node_modules/prisma/build/cli.js` → `function R3e(e){if(!e.output)throw new Error(...)}`, message "An output path is required for the `prisma-client` generator." Omitting `output` breaks `postinstall: prisma generate` (`package.json:26`) and therefore `npm ci`, including CI. The `node_modules` default belongs to the legacy `prisma-client-js` provider.
2. The benefit is largely false. `src/generated` = 24 files / **29,722 lines**, all `.ts`, but **every file already carries `// @ts-nocheck` and `/* eslint-disable */`**, and it is already ignored by `eslint.config.mjs:15`, `.prettierignore:3`, `.gitignore:27` (`git ls-files src/generated` → 0). Only `tsconfig.json` includes it (exclude is just `["node_modules"]`), and `skipLibCheck` never semantically checks those bodies.

**Cost the plan omits:** **43 files** must be rewritten (34 in `src/`, 13 in `tests/` minus 4 in the deletion set); the dominant specifier is `@/generated/prisma/enums` (**42 uses**), which has no `@prisma/client` equivalent in Prisma 7.

**Verified by:** prisma agent, then adversarial verifier B (independently located the same CLI error and the `@ts-nocheck` preamble). Both reached "impossible as written / possible only via deprecated provider at 43-file cost."

---

### B3. §2 purge breaks the build — 4 surviving importers missing from the manifest (BLOCKER)

Directly verified by main agent grep:

| Surviving file (not in §2) | Imports a deleted file |
| :-- | :-- |
| `src/components/portal/status-badge.tsx:1` | `type ActivityStatus` from `portal-view-service` — StatusBadge is used by **6 surviving screens** (`class-detail-screen:21`, `classes-screen:24`, `organization-detail-screen:23`, `organizations-screen:27`, `overview-screen:20`, `team-screen:29`) |
| `src/app/(professional)/portal/admin/auditoria/page.tsx:4,54` | `auditEvents` from `portal-view-service` — live route; audit Phase 2 step 1 (`:640`) requires repointing it **first** |
| `src/server/services/service-container.ts:2,3` | `PrismaAccessLinkStore`, `AccessLinkService` |
| `tests/unit/portal-dev-bypass.test.ts:6-8` | `getDevBypassAccessLink`, `listAccessLinks` (only `...-actions.test.ts` is listed in §2.3) |

Additionally the manifest **under-listes** dead code that should be in it (all verified dead-by-purge, with line counts): `share-actions.tsx` (147), `security/tokens.ts` (61), `activity-mark.tsx` (27), `public/public-state.tsx` (36), `service-container.ts` (45), `authorization-service.ts` (244, live path is `authorization/v1-policy.ts`), `db/prisma-capability-reader.ts` (55). And deleting `prisma-access-link-store.ts:325 recordAudit` removes the **only writer** of `AuditEvent` while `architecture-audit:456,651` says keep it.

**Consequence:** the purge is simultaneously over-claiming its totals and under-listing its scope.

---

### B4. §2.4 — schema deletion leaves Prisma invalid and skips migrations (BLOCKER)

**Plan says:** "Remove `model AccessLink` **and its relations**."

**Reality:** `AccessLink` has **two inverse relation fields on surviving models** that must also be removed or `prisma validate` fails:
- `prisma/schema.prisma:65` (ProfessionalProfile) — `createdAccessLinks AccessLink[] @relation("AccessLinkCreator")`
- `prisma/schema.prisma:80` (Organization) — `accessLinks AccessLink[]`

`RateLimitBucket` (`:300-310`) is genuinely relation-free and unreferenced in code — the plan is right there — **but** removing it silently reverses documented decision **D6** (`architecture-audit:798`: "implement with `RateLimitBucket`... for the four player endpoints and sign-in"), which §6 Day 2 (`:135`) also mandates a cleanup job for. The plan never acknowledges the reversal.

**Migration gap:** 6 migrations exist; `access_links` appears in `0_init/migration.sql` (10 references, including hand-written CHECK constraints and `NULLS NOT DISTINCT` unique index) and `1_add_paused_at/migration.sql:3`; `rate_limit_buckets` in `0_init`. **No drop migration task appears anywhere in §6.** Related and unaddressed: `architecture-audit:779` R1 — "Migrations were never applied to a real database; the schema might not even apply."

---

### B5. §3 diagram vs §1.1 — "In-Memory" demo store breaks criterion 5 (BLOCKER)

**Internal contradiction:** §1.1 (`REFACTOR_PLAN.md:15`) correctly describes Generation C as running on `localStorage`; §3's diagram (`:99`) and §6 (`:189`) specify a Demo Adapter that is **"In-Memory (Atomic Memory)"**.

**Reality:** `src/runtime/adult-portal-demo-store.ts:348` reads and `:360` writes `window.localStorage`, and broadcasts `adult-portal-demo-change`; `use-demo-portal.ts:12-18` listens to `storage` for cross-tab sync; `game-host.tsx:441,523,533` localStorage; `game-offline-sync.ts:495-500` IndexedDB.

**Consequence:** an in-memory-only store resets on every hard reload or deep link (QR `/jogar/<token>`, refresh on `/portal/turmas/x`) and loses cross-tab sync on a static Pages site — violating the plan's own criterion 5 ("fully operational in-browser navigation"). The demo adapter must be persistence-backed, which is the design the plan labels a "hack."

---

## 3. Major defects

**M1 — Quantitative base is stale.** Verified actual vs claimed:

| Item | Claimed | Actual |
| :-- | --: | --: |
| `portal.module.css` | 4,214 | **4,910** (4,214 = non-blank lines) |
| `portal/atividades/` tree | ~1,200 | 1,188 (its `actions.ts`: 480 → **517**) |
| `portal/materiais/` tree | ~600 | **92** |
| `portal/modulos/` | ~100 | **23** |
| `admin/jogos` / `admin/modulos` | ~60 / ~60 | **7 / 7** |
| `(public-play)/atividade/[token]` | ~800 | **364** |
| `prisma-access-link-store.ts` | 318 | 352 |
| `link-status.ts` | 50 | **38** |
| `public-link-service.ts` | 60 | 65 |
| `audit-actions.ts` | 110 | 103 |
| **Purge total** | **~7,000** | **~6,447** |

**M2 — §3.1's "TypeScript vs. Turbopack split-brain" is factually wrong.** All 9 `tsconfig.json:24-42` paths equal the `runtimeMode === "server"` branch of `next.config.ts:45-79` (diffed entry-by-entry twice). The real, different defect: tsc only ever resolves the *server* side, so the `"use client"` twins are never checked against the alias contract — drift already exists (`demo-auth-actions.ts:1-7` is directive-less and only throws, vs `entrar/actions.ts:15` taking `FormData`). Fix the diagnosis, not the wording.

**M3 — §3.1 blast radius unquantified.** 24 `from "@runtime/*"` import sites in 23 files (11 pages, 12 components). Both config sets must be removed atomically with the import rewrites; removing one alone desyncs `typecheck` from the bundler (TS2307 vs Turbopack resolution failure). Good news the plan doesn't mention: **no test asserts on the alias structure**, so §3.1 needs no test deletions.

**M4 — §4.1 CSS decomposition targets unreachable; one destination already exists.** Two independent counting methods (awk state machine vs Node char-tokenizer, ±2.5%) agree:
- Total dead CSS ≈ **1,572–1,611** rule lines, but only **947** belong to the deleted Generation A trees; **625** are referenced by nothing at all. So "~1,500 from the purge" conflates pre-existing dead CSS with Gen A.
- Realistic residual for `portal.module.css` after purge + the named splits: **~1,500–1,700 physical lines**, not ~400. Reaching 400 needs 10+ modules including `loading.tsx` (45 class tokens) and `player-access-workflow.tsx` (28) — neither named.
- **§4.1 re-proposes completed work:** `results.module.css` (378 lines, and `results-screen.tsx` already imports only it) and `team-screen.module.css` (123) already exist. `classes-screen.module.css` / `organizations-screen.module.css` / `primitives.module.css` do not.
- **Design-token proposal is unsound.** All 68 tokens live in `src/app/globals.css:1-74` (`:root`, imported once by `layout.tsx:4`). `portal.module.css` has **zero** `:root` and consumes 57 distinct `var(--*)` across 745 sites. A `:root` block placed in a *CSS Module* only ships when that module is imported → tokens vanish on non-importing screens.
- Cascade risk understated: 11 interleaved `@media` blocks (incl. `@media print` at `:4355-4391` with `:global(body) > *`) and descendant pairs like `.organizationTableRow .tableIdentity:4393`; splitting re-orders cascade and can orphan the credential print sheet. Note also `activity-mark.tsx:22` uses dynamic `styles[\`tone${...}\`]`, invisible to grep-based class audits.
- Zero CSS/DOM/snapshot tests exist (33 unit test files, no jsdom/testing-library/playwright), so "zero visual regressions" is unverifiable by the repo's own gates. Effort realistically **2–3×** the stated 4–6 hours, and each relocated class forces call-site rewrites (`styles.x` → `teamStyles.x`).

**M5 — §7 criterion 1 fails on current facts.** 17 non-generated files exceed 400 lines; §2/§4 address 8. **9 are untouched:** `runtime/adult-portal-demo-store.ts` 1,024; `components/public/public.module.css` 1,017; `tests/unit/game-offline-sync.test.ts` 728; `components/marketing/marketing.module.css` 688; `tests/unit/authorization.test.ts` 634; `components/portal/player-access-workflow.tsx` 540; `src/contracts/v1/schemas.ts` 481; `server/db/prisma-adult-portal-store.ts` 467; `components/portal/team-screen.tsx` 411. The criterion also contradicts the repo's agreed budgets (`architecture-audit:744`: component 250/400, module 300/500, CSS 300/600, tests 400/800, and "applies to **new or modified** files only").

**M6 — §4.2 / §4.4 split arithmetic doesn't match the real files.**
- `game-offline-sync.ts` (1,222): proposed 350+150+300 = 800 leaves 422 lines unaccounted; they are 154 lines of types + 62 blank + 44 imports/consts + 226 under-counted persistence code — none dead. Real seams: `idb-store` ≈ **657** (still violates the 400-line rule), `sync-engine` ≈ 356, `request-registry` ≈ **53** (plan overestimates 3×). Cross-cutting blockers: `eventRequestIdentity:543` is called from the store (`:246,:281`) *and* the persistence class (`:1044`); `stableJson`/`sameJson` span both sides → registry↔store cycle. `GameOfflinePersistence:99-136` exists only to serve `tests/unit/game-offline-sync.test.ts:35`.
- `adult-portal/service.ts` (616, one exported class, 17 public methods): 4 org + 6 class + 4 team methods fit, but `getShell:121-208` (88 lines of navigation), `getOverview:209-234` and `listProvisionedProfiles:321-336` map to none of the three. ~130 lines of shared private guards (`authorizationActor` used 20×, `forbidden` 14×, `notFound` 11×, `effectiveRole` 6×) would be duplicated 3× or require a **4th, unlisted module**. The audit's gentler rule (`:696`) is "one service per aggregate **where practical**, or at minimum move `getShell` to `presenters/portal-navigation.ts`."

**M7 — §4.3 ignores already-extracted code.** The bridge protocol is *already* factored out into `src/components/public/game-bridge.ts` (84 lines: `parseGameBridgeMessage:24`, `expectedGameOrigin:48`, `isTrustedGameMessage:65`, `createBridgeRequestId:77`). A second full copy of the `game.ready.v1` / `bootstrap_applied` handshake + request dedupe lives in `demo-game-adapter.tsx` (112) — the plan never mentions it, yet it is the actual duplication. The two proposed hooks are valid as `.ts` (lines 141-836 are JSX-free) but share 12 refs (`:119-129`) + 6 `useState` (`:130-139`), so a shared-state module is required, not two hooks.

**M8 — §3.2 is a no-op that also reverses an accepted decision.** `src/server/config/env.ts` **already exists** (124 lines) and already validates lazily (`getRuntimeEnv():99-103`, `getServerRuntimeEnv():108`, `isAuthDevBypassEnabled():120`, consumed at `server/auth/gateway.ts:42`, `entrar/actions.ts:24`). All 24 `server-only` modules read env inside functions, and `db/client.ts:10-14` builds the Neon adapter lazily, so a `standalone` server build **already succeeds** with no `DATABASE_URL`. Meanwhile `scripts/next-target.mjs` does five jobs beyond the flag (`loadEnvConfig:24`; blanking 7 server secrets `:41-53` because "the build re-reads `.env` and never overrides a variable that already exists" `:34-38`; pinning `AUTH_DEV_BYPASS="false":39`; `NODE_ENV=production:31`), and `start.mjs:39-52` copies `.next/static` + `public` into `.next/standalone` — plain `next start` cannot serve this app. The audit deliberately keeps it: `:586` "`scripts/next-target.mjs` remains the single target selector used by npm scripts and CI"; `:721` "keep the wrapper scripts as the only..." → §3.2 conflicts with the doc it derives from.
**Related and unmentioned:** even after §3.1, the runtime mode must still be resolved at **config** time (it selects `output`, `basePath`, `distDir`, `trailingSlash`, `images.unoptimized`, `APP_BASE_PATH`), and `src/runtime/mode.ts:3,10` parses `APP_RUNTIME_MODE` with no default and is loaded at ~28 sites — so `npx next dev` with no env still throws. Criterion 4's "standard CLI" is unattainable without a second mechanism the plan never names.

**M9 — §6 roadmap is internally unsafe.** Day 1 (`:185-186`) deletes the aliases *and* the demo twins that 23 files still import; Day 2 (`:189-190`) is the first point at which anything could build; the first verification gate is Day 4 (`:200-204`). So Days 1–3 have **no check step**, and `.github/workflows/deploy.yml:5,34,39,50` runs `build:demo` on every push to `main` with no test gate → the live GitHub Pages site (`README.md:82,102`) is broken or frozen-stale for the entire sprint, contradicting §1.2's "temporary build break." The repo's own phased plan sequences this differently: Phase 0 "Make change safe... **blocks everything**" (`:595`), CI in step 1 (`:604`), alias work in Phase 6, and each phase "independently shippable and leaves the app working" (`:592`).

**M10 — Timeline conflicts with the repo's own estimate.** `architecture-audit:769`: "roughly **12–21 developer-days** for the whole plan, or ~4–6 days for the first three phases." `REFACTOR_PLAN.md:3` promises the whole thing in "3–4 days" while adding §4's four decompositions and Day 4 CI. The audit also requires Phase 5 verification absent from the plan (`:704-717`: integration tests + `pr migrate deploy` on a throwaway Postgres), and R1/R2 risk items (`:779-781`: unapplied migrations; the GameMaker build does not exist yet, protocol unproven — "freeze the contract before Phase 4 touches `game-host`").

**M11 — Governing artifacts silently omitted.**
- `PRODUCT.md:113` is only the heading `## Materials`; the quoted deferral is actually at `PRODUCT.md:115,117,119` ("Materials/content management is not part of V1"), and the literal wording resembles `docs/current-architecture.md:182`. Conclusion holds, citation is wrong.
- Contracts: `src/contracts/v1/schemas.ts` (481), `contracts/schemas/v1/`, `contracts/fixtures/v1/`, `tests/unit/v1-contracts.test.ts` (368) are never mentioned. Verified: **zero coupling** to anything §2/§3 deletes — so they survive, but the plan should say so, since the audit treats them as the source of truth (`:434-435`).
- Still-open security finding unaddressed: `runtime/player-access-demo-actions.ts:36` still returns `{ token, tokenHash: token }` (raw token stored as its own hash), flagged at `architecture-audit:264-266` with fix step `:673-674`. The recent commits (`5bc2467`, `48b6c5d`, `056ad67`) touched those files without applying it. The **server** path is correct (`player-credential-tokens.ts:12,23`).
- Feature-completeness assumption: §2.1 claims the legacy trees are "replaced by" V1 routes. Verified partial — results (`/portal/resultados/[classGroupId]/players/[playerSlotId]`) and QR sharing (`player-credential-print-sheet.tsx:162`) are covered, but **activity creation** (`atividades/nova` + `activity-builder.tsx`) has no V1 counterpart, and `/jogar` in server mode renders `PlayerEntryScreen` with `gameClient.status === "missing"` (`jogar/page.tsx:6-13`) because no GameMaker build exists (audit R2).
- Tests coupled to `APP_RUNTIME_MODE` that §3.2 would disturb, none listed in §2.3: `tests/unit/env.test.ts:6,20,29,36`, `auth.test.ts:132,163,172,183`, `runtime-mode.test.ts:5-13`, `portal-dev-bypass-actions.test.ts:46,55,69,104`. Note `vitest.config.mts:13` pins `APP_RUNTIME_MODE: "demo"` and defines **no** `@runtime` alias at all.
- Cleanup hygiene: `src/proxy.ts:112-117` keeps a dead `/atividade/` no-referrer branch (no security impact — proxy sets headers only, `:102-104`), and `activityToken` redaction lives at `src/server/observability/logger.ts:11` (not `src/server/logger.ts`).

---

## 4. What the plan gets right (confirmed, keep)

1. **Three-generations diagnosis** — corroborated by `docs/implementation/README.md:47-48`.
2. **Exactly 9 `@runtime/*` aliases**, present in both `next.config.ts` and `tsconfig.json` — and both must go atomically.
3. **`portal-view-service.ts` is fake data** and causes empty/404 renders in server mode (`:416` gates fixtures on `demoRuntime`) — deleting it is correct, but its consumers must be repointed first (B3).
4. **`RateLimitBucket` genuinely unreferenced in code** — the deletion is technically clean; only the D6 decision reversal needs acknowledging.
5. **Six "zero consumer" claims verified SAFE** with respect to surviving importers: `access-link-service` (only importers are in the delete set), `public-link-service` (sole caller is its own test), `link-status` (only the `atividades` tree + test), `audit-actions` (sole importer `access-link-service.ts:6-13`; surviving audit code uses inline strings; `ACCESS_LINK_TOKEN_LENGTH` at `security/tokens.ts:21` is a different symbol), `class-groups-explorer` (**already zero importers**), and the 5 portal components.
6. **Legacy route trees are safely severable** from the survivor graph: `PublicShell` and `public.module.css` are shared with `/jogar` but stay valid; `public-state.tsx` is exclusive to the deleted tree; no nav/layout/sitemap/CI/README entry points into them — sidebar hrefs are already V1-only (`portal-navigation.tsx:62-120`).
7. **§5's Tailwind verdict is correct**, matches the audit's refusal (`:36-37`), and no governing design doc mandates or mentions Tailwind. The two-step recommendation is the right call.
8. **§4.3's file-naming choice is valid** — `game-host.tsx` lines 141–836 are JSX-free, so `.ts` hooks work.
9. **Day 4 CI premise is sound** — `deploy.yml` `node-version: "24.19.0"` matches `package.json:7` engines; lockfile is committed, `cache: "npm"` works.
10. **No path outside schema/gitignore hardcodes `src/generated/prisma`** — Dockerfile, `scripts/*.mjs`, `deploy.yml`, `vitest.config.mts` are clean.

---

## 5. Decisions required before any execution

These are the plan's unresolved forks. Each blocks one or more Day 1–2 steps. (No implementation performed — this review is read-only.)

1. **Demo action strategy (B1):** keep a per-target action entry point (client shim selected at build), or drop `output: "export"` and the Pages demo, or split screens into server-read / client-write. This determines whether §3.1 exists at all and fixes the wording of criteria 2/5.
2. **Demo persistence (B5):** localStorage-backed adapter (status quo, survives reload on Pages) vs. in-memory. The word "In-Memory" in §3 must change if Pages must survive a refresh.
3. **Prisma client location (B2):** keep `src/generated/prisma` and just exclude it from `tsconfig.include` (the audit's own fix, `:587`), or migrate 43 files. The stated 29,700-line benefit is mostly illusory.
4. **AccessLink/RateLimitBucket migration policy (B4):** add the drop-migration task and the audit's `:652-653` confirmation gate, or defer both to a later slice; also decide whether to keep CapabilityAssignment per R5 (`:783`).
5. **Sprint structure (M9/M10):** reorder Day 1 to do CI/Phase-0 safety first, or accept a stated number of days with a broken Pages deploy and record it as a deliberate exception. Reconcile 3–4 days against the audited 12–21.
6. **Auditoria and status-badge (B3):** repoint `/portal/admin/auditoria` at the real `AuditEvent` table (audit Phase 2 step 1) or delete the page; relocate `ActivityStatus` out of `portal-view-service` before deleting it.
7. **Criterion 1 scope (M5):** adopt the audit's per-kind budgets and "new or modified files only," or explicitly add the 9 surviving >400-line files to §4.

---

## 6. Confidence and limits of this review

- **High confidence (verified twice, or verified by direct command output):** B1–B5, M1, M2, M3, M5, and everything in section 4. Route totals, line counts, importer lists, schema relation fields, config contents, generator provider, file inventories were all reproduced with `wc`/`grep`/`find`/`sed` and reported verbatim above.
- **Medium confidence (single agent, method-dependent):** M2's "60% duplicated Server Actions" recomputation (~45% structural / ~20% verbatim) — the metric is not defined in the plan, so any replacement number is a judgment; the *direction* (overstated) is safe. §4's internal line-range maps (game-offline-sync, service.ts, game-host) are single-agent reads.
- **Not measured:** nothing was built or executed (read-only mandate). Conclusions about build failure rest on Next's own enforcement code and the vendored docs, not on a failed build run. Reproducing B1 empirically would require running `build:demo` with the aliases removed — deliberately not done.
- **Known agent disagreement:** CSS dead-line attribution, 947 vs 1,572 lines — see `agent-ledger.md`. Both agents independently concluded §4.1's "~400" is unreachable; they differ only on how the dead lines are attributable.
