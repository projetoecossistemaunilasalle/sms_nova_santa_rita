# P20: Clean Schema Baseline — Round-2 Dynamic Verification (General)

- **Phase:** P20 (Clean Schema Baseline)
- **Date:** 2026-09-27
- **Base commit:** `9467757ed436c82bdbace5a78e23b502176318e2` (HEAD; entire refactor P00–P50 is one staged working-tree change against it)
- **Reviewer role:** Round-2 dynamic verification agent — ran the runnable gates and recorded real results
- **Toolchain used:** Node `v22.23.1`, npm `11.6.0` (Git Bash on Windows)
- **Toolchain note:** Repo pins Node `24.19.0` / npm `>=11.6.0 <12` (`package.json` `engines`). Executed with Node **22.23.1** — a version discrepancy, recorded per instructions. This matches the dossier's own observation ("the inspected shell uses Node `22.23.1`", IMPLEMENTATION-READY.md line 38–40). npm 11.6.0 is within the pinned range. All P20 gates are version-tolerant (schema validation, codegen, tsc, vitest) and all passed; the discrepancy is environmental, not a defect of the change.

## Command log

| # | Command | Exit code | Key result |
| --- | --- | --- | --- |
| 1 | `npm run prisma:validate` | 0 | `The schema at prisma\schema.prisma is valid` — ran **without** any `DIRECT_URL` prefix; no datasource complaint (Prisma 7.9.1 + `prisma.config.ts` with no CLI datasource validates the schema file alone) |
| 2 | `npm run prisma:generate` | 0 | `✔ Generated Prisma Client (7.9.1) to .\src\generated\prisma in 118ms` — clean regeneration from the new schema |
| 3 | `npm run typecheck:server` | 0 | `gen server && tsc --noEmit --incremental false` — zero errors across the full project |
| 4 | `npm test` | 0 | **28 test files, 200 tests, 200 passed, 0 failed** (vitest run, 2.10s). Suite required **no database** — passes with in-memory adapters / `fake-indexeddb` only |
| 5 | Read `prisma/migrations/0_init/migration.sql` (no execution) | — | All ten named rules verbatim (quoted below); no `gen_random_uuid()`; only surviving tables/enums |
| 6 | `DIRECT_URL="postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder" npm exec -- prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > $TEMP/p20_generated_baseline.sql` | 0 | Read-only schema diff (dummy DIRECT_URL set in-process per runbook pattern). Output: 269 lines, 12 `CREATE TABLE`, 5 `CREATE TYPE`, ten rules **absent**. Temp file written under OS temp dir (outside repo), diffed, then deleted |
| 6b | `diff "$TEMP/p20_generated_baseline.sql" prisma/migrations/0_init/migration.sql` | 1 (expected) | Sole delta: the hand-appended comment block + the ten rule statements (lines 270–289 of 0_init). **Zero other drift** |
| 7 | `rg -n -i "Capability\|AccessLink\|RateLimitBucket\|AuditEvent\|createdAccessLinks\|auditEvents\|scopedCapabilities\|capabilityAssignments\|access_links\|rate_limit_buckets\|audit_events" src tests scripts prisma --glob '!src/generated/**'` | 1 (no hits) | Zero occurrences in all first-party code |
| 8a | `ls prisma/migrations/` | — | Only `0_init/` and `migration_lock.toml` remain; dirs 1–5 deleted (git diff confirms `D` for `1_add_paused_at`, `2_v1_adult_roles_and_classes`, `3_slice_02_player_access`, `4_v1_game_state`, `5_v1_game_events`) |
| 8b | Read `prisma/migrations/migration_lock.toml` | — | `provider = "postgresql"` |
| 8c | Read `docs/schemas/database-model.md` | — | Describes exactly the 12-table / 5-enum schema and the ten named rules |
| S1 | `npm run build:server` (supplementary — P20 acceptance names "both builds") | 0 | Server target build compiles and prerenders |
| S2 | `npm run build:demo` (supplementary) | 0 | Demo target build compiles |

No `prisma migrate dev` / `db push` / `reset` / `deploy` was run; no database connection was attempted; `npm install` / `audit fix` were not run. Only allowed writes occurred: `src/generated` (gitignored, line 27 of `.gitignore`), `.next` build output, temp files under the OS temp dir (cleaned up).

## Verification per P20 item

**Item 1 — Remove `Capability`, `CapabilityAssignment`, `AccessLink`, `RateLimitBucket`, `AuditEvent` from the schema: SATISFIED.**
`prisma/schema.prisma` declares exactly 12 models (ProfessionalProfile, Organization, OrganizationMembership, ClassGroup, PlayerSlot, PlayerCredential, GameSession, Participation, GameState, ResultEvent, ActiveTimeEvent, TeacherAssignment) and 5 enums (RecordStatus, PlatformRole, OrganizationRole, PlayerCredentialStatus, GameSessionStatus). None of the five removed names appear (rg hit count 0, exit 1).

**Item 2 — Remove all inverses (`ProfessionalProfile.createdAccessLinks`/`.auditEvents`, `Organization.scopedCapabilities`/`.accessLinks`, `OrganizationMembership.capabilityAssignments`): SATISFIED.**
The three model blocks were inspected directly: `ProfessionalProfile` has only `memberships`, `Organization` only `memberships`/`classGroups`. A schema-wide sweep for the four removed property names returns nothing.

**Item 3 — Generate new baseline into a temp file, verify, then replace `0_init`, delete dirs 1–5, keep PostgreSQL lock: SATISFIED.**
Re-executed the runbook step (gate 6): `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` produced 269 lines with 12 `CREATE TABLE` + 5 `CREATE TYPE` (non-empty output with expected surviving `CREATE TABLE`s — the runbook's failure condition does not trigger). `prisma/migrations/` now contains only `0_init/migration.sql` (replaced; git shows `M`) and `migration_lock.toml` (`provider = "postgresql"`). Migration directories 1–5 are deleted (git status `D` on all five).

**Item 4 — Preserve the ten database rules with reviewed columns/predicates: SATISFIED.**
All ten statements exist verbatim in `prisma/migrations/0_init/migration.sql` (lines 277–289), each quoted:

1. `ALTER TABLE "player_slots" ADD CONSTRAINT "player_slots_player_number_positive" CHECK ("player_number" > 0);`
2. `ALTER TABLE "game_states" ADD CONSTRAINT "game_states_revision_check" CHECK ("revision" > 0);`
3. `ALTER TABLE "game_states" ADD CONSTRAINT "game_states_protocol_version_check" CHECK ("protocol_version" = 1);`
4. `ALTER TABLE "game_states" ADD CONSTRAINT "game_states_schema_version_check" CHECK ("schema_version" = 1);`
5. `ALTER TABLE "result_events" ADD CONSTRAINT "result_events_duration_ms_check" CHECK ("duration_ms" >= 0);`
6. `ALTER TABLE "result_events" ADD CONSTRAINT "result_events_result_state_check" CHECK ("result_state" IN ('sucesso', 'falha', 'cancelado', 'tempo_esgotado', 'erro_inicializacao'));`
7. `ALTER TABLE "active_time_events" ADD CONSTRAINT "active_time_events_active_ms_check" CHECK ("active_ms" BETWEEN 1 AND 30000);`
8. `ALTER TABLE "active_time_events" ADD CONSTRAINT "active_time_events_mode_check" CHECK ("mode" IN ('exploration', 'dialogue', 'activity'));`
9. `CREATE UNIQUE INDEX "player_credentials_one_active_per_slot" ON "player_credentials"("player_slot_id") WHERE "status" = 'active';`
10. `CREATE UNIQUE INDEX "game_sessions_one_active_per_class" ON "game_sessions"("class_group_id") WHERE "status" = 'active';`

Columns and predicates reviewed: player number positive; revision > 0; protocol/schema version pinned to 1; duration >= 0; result-state domain of five values; active_ms 1..30000; mode domain of three values; both partial unique indexes correctly predicate on `status = 'active'`.

**Item 5 — Rules hand-appended, not generator-emitted: SATISFIED (proven).**
The freshly generated `migrate diff` output contains **none** of the ten names (rg on the temp file: no hits). `diff` of generated output vs. checked-in `0_init` shows the **only** delta is the explanatory comment block plus exactly these ten statements — no historical SQL was copied and no generator-preserved assumptions were made.

**Item 6 — No `gen_random_uuid()` defaults copied: SATISFIED.**
Zero occurrences of `gen_random_uuid()` in `0_init/migration.sql` (grep exit 1). All UUID PKs are bare `UUID NOT NULL` with Prisma `@default(uuid())` at the application layer, matching the spec.

**Item 7 — Validate/generate pass; source sweep clean; docs updated: SATISFIED.**
Gates 1–2 exit 0. Gate-7 sweep over `src/ tests/ scripts/ prisma/` (excluding `src/generated`) returns zero hits for all removed model/enum/property names and their snake_case table names. A broader repo-wide case-insensitive sweep hits only `.md` planning/history documents (`REFACTOR_PLAN.md`, `portal-v1-specification.md`, `docs/agent-reviews/*`, `docs/implementation/*`, dossier-audit docs) — all benign historical references, no live code. `docs/schemas/database-model.md` is rewritten for the post-refactor model: 12 tables in an ER diagram + purpose table, 5 enums, a ten-rule invariant table whose predicates match the migration exactly, single-baseline migration history, and an explicit "Legacy model (superseded)" section. No migration-snapshot test, historical-file immutability test, or generated client-shape test was added (rg for `0_init|migrations` in `tests/`: no hits; `0_init/` contains only `migration.sql`).

## Acceptance criteria (dossier P20)

| Criterion | Status |
| --- | --- |
| Final schema contains 12 models and five enums | Satisfied (counted from `prisma/schema.prisma`) |
| New `0_init` creates only the surviving model/enum set and includes the ten named rules | Satisfied (12 tables + 5 types, ten rules verbatim; diff-vs-generated proves nothing else was added) |
| Prisma validation/generation, typecheck, tests, and both builds pass from clean generated output | Satisfied (`prisma:validate` 0, `prisma:generate` 0, `typecheck:server` 0, `npm test` 200/200, `build:server` 0, `build:demo` 0) |
| No migration SQL snapshot, immutability test, or generated client-shape test added | Satisfied |
| Existing environment recreated from new baseline; no upgrade/rollback path promised | Satisfied (`database-model.md`: baseline replaced, legacy carried over only as historical docs) |

## Findings

| Severity | Finding |
| --- | --- |
| INFO | Gates executed on Node `v22.23.1` instead of the pinned `24.19.0` (npm `11.6.0` is within the pinned range). This is an environment limitation of the verification shell, pre-acknowledged in the dossier's baseline text; every P20 gate still passed. Re-running the four npm-script gates on a Node 24.19.0 shell is a formality, not a code risk. |
| INFO | `npm run prisma:validate` did **not** require the dummy `DIRECT_URL` prefix (ran cleanly without it); only the gate-6 `migrate diff` invocation was prefixed, per the runbook's own pattern. Recorded for runbook fidelity. |

No CRITICAL or MAJOR findings. No MINOR findings.

## Acceptance criteria not satisfied

None.

VERDICT: PASS
