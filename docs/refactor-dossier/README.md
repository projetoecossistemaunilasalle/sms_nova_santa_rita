# Refactor Dossier

**Implementers start with [the implementation runbook](IMPLEMENTATION-READY.md).**
Revised 2026-09-26 against `780b0a8`, it supersedes the older executable prose,
uses generated action/reader/client entries, applies the no-compatibility rule to
the database baseline as well as application code, and limits new tests to
behavior placed at risk by the refactor.

This revision changes documentation only. No application refactor, migration,
deployment or GitHub settings change has been performed.

## Current Plan

- [Implementation runbook](IMPLEMENTATION-READY.md): decisions, ordered work,
  acceptance criteria, canonical scripts, CI sequence and rollback.
- [Phase index](phases/README.md): links into the runbook and historical evidence.
- [Compatibility policy](COMPAT-POLICY.md): historical analysis. Its earlier
  migration-history ruling is superseded by the current no-compatibility scope.

## Historical Evidence

The following files retain useful investigations and also retain superseded or
refuted instructions. They are **not independent implementation authorities**:

- [Consolidated dossier](REFACTOR-DOSSIER.md) and the six older `phases/*.md`
  work orders. The P10 A/B/C deletion manifest is explicitly adopted by the
  runbook; old line counts and other commands are not.
- [Governing-conflict critique](CRITIQUE-governing-conflicts.md) and `reports/`,
  containing the original investigations, verifications and refutations.
- [September 25 independent audits](../refactor-dossier-audit-2026-09-25/README.md),
  including later corrections to the seam, extraction arithmetic and gates.
- [Architecture diagram](architecture-map.html), labeled historical because its
  after-state and numeric annotations predate the revised execution plan.

The original `REFACTOR_PLAN.md` remains the requirement record. The new runbook
records deviations explicitly instead of claiming every original criterion is
met. Use phase IDs `P00` through `P50`; old dossier and architecture-audit
decision numbers are historical context only.
