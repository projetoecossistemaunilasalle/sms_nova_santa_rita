# Phase 20 / schema and migration primary audit

**Audit date:** 25 September 2026  
**Repository:** `C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal`  
**Baseline:** `main` at `e5aaf1e2891dbb1804950223eb9f0765e7dbeb65`  
**Primary target:** `docs/refactor-dossier/phases/20-schema-and-migration.md`  
**Scope:** Prisma schema cuts, migration history and hand-authored SQL, Neon/Auth boundary, server stores, contracts, destructive-data and security/correctness risks, and Phase 20 gates.

All citations are repository-relative to the absolute repository path above. The dossier phase/policy/critique, governing plan/architecture/product/schema/implementation documents, inherited reports, `prisma/`, server DB/auth/security code, contracts, and relevant tests were reviewed. No database was contacted. No source, configuration, test, schema, migration, dossier, or build artifact was edited; this report is the only file created/changed by this audit.

## Executive verdict

**Phase 20 is technically well researched and its corrected SQL recipe is reproducible, but it is not safe to hand off as a production migration or release gate.** The phase correctly settles the 10-statement SQL question and candidly states that no schema-drift gate remains. The remaining risks are the destructive data loss, the missing migration-history/applicability gate, unresolved `AuditEvent` retention, removal of the rate-limit security requirement, stale schema documentation, and unclosed R1 real-Neon acceptance risk.

The safe disposition is:

1. Do not run or approve the migration against any unverified database.
2. Restore an owner-controlled migration artifact/applicability gate before release.
3. Decide explicitly whether `AuditEvent` is disposable and whether `RateLimitBucket` can be removed before deleting server security behavior.
4. Update the documents that claim the legacy database model is current.
5. Keep R1, real Neon deployment, server boot, auth/profile binding, and end-to-end acceptance as release blockers.

## Measured evidence and method

Read-only checks from the repository root produced:

- `node_modules/.bin/prisma --version` → Prisma **7.9.1**, client **7.9.1**, Node **22.23.1**; repository pins Node 24.19.0 at `package.json:5-9`.
- `node_modules/.bin/prisma validate` → current `prisma/schema.prisma` is valid.
- `node_modules/.bin/prisma migrate diff --help` → Prisma 7.9.1 uses `--from-schema`, `--to-schema`, `--from-migrations`, `--to-migrations`, `--script`, `--exit-code`, and `-o`; no `shadow` option exists.
- `prisma/schema.prisma` is 310 lines, 16 `model` declarations, and 6 `enum` declarations.
- Migration SQL files measure **175 / 3 / 82 / 60 / 15 / 51 = 386** lines; `git ls-files prisma/migrations` returns six SQL files plus `migration_lock.toml`.
- `.env.example:9,12` and untracked `.env` contain `ep-example` placeholders; this is not proof that no external database exists.
- `.github/workflows` contains `deploy.yml` only; there is no `ci.yml`.
- A BOM-free scratch copy outside the repository at `%TEMP%/phase20-primary-audit-bomless` was used. The full Phase 20 recipe validated. Scratch `prisma migrate diff --from-schema <HEAD copy> --to-schema <purged copy> --script` emitted 5 `DROP CONSTRAINT`, 4 `DROP TABLE`, and 1 `DROP TYPE` statements (10 total), including `ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_actor_id_fkey";`.

No `migrate dev`, `migrate deploy`, `db push`, `migrate diff --from-migrations`, `prisma generate`, or database connection was performed.

## Concise finding register

| ID | Severity | Finding |
|---|---|---|
| S-01 | **Blocker** | Placeholder `.env`/documentation does not prove that no real database exists; the proposed `DROP` sequence is irreversible without a target inventory, backup, and approval. |
| S-02 | **Major** | No automated gate compares migration history to the post-purge schema or proves the seven-directory chain applies. |
| S-03 | **Major** | Dropping `AuditEvent` destroys possible historical before/after audit rows without an explicit retention/export decision. |
| S-04 | **Major** | Dropping `RateLimitBucket` and `RATE_LIMITED` removes specified abuse-control persistence while four player POST routes remain server code. |
| S-05 | **Major** | `prisma.config.ts` auto-loads `DIRECT_URL`; a future migration command can target a real Neon branch without a fail-closed target-selection runbook. |
| S-06 | **Major** | `docs/schemas/database-model.md` is labeled current but still documents all four tables, six capabilities, and rate-limit/audit invariants that migration 6 removes. |
| S-07 | **Major** | R1 (“server target has never run against a database”) is explicitly not closed and must remain a production blocker. |
| S-08 | **Minor** | Step 6’s residue regex misses lowercase generated Prisma properties and its importer count is incomplete. |
| S-09 | **Minor** | The 227-line schema gate is whitespace-sensitive and should not be a correctness criterion. |
| S-10 | **Minor** | The work order calls all four relation fields “unlisted by plan,” although only `OrganizationMembership.capabilityAssignments` at `schema.prisma:97` is omitted by the plan’s relation list. |


## Detailed findings

### S-01 — BLOCKER — the “no database exists” premise does not authorize destructive SQL

**Evidence:** `docs/refactor-dossier/phases/20-schema-and-migration.md:16-21,151-160,232-243`; `.env.example:9,12`; `docs/implementation/slice-03-05-portal-handoff.md:33-37`; `docs/architecture-audit-2026-09-23.md:39-41,74-75`.

The phase correctly prohibits `migrate dev`/`db push` without a controlled target, but it turns a local placeholder-URL observation into a global safety fact. A staging, preview, developer, or externally managed Neon branch may contain `access_links`, `audit_events`, `capability_assignments`, or `rate_limit_buckets` even when this checkout has no usable credentials. The first run could permanently destroy rows; migration 2’s data backfill (`2_v1_adult_roles_and_classes/migration.sql:13-41`) would already have operated on existing rows before the drop.

**Required disposition:** before implementation/release, inventory project/branch/database, connection owner, `_prisma_migrations` presence, row presence in the four dropped tables, backup/restore point, and human approval. A safe runbook must override `DIRECT_URL` explicitly rather than rely on `.env`. Without that inventory, keep the schema cut as a local draft and do not call the migration deployable.

### S-02 — MAJOR — no schema-drift or migration-applicability gate remains

**Evidence:** `docs/refactor-dossier/phases/20-schema-and-migration.md:33-44,191-201,211-217,240-251`; `package.json:20-26`; `tests/unit/game-state-prisma.test.ts:12-65`; `tests/unit/player-access-prisma.test.ts:12-203`; `.github/workflows/deploy.yml:30-34`.

`prisma validate` checks schema self-consistency only. A syntactically valid migration can still have a wrong statement, stale object name, omitted table, or chain failure on a fresh/real database. Existing Prisma tests use fake transaction clients and execute no SQL; the current Pages workflow only builds the demo. The phase’s 10-statement count/name checks catch truncation or rebase edits but do not prove that seven migration directories replay successfully.

**Required disposition:** add a DB-free SQL artifact test and a controlled migration-applicability gate using a throwaway Postgres or disposable Neon development branch. The gate must assert non-empty SQL and successful seven-directory deploy/status. The phase must have an owner and reproducible command.

### S-03 — MAJOR — dropping `AuditEvent` is an unresolved retention decision

**Evidence:** `prisma/schema.prisma:281-298`; `prisma/migrations/0_init/migration.sql:74-87,126-132,156`; `src/server/db/prisma-access-link-store.ts:57-69,325-326`; `docs/schemas/database-model.md:44-52,128-135,173-177`; `PRODUCT.md:129-141`; `docs/refactor-dossier/phases/20-schema-and-migration.md:130-134,156-160,240-243`.

The current application has no real audit reader and its only real writer is in the Generation-A deletion set, but that does not prove an external database has no audit rows or that those rows lack retention/support/legal value. `AuditEvent` stores before/after mutation snapshots. Deleting the table is not equivalent to deleting a fixture.

**Required disposition:** classify the table as disposable prototype data or obtain a retention/export decision. If retained, remove it from this purge and design a real writer/reader later. If discarded, document exact data loss and require target backup/approval under S-01.

### S-04 — MAJOR — deleting rate-limit persistence leaves public server routes without required abuse control

**Evidence:** `prisma/schema.prisma:300-310`; `prisma/migrations/0_init/migration.sql:90-98,135,172-175`; `docs/schemas/api-contracts.md:135-145`; `docs/implementation/phase-01-foundation-contracts.md:124-135`; `src/app/api/v1/player/bootstrap/route.ts:12-27`; `src/app/api/v1/player/state/route.ts:13-25`; `src/app/api/v1/player/results/route.ts:13-29`; `src/app/api/v1/player/active-time/route.ts:13-29`; `docs/refactor-dossier/phases/20-schema-and-migration.md:8,135,199,244`.

The static demo cannot serve these routes, but the repository has an explicit server target and Docker server build (`next.config.ts:12-18,32`; `Dockerfile:8-15`). The route files are not dead merely because the Pages artifact omits them. Removing the table and `RATE_LIMITED` without replacement leaves the production player API without the fixed-window persistence and 429 behavior required by the governing documents. The browser error JSON is not covered by `tests/unit/v1-contracts.test.ts:27-63`, which loads only `contracts/schemas/v1/*`.

**Required disposition:** retain/reintroduce the limiter as a separate V1 security deliverable before deleting persistence, or explicitly scope the server APIs as non-production and remove the public route claim. Add executable tests for 429, `Retry-After`, correlation IDs, bounded idempotent retries, and contract/code parity.


### S-05 — MAJOR — Prisma CLI connection safety is underspecified

**Evidence:** `prisma.config.ts:1,4,6-11`; `.env.example:9-12`; `docs/refactor-dossier/phases/20-schema-and-migration.md:35-38,180,226,234`; `docs/implementation/slice-03-05-portal-handoff.md:35-37`; `docs/refactor-dossier/reports/VER-C-prisma-schema-verification.md:105-109`.

`prisma.config.ts` imports `dotenv/config`, reads `DIRECT_URL`, and conditionally supplies it as the Prisma datasource URL. A future `migrate deploy` from a developer shell can therefore send the seven-directory chain to a real Neon branch even when the application’s `DATABASE_URL` points elsewhere. The phase acknowledges this but leaves the deployment runbook out of scope.

**Required disposition:** provide a runbook that clears inherited environment values, sets an explicit throwaway/branch `DIRECT_URL`, displays and verifies the selected host/database before any write, and refuses production-looking targets. Keep pooled runtime `DATABASE_URL` separate from migration/admin credentials.

### S-06 — MAJOR — current schema documentation will become false after the purge

**Evidence:** `docs/schemas/README.md:3-9`; `docs/schemas/database-model.md:31-52,56-65,137-156,171-177`; `docs/architecture-audit-2026-09-23.md:74-75`; `docs/refactor-dossier/phases/20-schema-and-migration.md:203-207`.

`database-model.md` is called current but still documents all four dropped tables, the six capability values, rate limiting, and old capability/audit constraints. An engineer following it would reintroduce removed models or assume audit/rate-limit retention that migration 6 removes. The architecture audit also says “5 migrations” while the tree has six.

**Required disposition:** update this model document and linked current-architecture claims in the same schema/migration change, with the surviving model inventory, role-based authorization, Neon Auth boundary, and explicit dropped-table disposition. Add a stale-name check for the four dropped tables.

### S-07 — MAJOR — R1 remains a release blocker

**Evidence:** `docs/refactor-dossier/phases/20-schema-and-migration.md:200-201,257`; `docs/current-architecture.md:247-261`; `docs/implementation/slice-03-05-portal-handoff.md:24-37`; `src/server/db/client.ts:10-24`; `src/server/db/prisma-game-state-store.ts:15-134`; `src/server/db/prisma-player-access-store.ts:203-261`.

The phase’s explicit “R1 is not closed” wording is correct and should be preserved. The server persistence code is real: the Neon adapter is constructed from `DATABASE_URL`, and stores use transactions/raw locks. None of those paths has been exercised against a database in this audit.

**Required disposition:** retain R1 as a blocking acceptance item, with a staging target, migration deploy/status, server boot, auth/profile binding, and transaction/retry/reporting smoke tests. The absence of a local real connection is not a pass condition.

### S-08 — MINOR — Step 6 residue gate is incomplete

**Evidence:** `docs/refactor-dossier/phases/20-schema-and-migration.md:140-143`; `src/server/db/prisma-capability-reader.ts:1-17,26-45`; `src/app/(professional)/portal/atividades/actions.ts:122,129,137,148`; `src/server/services/access-link-service.ts:2`; `src/server/services/authorization-service.ts:1`; `tests/unit/access-link-service.test.ts:4`; `tests/unit/authorization.test.ts:3`.

The stated regex does not detect lowercase `capabilityAssignments` or lowercase `capability` properties in `prisma-capability-reader.ts`. The current enum importer count is five when tests are included, not the phase’s “four files” wording. This is not fatal because Phase 10 is intended to delete these files and TypeScript catches generated-enum residue, but the gate is not complete proof.

**Required disposition:** use a case-insensitive token/property sweep or import-graph check, include tests, and make the post-Phase-1 source inventory authoritative.

### S-09 — MINOR — 227-line schema acceptance number is whitespace-sensitive

**Evidence:** `docs/refactor-dossier/phases/20-schema-and-migration.md:135-138,195`; `docs/refactor-dossier/reports/RV-20-schema-refutation.md:83-108`.

The inherited refutation records 227 versus 228 for the same full recipe depending on trailing blank lines, while 247/251 are different recipes that keep `AuditEvent`. A semantically identical file can pass or fail this check. Physical line count is not a migration invariant.

**Required disposition:** gate model/enum/relation names, `prisma validate`, and generated SQL statement set. If a line-count baseline is retained, state the byte/newline convention or remove it from the correctness gate.

### S-10 — MINOR — relation-field wording is inaccurate

**Evidence:** `docs/refactor-dossier/phases/20-schema-and-migration.md:125-128`; `REFACTOR_PLAN.md:79-83`; `prisma/schema.prisma:65,79-80,97`.

The plan already names `:65`, `:80`, `:79`, and `CapabilityAssignment`; only `OrganizationMembership.capabilityAssignments` at `:97` is omitted from the plan’s relation list. The edit set is correct, but the wording obscures which omission is repaired.

**Required disposition:** name each field and call out `:97` explicitly as the unlisted relation.

## Confirmed claims

These conclusions are supported by direct source reading and the scratch replay, subject to the safety blockers above:

1. **The literal plan recipe is invalid until `schema.prisma:97` is removed.** `OrganizationMembership.capabilityAssignments` points to the deleted `CapabilityAssignment`; the plan’s list at `REFACTOR_PLAN.md:79-83` omits it. The Phase 20 P1012 reproduction at `docs/refactor-dossier/phases/20-schema-and-migration.md:109-123` is correct.
2. **The full post-purge schema is structurally valid.** The BOM-free scratch copy validated with Prisma 7.9.1.
3. **The migration SQL is 10 statements, not 8 or 9.** The fresh replay emitted five `DROP CONSTRAINT`, four `DROP TABLE`, and one `DROP TYPE`; the fifth constraint is `audit_events_actor_id_fkey` (`prisma/migrations/0_init/migration.sql:156`).
4. **The known FK ordering is safe.** `0_init/migration.sql:144,147,150,153,156` defines all five dropped-table-owned FKs. No migration references a dropped table as a target, and the generated order drops constraints before tables.
5. **The `capability` enum has no checked-in surviving consumer after the purge.** `0_init/migration.sql:8,50,114,160` uses it with `capability_assignments`; the corresponding model/enum blocks are `prisma/schema.prisma:18-27,245-259`. This is object-level safety, not a rollback/backup guarantee.
6. **`paused_at` becomes a historical no-op in the post-purge shape.** `1_add_paused_at/migration.sql:1-3` alters a table migration 6 drops. Sequential history can be retained, but it does not prove a real target is current.
7. **Migration 2’s role backfill must precede the drop.** `2_v1_adult_roles_and_classes/migration.sql:13-27,32-44` reads capability assignments and makes membership roles non-null; this supports sequential history and reinforces the existing-row warning.
8. **Neon Auth is outside the Prisma application-owned schema boundary.** `prisma/schema.prisma:6-8` has only the PostgreSQL provider; `prisma.config.ts:6-11` configures the application datasource; `docs/schemas/database-model.md:13-29` says `neon_auth` is provider-owned; `src/server/auth/neon-server.ts:3-20` uses the official adapter. No migration contains `neon_auth`, and no Prisma model exposes provider credentials/sessions. `src/server/auth/neon-gateway.ts:31-87` resolves the provider identity through `professional_profiles.authUserId` and rejects missing/inactive profiles; `tests/unit/neon-auth-gateway.test.ts:20-75` covers the cases.
9. **Legacy stores are coupled to purged models.** `src/server/db/prisma-access-link-store.ts:71-105,193-229` uses `client.accessLink`; `src/server/db/prisma-capability-reader.ts:14-45` reads `capabilityAssignments`; `REFACTOR_PLAN.md:49-56` names both for deletion. The V1 stores use surviving models in `src/server/db/prisma-game-state-store.ts:37-60,83-121` and `src/server/db/prisma-player-access-store.ts:66-117,203-261`.
10. **V1 authorization is role-based.** `src/server/authorization/v1-policy.ts:1-5,46-85` enforces platform/organization/teacher scope. `tests/unit/v1-authorization.test.ts:34-123` covers role and assignment boundaries. This supports removing the old capability layer after Phase 10, but does not support deleting audit or rate-limit requirements.
11. **V1 GameMaker contracts need not change for this schema purge.** `tests/unit/v1-contracts.test.ts:27-63` loads `contracts/schemas/v1/*`; `src/contracts/v1/schemas.ts:159,161,246` retains Portuguese bridge fields. The browser error JSON is not in that test glob.
12. **Player credentials and launch tokens are separate from adult auth and not stored raw.** `src/server/security/player-credential-tokens.ts:8-23` issues 256-bit tokens and stores SHA-256 digests; `src/server/security/tokens.ts:14-50` applies the same pattern to legacy links. `src/server/db/prisma-player-access-store.ts:207-220` locks the credential digest; `src/server/db/prisma-game-state-store.ts:21-60` rechecks credential/session/player scope. These controls do not replace rate limiting or prove migration correctness.

## Gate and data-loss assessment

| Concern | Current result | Release implication |
|---|---|---|
| Schema self-consistency | `prisma validate` passes; plan omission reproduced as P1012 | Good local check; does not inspect history |
| SQL generation | Fresh scratch diff emits the correct 10 statements | Good authoring check; still needs artifact review |
| Migration history | Six SQL files, 386 lines, sequential | Preservable; not proven to apply |
| Destructive SQL | Four tables and the `capability` enum are dropped | Target inventory, backup, approval mandatory |
| Schema drift | No gate by adopted policy | Release blocker or restore gate |
| Neon/Auth ownership | No Prisma access to `neon_auth`; provider boundary present | Correct boundary; no real Neon test |
| Auth tests | Gateway/environment tests are faked | No provider/database integration |
| Rate limiting | Model/code slated for deletion; player POST routes remain | Security requirement not met by purge |
| Audit retention | Legacy writer deleted; no real reader | Data-loss decision unresolved |
| Contracts | V1 schemas tested; browser error JSON untested | V1 surface safe; error parity unguarded |
| CI/deploy | Pages workflow builds demo only; no `ci.yml` | No migration/server production gate |
| R1 | Explicitly not closed | Must block production acceptance |



## Required disposition

1. Add an explicit database-target inventory and fail-closed migration runbook; do not infer a safe target from `.env` placeholders.
2. Decide whether `AuditEvent` rows are disposable prototype data or retained records. If retained, remove the drop and design a writer/reader; if discarded, document the loss and require backup/approval.
3. Preserve the product-required rate limiter or explicitly remove the production public API claim. Add executable 429/contract tests before deleting `RATE_LIMITED`.
4. Restore an owner for migration applicability/drift validation, including a SQL artifact test and controlled throwaway/development-branch deploy/status check.
5. Update `docs/schemas/database-model.md` and all “current” model/authorization/rate-limit/audit descriptions in the same change.
6. Keep R1, real Neon migration deployment, server boot, auth/profile binding, and two-device/QR/reporting acceptance as release blockers.
7. Replace the line-count-only 227 assertion with object/relation/SQL invariants and correct the S-08/S-10 wording.

## Coverage limits and non-findings

- No database was contacted; this report cannot assert that a real database has zero rows, no `_prisma_migrations` table, or a matching applied history.
- `migrate diff --from-migrations` was not run because it requires a shadow database. Local Prisma help and `prisma.config.ts:1-11` establish the command/config limitation; inherited Phase 00 evidence records its prior non-functional result.
- `prisma generate`, typecheck, Vitest, and full builds were not run. Existing generated and build artifacts were not treated as fresh post-purge validation.
- The external `Heroes_Trial` repository, live Pages traffic, real Neon Auth users, and production database contents were not inspected.
- This report does not claim the four player routes are production-safe; the code review establishes the opposite unresolved rate-limit gap.
- Claims not checked directly are not treated as confirmed: live Neon schema contents, `_prisma_migrations` state, actual row counts, migration apply behavior on PostgreSQL/Neon, branch-protection/CI runtime behavior, external API consumers, and real-device acceptance.

## Final disposition

**Technical SQL recipe: verified. Destructive migration procedure: not safe for handoff. Schema documentation: stale. Neon/Auth boundary: correctly isolated but unverified against a real provider/database. R1 and the audit/rate-limit data decisions remain release blockers.**

The next safe action is a human-approved, target-specific database plan—not applying the generated `DROP` script, not running `migrate dev`/`db push`, and not treating `prisma validate` or the static demo build as evidence that the migration is production-safe.
