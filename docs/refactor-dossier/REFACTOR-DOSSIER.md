# V1 Refactor — Implementation Dossier

**Repo:** `SMS_Portal` (`missoes-caramelito-platform`) · **Branch/state at measurement:** `main` @ `e5aaf1e`, clean tree
**Target document:** `REFACTOR_PLAN.md` v2.1 — treated as **fixed input / intended direction**. Nothing here proposes editing it.
**Purpose:** everything an implementer needs to execute the refactor without rediscovering the architecture. Every claim is either measured in this repo or attributed to a report in `reports/`.
**Companion files:** `CRITIQUE-governing-conflicts.md` (what the two governing documents get wrong), `COMPAT-POLICY.md` (the class-**A**/**B**/**C** ruling on every clause that spent effort protecting the status quo; its §4 states the ten edits applied through this document and its §6 carries the owner's split ruling, which **governs wherever §4 disagrees**), `reports/` (16 subagent reports + 4 main-agent notes + 7 per-phase refutation reports `RV-00…RV-X`, including `AUDIT-dossier-correctness.md`, which audited this document and forced the corrections now marked inline as `AUDIT` B1-B7).

---

## 1. How to use this dossier

### 1.1 Claim confidence marks

| Mark | Meaning |
| :--- | :--- |
| **[V]** | Verified twice — an investigating agent and an independent verifying agent reached the same result, or the main agent reproduced it. Safe to implement against. |
| **[S]** | Single-source. Correct as far as checked, but only one agent measured it. Re-check before relying on it for a destructive step. |
| **[U]** | Unresolved conflict or unverified. A decision or a spike is required. Never implement against these silently. |

### 1.2 Reading order for an implementer

1. §2 baseline, §3 decision points (needs human answers before any code).
2. §4 Phase 0 — this **must** land first; several later gates are meaningless without it.
3. §5–§8 phases; **Phase 1 (§5–§6) and Phase 2 (§7) are file-disjoint and may run in parallel** (§10.2). Phase 3 (§8) follows both. Each phase ends with its own gate, and §9.1 lists which gates can actually fail.
4. §11 regression register before touching any UI file; §7 before touching the seam; §10 for the ordering rationale.

### 1.3 Provenance and citation convention

Sections cite the report that established them, e.g. `(INV-A §2, VER-A §0)` = `reports/INV-A-purge-closure.md` §2, refuted-then-confirmed by `reports/VER-A-purge-closure-verification.md` §0. Where the two disagree, this dossier publishes the adjudicated result and says so.

**`§` is prefixed to disambiguate:** `plan §7.1` always means a section of `REFACTOR_PLAN.md`; a bare `§7.1` means a section of **this dossier**. The final audit found the collision genuinely confusing, so the convention is applied throughout.

---

## 2. Verified baseline

Everything below was measured on the clean tree at `e5aaf1e`. Do not trust later comparisons unless they are re-taken against these numbers.

| Item | Value | Method / evidence | Mark |
| :--- | :--- | :--- | :--- |
| Working tree | clean; only `?? docs/refactor-dossier/` (this work) | `git status --porcelain` | [V] |
| Migrations | `0_init` … `5_v1_game_events` — **all 6 tracked** | `git ls-files prisma/migrations` — plan §6 Day 0's "commit migrations 4 & 5" is already done | [V] |
| `npm run typecheck` | **exit 0**, 1,706 files, ~5.6 s | `tsc -p tsconfig.json --noEmit --incremental false` (VER-A B2) | [V] |
| `npm run lint` | **exit 0** at `--max-warnings=0` | `npx eslint .` (INV-F, VER-A) | [V] |
| `npx vitest run` | **33 files / 284 tests / 0 failed** | `--reporter=json` (VER-A N5) | [V] |
| `npm run format:check` | **RED** — `[warn] REFACTOR_PLAN.md`, exit 1 | `npx prettier --check .` (VER-A B3). Predates the refactor | [V] |
| `npx prisma validate` | valid | run (INV-A §0) | [V] |
| Handwritten code base | 20,096 lines `src/**/*.ts{,x}` (excl. `src/generated`) + 6,579 `tests/**/*.ts` = **26,675** TS; + 7,337 CSS = **34,012** | `find … xargs wc -l` (VER-A §3) | [V] |
| Generated Prisma client | 29,722 lines / 24 files, **all `.ts`, all carrying `@ts-nocheck`** | `grep -rl ts-nocheck src/generated \| wc -l` → 24 | [V] |
| `"use server"` files / exported actions / registered ids | **7 / 24 / 17** (node 17, edge 0) | manifest carries `filename` + `exportedName` per id, so the 7-gap is proven per file: the 6 actions in `portal/atividades/actions.ts` plus `requestPasswordResetAction` (VER-B; corroborates INV-B) | [V] |
| `@runtime/*` aliases | **9** in `next.config.ts:44-79` (per-target) and **9** in `tsconfig.json:24-42` (**always** server variant) | read both files | [V] |
| `@runtime/*` consumers | **24 import statements in 23 files, 38 specifiers** | INV-B inventory; VER-B corrected one per-table split (17/21, not 18/20) but the totals | [V] |
| `runtimeMode` branch sites | **95 lines in 23 files** — raw `grep -ro` gives 107 *occurrences*, and only **34** of the 95 lines hold an actual comparison | prior review, reproduced by INV-B | [S] |
| Static export today | succeeds; **26** HTML docs expected post-purge (from **104 in the current local export**, −78 purged). The 104 are **not committed**: `.gitignore:7` is `/out`, `git ls-files out` → **0** — they are a local build artifact, and publication runs through `deploy.yml`, not through git | route-tree enumeration (`VER-F` item 7) reproduced independently by `AUDIT` (104 − 78 = 26); the untracked-but-published split re-measured by `COMPAT-POLICY.md` §4 edit 9 / §6 | [V] |
| GitHub Actions | **`deploy.yml` only**: `push: main` + `workflow_dispatch`, no `pull_request`, runs `npm ci && npm run build:demo` and publishes `./out`. **No lint, no typecheck, no test.** `ci.yml` does not exist yet — `.github/workflows/` holds only `deploy.yml` (`test -f .github/workflows/ci.yml` → exit 1) — and §4 item 0.4 is its author, not Phase 4. The pipeline this refactor adds also carries **no schema-drift gate** (§6.5) | read `.github/workflows/deploy.yml`; `COMPAT-POLICY.md` §4 edit 3 | [V] |
| Test environment | `vitest.config.mts:12` is `environment: "node"`, with `env.APP_RUNTIME_MODE="demo"` at `:13-15`; no jsdom/happy-dom/`@testing-library`/`fake-indexeddb` anywhere incl. the lockfile | VER-D, ADV-3 | [V] |
| `server-only` | **not installed** — `ERR_MODULE_NOT_FOUND` under this Node, yet `import "server-only"` appears at the top of ≥10 first-party modules; resolves only via Next's per-layer alias and Next's ambient types | ADJ-03 F3 | [V] |

### 2.1 Publishable purge volume — replacing the plan's figures

> **46 files / 7,802 physical lines** (§2.2 trees 1,754 · §2.3 services+components 3,458 · §2.4 tests 2,590).
> **= 29.3% of handwritten TypeScript** (base 26,675) — the plan's "~29%" is **correct**.
> **= 22.9% of all handwritten lines including CSS modules** (base 34,012).
> The plan's `7,729` is short by exactly the 73-line auditoria page it added to §2.2 (its own table says 95; the file is **73**).

`INV-A`'s claim that "no counting method reproduces 29%" was **refuted**: it chose a base containing CSS while the purge deletes zero CSS files. Use the TS-only figure for the headline and label the CSS-inclusive one whenever both appear. [V] (`VER-A §3, §6-A`)

Post-purge test suite: **27 files / 182 tests**, i.e. −102 cases (−35.9%), measured not arithmetic. V1 authorization remains covered by `tests/unit/v1-authorization.test.ts`. [V]

---

## 3. Decision points requiring a human answer first

These are not implementation details; each changes what gets built. Do not start the affected phase without an answer. **D-4, D-5 and D-6 no longer need one** — the owner settled them (`COMPAT-POLICY.md` §6, adopted 2026-09-23), and their rows record the ruling rather than an open question. D-1, D-2, D-3 and D-7 are still human decisions.

| # | Decision | Options | Dossier's recommendation | Blocking |
| :--- | :--- | :--- | :--- | :--- |
| D-1 | **Seam mechanism.** Plan §3.1 mandates generated per-target entries. `VER-F`/`ADV-2` established E625 is **not currently failing** (the demo graph is already action-free), so the seam's stated rationale is false and the honest one is type-safety/testability — which the audit's own already-approved `tsconfig.demo.json` + `typecheck:demo` + vitest alias delivers for ~5-6 h instead of ~2-3 days. | (a) plan §3.1 as written; (b) cheap audited alternative; (c) cheap now, generated entry later | **(b) then (c)** — take (b) to get the drift/test guarantees, and treat the generated entry as a follow-up only if a concrete need survives. §7 documents both faithfully so (a) can still be executed as mandated | Phase 2 |
| D-2 | **Demo deep-link criterion (§7.5).** `generateStaticParams` returns seed ids only, so a demo-created class/org has no static page: in-app navigation to it fails and a hard refresh hits `out/404.html` on Pages. | (a) scope criterion to seeded routes; (b) client-routed SPA fallback (a **documented** pattern in Next's export guides — `INV-F`'s "no supported pattern" was refuted — but rejected on Pages hosting grounds); (c) stop navigating to created entities | **(c) + (a)**. `ADV`/`INV-F` found (c) is **already largely implemented** (`classes-screen.tsx:169-180`); formalise it and **narrow §7.5's criterion** to seeded routes in the docs. (c) is now cheap: `COMPAT-POLICY.md` edit 6 (§6 adopted it) lifted the "do not change the demo storage key" ban, so §8.4's `DemoAdultPortalStore.transaction` fix and credential change can ship with a `:v3` bump and no wipe worry (§12 row 3) | Phase 4 |
| D-3 | **CSS modularization scope (plan §4.1).** The extraction is what creates the sprint's only silent-blank-print defect (§11 R-01) and, by `VER-E`'s own strict partition, lands `primitives` ≈860 and residual shell ≈836 lines — both **still above** the plan's own 600-line CSS ceiling. | (a) full plan §4.1; (b) dead purge + surgery, no extraction; (c) primitives-only extraction | **(b)** — ship exactly what §8.3's "Ship now" list defines (1,862-line dead purge + 19-rule surgery set + 3 orphaned tokens) and **defer all extraction** until the cross-file selector-integrity oracle exists. §13.3 refers to the same set | Phase 3 |
| D-4 | **`/atividade/[token]` sunset — RESOLVED, no human answer needed.** Deleting it hard-404s every previously published URL and every printed QR card; `output: 'export'` makes a server redirect impossible and `public/_redirects` is absent (and ignored by Pages). `walkthrough.md:11` documents such a URL as **live** (HTTP 200 today — **[S]**: a single agent fetched it and `COMPAT-POLICY.md` §6 records the main agent's own retry as mis-addressed, so only the Pages-settings human check settles it). | ~~(a) accept + announce; (b) keep one static shim page~~ — option (b) is **deleted** by `COMPAT-POLICY.md` edit 4 (§6: "Adopt as written"): no shim could work anyway, because the backing table is `DROP TABLE "access_links"` (§6.4), and `activity-controls.tsx:44` minted those URLs from `Math.random()`, so every "rotated" link the demo ever printed was 404 from birth | **The route goes with the rest of §2.2.** The stakeholder gate was this project re-asking a question its own fixed input answered: `REFACTOR_PLAN.md:21` purges Generation A in a single closed sweep and `slice-03-05-portal-handoff.md:53-55` item 4 orders the legacy activity routes removed. The **one surviving duty** is deleting `walkthrough.md:11` (§9.4); an announcement is owed only if the human check turns up a named person holding the link | — (was Phase 1) |
| D-5 | **`RATE_LIMITED` / `RateLimitBucket`.** Plan §2.5.4 removes both. The audit's D6 says implement, but Phase 6 step 3 (`:725-727`) authorises "or delete". Nothing ever referenced `RateLimitBucket` — not one line of code, in the repo's history or today. | (a) delete model + trim code; ~~(b) delete model, keep the wire code~~ | **(a)** — `RATE_LIMITED` goes from `src/server/http/errors.ts:11` **and** `contracts/schemas/api-error.v1.schema.json:21` in the **same commit** as `model RateLimitBucket` (`COMPAT-POLICY.md` edit 5, adopted at §6). (b) was a class-**A** clause mislabelled **B**: that schema describes the HTTP envelope of `/api/v1/player/*` (`src/server/http/route.ts:46` → `errors.ts:46` `errorResponse`), whose only client is portal-owned browser code (`game-host.tsx:290, 294, 298, 463` — the `:291,295,300,460` this document first printed were off by one, corrected at `COMPAT-POLICY.md` §6), and which is never reachable in the shipped target at all (`output: 'export'` drops route handlers, §7.7). GameMaker's real vocabulary is the **separate** `contracts/schemas/v1/protocol-error.v1.schema.json` (4 codes), which `game-host.tsx:142` types against and this edit does not touch. Reproduced: `grep -rn "ApiErrorCode" src tests` → `errors.ts:27,37` only; `grep -rnE "429" src tests scripts` → **0 hits**; `readResponseJson` (`game-host.tsx:82-88`) never inspects `code`. Confirming in `Heroes_Trial` that no GML build branches on the code is now a **courtesy, not a blocker** | Phase 1 |
| D-6 | **`AuditEvent`.** §2.5.5 keeps it while §2 deletes its only writer (`prisma-access-link-store.ts:325-326`) **and** its only reader (the auditoria page). Post-purge it is a write-nothing/read-nothing table with a live inverse at `schema.prisma:66`. | (a) keep as annotated placeholder; (b) drop it too | **(b)** — drop `model AuditEvent` (`schema.prisma:281-299`) and `ProfessionalProfile.auditEvents` (`:66`) with the rest of §6.2 (`COMPAT-POLICY.md` edit 7, adopted at §6). (a)'s rationale — that the next reader would assume an audit trail exists — is refuted by the code: `src/server/services/portal-view-service.ts:416` is `export const auditEvents = demoRuntime ? demoAuditEvents : []`, so **server mode always rendered an empty list**. No trail ever existed even in Generation A, so there was never anything to be assumed, and **no explanatory comment is required**. Consequence: §6.4's generated statement list grows by two | Phase 1 |
| D-7 | **Branch protection.** `ADV-1`: `ci.yml` cannot be the first merge — `format:check` is already red, so `ci.yml` is born red and either blocks every later PR or gets disabled. | (a) fix `format:check` + Phase 0 first, then `ci.yml`, then protection; (b) purge on a branch with no protection | **(a)**, in that order (§4) | Everything |

---

## 4. Phase 0 — prerequisites (must precede all later phases)

Three of these are not in the plan and each one invalidates a later gate.

**0.1 Add `REFACTOR_PLAN.md` to `.prettierignore`, or make it prettier-clean.** `format:check` fails on `main` today. `package.json:24` runs `format:check` first inside `npm run check`, so **every** phase's exit criterion ("check green") is unreachable until this is fixed. Fix is one line in `.prettierignore` (the file already ignores `docs`, `contracts`, `src/generated`, `prisma/schema.prisma`). [V]

**0.2 Fix the order-dependent test.** `tests/unit/auth.test.ts:161-165` deletes `APP_RUNTIME_MODE` from `process.env`, and a real failure reproduces under `vitest run --no-isolate --fileParallelism=false`. Because `vitest.config.mts:12-14` injects that variable, an order-dependent test means **the baseline is not trustworthy for any later phase**. Fix before recording any gate. [V] (`VER-F`)

**0.3 Establish that `typecheck` is stateful, and order CI accordingly.** Three corrections to what this dossier first claimed, all executed by the final audit pass (`AUDIT` B1; see `reports/ADJ-03` §F1, corrected there):
- `npm run typecheck` **does** pass on a fresh clone with no `.next`. Verified: real `git clone` → `prisma generate` → `tsc --noEmit --incremental false` → **exit 0**. `next-env.d.ts` is a `.d.ts` and `tsconfig.json:6` sets `skipLibCheck: true`, so its `:3-4` imports of `./.next/types/routes.d.ts` and `root-params.d.ts` produce no diagnostic (A/B: with `skipLibCheck: false` the same file yields `TS2882`).
- A compile before typecheck is **still** the right CI order, but only for the first reason: without `.next/types` the route-config and `params` validators are not in the program at all, so typecheck passes while silently checking less. The second reason this document gave — that after §2.2 typecheck is "actively *wrong* until a compile regenerates them" — is **only half true**: a build rewrites `.next/types/` and leaves the two `dev/types` copies stale, so the compile does not clear the hazard, it shrinks it from three roots to two (next bullet). The audit's ordering at `architecture-audit-2026-09-23.md:604` is therefore **acceptable**, not "wrong as written".
- Stale generated validators are a **local-workstation** hazard, not a CI one. There are **three** copies of `validator.ts` on a dev machine — `.next/types/`, `.next/dev/types/` and `.next-demo-dev/dev/types/` (the third is what every earlier sweep in this repo missed) — **448 lines** each, each holding **44** `typeof import(…)` references, of which **21** name §2.2's seven purged trees → **63** stale edges, not the "up to 60 (reproduced exactly)" this document first published. Two qualifiers must travel with the number: they are **not errors today** — all 21 resolve to real files, and they become false `TS2307`s only in the window where the source is deleted and the validator is not regenerated — and they can never reach CI, because `.gitignore:5-6` keeps every `.next` tree out of git so a fresh runner has none, and the two `dev/types` copies are written only by `next dev`, which CI never runs. [V] (re-measured by `phases/50-gates-ci-demo-docs.md` §Evidence: probe → `44 21`, `wc -l` → `448 ×3` on all three paths)
- **The remedy is deletion, not step order.** `rm -rf .next/types .next/dev .next-demo-dev` after the route deletions. A build regenerates at most the `.next/types/` copy, and `next build` runs its typecheck through the same **unfiltered** `tsc` CLI, so the stale references are read before any of them is rewritten — ordering clears none of it. They cannot be excluded from the program either: `next-env.d.ts` imports the file directly and `tsconfig.json`'s `**/*.ts` include re-matches it regardless of the `exclude` array, which lists only `node_modules`. `tsconfig.json` also globs a **fourth** root, `.next-demo-dev/types/`, which does not exist and is never written; only `.next-demo-dev/dev/types/` is. Never reach for `typescript.ignoreBuildErrors`.
- Both build targets write the **same** `.next` — the demo *build* gets no `distDir`, only demo *dev* does (`next.config.ts:26-28`). A manifest assertion is therefore order-sensitive: regenerate with the **server** compile after the route deletions, and read the demo manifest only immediately after a demo build.

**0.4 Create `ci.yml` and protect `main`.** **This item, not Phase 4, authors the workflow**: at `e5aaf1e` `.github/workflows/` holds only `deploy.yml` (`test -f .github/workflows/ci.yml` → exit 1), so every later phase edits a file that does not exist until this one merges. Required jobs, in this order: `format:check` → `lint` → (compile for types) → `typecheck` → `test` → `build:demo` → artifact assertions → `build:server`. **There is no schema-drift leg in this order and none is added** — see §6.5. `build:server` needs syntactically valid env (`next.config.ts:9-20` Zod-parses `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` ≥32, `APPLICATION_SECRET` ≥32) but **no reachable database** — `src/server/db/client.ts:17` constructs lazily and `portal/layout.tsx:22` gates on `connection()` — so placeholder secrets are sufficient. `npm ci`'s `postinstall → prisma generate` works offline from the tracked schema. [V] (`INV-F`, `VER-F`)

**0.5 Discard the plan's Day-0 premise.** "Commit 30 untracked files + uncommitted schema + migrations 4 & 5" is already done; the tree is clean and all six migrations are tracked. [V]

**Gate for Phase 0:** `npm run check` green on a fresh clone after `npm ci` (it needs no prior compile to pass — see 0.3 — but should still run one so route validators are in the program); `ci.yml` observed passing on a throwaway PR; branch protection on `main` with required checks.

---

## 5. Phase 1 — Generation A purge (plan §2)

### 5.1 The headline result

**The deletion manifest is closed.** `VER-A` proved it by executing it: in scratch copies outside the repo with `node_modules` junction-linked, deleting all 46 files **with zero edits** produces exactly **one** TypeScript error — `src/components/portal/status-badge.tsx:1 TS2307 Cannot find module '@/server/services/portal-view-service'` — and that single edge plus an 8-line edit closes the entire purge at `tsc`, `eslint` and `vitest` (27 files / 182 tests green). [V]

Caveat that matters operationally: that proof ran in a tree **without `.next`**. In the real working tree, Phase 0.3's stale validators add **63** false errors on top (three `validator.ts` copies × 21 refs naming the purged trees) — a workstation-only condition, since a fresh checkout has no `.next`. Both results are correct for their respective trees.

`INV-A`'s closure came from an import-graph build; `VER-A`'s from a second, independently built graph (299 files, 804 edges, resolving all 9 aliases both ways, `vi.mock` strings, dynamic `import()`, CSS as a node, 0 unresolved specifiers) **and** from execution. Route strings, `redirect()`, `revalidatePath()`, nav tables, `generateStaticParams`, the `proxy` matcher, config aliases, `sitemap`/`robots`/`_redirects` (none exist) and CSS all close cleanly. Repo-wide `composes:` has **0** hits, so deleting a component can only de-add a class, never dangle one. [V]

### 5.2 Corrections to plan §2 that the implementer must apply

| Plan item | What it says | Reality | Action |
| :--- | :--- | :--- | :--- |
| §2.1.1 | prune `"Aberta" \| "Rascunho" \| "Pausada"` from `status-badge.tsx` | `ActivityStatus` (`portal-view-service.ts:9`) has **four** members. Pruning three leaves `"Encerrada"` bound to a deleted file → the import survives → §2.3 does not close. `TS2367` on the comparisons is real but never reached: `TS2307` masks it, and `TS2367` is **not** gated on `strict` (`VER-A` §6-F) | Replace `status-badge.tsx` wholesale — see §5.3 |
| §2.1.3 | remove the dead `/atividade/` no-referrer branch at `proxy.ts:109-116` | **That range deletes live security code and does not compile.** It removes the `const referrerPolicy =` head (`:112`), the live `/jogar` branches (`:114-115`) and the ternary's true arm (`:116`). `VER-A` reproduced `proxy.ts:112:7 TS1128` by applying the plan literally | Delete **line 113 only** — see §5.4 |
| §2.1.3 | clean `ajuda/page.tsx` as a **pre-requisite** | It is a Server Component whose only imports (`PageHeader`, `Icon`, `portal.module.css`) all survive; its `topics` array contains zero hrefs and zero route strings. Nothing breaks | Reclassify as Day-4 copy hygiene. If edited, keep the `:34-45` markup: `moduleGrid`/`moduleCard`/`moduleArt` are used **only** by this page, but **`textLink` is shared** with `organization-detail-screen.tsx` and `overview-screen.tsx` (both survivors), so it is not ajuda-owned and must not be relocated with them (`AUDIT` B6) |
| §2.5 | 4 schema removals + 2 inverse relations + `scopedCapabilities` | **Misses `OrganizationMembership.capabilityAssignments` (`prisma/schema.prisma:97`)** → `P1012`. Reproduced by `INV-A`, `INV-C`, `VER-A`, `VER-C` and the main agent independently — five agreements | Add `:97`. Full procedure §6 |
| §2.2 | auditoria = 95 lines | 73 | Fix the number; the total becomes 7,802 |
| §2.3 | `class-groups-explorer.tsx` is legacy coupling | 0 importers today — pre-existing dead code, not coupling. Deleting is correct; the stated reason is not | No action change |
| §2.4 | — | complete and exact: all 6 files exist, counts 56/24/13/5/2/2 = 102 | — |
| §6 Day 1 | gate = `prisma validate && prisma generate && typecheck && npm test` | `prisma validate` proves referential integrity only; it cannot see that the migration SQL is missing — and **this refactor ships with no gate that can see it either** (§6.5) | Add **only** the non-empty-SQL assertion on the hand-authored file: `test -s prisma/migrations/6_drop_generation_a/migration.sql`, or the same datamodel-to-datamodel diff with `--exit-code` and **no** `--script`, expecting **2** (§6.4). Both need no database. Do **not** re-add `migrate diff --from-migrations` — it requires a shadow DB, could not run at `e5aaf1e`, and was deleted by ruling (§6.5) |

### 5.3 The one build-breaking edit, prettier-canonical

`src/components/portal/status-badge.tsx` (currently 32 lines) → replace entirely. This exact text is `tsc`-, `eslint`- and `prettier`-green and keeps 182/182 tests passing (`VER-A` §5.1, re-verified by `AUDIT`: longest line 75 ≤ 80, `prettier --check` exit 0; note `INV-A`'s snippet was semantically right but 81 chars on one line, which exceeds `printWidth` 80 and therefore fails `npm run check`):

```tsx
import styles from "./portal.module.css";

export function StatusBadge({ status }: { status: "Ativa" | "Inativa" }) {
  const tone =
    status === "Ativa" ? styles.statusPositive : styles.statusNeutral;

  return <span className={`${styles.statusBadge} ${tone}`}>{status}</span>;
}
```

Zero JSX churn, verified: all **10** surviving call sites pass `recordStatusLabel(...)` (`adult-portal-helpers.ts:15`, typed `(status: RecordStatus): "Ativa" | "Inativa"`) — `class-detail-screen.tsx:67,143` · `classes-screen.tsx:147` · `organization-detail-screen.tsx:134,181,225` · `organizations-screen.tsx:157` · `overview-screen.tsx:174,220` · `team-screen.tsx:341`. No call site passes a raw string. `styles.statusBadge:1038`, `statusPositive:1058`, `statusNeutral:1073` all exist, so the badge still renders. [V]

**Consequences to log for Phase 3:** `.statusWarning` and `.statusDanger` lose their only consumers. `.toast` does **not** — `INV-A` was refuted here; it stays live through `demo-action-button.tsx:33`, which §2 does not delete. [V]

### 5.4 The security edit, exact

`src/proxy.ts`: cut **one line** (`:113`) and reword the comment. `:114-115` must survive.

```ts
// Player entry links carry the bearer credential in ?cred= and the game
// iframe is embedded from it, so /jogar is served with 'no-referrer' to keep
// the credential out of Referer. Other routes keep a stricter default.
const referrerPolicy =
  request.nextUrl.pathname === "/jogar" ||
  request.nextUrl.pathname.startsWith("/jogar/")
    ? "no-referrer"
    : "strict-origin-when-cross-origin";
```

Why load-bearing: `player-credential-print-sheet.tsx:22-24` builds `${basePath}/jogar/` and sets `searchParams.set("cred", token)`, and that document mounts the cross-origin GameMaker iframe (`frame-src` at `proxy.ts:68`). Without `no-referrer` on `/jogar`, **the bearer credential leaves in `Referer`**. This is the single accidental regression in §2 — `tests/unit/proxy.test.ts` has 2 tests, both hitting `/entrar`, asserting CSP/correlation/`nosniff` only, so **no automated check catches a bad edit here**. Eyeball the diff. `config.matcher` (`:137`) needs no change. [V]

### 5.5 Non-breaking but required hygiene (E4-E7 + two misses)

| Edit | `file:line` | Why | Order |
| :--- | :--- | :--- | :--- |
| Trim `"RATE_LIMITED"` **and its contract entry** | `src/server/http/errors.ts:11` **and** `contracts/schemas/api-error.v1.schema.json:21`, in the **same commit** as `model RateLimitBucket` (D-5; the earlier "keep the JSON contract entry" deferral was deleted by `COMPAT-POLICY.md` edit 5, adopted at §6) | sole production user `atividades/actions.ts:181` is deleted. Safe: `apiErrorCodes` is consumed only at `errors.ts:27,37` — there is **no** `Record<ApiErrorCode,…>` map, so shrinking the union cannot break an exhaustive switch. `api-error.v1.schema.json` is the **portal↔browser** HTTP envelope and sits outside the `…/schemas/v1/` glob that `v1-contracts.test.ts:34-38` reads; the **portal↔GameMaker** vocabulary is the separate `contracts/schemas/v1/protocol-error.v1.schema.json`, which this edit leaves alone. Counting context kept from the retired Q-3: **13 of the 19** codes in `errors.ts:6-24` have **no emitter** post-purge (`VER-C`) and **8** of those are Generation-A vocabulary at `:14-21` (`INV-A`) — both true, different sets — so this trims one code with its model and does not pretend to clean the file | after §2.3 |
| Delete `isDemoRuntime` | `src/runtime/mode.ts:13-17` | 11 occurrences today, 10 inside the delete set → 0 users **after** the purge. Deleting **before** breaks the build (proven) | **after** §2.2/§2.3 |
| Drop `export` keyword only | `src/server/auth/dev-bypass-gateway.ts:9` (`DEV_BYPASS_ACTOR`) | its only external consumer was `portal-view-service.ts:1`. **Do not delete the file** — `gateway.ts:1` imports `DevBypassAuthGateway`, used at `:42` | after §2.3 |
| Re-point stale fixtures | `tests/unit/auth.test.ts:146,147,154` | **not** a break: `isProtectedPathname` (`gateway.ts:48-54`) is a generic `/portal` prefix predicate so all three still pass. Edit-only; keep the `describe` blocks | any time |
| **Miss:** delete the dead nav special case | `src/components/portal/adult-portal-helpers.ts:136-138` (`if (item.label === "Links de acesso") …`) | the last executable trace of the `/portal/atividades` nav item; zero nav items carry that label and zero tests exercise it. Found only by `VER-A` | with §2.1 |
| **Miss:** redaction keys | `src/server/observability/logger.ts:11-12` (`activityToken`, `attemptToken`) | dead config. Flag the flip side (§11 R-07): `cred` is **not** redacted, and post-purge `/jogar?cred=` is the only token-in-URL flow left | P1 optional trim (R-07 tracks the `cred` gap as its own item) |
| Optional additions to §2.3 (0 consumers, pre-existing dead) | `src/components/portal/demo-action-button.tsx` (39 lines, 0 importers — deleting it also frees `.toast`); `src/server/http/base-url.ts` (45 lines, `getPublicBaseUrl` has 0 callers); `getGameClientUrl` (`game-client.ts:38`) | counts reproduced by `VER-A` M1-M5 | decide per D-3/D-6 style |
| Do **not** touch | `src/contracts/v1/schemas.ts:159,161,164,241,246` (`id_atividade`, `versao_atividade`, …); `qrcode` + `@types/qrcode` in `package.json`; `src/app/loading.tsx:15`, `results-screen.tsx:195,221`, `player-entry-screen.tsx:42`, `app/layout.tsx:12` | V1 **wire-protocol** field names unrelated to Generation A; `player-credential-print-sheet.tsx:4` still imports `qrcode`; the rest is Portuguese prose | — |

### 5.6 Route reachability after the purge

`/portal/admin` already 404s (that directory has **no `page.tsx`**). The four bare `redirect("/portal")` stub files (`portal/modulos/page.tsx`, `portal/modulos/[id]/page.tsx`, `portal/admin/jogos/page.tsx`, `portal/admin/modulos/page.tsx` — the governing audit counts these as **3** stub *routes*, `architecture-audit-2026-09-23.md:153`) and the auditoria page are unreferenced today, so their removal is invisible. Both nav tables (`application/adult-portal/service.ts:140-195`, `portal-navigation.tsx:60-125`) already contain **zero** Generation-A entries. `(public-play)` does not become empty: `jogar/{page,layout,actions}` survive and `public-shell.tsx` stays reachable via `jogar/layout.tsx:4`. `/entrar/recuperar` is **unlinked**, not unreachable — it is a real prerendered page reachable by URL and a `"use server"` module, which matters in Phase 2. [V]

### 5.7 Safe execution order (only two hard constraints)

`VER-A` showed the plan's serialisation is over-constrained: the only hard rules are **E1 before deleting `portal-view-service.ts`**, and **§2.5's `:97` alongside `model CapabilityAssignment`**. A single purge commit is provably safe once E1 lands.

1. Branch off `main` (never let an intermediate red state reach a protected `main`). `COMPAT-POLICY.md` §2 classifies this as **A** but **keeps** it: the cost is one `git checkout -b`, and `deploy.yml:3-5` republishes `./out` on every push to `main`, so a red `main` is a live broken demo.
2. E1 `status-badge.tsx` (§5.3) → `typecheck` green, `grep -rn "portal-view-service" src/components` returns nothing.
3. Schema drops + `prisma validate` + migration + `prisma generate` (§6).
4. Delete §2.4 tests → `vitest run` = 27 files / 182 tests.
5. Delete §2.3 leaves, then §2.2 trees → `typecheck` + `vitest` green. On a workstation, `rm -rf .next/types .next/dev .next-demo-dev` first — item 0.3's remedy is **deletion**, and no build order clears the two `dev/types` copies. On CI there is nothing to clear.
6. E4-E7 trims + `helpers.ts:136-138` → `check` green.
7. `proxy.ts:113` (§5.4) — manual eyeball, no test covers it.
8. `npm run build:server` then `npm run build:demo`; assert `out/atividade`, `out/portal/atividades`, `out/portal/materiais`, `out/portal/admin/auditoria` are **gone**, and `out/jogar`, `out/entrar`, `out/portal`, `out/portal/turmas/{3 seeds}` survive; assert **26** HTML docs; assert the demo manifest has 0 server-action ids **immediately after the demo build**. These `out/` assertions **verify** the `/atividade/[token]` deletion; they do not prevent it (D-4).
9. **Edit `ci.yml`'s document-count assertion from `104` to `26` — in this same commit**, with the deletions. This purge PR is the commit where the number changes; `ci.yml` itself is authored by §4 item 0.4, but the count edit cannot live there (it would assert 26 against a tree still exporting 104) and cannot wait for Phase 4, because Phase 00's branch protection makes `gates` a required check and a purge PR still asserting `104` cannot satisfy it. Canonical wording: `phases/50-gates-ci-demo-docs.md` step 2 / *Handoff notes*.
10. Documentation pass (§9.4) — including the one-line deletion of `walkthrough.md:11`, the only surviving duty of D-4.

**Gate for Phase 1:** steps 2-9 all green; `git diff --stat` ≈ 7,802 deletions across 46 files plus the ~8 small edits above, the `ci.yml` `104 → 26` edit, and nothing else.

---

## 6. Phase 1b — Prisma schema purge and migration `6_drop_generation_a`

### 6.1 The blocker, reproduced five times

Applying plan §2.5 **verbatim** fails `prisma validate`:

```
Error code: P1012
error: Type "CapabilityAssignment" is neither a built-in type, nor refers to another model, composite type, or enum.
  -->  schema.prisma:84        ← the :97 line, renumbered by the deletions above it
```

The unlisted fourth relation is `OrganizationMembership.capabilityAssignments CapabilityAssignment[]` at `prisma/schema.prisma:97`. Independent reproductions: `INV-A`, `INV-C`, `VER-A`, `VER-C`, and the main agent. Day 1's own gate goes red without this fix. [V]

**There is no fifth piece of residue.** `VER-C` and `VER-A` ran token sweeps on the validated result returning **0** hits, and the sweep re-run for this ruling adds `AuditEvent` to the pattern — `grep -rn "Capability\.\|CapabilityAssignment\|AccessLink\|RateLimitBucket\|AuditEvent" src tests scripts --include=*.ts --include=*.tsx | grep -v src/generated` → no output (`phases/20-schema-and-migration.md` step 6); every `@@index`/`@unique` on a surviving model references surviving fields. This document's earlier closure argument — that `@relation("AuditActor")` (`:66`, `:292`) was "the only remaining named relation, whose model survives" — is **retired**, not inverted: edit 7/§6 deletes `AuditEvent`, so **no named relation survives the purge at all**, which closes the question more strongly than the argument did. Line-count correction follows from the same edit: the main agent's derivation "310 → 251 lines validates clean" was measured with `AuditEvent` kept; with it dropped the same recipe validates clean at **227** lines, `grep -cE "^model "` → **12** (from 16) and `^enum ` → **5** (from 6). [V]

### 6.2 Ordered schema edits (line numbers are current HEAD)

| # | Target | `prisma/schema.prisma` | In plan? |
| :--- | :--- | :--- | :--- |
| 1 | `enum Capability` | `:18-27` | ✓ |
| 2 | `ProfessionalProfile.createdAccessLinks` | `:65` | ✓ |
| 3 | `Organization.scopedCapabilities` | `:79` | ✓ |
| 4 | `Organization.accessLinks` | `:80` | ✓ |
| 5 | **`OrganizationMembership.capabilityAssignments`** | **`:97`** | **✗ — add** |
| 6 | `model CapabilityAssignment` | `:245-260` | ✓ |
| 7 | `model AccessLink` | `:261-279` | ✓ |
| 8 | `model RateLimitBucket` | `:300-310` | ✓ |
| 9 | `model AuditEvent` + `ProfessionalProfile.auditEvents` | `:281-299`, `:66` | **delete** — plan §2.5.5 says keep; `COMPAT-POLICY.md` edit 7 as adopted at §6 overrides it (D-6). **No explanatory comment is required**, because `portal-view-service.ts:416` shows the table was never read in either mode. This is the row that adds two statements to §6.4's block |

`Capability` has **no surviving TypeScript consumer**: zero hits for any of its six mapped values (`link:view`, `link:manage`, `results:view_organization`, `organization:manage`, `user:manage`, `audit:view`) across `src`, `tests`, `contracts`, `scripts`. `src/server/authorization/v1-policy.ts` is purely role-based (`OrganizationRole`/`PlatformRole`) and imports no `Capability`. The only generated-prisma symbols any survivor imports are `RecordStatus`, `OrganizationRole`, `PlatformRole`, `PlayerCredentialStatus`, `GameSessionStatus`, `Prisma`, `PrismaClient`. **Therefore audit risk R5 ("locked-out admins") is void**, and so is `INV-F`'s concern about the four non-link values: no database has ever existed, so zero grants are revoked. [V] (`VER-C` §answer, `VER-A` D4)

`RateLimitBucket` deserves a stronger statement than the plan's, but a precise one: **no first-party code in the repository's entire history ever touched it** — `git log --all -S prisma.rateLimitBucket -- src` is empty, and no surviving or deleted file queries the model. The table and its type do exist in `prisma/schema.prisma:300-310` and appear five times in `prisma/migrations/0_init/migration.sql`, so "no references in history" is false as literally worded; the correct claim is *declared, never used*. [V]

### 6.3 Migration strategy — the history stays sequential (owner ruling)

Six migrations exist and all are tracked; **none has ever been applied** (`.env` holds `ep-example` placeholders, and `docs/implementation/slice-03-05-portal-handoff.md:36` states no migration has reached a database), so there is no `_prisma_migrations` table to conflict with. The only honest characterization is *unproven history* — audit risk **R1**, which nothing in this refactor closes: its verification leg was deleted as non-functional (§6.5), and the duty now sits on the acceptance list at `slice-03-05-portal-handoff.md:35` item 1 ("Supply an actual staging Neon connection"). R1 is a **server-target** fact, not a compat problem, and it stays true after Day 4.

`COMPAT-POLICY.md` §4 edit 1 proposed collapsing the six directories into one regenerated `0_init` plus a hand-written `1_datamodel_extras`. The owner **rejected** it (§6) and **reaffirmed** this section's recommendation: **keep `0_init` … `5_v1_game_events` in place and hand-author `prisma/migrations/6_drop_generation_a/migration.sql`** (`phases/20-schema-and-migration.md` Option A). Nothing under `prisma/migrations/` is deleted, renamed or reordered; the directory count goes 6 → 7. Do not use `migrate dev` (§6.5's caveat). [V]

**The rationale this document published is struck, and the honest one is narrower.** "Do not collapse history — it *loses the audit trail of what shipped when*" is false here, for a measured reason: `prisma/migrations/1_add_paused_at/migration.sql` is **3 lines** that `ALTER TABLE "access_links" ADD COLUMN "paused_at"`, and `access_links` is one of the four tables the same purge `DROP`s (§6.4) — a self-cancelling step, not a trail. The real reasons the history stays are cost-side:

- **`2_v1_adult_roles_and_classes:13-27,32-41`** holds two `UPDATE … FROM "capability_assignments"` row-transforms that backfilled the new tables from the old shape. A regenerated-from-empty init **cannot contain them**, so collapsing does not "simplify" the history — it rewrites its content. Lexicographic order is apply order, which is also why these statements still read `capability_assignments` while it existed.
- `schema.prisma` expresses **none** of the objects the history carries: `grep -rn dbgenerated prisma` → **0** hits, against **8 surviving `CHECK` constraints**, **2 partial unique indexes** and **6 `gen_random_uuid()` defaults** that a generated init would emit as **0 / 0 / 0** and that no test in the suite can notice (`phases/20-schema-and-migration.md` §"Option B", objections 2-4). Worse, `@default(uuid())` is client-side in Prisma 7, so a regenerated init emits `"id" UUID NOT NULL` with **no default at all** on 11 columns, breaking every raw-SQL insert, seed and repair query while the Prisma Client path keeps working.
- The saving was smaller than `COMPAT-POLICY.md` §2 row 1 advertised: the regenerated init was actually run in a scratch directory and measured **269 lines**, so the collapse bought ~410 → ~290 SQL lines, not ~190 — ~120 lines against 16 hand-appended invariants and no automated control.

Once the collapse is off the table, keeping the history is simply the cheaper option: the sequential scheme writes **one** new file, while the collapsed scheme writes and then has to defend two.

### 6.4 The exact command, and the contradiction that had to be settled

`VER-A` and `VER-C` produced **contradictory** results for the same tool call, so the main agent reproduced it. `VER-A`'s observation that `--from-schema/--to-schema --script` returned an empty script **does not reproduce**; the command works and emits exactly the SQL `INV-C`/`VER-C` reported. `VER-A`'s valid sub-point is narrower: the older `--*-schema-datamodel` flag names are gone in Prisma 7.9.1. [V] (`ADJ-01`)

Flags in 7.9.1 (`npx prisma migrate diff --help`): `--from-empty`, `--to-empty`, `--from-schema <path>`, `--to-schema <path>`, `--from-migrations <dir>`, `--to-migrations <dir>`, `--from-config-datasource`, `--to-config-datasource`, `--script`, `--exit-code` (**Empty: 0, Error: 1, Not empty: 2**). There is no `--*-schema-datamodel`.

```bash
# datamodel-to-datamodel diff, no database, no shadow DB required:
npx prisma migrate diff --from-schema "$TMP/from.prisma" --to-schema "$TMP/to.prisma" --script
```

The output below **replaces** the block this document published at `e5aaf1e`, which was **8 statements / 23 content lines** and is now stale in a way that is easy to miss: it was generated against a schema that **kept** `model AuditEvent` (plan §2.5.5), and edit 7 deletes that model. The correct file is **10 statements / 29 content lines** — the old eight plus `audit_events`' own foreign key and its `DROP TABLE`.

**Why 10 and not 9.** `6_drop_generation_a/migration.sql` is *generator output*, not a hand-reasoned script, and the question is what the tool **emits**, not what PostgreSQL **needs**. Prisma's differ normalises each owned foreign key out ahead of the table that owns it — which is exactly why the four `DROP CONSTRAINT` statements were already in an eight-statement list whose tables it also drops (`:276` below says so in as many words). `audit_events_actor_id_fkey` is owned by a table this block drops, so a fifth belongs under precisely that rule. An earlier revision of the audit argued from engine semantics ("PostgreSQL drops a table's constraints with it") and published **9**; that inference was unsound for a generated artifact and is corrected here. [V]

Main agent's verified output, reproduced byte-identically by `AUDIT` and re-emitted with `AuditEvent` dropped by `phases/20-schema-and-migration.md` step 8 — **10 statements, 29 content lines** (`wc -l` reports 30 because of the trailing newline; the superseded "24" for the old block was the same file one statement shorter):

```sql
-- DropForeignKey
ALTER TABLE "capability_assignments" DROP CONSTRAINT "capability_assignments_membership_id_fkey";

-- DropForeignKey
ALTER TABLE "capability_assignments" DROP CONSTRAINT "capability_assignments_scope_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "access_links" DROP CONSTRAINT "access_links_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "access_links" DROP CONSTRAINT "access_links_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_actor_id_fkey";

-- DropTable
DROP TABLE "capability_assignments";

-- DropTable
DROP TABLE "access_links";

-- DropTable
DROP TABLE "rate_limit_buckets";

-- DropTable
DROP TABLE "audit_events";

-- DropEnum
DROP TYPE "capability";
```

**Verify by counting, not by reading:** `grep -c '^DROP\|^ALTER TABLE'` → **10**, `grep -c 'DROP TABLE'` → **4**, `grep -c 'DROP CONSTRAINT'` → **5**, `grep -c 'DROP TYPE'` → **1**. The four table names and five constraint names must match `0_init` character for character: `audit_events` is created at `0_init:74`, its primary key at `:86`, its three `@@index`es at `:126,129,132` and the foreign key at `:156`; it carries **no** `CHECK`, and it appears nowhere in the history outside `0_init` (`grep -rn 'REFERENCES "audit_events"' prisma/migrations/*/migration.sql` → no match), which is why dropping it cannot weaken a surviving invariant. [V] (`RV-20-schema-refutation.md` §1)

All **five** dropped FK constraints are **owned by the dropped tables**, confirming there is no FK-ordering hazard: no surviving table's foreign key points at anything being dropped. That finding survives the extra table untouched. [V]

**Gate defect to fix in §9:** `prisma validate` passing says nothing about whether the migration was written, and an empty diff still exits 0 by default. Assert non-emptiness explicitly (`--exit-code` with **no** `--script`, expecting **2** — `1` is an error, never a pass; or `test -s migration.sql`). Note that this is the **only** schema-deliverable check the refactor has: it proves the file is non-empty, not that the history reproduces the schema (§6.5).

### 6.5 There is **no schema-drift gate** — this step was deleted, not replaced

Everything this section used to mandate is **struck by ruling**: `COMPAT-POLICY.md` §4 edits 2-3, adopted at §6. What was deleted:

- the drift gate `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --exit-code`;
- the shadow-DB prerequisite and the two `prisma.config.ts` datasource keys that made it a "prerequisite, not a one-liner" (`datasource.url` from `DIRECT_URL`, `shadowDatabaseUrl` from `SHADOW_DATABASE_URL`) — `prisma.config.ts` is **12 lines** today and defines `schema`, `migrations.path` and a conditional `datasource.url`, and gets **no new keys**;
- the Postgres `services:` container and `SHADOW_DATABASE_URL` env key that Phase 4's `ci.yml` would have needed;
- the throwaway-`DIRECT_URL` `migrate deploy` runbook that closed R1.

**The consequence, stated plainly rather than softened: the refactor ships with no schema-drift gate at all.** `prisma validate` is the **only** schema check in the pipeline, and it proves referential integrity and syntax — never whether the migration history reproduces `schema.prisma`. Reintroducing a real gate needs a **staging database**, which is R1's own open item on the acceptance list (`slice-03-05-portal-handoff.md:35` item 1), not a CI edit. This must not be recorded as "the gate got cheaper": `COMPAT-POLICY.md` §4 edit 2 originally offered a DB-free byte-compare substitute, and that substitute **presupposed the collapsed history of rejected edit 1**. Proving a *sequential* history reproduces the schema requires replaying it, and replaying requires a shadow database — `migrate diff --from-migrations` has no `--script`-only path around it. So the honest consequence of the ruling is the absence of a check, and every phase file now has to say so. [V]

**The deleted gate was already non-functional — that is why nothing working was lost.** `phases/00-prerequisites.md` §4 item 0.3 ran the exact command at `e5aaf1e`: exit **1**, `You must set 'datasource.shadowDatabaseUrl' in your 'prisma.config.ts' if you want to diff a migrations directory.` Quoted as **evidence of a dead step, not as a task**. Related tooling fact, still true: Prisma 7.9.1 has **no `--shadow-database-url` flag** (`unknown or unexpected option` — `AUDIT` B4), so the URL can only come from configuration. [V]

**What remains class C and is *not* closed by this deletion.** The `DIRECT_URL` exposure is structural, not shell-dependent: `prisma.config.ts:1` is `import "dotenv/config"`, `:4` reads `process.env.DIRECT_URL`, and `:11` sets `datasource.url` **only when it is present** — so *every* Prisma CLI invocation inherits whatever the ambient environment holds, whether or not anyone exported it deliberately. Deleting the runbook removes the instruction to run `migrate deploy`; it does not remove the mechanism by which such a run could reach a real branch. Reading nobody should treat this paragraph as closed: it stays tracked through R1/`ADJ-01`.

**Tooling trap:** never run a bare `npx prisma …` from a scratch directory outside the repo. It resolves to `prisma@8.0.0-rc` from the network, where `migrate` no longer exists as a command (`No command registered for 'migrate', did you mean 'migration'?` — hit during `AUDIT`). Run Prisma from the repo root or via `node_modules/.bin/prisma`.

**`migrate dev` caveat, corrected.** `INV-C` argued `migrate dev` would destroy 11 hand-written CHECK constraints. `VER-C` refuted both halves: the surviving-table count is **8**, and Prisma 7.9.1's schema engine has **no check-constraint step at all** in its diff vocabulary (plus a `StrippedPartialIndexes` flag), so `migrate dev` likely cannot drop CHECKs or the 2 partial unique indexes. What *is* provably destroyed are the **6 `gen_random_uuid()` defaults** on surviving tables — a `dbgenerated` ⇄ `uuid()` round-trip emits `ALTER COLUMN "id" DROP DEFAULT`. The recommendation to hand-author therefore still stands, but on the defaults argument, not the CHECK one. [V]

### 6.6 Seeding and dev data

There is **no seed file** anywhere in the repo, so the model purge requires no seeding change. Consequence worth recording: `AUTH_DEV_BYPASS` is only usable if a `ProfessionalProfile` row exists with the specific UUID the bypass expects (`…0001`), which must be hand-inserted — relevant to any later integration-test work and to the "server target works" claim generally. [V]

---

## 7. Phase 2 — Dual-runtime seam (plan §3.1)

This phase has the largest gap between what the plan asserts and what the code requires. Read §7.1 before §7.2.

### 7.1 What is actually true about E625 here

Three findings, all verified:

1. **The mechanism is reachability, not file presence, and not route-tree membership.** `export/index.js:357-384` throws only if some id in `server-reference-manifest.json` has type `server-action`. There is no `buildExport` guard and no opt-out — the `serverActions` config exposes only `allowedOrigins` and `bodySizeLimit`. Proven against this repo: 24 exported actions, 17 registered. The manifest carries `filename` + `exportedName` per id, so the 7 absent ids are identified per file: all 6 from `portal/atividades/actions.ts` plus `requestPasswordResetAction`. Two `"use server"` files inside the live route tree register **zero** because nothing imports them. [V]
2. **Therefore the Generation A purge buys no E625 safety** — the actions it deletes were already unregistered. (`VER-F`, `INV-B`, main agent's own counts.)
3. **And the demo build already passes today, for a structural reason:** all five id-producing `"use server"` files are reachable **only** through the `@runtime/*` aliases, and **none of the nine demo alias targets is a `"use server"` module**. Of the eight distinct demo target files, four are `"use client"` (`adult-portal-demo-actions`, `adult-portal-demo-client`, `player-access-demo-actions`, `player-entry-demo-actions`) and four carry **no directive at all** (`adult-portal-demo`, `player-access-demo`, `game-events-demo`, `demo-auth-actions`) — which is why the demo graph is already action-free, and is also exactly the un-fenced exposure §7.2(a) creates. So `REFACTOR_PLAN.md:130` ("thereby effortlessly passing E625") describes **preserving an existing property**, not unblocking a build. §7.2's manifest assertion is therefore a **regression guard**; the clause that genuinely discriminates is "9 aliases → 0", plus the 24 `@runtime/` import sites in 23 surviving files. [V] (`VER-F`, `ADV-2`, `AUDIT` B2 directive counts)

**Honest rationale for the seam:** type-safety and testability. `tsconfig.json:24-42` pins every alias to a **server** variant, so `npm run typecheck` has never typechecked the demo wiring; no `typecheck:demo` exists; `vitest.config.mts:5-11` aliases only `@`, so **no test can import the seam at all**. [V]

**Ruled out, with evidence** (`NOTE-00`): `turbopack.ignoreIssue` filters Turbopack *compile* issues, not exporter errors; conditional `resolveAlias` supports only the `browser` condition, which selects by render-side rather than by deployment target and would hand demo build-time readers their Prisma twins while stripping persistence from the hosted app's client components. That leaves a build-time module selector, or two route trees (`docs/implementation/v1-architecture-plan.md:69-71`), which multiplies the tree the plan exists to shrink.

### 7.2 What plan §3.1 requires in order to be implementable at all

Executing §3.1 literally breaks in two places. Both fixes are small and both were established adversarially.

**(a) One seam for actions *and* build-time readers is a hazard, not a design.** `src/runtime/adult-portal-server.ts:1`, `player-access-server.ts:1` and `game-events-server.ts:1` all begin `import "server-only"`, and all three also import `connection` from `next/server` at `:3`. If the single generated entry exposes readers alongside actions, a client component that imports the seam drags them toward the browser graph. `VER-B` correctly downgraded `INV-B`'s "Turbopack rejects this outright": the provable worst case is `next/dist/compiled/server-only`'s bare top-level `throw` landing in a browser chunk — **a green build that crashes at hydration**, which is worse, not better. Note the exposure is *created by §3.1*: **zero of the 15 readers is imported by a Client Component today** (`use-demo-portal.ts:6` imports the client bridge, not a reader). [V]

Required shape: **two** generated entries — `target.ts` (actions + client bridges) and a separate readers module — so client components can only ever import the first.

**(b) §3.1 item 4's rationale is inverted.** Prop-passing a *server reference* across the Server→Client boundary is **legal**; prop-passing a **plain function** is what throws ("Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with `"use server"`"). So the new `sign-in-form.tsx` / `sign-out-button.tsx` client components must **import** the seam themselves; there is nothing to pass. And because `redirect()` cannot be called from a client event handler, the mode branch **survives as a render decision** rather than being removed. Keep `<Link>` for the demo path — a `<form method="get">` fallback would bypass `basePath`. [V]

**(c) The `server-only` fence cannot be placed on the demo reader variant.** The package is **not installed** — `node_modules/server-only` does not exist while `next/dist/compiled/server-only` does — and the specifier resolves **only** through Next's per-layer alias plus `next-env.d.ts:1`'s ambient reference (`AUDIT` citation 7 corrects the *reason*: this is about the resolver, not about the package being missing from a registry). Putting the directive on the *demo* variant — which is what "both variants carry `server-only`" would require — makes demo readers **unresolvable outside Next**, destroying the one concrete benefit of a real on-disk seam module. Reach instead for a **core ESLint `no-restricted-imports` pattern rule** (e.g. `patterns: ['@/runtime/*-server']`), not the audit's `eslint-plugin-import`, which is **not installed** here. Be explicit about what that swap loses: a path rule cannot condition on the importer carrying `"use client"`, so it does not reproduce `server-only`'s guarantee — the residual needs a `react-server`-layer check or a hand-written rule (`AUDIT` B7). [V] (`ADJ-03` F3)

**(d) The seam is not the only composition point, and plan §3.1 never says so.** Four surviving modules — `src/server/services/{adult-portal,player-access,game-state,game-event}-container.ts` (99 lines, none named by the plan, which mentions only `service-container.ts` — the one it deletes) — are where adapters are actually constructed: each `import "server-only"`, builds the Prisma store, and returns `new XxxService(store)`. The three `src/runtime/*-server.ts` variants call them, so `target.server.ts` / `readers.server.ts` must **delegate** to the containers rather than wire adapters themselves; doing otherwise duplicates the composition root a second time. Note also that the containers are reached **directly**, bypassing `@runtime/*`, by `portal/adult-portal-actions.ts`, `portal/player-access-actions.ts`, `(public-play)/jogar/actions.ts` and the `/api/v1/player/*` route handlers (plus `atividades/actions.ts`, which the purge deletes). So "everything crosses the seam" is false by construction at 4 surviving call sites today, and the tests lean on it: `vi.mock("@/server/services/player-access-container")` is how the action tests stay unit-level, which is the same resolver problem §7.2c describes for the seam. [V]

### 7.3 What the typing does and does not buy (adjudicated)

`INV-B` claimed five demo readers are synchronous and therefore "not assignable" to a `Promise<T>` contract member. **False.** They are declared without `async` but have no return annotation and return a service promise, e.g. `adult-portal-demo.ts:15-21`:

```ts
export function getPortalShellData() { return service().getShell(profileId); }
```

TypeScript infers `Promise<…>`; `async function f(): Promise<X>` and `function f(): Promise<X>` are the same type, so **no interface can distinguish them**. The genuinely synchronous readers (`listStaticOrganizationIds:69`, `listStaticClassIds:73`, `game-events-demo.ts:109,113`) are synchronous on the server side too, so no drift axis exists there either. [V] (`ADJ-02`)

Per-axis result, which the plan's blanket "compile-time drift detection" claim should be replaced with:

| Drift axis | Caught by contract annotation? | Caught by call-site typecheck under a per-target config? |
| :--- | :--- | :--- |
| Export removed / renamed | no (if `export *`) | **yes** — 8× `TS2305`/`TS2724` at real call sites with a shim hiding one export [S] — figure from `ADV-2`/`VER-B` prose, not independently reproduced |
| sync ⇄ async | **no** (same type) | no |
| Return nullability / arity / surplus export | partial | partial |
| Wrong **variant** selected | no | no → **`TARGET_MODE` is the load-bearing control** |

Two agents both measured "0 errors across `src/` against the demo variants" and drew opposite conclusions, because "drift detection" meant two different things; `VER-B`'s instrument and `ADV-2`'s instrument are the *same* mechanism viewed differently. [V]

One narrow real difference survives the sync/async analysis and should be recorded rather than dismissed: a non-`async` function that throws before returning its promise rejects **synchronously**, so `f().catch(…)` and `Promise.all([...])` see a different failure shape than `try { await f() }`. Behavioral, not typing.

**Mandatory controls if the generated-entry design is taken (D-1 = a):** a `TARGET_MODE` constant written into each generated file, asserted at module init and again at prerender (`INV-B`'s point that a stale **demo** pointer during `build:server` is caught by *nothing* is the single most dangerous silent case); explicit named export lists annotated against `contracts.ts`; `.gitignore` **and** `.prettierignore` entries (`INV-B`'s three CI landmines: `--max-warnings=0`, `prettier --check .` policing generated formatting, and the missing ignore line); and regeneration wired into `predev`/`prebuild`. Mitigating fact: `tsc --incremental` versions files by content SHA-256, so byte-identical regeneration costs nothing. [V]

### 7.4 The Day-2 spike that must precede alias removal [U→mostly resolved]

Whether a server reference survives the barrel re-export hop has **never been exercised in this repo** — no file in `src/runtime` contains `export *` or `export {` (main agent verified; client components reach action modules directly through the alias today). `ADV-2` narrowed it substantially from compiled output: Next's own dispatch **is** a named re-export (`…_page_actions_*.js` containing `a.s(["<42-hex id>", () => b.signOutAction], …)`), so the hop is normal rather than exotic. The residual unknown is one untested combination: **`signInAction`'s function-level `"use server"` plus a Client Component importer** — `signInAction` appears in **0** client chunks today.

Spike (≤20 min, before touching any alias): create `src/runtime/__spike.ts` with `export { signInAction } from "@/app/(professional)/entrar/actions";`, import it into a throwaway client component, run `npm run build:server` (the four `next.config.ts:12-19` env vars must be syntactically valid), and observe whether an id for `signInAction` is still registered in `.next/server/server-reference-manifest.json` with the correct `filename`/`exportedName` and whether the client chunk emits a reference rather than an inlined body. Then **delete the spike and re-run `npm run build:server`** before any later typecheck — the spike writes into the shared `.next` and would otherwise leave demo-era route validators behind (§4 item 0.3).

### 7.5 The cheaper mechanism, if D-1 = (b)

Four changes, no new source files beyond configs, and it is the design the governing audit already approved (`architecture-audit-2026-09-23.md:626-628`):

1. `tsconfig.demo.json` — copy of `tsconfig.json` with the 9 `paths` pointing at the **demo** variants.
2. `npm run typecheck:demo` → `tsc -p tsconfig.demo.json --noEmit`; run both in CI.
3. A `resolve.alias` block in `vitest.config.mts` for the 9 `@runtime/*` specifiers → tests can exercise the seam for the first time.
4. `contracts.ts` with the reader/action interfaces, and each variant declared `… satisfies PortalReaders` / `PortalActions`, so a missing or misnamed export fails at the **call site**, which is the axis that is actually detectable.

Measured cost: ~5-6 hours and **4 new/edited files**, 0 new failure modes — against ~2-3 days and **~14 new or rewritten files** with 6 new failure modes for the generated-entry design (`ADV-2`; an earlier draft of this row said "~10 files", understating its own source), delivering the same drift detection on the only detectable axis. It also leaves `next.config.ts`'s aliases in place, so plan §7.2's "zero `@runtime/*` aliases" criterion is not met — a deliberate, recorded deviation if D-1 = (b). [S] (`ADV-2` attack 1)

### 7.6 What the seam does **not** do — expectations to correct

- **It isolates nothing from production infrastructure.** `ADV-2` measured the shipped demo bundle (`out/_next/static`): 0 action ids, no Prisma/pino/Neon strings. Reachability in the module graph (11 `server-only` modules, which `VER-B` found) is not inclusion in the browser chunk. "Keep server code out of the demo" is therefore **not** a valid benefit to claim. [V]
- **It does not reduce mode branching.** Projection is 95 → 95 **+2** new assertions. **Counting rule for that 95:** lines mentioning `runtimeMode` across 23 files — not branch sites. A raw `grep -ro runtimeMode src` yields **107** *occurrences*, and only **34** of the 95 lines hold an actual comparison, so do not compare the three figures or call all 95 branches. Roughly **30** of the 95 sites are genuine defects — a component branching on deployment target where a prop belongs — and can be fixed independently of the seam, in about an hour, without it. That is the better first target if the goal is fewer `runtimeMode` checks. [S] (`ADV-2`)
- **Deep-linking and the demo's storage model are unaffected** — see §8.4 and D-2.

### 7.7 Interfaces that must stay stable across this phase

| Interface | Files | Contract |
| :--- | :--- | :--- |
| 12-15 build-time data readers | `src/runtime/*-{server,demo}.ts` | called by async Server Components and `generateStaticParams`; must remain **Node-safe at build time**; `DemoAdultPortalStore` reads `typeof window === "undefined"` → seed clone (`adult-portal-demo-store.ts:347`) |
| ~20 mutation handlers | `portal/adult-portal-actions.ts`, `portal/player-access-actions.ts`, `jogar/actions.ts`, `entrar/actions.ts`, `portal/sign-out-action.ts` + their demo twins | currently `"use server"`; **`revalidatePath` and `redirect()` semantics must not silently change** when a client component awaits a plain function instead of submitting a form action |
| 3 client-bridge helpers | `adult-portal-{server,demo}-client.ts` | `loadClientPortalState`, `changeDemoProfile`, `resetDemoPortal`; browser-only |
| `PortalMutation` | `src/components/portal/adult-portal-form.tsx:11-14` | **already** the prop type of every mutation form — the typed contract §3.1 step 1 wants is ~90% written for the form actions |
| `src/proxy.ts`, `/api/v1/player/{bootstrap,state,results,active-time}` | — | **inert by construction under `output: 'export'`**; the exporter drops route handlers and app-level middleware silently and does not even print the warning during `buildExport`. Do not add an assertion that "no `api/` appears in `out/`" — it can never fail (`REFACTOR_PLAN.md:236`) |

---

## 8. Phase 3 — Decomposition (plan §4, §5)

This is the phase where the dossier most deliberately **narrows** the plan. Every reduction below is evidence-backed; the justifications are in §8.5 and §13.

### 8.1 `src/runtime/game-offline-sync.ts` (1,222 lines) → do it, differently sized

`INV-D` mapped the file into 15 regions summing exactly to 1,222 and `VER-D` reproduced the structure. Ground facts an implementer needs: IndexedDB only — database `missoes-caramelito-game-v1`, **version 3**, **5 stores**, opened at `:564-627`, **additive-only** upgrade, **no localStorage/in-memory fallback**, **zero module-level mutable state**. Public surface: **16 exports, 11 consumed, exactly 2 importers**. `request-registry.ts` is **misnamed** — the real registry is the `eventRequests` IndexedDB store, which necessarily stays with the storage layer. [V]

**The plan's own sizing fails its own budget.** §4.2's `idb-store.ts` at ~650 lines breaches §7.1's 500-line module ceiling; the four plan files also leave ~162 lines of shared types unallocated (650+60+350 = 1,060 of 1,222). A 7-file cut caps the largest file at **373**. [V]

**The blocking precondition:** **665 lines — 54% of the file, the entire storage layer — have zero test coverage**, and the half the plan wants carved into `idb-store.ts` is precisely that half. `fake-indexeddb` is not a dependency (absent from `package.json`, the lockfile and `node_modules`); `tests/unit/game-offline-sync.test.ts` never touches IndexedDB, it implements the `GameOfflinePersistence` **DI port** in memory (`:35-279`). So the split is a coin flip on two silent-data-loss paths unless characterization tests land first. [V]

| Risk | Verified mechanism | Test needed before splitting |
| :--- | :--- | :--- |
| **S1** orphaned queue on store rename | `VER-D` **corrected** `INV-D` here: with no version bump, `onupgradeneeded` never fires and `transaction()` throws `NotFoundError` **loudly**. Silent orphaning needs rename **+** version bump. `oldVersion` appears nowhere in the file | **T1-T6 only.** The "migration test at v2→v3 with pre-existing queued events" case is **dropped** (`COMPAT-POLICY.md` edit 8, adopted at §6): the population it protects is empty — the engine is dead in demo mode (caller-side gate, below) and the server target has never run, so no device anywhere holds `missoes-caramelito-game-v1` data. T1-T6 stay, because they characterize the **split**, not a legacy user |
| **S2** phantom "saved" | eager-resolve path is real | assert resolve ordering against `oncomplete`, not against the request |

**Two assertions in `INV-D`'s own proposed tests are wrong and would be born failing on the unsplit file** — `VER-D` checked them against the code: `succeed` overwrites **unconditionally** (last-wins, `:1200-1203`), and a `fail` arriving after `succeed` but before `oncomplete` **aborts and rejects** (`:1186-1198`). Write the characterization tests against observed behavior, not intent. Prefer installing **`fake-indexeddb`** as a devDependency for these over extending the hand-rolled fake. [V]

**Bonus finding worth its own ticket:** the entire 1,222-line engine is **dead in demo mode**, yet it ships to GitHub Pages — proven by the DB name appearing in `out/_next/static/chunks/0pvtinj9q2oay.js` (46,032 B) and by `out/jogar/index.html` referencing it. The gate is **caller-side, not engine-side**: every call site is gated in `src/components/public/game-host.tsx` at `:156`, `:260`, `:500`, `:715`, `:731` (also `:760`, `:804`), while `game-offline-sync.ts` itself contains **zero** `runtimeMode`/`isDemoRuntime`/`APP_RUNTIME_MODE` references. That is precisely why it deserves a ticket: today the dead-code property is an accident of one consumer, and any second importer ships the engine again. (`AUDIT` B5 relocated this from the wrong file.) [V]

**Correction to the size ratchet claims:** `tests/unit/game-offline-sync.test.ts` at 728 lines **passes** §7.1's test budget (400 warn / **800** fail). Reviews asserting it violates §7.1 are wrong; at most it is a WARN. Drop that work item. [V]

Sequence: (1) add `fake-indexeddb`, (2) characterization tests T1-T6 against current behavior, (3) mechanical move into 7 files, **defaulting to** the 11 consumed export names, (4) repoint `game-offline-sync.test.ts`, (5) **delete** `src/runtime/game-offline-sync.ts` once both importers are repointed — **no re-export barrel is kept**. (The barrel question is *not* a §7.4 concern here: the engine exports no server actions and is not alias-reached, so the unproven re-export hop does not apply.) On step 3, "must stay byte-identical" was downgraded from a constraint to a default by `COMPAT-POLICY.md` edit 8 (§6): with 2 importers, a rename is a two-line diff the compiler verifies, not a wire contract. §12 row 6 and §7.3's own `TS2305`/`TS2724` row carry the same correction.

### 8.2 `src/components/public/game-host.tsx` (932 lines) — refuse the hooks split

Both `INV-D` and `VER-D` independently conclude the plan's §4.3 hook decomposition should **not** be attempted, and `VER-D` searched three different cut boundaries for a clean one and found none. The decisive measurement is shared mutable state: the file holds **13 refs + 6 states**, and a bridge/sync split leaves roughly **11-13 of 19** slots on both sides (`VER-D` corrected `INV-D`'s "15 of 19" using `INV-D`'s own table). `synchronizeQueue` would need ~19 external bindings (method-dependent; `INV-D`'s "4 setters" is really 3), `deliverConflict` is by definition on both sides, and the render-time ref writes at `:753-757` **already are** the workaround for exactly this coupling — two hooks would mean duplicating the file's most fragile pattern. With `react-hooks/{refs,purity,set-state-in-render}` at **severity 2** and `eslint --max-warnings=0`, that is a lint-red refactor, not a cosmetic one. There is **no DOM test environment installed**, so post-split coverage stays 0%. Honest achievable floor is **~670 lines**, not the plan's 250. [V]

**Do instead:** extract pure helpers, a presentational `GameHostChrome` child, and a **testable** `game-sync-presenter.ts` (pure function of queue state → banner/status view-model, unit-testable in `node`). Roughly half a day, 932 → ~670, no hook-order risk. Open a ticket for the hooks split with "DOM test environment exists" as an explicit precondition.

**§4.3 item 3 is already done — delete the work item.** `src/components/public/demo-game-adapter.tsx` contains **zero** `postMessage` / `addEventListener` / origin-check occurrences; the only two `postMessage` calls in the tree are `game-host.tsx:163,778`; `createBridgeRequestId` was already extracted to `game-bridge.ts:77` and is imported by both sides. (Attribution correction: this finding is in `RV-E`/the old `CRITIQUE`, not `VV-C`.) [V]

Two real defects to replace it with:
- **Protocol version drift.** `demo-game-adapter.tsx:16-20` is the only message not built through the schema helper and hardcodes version `1`; `game-host.tsx:652` **also** hardcodes it (`VER-D`'s addition beyond `INV-D`). Under protocol 2 the demo silently tests a stale handshake — loud rather than silent, but wrong. Fix by importing `PROTOCOL_VERSION` from `src/contracts/v1/schemas.ts`. [V]
- **Undocumented coupling:** the deliberate two-level idempotency (`savedReplies` ⇄ `eventRequests`) and the duplicated constant `100` (`game-host.tsx:333` ↔ `game-offline-sync.ts:403`) with no cross-reference between them. [S]

### 8.3 CSS (`portal.module.css`, 4,910 lines) — purge the dead, do not split yet

Numbers, with the definitional disputes resolved. Two independent methods agree digit-for-digit: `INV-E`'s usage scan and `VER-E`'s hand-written brace-walking parser (no PostCSS). [V]

| Quantity | Publishable value | Note |
| :--- | :--- | :--- |
| File size | 4,910 lines | plan correct |
| Distinct classes | **319** | plan's 308 matches no counting method |
| Live / purge-dead / never-referenced | **170 / 91 / 58** (= 319, closes) | |
| Block-deletable dead lines | **1,823**, rising to **1,862** once the 7 no-driver rules are reclassified | plan's **1,567** is unreachable: 13 candidate methods span 1,078-1,984 and none produces it |
| Mixed rules needing selector surgery | **26** found; **19** actually need surgery (7 have no live driver) | e.g. `:1406` `.panel, .sidePanel, .reportPanel, .detailPanel` where `.detailPanel` survives |
| Live classes with ≥2 surviving consumers | **27** | the real `primitives.module.css` candidate set |
| Rules coupling a primitives class to a non-primitives class | **47** (18 inside `@media`) | supersedes `INV-E`'s "118 rules span ≥2 modules", of which `VER-E` showed 94 are ordinary shared-class rules and only **24** are actionable. Three agents, three definitions — publish this row's definition |
| Design tokens in `globals.css` `:root` | **68** | plan correct; **3** go orphaned by the purge (`--purple-dark`, `--purple-light`, `--radius-micro`) |
| Dynamic `styles[…]` access | **exactly 2**, both in Generation-A files (`activity-mark.tsx:22`, `materials-explorer.tsx:92`) resolving `tone*` classes invisible to a grep-based purge | sweep found no third site — and both die with §2, so **CSS work must strictly follow the purge** |

**Why the split is deferred (D-3).** `ADV-3` identified the mechanism that makes extraction the only *silent blank-page* generator in the sprint: CSS-module class names are hashed **per file**, and the `@media print` block at `:4355-4391` pairs a classless `:global(body) > * { visibility: hidden }` with `.printSheet` / `.credentialPrintCard` whose sole owner is `player-credential-print-sheet.tsx`. Under the stated ownership rule ("assign by live driver class; classless rules to the residual shell") that unit splits in two — the print block then names a hash no element carries, everything stays hidden, and **teachers print blank paper**, with `tsc`, `eslint`, `vitest`, `prettier`, `build:demo` and the 26-document count all green. See §11 R-01. [V]

And the split does not even achieve its stated aim: `VER-E`'s strict partition lands `primitives` ≈860 and residual shell ≈836 lines, so **both** proposed budgets (300/600 and `INV-E`'s own revised 450/650) are breached. Being honest about the smaller numbers: `--focus-ring-color`, defined inside `.sidebar` but consumed by `globals.css:120`, is **not** app-wide as `INV-E` claimed — `.sidebar` (`portal-shell.tsx:49`) is a *sibling* of `.workspace` (`:81`), so at most 4-8 sidebar controls are affected. [V]

**Ship now:** the 1,862-line dead purge (mechanical, follows §2), the 19-rule surgery set, and the 3 orphaned tokens. **Build first, then extract:** a browser-free **cross-file selector-integrity oracle** — fail if a rule references a class its own file does not define (green today, red on any misplacement). Once it exists, extraction becomes safe and can be scheduled per screen.

Also record as an **incidental pre-existing bug, not a split-created one** — and note that this paragraph is now the defect's **only** home: `COMPAT-POLICY.md` §2 removed the register's **R-02** row as class **A** framing (no phase causes it), while keeping the warning below verbatim as class **C** oracle substance. Track the bug as its own ticket, not as a refactor regression. `.mobileNavItem` exists in **0 of 7** stylesheets, `mobile: true` is set on all 14 nav items, and **45 of the 104 documents in the current local export** ship `class="… undefined"` (`grep -rl 'class="[^"]*undefined' out --include='*.html'` → 45), so `.desktopNavItem` is never applied. Those 104 are a **local build artifact, not committed content** (§2's static-export row; `.gitignore:7` is `/out`, `git ls-files out` → 0), which is the wording fix `COMPAT-POLICY.md` edit 9 applies here — the counts themselves are unchanged. `ADV-3`'s warning about the remedy is the important part: `desktopNavItem` then *looks* deletable, and an "no `undefined` in class attributes" gate cannot distinguish fixing the defect from deleting the concept.

### 8.4 `src/application/adult-portal/service.ts` (616 lines) and the demo store

`INV-E` inventoried **17 public methods** (org 4 / team 5 / class 6 / shell 2) and `VER-E` reproduced the count. [V]

- **plan §4.4 item 2 (split into 3 services + `authorization-guards.ts`): skip.** That is over-fragmentation at this method count. Extracting the shell view-model plus the guards gets the file to ~465 lines, which **passes** plan §7.1's 500-line ceiling, and it also dedupes a 13-line verbatim `authorizationActor` clone at `src/application/player-access/service.ts:14-26`, byte-identical to `adult-portal/service.ts:49-61` (confirmed by `AUDIT`).
- **§4.4 item 1 (navigation presenter): do it, but not where the plan says.** Target `src/application/adult-portal/shell-view-model.ts`, **not** `src/components/portal/portal-navigation-presenter.ts`. Moving application code into `components/` would create an `application → UI` import edge that does not exist anywhere today, and `AdultPortalService` already runs client-side (`src/runtime/adult-portal-demo-actions.ts:50`), so a `components/` destination imports UI-layer paths from a browser bundle. The governing audit's own Phase-4 row (`:696`) also says "presenters", not `components/`.
- Real duplication to fix, which neither the plan nor the audit names: the shell/navigation shape is produced in **four** places — `service.ts:140-195` (server nav items), `src/components/portal/portal-navigation.tsx:60-125` (demo nav items), `adult-portal-helpers.ts` (current-item matching), plus `portal-shell-context.tsx:10-16`, which is **role-label mapping rather than navigation** (`AUDIT` citation 11 relabels it). `getShell` currently has **zero** test coverage.
- **The domain layer is neither infra- nor persistence-agnostic, and no plan step notices.** `src/application/**` reaches into `src/server/**` in five places. Two are **runtime** dependencies: `adult-portal/service.ts:6-11` imports four policy *functions* (`canAccessClass`, `canManageClasses`, `canManageOrganizations`, `canManageOrganizationStaff`) from `src/server/authorization/v1-policy`, and `player-access/service.ts:2` imports `canAccessClass`. Three are `import type { LaunchTokenContext } from "@/server/security/launch-token"` (`game-events/ports.ts:7`, `game-events/service.ts:3`, `game-state/service.ts:12`) — erased at build time, so **not** a runtime edge; report the two classes separately, and note that one of them sits in a `ports.ts`, i.e. the port declaration itself names an infrastructure type. Both services additionally import `@/generated/prisma/enums` directly (`OrganizationRole`, `PlatformRole`, `RecordStatus`, `PlayerCredentialStatus`), and `player-access/service.ts:3` throws **another aggregate's** error type (`@/application/adult-portal/errors`). Consequences: the `no-restricted-imports` guardrail of §13 goes red on two files the day it ships, so it needs a grandfather list or these two imports moved behind a port; and the cross-aggregate error import independently supports skipping §4.4 item 2. [V]
- **Demo store:** `src/runtime/adult-portal-demo-store.ts` is 1,024 lines, over the 500 ceiling, with **no §4 step addressing it** (§8.5). Plan §3.3's "implement atomic transaction rollbacks" is half-built already: `DemoPlayerAccessStore.transaction` snapshots and restores correctly (`:741-750`) while `DemoAdultPortalStore.transaction` is a **no-op pass-through** (`:392-396`). Persistence is already atomic-by-accident (write only on success), so the residual hazard is the in-memory `state` object staying partially mutated after a caught error — about ten lines copying an existing pattern, not a new capability.
- **Plan §3.3's credential item cannot be implemented as written.** It names `demo-issuer.ts`, which does not exist; the real behavior is `token: tokenHash` at `adult-portal-demo-store.ts:852`, with the seeded credential array built from `DEMO_PLAYER_TOKENS` (declared at `:140`, referenced at `:278-305`). Worse, the named helper `hashPlayerCredentialToken` lives in `src/server/security/player-credential-tokens.ts`, which imports `node:crypto` — **unrunnable in a browser**. Implementing this requires either a Web Crypto SHA-256 path or accepting raw storage with an explicit comment, and either way the demo's QR is scanned **by the same browser**, so the raw token must stay recoverable in the issue flow (`architecture-audit-2026-09-23.md:685-687`). [V]

### 8.5 §7.1 file-size ratchet — not reachable as written

Post-purge census, reproduced by two independent counting methods (physical lines, and blank-stripped — same answer): **9 files FAIL, 8 WARN**. [V]

Five FAILs have **no §4 work step at all**: `src/runtime/adult-portal-demo-store.ts` (1,024), `src/components/public/public.module.css` (1,017), `src/components/marketing/marketing.module.css` (688), `src/components/portal/player-access-workflow.tsx` (540), `src/components/portal/team-screen.tsx` (411). And §4.2's own `idb-store.ts` estimate (650) violates the 500-line ceiling it is meant to satisfy.

Conclusion: §7.1 is only satisfiable under the governing audit's ratchet reading — budgets apply to **new or modified** files (`architecture-audit-2026-09-23.md:744-746`). Adopt that reading explicitly, add a script that fails on *newly* over-budget files, and record the 5 unbudgeted offenders as named debt rather than pretending the criterion passes.

---

## 9. Phase 4 — Gates, CI, demo behavior, documentation

### 9.1 Replace the unfalsifiable gates

| Plan gate | Problem | Replacement |
| :--- | :--- | :--- |
| "assert no `api/` in `out/`" (`:236`) | can never fail — the exporter drops route handlers and `proxy.ts` by construction, without even warning during `buildExport` | assert the demo manifest has **0** `server-action` ids (already §7.2's criterion), and record that the 4 `/api/v1/player/*` handlers + `src/proxy.ts` are **intentionally inert** in the demo |
| §7.2 zero `@runtime/*` aliases | satisfiable by renaming one alias | assert `next.config.ts` and `tsconfig.json` alias maps match, and that no first-party file imports `@runtime/*` other than the seam modules |
| §7.4 "CI tests, lints, typechecks and builds on every PR" | true of the plan's intent, false of the repo: `deploy.yml` runs none of them | implement §9.2 |
| §7.5 "fully operational demo … local persistence" | unattainable for created entities | scope to seeded routes + drawer/modal for created ones (D-2) |
| §7.1 size budgets | unreachable for 9 files | ratchet reading (§8.5) + a new-violation script |
| `npm run typecheck` as a standalone gate | stateful, and **silently weaker** without `.next/types`; after §2.2 the three stale `validator.ts` copies are a **63-error workstation hazard** that no build order clears (§4 item 0.3) | run a compile first to populate route validators, and **delete** `.next/types`, `.next/dev` and `.next-demo-dev` after the route deletions — regeneration is not the remedy, deletion is. It does *pass* on a bare clone — do not present the compile as unblocking |
| `prisma validate` as the schema gate (plan §6 Day 1) | correct as far as it goes, and **nothing else in this refactor goes further**: the `migrate diff --exit-code` drift leg was deleted by ruling and has **no substitute** (§6.5) | keep `prisma validate`, add the non-empty-SQL assertion on `6_drop_generation_a` (§6.4), and **state in `ci.yml`'s comments** that no schema-drift gate exists. A real one needs a staging database (§6.5), not a service container someone forgot to add |

### 9.2 `ci.yml` design

`pull_request` + `push: main` + `workflow_dispatch`. One job per target, **serialized within the demo job** so a manifest assertion never reads a manifest another build wrote (both targets share `.next` — verified: `out/BUILD_ID` and `.next/BUILD_ID` ~74 s apart in `VER-F`'s reproduction, and `out/BUILD_ID` itself does not exist, so compare `.next/BUILD_ID` only).

Order: `npm ci` → `prettier --check` → `eslint --max-warnings=0` → **compile** (not required to pass, but it puts the route/params validators into the program) → `tsc --noEmit` (+ `typecheck:demo` if D-1=(b)) → `vitest run --no-isolate --fileParallelism=false` (the second flag is what makes §4 item 0.2's ordering bug reproduce — without it the claim is unsupported) → `prisma validate` → **`test -s prisma/migrations/6_drop_generation_a/migration.sql`** → `build:demo` → artifact assertions (26 docs, expected paths present, 0 action ids) → `build:server` with placeholder secrets (no reachable DB needed; `client.ts:17` is lazy, `portal/layout.tsx:22` gates on `connection()`).

**The order has no schema-drift leg and gains none.** `COMPAT-POLICY.md` §4 edit 3 (adopted at §6) removed the `migrate diff --exit-code` step that used to sit between `prisma validate` and `build:demo`, together with the Postgres `services:` container, the `SHADOW_DATABASE_URL` env key and the two `prisma.config.ts` datasource keys it needed. **Do not book a replacement step**: the DB-free byte-compare that was once offered presupposed the collapsed history the owner rejected (§6.5). The result is a pipeline that cannot detect schema/migration drift, which is a recorded consequence of the ruling, not an oversight to fix in a phase. [V]

`ci.yml` is **created by §4 item 0.4**, not by this phase; `.github/workflows/` holds only `deploy.yml` at `e5aaf1e`. The one number in the workflow that the purge invalidates — the document-count assertion's `104` → `26` — is edited **in Phase 1's purge PR, in the same commit as the deletions**, because that is the commit where the number changes and Phase 00's branch protection requires the `gates` check (§5.7 step 9).

**CI order is not commit order.** §5.7 sequences the schema edit *second* because the deletions need a valid schema to compile against; CI simply re-validates the same artifacts in one pass, so `prisma validate` appearing after `typecheck` there is not a contradiction.

Both build targets share `.next`, so **the demo manifest assertion must be the step immediately after `build:demo`** with no intervening `build:server` — repeat this in the workflow comments, since it is the same trap §5.7 step 8 navigates.

Branch protection on `main` with required checks **after** §4 item 0.1 lands, else `ci.yml` is born red.

### 9.3 Demo runtime behavior decisions to record, not discover

**Three rows moved here out of the §11 regression register** by `COMPAT-POLICY.md` edit 6 (adopted at §6): **R-03** (hydration flash), **R-04** (deep link to a demo-created entity) and **R-06** (cross-tab sync) are not failures any phase causes — they are standing properties of a static-export demo, and the register's purpose is "behavior some phase could break". The bullets below are their new home; the first, second and third correspond to R-03, R-04 and R-06 respectively.

- Prerendered demo HTML is **always the seed state and always `PLATFORM_ADMIN`** (`adult-portal-demo-store.ts:347` returns `cloneSeed()` when `window` is undefined; the seed's `platformRole` is set at `:155`, with `activeProfileId` at `:149`), with 10 screens re-reading after hydration. The hydration flash is an accepted cost of the static design — say so in the docs.
- Seeded classes (`demo-turma-3a`, `demo-turma-4a-campos`, `demo-turma-5b`) refresh cleanly because `generateStaticParams` emits exactly 3 pages (2 org pages). Anything created in the demo does not. GitHub Pages serves `out/404.html`; it does **not** fall back to `/portal/turmas` as plan §3.3 states. [V]
- Cross-tab sync is the **`storage`** listener at `src/components/portal/use-demo-portal.ts:15` (its teardown at `:18`), **not** the same-tab `CustomEvent` `"adult-portal-demo-change"` at `:14` (teardown `:17`); `:13` is the initial `sync()` call. The plan's "retain the cross-tab event" wording invites deleting `:14` — the wrong one. **R-06 in the register was a line-number correction, not a preservation duty**, which is why it left the register. [V] (`AUDIT` B3, which corrected an off-by-one this document previously carried)
- **The demo store's key and version may be bumped.** `DEMO_ADULT_PORTAL_STORAGE_KEY` → `:v3` and `version: 3` at `src/runtime/adult-portal-demo-store.ts:124, 137-138, 148` — two lines of substance. `readDemoAdultPortalState`'s existing seed fallback (`:347-356`) returns `cloneSeed()` unless `value.version === 2`, so **that fallback *is* the whole migration**; there is no migrate-on-read code to protect, and the audit's "wipe demo state for existing visitors" objection (§12 row 3's old citation of R7) prescribed a mitigation the file never implemented. Precedent: `git log --all -S 'adult-portal:v1' -- src` shows the v1→v2 bump already shipped at `48b6c5d` with zero migration code. [V] (`COMPAT-POLICY.md` §2 row §12 r3) This is what unblocks §8.4's `DemoAdultPortalStore.transaction` fix and credential change without a wipe worry.

### 9.4 Documentation edits (concrete, not "update docs")

`README.md` structure tree and route list; `docs/current-architecture.md:175,178` (documents `/atividade/[token]` as live) plus its route table and a new seam description; **`docs/schemas/database-model.md`** — ~14 stale statements, 7 tables documented against 16 models, and it is **outside** the plan's Day-4 scope, so add it; `docs/schemas/{api-contracts,domain-rules}.md` mention `AccessLink`/`CapabilityAssignment` (and `AuditEvent`, which §6.2 row 9 now deletes too); `walkthrough.md:11` (a live `/atividade/7FQ-29M/` URL) — **its one-line deletion is the entire surviving duty of D-4** — `:24`, `:40-51` (12 purged routes listed as delivered; `PRODUCT.md:113-119` genuinely defers materials, so deleting them is intended, not an oversight); `implementation_plan.md:19,24,52-62`; `docs/implementation/README.md` status. Archive the superseded plans per audit Phase 0 step 4 with one-line pointers.

---

## 10. Dependency graph and ordering

### 10.1 Hard edges (verified)

```
0.1 format:check fix ─┐
0.2 order-dep test ───┴─► 0.4 ci.yml + branch protection ─► everything below
   (0.3 is a CI-ordering note, not a blocker: typecheck passes without it, but checks less)

E1 status-badge ──────► plan §2.3 delete portal-view-service   (only true build edge in the purge)
:97 relation ─────────► model CapabilityAssignment             (same commit)
§2.2+§2.3 delete ─────► isDemoRuntime trim                     (2 of its 10 purge-side refs are in §2.3)
§2.2 route delete ────► delete the 3 stale validator roots (§4 0.3) ──► typecheck   (else 63 false TS2307s **on a workstation only**; no build order clears them, and CI never has any)
0.4 ci.yml authored ───► purge PR's `104 → 26` doc-count edit ──► gates check    (§5.7 step 9: same commit as the deletions)
seam item 4 (forms→client components) ──► CSS ownership map    (moves 12 marketing classes + styles.logoutButton)
purge ────────────────► all CSS work                           (2 dynamic `styles[…]` sites die with §2)
fake-indexeddb + characterization tests ──► game-offline-sync split
selector-integrity oracle ──► any stylesheet extraction
```

Note that the `seam item 4 → CSS ownership map` edge only matters if Phase 3 extraction is scheduled at all; under **D-3 = (b)** it guards work this dossier no longer books, and the edge becomes latent.

### 10.2 What the plan sequences wrongly, and why

Two of the plan's ordering justifications do not survive measurement, though the order mostly does. [V] (`ADV-1`)

- Purge-before-seam was justified by "2 of 9 aliases point at files §2 deletes". Comparing the alias targets against the purge set gives **0**: the 18 alias entries resolve to **17 distinct files** (`@runtime/sign-in-action` and `@runtime/sign-out-action` share `src/runtime/demo-auth-actions.ts` on the demo side), and none of them is in §2.2/§2.3/§2.4. `next.config.ts:47` resolves `@runtime/sign-in-action`'s server side to `entrar/actions.ts` (a survivor); `portal/atividades/actions.ts` is never an alias target. **P1 and P2 are file-disjoint and may run in parallel.** (Recomputed by the main agent by parsing `next.config.ts` and intersecting with the purge set: `distinct alias targets: 17`, `hits in purge set: 0`.)
- Seam-before-CSS was justified by "20 of the 23" files overlapping. The true overlap is **9**. The real reason stands and is different: item 4's conversions create `sign-in-form.tsx` / `sign-out-button.tsx` and relocate class usage, which invalidates the sole-owner map any CSS extraction depends on.
- Decomposition-before-CSS is the wrong order for one item only: the offline split does not touch CSS, but the `game-host` work and `player-access-workflow` may. Do CSS last regardless (D-3).

### 10.3 Red window

Estimated longest continuously-red window: **4-8 hours**, which is the purge itself; **0 hours on `main`** if everything lands through PRs with required checks. Without §4 item 0.1, the window is unbounded because the gate can never go green.

---

## 11. Regression register

**Rows R-02, R-03, R-04, R-06, R-08, R-15 and R-16 were removed by `COMPAT-POLICY.md` (§4 edit 10, adopted at §6); the register now holds only failures a phase causes in *new* code.** Their destinations: R-02 → §8.3's incidental-bug paragraph (as a defect ticket, with its oracle warning kept verbatim), R-03/R-04/R-06 → §9.3 as documented demo properties, R-08 → D-4/§9.4 (one-line doc deletion), R-15 → deleted with `model AuditEvent` (§6.2 row 9), R-16 → closed as a mislabelled premise (D-5). **Remaining ids are not renumbered** — §5.5, §8.3 and §13 cite them by number.

Every row is user-visible behavior that some phase could break. Phase labels: **P1** = purge (§5), **P1b** = schema/migration (§6), **P2** = seam (§7), **P3** = decomposition (§8), **P4** = gates/docs (§9). "Automated?" reflects the repo's real coverage: **no DOM tests, no integration tests, no browser tests exist**, and `vitest` runs in `node` against the **demo** variant only (`vitest.config.mts:12-15`), so **no test anywhere exercises server wiring**. It also reflects §6.5: **no row below is caught by a schema-drift gate, because the refactor has none.**

| # | Behavior | Phase that could break it | Manual check (route → expected) | Automated? |
| :--- | :--- | :--- | :--- | :--- |
| R-01 | **QR credential printing** | P3 CSS split | `/portal/turmas/demo-turma-3a` → players → print → browser print preview shows the cards, not a blank page | **No.** Root cause: per-file class hashing splits `@media print` (`portal.module.css:4355-4391`) from `.printSheet`/`.credentialPrintCard`. Fix = selector-integrity oracle first; do not split before it |
| R-05 | Sign-in / sign-out without JS; `basePath` correctness | P2 item 4 | `/entrar` with JS disabled; and `/SMS_Portal/…` prefix on every link in the export | No. Keep `<Link>`; do not introduce `<form method="get">` |
| R-07 | Player credential leakage into logs | P1 reveals it | Inspect pino output for a `/jogar?cred=…` request | No. `logger.ts:11-12` redacts `activityToken`/`attemptToken` (dead after P1) but **not** `cred`, which becomes the only token-in-URL flow left |
| R-09 | Referrer isolation for `/jogar` | P1 §2.1.3 | `/jogar?cred=X` response header `Referrer-Policy: no-referrer` | **No** — `proxy.test.ts` has 2 tests, both against `/entrar`, asserting CSP/correlation only. Cut **line 113 only** |
| R-10 | Offline queue survives storage-layer changes | P3 offline split | Enqueue events, reload, confirm queue drains in order | Only via new `fake-indexeddb` characterization tests; 665 lines have zero coverage today |
| R-11 | "Saved" indicator honesty | P3 offline split | Force a mid-flight failure; UI must not show saved | No. `succeed`/`fail` ordering semantics are last-wins (`:1200-1203`) and a late `fail` **rejects** (`:1186-1198`) |
| R-12 | Demo/game protocol version agreement | P3 game-host cleanup | Demo adapter handshake under a bumped `PROTOCOL_VERSION` | Partially — `v1-contracts.test.ts` covers wire schemas, not the adapter message. Both `demo-game-adapter.tsx:16-20` **and** `game-host.tsx:652` hardcode `1` |
| R-13 | Demo QR issue → same-browser scan | P3/P4 credential change | Issue a credential in demo, scan/follow it in the same browser | No. Raw token must remain recoverable; `hashPlayerCredentialToken` uses `node:crypto` and cannot run in the browser |
| R-14 | Status badge rendering | P1 E1 | All six surviving screens still render badges with correct tone | No DOM tests; verify visually in `dev:demo` |
| R-17 | Every demo route after the purge | all | Use §11.1 checklist in `dev:demo` and in a built `out/` | No |

### 11.1 Manual route checklist after Phase 1 (26 documents expected in `out/`)

Public: `/`, `/entrar`, `/entrar/recuperar` (unlinked but exported), `/jogar`, `/jogar?cred=<seed>`. Portal: `/portal`, `/portal/turmas`, `/portal/turmas/{demo-turma-3a,demo-turma-4a-campos,demo-turma-5b}`, `/portal/resultados`, `/portal/resultados/<classId>`, `/portal/resultados/<classId>/players/<slotId>`, `/portal/admin/organizacoes`, `/portal/admin/organizacoes/<id>`, `/portal/admin/equipe`, `/portal/ajuda`, `/portal/sem-acesso`, `/portal/sessao-expirada`. Must now 404: `/portal/atividades*`, `/portal/materiais*`, `/portal/modulos*`, `/portal/admin/{jogos,modulos,auditoria}`, `/atividade/*`, `/portal/admin` (already 404).

---

## 12. Interfaces: what changes vs what must not

| Surface | Change | Constraint |
| :--- | :--- | :--- |
| DB schema | **5 relation fields, 4 models, 1 enum** dropped via `6_drop_generation_a` (`AuditEvent` + `ProfessionalProfile.auditEvents` are in the set; the earlier "3 models" predates §6.2 row 9's switch to delete) | keep the sequential history — `COMPAT-POLICY.md` §6 **rejected** edit 1's collapse; hand-author the sixth as **10 statements / 29 lines** (§6.4); never `migrate dev`/`db push` (§6.5). **No drift gate exists**, so nothing checks this row after the fact |
| `contracts/schemas/api-error.v1.schema.json` | **`RATE_LIMITED` deleted** at `:21`, same commit as `model RateLimitBucket` (D-5; the deferral was removed by edit 5) | **Naming correction to this row's old text**, which called this file "a published wire contract": `api-error.v1.schema.json` is the **portal↔browser** HTTP envelope, untested and unreachable under `output: 'export'`. The **portal↔GameMaker** contract is `contracts/schemas/v1/protocol-error.v1.schema.json` — 4 codes, fixture-tested at `v1-contracts.test.ts:31-36`, and **frozen by `contracts/schemas/README.md:85-88`**. That one is not touched by this refactor's error trim |
| Demo `localStorage` key/version | `missoes-caramelito:adult-portal:v2` → **`:v3`**, `version: 2` → **`3`** at `adult-portal-demo-store.ts:124, 137-138, 148` | the old "**do not change the key or version**" ban is **lifted** (edit 6, §6). `readDemoAdultPortalState`'s version check (`:347-356`) already returns `cloneSeed()` on any mismatch, so the existing fallback **is** the whole migration and there is no migrate-on-read code to protect (§9.3, and audit R7's mitigation was never implemented) |
| `PortalMutation` prop type | unchanged; it is already the seam contract for forms | reuse rather than reinvent in `contracts.ts` |
| Reader/mutation names | **default** to byte-identical through any seam change — no longer a constraint | 38 specifiers / 24 import sites, but §7.3's own table already records export removed/renamed as caught with **"yes, 8× `TS2305`/`TS2724`"** at real call sites. The old clause contradicted the dossier's own measurement, and `typecheck:demo` (D-1=(b)) is the gate that makes it true for the demo wiring |
| 11 consumed exports of `game-offline-sync` | **default** to reachable — no constraint, **and no re-export barrel** | only 2 importers; repoint them (§8.1 step 5). The characterization case at IDB v2→v3 was dropped with the same edit, on the emptiness of the protected population (§8.1 S1 row, §9.3) |
| `StatusBadge` props | narrows to `"Ativa" \| "Inativa"` | 10 call sites already comply (§5.3) |
| `next.config.ts` `env.APP_BASE_PATH` / `basePath` | unchanged | `trailingSlash: true` + `/SMS_Portal` prefix under export |

---

## 13. Opportunities to simplify the implementation

1. **Skip the generated entry; take the audit's own `tsconfig.demo.json` + `typecheck:demo` + vitest alias** (D-1, ~5-6 h vs ~2-3 days, same detectable drift axis, zero new failure modes).
2. **Use a core ESLint `no-restricted-imports` pattern rule instead of an `import "server-only"` fence** (§7.2c) — no new dependency and CI-visible, and it keeps readers testable. State the loss honestly: a path rule cannot condition on the **importer** carrying `"use client"`, so it does not reproduce `server-only`'s guarantee; the residual needs a `react-server`-layer check or a hand-written rule. Note also that `eslint-plugin-import`, which the audit's §8.5 (`:560`) names, is **not installed** in this repo (`AUDIT` B7). Whatever pattern set is chosen, check it against the five existing `application → server` imports in §8.4 first — a boundary rule that goes red on merged code on its first run gets switched off, not fixed.
3. **Purge dead CSS; do not split stylesheets yet** (D-3). The ship set is the 1,862-line dead purge plus the 19-rule surgery set plus dropping the 3 orphaned tokens — mechanical deletion that achieves most of the measurable benefit at a fraction of the regression risk (§8.3 defines it identically).
4. **Skip §4.4 item 2's 3-way service split** (§8.4). View-model extraction + guard dedupe reaches 465 lines and passes the ceiling.
5. **Refuse the `game-host` hooks split**; do helpers + presentational child + pure presenter (§8.2).
6. **Repoint the 2 offline importers and delete `game-offline-sync.ts`** — no thin re-export barrel (§8.1 step 5), and with §12 rows 5-6's bans lifted, neither the file's existence nor its export names is a constraint any more.
7. **Adopt the audit's ratchet wording for §7.1** instead of attempting 5 unbudgeted files in a 3-4 day sprint (§8.5).
8. **Drop three plan items that describe work already done or files that do not exist:** §4.3 item 3 (duplicate handshake), §3.3's `demo-issuer.ts` item, §2.1.3's `ajuda` "pre-requisite". Plan §2.5.5's "keep `model AuditEvent`" is a fourth, overridden the same way (D-6, §6.2 row 9).
9. **Sequence P1 and P2 in parallel branches** (§10.2) — they are file-disjoint, which halves the calendar exposure if two people are available.

---

## 14. Open questions and assumptions

| # | Item | Status |
| :--- | :--- | :--- |
| Q-1 | Does a server reference survive the generated file's re-export hop with a **function-level** `"use server"` and a client importer? | [U] one combination, ~85% resolved from compiled output; spike in §7.4 |
| Q-2 | D-1 mechanism choice (generated entries vs per-target tsconfig) | [U] human decision; dossier executes the plan's choice if unmade, with the measured cost delta noted |
| Q-3 | ~~Does any external GameMaker build branch on `RATE_LIMITED`?~~ **Closed by `COMPAT-POLICY.md` §2/§6 (edit 5): no deferral, no open question.** The premise was class **A** mislabelled **B** — `api-error.v1.schema.json` is portal↔browser and its only client (`game-host.tsx`) never inspects `code`; GameMaker reads the separate `protocol-error.v1` vocabulary. Checking `Heroes_Trial` for such a branch remains a **courtesy** for a human outside this workspace (`COMPAT-POLICY.md` §5.3), not a blocker | resolved — D-5 |
| Q-4 | ~~Will stakeholders notice the loss of the activities/materials demo?~~ **Closed by §4 edit 4 (adopted at §6): D-4's stakeholder gate was the project re-asking `REFACTOR_PLAN.md:21` and `slice-03-05-portal-handoff.md:53-55`.** `PRODUCT.md:113-119` genuinely defers materials, and the purge of it is intended | resolved — D-4 |
| Q-5 | Post-purge `generateStaticParams` count | resolved — **11 in deleted trees / 4 surviving / 15 total** (`ADV-3`'s adjudication, independently confirmed by `AUDIT`'s count of 15). Earlier published pairs of 12/4 (`VER-A`) and 5/3 (`INV-A`) were both wrong; all agents agree the 4 survivors depend only on alias targets, so no decision turns on it |
| Q-6 | Is the server target actually functional end-to-end? | [U] **never verified**: no database has ever been created (audit R1). **This is now R1's only home**: §6.5's `migrate deploy` + drift-gate step, which used to be "the first time the history is proven to apply", was **deleted by ruling as non-functional**, so nothing in this refactor proves the history and nothing changes the "the hosted product works" claim remaining unproven after Day 4. The duty sits on the acceptance list: `slice-03-05-portal-handoff.md:35` item 1, "Supply an actual staging Neon connection" |
| A-1 | Working tree clean at `e5aaf1e`, all 6 migrations tracked | [V] — plan's Day 0 premise is stale |
| A-2 | `npm run typecheck` is **stateful but not order-blocked**: it passes with no `.next` (skipLibCheck makes `next-env.d.ts:3-4` inert), silently checks less without the route validators, and after §2.2 carries **63** false `TS2307`s from the **three** stale `validator.ts` copies until those roots are deleted — a compile rewrites only `.next/types/`, never the two `dev/types` trees. Workstation-only: CI checkouts have no `.next` | [V] §4 item 0.3 — this line previously asserted the opposite and was refuted by execution; the 60-figure and the "compile regenerates them" remedy were refuted a second time by `phases/50` |
| A-3 | No DOM/integration/browser test infrastructure exists | [V] — every UI claim in this dossier is therefore manual |

---

## 15. Report index

Read these only when this dossier's summary is not enough; each is cited above by section.

| Area | Investigation | Verification | Adversarial |
| :--- | :--- | :--- | :--- |
| §2 purge closure | `INV-A-purge-closure.md` (465) | `VER-A-purge-closure-verification.md` (278) — **ran the purge in scratch copies** | `ADV-1` ordering, `ADV-3` §numbers |
| §3.1 seam | `INV-B-dual-runtime-seam.md` (640) | `VER-B-dual-runtime-seam-verification.md` (584) | `ADV-2-seam-design.md`, `NOTE-00`, `ADJ-02` |
| §2.5/§3.2 Prisma | `INV-C-prisma-schema-migration.md` (370) | `VER-C-prisma-schema-verification.md` (279) | `ADJ-01` (main-agent tiebreak) |
| §4.2/§4.3 god files | `INV-D-runtime-godfiles.md` (918) | `VER-D-runtime-godfiles-verification.md` (180) | `ADV-3` scope |
| §4.1/§4.4/§5 CSS + service | `INV-E-css-and-service.md` (260) | `VER-E-css-and-service-verification.md` (373) | `ADV-3` (print regression) |
| §6/§7 roadmap, CI, demo | `INV-F-gates-ci-demo.md` (1161) | `VER-F-gates-ci-demo-verification.md` (767) | `ADV-1-sequencing-integration.md` (295), `ADV-3-scope-and-regressions.md` (513) |
| Cross-cutting | `CRITIQUE-governing-conflicts.md` (122, parent dir) | `ADJ-01`, `ADJ-02`, `ADJ-03`, `NOTE-00` | `AUDIT-dossier-correctness.md` (425) — audited **this document**; 7 blocking errors, 22 citation failures, 12 inconsistencies, all applied |
| Per-phase refutation series (after the 6×6 sweep) | `RV-00-prerequisites-refutation.md`, `RV-10-purge-refutation.md`, `RV-20-schema-refutation.md`, `RV-30-seam-refutation.md`, `RV-40-decomposition-refutation.md`, `RV-50-gates-refutation.md` — one per file in `phases/` | `RV-X-cross-phase-consistency.md` — the audit across all seven phase files (duplicate owners of one edit, vocabulary collisions) | `COMPAT-POLICY.md` (parent dir) — §2's class-**A**/**B**/**C** verdict table, §4's ten concrete edits, §6's owner ruling, which **governs §4 wherever they disagree** and is the authority for the corrections applied through §2-§14 here. `RV-20` §1 holds the 10-statement SQL reconciliation behind §6.4 |

**Method:** 6 scoped investigations → 6 paired refutation verifiers → 3 approach-level adversarial agents (sequencing, seam design, scope/regression) → main-agent tiebreak measurements where two agents contradicted each other → a final audit agent that attacked this dossier and won seven times, including one refutation of a main-agent measurement (`ADJ-03` §F1). All agents worked read-only against production files; the only files created are in `docs/refactor-dossier/`. Scratch experiments (a purge simulation, schema copies, a real clone for the typecheck test) ran outside the repository. Two passes then corrected this document **in place** without re-running that sweep: the per-phase `RV-00 … RV-X` refutation series, and `COMPAT-POLICY.md`'s compat audit plus the owner's split ruling at its §6. Where a claim here is attributed to `phases/…` or to `COMPAT-POLICY.md`, it was measured in those later passes, and the earlier figure it replaced is either deleted or struck through where the reversal is load-bearing.

**`architecture-map.html`** (parent dir) is the drawn form of this document: the same 7 layers, the same generation colours, the 11 defects of §3/§5/§6/§7/§8/§11 pinned to the boxes that cause them, and the ownership boundary of every module on click. **It now lags this document in two places the compat ruling reaches and this file cannot fix:** its `/atividade/*` caption (`architecture-map.html:186`) still carries the retired stakeholder-gate/shim framing (D-4), and its defect pins include the six register rows §11 no longer holds. `COMPAT-POLICY.md` §4 edit 4 books the caption rewrite outside the dossier; the map is otherwise still accurate on the facts machine-audited below. Its geometry was machine-audited in a browser for both states and the stacked comparison — no box overlap, no wire crossing a box it does not touch, no collinear wires, no clipped label, an arrowhead on every edge. Its **facts** were then audited separately against the tree at HEAD: 104 claims, 84 passed, and all 20 failures corrected in place (a mis-summed component count, the offline engine's "665 untested" figure misplaced onto the demo store, two invented edges, an inverted dependency-inversion arrow, and several present-tense claims that are only true after the purge). Two of the auditor's own suggestions were rejected on reproduction: `auth → http` is a real edge (the box covers `src/server/config/**`), and the schema's `310 → 251` was measured on an executed scratch schema, not derived arithmetically.


<!-- SECTION-BREAK -->
