# P10 (Closed Generation-A Purge) — General Verification

Date: 2026-09-26. Verifier scope: read-only checks + one targeted vitest run. Builds/typecheck/format/lint/normal suite were verified green by the parent (28 files / 187 tests) and were not re-run here except the four files below.

## Scope verified

### 1. Deletions match the manifest; nothing extra deleted
`git status --short` / `git diff --stat` (74 files, +138/−8,633):
- Route trees deleted: `(professional)/portal/atividades/` (page, nova, vazia, [id]/{page,editar,compartilhar,conflito,resultados}, actions.ts), `portal/materiais/` (page, novo, [id]/editar), `portal/modulos/` (page, [id]), `portal/admin/{jogos,modulos,auditoria}/page.tsx`, `(public-play)/atividade/[token]/` (layout, page, [state], jogar, jogar/[state]). All present as `D`.
- Services/stores/components deleted (all 18): access-link-service, portal-view-service, prisma-access-link-store, authorization-service, audit-actions, public-link-service, security/tokens.ts, prisma-capability-reader, service-container, link-status, material-editor, activity-builder, class-groups-explorer, share-actions, activity-controls, materials-explorer, public/public-state, activity-mark.
- Six tests deleted: access-link-service, authorization, portal-dev-bypass-actions, access-link-tokens, link-status, portal-dev-bypass (.test.ts).
- Contract artifacts deleted: contracts/schemas/{api-error,attempt-create-request,attempt-create-response,attempt-result-ack,attempt-result-request,session-manifest}.v1.schema.json, contracts/schemas/games/ (2 files), docs/schemas/{api-contracts,domain-rules}.md.
- Coupled edit (3): `src/app/(professional)/entrar/recuperar/actions.ts` deleted.
- Every `D` entry in git status maps to the manifest or to the declared out-of-scope P00 working-tree changes (Dockerfile, .dockerignore, .prettierignore, package.json scripts `clean:build`/`prisma:validate`, ci.yml, clean-build-artifacts scripts/test, auth.test env-restore refactor). No unintended deletions.

### 2. contracts untouched outside the manifest
`git diff --stat -- contracts/schemas/v1 contracts/fixtures/v1` → empty (zero diff). Only the six Generation-A schema JSONs, `contracts/schemas/games/`, and `contracts/schemas/README.md` changed under contracts/.

### 3. First-party tree grep (src, tests, scripts, .github, walkthrough.md, README.md, DESIGN.md, PRODUCT.md, docs/, contracts/)
Patterns: deleted file basenames, `atividade/`, `/portal/atividades`, `/portal/materiais`, `/portal/modulos`, `admin/jogos`, `admin/modulos`, `admin/auditoria`, `DEV_BYPASS_ACTOR`, `isDemoRuntime`, `ActivityStatus`, removed api error codes, "Links de acesso", `access-link`, `link-status`, `session-manifest`, `attempt-create`, `attempt-result`, `api-error.v1`.
- src/ and active tests: zero hits except the two expected items below (findings F1, F2).
- Current docs (walkthrough.md, README.md, DESIGN.md, PRODUCT.md, docs/current-architecture.md, docs/schemas/README.md, contracts/schemas/README.md): zero hits except finding F3.
- Historical docs (demo-visual-plan.md, architecture-audit-2026-09-23.md, portal-visual-reference.html, docs/agent-reviews/**, docs/implementation/**, docs/refactor-dossier/**, docs/refactor-dossier-audit-2026-09-25/**): many deleted-artifact references — allowed per classification (c). Link check: README.md qualifies demo-visual-plan as "(demo reference, not V1 product authority)" and portal-v1-specification.md as "(historical research only)"; docs/schemas/database-model.md links implementation phase docs as "For historical research only". No current doc links a historical doc as current implementation guidance.
- prisma/schema.prisma + src/generated/prisma/*: AccessLink/CapabilityAssignment/AuditEvent/RateLimitBucket mentions — classification (d), expected until P20.

### 4. Coupled edits verified by reading diffs
- status-badge.tsx: `type Status = "Ativa" | "Inativa"`; ActivityStatus import and all Generation-A tones removed; `statusPositive` for "Ativa", `statusNeutral` otherwise — positive/neutral styles preserved.
- runtime/mode.ts: `isDemoRuntime` removed; `getRuntimeMode` kept.
- dev-bypass-gateway.ts: `export const DEV_BYPASS_ACTOR` → `const DEV_BYPASS_ACTOR`; constant kept for gateway internal use; no other references in tree.
- adult-portal-helpers.ts: "Links de acesso" branch removed from `isPortalNavigationItemCurrent`.
- errors.ts: apiErrorCodes reduced to exactly AUTHENTICATION_REQUIRED, FORBIDDEN, VALIDATION_FAILED, CONFLICT, INTERNAL_SERVER_ERROR, SESSION_EXPIRED.
- proxy.ts: only the `/atividade/` referrer condition removed; comment rewritten for /jogar only; `=== "/jogar"` and `startsWith("/jogar/")` both keep no-referrer; CSP, frame origins, matcher untouched. tests/unit/proxy.test.ts adds exactly the three behaviors: /jogar no-referrer, /jogar subpath no-referrer, other routes strict-origin-when-cross-origin.
- tests/unit/auth.test.ts: fixtures moved off deleted routes (`/portal/turmas`, `/jogar`); P00 env-restore refactor layered in.
- walkthrough.md: public activity URL, portal-view-service/activity-builder/activity-controls/material-editor/DEV_BYPASS_ACTOR claims, and all deleted-route inventory entries removed.
- ajuda/page.tsx: "Links de acesso", "Status e validade" (link-status), "Acesso anônimo" topics removed; only "Resultados coletivos" survives.
- docs/current-architecture.md: `/atividade/[token]` rows/warnings replaced with `/jogar`; legacy-route mentions removed.
- docs/schemas/README.md and contracts/schemas/README.md: deleted-artifact references removed; contract index now lists only v1 schemas + fixtures.

### 5. Recuperar page and compat check
- src/app/(professional)/entrar/recuperar/page.tsx is a pure client component ("use client", local state, demo form); it does not import ./actions (deleted); no reference to `recuperar/actions` or `requestPasswordReset` remains anywhere in src/tests/scripts.
- No redirect/rewrite for `/atividade/*` in next.config or proxy.ts; no compat shim or compat test (grep for `atividade` in src/tests: zero hits; the only `(public-play)` test import is the surviving `@/app/(public-play)/jogar/actions`).

### 6. Targeted test run
`npx vitest run tests/unit/proxy.test.ts tests/unit/auth.test.ts tests/unit/http.test.ts tests/unit/v1-contracts.test.ts` → 4 files passed, 82 tests passed.

## Findings

| # | Severity | Location | Evidence | Classification |
| --- | --- | --- | --- | --- |
| F1 | INFO | src/server/auth/dev-bypass-gateway.ts:9,17 | `DEV_BYPASS_ACTOR` remains, unexported, used only internally by the gateway | Expected per coupled edit (2) — confirmed correct, not a violation |
| F2 | INFO | src/components/public/game-host.tsx:667; src/contracts/v1/schemas.ts:430; contracts/schemas/v1/protocol-error.v1.schema.json:14 | `STATE_SCHEMA_VERSION_UNSUPPORTED` matches the grep for `SCHEMA_VERSION_UNSUPPORTED` but is the distinct v1 protocol identifier inside the untouched v1 contract surface | False alarm (explicitly called out in the task) |
| F3 | MINOR | docs/schemas/README.md (token conventions bullet, retained in this diff) | "Access-link and player-credential tokens contain at least 256 bits of randomness." — a residual "Access-link" qualifier survives in one of the five P10 docs. Defensible while the `access_links` table and its digest convention still exist in prisma/schema.prisma (P20 scope), but the runtime no longer mints access-link tokens | Confirmed residual wording; not a path/import/error-code/contract artifact; recommend rewording in P20 or P50 |
| F4 | INFO | docs/schemas/database-model.md:5,50,60-61,86,152-154,173 (unmodified file) | Documents the `access_links` table, `link:view`/`link:manage` capabilities — matches the still-present prisma schema | Classification (d) analog: expected until P20, not a violation |
| F5 | INFO | src/generated/prisma/* (browser.ts, client.ts, enums.ts, etc.) | Generated Prisma client exports AccessLink/CapabilityAssignment types | Classification (d): expected until P20; generated code, hand-editing forbidden |
| F6 | INFO | README.md:37-45; docs/schemas/database-model.md:186-191 | Current docs link historical docs (v1-game-integration-dossier as V1 product authority; demo-visual-plan/portal-v1-specification/implementation phase docs explicitly labeled demo reference / historical research only) | Links are qualified, not presented as current implementation guidance; v1-game-integration-dossier.md itself has zero deleted-artifact hits. Pre-existing structure, out of P10 scope |
| F7 | INFO | git status (untracked/modified P00 set) | Dockerfile/.dockerignore deletions, .prettierignore, package.json scripts, ci.yml, clean-build-artifacts*, auth.test env refactor | Declared out-of-scope pre-existing P00 changes; not re-verified |

No CRITICAL or MAJOR findings.

## Verdict

**P10 satisfied: YES.**

All manifest deletions happened and nothing beyond the manifest (plus declared P00 changes) was touched; contracts/schemas/v1 and contracts/fixtures/v1 have zero diff; the first-party tree is free of imports, route strings, symbols, error codes, and contract artifacts from the deletion set (outside the expected prisma/generated and historical-doc classifications); all seven coupled edits are in place and correct; the surviving recuperar page is client-side demo with no actions import; no compat shim or redirect test exists for /atividade/*; the four targeted test suites are green. The only actionable residue is the MINOR wording item F3, which can ride with P20/P50 polish per the phase's deferral note.
