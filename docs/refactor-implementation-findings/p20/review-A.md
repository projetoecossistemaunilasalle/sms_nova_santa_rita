# P20 review A — Clean Schema Baseline

Reviewer A, independent. Spec: `docs/refactor-dossier/IMPLEMENTATION-READY.md` §P20
(lines 203-256), cross-read with §"Database and Rollback" (lines 475-505) and the
preamble (lines 1-4). Working tree at `780b0a8` + uncommitted P00/P10/P20 changes.
`review-B.md` and `verification-*.md` were not read.

## Scope reviewed

| Artifact | State |
| --- | --- |
| `prisma/schema.prisma` | modified (deletions only, 83 lines removed) |
| `prisma/migrations/0_init/migration.sql` | modified (regenerated baseline + 10 appended rules, 289 lines) |
| `prisma/migrations/1_add_paused_at/` … `5_v1_game_events/` | deleted (1-3 staged `D`, 4-5 were untracked, so deletion leaves no HEAD trace) |
| `prisma/migrations/migration_lock.toml` | unchanged (`git diff` empty, `provider = "postgresql"`) |
| `src/generated/prisma/` | regenerated (gitignored, `.gitignore:27`) |
| `docs/schemas/database-model.md` | rewritten (+240/-… lines) |

Everything else in the working tree is P00/P10 and was excluded from judgment except
where P20 §7's "search first-party source" sweep reached it.

## Verification performed

**1. Schema diff is deletions-only and complete.**
`git diff -- prisma/schema.prisma` = 83 deletions, 0 insertions. Removed: `enum
Capability` (:15-27 at HEAD), 3 inverse pairs (`ProfessionalProfile.createdAccessLinks`
+ `.auditEvents`, `Organization.scopedCapabilities` + `.accessLinks`,
`OrganizationMembership.capabilityAssignments`) and the 5 model blocks
(`CapabilityAssignment`, `AccessLink`, `AuditEvent`, `RateLimitBucket`) plus the
`CapabilityAssignment` comment referencing the raw `0_init` unique index. No surviving
model's fields, `@@index`, `@@unique`, `@@map`, `@map`, `onDelete`, or generator/datasource
block was touched. Counts: `grep -c "^model "` = 12, `grep -c "^enum "` = 5 — matches
acceptance.

**2. `0_init` is byte-equivalent to a freshly generated from-empty baseline.**
```
DIRECT_URL="postgresql://placeholder:placeholder@localhost.invalid:5432/placeholder" \
  npm exec -- prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
```
exit 0, non-empty, 269 lines, 12 `CREATE TABLE` / 5 `CREATE TYPE` / 19
`CREATE (UNIQUE )INDEX` / 13 `ADD CONSTRAINT` FKs / 0 `DROP`. Diffed
(whitespace-blank-stripped) against `0_init` lines 1-269: **IDENTICAL, zero delta**.
`0_init` lines 270-289 are one blank line, a 6-line comment, and exactly 10 statements.
Self-consistent as a from-empty baseline: `CREATE SCHEMA` → 5 enum types (all created
before first use) → 12 tables → 19 indexes → 13 `ALTER TABLE … ADD CONSTRAINT` FKs
(every referenced table exists by then, all 13 present) → 10 appended rules, all
applied after their target tables. The ten rules are appended rather than folded into
the `CREATE TABLE` bodies, which is why the file is not a literal generator dump — as
the runbook intends.

**3. The ten rules are byte-faithful to history.**
Compared each against `git show HEAD:prisma/migrations/{3_slice_02_player_access,4_v1_game_state,5_v1_game_events}/migration.sql`:

| Rule (`0_init` line) | Source | Predicate match |
| --- | --- | --- |
| `player_slots_player_number_positive` (277) | `3_…:15` (inline table constraint) | `CHECK ("player_number" > 0)` — exact |
| `game_states_revision_check` (278) | `4_…:12` | `CHECK ("revision" > 0)` — exact |
| `game_states_protocol_version_check` (279) | `4_…:13` | `CHECK ("protocol_version" = 1)` — exact |
| `game_states_schema_version_check` (280) | `4_…:14` | `CHECK ("schema_version" = 1)` — exact |
| `result_events_duration_ms_check` (281) | `5_…:18` | `CHECK ("duration_ms" >= 0)` — exact |
| `result_events_result_state_check` (282-283) | `5_…:20` | `IN ('sucesso','falha','cancelado','tempo_esgotado','erro_inicializacao')` — exact, same order |
| `active_time_events_active_ms_check` (284-285) | `5_…:43` | `BETWEEN 1 AND 30000` — exact |
| `active_time_events_mode_check` (286-287) | `5_…:45` | `IN ('exploration','dialogue','activity')` — exact |
| `player_credentials_one_active_per_slot` (288) | `3_…:56` | `UNIQUE … WHERE "status" = 'active'` — exact |
| `game_sessions_one_active_per_class` (289) | `3_…:58` | `UNIQUE … WHERE "status" = 'active'` — exact |

**Completeness of the hand-append list is also confirmed from the other direction:**
every raw rule in the deleted history that targets a *surviving* table is in the list
of ten. The old `0_init`'s five raw rules were all on `capability_assignments` /
`access_links` / `rate_limit_buckets` — all deleted tables — so nothing was lost.
`1_…` was solely `access_links.paused_at`; `2_…`'s only extras were a data
`UPDATE` block (meaningless from empty) and two `gen_random_uuid()` defaults.

**4. `gen_random_uuid()` count is zero** (`grep -n gen_random_uuid 0_init` → no hits),
matching §6. Verified this is safe for the surviving code: the only raw SQL in
`src/server/db/` is `SELECT … FOR UPDATE` lookups and one `COUNT` — no raw `INSERT`
anywhere (`grep -rn '$executeRaw'` → `prisma-game-state-store.ts:97` only, a count).
All inserts go through Prisma's `@default(uuid())`, as the runbook asserts.

**5. `prisma validate` passes.**
`DIRECT_URL=… npm run prisma:validate` → `The schema at prisma\schema.prisma is valid 🚀`
(Prisma 7.9.1, Node v24.19.0, npm 11.17.0 — matches the repo pins).

**6. `database-model.md` is accurate against schema + `0_init`.**
- Tables section lists exactly the 12 surviving tables with correct uniqueness,
  index, and FK-restrict claims; verified each against `schema.prisma` and `0_init`.
- New `## Enums` section lists exactly the 5 surviving enums with correct values and
  the correct `Used by` column.
- `## Invariants and SQL checks` table: 10 rows; the name column set-extracts to
  exactly the same 10 names as the SQL (programmatic `diff` → identical).
- Mermaid ER diagram covers all 12 tables with 13 edges, matching the 13 FKs in
  `0_init` one-for-one, including `PLAYER_SLOTS ||--o| GAME_STATES` (correctly
  zero-or-one, since `game_states.player_slot_id` is the PK).
- "Every foreign key is `ON DELETE RESTRICT`" — true of all 13 FKs in `0_init`.
- Rotation claim matches `src/server/db/prisma-player-access-store.ts:249-262`
  (revoke-then-create, which is what makes the partial unique index satisfiable).
- SHA-256/64-char/lowercase-hex claim matches
  `src/server/security/player-credential-tokens.ts:12-14`
  (`createHash("sha256").update(token,"utf8").digest("hex")`, `TOKEN_BYTES = 32`).
- No removed-model residue: `grep -niE "capability_assignments|access_links|audit_events|rate_limit_buckets|\bcapability\b"` over `docs/schemas/`, `docs/current-architecture.md`, `README.md`, `contracts/schemas/README.md` → no hits. Historical hits exist only in `portal-v1-specification.md` and `docs/implementation/*`, which are linked from an explicit "Legacy model (superseded) … Do not treat them as current requirements" section.
- All 8 relative links resolve (`portal-v1-specification.md`, `../current-architecture.md`, `../../prisma/schema.prisma`, `../../prisma/migrations/0_init/migration.sql`, the four `docs/implementation/phase-0*.md`).
- No invented claim found. The one factual substitution — "Nothing is deployed yet" →
  "Migration history is a single post-refactor baseline" — is *more* accurate than the
  text it replaced, and it promises no upgrade/rollback path.

**7. Acceptance negatives hold.**
No migration-SQL snapshot, no historical-file immutability test, no generated
client-shape test: `grep -rE "readFile|toMatchInlineSnapshot|toMatchSnapshot" tests`
returns no prisma/migration/schema hits; `find tests -name __snapshots__ -o -name
*.snap` → empty. The only P20-adjacent test changes in the tree are P10's. No `migrate`
script was added to `package.json` (only `prisma:generate` / `prisma:validate`), and
CI (`.github/workflows/ci.yml:46`) runs `npm run prisma:validate` — no shadow-DB /
drift gate, consistent with the runbook's "one normal Vitest run is the permanent
gate". No compat/upgrade/rollback language in `docs/schemas/`,
`docs/current-architecture.md`, `README.md`, or `walkthrough.md` (the one
"compatibilidade" hit is `walkthrough.md:19`, about GitHub Pages asset paths — unrelated).
Line endings: all three changed files are LF-only, matching HEAD; no EOL churn.

**8. Generated client is consistent with the new schema.**
`src/generated/prisma/models/` contains exactly the 12 surviving models,
`enums.ts` exports exactly the 5 surviving enums, and no removed model/enum name
appears anywhere in the generated output. `models.ts`/`enums.ts` mtime
`19:21:57` is later than `schema.prisma` `19:21:03`.

## Findings

### MINOR-1 — `prisma/schema.prisma` is no longer `prisma format`-canonical in three models (P20-introduced, cosmetic, ungated)
`prisma/schema.prisma:46-53` (`ProfessionalProfile`), `:59-66` (`Organization`),
`:73-81` (`OrganizationMembership`) keep the column padding computed for the now-deleted
longest field names (`createdAccessLinks`, `scopedCapabilities`,
`capabilityAssignments`). `prisma format` wants them re-narrowed.

Evidence: copied the schema to a temp dir and ran `npm exec -- prisma format --schema
<tmp>` — the only diff hunks are the three models above. The same experiment on
`git show HEAD:prisma/schema.prisma` shows HEAD was already non-canonical, but *only*
in `Participation` and `GameState`; the three models above were clean at HEAD, so P20
introduced the drift rather than inheriting it.

Impact: none functionally — `prisma validate` passes, `prisma/schema.prisma` is listed
in `.prettierignore:8`, and neither `npm run check` nor CI runs a `prisma format`
check, so no gate is red. Left as-is is defensible, since `prisma format` would also
rewrite the two pre-existing deviants and mix unrelated churn into the P20 diff. Worth
a one-line decision: either accept the drift explicitly or run `prisma format` and
take the two extra hunks.

### INFO-1 — `src/generated/prisma` regeneration is not reviewable from the diff
`.gitignore:27` ignores the generated client, so "regenerated" cannot be confirmed by
`git diff`. Verified indirectly instead (12 model files, 5 enums, no removed names,
mtime newer than the schema). Not a defect; noting that the runbook's "from clean
generated output" gate depends on a build step whose output is untracked.

### INFO-2 — pre-existing `game_states_schema_version_check` vs the protocol-version
### convention
`0_init:280` pins `schema_version = 1` (faithful to `4_v1_game_state:14`, and required
verbatim by the runbook), while `docs/schemas/README.md` states "A breaking shape
change increments `schema_version`". The first breaking protocol change will need a
migration to relax the CHECK. P20 is correct to keep it; the tension is pre-existing
and lives in a P00/P10-owned file. Flagging for the release owner only.

### INFO-3 — removed-model name residue outside P20's change set
`src/components/portal/portal.module.css:2376, 2386, 2399, 2400, 2802` still define a
`.auditEvent` CSS class, left over from the `portal/admin/auditoria` page deleted in
P10. It is not a Prisma model/property reference, `portal.module.css` is untouched by
P20, and dead-CSS purging belongs to the P10/P40 scope. Not a P20 finding.

### INFO-4 — historical doc still names a deleted migration directory
`docs/implementation/slice-02-handoff.md:53` cites
`prisma/migrations/3_slice_02_player_access/migration.sql`. The file opens with
"Snapshot: 22 September 2026 … records the original handoff snapshot", and the
runbook preamble classifies `docs/implementation/*` as historical evidence. Outside
P20's change set; noted only so it is not mistaken for a live pointer.

### INFO-5 — no `prisma format`/`prisma migrate` gate exists, by design
Cross-checked against `docs/refactor-dossier/COMPAT-POLICY.md:3` ("The runbook
supersedes section 6's migration-history ruling under the current no-compatibility
scope") and `phases/10-purge-generation-a.md:25` (which still prescribes sequential
history + `6_drop_generation_a`). The runbook wins by its own precedence clause, so
P20's collapse to a single baseline is the mandated behavior and the stale phase-file
sentence is expected residue, not a missed requirement.

## Severity roll-up

CRITICAL: 0 · MAJOR: 0 · MINOR: 1 (cosmetic, ungated, non-blocking) · INFO: 5

## Verdict

**P20 satisfied: yes.**

All four numbered steps and all five acceptance bullets are met and independently
re-derived, not taken on trust:

- 12 models / 5 enums survive; the diff is deletions-only and no surviving
  index, `@map`, `@@map`, or `onDelete` changed.
- `0_init` is byte-identical to a freshly generated from-empty diff for its first
  269 lines, is a self-consistent ordering (enums → tables → indexes → FKs →
  rules), and adds exactly the ten named rules, byte-faithful to migrations
  3/4/5, with completeness proven from the other direction (no surviving-table raw
  rule in the deleted history is missing).
- Zero `gen_random_uuid()` defaults, and the surviving code contains no raw INSERT
  that would need them.
- `prisma:validate` passes; the generated client matches the new schema.
- `database-model.md` is accurate against both `schema.prisma` and `0_init`
  (tables, enums, the 13-edge mermaid diagram, the ten rules), has zero
  removed-model residue in current docs, and promises no compat/upgrade/rollback.
- No snapshot / immutability / client-shape test was added; no `migrate` script or
  drift gate was introduced.

The one MINOR (schema formatting drift, ungated and cosmetic) does not block P20 and
needs only an explicit accept-or-format decision.
