# P20 Verification — Clean Schema Baseline (general review)

Date: 2026-09-26. Verifier: independent read-only pass over the working tree at
branch `main` (uncommitted P10+P20 changes). Node v24.19.0. Evidence re-run by the
verifier; no builds executed (already green per implementer: typecheck, 187 tests,
both builds).

## Scope verified

1. **Schema diff** (`git diff prisma/schema.prisma`) — exactly 83 deleted lines,
   0 insertions. Removed: `enum Capability` (6 mapped values),
   `model CapabilityAssignment`, `model AccessLink`, `model AuditEvent`,
   `model RateLimitBucket`, and the three inverse pairs
   `ProfessionalProfile.createdAccessLinks`/`.auditEvents`,
   `Organization.scopedCapabilities`/`.accessLinks`,
   `OrganizationMembership.capabilityAssignments`. Nothing else touched.
   Final `prisma/schema.prisma`: **12 models** (ProfessionalProfile, Organization,
   OrganizationMembership, ClassGroup, PlayerSlot, PlayerCredential, GameSession,
   Participation, GameState, ResultEvent, ActiveTimeEvent, TeacherAssignment) and
   **5 enums** (RecordStatus, PlatformRole, OrganizationRole,
   PlayerCredentialStatus, GameSessionStatus). Grep of the schema for
   capability/accesslink/audit/ratelimit: clean. Confirmed.

2. **`prisma/migrations/0_init/migration.sql`** (read in full, 290 lines):
   - Exactly **12 `CREATE TABLE`** and **5 `CREATE TYPE`** statements, all
     surviving names; zero occurrences of `capability`, `access_link`,
     `audit_event`, `rate_limit` (grep: no hits). The historical
     `capability_assignments ... NULLS NOT DISTINCT` raw index disappears with its
     table — nothing of it needed preserving. Confirmed.
   - **Ten appended rules present (lines 277–289), after the generated content**
     (last generated statement is the `teacher_assignments` foreign key at line
     268; a comment header at 271–276 precedes the block). Predicates compared
     verbatim against the historical migrations:
     | Rule | New SQL (line) | Historical source | Match |
     | --- | --- | --- | --- |
     | `player_slots_player_number_positive` | `CHECK ("player_number" > 0)` (277) | `3_slice_02_player_access` | yes |
     | `game_states_revision_check` | `CHECK ("revision" > 0)` (278) | `4_v1_game_state` | yes |
     | `game_states_protocol_version_check` | `CHECK ("protocol_version" = 1)` (279) | `4_v1_game_state` | yes |
     | `game_states_schema_version_check` | `CHECK ("schema_version" = 1)` (280) | `4_v1_game_state` | yes |
     | `result_events_duration_ms_check` | `CHECK ("duration_ms" >= 0)` (281) | `5_v1_game_events` | yes |
     | `result_events_result_state_check` | `IN ('sucesso','falha','cancelado','tempo_esgotado','erro_inicializacao')` (282–283) | `5_v1_game_events` | yes |
     | `active_time_events_active_ms_check` | `BETWEEN 1 AND 30000` (284–285) | `5_v1_game_events` | yes |
     | `active_time_events_mode_check` | `IN ('exploration','dialogue','activity')` (286–287) | `5_v1_game_events` | yes |
     | `player_credentials_one_active_per_slot` | unique on `("player_slot_id") WHERE "status" = 'active'` (288) | `3_slice_02_player_access` | yes |
     | `game_sessions_one_active_per_class` | unique on `("class_group_id") WHERE "status" = 'active'` (289) | `3_slice_02_player_access` | yes |
     All column lists, comparison operators, value lists and `WHERE "status" =
     'active'` partial predicates preserved verbatim. Confirmed.
   - **No `gen_random_uuid()` anywhere** (grep: no hits). The six historical
     defaults (`class_groups`, `teacher_assignments` in migration 2;
     `player_slots`, `player_credentials`, `game_sessions`, `participations` in
     migration 3) were not copied; ids are plain `UUID NOT NULL` filled by
     Prisma `@default(uuid())`. Confirmed.
   - Appended block is coherent PostgreSQL (`ALTER TABLE ... ADD CONSTRAINT ...
     CHECK`, `CREATE UNIQUE INDEX ... WHERE`) on already-created tables/columns.
     Confirmed.

3. **Migration directory state**: `git status` shows `M
   prisma/migrations/0_init/migration.sql` and staged `D` for migration dirs 1–5
   (`1_add_paused_at`, `2_v1_adult_roles_and_classes`, `3_slice_02_player_access`,
   `4_v1_game_state`, `5_v1_game_events`). On disk only `0_init/` and
   `migration_lock.toml` remain; the lock file has no diff (untouched, PostgreSQL
   provider preserved). Confirmed.

4. **Generated client** (`src/generated/prisma`): `models/` contains exactly the
   12 surviving model files; grep of the whole `src/generated` tree for
   `Capability|AccessLink|AuditEvent|RateLimitBucket|createdAccessLinks|
   auditEvents|scopedCapabilities|capabilityAssignments|accessLinks`: no hits.
   `enums.ts` exports exactly the 5 enums. No stale removed-name files. Confirmed
   regenerated.

5. **First-party source grep** (src/, tests/, scripts/, contracts/ excluding
   src/generated): zero hits for `CapabilityAssignment|AccessLink|RateLimitBucket|
   AuditEvent`, all six capability enum values, and all inverse field names; a
   broader case-insensitive sweep for capability/access-link/audit-event/
   rate-limit-bucket wording also returns nothing. The modified tests
   (`auth.test.ts`, `proxy.test.ts`) contain no removed-model references.
   Confirmed.

6. **`docs/schemas/database-model.md`** (updated in-phase, M in git status):
   documents the 12-table reality (ERD + table table), the 5 enums with values,
   the baseline-as-single-`0_init` migration story, and a ten-row rules table
   whose names, tables and predicates match `0_init` exactly (including
   `BETWEEN 1 AND 30000`, the five `result_state` values, the three `mode`
   values, and both `status = 'active'` partials). No Capability/AccessLink/
   AuditEvent/RateLimitBucket content remains — the "Legacy model (superseded)"
   section refers to the older portal-v1 catalogue/activities design, not
   Generation-A. Internally consistent. Confirmed.

7. **No new prohibited tests**: untracked files are `.github/workflows/ci.yml`,
   `scripts/clean-build-artifacts.{mjs,d.mts}`, `tests/unit/clean-build-artifacts.test.ts`
   (all P00 scope) and `docs/refactor-implementation-findings/`. No test file
   references `migration`, `0_init`, `schema.prisma` or `gen_random_uuid`
   (grep over tests/: no hits). No migration SQL snapshot, historical-file
   immutability, or generated client-shape test exists. Confirmed.

8. **Validation and config**: `npm run prisma:validate` re-run by the verifier on
   Node v24.19.0 — passes ("The schema at prisma\\schema.prisma is valid").
   `prisma.config.ts` and `.env.example` are tracked and unchanged; `.env` is
   gitignored and untouched (mtime predates the phase); no DIRECT_URL change was
   persisted (the dossier requires the dummy URL only in-process). `package.json`
   diff adds only `clean:build` and `prisma:validate` scripts (P00 scope).
   Confirmed.

## Findings

No discrepancies found. Every P20 change-set item and acceptance criterion was
independently confirmed; none required a false-alarm dismissal.

Informational (not a defect): the working tree also carries P00/P10 changes
(Generation-A route/service deletions, CI workflow, clean-build script, baseline
record). This is expected — the dossier allows P10 and P20 in one PR so code and
schema disappear atomically — and was excluded from this phase's scope.

## Verdict

**P20 satisfied: YES.** Final schema is 12 models / 5 enums; the new `0_init`
creates only the surviving set, carries the ten named rules verbatim, and copies
no `gen_random_uuid()` defaults; migrations 1–5 are gone with the PostgreSQL lock
file intact; generated client and first-party source are free of removed names;
docs are updated and consistent; `prisma:validate` passes; no prohibited tests
were added.
