# INV-F — Gates, CI, and Demo Reality

Investigation pass on `REFACTOR_PLAN.md` v2.1 §6/§7 against the repository as it
exists at `e5aaf1e`. Read-only. No source, config, or `REFACTOR_PLAN.md` file was
modified; the only file written is this report.

---

## Baseline (measured)

### Counting method (used consistently below)

* **Lines** = `wc -l` on the file (physical, newline-terminated lines, comments
  and blanks included). This is the same unit `REFACTOR_PLAN.md` §2.2/§2.3 use in
  its "Physical Lines" columns, and every spot-check of those columns reproduced
  the exact number (see below), so the plan and this report are directly
  comparable.
* **Test cases** are reported twice: *static* = `grep -cE
  '^\s*(it|test)(\.each|\.skip|…)?\s*\('` over `tests/unit/*.ts`; *runtime* = the
  numbers vitest itself prints. The two differ because four surviving files use
  `it.each`.
* **Scope** for the ratchet scan: `git ls-files 'src/**' 'tests/**' 'scripts/**'
  '*.ts' '*.mts' '*.mjs'`, minus `src/generated/**` (Prisma-generated), minus
  `node_modules`, `out`, `.next*`, `docs`, `contracts`.
* **Category assignment**: `tests/*.test.ts` → *test*; `*.module.css` → *css*;
  `src/components/**/*.tsx` and `src/app/**/*.tsx` → *component*; every other
  tracked `.ts/.tsx/.mts/.mjs` under `src/` (incl. `src/app/**/actions.ts`,
  `src/runtime`, `src/server`, `src/application`, `src/contracts`) → *module*.
  `src/components/portal/adult-portal-helpers.ts` therefore lands in *module*
  (300/500), not *component* (250/400); it is WARN either way.

### Working-tree state

| Check | Result |
| :-- | :-- |
| `git status --porcelain` (first command run) | **empty** — clean tree |
| `git ls-files --others --exclude-standard` | **0** untracked files |
| `git status -sb` | `## main...origin/main`, no ahead/behind |
| `git rev-parse HEAD` / `origin/main` | both `e5aaf1e2891dbb1804950223eb9f0765e7dbeb65` |
| tracked files | 343 (`src` 174, `contracts` 59, `docs` 34, `tests` 33, `prisma` 8, `public` 4, `scripts` 2) |
| `prisma/migrations` | `0_init, 1_add_paused_at, 2_v1_adult_roles_and_classes, 3_slice_02_player_access, 4_v1_game_state, 5_v1_game_events` — **4 and 5 are already committed** |

**Consequence for §6 Day 0:** the step "Commit 30 untracked files + uncommitted
schema + migrations 4 & 5" (`REFACTOR_PLAN.md:210`) is **already done**. There is
nothing to commit. Day 0 has no commit work, only gate-recording and `ci.yml`.

**Note on tree cleanliness during this pass:** `git status --porcelain` later
reported `?? docs/refactor-dossier/`. That directory is this dossier; it became
non-empty because sibling investigation agents (e.g.
`docs/refactor-dossier/reports/INV-D-runtime-godfiles.md`,
`docs/refactor-dossier/CRITIQUE-governing-conflicts.md`) wrote their reports
concurrently. It is not a repo change.

### Commands executed and their disk effect

| Command | Effect on tracked files |
| :-- | :-- |
| `npm test` (`vitest run`) | **none.** `vitest.config.mts:17-19` has a `coverage` block but `npm test` = `vitest run` with no `--coverage`, so no `coverage/` is written. `grep -rn "toMatchSnapshot\|toMatchFileSnapshot\|inlineSnapshot" tests/` → **no matches**, and no `__snapshots__`/`*.snap` exist, so no snapshot files can be created. Only `node_modules/.vite` cache touched (gitignored). |
| `npm run lint` (`eslint . --max-warnings=0`) | **none.** No `--cache` flag, so no `.eslintcache`. Exit 0 in 7.4 s. |
| `npm run typecheck` (`tsc --noEmit`) | **This is the one command that can write `tsconfig.tsbuildinfo`** (`tsconfig.json:16` `"incremental": true`; tsc emits a buildinfo even with `--noEmit`). Verified **before and after**: `git check-ignore -v tsconfig.tsbuildinfo` → `.gitignore:19:*.tsbuildinfo`; the file is untracked; `md5sum` before = after = `252a0a7726f8e6d88e4fa82633cb4796`, i.e. tsc reused the incremental cache and left the file **byte-identical**. `git status --porcelain` afterwards shows only the sibling agents' `docs/refactor-dossier/`. Disclosed explicitly because the task requires it. |
| `prisma validate`, `prisma generate`, any `next build`, any migration command | **not run**, per instruction. |

### Gate baseline

| Gate | Result |
| :-- | :-- |
| `npm run typecheck` | **exit 0, 0 errors**, 2.638 s |
| `npm run lint` | **exit 0, 0 problems**, 7.406 s (`--max-warnings=0` already in place) |
| `npm test` | **33 files / 284 tests / 284 passed / 1.78 s** |
| `.next/server/server-reference-manifest.json` | 17 ids in `.node`, 0 in `.edge`, all type `server-action` — but this is the **server** build's manifest, not the demo's (see below) |
| `.next-demo-dev/dev/server/server-reference-manifest.json` | **0** ids in `.node`, **0** in `.edge` — demo dev already registers no actions |

### Runtime version reality

`.node-version` = `24.19.0`, `.nvmrc` = `24.19.0`, `package.json` `engines.node` =
`24.19.0`, `engines.npm` = `>=11.6.0 <12`, `packageManager` = `npm@11.6.0`.
The **shell used for this pass runs `node v22.23.1` / `npm 11.6.0`**, and there is
no `.npmrc` → `engine-strict` is not set, so the pin is advisory locally and was
not enforced for these numbers. CI must pin explicitly (see CI design).

### Tests directory inventory (static `it(`/`test(` → runtime count)

Method: static = `grep -cE '^\s*(it|test)(\.each|\.skip|\.todo|\.failing|\.concurrent)?\s*\(' tests/unit/<f>`;
runtime = vitest's own per-file count (`--reporter=json` written to `/tmp`, outside
the repo). `.skip/.todo/.failing/.only` search over `tests/` → **0 matches**, so
no hidden/non-running cases.

| File | static | runtime | lines | status | §2.4 purge? |
| :-- | --: | --: | --: | :-- | :-- |
| `access-link-service.test.ts` | 56 | 56 | 1,625 | pass | **YES** |
| `authorization.test.ts` | 24 | 24 | 634 | pass | **YES** |
| `access-link-tokens.test.ts` | 13 | 13 | 114 | pass | **YES** |
| `link-status.test.ts` | 5 | 5 | 66 | pass | **YES** |
| `portal-dev-bypass-actions.test.ts` | 2 | 2 | 118 | pass | **YES** |
| `portal-dev-bypass.test.ts` | 2 | 2 | 33 | pass | **YES** |
| `v1-contracts.test.ts` | 13 | **59** | 367 | pass | no |
| `auth.test.ts` | 14 | 14 | 189 | pass | no |
| `adult-portal-service.test.ts` | 11 | 11 | 264 | pass | no |
| `player-access-service.test.ts` | 8 | 8 | 381 | pass | no |
| `env.test.ts` | 7 | 7 | 78 | pass | no |
| `game-offline-sync.test.ts` | 7 | 7 | 728 | pass | no |
| `game-event-ingestion.test.ts` | 6 | 6 | 263 | pass | no |
| `game-state-service.test.ts` | 6 | 6 | 239 | pass | no |
| `demo-player-access.test.ts` | 5 | 5 | 163 | pass | no |
| `player-access-prisma.test.ts` | 5 | 5 | 203 | pass | no |
| `demo-portal-helpers.test.ts` | 4 | 4 | 90 | pass | no |
| `game-request-body.test.ts` | 2 | **4** | 55 | pass | no |
| `neon-auth-gateway.test.ts` | 3 | **4** | 76 | pass | no |
| `player-access-actions.test.ts` | 4 | 4 | 132 | pass | no |
| `player-access-security.test.ts` | 4 | 4 | 71 | pass | no |
| `player-game-bridge.test.ts` | 4 | 4 | 102 | pass | no |
| `v1-authorization.test.ts` | 4 | 4 | 124 | pass | no |
| `demo-professional-creation.test.ts` | 3 | 3 | 89 | pass | no |
| `game-client.test.ts` | 3 | 3 | 39 | pass | no |
| `http.test.ts` | 3 | 3 | 38 | pass | no |
| `player-credential-printing.test.ts` | 3 | 3 | 57 | pass | no |
| `player-entry-credential.test.ts` | 3 | 3 | 54 | pass | no |
| `portal-navigation.test.ts` | 3 | 3 | 31 | pass | no |
| `runtime-mode.test.ts` | 2 | **3** | 13 | pass | no |
| `game-host-token.test.ts` | 2 | 2 | 51 | pass | no |
| `proxy.test.ts` | 2 | 2 | 26 | pass | no |
| `game-state-prisma.test.ts` | 1 | 1 | 66 | pass | no |
| **TOTAL (33 files)** | **234** | **284** | **6,579** | all pass | |

* **284** runtime tests, **all passing**. `docs/architecture-audit-2026-09-23.md:103`
  also records "284 tests, all node environment" — the audit's test count is
  current; its line counts (5,924) are not (measured 6,579).
* **§2.4 deletion = 102 tests = 35.9 % of 284** (56+24+13+5+2+2), across 6 files
  and 2,590 lines. §2.4's "Tests" column (56/24/13/5/2/2) reproduces **exactly**.
* **Post-purge: 27 files / 182 tests.** All Prisma-touching tests are fully
  `vi.fn()`-mocked (`tests/unit/game-state-prisma.test.ts:1-11`,
  `tests/unit/player-access-prisma.test.ts:1-11`), so **the suite needs no
  database, network, or `.env`** — vitest forces `APP_RUNTIME_MODE=demo`
  (`vitest.config.mts:13-15`) and never loads `.env`.

### Source volume (excl. `src/generated`)

| Bucket | Files | `wc -l` |
| :-- | --: | --: |
| `src/**/*.ts\|tsx\|css` (excl. `src/generated`) | 172 | 27,433 |
| `tests/**` | 33 | 6,579 |
| `scripts/*.mjs` + `next.config.ts` + `prisma.config.ts` + `eslint.config.mjs` + `vitest.config.mts` | 7 | 283 |
| **handwritten total** | 212 | **34,295** |
| `src/generated/**` (excluded) | 24 `.ts` | **29,722** — matches §3.2's claim exactly |
| `src/app/globals.css` custom properties | — | **68** `--x:` — matches §4.1's "All 68 tokens" |

### Purge arithmetic (recomputed)

`wc -l` over the exact §2.2 trees + §2.3 files + §2.4 tests (46 tracked files;
`git ls-files --error-unmatch` confirms every one is tracked):

| § | Measured | Plan's own table | Delta |
| :-- | --: | --: | :-- |
| §2.2 route trees | **1,754** | 1,776 | −22 |
| §2.3 services/stores/components | **3,458** | 3,458 | exact |
| §2.4 tests | **2,590** | 2,590 | exact |
| **Total** | **7,802** | 7,824 (table) / **7,729 (stated)** | |

Two discrepancies, both small but both real:

1. `REFACTOR_PLAN.md:42` claims the auditoria tree is **95** physical lines; it is
   **73** (`wc -l src/app/(professional)/portal/admin/auditoria/page.tsx`).
2. `REFACTOR_PLAN.md:88`'s "~7,729" equals the table sum minus the auditoria row
   (7,824 − 95 = 7,729), i.e. the auditoria entry was added to §2.2 without
   re-adding it to the total. **Measured true purge volume is 7,802.**
3. "`~29 % of handwritten code`": 7,729 ÷ 27,433 (`src` only) = 28.2 % ≈ 29 %. But
   the numerator includes 2,590 test lines, which are not in that denominator.
   Against the honest denominator (src + tests + scripts = 34,295) the purge is
   **22.8 %**. The dossier should cite 22.8 % or restate the denominator.

### Deletion-manifest closure (verified, not assumed)

`grep -rn` for every deleted module over all of `src` + `tests`, excluding the
deletion set itself, returns **only files that are themselves in the deletion
set**: `admin/auditoria/page.tsx:4`, `materiais/page.tsx:3,8`,
`materiais/novo/page.tsx:1`, `materiais/[id]/editar/page.tsx:3,8`,
`status-badge.tsx:1`, `prisma-capability-reader.ts:7`. §2's "closed under its own
import graph" claim **holds**.
`service-container` consumers = `atividades/actions.ts` (×7 dynamic imports) +
`portal-dev-bypass-actions.test.ts:27` — both deleted, so §2.1(2) is correct.

Two things §2 does **not** list, found by this pass:

* **`prisma/schema.prisma:97`** — `OrganizationMembership.capabilityAssignments
  CapabilityAssignment[]` is a **third** inverse relation on a *surviving* model.
  §2.5 enumerates only `:65` (`ProfessionalProfile.createdAccessLinks`) and
  `:79/:80` (`Organization.scopedCapabilities`, `Organization.accessLinks`) and
  says only "Remove `model CapabilityAssignment`" for the rest. Omitting `:97`
  leaves a dangling type reference; `prisma validate` catches it (§5 gate note).
* **`tests/unit/auth.test.ts:146-154`** — a *surviving* test asserts
  `isProtectedPathname("/portal/atividades") === true`,
  `("/portal/atividades/nova") === true`, and
  `isProtectedPathname("/atividade/token/jogar") === false`. These are string
  literals, so nothing breaks, but the assertions become vacuous/meaningless and
  the `auth.test.ts` coverage silently shrinks. It is not in §2.4's delete list
  and no §2 pre-requisite edits it.

### Errata in §2.1(3) (proxy)

`REFACTOR_PLAN.md:32` says to remove "the dead `/atividade/` no-referrer branch
(`:109-116`)". The actual branch in `src/proxy.ts` is the comment at `:108-111`
plus the expression at **`:112-117`**, and lines **`:114-115`**
(`pathname === "/jogar" || pathname.startsWith("/jogar/")`) belong to the
**surviving** `/jogar` player route. Deleting `:109-116` verbatim would remove the
`/jogar` no-referrer policy and leave `const referrerPolicy = … : "strict…"`
malformed. The correct edit is `:113` only (drop the `/atividade/` disjunct),
keeping `:114-115`.

---

## §7.1 reachability (numbers)

### Offenders today (physical `wc -l`, budgets of §7.1)

**FAIL — 13 files**

| Level | Cat | Lines | File |
| :-- | :-- | --: | :-- |
| FAIL | css | 4,910 | `src/components/portal/portal.module.css` |
| FAIL | test | 1,625 | `tests/unit/access-link-service.test.ts` |
| FAIL | module | 1,222 | `src/runtime/game-offline-sync.ts` |
| FAIL | module | 1,024 | `src/runtime/adult-portal-demo-store.ts` |
| FAIL | css | 1,017 | `src/components/public/public.module.css` |
| FAIL | component | 932 | `src/components/public/game-host.tsx` |
| FAIL | module | 717 | `src/server/services/access-link-service.ts` |
| FAIL | css | 688 | `src/components/marketing/marketing.module.css` |
| FAIL | module | 616 | `src/application/adult-portal/service.ts` |
| FAIL | component | 540 | `src/components/portal/player-access-workflow.tsx` |
| FAIL | module | 521 | `src/server/services/portal-view-service.ts` |
| FAIL | module | 517 | `src/app/(professional)/portal/atividades/actions.ts` |
| FAIL | component | 411 | `src/components/portal/team-screen.tsx` |

**WARN — 12 files**: `game-offline-sync.test.ts` 728, `authorization.test.ts` 634,
`src/contracts/v1/schemas.ts` 481, `prisma-adult-portal-store.ts` 467,
`prisma-game-event-store.ts` 385, `results.module.css` 378,
`prisma-player-access-store.ts` 377, `prisma-access-link-store.ts` 352,
`results-screen.tsx` 341, `adult-portal-helpers.ts` 317, `material-editor.tsx` 266,
`activity-builder.tsx` 256.

Category totals: component 77 files (3 WARN / 3 FAIL), module 89 (6 / 6),
css 6 (1 / 3), test 33 (2 / 1).

### Offenders after the §2 purge (46 files removed, 166 remain)

**FAIL — 9 files**

| Cat | Lines | File | Addressed by §4? |
| :-- | --: | :-- | :-- |
| css | 4,910 | `src/components/portal/portal.module.css` | **yes** (§4.1) |
| module | 1,222 | `src/runtime/game-offline-sync.ts` | **yes** (§4.2) |
| module | 1,024 | `src/runtime/adult-portal-demo-store.ts` | **NO** |
| css | 1,017 | `src/components/public/public.module.css` | **NO** |
| component | 932 | `src/components/public/game-host.tsx` | **yes** (§4.3) |
| css | 688 | `src/components/marketing/marketing.module.css` | **NO** |
| module | 616 | `src/application/adult-portal/service.ts` | **yes** (§4.4) |
| component | 540 | `src/components/portal/player-access-workflow.tsx` | **NO** in §4 (is in audit §9 Phase 4) |
| component | 411 | `src/components/portal/team-screen.tsx` | **NO** |

**WARN — 8 files**: `game-offline-sync.test.ts` 728, `contracts/v1/schemas.ts` 481,
`prisma-adult-portal-store.ts` 467, `prisma-game-event-store.ts` 385,
`results.module.css` 378, `prisma-player-access-store.ts` 377,
`results-screen.tsx` 341, `adult-portal-helpers.ts` 317.

The purge removes 4 of the 13 FAILs and 4 of the 12 WARNs, and every deleted file
was an offender — the purge alone takes the test budget to **zero FAILs** (max
surviving test file = 728, WARN only).

### Robustness to the counting method

Recomputed with blank lines stripped (`grep -c '[^[:space:]]'`) for the 9
post-purge FAILs and the top WARN:

| physical | non-blank | file | still FAILs? |
| --: | --: | :-- | :-- |
| 4,910 | 4,214 | portal.module.css | yes (css>600) |
| 1,222 | 1,160 | game-offline-sync.ts | yes |
| 1,024 | 957 | adult-portal-demo-store.ts | yes |
| 1,017 | 889 | public.module.css | yes |
| 932 | 863 | game-host.tsx | yes |
| 688 | 598 | marketing.module.css | yes |
| 616 | 588 | adult-portal/service.ts | yes |
| 540 | 520 | player-access-workflow.tsx | yes |
| 411 | 406 | team-screen.tsx | **yes** (component fail = 400) |

`team-screen.tsx` is the only borderline case and it fails under **both** methods.
The offender set is therefore method-independent.

### Verdict: §7.1 is **not** reachable as written, and §4 is internally inconsistent

1. **Semantics.** `REFACTOR_PLAN.md:246` says "All new **or modified** files".
   The governing audit (`docs/architecture-audit-2026-09-23.md:744-746`) states
   the budgets *and the ratchet qualifier explicitly*: "Ratchet: the budget
   applies to *new or modified* files only, so the plan does not stall on
   existing offenders." Under `REFACTOR_PLAN.md:19` the audit governs, so §7.1
   must be read as a ratchet. **Under the ratchet reading §7.1 is reachable**;
   under a "global clean tree" reading it is not.
2. **Under the global reading, §4 covers only 4 of the 9 post-purge FAILs.**
   `adult-portal-demo-store.ts` (1,024), `public.module.css` (1,017),
   `marketing.module.css` (688), `player-access-workflow.tsx` (540) and
   `team-screen.tsx` (411) have **no decomposition step anywhere in §4**.
3. **§4.2's own estimate violates §7.1.** `REFACTOR_PLAN.md:165` budgets
   `offline/idb-store.ts` at **~650 lines** — that is a *module*, so it exceeds
   the 500-line **fail** threshold, and `sync-engine.ts` at ~350
   (`REFACTOR_PLAN.md:167`) is a WARN. Splitting 1,222 into 160/650/60/350 keeps
   the tree red against the ratchet the moment those files are "modified".
   The split needs `idb-store.ts` broken at least twice (e.g. schema/migrations
   vs CRUD), or the budget restated.
4. **§4.1's CSS arithmetic cannot reach WARN.** Measured dead-class analysis of
   `portal.module.css` (selector-block attribution; `composes:` count is **0** and
   there is no `@value`/`@import` in any `src/**/*.css`, so modules are
   independent; the only two dynamic `styles[…]` lookups
   (`activity-mark.tsx:22`, `materials-explorer.tsx:92`) are **both** in the
   deletion set, so no dynamic references survive to be missed):
   * already dead before the purge: 114 blocks / **665 lines**
   * dead after the purge: 296 blocks / **1,800 lines** (36.7 % of 4,911)
   * i.e. the purge newly kills **1,135 lines**, not the 1,567 claimed at
     `REFACTOR_PLAN.md:153`; total removable is 1,800.
   * residual after deleting all dead rules ≈ **3,110 lines** → at the 600 fail
     budget that is ≥6 files (§4.1 names exactly 6: `primitives` + 4 screen
     modules + residual shell, average 518 — feasible but with no headroom);
     at the 300 warn budget it is **≥11 files**, which §4.1 does not plan.
5. **`portal.module.css` importers drop 37 → 22** post-purge
   (`grep -rl portal.module.css src`), not to "a primitives set plus per-area
   files" implied by audit `:701`. Each of those 22 files is a candidate edit when
   a class moves between modules — the real cost driver of §4.1.

**Recommendation for the dossier:** state §7.1 explicitly as the audit's ratchet,
add the 5 unaddressed FAIL files to the Day-3 scope (or record them as accepted
ratchet debt with a named follow-up slice), and correct the §4.2 `idb-store.ts`
estimate so it cannot produce a new FAIL.

---

## CI design

### What runs today

Only `.github/workflows/deploy.yml` (single file in `.github/`). There is **no**
`.coderabbit*`, `.vscode`, `.github/dependabot.yml`, `.github/actions/`, CodeCov or
any other CI-ish config (`find .github -type f` → 1 file; `ls -a` grep for
coderabbit/vscode/codecov/dependabot → nothing). `.codex/hooks.json` and
`.impeccable/config.json` exist and are tracked but are **local editor hooks**,
not CI.

| Property | deploy.yml value | Line |
| :-- | :-- | :-- |
| Trigger | `push: branches: ["main"]` + `workflow_dispatch` | `:3-6` |
| `pull_request` trigger | **absent** | — |
| lint | **never runs** | — |
| typecheck | **never runs** | — |
| test | **never runs** | — |
| build | `npm run build:demo` only | `:34` |
| Node | literal `"24.19.0"` | `:27` |
| install | `npm ci` (⇒ `postinstall: prisma generate`) | `:31` |
| artifact | `actions/upload-pages-artifact@v3` path `./out` | `:36-39` |
| publish | `actions/deploy-pages@v4`, `needs: build` | `:41-49` |
| concurrency | group `pages`, `cancel-in-progress: false` | `:13-15` |

**Therefore: every push to `main` publishes a new GitHub Pages site with zero
lint, zero typecheck and zero tests.** This is the single most important
sequencing constraint (§"Dependency graph & sequencing").

### §7.4 requirement

"`GitHub Actions automatically tests, lints, typechecks and verifies builds on
every PR (ci.yml)`" (`REFACTOR_PLAN.md:253`). Today **0 of 4** of those run on a
PR. `ci.yml` is a net-new file.

### Facts the design must respect (each measured)

* **Env gate at config load.** `next.config.ts:5-7`
  `z.enum(["demo","server"]).parse(process.env.APP_RUNTIME_MODE)` runs when the
  config module is imported — an unset/typo'd value throws before any Next
  command, so `ci.yml` must invoke the **npm scripts**, never bare `next build`.
  `scripts/next-target.mjs:26-30` is what sets it (`APP_RUNTIME_MODE` +
  `NEXT_PUBLIC_APP_RUNTIME_MODE`).
* **Server-mode gate.** `next.config.ts:12-19` requires `DATABASE_URL`
  (`.url()`), `NEON_AUTH_BASE_URL` (`.url()`), `NEON_AUTH_COOKIE_SECRET`
  (`.min(32)`), `APPLICATION_SECRET` (`.min(32)`) — *only* when
  `APP_RUNTIME_MODE === "server"`. **Demo needs none**:
  `scripts/next-target.mjs:41-53` actively blanks `DATABASE_URL`, `DIRECT_URL`,
  `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `APPLICATION_SECRET`,
  `ALLOWED_ORIGINS`, `AUTH_DEV_BYPASS` to `""` for the demo target. This confirms
  `README.md:82-83` ("requires no server secrets").
* **`.env.example` covers both gates.** `DATABASE_URL` is a syntactically valid
  postgres URL, `NEON_AUTH_BASE_URL` a valid URL, and both secrets are
  `replace-with-at-least-32-random-characters` = 41 chars ≥ 32. `LOG_LEVEL=info`,
  `READINESS_TIMEOUT_MS=2000`, `ALLOWED_ORIGINS=http://localhost:3000`,
  `AUTH_DEV_BYPASS=false`, `APP_RUNTIME_MODE=server`, `GAME_CLIENT_URL` all
  present. **`.env.example` alone is a sufficient CI env for both builds** —
  10 vars, and `src/server/config/env.ts:62-79` accepts each.
  Gap: `.env.example` does **not** list `NEXT_PUBLIC_APP_RUNTIME_MODE` or
  `APP_BASE_PATH` (both injected by `scripts/next-target.mjs:29` and
  `next.config.ts:35-41`) — acceptable, but the dossier should say so.
* **`npm ci` + `postinstall → prisma generate` without a database.**
  `prisma.config.ts:1` does `import "dotenv/config"` (no-ops when `.env` is
  absent) and `prisma.config.ts:3-11` only attaches
  `datasource.url` **when `DIRECT_URL` is set**
  (`...(directUrl ? { datasource: { url: directUrl } } : {})`). `prisma/schema.prisma:6-8`
  declares `datasource db { provider = "postgresql" }` with **no `url` key**. So
  generate is offline. `src/generated/prisma` is gitignored
  (`.gitignore:33`) yet imported by tracked source, so **`prisma generate` is a
  hard prerequisite for typecheck/test/build** — `npm ci`'s `postinstall` supplies
  it. Caveat: this pass could not execute `prisma generate`/`validate`
  (database-adjacent, and it writes `src/generated`), so "generate succeeds with
  no `DATABASE_URL`/`DIRECT_URL`" is a **static** conclusion from
  `prisma.config.ts:4,11` + `schema.prisma:6-8`, not an observed one. Flagged in
  Open questions.
* **Does `build:server` need a *reachable* DB? No — build-time vs request-time.**
  `src/server/db/client.ts:17-25` exposes `getPrisma()` as a **function**; the
  `PrismaNeon` adapter (`:11-13`) and `new PrismaClient({adapter})` (`:14`) do not
  open a socket. Similarly `src/server/auth/neon-server.ts:9-20` builds lazily.
  The only routes that could query at build time are the prerendered ones, and
  the current server build's prerender set is exactly
  `/`, `/_global-error`, `/_not-found`, `/entrar`, `/entrar/recuperar`,
  `/favicon.ico`, `/icon.svg`, `/jogar` (`.next/prerender-manifest.json`), none of
  which call `getPrisma()` during render — `getPrisma()` appears only inside
  action/route bodies. Critically, `src/app/(professional)/portal/layout.tsx:8`
  `import { connection } from "next/server"` and `:22-24` `if (runtimeMode ===
  "server") await connection();` force all `/portal/**` routes dynamic in server
  mode (they appear in `prerender-manifest.dynamicRoutes`). ⇒ **`build:server`
  needs valid dummy env values but no database and no network.**
* **`AUTH_DEV_BYPASS` in CI.** `scripts/next-target.mjs:32-40` pins
  `AUTH_DEV_BYPASS=false` for server builds because
  `src/server/config/env.ts:80-88` rejects the flag under `NODE_ENV=production`,
  and `:52-60` rejects it in demo mode at all. CI should simply **not set it**
  (`.env.example`'s `false` is fine).
* **`out/` and artifacts.** `out/` is gitignored (`.gitignore:9`) and is currently
  a 554-file local export. `deploy.yml` publishes it via
  `upload-pages-artifact`. `ci.yml` does not need Pages permissions
  (`pages: write`, `id-token: write` must **not** be copied into `ci.yml`; keep
  `permissions: contents: read` there).
* **The `.next` collision (must be handled or the manifest gate is meaningless).**
  `next.config.ts:22-32`: the demo branch sets `distDir: ".next-demo-dev"` **only**
  for `PHASE_DEVELOPMENT_SERVER`; a demo **build** uses the default `.next`.
  Observed proof in the tree: `out/index.html` mtime `2026-09-23 02:04:38` with
  asset build id `out/_next/static/Jj4Ra8TO08geLsJFHkfna`, while
  `.next/BUILD_ID` = `E7B1icx1I4_iMk6hNNHSJ` mtime `2026-09-23 02:05:52`, and
  `.next/server/server-reference-manifest.json` (02:05:46) holds 17 ids with
  `.next/app-path-routes-manifest.json` listing `api/v1/*` and the Generation-A
  routes. `build:server` ran ~1 minute **after** `build:demo` and overwrote the
  demo's `.next`. Any CI step that reads `.next/server/server-reference-manifest.json`
  **after** both builds is reading whichever build finished last.
* **`next build` already type-checks** by default
  (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/typescript.md:13,23`
  — `ignoreBuildErrors` defaults to `false`), and ESLint runs during build too.
  So `ci.yml`'s explicit `lint`/`typecheck` steps are for fast, granular failure
  reporting, not for coverage the builds lack.
* **TypeScript can only see one runtime variant at a time.** Today
  `tsconfig.json:24-42` maps the nine `@runtime/*` paths to the **server**
  implementations, while `next.config.ts:44-79` maps the same nine aliases to the
  **demo** files when `APP_RUNTIME_MODE=demo`. Consequently `npm run typecheck`
  never type-checks the demo alias wiring; demo files compile only as themselves.
  After §3.1's generated `target.ts` this stays true: one `tsc` pass checks one
  generated target. `docs/architecture-audit-2026-09-23.md:749` already asks for a
  separate `typecheck:demo` script; `package.json` has no such script.

### Recommended `ci.yml` spec (design, not a written file)

```
name: CI
on:
  pull_request:            # branches: [main]
  push:
    branches: [main]       # keeps the trunk red/green signal
permissions: contents: read          # deliberately NOT pages/id-token
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true            # safe: no Pages side effects here

job lint-typecheck-test:              # fast lane, no secrets, no DB
  runs-on: ubuntu-latest
  steps:
    checkout@v4
    setup-node@v4   node-version-file: .node-version   # + cache: npm
                                                    # reads package-lock.json
    run: npm ci                       # postinstall -> prisma generate (offline)
    run: npm run format:check         # prettier --check .  (in `npm run check`)
    run: npm run lint                 # --max-warnings=0
    run: npm run typecheck
    run: npm test                     # node env, mocked Prisma, ~2 s, no DB
    # optional second typecheck once §3.1 lands:
    #   APP_RUNTIME_MODE=demo -> generate target.ts -> tsc --noEmit

job build-demo:                       # needs nothing from secrets
  needs: lint-typecheck-test
  env: (none — scripts/next-target.mjs blanks the 7 server vars)
  steps:
    npm ci
    npm run build:demo
    - name: Assert clean action seam
      run: <manifest assertion, see next section>      # HARD gate
    - name: Assert export shape
      run: <out/ assertions, see next section>          # HARD gate
    upload-artifact: out/           # retain 7 days, for human inspection

job build-server:                     # no database, no network
  needs: lint-typecheck-test
  env:
    APP_RUNTIME_MODE: server
    DATABASE_URL:            postgresql://ci:ci@localhost:5432/ci?sslmode=require
    DIRECT_URL:              postgresql://ci:ci@localhost:5432/ci?sslmode=require
    NEON_AUTH_BASE_URL:      https://ci.example.com      # must be .url()-valid
    NEON_AUTH_COOKIE_SECRET: <44-char non-secret CI value>
    APPLICATION_SECRET:      <44-char non-secret CI value>
    ALLOWED_ORIGINS:         http://localhost:3000
    AUTH_DEV_BYPASS:         false
  steps:
    npm ci
    npm run build:server
    - name: Assert route handlers survived
      run: <app-path-routes-manifest assertion>
```

Ordering rules that the design encodes:

1. `build:demo` and its manifest assertion run **before** `build:server` and
   **never in the same job** (or `rm -rf .next` between them), because of the
   shared `.next` distDir. Cleanest fix: give the demo build its own `distDir`
   (the seam work already touches `next.config.ts`).
2. `build:server` should be `continue-on-error: false` but in its **own job**, so
   a server-only regression doesn't mask the demo artifact. If the team prefers
   the audit's softer stance (`architecture-audit-…md:749`, "`build:server` when
   secrets are available"), keep this job required — the env above is
   non-secret.
3. **`ci.yml` must never carry `pages: write` / `id-token: write`.** Only
   `deploy.yml` publishes.
4. Do **not** add `prisma migrate deploy`/`db push` to `ci.yml` (no database in
   this repo's CI today). Use `prisma validate` + `prisma generate` +
   `prisma migrate diff --from-migrations prisma/migrations
   --to-schema-datamodel prisma/schema.prisma --script` with an **empty**
   `--shadow-database-url`-free invocation for the migration-vs-schema parity
   check — that is offline in Prisma 7 and is the only automated signal that
   `6_drop_generation_a/migration.sql` matches the schema edit.
5. Node pinning: use `node-version-file: .node-version` (`.node-version` =
   `24.19.0`, matching `engines` and `packageManager`), not the literal
   `"24.19.0"` duplicated at `deploy.yml:27`. Optionally add
   `.npmrc` with `engine-strict=true` — there is currently no `.npmrc`, and this
   pass itself ran on Node 22.23.1 despite the pin.

---

## Discriminating gates (command per criterion)

For each §7 criterion: can it actually fail on this repo, and what assertion
encodes it.

### §7.1 File-size ratchet — **cannot fail today; nothing computes it**

`eslint.config.mjs` is 17 lines and contains no `max-lines` rule; there is no
`scripts/` ratchet tool (`ls scripts` → `next-target.mjs`, `start.mjs`); no CI
lints sizes. **Add:** a `max-lines` ESLint rule scoped per directory
(`src/components/**` 250/400, `src/app/**` + `src/server/**` + `src/runtime/**` +
`src/application/**` + `src/contracts/**` 300/500, `**/*.module.css` via a small
script 300/600, `tests/**` 400/800) *plus* a baseline allowlist file for the 9
pre-existing FAILs, otherwise the ratchet reading of §7.1 stays unenforceable.
Ad-hoc check command (this pass's method):

```bash
git ls-files 'src/**' 'tests/**' | grep -v '^src/generated' \
 | xargs wc -l | awk '$1>=$3 ~ /module.css$/ ? 300 : 250' # per-category table
```

Verdict: **discriminates only once a tool implements it.** Without a tool, §7.1 is
a review convention, not a gate.

### §7.2 Clean action seam — **discriminates, but the manifest half is already true**

Path (hard-coded in Next, `node_modules/next/dist/export/index.js:359`):
`<distDir>/server/server-reference-manifest.json`, `distDir` = `.next` for a demo
build. Shape: `{ node: {<42-hex-id>: {workers, filename, exportedName}}, edge: {…},
encryptionKey }`. Next's own E625 rule (`…/export/index.js:375-385`) is
`[...Object.keys(node), ...Object.keys(edge)]` filtered by
`extractInfoFromServerReferenceId(id).type === 'server-action'`. The type bit is
**byte 0 of the id, bit 7** (`node_modules/next/dist/shared/lib/server-reference-info.js:31-38`:
`typeBit === 1 ? 'use-cache' : 'server-action'`).

Assertion (mirror Next's semantics so a future `use cache` doesn't false-fail):

```bash
node -e 'const m=require("./.next/server/server-reference-manifest.json");
const ids=[...Object.keys(m.node||{}),...Object.keys(m.edge||{})];
const actions=ids.filter(id=>(parseInt(id.slice(0,2),16)>>7&1)===0);
if(actions.length){console.error("E625-risk: "+actions.length+" server actions: "+
  actions.map(i=>m.node[i].filename).join(", "));process.exit(1)}'
```

* Measured today: **demo dev = 0 ids**
  (`.next-demo-dev/dev/server/server-reference-manifest.json`), **server build =
  17 ids, all type `server-action`** (1 `entrar/actions.ts`, 1
  `portal/sign-out-action.ts`, 10 `portal/adult-portal-actions.ts`, 4
  `portal/player-access-actions.ts`, 1 `(public-play)/jogar/actions.ts`).
* **So the manifest half is already satisfied for demo and is a *regression
  guard*, not proof the seam landed.** The half that genuinely discriminates
  *today* is the alias count: `grep -c '"@runtime/' next.config.ts` → **9**
  (`next.config.ts:44-79`) and `grep -c '"@runtime/' tsconfig.json` → **9**
  (`:24-42`); plus 24 `@runtime/` import statements across 23 surviving files.
  Both must reach 0. **And it must run before `build:server`**, which overwrites
  `.next` (evidence in the CI section).
* §7.2's second half also needs a *forward* guard: audit
  `architecture-audit-…md:751-752` prescribes an ESLint rule forbidding
  `@/runtime/**` imports outside `composition`/`contracts` so the seam can't be
  bypassed after the aliases go away.

### §7.3 Tooling health — **discriminates trivially** (all four already pass)

`npm run build:demo`, `npm run build:server`, `npm run typecheck`, `npm test`.
Not run here (builds and DB-adjacent commands excluded). `typecheck`/`test`/`lint`
measured green. Caveat worth writing down: `build:server` in this repo reads a
developer `.env` via `scripts/next-target.mjs:24` `loadEnvConfig`, so a local
green build can be a false positive; CI (no `.env`) is the honest run.

### §7.4 CI enforcement — **fails today (no `pull_request` trigger exists)**

Assertion: existence of `.github/workflows/ci.yml` with `on: pull_request` and
`npm run lint`, `npm run typecheck`, `npm test`, `npm run build:demo` steps.
Cheap, and it fails right now.

### §7.5 Functional demo — **needs the export-completeness assertion to be written**

"Export is complete" is assertable as a *closed* set. Method used here: enumerate
`out/**/*.html`, subtract the §2.2 trees, and expect exactly **26 documents**
(25 `index.html` + `out/404.html`) — measured 104 total HTML − 78 in the deleted
trees = **26**. The expected list is in the Manual checklist section.

```bash
test -f out/404.html || exit 1                                  # Pages 404 shape
for p in "" entrar entrar/recuperar portal portal/turmas \
  portal/turmas/demo-turma-3a portal/turmas/demo-turma-5b portal/turmas/demo-turma-4a-campos \
  portal/admin/organizacoes portal/admin/organizacoes/0b0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a \
  portal/admin/organizacoes/1b1b1b1b-1b1b-4b1b-9b1b-1b1b1b1b1b1b portal/admin/equipe \
  portal/resultados portal/resultados/demo-turma-3a portal/resultados/demo-turma-4a-campos \
  portal/resultados/demo-turma-5b \
  portal/resultados/demo-turma-3a/players/demo-player-third-a-01 \
  portal/resultados/demo-turma-3a/players/demo-player-third-a-02 \
  portal/resultados/demo-turma-3a/players/demo-player-third-a-03 \
  portal/ajuda portal/sem-acesso portal/sessao-expirada jogar; do
  test -f "out/$p/index.html" || { echo "MISSING out/$p/index.html"; exit 1; }; done
[ "$(find out -name index.html | wc -l)" -eq 25 ] || { echo "unexpected page count"; exit 1; }
[ "$(find out -type f | wc -l)" -gt 100 ] || exit 1
grep -rq '"/SMS_Portal' out/index.html || exit 1                # basePath landed
```

Note this set is **only correct after §2.2 removes the deleted routes**; today
those 78 pages exist and would make the count assertion fail in the *right*
direction.

**Route handlers silently vanishing** — the failure mode `out/`-shape checks miss:
`src/app/api/v1/player/*/route.ts` are all `export const runtime = "nodejs"` +
`export const POST = withHttpContext(...)` (e.g.
`src/app/api/v1/player/state/route.ts:13,15`). Under `output:'export'` they never
appear in `out/` at all (`find out -type d -name api` → nothing;
`grep -rl "api/v1" out` → 1 JS chunk only). So:

* `test ! -d out/api` **can never fail** — for any handler that doesn't
  successfully return at build time, Next aborts the export instead of emitting
  `out/api/…`. This is exactly why `docs/agent-reviews/refactor-plan-v2/VV-F-roadmap-gates-verification.md:219-224`
  called §7.5's check "unfalsifiable by construction, not merely already-true".
* The server-side check that **does** discriminate: assert
  `.next/app-path-routes-manifest.json` contains all four `/api/v1/player/*`
  keys after `build:server` (measured: it contains exactly
  `/api/v1/player/{active-time,bootstrap,results,state}/route` plus
  `/favicon.ico/route`, `/icon.svg/route`). If a purge or seam edit drops a
  `route.ts`, that key disappears and the assertion fires.

**Was the manifest assertion adopted into v2.1?** Partly:

| Where | Status |
| :-- | :-- |
| `REFACTOR_PLAN.md:130` (§3.1 step 3) | mechanism described ("0 registered action IDs during `build:demo`") ✔ |
| `REFACTOR_PLAN.md:227` (§6 Day 2) | "Verify Day 2 gate: `build:demo` (assert 0 server-reference IDs)" ✔ |
| `REFACTOR_PLAN.md:251` (§7.2) | success criterion ✔ |
| `REFACTOR_PLAN.md:236` (§6 Day 4) | **still reads "assert no `api/` in `out/`"** ✘ — the unfailable check was never deleted from the roadmap |
| §7 itself | **no assertion command, no path, no key name, no expected page set** — it states the property, not the executable gate |

So: the replacement **is** the plan's gate in §3.1/§6-Day-2/§7.2, but the stale
Day-4 parenthetical survives, and no §7 criterion contains a runnable command.
The dossier should carry the commands above (the plan is fixed input; corrections
belong here, not in `REFACTOR_PLAN.md`).

---

## Demo deep-link reality + recommendation

### What actually prerenders (read from disk, `out/` is gitignored but present)

`out/` = **554 files / 104 HTML**, fresh relative to sources
(`find src tests prisma next.config.ts tsconfig.json -newer out/index.html` →
**empty**). It still contains the Generation-A trees, so the purge is not yet
reflected.

Prerendered dynamic routes today and their `generateStaticParams` source:

| Route | Param source | Prerendered values (from `out/`) |
| :-- | :-- | :-- |
| `/portal/turmas/[id]` | `adult-portal-demo.ts:73-75` → `Object.values(DEMO_CLASS_IDS)` | `demo-turma-3a`, `demo-turma-5b`, `demo-turma-4a-campos` (`adult-portal-demo-store.ts:50-52`) |
| `/portal/admin/organizacoes/[id]` | `adult-portal-demo.ts:69-71` → `Object.values(DEMO_ORGANIZATION_IDS)` | `0b0a0a0a-…0a0a`, `1b1b1b1b-…1b1b` (`adult-portal-demo-store.ts:45-46`) |
| `/portal/resultados/[classGroupId]` | `game-events-demo.ts:109-111` → hardcoded `demoClasses` (`:11-15`) | the same 3 class ids |
| `/portal/resultados/[classGroupId]/players/[playerSlotId]` | `game-events-demo.ts:113-121` → `demoAdultPortalSeed.playerSlots` | `demo-player-third-a-01/02/03` (`adult-portal-demo-store.ts:252,259,266`) — **all under `demo-turma-3a` only** |
| `/atividade/[token]…` (deleted by §2.2) | 4 files with `generateStaticParams` | 52 pages: `2KF-81P`, `7FQ-29M`, `habitos-saudaveis`, `turma-5b` × 13 sub-states |
| `/portal/atividades/*`, `/materiais/*`, `/modulos/[id]` | 7 more `generateStaticParams` sites | 23 pages |

15 files declare `generateStaticParams` today (`grep -rl generateStaticParams src
--include=*.tsx`); **4 survive** the purge — `turmas/[id]/page.tsx:11`,
`admin/organizacoes/[id]/page.tsx:13`,
`resultados/[classGroupId]/page.tsx:12`,
`resultados/[classGroupId]/players/[playerSlotId]/page.tsx:12` — the other 11 are
in the §2.2 trees.

### What happens for a newly created demo entity

New demo rows get ids from `adult-portal-demo-store.ts:334-341`
`demoId(kind)` → `demo-<kind>-<crypto.randomUUID()>`. That value **cannot** be in
any `generateStaticParams` output, so no HTML exists for it.

Three access paths, measured from the code:

1. **In-app navigation after creation — already blocked by design.**
   `classes-screen.tsx:140` computes
   `generatedInBrowser = classGroup.id.startsWith("demo-class-")` and at `:169-172`
   renders a plain `<article>` **with no `Link`** and the label "Criada neste
   navegador" (`:162-164`), emitting the `<Link href="/portal/turmas/{id}">` only
   in the `else` branch (`:174-180`). `organizations-screen.tsx:124-125,146-154`
   does the identical thing for `demo-organization-`. `overview-screen.tsx:207`
   filters `.demo-class-` rows out of the recent-classes list. The only surviving
   `router.push` to a dynamic route in the whole codebase is
   `activity-builder.tsx:60` — a file §2.3 deletes.
   **⇒ Option (c) is already implemented for the two create-flows the demo has.**
2. **In-app navigation from a *seeded* page into a created child.** Player slots
   created inside `/portal/turmas/demo-turma-3a/` are handled by
   `player-access-workflow.tsx` (a client component over localStorage) and never
   navigate to a results URL; `grep -n "Link|href" player-access-workflow.tsx` →
   no matches. So there is no path from created state into an un-prerendered URL.
3. **Hard refresh / pasted URL on `/portal/turmas/demo-class-<uuid>/`.** GitHub
   Pages has no rewrite capability; the vendored docs confirm the only fallback
   mechanism for `output:'export'` is the host's `404.html`
   (`static-exports.md:318-359`), and `out/404.html` **does** exist with full
   router chunks. So Pages returns **HTTP 404 + the Next not-found document**, not
   the `/portal/turmas` list.
   **⇒ `REFACTOR_PLAN.md:143` ("a hard browser refresh on an unseeded dynamic
   route falls back to the `/portal/turmas` list") is factually wrong for GitHub
   Pages.**

### Two additional facts that bound §7.5

* **Results screens are frozen to the seed, independent of localStorage.**
  `game-events-demo.ts` reads `demoAdultPortalSeed` directly (`:20,41,77,80,117`) —
  it never touches `readDemoAdultPortalState()`, and `results-screen.tsx` has no
  `"use client"` (line 1 is `import Link from "next/link"`), so there is no client
  rehydration. Consequences: (a) created classes never appear in
  `/portal/resultados` (`demoClasses` is a 3-entry literal at `:11-15`); (b) the
  §7.5 "local persistence" claim covers organizations/team/classes/assignments/
  player access, **not** results.
* **`dev:demo` is not a preview of the exported demo.** `next.config.ts:26-28`
  gives dev `distDir: ".next-demo-dev"` and **no** `output:'export'`/`basePath`.
  So under `dev:demo` the proxy (`src/proxy.ts:136-138` matcher) runs, all four
  `/api/v1/player/*` handlers respond, and there is **no `/SMS_Portal` base
  path**. Deep links that 404 on Pages work in `dev:demo`. Any checklist run only
  in `dev:demo` will pass while the shipped artifact is broken.

### The three fixes, costed

| Option | Work | Risk | Verdict |
| :-- | :-- | :-- | :-- |
| **(a)** downgrade §7.5 to "seeded routes only" | 0 code lines; one sentence in the dossier/checklist | none — matches what the code already guarantees | cheap, honest, but leaves "fully operational navigation" unproven |
| **(b)** client-side routing shell for un-prerendered segments | remove `generateStaticParams` from 4 files (breaks the 25-page prerender), or add `[...catchAll]` under every dynamic parent; rewrite 17 routes into one client route table reading localStorage; `notFound()` in `turmas/[id]/page.tsx:30` and the `redirect("/portal/sem-acesso")` at `:31` have no server pass to run in | **No supported pattern exists.** `static-exports.md:279-280` lists "Dynamic Routes without `generateStaticParams()`" and "with `dynamicParams: true`" as **unsupported**; `:293` says using them under `next dev` errors. `01-app/02-guides/single-page-applications.md` is about client *data* fetching (SWR/react-query), **not** about replacing file-based routing; there is no `__next`/SPA-shell recipe anywhere in `node_modules/next/dist/docs/`. GitHub Pages cannot rewrite paths. Est. **1.5–2.5 days**, i.e. > the entire remaining sprint, and it converts a server-rendered portal into a client-rendered one for demo purposes only | **rejected** |
| **(c)** never navigate to created entities (keep them inline/modal) | **already implemented** at `classes-screen.tsx:169-180`, `organizations-screen.tsx:146-154`, `overview-screen.tsx:207`; the only violation (`activity-builder.tsx:60`) is deleted by §2.3. Remaining work: apply the same `startsWith("demo-…")` guard to any new create-flow, and make the created row open a **modal/drawer** rendered from client state instead of a route | low; no build-graph change; keeps `generateStaticParams` intact | **recommended** |

### Recommendation

**(c) as the mechanism, with (a) as the wording of the gate.** Concretely:

1. Formalize the existing non-link pattern into the seam: the demo target's
   create-use-cases return the created row, and screens render created entities
   with `id.startsWith("demo-<kind>-")` → non-navigable card or in-page drawer.
   This is already how 2 of 2 create-flows behave; the refactor should not
   regress it when §4.4 extracts navigation presentation.
2. State §7.5's executable form as: (i) the 26-document export assertion above
   passes, (ii) every `<Link>` href present in `out/**/*.html` resolves to another
   file in `out/` (mechanical link check, see next section), and (iii) "created
   entities are surfaced in place; the demo never deep-links to an
   un-prerendered id."
3. Fix the §3.3 deep-link sentence in the dossier's own words, not the plan's:
   un-prerendered ids produce a GitHub Pages 404 served from `out/404.html`, so
   the demo must not link to them.
4. Add one guard: if Day 2/3 introduces any new create-then-navigate flow,
   §7.5 fails. A cheap proxy is
   `grep -rn 'href={\`/portal/(turmas\|admin/organizacoes\|resultados)/' src/components`
   in review — 3 sites today (`classes-screen.tsx:176`,
   `organizations-screen.tsx:149/186`, `results-screen.tsx:203,243`, plus
   `overview-screen.tsx:209`).

---

## Dependency graph & sequencing

### Graph

```
P0 baseline (record gates; write ci.yml)
 │
 ├──► P1 PURGE  (§2.1 prereq edits → §2.2+2.3+2.4 deletions → §2.5 schema + migration 6)
 │        │        [atomic: must land as ONE red interval]
 │        │        hard-internal order: status-badge.tsx:1 + service-container
 │        │        delete BEFORE the §2.3 sweep; proxy.ts:113 + ajuda BEFORE the
 │        │        §2.2 sweep; schema edit AFTER code, migration SQL after schema
 │        ▼
 ├──► P2 SEAM   (contracts.ts → target.server/target.demo → generated target.ts in
 │        │      scripts/next-target.mjs → 24 @runtime import rewrites in 23 files
 │        │      → entrar/page.tsx:73 + portal-shell.tsx:68 client forms
 │        │      → delete 9 aliases ×2 configs → tsconfig exclude src/generated/**)
 │        ▼
 │    P3 DECOMP (four mutually INDEPENDENT lanes)
 │        ├─ 3a game-offline-sync.ts → runtime/offline/*      (touches 1 file + 1 test)
 │        ├─ 3b game-host.tsx       → use-game-bridge/use-game-sync (public surface)
 │        ├─ 3c service.ts:140-205  → portal-navigation-presenter (touches service + 1)
 │        └─ 3d portal.module.css   → primitives + 4 screen modules (22 importers) ← LONGEST
 │        ▼
 └──► P4 VERIFY + DOCS (needs P1–P3; ci.yml green is a precondition, not a step)
```

### Serial vs parallelizable

**Truly serial (P1 → P2 → P4):**

* **P1 before P2.** The alias table in `next.config.ts:44-79` has 9 entries, 2 of
  which point at files §2 deletes or replaces. Doing the seam first means wiring
  contracts for code that is about to be deleted.
* **P2 before P3b/P3d.** `game-host.tsx` and the 22 `portal.module.css` importers
  include 20 of the 23 files holding `@runtime/` imports. Rewriting imports and
  then splitting the same files touches each file twice.
* **P2 before P4's §7.2 gate** — the gate is the seam's own acceptance test.

**Parallelizable:**

* **P0 `ci.yml` is independent of everything** and should merge **first** (see
  red-window below).
* **P1's §2.2, §2.3 and §2.4 file deletions are mutually independent** — the
  ordering constraint is only that they land *together* before the next
  `typecheck`.
* **§2.5 schema/migration is independent of the code sweep** and can be done in
  parallel by a second person (it fails only `prisma validate`, not `tsc`).
* **All four P3 lanes are independent of each other.** 3a/3b/3c each touch ≤2
  files; 3d touches 22. 3a+3b+3c can complete while 3d is mid-flight.
* **P4's doc pass is independent of P3d.**

### Cost drivers (measured, for the red-window estimate)

| Work | Files touched | Evidence |
| :-- | --: | :-- |
| §2.1(1) status-badge prune | 1 (+6 surviving screens reviewed) | `status-badge.tsx:1` is the sole `portal-view-service` import in components |
| §2.1(2) service-container | 1 delete | 8 consumers, all in the deletion set |
| §2.2+2.3+2.4 | 46 deletions | measured above |
| §2.5 | 1 schema + 1 new migration dir | `schema.prisma:18,65,79,80,97,245,261,300` |
| §3.1 seam | **23 files** (24 `@runtime/` imports) + 4 new runtime files + 2 forms + 2 configs | `grep -rl 'from "@runtime/' src tests` minus deletion set |
| §4.1 CSS | up to **22 files** re-pointed | `grep -rl portal.module.css src` = 37 today, 22 post-purge |
| §4.4 navigation extract | 2 files | `service.ts:140-205` |

### Longest realistic red window

Assumption: an interval is "red" while `typecheck` or `test` fails on the branch
head. With `ci.yml` in place, every push is measurable.

| Window | Cause | Realistic duration |
| :-- | :-- | :-- |
| **W1 — the purge** | §2.1 prereq edits + 46 deletions must land atomically; anything half-done leaves `tsc` errors on 8–10 dangling imports | **4–8 h of working time** on a Day-1 branch; **0 h on `main`** if P1 goes through a PR |
| W2 — seam rewrite | 23 files + 4 new + 2 configs; `target.ts` must be generated before any consumer compiles | **3–6 h**, one red interval |
| W3 — CSS split | 22 importers re-pointed class-by-class | **4–6 h**, but `tsc` stays green (CSS class typos are not type errors) → **green-red-green only via visual check, invisible to CI** |
| W4 — offline split | `idb-store.ts` at §4.2's ~650 lines is a new §7.1 FAIL | permanently green for CI, red for §7.1 |

**Longest single red window ≈ W1 at 4–8 hours of work**, and it is *bounded by
human attention*, not by tooling: `typecheck` 2.6 s, `test` 1.8 s, `lint` 7.4 s —
the local loop is < 15 s, so W1 can be kept incrementally green by staging
deletions file-by-file against `tsc`.

### Interaction with `deploy.yml` — and the branch decision

`deploy.yml:3-5` publishes on **every push to `main`**, with
`cancel-in-progress: false` (`:15`) and `needs: build` (`:48`). Consequences:

* A single mid-purge commit pushed to `main` **republishes a broken GitHub Pages
  site**, and the "in-progress" Pages build for the next push queues rather than
  cancels — so a red artifact can be live for the length of the next queue.
* W1 (4–8 h) is *longer than* an hour of clock time, so any main-direct execution of
  Day 1 lands several red commits in public.

**⇒ Branch-based execution is required, not optional.** Minimum viable shape:

1. `ci.yml` (P0) merges **first and alone**, so the purge PR is gated by
   lint/typecheck/test/build from its opening commit.
2. Day 1, Day 2, Day 3 each become **one PR** with a green final commit;
   `deploy.yml` then only ever sees the squashed/complete result.
3. Optionally add to `deploy.yml`: `needs: ci`-style gating is not expressible
   across workflows without a branch-protection rule — so the practical control is
   **GitHub branch protection on `main`** requiring `ci.yml` checks (lint,
   typecheck, test, build-demo, seam-assert) plus the existing `deploy.yml`
   trigger on `main` only. Note this is a *settings* change, not a file change,
   and must be listed as a Day-0 prerequisite in the dossier.

### Day-1 gate: what each command catches, and what it cannot

`REFACTOR_PLAN.md:219` — `prisma validate && prisma generate && npm run typecheck && npm test`.

| Command | Catches on Day 1 | **Cannot** catch |
| :-- | :-- | :-- |
| `prisma validate` | the `OrganizationMembership.capabilityAssignments` (`schema.prisma:97`) dangling inverse left by §2.5(3); any dangling `AccessLink`/`CapabilityAssignment`/`Capability`/`RateLimitBucket` reference; bad relation pairs | **that `migrations/6_drop_generation_a/migration.sql` exists at all, or matches the schema** — validate reads only `schema.prisma`. The whole migration half of §2.5(6) is unverified. Requires `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script` and a "no diff" assertion |
| `prisma generate` | regeneration of `src/generated/**` after enum/model removal → surfaces `@/generated/prisma/enums` imports of deleted members (e.g. `Capability`, still imported at `authorization-service.ts:1` — but that file is deleted) | anything about SQL; anything about files tsc doesn't reach |
| `npm run typecheck` | dangling imports from survivors into the 46 deleted files; deleted JSX components still referenced; the `status-badge.tsx:1` `ActivityStatus` import if the prune is skipped | the **demo** alias wiring (tsconfig paths at `:24-42` always resolve to the server variants) → the entire demo runtime graph is unchecked; dead CSS classes; `out/` shape; anything ESLint/formatting; **files that are no longer imported by anyone** (an orphaned survivor passes silently) |
| `npm test` | behaviour regressions in the 182 surviving unit tests | all UI/browser behaviour (`environment: "node"`, `vitest.config.mts:12`; **zero DOM tooling installed** — see next section); route prerender shape; Pages 404 semantics |
| not in the Day-1 gate but should be | `npm run lint` (already green, 7.4 s) and `npm run format:check` | — |

---

## Verification per phase

### The state of UI testing: none exists

`grep -nE "playwright|puppeteer|@testing-library|jsdom|happy-dom|cypress" package.json`
→ **no matches**. In `package-lock.json` the only hits
(`:11105`, `:11115`, `:13630`, `:13636-13637`, `:13650`, `:13668-13671`) are
vitest's **optional peer** declarations, and they are unmet:
`ls node_modules/@testing-library` → does not exist;
`ls -d node_modules/playwright* node_modules/jsdom` → do not exist.
`vitest.config.mts:12` sets `environment: "node"`. ⇒ **0 browser tests, 0 DOM
tests, 0 component-render tests.** `docs/architecture-audit-…md:733-737` (Phase 5)
proposes `fake-indexeddb` and route-handler contract tests — none exist.

### Cheapest meaningful automated signal per phase

| Phase | Cheapest gate | Command / method |
| :-- | :-- | :-- |
| **P0 baseline** | record the numbers in this report as the ratchet baseline; merge `ci.yml` alone | `npm run lint && npm run typecheck && npm test` = 12 s total |
| **P1 purge** | (1) tsc/test loop; (2) `prisma validate`; (3) **schema↔migration parity**; (4) a "no survivor references a deleted path" grep | `git grep -nE "atividades\|materiais\|/modulos\|admin/auditoria\|/atividade/" -- src tests ':!src/app/...deleted'` must return only `auth.test.ts:146-154` (which should be edited); `prisma migrate diff … --script` must be empty |
| **P2 seam** | the manifest assertion + alias count + **link check of `out/`** | §7.2 command; `grep -c '"@runtime/' next.config.ts tsconfig.json` → 0,0; plus the link check below |
| **P3a offline** | `game-offline-sync.test.ts` repointed (7 tests) + per-file size check | §4.2's own "the test file splits the same way" is the acceptance signal |
| **P3b game-host** | `game-client/game-host-token/player-game-bridge/game-event-ingestion` tests (13 tests) — note none renders the host; manual `/jogar` pass required | see checklist item J1–J5 |
| **P3c navigation** | `portal-navigation.test.ts` (3 tests) + `adult-portal-service.test.ts` (11 tests) already assert shell contents | — |
| **P3d CSS** | **no automated signal at all.** Only a link/asset check + the manual visual pass. A cheap proxy: assert every `styles.<x>` token referenced by a surviving `.tsx` exists in the module it now imports | small node script; would have caught nothing today but catches the 22-file re-point |
| **P4 verify** | export-completeness + `out/` link check + `app-path-routes-manifest` route-handler assertion | below |

**The `out/` link check** is the single highest-value cheap addition: after
`build:demo`, extract every `href` from `out/**/*.html`, strip the
`/SMS_Portal` base path and the `index.html` suffix, and assert each resolves to
a file in `out/`. This catches (i) a created-entity `Link` that §7.5 must not
emit, (ii) a surviving nav entry pointing at a purged route, (iii) a `basePath`
regression. On the current export it would also have to whitelist
`/SMS_Portal/atividades/…` (present today, gone after P1) — which is exactly the
signal that the purge is *required* for the check to pass.

### Manual route checklist

See next section. It is the only verification available for 3 of the 4 P3 lanes.

---

## Manual route checklist

Derived from the filesystem, post-purge. **Demo URLs must be visited under
`/SMS_Portal` on Pages but NOT under `dev:demo`** (`next.config.ts:26-28` — dev has
no basePath and no static export). Column **S?** = server mode (`npm run dev`),
**D?** = demo mode.

### A. Pre-auth / public shell

| # | URL (demo) | URL (server) | Check |
| :-- | :-- | :-- | :-- |
| A1 | `/SMS_Portal/` | `/` | Meta-refresh lands on `/entrar/` (`src/app/page.tsx:1-11`). In **demo** the target is `/SMS_Portal/entrar/`; in **server** `/entrar/`. |
| A2 | `/SMS_Portal/entrar/` | `/entrar/` | Demo: read-only prefilled email/senha + `<Link>` "Entrar na demonstração" → `/portal` (`entrar/page.tsx:52-66`). Server: real `<form action={signInAction}>` (`:73`) with `email`/`password` + submit; bad creds land on `/entrar?error=invalid_credentials` (`entrar/actions.ts:29-31`). Post-§3.1(4) this is `sign-in-form.tsx`. |
| A3 | — | `/entrar/` with empty fields | server only: `?error=credentials_required` (`entrar/actions.ts:27-29`). |
| A4 | `/SMS_Portal/entrar/recuperar/` | `/entrar/recuperar/` | Renders; uses `marketing.module.css`; no action wired to the purged flows. |
| A5 | `/SMS_Portal/jogar/` | `/jogar/` | Player entry. Demo: `player-entry-demo-actions.ts` + `demo-game-adapter.tsx`; Server: `jogar/actions.ts` + real `GAME_CLIENT_URL` iframe. Check the QR/manual-entry state, the `window.location.href` read at `player-entry-screen.tsx:80`, and that `/jogar` keeps `Referrer-Policy: no-referrer` after the §2.1(3) proxy edit (**server only** — proxy is dead in the export). |
| A6 | `/SMS_Portal/nonexistent/` | — | **Pages returns HTTP 404 and renders `out/404.html`.** Confirm it is the branded not-found, and that no demo `<Link>` anywhere can land you here. |

### B. Portal shell + role switching (demo)

| # | URL | Check |
| :-- | :-- | :-- |
| B1 | `/SMS_Portal/portal/` (overview) | Sidebar renders `DemoRoleControls` (`portal-shell.tsx:51`) + `PortalNavigation` (`:52`); sign-out is a `<Link href="/entrar">` (`:60-66`), **not** a form, in demo. |
| B2 | Sidebar role switcher | Cycle all 4 demo profiles (`adult-portal-demo-store.ts:152,158,164,170` = PLATFORM_ADMIN, ORGANIZATION_ADMIN, TEACHER, SECOND_TEACHER). Each must change nav (`service.ts:140-205`) and not throw. Persist across reload (localStorage) and across a 2nd tab (`use-demo-portal.ts:14-15` listens to `adult-portal-demo-change` + `storage`). |
| B3 | **Restaurar demo** | Wipes localStorage back to seed; every B–E page then matches the prerendered HTML. |
| B4 | `/portal/sem-acesso/`, `/portal/sessao-expirada/` | Reachable as `redirect()` targets (`turmas/[id]/page.tsx:31`); render standalone. |
| B5 | `/portal/ajuda/` | After §2.1(3): no topic text mentions activity links (`ajuda/page.tsx:10,22` currently do). |
| B6 | Mobile nav | `portal-navigation.tsx` `mobileNavItem`/`desktopNavItem`; CSS split must not break it. |

### C. Organizations (platform_admin)

| # | URL | Check |
| :-- | :-- | :-- |
| C1 | `/portal/admin/organizacoes/` | List shows 2 seeded orgs (`store:178,184`); "Nova organização" form creates → row appears with **"Criada neste navegador"** and is **NOT a link** (`organizations-screen.tsx:124-125,146-154`). Reload → still present. |
| C2 | `/portal/admin/organizacoes/0b0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a/` | **Hard-refresh this URL** — it is prerendered (`out/portal/admin/organizacoes/0b0a…/index.html`). Detail + admin assignment + status change. |
| C3 | `/portal/admin/organizacoes/1b1b1b1b-1b1b-4b1b-9b1b-1b1b1b1b1b1b/` | Second seeded org (Campos Verdes) — the two-organization scoping case. |
| C4 | `/portal/admin/equipe/` | Team list; "adicionar profissional" (`createDemoProfessionalAction`, `adult-portal-demo-actions.ts:126-155`) must not claim a real account (message at `:143-145`). `deactivate-organization-control.tsx` and `demo-role-controls.tsx` are the surviving write paths. |
| C5 | created org → **never** deep-link | Manually try `/portal/admin/organizacoes/demo-organization-<uuid>/` → expect the A6 404; confirm no UI affordance reaches it. |

### D. Classes / turmas

| # | URL | Check |
| :-- | :-- | :-- |
| D1 | `/portal/turmas/` | Union of teacher + admin class lists (`adult-portal-demo.ts:45-59`). As ORGANIZATION_ADMIN: create form (`classes-screen.tsx:90-124`) → new card is `<article>`, not a `<Link>` (`:169-172`). As TEACHER: no create panel (`:64`). |
| D2 | `/portal/turmas/demo-turma-3a/` | Prerendered; hard-refresh OK. Shows `ClassDetailScreen` + `PlayerAccessWorkflow` (`turmas/[id]/page.tsx:36-40`). |
| D3 | `/portal/turmas/demo-turma-5b/` | Prerendered. |
| D4 | `/portal/turmas/demo-turma-4a-campos/` | Prerendered; **the second-teacher scoping case** — `adult-portal-demo.ts:61-66` deliberately serves this one under `SECOND_TEACHER`. Verify a teacher who is *not* assigned gets `/portal/sem-acesso` (`page.tsx:31`). |
| D5 | Inside D2: allocate numbered player slots, rotate a credential, end a session | All client-side over localStorage; **the created slot ids (`demo-player-slot-…`, `store:843`) must never become a link.** |
| D6 | Print sheet | `/portal/turmas/demo-turma-3a/` print flow: `player-credential-print-sheet.tsx:22` builds `${basePath}/jogar/` from `window.location.origin` — verify the URL it produces is a **live** Pages URL (basePath present in prod, absent in `dev:demo`). This is the single place demo code synthesizes an absolute URL. |
| D7 | created class → `/portal/turmas/demo-class-<uuid>/` | Expect A6 404; expect no in-app affordance. |

### E. Results

| # | URL | Check |
| :-- | :-- | :-- |
| E1 | `/portal/resultados/` | Exactly 3 class cards (`game-events-demo.ts:11-15`). |
| E2 | `/portal/resultados/demo-turma-3a/` | Prerendered; 3 player rows, each a `<Link>` (`results-screen.tsx:202-213`). |
| E3 | `/portal/resultados/demo-turma-3a/players/demo-player-third-a-01/` (+02, +03) | Prerendered; participation history; "Voltar à turma" link (`:242-247`). |
| E4 | `/portal/resultados/demo-turma-5b/`, `/…/demo-turma-4a-campos/` | Prerendered but **empty** (slots seeded only for 3º A, `store:252-266`) — check the empty state renders. |
| E5 | **Frozen-seed check** | Add a player slot in D5, then open E1/E2. The new slot must **not** appear (results read `demoAdultPortalSeed`, not localStorage). Record this as known §7.5 scope, not a bug found in Day 4. |

### F. Server-mode-only surfaces (`npm run dev`; **absent from the export**)

| # | URL | Check |
| :-- | :-- | :-- |
| F1 | `/portal/**` unauthenticated | `layout.tsx:27-29` `redirect("/entrar")`; requires a real Neon Auth session + matching active `ProfessionalProfile` (`README.md:89-92`). |
| F2 | `POST /api/v1/player/bootstrap`, `/state`, `/results`, `/active-time` | Present in `.next/app-path-routes-manifest.json`. Assert all 4 keys; a purge/seam edit that orphans a `route.ts` drops the key. |
| F3 | CSP / nonce | `proxy.ts:40-88,97-100` — inline scripts must load with `script-src 'nonce-…' 'strict-dynamic'`. **This only exists in server mode**; the static export ships no CSP at all. |
| F4 | `Referrer-Policy` on `/jogar` | `proxy.ts:112-117` — must still be `no-referrer` after the §2.1(3) edit removes only the `/atividade/` disjunct. |
| F5 | Server actions present | Server build manifest must still register **17** ids across 5 files (list in §7.2). If the seam accidentally strips them from the server target too, this drops to 0 and `/entrar` sign-in breaks. |
| F6 | `/portal/atividades/…`, `/materiais/…`, `/modulos/…`, `/admin/auditoria/`, `/atividade/<token>/…` | **404 after P1** — verify they 404 rather than 500. |

---

## Doc edits required

§6 Day 4 (`REFACTOR_PLAN.md:239`) names only README + `docs/current-architecture.md`.
Measured truth surface that goes stale: **4 files, ~21 statements**, and
`docs/schemas/database-model.md` (196 lines, ~14 of them Generation-A) is **not in
Day 4's scope at all**.

### `README.md`

| Line | Current text | False after refactor | Required edit |
| :-- | :-- | :-- | :-- |
| `:5` | "There is no marketing landing page." | still true, but `src/components/marketing/marketing.module.css` (688 lines) is live styling for `/entrar` — the audit already flags the misleading name (`architecture-audit-…md`, §3.2 row for 688) | note that `marketing/` = auth-screen styles, or rename |
| `:53` | "`health/` liveness and readiness route handlers" | **already false**: `find src/app/health -type f` → **0 files** (empty dir, untracked) | delete the row |
| `:59` | "`server/ config/ db/ http/ observability/ services/`" | `src/server/` also has `auth/ authorization/ security/` today, and post-purge `services/` loses 7 of 12 files | restate the actual tree |
| `:62` | "The current static/demo route and data model predate the numbered-player V1 direction. Do not treat the demo's anonymous session-link model or aggregate-only reporting as final architecture." | **false after P1** — the anonymous session-link model is deleted and results are per-player | rewrite as "the demo mirrors the V1 model; the only divergence is that results screens read the seed, not localStorage" |
| `:66` | "runtime is pinned to Node.js 24.19.0 and npm 11.6.x" | true | — |
| `:74-78` | "`npm run dev` starts the server runtime and validates the database and Neon Auth settings in `.env.local` … Slice 1 demo stores … use **Restaurar demo**" | "Slice 1" is stale (Slices 3–5 are in) and the localStorage set is now organizations/team/classes/assignments/**player access** (`store:843,850,891,916,974`) | update scope + slice naming |
| `:82-86` | build:demo/build:server env claims | both verified accurate | — |
| `:102` | "That demo … does not represent production persistence, authentication, player identity, or GameMaker synchronization." | half-stale: demo does model player identity (numbered slots + credentials), just synthetically | restate |

### `docs/current-architecture.md`

| Line | Current text | Problem | Edit |
| :-- | :-- | :-- | :-- |
| `:4` | "Last aligned: 22 September 2026." | goes stale on merge | bump |
| `:16` | "The root route redirects to the professional sign-in surface." | accurate (`page.tsx` meta-refresh) | — |
| `:138` | "The current Prisma schema predates the player-slot direction and must be reconciled before production implementation." | **false** — `PlayerSlot`, `PlayerCredential`, `GameState`, `GameSession`, `Participation` exist (migrations 2–5); after §2.5 the predating models are gone | replace with "schema is V1-shaped; `audit_events` retained for future V1 admin logging; `6_drop_generation_a` removes `access_links`, `capability_assignments`, `rate_limit_buckets`" |
| `:166-176` route table | row `:175` "existing `/atividade/[token]` routes … Legacy/demo session-link entry surface"; row `:176` "`/health/live`, `/health/ready`" | `:175` **deleted by §2.2** — the table must not list a deleted route family. `:176` **already false** (no files) | drop both rows; add `/jogar`, `/portal/turmas[/id]`, `/portal/admin/organizacoes[/id]`, `/portal/admin/equipe`, `/portal/resultados[/classGroupId][/players/[playerSlotId]]`, `/portal/ajuda`, `/portal/sem-acesso`, `/portal/sessao-expirada` |
| `:168` | "The existing route tree still represents the current demo implementation, not the final V1 player-entry design." | becomes doubly false | rewrite |
| `:178` | "Do not treat the current `/atividade/[token]` route shape as the final V1 identity model." | refers to a deleted tree | delete |
| `:180-186` Materials section | "The production V1 experience should remove or hide the Materials navigation entry. Existing demo or research code may remain temporarily…" | after §2.2 the Materials **routes** and both **components** are gone; nothing remains to "hide" | rewrite to "Materials surfaces deleted; deferred beyond V1" |
| `:234` | "Existing runtime variables remain relevant where their implementation survives the static demo transition." | `AUTH_DEV_BYPASS`, `ALLOWED_ORIGINS` etc. survive; the variables for the deleted rate limiter are still in `.env.example:22-23` describing `APPLICATION_SECRET` as covering "rate-limit keys" | correct the comment (that is `.env.example`, not this file — see below) |
| `:247-261` "Implementation status" | `:259-261`: "Legacy activity and Materials routes remain in the route tree but are not V1 navigation destinations." | **false after P1** | delete the clause |
| — | seam | §7.2's whole point is a `runtime/target.ts` composition layer; this doc has no composition section (`architecture-audit-…md:758` asks for exactly that) | add a "Runtime composition" section describing `contracts.ts` / `target.server.ts` / `target.demo.ts` |

### `docs/schemas/database-model.md` — **not in Day 4's scope; 14 statements go false**

Whole sections keyed to deleted tables. Specifically:

| Line | Statement | After §2.5 + migration 6 |
| :-- | :-- | :-- |
| `:3-5` | "current description of the reconciled persistence model … portal-managed access links, no portal-composed activities" | the model is no longer access-link-centred |
| `:37-40` (mermaid) | 4 edges into `CAPABILITY_ASSIGNMENTS` and `ACCESS_LINKS` | 4 of 6 edges deleted |
| `:49` | `capability_assignments` row | table dropped |
| `:50` | `access_links` row — "One customized opaque link per row…" | table dropped |
| `:52` | `rate_limit_buckets` row | table dropped |
| `:56-65` | "Authorization uses the `capability` enum with the six current values" + the 6-row table (`link:view` … `audit:view`) | `enum Capability` deleted (`schema.prisma:18`); V1 authorization is `src/server/authorization/v1-policy.ts` |
| `:67-82` | nullable-scope rules and the `NULLS NOT DISTINCT` raw index on `capability_assignments` | moot; the index is dropped by migration 6 |
| `:84-123` | entire "## Access links" section incl. the token-hash storage rule and create/revoke/rotate lifecycle | deleted feature; supersede with the V1 `PlayerCredential` rotation rule |
| `:137-143` | "## Rate limiting" section | `RateLimitBucket` dropped per §2.5(4) |
| `:145-156` | CHECK-constraint table: 5 of 6 rows are on `capability_assignments`, `access_links`, `rate_limit_buckets` | keep only the `audit_events`-relevant rows (none listed) → the table empties |
| `:162-169` | "## Deferred models … session and result tables are added as new migrations" | **already false**: `game_sessions`, `participations`, `player_slots`, `game_state` exist from migrations 2–5 |
| `:171-177` | Deletion policy: "Profiles, organizations, **access links**, and audit events…" ; "Expired rate-limit buckets are the only routinely deleted rows." | drop the two dead references; the "only routinely deleted rows" claim becomes wrong |
| `:179-196` | Legacy-model pointers | unchanged, still historical |

Also missing entirely: any description of `player_slots`, `player_credentials`,
`game_states`, `game_sessions`, `participations`, `teacher_assignments`,
`class_groups` — i.e. the doc must be rewritten around the surviving model, not
patched.

### `.env.example`

| Line | Comment | Problem |
| :-- | :-- | :-- |
| `:22-23` | "HMAC secret reserved for signed cursors, rate-limit keys, and CSRF binding." | §2.5(4) deletes the rate limiter; `APPLICATION_SECRET` is still required by `next.config.ts:17` and `env.ts:68`, so the secret stays but the "rate-limit keys" justification becomes false |
| `:26` | `READINESS_TIMEOUT_MS=2000` | no `/health/ready` exists to read it (audit `:745` Phase 6.2 says implement or delete the variable and the doc rows) |

### Not in Day 4 but affected

* `docs/implementation/README.md` + `phase-02-activity-configuration.md` (activity
  configuration = deleted feature).
* `docs/portal-visual-reference.html`, `walkthrough.md`,
  `portal-v1-specification.md`, `implementation_plan.md` — historical, but
  `docs/architecture-audit-…md:760` already asks for "truthful slice status" and
  archive pointers; the dossier should list them as explicitly-marked-historical
  rather than silently stale.
* `AGENTS.md`/`CLAUDE.md` are regenerated by `next dev` (per the `agents.md` block
  note) — no manual edit, but note the plan never mentions them.

---

## Open questions

1. **Does `prisma generate` (and `prisma validate`) succeed with no `.env` at
   all?** Static reading of `prisma.config.ts:4,11` (datasource url attached only
   when `DIRECT_URL` is set) and `prisma/schema.prisma:6-8` (no `url` key) says
   yes; it could not be observed because the command is database-adjacent and
   writes `src/generated/`. **This is the highest-risk unverified assumption in the
   CI design** — if `prisma validate` in fact demands a datasource url, `ci.yml`'s
   Day-1 gate must export a dummy `DIRECT_URL`. Verify before writing `ci.yml`.
2. **Does `next build` under `output:'export'` error, warn, or silently drop a
   dynamic `route.ts`?** `out/` has no `api/` today while
   `src/app/api/v1/player/*/route.ts` are 4 `POST`+`NextRequest` handlers, so it
   does not error *in the current configuration*. But whether a newly added
   handler would fail the build or vanish silently determines whether the
   `app-path-routes-manifest.json` assertion is a *belt* or the only *braces*.
   Needs one observed `build:demo` with a deliberately added dynamic handler.
3. **Should `distDir` be split per target?** The `.next` overwrite is measured
   (BUILD_ID `E7B1…` in `.next` vs `Jj4Ra8…` baked into `out/_next`), and it makes
   the §7.2 gate order-sensitive. Whether the seam work (§3.1, already editing
   `next.config.ts`) is the right place to fix it, or a separate Day-0 hardening
   commit, is a sequencing decision the plan does not make.
4. **`tsconfig.json:47` includes `.next/types/**/*.ts`** — route-type validator
   files that only exist after a build. If `ci.yml` runs `typecheck` before any
   build, those are absent and `tsc` silently checks less than a build does. Does
   the team want `next build` → `tsc` ordering in CI, or accept the build's own
   type check as authoritative and drop the standalone `typecheck` step? §7.3 lists
   both as gates, which is currently a redundancy, not a sequence.
5. **How is the demo's second `it.each`-expansion baseline recorded?** §7.1's test
   budget is per-file; the ratchet tool does not exist. Deciding the tool (ESLint
   `max-lines` vs a script) is a Day-0 prerequisite that §6 does not list.
6. **`team-screen.tsx` (411 / non-blank 406) — split or accept?** It is 6 lines
   over the component fail budget post-purge, is not in §4, and is one of the 6
   "surviving screens" §2.1(1) says must have "zero JSX churn". Touching it in
   Day 3 to satisfy §7.1 directly contradicts §2.1(1)'s no-churn promise.
7. **Is the 5-unaddressed-FAIL-file list accepted debt or Day-3 scope?** See
   §7.1 verdict item 2. It changes the Day-3 estimate materially (adding
   `adult-portal-demo-store.ts` 1,024 + 2 CSS modules ~1,700 + 2 components ~950
   lines of decomposition is roughly another day, and the sprint has none).
8. **Should `deploy.yml` be gated on `ci.yml`?** Achievable only via branch
   protection (a repo settings change), not via workflow files, given the
   `push: main` trigger at `deploy.yml:3-5` and `cancel-in-progress: false` at
   `:15`. Needs an explicit yes/no before Day 1.
9. **`docs/schemas/database-model.md` is out of Day 4's doc scope.** Since ~14 of
   its 196 lines describe dropped tables and it omits every V1 table, leaving it
   untouched means the refactor ships with an architecture doc that describes a
   database that no longer exists. Scope decision needed.
10. **`tests/unit/auth.test.ts:146-154`** asserts deleted pathnames. Not in §2.4
    and not edited by §2.1 — does it get corrected (and how does
    `isProtectedPathname` behave once `/atividade/` is gone, given
    `src/server/auth/session.ts` still carries the concept the audit's Phase 6.4
    says to delete)?
