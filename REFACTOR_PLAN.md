# V1 Architectural Refactor & Simplification Plan (v2.1 — Executable Edition)

**Document Version:** 2.1  
**Date:** 23 September 2026  
**Status:** Approved for execution. Fully reconciles the 13-agent critique (`docs/agent-reviews/refactor-plan-v2/CRITIQUE.md`) with the governing architecture document (`docs/architecture-audit-2026-09-23.md`).  
**Context:** Full architectural refactor with zero legacy backward-compatibility requirement. Target: lean, textbook Clean Architecture Next.js codebase with a working demo ready in 3–4 days.

---

## 1. Executive Summary & Governance

### 1.1 The Core Problem
The repository is burdened by three competing product generations compiled into one application:
1. **Generation A (Legacy CMS):** Outdated activities (`atividades`), educational materials (`materiais`), modules, and shared room access links backed by hardcoded mock fixtures (`portal-view-service.ts`).
2. **Generation B (V1 Platform):** Clean Architecture domain services, numbered player slots, rotatable QR credentials, GameMaker state synchronization, and classroom reporting.
3. **Generation C (Static Mock Hack):** A parallel, duplicated implementation of Generation B running on `localStorage` in the browser, glued to the app via 9 Turbopack build-time path aliases (`@runtime/*`).

### 1.2 Governance & Non-Negotiables
- **Governing Architecture Document:** `docs/architecture-audit-2026-09-23.md` is the architectural source of truth. This plan (`REFACTOR_PLAN.md v2.1`) is the tactical, accelerated execution sprint plan.
- **Sprint Scope (Phases 0–4):** The 4 calendar-day sprint executes the **Structural Core**: safety baseline, Generation A purge, clean target seam, god-file decomposition, and demo verification.
- **Accepted Trade-Off:** Because legacy backward compatibility is explicitly dropped, Generation A is purged in a single closed sweep on Day 1 rather than phased out defensively over multiple weeks.

---

## 2. The Closed Deletion Manifest (Generation A Purge)

To guarantee a clean build, the deletion manifest is strictly closed under its own import graph.

### 2.1 Pre-requisite Edits (Must Happen BEFORE File Deletions)
1. **Prune `status-badge.tsx` (5 lines):** In `src/components/portal/status-badge.tsx`, remove the unused union members `"Aberta" | "Rascunho" | "Pausada"`. The surviving component only maps `"Ativa" | "Inativa"`. This removes the sole active dependency on `type ActivityStatus` from `portal-view-service.ts` with zero JSX churn across the 6 surviving screens (`class-detail-screen`, `classes-screen`, `organization-detail-screen`, `organizations-screen`, `overview-screen`, `team-screen`).
2. **Delete `service-container.ts`:** All 4 of its imports (`PrismaCapabilityReader`, `PrismaAccessLinkStore`, `AccessLinkService`, `AuthorizationService`) are in the deletion set. The entire file `src/server/services/service-container.ts` must be deleted.
3. **Clean Up `proxy.ts` & `ajuda`:** In `src/proxy.ts`, remove the dead `/atividade/` no-referrer branch (`:109-116`). In `src/app/(professional)/portal/ajuda/page.tsx`, remove topics referencing deleted activity links.

### 2.2 Route Trees to Delete
| Directory | Physical Lines | Reason |
| :--- | :---: | :--- |
| `src/app/(professional)/portal/atividades/` | 1,188 | Replaced by `/portal/turmas` and numbered player sessions. Includes the 517-line `actions.ts`. |
| `src/app/(professional)/portal/materiais/` | 92 | Materials/CMS is explicitly deferred beyond V1 (`PRODUCT.md:115-119`). |
| `src/app/(professional)/portal/modulos/` | 23 | Obsolete redirect stubs. |
| `src/app/(professional)/portal/admin/jogos/` | 7 | Obsolete redirect stub. |
| `src/app/(professional)/portal/admin/modulos/` | 7 | Obsolete redirect stub. |
| `src/app/(professional)/portal/admin/auditoria/` | 95 | Sole writer of `AuditEvent` was `prisma-access-link-store.ts:325` (deleted). The page would render empty. |
| `src/app/(public-play)/atividade/[token]/` | 364 | Legacy session-token entry. Replaced by `/jogar` + QR bearer credentials. |

### 2.3 Services, Stores & Components to Delete
| File | Physical Lines | Reason |
| :--- | :---: | :--- |
| `src/server/services/portal-view-service.ts` | 521 | Hardcoded fake data. In server mode, causes pages to render empty or 404. |
| `src/server/services/access-link-service.ts` | 717 | Legacy shared link lifecycle; zero consumers once legacy routes are removed. |
| `src/server/db/prisma-access-link-store.ts` | 352 | Prisma store for the dead `AccessLink` model. |
| `src/server/services/public-link-service.ts` | 65 | Unused link validator with zero callers. |
| `src/server/services/link-status.ts` | 38 | Helper for dead access links. |
| `src/server/services/audit-actions.ts` | 103 | Audit constants for deleted access link lifecycle. |
| `src/server/services/authorization-service.ts` | 244 | Dead legacy capability service; V1 uses `authorization/v1-policy.ts`. |
| `src/server/db/prisma-capability-reader.ts` | 55 | Legacy capability reader helper. |
| `src/server/services/service-container.ts` | 45 | All 4 imported services deleted; zero consumers. |
| `src/server/security/tokens.ts` | 61 | Token generators for dead access links. |
| `src/components/portal/activity-builder.tsx` | 256 | UI component for deleted activity builder. |
| `src/components/portal/activity-controls.tsx` | 156 | UI controls for deleted activity links. |
| `src/components/portal/activity-mark.tsx` | 27 | UI badge for deleted activities. |
| `src/components/portal/material-editor.tsx` | 266 | UI editor for out-of-scope materials. |
| `src/components/portal/materials-explorer.tsx` | 132 | UI list for out-of-scope materials. |
| `src/components/portal/class-groups-explorer.tsx` | 237 | Redundant legacy explorer; replaced by `/portal/turmas`. |
| `src/components/portal/share-actions.tsx` | 147 | Share sheet for dead access links. |
| `src/components/public/public-state.tsx` | 36 | State container exclusive to deleted `/atividade/[token]` tree. |

### 2.4 Tests to Delete
| Test File | Tests | Reason |
| :--- | :---: | :--- |
| `tests/unit/access-link-service.test.ts` | 56 | 1,625 lines testing obsolete `AccessLinkService`. |
| `tests/unit/authorization.test.ts` | 24 | 634 lines testing obsolete `AuthorizationService` and capability records. V1 authorization is tested in `v1-authorization.test.ts`. |
| `tests/unit/access-link-tokens.test.ts` | 13 | Tests dead access link token generation. |
| `tests/unit/link-status.test.ts` | 5 | Tests dead link status enum mappings. |
| `tests/unit/portal-dev-bypass-actions.test.ts` | 2 | Tests dev-bypass on deleted activity actions. |
| `tests/unit/portal-dev-bypass.test.ts` | 2 | Tests dev-bypass on deleted `listAccessLinks`. |

### 2.5 Database Schema Changes & Migration `6_drop_generation_a`
In `prisma/schema.prisma`:
1. Remove `model AccessLink`.
2. Remove the 2 inverse relations on surviving models:
   - `ProfessionalProfile.createdAccessLinks AccessLink[] @relation("AccessLinkCreator")` (`:65`)
   - `Organization.accessLinks AccessLink[]` (`:80`)
3. Remove `model CapabilityAssignment`, `Organization.scopedCapabilities` (`:79`), and `enum Capability` (all consumers deleted; V1 authorization uses `v1-policy.ts`).
4. Remove `model RateLimitBucket` and clean up `RATE_LIMITED` code in `src/server/http/errors.ts` and `contracts/schemas/api-error.v1.schema.json`.
5. Keep `model AuditEvent` in schema for future V1 administrative logging.
6. Generate and track `prisma/migrations/6_drop_generation_a/migration.sql`.

**Total Purge Volume:** **~7,729 physical lines (~29% of handwritten code)** removed. The import graph closes cleanly with zero dangling references.

---

## 3. The Target Architecture & Dual-Runtime Seam

```text
┌───────────────────────────────────────────────────────────────┐
│                       User Interface                          │
│          (src/app/ and src/components/, React 19)             │
└───────────────────────────────┬───────────────────────────────┘
                                │ calls via typed target entry
                                ▼
┌───────────────────────────────────────────────────────────────┐
│              src/runtime/target.ts (Generated)                │
│    ├── Production Server Entry: src/runtime/target.server.ts  │
│    └── Demo Client Entry:       src/runtime/target.demo.ts    │
│            (Both satisfy src/runtime/contracts.ts)            │
└───────────────────────────────┬───────────────────────────────┘
                                │ invokes
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                    Domain Services (Use Cases)                │
│                     (src/application/*)                       │
│     - OrganizationService    - ClassService    - TeamService  │
└───────────────┬───────────────────────────────┬───────────────┘
                │ depends on ports              │ depends on ports
                ▼                               ▼
┌───────────────────────────────┐   ┌───────────────────────────┐
│     Production Adapter        │   │       Demo Adapter        │
│   (src/server/db/prisma-*)    │   │  (src/runtime/demo-store) │
│       PostgreSQL / Neon       │   │   localStorage Adapter    │
└───────────────────────────────┘   └───────────────────────────┘
```

### 3.1 Resolving Next.js 16 `E625` (The Generated Target Entry)
Next.js 16.3.2 enforces that any statically reachable `"use server"` action aborts static export with error **E625** (`server-reference-manifest.json` must be empty).
- **The Mechanism (Design 1):**
  1. `scripts/next-target.mjs` generates a gitignored `src/runtime/target.ts` before spawning `next`:
     - If `APP_RUNTIME_MODE === "server"`, `target.ts` re-exports `src/runtime/target.server.ts`.
     - If `APP_RUNTIME_MODE === "demo"`, `target.ts` re-exports `src/runtime/target.demo.ts`.
  2. Both target implementations satisfy `src/runtime/contracts.ts` (covering both **actions** and **build-time data readers**), ensuring compile-time drift detection.
  3. Because `target.demo.ts` imports **zero** `"use server"` files, `.next/server/server-reference-manifest.json` contains **0 registered action IDs** during `build:demo`, effortlessly passing `E625`.
  4. **Form Action Decoupling:** Convert `<form action={signInAction}>` (`entrar/page.tsx:73`) and `<form action={signOutAction}>` (`portal-shell.tsx:68`) into small Client Components (`sign-in-form.tsx`, `sign-out-button.tsx`) so action handlers can be passed without violating the Server→Client serializability boundary.
  5. Delete all 9 `@runtime/*` aliases from `next.config.ts` and `tsconfig.json`.

### 3.2 Prisma Client Tooling & TypeScript Scope
In Prisma 7, `provider = "prisma-client"` mandates an explicit `output` in `schema.prisma`.
- Keep `output = "../src/generated/prisma"` in `prisma/schema.prisma`.
- Add `src/generated/**` to `tsconfig.json`'s `exclude` array.
- This stops TypeScript from scanning the 29,722 lines of generated code, while preserving all surviving `@/generated/prisma/enums` imports without touching 30+ files.

### 3.3 Demo Persistence & Static Export Boundaries
- `src/runtime/adult-portal-demo-store.ts` remains persistence-backed via `window.localStorage` (with atomic rollbacks) to survive reloads, deep links, and multi-tab syncing.
- Update demo credential generation (`demo-issuer.ts`) to hash tokens with `hashPlayerCredentialToken` instead of storing `{ token, tokenHash: token }`.
- **Deep-Linking Note:** Seeded classes (`demo-turma-3a`, etc.) refresh cleanly in static export because they are prerendered via `generateStaticParams`. Newly created demo entities in `localStorage` persist across in-app navigation, but a hard browser refresh on an unseeded dynamic route falls back to the `/portal/turmas` list.

---

## 4. Deconstructing the God Files

### 4.1 CSS Restructuring (`portal.module.css`)
- **Baseline:** 4,910 lines, 308 distinct classes. `results.module.css` (378 lines) and `team-screen.module.css` (123 lines) already exist.
- **Tokens stay in `globals.css`:** All 68 tokens remain in `src/app/globals.css` `:root`.
- **Execution:**
  1. Purging Generation A eliminates **1,567 physical lines of dead CSS**.
  2. Extract `src/components/shared/primitives.module.css`: common buttons, inputs, form fields, cards, and shared badges.
  3. Extract component modules for surviving screens:
     - `classes-screen.module.css`
     - `organizations-screen.module.css`
     - `overview-screen.module.css`
     - `player-access.module.css`
  4. Residual `portal.module.css` handles the main shell layout (sidebar, topbar, brand).

### 4.2 `src/runtime/game-offline-sync.ts` (1,222 lines)
Split cleanly into `src/runtime/offline/`:
1. `types.ts` (~160 lines): Shared queue types, persistence interfaces, and conflict shapes.
2. `idb-store.ts` (~650 lines): Typed IndexedDB database open/migration, store definitions, and low-level CRUD.
3. `request-registry.ts` (~60 lines): Web Crypto SHA-256 fingerprint generation and idempotent retry registry (`eventRequestIdentity`, `stableJson`).
4. `sync-engine.ts` (~350 lines): Queue processing, transport execution, conflict detection, and status reporting.
5. Repoint `tests/unit/game-offline-sync.test.ts` imports accordingly.

### 4.3 `src/components/public/game-host.tsx` (932 lines)
Note: `src/components/public/game-bridge.ts` (84 lines) already exists for protocol message parsing.
Decompose the remainder into:
1. `src/components/public/use-game-bridge.ts`: Handles iframe postMessage validation, message handshake, and launch token renewal.
2. `src/components/public/use-game-sync.ts`: Handles queue state monitoring, conflict notification, and IndexedDB sync triggers.
3. Eliminate duplicate handshake code between `game-host.tsx` and `demo-game-adapter.tsx`.
4. `src/components/public/game-host.tsx` (~250 lines): Clean presentational component rendering the game iframe, alert banners, and mobile wrapper.

### 4.4 `src/application/adult-portal/service.ts` (616 lines)
1. Extract navigation construction: Move `getShell()` navigation logic out of the domain service into `src/components/portal/portal-navigation-presenter.ts`.
2. Keep core domain methods cohesive or split into focused services (`organization-service.ts`, `class-service.ts`, `team-service.ts`) sharing private authorization guards via `authorization-guards.ts`.

---

## 5. CSS Strategy: Tailwind Assessment

### 5.1 The Dilemma
Would moving the application to Tailwind CSS improve the codebase, or will it inflate the migration effort?

### 5.2 Comparative Analysis
| Factor | Refactored CSS Modules | Full Tailwind CSS Rewrite |
| :--- | :--- | :--- |
| **Effort / Time** | **~4–6 hours** (Splitting selectors into co-located files) | **3–5 days** (Rewriting JSX in 33 components) |
| **Regression Risk** | **Low:** JSX classes stay almost identical; zero layout breakage. | **Very High:** High risk of breaking complex layouts, modal dialogs, and print stylesheets. |
| **Print Stylesheets** | Built-in `@media print` rules for QR badge printing work seamlessly. | Requires custom print utility overrides or raw CSS plugins. |
| **Caramelito Tokens** | Already defined cleanly via CSS variables (`--yellow`, `--green-action`, etc.). | Must be mapped into Tailwind theme extensions. |
| **Developer Ergonomics** | High: scoped styles, no global leakage, standard CSS syntax. | High: utility-first, rapid inline tweaks, no separate CSS files. |

### 5.3 Recommendation: A Pragmatic Two-Step Approach
> **Verdict: Do NOT perform a full Tailwind rewrite during this 3–4 day sprint.**

1. **Right Now (Sprint 1):** Modularize CSS Modules. Delete dead Generation A styles, extract shared primitives into `primitives.module.css`, and split the rest into co-located component stylesheets.
2. **Later (Sprint 2+):** Install Tailwind alongside CSS Modules if the team prefers utility classes for future velocity.

---

## 6. Day-by-Day Implementation Roadmap

```text
Day 0: Baseline & Safety (Half day)
├── Commit 30 untracked files + uncommitted schema + migrations 4 & 5
├── Record baseline gates (tsc errors, test counts, manifest)
└── Setup ci.yml on PRs (check + build:demo with manifest verification)

Day 1: Closed Purge & Migration
├── Prune status-badge.tsx (remove Aberta/Rascunho/Pausada)
├── Delete service-container.ts & authorization.test.ts
├── Delete auditoria page + 6 Generation A route trees + dead services (~7.7k lines)
├── Update schema.prisma & generate migration 6_drop_generation_a
└── Verify Day 1 gate: prisma validate && prisma generate && npm run typecheck && npm test

Day 2: Generated Target Seam
├── Define contracts in src/runtime/contracts.ts
├── Wire target.server.ts & target.demo.ts via generated src/runtime/target.ts
├── Convert entrar/page.tsx & portal-shell.tsx forms to Client Components
├── Remove the 9 @runtime/* aliases from configs
├── Add src/generated/** to tsconfig.json exclude
└── Verify Day 2 gate: build:demo (assert 0 server-reference IDs) & build:server

Day 3: God-File Decomposition
├── Split game-offline-sync.ts (idb-store.ts, request-registry.ts, sync-engine.ts, types.ts)
├── Split game-host.tsx (useGameBridge.ts, useGameSync.ts, GameHost.tsx)
├── Move navigation logic out of AdultPortalService to portal-navigation-presenter.ts
└── Modularize portal.module.css (purge 1,567 lines, extract primitives & screen modules)

Day 4: Verification, Demo Rebuild & Documentation
├── Verify build:demo exports clean static site for GitHub Pages (assert no api/ in out/)
├── Verify build:server passes with .env.example
├── Verify all active unit tests pass cleanly
└── Update README and docs/current-architecture.md
```

---

## 7. Success Criteria & Verification Gates

1. **File Size Ratchet:** All new or modified files respect the governing budget:
   - Components: 250 warn / 400 fail
   - Modules & Services: 300 warn / 500 fail
   - CSS Modules: 300 warn / 600 fail
   - Test suites: 400 warn / 800 fail
2. **Clean Action Seam:** Zero registered Server Action IDs in `.next/server/server-reference-manifest.json` after `build:demo`. Zero `@runtime/*` aliases in `next.config.ts`.
3. **Tooling Health:** `npm run build:demo`, `npm run build:server`, `npm run typecheck`, and `npm test` execute cleanly.
4. **CI Enforcement:** GitHub Actions automatically tests, lints, typechecks, and verifies builds on every PR (`ci.yml`).
5. **Functional Demo:** `npm run build:demo` exports the static GitHub Pages site with fully operational in-browser navigation, local persistence, and mock interactions for seeded routes.
