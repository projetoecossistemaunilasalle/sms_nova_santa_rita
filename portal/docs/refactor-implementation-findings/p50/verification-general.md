# P50 Verification — General (security, documentation, CI/Pages, audit, smoke)

Date: 2026-09-26. Verifier: independent verification pass (verification-general).
Inputs: `docs/refactor-dossier/IMPLEMENTATION-READY.md` §P50 (read directly), the
working tree at verification time, `docs/refactor-implementation-findings/p50/manual-browser-smoke.md`
(coordinator's smoke record — reviewed for plausibility, browser work not redone),
and `docs/refactor-implementation-findings/p50/review-A.md` (prior independent review).

## Scope verified

### 1. Logger redaction — verified

`src/server/observability/logger.ts:3-44` extends `sensitivePaths` with:

- `cred` / `*.cred`, `launchToken` / `*.launchToken` (lines 23-26);
- `credential` / `*.credential`, `playerCredential` / `*.playerCredential`,
  `credentialHash` / `*.credentialHash`, `tokenHash` / `*.tokenHash` (lines 29-36) —
  raw player credential values and their SHA-256 hashes, flat plus one-level wildcard;
- URL-shaped keys censored outright: `url`, `href`, `req.url`, `request.url` (lines 40-43),
  with the comment explaining that call sites log pathname-only `path` and a full URL
  could carry `?cred=`.

Censor is `"[REDACTED]"`; the exported factory `createLogger(destination?)` (lines 46-59)
preserves singleton behavior via `export const logger = createLogger()` (line 61), and the
regression uses the factory with an injected stream rather than the singleton.

Regression — `tests/unit/http.test.ts:43-134`:

- Output-level: captures the pino destination through a `node:stream.Writable`
  (lines 48-56), joins the emitted lines (line 99), and asserts the sentinel
  `sentinel-credential-8f4c1d2e7b6a` never appears anywhere in the serialized output
  (`expect(output).not.toContain(sentinel)`, line 105) — not merely a config shape check.
- Structured input: sentinel under all six credential-shaped keys at top level
  (lines 62-67) plus nested `cred`/`launchToken`/`tokenHash` (lines 68-72); asserts the
  censor in each (lines 107-125).
- URL-shaped input: a full `/jogar/abc?cred=<sentinel>&next=…` logged under `url`
  (lines 78-85); asserts the whole `url` value is censored (line 131) while the
  pathname-only `path: "/jogar/abc"` entry survives (lines 87-93, 132).

Executed: `npx vitest run tests/unit/http.test.ts` → 4/4 passed (vitest 4.1.11, Node 24).

### 2. Help page — verified

`src/app/(professional)/portal/ajuda/page.tsx:7-43` defines seven topics covering all
five required areas: "Organizações e equipe", "Turmas e professores", "Jogadores
numerados", "Credenciais QR", "Sessões de turma", "Resultados e tempo ativo", and
"Perfis na demonstração". Spot-checked content claims against the real UI:

- "Trocar QR" + "O código atual deixará de funcionar. Descarte os cartões anteriores"
  → `player-access-workflow.tsx:255,274`; entry route `/jogar` exists on disk.
- "Perfil demonstrado" selector with Plataforma/Organização/Professor roles and
  "Restaurar demo" → `demo-role-controls.tsx:69,58-67,103`.
- Results claims ("organizados por turma e número de jogador", "aceitos pelo
  servidor", "Sem nomes ou dados pessoais de crianças") → `results-screen.tsx:54,83,143,183`.

`tsc --noEmit --incremental false` → exit 0, no errors.

### 3. Documentation — verified

Current docs (8): zero Docker mentions in `README.md`, `DESIGN.md`, `PRODUCT.md`,
`docs/current-architecture.md`, `docs/schemas/database-model.md`, `docs/schemas/README.md`,
`contracts/schemas/README.md`, `walkthrough.md` (raw `grep -i docker` → 0 hits).

- `README.md`: every command in the table exists in `package.json`; localStorage key
  `missoes-caramelito:adult-portal:v2` matches `src/runtime/adult-portal-demo-store.ts:138`;
  CI section correctly describes the single-workflow Pages folding; the two superseded
  planning docs are labeled "historical … not implementation guidance".
- `docs/current-architecture.md`: route table (lines 176-186) matches disk exactly —
  17 `page.tsx` files across `(professional)`/`(public-play)` plus the four
  `/api/v1/player/*` route handlers; the health claim is properly negated (line 188,
  "There is no `/health` route …") and no health route file exists in git (the empty
  untracked `src/app/health/{live,ready}` directories are local clutter only — see F3);
  `0_init` single baseline, the four surviving containers, the five `src/application/`
  areas, `scripts/next-target.mjs`, and `.env.example` all verified on disk.
- `docs/schemas/database-model.md` + `docs/schemas/README.md`: 12 tables and 5 enums
  match `prisma/schema.prisma`; `prisma/migrations/0_init/migration.sql` contains
  exactly 8 CHECK constraints (5 named ALTER TABLE + 3 inline) and 2 partial unique
  indexes, matching the dossier's release-check inventory.
- `contracts/schemas/README.md`: the contract index enumerates all 17
  `contracts/schemas/v1/*.schema.json` files present on disk.
- `walkthrough.md`: no `deploy.yml` references (grep → 0 hits); describes the folded
  `ci.yml` gate+deploy accurately; "Entrar na demonstração"
  (`entrar/page.tsx:69`), `generateStaticParams` in the four dynamic routes,
  `public/.nojekyll`, and the `next.config.ts` demo export flags all verified.

Historical docs (4): `docs/implementation/v1-architecture-plan.md`,
`docs/v1-game-integration-dossier.md`, `docs/demo-visual-plan.md`, root
`implementation_plan.md` all carry the historical/superseded banner. `git diff HEAD`
shows banner-only insertions for three of them; `docs/demo-visual-plan.md` additionally
removed one stale `Status:` line and fixed one now-false present-tense sentence
("atual"→"da época", "é"→"era") — see F2.

### 4. CI folding into ci.yml — verified

`.github/workflows/ci.yml` (the only file in `.github/workflows/`; `deploy.yml` is
deleted, staged `D`):

- Final CI Sequence exact order: checkout → pinned Node `24.19.0` → `npm ci` →
  `npm run clean:build` → `format:check` → `lint` → `prisma:validate` →
  `typecheck:server` → `build:server` → `npm test` (once, after the server build) →
  `typecheck:demo` → `build:demo` (lines 23-61).
- Gate builds the demo unconditionally; the `Upload Pages artifact` step
  (lines 66-70) is gated `github.event_name == 'push' && github.ref == 'refs/heads/main'`,
  uploading `./out`.
- Deploy job (lines 72-88): `needs: gate` + same push-to-main condition; top-level
  permissions are `contents: read` only; `pages: write` + `id-token: write` are scoped
  to the deploy job (lines 79-81); `environment: github-pages` with
  `url: ${{ steps.deployment.outputs.page_url }}` (lines 82-84); concurrency group
  `"pages"` with `cancel-in-progress: false` on the deploy job only (lines 76-78), so
  PR gate jobs are not serialized; `actions/deploy-pages@v4` consumes the artifact of
  the same run (no second workflow, no "latest" artifact search).
- CI-only placeholder env block retained on the gate job (lines 18-22): loopback
  `DATABASE_URL`/`NEON_AUTH_BASE_URL` and non-secret 32+ character placeholder
  `NEON_AUTH_COOKIE_SECRET`/`APPLICATION_SECRET`, with a comment stating no service is
  contacted during CI.

### 5. npm audit — run and corroborated; disposition not recorded in repo

- `/tmp/p50-audit-prod.log` and `/tmp/p50-audit-full.log` exist (dated 2026-09-26 22:57).
  Re-ran `npm audit --omit=dev` during verification → "7 vulnerabilities (1 moderate,
  5 high, 1 critical)" — exactly matching the prod log; the full log adds the dev-only
  `js-yaml` advisory (8 total).
- `package.json` pins `"next": "16.3.2"` and the lockfile resolves `next@16.3.2`; the
  `package.json` diff contains no dependency change for `next`, and the lockfile diff
  does not touch `next` — so no `npm audit fix --force` (or any fix) was applied.
- The audit log itself records the two owner-action facts: the fix for the critical
  `next` advisory "will install next@16.3.6, which is outside the stated dependency
  range" (prod log line 36), and the Windows-host-specific RCE + AVIF advisories
  (lines 31-37). Verified facts behind the applicability reasoning: `grep -rn
  "next/image\|<Image" src/` → 0 hits (AVIF optimizer RCE unreachable through product
  code), and `next.config.ts:15-31` sets `images: { unoptimized: true }` for the demo
  export only (server target keeps the optimizer endpoint enabled).
- Gap: this applicability review is not written anywhere in the repository (see F1).

### 6. Branch protection — owner action (pending by design)

Not evidence-checkable locally, per the runbook itself. The required-check name to hand
the administrator is `CI / gate` (job id `gate`, no `name:` override). Recorded here as
an outstanding owner action: after the first successful real CI run on `main`, make
`CI / gate` required and record the run URL and the resulting branch-protection setting.

### 7. Manual browser smoke record — plausible; code/CSS claims corroborated

`manual-browser-smoke.md` checked for factual consistency (browser work not redone):

- Compiled CSS `out/_next/static/chunks/2a1hz6gj3zzgw.css` contains the quoted
  `@media print` block verbatim: `body>*{visibility:hidden}` (portal chrome hidden),
  `.printSheet:not([data-player-print-active]){display:none}` (ordinary print does not
  reveal the hidden sheet), and `.printSheet{…grid-template-columns:repeat(2,minmax(0,1fr))…}`
  (QR cards in two columns), with `.printSheet`/descendants forced back to
  `visibility:visible` inside print.
- Code anchors: `data-player-print-active` toggle at
  `player-credential-print-sheet.tsx:99-104`; "DEMONSTRAÇÃO • SEM VALIDADE EM
  PRODUÇÃO" at `:139`; "Sair do portal" at `portal-shell.tsx:62,71`; "Este QR não foi
  reconhecido" at `player-entry-screen.tsx:22`; "Jogo pronto" at
  `game-host-chrome.tsx:15`; cross-tab `storage` listener at `use-demo-portal.ts:15`;
  seed fallback on invalid state (`isValidDemoAdultPortalState` + `cloneSeed`) at
  `adult-portal-demo-store.ts:377,399-406` — matching the record's corruption-shape
  claim.
- The two environment caveats (rAF never firing in the in-app browser; per-tab
  localStorage isolation making the two-tab check untestable there) are honestly
  dispositioned as environment findings with code-backed explanations, consistent with
  the mechanisms in the tree. The one product-side observation (stale "próximo slice"
  copy on the class screen) matches `review-A.md` M2 and is outside the P50 work list.

## Findings

| # | Severity | Location | Finding | Status |
| --- | --- | --- | --- | --- |
| F1 | Minor | repo-wide (no record); logs at `/tmp/p50-audit-{prod,full}.log` | The runbook item 5 applicability review (Windows-host RCE = owner action; AVIF RCE unreachable via product code — 0 `next/image` imports — but the optimizer endpoint is not disabled on the server target; `next@16.3.6` bump outside pinned range = owner decision; remaining advisories in the build/dev chain) exists only in the coordinator's notes and the /tmp logs, not in the repository. Confirms review-A M3. `npm audit` itself was run and no forced fix occurred (verified against `package.json`/`package-lock.json` and by re-run). | Confirmed |
| F2 | Info | `docs/demo-visual-plan.md` | Diff is not strictly banner-only: one stale `Status:` line removed and one present-tense sentence changed to past tense. Sanctioned by the runbook's "correct current claims or label them historical"; bodies otherwise untouched; all four historical docs are labeled. | Confirmed (justified deviation) |
| F3 | Info | `src/app/health/{live,ready}` | Empty untracked directories left on disk from the deleted health routes; git cannot track them and `docs/current-architecture.md:188` ("no `/health` route") is accurate for any fresh clone. Local clutter only. | Confirmed |
| F4 | Info (watch) | `.github/workflows/ci.yml:66-70` vs `:8-9` | The gate job's `upload-pages-artifact@v3` (which internally calls `actions/upload-artifact@v4`) runs under the top-level `permissions: contents: read`. The scoping matches the runbook's wording (Pages/OIDC confined to the deploy job), but the official Pages starter instead keeps `pages: write` at top level where the upload step inherits it. If the first real run 403s at the upload step, the minimal fix is a scoped `actions: write` on the gate job's upload step. Validated anyway by the item-6 first CI run. | Unverifiable locally (watch item) |
| F5 | Info | P50 item 6 | Branch protection is pending the first successful real CI run, as designed: make `CI / gate` required on `main` and record the run URL + resulting setting. Cannot be evidenced from local workflow text. | Confirmed (pending owner action) |
| F6 | Info (nit) | `README.md` "CI and deployment" paragraph | Lists gate contents as "…the server build, the demo build, and the unit tests" while the actual order interleaves `npm test` between the server and demo legs. Summary wording, not a factual error; the authoritative order is the dossier's Final CI Sequence and ci.yml itself. | Confirmed (non-issue) |

False-alarm checks that came back clean: no Docker presented as supported anywhere in
the eight current docs (0 grep hits); no health-route existence claim remains in
`docs/current-architecture.md` (the single mention is the correct negation); no
`deploy.yml` references remain in `walkthrough.md`; the contract index, route table,
Prisma model/enum inventory, CHECK/partial-index counts, and package.json commands all
match disk exactly; logger wildcard depth (`*.key`, one level) satisfies the "flat +
wildcard" requirement and the URL-key censoring exceeds the pathname-only requirement.

## Verdict

**P50 satisfied: yes**, with one record-keeping action and one first-run confirmation:

1. Close F1 by recording the npm audit applicability disposition in the repository
   (a short note under `docs/refactor-implementation-findings/p50/` suffices: owner
   actions for the `next` criticals, the server-target optimizer nuance, and the
   explicit no-forced-fix statement).
2. F4 and F5 resolve at the first real CI run on `main` (already required for the
   branch-protection handoff).

All six runbook items are implemented and evidenced — redaction plus a non-vacuous
output-level regression (4/4 tests pass, `tsc` clean), a help page matching the real
UI, eight accurate current documents and four labeled historical documents with no
Docker-as-supported anywhere, a correct single-workflow Pages folding with the exact
Final CI Sequence, `deploy.yml` deleted, no forced audit fix (`next` still 16.3.2),
and a smoke record whose every code/CSS claim I checked is accurate.

### Reference sources for F4 permission research

- [actions/upload-pages-artifact v3 action.yml](https://github.com/actions/upload-pages-artifact/blob/v3/action.yml) — internal upload via `actions/upload-artifact@v4`, no permissions declared.
- [GitHub Pages static starter workflow](https://github.com/actions/starter-workflows/blob/main/pages/static.yml) — top-level `contents: read, pages: write, id-token: write` with the upload step in the same scope.
- [GitHub Docs: automatic token authentication](https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication) — artifact-upload permission guidance.
- [actions/deploy-pages failing with HttpError (GitHub issue)](https://github.com/actions/deploy-pages/issues/89) — permission context for Pages artifact flows.
