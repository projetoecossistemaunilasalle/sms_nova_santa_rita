# RV-B — Cross-Document Consistency Review of `REFACTOR_PLAN.md` v2.0

**Reviewer scope:** adversarial, read-only. Checks whether `REFACTOR_PLAN.md` (v2.0, 2026-09-23) agrees with the
repository's other governing documents, and whether its claimed revision ("Updated post multi-agent adversarial
audit", `REFACTOR_PLAN.md:5`) actually incorporated that audit's corrections.
**Method:** line-by-line diff against `docs/architecture-audit-2026-09-23.md`,
`docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md`, `docs/agent-reviews/agent-ledger.md`, `PRODUCT.md`,
`README.md`, `DESIGN.md`, `walkthrough.md`, `implementation_plan.md`, `docs/current-architecture.md`,
`docs/implementation/*.md`, `docs/schemas/*.md`, `portal-v1-specification.md`, plus `wc`/`grep`/`find` re-measurement
of every quantitative claim in the plan. No code was written; no build/test/migration was run.
**Commit context:** `d4af23c` + uncommitted working tree (`git status`: 33 modified files, `REFACTOR_PLAN.md` and
`docs/agent-reviews/` untracked) — the same baseline the audit and the prior review used.

---

## 0. Scope corrections to the review brief

| Brief says | Reality in the documents | Evidence |
| --- | --- | --- |
| "findings F1-F10" | The audit carries **F1-F12**. F11 (config/build coupling) and F12 (contained hygiene items) are in scope and are **both absent from the plan**. | `docs/architecture-audit-2026-09-23.md:399`, `:417` |
| "risks R1-R5" | The risk register carries **R1-R9**. All nine are assessed below. | `docs/architecture-audit-2026-09-23.md:777-787` |
| "the audit's 12-21 developer-day estimate near line 769" | CONFIRMED verbatim. | `docs/architecture-audit-2026-09-23.md:769` vs `REFACTOR_PLAN.md:6`, `:25`, `:196` |
| "file-size budget near line 744" | CONFIRMED: component 250/400, module 300/500, CSS 300/600, test 400/800, "applies to *new or modified* files only". | `docs/architecture-audit-2026-09-23.md:744-746` |
| "Phase-0 ordering near line 595" | CONFIRMED: "Phase 0 … **blocks everything**"; `:592` "Each phase is independently shippable and leaves the app working". | `docs/architecture-audit-2026-09-23.md:592`, `:595` |

Also note: `docs/implementation/README.md:48-51` makes the audit binding — "Treat its phases 0-3 as the precondition
for further slice work." The plan never cites the architecture audit anywhere (see F-01).

---

## 1. Decisions D1-D7: honored / reversed / silently dropped

### D1 — Keep the GitHub Pages demo, "ONLY as an adapter-based build target (Phase 3)"

> "D1 | Do we keep the GitHub Pages demo as a shipped artifact? | Agree | Keep, but ONLY as an adapter-based build
> target (Phase 3). Its value is stakeholder review; **its cost is the duplicate implementation, which Phase 3
> removes.**" | **PARTIAL / cost-half-reversed** | `docs/architecture-audit-2026-09-23.md:793`; Phase 3 step 5 says
> "Delete the demo action modules (`adult-portal-demo-actions.ts`, `player-access-demo-actions.ts`,
> `player-entry-demo-actions.ts`, `demo-auth-actions.ts`), keep the single `"use server"` implementations"
> (`:676-678`) vs `REFACTOR_PLAN.md:100-101`, `:123-124` | **MAJOR**

The demo survives (the "keep" half is honored). The "adapter, not copy" half is **reversed**: the plan's §3.1 makes the
demo run "a plain function (Static Export)" i.e. client handlers, and its deletion manifest
(`REFACTOR_PLAN.md:68-75`) does **not** list `src/runtime/adult-portal-demo-actions.ts` (223 lines) or
`src/runtime/player-access-demo-actions.ts` (154 lines) — both verified present. So the plan's own §1.1 complaint
"**Duplicated Server Actions** (one `"use server"`, one `"use client"`)" (`REFACTOR_PLAN.md:19`) is not fixed; it is
promoted to the target architecture, and no success criterion (§7) forbids it. The escape hatch the prior review cited
does exist in a governing doc — `docs/implementation/v1-architecture-plan.md:69-71` ("give the demo a dedicated static
entry rather than weakening server behavior") — but the plan neither cites it nor acknowledges diverging from D1.

### D2 — Legacy routes: delete (not hide)

> "**Fixed looks like.** … Legacy routes deleted (Appendix B)" | **CONFIRMED HONORED** |
> `docs/architecture-audit-2026-09-23.md:253-255`, `:794`, `:846-850` vs `REFACTOR_PLAN.md:37-45` | **—**

The route disposition matches Appendix B exactly (atividades / materiais / modulos / admin-jogos / admin-modulos /
`(public-play)/atividade`). No finding.

### D3 — Authorization: V1 roles only, keep `CapabilityAssignment` only if still needed

> "keep `CapabilityAssignment` only if the capability model is still the authorization source for `/portal/admin/*`;
> otherwise fold into the V1 role model and **delete the table in a migration**." | **PARTIALLY DROPPED** |
> `docs/architecture-audit-2026-09-23.md:650-655` vs `REFACTOR_PLAN.md:56-57` (deletes `authorization-service.ts`,
> `prisma-capability-reader.ts`) and `REFACTOR_PLAN.md:78-83` (§2.5 lists only `AccessLink` + `RateLimitBucket`) |
> **MAJOR**

The plan deletes the *only* code that reads capabilities (verified: `CapabilityAssignment`/`capabilityAssignments`
appear in `src` only in `prisma-capability-reader.ts:26,44`, `authorization-service.ts:13,26,202,225`,
`service-container.ts:1,4`) but never mentions the surviving `model CapabilityAssignment`
(`prisma/schema.prisma:79`, `:97`, `:245`) or the `Capability` enum. Result: an orphaned table + enum with zero readers,
which is the exact dead-model class the audit catalogued at F8. D3's explicit "delete the table in a migration" branch
is silently skipped.

### D4 — Integration database: disposable Postgres + Neon branch

> "D4 | Integration database strategy | disposable Postgres via Docker/testcontainers" | **SILENTLY DROPPED** |
> `docs/architecture-audit-2026-09-23.md:796`, Phase 5 `:704-717`, exit `:716-717` vs `REFACTOR_PLAN.md` — the words
> "integration", "testcontainers", "PGlite", "disposable" appear **nowhere** in the plan (verified by grep) |
> **BLOCKER** (scope, not code)

§7.3's only test gate is "`npm test` execute cleanly" — i.e. the same 33 node-unit files the audit says prove nothing
about the risky boundary (`:379-388`). Combined with the DDL the plan *does* schedule (F-05), this is the single
largest omission in the document.

### D5 — UI copy: catalogue later

> "Catalogue later, but enforce one module per surface meanwhile" | **HONORED BY INACTION, but the "meanwhile" clause
> is dropped** | `docs/architecture-audit-2026-09-23.md:797`, `:425` | **MINOR**

The plan does not add a message catalogue (correct), but it also does not enforce "one module per surface"; it moves
pt-BR copy around (`REFACTOR_PLAN.md:174` navigation presenter) without noting the copy-inline symptom.

### D6 — Rate limiting: implement **with** `RateLimitBucket`

> "D6 | Rate limiting: implement or delete? | **implement with `RateLimitBucket`** | Implement for the four player
> endpoints and sign-in (they are the abuse surface)" | **REVERSED, unacknowledged** |
> `docs/architecture-audit-2026-09-23.md:798` and Phase 6 step 3 `:725-727` vs `REFACTOR_PLAN.md:83`
> ("Remove `model RateLimitBucket` … rate limiting can be implemented cleanly via port when needed") and `:213` |
> **MAJOR**

Suspicion **confirmed**, with two nuances in the plan's favor and one against:

- Favor: the deletion is technically clean — `RateLimitBucket` has **0** hand-written code references
  (re-measured: `grep -rn "rateLimitBucket|RateLimitBucket" src tests scripts` excluding `src/generated` → 0 hits).
  The plan's "unreferenced in code" (`:83`) is CONFIRMED.
- Favor: F8 itself allows "implement rate limiting **or** drop the model" (`:150`), so the plan is inside the audit's
  option set — but not inside the *decision* the audit recorded at `:798`, which is the binding artifact
  ("section 8 needs sign-off before code changes", `:6`).
- Against: the audit's alternative is a **pair** — "drop the model **and the `RATE_LIMITED` code**" (`:150`, `:725`).
  The plan drops only the model and leaves `RATE_LIMITED` live in `src/server/http/errors.ts:11` and in the wire
  contract `contracts/schemas/api-error.v1.schema.json:21`. That contradicts §6 of the audit
  ("`contracts/schemas/*.json` … must be preserved", `:434-435`) by leaving an error code no code path can emit, and
  contradicts F8's stated purpose (a reader cannot tell dead code from pending work).

### D7 — `AccessLink`: drop **only after** confirming no V1 screen needs link sharing

> "drop `AccessLink` and its migration in a follow-up migration **only after** confirming no V1 screen needs
> link-based sharing (the QR/credential path replaces it)" | **REVERSED (gate removed) — substance defensible** |
> `docs/architecture-audit-2026-09-23.md:652-653` vs `REFACTOR_PLAN.md:79` ("Remove `model AccessLink`") executed on
> Day 1 (`:213`) | **MAJOR** (process) / **MINOR** (outcome)

Suspicion **confirmed as a process violation, refuted as a product error**:

- The plan drops the model unconditionally on Day 1 and **in the same schema.prisma edit** drops
  `RateLimitBucket`; there is no confirmation task, no evidence line, and no follow-up-migration staging.
- The confirmation, if performed, would almost certainly pass: the V1 public entry is `/jogar/?cred=<token>`
  (`docs/implementation/slice-02-player-access-decisions.md:7`), the QR credential is the V1 sharing model
  (`PRODUCT.md:52-61`), and the link-bearing spec is explicitly demoted — `PRODUCT.md:206` keeps
  "`portal-v1-specification.md` … earlier aggregate-only/**link-only** assumptions … as historical research", and
  `README.md:44` labels it "(historical research only)". `docs/implementation/v1-architecture-plan.md:29` lists
  `access links` under "Repository today", not under "Required direction".
- What is *not* defensible: the DDL is executed without the migration the audit's own wording assumes
  ("in a **follow-up migration**", `:652`) — see F-05.

---

## 2. Risks R1-R9: addressed / ignored

| Risk (audit line) | Plan treatment | Verdict | Evidence | Severity |
| --- | --- | --- | --- | --- |
| **R1** migrations never applied to a real DB; "the schema might not even apply" (`:779`) | Plan edits `prisma/schema.prisma` (drops 1-3 models + 2 inverse relations) and its only DB step is "Run `prisma validate` and typecheck" | **WRONG — plan increases the risk it declares unverified.** `validate` checks schema grammar, not the SQL chain; 6 migrations exist (`prisma/migrations/0_init…5_v1_game_events`) and `access_links`/`rate_limit_buckets` are created in `0_init/migration.sql` and touched in `1_add_paused_at/migration.sql`. Removing models without a drop migration leaves schema↔migration drift; the audit assumed a migration file (`:652`). | `REFACTOR_PLAN.md:78-83`, `:213-214`; `docs/architecture-audit-2026-09-23.md:779`, `:652`; prior review B4 `REFACTOR_PLAN-review-2026-09-23.md:86-88` | **BLOCKER** |
| **R2** real GameMaker build doesn't exist; "Freeze the contract **before Phase 4 touches `game-host`**" (`:780`) | §4.3 rewrites `game-host.tsx` on Day 3; no contract-freeze step, no mention of `contracts/` at all | **SILENTLY DROPPED** | `REFACTOR_PLAN.md:165-171`, `:227`; `docs/architecture-audit-2026-09-23.md:780`; `docs/implementation/slice-02-handoff.md` (no tablet scan performed), `docs/current-architecture.md:258-261` | **MAJOR** |
| **R3** offline/two-device behaviour never exercised (`:781`) | §4.2 splits `game-offline-sync.ts` (1,222) into three files; adds **no** behaviour test. `tests/unit/game-offline-sync.test.ts` (728 lines) is neither split (audit: that split *is* the acceptance signal, `:694`) nor mentioned | **SILENTLY DROPPED** | `REFACTOR_PLAN.md:159-163`, `:225`; `docs/architecture-audit-2026-09-23.md:694`, `:712`, `:781` | **MAJOR** |
| **R4** deleting Gen A breaks a live stakeholder demo; "one commit per route family; keep the deleted seed data inside `runtime/demo/fixtures/`" (`:782`, `:663-664`) | One mega-purge on Day 1; `runtime/demo/fixtures/` appears nowhere; no per-family commit rule | **SILENTLY DROPPED** | `REFACTOR_PLAN.md:210-214`; `docs/architecture-audit-2026-09-23.md:663-664`, `:782` | **MINOR** (the Gen A fixtures are `portal-view-service.ts` demo data; the surviving demo store has its own seed, `src/runtime/adult-portal-demo-store.ts`) |
| **R5** removing authorization the old admin screens still use (`:783`) | Deletes `authorization-service.ts` + `prisma-capability-reader.ts`; keeps `CapabilityAssignment`; never runs the "component-by-component check" | **PARTIAL** — code-level check holds (verified: no surviving page imports them), but `service-container.ts:1,4` **does**, and §2.1.3 only cleans lines 2-3 → `typecheck` breaks. See also D3. | `REFACTOR_PLAN.md:35`, `:56-57`; `src/server/services/service-container.ts:1`, `:4`; `docs/architecture-audit-2026-09-23.md:783` | **BLOCKER** (build-breaking residue) |
| **R6** committing 6.4k untracked lines surfaces doc/slice conflicts (`:784`) | Day 1 "Phase 0: Commit uncommitted working tree" | **HONORED (partially)** — commit is scheduled, but the plan's Phase-0 line drops the audit's other four Phase-0 steps (docs archive, README fixes, ESLint/tsconfig exclusion is moved to Day 2, slice-by-slice commit granularity) | `REFACTOR_PLAN.md:210`; `docs/architecture-audit-2026-09-23.md:597-610` | **MINOR** |
| **R7** localStorage schema change wipes demo state; version the key, migrate on read (`:785`, `:675`) | §3.3 keeps localStorage and adds atomic rollback, but has **no** read-validation/key-versioning step. The audit flagged `readDemoAdultPortalState()` trusting any `version === 2` (`:265-266`) | **SILENTLY DROPPED** | `REFACTOR_PLAN.md:133-136`; `docs/architecture-audit-2026-09-23.md:265-266`, `:675` | **MAJOR** |
| **R8** two authorization models; consolidate "in one PR with tests per role × capability matrix" (`:786`) | Plan deletes the capability code without the matrix test; `tests/unit/authorization.test.ts` (634 lines, tests `AuthorizationService`) is **not** in the deletion manifest while its subject is | **WRONG / INCOMPLETE** | `REFACTOR_PLAN.md:56`, `:68-75`; `tests/unit/authorization.test.ts:1-9`; `docs/architecture-audit-2026-09-23.md:786` | **BLOCKER** (purge leaves a test importing a deleted module → `npm test` fails → §7.3 unfalsifiable) |
| **R9** test-count drop looks like regression (`:787`) | §2.4 enumerates the 5 files and their case counts (verified exact: 56/13/5/2/2) | **HONORED in substance** — but the plan never states the expected drop in a §7 gate, and §7.3's "100% passing tests for active code" (`:232`) is the metric R9 warns about | `REFACTOR_PLAN.md:68-75`, `:232`; `docs/architecture-audit-2026-09-23.md:575-576`, `:787` | **MINOR** |

Also dropped: **F6 layering leaks** and **F7 discarded validation results**, and §10 guardrails (import-boundary lint
rules, size-budget ratchet, ADRs, "no new `@runtime/*`" rule). F6 is not merely absent — §3.2 actively re-legitimizes
it: "**all 42 surviving imports of `@/generated/prisma/enums` remain functional with zero file rewrites**"
(`REFACTOR_PLAN.md:131`) is the direct opposite of the audit's target rule
"`components/**` … must not import `@/generated/**`" (`docs/architecture-audit-2026-09-23.md:553`) and its "largest
mechanical change" instruction (`:561-563`). Measured leak today: 21 files under `src/components` + `src/application`
import `@/generated/prisma*`. Verdict: **CONTRADICTS D-independent audit rule, unacknowledged** | **MAJOR**.

---

## 3. Did the "post multi-agent adversarial audit" revision incorporate the audit?

Prior finding → v2 status. "Prior" = `docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md`; "ledger" =
`docs/agent-reviews/agent-ledger.md`.

| Prior finding | v2 status | Evidence | Severity |
| --- | --- | --- | --- |
| **B1** §3.1/§7.2 vs §7.5 mutually exclusive (static export forbids `"use server"`, E625) | **FIXED (reworded as instructed).** v2 §3.1 now *names* E625 and states the two-implementation seam; §7.2 was rewritten from "every Server Action exists in exactly one file" to "Actions consume typed interfaces; no `@runtime/*` file-swapping aliases". E625 claim independently verified real. Residual: the plan never states *how* the server branch is excluded from the demo bundle; the audit's own snippet (`composition.ts` runtime ternary, `:720-726`) would still register a server action. | `REFACTOR_PLAN.md:119-125`, `:241`; `node_modules/next/dist/export/index.js:380-381` (E625); `node_modules/next/dist/docs/01-app/02-guides/static-exports.md:291`; `docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md:32-43`; `docs/architecture-audit-2026-09-23.md:521-526` | MAJOR→resolved; residual MINOR |
| **B2** §3.3 Prisma output into `node_modules` impossible; 43-file cost; benefit illusory | **FIXED on decision / PARTIAL on the stated benefit.** v2 keeps `output = "../src/generated/prisma"` and only excludes it from `tsconfig.json` (the review's recommended option 3, `:178`). But §3.2's **Benefit** line still asserts "TypeScript stops scanning the 29,722 lines" — TS re-adds excluded files when they are imported (`tsconfig.json:45-54` `include: ["**/*.ts"]`, 43 surviving `@/generated/prisma` import lines), and the prior review already recorded every generated file carries `@ts-nocheck`/`eslint-disable` (already ignored by `eslint.config.mjs:15`, `.prettierignore:3`, `.gitignore:27`). | `REFACTOR_PLAN.md:127-131`, `:221`; `tsconfig.json:22-55`; `docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md:47-57`, `:178` | MAJOR→mostly resolved; MINOR over-claim |
| **B2b** "42 surviving imports" | **WRONG (stale).** Re-measured post-purge: **37** files / **43** `@/generated/prisma*` import lines. 42 was the prior review's *pre-purge* count. | `REFACTOR_PLAN.md:131`; grep of `src`+`tests` minus §2 delete set | MINOR |
| **B3** purge breaks build — 4 surviving importers missing | **PARTIALLY FIXED — 1 of 4 importers still breaks it, and 2 new ones added.** Fixed: `ActivityStatus` relocation (`:33`, verified the only surviving consumer is `status-badge.tsx:1`, and the 6 named screens are exactly the surviving users); auditoria repoint (`:34`); `portal-dev-bypass.test.ts` now deleted (`:75`). Still broken: (a) §2.1.3 removes only `PrismaAccessLinkStore` + `AccessLinkService` from `service-container.ts`, leaving lines 1 and 4 importing `PrismaCapabilityReader` and `AuthorizationService`, both of which §2.3 deletes; (b) `tests/unit/authorization.test.ts` imports `AuthorizationService` and is not in §2.4. Also unaddressed from B3's tail: deleting `prisma-access-link-store.ts:325 recordAudit` removes the **only writer** of `AuditEvent`, while §2.1.2 promises to repoint a page at that table. | `REFACTOR_PLAN.md:33-35`, `:56-57`, `:68-75`; `src/server/services/service-container.ts:1-4`; `tests/unit/authorization.test.ts:1-9`; `src/server/db/prisma-access-link-store.ts:325-326`; `docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md:61-75`; `docs/architecture-audit-2026-09-23.md:456`, `:651` | **BLOCKER** (the headline claim of §2.1 "Must Happen BEFORE Purge" is false as enumerated) |
| **B3b** AuditEvent writer deletion | **NOT FIXED / REGRESSED by v2's own expansion.** v2 added `authorization-service.ts`, `prisma-capability-reader.ts`, `tokens.ts`, `share-actions.tsx`, `public-state.tsx`, `activity-mark.tsx` to the manifest (good — those were the review's "under-listed" files) but never reconciled the audit's "keep `AuditEvent` (written by the audit trail; add the reader in step 1)" against its own deletion of the writer. After the purge, `AuditEvent` has 0 writers and 0 real readers → §2.1.2 is unimplementable. Product docs make deleting the page a bad fallback: `PRODUCT.md:189` "Audit or administrative traceability where required"; `docs/implementation/v1-architecture-plan.md:35` navigation direction ends "…organizations, and **limited audit**". | `REFACTOR_PLAN.md:34`, `:52`; `docs/architecture-audit-2026-09-23.md:456`, `:640-641`, `:651`; `PRODUCT.md:189` | **BLOCKER** |
| **B4** schema deletion invalid in Prisma; no drop migration; D6 reversal unacknowledged | **PARTIALLY FIXED.** Fixed: both inverse relations now listed with correct lines — `ProfessionalProfile.createdAccessLinks` at `prisma/schema.prisma:65` and `Organization.accessLinks` at `:80` (both verified verbatim). NOT fixed: **no drop migration task anywhere** (`migrat` appears in the plan only as "IndexedDB … migration", "migration effort", Tailwind "migrate"); `prisma validate` is offered as the gate; **D6 reversal still unacknowledged**; `RATE_LIMITED` half-deletion (see D6); `CapabilityAssignment` fate undecided. | `REFACTOR_PLAN.md:78-84`, `:213-214`; `prisma/schema.prisma:65`, `:79-80`, `:97`, `:245`, `:261`, `:300`; `prisma/migrations/0_init/migration.sql`; `docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md:78-88` | **BLOCKER** |
| **B5** "In-Memory" demo store breaks criterion 5 | **FIXED.** §3.3 now mandates `window.localStorage`, names the failure modes (deep links, `/jogar`, multi-tab) and keeps the `adult-portal-demo-change` event; diagram §3 now says "localStorage Persistence". Rollback-on-throw matches the audit's target (`:543`). Residual (R7): no read validation / key versioning. | `REFACTOR_PLAN.md:114-116`, `:133-136`; `docs/architecture-audit-2026-09-23.md:543`; `src/runtime/adult-portal-demo-store.ts:348`, `:360` | resolved |
| **M1** stale quantitative base (11 of 16 numbers wrong) | **LARGELY FIXED, with a new units bug.** All §2.2 route totals verified exact: 1,188 / 92 / 23 / 7 / 7 / 364 (sum 1,681). All §2.3 service/store lines verified exact (521/717/352/65/38/103/244/55/61). §2.4 case counts exact (56/13/5/2/2). But the column is headed "**Verified Lines**" and mixes scales: `activity-builder 244` (actual total 256, non-blank 244), `activity-controls 147` (156/147), `material-editor 252` (266/252), `class-groups-explorer 228` (237/228) are **non-blank**, while `activity-mark 27`, `share-actions 147`, `public-state 36` are **totals** — and `materials-explorer 120` matches **neither** (total 132, non-blank 124). | `REFACTOR_PLAN.md:38-66`; `wc -l` / `grep -c '[^[:space:]]'` on each file | MAJOR→fixed; MINOR (units) remains |
| **M1b** "~6,450 lines of dead code" | **PARTIAL / internally inconsistent.** The plan's own manifest measures **7,050 total lines** and **6,439 non-blank**. So 6,450 is right only in non-blank units — the same units the §2.3 rows silently use while §2.2 uses totals. §1.1 (`:22`), §2 (`:85`) and §6 (`:212`) all repeat "~6,450" without a units statement. | `REFACTOR_PLAN.md:22`, `:85`, `:212`; re-measured sum of §2.2+§2.3+§2.4 file sets | MINOR |
| **M2** "TypeScript vs Turbopack split-brain" is factually wrong | **FIXED in substance.** v2's phrasing ("`tsconfig.json` checks the server code, but `next.config.ts` bundles the demo code under Turbopack") is exactly the review's corrected defect. Label "split-brain" retained cosmetically. | `REFACTOR_PLAN.md:20`; `docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md:120`; `tsconfig.json:24-42` vs `next.config.ts` server branch | resolved |
| **M3** blast radius unquantified (24 sites / 23 files) | **PARTIALLY FIXED.** §6 Day 2 now removes aliases from **both** configs atomically (matches audit exit `:630`); §7.2 mentions only `next.config.ts`. The 23-file/24-site count and "no test asserts on the alias structure" are still absent. | `REFACTOR_PLAN.md:220`, `:241`; `docs/architecture-audit-2026-09-23.md:158`, `:630`; `docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md:122` | MINOR |
| **M4** CSS decomposition: dead-CSS attribution, ~400 unreachable, existing files, `:root` token soundness | **SPLIT VERDICT.** (a) **FIXED:** §4.1 now credits `results.module.css` (378) / `team-screen.module.css` (123) as pre-existing (verified exactly) and keeps tokens in `globals.css` (verified: 68 custom properties, `:root` count 1 in `globals.css`, 0 in `portal.module.css`). (b) **REGRESSED:** "**Purging Generation A immediately deletes ~1,570 lines of dead CSS**" now attributes the *whole* dead mass to the purge. Re-measured on the 37 importers: of 319 class tokens defined, 115 are unused by survivors, of which only **52 are used by the purge set** and **63 by nothing at all** — consistent with the prior review's 875-947 purge-attributable of 1,572-1,611 total. (c) **NOT FIXED:** §4.1's four named splits still don't reach ~400 for `portal.module.css` (residual ~1,500-1,700 per both CSS agents), and `loading.tsx` / `player-access-workflow.tsx` consumers are unnamed. (d) **NOT FIXED:** 11 interleaved `@media` blocks incl. `@media print` and the dynamic `styles[\`tone${…}\`]` blind spot; the §5.2 table still claims "zero layout breakage" although the repo has **no CSS/DOM/snapshot test**. | `REFACTOR_PLAN.md:146-157`, `:189`; `docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md:124-130`; `docs/agent-reviews/agent-ledger.md:28-34` | MAJOR (b, c) / MINOR (d) |
| **M5** §7 criterion 1 fails on 9 untouched files and contradicts the audit's budgets | **NOT FIXED.** v2 only added the parenthetical "(excluding third-party schemas and `idb-store.ts`)". The same nine >400-line survivors are untouched by §4 (enumerated in §4.3 below), and the audit's per-kind budgets + "new or modified files only" ratchet (`:744-746`) are still ignored. | `REFACTOR_PLAN.md:240`; `docs/architecture-audit-2026-09-23.md:744-746`, `:700`; `docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md:132`, `:182` | MAJOR |
| **M6** §4.2/§4.4 split arithmetic | **FIXED for §4.2's and §4.4's numbers** (650 + 60 + 350 vs the review's 657 / 53 / 356; §4.4 now offers "keep cohesive **or** split" plus the 4th module `authorization-guards.ts`, matching audit `:696`). **NOT FIXED:** the cross-cutting blockers (`eventRequestIdentity` called from both sides, registry↔store cycle) are unmentioned, `idb-store.ts` ~650 still breaches §7.1 by 250 lines (mitigated only by a self-granted carve-out), and `GameOfflinePersistence` exists for `tests/unit/game-offline-sync.test.ts:35` — which §4.2 never mentions moving. | `REFACTOR_PLAN.md:159-163`, `:173-175`, `:240`; `docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md:134-136`; `docs/architecture-audit-2026-09-23.md:694`, `:696` | MINOR→MAJOR (test split) |
| **M7** §4.3 ignores `game-bridge.ts` and the real duplication | **FIXED for both named items:** §4.3 now cites `game-bridge.ts` (84 lines, verified exact) and step 3 names the `demo-game-adapter.tsx` (112 lines, verified) handshake copy. **NOT FIXED:** the shared-state constraint (12 refs + 6 `useState` spanning both hooks) and `game-host.tsx`'s 8 `runtimeMode` branches are unmentioned, so "two hooks" is still the proposed shape. | `REFACTOR_PLAN.md:165-171`; `src/components/public/game-bridge.ts`, `src/components/public/demo-game-adapter.tsx`; `docs/architecture-audit-2026-09-23.md:290`, `:115` | MINOR |
| **M8** §3.2 no-op / reverses accepted wrapper decision | **FIXED.** §3.4 now retains `scripts/next-target.mjs` (matching audit `:586`, `:721`) and adds a safe default for `src/runtime/mode.ts` (matching `:583`). Two residuals: (a) the "preparing static assets" attribution is wrong — that is `scripts/start.mjs:39-52`, not `next-target.mjs` (whose jobs are `loadEnvConfig:24`, mode injection `:26-30`, `NODE_ENV:33`, `AUTH_DEV_BYPASS:39`, secret blanking `:41-53`); (b) the plan never addresses the *reason* the wrapper exists (config-time Zod validation, audit F11) — **F11 is silently dropped**. | `REFACTOR_PLAN.md:138-140`; `scripts/next-target.mjs:24-53`; `src/runtime/mode.ts:7-11` (no default — verified); `docs/architecture-audit-2026-09-23.md:399-415`, `:583-586`, `:721` | MAJOR→fixed; MINOR residuals |
| **M9** unsafe Day-1 ordering, Pages red, Phase 0 last | **PARTIALLY FIXED.** Phase 0 (commit + CI) moved to Day 1 head (`:210`), and Day 1 ends with `prisma validate` + typecheck. **NOT FIXED:** Days 2 and 3 have no verification line at all; the first build gate is Day 4; and `.github/workflows/deploy.yml:3-5,34` still runs `build:demo` and deploys on every push to `main` with no test job — so removing the aliases on Day 2 (`:220`) leaves the live Pages site broken or frozen-stale for ~2 days, against the audit's "each phase … leaves the app working" (`:592`). | `REFACTOR_PLAN.md:206-234`; `.github/workflows/deploy.yml:3-5`, `:34`, `:41-50`; `docs/architecture-audit-2026-09-23.md:592`, `:604-605`; `docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md:143` | MAJOR |
| **M10** 3-4 days vs audited 12-21 dev-days | **NOT FIXED.** All three places still say 3-4 days. Arithmetic of the audit's own figures for the work v2 actually schedules: Phase 1 (1.5-3) + Phase 2 (2-4) + Phase 3 (2-3) + Phase 4 (2-4) = **7.5-14 developer-days for 4 calendar days**, and that already omits Phase 0 (0.5-1, now inside Day 1), Phase 5 (2-4, dropped), Phase 6 (1-2, dropped), Phase 7 (0.5, dropped). | `REFACTOR_PLAN.md:6`, `:25`, `:196`; `docs/architecture-audit-2026-09-23.md:759-771`; `docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md:145`, `:180` | **BLOCKER** (planning) |
| **M11-a** `PRODUCT.md:113` misquote | **FIXED.** §2.2 now cites `PRODUCT.md:115-119`; verified: 115 "Materials/content management is not part of V1", 117 "removed or hidden from the production V1 navigation", 119 deferred to a later version. | `REFACTOR_PLAN.md:41`; `PRODUCT.md:113-119`, `:191` | resolved |
| **M11-b** contracts never mentioned | **NOT FIXED.** "contract" in v2 refers only to the new `src/runtime/contracts.ts`. `src/contracts/v1/schemas.ts` (481 lines), `contracts/schemas/v1/`, `contracts/fixtures/v1/`, `tests/unit/v1-contracts.test.ts` are never mentioned, despite the audit making them the source of truth (`:434-435`) and despite `contracts/schemas/api-error.v1.schema.json:21` being directly touched by the D6 deletion. | `REFACTOR_PLAN.md:120-122`, `:99`; `docs/architecture-audit-2026-09-23.md:434-435` | MAJOR |
| **M11-c** demo credential stores raw token as its own hash | **NOT FIXED.** `src/runtime/player-access-demo-actions.ts:36` still `return { token, tokenHash: token };`, and `src/runtime/adult-portal-demo-store.ts:278-305` seeds `tokenHash:` = literal demo tokens. The plan's §3.3 demo-adapter scope covers persistence + rollback only; "issuer", "hash", "credential" appear nowhere. Audit Phase 3 step 3 (`:673-674`) and target `:544` are dropped, and the surviving file is not in the deletion manifest either. | `REFACTOR_PLAN.md:133-136`; `src/runtime/player-access-demo-actions.ts:36`; `src/server/security/player-credential-tokens.ts:12`, `:23`; `docs/architecture-audit-2026-09-23.md:262-266`, `:544`, `:673-674` | MAJOR (security-honesty of the only deployed artifact) |
| **M11-d** "replaced by" feature-completeness assumption | **NOT FIXED (wording identical).** §2.2 still justifies `atividades` deletion as "Replaced by `/portal/turmas` and numbered player sessions" and `atividade/[token]` as "Replaced by `/jogar` + QR bearer credentials". Activity authoring has no V1 counterpart, and `/jogar` in server mode still renders `gameClient = { status: "missing" }` (`src/app/(public-play)/jogar/page.tsx:7-12`) because no GameMaker build exists (R2). Product docs support the *deletion* (`PRODUCT.md:145`, `:153`; `README.md:30-32`) but not the word "replaced". | `REFACTOR_PLAN.md:40`, `:45`; `src/app/(public-play)/jogar/page.tsx:5-13`; `PRODUCT.md:144-153`; `docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md:151` | MINOR |
| **M11-e** tests coupled to `APP_RUNTIME_MODE` | **NOT FIXED.** §3.4 changes `getRuntimeMode()`'s default; `tests/unit/runtime-mode.test.ts`, `env.test.ts`, `auth.test.ts` are not listed in §2.4 and no test-update task exists in §6. | `REFACTOR_PLAN.md:140`, `:68-75`; `tests/unit/runtime-mode.test.ts`; `vitest.config.mts` | MINOR |
| **M11-f** `proxy.ts:112-117` dead `/atividade/` no-referrer branch; `src/server/observability/logger.ts:11` `activityToken` redaction | **NOT FIXED** — neither is mentioned, so the purge leaves a header rule and a redaction key for a route that no longer exists. | `REFACTOR_PLAN.md:37-66`; `src/proxy.ts:112-117`; `src/server/observability/logger.ts:11` | MINOR |
| **§5.1-§5.7 decisions required before execution** | 1 demo action strategy → **ANSWERED** (§3.1). 2 demo persistence → **ANSWERED** (§3.3). 3 Prisma location → **ANSWERED** (§3.2). 4 migration policy + CapabilityAssignment → **NOT ANSWERED**. 5 sprint structure + timeline → **PARTIAL** (ordering fixed, timeline not). 6 auditoria + status-badge → **ANSWERED but now self-defeating** (writer deleted). 7 criterion 1 scope → **NOT ANSWERED**. | `docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md:172-182` | — |

**Bottom line on the header claim.** Verdict on "Updated post multi-agent adversarial audit": **PARTIAL**. B1, B2, B5,
M2, M7, M8, M11-a and the §2.2/§2.3/§2.4 number set were genuinely incorporated (that is real, verifiable work). But
**2 of 5 blocking defects (B3, B4) are only half-incorporated and remain build/DB-breaking**, **4 of 11 majors
(M5, M9-partial, M10, M11-b/c) are unaddressed**, and **2 of the review's 7 pre-execution decisions (4 and 7) were
never answered**. Two claims got *worse* than v1: the dead-CSS attribution (§4.1 step 1) and the "~6,450" total now
carry tighter numbers attached to looser causality.

---

## 4. Product-scope check: do the deletions conflict with documented V1 requirements?

**Method:** searched `PRODUCT.md`, `portal-v1-specification.md`, `README.md`, `DESIGN.md`, `walkthrough.md`,
`docs/schemas/*.md`, `docs/implementation/*.md` for link sharing, QR, "compartilhar", materials, activities, audit.

| Deletion | Documented requirement | Verdict | Evidence | Severity |
| --- | --- | --- | --- | --- |
| `/portal/materiais` + `material-editor` + `materials-explorer` | Materials is **explicitly not V1** and should be removed from navigation | **CONFIRMED SAFE — the plan's only fully-evidenced scope call** | `PRODUCT.md:115`, `:117`, `:119`, `:191`; `README.md:9`, `:24`; `docs/current-architecture.md:180-186`; audit `:847` "PRODUCT.md: Materials is not V1" | — |
| `/portal/atividades` (+ builder/controls) | The portal "must not become a game editor, minigame catalog, or second source of truth"; GameMaker owns activities | **CONFIRMED SAFE for the product, WRONG for the stated reason** — "Replaced by `/portal/turmas`" implies a feature-migration equivalence that no doc grants | `PRODUCT.md:145`, `:153`; `README.md:30-32`; `REFACTOR_PLAN.md:40` | MINOR |
| `/atividade/[token]`, `share-actions.tsx`, `public-link-service`, `link-status`, `security/tokens` | `portal-v1-specification.md` **does** require link+QR sharing: ":78 Publication through an opaque exclusive link and QR code", ":134 The professional shares the link or QR code", ":781 Add preview, publication, exclusive links, QR codes…" | **NOT A CONFLICT — that spec is formally demoted** and superseded by the QR-credential model | `PRODUCT.md:52-61`, `:206`; `README.md:18`, `:44`, `:62`; `docs/implementation/slice-02-player-access-decisions.md:7`; `docs/implementation/v1-architecture-plan.md:29`, `:99-107`; `docs/current-architecture.md:175`, `:178` ("Legacy/demo session-link entry surface **to be reconciled**") | — (but see D7's missing confirmation artifact, MAJOR) |
| Access-link *machinery* generally | `walkthrough.md` still documents the Pages demo by those URLs (`:11` `/atividade/7FQ-29M/`, `:31-33` builder/controls/materials as the demo's selling points, `:41` `/portal/atividades/[id]/compartilhar`); `DESIGN.md:250` still defines the public surface as "a rota alcancada pelo **link personalizado e opaco**"; `docs/schemas/database-model.md:84-100` still documents `access_links` as "**the core new table**", and `docs/schemas/README.md:3-6` declares `database-model.md` **current** | **CONFIRMED CONFLICT — but it is a documentation-truth conflict, because the plan contains zero documentation tasks.** The audit mandates exactly those updates (Phase 2 step 5 `:656-657`, Phase 7 `:732-737`, F8 `:355`) | `REFACTOR_PLAN.md` (grep: no `README`, no `docs/`, no `current-architecture`, no `walkthrough` reference); `walkthrough.md:11`, `:31-33`, `:41-51`; `DESIGN.md:247`, `:250`; `docs/schemas/README.md:3-6`; `docs/schemas/database-model.md:84` | **MAJOR** |
| `AccessLink` model + inverse relations | See D7; also `docs/schemas/database-model.md:173` documents the RESTRICT FKs being removed | **PARTIAL** | as D7 | MAJOR |
| `/portal/admin/auditoria` *deletion option* ("or remove the page if administrative audit is deferred") | Audit/traceability is in V1's functional focus; navigation direction ends "…and limited audit"; audit says **keep** `AuditEvent` | **WRONG as an option** — and unimplementable anyway once the writer is deleted | `PRODUCT.md:189`; `docs/implementation/v1-architecture-plan.md:35`; `docs/architecture-audit-2026-09-23.md:456`, `:640-641`, `:651` | **BLOCKER** |
| `authorization-service.ts` / `prisma-capability-reader.ts` | `docs/implementation/v1-architecture-plan.md:28` puts "capabilities" in "Repository today", i.e. to be displaced by roles → deletion is on-strategy | **CONFIRMED SAFE in direction**, blocked by the two importers (B3) and the undecided table (D3) | `REFACTOR_PLAN.md:56-57`; `src/server/services/service-container.ts:1-4`; `tests/unit/authorization.test.ts:1-9` | MAJOR (mechanics) |
| QR / `player-credential-print-sheet` | V1 requires printable QR; §5.2/§4.1 preserve the print stylesheet | **CONFIRMED SAFE** | `PRODUCT.md:52-61`; `docs/implementation/slice-02-handoff.md:73`, `:84`; `REFACTOR_PLAN.md:190` | — |

**Net:** the *route/model* deletions are product-defensible. The scope breach is elsewhere: the plan deletes
`/portal/atividades`' **audit-constant and audit-writer machinery** (`audit-actions.ts`,
`prisma-access-link-store.recordAudit`) while promising to repoint the auditoria screen at the table those files feed —
a self-referential contradiction the product docs do not license.

---

## 5. Internal inconsistencies inside `REFACTOR_PLAN.md` v2.0

### 5.1 §7.1 "zero files over 400 lines" vs §4's split list — enumerated

Measured with `wc -l` over `src` + `tests`, excluding `src/generated` (17 files > 400 lines today):

| Lines | File | Touched by §2/§3/§4? | After the plan |
| ---: | --- | --- | --- |
| 4,910 | `src/components/portal/portal.module.css` | §4.1 | **still >400** — §4.1's own text says the purge removes ~1,570 and names 5 extraction targets; both CSS agents concluded residual ~1,500-1,700 |
| 1,625 | `tests/unit/access-link-service.test.ts` | §2.4 deleted | gone |
| 1,222 | `src/runtime/game-offline-sync.ts` | §4.2 | produces `idb-store.ts` ~650 (carved out of §7.1) |
| 1,024 | `src/runtime/adult-portal-demo-store.ts` | §3.3 only ("refactor into a clean adapter"), **not §4** | unquantified; **violates §7.1** |
| 1,017 | `src/components/public/public.module.css` | **never mentioned** | **violates §7.1** |
| 932 | `src/components/public/game-host.tsx` | §4.3 | ~250 stated — plausible |
| 728 | `tests/unit/game-offline-sync.test.ts` | **never mentioned** (audit `:694` makes its split the acceptance signal) | **violates §7.1** |
| 717 | `src/server/services/access-link-service.ts` | §2.3 deleted | gone |
| 688 | `src/components/marketing/marketing.module.css` | **never mentioned** | **violates §7.1** |
| 634 | `tests/unit/authorization.test.ts` | **never mentioned**, though §2.3 deletes its subject | **violates §7.1 + breaks `npm test`** |
| 616 | `src/application/adult-portal/service.ts` | §4.4 | addressed (both options) |
| 540 | `src/components/portal/player-access-workflow.tsx` | **never mentioned**, though audit Phase 4 lists it (`:697`) | **violates §7.1** |
| 521 | `src/server/services/portal-view-service.ts` | §2.3 deleted | gone |
| 517 | `src/app/(professional)/portal/atividades/actions.ts` | §2.2 deleted | gone |
| 481 | `src/contracts/v1/schemas.ts` | **never mentioned**; arguably the "third-party schemas" carve-out, though it is first-party and audit `:434-435` protects it | ambiguous |
| 467 | `src/server/db/prisma-adult-portal-store.ts` | **never mentioned** | **violates §7.1** |
| 411 | `src/components/portal/team-screen.tsx` | **never mentioned** | **violates §7.1** |

**Claim:** "**Clean Codebase:** Zero files over 400 lines (excluding third-party schemas and `idb-store.ts`)." |
**Verdict: WRONG (unreachable as written).** **9 files** survive the plan still over 400 lines (`adult-portal-demo-store`
1,024; `public.module.css` 1,017; `game-offline-sync.test` 728; `marketing.module.css` 688; `authorization.test` 634;
`player-access-workflow` 540; `schemas.ts` 481; `prisma-adult-portal-store` 467; `team-screen.tsx` 411) — the **same
list** the prior review produced, i.e. the finding was known, transmitted to the plan author, and left unaddressed.
The criterion also contradicts the repo's agreed budget (`docs/architecture-audit-2026-09-23.md:744-746`: CSS module
300/**600**, test file 400/**800**, module 300/**500**, and "the budget applies to *new or modified* files only"),
under which `portal.module.css` at ~1,500 and `public.module.css` at 1,017 would *still* be violations, but
`marketing.module.css` (688) and `game-offline-sync.test.ts` (728) would not.
**Severity: MAJOR.** (`REFACTOR_PLAN.md:240`; §4 lines `:146-175`; evidence above.)

### 5.2 Other internal contradictions

1. > "§1.1 The Core Problem: **Duplicated Server Actions** (one `"use server"`, one `"use client"`)" vs §3.1's target:
   "Production Server Action: `"use server"` / **Demo Client Handler: plain function**" | **CONFIRMED contradiction —
   the plan lists as a problem the mechanism it adopts as the solution**, and §7's criteria never require the
   duplication to end. | `REFACTOR_PLAN.md:19`, `:100-101`, `:123-124`, `:238-244`; `docs/architecture-audit-2026-09-23.md:468`
   ("Deployment targets differ by *adapter*, never by copied workflow code"), `:793` (D1) | **MAJOR**
2. > "§2.1 Pre-requisite Relocations (**Must Happen BEFORE Purge**) … 3. Clean Container Imports: Remove
   `PrismaAccessLinkStore` and `AccessLinkService` imports from `service-container.ts`" | **WRONG / incomplete** — the
   same file imports the two modules §2.3 deletes at lines 1 and 4 (`PrismaCapabilityReader`,
   `AuthorizationService`), so the "complete" pre-requisite set is still missing an item and Day 1's typecheck gate
   fails. | `REFACTOR_PLAN.md:31-35`, `:56-57`, `:214`; `src/server/services/service-container.ts:1-4` | **BLOCKER**
3. > "~6,450 lines of dead code removed instantly" (§2), "God files ranging from 900 to 4,900 lines" (§1.1) |
   **PARTIAL** — see M1b above: the manifest's own rows sum to 7,050 total / 6,439 non-blank; units are undeclared and
   mixed between §2.2 (totals) and §2.3 (mostly non-blank). | `REFACTOR_PLAN.md:21-22`, `:38-66`, `:85` | MINOR
4. > "Note that `results.module.css` (378 lines) and `team-screen.module.css` (123 lines) **already exist**" while
   §4.1 step 3 extracts `classes-screen.module.css`, `organizations-screen.module.css`, `overview-screen.module.css`,
   `player-access.module.css`, `primitives.module.css` | **CONFIRMED accurate** — verified absent today (all 5), so §4.1
   is genuinely new work; the pre-existing-credit line is honest. | `REFACTOR_PLAN.md:147`, `:151-156`; `wc -l` | —
5. > "**Purging Generation A immediately deletes ~1,570 lines of dead CSS**" | **WRONG (mis-attributed)** — re-measured:
   52 of 319 classes are used only by the purge set, 63 by nothing at all; the prior review's two independent methods
   both put the purge-attributable share at 875-947 lines of the 1,572-1,611 total. | `REFACTOR_PLAN.md:150`;
   `docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md:125`; `docs/agent-reviews/agent-ledger.md:28-34` | MAJOR
6. > "§7.2 … no `@runtime/*` file-swapping aliases in **`next.config.ts`**" vs §6 Day 2 "Remove `@runtime/*` aliases
   from `next.config.ts` **and `tsconfig.json`**" | **PARTIAL inconsistency** — criterion 2 under-states the gate;
   leaving the 9 `tsconfig.json:24-42` paths in place would keep `typecheck` resolving a module graph that no longer
   exists. | `REFACTOR_PLAN.md:220`, `:241` | MINOR
7. > "§7.3 Tooling Health: `npm run build:demo`, `npm run build:server`, `npm run typecheck`, and `npm test` execute
   cleanly" vs §6 Day 4 "Run `npm run build:server` and verify production server compilation" | **UNSUPPORTED as a
   day-4 outcome** — `build:server` requires `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`,
   `APPLICATION_SECRET` (`README.md:84-86`) and no CI job in the repo has ever run it (`deploy.yml` runs only
   `build:demo`); the audit's Phase 0 step 2 anticipates a `build:server` job "with placeholder secrets" and D4/R1
   require a real disposable DB. The plan schedules neither. | `REFACTOR_PLAN.md:231`, `:242`;
   `.github/workflows/deploy.yml:30-39`; `docs/architecture-audit-2026-09-23.md:604-605`, `:779` | MAJOR
8. Provenance/versioning: the header cites the *review* as "the multi-agent adversarial **audit**"
   (`REFACTOR_PLAN.md:5`) and links it as `REFACTOR_PLAN-review-2026-09-23.md` without its `docs/agent-reviews/` path,
   while the repository's actual audit — `docs/architecture-audit-2026-09-23.md`, the binding decision record whose
   D1-D7 / F1-F12 / R1-R9 / phases 0-7 govern this work — is **never cited once** in the plan.
   | **WRONG (mis-sourced document)** | `REFACTOR_PLAN.md:5`; grep: only external citation in the plan is
   `PRODUCT.md:115-119` (`:41`) | **MAJOR** — this is how the D3/D4/D6/D7 reversals and the Phase 5-7 scope loss went
   unnoticed.
9. `REFACTOR_PLAN.md` and `docs/agent-reviews/` are **untracked** (`git status`), and the plan's own Day-1 Phase 0 step
   is "commit uncommitted working tree". So every line number the plan cites in `prisma/schema.prisma`,
   `tsconfig.json`, `next.config.ts`, `portal.module.css` etc. points at an **uncommitted** state; if Phase 0 commits in
   slices (audit `:597-603`) after the plan is written, the citations are unverifiable at execution time.
   | **PARTIAL (methodological)** | `git status --short`; `REFACTOR_PLAN.md:210` | MINOR

---

## 6. Findings register (required format)

**F-01 — The plan's revision provenance is the wrong document.**
"Status: Updated post multi-agent adversarial audit (`REFACTOR_PLAN-review-2026-09-23.md`)." | **PARTIAL** — the review
was genuinely mined (B1/B2/B5/M2/M7/M8/M11-a traceable), but the *governing* audit is never cited, and 4 of its
decisions/risks (D3, D4, D6, D7) plus 3 phases (5, 6, 7) and 2 findings (F6, F11) are absent without acknowledgment. |
`REFACTOR_PLAN.md:5` vs `docs/architecture-audit-2026-09-23.md:6`, `:650-655`, `:704-737`, `:725`, `:789-799`;
`docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md:32-57`. | **MAJOR**

**F-02 — The purge's "must happen BEFORE" set is still incomplete; Day 1 cannot typecheck or test green.**
"Pre-requisite Relocations (Must Happen BEFORE Purge)" + "Run `prisma validate` and typecheck" | **WRONG** |
`REFACTOR_PLAN.md:31-35`, `:56-57`, `:213-214`; `src/server/services/service-container.ts:1`, `:4`;
`tests/unit/authorization.test.ts:1-9` (634 lines importing a file §2.3 deletes) | **BLOCKER**

**F-03 — §2.1 promises to repoint the audit page at a table whose only writer §2.3 deletes.**
"Repoint `…/admin/auditoria/page.tsx` to read from the real `AuditEvent` table, **or remove the page**" |
**WRONG / self-contradictory** | `REFACTOR_PLAN.md:34`, `:52`; `src/server/db/prisma-access-link-store.ts:325-326`
(sole `auditEvent.create`); `src/app/(professional)/portal/admin/auditoria/page.tsx:4` (reads fixtures);
`docs/architecture-audit-2026-09-23.md:456`, `:640-641`, `:651`; `PRODUCT.md:189`;
`docs/implementation/v1-architecture-plan.md:35` | **BLOCKER**

**F-04 — Schema DDL is scheduled with no migration and `prisma validate` as the only gate.**
"Update `prisma/schema.prisma`: drop AccessLink (and inverse relations) and RateLimitBucket … Run `prisma validate`" |
**WRONG (incomplete) / R1 unaddressed** | `REFACTOR_PLAN.md:78-84`, `:213-214`; `prisma/migrations/0_init/migration.sql`
(`access_links`, `rate_limit_buckets`), `prisma/migrations/1_add_paused_at/migration.sql:3`;
`docs/architecture-audit-2026-09-23.md:652` ("follow-up migration"), `:779` (R1);
`docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md:88` | **BLOCKER**

**F-05 — D6 (implement rate limiting) is reversed silently, and only half-executed.**
"Remove `model RateLimitBucket` … rate limiting can be implemented cleanly via port when needed" | **PARTIAL** —
deletion itself is technically clean (0 hand-written refs, re-measured), but the recorded decision reversal is
unacknowledged and the paired "`RATE_LIMITED` code" removal the audit prescribes is missing
(`src/server/http/errors.ts:11`, `contracts/schemas/api-error.v1.schema.json:21`). | `REFACTOR_PLAN.md:83`, `:213`;
`docs/architecture-audit-2026-09-23.md:150`, `:725-727`, `:798` | **MAJOR**

**F-06 — D7's confirmation gate is dropped.**
"Remove `model AccessLink`" executed unconditionally on Day 1 | **PARTIAL** — gate violated; outcome defensible
(`PRODUCT.md:52-61`, `:206`; `README.md:44`, `:62`; `slice-02-player-access-decisions.md:7`;
`v1-architecture-plan.md:29`). | `REFACTOR_PLAN.md:79`, `:213`; `docs/architecture-audit-2026-09-23.md:652-653`, `:799` |
**MAJOR** (process) / MINOR (result)

**F-07 — The demo's duplicated action modules and its raw-token-as-hash credential survive the plan untouched.**
"Generation C … a parallel, duplicated implementation … running on `localStorage`" (§1.1) + §3.3 scope = persistence +
rollback only | **NOT FIXED / REGRESSED vs D1+F3** | `REFACTOR_PLAN.md:16`, `:133-136`;
`src/runtime/player-access-demo-actions.ts:36`; `src/runtime/adult-portal-demo-store.ts:278-305`;
`docs/architecture-audit-2026-09-23.md:262-266`, `:544`, `:673-674`, `:793`;
`docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md:150` | **MAJOR**

**F-08 — §7.1 is unreachable and contradicts the repo's own agreed budgets.**
"Zero files over 400 lines (excluding third-party schemas and `idb-store.ts`)" | **WRONG** (9 surviving offenders;
see §5.1) | `REFACTOR_PLAN.md:240`; `docs/architecture-audit-2026-09-23.md:700`, `:744-746`;
`docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md:132` | **MAJOR**

**F-09 — Timeline was the prior audit's headline conflict and was not reconciled.**
"a working demo ready in **3–4 days**" / "a **direct 3-to-4 day architectural leap**" | **WRONG (conflict unresolved)** —
the audited figure for the same scope is 7.5-14 dev-days (Phases 1-4 alone) and 12-21 for the whole plan |
`REFACTOR_PLAN.md:6`, `:25`, `:196`; `docs/architecture-audit-2026-09-23.md:759-771`;
`docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md:145`, `:180` | **BLOCKER** (planning)

**F-10 — "~1,570 lines of dead CSS" is credited to the purge; only ~52 of 319 classes are purge-attributable.**
"Purging Generation A immediately deletes ~1,570 lines of dead CSS" | **WRONG (mis-attributed)** |
`REFACTOR_PLAN.md:150`; own re-measurement (52 purge-only / 63 never-referenced of 319);
`docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md:125`; `docs/agent-reviews/agent-ledger.md:31-32` | **MAJOR**

**F-11 — §3.2's performance benefit is overstated and its "42 imports" count is stale.**
"TypeScript stops scanning the 29,722 lines of generated code, while all 42 surviving imports … remain functional" |
**PARTIAL** — decision correct (prior review option 3), benefit weak (`@ts-nocheck` + `skipLibCheck`; `exclude` does
not remove imported files from the program), and surviving `@/generated/prisma` imports measured at **43 lines /
37 files**. | `REFACTOR_PLAN.md:127-131`; `tsconfig.json:45-56`; `docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md:52-56` |
**MINOR**

**F-12 — No documentation-truth pass, despite four docs becoming false.**
(plan contains no reference to `README.md`, `docs/current-architecture.md`, `walkthrough.md`, `docs/schemas/*`,
`DESIGN.md`) | **SILENTLY DROPPED** — audit Phase 2 step 5 (`:656`), Phase 7 (`:732-737`), F8 (`:355`), F9 (`:370-371`) |
`REFACTOR_PLAN.md` (grep result: only `PRODUCT.md:115-119` at `:41`); `README.md:53` (health handlers claimed but the
dirs are empty), `README.md:70` (`.env.local` vs `.env`); `docs/schemas/README.md:3-6` +
`docs/schemas/database-model.md:84` (`access_links` "core new table", doc declared current); `walkthrough.md:11`,
`:41-51`; `DESIGN.md:250` | **MAJOR**

**F-13 — Verification strategy (audit Phase 5 / D4 / F10) is absent, so §7.3's green tests certify nothing new.**
"Run `npm test` and ensure 100% passing tests for active code" | **WRONG (criterion is not evidence)** — no contract,
integration or behaviour layer is added, while the same sprint rewrites the offline engine, the host bridge and the
action seam. | `REFACTOR_PLAN.md:232`, `:242`; `docs/architecture-audit-2026-09-23.md:379-397`, `:565-576`, `:704-717`,
`:796` | **MAJOR**

**F-14 — Days 2-3 have no verification step and Pages stays broken mid-sprint.**
("Day 2 … Remove `@runtime/*` aliases"; "Day 4: Verification, Demo Rebuild & CI Green") | **PARTIALLY FIXED** (M9) —
Phase 0/CI moved first, but the deploy pipeline still builds `out/` from `main` on every push with no test gate. |
`REFACTOR_PLAN.md:216-233`; `.github/workflows/deploy.yml:3-5`, `:34`;
`docs/architecture-audit-2026-09-23.md:592`, `:631-632` | **MAJOR**

**F-15 — Guardrails (§10) that stop the debt returning are omitted.**
(no import-boundary lint rule, no ADR set, no "no new `@runtime/*`" rule, no ratcheted size budget, no
`typecheck:demo`) | **SILENTLY DROPPED** — and note the plan's §7.1 uses a *stricter* blanket number while omitting the
enforceable version | `REFACTOR_PLAN.md:236-244`; `docs/architecture-audit-2026-09-23.md:739-754`, `:626` | **MAJOR**

**F-16 — Positive finding (record so it is not re-litigated).**
"Next.js 16.3.2 strictly forbids `"use server"` actions under `output: 'export'` (ExportError **E625**)" and
"All 68 design tokens remain in `src/app/globals.css` `:root`" | **CONFIRMED** |
`node_modules/next/dist/export/index.js:380-381`; `node_modules/next/dist/docs/01-app/02-guides/static-exports.md:291`;
`REFACTOR_PLAN.md:119`, `:148`; `src/app/globals.css` (68 custom properties, 1 `:root`),
`src/components/portal/portal.module.css` (0 `:root`, 37 importers) | — (also AGENTS.md-compliant: verified against the
vendored docs as `AGENTS.md:1-7` requires)

---

## 7. Open questions for the plan author

1. **Which document governs?** The plan never cites `docs/architecture-audit-2026-09-23.md`, yet
   `docs/implementation/README.md:48-51` makes its Phases 0-3 a precondition for slice work. Is the audit now
   superseded by v2.0? If yes, say so and record D3/D4/D6/D7 as formally re-decided; if no, Phases 5-7 must re-enter
   the roadmap.
2. **What writes `AuditEvent` after Day 1?** §2.1.2 promises to repoint `/portal/admin/auditoria` at a table whose only
   writer (`prisma-access-link-store.ts:325`) §2.3 deletes. Either a new audit-port + adapter lands in the plan, or the
   page is deleted — and if deleted, how is `PRODUCT.md:189` / `v1-architecture-plan.md:35` ("limited audit") satisfied?
3. **Where is the drop migration, and who proves `prisma migrate deploy` still applies?** R1 explicitly says the schema
   has never been applied to a real database. Is it acceptable to widen schema↔migration drift by editing
   `schema.prisma` with only `prisma validate` as a gate? Will `CapabilityAssignment` / `Capability` / the
   `RATE_LIMITED` enum member be dropped in the same migration, or is `docs/schemas/database-model.md` to be updated
   instead?
4. **How is the demo's server branch kept out of the exported bundle?** §3.1 says both handlers exist behind one seam;
   if that seam is a runtime ternary (the audit's `composition.ts`, `:521-526`) the E625 error returns. Is selection
   build-time (per `v1-architecture-plan.md:69-71` "dedicated static entry")? Name the mechanism and the file.
5. **Is the duplicated action layer now *accepted*, or deferred?** If accepted, §1.1's "Duplicated Server Actions"
   bullet and D1's "its cost is the duplicate implementation, which Phase 3 removes" must be reworded; if deferred, when
   — Day 1-4 contains no step that deletes `adult-portal-demo-actions.ts` / `player-access-demo-actions.ts`, and the
   raw-`tokenHash` credential defect lives in exactly those files.
6. **Does 3-4 days survive contact with 12-21 developer-days?** If the answer is "we accept a subset", mark
   Phases 5, 6, 7 and D4 as explicitly descoped with the acceptance-risk statement (R1, R2, R3) that the GitHub Pages
   demo then permanently carries.
7. **Which 400-line budget is law?** §7.1's blanket number, or the audit's per-kind ratcheted budgets (`:744-746`)?
   Nine named files will still violate §7.1 on Day 4 — is criterion 1 then reported as failed, or quietly amended?
8. **What happens to the docs that the purge falsifies?** `walkthrough.md:11/:41-51`, `DESIGN.md:247/:250`,
   `README.md:53`, `docs/schemas/database-model.md:84`, `docs/current-architecture.md:176`, plus
   `portal-v1-specification.md:78/:133-134/:781` — archive (audit Phase 0 step 4), update in-sprint (Phase 7), or leave
   stale?
9. **Do you still intend to keep a live GitHub Pages site during the sprint?** `deploy.yml` deploys `out/` on every
   push to `main` with no test gate, so Days 2-3 either publish a broken site or freeze a stale one; the plan's only
   stated mitigation is §1.2's "temporary build break".
