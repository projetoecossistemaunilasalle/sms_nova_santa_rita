# Phase Index

The executable plan is now
[`IMPLEMENTATION-READY.md`](../IMPLEMENTATION-READY.md), revised 2026-09-26
against checkout `780b0a8`. It selects one implementation path and replaces
the conflicting instructions and gates in the older files below.

| Phase | Current work order                                                                          | Historical evidence                                      |
| ----- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| P00   | [Reproducible baseline and CI](../IMPLEMENTATION-READY.md#p00-reproducible-baseline-and-ci) | [00-prerequisites.md](00-prerequisites.md)               |
| P10   | [Closed purge](../IMPLEMENTATION-READY.md#p10-closed-generation-a-purge)                    | [10-purge-generation-a.md](10-purge-generation-a.md)     |
| P20   | [Clean schema baseline](../IMPLEMENTATION-READY.md#p20-clean-schema-baseline)                | [20-schema-and-migration.md](20-schema-and-migration.md) |
| P30   | [Generated runtime entries](../IMPLEMENTATION-READY.md#p30-generated-runtime-entries)        | [30-composition-seam.md](30-composition-seam.md)         |
| P40   | [Focused decomposition](../IMPLEMENTATION-READY.md#p40-focused-decomposition)                | [40-decomposition.md](40-decomposition.md)               |
| P50   | [Final integration](../IMPLEMENTATION-READY.md#p50-security-documentation-deployment-and-acceptance)    | [50-gates-ci-demo-docs.md](50-gates-ci-demo-docs.md)  |

Merge serially: `P00 -> P10 -> P20 -> P30 -> P40 -> P50`.

The current plan uses separate generated action, reader, and browser-client
entries and removes all `@runtime/*` aliases. It also applies the explicit
no-compatibility rule to routes, browser state, and the database baseline. Older
counts and command transcripts remain evidence of the tree and toolchain on
which they were recorded, not new acceptance runs.

Only the new runbook defines entry/exit gates, package script ownership, final
CI order, deviations and release handoffs. Do not combine its steps with the
old work orders or fall back to the old alias-preserving branch. Database and
external-game acceptance are release checks, not claims that a local build
has already proved them.
