# ADJ-01 — Main-agent adjudication: Prisma purge schema, validation blocker, and the diff command

Two verification agents reached **contradictory** conclusions about the same tool invocation, so the main agent reproduced both by hand. This file is the tiebreak. Everything below was executed on 2026-09-23 in a scratch directory **outside** the repository (`$TMPDIR/tmp.BJ0CH6cuOr`); `prisma/schema.prisma` in the repo was never modified, and no database was contacted.

## 1. The §2.5 validation blocker is real (reproduced personally)

`REFACTOR_PLAN.md` §2.5 names three inverse relations to remove (`ProfessionalProfile.createdAccessLinks` `:65`, `Organization.scopedCapabilities` `:79`, `Organization.accessLinks` `:80`) plus `model CapabilityAssignment`, `model AccessLink`, `model RateLimitBucket` and `enum Capability`. Applying **exactly** that set:

```
$ npx prisma validate --schema $TMP/plan_literal.prisma        # 3 relation fields removed
   → error: P1012  (output quotes `:83 | organization ... @relation(...)`
                    and `:84 | capabilityAssignments CapabilityAssignment[]`)
```

Applying the set **plus** the unlisted fourth relation `OrganizationMembership.capabilityAssignments` (`prisma/schema.prisma:97`):

```
$ npx prisma validate --schema $TMP/to.prisma                 # 4 relation fields removed
   → The schema … is valid 🚀
```

Derived line count: 310 → 251 (four model/enum blocks + four relation lines). The headline stands: **executing §2.5 verbatim turns Day 1's own gate red.** This was found independently by `INV-A`, `INV-C` and `INV-F`, and reproduced by `VER-A` and now by the main agent — five agreements, no disagreement anywhere in this pass.

## 2. `prisma migrate diff` works — `VER-A`'s refutation of it is itself refuted

`VER-A` claimed "`migrate diff --from-schema/--to-schema --script` returned empty with exit 0 for differing schemas, so the migration must be eyeballed". **That result does not reproduce.** The main agent's run:

```
$ npx prisma migrate diff --from-schema $TMP/from.prisma --to-schema $TMP/to.prisma --script
```

produced exactly **8 statements** (`EXIT=0` because there is nothing to report, not because the diff was empty):

```sql
-- DropForeignKey
ALTER TABLE "capability_assignments" DROP CONSTRAINT "capability_assignments_membership_id_fkey";
-- DropForeignKey
ALTER TABLE "capability_assignments" DROP CONSTRAINT "capability_assignments_scope_organization_id_fkey";
-- DropForeignKey
ALTER TABLE "access_links"           DROP CONSTRAINT "access_links_organization_id_fkey";
-- DropForeignKey
ALTER TABLE "access_links"           DROP CONSTRAINT "access_links_created_by_id_fkey";
-- DropTable
DROP TABLE "capability_assignments";
-- DropTable
DROP TABLE "access_links";
-- DropTable
DROP TABLE "rate_limit_buckets";
-- DropEnum
DROP TYPE "capability";
```

This matches `INV-C`'s and `VER-C`'s independently produced SQL, which they described as byte-identical to each other. `VER-C`'s recipe is therefore the one to publish. The four FK constraints dropped are all owned by the dropped tables — confirming `INV-C`'s "no FK-ordering problem on surviving tables" finding, and matching my own read of the schema's `fields/references` pairs.

**Caveat worth keeping:** the flag names are `--from-schema` / `--to-schema` (confirmed from `npx prisma migrate diff --help` in 7.9.1). `--from-schema-datamodel` / `--to-schema-datamodel` no longer exist, so `VER-A`'s underlying point — that the prior review's `RV-D` recipe is invalid for Prisma 7 — is correct even though its empty-diff observation is not. `--exit-code` semantics are documented in that same help text as *Empty: 0, Error: 1, Not empty: 2*, which is what a CI drift gate should assert on.

## 3. Two hazards that survive from the verification pass unchanged

1. **`migrate deploy` resolves its connection from `DIRECT_URL`, not `DATABASE_URL`** (`VER-C`). The "prove the migration history applies" step therefore cannot be run casually from a shell that has a real `.env`: pointed at the placeholders in `.env` it contacts the Neon host, and pointed at a filled `.env` it may contact a real branch. The dossier must publish an explicit connection-string override for a throwaway database rather than the bare command.
2. **`DROP TYPE "capability"` destroys the PostgreSQL enum created in `0_init`.** Harmless today because no database has ever been created (audit risk R1 is still open), but it is irreversible the moment one exists, and the enum carries four non-link values whose readers the purge removes. `VER-C` settled the privilege question: those four values have **zero** readers outside the deletion set (`src/application/authorization/v1-policy.ts` is role-only), so this is not a privilege regression and audit risk R5 is void.

## 4. What the dossier should state as the Day-1 schema procedure

1. Remove the **four** relation lines first (`:65`, `:79`, `:80`, `:97`), then `model CapabilityAssignment`, `model AccessLink`, `model RateLimitBucket`, `enum Capability`.
2. `npx prisma validate` — must pass. This is the step §2.5 currently fails.
3. Generate the SQL with the §2 command above into `prisma/migrations/6_drop_generation_a/migration.sql`, and **review it line by line** — 8 statements is small enough that eyeballing is not a concession, it is the correct control.
4. Apply the whole history to a throwaway Postgres with an explicit `DIRECT_URL` override to close R1, then add `migrate diff --from-migrations … --to-schema … --exit-code` (needs `datasource.shadowDatabaseUrl`, absent from `prisma.config.ts`) as the CI drift gate.
5. `npx prisma generate`, then `npm run typecheck`.

## 5. Claims in this file

All measurements above are the main agent's own. Where this file contradicts a subagent report, it names the report. Related: `INV-C`/`VER-C` (full derivation), `VER-A` §refutations (the disputed command), `docs/refactor-dossier/CRITIQUE-governing-conflicts.md` §3 (the D6 / `RATE_LIMITED` contract question, which is a separate decision from the model drop).
