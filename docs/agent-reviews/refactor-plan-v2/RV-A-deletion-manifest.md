# RV-A — Adversarial Review of `REFACTOR_PLAN.md` v2.0, Section 2 "The Deletion Manifest"

| | |
| :-- | :-- |
| **Reviewer scope** | §2.1 pre-requisite relocations, §2.2 route trees, §2.3 services/stores/fixtures/components, §2.4 tests, §2.5 database schema, plus the "Total Impact ~6,450 lines" claim |
| **Method** | Read-only: `wc -l`, `find`, `grep`, `git cat-file`/`git show HEAD:<path>`. No file was written, edited, formatted, migrated, installed or built. |
| **Measurement date** | 23 September 2026 |
| **Working tree state at measurement** | DIRTY — 30 tracked modifications + 23 untracked paths (`git status --short`, excluding `-uall`). See §0 for why this matters. |
| **Baseline for comparison** | `docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md` (the "post multi-agent adversarial audit" the plan header cites) |

---

## Findings tally

| Verdict | Count | | Severity | Count |
| :-- | --: | :-- | :-- | --: |
| CONFIRMED | 24 | | BLOCKER | 2 |
| PARTIAL | 9 | | MAJOR | 5 |
| WRONG | 5 | | MINOR | 9 |
| UNSUPPORTED | 2 | | | |
| **Total findings** | **40** | | **Total** | **16** |

**The 3 worst defects**

1. **B1 — `tests/unit/authorization.test.ts` is a surviving test for a deleted service.** It imports `AuthorizationService` from `src/server/services/authorization-service.ts`, which §2.3 schedules for deletion. It is not in §2.4. `npm test` fails at collection on Day 1, violating Success Criterion 3.
2. **B2 — §2.1 item 3 ("Clean Container Imports") lists 2 of the 4 Generation-A symbols in `service-container.ts`.** `PrismaCapabilityReader` (line 1) and `AuthorizationService` (line 4) are also imported there and both target files are in §2.3. Worse: the file's *entire* public surface (`getAuthorizationService`, `getAccessLinkService`) is Generation A and its only importers are deleted files, so the correct action is deletion, not "clean imports".
3. **M1 — §2.1 item 1's causal claim is false.** No surviving screen breaks if `ActivityStatus` is deleted; `recordStatusLabel()` returns `"Ativa" | "Inativa"`. The relocation is unnecessary and would permanently graft a dead Generation-A union onto the V1 domain model.

---

## 0. Measurement provenance (dirty-tree control)

Before attributing any mismatch to the plan, each §2.3 file's working-tree line count was compared against its committed `HEAD` version:

```
HEAD   256  WORK   256  src/components/portal/activity-builder.tsx
HEAD   156  WORK   156  src/components/portal/activity-controls.tsx
HEAD   266  WORK   266  src/components/portal/material-editor.tsx
HEAD   132  WORK   132  src/components/portal/materials-explorer.tsx
HEAD   237  WORK   237  src/components/portal/class-groups-explorer.tsx
HEAD   147  WORK   147  src/components/portal/share-actions.tsx
HEAD    27  WORK    27  src/components/portal/activity-mark.tsx
HEAD    36  WORK    36  src/components/public/public-state.tsx
HEAD   521  WORK   521  src/server/services/portal-view-service.ts
HEAD   717  WORK   717  src/server/services/access-link-service.ts
```

**Conclusion: none of the §2.2/§2.3/§2.4 files are touched by the current 30-modification dirty tree.** Every number in Section 2 is reproducible from a clean `HEAD` checkout, so every mismatch below is a defect in the plan, not a moving-target artifact. (By contrast §4's `portal.module.css` 4,910 *is* affected — `src/components/portal/portal.module.css` is modified — but that is outside this review's scope.)

---

## 1. §2.1 Pre-requisite Relocations

### 1.1 "Move `type ActivityStatus` from `src/server/services/portal-view-service.ts` …"

> *"Relocate `ActivityStatus`: Move `type ActivityStatus` from `src/server/services/portal-view-service.ts` to `src/application/adult-portal/types.ts` (or generalize to `type EntityStatus`) …"*

**Verdict: CONFIRMED (factual premise) — but see 1.3 for the causal claim.**

- Declared at `src/server/services/portal-view-service.ts:9`:
  `export type ActivityStatus = "Aberta" | "Rascunho" | "Pausada" | "Encerrada";`
  This is the **only** declaration site in the repo (`grep -rn "ActivityStatus" src tests` → 9 hits, 3 of them the declaration/internal use).

### 1.2 "…`src/components/portal/status-badge.tsx` …"

**Verdict: CONFIRMED.** `src/components/portal/status-badge.tsx:1` is `import type { ActivityStatus } from "@/server/services/portal-view-service";`, consumed at line 6 inside the local `Status` union. The file is 32 lines.

### 1.3 "…and its 6 active importing screens … do not break" — MUST HAPPEN BEFORE PURGE

> *"so `src/components/portal/status-badge.tsx` and its 6 active importing screens (`class-detail-screen`, `classes-screen`, `organization-detail-screen`, `organizations-screen`, `overview-screen`, `team-screen`) do not break"*

**Verdict: PARTIAL.** Two sub-claims, one true, one false.

**(a) The screen roster is exactly right — CONFIRMED.** `grep -rn "status-badge" src tests` → **13** import sites:

| Status | Importer |
| :-- | :-- |
| deleted by §2.2 | `src/app/(professional)/portal/atividades/page.tsx:6`, `atividades/[id]/page.tsx:6`, `atividades/[id]/resultados/page.tsx:5` |
| deleted by §2.3 | `activity-controls.tsx:6`, `class-groups-explorer.tsx:9`, `material-editor.tsx:12`, `materials-explorer.tsx:9` |
| **kept (7 = the plan's 6 + 1?)** | `class-detail-screen.tsx:21`, `classes-screen.tsx:24`, `organization-detail-screen.tsx:23`, `organizations-screen.tsx:27`, `overview-screen.tsx:20`, `team-screen.tsx:29` |

Exactly 6 survivors, and they are the 6 the plan names. Note `results-screen.tsx` (untracked, new) does **not** import `StatusBadge`, so the roster stays at 6 after the pending work lands.

**(b) "Do not break" / "must happen BEFORE purge" — WRONG.** None of the 6 surviving screens imports `ActivityStatus`; they import only `StatusBadge`, and every single call site passes `recordStatusLabel(...)`:

```
class-detail-screen.tsx:67,143   classes-screen.tsx:147
organization-detail-screen.tsx:134,181,225   organizations-screen.tsx:157
overview-screen.tsx:174,220      team-screen.tsx:341
```

`src/components/portal/adult-portal-helpers.ts:15`:
`export function recordStatusLabel(status: RecordStatus): "Ativa" | "Inativa" {`

So the only values any survivor can pass are `"Ativa" | "Inativa"` — both already spelled out literally in `status-badge.tsx:9,11`, independent of `ActivityStatus`. Deleting `src/server/services/portal-view-service.ts` requires a **two-line edit inside `status-badge.tsx`** (drop line 1 and line 6); the 6 screens are untouched and still typecheck. A repo-wide grep for the four `ActivityStatus` members confirms no surviving producer exists:

- `"Aberta"` → only `atividades/page.tsx:14` (deleted), `activity-controls.tsx` (deleted), `link-status.ts` (deleted), `portal-view-service.ts` (deleted).
- `"Rascunho"`, `"Pausada"`, `"Encerrada"` → same deleted set only.
- `"Convite pendente"` → only `portal-view-service.ts:174` (deleted).
- `"Lançamentos bloqueados"`, `"Novas atividades bloqueadas"` → **`status-badge.tsx` only, already dead today** (zero producers anywhere in `src` or `tests`).

**Severity: MAJOR.** The plan elevates a 2-line edit into a "must happen BEFORE purge" architectural relocation with a designated target module, and Day 1 of §6 sequences it as a gate. It also mis-states the risk model: the plan implies the purge is unsafe without the relocation, when in fact the relocation is the *unsafe* option (see 1.4).

### 1.4 "`src/application/adult-portal/types.ts`" as relocation target

**Verdict: PARTIAL — mechanically valid, architecturally wrong.**

- The target exists: `src/application/adult-portal/types.ts`, 116 lines. It is a legal host for a client-safe type: its only import is `import type { OrganizationRole, PlatformRole, RecordStatus } from "@/generated/prisma/enums"` (line 1-5), so no `server-only` leakage into `status-badge.tsx`.
- However `ActivityStatus`'s four members are pure Generation-A link vocabulary ("Aberta/Rascunho/Pausada/Encerrada", produced by `link-status.ts`, which is itself deleted). Housing it in the **V1 adult-portal DTO module** creates a permanent dependency from the surviving clean-architecture layer to dead CMS semantics — the exact coupling this purge exists to remove. `src/application/adult-portal/types.ts` currently carries only `RecordStatus`-based DTOs; `ActivityStatus` would be the sole anachronism in it.
- The plan's fallback, "or generalize to `type EntityStatus`", is worse: generalizing a type with zero surviving consumers is speculative generality, and it would silently widen `StatusBadge`'s prop union to accept strings no survivor can produce, weakening the type check at all 6 call sites.

**Severity: MAJOR.** Recommended replacement: delete `ActivityStatus` outright and prune lines 1/6 of `status-badge.tsx` (plus the pre-existing dead members `"Convite pendente"`, `"Lançamentos bloqueados"`, `"Novas atividades bloqueadas"`). No relocation, no ordering constraint, no new symbol in `application/`.

### 1.5 "Repoint Auditoria Screen … to read from the real `AuditEvent` table, or remove the page"

> *"Repoint `src/app/(professional)/portal/admin/auditoria/page.tsx` to read from the real `AuditEvent` table, or remove the page if administrative audit is deferred."*

**Verdict: CONFIRMED that the page exists and reads mock/legacy data; UNSUPPORTED that option A is meaningful.**

- Path exists: `src/app/(professional)/portal/admin/auditoria/page.tsx`, **73 lines** (unlisted in §2.2/§2.3 — treated as a survivor).
- It does read Generation-A fixtures: line 4 `import { auditEvents } from "@/server/services/portal-view-service";`, rendered at line 54 `{auditEvents.map((event) => (`.
- The fixture is `src/server/services/portal-view-service.ts:416`: `export const auditEvents = demoRuntime ? demoAuditEvents : [];` (demo data declared at `:373`). **In server mode `auditEvents` is the empty array** — so this page already renders a blank timeline in production. That independently confirms §2.3's Reason for `portal-view-service.ts` ("In server mode, causes pages to render empty or 404").
- `model AuditEvent` is genuinely available: `prisma/schema.prisma:281` → `@@map("audit_events")`, with inverse relation `ProfessionalProfile.auditEvents AuditEvent[] @relation("AuditActor")` (`schema.prisma:66`) and indexes on `(entityType, entityId, occurredAt)`, `(actorId, occurredAt)`, `(occurredAt)`. Migration `prisma/migrations/0_init/migration.sql` creates it.
- **But the table will be permanently empty after the purge.** `grep -rn "auditEvent" src tests` (excluding `src/generated/`) shows the **only** writer in the entire codebase is `src/server/db/prisma-access-link-store.ts:325-326` (`async recordAudit(...) { await this.client.auditEvent.create(...) }`) — a file §2.3 deletes. The `AuditEventInput` type it consumes lives at `src/server/services/access-link-service.ts:40` — also deleted. `src/application/**` and `src/runtime/**` write zero audit rows.

**Severity: MAJOR.** Option A ("repoint to the real `AuditEvent` table") is not a prerequisite — it is an unbudgeted feature (an audit sink plus call sites in the surviving V1 services, which currently log nothing). The plan presents both options as equivalent one-liners. In practice only option B ("remove the page") is executable inside Day 1. Also unmentioned: `Capability.AUDIT_VIEW` (`schema.prisma:24`) and the `.auditTimeline` / `.auditEvent` rules in `portal.module.css` become orphans with the page.

### 1.6 "Remove `PrismaAccessLinkStore` and `AccessLinkService` imports from `src/server/services/service-container.ts`"

**Verdict: PARTIAL — both named symbols are real, but the list is half-complete and the prescription is wrong.**

`src/server/services/service-container.ts` exists, **45 lines**. Confirmed present:
- `:2` `import { PrismaAccessLinkStore } from "@/server/db/prisma-access-link-store";`
- `:3` `import { AccessLinkService } from "@/server/services/access-link-service";`

**Two more Generation-A imports are NOT named, and both point at files §2.3 deletes:**
- `:1` `import { PrismaCapabilityReader } from "@/server/db/prisma-capability-reader";` → `src/server/db/prisma-capability-reader.ts` (**§2.3 delete, 55 lines**)
- `:4` `import { AuthorizationService } from "@/server/services/authorization-service";` → `src/server/services/authorization-service.ts` (**§2.3 delete, 244 lines**)

Both are live in the file body: `:19` `new AuthorizationService(new PrismaCapabilityReader())` and `:36` `authorization: getAuthorizationService()`. Removing only lines 2-3 (the plan's literal instruction) leaves 4 unresolved `TS2307` errors and a file whose two exports are `getAuthorizationService` and `getAccessLinkService` — i.e. **nothing in the container survives the purge.**

**Severity: BLOCKER.** The whole file is Generation A. Its only importers are:

```
src/app/(professional)/portal/atividades/actions.ts   (7 dynamic `await import(...)`: lines 121,261,333,377,418,458,493)  → deleted §2.2
tests/unit/portal-dev-bypass-actions.test.ts:27 (vi.mock)                                                            → deleted §2.4
```

Verified via `grep -rn "service-container" src tests scripts` → **8 hits total, all inside the deleted set.** Therefore `src/server/services/service-container.ts` is itself dead and must be **added to the §2.3 delete list (45 lines)**, not "cleaned". Note the repo already models the correct pattern: `adult-portal-container.ts` (18 lines), `player-access-container.ts` (22), `game-state-container.ts` (12), `game-event-container.ts` (47) are four separate V1 containers, none of which reference anything in the delete set.

---

## 2. §2.2 Route Trees to Delete

### 2.1 Existence — CONFIRMED, zero phantom entries

All 6 directories exist. File inventories (`find <dir> -type f`):

| Directory | Files | Measured `wc -l` sum | Plan claims | Verdict |
| :-- | --: | --: | --: | :-- |
| `src/app/(professional)/portal/atividades/` | 9 | **1,188** | 1,188 | CONFIRMED |
| `src/app/(professional)/portal/materiais/` | 3 | **92** | 92 | CONFIRMED |
| `src/app/(professional)/portal/modulos/` | 2 | **23** | 23 | CONFIRMED |
| `src/app/(professional)/portal/admin/jogos/` | 1 | **7** | 7 | CONFIRMED |
| `src/app/(professional)/portal/admin/modulos/` | 1 | **7** | 7 | CONFIRMED |
| `src/app/(public-play)/atividade/[token]/` | 5 | **364** | 364 | CONFIRMED |
| **Subtotal §2.2** | **21** | **1,681** | **1,681** | CONFIRMED |

§2.2 is the only table in Section 2 that is 100% exact.

### 2.2 "Includes a 517-line action file" — CONFIRMED

`src/app/(professional)/portal/atividades/actions.ts` = **517 lines**. It is the single largest item in §2.2 (44% of the tree) and is *not* given its own manifest row; it is also the reason §1.6's container is reachable at all (7 dynamic `await import()` call sites at `:121,261,333,377,418,458,493`).

### 2.3 "Obsolete redirect stubs" — CONFIRMED

All four stub pages do nothing but `redirect("/portal")`:
- `modulos/page.tsx` (7), `modulos/[id]/page.tsx` (16, plus `generateStaticParams` hardcoding `habitos-saudaveis`), `admin/jogos/page.tsx` (7), `admin/modulos/page.tsx` (7). No service imports, no fixture imports.

### 2.4 "Replaced by `/portal/turmas`" / "Replaced by `/jogar` + QR bearer credentials" — CONFIRMED

- `src/app/(professional)/portal/turmas/page.tsx` (17) and `turmas/[id]/page.tsx` (42) exist and are reached through live navigation.
- `src/app/(public-play)/jogar/page.tsx` (20), `jogar/layout.tsx` (18), `jogar/actions.ts` (45) exist; `jogar/page.tsx:1` imports `PlayerEntryScreen` (`src/components/public/player-entry-screen.tsx`, 192 lines), which is rendered nowhere else.
- `src/components/portal/class-groups-explorer.tsx` — the component §2.3 calls the redundant predecessor of `/portal/turmas` — has **zero importers repo-wide** (see 3.4), so the replacement is already complete.
- Navigation is clean: `grep -n "href" src/components/portal/portal-navigation.tsx` yields only `/portal`, `/portal/admin/organizacoes`, `/portal/admin/equipe`, `/portal/turmas`, `/portal/resultados`. `grep -rn "atividades\|materiais\|modulos\|auditoria\|jogos"` against `src/application/adult-portal/service.ts`, `src/runtime/adult-portal-demo-store.ts`, `src/runtime/adult-portal-demo.ts` → **no matches**. No dead nav links are created by the purge.

### 2.5 "Materials/CMS is explicitly deferred beyond V1 (`PRODUCT.md:115-119`)" — CONFIRMED (citation is 5 lines wide)

`PRODUCT.md` under `## Materials` reads: "Materials/content management is not part of V1." / "The Materials area should be removed or hidden from the production V1 navigation and must not be a dependency of the portal-to-game workflow." / "Material authoring, approval, publishing, attachments, and related CMS behavior are deferred to a later product version." (the three prose lines sit at 116, 118, 120; the cited range 115-119 captures the substance).

### 2.6 Manifest omissions inside §2.2's own deletion radius — MINOR (3 items)

Surviving files that hardcode references to the deleted trees. None breaks a build; all leave Generation-A residue in the V1 product.

1. `src/proxy.ts:113` — `request.nextUrl.pathname.startsWith("/atividade/") ||` still drives the `Referrer-Policy: no-referrer` branch whose comment (`:109-112`) explains it is for "Public activity links … forwarded to GameMaker via ?activity_token". After §2.2 this branch can never match; the surviving `/jogar` clauses cover the real V1 entry. Dead security-adjacent code plus a stale threat-model comment. **MINOR** (arguably MAJOR for a CSP/referrer file, but functionally inert).
2. `src/components/portal/adult-portal-helpers.ts:136` — `if (item.label === "Links de acesso") {` in `isPortalNavigationItemCurrent()`, a nav-highlight special case for the deleted `/portal/atividades` section. No nav item carries that label any more (`grep -rn "Links de acesso" src` → only this line, `ajuda/page.tsx:9`, and the deleted `atividades/page.tsx:10,20`). Covered by `tests/unit/demo-portal-helpers.test.ts`? **No** — `grep -rn "Links de acesso" tests` → 0 hits. So the branch is already untested dead code. **MINOR.**
3. `src/app/(professional)/portal/ajuda/page.tsx:7-24` — a **surviving** page whose 4 help topics are 3-for-4 Generation A: `"Links de acesso"`, `"Status e validade"` ("Pause, reabra, encerre ou defina a expiração de um acesso"), `"Acesso anônimo"` ("O jogo abre pelo link personalizado"). Only `"Resultados coletivos"` survives the purge. **MINOR.**
4. Also for the record: `tests/unit/auth.test.ts:146-147` asserts `isProtectedPathname("/portal/atividades")` and `("/portal/atividades/nova")`. Harmless — `src/server/auth/gateway.ts:48-55` is a pure `"/portal"` prefix test, so the assertions still pass — but the test now documents routes that do not exist. **MINOR.**

---

## 3. §2.3 Services, Stores & Mock Fixtures

### 3.1 Existence — CONFIRMED, zero phantom entries

All 17 paths exist. Measured against the plan's "Verified Lines":

| File | Plan | Measured | Δ | Verdict |
| :-- | --: | --: | --: | :-- |
| `src/server/services/portal-view-service.ts` | 521 | **521** | 0 | CONFIRMED |
| `src/server/services/access-link-service.ts` | 717 | **717** | 0 | CONFIRMED |
| `src/server/db/prisma-access-link-store.ts` | 352 | **352** | 0 | CONFIRMED |
| `src/server/services/public-link-service.ts` | 65 | **65** | 0 | CONFIRMED |
| `src/server/services/link-status.ts` | 38 | **38** | 0 | CONFIRMED |
| `src/server/services/audit-actions.ts` | 103 | **103** | 0 | CONFIRMED |
| `src/server/services/authorization-service.ts` | 244 | **244** | 0 | CONFIRMED |
| `src/server/db/prisma-capability-reader.ts` | 55 | **55** | 0 | CONFIRMED |
| `src/server/security/tokens.ts` | 61 | **61** | 0 | CONFIRMED |
| `src/components/portal/activity-builder.tsx` | 244 | **256** | **−12** | **WRONG** |
| `src/components/portal/activity-controls.tsx` | 147 | **156** | **−9** | **WRONG** |
| `src/components/portal/activity-mark.tsx` | 27 | **27** | 0 | CONFIRMED |
| `src/components/portal/material-editor.tsx` | 252 | **266** | **−14** | **WRONG** |
| `src/components/portal/materials-explorer.tsx` | 120 | **132** | **−12** | **WRONG** |
| `src/components/portal/class-groups-explorer.tsx` | 228 | **237** | **−9** | **WRONG** |
| `src/components/portal/share-actions.tsx` | 147 | **147** | 0 | CONFIRMED |
| `src/components/public/public-state.tsx` | 36 | **36** | 0 | CONFIRMED |
| **Subtotal §2.3** | **3,357** | **3,413** | **−56** | |

**Verdict on the 5 wrong rows: WRONG, MINOR severity, and the mechanism is now proven.** Four of the five claimed values are that same file's **non-blank** line count, not its physical line count:

```
phys= 256 nonblank= 244  activity-builder.tsx        (claimed 244)
phys= 156 nonblank= 147  activity-controls.tsx       (claimed 147)
phys= 266 nonblank= 252  material-editor.tsx         (claimed 252)
phys= 132 nonblank= 124  materials-explorer.tsx      (claimed 120 ← neither metric)
phys= 237 nonblank= 228  class-groups-explorer.tsx   (claimed 228)
```

The header column is literally labelled "Verified Lines" and every other row in §2.2/§2.3 is physical `wc -l`. The plan therefore **mixes two metrics inside a single table**, silently, and `materials-explorer.tsx`'s 120 matches neither. This is the same confusion the prior audit flagged for `portal.module.css` ("4,214 = non-blank lines") — the fix applied to that row was not propagated to the §2.3 component rows.

### 3.2 "zero consumers" claims — verified per module

Method: for each module, `grep -rn "<module>" src tests scripts contracts` (plus symbol-level greps for named exports and for relative `./tokens`-style imports), then intersect the hit list with the plan's delete set.

| §2.3 module | All importers (path:line) | Outside delete set? | Verdict |
| :-- | :-- | :-- | :-- |
| `portal-view-service.ts` | routes: `admin/auditoria/page.tsx:4`, `atividades/page.tsx:8`, `atividades/[id]/compartilhar:10`, `…/conflito:5`, `…/editar:8`, `…/[id]/page.tsx:11`, `…/resultados:11`, `materiais/page.tsx:8`, `materiais/[id]/editar:8`, `atividade/[token]/jogar/page.tsx:5`, `atividade/[token]/page.tsx:5`; components: `activity-controls:4`, `class-groups-explorer:6`, `material-editor:9`, `materials-explorer:6`, `status-badge:1`; test: `portal-dev-bypass.test.ts:8` | **2**: `status-badge.tsx:1` (kept), `admin/auditoria/page.tsx:4` (kept) | **CONFIRMED, conditional** — exactly the two couplings §2.1 (items 1 and 2) exists to handle. Every other consumer is deleted. |
| `access-link-service.ts` | `prisma-access-link-store:10`, `portal-view-service:2`, `public-link-service:8`, `service-container:3`, `tests/access-link-service.test.ts:17` | **1**: `service-container.ts:3` | **CONFIRMED** — *"zero consumers once legacy routes are removed"* holds **only because** §2.1 item 3 exists. But see §1.6: cleaning the container is insufficient; the container must die. |
| `prisma-access-link-store.ts` | `service-container:2` — and nothing else repo-wide | **1**: `service-container.ts:2` | **CONFIRMED** |
| `public-link-service.ts` | *"Unused link validator with zero callers"* — real callers: `tests/access-link-service.test.ts:18` (`resolvePublicLink`) only. One prose cross-reference at `link-status.ts:11`. | none | **CONFIRMED (exact)**. The only caller is a deleted test. |
| `link-status.ts` | `atividades/[id]/page.tsx:12`, `atividades/[id]/resultados:7`, `tests/link-status.test.ts:3` | none | **CONFIRMED** |
| `audit-actions.ts` | `access-link-service.ts:13` | none | **CONFIRMED** — single consumer, itself deleted. |
| `authorization-service.ts` | `prisma-capability-reader:7`, `access-link-service:14`, `service-container:4`, `tests/access-link-service.test.ts:11`, **`tests/authorization.test.ts:9`** | **2** | **WRONG / BLOCKER** — see 3.3. |
| `prisma-capability-reader.ts` | `service-container:1` | **1** — and §2.1 item 3 does **not** name it | **WRONG / BLOCKER** — see §1.6. |
| `security/tokens.ts` | `atividades/actions.ts:11`, `access-link-service:4`, `portal-view-service:3`, `public-link-service:3`, `tests/access-link-service.test.ts:6`, `tests/access-link-tokens.test.ts:10` | none | **CONFIRMED (exact)** — *"Token generators for dead access links"*. All 4 exports (`ACCESS_LINK_TOKEN_LENGTH:21`, `generateAccessLinkToken:39`, `hashToken:49`, `isValidAccessTokenFormat:59`) have zero consumers outside the delete set. Deliberately checked for relative imports that an alias-based grep would miss: `grep -rn "\./tokens" src tests` → **0 hits**; and the V1 token modules are independent (`src/server/security/launch-token.ts` 94 lines, `src/server/security/player-credential-tokens.ts` 25 lines import neither `tokens.ts` nor are imported by it). |
| `activity-builder.tsx` | `atividades/nova/page.tsx:1`, `atividades/[id]/editar:3` | none | **CONFIRMED** |
| `activity-controls.tsx` | `atividades/[id]/page.tsx:4` | none | **CONFIRMED** |
| `activity-mark.tsx` | `atividades/page.tsx:3` | none | **CONFIRMED** |
| `material-editor.tsx` | `materiais/novo/page.tsx:1`, `materiais/[id]/editar:3` | none | **CONFIRMED** |
| `materials-explorer.tsx` | `materiais/page.tsx:3` | none | **CONFIRMED** |
| `class-groups-explorer.tsx` | **ZERO importers anywhere** | none | **CONFIRMED (stronger than claimed)** — this file is *already* orphaned today, before any purge. `grep -rn "class-groups-explorer\|ClassGroupsExplorer" src tests scripts contracts` → only its own declaration line. Its "Redundant legacy explorer" reason is accurate; its 237 lines are already-reaped dead code. |
| `share-actions.tsx` | `atividades/[id]/compartilhar:5`, `activity-builder.tsx:8` | none | **CONFIRMED** |
| `public-state.tsx` | `atividade/[token]/jogar/[state]:1`, `atividade/[token]/layout:5`, `atividade/[token]/[state]:1` | none | **CONFIRMED** — *"exclusive to deleted `/atividade/[token]` tree"* is exactly right. Cross-check that the tree's *shell* is legitimately kept: `public-shell.tsx` is imported by `atividade/[token]/layout.tsx:4` **and** by the surviving `jogar/layout.tsx:4`, so it must not be deleted — and the plan correctly does not list it. |

**False-positive guard (files NOT in the manifest that a careless purge might sweep up):** `src/components/portal/portal-state.tsx` (28 lines) looks Generation-A by name but is imported by 12 files including 7 survivors (`sem-acesso`, `sessao-expirada`, `class-detail-screen`, `classes-screen`, `organization-detail-screen`, `organizations-screen`, `overview-screen`, `results-screen`, `team-screen`). Correctly absent from §2.3. Likewise `src/.../ajuda/page.tsx` and `page-header.tsx` are shared. No over-deletion risk found in §2.3.

### 3.3 BLOCKER B1 — a surviving test imports a deleted service

```
tests/unit/authorization.test.ts:3   import { Capability, RecordStatus } from "@/generated/prisma/enums";
tests/unit/authorization.test.ts:4   import { HttpError } from "@/server/http/errors";
tests/unit/authorization.test.ts:5-9 import {
                                       type CapabilityAssignmentRecord,
                                       type CapabilityReader,
                                       AuthorizationService,
                                     } from "@/server/services/authorization-service";
```

`tests/unit/authorization.test.ts` — **634 physical / 581 non-blank lines, 24 `it(` cases** across 3 `describe` blocks, with 66 `Capability.*` references and ~7 `service.canUse/resolveEffectiveScope/assertCanUse` assertion groups — is a unit test whose *entire subject* is the service §2.3 deletes. It is **not** listed in §2.4.

Impact: after Day 1's purge, `vitest run` fails to collect this file (`Failed to load … authorization-service`, and transitively `TS2307` under `npm run typecheck`). This breaks §6 Day 1's own exit gate and §7 Success Criterion 3 ("`npm run typecheck`, and `npm test` execute cleanly") and Criterion 1's "100% passing tests". It is the single most likely reason the purge stalls on Day 1.

Fix: add `tests/unit/authorization.test.ts` (634 physical / 581 non-blank lines, 24 tests) to §2.4. Note this materially changes §2.4's headline: the manifest currently deletes 78 tests in 1,956 physical lines; with this file it becomes **102 tests in 2,590 physical lines** — and the "dead code removed instantly" figure rises to 7,684 physical / **7,020 non-blank** lines (before §2.3's container addition, see §6.3).

**Severity: BLOCKER.** (Also relevant to §7 criterion 1, which the prior audit already flagged: `authorization.test.ts` is 634 lines and is one of the 9 files over 400 lines that §2/§4 never address. Deleting it *helps* that criterion.)

---

## 4. §2.4 Tests to Delete

### 4.1 Per-file test counts — ALL FIVE CONFIRMED, exact

Counting rule: `grep -cE '^\s*it\('`, `'^\s*test\('`, `'^\s*it\.each\('` per file.

| Test file | Plan | `it(` | `test(` | `it.each(` | `describe(` | Measured lines | Line claim check |
| :-- | --: | --: | --: | --: | --: | --: | :-- |
| `tests/unit/access-link-service.test.ts` | 56 | **56** | 0 | 0 | 9 | **1,625** | CONFIRMED — *"1,625 lines testing obsolete `AccessLinkService`"* is exact |
| `tests/unit/access-link-tokens.test.ts` | 13 | **13** | 0 | 0 | 3 | 114 | CONFIRMED |
| `tests/unit/link-status.test.ts` | 5 | **5** | 0 | 0 | 1 | 66 | CONFIRMED |
| `tests/unit/portal-dev-bypass-actions.test.ts` | 2 | **2** | 0 | 0 | 1 | 118 | CONFIRMED |
| `tests/unit/portal-dev-bypass.test.ts` | 2 | **2** | 0 | 0 | 1 | 33 | CONFIRMED |
| **Subtotal** | **78** | **78** | | | | **1,956** | |
| *(missing)* `tests/unit/authorization.test.ts` | — | **24** | 0 | 0 | 3 | **634** | **BLOCKER B1** |

§2.4 is the most accurate table in Section 2: 5/5 test counts and the one inline line figure are all exact. No phantom test file; no inflated count.

### 4.2 Per-file reasons

- `access-link-service.test.ts` → imports `access-link-service` (`:17`), `authorization-service` (`:11`), `public-link-service` (`:18`), `security/tokens` (`:6`). **CONFIRMED.**
- `access-link-tokens.test.ts` → imports `generateAccessLinkToken`, `hashToken`, `isValidAccessTokenFormat` from `@/server/security/tokens` (`:7-10`); its 3 `describe` blocks are literally `describe("generateAccessLinkToken")`, `describe("hashToken")`, `describe("isValidAccessTokenFormat")`. **CONFIRMED.**
- `link-status.test.ts` → `import { resolveLinkStatus } from "@/server/services/link-status"` (`:3`); 5 tests asserting the `"Aberta"/"Pausada"/"Encerrada"` mapping. **CONFIRMED** — *"enum mappings"* is accurate (`src/server/services/link-status.ts:6` `export type LinkStatus = "Aberta" | "Pausada" | "Encerrada"`).
- `portal-dev-bypass-actions.test.ts` → `:43` imports from `@/app/(professional)/portal/atividades/actions` and `:27-31` `vi.mock("@/server/services/service-container")`. **CONFIRMED.**
- `portal-dev-bypass.test.ts` → **PARTIAL / MINOR.** The reason reads *"Tests dev-bypass on deleted `listAccessLinks`"*. The file's actual subject is `getDevBypassAccessLink`: both `it(` blocks exercise it (`:12` `getDevBypassAccessLink("turma-5b")`, `:27` `getDevBypassAccessLink("missing-link")`), while `listAccessLinks()` appears once, incidentally, at `:28` as an assertion about fixture identity. The deletion decision is right; the stated justification names the secondary symbol.

### 4.3 Completeness sweep — other test files importing deleted modules

`grep -rln "authorization-service\|access-link-service\|portal-view-service\|prisma-access-link-store\|security/tokens\|link-status\|public-link-service\|audit-actions\|prisma-capability-reader\|service-container" tests` → exactly **6 files**:

```
tests/unit/access-link-service.test.ts        → listed in §2.4 ✓
tests/unit/access-link-tokens.test.ts         → listed in §2.4 ✓
tests/unit/link-status.test.ts                → listed in §2.4 ✓
tests/unit/portal-dev-bypass-actions.test.ts  → listed in §2.4 ✓
tests/unit/portal-dev-bypass.test.ts          → listed in §2.4 ✓
tests/unit/authorization.test.ts              → ✗✗ MISSING FROM §2.4  (BLOCKER B1)
```

Repo totals for context: **33** test files in `tests/` (all under `tests/unit/`), ≈234 test cases. §2.4 as written removes 5/33 files and 78/234 cases (33% of cases from 15% of files — a healthy sign: the dead code really is over-tested). With B1 fixed: 6/33 files, 102/234 cases.

Also verified *no* other test reaches into the deleted set indirectly: `tests/unit/adult-portal-service.test.ts`, `tests/unit/v1-authorization.test.ts` (which targets the surviving `src/server/authorization/v1-policy.ts`), `tests/unit/demo-portal-helpers.test.ts` and `tests/unit/auth.test.ts` import none of the 17 §2.3 modules.

---

## 5. §2.5 Database Schema Changes

`prisma/schema.prisma` — **310 lines**, 6 enums + 16 models.

### 5.1 Every cited path and line number — CONFIRMED

| Claim | Measured | Verdict |
| :-- | :-- | :-- |
| `ProfessionalProfile.createdAccessLinks AccessLink[] @relation("AccessLinkCreator")` (`:65`) | `schema.prisma:65` reads `  createdAccessLinks AccessLink[]             @relation("AccessLinkCreator")` — **exact line match, exact text match** (the plan's form drops the alignment padding only) | CONFIRMED |
| `Organization.accessLinks AccessLink[]` (`:80`) | `schema.prisma:80` reads `  accessLinks        AccessLink[]` — **exact line match** | CONFIRMED |
| `model AccessLink` | `schema.prisma:261-279`, `@@map("access_links")`, 19 lines incl. `tokenHash @unique @db.Char(64)` and two `onDelete: Restrict` FKs | CONFIRMED |
| "Remove the **two** inverse relation fields on surviving models" | Exactly two. `grep -rn "AccessLink\|accessLink" prisma/schema.prisma` → 5 hits: `:65`, `:80`, `:261` (model), `:274` (the `createdBy` back-relation *inside* `AccessLink`, deleted with the model), `:278` (`@@map`). No third inverse field exists. `model AuditEvent`'s `@relation("AuditActor")` is unrelated. | CONFIRMED — the "two" count is right, which is a non-trivial precision claim |
| `model RateLimitBucket` "(unreferenced in code…)" | `schema.prisma:300-309`, `@@map("rate_limit_buckets")`. `grep -rn "RateLimitBucket\|rate_limit_bucket\|rateLimitBucket" src tests scripts` (excluding `src/generated/`) → **0 hits**. | CONFIRMED (exact) |
| "read from the real `AuditEvent` table" (§2.1) | `model AuditEvent` at `schema.prisma:281-298`, `@@map("audit_events")`, table exists in `migrations/0_init`. Available in principle — see §1.5 for the zero-writer problem. | CONFIRMED with caveat |

### 5.2 MAJOR — the §2.5 deletion radius stops one model short: the whole Capability subsystem dies

`authorization-service.ts` (§2.3) and `prisma-capability-reader.ts` (§2.3) are the *only* code that touches the capability model, and their only remaining consumer is the test that §2.4 already should have deleted (B1). Measured after the purge:

- `model CapabilityAssignment` (`schema.prisma:245-259`) → **0 references**. `grep -rn "capabilityAssignment\|CapabilityAssignment" src tests` (excluding `src/generated/`) returns hits only in `prisma-capability-reader.ts:26,44`, `authorization-service.ts:13,26,202,225`, `access-link-service.test.ts:8,327,345` and `authorization.test.ts:6,25,45` — **all six files are in the delete set.**
- `enum Capability` (`schema.prisma:18-28`), all 6 members → test-only. `LINK_VIEW`/`LINK_MANAGE` appear **exclusively** in `atividades/actions.ts` (deleted), `access-link-service.ts` (deleted), `access-link-service.test.ts` (deleted), `authorization.test.ts (should be deleted)*. `USER_MANAGE`/`ORGANIZATION_MANAGE`/`RESULTS_VIEW_ORGANIZATION`/`AUDIT_VIEW` appear **only** in `authorization.test.ts`. Critically, the surviving V1 policy — `src/server/authorization/v1-policy.ts` (85 lines) — imports **only** `OrganizationRole`, `PlatformRole`, `RecordStatus` (`:1-5`); it never imports `Capability`.
- The `Capability`↔`Organization` scoped relation `Organization.scopedCapabilities CapabilityAssignment[] @relation("CapabilityScope")` (`schema.prisma:77`) is the same "inverse field on a surviving model" pattern §2.5 bothered to catch for `accessLinks`/`createdAccessLinks` — but is not addressed.

**Severity: MAJOR.** §2.5 is internally inconsistent: it correctly reasons that a model whose sole reader is being deleted must go, applies that logic to `AccessLink`, then stops and leaves the sibling `CapabilityAssignment`/`Capability` subsystem as schema-only residue. The V1 model uses roles (`OrganizationRole`/`PlatformRole` + `TeacherAssignment`), not capabilities, so keeping `capability_assignments` guarantees a future reader will think V1 has a capability layer.

### 5.3 MAJOR — no migration path; §2.5's Day-1 gate cannot detect the drift it creates

- `prisma/migrations/` holds 6 committed migrations: `0_init/migration.sql` (`CREATE TABLE "access_links"` at `:58`, `access_links_pkey` `:70`, unique index `:117`, two indexes `:120`/`:123`, **two `ADD CONSTRAINT … FOREIGN KEY` at `:150`/`:153`**, three `CHECK` constraints at `:163`/`:166`/`:169`), plus `1_add_paused_at/migration.sql:3` (`ALTER TABLE "access_links" ADD COLUMN "paused_at"`). Also `rate_limit_buckets` and `capability_assignments` DDL.
- `package.json` scripts (lines 10-27) contain **no `prisma migrate` / `db push` script at all** — only `"prisma:generate": "prisma generate"` and `"postinstall": "prisma generate"`.
- §6 Day 1's gate is: *"Update prisma/schema.prisma: drop AccessLink (and inverse relations) and RateLimitBucket"* → *"Run prisma validate and typecheck"*. `prisma validate` checks schema self-consistency only; it never compares against `migrations/`. **`prisma validate` and `npm run typecheck` will both pass on a schema whose migration history still creates the dropped tables.**

**Severity: MAJOR.** The plan's verification gate is structurally incapable of catching its only schema risk. Removing a model from `schema.prisma` without a forward migration leaves `access_links`, `rate_limit_buckets` (and `capability_assignments`) live in the database, and the next `prisma migrate dev` will synthesize them as *new* tables → migration drift / `P3005`-class failures on the shared Neon branch, plus a `DROP TABLE access_links` that must be authored to drop the two `RESTRICT` FKs in the right order. `DROP TABLE` on `access_links` also has to respect the `organizations`/`professional_profiles` FK direction. None of this is written down.

### 5.4 MINOR — `src/generated/prisma` goes stale mid-Day-1 and `typecheck` will report it

23 surviving import sites pull from `src/generated/prisma/enums` (the plan asserts 42 in §3.2; not re-counted here — out of scope). The generated client does contain the deleted model: `src/generated/prisma/browser.ts:86-89` and `src/generated/prisma/client.ts:110-113` export `type AccessLink = Prisma.AccessLinkModel`, and `src/generated/prisma/internal/class.ts:23` embeds the entire previous schema as `inlineSchema`. Dropping `model AccessLink` from `schema.prisma` and running only `prisma validate` (no `prisma generate`) leaves a generated client that still declares `prisma.accessLink` and `Capability.LINK_VIEW`. Conversely, running `prisma generate` invalidates `tsconfig.tsbuildinfo` (356 KB) and forces a full re-check.

**Severity: MINOR.** Day 1 needs `npm run prisma:generate` between the schema edit and `typecheck`; §6 omits it.

---

## 6. The "~6,450 lines of dead code removed instantly" claim

> *"**Total Impact of the Purge:** ~6,450 lines of dead code removed instantly."* (also asserted at `REFACTOR_PLAN.md:22` "~6,450 lines of dead code" and §6 Day 1 "(~6,450 lines)")

**Verdict: PARTIAL — the figure is reproducible, but only under a metric that contradicts every per-row number in the tables it summarizes.**

### 6.1 The arithmetic, measured today

```
                     physical (wc -l)   non-blank (grep -cve '^[[:space:]]*$')
§2.2  21 files            1,681              1,550
§2.3  17 files            3,413              3,173
§2.4   5 files            1,956              1,716
                     -------              -------
TOTAL  43 files           7,050              6,439
```

### 6.2 Two independent conclusions

**(a) Where 6,450 comes from — REPRODUCED.** The **non-blank** total of the listed files is **6,439 ≈ "~6,450"**. The prior audit (`docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md`, table M1) recorded the identical conclusion with a slightly different basis: `| Purge total | ~7,000 | **~6,447** |`, an 8-line gap from 6,439 attributable to its own component-line choices. So the plan *did* absorb the prior audit's total — and the number is not fabricated.

**(b) Why the claim is still wrong — METRIC MISMATCH.** Every "Verified Lines" cell in §2.2 and §2.3, and the one inline figure in §2.4 ("1,625 lines"), are **physical** `wc -l` counts — §2.2 matches physical 6/6 and §2.3 matches physical 12/17 (§3.1). The physical sum of the plan's **own stated** per-row numbers is:

```
§2.2 as claimed 1,681 + §2.3 as claimed 3,357 + §2.4 (1,625+114+66+118+33) = 1,956  →  6,994
measured on disk today                                                        →  7,050
```

**Neither 6,994 nor 7,050 is 6,450.** The manifest's tables add up to **555–611 lines more** than the underlying non-blank basis (6,994 − 6,439 = 555; 7,050 − 6,439 = 611), because 5 §2.3 rows (−56 lines) and the headline (−611 lines) silently switch from physical to non-blank. A reader who sums the columns to check the total gets 6,994 and reasonably concludes the plan over-counts by 8%; a reader who audits one row gets the right number for the wrong metric. **Severity: MINOR** as a magnitude (understating a deletion is conservative, and it strengthens rather than weakens the case) but **MAJOR as a governance defect**, because §1.1, §2's headline and §6 Day 1 all cite "~6,450" as the verified figure that justifies the 3-4 day schedule. The one-line fix: label the column "Physical lines" and state totals as **"7,050 physical / 6,439 non-blank"**.

### 6.3 If BLOCKER B1 is fixed, the headline moves again

Adding `tests/unit/authorization.test.ts` (634 physical / 581 non-blank) to §2.4 and `src/server/services/service-container.ts` (45 / 37) to §2.3 gives the honest post-correction totals:

```
physical:   7,050 + 634 + 45 = 7,729 lines across 45 files
non-blank:  6,439 + 581 + 37 = 7,057 lines
```

So the corrected claim is **7,729 physical / 7,057 non-blank lines across 45 files**, i.e. **29.0% of the repo's 26,675 physical (and 28.7% of its 24,580 non-blank) lines of hand-written `src` + `tests` TypeScript** — the 198-file, 26,675-line denominator measured as `find src tests -name '*.ts' -o -name '*.tsx'` excluding `src/generated/`. That is a *stronger* claim than "~6,450" by ~19%: the plan undersells its own headline result.

---

## 7. Consolidated defect register

| # | Claim / location | Verdict | Severity | Evidence (path:line) | Correction |
| :-- | :-- | :-- | :-- | :-- | :-- |
| B1 | §2.3 `authorization-service.ts` "Dead legacy capability service" | WRONG | **BLOCKER** | `tests/unit/authorization.test.ts:5-9` imports `AuthorizationService`; 634 lines, 24 tests; absent from §2.4 | Add the test file to §2.4 |
| B2 | §2.1 item 3 "Clean Container Imports" | PARTIAL | **BLOCKER** | `service-container.ts:1` `PrismaCapabilityReader`, `:4` `AuthorizationService` not named; `:19,:36` live uses; `:16,:31` are the file's only exports; `grep` → 8 importers, all inside delete set | Move `service-container.ts` (45 lines) into §2.3 as a **delete** |
| M1 | §2.1 item 1 "**must happen BEFORE purge** … 6 screens do not break" | UNSUPPORTED | MAJOR | `adult-portal-helpers.ts:15` returns `"Ativa" \| "Inativa"`; all 10 surviving `StatusBadge` call sites pass `recordStatusLabel(...)`; zero surviving producer of the 4 `ActivityStatus` members | Drop the relocation. Delete `portal-view-service.ts` and prune `status-badge.tsx:1,6` |
| M2 | §2.1 item 1 relocation target `application/adult-portal/types.ts` | PARTIAL | MAJOR | File valid (116 lines, `import type` only) but `ActivityStatus` is Gen-A link vocabulary; "generalize to `EntityStatus`" widens the prop union | Relocate nothing; delete the type |
| M3 | §2.1 item 2 "repoint … to the real `AuditEvent` table" | UNSUPPORTED | MAJOR | Sole writer `prisma-access-link-store.ts:325-326` (deleted); `access-link-service.ts:40` `AuditEventInput` (deleted); zero writes in `src/application`, `src/runtime` | Delete option A; keep "remove the page", or budget a new audit sink |
| M4 | §2.5 deletion radius | PARTIAL | MAJOR | `schema.prisma:18-28` `enum Capability` (6 members), `:245` `model CapabilityAssignment`, `:77` `Organization.scopedCapabilities` — all reachable only from deleted files; `v1-policy.ts:1-5` never imports `Capability` | Extend §2.5, or state explicitly why the capability layer is retained |
| M5 | §2.5 / §6 Day 1 "Run prisma validate and typecheck" | WRONG | MAJOR | `prisma/migrations/0_init/migration.sql:58,70,117,120,123,150,153,163,166,169` + `1_add_paused_at:3` create the tables; `package.json:10-27` has no migrate script; `validate` ignores `migrations/` | Add a forward `DROP TABLE` migration (FK order) + a drift check to the Day-1 gate |
| M6 | "~6,450 lines" as the sum of its own tables | PARTIAL | MAJOR | Tables sum to 6,994 as claimed / 7,050 measured; 6,439 only non-blank | State both metrics; relabel the column |
| W1 | §2.3 `activity-builder.tsx` = 244 | WRONG | MINOR | 256 physical / 244 non-blank | Correct to 256 (or relabel) |
| W2 | §2.3 `activity-controls.tsx` = 147 | WRONG | MINOR | 156 physical / 147 non-blank | Correct to 156 |
| W3 | §2.3 `material-editor.tsx` = 252 | WRONG | MINOR | 266 physical / 252 non-blank | Correct to 266 |
| W4 | §2.3 `materials-explorer.tsx` = 120 | WRONG | MINOR | 132 physical / 124 non-blank — matches neither metric | Correct to 132 |
| W5 | §2.3 `class-groups-explorer.tsx` = 228 | WRONG | MINOR | 237 physical / 228 non-blank | Correct to 237 |
| U1 | §2.4 reason for `portal-dev-bypass.test.ts`: "deleted `listAccessLinks`" | PARTIAL | MINOR | Both `it(` blocks target `getDevBypassAccessLink` (`:12,:27`); `listAccessLinks` only at `:28` | Re-word to `getDevBypassAccessLink` |
| U2 | §2.2 completeness: `/atividade/` guard in the proxy | — | MINOR | `src/proxy.ts:109-116` `startsWith("/atividade/")` + stale Referer threat-model comment | Add to §2.2 cleanup |
| U3 | §2.2 completeness: nav-highlight special case | — | MINOR | `adult-portal-helpers.ts:136` `item.label === "Links de acesso"`; 0 test coverage | Add to §2.2 cleanup |
| U4 | §2.3 completeness: surviving help content | — | MINOR | `ajuda/page.tsx:9,17-23` 3 of 4 topics describe deleted Gen-A surfaces | Add a rewrite row |
| U5 | §5.4 `src/generated/prisma` staleness | — | MINOR | `browser.ts:86-89`, `client.ts:110-113`, `internal/class.ts:23` (`inlineSchema`) | Add `npm run prisma:generate` to Day 1 |
| U6 | `auth.test.ts` asserts deleted routes | — | MINOR | `tests/unit/auth.test.ts:146-147` (harmless: `gateway.ts:48-55` is prefix-only) | Re-point the fixtures to live paths |

### 7.1 Confirmed-clean (the manifest's strengths, so the author knows what not to change)

| Claim | Result |
| :-- | :-- |
| §2.2 all 6 rows + the "517-line action file" side-note | **6/6 exact**; 21 files, 1,681 lines |
| §2.2 "Obsolete redirect stubs" (modulos, admin/jogos, admin/modulos) | Verified by reading all 4 files — pure `redirect("/portal")` |
| §2.2 "Replaced by `/portal/turmas`" and "Replaced by `/jogar` + QR" | Both replacement trees live and wired into navigation; no dead nav links created |
| §2.2 `PRODUCT.md:115-119` citation | Materials deferral confirmed in `PRODUCT.md ## Materials` |
| §2.3 all 17 paths | **0 phantom entries**; every file exists |
| §2.3 12 of 17 "Verified Lines" | Exact |
| §2.3 "zero consumers" for 14 of 17 modules | Verified independently (full importer intersection, incl. relative-import and named-export checks for `tokens.ts`) |
| §2.3 `public-link-service` "zero callers" | **Exact** — the only caller is a deleted test |
| §2.3 `class-groups-explorer` "redundant" | **Stronger than claimed**: 0 importers already |
| §2.3 `public-state.tsx` "exclusive to deleted `/atividade/[token]`" | Exact; and `public-shell.tsx` correctly *not* listed (survivor `jogar/layout.tsx:4` needs it) |
| §2.3 no over-deletion | `portal-state.tsx` (name suggests Gen A) correctly excluded — 12 importers incl. 7 survivors |
| §2.4 all 5 test counts (56/13/5/2/2) and the 1,625-line figure | **Exact, 5/5 + 1/1** |
| §2.5 `:65` and `:80` line citations | **Both exact**; and "the **two** inverse relation fields" is the correct count |
| §2.5 `RateLimitBucket` "unreferenced in code" | 0 hits — exact |
| Working-tree confound | Eliminated: `HEAD` == worktree for all 43 listed files |

---

## 8. Open questions for the plan author

1. **B1 — `tests/unit/authorization.test.ts` (634 lines, 24 tests).** Should it be deleted with `authorization-service.ts`, or is the legacy `AuthorizationService` being retained? It cannot both be deleted in §2.3 and keep its only real test. If deleted, does §2.4's "78 tests" become "102", and does the surviving `v1-authorization.test.ts` (which targets `v1-policy.ts`) fully cover the authorization decision table that `authorization.test.ts` covered — including the platform-scope and "MANAGE does not grant VIEW" rules at `:1450` and `:1515`?
2. **B2 — `service-container.ts`.** Is it a survivor that needs cleaning, or Generation A dead? Its only two exports are consumed by `atividades/actions.ts` (`:120-123,260-262,332-334,376-378,417-419,457-459,492-494`) and the deleted `vi.mock`. Should it be removed outright, joining the four V1 containers (`adult-portal-`, `player-access-`, `game-state-`, `game-event-container.ts`)? If it survives for a future need, which symbol is expected to return?
3. **M3 — audit.** Is administrative audit in V1 at all? `PRODUCT.md` scope for `## Product boundary` lists three surfaces; is "trilha de auditoria" one of them? If yes, the work is *writing* an audit sink for the V1 services (today: zero writers outside the deleted `prisma-access-link-store.recordAudit`) plus a read path, `Capability.AUDIT_VIEW`-equivalent gating via `v1-policy.ts`, and a page — not a "repoint". If no, delete `admin/auditoria/page.tsx` (73 lines) and say so in §2.2, then decide separately about `model AuditEvent`.
4. **M1/M2 — `ActivityStatus`.** Given §1.3's evidence, can we drop the relocation from Day 1's critical path? Do you want the dead `StatusBadge` union members `"Convite pendente"`, `"Lançamentos bloqueados"`, `"Novas atividades bloqueadas"` (zero producers repo-wide *today*) pruned in the same 2-line edit, or retained for a planned V1 feature that would produce them?
5. **M4 — capability layer.** After the purge, `enum Capability`, `model CapabilityAssignment` and `Organization.scopedCapabilities` have zero code references. Delete them in §2.5, or is `Capability` intended as the V1 permission mechanism (in which case `v1-policy.ts`'s role-based checks are the thing that is wrong)? A DB CHECK constraint on the enum values is in `0_init`, so removal is a migration, not an edit.
6. **M5 — migration mechanics.** Is the target database created by `prisma migrate deploy` against `prisma/migrations/`, or `db push`? Neither is in `package.json` (only `prisma:generate`/`postinstall`). Who authors migration `6_drop_generation_a`, in what order do the two `access_links` `RESTRICT` FKs and the `CHECK` constraints come down, and does the shared Neon branch need a data-preservation decision for `access_links` (real links may exist) before dropping it? What is the Day-1 gate that would *detect* schema/migration drift — `prisma migrate diff` in CI?
7. **M6 — the headline metric.** Which do you want to be able to point at: "7,050 physical lines" or "6,439 non-blank lines"? Once B1/B2 are folded in the honest number is ~7,700/~7,100 across 45 files (~29% of hand-written TS). Should `~6,450` in §1.1 and §6 Day 1 be corrected to match, and should the "Verified Lines" column be renamed "Physical lines"?
8. **§2.2 scope boundary.** Is the *content* purge (dead references to deleted surfaces in surviving files: `proxy.ts:113`, `adult-portal-helpers.ts:136`, `ajuda/page.tsx:7-24`) inside Generation A's definition of done, or deferred? Criterion 1 ("Clean Codebase") arguably covers it, but no §2 row or Day-1 bullet does, so it will be forgotten.
9. **Dead-code metric.** §2.3's `class-groups-explorer.tsx` (237 lines, 0 importers *before* the purge) is qualitatively different from the 16 files that the route deletions render dead. Do you want a "already orphaned" sub-table so Day 1 can land in one commit and the residual-risk commit can be reverted independently?
10. **Sequencing.** §6 Day 1 orders "Pre-relocation → Delete → schema → validate". If M1 removes the relocation prerequisite, does Day 1 collapse to a single atomic `git rm` + `schema.prisma` edit, and can `npm run check` (`package.json:24` = `format:check && lint && typecheck && test`) replace the two separate "validate and typecheck" steps as the one real gate — noting §1.1's acceptance of "a temporary build break" means `check` will be red mid-Day-1, so the gate needs an explicit "green only at end of Day 1" contract?
