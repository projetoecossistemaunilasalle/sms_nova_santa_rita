# VV-B — Adversarial Verification of `RV-B-cross-document-consistency.md`

**Role:** verifier (adversarial, read-only). Target under verification: the reviewer report
`docs/agent-reviews/refactor-plan-v2/RV-B-cross-document-consistency.md` (450 lines), which reviews
`REFACTOR_PLAN.md` v2.0 against `docs/architecture-audit-2026-09-23.md`.
**Mandate:** try to REFUTE each finding; uphold only what reproduces from primary sources.
**Method:** every audit line-number cited by the reviewer was read in place; every quantitative claim was
re-measured with `wc`/`grep`/`find`/one stdin-piped Node script (no files written except this one, no build, no
install, no migration). Baseline confirmed independently: HEAD `d4af23c` ("Document Slice 2 workflow and
verification"), `git diff --name-only` = **33 modified**, `git ls-files --others --exclude-standard` = **54
untracked** (RV-B says "33 modified, `REFACTOR_PLAN.md` and `docs/agent-reviews/` untracked" — reproduced).

**Verdict scale:** UPHELD / REFUTED / OVERSTATED / UNREPRODUCIBLE / SEVERITY-MISSET.
**Severity scale:** BLOCKER > MAJOR > MINOR > INFO.

---

## 1. Where RV-B is strongest (reproduced to the digit)

These are the load-bearing quantitative claims; all five reproduce exactly, which is why the report's overall
direction survives the errors catalogued later.

1. **>400-line inventory (§5.1 / F-08 / M5).** `find src tests -type f \( -name '*.ts' -o -name '*.tsx' -o
   -name '*.css' \) -not -path 'src/generated/*' | xargs wc -l | awk '$1>400'` → **exactly 17 files**, and the 9
   survivors are the 9 RV-B names with the 9 counts it prints (1,024 / 1,017 / 728 / 688 / 634 / 540 / 481 / 467 /
   411). Also identical to `docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md:132`. Nothing added, nothing
   missing.
2. **Manifest arithmetic (M1b).** Summing §2.2 route trees (1,188+92+23+7+7+364 = 1,681, all six verified by
   `find … | xargs wc -l`), §2.3's 17 real file sizes (3,413), §2.4's 5 tests (1,956) → **7,050 total / 6,439
   non-blank** — RV-B's numbers reproduced exactly. The plan's "~6,450" (`REFACTOR_PLAN.md:22`, `:85`, `:212`) is
   therefore correct only in non-blank units.
3. **Mixed units inside §2.3 (M1).** Measured total vs non-blank: `activity-builder` 256/244, `activity-controls`
   156/147, `material-editor` 266/252, `class-groups-explorer` 237/228 (→ those four are **non-blank**);
   `activity-mark` 27/25, `share-actions` 147/139, `public-state` 36/33, `portal-view-service` 521/488 (→ **totals**);
   `materials-explorer` 132/124 — **matches neither**, exactly as RV-B states.
4. **§2.4 case counts.** `it(` counts: 56 / 13 / 5 / 2 / 2 — exact (my naive 15 on `access-link-tokens.test.ts` was
   two `.test()` regex calls at `:21,:53`; real `it(` = 13).
5. **Schema/migration facts (R1/B4).** `prisma/schema.prisma:65` = `createdAccessLinks AccessLink[]
   @relation("AccessLinkCreator")`, `:80` = `accessLinks AccessLink[]` (verbatim as RV-B quotes); 6 migration dirs
   (`0_init`…`5_v1_game_events`); `access_links|rate_limit_buckets` occur **15×** in `0_init/migration.sql`;
   `1_add_paused_at/migration.sql:3` is `ALTER TABLE "access_links" ADD COLUMN "paused_at"`. `RATE_LIMITED` present
   at `src/server/http/errors.ts:11` and `contracts/schemas/api-error.v1.schema.json:21`. `RateLimitBucket` hand-written
   references: **0** (grep `src tests scripts` minus `src/generated`). E625 verified at
   `node_modules/next/dist/export/index.js:380-381`; 68 tokens / one `:root` in `src/app/globals.css`; 0 `:root` in
   `portal.module.css`; 37 importers. `scripts/next-target.mjs` job list matches RV-B's line cites exactly
   (`loadEnvConfig:24`, mode injection `:26-30`, `NODE_ENV:33`, `AUTH_DEV_BYPASS:39`, secret blanking `:41-53`), and
   static-asset copying is indeed in `scripts/start.mjs:40-50`, not the wrapper.

---

## 2. Findings register — claim-by-claim adjudication

| ID | Claim (RV-B) | My evidence (file:line / command) | Verdict | Corrected severity |
| --- | --- | --- | --- | --- |
| §0-S1 | Audit carries F1-F12, not F1-F10; F11/F12 absent from plan | `docs/architecture-audit-2026-09-23.md:399` (F11), `:417` (F12); plan has no health-dir/`parseXxxV1`/basePath item | **UPHELD** | MAJOR |
| §0-S2 | Risk register is R1-R9 at `:777-787` | verified verbatim, R1 `:779` … R9 `:787` | **UPHELD** | INFO |
| §0-S3 | "12-21 developer-days near `:769`" | `:769` "Total: roughly **12-21 developer-days** for the whole plan, or ~4-6 days for the first three phases" | **UPHELD** (but see F-09: RV-B omits the second half of the sentence and the `:593` exclusion of R1-R3 acceptance work) | INFO |
| §0-S4 | Budgets at `:744-746`, "new or modified files only" | verified verbatim | **UPHELD** | INFO |
| §0-S5 | Phase 0 "blocks everything" `:595`; `:592` each phase leaves app working | verified verbatim | **UPHELD** | INFO |
| §0-S6 | `docs/implementation/README.md:48-51` makes the audit binding | `:50-51` "Treat its phases 0-3 as the precondition for further slice work." | **UPHELD** | — |
| §0-S7 | "integration / testcontainers / PGlite / disposable appear **nowhere** in the plan (verified by grep)" | `REFACTOR_PLAN.md:198` contains "lack of **integration** tests" | **REFUTED as worded** (substance — no integration work scheduled — holds) | MINOR |
| D1 | Pages demo kept only as adapter; plan reverses the "cost" half and its manifest omits the demo action modules | audit `:793`, `:676-678` verbatim; plan `:19` names "Duplicated Server Actions" as the problem, `:100-101` adopts `"use server"` + "plain function", manifest `:68-75` omits them; files exist at **223** and **154** lines | **UPHELD** (and RV-B's 223/154 beat the audit's stale 207/142 — see §4.3) | MAJOR |
| D2 | Legacy-route deletion honored per Appendix B | plan `:37-45` vs audit `:846-850` — routes match 1:1 | **UPHELD (no finding)** | — |
| D3 | Capability code deleted, table fate undecided → orphan model | surviving readers verified: only `prisma-capability-reader.ts:26,44` + `authorization-service.ts:13,26,202,225` (both deleted); model kept at `prisma/schema.prisma:79,97,245`, enum at `:18`; `Capability` used nowhere else post-purge | **UPHELD**, but the block-quoted sentence is Phase-2 prose `:654-655`, **not** decision D3 (`:795`) — mis-attributed source | MAJOR |
| D4 | Integration-DB decision silently dropped; §7.3's `npm test` proves nothing | plan has zero scheduled integration/DB work (`:198` is prose); R1 unaddressed; audit `:796`, Phase 5 `:704-717` | **OVERSTATED** — real scope loss, but D4 is an **open** decision awaiting a human answer (`:789` header), and this is the same defect re-scored as R13/F-13 | MAJOR (was BLOCKER) |
| D5 | Copy catalogue deferred (fine) but "one module per surface" unenforced | plan `:174` moves copy; §4.1 does create per-screen CSS modules | **UPHELD** (partially satisfied by §4.1 for CSS only) | MINOR |
| D6 | Rate limiting **reversed, unacknowledged** | audit `:798` and `:725-727` quoted verbatim ✓; plan `:83` ✓; 0 code refs ✓ | **OVERSTATED.** (a) `:789` titles section 13 "**Open decisions (need a human answer before Phase 2)**" — D6 is a proposal, not a ratified record; RV-B's "binding artifact" rests on `:6`'s "section 8 needs sign-off", and section 8 is *Target architecture*, not the decision table. (b) plan `:83` is an (implicit) answer. (c) The "half-deletion" argument is double-edged: deleting `RATE_LIMITED` from `contracts/schemas/api-error.v1.schema.json:21` would itself violate audit `:434-435` ("Keep the JSON Schemas as the source of truth") | MINOR (unacknowledged answer) + MAJOR only for the internal union at `src/server/http/errors.ts:11` |
| D7 | "drop `AccessLink` only after confirming…" → gate removed, **REVERSED** | The actual D7 row `:799` reads: "D7 \| `AccessLink` table + `access-link-service.ts` \| delete after Phase 2 \| **Delete.** QR player credentials and class sessions are the V1 sharing model". The "only after confirming" sentence is Phase-2 step 4 prose at `:652-653`. Product evidence that the confirmation would pass is verified: `PRODUCT.md:52-61,:206`; `README.md:44`; `slice-02-player-access-decisions.md:7`; `v1-architecture-plan.md:29` | **REFUTED as a decision reversal** — plan §2.5 (`:79`) *matches* D7 verbatim. What survives is (i) the missing confirmation artifact and (ii) the missing "follow-up migration", both already booked as F-04/R1 | MINOR (was MAJOR/BLOCKER) |
| R1 | Plan *increases* the never-applied-migration risk; `prisma validate` is not a gate on the SQL chain | 6 migrations + `access_links`/`rate_limit_buckets` in `0_init` (15 hits) and `1_add_paused_at:3` verified; plan `:78-83`, `:213-214` schedule DDL edits with no migration task | **UPHELD** | BLOCKER |
| R2 | Contract-freeze-before-`game-host` dropped | plan `:165-171` rewrites the host; the word "contract" in the plan refers only to `src/runtime/contracts.ts` (`:99,:121,:217`) — `src/contracts/v1`, `contracts/schemas`, `contracts/fixtures` appear **nowhere** | **UPHELD** | MAJOR |
| R3 | Offline/two-device behaviour untested; the 728-line test split (the audit's own acceptance signal `:694`) unmentioned | `tests/unit/game-offline-sync.test.ts` = 728 lines, absent from plan | **UPHELD** | MAJOR |
| R4 | No per-family commits, no `runtime/demo/fixtures/` | plan `:210-214`; grep "fixtures" absent from plan | **UPHELD** | MINOR |
| R5 | `service-container.ts` residue breaks typecheck | read the file: `:1` imports `PrismaCapabilityReader`, `:4` imports `AuthorizationService`, both deleted by §2.3, while §2.1.3 (`:35`) names only `PrismaAccessLinkStore`/`AccessLinkService`; `npm run typecheck` = `tsc --noEmit` (`package.json`) and `tsconfig.json:45-54` includes `**/*.ts` → **Day 1's own gate catches it**. Extra fact RV-B missed: post-purge the file's only importers were `atividades/actions.ts` (deleted) and `portal-dev-bypass-actions.test.ts` (deleted) → the correct action is "delete `service-container.ts`", which the plan also omits | **UPHELD** (severity tempered by 4-line fix + gate visibility) | MAJOR |
| R6 | Phase-0 line drops the audit's other 4 steps | plan `:210` vs audit `:597-610` | **UPHELD** | MINOR |
| R7 | No read-validation / key-versioning for localStorage | plan §3.3 `:133-136` = persistence + rollback only | **UPHELD**, but the audit itself scores R7's impact as "Demo feels broken **once**" (`:785`) | MINOR (was MAJOR) |
| R8 | `tests/unit/authorization.test.ts` survives its subject | `tests/unit/authorization.test.ts:9` imports `AuthorizationService` from a §2.3-deleted file; not in §2.4 (`:68-75`) | **UPHELD** — but this is the *same* residue as R5/F-02 counted a second time as its own BLOCKER | MAJOR (deduplicated) |
| R9 | Test-count drop not gated | §2.4 counts verified exact; plan `:232` uses "100% passing" | **UPHELD** | MINOR |
| §2 tail | F6 layering leaks contradicted by plan `:131` | audit `:553` "must not import `@/generated/**`", `:561-563` "largest mechanical change"; plan celebrates "zero file rewrites"; leak measured at **21 files** under `src/components`+`src/application` — identical to RV-B's number | **UPHELD** | MAJOR |
| B1 row | Fixed, E625 real | `node_modules/next/dist/export/index.js:380-381` ✓; plan `:119-125`, `:241` ✓ | **UPHELD** | resolved + MINOR residual |
| B2/B2b rows | 42 is stale pre-purge count; `exclude` doesn't shrink the program | `@/generated/prisma/enums` import lines today = **42** (so "42 surviving" is the pre-purge figure ✓); post-purge I measure **39 files / 42 lines** (any `@/generated/prisma*`) and **36 files / 37 lines** (enums only) → RV-B's "37 files / 43 lines" does **not** reproduce | **UPHELD in direction / UNREPRODUCIBLE in numbers** | MINOR |
| B3 row | Two importers still break the build + AuditEvent writer deleted | all three verified (see R5, F-03) | **UPHELD** | BLOCKER |
| B4 row | Inverse relations fixed; drop migration missing | `:65`/`:80` verified verbatim; `grep -i migrat REFACTOR_PLAN.md` → only `:161` IndexedDB, `:179/:182/:202` Tailwind — **no drop migration anywhere** ✓ | **UPHELD** | BLOCKER |
| B5/M7/M8/M11-a rows | Fixed | `:114-116,:133-136` localStorage ✓; `:166` `game-bridge.ts` 84 lines ✓; `:139-140` wrapper retained + default ✓; `PRODUCT.md:115,117,119` verbatim ✓ | **UPHELD** | — |
| M2 row | "FIXED in substance" | plan `:20` still labels it "TypeScript vs. Turbopack **split-brain**"; the prior review's instruction was "**Fix the diagnosis, not the wording**" (`REFACTOR_PLAN-review-2026-09-23.md:120`), and the actual defect (demo twins never typechecked; drift at `src/runtime/demo-auth-actions.ts:1-7` — 7 lines, no directive, both functions `throw` — vs `entrar/actions.ts:15-16` taking `FormData`) appears **nowhere** in the plan | **REFUTED (mapping too generous)** → PARTIALLY FIXED | MINOR open item |
| M4/M5/M9/M10/M11-b/c/d/e/f rows | as tabulated | spot-checked: `share`/`tokens`/`public-state` manifest entries ✓; `player-access-demo-actions.ts:36` `return { token, tokenHash: token };` ✓ verbatim; `src/proxy.ts:112-117` `/atividade/` branch ✓; `src/server/observability/logger.ts:11` `activityToken` ✓; `tests/unit/{runtime-mode,env,auth}.test.ts` exist and none are in §2.4 ✓ | **UPHELD** (one precision defect, see F-09/M11-d) | — |
| §5.2-7 | `build:server` needs four secrets; no CI job has run it | `next.config.ts:12-19` parses `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `APPLICATION_SECRET` at **config load** when mode=server; `deploy.yml:3-5,:34` runs only `build:demo` | **UPHELD** — and it *contradicts* the prior review's M8 claim ("a standalone server build already succeeds with no `DATABASE_URL`"), which RV-B failed to flag | MAJOR |
| §5.2-8 / F-01 | Header mis-cites the review as "the audit"; audit never cited; "this is how the reversals went unnoticed" | plan `:5` ✓, and the plan's only external citation is `PRODUCT.md:115-119` at `:41` ✓. **But** the cited review transmits the audit's content the plan skipped: D6 at `review:86`, `CapabilityAssignment`+D7 gate at `:179`, R1 at `:88`, budgets at `:132`, 12-21 dev-days at `:145`, the audit's Tailwind refusal at `:20` | **UPHELD as a labeling defect / REFUTED as the causal mechanism** | MINOR (was MAJOR) |
| F-02 | Day 1 cannot typecheck green | R5 + R8 evidence | **UPHELD** | BLOCKER |
| F-03 | Auditoria repointed at a table whose only writer is deleted | `grep -rn 'auditEvent' src tests` (minus `src/generated`) → writes only at `src/server/db/prisma-access-link-store.ts:326` (`recordAudit` `:325`); no `$executeRaw` insert into `audit_events` (the single `$executeRaw` is `prisma-game-state-store.ts:97`, unrelated); `tests/unit/access-link-service.test.ts:273` is a fake double and is itself deleted; no surviving writer exists | **UPHELD** — but see §4.1: the contradiction originates *in the audit*, and RV-B's companion claim that deleting the page is "WRONG as an option" is refuted by audit `:640-641`/`:849` which list deletion as an equally valid branch | MAJOR (was BLOCKER) |
| F-04 | DDL with `prisma validate` as only gate, no drop migration | R1/B4 evidence | **UPHELD** | BLOCKER |
| F-05 | = D6 | see D6 | **OVERSTATED** | MINOR→MAJOR split as above |
| F-06 | = D7 | see D7 | **REFUTED** (as reversal) | MINOR |
| F-07 | Demo duplicated actions + raw-token-as-hash survive the plan | `:223`/`:154` line counts ✓ (and fresher than the audit's); `player-access-demo-actions.ts:36` ✓; `adult-portal-demo-store.ts:278-305` seeds literal `tokenHash` values ✓; plan `:133-136` scope = persistence + rollback only | **UPHELD** | MAJOR |
| F-08 | §7.1 unreachable, contradicts agreed budgets | §1 item 1 above | **UPHELD** | MAJOR |
| F-09 | 3-4 days vs 12-21 dev-days | see §3 | **UPHELD in direction / arithmetic mis-scoped** | MAJOR (was BLOCKER) |
| F-10 | "~1,570 lines of dead CSS" mis-attributed; "52 of 319 classes purge-attributable" | see §4.4 adjudication | **conclusion UPHELD, own evidence UNREPRODUCIBLE** | MAJOR |
| F-11 | §3.2 benefit overstated; 42 stale | §1 item 5 + B2b row; `tsconfig.json:45-54` includes `**/*.ts`, `exclude: ["node_modules"]`; TS re-adds imported files to the program regardless of `exclude` — technically correct | **UPHELD** | MINOR |
| F-12 | No documentation-truth pass; four docs become false | `docs/schemas/database-model.md:84` is the heading "## Access links"; the sentence "`access_links` is **the core new table**" is at **`:86`** (off by 2). `docs/schemas/README.md:3-6` "are current" ✓; `README.md:53` health handlers ✓; `README.md:70` `cp .env.example .env.local` ✓; `walkthrough.md:11` `/atividade/7FQ-29M/` ✓; `:29-32` builder/controls/material-editor ✓; `:41-46` `/portal/atividades/[id]/compartilhar` ✓; `DESIGN.md:250` "a rota alcancada pelo link personalizado e opaco" ✓. Sweep: 42-46 legacy-surface statements across 6 docs (database-model 15, walkthrough 14, DESIGN 6, v1-architecture-plan 5, current-architecture 2, README 0 for those tokens) | **UPHELD and UNDERSTATED** (see §5) | MAJOR |
| F-13 | No verification layer, §7.3 certifies nothing | same root as D4/R3 | **UPHELD (duplicate of D4+R3)** | MAJOR |
| F-14 | Days 2-3 unverified; Pages stays broken mid-sprint | plan `:216-233`: verification lines only at Day 1 (`:214`) and Day 4 (`:229-233`); `deploy.yml:3-5,:34,:41-50` deploys `out/` on every push to `main`, no test job | **UPHELD** | MAJOR |
| F-15 | §10 guardrails omitted | plan `:236-244` has no lint-boundary rule, no ADR, no `typecheck:demo`, no ratchet; audit `:739-754` | **UPHELD** | MAJOR |
| F-16 | Positives (E625, tokens) | `node_modules/next/dist/export/index.js:380-381`; 68 custom properties, 1 `:root` in `globals.css`, 0 in `portal.module.css`, 37 importers | **CONFIRMED** | — |

---

## 3. F-09 independent estimate (labelled: **estimate**, not a measurement)

**Is the comparison apples-to-apples? No — and RV-B neither says so nor corrects for it.** Three deltas:

1. **The audit's 12-21 is a superset.** It includes Phase 5 (2-4, verification), Phase 6 (1-2, config/ops/hygiene)
   and Phase 7 (0.5, docs) — all *absent* from the plan — and, per `:593`, it **excludes** the R1-R3 acceptance
   work. RV-B's own row concedes the omissions but then compares "Phases 1-4 = 7.5-14" to "4 calendar days" as if
   the scopes matched.
2. **The plan's Phase 3 and Phase 4 scopes differ from the audit's in opposite directions.** §3.3 is a *subset* of
   audit Phase 3 (persistence + rollback only; no `runtime/demo/fixtures/`, no issuer hashing, no action-module
   deletion, no state-schema), so charging the full 2-3 days is unfair. §4 is a *superset* of the audit's CSS line:
   RV-E's own judgment estimates §4.1 at **1.5-2 days** and §4.3 at **1-2 days**, i.e. plan Day 3 alone is 4-6
   developer-days.
3. **Headcount is undeclared in both.** "Developer-days" (audit) vs "days" (plan) are only comparable if one
   developer is assumed; the plan never says so.

**My estimate for the plan's literal scope** (Phase 0 subset 0.5-1; Phase 1-as-scoped 1-2; Phase 2-as-scoped
1.5-3; Phase 3-subset 1-1.5; Phase 4 four rows 3.5-5): **≈ 7.5-12.5 developer-days**, i.e. the 3-4 day promise is a
**2.5-3× underestimate** for one developer, and only reachable with ~3 parallel workers *and* with the
verification/guardrail work permanently descoped. Direction confirmed; RV-B's BLOCKER label is not — the
discrepancy is visible in the plan's own text and is caught by its Day-4 gate.

---

## 4. Findings the reviewer got backwards

1. **§4 row 7 / F-03 tail — "`/portal/admin/auditoria` deletion option is WRONG".** The audit itself offers
   deletion as the co-equal branch: `:640-641` "(or **delete the page** and its nav entry)" and Appendix B `:849`
   "**repoint** at `AuditEvent` **or delete**". The plan's §2.1.2 wording mirrors the audit. RV-B grades the plan
   **BLOCKER** for choosing an option the governing document authorized. Only the *conjunction* (repoint + no
   writer left) is defective.
2. **F-03 attribution.** The zero-writer contradiction is **in the audit**, not created by the plan: `:647` deletes
   `prisma-access-link-store.ts` while `:651` says "keep `AuditEvent` (**written by the audit trail**; add the
   reader in step 1)" and `:456` asserts `recordAudit` is its writer. The plan inherited an inconsistent Phase 2.
   RV-B's own §3 cites `:456` and `:651` side by side yet still bills the plan as the origin ("REGRESSED by v2's
   own expansion"), which mis-assigns remediation ownership.
3. **D7 headline.** "D7 — `AccessLink`: drop **only after** confirming…" is not D7. D7 at `:799` says "Delete."
   The gate is Phase-2 prose at `:652`. RV-B quotes the correct D7 row elsewhere (`:799` in its F-06 evidence), so
   its own report contains the refutation of its own heading.
4. **"The audit is the binding decision record" (`:798` "which is the binding artifact").** Section 13's own
   header is "**Open decisions (need a human answer before Phase 2)**" (`:789`). A plan that answers an open
   decision is doing what the audit asked; the defect is at most failure to *record* the answer.
5. **`src/app/(public-play)/jogar/page.tsx:7-12` (M11-d / §4 row 2).** Cited for "`/jogar` **in server mode** still
   renders `gameClient = { status: "missing" }`". Read in place, `:8-11` is the ternary `runtimeMode === "server" ?
   resolveGameClientUrl() : { status: "missing" }` — the *demo* branch is the hardcoded `missing`. Server mode
   returns `missing` only when `GAME_CLIENT_URL` is unset (`src/server/config/game-client.ts:16-18`). Conclusion
   (no GameMaker build exists) is right; the cited line proves the opposite branch.
6. **Duplicate BLOCKERs.** F-02/R5/R8/B3/B3b are two defects (one orphaned container file, one orphaned test file)
   promoted to four BLOCKER-class rows, and D4/F-13/R1 likewise. Counting the distinct blockers on the reviewer's
   own evidence gives **three** (schema-without-migration; orphaned purge residue; no verification layer), not the
   headline impression.
7. **M2 "FIXED in substance"** — see the register row; the plan kept the label the review told it to drop
   ("Fix the diagnosis, not the wording", `review:120`) and never states the real defect.

## 5. Findings the reviewer missed

1. **`docs/schemas/database-model.md` is *already* false, independent of the plan.** It documents **7** tables
   (`:44-52`) while `prisma/schema.prisma` defines **16** models, and `:164` asserts "Play sessions, attempts, and
   results are **intentionally deferred**" although `GameSession:152`, `Participation:167`, `GameState:182`,
   `ResultEvent:196`, `ActiveTimeEvent:216` exist. `docs/schemas/README.md:3-6` nevertheless declares it "current".
   RV-B's F-12 frames the docs problem as "the purge will falsify four docs"; the honest framing is "the doc is
   already falsified, and the purge deepens it" — which changes the size of the Phase-7 task materially.
2. **`service-container.ts` is fully orphaned post-purge** — its only importers are
   `atividades/actions.ts` (deleted) and `portal-dev-bypass-actions.test.ts` (deleted) (verified by grep). So the
   right fix ("delete the file") is simpler than the "clean container imports" step the plan specifies; RV-B
   diagnoses the break but prescribes neither the correct action nor notes it is smaller than stated.
3. **§3.4's `mode.ts` default is a guaranteed test failure, not merely "coupled tests".**
   `tests/unit/runtime-mode.test.ts:10-12` asserts `expect(() => getRuntimeMode({ NODE_ENV: "production"
   })).toThrow()` — i.e. the suite *locks in* the fail-fast behaviour the plan's `:140` wants to replace with a
   default of `server`. RV-B rates M11-e **MINOR**; it is MAJOR (Day 2 breaks `npm test` → §7.3 unfalsifiable) and
   is also the one place where the plan diverges from `src/runtime/mode.ts:7-11` *and* the audit's own
   `:583` without a test-update task.
4. **The audit's own line counts are stale** on the duplication RV-B calls load-bearing: audit `:130-134` says
   205/207/132/142/68/64 lines; measured today: **222 / 223 / 144 / 154 / 80 / 75**. RV-B used fresh numbers
   (223/154 ✓) but never flags that the "binding" document it holds the plan to is itself out of date — which
   weakens any "the plan must match the audit" argument, including its D1 row.
5. **RV-B did not reconcile with the other five v2 reviewers** although it cites `agent-ledger.md`. On F-03 it
   reaches the same conclusion as RV-A:124-126 / RV-D:261 / RV-F:599-608 — four independent agents; the finding is
   corroborated, not novel, and the register should say so. On F-10 it opposes RV-E without engaging RV-E's
   methodology (see §4.4 below), which is the single largest unreconciled conflict in the set.
6. **§7.2/§7.4 interplay:** criterion 4 promises "GitHub Actions automatically tests, lints, typechecks and
   verifies builds on every PR" while §6 Day 1 only wires CI into the existing `deploy.yml` push pipeline
   (`deploy.yml:3-5` triggers on push to `main`, not `pull_request`) — a criterion-vs-step gap RV-B's F-14 touches
   but never names.
7. **RV-B's own counting bug in the §0 table:** it grades "CONFIRMED verbatim" for the 12-21 figure while dropping
   the same sentence's "~4-6 days for the first three phases" — the number that makes the plan's 4-day claim look
   *almost* defensible for a subset, and the one a fair re-review would have to confront.

## 6. Conflict adjudications

### 6.1 F-10 CSS — RV-B ("52 of 319 classes") vs RV-E ("1,263 purge-attributable + 694 orphans")

I rebuilt the measurement independently (stdin-piped Node; comment-stripped CSS; brace-matched rule blocks;
reference sets built from `styles.X` / `styles["X"]` / dynamic `styles[\`…\`]`; purge set = §2.2 route trees +
§2.3's 8 components; survivors = the other 23 importers of `portal.module.css`).

| Metric | RV-B | RV-E | **My measurement** | audit `:111`/`:462` |
| --- | --- | --- | --- | --- |
| Distinct class names in `portal.module.css` | 319 | 315 / 319 | **319** | 308 (matches nothing) |
| Importers | 37 | 37 | **37** | 37 |
| Classes used **only** by the purge set | **52** | 79 | **77** | — |
| Classes referenced by **nothing** | **63** | 63 | **60** | 60 unused |
| Purge-attributable **lines** | not stated | 1,054 + 209 = **1,263** | **1,018 + 232 = 1,250** | — |
| Pre-existing orphan **lines** | not stated | 641 + 53 = **694** | **625 + 48 = 673** | — |
| Union | not stated | 1,915-1,957 | **1,923** | — |
| Purge classes stuck in **mixed** preludes (selector surgery, not block deletion) | not counted | mentioned | **15 blocks** (`portal`) + 3 (`public`) | — |

**Ruling.**
- **RV-E's methodology is sound and reproduces within ~1%.** Its bucket definitions are stated (dead-only, all
  selectors in a rule must be dead, blanks/media braces excluded), its file scope is stated, and a second
  independent implementation lands at 1,250 vs its 1,263 and 673 vs its 694.
- **RV-B's figures are half-reproducible and unit-mismatched.** Its 63 never-referenced classes match RV-E exactly
  (mine 60), but its **52 purge-only classes are reproduced by neither RV-E (79) nor my run (77)** — a ~33%
  shortfall with no disclosed method. More importantly RV-B counts *classes* and then asserts consistency with a
  figure expressed in *lines* ("consistent with the prior review's 875-947 purge-attributable of 1,572-1,611"),
  without ever producing a line count of its own. 52 classes × the file's mean block size cannot yield 875-947, and
  the 875-947 numbers come from the *prior* review, not from RV-B's re-measurement — so F-10's evidence is
  borrowed, and its own contribution is the least reproducible number in the report.
- **Both under-specify, in different directions.** The earlier 947-vs-1,572 dispute (`agent-ledger.md:28-34`) and
  RV-B's class tally share a root flaw: neither fixes, up front, (i) the exact file list that constitutes "the
  purge", (ii) whether a line counts when a rule's prelude mixes dead and live selectors, (iii) physical vs
  non-blank lines, (iv) whether the denominator is one stylesheet or all six modules, and (v) how dynamic
  `styles[\`tone${…}\`]` keys are treated. The 1,570/1,611 and 875/947 spread is mostly these five degrees of
  freedom, not disagreement about the code.
- **Verdict on the underlying defect: RV-B's conclusion is RIGHT, its evidence is WRONG.** `REFACTOR_PLAN.md:150`
  attributes ~1,570 lines to the purge; the purge deletes ~1,250 ±10% and the remaining ~670-690 lines are dead
  **today** and require a usage audit the plan never schedules. That is a real MAJOR mis-attribution, and RV-E
  documents it with the stronger numbers. RV-B should have cited RV-E instead of re-deriving a weaker figure.

**The measurement that would be defensible (and should be pasted into any plan revision):** declare the purge set
as an explicit file list; classify each class as LIVE / PURGE-ONLY / ORPHAN / INDETERMINATE (dynamic-key), with
INDETERMINATE excluded from every total; report three numbers per stylesheet — *fully-dead blocks* (lines
deletable as-is), *mixed-prelude residue* (lines needing selector surgery), and *physical vs non-blank*; run the
reference scan over the stylesheet's own importers only; and state the tool and the version of the tree. On my
application of exactly that spec: `portal.module.css` = 1,018 non-blank purge-deletable + 625 orphan + 15 mixed
blocks; `public.module.css` = 232 + 48 + 3.

### 6.2 D6/D7 — "decision reversal" vs "open decision answered"

Both rows treat section 13 as a signed record. It is labelled "Open decisions (**need a human answer** before
Phase 2)". Reframed correctly: D6 is *answered* by `REFACTOR_PLAN.md:83` (inadmissibly, without naming the
question), and D7 is *answered exactly as recorded* at `:79`. The genuine process defects are (a) no ADR/decision
log (audit `:749-750`), (b) no confirmation artifact for the sharing question, (c) no drop migration. Net effect on
RV-B's scorecard: **F-06 REFUTED, F-05 OVERSTATED, D3 and D4 stand on their own evidence** (orphaned model,
missing verification tier).

### 6.3 M8 (prior review) vs §5.2-7 (RV-B) — who is right about `build:server` and the secrets?

**RV-B, and the audit against the prior review.** `next.config.ts:12-19` validates the four server secrets at
config load, which is precisely audit F11 `:402-404` ("the Docker build needs full runtime secrets at build time").
The prior review's M8 claim that a server build "already succeeds with no `DATABASE_URL`" is true only of the lazy
`server/config/env.ts` path and is defeated by the config gate. RV-B's row is correct; its miss is failing to
notice it was overturning a document it treats as authoritative.

### 6.4 Severity scoreboard after verification

Of RV-B's 16 register entries: **7 upheld as rated** (F-02, F-04, F-07, F-08, F-14, F-15, F-16), **5 upheld but
over-weighted** (F-01, F-03, F-05, F-09, F-13 — MAJOR, not BLOCKER), **2 upheld on borrowed/incorrect evidence**
(F-10, F-12 — the latter understated instead), **1 partially refuted** (F-06), **1 upheld in direction with
non-reproducing numbers** (F-11), **1 refuted as worded** (§0-S7). Distinct true BLOCKERS on this evidence:
**three** — schema DDL without a migration (R1/F-04), purge residue that fails Day 1's own
`typecheck`/`npm test` (R5+R8/F-02), and the self-defeating auditoria/AuditEvent pair (F-03, shared with the audit).

### 6.5 Overall

RV-B is a genuine, largely correct cross-document audit of the plan: the purge-vs-§2.1 contradiction, the missing
drop migration, the missing verification tier, the unreachable §7.1, the D1 cost-half reversal, the
documentation-truth gap and the timeline conflict all reproduce from primary sources, several of them to the digit.
Its weaknesses are (1) quoting Phase-2 prose as if it were the decision table (D3/D6/D7), (2) treating an
explicitly *open* decision register as a binding one, (3) re-scoring one defect as several BLOCKERS, (4) a
mis-sourced header criticism whose causal story its own §3 table refutes, and (5) on the single most important
quantitative conflict (F-10) it presents numbers that neither it nor I can reproduce while a co-reviewer on the
same plan already had the right ones.
