# Implementation Critique: `REFACTOR_PLAN.md` v2.1 vs the Governing Audit vs the Code

> Historical evidence. Execute [current runbook](IMPLEMENTATION-READY.md), not the superseded work orders, decisions, or gates below.

**Date:** 23 September 2026
**Role:** input to the implementation dossier in `docs/refactor-dossier/`
**Method:** measurements taken directly in this repo during this pass, reconciled against `REFACTOR_PLAN.md` v2.1 and the governing architecture document `docs/architecture-audit-2026-09-23.md`.
**Explicit scope:** this file does **not** propose edits to `REFACTOR_PLAN.md`. The plan is the intended direction. This document exists so an implementer does not act on a sentence in either document that the code cannot honor, and knows which of the two governing texts wins when they disagree.

Tree state at measurement time: `main` @ `e5aaf1e`, working tree clean. No file outside `docs/refactor-dossier/` was created or modified by this pass.

---

## 1. Ground facts measured in this pass

These are reproduced from the actual files, not from any prior report.

| Fact | Measured value | Evidence |
| :--- | :--- | :--- |
| Next.js version | `16.3.2` | `package.json:29` |
| Files carrying `"use server"` | **7** | `entrar/actions.ts`, `entrar/recuperar/actions.ts`, `portal/adult-portal-actions.ts`, `portal/atividades/actions.ts`, `portal/player-access-actions.ts`, `portal/sign-out-action.ts`, `(public-play)/jogar/actions.ts` |
| Exported action functions across those 7 | **24** (1+1+10+6+4+1+1) | `grep -c '^export \(async \)\?function'` per file |
| Action ids registered in the last server build | **17** node / **0** edge | `.next/server/server-reference-manifest.json` |
| ⇒ actions with **zero** production consumers | **7** | 24 − 17 |
| Demo export currently builds | **Yes** — `out/` present and complete | `out/index.html`, `out/404.html` exist |
| Prerendered demo detail pages | **3** class pages (`demo-turma-3a`, `demo-turma-4a-campos`, `demo-turma-5b`), **2** organization pages | `ls out/portal/turmas`, `ls out/portal/admin/organizacoes` |
| `out/api/` today | **Does not exist**, while 4 `/api/v1/player/*` route handlers do exist | `out/` listing vs the route tree |
| `@runtime/*` aliases | **9**, duplicated in `next.config.ts:44-79` (per-target) and `tsconfig.json:24-42` (**always** the server variant) | read both files |
| `@runtime/*` import sites | **24 statements in 23 files** | `grep -rn "@runtime/" src` |
| vitest alias coverage | **None** — `vitest.config.mts:5-11` aliases only `@` | read file |
| Files named by the plan that do **not** exist yet | `src/runtime/contracts.ts`, `src/runtime/target.ts`, `src/runtime/offline/`, `src/components/shared/primitives.module.css`, `src/components/portal/classes-screen.module.css`, `src/components/portal/portal-navigation-presenter.ts` | existence test per path |
| Files the plan names that **never exist at all** | `src/runtime/demo-issuer.ts` (§3.3, `REFACTOR_PLAN.md:142`) | existence test |
| Prisma migrations on disk | `0_init`, `1_add_paused_at`, `2_v1_adult_roles_and_classes`, `3_slice_02_player_access`, `4_v1_game_state`, `5_v1_game_events` | `ls prisma/migrations` |
| Generated Prisma client | **24 `.ts` files, every one carrying `@ts-nocheck`** | `grep -rl "ts-nocheck" src/generated \| wc -l` → 24 |
| `RATE_LIMITED` references outside generated code | **3**: `src/server/http/errors.ts:11`, `contracts/schemas/api-error.v1.schema.json:21`, and `src/app/(professional)/portal/atividades/actions.ts:181` (**which §2.2 deletes**) | grep, `src/generated` excluded |
| Cross-tab demo sync mechanism | the **`storage`** listener at `src/components/portal/use-demo-portal.ts:15` (teardown `:18`), not the same-tab `adult-portal-demo-change` `CustomEvent` at `:14` (teardown `:17`); `:13` is the initial `sync()` call | read file — **line numbers corrected by `AUDIT` B3**, which found this file's first pass off by one |

Two of these rows deserve emphasis because they change what a verification gate is worth:

- **24 exported actions, 17 registered.** Next's static-export gate is a *bundle-graph membership* check, not a "does a file say `use server`" check. Deleting Generation A removes 6 of the 7 unreferenced action functions (`portal/atividades/actions.ts`) and therefore changes **nothing** about whether the demo build passes. The purge buys cleanliness, not E625 safety.
- **`out/api/` cannot exist.** The exporter drops route handlers and `src/proxy.ts` by construction, so `REFACTOR_PLAN.md:236` ("assert no `api/` in `out/`") is an assertion that can never fail, in the current tree or after the refactor. The gate that does discriminate is already written down at `REFACTOR_PLAN.md:227` and `:251` (zero server-reference ids) — Day 4 should simply use it.

---

## 2. The governing audit's own target design cannot build the demo

This is the most load-bearing item in the file, because the audit is the stated source of truth and an implementer reading it will be led into a dead end.

`docs/architecture-audit-2026-09-23.md:519-526` prescribes the composition seam as:

```ts
// src/runtime/composition.ts
import * as server from "./composition.server";
import * as demo from "./composition.demo";
export const portal: PortalRuntime = APP_RUNTIME_MODE === "demo" ? demo.portal : server.portal;
```

The same shape recurs at `:624` (Phase 1 step 3) and, in stronger form, at `:676-678` (Phase 3 step 5: *"Delete the demo action modules … keep the single `"use server"` implementations, and make the container mode-aware instead of the module graph"*), and in the target table at `:546` (*"Server actions: one `"use server"` module; demo differences resolved through the injected container"*).

That design cannot work under `output: 'export'`:

1. `import * as server from "./composition.server"` is an **unconditional module-graph edge**. A runtime ternary chooses which object's *methods get called*; it does not stop the server module from being compiled, and compiling it registers its `"use server"` actions in `server-reference-manifest.json`.
2. Registering any `server-action` id while `output === 'export'` aborts the build. The check is in the exporter and there is no opt-out in 16.3.2 (`node_modules/next/dist/export/index.js`, error code `E625`; the `serverActions` config schema exposes only `allowedOrigins`/`bodySizeLimit`). *Mechanism as documented in `docs/agent-reviews/refactor-plan-v2/RV-C-action-seam-runtimes.md` §1; the code paths should be re-opened by the implementer before trusting them, but the observable consequence is confirmed by this table's row "Action ids registered: 17 of 24".*
3. The alternative the plan briefly entertained — passing handlers down as props from a Server Component into a Client Component — is separately illegal for the demo half: a plain function is not a serializable prop across that boundary; the only serializable function type is a server reference, i.e. exactly what static export forbids.

**`REFACTOR_PLAN.md` §3.1 (`:125-129`) chose the one design that survives**: a per-build generated entry file, so that only one variant is ever *staticly reachable* in a given bundle. Design 1 is therefore not merely "the plan's choice" — it is a correction of the governing document.

**Consequence for the dossier, stated as a rule:** `docs/architecture-audit-2026-09-23.md` remains authoritative for scope, decisions D1-D7 and guardrails, but **§8.3 (`:504-537`), §8.4's server-action row (`:546`), Phase 1 step 3 (`:624`) and Phase 3 step 5 (`:676-678`) are superseded on the seam mechanism.** Anyone implementing from the audit alone will produce a demo build that dies at the last second of compilation.

### 2.1 What this does *not* say about the demo

`REFACTOR_PLAN.md:13-16` characterises Generation C as "a parallel, duplicated implementation of Generation B". The code says otherwise: both variants instantiate the **same** domain service over a different port — `src/runtime/adult-portal-demo.ts:9-11` (`new AdultPortalService(new DemoAdultPortalStore())`) against the Prisma-backed twin, with identical zod schemas on both write paths. The real duplication is 10 wrapper functions and 4 adapter files (`src/runtime/adult-portal-demo-actions.ts` 223 lines mirroring `adult-portal-actions.ts` 222 lines), **not** the use cases.

This matters for two decisions:

- It bounds how much of §2's "purge the fork" logic is justified — there is no fork of the domain to purge.
- It means the audit's principle §8.1.1 ("one implementation per behaviour") is *already satisfied at the domain layer* and can **never** be satisfied at the module-entry layer under static export. The dossier should state the seam's goal as "one typed contract, two build-time-selected entries, zero duplicated logic below them", which is achievable, rather than "one entry point", which is not.

---

## 3. Where the two documents give opposite answers

| # | Topic | Plan v2.1 says | Audit says | Resolution for implementation |
| :--- | :--- | :--- | :--- | :--- |
| C1 | `RateLimitBucket` / `RATE_LIMITED` | §2.5.4 (`:84`): remove the model and clean up the code in `src/server/http/errors.ts:11` and `contracts/schemas/api-error.v1.schema.json:21` | D6 (`:798`): "implement with `RateLimitBucket`" | **No real conflict — the audit authorises the plan, and the deferral this row used to recommend is withdrawn.** Phase 6 step 3 (`:725-727`) reads "Implement … **or** delete the model and the code path," and the decision-table cell is the stricter of the two texts. ~~Deleting `RATE_LIMITED` from `contracts/schemas/api-error.v1.schema.json:21` is a change to the GameMaker-facing error vocabulary — a contract change, not a cleanup.~~ **That premise is false, and it is this row's own error — `COMPAT-POLICY.md` §2 row D-5 is the authority.** `api-error.v1.schema.json` describes the HTTP envelope of `/api/v1/player/*` (`src/server/http/route.ts` → `src/server/http/errors.ts` `errorResponse`), whose only client is portal-owned browser code at `src/components/public/game-host.tsx:290,294,298,463` — and that route is **never reachable in the shipped target**, because `output: 'export'` drops route handlers. GameMaker's actual vocabulary is a different file, `contracts/schemas/v1/protocol-error.v1.schema.json`, with four codes (`VALIDATION_FAILED`, `PROTOCOL_VERSION_UNSUPPORTED`, `STATE_SCHEMA_VERSION_UNSUPPORTED`, `STATE_TOO_LARGE`), fixture-loaded at `tests/unit/v1-contracts.test.ts:31-36`; `game-host.tsx:142` types on `ProtocolErrorV1["code"]` and never on `ApiErrorCode`. Measured: `grep -rn "ApiErrorCode" src tests` → `errors.ts:27,37` only; `grep -rnE "429" src tests scripts` → 0 hits. So the edit is a 1-line cleanup that goes in the same commit as the model, per plan §2.5.4. The class-B contract that must not move is the **`protocol-error.v1` surface and the Portuguese bridge field names**, and the sentence in `contracts/schemas/README.md:85-88` ("Frozen V1 naming … An incompatible rename requires protocol version 2") governs *those*, not this file. |
| C2 | `CapabilityAssignment` / `enum Capability` | §2.5.3 (`:83`): remove model, `Organization.scopedCapabilities` (`schema.prisma:79`) and the enum | D3 (`:795`): "keep capability grants **only if** `/portal/admin/auditoria` and org management need per-scope grants after Phase 2"; risk R5 (`:783`): "locked-out admins" | The plan deletes the auditoria route in §2.2, which dissolves the audit's stated condition. The *other* half of D3 — organization management — had to be verified against `src/server/authorization/v1-policy.ts` before the enum goes (an earlier draft of this row named `src/application/authorization/v1-policy.ts`, which does not exist): **it has been** — the module is role-based and imports no `Capability`, so the deletion is safe (`REFACTOR-DOSSIER.md` §6.2). `Capability` carries `RESULTS_VIEW_ORGANIZATION`, `ORGANIZATION_MANAGE`, `USER_MANAGE`, `AUDIT_VIEW` (`prisma/schema.prisma:18-25`), and the enum is a PostgreSQL type created in `0_init`, so its removal is irreversible SQL. Deleting it while any surviving screen still consults it is a privilege regression, i.e. exactly R5. |
| C3 | `APP_RUNTIME_MODE` default | Not mentioned in v2.1 (grep confirms no `mode.ts` reference survives) | §8.7 (`:583-584`): "gets a safe default (`server`) so `next dev`/`next build` work unwrapped" | **Plan is right; the audit's sentence is unimplementable.** `next.config.ts:5-7` Zod-parses `process.env.APP_RUNTIME_MODE` at *config load*, before any runtime module is imported, so a default inside `src/runtime/mode.ts` cannot make an unwrapped `next dev` work. A `server` fallback would additionally select production auth/persistence paths from inside a demo bundle — the failure `docs/implementation/v1-architecture-plan.md:63-66` forbids — and would delete an asserted invariant at `tests/unit/runtime-mode.test.ts:10-12`. **Keep fail-fast.** |
| C4 | Verification depth | §6: unit tests + two builds + typecheck | §8.6 (`:565-576`): contract / integration / behaviour layers; D4 (`:796`): disposable Postgres in CI; R1 (`:779`): migrations have *never* been applied to a real database | Genuine gap, and the plan does not close it — but **the fix this row prescribed has been ruled out, and the gap therefore stays open rather than resolved.** ~~The dossier must add at least a `migrate diff` (migrations vs schema) gate.~~ `COMPAT-POLICY.md` §6 adopted edits 2/3 and rejected edit 1, so the shadow-DB prerequisite and the `migrate diff --exit-code` leg are **deleted, with no substitute**: the DB-free byte-compare edit 2 first offered only works against a single collapsed init, and proving a *sequential* history reproduces the schema requires replaying it, which requires a database. `prisma validate` is the only schema check, and it will indeed pass on a schema whose migration history no longer reproduces it — `AccessLink` is a handful of schema lines and `RateLimitBucket` is relation-free. Two facts sharpen rather than soften the residue: the deleted gate **could not run today anyway** (`migrate diff --from-migrations … --exit-code` exits 1 demanding `datasource.shadowDatabaseUrl`, which `prisma.config.ts` does not define and there is no CLI flag for), and no migration has ever been applied to a real database (`slice-03-05-portal-handoff.md:36`). So the honest statement is that **"the server target works" is unproven after Day 4, not proven**, and that closing it is the staging-connection item `slice-03-05-portal-handoff.md:35` already carries — a human task, not a phase step. |
| C5 | Boundary enforcement | §7 lists size budgets and a manifest assertion | §8.5 (`:549-563`) + §10.2/§10.4 (`:743-748`): `eslint-plugin-import` path rules, and a rule forbidding `@/runtime/**` imports except the composition and contract files | The plan drops the mechanism that keeps the seam honest. Once §3.1 step 5 removes the aliases, nothing structurally prevents a component from importing `src/runtime/target.server.ts` (or a `"use server"` module) directly and re-breaking `build:demo` — and `tsc` will not catch it, only the exporter will, minutes into a build. Given §7.1 already wants a ratchet, a handful of lint lines is the cheapest guard available and should be in the dossier's Day 2 exit criteria. |
| C6 | Size budget semantics | §7.1 (`:246-250`): states budgets as the criterion | §10.3 (`:744-746`): "the budget applies to *new or modified* files only, so the plan does not stall on existing offenders" | The audit's wording is the workable one. Whether the purge + §4 leave any file above fail-threshold is a measurement question answered by the pending baseline count (see §5). |
| C7 | Auditoria | §2.2 (`:47`): delete the route | Phase 2 step 1 (`:640`): repoint at the real `AuditEvent` table **or** delete the page | Plan takes the audit's own authorised second option. Note the asymmetry the plan creates and should own: §2.5.5 keeps `model AuditEvent` "for future V1 administrative logging" while §2.3 deletes `prisma-access-link-store.ts:325`, the sole writer in the codebase. After Day 1 the table exists, nothing writes it, and nothing reads it. That is a deliberate placeholder, not a bug — but the dossier must record it so nobody "fixes" the empty page later. |

---

## 4. Statements that the code contradicts

Sentences an implementer would otherwise act on and get wrong.

1. **`REFACTOR_PLAN.md:142` — "Update demo credential generation (`demo-issuer.ts`)".** No such file exists anywhere in the tree. The path comes from the audit's *target* layout (§8.4 `:544` proposes creating `runtime/demo/demo-issuer.ts`); the plan cites it as an existing file to edit. The actual behavior to change is in `src/runtime/adult-portal-demo-store.ts`: the store seeds credentials with the token as its own hash (`:278-305`, constants in `DEMO_PLAYER_TOKENS`) and the issuer returns `token: tokenHash` at `:852`. There is also a live constraint the plan omits: the demo prints a QR the *same browser* later scans, so hashing is fine only if the raw token remains recoverable in the issue flow — the audit already flagged this at `:685-687` and it must survive into the dossier as an acceptance check on the print/QR path, not just a code change.
2. **`REFACTOR_PLAN.md:152` — extract "buttons, inputs, form fields, cards, and shared badges".** Measured in `src/components/portal/portal.module.css`, standalone rule definitions: `.button` `:757`, `.buttonGhost` `:770`, `.input` `:1143`, `.field` `:1612`, `.statusBadge` `:1038` **exist**; **`.card` and `.badge` do not exist in any stylesheet in the repo.** The nearest analogues are `.panel` and `.statusBadge`. Note that `.button`/`.buttonGhost`/`.input`/`.panel` also appear earlier (`:712`, `:714`, `:1127`, `:1406`, `:1416`) only as members of **grouped selector lists**, not as standalone rules — which is itself the hazard: such a rule cannot be moved or deleted wholesale when it mixes classes belonging to different post-split modules (`.panel, .sidePanel, .reportPanel, .detailPanel` at `:1406` is one example). Whether `.panel` is purge-dead — and therefore must not be promoted into `primitives.module.css` — is being measured by `INV-E`.
3. **`REFACTOR_PLAN.md:139` (§3.2) — "This stops TypeScript from scanning the 29,722 lines of generated code".** All 24 generated files are `.ts` (not `.d.ts`) and **all 24 already carry `@ts-nocheck`**, so their bodies contribute almost nothing to checking today; they remain in the program graph regardless because ~36 surviving files import `@/generated/prisma/enums`. Excluding them may still help wall-clock time, but the stated mechanism in the plan is wrong, and the "decision" largely restates the status quo. Treat as a cheap experiment with a measurement attached, not a win.
4. **`REFACTOR_PLAN.md:170` (§4.3 item 3) — "Eliminate duplicate handshake code between `game-host.tsx` and `demo-game-adapter.tsx`".** Already done: `src/components/public/demo-game-adapter.tsx` contains **zero** occurrences of `postMessage` or `addEventListener`, and the shared piece (`createBridgeRequestId`) already lives at `src/components/public/game-bridge.ts:77` and is imported by both sides (`demo-game-adapter.tsx:11`, `game-host.tsx:34`). This plan item is work that does not exist; the ~250-line target for `game-host.tsx` should be re-derived from the file's actual responsibilities instead.
5. **`REFACTOR_PLAN.md:135` (§3.3) — "multi-tab syncing" via the `adult-portal-demo-change` event.** `use-demo-portal.ts:14` listens to the same-tab `CustomEvent`; **`:15`** listens to `storage`, which is what actually crosses tabs (`:13` is the initial `sync()` call; teardowns at `:17`/`:18`). Line numbers corrected by `AUDIT` B3, which caught this file's first pass off by one. A "retain the cross-tab event" instruction read against `:13` alone deletes the wrong line.
6. **`REFACTOR_PLAN.md:236` (Day 4) — "assert no `api/` in `out/`".** Cannot fail; see §1.
7. **`docs/architecture-audit-2026-09-23.md:632` — "the demo build still emits 109 pages"** as a Phase-1 exit criterion. The current `out/` tree is materially smaller than that on the portal side (3 class detail pages, 2 organization detail pages), and after §2 deletes seven route trees the page count drops further. Any gate expressed as an absolute page number must be re-baselined after the purge or it will read as a regression.

---

## 5. Still open at the time of writing

These were open when this file was written. The investigation and verification passes have since run, so each line below now carries its answer and where it landed.

- The exact reverse-dependency closure of §2's deletion set — i.e. every *surviving* file that must be edited, not deleted, for the purge to build. This is the difference between a clean Day 1 and a dangling-import sweep. **Answered:** exactly **one** build-breaking edit, `status-badge.tsx:1`, proved by executing the purge in scratch copies rather than by graph reasoning (`REFACTOR-DOSSIER.md` §5.1-§5.3); everything else on the edit list is hygiene.
- ~~Whether `enum Capability`'s four non-link values still have a reader in `src/application/authorization/v1-policy.ts` (decides C2).~~ **Resolved, and the path here was wrong**: the policy module is `src/server/authorization/v1-policy.ts` (`src/application/authorization/` does not exist). It is purely role-based (`OrganizationRole`/`PlatformRole`) and imports no `Capability`; no survivor imports the enum at all, so C2's deletion is safe and audit risk R5 is void (`REFACTOR-DOSSIER.md` §6.2).
- Real file counts against §7.1 thresholds before and after the purge (decides C6), and the concrete `ci.yml` design. **Answered:** §2 baseline (33→27 files, 284→182 tests) and §8.5 — the plan's ceiling is unreachable as written, 9 FAIL / 8 WARN measured, so C6 goes to the audit's ratchet wording; `ci.yml` job order and env requirements are §4.4.
- Whether the demo must support created entities on refresh, and if so which of the three fixes is cheapest (this decides whether §7.5's "fully operational demo" is achievable at all, or must be scoped to seeded routes). **Answered:** D-2 (§3) — (c)+(a). Deep links to demo-created entities hit `out/404.html`; the redirect plan §3.3 asserts does not exist (§9.3, R-04).
- The true internal cohesion boundaries of `game-offline-sync.ts` and `game-host.tsx`, and what test coverage exists to catch a split going wrong. **Answered:** §8.1-§8.2 — 13 refs + 6 states with ~11-13 straddling a bridge/sync cut, so the hooks split is refused; 665 lines of storage have zero coverage and `fake-indexeddb` is not installed.
- The CSS class→component ownership map, including dynamic `styles[...]` access that a mechanical purge would silently break. **Answered:** §8.3 — 319 classes split 170 removable / 91 shared / 58 live-only, `composes:` has 0 hits repo-wide, and the dynamic-access case is exactly why the selector-integrity oracle gates any split (R-01, the blank QR sheet).

---

## 6. One-paragraph summary for the implementer

The plan's direction is sound and its mechanism choice for the seam is the only one that can compile. Three things will still bite: Day 4's stated gate cannot fail, so use the manifest assertion the plan already defines elsewhere; the *governing audit* describes a composition-seam design that aborts the demo build, so ignore §8.3/§8.4/Phase 1.3/Phase 3.5 of that document on mechanism and follow plan §3.1; and several sentences in the plan name files, CSS classes, and duplicate code that do not exist in this tree, so implement each item against the corrected locations in §4 above rather than the quoted names.
