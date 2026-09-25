# Refactor dossier

Implementation dossier for `REFACTOR_PLAN.md` v2.1 (V1 architectural refactor and simplification), built from a verification pipeline over the actual codebase rather than from the plan's prose.

**Implementers start with [`phases/README.md`](phases/README.md)** — the index of the six ordered work orders, the dependency graph, the red window, and the decision points that still need a human. **Readers wanting the reasoning start with [`REFACTOR-DOSSIER.md`](REFACTOR-DOSSIER.md)**, the consolidated document: verified baseline, decision points, phase summaries, interface stability table, regression register, simplification options, and open questions.

## Layout

```
docs/refactor-dossier/
  README.md                          this file
  phases/README.md                   start here to implement — the six-phase index
  REFACTOR-DOSSIER.md                the consolidated reasoning — start here to understand
  COMPAT-POLICY.md                   the backward-compatibility ruling; §6 governs everything
  CRITIQUE-governing-conflicts.md    where the plan and the governing audit contradict
                                     the code, and which of them wins
  architecture-map.html              before/after architecture, drawn
  reports/                           16 investigation/verification reports, 4 main-agent
                                     notes, and 7 phase refutations (RV-*)
  phases/
    00-prerequisites.md              format:check, the order-dependent test, ci.yml, branch protection
    10-purge-generation-a.md         the Generation A deletion (46 paths / 7,802 lines)
    20-schema-and-migration.md       schema cuts and the migration history
    30-composition-seam.md           the src/runtime seam, @runtime/* aliases, the ESLint fence
    40-decomposition.md              god-file splits, dead-CSS purge, size ratchet
    50-gates-ci-demo-docs.md         CI gates, the demo runtime, documentation truth
```

Each phase file is written to be read **alone**, with its own entry gate, numbered work order, exit gate, rollback and accepted breakage. That is also their weakness, so `phases/README.md` carries what none of them can see: the ordering, the shared numbers, and the contradictions between them. Phase files cite their siblings **by section, never by line number**.

[`architecture-map.html`](architecture-map.html) is openable directly in a browser and needs no server: it draws the seven
layers as bands, colours every module by generation (legacy / V1 / demo twin / created by this refactor), marks
extension points as open sockets, and pins 11 numbered architecture errors onto the boxes that cause them. Click a
module for its ownership boundary and its inbound/outbound dependencies; click a number for the defect and the
dossier section that resolves it. The Before and After views can be shown stacked at full size.

## Why the folder is shaped this way

The plan's direction is treated as fixed input; nothing in this dossier proposes editing it. The dossier instead establishes what executing it correctly requires, and separates three kinds of statement that are easy to confuse:

- **`REFACTOR-DOSSIER.md`** — what to do, with confidence marks `[V]` (independently verified), `[S]` (single source), `[U]` (unresolved).
- **`phases/*.md`** — the same programme split into six executable work orders. Where a phase file and the dossier disagree, **the phase file is newer and the dossier section has been corrected to match**; both now follow `COMPAT-POLICY.md` §6.
- **`COMPAT-POLICY.md`** — the answer to "should this refactor protect the system that exists today?" It classifies every conservative clause in the dossier as internal-legacy compat (drop), an external counterparty contract (keep, and name the counterparty), or correctness dressed as conservatism (keep, and stop calling it that). **§6 is the owner's ruling and overrides §4.**
- **`CRITIQUE-governing-conflicts.md`** — assertions in the plan *or* in `docs/architecture-audit-2026-09-23.md` that the code contradicts, including the case where the governing document's own recommended design cannot compile.
- **`reports/`** — the raw evidence, including claims that were **refuted**. Read the `VER-*` and `ADV-*` files rather than the `INV-*` originals when they disagree; `ADJ-01` through `ADJ-03` are places where two agents contradicted each other and the main agent settled it by running the command. The seven `RV-*` files are a second, later round that attacked the finished phase work orders — they overturn several `INV-*` and `VER-*` numbers, so check them before quoting a count.

## Method

**Round one — the dossier.** Six scoped investigations ran in parallel, each against a named section of the plan. Each was then attacked by a dedicated verification agent instructed to refute it, re-measuring every count with a different method. Three adversarial agents then attacked the consolidated *approach* — phase ordering and integration, the seam design, and scope plus missed regressions. Where two agents contradicted each other, the main agent reproduced the measurement directly (`ADJ-01` … `ADJ-03`). A final audit agent then attacked the **dossier itself**, and won: it refuted one main-agent finding (`ADJ-03` §F1, `typecheck` on a fresh clone — the audit ran it, exit 0), corrected three wrong-file/wrong-line citations, and fixed several unearned `[V]` marks. Those corrections are applied in place, and the refuted text is retained struck-through in `ADJ-03` rather than deleted.

**Round two — the phases.** Six agents then wrote one work order each, in parallel, from the dossier plus the compat policy. Because they wrote independently, a second refutation round followed: one adversarial reviewer per phase file, re-measuring every count with a different method and running every gate command to check it *can* fail, plus one cross-phase auditor owning the space between the files — disagreeing numbers for the same fact, dependency cycles, one file's exit gate not matching the next file's entry gate, and a late ruling leaking into only some of them. Every defect they confirmed was then applied back into the phase files and into the master dossier.

**Where a human settled it, not a vote.** Majority agreement proved nothing in this round. A lone agent was right against a majority twice (`RV-20` on the drop-statement count, which the main agent had overridden and then had to reverse; `RV-40` on *why* a lint rule appeared to pass), and the main agent's own first re-measurement was also wrong twice because it globbed only the obvious build directory. Every number in these files that survived a dispute carries the command that settled it.

All agents were read-only with respect to **this working tree**: no production file, no config, and no tracked artifact was modified, and `REFACTOR_PLAN.md` was never edited. The only files created or changed are inside this folder. That is not the same as nothing having been executed — the strongest evidence here comes from *running* things, in full clones and scratch copies outside the repository. The Generation A purge was carried out in a complete clone and then built, typechecked and tested there; Prisma's differ was run against scratch copies of the schema; ESLint was run against deliberately broken fixtures in a temporary directory. **No database was ever contacted, `prisma generate` was never run, and no migration was applied.** Where a claim could only be reasoned about rather than executed, it carries `[S]` or `[U]` rather than `[V]`.

## Headline state of the plan's claims

| Plan section | Executable as written? |
| :--- | :--- |
| §2 deletion manifest | **Yes, and now proven rather than argued** — the purge was executed in a clone and came out closed and minimal (46 paths / 7,802 lines, one orphan, and that orphan is the `status-badge.tsx` build blocker). `proxy.ts` needs its **line 113 only**; the plan's `109-116` range would delete live security code |
| §2.5 schema purge | **No** — fails `prisma validate` as written; a fourth relation removal is unlisted. The drop script it implies is **10 statements**, not the 8 the dossier long published |
| §2.5.6 migration history | Executable, and **chosen**: history stays sequential. The cheaper-looking alternative — one regenerated init — was recommended by an audit and **rejected by the owner**, because 16 invariants Prisma cannot express would have to be hand-appended |
| §3.1 runtime seam | **No, as specified** — needs two generated entries rather than one, item 4's rationale is inverted, and the E625 justification does not apply (the gate is only ever evaluated on the demo target). The file the plan assigns to the generator **already exists** as a tracked env loader, `src/runtime/target.ts` exists nowhere, and no `prebuild` hook fires for these script names |
| §3.2 tsconfig exclude | Effectively a no-op as justified |
| §3.3 demo persistence | Two items name files/helpers that cannot work in a browser context; the `localStorage` key may now be bumped, which was previously blocked as a compatibility concern |
| §4.1 CSS modularization | Achievable but self-defeating in this sprint: it breaches its own size budget and creates the only silent-blank-print defect |
| §4.2 offline engine split | Yes, after characterization tests; the plan's file sizing violates its own ceiling. The T3 slot had been consumed by a migration case the ruling deleted, which cost four real tests including the only guard on the one `idb → canonical` edge |
| §4.3 game-host split | Recommended **refused** for the hooks half — and the reason changed. It is not that the pattern is fragile and the split would expose it; the ref rule **never runs on this file at all**, because a compiler-pass bailout is silently swallowed |
| §4.4 service decomposition | Item 1 yes (to a different folder), item 2 no |
| §6 Day 0 | Stale (already committed) and mis-ordered (`format:check` is already red) |
| §7 criteria | Worse than first reported. **Four** gates cannot fail, and **three** cannot pass — one asserts a header no static server will ever emit, one greps for a string a later phase owns, one is red on a correct tree |
