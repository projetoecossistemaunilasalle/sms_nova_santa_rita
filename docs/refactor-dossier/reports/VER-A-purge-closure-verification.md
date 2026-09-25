# VER-A — Adversarial verification of `INV-A-purge-closure.md` (§2 Generation A purge)

**Agent:** VER-A (refutation pass)
**Date:** 2026-09-23
**Target:** `docs/refactor-dossier/reports/INV-A-purge-closure.md`
**Repo state at start and end of this run:** `git status --short` → `?? docs/refactor-dossier/` only. No project file was created, modified, or deleted by this agent. Every experiment ran in `C:\tmp\VER_A\` (outside the repo) and is listed in §7 for cleanup.

## 0. Headline

**The closure claim SURVIVED — and I proved it a way INV-A did not: by executing the purge.**

I copied `src/ tests/ contracts/ prisma/ public/` plus all root configs to three scratch trees outside the repo, junction-linked the repo's `node_modules`, and ran the real gates:

| Sim | What I applied | `tsc --noEmit` | `eslint . --max-warnings=0` | `vitest run` | `prettier --check` (edited files) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `sim2` | **delete the 46 files only, zero edits** | **1 error**: `src/components/portal/status-badge.tsx:1:37 TS2307 Cannot find module '@/server/services/portal-view-service'` | — | — | — |
| `sim2` | 46 deletions **+ E1 only** (status-badge) | **exit 0** | **exit 0** | **27 files / 182 tests / 0 failed** | needs the prettier form (see §5) |
| `sim` | 46 deletions + **E1..E7 + §2.5 (with `:97`)** | **exit 0** | **exit 0** | **27 / 182 / 0 failed** | **clean** |
| `sim3` | **the plan exactly as written** (§2.1.1 prune 3 members of `ActivityStatus`, §2.1.3 delete `proxy.ts:109-116`, all deletions) | **exit 2**: `src/proxy.ts:112:7 TS1128 Declaration or statement expected` | — | — | — |
| `sim3` | same, with only the proxy line restored | **exit 2**: `status-badge.tsx:1 TS2307` (one error) | — | — | — |

So: **exactly one surviving→deleted code edge**, and **exactly one 8-line edit closes the whole purge at build, lint and test level**. E3–E7 are hygiene, not gates (sim2 proves this). Baseline before any of it: `tsc` exit 0 (INV-A left this UNVERIFIED; it is green — 1,706 files, `status-badge.tsx` and `portal-view-service.ts` both in the program).

I did **not** find a dangling edge that breaks the build. I did find **three Generation-A residues INV-A missed** (all non-breaking) and **five material errors** in the dossier, one of which — the purge-percentage refutation — flips a headline number, and one of which — the `prisma migrate diff` flag — will stop Day 1 step 11 outright.

---

## 1. Verdict table

| # | Material claim in `INV-A-purge-closure.md` | Verdict | My own evidence |
| :--- | :--- | :--- | :--- |
| **Closure** | | | |
| C1 | Across the 46 candidates there is **exactly one** surviving→deleted code edge (`status-badge.tsx:1`) | **CONFIRMED (empirically)** | Independent import graph (299 files, 804 edges, all 9 `@runtime/*` aliases + relative + dynamic `import()` + `vi.mock()` + CSS resolved; `unresolved specifiers = 0`) → 1 hit. Then proven at runtime: `sim2` deletions-only yields **exactly one** `TS2307` |
| C2 | No route string / `redirect()` / `revalidatePath()` / nav entry / config alias dangles | **CONFIRMED** | `src/proxy.ts:113` and `tests/unit/auth.test.ts:146,147,154` are the only survivor-side route strings; every `redirect()`/`revalidatePath()` in survivors targets a surviving route (`src/app/(professional)/portal/adult-portal-actions.ts:73,92,93,110,111,127,128,156,173`, `src/application/adult-portal/service.ts:168,174,183,189`, `src/app/(professional)/portal/player-access-actions.ts:50-52`) |
| C3 | Zero `composes:` hits repo-wide | **CONFIRMED** | `grep -rn composes` over `*.css/*.scss/*.ts/*.tsx/*.md` excluding `node_modules`,`.next`,`out` → 0 |
| C4 | Nav tables (`service.ts:140-195`, `portal-navigation.tsx:60-125`) contain zero Generation-A entries | **CONFIRMED** | Read both in full — items are only `/portal`, `/portal/turmas`, `/portal/resultados`, `/portal/admin/organizacoes`, `/portal/admin/equipe`, `/portal/admin/organizacoes/{id}` |
| C5 | "`generateStaticParams` closure is clean: all **5** occurrences inside deleted trees … the **3** surviving ones" | **OVERSTATED (numbers wrong, conclusion right)** | Actual: **12** occurrences in deleted trees, **4** surviving — INV-A omits `src/app/(professional)/portal/resultados/[classGroupId]/players/[playerSlotId]/page.tsx:12`. All 4 survivors depend only on `@runtime/*` alias targets, so the *conclusion* holds |
| C6 | Config closure: no `@runtime/*` alias points at a deletion target | **CONFIRMED** | `next.config.ts:42-80` and `tsconfig.json:24-42` read in full; all 9 map to survivors |
| **§2.1 / status-badge** | | | |
| S1 | `ActivityStatus` (`src/server/services/portal-view-service.ts:9`) has **four** members | **CONFIRMED** | `"Aberta" \| "Rascunho" \| "Pausada" \| "Encerrada"` |
| S2 | §2.1.1 as written leaves the type import live → §2.3 is not closed | **CONFIRMED** | `sim3` with the plan's literal prune → `status-badge.tsx:1:37 TS2307` |
| S3 | The surviving comparisons hit **TS2367** "under `strict`/`noUncheckedIndexedAccess`" | **OVERSTATED** | TS2367 is real (`C:\tmp\VER_A\ts2367\prune.ts` → 3 hits) but fires **identically with `--strict` off**; it is not a strictness artefact. And under the plan-as-written the executor never reaches TS2367 — `TS2307` masks it (`sim3`). Line numbers `:18,:23,:25` are correct |
| S4 | All **10** call sites across the 6 surviving screens pass `recordStatusLabel(...)` | **CONFIRMED (quoted below, §4)** | `class-detail-screen.tsx:67,143` · `classes-screen.tsx:147` · `organization-detail-screen.tsx:134,181,225` · `organizations-screen.tsx:157` · `overview-screen.tsx:174,220` · `team-screen.tsx:341`. No raw string, no other helper |
| S5 | `recordStatusLabel` (`src/components/portal/adult-portal-helpers.ts:15`) returns exactly `"Ativa" \| "Inativa"` | **CONFIRMED** | `:15-17` |
| S6 | Proposed fix (collapse `Status` to `"Ativa" \| "Inativa"`) is correct | **CONFIRMED, with one defect** | Compiles and all gates green (`sim2`) **but the snippet as printed in INV-A §3 fails `prettier --check`, i.e. it breaks `npm run check`** (`package.json:24` runs `format:check` first). Correct form in §5 |
| S7 | Dead-union-member table (9 rows) | **OVERSTATED** | Omits `"Ativo"` (`status-badge.tsx:8`), which is also dead — its only two occurrences are the declaration and its own comparison at `:20`. Doesn't change the fix |
| S8 | `.statusWarning`/`.statusDanger` lose their **only** consumer | **CONFIRMED** | `styles.statusWarning`/`styles.statusDanger` occur in `status-badge.tsx` and nowhere else |
| S9 | "`.toast` (`portal.module.css:2463,2482`) also loses its last live consumer" | **WRONG as stated** | 5 consumers: 4 deleted components **plus the surviving `src/components/portal/demo-action-button.tsx:33`**. `.toast` dies only if §4.3's own recommendation (delete `demo-action-button`) is adopted. As written §3 asserts it follows from the purge alone |
| **§2.1.3 / proxy** | | | |
| P1 | §2.1.3's "`:109-116`" would delete live security code and is a syntax error | **CONFIRMED (empirically)** | `sim3` → `src/proxy.ts:112:7 TS1128`; leaves a dangling `: "strict-origin-when-cross-origin";` and an undefined `referrerPolicy` |
| P2 | Only line `:113` is dead; `:114-115` are live | **CONFIRMED** | `/jogar?cred=` at `src/components/portal/player-credential-print-sheet.tsx:22-24`; the game iframe is a cross-origin subresource of that document, so `Referrer-Policy` on `/jogar` is what keeps the bearer credential out of `Referer`. `:113` is permanently false once `src/app/(public-play)/atividade/` is gone |
| P3 | "`proxy.ts:137` matcher is path-agnostic, needs no change" | **CONFIRMED** | `matcher: "/((?!_next\|favicon.ico\|.*\\.(?:svg\|png\|jpg\|jpeg\|gif\|webp)$).*)"` |
| P4 | "`proxy.test.ts` cannot catch a bad edit here" | **CONFIRMED** | 2 tests (`:7`, `:19`), assert CSP + correlation + `X-Content-Type-Options` only; both hit `/entrar`, no `Referrer-Policy` assertion |
| **§2.5 / schema** | | | |
| D1 | The missed inverse relation is `OrganizationMembership.capabilityAssignments` at `prisma/schema.prisma:97` | **CONFIRMED (P1012 reproduced)** | Scratch `C:\tmp\VER_A\pv\schema.prisma`, §2.5 applied literally → `P1012 … Type "CapabilityAssignment" is neither a built-in type… --> schema.prisma:84` (line 97 renumbered). I **agree with both INV-A and INV-C** |
| D2 | Valid after adding `:97` to the checklist | **CONFIRMED** | `The schema at schema.prisma is valid 🚀`; also green in `sim/prisma/schema.prisma` (251 lines, 13 models, 5 enums) |
| D3 | No further residue | **CONFIRMED — no fifth deletion** | Residue grep on the validated file for `AccessLink\|Capability\|capability\|RateLimit\|rate_limit\|access_links` → **0 hits**; only surviving named relation is `@relation("AuditActor")` with exactly 2 occurrences (`:66`, `:292`); every `@@index`/`@unique` on a survivor references surviving fields |
| D4 | `Capability` enum has no surviving TS consumer; removal is safe | **CONFIRMED** | Zero hits for `link:view\|link:manage\|results:view_organization\|organization:manage\|user:manage\|audit:view` in `src tests contracts scripts`; `src/server/authorization/v1-policy.ts` is role-based (`OrganizationRole`/`PlatformRole`) and imports no `Capability`. Only `src/generated/prisma` symbols survivors import are `RecordStatus, OrganizationRole, PlatformRole, PlayerCredentialStatus, GameSessionStatus, Prisma, PrismaClient` — all survive |
| D5 | `RATE_LIMITED`: sole production use is `atividades/actions.ts:181`, no parity test | **CONFIRMED** | `"RATE_LIMITED"` occurs exactly twice in code (`atividades/actions.ts:181` deleted + `errors.ts:11`); `apiErrorCodes` is consumed only at `errors.ts:27,37` — **no `Record<ApiErrorCode,…>` map exists**, so shrinking the union is safe; `api-error` is **not** a key of `contractSchemasV1` (`src/contracts/v1/schemas.ts:440-458`) and the file lives at `contracts/schemas/`, not `contracts/schemas/v1/`, which `tests/unit/v1-contracts.test.ts:34-38` globs — so it is never loaded by any test |
| D6 | Day-1 step 11 `prisma migrate diff --from-migrations … --to-schema-datamodel …` | **REFUTED (new finding; INV-A's command fails)** | Prisma 7.9.1: `` `--to-schema-datamodel` was removed. Please use `--[from/to]-schema` instead. `` The replacement form `migrate diff --from-schema <before> --to-schema <after> --script` returned an **empty script with exit 0** for two schemas that differ by 4 declarations — so this gate can silently emit an empty `6_drop_generation_a`. See §6-B |
| **Counts** | | | |
| N1 | §2.2 = 1,754 (1,188 / 92 / 23 / 7 / 7 / **73** / 364) | **CONFIRMED** | `wc -l` per tree; auditoria is **73**, plan's 95 is wrong |
| N2 | §2.3 = 3,458, all 18 counts exact | **CONFIRMED** | `wc -l`, all 18 match |
| N3 | §2.4 = 2,590, all 6 counts exact | **CONFIRMED** | `wc -l` |
| N4 | Importer counts in §1.2 | **CONFIRMED except one** | All match my graph (`portal-view-service` 17→1, `access-link-service` 5→0, `tokens.ts` 6→0, `authorization-service` 5→0, `link-status` 3→0, `public-state` 3→0, `public-link-service` 1→0, `class-groups-explorer` 0→0 …). **`service-container.ts` is 2 importers, not 1** — `atividades/actions.ts` (7 × `await import()`, `:121,261,333,377,418,458,493`) **and** `tests/unit/portal-dev-bypass-actions.test.ts:27` (`vi.mock`, itself deleted). Surviving importers still 0 |
| N5 | Test totals 33/284 → 27/182, deleted 102 (56+24+13+5+2+2) | **CONFIRMED (measured, not arithmetic)** | `npx vitest run --reporter=json` before: **33 files / 284 tests**; the 6 §2.4 files hold **exactly 56/24/13/5/2/2 = 102**; after (`sim`): **27 files / 182 tests / 0 failed** |
| N6 | Handwritten baseline 34,012 = 27,433 + 6,579; 159 survivors | **CONFIRMED exactly** | `find … wc -l`; `229 code files − 46 deleted = 183`, `− 24 src/generated = 159` |
| N7 | §4.5 first half: plan rows sum to 7,824; `7,729 = 7,824 − 95`; measured 7,802 | **CONFIRMED** | `1,188+92+23+7+7+95+364 = 1,776`; `1,776−95 = 1,681`; `1,681+3,458+2,590 = 7,729`; `xargs wc -l` over my 46-path list → **7,802 total** |
| N8 | §4.5 second half: "**No counting method I tried reproduces 29%**"; publish 22.9% | **REFUTED** | See §3. Handwritten **TypeScript-only** base (generated Prisma client and all CSS excluded) = 26,675 lines → `7,802 / 26,675 = **29.25%**` and the plan's own `7,729 / 26,675 = **28.97%**`. The plan's percentage is right; only its line total is wrong |
| **Dead code / reachability** | | | |
| R1 | `/portal/admin` already 404s (no `page.tsx`) | **CONFIRMED** | `ls src/app/(professional)/portal/admin/` → `auditoria equipe jogos modulos organizacoes`, no `page.tsx` |
| R2 | The auditoria page is unreferenced today | **CONFIRMED** | 0 importers; `grep -rn auditoria src tests scripts contracts public` → only its own `:13` title and prose in a deleted file |
| R3 | "6 legacy redirect stubs" (§7, §9) | **WRONG — it is 4** | Bare `redirect("/portal")` stubs: `portal/modulos/page.tsx:6`, `portal/modulos/[id]/page.tsx:15`, `portal/admin/jogos/page.tsx:6`, `portal/admin/modulos/page.tsx:6` |
| R4 | `AuditEvent`: sole writer `prisma-access-link-store.ts:325-326`, sole reader the deleted page | **CONFIRMED** | Case-insensitive sweep returns exactly INV-A's 5 sites + `tests/unit/access-link-service.test.ts:15,47,273`; all deleted. Post-purge it is a read-nothing/write-nothing table with a live inverse at `:66`/`:292` |
| R5 | `/atividade/[token]` hard-404s with no shim possible under `output:"export"` | **CONFIRMED** | `next.config.ts:28`; no `redirects()` in `next.config.ts`; `public/` holds only `.gitkeep .nojekyll favicon.ico icon.svg` — **no `_redirects`** (and GitHub Pages ignores it anyway); no `sitemap*`/`robots*`/`*.html`/`*.md` anywhere in `src/` or `public/`; `out/atividade/` exists but `out` is gitignored (`.gitignore`) so it is a stale local artifact, never a shipped shim. `.github/workflows/deploy.yml` publishes `./out` with **no lint/typecheck/test step** |
| **Missed deletions** | | | |
| M1 | `demo-action-button.tsx` 39 lines, 0 importers | **CONFIRMED** | `wc -l` = 39; `demo-action-button\|DemoActionButton` occurs exactly once repo-wide: its own declaration at `:9` |
| M2 | `src/server/http/base-url.ts` 45 lines, 0 callers | **CONFIRMED** | `getPublicBaseUrl` occurs exactly once: the declaration at `:22` |
| M3 | `isDemoRuntime` has 11 occurrences, 10 inside the delete set, 0 users after | **CONFIRMED** | 8 in `atividade/[token]/{page,[state],jogar,jogar/[state]}`, 2 in `portal-view-service.ts:4,7`, 1 declaration `src/runtime/mode.ts:13`. `tests/unit/runtime-mode.test.ts` does not import it (3 tests, all `getRuntimeMode`). Deleting it **before** the purge breaks the build — `sim` confirms it is safe only after |
| M4 | `getGameClientUrl` 0 users | **CONFIRMED** | single occurrence, `src/server/config/game-client.ts:38` (alias re-export of `resolveGameClientUrl`) |
| M5 | `createGameLaunchUrl` 0 production callers | **CONFIRMED** | `game-client.ts:44-48` + `tests/unit/game-client.test.ts:4,27,30` (3 tests) |
| **Tests** | | | |
| T1 | "**Only one surviving test needs editing**" | **CONFIRMED (and understated: zero *must* edit)** | All 27 surviving test files: the only deleted-route strings are `tests/unit/auth.test.ts:146,147,154`; `isProtectedPathname` (`src/server/auth/gateway.ts:48-54`) is a generic `/portal` prefix predicate so all three **still pass**. Every `vi.mock()` module path in survivors resolves to a surviving module (`server-only`, `next/cache`, `@/server/db/client`, `@/server/auth/gateway`, `@/server/services/player-access-container`, `@/server/config/env`). No survivor asserts on routes, nav tables, the proxy matcher, or file counts. `sim2` (E1 only) → 182/182 green, so E7 is optional hygiene |
| **§0 baseline** | | | |
| B1 | Day 0 "commit 30 untracked files + migrations 4 & 5" is done; tree clean | **CONFIRMED** | `git status --short` → `?? docs/refactor-dossier/`; `git ls-files prisma/migrations` shows `0_init…5_v1_game_events` |
| B2 | "`npm run typecheck` UNVERIFIED" | **RESOLVED — it is GREEN** | `tsc -p tsconfig.json --noEmit --incremental false` → exit 0, 1,706 files, 5.6 s |
| B3 | *Not in INV-A:* `npm run format:check` | **ALREADY RED on main** | `npx prettier --check .` → `[warn] REFACTOR_PLAN.md`, exit 1. So `npm run check` (step 13) fails for a reason that predates the purge; INV-A's gate table omits it |

---

## 2. Dangling-edge sweep — methods used and every hit classified

### Methods (independent of INV-A's)

1. **Own import-graph build** (`C:\tmp\VER_A\graph.mjs`): regex extraction of `import … from`, `export … from`, bare `import "…"`, `import("…")`, `require("…")`, `vi.mock("…")`, `jest.mock("…")`, CSS `@import`, over **299 files** (`src`, `tests`, `scripts`, `contracts`, `.github`, `prisma`, `next.config.ts`, `vitest.config.mjs`, `eslint.config.mjs`) → **804 edges**; resolution of `@/`, all 9 `@runtime/*` aliases (both the `tsconfig` server target and the `next.config` demo target), and relative specifiers with the 14-extension candidate set. Intersected with the 46-path set. **Unresolved internal specifiers: 0** (so nothing escaped resolution).
2. **Reverse-importer table** per deleted file (`graph3.mjs`/`graph4.mjs`), including `vi.mock` edges.
3. **Newly-dead analysis** — *the inverse question the task asks for*: forward reachability from entry points (`src/app/**`, `src/proxy.ts`, tests, configs) with the 46 files removed. Result: the after-purge dead set is **byte-identical to the pre-purge dead set**. **No survivor becomes dead because its only consumer was deleted.** (Baseline/after dead list: `src/app/{loading,not-found,page}.tsx` — Next conventions, false positives; `demo-action-button.tsx`; `src/server/http/base-url.ts`; 6 `@runtime` demo variants — alias false positives, all verified live by reading `next.config.ts:42-80`.)
4. **Route-literal grep** with a deliberately *broader* regex than INV-A's (`/portal/(atividades|materiais|modulos)|admin/(jogos|modulos|auditoria)|/atividade/|/portal/admin\b`) → 66 hits in 26 files, then split by survivor/deleted.
5. **Path-argument coupling**: every `redirect(`, `revalidatePath(`, `revalidateTag(`, `router.push/replace`, `window.location`, `href=`, `generateStaticParams`, `pathname.startsWith/includes`, `matcher`.
6. **Token literals**: `7FQ-29M`, `2KF-81P`, `habitos-saudaveis`, `turma-5b`, `activity_token`, `(public-play)`, `(professional)`.
7. **Identifier sweep** with my own 60-term pattern (superset of INV-A's 40) over exactly the 159 survivors.
8. **Generated-client coupling**: every `@/generated/prisma` symbol imported by a survivor, checked against what §2.5 deletes.
9. **Non-code refs**: `contracts/`, `scripts/`, `.github/workflows/`, `prisma/` (no `seed*` exists), `eslint.config.mjs`, `next.config.ts`, `tsconfig.json`, `vitest.config.mts`, `public/`, `out/`.
10. **CSS**: `composes`, `@import`, `styles.<class>` consumer map for 20 classes.
11. **Execution**: the four purge simulations in §0.

### Every hit, classified

| Hit | `file:line` | Classification | Note |
| :--- | :--- | :--- | :--- |
| `import type { ActivityStatus } from "@/server/services/portal-view-service"` | `src/components/portal/status-badge.tsx:1` | **SURVIVOR-MUST-EDIT** (build-breaking) | The single edge. `TS2307` proven |
| `request.nextUrl.pathname.startsWith("/atividade/") \|\|` | `src/proxy.ts:113` | **SURVIVOR-SHOULD-EDIT** (inert) | Not a break (`sim2` green with it intact) |
| `isProtectedPathname("/portal/atividades")` / `("…/nova")` / `("/atividade/token/jogar")` | `tests/unit/auth.test.ts:146,147,154` | **SURVIVOR-SHOULD-EDIT** (stale fixture) | Still passes; `gateway.ts:48-54` is a generic prefix test |
| `if (item.label === "Links de acesso") { return routePath.startsWith(itemPath) && !routePath.endsWith("/resultados"); }` | `src/components/portal/adult-portal-helpers.ts:136-138` | **SURVIVOR-SHOULD-EDIT** — **MISSED BY INV-A** | The only special case ever written for the `/portal/atividades` nav item. Zero nav items carry that label today (verified against `service.ts:140-195`, `portal-navigation.tsx:60-125`) and **no test exercises it** (`portal-navigation.test.ts` uses `label: "Visão geral"` only; `demo-portal-helpers.test.ts` has no `label` hit). Generation-A residue in a live file |
| `"activityToken"`, `"attemptToken"` in the pino redact list | `src/server/observability/logger.ts:11-12` | **HARMLESS / MISSED BY INV-A** | Keys for the deleted generation's URL params. Flag the flip side: `cred` (the surviving V1 bearer credential, `player-credential-print-sheet.tsx:23`) is **not** redacted — out of §2 scope, worth a §3 note |
| `"Acesso às atividades educativas…"` | `src/app/layout.tsx:12` | **HARMLESS** | metadata prose |
| `"Preparando a atividade…"` | `src/app/loading.tsx:15` | **HARMLESS** | prose |
| `"Última atividade"` / `"Sem atividade"` | `src/components/portal/results-screen.tsx:195,221` | **HARMLESS** | V1 reporting column labels |
| `"A atividade desta turma terminou…"` | `src/components/public/player-entry-screen.tsx:42` | **HARMLESS** | prose |
| `id_atividade`, `versao_atividade`, `numero_tentativa_atividade`, `idAtividade` | `src/contracts/v1/schemas.ts:159,161,164,241,246` | **HARMLESS — DO NOT TOUCH** | V1 wire-protocol field names, mirrored in `tests/unit/game-event-ingestion.test.ts:126-131`; unrelated to Generation A |
| `/portal/admin/organizacoes`, `/portal/admin/equipe` | `adult-portal-actions.ts:73,92,93,110,111,127,128,156,173`; `service.ts:168,174,183,189`; `portal-navigation.tsx:72,78,106,112`; `overview-screen.tsx:155,163`; `organizations-screen.tsx:151,188`; `organization-detail-screen.tsx:208` | **HARMLESS** | 22 of my 66 route hits. Artifacts of my broader `/portal/admin\b`; these routes survive. INV-A's narrower grep never saw them — not an INV-A error |
| `.toast` | `src/components/portal/demo-action-button.tsx:33` | **MISCLASSIFIED BY INV-A** | Keeps `.toast` alive; contradicts INV-A §3 as written (S9) |
| `styles.statusWarning` / `styles.statusDanger` | `src/components/portal/status-badge.tsx:24,28` | **CONFIRMED dead after E1** | no other consumer |
| `.adminNavGroup` | `src/components/portal/portal.module.css:2537,2548` | **CONFIRMED already dead** | 0 `styles.` consumers (CSS-module scoping means a bare `.adminNavGroup` can come from nowhere) |
| `model RateLimitBucket` / `"RATE_LIMITED"` | `prisma/schema.prisma:300-310`; `src/server/http/errors.ts:11`; `contracts/schemas/api-error.v1.schema.json:21` | **SURVIVOR-SHOULD-EDIT (per plan)** | plus: `RateLimitBucket` has **zero** code references of any kind (no `prisma.rateLimitBucket` call ever) — stricter than INV-A states |
| 8 unused `ApiErrorCode` members | `src/server/http/errors.ts:14-21` + `…api-error.v1.schema.json:24-31` | **HARMLESS, plan-level suggestion** | confirmed 1 occurrence each = the declaration. Also unused-but-not-Generation-A: `SERVICE_UNAVAILABLE` (`:12`) and `RESULT_SCHEMA_INVALID` (`:22`) |
| `class-groups-explorer.tsx`, `demo-action-button.tsx`, `base-url.ts`, `entrar/recuperar/*`, `getGameClientUrl`, `createGameLaunchUrl` | see §4.3 of INV-A | **DELETION-MISSED / CONFIRMED** | all counts reproduced |
| `out/atividade/`, `out/portal/atividades/` | `out/` | **HARMLESS** | gitignored stale build output; not a shim |

**Sweeps that returned nothing at all (so nothing can dangle there):** `sitemap*`, `robots*`, `_redirects`, `_headers`, any `*.html`/`*.md` under `src/` or `public/`, `prisma/seed*`, `@import` in CSS, `composes` repo-wide, `/portal/modulos` outside the stubs, `admin/(jogos|modulos|auditoria)` outside the stubs, `(public-play)`/`(professional)` as runtime strings, route/module strings in `scripts/` and `.github/`, barrel `export * from` into the delete set.

---

## 3. Corrections to line counts / the purge total (publishable numbers)

All 45 non-schema line counts in §2.2/§2.3/§2.4 are **exact** as INV-A measured them, and the subtotals `1,754 + 3,458 + 2,590 = 7,802` reproduce under `wc -l` over my independently-built 46-path list. Auditoria is **73**, not the plan's 95. Test deltas are measured, not inferred: 284 → 182 (102 removed, −35.9%), 33 → 27 files.

**Where INV-A goes wrong is the denominator.** It picks a base that *includes 7,337 lines of CSS modules* (`34,012 = 27,433 + 6,579`) and then declares "no counting method I tried reproduces 29%". The deletion set contains **zero CSS files**, so the like-for-like base is handwritten **TypeScript only**, generated Prisma client excluded:

| Base (measured with `find … -print0 | xargs -0 wc -l`) | Lines | 7,802 | plan's 7,729 |
| :--- | ---: | ---: | ---: |
| `src/**/*.ts{,x}` excl. `src/generated/**` | 20,096 | 38.8% | 38.5% |
| `tests/**` (all `.ts`) | 6,579 | — | — |
| **handwritten TS/TSX total (code-only purge numerator)** | **26,675** | **29.25%** | **28.97%** |
| + `src/**/*.css` excl. generated (7,337) = 34,012 | 34,012 | 22.94% | 22.72% |
| src incl. CSS only | 27,433 | 28.44% | 28.17% |
| src-only purge / src-only base (5,212 / 27,433) — INV-A's "19.0%" | 27,433 | 19.00% | — |

Note that INV-A's "against `src` alone it is 19.0%" silently drops §2.2's 1,754 lines from the *numerator* while keeping the src denominator — that is the only way to get 19%, and it is not the same ratio the plan is making.

**Numbers the dossier should publish**

> **Purge volume: 7,802 physical lines across 46 files** (measured; `§2.2 = 1,754` / `§2.3 = 3,458` / `§2.4 = 2,590`; auditoria corrected to 73, not the plan's 95).
> **= 29.3% of the handwritten TypeScript codebase** — base 26,675 lines = 20,096 `src/**/*.ts{,x}` (excluding the 29,722 generated Prisma-client lines) + 6,579 `tests/**/*.ts`. Post-purge handwritten TS: **18,873 lines**.
> **= 22.9% of all handwritten lines including CSS modules** — base 34,012.
> The plan's `~7,729` is 73 lines short (it omits the auditoria row it added to §2.2); its **`~29%` is correct** under the TS-only base. Replace §2's total with 7,802 and keep the percentage.

---

## 4. Additional missed deletions or must-edit survivors

INV-A's §4.3 list is confirmed line-for-line (`demo-action-button.tsx` 39/0, `base-url.ts` 45/0, `isDemoRuntime` 11→1, `getGameClientUrl` 1, `createGameLaunchUrl` 0 production, `recuperar` unlinked, `DEV_BYPASS_ACTOR` export-only, 8 dead `ApiErrorCode` members). Add:

| # | Item | `file:line` | Class | Action |
| :--- | :--- | :--- | :--- | :--- |
| A1 | `"Links de acesso"` special case in the nav-currentity helper | `src/components/portal/adult-portal-helpers.ts:136-138` | dead branch, 0 producers, 0 tests | Delete the 3-line `if` in the §2.1 hygiene pass. It is the *last* executable trace of the `/portal/atividades` nav item; `!routePath.endsWith("/resultados")` existed only to disambiguate `/portal/atividades/[id]/resultados`. `sim` proves removing it is safe |
| A2 | `activityToken` / `attemptToken` redaction keys for a deleted URL contract | `src/server/observability/logger.ts:11-12` | dead config | Optional trim. **Related live gap to log for §3:** `cred` (V1 bearer credential in a query string, `player-credential-print-sheet.tsx:23`) is not in `sensitivePaths`; after the purge `/jogar?cred=` is the *only* token-in-URL flow left |
| A3 | `RateLimitBucket` has never had a single code reference | `prisma/schema.prisma:300-310` | strengthens §2.5.4 | Say so: not "the code that used it is deleted" but "nothing ever read or wrote it" |
| A4 | `tests/unit/portal-dev-bypass-actions.test.ts:27` is a second importer of `service-container.ts` | `vi.mock("@/server/services/service-container")` | importer-count nit (2, not 1) | No action — the test is itself in §2.4 |
| A5 | `REFACTOR_PLAN.md` is not prettier-clean on `main` today | `npx prettier --check .` → `[warn] REFACTOR_PLAN.md` | pre-existing gate failure | Fix in E9 or `npm run check` stays red for an unrelated reason |
| A6 | `/entrar/recuperar` characterization | `src/app/(professional)/entrar/recuperar/{page.tsx,actions.ts}` | INV-A **OVERSTATED** | It is **unlinked**, not "unreachable": it is a real App Router page, prerendered in the export, reachable by URL. The `"use server"` observation is right and matters for §3.1/E625 |

**No fifth schema deletion exists** (see D3): after `:97` the residue grep is empty and only `@relation("AuditActor")` remains paired. I agree with both INV-A and INV-C that `:97` is *the* miss.

---

## 5. The status-badge and proxy instructions an implementer should actually follow

Both edits below were applied verbatim in `C:\tmp\VER_A\sim` and are **tsc-green, eslint-green, prettier-green, 182/182 tests green**.

### 5.1 E1 — `src/components/portal/status-badge.tsx`: replace the whole file (currently 33 lines)

INV-A's §3 snippet is semantically right but **fails `prettier --check`** (its `const tone = … ? … : …;` line is 82 chars; `printWidth` is the prettier default 80). Prettier-canonical form — use this exact text:

```tsx
import styles from "./portal.module.css";

export function StatusBadge({ status }: { status: "Ativa" | "Inativa" }) {
  const tone =
    status === "Ativa" ? styles.statusPositive : styles.statusNeutral;

  return <span className={`${styles.statusBadge} ${tone}`}>{status}</span>;
}
```

Why this and not the plan's §2.1.1: `ActivityStatus` (`src/server/services/portal-view-service.ts:9`) has **four** members, so pruning three still leaves `"Encerrada"` bound to a file §2.3 deletes — `sim3` shows the executor's real error is `status-badge.tsx(1,37) TS2307 Cannot find module`, not the TS2367 INV-A predicted. Removing the `import type` at `:1` is what actually severs the edge. The three comparisons at `:18,:23,:25` do hit TS2367 in isolation (proven in `C:\tmp\VER_A\ts2367\prune.ts`) but note TS2367 is **not** gated on `strict`/`noUncheckedIndexedAccess` — it fires with `--strict` off too, so INV-A's attribution should be corrected.

Zero JSX churn is real: all 10 surviving call sites pass `recordStatusLabel(...)` (`src/components/portal/adult-portal-helpers.ts:15`, `recordStatusLabel(status: RecordStatus): "Ativa" | "Inativa"`):

- `src/components/portal/class-detail-screen.tsx:67` `<StatusBadge status={recordStatusLabel(classGroup.status)} />`
- `src/components/portal/class-detail-screen.tsx:143` `<StatusBadge status={recordStatusLabel(teacher.status)} />`
- `src/components/portal/classes-screen.tsx:147` `<StatusBadge status={recordStatusLabel(classGroup.status)} />`
- `src/components/portal/organization-detail-screen.tsx:134` `<StatusBadge status={recordStatusLabel(organization.status)} />`
- `src/components/portal/organization-detail-screen.tsx:180-182` `<StatusBadge`⏎`status={recordStatusLabel(classGroup.status)}`⏎`/>`
- `src/components/portal/organization-detail-screen.tsx:225` `<StatusBadge status={recordStatusLabel(member.status)} />`
- `src/components/portal/organizations-screen.tsx:157` `<StatusBadge status={recordStatusLabel(organization.status)} />`
- `src/components/portal/overview-screen.tsx:173-175` `<StatusBadge`⏎`status={recordStatusLabel(organization.status)}`⏎`/>`
- `src/components/portal/overview-screen.tsx:220` `<StatusBadge status={recordStatusLabel(classGroup.status)} />`
- `src/components/portal/team-screen.tsx:341` `<StatusBadge status={recordStatusLabel(member.status)} />`

No call site passes a raw string or another helper. `styles.statusBadge` (`portal.module.css:1038`), `styles.statusPositive` (`:1058`) and `styles.statusNeutral` (`:1073`) all exist, so the badge still renders. Do this **before** §2.3; nothing else in the manifest has to precede anything else (`sim2` proves a single-commit purge works once E1 lands).

Also correct INV-A §3's consequence note: after E1, `.statusWarning`/`.statusDanger` become dead, but **`.toast` does not** — it stays live through `src/components/portal/demo-action-button.tsx:33`, which §2 does not delete.

### 5.2 E3 — `src/proxy.ts`: delete **line 113 only**, and reword the comment

Do **not** touch `:112`, `:114`, `:115`, `:116`, `:117`, `:118`. `sim3` demonstrates that the plan's `:109-116` range deletes the `const referrerPolicy =` head and the ternary's true arm, leaving `src/proxy.ts:112:7 TS1128 Declaration or statement expected`.

Cut this single line:

```ts
    request.nextUrl.pathname.startsWith("/atividade/") ||
```

so the block becomes, with the comment rewritten for the surviving flow:

```ts
  // Player entry links carry the bearer credential in ?cred= and the game
  // iframe is embedded from it, so /jogar is served with 'no-referrer' to keep
  // the credential out of Referer. Other routes keep a stricter default.
  const referrerPolicy =
    request.nextUrl.pathname === "/jogar" ||
    request.nextUrl.pathname.startsWith("/jogar/")
      ? "no-referrer"
      : "strict-origin-when-cross-origin";
  response.headers.set("Referrer-Policy", referrerPolicy);
```

`:114-115` are load-bearing: `src/components/portal/player-credential-print-sheet.tsx:22-24` builds `new URL(`${basePath}/jogar/`, origin)` + `searchParams.set("cred", token)`, and that document mounts the cross-origin GameMaker iframe (CSP `frame-src` at `src/proxy.ts:68`), so without `no-referrer` on `/jogar` the credential leaves in `Referer`. This is the one *accidental* security regression in §2 and the report is right to block it. `config.matcher` (`:137`) needs no change. `tests/unit/proxy.test.ts` has 2 tests hitting `/entrar` and asserts only CSP/correlation/`nosniff` — it **cannot** catch a bad edit here, so eyeball the diff.

### 5.3 Order, corrected

INV-A's 13-step order is safe but over-serialized. Empirically the only hard constraint is **E1 before deleting `portal-view-service.ts`**, and **§2.5's `:97` with `model CapabilityAssignment`**. Two corrections to the step list:

- **Step 11 (migration) command is invalid on Prisma 7.9.1.** `--to-schema-datamodel` was removed. Use `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --shadow-database-url "$SHADOW_URL"`. And do not accept a silent empty script (see §6-B).
- **Add a `prettier --write` on touched files before step 13**, and note `format:check` is already red on `main` for `REFACTOR_PLAN.md`.

---

## 6. Claims that did not survive

**A. §4.5 — "the `~29% of handwritten code` claim is overstated … No counting method I tried reproduces 29%."** Refuted. Under the natural like-for-like base (handwritten TypeScript; the purge deletes no CSS), `7,802 / 26,675 = 29.25%`, and the plan's own `7,729 / 26,675 = 28.97%`. The plan's line total is wrong by 73; its percentage is right. INV-A's 22.9% is legitimate only with CSS in the base, and must then be labelled as such. Its "19.0% against src alone" mixes a src-only denominator with a src-only numerator while the headline used an all-code numerator — the two INV-A numbers are not comparable to each other.

**B. §10 step 11 — `--to-schema-datamodel`.** Refuted: Prisma 7.9.1 errors out, `Please use --[from/to]-schema instead`. Worse, `migrate diff --from-schema <A> --to-schema <B> --script` returned **0 bytes with exit 0** for two schemas differing by 4 declarations (`AccessLink`, `CapabilityAssignment`, `RateLimitBucket`, `enum Capability`), i.e. an empty diff is not detectable from the exit code. `prisma validate` passing (which the dossier does rely on) proves only referential integrity, not that the DROP TABLE migration was written. Day 1's migration must be inspected for a non-empty `DROP TABLE "access_links", "capability_assignments", "rate_limit_buckets"; DROP TYPE "capability";` before it is committed. (I could not test the `--from-migrations` path — it needs a shadow database, which I was instructed not to touch. Flag as **UNVERIFIED** rather than safe.)

**C. §3/§4.3 — "`.toast` … loses its last live consumer."** Wrong as stated: `src/components/portal/demo-action-button.tsx:33` still uses it and is not in §2.3.

**D. §7/§9 — "the six redirect stubs."** There are **four** (`portal/modulos/page.tsx`, `portal/modulos/[id]/page.tsx`, `portal/admin/jogos/page.tsx`, `portal/admin/modulos/page.tsx`).

**E. §2 — "`generateStaticParams` … all 5 occurrences inside deleted trees … the 3 surviving ones."** Actual: 12 deleted-tree and 4 surviving; `resultados/[classGroupId]/players/[playerSlotId]/page.tsx:12` is omitted. Conclusion unaffected.

**F. §3(b) — TS2367 "under `strict`/`noUncheckedIndexedAccess`".** The error is real but unconditional; and it is not the error the plan-as-written produces (`TS2307`).

**G. §3 — the 9-row dead-member table** omits `"Ativo"` (`status-badge.tsx:8`), also producerless.

**H. §1.2 — `service-container.ts` "1 importer".** Two: `atividades/actions.ts` and `vi.mock` in `tests/unit/portal-dev-bypass-actions.test.ts:27`. Both deleted; surviving count 0 stands.

**I. §4.3 — `/entrar/recuperar` "is unreachable".** It is *unlinked*; as an App Router page it renders at its URL and is exported. Substance (no inbound reference, `"use server"` module) is correct.

**J. §0 gate table — `typecheck UNVERIFIED`.** Now verified green (exit 0). And the table omits `format:check`, which is **already red** on `main` (`REFACTOR_PLAN.md`).

**Not refuted, stated for the record:** the closure claim itself, the 7,802 total, the 45 line counts, auditoria 73, the `P1012`/`:97` blocker, the `proxy.ts` line-range hazard, `ActivityStatus`' four members, all 10 `recordStatusLabel` call sites, the 0-`composes` result, both dead-file counts, the `AuditEvent` writer/reader sweep, the `/portal/admin` 404, the no-shim-under-`output:"export"` finding, the 27/182 post-purge suite, and "only one surviving test needs editing." **Day 1 as specified in INV-A's work order is executable**, with the E1 snippet swapped for the prettier form in §5.1 and the step-11 flag fixed.

---

## 7. Reproduction / cleanup

Everything this run created lives outside the repo: `C:\tmp\VER_A\` (`graph.mjs`, `graph2-4.mjs`, `apply_sim.mjs`, `parse2.cjs`, `deleted.txt`, `survivors_nogen.txt`, `all_code.txt`, `edges.json`, `vitest_{before,after,sim2}.json`, `sb_exact.tsx`, `sb_pretty.tsx`, `schema_before.prisma`, `sim/`, `sim2/`, `sim3/`, `pv/schema.prisma`, `diff.sql`, `diff.err`) and the MSYS mirror `/tmp/VER_A/`. `sim*/node_modules` are NTFS junctions to the repo's real `node_modules` — delete with `rd`/`fs.rm` on the link, never recursively through it. Verification: `git status --short` after this run still reports only `?? docs/refactor-dossier/`, `prisma/schema.prisma` unmodified, `tsconfig.tsbuildinfo` untouched (`--incremental false` used throughout). No `next build`/`dev`, no `prisma generate`, and no database connection was performed.
