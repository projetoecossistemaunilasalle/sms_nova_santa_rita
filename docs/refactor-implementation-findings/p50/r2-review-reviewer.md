# P50 Review — Security, Documentation, Deployment, and Acceptance (Round 2, Static Spec-Compliance)

**Phase:** P50
**Date:** 2026-09-27
**Base commit:** `9467757` (HEAD; inspected checkout `780b0a8` referenced by the runbook)
**Authority:** `docs/refactor-dossier/IMPLEMENTATION-READY.md` — "Scope and Fixed Decisions" (1–8), "P50: Security, Documentation, Deployment, and Acceptance" (items 1–6), "Final CI Sequence", "Manual Browser Smoke", "Database and Rollback"
**Method:** read-only static analysis of the staged working tree (`git status --short`, `git diff --cached`, `git show 9467757:<path>`, `git ls-tree`), `rg`/`ls` sweeps, and source reading. No builds, tests, npm, or browser commands were run; no files were modified. Nothing under `docs/refactor-implementation-findings/` was read.
**Toolchain observed:** Node `24.19.0` pinned in `package.json:5` and `.nvmrc`; npm `>=11.6.0 <12` (`package.json:6-7`), `packageManager: npm@11.6.0`; Next `16.3.2`; Prisma `7.9.1`; TypeScript `6.0.3`; Vitest `4.1.11`; pino `10.3.1`; zod `4.4.3`; React `19.2.8`.

---

## 1. Per-item verification table

| # | Requirement | Evidence | Satisfied |
|---|---|---|---|
| 1a | Extend logger redaction for `cred` | `src/server/observability/logger.ts:23-24` (`"cred"`, `"*.cred"`) | yes |
| 1b | …for `launchToken` | `src/server/observability/logger.ts:25-26` | yes |
| 1c | …for player credential values | `src/server/observability/logger.ts:29-32` (`credential`, `playerCredential`) matching `IssuedPlayerSlotDto.credential` (`src/application/player-access/types.ts:23`) and `CredentialMaterial.token` (`src/application/player-access/ports.ts:14-17`) | yes |
| 1d | …for credential hashes | `src/server/observability/logger.ts:33-36` (`credentialHash`, `tokenHash`) matching `CredentialMaterial.tokenHash` / `NewSlotCredential.tokenHash` (`ports.ts:16,24`) | yes |
| 1e | HTTP logs carry pathname, not full URL | `src/server/http/route.ts:20-24` — `logger.child({ correlationId, method, path: request.nextUrl.pathname })`; the **only** HTTP logging site in the tree. Identical to base — no regression introduced. | yes |
| 1f | One **output-level** regression, structured input | `tests/unit/http.test.ts:48-57` builds a logger over a real `Writable` capture stream via `createLogger`; `:99-105` asserts the serialized concatenation never contains the sentinel; `:108-125` asserts each key equals the censor at top level and nested | yes |
| 1g | …URL-shaped input | `tests/unit/http.test.ts:77-85` logs `url: /jogar/abc?cred=${sentinel}…`; `:104-105` proves the sentinel is absent; `:128-131` asserts the whole `url` is the censor; `:87-93,132` separately prove the pathname-only convention still emits `path: "/jogar/abc"` | yes |
| 1h | Exactly one regression added | Only `tests/unit/http.test.ts` is modified among test files for this purpose; no new logger test file exists | yes |
| 2a | Help page polished for organizations/classes/players/credentials/results | `src/app/(professional)/portal/ajuda/page.tsx:8-42` — seven topics: Organizações e equipe, Turmas e professores, Jogadores numerados, Credenciais QR, Sessões de turma, Resultados e tempo ativo, Perfis na demonstração | yes |
| 2b | Describes only surviving features (post-P10 factual cleanup) | Diff removes all Generation-A topics ("Links de acesso", "Acesso anônimo", "Status e validade", "Resultados coletivos") and the dead `Abrir orientação` affordance | yes |
| 2c | Accurate against actual portal screens | See content-accuracy table below | yes |
| 2d | No unit test added for it | No test file references the help page | yes |
| 3a | `README.md` updated, no Docker | 0 Docker hits; substantive rewrite (structure, commands table, runtime targets, CI/deployment section) | yes |
| 3b | `DESIGN.md` updated, no Docker | Only hit is the false positive "Cards / Containers" heading (`DESIGN.md:309`); link/atividade→credencial/jogador corrections applied | yes |
| 3c | `PRODUCT.md` updated, no Docker | 0 Docker hits; authority pointers, Materials status, removed audit/traceability bullets | yes |
| 3d | `docs/current-architecture.md` updated, no Docker | 3 hits, all the DI sense ("service containers", `:268-270`) — no container-build claim; route table, runtime targets/entries, runtime configuration, implementation status all rewritten | yes |
| 3e | `docs/schemas/database-model.md` updated, no Docker | 0 hits; schema reconciled to the surviving model | yes |
| 3f | `docs/schemas/README.md` updated, no Docker | 0 hits; deleted-artifact references removed | yes |
| 3g | `contracts/schemas/README.md` updated, no Docker | 0 hits; contract index added | yes |
| 3h | `walkthrough.md` updated, no Docker | 0 hits; stale `/atividade/7FQ-29M/` demo link removed, dead route lists removed, CI/Pages text rewritten | yes |
| 3i | `docs/implementation/v1-architecture-plan.md` labeled historical | Banner at `:3-10` | yes |
| 3j | `docs/v1-game-integration-dossier.md` labeled historical | Banner at `:3-9` | yes |
| 3k | `docs/demo-visual-plan.md` labeled historical | Banner at `:3-6`; also reframed tense at `:8` | yes |
| 3l | `implementation_plan.md` labeled historical | Banner at `:3-9` (the stale `deploy.yml` instruction at `:75` is now under that banner) | yes |
| 3m | No documentation-structure tests | No test reads `.md` | yes |
| 4 | Pages folded into `ci.yml` | See dedicated CI/Pages table | yes |
| 5 | `npm audit` run and reviewed | Not executable in this pass; `docs/refactor-implementation-findings/p50/npm-audit-review.md` is staged; no `audit fix --force` in any script or workflow. **Covered by the dynamic pass.** | dynamic |
| 6 | Branch protection via real CI run + administrator | Inherently not verifiable from the tree. Nothing contradicts it; gate job name recorded below. | not statically verifiable |
| 7 | Final CI Sequence exact conformance | See dedicated CI/Pages table, rows F1–F6 | yes |
| 8 | No route/action inventories, workflow-parser fixtures, deliberate-failure fixtures, CSS/size baselines, duplicated serial/contract legs | See sweep below | yes |
| 9 | Manual Browser Smoke statically supported | See readiness table below (execution out of scope) | yes (static only) |

---

## 2. Dedicated CI / Pages verification table

Base for comparison: `git show 9467757:.github/workflows/deploy.yml` (the base commit had **no** `ci.yml`; `git ls-tree -r 9467757 -- .github` → `deploy.yml` only).

| Required property | Evidence in `.github/workflows/ci.yml` | Satisfied |
|---|---|---|
| Gate job builds the demo **once** | `:60-61` `Build demo` → `npm run build:demo`, single unconditional step in `gate`; no other `build:demo` in the file | yes |
| Upload `out` only on **successful push to `main`** | `:66-70` step `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, inside `gate`, `uses: actions/upload-pages-artifact@v3`, `path: ./out` | yes |
| Dependent deploy job uses that artifact | `:74 needs: gate`, `:86-88` `actions/deploy-pages@v4` with no inputs (defaults to the same-run `github-pages` artifact; no rebuild) | yes |
| Pages/OIDC permissions **scoped to that job** | `:79-81` `permissions: pages: write` / `id-token: write` on `deploy` only; `:8-9` workflow-level `contents: read` applies to `gate` | yes |
| `github-pages` environment preserved | `:82-83 name: github-pages` (base `deploy.yml:43`) | yes |
| Deployment URL preserved | `:84 url: ${{ steps.deployment.outputs.page_url }}` with `id: deployment` at `:87` (base `deploy.yml:44,49`) | yes |
| `pages` concurrency group on the **deploy** job | `:76-78` job-level `concurrency: group: "pages"` / `cancel-in-progress: false` — identical to base `deploy.yml:13-15`, now scoped to `deploy` instead of the whole workflow | yes |
| PR gate jobs not serialized | `gate` carries no `concurrency:` key; the group exists only on `deploy` (`:76-78`) | yes |
| Independent push-triggered `deploy.yml` deleted | `git status --short` → `D  .github/workflows/deploy.yml`; only `ci.yml` remains | yes |
| No rebuild or "latest"-artifact search in a second workflow | `deploy` job has exactly one step, `actions/deploy-pages@v4`; no `checkout`, no `setup-node`, no `npm ci`, no `build:demo`; only one workflow file exists | yes |
| Node pinned | `:30 node-version: "24.19.0"` matching `package.json:5` / `.nvmrc` | yes |
| Trigger set | `:3-6 pull_request` + `push: branches: ["main"]` | yes |
| Gate runs on PRs (so it can be a required check) | `gate` has no `if:`; runs on every trigger | yes |

### Final CI Sequence conformance (runbook "Final CI Sequence", 1–6)

| Runbook step | ci.yml | Order |
|---|---|---|
| 1. checkout, pinned Node, `npm ci`, `clean:build` | `:24-25`, `:27-31`, `:33-34`, `:36-37` | exact |
| 2. `format:check`, `lint`, `prisma:validate` | `:39-40`, `:42-43`, `:45-46` | exact |
| 3. `typecheck:server`, then `build:server` | `:48-49`, `:51-52` | exact |
| 4. `npm test` once (prepares demo entries) | `:54-55`; one `vitest run`, no serial variant, no `test:contracts` leg | exact |
| 5. `typecheck:demo`, then `build:demo` | `:57-58`, `:60-61` | exact |
| 6. On successful `main` push only: upload `out` + deploy in the dependent Pages job | `:66-70` (upload) and `:72-88` (dependent `deploy`, `needs: gate`, same `if`) | exact |

**Branch-protection job name:** the gate job is `gate` with no `name:` key (`ci.yml:12`), so the GitHub check-run name is exactly **`gate`**. The `deploy` job name is `deploy` and only appears on `main` pushes, so it is not a candidate required check.

---

## 3. Findings

### CRITICAL
None.

### MAJOR
None (static pass). The dynamic pass's `npm audit` finding on `next@16.3.2` is recorded in `r2-review-general.md`.

### MINOR

**M-1 — A live-sounding container instruction survives in a "superseded" doc whose banner does not name it.**
`docs/implementation/phase-01-foundation-contracts.md:36` still reads "Create a production multi-stage Dockerfile that runs as a non-root user." The file's banner (`:3-6`) does not mention Docker, and `docs/implementation/README.md:56-62` lists the file under "Superseded plans … Do not implement tasks from those files." Fixed Decision 8 forbids adding "Docker-specific documentation," and `Dockerfile`/`.dockerignore` are correctly staged as deleted, so no live claim survives in the P50 doc set — but this is the one remaining task line a reader could still act on. Fix: one clause in the banner. Not P50-blocking: the file is not in the runbook's named list.

**M-2 — `DESIGN.md` states five mobile destinations; the CSS grid has four columns.**
`DESIGN.md:245` ("Em ate 900px, a sidebar vira navegacao inferior com cinco destinos") and `:328` versus `src/components/portal/portal.module.css:1244-1247` `grid-template-columns: repeat(4, minmax(0, 1fr))`. An organization administrator's shell exposes five `mobile: true` items (`src/application/adult-portal/shell-view-model.ts:31-66`), so the fifth wraps onto a second row inside a 74px bar; a teacher sees exactly four. The line is unchanged by this refactor (not in the P50 diff), and P50's explicit DESIGN.md criterion is only the Docker check, which passes. Reported for accuracy of a P50-owned current document.

**M-3 — Redaction list does not cover the `entryCredential` field name, and `err` payloads are outside the redaction paths.**
`src/components/public/player-entry-screen.tsx:171` passes `credential={entryCredential}` and `src/components/public/game-host.tsx:65,70` types `credential: string`; the redact list covers `credential`, `cred`, `launchToken`, `tokenHash`, `credentialHash`, `playerCredential` but not `entryCredential`/`playerEntryCredential` (`src/server/observability/logger.ts:23-36`). Likewise `src/server/http/route.ts:41` logs `{ err: error }` and no `err`/`err.*` path is redacted. Verified currently inert: `AdultPortalError` and `HttpError` carry only `code`/`status`/`message`/`details`, and the only other console output is `src/app/error.tsx:16`. No live leak; the risk is latent.

### INFO

- **I-1 — `url`/`href` redaction is broader than the runbook asks for.** `logger.ts:42-45` adds top-level `url`, `href`, `req.url`, `request.url` to the global redact set. Defense-in-depth rather than harmful scope creep, but it will silently censor any future legitimate top-level `url` field. The in-file comment correctly discloses the limitation.
- **I-2 — The nested-URL redaction layer is thinner than the comment wording implies.** No `*.url` / `*.href` was added, so a hypothetical `{ req: { url } }` one level down is unredacted. Acceptable given the single call site.
- **I-3 — `workflow_dispatch` manual redeploy trigger was dropped with `deploy.yml`.** Base `deploy.yml:6` had it; `ci.yml:3-6` has only `pull_request` and `push`. Re-running a `ci.yml` run would re-execute the whole `gate` (rebuild), not redeploy the prior artifact; the GitHub Pages environment redeploy UI still satisfies the runbook's rollback clause. Worth confirming the owner knows the environment redeploy path.
- **I-4 — `upload-pages-artifact` has no `if-no-files-found: error`.** Relies on the action default (`warn`). A `build:demo` that produced no `out/` would warn and then fail at deploy. Identical to base behavior; not a regression.
- **I-5 — Actions are tag-pinned, not SHA-pinned.** Pre-existing and out of P50 scope.
- **I-6 — `README.md:76` documents `cp .env.example .env.local`, but `prisma.config.ts:1` loads `dotenv/config`, which reads `.env`, not `.env.local`.** Not contradictory (Next reads `.env.local`; the Prisma CLI reads `.env`); CI is unaffected. A nuance a reader may trip on.
- **I-7 — Docker sweep classification (item 3).** Zero live Docker claims in the eight current P50 documents. `portal-v1-specification.md:248,256` is explicitly historical; `docs/implementation/phase-01-foundation-contracts.md:36` is historical but under-disclaimed (M-1); `docs/current-architecture.md:268-270` "containers" is the DI sense; dated audits/agent-reviews are historical evidence.

## 4. Content-accuracy verification (help page, item 2)

| Help-page claim | Implementation evidence | Accurate |
|---|---|---|
| Platform admins create organizations; org team gets admin/professor links | `organizations-screen.tsx`, `team-screen.tsx`; `OrganizationRole` enum | yes |
| "Professores enxergam apenas as turmas ativas atribuídas ao seu vínculo" | `src/application/adult-portal/service.ts:353-386` — teacher filter is `classGroup.status === ACTIVE && teacherClassIds.has(id)` | yes (exact) |
| "Jogador 01, Jogador 02…" formatting | `player-access-workflow.tsx:53`, `player-credential-print-sheet.tsx:17`, `game-host-chrome.tsx:34` all use `padStart(2,"0")` | yes |
| "os números … nunca são reutilizados" | `prisma-player-access-store.ts:227-232` — monotonic `nextPlayerNumber` increment, no reuse path | yes |
| "Cada jogador tem um único QR ativo; em 'Trocar QR', o código anterior deixa de funcionar" | `prisma-player-access-store.ts:249-262` revokes all ACTIVE then creates new; partial unique index (`0_init/migration.sql:288`); demo path mirrored | yes |
| "A entrada do jogador acontece em /jogar" | `jogar/page.tsx`; `player-entry-credential.ts:20` reads `url.searchParams.getAll("cred")` | yes |
| "O professor inicia e encerra a sessão" | `player-access-workflow.tsx:376-377`; `player-access/service.ts:106-122` | yes |
| Waiting screen before start / entries refused after end | `resolveEntry` returns `{ state: "waiting" }` (`player-access/service.ts:141-153`); `game-state/service.ts:98-99` throws `SESSION_ENDED` | yes |
| "Resultados e tempo ativo … por turma e por número de jogador" | `results-screen.tsx:179-191` plus per-player route | yes |
| "Perfil demonstrado" selector with three roles | `demo-role-controls.tsx:69,55-64,103` | yes |

**Verdict: yes** — the page describes only surviving features and every material claim checks out against the actual screens.

## 5. Item 8 sweep — no forbidden test/inventory additions

| Forbidden artifact | Result |
|---|---|
| Exact route/action inventories | none; only `tests/unit/clean-build-artifacts.test.ts` is new, and it is a behavior test |
| Workflow-parser fixtures | none; no test reads `.github/**` or parses YAML |
| Deliberate failure fixtures | none |
| CSS/size baselines | none; no test reads `.css`, counts selectors, or asserts file sizes |
| Duplicated serial/contract legs | none; `ci.yml:54-55` runs `npm test` once; `test:contracts` remains defined but is never invoked by the workflow |
| Documentation-structure tests | none |

## 6. Item 9 — Manual Browser Smoke: static readiness (execution out of scope)

All static prerequisites present: four seeded dynamic routes all with `generateStaticParams`; `/jogar` present (reads and deletes `cred`); "Trocar QR" rotation; `data-player-print-active` gate with `.printSheet:not([data-player-print-active]) { display: none }`; print layout two columns (`repeat(2, minmax(0, 1fr))`, `gap: 9mm`) with visibility flip; same-tab/two-tab updates via `adult-portal-demo-change` event; corrupt-state fallback to `cloneSeed()`; mobile bottom-bar nav with base-path links (`basePath: "/SMS_Portal"`); error states (`error.tsx`, `sem-acesso`, `sessao-expirada`).

**Static readiness: satisfied. Execution is explicitly not part of this review.**

## 7. Acceptance criteria not satisfied or not statically verifiable

1. **Item 5 — `npm audit`** — produced by the dynamic pass (see `r2-review-general.md`).
2. **Item 6 — branch protection on `main`** — requires a real CI run plus an administrator action; the name to give the administrator is **`gate`**.
3. **First successful real CI run** — the workflow text is conformant, but no run has been observed from this tree; the Pages/OIDC path only proves out on a real push to `main`.
4. **Manual Browser Smoke execution** — statically supported; not executed.
5. **Disposable-database release validation** — explicitly out of scope for CI and local development.

---

**VERDICT: PASS-WITH-FINDINGS**
