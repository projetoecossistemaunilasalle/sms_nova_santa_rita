# P10 Review — Static Spec-Compliance (Round 2, Reviewer)

- **Phase:** P10 — Closed Generation-A Purge
- **Date:** 2026-09-27
- **Base commit:** `9467757ed436c82bdbace5a78e23b502176318e2` (`git rev-parse HEAD`)
- **Scope reviewed:** staged working tree (`git diff --cached`, 172 files, +7434 / −13699), current file contents, `git show 9467757:<path>` for base comparisons. Untracked `.zcodeignore` excluded.
- **Method:** static only — existence checks, `rg` sweeps over the first-party tree, import-closure resolution for every relative and `@/*` specifier in `src/` + `tests/`, CSS-module class resolution, per-item diff reading. No builds, no tests, no writes.
- **Environment (recorded only):** Node `v22.23.1`, npm `11.6.0`, `next@16.3.2` (installed under `node_modules/next/dist/docs/`). Runbook pins Node `24.19.0` / npm `>=11.6.0 <12`; observed Node is below the pin (pre-existing condition, not a P10 defect).

## Per-item verification

| # | P10 requirement | Evidence | Satisfied |
|---|---|---|---|
| A | Delete 7 route trees | `src/app/(professional)/portal/` now contains only `admin/{equipe,organizacoes}`, `ajuda`, `resultados`, `sem-acesso`, `sessao-expirada`, `turmas` (`ls`); `src/app/(public-play)/` contains only `jogar/`; 27 `D` route entries in `git diff --cached --name-status -- src/app` | yes |
| A | No remnants in `src/` | `rg -n "atividades\|/portal/materiais\|portal/modulos\|admin/auditoria\|admin/jogos\|admin/modulos\|/atividade/" src tests scripts contracts prisma .github package.json` → 0 hits; only `DESIGN.md:254,261,293,333` and `src/app/layout.tsx:12`, both generic Portuguese prose/metadata, not route claims | yes |
| B | Delete 18 services/stores/components | all 18 paths confirmed absent; `rg` for all 18 base names in `src tests scripts prisma contracts .github package.json` → 0 hits | yes |
| C | Delete 6 tests | all 6 confirmed absent; 28 tests remain in `tests/unit/`; no remaining test imports any deleted module | yes |
| D | Delete 6 contract JSONs + `contracts/schemas/games/` + 2 schema docs | all 9 confirmed absent | yes |
| D | **`contracts/schemas/v1/` untouched** | `git diff --cached --name-status -- contracts/schemas/v1/` → **empty**; also empty for `contracts/fixtures/v1/` and `src/contracts/` | yes |
| D | GameMaker protocol + Portuguese wire values preserved | `defesa_bolas` / `id_atividade` / `sequencia_tentativa` / `numero_tentativa_atividade` / `metricas` / `duracao_ms` / `parametros` still present in `src/contracts/v1/schemas.ts:159-164,241-246,285` and `contracts/schemas/v1/result-event.v1.schema.json:173`, `result-submission.v1.schema.json:166` | yes |
| E1 | `StatusBadge` → `"Ativa" \| "Inativa"`, no `ActivityStatus`, styles preserved | `src/components/portal/status-badge.tsx:3` (`type Status = "Ativa" \| "Inativa"`), `:6-7`; `ActivityStatus` import removed (diff); `portal.module.css:801 .statusPositive`, `:806 .statusNeutral` untouched; all 6 call sites feed `recordStatusLabel(...)` (`classes-screen.tsx:147`, `organization-detail-screen.tsx:134,180,225`, `organizations-screen.tsx:157`, `overview-screen.tsx:173,220`, `class-detail-screen.tsx:67,143`, `team-screen.tsx:341`) | yes |
| E2a | `isDemoRuntime` removed | `src/runtime/mode.ts` diff removes the only definition; `rg "isDemoRuntime" src tests` → 0 hits (base had 7, all in deleted files) | yes |
| E2b | `DEV_BYPASS_ACTOR` export dropped, constant kept | `src/server/auth/dev-bypass-gateway.ts:9` is now `const DEV_BYPASS_ACTOR`, used internally at `:17` | yes |
| E2c | `Links de acesso` branch removed | `src/components/portal/adult-portal-helpers.ts:135-139` now goes `exact` → `Resultados` → `startsWith`; `rg "Links de acesso" src` → 0 hits; nav hrefs are V1-only (`portal-navigation.tsx:62,72,78,86,120`) | yes |
| E2d | Auth fixtures updated | `tests/unit/auth.test.ts:143-158`: `/portal/atividades[+nova]` → `/portal/turmas[+turma-1]`, `/atividade/token/jogar` → `/jogar` | yes |
| E3 | `entrar/recuperar/actions.ts` deleted, page unaffected | file absent; `src/app/(professional)/entrar/recuperar/` contains only `page.tsx`, which is `"use client"` (`:1`) and imports only `next/link`, `react`, `marketing.module.css`; verified unreferenced at base (`git grep "recuperar" 9467757 -- src` returns only unrelated UI copy) | yes |
| E4 | `/atividade/` referrer condition removed, comment rewritten, `/jogar` preserved | `src/proxy.ts:108-116`: comment now describes only `/jogar`; condition is `pathname === "/jogar" \|\| startsWith("/jogar/")`. CSP (`:40-88`), `frame-src` (`:68,76`), `X-Frame-Options` (`:118`) and `config.matcher` (`:134-136`) unchanged in the diff | yes |
| E4 | Proxy test updated for the three behaviors | `tests/unit/proxy.test.ts:27-32` (`/jogar`), `:34-39` (`/jogar/` subpath), `:41-48` (other routes). Installed Next 16.3.2 docs confirm `src/proxy.ts` is the correct convention (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:23`) | yes |
| E5 | `apiErrorCodes` = exactly the six codes | `src/server/http/errors.ts:5-12`; 12 Generation-A names removed in the diff; `rg` for all 12 across `src tests scripts contracts` + current docs → 0 hits. Remaining `SCHEMA_VERSION_UNSUPPORTED`-like strings are the distinct V1 `STATE_SCHEMA_VERSION_UNSUPPORTED` (`contracts/schemas/v1/protocol-error.v1.schema.json:14`) | yes |
| E6a | `walkthrough.md` retired claims removed | `walkthrough.md:9-10` keeps only Pages root + `/portal/` (student activity-token URL removed); route inventory `:44-47` lists only surviving dynamic routes, and all four do declare `generateStaticParams` (`organizacoes/[id]/page.tsx:13`, `turmas/[id]/page.tsx:11`, `resultados/[classGroupId]/page.tsx:12`, `resultados/[classGroupId]/players/[playerSlotId]/page.tsx:12`); `DEV_BYPASS_ACTOR` description removed (`:23-25`); no `portal-view-service` / `activity-builder` / `activity-controls` / `material-editor` mention remains | yes |
| E6b | Help page no longer advertises access-link / link-status | `src/app/(professional)/portal/ajuda/page.tsx:7-43` — topics are Organizações/equipe, Turmas, Jogadores numerados, Credenciais QR, Sessões, Resultados, Perfis demo; "Links de acesso", "Status e validade", "Acesso anônimo" gone; `IconName` values used all exist (`icon.tsx:7,12,20,33,37,38,40`) | yes |
| E6c | Three named docs updated | `docs/current-architecture.md` route table now enumerates only surviving routes and states "There is no `/health` route"; `docs/schemas/README.md:3-9,14-19,49-52` and `contracts/schemas/README.md:10-22` (new "Contract index") describe only `contracts/schemas/v1` + `contracts/fixtures/v1`. Route table matches the real tree exactly (verified by `find src/app -type f`) | yes |
| E7 | Whole first-party tree searched | Search performed independently over `src tests scripts prisma contracts .github package.json README.md PRODUCT.md DESIGN.md walkthrough.md .env.example` for `atividades, /portal/materiais, portal/modulos, admin/auditoria, admin/jogos, admin/modulos, /atividade/, access-link, AccessLink, link-status, LinkStatus, portal-view-service, service-container, public-state, activity-builder, material-editor, materials-explorer, class-groups-explorer, share-actions, activity-controls, activity-mark, prisma-capability-reader, audit-actions, public-link-service, isDemoRuntime` → only the 5 benign prose/metadata hits above | yes |
| FD1 | No shims / redirects / barrels / migration-on-read | `next.config.ts` has no `redirects()`; no `middleware.ts`; `src/proxy.ts` sets no `Location`/redirect; `rg "Capability"` in `src tests prisma` → 0 hits (the new `src/application/authorization/authorization-actor.ts` is a mapper to the *surviving* `v1-policy.ts`, not a shim for the deleted capability-based `authorization-service.ts`); `prisma/migrations/` reduced to the single `0_init` baseline | yes |
| FD2 | V1 contracts untouched | see D | yes |
| FD3 | `/atividade/*` breaks with no redirect/compat test | no redirect exists; no test references `/atividade` | yes |
| ACC | No deleted path/import/code/artifact in `src`, active tests, current docs, live contract index | satisfied for the named set; one documentation-classification gap, see MINOR-1 | partial |
| ACC | History not linked as current guidance | most docs carry explicit banners (`implementation_plan.md:3-7`, `docs/demo-visual-plan.md:3-6`, `docs/v1-game-integration-dossier.md:3-8`, `docs/implementation/v1-architecture-plan.md:3-9`, `docs/implementation/README.md:57-67`, `portal-v1-specification.md:1-12`, `docs/refactor-dossier/README.md:17-30`); gap for `docs/architecture-audit-2026-09-23.md` | partial |

### Additional integrity checks run

- **Import closure** — every `from "…"` specifier in `src/**` and `tests/**` (excluding `src/generated`) resolved: 0 unresolvable relative imports, 0 unresolvable `@/*` imports. So no surviving file depends on a deleted module.
- **CSS-module resolution** — every `styles.X` referenced by `src/components/portal/*.tsx` resolves in the corresponding module (the 23 initial "misses" were false positives: `results-screen.tsx:11` uses `results.module.css`, and `.demoRoleBlockNotice` / `.desktopNavItem` exist as nested selectors at `portal.module.css:1631` / `:1231`, present at base too).
- **Stale-client masking** — `src/generated/prisma/models/` contains no `AccessLink.ts`, and `postinstall: prisma generate` (`package.json:30`) plus `check`'s `prisma:generate` (`package.json:27`) regenerate it, so the "no deleted import remains" result is not masked by a stale generated client.
- **Route inventory vs. actual tree** — all internal `href=`/redirect literals in `src/` point only at surviving routes; the printed-QR URL builder `src/components/portal/player-credential-print-sheet.tsx:22-24` still targets `${basePath}/jogar/?cred=…`, i.e. the surviving route.

## Findings

### CRITICAL
None.

### MAJOR
None.

### MINOR-1 — `docs/architecture-audit-2026-09-23.md` is not classified as historical and is still linked as live guidance.
P10 acceptance requires that documents "must not be linked as current implementation guidance". This file is unmodified by the staged change, carries 30+ lines describing the deleted Generation-A surface (`docs/architecture-audit-2026-09-23.md:112,116,120,121,147,153,185,198,239,241,243,244,245,246,253,254,311,384,426,456,459,575,641,642,643,646,647,648,650,652,659,661,695,783,799`), and its own header still reads `Status: Findings verified against commit d4af23c…` / `Audience: whoever implements Slices 3-5 hardening and Slice 6+` (`:3,6`) with no historical banner. It is linked as "the architectural source of truth" from `REFACTOR_PLAN.md:19` and as a live "precondition for further slice work" from `docs/implementation/README.md:50`. Contrast the four docs that *did* receive banners in this same change. Arguably P50 copy-polish scope, but it is the one acceptance clause of P10 that is not fully met.

### MINOR-2 — Dangling relative links to the two deleted schema documents inside a superseded doc.
`docs/implementation/phase-01-foundation-contracts.md:18-19` links `../schemas/domain-rules.md` and `../schemas/api-contracts.md`, both deleted. Prose references also survive at `docs/implementation/phase-03-game-integration.md:75` and `docs/implementation/phase-04-reporting-hardening.md:134`. The document is explicitly listed under "Superseded plans … historical research, not executable V1 plans" in `docs/implementation/README.md:60-67`, so it satisfies the classification clause, but the links are now broken and will mislead anyone who follows them.

### MINOR-3 — Dead `IconName` variants left behind by the purge.
`src/components/shared/icon.tsx` still declares `"book"` (`:7`), `"edit"` (`:17`), `"link"` (`:25`) and `"paperclip"` (`:18`) with zero `name="…"` call sites in the tree. All four were used exclusively by now-deleted files at base (`git grep 9467757`: `materials-explorer.tsx:94,118`, `material-editor.tsx:169`, `atividades/[id]/page.tsx:66`, `atividades/page.tsx:25`, `atividades/vazia/page.tsx:17`, `share-actions.tsx:136`). `"module"` (`:29`) was already dead at base. Not in the runbook's closed deletion set, and P10 item 7 says to review the diff rather than add deletion tests — so this is residue a diff review should have caught, but it is harmless at runtime (tree-shaken `IconName` union members and their conditional JSX). Deferring to P40/P50 is defensible.

### INFO

- **INFO-1** — `docs/portal-visual-reference.html:1325,1915,2164` still contains the Generation-A share mock (`.share-actions`, `missoes.nsr.rs.gov.br/a/7FQ-29M`, "Compartilhar com a turma"). Its `<title>` is already "Arquivo: referência visual anterior do portal" and it is not linked from `README.md` or the dossier classification, so it reads as an archive. Not a violation, but it is not covered by the repo's new historical-document banners either.
- **INFO-2** — `tests/unit/proxy.test.ts:41-48` uses `/entrar` as the "other routes" case, so it would still pass if the removed `/atividade/` referrer branch were reintroduced. The removal is provable only by diff review — which is exactly what the runbook prescribes (`IMPLEMENTATION-READY.md:189-190`), so this is not a defect, but worth recording that the check cannot catch a regression in that one branch.
- **INFO-3** — `REFACTOR_PLAN.md:5` still reads `Status: Approved for execution` with no in-file superseded banner, although it contains many Generation-A claims. It *is* classified externally (`IMPLEMENTATION-READY.md:5-7` and `docs/refactor-dossier/README.md:28-30`), and it is not one of the three docs P10 names, so this reads as compliant.
- **INFO-4** — Runbook line 344 explicitly assigns "remove selector blocks whose only owners were deleted" to a post-P10 phase, so residual Generation-A CSS in `portal.module.css` (368 selectors) / `public.module.css` (72) is not a P10 finding. The Gen-A-looking selectors that remain (`.moduleGrid:894`, `.moduleCard:900`, `.moduleArt:920`) are in fact live — the rewritten help page uses them.
- **INFO-5** — `src/contracts/v1/schemas.ts:159-164,241-246` still uses `id_atividade` / `versao_atividade` / `numero_tentativa_atividade` / `parametros`. This is correct: Fixed Decision 2 mandates preserving Portuguese wire values, and these are V1 protocol fields, not Generation-A artifacts.

## Acceptance criteria not satisfied, or not statically verifiable

- **Not satisfied (MINOR):** "Documents already and explicitly classified as historical … must not be linked as current implementation guidance" — `docs/architecture-audit-2026-09-23.md` is neither classified nor unlinked (MINOR-1).
- **Not statically verifiable (read-only mandate: no builds, tests, dev servers, or write-capable npm):** "Format, lint, typecheck, normal tests, and both builds pass after a clean", and "The static demo builds successfully". Static proxies substituted: complete import-closure resolution across `src/`+`tests/`, CSS-module class resolution, icon-name validity for the rewritten help page, and confirmation that the local generated Prisma client is already purged. These cannot substitute for an actual `npm run check` and a demo export on the pinned Node 24.19.0.
- **Out of scope but noted:** observed Node `v22.23.1` is below the runbook's pinned `24.19.0` (`IMPLEMENTATION-READY.md:39-40`); pre-existing environment condition, not introduced by P10.

## Summary

Every enumerated P10 requirement (A–G, items 1–7) is satisfied in the final tree, with a clean purge closure: 0 residual references to any deleted path, symbol, error code, or contract artifact in `src`, `tests`, `scripts`, `contracts`, `prisma`, `.github`, `package.json`, or the current docs; the `contracts/schemas/v1/` tree is byte-identical to base; and the seven coupled edits are all present and correct. The remaining findings are documentation-classification hygiene and a small amount of dead code created by the deletion — none of which affects runtime behavior, contract integrity, or the no-compatibility fixed decision.

**VERDICT: PASS-WITH-FINDINGS**
