# Phase index

The six files in this folder are the implementable work orders. [`../REFACTOR-DOSSIER.md`](../REFACTOR-DOSSIER.md) is the reasoning behind them; this file is the map that connects them, because **each phase file is written to be read alone** and nothing inside a single one of them states what the whole programme costs or where the decisions are still open.

**Read this file first, then your phase file, then only the dossier sections your phase file cites.**

## The six phases

| # | File | Lines | Owns | Depends on | Blocks |
| :--- | :--- | ---: | :--- | :--- | :--- |
| 00 | [`00-prerequisites.md`](00-prerequisites.md) | 424 | `format:check` fix, the order-dependent test, `.next/types` validator statefulness, **creating `ci.yml`**, branch protection | nothing | all five |
| 10 | [`10-purge-generation-a.md`](10-purge-generation-a.md) | 326 | Generation A deletion (46 paths / 7,802 lines), the `StatusBadge` build blocker, the `proxy.ts:113` credential fix, `ci.yml`'s `104 → 26` | 00 | 20, 30 |
| 20 | [`20-schema-and-migration.md`](20-schema-and-migration.md) | 302 | `schema.prisma` cuts, hand-authored `6_drop_generation_a`, `RATE_LIMITED`, `AuditEvent` | 10 | 30, 50 |
| 30 | [`30-composition-seam.md`](30-composition-seam.md) | 804 | the `src/runtime/` seam, `@runtime/*` aliases, generated `target.ts`, the ESLint fence | 00, 10, 20 | 40, 50 |
| 40 | [`40-decomposition.md`](40-decomposition.md) | 654 | god-file splits, dead-CSS purge, size-ratchet, selector-integrity oracle | 00, 30 | 50 |
| 50 | [`50-gates-ci-demo-docs.md`](50-gates-ci-demo-docs.md) | 632 | `ci.yml` edits, the gate inventory, the demo runtime, documentation truth, the regression register | 00, 20, 30, 40 | release confidence |

## Ordering

The graph is **acyclic** and the critical path is **fully serial**: `00 → 10 → 20 → 30 → 40 → 50`. There is no shortcut through it, and an earlier claim that Phases 10 and 30 could run in parallel because they are file-disjoint was **refuted** — Phase 30's own entry gate requires deletions Phase 10 performs. Disjoint files are not independent work.

Two dependency edges were declared too broadly by their authors and are the only reason the schedule looked like it might parallelise; neither survives scrutiny against the exit gates they depend on.

## The red window

`format:check` is **red at `e5aaf1e`**, on `REFACTOR_PLAN.md` alone, and it runs first inside `npm run check`. That single fact drives the ordering of everything in Phase 00, because a CI pipeline created on a red tree is born red and teaches everyone to ignore it. The sequence is **D-7 = (a)**: fix formatting → land `ci.yml` → only then turn on branch protection.

The one trap worth knowing before opening any PR: **the purge PR cannot merge on its own.** Phase 00 creates `ci.yml`, which asserts a 104-document static export; Phase 10 deletes 78 of those documents. Unless the `104 → 26` edit lands in the *same commit as the deletions*, the required `gates` check goes red and the PR is stuck. Phase 10 now carries that as a numbered step rather than a handoff note in somebody else's file.

## The ruling that governs all six

[`../COMPAT-POLICY.md`](../COMPAT-POLICY.md) **§6 is the authority** on backward compatibility, and it overrides §4 of that same document wherever the two differ. Three of its consequences change what an implementer does, not just how they read it:

- **Migration history stays sequential.** `0_init` … `5_v1_game_events` are kept and `6_drop_generation_a` is hand-authored. Regenerating a single cumulative init was recommended and **rejected**, because it would require hand-appending 16 objects that `schema.prisma` cannot express.
- **`6_drop_generation_a` is 10 statements** — 5 `DROP CONSTRAINT`, 4 `DROP TABLE`, 1 `DROP TYPE`, 29 lines. The dossier's long-standing "8 statements / 23 lines" was generated while `AuditEvent` survived. The number is 10 and not 9 because the artifact is generator output, and Prisma normalises owned foreign keys out ahead of the tables that own them.
- **There is no schema-drift gate.** The shadow-DB prerequisite and `migrate diff --exit-code` are deleted with **no substitute**: the cheaper DB-free comparison that was offered as a replacement only works against a collapsed history. `prisma validate` is the entire schema check, and it will happily pass on a schema whose migrations no longer reproduce it. Say so in the PR; do not imply a cheaper gate took over.

Compatibility is dropped for this repository's own past and preserved only for counterparties outside it: the `Heroes_Trial` GameMaker surface (`protocol-error.v1` and the Portuguese bridge field names) and the `basePath` URL already handed out.

## Decisions that need an owner

These are not answerable by reading code, and the phase files deliberately do not resolve them.

| Point | Status | What is at stake |
| :--- | :--- | :--- |
| **D-1** seam composition | **Recommend (a).** Only branch `(a)` keeps every gate in both files satisfiable; under `(b)` Phase 50's G6 is unreachable and needs a deviation row in two files. Phase 30's reported conflict with G6 did **not** survive measurement — under `(a)` both count the same alias deletion and go to zero together. | whether `typecheck:demo` exists |
| **D-3** CSS modularisation | Deferral recommended and currently applied; Phase 30 treats it as Phase 3's call and Phase 40 treats it as a human answer. **One of them is wrong about who owns it.** | the only silent-blank-print defect in the programme |
| **D-7 = (a)** | Implied by Phase 00 but is a real choice about when branch protection turns on. | whether CI is born red |
| **R1 / staging database** | **Open and unresolvable here.** No migration has ever been applied to a real database, and `DIRECT_URL` is read structurally by `prisma.config.ts:1,4,11`, so every CLI invocation inherits whatever the environment holds. | whether "the server target works" means anything |
| **`Heroes_Trial` check** | A courtesy, not a blocker. Confirm nothing in that repository switches on an `api-error.v1` code. | `RATE_LIMITED` deletion |
| **GitHub Pages traffic** | Whether any human holds a `/atividade/*` URL is not knowable from the repo. The only surviving duty is deleting `walkthrough.md:11`. | the hard-404 |
| **`test:contracts`** | Flagged as inside no CI leg; nobody has decided. | contract coverage in CI |

## Confidence marks

Used throughout, and worth respecting: `[V]` independently verified against the code at `e5aaf1e`, `[S]` single source, `[U]` unresolved or measured only by one agent. **A number without a state label is a bug** — several gates in these files are pre-purge on one tree and post-purge on another, and asserting the wrong pair is red on a correct tree.

## What has actually been executed

This matters more than the line counts, because it is the difference between an argument and a result:

- **Phase 10's purge was run** in a full clone outside the repo. 46/46 paths, 7,802 deletions, then `tsc` 0 errors, `lint` 0, `vitest` 27 files / 182 tests, `build:demo` → 26 documents, 0 demo action ids, 17 server action ids. The deletion set is proven **closed and minimal**; exactly one file is orphaned, and that orphan *is* the `StatusBadge` blocker.
- **The validator trap was measured end to end.** Bare deletion yields **64** `TS2307`s, **one of them genuine** from `src/`; fixing the real one leaves **63** false errors — 21 stale refs in each of **three** copies. The old cleanup deleted one root of the three and made `build:server` exit 1 with **46 more** errors than it started with, including a `TS2344` mode no document had recorded.
- **Phase 20's generator output was reproduced** in scratch: the 10-statement drop script, the 269-line regenerated init that the ruling declined, and four distinct `schema.prisma` line counts (252 / 251 / 247 / 227) that only looked contradictory.
- **Phase 00's `ci.yml` parses**, verified by extracting the block from the finished text and loading it with the repository's own `js-yaml`: `PARSE OK`, 17 steps, and it satisfies the ten cross-phase greps other phases run against it. The block it replaced did not parse at all.
- **Phase 50's gates were re-run**, and two were caught being unable to fail — one born green because `next build` throws before it can read anything, one satisfied by a word appearing in a comment.

## Two findings to carry into implementation, not just reading

**`npm run lint` exiting 0 does not mean the hook rules passed.** On `game-host.tsx` the React Compiler pass throws a `Todo` bailout that is swallowed by an empty `catch`, so `validateNoRefAccessInRender` never runs on that file at all. The three render-scope ref writes are latent in shipped code **today**, and a plugin version bump could surface them with no refactor involved. No gate in this programme treats lint-green as evidence about hook correctness, and none should.

**`entryProblem` is a live production defect.** A class used five times in a file that survives the purge, with no rule in any stylesheet, already present in the published JavaScript and CSS under `out/jogar/`. It is register row R-18, it is not caused by any phase, and the selector-integrity oracle that found it is precisely the kind of gate worth shipping — as a ratchet over a baseline, since post-purge the same rule reports 190 names and cannot be zero-tolerance.

## Reports

The seven refutation reports in [`../reports/`](../reports/) (1,470 lines) hold the evidence behind every claim above, including where an agent was wrong and what measurement settled it. Read `RV-X-cross-phase-consistency.md` for the dependency graph and `RV-20-schema-refutation.md` §1 for the drop-statement reversal. [`../architecture-map.html`](../architecture-map.html) is the before/after picture; [`../CRITIQUE-governing-conflicts.md`](../CRITIQUE-governing-conflicts.md) is where the plan and the governing audit contradict the code.

Phase files cite their siblings **by section, never by line number** — these files are edited continuously and line numbers go stale within hours.
