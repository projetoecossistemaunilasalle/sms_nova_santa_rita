# Phase 20 / schema and migration — independent adversarial verification

**Verification date:** 25 September 2026
**Repository:** `C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal`
**Baseline:** `main` at `e5aaf1e2891dbb1804950223eb9f0765e7dbeb65` (2026-09-23 17:49:16 -0300), branch `main`, remote `origin`
**Target under test:** `docs/refactor-dossier-audit-2026-09-25/03-schema-migration-primary.md`
**Subject of the test:** `docs/refactor-dossier/phases/20-schema-and-migration.md` (302 lines)

**Method.** Read-only. Every Prisma invocation was `node node_modules/prisma/build/index.js …` executed from the repository root, against scratch copies of `prisma/schema.prisma` written outside the repository under `%TEMP%`. **No database was contacted.** `DATABASE_URL` and `DIRECT_URL` were explicitly cleared for the one command that could otherwise attempt a connection (`migrate diff --from-migrations`), and the resulting error proves the clearing worked. No `migrate dev`/`deploy`/`reset`/`db push`/`db execute`, no `prisma generate`, no build, no test run. No repository source, config, test, schema, migration, or dossier file was edited. This report is the only file created by this verification pass.

**Verdict summary: 9 UPHELD · 2 UPHELD-WITH-CORRECTION · 1 PARTIALLY UPHELD (severity overstated) · 0 REFUTED · 9 previously unclaimed findings.**

The primary report is technically sound on every measurement I could reproduce. Its two weakest points are (a) it grades the database-absence question one notch too high, and (b) it softens two arithmetic/provenance errors into "whitespace-sensitivity" and "importer count". Nine material defects present in the phase — including two vacuous exit gates, a self-contradicting step-5 line count, an information-losing role backfill, and a demotion of the only rate-limit requirement documents — are absent from the primary.

---

## 1. Reproductions

All figures below are from this pass, not from the primary or the inherited reports.

| # | Claim under test | Result |
|---|---|---|
| R1 | Local Prisma / Node | `prisma 7.9.1`, `@prisma/client 7.9.1`, `win32 x64`, `Node.js v22.23.1`, `TypeScript 6.0.3`, schema-engine `e922089b…` |
| R2 | `schema.prisma` valid at HEAD | `… validate` → exit **0**, `The schema at prisma\schema.prisma is valid` |
| R3 | Schema shape | **310** lines, **16** `^model `, **6** `^enum `; `enum Capability` at `:18` |
| R4 | Migration SQL line counts | **175, 3, 82, 60, 15, 51**; total **386** |
| R5 | Tracked migration files | 6 `migration.sql` + `migration_lock.toml` + `schema.prisma` |
| R6 | `migrate diff --help` inputs, no `shadow` | Exactly `--from-empty/--to-empty`, `--from-schema/--to-schema`, `--from-migrations/--to-migrations`, `--from-config-datasource/--to-config-datasource`; flags `--script`, `--exit-code`, `-o/--output`, `--config`. **Zero** occurrences of `shadow` |
| R7 | `--exit-code` semantics | exit **2** (not empty). Without the flag, same diff → exit **0** |
| R8 | Drop-script statement set | **10**: 5 `DROP CONSTRAINT`, 4 `DROP TABLE`, 1 `DROP TYPE`; 5th constraint is `ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_actor_id_fkey";` |
| R9 | Post-purge counts | **12** models, **5** enums |
| R10 | Purged copy valid | exit **0** |
| R11 | Plan-literal P1012 | delete only `18-27, 65, 79-80, 245-259, 261-279, 300-310` → **58 deletions, 252 lines**, exit **1**, `P1012 … Type "CapabilityAssignment" is neither a built-in type…` at scratch **:84** with `organization` at `:83`. Head arithmetic 10+1+2 = **13**, so `:96 → :83`, `:97 → :84` |
| R12 | **`--from-migrations` needs a shadow DB, no DB contact** | with `DIRECT_URL=`/`DATABASE_URL=` cleared: exit **1**, ``Error: You must set `datasource.shadowDatabaseUrl` in your `prisma.config.ts` if you want to diff a migrations directory.`` |
| R13 | Phase's own steps 3–5 recipe | delete `18-28, 65, 66, 79, 80, 97, 245-260, 261-280, 281-299, 300-310` → **82 deletions → 228 lines**, valid, 12/5. One further blank trim gives 227 |
| R14 | Emitted file size | **30** lines (10 comment, 10 statement, 10 blank), 747 bytes, final byte `0x0A` → `wc -l` = **30**, content lines **29** |
| R15 | Banner does not contaminate redirection | `Loaded Prisma config…` and the `Update available 7.9.1 -> 8.0.0-rc.17` box go to **stderr**; stdout starts `-- DropForeignKey`. `> migration.sql` is safe |
| R16 | 16 tables in history vs 12 models | **16** unique `CREATE TABLE`: the 12 survivors + `access_links`, `audit_events`, `capability_assignments`, `rate_limit_buckets` |
| R17 | No FK points into the drop set | `REFERENCES "(access_links\|capability_assignments\|rate_limit_buckets\|audit_events)"` → **no matches** |
| R18 | `audit_events` confined to `0_init` | `0_init` `:74, 86, 126, 129, 132, 156`; **zero** hits in any later migration |
| R19 | No other DB objects complicate the drop | no `CREATE VIEW/FUNCTION/TRIGGER/POLICY/RULE`, no `ALTER TYPE` anywhere |
| R20 | Datamodel cannot express the raw constraints | `migrate diff --from-empty --to-schema <purged> --script` → **270** lines, 5 `CREATE TYPE`, 12 `CREATE TABLE`, 19 `CREATE INDEX`, **0 `CHECK`**, **0 `gen_random_uuid`** — the 8 surviving CHECKs, 2 partial unique indexes and 6 `gen_random_uuid()` defaults are invisible to the datamodel |
| R21 | Phase's `ci.yml` gate target exists | `Test-Path .github/workflows/ci.yml` → **False**; `git ls-files .github/workflows` → `deploy.yml` only |
| R22 | `grep` on a missing file | `grep -c` on an absent path writes nothing to stdout and exits **2**; a `grep -n … -> no output` clause is **satisfied by the file's absence** |
| R23 | `git diff --name-only HEAD` on a new file | throwaway repo: **empty output** (exit 0) while untracked; the path appears **only after `git add`** |
| R24 | `.env` provenance | `.env` is a **subset** of `.env.example`: every shared key byte-identical, minus `APP_RUNTIME_MODE` and `GAME_CLIENT_URL`, plus `AUTH_DEV_BYPASS=true` (example: `false`). Both URLs are `user:password@ep-example…` |
| R25 | Step-6 regex blindness | `src/server/db/prisma-capability-reader.ts` holds `CapabilityReader`, `PrismaCapabilityReader`, `ProfileCapabilitySnapshot`, `capabilityAssignments` — **none** match the phase's regex. The file is invisible to the gate |
| R26 | Enum importers of `Capability` | Exactly **5**: `access-link-service.ts:2`, `authorization-service.ts:1`, `atividades/actions.ts:122` (dynamic), `tests/unit/access-link-service.test.ts:4`, `tests/unit/authorization.test.ts:3`. **`prisma-capability-reader.ts` is not one of them** — it imports types from `authorization-service` |
| R27 | Nothing in-repo can create a database | **zero** `migrate deploy`/`migrate dev`/`db push`/`db execute` in `package.json`, `scripts/`, workflows, or `Dockerfile`. Only 3 hits, all prose in `architecture-audit-2026-09-23.md` (`:571, :711, :779`) |
| R28 | `RATE_LIMITED` / 429 / `rateLimitBucket` reach | `RATE_LIMITED` in exactly 3 places (`errors.ts:11`, `api-error.v1.schema.json:21`, `atividades/actions.ts:181`); **`429`: 0 hits** in `src`/`tests`/`scripts`; `rateLimitBucket`: 0 hits outside `src/generated` |
| R29 | `neon_auth` boundary | **0** `neon_auth` hits in any migration; `datasource db` is provider-only (`schema.prisma:6-8`) |
| R30 | Shadow key is config-only | `node_modules/@prisma/config/dist/index.d.ts`: `export declare type Datasource = { url?: string; shadowDatabaseUrl?: string; }` — the key exists, the CLI flag does not |

---

## 2. Claim-by-claim verdicts on the primary report

### S-01 — "Placeholder `.env`/documentation does not prove that no real database exists" — **PARTIALLY UPHELD, severity overstated (Blocker → Major)**

**What holds.** The primary's logical point is correct and I endorse it: absence of a usable connection string in *this* checkout is not evidence about *any* Neon branch, and `.env` is not the only place a target can be configured. A fail-closed target-selection control is genuinely required, and the proposed disposition (explicit `DIRECT_URL` override, displayed and verified before any write) is the right control.


**What is overstated — and this is the specific question the brief asks me to settle.** The primary grades this a **Blocker** and asserts the phase "turns a local placeholder-URL observation into a global safety fact." The evidence makes the phase's factual claim *corroborated*, not merely unproven:

1. **Four independent attestations of no applied migration**, across three documents: `docs/architecture-audit-2026-09-23.md:39` ("No migration has been applied to a real Neon database"), `:75`, `:779` (R1: "Migrations were never applied to a real database"); and `docs/implementation/slice-03-05-portal-handoff.md:36` ("no migration has been applied to a real database"). The primary cites `:39-41, 74-75` and the handoff but treats them as *insufficient*, without engaging that they are mutually reinforcing and were written by different passes.
2. **The untracked `.env` is demonstrably a copy of the example, not a provisioned file** (R24). Every shared key is byte-identical to `.env.example`; the only divergences are the removal of two keys and `AUTH_DEV_BYPASS=true`. A `.env` produced by a real Neon provisioning step would not contain `user:password@ep-example-pooler…`. This is provenance evidence, materially stronger than "the values look like placeholders".
3. **Nothing in the repository can create a database** (R27). No `migrate` script in `package.json`; no `migrate deploy`/`db push`/`db execute` in `scripts/`, either workflow, or the `Dockerfile`; `deploy.yml:30-34` runs `npm ci` + `npm run build:demo` only; the `Dockerfile` never migrates. The seven-directory chain has no automated executor.
4. **The phase already carries a fail-closed stop condition** at `phases/20-schema-and-migration.md:21`: "If a `_prisma_migrations` table turns out to exist anywhere, stop and re-open the whole phase." The primary's demanded disposition therefore partly already exists and is not credited.

**Correction.** The correct finding is not "the premise is unproven" but: **the premise is well-supported for this repository, and the control still missing is fail-closed target *selection* at the moment of a future `migrate deploy` — not an inventory proving a negative.** Severity **Major**. The primary's executive-verdict item 1 ("Do not run or approve the migration against any unverified database") remains correct and should be preserved.


### S-02 — "No automated gate compares migration history to the post-purge schema or proves the seven-directory chain applies" — **UPHELD, and strengthened beyond what the primary claimed**

Every element reproduces. `prisma validate` is the only schema check and `.github/workflows/ci.yml` does not exist (R21); `deploy.yml` builds the demo only; the Prisma store tests are fakes — `tests/unit/game-state-prisma.test.ts:16` is `$queryRaw: vi.fn(async (query: {sql: string; values: unknown[]}) => {…})`, a mocked client, so no SQL executes anywhere in the suite.

**The primary filed this under its coverage limits rather than as evidence:** "`migrate diff --from-migrations` was not run because it requires a shadow database." I ran it, safely, and it is stronger evidence than "not run": R12 reproduces the exact blocking error and exit **1** with both connection variables cleared, so no database was contacted. Combined with R30 (`shadowDatabaseUrl` is a real key in the installed `@prisma/config` type, absent from the repo's 12-line `prisma.config.ts`) and R6 (no CLI flag), the phase's claim that `--from-migrations` cannot be replaced by a flag-only one-liner is **independently confirmed**. The conclusion — that the refactor ships with *no* schema-drift gate rather than a cheaper one — is correct and is adopted at `COMPAT-POLICY.md:69`.

### S-03 — "Dropping `AuditEvent` destroys possible historical audit rows without an explicit retention/export decision" — **UPHELD, with a framing correction**

**Holds.** `model AuditEvent` is `schema.prisma:281-298`; its table is `0_init:74-87` with three indexes (`:126, 129, 132`) and the FK at `:156`; the only writer is `src/server/db/prisma-access-link-store.ts:325-326` (`this.client.auditEvent.create({…})`), in the Phase 10 deletion set (`REFACTOR_PLAN.md:50`); the only reader is `src/app/(professional)/portal/admin/auditoria/page.tsx:4,54`, also deleted, fed by `src/server/services/portal-view-service.ts:416` = `export const auditEvents = demoRuntime ? demoAuditEvents : [];` — verified verbatim at that line. `PRODUCT.md:141` does assign "administrative traceability where required" to the portal.

**Framing correction.** The primary says the decision is "unresolved." It was made and adopted. `REFACTOR-DOSSIER.md:83` (D-6) records option **(b) drop it too**; `COMPAT-POLICY.md:75` (§4 edit 7) adopts it, with `COMPAT-POLICY.md:30` supplying the code-level refutation; `phases/20:133` cites that ruling correctly. What is genuinely missing is narrower: **a retention decision is a different artifact from a code decision.** D-6's refutation — "no code ever *read* the table" — is an argument about readers *in this repository*. It is not an argument about *rows* in an external database, and no document addresses the second question.

### S-04 — "Deleting rate-limit persistence leaves public server routes without required abuse control" — **UPHELD; the primary understates the governance severity**

Every measured element reproduces (R28): zero `429` in `src`/`tests`/`scripts`; `rateLimitBucket` referenced only by the generated client; `RATE_LIMITED` live in three places; the four `/api/v1/player/*` handlers are real `export const runtime = "nodejs"` route handlers (e.g. `src/app/api/v1/player/bootstrap/route.ts:12-27`); and a production server target exists — `next.config.ts:32` `output: "standalone"`, `Dockerfile:13` `RUN npm run build` = `build:server`. The routes are not dead merely because the Pages artifact omits them.

**What the primary missed, and it is the strongest single fact here: the purge reverses a standing architecture-audit security decision without recorded authorisation.** `docs/architecture-audit-2026-09-23.md:798` reads `| D6 | Rate limiting: implement or delete? | implement with \`RateLimitBucket\` | Implement for the four player endpoints and sign-in (they are the abuse surface); the port makes a Redis swap possible later. |`, and `:150` reads "`RateLimitBucket` model - nothing reads/writes it … implement rate limiting or drop the model and the `RATE_LIMITED` code." The dossier acknowledges the conflict — `REFACTOR-DOSSIER.md:82` (D-5) opens "The audit's D6 says implement, but Phase 6 step 3 authorises 'or delete'" — then chooses delete, and `COMPAT-POLICY.md:102` adopts it. The primary cites neither `:798` nor `:150`. Deleting a control an architecture audit mandated, on the strength of a compatibility-policy ruling, is a **security-decision reversal**, not schema cleanup.

**See U-1 below: the only two documents stating the rate-limit requirement are self-declared non-authoritative — which weakens the primary's evidence base while strengthening its conclusion.**


### S-05 — "`prisma.config.ts` auto-loads `DIRECT_URL`; a future migration command can target a real Neon branch without a fail-closed target-selection runbook" — **UPHELD**

`prisma.config.ts` is 12 lines: `:1` `import "dotenv/config";`, `:4` `const directUrl = process.env.DIRECT_URL;`, `:11` `...(directUrl ? { datasource: { url: directUrl } } : {})`. The `datasource` block in `schema.prisma:6-8` declares only `provider`. The structural hazard is real and the phase concedes it at `:180`. R12 shows the flip side of the same mechanism: that config load is what *blocks* `--from-migrations` when no URL is present, so a runbook that clears the environment is the correct control in both directions. No correction.

### S-06 — "`docs/schemas/database-model.md` is labeled current but still documents all four tables, six capabilities, and rate-limit/audit invariants" — **UPHELD, and understated**

`docs/schemas/database-model.md:1` is "# Current database model"; `:3-5` "Status: current description of the reconciled persistence model". `docs/schemas/README.md:3-5` reinforces it: "the Prisma model and `database-model.md` … **are current**." The file documents the four dropped tables at `:49-52` (table list), `:37-41` (Mermaid ER), `:79-86`, `:127`, `:139` (prose), `:151-156` (CHECK table). The primary's "5 migrations" catch is confirmed: `architecture-audit-2026-09-23.md:75` says "(`5 migrations`)" while the tree has six.

**Two stale claims the primary did not name:**
- `database-model.md:8-11` designates `prisma/migrations/0_init/migration.sql` as "the baseline migration" and reasons "Nothing is deployed yet, so the baseline replaces the earlier multi-activity model without keeping legacy tables." Under Option A there is no single baseline, and `:10`'s inference depends on the very absence-of-deployment claim S-01 shows is *supported but not proven*.
- `database-model.md:127` states "`audit_events` is append-only" and `:177` that "Expired rate-limit buckets are the only routinely deleted rows" — a retention policy the purge invalidates on both clauses at once.

### S-07 — "R1 remains a release blocker" — **UPHELD**

`phases/20:200-201` states R1 is explicitly not closed, and the disposition is right. The server persistence path is real: `src/server/db/client.ts` builds the Neon adapter from `DATABASE_URL`, and the V1 stores use transactions and raw locks. Nothing in my pass exercised any of it, and I do not claim otherwise.

### S-08 — "Step 6's residue regex misses lowercase generated Prisma properties and its importer count is incomplete" — **PARTIALLY UPHELD; the primary's specific claim is wrong**

The blindness is real and I reproduce it precisely (R25): `prisma-capability-reader.ts` contains `CapabilityReader`, `PrismaCapabilityReader`, `ProfileCapabilitySnapshot`, and `capabilityAssignments`, none of which the phase's regex `Capability\.\|CapabilityAssignment\|AccessLink\|RateLimitBucket\|AuditEvent` matches.

**But the primary's second claim is incorrect as stated.** It says "The current enum importer count is five when tests are included, not the phase's 'four files' wording." The number five is right (R26), but the primary frames it as a miscount. The actual defect is worse and different: the phase's list of four (`phases/20:142`) is `atividades/actions.ts`, `access-link-service.ts`, `authorization-service.ts`, and **`prisma-capability-reader.ts:5-17`** — and the fourth of those **does not import the generated enum at all**. It imports `CapabilityReader` / `ProfileCapabilitySnapshot` *types* from `@/server/services/authorization-service` (`:4-7`). So the phase's diagnostic names a file for the wrong reason, while omitting the two test files that genuinely do import `Capability`. The correct statement: the phase's four-file list is wrong in composition, and its "**If it fails:**" branch would send an implementer to inspect a file that was never an importer.

**Correction to the primary:** replace "importer count is incomplete" with "`phases/20:142`'s fourth named file is not an enum importer, and the two genuine test-file importers are unlisted."

### S-09 — "The 227-line schema gate is whitespace-sensitive and should not be a correctness criterion" — **UPHELD-WITH-CORRECTION: the phase's number is simply wrong, not merely fragile**

The primary is too generous. I executed the phase's own recipe exactly as written in steps 3–5 (R13): **82 deletions → 228 lines**, valid, 12 models, 5 enums. The `227` in `phases/20:137` ("`wc -l` → **227**") and in the Exit gate at `:195` ("`prisma/schema.prisma` is **227 lines** on this recipe") is **not produced by that recipe**. Reaching 227 requires deleting one further blank line the recipe never names. The inherited `RV-20` table records both variants (`:90` 228 / `:91` 227) and the primary repeats that framing as "whitespace-sensitivity" (`:125`, "A semantically identical file can pass or fail this check").

The stronger, correct finding: **the phase asserts a measured value for a recipe that does not produce it, and books that value as an acceptance criterion in the same file.** That is a false-precision defect in an execution document, not a philosophical objection to line-count gating. The primary's recommended remedy (gate model/enum/relation names, `prisma validate`, and the SQL statement set instead) is right and should be adopted; but the 227/228 contradiction should be recorded as a factual error to correct, not as an ambiguity to tolerate.

### S-10 — "The work order calls all four relation fields 'unlisted by plan', although only `:97` is omitted by the plan" — **UPHELD**

`REFACTOR_PLAN.md:79-83` names `:65` (item 2), `:80` (item 2), `:79` and `model CapabilityAssignment` (item 3). Only `OrganizationMembership.capabilityAssignments` at `schema.prisma:97` is absent. `phases/20:125` calls them "the four unlisted-by-plan relation fields", obscuring that only one is a genuine plan omission. Correct and correctly minor.

---


## 3. Previously unclaimed findings

These are absent from the primary. Each is reproducible.

### U-1 — The rate-limit requirement's only written homes are self-declared non-authoritative — **Major**

`docs/schemas/README.md:3-9`: "The remaining notes (`api-contracts.md`, `domain-rules.md`) and the shared GameMaker HTTP schemas still describe the earlier multi-activity/module architecture; their catalogue and activity-composition concepts **are not the source of truth for new product behavior**."

Those two documents are precisely where the requirement lives: `docs/schemas/api-contracts.md:138-148` ("Counts use expiring PostgreSQL fixed-window buckets… A rejected request returns `429`, `Retry-After`…") and `:232` (the `429` row); `docs/schemas/domain-rules.md:161-168` ("Application rate limits use expiring PostgreSQL fixed-window buckets… return `429` with `Retry-After`").

So the primary's S-04 evidence base (`api-contracts.md:135-145`, `domain-rules.md`) is drawn from documents the repository itself disqualifies. This does **not** rescue the purge — the audit's D6 ruling at `architecture-audit-2026-09-23.md:798` is authoritative and un-reversed — but it changes the fix: the requirement cannot simply be "preserved in the docs." It needs an authoritative home **before** the model is deleted, or the deletion silently removes a security control whose only written specification is already marked as not governing.

### U-2 — Two of the phase's own exit gates are vacuous or unsatisfiable today — **Major**

`phases/20:167` and `:197` both gate on `.github/workflows/ci.yml`:
- `grep -n "migrate diff\|shadowDatabaseUrl\|SHADOW_DATABASE_URL\|services:" .github/workflows/ci.yml` → **no output**
- `grep -c "prisma validate" .github/workflows/ci.yml` → **1**

The file does not exist (R21). Per R22, `grep -c` on an absent path produces no stdout and exits 2, so the first clause is **satisfied by the file's absence** — it cannot distinguish "no drift gate was built" from "there is no CI at all". The second clause is **unsatisfiable** and would be red. The inherited `RV-20:267-270` flags exactly this ("two gates would read green on a wrong artifact and one red on a right one"); the primary omits it entirely.

Ordering does save the intent: `.github/workflows/ci.yml` is Phase 00's deliverable (`phases/00-prerequisites.md:108`, "Item 0.4 — write `.github/workflows/ci.yml`"), which precedes Phase 20, and `phases/00:246` explicitly acknowledges the coupling from the other direction. But the gates as written must be rewritten to `test -f` first, or they certify nothing. The primary's S-02 notes that `ci.yml` does not exist but never connects that fact to the phase's own gates.

### U-3 — The Exit gate's "only the new file is added" check requires the file to be staged first — **Minor**

`phases/20:195`: "`git diff --name-only HEAD -- prisma/migrations` lists **only** `prisma/migrations/6_drop_generation_a/migration.sql` as added, with nothing deleted."

Per R23, `git diff --name-only HEAD` returns **empty output** for an untracked file and lists it only after `git add`. Run before staging — the natural order while authoring — the gate prints nothing, which a reader can mistake for "nothing added, nothing deleted". `git status --porcelain prisma/migrations` (which the phase's step 1 already uses) is the correct instrument, or `git add -N`.

### U-4 — Migration 2 irreversibly and lossily rewrites authorization data before the drop, and nobody says so — **Major**

`prisma/migrations/2_v1_adult_roles_and_classes/migration.sql:32-41` assigns **every** membership `organization_admin` if it held `organization:manage` or `user:manage`, and `teacher` **otherwise**; `:43-44` then sets `role` `NOT NULL`.

The six-value `Capability` enum and its nullable `scope_organization_id` (`schema.prisma:18-27`, `:249`) cannot be represented in the two-value `OrganizationRole` (`schema.prisma:35-40`). So on any real database, migration 2 has already destroyed the per-capability, per-scope grant information — `link:view`, `link:manage`, `results:view_organization`, `audit:view` all collapse into "teacher", and every scope distinction vanishes — and `NOT NULL` makes it unrecoverable. Migration 6 then deletes the source of truth.

The primary's confirmed-claim 7 mentions only that the backfill "must precede the drop". The stronger fact is that the backfill is **lossy and irreversible**, and the phase's framing — "sequential history can be retained" — reads as lossless. It is not. This is the sharpest data-loss finding in the phase and it appears in neither the primary nor the phase.


### U-5 — The phase's own "no ordering hazard" argument is scoped too narrowly, and it says so — **Low (self-disclosed; no action)**

`phases/20:147` states the four FKs "are owned by the dropped tables" and then concedes "§6.4's 'no FK-ordering hazard' conclusion … is correct but **under-scoped** — it checked the four FKs its own diff emitted and never asked the question in this direction." The phase then does ask it, and I confirm the answer is clean (R17, R18, R19). Recording this as a *resolved* item with the scope defect named — rather than leaving the reader to infer safety from a narrower claim — is a point in the phase's favour. The primary's confirmed-claim 4 reproduces the conclusion without noting that the phase corrected its own earlier scoping. Recorded here so the audit trail is not lost.

### U-6 — `database-model.md:8-11` designates a single "baseline migration" that Option A eliminates — **Minor**

Covered under S-06; listed separately because the fix is a specific line-level edit ("`0_init` is the first of seven directories, not the baseline"), not a general "update the docs" instruction.

### U-7 — The retained history hides ten database-level guarantees the datamodel cannot express; a future "cheaper gate" would silently weaken all of them — **Major, forward-looking**

`COMPAT-POLICY.md:24` enumerates what a regenerated cumulative init would have to hand-recreate: 8 surviving `CHECK` constraints (`migrations/3:15`, `4:12-14`, `5:18,20,43,45`), 2 partial unique indexes (`3:56,58`), and 6 `gen_random_uuid()` defaults (`2:47,60`, `3:8,20,31,43`) — none expressible in `schema.prisma`. R20 confirms the blind spot mechanically: `migrate diff --from-empty --to-schema <purged>` emits **0 `CHECK`** and **0 `gen_random_uuid`** for a schema the real database backs with all ten.

Under Option A these objects survive untouched, which is correct. The risk is prospective and specific: any future proposal to "restore a cheaper drift gate" using the DB-free byte-compare described at `COMPAT-POLICY.md:69` would compare a 270-line init containing none of the ten against a history that has all of them, and would report a false match or a false mismatch while guaranteeing that a *regenerated* database would be weaker than the one being migrated. Anyone reviving that idea after the shadow-DB gate was deleted needs this measurement. Neither the primary nor the phase records it.

### U-8 — Decision-ID collision between the architecture audit and the dossier — **Minor, documentation risk**

`docs/architecture-audit-2026-09-23.md:793-799` numbers its decisions `D1`–`D7`, where **`D6` = rate limiting (adopt: implement with `RateLimitBucket`)**. `docs/refactor-dossier/REFACTOR-DOSSIER.md:78-84` and `COMPAT-POLICY.md:28-30` use a different series, `D-1`–`D-7`, where **`D-5` = `RATE_LIMITED`/`RateLimitBucket`** and **`D-6` = `AuditEvent`**. `phases/20:133` writes "§6.2 row 9 keeps this model per D-6" — correct inside the dossier's series, misleading to anyone cross-checking the audit, where D6 is the rate-limit decision this same phase deletes. The phase's own `:8` correctly cites `COMPAT-POLICY.md` edit numbers, which are unambiguous. The collision is pre-existing and not Phase 20's creation, but Phase 20 is the first phase to lean on both series in one decision chain.

### U-9 — The step-8 argument that the fifth `DROP CONSTRAINT` is required is correct — **confirmed strength, no action**

`phases/20:159` argues that a constraint owned by a table that is itself dropped is still emitted, because the four analogous `DROP CONSTRAINT`s already in the dossier's own 8-statement block are owned by dropped tables — so the rule cannot be "PostgreSQL removes it implicitly". R8 confirms the generator emits it. Worth recording as a *validated* strength: the inherited `RV-20:20-29` treated this as a defect, and the earlier "9 statements" revision was on this evidence an arithmetic error. The primary reaches the same conclusion by reproduction rather than by argument, which is the stronger method, and I confirm it.

---

## 4. Corrections the primary should absorb

1. **S-01 → Major, and reframe.** Replace "placeholder `.env` does not prove no database exists" with: the premise is corroborated for this repository (four attestations, `.env` provenance, no migration executor in-repo, and a fail-closed stop condition already at `phases/20:21`); the missing control is fail-closed **target selection** at the moment of a future `migrate deploy`.
2. **S-03 → reframe as a retention decision, not an unresolved one.** D-6 and `COMPAT-POLICY.md:30,75` already decided to drop. The gap is that a *code* decision was substituted for a *retention* decision, and D-6's "no reader" argument does not address rows in an external database.
3. **S-04 → add the reversal framing.** Cite `architecture-audit-2026-09-23.md:798` (D6: implement, for the four player endpoints and sign-in) and `:150`. Deleting the model reverses a standing security decision.
4. **S-08 → correct the specific claim.** The defect is not a miscount; `phases/20:142`'s fourth named file (`prisma-capability-reader.ts:5-17`) is not an enum importer, and the two genuine test-file importers are unlisted.
5. **S-09 → correct the claim, not just the framing.** The phase's own steps 3–5 yield **228**, not 227. Record it as a false measured value in an execution document, alongside the primary's (correct) recommendation to drop line-count gating.
6. **Add U-1 through U-4 and U-7.** The self-demoted rate-limit requirement, the two vacuous `ci.yml` gates, the staged-file requirement, the lossy irreversible role backfill, and the ten inexpressible database guarantees.


## 5. Coverage limits and non-findings

- **No database was contacted.** The single command that could have attempted one (`migrate diff --from-migrations`) was run with `DATABASE_URL` and `DIRECT_URL` explicitly cleared; its error message is the proof that it aborted before any connection. No `migrate dev`/`deploy`/`reset`, no `db push`/`db execute`, no `prisma generate`, no `prisma db execute --stdin` against the emitted script.
- Therefore this report **cannot** assert anything about a real database's contents, `_prisma_migrations` state, row counts, applied checksums, or whether the seven-directory chain replays cleanly on PostgreSQL/Neon. R12 establishes only that the tool *refuses* to diff a migrations directory without a shadow URL.
- `prisma generate`, `npm run typecheck`, `npm run check`, Vitest, `npm run build:server` and `npm run build:demo` were **not** run. `phases/20:196-199` and `:174`'s "typecheck clean / test passes" claims are therefore untested here, and the `format:check` known-red baseline is taken from the inherited reports, not re-measured.
- Generated-client state (`src/generated/prisma`, git-ignored per `.gitignore` `/src/generated/prisma`) was read as text only. The `inlineSchema` blob at `src/generated/prisma/internal/class.ts:23` was observed to still contain the pre-purge model set, which is expected at HEAD.
- The sibling `Heroes_Trial` repository, the live Pages site, real Neon Auth users, GitHub branch protection, and the deployed server image were not inspected. `Dockerfile` was read as text; no image was built.
- Line numbers are `e5aaf1e`-relative and were verified against the working tree, which is clean apart from the two untracked documentation directories (`git status --porcelain` → `?? docs/refactor-dossier-audit-2026-09-25/`, `?? docs/refactor-dossier/`). No `prisma/` file was modified.
- Scratch artefacts live only outside the repository: `%TEMP%\verify20-schema` (HEAD + purged copies), `%TEMP%\verify20b` (phase-recipe copy), `%TEMP%\verify20c` (plan-literal copy), `%TEMP%\gitdiff-probe` (throwaway git repo), and the `pv*.txt` / `v20*.txt` / `fm.txt` / `stdout.txt` / `stderr.txt` capture files.

---

## 6. Final disposition

**The primary report stands as a competent and largely accurate audit.** All ten of its findings are real; nine survive unchanged, one is overstated in severity (S-01), and two need sharper statements rather than softer ones (S-08, S-09). Its measured spine — 310/16/6, 386, 10 statements, 12/5, P1012 at `:84`, no `shadow` flag — reproduced exactly on this machine with the installed 7.9.1 CLI.

**The phase is technically correct and procedurally unsafe in three specific, fixable ways**, none of which the primary identified: two exit gates that currently certify nothing or cannot pass (U-2), a self-contradicting step-5 line count presented as a measurement (S-09), and an irreversible authorization-information loss in migration 2 presented as a neutral ordering constraint (U-4). Add the demotion of the rate-limit requirement's only written specifications (U-1) and the fact that a deleted security control reverses a standing audit decision (`architecture-audit-2026-09-23.md:798`), and the correct summary is: **the SQL recipe is verified and reproducible; the destructive procedure still has no target-selection control, no migration-applicability gate, and no retention decision; and the documentation that would make any of this legible is itself scheduled to be rewritten without an authoritative requirement to rewrite it toward.**

The next safe action remains a human-approved, target-specific database plan. Not the generated `DROP` script, not `migrate dev`, not `db push`, and — as the primary correctly concludes — not `prisma validate` or a green static demo build as evidence that the migration is production-safe.

