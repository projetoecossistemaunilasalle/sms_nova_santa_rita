# RV-F — Adversarial Review: §6 Roadmap + §7 Gates (+ §1.2 framing, §2.1 prerequisites)

**Scope:** `REFACTOR_PLAN.md` v2.0 §6 "Day-by-Day Implementation Roadmap", §7 "Success Criteria &
Verification Gates", the §1.2 "direct 3-to-4 day architectural leap" framing, and §2.1's Phase 0
prerequisites. Question asked: **is the plan executable as written, and would its gates catch
regressions?**

**Method:** read-only only (`ls`, `find`, `wc -l`, `grep`, `git status/log/ls-files/show`,
`sed -n`). No file was created or modified other than this document. No `npm install`, no
`next build`, no `prisma` command was executed (`.next/` and `out/` untouched).

**Measured at:** 2026-09-23, working tree `C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal`,
HEAD `d4af23c` ("Document Slice 2 workflow and verification", 2026-09-22 17:43:55 -0300).

**Relationship to the v1 review:** `docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md` reviewed
plan v1.0. v2.0 genuinely fixed B1 (seam keeps two implementations), B2 (keeps
`src/generated/prisma`), B3's first/third/fourth importers, B4's *inverse-relation* half, B5
(localStorage), M4, M7, M8 and §3.4. **It did not fix M5 (criterion 1), M9 (roadmap safety) or M11
(governing artifacts), and it re-introduced a stale total.** Findings below that duplicate the v1
review are marked `[v1-review: MX]` so the author can see what was carried forward unfixed.

---

## 0. Verdict summary

**Overall: NOT EXECUTABLE AS WRITTEN.** §6 has verification steps on 2 of 4 days, and the single
per-day gate it does have (Day 1 `typecheck`) is guaranteed red by a hole in §2.1(3) and a missing
test entry in §2.4. §7's five criteria contain one already-true vacuous assertion (criterion 5), one
criterion that fails on today's facts and on the plan's own output (criterion 1), one that needs
secrets the plan never asks for (criterion 4/`build:server` in CI), and one with zero automation
behind it (criterion 5 "functional demo"). The 3–4 day envelope (§1.2) is not defensible for §6 as
scoped; the purge alone is a 1–1.5 day change with 4 unlisted blast-radius items.

| # | Area | One-line finding | Severity |
| :-- | :-- | :-- | :-- |
| F1 | §6 Day 1 | Purge cannot pass its own `typecheck` gate: `service-container.ts:4-5` still imports two §2.3 deletions | BLOCKER |
| F2 | §6 Day 1 / §2.4 | `tests/unit/authorization.test.ts:9` imports `authorization-service` (24 cases, 634 lines) — absent from the manifest | BLOCKER |
| F3 | §6 Day 2 | Alias removal has no stated replacement; the alias is the *compile-time* selector for a `"use client"` seam | BLOCKER |
| F4 | §6 Day 4 / §7.4 | New CI would run `build`/`build:server`, which hard-requires 4 secrets (`next.config.ts:10-18`); plan never mentions secrets | BLOCKER |
| F5 | §7.5 | `out/` already has no `api/` today → the assertion passes before any work; vacuous gate | MAJOR |
| F6 | §7.1 | 9 non-generated files >400 lines remain after §2+§4 are done (measured) → criterion unmet without ~8 more decompositions — `[v1-review: M5]` | MAJOR |
| F7 | §6 Day 1 | No drop migration anywhere in §6; `access_links`/`rate_limit_buckets`/`capability` enum live in `0_init/migration.sql` (B4 half-unfixed) | MAJOR |
| F8 | §1.2 / §6 | First *build* gate is Day 4; Days 2–3 have none → longest non-compiling window is the alias removal (~2 of 4 days) | MAJOR |
| F9 | §6 Day 1 | Phase 0 "wire GitHub Actions CI" is stale in one direction and missing in the other: `deploy.yml` exists but has no `pull_request` trigger, no lint/typecheck/test | MAJOR |
| F10 | §6 Phase 0 | 30 untracked `src/` files (5,090 lines) include two §4 targets and two §4.1 premises; the audit trail itself is untracked | MAJOR |
| F11 | §7.4 | Test gate measures pass-rate only; Day 1 deletes 78/236 cases (33%, up to 43%) with no baseline/retention check | MAJOR |
| F12 | §6 Day 2/3 | 4 test files (23 cases) pin `@/runtime/adult-portal-demo-store`; `game-offline-sync.test.ts:16` pins the pre-split module path | MAJOR |
| F13 | §2.1(2) | False choice: after the purge there is **no** `AuditEvent` writer left in the repo | MAJOR |
| F14 | §2.5 | `Capability.LINK_VIEW`/`LINK_MANAGE` become dead in schema + Postgres enum; unmentioned | MINOR |
| F15 | §1.1 | "live GitHub Pages deployment at every commit" CONFIRMED — which makes the accepted build break user-visible | MAJOR (risk) |
| F16 | §2.5 total | "~6,450 lines" ≠ its own manifest: measured 7,050 (`wc -l`), plan's rows sum to 6,994 | MINOR |
| F17 | §2.3 | "Verified Lines" mixes raw and blank-stripped counts (activity-builder 244 vs 256; share-actions 147 vs 139) | MINOR |
| F18 | §7.1/§7.3 | No measurement command or counting method defined for "files over 400 lines" / "execute cleanly" | MAJOR (gate) |
| F19 | §7.5 | Zero integration/E2E tests exist (`tests/` has only `unit/`, `environment: "node"`) → criterion 5 is 100% manual | MAJOR |
| F20 | docs | 8 markdown artifacts, ~46 mentions of deleted routes/models; §6 has no doc-update step `[v1-review: M11] | MINOR |
| F21 | §3.2 | "TypeScript stops scanning 29,722 generated lines" via `exclude` is not how `include`/`exclude` interact with import resolution | MAJOR (claim) |
| F22 | §4.2 | `idb-store.ts` is exempted from the 400-line cap with no ceiling and no IndexedDB version/upgrade policy | MINOR |

Confirmed-and-correct §6/§7 items are listed in PART D.

---

## PART A — TOOLCHAIN REALITY (check 1)

### A1. Every command §6/§7 names exists — except one

> §7.3: "Tooling Health: `npm run build:demo`, `npm run build:server`, `npm run typecheck`, and
> `npm test` execute cleanly." — **CONFIRMED (exact script names).** §6 Day 1 "(lint, typecheck,
> test, build)" — `lint` exists. §6 Day 1 "Run **prisma validate** and typecheck" — **no such npm
> script.**

`package.json:9-25` (measured, complete list of 16 scripts):

| Script | Body |
| :-- | :-- |
| `dev` / `dev:demo` | `node scripts/next-target.mjs dev server` / `dev demo` |
| `build` | `npm run build:server` |
| `build:demo` / `build:server` | `node scripts/next-target.mjs build demo` / `build server` |
| `start` | `node scripts/start.mjs` |
| `lint` | `eslint . --max-warnings=0` |
| `format` / `format:check` | `prettier --write .` / `prettier --check .` |
| `typecheck` | `tsc --noEmit` |
| `test` / `test:contracts` / `test:watch` | `vitest run` / `vitest run tests/unit/v1-contracts.test.ts` / `vitest` |
| `check` | `npm run format:check && npm run lint && npm run typecheck && npm test` |
| `prisma:generate` / `postinstall` | `prisma generate` / `prisma generate` |

`scripts/` holds exactly two files: `next-target.mjs`, `start.mjs`. There is **no** `prisma:validate`,
no `prisma:migrate`, no `test:coverage`, no `verify:out` script.

**F-A1 | MINOR.** Day 1's "Run prisma validate" must be written as `npx prisma validate` or a new
script; Day 1's CI bullet names 4 commands when a **single already-existing script** (`npm run check`)
is a superset (it adds `format:check`, which Prettier is configured for and which the plan's CI list
would silently drop → format drift on day 2). Severity MINOR for the plan, MAJOR for the resulting CI
if `format:check` is omitted.

### A2. `typecheck` *does* include tests (this matters for F1/F2)

`tsconfig.json:47-55` `include`: `next-env.d.ts`, `.next/types/**/*.ts`, `**/*.ts`, `**/*.tsx`,
`**/*.mts`, `.next-demo-dev/types/**/*.ts`, `.next-demo-dev/dev/types/**/*.ts`; `exclude`:
`node_modules` only. Therefore `tests/**/*.ts` **is** typechecked, and Day 1's `typecheck` gate is
the mechanism that catches the §2.4 omission (F2) — it catches it *loudly*, which is why F2 is a
manifest gap rather than a silent regression.

Side findings (measured):
- `scripts/*.mjs` are **not** typechecked (`allowJs: false`, include pattern is `**/*.mts`). The two
  scripts that decide whether the demo leaks secrets (`next-target.mjs:41-53`) are outside every gate.
- `include` pulls in `.next/types/**` and `.next-demo-dev/types/**`; both directories exist today
  (`find .next -name types -maxdepth 3` → `.next/types`, `.next/dev/types`; `.next-demo-dev/`
  present). **Judgment:** after Day 1 deletes 6 route trees, locally generated route types for the
  deleted pages persist in `.next/`, so the Day-1 `typecheck` result depends on stale artifacts.
  `tsconfig.tsbuildinfo` (356,779 bytes, `incremental: true`) is gitignored (`*.tsbuildinfo`) so CI
  is clean, but the *local* Day 1 gate can pass or fail spuriously. Gate fix: `rm -rf .next
  .next-demo-dev tsconfig.tsbuildinfo` before the Day-1 typecheck, or run the gate only in CI.

### A3. Node/engines: fully aligned — plan's Day 4 CI premise holds

`.node-version` = `.nvmrc` = `24.19.0`; `package.json:6-9` `engines.node = "24.19.0"`,
`engines.npm = ">=11.6.0 <12"`, `packageManager = "npm@11.6.0"`; `.github/workflows/deploy.yml:26`
`node-version: "24.19.0"` with `cache: "npm"` and a committed `package-lock.json` (507,386 bytes).
**CONFIRMED, no action.** One latent fragility (**MINOR**, unmentioned by the plan):
`prisma.config.ts:1` is `import "dotenv/config"`, but `dotenv` is **not** a dependency in
`package.json` — it only appears transitively (`package-lock.json:7305` `"dotenv": "^17.3.1"`) and
resolves because npm hoists it (`node_modules/dotenv` exists). `postinstall: prisma generate` (and
therefore *every* CI install) rides on that hoisting accident.

---

## PART B — CI REALITY (check 2)

### B1. What CI already is

`find .github -type f` → **exactly one file: `.github/workflows/deploy.yml`.** There is no
`ci.yml`/`test.yml`/`lint.yml`.

`.github/workflows/deploy.yml` (measured, 51 lines):

| Property | Value |
| :-- | :-- |
| Trigger | `on: push: branches: ["main"]` + `workflow_dispatch` — **no `pull_request`** |
| Permissions | `contents: read`, `pages: write`, `id-token: write` |
| Concurrency | `group: "pages"`, `cancel-in-progress: false` |
| Jobs | `build` → `checkout@v4`, `setup-node@v4` (node 24.19.0, `cache: npm`), `npm ci`, **`npm run build:demo`**, `upload-pages-artifact@v3` `path: ./out`; `deploy` → `actions/deploy-pages@v4` (environment `github-pages`) |
| Quality gates | **none** — no lint, no typecheck, no test, no `build:server`, no `prisma validate` |

**F-B1 / F9 | MAJOR — PARTIAL.** §6 Day 1 "wire GitHub Actions CI (lint, typecheck, test, build)" is
half stale and half real: a Pages workflow already exists and already runs a *build*, so the
correct Day-1 task is "**add a second workflow** with `pull_request` triggers that reuses the same
Node version and does not also deploy" — not "wire CI". As written, an executor will plausibly edit
`deploy.yml` in place (adding a test step to the *deploy* job, so every Pages publish now depends on
the test suite) or create a duplicate workflow that also tries to own the `github-pages` environment.
§7.4 "GitHub Actions automatically tests, lints, typechecks and verifies builds **on every PR**" is
unsatisfiable by the current trigger set — `push: main` is not a PR event. §6/§7 never say this.

### B2. §1.1's GitHub Pages claim

> §1.1: "the original implementation attempted to preserve Generation A and **maintain a live GitHub
> Pages deployment at every commit**" — **CONFIRMED, verbatim-true.**

Mechanism is *not* a `pages` branch: it is `actions/upload-pages-artifact@v3` +
`actions/deploy-pages@v4` on every push to `main` (`deploy.yml:5-6, 37-40, 48-51`). No `gh-pages`
branch logic anywhere.

Consequence the plan never states (**F15 | MAJOR, risk**): Day 1 orders "Commit uncommitted working
tree" and then deletes 1,681 lines of routes from a tree whose first build gate is Day 4. If any
intermediate commit lands on `main`, `deploy.yml` will either **fail the Pages deploy** (leaving the
live site frozen at whatever artifact last succeeded) or, if the export still builds but the purge
broke a page, **publish a broken demo**. §1.2's "temporary build break" is therefore not contained to
the repo — it is user-visible on `https://…/SMS_Portal`. Mitigation (unstated): do Day 1–3 on a
non-`main` branch, and make the new CI `pull_request`-triggered, which B1 already requires.

---

## PART C — WORKING-TREE / SNAPSHOT REALITY (check 3)

### C1. How dirty, precisely

`git status --short` → **73 entries: 33 `M` (modified) + 40 `??` (untracked)**. (No `-uall`.)
Last commit is `d4af23c` at 2026-09-22 17:43; the plan is dated 23 September and is itself untracked.

### C2. The overlap the task hypothesized does **not** exist — but a worse one does

Verified programmatically (28-path purge manifest from §2.2+§2.3+§2.4 cross-referenced against every
dirty path, exact and prefix match):

- **Deleted paths that are currently modified: 0.** No conflict between Day 1's deletions and the
  33 in-flight edits. *Reported honestly as a negative result.*
- **Deleted paths that are untracked: 0.** Every §2 path is tracked, so `git rm` will behave.
- **All 28 §2 paths exist** (existence loop produced no `NOT FOUND`).
- **But 30 untracked files under `src/` totalling 5,090 lines are the plan's own subject matter**
  (`git ls-files --others --exclude-standard src`):

| Untracked file | Lines | Plan reference |
| :-- | --: | :-- |
| `src/runtime/game-offline-sync.ts` | 1,222 | **§4.2 split target** |
| `src/components/public/game-host.tsx` | 932 | **§4.3 split target** |
| `src/components/portal/results.module.css` | 378 | **§4.1 "already exists"** premise |
| `src/components/portal/team-screen.module.css` | 123 | **§4.1 "already exists"** premise |
| `src/components/public/game-bridge.ts` | 84 | **§4.3 "already exists"** premise |
| `src/components/public/demo-game-adapter.tsx` | 112 | §4.3 item 3 duplication target |
| `src/components/portal/player-access-workflow.tsx` | 540 | none (see F6) |
| `src/app/api/v1/player/{state,results,bootstrap,active-time}/route.ts` | 4 files | **none — never scoped** |
| `src/app/(professional)/portal/resultados/**` | 3 pages | none |
| `src/application/game-state/`, `src/application/game-events/` | services+ports | none |
| `src/server/db/prisma-game-{state,event}-store.ts`, `src/server/http/game-{state,event}-route.ts`, `src/server/services/game-{state,event}-container.ts`, `src/runtime/game-events-{demo,server}.ts`, `src/runtime/demo-professional-creation.ts`, `src/components/public/game-host-token.ts`, `src/components/portal/deactivate-organization-control.tsx`, `results-screen.tsx`, `demo-game-state.ts` | — | none |

Also untracked: `prisma/migrations/4_v1_game_state/`, `prisma/migrations/5_v1_game_events/`
(2 files, 66 SQL lines), `REFACTOR_PLAN.md`, `docs/agent-reviews/`,
`docs/architecture-audit-2026-09-23.md`, `docs/implementation/slice-03-05-portal-handoff.md`.

**F-C1 / F10 | MAJOR.** Three distinct consequences the plan glosses:
1. **Durability.** `git clean -fd` / `git stash -u` by anyone between Day 1 and Day 3 destroys two of
   §4's decomposition targets and three of §4.1/§4.3's "already exists" premises. Phase 0's one-line
   "Commit uncommitted working tree" is load-bearing in a way §6 does not convey (it is ~5,090 lines
   of product code, not "hygiene").
2. **Schema/migration drift risk inside Phase 0 itself.** Worktree `prisma/schema.prisma` has
   `model GameState:182`, `model ResultEvent:196`, `model ActiveTimeEvent:216`; `git show
   HEAD:prisma/schema.prisma` has **no such models** (its `AccessLink` is at 210 vs 261 in the
   worktree). Those models' migrations (`4_`, `5_`) are untracked. A partial Phase-0 commit
   (`git add prisma/schema.prisma` without `git add prisma/migrations/4_… 5_…`) yields a committed
   schema that is **ahead of its migration history** — invisible to `prisma validate` (Day 1's chosen
   gate) and to `typecheck`.
3. **Unscoped surface.** The entire V1 game subsystem (4 API route handlers, 3 `resultados` pages,
   2 application services, 2 Prisma stores, 2 HTTP adapters, 2 runtime twins) is what actually makes
   or breaks criteria 3 and 5, and appears in §2/§3/§4/§6/§7 **only** as two §4 splits. *Judgment:*
   this is where the schedule slips — the plan's 4 days contain no line item for the newest, largest
   and least-tested surface in the repo.

### C3. Is the plan reviewing an outdated snapshot? Mixed — quantified

The plan's schema line refs match the **dirty worktree**, not HEAD (`ProfessionalProfile.createdAccessLinks`
at `:65`, `Organization.accessLinks` at `:80` — both **CONFIRMED exact** against
`grep -n` on worktree `prisma/schema.prisma`). So §2.5 was measured *after* the recent commits.
But §2.3's component counts were not (F-D2), and §4.1/§4.2/§4.3 measure files that only exist
untracked. Conclusion: **§2.5 and §4 are current; §2.3 totals and the §2.5 "Total Impact" headline
are stale/mis-summed; the *whole plan* is uncommitted and therefore has no reviewable diff against a
tree state.** The recent commits the task pointed at (`5bc2467` player access domain+persistence,
`48b6c5d` "Wire player access into server and static demo runtimes", `056ad67` "Add QR player
workflow and entry screens") added the `@runtime/player-access-actions`,
`@runtime/player-entry-action`, `@runtime/player-access` aliases (still 9 today, so §1.1's "9 aliases"
and §3.1's "9" remain **CONFIRMED**: 9 keys in `tsconfig.json:24-42`, 9 in
`next.config.ts` `turbopack.resolveAlias`).

---

## PART D — DELETION MANIFEST vs TESTS (check 4) + line-count forensics

### D1. §2.4's own numbers are exact — all five

`wc -l` + `grep -cE "^[[:space:]]*(it|test)[[:space:]]*\(|it\.each|test\.each"`:

| File | Plan tests | Measured tests | Plan lines | Measured lines |
| :-- | --: | --: | --: | --: |
| `tests/unit/access-link-service.test.ts` | 56 | **56** | 1,625 | **1,625** |
| `tests/unit/access-link-tokens.test.ts` | 13 | **13** | — | 114 |
| `tests/unit/link-status.test.ts` | 5 | **5** | — | 66 |
| `tests/unit/portal-dev-bypass-actions.test.ts` | 2 | **2** | — | 118 |
| `tests/unit/portal-dev-bypass.test.ts` | 2 | **2** | — | 33 |
| **§2.4 subtotal** | **78** | **78** | | **1,956** |

Suite today: **33 test files, 6,579 lines, 236 `it(`/`test(` call sites** (`grep -rhoE "\b(it|test)(\.\w+)*\(" tests | wc -l`).
So Day 1 deletes **78/236 = 33.1%** of all assertions; with F2's `authorization.test.ts` (24) that
becomes **102/236 = 43.2%**.

### D2. Tests that break on §2 deletions and are **not** in §2.4 — the manifest hole

Sweep: every §2.2/§2.3 module name grepped across `tests/`, excluding the 5 §2.4 files.

```
tests/unit/authorization.test.ts:9:} from "@/server/services/authorization-service";
tests/unit/auth.test.ts:146,147: expect(isProtectedPathname("/portal/atividades…")).toBe(true);
tests/unit/auth.test.ts:154:      expect(isProtectedPathname("/atividade/token/jogar")).toBe(false);
```

**F-D1 / F2 | BLOCKER — MISSING from §2.4.** `authorization-service.ts` (244 lines) is in §2.3's
deletion list; `tests/unit/authorization.test.ts` (634 lines, **24 cases**, 4th-largest suite in the
repo) imports `AuthorizationService`, `CapabilityAssignmentRecord` and `CapabilityReader` from it
(`authorization.test.ts:4-9`). Day 1's deletion produces `TS2307` in `typecheck` **and** a
collection error in `npm test`. §6 offers no resolution and §2.4 does not list it, so Day 1 as
written cannot end green. The author must pick one, and the pick changes §7.4's arithmetic:
(a) delete the suite → assertion base falls to 134 (−43%);
(b) keep `authorization-service.ts` → §2.3's "dead legacy capability service" claim is WRONG
(24 tests + a 634-line spec is not dead code) and the purge shrinks by 244+55 lines;
(c) port the 24 cases onto `src/server/authorization/v1-policy.ts` (the file §1.1 says is the live
path — verified: `v1-policy.ts` exists and its only consumers are
`src/application/adult-portal/service.ts`, `src/application/player-access/service.ts`,
`tests/unit/v1-authorization.test.ts`, 4 cases). (c) is real work with no day assigned.
*Note:* this was **not** in the v1 review's B3 table — it is new.

**F-D2 | MINOR.** `auth.test.ts:146-154` asserts proxy protection using strings for routes Day 1
deletes (`isProtectedPathname` is prefix-table-driven, so the assertions keep passing). §7.4 stays
green while the suite documents URLs that no longer exist. Not a break; a truthfulness gap in the
gate. `src/proxy.ts`'s `/atividade/` branch (v1 review "Cleanup hygiene") is the matching leftover,
unmentioned in v2.

**F-D3 | zero @runtime exposure in tests — CONFIRMED.** `grep -rn "@runtime" tests src` → **24
import sites in 23 files, all under `src/`** (11 under `src/app/`, 12 under `src/components/`, one of
which is `src/components/portal/use-demo-portal.ts`);
**no test file imports `@runtime/*`**, and `vitest.config.mts:11-13` aliases only `@` → `./src/`
(plus `env.APP_RUNTIME_MODE = "demo"`). So Day 2's alias removal cannot break a test directly —
good news the plan should state, since it is the only reason Day 2 is even tractable. It also means
**the demo twins are never typechecked or tested through the alias contract** (v1 review M2's real
defect), and §7 does nothing about it.

### D3. §2.3's "Verified Lines" column is not one measurement method

| §2.3 row | Plan | `wc -l` (HEAD == worktree for all 8) | non-blank |
| :-- | --: | --: | --: |
| `activity-builder.tsx` | 244 | **256** | 244 ✓ |
| `activity-controls.tsx` | 147 | **156** | 147 ✓ |
| `material-editor.tsx` | 252 | **266** | 252 ✓ |
| `class-groups-explorer.tsx` | 228 | **237** | 228 ✓ |
| `materials-explorer.tsx` | 120 | **132** | 124 ✗ (matches neither) |
| `share-actions.tsx` | 147 | **147** ✓ raw | 139 |
| `public-state.tsx` | 36 | **36** ✓ raw | — |
| `portal-view-service.ts` … `tokens.ts` (9 rows) | as printed | **all 9 exact** | — |

**F-D4 / F17 | MINOR but diagnostic.** Blank-stripping explains 4 rows; the next 2 use raw `wc -l`;
1 row matches nothing. The column is labelled "Verified Lines" and is not reproducible by a single
command — the same defect propagates into §7.1, which has no defined counting method at all (F-E1).

### D4. §2.5's headline does not equal §2's own manifest

Measured `wc -l` over all 28 §2 paths: routes **1,681** (§2.2's six rows verified individually:
1,188 / 92 / 23 / 7 / 7 / 364 — **all exact**, including "a 517-line action file" =
`atividades/actions.ts` 517 ✓) + §2.3 files **3,413** + §2.4 tests **1,956** = **7,050**.
The plan's printed column totals sum to **6,994**.

**F-D5 / F16 | MINOR (accuracy), MAJOR (credibility).** > **§2.5: "Total Impact of the Purge:
~6,450 lines of dead code removed instantly." — WRONG.** Understatement of ~600 lines (8.5%) against
its own rows. Cause is traceable: v1 review M1 recomputed a 7,000 claim as "**~6,447** actual" for
v1's *smaller* manifest; v2 then added `share-actions`/`tokens`/`activity-mark`/`public-state`/
`authorization-service`/`prisma-capability-reader` to §2.3 (v1 review B3's "under-lists" list)
and **kept the 6,447 total**. The number now describes a manifest that no longer exists.

### D5. §2's self-containment **is** sound for components — CONFIRMED (a real strength)

Every §2.3 component grepped for importers outside the delete set:
`activity-builder` ← only `atividades/{nova,[id]/editar}` (deleted) · `activity-controls` ←
`atividades/[id]` · `activity-mark` ← `atividades` · `material-editor` ← `materiais/{novo,[id]/editar}` ·
`materials-explorer` ← `materiais` · `share-actions` ← `atividades/[id]/compartilhar` +
`activity-builder` · `public-state` ← only `(public-play)/atividade/[token]/**` ·
`class-groups-explorer` ← **zero importers at all** (already orphaned).
Surviving consumers of `portal-view-service.ts`: only `admin/auditoria/page.tsx:4` and
`status-badge.tsx:1` — exactly the two §2.1 relocations. **§2.1(1)'s "6 active importing screens"
is CONFIRMED exactly** (`status-badge` has 13 importers, 7 of which are in the delete set, leaving
`class-detail-screen`, `classes-screen`, `organization-detail-screen`, `organizations-screen`,
`overview-screen`, `team-screen`). *Nit (MINOR):* those 6 screens never import `ActivityStatus`
themselves — the only surviving type consumer is `status-badge.tsx:1` (`grep -rln ActivityStatus src`
→ 4 files, 2 of them deleted), so §2.1(1) over-specifies the reason while getting the action right.

---

## PART E — §7 CRITERIA MEASURABILITY (check 6)

### E1. Criterion 1 — "Zero files over 400 lines (excluding third-party schemas and `idb-store.ts`)"

Measured (`find src tests -name '*.ts|*.tsx|*.mts|*.css' -not -path 'src/generated/*' | xargs wc -l`,
threshold >400): **17 files.**

| File | Lines | Covered by |
| :-- | --: | :-- |
| `src/components/portal/portal.module.css` | 4,910 | §4.1 |
| `src/runtime/game-offline-sync.ts` | 1,222 | §4.2 |
| `src/components/public/game-host.tsx` | 932 | §4.3 |
| `src/application/adult-portal/service.ts` | 616 | §4.4 |
| `tests/unit/access-link-service.test.ts` | 1,625 | §2.4 (deleted) |
| `src/server/services/access-link-service.ts` | 717 | §2.3 |
| `src/server/services/portal-view-service.ts` | 521 | §2.3 |
| `src/app/(professional)/portal/atividades/actions.ts` | 517 | §2.2 |
| `src/runtime/adult-portal-demo-store.ts` | **1,024** | §3.3 says "refactor into a clean adapter", **no split, no target size** |
| `src/components/public/public.module.css` | **1,017** | **nothing** |
| `tests/unit/game-offline-sync.test.ts` | **728** | **nothing** (and §4.2 breaks its import — F-E3) |
| `src/components/marketing/marketing.module.css` | **688** | **nothing** (also `M` in the worktree) |
| `tests/unit/authorization.test.ts` | **634** | **nothing** (and F2 deletes its subject) |
| `src/components/portal/player-access-workflow.tsx` | **540** | **nothing** (newest screen, 10 `@runtime` imports at `:22`) |
| `src/contracts/v1/schemas.ts` | **481** | ambiguous — is this "third-party schemas"? hand-written zod, no `@generated` marker |
| `src/server/db/prisma-adult-portal-store.ts` | **467** | **nothing** |
| `src/components/portal/team-screen.tsx` | **411** | **nothing** (also `M`) |

**F-E1 / F6 | MAJOR — the criterion is unmeasurable as an acceptance gate *and* implies ~8 unplanned
decompositions.** §2+§4 account for 8 of 17; **9 files remain over the ceiling with no task in any
section** (one of them, `authorization.test.ts`, may itself vanish via F2 → still 8). Three of the 9
are `public.module.css` (1,017) and `marketing.module.css` (688) — §4.1 is titled
"CSS Restructuring (`portal.module.css`)" and never mentions the other two, which are 1,705 lines of
monolith CSS living in `src/components/` (repo total CSS = 7,337 lines across 6 modules). Two of the 9
are test files, so the criterion silently requires test splitting the plan nowhere budgets; and the
criterion never states whether it counts CSS, tests, `src/` only, or worktree-vs-`git ls-files`.
**No measurement command is defined for §7.1 or §7.3** → the gate is arguable at acceptance time,
which is the definition of a gate that cannot catch a regression.
*Cross-reference:* identical 9-file list with identical line counts was produced by the v1 review
(M5) → **carried forward unfixed**, and v1 M5 also noted the repo's *own agreed budgets*
(`docs/architecture-audit-2026-09-23.md:744`: component 250/400, module 300/500, CSS 300/600, tests
400/800, "applies to new or modified files only") — §7.1 contradicts a documented team decision.

**F-E2 | MAJOR (gate is unfalsifiable).** §4's own arithmetic doesn't prove the ceiling is reached:
`§4.2` targets ~650 + ~60 + ~350 = **1,060** against a 1,222-line source (**162 lines, 13%,
unaccounted** — and `idb-store.ts` is *exempted*, not exempted-with-a-limit, so a 650→900 creep is
legal under §7.1). `§4.3` gives only "~250" for `game-host.tsx` with no sizes for the two hooks;
`§4.4` gives no numbers at all for `service.ts` (616) → presenter + 3 services + guards.
`§4.1`'s "~1,570 lines of dead CSS" is a v1-review-disputed figure (agent disagreement 947 vs 1,572).

### E2. Criterion 5 / Day 4 — "assert no `api/` in `out/`"

**F-E3 / F5 | MAJOR — the assertion is already true today; it cannot detect a regression.**
Measured:
- `out/` **exists**, 554 files, `.gitignore:7` `/out` → `git ls-files out` returns **nothing** (CI
  rebuilds it from scratch, which is correct).
- Freshness: `find src tests prisma/schema.prisma next.config.ts -newer out/index.html` → **empty**;
  the artifact was produced *after* every current edit, i.e. **`npm run build:demo` succeeds today,
  on the dirty tree, with all 9 aliases and all 4 `src/app/api/v1/player/**` route handlers present.**
- **`ls -d out/api` → "No such file or directory".** Top level: `404/ 404.html  _next/  _not-found/
  atividade/  entrar/  index.html  index.txt  jogar/  portal/  favicon.ico  icon.svg  .nojekyll
  .gitkeep  __next.*.txt`.
- The deleted-route trees **are** present in the export: `out/portal/atividades`,
  `out/portal/materiais`, `out/portal/modulos`, `out/portal/admin/jogos`, `out/portal/admin/modulos`,
  `out/atividade/2KF-81P/**` (a real token page emitted by `generateStaticParams()` — 15 such
  functions exist, 8 of them in trees §2 deletes).
- `grep -rl "api/v1" out` → **1 hit** (`out/_next/static/chunks/0pvtinj9q2oay.js`): client code still
  references the API path string even though no handler is exported.

So Day 4's only structural assertion about the demo passes **before** Day 1 starts, and will pass
after Day 4. It is a **MISSING-gate substitute**: the assertions that would actually catch the
regressions this refactor can cause are none of — `test ! -d out/api` but:
`! -d out/portal/atividades && ! -d out/portal/materiais && ! -d out/portal/modulos &&
! -d out/atividade` (proves §2.2 really left the export), a **pre/post file-count and route-manifest
diff** of `out/` (proves the purge removed 6 trees and the seam added none), a `grep -c` for
`"/SMS_Portal/"` asset prefixes in `out/index.html` (proves base-path rewriting survived the alias
change — see F-F3), and a byte budget on `out/_next/static` (a dual-runtime seam that fails to
tree-shake ships *both* stores to the browser). None of these appear in §6 or §7.

### E3. Criterion 3 / Day 4 "builds execute cleanly" and criterion 4 "CI on every PR"

**F-E4 / F4 | BLOCKER (unstated prerequisite).** §7.3 demands `npm run build:server` run cleanly and
§7.4 wants CI to "verify builds on every PR". `build:server` sets `APP_RUNTIME_MODE=server`
(`scripts/next-target.mjs:26-29`) → `next.config.ts:10-18` **hard-fails on a zod parse** unless
`DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `APPLICATION_SECRET` are present
(the last two with `min(32)`). `deploy.yml` never builds the server target, so GitHub Pages secrets
are not currently needed. **The plan contains no step to provision GitHub Actions secrets (or to
stub them with valid-shaped dummies), and no step to decide whether `build:server` belongs in PR CI
at all.** Practical consequence: the executor adds `npm run build` to CI (note: `npm run build` is
`build:server`, `package.json:12`), sees a red pipeline for an environment reason, and either drops
criterion 3 or leaks a real Neon URL into a public-repo workflow. §7.4 as written is therefore
**not achievable inside Day 1's Phase 0** without a decision the plan defers to nobody.
*Judgment (not measured): a shape-valid dummy env (`DATABASE_URL=https://example.invalid`, 32-char
secrets) is enough for `next.config.ts`'s zod gate to pass a *compile*, since `src/server/db/client.ts`
builds the Neon adapter lazily (v1 review M8) — but that is an assertion the plan should make
explicitly, not an accident.*

### E4. Criterion 5 "Functional Demo" and §7.4 "100% passing tests" — automation behind them

**F-E5 / F19 | MAJOR.** `find tests -type d` → **`tests` and `tests/unit` only**. No `e2e/`, no
`integration/`. `grep -n "playwright\|cypress\|supertest" package.json` → nothing.
`vitest.config.mts:12` `environment: "node"` — so no DOM, no `window.localStorage`, no IndexedDB
harness for the browser paths that §3.3 and §4.2 are rewriting (`adult-portal-demo-store.ts` uses
`window.localStorage`; `game-offline-sync.ts:567` uses `factory.open(DATABASE_NAME,
DATABASE_VERSION)`). Criteria 5's "fully operational in-browser navigation, local persistence, and
mock interactions" is **100% manual QA**, and §6 budgets it half a day inside which the same day also
runs two builds and the CI fix.
**F-E6 / F11 | MAJOR.** §7.4 "Run `npm test` and ensure 100% passing tests for active code" measures
the wrong variable. There is no coverage script (`test` is `vitest run`, no `--coverage`, no
thresholds) and no assertion-count baseline. Deleting 78 of 236 cases **raises** the health signal of
the suite. A regression-catching version of this gate is mechanical: record
`grep -rcE "^[[:space:]]*(it|test)\("` + total test LOC at Day 0, commit it as the baseline, and
require Day 4 to explain the delta per file. That costs one line of the roadmap and is the only gate
in §7 that would have caught F2 and F-D2 on its own.

---

## PART F — SEQUENCING / DEPENDENCY AUDIT OF THE 4 DAYS (check 5)

### F0. Where the verification steps actually are (measured from §6)

| Day | Bullets | Verification step present |
| :-- | :-- | :-- |
| 1 | Phase 0, pre-relocation, purge, schema, **`prisma validate` + `typecheck`** | **yes — the only one before Day 4** |
| 2 | seam, action entry points, demo store, remove 9 aliases, tsconfig exclude | **none** |
| 3 | split CSS, split offline-sync, split game-host, move navigation | **none** |
| 4 | `build:demo` + assert, `build:server`, `npm test`, "CI green" | 4 |

**2 of 4 days ship no check.** `typecheck` (`tsc --noEmit`) cannot see: Turbopack alias resolution
(the demo twins are never resolved — v1 review M2), `"use server"`-under-export rejection
(`node_modules/next/dist/docs/01-app/02-guides/static-exports.md:275-294`, "Server Actions" listed as
unsupported, error at build), CSS-module class removal (§4.1's whole subject), or the Pages base path.
So Day 1's gate is **not** a stand-in for a build gate, and Day 2–3 changes are unverified until
Day 4.

### F1. Day 1 cannot finish green (F1, F2 above). Order is right, the manifest is short

§2.1's "Must Happen BEFORE Purge" *is* honoured inside Day 1's bullet order (pre-relocation precedes
delete), so the `ActivityStatus` question posed by this review's brief resolves as **correctly
sequenced**. The failure is completeness, not order:

**F-F1 / F1 | BLOCKER — MISSING from §2.1.** §2.1(3): "Remove `PrismaAccessLinkStore` and
`AccessLinkService` imports from `src/server/services/service-container.ts`." Measured,
`service-container.ts` (45 lines) also imports, at `:1` and `:4`, `PrismaCapabilityReader` and
`AuthorizationService` — **both in §2.3's deletion list**. So Day 1 leaves a live module importing two
deleted files → `TS2307` at the exact step §6 calls its gate. Worse: `grep -rln service-container
src tests` shows its **only** consumers are `atividades/actions.ts` (deleted §2.2) and
`portal-dev-bypass-actions.test.ts` (deleted §2.4), so after the purge the whole 45-line composition
root is unreachable dead code in a plan whose §1.1 complaint is dead code. Correct action is
**`git rm src/server/services/service-container.ts`** (and note that `game-state-container.ts` /
`game-event-container.ts`, the V1 equivalents, are untracked and are *not* being deleted — so
composition survives via a different, unmentioned container pair). Two extra bullet-level fixes to
§2.1 close F1 and F2.

### F2. Day 2's alias removal has no replacement mechanism — the plan's hardest stop

**F-F2 / F3 | BLOCKER — §6 Day 2 + §3.1 + §7.2 not executable as written.**
The aliases are not an aesthetic layer; they are the only **compile-time selector** that lets one
`"use client"` module resolve either a Server Action or a plain client function. Traced end-to-end:

```
src/components/portal/classes-screen.tsx:1        "use client"
src/components/portal/classes-screen.tsx:12       import { createClassAction } from "@runtime/adult-portal-actions"
src/components/portal/classes-screen.tsx:90       <AdultPortalForm action={createClassAction} …>
src/components/portal/adult-portal-form.tsx:1     "use client"
src/components/portal/adult-portal-form.tsx:24    action: PortalMutation
src/components/portal/adult-portal-form.tsx:31    const [state, formAction, pending] = useActionState(action, initialState)
src/app/(professional)/portal/adult-portal-actions.ts:1   "use server"
src/runtime/adult-portal-demo-actions.ts:1                "use client"
next.config.ts:43-79                           turbopack.resolveAlias → demo twin | server twin
tsconfig.json:24-42                            the same 9 keys, pointing only at the SERVER side
```

If Day 2 deletes both alias sets (as §6/§7.2 require) while `classes-screen.tsx` still renders
`<AdultPortalForm action={…}>`, the seam must resolve to *one* module. Importing the `"use server"`
twin into the demo export re-creates E625 (`static-exports.md:291`); importing the client twin into
the server build silently ships mutation logic to the browser. §3.1's step 2 ("consume action handlers
passed through the composition seam") does not name a mechanism, and **a server component cannot pass
a plain function as a prop to a client component**, which is what a props-only seam requires in demo
mode. So Day 2 is blocked on an architectural decision §6 assumes was made. Options the plan should
pick from (each with a different day cost): (i) a `contracts.ts` module exporting
`getActions(): Promise<ActionSet>` that branches on `getRuntimeMode()` and `await import()`s the twin;
(ii) a thin HTTP/`fetch` action transport so the client never imports a Server Action (works in both
targets, needs a handler for demo → `localStorage`, i.e. real new code); (iii) keep exactly **one**
build-time alias (a single `@runtime/actions` key) and delete the other eight — which satisfies §7.2's
letter only if §7.2 is reworded, because it still is a "file-swapping alias in `next.config.ts`".
**Judgment, stated as such: I did not run a build (read-only mandate), so this is a static-analysis
conclusion from the code above plus Next's own doc; the prior audit reached the same shape of
conclusion in B1 without running one either.** This is precisely the kind of decision a per-day build
gate exists to surface — and Day 2 has none.

### F3. Cross-day dependency and double-churn map (measured)

| §6 step | Depends on work scheduled later / collides | Evidence |
| :-- | :--- | :-- |
| Day 1 purge | §2.1 incomplete (F1), §2.4 incomplete (F2), drop-migration missing (F4) | `service-container.ts:1,4`; `authorization.test.ts:9`; `0_init/migration.sql` |
| Day 1 "Update prisma/schema.prisma … Run prisma validate" | **No migration step.** `access_links` + `rate_limit_buckets` + `CREATE TYPE "capability" AS ENUM ('link:view','link:manage',…)` are baked into `prisma/migrations/0_init/migration.sql:8`; `1_add_paused_at/migration.sql` touches `access_links`. `prisma validate` cannot see that schema and migrations then diverge, and §6 never runs `migrate dev`/`migrate diff`. **v1 review B4's second half is still unfixed.** 7 migration dirs exist; 2 (`4_`, `5_`) untracked. | measured; `package.json` has no `prisma:*` migrate script |
| Day 1 schema edit | Requires `prisma generate` **again** to be meaningful. `postinstall` only runs it at install. Stale `src/generated/prisma/**` (24 `.ts` files, 29,722 lines, incl. `models/AccessLink.ts` 1,711) keeps `@/generated/prisma` imports resolvable → **a green Day-1 `typecheck` cannot prove the schema change compiled.** Gate must be `prisma validate && prisma generate && tsc --noEmit`. | `git check-ignore` → `/src/generated/prisma` at `.gitignore:27`; import counts below |
| Day 2 "Refactor Demo Store … atomic rollbacks" | Breaks/needs-update 4 test files (23 cases): `adult-portal-service.test.ts`, `demo-player-access.test.ts` (also imports `player-access-demo-actions`), `demo-portal-helpers.test.ts`, `demo-professional-creation.test.ts` — all import `@/runtime/adult-portal-demo-store`. Not in §6. | grep, per-file |
| Day 2 "Remove @runtime/* aliases" | Requires touching the **same 23 files / 24 sites** that Day 3 then re-splits (`game-host.tsx:24` is both an alias importer and the §4.3 target; `team-screen.tsx:16`, `classes-screen.tsx:12`, `organizations-screen.tsx:14`, `organization-detail-screen.tsx:8`, `player-access-workflow.tsx:22` are alias importers *and* §4.1 CSS-extraction targets). **Judgment: ~2× churn on 23 files because CSS extraction and seam rewriting are on opposite days.** | measured |
| Day 3 "Split game-offline-sync.ts" | `tests/unit/game-offline-sync.test.ts:16` imports `@/runtime/game-offline-sync` (728 lines, 7 cases) and `game-host.tsx:31` imports the same → both must be repointed; §6 doesn't say, and the test also stays >400 lines (F6). Consumers are only those 2, so this split is cheap — but only if stated. | grep |
| Day 3 "Move navigation … to `src/components/portal/portal-navigation-presenter.ts`" | Directionally right (`grep "@/components" src/application` → **zero hits**: the application layer is clean today; `getShell()` at `service.ts:121` builds `navigation` at `:140-205`). Partial destination already exists: `adult-portal-helpers.ts:126` holds `isPortalNavigationItemCurrent` and `tests/unit/portal-navigation.test.ts:3` imports it from `@/components/portal/adult-portal-helpers`. §4.4 doesn't mention it → likely a second navigation helper. | measured |
| Day 4 "Verify full CI pipeline" | Depends on F4 (secrets) and F9/B1 (PR trigger). Day 4 is the first day a `build:demo` is run — 3 days after the tree started changing. | |
| **Longest non-compiling window** | **Day 2's alias removal.** From the moment `next.config.ts:43-79` + `tsconfig.json:24-42` are deleted, `build:demo` fails (E625 or unresolved `@runtime/*` under Turbopack), `build:server` fails, and `typecheck` fails with 24× `TS2307` across 23 files — and no gate is scheduled before Day 4 to prove otherwise. Duration under §6's literal ordering: **rest of Day 2 + Day 3 + until Day 4's first build ≈ 1.5–2 days of a 4-day plan (38–50%)**, vs Day 1's purge which is red only for `typecheck` (fixable in hours once F1/F2 are in the manifest). §1.2's "accept a **temporary** build break" is accurate only if the break is measured in hours, not in half the sprint. | reasoning over measured import counts |

### F4. Recommended ordering (the plan's day count survives; the contents move)

**Day 0 (half day, inside Phase 0 — call it the baseline commit):**
1. `git add` + commit in **two** commits: (a) the 5,090 untracked lines incl. `prisma/migrations/4_`,`5_`
   **together with `prisma/schema.prisma`** so schema and migrations never separate; (b) the 33
   modified files. Confirm `git status --short` empty and `git ls-files prisma/migrations | wc -l == 7`.
2. Record the gate baselines **in the repo**: file list + `wc -l` >400 (17), test-case count (236),
   test LOC (6,579), `out/` file count (554) and top-level dir manifest
   (`portal/atividades … out/atividade/2KF-81P` present), `npx tsc --noEmit` error count, ESLint
   warning count, and (if a DB is reachable) `prisma migrate diff --from-migrations --to-schema-datamodel
   --exit-code` — this is the only gate that detects migration drift.
3. Add **`ci.yml`** (`pull_request` + `push: main`) running `npm run check` (= format:check + lint +
   typecheck + test) + `prisma validate` + `prisma generate` + `build:demo` with the api-free/`out/`
   manifest assertion. Keep `deploy.yml` deploy-only. Decide `build:server` in CI explicitly: either
   add shaped dummy env or document that criterion 3's server half is local-only (F4). Do all CI work
   on a branch so `main`'s Pages deploy (F15) is never fed a red build.

**Day 1 — purge, with the manifest repaired:** §2.1(1) `ActivityStatus`, §2.1(2) **delete** the
auditoria page or state that audit is deferred-with-no-writer (F5), §2.1(3) → **delete
`service-container.ts` outright**, add `authorization.test.ts` decision (F2), then delete, then
`schema.prisma` + `Capability.LINK_VIEW`/`LINK_MANAGE` + **create the drop migration** +
`prisma validate && prisma generate && rm -rf .next .next-demo-dev tsconfig.tsbuildinfo && npm run
typecheck && npm test && npm run build:demo`. Gate at end of Day 1, not Day 4.

**Day 2 — seam:** pick the mechanism (F3 options i/ii/iii) **in writing first**, then
`contracts.ts` + demo store + **its 4 test files** + atomic alias removal (all 9, both configs, one
commit) + tsconfig `src/generated/**` exclude. Gate: `build:demo` **and** `build:server` **and**
`npm test`, same day, before touching CSS.

**Day 3 — decompositions:** offline-sync (with `game-offline-sync.test.ts:16` repoint), `game-host`
(+ `demo-game-adapter.tsx` dedup), navigation presenter, CSS (now including
`public.module.css` 1,017 and `marketing.module.css` 688, or amend §7.1's ceiling). Gate after each
file, not after the day.

**Day 4 — verification & docs:** rebuild `out/` from clean, run the manifest diff against the Day-0
baseline (proves the 6 trees left and nothing else appeared), assert no `api/`, **plus** a base-path
check, browser smoke checklist for the demo (F19's manual substitute), then update the 8 markdown
artifacts (F20) and README's verification contract (`README.md:94-100`).

### F5. §2.1(2) is a false choice (audit has no writer after the purge)

**F-F3 / F13 | MAJOR — WRONG as written.** §2.1(2): "Repoint `admin/auditoria/page.tsx` to read from
the real `AuditEvent` table, **or** remove the page". Measured, the **only** `auditEvent` write in the
repo is `src/server/db/prisma-access-link-store.ts:325-326` (`async recordAudit(…) { await
this.client.auditEvent.create(…) }`), driven by 7 call sites in `access-link-service.ts`
(`:294,350,415,473,514,553,644`) — **all three files are in §2.3's delete list**. No surviving V1
path writes audit rows (`src/server/db/prisma-{adult-portal,player-access,game-state,game-event}-store.ts`
→ zero `auditEvent` hits). So option (a) "repoint to the real AuditEvent table" yields a permanently
empty screen while `model AuditEvent` (`schema.prisma:281`) and `Capability.AUDIT_VIEW`
(`:23`) survive. The plan must state the third option — "ship a V1 audit writer" — or accept removal
and delete the model too. Related: `portal-view-service.ts:416 export const auditEvents = demoRuntime
? demoAuditEvents : []` is *why* §1.1's "in server mode causes pages to render empty" claim about the
auditoria page is **CONFIRMED**.

### F6. §3.2's stated benefit is not delivered by the stated change

> §3.2 "Optimization: Add `src/generated/**` to `tsconfig.json`'s `exclude` array. **Benefit:**
> TypeScript stops scanning the 29,722 lines of generated code, while all 42 surviving imports of
> `@/generated/prisma/enums` remain functional with zero file rewrites."

Measured: 29,722 lines across 24 `.ts` files ✓ **exact**; `generator client { provider =
"prisma-client"; output = "../src/generated/prisma" }` at `schema.prisma:1-3` ✓ (B2's constraint
correctly carried); imports remaining — `@/generated/prisma/enums` = **31**, `@/generated/prisma*` =
**35 across 34 files** → **"42" is WRONG (overstated ~27–35%)**; and `tsconfig.json` currently has
**no `exclude` array with `src/generated` at all** (`"exclude": ["node_modules"]`, line 55), so the
generated tree is a root today. **F-F4 / F21 | MAJOR — PARTIAL.** *Judgment:* `include`/`exclude`
select only *root* files; modules reached by import resolution are added to the program regardless,
and `skipLibCheck: true` covers `.d.ts` — but **all 24 generated files are `.ts`** (`find src/generated
-type f | sed 's/.*\.//' | sort | uniq -c` → `24 ts`, zero `.d.ts`). Therefore excluding them removes
them as roots while `client.ts`/`enums.ts`/`models.ts` stay in the program through the 35 imports, and
the scanning cost is largely unchanged. The change is still worth making (IDE indexing,
`tsbuildinfo` roots), but if §7.3's "Tooling Health" was expecting a faster `typecheck`, it will not
get one, and no before/after timing is budgeted anywhere in §6.

### F7. GitHub Pages base path — a live risk with no gate

`next.config.ts:28-38` sets `output: "export"` + `basePath: "/SMS_Portal"` **only when phase ≠
development**, and injects `env.APP_BASE_PATH = "/SMS_Portal"` for that same case, `""` otherwise.
Consumers: `src/app/page.tsx:1`, `src/components/portal/adult-portal-helpers.ts:126`,
`src/components/portal/player-credential-print-sheet.tsx:21`. So the same code produces different
absolute URLs in `dev:demo` vs `build:demo`, and the QR **print sheet** embeds base-path-dependent
URLs — the single most user-visible demo artefact. §6 Day 4 verifies the export structurally
(`assert no api/`) and §7.5 asserts behaviour, but **nothing asserts the base path**, and there is no
`APP_BASE_PATH` test in `tests/` (measured: grep over `src scripts next.config.ts` returned only those
4 sites, none in `tests`). **MAJOR (unstated risk) / MISSING (gate).**

### F8. IndexedDB versioning under the §4.2 split

`game-offline-sync.ts:565-575`: `factory.open(DATABASE_NAME, DATABASE_VERSION)` with an **additive-only**
`onupgradeneeded` (`if (!db.objectStoreNames.contains(…)) createObjectStore(…)`) and
`db.onversionchange = () => db.close()` (`:618`) — i.e. no data-transform path, no downgrade handling.
§4.2 moves this into `idb-store.ts` and §7.1 **exempts `idb-store.ts` from the 400-line ceiling**, so
the one file whose schema versioning can silently discard a child's queued results is the one file
with both no size limit and no stated version policy. §6/§7 never mention `DATABASE_VERSION`.
**MINOR as a schedule risk, MAJOR as a product risk; the exemption should carry a condition**
("`idb-store.ts` exempt only if `DATABASE_VERSION` is unchanged by the refactor").

---

## PART G — RISK REGISTER THE PLAN DOES NOT MENTION (check 7)

Legend: **exposure** = verified present today; **plan** = mentioned in §6/§7 (or §1–§5).

| # | Risk | Exposure verified | Plan mentions | Severity |
| :-- | :-- | :-- | :-- | :-- |
| R1 | Unapplied / untracked Prisma migrations; schema ahead of migration history | `prisma/migrations/4_v1_game_state/`, `5_v1_game_events/` **untracked**; worktree schema has `GameState:182`/`ResultEvent:196`/`ActiveTimeEvent:216` absent from `git show HEAD:prisma/schema.prisma`; no `migrate` npm script; no `migrate diff` gate | **No** (B4's migration half carried unfixed from v1 review) | **MAJOR** |
| R2 | No integration/E2E layer for the two criteria that describe behaviour | `tests/` = `unit` only; `environment: "node"`; no playwright/cypress/supertest | **No** (§7.5 presumes it, §1.1 mentions "lack of integration tests" only in §5.3's passing aside) | **MAJOR** |
| R3 | Offline IndexedDB versioning/data loss across the §4.2 split | `game-offline-sync.ts:567` + additive `onupgradeneeded:568` | **No** | MINOR→MAJOR (product) |
| R4 | Pages base path / asset prefix (`/SMS_Portal`) and `dev:demo` vs `build:demo` divergence | `next.config.ts:28-38`, 3 consumer sites, 0 tests | **No** (only §3.4's mode.ts default, unrelated) | **MAJOR** |
| R5 | `src/generated` gitignored → CI correctness rides on `postinstall: prisma generate`; stale client defeats the typecheck gate | `.gitignore:27`; `package.json:25`; generated tree 29,722 lines incl. `models/AccessLink.ts` | §3.2 mentions the path, **not** the CI/generate dependency | MINOR |
| R6 | `build:server` in CI needs 4 secrets | `next.config.ts:10-18` zod hard-fail; `deploy.yml` never builds server | **No** | **BLOCKER** (F4/E3) |
| R7 | `.env` secret leakage | **Clean**: `.gitignore:13-14`, `git ls-files` shows only `.env.example`, `git log --all -- .env` empty; `.env.example` holds placeholders only; `scripts/next-target.mjs:41-53` blanks 7 secrets for demo | §3.4 states the blanking correctly | none (confirmatory) |
| R8 | `tsconfig.tsbuildinfo` / `.next/types` staleness making local gates lie | `incremental: true`; `tsconfig.json:47-55` includes `.next/types/**`, `.next-demo-dev/types/**`; both dirs present; `tsconfig.tsbuildinfo` 356,779 B (gitignored) | **No** | MINOR |
| R9 | Stale `out/` reused for Day 4's assertion (554 files, includes 6 deleted-route trees + a real legacy token page) | measured, and `-newer` shows it matches the worktree | **No** clean step in §6 | MINOR (fixed by `rm -rf out` before assert) |
| R10 | Docs that document deleted routes/models | 8 files, ~46 mentions: `walkthrough.md` 13, `implementation_plan.md` 13, `DESIGN.md` 6, `docs/schemas/database-model.md` 5, `docs/implementation/v1-architecture-plan.md` 4, `portal-v1-specification.md` 3, `docs/current-architecture.md` 2; plus `docs/implementation/phase-02-activity-configuration.md` = a whole phase doc for a deleted feature | **No** (v1 review M11; unfixed) | MINOR→**MAJOR** for a "textbook Clean Architecture" claim |
| R11 | Feature-completeness assumption: §2.2 says atividades "replaced by" V1 | I did not re-adjudicate (out of scope); v1 review M11 found activity **creation** has no V1 counterpart and `/jogar` server-mode renders `gameClient.status === "missing"`. `src/app/(public-play)/jogar/page.tsx` is `M` right now | **No** | **MAJOR** (inherited, unresolved) |
| R12 | 43% of the assertion base disappears with no retention gate | 78/236 planned + 24 at risk (F2) | §7.4's wording ("for active code") actively permits it | **MAJOR** (F11) |
| R13 | `@runtime` twins are never checked against each other | `tsconfig.json:24-42` = server side only; `next.config.ts:43-79` swaps; drift example: `src/runtime/demo-auth-actions.ts` has **no directive** and only `throw`s, vs `entrar/actions.ts` taking `FormData` | §1.1's "TypeScript vs Turbopack split-brain" gesture; **no acceptance criterion** | MINOR (diagnosis, v1 M2) |
| R14 | The audit corpus and the plan itself are uncommitted | `?? REFACTOR_PLAN.md`, `?? docs/agent-reviews/`, `?? docs/architecture-audit-2026-09-23.md` | **No** | MINOR |

---

## PART H — WHAT §6/§7 GET RIGHT (keep, and don't re-litigate)

1. **§7.3's four script names are exact and exist** — `build:demo`, `build:server`, `typecheck`,
   `test`; `lint` exists too (`package.json:16-20`). CONFIRMED.
2. **Node/engines/Pages-version alignment is perfect** (`.node-version` == `.nvmrc` ==
   `engines.node` == `deploy.yml:26` = `24.19.0`), lockfile committed, `cache: "npm"` valid.
   CONFIRMED (v1 review §4.9 re-verified).
3. **§6 Day 1's internal order is correct** — §2.1's "must happen BEFORE purge" is reflected in the
   bullet order, and the `ActivityStatus` relocation is genuinely required (only surviving consumer
   `status-badge.tsx:1`, feeding exactly 6 surviving screens). CONFIRMED.
4. **§2's delete-set is closed over the survivor graph** for every §2.3 component (D5 above) and every
   §2.2 route tree; `class-groups-explorer.tsx` is already orphaned. CONFIRMED.
5. **§2.2's line counts are exact to the digit**, including "a 517-line action file". CONFIRMED.
6. **§2.4's five test files and their case counts are exact.** CONFIRMED (all five).
7. **§2.5's schema line references (`:65`, `:80`) match the worktree exactly**, and dropping the two
   inverse relations is genuinely required for `prisma validate`. CONFIRMED (B4's first half, fixed).
8. **§3.4's two statements are both true**: `next-target.mjs` does blank secrets + set `NODE_ENV`
   (measured, `:26-53`) and `src/runtime/mode.ts:3,10` really has no default so it throws when
   `APP_RUNTIME_MODE` is unset. CONFIRMED — the only §3.4-adjacent leftover is `next.config.ts:7`
   parsing the same enum with no default (affects bare `npx next dev`/`next build`/`next test`-less
   tooling), which the plan doesn't name.
9. **§1.1's "9 `@runtime/*` build-time path aliases"** — exactly 9 in both config files. CONFIRMED.
10. **§4.1's "68 design tokens"** in `globals.css` `:root` — exactly 68, all inside the single `:root`
    block (`globals.css:1`). CONFIRMED (independent re-measurement).
11. **§5's Tailwind verdict** stays aligned with the audit's refusal; it introduces no §6 work, so it
    cannot extend the sprint. CONFIRMED by v1 review §4.7; not re-litigated.
12. **§7.2 "no `@runtime/*` file-swapping aliases in `next.config.ts`"** is the *correct* target —
    it is verifiable with a one-line grep today and will be after Day 2. Only its Day-2 *how* is
    missing (F3).

---

## Open questions for the plan author

1. **`authorization-service.ts` — keep or delete?** If deleted, what happens to
   `tests/unit/authorization.test.ts`'s 24 cases (delete / port to `v1-policy.ts` / and on which day)?
   §2.3 and §2.4 currently contradict each other and Day 1's `typecheck` gate. (F2)
2. **Is `service-container.ts` deleted or repointed?** Its only two consumers are both in §2, and
   §2.1(3) leaves imports of two deleted modules in it. (F1)
3. **Name the Day-2 seam mechanism explicitly** — dynamic `import()` behind `getRuntimeMode()`, a
   fetch/`POST` transport, or a single surviving build-time alias? A client component currently passes
   `"use server"` actions as props (`classes-screen.tsx:90` → `adult-portal-form.tsx:31`), and that
   pattern cannot compile in `output: "export"` without *some* compile-time selector. (F3)
4. **Which half of criterion 3 runs in CI?** `build:server` needs 4 real-shaped secrets on a public
   runner. Dummy-shaped env, GitHub Secrets, or drop server-build from PR CI and say so? (F4)
5. **Where is the drop migration, and who runs `prisma generate` between Day 1's schema edit and its
   typecheck?** Without them the schema change is unverified and `schema.prisma` drifts from
   `prisma/migrations/`. (F7, F-R1)
6. **Does criterion 1 count CSS modules and `tests/`?** 8–9 files remain >400 lines after §2+§4 land
   (`public.module.css` 1,017; `marketing.module.css` 688; `game-offline-sync.test.ts` 728;
   `player-access-workflow.tsx` 540; `prisma-adult-portal-store.ts` 467; `team-screen.tsx` 411;
   `adult-portal-demo-store.ts` 1,024). Also: what is the **exact command and counting method**, and is
   `src/contracts/v1/schemas.ts` "third-party"? (F6, F18)
7. **What replaces criterion 5's `assert no api/ in out/`, given it already passes today?** Can we
   instead assert a pre/post route-manifest diff of `out/` + a `/SMS_Portal/` prefix check + a
   `rm -rf out` before the build? (F5, F7)
8. **How is criterion 5 ("functional demo") verified without any browser-level test?** A written
   smoke checklist in Day 4? A minimal Playwright job? Today it is 100% manual inside a day that also
   runs two builds and fixes CI. (F19)
9. **Will Day 1–3 happen on a branch?** `deploy.yml` publishes `out/` to Pages on every push to
   `main`, so "accept a temporary build break" is a public-facing decision. (F9, F15)
10. **Auditoria: repoint, delete, or write the missing V1 audit writer?** Option (a) yields an empty
    table because the purge removes the only `auditEvent.create`. Also delete `model AuditEvent` +
    `Capability.AUDIT_VIEW`, or keep and say why? (F13)
11. **Do `Capability.LINK_VIEW`/`LINK_MANAGE` survive §2.5?** They become dead in Prisma *and* in the
    Postgres enum (`0_init/migration.sql:8`) — and Postgres enum values are not casually droppable. (F14)
12. **Is the ~6,450 figure worth correcting to the measured 7,050, and are the §2.3 "Verified Lines"
    meant to be blank-stripped or raw?** The same ambiguity is what makes §7.1 unenforceable. (F16, F17)
13. **Which day owns the 8 stale markdown artifacts and `README.md:94-100`'s verification contract?**
    `phase-02-activity-configuration.md` describes a feature §2 deletes outright. (F20)
14. **Do the 4 untracked `src/app/api/v1/player/**` handlers and the `resultados` tree belong in the
    refactor's scope at all?** They are 100% of the game contract surface, they are what criterion 5's
    api assertion gestures at, and no §2/§3/§4/§6/§7 line item names them. (F-C1)
15. **Should §3.2 stay in the plan?** If the `exclude` change yields no measurable typecheck speed-up
    (F21), it is churn on the file that also carries the F-R5 dependency.

---

### Appendix — commands used (all read-only)

`ls -la` · `find .github -type f` · `cat package.json tsconfig.json next.config.ts
vitest.config.mts eslint.config.mjs .gitignore .prettierignore prisma.config.ts .env.example
scripts/*.mjs .github/workflows/deploy.yml` · `git status --short` · `git log --oneline -15` ·
`git log -1 --format=%ad --date=iso` · `git ls-files …` · `git ls-files --others --exclude-standard` ·
`git check-ignore -v` · `git show HEAD:<path>` · `wc -l` (per-path and `find … -print0 | xargs -0`) ·
`grep -rn/-rl/-rn -c` over `src tests prisma docs .github` · `sed -n 'A,Bp'` ·
`find … -newer out/index.html` · `du -sk out`. Not run: `npm install`, `npm test`, `npm run build*`,
`tsc`, `eslint`, `prisma`, `next` — i.e. **no verdict here depends on executing a build**, and all
build-behaviour claims are labelled as static analysis against `node_modules/next/dist/docs/`.
**Facts labelled measured are reproducible with the commands above; anything marked *judgment* is not.**
