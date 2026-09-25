# Independent adversarial governance verification

**Date:** 25 September 2026  
**Repository:** `SMS_Portal`, `main` at `e5aaf1e2891dbb1804950223eb9f0765e7dbeb65`  
**Primary:** `docs/refactor-dossier-audit-2026-09-25/01-governance-primary.md`  
**Scope:** complete dossier, architecture audit, plan, current/product/implementation/schema documents, architecture map, and Git state.

## Executive verdict

The primary's central conclusion is **UPHELD**: the dossier is technically strong but is not reproducibly executable as one governed programme. The authority chain is not total, versioned, or attributable. Ten primary findings are upheld; G-03 is downgraded in characterization.

The decision IDs are not literally identical: the audit uses `D1`–`D7` (`docs/architecture-audit-2026-09-23.md:789-799`), while the dossier uses `D-1`–`D-7` (`docs/refactor-dossier/REFACTOR-DOSSIER.md:72-84`). This is an undeclared semantic namespace collision. The audit's dirty-tree hash is missing; `e5aaf1e` is documentation-only over application-bearing parent `c149374`, so the source snapshot is likely current but not hash-addressable.

Map replay corrects the primary's count: 36 unique module IDs, 57 edge declarations, 56 unique directed endpoint pairs, and 11 violations. `node --check` succeeds; the map is self-contained and interactive but semantically stale. Existing `out/` has 104 HTML files and no `out/api/`, but is ignored/untracked and was not rebuilt.

## Method and limits

I read the primary, plan, complete architecture audit, all 39 dossier files (27 reports, six work orders, indexes, policy/dossier/critique, and map), current/product/V1/implementation/schema documents, relevant source/configuration, and Git state/history. Safe checks were read-only Git/census/searches, placeholder detection without printing values, map-array extraction, and temporary `node --check`. No database, Prisma command, build, test suite, CI/API call, branch-protection change, install, or source/config/test/dossier edit was performed. “No owner” and “no sign-off” mean none is identified in the reviewed corpus, not proof that no private conversation occurred.

## Verdicts

| ID | Primary severity | Verdict | Basis |
|---|---|---|---|
| G-01 | Blocker | **UPHELD** | Conflicting audit/dossier decision meanings under declared authority (`REFACTOR_PLAN.md:18-20`). |
| G-02 | Blocker | **UPHELD** | D-1/D-2/D-3/D-7 are open, recommended, assumed, closed, and contradicted. |
| G-03 | Major | **DOWNGRADED** | Partial, non-monotonic, unattributed precedence; not literally circular. |
| G-04 | Major | **UPHELD** | Fixed-plan, security, and correctness items lack work items/owners. |
| G-05 | Major | **UPHELD** | Local placeholders do not prove global database absence or migration safety. |
| G-06 | Major | **UPHELD** | `[V]/[S]/[U]` definitions conflict; `[me]` is not in the shared legend. |
| G-07 | Major | **UPHELD** | All 39 dossier files are untracked with no path history. |
| G-08 | Major | **UPHELD WITH COUNT CORRECTION** | Map is executable but stale; 36/57/56, not 40/54. |
| G-09 | Major | **UPHELD** | Late corrections remain in current phase prose and gates. |
| G-10 | Minor | **UPHELD** | Three phase counts and one dossier count are stale. |
| G-11 | Minor | **UPHELD** | Sibling-line rule is violated and cited lines are blank/wrong. |

## Detailed evidence

### G-01 — Decision-namespace collision — **UPHELD (Blocker)**

`REFACTOR_PLAN.md:18-20` makes the architecture audit authoritative. Its open-decision table defines `D1`–`D7` as demo shipment, routes, authorization, integration database, catalogue, rate limiting, and `AccessLink` disposition (`docs/architecture-audit-2026-09-23.md:789-799`). The dossier instead defines `D-1`–`D-7` as seam mechanism, demo deep links, CSS scope, `/atividade` sunset, error vocabulary, `AuditEvent`, and branch protection (`docs/refactor-dossier/REFACTOR-DOSSIER.md:72-84`).

Examples are materially opposite: audit `D4` selects disposable Postgres plus Neon acceptance (`docs/architecture-audit-2026-09-23.md:796`) while dossier `D-4` is the legacy activity route (`docs/refactor-dossier/REFACTOR-DOSSIER.md:81`); audit `D6` recommends rate limiting (`:798`) while dossier `D-6` deletes `AuditEvent` (`:83`); audit `D7` disposes of `AccessLink` (`:799`) while dossier `D-7` decides branch protection (`:84`).

**Correction:** preserve audit IDs and rename dossier decisions, or publish a versioned crosswalk stating which audit decisions are superseded. Never use bare `D4` across layers.

### G-02 — Decision status/recommendation drift — **UPHELD (Blocker)**

The consolidated dossier calls D-1/D-2/D-3/D-7 human decisions and recommends branches (`docs/refactor-dossier/REFACTOR-DOSSIER.md:72-84`). The phase index recommends D-1 `(a)` (`docs/refactor-dossier/phases/README.md:40-47`); Phase 30 says `(a)` is the only fully green branch but still requires an owner answer (`docs/refactor-dossier/phases/30-composition-seam.md:486-495`); Phase 50 still says no branch satisfies both (`:620`). Phase 40 assumes D-3 `(b)` (`docs/refactor-dossier/phases/40-decomposition.md:6-10`) while Phase 30 calls D-3 unowned (`docs/refactor-dossier/phases/30-composition-seam.md:509-513`). Phase 00 assumes D-7 `(a)` (`docs/refactor-dossier/phases/00-prerequisites.md:5`). The “owner ruling” has a date and outcomes but no named person or accountable role (`docs/refactor-dossier/COMPAT-POLICY.md:93-103`).

**Correction:** one versioned decision ledger must provide non-colliding IDs, current status, selected branch, accountable owner, date, rationale, and affected files; entry gates must reference it.

### G-03 — Authority chain — **DOWNGRADED (underlying Major defect upheld)**

The primary's “circular” characterization is too strong. Partial rules exist: plan/audit authority (`REFACTOR_PLAN.md:3-6,18-21`), plan as fixed input (`docs/refactor-dossier/README.md:37-43`), phase-over-dossier precedence (`README.md:41-43`), and compatibility §6 governance (`docs/refactor-dossier/phases/README.md:30-38`). But the chain is incomplete and non-monotonic: the consolidated dossier still permits purge/seam parallelism (`docs/refactor-dossier/REFACTOR-DOSSIER.md:20-25,573-579`) against the serial index (`phases/README.md:18-22`); policy status shifts from “not applied” to owner ruling/revision (`docs/refactor-dossier/COMPAT-POLICY.md:61-65,93-123`); and no rule says who may approve a deviation or reopen a decision.

**Verdict:** downgrade the literal cycle claim; uphold the underlying non-auditable authority defect. Publish one precedence/change-control rule and a dated decision log.

### G-04 — Requirements coverage holes — **UPHELD (Major)**

- Plan help-page cleanup (`REFACTOR_PLAN.md:29-32`) is assigned by Phase 10 to Phase 50 (`docs/refactor-dossier/phases/10-purge-generation-a.md:98-104`), but Phase 50 has no `ajuda` item or gate.
- Plan `src/generated/**` exclusion (`REFACTOR_PLAN.md:134-138,225-227`) is assigned to P2 (`docs/refactor-dossier/phases/00-prerequisites.md:24-30`), but Phase 30 does not implement it and no deviation is recorded.
- Plan demo credential hashing (`REFACTOR_PLAN.md:140-143`) is refused/forwarded in Phase 40 (`phases/40-decomposition.md:434-440`) and remains a manual R-13 row in Phase 50 (`phases/50-gates-ci-demo-docs.md:520-525`).
- Phase 40 defines a three-exception `size-ratchet.mjs` (`phases/40-decomposition.md:291-325`), while Phase 50 defines a second baseline gate (`phases/50-gates-ci-demo-docs.md:228-235,375`) and still says four exceptions (`:580-587`).
- `test:contracts` is explicitly unowned (`phases/README.md:44-52`; `phases/00-prerequisites.md:365-367`; `phases/50-gates-ci-demo-docs.md:580-582`); `cred` redaction is assigned to “Owner, not any phase” (`phases/50-gates-ci-demo-docs.md:588-591`); staging DB proof has no phase owner (`:130-135`).

**Verdict:** upheld. Assign or explicitly reject each fixed-plan item and every security/correctness control.

### G-05 — Database safety premise — **UPHELD (Major)**

Phase 20 turns six tracked migrations and “no database ever created” into “no database that can be broken” (`docs/refactor-dossier/phases/20-schema-and-migration.md:16-21`). The reviewed `.env` and `.env.example` contain `ep-example` placeholders and `.env` is untracked, but that proves only this workspace. It cannot enumerate developer machines, CI, Neon branches, or deployed environments. The phase itself acknowledges irreversible drops once a database exists (`:211,241`; `reports/ADJ-01-prisma-purge-and-commands.md:57-68`), and the handoff requires a real staging Neon connection (`docs/implementation/slice-03-05-portal-handoff.md:33-37`).

**Verdict:** upheld. Replace the global claim with the evidence boundary and require target enumeration/approval before a destructive migration.

### G-06 — Confidence/provenance — **UPHELD (Major)**

The meanings conflict: the consolidated dossier defines `[V]` as twice verified or main-agent reproduced (`docs/refactor-dossier/REFACTOR-DOSSIER.md:12-18`); the README says independently verified (`docs/refactor-dossier/README.md:39-43`); the phase index says independently verified at `e5aaf1e`, and defines `[U]` as unresolved **or measured once** (`docs/refactor-dossier/phases/README.md:54-56`). Phase 20 locally defines `[me]` (`phases/20-schema-and-migration.md:255-284`) and Phase 50 uses it (`phases/50-gates-ci-demo-docs.md:624-626`), but the shared legend does not. Phase 20 has no `[V]/[S]/[U]`; Phase 30 has no `[V]`. Local report verdicts (`PASS`, `FAIL`, `VACUOUS-GATE`, `MISSING`, `UNREPRODUCIBLE`) have no crosswalk.

**Verdict:** upheld. Separate source, execution, replication, decision state, and local verdict in one controlled vocabulary.

### G-07 — No immutable dossier revision — **UPHELD (Major)**

```text
HEAD=e5aaf1e2891dbb1804950223eb9f0765e7dbeb65
git ls-files docs/refactor-dossier docs/refactor-dossier-audit-2026-09-25
<no output>
git log --all -- docs/refactor-dossier
<no output>
git status --short
?? docs/refactor-dossier-audit-2026-09-25/
?? docs/refactor-dossier/
```

All 39 current dossier artifacts have no Git object or path history. The application baseline is identifiable, but the dossier is not. This does not refute historical read-only discipline; it makes that discipline unreconstructable. Commit the package and record its hash separately from the application commit.

### G-08 — Map executable but stale — **UPHELD WITH COUNT CORRECTION (Major)**

The map is not broken: `node --check` succeeds; one script/style block is balanced; no external dependency exists; 36 module IDs, 57 edge declarations, and 11 violations resolve. The primary's 40/54 count is refuted by replay; the correct directed-pair count is 56.

Semantic staleness remains: the map says 8 statements / 4 constraints / 3 tables (`docs/refactor-dossier/architecture-map.html:303-311`) while the adopted recipe is 10 / 5 / 4 (`phases/20-schema-and-migration.md:191-198`; `phases/README.md:32-36`); its CI still includes the deleted `migrate diff --exit-code` (`architecture-map.html:317-320`; `COMPAT-POLICY.md:93-100`); it says no test can import the seam (`architecture-map.html:419-421`) while Phase 30 records six concrete runtime imports (`phases/30-composition-seam.md:3-6,376-398`); it calls D-1=(b) “same guarantees” (`architecture-map.html:670-675`) while Phase 30 says it misses zero aliases (`phases/30-composition-seam.md:486-495`); and it says 251 schema lines (`architecture-map.html:303-307`) while the adopted recipe is 227 (`phases/20-schema-and-migration.md:191-198`).

The “two places, otherwise accurate” provenance claim is false (`docs/refactor-dossier/REFACTOR-DOSSIER.md:674`). Regenerate/version the map or label it historical and automate semantic checks.

### G-09 — Late corrections not propagated — **UPHELD (Major)**

Current phase prose preserves superseded executable context: Phase 50 says the `104 → 26` edit is unbooked (`docs/refactor-dossier/phases/50-gates-ci-demo-docs.md:161-169`) while Phase 10 step 10 owns it (`phases/10-purge-generation-a.md:214-224`); Phase 50 says D-1 has no satisfiable branch (`:620`) while Phase 30 says measurement dissolved that (`phases/30-composition-seam.md:486-495`); Phase 50 says four ratchet exceptions (`:580-587`) while Phase 40 says three (`phases/40-decomposition.md:316-325`); Phase 50 points to blank Phase 00 line 150 (`:568-571`) while the corrected statement is `phases/00-prerequisites.md:365`; and Phase 10 still uses sibling line citations (`:220-224`). A semantic crosswalk must cover all seven `RV-*` reports, not just old numbers.

### G-10 — Inventory/line metadata — **UPHELD (Minor)**

| File | Published | Actual |
|---|---:|---:|
| `phases/00-prerequisites.md` | 424 | 424 |
| `phases/10-purge-generation-a.md` | 326 | **325** |
| `phases/20-schema-and-migration.md` | 302 | 302 |
| `phases/30-composition-seam.md` | 804 | **781** |
| `phases/40-decomposition.md` | 654 | **610** |
| `phases/50-gates-ci-demo-docs.md` | 632 | 632 |

Wrong phase values are at `docs/refactor-dossier/phases/README.md:9-16`. `COMPAT-POLICY.md:3` calls the dossier 661 lines; it is 677. The seven `RV-*` reports total 1,470 lines, so that figure is upheld. The top-level “16 investigation/verification, 4 notes, 7 refutations” (`docs/refactor-dossier/README.md:18-19`) is interpretable but not mechanically identical to the 6 `INV` + 6 `VER` + 3 `ADJ` + 3 `ADV` + 1 `AUDIT` + 1 `NOTE` + 7 `RV` prefixes.

### G-11 — Sibling-line rule violation — **UPHELD (Minor)**

The rule is explicit (`docs/refactor-dossier/README.md:29`; `phases/README.md:76-78`) but current files use exact sibling lines. `phases/00-prerequisites.md:376` points to blank `phases/10-purge-generation-a.md:213` (step 10 starts at 214); `phases/50-gates-ci-demo-docs.md:570` points to blank `phases/00-prerequisites.md:150` (corrected text is `:365`); Phase 50's CI author range (`:161`) begins at 101 although the proposal starts at Phase 00 `:108`; Phase 10 uses exact lines (`:220-224`). The defect is systemic: mutable line references defeat the dossier's concurrency model. Replace them with headings plus a versioned dossier commit.

## Additional governance defects

### VG-01 — Required audit sign-off is locally unproven — **NEW (Major)**

The audit says “section 8 needs sign-off before code changes” (`docs/architecture-audit-2026-09-23.md:3-6`). The plan says it “fully reconciles” that audit (`REFACTOR_PLAN.md:3-5`), but no reviewed file records an approver, date, selected audit decisions, waiver, or section-8 acceptance. The plan's assertion is not an auditable sign-off. This is locally unproven, not proof that no off-repository sign-off occurred.

### VG-02 — Phase identifiers are not a stable namespace — **NEW (Minor/Major)**

The index names files/phases 00/10/20/30/40/50 (`docs/refactor-dossier/phases/README.md:7-16`); work orders use P1/P1b/P2/P3/P4 and Phase 0/1/1b/2/3/4 (`phases/00-prerequisites.md:5-7`; `phases/50-gates-ci-demo-docs.md:15-39`); the plan uses Phases 0–4 (`REFACTOR_PLAN.md:18-20,206-240`). Phase 50 itself calls the one-character Phase 1/1b gap a vocabulary hazard (`phases/50-gates-ci-demo-docs.md:15-20`). This raises cross-file misrouting risk and should be normalized in the decision ledger.

### VG-03 — Approval/change control is asserted, not recorded — **NEW (Major)**

`REFACTOR_PLAN.md:3-5` says “Approved for execution,” but names no approver, approval record, decision IDs, exception authority, change history, or reapproval rule. The architecture audit still has open decisions (`docs/architecture-audit-2026-09-23.md:789-799`). “Approved” therefore does not identify what was approved or who may change it. This extends, rather than duplicates, G-02/G-03: a status label without an approval artifact is not auditable governance.

## Required disposition

1. Create a versioned decision ledger with non-colliding IDs, accountable owner, selected branch, status, date, rationale, and affected documents.
2. Publish a total precedence and change-control rule covering product requirements, audit decisions, plan deviations, compatibility rulings, and phase work orders.
3. Record the architecture audit's section-8 sign-off (or explicitly waive/replace it) and identify who approved `REFACTOR_PLAN.md` v2.1.
4. Assign or explicitly reject every fixed-plan/security item currently marked unowned, including `ajuda`, generated-output exclusion, browser credential handling, `test:contracts`, `cred` redaction, schema-drift proof, and staging migration acceptance.
5. Narrow the database safety claim and keep R1 as a release blocker; require controlled target enumeration and approval before destructive migration.
6. Normalize confidence labels, local verdicts, and phase identifiers.
7. Commit/version the dossier and map, reconcile the consolidated/current product/schema documents, and replay semantic propagation across every `RV-*` report.
8. Remove mutable sibling line references in favor of headings tied to the dossier commit.

Until at least items 1–4 are adjudicated, the safe conclusion remains: **technically well investigated, not reproducibly or unambiguously executable as a single programme.**

## Verification limits

- No database was contacted; no migration, deploy, reset, or Prisma generate was run.
- No full build, Vitest suite, GitHub Actions run, branch-protection API call, or real PR was executed. Existing `.next/` and `out/` artifacts were inspected but not treated as fresh.
- The live GitHub Pages URL, traffic/audience, and external `Heroes_Trial` repository were not checked.
- Browser geometry, label clipping, visual overlap, and hover usability were not independently browser-audited; JavaScript syntax, tag balance, and data-graph integrity were checked.
- GitHub issue/PR history and off-repository decision records were unavailable. “No owner/sign-off” means none is identified in the reviewed corpus, not proof that no human conversation occurred elsewhere.

**Final disposition:** primary central conclusion **UPHELD**; G-01, G-02, G-04, G-05, G-06, G-07, G-08, G-09, G-10, and G-11 **UPHELD**; G-03 **DOWNGRADED**; map count/JavaScript-failure subclaims **REFUTED/CORRECTED**; new VG-01/VG-02/VG-03 defects added.
