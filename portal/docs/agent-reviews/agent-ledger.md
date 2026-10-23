# Agent Ledger — REFACTOR_PLAN.md Review

Companion to `REFACTOR_PLAN-review-2026-09-23.md`. Records which agent produced which finding, which agent then tried to refute it, and the outcome. All agents were read-only (`Explore`, no edit/write tools); no code was produced and `REFACTOR_PLAN.md` was untouched.

## Round 1 — scoped review agents (7)

| # | Scope | Assigned to | Produced |
| :-- | :-- | :-- | :-- |
| A | §2 deletion manifest: paths, consumers, missed dead code | Explore | Purge-breaking importers (`status-badge.tsx:1`, `admin/auditoria/page.tsx:4,54`, `service-container.ts:2,3`, `tests/unit/portal-dev-bypass.test.ts:6-8`); SAFE set for 6 services/5 components; 7 missed dead files; route totals 1,188 / 92 / 23 / 7 / 7 / 364; total 6,447 |
| B | §2.4 + §3.3 Prisma schema & generated client | Explore | Inverse relations at `schema.prisma:65,80`; RateLimitBucket unreferenced but reverses D6 (`audit:798`); no drop migration; 29,722 generated lines; already ignored by eslint/prettier/git; `prisma-client` generator requires `output`; 51 importers |
| D | §3.1 dual runtime, static export, Server Actions | Explore | E625 enforcement; 9 tsconfig paths == server branch (no split-brain); 24 `@runtime` sites; localStorage reality vs "In-Memory"; Pages broken Day 1–4 via `deploy.yml` |
| E | §4 god files + §7.1 line criterion | Explore | 37 CSS importers; tokens only in `globals.css:1`; dead-CSS attribution; `results.module.css`/`team-screen.module.css` already exist; internal maps of the 4 god files; 9 surviving files >400 lines |
| F | §3.2 tooling, env, CI, §1.1 statistics | Explore | `next-target.mjs` five extra jobs; `src/server/config/env.ts` already exists and is lazy; audit `:586,:721` keep the wrapper; `runtime/mode.ts` no default; green baseline (284 tests); 46% paired / ~20% verbatim actions |
| G | Product/spec consistency vs PRODUCT.md, DESIGN.md, contracts, prior audit | Explore | `PRODUCT.md:113` misquote; no V1 counterpart for activity creation; D1/D6/D7/F1 contradiction list; `:744` budgets; `:769` 12–21 dev-days; internal inconsistency list |
| (main) | Direct command evidence | — | `wc -l` on 19 manifest files; alias listings from both configs; route totals; importer grep; `AuditEvent` writers; >400-line inventory |

## Round 2 — adversarial verification agents (4)

Each was instructed to try to **refute** a named claim, and to say so plainly if the claim was overstated.

| Verifier | Claim under attack | Verdict | What changed in the report |
| :-- | :-- | :-- | :-- |
| V-A | C1: "`output: 'export'` cannot contain any Server Action, therefore §3.1 is impossible" | **TRUE but overstated** | Root cause re-attributed: the blocker is keeping `"use server"` on browser-referenced actions, not alias deletion itself. `useActionState` accepts a plain client function (`classes-screen.tsx:12` → `adult-portal-form.tsx:31-34`), so a per-target entry point builds. Report B1 now states the fix direction and cites `v1-architecture-plan.md:69-71`. Also corrected: the manifest check is graph-wide registration, and orphan `"use server"` files would pass. |
| V-B | P: §3.3 "generate into default `node_modules/@prisma/client`" | **Possible-but-wrong-as-written** (reviewer's mechanism right, "impossible" wrong) | B2 adds the escape (`prisma-client-js` legacy provider is still registered in 7.9.1's CLI) and sharpens the false-premise finding: all 24 generated files carry `@ts-nocheck`, so `tsc` never semantically checks them; eslint/prettier/git already ignore the directory. Cost refined to 43 files / `@/generated/prisma/enums` ×42. |
| V-C | X1/X2/X3: §4.1 CSS purge volume, ~400-line target, 4–6h low-risk | **X1 supported in volume / overstated in attribution; X2 UNSUPPORTED; X3 understated 2–3×** | See dissent below. Both agents agree ~400 is unreachable; V-C's independent second method (Node char-tokenizer) reproduced the awk result within 2.5%. |
| V-D | M1–M9 missed-dead-code / repo-staleness claims | **8 TRUE, 1 PARTLY TRUE** | Confirmed `share-actions` (147), `tokens.ts` (61, after disproving the suspicion that player-access reuses it — it has `player-credential-tokens.ts`), `service-container` (fully orphaned, so the earlier "can't just delete it" hedge was corrected), `authorization-service` (244), `prisma-capability-reader` (55), `public-state`/`activity-mark` exclusive to deleted trees. Corrected the logger path to `src/server/observability/logger.ts:11`. Confirmed the demo token-hash defect is **still open** at `player-access-demo-actions.ts:36`. |

## Where the agents disagreed (unresolved, both numbers reported)

**Dead CSS in `portal.module.css`.**
- Agent E: live-by-survivors 1,984 lines; Gen-A-only **875**; never-referenced 614; concluded the plan's "~1,500" conflates Gen A with pre-existing dead CSS.
- Verifier V-C: total dead **1,572–1,611** rule lines, of which only **947** attributable to deleted trees and 625 referenced by nothing; also restricted measurement to the 37 files that actually import this stylesheet, arguing a whole-`src` grep inflates "live" via class-name collisions with `public`/`marketing`/`results` modules.

Same direction, different denominators. Report M4 carries both. Neither supports §4.1's arithmetic, and both flag the same two blind spots: dynamic `styles[\`tone${…}\`]` lookups (`activity-mark.tsx:22`, `materials-explorer.tsx:92`) and cascade re-ordering across 11 interleaved `@media` blocks.

**Alias deletion: "impossible" vs "wording bug."** Agent D called §3.1(b)/(c)/(e) technically impossible; V-A downgraded that to a contradiction between criterion 2's wording and criterion 5, since the demo's existing client twins prove the call sites don't need Server Action semantics. Report B1 uses V-A's framing and preserves D's substantive point that the aliases are load-bearing, not cosmetic.

## Claims that did NOT survive review

- §1.1 "TypeScript vs. Turbopack split-brain" — refuted by direct diff: all 9 tsconfig paths equal `next.config.ts`'s server branch. Replaced in the report (M2) with the real defect: the demo twins are never checked through the alias contract, and drift already exists (`demo-auth-actions.ts:1-7` vs `entrar/actions.ts:15`).
- §3.2 "Move environment validation to `src/server/config/env.ts`" — the file already exists (124 lines) and already validates lazily; the step is a no-op (M8).
- "Every file named in §2.2 with the quoted line counts" — 11 of 16 numbers were wrong; the largest error is `materiais/` at 92 lines vs a claimed ~600 (M1).
- The suspicion that §2/§3 would break the V1 contracts — disproved: `src/contracts/v1/schemas.ts` and `v1-contracts.test.ts` have zero references to `AccessLink`, materials, `portal-view-service`, `@runtime`, or `@/generated`.

## Not verified, and why

No builds, tests, `prisma generate`, or `npm` scripts were run, per the read-only mandate. The B1 conclusion rests on Next's own enforcement source (`node_modules/next/dist/export/index.js:357-387`) and the vendored `static-exports.md`, not on an observed build failure. Empirically confirming it requires an alias-stripped `build:demo` — deliberately out of scope for a review.
