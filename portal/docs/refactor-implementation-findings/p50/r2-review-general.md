# P50 Round-2 Review — General / Dynamic Verification

- **Phase:** P50 (Security, Documentation, Deployment, and Acceptance)
- **Date:** 2026-09-27
- **Base commit (HEAD):** `9467757` — "docs: finalize refactor implementation runbook"; entire refactor P00–P50 is one staged working-tree change against it
- **Toolchain used:** Node `v22.23.1` / npm `11.6.0`
- **Toolchain discrepancy:** the repo pins Node `24.19.0` (`package.json` engines); this shell runs Node `22.23.1`. npm `11.6.0` matches the pin. The runbook itself acknowledges the inspected shell uses Node `22.23.1`; results below are recorded on that toolchain.
- **Constraint compliance:** all target commands ran strictly serially; no tracked file was modified, nothing staged/committed, no `.env` edit, no prisma migrate/db push/reset/deploy, no dev server, no npm install/audit fix, no Docker, no builds/typechecks (P30/P40 covered them).

## Command log

| # | Command | Exit code | Key result |
| --- | --- | --- | --- |
| 1 | `node --version && npm --version` | 0 | `v22.23.1` / `11.6.0` |
| 2 | `npx vitest run tests/unit/http.test.ts` | 0 | Test Files 1 passed; Tests **4 passed** (includes `logger redaction` regression) |
| 3 | `npm audit` | 1 | **8 vulnerabilities (1 moderate, 6 high, 1 critical)** — details below |
| 4 | `npm ls js-yaml sharp ajv` | 0 | Origin trace: `sharp@0.35.3` ← `next@16.3.2` (runtime); `js-yaml@4.3.1` ← `eslint` (dev); `ajv@8.17.1` top-level devDep, also deduped into `@neondatabase/auth` chain |
| 5 | `git diff 9467757 -- package.json package-lock.json` | 0 | **Only dependency change is `fake-indexeddb@6.2.5`** (devDependency, `dev: true` in lockfile); script changes only otherwise |
| 6 | `rg -ln "ajv" tests/ src/ contracts/ scripts/` | 0 | Single hit: `tests/unit/v1-contracts.test.ts` (dev/test-only use) |
| 7 | `npm run format:check` | 0 | "All matched files use Prettier code style!" |
| 8 | `npm run lint` | 0 | `eslint . --max-warnings=0` clean |
| 9 | `git show 9467757:.github/workflows/deploy.yml` | 0 | Base deploy workflow captured for environment/concurrency comparison |
| 10 | `ls .github/workflows/` + `rg -ni "latest\|build:demo\|deploy-pages\|upload-pages" .github/workflows/` | 0 | Only `ci.yml` exists; `build:demo` once (gate job), upload/deploy actions each once; `latest` hits are only `runs-on: ubuntu-latest` |
| 11 | `rg -in "docker"` across README/DESIGN/PRODUCT/walkthrough/implementation_plan/docs/ | 0 | Hits only in audit/review/historical folders (see item 3 below); **zero hits in current docs** |
| 12 | `head` of the four evidence docs | 0 | Historical banners confirmed (quoted below) |
| 13 | `rg -in "link de acesso\|access.?link\|link-status\|atividade\|materia\|modulo" "src/app/(professional)/portal/ajuda/"` | 1 | No matches — help page carries no access-link/link-status/Generation-A content |

## Gate 1 — Logger redaction regression (P50 item 1, dynamic)

**Test read first — it is genuinely output-level.** `tests/unit/http.test.ts` ("logger redaction", lines 43–134):

- Builds a pino logger via `createLogger(new Writable({ write(...) { lines.push(String(chunk)) } }))` — it captures the **serialized destination stream**, not in-memory objects.
- Joins all emitted lines (`lines.join("")`) and asserts `expect(output).not.toContain(sentinel)` with sentinel `"sentinel-credential-8f4c1d2e7b6a"`.
- Covers **structured input**: sentinel under `cred`, `launchToken`, `credential`, `playerCredential`, `tokenHash`, `credentialHash`, and nested under `nested.{cred, launchToken, tokenHash}`; asserts each becomes `"[REDACTED]"`.
- Covers **URL-shaped input**: `url: "/jogar/abc?cred=${sentinel}&next=%2Fhistorico"` — asserts the whole `url` value is censored; plus a pathname-only child-logger entry (`path: "/jogar/abc"`) asserted to survive.

**Run:** `npx vitest run tests/unit/http.test.ts` → exit 0, **4/4 passed**. PASS.

## Gate 2 — npm audit (P50 item 5)

`npm audit` → exit 1. Summary: **8 vulnerabilities (1 moderate, 6 high, 1 critical)**.

| Package | Severity | Advisory | Runtime or dev | Applicability |
| --- | --- | --- | --- | --- |
| `next 16.0.0–16.3.2` (installed `16.3.2`, **direct runtime dependency**) | **critical** (+high) | GHSA-p293-qw3h-jr36 — Unauthenticated RCE on **windows-hosted servers**; GHSA-2xp9-vwfh-vxw4 — Unauthenticated RCE in Image Optimization API (AVIF) | **Runtime** | Applicable to the **server target** (`output: "standalone"`, this environment is Windows). Not applicable to the static Pages demo (no server, image optimization disabled by export). Fix is `next@16.3.6`, "outside the stated dependency range" because `package.json` pins `next: "16.3.2"` exactly — requires a deliberate version bump, not `audit fix`. **Pre-existing at base** (next version unchanged by the refactor). |
| `sharp <0.35.4` (installed `0.35.3`) | high | libheif GHSA-g89c-p67h-r497 / GHSA-2jg2-4ch7-h545 | Runtime (transitive of `next`) | Used by Next image optimization in the server target. Non-breaking fix available (`npm audit fix`). |
| `deepmerge-ts <8.0.0` | high | stack exhaustion | Dev (via `@prisma/config` ← `prisma` CLI) | Not runtime; fix forces `prisma@6.19.3` downgrade (breaking) — out of scope. |
| `mysql2 <=3.23.0` | high ×2 | auth-plugin downgrade; zlib bomb | Dev (via `prisma` CLI) | Not runtime; same prisma-downgrade constraint. |
| `js-yaml 4.0.0–4.3.1` | high | maxTotalMergeKeys CPU | Dev (via `eslint` → `@eslint/eslintrc`) | Not runtime. |
| `ajv 7.0.0-alpha.0–8.17.1` | moderate | ReDoS with `$data` option | Dev (direct devDep); also deduped into the `@neondatabase/auth` → `@neondatabase/auth-ui` → `@hookform/resolvers` runtime chain | First-party use is `tests/unit/v1-contracts.test.ts` only (contract validation in tests, no `$data` usage). Runtime-graph reachability exists but the ReDoS trigger (`$data` option) is not exercised by first-party code. |

**Dependency-change contradiction check:** the refactor's only dependency addition is `fake-indexeddb@6.2.5` (devDependency, `dev: true` in lockfile) — it has no advisories and no runtime dependency version changed. **No finding contradicts the refactor's dependency changes.**

Disposition per runbook ("review applicable runtime findings. Do not run `npm audit fix --force`"): reviewed above; no fix applied. The two `next` advisories are flagged as Findings F-1 (MAJOR) and F-2 (MINOR below it) for the release owner.

## Gate 3 — format:check and lint

- `npm run format:check` → exit 0, all files clean.
- `npm run lint` → exit 0, zero warnings (`--max-warnings=0`) on the full tree.

## Static verification sweeps

### Sweep a — Logger redaction (P50 item 1)

`src/server/observability/logger.ts` `sensitivePaths` includes, with comments naming the player entry credential and launch token (lines 20–36):

- `cred`, `*.cred`, `launchToken`, `*.launchToken`
- `credential`, `*.credential`, `playerCredential`, `*.playerCredential`, `credentialHash`, `*.credentialHash`, `tokenHash`, `*.tokenHash` (comment: "Raw player credential values and their SHA-256 hashes (tokenHash is the CredentialMaterial key...)")
- Second layer for URL-shaped keys: `url`, `href`, `req.url`, `request.url` (lines 42–45), with an honest comment that pino wildcards match one nesting level and "the pathname-only invariant is enforced at the call site."

**Call-site check:** `rg` for logger call sites across `src/server/http/`, `src/app/api/`, `src/server/services/` finds exactly one consumer of `@/server/observability/logger`: `src/server/http/route.ts:20`. It logs `path: request.nextUrl.pathname` (line 23) — **pathname, never the full URL** — and then `info`/`warn`/`error` entries carry only `status`, `errorCode`, and `err`. No route handler logs a raw `url`. Satisfied.

### Sweep b — CI/Pages fold (P50 item 4)

Full read of `.github/workflows/ci.yml`; base reference `git show 9467757:.github/workflows/deploy.yml`.

| Property | Status | Evidence |
| --- | --- | --- |
| (i) Demo built once in the gate job | Yes | `gate` job runs `npm run build:demo` (ci.yml:61) — the only occurrence in the workflow; the `deploy` job has no build/checkout steps at all |
| (ii) Upload of `out` only on successful push to main | Yes | Upload step condition (ci.yml:67): `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`; steps only run after prior gate steps succeed |
| (iii) Dependent deploy job, artifact-based, job-scoped permissions | Yes | `deploy: needs: gate` (ci.yml:74); job-level permissions (ci.yml:79–81): `permissions:\n  pages: write\n  id-token: write`; workflow top level keeps only `permissions:\n  contents: read` (ci.yml:8–9) |
| (iv) `github-pages` environment + deployment URL preserved | Yes | Base deploy.yml: `environment:\n  name: github-pages\n  url: ${{ steps.deployment.outputs.page_url }}`; current ci.yml:82–84 identical |
| (v) `pages` concurrency group on deploy job, `cancel-in-progress: false` | Yes | ci.yml:76–78: `concurrency:\n  group: "pages"\n  cancel-in-progress: false` (base had it at workflow level; now scoped to the deploy job per the runbook, so PR gate jobs are not serialized) |
| (vi) `deploy.yml` deleted | Yes | `git status --short` shows `D .github/workflows/deploy.yml`; file absent from disk; `.github/workflows/` contains only `ci.yml` |
| (vii) No second workflow rebuilding or hunting a "latest" artifact | Yes | Only workflow is ci.yml; `rg -ni "latest\|build:demo\|deploy-pages\|upload-pages" .github/workflows/` matches only the gate's `build:demo`, the gate's `upload-pages-artifact@v3`, the deploy job's `deploy-pages@v4`, and `runs-on: ubuntu-latest` lines |
| Final CI sequence matches runbook | Yes | checkout → Node `24.19.0` → `npm ci` → `npm run clean:build` → `format:check` → `lint` → `prisma:validate` → `typecheck:server` → `build:server` → `npm test` → `typecheck:demo` → `build:demo` → upload (main-push only) → deploy job |
| Gate job name (branch-protection handoff, item 6) | Recorded | Job id **`gate`** (workflow name `CI`; displayed in Actions as "CI / gate"). No `name:` override, so the required status check name is `gate`. |

### Sweep c — Documentation / Docker (P50 item 3)

`rg -in "docker"` across `README.md`, `DESIGN.md`, `PRODUCT.md`, `walkthrough.md`, `implementation_plan.md`, `REFACTOR_PLAN.md`, and `docs/` (excluding node_modules and this findings tree):

- **Zero hits** in `README.md`, `DESIGN.md`, `PRODUCT.md`, `walkthrough.md`, `implementation_plan.md`, `docs/current-architecture.md`, `docs/schemas/`, `docs/v1-game-integration-dossier.md`, `docs/demo-visual-plan.md`. No current doc presents Docker as a supported build or deployment target.
- All remaining hits are in audit/review/historical folders (`docs/agent-reviews/`, `docs/refactor-dossier-audit-2026-09-25/`, `docs/architecture-audit-2026-09-23.md`) or in a labeled-legacy doc: `docs/implementation/phase-01-foundation-contracts.md:36` ("Create a production multi-stage Dockerfile...") — that file carries the banner "**Legacy detailed plan.** ... must not be implemented as written." Classified historical/labeled.
- `Dockerfile` and `.dockerignore` are deleted from the tree (`git status`: `D` for both; `ls` confirms absence).
- README.md:120–126 documents the fold correctly: "CI and deployment ... deploys it to GitHub Pages; there is no separate deployment workflow."

**Four evidence docs carry historical banners** (first lines quoted):

1. `docs/implementation/v1-architecture-plan.md` — "> **Status: historical planning record.** This plan recorded the transition ... superseded by `../refactor-dossier/IMPLEMENTATION-READY.md` ... must not be followed as current guidance."
2. `docs/v1-game-integration-dossier.md` — "> **Status: historical planning record.** This dossier recorded the V1 product and integration direction ... superseded by ..."
3. `docs/demo-visual-plan.md` — "> **Status: documento histórico.** Este plano descreve a geração anterior do portal ... Não é orientação de implementação atual..."
4. `implementation_plan.md` — "> **Status: documento histórico.** Este plano registrou a adaptação original do repositório ... não deve ser seguido como orientação atual."

### Sweep d — Help page (P50 item 2)

`src/app/(professional)/portal/ajuda/page.tsx` read in full. Its seven topic cards cover: **Organizações e equipe**, **Turmas e professores**, **Jogadores numerados**, **Credenciais QR** (single active QR, rotation discards the previous code, entry at `/jogar`), **Sessões de turma**, **Resultados e tempo ativo**, and **Perfis na demonstração** — exactly the surviving features (organizations, classes, players, credentials, results, plus demo-mode help). `rg` for access-link/link-status/activity/material/module terms in that directory: **zero matches**. No access-link or link-status advertising remains. Satisfied.

## Findings

- **MAJOR F-1 — Critical runtime advisory on `next@16.3.2` (pre-existing, unresolved by design of this round).** `npm audit` reports two unauthenticated-RCE advisories against the direct runtime dependency `next 16.0.0–16.3.2` (GHSA-p293-qw3h-jr36, windows-hosted servers; GHSA-2xp9-vwfh-vxw4, image-optimization AVIF). Applicable to the `output: "standalone"` server target — notably on Windows hosts like this environment — not to the static Pages demo. Fix is `next@16.3.6`, which requires bumping the exact pin `"next": "16.3.2"`; the runbook forbids `npm audit fix --force` in this refactor and this round forbids dependency changes. Not introduced by the refactor (next version identical at base `9467757`). Recommend a dedicated follow-up dependency-bump PR before the server target is deployed.
- **MINOR F-2 — `sharp@0.35.3` high severity in the runtime graph.** Transitive of `next`, used for image optimization in the server target. Non-breaking fix available via `npm audit fix`; resolve together with F-1's next bump.
- **MINOR F-3 — `docs/implementation/README.md` still frames superseded plans as executable.** It opens "This roadmap implements the product boundary..." and calls `v1-architecture-plan.md` "The executable plan", without a historical banner of its own, although the plan and dossier it links are bannered historical. Not in P50's required doc list, but it is the index page a reader hits first inside `docs/implementation/`. Suggest adding the same historical banner.
- **INFO F-4 — Dev-only audit findings accepted:** `ajv` (moderate; first-party use is tests-only; also reachable via the `@neondatabase/auth` chain but the `$data` ReDoS trigger is not exercised), `deepmerge-ts`, `js-yaml`, `mysql2` (all high, all dev/CLI-only; the mysql2/deepmerge-ts fixes require a breaking prisma downgrade). No action in this refactor.
- **INFO F-5 — Toolchain discrepancy:** verification ran on Node `v22.23.1` (npm `11.6.0` matches the pin) against the repo's Node `24.19.0` pin; CI itself pins `node-version: "24.19.0"` so the authoritative gate is unaffected.
- **INFO F-6 — Release checks out of scope for this round:** (a) Manual Browser Smoke was **not re-executed** (requires a browser and a served static export); the round-1 evidence file `docs/refactor-implementation-findings/p50/manual-browser-smoke.md` exists (presence confirmed via directory listing; content intentionally not read). (b) P50 item 6 branch-protection handoff is not verifiable from local workflow text: the gate job name to make required on `main` is **`gate`**; the run URL and resulting setting must be recorded after the first real CI run by the administrator.

## Acceptance criteria not satisfied / remaining

1. **P50 item 6 (branch protection)** — inherently a post-first-real-CI-run step; remains open as a release action (gate job name `gate` handed off above).
2. **Manual Browser Smoke** — not re-executed this round (release check; round-1 evidence file exists as referenced).
3. **`next` critical runtime advisory** — open by design (F-1); needs a follow-up dependency-bump PR, not an in-refactor fix.

Everything else in P50 items 1–5 is verified satisfied with the evidence above.

VERDICT: PASS-WITH-FINDINGS
