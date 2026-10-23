# VER-C — Adversarial verification of `INV-C-prisma-schema-migration.md`

**Verifier:** VER-C (read-only against the repo; all mutation happened in a scratch copy outside it)
**Date:** 23 September 2026
**Target report:** `docs/refactor-dossier/reports/INV-C-prisma-schema-migration.md`
**Scope verified:** `REFACTOR_PLAN.md` §2.5 (`:77-85`) and §3.2 (`:134-138`)
**Toolchain used:** Prisma CLI 7.9.1 (`node_modules/prisma/package.json` → `"version": "7.9.1"`), TypeScript 6.0.3, shell Node **v22.23.1** (repo pins 24.19.0 at `package.json:6`) — same skew the target report declares, so numbers are comparable but neither set is the pinned-runtime baseline.

**Hard-constraint compliance.** No repo file other than this report was created, modified or deleted; `git status --porcelain` before and after my run differs only by this file inside the already-untracked `docs/refactor-dossier/`. No `migrate dev`, no `db push`, no `prisma generate`, and **no command connected to or wrote any database**: every `--from-migrations` / `migrate status` probe was run with env-overridden URLs pointing at `127.0.0.1:5`/`:6` (no listener) so the process died at the config/pre-connect stage. Schema edits were made to copies under `%TEMP%/ver-c` (`C:\Users\Vitor\AppData\Local\Temp\ver-c`), which is outside the working tree and is deliberately left in place so the commands below can be replayed.

**Headline:** the report's blocker is real and I reproduced it byte-for-byte; its drop SQL is exactly right; and its *conclusion* (hand-author migration 6, never `migrate dev`) is the right one. But **three of its supporting numbers are wrong and two of its mechanisms are wrong**, including the single sentence it uses as its recommendation's justification ("11 hand-written CHECK constraints … would be silently destroyed"). The corrected justification is *stronger*, not weaker — see §Recommended migration procedure.

---

## Verdict table

| # | Claim in `INV-C` | Verdict | My evidence (method stated) |
| --- | --- | --- | --- |
| C1 | §2.5 lists only 3 of the 4 required schema deletions; omitting `OrganizationMembership.capabilityAssignments` (`prisma/schema.prisma:97`) makes `prisma validate` fail with `P1012` | **CONFIRMED** | Built a schema edited *exactly* per §2.5 (delete `:18-28`, `:65`, `:79-80`, `:245-280`, `:299-310`) → 248 lines → `npx prisma validate --schema …/plan_literal.prisma` → `Error code: P1012 … Type "CapabilityAssignment" is neither a built-in type… --> plan_literal.prisma:83`, `Validation Error Count: 1`, exit 1. Adding `:97` → 247 lines → `The schema … is valid 🚀`, exit 0. The report's line number (83), error text, count and both exit codes are exact |
| C2 | There is no 5th required deletion / no further inverse-relation residue | **CONFIRMED (exhaustive)** | Token sweep of the corrected schema for `AccessLink\|CapabilityAssignment\|Capability\|RateLimitBucket\|rateLimit\|accessLink\|scopedCapab\|capabilityAssign\|createdAccessLinks` → **0 matches**; plus a program-level set-diff of all object names in `prisma/migrations/**` against `migrate diff --from-empty --to-schema corrected.prisma --script` → the purge removes exactly `{capability type, capability_assignments, access_links, rate_limit_buckets}` + their 4 FKs/5 indexes/5 raw CHECKs and nothing else. No surviving `@@index`/`@@unique`/enum member references any dropped object |
| C3 | "`:97` … **Not previously reported**"; prior reviews mention `capabilityAssignments` "in passing … never as a §2.5 omission | **OVERSTATED (partly WRONG)** | `docs/agent-reviews/refactor-plan-v2/RV-B-cross-document-consistency.md:67-70` literally says the plan "never mentions the surviving `model CapabilityAssignment` (`prisma/schema.prisma:79`, **`:97`**, `:245`)". The *line* was already reported; what is genuinely new is (a) the executed `P1012` proof, (b) that v2.1 now lists two of the three and (c) the gate-ordering consequence. RV-D's `:47` "the schema has exactly three non-self references to `AccessLink`, all three of which are listed" is quoted accurately by INV-C — and is itself wrong (there are **two**: `:65`, `:80`; RV-D's own table counts 4 tokens including the model declaration) |
| C4 | Migration 6 = the 8 quoted statements (report says "24 lines / 8 statements"); `--exit-code` = 2 on non-empty | **CONFIRMED (SQL), WRONG (line count)** | Reproduced independently: `npx prisma migrate diff --from-schema <git HEAD schema> --to-schema <corrected> --script -o …/migration6.sql` → **byte-identical** to the report's listing, **8 statements**, **23 lines** (not 24; `cat -n` in the log). `--exit-code`: empty diff → 0, non-empty → 2 |
| C5 | `DROP TYPE "capability"` is safe (6 values, 4 of them non-link) | **CONFIRMED by analysis** | The type has exactly one consumer in the whole chain: `0_init:50 "capability" "capability" NOT NULL` inside `capability_assignments`, which is dropped two statements earlier. Repo-wide `grep -rn 'ALTER TYPE' prisma/migrations` → 0 hits, so no historical value churn. The 4 non-link values (`results:view_organization`, `organization:manage`, `user:manage`, `audit:view`) appear in no surviving column and no surviving code reader (see *Capability-enum* section) |
| C6 | The SQL preserves `AuditEvent` | **CONFIRMED** | No statement in the emitted script names `audit_events`; `--from-empty --to-schema corrected.prisma` still renders `CREATE TABLE "audit_events"` + its 3 indexes + `audit_events_actor_id_fkey`. `schema.prisma:66` (`ProfessionalProfile.auditEvents`) correctly survives |
| C7 | Add a "row-retention pre-flight" `DO $$ … RAISE EXCEPTION` guard so the drop is auditable | **OVERSTATED** | There is **no database, therefore no rows**: `.env:2,5,8` are `ep-example…` / `user:password` placeholders (verified by pattern match only, values not read out), and the audit records the same at `docs/architecture-audit-2026-09-23.md:39,75,779` (R1). The guard can never fire in the only environment that exists, and if it ever did fire it would leave `_prisma_migrations` with a **failed** row requiring `prisma migrate resolve` to unstick — a cost the report does not mention. Keep it as a commented-out block, not as live SQL (see final procedure) |
| C8 | No FK-ordering problem: no surviving table has an FK pointing at a dropped table | **CONFIRMED (all pairs, not just the named ones)** | Enumerated every `fields: [...], references: [...]` pair in `prisma/schema.prisma` (13 on surviving models: memberships→{profiles,orgs}, class_groups→orgs, teacher_assignments→{memberships,class_groups}, player_slots→class_groups, player_credentials→player_slots, game_sessions→class_groups, participations→{game_sessions,player_slots}, game_states→player_slots, result_events→participations, active_time_events→participations, audit_events→profiles) — every target survives. The 3 dropped tables are FK **sources** only (`0_init:144,147,150,153`). So `DROP TABLE` alone succeeds and the 4 `DROP CONSTRAINT` lines are cosmetic |
| C9a | 11 hand-written CHECK constraints **on surviving tables** are invisible to the datamodel | **WRONG (count = 8)** | My recount, two ways. (i) Named-`*_check` scan of `prisma/migrations/*/migration.sql`: 13 CHECK constraints exist, 5 of them on dropped tables (`access_links` ×3 `0_init:163,166,169`; `rate_limit_buckets` ×2 `:172,175`) → **8 on surviving tables**: `player_slots_player_number_positive` (`3:15`), `game_states_revision_check`/`_protocol_version_check`/`_schema_version_check` (`4:12,13,14`), `result_events_duration_ms_check`/`_result_state_check` (`5:18,19`), `active_time_events_active_ms_check`/`_mode_check` (`5:42,44`). (ii) Name-level set-diff of chain objects vs `--from-empty --to-schema corrected.prisma`: exactly 10 unmodeled *named* objects = those 8 + the 2 partial uniques. **The report's own drift table lists those same 8 rows and then states 11** — self-contradiction, repeated 4× (headline, recommendation, risk 2, option E) |
| C9b | 2 partial unique indexes invisible to the datamodel | **CONFIRMED (count), LIKELY-WRONG (consequence)** | Count: `3:56 player_credentials_one_active_per_slot`, `3:58 game_sessions_one_active_per_class` (report cites `:59`, which is the non-partial `participations_game_session_id_player_slot_id_key`). Consequence: the 7.9.1 schema engine carries a `StrippedPartialIndexes` bit-flag (see C9d) — Prisma removes partial indexes from the compared AST precisely so that its diff cannot drop them |
| C9c | 6 `gen_random_uuid()` defaults invisible to the datamodel | **CONFIRMED (count and mechanism)** | Count: `2:47`, `2:60`, `3:8`, `3:20`, `3:31`, `3:43` (the report cites `2:46,:65` and `3:10,:23,:33,:43` — **5 of 6 line cites are wrong**; only `3:43` is right). Mechanism **proved offline**: `migrate diff --from-schema <@default(dbgenerated("gen_random_uuid()"))> --to-schema <@default(uuid())> --script` → `ALTER TABLE "foos" ALTER COLUMN "id" DROP DEFAULT;`. So a declarative diff genuinely destroys all 6 PK defaults |
| C9d | Therefore `migrate dev` "would silently destroy" the CHECKs / would "offer to drop" them | **WRONG for CHECKs; UNSURE-to-WRONG for partial uniques; CONFIRMED for the 6 defaults** | Extracted the schema engine's complete migration-step vocabulary from `node_modules/@prisma/engines/schema-engine-windows.exe` (`tr -c '[:print:]' '\n'` then string extraction): it contains `AddColumn/DropColumn/AlterColumn/AddForeignKey/DropForeignKey/AddPrimaryKey/DropPrimaryKey/RenamePrimaryKey/CreateIndex/DropIndex/RenameIndex/RedefineIndex/CreateTable/DropTable/CreateEnum/DropEnum/AlterEnum/CreateView/DropView/DropTrigger/CreateExtension/DropExtension/DropUserDefinedType/DropSequence/DropNonEmptyTable`, and the human-readable diff renderer's `[-]/[*]` phrases. **There is no check-constraint step of any kind**, and the introspection result struct has a `check_constraints` field plus a `StrippedPartialIndexes` flag — i.e. CHECKs and partial indexes are read out of the way and restored, not diffed. `migrate dev` cannot emit `DROP CONSTRAINT` for the 8 CHECKs. (Cannot be 100 % closed without a shadow DB, which I was forbidden to use, hence the confidence grading.) |
| C9e | Conclusion: hand-author migration 6, never `migrate dev` | **CONFIRMED (right answer, wrong reason)** | The real disqualifiers are independent of the drift list: (1) `migrate dev` requires a live `DIRECT_URL` **and** a shadow database — neither exists here; (2) it auto-applies and offers a **reset** on history divergence (engine has a `DropNonEmptyTable` step) → the one path to destroying data; (3) **`migrate dev` / `--from-migrations` would emit 6 `DROP DEFAULT`** (C9c, proved), after which hand-inserted rows — including the `AUTH_DEV_BYPASS` fixture the plan itself needs — fail with a NOT-NULL violation. Reason (3) is the honest version of the report's reason |
| C10 | `--to-schema-datamodel` was removed in Prisma 7 and `--from-migrations` is not offline (needs a shadow DB); RV-D's recipe is therefore invalid | **CONFIRMED (verbatim, both errors)** | `npx prisma migrate diff --from-migrations … --to-schema-datamodel …` → "`--to-schema-datamodel` was removed. Please use `--[from/to]-schema` instead."; `… --to-schema …` → "Error: You must set `datasource.shadowDatabaseUrl` in your `prisma.config.ts` if you want to diff a migrations directory." `--help` lists only `--from-empty/--to-empty/--from-schema/--to-schema/--from-migrations/--to-migrations/--from-config-datasource/--to-config-datasource/--script/--exit-code/-o/--config/--help` — there is **no** `--shadow-database-url` flag in 7.9.1, so option E's CI gate needs a *new* `prisma.config.ts` key, which the report never says |
| C11 | Baselines: 6 migrations + `migration_lock.toml` + `schema.prisma` all tracked; `4_`/`5_` added by `c149374`; Day 0's "commit 30 untracked files + migrations 4 & 5" is already done; VV-A's "4 tracked" superseded | **CONFIRMED (except "clean tree")** | `git ls-files prisma` → 8 files (all of them); `git log --diff-filter=A` → `4_v1_game_state`/`5_v1_game_events` added by **`c149374`** (`0_init`,`1_add_paused_at`,`schema.prisma`,`migration_lock.toml` by `baa5cd1`; `2_` by `06baea2`; `3_` by `5bc2467`); `git show HEAD:prisma/schema.prisma` is byte-identical to the working copy. VV-A `:55`'s "4 tracked" is indeed stale. **"working tree clean / 0 untracked" is now false**: `git status --porcelain` → `?? docs/refactor-dossier/` (the dossier itself). Any Day-0 baseline must be re-recorded after that dir is committed |
| C12 | Nothing was ever applied → no `_prisma_migrations` checksum conflict; only unproven history (R1) | **CONFIRMED** | `.env:2,5,8` are the canonical `ep-example`/`user:password` placeholders; `prisma validate` runs with no connection (measured); audit `:39` "No migration has been applied to a real Neon database", `:75`, R1 `:779`. Chain total = **386 SQL lines** (`cat */migration.sql \| wc -l`) and per-file lines `175/3/82/60/15/51` match the report's inventory exactly. Note the audit's own `:75` says "5 migrations" — there are 6; INV-C cites it approvingly |
| C13 | 13 of the 19 `api-error` codes have no emitter post-purge, so deleting only `RATE_LIMITED` is incoherent | **CONFIRMED (independent recount agrees exactly)** | Method: for each of the 19 literals in `contracts/schemas/api-error.v1.schema.json:15-35`, list files under `src/` (excluding `src/generated/`) containing the quoted string, then intersect with the §2 deletion manifest (`§2.2` route trees, `§2.3` services/stores/components, `§2.4` tests). Surviving emitters = **6**: `AUTHENTICATION_REQUIRED` (`game-state-route.ts`), `FORBIDDEN`, `VALIDATION_FAILED`, `CONFLICT` (`game-event-route.ts`, `game-state-route.ts`), `INTERNAL_SERVER_ERROR` (`route.ts`), `SESSION_EXPIRED` (`game-event-route.ts`, `game-state-route.ts`). Dead = the report's 13, identical list. `RATE_LIMITED` was dead **even before** the purge (its only non-declaration occurrence is the `case` at `atividades/actions.ts:181`, a consumer) |
| C14 | `api-error.v1.schema.json` is outside `contractSchemasV1` and loaded by no test | **CONFIRMED + strengthened** | `src/contracts/v1/schemas.ts:440-458` = **17** entries, `api-error` absent; `tests/unit/v1-contracts.test.ts:32-38` resolves only `contracts/schemas/v1/${name}.v1.schema.json`, and the file lives one level up. New: the **only** occurrence of the string `api-error` anywhere in `src/ tests/ scripts/ contracts/` is the file's own `$id` (`:3`) — it is not generated by any Zod schema either, despite `contracts/schemas/README.md:4-7` asserting "These JSON Schemas are generated from the same Zod shapes and parity-tested with every committed fixture". It is an unenforced hand-written orphan, which makes the report's "published contract" framing too generous |
| C15 | §3.2 measurement: 24 → 22 generated files in program, 1,706 → 1,703 total, the 2 leavers are `browser.ts` + `internal/prismaNamespaceBrowser.ts` (444 lines), all 24 are `.ts` and all carry `@ts-nocheck`, so `skipLibCheck` is irrelevant, 0 errors either way | **CONFIRMED, digit-for-digit** | `tsc -p tsconfig.json --noEmit --incremental false --listFilesOnly` → **1,706** files, **24** from `src/generated`. Out-of-tree `{"extends": "<repo>/tsconfig.json", include: <absolute restate>, exclude: [node_modules, src/generated]}` → **1,703** files, **22** from `src/generated`; `comm` shows exactly `browser.ts` (99) + `internal/prismaNamespaceBrowser.ts` (345) = **444**. `find src/generated -type f \| sed 's/.*\.//' \| sort \| uniq -c` → `24 ts`; `grep -rl @ts-nocheck src/generated \| wc -l` → **24**; `wc -l` total → **29,722**; `tsc` errors **0** in both configurations. Also independently verified from Next's own source: `node_modules/next/dist/lib/typescript/writeConfigurationDefaults.js:349` is `if (!('exclude' in userTsConfig))` → Next cannot fight this edit |
| C16 | Cold `tsc`: 6.79 s → 6.42 s (report itself admits "single sample, i.e. within noise") | **WRONG (direction unsupported)** | 3 alternating samples per config, `--incremental false` so no buildinfo is read or written: BASE 6911/6746/6773 ms (median **6.77 s**), EXCLUDED 6851/6953/6717 ms (median **6.85 s**). Ranges overlap entirely (6.72-6.95 both sides) and the sign is *reversed*. The honest number is **Δ ≈ 0 s**, and it should not be recorded as a baseline at all. (Method soundness: `incremental:false` does defeat `tsconfig.tsbuildinfo` reuse — I confirmed the on-disk `tsconfig.tsbuildinfo` is untouched — but OS file-cache warmth still explains ±150 ms) |
| C17 | "§3.2's '42 surviving' (`REFACTOR_PLAN.md:138`) mis-states a pre-purge total as a surviving count" | **WRONG (mis-attributed)** | `grep -n '\b42\b' REFACTOR_PLAN.md` → **no matches**; `REFACTOR_PLAN.md:138` actually reads "…without touching **30+ files**". The "42 surviving imports" quote belongs to plan **v2.0 `:131`** (quoted by `RV-B:166` of the prior review) and was corrected out of v2.1. My own recount: 42 files use `from "@/generated/prisma/enums"`, **43** including the dynamic `await import("@/generated/prisma/enums")` at `atividades/actions.ts:122`; 5 of them are in the §2 purge set (the report's "4 deleted" list omits `atividades/actions.ts`) → **38 survive**, which is the report's number and is right; "30+ files" is therefore *true*. The surviving half of this finding — that `:138`'s "stops TypeScript from scanning the 29,722 lines" is false — I confirm |
| C18 | "Required gate ordering: … `REFACTOR_PLAN.md:219` omits `prisma generate` between validate and typecheck … the Day-1 body at `:213-214` sequences validate→typecheck" | **WRONG — the plan already does what the report demands** | `REFACTOR_PLAN.md:219` is verbatim: `└── Verify Day 1 gate: prisma validate && prisma generate && npm run typecheck && npm test`. `:218` is `Update schema.prisma & generate migration 6_drop_generation_a`. `:213` is a blank line and `:214` is "Prune status-badge.tsx" — the `:213-214` text the report (and VV-D row L5, which it inherits) quotes as the Day-1 gate no longer exists in v2.1. Risk 8's *hazard* is real (see C19), but the "the plan mis-orders its own gate" finding is stale |
| C19 | Stale-client window is real: nothing in the local chain regenerates the client, `tsc` cannot distinguish schema states, `.dockerignore` lacks `src/generated` | **CONFIRMED** | `grep -n prisma scripts/next-target.mjs` → 0 hits; `package.json:26` `postinstall: prisma generate`, `:25 prisma:generate`, and `npm run check` (`:24`) = `format:check && lint && typecheck && test` — **no generate**, so `npm run check` after a schema edit validates the pre-purge client (`models/AccessLink.ts` 1,711 lines, `CapabilityAssignment.ts` 1,492, `RateLimitBucket.ts` 1,221 all on disk now); `git ls-files src/generated` → 0 and `.gitignore:27` `/src/generated/prisma`; `.dockerignore` = `.git .github .next coverage node_modules *.log .env* !.env.example` → no `src/generated`; `Dockerfile:7-8` generates into the **dependencies** stage, `:11` copies only `/app/node_modules`, `:12 COPY . .` → a clean host yields no client and `npm run build` fails loudly. Report's diagnosis and fix are both right |
| C20 | `RateLimitBucket` = 0 code refs; `AuditEvent`'s sole writer is `prisma-access-link-store.ts:325-326`; no seed anywhere; `AUTH_DEV_BYPASS` needs a hand-inserted `ProfessionalProfile` with id `00000000-0000-4000-8000-000000000001` | **CONFIRMED ×4** | `grep -rIn -e RateLimitBucket -e rateLimitBucket -e rate_limit src tests scripts contracts \| grep -v ^src/generated` → **0**. `auditEvent.create` appears exactly once repo-wide, at `prisma-access-link-store.ts:326` inside `recordAudit` at `:325`; every other `auditEvent`/`recordAudit` hit is in `access-link-service.ts` (9), `portal-view-service.ts:373,416` (fixture), `auditoria/page.tsx:4,54,56`, `tests/unit/access-link-service.test.ts` or a CSS class name in `portal.module.css` — all deleted by §2.2/§2.3/§2.4. `find . -iname '*seed*'` outside `node_modules` → nothing; `prisma.config.ts` has no `seed` key. `src/server/auth/dev-bypass-gateway.ts:9-13` hard-codes the UUID; `src/runtime/adult-portal-server.ts:16-18` → `getAdultPortalService().getShell(await profileId())` → `src/application/adult-portal/service.ts:118 requireActor(await reader.getActor(profileId))` → `prisma-adult-portal-store.ts:117 professionalProfile.findUnique({ where: { id: profileId } })`, so a missing row yields `null` → rejected. Note `professional_profiles.id` has **no DB default** in `0_init:12` (client-side `@default(uuid())`), so a fixture must supply the id literally |
| C21 | "Free win": the 3 purged models are 4,425 lines (14.9 %) of generated output; §7.1's ratchet "still trips over 16 generated files >400 lines after the purge" | **CONFIRMED (14.9 %), WRONG (both counts)** | `wc -l` → 1,711 + 1,492 + 1,221 = **4,424** (= 14.88 %), not 4,425. Generated files >400 lines: **18 today → 15 after** the purge, not 16. (Also low-value as stated: §7.1's ratchet is scoped to "new or modified files" and `src/generated` is gitignored, so a diff-based ratchet probably never sees them — add the exclusion anyway, it costs one line) |
| C22 | Post-edit schema = 247 lines; 16 models → 3 purged / 13 survive; `:65`, `:79`, `:80` cites in §2.5 are exact | **CONFIRMED** | Built file → 247 lines and valid. Model count by `grep -c '^model '`: 16 → 13. Line-by-line read of `schema.prisma` confirms `:65 createdAccessLinks`, `:79 scopedCapabilities`, `:80 accessLinks`, `:97 capabilityAssignments`, `:18-27 enum Capability`, `:245-259`, `:261-279`, `:300-310` |
| C23 | "0_init = generated then hand-edited; 5 hand-appended raw blocks at `:158-175`" / "the 5 raw CHECKs and 2 raw indexes of `0_init:158-175`" | **OVERSTATED** | `:158-175` contains **6** raw blocks: 1 `CREATE UNIQUE INDEX … NULLS NOT DISTINCT` + 5 `ADD CONSTRAINT … CHECK`. There is **one** raw index there, not two (the other `access_links`/`rate_limit_buckets` indexes at `:117,120,123,135` are Prisma-generated and die with their tables anyway). Substance unaffected |
| C24 | The datamodel→datamodel diff is *sufficient* for this drop because migration 6's drift set is empty | **CONFIRMED (rigorously)** | Name-level set-diff, surviving tables only (78 objects): unmodeled drift **before** the purge = 10 named objects (8 CHECKs + 2 partial uniques) + 6 column defaults; **after** the purge = the identical 10. The only name that moves into the set is `capability`, which migration 6 itself drops. So §2.5 introduces **zero** new drift on surviving tables, and `--from-schema/--to-schema` loses nothing versus `--from-migrations` — *provided* the implementer does not let Prisma regenerate the whole declarative state (see the 6 `DROP DEFAULT`s) |
| C25 | Prisma-7-CLI validity of everything the dossier tells an implementer to type | **WRONG (2 of the report's own commands are not runnable)** | (a) Validation-gates step 3: `DATABASE_URL=postgresql://… npx prisma migrate deploy` — `prisma.config.ts:5,11` only sets `datasource.url` from **`DIRECT_URL`**, so `DATABASE_URL=` on the command line is ignored. Proved: with `DIRECT_URL=…127.0.0.1:5` and `DATABASE_URL=…127.0.0.1:6`, `migrate status` errors against **port 5**; with only `DATABASE_URL` overridden, Prisma reached for the `…neon.tech` host in `.env`. As written, the command either fails at DNS or — the moment `.env` holds a real branch — **applies migration 6 to the shared Neon branch**. (b) `POSTGRES_PASSWORD=***` is a redaction artifact pasted into a command an implementer is told to run. Both fixed in §Recommended migration procedure |
| C26 | Coupling table's purge-set claims (`createdAccessLinks`/`scopedCapabilities` 0 code refs; 24 `accessLink` hits in the store; `Capability` importers all deleted; 0 `capabilit` outside the purge set) | **CONFIRMED, with one omission** | `grep -c accessLink src/server/db/prisma-access-link-store.ts` → **24** ✓. `createdAccessLinks`/`scopedCapabilities`: schema-only ✓. All 22 files referencing `AccessLink` are inside §2.2/§2.3/§2.4 ✓ (I checked each against the manifest) → "import graph closes cleanly" holds. `capabilit` in `src/` hits exactly 5 files (`atividades/actions.ts`, `prisma-capability-reader.ts`, `access-link-service.ts`, `authorization-service.ts`, `service-container.ts`) — **all** deleted, so 0 outside the purge set ✓. Omission: `src/server/services/service-container.ts` (imports `PrismaCapabilityReader` at `:1`, wires `new AuthorizationService(new PrismaCapabilityReader())` at `:19`) never appears in the coupling table even though it is the composition root; it is deleted by §2.1.2/§2.3 so no action is needed, but a table whose stated purpose is "can the purge leave a dangling reference" should have named it |
| C27 | `docs/schemas/database-model.md` staleness debt; audit citation accuracy (R1 `:779`, `:652`, `:711`, D6 `:798`, `:456`, `:725`, `.gitignore:27`, `eslint`/`.prettierignore`, `tsconfig.json:6`) | **CONFIRMED by spot-check** | `docs/schemas/README.md:3-6` does declare `database-model.md` "current" while `database-model.md:49,50,52` still list `capability_assignments`/`access_links`/`rate_limit_buckets` and `:86` still says "`access_links` is the core new table". Audit lines 39/75/456/652/711/725/779/798 all say what the report reports. `.gitignore:27`, `eslint.config.mjs:15`, `.prettierignore:3`, `tsconfig.json:6 skipLibCheck` ✓ |

---

## Reproduction log (exact commands)

Git Bash on Windows, run from `C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal`. Scratch root `S=/c/Users/Vitor/AppData/Local/Temp/ver-c` (outside the repo). Every command is read-only against the repo; the only writes are under `$S`.

```bash
S=/c/Users/Vitor/AppData/Local/Temp/ver-c
REPO=/c/Users/Vitor/Desktop/Vinicius/Projetos/SMS_Portal
rm -rf "$S"; mkdir -p "$S"
cp -r "$REPO/prisma" "$S/prisma"          # schema + all 6 migrations + lock
# prisma.config.ts is NOT copied: --schema overrides the config's `schema:` key,
# and `npx` still resolves the CLI from the repo's node_modules (run from $REPO).
cd "$REPO"

# 0. baseline, unchanged
npx prisma validate                       # -> "The schema at prisma\schema.prisma is valid"
git show HEAD:prisma/schema.prisma > "$S/base.prisma"; diff "$S/base.prisma" prisma/schema.prisma   # identical
wc -l prisma/schema.prisma prisma/migrations/*/migration.sql   # 310 ; 175 3 82 60 15 51 (=386)
cat prisma/migrations/*/migration.sql | wc -l                  # 386

# 1. BUILD the two edited schemas (1-based inclusive line deletes)
#    §2.5 literal  = drop 18-28 (enum+blank), 65, 79-80, 245-280 (2 models+blank), 299-310
#    corrected     = the same, plus 97
node -e 'const fs=require("fs");const src=fs.readFileSync("prisma/schema.prisma","utf8").split(/\r?\n/);
const del=r=>{const k=new Set();for(const[a,b]of r)for(let i=a;i<=b;i++)k.add(i);
return src.filter((_,i)=>!k.has(i+1)).join("\n")};
fs.writeFileSync(process.env.S+"/plan_literal.prisma",del([[18,28],[65,65],[79,80],[245,280],[299,310]]));
fs.writeFileSync(process.env.S+"/corrected.prisma",del([[18,28],[65,65],[79,80],[97,97],[245,280],[299,310]]));' \
  S="$S"      # plan_literal = 248 lines, corrected = 247 lines

# 2. THE BLOCKER (and its fix)
npx prisma validate --schema "$S/plan_literal.prisma"   # P1012 at line 83, count 1, exit 1
npx prisma validate --schema "$S/corrected.prisma"      # valid, exit 0
grep -nE 'AccessLink|CapabilityAssignment|Capability|RateLimitBucket' "$S/corrected.prisma"   # 0 hits = no 5th deletion

# 3. THE DROP SQL, authored from the datamodel (no DB)
npx prisma migrate diff --from-schema "$S/base.prisma" --to-schema "$S/corrected.prisma" \
    --script -o "$S/migration6.sql"        # 23 lines / 8 statements, byte-identical to INV-C's listing
npx prisma migrate diff --from-schema "$S/base.prisma" --to-schema "$S/corrected.prisma" \
    --script --exit-code >/dev/null; echo $?            # 2  (non-empty)
npx prisma migrate diff --from-schema "$S/base.prisma" --from-schema "$S/base.prisma" \
    --script --exit-code >/dev/null; echo $?            # 0  (empty)

# 4. PRISMA 7 CLI REALITY (read-only; no DB reached)
npx prisma migrate diff --help                                    # flags: --from/to-schema, --from/to-migrations,
                                                                  #  --from/to-config-datasource, --script, --exit-code, -o
npx prisma migrate diff --from-migrations prisma/migrations \
    --to-schema-datamodel "$S/corrected.prisma" --script          # "`--to-schema-datamodel` was removed."
npx prisma migrate diff --from-migrations prisma/migrations \
    --to-schema "$S/corrected.prisma" --script                    # "You must set `datasource.shadowDatabaseUrl`
                                                                  #  in your `prisma.config.ts` if you want to diff
                                                                  #  a migrations directory."   (needs no DB to say it)

# 5. WHICH ENV VAR DECIDES WHERE `migrate deploy` GOES  (bogus closed ports; nothing listens)
DATABASE_URL="postgresql://u:p@127.0.0.1:6/wrong" DIRECT_URL="postgresql://u:p@127.0.0.1:5/right" \
    npx prisma migrate status 2>&1 | grep -o '127\.0\.0\.1:[0-9]*'          # -> 127.0.0.1:5  (DIRECT_URL wins)
env -u DIRECT_URL DATABASE_URL="postgresql://u:p@127.0.0.1:6/wrong" \
    npx prisma migrate status 2>&1 | grep -oE 'neon\.tech|127\.0\.0\.1:[0-9]*'  # -> neon.tech (.env placeholder)

# 6. DRIFT RECOUNT: what the migration chain has that the datamodel cannot express
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma   --script > "$S/from_empty_current.sql"
npx prisma migrate diff --from-empty --to-schema "$S/corrected.prisma"  --script > "$S/from_empty_corrected.sql"
grep -c 'gen_random_uuid\|check (\|WHERE \|NULLS NOT DISTINCT' "$S/from_empty_current.sql"   # 0 -> all unmodeled
grep -rn 'CONSTRAINT "[a-z0-9_]*check"' prisma/migrations      # 13 total, 8 on surviving tables
grep -rn 'gen_random_uuid' prisma/migrations                   # 6, all surviving-table ids (2:47,2:60,3:8,3:20,3:31,3:43)
grep -rn 'WHERE' prisma/migrations | grep CREATE               # 2 partial uniques (3:56, 3:58)
# then the name-level set-diff (surviving tables only): before = 10, after = 10, new drift = 0

# 7. PROVE the `migrate dev` default hazard, DB-free
printf '%s\n' 'generator client {' '  provider = "prisma-client"' '  output   = "./gen"' '}' '' \
 'datasource db {' '  provider = "postgresql"' '}' '' 'model Foo {' \
 '  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid' '  n  Int' '' '  @@map("foos")' '}' \
  > "$S/def_from.prisma"
sed 's/@default(dbgenerated("gen_random_uuid()"))/@default(uuid())/' "$S/def_from.prisma" > "$S/def_to.prisma"
npx prisma migrate diff --from-schema "$S/def_from.prisma" --to-schema "$S/def_to.prisma" --script
#   -> ALTER TABLE "foos" ALTER COLUMN "id" DROP DEFAULT;     (the 6 real hazards)

# 8. ENGINE STEP VOCABULARY (why CHECKs are NOT at risk)
E=node_modules/@prisma/engines/schema-engine-windows.exe
tr -c '[:print:]' '\n' < "$E" > "$S/engines.txt"
grep -oE "(\[-\]|\[\+\]) [A-Za-z \`_.]{2,60}" "$S/engines.txt" | sort -u   # no "check constraint" anywhere
grep -oE "contype.{0,60}"                      "$S/engines.txt" | sort -u   # "contype NOT IN ('p','u','f')"
grep -oE ".{0,70}[Ss]tripped?.{0,90}"          "$S/engines.txt" | sort -u   # "<StrippedPartialIndexes>BitFlags<TableProperties>"

# 9. §3.2 MEASUREMENT
npx tsc -p tsconfig.json --noEmit --incremental false --listFilesOnly > "$S/files_base.txt"
wc -l < "$S/files_base.txt"; grep -c 'src.generated.prisma' "$S/files_base.txt"      # 1706 ; 24
node -e '/* write $S/tsconfig.noexclude-gen.json: {"extends":"<repo>/tsconfig.json",
        include:[absolute restate of base include], exclude:["<repo>/node_modules","<repo>/src/generated"]} */'
npx tsc -p "$S/tsconfig.noexclude-gen.json" --noEmit --incremental false --listFilesOnly > "$S/files_excluded.txt"
wc -l < "$S/files_excluded.txt"; grep -c 'src.generated.prisma' "$S/files_excluded.txt"  # 1703 ; 22
#   comm of the two generated lists -> browser.ts + internal/prismaNamespaceBrowser.ts (99 + 345 = 444)
npx tsc -p tsconfig.json --noEmit --incremental false                      # 0 errors (both configs)
for f in src/generated -name '*.ts' ... ; do : ; done
find src/generated -type f | sed 's/.*\.//' | sort | uniq -c               # 24 ts
grep -rl '@ts-nocheck' src/generated | wc -l                               # 24
# timings: node -e spawn loop, 3 samples each -> BASE median 6.77 s, EXCLUDED median 6.85 s (no effect)

# 10. CODE-SIDE SWEEPS
grep -rIn -e RateLimitBucket -e rateLimitBucket -e rate_limit src tests scripts contracts | grep -v '^src/generated'   # 0
grep -rIn -e auditEvent -e AuditEvent -e recordAudit src tests | grep -v '^src/generated'
find . -path ./node_modules -prune -o -iname '*seed*' -print
grep -rn 'from "@/generated/prisma/enums"' src tests scripts | wc -l   # 42 files; 43 including the dynamic import
for c in <19 codes>; do grep -rIl "\"$c\"" src --include='*.ts*' | grep -v '^src/generated'; done   # emitter map
git ls-files prisma; git log --diff-filter=A --oneline -- prisma/migrations/4_v1_game_state prisma/migrations/5_v1_game_events
```

No scratch file was placed inside the repo, and `git status --porcelain` still shows only `?? docs/refactor-dossier/` plus this report.

---

## Additional deletions or residue the report missed

**There is no 5th schema deletion.** I swept in both directions and the sweep is closed:

1. **Forward** (surviving model → dropped thing): the only three relation touch-points of `CapabilityAssignment` are `:79`, `:97`, `:245-259`; of `AccessLink` `:65`, `:80`, `:261-279`; of `RateLimitBucket` none (relation-free, `@@id @map("bucket_key")`). §2.5 lists 2 of the first set and both of the second → `:97` is the whole gap. A token grep of the corrected file returns **0** occurrences of `AccessLink|CapabilityAssignment|Capability|RateLimitBucket`, and `prisma validate` passes.
2. **Enum members**: `Capability` is named only at `:248` (`capability Capability`), inside the dropped model. No surviving column, no surviving `@default(Capability.…)` — and the surviving enums (`record_status`, `platform_role`, `organization_role`, `player_credential_status`, `game_session_status`) are untouched, which is why all 38 surviving enum-importing files need no edit.
3. **`@@index`/`@unique`**: the only index naming a dropped field is `CapabilityAssignment:@@index([scopeOrganizationId, capability])` at `:257`, gone with the model. `OrganizationMembership` keeps `@@unique([professionalProfileId, organizationId])` and `@@index([organizationId, status])`, both of which stay valid.
4. **SQL side**: name-level set-diff of the migration chain against the corrected datamodel render produces **zero** new unmodeled objects on surviving tables (drift is 10 named objects before *and* after).

**Residue *outside* `schema.prisma` that the report under-states or misses:**

| # | Item | Why it matters |
| --- | --- | --- |
| R-1 | **`prisma.config.ts` has no `datasource.shadowDatabaseUrl`** (`:6-11` sets `schema`, `migrations.path`, and `datasource.url` only) | The report's workflow option E ("CI gate as a shadow-DB job") is not merely "DEFER", it is **unrunnable** until that key is added; and option C step 7 must not forget it. Also `migrations.path: "prisma/migrations"` means the relative form in the report's commands is right |
| R-2 | **`DIRECT_URL`, not `DATABASE_URL`, is what `prisma migrate deploy` will connect with** (proved, §Reproduction log step 5) | The report's step-3 command as written sends the whole `0→6` chain to the placeholder Neon host — or, once `.env` is real, to the shared branch. This is the highest-severity thing I found after the `:97` blocker |
| R-3 | **`src/server/services/service-container.ts`** imports `PrismaCapabilityReader` (`:1`) and wires `new AuthorizationService(new PrismaCapabilityReader())` (`:19`) | Deleted by §2.1.2/§2.3 so no new action, but it is the capability composition root and the coupling table's "0 `capabilit` outside the purge set" claim only holds because of it — the table should name it |
| R-4 | **`api-error.v1.schema.json` is referenced by nothing but its own `$id`** | The report defends it as "the live shape of the four `/api/v1/player/*` error responses" (true by *behaviour*, via `errors.ts:46-63`) but as an *artifact* it is an unenforced hand-written orphan whose own directory README claims it is generated + parity-tested. That weakens the report's "published contract — do not touch piecemeal" argument and tilts Day 1 toward option (a) (leave bytes alone, add one prose line) |
| R-5 | **`professional_profiles.id`, `organizations.id`, `organization_memberships.id`, `audit_events.id`, `result_events.id`, `active_time_events.id` have NO DB default** (`0_init:12,24,36,75`; `5:2,31`) while 6 other tables DO (`gen_random_uuid()`) | Any dev fixture / seed the plan writes must pass ids explicitly for those six, and a `migrate dev`-generated `DROP DEFAULT` makes the remaining six behave the same way. Cheap to state, easy to trip over |
| R-6 | **Optional hardening nobody proposed**: switch the 6 drifting columns to `@default(dbgenerated("gen_random_uuid()"))` | That makes the datamodel *match* the applied chain for those columns (diff then renders no change, proved by the reverse of step 7 in the log), permanently removing the only genuinely destructive `migrate dev` hazard. Out of §2.5's scope, needs its own validation + `prisma generate`; do not bundle it into migration 6 |
| R-7 | **`docs/schemas/database-model.md` prose at `:86`** ("`access_links` is the core new table") plus rows `:49,:50,:52` and index/CHECK rows `:151-156` | The report lists these as risk 13 but §2.5 still has no doc step, and `docs/schemas/README.md:3-6` self-declares the file *current* — so it is the one DB doc a new engineer will trust |

---

## Recommended migration procedure (final)

Corrections to INV-C's option C in **bold**. Same shape, right flags, right env var, honest numbers.

```bash
# 1. Baseline snapshot of the pre-edit schema (migration 6 must be diffed against this,
#    NOT against the edited file — an implementer cannot re-derive it after step 2).
mkdir -p /tmp/sms && git show HEAD:prisma/schema.prisma > /tmp/sms/base.prisma

# 2. Edit prisma/schema.prisma — EIGHT deletions, not seven:
#      :18-27  enum Capability
#      :65     ProfessionalProfile.createdAccessLinks
#      :79     Organization.scopedCapabilities
#      :80     Organization.accessLinks
#      :97     OrganizationMembership.capabilityAssignments   <-- NOT IN §2.5
#      :245-259 model CapabilityAssignment
#      :261-279 model AccessLink
#      :300-310 model RateLimitBucket
#    KEEP :66 ProfessionalProfile.auditEvents and :281-298 model AuditEvent (§2.5.5).
#    Result: 247 lines.

# 3. Gate the schema BEFORE authoring SQL.
npx prisma validate                    # catches the :97 omission as P1012 (demonstrated)

# 4. Author, do not generate: datamodel -> datamodel diff (fully offline, no DB, no shadow DB).
npx prisma migrate diff --from-schema /tmp/sms/base.prisma --to-schema prisma/schema.prisma \
    --script -o prisma/migrations/6_drop_generation_a/migration.sql
#    -> exactly 8 statements / 23 lines: 4 DROP CONSTRAINT, 3 DROP TABLE, DROP TYPE "capability".
#    Do NOT use `migrate dev` (needs a real DB + shadow DB, auto-applies, offers a reset, and
#    emits 6 ALTER COLUMN DROP DEFAULT — the proven hazard) and do NOT use `db push`
#    (writes no file, so §2.5.6 cannot be satisfied).

# 5. Pre-flight, recorded honestly:
#    - INV-C's row-retention DO-block guard cannot fire in this repo (no database has ever
#      existed) and would strand `_prisma_migrations` with a failed row needing `migrate resolve`.
#      Ship it COMMENTED OUT, plus a header comment naming the two deliberate losses
#      (`NULLS NOT DISTINCT` uniqueness, `0_init:163,166,169` CHECKs).
#    - Because nothing was ever applied, there is no checksum/P3005/P3006 conflict: editing
#      `0_init` is still free today. If the team ever prefers a single squashed `0_init`
#      (INV-C option i), it must re-append 8 CHECKs + 2 partial uniques + 6 defaults — the
#      exact lists in this report. Keep sequential history (INV-C's option ii) as recommended.

# 6. Regenerate the client, then and only then run type gates.
npm run prisma:generate
rm -rf .next .next-demo-dev tsconfig.tsbuildinfo
npm run typecheck && npm test

# 7. Prove the chain (this is what discharges audit R1) — DIRECT_URL, not DATABASE_URL:
docker run -d --name sms-pg -e POSTGRES_PASSWORD=devpw -e POSTGRES_DB=sms -p 55432:5432 postgres:16
DIRECT_URL="postgresql://postgres:devpw@localhost:55432/sms" npx prisma migrate deploy
DIRECT_URL="postgresql://postgres:devpw@localhost:55432/sms" npx prisma migrate status
#    -> 6 migrations applied, "in sync". Postgres >= 15 is required by `NULLS NOT DISTINCT`
#       (0_init:160); PG 16 satisfies it. Confirm the Neon branch's PG major before step 8.

# 8. Only now point anything at a real branch, and only after step 7 is green.
```

Day-1 checklist deltas worth writing into §2.5: (a) the `:97` line, (b) a "no `migrate dev`/`db push` in this repo" line, (c) `RUN npx prisma generate` in the Docker **builder** stage (and add `src/generated` to `.dockerignore`) — INV-C is right that this outranks §3.2, (d) one sentence stating that `audit_events` has **no writer** from Day 1 until V1 audit lands, so no compliance claim may be made, (e) `src/generated/**` in §7.1's ratchet exclusion list (15 files >400 lines after the purge), and (f) `RATE_LIMITED`: drop the model and the `errors.ts:11` union member, and **leave `contracts/schemas/api-error.v1.schema.json` untouched on Day 1** with a one-line note that the Portal HTTP error enum is a legacy V0 artifact outside `contractSchemasV1` whose 13 dead members get narrowed as a single `api-error.v2` change. INV-C's "defer, and do not do it piecemeal" is right; its option (b) is the eventual correct end-state, and my R-4 finding (nothing references the file at all, and it is not generated from Zod) makes deferral cheaper, not riskier.

---

## Claims that did not survive

1. **"11 hand-written CHECK constraints … on surviving tables"** — the true number is **8** (13 in the repo, 5 of them dying with the dropped tables). The report's own drift table enumerates those same 8, so this is an internal contradiction, and the figure is load-bearing: it appears in the one-sentence recommendation, in risk 2 and in the justification for rejecting option E. Method: named-`*_check` scan of all 386 SQL lines + an independent name-level set-diff against the rendered datamodel.
2. **"…that `migrate dev` would silently destroy"** — for CHECK constraints this is **wrong in mechanism**: Prisma 7.9.1's schema engine has no check-constraint step at all in its create/drop vocabulary, and its introspection carries a `check_constraints` field, i.e. CHECKs are stepped around rather than diffed. The 2 partial uniques are in the same class (`StrippedPartialIndexes` bit-flag). Only the **6 `gen_random_uuid()` defaults** are provably destroyed — which I demonstrated offline with a `dbgenerated` ⇄ `uuid()` diff. The report's recommendation survives on this narrower, provable basis plus `migrate dev`'s DB/shadow-DB/reset requirements.
3. **"`prisma generate` is missing from the Day-1 gate / the plan sequences validate→typecheck at `:213-214`"** — `REFACTOR_PLAN.md:219` already reads `prisma validate && prisma generate && npm run typecheck && npm test`. This is an inherited, now-stale criticism (it was VV-D's L5 against an earlier plan revision) and it produced the report's entire "the ordering *is* the finding" framing of §Validation gates. What the plan really lacks is a cache/`tsbuildinfo` wipe and any `migrate deploy` step.
4. **"`REFACTOR_PLAN.md:138`'s '42 surviving' mis-states a pre-purge total as a surviving count"** — the plan contains no "42" anywhere; `:138` says "30+ files", which is true (38 enum importers survive). INV-C refutes a number from plan v2.0.
5. **The timing improvement (6.79 s → 6.42 s)** — my 3-sample medians are 6.77 s vs 6.85 s with fully overlapping ranges; the effect is zero and the sign is reversed. INV-C flagged its own single sample as noise but still recorded both numbers as dossier baselines; they should be struck.
6. **"24 lines" of drop SQL** — 23 as emitted by `-o`. Also **4,425 → 4,424** generated lines removed, **">400-line generated files after the purge: 16 → 15"**, and the drift table's `4_…:13,:14,:15` / `5_…:19,:20` / `5_…:44,:45` / `2_…:46,:65` / `3_…:10,:23,:33` / `3_…:56,:59` line cites are off by one or two in **7 places** (the counts they support are right).
7. **"working tree clean, 0 untracked"** — `git status --porcelain` currently returns `?? docs/refactor-dossier/`. Trivially caused by the dossier itself, but it is a *baseline* claim and it is no longer true.
8. **"Not previously reported" (`:97`)** — `RV-B:67-70` already lists `prisma/schema.prisma:79, :97, :245` as schema touch-points §2.5 "never mentions". The novelty is the executed `P1012` proof and the v2.1 re-scoping, not the line itself.
9. **"`0_init:158-175` = 5 raw blocks / 2 raw indexes"** — it is 6 blocks: 1 raw unique index + 5 raw CHECKs.
10. **The row-retention guard is presented as needed** — with no database in existence it can only ever fire on a hypothetically hand-loaded one, and its failure mode (a `failed` row in `_prisma_migrations` that blocks `migrate deploy` until `migrate resolve`) is not mentioned.
11. **Two of INV-C's own commands are not valid on this toolchain** — `DATABASE_URL=… npx prisma migrate deploy` connects via `DIRECT_URL` instead (proved), and `POSTGRES_PASSWORD=***` is a redaction placeholder pasted into a runnable command. Both would send Day-1's first real DB write to the wrong target.

**Unchanged and load-bearing:** the `:97` blocker (C1), the closed deletion set (C2/C8/C24), the exact 8-statement SQL (C4), `DROP TYPE "capability"` safety (C5), the Prisma-7 flag removals and shadow-DB requirement (C10), the git/migrations/env baselines (C11/C12, minus "clean"), the 13-dead-code recount and the `contractSchemasV1` isolation (C13/C14), all of §3.2's structural measurements (C15), the coupling table (C26) and the four small code claims (C20).

---

## Answer on the Capability-enum privilege question

**Dropping `enum Capability` is not a privilege regression. Deferral is not required on security grounds.**

The question posed was whether `RESULTS_VIEW_ORGANIZATION`, `ORGANIZATION_MANAGE`, `USER_MANAGE` and `AUDIT_VIEW` still have a reader in surviving code. Method: literal scan for all eight spellings (PascalCase member names and their `@map` string values `'results:view_organization'`, `'organization:manage'`, `'user:manage'`, `'audit:view'`) across `src/ tests/ scripts/ contracts/` excluding `src/generated/`.

* The four non-link values appear in **exactly one file**, `tests/unit/authorization.test.ts` (32 matching lines), which §2.4 deletes.
* In **production code no call site ever names a non-link capability**. The complete set of `Capability` request sites is `LINK_VIEW`/`LINK_MANAGE` only: `access-link-service.ts:269,328,386,444,500,539,580,667,685` and `(professional)/portal/atividades/actions.ts:129,137,148` — both files deleted by §2.3/§2.2.
* `authorization-service.ts` treats capabilities generically (`KNOWN_CAPABILITIES = Object.values(Capability)` at `:66`, `canUse/assertCanUse/resolveEffectiveScope`), and `prisma-capability-reader.ts` reads whatever rows exist. Neither names the four values, and **both are deleted by §2.3**. `service-container.ts:19`, the only wiring of that reader, is deleted by §2.1.2.
* **No surviving file under `src/app/(professional)/portal/admin/**` touches capabilities at all.** The live admin screens (`equipe`, `organizacoes`, `organizacoes/[id]`) resolve through `src/server/authorization/v1-policy.ts` (85 lines, `Capability` count **0**; imports only `OrganizationRole`, `PlatformRole`, `RecordStatus` at `:1-5`) and `src/application/adult-portal/service.ts:11` / `player-access/service.ts:2`, which call `canManageOrganizations`, `canManageOrganizationStaff`, `canManageClasses`, `canAccessClass`. Note the file is at `src/server/authorization/v1-policy.ts`, not `src/application/...`.
* Post-purge, `grep -c capabilit` over `src/` returns hits in **5 files, all five in the §2 deletion set** — i.e. zero surviving references.
* And the decisive empirical point: the capability rows that would have been revoked **do not exist**. No migration has ever been applied (`docs/architecture-audit-2026-09-23.md:39,75,779`), `.env:2,5` are placeholders, and there is no seed file anywhere in the repo. `capability_assignments` has never held a row on any database this product owns, so `DROP TABLE capability_assignments` deletes zero grants.
* The one place where the four values *could* have mattered — `2_v1_adult_roles_and_classes/migration.sql:13-41`, which promotes holders of `organization:manage`/`user:manage` into `platform_admin` / `organization_admin` — is a data migration that runs against empty tables in the `0→6` deploy, and it is preserved either way because we keep sequential history.

**Audit R5 ("deleting `AccessLink`/`CapabilityAssignment` can lock admins out") is therefore void for this repository**, and INV-C's coupling table reaches the same conclusion (`:232`). What survives of R5 is a *prose* obligation: §2.5.3's parenthetical "all consumers deleted; V1 authorization uses `v1-policy.ts`" is correct and should be strengthened to say explicitly that (1) equivalence between the four dropped capabilities and the role model is `ORGANIZATION_ADMIN`/`PLATFORM_ADMIN` per `v1-policy.ts:46-66`, and (2) if a database is ever provisioned **before** migration 6 ships, the `2_…:13-41` promotion must be re-run and the capability rows exported first — that is the only state in which this drop could cost anyone access, and it is exactly the state INV-C's (commented-out) retention guard was meant to detect.
