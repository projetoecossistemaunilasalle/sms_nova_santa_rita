# P10 Round-2 Dynamic Verification — Closed Generation-A Purge

- **Phase:** P10 (Closed Generation-A Purge)
- **Reviewer role:** Round-2 dynamic verification agent (independent; prior round reports not read)
- **Date:** 2026-09-27
- **Base commit (HEAD):** `9467757` — "docs: finalize refactor implementation runbook"
- **State verified:** entire P00–P50 refactor as one staged working-tree change against `9467757`
- **Toolchain actually used:** Node `v22.23.1`, npm `11.6.0`
  - **Discrepancy:** the repository pins Node `24.19.0` (npm `>=11.6.0 <12`). npm is within the pin; Node is not. All gates below were executed on Node 22.23.1 and passed. This matches the Node version the runbook itself reports for the inspected shell; the runbook requires implementation acceptance on the pinned version. Recorded as MINOR-1.

## Command log

| # | Command | Exit code | Key result |
| --- | --- | --- | --- |
| 1 | `npm run lint` | 0 | `eslint . --max-warnings=0` — clean; no unresolved imports of deleted modules |
| 2 | `npm run typecheck:server` | 0 | `node scripts/next-target.mjs gen server && tsc --noEmit --incremental false` — full project compiles against server target |
| 3 | `npm test` | 0 | Vitest normal mode: **28 test files passed (28), 200 tests passed (200)**, ~1.9s. The six deleted test files are absent from the run (verified on-disk and absent from the file list). A second identical run was executed only to enumerate the file list; result identical. |
| 4 | `rg` route strings (`atividades\|materiais\|modulos\|/atividade\|atividade/[token]\|admin/jogos\|admin/auditoria`, case-insensitive) over `src/ tests/ contracts/ walkthrough.md docs/current-architecture.md docs/schemas/ ajuda/page.tsx` | 1 hit | Only `src/app/layout.tsx:12` — site metadata prose "Acesso às **atividades** educativas…" (generic Portuguese, not a route). See INFO-2. |
| 5 | `rg` deleted symbols/files (`access-link, AccessLink, portal-view-service, authorization-service, audit-actions, public-link-service, link-status, LinkStatus, service-container, prisma-capability-reader, material-editor, activity-builder, class-groups-explorer, share-actions, activity-controls, materials-explorer, public-state, activity-mark, isDemoRuntime, DEV_BYPASS_ACTOR`) over same scope | 3 lines | `docs/current-architecture.md:273` (factual deletion note — see INFO-1) and `src/server/auth/dev-bypass-gateway.ts:9,17` (the kept, unexported `DEV_BYPASS_ACTOR` const, per coupled edit 2). All other names: zero hits. |
| 6 | `rg -i "tokens"` over same scope | many hits | All reference the surviving `src/server/security/player-credential-tokens.ts` module, `DEMO_PLAYER_TOKENS` demo seed, or launch-token tests. `rg 'security/tokens'` (exact deleted-module import) over `src/ tests/`: **zero hits**. `player-credential-tokens.ts` existed at base (`git cat-file -e 9467757:…` OK) — not a renamed copy of the deleted file. |
| 7 | `rg` residual sweep (`jogos\|auditoria`) over `src/ tests/ contracts/schemas/README.md walkthrough.md` and `next.config.ts .env.example eslint.config.mjs package.json prisma/schema.prisma` | 2 hits | Only `AUTH_DEV_BYPASS` (`.env.example:30`, `next.config.ts:9`) — the surviving opt-in dev runtime flag, distinct from the deleted actor export. |
| 8 | `git diff --cached --name-status -- contracts/schemas/v1/` | 0 | **Empty — untouched.** |
| 9 | `git diff --cached --name-status -- contracts/ docs/schemas/` | 0 | Exactly: 8 schema artifacts deleted (6 root + 2 `games/`), `api-contracts.md` + `domain-rules.md` deleted; `contracts/schemas/README.md`, `docs/schemas/README.md`, `docs/schemas/database-model.md` modified (the latter two per P10 edit 6 / P20). Nothing else. |

All commands were run serially; no dev server, no Prisma migrate/db push/reset, no npm install, no `.env` edits; no tracked file modified.

## Deletion manifest verification (on-disk absence)

All seven route trees absent: `(professional)/portal/atividades`, `…/materiais`, `…/modulos`, `…/admin/jogos`, `…/admin/modulos`, `…/admin/auditoria`, `(public-play)/atividade`.
All eighteen modules absent: `access-link-service.ts`, `portal-view-service.ts`, `prisma-access-link-store.ts`, `authorization-service.ts`, `audit-actions.ts`, `public-link-service.ts`, `tokens.ts`, `prisma-capability-reader.ts`, `service-container.ts`, `link-status.ts`, `material-editor.tsx`, `activity-builder.tsx`, `class-groups-explorer.tsx`, `share-actions.tsx`, `activity-controls.tsx`, `materials-explorer.tsx`, `public-state.tsx`, `activity-mark.tsx`.
All six tests absent: `access-link-service.test.ts`, `authorization.test.ts`, `portal-dev-bypass-actions.test.ts`, `access-link-tokens.test.ts`, `link-status.test.ts`, `portal-dev-bypass.test.ts` (exact filenames checked; `v1-authorization.test.ts` is the surviving V1 suite, a different module).

## Change-set item verification

| Change-set item | Status | Evidence |
| --- | --- | --- |
| Delete 7 route trees | Yes | All absent on disk; `git status` shows `D` for each; no route-string references survive (grep table rows 4, 7). |
| Delete 18 services/stores/components | Yes | All absent on disk; symbol greps zero hits; lint + full-project typecheck compile every consumer with no unresolved imports. |
| Delete 6 tests | Yes | All absent; run contains 28 files, none of the six. |
| Delete Generation-A contract artifacts + 2 legacy schema docs | Yes | `git diff --cached` shows exactly the 8 JSON schemas + `games/` (2 files) + `docs/schemas/api-contracts.md` + `docs/schemas/domain-rules.md` deleted. |
| Keep `contracts/schemas/v1/` untouched | Yes | `git diff --cached --name-status -- contracts/schemas/v1/` empty. |

## Coupled edit verification

| # | Coupled edit | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `StatusBadge` → `"Ativa" \| "Inativa"`, no `ActivityStatus`, styles preserved | Yes | `src/components/portal/status-badge.tsx`: `type Status = "Ativa" \| "Inativa";`, ternary maps to `styles.statusPositive` / `styles.statusNeutral`. Base imported `ActivityStatus` from the deleted `portal-view-service` and had an 8-member union. `ActivityStatus` now has zero hits in `src/ tests/ prisma/schema.prisma`. CSS classes `.statusBadge` (:781), `.statusPositive` (:801), `.statusNeutral` (:806) all present in `portal.module.css`. |
| 2a | Drop `export` from `DEV_BYPASS_ACTOR`, keep const | Yes | `src/server/auth/dev-bypass-gateway.ts:9` is now `const DEV_BYPASS_ACTOR: PortalActor = {…}` (base line 9 was `export const …`); used internally at line 17. |
| 2b | Remove `isDemoRuntime` | Yes | Zero hits in `src/ tests/`; base had `export function isDemoRuntime(` in `src/runtime/mode.ts`; current `mode.ts` exports only `runtimeModeSchema`, `RuntimeMode`, `getRuntimeMode`. |
| 2c | Remove `Links de acesso` branch in `adult-portal-helpers.ts` | Yes | Base had the branch at `src/components/portal/adult-portal-helpers.ts:136` (`if (item.label === "Links de acesso")`). Current file has zero matches for `link\|acesso\|access` case-insensitively beyond the benign `demoAccessibleOrganizationIds` identifier. (Note: the runbook's path `src/application/adult-portal/adult-portal-helpers.ts` does not exist; the actual file is `src/components/portal/adult-portal-helpers.ts` — same file, judged by content.) |
| 2d | Update auth fixtures pointing at deleted routes | Yes | Base `tests/unit/auth.test.ts:146,147,154` asserted `isProtectedPathname("/portal/atividades")`, `"/portal/atividades/nova"`, `"/atividade/token/jogar"`; current file has zero such references. The underlying `isProtectedPathname` (`src/server/auth/gateway.ts:48-55`) is a generic `/portal` prefix check with no deleted-route enumeration. |
| 3 | Delete `entrar/recuperar/actions.ts` | Yes | File absent; `recuperar/page.tsx` survives; `rg "recuperar/actions"` over `src/ tests/`: zero hits. |
| 4 | `src/proxy.ts`: remove `/atividade/` condition, keep `/jogar` + `/jogar/` no-referrer, CSP, frame origins, matcher; update proxy test | Yes | Base `src/proxy.ts:113` had `pathname.startsWith("/atividade/") \|\|` — removed. Current lines 111–115 keep `/jogar` and `/jogar/` → `"no-referrer"`, default `"strict-origin-when-cross-origin"`; comment (lines 108–110) now describes only `/jogar`. CSP builder (lines 40–88), `frame-src` via `gameClientOrigin()` (lines 68, 76), and matcher (lines 134–136) intact. `tests/unit/proxy.test.ts` extended from 2 to 5 tests and covers the three behaviors: `/jogar` no-referrer (:27), `/jogar/` subpaths no-referrer (:34), other routes strict-origin-when-cross-origin (:41), plus CSP (:7) and correlation headers (:19). |
| 5 | `apiErrorCodes` reduced to exactly six codes | Yes | `src/server/http/errors.ts:5-12` = `AUTHENTICATION_REQUIRED, FORBIDDEN, VALIDATION_FAILED, CONFLICT, INTERNAL_SERVER_ERROR, SESSION_EXPIRED` — exactly the six, in order. Base had 19 codes (incl. `RESOURCE_NOT_FOUND`, `RATE_LIMITED`, `SERVICE_UNAVAILABLE`, `ACTIVITY_*`, `GAME_*`, `ATTEMPT_*`, `RESULT_*`, `SCHEMA_*`). No stray Generation-A HTTP code names remain. The `"NOT_FOUND"` comparisons in four portal pages target the separate application-layer `AdultPortalError` code union (`src/application/adult-portal/errors.ts:5`), which is surviving-product vocabulary, not an HTTP `apiErrorCodes` name. |
| 6 | Purge walkthrough.md + ajuda page; update current-architecture.md, docs/schemas/README.md, contracts/schemas/README.md | Yes | `walkthrough.md`: zero hits for deleted routes/symbols, no `DEV_BYPASS` description, no public activity URL, no deleted-route inventory — only surviving routes `/entrar`, `/portal`, `/jogar` and a historical note about the removed health endpoint. Ajuda page (`src/app/(professional)/portal/ajuda/page.tsx`): topics cover organizations, classes, numbered players, QR credentials, sessions, results, demo profiles — no access-link/link-status advertising; references `/jogar` (surviving). `docs/current-architecture.md` describes the four surviving containers and generated runtime entries; its only deleted-module mention is the factual note at line 273 (INFO-1). `docs/schemas/README.md` points only at `prisma/schema.prisma`, `contracts/schemas/v1`, `src/contracts/v1` and labels `portal-v1-specification.md` historical. `contracts/schemas/README.md` describes only the surviving GameMaker V1 protocol (its "activity" wording is game-protocol vocabulary like `activity_flow`, not Generation-A portal routes). |
| 7 | Whole first-party search for imports/route strings of the deletion set | Yes | Greps in command-log rows 4–7 over `src/ tests/ contracts/` + current docs: no live references. Config files (`next.config.ts`, `package.json`, `eslint.config.mjs`, `vitest.config.*`, `prisma/schema.prisma`, `.env.example`) clean apart from the surviving `AUTH_DEV_BYPASS` flag. No compatibility shims, redirects, or barrels were added (`/atividade/*` simply breaks). |

## Findings

- **MINOR-1 (toolchain):** Gates were executed on Node `v22.23.1`; the repository pins Node `24.19.0` (npm `11.6.0` is within `>=11.6.0 <12`). All gates passed on this Node version, which matches the shell the runbook itself was inspected with, but the runbook requires implementation acceptance on the pinned toolchain. CI (`.github/workflows/ci.yml`, P00) uses the pinned version, so the final acceptance path exists; this local run is the only gap.
- **INFO-1:** `docs/current-architecture.md:273` — "The former `service-container.ts` was deleted with the access-link generation." This is a current doc containing one deleted-module name, but as a factual deletion record in a sentence describing the four *surviving* containers; it does not present the module as current guidance. Acceptable; P50 copy polish may rephrase.
- **INFO-2:** `src/app/layout.tsx:12` — metadata description "Acesso às **atividades** educativas do projeto…" — generic Portuguese prose, not a reference to the deleted `/portal/atividades` route.
- **INFO-3:** `README.md:44` links `docs/implementation/README.md` as "Implementation roadmap" and `docs/current-architecture.md:302` says "See the implementation roadmap for slice-level status" without a historical label, while the runbook classifies `docs/implementation/*` as historical evidence. The executable plan itself self-labels "Status: historical planning record … must not be followed as current". No deletion-set content leaks through these pointers; labeling these docs is explicitly P50 item 3 scope. Not a P10 defect.

No CRITICAL or MAJOR findings. No deleted path, import, error code, or contract artifact remains live in `src/`, active tests, current user docs, or the live contract index.

## Acceptance criteria (P10) not satisfied

None. Notes on two criteria outside this review's gates: the clean-format/build gates (`build:server` / `build:demo`) are covered by the P30 review and were intentionally not run here; the static demo build assertion belongs to P30/P50. The pinned-Node acceptance caveat is MINOR-1 above.

VERDICT: PASS-WITH-FINDINGS
