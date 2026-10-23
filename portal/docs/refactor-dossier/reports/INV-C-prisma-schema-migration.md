# INV-C — Prisma schema, migration history and tooling investigation

**Investigator:** INV-C (read-only)
**Date:** 23 September 2026
**Scope:** `REFACTOR_PLAN.md` v2.1 §2.5 (`REFACTOR_PLAN.md:77-86`) and §3.2 (`REFACTOR_PLAN.md:134-138`)
**Toolchain actually used:** Prisma CLI 7.9.1 / `@prisma/client` 7.9.1 (`npx prisma -v`), TypeScript 6.0.3 (`npx tsc --version`), shell Node **v22.23.1** while `.nvmrc`/`.node-version`/`package.json:4-6` pin **24.19.0** (see Risks).

**Commands executed (all read-only, no DB connection, no tree writes):** `prisma validate` ×3, `prisma migrate diff --from-empty --to-schema … --script`, `prisma migrate diff --from-schema … --to-schema … --script`, `prisma migrate diff … --exit-code`, `tsc --noEmit --incremental false --listFilesOnly`, `tsc --noEmit --incremental false`, `git log/status/ls-files`, `grep`, `wc`. Scratch files (a purged `schema.prisma`, an overriding `tsconfig`) were written **outside** the repo (`%TEMP%/inv-c`) and deleted. `tsconfig.tsbuildinfo` md5 `252a0a7726f8e6d88e4fa82633cb4796` is byte-identical before and after (verified), and `git status --porcelain` is empty.

**Not executed:** `prisma migrate diff --from-migrations` and any `migrate dev/deploy/reset/db push` — `--from-migrations` requires a **shadow database** (a real Postgres write), and `.env:2,5` hold placeholder URLs (`ep-example`/`user:password`, verified by grep). Conclusions that depend on a live DB are marked **UNVERIFIED**.

---

## Schema current state (line-accurate)

`prisma/schema.prisma` is **310 lines** (`wc -l`), **valid today** — measured: `npx prisma validate` → `The schema at prisma\schema.prisma is valid 🚀`.

### Generator / datasource (`:1-8`)

| Item | Line | Note |
| --- | --- | --- |
| `generator client { provider = "prisma-client" }` | `:1-2` | TS generator, not the legacy `prisma-client-js` |
| `output = "../src/generated/prisma"` | `:3` | Relative to `prisma/` → `src/generated/prisma`. §3.2's "keep" = zero diff; this **is** the status quo. |
| `datasource db { provider = "postgresql" }` | `:6-8` | **No `url`** — Prisma 7 resolves the connection from `prisma.config.ts:6-11`, which only sets `datasource.url` from `process.env.DIRECT_URL`. `prisma validate` therefore runs offline (measured). |

### Enums (`:10-54`)

| # | Enum | Lines | Values | Verdict |
| --- | --- | --- | --- | --- |
| E1 | `RecordStatus` `@@map("record_status")` | `:10-16` | ACTIVE / INACTIVE / ARCHIVED | SURVIVES |
| E2 | `Capability` `@@map("capability")` | `:18-27` | LINK_VIEW, LINK_MANAGE, RESULTS_VIEW_ORGANIZATION, ORGANIZATION_MANAGE, USER_MANAGE, AUDIT_VIEW | **PURGED** (whole enum, `:18-27`) |
| E3 | `PlatformRole` `@@map("platform_role")` | `:29-33` | PLATFORM_ADMIN | SURVIVES (used by `src/server/authorization/v1-policy.ts:3`) |
| E4 | `OrganizationRole` `@@map("organization_role")` | `:35-40` | ORGANIZATION_ADMIN, TEACHER | SURVIVES |
| E5 | `PlayerCredentialStatus` | `:42-47` | ACTIVE, REVOKED | SURVIVES |
| E6 | `GameSessionStatus` | `:49-54` | ACTIVE, ENDED | SURVIVES |

### Models (`:56-310`) — 16 total; 3 purged, 13 survive (2 of them partially edited)

| # | Model | Lines | Table | One-line purpose | Verdict |
| --- | --- | --- | --- | --- | --- |
| M1 | `ProfessionalProfile` | `:56-69` | `professional_profiles` | Adult/staff identity mirror of Neon Auth + platform role. | **PARTIAL** — delete `:65` `createdAccessLinks`; **keep** `:66` `auditEvents AuditEvent[] @relation("AuditActor")` (unmentioned by §2.5 but required while `AuditEvent` survives) |
| M2 | `Organization` | `:71-85` | `organizations` | Customer/school entity. | **PARTIAL** — delete `:79` `scopedCapabilities`, `:80` `accessLinks` |
| M3 | `OrganizationMembership` | `:87-103` | `organization_memberships` | Profile↔org grant with `OrganizationRole`. | **PARTIAL — `:97` `capabilityAssignments CapabilityAssignment[]` MUST be deleted and §2.5 does not list it** (see below) |
| M4 | `ClassGroup` | `:105-120` | `class_groups` | Turma; owns `nextPlayerNumber` counter (`:114`). | SURVIVES |
| M5 | `PlayerSlot` | `:122-137` | `player_slots` | Numbered permanent seat in a class. | SURVIVES |
| M6 | `PlayerCredential` | `:139-150` | `player_credentials` | Rotatable SHA-256 QR bearer credential. | SURVIVES |
| M7 | `GameSession` | `:152-165` | `game_sessions` | One active class session at a time. | SURVIVES |
| M8 | `Participation` | `:167-180` | `participations` | Session↔slot join, parent of both event tables. | SURVIVES |
| M9 | `GameState` | `:182-194` | `game_states` | Player-slot-authoritative JSONB state + optimistic `revision`. | SURVIVES |
| M10 | `ResultEvent` | `:196-214` | `result_events` | Idempotent (`client_event_id` unique) result append log. | SURVIVES |
| M11 | `ActiveTimeEvent` | `:216-228` | `active_time_events` | Idempotent active-time append log. | SURVIVES |
| M12 | `TeacherAssignment` | `:230-243` | `teacher_assignments` | Membership↔class teaching grant. | SURVIVES |
| M13 | `CapabilityAssignment` | `:245-259` | `capability_assignments` | Legacy fine-grained grant rows (incl. the raw `NULLS NOT DISTINCT` unique at `:254-257`). | **PURGED** |
| M14 | `AccessLink` | `:261-279` | `access_links` | Legacy shared-link tokens incl. `pausedAt` (`:270`). | **PURGED** |
| M15 | `AuditEvent` | `:281-298` | `audit_events` | Append-only admin history w/ actor FK + 3 indexes. | SURVIVES (but see *AuditEvent decision* — it becomes a table with **no writer**) |
| M16 | `RateLimitBucket` | `:300-310` | `rate_limit_buckets` | Fixed-window counter, `@@id(bucket_key)`, no relations. | **PURGED** |

### Post-edit line count

Purging `:18-27`, `:65`, `:79`, `:80`, `:97`, `:245-259`, `:261-279`, `:300-310` (63 lines + 3 blanks) yields **247 lines** (measured by building the file: 247 lines, `npx prisma validate` → **valid**). §2.5's own line cites `:65` and `:80` are **exact**; `:79` is exact; the plan never cites `:97`, `:245`, `:18-27` or `:300`.

### BLOCKER found by execution, not by reading

**§2.5 as literally written does not validate.** §2.5 enumerates "the 2 inverse relations" (`:65`, `:80`) plus `Organization.scopedCapabilities` (`:79`) and `model CapabilityAssignment` — but **omits `OrganizationMembership.capabilityAssignments` at `prisma/schema.prisma:97`**. Proof:

```
$ npx prisma validate --schema <schema edited exactly per §2.5>
Error code: P1012
error: Type "CapabilityAssignment" is neither a built-in type, nor refers to another model,
       composite type, or enum.
  -->  plan_literal.prisma:83
   |  capabilityAssignments CapabilityAssignment[]
Validation Error Count: 1
```
and the corrected version (also deleting `:97`) prints `The schema … is valid 🚀`.

This is the *classic* `prisma validate` failure mode the prior reviews asserted could not happen ("the schema has exactly three non-self references to `AccessLink`, all three of which are listed", `docs/agent-reviews/refactor-plan-v2/RV-D-prisma-tooling.md:47`). That sweep was exhaustive **for `AccessLink` only**; `CapabilityAssignment` has **three** inverse/forward touch points (`:79`, `:97`, `:245-259`), and §2.5 lists two. Good news: because it fails loudly at Day 1's own first gate, this is a 1-line correction, not a silent defect. Prior reviews only mention `capabilityAssignments` in passing (`docs/agent-reviews/refactor-plan-v2/RV-B-cross-document-consistency.md:67`), never as a §2.5 omission. **Not previously reported.**

---

## Migration history & drift

### Inventory (6 migrations + lock, 386 SQL lines)

| Dir | SQL lines | Style | Authorship signal |
| --- | --- | --- | --- |
| `prisma/migrations/0_init/migration.sql` | 175 | Prisma-marked (`-- CreateEnum` / `-- CreateTable` / `-- AddForeignKey`) **plus 5 hand-appended raw blocks** under `-- CreateIndex (raw)` / `-- CreateCheck (raw)` at `:158-175` | generated, then hand-edited |
| `1_add_paused_at/migration.sql` | 3 | single `ALTER TABLE "access_links" ADD COLUMN "paused_at"` | hand-written |
| `2_v1_adult_roles_and_classes/migration.sql` | 82 | no `-- ` headers; inline `CONSTRAINT …` clauses; **two data `UPDATE`s** at `:12-41` | hand-written |
| `3_slice_02_player_access/migration.sql` | 60 | inline constraints, partial unique indexes `:56`, `:59` | hand-written |
| `4_v1_game_state/migration.sql` | 15 | inline CHECKs `:12-14` | hand-written |
| `5_v1_game_events/migration.sql` | 51 | inline CHECKs `:18-21`, `:44-46` | hand-written |
| `migration_lock.toml` | 3 | `provider = "postgresql"` | — |

**Git state — the plan's Day 0 premise is already stale.** `git ls-files prisma` → all 6 `migration.sql` + `migration_lock.toml` + `schema.prisma` are **tracked**; `git log --diff-filter=A -- prisma/migrations/4_… 5_…` → added by **`c149374`** ("feat(v1): complete slices 3-5 game state, events, and portal integration"); `git status --porcelain` → **0 lines** (clean tree, 0 untracked). `REFACTOR_PLAN.md:210` ("Commit 30 untracked files + uncommitted schema + migrations 4 & 5") is **done**, and the prior reviews' claim "`git ls-files prisma/migrations` → 4 tracked; `4_`/`5_` untracked" (`docs/agent-reviews/refactor-plan-v2/VV-A-deletion-manifest-verification.md:55`) is **superseded**.

### Who created what (all in `0_init` unless noted)

| Object | Created | Dropped by §2.5? | Notes |
| --- | --- | --- | --- |
| `TYPE capability` | `0_init:8` | yes | 6 values, exactly the schema `:19-24`; **no `ALTER TYPE` anywhere** (measured: repo-wide grep for `ALTER TYPE` → 0 hits) |
| `TABLE capability_assignments` | `0_init:47-55` | yes | `"capability" "capability" NOT NULL` `:50` |
| `IDX capability_assignments_scope_organization_id_capability_idx` | `0_init:114` | yes (with table) | |
| `FK capability_assignments_membership_id_fkey` → `organization_memberships` `ON DELETE CASCADE` | `0_init:144` | yes | outgoing only |
| `FK capability_assignments_scope_organization_id_fkey` → `organizations` RESTRICT | `0_init:147` | yes | outgoing only |
| `UIDX capability_assignments_membership_capability_scope_key … NULLS NOT DISTINCT` | `0_init:158-160` (raw) | yes (with table) | the only object Prisma cannot express; comment at `schema.prisma:254-257` |
| `TABLE access_links` | `0_init:58-71` | yes | |
| `access_links_token_hash_key` / `_organization_id_revoked_at_idx` / `_expires_at_idx` | `0_init:117`, `:120`, `:123` | yes | |
| `FK access_links_organization_id_fkey` → `organizations` RESTRICT | `0_init:150` | yes | **outgoing** |
| `FK access_links_created_by_id_fkey` → `professional_profiles` RESTRICT | `0_init:153` | yes | **outgoing** |
| 3 raw CHECKs `token_hash_format` / `expires_at_after_created_at` / `revoked_at_not_before_created_at` | `0_init:163`, `:166`, `:169` | yes (with table) | |
| `access_links.paused_at` | `1_add_paused_at:3` | yes | makes `1_add_paused_at` a **no-op against the post-purge target** |
| `TABLE rate_limit_buckets` + `_expires_at_idx` + 2 raw CHECKs | `0_init:90-98`, `:135`, `:172`, `:175` | yes | self-contained; `:172`/`:175` die with the table |
| `TABLE audit_events` + 3 indexes + `actor_id` FK | `0_init:74-87`, `:126`, `:129`, `:132`, `:156` | **kept** | survives |

**No views, no functions, no triggers, no extensions, no `ALTER TYPE`, no re-defined enum values** anywhere in `prisma/migrations/**` (measured: grep for `CREATE (VIEW|FUNCTION|TRIGGER|EXTENSION)` and `ALTER TYPE` → 0 hits; only `CREATE SCHEMA IF NOT EXISTS "public"` at `0_init:2` and 6 `CREATE TYPE`s). `gen_random_uuid()` used at `2_…:47`,`:66`,`3_…:11`,`:24`,`:34`,`:44` is core Postgres ≥13 — no `pgcrypto` prerequisite. Neon ships PG 16 (**UNVERIFIED** for the specific branch, since `.env` is a placeholder).

### The FK-ordering fear does not apply here

The complete FK inventory of the *final* database is: `organization_memberships`→{profiles,orgs} (`0_init:138,141`), `class_groups`→orgs (`2_…:57`), `teacher_assignments`→{memberships,class_groups} (`2_…:69,72`), `player_slots`→class_groups (`3_…:17`), `player_credentials`→player_slots (`3_…:29`), `game_sessions`→class_groups (`3_…:41`), `participations`→{game_sessions,player_slots} (`3_…:51,52`), `game_states`→player_slots (`4_…:12`), `result_events`→participations (`5_…:18`), `active_time_events`→participations (`5_…:42`), `audit_events`→profiles (`0_init:156`), plus the 4 outgoing FKs on the dropped tables (`0_init:144,147,150,153`).

**Not one FK on a *surviving* table points *at* `access_links`, `capability_assignments` or `rate_limit_buckets`.** All three dropped tables are FK **sources**, never targets. Postgres also removes a table's own outgoing constraints and indexes with `DROP TABLE`, so — contrary to the framing of the task — **no `DROP CONSTRAINT` is strictly required**; `DROP TABLE access_links;` alone succeeds. The explicit constraint drops in §3's script are defensive (and idempotent-fail-safe only if ordered first, as emitted).

### `_prisma_migrations` baseline: there is no baseline problem — there is a *proof* problem

`_prisma_migrations` is a table **in the target database**; no target database has ever existed here (`.env` placeholders verified; audit `docs/architecture-audit-2026-09-23.md:39` "No migration has been applied to a real Neon database", `:75`, risk **R1** `:779`). Consequences:

* **No checksum/baseline conflict.** Prisma's `P3005`/`P3006` "database schema is not empty" and modified-checksum `P3006` errors require an existing `applied` row. There is none anywhere. Editing `0_init` today is free (though it *stops* being free the first time any branch applies the chain).
* **The whole 386-line chain is unexecuted**, so a fresh `migrate deploy` must apply all 7 migrations successfully — that is the acceptance item, not a migration-authoring obstacle. Applying `0..6` to an empty DB is the cheapest possible way to discharge R1 while doing §2.5 (**UNVERIFIED** — cannot be run read-only here).
* **Latent trap for `migrate dev`.** Because 5 of 6 migrations hand-wrote objects Prisma's datamodel cannot express, running `prisma migrate dev` (which diffs shadow-DB state against the datamodel and *auto-applies*) would emit `DROP CONSTRAINT` / `DROP INDEX` / `ALTER COLUMN … DROP DEFAULT` for every unmodeled object on **surviving** tables. Measured drift inventory (unmodeled objects that survive the purge), derived by comparing `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` (executed; contains **no** defaults/CHECKs/partial indexes for these) against the applied SQL:
  | Unmodeled object | Where created |
  | --- | --- |
  | `DEFAULT gen_random_uuid()` on `class_groups.id`, `teacher_assignments.id`, `player_slots.id`, `player_credentials.id`, `game_sessions.id`, `participations.id` | `2_…:46`,`:65`; `3_…:10`,`:23`,`:33`,`:43` |
  | `player_slots_player_number_positive` CHECK | `3_…:16` |
  | `player_credentials_one_active_per_slot`, `game_sessions_one_active_per_class` partial uniques | `3_…:56`,`:59` |
  | `game_states_revision_check`, `_protocol_version_check`, `_schema_version_check` | `4_…:13`,`:14`,`:15` |
  | `result_events_duration_ms_check`, `result_events_result_state_check` | `5_…:19`,`:20` |
  | `active_time_events_active_ms_check`, `active_time_events_mode_check` | `5_…:44`,`:45` |
  That is **11 CHECK constraints + 2 partial unique indexes + 6 column defaults** that `migrate dev` would silently destroy. The exact statement list is **UNVERIFIED** (needs a shadow DB) but the objects are unambiguously present in SQL and absent from the datamodel. **This is the decisive argument against generating migration 6 with `migrate dev`, and it is why the team already hand-writes migrations.**

---

## Required SQL / chosen migration strategy + commands

### The exact, minimal, ordered content of `prisma/migrations/6_drop_generation_a/migration.sql`

Produced by execution, not by guesswork: `npx prisma migrate diff --from-schema <current schema> --to-schema <correctly purged schema> --script` (fully offline, datamodel→datamodel, no DB):

```sql
-- DropForeignKey
ALTER TABLE "capability_assignments" DROP CONSTRAINT "capability_assignments_membership_id_fkey";

-- DropForeignKey
ALTER TABLE "capability_assignments" DROP CONSTRAINT "capability_assignments_scope_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "access_links" DROP CONSTRAINT "access_links_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "access_links" DROP CONSTRAINT "access_links_created_by_id_fkey";

-- DropTable
DROP TABLE "capability_assignments";

-- DropTable
DROP TABLE "access_links";

-- DropTable
DROP TABLE "rate_limit_buckets";

-- DropEnum
DROP TYPE "capability";
```

24 lines / 8 statements; measured `--exit-code` on a non-empty diff returns **2** (Empty=0, Error=1, Not-empty=2). Ordering is already correct (constraints → tables → type). Nothing else belongs here: the 5 raw CHECKs and 2 raw indexes of `0_init:158-175` are *owned by* the dropped tables, `1_add_paused_at`'s column dies with `access_links`, and there are no dependent views.

**Why the datamodel→datamodel diff is *sufficient* for this specific drop** (and would not be in general): every unmodeled object touched by §2.5 lives on a dropped table, so migration-6's "drift set" is empty. A `--from-migrations` diff would add nothing except the destructive extras listed above.

**Add two human-authored guards** the datamodel cannot express:

1. A **row-retention pre-flight** so the drop is auditable, e.g.
   `DO $$ BEGIN IF EXISTS (SELECT 1 FROM "access_links") OR EXISTS (SELECT 1 FROM "capability_assignments") THEN RAISE EXCEPTION 'generation A tables still hold rows — export/confirm first'; END IF; END $$;`
   (Prisma's diff is blind to data; the audit's precondition at `docs/architecture-audit-2026-09-23.md:652` is "only after confirming no V1 screen needs link-based sharing".)
2. A header comment naming the deliberate losses: the `NULLS NOT DISTINCT` uniqueness and the three `access_links` CHECKs — so nobody tries to "restore" them from the datamodel later.

### Workflow alternatives, with the real commands

| Path | Commands | Verdict |
| --- | --- | --- |
| **A. `migrate dev` (interactive)** | `npx prisma migrate dev --name drop_generation_a` | **REJECT.** Requires `DIRECT_URL` (real DB + shadow DB), auto-applies, and will offer to drop the 11 CHECKs / 2 partial uniques / 6 defaults. Irreversible on a shared branch (`docs/agent-reviews/refactor-plan-v2/RV-B-cross-document-consistency.md` R1 row). |
| **B. `migrate diff --from-migrations` → hand-place file** | `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script` | **REJECT as written.** Needs a shadow DB (not offline) *and* `--to-schema-datamodel` **was removed in Prisma 7** — measured error: "`--to-schema-datamodel` was removed. Please use `--[from/to]-schema` instead." `RV-D-prisma-tooling.md:206` prescribes the removed flag and asserts the command is "offline, no DB"; both are wrong for 7.9.1. Also drags in the drift drops. |
| **C. Hand-author from the datamodel diff (recommended)** | 1) edit `prisma/schema.prisma` (8 deletions incl. `:97`) → 2) `npx prisma validate` → 3) `npx prisma migrate diff --from-schema <git:HEAD:prisma/schema.prisma> --to-schema prisma/schema.prisma --script > prisma/migrations/6_drop_generation_a/migration.sql` (redirect *outside* the tree then move, or use `-o`) → 4) add the guard `DO $$` block → 5) `npx prisma generate` → 6) `npm run typecheck && npm test` → 7) `npx prisma migrate deploy` against a throwaway Postgres (`docs/architecture-audit-2026-09-23.md:796` D4) + `npx prisma migrate status` | **ACCEPT.** Deterministic, reviewable, DB-free to author, and turns R1 into a Day-1 by-product. |
| **D. `db push`** | `npx prisma db push` | **REJECT.** Writes no file (so §2.5.6's "generate and track … `6_drop_generation_a`" is unmeetable), records nothing in `_prisma_migrations`, and leaves `prisma/migrations/**` permanently contradicting the schema. Also cannot be reproduced in CI. |
| **E. CI gate (worth adding, independent of A–D)** | `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --exit-code` as a **shadow-DB CI job**, accepting a documented non-zero "known raw-constraint drift" carve-out | **DEFER.** With 11 CHECKs intentionally outside the datamodel this gate is red by design until the raw objects are either modeled (impossible) or the diff is filtered. Prefer `migrate deploy` + smoke query in CI instead. |

### The honest three, given that nothing was ever applied

| Option | What it means | For | Against |
| --- | --- | --- | --- |
| **(i) Rewrite history into a single `0_init`** | Regenerate `0_init` from the *purged* schema (`--from-empty --to-schema`), re-append the surviving raw objects (11 CHECKs, 2 partial uniques, 6 defaults), delete `1_add_paused_at` (its only content is `access_links.paused_at`) and `6_…` | Cheapest artifact; a fresh DB sees one file; no unapplicable chain; zero checksum risk (nothing applied) | Destroys the migration *narrative* that `docs/schemas/database-model.md:49-52,79-80,139,151-156` and the phase handoffs are written against; re-introduces every raw object by hand (easy to lose one); erases the `2_…:12-41` capability→role migration story that justifies the roles model; makes the capability→role transition unauditable |
| **(ii) Keep sequential history, hand-author `6_drop_generation_a`, apply fresh** *(recommended)* | §2.5.6 verbatim; `migrate deploy` on an empty DB applies `0→6` | Honest, reviewable, satisfies the audit's `:652` "drop … in a follow-up migration" and `:711` "migrate deploy on an empty database"; discharges R1 as a side effect; keeps docs/traceability; no `_prisma_migrations` conflict to negotiate because none exists | 3 extra files to read; `0_init` still creates tables that `6_` drops (a "created-then-dropped" oddity you accept knowingly) |
| **(iii) `db push`** | Delete/ignore `prisma/migrations/` | Fastest to a working Neon branch | Contradicts §2.5.6, unverifiable in CI, permanent schema↔history contradiction, and forfeits R1's *acceptance* value (push proves the datamodel, never that the chain applies) |

**Recommendation (one sentence):** keep the six-migration history and hand-author `prisma/migrations/6_drop_generation_a/migration.sql` as the 8 ordered statements above (plus a row-retention guard), because `prisma migrate dev` would offer to destroy 11 hand-written CHECK constraints and 2 partial unique indexes that the Prisma datamodel cannot see — and then prove the whole chain by running `prisma migrate deploy` against a throwaway Postgres on Day 1, which closes audit risk R1 for free.

---

## Code coupling table

Sweep: `grep -rIn` over `src/ tests/ contracts/ scripts/ docs/` for `accessLink`, `AccessLink`, `CapabilityAssignment`, `capability`, `Capability.`, `rateLimitBucket`, `RateLimitBucket`, `RATE_LIMITED`, `auditEvent`, `AuditEvent`, `createdAccessLinks`, `scopedCapabilities`, `generated/prisma`. **`RateLimitBucket`/`rate_limit_buckets`: 0 hand-written hits** (only `0_init` SQL + `docs/**`). **`createdAccessLinks` / `scopedCapabilities`: 0 code hits** (schema-only inverse fields).

| Symbol | File:line | Purge-set? (by §2.2/2.3/2.4) | Survives the purge? | Required edit |
| --- | --- | --- | --- | --- |
| `prisma.accessLink` delegate (`$transaction`, `create`, `findMany`…) | `src/server/db/prisma-access-link-store.ts` (24 `accessLink` hits; e.g. `:163`,`:198`,`:223`,`:248`,`:276`,`:316`) | Yes — §2.3 | no | delete file |
| `AccessLinkRecord`/`AccessLinkStore` port types | `src/server/services/access-link-service.ts:26` refs, `src/server/services/public-link-service.ts:5,6,15-18` | Yes — §2.3 | no | delete files |
| `Capability` (enum import) | `src/server/services/access-link-service.ts:2` | Yes | no | delete file |
| `Capability` (enum import) | `src/server/services/authorization-service.ts:1` (+27 more `capability` hits) | Yes — §2.3 | no | delete file |
| `CapabilityAssignment` | `src/server/services/authorization-service.ts` (4 hits), `src/server/db/prisma-capability-reader.ts` (5 `capability` hits) | Yes — §2.3 | no | delete files |
| `Capability` via **dynamic** import | `src/app/(professional)/portal/atividades/actions.ts:122` `await import("@/generated/prisma/enums")` | Yes — §2.2 | no | delete tree |
| `RATE_LIMITED` (only handler) | `src/app/(professional)/portal/atividades/actions.ts:181` `case "RATE_LIMITED":` | Yes — §2.2 | no | delete tree |
| `RATE_LIMITED` (code union) | `src/server/http/errors.ts:11` | **No** | **yes** | see *RATE_LIMITED decision* |
| `RATE_LIMITED` (JSON Schema enum) | `contracts/schemas/api-error.v1.schema.json:21` | **No** | **yes** | see *RATE_LIMITED decision* |
| `Capability` in code-name docs | `docs/schemas/database-model.md:60-65` (all 6 values), `:49`; `docs/schemas/api-contracts.md:53,89`; `docs/schemas/domain-rules.md:137,139` | No | yes | **stale-doc debt** — §2.5/§6 contain no doc step |
| `access_links` / `rate_limit_buckets` doc rows | `docs/schemas/database-model.md:50`, `:52`, `:86` ("`access_links` is the core new table"), `:139`, `:151-156` (5 raw CHECK/index rows) | No | yes | must be deleted/annotated; `docs/schemas/README.md:3-8` already labels these notes "not the source of truth" — but `:3-6` claims *database-model.md* **is** current |
| `auditEvent.create` (**sole writer**) | `src/server/db/prisma-access-link-store.ts:325-326` (`async recordAudit(…) { await this.client.auditEvent.create({...` ) | Yes — §2.3 | **no writer survives** | see *AuditEvent decision* |
| `AuditEventInput` / `recordAudit` port + 7 call sites | `src/server/services/access-link-service.ts:113`, `:294,350,415,473,514,553,644` | Yes — §2.3 | no | delete file |
| audit *action* string constants | `src/server/services/audit-actions.ts` (imported only at `access-link-service.ts:13`) | Yes — §2.3 | no | delete file; import graph closes |
| `auditEvents` **fixture** (not the model) | `src/server/services/portal-view-service.ts:416` `export const auditEvents = demoRuntime ? demoAuditEvents : [];`, read by `src/app/(professional)/portal/admin/auditoria/page.tsx:4,54,56` | Yes — §2.2/§2.3 | no | delete both |
| `Prisma.*` input types for dropped models | `src/server/db/prisma-access-link-store.ts:3` (`import type { Prisma, PrismaClient }`) | Yes | no | delete file |
| `OrganizationRole`/`RecordStatus`/`PlatformRole`/`PlayerCredentialStatus`/`GameSessionStatus` from `@/generated/prisma/enums` | 38 surviving files (measured), e.g. `src/server/authorization/v1-policy.ts:1-5`, `src/application/adult-portal/ports.ts:1`, `src/components/portal/class-detail-screen.tsx:8`, `src/server/db/prisma-player-access-store.ts:3-7,46` | No | **yes** | **no edit** — §2.5 removes no surviving enum; `Capability` is imported by 4 files, all in the purge set |
| `PrismaClient` from `@/generated/prisma/client` | 5 surviving files: `src/server/db/client.ts:4`, `prisma-adult-portal-store.ts:3`, `prisma-game-event-store.ts:4`, `prisma-game-state-store.ts:3`, `prisma-player-access-store.ts:3` | No | yes | no edit |
| Capability authorization for surviving admin screens | grep for `capabilit` outside the purge set → **0 hits**; `src/app/(professional)/portal/admin/{equipe,organizacoes}` resolve via `v1-policy.ts` roles | — | yes | none — audit R5's "locked-out admins" risk is **void** |

**Counts (measured, `.ts/.tsx` under `src/ tests/ scripts/`, `src/generated/` excluded):** `@/generated/prisma/enums` = **42** importing files today → **38** after purge (4 deleted: `access-link-service.ts`, `authorization-service.ts`, `tests/unit/access-link-service.test.ts`, `tests/unit/authorization.test.ts`); `@/generated/prisma/client` = **6** → **5** (`prisma-access-link-store.ts` deleted). §3.2's "42 surviving" (`REFACTOR_PLAN.md:138`) mis-states a pre-purge total as a surviving count.

### Can a stale generated client hide a schema error from `tsc`? — **Yes, confirmed**

* `npm run postinstall` = `prisma generate` (`package.json:26`); `npm run prisma:generate` also exists (`:25`). `npm ci` (CI, `.github/workflows/deploy.yml:26`; `Dockerfile:8`) therefore regenerates the client from the current schema, and `/src/generated/prisma` is gitignored (`.gitignore:27`, `git ls-files src/generated` → 0) so it is *never* a tracked artifact.
* **Nothing in the local chain forces that regeneration.** `scripts/next-target.mjs` (the runner behind `dev`/`build:server`/`build:demo`) only loads env, sets `APP_RUNTIME_MODE`/`NODE_ENV`, blanks demo secrets and `spawnSync`s `next` — it never calls `prisma generate`. So after editing `schema.prisma`, `npm run typecheck` reads whatever the developer's disk happens to contain: `src/generated/prisma/models/AccessLink.ts` (1,711 lines), `models/RateLimitBucket.ts` (1,221), `models/CapabilityAssignment.ts` (1,492) and the `Capability` const in `enums.ts` would all still be present, and any Generation-A call the purge missed type-checks **green**.
* Measured corroboration: `tsc -p tsconfig.json --noEmit` currently reports **0 errors** — it cannot distinguish schema states, only client states. `prisma validate` also passes both before and after the edit, so neither gate notices.
* **Required gate ordering:** `schema edit → prisma validate → prisma generate → rm -rf .next .next-demo-dev tsconfig.tsbuildinfo → typecheck → test`. `REFACTOR_PLAN.md:219` omits `prisma generate` between validate and typecheck (its own line 219 lists it, but the Day-1 body at `:213-214` sequences validate→typecheck; the ordering must be explicit in the checklist).
* Docker corroboration of the same hazard: `Dockerfile:12` `COPY . .` with a `.dockerignore` that lists `.git .github .next coverage node_modules *.log .env*` but **not** `src/generated` → a dirty host tree's stale client is baked into the image; a clean clone produces no `src/generated` at all and `npm run build` fails **loudly** on `@/generated/prisma/client`. Fix: `RUN npx prisma generate` in the builder stage.

---

## RATE_LIMITED decision

**Facts established (all measured):**

1. `RateLimitBucket` (`prisma/schema.prisma:300-310`) has **zero** hand-written references in `src/ tests/ contracts/ scripts/` — no `prisma.rateLimitBucket.*` call exists, and `rate_limit_buckets` appears only in `0_init:90-98,135,172,175` and `docs/**`. Deleting the **model + table** is inert: 0 code edits, and the emitted diff is one `DROP TABLE` with no dependents.
2. `RATE_LIMITED` occurs in exactly **3** places repo-wide (excluding `src/generated`): `src/server/http/errors.ts:11`, `contracts/schemas/api-error.v1.schema.json:21`, and `src/app/(professional)/portal/atividades/actions.ts:181` — the last is deleted by §2.2, and it was a *consumer* (`case` in a status-mapping switch), never an emitter. **No code has ever produced `RATE_LIMITED`.**
3. `apiErrorCodes` (`src/server/http/errors.ts:5-25`) has **no importers** besides `ApiErrorCode` at `:27`/`:37` in the same file. Nothing compares it to the JSON Schema: `tests/unit/v1-contracts.test.ts` resolves only `contracts/schemas/v1/${name}.v1.schema.json` (`:35`), and the registry it iterates (`contractSchemasV1`, `src/contracts/v1/schemas.ts:440-458`) lists **17** entries — `api-error` is not one of them. So `contracts/schemas/api-error.v1.schema.json` sits outside the versioned, fixture-tested, parity-enforced GameMaker contract set.
4. Nevertheless the file **is** the live shape of the four `/api/v1/player/*` error responses: those routes go through `withHttpContext` (`src/server/http/route.ts:35-38`) → `errorResponse` (`src/server/http/errors.ts:46-63`), which emits exactly `{error:{code,message,correlation_id,details?}}` — and `docs/schemas/api-contracts.md:26` names it as the validation-error contract.
5. **Removing it is a non-breaking narrowing, technically.** Nothing emits it; a client that tolerates unknown codes (the browser host only switches on `protocol.error.v1` codes, `src/components/public/game-host.tsx:142-148` → `VALIDATION_FAILED | PROTOCOL_VERSION_UNSUPPORTED | STATE_SCHEMA_VERSION_UNSUPPORTED | STATE_TOO_LARGE`) is unaffected. `contracts/schemas/README.md` "Frozen V1 naming" freezes *field names* and requires protocol v2 for an incompatible *rename*; it does not forbid tightening a `code` enum that is outside `contractSchemasV1`.
6. **But §2.5's carve-out is incoherent as written.** Post-purge, the codes with **no surviving emitter** are not one but **thirteen**: `RATE_LIMITED`, `SERVICE_UNAVAILABLE`, `RESOURCE_NOT_FOUND`, `ACTIVITY_NOT_OPEN`, `ACTIVITY_LINK_INVALID`, `ACTIVITY_LINK_EXPIRED`, `MODULE_LAUNCHES_BLOCKED`, `GAME_NOT_IN_ACTIVITY`, `GAME_DISABLED_FOR_ACTIVITY`, `GAME_LAUNCHES_BLOCKED`, `ATTEMPT_ALREADY_COMPLETED`, `RESULT_SCHEMA_INVALID`, `SCHEMA_VERSION_UNSUPPORTED` (surviving emitters are only `AUTHENTICATION_REQUIRED` `game-state-route.ts:19`/`read-limited-body.ts:6`-adjacent paths, `VALIDATION_FAILED` `game-state-route.ts:36,42,46`, `game-event-route.ts:22,28`, `FORBIDDEN`, `CONFLICT` `game-event-route.ts:43,49`, `game-state-route.ts:50,56,64`, `SESSION_EXPIRED`, `INTERNAL_SERVER_ERROR` `route.ts:45`). Deleting only `RATE_LIMITED` — one member of a legacy 19-member enum authored for the multi-activity/module architecture — leaves 12 equally dead members in the same published schema and gives a future reader no way to tell which are intentional.
7. **Deletion also silently answers audit D6.** `docs/architecture-audit-2026-09-23.md:798` records D6 as "Rate limiting: implement or delete? → **implement with `RateLimitBucket`**", scheduled at Phase 6 `:725` as "implement **or** delete the model *and* the `RATE_LIMITED` code path"; `:150` (F8) and `:455` frame it as "an unimplemented security control plus a dead table". §2.5 pre-empts the decision in a parenthetical and does not cite it. VV-B `:67` correctly notes D6 is an **open** decision (section 13 is titled "Open decisions (need a human answer before Phase 2)"), so the plan is *allowed* to answer it — it must say so.

**Recommendation — split the two halves of §2.5.4:**

* **Drop `model RateLimitBucket` + `DROP TABLE "rate_limit_buckets"`: APPROVE as written.** Zero coupling, zero risk, and it is *not* a rate-limiting decision — nothing was being rate-limited.
* **Remove `RATE_LIMITED` from `src/server/http/errors.ts:11`: APPROVE** (internal union, no importers, no emitters; the only `case` disappears with §2.2).
* **Touch `contracts/schemas/api-error.v1.schema.json:21`: DEFER — and do not do it piecemeal.** Either (a) leave the schema byte-identical and add one line to §2.5 stating "the Portal HTTP error enum is a legacy V0 artifact not covered by `contractSchemasV1`; a deliberate narrowing of `code` is scheduled with the `/api/v1` HTTP contract pass", or (b) widen the step into a single honest contract change: replace `api-error.v1.schema.json`'s 13 dead members with the 6 codes `/api/v1/*` can actually emit, ship it as `api-error.v2.schema.json`, and record it against D6. Option (a) is the Day-1-cheap choice; option (b) is correct. **What must not happen is the plan's current half-edit**, which removes one name from a 19-name published enum for a table nobody read while keeping 12 other unproducible names — the highest-risk action here is not a client break, it is that it *looks* like the contract was cleaned.
* **Because D6's "implement" branch was the security answer**, record in §2.5 that after this purge the four `/api/v1/player/*` endpoints and the sign-in action remain **unauthenticated-rate-limited** (bearer-token brute force is unmitigated). That is a decision, not a defect of this migration, but it must be written down where a reviewer will find it.

---

## AuditEvent decision

**§2.5.5 keeps `model AuditEvent`; §2 deletes its only writer. Both claims verify.**

* Sole writer: `src/server/db/prisma-access-link-store.ts:325-326` — `async recordAudit(event: AuditEventInput) { await this.client.auditEvent.create({...`. Repo-wide grep for `auditEvent` / `recordAudit` outside the purge set returns **only** the fixture array `portal-view-service.ts:416` and its consumer `src/app/(professional)/portal/admin/auditoria/page.tsx:4,54,56`, both deleted by §2.2/§2.3. Port/DTO declarations (`access-link-service.ts:113`, `:294…644`; `tests/unit/access-link-service.test.ts:273,307`) are also in the deletion set. `REFACTOR_PLAN.md:42`'s "`:325`" is exact.
* Therefore, from Day 1 onward `audit_events` is a table with **a reader-less, writer-less schema object**: 18 schema lines (`:281-298`), 1 surviving FK to `professional_profiles` (`0_init:156`), 3 indexes, and 1 surviving inverse field `ProfessionalProfile.auditEvents` (`:66`).

**Options:**

| Option | Cost / benefit | Consistency with the documents |
| --- | --- | --- |
| **(a) Delete `model AuditEvent` too** | −18 schema lines, −`ProfessionalProfile:66`, and a 5th `DROP TABLE "audit_events"` in migration 6 (plus `0_init:156` FK, `:126/:129/:132` indexes die with it). Zero code impact today. | **Contradicts** §2.5.5 and the audit's *rejected* claim table `docs/architecture-audit-2026-09-23.md:456` ("`AuditEvent` is current: `PrismaAccessLinkStore.recordAudit` writes it today. The defect is that nothing *reads* it") — that rejection is now **stale**, because §2.3 deletes the writer. Also discards the only append-only compliance history the product has ever had |
| **(b) Keep schema-only, no writer** *(what §2.5 implies)* | 18 lines of schema + 1 FK of "dead weight" that is genuinely cheap; the table is append-only, so an empty table is not a correctness hazard; preserves the D3/Phase-6 intent | Matches §2.5.5 **and** `:650-651` ("keep `AuditEvent` … add the reader in step 1") — but the plan deletes the *reader page* (`:42`) instead of repointing it, so §2.5.5's "for future V1 administrative logging" is an aspiration with no owner, no task and no port |
| **(c) Keep + name the next writer** | Add one §2.5 line: "`AuditEvent`'s first post-purge writer is the V1 player-credential revocation / membership-deactivation use case (`src/application/player-access/service.ts`, `src/application/adult-portal/service.ts`), which currently returns `CONFLICT` with no history." | Preserves intent while making it testable/auditable; still zero Day-1 code |

**What the plan actually implies, read strictly:** §2.2 deletes the auditoria screen because "the page would render empty"; §2.5.5 keeps the model "for future V1 administrative logging". The coherent reading is **(b) with (c)'s sentence**: keep the model, and state in §2.5 that between Day 1 and whenever V1 audit lands, `audit_events` has **no writer**, so no compliance claim may be made in that window. Do **not** delete the model (a) — it is 18 lines, the drop SQL for `audit_events` is not needed, and re-adding an audit table is strictly harder than waiting. If (b)/(c) is chosen, `docs/schemas/database-model.md:51` and `:127` stay accurate and need no edit.

---

## tsconfig exclude verdict

§3.2's factual core survives verification; its *benefit claim* does not.

**Measured (this machine, this tree, TS 6.0.3, `--incremental false` so nothing is written):**

| Measurement | Result |
| --- | --- |
| `src/generated` files in the program today | **24 of 24** — `tsc -p tsconfig.json --noEmit --incremental false --listFilesOnly` → 24 hits; total program **1,706** files. Cause: `tsconfig.json` `"include": ["**/*.ts", "**/*.tsx", "**/*.mts"]` matches them; `exclude` is only `["node_modules"]` |
| After adding `src/generated` to `exclude` (tested with an out-of-tree `tsconfig` that `extends` the real one — repo untouched) | **22 of 24 still in the program**; total **1,703** files |
| The two files that actually leave | `src/generated/prisma/browser.ts` (99 lines) and `src/generated/prisma/internal/prismaNamespaceBrowser.ts` (345 lines) = **444 lines, 1.49 %** of the 29,722 — they leave only because *nothing* imports `@/generated/prisma/browser` |
| Why 22 stay | `exclude` filters **root selection**, not module resolution. `paths."@/*": ["./src/*"]` (`tsconfig.json`) still resolves `@/generated/prisma/enums`/`client`, and the closure from `client.ts` → `internal/prismaNamespace.ts` → `models.ts` → 16× `models/*.ts` → `../enums` reaches 22 files |
| Cold `tsc --noEmit` wall time | **6.79 s without exclude → 6.42 s with exclude** (≈5 %, single sample, i.e. within noise) |
| Errors either way | **0** both ways — no "not under rootDir" (the project sets no `rootDir`, and `noEmit: true`), no ambient/`declare global` loss, `next-env.d.ts` unaffected (it is an explicit `include` entry, not a glob match under `src/generated`) |
| Do the generated files need `skipLibCheck`? | **No — and `skipLibCheck: true` (`tsconfig.json:6`) is irrelevant here.** All 24 files are `.ts` (`find src/generated -type f \| sed 's/.*\.//' \| sort \| uniq -c` → `24 ts`); there is not one `.d.ts`. The reason they cost nothing to *check* is that **24/24 carry `// @ts-nocheck` at line 5** (plus `/* eslint-disable */` and `// biome-ignore-all lint`) — measured `grep -rl "@ts-nocheck" src/generated \| wc -l` = 24 |
| Are they already excluded from the *other* quality gates? | Yes. `eslint.config.mjs` `globalIgnores` includes `"src/generated/**"`; `.prettierignore:3` has `src/generated`; `.gitignore:27` has `/src/generated/prisma` (`git ls-files src/generated` → 0) |
| Does Next fight the change? | No. Next writes `exclude` into `tsconfig.json` **only when the key is absent**; the key already exists (`"exclude": ["node_modules"]`), so Next only appends `include`/`plugins` entries |
| Free win the plan does not claim | Deleting the 3 purged models removes `models/AccessLink.ts` 1,711 + `models/CapabilityAssignment.ts` 1,492 + `models/RateLimitBucket.ts` 1,221 = **4,425 lines (14.9 %)** of generated output, and takes 3 of the 24 files → 21, automatically on the next `prisma generate`, with zero config change |

**Verdict: §3.2's `exclude` step is worth ~2 minutes of effort and is NOT worth its stated justification.**

* Say plainly: *"Add `src/generated/**` to `exclude` for root-set/IDE hygiene and to keep future unreachable generated entries (e.g. `browser.ts`) out of the program. It removes 444 of 29,722 generated lines (1.5 %) from the program and changes cold `tsc` time by less than 1 s; 22 generated files remain in the program regardless because surviving files import them. The measurable reduction in generated volume comes from §2.5 dropping three models (4,425 lines, 14.9 %), not from this line."* `REFACTOR_PLAN.md:138`'s "stops TypeScript from scanning the 29,722 lines" is **false as written** and should be deleted.
* Keeping `output = "../src/generated/prisma"` is correct and is already the status quo (`schema.prisma:3`); Prisma 7's TS generator throws unconditionally without `output`, so "keep" is the only option.
* Do **not** let §3.2 displace the two changes that matter in this file's neighbourhood: (1) `RUN npx prisma generate` in the Docker builder stage (`Dockerfile:12` + `.dockerignore` gap), and (2) `prisma generate` inside Day 1's gate. Also note §7.1's size ratchet (`REFACTOR_PLAN.md:246-250`) still trips over 16 generated files >400 lines after the purge — add `src/generated/**` to §7.1's exclusion list.

---

## Validation gates

Day 1 must run these **in this order** (the ordering *is* the finding; `REFACTOR_PLAN.md:213-219` mis-orders them):

```bash
# 1. schema, before and after the edit
npx prisma validate                                   # catches the missing :97 inverse (P1012) — measured
# 2. migration SQL, authored (not generated by migrate dev)
npx prisma migrate diff --from-schema <HEAD schema> --to-schema prisma/schema.prisma --script
#      → hand-place prisma/migrations/6_drop_generation_a/migration.sql + retention guard
# 3. prove the chain (discharges audit R1) — throwaway Postgres / Neon branch, NOT the shared branch
docker run -d --name sms-pg -e POSTGRES_PASSWORD=*** -p 55432:5432 postgres:16
DATABASE_URL=postgresql://postgres:***@localhost:55432/sms npx prisma migrate deploy
DATABASE_URL=… npx prisma migrate status              # expect "6 migrations … in sync"
# 4. regenerate the client BEFORE any type gate
npm run prisma:generate
rm -rf .next .next-demo-dev tsconfig.tsbuildinfo
# 5. code gates
npm run typecheck && npm test && npm run check
# 6. runtime targets
npm run build:demo && npm run build:server
```

Provable-by-construction properties of this gate set:

| Gate | What it *can* catch here | What it is structurally blind to |
| --- | --- | --- |
| `prisma validate` | the unlisted `OrganizationMembership.capabilityAssignments` (`schema.prisma:97`) — **demonstrated** with P1012 | `prisma/migrations/**` entirely |
| `migrate diff --from-schema/--to-schema --script` | nothing (it's the authoring tool); `--exit-code` gives a usable review signal (measured: 2 for non-empty) | drift between the datamodel and the applied DB |
| `migrate deploy` on an empty DB | whether the 7-migration chain actually applies (audit R1), incl. `2_…:12-41`'s `UPDATE … capability_assignments` joins and `gen_random_uuid()` availability | whether the DB was already non-empty (that is `migrate status`'s job) |
| `prisma generate` + `typecheck` | any surviving call site to `prisma.accessLink` / `prisma.rateLimitBucket` / `Capability.*` | anything while `generate` hasn't run — **this is the hole §6 Day-1 falls into** |
| `npm test` (`vitest`, `tests/**/*.test.ts`) | surviving-behaviour regressions | `api-error.v1.schema.json` (never loaded — `tests/unit/v1-contracts.test.ts:35` reads only `contracts/schemas/v1/`) |
| `npm run check` (`format:check && lint && typecheck && test`) | style/lint/type/tests | `schema.prisma` is `.prettierignore:8`-listed; `src/generated/**` is eslint/prettier-ignored |
| CI | currently **nothing** — `.github/workflows/` contains only `deploy.yml` (`npm ci` + `build:demo`); §7.4's "CI enforcement" and Day 0's "Setup ci.yml on PRs" are unstarted | — |

Baselines recorded for the dossier: `tsc --noEmit` = **0 errors**, program = **1,706 files**, generated client = **24 files / 29,722 lines**, `prisma/schema.prisma` = **310 lines / valid**, migrations = **6 tracked / 386 SQL lines**, working tree = **clean**.

---

## Risks / open questions

| # | Risk / question | Evidence | Severity | Suggested action |
| --- | --- | --- | --- | --- |
| 1 | **§2.5 does not compile**: `OrganizationMembership.capabilityAssignments` (`prisma/schema.prisma:97`) is unlisted → `prisma validate` fails P1012 | measured twice (fail vs. pass) | **BLOCKER (trivial fix)** | add `:97` as the third inverse relation in §2.5.2; note `ProfessionalProfile.auditEvents` (`:66`) is *not* to be touched |
| 2 | **`migrate dev` would silently destroy 11 CHECKs + 2 partial uniques + 6 defaults** that the datamodel cannot express | `3_…:16,56,59`; `4_…:13-15`; `5_…:19-20,44-45`; `2_…:46,65`; `3_…:10,23,33,43`, diffed against executed `--from-empty --to-schema` output | **MAJOR** | write a "no `migrate dev` in this repo" line into §2.5; author migration 6 by hand; prefer `migrate deploy` in CI |
| 3 | RV-D's prescribed command is broken for Prisma 7: `--to-schema-datamodel` **removed**, and `--from-migrations` is **not** offline (needs a shadow DB) | CLI error captured verbatim; `RV-D-prisma-tooling.md:206` | **MAJOR (doc)** | correct the recipe to `--from-schema/--to-schema` (proven working) |
| 4 | **`RATE_LIMITED` half-removal** leaves 12 other unproducible codes in the same published enum; no test ties `errors.ts` to the schema | `errors.ts:11`, `api-error.v1.schema.json:21`, `apiErrorCodes` importers = 0, `contractSchemasV1` `schemas.ts:440-458` lacks `api-error` | **MAJOR (contract hygiene)** | see *RATE_LIMITED decision* (defer, or do all 13 as `api-error.v2`) |
| 5 | **`AuditEvent` becomes writer-less and reader-less** while §2.5.5 keeps it "for future V1 logging" | `prisma-access-link-store.ts:325-326` sole writer, deleted by §2.3; reader page deleted by §2.2 | **MINOR→MAJOR** (a compliance claim would be false) | keep the model, add the explicit "no writer between Day 1 and V1 audit" sentence + name the next writer |
| 6 | **Rate limiting remains unimplemented** after D6's implicit "delete" answer — 4 player endpoints + sign-in have no abuse mitigation | `docs/architecture-audit-2026-09-23.md:725,798`; zero `RateLimitBucket` usage today | **MAJOR (security debt, unchanged by this work)** | re-open D6 as an explicit V1 task, not a schema edit |
| 7 | `1_add_paused_at` becomes a **created-then-dropped** no-op against the target; keeping it preserves history but looks silly | `1_add_paused_at:3` | **MINOR** | leave it, add a one-line comment in migration 6 (option (i) rewrite would remove it — documented trade-off) |
| 8 | **Stale-client window**: `typecheck` after a schema edit validates the *pre-purge* client; `scripts/next-target.mjs` never generates; `Dockerfile:12` imports the host's client (`.dockerignore` lacks `src/generated`) | `package.json:25-26`, `Dockerfile:8,12`, `.dockerignore` | **MAJOR** | `prisma generate` + cache wipe in the gate; `RUN npx prisma generate` in the builder; add `src/generated` to `.dockerignore` |
| 9 | **No CI at all** for `check`/`typecheck`/`test`; §7.4's "CI enforcement" is unstarted | `.github/workflows/deploy.yml` only (checkout→`npm ci`→`build:demo`→Pages) | **MAJOR (plan premise)** | Day 0 `ci.yml` is genuinely new work; sequence it *before* Day 1's schema edit so the drop is guarded |
| 10 | **Node version skew**: the shell runs v22.23.1 while `.nvmrc`, `.node-version` and `package.json:4-6` pin 24.19.0 — every local number in this report (incl. `tsc` timings, Prisma 7 behaviour) was measured on 22.23.1 | `node -v`; `.nvmrc` | **MINOR** | re-measure the Day-1 gate on 24.19.0 before recording it as a baseline |
| 11 | §2.5's `6_drop_generation_a` name is fine but the directory must sort correctly: `_prisma_migrations` applies **lexicographically**; `0…6` is safe, `10_…` would sort before `2_…` | existing names | **MINOR** | if the numbering passes 9, switch to `NN_`/timestamps |
| 12 | **No seed / no dev data exists.** `prisma/seed*` absent, `prisma.config.ts:6-12` defines no `seed`, `package.json` has no seed script, and no SQL/script populates a DB. So *nothing must change in seeding after the purge* — there is nothing to change. Two consequences: (a) `README.md:89-92` documents that server mode requires a pre-provisioned Neon Auth adult **plus a matching `ProfessionalProfile`**, which today must be hand-inserted; (b) `AUTH_DEV_BYPASS` synthesises `DEV_BYPASS_ACTOR` with a hard-coded `profileId = 00000000-0000-4000-8000-000000000001` (`src/server/auth/dev-bypass-gateway.ts:9-13`), so even bypass mode needs that exact UUID plus memberships/orgs to exist. Audit R1 (`:779`) asks for "seed one organization/class/player" — that seed **must not** create `capability_assignments`, `access_links` or `rate_limit_buckets`. | all measured | **MAJOR for R1** (blocking the acceptance), **NIL for §2.5** | if the purge creates the first real dev fixture, put it in `prisma/dev-seed.ts` + `"prisma.seed"` in `prisma.config.ts`, and have it insert: profile(uuid …0001) → org → membership(`organization_admin`) → class_group → 3 player_slots; no capabilities (roles only, `src/server/authorization/v1-policy.ts:1-5`) |
| 13 | `docs/schemas/database-model.md` remains the *self-declared current* DB doc (`README.md:3-6` of that dir) while `:49-52,60-65,79-80,86,127,139,151-156` describe dropped objects — 8 of which the purge deletes | measured line cites above | **MINOR** (but it is the doc a future engineer trusts) | add a §2.5 line: delete rows `:49`,`:50`,`:52`, the capability table `:60-65`, `:79-80`, the "core new table" prose `:86`, `:139`, and index/CHECK rows `:151-156`; keep `:51`,`:127` (`audit_events`) |
| 14 | **UNVERIFIED**: that `migrate deploy` actually applies `0→6` (needs a real DB); that the shadow-DB diff's exact statement list matches my drift inventory; that Neon's PG major supports `NULLS NOT DISTINCT` (needs PG ≥15) — `0_init:160` depends on it and would fail on an older server | `.env:2,5` placeholders; `0_init:160` | **OPEN (highest-value)** | run the Day-1 `migrate deploy` on both a Docker PG-16 and the Neon branch; if `NULLS NOT DISTINCT` errors, it is fixable *for free today* (nothing applied) and becomes unfixable-cheap the moment a branch applies the chain |
| 15 | **Open question for the plan author**: does "zero legacy backward-compatibility requirement" (`REFACTOR_PLAN.md:6`) also license option (i) (squash to a single `0_init`)? Nothing was ever deployed, so the usual argument against rewriting history does not apply; only the docs/traceability argument does. This investigation recommends **keeping history**, but the choice belongs to the plan, and either way §2.5.6's phrasing ("generate and track") should state *which* history ships. | §3 above | **DECISION NEEDED** | one sentence in §2.5 either way |
