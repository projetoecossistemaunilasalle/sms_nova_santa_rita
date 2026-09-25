# VER-F — Refutation Pass on `INV-F-gates-ci-demo.md`

Adversarial verification of `docs/refactor-dossier/reports/INV-F-gates-ci-demo.md` against
`REFACTOR_PLAN.md` v2.1 §6/§7, the CI config, and the on-disk build evidence at `e5aaf1e`.
Read-only with respect to tracked files: `git status --porcelain` at the end of this pass is
still only `?? docs/refactor-dossier/`. No `next build`, `next dev`, `prisma generate`,
`prisma validate`, `prisma migrate`, or database connection was run. `out/` and `.next/`
were not modified.

**Commands run:** `git status/log/ls-files/rev-parse/check-ignore`, `wc`/`grep`/`find`,
`npm run typecheck`, `npx tsc --noEmit --incremental false`, `npm run lint`, `npm test`,
`npx vitest run --no-isolate --fileParallelism=false` (plus targeted subsets),
`npx prettier --check .`, and read-only node inspection of the manifests.

**`tsconfig.tsbuildinfo` integrity (required disclosure):**

| Point | md5 |
| :-- | :-- |
| before any command | `252a0a7726f8e6d88e4fa82633cb4796` |
| after `npm run typecheck` | `252a0a7726f8e6d88e4fa82633cb4796` |
| after `npm run lint` | `252a0a7726f8e6d88e4fa82633cb4796` |
| after `npm test` | `252a0a7726f8e6d88e4fa82633cb4796` |
| after `npx tsc --noEmit --incremental false` | `252a0a7726f8e6d88e4fa82633cb4796` |

File is 356,779 bytes, gitignored at `.gitignore:19` (`*.tsbuildinfo`), untracked
(`git ls-files tsconfig.tsbuildinfo` → empty). Byte-identical throughout — matches the
report's stated value exactly.

**Shell caveat:** this pass ran on `node v22.23.1` (the report disclosed the same), not the
pinned `24.19.0`. Every timing number below is therefore Node-22-flavoured.

---

## Verdict table

| # | Claim under test | Verdict | My evidence |
| :-- | :-- | :-- | :-- |
| 1a | `.next-demo-dev/.../server-reference-manifest.json` = 0 ids | **CONFIRMED** | 97 bytes, `node:0 edge:0`, mtime 2026-09-23 02:16:21 |
| 1b | `.next/server/server-reference-manifest.json` = 17 ids, 5 files, all `server-action` | **CONFIRMED** | 10,489 bytes, mtime 02:05:46; my per-file counts are 1/1/10/4/1 = 17; all 42-hex, first bytes `40/00/60` → bit 7 = 0 |
| 1c | "…therefore §7.2's manifest half is only a regression guard" | **CONFIRMED — but on a different basis than given** | the dev manifest is **not** a valid proxy (see next section, 3 independent reasons); the claim survives anyway via the alias-graph proof, which is stronger |
| 1d | id encoding "byte 0 bit 7", `export/index.js:375-385`, `server-reference-info.js:31-38` | **CONFIRMED, citations slightly off** | `export/index.js`: require `:359`, `actionIds` `:375`, test `:379`, `E625` throw `:380-387`. `server-reference-info.js`: `LENGTH=42` `:31`, `typeBit = infoByte>>7&0x1` `:37`, but the quoted ternary `typeBit===1?'use-cache':'server-action'` is at **`:47`**, outside `:31-38` |
| 2a | demo **build** also writes `.next` (only dev is redirected) | **CONFIRMED** | `next.config.ts:26-28` — `distDir` only under `PHASE_DEVELOPMENT_SERVER`; else branch sets `output:'export'`+`basePath` and inherits the default `.next` |
| 2b | two BUILD_IDs ~1 min apart | **CONFIRMED, but `out/BUILD_ID` does not exist** | `.next/BUILD_ID`=`E7B1icx1I4_iMk6hNNHSJ` @02:05:52; `required-server-files.json` → `output:"standalone"`,`basePath:""` ⇒ that `.next` is the **server** build. Demo id `Jj4Ra8TO08geLsJFHkfna` is only in `out/_next/static/`; `out/index.html` @02:04:38. Δ = **74 s**. The task brief's "`out/BUILD_ID`" is wrong; INV-F's actual wording is correct |
| 2c | a `build:demo` leaves a manifest a later step can misread | **CONFIRMED** | `export/index.js:359` requires `<distDir>/server/server-reference-manifest.json`, so the demo build must emit `.next/server/server-reference-manifest.json`; `build:server` then overwrites it (observed) |
| 3a | post-purge **9 FAIL + 8 WARN**; today 13 FAIL + 12 WARN | **CONFIRMED exactly** | my own independent census (method below) reproduces all 13/12 and 9/8, file-for-file and line-for-line |
| 3b | 5 post-purge FAILs have no §4 step | **CONFIRMED** | §4 covers only `portal.module.css`(4.1), `game-offline-sync.ts`(4.2), `game-host.tsx`(4.3), `application/adult-portal/service.ts`(4.4) |
| 3c | §4.2's `idb-store.ts` ~650 violates the 500 module ceiling | **CONFIRMED** | `REFACTOR_PLAN.md:165` |
| 3d | residual ≈3,110 → ≥6 files @600, ≥11 @300 | **CONFIRMED arithmetically**, **OVERSTATED as a floor** | 3,110/600=5.18→6; 3,110/300=10.37→11. But INV-E's model says the post-split total *exceeds* the residual because `@media` slices are copied into several modules — so 11 is a lower bound, not an estimate |
| 3e | importers 37 → 22 | **CONFIRMED exactly** | my filtered `grep -rl portal.module.css src`: 37, then 22 after removing the §2.2/§2.3 set |
| 3f | "§7.1's own semantics are ambiguous between ratchet and global-clean" | **OVERSTATED** | `REFACTOR_PLAN.md:246` literally reads "All new **or modified** files" — §7.1 is *already* ratchet-worded; the global reading the report spends a paragraph refuting is not supported by the text it quotes |
| 4a | `.github/workflows/` has only `deploy.yml`; `push: main`, no `pull_request`, no lint/tsc/test | **CONFIRMED** | `find .github -type f` → 1 file; `deploy.yml:3-6`, `:18-39` has only checkout/setup-node/npm ci/build:demo/upload |
| 4b | branch-based execution + branch protection is *required* | **CONFIRMED** | `deploy.yml:15` `cancel-in-progress: false`, `:46` `needs: build`; no cross-workflow `needs` exists |
| 4c | `build:server` needs valid env but no reachable DB | **CONFIRMED, stronger than argued** | `client.ts:17` lazy `getPrisma()` ✓; `portal/layout.tsx:23` `await connection()` (import at **`:3`**, not `:8`); prerender set = exactly 8 routes; **`grep 'export.*GET' src/app/**/route.ts` → 0 matches**, so no handler body executes at build; `game-client.ts:17-19` returns `{status:"missing"}` instead of throwing |
| 4d | `prisma generate` is offline / safe with no `DATABASE_URL` | **UNSURE** (report also marked it unverified) | static reading is right (`prisma.config.ts:4,11`; `schema.prisma:6-8` has no `url`), but unexecuted — and the report's *own* recommended env then sets `DIRECT_URL` (defect below) |
| 4e | `prisma migrate diff --from-migrations … ` is "offline in Prisma 7" | **UNSURE / OVERSTATED** | asserted with no evidence in a pass that explicitly did not run it. `--from-migrations` is the shadow-DB-triggering axis. Do not mandate this in Day 0 |
| 5a | §3.3 "falls back to `/portal/turmas`" is wrong; Pages serves `out/404.html` | **CONFIRMED** | `out/404.html` 7,277 B @02:04:37, contains "Página não encontrada"; plus `out/404/index.html`, `out/_not-found/index.html`. Stronger citation the report missed: `04-functions/generate-static-params.md:376` "only paths provided by `generateStaticParams` will be served, and unspecified routes will 404" |
| 5b | option (b) has **no supported pattern** in the vendored docs | **WRONG** | `01-app/02-guides/migrating/from-create-react-app.md:321-339` and `…/from-vite.md:363-383` both document the optional-catch-all `app/[[...slug]]/page.tsx` SPA shell *explicitly under `output:'export'`* with `generateStaticParams(){return[{slug:['']}]}` |
| 5c | option (c) already implemented | **CONFIRMED** | `classes-screen.tsx:140` `startsWith("demo-class-")`, `:162-165` label, `:169-180` `<article>` vs `<Link>`; `organizations-screen.tsx:124,146`; `overview-screen.tsx:207`; only violation `activity-builder.tsx:60` (in §2.3) |
| 5d | recommendation (c)+(a) | **CONFIRMED in outcome, RE-BASE the argument** | (b) fails because Pages cannot rewrite a path whose document was never emitted, not because Next lacks a pattern. See §7.5 verdict |
| 6a | clean tree at `e5aaf1e`, 0 untracked, 343 tracked | **CONFIRMED** | `git rev-parse HEAD`=`e5aaf1e2891dbb1804950223eb9f0765e7dbeb65`=`origin/main`; only `?? docs/refactor-dossier/` appeared later (sibling agents). 343 files; src 174 / contracts 59 / docs 34 / tests 33 / prisma 8 / public 4 / scripts 2 — all exact |
| 6b | typecheck 0 errors, lint 0 errors, test 33 files / 284 passing | **CONFIRMED** | all three re-run here, exit 0. Timing caveat: the report's 2.638 s was a **full cache hit**; a genuine cold `tsc --noEmit --incremental false` is **6.7 s** (still 0 errors) |
| 6c | static 234 / runtime 284; §2.4 = 102 tests = 35.9 %, leaving 182 | **CONFIRMED exactly** | my recount with an independent regex: 33 files, **234** static. 56+24+13+5+2+2 = 102; 102/284 = 35.915 %; 284−102 = 182; 33−6 = 27 |
| 6d | purge = 46 files / 7,802 lines; §2.2 = 1,754 | **CONFIRMED exactly** | 22 files/1,754 + 18/3,458 + 6/2,590 = 46/**7,802** |
| 6e | auditoria = 73 not 95 | **CONFIRMED** | `wc -l` on that page = 73 |
| 6f | "~29 %" is really ~22.8 % | **CONFIRMED, and I add a third reading** | my denominators: src-excl-generated **27,433** (172 files) → 28.44 %; src+tests+misc **34,288** (211 files) → **22.75 %**; src+tests+misc **after** the purge (26,486) → 29.46 %. 22.75 % is the correct "share of handwritten code removed" |
| 7 | 26 HTML documents post-purge | **CONFIRMED by two methods** | `out/` = 104 HTML − 78 in the §2.2 trees (13+8+2+1+1+1+52) = 26; and route-tree derivation → 26 (below) |
| 8a | `database-model.md` staleness; not in Day-4 scope | **CONFIRMED, understated** | 196 lines ✓; **7 documented tables vs 16 models** in `schema.prisma` (16 `CREATE TABLE`s across migrations); the report names 7 omitted models, actual omissions are **9** (it misses `result_events`, `active_time_events`). `REFACTOR_PLAN.md:239` names only README + `current-architecture.md` ✓ |
| 8b | README / `current-architecture.md` line citations | **CONFIRMED every one** | `:5`, `:53`, `:59`, `:62`, `:66`, `:74-78`, `:82-86`, `:102`; `current-architecture.md:4,16,138,166,168,175,176,178,180,234,247,259` — all verbatim as quoted |
| — | "`npm test` needs no DB/network/`.env`" | **CONFIRMED for the default config, but the *reason* given is incomplete and a real hazard was missed** | see "CI design defects" D1 |
| — | report's P0 "lint && typecheck && test = 12 s total" | **WRONG AS A DAY-0 GATE** | omits `format:check`, which is **the one leg of `npm run check` that fails today** (D2) |

---

## Demo manifest ground truth (item 1)

### What is actually on disk

| Path | mtime (local) | size | `.node` ids | `.edge` ids | `encryptionKey` |
| :-- | :-- | --: | --: | --: | :-- |
| `.next-demo-dev/dev/server/server-reference-manifest.json` | 2026-09-23 **02:16:21** | 97 B | **0** | **0** | yes |
| `.next/server/server-reference-manifest.json` | 2026-09-23 **02:05:46** | 10,489 B | **17** | 0 | yes |
| `.next/dev/server/server-reference-manifest.json` (stale, 09-22 22:21) | — | — | 0 | 0 | — |

The 17 ids decompose exactly as the report states:
`entrar/actions.ts` 1, `portal/sign-out-action.ts` 1, `portal/adult-portal-actions.ts` 10,
`portal/player-access-actions.ts` 4, `(public-play)/jogar/actions.ts` 1. All 17 are 42 hex
chars; the distinct info bytes are `0x40`, `0x00`, `0x60` — bit 7 clear in all three ⇒ all
`server-action`, zero `use-cache`. The encoding claim is correct: `server-reference-info.js:36`
`parseInt(id.slice(0,2),16)`, `:37` `infoByte >> 7 & 0x1`, `:47` the ternary.

### Is a **dev** manifest a valid proxy for `next build` + `output:'export'`? **No — on three independent grounds.**

1. **Different path.** `export/index.js:359` reads `<distDir>/server/…`. For a demo build
   `distDir` is `.next`, so the gate reads `.next/server/…`. The dev manifest I inspected is at
   `.next-demo-dev/**dev/**/server/…` — the dev-only two-level layout. It is not the same file
   and never is.
2. **The gate never runs in dev.** `next.config.ts:26-28` gives dev neither `output:'export'`
   nor `basePath`; the E625 branch is guarded by `nextConfig.output === 'export'`
   (`export/index.js:361`). A dev manifest with ids would raise nothing.
3. **The dev graph is partial.** `.next-demo-dev` holds **10** per-page
   `server-reference-manifest.json` files; `.next/server` holds **45**. Turbopack compiles on
   demand, and the visited set is missing every `atividades/`, `materiais/`, `modulos/` and
   `atividade/[token]` route. A zero from a 10-page sample cannot, by itself, license a zero
   over the full prerender graph. **This is the report's weakest link, and it is a real one.**

### …but the conclusion is nevertheless TRUE, and provable without the dev manifest

`grep -rn "use server" src` returns **exactly 7 sites in 7 files**:

| File | Directive | Reachable in production code? | Via what |
| :-- | :-- | :-- | :-- |
| `entrar/actions.ts:16` (inline) | yes | **only** `entrar/page.tsx:8` | `@runtime/sign-in-action` |
| `portal/sign-out-action.ts:1` | yes | **only** `portal-shell.tsx:7` | `@runtime/sign-out-action` |
| `portal/adult-portal-actions.ts:1` | yes | `class-detail-screen:13`, `classes-screen:12`, `deactivate-organization-control:7`, `organization-detail-screen:8`, `organizations-screen:14`, `team-screen:16` | `@runtime/adult-portal-actions` |
| `portal/player-access-actions.ts:1` | yes | **only** `player-access-workflow.tsx:22` | `@runtime/player-access-actions` |
| `(public-play)/jogar/actions.ts:1` | yes | via `@runtime/player-entry-action` | alias |
| `portal/atividades/actions.ts:1` | **no — zero importers** | proven empirically: contributes 0 of the 17 ids in the *full-graph server build* | — |
| `entrar/recuperar/actions.ts:11` (inline) | **no — zero importers** (`recuperar/page.tsx` is `"use client"` with a local `onSubmit`) | — | — |

All five *reachable* action modules are supplied **exclusively through `@runtime/*` aliases**, and
in demo mode all nine aliases resolve to `"use client"` modules or plain functions
(`adult-portal-demo-actions.ts:1`, `player-access-demo-actions.ts:1`,
`player-entry-demo-actions.ts:1` are `"use client"`; `demo-auth-actions.ts` is 7 lines with no
directive at all). A `"use client"` module cannot define a server action. The two orphan
`"use server"` files are excluded from **both** targets' graphs, which the server build's own
17-id composition independently confirms.

⇒ **The demo build's server-reference manifest is action-free for structural, graph-completeness
-independent reasons.** The export build's larger prerender graph cannot change this, because
alias resolution is global (`turbopack.resolveAlias`, `next.config.ts:42-80`) rather than per-route.

### Which rationale is true — the decision-relevant answer

**The report is right, and the plan's framing is wrong.**

* `REFACTOR_PLAN.md:130` (§3.1 step 3) asserts that because `target.demo.ts` imports zero
  `"use server"` files, the demo manifest contains 0 ids "**effortlessly passing E625**". That
  conditional is already satisfied today by the *alias* mechanism: the demo graph today already
  registers nothing. §3.1(3) does not unblock E625; it **preserves** a property that already holds.
* Therefore §7.2's manifest clause is a **regression guard** — necessary to keep the seam from
  *introducing* an action (e.g. if Day-2's `sign-in-form.tsx` / `sign-out-button.tsx`
  (§3.1 step 4) are written as `'use server'` modules instead of client fetches), not proof the
  seam landed.
* The clause that genuinely discriminates today is the alias count: `grep -c '"@runtime/'` →
  **9** in `next.config.ts` (`:44-79`) and **9** in `tsconfig.json` (`:24-42`) — both must reach
  0 — plus **24 `@runtime/` import statements across 23 files, all 23 of which survive the purge**
  (re-counted: `grep -rn 'from "@runtime/' src tests` = 24 / 23).
* The honest rationale for the seam is therefore **type-safety + testability**, exactly as the
  prompt anticipated: today `tsconfig.json` paths bind the nine aliases to the **server**
  implementations, so `npm run typecheck` never type-checks the demo wiring at all, and there is
  no `typecheck:demo` script (`package.json` has none, though
  `architecture-audit-2026-09-23.md:741` demands one).

**Consequence the dossier should state:** E625 is *not currently failing* in this repo. The
`out/` export on disk proves it — 104 documents were emitted with the full Generation-A graph
present. If §3.1 is sold as the thing that "makes the export buildable", a reviewer who runs
`npm run build:demo` once will see it succeed and conclude the whole seam is unnecessary.

---

## Build-order hazard and the CI ordering that must be mandated

### The mechanism, from source not inference

`next.config.ts:21-32`:

```
runtimeMode === "demo" && phase === PHASE_DEVELOPMENT_SERVER → distDir: ".next-demo-dev"
runtimeMode === "demo" && anything else                      → output:"export", basePath:"/SMS_Portal", distDir: default ".next"
runtimeMode === "server"                                     → output:"standalone", distDir: default ".next"
```

**Demo `build` is NOT redirected; only demo `dev` is.** So `build:demo` and `build:server`
write into the *same* `.next`, and `export/index.js:359` guarantees `build:demo` creates
`.next/server/server-reference-manifest.json` for a later assertion to read.

### Ground truth on disk

| Artifact | Value | mtime |
| :-- | :-- | :-- |
| `out/index.html` | asset build id `Jj4Ra8TO08geLsJFHkfna` | 2026-09-23 02:04:38 |
| `.next/BUILD_ID` | `E7B1icx1I4_iMk6hNNHSJ` | 2026-09-23 02:05:52 |
| `.next/server/server-reference-manifest.json` | 17 server-action ids | 2026-09-23 02:05:46 |
| `.next/required-server-files.json` | `output:"standalone"`, `basePath:""` | 02:05 |

The `required-server-files.json` check is what makes this airtight: the surviving `.next`
declares `standalone` with no base path ⇒ it is unambiguously the **server** build, sitting on
top of a demo build whose only remaining trace is `out/`. Gap ≈ **74 s**.

**Correction to the task brief:** there is **no `out/BUILD_ID`** (`stat` fails). `out/` carries
its build id only in the `_next/static/<id>/` asset paths. INV-F's own wording is correct here.

### Both failure directions, not one

The report only warns about the *false-fail* direction. There is also a **false-pass** direction,
and it is worse:

| Sequence | What a later `.next/server/server-reference-manifest.json` reader sees | Outcome |
| :-- | :-- | :-- |
| `build:demo` → assert → `build:server` | demo's 0 ids | correct |
| `build:demo` → `build:server` → assert | server's 17 ids | §7.2 **fails spuriously** on a clean seam |
| `build:server` → `build:demo` → assert | demo's 0 ids | correct, but `out/` and `.next` now disagree about which target produced them |
| `build:server` → `build:demo` **aborts** → assert on leftover server manifest | 17 ids | fails, but blames the wrong target |
| `build:demo` → `build:server` **aborts mid-write** → assert | half-written manifest | `require()` throws — an unreadable error, not a gate verdict |

### The ordering that must be mandated (exact)

1. **Never assert on `.next/**` in the same job/step-run as a second build.** Prefer
   *separate jobs* (`build-demo` and `build-server` on separate runners) — the report says this
   and it is the right primary control.
2. If they must share a runner: **`build:demo` → manifest assertion → `rm -rf .next out` →
   `build:server` → route-manifest assertion.** The assertion must be *immediately* after its
   own build; a "collect all gates at the end" step ordering is unsound.
3. **Best fix, and it belongs in Day 0 not Day 2:** extend the `next.config.ts:26-28` demo
   branch to set `distDir: ".next-demo-build"` for **all** demo phases, not just
   `PHASE_DEVELOPMENT_SERVER`. This removes the hazard by construction instead of by
   discipline, is 1 line, and makes `out/` and `.next-demo-build` provably co-produced.
   The report raises this as Open Question #3 and does not commit; it should commit — a
   discipline-based rule will be broken by the next person who adds a step.
4. Note the report's `out/` assertions are **not** exposed to this hazard: `build:server` uses
   `output:'standalone'` and never writes `out/` (verified — `out/` mtimes all cluster at
   02:04, i.e. before the server build).
5. `tsconfig.json:47-54` *includes* both `.next/types/**/*.ts` and
   `.next-demo-dev/{,dev/}types/**/*.ts`, so the shared-distDir problem also leaks into
   `npm run typecheck`. See defect D3.

---

## Publishable §7.1 census

### My method (stated so it is reproducible and comparable)

* Universe: `git ls-files -z` → filter to `^(src|tests|scripts)/` **plus** root `*.ts|*.mts|*.mjs`
  configs → keep only `.ts .tsx .mts .mjs .css`. So: **tracked only**, which automatically
  excludes `node_modules`, `out`, `.next`, `.next-demo-dev`, and `docs`.
* `src/generated/**` excluded from the scan universe (24 `.ts`, **29,722** lines on disk —
  re-measured, matches §3.2; note it is **not tracked**, `.gitignore`, so it is excluded by the
  `git ls-files` universe as well).
* Line count = physical lines (`wc -l` equivalent, newline-terminated). Secondary column =
  non-blank lines. Comments are **included**.
* Category = `tests/**`→test; `*.module.css`→css; `src/components/**/*.tsx` or
  `src/app/**/*.tsx`→component; everything else→module. (So
  `src/components/portal/adult-portal-helpers.ts` is *module* 300/500 — WARN at 317; the report
  flags the same and I agree it is WARN either way.)
* Levels from `REFACTOR_PLAN.md:247-250` = audit `:743-744`: component 250/400, module 300/500,
  css 300/600, test 400/800.
* Purge set built by expanding §2.2's 7 **trees** + §2.3's 18 **files** + §2.4's 6 **files**
  literally, then intersecting with the tracked universe. All 24 §2.3/§2.4 paths resolve to
  tracked files (no typos in the plan).

### Scope totals

| | files | lines |
| :-- | --: | --: |
| scan universe (baseline) | **207** | **34,154** |
| purge set (46 files) | 46 | **7,802** — §2.2 trees 22/1,754; §2.3 18/3,458; §2.4 6/2,590 |
| post-purge universe | **161** | 26,352 |

### BASELINE — 13 FAIL, 12 WARN

FAIL (physical / non-blank):

```
4910/4214 css       src/components/portal/portal.module.css
1625/1424 test      tests/unit/access-link-service.test.ts
1222/1160 module    src/runtime/game-offline-sync.ts
1024/ 957 module    src/runtime/adult-portal-demo-store.ts
1017/ 889 css       src/components/public/public.module.css
 932/ 863 component src/components/public/game-host.tsx
 717/ 668 module    src/server/services/access-link-service.ts
 688/ 598 css       src/components/marketing/marketing.module.css
 616/ 588 module    src/application/adult-portal/service.ts
 540/ 520 component src/components/portal/player-access-workflow.tsx
 521/ 488 module    src/server/services/portal-view-service.ts
 517/ 480 module    src/app/(professional)/portal/atividades/actions.ts
 411/ 406 component src/components/portal/team-screen.tsx
```

WARN: `game-offline-sync.test.ts` 728, `authorization.test.ts` 634,
`contracts/v1/schemas.ts` 481, `prisma-adult-portal-store.ts` 467,
`prisma-game-event-store.ts` 385, `results.module.css` 378,
`prisma-player-access-store.ts` 377, `prisma-access-link-store.ts` 352,
`results-screen.tsx` 341, `adult-portal-helpers.ts` 317, `material-editor.tsx` 266,
`activity-builder.tsx` 256.

Category totals: component 77 (3 FAIL/3 WARN), module 91 (6/6), css 6 (3/1), test 33 (1/2).
*The report said module n=89 and css 1 FAIL/3 WARN-pre-purge ordering; I get module 91 and
css 3 FAIL/1 WARN. The FAIL/WARN totals (13/12) and every file+line agree exactly.*

### POST-PURGE — 9 FAIL, 8 WARN (the publishable list)

| # | Cat | Physical | Non-blank | File | Still FAIL non-blank? | §4 step? |
| --: | :-- | --: | --: | :-- | :-- | :-- |
| 1 | css | 4,910 | 4,214 | `src/components/portal/portal.module.css` | yes (>600) | **§4.1** |
| 2 | module | 1,222 | 1,160 | `src/runtime/game-offline-sync.ts` | yes (>500) | **§4.2** |
| 3 | module | 1,024 | 957 | `src/runtime/adult-portal-demo-store.ts` | yes | **NONE** |
| 4 | css | 1,017 | 889 | `src/components/public/public.module.css` | yes | **NONE** |
| 5 | component | 932 | 863 | `src/components/public/game-host.tsx` | yes (>400) | **§4.3** |
| 6 | css | 688 | 598 | `src/components/marketing/marketing.module.css` | yes | **NONE** |
| 7 | module | 616 | 588 | `src/application/adult-portal/service.ts` | yes | **§4.4** |
| 8 | component | 540 | 520 | `src/components/portal/player-access-workflow.tsx` | yes | **NONE** in §4 |
| 9 | component | 411 | 406 | `src/components/portal/team-screen.tsx` | **yes (406 > 400)** | **NONE** |

WARN (8): `game-offline-sync.test.ts` 728, `contracts/v1/schemas.ts` 481,
`prisma-adult-portal-store.ts` 467, `prisma-game-event-store.ts` 385,
`results.module.css` 378, `prisma-player-access-store.ts` 377, `results-screen.tsx` 341,
`adult-portal-helpers.ts` 317.

Every file existence verified by the scan itself. Post-purge category totals:
component 48 (3F/1W), module 80 (3F/5W), css 6 (3F/1W), test 27 (**0F**/1W).
**The purge does take the test budget to zero FAILs** (max surviving test = 728, WARN) —
CONFIRMED, and it removes exactly 4 FAILs and 4 WARNs, every deleted file having been an
offender. CONFIRMED.

### Robustness

All nine post-purge FAILs still FAIL on the non-blank measure. `team-screen.tsx` is the only
borderline case (411 physical / 406 non-blank against a 400 ceiling) and it crosses under both.
The offender set is **method-independent**. CONFIRMED.

### Is §7.1 only satisfiable under the ratchet reading?

Yes — and more strongly than the report argues, in one respect and less strongly in another.

* **More strongly:** the budgets are *currently unenforced by anything*. `eslint.config.mjs` is
  **17 lines** with **no `max-lines`** rule (`grep max-lines` → nothing); `ls scripts` →
  only `next-target.mjs`, `start.mjs`; no CI runs any size check. So today §7.1 cannot fail for
  any reason. The report's "cannot fail today; nothing computes it" is CONFIRMED.
* **Less strongly:** §7.1 is not actually ambiguous. `REFACTOR_PLAN.md:246` reads "All new
  **or modified** files respect the governing budget" — the ratchet qualifier is *already in the
  plan's own sentence*, and `architecture-audit-2026-09-23.md:744-746`
  ("Ratchet: the budget applies to *new or modified* files only, so the plan does not stall on
  existing offenders") merely agrees with it. There is no conflict to resolve, so
  `REFACTOR_PLAN.md:19`'s governance clause is not doing any work here. What the ratchet does
  *not* save you from is the second clause: **a ratchet still bites the moment a file is
  touched**, and §4 touches `portal.module.css`, `game-offline-sync.ts`, `game-host.tsx` and
  `service.ts` by design. The other five will not be touched, so they are genuinely exempt.
  ⇒ The report's conclusion ("state §7.1 explicitly as the ratchet") is right; its
  "under a global-clean-tree reading it is not reachable" counterfactual is a straw man.
* **The real §7.1 defect is §4.2, and it is CONFIRMED:** `REFACTOR_PLAN.md:165` plans
  `offline/idb-store.ts` at ~650 lines. That is a *new, modified* file ⇒ the ratchet applies ⇒
  **650 > 500 = a fresh FAIL created by the plan itself**, plus `sync-engine.ts` ~350 as a fresh
  WARN (`:167`). 160+650+60+350 = 1,220 ≈ 1,222, so the split is volume-preserving and
  budget-violating. `idb-store.ts` must be split at least twice (schema/migrations vs CRUD), or
  §4.2's estimate restated. Day 3 cannot close §7.1 while §4.2 as written is being executed.
* **The 5 unaddressed FAILs** (`adult-portal-demo-store.ts` 1,024; `public.module.css` 1,017;
  `marketing.module.css` 688; `player-access-workflow.tsx` 540; `team-screen.tsx` 411) are
  correctly identified and are, under the ratchet, *acceptable as untouched debt* — but only if
  no other §3/§4 step edits them. §3.3 (`REFACTOR_PLAN.md:141`) explicitly **edits
  `adult-portal-demo-store.ts`** ("remains persistence-backed via `window.localStorage`", plus the
  `demo-issuer.ts` credential-hash change), which flips it from "exempt existing offender" to
  "modified file over budget". **This is a §7.1 violation the report did not connect:** Day-2/3
  work on that 1,024-line file is permitted to start only once it has been split, yet it has no
  §4 step. Same risk for `player-access-workflow.tsx` (540) via §4.4's navigation extraction and
  the Day-5 §3.3 player-access edits.
* `marketing.module.css` (688) is a genuine §4.1 blind spot: §4.1 is titled
  "CSS Restructuring (`portal.module.css`)" and never mentions the other two CSS FAILs, even
  though `marketing.module.css` is live styling for `/entrar` and `/entrar/recuperar`
  (`entrar/page.tsx:5`, `entrar/recuperar/page.tsx:6`) — it is not dead code.

### Also CONFIRMED, exactly: §4.1 names 6 files (`:156-161`: primitives + 4 screen modules +
residual shell), importers 37→22, and the "residual needs ≥11 files at the WARN budget"
arithmetic — with the caveat in the next section that 3,110 is a *deduplicated* residual.

---

## CSS number reconciliation (definitions only)

INV-F: 1,135 newly-dead / 665 already-dead / **1,800 total removable** / **3,110 residual** /
4,910 (cited as 4,911) baseline.
INV-E: **1,823** block-deletable / **+161** lines in 26 mixed rules / ~2,950–3,050 residual
"redistributed **above**".

These are not in conflict; they count different sets. The reconciling axes are:

| Axis | INV-F | INV-E | Effect on the published number |
| :-- | :-- | :-- | :-- |
| **A. Name of the headline set** | "total removable" = 1,800 | "block-deletable" = 1,823 | 23-line gap. Both intend *fully-dead rule blocks only*. Neither figure is a superset of the other; they are the same definition computed by two different attributions |
| **B. Mixed/grouped selector lists** | not surfaced as a separate bucket; the 1,800 appears to be fully-dead-only | 26 rules / 161 lines held **out** of 1,823 as "selector surgery" | If the dossier publishes one "removable" number, INV-E's honest total is **1,984** (1,823+161) vs INV-F's **1,800** — this single axis explains almost the whole headline disagreement |
| **C. Rule-line attribution** | "selector-block attribution", undefined | "union of rule source lines", via a postcss walk, explicitly *excluding* `@media` wrapper lines and separately counting 42 dead rules *inside* `@media` | Whether the selector line, both brace lines, preceding comments and blank separators are inside a "block" moves a 4,910-line file by tens of lines. **This is the definition INV-F never states and must** |
| **D. `tone*` / dynamic `styles[…]` crediting** | notes the 2 dynamic lookups (`activity-mark.tsx:22`, `materials-explorer.tsx:92`) are both in the purge set, so nothing survives | credits `toneBlue/Orange/Aqua/Purple/Green` to those 2 files ⇒ **purge-dead**, and warns that a static grep would call them "never used" | Does **not** change either total (both count them as dead), but it moves those 5 rules between INV-F's **665 already-dead** and **1,135 newly-dead** buckets. The 1,135/665 split is the only INV-F number with **no INV-E counterpart at all** |
| **E. Bucket taxonomy** | split by *when* the class died (pre-purge vs newly-killed-by-purge) | split by *why* (purge-dead 91 classes vs never-referenced 58 classes, summed into one line count) | Orthogonal partitions of the same set. Neither is wrong; publishing both splits side by side is what created the appearance of a dispute |
| **F. Residual: union vs post-split total** | 3,110 = 4,911 − 1,800 — the line count of the surviving rules, **deduplicated** | ~2,977 by the same arithmetic, but then states the real post-split sum is "~2,950–3,050 lines **redistributed above**" because `@media` reflow slices are **copied into several new modules** | **The most decision-relevant difference.** INV-F's "≥6 files @600 / ≥11 @300" is derived from a *lower bound*. The true post-split sum is ≥ residual + duplicated media slices, so 6 files is optimistic even at the FAIL budget and 11 is a floor not an estimate |
| **G. Denominator** | 4,911 (`wc -l` is 4,910; verified `tail -c 1` = `0a`, so the file ends with a newline and 4,910 is correct) | 4,910 | Off-by-one in the "36.7 % of 4,911" figure; harmless, but it is a method tell |
| **H. Class census** | not published | 317 (leading-selector) / 319 (any-position) vs the plan's 308 (`REFACTOR_PLAN.md:150`) | Unrelated to line counts, but a third number the dossier will be asked about |

**Recommended single publication for the dossier** (three named quantities, one method each, plus
a machine oracle instead of prose):

1. **`block_deletable_lines`** — lines of rule blocks in which *every* selector is dead. Expect
   **1,800–1,825**; publish only after INV-F's block boundary and INV-E's postcss "union of rule
   source lines" are made identical (axis C). Both agree the plan's `REFACTOR_PLAN.md:153`
   "1,567" is wrong, in both readings.
2. **`mixed_rule_lines`** — **161 lines / 26 rules** (INV-E). Report **separately**, never folded
   into "removable" (axis B).
3. **`residual_deduplicated`** — file size minus (1) minus the dead parts of (2):
   **~2,980–3,110** (axis F), and state that the *post-split sum is larger* because media slices
   duplicate. Only this second number may be divided by 300/600 to size §4.1's file count.

The 1,135/665 newly-vs-already split should be **dropped** from the dossier, or independently
re-derived after axis D is fixed, since it has no counterpart and is the least stable number in
either report.

---

## §7.5 verdict

### Sub-claims

* **"`out/404.html` exists and Pages serves it"** — **CONFIRMED.** `out/404.html` 7,277 B
  (02:04:37) containing "Página não encontrada", plus `out/404/index.html` (7,277 B) and
  `out/_not-found/index.html`. GitHub Pages exposes no rewrite primitive, so an un-emitted path
  is an HTTP 404 carrying that document. `REFACTOR_PLAN.md:143`'s "falls back to the
  `/portal/turmas` list" is **WRONG** and the report is right to say so.
  **Better citation the report missed:**
  `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-static-params.md:376`
  — "only paths provided by `generateStaticParams` will be served, and **unspecified routes will
  404** or match (in the case of catch-all routes)". That is a normative statement in the API
  reference, not just the deployment recipe at `static-exports.md:319-361`.
* **Option (c) already implemented** — **CONFIRMED at the cited lines.**
  `classes-screen.tsx:140` `const generatedInBrowser = classGroup.id.startsWith("demo-class-")`;
  `:162-165` label "Criada neste navegador" and the suppressed arrow icon; `:169-180`
  `generatedInBrowser ? <article className={styles.classGroupCard}> : <Link href={...}>`.
  Mirrored at `organizations-screen.tsx:124,146`; filtered at `overview-screen.tsx:207`.
  The only `router.push` to a dynamic route anywhere is `activity-builder.tsx:60`, deleted by §2.3.
  **Option (c) is not work to do; it is work not to regress.**
* **Option (b) "has no supported pattern in the vendored docs"** — **WRONG.**
  `01-app/02-guides/migrating/from-create-react-app.md:321-323` —
  "Since we want to keep the app as an SPA for now and intercept **all** routes, we'll use an
  [optional catch-all route]" → create `app/[[...slug]]/`, with
  `export function generateStaticParams(){return [{slug:['']}]}` at `:334-339`; and
  `01-app/02-guides/migrating/from-vite.md:363-383`, verbatim the same recipe under
  `output: 'export', // Outputs a Single-Page Application (SPA)` (`:83`), with `:397`
  "When you run `next build`, the file is prerendered into a static asset."
  The report's blanket sentence — *"there is no `__next`/SPA-shell recipe anywhere in
  `node_modules/next/dist/docs/`"* — is false, and `single-page-applications.md` is not the only
  place to have looked.

### Does that overturn the recommendation? **No — but it moves the argument.**

The catch-all shell emits **exactly one document** (`out/index.html`, for `slug:['']`). It solves
"the client owns the router", not "the file exists". A hard refresh on
`/SMS_Portal/portal/turmas/demo-class-<uuid>/` is still a GET for a path with no document, and
Pages still answers with `404.html`. To make (b) work you would have to enumerate
`generateStaticParams` over the unbounded `demo-<kind>-<uuid>` space — which is exactly the
`dynamicParams: true` / "Dynamic Routes without `generateStaticParams()`" pair the unsupported
list at `static-exports.md:280-281` forbids (the report's `:279-280` is off by one; the
"`next dev` will result in an error" sentence is at `:295`, not `:293`).

So the dossier should read: **option (b) is rejected because GitHub Pages cannot rewrite a path
whose document was never emitted — Next.js *does* ship a supported optional-catch-all SPA-shell
pattern for `output:'export'`, but it does not help on a host without rewrites, and adopting it
would still cost the 1.5–2.5 days and the SSR→CSR conversion the report estimates.** The
recommendation **"(c) as the mechanism, (a) as the wording of the gate"** stands.

One addition the report should carry: the *supported* alternatives that **would** work on Pages,
both cheaper than (b): (i) hash-based or query-param routing for created entities (the requested
path is always `/SMS_Portal/portal/turmas/`, which *is* emitted); (ii) the modal/drawer rendering
(c) already implies. Option (c) is therefore not merely the pragmatic pick — it is the only one of
the three that is consistent with a per-document static host.

### Item 5's other claims

* `dev:demo` is not a preview of the export — **CONFIRMED.** `next.config.ts:26-28` gives dev a
  different `distDir` and no `output:'export'` / `basePath`; so the proxy matcher
  (`src/proxy.ts:136-137`) runs and there is no `/SMS_Portal` prefix. **Any Day-4 checklist run
  only under `dev:demo` passes while the shipped artifact is broken.** Correct and important.
* Results frozen to the seed — **CONFIRMED.** `results-screen.tsx:1` is
  `import Link from "next/link"` (no `"use client"`); `game-events-demo.ts` reads
  `demoAdultPortalSeed` / `demoClasses` (`:11-14` literal of 3, `listStaticResultClassIds`
  `:109-111`, `listStaticResultPlayerParams` `:113-121`), never `readDemoAdultPortalState()`.

---

## CI design defects found

**D1 — `npm test` is order-dependent, and the report did not find it.**
`tests/unit/auth.test.ts:161-165` — a surviving file — has
`afterEach(() => { delete process.env[flagKey]; delete process.env.APP_RUNTIME_MODE;
delete process.env.NODE_ENV; })`. It **deletes** rather than restores, destroying the
`APP_RUNTIME_MODE: "demo"` that `vitest.config.mts:13-15` injects per worker. Any later file on
the same worker whose module graph calls `getRuntimeMode()` against `process.env` throws at
*import* time.

Proved, not theorised:

```
$ npx vitest run --no-isolate --fileParallelism=false tests/unit/auth.test.ts tests/unit/portal-dev-bypass.test.ts
 ❯ getRuntimeMode src/runtime/mode.ts:10:28   "Invalid option: expected one of \"demo\"|\"server\""
 ❯ isDemoRuntime src/runtime/mode.ts:16:10
 ❯ src/server/services/portal-view-service.ts:7:21   <-- module-scope call
 ❯ tests/unit/portal-dev-bypass.test.ts:5:1
 Test Files  1 failed | 1 passed
$ npx vitest run --no-isolate --fileParallelism=false      # full suite
 Test Files  1 failed | 32 passed (33)
```

The reverse order and other pairings pass, which is the signature of scheduling-order
sensitivity. Green today **only** because vitest 4.1.11's defaults (`isolate:true`,
`fileParallelism:true`, threads pool — nothing is configured in `vitest.config.mts` or
`package.json`) re-apply `test.env` per file. **Day 0 must add `ci.yml`-relevant language:**
any future `isolate:false`, `singleFork`, `--no-isolate` or `--fileParallelism=false` (a tempting
2 s-suite CI speed-up) turns the suite red with an error that looks like a product bug in
`src/runtime/mode.ts`. Post-purge the specific victim disappears (`portal-view-service.ts` is §2.3,
`portal-dev-bypass*.test.ts` are §2.4) but **the surviving offender `auth.test.ts` remains** —
the hazard class, not the instance, is what to fix (restore, don't delete).

Good news verified in the same pass: **no test reads `out/` or `.next`.** The only disk reads are
`v1-contracts.test.ts:29-34`, `game-offline-sync.test.ts:29-30` and
`game-state-service.test.ts:24-25`, all resolving `process.cwd()/contracts/…` — 59 **tracked**
files. So `npm test` has no export dependency and no DB/network dependency (all Prisma is
`vi.fn()`-mocked), as the report claims.

**D2 — the recommended `ci.yml` is red on its first run.** The report's spec includes
`run: npm run format:check`. Measured here:

```
$ npx prettier --check .        →  exit 1
[warn] REFACTOR_PLAN.md
```

`REFACTOR_PLAN.md` is unformatted, and `.prettierignore` (`.next`, `node_modules`,
`src/generated`, `package-lock.json`, `contracts`, `docs`, `portal-v1-specification.md`,
`prisma/schema.prisma`) does **not** cover it. So `npm run check` — the command `README.md:96`
documents as *the* verification entry point, and which the report describes as
"`npm run format:check` … (in `npm run check`)" — is **failing today**, and is the only leg of
`check` that fails (lint 0, typecheck 0, test 284/284). The report's own baseline table claims
all gates green because it never ran `format:check`. Since the plan is fixed input, the Day-0
fix is a `.prettierignore` line, and Day 0's recorded baseline must include the
`format:check = RED` fact or `ci.yml` will look like it broke the build.
Secondary hazard: `prettier --check .` is **non-hermetic** — it walks untracked files too, so any
scratch file in a working tree changes the gate verdict.

**D3 — `DIRECT_URL` in the report's `build-server` env block contradicts its own offline-generate argument.**
The design says `npm ci` → `postinstall: prisma generate` is offline *because*
`prisma.config.ts:4,11` only attaches a datasource url when `DIRECT_URL` is set — and then sets
`DIRECT_URL: postgresql://ci:ci@localhost:5432/ci?sslmode=require`. In that job, `npm ci` is the
**first** step, so `prisma generate` runs with a datasource url pointing at a socket that does
not exist on `ubuntu-latest`. `generate` should still not connect, but there is **zero benefit**
to `DIRECT_URL` in a job that never migrates, and it is the one variable that could make the
whole CI design fail for a reason unrelated to the code under test. **Drop `DIRECT_URL` from
every `ci.yml` job**; keep `DATABASE_URL` (only `next.config.ts:14` validates it, syntactically).

**D4 — the report's manifest assertion has a live bug and an unstated cwd assumption.**

```js
actions.map(i=>m.node[i].filename)   // TypeError if the id lives in m.edge
require("./.next/server/…")          // resolves against the step's cwd
```

Any `use cache` reference (which the assertion deliberately tolerates by filtering bit 7) that
lands in `edge` — or a future Next that puts one there — turns a "HARD gate" into an unreadable
crash rather than a verdict. Use `m.node[id]?.filename ?? m.edge[id]?.filename ?? "?"`, and
`cd "$GITHUB_WORKSPACE"` or use an absolute path. Semantics otherwise verified correct against
`extractInfoFromServerReferenceId`.

**D5 — `prisma migrate diff --from-migrations` is asserted offline without evidence (and the report's Open Q1 admits it ran nothing Prisma-side).** `--from-migrations` is precisely the axis
that pulls in a shadow database. Shipping `ci.yml` with an unproven command means the first run
of the new safety net fails on a tooling question. Safer Day-0 substitute with **no DB and no
shadow DB**: (i) `prisma validate` *only if* proven to pass with no `DIRECT_URL` (else drop it),
(ii) `prisma generate`, (iii) a grep-based migration-parity assertion —
`test -f prisma/migrations/6_drop_generation_a/migration.sql` plus
`grep -q 'DROP TABLE.*access_links'` / `capability_assignments` / `rate_limit_buckets` and
`grep -q 'CREATE TABLE' …; test $? -ne 0` for the 3 models. Crude, but it cannot fail for
infrastructure reasons and it *is* falsifiable, which the current `prisma validate` gate is not
for §2.5(6).

**D6 — `typecheck` before any build is a strictly weaker gate than `typecheck` after one, and the asymmetry is not disclosed.** `tsconfig.json:47-54` includes **four** build-artifact globs —
`.next/types/**/*.ts`, `.next/dev/types/**/*.ts`, `.next-demo-dev/types/**/*.ts`,
`.next-demo-dev/dev/types/**/*.ts` — 12 generated `.ts` files exist locally, including
`validator.ts` (Next's per-route prop/param type validator) and `routes.d.ts`. In CI,
`lint → typecheck → build` ordering means the standalone `typecheck` sees **none** of these, so
route-shape regressions are caught *only* by the builds' own type check. The report raises this
as Open Question #4 but only for `.next/types` and without naming the CI-vs-local asymmetry.
Related: the report's 2.638 s typecheck was a **full incremental cache hit** (md5 unchanged
before and after proves tsc reused it). A cold pass here took **6.7 s**. Day 0's recorded
baseline should be captured with `tsc --noEmit --incremental false`, or it will not reproduce in
CI.

**D7 — confirmed non-defects (the report's design holds up).** `npm ci` does not need
`DATABASE_URL` on static reading (`schema.prisma:6-8` has no `url`; `prisma.config.ts:11`
conditional). The Zod gates accept `.env.example`: `DATABASE_URL`/`DIRECT_URL` are `.url()`-valid
and satisfy `env.ts:5-14`'s `postgresql://` refine; `NEON_AUTH_BASE_URL` is a valid URL; both
secrets are **42** chars (`replace-with-at-least-32-random-characters`; the report said 41 —
harmless) ≥ `.min(32)`; `ALLOWED_ORIGINS=http://localhost:3000` satisfies the no-path check at
`env.ts:16-36`; `LOG_LEVEL=info` and `READINESS_TIMEOUT_MS=2000` match `env.ts:70-78`.
`.env.example` has **11** vars, not the 10 the report counts (it omitted `GAME_CLIENT_URL` from
its own list, then noted it). A `build:demo` job does **not** need `.env` absent —
`next-target.mjs:26-53` spreads `process.env` and then hard-blanks all 7 server vars to `""`,
and `""` is falsy to `z.stringbool()` (`env.ts:38`), so a stray `.env` is neutralised for demo.
Demo mode has no server-secret requirement, matching `README.md:82-83`.
Minor consequence to note rather than fix: because the report's `build-server` env omits
`GAME_CLIENT_URL`, `/jogar` prerenders with `gameClientUrl = null`
(`jogar/page.tsx:6-12` → `game-client.ts:17-19` returns `{status:"missing"}` **without
throwing**, so the build still succeeds) — the CI-built server artifact is therefore not
byte-identical to a production build. Set `GAME_CLIENT_URL=https://game.example.com` (from
`.env.example`) to keep the prerender representative.

**D8 — the report's §7.1 "ad-hoc check command" does not work as written.**

```bash
awk '$1>=$3 ~ /module.css$/ ? 300 : 250'
```

This is not valid awk (`$1 >= ($3 ~ /module.css$/ ? 300 : 250)` is needed, and the last
`wc -l` `total` row would need excluding too). Cosmetic, but it is the one command in the report
someone will paste into a Day-0 shell.

**D9 — confirmed: `deploy.yml` really does publish unaudited.** Every one of the report's
`deploy.yml` facts reproduced verbatim, including `permissions: pages:write, id-token:write`
(`:8-11`) which the report correctly says must **not** be copied into `ci.yml`, and
`cancel-in-progress: false` (`:15`). Because `deploy.yml` triggers on `push: main` (`:3-5`) and
Actions offers no cross-workflow `needs`, the only control that makes "ci.yml first" real is
**branch protection requiring the ci.yml checks** — a repo *settings* change, not a file change.
The report is right that this is a Day-0 prerequisite that `REFACTOR_PLAN.md:209-212` does not
list. Verified independently: `node-version: "24.19.0"` (`:27`) is a duplicated literal where
`node-version-file: .node-version` would be single-sourced, and `.node-version` = `24.19.0` =
`package.json` `engines.node`, with no `.npmrc` and therefore no `engine-strict` (this very pass
ran on Node 22.23.1, which proves the pin is advisory).

**D10 — confirmed: no build-time Postgres execution anywhere in the server target.** Beyond the
report's evidence I checked the three vectors it names and one it did not:
`grep 'export.*GET' src/app/**/route.ts` → **0 matches** (all four `/api/v1/player/*` handlers
are POST-only, so nothing is invoked during prerender); the server build's
`prerender-manifest.routes` is exactly the 8 documented entries; `/portal/**` is forced dynamic
by `layout.tsx:23` `await connection()`; and the surviving prerenderable pages
(`app/page.tsx:1-13`, `entrar/page.tsx`, `jogar/page.tsx:5-19`, `recuperar/page.tsx`) contain no
data access at all — `jogar`'s only env read degrades gracefully. **The `src/proxy.ts` vector the
prompt asks about is a non-issue:** middleware/proxy never executes at build time, and it is
excluded from the export entirely (`static-exports.md:287` lists Proxy as unsupported).

---

## Claims that did not survive

1. **"`next-demo-dev`'s manifest is evidence about the export build"** — the *conclusion* is
   right, the *artifact* is not evidence: wrong path (`<distDir>/dev/server` vs `<distDir>/server`),
   `output:'export'` never set in dev so `export/index.js:361` never guards, and only 10 of 45
   page manifests compiled. The argument must be replaced with the alias-graph proof (item 1
   above). This is the report's most load-bearing inference and it was resting on the wrong file.
2. **"Option (b) has no supported pattern in the vendored Next docs"** — **WRONG.**
   `01-app/02-guides/migrating/from-create-react-app.md:321-339` and
   `…/from-vite.md:363-383` document the optional-catch-all SPA shell explicitly under
   `output:'export'`. The rejection of (b) survives on hosting grounds only.
3. **"§7.1's semantics are ambiguous and must be resolved via the governance clause"** —
   **OVERSTATED.** `REFACTOR_PLAN.md:246` already says "new or modified"; there is nothing to
   resolve. The real §7.1 defects are the missing tool and §4.2's self-inflicted FAIL.
4. **"`npm run check` is a 12-second green P0 lane"** — **WRONG.** `format:check` fails today on
   `REFACTOR_PLAN.md` (exit 1). Only lint/typecheck/test are green.
5. **"`prisma migrate diff --from-migrations` … is offline in Prisma 7"** — **UNSUBSTANTIATED**
   in a pass that explicitly ran no Prisma command, and it is load-bearing for the Day-1 gate
   note. Downgrade to "verify or replace".
6. **"`layout.tsx:8` `import { connection } from 'next/server'`"** — **WRONG LINE**; it is `:3`.
   (`:22-24` for the guard is correct, and `:23` is the `await`.)
7. **`server-reference-info.js:31-38` for the `typeBit === 1 ? 'use-cache' : 'server-action'`
   ternary** — the ternary is at **`:47`**. `:31` is the length constant and `:37` the bit shift;
   the quoted string is outside the cited range.
8. **`static-exports.md:279-280` / `:293`** — actual `:280-281` / `:295`; and the 404-fallback
   section is `:319-361`, not `:318-359`. Consistently off by 1–2.
9. **"~14 of `database-model.md`'s 196 lines are Generation-A"** and **"7 models undocumented"** —
   the tables are **7 documented vs 16 models**, so **9** are undocumented (`result_events` and
   `active_time_events` are the two the report missed). "≈14 Generation-A lines" is not
   reproducible as a line count and should be restated as "3 of 7 documented tables, 4 of 6
   mermaid edges".
10. **"`portal.module.css` 4,911 lines"** — 4,910; verified the file ends in `0a`.
11. **"both build targets write the same `.next`", evidenced by `out/BUILD_ID`** — the *report*
    says "asset build id in `out/_next/static/…`" (correct); the **task brief's** "`out/BUILD_ID`"
    is wrong, no such file exists. Recorded so the dossier cites the report, not the paraphrase.
12. Minor: `.env.example` has 11 variables not 10; the placeholder secrets are 42 chars not 41;
    pre-purge `module` category n=91 not 89; the misc-config bucket is 6 tracked files / 276 lines
    on my universe (I found no 7th; `postcss.config.mjs` does not exist), which is why my
    handwritten denominator is 34,288 rather than 34,295 — 22.75 % vs 22.8 %.

---

## Corrections vs INV-A / INV-C agreement

**INV-A (46 files / 7,802 lines / 22.9 %): I agree with all three, independently.**
My purge expansion of §2.2's 7 trees + §2.3's 18 files + §2.4's 6 files, intersected with the
tracked universe, gives **46 files / 7,802 physical lines**, with the internal split
22/1,754 + 18/3,458 + 6/2,590 matching INV-F's separately-derived table exactly. On the
percentage: **22.75 %** is what I get on denominator *src-excluding-generated + tests + tracked
root configs* = 27,433 + 6,579 + 276 = **34,288**. INV-A's 22.9 % and INV-F's 22.8 % are the
same number computed over ±7 lines of different config inclusion (and one of them evidently uses
34,295). **All three reports agree on substance: the plan's "~29 %" is not the share of
handwritten code removed.** For the dossier I propose publishing the explicit pair
**7,802 / 34,288 = 22.8 %**, and adding the sentence that 29 % is only reachable as either
7,802 / 27,433 = 28.4 % (src-only denominator, which excludes the 2,590 purged test lines from
the denominator while counting them in the numerator) or 7,802 / 26,486 = 29.5 % (share **of the
surviving** tree). Both are legitimate statistics; neither is "share of handwritten code
removed", which is what §2's sentence claims.

**INV-C (commit state): I agree.** `git rev-parse HEAD` = `origin/main` =
`e5aaf1e2891dbb1804950223eb9f0765e7dbeb65`; `git status --porcelain` empty on first command;
`git status -sb` = `## main...origin/main` with no ahead/behind; `git ls-files --others
--exclude-standard` = 0. `prisma/migrations` contains `0_init, 1_add_paused_at,
2_v1_adult_roles_and_classes, 3_slice_02_player_access, 4_v1_game_state, 5_v1_game_events`, so
**migrations 4 and 5 are already committed**, and the only post-hoc untracked path is
`docs/refactor-dossier/` (this dossier's own outputs, written concurrently). ⇒
**`REFACTOR_PLAN.md:210` — "Commit 30 untracked files + uncommitted schema + migrations 4 & 5" —
is already satisfied. Day 0 has no commit work.** I verified the plan line reads verbatim as
quoted.

**Where INV-F, INV-A and INV-C converge and I add to it.** All three reports now independently
establish the same baseline (clean `e5aaf1e`, 46/7,802, lint/tsc/test green). The two additions
from this pass that none of them carry are **D1** (`npm test` order-dependence, with a reproducing
command) and **D2** (`format:check` red on `REFACTOR_PLAN.md`) — both are Day-0 gate items, both
are cheap, and D2 in particular means the newly-added `ci.yml` would fail on the merge that adds
it unless the baseline records the failure first.

---

## Extra omissions relevant to a Day-0 / Day-4 gate

* **O1 — `docs/current-architecture.md:257-258` is false today, independent of the refactor:**
  "the checked-in `.env` contains example hosts" — `.env` is **gitignored** (`.gitignore:13`,
  confirmed by `git check-ignore -v .env`) and untracked. There is no checked-in `.env`. This is
  not in the report's Day-4 doc table and it is not refactor-caused, so it will be missed.
* **O2 — `README.md:53` and `current-architecture.md:176` both document `/health/live` +
  `/health/ready`, and `find src/app/health -type f` → 0 files** (`src/app/health/{live,ready}/`
  exist as empty, untracked directories). The report's doc table catches `README.md:53` but not
  `current-architecture.md:176` under the same "already false, delete now" heading — they must be
  fixed in one edit or the two truth docs will disagree about whether the endpoints exist.
* **O3 — a seam blind spot in the surviving tests.** `tests/unit/player-access-actions.test.ts:33-36`
  (4 tests, **not** in §2.4's delete list) imports
  `@/app/(professional)/portal/player-access-actions` and
  `@/app/(public-play)/jogar/actions` **by direct path, bypassing `@runtime/*`.** After §3.1(5)
  removes the aliases these tests keep passing while asserting the *server* variant only — the
  demo variant stays untested, which is precisely the gap §3.2's "compile-time drift detection"
  is supposed to close. This file is also *outside* the report's "24 `@runtime/` imports across
  23 files" rewrite list, so nothing in Day 2 touches it. Flag for Day 2.
* **O4 — the report's `out/` shape assertion is under-documented for the number it pins.**
  `[ "$(find out -name index.html | wc -l)" -eq 25 ]` depends on Next emitting **both**
  `out/404.html` *and* `out/404/index.html` *and* `out/_not-found/index.html` under
  `trailingSlash:true`. That is a Next-internal detail, not a route-tree fact. The 26 must be
  decomposed in the CI comment or a Next upgrade will break a "page count" assertion for a reason
  no one can read off the routes. My derivation (below) is the stable half of the assertion.
* **O5 — nothing in the report's Day-4 gate catches a *silently vanished* page.** The `for p in
  …` loop enumerates 21 paths but the surviving set is 26 documents, so a page missing from a
  *non-enumerated* path (e.g. `/portal/ajuda`) is caught by the loop and one lost from
  `out/404/` or `out/_not-found/` is caught only by the count. The link-check the report
  proposes for P2 is the right instrument; it should be a Day-4 gate, not just a P2 suggestion.
* **O6 — §6 Day 4's `REFACTOR_PLAN.md:236` "assert no `api/` in `out/`" is confirmed unfailable**
  (`find out -type d -name api` → 0 today, with the four `route.ts` files present and POST-only),
  and the report's diagnosis is right. My D10 evidence (0 `GET` exports) explains *why*: the
  handlers are never invoked, so there is nothing to abort on. This also answers the report's
  Open Question 2 in the *negative* direction — a newly added dynamic **`GET`** handler *would*
  run at build and could abort the export, but a `POST`-only handler will simply vanish. So the
  `app-path-routes-manifest.json` assertion is the **only** braces, not a belt. The report asks
  whether it is a belt or braces; on this evidence: **braces.**

### Export-page derivation behind the 26 (method for O4)

Route-tree derivation, independent of `out/`: 16 surviving `page.tsx`
(`app/page.tsx`, `(professional)/entrar`, `entrar/recuperar`, `portal`,
`portal/admin/equipe`, `portal/admin/organizacoes`, `portal/admin/organizacoes/[id]`,
`portal/ajuda`, `portal/resultados`, `portal/resultados/[classGroupId]`,
`portal/resultados/[classGroupId]/players/[playerSlotId]`, `portal/sem-acesso`,
`portal/sessao-expirada`, `portal/turmas`, `portal/turmas/[id]`, `(public-play)/jogar`)
− 4 dynamic = **12** static documents; `generateStaticParams` expansion
(`adult-portal-demo.ts:69-71` → 2 orgs, `:73-75` → 3 classes; `game-events-demo.ts:109-111` → 3
classes, `:113-121` → 3 player slots, all under `demo-turma-3a`) = **+11**; Next-synthesised
`_not-found` **+1**, `404/index.html` **+1**, `404.html` **+1** ⇒ **26**.
The 4 `route.ts` under `src/app/api/v1/player/` contribute **zero** documents.
Cross-check: 104 HTML in `out/` − 78 in the seven §2.2 trees
(`atividade/` 52, `portal/atividades/` 13, `portal/materiais/` 8, `portal/modulos/` 2,
`portal/admin/{auditoria,jogos,modulos}/` 1 each) = **26**. **CONFIRMED by both methods.**
