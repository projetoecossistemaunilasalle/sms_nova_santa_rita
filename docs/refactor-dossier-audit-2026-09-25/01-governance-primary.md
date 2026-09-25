# Primary governance, provenance, and traceability audit

**Audit date:** 25 September 2026  
**Repository baseline:** `SMS_Portal` at `e5aaf1e2891dbb1804950223eb9f0765e7dbeb65`  
**Assigned scope:** the complete governance and implementation dossier, its inherited evidence corpus, `architecture-map.html`, and directly governing product/implementation documents.  
**Method:** read-only inspection and selective first-hand replay. The complete Markdown dossier, all 27 inherited reports, all six phase files, both dossier indexes, the architecture audit, current architecture, product/V1/implementation/schema documents, and the directly cited code/config/test surfaces were reviewed. No database was contacted and no source, schema, test, configuration, or dossier file was changed.

## Executive conclusion

The dossier contains unusually strong technical investigation, but it is **not governed by one reproducible authority chain**. The refactor cannot safely be handed to an implementer under the documents' own rules until the authority and open-decision conflicts below are adjudicated.

The most serious defect is semantic: the architecture audit's decision IDs `D1`–`D7` do **not** mean the same things as the dossier's `D1`–`D7`. The plan declares that audit to be the architectural source of truth, while the dossier reuses the same identifiers for different choices. This is not cosmetic; an implementer following the declared source of truth would make the wrong decision.

The second serious defect is that documents simultaneously say a decision is unresolved, recommend opposite answers, assume one branch, and describe another branch as impossible. D-1 is the clearest example. D-2, D-3, and D-7 have related status drift.

The dossier is also untracked. Git records the plan and audit at `e5aaf1e`, but not the dossier, its phase files, reports, or map. Therefore “at `e5aaf1e`” identifies the application baseline, not an immutable dossier revision. Current line references and “newer file wins” precedence cannot be independently reconstructed from Git.

## Authority map actually published

| Layer | Published authority | Audit result |
|---|---|---|
| Product boundaries | `docs/current-architecture.md:3-6` calls itself the current product-boundary source and delegates detailed V1 direction to `docs/v1-game-integration-dossier.md` | Valid product layer, but no rule says what happens when its requirements conflict with the architecture audit or tactical plan. |
| Architecture | `REFACTOR_PLAN.md:18-21` says `docs/architecture-audit-2026-09-23.md` is the architectural source of truth | The audit is based on `d4af23c` plus an uncommitted tree (`docs/architecture-audit-2026-09-23.md:3-6`), not on the current `e5aaf1e` tree. It also contains its own open-decision register at `:789-799`. |
| Tactical plan | `REFACTOR_PLAN.md:3-6,18-21` says v2.1 is approved and fixed-direction | Approval is asserted, but no approver, approval record, or change-control mechanism is identified. |
| Compatibility | `docs/refactor-dossier/README.md:39-45` and `phases/README.md:30-38` make `COMPAT-POLICY.md` §6 the owner ruling | “Owner” is never identified by person or accountable role. The ruling is dated but not attributable or independently confirmed. |
| Executable work | `docs/refactor-dossier/README.md:41-45` says phase files supersede the consolidated dossier where they disagree | The consolidated dossier still contains directly contradictory sequencing and decision answers, so the claimed correction is incomplete. |

## Finding register

| ID | Severity | Finding |
|---|---|---|
| G-01 | **Blocker** | `D1`–`D7` have conflicting meanings across the declared governing audit and the dossier. |
| G-02 | **Blocker** | D-1 (and parts of D-2/D-3/D-7) has no single decision owner, status, or answer; work orders assume mutually incompatible branches. |
| G-03 | **Major** | The hierarchy is circular: the plan is fixed, phase files supersede the dossier, and compatibility policy supersedes both without a signed change record. |
| G-04 | **Major** | Several fixed-plan requirements are missing, refused, or assigned to files that do not implement them. |
| G-05 | **Major** | The claim that no real database can be affected is stronger than repository evidence supports. |
| G-06 | **Major** | Confidence/provenance marks are defined incompatibly and applied inconsistently. |
| G-07 | **Major** | The dossier is untracked and therefore has no immutable revision, despite relying on line numbers and “newer wins” precedence. |
| G-08 | **Major** | The architecture map is executable but materially stale and its dossier provenance overstates its accuracy. |
| G-09 | **Major** | Late cross-phase corrections were not propagated; Phase 50 preserves superseded decision, ratchet, and handoff facts. |
| G-10 | **Minor** | Inventory and line-count metadata are stale, including three phase counts. |
| G-11 | **Minor** | The “siblings by section, never by line” rule is routinely violated, causing already-observable broken references. |

## Detailed findings

### G-01 — Blocker: decision identifiers collide across authorities

The architecture audit defines:

- D1 = keep GitHub Pages demo;
- D2 = delete or hide legacy routes;
- D3 = authorization model;
- D4 = integration database strategy;
- D5 = message catalogue;
- D6 = rate limiting;
- D7 = `AccessLink` disposition (`docs/architecture-audit-2026-09-23.md:789-799`).

The dossier instead defines:

- D-1 = seam mechanism;
- D-2 = demo deep-link criterion;
- D-3 = CSS modularization scope;
- D-4 = `/atividade` sunset;
- D-5 = `RATE_LIMITED`;
- D-6 = `AuditEvent`;
- D-7 = branch protection (`docs/refactor-dossier/REFACTOR-DOSSIER.md:72-84`).

The collision is already semantically harmful. For example, audit D4 requires a disposable Postgres plus Neon acceptance path (`:796,779`), while dossier D-4 says the legacy activity route must be deleted (`:81`). Audit D6 recommends implementing rate limiting (`:798`), while dossier D-6 drops the unused `AuditEvent` placeholder (`:83`). The plan says the audit governs architecture and that the plan reconciles it (`REFACTOR_PLAN.md:5,18-21`), but no namespace or translation table exists.

**Required correction:** preserve the audit's IDs and give dossier decisions a distinct namespace (for example `AD-1`…`AD-7`), or publish an explicit crosswalk stating which are superseded. Never let a bare `D4` be cited across layers.

### G-02 — Blocker: open decisions are simultaneously unresolved and assumed

D-1 has four incompatible published positions:

1. The consolidated dossier calls it a human decision and recommends **(b), then (c)** (`REFACTOR-DOSSIER.md:74-78`).
2. The phase index says the phase files deliberately do not resolve it but then **recommends (a)** (`phases/README.md:40-47`).
3. Phase 30 says **(a) is the only branch that can go fully green**, but still requires an owner answer and says (b) needs deviations in two files (`phases/30-composition-seam.md:486-495`).
4. Phase 50 still says the two branches are “mutually unsatisfiable” (`phases/50-gates-ci-demo-docs.md:139-145,620`), a conclusion Phase 30 explicitly says measurement dissolved (`:486-490`).

D-3 is also split:

- The dossier calls it an open human decision and recommends deferral (`REFACTOR-DOSSIER.md:74,80`).
- Phase 30 says it is “Phase 3's call, binding here” and admits the decision is unowned (`phases/30-composition-seam.md:509-513`).
- Phase 40 writes **D-3 = (b)** as a dependency (`phases/40-decomposition.md:6-10`) while also saying the answer controls the work (`:40-45`).
- The phase index explicitly says “one of them is wrong about who owns it” (`phases/README.md:47`).

D-7 is presented as a human decision in the dossier (`:74,84`) but Phase 00 already requires `D-7 = (a)` as an entry dependency (`phases/00-prerequisites.md:5`). D-2 remains called a human decision at `REFACTOR-DOSSIER.md:74,79`, while Phase 50 records the demo choices as product choices (`phases/50-gates-ci-demo-docs.md:139-143`). The index no longer lists D-2 as open, compounding the inconsistency.

No file names an accountable human owner. “Owner” is a role without an identity, and no decision record states who approved the adopted compatibility edits.

**Required correction:** a short decision ledger must give each open decision one namespace, one current status (`OPEN`, `ADOPTED`, `REJECTED`, `DEFAULTED`), one selected branch, one named accountable owner, date, rationale, and affected files. Work-order entry gates must reference that ledger rather than independently assuming answers.




### G-03 — Major: precedence is circular and not auditable

The plan calls itself approved and the architecture audit authoritative (`REFACTOR_PLAN.md:3-6,18-21`). The dossier says the plan's direction is fixed (`docs/refactor-dossier/README.md:37-40`). It then says phase files supersede the consolidated dossier (`:41-43`) and `COMPAT-POLICY.md` §6 governs both the dossier and phases (`phases/README.md:30-38`). The compatibility policy itself says its edits were “not applied yet” (`COMPAT-POLICY.md:61-65`) and later says the owner rejected/adopted them (`:93-103`) and that affected phase files “must be revised” (`:118-123`). The phase files do contain the chosen answers, so the policy's own status sentence is stale.

The consolidated dossier also has not been fully brought into the claimed hierarchy. Its reading order says Phase 1 (purge) and Phase 2 (seam) may run in parallel (`REFACTOR-DOSSIER.md:20-25`), while the current phase index says the graph is a fully serial critical path (`phases/README.md:18-22`). Its sequencing section likewise says they may run in parallel (`REFACTOR-DOSSIER.md:575-579`). The README says the dossier has been corrected to the phase position (`:42`), which is false for these statements.

**Required correction:** publish one explicit precedence order and a dated decision/change log. “Newer file wins” is not sufficient because all dossier files are untracked and several were edited concurrently.

### G-04 — Major: requirements coverage has unresolved holes

Representative plan requirements and their current disposition:

| Plan requirement | Dossier disposition | Traceability result |
|---|---|---|
| §2.1.3 clean legacy content from `portal/ajuda/page.tsx` (`REFACTOR_PLAN.md:29-32`) | Phase 10 explicitly assigns it to Phase 50 (`phases/10-purge-generation-a.md:98-104`) | **Missing owner implementation:** Phase 50 contains no `ajuda` work-order item. |
| §3.2 add `src/generated/**` to tsconfig exclusion (`REFACTOR_PLAN.md:134-138,225-227`) | Phase 00 assigns it to P2 (`phases/00-prerequisites.md:28`), but Phase 30 does not implement it; the dossier calls the mechanism ineffective | **Unclosed deviation:** no phase exit gate requires the requested edit, and no owner explicitly rejected it as a plan deviation. |
| §3.3 hash demo credential tokens (`REFACTOR_PLAN.md:140-143`) | Phase 40 refuses the named implementation and forwards it to R-13, “not this phase's call” (`phases/40-decomposition.md:434-440`); Phase 50 keeps a manual R-13 row (`phases/50-gates-ci-demo-docs.md:520-525`) | **Missing owner/decision:** no implementation, Web Crypto alternative, or recorded plan deviation owns this fixed-plan requirement. |
| §7.2/G8 size gate | Phase 40 creates a 3-exception `size-ratchet.mjs`; Phase 50 creates a second 13-entry `check-size-budget.mjs` (`phases/50-gates-ci-demo-docs.md:580-587`) | **Conflicting enforcement contracts:** the phase index still calls serial execution authoritative while two exit gates police the same plan criterion differently. |
| Frozen contract regression coverage | `test:contracts` is explicitly “unowned” (`phases/README.md:44-52`; `phases/00-prerequisites.md:367`; `phases/50-gates-ci-demo-docs.md:582`) | **Missing owner:** a class-B external contract has no CI owner. |
| `cred` log redaction | Four documents defer it; Phase 50 says “Owner, not any phase” (`phases/50-gates-ci-demo-docs.md:588-591`) | **Unowned correctness/security item.** |
| Staging database / migration proof | Explicitly no phase owner (`phases/50-gates-ci-demo-docs.md:130-135`; `phases/README.md:49`) | Acceptable only as an explicit post-refactor release limitation, not as evidence that the server target works. |

The dossier is strongest where it records a refusal. It is weakest where it says “out of scope” and names neither a phase nor a responsible human.

### G-05 — Major: the “no database exists” safety premise is too strong

Phase 20 says six tracked migrations and no database ever created from them make a hand-authored drop safe “in this repository at all,” and that there is therefore no database that can be broken (`phases/20-schema-and-migration.md:18-21`). The evidence directly available here is narrower:

- `.env` and `.env.example` contain placeholders;
- the handoff says no migration was applied to a real database (`docs/implementation/slice-03-05-portal-handoff.md:33-37`);
- no database was contacted during this audit.

That proves **no known connection was used in this workspace**, not that no developer, CI run, branch, or external environment ever contains `_prisma_migrations`. The phase partially recognizes this by requiring a stop if the table exists (`:21`), but the stronger causal claim remains unsupported. The migration is irreversible against any existing database that receives it.

**Required correction:** state the evidence boundary exactly and make deployment environment enumeration/approval an explicit human prerequisite.


### G-06 — Major: confidence semantics are inconsistent

The dossier defines `[V]` as “verified twice” or reproduced by the main agent (`REFACTOR-DOSSIER.md:12-18`). The top-level README defines `[V]` as “independently verified” (`README.md:41`). The phase index defines `[V]` as independently verified at `e5aaf1e`, `[S]` as single source, and `[U]` as unresolved **or measured by one agent** (`phases/README.md:54-56`). Those are materially different provenance thresholds.

The corpus also introduces `[me]` in Phase 20's evidence section (`:255-284`) and Phase 50 (`:624-626`) without defining it in the shared legend. The index warns that “a number without a state label is a bug” (`phases/README.md:56`), yet Phase 20 contains no `[V]/[S]/[U]` marks and instead relies on `[me]`; Phase 30 has no `[V]` marks at all despite dozens of measured claims; many report verdict vocabularies (`PASS`, `FAIL`, `VACUOUS-GATE`, `MISSING`) are local and not mapped to the shared confidence scale.

A report index is useful, but provenance is not consistently compositional: “main agent reproduced it” is not equivalent to independent verification, and `[me]` does not say whether a claim was executed, merely read, copied from another report, or rerun.

**Required correction:** use one controlled vocabulary with separate fields for **evidence source**, **execution status**, **replication**, and **decision status**. Do not overload `[V]`.

### G-07 — Major: the dossier has no immutable revision

First-hand Git replay:

```text
HEAD=e5aaf1e2891dbb1804950223eb9f0765e7dbeb65
git status --short
?? docs/refactor-dossier-audit-2026-09-25/
?? docs/refactor-dossier/
git ls-files docs/refactor-dossier docs/refactor-dossier-audit-2026-09-25
<no output>
```

The application baseline is identifiable, but none of the dossier, phase files, reports, policy, or map is versioned. Claims such as “clean tree at `e5aaf1e`” are true only as historical assertions about a mutable untracked corpus; they cannot be reproduced by checking out that commit. The report index lists current line counts (`REFACTOR-DOSSIER.md:657-670`), and the phase files explicitly rely on line-based cross-references, but there is no dossier commit/hash to which those line counts belong.

This also weakens the README's read-only claim (`docs/refactor-dossier/README.md:55`): it describes the authors' intended discipline, not an immutable property of the current untracked tree.

**Required correction:** commit the dossier as a reviewable evidence package, record its commit/hash in the index, and make phase/report line citations relative to that hash. Application-source claims should separately record the application commit.


### G-08 — Major: the architecture map is executable but materially stale

First-hand replay confirmed the map's JavaScript parses (`node --check` exit 0), it contains 40 unique module IDs, 54 edge declarations, 11 violation records, no missing edge endpoint, and no duplicate module ID. Its click handlers are present. This supports the README's claim that it opens directly and is interactive.

Its content is not synchronized with the dossier:

- `mig6` still says **8 statements / 4 constraints / 3 tables** (`architecture-map.html:308-311`), while the adopted result is **10 / 5 / 4** (`phases/README.md:32-36`; `REFACTOR-DOSSIER.md:267-303`).
- The `ci` role still includes `migrate diff --exit-code` (`:317-320`), a gate the owner explicitly deleted with no substitute (`COMPAT-POLICY.md:97-100`; `phases/README.md:34-36`).
- Error 8 says no test can import the runtime seam (`:419-421`), while Phase 30's first-hand correction is that six test files already import concrete runtime modules, nine statements total, all bypassing the seam (`phases/30-composition-seam.md:376-398`). The generated seam is a new import target, but the broad statement is false.
- The cheaper D-1=(b) overlay claims “same guarantees” (`:670-675`), while Phase 30 says (b) permanently forgoes the plan's zero-alias criterion and needs deviations (`:486-495`).
- `AuditEvent` is drawn as a post-purge table (`:303-311,428-430`), but the adopted ruling deletes it (`REFACTOR-DOSSIER.md:81-83`; `phases/20-schema-and-migration.md:83-92`).
- The schema target says `310 → 251` (`:303-307`), whereas the chosen Phase 20 recipe is 227 lines (`phases/20-schema-and-migration.md:75-79,191-196`).
- The legend hardcodes marker `7` (`:904-905`) although violations are numbered 1–11; this is merely an example swatch, not a count, so it is not itself false, but it makes drift easier to miss.

The dossier itself says the map “lags … in two places” but is otherwise accurate (`REFACTOR-DOSSIER.md:674`). The replay found materially more than two stale areas. That provenance statement is therefore false.

**Required correction:** either regenerate the map from a versioned corpus model or label it explicitly as a historical pre-owner-ruling view. Add an automated consistency check for the 10/5/4 migration tuple, absence of the drift gate, D-1 guarantees, schema target, and deleted `AuditEvent`.


### G-09 — Major: late corrections were not propagated

Representative stale statements survive after their own successors corrected them:

- Phase 50 says the `104 → 26` CI census edit is “not booked as any phase's step yet” (`:161-162`), but Phase 10 now has numbered step 10 for exactly that edit (`phases/10-purge-generation-a.md:214-224`).
- Phase 50 says Phase 30's branches are mutually unsatisfiable (`:620`), contradicted by Phase 30's current resolution (`:486-495`) and the phase index (`:46`).
- Phase 50 says Phase 40's size ratchet has four exceptions (`:583-587`), while Phase 40 now says exactly three (`phases/40-decomposition.md:291-325`).
- Phase 50 still points to `phases/00-prerequisites.md:150` as a stale handoff (`:569-571`), but that target line is blank in the current 424-line file; the actual corrected handoff is in the later evidence section (`phases/00-prerequisites.md:397-413`).
- Phase 10 still contains legacy exact-line references to Phase 00 despite the index's “section, never line” rule (`phases/10-purge-generation-a.md:216-224`).

These are not only navigation defects. They preserve old owners and gate counts in the phase an implementer uses to police the others.

**Required correction:** perform a semantic crosswalk from the seven `RV-*` findings to every current phrase, not merely a grep for superseded numbers. Exact-line references to mutable sibling phases should be removed.

### G-10 — Minor: inventory and line-count metadata are stale

First-hand physical line counts:

| File | Published in phase index | Actual |
|---|---:|---:|
| `phases/00-prerequisites.md` | 424 | 424 |
| `phases/10-purge-generation-a.md` | 326 | **325** |
| `phases/20-schema-and-migration.md` | 302 | 302 |
| `phases/30-composition-seam.md` | 804 | **781** |
| `phases/40-decomposition.md` | 654 | **610** |
| `phases/50-gates-ci-demo-docs.md` | 632 | 632 |

The wrong values are published at `phases/README.md:9-16`. The 1,470-line total for the seven `RV-*` reports is correct. The top-level report inventory is internally interpretable—6 `INV-*` + 6 `VER-*` + 3 `ADJ-*` + 3 `ADV-*` + 1 `AUDIT-*` + 1 `NOTE-*` + 7 `RV-*` = 27—but the wording “16 investigation/verification reports, 4 main-agent notes” (`README.md:18-19`) does not transparently match those prefixes. The report index's per-report counts are accurate for the files it names (`REFACTOR-DOSSIER.md:661-670`).

`COMPAT-POLICY.md:3` also calls the dossier 661 lines; it is now 677. This is harmless in isolation, but demonstrates why mutable-line metadata needs an owning revision.

### G-11 — Minor: the “section, never line” rule is not followed

The README and phase index say phase files cite siblings by section, never by line (`docs/refactor-dossier/README.md:29`; `phases/README.md:78`). Current phase files nevertheless contain multiple exact-line sibling references. Replaying the cited targets found:

- `phases/00-prerequisites.md:376` → `phases/10-purge-generation-a.md:213` is blank; step 10 begins at `:214`.
- `phases/50-gates-ci-demo-docs.md:161` → Phase 00 `:101-144`; the actual CI proposal begins at Phase 00 `:108`, with YAML at `:130`.
- Phase 50 `:605` repeats the same stale author range.
- Phase 50 `:570` points to Phase 00 `:150`, now blank.
The problem is not merely one broken line: the rule exists because sibling files were concurrently edited, and current evidence shows the expected consequence.




## Representative evidence replay

The following claims were re-derived in this audit rather than promoted from an inherited report:

| Claim | First-hand result |
|---|---|
| Application baseline | `git rev-parse --short HEAD` → `e5aaf1e`; latest commit subject is the architecture-audit/plan commit. |
| Formatter baseline | `npx prettier --check .` → exit 1, exactly `[warn] REFACTOR_PLAN.md`. Confirms the plan remains unformattable under the current `.prettierignore`. |
| CI starting point | `git ls-files .github/workflows` → `.github/workflows/deploy.yml` only; `ci.yml` does not exist. |
| Migration tracking | `git ls-files prisma/migrations` → seven tracked paths: six `migration.sql` files plus `migration_lock.toml`. |
| Static-export starting artifact | 104 HTML files under `out/`; no directory named `api`. This is a local untracked artifact, not a Git revision. |
| Map integrity | Script parses; 40 unique modules, 54 edges, 11 violations, zero unresolved edge endpoints, zero duplicate IDs. |
| Map/report count | Seven `RV-*` reports total exactly 1,470 lines. |
| Phantom CSS class | `.mobileNavItem` has zero first-party CSS definitions; 45 current HTML documents contain an `undefined` class token. `entryProblem` likewise has no standalone CSS rule, while `entryProblemIcon` does. |
| Purge blocker still present | `src/components/portal/status-badge.tsx:1` still imports `ActivityStatus` from `portal-view-service.ts`; the planned source tree has not been implemented. |
| Current schema shape | `prisma/schema.prisma` currently has 16 models and 6 enums. The map's 310-line before-state is correct, but its selected 251-line after-state is not the adopted 227-line recipe. |
| Dossier versioning | `git ls-files docs/refactor-dossier` returns no files; Git status shows the entire corpus untracked. |
| Source integrity during audit | No tracked source/config/schema/test/dossier file was edited. The only new audit artifact is this assigned report. |
Important inherited claims that remain well supported but were **not** promoted to fresh verification in this primary pass:

- the 46-path / 7,802-line purge closure;
- the 10-statement Prisma drop script and 269-line regenerated-init comparison;
- builds producing 26 post-purge documents and the 27/182 test baseline;
- Next.js E625 reachability mechanics;
- GitHub Pages live URL/traffic and the sibling `Heroes_Trial` contract check;
- branch-protection state and a real PR/CI run.

Those claims have detailed provenance in the inherited reports, but the audit README expressly forbids promoting them without replay (`docs/refactor-dossier-audit-2026-09-25/README.md:7-12`).

## Confirmed important claims

The following inherited conclusions are confirmed by direct reading and, where marked, simple replay:

1. **The technical direction is not the main problem.** The dossier consistently identifies the Generation-A purge, server/demo composition split, and current CSS print hazard from multiple independent angles.
2. **The plan's literal authority is internally stale.** It is “approved” while the architectural source it names is based on an older commit/uncommitted state and contains open decisions (`REFACTOR_PLAN.md:3-6`; `docs/architecture-audit-2026-09-23.md:3-6,789-799`).
3. **The owner ruling is real as a document assertion but has no attributable owner.** `COMPAT-POLICY.md:93-103` says an owner ruled; no owner identity or approval artifact is present.
4. **The compatibility ruling's direction is repeated consistently in the phase files:** sequential history remains, the shadow-DB drift gate is deleted without replacement, and the drop tuple is 10/5/4 (`phases/README.md:30-38`). The stale map and a few phase handoffs are exceptions.
5. **No schema-drift gate survives.** This is consistently and intentionally recorded (`COMPAT-POLICY.md:97-100`; `phases/50-gates-ci-demo-docs.md:117-135`). The server target therefore cannot be described as migration-proven after the refactor.
6. **The `test:contracts` CI leg is unowned.** Phase 00, the phase index, and Phase 50 all explicitly say so; the fixed-plan work does not repair it.
7. **The current `out/` tree confirms both useful and stale claims:** it is action-free and has no `api/` directory, but it is untracked and was not freshly rebuilt in this audit. Counts must not be cited as properties of commit `e5aaf1e`.
8. **The architecture map is a real, self-contained interactive artifact, not a broken mockup.** Its problem is semantic staleness and unversioned provenance, not JavaScript failure.

## False premises and unsupported certainty

| Published premise | Audit result |
|---|---|
| “The dossier decisions and architecture-audit decisions share `D1`–`D7`.” | False; the meanings collide. |
| “The phase file and dossier disagree only where the dossier has been corrected.” | False; the consolidated dossier still recommends parallel purge/seam execution against a serial index. |
| “The map lags in two places and is otherwise accurate.” | False; multiple schema, CI, seam, D-1, and `AuditEvent` claims are stale. |
| “No test can import the runtime seam.” | Overbroad/false; tests already import concrete `src/runtime` modules, though they bypass the proposed seam target. |
| “No database can be broken because none was created.” | Unsupported beyond this workspace's known placeholder environment. |
| “A number without `[V]/[S]/[U]` is a bug.” | Not enforced; Phase 20 uses undefined `[me]`, Phase 30 has no `[V]`, and many prose numbers remain unlabeled. |
| “Sibling phases are cited by section, never line.” | False in the current files. |
| “The report inventory is 16 investigations + 4 main notes + 7 refutations.” | Total is 27, but the category labels do not transparently correspond to the actual 6+6+3+3+1+1+7 prefix census. |


## Explicit coverage limits

- No database was contacted; no migration, `migrate deploy`, `migrate reset`, or Prisma generate was run.
- No full `next build`, Vitest suite, GitHub Actions run, branch-protection API call, or real PR was executed. Existing `.next/` and `out/` artifacts were inspected but not assumed fresh.
- The live GitHub Pages URL, traffic/audience, and external `Heroes_Trial` repository were not checked.
- The architecture map's JavaScript and internal data graph were replayed, but browser geometry, label clipping, visual overlap, and hover usability were not independently browser-audited.
- Scratch trees and temporary artifacts created by inherited agents were not assumed to still exist; their conclusions were accepted only where direct source reading or simple replay corroborated them.
- GitHub issue/PR history and any off-repository decision record were unavailable. Therefore “no owner” means no accountable owner is identified in the reviewed repository corpus, not proof that no human conversation occurred elsewhere.

## Required governance disposition

Before implementation begins, the dossier should not be declared execution-ready. The minimum remediation is:

1. create one versioned decision ledger with non-colliding IDs, named owner, selected branch, status, date, and affected documents;
2. publish a single precedence/change-control rule and reconcile the consolidated dossier to the phase index;
3. assign or explicitly reject every fixed-plan requirement currently marked unowned/deviation;
4. narrow the database safety claim and retain R1 as a release blocker;
5. normalize provenance/confidence fields;
6. version the dossier and regenerate or explicitly supersede the map;
7. run a final semantic propagation audit of all `RV-*` findings.

Until items 1–3 are complete, the safe conclusion is: **technically well investigated, but not authoritatively executable as a single programme.**

