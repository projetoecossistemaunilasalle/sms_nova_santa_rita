# P50 Review A — Security, Documentation, Deployment, Acceptance

Reviewer A, independent (did not read `review-B.md` or `verification-general.md`).
Date: 2026-09-26. Spec: `docs/refactor-dossier/IMPLEMENTATION-READY.md` §P50
(items 1–6, Final CI Sequence, Manual Browser Smoke).

## Scope reviewed

- `src/server/observability/logger.ts` (redaction extension + `createLogger` factory)
- `tests/unit/http.test.ts` (output-level redaction regression)
- `src/app/(professional)/portal/ajuda/page.tsx` (help content)
- `.github/workflows/ci.yml` (Pages fold, final sequence) and deleted `.github/workflows/deploy.yml`
- Docs: `README.md`, `DESIGN.md`, `PRODUCT.md`, `docs/current-architecture.md`,
  `docs/schemas/README.md`, `docs/schemas/database-model.md`, `contracts/schemas/README.md`,
  `walkthrough.md`; historical banners on `docs/implementation/v1-architecture-plan.md`,
  `docs/v1-game-integration-dossier.md`, `implementation_plan.md`, `docs/demo-visual-plan.md`
- Docker sweep across the repository
- `npm audit` state (no forced fix) and dependency lockfile
- `docs/refactor-implementation-findings/p50/manual-browser-smoke.md` (sampled claims)

## Verification commands and results

| Command | Result |
| --- | --- |
| `npx vitest run tests/unit/http.test.ts` | PASS — 4/4 (`logger redaction` case green) |
| `npm run format:check` | PASS — "All matched files use Prettier code style!" |
| `npm run lint` | PASS — `eslint . --max-warnings=0`, no output |
| `npm audit` (read-only) | 8 vulns (1 critical): `next 16.0.0–16.3.2` (2 critical), `sharp`, `js-yaml`, `mysql2`, `prisma` chain |
| pino redact semantics probe (isolated script, no repo file touched) | `url`/`href` redact **top level only**; sentinel leaks without the paths |
| `prisma validate` in a scratch dir with no `.env` and no `DIRECT_URL` | PASS ("The schema at prisma\schema.prisma is valid") — CI `prisma:validate` step is safe |
| YAML parse of `.github/workflows/ci.yml` (python `yaml.safe_load`) | Valid; job/step structure as intended |
| `git status --porcelain -- Dockerfile .dockerignore .github/` | ` D .dockerignore`, `A  ci.yml`, `D  deploy.yml`, ` D Dockerfile` |

## Findings

### MAJOR
None.

### MINOR

**M1 — `url`/`href` redaction is a shallow backstop; the pathname-only invariant is
actually enforced only at the one call site.**
`src/server/observability/logger.ts:36-41` adds `"url"`, `"href"`, `"req.url"`,
`"request.url"`. fast-redact applies non-wildcard paths at the top level only. Probe:

```
WITH url+href+*.cred: {"url":"[R]","href":"[R]","a":{"url":"/c?cred=SENT","cred":"[R]"},"deep":{"x":{"cred":"SENT"}},...}
```

So `{ a: { url } }` is not censored, and a credential embedded in a non-URL-shaped
string field (`path`, `target`, free text) is never censored. The real guarantee comes
from `src/server/http/route.ts:20-24`, which logs `path: request.nextUrl.pathname` —
that is the only production log call site in `src/` (verified: `grep -rn "logger" src/`
returns only `route.ts` and the logger module itself). Runbook item 1 is therefore
satisfied, but the comment ("any URL-shaped key is censored outright") overstates what
the paths do. Question, not a functional defect. No existing field is broken by it:
production logs `correlationId`, `method`, `path`, `status`, `errorCode`, `err` — none
collide with the redact list.

**M2 — Known-false statement left on a live screen next to the implemented feature.**
`src/components/portal/classes-screen.tsx:84-88` (org-admin "Nova turma" panel) still
says "O acesso numerado de jogadores será configurado em um próximo slice", while
numbered players, sessions and QR credentials are fully implemented
(`src/application/player-access/service.ts`, `src/components/portal/player-access-workflow.tsx`)
and documented as current in `docs/schemas/database-model.md`. The implementer recorded
this in `docs/refactor-implementation-findings/p50/manual-browser-smoke.md:43-45` and
deferred it as outside the runbook's P50 list. Confirmed fact, defensible scope call
(P50 item 2 names only the help page), but it is a user-facing false claim on a portal
screen and the P50 help page now says the opposite ("Jogadores numerados … a entrada em
/jogar"). Cheap to fix in the same pass.

**M3 — `npm audit` applicability reasoning is unrecorded, and the AVIF dismissal is
incomplete for the server target.**
Runbook item 5 asks for a review of applicable findings; no record of that review exists
in the repository (`grep -rn "npm audit\|16.3.6\|GHSA" docs/refactor-implementation-findings/`
→ only `manual-browser-smoke.md`, which does not mention it; repo-wide only the runbook
itself). No forced fix did happen — confirmed: `package.json:39` pins `"next": "16.3.2"`
and `package-lock.json:11058` resolves `next@16.3.2`; the only lockfile content change is
the `fake-indexeddb` devDependency plus removal of `dev: true` markers on optional platform
binaries. "Windows-hosted RCE = owner action" is sound (advisory is Windows-host specific).
"No `next/image`" is only half the argument: `next.config.ts:22-31` sets
`images: { unoptimized: true }` for the **demo export only**; the server target
(`next.config.ts:41`) leaves Image Optimization at its default, so the optimizer stays
available on the deployed standalone server even though no component imports
`next/image` (verified: `grep -rn "next/image\|<Image" src/` → 0 hits). The AVIF
advisory should be recorded as "not reachable through product code, endpoint not
disabled on the server target — owner decision on a 16.3.6 bump" rather than dismissed.

### INFO

**I1 — Commit-hygiene asymmetry.** `.github/workflows/ci.yml` is staged (`A`) and the
`deploy.yml` deletion is staged (`D`), so the workflow and its removal land together —
this is what the task asked to confirm, and it holds. However, the P00 deletions
(`Dockerfile`, `.dockerignore`) are still **unstaged** (` D`). A plain `git commit` would
publish `ci.yml` while leaving a `Dockerfile` in the tree, re-introducing the thing P00
removed. Use `git commit -a` or stage those two explicitly.

**I2 — Runbook item 6 is unavoidably pending and unrecorded.** The exact required-check
name to hand the administrator is the job id `gate` (no `name:` override), shown as
`CI / gate`. No in-repo note states that the branch-protection handoff is outstanding.
The runbook explicitly says local workflow text is not evidence that protection is active,
so this cannot be closed before the first real run; it should at least be tracked.

**I3 — Manual re-deploy path lost.** The deleted `deploy.yml` had `workflow_dispatch`;
`ci.yml` triggers only on `pull_request` and `push` to `main`, so a Pages rollback by
re-running the old workflow is no longer possible from the Actions UI. This follows the
runbook ("Delete the independent push-triggered `deploy.yml`") and the documented rollback
is redeploying the last artifact, so it is consistent — just worth knowing.

**I4 — Residual empty `src/app/health/{live,ready}` directories on disk.**
`docs/current-architecture.md` states "There is no `/health` route". Confirmed for the
repository: `git ls-tree -r HEAD | grep -i health` and `git ls-files | grep -i health` both
return nothing, so a fresh clone has no such route and no route file exists locally
(the directories are empty leftovers git cannot track). The claim is accurate; the
directories are just clutter.

**I5 — Unreachable `ended` entry state (pre-existing, out of P50 scope).**
`src/components/public/player-entry-screen.tsx:38-43` and
`src/components/public/game-host-model.ts:54-56` handle a `ended` state, but
`resolveEntry` in `src/application/player-access/service.ts:125-160` only ever returns
`invalid | revoked | inactive | waiting | ready`. After a session ends a valid player sees
the "A turma ainda está se preparando" waiting screen. The new help copy
("depois do encerramento, novas entradas deixam de ser aceitas") stays literally true,
so no P50 finding.

**I6 — Help copy in demo mode.** "Resultados e tempo ativo são registrados pelo jogo e
aceitos pelo servidor" is rendered in the demo export too, where there is no server. The
topic is a platform-truth description and the page separately states that demo data lives
only in the browser, so it is not a false promise, but the sentence is the only one that
is not mode-qualified.

**I7 — `README.md` command table omits `prisma:generate`.** The `npm run check` row says
"Format, lint, Prisma validation, both typechecks, and one test run";
`package.json:33` also runs `prisma:generate`. Incomplete row, not a wrong one.

## Claims verified (spot checks)

Logger:
- Runbook list is complete for the real field names in the code: `cred`
  (`src/components/public/player-entry-credential.ts:17` reads `url.searchParams.getAll("cred")`),
  `launchToken` (`src/application/player-access/types.ts:83`, `src/components/public/game-host.tsx:77`),
  `tokenHash` (`src/application/player-access/ports.ts:16`), and `credential`
  (`src/application/player-access/service.ts:102` returns `credential: issued.token`).
- The regression is **not vacuous**: with the redact paths removed, the sentinel appears in
  the serialized output; the test also asserts per-key `[REDACTED]` at top level and nested,
  and asserts the pathname-only child entry (`path: "/jogar/abc"`) still survives.
- No production log field is broken: the single call site logs `path` (pathname), never
  `url`/`href`.

Help page (all labels and behaviors exist in the UI):
- "Trocar QR" — `player-access-workflow.tsx:255`; "Criar e gerar QR" — line 173;
  "Perfil demonstrado" / "Restaurar demo" — `demo-role-controls.tsx:69,103`.
- "Trocar QR … o código anterior deixa de funcionar imediatamente":
  `adult-portal-demo-store.ts:941-947` revokes the active row, and `resolveEntry`
  returns `revoked` for revoked credentials; plus the partial unique index
  `player_credentials_one_active_per_slot` (`prisma/migrations/0_init/migration.sql:288`).
- "números … nunca são reutilizados": monotonic `classGroup.nextPlayerNumber`
  (`adult-portal-demo-store.ts:898-900`, `prisma/schema.prisma:98`) with
  `@@unique([classGroupId, playerNumber])`.
- "Jogador 01, Jogador 02": `player-access-workflow.tsx:52-53` pads to 2 digits.
- "A entrada do jogador acontece em /jogar": `player-credential-print-sheet.tsx:22-24`
  builds `${basePath}/jogar/?cred=<token>`.
- "tela de espera" / "novas entradas deixam de ser aceitas": `waiting` state in
  `service.ts:145-151` and `player-entry-screen.tsx:113-137`.
- "Administradores da plataforma criam organizações": `canManageOrganizations` requires
  `PLATFORM_ADMIN` (`src/server/authorization/v1-policy.ts:46-53`); "Professores enxergam
  apenas as turmas ativas atribuídas": `canAccessClass` + `teacher_assignments`.
- All seven icon names are members of `IconName` (`src/components/shared/icon.tsx:3-40`);
  removing the "Abrir orientação" span left no dead CSS (`.textLink` still used by
  `overview-screen.tsx`, `organization-detail-screen.tsx`).

Docs (five concrete claims):
1. `README.md:88-96` "npm run start — Build and start the standalone server via
   `scripts/start.mjs`" — `scripts/start.mjs:29` runs `npm run build` first, then launches
   `.next/standalone/server.js`. True.
2. `README.md:64-68` "`missoes-caramelito:adult-portal:v2`" —
   `src/runtime/adult-portal-demo-store.ts:138`. True.
3. `README.md:117-124` "`.github/workflows/ci.yml` is the only workflow … on pushes to
   `main`, the same workflow uploads the export and deploys it" — `.github/workflows/`
   contains only `ci.yml`; `git status` shows `deploy.yml` deleted. True.
4. `docs/schemas/database-model.md` "ten named database rules" table — matches
   `prisma/migrations/0_init/migration.sql:277-289` exactly: eight CHECK constraints
   (`player_slots_player_number_positive`, `game_states_revision_check`,
   `game_states_protocol_version_check`, `game_states_schema_version_check`,
   `result_events_duration_ms_check`, `result_events_result_state_check`,
   `active_time_events_active_ms_check`, `active_time_events_mode_check`) plus two partial
   unique indexes (`player_credentials_one_active_per_slot`,
   `game_sessions_one_active_per_class`). Also true: "every foreign key is
   `ON DELETE RESTRICT`" (13 of 13 `ON DELETE` clauses are `RESTRICT`) and the index
   claims (`result_events_activity_id_received_at_idx` etc.).
5. `docs/current-architecture.md` route table + "five implementation files" carrying
   `"use server"` — routes match `src/app/**` exactly (12 portal pages, 4 API handlers,
   `/jogar`); the five files are `entrar/actions.ts`, `portal/sign-out-action.ts`,
   `portal/adult-portal-actions.ts`, `portal/player-access-actions.ts`,
   `public-play/jogar/actions.ts` (the Turbopack constraint is documented at
   `scripts/next-target.mjs:82-87`).
   `contracts/schemas/README.md` "Contract index" lists 17 schemas and
   `contracts/schemas/v1/` contains exactly those 17; `../fixtures/v1` and
   `src/contracts/v1` exist.
   `DESIGN.md` layout numbers (248px sidebar, 76px topbar, 1120px and 900px breakpoints,
   five mobile nav destinations) all match `src/components/portal/portal.module.css`
   (lines 13, 235, 1197, 1215, and `grid-template-columns: repeat(5, …)` in the ≤900px
   `.navigation` rule). `PRODUCT.md`'s "Materials area has been removed" and removal of
   the audit bullet are true (`grep -rn "Materiais" src/` → 0; no `audit` model in
   `prisma/schema.prisma`). `walkthrough.md`'s health-route removal and static route list
   match the four `generateStaticParams` call sites.

Historical banners: `docs/implementation/v1-architecture-plan.md`, `docs/v1-game-integration-dossier.md`
and `implementation_plan.md` receive a blockquote only — bodies byte-identical below the
banner. `docs/demo-visual-plan.md` also changes one line of body prose
("do portal profissional **atual**" → "**da época**") to remove a present-tense claim;
that is the "correct current claims" branch of runbook item 3, not a body rewrite.

Docker sweep: no current document presents Docker as supported. Remaining hits are in
`portal-v1-specification.md:256` (README labels it "historical research only"),
`docs/architecture-audit-2026-09-23.md`, `docs/agent-reviews/**`, `docs/refactor-dossier/**`
(the runbook's own prohibition), and `docs/implementation/phase-01-foundation-contracts.md:36`
— that file already opens with a "Legacy detailed plan" banner (line 3) and is outside the
P50 review list. `Dockerfile` and `.dockerignore` are deleted in the working tree (see I1).

CI (`ci.yml`, 89 lines) versus the runbook:
- Final CI Sequence step-for-step: checkout → setup-node pinned `24.19.0` + npm cache →
  `npm ci` → `npm run clean:build` → `format:check` → `lint` → `prisma:validate` →
  `typecheck:server` → `build:server` → `npm test` (once) → `typecheck:demo` → `build:demo`.
  Exact match, no duplicated test/contract legs, no route inventories, no parser fixtures.
- Pages fold: the upload step is `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`,
  so pull requests run the full gate and never upload; `deploy` has `needs: gate` plus the
  same condition, uses `actions/deploy-pages@v4` (consumes the uploaded artifact), and
  carries job-scoped `permissions: {pages: write, id-token: write}` only — the workflow-level
  `contents: read` does not leak into it. `concurrency: {group: "pages", cancel-in-progress: false}`
  is on the **deploy job**, so PR gate runs are not serialized. `environment: github-pages`
  with `url: ${{ steps.deployment.outputs.page_url }}` preserved from the deleted workflow.
- Gating is not vacuous: the demo is built exactly once and the artifact is produced by
  the same job that must pass the whole gate.
- The job-level `env` block is complete against `serverRuntimeEnvSchema`
  (`src/server/config/env.ts:62-79`): only the four variables are required; `ALLOWED_ORIGINS`,
  `LOG_LEVEL`, `READINESS_TIMEOUT_MS` have defaults. Values are self-described non-secret
  placeholders; no repository secret is referenced, so fork PRs are safe.
- One thing I could not execute here: a real GitHub Actions run. The sequence is
  consistent with the local chain and the `prisma validate` step was reproduced in an
  env-free scratch directory, but first-run Pages behavior (source = "GitHub Actions",
  artifact upload naming) remains unproven until the first push — as the runbook itself
  requires for item 6.

Smoke record spot checks:
- All three print claims are literally in the built export:
  `out/_next/static/chunks/2a1hz6gj3zzgw.css` contains
  `@media print{body>*{visibility:hidden}…printSheet:not([data-player-print-active]){display:none}…printSheet{…grid-template-columns:repeat(2,minmax(0,1fr))…}}`,
  matching `src/components/portal/portal.module.css:2404-2428` and the
  `data-player-print-active` toggle at `player-credential-print-sheet.tsx:99-104`.
  The sheet header "DEMONSTRAÇÃO • SEM VALIDADE EM PRODUÇÃO" is at line 139 of that file.
- Cross-tab mechanism: `src/components/portal/use-demo-portal.ts:11-19` calls
  `sync()` on mount, on `adult-portal-demo-change`, and on `storage`; the only change in
  this refactor is the import path (`@runtime/adult-portal-client` → `@runtime/client`).
  So the two-tab NOT-TESTABLE entry is an environment limitation, not a regression.
- Seed fallback: `readDemoAdultPortalState` (`adult-portal-demo-store.ts:398-407`) falls
  back to `cloneSeed()` on JSON parse failure **and** when `isValidDemoAdultPortalState`
  rejects the payload, which requires `version === 2` and well-formed collection arrays —
  exactly the corruption shape the smoke injected. The claim holds.
- Environment caveats: the rAF caveat is plausible and correctly dispositioned (React 19
  streamed content needs `requestAnimationFrame`; a headless/in-app Chromium that suspends
  rAF leaves Suspense fallbacks visible; the mitigation the record describes — comparing
  against the pre-refactor deployment and an rAF shim — is a reasonable way to exclude a
  product cause). The per-tab localStorage isolation is likewise a known in-app-browser
  behavior, not something the product controls. Neither is ruled out *by me* with
  first-hand evidence (I did not drive the browser), but both are consistent with the code
  I verified, and the record is honest about what was and was not exercised.
- One genuine product-side observation in the record (M2) is real, and the "click
  interception times out" note is consistent with a headless-event-dispatch limitation.

## Verdict

**P50 satisfied: yes.**

All six runbook items are implemented and verifiable: redaction covers the listed
credential fields with a non-vacuous output-level regression; HTTP logs remain
pathname-only at the single call site; the help page content matches the real UI with no
false promises (the one weak sentence is I6); the eight current documents are accurate
against the repository on every spot check I ran and none presents Docker as supported;
Pages publication is folded into `ci.yml` with the exact Final CI Sequence, PR-safe
gating, job-scoped Pages/OIDC permissions, job-level `pages` concurrency, the preserved
`github-pages` environment, and `deploy.yml` deleted and staged alongside it; no forced
audit fix occurred (`next` remains 16.3.2 in `package.json` and the lockfile).

No BLOCKER or MAJOR findings. The MINOR items are: a comment/redaction-depth overstatement
(M1), one known-false sentence left on a live portal screen and correctly recorded in the
smoke notes (M2), and an unrecorded `npm audit` disposition whose AVIF dismissal is
incomplete for the server target (M3). I1 (unstaged `Dockerfile`/`.dockerignore`
deletions) is the one item I would fix before committing.
