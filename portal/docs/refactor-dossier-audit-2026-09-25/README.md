# Refactor dossier audit — 25 September 2026

This directory contains a fresh, read-only audit of `docs/refactor-dossier/`.

## Rules

- Audit the complete dossier against the repository and all local/external documents it cites.
- Do not edit or implement application code, configuration, schemas, tests, or dossier source files.
- Primary reviewers and independent verifiers write only to their assigned file in this directory.
- Cite evidence with repository-relative paths and line numbers; separate measured, inferred, and externally documented claims.
- Do not promote an inherited report into evidence without replaying its underlying check.

## Work products

1. `01-governance-primary.md` — governing hierarchy, requirements traceability, cross-document policy.
2. `02-prerequisites-purge-primary.md` — Phase 00 and Phase 10 claims, source manifest, baseline and purge closure.
3. `03-schema-migration-primary.md` — Phase 20 schema, Prisma, Neon/auth, migration and data-model claims.
4. `04-composition-seam-primary.md` — Phase 30 dual-runtime, composition, TypeScript/Next.js mechanisms.
5. `05-decomposition-primary.md` — Phase 40 module boundaries, godfiles, CSS, services and regression risks.
6. `06-gates-ci-demo-primary.md` — Phase 50 tests, CI, demo/static export, documentation and gates.
7. `10-*-verification.md` — fresh refutations of the paired primary reports.
8. `00-consolidated-findings.md` — final deduplicated register and conclusions (created only after verification).

## Severity model

- **Blocker** — the plan cannot be executed safely or coherently as written.
- **Major** — materially wrong instruction, dependency, measurement, or gate.
- **Minor** — local ambiguity, stale detail, broken navigation, or missing traceability.
- **Observation** — useful confirmation or context, not a defect.
