# RV-10 — Refutation of `phases/10-purge-generation-a.md`

Attacked: `docs/refactor-dossier/phases/10-purge-generation-a.md` (295 lines), the Phase-10 Generation-A
deletion work order. Re-measured first-hand at `e5aaf1e` on `main` (`git rev-parse --short HEAD` → `e5aaf1e`,
`git status --porcelain` → `?? docs/refactor-dossier/` only — unchanged when I finished).
**The purge was executed, in full, in a scratch copy outside the repo**: `robocopy /E /MT:24` to
`C:\Users\Vitor\scratch\rv10` (53,139 `node_modules` files copied, not linked; `.next`/`out`/`.git` included),
where I ran `rm` of all 46 paths, `npm run build:server`, `npm run build:demo`, `npx tsc --noEmit
--incremental false`, `npm run lint`, `npm run format:check`, `npx vitest run` and every `**Verify:**` command.
Nothing in the repository was deleted, built in, or edited.

**Verdicts (46 rows): 34 PASS · 7 FAIL · 2 VACUOUS-GATE · 2 UNREPRODUCIBLE · 1 MISSING** — rows #5 and #7 carry
dual verdicts (the purge result passes, the gate that reports it fails), so 36 rows have a PASS component.

Headline: **the deletion set is closed and minimal — proven by execution, exactly as the file claims. Its
compile gate is not.** The purge really does collapse to one `TS2307` (`status-badge.tsx:1`), 27/182 tests,
26 exported documents and 0 demo action ids, every number reproducing to the unit. What does not survive is
step 3's `.next` remediation: it clears **one of the three** validator roots that `tsconfig.json:47,51,53`
feeds the program, so step 5's `tsc → exit 0` — the gate the whole phase rests on — **cannot pass on the tree
this file's own Entry gate describes**, and its "If it fails" branch sends the implementer into a loop that
never converges. Two further gates can never pass (`Links de acesso → 0`, `npx serve out` +
`Referrer-Policy: no-referrer`), and one is a false green.

## §1 The purge-closure experiment

**Method.** Copy → extract the 46 paths from the file's own tables A/B/C → `rm` them → run the project's real
checks in the prescribed order → read the diff.

```
A: 22  B: 18  C: 6  ALL: 46            git ls-files <46 paths> | wc -l  -> 46
A 1754 total | B 3458 total | C 2590 total | ALL 7802 total        (wc -l)
per-file check: 46/46 claimed counts exact, 0 MISMATCH, 0 MISSING   (claimed sum 7802)
git diff --shortstat  -> 47 files changed, 2 insertions(+), 7828 deletions(-)
files with 0 additions: 46   deleted lines in them: 7802
```

**(a) Orphans left behind — none.** Independent import-graph build over `src`+`tests`+`scripts`
(222 files, 669 edges, all 9 `@runtime/*` aliases plus `@/` resolved both directions):

```
(b) SURVIVORS WITH A DANGLING IMPORT INTO THE PURGE SET:
    src/components/portal/status-badge.tsx -> src/server/services/portal-view-service.ts
    total=1
(c) KEPT FILES WHOSE ONLY IMPORTERS ARE ALL PURGED:        (empty)
```

Zero new dead survivors: the purge strands **no** kept module. Route strings close the same way — the only
survivors mentioning a deleted path are `src/proxy.ts:113` (step 7) and `tests/unit/auth.test.ts:146,147,154`
(step 6), i.e. exactly the two the work order books.

**(b) Compile, as the file prescribes.** After `rm` of all 46 with **no** edits: `npx tsc` → exit 2,
**64 `TS2307`** = 21 (`.next/types`) + 21 (`.next/dev/types`) + 21 (`.next-demo-dev/dev/types`) +
**1 real error**:
`src/components/portal/status-badge.tsx(1,37): error TS2307: Cannot find module '@/server/services/portal-view-service'`.
So VER-A's headline is right *and* understated: on a tree that has `.next` the same procedure emits 64, not 1.

**Step 3 as written** (`rm -rf .next/types && npm run build:server`) → `npm run build:server` **exit 1**
("Running TypeScript … Failed to type check"). Then, with step 2 applied (the file's verbatim snippet):
`npx tsc` → exit 2, 46 error lines, **42 `TS2307` + 4 `TS2344`, 0 from `src/`** — the two untouched roots
still name all 21 deleted specifiers each. The `TS2344` (`Type '"/atividade/[token]"' is not assignable to
type 'LayoutRoutes'`) is a **second failure mode the file never mentions**: it is cross-contamination between
two generated `routes` modules, not a missing-module error, so it survives even a correct `TS2307` sweep.

**Corrected remediation, proven.** `rm -rf .next/types .next/dev .next-demo-dev && npm run build:server` →
build **exit 0**, then `npx tsc … --incremental false` → **exit 0**, 0 errors. `npm run lint` → **exit 0**.
`npx vitest run` → `Test Files 27 passed (27)`, `Tests 182 passed (182)`. `npm run build:demo` → exit 0,
`find out -name '*.html' | wc -l` → **26**, `out/atividade` **gone**, all four `test ! -e` paths gone, all six
`test -d` kept paths present, demo manifest **0** ids, server rebuild **17** ids. **The deletion set is
closed, minimal, and its post-state is exactly what the Exit gate describes — once the `.next` step is fixed.**

## §2 Claim table

| # | Claim (quoted) | Where used | Verdict | Evidence |
| :-- | :-- | :-- | :-- | :-- |
| 1 | "**46 files / 7,802 physical lines**", subtotals "1,754 / 3,458 / 2,590" | Goal; Totals; Entry gate | **PASS** | Re-extracted from the file's own tables and re-summed: 46 paths, `git ls-files` → 46, `wc -l` → 1754/3458/2590/7802. **All 46 per-file counts exact.** Directory census: `atividades/` 9 files/1188, `materiais/` 3/92, `modulos/` 2/23, `admin/{jogos,modulos}` 1/7 each, `admin/auditoria/` 1/**73**, `atividade/[token]/` 5/364 — no stray file (no per-route CSS, no `template.tsx`) is left behind in a deleted tree. |
| 2 | "29.3% of the handwritten TypeScript … 22.9% of the TS+CSS lines"; "20,096 + 6,579 = 26,675; +7,337 CSS = 34,012" | Goal; Totals; Evidence | **PASS** | `find src -name '*.ts*' -not -path 'src/generated/*'` → 20,096; `tests`+`scripts` → 6,579; sum 26,675. CSS 7,337 → 34,012. 7802/26675 = 29.25%, /34012 = 22.94%. `npx tsc --listFilesOnly \| wc -l` → **1,706** files. |
| 3 | "plan §2.2 (lines 37-43) … its own row claims 95"; "auditoria is **73** not 95" (Δ7) | Manifest; Scope | **PASS** | `REFACTOR_PLAN.md:37-43` are exactly the seven §2.2 rows; `:42` = `admin/auditoria/ \| 95`. Real file: 73 lines. Plan §2 spans `:25`–`:91` (§3 at `:92`), so "`:25-90`" is off by one line of blank. |
| 4 | "The plan's `~7,729` is short by exactly the 73-line auditoria page" (7,802 − 7,729 = 73) | Totals | **PASS** (value) / reasoning slipped | `REFACTOR_PLAN.md:90` "**~7,729 physical lines**"; 7,802 − 7,729 = 73 ✓. But the mechanism is different: the plan's own tables sum to **7,824** (1,776 + 3,458 + 2,590, auditoria at 95), so its stated total drops the auditoria row altogether (7,824 − 95 = 7,729) and the "exactly 73" is a coincidence of the real page being 73 lines. Say "the plan's total omits the auditoria row". |
| 5 | "deleted all 46 files with zero edits … exactly **one** TypeScript error, `src/components/portal/status-badge.tsx:1 TS2307`" | Goal; Evidence row 1 | **PASS** (in a `.next`-free tree) / **FAIL** as an unqualified claim | Executed: exactly one error from `src/` ✓. But the sentence carries no qualifier, and on this tree the same procedure yields **64** — see #6 and §4.1. The file's own Evidence row 3 admits the caveat; the Goal does not. |
| 6 | "`.next/types/` holds 4 `.ts` files and `.next/types/validator.ts` carries exactly **44** `typeof import(…)` references … of which **20** occurrences / **15** distinct specifiers name purge targets" | Step 3 | **FAIL** | 44 ✓ (and 44 unique — `sort -u` → 44). Purge-naming refs = **21**, in **each of 3** copies → 63. "4 `.ts` files" = 1 `.ts` + 3 `.d.ts`, and `typeof import` occurs only in `validator.ts` (0 in the other three). **20/15 is internally impossible**: all 44 lines are distinct, so a 20-occurrence subset has 20 distinct — see §4.2 for the mechanism. `ls .next/types` ✓ files live here, so the Entry-gate bullet is right. |
| 7 | "both counts depend on which build last owned `.next`" / "Gate on the regeneration, never on a count" | Step 3 | **PASS** (premise) / **VACUOUS-GATE** (its own probe) | Confirmed: `.next/types` after `build:server` → 23 refs, 0 purge-naming. The probe `grep -rho 'typeof import' .next/types` searches **one** of the three roots `tsconfig.json:47,51,53` includes, and asserted `→ 0`: it printed 0 while **42** stale refs remained and `tsc` was red. Measured at step 3's real position (routes still present) it returns **11** — see #8. |
| 8 | Step-3 "**Verify:** `rm -rf .next/types && npm run build:server >/dev/null` then `grep … ` → **0**"; "If it fails: … re-run `npm run build:server`" | Step 3 | **FAIL** | Unsatisfiable twice over. (i) At the point the work order runs it, the routes exist, so the probe returns **11** and the prescribed remedy ("re-run `build:server`") can never converge — the file tells the implementer to loop on a correct build. (ii) Post-deletion `rm -rf .next/types` leaves `.next/dev/types` and `.next-demo-dev/dev/types` untouched → `build:server` **exit 1**. Fix in §3.1. |
| 9 | Step-5 "**Verify:** `rm -rf .next/types && npm run build:server >/dev/null && npx tsc …` → exit **0**; `npm run lint` → exit 0; `npx vitest run` → 27/182" | Step 5 | **FAIL** — most damaging | Executed verbatim with step 2 applied: build **exit 1**, `tsc` **exit 2** (46 error lines, 0 from `src/`). With the corrected cleanup: build 0, **tsc 0**, lint 0, vitest **27/182**. `lint` and `vitest` reproduce; the compile gate does not. Fix in §3.1. |
| 10 | Step-4 "**Verify:** `npx vitest run` → 27 / 182 … −102 cases (−35.9%)" | Step 4; Tests | **PASS** | Reproduced by execution. Table C's case column also exact: `it(`/`test(` per file → 56, 24, 2, 13, 5, 2 = **102**; `ls tests/unit \| wc -l` → 33, minus 6 = 27. 102/284 = 35.9%. |
| 11 | E1: "`ActivityStatus` … is `"Aberta" \| "Rascunho" \| "Pausada" \| "Encerrada"` — four members — so pruning three leaves `"Encerrada"` bound to the file being deleted, the `import type` at `status-badge.tsx:1` survives, and §2.3 never closes" | Step 2; Δ8 | **PASS** | `portal-view-service.ts:9` verbatim four members. `status-badge.tsx:1` is the `import type`; `:5-14` is the `Status` alias = `ActivityStatus` **plus eight** literals (`:7-14` = 8) ✓; the tone ladder is `:17-29` (file says `:18-29`; `:17` is `const tone =`). Plan §2.1.1's "prune three" indeed leaves the import live. |
| 12 | Replacement snippet is "prettier-canonical", "longest line 75 ≤ printWidth 80", classes exist | Step 2; Evidence | **PASS** | Pasted verbatim into scratch: `npx prettier --check` → **exit 0**, `npx eslint` → 0, longest line **75**. `.statusBadge:1038`, `.statusPositive:1058`, `.statusNeutral:1073` ✓ (also `.statusWarning:1063`, `.statusDanger:1068`). 8 lines, so Rollback's "8-line badge edit" ✓. |
| 13 | "**all 10 `<StatusBadge>` sites outside the delete set pass `recordStatusLabel(...)`**, and every site that passes a raw status string lives in a file this phase deletes"; 7 raw sites; 10 survivor sites in 6 screens | Step 2; Evidence row 5; Δ5 | **PASS** | `grep -rn "<StatusBadge" src` → **17** sites in **13** importing files (7 files purged, 6 survivors + `status-badge` itself). All 7 named raw sites exact; all 10 survivor sites are `recordStatusLabel(...)`. `recordStatusLabel` at `adult-portal-helpers.ts:15`, typed `(status: RecordStatus): "Ativa" \| "Inativa"` ✓. Citations `organization-detail-screen.tsx:181` / `overview-screen.tsx:174` land on the `status=` prop line (element opens at `:180`/`:173`) — the other eight land on the element line; mixed but resolvable. |
| 14 | "the plan reportedly omits `status-badge.tsx` from its deletion manifest" (Δ-claim, §2.1.1 vs §2.3) | Step 2 | **PASS** | `status-badge.tsx` appears nowhere in plan §2.2/§2.3/§2.4; §2.1.1 edits it. Its post-purge importer set is {6 surviving screens}, so keeping-and-collapsing is the only correct handling. |
| 15 | Step-2 "**Verify:** tsc → 0; `grep -rn "ActivityStatus" src/components/portal/status-badge.tsx` → no output; prettier --check → 0" | Step 2 | **PASS** | All three reproduce (tsc 0 before the purge with the edit applied; grep exits 1 with no output after; prettier 0). Each can fail: the pre-edit file has 2 `ActivityStatus` hits and an 81-char variant fails prettier. |
| 16 | Step 7's line map: "`:108-111` comment, `:112` `const referrerPolicy =`, `:113` the dead `/atividade/` arm, `:114-115` two **live** `/jogar` arms, `:116` `? "no-referrer"`, `:117` fallback, `:118` header set, `config.matcher` at `:137`" | Step 7 | **PASS** — every line, exact | Opened and mapped individually; `:136` is `export const config = {`, `:137` the matcher string. `frame-src` `:76` (Δ1 ✓; `:68` is the `frameSources` const, so the dossier's figure is not "wrong" so much as a different line of the same expression). |
| 17 | "Plan §2.1.3's range `:109-116` is **wrong and dangerous** … `VER-A` reproduced `proxy.ts:112:7 TS1128`" | Step 7 | **PASS** (hazard) / minor line slip | Cut `:109-116` in scratch → `src/proxy.ts(109,7): error TS1128: Declaration or statement expected`, tsc exit 2, eslint "Parsing error". The gate **can fail**, which is the point. Reported position is `109:7` on this tree, not `112:7`. |
| 18 | "had it compiled, it would strip `no-referrer` while the V1 bearer credential rides `?cred=`: `player-credential-print-sheet.tsx:22-24`" | Step 7; Interfaces | **PASS** | `:21` `const basePath = process.env.APP_BASE_PATH ?? ""`, `:22` `new URL(\`${basePath}/jogar/\`, …)`, `:23` `url.searchParams.set("cred", token)`, `:24` return. And the arms **are** live: `basePath` is set only in the **demo** branch (`next.config.ts:28`), which is `output: "export"` — the target where the proxy cannot run. In the server target `APP_BASE_PATH` is `""` (`:37-40`), so `pathname === "/jogar"` matches. C1 is real security code, not dead weight. |
| 19 | Step-7 "**Verify:** tsc → 0; `git diff --numstat` → at most 1 deleted content line plus the comment reword; `grep -c '"no-referrer"' src/proxy.ts` → **1** … a bare `grep -c no-referrer` returns 2 both before and after and is the wrong probe" | Step 7 | **FAIL** (numstat) / PASS (quoting analysis) | Quoting analysis verified exactly: `grep -c '"no-referrer"'` → **1** before and after; `grep -c no-referrer` → **2** before and after (`:109` is single-quoted in the comment). But **the step's own snippet breaks the numstat and prettier**: pasted verbatim it yields `8 10` and `prettier --check` → **exit 1** (the block is printed at indent 0, the file is inside `proxy()`), which kills `format:check` and therefore `npm run check` and the Exit gate. The minimal in-place edit yields `3 5` and prettier 0. Fix in §3.2. Also note the `grep -c` cannot fail-closed: deleting the `/jogar` arms while keeping the literal still prints 1 (the file concedes this and adds the manual read). |
| 20 | "No test covers this"; "`tests/unit/proxy.test.ts` has 2 tests, both hitting `/entrar`, asserting CSP / correlation id / `nosniff`; `grep -n "Referrer" tests/unit/proxy.test.ts` → no matches" | Step 7; Tests; Exit gate | **PASS** | Read the whole 26-line file: exactly 2 `it`s, both `http://localhost:3000/entrar`, asserting CSP/nonce/correlation/`nosniff`. `grep -rn "Referrer" tests` → 0 hits. **Sibling the file misses:** `src/server/http/game-state-route.ts:76` sets `"Referrer-Policy": "no-referrer"` on the V1 API — a second, equally untested surface. |
| 21 | Exit gate "manual assertion … serve the export (`npx serve out`, or the Pages preview) and confirm `Referrer-Policy: no-referrer` on `/jogar/`" | Exit gate | **FAIL** — can never pass | `out/` is a static directory; `proxy.ts` is Next middleware and is not in the request path of `npx serve`, of GitHub Pages, or of `output: export` at all — `next.config.ts:25` says so in the project's own words: "Proxy and request-dependent API routes cannot run under `output: export`". `deploy.yml` publishes `./out`; there is no `_headers` in the export (`ls out/_headers` → not found). The header can only be observed on the **server** target. Fix in §3.3. |
| 22 | Step 6 row 1: "`isDemoRuntime` … Re-counted: 11 hits today — 1 definition, and 10 inside the delete set (8 in the four `atividade/[token]` pages, 2 in `portal-view-service.ts:4,7`) ⇒ 0 users after the purge. Deleting it *before* breaks the build (proven)" | Step 6; Accepted breakage | **PASS** | `grep -rn isDemoRuntime src tests` → exactly 11 lines, distributed as claimed; definition at `src/runtime/mode.ts:13-17` ✓ (a 5-line block, so the cited range is the function itself). Post-purge the only remaining hit is the definition → "0 users" ✓, and "after the purge" ordering is genuinely load-bearing. |
| 23 | Step 6 row 2: "`errors.ts:11` … the 6th entry … `apiErrorCodes` is consumed only at `errors.ts:27,37` — there is **no** `Record<ApiErrorCode,…>` map … its sole production user `atividades/actions.ts:181` is deleted; no test loads `contracts/schemas/api-error.v1.schema.json` (outside the `…/schemas/v1/` glob `v1-contracts.test.ts:34-38`)" | Step 6; Accepted breakage | **PASS** | `errors.ts:11` = `"RATE_LIMITED"`, 6th of `:6-24`. `apiErrorCodes` has exactly two references repo-wide (`:5` def, `:27` type); `ApiErrorCode` two (`:27`, `:37`); `Record<ApiErrorCode` → 0 hits. `RATE_LIMITED` appears in only 3 places: `actions.ts:181` (purged), `errors.ts:11`, `api-error.v1.schema.json:21`. That schema is **not** in `contracts/schemas/v1/` (the canonical set the glob and GameMaker use) and its `$id` is `https://missoes.example/…`. `v1-contracts.test.ts:35` reads `resolve(root,"schemas","v1",…)`. **Consequence the file does not state:** after this step the union has 19 members and the schema still lists 20, and the schema half is deferred to Phase 20 — deliberate, but it is code↔contract drift *inside* the purge PR. |
| 24 | Step 6 rows 3–5: "`dev-bypass-gateway.ts:9` (`DEV_BYPASS_ACTOR`) … in-file use at `:17` … `gateway.ts:1` imports `DevBypassAuthGateway` (declared at `:26`) and instantiates it at `gateway.ts:42` … its only external consumer was `portal-view-service.ts:1` (used at `:508`)"; "`adult-portal-helpers.ts:136-138` … zero surviving items carry that label"; "`auth.test.ts:146,147,154` … `isProtectedPathname` (`gateway.ts:50`)" | Step 6; Δ4 | **PASS** (one off-by-one) | All verified: `:9` `export const DEV_BYPASS_ACTOR`, `:17` its in-file use inside `DEV_BYPASS_SESSION` (`:16`), `:26` `export class DevBypassAuthGateway`, `gateway.ts:1` imports it — **instantiates at `gateway.ts:43`** (`:42` is `cachedGateway = isAuthDevBypassEnabled()`, the statement head). `portal-view-service.ts:1` and `:508` ✓. `helpers:136-138` ✓ verbatim. Live nav labels are only Visão geral / Turmas / Resultados / Organizações / Equipe / Minha organização (`application/adult-portal/service.ts:143-190`, `portal-navigation.tsx:63-121`) → **zero** carry "Links de acesso" ✓. `gateway.ts:50` ✓ (Δ4 right). `auth.test.ts:146,147,154` hold the three stale strings and all pass post-purge (vitest 182 green). |
| 25 | Step 6 "**Verify:** `npm run check` → exit 0 …; `grep -rn "isDemoRuntime" src tests` → 0 hits; `grep -rn "Links de acesso" src` → 0 hits" | Step 6 | **VACUOUS-GATE** / unsatisfiable | First two fine (measured: `isDemoRuntime` = 1 hit pre-step-6 → 0 after). The third **can never pass in this phase**: post-purge it returns 2 hits; after the `adult-portal-helpers.ts:136-138` trim it still returns **1**, at `src/app/(professional)/portal/ajuda/page.tsx:9` — a file this same document rules out of scope, "Owner: **Phase 50**". A gate that asserts a Phase-50 edit as a Phase-10 exit condition. Fix in §3.4. |
| 26 | Step 8: `demo-action-button.tsx` "**39 lines, 0 importers**; deleting it also frees `.toast` (`portal.module.css:2463`); leaving it keeps `.toast` live (which is exactly where `INV-A` was refuted)"; `base-url.ts` "**45 lines**, `getPublicBaseUrl` has 0 callers"; `getGameClientUrl` `game-client.ts:38` 0 callers; `logger.ts:11-12` | Step 8; Handoff 3 | **PASS** | 39 and 45 lines ✓; 0 non-self hits for both ✓; `game-client.ts:38` is `export const getGameClientUrl = resolveGameClientUrl;` ✓; `logger.ts:11-12` = `"activityToken"`, `"attemptToken"` ✓. `.toast` has **5** consumers — 4 purged (`activity-controls:149`, `class-groups-explorer:231`, `material-editor:260`, `share-actions:140`) plus `demo-action-button:33` — so "survives through this file" is exactly right, and `styles.statusWarning`/`statusDanger` occur **only** at `status-badge.tsx:24`/`:28` ✓ (so they do lose their only consumers here). `composes:` → 0 hits repo-wide ✓. |
| 27 | Goal: "with one prerequisite edit, one security edit, and **no other source change**" | Goal | **FAIL** | Contradicted by its own Scope and Steps: step 6 edits **five** further files (`runtime/mode.ts`, `server/http/errors.ts`, `server/auth/dev-bypass-gateway.ts`, `adult-portal-helpers.ts`, `tests/unit/auth.test.ts`), step 8 up to four more optionally. The Exit gate says the right thing ("the small edits of steps 2, 6, 7 and (optatively) 8"); the Goal's headline does not. Replace in §3.5. |
| 28 | Exit gate "`git diff --stat main` → 46 files deleted, 7,802 line deletions in those files … nothing else" | Exit gate | **PASS** | Measured in scratch: `47 files changed, 2 insertions(+), 7828 deletions(-)`; the 46 fully-deleted files carry 0 insertions and **7,802** deletions; the 47th is `status-badge.tsx` (`2 / 26`). |
| 29 | "`find out -name '*.html' \| wc -l` → **26** (from **104**, −78)"; "gone: `out/atividade`, `out/portal/atividades`, `out/portal/materiais`, `out/portal/admin/auditoria`"; "kept: `out/jogar`, `out/entrar`, `out/portal`, three `portal/turmas/<id>`"; "`find out/atividade \| wc -l` → error; pre-purge 52" | Exit gate | **PASS** — all executed | Pre-purge tree: 104 html, `find out/atividade -name index.html \| wc -l` → **52**, and the other six deleted trees hold 13+8+2+1+1+1 = **26** ⇒ 52+26 = 78 ⇒ 104−78 = **26**. Post-`build:demo` in scratch: **26**, all four "gone" gone, all six "kept" present. The exporter cleans `out/` (no stale `atividade/`). |
| 30 | "none of the 17 ids comes from a purged file — the manifest's `filename` values are only `entrar/actions.ts` (1), `portal/adult-portal-actions.ts` (10), `portal/player-access-actions.ts` (4), `portal/sign-out-action.ts` (1), `jogar/actions.ts` (1), and `portal/atividades/actions.ts` / `entrar/recuperar/actions.ts` appear **zero** times"; demo → 0 | Exit gate; Handoff 2 | **PASS** — reproduced after the purge | Post-purge `build:server` probe: total 17, `server-action` **17**, per-file exactly **1/10/4/1/1**; both named zero-count files absent. Post-purge `build:demo`: `total ids 0 server-action 0`. The prediction "the post-purge server baseline is still **17**" is confirmed by execution, not arithmetic. |
| 31 | "`/portal/admin` still 404s (no `page.tsx`)"; "the four bare `redirect("/portal")` stubs"; "`(public-play)` is not empty — `jogar/{page,layout,actions}` survive and `public-shell.tsx` stays reachable via `jogar/layout.tsx:4`"; "`/entrar/recuperar` is unlinked, not unreachable — still a prerendered page and a `"use server"` module" | Exit gate; Route reachability | **PASS** (last clause loose) | `ls portal/admin` → auditoria, equipe, jogos, modulos, organizacoes, **no `page.tsx`** ✓. Exactly four `redirect("/portal")` stub pages ✓ (`modulos`, `modulos/[id]`, `admin/jogos`, `admin/modulos`). `jogar/layout.tsx:4` = `import { PublicShell } from "@/components/public/public-shell";` ✓. `out/entrar/recuperar/` is prerendered ✓ and nothing links it. But `recuperar/actions.ts:11` carries a **function-level** `"use server"` (which is why it registers 0 ids) — "a `"use server"` module" is loose in precisely the sense Phase 30's own §11 flagged; say "a module with a function-level `"use server"` directive that registers no action id". |
| 32 | `/atividade/*` residual: "4 hardcoded seed tokens (`"7FQ-29M"`, `"2KF-81P"`, `"habitos-saudaveis"`, `"turma-5b"`) plus whatever `listAccessLinks()` returns"; `MC-*` "could never resolve … 404 from birth"; `.gitignore:7` is `/out`; `git ls-files out` → 0 | Accepted breakage | **PASS** | `atividade/[token]/page.tsx:10-17` = `generateStaticParams`, `:12` the four literals, `:13` `listAccessLinks().forEach`. `activity-controls.tsx:39` `Math.random()…`, `:44` the `https://niciniv.github.io/SMS_Portal/atividade/${newToken}` URL. `out/atividade` contains exactly **4** token directories, and `find out -ipath '*MC-*'` → **0** hits. `.gitignore:7` = `/out`; `git ls-files out \| wc -l` → 0. |
| 33 | "**No shim is booked, and none is possible** under `output: 'export'` with the backing table dropped" | Accepted breakage; Scope | **FAIL** (over-claimed) — the *decision* is right, the argument is not | "Impossible" is false as stated. Exactly **4** tokens were ever exported (§32), all four hardcoded in `generateStaticParams:12`. A static shim is precisely a `page.tsx` whose `generateStaticParams` returns those 4 literals and whose body emits a meta-refresh — it needs no table, no runtime, and 4 lines of data. What is actually true, and sufficient: (i) a shim cannot cover *rotated/unknown* tokens, because an export cannot enumerate them; (ii) `COMPAT-POLICY` §2 row D-4 rules the class-A URL dead on ownership grounds; (iii) `output: 'export'` **plus** `DROP TABLE "access_links"` removes any *dynamic* shim. The file should argue (i)+(ii)+(iii) and stop saying "impossible"; and it should state the 4-token census, since 52 is a **document** count (4 tokens × 13 states), not a population of published URLs — as written ("The population that ever existed is small: … 52") it overstates the exposure 13-fold while "impossible" understates the implementer's options. |
| 34 | "`model AuditEvent` … `portal-view-service.ts:416` = `export const auditEvents = demoRuntime ? demoAuditEvents : []` — in server mode the page always rendered an empty list, so the table was never read in any mode" | Accepted breakage D-6 | **PASS** | Line 416 verbatim. `demoRuntime` is `isDemoRuntime()` at `:7`, so the server branch is the empty literal; `grep -rn "audit_events\|AuditEvent" src/server` shows no other reader. Class-A drop confirmed independently. |
| 35 | "Keeping `RATE_LIMITED` … class **A** with a false premise — `output: 'export'` means `/api/v1/player/*` has never been reachable in the shipped target" | Accepted breakage D-5 | **PASS** with a caveat | The Pages target (`deploy.yml:39 path: ./out`) is the only thing CI publishes, and a static export cannot serve route handlers — post-purge `build:demo` emits no `out/api`. Caveat: a tracked `Dockerfile` runs `npm run build` = `build:server`, whose `.next/app-path-routes-manifest.json` **does** register all four `/api/v1/player/*/route` handlers (measured). Nothing in the repo builds that image (no `docker`/`Dockerfile` reference in `deploy.yml` or `package.json`), so "never reachable in the shipped target" holds *de facto*, not by construction. |
| 36 | "`Capability` … has no surviving consumer" / sequencing of the model drop | Blocks; Handoff 1 | **PASS** | The file never claims it before the purge: Blocks says Phase 20 is blocked *because* the models "lose their last readers here", and Handoff 1 states "are gone, so the Generation A models have zero readers". Sequence correct. `prisma/schema.prisma:97` = `capabilityAssignments CapabilityAssignment[]` inside `model OrganizationMembership` (`:87`) ✓, and plan §2.5 lists only `:65`, `:80`, `:79` → "the plan misses `:97`" ✓. |
| 37 | Interfaces/do-not-touch citations: `schemas.ts:159,161,164,246` wire names, Δ6 `:241`; `qrcode` `package.json:37` / `@types/qrcode` `:34`; `grep -n player-credential-print-sheet REFACTOR_PLAN.md` → no match; `package.json:24`/`:20`; `scripts/next-target.mjs:26-29`; prose at `loading.tsx:15`, `results-screen.tsx:195,221`, `player-entry-screen.tsx:42`, `app/layout.tsx:12`; `walkthrough.md:11` | Interfaces; Do not touch; Entry gate; Step 3; Accepted breakage | **PASS** — every one opened | `:159 id_atividade`, `:161 versao_atividade`, `:164 numero_tentativa_atividade`, `:246 id_atividade: z.literal(idAtividade)`; `:241` is `idAtividade: string,` (camelCase) ⇒ Δ6 right. `package.json:37 "qrcode"`, `:34 "@types/qrcode"`, `:24 check`, `:20 "typecheck": "tsc --noEmit"`. `next-target.mjs:28-29` set both mode vars. All four prose lines hold Portuguese copy. `walkthrough.md:11` is exactly the `/atividade/7FQ-29M/` bullet. Plan grep → 0 ✓. `contracts/schemas/README.md:88` "An incompatible rename requires protocol version 2" ✓ (B1 correctly invoked). |
| 38 | Scope/ajuda: "50 lines … only imports are `PageHeader` (`:1`), `portal.module.css` (`:2`) and `Icon` (`:3`) … `topics` (`:8-24`) … zero hrefs … keep the `:34-47` markup (dossier says `:34-45`) … `textLink` is shared with two survivors plus the purged `atividades/[id]/page.tsx`" | Scope | **PASS** | 50 lines ✓; imports ✓; `topics` declared `:7`, entries `:8-23`, `];` at `:24` ✓; `grep -c href ajuda` → **0** ✓; `moduleGrid` opens `:34`, closes `:47` ✓ (dossier's `:34-45` is short); `styles.textLink` users = ajuda:`44`, purged `atividades/[id]/page.tsx:76`, and **only** `organization-detail-screen.tsx:157,208` + `overview-screen.tsx:154,200,231` ✓; `moduleGrid`/`moduleCard`/`moduleArt` → ajuda only ✓. |
| 39 | "`.github/workflows/` … Phase 00's `ci.yml`" + the 26-document baseline handoff | Depends; Handoff 4 | **MISSING** (real PR blocker, misfiled) | `ls .github/workflows` → **`deploy.yml` only**; no `ci.yml`. This file's Exit gate asserts **26** but **no Work-order step edits `ci.yml`**, whose doc assertion is `104` (`phases/00:143`, with a literal `// PHASE-1: 26`). `grep -n "ci.yml" phases/10…` → 2 hits (`:7`, `:260`), neither a step. Judgment: this is not a cosmetic misfiling — the purge PR is the commit where the truth changes, Phase 00 puts `gates` behind branch protection, so a purge PR that leaves `104` in place **cannot merge green**, and `phases/00:234` books it to P1 while `:235` hands the same line to P1b (two owners, zero steps). See §3.6. |
| 40 | COMPAT citations, and edit 1 (history collapse) | Entry gate; Out of scope; Accepted breakage | **PASS** | No import of the rejected ruling: `grep -n "0_init\|datamodel_extras\|collapse\|shadow" phases/10…` → only two unrelated hits ("union **collapse**" ×2, `:93`/`:127`). `prisma/migrations/` on disk is `0_init` … `5_v1_game_events`, sequential ✓. Separately: this file makes **no** drop-file statement-count claim, so the 8-vs-9-vs-10 dispute is not a Phase-10 defect — and the governing text is `COMPAT-POLICY.md:110`, which rules **10 statements** and explicitly retracts a **9**: `0_init:74` is `CREATE TABLE "audit_events" (` and `:156` is its outward FK `REFERENCES "professional_profiles"`, `grep -rn 'REFERENCES "audit_events"' prisma/migrations/` → **no match** (both underlying facts as the brief states). The 9-vs-10 question is generator *output*, not engine semantics, and belongs to `phases/20` step 8. |
| 41 | Δ3 "`next.config.ts:26-27`" ; Δ9 "§5.1's executed closure result was **not** re-run here" | Step 3; Divergences | **PASS** | `:26-27` is the `distDir` conditional (`:28` carries `output`/`basePath`). Δ9 is honest and correct as written — and is the reason this refutation exists: the number it deferred (Δ2) is the one that came back wrong. |
| 42 | Evidence rows citing dossier §5.1 `:112-118`, §5.3 `:133-150`, §5.4 `:152-167`, §5.5 `:169-181`, §5.6 `:182-184`, §5.7 `:186-203` | Evidence | **PASS** | Anchors land on the named headings (`:112 ### 5.1 The headline result`, `:133 ### 5.3 …prettier-canonical`, `:152 ### 5.4 The security edit, exact`, `:169 ### 5.5 …hygiene`, `:182 ### 5.6 Route reachability`, `:186 ### 5.7 Safe execution order`). |
| 43 | "File-disjoint from Phase 30 and runnable in parallel" (0 of the 17 `@runtime/*` alias targets) | Depends | **PASS** | Dossier §10.2's own unit: 18 alias *entries* (9 keys × 2 branches) resolve to **17 distinct files**; `grep -rn '@runtime/' src` → 24 statements, **0** inside the purge set. The seven files Phase 10 edits appear in `phases/30` only at `:609`, which states no seam step touches `src/runtime/mode.ts`. |
| 44 | "Rollback: one commit … `git revert` restores all 46 files and the 8-line badge edit together, because … no surviving module was rewritten to accommodate the deletion" | Rollback | **UNREPRODUCIBLE** | Half true, half contradicted by the file itself: steps 6 and 7 *do* rewrite surviving modules (`mode.ts`, `errors.ts`, `dev-bypass-gateway.ts`, `adult-portal-helpers.ts`, `proxy.ts`). Reverting the purge commit alone reverts them too, so the rollback is safe — but the stated *reason* is false, and step 6's "must run AFTER steps 4–5" ordering means a partial revert is not order-neutral. Say: "single commit *because* it carries both deletions and the five prerequisite edits". |
| 45 | "Entry gate: `npm run format:check` → exit **0**" / "HEAD is `e5aaf1e` (or the Phase 00 merge on top of it)" / step 1 "Verify: `npm run check` → exit 0" | Entry gate; Step 1 | **UNREPRODUCIBLE** (blocked on Phase 00) | `npx prettier --check .` on the pristine origin tree → `[warn] REFACTOR_PLAN.md`, **exit 1** (and `docs/` is in `.prettierignore`, so the dossier is not the cause). At `e5aaf1e` as literally named, the Entry gate is red and step 1's own "If it fails" says *stop*. Correct only on the Phase-00 merge, which owns the `.prettierignore` line (`phases/00:55-57`) and rules `REFACTOR_PLAN.md` un-formattable (`:26`). The gate should name that dependency inline instead of pairing `e5aaf1e` with a green `format:check`. |
| 46 | Step 1 "Verify: `git log --oneline -1` → `e5aaf1e …`" ; "`npm run check` composes format:check first" ; "`package.json:20`'s typecheck is bare … can read an incremental cache" | Step 1; Entry gate | **PASS** (first two) / **NOTE** | `git log`/`package.json:24`/`:20` verified. The `--incremental false` flag is belt-and-braces: `tsconfig.json:38` sets `"incremental": true`, and `tsconfig.tsbuildinfo` **is** present in the tree — the file never says so, and never mentions that the flag is what saves it there. |

## §3 Replacement text for each FAIL

**3.1 — steps 3 and 5, the `.next` remediation (replaces both Verify lines).** `tsconfig.json:47,51,53`
include three generated roots; `build:server` writes only `.next/types` (proved: after removing all three and
rebuilding, `find . -name validator.ts -not -path './node_modules/*'` → `.next/types/validator.ts` alone), and
`ADV-1:42` already prescribed the right cleanup. Step 3's Verify becomes:

> **Verify:** `rm -rf .next/types .next/dev .next-demo-dev && npm run build:server >/dev/null` then
> `find . -maxdepth 4 -name validator.ts -not -path './node_modules/*'` → exactly one line,
> `.next/types/validator.ts`; then `grep -rho 'typeof import("[^"]*"' .next/types .next/dev .next-demo-dev | wc -l`
> → **44** on an un-purged tree and **23** after step 5 (never a purge-target count — the probe cannot be 0
> while `src/app/**/page.tsx` still exists; that is step 5's job, not step 3's).
> **If it fails:** `npm run build:server` exiting non-zero on `TS2307`/`TS2344` inside a `.next*` path means a
> second or third validator root survived — you ran the Phase-00 `dev` server or a demo build since. Remove
> **all three** roots, not `.next/types`. Re-running `build:server` alone can never converge.

Step 5's Verify becomes: `rm -rf .next/types .next/dev .next-demo-dev && npm run build:server >/dev/null &&
npx tsc -p tsconfig.json --noEmit --incremental false` → exit **0** (verified).

**3.2 — step 7's snippet and numstat gate.** The block is printed at indent 0 but lives inside `proxy()`;
pasted verbatim it yields `git diff --numstat` = `8 10` and `prettier --check` exit 1. Emit it pre-indented and
scope the gate:

> ```ts
>   // Player entry links carry the bearer credential in ?cred= and the game
>   // iframe is embedded from it, so /jogar is served with 'no-referrer' to keep
>   // the credential out of Referer. Other routes keep a stricter default.
>   const referrerPolicy =
>     request.nextUrl.pathname === "/jogar" ||
>     request.nextUrl.pathname.startsWith("/jogar/")
>       ? "no-referrer"
>       : "strict-origin-when-cross-origin";
> ```
>
> Rewrite `:108-111` **in place** to the three comment lines above and delete `:113` only — do not retype
> `:112` or `:114-117`. **Verify:** tsc → 0; `npx prettier --check src/proxy.ts` → 0;
> `git diff --numstat src/proxy.ts` → **`3 5`**; `grep -c '"no-referrer"' src/proxy.ts` → **1**.

**3.3 — Exit gate's referrer assertion.** `npx serve out` and the Pages preview cannot emit the header
(`next.config.ts:25`'s own comment; `deploy.yml:39` ships `./out`; no `out/_headers`). Replace the bullet:

> `Referrer-Policy` is served **only** by the standalone target: `npm run build:server && npm run start`, then
> `curl -sSI http://localhost:3000/jogar/ | grep -i referrer-policy` → `no-referrer`. Under `build:demo` +
> Pages the header does not exist at all, so do **not** probe `out/` — a "pass" there is unreachable and a
> "fail" means nothing. Also check `src/server/http/game-state-route.ts:76`, the other place that sets it.

**3.4 — step 6's `Links de acesso` gate** (`ajuda/page.tsx:9` is Phase 50's):

> `grep -rn '"Links de acesso"' src/components src/server src/runtime` → 0 hits
> (`src/app/(professional)/portal/ajuda/page.tsx:9` is prose and stays until Phase 50; `atividades/page.tsx`
> is deleted here, so a repo-wide `src` grep can only ever reach 1, never 0).

**3.5 — Goal sentence:** "…with **one build-breaking edit (step 2), one security edit (step 7), five
bookkeeping/prerequisite edits (step 6), and nothing else**."

**3.6 — a step for the `ci.yml` census, between steps 5 and 9:**

> ### 5b. Update the exported-document assertion
> `.github/workflows/ci.yml` (Phase 00's) asserts 104 exported documents with a literal
> `// PHASE-1: 26` marker at `phases/00-prerequisites.md:143`. In **this** PR change the count to **26** and
> the expected-path list to §11.1's 26 routes: the purge PR is the commit where the truth changes and
> Phase 00's branch protection requires `gates`, so deferring it makes `main` red from the merge until
> Phase 50. `phases/00:234` books it to P1 and `:235` to P1b — this step is the tie-break.

## §4 What this phase would have gotten wrong

1. **Its own compile gate is unreachable, and its "If it fails" is a dead end.** The purge closes — I proved
   it (1 real `TS2307`, 0 other `src/` errors, `tsc`/`lint`/`vitest` green). But `rm -rf .next/types` clears
   one of three roots in `tsconfig.json:47,51,53`. Executed as written: `npm run build:server` **exit 1**, then
   46 more error lines (42 `TS2307` + 4 `TS2344`) from `.next/dev/types` and `.next-demo-dev/dev/types`, zero
   from source. The "If it fails" text says *re-run `npm run build:server`*, which regenerates only
   `.next/types` — an infinite loop with a confident diagnosis attached. And the `TS2344` cross-`routes`
   failure mode is nowhere in the document.
2. **Step 3 asserts a number its own command cannot return at that point in the sequence.** `→ 0` is measured
   **11** on this tree while the routes still exist; the gate only becomes 0 by deleting the routes, which is
   step 5. The probe also cannot see the other 10 of 21 purge-naming specifiers (its alternation has no
   `modulos`, no `admin/`, no `atividade/`), and `grep -c` **exits 1** while printing the asserted `0`.
3. **Two gates can never pass: `grep -rn "Links de acesso" src → 0`** (1 hit remains at `ajuda/page.tsx:9`, a
   file this document rules out of scope and assigns to Phase 50) **and `Referrer-Policy: no-referrer` on
   `out/`** (the proxy is not in a static export's request path — `next.config.ts:25` says so). The second one
   is the *security* sign-off, so its failure mode is worse than a red gate: a reviewer who believes they saw
   `no-referrer` from `npx serve` will sign a credential-leak fix they never observed.
4. **Δ2's 20/15, and how the mistake happens.** 20 is a **page-only** sweep: of the 44 refs, exactly 21 name
   §2.2's trees and the 21st is `(public-play)/atividade/[token]/layout.js`; filter the capture to
   `/page.js"` and you get 20, which is where `ADV-1:42`'s "20 per copy" came from too. "15 distinct" is not
   reproducible and cannot be: all 44 lines are unique (`sort -u` → 44), so *any* 20-occurrence subset has 20
   distinct specifiers — the two numbers were produced by different probes, or by a `uniq` on the wrong unit
   (nearest is a leaf-directory dedup, which merges `materiais/[id]/editar` with `atividades/[id]/editar`,
   `…/[token]/[state]` with `…/jogar/[state]`, `modulos/[id]` with `atividades/[id]` and yields 16). The
   lesson is the same one `phases/00:253` records: **count distinct full specifiers, and include layouts.** No
   *gate* in this file depends on the wrong number — step 3 deliberately gates on regeneration instead — but
   the paragraph that reports the number publishes a probe that returns 11, so neither the prose nor the gate
   is usable as written.
5. **"No shim is possible" is the wrong reason for a right decision.** Four tokens ever shipped, all
   hardcoded in `page.tsx:12`; a 4-entry static refresh is trivially expressible under `output: export`. The
   decision rests on `COMPAT-POLICY` §2 row D-4 and the impossibility of a *dynamic* shim, and the file already
   has those. Meanwhile "52 documents" is quoted as the population of live URLs when it is 4 tokens × 13 state
   pages — the number that makes the breakage look worst is 13× too big, and the number that would make a shim
   look easy (4) never appears.
6. **The `ci.yml` document census has no owner's step.** Three files describe the `104 → 26` edit (two book it
   to P1, one to P1b) and none schedules it as a step; this file asserts 26 at exit and never mentions editing
   the pipeline that asserts 104. The purge PR is where `gates` goes red.

## §5 Could not check

- **The real GitHub Pages site** (`/atividade/7FQ-29M/`) — the file's residual depends on a network fetch made
  by the policy audit; I did not re-fetch, and no live-token readout exists in the repo (§5.1).
- **Whether `main` is protected / `ci.yml` exists post-Phase-00** — `ci.yml` is not on disk
  (`ls .github/workflows` → `deploy.yml`), so §3.6's PR-blocking consequence is argued from
  `phases/00:101-144`'s listing, not from a live workflow file.
- **`npm run dev:demo` badge tones (R-14) and `npm run start` + `curl` for `Referrer-Policy`** — both need a
  running server; I verified the *code path* statically (`basePath` is demo-only, so the arms match on the
  server target) rather than a live header.
- **`prisma validate` / `migrate diff`** — DB-touching, and the 9-vs-10 statement question is `phases/20`
  step 8's (see #40); `0_init:74`/`:156` and the empty `REFERENCES "audit_events"` grep were checked read-only.
- **`git revert` behaviour (Rollback)** — would require committing in the scratch tree; the *reason* given is
  already shown false by #44, which is the part that matters.
