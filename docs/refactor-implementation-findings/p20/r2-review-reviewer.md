# P20 Review — Clean Schema Baseline (STATIC SPEC-COMPLIANCE, Round 2)

**Phase:** P20 — Clean Schema Baseline
**Date:** 2026-09-27
**Base commit:** `9467757` ("docs: finalize refactor implementation runbook") — HEAD
**Method:** Read-only static review. `git status --short`, `git diff --cached -- prisma/ docs/schemas/database-model.md`, `git show 9467757:<path>`, `rg`/`grep` across `src/`, `tests/`, `scripts/`, `docs/`, `.github/`; `Read` on `prisma/schema.prisma`, `prisma/migrations/0_init/migration.sql`, `prisma.config.ts`, `docs/schemas/database-model.md`. No builds, tests, npm, or Prisma commands were run. Nothing under `docs/refactor-implementation-findings/` was read.
**Observed toolchain:** Node `v22.23.1`, npm `11.6.0` (repo pins Node `24.19.0`, npm `>=11.6.0 <12`; the runbook itself notes the inspected shell is 22.23.1 — INFO only, no command was executed under it).

---

## Per-item verification table

| P20 item | Evidence | Satisfied |
|---|---|---|
| **1.** Remove `Capability`, `CapabilityAssignment`, `AccessLink`, `RateLimitBucket`, `AuditEvent` | `prisma/schema.prisma` `grep -cE "^model "` = **12**, `grep -cE "^enum "` = **5**. Models at lines 45/58/72/89/106/123/136/151/166/180/200/214: ProfessionalProfile, Organization, OrganizationMembership, ClassGroup, PlayerSlot, PlayerCredential, GameSession, Participation, GameState, ResultEvent, ActiveTimeEvent, TeacherAssignment. Enums at 10/18/24/31/38: RecordStatus, PlatformRole, OrganizationRole, PlayerCredentialStatus, GameSessionStatus. `git diff --cached -- prisma/schema.prisma` shows `enum Capability` (6 lines) and the four models deleted. | **yes** |
| **2.** Remove all named inverses; no dangling fields; relation pairs consistent | `ProfessionalProfile` (45-56) now ends at `memberships` — `createdAccessLinks`/`auditEvents` gone. `Organization` (58-70) has `memberships`, `classGroups` only — `scopedCapabilities`/`accessLinks` gone. `OrganizationMembership` (72-87) has `professionalProfile`, `organization`, `teacherAssignments` — `capabilityAssignments` gone. Full read: **13** relation scalar fields, **13** inverse list fields, all paired 1:1 (ProfessionalProfile↔OrganizationMembership, Organization↔OrganizationMembership, Organization↔ClassGroup, ClassGroup↔TeacherAssignment, ClassGroup↔PlayerSlot, ClassGroup↔GameSession, OrganizationMembership↔TeacherAssignment, PlayerSlot↔PlayerCredential, PlayerSlot↔Participation, PlayerSlot↔GameState, GameSession↔Participation, Participation↔ResultEvent, Participation↔ActiveTimeEvent). No `@relation("…")` name survives without its partner. | **yes** |
| **3.** Single baseline; delete migrations 1-5; keep `migration_lock.toml` | `find prisma/migrations -type f` → only `0_init/migration.sql` and `migration_lock.toml`. `git status --short`: `M prisma/migrations/0_init/migration.sql`, `D` for `1_add_paused_at`, `2_v1_adult_roles_and_classes`, `3_slice_02_player_access`, `4_v1_game_state`, `5_v1_game_events`. `migration_lock.toml` unmodified and contains `provider = "postgresql"`. No `6_drop_generation_a` on disk. | **yes** |
| **4/5.** Ten named database rules present with correct columns and predicates | `prisma/migrations/0_init/migration.sql:277-289` — full table below. | **yes** |
| **6.** No `gen_random_uuid()` defaults | `grep -n "gen_random_uuid" prisma/migrations/0_init/migration.sql` → no match. All six historical defaults (`class_groups`, `teacher_assignments`, `player_slots`, `player_credentials`, `game_sessions`, `participations`) are now bare `UUID NOT NULL`; verified by scripted diff against the cumulative base history. Only remaining raw-SQL write is `src/server/db/prisma-game-state-store.ts:97-104` (`$executeRaw` INSERT into `game_states`), a table that never had a `gen_random_uuid()` default and supplies `player_slot_id` explicitly, so the removal is safe. | **yes** |
| **7.** `prisma:validate`/`prisma:generate` + first-party source search + `docs/schemas/database-model.md` updated in-phase | `package.json:29-30` defines both scripts. Source search across `src/`, `tests/`, `scripts/` for `Capability|CapabilityAssignment|AccessLink|RateLimitBucket|AuditEvent|createdAccessLinks|auditEvents|scopedCapabilities|capabilityAssignments|access_links|audit_events|rate_limit_buckets|capability_assignments` → **0 hits**. Broader case-insensitive `capabilit|access.?link|rate.?limit|audit|pausedAt|paused_at` → **0 hits**. `docs/schemas/database-model.md` staged (`M`, 240 lines changed) — see item 4 below. | **yes** |
| **Fixed decision 1** — no migration-on-read / compat code for the deleted schema | No `DROP`, `ALTER TYPE … DELETE VALUE`, backfill, or dual-read code anywhere in `0_init` (it is a `--from-empty` baseline; first statement is `CREATE SCHEMA IF NOT EXISTS "public"`). No compat shim in `src/`. | **yes** |
| **Fixed decision 1** — no upgrade/rollback path promised | `docs/schemas/database-model.md:11-13` — "Migration history is a single post-refactor baseline: `0_init` creates the entire surviving schema in one step, and the earlier incremental migrations were replaced rather than kept." `docs/current-architecture.md:144-146` — same. `rg -i "rollback|upgrade|backfill|migration history"` over `prisma/`, `docs/schemas/`, `docs/current-architecture.md`, `README.md` returns only those two baseline statements. No drift/shadow-DB/`migrate diff` CI. | **yes** |
| **Acceptance** — no migration-SQL snapshot, historical-file immutability test, or client-shape test added | `git diff --cached --name-status -- tests/` → only one added file: `tests/unit/clean-build-artifacts.test.ts` (P00). `rg -i "migration|0_init|toMatchSnapshot"` in `tests/` → only `readFileSync` of `contracts/fixtures/v1/*` and `contracts/schemas/v1/*.json` (`tests/unit/v1-contracts.test.ts:31,34`, `tests/unit/game-state-service.test.ts:24`, `tests/unit/game-offline-sync.test.ts:40`). No test reads `prisma/` at all. | **yes** |
| **Item 3 claim** — `prisma.config.ts` mechanism | `prisma.config.ts` (unmodified from base, `git show 9467757:prisma.config.ts` is byte-identical): `import "dotenv/config"; const directUrl = process.env.DIRECT_URL; export default defineConfig({ schema: "prisma/schema.prisma", migrations: { path: "prisma/migrations" }, ...(directUrl ? { datasource: { url: directUrl } } : {}) })`. Exactly the documented shape: CLI datasource present iff `DIRECT_URL` is set, sourced from `DIRECT_URL` and not `DATABASE_URL`. `.env.example:11-12` documents `DIRECT_URL` as "used only by Prisma CLI and deployment migrations". | **yes (static only)** |

---

## The ten database rules — `prisma/migrations/0_init/migration.sql:271-289`

All ten appear in one hand-appended block after the Prisma-generated section, introduced by the comment at lines 271-276. Names and predicates are **byte-identical** to the historical rules (migrations `3_slice_02_player_access` and `4_v1_game_state`, `5_v1_game_events` at base), so the baseline preserves the previously enforced semantics.

| # | Rule | Present | Table | Columns / predicate | Assessment |
|---|---|---|---|---|---|
| 1 | `player_slots_player_number_positive` | yes (`:277`) | `player_slots` | `CHECK ("player_number" > 0)` | Encodes the intended rule. `ClassGroup.nextPlayerNumber` defaults to 1 (`schema.prisma:98`) and increments, so the app never writes ≤ 0. Identical to base `3_slice_02_player_access`. |
| 2 | `game_states_revision_check` | yes (`:278`) | `game_states` | `CHECK ("revision" > 0)` | Correct for storage. Only writers are `prisma-game-state-store.ts:104` (inserts literal `1`) and `:112-118` (`revision: { increment: 1 }`), so ≥ 1 always. Inbound Zod `revisionSchema` (`src/contracts/v1/schemas.ts:20`) permits 0 for `expected_revision` on a new slot, but that value is never persisted. |
| 3 | `game_states_protocol_version_check` | yes (`:279`) | `game_states` | `CHECK ("protocol_version" = 1)` | Matches `z.literal(PROTOCOL_VERSION)` (`schemas.ts:14`) and the hardcoded `1` in the store insert (`:102`) / update (`:114`). |
| 4 | `game_states_schema_version_check` | yes (`:280`) | `game_states` | `CHECK ("schema_version" = 1)` | Matches `stateSchemaVersionSchema = z.literal(STATE_SCHEMA_VERSION)` (`schemas.ts:17`). |
| 5 | `result_events_duration_ms_check` | yes (`:281`) | `result_events` | `CHECK ("duration_ms" >= 0)` | Matches `duracao_ms: nonNegativeIntegerSchema` (`schemas.ts:181`, `nonnegative()` at `:23`). BIGINT column — `prisma-game-event-store.ts:306` coerces with `BigInt(...)`. |
| 6 | `result_events_result_state_check` | yes (`:282-283`) | `result_events` | `CHECK ("result_state" IN ('sucesso','falha','cancelado','tempo_esgotado','erro_inicializacao'))` | Exact set match with `resultStateSchema` (`src/contracts/v1/schemas.ts:171-177`). |
| 7 | `active_time_events_active_ms_check` | yes (`:284-285`) | `active_time_events` | `CHECK ("active_ms" BETWEEN 1 AND 30000)` | Exact match with `active_ms: z.number().int().min(1).max(30_000)` (`schemas.ts:326`). No app-side divergence. |
| 8 | `active_time_events_mode_check` | yes (`:286-287`) | `active_time_events` | `CHECK ("mode" IN ('exploration','dialogue','activity'))` | Exact match with `mode: z.enum([...])` (`schemas.ts:327`). |
| 9 | `player_credentials_one_active_per_slot` | yes (`:288`) | `player_credentials` | `CREATE UNIQUE INDEX … ON "player_credentials"("player_slot_id") WHERE "status" = 'active'` | Predicate is a sound proxy for "not revoked": every code path sets `status` and `revokedAt` together — `prisma-player-access-store.ts:249-256` (`updateMany { status: ACTIVE → REVOKED, revokedAt }` then `create`) and the demo twin at `src/runtime/adult-portal-demo-store.ts:942-945,952-955`. So `status='active'` ⟺ `revoked_at IS NULL`; the index is not defeatable by a `status=ACTIVE, revoked_at≠NULL` row. Matches base `3_slice_02_player_access`. |
| 10 | `game_sessions_one_active_per_class` | yes (`:289`) | `game_sessions` | `CREATE UNIQUE INDEX … ON "game_sessions"("class_group_id") WHERE "status" = 'active'` | Matches `getActiveSession` (`prisma-player-access-store.ts:145`) and `endSession` (`:279-280`, sets `ENDED` + `endedAt`). Matches base `3_slice_02_player_access`. |

---

## Schema ↔ baseline cross-check

Programmatic comparison of the new `0_init` against the **cumulative** base history (`0_init` + `1`…`5` concatenated):

- Tables dropped: exactly `access_links`, `audit_events`, `capability_assignments`, `rate_limit_buckets`. No other table added or removed.
- Columns: the only differences are `professional_profiles.platform_role`, `organization_memberships.role`, `class_groups.next_player_number` — all present in the new `0_init` `CREATE TABLE` (they were `ALTER TABLE ADD COLUMN` in base migrations 2 and 3, so the naive diff reports them as "added"; the effective final shape is identical).
- Type/default differences: **only** the removal of `DEFAULT gen_random_uuid()` from the six UUID primary keys. No other type, nullability, or default changed.
- Table count in SQL = 12; enum count = 5; `@@map` names in `schema.prisma` match the SQL exactly (both sets).
- All 13 FKs are emitted as trailing `ALTER TABLE … ADD CONSTRAINT … ON DELETE RESTRICT ON UPDATE CASCADE`, after every table exists — statement order is valid. 71 distinct object names (tables, types, indexes, constraints, PKs), **zero duplicates**, 12 `_pkey` constraints, 60 `;`-terminated statements.

**Scope correctness:** `git diff --cached -- prisma/schema.prisma` contains only the purge plus Prisma field-alignment whitespace in `ProfessionalProfile`, `Organization`, `OrganizationMembership`, `Participation`, and `GameState`. No surviving model changed a column type, field name, index, unique, or default. No unrelated schema drift.

---

## Findings

### MINOR
None found at this severity for P20.

### INFO

1. **`revision` CHECK vs inbound Zod range differ by one, harmlessly.**
   `prisma/migrations/0_init/migration.sql:278` requires `revision > 0`; `src/contracts/v1/schemas.ts:20` (`revisionSchema`) accepts `0`. The persisted column only ever receives `1` (raw insert, `src/server/db/prisma-game-state-store.ts:104`) or an increment (`:118`), so no request can violate the constraint. This predicate is byte-identical to the pre-refactor rule in base `4_v1_game_state`, so P20 preserved it rather than introducing it. No action required.

2. **Hand-appended rules are, by construction, invisible to `migrate diff`.**
   `0_init:277-289` adds eight CHECK constraints and two partial unique indexes that Prisma does not model. `prisma migrate deploy` applies the script verbatim and is unaffected, and the runbook forbids `migrate dev`/`db push`/`migrate reset` (`IMPLEMENTATION-READY.md:52-53`), so no gate will report drift. This is the intended, spec-mandated design (`IMPLEMENTATION-READY.md:236-238`), but it means the disposable-database release check in "Database and Rollback" (`:486-489` — inspect the catalog for the eight CHECKs and two partial unique indexes) is the *only* verification that these statements are syntactically valid on a real PostgreSQL server. Static review cannot substitute for it.

3. **`prisma.config.ts` still imports `dotenv/config`.**
   `prisma.config.ts:1` — the runbook says to "set `DIRECT_URL` explicitly in the same process … rather than relying on `.env`" (`:481-483`), but the config's `import "dotenv/config"` will populate `DIRECT_URL` from a local `.env` if present. The file is **unchanged from base** (`git show 9467757:prisma.config.ts` is byte-identical), so this is pre-existing behavior outside P20's change set and the described mechanism itself is implemented exactly as documented.

4. **Stale migration path in a dated historical snapshot.**
   `docs/implementation/slice-02-handoff.md:53` still cites `prisma/migrations/3_slice_02_player_access/migration.sql`, which no longer exists. The document self-classifies as a snapshot ("Snapshot: 22 September 2026 … This records the original handoff snapshot"), the runbook demotes `docs/implementation/*` to "requirement or historical evidence, not parallel instructions" (`IMPLEMENTATION-READY.md:5-7`), and no current-guidance document links to it (only `docs/agent-reviews/*` evidence files). Consistent with the P10 acceptance rule that historical documents may describe the former product. Documentation hygiene only.

5. **Observed shell is Node 22.23.1, not the pinned 24.19.0.**
   The runbook requires acceptance on the pinned toolchain (`:39-40`). No command was executed for this review, so this has no bearing on the P20 findings; it is recorded because the P20 acceptance clause "Prisma validation/generation, typecheck, tests, and both builds pass from clean generated output" can only be discharged under the pinned versions.

---

## Acceptance criteria: not satisfied / not statically verifiable

- "Prisma validation/generation, typecheck, tests, and both builds pass from clean generated output" — **not statically verifiable.** The review was read-only by constraint. Mitigating static evidence: `src/generated/prisma/models/` contains exactly the 12 surviving model files and no `CapabilityAssignment`/`AccessLink`/`AuditEvent`/`RateLimitBucket`; `src/generated/prisma/enums.ts` exports exactly the 5 surviving enums — the client was regenerated against the final schema, and `tests/` contain no reference to any removed symbol, so the generated surface is consistent.
- "The baseline applies cleanly to a disposable PostgreSQL database and the catalog shows 8 CHECK + 2 partial unique indexes" — **not statically verifiable.** No database commands were run. The statement order was verified valid by reading (all tables before all FKs; appended rules after both) and identifier uniqueness was verified programmatically.
- "The new `0_init` was produced by `npm exec -- prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`" — **not statically verifiable** (the command was not run). The output shape is consistent with genuine Prisma `--from-empty` generation: canonical `-- CreateSchema` / `-- CreateEnum` / `-- CreateTable` / `-- CreateIndex` / `-- AddForeignKey` comments, Prisma's own 68-char index-name truncation (`organization_memberships_professional_profile_id_organizati_key`, `:184`), and index emission order that differs from schema declaration order — all followed by a single clearly delimited hand-appended block, matching item 5's "append … do not copy a whole historical migration".

No acceptance criterion is **unsatisfied**.

---

**VERDICT: PASS**
