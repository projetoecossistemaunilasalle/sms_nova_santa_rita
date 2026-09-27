# P20 Review — B (Clean Schema Baseline)

Reviewer: B (independent; did not read review-A.md or verification-*.md).
Date: 2026-09-26. Scope: uncommitted P20 change set only (P00/P10 changes in the
tree excluded). Checked against `docs/refactor-dossier/IMPLEMENTATION-READY.md`
§P20 (lines 203-256).

## Summary of changes reviewed

- `prisma/schema.prisma` — removed `Capability` enum and models
  `CapabilityAssignment`, `AccessLink`, `AuditEvent`, `RateLimitBucket`; removed
  the five inverse relation fields (`ProfessionalProfile.createdAccessLinks`,
  `ProfessionalProfile.auditEvents`, `Organization.scopedCapabilities`,
  `Organization.accessLinks`, `OrganizationMembership.capabilityAssignments`).
- `prisma/migrations/0_init/migration.sql` — replaced with a Prisma-generated
  from-empty baseline (269 lines) plus a 6-line comment and 10 appended database
  rules (20 lines total appended).
- `prisma/migrations/1_add_paused_at` … `5_v1_game_events` — deleted;
  `migration_lock.toml` kept (provider `postgresql`).
- `src/generated/prisma` — regenerated (gitignored; re-generated and inspected
  during this review).
- `docs/schemas/database-model.md` — rewritten for the surviving 12-table model.

## Verification performed (commands run by this reviewer)

1. `git diff prisma/schema.prisma` — every hunk is a pure deletion; no surviving
   model, index, `@map`, `onDelete`, or default was modified. Surviving set
   counted: 12 `model` blocks, 5 `enum` blocks. Grep for
   `capability|accesslink|auditevent|ratelimitbucket` in the schema: no matches.
2. Independent equivalence check (Node 24.19.0):
   `DIRECT_URL="postgresql://placeholder:placeholder@localhost.invalid:5432/placeholder"
   npm exec -- prisma migrate diff --from-empty --to-schema prisma/schema.prisma
   --script` → exit 0, 269 lines, 12 `CREATE TABLE`. `diff` against
   `head -269 prisma/migrations/0_init/migration.sql`: **byte-identical**. The
   delta is exactly the appended rules block (lines 270-289).
3. Ten rules vs `git show HEAD:prisma/migrations/{3_slice_02_player_access,
   4_v1_game_state,5_v1_game_events}/migration.sql`: all ten names and predicate
   expressions are byte-faithful. The two partial unique indexes
   (`player_credentials_one_active_per_slot`,
   `game_sessions_one_active_per_class`) are single-line byte-identical
   statements. The eight CHECK constraints are necessarily re-framed as
   `ALTER TABLE ... ADD CONSTRAINT` (tables are created without inline
   constraints by the generator); each predicate expression — e.g.
   `CHECK ("result_state" IN ('sucesso', 'falha', 'cancelado',
   'tempo_esgotado', 'erro_inicializacao'))` and
   `CHECK ("active_ms" BETWEEN 1 AND 30000)` — matches the historical text
   character for character.
4. `npm run prisma:validate` → "The schema at prisma\schema.prisma is valid"
   (run twice, both pass). `npm run prisma:generate` → succeeds.
5. Residue searches: no `gen_random_uuid` and no
   access_links/audit_events/rate_limit_buckets/capability tokens anywhere in
   the new `0_init`; no `Capability|AccessLink|AuditEvent|RateLimitBucket`
   matches anywhere under `src/generated/prisma`; no removed model/enum/property
   name in first-party `src/`, `tests/`, `scripts/`, `contracts/` TypeScript.
6. Acceptance negatives: no test references `migration`, `0_init`, or
   `migration.sql`; no generated-client-shape test exists; grep over
   `docs/`, `README.md`, `walkthrough.md` finds no upgrade/rollback promise.
7. `database-model.md` cross-checked line by line against
   `prisma/schema.prisma` and the new `0_init` (details below).

## Findings

| # | Severity | Location | Finding | Status |
| --- | --- | --- | --- | --- |
| B1 | CRITICAL | — | None found. | — |
| B2 | MAJOR | — | None found. | — |
| B3 | INFO | `src/components/portal/portal.module.css:2376,2386,2399-2400,2802` | Dead `.auditEvent` CSS class selectors remain. They collide with a removed model name only case-insensitively; no `.tsx`/`.ts` file references the class (grep over `src/` returns nothing), so nothing breaks. Dead Generation-A CSS purge is explicitly P40a scope ("Purge dead Generation-A CSS"), and P20 step 7's source search targets executable model/enum/property references. Not a P20 acceptance failure. | Confirmed |
| B4 | INFO | `docs/schemas/database-model.md:62,137` | `game_states` revision is described as "monotonic". The database enforces only `revision > 0` (`game_states_revision_check`); monotonicity is an application-level invariant. The ten-rules table (line 156) states the actual DB predicate correctly, so this is descriptive prose, not an invented DB claim. | Confirmed |
| B5 | INFO | `docs/schemas/database-model.md:172-179` | "Deletion policy" retains the forward-looking sentence "Production retention uses an ordered, batched job after policy approval and never relies on cascade deletion." Carried over verbatim from the pre-P20 revision (old doc, "Deletion policy" section); it is policy prose, not a claim about shipped code. The verifiable part — every FK `ON DELETE RESTRICT` — is true: all 13 `AddForeignKey` statements in the new `0_init` are `ON DELETE RESTRICT ON UPDATE CASCADE`. | Confirmed |

### Verified-accurate claims in database-model.md (no finding)

- Mermaid diagram: 13 edges, exactly matching the 13 FKs in `0_init`; no
  removed-model edges; `PLAYER_SLOTS \|\--o\| GAME_STATES` correctly renders the
  one-to-zero-or-one relation whose PK is `player_slot_id`.
- Tables table (12 rows): every unique/index claim matches the schema and SQL —
  `professional_profiles_auth_user_id_key`, `organizations_status_idx`,
  membership pair-unique and `(organization_id, status)` index,
  `next_player_number`, slot `(class_group_id, player_number)` unique and
  `(class_group_id, status)` index, credential `token_hash` unique and
  `(player_slot_id, status)` index, session `(class_group_id, status)` index,
  participation pair-unique and `(player_slot_id, joined_at)` index, both event
  tables' `client_event_id` unique and `(participation_id, received_at)` index
  (plus results' `(activity_id, received_at)`), teacher-assignment pair-unique
  and `(class_group_id, status)` index.
- Enums table: 5 enums with values exactly as in `schema.prisma`/`0_init`.
- Ten-rule table: names, tables, and predicates match `0_init` lines 277-289
  one for one.
- "Structural uniqueness invariants … are ordinary Prisma `@@unique` indexes" —
  true; nothing else is hand-written SQL besides the ten rules.
- Old doc's capability/access-links/audit/rate-limit sections, their
  NULLS-NOT-DISTINCT / regex-CHECK rules table, and the "regex CHECK enforces
  token-hash shape" claim are all gone (the new token-hash section makes no DB
  enforcement claim — correct, since `player_credentials.token_hash` has no
  format CHECK). Grep for `capability|access_link|audit|rate_limit` in the new
  doc: no matches. The "Legacy model (superseded)" section was correctly
  reworded to drop "authorization, audit" from the carried-over principles.
- Baseline completeness vs history: migration 2's enums/columns are folded in
  (`platform_role` nullable, `organization_memberships.role` `NOT NULL` —
  correct for a from-empty baseline), migrations 3-5's tables/indexes folded in;
  migration 1 (`access_links.paused_at`) and migration 2's data-backfill
  `UPDATE`s are correctly absent (removed model; from-empty baseline has no
  data, and §P20 declares no deployed-database compatibility requirement).
- Dependency order in `0_init` is self-consistent: schema, 5 enums, 12 tables,
  20 indexes, 13 FKs (all targets exist), then the ten appended rules against
  already-existing tables.

### Runbook-step compliance notes

- §P20.3 dummy-`DIRECT_URL` generation procedure reproduced exactly as
  specified; output non-empty with all 12 expected `CREATE TABLE` statements
  (the failure condition "empty output" did not occur).
- §P20.5 "append … before it replaces `0_init`; do not copy a whole historical
  migration" — satisfied: the appended block is 10 statements + a comment, not
  a copied file.
- §P20.6 no `gen_random_uuid()` defaults — confirmed (grep: no matches).
- §P20.7 `prisma:validate` and `prisma:generate` pass; first-party source
  search clean; `database-model.md` updated in the same change set.
- Migration dirs 1-5 deleted; `migration_lock.toml` kept with
  `provider = "postgresql"`.
- Typecheck/tests/builds were not re-run by this reviewer (per review-brief:
  already green; read-only review).

## Verdict

**P20 satisfied: YES.**

The schema diff is exactly the prescribed removal (12 models / 5 enums survive,
nothing else touched). The new `0_init` is byte-identical to an independently
generated from-empty diff plus exactly the ten appended rules, whose names and
predicates are faithful to the historical migrations; no `gen_random_uuid()`
defaults, no removed-model remnants, and the SQL is a self-consistent
from-empty PostgreSQL baseline. `database-model.md` accurately reflects the new
baseline with no residue or invented claims, `prisma:validate` passes when run
by this reviewer, and the acceptance negatives (no snapshot/immutability/
client-shape tests, no upgrade/rollback promise) hold. The only observations
are three INFO-level items, none of which affect P20 acceptance.
