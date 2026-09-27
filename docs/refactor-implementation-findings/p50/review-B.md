# P50 Review — Reviewer B

Date: 2026-09-26. Scope: uncommitted P50 changes reviewed against
`docs/refactor-dossier/IMPLEMENTATION-READY.md` §P50, the Final CI Sequence, and
the Manual Browser Smoke checklist. Independent review (review-A.md and
verification-general.md intentionally not read). Read-only for implementation
code; no builds run.

## Summary of changes reviewed

- `src/server/observability/logger.ts` — redaction list extended (`cred`,
  `launchToken`, `credential`, `playerCredential`, `credentialHash`,
  `tokenHash`, each with a one-level `*.` wildcard; plus URL-shaped keys `url`,
  `href`, `req.url`, `request.url` censored outright); `pino` instance moved
  behind a `createLogger(destination?)` factory.
- `tests/unit/http.test.ts` — one output-level redaction regression using a
  sentinel credential through a `Writable` capture stream.
- `src/app/(professional)/portal/ajuda/page.tsx` — help content rewritten to
  the seven post-refactor topics with per-topic icons; dead
  "Abrir orientação" link span removed.
- Current docs updated: `README.md`, `DESIGN.md`, `PRODUCT.md`,
  `docs/current-architecture.md`, `docs/schemas/README.md`,
  `docs/schemas/database-model.md`, `contracts/schemas/README.md`,
  `walkthrough.md`.
- Historical banners added to `docs/implementation/v1-architecture-plan.md`,
  `docs/v1-game-integration-dossier.md`, `implementation_plan.md`,
  `docs/demo-visual-plan.md`.
- `.github/workflows/ci.yml` added (gate + dependent Pages deploy);
  `.github/workflows/deploy.yml` deleted (staged).
- `npm audit` reviewed without running any fix (verified independently below).
- Smoke record: `docs/refactor-implementation-findings/p50/manual-browser-smoke.md`.

Checks executed by this reviewer: `npx vitest run tests/unit/http.test.ts`
(4/4 pass), `npm run format:check` (clean), `npm run lint` (clean, 0 warnings),
`npm audit` (re-run independently), full-repo Docker sweep, YAML inspection of
`ci.yml`, and the code-level spot checks listed below.

## Findings

### F1 — INFO — Logger redaction depth is one nesting level
`src/server/observability/logger.ts:23-36` — pino's `*` wildcard matches exactly
one path segment, so `*.cred` redacts `nested.cred` but not `a.b.cred`. The
regression test (`tests/unit/http.test.ts:57-63`) exercises only one nesting
level. Confirmed limitation, not a defect: the only production call site
(`src/server/http/route.ts:20-24`) logs scalar top-level fields (`path`,
`method`, `status`), and the sensitive keys in this codebase
(`CredentialMaterial.tokenHash`, issued `credential`, `?cred=` param) are all
flat or one level deep. Residual risk is acceptable; noting for the record.

### F2 — INFO — URL-key redaction is fail-closed and matches the runbook
`src/server/observability/logger.ts:37-44` censors any `url`/`href`-shaped key
outright rather than attempting query-string stripping. This is a sound way to
enforce "pathname rather than full URL": the sole HTTP call site logs
`request.nextUrl.pathname` under `path` (route.ts:23), which the regression
asserts survives while a full `url` is censored. Grep across `src/` found no
other `logger.` call site and no stray `console.log`; the only console use is
`console.error(error)` in `src/app/error.tsx:16` (error object, not URL-shaped).
Confirmed sound.

### F3 — INFO — Regression is not vacuous
`tests/unit/http.test.ts` builds a real pino instance through the exported
`createLogger` with a `Writable` capture, then asserts per-key equality with the
censor (`expect(structured?.[key]).toBe("[REDACTED]")`) for all six credential
keys plus nested variants, asserts the serialized output never contains the
sentinel, and asserts the pathname-only entry survives while `url` is censored.
If redaction were absent, the sentinel would be present and the censor
assertions would fail. Confirmed non-vacuous; test passes (4/4).

### F4 — INFO — Help page claims verified against the implementation
All checked claims hold:
- "Perfil demonstrado", "Restaurar demo": `src/components/portal/demo-role-controls.tsx:69,103`.
- "Trocar QR" and immediate revocation: `src/components/portal/player-access-workflow.tsx:255`;
  `src/runtime/adult-portal-demo-store.ts:922-951` revokes every ACTIVE
  credential of the slot before inserting the new one; the service
  (`src/application/player-access/service.ts:83-103`) refuses inactive slots.
- "Jogador 01…" and never-reused numbers: `padStart(2,"0")` formatting in
  `player-access-workflow.tsx:53`; `allocateSlots`
  (`src/runtime/adult-portal-demo-store.ts:879-905`) draws from a monotonic
  `nextPlayerNumber` counter that only increments.
- Teachers see only active assigned classes:
  `src/application/adult-portal/service.ts:353-386` filters on
  `classGroup.status === ACTIVE && teacherClassIds.has(id)`.
- Waiting/ended entry states: `src/components/public/player-entry-screen.tsx:17,38,113`.
- `/jogar` exists: `src/app/(public-play)/jogar/page.tsx`.
- All seven icon names are valid `IconName` values (`src/components/shared/icon.tsx:3-40`).
No false promises found. Confirmed accurate.

### F5 — INFO — Docker sweep clean
`grep -ri docker` over `README.md`, `DESIGN.md`, `PRODUCT.md`,
`docs/current-architecture.md`, `docs/schemas/README.md`,
`contracts/schemas/README.md`, `walkthrough.md`, `implementation_plan.md`, and
the two banner-labeled historical docs returns zero matches. Remaining Docker
mentions live only in audit/review records (dossier, `docs/*audit*`,
`docs/agent-reviews`, `docs/implementation/phase-01-*.md`), which are records,
not current guidance. `Dockerfile` and `.dockerignore` deletions are staged.
Confirmed satisfied.

### F6 — INFO — Concrete doc claims spot-checked (all verified)
1. README "ci.yml is the only workflow": `.github/workflows/` contains only
   `ci.yml`; `deploy.yml` deletion staged (`D` in index).
2. README "every dev/build/test/typecheck command first regenerates
   `src/runtime/{actions,readers,client}.ts` via `scripts/next-target.mjs`;
   `*.demo.ts`/`*.server.ts` tracked": confirmed at
   `scripts/next-target.mjs:88-95` and staged `A` entries for
   `actions.demo.ts`/`actions.server.ts`/etc.; the generated files are
   git-ignored (`.gitignore` adds them), consistent with the claim.
3. README "`npm run start` rebuilds and launches through `scripts/start.mjs`":
   `scripts/start.mjs` runs `npm run build` before launching
   `.next/standalone/server.js`. Accurate.
4. current-architecture route table: `/api/v1/player/{bootstrap,state,results,active-time}`
   route handlers all exist; `/entrar/recuperar/page.tsx` exists;
   `contracts/schemas/v1/` holds the 17 JSON Schemas; `contracts/fixtures/v1/{valid,invalid}`
   exist as the contracts README claims.
5. current-architecture "There is no /health route": confirmed —
   `src/app/health/{live,ready}` contain zero tracked files (empty leftover
   directories only; git tracks nothing there).
6. walkthrough: `generateStaticParams` present in exactly the four listed
   dynamic routes; `signInAction` exists (`entrar/actions.ts:17`); the
   "126 testes" number was correctly replaced with an unnumbered claim.

### F7 — INFO — Historical banners label without rewriting
`v1-architecture-plan.md`, `v1-game-integration-dossier.md`, and
`implementation_plan.md` receive banner-only changes (blockquote above the
existing Status line, body untouched). `docs/demo-visual-plan.md` additionally
changes two in-body tense phrases ("atual" → "da época", status line folded
into the banner) — consistent with the banner and disclosed in the diff.
Confirmed no body rewriting.

### F8 — CONFIRMED — ci.yml matches the Final CI Sequence exactly
`.github/workflows/ci.yml`, gate job order: checkout → Node pinned
`24.19.0` → `npm ci` → `npm run clean:build` → `format:check` → `lint` →
`prisma:validate` → `typecheck:server` → `build:server` → `npm test` (once;
script prepends the demo `gen`) → `typecheck:demo` → `build:demo` →
upload-pages-artifact. Sequence matches runbook items 1–5 one-for-one.

- Gating: upload step and deploy job both guard on
  `github.event_name == 'push' && github.ref == 'refs/heads/main'`; `deploy`
  is `needs: gate`, so PRs run the full gate but never upload or deploy.
- Permissions: workflow-level `contents: read`; `pages: write` +
  `id-token: write` declared only inside the deploy job. Scoped per runbook.
- Concurrency: `group: "pages"`, `cancel-in-progress: false` on the deploy job
  only — identical to the deleted `deploy.yml` (verified via
  `git show HEAD:.github/workflows/deploy.yml`), so PR gate jobs are not
  serialized.
- Environment: `github-pages` with `url: steps.deployment.outputs.page_url`
  preserved.
- Env placeholders in the gate job are clearly marked non-secret fakes
  (`ci-placeholder-*`, `127.0.0.1` URLs); no real credentials committed.
- Both `ci.yml` (`A`) and `deploy.yml` (`D`) are staged per `git status`.
- YAML validity: verified by inspection only (no YAML parser available
  locally); structure, quoting, `${{ }}` expressions, action refs
  (`checkout@v4`, `setup-node@v4`, `upload-pages-artifact@v3`,
  `deploy-pages@v4`) are all well-formed; GitHub's parser is the final
  authority at first run.

### F9 — CONFIRMED — Audit: no forced fix, applicability reasoning sound
Independent re-run of `npm audit` (reviewer-executed): 8 vulnerabilities
(1 moderate, 6 high, 1 critical). `next` remains pinned `16.3.2` in both
`package.json:39` and `package-lock.json`; the lockfile diff vs HEAD contains
only the `fake-indexeddb` addition — no version was bumped, so no
`audit fix` (forced or otherwise) was run. Applicability assessment:
- `next` critical RCEs (GHSA-p293-qw3h-jr36 windows-hosted servers;
  GHSA-2xp9-vwfh-vxw4 AVIF image optimization): the demo target is a static
  export served by GitHub Pages (no Node server, no image optimization API);
  the server target is not a Windows-hosted deployment per the current docs.
  Real, but not fixable in-scope without leaving the pinned range (audit
  proposes `next@16.3.6`, "outside the stated dependency range"), which the
  runbook explicitly forbids forcing. Correctly deferred.
- `mysql2` (high) arrives only via `prisma`'s optional engine deps; the
  application is Postgres-only (`DATABASE_URL postgresql://`), so it is never
  exercised. Not applicable at runtime.
- `sharp`, `js-yaml` (high): build/tooling-time dependencies (image
  optimization, config parsing), not exercised by the static export or the
  standalone server's request path as documented.
Note: no standalone audit-record file exists under
`docs/refactor-implementation-findings/p50/` (only the smoke record); the
implementer's written reasoning may live in review-A.md, which this reviewer
did not read. The underlying facts are independently verified above.

### F10 — CONFIRMED — Smoke record claims verified against the repo
Sampled claims, all holding:
- Print CSS: compiled `out/_next/static/chunks/2a1hz6gj3zzgw.css` contains
  `@media print{body>*{visibility:hidden}`,
  `.printSheet:not([data-player-print-active]){display:none}`, and
  `.printSheet{...grid-template-columns:repeat(2,minmax(0,1fr))}` — exactly the
  three rules the record cites, sourced from
  `src/components/portal/portal.module.css:2404-2426`.
- Two-tab mechanism: `src/components/portal/use-demo-portal.ts:14-15` listens to
  both the same-tab `adult-portal-demo-change` custom event (dispatched in
  `writeDemoAdultPortalState`, `src/runtime/adult-portal-demo-store.ts:416`) and
  the cross-tab `storage` event on the shared key
  `missoes-caramelito:adult-portal:v2` (`adult-portal-demo-store.ts:137-138`).
- Seed fallback: `readDemoAdultPortalState`
  (`adult-portal-demo-store.ts:397-409`) returns `cloneSeed()` on missing value,
  on failed `isValidDemoAdultPortalState` (version !== 2, wrong collection
  shapes/fields), and on JSON parse errors — matching the record's corrupt-state
  PASS.
- URL scrub: `src/components/public/player-entry-credential.ts` deletes `cred`
  from the query string and `player-entry-screen.tsx:84` rewrites history via
  `replaceState`; error message "Este QR não foi reconhecido" exists
  (`player-entry-screen.tsx:22`).
- The record's non-blocking observation about stale copy is accurate:
  `src/components/portal/classes-screen.tsx:86` still says "O acesso numerado
  de jogadores será configurado em um próximo slice".
- Caveat plausibility: the rAF-suspension claim is a genuine environment
  property of embedded WebViews and was falsified against the strongest
  available control (the deployed pre-refactor demo behaving identically in the
  same browser, plus identical `$RC`/`B:0`/`S:0` export structure) — correctly
  ruled out as a product defect. The per-tab localStorage isolation only blocks
  the two-tab manual check; the mechanism it would exercise is unchanged and
  code-verified above. Both caveats are honestly reported and correctly
  classified as not product defects.

### F11 — INFO — Outstanding-by-design: branch protection evidence
Runbook §P50 item 6 (making the gate job required on `main` and recording the
run URL) requires a first real CI run on the committed workflow; it cannot be
satisfied by uncommitted local work. Not a defect of this change set, but it
remains an open acceptance item for the administrator after merge. Local
workflow text is, as the runbook says, not evidence of active protection.

### F12 — INFO — Cosmetic leftovers
`src/app/health/live/` and `src/app/health/ready/` remain as empty untracked
directories on disk (git cannot record empty directories, so the repository is
unaffected and the "no /health route" doc claim is true). Cleanup candidate
only.

## Verdict

**P50 satisfied: YES.**

All six runbook items are implemented as specified: redaction covers the full
runbook list with a non-vacuous output-level regression that passes; the help
page content is factually accurate against the real UI; the current-doc set is
updated with verified claims and a clean Docker sweep, with historical bodies
banner-labeled rather than rewritten; `ci.yml` reproduces the Final CI Sequence
exactly with correct gating, job-scoped permissions, preserved `pages`
concurrency and `github-pages` environment, and `deploy.yml` deleted and
staged; the audit was reviewed without forcing fixes (`next` still 16.3.2 in
package.json and lockfile) and the critical findings are correctly assessed as
out-of-scope or not runtime-applicable; the smoke record's sampled claims all
verify against the repository and its two environment caveats are plausible
and correctly ruled out as product defects. `format:check`, `lint`, and the
redaction regression all pass locally. No CRITICAL or MAJOR findings; the
only open acceptance item is the runbook's own post-merge step (branch
protection after the first real CI run), which cannot precede merge.

## Re-review (fix round 1) — 2026-09-26

Delta-scope re-verification of the six coordinator fixes applied after round 1
(targeting findings raised in the parallel review). Independence preserved:
review-A.md and verification-general.md were not read. All checks run on the
pinned toolchain (Node 24.19.0).

1. **logger.ts comment** — verified via `git diff --cached -- src/server/observability/logger.ts`.
   The comment now describes the URL-shaped redact paths as a *second layer*
   ("censored as a second layer for top-level keys — pino wildcards match one
   nesting level, so nested URL keys would slip through") and attributes the
   pathname-only invariant to the call site ("the only call site
   (src/server/http/route.ts) logs `path` from `nextUrl.pathname`"). Both claims
   independently verified: `src/server/http/route.ts:20-23` logs
   `path: request.nextUrl.pathname`, and a repo-wide grep confirms route.ts is
   the only importer of `@/server/observability/logger` in `src`. Accurate and
   no longer overclaiming.
2. **classes-screen.tsx copy** — the stale "O acesso numerado de jogadores será
   configurado em um próximo slice" is replaced with "Depois de criar a turma,
   adicione jogadores numerados e gere as credenciais na página da turma."
   Accuracy verified against the real UI: the class detail page renders
   `ClassDetailScreen` → `player-access-workflow.tsx`, which offers "Adicionar
   jogadores numerados" (line 145), "Criar e gerar QR" (line 173), and
   "Gerar novo QR" (line 252). The new sentence is factually correct.
3. **npm-audit-review.md** — new
   `docs/refactor-implementation-findings/p50/npm-audit-review.md` (20 lines)
   records the full disposition table: 7 production findings (1 critical,
   5 high, 1 moderate) + 1 dev-only. The windows-hosted Next.js RCE
   (GHSA-p293-qw3h-jr36) is correctly singled out as the single
   runtime-applicable item, with the fix (`next@16.3.6`) correctly identified
   as outside the pinned `16.3.2` range and recorded as a deliberate
   post-refactor owner action rather than an in-refactor change. Stance is
   consistent with the runbook's no-`audit-fix --force` rule and with the
   round-1 verdict.
4. **Full staging** — `git status --short` (run before this append) shows every
   entry with a column-1 status letter only: no unstaged modifications, no
   untracked files. `Dockerfile` and `.dockerignore` appear as staged
   deletions (`D `) in both the status output and `git diff --cached --stat`.
5. **health dirs** — `src/app/health` no longer exists on disk; the round-1
   cosmetic leftover (empty untracked `live/` and `ready/` directories) is
   resolved.
6. **README check row** — the Commands table row for `npm run check` reads
   "Format, lint, Prisma validation and generation, both typechecks, and one
   test run". Verified against `package.json`:
   `check = format:check && lint && prisma:validate && prisma:generate && typecheck && npm test`,
   where `typecheck = typecheck:server && typecheck:demo`. The row is accurate
   and now mentions Prisma generation.

Gate re-run: `npm run format:check` (pass), `npm run lint` with
`--max-warnings=0` (pass), `npx vitest run tests/unit/http.test.ts` —
4/4 tests passed.

Note: this appended section necessarily leaves one unstaged modification (this
report file); the nothing-unstaged verification in item 4 reflects the tree as
the coordinator staged it, before this append.

## Delta verdict

**Fixes hold; P50 remains satisfied: YES.** All six fixes are present, staged,
and factually accurate; no regressions introduced by the fix round; the
original round-1 INFO findings (branch-protection evidence outstanding by
design) remain the only open item, unchanged and post-merge by nature.
