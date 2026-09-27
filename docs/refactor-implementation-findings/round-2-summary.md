# Round-2 Review Summary — IMPLEMENTATION-READY.md implementation

> **Update 2026-09-27 (rounds 3–4):** the two MAJORs below are resolved. The
> P50 next advisories were fixed by the 16.3.6 bump; the P30 `"use server"`
> finding was **closed as a round-2 error** — the Turbopack check lives in the
> native SWC binary and `build:server` self-heals naively edited generated
> files, which produced round 2's false pass. See `round-4-summary.md`,
> `round-3-fix-review-reviewer.md`, and `round-3-fix-review-general.md`.

Date: 2026-09-27. Base commit: `9467757`. Scope: the entire staged working-tree
change (172 files, +7,434 / −13,699) implementing `docs/refactor-dossier/IMPLEMENTATION-READY.md`
(rev. 2026-09-26).

Method: for each phase (P00–P50), two independent subagents were spawned — one
**general-purpose** agent (dynamic verification: ran the actual gates and recorded
real exit codes) and one **reviewer** agent (read-only static spec-compliance review).
Neither read the round-1 findings (`review-A/B/verification-general.md`), which
remain on disk as the prior round. Full round-2 reports live at
`docs/refactor-implementation-findings/pXX/r2-review-reviewer.md` and
`pXX/r2-review-general.md`.

## Verdicts

| Phase | Reviewer (static) | General (dynamic) | MAJOR findings |
|---|---|---|---|
| P00 Reproducible baseline + CI | PASS-WITH-FINDINGS | PASS-WITH-FINDINGS | 2 (both phase-packaging, see below) |
| P10 Generation-A purge | PASS-WITH-FINDINGS | PASS-WITH-FINDINGS | 0 |
| P20 Clean schema baseline | PASS | PASS | 0 |
| P30 Generated runtime entries | PASS-WITH-FINDINGS | PASS-WITH-FINDINGS | 1 |
| P40 Focused decomposition | PASS | PASS | 0 |
| P50 Security/docs/deployment | PASS-WITH-FINDINGS | PASS-WITH-FINDINGS | 1 |

Every gate that can run locally passes on the working tree: format:check, lint,
prisma:validate, prisma:generate, both target typechecks from cold, `npm test`
(28 files / 200 tests), build:server, build:demo (static export), and the full
`npm run check` chain from a cold generated-entry state.

## The two MAJOR findings needing action

1. **P30 — the generated server `actions.ts` is missing the runbook-mandated
   `"use server"` header** (`scripts/next-target.mjs:82-90`, runbook Target Shape
   at `IMPLEMENTATION-READY.md:270-272`). The generator's comment claims the
   installed Turbopack transform rejects re-exports in `"use server"` files, but
   round 2 refuted that justification two ways: (a) static inspection of
   next@16.3.2 shows the only checks are `typeof action === "function"`
   (`next-flight-loader/action-validate.js`) and the TS-plugin promise-returning
   check, both of which re-exported async functions pass; (b) a dynamic probe
   built the server target with the header added — exit 0, no warnings. The
   omission is functionally neutral today (the five implementation modules still
   carry the directive), but it deviates from the written Target Shape and the
   same refuted claim is stated as fact in `docs/current-architecture.md:262-266`.
   Remediation: add the header to the server template (one line) and correct the
   doc, or record the exact Turbopack error if one can be reproduced.

2. **P50 — `npm audit` reports 8 vulnerabilities (1 critical, 6 high, 1 moderate);
   runtime-relevant: `next@16.3.2` RCE advisories affecting the server target**
   (plus `sharp@0.35.3`, transitive). These are pre-existing, the only dependency
   the refactor added is dev-only (`fake-indexeddb@6.2.5`), and the runbook
   forbids `audit fix --force` — so the follow-up is a deliberate pin bump
   (e.g. next 16.3.6) in a separate change before any server deployment.

## Phase-packaging finding (P00)

The implementation landed as **one staged changeset containing all of P10–P50**,
not as phase-by-phase PRs. Consequently the P00 acceptance bullet "Pages
deployment remains unchanged until P50; do not claim it is gated yet" is false in
the reviewed state (`deploy.yml` is deleted; `ci.yml` already contains the folded
Pages upload/deploy job; `README.md:120-126` already claims it). The end state
itself is exactly the runbook's P50 requirement and passes every property check,
so this is a sequencing/certification issue, not a defect — but if phase-boundary
PRs were intended, the commit must be split, and P00's bullet can only be
certified against a P00-only tree.

## Cross-cutting observations

- **Toolchain pin:** every local gate ran on Node v22.23.1 / npm 11.6.0; the repo
  pins Node 24.19.0 (CI pins it too). The runbook acknowledges this shell
  discrepancy; final acceptance should quote CI runs, not local ones.
- **Release checks still outstanding** (by design not locally runnable): first
  real CI run; making the `gate` job required on `main` (exact check name: **`gate`**);
  the disposable-database release validation (apply `0_init`, verify the 8 CHECK
  constraints + 2 partial unique indexes in the catalog, exercise auth/credential/
  state/result/active-time flows); and the P50 manual browser smoke (not
  re-executed in round 2; round-1 record exists at
  `p50/manual-browser-smoke.md`, and round 2 statically confirmed every smoke
  prerequisite is present in the tree).
- **Schema baseline:** `0_init` was regenerated from the final schema with the ten
  named database rules appended byte-identical to the historical semantics; a
  `migrate diff --from-empty` cross-check produced output matching `0_init` except
  exactly the appended rules (zero drift). 12 models / 5 enums; no
  `gen_random_uuid()` defaults.

## Notable MINOR findings (details in per-phase reports)

- Docs classification: `docs/architecture-audit-2026-09-23.md` has no historical
  banner yet is linked as live guidance (`REFACTOR_PLAN.md:19`,
  `docs/implementation/README.md:50`); `docs/implementation/README.md` still calls
  `v1-architecture-plan.md` "the executable plan"; `phase-01-foundation-contracts.md:36`
  still carries a Dockerfile task line under a banner that doesn't name Docker;
  dangling relative links to the deleted `api-contracts.md`/`domain-rules.md`.
- Leftover dead code: four unused `IconName` variants (`book`, `edit`, `link`,
  `paperclip`) orphaned by the purge.
- Duplicate import pair in `src/app/(professional)/portal/turmas/[id]/page.tsx:6-7`
  left by the mechanical repoint.
- `package-lock.json` carries 27 unexplained `"dev": true` removals (likely an
  npm 11.17.0 rewrite vs the pinned 11.6.0) — regenerate with the pinned npm or accept.
- `tests/unit/clean-build-artifacts.test.ts` leaks its parent temp directory.
- `scripts/next-target.mjs` `.tmp` side files are not gitignored (crash residue
  would show in `git status`).
- `DESIGN.md` says five mobile destinations; the grid has four columns (fifth
  wraps) — pre-existing line, now in a P50-owned current doc.
- Logger redaction latent gaps: `entryCredential` field name and `err` payload
  paths are not covered (verified currently inert).
- `workflow_dispatch` was dropped with `deploy.yml`; Pages rollback now goes
  through the GitHub environment redeploy UI, not a manual workflow trigger.

## Report index

- `p00/r2-review-reviewer.md`, `p00/r2-review-general.md`
- `p10/r2-review-reviewer.md`, `p10/r2-review-general.md`
- `p20/r2-review-reviewer.md`, `p20/r2-review-general.md`
- `p30/r2-review-reviewer.md`, `p30/r2-review-general.md`
- `p40/r2-review-reviewer.md`, `p40/r2-review-general.md`
- `p50/r2-review-reviewer.md`, `p50/r2-review-general.md`
- Prior round (round 1): `p00..p50/review-A.md`, `review-B.md`,
  `verification-general.md`, plus `p50/manual-browser-smoke.md`,
  `p50/npm-audit-review.md` and `p00/baseline-record.md`.
