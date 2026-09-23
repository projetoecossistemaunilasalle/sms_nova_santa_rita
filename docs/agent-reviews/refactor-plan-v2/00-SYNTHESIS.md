# REFACTOR_PLAN.md v2.0 — Consolidated Multi-Agent Review (Verification-Paired)

**Date:** 23 September 2026
**Target document:** `REFACTOR_PLAN.md` (v2.0, 244 lines, "Updated post multi-agent adversarial audit")
**Method:** 6 scoped reviewers → 6 adversarial verifiers (each instructed to refute its paired report) → main-agent tiebreak measurements on the numbers the agents disputed.
**Tree state:** 33 tracked modifications uncommitted throughout. No file outside `docs/agent-reviews/refactor-plan-v2/` was created or changed by this review. All work was read-only with respect to code.

## Report index

| Scope | Review | Verification |
| :--- | :--- | :--- |
| §2 Deletion Manifest | `RV-A-deletion-manifest.md` | `VV-A-deletion-manifest-verification.md` |
| Cross-document consistency (audit D/R, prior review, PRODUCT) | `RV-B-cross-document-consistency.md` | `VV-B-cross-document-verification.md` |
| §1/§3.1/§3.3/§3.4 Action seam & dual runtime | `RV-C-action-seam-runtimes.md` | `VV-C-action-seam-verification.md` |
| §2.5/§3.2 Prisma, generated client, tsconfig | `RV-D-prisma-tooling.md` | `VV-D-prisma-tooling-verification.md` |
| §4/§5 God files & CSS strategy | `RV-E-godfiles-css.md` | `VV-E-godfiles-css-verification.md` |
| §6/§7 Roadmap, CI, verification gates | `RV-F-roadmap-gates.md` | `VV-F-roadmap-gates-verification.md` |

---

## 1. Overall verdict

**The plan's factual core is unusually well measured — most of its line counts reproduce exactly. It is still not executable as written.** Eight defects were independently confirmed by at least two agents and survived an adversarial refutation pass. Two of them (the action seam, the purge's import graph) stop Day 1 and Day 2 outright; one of them (the demo's refresh behaviour) makes a Day-4 success criterion unattainable.

The plan's *own* headline numbers held up better than the attacks on them: the most-attacked figure ("~1,570 lines of dead CSS") was defended by re-measurement at **1,567 physical lines (−0.2%)**, and three reviewer findings against the plan were themselves refuted (§5 conflict list).

---

## 2. Confirmed BLOCKERS (survived refutation)

### B1 — The purge leaves `service-container.ts` live against four deleted modules
`REFACTOR_PLAN.md:37` (§2.1 item 3) removes 2 of the 4 imports in `src/server/services/service-container.ts`. Main agent verified the file directly: `:1` `PrismaCapabilityReader`, `:2` `PrismaAccessLinkStore`, `:3` `AccessLinkService`, `:4` `AuthorizationService` — **all four** point at §2.3 deletions. Both the file's only exports and all 8 of its importers sit inside the delete set, so the correct action is *delete the file*, not "clean container imports".
*Found by RV-A (B2) and RV-F (F1); upheld by VV-A and VV-F; independently confirmed by main agent.*

### B2 — `tests/unit/authorization.test.ts` is missing from the test-deletion list
Main agent confirmed: the file (634 lines, 24 `it()` cases) imports `AuthorizationService` (plus `CapabilityAssignmentRecord` / `CapabilityReader` types) from `src/server/services/authorization-service.ts` at lines 5-10. §2.4 does not list it. Tests are part of the `typecheck` program, so **Day 1's own gate fails** and, separately, `npm test` loses 24 more cases than the plan budgets (33% → ~43% of all assertions). A full sweep found exactly 6 test files importing deleted modules: 5 listed, this one not.
*Found by RV-A (B1) and RV-F (F2); upheld verbatim by VV-A and VV-F.*

### B3 — §3.1's "Action Seam" has no working mechanism as specified
The single highest-stakes claim in the plan. Verified against vendored Next.js source rather than memory:
- `E625` is real and correctly numbered: `node_modules/next/dist/export/index.js:380-384`, with no `buildExport` guard and no config opt-out (`config-schema.js:245-248`).
- The verifier's decisive contribution: **E625 is a bundle-graph *membership* gate, not a call-site check.** 24 `"use server"` actions are exported in this repo, only 17 appear in `.next/server/server-reference-manifest.json` — yet *any* statically reachable server variant registers ids and aborts `build:demo`. So "one seam module that imports both variants" cannot work, and injecting handlers as props across a Server-Component boundary is not legal for plain functions either.
- Two Server Components already bind actions straight to JSX (`entrar/page.tsx:73`, `portal-shell.tsx:68`) and survive only via uncommitted `runtimeMode` guards plus throwing stubs.
- §3.1 deletes the 9 `@runtime/*` aliases (confirmed: `next.config.ts:44-76` vs `tsconfig.json:24-42`) **without naming a replacement**. VV-C did identify two legal designs (a generated per-target entry, or the dedicated static entry already sketched at `docs/implementation/v1-architecture-plan.md:69-71`) — neither is the plan's "handlers passed through the composition seam".
*Found by RV-C; every refutation attempt failed under VV-C. RV-F (F3) independently found the same chain from the component side; VV-F added that the aliases also serve a build-time **data-reader** half across 11 server pages, so a client-only seam fixes neither and implies ~17 new POST handlers.*

### B4 — The auditoria page is repointed at a table whose only writer is deleted
§2.1 item 2 sends `/portal/admin/auditoria` to the real `AuditEvent` table, while §2.3 deletes `src/server/db/prisma-access-link-store.ts:325-326`, which a full-writer sweep confirmed is the **sole** `AuditEvent` writer in the codebase. The result is an audit page that is guaranteed empty. "Remove the page if deferred" is the audit's own authorised option, and the page is already unreachable today.
*Found by RV-B (F-03); upheld by VV-B.*

### B5 — Schema drops with no migration step and a gate that cannot see the drift
`prisma validate` cannot detect migration/schema drift (only 4 schema lines mention `AccessLink`; `RateLimitBucket` is relation-free, so validation passes), and §6 contains **no drop-migration step anywhere**. Meanwhile the migrations have never been applied to a real database (audit risk R1) and `4_v1_game_state` / `5_v1_game_events` are **untracked** in git, so Day 1's "commit working tree" does not produce a clean, reproducible HEAD either.
*Found by RV-D and RV-F; VV-D and VV-A upheld, VV-A additionally refuting the "6 committed migrations" phrasing (4 tracked, 2 untracked); VV-D proposed the missing gate: `migrate diff --exit-code`.*

### B6 — §7.5's "fully operational demo" is unattainable for any created entity
`generateStaticParams` returns seed ids only, and `out/portal/turmas` contains exactly 3 prerendered pages. Any class created in the demo 404s on refresh, which contradicts §3.3's own deep-link justification for keeping localStorage.
*Found by RV-C; upheld verbatim by VV-C.*

### B7 — Day 1 breaks the build on a pipeline that publishes to GitHub Pages on every push
`deploy.yml` is the only workflow: it triggers on `push` to `main`, runs **no lint, no typecheck, no test**, and deploys Pages. §1.1's framing is therefore accurate, but §6's Phase 0 ("wire CI", "accept a temporary build break") is stale in both directions: the red build goes public, and the CI the plan asks for mostly exists minus the checks.
*Found by RV-F; upheld by VV-F.*

### B8 — §7.1 ("zero files over 400 lines") is unreachable with §4's work list
Main-agent measurement (excluding `src/generated`): **17 files over 400 lines** today. Four are deleted by §2 (1,625 / 717 / 521 / 517), leaving 13; §4 splits only 4 of those (`portal.module.css`, `game-offline-sync.ts`, `game-host.tsx`, `adult-portal/service.ts`), leaving **9 unbudgeted files** (`adult-portal-demo-store.ts` 1,024, `public.module.css` 1,017, `marketing.module.css` 688, `game-offline-sync.test.ts` 728, `authorization.test.ts` 634, `player-access-workflow.tsx` 540, `contracts/v1/schemas.ts` 481, `prisma-adult-portal-store.ts` 467, `team-screen.tsx` 411).
*Found by RV-B (F-08), upheld by VV-B and VV-F, and reproduced exactly by the main agent. VV-A's competing count of "14" is wrong.*

---

## 3. Numbers: what the plan got right and wrong

**Reproduced exactly (no caveat):** §2.2 route trees 6/6; §2.4 test-case counts 56/13/5/2/2; §2.5 relation citations `schema.prisma:65` / `:80` (at HEAD *and* in the dirty worktree); 29,722 lines / 24 files in `src/generated`; `portal.module.css` 4,910; `results.module.css` 378; `team-screen.module.css` 123 (**exists** — the suspicion it was fabricated is refuted); `game-offline-sync.ts` 1,222; `game-host.tsx` 932; `game-bridge.ts` 84; `service.ts` 616; 68 design tokens, all inside `globals.css` `:root`; "30+ components" (33); Tailwind genuinely absent; 9 `@runtime/*` aliases; "~6,450 lines" ≈ correct **only** as the non-blank total (6,439 non-blank vs 7,050 physical).

**Wrong or misleading:**

| Plan claim | Reality | Severity |
| :--- | :--- | :--- |
| "all 42 surviving imports of `@/generated/prisma/enums`" | 44 statements across 43 files **today**; 7 of those files are deleted by §2 → ~36 files / 37 statements survive. "42" is a pre-purge count labelled as surviving. | MINOR |
| "Purging Generation A immediately deletes ~1,570 lines of dead CSS" | **Defended.** Independent re-measurement: 1,357 purge-attributable declaration lines = 1,567 physical lines. The reviewer attacks that called it unreproducible were themselves refuted. | — |
| "extract `.button`, `.buttonGhost`, `.input`, `.field`, `.card`, `.badge`" | `.card` and `.badge` **do not exist** in any stylesheet. Real analogues: `.panel` (itself purge-dead — only `activity-builder.tsx` uses it) and `.statusBadge`. | MAJOR |
| "308 distinct classes" | 315-319 depending on method; 308 matches no counting method. | MINOR |
| §4.2 split 650+60+350 | Sums to 1,060 of 1,222; ~162 lines of shared types unallocated. Boundaries themselves are accurate. | MINOR |
| "Ensure `src/runtime/mode.ts` has a safe default (`server`)" | `server` is the **unsafe** branch here and `tests/unit/runtime-mode.test.ts:11-12` asserts the throw the change would remove. | MAJOR |
| `scripts/next-target.mjs` "performs … preparing static assets" | Not in that file; asset copying lives in `scripts/start.mjs:40-47` (server flow). | MINOR |
| "Retain … the `adult-portal-demo-change` cross-tab event" | Cross-tab sync is a `storage` listener; the CustomEvent is same-tab. Rollback "half-exists" (`adult-portal-demo-store.ts:741-750` vs a no-op at `:392-396`). | MINOR |
| §3.2 "Benefit: TypeScript stops scanning 29,722 lines" | All 24 generated files already carry `@ts-nocheck`; only ~444 lines (1.5%) contribute. The "Decision" also already *is* the status quo. | MAJOR |

---

## 4. Reviewer findings that were refuted (do not act on these)

Included because the plan author will otherwise receive them as advice:

1. **"§2.5 misses the `AccessLink` inverse relations"** — no: exactly two, cited precisely, so `prisma validate` cannot fail. The real gap is `enum Capability.LINK_VIEW` / `LINK_MANAGE` (`schema.prisma:19-20`, plus the PostgreSQL enum in `0_init`) and the fact that the *whole* `Capability` enum loses its production readers.
2. **"D7 is silently reversed"** (RV-B) — refuted by VV-B: the audit's real D7 at `:799` does say "Delete"; the quoted confirmation gate is Phase-2 prose at `:652`. Likewise "integration appears nowhere" is false (`:198`), and deleting the auditoria page is an audit-authorised option.
3. **"D6 mandates keeping `RateLimitBucket`"** — weakened: audit `:725` reads "or delete". The residue that *is* real is `RATE_LIMITED` in `src/server/http/errors.ts:11` and `contracts/schemas/api-error.v1.schema.json:21`.
4. **"~1,570 dead CSS is inflated"** (RV-E) and **"52 of 319 classes purge-attributable"** (RV-B F-10) — both refuted by adjudicated re-measurement (81 purge-attributable classes; 1,567 physical lines). The plan is right here.
5. **"CI needs 4 secrets that make `next.config.ts` hard-fail"** (RV-F F4) — downgraded BLOCKER → MAJOR: tracked `.env.example:9,16,17,23` satisfies both zod gates; only the local gitignored `.env` masks it.
6. **"§3.3 duplicate handshake between `game-host.tsx` and `demo-game-adapter.tsx`"** — this one is the *plan* being wrong, and it survived verification: the adapter contains zero `postMessage`/listener code and `createBridgeRequestId` was already extracted to `game-bridge.ts:77`. §4.3 item 3 describes work that is already done.
7. **A verifier's own error:** VV-A's "9 files over 400 lines is unreproducible (14)" — the correct figure is 17 (main agent + VV-B + VV-F agree).

---

## 5. What must change before this plan is executable

1. **§3.1 must name a mechanism, not a pattern.** Pick one of the two legal designs VV-C identified (generated per-target entry, or the dedicated static entry already in `docs/implementation/v1-architecture-plan.md:69-71`), and state explicitly that no `"use server"` module may be *statically reachable* in the demo graph. Then re-derive the Day-2 alias removal, including the 11 server pages that use the aliases as a data reader.
2. **Complete §2.1 as a full reverse-dependency closure** of §2.2-§2.5: add `service-container.ts` (delete, not clean) and `tests/unit/authorization.test.ts` (delete or rewrite); fix item 1's stated rationale (`ActivityStatus` needs a ~5-line prune in `status-badge.tsx:18/23/25`, whose comparisons would otherwise hit TS2367).
3. **Add a migration column to §2.5 and a step to Day 1**: schema drops require an explicit migration (or a decided `db push` + regenerate), the two untracked migrations must be committed, and `migrate diff --exit-code` belongs in §7's gates. `prisma validate` alone is a false green.
4. **Resolve §3.1-vs-§1.1's contradiction:** the plan lists "duplicated Server Actions (one `use server`, one `use client`)" as the core problem and then adopts it as the target design. Say which is intended.
5. **Fix §7.1 and §7.5 to match reality:** either budget the remaining 9 oversized files into §4 or narrow the criterion; and scope the demo criterion to "seeded routes deep-link on refresh" or add client-rendered fallbacks for created entities.
6. **Add the missing primitives and correct the false premises:** `.card`/`.badge` (nonexistent), `.panel` (purge-dead), 27 genuinely shared class names that a mechanical purge would break (`styles[\`tone${…}\`]` dynamic access included), and delete §4.3's duplicate-handshake item.
7. **Re-sequence Day 1-2 against the publishing pipeline:** either add a `pull_request` verify workflow (lint/typecheck/test/build) before the purge lands, or branch the purge so Day 1's guaranteed-red build is not deployed to Pages. Correct the longest-red-window estimate: Day 2's alias removal, ~1.5-2 of the 4 days, not "temporary".
8. **Re-baseline the estimate:** the audit's 12-21 developer-days covers a superset of this scope, but the plan's 3-4 days omits ~9 unbudgeted files, the seam redesign, the migration work, and the demo-created-entity fix. The plan should state its own scope delta rather than inherit a number that reads as a 3-4 day version of the audit.

---

## 6. Residual uncertainty

- Whether excluding `src/generated/**` changes `tsc` wall time at all could not be settled read-only (running `tsc` rewrites `tsconfig.tsbuildinfo`, which was forbidden). VV-D's `@ts-nocheck` + 444-line argument is sound but the file still enters the program graph. **Run `tsc --noEmit --incremental false` on a scratch branch before adopting §3.2.**
- `docs/schemas/database-model.md` was already stale before this plan (7 tables documented vs 16 models). No documentation-truth pass exists in §6 at all.
- The plan's header cites `REFACTOR_PLAN-review-2026-09-23.md` as "the audit"; the binding decision record is `docs/architecture-audit-2026-09-23.md`. Several v1 findings are marked fixed by the plan's wording but were verified NOT fixed.
