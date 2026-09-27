# Architecture audit and remediation plan

> **Status: historical document.** This audit describes the pre-refactor
> architecture at commit `d4af23c`, including the retired Generation-A product
> (access links, activities/materials/modules, capability authorization). It is
> retained as historical evidence and is not current implementation guidance;
> see
> [docs/refactor-dossier/IMPLEMENTATION-READY.md](refactor-dossier/IMPLEMENTATION-READY.md)
> and [docs/current-architecture.md](current-architecture.md) instead.

Status: Findings verified against commit `d4af23c` plus the uncommitted working tree of 23 September 2026.
Audit date: 23 September 2026.
Scope: portal (`src/app`), application services, persistence, runtime composition, player host, contracts, tests, CI.
Audience: whoever implements Slices 3-5 hardening and Slice 6+; section 8 needs sign-off before code changes.

## 0. Executive summary

**Verdict.** The code is not badly written; it is badly *layered*. Three product generations are compiled into one
application and kept alive at the same time:

1. **Generation A - the visual demo CMS** (activities, access links, materials, modules, aggregate fixtures).
2. **Generation B - the V1 platform** (organizations, classes, numbered player slots, QR credentials, sessions,
   revisioned state, event ingestion, reports) - this is the good part.
3. **Generation C - the static GitHub Pages mock** (a second, hand-maintained implementation of Generation B that runs
   in the browser with `localStorage`).

Generation B was never allowed to replace Generation A, and Generation C was glued onto both with build-time path
aliases. Most of the findings below are consequences of that single structural decision.

**What is healthy.** Typecheck, lint and the whole test suite pass. The application layer, the versioned JSON/Zod
contracts and the security posture are genuinely good and must be preserved (section 6). Nothing here requires a
rewrite: every finding has a bounded fix.

**Top five actions, in order**

| # | Action | Effort (est.) | Removes |
|---|---|---|---|
| 1 | Commit the working tree in coherent slices and add lint/typecheck/test to CI | 0.5-1 day | no rollback point; unguarded regressions |
| 2 | Replace the raw `@runtime/*` aliases with typed runtime contracts + a single composition root | 1.5-3 days | invisible demo variant; mode checks scattered in UI |
| 3 | Delete the Generation A route tree and its service/test mass | 2-4 days | ~6,000 lines, 56 of 284 tests, one authz model, 3 dead endpoints |
| 4 | Give the demo an *adapter* instead of a *copy* (one implementation of each server action) | 2-3 days | ~60% duplicated action code, no-op transactions, drift risk |
| 5 | Split the god files (`game-host`, `game-offline-sync`, `portal.module.css`, adult-portal service) | 2-4 days | untestable UI, 4,910-line stylesheet, 13-ref component |

**What we should explicitly refuse to do:** rewrite the application layer, replace Next.js/Prisma/Zod, or introduce a
new state-management or CSS framework. The debt is in boundaries and duplicates, not in the technology.

**Residual risk that no refactor fixes.** No migration has been applied to a real Neon database, no real GameMaker
HTML5 build exists, and no two-device/offline scenario has been exercised end to end. Those remain the acceptance
gates for a production V1 (see section 12, R1-R3).

## 1. Evidence base

Everything in this document was measured in this repository. Verification commands are listed in Appendix A so any
claim can be re-checked.

| Source | Detail |
|---|---|
| Toolchain runs | `npm run typecheck` (pass), `npx eslint src` (0 findings), `npm test` (33 files / 284 tests pass), `npm run build:demo` (109 static pages) |
| Negative checks | `npx next build` without the wrapper fails (`ZodError`, needs `APP_RUNTIME_MODE`); `out/` contains no `api/` or `health/`; `src/generated/prisma` is untracked |
| Static analysis | selector/hook/export/import counts, duplication diff, dead-code inventory, test-case census |
| Docs | `PRODUCT.md`, `docs/current-architecture.md`, `docs/implementation/*`, `README.md` |
| History | `git log` (17 commits), churn per file, index status |

## 2. Verification baseline

### 2.1 Proven in this environment

| Check | Command | Result |
|---|---|---|
| Types | `npm run typecheck` | pass (note: only the **server** variants of `@runtime/*` are checked) |
| Lint | `npx eslint src` | clean; no `any`, no `@ts-ignore`, no `eslint-disable` anywhere |
| Tests | `npm test` | 33 files / 284 tests pass in ~1.8 s |
| Demo build | `npm run build:demo` | pass, 109 prerendered pages, emits the static-export warning |
| Demo artifact | inspect `out/` | no `api/`, no `health/`; legacy routes prerendered |
| Standard Next CLI | `npx next build` | **fails** with `Failed to load next.config.ts … ZodError` (invalid/missing `APP_RUNTIME_MODE`) |
| Generated code | `git ls-files src/generated` | 0 tracked files (it is gitignored) |

### 2.2 Not proven (do not assume it works)

| Area | Status |
|---|---|
| Server build | Not run in this audit (needs a real Neon connection set). Docs claim it passes. |
| Database | `prisma/migrations/*` (5 migrations) never applied to a real database; `.env` holds `ep-example…` hosts |
| GameMaker integration | No HTML5 target exists in the companion repo; the protocol has never been exercised by a real game build |
| Cross-device state, offline reconnect, tablet QR | Never executed; explicitly listed as pending acceptance in `docs/implementation/slice-03-05-portal-handoff.md` |
| Production UX of legacy routes | In server mode they render empty or 404 (verified by reading the code path, not by running the server target) |

### 2.3 How "severity" is used in this document

- **S1 (critical)** - actively causes wrong behaviour, invisible failure modes, or blocks safe change.
- **S2 (high)** - large maintenance or correctness risk; will compound with every new slice.
- **S3 (medium)** - debt with contained blast radius.
- **S4 (low)** - hygiene and consistency.

## 3. Current state: inventory and metrics

### 3.1 Size and shape

Source excluding the generated Prisma client (24 files, 29,723 lines, untracked):

| Layer | Files | Lines (non-blank) | Comment |
|---|---:|---:|---|
| `src/components` | 45 | 12,416 | includes 5,700 lines of CSS modules |
| `src/server` | 38 | 4,283 | db stores, http, services, security |
| `src/app` | 57 | 3,143 | 36 pages, 4 route handlers |
| `src/runtime` | 16 | 2,934 | demo/server swap layer + IndexedDB engine |
| `src/application` | 12 | 1,550 | **the good part** (pure domain services + ports) |
| `src/contracts` | 3 | 536 | Zod mirrors of the JSON Schemas |
| `src/proxy.ts` | 1 | 124 | CSP nonce, correlation id, referrer policy |
| Tests | 33 | 5,924 | 284 tests, all node environment |
| Docs | 34 | 5,900 | `docs/` 4,624 + 1,276 lines of root `*.md` |

TypeScript/TSX excluding generated code: 165 files, 18,656 lines. CSS modules: ~6,050 lines.

### 3.2 Hot spots (files over 300 non-blank lines)

| Lines (total) | File | Problem shape |
|---:|---|---|
| 4,910 | `src/components/portal/portal.module.css` | 709 rules, 308 distinct classes, **imported by 37 files** - a design system wearing a CSS-module costume; 60 classes (19.5%) are dead |
| 1,625 | `tests/unit/access-link-service.test.ts` | bigger than any source file; tests a service the V1 model does not use |
| 1,222 | `src/runtime/game-offline-sync.ts` | IndexedDB schema + migrations + queue CRUD + SHA-256 fingerprint registry + sync policy + conflict policy |
| 1,024 | `src/runtime/adult-portal-demo-store.ts` | seed fixtures + localStorage I/O + two store classes emulating relational joins and cascades |
| 932 | `src/components/public/game-host.tsx` | iframe bridge, token refresh, HTTP transport, offline sync, conflict UX, demo adapter, 13 refs, 6 state hooks, 8 `runtimeMode` branches |
| 717 | `src/server/services/access-link-service.ts` | 10 lifecycle operations + validation + audit + transaction wiring |
| 688 | `src/components/marketing/marketing.module.css` | styling for sign-in/recovery pages; the name refers to a surface that does not exist |
| 616 | `src/application/adult-portal/service.ts` | 17 public operations + navigation construction inside the domain service |
| 540 | `src/components/portal/player-access-workflow.tsx` | 5 components + 2 helpers, including relational joins in a React helper |
| 521 | `src/server/services/portal-view-service.ts` | hardcoded fixtures for deprecated entities, exported from `server/services` |
| 517 | `src/app/(professional)/portal/atividades/actions.ts` | 6 server actions + expiry parsing + scope resolution + dev-bypass branches + 8 dynamic `await import()` calls |
| 467 | `src/server/db/prisma-adult-portal-store.ts` | 21 methods, 0 references in tests |
| 363 / 355 | `prisma-game-event-store.ts` / `prisma-player-access-store.ts` | large stores, integration-untested |
| 331 / 299 | `results-screen.tsx` / `adult-portal-helpers.ts` | full pages / domain-ish helpers inside `components` |

### 3.3 Duplication and drift risk

| Server module | Demo module | Duplication |
|---|---|---|
| `app/(professional)/portal/adult-portal-actions.ts` (205 lines) | `runtime/adult-portal-demo-actions.ts` (207 lines) | **124 identical lines = 60%**; same 10 exported actions |
| `app/(professional)/portal/player-access-actions.ts` (132) | `runtime/player-access-demo-actions.ts` (142) | same 4 actions + issuer class |
| `runtime/adult-portal-server.ts` (68) | `runtime/adult-portal-demo.ts` (64) | same 9 loaders, different data source |
| `runtime/game-events-server.ts` (38) | `runtime/game-events-demo.ts` (114) | same 5 exports, one computes fake reports |
| `app/(public-play)/jogar/actions.ts` (42) | `runtime/player-entry-demo-actions.ts` (38) | same entry action |

Copy-pasted helpers (no shared module): `formObject` x4, `validationError` x5, `actorProfileId` x2, `profileId` x2,
`requireActor` x2.

Consequence: every new portal mutation must be written twice, in two module systems (`"use server"` vs `"use client"`),
and nothing fails if they diverge.

### 3.4 Dead code, dead config and phantom routes

| Item | Evidence | Action |
|---|---|---|
| `resolvePublicLink()` - zero callers | `server/services/public-link-service.ts:34`; only referenced in a comment in `link-status.ts:11` | wire it into the player entry path or delete |
| `getDashboardData()` - throws in server mode | `portal-view-service.ts:418-421` (`"Slice 0"`) | delete with Generation A |
| `isProtectedPathname()` - zero callers | `server/auth/gateway.ts:48-55` | delete or use in proxy |
| `READINESS_TIMEOUT_MS` - validated, never read | `server/config/env.ts:73`; no other occurrence in `src/` | implement `/health/ready` or remove the variable |
| `RateLimitBucket` model - nothing reads/writes it | `prisma/schema.prisma:300-309`; no source reference | implement rate limiting or drop the model and the `RATE_LIMITED` code |
| 10 of 17 `parseXxxV1` wrappers never imported | `contracts/v1/parse.ts` | keep `safeParse*` used by tests; delete unused wrappers |
| Empty route directories | `src/app/health/live`, `src/app/health/ready` (+ 10 empty dirs) | delete; `README.md:53` currently claims these handlers exist |
| 3 redirect-stub routes | `/portal/modulos`, `/portal/admin/modulos`, `/portal/admin/jogos` | delete with Generation A |
| 60 unused CSS classes (19.5% of 308) | e.g. `dashboardGrid`, `gameCard`, `moduleOptionGrid`, `dangerNotice` | delete after Generation A removal (some belong to it) |

### 3.5 Alias map (the dual-runtime mechanism)

9 aliases in `next.config.ts:turbopack.resolveAlias`, consumed by **23 files / 24 import sites**:

```
@runtime/sign-in-action          -> runtime/demo-auth-actions.ts            | app/(professional)/entrar/actions.ts
@runtime/sign-out-action         -> runtime/demo-auth-actions.ts            | app/(professional)/portal/sign-out-action.ts
@runtime/adult-portal            -> runtime/adult-portal-demo.ts            | runtime/adult-portal-server.ts
@runtime/adult-portal-actions    -> runtime/adult-portal-demo-actions.ts    | app/(professional)/portal/adult-portal-actions.ts
@runtime/adult-portal-client     -> runtime/adult-portal-demo-client.ts     | runtime/adult-portal-server-client.ts
@runtime/player-access-actions   -> runtime/player-access-demo-actions.ts   | app/(professional)/portal/player-access-actions.ts
@runtime/player-entry-action     -> runtime/player-entry-demo-actions.ts    | app/(public-play)/jogar/actions.ts
@runtime/player-access           -> runtime/player-access-demo.ts           | runtime/player-access-server.ts
@runtime/game-events             -> runtime/game-events-demo.ts             | runtime/game-events-server.ts
```

`tsconfig.json` maps all nine to the **right-hand (server)** column; `vitest.config.mts` maps none of them. The one
exception worth knowing: the demo `signInAction`/`signOutAction` **throw**, and the demo modules are `"use client"`
while their server counterparts are `"use server"`.

### 3.6 Test census

| Fact | Value |
|---|---|
| Files / cases | 33 files, 284 executed cases (`it()` count 229, expanded by parameterisation) |
| Environment | `node` for all; no `.tsx` test exists |
| Coverage of the persistence layer | `PrismaAdultPortalStore`: **0 references in tests**; `PrismaPlayerAccessStore`/`PrismaGameEventStore`/`PrismaGameStateStore`: only call-shape assertions against hand-written `vi.fn()` doubles (`tests/unit/player-access-prisma.test.ts:13-58`) |
| Coverage of the runtime swap | none possible: `vitest.config.mts` has no `@runtime/*` alias |
| Coverage of the UI/protocol | none: `game-host.tsx` (932 lines) has no test; no route-handler test for the 4 `/api/v1/player/*` endpoints |
| Test mass vs. value | **56 cases (19.7%)** target `AccessLinkService`, whose only consumer is a route tree slated for deletion |
| Integration infrastructure | none: no testcontainers, PGlite, `pg`, or Neon branch usage in devDependencies |
| Thresholds | `vitest.config.mts` declares coverage reporters but no thresholds and no CI job runs them |

## 4. Diagnosis: how the codebase got here, and the six root causes

The repository has 17 commits; the most-changed file in its entire history is `portal.module.css` (5 commits). That
single statistic says most of the effort went into the visual demo, and the V1 platform was added beside it rather
than replacing it.

```
Generation timeline
A. demo CMS            activities / access links / materials / modules / aggregate fixtures
                       -> portal-view-service fixtures, /portal/atividades, /portal/materiais, /portal/modulos
B. V1 platform         organizations / classes / player slots / QR / sessions / state / events / reports
                       -> application/*, server/db/prisma-*-store, contracts/v1, /api/v1/player/*, /portal/turmas
C. static mock         the same workflows again, in the browser, for GitHub Pages
                       -> runtime/*-demo*.ts, next.config aliases, localStorage "database"
```

**Root causes** (each is addressed by a phase in section 9):

| # | Root cause | Effect |
|---|---|---|
| RC1 | Generation B was never allowed to delete Generation A | two parallel portal stacks, dead validators, empty/404 production routes |
| RC2 | GitHub Pages had to keep working, so workflows were re-implemented instead of adapted | 60% duplicated actions, no-op transactions, plaintext demo tokens, demo branch checks in UI |
| RC3 | The swap was done with build-time aliases instead of an explicit seam | demo variant never typechecked, no interface contract, two module semantics per specifier |
| RC4 | No import boundaries or size budgets were enforced | UI importing Prisma enums, fixtures inside `server/services`, god files, 4,910-line CSS |
| RC5 | Verification never crossed the process boundary | no DB integration tests, no route-handler tests, no component tests, CI builds only the demo |
| RC6 | Work was kept uncommitted | no rollback point for the most complex code (Slices 3-5), no review, no bisect |

## 5. Findings

Every finding lists: severity, evidence, why it hurts, and what "fixed" looks like. Effort estimates assume one
developer familiar with the codebase.

### F1 - Dual runtime swapped by build-time aliases (S1)

**Evidence.** `next.config.ts:turbopack.resolveAlias` (9 aliases) vs `tsconfig.json:paths` (same nine, all pointing at
the server variants) vs `vitest.config.mts` (no alias). 23 files / 24 import sites. Variants differ in module
semantics (`"use client"` demo `player-access-demo-actions.ts` vs `"use server"` route action). 41 mode-dependent
branches across `app/`, `components/`, `server/`, `application/` (8 in `game-host.tsx`, 5 in `team-screen.tsx`).
`docs/implementation/v1-architecture-plan.md:69` already forbids this pattern.

**Why it hurts.** `tsc` certifies a build that is never shipped; the artifact that is shipped (demo) is unchecked.
Rename or reshuffle a server loader and CI stays green until `build:demo` runs in the Pages workflow. Adding a runtime
variant today requires touching Next config + tsconfig + tests.

**Fixed looks like.** One explicit contract module (types) + one composition root returning the mode-specific
implementation; both variants typed against the contract; `tsc` run once per target; `vitest` able to resolve both.

### F2 - Two portal stacks, and the fixtures are inside the production route tree (S1)

**Evidence.**
- `server/services/portal-view-service.ts` (521 lines) exports fixture arrays and is imported by 11 route files and 5
  components; in server mode most getters return `[]` (`:441`, `:427-465`) so pages render silently empty.
- `/portal/atividades/[id]` reads **only** `getDevBypassAccessLink()` (`:491`), which returns `undefined` unless demo
  mode or dev bypass -> **404 in production server mode**; its share URL is hardcoded to
  `https://niciniv.github.io/SMS_Portal/atividade/<id>` using the **id, not the token** (`atividades/[id]/page.tsx:47`).
- `/portal/admin/auditoria` renders fixture audit rows (`portal-view-service.ts:416`) while real `AuditEvent` rows are
  written by `PrismaAccessLinkStore.recordAudit` and never displayed.
- `/atividade/[token]` and `/atividade/[token]/jogar` prerender 4 hardcoded tokens and render "Atividade liberada" for
  **any** token; `resolvePublicLink()` - the correct validator - has zero callers.
- 3 routes are redirect stubs; 4 legacy route families remain in the tree.

**Why it hurts.** Dead-looking production screens, a share link that cannot work, an audit trail nobody can see, and a
public route that answers "released" without validation. New contributors cannot tell which stack is authoritative.

**Fixed looks like.** One portal stack (Generation B). Legacy routes deleted (Appendix B), `AccessLink` service and its
test deleted, `portal-view-service.ts` deleted, audit page repointed at the real table, `resolvePublicLink` either used
by the player entry path or removed.

### F3 - The demo store re-implements persistence and breaks documented invariants (S1)

**Evidence.** `runtime/adult-portal-demo-store.ts` (1,024 lines) holds seed fixtures (`:147-328`), localStorage I/O
(`:346-365`) and two stores (`:387`, `:736`).
- `DemoAdultPortalStore.transaction()` is a passthrough: `return work(this)` (`:392-396`), while the port is documented
  as atomic (and Prisma uses `$transaction` at `prisma-adult-portal-store.ts:463` and
  `prisma-player-access-store.ts:364`). Every service relying on atomicity is silently non-atomic in the published demo.
- `DemoPlayerCredentialIssuer.issue()` returns `tokenHash: token` - the raw bearer stored as its own hash
  (`runtime/player-access-demo-actions.ts:36`).
- `readDemoAdultPortalState()` accepts any JSON where `version === 2` (`:346-356`), i.e. hand-edited localStorage is
  trusted state.

**Why it hurts.** The demo is the only thing CI builds and deploys, so its weakened invariants are what reviewers and
stakeholders actually see. TypeScript cannot catch an invariant breach, and no test asserts these behaviours.

**Fixed looks like.** Demo implemented as an adapter (store + auth gateway + credential issuer) behind the same
contract; invariants asserted in tests (transaction rollback semantics, hash != raw token, state validated on read);
seed data moved to a `fixtures/` module.

### F4 - Duplicated server actions and copy-pasted helpers (S2)

**Evidence.** Table 3.3: 124 of 205 lines identical (60%) between the server and demo adult-portal action modules; the
same 10-action surface is maintained twice; `formObject` x4, `validationError` x5, `actorProfileId` x2, `profileId` x2,
`requireActor` x2. There is no shared module for any of them.

**Why it hurts.** Every new mutation doubles the work and the review surface. Because the two variants return the same
DTOs, a divergence changes behaviour only in one deployment target - and nothing detects it.

**Fixed looks like.** The action layer is written once (`"use server"`); the mode difference lives entirely in the
injected service/container. Demo-only behaviours (e.g. the role switcher) move behind the adapter, not into the action.

### F5 - God files and god components (S2)

**Evidence.** Table 3.2. Most acute: `game-host.tsx` (932 lines, 13 refs, 6 state hooks, 8 mode branches) mixes
transport, sync orchestration and markup; `game-offline-sync.ts` (1,222 lines) mixes IndexedDB plumbing, policy and
crypto; `portal.module.css` (4,910 lines) is imported by 37 files; `player-access-workflow.tsx` (540) contains 5
components and does relational joins inside a React helper; `adult-portal/service.ts` (616) builds navigation items.

**Why it hurts.** None of these units can be tested without a browser or a fake DOM; review diffs are unreviewable; a
change to one responsibility risks all the others (the offline queue and the UI state machine share refs).

**Fixed looks like.** Extract behaviour into hooks/services with explicit inputs, keep components presentational:
`useGameBridge` (messages + token), `useOfflineSync` (queue + status), `GameHostFrame` (markup);
`idb-store.ts` / `sync-engine.ts` / `request-registry.ts`; per-area CSS modules behind a small shared primitive layer;
navigation moved to a presenter (`portal-navigation.ts`).

### F6 - Layering leaks (S2)

**Evidence.**
- 13 component/helper files import `@/generated/prisma/enums` (`class-detail-screen.tsx:8`, `team-screen.tsx:10`,
  `player-access-workflow.tsx:14`, `overview-screen.tsx:7`, `portal-navigation.tsx:9`, `adult-portal-helpers.ts:5`, …).
- The application layer also imports the same enums (`adult-portal/{service,schemas,types,ports}.ts`,
  `player-access/*`, `game-events/service.ts`) - the domain vocabulary is the DB vocabulary.
- Components import route/server service modules for types: `activity-controls.tsx`, `class-groups-explorer.tsx`,
  `material-editor.tsx`, `materials-explorer.tsx`, `status-badge.tsx` -> `@/server/services/portal-view-service`;
  `portal-shell.tsx:4` -> `@/server/auth/session`.
- Business logic in the route layer: `atividades/actions.ts` owns expiry parsing with timezone reasoning (`:70-114`),
  scope resolution (`:116-161`), dev-bypass short-circuit (`:235-251`), localized error mapping (`:168-188`), and 8
  dynamic `await import()` calls to the composition root (`:121`, `:122`, `:261`, `:333`, `:377`, `:418`, `:458`, `:493`).
- No ESLint boundary rule exists (`eslint.config.mjs` is Next defaults + Prettier).

**Why it hurts.** The UI cannot evolve independently of the schema; enums leak DB naming into components; dynamic
imports of the container hide dependency cycles instead of removing them.

**Fixed looks like.** Domain-level unions/types in `application/*/types.ts` (no Prisma import); mapping between DB
enums and domain values in the store adapters; static imports of the container; boundary rules enforced by lint
(section 10).

### F7 - Validation results are discarded, then re-asserted with casts (S2)

**Evidence.** `server/http/game-state-route.ts:27-44` validates with Zod but **returns the raw `value`, not
`result.data`**. All four handlers then cast:

- `app/api/v1/player/state/route.ts:17` -> `as StateSaveRequestV1`
- `app/api/v1/player/results/route.ts:20` -> `as ResultEventV1`
- `app/api/v1/player/active-time/route.ts:20` -> `as ActiveTimeBatchV1`
- `app/api/v1/player/bootstrap/route.ts:15-17` -> inline ad-hoc type

Other escapes: 11 `as unknown as` / `as {...}` sites, including `player-access-workflow.tsx:62`
(`demoState as unknown as DemoWorkflowState`), `prisma-game-event-store.ts:294` (`as unknown as Prisma.InputJsonValue`),
`game-offline-sync.ts:513` (`(error as { response?: unknown }).response`).

**Why it hurts.** Schema transforms/defaults/coercions never reach the service; the declared type is an assertion, so a
schema change and a service expectation can drift silently. This is the exact boundary where the GameMaker contract is
enforced, so it is the worst place to have an assertion.

**Fixed looks like.** Return `result.data` (typed) from the reader; delete the four casts; keep `unknown` at the
boundary and parse once, in a single place per endpoint.

### F8 - Dead code, dead config and phantom routes (S3)

**Evidence.** Table 3.4: `resolvePublicLink`, `getDashboardData`, `isProtectedPathname`, `READINESS_TIMEOUT_MS`,
`RateLimitBucket` (model + `RATE_LIMITED` code), 10 unused `parseXxxV1` wrappers, 2 empty health route dirs plus 10
other empty dirs, 3 redirect stubs, 60 unused CSS classes.

**Why it hurts.** `README.md:53` advertises health handlers that do not exist; a reader cannot tell dead code from
pending work; reviewers spend attention on code that can never run.

**Fixed looks like.** Delete or implement, in the same PR, and correct `README.md` / `docs/current-architecture.md`
route tables to match reality.

### F9 - Repository hygiene and a CI that gates nothing (S2)

**Evidence.**
- Working tree: **33 modified files (+1,042 / -228)** and **43 untracked files (~6,366 lines)** - including all of
  Slices 3-5 (`src/application/game-events`, `game-state`, `src/app/api/**`, three Prisma stores, 12 new test files).
  The last commit is documentation only.
- `.github/workflows/deploy.yml` runs only `npm run build:demo`; no lint, typecheck or test job.
- Docs sprawl: 8 root `*.md` (1,276 lines) plus `docs/` (4,624 lines), including superseded plans (`phase-01..04`,
  `implementation_plan.md`, `walkthrough.md`, `portal-v1-specification.md` 660 lines,
  `docs/portal-visual-reference.html` 1,949 lines) and agent scaffolding (`.codex/`, `.impeccable/`).
- `src/generated/prisma` (24 files, 29,723 lines, untracked) lives inside `src/` and is pulled into the `tsc` program
  and IDE index by `tsconfig.json`'s `include: ["**/*.ts"]`.
- Doc/reality drift: `README.md:53` (health handlers), `README.md:70` (`cp .env.example .env.local` while the local
  file is `.env`).

**Why it hurts.** The most complex code in the repository has no rollback point and no review history; a server-target
regression can reach `main` with a green CI; drift between docs and routes misleads every new contributor.

**Fixed looks like.** Phase 0 below: commit slices, add CI, move superseded docs to `docs/archive/`, exclude
`src/generated/**` from `tsc`/ESLint so tooling stays fast, and fix the two README statements.

### F10 - Test strategy: right volume, wrong shape (S2)

**Evidence.** Section 3.6. All tests are node-environment units; there is no `.tsx` test, no route-handler test, no
database test (no testcontainers/PGlite/pg dependency), `PrismaAdultPortalStore` has zero test references, and the
runtime swap is untestable because `vitest.config.mts` has no `@runtime/*` alias. Meanwhile 56 of 284 cases (19.7%)
target the legacy access-link stack. `vitest.config.mts` sets no coverage threshold.

**Why it hurts.** The parts most likely to be wrong (SQL semantics, revision conflicts, idempotent ingestion, IndexedDB
recovery, protocol handling) are exactly the parts with zero executable verification. "284 green" will feel like
assurance while the risky boundary stays unproven.

**Fixed looks like.** Four layers, each with a home:
1. **unit** (existing, keep) - pure services and schemas;
2. **contract** - run the JSON Schema fixtures against the route handlers (ajv is already a devDependency) with a fake
   container;
3. **integration** - real Prisma against a disposable Postgres (decision D4) covering `PrismaAdultPortalStore`,
   `PrismaPlayerAccessStore` and `PrismaGameStateStore` (revision conflict, retry idempotency, session lifecycle);
4. **component/behaviour** - `game-host` bridge + offline queue driven by fake `postMessage` and a fake IndexedDB
   (jsdom/happy-dom plus `fake-indexeddb`).

### F11 - Config and build coupling (S3)

**Evidence.**
- `next.config.ts:5-24` runs Zod env validation at config load, so `npx next build`/`next dev` fail without the wrapper
  (reproduced) and the Docker build (`Dockerfile:13`) needs full runtime secrets at build time. Any host that invokes
  `next build` directly would break.
- `basePath: "/SMS_Portal"` hardcodes the repository name (`next.config.ts:32`) and is duplicated into `APP_BASE_PATH`.
- Three entry points implement target selection separately: `scripts/next-target.mjs`, `scripts/start.mjs`, and the
  Pages workflow.
- Route handlers vanish from the demo artifact without any explicit assertion.

**Why it hurts.** Builds are only reproducible through npm scripts; renaming the repository breaks the published demo;
"the demo has no API" is an accident of the export rather than a stated invariant.

**Fixed looks like.** Move env validation out of `next.config.ts` into a runtime module the app loads (fail closed at
request time, not at config time); derive `basePath` from one config module/property; keep a single target-selection
helper used by scripts and CI; assert the demo artifact shape in CI (`out/` must not contain `api/`).

### F12 - Small, contained issues (S4)

| Item | Evidence |
|---|---|
| `getAuthGateway()` caches an instance, but `ServerNeonAuthGateway.getSession()` imports and constructs the Neon gateway on every call | `server/auth/gateway.ts:25-30` |
| `isProtectedPathname()` exported, never used | `server/auth/gateway.ts:48-55` |
| `DemoPlayerCredentialIssuer` lives in an "actions" module and is imported by another one | `runtime/player-access-demo-actions.ts:31` |
| No-op client stubs silently shape the server bundle | `runtime/adult-portal-server-client.ts` |
| pt-BR copy inlined across services, actions, components and fixtures (no message catalogue) | e.g. `application/adult-portal/service.ts:132-203` |
| `access-link-service.test.ts` is a single 1,625-line file | `tests/unit` |
| Ops tables in docs that do not exist | `docs/current-architecture.md:176` |
| `marketing.module.css` names a surface that does not exist; used by sign-in/recovery only | 3 import sites |

## 6. What is genuinely good - preserve, do not rewrite

1. **`src/application/*`** - pure domain services with explicit ports, injected clock/issuer, no I/O. This is the
   architectural asset; the refactor should keep it and only clean its inputs (F6) and split its largest service (F5).
2. **`src/contracts/v1` + `contracts/schemas/*.json` + `contracts/fixtures/*`** - one schema vocabulary, Zod mirrors,
   ajv-validated fixtures, 59 contract tests. Keep the JSON Schemas as the source of truth for the GameMaker boundary.
3. **Security posture** - `isAuthDevBypassEnabled()` fails closed and is rejected in demo/production
   (`server/config/env.ts:80-89`, `:114-124`); nonce-based CSP with `strict-dynamic` and per-route
   `Referrer-Policy: no-referrer` for token URLs (`src/proxy.ts`); raw access tokens are never persisted or placed in
   URLs (`atividades/actions.ts:13-20`); `token_hash` is `Char(64)` unique; launch tokens are 5-minute HMACs
   (`server/security/launch-token.ts:3`). Preserve all of it while moving the code around.
4. **Toolchain discipline** - strict TS with `noUncheckedIndexedAccess`, Prettier, ESLint with `--max-warnings=0`,
   vitest, `npm run check`. No `any`, no `@ts-ignore`, no `eslint-disable` anywhere.
5. **Docs honesty** - `docs/current-architecture.md:247-261` and `docs/implementation/slice-03-05-portal-handoff.md:33-67`
   already disclose unverified migrations, unaccepted integration and known gaps. Keep that habit.

## 7. Corrections and rejected claims (so nobody re-chases them)

This audit merged two independent reviews. The merged set is what sections 3-5 report. Three external claims were
**rejected** and three numeric claims were **corrected**; three of my own earlier statements were also wrong and are
corrected here. Keep this section when pruning the document.

| Claim | Verdict | Truth |
|---|---|---|
| "~30,000 lines of generated Prisma code are **committed to Git**; this bloats git history and causes merge conflicts" | **Rejected** | `src/generated/prisma` is in `.gitignore:27`; `git ls-files src/generated` = **0 files**; `git log --all -- src/generated` = **0 commits**. The size (29,723 lines) is real but it is untracked local output. No `git rm --cached` is needed. The real (smaller) problem: it is inside `src/`, inside the `tsc` program and the ESLint/IDE scope. |
| "`RateLimitBucket` in Postgres is a **bottleneck**: row-level locks on every API request" | **Rejected** | Nothing reads or writes that model - zero source references outside `prisma/schema.prisma` and the generated client. There is **no rate limiting implemented**, so there is no contention. Correct finding: an unimplemented security control plus a dead table (F8). |
| "`AuditEvent` is one of the legacy tables kept alongside the new model" | **Rejected** | `AuditEvent` is current: `PrismaAccessLinkStore.recordAudit` writes it today. The defect is that nothing *reads* it (`/portal/admin/auditoria` renders fixtures instead - F2). |
| "`portal.module.css` contains 674 CSS classes" | **Corrected** | 674 is the number of lines that *begin* with a class selector, not distinct classes. Real figures: **308** distinct class selectors, 935 `.class` tokens, 709 rules, **60 unused (19.5%)** across 37 importing files. |
| "`game-host.tsx` uses 9 refs and manages fullscreen" | **Corrected** | **13** refs + 6 state hooks + 2 effects; it does **not** manage fullscreen - the only mentions are `allow="autoplay; fullscreen; gamepad"` and `allowFullScreen` on the iframe. |
| "`AccessLinkService` is obsolete" | **Corrected** | It is *orphaned*, not obsolete: code quality is the best in the repo, but its only consumer is the legacy route tree. Delete it *with* that tree, not before (F2/Phase 2). |
| (my earlier report) "10 `@runtime/*` aliases" | **Corrected** | **9** aliases (`@/*` is a tenth path but unrelated). Import-site count (23 files / 24 sites) stands. |
| (my earlier report) "`build:demo` produced 0 warnings" | **Corrected** | It does print *"Statically exporting a Next.js application via `next export` disables API routes and middleware."* My earlier grep missed it. The substantive point stands: `out/` contains no `api/` or `health/`. |
| (my earlier report) "63 of 317 unused CSS classes (19.9%)" | **Corrected** | Re-measured against the 37 real importers: **60 of 308 (19.5%)**. |

## 8. Target architecture

### 8.1 Principles

1. **One implementation per behaviour.** Deployment targets differ by *adapter*, never by copied workflow code.
2. **The seam is typed and explicit.** Mode differences live behind interfaces, resolved in one place.
3. **The demo is a build target, not a branch in the domain.** No `if (demo)` inside services or components.
4. **Boundaries are enforced by tooling**, not by convention (lint rules + CI gates).
5. **Verification crosses the process boundary** for persistence and the player protocol.
6. **Every file has one reason to change**, with a size budget that makes violations visible.

### 8.2 Target directory layout

```
src/
  app/                          # routing only: thin server components + route handlers
    (professional)/             #   -> parse input, call a service, render a screen
    (public-play)/              #   -> player entry + host
    api/v1/player/              #   -> parse (zod .data), call service, map errors
  application/                  # domain: pure services + ports + types + schemas (unchanged in spirit)
    <context>/{service,ports,types,schemas,errors}.ts
  server/                       # infrastructure adapters (server-only)
    db/         (prisma stores, one file per aggregate)
    auth/  security/  http/  observability/  config/
  runtime/                      # composition seam
    contracts.ts                #   interfaces both targets must satisfy
    composition.server.ts       #   server wiring
    composition.demo.ts         #   demo wiring (adapters only)
    demo/                       #   fixtures, localStorage adapter, demo issuers
    offline/                    #   idb-store.ts, sync-engine.ts, request-registry.ts, transport.ts
  components/                   # presentation only (no @/server, no @/generated imports)
    portal/ public/ shared/     #   co-located per-area CSS modules + shared primitives
  contracts/                    # versioned wire contracts (schemas.ts, parse.ts)
  generated/                    # prisma output (outside src/ in the target layout, or excluded from tsc)
```

Rules of thumb that follow from the layout: `components` may import `application/*/types` and `contracts`; `app` may
import everything server-side; `application` imports nothing from `server`/`generated`; `runtime/contracts.ts` is the
only file both targets share.

### 8.3 Runtime composition (replaces F1)

```ts
// src/runtime/contracts.ts  - shared by both targets, no implementation
export interface PortalRuntime {
  getPortalShellData(): Promise<PortalShellDto>;
  getPortalOverviewData(): Promise<PortalOverviewDto>;
  getClassesPageData(): Promise<ClassesPageData>;
  // ...one member per current @runtime/* export
}
export interface PortalActions { createOrganizationAction: PortalAction; /* ... */ }
export interface PortalClientBridge { loadClientPortalState(): DemoPortalState | null; /* ... */ }
export interface PlayerRuntime { resolvePlayerEntry(token: string): Promise<PlayerEntryActionResult>; /* ... */ }
```

Then one composition point, imported by pages/actions/components:

```ts
// src/runtime/composition.ts
import * as server from "./composition.server";
import * as demo from "./composition.demo";
export const portal: PortalRuntime = APP_RUNTIME_MODE === "demo" ? demo.portal : server.portal;
```

Properties this buys:
- both targets must satisfy the same interface, so drift becomes a type error;
- `tsc --noEmit` runs twice (`tsconfig.json`, `tsconfig.demo.json`) or once with both variants included, so the demo is
  typechecked;
- `vitest` resolves `@/runtime/composition` like any other module, so tests can run the demo wiring end to end;
- the 41 scattered `runtimeMode` branches shrink to the few places where the *UI* genuinely differs (role switcher,
  demo banner), which can be props rather than mode checks.

Migration is mechanical: for each of the 9 aliases, move the current exports behind the contract, keep both files, and
delete the alias entry only once nothing imports the alias.

### 8.4 Demo as adapter, not fork (replaces F3/F4)

| Concern | Today | Target |
|---|---|---|
| Persistence | `DemoAdultPortalStore` (1,024 lines) with no-op transactions | `runtime/demo/memory-store.ts` implementing the same ports, with `transaction()` that snapshots and restores on throw so atomicity is at least simulated and testable |
| Credentials | raw token used as its own hash | `runtime/demo/demo-issuer.ts` hashes with the same helper as production; the demo simply prints the raw token once |
| Seed data | embedded in the store file | `runtime/demo/fixtures/*.ts`, imported by tests and the store |
| Server actions | duplicated in two modules | one `"use server"` module; demo differences resolved through the injected container |
| Auth | `DemoAuthGateway` returning a fixed session | unchanged (it is already an adapter) - but the role switcher becomes a demo-only UI prop, not a mode check inside `portal-shell` |

### 8.5 Layering rules (enforced)

| From | May import | Must not import |
|---|---|---|
| `components/**` | `application/*/types`, `contracts/**`, `components/**`, `runtime/composition` | `@/server/**`, `@/generated/**` |
| `app/**` (server) | everything except `runtime/demo/**` directly | - |
| `application/**` | own context + `contracts/v1` | `@/server/**`, `@/generated/**`, React, Next |
| `server/**` | `application/**`, `contracts/**`, `@/generated/**` | `components/**`, `app/**` |
| `runtime/demo/**` | `application/**`, `contracts/**`, demo fixtures | `@/server/**` |

Two mechanisms make this real rather than aspirational:
1. `eslint-plugin-import`'s `no-restricted-imports` / `import/no-restricted-paths` with the table above (few lines,
   fails the existing `--max-warnings=0` gate);
2. replacing Prisma enums with domain unions in `application/*/types.ts` and mapping them in the store adapters
   (largest mechanical change in the plan; do it context by context).

### 8.6 Testing strategy (replaces F10)

| Layer | Tooling | Targets | Gate |
|---|---|---|---|
| Domain unit | vitest (existing) | `application/*/service.ts`, schemas | must stay green |
| Contract | vitest + ajv + `contracts/fixtures` | the 4 route handlers, request/response pairs, protocol errors | new |
| Integration | vitest + disposable Postgres | the 3 Prisma stores + migration apply (`prisma migrate deploy` on a throwaway DB) | new |
| Behaviour | vitest + jsdom/happy-dom + `fake-indexeddb` | `useGameBridge`, `useOfflineSync`, conflict/retry paths | new |
| Coverage | vitest coverage | thresholds only on `application/**` and `runtime/offline/**` (e.g. 80%), no global gate | new |

The legacy 56 access-link cases disappear with their subject; net test count may drop while confidence rises - that is
the intended trade.

### 8.7 Config policy (replaces F11)

- `next.config.ts` contains configuration only; no Zod parsing, no `process.exit` behaviour.
- Env validation lives in `server/config/env.ts` and is invoked by the code that needs it (already fails closed for the
  auth bypass); `next build` must succeed without runtime secrets.
- `APP_RUNTIME_MODE` gets a safe default (`server`) so `next dev`/`next build` work unwrapped; a missing value in a
  deployed demo is caught by an assertion in CI (`out/` shape check) instead.
- `basePath` derives from one constant; the repo name appears once.
- `scripts/next-target.mjs` remains the single target selector used by npm scripts and CI.
- Delete `src/generated` from `tsconfig.include`/ESLint inputs (or move generation to `generated/` outside `src/`) so
  tooling scans ~18k lines instead of ~48k.

## 9. Remediation plan

Each phase is independently shippable and leaves the app working. Effort figures are estimates for one developer
already familiar with the codebase; they exclude the acceptance work in section 12 (R1-R3).

### Phase 0 - Make change safe (0.5-1 day) | blocks everything

**Steps**
1. Commit the working tree in coherent slices, e.g.:
   - `feat(game-state): revisioned player state and bootstrap`
   - `feat(game-events): result and active-time ingestion with reports`
   - `feat(offline): IndexedDB queue and bridge host`
   - `feat(portal): results screens and organization deactivation`
   - `chore(config): dual runtime target wiring and tests`
2. Extend `.github/workflows/deploy.yml` (or add `ci.yml`) with `npm ci && npm run format:check && npm run lint &&
   npm run typecheck && npm test` before the demo build; add a `build:server` job with placeholder secrets.
3. Add `src/generated/**` to an ignore list for ESLint (already ignored) **and** to `tsconfig` exclude; keep
   `prisma generate` in `postinstall`.
4. Move superseded plans to `docs/archive/` (`phase-01..04`, `implementation_plan.md`, `walkthrough.md`,
   `portal-v1-specification.md`, `docs/portal-visual-reference.html`) and add a one-line pointer in each.
5. Fix `README.md:53` (health handlers) and `README.md:70` (`.env.local` vs `.env`).

**Exit criteria.** `npm run check` green in CI on a PR from a fresh clone; `git status` clean; a reader can tell which
docs are current from `docs/implementation/README.md`.

**Risks.** Committing 6.4k untracked lines may reveal conflicts with the docs' claims - fix the docs, not the code.

### Phase 1 - Typed runtime seam (1.5-3 days) | fixes F1

**Steps**
1. Add `src/runtime/contracts.ts` with interfaces for the 9 aliases (section 8.3).
2. Make `runtime/adult-portal-{server,demo}.ts`, `player-access-{server,demo}.ts`, `game-events-{server,demo}.ts`,
   the two action modules, the two client bridges and the entry actions satisfy those interfaces
   (`satisfies PortalRuntime` etc.).
3. Add `src/runtime/composition.ts` selecting the implementation from `APP_RUNTIME_MODE`; keep the aliases in place
   temporarily but point page/component imports at the composition object.
4. Add `tsconfig.demo.json` (paths -> demo variants) and a `typecheck:demo` npm script; run both in CI.
5. Add `resolve.alias` entries for `@/runtime/*` in `vitest.config.mts`; add one smoke test per contract member so a
   missing or renamed export fails in CI.

**Exit criteria.** No `@runtime/x` alias remains in `next.config.ts`/`tsconfig.json`; `npm run typecheck` and
`npm run typecheck:demo` both pass; a deliberate rename in the demo variant fails typecheck; the demo build still emits
109 pages.

**Risks.** Client/server module-semantics mismatch (`"use client"` actions). Mitigation: keep action modules
server-only and pass demo behaviour through the container; do not alias `"use client"` modules over `"use server"` ones.

### Phase 2 - Delete Generation A (2-4 days) | fixes F2, part of F8

**Steps** (in this order, each its own commit):
1. Repoint `/portal/admin/auditoria` at the real `AuditEvent` table via a small server query (or delete the page and
   its nav entry). Remove `auditEvents` from `portal-view-service.ts`.
2. Delete the legacy route tree: `(professional)/portal/atividades/**`, `materiais/**`, `modulos/**`,
   `admin/{jogos,modulos}`, `(public-play)/atividade/**`; delete the 4 components only they use
   (`activity-builder`, `activity-controls`, `material-editor`, `materials-explorer`, `class-groups-explorer`,
   `share-actions`, `status-badge` if unused) and the 60 unused CSS classes.
3. Delete `server/services/portal-view-service.ts`, `server/services/link-status.ts`, `server/services/access-link-service.ts`,
   `server/db/prisma-access-link-store.ts`, `server/services/audit-actions.ts`, `app/(professional)/portal/atividades/actions.ts`,
   `tests/unit/access-link-service.test.ts`, `tests/unit/access-link-tokens.test.ts`, `tests/unit/link-status.test.ts`,
   and `tests/unit/portal-dev-bypass*.test.ts` if they only covered the deleted paths.
4. Decide the fate of `AccessLink`, `CapabilityAssignment` and `AuditEvent`:
   - keep `AuditEvent` (written by the audit trail; add the reader in step 1);
   - drop `AccessLink` and its migration in a follow-up migration **only after** confirming no V1 screen needs link-based
     sharing (the QR/credential path replaces it);
   - keep `CapabilityAssignment` only if the capability model is still the authorization source for `/portal/admin/*`;
     otherwise fold into the V1 role model and delete the table in a migration.
5. Update `docs/current-architecture.md` route tables, `docs/implementation/README.md` status, and `README.md`
   structure tree.

**Exit criteria.** No route or component imports `portal-view-service`; demo build emits fewer pages and no legacy
routes; `npm run check` green; the audit page shows real data or is gone; grep for `missoes.nsr.rs.gov.br`,
`niciniv.github.io/SMS_Portal/atividade` and `getDevBypassAccessLink` returns nothing.

**Risks.** Losing a fixture that someone still demonstrates. Mitigation: keep the deleted seed data inside
`runtime/demo/fixtures/` if a stakeholder demo depends on it.

### Phase 3 - Demo as adapter, one implementation per behaviour (2-3 days) | fixes F3, F4

**Steps**
1. Introduce `runtime/demo/fixtures/` and move `demoAdultPortalSeed` + `DEMO_*` constants out of the store.
2. Split `adult-portal-demo-store.ts` into `runtime/demo/adult-portal-store.ts` and
   `runtime/demo/player-access-store.ts` (one port per file), and implement a real `transaction()` that clones the
   state, runs the work, and restores on throw.
3. Move `DemoPlayerCredentialIssuer` to `runtime/demo/demo-issuer.ts` and hash the token with
   `hashPlayerCredentialToken` instead of storing it raw.
4. Validate state on read (`runtime/demo/state-schema.ts` with Zod) and migrate the storage key/version once.
5. Delete the demo action modules (`adult-portal-demo-actions.ts`, `player-access-demo-actions.ts`,
   `player-entry-demo-actions.ts`, `demo-auth-actions.ts`), keep the single `"use server"` implementations, and make the
   container mode-aware instead of the module graph.
6. Move shared helpers (`formObject`, `validationError`, `runAction`) into one `server/actions/form.ts` module.

**Exit criteria.** `npm run build:demo` succeeds with the same UI behaviour; the demo role switcher and "Restaurar demo"
still work; the demo store's invariants are covered by tests (transaction rollback, hash != token, invalid state falls
back to seed); no `runtime/*-demo-actions.ts` file remains.

**Risks.** The demo resolves credentials issued in the same browser; hashing keeps that property only if the raw token
stays recoverable in the UI flow - verify the QR/print flow still works in the demo. Fallback: keep the demo issuer raw
but mark it demo-only with a comment and a test.

### Phase 4 - Split the god files (2-4 days) | fixes F5

| Target | Extract into | Notes |
|---|---|---|
| `components/public/game-host.tsx` | `useGameBridge` (message validation, token refresh, request/reply map), `useOfflineSync` (queue status, sync triggers, conflict delivery), `GameHostFrame` (markup + alerts) | Keep the public props identical; the two window-listener effects stay in the hooks |
| `runtime/game-offline-sync.ts` | `offline/idb-store.ts` (schema/migrations/CRUD), `offline/request-registry.ts` (fingerprints, SHA-256), `offline/sync-engine.ts` (policy, ordering, conflict) | The 683-line test file splits the same way - that is the acceptance signal |
| `server/services/access-link-service.ts` | nothing - deleted in Phase 2 | avoid work that deletion removes |
| `application/adult-portal/service.ts` | keep one service per aggregate where practical, or at minimum move `getShell` navigation to `presenters/portal-navigation.ts` | Navigation is presentation |
| `components/portal/player-access-workflow.tsx` | one file per dialog (`allocate-players.tsx`, `rotate-credential.tsx`, `session-control.tsx`) + a container; drop `workflowFromDemoState` once Phase 3 lands | The demo join disappears with Phase 3 |
| `components/portal/portal.module.css` | `shared/primitives.module.css` (buttons, cards, badges, tables) + per-area modules beside their components | Delete dead classes first; do not split blindly |

**Exit criteria.** No file over ~400 lines except generated code; `game-host` keeps a ref only for the iframe;
`portal.module.css` importers drop from 37 to a primitives set plus per-area files; behaviour unchanged in
`npm run dev:demo` (visual check).

### Phase 5 - Verification that crosses the process boundary (2-4 days) | fixes F7, F10

**Steps**
1. `readGameRequest` returns parsed data; delete the four casts; add route-handler tests driven by
   `contracts/fixtures/v1/**` (valid + invalid) asserting status codes and error envelopes.
2. Add integration tests for the three Prisma stores against a disposable Postgres (decision D4): monotonic slot
   numbering, credential rotation vs lock, stale-revision conflict, identical-retry idempotency, session end semantics,
   and `prisma migrate deploy` on an empty database.
3. Add behaviour tests for the offline queue with `fake-indexeddb` (enqueue -> durable ack -> upload -> acknowledge;
   conflict blocks state; old-session mismatch refuses) and for the host bridge with a fake `postMessage` peer.
4. Enable coverage reporting in CI with thresholds limited to `application/**` and `runtime/offline/**`.

**Exit criteria.** A schema change that breaks a route handler fails CI; a migration that does not apply fails CI; the
conflict/idempotency paths have executable tests; `npm test` stays under ~30 s.

### Phase 6 - Config, ops and hygiene (1-2 days) | fixes F8, F11

1. Move env validation out of `next.config.ts`; give `APP_RUNTIME_MODE` a default; keep the wrapper scripts as the only
   target selector.
2. Implement `/health/live` and `/health/ready` (using `READINESS_TIMEOUT_MS` + a bounded `SELECT 1`) **or** delete the
   empty dirs, the variable and the doc rows.
3. Implement rate limiting on `/api/v1/player/*` and the sign-in action using `RateLimitBucket` + the `RATE_LIMITED`
   code **or** delete the model and the code path. If implemented, note that Postgres-backed counters are acceptable for
   V1 volume but are not the long-term choice; keep the port interface so a Redis adapter can replace it.
4. Delete unused `parseXxxV1` wrappers, `isProtectedPathname`, empty directories, and no-op client stubs with no
   consumer.
5. Add a CI step asserting the demo artifact shape (`out/` has no `api/`, no `health/`, and `out/404.html` exists).

### Phase 7 - Documentation truth pass (0.5 day)

1. `docs/current-architecture.md`: route table matches the real tree; add the composition seam description.
2. `docs/implementation/README.md`: truthful slice status (Slices 3-5 implemented but unaccepted; list the deletions).
3. Link this audit from `docs/implementation/README.md` as the hardening reference; keep the archive pointers current.
4. Keep `AGENTS.md`/`CLAUDE.md` guidance in sync with the Next.js version rules this repo relies on.

## 10. Guardrails (so the debt does not come back)

1. **CI gates on every PR**: `format:check`, `lint`, `typecheck`, `typecheck:demo`, `test`, `build:demo`, artifact-shape
   check. `build:server` when secrets are available.
2. **Import boundaries** via `eslint-plugin-import` per section 8.5, with `--max-warnings=0` already in place.
3. **Size budgets** (warn at, fail above twice): component 250/400 lines, module 300/500 lines, CSS module 300/600
   lines, test file 400/800 lines. Ratchet: the budget applies to *new or modified* files only, so the plan does not
   stall on existing offenders.
4. **No new `@runtime/*` alias**: add a lint rule forbidding imports of `@/runtime/**` except `composition` and
   `contracts` so the seam cannot be bypassed.
5. **ADR per structural decision**: `docs/adr/NNNN-title.md`. Start with four: (1) one portal stack, (2) demo as
   adapter, (3) typed runtime composition, (4) test layering + disposable database.
6. **Definition of done** for any new workflow: service + port (if it persists) + one action + one screen + unit test +
   one integration or contract test + docs line. No feature is "done" with a duplicate in a second module.
7. **PR checklist additions**: no `@/generated` import outside `server/`; no `if (demo)` outside `runtime/demo`; no new
   file over budget; migrations applied in CI.

## 11. Sequencing and effort

| Phase | Depends on | Effort (est.) | Findings closed |
|---|---|---:|---|
| 0. Make change safe | - | 0.5-1 day | F9 (partly) |
| 1. Typed runtime seam | 0 | 1.5-3 days | F1 |
| 2. Delete Generation A | 1 (or 0) | 2-4 days | F2, F8 (partly) |
| 3. Demo as adapter | 1 | 2-3 days | F3, F4 |
| 4. Split god files | 2, 3 | 2-4 days | F5 |
| 5. Boundary verification | 3 | 2-4 days | F7, F10 |
| 6. Config, ops, hygiene | 2 | 1-2 days | F8, F11, F12 |
| 7. Docs truth pass | 2-6 | 0.5 day | - |

Total: roughly **12-21 developer-days** for the whole plan, or ~4-6 days for the first three phases, which already remove
the majority of the structural risk. Phases 2 and 3 can proceed in parallel with 5 if two people are available; 4 should
wait until 2 and 3 have landed to avoid moving code that is about to be deleted.

Track progress with `docs/implementation/README.md` (one line per phase) rather than a new status document.

## 12. Risk register

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | Migrations were never applied to a real database; the schema might not even apply | V1 unshippable | Highest-value acceptance item, independent of this refactor: provision a Neon branch, run `prisma migrate deploy`, seed one organization/class/player, exercise the four endpoints. Add it to CI in Phase 5 so it can never regress to "unverified". |
| R2 | The real GameMaker HTML5 build does not exist yet; the protocol is unproven | Integration may need contract changes after the refactor | Keep `contracts/schemas` as the single source of truth (already true); do not harden UI details around an unverified protocol. Freeze the contract before Phase 4 touches `game-host`. |
| R3 | Offline/two-device/tablet behaviour never exercised | Silent data-loss risk in the classroom | Phase 5 behaviour tests cover the state machine; the tablet/2-device manual pass remains a product gate, not a refactor gate. |
| R4 | Deleting Generation A breaks a live demo someone relies on | Stakeholder friction | Phase 2 is one commit per route family; keep fixtures in `runtime/demo/fixtures/` so a demo page can be rebuilt quickly; verify `npm run dev:demo` after each commit. |
| R5 | Deleting `AccessLink`/`CapabilityAssignment` removes authorization the old admin screens still use | Locked-out admins in the server target | Phase 2 step 4 keeps the tables until a component-by-component check confirms no V1 screen imports the capability service (`authorization-service.ts`, `v1-policy.ts`). Decide in D3, migrate deliberately. |
| R6 | Committing 6.4k untracked lines surfaces conflicts with docs and between in-flight slices | Slow Phase 0 | Commit by subsystem (state, events, offline, portal, config); fix docs in the same commit; if a slice is half-done, keep it behind a disabled nav entry rather than reverting it. |
| R7 | localStorage schema change in Phase 3 wipes demo state for existing visitors | Demo feels broken once | Version the key (`…v2`), migrate on read, fall back to seed on parse failure; announce in the demo banner. |
| R8 | Two authorization models (capability grants vs V1 roles) cause a real privilege mistake during consolidation | Security | Consolidate in one PR with tests per role x capability matrix before deleting anything (mirrors `tests/unit/v1-authorization.test.ts` style). |
| R9 | The refactor reduces test count (56 legacy cases deleted) and looks like a regression in metrics | Reporting confusion | Report coverage on the layers that matter (section 8.6); state the expected drop in the PR description. |

## 13. Open decisions (need a human answer before Phase 2)

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| D1 | Do we keep the GitHub Pages demo as a shipped artifact? | Agree | Keep, but ONLY as an adapter-based build target (Phase 3). Its value is stakeholder review; its cost is the duplicate implementation, which Phase 3 removes. |
| D2 | Legacy routes: delete or hide? | delete | Delete. They are already absent from V1 navigation; hiding preserves the code and the dead validators. |
| D3 | Authorization: one model or two? | V1 roles only | Consolidate on V1 roles plus explicit teacher-assignment checks; keep capability grants only if `/portal/admin/auditoria` and org management need per-scope grants after Phase 2. |
| D4 | Integration database strategy | disposable Postgres via Docker/testcontainers | Docker Postgres in CI (deterministic, no vendor dependency) + a Neon branch for the manual acceptance pass in R1. |
| D5 | UI copy: keep inline pt-BR or introduce a message catalogue? |  catalogue later | Catalogue later, but enforce one module per surface meanwhile; the current spread is a symptom, not the disease. |
| D6 | Rate limiting: implement or delete? | implement with `RateLimitBucket` | Implement for the four player endpoints and sign-in (they are the abuse surface); the port makes a Redis swap possible later. |
| D7 | `AccessLink` table + `access-link-service.ts` | delete after Phase 2 | Delete. QR player credentials and class sessions are the V1 sharing model; a second sharing concept invites confusion. |

## Appendix A - Reproduction commands

```powershell
# Toolchain state
npm run typecheck
npx eslint src
npm test

# Demo build + artifact shape (out/ must have no api/ or health/)
npm run build:demo
Test-Path out/api            # expected: False

# Standard Next CLI fails without the wrapper (reproduced in this audit)
npx next build               # expected: ZodError in next.config.ts

# Size census (top files, excl. generated code)
Get-ChildItem -Recurse -File -Path src,tests |
  Where-Object { $_.FullName -notmatch 'generated' } |
  Select-Object @{n='L';e={(Get-Content -LiteralPath $_.FullName).Count}},@{n='P';e={$_.FullName}} |
  Sort-Object L -Descending | Select-Object -First 25

# CSS: distinct classes vs dead classes
$css = Get-Content -LiteralPath 'src\components\portal\portal.module.css' -Raw
# (see the audit transcript for the full script; result: 308 defined, 60 unused)

# Alias usage
Get-ChildItem -Recurse -File -Path src\components,src\app |
  Select-String -Pattern '@runtime/' | Select-Object -ExpandProperty Path -Unique | Measure-Object

# Generated code tracked?
git ls-files src/generated        # expected: empty
```

## Appendix B - Route disposition

| Route | Generation | Disposition |
|---|---|---|
| `/entrar`, `/entrar/recuperar` | B | keep |
| `/portal` (overview) | B | keep |
| `/portal/turmas`, `/portal/turmas/[id]` | B | keep |
| `/portal/resultados`, `/portal/resultados/[classGroupId]`, `…/players/[playerSlotId]` | B | keep |
| `/portal/admin/organizacoes`, `/portal/admin/organizacoes/[id]`, `/portal/admin/equipe` | B | keep |
| `/portal/ajuda`, `/portal/sem-acesso`, `/portal/sessao-expirada` | B | keep |
| `/jogar` (player entry + host) | B | keep |
| `/api/v1/player/{bootstrap,state,results,active-time}` | B | keep (server target only; assert absence in the demo artifact) |
| `/portal/atividades`, `…/[id]`, `…/[id]/{compartilhar,editar,conflito,resultados}`, `…/nova`, `…/vazia` | A | **delete** |
| `/portal/materiais`, `…/novo`, `…/[id]/editar` | A | **delete** (PRODUCT.md: Materials is not V1) |
| `/portal/modulos`, `/portal/modulos/[id]`, `/portal/admin/modulos`, `/portal/admin/jogos` | A | **delete** (redirect stubs) |
| `/portal/admin/auditoria` | A (fixtures) | **repoint** at `AuditEvent` or delete |
| `/atividade/[token]`, `…/[state]`, `…/jogar`, `…/jogar/[state]` | A | **delete** (the V1 entry is `/jogar` + QR credential; `resolvePublicLink` is unused and should go with it unless the token path is reintroduced deliberately) |
| `/health/live`, `/health/ready` | - | implement or delete the empty directories and the `READINESS_TIMEOUT_MS` variable |

## Appendix C - First week, concretely

Day 1 - Phase 0. Commit in five slices, add `.github/workflows/ci.yml` (format, lint, typecheck, test, build:demo,
artifact check), exclude `src/generated` from `tsc`/ESLint scope, archive superseded docs, close the two README lies.
Day 1-2 - Phase 1 start. Write `runtime/contracts.ts` from the current export surfaces (the pairs already match, so this
is transcription, not design), and land `composition.ts` plus `tsconfig.demo.json`.
Day 3-4 - Phase 1 finish. Repoint imports, delete the aliases, add the vitest aliases and contract smoke tests. Verify
`build:demo` still emits 109 pages and `typecheck:demo` catches an intentional rename.
Day 5 - Phase 2 start (audit page first). Report progress as one line per phase in `docs/implementation/README.md`.

## Appendix D - Glossary

| Term | Meaning in this repository |
|---|---|
| Generation A / B / C | the demo CMS / the V1 platform / the static mock (section 4) |
| Runtime seam | the typed interface through which pages and components reach a mode-specific implementation |
| Adapter | an implementation of a port for one environment (Prisma, demo memory, fake test double) |
| Port | the interface a domain service depends on (`application/*/ports.ts`) |
| Contract | the versioned wire format in `contracts/schemas/v1/*.json` plus its Zod mirror |
| Demo target | `APP_RUNTIME_MODE=demo`, static export to `out/`, deployed to GitHub Pages |
| Server target | `APP_RUNTIME_MODE=server`, standalone build with Neon Auth + Prisma |

---

*Audit produced 23 September 2026. Findings verified against commit `d4af23c` and the uncommitted working tree; see
section 2 for what was and was not proven, and section 7 for claims that were checked and rejected.*
