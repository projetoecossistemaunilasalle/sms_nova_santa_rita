# VV-F — Adversarial verification of `RV-F-roadmap-gates.md`

**Target under test:** `docs/agent-reviews/refactor-plan-v2/RV-F-roadmap-gates.md` (768 lines),
which audits `REFACTOR_PLAN.md` v2.0 §6 (roadmap) + §7 (gates), §1.1/§1.2 framing, §2.1 prerequisites.
**Mission:** try to REFUTE it. Upheld only what I reproduced with my own commands.

**Constraints honoured:** read-only. No file created or modified except this document. No
`npm test`, no `tsc`, no `next`/`prisma`/`npm` execution — nothing that writes `.next/`, `out/` or
`tsconfig.tsbuildinfo`. Tools used: `ls`, `find`, `wc -l`, `grep`, `sed -n`, `cat -n`,
`git status --short` (no `-uall`), `git log`, `git branch`, `git remote`, `git rev-list`,
`git ls-files`, `node -e require()` on already-built artifacts (reads only).

**Measured at:** 2026-09-23, HEAD `d4af23c` ("Document Slice 2 workflow and verification",
2026-09-22 17:43:55 -0300), branch `main`, 8 commits ahead of `origin/main`
(`git rev-list --count origin/main..HEAD` → 8). Worktree `git status --short` → 73 entries =
33 `M` + 40 `??` (RV-F reported 73/33/40 — **reproduced exactly**).

---

## 1. Bottom line

**I could not refute the roadmap verdict.** All four BLOCKERS reproduce. Two of them (F1, F2) are
exactly as described, to the line number. F3's four code citations and its doc citation are all
**verbatim correct** — but the finding is *under-scoped* (the alias carries a second, worse half the
reviewer never mentions) and its headline wording ("no replacement selector") overreaches, since
§3.1 does propose a replacement; the real defect is that the proposed replacement cannot compile.
F4 is the one I can genuinely downgrade: it is a **one-line missing CI env step**, not a
secret-provisioning blocker, and the repo's own governing audit already contains the decision the
reviewer says "the plan defers to nobody".

Of the numbers I was asked to recompute: 554, 17, 9, 634, 24, 78, 236, 45, 30/5,090, 24/23, 33.1%,
43.2%, `:1`, `:4`, `:9`, `:90`, `:31`, `:24`, `:291`, `:10-18`, `:65`, `:80`, `:416`, `:325-326`,
`:744` all reproduce. Three do not: "**4th-largest** suite", "**7** migration dirs", and RV-F's
F20 stale-doc per-file counts. One is internally inconsistent: the test-math numerator uses an
anchored regex, the denominator a loose one.

**Net verdict on RV-F: 16 of its §6/§7 findings checked — 13 UPHELD as stated, 2 UPHELD but
OVERSTATED (F3's wording, F4's severity), 1 UPHELD in substance but UNREPRODUCIBLE in its printed
counts (F20), 0 REFUTED. Corrected severities: F4 BLOCKER → MAJOR; F15 stays MAJOR but is push-gated;
F20 MINOR → MAJOR.**

---

## 2. Verification table

| ID | Claim (as RV-F states it) | My evidence (file:line / command → number) | Verdict | Corrected severity |
| :-- | :-- | :-- | :-- | :-- |
| **F1** | §2.1(3) names only 2 of the 4 Generation-A imports in `service-container.ts`; `:1` `PrismaCapabilityReader` and `:4` `AuthorizationService` both target §2.3 deletions → Day-1 `typecheck` cannot pass; only consumers are deleted files → delete the file | `Read src/server/services/service-container.ts` (45 lines, `wc -l` = 45): `:1` PrismaCapabilityReader, `:2` PrismaAccessLinkStore, `:3` AccessLinkService, `:4` AuthorizationService. Plan `REFACTOR_PLAN.md:56` (`authorization-service.ts` 244) and `:57` (`prisma-capability-reader.ts` 55) are both in §2.3. `grep -rn service-container src tests` → **8 hits**: `atividades/actions.ts:121,261,333,377,418,458,493` (tree deleted by §2.2) + `tests/unit/portal-dev-bypass-actions.test.ts:27` (`vi.mock`, deleted by §2.4) → **0 surviving importers**. Whole-repo residue sweep (every §2.2/§2.3 module, survivors filtered) → residue is **exactly** `authorization-service ← tests/unit/authorization.test.ts` and the two container lines | **UPHELD** | **BLOCKER** (confirmed) |
| **F1-fix** | "Correct action is `git rm service-container.ts`", and RV-A independently found the same | RV-A `:26`, `:132-149`, `:423` → same 8-hit grep, same conclusion: **delete, add to §2.3 (45 lines)**. RV-B `:145`, `:171`, `:274` → identifies the identical break at `service-container.ts:1,4` and calls §2.1's "must happen BEFORE purge" claim "false as enumerated", but prescribes no fix. **All three agree; RV-A and RV-F agree on the remedy (delete); RV-B is diagnosis-only.** I verified the four V1 containers survive independently: `adult-portal-container.ts` 18, `player-access-container.ts` 22, `game-state-container.ts` 12, `game-event-container.ts` 47 lines, none importing the delete set | **UPHELD** | n/a |
| **F2** | `tests/unit/authorization.test.ts:9` imports the deleted `authorization-service`; 634 lines, 24 cases, "4th-largest suite"; absent from §2.4 | `sed -n '1,20p'`: `:5-9` is one import block, `:9` = `} from "@/server/services/authorization-service";` — **exact**. `wc -l` → 634 ✓. Anchored case count `grep -cE "^[[:space:]]*(it|test)[[:space:]]*\(|it\.each|test\.each"` → **24** ✓. Absent from `REFACTOR_PLAN.md:68-75` ✓. **But**: by lines the ranking is 1,625 / 728 / **634** → 3rd largest, not 4th; by cases it is 56 / **24** → 2nd. "4th-largest" is wrong under either measure | **UPHELD** (sub-count wrong) | **BLOCKER** |
| **F2-math** | "Day 1 deletes 78/236 = 33.1%; with this 102/236 = 43.2%" | My recompute. Loose reviewer regex `grep -rhoE "\b(it\|test)(\.\w+)*\(" tests \| wc -l` → **236** ✓ reproduces. Line-anchored method (the one their own D1 table uses) → **234**. The 2-hit delta is entirely in `tests/unit/access-link-tokens.test.ts` (`:21`, `:53` are `RegExp.test()` calls; file counts 15 loose vs 13 anchored — and their numerator uses 13). §2.4 per-file anchored counts: 56 + 13 + 5 + 2 + 2 = **78** ✓ exact. True ratios: **78/234 = 33.3%**, **102/234 = 43.6%** (their 33.1% / 43.2% mix methods) | **UPHELD** (0.3–0.4pp method slip) | **MAJOR** |
| **F3** | Day 2 alias removal "has no stated replacement"; chain = `classes-screen.tsx:1` `"use client"`, `:12` alias import, `:90` `action={createClassAction}` prop, `adult-portal-form.tsx:31` `useActionState`, doc `static-exports.md:291` | **Every citation reproduced exactly**: `classes-screen.tsx:1` `"use client";`, `:12` `import { createClassAction } from "@runtime/adult-portal-actions";`, `:90` `<AdultPortalForm action={createClassAction} submitLabel="Criar turma">`; `adult-portal-form.tsx:1` `"use client";`, `:24` `action: PortalMutation;`, `:31` `const [state, formAction, pending] = useActionState(action, initialState);`. `static-exports.md:291` = `- [Server Actions](/docs/app/getting-started/mutating-data)` ✓ **exact line**. Stronger than their citation: I located the raise site — `node_modules/next/dist/export/index.js:375-383` throws `ExportError("Server Actions are not supported with static export")` with `__NEXT_ERROR_CODE = "E625"` when *any* `server-action` id is in the manifest | **UPHELD** (chain), **OVERSTATED** (wording) | **BLOCKER** |
| **F3-adjudication** | "Can it be fixed by a client-only seam? What does that imply for the real build?" | See §4 below. The alias is load-bearing for **two** halves, and RV-F only traced the action half. My counts: `grep -rln "@runtime" src` → **23 files, 11 under `src/app/`, 12 under `src/components/`** (RV-F's D3 numbers ✓ exact), 24 import statements ✓, `grep -rn "from \"@runtime" tests` → **0** ✓ (so Day 2 breaks no test). Client-only seam fixes only the 12 client files | **UPHELD + under-scoped by RV-F** | **BLOCKER** |
| **F4** | "CI verify-builds needs 4 secrets that `next.config.ts:10-18` zod-hard-fails on"; plan never provisions them | `Read next.config.ts`: guard `:12 if (runtimeMode === "server")`, schema `:13-18`, exactly 4 keys `:14-17` = `DATABASE_URL` (`.url()`), `NEON_AUTH_BASE_URL` (`.url()`), `NEON_AUTH_COOKIE_SECRET` (`.min(32)`), `APPLICATION_SECRET` (`.min(32)`) ✓. **The schema is inline; the only import is `zod` (`:3`)** — there is no separate config-time schema file. `scripts/next-target.mjs:26-30` sets `APP_RUNTIME_MODE`; `:41-53` blanks 7 vars for demo; `:39` pins `AUTH_DEV_BYPASS=false` for server builds. `package.json:13` `"build": "npm run build:server"` ✓. `deploy.yml` has **no `env:` block and no secrets** ✓ and only ever runs `build:demo` (`:34`) ✓ | **UPHELD as a plan omission; REFUTED as a secrets blocker** | **MAJOR → downgraded from BLOCKER** (see §3) |
| **F5** | `out/` already has no `api/`, 554 files, so §7 criterion 5 is vacuous | `find out -type f \| wc -l` → **554** ✓ exact. `ls -d out/api` → "No such file or directory" ✓. `find src tests prisma/schema.prisma next.config.ts -newer out/index.html` → **empty** ✓ ⇒ artifact is *fresh*, not stale: `out` mtime 2026-09-23 02:04 > newest source 2026-09-22 23:35 > HEAD 2026-09-22 17:43. Deleted trees **are** in the export: `out/portal/atividades`, `out/portal/materiais`, `out/portal/modulos`, `out/portal/admin/jogos`, `out/portal/admin/modulos`, `out/atividade/{2KF-81P,7FQ-29M,habitos-saudaveis,turma-5b}` ✓. `grep -rl "api/v1" out` → **exactly 1** hit (`out/_next/static/chunks/0pvtinj9q2oay.js`) ✓. `grep -rln generateStaticParams src` → **15** ✓ | **UPHELD — and stronger than claimed** | **MAJOR** |
| **F6** | 9 non-generated files >400 lines are addressed by neither §2 nor §4; 17 total | `find src tests -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' -o -name '*.mts' \) -not -path 'src/generated/*' -print0 \| xargs -0 wc -l \| awk '$1>400'` → **17 files**, every line count identical to RV-F's table (4,910 / 1,625 / 1,222 / 1,024 / 1,017 / 932 / 728 / 717 / 688 / 634 / 616 / 540 / 521 / 517 / 481 / 467 / 411). §2 covers 4, §4 covers 4 ⇒ **9 uncovered** ✓ reproduced to the digit | **UPHELD** | **MAJOR** |
| **F7** | No drop-migration step anywhere in §6 | `grep -in "migrat" REFACTOR_PLAN.md` → 5 hits, all IndexedDB (`:161`) or Tailwind (`:179,182,198,202`). **Zero** Prisma migration step in §6 (`:206-234`). `§2.5` (`:77-85`) edits `schema.prisma` only. Targets live in committed SQL: `0_init/migration.sql:8` (`CREATE TYPE "capability" AS ENUM ('link:view','link:manage',…)`), `:58` `access_links`, `:90` `rate_limit_buckets`, `:117` unique index; `1_add_paused_at/migration.sql:3` `ALTER TABLE "access_links" ADD COLUMN "paused_at"`. `package.json` has no `prisma:migrate`/`prisma:validate` script. `prisma/schema.prisma`: `enum Capability:18`, `CapabilityAssignment:245`, `AccessLink:261`, `AuditEvent:281`, `RateLimitBucket:300`; §2.5's `:65`/`:80` inverse-relation refs verified exact | **UPHELD** (with `:8` only covering the enum, not the tables at `:58`/`:90`) | **MAJOR** |
| **F8** | Longest non-compiling window = Day-2 alias removal (≈1.5–2 of 4 days) | §6 (`:206-234`) has verification only on Day 1 (`:214`) and Day 4 (`:230-233`); Days 2–3 have none ✓ reproduced from the plan text. `tsconfig.json:45-55` includes `**/*.ts`/`**/*.tsx`, excludes only `node_modules` ⇒ tests are typechecked ✓. 24 alias sites in 23 files ⇒ removing both alias sets ⇒ 24 × TS2307 + `build:demo` + `build:server` all red until Day 4 | **UPHELD** | **MAJOR** |
| **F9 / F15** | CI *already* deploys Pages on every push to `main`, no `pull_request`, no lint/test; §1.1's "live GitHub Pages at every commit" CONFIRMED, so Day 1's break is public | `find .github -type f` → **1 file: `deploy.yml`** ✓. Triggers `:3-6` = `push: branches:["main"]` + `workflow_dispatch` — **no `pull_request`**. Permissions `:8-11`, concurrency `:13-15`. Jobs: `build` (`:18-39`: checkout@v4, setup-node@v4 node `24.19.0` + `cache: npm`, `npm ci`, `npm run build:demo`, upload-pages-artifact@v3 `path: ./out`) → `deploy` (`:41-51`: `deploy-pages@v4`, environment `github-pages`). **Zero** lint/typecheck/test/`build:server`/`prisma` steps ✓. §1.1 (`REFACTOR_PLAN.md:18`) framing = CONFIRMED, mechanism is artifact-based, not a `gh-pages` branch. **Tempering fact RV-F omits:** local `main` is 8 commits ahead of `origin/main` and Pages only fires on `git push` — so Phase 0's "commit uncommitted working tree" does not by itself publish a red build | **UPHELD**, F15 risk overstated in immediacy | **MAJOR** (CI gap) / **MINOR→MAJOR** (public-break: push-gated) |
| **F11/F18** | Gates have no defined measurement command; §7.4 measures pass-rate not retention; deleting 33–43% of assertions *raises* the health signal | `REFACTOR_PLAN.md:240,242,243` contain no command, no baseline, no counting scope. My own two regexes disagree (234 vs 236) — the reviewer's criticism applies to the reviewer's own measurement. 5 `it.each` sites (`neon-auth-gateway.test.ts:44`, `runtime-mode.test.ts:6`, `v1-contracts.test.ts:150,172,178`) mean call sites ≠ executed cases, so even the corrected 234 is a proxy. No `--coverage` flag in `package.json:21` (`test: vitest run`), no thresholds in `vitest.config.mts` | **UPHELD** | **MAJOR** |
| **F13** | §2.1(2) is a false choice: no `AuditEvent` writer survives the purge | `grep -rn auditEvent src --include='*.ts*'` (excl. `src/generated`) → **5 hits, 3 files**: `prisma-access-link-store.ts:325 async recordAudit`, `:326 await this.client.auditEvent.create` (deleted §2.3), `portal-view-service.ts:416 export const auditEvents = demoRuntime ? demoAuditEvents : []` (deleted §2.3), `admin/auditoria/page.tsx:4,54` (the consumer §2.1(2) repoints). No surviving `prisma-{adult-portal,player-access,game-state,game-event}-store.ts` writes audit rows ✓. Line `:416` reproduced exactly ⇒ §1.1's "server mode renders empty" is CONFIRMED | **UPHELD** | **MAJOR** |
| **F19/R2** | No integration/E2E layer at all ⇒ criterion 5 is 100% manual | `find tests -type d` → `tests`, `tests/unit` only ✓. `grep -rn "playwright\|cypress\|supertest" package.json vitest.config.mts` → **0 hits**; `find . -maxdepth 2 -iname '*playwright*' -o -iname '*cypress*'` → nothing outside `node_modules` ✓. `vitest.config.mts:12 environment: "node"` ✓, `:7-9` alias only `@`→`./src/` ✓, `:14 env.APP_RUNTIME_MODE="demo"` ✓ | **UPHELD** | **MAJOR** |
| **F-R4** | Base path `/SMS_Portal` is an untested live risk | `next.config.ts:26-28` (`phase === PHASE_DEVELOPMENT_SERVER ? {distDir} : {output:"export", basePath:"/SMS_Portal"}`), `:35-41` injects `env.APP_BASE_PATH` (`""` in dev). Consumers = **exactly 3**: `src/app/page.tsx:1`, `src/components/portal/adult-portal-helpers.ts:126,129-130`, `src/components/portal/player-credential-print-sheet.tsx:21-22`. `grep -rn APP_BASE_PATH tests \| wc -l` → **0** ✓. `scripts/` contains no basePath/assetPrefix logic (only `next-target.mjs`, `start.mjs`) | **UPHELD** | **MAJOR** |
| **F-R8** | `tsconfig.tsbuildinfo` committed vs ignored | Present in the root listing; `.gitignore:19` = `*.tsbuildinfo`; it does **not** appear among the 40 `??` entries ⇒ **ignored, not committed** (RV-F's own A2/R8 wording is right; the brief's suspicion is refuted). `.gitignore:7 /out`, `:27 /src/generated/prisma` also confirmed | **UPHELD** | **MINOR** |
| **F20** | 8 markdown artifacts, ~46 mentions, no §6 doc step | Substance upheld: §6 (`:206-234`) has no documentation step, and `docs/implementation/phase-02-activity-configuration.md` exists (7 mentions of deleted surface). Numbers **not reproducible**: with one fixed pattern (`access_link\|AccessLink\|atividades\|capability\|materiais\|modulos`) across every `.md` outside the plan and the review corpus I get **12 files / ~108 mentions** — `architecture-audit 26`, `demo-visual-plan 14`, `docs/schemas/database-model.md 12`, `walkthrough 8`, `implementation_plan 8`, `portal-v1-specification 7`, `phase-02 7`, `phase-01 7`, `DESIGN 6`, `api-contracts 5`, `domain-rules 4`, `v1-architecture-plan 4`. `docs/current-architecture.md` → **0**, not the 2 RV-F prints | **UPHELD in substance / UNREPRODUCIBLE as printed** | **MINOR → MAJOR** (footprint is ~2.3× the reported one) |
| **F-A1** | Day 1 "Run prisma validate" has no such npm script; `npm run check` is a superset of the CI list | `package.json:10-26` → 16 scripts; no `prisma:validate`, no `prisma:migrate`, no `test:coverage`, no `verify:out`; `check` = `format:check && lint && typecheck && test` (`:24`) ✓. Extra hazard RV-F did not connect: `prisma.config.ts:1` is `import "dotenv/config"` and `grep -n dotenv package.json` → **absent**; it resolves only via npm hoisting, so the very command Day 1 gates on depends on an undeclared dependency | **UPHELD** | **MINOR** |

---

## 3. F4 in detail — the one finding I can downgrade

**What is true (reproduced):** `next.config.ts:10-18` does hard-fail at **config load** on exactly 4
server-mode variables; `deploy.yml` provides no `env:` and has no secrets; the plan never asks for
them; `npm run build` is `build:server`, so an executor adding "build" to CI as Day 1's Phase 0
literally says hits that gate.

**Why it is not a BLOCKER:**

1. **Nothing needs real secrets — only shaped values.** A second, *stricter* schema exists at
   `src/server/config/env.ts`: `:5-14` `postgresUrl = z.string().url().refine(startsWith
   postgresql://|postgres://)`, `:62-79` `serverRuntimeEnvSchema` (adds `ALLOWED_ORIGINS` with a
   localhost default `:69`, `LOG_LEVEL`, `READINESS_TIMEOUT_MS`). Crucially, the tracked
   **`.env.example:9,16,17,23` already satisfies both schemas**: a `postgresql://…` URL, a valid
   `NEON_AUTH_BASE_URL`, and two 42-character placeholder secrets (≥ `.min(32)`). A CI step of
   `cp .env.example .env` closes F4 completely. `next-target.mjs:24 loadEnvConfig(projectRoot,…)`
   makes that work without any next.config change.
2. **This masks the problem locally, which is why the plan never saw it:** `.env` **is present** in
   the worktree (1,083 B, mtime Aug 23, gitignored at `.gitignore:13`) — every local `build:server`
   has been passing on the author's machine, so the requirement is invisible until CI.
3. **A live database is not needed at build time.** The server twin short-circuits static
   generation: `src/runtime/adult-portal-server.ts:74-80` `listStaticOrganizationIds()` /
   `listStaticClassIds()` return `[]`, and every data reader awaits `connection()` before touching
   Prisma (`:10-14`), so prerender cannot reach the DB. Shaped env ⇒ plausibly green build.
   (Static analysis; no build run.)
4. **RV-F's own suggested dummy is wrong.** The report's "judgment" proposes
   `DATABASE_URL=https://example.invalid` — that passes `next.config.ts:14` but **fails**
   `env.ts:8-13`'s PostgreSQL-scheme refine, i.e. it would break the very CI job it is meant to fix.
5. **The decision the reviewer says nobody owns is already made.** `docs/architecture-audit-2026-09-23.md:741-742`
   — the artifact §6's own header cites as the plan's basis — states the PR gate set as
   "`format:check`, `lint`, `typecheck`, `typecheck:demo`, `test`, `build:demo`, artifact-shape check.
   **`build:server` when secrets are available.**" §7.3/§7.4 contradict repo policy by demanding both
   builds on every PR. So the fix is to *cite* the existing policy, not to provision secrets. RV-F
   quotes `:744` (size budgets) from this very file but never `:741-742`.

**Corrected severity: MAJOR (missing one-line CI prerequisite + a policy conflict), not BLOCKER.**

---

## 4. F3 in detail — where RV-F is right, and the half it missed

Confirmed compile-time coupling today: `turmas/page.tsx` is an **async Server Component**
(`:7`) that calls `getClassesPageData()` at `:8` from `@runtime/adult-portal` (`:3`) and renders
`<ClassesScreen … runtimeMode={getRuntimeMode()} />`; `src/runtime/adult-portal-demo.ts:15-18`
serves that same specifier from `DemoAdultPortalStore`, whose read path special-cases the build
(`adult-portal-demo-store.ts:347 if (typeof window === "undefined") return cloneSeed()`), which is
why `out/portal/turmas/` contains 4 prerendered `index.html` files today (the list page + exactly
the 3 seeded classes `demo-turma-3a`, `demo-turma-4a-campos`, `demo-turma-5b`; nothing a demo user
creates gets a page).

Two consequences the reviewer's chain does not reach:

- **A client-only seam fixes only half the problem.** The 9 aliases carry ≥12 *build-time page-data
  readers* consumed by **11 server files under `src/app/`**, not just the 17 client-side mutations in
  **12 components**. Removing the alias set without a compile-time selector breaks
  `build:demo`'s prerender/`generateStaticParams` path even if every form were rewritten to `fetch`.
  RV-C's F3/4.1 counted this ("the choice must be made before the bundle exists"); RV-F's F3 does not
  mention it, which is why RV-F's F3 reads as a `useActionState` problem rather than a whole-graph one.
- **`await import()` behind a mode check probably does not rescue option (i) either.**
  `node_modules/next/dist/export/index.js:375-379` decides on the *compiled*
  `server-reference-manifest` (`.next/server/server-reference-manifest.json` currently registers
  **17** action ids; 24 exported across 7 `"use server"` files — verified with
  `node -e require(...)`), so any variant that survives into the demo graph registers an id and
  aborts the export late, after compile+prerender. There is no `serverActions: false` switch.
  Static analysis only — no build executed.

**Implication for the real (non-demo) build if the seam goes client-only:** the 17 live mutations
would need 17 new POST handlers. The repo has 4 route handlers total
(`src/app/api/v1/player/{bootstrap,state,results,active-time}/route.ts`), all `export const POST`
(grep → no GET/PUT/PATCH/DELETE anywhere), and all 4 are **untracked** (`git ls-files --others`).
A client-only transport also moves cookie-authenticated mutation state behind
`ALLOWED_ORIGINS`/CSRF concerns that Next's built-in server-action origin check handles today.
That is a new API layer §2/§3/§4/§6 never prices. ⇒ The only demonstrably-working selector today is
a build-time one (the `out/` artifact proves it), which is exactly what §7.2 forbids — so §7.2 and
§7.5 are in direct conflict, not merely under-specified. **BLOCKER stands.**

---

## 5. Corrected Day ordering (my own, after independent sequencing)

I agree with RV-F's diagnosis and mostly with its remedy; three amendments are mine.

- **Day 0 (half day).** Two commits: (a) the 30 untracked `src/` files (5,090 lines, `git ls-files
  --others --exclude-standard src | wc -l` → 30, `xargs wc -l` → 5,090 ✓) **together with**
  `prisma/schema.prisma` and the untracked `4_v1_game_state`/`5_v1_game_events` migrations, so schema
  never leads its history; (b) the 33 modified files. Baseline *in-repo*: 17 files >400, 234 anchored
  call sites / 6,579 test LOC / 33 files, `out/` = 554 files + top-level dir manifest, tsc error count,
  eslint warning count, `npx prisma migrate diff --exit-code`. Add `ci.yml` (`pull_request` +
  `push: main`) running `npm run check` + `prisma validate` + `prisma generate` + `build:demo`;
  **`cp .env.example .env` before any server build**; keep `deploy.yml` deploy-only; all of it on a
  branch (`main` is 8 ahead — do not push mid-purge).
- **Day 1.** §2.1(1) `ActivityStatus`; §2.1(2) → **remove the auditoria page** (option (a) is void, F13);
  §2.1(3) → **delete `service-container.ts`**; add `authorization.test.ts` to §2.4 (or budget its
  port to `v1-policy.ts` as its own task); §2.5 **plus a `6_drop_generation_a` migration** (tables at
  `0_init:58,90`, enum values at `0_init:8` — note `ALTER TYPE … DELETE VALUE` cannot drop values
  present in rows, so state the retention decision) **plus a `CapabilityAssignment` decision**
  (`schema.prisma:245`, whose only readers §2.3 deletes); then delete; then
  `prisma validate && prisma generate && rm -rf .next .next-demo-dev tsconfig.tsbuildinfo &&
  npm run typecheck && npm test && npm run build:demo`.
- **Day 2.** Write the seam decision down **first**, covering both halves (data readers *and*
  actions); if the answer is "keep exactly one typed build-time selector", amend §7.2's wording the
  same day — the audit's `:747-748` ("No *new* `@runtime/*` alias" + a lint rule) is already the
  compatible formulation. Refactor the demo store **with its 4 `@/runtime/adult-portal-demo-store`
  test files**. Gate `build:demo` + `build:server` + `npm test` before any CSS work.
- **Day 3.** One gate per file, not per day: offline-sync (repoint `game-offline-sync.test.ts:16`),
  game-host, navigation presenter, CSS **including `public.module.css` (1,017) and
  `marketing.module.css` (688)** — or amend §7.1's ceiling to the audit's own budgets (`:744-746`).
- **Day 4.** `rm -rf out && npm run build:demo`, then a **route-manifest / file-count diff against
  the Day-0 baseline** (that is what actually proves the 6 trees left), a `grep -c "/SMS_Portal/"
  out/index.html` asset-prefix check, `build:server` with the placeholder env, and the doc sweep
  (12 files, ~108 mentions) — which §6 currently does not schedule at all.

---

## 6. Where reviewer F overreached

1. **"4 secrets" framing for F4 (BLOCKER → MAJOR).** No secret is required; `.env.example` is a
   ready-made CI placeholder, and the repo's own audit (`:741-742`) already decided `build:server`
   runs "when secrets are available". Its own dummy example would fail the runtime schema.
2. **Test-case arithmetic mixes two measurement methods** (anchored numerator 78, loose denominator
   236). Consistent numbers are 78/234 = 33.3% and 102/234 = 43.6%. The conclusion survives; the
   precision does not — and the slip is the exact defect RV-F indicts §7.1 for (F18).
3. **"4th-largest suite in the repo"** — `authorization.test.ts` is 3rd by lines, 2nd by cases.
4. **"7 migration dirs exist"** — `find prisma/migrations -maxdepth 1 -type d | wc -l` → 7 including
   the parent, i.e. **6** migration directories (their `wc -l == 7` files check is right).
5. **F20's stale-doc counts** (8 files / ~46 mentions, with `current-architecture.md` 2) are not
   reproducible under any single command I tried; the true footprint is larger (12 / ~108) and
   `current-architecture.md` scores 0 for deleted-surface names.
6. **"§6 Day 2 alias removal has no stated replacement"** is stronger than the text: §3.1:121-125
   *does* state a replacement (`contracts.ts` + composition seam). The accurate claim is "the stated
   replacement is not compilable" — which RV-C's F4 proves and RV-F's F3 does not argue.
7. **F15 ("user-visible on GitHub Pages")** ignores that `main` is 8 commits ahead of `origin/main`;
   publishing needs a deliberate push. Real risk, wrong immediacy.
8. **E625 evidence is thinner than it could have been** — RV-F cites the docs table and states it
   "did not run a build"; the enforcement is 8 lines of readable code at
   `node_modules/next/dist/export/index.js:375-383`, and the current build's manifest (17 ids) is on
   disk. Verifiable read-only, and it converts "judgment" into "measured".
9. **Occasional citation drift:** `0_init/migration.sql:8` covers only the `capability` enum (tables
   are at `:58`, `:90`); `static-exports.md:275-294` should be `:274-296`; `package.json:12` (Part E,
   "`npm run build` is `build:server`") is actually `:13`, and Part H item 1's "`package.json:16-20`"
   for `build:demo`/`build:server`/`typecheck`/`test` should be `:14,15,20,21`. All harmless, all
   would fail a spot-check — which matters because the report's own F18 indicts §7 for exactly this.
10. **Self-reporting gap:** §0's summary table lists F1 as "`service-container.ts:4-5`" while the
    body (§F-F1) correctly says `:1` and `:4`. The body is right; the headline is not.

---

## 7. Additional gate failures the reviewer missed

1. **§7.5's `out/api/` assertion is unfalsifiable by construction, not merely already-true.**
   Next's exporter drops route handlers before path-mapping
   (`node_modules/next/dist/export/index.js:249-256 if (isAPIRoute(page)) { hasApiRoutes = true; continue; }`),
   **and** all four existing handlers export only `POST` (grep `^export` over
   `src/app/api/v1/player/*/route.ts` → `runtime` + `POST` ×4, zero GETs), so no static file could
   ever be emitted under `out/api/`. Even the reviewer's improved `! -d out/portal/atividades`-style
   checks miss the discriminating assertion: the demo build's
   `.next/server/server-reference-manifest.json` must contain **0** action ids — that is the only gate
   that catches the actual regression class.
2. **The local `.env` asymmetry** (present, 1,083 B, gitignored) explains *why* F4 is invisible to the
   plan and is the reason the fix is `cp .env.example .env`, not GitHub Secrets.
3. **A second, stricter env schema the plan and the review both ignore** — `src/server/config/env.ts:5-14,62-79`.
   Any CI placeholder must satisfy both files; they disagree (`url()` vs PostgreSQL-scheme refine).
4. **§7.2 vs §7.5 are in direct conflict**, not just under-specified: satisfying "no `@runtime/*`
   file-swapping aliases in `next.config.ts`" while keeping `build:demo` green requires either a
   generated `target.ts` (a selector under another name — §7.2 is gameable) or a new HTTP mutation
   layer for 17 actions. No row in §6/§7 covers either.
5. **`CapabilityAssignment` (`schema.prisma:245`) becomes a live table with zero code readers** after
   §2.3 deletes `prisma-capability-reader.ts` and `authorization-service.ts`, and
   `Organization.scopedCapabilities` (`:79`) keeps it wired into the model graph — so `prisma validate`
   stays green while the purge strands a table. (RV-A §353 and RV-B R5 caught the table; RV-F caught
   only the two `Capability` enum values, F14.)
6. **Day 1's own chosen gate can lie in both directions**: `.next/types/**` and
   `.next-demo-dev/types/**` are in `tsconfig.json:45-55`'s `include`, so stale route types for the six
   deleted trees can mask errors, and `npx prisma validate` — the other Day-1 gate — runs on an
   **undeclared** `dotenv` dependency hoisted from `package-lock.json` (`prisma.config.ts:1`), so the
   gate is not reproducible on a clean `npm ci` with different hoisting.
7. **No gate typechecks `scripts/next-target.mjs`**, which is the code that decides whether the demo
   leaks secrets (`:41-53`) and whether `AUTH_DEV_BYPASS` reaches a production build (`:39`):
   `tsconfig.json:5 allowJs: false` plus `include: **/*.mts` keeps both `.mjs` files out of
   `tsc --noEmit`, and `eslint.config.mjs:6-16` registers only non-type-aware `next/core-web-vitals` +
   `next/typescript` + prettier configs, so at most lint style and formatting see them. §7.3's
   "tooling health" therefore cannot regress-detect the one script that guards the export (and it is
   the script RV-F's §3.4 asks the plan to *retain*).
8. **§7.1 exempts a file that does not exist yet** (`idb-store.ts` is a Day-3 output, `REFACTOR_PLAN.md:161`)
   while `src/contracts/v1/schemas.ts` (481 lines, hand-written GameMaker protocol, no `@generated`
   marker) may or may not be "third-party schemas" — the criterion's two named exceptions are one
   future file and one ambiguous present file, so the gate's own scope is undecidable on Day 4.
9. **The repo already prescribes gates the plan omits**: `docs/architecture-audit-2026-09-23.md:626,741-748`
   asks for `typecheck:demo` (no such script in `package.json`), an `eslint-plugin-import` boundary
   rule, "no *new* `@runtime/*` alias", and budgets with a "new or modified files only" ratchet.
   §7.1 contradicts the ratchet and §7.4 omits `typecheck:demo` — the only gate that would have
   caught the alias-twin drift RV-F correctly notes is never checked (F-D3/R13).
10. **`out/` freshness cuts the other way** — because the export post-dates every source edit, Day 4's
    `build:demo` "verification" can be satisfied by re-reading a stale artifact: nothing in §6 says
    `rm -rf out`, and CI (which does rebuild) is not the environment Day 4 names.

---

## 8. Items I did not re-adjudicate

RV-F's F16/F17 (§2.5 "~6,450" total; §2.3 "Verified Lines" mixing raw vs blank-stripped), F21 (§3.2's
`exclude` speed-up claim), F22 (IndexedDB versioning) and its Part C untracked-file table are outside
my assignment. Spot checks I did run corroborate the surrounding claims: §2.5's `:65`/`:80`
inverse-relation refs are exact, the 30/5,090 untracked `src/` figure is exact, and
`src/contracts/v1/schemas.ts` really is hand-written (no generated marker) at 481 lines.

**Reproduction rate on the assigned scope: 13 of 13 findings located; 11 upheld as stated or with
sub-count corrections, 2 requiring downgrade/precision fixes, 0 refuted outright.**
