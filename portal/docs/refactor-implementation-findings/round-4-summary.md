# Rounds 3–4 Summary — Fix verification and final readiness

Date: 2026-09-27. Base commit: `9467757`. This file closes out the review loop
that started with `round-2-summary.md`. Final index tree:
`ca61fcfd4944342967c0266d3bf0f8b314392bdf` (everything staged, nothing committed).

**Outcome: the implementation is ready.** All locally runnable gates pass, both
round-4 reviewers returned PASS / PASS-WITH-FINDINGS with zero open MAJORs, and
the only remaining items are the inherent release checks that no local review can
discharge.

## What rounds 3–4 did

Round 2's two MAJORs and ten scoped minors went to a fix agent; two review rounds
(one general + one reviewer each, same protocol as round 2) verified the fixes:

1. **P50 MAJOR (next RCE advisories) — RESOLVED (round 3, re-verified round 4).**
   `next` and `eslint-config-next` bumped 16.3.2 → 16.3.6 (exact pins), `sharp`
   transitively 0.35.3 → 0.35.4. `npm audit`: 8 findings (1 critical, 6 high,
   1 moderate) → 6 (5 high, 1 moderate), none on next/sharp. Round-3's dynamic
   reviewer classified ajv@8.17.1 (moderate) as reachable via the runtime chain
   `@neondatabase/auth-ui → @hookform/resolvers`; accepted as a reviewed finding —
   no override/`audit fix` per the runbook.
2. **P30 MAJOR (`"use server"` header) — CLOSED AS A ROUND-2 ERROR.** The run-3
   fix agent refused the change with a controlled probe, and round 3 proved it
   twice over: the Turbopack check lives in the native SWC binary
   (`next-swc.win32-x64-msvc.node` — invisible to a text search of
   `next/dist/**/*.js`, which is how round 2's static claim failed), and
   `npm run build:server` **regenerates the generated entries before Next runs**,
   so round 2's naive "prepend the header and build" self-healed into a false
   pass. A direct `next build` with the header fails exactly as the generator
   comment always said: `Only async functions are allowed to be exported in a
   "use server" file.` plus 38 cascading export errors (39 total), on 16.3.6.
   Closure: the barrel stays directive-free; the runbook's Target Shape sentence
   was amended (with a dated revision note), and the generator comment +
   `docs/current-architecture.md` cite the exact error as evidence.
3. **Round-3's own two MAJORs — RESOLVED (round 4).** `@next/env` was left at
   16.3.2 (version skew + duplicate nested install) → bumped to 16.3.6 exact,
   nested copy gone, lockfile delta machine-generated and scoped. The new banner
   in `docs/architecture-audit-2026-09-23.md` had two root-relative links that
   dangled from `docs/` → made file-relative and resolution-verified.
4. **F3–F10 (minors) — ALL APPLIED AND VERIFIED:** dead icon variants removed,
   duplicate import merged, `/src/runtime/*.tmp` gitignored, temp-dir leak fixed
   in the escape regression, historical banners/wording across five docs with
   zero remaining links to the deleted schema docs, `entryCredential` redaction +
   test, DESIGN.md mobile-nav accuracy, `not.toBe` fresh-clone assertion.
5. **Final coordinator closures (2 two-character edits, post-round-4):** literal
   `\"` escape in `docs/current-architecture.md:266` and the stale "Next.js
   16.3.2" mention in the runbook's Evidence Used section.

## Final gate state (round-4 dynamic verification, all exit 0)

clean:build · format:check · lint · prisma:validate · typecheck:server ·
typecheck:demo · `npm test` (28 files / 200 tests) · build:server · build:demo ·
`npm ls @next/env next` (single 16.3.6, deduped) · npm audit (6, none on
next/sharp) · generated-entry shapes correct in both targets. All work is staged;
`git diff --name-only` is empty. Local gates ran on Node v22.23.1 — CI pins and
must confirm 24.19.0.

## Remaining (release checks and decisions — not review defects)

Release checks, per the runbook: first real CI run; make the `gate` job required
on `main` (exact check name: `gate`) and record the run URL; disposable-database
validation (apply `0_init`, verify 8 CHECK constraints + 2 partial unique
indexes, exercise the flows); manual browser smoke at `/SMS_Portal/`.

User decisions: (a) commit as one changeset or split at phase boundaries — the
P00 "Pages unchanged until P50" bullet is only certifiable against a split tree;
(b) 13 untracked review artifacts under `docs/refactor-implementation-findings/`
(this round's reports) — commit as evidence (round 1's equivalents are staged),
ignore, or discard; (c) the runbook amendment R4-5 — revert if unwanted.
Accepted findings, documented not fixed: ajv moderate (transitive, reviewed),
`dev: true` metadata churn in the lockfile (npm-generated, BFS-verified
dev-only), a pre-existing 74px fixed-height mobile bar that cannot actually
render the wrapped fifth item (backlog-worthy CSS characteristic), and 30
historical `clean-build-*` temp dirs in the OS temp directory.

## Report index

- Fix log: `round-3-fix-log.md` (round-3 fix agent)
- Round 3: `round-3-fix-review-reviewer.md` (static; F1 adjudication with binary
  evidence), `round-3-fix-review-general.md` (dynamic; build:server self-heal
  root cause + 13-command gate table)
- Round 4: `round-4-fix-review-general.md` (dynamic; PASS, all gates green)
- Round-4 static review: returned in-session; filed as
  `round-4-fix-review-reviewer.md`
- Round 2 (superseded where noted): `round-2-summary.md` and `pXX/r2-review-*.md`
