# Phase 50 gates, CI, demo and docs — independent adversarial verification

**Verification date:** 25 September 2026
**Verifier role:** fresh verifier. No inherited claim was promoted without replaying its underlying check.
**Primary under test:** `docs/refactor-dossier-audit-2026-09-25/06-gates-ci-demo-primary.md` (224 lines)
**Target under test:** `docs/refactor-dossier/phases/50-gates-ci-demo-docs.md` (632 lines)
**Workspace:** `main` at `e5aaf1e2891dbb1804950223eb9f0765e7dbeb65`, clean tree; `docs/refactor-dossier/` and `docs/refactor-dossier-audit-2026-09-25/` untracked.
**Mode:** read-only. No source, test, config, stylesheet, generated file, or dossier file was modified; no remote mutation. All scratch under `%TEMP%\vv50`, outside the repo.

**Host toolchain (a stated limit, not a result):** Node **22.23.1**, npm 11.6.0, Git-Bash GNU grep 3.0, and `js-yaml` / `prettier` 3.9.6 / `eslint` 9.39.5 / `vitest` 4.1.11 from the repo's own `node_modules`. `package.json:6` pins `24.19.0` and this host does **not** satisfy `engines.node`. The two pinned **builds** were therefore **not** re-run by me; every build-derived number is marked `[X]` (corroborated against a stored artifact) rather than `[R]`.

## Evidence key

| Tag | Meaning |
| :--- | :--- |
| **[R]** | **Reproduced** — I executed the check and obtained the claimed result |
| **[P]** | **Partly reproduced** — the core holds, a sub-claim or figure is wrong |
| **[F]** | **Refuted** — I executed the check and obtained a different result |
| **[N]** | **New defect** — not in the primary; found here |
| **[X]** | Corroborated against a stored artifact or the live service, not re-executed |

## Verdict

**The primary is substantially accurate and survives adversarial replay.** All seven blockers, all four majors and both minors reproduce. I found **no refutation** of any primary finding and did not need to manufacture one.

Four claims are corrected or sharpened (§ *Corrections*), and I add **seven new defects** the primary missed (§ *New defects*). Three are material to execution: **Phase 50's work order contains a phantom edit whose exit bullet is unsatisfiable** (N-01, N-02), **`G7`/`G8` have no CI step at all** despite the phase existing to wire gates (N-03), and **the pinned dependency set carries an unauthenticated-RCE advisory on the exact framework version this refactor is built on** (N-04).

The headline remains: **NOT READY TO EXECUTE AS WRITTEN.**

## Reproduction summary

| # | Primary claim | My result | Verdict |
| :--- | :--- | :--- | :--- |
| B-01 | Proposed `ci.yml` is born red under its own `format:check` | `prettier --check .github/workflows/ci.yml` → **exit 1**; **8** differing lines (7 comment spacings + missing final newline) | **[R]** |
| B-02 | G6 exits 1 on the correct zero-alias state | present `9,9` → exit 0; synthetic `0,0` → **exit 1** | **[R]** |
| B-03 | G4 requires a path list and specifies none | `§11.1` cited at `50:92,351,546`, defined nowhere | **[R]** |
| B-04 | Phase 40/50 size gates and baselines conflict | disjoint script vocabularies; census **214 / 13 FAIL / 12 WARN** | **[R]** |
| B-05 | G7's "baseline 5" is pre-purge | oracle rebuilt: **50 imports, 5 violations**, exact lines; residual **4** | **[R]** |
| B-06 | G12 is a lexical gate, not enforcement | 11 synthetic workflows: **4 false passes** (primary found 2) | **[R]+[N]** |
| B-07 | Branch protection absent; proposed PUT insufficient | `gh api …/protection` → **HTTP 404**; one workflow; no `enforce_admins` | **[R]** |
| M-01 | G4/G5 accept compensating wrong artifacts | 4 false passes reproduced | **[R]** |
| M-02 | `start.mjs` builds before validating args | `build` at `:29`, arg parse at `:51` | **[R]** |
| M-03 | Docker path is born red | `Dockerfile:13`; no `ARG`/`ENV`; stored log shows `ZodError` | **[R]** + **[X]** |
| M-04 | Root `implementation_plan.md` is operational and false | `:69` `npm run build`; `:3` "100% visual and static"; unscheduled | **[R]** |

## Blockers — replayed

### B-01 — The proposed `ci.yml` is born red under its own first gate — **REPRODUCED [R]**

I extracted the single ```` ```yaml ```` fence from `phases/00-prerequisites.md` and wrote it byte-for-byte to `.github/workflows/ci.yml` in a scratch tree: **6,234 bytes**, `sha256:9d79cc32fa1e704f…`, and it **does not end with a newline** (the fence capture strips it).

```text
npx prettier --check .github/workflows/ci.yml   →  exit 1
[warn] .github/workflows/ci.yml
```

Prettier's rewrite is exactly **8 lines**: seven inline comments lose one space before `#` (`npm ci  # postinstall…` → `npm ci # postinstall…`, and the same for `format:check`, `lint`, `prisma validate`, `build:server`, `vitest run --no-isolate…`, `build:demo`), plus the missing final newline. This is the primary's "eight inline-comment spacings and adds the missing final newline", confirmed line for line.

**The repository baseline needs a qualification the primary does not carry:**

| Scope | Offenders |
| :--- | :--- |
| `prettier --check .` over the working directory | **5** — `REFACTOR_PLAN.md` **plus 4 untracked audit-debris files** (`.tmp-css-census.js`, `.tmp-wc/f100.ts`, `.tmp-wc/f400.ts`, `.tmp-wc/f501.ts`) |
| The same check restricted to the **343 tracked files** | **1** — `REFACTOR_PLAN.md` |

None of the four debris files is gitignored (`git check-ignore` → not ignored), and `prettier --check .` walks untracked non-ignored files. So "the repository baseline is also red on only `REFACTOR_PLAN.md`" is true of a clean clone and false of this tree, where `format:check` is red for five reasons. This does not weaken B-01 — it strengthens it: the proposed `ci.yml` is an additional offender, not the only one.

**Correction required:** prettier-format the proposed file before committing, and make "parse + `prettier --check` + exact content hash" part of the extraction verification.

### B-02 — G6 exits 1 on the correct zero-alias state — **REPRODUCED [R]**

The gate body is `grep -c '"@runtime/' next.config.ts tsconfig.json` (`50:94`). Measured alias counts today: `next.config.ts` **9**, `tsconfig.json` **9** — matching Phase 50's row.

```text
present tree (real files)    grep -c …  →  exit 0   "next.config.ts:9\ntsconfig.json:9"
synthetic correct 0/0 tree  grep -c …  →  exit 1   "next.config.ts:0\ntsconfig.json:0"   ← red on the correct state
```

GNU `grep -c` prints `0` per file and exits **1** when nothing matched, so a CI `run:` step is red precisely when the gate's goal is met. I also confirmed both repairs behave correctly:

- `test "$(grep -c … | head -1)" = 0` on `0/0` → exit **0**; with `tsconfig.json` **deleted** → exit **1** (missing file still fails — the property the primary asks to preserve).
- `! grep -qF '"@runtime/' next.config.ts && ! grep -qF '"@runtime/' tsconfig.json` → exit 0 on `0/0`, exit **1** on `1/0`.

**The strongest form of this finding is one the primary misses:** Phase 50's own "Grep discipline" paragraph (`50:102-115`) enumerates three failure modes and states it fixed (a) prose matches and (c) pattern semantics — but the G6 row is the one gate in the table that still violates its own rule (b), which that paragraph claims to have fixed. The file contradicts itself about its own best practice.

| m-01 | Reporter assumes every action id is in `m.node` | id in `m.edge` → **`TypeError`** | **[R]** |
| m-02 | Phase 50 cites nonexistent `docs/walkthrough.md` | absent; root file present; cited at `50:338` | **[R]** |
| — | G4 census 104→26 | **554 / 104 html / 103 index / 1 404 / 78 purged / 26 survivors / 52 in `out/atividade`** | **[X]** |
| — | G11 prints 19 | **exit 1, "G11: 19 stale-doc lines remain"**; per-file 1/3/15; per-pattern 2/2/5/4/4/2 | **[R]** |
| — | G9 serial reproduces the leak | parallel **33/284**; serial **1 failed / 32 passed, 282** | **[R]** |
| — | Live Pages | `/SMS_Portal/` 200 · `/atividade/7FQ-29M/` **200 (legacy still live)** · unknown **404** | **[R]** |
| — | Deploy run `35918529713` | `success`; build = checkout → Node → `npm ci` → `build:demo` → upload; **no quality step** | **[R]** |

### B-03 — G4 requires a path list and specifies no path list — **REPRODUCED [R]**

`§11.1` is invoked normatively at `50:92` ("+ the §11.1 path list"), `50:351` ("G4 at **26** documents with the §11.1 path list") and `50:546` (Phase 1's PR "owns … the expected-path list"). I searched the whole phase file: the string appears only in those three places and is **never defined**; no path list exists anywhere in the dossier.

Phase 00's G4 body is count-only — `if(n!==104){…process.exit(1)}` — so the exit gate at `50:351` demands something the work order at `50:161` forbids inventing. Confirmed.

I derived what such a list would contain from the stored export: the 26 survivors are `out/index.html`, `out/404.html`, `out/404/index.html`, `out/_not-found/index.html`, `out/entrar/{index,recuperar/index}.html`, `out/jogar/index.html`, `out/portal/{index,ajuda,sem-acesso,sessao-expirada}/index.html`, `out/portal/admin/equipe/index.html` + `admin/index.html` + three `organizacoes` pages, `out/portal/turmas/{index,…}`, and eight `resultados` pages. Freezing exactly these is the trustworthy form.

### B-04 — Phase 40 and Phase 50 schedule incompatible size gates and baselines — **REPRODUCED [R]**

I re-implemented the classifier from `50:228`'s stated rule (`.module.css`→CSS; `tests/**` or `*.test.ts(x)`→test; `src/components/**` or `src/app/**` **and** `.tsx`→component; else module; scope = `git ls-files` under `src/`,`tests/`,`scripts/` or `*.ts|mts|mjs`, minus `src/generated`) and reproduced the census **exactly**: **214 scoped files | 13 FAIL | 12 WARN**.

The 13 FAILs, with my own line counts: `portal.module.css` 4,910 · `access-link-service.test.ts` 1,625 · `game-offline-sync.ts` 1,222 · `adult-portal-demo-store.ts` 1,024 · `public.module.css` 1,017 · `game-host.tsx` 932 · `access-link-service.ts` 717 · `marketing.module.css` 688 · `adult-portal/service.ts` 616 · `player-access-workflow.tsx` 540 · `portal-view-service.ts` 521 · `atividades/actions.ts` 517 · `team-screen.tsx` 411.

**The two vocabularies are disjoint.** Phase 40 references `scripts/css-selector-integrity.mjs` and `scripts/size-ratchet.mjs` and owns `--self-test`; Phase 50 references `scripts/check-css-selectors.mjs` and `scripts/check-size-budget.mjs` and owns `.size-baseline.json`. Neither phase mentions the other's filenames, and `--self-test` appears **only** in Phase 40. These are not two implementations of one tree — they are two independent gates that will both be installed, with no statement of which is authoritative.

**A correction to the primary's characterisation.** The primary says the 13-entry baseline "includes four Generation-A files Phase 10 deletes". Testing each of the 13 against Phase 10 for an explicit delete verb rather than a bare mention, **four are named for deletion by *Phase 20***: `access-link-service.test.ts`, `access-link-service.ts`, `portal-view-service.ts`, `atividades/actions.ts` (Phase 20 drops the Generation-A service layer and its tests). The arithmetic `13 − 4 = 9` is correct, but the primary attributes the subtraction to the wrong phase. That strengthens B-04: the baseline crosses **two** phase boundaries, so neither Phase 40's nor Phase 50's landing baseline can be established at the moment either phase lands.

### B-05 — G7's "baseline 5" is pre-purge and cannot be its landing baseline — **REPRODUCED [R]**

I rebuilt the usage→definition oracle from `50:204-207` (for each `import X from "…*.module.css"`, every `X.<ident>` must appear as a class selector in that file) and reproduced:

```text
module-imports 50 | violations 5
  materials-explorer.tsx:105    portal.module.css#materialAudience
  portal-navigation.tsx:37      portal.module.css#mobileNavItem
  player-entry-screen.tsx:143   public.module.css#entryProblem
  player-entry-screen.tsx:162   public.module.css#entryProblem
  player-entry-screen.tsx:181   public.module.css#entryProblem
```

`materials-explorer.tsx:105` is literally `<span className={styles.materialAudience}>`, and `materials-explorer.tsx` is in Phase 10's table B, so the class dies with the file. **Residual = 4**, while `50:95` and the exit gate `50:372` both hard-code `violations 5 (baseline 5)`.

**One figure differs, and the primary is right to be suspicious here.** I counted **456** `styles.<ident>` usages; `50:190` and the primary both say **670**. My oracle matches Phase 50's violation *count* and *sites* exactly, so the divergence is in what the 670 counts — most plausibly Phase 50's prototype also counts identifiers reached through destructured or aliased CSS-module bindings my `local.<ident>` regex does not match. I report 456 as *my* measurement and mark the 670 **[X]**: the five violations reproduce, the usage denominator does not, and neither figure changes the finding. Phase 50 must state the counting rule that yields 670, because that rule becomes the gate's baseline.

### B-06 — G12 is a lexical substring gate, not a CI-leg enforcement gate — **REPRODUCED, and worse than reported [R]+[N]**

I ran the exact body from `50:249-257` against eleven synthetic workflows. The primary reported two false passes; I found **four**:

| # | Synthetic workflow | G12 verdict | Should be |
| :--- | :--- | :--- | :--- |
| 1 | the real proposed `ci.yml` | PASS | PASS |
| 2 | comment-only impostor | FAIL | FAIL |
| 3 | one real leg + three `echo npm run …` | **PASS** | FAIL |
| 4 | **all four legs only `echo`ed** | **PASS** | FAIL |
| 5 | `pages: write` regression | FAIL | FAIL |
| 6 | a `run: \|` block naming the legs | FAIL | FAIL |
| 7 | bare `npm lint` / `npm typecheck` spelling | PASS | PASS |
| 8 | **`run: npm run <leg> \|\| true`** | **PASS** | FAIL |
| 9 | **all four legs with `continue-on-error: true`** | **PASS** | FAIL |
| 10 | legs named only in a `name:` label | FAIL | FAIL |
| 11 | file absent | FAIL | FAIL |

Cases 3–4 are the primary's finding. **Cases 8 and 9 are new [N]** and are the more dangerous half: G12 certifies a workflow whose four legs execute but whose **failures are discarded** — `|| true` and `continue-on-error` both make a red gate green while every `run:` line still matches the anchored regex. A gate that cannot see a suppressed failure is worse than one that sees no gate, because it converts a red build into a green one. Case 9 is invisible to *any* line-anchored `grep`.

Case 6 also *fails for the wrong reason*: the regex is anchored to `^[[:space:]]*run:`, so a legitimate multi-line `run: |` block — the idiomatic way to write a multi-command step — is reported as a **missing leg**. The gate is simultaneously too permissive and too brittle.

### B-07 — Branch protection is absent, and the proposed PUT does not guarantee direct-push rejection — **REPRODUCED [R]**

```text
gh auth status                  → account niciniV (owner), scopes repo, workflow
gh workflow list                → "Deploy to GitHub Pages  active  344718143"   (one workflow)
gh api …/branches/main/protection            → HTTP 404: Branch not protected
gh api …/branches/main/protection/required_status_checks → HTTP 404 (same)
gh api repos/niciniV/SMS_Portal/rulesets     → (no rulesets)
```

`gh run list` shows the latest run `35918529713`, `success`, `push`, head `e5aaf1e…`. `gh run view --json jobs` confirms the primary's characterisation exactly: the `build` job's steps are *Set up job → Checkout repository → Setup Node.js → Install dependencies → Build static export → Upload Pages artifact → Post … → Complete job* — **no lint, typecheck, test, format or assertion step** — and the `deploy` job is a bare `Deploy to GitHub Pages`.

`deploy.yml` line-by-line, as cited by Phase 50: triggers `:3-6` (`push` branches `["main"]` + `workflow_dispatch`, **no `pull_request`**), `permissions :8-11` (`pages: write`, `id-token: write`), `concurrency :13-15` (`cancel-in-progress: false`), `npm ci :31`, `build:demo :34`, `upload-pages-artifact@v3 :36-39`, `deploy-pages@v4 :50`. `grep -c "run:"` → **2**, matching `50:266`. Release confidence is presently zero; the primary is right.

**Phase 00's proposed PUT omits admin enforcement.** I searched `phases/00-prerequisites.md`: `enforce_admins` appears **nowhere**; `restrictions` appears **nowhere**. `00:295` names only `required_status_checks.checks: [{context: "gates"}]`, `strict: true`, and `required_approving_review_count: 1`. Since the acting identity is the repository **owner**, GitHub's default behaviour — branch restrictions do not apply to admins/bypass roles unless "Do not allow bypassing" is enabled — means `00:314`'s promised "a direct `git push origin main` is rejected" is **not guaranteed**. Confirmed.

## Majors and minors — replayed

### M-01 — G4/G5 detect cardinality but accept compensating artifacts — **REPRODUCED [R]**

Running the two proposed bodies against synthetic trees:

```text
G4  25 index.html + 404.html (=26)          → exit 0   (baseline green)
G4  p7 DELETED + surprise-page ADDED        → exit 0   ← false pass, count preserved
G4  2 expected LOST + 2 bogus ADDED         → exit 0   ← false pass
G4  one expected page simply GONE           → exit 1   (red: correct)

G5  exactly the 4 required route keys       → exit 0
G5  4 required + 1 EXTRA route              → exit 0   ← extra route accepted
G5  16 action ids                           → exit 1   (red: correct)
G5  16 real + 1 WRONG 17th                  → exit 0   ← false pass, no identity check
```

All six of the primary's rows reproduce exactly. The rows at `50:92-93` claim to catch "a route silently vanishing, an accidental new prerendered page, or a server action being stripped" — a compensating replacement defeats all three, so the rows must either assert identity or stop claiming it. Keep the count as a diagnostic only.

### M-02 — `scripts/start.mjs` builds before it validates arguments — **REPRODUCED [R] (statically)**

`start.mjs:29` is `const buildStatus = run(npmCommand, ["run", "build"]);`; the argument loop begins at `:51` (`const args = process.argv.slice(2)`) and the unknown-flag branch at `:62` prints `Argumento não reconhecido:` and `process.exit(1)`. The build strictly precedes validation, and `npm run build` is `build:server` (`package.json:13`) — a full production build.

The missing-value semantics are worse than "silently defaults". `runtimeEnv.PORT = args[index + 1]` with no value check assigns the **string** `"undefined"`; `runtimeEnv.PORT ??= "3000"` at `:67` then **does not fire**, because `"undefined"` is not nullish. Reproduced: the default only applies when the variable is genuinely `undefined`, whereas the flag-with-no-value path leaves `PORT="undefined"` for the child process. I did **not** re-run the build-then-fail path (it would mutate `.next`); the ordering is conclusive from source.

### M-03 — The Docker deployment path is born red — **REPRODUCED [R] static, [X] log**

`Dockerfile:13` is `RUN npm run build`, which is `build:server`; `next.config.ts:6-19` Zod-parses `APP_RUNTIME_MODE` unconditionally and then, under `server`, requires `DATABASE_URL` (`.url()`), `NEON_AUTH_BASE_URL` (`.url()`), `NEON_AUTH_COOKIE_SECRET` (`.min(32)`), `APPLICATION_SECRET` (`.min(32)`). The Dockerfile declares **no `ARG` and no `ENV`** for any of the four, and `.dockerignore` excludes `.env*` (with `!.env.example`), so no value can reach the build. The prior audit's stored `docker-build.log` records the same failure at the same layer:

```text
Dockerfile:13  >>> RUN npm run build
#13 3.134 Error [ZodError]: [ "DATABASE_URL" … ]
ERROR: failed to build: … did not complete successfully: exit code: 1
```

This is deterministic, not a flake, and Phase 50 — which discusses CI, both build targets and runtime — never inventories or corrects the Dockerfile, while README does not disclose that a direct Docker build needs build-time env injection.

### M-04 — `implementation_plan.md` remains operational and false — **REPRODUCED [R]**

`implementation_plan.md:69` instructs `2. Executar \`npm run build\` para validar a exportação estática na pasta \`out/\`.` — but `npm run build` is `build:server` (`package.json:13`), which needs secrets and writes `.next/standalone`, not `out/`; the correct command is `npm run build:demo`. `:3` still calls the project a "**mock 100% visual e estático** … desvinculando todas as dependências de backend", and `:28-29` still instructs removing `src/app/health/` and `src/proxy.ts`. The file has **no** superseded/historical banner. Confirmed that Phase 50 neither schedules it (`indexOf("implementation_plan")` → −1) nor lists it under *Do not touch* — so it is simply unowned. `docs/demo-visual-plan.md:326` carries the same stale `npm run build`.

### m-01 — The informational reporter assumes every action id is in `m.node` — **REPRODUCED [R]**

Placing a single action id in `m.edge` instead of `m.node` and running the `00:229` body:

```text
TypeError: Cannot read properties of undefined (reading 'filename')
    at [eval]:1:285  (a.map(i=>m.node[i].filename))
```

The step is not a gate, but a diagnostic that throws is worse than one that prints: it turns "report the count" into a red step for an unrelated reason. Resolve `m.node[id] ?? m.edge[id]` and print an explicit unknown-id diagnostic.

### m-02 — Phase 50 cites a nonexistent `docs/walkthrough.md` — **REPRODUCED [R]**

`docs/walkthrough.md` does not exist; the root `walkthrough.md` does. Phase 50 names the nonexistent form at `50:338` (`… **not** \`docs/walkthrough.md\` …`) while correctly using the root form elsewhere. Minor, but it is the kind of error that breaks an exact-path audit.

## New defects — not in the primary

### N-01 [BLOCKER] — Phase 50 step 2 orders an edit to text that does not exist, and its own verify bullet is a no-op

`50:161` defines this phase's `ci.yml` diff as "**two edits and no insertions**": (i) delete the `out/api` informational echo, and (ii) "turn G3's `process.exit(1)` into an `echo`, editing the body at `phases/00-prerequisites.md:142`".

I checked Phase 00's fence. Its G3 body is:

```js
console.log("demo server-action ids: "+a.length+(a.length?" (E625-risk: "+a.map(i=>m.node[i].filename).join(", ")+")":""))
```

There is **no `process.exit`** in it. The only `process.exit` anywhere in the proposal is in **G4's** census body. Phase 00's own verification at `00:254` even publishes the confirming metric — `e625WithExit=0` — and `00:283` / `00:334` state the gate "has been demoted to an `echo`" and is "**retired as unfalsifiable**". So Phase 50 step 2(ii) is a **phantom edit**: the implementer is told to modify a `process.exit(1)` that Phase 00 already deleted.

Its companion verify, `50:164` (`grep -n "E625-risk" ci.yml | grep -c "process.exit"` → `0`), passes on the file exactly as Phase 00 wrote it, so the step "verifies" without having changed anything. Worse, the cited location `phases/00-prerequisites.md:142` is **not the G3 body at all** — it is a comment line about the Prisma shadow-URL trap (`# key, and this workflow configures neither …`). **The cited line number is wrong as well as the premise.**

**Required correction.** Restate step 2 as the single real edit it is (delete the `out/api` echo), and either drop the G3 sub-step or re-point it at text that exists, with a verify that fails before the change and passes after it.

### N-02 [BLOCKER] — Phase 50's exit gate contradicts Phase 00's shipped `ci.yml`, and no phase owns the reconciling edit

`50:355` requires `test -f .github/workflows/ci.yml && ! grep -q "out/api" .github/workflows/ci.yml` → exit 0. Phase 00's proposal contains `out/api` on line 102 (the "Note the dropped route handlers" echo). I replayed the **full cross-phase contract** against the extracted fence:

| Contract (source) | Result on Phase 00's proposal |
| :--- | :--- |
| `phases/20` step 9 — no `migrate diff` / `shadowDatabaseUrl` / `SHADOW_DATABASE_URL` / `services:` | **holds** |
| `phases/20` step 9 — `prisma validate` count == 1 | **holds** (count 1) |
| `phases/50` — no `process.exit` on the `E625-risk` line | **holds** |
| `phases/50` — no drift term on any `run:` line | **holds** |
| `phases/50` — no `services:` mapping key | **holds** |
| `phases/50` — `prisma validate` on a `run:` line == 1 | **holds** |
| `phases/50` — `expected 17` on 1 line | **holds** (count 1) |
| `phases/00` — four `check` legs on `run:` lines | **holds** |
| **`phases/50:355` — `out/api` must be absent** | **FAILS** (present on line 102) |
| **`phases/50` exit — G4 must assert `26`** | **FAILS** (asserts `104`) |

The first failure is N-01 seen from the other side: `out/api` disappears only if someone performs a real deletion, and the only phase claiming that deletion is the one whose step 2 is mis-specified. The second is the `104 → 26` edit, which `50:161` and `50:546-551` both acknowledge is **not** in Phase 10's numbered work order and is double-booked to Phase 1 and Phase 1b. With branch protection on `gates` (Phase 00 step 7, `strict: true`), the purge PR is unmergeable until an unowned one-line edit lands — exactly the condition `00:296` says must be closed *before* protection is enabled, and which no phase's work order closes.

### N-03 [MAJOR] — G7 and G8 are exit-gated but have no CI step, contradicting the phase's stated goal

Phase 50's goal (`50:3-6`) is "turning the plan's §7 success criteria into assertions that can actually go red". Yet I enumerated every `run:` line in the proposed workflow: the only non-`node -e` steps are `npm ci`, `npm run format:check`, `npm run lint`, `prisma validate`, `npm run build:server`, `npx tsc …`, `npm test`, `npx vitest run --no-isolate --fileParallelism=false`, `npm run build:demo`, and two `node -e` manifest/census reads. **No step runs `check-css-selectors.mjs` or `check-size-budget.mjs`.**

Both gates appear only in prose *Verify:* lines (`50:221`, `50:229`) and exit-gate checkboxes (`50:372`, `50:375`). They are therefore **checklist items, not gates** — the identical defect species the phase was created to eliminate. Its own G2 row (`50:90`) calls a vacuous assertion "NO — vacuous"; the G3 row calls a born-green assertion "It is *born green*, the exact failure this phase exists to delete". G7 and G8 are born *absent*: they can never go red in CI, and nothing in the phase notices.

This compounds B-04: the size control is to be delivered twice, by two phases, under two filenames, and — on the shipped workflow — by neither.

**Required correction.** Add explicit `- run: node scripts/check-css-selectors.mjs` and `- run: node scripts/check-size-budget.mjs --baseline .size-baseline.json` steps, and make G12 assert their presence so the omission cannot recur.

### N-04 [MAJOR] — The pinned dependency set carries a critical unauthenticated-RCE advisory

`npm audit --omit=dev` on the pinned production set at `e5aaf1e` reports **7 vulnerabilities (1 moderate, 5 high, 1 critical)**, including a **critical** advisory against the exact framework version this refactor is built on:

```text
next  16.0.0 - 16.3.2
Severity: critical
Next.js: Unauthenticated Remote Code Execution on windows-hosted servers — GHSA-p293-qw3h-jr36
Next.js: Unauthenticated Remote Code Execution in Image Optimization API when AVIF files are used — GHSA-2xp9-vwfh-vxw4
fix available via `npm audit fix --force`   → will install next@16.3.6, outside the stated dependency range
```

Also high: `sharp <0.35.4` (libheif), `mysql2 <=3.23.0` (two advisories), and `deepmerge-ts` / `@prisma/config` (via `prisma`). The demo target sets `images: { unoptimized: true }` (`next.config.ts:30`), which blunts the Image Optimization RCE specifically, and the deployment target is Linux — but the affected range `16.0.0 - 16.3.2` covers the shipped `16.3.2`. The primary audits formatting, gates and deploy wiring and **never runs `npm audit`**, so this is entirely unreported; `00:324` freezes `engines.node` and the phase interfaces freeze the dependency set, and nothing in the dossier addresses an advisory against that frozen set.

**Required correction.** Record the audit result as a measured baseline, decide the `next@16.3.6` upgrade explicitly (it is outside the pinned range and therefore a COMPAT decision, not a patch), and add a dependency-audit leg or a dated, explicit acceptance — otherwise "CI green" certifies a build on a known-vulnerable runtime.

### N-05 [MAJOR] — Even with perfect branch protection, an unchecked push or a manual dispatch still deploys

Phase 50 puts Pages behind CI by assumption and explicitly declines the alternative: `50:148-149` — "`deploy.yml` stays as-is — moving Pages behind `needs: gates` needs `gh api` settings or a workflow redesign (**repo owner**)".

Two independent paths therefore publish unverified code, and protection closes neither:

1. `deploy.yml` triggers on `push: branches: ["main"]` (`deploy.yml:4-5`) with **no `pull_request` trigger and no `needs:`**. A `workflow_dispatch` (`:6`, and this repo has used it — run `33185036331`) deploys whatever is on `main` with no CI at all.
2. The acting identity is the repository **owner**, and `00:295`'s PUT omits `enforce_admins` and any push restriction (verified: neither string occurs anywhere in `phases/00-prerequisites.md`). Owner pushes bypass required checks by default.

Phase 50's *Accepted breakage* list records neither path, and the primary's required-correction item 7 lists admin enforcement as a repository-settings task rather than as a gate this phase fails. **Record both as accepted breakage, or close them.**

### N-06 [MINOR] — The proposal uploads a `demo-export` artifact nothing consumes, duplicating Pages' own artifact

The proposal's final step is `uses: actions/upload-artifact@v4` with `name: demo-export`, `path: out`, `retention-days: 7`. `deploy.yml:36-39` separately uploads the same `./out` via `actions/upload-pages-artifact@v3` on every push to `main`. On a push, `ci.yml` and `deploy.yml` run concurrently and both archive `out/`. One is redundant; neither Phase 00 nor Phase 50 names which is authoritative, and no consumer or retention rationale is documented. The proposal's three `uses:` are `checkout@v4`, `setup-node@v4`, `upload-artifact@v4` — no option mismatch found, but the duplication is an unowned cost: a second 554-file export archived per push, and a second surface to reason about when Pages fails.

### N-07 [MINOR] — The G4 count assertion and its `// PHASE-1: 26` comment have three owners and no landing commit

`50:167-169` notices this in passing ("three owners of one comment line; say in the PR which of the three lands it") but leaves it unresolved, while `50:161` and `50:546-551` simultaneously record two *different* owners for the `104 → 26` edit itself (Phase 10's PR vs. Phase 1b's "follow-through"). The proposal's G4 line is:

```js
if(n!==104){console.error("export docs "+n+", expected 104");process.exit(1)}  // PHASE-1: 26
```

The literal `104` appears **twice** on the line and `26` only inside a comment, so an implementer performing a naive search-and-replace updates the comment and leaves both assertions intact — the exact silent no-op that would leave `main` red. Make the landing step rewrite the whole line, and name the commit.

| `phases/50` — `expected 17` on 1 line | **holds** (count 1) |
| `phases/00` — four `check` legs on `run:` lines | **holds** |

**Required correction.** Assign the `out/api` deletion and the `104 → 26` edit to one numbered step in one phase's work order (Phase 10 is the only commit where the number changes), and make Phase 50's exit bullets state which phase must have merged first.

## Corrections to the primary

1. **B-01 baseline qualification.** "The repository baseline is also red on only `REFACTOR_PLAN.md`" is true of the 343 tracked files and false of the working directory, which `prettier --check .` also walks: **5** offenders, four of them untracked, non-ignored audit debris. State the scope with the number.
2. **B-04 attribution.** The four files subtracted from the 13-entry baseline are deleted by **Phase 20**, not Phase 10. The `13 − 4 = 9` arithmetic is right; the phase that performs the subtraction is not the one named.
3. **B-05 denominator.** The violation set (5, at the exact five lines) reproduces; the **usage count does not** — I measure **456**, the phase file and the primary both say **670**. Phase 50 must state the counting rule that yields 670 before it becomes a baseline.
4. **B-06 understated.** Two false passes are reported; **four** reproduce, and the two additional ones (`|| true`, `continue-on-error`) are the severe class because they convert a failing gate into a passing one.

## Gate-by-gate disposition — my independent reading

| Gate | My measurement | Can it fail? | Disposition |
| :--- | :--- | :--- | :--- |
| G1 format | tracked: 1 offender; proposal: **exit 1**; workdir: 5 | Yes | Useful; the proposed file is born red (B-01) |
| G2 `out/api` | absent in both exports; 4 tracked `route.ts`; `git ls-files src/app/health` → 0 | **No — vacuous** | Keep retired; `output: "export"` drops route handlers |
| G3 demo actions | stored demo manifest **0 node / 0 edge / 0 actions**; `next/dist/export/index.js:375-385` throws `E625` first | **No — born green** | Keep as informational `echo`; the real gate is `build:demo`'s exit |
| G4 documents | 554 files / 104 html / 103 index / 1 404 / 78 purged / **26 survivors** / 52 under `out/atividade` | Yes for count, no for identity | B-03, M-01, N-02, N-07 |
| G5 server registry | 44 route keys, 4/4 required present, exactly 4 `/api/*` | Yes for missing/count, no for identity | Strengthen to exact sets (M-01) |
| G7 usage→definition | **50 imports, 5 violations, exact sites**; residual 4 | Yes in principle | B-05; and **no CI leg** (N-03) |
| G8 size | **214 scoped / 13 FAIL / 12 WARN**, exact list | Yes in principle | B-04; and **no CI leg** (N-03) |
| G9 order independence | parallel **33/284**; serial **1 failed / 32 passed, 282** (`portal-dev-bypass.test.ts`, `ZodError` on `APP_RUNTIME_MODE`) | Yes | Valid; needs Phase 00 item 0.2 |
| G10 Prisma | not executable here (host Node 22 vs pinned 24) | Yes for schema syntax only | Correctly does not claim drift coverage |
| G11 docs | **exit 1, "G11: 19 stale-doc lines remain"**; per-file 1/3/15; per-pattern 2/2/5/4/4/2; reaches exit 0 once every offending line carries `compat-note` | Yes | Falsifiable and convention-based; keep |
| G12 CI | 4 false passes out of 11 synthetic workflows | **Yes, but not the right yes** | B-06, N-03 |

**G11 detail.** The exact proposed Bash body from `50:320-327` prints `G11: 19 stale-doc lines remain` and exits 1, matching Phase 50's prediction digit for digit. Per file: `README.md` 1, `docs/current-architecture.md` 3, `docs/schemas/database-model.md` 15. Per pattern: `health/` 2, `/atividade/[token]` 2, `access_links` 5, `capability_assignments` 4, `rate_limit_buckets` 4, `audit_events` 2. Appending `<!-- compat-note -->` to each of the 19 lines in a scratch copy drives the body to **exit 0**, so the gate is reachable in both directions. The `walkthrough.md` companion claims also hold: `grep -c atividade walkthrough.md` → **11**, and the `Interatividade` substring is at `:28` exactly as `50:338` says.

**G9 detail.** The serial failure is a genuine environment leak, and I confirmed the mechanism Phase 50 names: `tests/unit/auth.test.ts:163` runs an unconditional `delete process.env.APP_RUNTIME_MODE` inside the `afterEach` at `:161-165`, undoing `vitest.config.mts:13-15`. `tests/unit/portal-dev-bypass-actions.test.ts:46,55` saves and restores the variable correctly, so it is **not** a second deleter — Phase 50's decision to name `auth.test.ts:163` alone is right. Note also that `vitest run --no-isolate` **alone** passes (33/284), so the leak needs `--fileParallelism=false` to surface; both flags are correctly present in the proposal, and Vitest 4.1.11 accepts both (verified in its `--help`).

## Tests and fixtures

| Claim | My result | Verdict |
| :--- | :--- | :--- |
| 33 `*.test.ts` files, 0 `.tsx` | 33 / 0 | **[R]** |
| 284 runtime tests | 33 files / 284 passed (parallel) | **[R]** |
| 229 literal `it`/`test` sites, 5 `it.each` | 231 matching sites, 5 `it.each` | **[P]** — my pattern also matches `it(` inside strings/comments; immaterial |
| no `.skip` / `.todo` / `.only` | 0 | **[R]** |
| 20 valid + 12 invalid V1 fixtures | 20 + 12 under `contracts/fixtures/v1/`, plus 22 v1 schemas | **[R]** |
| no Playwright / jsdom / Testing Library | all three absent from `node_modules` | **[R]** |
| 0 test files read `.next/` or `out/` | 0 | **[R]** — confirms the test legs are independent of both builds |

The suite is substantive at the service/contract layer and is not UI/E2E. Contract coverage is real and not overstated: `tests/unit/v1-contracts.test.ts` (12.7 KB) loads the 32 fixtures and the v1 JSON schemas directly by path (`:31`, `:35`) and drives them through a named schema table (`:103-106`), and `package.json:22` exposes `test:contracts`. It is appropriate that Phase 50 keeps R-01/R-10/R-11/R-13/R-14/R-17/R-18 manual: `vitest.config.mts` is Node-only and `game-offline-sync.test.ts` supplies an in-memory persistence double rather than executing the real IndexedDB class.

## Documentation audit — claims confirmed

Every documentation defect the primary lists is present and correctly characterised:

| Claim | My result | Verdict |
| :--- | :--- | :--- |
| `README.md:53` advertises `health/` handlers that never existed | present; `git ls-files src/app/health` → **0** | **[R]** |
| `README.md:62` "anonymous session-link" characterisation | present | **[R]** |
| `docs/current-architecture.md:175-178` legacy `/atividade/[token]` + `/health/*` rows | present | **[R]** |
| `docs/schemas/database-model.md` documents all four dropped tables | 15 of G11's 19 offending lines live here | **[R]** |
| `walkthrough.md:66-67` claims 126 tests / 99 pages | present; measured **284 tests / 104 html → 26 post-purge** | **[R]** |
| `walkthrough.md:11` links the live legacy route | present; that URL returns **200 live** | **[R]** |
| `docs/implementation/slice-03-05-portal-handoff.md:26` "276 tests" | present; measured 284 | **[R]** |
| `docs/demo-visual-plan.md:326` stale `npm run build` | present | **[R]** |
| `REFACTOR-DOSSIER.md` "104 committed documents" / "oracle green today" | see note below | **[P]** |

**Note on the dossier row — a small correction to the primary.** The primary says `REFACTOR-DOSSIER.md` "still says '104 committed documents' and 'oracle green today' in places". The committed-documents wording is **not** in the file at `e5aaf1e`: `REFACTOR-DOSSIER.md:54` already reads "*from **104 in the current local export**, −78 purged). The 104 are **not** …*". What remains are the `104 → 26` purge instructions at `:199`, `:202`, `:528` and the dependency chain at `:564`. Phase 50's `50:542` therefore schedules a correction for a sentence that has already been corrected, and does not schedule the four that are actually stale. This is a bookkeeping defect in the correction table; the substantive risk (the `104 → 26` ownership vacuum) is already captured by B-03 / N-02.

**Claims I endorse, which the primary also endorses:** README correctly separates `build:demo` from `build:server` and states the demo is not production proof; `npm run dev` does load `.env.local` (`scripts/next-target.mjs:24` calls `loadEnvConfig(projectRoot, true)`); the root redirect composes `/SMS_Portal/` from `APP_BASE_PATH`; `docs/current-architecture.md`'s unverified-acceptance section is appropriately cautious; and both `walkthrough.md` and `implementation_plan.md` lack any superseded banner while presenting themselves as current.

## Workflow and live-deployment facts

- `.node-version`, `.nvmrc` and `engines.node` all read `24.19.0`; all three are tracked. The proposal's `node-version-file: .node-version` and `deploy.yml`'s literal `node-version: "24.19.0"` are consistent.
- The proposal parses as `name=CI`, `on=pull_request,push,workflow_dispatch`, `permissions={"contents":"read"}`, job `gates`, `runs-on=ubuntu-latest`, **17 steps / 3 `uses` / 14 `run`** — matching `00:126-127`. Its failure is formatting, not YAML.
- `build:demo` is the last writer of `.next`, and every manifest read sits immediately after the build that produced it. The proposal's ordering is correct: server build → route/action reads → typecheck → test → serial test → demo build → demo reads → census. The primary's accepted strength 3 is upheld, and I confirmed no test file reads `.next/` or `out/`, so the test legs are provably order-independent of both builds.
- Live replay: `/SMS_Portal/` **200**; `/SMS_Portal/atividade/7FQ-29M/` **200** (the legacy route Phase 10 deletes is still published); an unknown route **404**. The primary's R-04 reading is correct.
- The primary's correction of Phase 50's "queues a red artifact" wording is right and I endorse it: `cancel-in-progress: false` retains one running and one pending job, with a newer pending job replacing an older pending one — not an unbounded FIFO. The real exposure is the absent CI dependency, not the concurrency setting.

## Accepted strengths — my independent endorsement

1. Retiring G2 and demoting G3 is correct and well evidenced; both are structurally unfailable under `output: "export"`.
2. Separating the two builds in time because both write `.next` is load-bearing and correctly ordered in the proposal.
3. Reading each manifest immediately after its owning build, and carrying the T1–T4 traps inside `ci.yml` where CI is where they bite.
4. Keeping G9 while **comparing** rather than hard-coding a total across refactor phases — the best-designed gate in the file, and the only one whose contract survives the purge.
5. Keeping G10 as `prisma validate` only, with the drift gap stated as a decided, unowned gap rather than papered over.
6. Keeping the real UI, print, IndexedDB, GameMaker and tablet checks manual until a browser harness exists.
7. Keeping the docs-truth boundary between seeded-route demo behaviour and production/server acceptance.
8. The §11.1 register's refusal to let a G7 landing justify deferring D-3 — correctly reasoned on the print-block orphan gap.

## Required correction order

1. **Phase 00:** prettier-format the proposed `ci.yml` before committing; make parse + `prettier --check` + content hash part of extraction verification (B-01).
2. **Phase 50 step 2:** fix the phantom G3 edit and the wrong line citation (N-01).
3. **Phases 10/50:** give the `out/api` deletion and the `104 → 26` edit one numbered owner in one work order, and reconcile the exit gate (N-02, N-07).
4. **Phase 50:** add CI steps for G7 and G8, and make G12 assert their presence (N-03).
5. **Phase 00/50:** decide the `next@16.3.6` upgrade explicitly and add an audit leg or a dated acceptance (N-04).
6. **Phase 00/50:** settle G6 with an explicit success wrapper; record the internal inconsistency with Phase 50's own grep-discipline rule (B-02).
7. **Phase 00/50:** replace G12 with parsed/executed enforcement; at minimum reject `|| true` and `continue-on-error` (B-06).
8. **Phases 40/50:** select one size/selector implementation and one post-purge baseline; require the Phase-40 self-tests (B-04).
9. **Phase 10/50:** reissue G7's residual baseline as 4 with the exact tuple, and state the usage-counting rule behind the 670 figure (B-05).
10. **Repository settings:** protection with admin enforcement and push restrictions; record or close the dispatch and owner-push deploy paths (B-07, N-05).
11. **Phase 00/50:** strengthen G4/G5 to exact sets; define the 26-path set or drop the path-list requirement (M-01, B-03).
12. **Phase 50/docs:** schedule `implementation_plan.md`, `demo-visual-plan.md`, the handoff test count, and the four genuinely-stale `REFACTOR-DOSSIER.md` rows; add Docker/start smoke gates (M-03, M-04).
13. **Final proof:** pinned fresh-clone `npm ci`, all four `check` legs, serial suite, server build + manifests, demo build + census, a real PR, a red-merge rejection, and a Pages deployment from the protected commit.

## Coverage limits and workspace integrity

- **No pinned-runtime build was run.** The host is Node 22.23.1 and `engines.node` is `24.19.0`. `build:server` and `build:demo` were not re-executed; the census, manifest and deploy figures are `[X]`-grade, corroborated against the prior audit's stored export (554 files / 104 html / 17 action ids on the server build) and the live service.
- **`prisma validate` was not executed** (same toolchain reason). G10's verdict rests on `next.config.ts`'s Zod branch and Phase 00's own recorded run.
- **No database, migration application, staging Neon, real GameMaker executable, tablet, or two-device session** was exercised. Those remain open acceptance work, not gate passes.
- **No browser automation.** LocalStorage interaction, DOM `undefined`-class rendering, print output, cross-tab updates, IndexedDB and responsive UI were inspected in source, tests and artifacts but not clicked end to end.
- **No remote mutation.** `gh` was used read-only (`auth status`, `workflow list`, `run list`, `run view`, `api …/protection`, `api …/rulesets`). No protection, ruleset, workflow, dispatch or push was created or changed. The three negative tests B-07 asks for (`--auto` on a red PR, direct push, admin push) were therefore **not** performed and remain `[U]`.
- **`actions/setup-node@v4` supporting `node-version-file`** is asserted by the primary and is consistent with the shipped `deploy.yml`; I could not execute the action offline.
- **The proposed `ci.yml` and the G6–G8 scripts do not exist at `e5aaf1e`**, so their behaviour was established by parsing and by isolated replay of their exact bodies, not by executing the final artifacts.
- **One correction to my own process, recorded for honesty.** My first test run reported 15 failed files / 140 tests. That was my scratch tree missing the gitignored `src/generated` Prisma client — not a repository defect. After copying it in, the run reproduced the claimed 33/284 and 282/284 exactly. The erroneous run is reported rather than discarded, because the same trap would silently corrupt any verifier who builds a scratch tree from `git archive` without restoring `postinstall` output.
- **Line-ending hazard, newly characterised.** This host has `core.autocrlf=true`. `git archive` therefore emits **CRLF** copies of files whose git blobs are pure LF (`next.config.ts`: blob `lf=84 crlf=0`, archive copy `lf=84 crlf=84`). Prettier 3.9.6 flags a CRLF file (verified A/B: LF copy exit 0, CRLF copy exit 1), so a `git archive`-based scratch tree makes `format:check` red on **224** files instead of 1. This does not affect `ubuntu-latest` CI, which checks out LF blobs, but it means any **local** Windows `npm run check` on this repository is red for reasons unrelated to code — a second reason an audit's scratch must be built from blobs, not archives, and a caveat worth recording against Phase 50's Bash-only disclaimer.
- **Workspace integrity.** `git status --porcelain` lists only `docs/refactor-dossier/` and `docs/refactor-dossier-audit-2026-09-25/`, both already untracked at session start. `git diff --stat` is empty. This session performed **no build**, so `.next/` and `out/` are untouched by me. The only file this verification added is this report, which replaced a stale draft occupying the same path.
