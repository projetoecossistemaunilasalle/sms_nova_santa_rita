# ADV-1 — Attack on the consolidated sequencing and integration (P1..P4)

**Agent:** ADV-1 (approach-level adversarial pass; NOT a re-verification of `INV-*`/`VER-*` measurements)
**Date:** 2026-09-23
**Target:** the four-phase approach consolidated from `docs/refactor-dossier/reports/` (12 reports, 6,431 lines), applied to `REFACTOR_PLAN.md` v2.1 §2–§7.
**Method:** read-only against the repo. Commands run: `git log/status/ls-files/rev-parse/check-ignore`, `wc`/`grep`/`find`/`comm`, `npx prettier --check .`, `npx tsc -p tsconfig.json --noEmit --incremental false --listFilesOnly`, and one deliberate **false-positive test** of `typeof import("./missing.js")` in a scratch project at `C:\tmp\ADV1_probe\` (outside the repo, using the repo's TS 6.0.3 and the repo's exact `compilerOptions`).
**Tree state at start and end:** `main` = `origin/main` = `e5aaf1e`; `git status --short` → `?? docs/refactor-dossier/` only. `tsconfig.tsbuildinfo` md5 `252a0a7726f8e6d88e4fa82633cb4796` before and after (`--incremental false` used throughout). No `next build`/`dev`, no Prisma DB command, no write into `.next*`/`out`.

---

## Verdict on the consolidated sequence

**The phase *contents* are sound and I am not overturning any of them. The *boundaries* are wrong in three specific ways, one of which makes the plan unexecutable as written.**

1. **Day 0 has a hard dependency inversion (biggest error).** `INV-F`/`VER-F` make `ci.yml` the first merge, "alone", so that every later PR is gated. But `npm run check`'s **first leg already fails on `main`** for a reason unrelated to the refactor. I re-ran it: `npx prettier --check .` → `[warn] REFACTOR_PLAN.md`. It is the *only* failing leg (lint/typecheck/test green, per `VER-F` 6b). Therefore `ci.yml` merged "first and alone" is **born red**, which means either (a) branch protection requiring it blocks every subsequent merge — including the purge PR — or (b) the team disables protection mid-sprint, which is precisely the state in which red windows land on `main` and get published to GitHub Pages. The whole red-window analysis exists to prevent (b); the ordering guarantees it. `VER-F` D2 discovered the red leg and still recommended `ci.yml` first. Two commits must precede it, and one of them is the fix `INV-A` E9 proposes *instead* (editing `REFACTOR_PLAN.md`), which is forbidden by the corpus's own scope rule (`CRITIQUE-governing-conflicts.md:6`).

2. **P1→P2 is serialized on a claim that is false, and the real P2↔P3 coupling is mis-measured by ~2×.** `INV-F:826-831` justifies "P1 before P2" with "the alias table has 9 entries, 2 of which point at files §2 deletes", and justifies "P2 before P3b/P3d" with "the 22 `portal.module.css` importers include **20 of the 23** files holding `@runtime/` imports". Both numbers are wrong, and I checked them mechanically rather than by reading:
   - **All 18 alias targets (9 server + 9 demo variants) survive the purge.** `comm` of the 46-path purge set against the 18 files named in `next.config.ts:44-79` and `tsconfig.json:24-42` → **0 overlap**. `INV-A` C6 and `VER-A` C6 established this and `INV-F` contradicted it anyway. So **P1 and P2 are file-disjoint** — the two `@runtime/`-importer lists I diffed (`src`+`tests`) share nothing with the deletion manifest — and the Day-1/Day-2 serialization buys nothing.
   - **The true P2∩P3d overlap is 9 files, not 20.** `comm -12` of the 23 `@runtime/` files against the 21–22 surviving `portal.module.css` importers returns exactly 9 (`class-detail-screen`, `classes-screen`, `deactivate-organization-control`, `demo-role-controls`, `organization-detail-screen`, `organizations-screen`, `player-access-workflow`, `portal-shell`, `team-screen`). 14 of the 23 seam files touch **no** portal CSS at all (they are the 12 server `page.tsx`/`layout.tsx` route files plus `use-demo-portal.ts` and `player-entry-screen.tsx`), and `game-host.tsx` imports `public.module.css`, not `portal.module.css`. The conclusion "P2 before the CSS split" survives — but for a reason **no agent in either corpus stated** (see §4 below), and the published reason is refutable in one command. Anyone who checks `20` and finds `9` will discount the whole ordering argument.

3. **P2's own chosen mechanism creates P2's two biggest risks and its biggest fresh-clone blocker.** The barrel hop (`R1`, the dossier's self-declared top unknown), the "stale mode during `build:server`, caught by NOTHING" hazard (`VER-B` row 20), the absent-file TS2307×23, the `.gitignore`/`.prettierignore`/prettier-clean/two-dev-servers rows — all seven failure modes in `VER-B`'s generated-file hazard table are *artifacts of the generated file*, not of the problem. The discriminating work in P2 (`contracts.ts` + explicit named export list + the non-imported parity file + a `typecheck:demo` script + the boundary lint rule) is **mechanism-independent**, and `VER-B` claim 17 proves the mechanism adds no discriminating power on its own: typechecking the entire `src/` graph against all nine **demo** variants yields **0 errors**, so neither the alias nor the generated file detects drift — only the parity file does. P2 is therefore splittable, and the part that sits on the critical path is the part that is *optional*. See §Recommended ordering.

4. **Sequencing nobody scheduled: the typecheck program is polluted by gitignored build artifacts that statically import the files P1 deletes.** I verified this end-to-end and it is the single most likely mid-sprint false alarm:
   - `npx tsc --listFilesOnly` (1,706 files) contains **12 files from three artifact dirs**: `.next/types/`, `.next/dev/types/`, `.next-demo-dev/dev/types/` — each contributing `cache-life.d.ts`, `root-params.d.ts`, `routes.d.ts`, `validator.ts`.
   - Each 448-line `validator.ts` contains **20 `typeof import("../../../src/app/…/page.js")` references into §2.2's deleted route trees** (`…/portal/admin/auditoria/page.js`, `…/portal/atividades/[id]/compartilhar/page.js`, `…/(public-play)/atividade/[token]/layout.js`, …).
   - I proved the consequence rather than asserting it: in `C:\tmp\ADV1_probe\`, a file containing `const h = {} as typeof import("./does-not-exist/page.js")`, checked with the repo's TS 6.0.3 under `moduleResolution: "bundler"` + `noEmit` + `strict`, yields **`error TS2307: Cannot find module './does-not-exist/page.js'`**.
   - ⇒ **Day 1's `npm run typecheck` produces up to 60 spurious TS2307s on any machine that has ever run a build**, before the one real purge error appears. `VER-A`'s headline proof ("delete all 46 with zero edits → exactly one `tsc` error") is valid but was run in scratch trees **without `.next`** — it validated the fresh-clone shape, not the developer shape, and it is the most-cited single result in the dossier.
   - The fix is **not** what `VER-F` D6 implies. Deleting the four artifact globs from `tsconfig.json:45-54` does not make `typecheck` hermetic, because `include` also has `"**/*.ts"` and **`exclude` is only `["node_modules"]`** (`tsconfig.json:55`) — `**/*.ts` already matches the 14 `.ts` files under `.next*` on disk. One `exclude` line (`.next`, `.next-demo-dev`, `.next-demo-build`) fixes both the Day-1 false red **and** the CI-vs-local asymmetry (route-shape regressions then rest with `next build`, which does typecheck with the artifacts present — `INV-F:444-448`).

**Net:** the ordering is defensible but the *reasons* published for it are not, two of the three load-bearing numbers are wrong, the first merge is impossible, and one unlisted artifact interaction will burn hours on Day 1. Rebuild P0, split P2, and the rest composes.

---

## Cross-phase collision map (file × phase, with rework calls)

Legend: **1** = P1 purge, **2a** = P2 types/contracts, **2b** = P2 repoint + alias deletion + form→CC, **3a** = offline split, **3b** = game-host decomposition, **3c** = service shell-view-model/guards, **3d** = CSS purge/extract, **4** = gates/docs.

### Multi-phase files, ranked by cost of getting the order wrong

| # | File (lines) | Phases touching it | Concrete overlap | Rework call |
| :-- | :-- | :-- | :-- | :-- |
| 1 | `.next/types/validator.ts` ×3 copies (448 ea) | 1 | 20 stale `typeof import()` per copy → **60 false TS2307** at Day 1's own gate | P0 `exclude` fix, *or* `rm -rf .next .next-demo-dev` before every `tsc` in P1. Not optional. |
| 2 | `src/components/public/game-host.tsx` (932) | 1?, 2b(`:24`), 3a(step A8 `:26-31`), 3b(B3 `:48-101`, B4 `:837-931`, B5 `:288-367`), 4 | **5–6 edits to one file across 3 lanes, in a 23-line import window (`:24`–`:46`) that all three first-touch** | Merge 3a's repoint *into* 3b's step 3 (both must edit the header anyway). 2b's one-liner is unavoidable but see row 12 — it is a §7.1 trap. |
| 3 | `src/components/portal/portal-shell.tsx` (104) | 2b(`:7` repoint + `:59-77` → `sign-out-button.tsx`), 3c(`:44,52` `shell.navigation` shape), 3d(`:16`, **14 classes** incl. `.sidebar` carrying `--focus-ring-color:7`) | 3 phases; and 2b **relocates `styles.logoutButton` into a new file**, which invalidates `VER-E`'s sole-owner assignment for that rule | 2b-form→CC must land **before** 3d's owner map is recomputed; 3c's prop-shape change must land **before** 3b/3d re-touch the JSX. One "shell" commit, not three. |
| 4 | `src/components/portal/player-access-workflow.tsx` (540) | 2b(`:17-22`, 4 actions), 3d(`:27`, **28 classes**, biggest single consumer → `player-access.module.css` ≈527 projected), 4/§3.3 | **A 540-line §7.1 FAIL that 2b modifies with no §4 decomposition step** → the ratchet (`REFACTOR_PLAN.md:246` "new **or modified** files") flips it from exempt debt to a fresh FAIL | Either 3d/workflow-decomposition before 2b, or — cheaper and correct — ship the §7.1 **baseline allowlist** in P0 so a one-line import edit cannot create a FAIL. `VER-F` identified the risk class; nobody scheduled the mitigation. |
| 5 | `src/components/portal/team-screen.tsx` (411 physical / 406 non-blank) | 2b(`:11`, 4 actions), 3d(`:30,31` dual-imports its own module + portal) | **3 lines over the 400 component ceiling, and 2b modifies it.** `INV-F` OQ6 already spotted the tension with §2.1's "zero JSX churn"; the seam edit is the churn that breaks it | Same as row 4: baseline allowlist in P0. Do not split a 411-line screen to satisfy a ratchet on a 1-line change. |
| 6 | `src/components/portal/status-badge.tsx` (32) | 1(E1 whole-file replace), 3d(`:3` styles import; `.statusBadge`+4 tones = 1 consumer) | 1 + 3d touch the same 32-line file | 1 first (unavoidable: 1 kills `.statusWarning`/`.statusDanger`, and 3d purges them). Cost: 1 extra line in 3d. Acceptable. |
| 7 | `src/runtime/adult-portal-server.ts` (80) | 2a/2b (**absorbed into `readers.server.ts`, then deleted**), 3c(`:29,54,65` switch `getShell()`→`getActorRole()`) | **2b moves the file and 3c edits the moved copy** — the classic "move code a later phase deletes" | Do 3c's `getActorRole()` addition **first**, on the file that exists, so 2b moves the final content. One-line reordering, zero rework. |
| 8 | `src/runtime/adult-portal-demo-store.ts` (1,024 FAIL) | 2a (demo readers re-home over it), §3.3 (per `VER-F`: plan `:141` edits it), 3? (**no §4 step**) | A 1,024-line FAIL edited by two phases with no decomposition owner → guaranteed fresh §7.1 FAIL | P0 baseline allowlist, or state it as accepted debt with a named slice. `VER-F` made this call; the consolidated plan dropped it. |
| 9 | `src/components/portal/portal-navigation.tsx` (137) | 3c(`:60-125` deleted → `buildNavigation`), 3d(`:11`, 6 classes), 1(E8-adjacent) | 3c deletes 65 lines out of the file 3d is simultaneously re-pointing classes in; `:37` phantom `mobileNavItem` is a 3d fix that also touches `:58-125` | 3c then 3d, one commit. |
| 10 | `src/components/portal/portal-shell-context.tsx` (78) | 3c(`:10-16` `roleLabel`), 3d(`:8`, 3 classes) | same lane pair as row 9 | 3c then 3d. |
| 11 | `src/components/portal/adult-portal-helpers.ts` (317 WARN) | 1(`:136-138` dead branch, `VER-A` A1), 3c(`:98 demoScopeLabel` delegates to `buildScopeLabel`), and `:15 recordStatusLabel` is the reason E1 is safe | 3 phases on a 317-line WARN that both 1 and 3c *modify* → §7.1 warn bites | Batch 1+3c edits in this file; it is 3 lines + a delegation. |
| 12 | `src/app/(professional)/entrar/page.tsx` (107) | 2b(`:8` repoint + `:73` form → `sign-in-form.tsx`) | **2b creates a new importer of `marketing.module.css` (688 lines, §7.1 FAIL, outside §4.1's title)** — 12 classes move (`form`, `field`, `submit`, `authForm*`, `brand*`) | Same class-ownership note as row 3: 2b-form must precede 3d. And §4.1 must be widened to name `marketing.module.css` or the FAIL is silently grown. |
| 13 | `next.config.ts` (82) | 2b(`:42-80` delete), P0/`VER-F` fix (`:26-28` demo `distDir`), 3a(step A8 gate the offline import by `runtimeMode`) | 3 phases, same 5-line window | P0 owns it once. `distDir` for all demo phases is a 1-line change that makes the §7.2 manifest assertion order-safe **by construction** instead of by discipline. |
| 14 | `tsconfig.json` (56) | 1?, 2a (`typecheck:demo`), 2b(`:24-42` delete), Day-2 item (`:55` exclude `src/generated/**`), P0 (my `exclude` `.next*` fix) | 4 edits to one small file | P0 does all of them at once. |
| 15 | `package.json` + **`package-lock.json` (507 KB)** | P0 (`typecheck:demo`, `node-version-file` parity), 2a/2b (`pregenerate`/`postinstall` if the seam is generated), 3a (**`fake-indexeddb` devDep**), 4 (`max-lines` tooling) | **Four phases edit `package.json` and therefore the lockfile.** The consolidated plan says "one PR per day"; parallel PRs each regenerating `package-lock.json` will conflict on the single largest file in the repo, and a hand-resolved lockfile is exactly the artifact no gate in `ci.yml` validates | Serialize all dependency/script-manifest edits into P0 and 3a; land the rest as `--no-audit --no-fund` touches. Nobody in 12 reports mentions the lockfile. |
| 16 | `tests/unit/auth.test.ts` (189) | 1(`:146,147,154` route strings), P0(`:161-165` `delete process.env.APP_RUNTIME_MODE`), **2a (new hazard, below)** | 3 phases, one 25-line window | See next row — this one has a trap. |
| 17 | `src/runtime/mode.ts` (17) via 2a's `TARGET_MODE` gate | 2a | `VER-B` prescribes `if (TARGET_MODE !== getRuntimeMode()) throw` **inside `readers.server.ts`/`target.server.ts`**. Written at module scope — the natural shape — it recreates the exact pattern (`portal-view-service.ts:7 const demoRuntime = isDemoRuntime();`) that `VER-F` D1 proved makes the suite order-dependent, and 2a's own headline payoff (`tests/unit/runtime-target.test.ts` importing `@/runtime/target`) then becomes a **worker-order-dependent red that looks like a product bug in `mode.ts`** | Post-P1, `auth.test.ts:161-165` has **no surviving module-scope victim** (I grepped: the only module-scope `getRuntimeMode()/isDemoRuntime()` calls in `src/` are `portal-view-service.ts:7` [deleted] and inside function bodies), so D1 is currently latent — 2a is what makes it live. Fix in P0 (save/restore), **and** put the `TARGET_MODE` assert inside the exported functions, not at module scope. |
| 18 | `REFACTOR_PLAN.md` (unformatted) | P0 (`format:check`), 1(E9 proposes patching it), 4("fix stale docs") | `INV-A` E9 and `VER-A` A5 both resolve the red leg by **editing the plan**; `CRITIQUE:6` and the dossier's whole posture say the plan is fixed input | `.prettierignore` += `REFACTOR_PLAN.md`. One line, no policy violation, and it is also the *only* fix that survives the plan being re-exported by other tools. |
| 19 | `.gitignore` / `.prettierignore` / `eslint.config.mjs` | P0, 2a/2b, 3d (`styles.X` resolution script), CRITIQUE C5 (boundary rule) | small, but 4 phases each add a line to files nothing else gates | P0 owns all three. |
| 20 | `docs/schemas/database-model.md` (196) + `README.md:53` + `current-architecture.md:176` + `walkthrough.md:11` + `.env.example:22-23,26` | 1 creates the staleness, **4 does not own it** (`REFACTOR_PLAN.md:239` names only README + `current-architecture.md`) | unclosed hand-off, plus two already-false doc claims (`README.md:53` and `current-architecture.md:176` both advertise `/health/*`; `src/app/health/{live,ready}/` are **empty untracked directories** — I confirmed 0 files) | Add to P0's doc ledger so the "already false" items are not attributed to the purge. |

### Files P2 deletes vs files P3 splits — the ordering question the prompt asks

`VER-D`: the whole 1,222-line offline engine is **dead in the demo yet shipped** (`out/jogar/index.html` → chunk `0pvtinj9q2oay.js`, 46,032 bytes, contains `missoes-caramelito-game-v1`). It is also **not aliased and has no twin**, so P2 does not touch it. Therefore *P2 will never delete or relocate `game-offline-sync.ts`* and there is no "split a file P2 deletes" collision — that fear is unfounded.

The real collision is **3a vs 3b, on `game-host.tsx`**, and **3a vs the unscheduled packaging decision**. If the engine is ever gated behind `runtimeMode` (an option 3a's own inventory explicitly recommends, with the bundle win measured), the composition root moves (`openGameOfflineStore` 493-506 into `offline/index.ts`), which is a *file-layout* decision. Doing the 7-file cut **before** deciding that means cutting again. So: **decide the demo-bundling question at the start of P3, not in P4.** No phase in the consolidated plan owns it; `P4` owns only the deep-link question, which is a different (and cheaper) decision because `VER-F`/`VER-F§7.5` proved option (c) is *already implemented* at `classes-screen.tsx:140,169-180` and `organizations-screen.tsx:124,146`.

### CSS before or after the seam changes which components exist?

**After — and the argument is not the file-overlap count, it is ownership.** `VER-E`'s extraction method assigns every non-dead rule to "its live driver class" and, for single-consumer classes, to "the sole surviving owner file". `P2b`'s form→Client-Component conversions **create two new owner files** (`sign-in-form.tsx`, `sign-out-button.tsx`) and **move 12 marketing classes and `styles.logoutButton`** into them. That changes:
- the 27 shared-class census (`button`: 4 consumers, `input`: 4, `field`: 5 — `entrar/page.tsx` is not a portal importer, so `field`'s count is unaffected, but `confirmationDialog`/`formError` consumers shift);
- the **24-rule hazard set** (`VER-E` #24: rules with ≥2 live classes and no single surviving owner) — recomputing it is mandatory;
- the projected per-file line budgets, which are the only basis for `VER-E`'s "500 warn / 750 fail" recommendation.

So: run the seam's *component-creating* half first, then take `VER-E`'s E0 golden dump. That is the correct — and never stated — reason for P2-before-P3d. `INV-E:139` gestures at it ("Day 2 rewrites the shell JSX whose classes the residual keeps") but `INV-F`'s version of the argument (20/23 files) is the one that got consolidated, and it is wrong.

---

## Recommended ordering (and why it differs)

Not the plan's Day numbering. Six work packages, with the two changes of substance: **P0 rebuilt and front-loaded**, and **P2 split into 2a (types) and 2b (repoint), with 2b moved behind P3.**

### P0 — make the gate real before anyone leans on it (half a day, one PR, green at merge)

In this order, because every later item here assumes the previous one:

1. `.prettierignore` += `REFACTOR_PLAN.md`. **This is commit #1 of the entire refactor.** `npm run check` goes green with it; without it, every exit criterion in the plan is unsatisfiable and `ci.yml` is born red.
2. `tests/unit/auth.test.ts:161-165` — save/restore `APP_RUNTIME_MODE`/`NODE_ENV` instead of `delete`.
3. `tsconfig.json:55` — `exclude: ["node_modules", ".next", ".next-demo-dev", ".next-demo-build", "src/generated"]`. One line, three defects closed (§Verdict item 4). Note that this makes `npm run typecheck` *weaker than a build* on purpose; say so in the plan file's own words in `ci.yml`'s comment, and keep `next build`'s built-in typecheck as the route-shape gate.
4. `next.config.ts:22-32` — demo `distDir: ".next-demo-build"` for **all** demo phases, not only `PHASE_DEVELOPMENT_SERVER`. Makes §7.2's manifest assertion order-safe by construction (`VER-F` fix #3, which it raised as an open question and declined to commit to).
5. **§7.1 enforcement tool + baseline allowlist.** This is not hygiene, it is what keeps 2b and 3 legal: without a baseline, P2's one-line import edits create three fresh FAILs (`game-host.tsx` 932, `player-access-workflow.tsx` 540, `team-screen.tsx` 411) and 3a's `idb-store.ts` at `REFACTOR_PLAN.md:165` ~650 exceeds the 500 module ceiling by the plan's own arithmetic.
6. Boundary lint rule (CRITIQUE C5): reject imports of `@/runtime/*-server.ts`, `@/runtime/*-demo*.ts` and any `"use server"` module from outside the seam + `contracts.ts`. **This is the guard that replaces the aliases' safety property after 2b removes them**, and its absence is the one genuine gap in `INV-B`'s design.
7. `typecheck:demo` script (a second `tsconfig` whose only delta is the seam pointer) + `vitest.config.mts`: `resolve.alias["server-only"]` → an empty stub, and `include` widened to `tests/**/*.test.{ts,tsx}` (today `vitest.config.mts:16` **cannot even discover a `.tsx` test** — `VER-D` "things missed" #2).
8. `ci.yml` **last**, with `pull_request`, `contents: read` only, no `DIRECT_URL` in any job (`VER-F` D3), and `node-version-file: .node-version`.
9. Record the baseline with `tsc --noEmit --incremental false` (not the 2.638 s cache hit `INV-F` recorded; cold is ~6.7 s) and note that the 26-document export count and the 17-id manifest count are both post-purge-valid: **P1 does not change the 17** (none of the 17 registered ids lives in the purge set — `VER-B`'s per-file dump proves it), so `REFACTOR_PLAN.md:210`'s "re-baseline" worry is moot for the manifest and live only for the exported-action count (24 → 18).

### P1 — purge, as two commits, not thirteen (0 h red)

`VER-A` proved by execution that the purge is a **single atomic green step** once E1 lands, and that INV-A's 13-step order is "safe but over-serialized". I agree, and I'd go further: one step in INV-A's list is actively harmful. **Step 4 runs `prisma generate` before steps 5–7 delete the code that imports `Capability`, `prisma.accessLink` and `Prisma.*` types for the dropped models** — that turns steps 4→7 into a 3-file-group red window (`access-link-service.ts:2`, `authorization-service.ts:1`, `prisma-capability-reader.ts`) that exists only because of the ordering.

- **C1.1** `status-badge.tsx` → the prettier-canonical 8-line form (`VER-A` §5.1), not `INV-A`'s 82-char snippet. Green standalone.
- **C1.2** everything else: 46 deletions, `proxy.ts:113` **only**, `auth.test.ts:146,147,154`, `adult-portal-helpers.ts:136-138`, `errors.ts:11`, `mode.ts:13-17`, `dev-bypass-gateway.ts:9` `export`, the **eight** `schema.prisma` deletions incl. `:97`, `migrations/6_drop_generation_a/migration.sql` (8 statements / 23 lines, hand-placed), **then** `prisma validate` → `prisma generate` → `rm -rf .next .next-demo-dev .next-demo-build` → `typecheck` → `lint` → `test` (27/182).

`RATE_LIMITED` stays deferred per `INV-C`/`VER-C` C13/C14 — but record the count honestly: post-purge **13 of 19** `ApiErrorCode` members have no emitter, and `contracts/schemas/api-error.v1.schema.json` is referenced by nothing but its own `$id`.

### P2a — types only, with P1, no shared files (0 h red)

`contracts.ts`, `target.{server,demo}.ts`, `readers.{server,demo}.ts`, `contracts.check.ts` (parity, `export`-bound so `--max-warnings=0` cannot bite), explicit named export lists (never `export *`), `server-only` on both reader variants with the header comment `VER-B` O1 demands, the 5 sync demo readers made `async` (`adult-portal-demo.ts:15,19,31,61`, `player-access-demo.ts:14` — **5, not 6**), the four `listStatic*` left sync, and the `TARGET_MODE` assert **inside function bodies**. All additive. Nothing in P2a touches a file P1 or P3 touches, which is why it can run in parallel with the purge.

**Deliberately excluded from P2a:** the mechanism decision (§Where I think the areas agreed but are wrong, item 2) and the 23-file repoint.

### P3 — decomposition, resequenced internally

- **First:** the R1 spike (`VER-B`'s ≤20-minute 5-line probe, sequenced so one build answers R1 + merged-seam severity + side-effect pruning) **and the demo-bundling decision** for the offline engine. Both are stop-and-redesign gates; both must precede the file surgery they could invalidate.
- **3c** (`getActorRole()` in `adult-portal-server.ts`, `shell-view-model.ts`, delete `portal-navigation.tsx:60-125`, `portal-shell-context.tsx:10-16`, dedupe `authorizationActor` from `player-access/service.ts:15-25`) — **before** P2b moves `adult-portal-server.ts`.
- **3a** with `fake-indexeddb` (`VER-D`'s inversion — I agree; hand-rolling transaction-event ordering for T3 is re-implementing IndexedDB), and with **`T2`'s assertions rewritten to last-wins / fail-beats-recorded-value** (`VER-D` C5). Note `VER-D`: T2 as written in `INV-D` was *born failing*, and the consolidated plan's summary still says "with `fake-indexeddb`, whose assertions must be written against the real last-wins/abort semantics" — correct, but only because `VER-D` caught it; the plan text still carries `INV-D`'s wrong version.
- **3b** the safe subset only (`demo-game-adapter.tsx:16-20` 5-line schema fix incl. the `game-host.tsx:652` second hardcode, helpers, chrome **carrying the `public.module.css` import**, presenter + T7), refusing the hooks split, and **filing H4 (launch-token renewal coalescing) and H5 (`handleFrameLoad` not clearing `syncPromise`/`handledConflicts`/`pendingConflict`) as named behaviour tickets with an owner** — "refuse" without a ticket is how both become permanent.
- **3d** CSS last, with the golden dump taken **after** P2b's component creation (see §collision map), widened to name `public.module.css` (1,017) and `marketing.module.css` (688) — the two §7.1 CSS FAILs §4.1's title silently excludes.

### P2b — repoint and delete, after P3 (this is the inversion)

24 import statements in 23 files → `@/runtime/target` / `@/runtime/readers`; create `sign-in-form.tsx` + `sign-out-button.tsx`; delete the 18 alias lines and the 11 absorbed runtime files. **Why after P3:** the 9-file P2∩P3d overlap plus `game-host.tsx` = 10 files whose import headers P3 rewrites anyway, so repointing after P3 means **one header edit per final file instead of two**; and the new Client Components land *before* 3d's owner map is recomputed only if you split them out — see the tension below.

**The one thing this ordering costs:** P2b's form→CC conversions create the owner files that 3d's map depends on, so 3d must run after P2b — while the 23-file repoint wants to run after 3d. **Resolve it by splitting P2b:** `P2b-i` = the two new Client Components (small, 2 files, changes ownership; do before 3d); `P2b-ii` = the mechanical 23-file repoint + alias deletion (do after 3d). That ordering has no cycle and zero double-edits, and it is the actual answer to "which phase order is right".

### Red-window estimate per ordering

| Ordering | `npm run check` red commits | Longest red window | Pushable to `main` ungated? |
| :-- | :-- | :-- | :-- |
| Consolidated (P1→P2→P3→P4, ci.yml on Day 0) | **every commit from Day 0 onward** (format:check leg red on `REFACTOR_PLAN.md` regardless of tree state), plus a spurious 60-TS2307 red at Day-1 typecheck on any built machine, plus a real TS2305/2307 red across `INV-A` steps 4–7 if its order is followed | unbounded (a red that no phase can clear) | yes — `ci.yml` doesn't exist until Day 0's PR merges, and the repo's history shows direct pushes |
| Recommended (P0 rebuilt; P1∥P2a; P3; P2b-i; P3d; P2b-ii; P4) | **0**, if each commit is the unit described | 0 h on `main`; largest single working window = 3a's IDB twin work (~4 h, on a branch) | gated from P0's merge onward, **provided** branch protection is actually enabled |

---

## Red-window table per commit

`R` = at least one leg of `npm run check` fails at that commit. Baseline leg timings: `format:check` ~?, `lint` 7.4 s, `typecheck` 2.6 s warm / 6.7 s cold, `test` 1.8 s (`VER-F` 6b — with the caveat that its typecheck number was a full cache hit).

### Consolidated order as written

| C | Lands | format | lint | tsc | test | Red? | Notes |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| 0.1 | `ci.yml` alone (plan Day 0) | **FAIL** | ok | ok | ok | **R** | red on birth; blocks every later PR if protection is on |
| 0.2 | baseline recorded | **FAIL** | ok | ok | ok | **R** | |
| 1.1 | `status-badge.tsx` E1 (`INV-A`'s unformatted snippet) | **FAIL** | ok | ok | ok | **R** | `VER-A` §5.1: the snippet itself fails prettier |
| 1.2 | tests deleted (§2.4) | **FAIL** | ok | ok | ok (182? no — 259 files) | **R** | |
| 1.3 | §2.3 services/components deleted | **FAIL** | ok | **TS2307 ×1** | ok | **R** | `portal-view-service` still imported? no — E1 done; red here is `INV-A` step-4 `prisma generate` removing `Capability` while `access-link-service.ts:2`/`authorization-service.ts:1` still exist |
| 1.4 | schema edit + `prisma generate` (INV-A order) | **FAIL** | ok | **TS2305/2307 ×~5** | ok | **R** | self-inflicted by ordering, not by the purge |
| 1.5 | §2.2 trees + trims + proxy + auth.test | **FAIL** | ok | ok | ok | **R** | |
| 2.x | seam files + 23-file repoint + alias delete + forms | **FAIL** | ok | ok/risk | ok | **R** | plus, if the seam is generated and gitignored: **TS2307 ×23 on a fresh clone** |
| 3.x | CSS purge / offline split / game-host / service | **FAIL** | ok | ok | ok | **R** | CSS is *invisible* to every leg — red for the product, green for CI |
| 4.x | `out/` api assertion | **FAIL** | ok | ok | ok | **R** | the Day-4 gate `REFACTOR_PLAN.md:236` cannot fail (`CRITIQUE` §1, `INV-F` O6) |

**Every commit in the consolidated sequence is red**, and none of them is red for a reason the refactor caused. That is the sequencing defect: the corpus found the red leg three separate times (`VER-A` B3, `VER-F` D2, `VER-E` hazard 4) and never moved it into P0's commit list.

### Recommended order

| C | Lands | check | Red? | Can reach `main` ungated? |
| :-- | :-- | :-- | :-- | :-- |
| 0.1 | `.prettierignore` + REFACTOR_PLAN | **green** (first time in repo history) | no | yes, but harmless |
| 0.2 | `auth.test.ts:161-165` restore | green | no | |
| 0.3 | `tsconfig.json` exclude `.next*`, `src/generated` | green (1,706 → ~1,694 files; loses 3 stale validators, gains determinism) | no | |
| 0.4 | demo `distDir: ".next-demo-build"` | green | no | |
| 0.5 | §7.1 tool + baseline allowlist (9 post-purge FAILs + the 3 P2b will touch) | green | no | |
| 0.6 | boundary ESLint rule | green (must be verified against `VER-B` #19's non-type-aware config) | no | |
| 0.7 | `typecheck:demo` + vitest `server-only` stub + `.tsx` include | green | no | |
| 0.8 | **`ci.yml`** | green at merge | no | protection now usable |
| 1 | `status-badge.tsx` E1 (prettier form) | green | no | |
| 2 | the atomic purge (46 + trims + schema + migration 6 + generate **after** deletions) | green (27 files / 182 tests) | no | |
| 3 | P2a types-only (additive) | green, and now **`typecheck:demo` reports real drift** for the first time | no | |
| 4 | P3c shell-view-model + `getActorRole()` | green; first tests of `buildNavigation` | no | |
| 5 | P2b-i `sign-in-form.tsx` / `sign-out-button.tsx` | green; assert `out/entrar/index.html` still has **0 `<form`** and the literal `Entrar na demonstração` (`VER-B`) | no | |
| 6 | P3a offline 7-file cut (T1–T6 first) | green; **`build:demo` per commit** (`VER-D` S9) | no | |
| 7 | P3b safe subset (adapter fix, helpers, chrome, presenter + T7) | green; `eslint .` after *every* step (`react-hooks/*` at severity 2) | no | |
| 8 | P3d CSS (dump taken after C5) | green — **and this is where the `undefined`-in-`class` gate earns its keep** | no | |
| 9 | P2b-ii 23-file repoint + alias deletion + delete 11 absorbed files | green; alias counts → 0,0; manifest 0 ids (demo) / >0 (server) | no | |
| 10 | P4 docs + `migrate deploy` on throwaway Postgres (`DIRECT_URL` override) | green; closes R1 | no | |

Zero red commits, and the only commits whose correctness depends on a build (6, 9) are build-gated by `ci.yml`'s separate jobs.

### Is the "branch protection required" claim true? Yes — and it is worse than stated

`VER-F` D9's verification of `deploy.yml` reproduces exactly: `on: push: branches: ["main"]` (`:3-5`), no `pull_request`, `npm ci` (`:31`) → `npm run build:demo` (`:34`) → `upload-pages-artifact ./out` (`:36-39`), `deploy` `needs: build` (`:46`), `concurrency.cancel-in-progress: false` (`:13-15`), `permissions: pages:write, id-token:write` (`:8-11`). Zero lint/typecheck/test. So yes: **any commit reaching `main` publishes the site unaudited**, and cross-workflow `needs` is not expressible, so only a repo-settings branch-protection rule makes `ci.yml` a gate.

`REFACTOR_PLAN.md:209-212` does not list branch protection as a Day-0 prerequisite. And the history says it has never been honored: **`git log --first-parent main` = 14 commits, of which exactly one is a merge (`c843345 Merge pull request #1 from niciniV/docs/v1-game-integration-dossier`, docs-only); the other 13 — including `c149374 feat(v1): complete slices 3-5`, a 100+-file feature commit — are direct commits on `main`**, and `git rev-parse origin/main main` is identical at `e5aaf1e`. That is 13 unaudited Pages publishes as established practice, including the commit that added the 932-line `game-host.tsx` and the 1,024-line demo store. The plan's execution model therefore requires a **behavioural change in the repo owner**, not just a new YAML file — and nothing in P0..P4 gates on it. Recommendation: land P0.1–P0.7 on a branch, open a single PR, and **use that PR to configure protection once, visibly**; and as a cheap backstop add `if: github.repository_owner == 'niciniV'`-style… no — better: give `deploy.yml` a `workflow_dispatch`-only publish or a `needs:` on a `ci` job by **merging the two workflows into one file with `needs: verify`**, which is expressible inside a single workflow and removes the settings dependency entirely. That is a strictly stronger control than the one the corpus recommends, and it costs one file.

---

## Fresh-clone blockers

`VER-B` O7 asserts `npm ci && npm run check` breaks on a fresh clone. It does not today, and it does after P2a/P2b if the seam is generated. Verified piece by piece:

| # | Blocker | Today | After the plan as consolidated | Must fix before Day 1? |
| :-- | :-- | :-- | :-- | :-- |
| F1 | `postinstall: prisma generate` (`package.json:26`) is the *only* generator; `/src/generated/prisma` is gitignored (`.gitignore:27`) yet imported by 38 surviving files | works — **but its offline-ness has never been executed by anyone in either corpus** (`INV-C` "not run", `VER-F` D4 UNSURE, `ADJ-01` did not run it). Static case is good: `schema.prisma:6-8` has no `url`, `prisma.config.ts:4,11` attaches a datasource url only when `DIRECT_URL` is set | same | **verify it once, in P0.** Every gate in the plan silently rests on an unexecuted command |
| F2 | `format:check` non-hermetic + red | **RED** (`npx prettier --check .` → `[warn] REFACTOR_PLAN.md`); `prettier --check .` walks untracked files too (`VER-F` D2) | same, plus a gitignored generated seam file is *invisible* to prettier (nothing to check) but a **committed-by-mistake** one is checked | **yes** — `.prettierignore` |
| F3 | `tsconfig.json` artifact globs | `.next`, `.next/dev`, `.next-demo-dev/dev` = **12 files in the 1,706-file program**, incl. 3 × 448-line `validator.ts`. Fresh clone: typecheck silently checks less. Stale clone post-P1: **+60 false TS2307** (proved by `C:\tmp\ADV1_probe`) | worse: a 5th distDir if P0.4 is not done | **yes** — `exclude`, not `include` |
| F4 | generated seam absent on clone | n/a | `npm ci && npm run typecheck` → **TS2307 ×23**; and if P2a/2b ship `tests/unit/runtime-target.test.ts` (`INV-B` gate 5) then `npm ci && npm test` **also fails** → the phase's own new test defeats the fresh-clone gate. `deploy.yml` survives only because it goes through `next-target.mjs`, which P2 makes the writer — a hidden coupling between the *publishing* path and a *new* file | **only if you keep the generated-file design.** The alias-value design has no such file (see next section) |
| F5 | `.dockerignore` lacks `src/generated` (`.dockerignore` = `.git .github .next coverage node_modules *.log .env* !.env.example`; also no `out`, no `.next-demo-dev`) | `Dockerfile:11` copies only `/app/node_modules` from the deps stage; `:12 COPY . .` then drags in whatever the host has → a clean clone gives a **loud** `npm run build` failure on `@/generated/prisma/client`, a dirty host gives a **silent** stale client (`INV-C` C19) | unchanged, plus the seam file | `RUN npx prisma generate` in the builder + `.dockerignore` += `src/generated`, `out`, `.next-demo-*` |
| F6 | no seed, no dev fixture | `find . -iname '*seed*'` → nothing (outside `node_modules`); `prisma.config.ts` has no `seed` key; `AUTH_DEV_BYPASS` synthesises profileId `00000000-0000-4000-8000-000000000001` (`dev-bypass-gateway.ts:9-13`) and `professional_profiles.id` has **no DB default** (`0_init:12`) so a fixture must pass the id literally | unchanged | not a gate blocker, but it means **server wiring is unexercisable on a fresh clone at all** → any claim that P2's server target "works" is unprovable locally |
| F7 | order-dependent suite | green under vitest 4.1.11 defaults; **red under `--no-isolate` / `--fileParallelism=false`** (`VER-F` D1 reproduced). Post-P1 the *victim* is gone; the *offender* (`auth.test.ts:161-165`) stays, and **P2a's module-scope `TARGET_MODE` assert re-arms it** | same | **yes** |
| F8 | devDeps churn | `fake-indexeddb`, `happy-dom`/`jsdom`, `@testing-library` all absent (`VER-D` 1b); `server-only` is **not installed** and only resolves in tsc because `next/types/global.d.ts` ambient-declares it (`VER-B` #16) | P3a and P2 add 2–4 devDeps → `package-lock.json` (507 KB) regenerated in 4 PRs | stage them all in P0/P3a, not scattered |
| F9 | `src/app/health/{live,ready}` are empty **untracked** dirs while `README.md:53` and `current-architecture.md:176` document the endpoints | docs false today, independent of the refactor | worse if P4 "fixes" only README | P0 doc ledger, so it is not misattributed to P1 |

**Bottom line on fresh clone:** the pre-Day-1 minimum is F2 + F3 + F7 + F1-verification (four one-line-to-five-line changes, all in P0). F4 is *avoidable entirely* by not choosing a gitignored generated file, and F5/F6/F9 are pre-existing debt the plan inherits silently.

---

## Gate defects and the minimum discriminating assertions

### Per-phase: can the criterion actually fail, and does it run against the tree the phase produces?

**P1 — `prisma validate && prisma generate && npm run typecheck && npm test` (`REFACTOR_PLAN.md:219`).**
- `prisma validate` can fail and did (`P1012` on `:97`, reproduced three times + `ADJ-01`). Good gate.
- It **cannot** see migration drift — and the only drift tool that could is `migrate diff --from-migrations … --to-schema …`, which `VER-C` C10 proved **errors out** with "You must set `datasource.shadowDatabaseUrl` in your `prisma.config.ts`", a key that does not exist in `prisma.config.ts:6-11`. `ADJ-01` §4 step 4 recommends adding it. So: the corpus simultaneously mandates a drift gate and documents that it is unrunnable without a config change nobody scheduled. **And `--from-schema/--to-schema` cannot serve as the gate**: `VER-A` §6-B reports it returned an *empty script with exit 0* for schemas differing by 4 declarations, while `ADJ-01` §2 reproduces 8 statements from the same command shape. That contradiction is **unresolved in the corpus** (`ADJ-01` refutes `VER-A`, but `VER-A`'s exit-code observation — empty = 0 — is the dangerous half either way).
- **Minimum falsifiable Day-1 migration assertions** (crude, no DB, cannot fail for infrastructure reasons):
  `test -f prisma/migrations/6_drop_generation_a/migration.sql` **and** `grep -c 'DROP TABLE' … == 3` **and** `grep -q 'DROP TYPE "capability"'` **and** `grep -c 'CREATE TABLE' == 0` **and** `git ls-files --error-unmatch prisma/migrations/6_drop_generation_a/migration.sql`. Then, once, `DIRECT_URL=…docker PG-16… npx prisma migrate deploy && npx prisma migrate status` — closing R1 with the explicit `DIRECT_URL` override (`ADJ-01` §3.1, `VER-C` C25: `DATABASE_URL=` on the command line is *ignored*, so the plan-literal command contacts the placeholder Neon host, or a real branch once `.env` is filled).
- `npm test` post-purge is 27/182 and needs no DB — fine. `typecheck` is fine **only** with P0.3/F3 done, else it is red with 60 false errors.
- **Missing from P1's exit set:** the `out/` page-count delta. It has to be there, because it is the only gate that sees *route trees* (26 post-purge, verified twice by `VER-F`).

**P2 — "Day-2 gate: `build:demo` (assert 0 server-reference IDs) & `build:server`".**
- **Zero-ids can already fail to discriminate:** the demo manifest is *already* 0 (`VER-F` alias-graph proof, and `VER-F` demolished the dev-manifest proxy on three independent grounds — wrong path, gate never runs in dev, 10-of-45 page coverage). So criterion 3.1(3) is a regression guard. The criteria that **can** fail today are: `grep -c '"@runtime/' next.config.ts` and `tsconfig.json` → both 9 → both must reach 0 (`INV-F`; the only clause of §7.2 that is live), and the parity file making `typecheck` see both variants.
- **Can any P2 criterion detect a broken *server* target short of a full build? No.** `VER-B` row 20 proves it: a stale **demo** seam during `build:server` is invisible to `tsc` (demo-variant typecheck is 0 errors), `lint` (non-type-aware), `test` (vitest only runs `APP_RUNTIME_MODE=demo`, `vitest.config.mts:13-15` — I re-read it), and E625 (`export/index.js:360` requires `output === 'export'`). The only discriminator is `build:server` + `>0` server-action ids. **So the honest P2 exit criterion is "one build of each target, in separate jobs"**, and any claim of a cheaper check should be refused. Note `player-access-actions.test.ts:33-36` (`INV-F` O3) imports the *server* action modules **by direct path**, bypassing the seam entirely, so it keeps passing after P2 while testing one half — that file must be re-pointed in P2b-ii or excluded from the "seam is tested" claim.
- **`npm test` blind spot worth naming:** vitest pins demo mode, so **no test in the repo can ever exercise server wiring** — before or after P2. A two-project vitest config is the cheapest fix and belongs in P0.7, not in P2's promise.
- **Manifest order-safety: NO as consolidated, YES after one line.** Both build targets write `.next` (`next.config.ts:26-28` redirects only `PHASE_DEVELOPMENT_SERVER`), and `export/index.js:359` reads `<distDir>/server/server-reference-manifest.json`, so `build:demo` writes the very file `build:server` then overwrites with 17 ids — `VER-F` reproduced a 74-second real-world overwrite window and tabulated five orderings, two of which are false-pass/false-fail. Fix: demo `distDir` for all phases (P0.4). Then also add `.next-demo-build` to `tsconfig.json` exclude, or the new distDir's `validator.ts` re-enters the program.
- **`INV-B`'s assertion code has a live bug** (`VER-F` D4): `actions.map(i=>m.node[i].filename)` `TypeError`s on any id that lives in `.edge`, and `require("./.next/…")` is cwd-relative. Use `m.node[id]?.filename ?? m.edge[id]?.filename` and an absolute path.
- **Minimum P2 set:** alias counts → 0,0; parity-file `tsc` in one run; `TARGET_MODE` assert *in function bodies*; boundary ESLint rule (which is what actually holds the property after the aliases die); `build:demo` → 0 ids in its own job; `build:server` → `>0` ids with a printed count (`>0`, not `==17`, per `VER-B` O6 — the count rots); `out/entrar/index.html` has 0 `<form` and the literal `Entrar na demonstração` (the before/after baseline `VER-B` verified holds today).

**P3 — exit criteria are size budgets + green tests.**
- Budgets **cannot fail today**: `eslint.config.mjs` is 17 lines with no `max-lines`, and `ls scripts` has no ratchet tool (`INV-F` §7.1). So P3's stated criterion is not a gate until P0.5 exists — and P0.5 must include the **baseline allowlist**, because otherwise P2b-ii and 3a *manufacture* FAILs (`game-host.tsx` 932, `player-access-workflow.tsx` 540, `team-screen.tsx` 411 modified; `idb-store.ts` ~650 new).
- Tests: `tsc` and `vitest` are structurally blind to CSS. The corpus's only proposed CSS gate was `INV-F`'s "assert every `styles.X` token resolves in the module it imports" script — which, as `INV-F` admits, "would have caught nothing today".
- **I have a better one, and it fails right now.** `VER-E` empirically found that the phantom `styles.mobileNavItem` emits a literal `undefined` token into prerendered HTML. I measured the blast radius: **45 of 104 HTML documents in `out/` contain `class="… undefined"`** (e.g. `class="portal-module__1g8gFq__navLink  undefined"`, `class="…navLink …navLinkActive undefined"`). So:

  ```bash
  # after build:demo — a CSS gate that can fail, and does today
  n=$(grep -rl 'class="[^"]*undefined' out --include='*.html' | wc -l)
  [ "$n" -eq 0 ] || { echo "$n documents emit an undefined CSS-module class"; exit 1; }
  ```
  Zero cost, no tooling, runs in `ci.yml`'s `build-demo` job, and it is the *only* automated signal in the entire plan that can see a class-level regression. It also self-validates: it must go red on Day-3 entry (fix `portal-navigation.tsx:37`) and must go green after `materials-explorer.tsx` disappears with P1.
- `@media print` (`portal.module.css:4355-4391`, incl. `:global(body) > *` at `:4356`) and the skeleton keyframes (`:650-658` + `--portal-skeleton-*` at `:334,:339`) are relocation hazards **no gate can see** — `VER-E` hazard 5 is right that only print emulation catches them. Accept: these belong on the manual checklist, and the checklist must be run against **Pages (with `/SMS_Portal`)**, not `dev:demo` — `INV-F` proved `dev:demo` has no basePath, runs the proxy, and answers `/api/*`, so "any Day-4 checklist run only under `dev:demo` passes while the shipped artifact is broken".
- `build:demo` per commit for 3a (`VER-D` S9: a module-scope `indexedDB`/`crypto.subtle` hoist kills the export, and nothing else sees it).

**P4 — `REFACTOR_PLAN.md:236` "assert no `api/` in `out/`" cannot fail** (route handlers are dropped by construction; 0 `export … GET` in `src/app/**/route.ts`, so nothing executes at build; `INV-F` O6, `CRITIQUE` §1). Replace with the `.next/app-path-routes-manifest.json` four-key assertion (`INV-F`: it contains exactly `/api/v1/player/{active-time,bootstrap,results,state}/route`) — which `INV-F` correctly concluded is *braces, not a belt* — plus the 26-document export set, **decomposed in the CI comment** (`VER-F` O4: the 26 depends on Next emitting `404.html` + `404/index.html` + `_not-found/index.html` under `trailingSlash:true`, a Next-internal detail that will break on upgrade for an unreadable reason), plus the `undefined`-class gate above, plus a link check over `out/**/*.html`.

**Cross-phase gate defect nobody named:** §7.1's semantics are *not* ambiguous (`REFACTOR_PLAN.md:246` already says "new or modified" — `VER-F` 3f), but the ratchet bites on **any** modification, including a one-line import rewrite. That means the size budget is in direct conflict with the seam repoint (3 files over budget × 1-line edits) and with §2.1's "zero JSX churn" promise. Either the baseline allowlist exists in P0 or P2b-ii and P3 are formally illegal.

---

## Where I think the areas agreed but are wrong

### 1. "The 46-file manifest is closed" — right for the compiler, false for the repository. Six agents concur; `VER-A` proved it by execution. The proof is sound and the *claim* is over-read.

`VER-A` ran the purge in scratch trees and got exactly one error — in trees that contained **no `.next`** (`graph.mjs` resolved 299 files across `src tests scripts contracts .github prisma` + root configs). Closure was therefore established for *importing source*, and I could not find a dangling edge either. What is not closed:
- **20 × 3 stale generated `typeof import()` edges** from `.next*/types/validator.ts` into the deletion set — a real dependency of the *typecheck program* on the deleted files, which I proved errors (TS2307). The purge's headline evidence silently excluded it.
- **The public URL surface.** `/atividade/[token]/**` is 52 of the currently-published 104 documents, `walkthrough.md:11` publishes `https://niciniv.github.io/SMS_Portal/atividade/7FQ-29M/`, `deploy.yml` publishes on merge, and `output:'export'` makes a redirect impossible. A closed manifest for a static site that ships 52 soon-404 URLs is a **product** non-closure the corpus classifies as "intended".
- **21+ documentation statements**, including the file most likely to be trusted (`docs/schemas/database-model.md`, 196 lines, self-declared "current" at `docs/schemas/README.md:3-6`) which is **not in Day 4's scope at all** (`REFACTOR_PLAN.md:239` names only two files), plus `.env.example:22-23` describing `APPLICATION_SECRET` as covering "rate-limit keys" for a table that no longer exists.
- **The dead-class census depends on an unresolved sub-decision.** `INV-A` §4.3 recommends adding `demo-action-button.tsx` (39 lines, 0 importers) to the deletion set; `VER-A` S9 shows it is the *only* thing keeping `.toast` (30 lines + `toastIn` keyframes) alive. So "purge-dead = 91 classes / 1,862 block-deletable lines / 22 importers" silently assumes that recommendation is **declined**. Adopt it and the CSS numbers move. A "closed" manifest whose downstream census flips on a pending yes/no is not closed.

### 2. "The seam needs generated entries" — five-way consensus (`CRITIQUE` §2, `NOTE-00` §4, `INV-B`, `VER-B`, `INV-F`). I overturn the sequencing implication, and question the mechanism.

The corpus's argument for a generated `src/runtime/target.ts` over a build-time alias value is exactly one line long, and it is `NOTE-00` §4's "vitest resolution: **free**". Everything else the generated file brings is a *hazard table*, and `VER-B` filled it in faithfully: file absent (TS2307×23), file stale in the worst possible direction (caught by **nothing**), committed by accident (no `.gitignore` entry — I confirmed `.gitignore` ends at `:27` `/src/generated/prisma`), not prettier-clean (`.prettierignore` has no `src` entry — confirmed), two concurrent dev servers sharing one source file, fresh-clone breakage, and a generator that must gain `node:fs` and be sequenced inside `next-target.mjs` between `:24` and `:63`.

Now put the corpus's own numbers against that list:
- **No E625 benefit.** `NOTE-00` §4 says it outright: "the generated file is *not* required for E625 safety"; `VER-B` C-3 adds that losing the aliases in either order fails **loudly** (5 `"use server"` modules → E625, or TS2307 ×23), demolishing `INV-B` #25's "silently".
- **No drift-detection benefit on its own.** `VER-B` claim 17: typechecking the whole graph against all nine demo variants → **0 errors**. Drift detection comes from the parity file + explicit named lists, which the alias design can carry identically.
- **The vitest payoff is one-sided.** `VER-B` O5: vitest is `environment: "node"` with `env.APP_RUNTIME_MODE: "demo"` only, a `server-only` module that is **not installed**, an `include` glob that cannot see `.tsx`, and an `@` alias that is a *string prefix* so `@runtime/x` mis-resolves today. So the seam test the generated file enables covers the demo half, and only after three config changes that are cheaper than the generator.
- **It manufactures the dossier's own top risk.** `R1` — "does a server reference survive a barrel re-export hop?" — has **no precedent in this repo** precisely because today's alias resolves *straight* to the action module (`VER-B` #29). So the single "unproven and load-bearing" item in the memory record, and the Day-2 spike both `INV-B` and `VER-B` put first, is a risk created by the chosen mechanism. An alias value that switches between two existing action modules at config time has no new hop.

**Recommendation:** do not put the mechanism choice on the critical path. `P2a`'s discriminating payload (`contracts.ts`, explicit named export lists, `contracts.check.ts`, `typecheck:demo`, boundary lint) delivers 100% of the type-safety and testability rationale — which `VER-F` established is the *actual* rationale, since E625 is not failing — and is mechanism-neutral. Then choose, as its own 30-minute spike with a build, between (a) generated entries and (b) build-time alias values with committed wrapper files, on the evidence of R1 rather than on the plan's assertion. **If P2a already landed, the choice can be deferred indefinitely without any gate going blind** — which means it should not sit between the purge and the decomposition at all.

### 3. "The demo must keep `localStorage`" — unanimous, and correctly, but everyone then describes the wrong consequence.

`localStorage` is not the thing that makes §7.5 false; `generateStaticParams` is. `INV-F`/`VER-F` established two *independent* breakages: (i) created entities have ids from `adult-portal-demo-store.ts:334-341` `demo-<kind>-<uuid>` that can never be prerendered, so deep links 404 from `out/404.html`; (ii) `/portal/resultados/**` reads `demoAdultPortalSeed` (`game-events-demo.ts:11-14`), **never** `readDemoAdultPortalState()`, and `results-screen.tsx:1` is a Server Component — so created rows are invisible in results *even in-memory*. Retaining `localStorage` fixes neither, and P4's "decide the demo deep-link question" only decides (i). **No phase owns (ii)**, so §7.5 will ship false in a way nobody wrote down. Also: 45/104 shipped documents currently emit `undefined` class tokens, which is a third way the demo is visibly wrong and equally unowned until P3d.

### 4. "`game-host.tsx`'s hooks split is unwise" — unanimous (`INV-D`, `VER-D` actively hunted for the cut and refused it). I agree with the refusal and attack what it leaves.

Refusing the split leaves a **932-line component FAIL** that (a) P2b modifies at `:24`, (b) 3a modifies at `:26-31`, (c) 3b cuts three regions out of, (d) imports the 1,017-line `public.module.css` (13 classes) that 3b's chrome extraction must carry and that §4.1's title excludes, and (e) hosts **two live product defects with no owner and no reachable test** — `H4` (`:166-192` `validLaunchToken` read-check-write across an `await` with no in-flight coalescing ⇒ N concurrent refreshes; one `sync()` issues 1+N+M requests) and `H5` (`:817-823` `handleFrameLoad` resets 5 slots and leaves `syncPromise`, `syncRequested`, `handledConflicts`, `pendingConflict`, `savedReplies`, `inFlightSaves` populated). Both are **server-mode** paths, and server mode has never run against a database (R1 open), so **no gate in P0..P4 can observe either**. That is not a reason to split the file — it is a reason the refusal is only half an answer. The consolidated plan should carry H4/H5 as named behaviour tickets with the DOM-test-environment precondition attached (`INV-D` Q5/Q6), or the refusal becomes a silent archive.

### 5. The one consensus I would *not* overturn, stated so it isn't re-litigated.

`ADJ-01`'s adjudication of the `:97` blocker (five agreements, no disagreement, byte-identical SQL) and `VER-A`'s `proxy.ts:113`-only finding (a `TS1128` syntax error plus a live `Referrer-Policy: no-referrer` regression on the only remaining bearer-token-in-URL flow, `player-credential-print-sheet.tsx:22-24`) are both correct and I re-read the code to confirm the shape. Do not re-attack these.

---

## What I could not settle read-only

1. **Whether `prisma generate` is genuinely offline.** No agent in either corpus executed it (`INV-C` not-run, `VER-F` D4 UNSURE, `ADJ-01` silent on it). The entire fresh-clone story — and therefore `ci.yml` and `deploy.yml` and `Dockerfile:8` — rests on `prisma.config.ts:4,11` + `schema.prisma:6-8` read correctly. One 10-second run in a scratch clone with `env -u DIRECT_URL` closes it.
2. **The `migrate diff` contradiction between `VER-A` §6-B (empty script, exit 0, for differing schemas) and `ADJ-01` §2 (8 statements, exit 0) on the same command shape.** `ADJ-01` is the tiebreak and I trust its reproduction, but the decision-relevant half — *can CI detect an empty generated migration by exit code?* — has two incompatible answers on record. `--exit-code` semantics (empty 0 / error 1 / non-empty 2) are documented in `--help`, so the gate is usable; the *authoring* step is the disputed one. Needs one run.
3. **Whether `migrate diff --from-migrations` becomes usable once `datasource.shadowDatabaseUrl` is added**, and whether it then emits the 6 `DROP DEFAULT` statements `VER-C` C9c proved declaratively. Both need a Postgres.
4. **Whether the 60 spurious TS2307s appear as predicted on Day 1.** I proved the *mechanism* (stale `typeof import()` → TS2307, TS 6.0.3, repo's exact options) and I counted the references (20 per `validator.ts` copy × 3 copies in the program), but not the aggregate run, which needs the purge applied to a tree that has a stale `.next` — i.e. exactly the machine state I must not create. Treat the count as "≥20, likely 60".
5. **`R1`** (server reference through a barrel hop), **merged-seam severity** (Turbopack build-time fatal vs. green-build-then-hydration-crash — `VER-B` C-4 could not establish which), and whether `turbopackInferModuleSideEffects` prunes an unused reader re-export. All three need one `npm run build:server`; `VER-B`'s "sequence the probe so one build answers three unknowns" remains the right design and I could not run it.
6. **Actual red-window durations.** The 4–8 h figure for the purge is `INV-F`'s estimate bounded by human attention, not by tooling (local loop < 15 s), and `VER-A`'s scratch runs make a single-commit purge plausible — but I ran no builds, so every duration above is a work-estimate, not a measurement.
7. **Whether branch protection is currently enabled on GitHub at all.** The history (13 direct commits to `main`, one docs PR, `origin/main == main`) shows the *practice*, not the *setting*. `gh api repos/…/branches/main/protection` would settle it; it is a network call outside my brief.
8. **Which of `INV-A` §4.3's missed deletions get adopted** (`demo-action-button.tsx`, `base-url.ts`, `getGameClientUrl`, `createGameLaunchUrl`, the 8 dead `ApiErrorCode` members). This is not cosmetic: adopting the first changes the post-purge `portal.module.css` importer count 22 → 21 and kills `.toast` + `toastIn`, which changes `VER-E`'s primitives budget — so the CSS numbers are pending a decision the plan never makes.
