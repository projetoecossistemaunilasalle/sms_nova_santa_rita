# RV-D — Adversarial Review of `REFACTOR_PLAN.md` v2.0, §2.5 / §3.2 / §6 (Day 1–2 tooling) / §7.3

| | |
| :-- | :-- |
| **Reviewer scope** | §2.5 database schema changes; §3.2 Prisma client management (generated code, `tsconfig` exclude); §5.2 rows that touch the TypeScript build; §6 Day 1 + Day 2 items involving schema/aliases/`tsconfig`; §7 criterion 3 (and criterion 1's interaction with `src/generated`) |
| **Method** | Read-only: `wc -l`, `find`, `grep`, `git ls-files`, `git check-ignore`, static reading of `node_modules/prisma/build/cli.js`, `node_modules/next/dist/lib/typescript/*`. **Nothing was executed that mutates files**: `prisma validate`, `prisma generate`, `prisma migrate *`, `tsc --noEmit` and both builds were **not** run (`tsc --noEmit` would rewrite `tsconfig.tsbuildinfo:16` because `incremental: true`). Where a claim could only be proven by running something, the verdict is derived from file/CLI-string evidence and labelled as such. |
| **Measurement date** | 23 September 2026 |
| **Repo state** | Working tree dirty (prior review measured 30 modified + 23 untracked); `src/generated` untracked, so all measurements are of a **locally generated** client that may already be out of sync with `prisma/schema.prisma`. |
| **Baseline cross-check** | `docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md` (§B2, §M5), `docs/agent-reviews/refactor-plan-v2/RV-A-deletion-manifest.md`, `docs/architecture-audit-2026-09-23.md` (D6, D7, R1, Phase 0/2/6) |

---

## Findings tally

| Verdict | Count | | Severity | Count |
| :-- | --: | :-- | :-- | --: |
| CONFIRMED | 8 | | BLOCKER | 0 |
| PARTIAL | 4 | | MAJOR | 8 |
| WRONG | 3 | | MINOR | 8 |
| UNSUPPORTED | 1 | | **Total findings** | **16** |

**No new BLOCKER exists in this scope.** §2.5's relation work is complete and correct, so `prisma validate` cannot fail on it; the only hard Day-1 BLOCKER touching these gates is inherited from `RV-A` (a surviving test importing a deleted service, independently corroborated in §4b and §7b below).

**The three defects that matter most in this scope**

1. **MAJOR — Day 1's gate has no `prisma generate` step and no migration step.** `REFACTOR_PLAN.md:213-214` sequences "update `prisma/schema.prisma` → run `prisma validate` and typecheck". `typecheck` reads `src/generated/prisma/**`, which is only rewritten by `prisma generate` (`package.json:25-26`), so the type gate runs against a client that still contains `model AccessLink` / `model RateLimitBucket` types. Nothing in `tests/**`, `scripts/**`, `contracts/**`, `.github/**` or `Dockerfile` reads `prisma/schema.prisma` (grep: 0 hits), so no automated layer can detect schema↔client skew. The gate can go green while the schema and the compiled client disagree.
2. **MAJOR — §3.2's headline benefit is wrong by a factor of ~67.** Excluding `src/generated/**` removes **444 of 29,722 lines (1.5 %)** from the `tsc` program, not 29,722; and all 24 generated files already carry `// @ts-nocheck`, so `tsc` never type-checked their bodies in the first place.
3. **MAJOR — deleting `RateLimitBucket` silently reverses a recorded open decision (audit D6) that the plan never cites or answers**, and leaves `RATE_LIMITED` alive in the public error contract (`src/server/http/errors.ts:11`, `contracts/schemas/api-error.v1.schema.json:21`) as an error code no server path can produce.

---

## 1. §2.5 — "Remove the two inverse relation fields on surviving models"

> **Claim:** `ProfessionalProfile.createdAccessLinks AccessLink[] @relation("AccessLinkCreator")` (`:65`) and `Organization.accessLinks AccessLink[]` (`:80`) are the inverse fields to remove.

**Verdict: CONFIRMED — exact line numbers, exact field names, exact relation name.**

| Item | Measured |
| :-- | :-- |
| `prisma/schema.prisma:65` | `createdAccessLinks AccessLink[] @relation("AccessLinkCreator")` |
| `prisma/schema.prisma:80` | `accessLinks AccessLink[]` |
| `prisma/schema.prisma:261-279` | `model AccessLink` (its own FK side: `:273` `organization Organization @relation(...)`, `:274` `createdBy ProfessionalProfile @relation("AccessLinkCreator", fields: [createdById], ..., onDelete: Restrict)`) |
| Total occurrences of the token `AccessLink` in the schema | **4** — lines 65, 80, 261, 274 |
| Other models with an FK column, `@@index`, `@@unique` or `@relation` pointing at `AccessLink` | **0** (`grep -n "AccessLink\|accessLinks\|createdAccessLinks" prisma/schema.prisma`) |
| Models with a named relation to `AccessLink` | **0** beyond the two listed |

**Consequence — the plan's blocker risk does not exist here.** A missed inverse relation is the classic `prisma validate` P1012 failure mode ("The relation field ... must exist"), and the schema has exactly three non-self references to `AccessLink`, all three of which are listed. `RateLimitBucket` (`prisma/schema.prisma:300-310`) has **no** relations at all (only `@@index([expiresAt])` at `:308`), so it is a free-standing deletion. Severity: none (claim is correct).

### 1a. What §2.5 does *not* list but the schema keeps referencing

> **Claim (implicit):** the three bullets in §2.5 are the complete schema change.

**Verdict: PARTIAL.** Three orphans survive the edit:

| Orphan | Evidence | Severity |
| :-- | :-- | :-- |
| `enum Capability { LINK_VIEW @map("link:view"), LINK_MANAGE @map("link:manage") }` | `prisma/schema.prisma:19-20`. After §2.3 deletes `access-link-service.ts` and `authorization-service.ts`, the **only** surviving reader of both values is `tests/unit/authorization.test.ts:107,117,120,123,134,144,147,150,196` — a test file that is *not* in §2.4 and that imports the deleted `AuthorizationService`. So the two capability values become unreachable from production code yet still live in the DB type: `prisma/migrations/0_init/migration.sql:8` `CREATE TYPE "capability" AS ENUM ('link:view', 'link:manage', …)`, plus the indexed column `capability_assignments.capability` (`0_init:50,114`) and the raw `NULLS NOT DISTINCT` unique index that includes `capability` (`0_init:160`, see `prisma/schema.prisma:254-256`'s comment saying Prisma cannot express it). Removing enum values from Postgres is not a Prisma-diff-safe operation (`ALTER TYPE … DELETE VALUE` refuses values present in any row), so this cannot be cleaned up later by a naive `migrate dev`. | MAJOR (schema hygiene, deferred cost) |
| `AuditEvent` becomes **write-dead** | The only production writer of `audit_events` is `src/server/db/prisma-access-link-store.ts:325-326` (`async recordAudit(...) { await this.client.auditEvent.create(...) }`), called only from `src/server/services/access-link-service.ts:294,350,415,473,514,553,644`. All of those files are in §2.3. The only reader is `src/app/(professional)/portal/admin/auditoria/page.tsx:4` which imports fixtures from `portal-view-service.ts:416`. Therefore §2.1 item 2 ("repoint the auditoria screen at the real `AuditEvent` table") will render an **empty table forever**, and the `AuditEvent` model (`prisma/schema.prisma:281-298`) plus its three indexes (`:294-296`) become write-never state. The audit already said this: `docs/architecture-audit-2026-09-23.md:456` "`AuditEvent` is current: `PrismaAccessLinkStore.recordAudit` writes it today." The plan deletes the writer and keeps the model without saying who writes it next. | MAJOR |
| `entityType` strings | `AuditEvent.entityType` is `String @db.VarChar(80)` (`prisma/schema.prisma:285`) — not a FK/enum, so no schema impact. Measured values: `"access_link"` appears only in `tests/unit/access-link-service.test.ts:525,771,974,1087,1247` (deleted) and `src/server/services/audit-actions.ts:11-32` (deleted). Clean. | none |
| `docs/schemas/database-model.md` still documents both dropped tables | `:50` (`access_links` row), `:52` (`rate_limit_buckets` row), `:86`, `:139`, `:152-156` (four CHECK constraints, incl. `0_init:163,166,169,172,175`). §2.5 and §6 Day 1 contain **no doc-update step**, while the audit's own Phase 2 step 5 (`:656`) and Phase 7 require it. | MINOR |

---

## 2. §2.5 — "`RateLimitBucket` (unreferenced in code; rate limiting can be implemented cleanly via port when needed)"

> **Claim:** the model is unreferenced in code.

**Verdict: CONFIRMED for hand-written code; WRONG as a statement about the repository; and it contradicts a recorded decision.**

Whole-repo grep for `RateLimitBucket|rateLimit|rate_limit|rate limit|rate-limit` (excluding `node_modules`, `.next*`, `out`, `.git`):

| Bucket | Hits | Files |
| :-- | --: | :-- |
| Hand-written runtime code (`src`, `tests`, `scripts`) | **0** | none read or write the model; no `prisma.rateLimitBucket.*` call exists |
| Generated client (untracked) | many | `src/generated/prisma/models/RateLimitBucket.ts` (1,221 lines) + barrel/namespace references |
| Migrations | 5 | `prisma/migrations/0_init/migration.sql:90,98,135,172,175` — table, PK, index and **two CHECK constraints** |
| **Public API error contract** | 2 | `src/server/http/errors.ts:11` (`"RATE_LIMITED"` in the code union) and `contracts/schemas/api-error.v1.schema.json:21` (`"RATE_LIMITED"` in the JSON Schema enum) |
| Legacy route (deleted by §2.2) | 1 | `src/app/(professional)/portal/atividades/actions.ts:181` `case "RATE_LIMITED":` — the **only** place the code is handled |
| Docs / plan | 8 | see below |

So "unreferenced in code" is true narrowly (no data-access code) and false as a repo statement: the table is materialised in migration SQL with CHECK constraints and the error code is exported in the versioned public contract.

**Contradiction with a documented decision.** `docs/architecture-audit-2026-09-23.md:798` records, in a table explicitly titled *"Open decisions (need a human answer before Phase 2)"*:

> `| D6 | Rate limiting: implement or delete? | implement with `RateLimitBucket` | Implement for the four player endpoints and sign-in (they are the abuse surface); the port makes a Redis swap possible later. |`

and `:725` (Phase 6 step 3) repeats it: *"Implement rate limiting on `/api/v1/player/*` and the sign-in action using `RateLimitBucket` + the `RATE_LIMITED` code **or** delete the model and the code path."* The audit's rejected-claims table (`:455`) also reframes the finding as *"an unimplemented security control plus a dead table"*, i.e. the choice is implement **or** delete-model-**and**-`RATE_LIMITED`.

§2.5's single parenthetical *"rate limiting can be implemented cleanly via port when needed"* is not a citation of D6, is not a decision against D6, and does not mention that the paired `RATE_LIMITED` contract code (`src/server/http/errors.ts:11`, `contracts/schemas/api-error.v1.schema.json:21`) must go with it — nor that deleting the model without a migration leaves `rate_limit_buckets` and its CHECK constraints in `prisma/migrations/0_init` forever. **Deleting the table is a defensible answer to D6; silently overriding it is not.** Severity: MAJOR (undocumented decision reversal + half-deleted contract).

---

## 3. §3.2 — "In Prisma 7, `provider = "prisma-client"` mandates an explicit `output` path"

> **Claim:** Prisma 7's `prisma-client` generator requires an explicit output; defaulting to `node_modules` causes CLI errors. **Decision:** keep `output = "../src/generated/prisma"`.

**Verdict: CONFIRMED (from the local CLI bundle, not from memory) — and the "Decision" describes the status quo, i.e. it is a no-op.**

| Fact | Evidence |
| :-- | :-- |
| Current generator block is already exactly what the plan "decides" | `prisma/schema.prisma:1-4`: `generator client { provider = "prisma-client"  output = "../src/generated/prisma" }` |
| Prisma version | `node_modules/prisma/package.json` → `7.9.1`; `node_modules/@prisma/client/package.json` → `7.9.1` (declared at `package.json:33,51`) |
| Missing `output` throws | `node_modules/prisma/build/cli.js`, template `v8t`: ``An output path is required for the `prisma-client` generator. Please provide an output path in your schema file`` followed by the example block; guard function `R3e(e){if(!e.output)throw new Error(v8t)}` |
| The CLI's own suggested block is byte-identical to this repo's | same bundle, generator-missing notice: ``generator client {\n  provider = "prisma-client"\n  output   = "../src/generated/prisma"\n}`` |
| Nuance the plan glosses | The **legacy** provider still exists in 7.9.1: `xl={PrismaClientJs:"prisma-client-js",PrismaClientTs:"prisma-client"}`, and `prisma init` offers `"prisma-client-js"` = *"Legacy Prisma Client JS generator"*. So "defaulting to `node_modules` causes CLI errors" is only true **while keeping `provider = "prisma-client"`**; switching providers would restore the `node_modules` default — at the cost of rewriting all 48 static import sites, because Prisma 7's `@prisma/client` re-exports no enums (`node_modules/@prisma/client/index.d.ts` is a 1-line stub; `grep RecordStatus` → 0 hits). This is what made v1's §3.3 a BLOCKER (prior review §B2, `REFACTOR_PLAN-review-2026-09-23.md:47-55`). |
| `prisma.config.ts` | 12 lines: `schema: "prisma/schema.prisma"`, `migrations.path`, and `datasource.url` **only when `DIRECT_URL` is set** (`prisma.config.ts:5,10`). It never wires `DATABASE_URL`. `prisma/schema.prisma:6-8` has a `datasource db` with **no** `url` key at all. Whether `prisma validate` needs a resolvable URL therefore cannot be answered from the schema — I did not run it (read-only constraint). |
| New work vs. already in place | "Decision" = **already in place** (zero diff). "Optimization: add `src/generated/**` to `tsconfig.json`'s `exclude` array" = **new work**: `tsconfig.json:55` is `"exclude": ["node_modules"]` only, and `tsconfig.json:48` `"**/*.ts"` currently makes every generated file a program root. Matches the audit's Phase 0 step 3 (`:606`), which is written as a *to-do*. |

Severity: MINOR (correct facts, mislabelled as a resolution; the §3.2 heading "Resolving B2" overstates work that does not exist).

---

## 4. §3.2 — "`tsconfig.json` exclude" and the "42 surviving imports"

### 4a. `tsconfig.json` as it actually is (56 lines, `wc -l` = 56)

| Field | Value | Line |
| :-- | :-- | :-- |
| `include` | `next-env.d.ts`, `.next/types/**/*.ts`, `**/*.ts`, `**/*.tsx`, `**/*.mts`, `.next/dev/types/**/*.ts`, `.next-demo-dev/types/**/*.ts`, `.next-demo-dev/dev/types/**/*.ts` | `:45-54` |
| `exclude` | `["node_modules"]` — **no `src/generated` entry** | `:55` |
| `paths` | `@/* → ./src/*` plus the 9 `@runtime/*` aliases that §6 Day 2 removes | `:22-43` |
| Relevant flags | `skipLibCheck: true` (`:6`), `noEmit: true` (`:9`), `incremental: true` (`:16`), `moduleResolution: "bundler"` (`:12`) | — |

So `src/generated/**` is inside the program today (both as roots via `**/*.ts` and transitively), and `git`/ESLint/Prettier already ignore it: `.gitignore:27` `/src/generated/prisma`, `eslint.config.mjs:15` `"src/generated/**"`, `.prettierignore:3` `src/generated`. `next.config.ts` needs nothing: it contains no `typescript`/`ignoreBuildErrors`/transpile setting for it (grep of all 84 lines → 0 hits).

### 4b. "all 42 surviving imports of `@/generated/prisma/enums`"

**Verdict: WRONG (number is today's total, not the surviving count) — but the functional half of the sentence is CONFIRMED.**

Measured across `src`, `tests`, `scripts` (all `.ts`/`.tsx`/`.mts`):

| Metric | Count |
| :-- | --: |
| static `from "@/generated/prisma/enums"` | **42** across 41 files |
| static `from "@/generated/prisma/client"` | **6** (`src/server/db/client.ts`, `prisma-access-link-store.ts`, `prisma-adult-portal-store.ts`, `prisma-game-event-store.ts`, `prisma-game-state-store.ts`, `prisma-player-access-store.ts`) |
| inline type import `import("@/generated/prisma/enums").RecordStatus` | **1** (`src/server/db/prisma-player-access-store.ts:46`) |
| dynamic `await import("@/generated/prisma/enums")` | **1** (`src/app/(professional)/portal/atividades/actions.ts:122`) |
| **Total import sites / files touched** | **50 sites / 47 files** |
| Non-enum paths beyond `/client` (`/models`, `/internal`, `/browser`, `/commonInputTypes`) imported from hand-written code | **0** (relative-path and `generated/prisma` string grep outside `src/generated` → 0 hits) |
| …of the 42 enum sites, how many live in files §2.2–§2.4 delete | **3**: `src/server/services/access-link-service.ts`, `src/server/services/authorization-service.ts`, `tests/unit/access-link-service.test.ts` (+ the 1 dynamic import in the deleted `atividades/actions.ts`) |
| **Surviving** enum sites after the purge | **39** (plus **5** surviving `/client` sites, 1 inline type import, 0 dynamic) |

42 is the number the prior audit measured *before* the purge (`REFACTOR_PLAN-review-2026-09-23.md:55` "the dominant specifier is `@/generated/prisma/enums` (42 uses)"); §3.2 re-uses it as a post-purge "surviving" count without recomputing. Severity: MINOR on its own — but it is the same conflation that hides the RV-A BLOCKER: one of those three deleted files is `authorization-service.ts`, whose **test survives** (`tests/unit/authorization.test.ts:8` imports `AuthorizationService`, and the file is not in §2.4), which is exactly why §6's "typecheck" and §7.3's "`npm test`" gates fail on Day 1. Corroborates `RV-A-deletion-manifest.md` finding B1 independently.

### 4c. What `exclude` actually does to this program

**Verdict: the "remain functional with zero file rewrites" half is CONFIRMED; the "TypeScript stops scanning the 29,722 lines" half is WRONG.**

* Why imports keep working: `exclude` only filters the `include` globs — it does not affect module *resolution*, and `paths.@/*` (`tsconfig.json:23`) still maps `@/generated/prisma/enums` to `src/generated/prisma/enums.ts`. No generated file is an ambient/globals file: `grep -rn "declare global\|declare module" src/generated` → **0 hits**, and all 24 files are ES modules with `import`/`export`. Nothing can therefore break by losing root status. `vitest.config.mts:7-9` resolves `@` with its own alias, so tests are unaffected regardless. `node_modules/next/dist/lib/typescript/writeConfigurationDefaults.js:349-353` only writes `exclude` **when it is absent**, so Next will not clobber the new entry.
* Why the benefit claim is wrong (measured reachability of the generated graph):
  * `client.ts:19-21` imports `./enums`, `./internal/class`, `./internal/prismaNamespace`;
  * `internal/prismaNamespace.ts:19,22` import **and** re-export `../models`;
  * `models.ts:11-26` is a barrel that `export type * from` **all 16 model files** + `commonInputTypes`;
  * every `models/*.ts` (e.g. `models/AccessLink.ts:11-13`) imports `../enums` and `../internal/prismaNamespace`.
  * Therefore the 6 hand-written `/client` import sites drag in **29,278 of the 29,722 lines**. The only two files that would actually leave the program are `browser.ts` (99) and `internal/prismaNamespaceBrowser.ts` (345) = **444 lines = 1.49 %**, because nothing in `src`/`tests` imports the browser entry.
  * `tsc` also **already** skips semantic checking of these bodies: `grep -l "@ts-nocheck"` → **24 of 24 files** carry the `// @ts-nocheck` preamble (e.g. `models.ts:5`, `enums.ts`, `models/AccessLink.ts:4`), on top of `skipLibCheck: true`. The residual cost is parsing and program construction, not checking.
  * Independent corroboration: `REFACTOR_PLAN-review-2026-09-23.md:53` ("the benefit is largely false … every file already carries `// @ts-nocheck`"), and the plan's own §3.2 number was lifted from a review that had already downgraded that benefit (`:178` "the stated 29,700-line benefit is mostly illusory").
* **I did not run `tsc`** to time it (read-only constraint: `incremental: true` rewrites `tsconfig.tsbuildinfo`, 356,779 bytes). `tsconfig.tsbuildinfo` does prove all 24 generated paths are in the program today (`grep -o "src/generated/prisma…\.ts" | sort -u | wc -l` → **24**).

**Verdict on §3.2's stated benefit: WRONG as written (~1.5 % of the claimed lines, with the checking cost already zero); the action itself is still worth taking** — it is the audit's Phase 0 step 3 (`docs/architecture-audit-2026-09-23.md:606`), it shrinks IDE/`tsc` root sets and `--listFiles` noise, and it is the only sane defence against the stale-file case below. Severity: MAJOR (the plan justifies a Day 2 step with a false number, so nobody can tell afterwards whether it worked).

### 4d. Better, free win the plan does not claim

Dropping the two models removes `src/generated/prisma/models/AccessLink.ts` (**1,711** lines) and `models/RateLimitBucket.ts` (**1,221** lines) from the generated output = **2,932 lines (9.9 %)**, automatically on the next `prisma generate`, with zero config change. That is ~6.6× the benefit §3.2 attributes to `exclude`. Severity: MINOR (missed, easy).

---

## 5. "29,722 lines of generated code" and the gitignore/staleness question

> **Claim:** "TypeScript stops scanning the 29,722 lines of generated code."

**Verdict: CONFIRMED (number is exact) — and the staleness risk is real but is *caused* by the plan's own Day 1 sequence, not by the file count.**

Measured: `find src/generated -type f | xargs wc -l` → **29,722 lines / 24 files**, all `.ts` (`find src/generated -type f | sed 's/.*\.//' | sort | uniq -c` → `24 ts`). Largest: `internal/prismaNamespace.ts` 2,319; `models/ClassGroup.ts` 1,872; `models/OrganizationMembership.ts` 1,836; `models/PlayerSlot.ts` 1,809; `models/Organization.ts` 1,744; `models/AccessLink.ts` 1,711. Smallest: `models.ts` 26, `enums.ts` 61. (The audit quotes 29,723 at `:91` — off by one; the plan's number is the accurate one.)

| Git/build fact | Evidence |
| :-- | :-- |
| Generated output is **not** tracked | `.gitignore:27` `/src/generated/prisma`; `git ls-files src/generated` → **0 files**; `git check-ignore -v src/generated/prisma/models.ts` → matched |
| Regenerated on install | `package.json:25` `"prisma:generate": "prisma generate"`, `package.json:26` `"postinstall": "prisma generate"` → `npm ci` in CI (`.github/workflows/deploy.yml:31`) produces it |
| **Stale files do not survive a regenerate** | `node_modules/prisma/build/cli.js` generator flow: `await L3t(O), await ensureDir(O), await s3e(O,R)`. `L3t` reads the output dir; if it is non-empty and contains `client.ts` (it does, `src/generated/prisma/client.ts`), it unlinks `${e}/**/*.{js,ts,mts,cts,d.ts}`, `*.wasm`, `*.node`, engine files and `package.json` before the new file map is written; if the dir is non-empty **without** `client.ts` it throws ("exists and is not empty but doesn't look like a generated Prisma Client"). So no orphan `models/AccessLink.ts` can linger *after* `prisma generate` — **provided generate runs**. |
| **The actual risk: generate never runs** | §6 Day 1 (`REFACTOR_PLAN.md:213-214`) orders "drop AccessLink … → `prisma validate` → typecheck" with no `prisma generate` between them, and `scripts/next-target.mjs` (the "canonical build runner" §3.4 keeps, 71 lines) never invokes `prisma generate` (it only loads env, sets `APP_RUNTIME_MODE`/`NODE_ENV`, blanks secrets for demo at `:41-53` and spawns `next`). Result: Day 1's typecheck validates the **pre-purge** client, which still exposes `prisma.accessLink`/`prisma.rateLimitBucket` delegates and `ProfessionalProfile.createdAccessLinks`. Any Generation-A call the purge misses type-checks green. |
| Docker amplifies it | `Dockerfile:7-8` copies `prisma/` and runs `npm ci` in the *dependencies* stage (so the `postinstall` generate writes `/app/src/generated/prisma` there), but `Dockerfile:11` only copies `/app/node_modules` forward — the generated client is **discarded**. `Dockerfile:12` `COPY . .` then imports the **host's** `src/generated` (`.dockerignore` has no `src/generated` entry; it lists only `.git .github .next coverage node_modules *.log .env* !.env.example`), and the builder never regenerates. A Docker `npm run build` therefore compiles against whatever the developer's disk happened to contain — a silent, reproducible-skew hole directly in §7.3's path. |
| Fix (cheap, no new tooling) | Add `npm run prisma:generate` between the schema edit and `typecheck` in Day 1, and either add `src/generated` to `.dockerignore` + a `RUN npx prisma generate` in the builder stage, or move the `npm ci`/generate to the builder stage. |

Severity: MAJOR (stale-client false green), MINOR (stale files on disk after generate — not a risk, disproven above).

---

## 6. Migration reality vs. "Run `prisma validate` and typecheck" (Day 1)

> **Claim (§6 Day 1, last line):** the Day-1 exit gate is `prisma validate` + typecheck.

**Verdict: PARTIAL — sufficient as a *syntax/consistency* gate, insufficient as a *data-model* gate.**

Evidence:

| Fact | Evidence |
| :-- | :-- |
| A migration history **exists** and will fall out of sync | `prisma/migrations/`: `0_init` (175 SQL lines), `1_add_paused_at` (3), `2_v1_adult_roles_and_classes` (82), `3_slice_02_player_access` (60), `4_v1_game_state` (15), `5_v1_game_events` (51) = 386 lines, `migration_lock.toml` → `provider = "postgresql"`. `0_init` creates `access_links` (`:58-70`), its unique/index (`:117,120,123`), **two FKs with `ON DELETE RESTRICT`** (`:150,153`), **three raw CHECK constraints** (`:163,166,169`), `1_add_paused_at:3` (`ALTER TABLE access_links ADD COLUMN paused_at`), plus `rate_limit_buckets` (`:90,98,135,172,175`) and `CREATE TYPE "capability" … 'link:view','link:manage'` (`:8`). |
| None of it has ever touched a real database | `docs/architecture-audit-2026-09-23.md:39` "No migration has been applied to a real Neon database"; `:75` "`prisma/migrations/*` (5 migrations) never applied to a real database; `.env` holds `ep-example…` hosts"; risk **R1** at `:779` "the schema might not even apply … Highest-value acceptance item". Confirmed locally: `.env:2,5` are placeholder `postgresql://user:password…` strings, and `prisma.config.ts:5,10` only wires a datasource URL when `DIRECT_URL` exists. |
| No tooling can catch the drift | `package.json` scripts contain **no** `migrate`/`db push` script at all (only `prisma:generate`, `postinstall`). No file in `tests/`, `scripts/`, `src/`, `contracts/`, `.github/`, `Dockerfile` references `schema.prisma` (grep → 0 hits). CI (`.github/workflows/deploy.yml`) runs only `npm ci` + `npm run build:demo` — no typecheck/test/migrate job (so §6 Day 1 Phase 0's "wire CI" is genuinely new work, and criterion 4 is currently unmet). |
| The audit's own prescription differs | `:652` — "drop `AccessLink` **and its migration in a follow-up migration** only after confirming no V1 screen needs link-based sharing"; `:711` requires `prisma migrate deploy` on an empty database; `:783` (R5) warns deleting `AccessLink`/`CapabilityAssignment` can lock admins out. The plan drops the model on **Day 1**, concurrently with the code, with no confirmation step and no migration. |

**Judgement (argued, not asserted).** `prisma validate` will pass — §1 proves the relation graph stays closed — and typecheck will pass (against a stale client, §5). Neither command compares `prisma/migrations/**` against `prisma/schema.prisma`; that comparison is only performed by `migrate dev`/`migrate diff`/`migrate deploy`. So Day 1 leaves the repo in a state where the schema and its migration history describe two different databases, and the *first* person to run `prisma migrate dev` (i.e. the R1 acceptance the audit calls highest-value) will be handed an unreviewed `DROP TABLE "access_links"`, `DROP TABLE "rate_limit_buckets"` plus enum/type churn, generated at the worst possible moment and with no CI to catch it. Two acceptable correct sequences — the plan must pick one explicitly:

1. **Keep history (audit-conformant).** After the schema edit: `prisma validate` → `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script` (offline, no DB, produces reviewable SQL) → save as `prisma/migrations/6_drop_generation_a/migration.sql` → `prisma generate` → typecheck/test → and, because that migration has never been executed anywhere, run `prisma migrate deploy` against a throwaway Postgres (audit D4) in the same day. This turns R1 from an open risk into a by-product of the purge.
2. **Rebase history (defensible precisely *because* nothing was ever applied).** Rewrite `0_init` to the post-purge schema and delete `1_add_paused_at` (its only content is `access_links.paused_at`), then validate `migrate deploy` on an empty database. Cheaper, honest, but it destroys the migration narrative that `docs/schemas/database-model.md` and `portal-v1-specification.md` are built on, so it must be a stated decision, not a side effect.

`prisma db push` is the worst of the three here: it has no file output, so it cannot be reviewed or reproduced in CI, and it would leave `prisma/migrations/**` permanently contradicting the schema. The plan currently implies none of the three — that silence is the defect. Severity: MAJOR.

---

## 7. §7 criteria 1 and 3 versus this scope

### 7a. Criterion 1 — "Zero files over 400 lines (excluding third-party schemas and `idb-store.ts`)"

**Verdict: no conflict with §3.2's `exclude`; the criterion's exclusion list is simply incomplete.**

* Orthogonality: `tsconfig` `exclude` changes which files are program roots; it does not change line counts, ESLint (`eslint.config.mjs:15` already ignores `src/generated/**`) or Prettier (`.prettierignore:3`). Adding it neither helps nor hurts criterion 1. **No conflict.**
* The literal wording does, however, fail: **18 of the 24** files in `src/generated/prisma` exceed 400 lines today (measured: `internal/prismaNamespace.ts` 2,319, `commonInputTypes.ts` 838 and all 16 `models/*.ts` between 1,221 and 1,872) — **16 still exceed it after the purge** drops `models/AccessLink.ts` and `models/RateLimitBucket.ts`. They are not "third-party schemas" — they are third-party *generated code*. The audit's own version of the rule is explicit ("No file over ~400 lines **except generated code**", `:700`), and the target layout discusses moving the client out of `src/` (`:497`). Fix = add "`src/generated/**`" to §7.1's exclusion list, one word. Severity: MINOR.
* `prisma/schema.prisma` itself: **310 lines** (`wc -l`), and §2.5 only shrinks it (−`model AccessLink` 19 lines, −`model RateLimitBucket` 11, −2 relation fields ≈ 278). Under budget before and after. Largest migration file 175 lines. The two contract JSON files over 400 (`contracts/schemas/v1/result-event.v1.schema.json` 494, `result-submission.v1.schema.json` 482) are the "third-party schemas" the carve-out names.
* Independent recount for the record: **19** non-generated files exceed 400 lines; excluding the two JSON contracts that is **17**; §2 deletes 4 of them (`access-link-service.test.ts` 1,625; `access-link-service.ts` 717; `portal-view-service.ts` 521; `atividades/actions.ts` 517) and §4 splits 4 more (`portal.module.css` 4,910; `game-offline-sync.ts` 1,222; `game-host.tsx` 932; `application/adult-portal/service.ts` 616) → **9 untouched over budget**: `runtime/adult-portal-demo-store.ts` 1,024, `components/public/public.module.css` 1,017, `tests/unit/game-offline-sync.test.ts` 728, `components/marketing/marketing.module.css` 688, `tests/unit/authorization.test.ts` 634, `components/portal/player-access-workflow.tsx` 540, `src/contracts/v1/schemas.ts` 481, `server/db/prisma-adult-portal-store.ts` 467, `components/portal/team-screen.tsx` 411. This reproduces prior-review finding M5 exactly (`REFACTOR_PLAN-review-2026-09-23.md:132`), so criterion 1 as written is unmet at the end of Day 4.

### 7b. Criterion 3 — "`build:demo`, `build:server`, `typecheck`, `npm test` execute cleanly"

**Verdict: UNSUPPORTED as a Day-4 gate within this scope; three concrete ways it can't be reached.**

| # | Mechanism | Evidence | Severity |
| :-- | :-- | :-- | :-- |
| 1 | `npm test` / `npm run typecheck` (which covers `tests/**` because `tsconfig.json:48` includes `**/*.ts`) break on the surviving `authorization.test.ts` → the deleted `authorization-service.ts` | `tests/unit/authorization.test.ts:8`; §2.3 line 57; not in §2.4; `tsconfig.json:48,55` | MAJOR (corroborates RV-A B1) |
| 2 | The schema/typecheck gate is evaluated against a stale generated client (§5) and the migration history silently diverges (§6) | `REFACTOR_PLAN.md:213-214`; `package.json:25-26`; `scripts/next-target.mjs` (no generate); `Dockerfile:7-13` + `.dockerignore` | MAJOR |
| 3 | `npm run build:server` has never been demonstrated, and cannot be in CI as sketched without build-time env: `next.config.ts:12-20` **throws a ZodError at config load** unless `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` (≥32), `APPLICATION_SECRET` (≥32) all parse when `APP_RUNTIME_MODE=server`; `.dockerignore` excludes `.env*`, so a Docker build has none of them; the audit records "Server build: Not run in this audit … Docs claim it passes" (`:2.2`) and prescribes "a `build:server` job with placeholder secrets" (`:603`) | `next.config.ts:6-20`, `scripts/next-target.mjs:41-53`, `.dockerignore`, `docs/architecture-audit-2026-09-23.md` (Phase 0 step 2) | MINOR (already known, but §7.3 promises it as proven) |

---

## 8. §5.2 rows that touch the TypeScript build

> **Claim (Developer Ergonomics / Caramelito Tokens rows):** "Must be mapped into `tailwind.config.ts` theme extensions." / "High: scoped styles, no global leakage, standard CSS syntax."

**Verdict: the ergonomics row makes no TypeScript-build claim (nothing to verify — CONFIRMED by absence); the config-file claim is WRONG for the toolchain in this tree.**

* Neither §5.2 row asserts anything about `tsc`, `tsconfig`, Turbopack or build time, so within my scope there is no tooling claim to falsify; the effort/regression rows are judgement, not measurement.
* `tailwind.config.ts` is the **v3** mechanism. Tailwind is not a dependency (`package.json:0` hits), but the lockfile already resolves **`tailwindcss@4.2.1`** (`package-lock.json:1544,12940-12942`) as a transitive dep, and there is no `postcss.config.*` in the repo. A Sprint-2 Tailwind adoption lands on v4, whose configuration is CSS-first (`@theme` in `src/app/globals.css`, which today holds the `:root` token block — 141 lines starting `:root { --green: #3d9b4e; …}`) with the PostCSS plugin shipped as `@tailwindcss/postcss`. Severity: MINOR (affects the §5.3 "optional future" step, not the 3–4 day sprint; the sprint's "do not rewrite" verdict is unaffected).

---

## 9. Corrections, in the order the plan should apply them

1. **§6 Day 1** — insert `npm run prisma:generate` **between** the schema edit and typecheck, and insert a migration step (either an authored `prisma/migrations/6_drop_generation_a/migration.sql` produced by offline `prisma migrate diff --script`, or an explicit "rebase 0_init" decision). Add `prisma migrate deploy` against a throwaway Postgres to Day 1 or Day 4 — that closes R1 for free.
2. **§2.5** — extend the bullet list: state the fate of `Capability.LINK_VIEW`/`LINK_MANAGE` (`prisma/schema.prisma:19-20`) and of the `capability` PG enum (`0_init:8`); state who writes `AuditEvent` after `prisma-access-link-store.ts` is deleted; state that `RATE_LIMITED` (`src/server/http/errors.ts:11`, `contracts/schemas/api-error.v1.schema.json:21`) is deleted with `RateLimitBucket`; add a line answering audit **D6** instead of pre-empting it; add the `docs/schemas/database-model.md:50,52,86,139,152-156` updates.
3. **§3.2** — retitle: the "Decision" is already the status quo (`prisma/schema.prisma:1-4`); replace the "Benefit" sentence with the true one: *"removes 444 lines (1.5 %) from the `tsc` root set; the 29,278 reachable lines stay in the program but are already `@ts-nocheck`; the real reduction (2,932 lines) comes from deleting the two models."* Change "42 surviving" to **39** (`/enums`) **+ 5** (`/client`).
4. **§6 Day 2** — keep the `exclude` step (it matches audit Phase 0 step 3) but stop presenting it as a performance fix; also fix `Dockerfile`/`.dockerignore` so the image generates its own client instead of importing the host's.
5. **§7.1** — add `src/generated/**` to the exclusion list. **§7.3** — note explicitly that typecheck covers `tests/**` (because `include: ["**/*.ts"]`), which is why a stale surviving test is a build-gate failure, not just a test failure.

---

## Open questions for the plan author

1. **Which migration story is it?** Day 1 edits `prisma/schema.prisma` but §6 never mentions `prisma/migrations/**` (6 migrations, 386 SQL lines). Do you (a) author `6_drop_generation_a/migration.sql` from an offline `migrate diff`, (b) rebase `0_init` and delete `1_add_paused_at` on the grounds that nothing was ever deployed (audit `:75`, R1 `:779`), or (c) leave the history contradictory and let the first `migrate dev` generate the DROPs blind? Option (b) needs one sentence of justification; (c) needs deleting §7.3's credibility.
2. **Is audit D6 overruled or overlooked?** `docs/architecture-audit-2026-09-23.md:798` records "implement with `RateLimitBucket`" as an *open decision needing a human answer before Phase 2*, and `:725` schedules it in Phase 6. If the plan's answer is now "delete", say so **and** delete the `RATE_LIMITED` code path in `src/server/http/errors.ts:11` + `contracts/schemas/api-error.v1.schema.json:21`, which is the versioned public contract — or keep the table. Half-deleting either is worse than the status quo.
3. **Who writes `AuditEvent` after Day 1?** `prisma-access-link-store.ts:325-326` is the only `auditEvent.create` in the repo and §2.3 deletes it, while §2.1 item 2 promises to repoint the auditoria screen at the "real `AuditEvent` table". Is the page meant to render an empty table, or is an audit-writer port part of Day 2 scope? If neither, should `model AuditEvent` (`prisma/schema.prisma:281-298`) be dropped too?
4. **Are `Capability.LINK_VIEW` / `LINK_MANAGE` staying in the schema?** If yes, §2.5 leaves two authorization concepts with no referent; if no, the `capability` PG enum (`0_init:8`) plus its index and the raw `NULLS NOT DISTINCT` unique index (`0_init:160`, see the comment at `prisma/schema.prisma:254-256`) make the removal a hand-written migration, not a Prisma diff — and `CapabilityAssignment` itself may be the next dead model (audit R5/D3). What is the intended end state of the capability model in V1?
5. **Should §3.2's benefit be restated, and does the Day-2 `exclude` step survive scrutiny?** Measured: 24/24 generated files already `@ts-nocheck`, all but 444 lines are transitively reachable from the 6 `@/generated/prisma/client` imports, ESLint/Prettier/git already ignore the directory. Is the step justified as IDE/root-set hygiene (audit Phase 0 step 3), or should Day 2 spend the slot on the Docker `prisma generate` fix instead?
6. **Does the purge count of import sites get recomputed after Day 1?** Post-purge truth is 39 `/enums` + 5 `/client` + 1 inline type import; the plan quotes 42 (a pre-purge figure lifted from the v1 review). Should §7 track a "grep for `@/generated` outside `src/server/**` equals 0" guardrail instead (audit `:753` proposes exactly that, and 22 of today's 47 sites are in `components/`, `application/`, `runtime/`, `tests/` — i.e. layers the audit forbids)?
7. **Where does `prisma validate` get its datasource URL?** `prisma/schema.prisma:6-8` has no `url`; `prisma.config.ts:5,10` only sets one when `DIRECT_URL` exists; `.env:2,5` hold placeholders. Could you confirm on a real shell that `prisma validate` and `prisma migrate diff` behave offline here (this reviewer was constrained to read-only and did not run them)?
