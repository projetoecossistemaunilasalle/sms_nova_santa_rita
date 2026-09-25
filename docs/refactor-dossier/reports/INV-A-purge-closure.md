# INV-A — §2 Generation A Purge: verified closure and executable work order

**Agent:** INV-A (read-only investigation)
**Date:** 2026-09-23
**Subject:** `REFACTOR_PLAN.md` v2.1 §2 ("Closed Deletion Manifest — Generation A Purge"), §2.1 pre-requisites, §2.5 schema drops
**Method:** every claim below is measured from the working tree (`wc -l`, AST-free import-graph build, exhaustive literal grep over the 159 surviving `src`+`tests` files) or from a command I actually ran. Nothing is inherited from `docs/agent-reviews/refactor-plan-v2/` without re-measurement; where I agree with a prior reviewer I say so and cite my own evidence.

---

## 0. Baseline measured in this run

| Gate | Result | Evidence |
| :--- | :--- | :--- |
| `git status --short` | clean except `?? docs/refactor-dossier/` | run at 2026-09-23 18:19 |
| Migrations tracked | `0_init … 5_v1_game_events` **all 6 tracked** | `git ls-files prisma/migrations` |
| `npx prisma validate` | **valid** | run |
| `npx vitest run` | **33 files / 284 tests, all pass** | run |
| `npm run typecheck` | **UNVERIFIED** — not run (read-only task; `tsconfig.json:17 "incremental": true` would rewrite `tsconfig.tsbuildinfo`) | `tsconfig.json:17` |
| Handwritten baseline | 34,012 lines = 27,433 `src` (ts/tsx/css, excl. `src/generated/`) + 6,579 `tests` | measured |
| §2 purge, measured | **7,802 physical lines across 46 files** (22 trees/files in §2.2 = 1,754; 18 in §2.3 = 3,458; 6 in §2.4 = 2,590) | measured |
| Post-purge suite | 27 files / 182 tests (−102 blocks, −35.9%) | 284 − (56+24+13+5+2+2) |

> **Day 0 is stale.** `REFACTOR_PLAN.md:210` ("Commit 30 untracked files + uncommitted schema + migrations 4 & 5") is already done — `4_v1_game_state` and `5_v1_game_events` are tracked, and the tree is clean. Drop that line item.

---

## 1. Verified deletion set

**Column key.** *Plan* = lines claimed by `REFACTOR_PLAN.md`. *Importers* = files that statically/dynamically import the target (graph-derived). *Surv.* = importers that survive the purge. `Δ` marks a mismatch with the plan.

### 1.1 §2.2 Route trees — all 7 exist, 6 of 7 line counts exact

| Tree | Exists? | Files | Physical lines | Plan | Surv. importers | Notes |
| :--- | :--- | ---: | ---: | ---: | ---: | :--- |
| `src/app/(professional)/portal/atividades/` | yes | 9 | **1,188** | 1,188 ✓ | 0 | `actions.ts` = 517 ✓ (plan `:37`). Files: `actions.ts:517`, `[id]/resultados/page.tsx:166`, `[id]/page.tsx:159`, `[id]/compartilhar:89`, `[id]/editar:65`, `page.tsx:109`, `[id]/conflito:44`, `vazia:22`, `nova:17` |
| `src/app/(professional)/portal/materiais/` | yes | 3 | **92** | 92 ✓ | 0 | `page.tsx:38`, `[id]/editar:37`, `novo:17` |
| `src/app/(professional)/portal/modulos/` | yes | 2 | **23** | 23 ✓ | 0 | `page.tsx:7` + `[id]/page.tsx:16`; both are bare `redirect("/portal")` stubs (`modulos/page.tsx:6`, `modulos/[id]/page.tsx:15`) |
| `src/app/(professional)/portal/admin/jogos/` | yes | 1 | **7** | 7 ✓ | 0 | `page.tsx:6` → `redirect("/portal")` |
| `src/app/(professional)/portal/admin/modulos/` | yes | 1 | **7** | 7 ✓ | 0 | `page.tsx:6` → `redirect("/portal")` |
| `src/app/(professional)/portal/admin/auditoria/` | yes | 1 | **73** | 95 → **Δ −22** | 0 | Only `page.tsx`, 73 lines. Plan over-states by 22 |
| `src/app/(public-play)/atividade/[token]/` | yes | 5 | **364** | 364 ✓ | 0 | `jogar/page.tsx:142`, `[state]:75`, `jogar/[state]:63`, `page.tsx:52`, `layout.tsx:32` |
| **§2.2 subtotal** | | **22** | **1,754** | 1,776 | **0** | |

### 1.2 §2.3 Services / stores / components — all 18 exist, all 18 line counts exact

| File | Exists? | Lines | Plan | Importers | Surv. importers | Notes |
| :--- | :--- | ---: | ---: | ---: | ---: | :--- |
| `src/server/services/portal-view-service.ts` | yes | **521** | 521 ✓ | 17 | **1** | **The only real dangling edge in the whole manifest** — see §3 |
| `src/server/services/access-link-service.ts` | yes | **717** | 717 ✓ | 5 | 0 | all 5 importers are themselves deleted |
| `src/server/db/prisma-access-link-store.ts` | yes | **352** | 352 ✓ | 1 | 0 | sole importer = `service-container.ts:2` (deleted) |
| `src/server/services/public-link-service.ts` | yes | **65** | 65 ✓ | 1 | 0 | "zero callers" ✓ — only `tests/unit/access-link-service.test.ts:18` |
| `src/server/services/link-status.ts` | yes | **38** | 38 ✓ | 3 | 0 | `atividades/[id]/page.tsx:12`, `[id]/resultados/page.tsx:7`, `tests/unit/link-status.test.ts:3` — all deleted |
| `src/server/services/audit-actions.ts` | yes | **103** | 103 ✓ | 1 | 0 | only `access-link-service.ts:13` |
| `src/server/services/authorization-service.ts` | yes | **244** | 244 ✓ | 5 | 0 | V1 path is `src/server/authorization/v1-policy.ts` (survives, no overlap) |
| `src/server/db/prisma-capability-reader.ts` | yes | **55** | 55 ✓ | 1 | 0 | only `service-container.ts:1` |
| `src/server/services/service-container.ts` | yes | **45** | 45 ✓ | 1 | 0 | **double-listed** in §2.1.2 and §2.3 — same single action |
| `src/server/security/tokens.ts` | yes | **61** | 61 ✓ | 6 | 0 | self-contained (imports only `node:crypto`, `tokens.ts:1`); V1 helpers do **not** reuse it — `player-credential-tokens.ts:1` and `launch-token.ts:1` each import `node:crypto` directly. Clean delete |
| `src/components/portal/activity-builder.tsx` | yes | **256** | 256 ✓ | 2 | 0 | |
| `src/components/portal/activity-controls.tsx` | yes | **156** | 156 ✓ | 1 | 0 | |
| `src/components/portal/activity-mark.tsx` | yes | **27** | 27 ✓ | 1 | 0 | |
| `src/components/portal/material-editor.tsx` | yes | **266** | 266 ✓ | 2 | 0 | |
| `src/components/portal/materials-explorer.tsx` | yes | **132** | 132 ✓ | 1 | 0 | |
| `src/components/portal/class-groups-explorer.tsx` | yes | **237** | 237 ✓ | **0** | 0 | **Dead today** — zero importers repo-wide (only doc mentions at `docs/architecture-audit-2026-09-23.md:310,644`). Deleting is free but it is not "Generation A coupling", it is pre-existing dead code |
| `src/components/portal/share-actions.tsx` | yes | **147** | 147 ✓ | 2 | 0 | `atividades/[id]/compartilhar/page.tsx:5` + `activity-builder.tsx:8` (both deleted) |
| `src/components/public/public-state.tsx` | yes | **36** | 36 ✓ | 3 | 0 | all three importers live inside `atividade/[token]/` |
| **§2.3 subtotal** | | **3,458** | 3,458 ✓ | | **1** | |

### 1.3 §2.4 Tests — all 6 exist, all 6 counts exact

| Test file | Exists? | Lines | Tests | Plan |
| :--- | :--- | ---: | ---: | :--- |
| `tests/unit/access-link-service.test.ts` | yes | 1,625 ✓ | **56** ✓ | 56 |
| `tests/unit/authorization.test.ts` | yes | 634 ✓ | **24** ✓ | 24 |
| `tests/unit/access-link-tokens.test.ts` | yes | 114 | **13** ✓ | 13 |
| `tests/unit/link-status.test.ts` | yes | 66 | **5** ✓ | 5 |
| `tests/unit/portal-dev-bypass-actions.test.ts` | yes | 118 | **2** ✓ | 2 |
| `tests/unit/portal-dev-bypass.test.ts` | yes | 33 | **2** ✓ | 2 |
| **§2.4 subtotal** | | **2,590** | **102** | |

**Replacement coverage for §2.4 exists:** `tests/unit/v1-authorization.test.ts` (124 lines, 4 vitest cases) covers `src/server/authorization/v1-policy.ts`, which survives and has zero coupling to `AuthorizationService`.

---

## 2. True reverse-dependency closure (the headline result)

I built the full static+dynamic import graph over `src/` and `tests/` (9 alias paths from `tsconfig.json:24-42` resolved, relative specifiers resolved, `.css` treated as a node) and intersected it with the 46-file deletion set.

**There is exactly one edge from a surviving file into the deletion set:**

```
src/components/portal/status-badge.tsx:1   import type { ActivityStatus } from "@/server/services/portal-view-service";
```

Every other importer of every deleted module is itself deleted. Confirmed twice: once by graph intersection, once by an exhaustive literal grep for 40 Generation-A identifiers (`AccessLink`, `portal-view`, `listAccessLinks`, `resolveLinkStatus`, `hashToken`, `generateAccessLinkToken`, `Capability`, `share-actions`, `auditEvents`, `getDevBypassAccessLink`, `auditoria`, `atividades`, `materiais`, `modulos`, …) across all 159 surviving files, which returned only:

| Hit | Verdict |
| :--- | :--- |
| `src/components/portal/status-badge.tsx:1` | **REAL — must be edited before deletion** |
| `src/components/portal/status-badge.tsx:14` | dead union member (`"Novas atividades bloqueadas"`) |
| `tests/unit/auth.test.ts:146,147` | string argument to a pure predicate — see §5 |
| `src/app/layout.tsx:12` | metadata prose ("atividades educativas") — copy, not a route |

**Route-string closure is clean.** Grepping survivors for `href="/portal/atividades…"`, `"/portal/materiais…"`, `"/portal/modulos…"`, `"admin/jogos|modulos|auditoria"`, `"/atividade/…"` and `redirect(...)`/`revalidatePath(...)` targets produced **zero** hits in surviving `src`. All `/portal/atividades/*` and `/portal/materiais/*` literals live inside the deleted trees (e.g. `atividades/actions.ts:275,329,357,358,361,396,397,437,438,472,473,502,503`; `materials/page.tsx:22`; `material-editor.tsx:196`; `materials-explorer.tsx:115`).

**CSS closure is clean.** `grep -rn "composes" src --include='*.css'` → **0 hits**, so no cross-file CSS dependency exists; deleting a component can only *de-add* a class, never dangle one.

**Config closure is clean.** None of the 9 `@runtime/*` aliases (`next.config.ts:42-80`, `tsconfig.json:24-42`) points at a §2 deletion target. `vitest.config.mts` aliases only `@` → `src/` (`vitest.config.mts:8`), and no test imports `@runtime/*`.

**`generateStaticParams` closure is clean.** All 5 occurrences inside deleted trees (`atividades/[id]/{page,editar,compartilhar,conflito,resultados}`, `materiais/[id]/editar/page.tsx:12`, `modulos/[id]/page.tsx:5`, `atividade/[token]/{page,[state],jogar,jogar/[state]}`) are removed with their trees. The 3 surviving ones (`admin/organizacoes/[id]:13`, `resultados/[classGroupId]`, `turmas/[id]`) depend only on survivors.

**`qrcode` npm dep stays.** After deleting `share-actions.tsx:4`, `src/components/portal/player-credential-print-sheet.tsx:4` still imports it (V1 QR printing). Do **not** remove `qrcode` / `@types/qrcode` from `package.json:34,37`.

---

## 3. BLOCKER 1 — §2.1.1 as written does not sever `status-badge.tsx`, and does not compile

`REFACTOR_PLAN.md:30` says: *"remove the unused union members `"Aberta" | "Rascunho" | "Pausada"`… The surviving component only maps `"Ativa" | "Inativa"`."*

Two independent defects:

**(a) The dependency is not severed.** The source type is
```ts
// src/server/services/portal-view-service.ts:9
export type ActivityStatus = "Aberta" | "Rascunho" | "Pausada" | "Encerrada";
```
It has **four** members. Deleting only three still requires `import type { ActivityStatus }` for `"Encerrada"`, so `portal-view-service.ts` keeps a live importer and §2.3's deletion of that file is **not closed**.

**(b) The stated edit is a guaranteed red typecheck.** With `"strict": true` (`tsconfig.json:8`), removing members that are still compared produces TS2367 ("no overlap") at:

| Line | Current code |
| :--- | :--- |
| `status-badge.tsx:18` | `status === "Aberta" \|\|` |
| `status-badge.tsx:23` | `: status === "Rascunho" \|\| status === "Convite pendente"` |
| `status-badge.tsx:25` | `: status === "Pausada" \|\|` |

This agrees with `docs/agent-reviews/refactor-plan-v2/VV-A-deletion-manifest-verification.md:51,88` (the "5-line edit" adjudication), which v2.1 absorbed as "5 lines" — but 5 lines is still wrong, because it leaves `"Encerrada"` bound to the deleted module.

**(c) What the 6 surviving screens actually pass — verified.** `src/components/portal/adult-portal-helpers.ts:15`:
```ts
export function recordStatusLabel(status: RecordStatus): "Ativa" | "Inativa" {
```
All **10** surviving `<StatusBadge>` call sites pass `recordStatusLabel(...)` and nothing else:
`class-detail-screen.tsx:67,143` · `classes-screen.tsx:147` · `organization-detail-screen.tsx:134,181,225` · `organizations-screen.tsx:157` · `overview-screen.tsx:174,220` · `team-screen.tsx:341`.
Therefore the correct `Status` domain is exactly `"Ativa" | "Inativa"`. Plan's *claim* is right; its *prescription* is wrong.

**Dead union members, verified zero producers anywhere:**

| Member | Line | Producers today |
| :--- | :--- | :--- |
| `"Aberta"` | `:8` via `ActivityStatus` | `atividades/page.tsx:14`, `activity-controls.tsx:40,68,88,110`, `link-status.ts:37`, `portal-view-service.ts:92,107,125` — **all deleted** |
| `"Rascunho"` | via `ActivityStatus` | same deleted set |
| `"Pausada"` | via `ActivityStatus` | same deleted set |
| `"Encerrada"` | via `ActivityStatus` | same deleted set |
| `"Arquivado"` | `:9` | `portal-view-service.ts:64` (`MaterialStatus`) — deleted |
| `"Publicado"` | `:10` | `material-editor.tsx:44,217`, `portal-view-service.ts:296,310,323,351` — deleted |
| `"Convite pendente"` | `:12` | `portal-view-service.ts:174` — deleted |
| `"Lançamentos bloqueados"` | `:13` | **none — dead even today** |
| `"Novas atividades bloqueadas"` | `:14` | **none — dead even today** |

**Corrected edit (replace `status-badge.tsx:1-29` with):**
```tsx
import styles from "./portal.module.css";

export function StatusBadge({ status }: { status: "Ativa" | "Inativa" }) {
  const tone = status === "Ativa" ? styles.statusPositive : styles.statusNeutral;

  return <span className={`${styles.statusBadge} ${tone}`}>{status}</span>;
}
```
Consequence to log for §4.1: `styles.statusWarning` and `styles.statusDanger` (declared once each in `portal.module.css`) lose their **only** consumer, because all four `styles.status*` tones are referenced exclusively from `status-badge.tsx:22,24,28,29`. `.toast` (`portal.module.css:2463,2482`) also loses its last live consumer — see §4.3.

---

## 4. BLOCKER 2 — §2.5 as written fails `prisma validate`; MISS — one inverse relation is unlisted

`REFACTOR_PLAN.md:77-86` names four removals plus **two** inverse relations (`schema.prisma:65`, `:80`) and `Organization.scopedCapabilities` (`:79`). It **omits a third `CapabilityAssignment` inverse**:

```prisma
// prisma/schema.prisma:97  (model OrganizationMembership)
  capabilityAssignments CapabilityAssignment[]
```

**Proven, not argued.** I copied `prisma/schema.prisma` to a scratch file outside the repo and applied §2.5 literally:

```
Error: Prisma schema validation - (validate wasm)
Error code: P1012
error: Type "CapabilityAssignment" is neither a built-in type, nor refers to another model, composite type, or enum.
  -->  schema.prisma:84    <- (the :97 line, renumbered by the deletions above it)
Validation Error Count: 1
```
After also deleting that line: `The schema … is valid 🚀`.

This directly refutes the adjudication at `docs/agent-reviews/refactor-plan-v2/00-SYNTHESIS.md:93` ("exactly two [inverse relations] … so `prisma validate` cannot fail") — that sentence was scoped to `AccessLink` and holds there, but the same class of gap exists for `CapabilityAssignment`. **Day 1's own gate (`REFACTOR_PLAN.md:219`) goes red.**

### 4.1 Corrected §2.5 checklist (all line numbers are current `prisma/schema.prisma`)

| # | Target | Line(s) | In plan? |
| :--- | :--- | :--- | :--- |
| 1 | `model AccessLink` | `:261-279` | ✓ |
| 2 | `ProfessionalProfile.createdAccessLinks` | `:65` | ✓ |
| 3 | `Organization.accessLinks` | `:80` | ✓ |
| 4 | `model CapabilityAssignment` | `:245-259` | ✓ |
| 5 | `Organization.scopedCapabilities` | `:79` | ✓ |
| 6 | `enum Capability` | `:18-27` | ✓ |
| 7 | **`OrganizationMembership.capabilityAssignments`** | **`:97`** | **✗ ADD** |
| 8 | `model RateLimitBucket` | `:300-310` | ✓ |
| 9 | `RATE_LIMITED` in `src/server/http/errors.ts` | `:11` | ✓ — premise verified: the only production use is `atividades/actions.ts:181` (deleted) |
| 10 | `RATE_LIMITED` in `contracts/schemas/api-error.v1.schema.json` | `:21` | ✓ — no test asserts schema↔`apiErrorCodes` parity (`tests/unit/v1-contracts.test.ts` never references `api-error`; `tests/unit/http.test.ts:28` only uses `"FORBIDDEN"`), so the two edits are independent and safe |
| 11 | `ProfessionalProfile.auditEvents` / `AuditEvent.actor` | `:66`, `:292` | keep — `AuditEvent` is kept, so both remain valid |

`Capability` has **no surviving TS consumer**: the only `Capability` identifiers in `src` are `atividades/actions.ts:122,129,137,148` (deleted), `access-link-service.ts:2` (deleted), and `prisma-capability-reader.ts` (deleted). The `capabilityAssignments` Prisma queries are only at `prisma-capability-reader.ts:26,44` (deleted). `prisma-adult-portal-store.ts` (surviving) touches neither model.

### 4.2 MISS — §2.1.3's `proxy.ts` line reference would delete live security code

`REFACTOR_PLAN.md:32` says "remove the dead `/atividade/` no-referrer branch (`:109-116`)". The actual block, `src/proxy.ts:108-118`:

```ts
108    // Public activity links are opaque tokens in the URL path and are forwarded
109    // to GameMaker via ?activity_token. Use 'no-referrer' for those routes so
110    // the token never leaks via Referer, even same-origin. Other routes keep a
111    // stricter default.
112    const referrerPolicy =
113      request.nextUrl.pathname.startsWith("/atividade/") ||
114      request.nextUrl.pathname === "/jogar" ||
115      request.nextUrl.pathname.startsWith("/jogar/")
116        ? "no-referrer"
117        : "strict-origin-when-cross-origin";
118    response.headers.set("Referrer-Policy", referrerPolicy);
```

Deleting `:109-116` removes line `112` (the `const`), `:114` and `:115` (**the live `/jogar` branches**) and `:116` (the ternary's true arm) — a syntax error *and* a security regression. **The minimal correct edit is to delete line `113` only** and reword the `:108-111` comment.

`:114-115` must survive: V1 puts the bearer credential in a **query parameter** of `/jogar` — `src/components/portal/player-credential-print-sheet.tsx:22-24`:
```ts
const url = new URL(`${basePath}/jogar/`, window.location.origin);
url.searchParams.set("cred", token);
```
so Referer leakage protection for `/jogar` is load-bearing. `src/proxy.ts:137` (`matcher`) is path-agnostic and needs no change.

### 4.3 MISS — Generation-A-adjacent dead code the plan does not name

| File / symbol | `file:line` | Lines | Status | Recommendation |
| :--- | :--- | ---: | :--- | :--- |
| `DemoActionButton` | `src/components/portal/demo-action-button.tsx:9` | 39 | **0 importers repo-wide** (verified: the only occurrence of the string `demo-action-button`/`DemoActionButton` in the repo is its own declaration) | Add to §2.3. Its deletion also makes `.toast` (`portal.module.css:2463,2482`) fully dead, which matters because the other 4 `.toast` consumers (`activity-controls`, `class-groups-explorer`, `material-editor`, `share-actions`) are all purged |
| `getPublicBaseUrl` | `src/server/http/base-url.ts:22` | 45 (whole file) | **0 callers** — `getPublicBaseUrl` occurs exactly once repo-wide (the declaration) | Add to §2.3 (pre-existing dead, not Generation A) |
| `isDemoRuntime` | `src/runtime/mode.ts:13-17` | 5 | 11 occurrences today, 10 of them in **deleted** files (`portal-view-service.ts:4,7` + 4 × `atividade/[token]/*`). After the purge it has **zero** users; `tests/unit/runtime-mode.test.ts:3` imports only `getRuntimeMode` | TRIM after §2.2/§2.3 (do not pre-delete — that breaks the pre-purge build) |
| `getGameClientUrl` | `src/server/config/game-client.ts:38` | 1 | 0 users (pure re-export alias of `resolveGameClientUrl`) | TRIM (pre-existing dead) |
| `createGameLaunchUrl` | `src/server/config/game-client.ts:44-48` | 5 | 0 production callers; only `tests/unit/game-client.test.ts:4,27,30`. It is the `?activity_token` forwarder the deleted `/atividade/[token]` flow was built around, and `/jogar` never called it | Decide: TRIM + drop the `describe("createGameLaunchUrl")` block, or keep as V1 launch plumbing. Either way document it |
| `requestPasswordResetAction` | `src/app/(professional)/entrar/recuperar/actions.ts:8` | 22 + its page | Route `/entrar/recuperar` is **unreachable**: `grep -F "recuperar"` over `src`+`tests` returns only three unrelated Portuguese prose hits (`demo-role-controls.tsx:96`, `game-host.tsx:255,914`). No `href`, no import | Out of §2 scope but flag: it is a `"use server"` module, which matters for the §3.1 `E625` gate |
| 8 unused `ApiErrorCode` members | `src/server/http/errors.ts:14,15,16,17,18,19,20,21` (`ACTIVITY_NOT_OPEN`, `ACTIVITY_LINK_INVALID`, `ACTIVITY_LINK_EXPIRED`, `MODULE_LAUNCHES_BLOCKED`, `GAME_NOT_IN_ACTIVITY`, `GAME_DISABLED_FOR_ACTIVITY`, `GAME_LAUNCHES_BLOCKED`, `ATTEMPT_ALREADY_COMPLETED`) | — | 0 occurrences in `src` outside the list; plan only names `RATE_LIMITED` | Extend §2.5.4 to the `ACTIVITY_*` / `MODULE_*` / `GAME_*` members too — they are the API surface of the deleted product generation, mirrored at `contracts/schemas/api-error.v1.schema.json:24-31`. Verify no GameMaker-side consumer first (**UNVERIFIED** — the game client is out of repo) |
| `DEV_BYPASS_ACTOR` export | `src/server/auth/dev-bypass-gateway.ts:9` | — | Only external consumer was `portal-view-service.ts:1` (deleted); still used in-file at `:17` | Keep the const, drop the `export` keyword. The module itself **survives** (`src/server/auth/gateway.ts:1` imports `DevBypassAuthGateway`) |
| `getDevBypassAccessLink` | `src/server/services/portal-view-service.ts:491` | — | inside a deleted file — no separate action | none |

### 4.4 MISS — documentation dangling references (Day-4 work, but must be on the list)

| File:line | Stale content |
| :--- | :--- |
| `walkthrough.md:11` | Published URL `https://niciniv.github.io/SMS_Portal/atividade/7FQ-29M/` — 404 after purge |
| `walkthrough.md:24` | Describes `portal-view-service.ts` fixture behaviour |
| `walkthrough.md:40-51` | Lists 12 purged routes as delivered surface |
| `docs/current-architecture.md:175,178` | `/atividade/[token]` documented as live and "to be reconciled" |
| `implementation_plan.md:19,24,52-62` | Whole Generation A route list + `portal-view-service.ts` / `PrismaAccessLinkStore` |
| `docs/schemas/database-model.md`, `api-contracts.md`, `domain-rules.md` | document `AccessLink` / `CapabilityAssignment` (`grep -l` confirmed all three) |
| `REFACTOR_PLAN.md:37-43,88` | numeric corrections in §5 below |

### 4.5 MISS — §2's own arithmetic

`REFACTOR_PLAN.md:88` claims **~7,729 physical lines**. §2.2's own rows sum to 1,776, §2.3 to 3,458, §2.4 to 2,590 → **7,824**. And `1,776 − 95 = 1,681`; `1,681 + 3,458 + 2,590 = 7,729` exactly. So **the "~7,729" figure silently omits the auditoria row it just added to §2.2.** Measured truth: **7,802** lines (auditoria is 73, not 95).

The "≈29% of handwritten code" claim is also overstated. Measured against the non-generated handwritten base (34,012 lines: 27,433 `src` ts/tsx/css + 6,579 `tests`), the purge is **22.9%**; against `src` alone (5,212 / 27,433) it is **19.0%**. No counting method I tried reproduces 29%.

---

## 5. Overreach — things the plan asks for that live code or reality resists

| # | Plan claim | Finding | Verdict |
| :--- | :--- | :--- | :--- |
| O1 | `:32` "In `ajuda/page.tsx`, remove topics referencing deleted activity links" **as a §2.1 pre-requisite edit** | `src/app/(professional)/portal/ajuda/page.tsx` is a **Server Component** (no `"use client"` directive anywhere in its 50 lines; `export default function HelpPage()` at `:26`, `export const metadata` at `:5`). Its only imports are `PageHeader:1`, `portal.module.css:2`, `Icon:3` — **none deleted**, and its `topics` array (`:7-24`) contains **zero `href`s, zero route strings, zero module references**. Nothing breaks if it is untouched | **Overreach as a "pre-requisite".** It is optional copy hygiene: topics 1 (`:8-11` "Links de acesso"), 3 (`:16-19` "Status e validade"), 4 (`:20-23` "Acesso anônimo") describe the deleted link lifecycle. Move it out of §2.1 into the Day-4 doc pass. If edited, keep 2+ topics: the page's `styles.moduleGrid/moduleCard/moduleArt/textLink` (`:34-45`) are still needed — those classes are used **only** by this page (`moduleGrid` @ `portal.module.css`, `moduleCard`, `moduleArt`) plus `textLink`, so over-deleting the page would make them dead |
| O2 | `:42` auditoria = 95 lines | 73 | Fix the number |
| O3 | `:85` "Keep `model AuditEvent` in schema for future V1 administrative logging" **while** `:42` deletes its only reader | Confirmed by full-codebase sweep: `auditEvent`/`AuditEvent` appears in exactly 4 non-generated places — the sole **writer** `src/server/db/prisma-access-link-store.ts:325-326` (deleted), the type input `access-link-service.ts:40,113` (deleted), the fixture `portal-view-service.ts:373,416` (deleted, and `:416` is `demoRuntime ? demoAuditEvents : []` so it is already empty in server mode), and the sole **reader** `admin/auditoria/page.tsx:4,54` (deleted). `tests/unit/access-link-service.test.ts:15,47,273` (deleted) | **Intentional, not a break** — but the plan should say plainly that §2 leaves `AuditEvent` as a **write-nothing, read-nothing table** with a live inverse at `schema.prisma:66`. Either annotate it as "parked for V1 admin logging, no code touches it" or drop it too. Also: the plan's claim `:42` ("Sole writer … was `prisma-access-link-store.ts:325`") is **CONFIRMED** |
| O4 | `:56` `service-container.ts` in §2.3 **and** `:31` §2.1.2 "must be deleted" | Same single action, double-counted. §2.1.2's premise is **CONFIRMED**: `service-container.ts:1,2,3,4` import `PrismaCapabilityReader`, `PrismaAccessLinkStore`, `AccessLinkService`, `AuthorizationService` — all four are §2.3 deletions; its 1 importer (`atividades/actions.ts`, via 7 `await import(...)` at `:121,261,333,377,418,458,493`) is also deleted. Remove the §2.3 row to avoid two steps doing one job |
| O5 | `:63` `class-groups-explorer.tsx` presented as Generation A coupling | 0 importers today (§1.2). Deleting is correct but the row's *reason* ("Redundant legacy explorer; replaced by `/portal/turmas`") overstates: nothing imports it, so it cannot be a coupling or a regression |
| O6 | `:43` `/atividade/[token]/` "Replaced by `/jogar` + QR bearer credentials" | Mechanically true (`/jogar` uses `?cred=` per `player-credential-print-sheet.tsx:22-24`; `public-shell.tsx` survives via `jogar/layout.tsx:4`; `public.module.css` survives via 4 consumers). But **no redirect shim is possible**: demo mode is `output: "export"` (`next.config.ts:28`), where Next.js `redirects` are unsupported. Every already-printed legacy QR and the published `out/atividade/**` URLs (`out/atividade` exists today) hard-404 to `/SMS_Portal/404.html` |

---

## 6. Required edits to surviving files

Ordered by dependency. Nothing here may be skipped: rows E1 and E2 are **build-breakers**.

| ID | `file:line` | Current code | Why it breaks | The edit |
| :--- | :--- | :--- | :--- | :--- |
| **E1** | `src/components/portal/status-badge.tsx:1-29` | `import type { ActivityStatus } from "@/server/services/portal-view-service";` + 9-member `Status` union + 4-arm tone ternary | **TS2307** on `:1` once `portal-view-service.ts` is deleted; and the §2.1.1 prescription ("remove 3 members") yields **TS2367** at `:18,23,25` plus a still-live import for `"Encerrada"` | Replace `:1-29` with the 7-line body in §3. `Status` becomes inline `"Ativa" \| "Inativa"`. Do **before** §2.3. Zero JSX churn in the 6 screens (all 10 call sites pass `recordStatusLabel`, `adult-portal-helpers.ts:15`) |
| **E2** | `prisma/schema.prisma:97` | `capabilityAssignments CapabilityAssignment[]` | **P1012** from `prisma validate` — proven in §4. Delete alongside `model CapabilityAssignment` (`:245-259`) |
| E3 | `src/proxy.ts:113` | `request.nextUrl.pathname.startsWith("/atividade/") \|\|` | Not a break — permanently false once `(public-play)/atividade/` is gone. Keep `:114-115` (`/jogar` no-referrer is load-bearing for `?cred=`) | Delete **line 113 only**; rewrite the `:108-111` comment to refer to player entry links. Do **after** §2.2 (deleting it first is also safe — the branch is inert) |
| E4 | `src/server/http/errors.ts:11` + `contracts/schemas/api-error.v1.schema.json:21` | `"RATE_LIMITED"` | Plan §2.5.4. Not a break (0 surviving users; sole user `atividades/actions.ts:181` is deleted). No test asserts parity between the two lists | Delete both entries. Optionally extend to `errors.ts:14-21` / schema `:24-31` per §4.3 |
| E5 | `src/runtime/mode.ts:13-17` | `export function isDemoRuntime(...)` | Becomes 0-user **as a side effect of §2.2/§2.3**; `tests/unit/runtime-mode.test.ts` does not cover it | Delete after §2.2/§2.3 (not before — `portal-view-service.ts:4` and 4 deleted pages import it) |
| E6 | `src/server/auth/dev-bypass-gateway.ts:9` | `export const DEV_BYPASS_ACTOR: PortalActor = {` | Its only external consumer (`portal-view-service.ts:1`) is deleted; still used at `:17` | Drop the `export` keyword only. **Do not delete the file** — `src/server/auth/gateway.ts:1` imports `DevBypassAuthGateway`, used at `gateway.ts:42` |
| E7 | `tests/unit/auth.test.ts:146,147,154` | `isProtectedPathname("/portal/atividades")` / `("…/nova")` / `("/atividade/token/jogar")` | **Not a break** — `isProtectedPathname` (`src/server/auth/gateway.ts:50`) is a generic prefix predicate, so all three keep passing. They are stale fixtures naming purged routes | Re-point to surviving routes, e.g. `"/portal/turmas"`, `"/portal/turmas/nova"`, `"/jogar/"`. Edit-only; do not delete the `describe` blocks |
| E8 | `src/app/(professional)/portal/ajuda/page.tsx:7-24` | `topics` array (4 entries) | Nothing (see O1). Copy only | Day-4 pass: rewrite topics 1/3/4 to the credential/session vocabulary; keep `:34-45` markup so `moduleGrid`/`moduleCard`/`moduleArt`/`textLink` stay alive |
| E9 | `REFACTOR_PLAN.md:8,30,37-43,56,63,77-86,88,210,219` | v2.1 numbers and §2.1.1/§2.1.3/§2.5 text | The plan is the executor's only spec; wrong line targets (`proxy.ts:109-116`), wrong totals (auditoria 95→73, 7,729→7,802, 29%→23%), missing §2.5 item, and stale Day-0 premise will each cost time | Patch per §3, §4.2, §4.5, §0 |
| — | *no other surviving file needs an edit* | | Exhaustive 40-identifier grep over all 159 survivors returned only E1, E7, `src/app/layout.tsx:12` (metadata prose, leave) | |

---

## 7. Route-tree reachability after the purge

| Route | Before §2 | After §2 | Who points at it today |
| :--- | :--- | :--- | :--- |
| `/portal/admin` | **already 404** — `src/app/(professional)/portal/admin/` contains only `auditoria/`, `equipe/`, `jogos/`, `modulos/`, `organizacoes/`; **no `page.tsx`** | unchanged 404 | Nobody. Not in `service.ts:140-195` nor `portal-navigation.tsx:60-125`. Residual `.adminNavGroup` CSS in `portal.module.css` has 0 `styles.` consumers (leftover from an older admin nav) |
| `/portal/modulos`, `/portal/modulos/[id]` | bare `redirect("/portal")` stubs (`modulos/page.tsx:6`, `modulos/[id]/page.tsx:15`) | 404 → `src/app/not-found.tsx` | **Zero** string references repo-wide (`grep "/portal/modulos"` → 0 hits in `src`, `tests`, `scripts`) |
| `/portal/admin/jogos`, `/portal/admin/modulos` | `redirect("/portal")` stubs (`:6` each) | 404 | **Zero** references repo-wide (`grep -E "admin/(jogos\|modulos\|auditoria)"` → 0 hits outside the stubs themselves) |
| `/portal/admin/auditoria` | renders `auditEvents` fixture (`:54`), empty in server mode (`portal-view-service.ts:416`) | 404 | **No nav entry, no `href`, no `Link`** — confirmed unreachable today. B4's "the page is already unreachable" is **CONFIRMED** |
| `/atividade/[token]` (+`/[state]`, `/jogar`, `/jogar/[state]`) | 4 demo-mode prerendered page classes over hardcoded tokens `["7FQ-29M","2KF-81P","habitos-saudaveis","turma-5b"]` (`atividade/[token]/page.tsx:12`, `[state]/page.tsx:49`, `jogar/page.tsx:12`, `jogar/[state]/page.tsx:42`); `generateStaticParams` returns `[]` in server mode | 404 for every previously published URL | Only inside the deleted set (`atividade/[token]/jogar/page.tsx:112`, `page.tsx:41`, `[state]/page.tsx:72`, `jogar/[state]/page.tsx:62`) + the 3 share URLs `atividades/[id]/compartilhar/page.tsx:32`, `activity-builder.tsx:116`, `activity-controls.tsx:44`. **Plus the live site**: `out/atividade/` exists and `.github/workflows/deploy.yml` publishes to Pages |
| `/portal/atividades/**`, `/portal/materiais/**` | 12 pages | 404 | Route literals confined to the deleted trees (§2 proves this) |
| `/jogar`, `/entrar`, `/portal`, `/portal/turmas/**`, `/portal/resultados/**`, `/portal/admin/{equipe,organizacoes,organizacoes/[id]}`, `/portal/ajuda`, `/portal/sem-acesso`, `/portal/sessao-expirada`, `/api/v1/player/*` | live | **unchanged and live** | Nav: `application/adult-portal/service.ts:140-195` (server) and `portal-navigation.tsx:60-125` (demo) — **both tables already contain zero Generation A entries**. Shell links: `portal-shell.tsx:22` (`/portal`), `:61` (`/entrar`), `:91` (`/portal/ajuda`). Surviving `redirect()` targets: `entrar/actions.ts:21,25,29,34,37`, `portal/layout.tsx:28`, `sign-out-action.ts:12`, and three `redirect("/portal/sem-acesso")` (`admin/organizacoes/[id]/page.tsx:29`, `resultados/[classGroupId]/page.tsx:28`, `…/players/[playerSlotId]/page.tsx:28`, `turmas/[id]/page.tsx:31`) — **no surviving redirect points into the deletion set** |

`(public-play)` route group does **not** become empty: `jogar/{page,layout,actions}` survive, and `public-shell.tsx` stays reachable through `jogar/layout.tsx:4`. `(professional)` keeps 15 route files.

---

## 8. Shared-code coupling: trim vs. delete (nothing here may be deleted)

| Module | Used by surviving code | Used by deleted code | Action |
| :--- | :--- | :--- | :--- |
| `src/server/http/errors.ts` | `HttpError`/`errorResponse` across API routes and `src/server/http/{route,game-event-route,game-state-route}.ts`; `ApiErrorCode`/`apiErrorCodes` used in-file at `:27,37` | `atividades/actions.ts:9,179,181`, `access-link-service.ts` | **TRIM** `:11` (+ `:14-21` optionally). Never delete |
| `src/server/http/{correlation,read-limited-body,route}.ts` | proxy `:3-7`, API routes | — | Untouched |
| `src/server/db/client.ts`, `prisma-adult-portal-store.ts` (467), `prisma-player-access-store.ts`, `prisma-game-{state,event}-store.ts` | containers + `src/app/api/v1/**` | none | Untouched |
| `src/server/config/env.ts` | `entrar/actions.ts:5`, `gateway.ts:7,42`, `auth.test.ts:3,158-188` | `atividades/actions.ts:8` + 6 sites, `portal-view-service.ts:5,494` | Untouched; `isAuthDevBypassEnabled` keeps 2 surviving consumers → `AUTH_DEV_BYPASS` stays a supported flag |
| `src/server/auth/{gateway,dev-bypass-gateway,session,neon-gateway,neon-server,demo-gateway}.ts` | `portal/layout.tsx:8`, `entrar/actions.ts`, API routes, tests | `portal-view-service.ts:1` (`DEV_BYPASS_ACTOR`), `atividades/actions.ts:7` | **TRIM** `dev-bypass-gateway.ts:9` `export` keyword only (E6) |
| `src/server/security/{player-credential-tokens,launch-token}.ts` | `jogar/actions.ts:9,13`, `player-access-*`, `game-host-token` | none — they do **not** import `security/tokens.ts` | Untouched; `security/tokens.ts` deletes cleanly |
| `src/components/shared/icon.tsx` | all screens | 22 `IconName` members lose their last live consumer (e.g. `archive`, `book`, `copy`, `edit`, `external`, `link`, `paperclip`, `pause`, `play`, `search`, `shield`, `upload`, `chart`, `close`; plus `calendar`, `clock`, `grid`, `home`, `lock`, `menu`, `module`, `more`, `settings` which are already string-only) | **TRIM in §4.1**, not §2 — `IconName` (`icon.tsx:3-40`) is a closed union, so unused members are harmless and removing them is cosmetic. Do not delete the module |
| `src/components/portal/adult-portal-helpers.ts` | `portal-navigation.tsx:12-15`, `demo-role-controls`, `player-access-workflow`, `use-demo-portal`, `adult-portal-form`, `tests/unit/{demo-portal-helpers,portal-navigation}.test.ts` | none | Untouched. `recordStatusLabel` (`:15`) is what makes E1 safe |
| `src/components/portal/{page-header,portal-state}.tsx` | many surviving screens | auditoria/atividades/materiais pages | Untouched (`portal-state.tsx` shares `.stateCard/.stateIcon/.stateActions` with `src/app/error.tsx`, so those CSS classes survive) |
| `src/application/{adult-portal,player-access,game-state,game-events}/*`, `src/contracts/v1/*` | V1 stack + tests | none | Untouched. (`contracts/v1/schemas.ts` has several pre-existing unused exports — §4.3 territory, not §2) |
| `src/components/portal/portal.module.css` (4,910) | all surviving screens | all deleted screens | Survives; gains dead classes: `.auditTimeline:2355,2362` + `.auditEvent:2376,2386,2399,2400` (auditoria only), `.activityList:933`, `.builderLayout:1400`, `.panel` groups (`:1406,:1416`) — sole `styles.panel` user is `activity-builder.tsx`, `.qrCode:2196` + `.shareActions:2260,2760` (share-actions only), `.materialTable:2862`, `.srOnly:2841` (sole user `materials-explorer.tsx`), `.toast:2463,2482`, `.statusWarning`/`.statusDanger` (E1), `.newActivityShortcut:294,309` (**already dead**). `.toolbar` and `.detailPanel` **survive** via `class-detail-screen.tsx` / `organization-detail-screen.tsx` |
| `src/components/public/{public-shell,player-entry-screen,game-host,demo-game-adapter}.tsx`, `public.module.css` | `/jogar` tree | none (only `public-state.tsx`, deleted, leaves the group) | Untouched |
| `package.json` | `qrcode` still needed by `player-credential-print-sheet.tsx:4` | `share-actions.tsx:4` | **No dependency changes** |

---

## 9. Behavior deltas (user-visible)

| Delta | Intent | Evidence / note |
| :--- | :--- | :--- |
| 12 professional pages vanish: link list/detail/new/edit/share/conflict/results/empty + materials list/new/edit | **intended** (`REFACTOR_PLAN.md:37-38`) | `PRODUCT.md:113-119` genuinely defers Materials |
| `/portal/admin/auditoria` vanishes | **intended** (`:42`) | page was already unreferenced and server-mode-empty (§7, O3) |
| 6 legacy redirect stubs vanish (`/portal/modulos{,/[id]}`, `/portal/admin/{jogos,modulos}`) | intended (`:39-41`) | invisible — no inbound link |
| **All previously-published `/atividade/<token>` URLs hard-404** (`/atividade/<token>`, `/[state]`, `/jogar`, `/jogar/[state]`) | intended (`:43`) but **under-stated** | `output: "export"` (`next.config.ts:28`) makes a server redirect impossible; only `out/404.html` catches them. Physical QR cards printed from the old share sheet become dead. Consider keeping a single static `/atividade/[token]` shim page, or accept and announce it |
| Legacy **anonymous share-sheet QR** flow disappears (QR + copy + Web Share + `?activity_token` forward to GameMaker) | intended | `share-actions.tsx` (deleted), `compartilhar/page.tsx:32`, `activity-controls.tsx:44`. The **V1 credential QR flow is untouched** (`player-access-workflow.tsx` → `player-credential-print-sheet.tsx:22-24` → `/jogar?cred=`) |
| Activity lifecycle controls (open/pause/resume/enclose/revoke/rotate, expiry editor, conflict screen) | intended | `activity-controls.tsx`, `atividades/[id]/{editar,conflito}`, `atividades/actions.ts` |
| `RATE_LIMITED` errors become unrepresentable | intended (`:84`) | only producer was `atividades/actions.ts:181` |
| `StatusBadge` can no longer render 8 legacy statuses (compile-level, not runtime) | intended consequence of E1 | no surviving producer exists (§3(c)) |
| Test suite 284 → 182 cases (−35.9%) | intended (`:70-75`) | V1 authorization retains `tests/unit/v1-authorization.test.ts` |
| `isDemoRuntime` + `AUDIT_VIEW`/`LINK_*` capabilities | intended (§2.5.1-3) | no surviving consumer (§4.1) |
| **Nothing here looks accidental**, with one exception: `/entrar`'s "no-referrer" and `/jogar`'s Referrer-Policy are *adjacent* to §2.1.3's edit and **will be lost if the executor follows `REFACTOR_PLAN.md:32` literally** (deleting `:109-116`) | **ACCIDENTAL — must be prevented** | see §4.2 / E3 |

---

## 10. Safe execution order

Every step is independently verifiable; do not batch. Steps 1-3 must precede any deletion.

1. **Branch + guardrail.** Confirm `git status` clean, and do **not** merge the purge into `main`: `.github/workflows/deploy.yml` triggers on `push` to `main` and publishes Pages with no lint/typecheck/test (B7 in the synthesis).
   `git status --short` → expect only `?? docs/refactor-dossier/`
2. **Record the baseline.**
   `npx vitest run` → **33 files / 284 tests**; `npx prisma validate` → valid; `npm run typecheck` → capture error count (**UNVERIFIED here — not run**)
3. **E1 — prune `src/components/portal/status-badge.tsx`** to the §3 snippet (drop the `ActivityStatus` import, the 9-member union, and the `"Aberta"/"Rascunho"/"Pausada"/"Encerrada"/"Publicado"/"Arquivado"/"Convite pendente"` comparisons).
   `npm run typecheck` → **must still be green, and `grep -rn "portal-view-service" src/components` must return 0 hits.** This is the gate that makes the purge closed.
4. **E2 + §2.5 schema drops** in `prisma/schema.prisma`: `enum Capability` (`:18-27`), `Organization.scopedCapabilities` (`:79`), `Organization.accessLinks` (`:80`), **`OrganizationMembership.capabilityAssignments` (`:97`)**, `ProfessionalProfile.createdAccessLinks` (`:65`), `model CapabilityAssignment` (`:245-259`), `model AccessLink` (`:261-279`), `model RateLimitBucket` (`:300-310`).
   `npx prisma validate` → valid; then `npx prisma generate` → `src/generated/prisma/models/{AccessLink,CapabilityAssignment,RateLimitBucket}.ts` disappear
5. **Delete §2.4 tests** (6 files).
   `npx vitest run` → 27 files / 182 tests, all green
6. **Delete §2.3 leaves bottom-up** — order is not strictly required (closure is proven), but this keeps each intermediate commit compiling: `service-container.ts` → `prisma-capability-reader.ts`, `prisma-access-link-store.ts` → `authorization-service.ts`, `access-link-service.ts` → `audit-actions.ts`, `public-link-service.ts`, `link-status.ts`, `tokens.ts` → `portal-view-service.ts` → then the 8 components (`class-groups-explorer`, `activity-mark`, `activity-controls`, `activity-builder`, `share-actions`, `material-editor`, `materials-explorer`, `public-state`).
   `npm run typecheck` → green; `npx vitest run` → green
7. **Delete §2.2 route trees** (7 directories, 22 files).
   `npm run typecheck` → green; `npx vitest run` → green
8. **E4, E5, E6 trims** — `errors.ts:11` + `api-error.v1.schema.json:21` (and optionally `errors.ts:14-21` / schema `:24-31`), `mode.ts:13-17`, `dev-bypass-gateway.ts:9` `export`.
   `npm run typecheck && npx vitest run` → green
9. **E3 `proxy.ts`** — delete line `:113` only, reword `:108-111`.
   `npx vitest run tests/unit/proxy.test.ts` → 2 tests pass (that file asserts only CSP/correlation, `proxy.test.ts:11-24`, so it cannot catch a bad edit here — eyeball `:114-115`)
10. **E7** re-point `tests/unit/auth.test.ts:146,147,154`.
    `npx vitest run tests/unit/auth.test.ts` → 14 tests pass
11. **Migration.** `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_URL"` and eyeball it; then create `prisma/migrations/6_drop_generation_a/migration.sql`. Note the existing numbering starts at `0_init`, so `6_` is correct.
    `npx prisma validate` → valid. **Do not trust `prisma validate` as the drift gate** (B5) — add `migrate diff --exit-code` to §7's gates
12. **Both build targets.** `npm run build:server` then `npm run build:demo`. For demo, assert `out/atividade` no longer exists and `out/portal/atividades`, `out/portal/materiais`, `out/portal/admin/auditoria` are gone while `out/jogar`, `out/entrar`, `out/portal`, `out/portal/turmas` survive.
13. **Full check + docs.** `npm run check` (format:check + lint + typecheck + test, `package.json:24`), then E8/E9 + §4.4 documentation pass.

---

## 11. Evidence appendix

Line counts and file existence:
```bash
find "src/app/(professional)/portal/atividades" "src/app/(professional)/portal/materiais" \
     "src/app/(professional)/portal/modulos" "src/app/(professional)/portal/admin/jogos" \
     "src/app/(professional)/portal/admin/modulos" "src/app/(professional)/portal/admin/auditoria" \
     "src/app/(public-play)/atividade" -type f | xargs wc -l | sort -n
wc -l src/server/services/{portal-view-service,access-link-service,public-link-service,link-status,audit-actions,authorization-service,service-container}.ts \
      src/server/db/{prisma-access-link-store,prisma-capability-reader}.ts src/server/security/tokens.ts \
      src/components/portal/{activity-builder,activity-controls,activity-mark,material-editor,materials-explorer,class-groups-explorer,share-actions}.tsx \
      src/components/public/public-state.tsx
wc -l tests/unit/{access-link-service,authorization,access-link-tokens,link-status,portal-dev-bypass-actions,portal-dev-bypass}.test.ts
```

Reverse-import closure (full import graph incl. the 9 `@runtime/*` aliases, dynamic `import()`, relative specifiers; intersects with the 46-file set). The graph run printed exactly one surviving→deleted edge:
```
DANGLING survivors importing deleted (recheck) ===
src/components/portal/status-badge.tsx --> src/server/services/portal-view-service.ts
```
and, for newly-unreachable survivors, `src/app/(professional)/entrar/recuperar/actions.ts`, `src/components/portal/demo-action-button.tsx`, `src/server/http/base-url.ts` (all pre-existing dead — see §4.3) plus 6 `@runtime`-aliased demo variants (`src/runtime/adult-portal-demo*.ts`, `demo-auth-actions.ts`, `game-events-demo.ts`, `player-access-demo.ts`) that are **false positives**: `tsconfig.json:24-42` maps those aliases to the *server* variants while `next.config.ts:44-79` swaps in the demo variants at build time, so they are live under `APP_RUNTIME_MODE=demo`.

Exhaustive dangling-reference grep over the 159 surviving files:
```bash
find src tests -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \) -not -path 'src/generated/*' \
  | grep -v <each of the 46 deleted paths> > /tmp/surv.txt          # 159 files
tr -d '\r' < /tmp/surv.txt | xargs grep -nE "atividades|auditoria|materiais|/modulos|accessLink|AccessLink|link-status|LinkStatus|audit-actions|public-link|portal-view|activity-builder|activity-controls|activity-mark|material-editor|materials-explorer|class-groups-explorer|share-actions|public-state|security/tokens|service-container|authorization-service|prisma-capability|prisma-access-link|getAuthorizationService|getAccessLinkService|resolveLinkStatus|resolvePublicLink|ShareActions|MaterialEditor|MaterialsExplorer|ActivityControls|AccessLinkBuilder|PublicState|generateAccessLinkToken|hashToken|isValidAccessTokenFormat|ACCESS_LINK_TOKEN_LENGTH|listAccessLinks|listMaterials|auditEvents|Capability"
# -> src/app/layout.tsx:12 ; src/components/portal/status-badge.tsx:1,14 ; tests/unit/auth.test.ts:146,147
```

Route strings and redirects:
```bash
grep -rn --include='*.ts' --include='*.tsx' "/portal/atividades\|/portal/materiais\|/portal/modulos\|admin/\(jogos\|modulos\|auditoria\)\|/atividade/" src tests scripts
grep -rn "redirect(\|revalidatePath(\|NEXT_REDIRECT" src --include='*.ts' --include='*.tsx' | grep -v generated
grep -rn "generateStaticParams" src --include='*.tsx'
grep -rn "href=" src/components/portal/{portal-shell,portal-navigation,overview-screen}.tsx src/application/adult-portal/service.ts
```

AuditEvent writer sweep:
```bash
grep -rni --include='*.ts' --include='*.tsx' "auditevent" src | grep -v '^src/generated/'
# -> admin/auditoria/page.tsx:4,54 ; prisma-access-link-store.ts:9,325,326 ; access-link-service.ts:40,113 ; portal-view-service.ts:373,416
```

§2.1.1 verification:
```bash
grep -rn "ActivityStatus" src ; grep -rn "StatusBadge" src tests ; sed -n '15,17p' src/components/portal/adult-portal-helpers.ts
```

Shared-export liveness:
```bash
for n in isDemoRuntime getGameClientUrl createGameLaunchUrl getPublicBaseUrl DemoActionButton DEV_BYPASS_ACTOR validateRuntimeEnv requestPasswordResetAction; do
  printf "%-26s %s\n" "$n" "$(grep -rn "$n" src tests --include='*.ts' --include='*.tsx' | grep -v '^src/generated/' | wc -l)"; done
```

CSS coupling:
```bash
grep -rn "composes" src --include='*.css'            # -> 0 hits
for c in toast srOnly shareActions qrCode activityList auditTimeline materialTable builderLayout panel newActivityShortcut statusWarning statusDanger; do
  printf "%-20s -> " "$c"; grep -rl "styles\.$c\b" src; echo; done
```

§2.5 failure reproduction (scratch copy outside the repo — no project file touched):
```bash
sed -e '/^model AccessLink {/,/^}/d' -e '/^model CapabilityAssignment {/,/^}/d' \
    -e '/^model RateLimitBucket {/,/^}/d' -e '/^enum Capability {/,/^}/d' \
    -e '/^  createdAccessLinks AccessLink/d' -e '/^  accessLinks        AccessLink\[\]/d' \
    -e '/^  scopedCapabilities CapabilityAssignment\[\]/d' prisma/schema.prisma > /tmp/pv/schema.prisma
npx prisma validate --schema /tmp/pv/schema.prisma      # -> P1012 on the capabilityAssignments line
sed -i '/^  capabilityAssignments CapabilityAssignment\[\]/d' /tmp/pv/schema.prisma
npx prisma validate --schema /tmp/pv/schema.prisma      # -> valid
```

Gates run in this investigation: `npx prisma validate` (valid), `npx vitest run` (33 files / 284 tests passed), `git status --short`, `git ls-files prisma/migrations`. `npm run typecheck` deliberately **not** run (would rewrite the gitignored `tsconfig.tsbuildinfo`); everything asserted about typecheck outcomes is type-level reasoning from `tsconfig.json:8 "strict": true` and is labelled as such.
