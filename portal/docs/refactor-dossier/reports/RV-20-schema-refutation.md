# RV-20 — refutation of `phases/20-schema-and-migration.md`

**Attacked:** `docs/refactor-dossier/phases/20-schema-and-migration.md` (**301 lines on disk**, not the ~270
the brief assumed) — the Prisma schema-cut and `6_drop_generation_a` work order. This is the only phase file in
the dossier with no prior paired refutation pass, and it has been rewritten twice in the last hour (first to
reverse the Option-B/Option-A decision, then to correct that reversal's statement arithmetic). Neither revision
had been attacked.
**Commit:** `e5aaf1e` (`HEAD` == `main` == `origin/main`; `git status --porcelain` → only `?? docs/refactor-dossier/`
before and after this pass; `prisma/` byte-clean, `git diff --stat` empty).
**Toolchain:** local `node_modules/.bin/prisma` 7.9.1, `@prisma/client` 7.9.1, win32, Node v22.23.1.
**Method:** read-only. Every Prisma invocation took an explicit path to a scratch copy under
`C:/Users/Vitor/.qoder/tmp/rv20` and contacted no database: `--version`, `validate --schema <copy>`,
`migrate diff --help`, `migrate diff --from-schema <copy> --to-schema <copy> [--script|--exit-code]`,
`migrate diff --from-empty --to-schema <copy> --script`. **No** `migrate dev/deploy/reset`, no
`--from-migrations`, no `prisma generate`, no write anywhere under `prisma/`. The tracked
`prisma/schema.prisma` was never validated in place — only a copy of it.

**Verdicts: 36 PASS · 17 FAIL · 2 VACUOUS-GATE · 1 MISSING · 3 UNREPRODUCIBLE.**

**Headline: the statement count is 10, not 9 — and the file's own pre-committed falsification test says so.**
Running the command step 8 mandates, against a scratch copy of HEAD and a scratch copy of this file's own
steps 3-5 purge, `prisma migrate diff` emits **five** `DROP CONSTRAINT` lines, the fifth being exactly
`ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_actor_id_fkey";`. Step 8 predicted this would refute
itself ("if the generated diff ever does carry a fifth `DROP CONSTRAINT`, this paragraph is wrong") and it does.
The earlier revision's 10 was right; the correction to 9 was the error, and it has since propagated into
`COMPAT-POLICY.md:110` (the governing §6 bullet) and `phases/00-prerequisites.md:235` (which cites step 8 as its
authority). Worse than the number: step 8's `**If it fails:**` branch tells the implementer to *delete* the fifth
line if the tool emits it. The work order's central instruction is "emit it, do not type it", and its gate
destroys the emitted output.

## §1 The `6_drop_generation_a` statement list — verdict: 10, and the exclusion argument is self-refuting

FK direction, read line by line: `0_init:156` is verbatim
`ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES
"professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;` — owned by the dropped table, pointing
outward. Both greps confirm the file: `grep -rn 'REFERENCES "audit_events"' prisma/migrations/*/migration.sql`
→ **exit 1, no output**; `grep -rn audit_events prisma/migrations/*/migration.sql | grep -v 0_init` → **exit 1**.
`grep -c audit_events prisma/migrations/0_init/migration.sql` → **6** (`:74`, `:86`, `:126`, `:129`, `:132`,
`:156`), and `audit_events` carries no `CHECK`. So far the file is right.

The reasoning is where it breaks. The property it uses to *exclude* the fifth constraint — "owned by the dropped
table and points outward at a survivor, so `DROP TABLE` removes it implicitly" — is the **same property**
`REFACTOR-DOSSIER.md:276` cites to justify *including* the four it keeps: all four (`0_init:144,147,150,153`) are
`ALTER TABLE <dropped> … REFERENCES <survivor>`. Deduplicated across the whole history, every `REFERENCES` target
in all six files is `class_groups`, `game_sessions`, `organization_memberships`, `organizations`,
`participations`, `player_slots`, `professional_profiles` — never a dropped table. §6.4's "no FK-ordering hazard"
therefore holds across **all four** tables (PASS, row 4), but it holds *identically* for five constraints, not
four. Prisma's diff vocabulary emits one `DropForeignKey` per FK owned by any dropped table. The file's argument
proves too much, and the generator settles it:

```
$ node_modules/.bin/prisma migrate diff --from-schema $S/head.prisma --to-schema $S/full_tidy.prisma --script   (exit 0)
-- DropForeignKey                                             ALTER TABLE "capability_assignments" DROP CONSTRAINT "…membership_id_fkey";
-- DropForeignKey                                             ALTER TABLE "capability_assignments" DROP CONSTRAINT "…scope_organization_id_fkey";
-- DropForeignKey                                             ALTER TABLE "access_links" DROP CONSTRAINT "…organization_id_fkey";
-- DropForeignKey                                             ALTER TABLE "access_links" DROP CONSTRAINT "…created_by_id_fkey";
-- DropForeignKey                                             ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_actor_id_fkey";   <-- the fifth
-- DropTable   ×4   capability_assignments, access_links, audit_events, rate_limit_buckets        (in that order)
-- DropEnum    DROP TYPE "capability";
20 non-blank + 9 separators = 29 lines; wc -l 30
```
Control run against a keep-`AuditEvent` purge reproduces the dossier's artifact byte-for-byte: **8 statements**,
16 non-blank + 7 separators = 23 content lines, `wc -l` 24 — which validates both `REFACTOR-DOSSIER.md:255`'s
"8 statements, 23 content lines (`wc -l` reports 24)" and this file's "16 non-blank + 7 separators" decomposition,
and confirms the provenance story (the 8 really were generated from a schema that kept the model). The 9th table
drop adds **two** statements, not one, because Prisma pairs every dropped table with its FKs.

Also corrected: the file's charge that the earlier 10-count "would be dead weight before the table drop and a
hard error after it" is unfounded on both halves. The generator places the `DROP CONSTRAINT` **before** the
`DROP TABLE`, where it is valid SQL against a live database; the `table "audit_events" does not exist` failure
only arises from the hand-appending the generator never does.

## §2 Purge closure and the definitive line counts

Closure verified by construction and by tool: `prisma validate --schema <purged copy>` → **valid**; the purged
schema has **0** hits for
`Capability|AccessLink|RateLimitBucket|AuditEvent|auditEvents|capabilityAssignments|accessLinks|scopedCapabilities|createdAccessLinks|createdBy|scopeOrganization|actor`,
**0** string-named `@relation(...)`, exactly **12** `^model` and **5** `^enum`, and the five surviving enum
mentions are `RecordStatus/PlatformRole/OrganizationRole/PlayerCredentialStatus/GameSessionStatus` — `Capability`
gone. The fourth-unlisted-relation finding (`:97`) and the `@relation("AuditActor")` `:66`/`:292` pair are both
real and both correctly placed.

Four recipes, built by hand in scratch and measured — this closes the file's own open item:

| Recipe | Deletions | Lines | `prisma validate` |
| :-- | :-- | :-- | :-- |
| plan-literal (step 2's `sed`, exactly as written) | 55 block + 3 relation (`:65,:79,:80`) = 58 | **252** | **FAILS — P1012 at :84** (reproduced verbatim, incl. context `83 \| organization …`, `84 \| capabilityAssignments CapabilityAssignment[]`; real exit **1**) |
| **blocks-only + the 4th relation** — the plan's own words "four model/enum blocks + four relation lines" | 55 + 4 = 59 | **251** | valid |
| tidy, `AuditEvent` kept (blocks + separators + 4 relation lines) | 11+16+20+12+4 = 63 | **247** | valid |
| this file's full recipe, trailing blank kept | 11+5+66 = 82 | **228** | valid |
| this file's full recipe, tidy | 11+5+67 = 83 | **227** | valid |

**`310 → 251` reproduces exactly.** `REFACTOR-DOSSIER.md:218` / `ADJ-01:22` say "four model/enum blocks + four
relation lines"; that recipe is 310 − (10+15+19+11) − 4 = **251**, and the scratch file validates. The file's
"does not reproduce" verdict is a mislabel: it only ever tried the plan's *incomplete* literal `sed` (3 relation
lines → 252) and a tidy variant (→ 247), never its own discovered 4-relation blocks-only set. Divergence 1 is
also self-contradictory on its face — it writes "(10+15+19+11 = **55**) plus the 4 relation fields gives **252**",
but 55 + 4 = 59 → 251; the printed 252 is the 55 + **3** case. And 251 carries the "3 stray double-blank
separators" penalty the file describes (confirmed: 3 consecutive-blank pairs), which is the *only* honest reason
to prefer a tidy count — a hygiene argument, not a reproducibility one.

**227 vs 251 reconciled:** they are different purge sets, not a disagreement. 251 keeps `AuditEvent` (4 blocks);
227 drops it (5 blocks) — 24 of the 25-line gap is `AuditEvent`'s block + separator + `:66`, the rest is
separator tidiness. Both are correct for their own schema. But 227 vs 228 is *only* a trailing-newline choice
(identical model/enum/relation sets, both valid), so "227 measured" is not recipe-independent — and the Exit gate
books it as an acceptance number ("`prisma/schema.prisma` is **227 lines** on this recipe") while Divergence 1
insists "the line count is quoted as measured-with-recipe, **never as a check**". One of those two sentences has
to go.

## §3 The 269 / 367 / 175 settlement — all three are real; nothing is stale

Both contested figures were re-measured with commands the brief permits and the file itself documents at `:51`
and `REFACTOR-DOSSIER.md:251`. The previous reviser's "could not re-measure / labelled a prior-revision run" was
an over-caution: only writing into `prisma/migrations/` was forbidden, not the run.

- `--from-empty --to-schema <227-line purge> --script` → exit 0, **269 lines**, with **every** published
  sub-count exact: 12 `CREATE TABLE`, 5 `CREATE TYPE` (`capability` correctly absent), 11 `CREATE INDEX`,
  8 `CREATE UNIQUE INDEX`, 23 `TIMESTAMPTZ(3)`, 0 `DROP`, and — the point of the run — **0 `CHECK`,
  0 `gen_random_uuid`, 0 `WHERE`-qualified index, 0 `NULLS NOT DISTINCT`**. It also emits **11** bare
  `"id" UUID NOT NULL,` columns, which independently confirms the `@default(uuid())`-is-client-side finding.
  One looseness: the output opens `-- CreateSchema` at line 1 and `CREATE SCHEMA IF NOT EXISTS "public";` at
  line 2, not "opens with `CREATE SCHEMA …`".
- `--from-empty --to-schema <HEAD 310-line schema> --script` → exit 0, **367 lines**, 16 `CREATE TABLE`,
  6 `CREATE TYPE`, 9 `CREATE UNIQUE INDEX`. `diff` against the committed `prisma/migrations/0_init/migration.sql`
  (**175** lines) → exit **1**, 236 differing lines — digit-for-digit what `RV-50` row 30 published.
- **There is no conflict to settle.** 175 = the hand-maintained committed init; 367 = what the generator emits
  for today's 16-model schema; 269 = what it emits for the 12-model purge. Three different objects, all three
  correctly labelled by their owners. The only arithmetic that shifts is `:56`'s "~410 = 386 + 23": under the
  true 10-statement artifact the Option-A end state is 386 + 29 = **415**, and the rejected option's is
  269 + 3 + `1_datamodel_extras`. "~120 saved, not ~220" survives; both sides move.

## §4 Claim table

| # | Claim (quoted) | Where used | Verdict | Evidence |
| :-- | :-- | :-- | :-- | :-- |
| 1 | `audit_events_actor_id_fkey` is `ALTER TABLE "audit_events" … REFERENCES "professional_profiles"("id")` | step 4; step 8 | **PASS** | `0_init:156` verbatim, read in full. Direction as described. |
| 2 | `grep -rn 'REFERENCES "audit_events"' prisma/migrations/*/migration.sql` → no match | step 4; step 8; Evidence `:263` | **PASS** | Re-run → no output, **exit 1**. |
| 3 | `grep -rn audit_events … \| grep -v 0_init` → no match | step 8 | **PASS** | Re-run → no output, exit 1. `grep -c audit_events 0_init` → 6, matching `COMPAT-POLICY.md:110`'s line list. |
| 4 | §6.4's "all dropped FK constraints owned by dropped tables / no surviving table references a dropped one" holds across **all four** | step 7 | **PASS** | Deduped `REFERENCES "…"` targets over all six files: `class_groups, game_sessions, organization_memberships, organizations, participations, player_slots, professional_profiles` — none dropped. Union grep over all four table names → exit 1. |
| 5 | "The file is **9 statements**" | Goal/`:42`; step 8 ×2; `:159`; Exit gate `:195`; Divergence 5 | **FAIL** | Real artifact is **10**: 5 `DROP CONSTRAINT` + 4 `DROP TABLE` + 1 `DROP TYPE`, emitted by the mandated command at exit 0. |
| 6 | "Prisma's own generator will emit exactly that" | step 8 | **FAIL** | It emits the fifth `DROP CONSTRAINT`. The file nominated this as the check on its own reasoning; the check failed. |
| 7 | "No `DropForeignKey` is emitted for `audit_events`, and adding one by hand would be a defect" | step 8 | **FAIL** | One *is* emitted. And "dead weight before the drop / hard error after" is wrong: the generator puts it **before** the drop, where it is valid SQL. |
| 8 | "`**If it fails:**` … If the disagreement is a fifth `DROP CONSTRAINT` naming `audit_events_actor_id_fkey`, that contradicts step 8's FK-direction analysis and this file should be corrected" | step 8 | **FAIL (branch correct, outcome inverted)** | The clause is well-formed and fires — but the file then still asserts 9 everywhere else, and the *sibling* sentence in the same step ("A count of 5 constraints means the audit_events FK was hand-appended — **remove it**") instructs the opposite. Delete the "remove it" sentence; keep the correction branch, which now actually applies. |
| 9 | `grep -c 'DROP CONSTRAINT'` → **4**; `grep -c '^DROP\|^ALTER TABLE'` → **9** | step 8 `**Verify (content):**`; Exit gate | **FAIL** | Against the real output: **5** and **10**. `DROP TABLE` → 4 ✓, `DROP TYPE` → 1 ✓. The gate is non-vacuous (it can and does fail) but its expected values are wrong. |
| 10 | "9 statements is **26 lines** — derived, not measured" | step 8 | **FAIL** | The prediction is right for a 9-statement file (18+8=26) but the artifact is 10/29 (`wc -l` 30). Correctly *not* made an acceptance number — the one place the file's caution was warranted. |
| 11 | Dossier/`ADJ-01` publish 8 statements / 23 lines against a keep-`AuditEvent` schema | step 8; `:42` | **PASS** | Reproduced byte-exactly from a scratch keep-`AuditEvent` purge: 8 statements, 23 content lines, `wc -l` 24. |
| 12 | `COMPAT-POLICY.md:110`: "add `DROP TABLE "audit_events";` (`0_init:74`) and **nothing else**" | relied on at `:262` | **FAIL** | Governing document, same error. `:110` also asserts "Any phase file that says 10 statements did it by adding a redundant `DROP CONSTRAINT`" — which condemns the correct answer. |
| 13 | `phases/00-prerequisites.md:235`: "What P1b *does* own: the **9-statement** `6_drop_generation_a` (`phases/20-schema-and-migration.md` step 8 …)" | downstream of this file | **FAIL** | Already-propagated error, sourced from this file's step 8. Three documents now publish 9. |
| 14 | The earlier revision's 10 was "an inverted reading of the FK direction" | step 8; Evidence `:263`; Divergence 5 | **FAIL** | Reversed: the earlier revision matched the tool. Nothing about `:156`'s direction was inverted in a 10-statement count; only the *justification* differs. |
| 15 | plan-literal `sed` → P1012 at `:84`, context 83/84 | step 2 | **PASS** | Reproduced verbatim, exit **1**. `97 − 13` and `96 − 13` renumbering exact (13 = 10+1+2). |
| 16 | "the plan-literal cut FAILS `prisma validate` with P1012" | Goal-adjacent; step 2 | **PASS** | Exit 1, `Validation Error Count: 1`, single dangling target `CapabilityAssignment`. |
| 17 | Step 3's four relation fields `:97`/`:80`/`:79`/`:65`; step 4's `:66` + `:281-298`/`:299`; step 5's `:18-28`/`:245-260`/`:261-280`/`:300-310` | steps 3-5 | **PASS** | Every span opens on the quoted declaration. `AuditEvent` block is 18 lines (`:281-298`); the dossier's `:281-299` and COMPAT's "19-ln" include the separator — both defensible, worth one footnote. |
| 18 | Post-purge 12 models / 5 enums; 16/6 at HEAD | step 5; Exit gate | **PASS** | `grep -cE '^model '` → 16 → 12; `'^enum '` → 6 → 5. |
| 19 | Purge closure — no surviving reference to a removed type | steps 3-5 | **PASS** | 0 residue tokens, 0 named relations, 5 enum mentions, `prisma validate` green. |
| 20 | "`310 → 251` … does not reproduce" | Divergence 1 | **FAIL** | It reproduces exactly: blocks-without-separators (55) + four relation lines (4) = 59; 310 − 59 = **251**, validates. |
| 21 | "(10+15+19+11 = **55**) plus the 4 relation fields gives **252**" | Divergence 1 | **FAIL** | Internally inconsistent: 55+4 → 251. 252 is the 55+**3** plan-literal case (measured). |
| 22 | tidy keep-`AuditEvent` = 247; full recipe = 227 | Divergence 1; step 5; Exit gate | **PASS** | Both measured at exactly those values. Add: 228 is the same recipe with the trailing blank — ±1 is newline hygiene, so quote it as "227/228". |
| 23 | "the line count is quoted as measured-with-recipe, **never as a check**" vs Exit gate "`prisma/schema.prisma` is **227 lines** on this recipe" | `:290` vs `:194` | **FAIL (self-contradiction)** | The Exit gate books as an acceptance number the thing Divergence 1 forbids as an acceptance number. |
| 24 | `--from-empty --to-schema <purge> --script` → 269 lines, 12/5/11/8/23/0/0, 0 `DROP` | Option B §"scratch runs"; Evidence `:268` | **PASS (re-measured)** | exit 0, **269**, every sub-count exact. The "prior-revision run, not re-executed" hedge at `:256` is now unnecessary — the command is DB-free and permitted. |
| 25 | 367-line generated init vs 175-line committed `0_init` (`RV-50`) | rejected-option narrative | **PASS** | Both reproduced: 367 (`--to-schema` HEAD) and 175 (`wc -l`); `diff` exit 1, 236 differing lines. Not in tension with 269 — different schemas. |
| 26 | "~410 SQL ln" = 386 tracked + 23 hand-authored sixth | objection 1 | **PASS** | 386 ✓, 23 ✓ (as the dossier's 8-statement artifact). Note the true Option-A tail is 29 lines, so 415. |
| 27 | 13 `CHECK`, of which 8 survive; the 5 dying are `0_init:163,166,169` (`access_links`) and `:172,175` (`rate_limit_buckets`) | objection 2 | **PASS** | Re-derived by a different parser (`awk 'BEGIN{RS="CHECK "}'`): 5/0/0/1/3/4 = 13 ✓. Named-constraint grep → 12 (the 13th, `player_slots_player_number_positive` at `3:15`, is unnamed-`_check`) ✓. All five `0_init` CHECKs sit on dropped tables ✓. |
| 28 | 2 partial unique indexes at `3:56,58` | objection 2 | **PASS** | `awk '/CREATE UNIQUE INDEX/ && /WHERE/'` → exactly 2, at those lines, with those names. |
| 29 | 6 `gen_random_uuid()` defaults at `2:47,60`, `3:8,20,31,43` | objection 2 | **PASS** | `awk '/gen_random_uuid/ {print FILENAME":"FNR}'` → exactly those 6, each the `"id" UUID NOT NULL DEFAULT gen_random_uuid(),` line below its `CREATE TABLE`. |
| 30 | `capability_assignments`' `NULLS NOT DISTINCT` raw index at `0_init:160`, documented un-Prisma-able at `schema.prisma:254-256` | objection 2 tail | **PASS** | Both exact. Generated purge emits 0 `NULLS NOT DISTINCT` ✓. |
| 31 | `grep -rn dbgenerated prisma` → 0 hits | objection 3 | **PASS** | exit 1, no output. |
| 32 | History 6 dirs / 386 lines split 175/3/82/60/15/51; `migration_lock.toml` is the 7th tracked file | entry gate 3; Evidence `:270` | **PASS** | `wc -l` → 175/3/82/60/15/51 = 386 ✓; `git ls-files prisma/migrations` → 7 files (6 `migration.sql` + the lock) ✓, `provider = "postgresql"` ✓. |
| 33 | 16 tables created at `0_init:11,23,35,47,58,74,90`, `2:46,59`, `3:7,19,30,42`, `4:1`, `5:1,30`; minus 12 models = the 4 purged | step 7 | **PASS** | Every cited line is a `CREATE TABLE`; `sort -u \| wc -l` → 16; the 4 diffed are exactly `capability_assignments, access_links, rate_limit_buckets, audit_events`. |
| 34 | `1_add_paused_at` is 3 lines whose only statement ALTERs `access_links` | `:42`; Evidence `:271` | **PASS** | `:3` `ALTER TABLE "access_links" ADD COLUMN "paused_at" TIMESTAMPTZ(3);`. |
| 35 | `2_v1_adult_roles_and_classes:13-27,32-41` are data `UPDATE`s reading `capability_assignments` (`:20`, `:36`) | Option A "Cost"; Evidence `:265` | **PASS** | Exact. Adds: they also read the `capability` **enum** at `:25,:38`, so the sequential order is load-bearing for `DROP TYPE` too — the file argues only the table. |
| 36 | `DROP TYPE "capability"` is droppable after `capability_assignments`; used only at `0_init:50` | step 8 | **PASS** | `"capability"` type appears at `0_init:8` (create), `:50` (the only column), `:114`/`:160` (indexes on that column) — all inside the dropped table. Generator emits it last ✓. |
| 37 | "only **6 of those 11**" have a server default; the other five are `professional_profiles`, `organizations`, `organization_memberships`, `result_events`, `active_time_events` at `0_init:12,24,36`, `5:2,31`; `1_datamodel_extras` would have "restored parity across 6" | objection 5 correction; Divergence 3 | **PASS — the reviser's correction is right** | 6 + 5 = 11 ✓. Bare `"id" UUID NOT NULL,` at all five cited lines ✓. `@id @default(uuid())` → 14 at HEAD (`:57,72,88,106,123,140,153,168,197,217,231,246,262,282`), −3 purged (`:246,:262,:282`) = **11** ✓, and 11 in the generated purge init ✓. `RateLimitBucket` key `@db.Char(64)` at `:301` ✓; `GameState` id is a FK at `:183` ✓. `grep -rn "SET DEFAULT\|DROP DEFAULT"` → no output ✓. |
| 38 | Evidence row: "bare `"id" UUID NOT NULL,` at `0_init:12,24,36` and `5:2,31` = **5 more**" | Evidence `:277` | **FAIL (presentation)** | The underlying grep returns **8** hits — `0_init:48` (`capability_assignments`), `:59` (`access_links`), `:75` (`audit_events`) are also bare. The 5-line subset is correct *after* the purge but the row quotes the command as if it produced it. |
| 39 | Entry gate 1-4: `e5aaf1e`+clean; 310 + valid; 6 dirs/386/7 tracked/`ep-example` in untracked `.env`; local CLI 7.9.1 win32 Node v22.23.1 | Entry gate | **PASS** | All four re-run. `prisma validate` on a **copy** of HEAD → valid. `git ls-files .env*` → `.env.example` only; `.env:2,5` and `.env.example:9,12` hold `ep-example` in both `DATABASE_URL` and `DIRECT_URL`. `slice-03-05-portal-handoff.md:36` does state "no migration has been applied". |
| 40 | Step 6's sweep proves no surviving code names the deleted types | step 6 | **VACUOUS-GATE** | At HEAD the sweep hits **24** files, all named in the plan. But it misses `src/server/db/prisma-capability-reader.ts` — a purge target (`REFACTOR_PLAN.md:55`) — entirely: its reach into the dropped table is lowercase `capabilityAssignments:` at `:26`, `capability: true` at `:28`, `:44,:45`, and `grep` of the step-6 regex on that file → **exit 1, zero matches**. So the gate cannot fail on a file whose survival would break the purge; `npm run typecheck` (step 10) is the real control, and the step should say so. |
| 41 | "at HEAD **four files** still import the enum from the generated client — `actions.ts:122,129,137,148`, `access-link-service.ts:2` (+9 call sites), `authorization-service.ts:1`, `prisma-capability-reader.ts:5-17`" | step 6 "If it fails"; Evidence `:275` | **FAIL** | Two-way error. `prisma-capability-reader.ts:5` is `CapabilityReader,` — a type from `@/server/services/authorization-service`, **not** from `@/generated/prisma/enums`; the file imports that enum nowhere. Real `Capability` importers at HEAD are **five**: `actividades/actions.ts:122` (dynamic — verified: `const { Capability } = await import("@/generated/prisma/enums")`), `access-link-service.ts:2` (and **9** `Capability.` sites ✓), `authorization-service.ts:1`, plus the omitted `tests/unit/access-link-service.test.ts:4` and `tests/unit/authorization.test.ts:3`. |
| 42 | `v1-policy.ts` role-only, import block `:1-5`; `ADJ-01:60` cites the nonexistent `src/application/…` path | step 6; Divergence 6 | **PASS** | `v1-policy.ts:1-5` pulls `OrganizationRole, PlatformRole, RecordStatus` from `@/generated/prisma/enums`, no `Capability`. `src/application/authorization/v1-policy.ts` → *No such file*; `src/server/authorization/v1-policy.ts` exists. Divergence 6 correct. |
| 43 | `0_init:144,147` and `:150,153` are the four FKs; tables at `:47,58,74,90`; indexes `:126,129,132`, pkey `:86`, table `:74` | step 8; Evidence `:262/:263` | **PASS** | Every line lands as quoted. One transposition: the generator's `DropTable` order is CA, AL, **AE**, RLB — `:159` lists RLB before AE. Cosmetic, but "match character for character" invites a false red. |
| 44 | "`**Verify (nothing was left half-built):**` `grep -n "migrate diff\|shadowDatabaseUrl\|SHADOW_DATABASE_URL\|services:" .github/workflows/ci.yml` → **no output**" and "`grep -c "prisma validate" .github/workflows/ci.yml` → **1**"; repeated at Exit gate | step 9; Exit gate | **FAIL (×2)** | **There is no `ci.yml`** — `ls .github/workflows` → `deploy.yml` only. The first command prints `grep: .github/workflows/ci.yml: No such file or directory` to stderr and exits **2**, not "no output" from a 0/1 grep; the second **cannot** return 1 — it errors, prints nothing, exit 2. Both are Phase-4 artifacts this phase does not write. Same for `deploy.yml`: `prisma validate` appears in neither file today. |
| 45 | `ls prisma/migrations` → the 6 originals + `6_drop_generation_a` + `migration_lock.toml`, lexicographic = apply order | step 8 `**Verify (order):**`; Exit gate | **PASS** | Correct sequential shape; `migration_lock.toml` sorts after the digits, matching the published string. `ls prisma/migrations \| grep extras` → no output ✓. |
| 46 | Tooling traps: no `--*-schema-datamodel`; input list; **zero** `shadow` in the help; `--exit-code` "Empty: 0, Error: 1, Not empty: 2"; plain `--script` exits 0 on an empty diff | Tooling traps; step 8 | **PASS** | `migrate diff --help` re-run: `grep -ci shadow` → **0**; input list is exactly the 8 published flags; `:45` carries the exit-code sentence verbatim; no `--*-schema-datamodel` flag. Measured: `--exit-code` on head→purge → **2**; on a self-diff → **0**; plain `--script` on a self-diff → **0**. Step 8's non-emptiness gate is therefore correctly specified and genuinely can fail. |
| 47 | `--schema` flag path form writes into `prisma/migrations/` in step 8's emit command | step 8 | **PASS (hazard, unmitigated)** | `> prisma/migrations/6_drop_generation_a/migration.sql` is the only write into the tracked tree in the whole file, and it is also the mechanism that lets a stale `purged.prisma` (e.g. one still containing `AuditEvent`) ship as a 8-statement migration with every gate green. The file's `**If it fails:**` covers disagreement with the list, not staleness of the scratch input. Add: re-derive `purged.prisma` from the committed schema in the same command chain, never from a leftover. |
| 48 | `RATE_LIMITED`: `errors.ts:11`, `api-error.v1.schema.json:21`, third site `atividades/actions.ts:181`; `protocol-error.v1:11-16` 4 codes | step 11 | **PASS** | `grep -rn "RATE_LIMITED" src contracts tests` → exactly 3 hits at those lines. `api-error.v1.schema.json:21` = `"RATE_LIMITED",` ✓. `protocol-error.v1:11-16` is the 4-code enum ✓. `errors.ts:11` ✓ inside `apiErrorCodes` opened at `:5`. |
| 49 | `portal-view-service.ts:416` = `export const auditEvents = demoRuntime ? demoAuditEvents : []` | step 4; Evidence `:273` | **PASS** | `sed -n '416p'` verbatim. |
| 50 | Class-B surface untouched: `id_atividade`/`versao_atividade` at `src/contracts/v1/schemas.ts:159,161,246`; `protocol-error.v1` + fixtures; `COMPAT-POLICY.md:45/:46` | Interfaces; Do-not-touch | **PASS** | `:159` `id_atividade: idSchema,`, `:161` `versao_atividade: positiveIntegerSchema,`, `:246` `id_atividade: z.literal(idAtividade),`. `:45`/`:46` land on B1/B2. No schema purge reaches any of them. |
| 51 | Prisma config ground truth: 12 lines, `:1` dotenv, `:4` `DIRECT_URL`, `:11` conditional `datasource.url`, no `shadowDatabaseUrl`; `schema.prisma:6-8` has no `url` | `:37`; out-of-scope; step 12 | **PASS** | Read in full; all four line numbers exact; `grep -n shadow prisma.config.ts` → no output. The `dotenv/config` → structural-hazard argument is sound. |
| 52 | `COMPAT-POLICY.md:115` "describes the Option-A material as 'already researched'" | Divergence 5 | **FAIL (citation)** | Actual: `:120`. `:115` is blank. In a file whose own Divergence 12 is a litany about COMPAT line drift, and which advises "prefer the §/edit label", this is the one citation it gets wrong in the direction that matters (it is the passage used to argue §6.4's list is "true of the strategy, false of the artifact"). |
| 53 | Every other `COMPAT-POLICY.md` / `REFACTOR-DOSSIER.md` / `ADJ-01` / `REFACTOR_PLAN.md` citation | throughout | **PASS** | Sampled and opened individually: `:67`, `:69`, `:70`, `:75` (edit 7), `:77`, `:78`, `:86`, `:87`, `:88`, `:95-103`, `:103`, `:107`, `:24`, `:25`, `:26`, `:30`, `:45`, `:46`, `:10-16`; dossier `:54`, `:92`, `:206-218`, `:232`, `:234`, `:238-242`, `:240`, `:248`, `:250-253`, `:255`, `:257-274`, `:276`, `:278`, `:288-294`, `:296-303`, `:308-309`, `:312`, `:314`, `:316-318`, `:511`, `:578`, `:587`, `:601`, `:632`, `:635`; `ADJ-01:11-13`, `:22`, `:32`, `:34-51`, `:55`, `:59`, `:60`, `:66`; plan `:84`, `:85`, `:86`. All land on the quoted text. `REFACTOR_PLAN.md:85` really is "Keep `model AuditEvent`", `:86` really names `6_drop_generation_a/migration.sql`, and `:84` already names **both** RATE_LIMITED files — so the plan never needed the deviation the file withdraws. Loose: `ADJ-01:32` is cited for "exits 0 even when the diff is empty", but `:32` actually says exit 0 "because there is nothing to report"; the true claim lives at dossier `:278`, also cited. |
| 54 | `REFACTOR-DOSSIER.md:600` §12 r1 still reads "4 relations, 3 models, 1 enum dropped" | (not cited by the file) | **MISSING** | Adopted edit 7 makes it 5 relations / 4 models — exactly the increment this file's Goal states. Divergence 5 correctly demands a §6.4 replacement but does not book §12 r1, which carries the same stale object-set. Add to the "whoever revises" list. |
| 55 | Step 5's "third check that does not depend on blank-line hygiene": `grep -cE "^[a-z]+ [A-Za-z]+ \{\|^  @@map" prisma/schema.prisma` | step 5 | **VACUOUS-GATE** | No expected value is published for it (before or after), so nothing can be compared; and as a count it is just 2×(models+enums). The file itself demotes it ("prefer the `^model`/`^enum` pair"), which is the right call — but it should not sit in a `**Verify:**` position. |
| 56 | Step 10 (`prisma generate && npm run typecheck && npm run check`), step 11 (`npx vitest run tests/unit/v1-contracts.test.ts`), and the `.prettierignore`/prettier-no-SQL-parser argument around them | steps 10-11 | **UNREPRODUCIBLE ×2** / **PASS ×1** | `prisma generate` writes `src/generated/prisma` and `npm run check` runs the suite — both out of bounds here, so the green-baseline claims are untested. The supporting facts are checked: `.prettierignore:5` = `contracts`, `:8` = `prisma/schema.prisma`, `prettier@3.9.6`, and `node_modules/prettier/plugins` holds `acorn, angular, babel, estree, flow, glimmer, graphql, html, markdown, meriyah, postcss, typescript, yaml` — **no `sql`** ✓. |
| 57 | "the deleted drift leg cannot run today: exit **1**, `You must set datasource.shadowDatabaseUrl …`" (`phases/00-prerequisites.md` §4 0.3, quoted at `COMPAT-POLICY.md:70`) | Option A; step 9; Tests | **UNREPRODUCIBLE (by rule) · PASS as a citation** | Not re-run: it requires `migrate diff --from-migrations`, forbidden. `00-prerequisites.md:150` carries the identical command, the identical error string and exit **1**, and `:235` confirms the disposition. `COMPAT-POLICY.md:70` quotes it. Structurally corroborated: `--shadow-database-url` is not a 7.9.1 flag and `prisma.config.ts` has no `shadowDatabaseUrl`, so `--from-migrations` is unreachable here. |
| 58 | `out/` untracked (`.gitignore:7`, `git ls-files out` → 0); dossier `:54` "committed" corrected by `COMPAT-POLICY:77`; no `src/runtime/target.ts` | Do-not-touch; Evidence `:284` | **PASS** | `.gitignore:5,6,7` = `/.next`, `/.next-demo-dev`, `/out`; `git ls-files out \| wc -l` → 0; `dossier:54` does say "104 committed". `src/runtime/target.ts` does not exist and this file never cites it (no leak from the seam phase). |
| 59 | Ruling consistency: history sequential, `6_drop_generation_a` hand-authored, **no** drift gate, **no** `shadowDatabaseUrl`/`services:`/byte-compare, edits 5 and 7 applied, §6 governs | whole file | **PASS** | Grepped for collapse artifacts: `1_datamodel_extras` occurs only inside the rejected-option narrative (`:48`, `:67`), the absence gate (`:167`) and the "that sentence dies with the option" sentence (`:206`); no extras-count gate; no "269 is the end state" claim (`:291` prices the *rejected* option at ~290 and forbids quoting `:24`'s "~190" as measured); every byte-compare mention (`:40`, `:64`, `:165`, `:248`) says it is unavailable or dead. `:8` states §6 governs over §4. No surviving leak found. |
| 60 | "`REFACTOR-DOSSIER.md:92`: `format:check` is already red at HEAD" and the Phase-0 statefulness dependency | step 10; Depends on | **PASS** | `:92` verbatim ("`format:check` fails on `main` today"), and `phases/00-prerequisites.md:12` re-measures it red on exactly `REFACTOR_PLAN.md`, exit 1. |

## §5 Replacement text for the FAILs that change the artifact

**step 8, replacing `:158`-`:159` wholesale:**

> **Five `DropForeignKey`s are emitted, one per FK owned by a dropped table.** All five constraints in the
> deletion set share one shape — `ALTER TABLE <dropped> … REFERENCES <survivor>("id")` — at
> `0_init:144,147` (`capability_assignments`→`organization_memberships`,`organizations`), `:150,153`
> (`access_links`→`organizations`,`professional_profiles`) and `:156` (`audit_events`→
> `professional_profiles`). Postgres would remove each implicitly with its table, and `REFACTOR-DOSSIER.md:276`'s
> "no FK-ordering hazard" reading of that ownership is correct — but it is a property of **five** constraints,
> not four, so it cannot be used to exclude the fifth. Prisma's diff vocabulary emits the explicit drop anyway,
> in the same position (all `DropForeignKey` before all `DropTable`), where it is valid SQL. **The file is
> therefore 10 statements** — 5 FK + 4 table + 1 type — and `**Verify (content):**` is
> `grep -c 'DROP TABLE'` → **4**, `grep -c 'DROP CONSTRAINT'` → **5**, `grep -c 'DROP TYPE'` → **1**,
> `grep -c '^DROP\|^ALTER TABLE'` → **10**. Emitted size: 20 non-blank + 9 separators = 29 lines, `wc -l` 30
> **[me]**. An earlier revision of this file counted 10 and was right; the 9-count that replaced it was the
> error. Do **not** delete a fifth constraint line the generator emits — if it is absent, your `purged.prisma`
> still contains `model AuditEvent` and the migration is short a table.

**step 8 `**If it fails:**`, last two sentences → **If the emitted count is 9 with no `audit_events`
`DROP CONSTRAINT`, re-check the scratch purge for a surviving `model AuditEvent` before believing the diff.**

**Exit gate `:195`:** `statement counts DROP TABLE **4**, DROP CONSTRAINT **5**, DROP TYPE **1** (= **10** total)`.

**`:42`:** `…and **10** once AuditEvent is dropped (step 8's reconciliation: one DROP TABLE **and** its
DROP CONSTRAINT, which is what the generator emits)`.

**Divergence 1, first sentence →** `251 **does** reproduce, for the recipe the plan states: four model/enum
blocks without separators (10+15+19+11 = 55) plus four relation lines (4) = 310 − 59 = 251, and it validates.
The plan-literal `sed` — which omits the fourth relation field — yields 252 with 3 stray double-blank separators;
tidying the separators with `AuditEvent` kept yields 247; this phase's purge yields 227 (228 if the trailing
blank survives). The dossier's number was never wrong; what was missing is that all four counts are the same
purge at different hygiene levels, so the count is quoted with its recipe and **not** gated.`

**Exit gate `:194`, delete** the clause `**prisma/schema.prisma** is **227 lines** on this recipe … **Not** the
dossier's 251` — it contradicts `:290` and the 227/228 ambiguity. Replace with `12 models / 5 enums and
`prisma validate` green (line count is recipe-labelled prose, not a gate).`

**step 9 / Exit gate, the `ci.yml` pair →** *There is no `.github/workflows/ci.yml` at `e5aaf1e` (only
`deploy.yml`), so these are **forward** assertions about Phase 4's output, not checks this phase can run. Word
them as "when Phase 4 writes `ci.yml`, it must contain `prisma validate` exactly once and zero occurrences of
`migrate diff` / `shadowDatabaseUrl` / `SHADOW_DATABASE_URL` / `services:`", and note that `grep` on a missing
path exits **2** with a stderr line — so "no output" is not what the current tree produces.*

**Evidence `:277`:** `bare "id" UUID NOT NULL,` → **8** hits, of which **5** are on surviving tables
(`0_init:12,24,36`, `5:2,31`); the other three (`0_init:48,59,75`) die with their tables.`

**step 6 / Evidence `:275`:** `five sites import the generated Capability: src/app/(professional)/portal/atividades/actions.ts:122
(dynamic) with uses at :129,137,148; src/server/services/access-link-service.ts:2 (+9 `Capability.` sites);
src/server/services/authorization-service.ts:1; tests/unit/access-link-service.test.ts:4;
tests/unit/authorization.test.ts:3. `src/server/db/prisma-capability-reader.ts` is a purge target
(`REFACTOR_PLAN.md:55`) that reaches `capabilityAssignments` only in **lowercase** (`:26,:28,:44,:45`) and is
therefore invisible to this sweep — cite `npm run typecheck` for it, not step 6.`

**Divergence 5:** `COMPAT-POLICY.md:115` → `:120`; and add `the 9→10 correction belongs in COMPAT-POLICY.md:110
and :24 and in phases/00-prerequisites.md:235, all three of which now publish 8 or 9`.

## §6 What this phase would have gotten wrong

1. **It would have shipped a migration that disagrees with its own tool, and told the implementer to edit the
   tool's output to match.** Step 8 says "Emit it, do not type it", then says that if the emitted file contains
   `ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_actor_id_fkey";` — which it does — that line means
   somebody hand-appended it and must be removed. The 9/10 dispute was settled by one permitted, DB-free command
   that the previous two revisers each declined to run: the first forbade it to himself by misreading his own
   scope, the second by misreading the ban on `--from-migrations` as a ban on all diffing. The file's stated
   falsification test was correct and its answer was wrong.
2. **The error is already multiplying.** `COMPAT-POLICY.md:110` — the owner's §6 verification bullet, written as
   though it were the measurement that closed the question — says "add `DROP TABLE "audit_events"` and **nothing
   else**", and `phases/00-prerequisites.md:235` has picked up "the 9-statement `6_drop_generation_a`" citing
   step 8. Three documents, one defect, and the wrong one is the governing file.
3. **Two gates would read green on a wrong artifact and one red on a right one.** Step 9's `ci.yml` greps run
   against a file that does not exist (so "no output" is satisfied by absence, exit 2, and `grep -c "prisma
   validate" → 1` is unsatisfiable). Step 6's sweep, the file's designated proof that Phase 1 did its job, cannot
   see `prisma-capability-reader.ts` at all. And step 8's content gate is red on the generator's correct 10.
4. **It retired a correct number by declaring it unreproducible.** `310 → 251` is exactly what the plan's own
   recipe produces, and the file's disproof is an arithmetic slip in its own parenthetical (55 + 4 reported as
   252). Meanwhile the number it *does* gate on — 227 — differs by one line from 228 purely by whether a trailing
   blank survives, which is precisely the fragility it warned about and then booked into the Exit gate anyway.
5. **It under-priced what the sequential history is worth, and mis-priced what it costs.** The strongest argument
   for Option A that the file makes (`2:13-27,32-41` transform rows) is real but incomplete: those statements also
   read the `capability` **enum** at `2:25,38`, so the apply-order requirement protects `DROP TYPE` as well as the
   table. On the cost side, "~410" is 386 + 23 only because the sixth file was assumed to be 8 statements; the
   true Option-A tail is 29 lines, i.e. ~415, and the rejected option's is 269 + 3 + an extras file. The
   conclusion (~120 saved, not ~220) is right; both of the numbers under it are not.
6. **The 269 hedge understated its own evidence.** The file presents the regenerated purge init as a run it
   "reported rather than re-executed" and `COMPAT-POLICY.md:88` calls it moot. It re-measures exactly — 269,
   12/5/11/8/23, 0 CHECK, 0 `gen_random_uuid`, 11 default-less UUID ids. That is the only quantitative leg the
   rejection of edit 1 stands on, and it is now reproducible by any reader with a scratch directory and no
   database. It should be re-marked **[me]**.

## §7 Could not check

- **`migrate diff --from-migrations`** (the deleted drift leg's exit **1** and error string) and anything else
  touching a database, per the brief. Settled instead from `phases/00-prerequisites.md:150`,
  `COMPAT-POLICY.md:70`, and the structural facts I could verify (0 `shadow` occurrences in `--help`, no
  `shadowDatabaseUrl` in a 12-line `prisma.config.ts`). Row 57 stays UNREPRODUCIBLE-as-executed.
- **`prisma generate`, `npm run typecheck`, `npm run check`, `npx vitest run tests/unit/v1-contracts.test.ts`** —
  `generate` writes `src/generated/prisma` and `check`/`vitest` execute the suite; both out of bounds. Step 10's
  "typecheck clean" and step 11's "test passes" are therefore untested claims; the `.prettierignore` /
  prettier-has-no-SQL-parser premises around them were verified statically (row 56).
- **Whether the emitted file should be committed with or without a trailing newline** — `wc -l` differs by one
  (30 vs 29) and no gate in the file distinguishes them.
- **`REFACTOR-PLAN`'s post-Phase-1 tree** — steps 3-12 assume Phase 1's 24-file deletion has landed. I could only
  measure at HEAD, so "step 6's sweep goes empty after Phase 1" is argued, not observed; row 40 shows it could go
  empty *before* one purge target is gone.
- **`COMPAT-POLICY.md` §5.1/§6's `[S]` live-URL claim** (`/atividade/7FQ-29M/`) — external fetch, out of scope,
  and this file does not depend on it.
