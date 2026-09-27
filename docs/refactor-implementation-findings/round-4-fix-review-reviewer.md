# ROUND-4 STATIC SPEC-COMPLIANCE REVIEW — Refactor Implementation

**Reviewer role:** static spec-compliance reviewer (read-only)
**Date:** 2026-09-27
**Round-3 tree:** `bc5c14caf550226c268100fed44c7cb7be5f3caf`
**Round-4 tree (index):** `e4876790bf53e0b597316e3327c7e5d95eb0075a` (confirmed via `git write-tree`)
**Base (HEAD):** `9467757ed436c82bdbace5a78e23b502176318e2`
**Method:** `git diff`/`--word-diff`/`--numstat` against the two trees, `git ls-files`/`git grep`, direct file reads, Node-based lockfile graph analysis (prod/dev reachability BFS), byte-level comparison of `package-lock.json` against npm's hidden lockfile `node_modules/.package-lock.json`, and native-binary string search under `node_modules/@next/`. No builds, tests, or npm commands were run; nothing was written to disk.
**Toolchain observed:** Node `v22.23.1` (repo pins `24.19.0` per `package.json:5`), installed `next@16.3.6`, `@next/env@16.3.6`, `sharp@0.35.4`, `eslint-config-next@16.3.6`. Working tree == index confirmed (`git diff` unstaged is empty).

---

## Per-change verification

| # | Claim | Evidence | Verdict |
|---|---|---|---|
| **R4-1** | `@next/env` pinned exact `16.3.6`; lockfile delta scoped to `@next/env` + deletion of nested copy + 27 `dev:true` additions on optional platform bindings | `package.json:35` `"@next/env": "16.3.6"` (no caret). Lockfile non-`dev` additions are exactly 4 lines: root spec, `version`, `resolved`, `integrity` — nothing else. `dev:true` count = **27**, mapping to exactly 15 `@rolldown/binding-*@1.2.5`, 11 `lightningcss-*@1.33.0`, 1 `fsevents@2.3.3` (verified by mapping each hunk line number back to its `node_modules/…` key). Deletion of `node_modules/next/node_modules/@next/env` present. **Independence check:** own reachability BFS from `packages[""].dependencies` shows all 27 are `prodReachable=false, anyReachable=true`, reachable only via `vite → {rolldown, lightningcss, fsevents(optional)}` — so `dev:true` is what npm itself computes and `npm ci --omit=dev` loses nothing production needs. `next@16.3.6` declares `"@next/env": "16.3.6"` exactly, so the dedupe is correct. | **PASS** |
| **R4-2** | Audit-doc links made file-relative; both must resolve from the doc's directory | `docs/architecture-audit-2026-09-23.md:8-9` now `](refactor-dossier/IMPLEMENTATION-READY.md)` and `](current-architecture.md)`. From `docs/`, both targets exist and are tracked. These are the only two links in the document. | **PASS** |
| **R4-3** | `scripts/next-target.mjs` comment cleaned: no literal `\"`, continuous sentences, ≤~79 chars, facts preserved | Block is lines 82-91; measured lengths 77/78/76/72/73/66/73/73/67/39 — all ≤78. Prose joined and compared against round-3: **equal** after (a) removing `"16.3.2 and "` and (b) stripping backslashes, i.e. only the two intended edits occurred, rest is pure reflow. Literal-backslash check: round-3 line 86 contained bare `"use server"` **and** escaped `\"use server\"` on the same output line — proving the round-3 file really had literal backslash-quote bytes, and they are gone. No stale `16.3.2` remains. | **PASS** |
| **R4-4** | `DESIGN.md` ragged rewrap fixed, content unchanged | Whitespace-normalized text is byte-identical: 16,413 chars old, 16,413 chars new. `git diff --word-diff=porcelain --word-diff-regex='[^[:space:]]+'` yields **zero** `+`/`-` token lines. | **PASS** |
| **R4-5** | Runbook P30 Target Shape amended; nothing else in the runbook changed; amendment consistent with generator and `current-architecture.md` | `git diff --numstat` = **8 insertions / 5 deletions, exactly 2 hunks**: the Revision header (`:3-5`) and the P30 paragraph (`:271-278`). Nothing else. Amendment matches the generator exactly: `scripts/next-target.mjs:92` emits bare `reExports(ACTION_NAMES, "./actions.server")` with no directive; `:93` `import "server-only"`; `:94` `"use client"`; `:97` demo `actions.ts` directive-free. The runbook's remaining `"use server"` mentions (`:274`, `:278`, `:280`) are all correct. No stale "server `actions.ts` starts with `\"use server\"`" claim remains in the runbook or in `docs/*.md`. | **PASS** |

**Independent corroboration of R4-3's factual claims** (not taken on the implementer's word):

- **Error text is real.** `grep -a "Only async functions are allowed to be exported in a"` matches inside `node_modules/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node`, and the string does **not** appear anywhere in `node_modules/next/dist`. This independently confirms the round-2/round-3 adjudication: the check lives in the native SWC binary, not in readable JS, which is why a naive edit + `build:server` self-healed into a false pass.
- **"the five implementation files" is exact.** Exactly five tracked files carry a module-level `"use server";` — `src/app/(professional)/entrar/actions.ts`, `.../portal/adult-portal-actions.ts`, `.../portal/player-access-actions.ts`, `.../portal/sign-out-action.ts`, `src/app/(public-play)/jogar/actions.ts` — and `src/runtime/actions.server.ts:4-24` re-exports from precisely those five.
- **"Verified on next 16.3.6" is accurate.** Installed `next` is `16.3.6`; `16.3.2` is gone from the comment.

**Regression sweep:**

- **package.json ↔ package-lock.json**: `dependencies`, `devDependencies`, `optionalDependencies` mirror with **zero** key or value differences; `name`/`version`/`engines` identical. Zero exact-pin mismatches among root `dependencies`. `@next/env`, `next`, `eslint-config-next`, `@next/eslint-plugin-next`, `sharp` all resolve to on-disk versions equal to their lockfile entries.
- **`sharp`**: not a root dependency (correct — it is `next`'s `optionalDependencies: {"sharp": "^0.35.4"}`), present at `0.35.4`, `optional: true`, not `dev`. Unchanged by this delta.
- **Committed lockfile vs `node_modules/.package-lock.json`**: 923 vs 923 packages; 0 in-lock-but-absent; 0 on-disk-but-unlocked; **0 version mismatches**; `dev` flags agree in **both** directions. All three files share one mtime — a single npm pass produced them, so the lockfile delta is machine-generated, not hand-edited.
- **`.prettierignore` scope**: contains `docs`, `package-lock.json`, `REFACTOR_PLAN.md`, and the three generated entries (see INFO-1).

---

## Findings

### CRITICAL / MAJOR
None.

### MINOR-1 — Literal `\"` escape still present in the sibling document R4-3 was cross-checked against.
`docs/current-architecture.md:266` contained `"Only async functions are allowed to be exported in a \"use server\" file.");` — the identical defect class R4-3 fixed in `scripts/next-target.mjs`, in one of the two documents R4-5 explicitly cross-checks, and because `docs` is in `.prettierignore` no automated gate will ever surface it. **Pre-existing** (present in the round-3 tree), out of the round-4 six-file scope, cosmetic only (CommonMark renders the escape). *Closed post-review by the coordinator: the escape was removed and the tree re-snapshotted (`ca61fcfd`).*

### MINOR-2 — Runbook "Evidence Used" section still cited the superseded Next version.
`docs/refactor-dossier/IMPLEMENTATION-READY.md:512` read "the installed Next.js 16.3.2 guides" while installed `next` is `16.3.6`. Staleness introduced by round 3's deliberate framework bump; narrative, not normative; self-neutralized by the runbook's own "the installed version is authoritative" rule. *Closed post-review by the coordinator: updated to 16.3.6 in the same post-review pass.*

### INFO

1. **The stated rationale for the `docs/` edits being "outside `format:check` scope" is only half right.** `.prettierignore` lists `docs`, but `DESIGN.md`, `scripts/next-target.mjs`, and `package.json` are in scope; they are safe because `.prettierrc.json` sets no `proseWrap` (default `preserve` — Prettier does not reflow Markdown prose), Prettier never reflows comments, and the `package.json` edit is value-only on an already-conforming line.
2. **Every check in this review is static.** The dynamic gates are the confirming signal (round-4 general review: all 13 green).
3. **13 untracked review artifacts sit in the working tree** (round-2/3/4 reports plus a stray `.zcodeignore`). A decision is needed before merge: commit as evidence, ignore, or delete.
4. **Scope creep check: clean.** The delta is exactly the six claimed files. No Fixed Decision violated; R4-1 is a targeted manual pin, not the forbidden `npm audit fix --force`; the runbook contains no normative constraint on `@next/env` and no line-number citations invalidated by the reflows.

---

## READY ASSESSMENT

**Yes — with this delta the implementation is ready**, subject to the inherent release checks that cannot be discharged statically:

1. First real CI run of `.github/workflows/ci.yml`.
2. Branch protection on the exact `gate` job name on `main`, recorded with the run URL.
3. Disposable-database release validation (the only permitted database-connected step).
4. Manual browser smoke against the actual static export at `/SMS_Portal/`.
5. Node-24 CI confirmation — this host ran on Node `22.23.1`, off the `24.19.0` pin.

The two MINORs were pre-existing and cosmetic, and both were closed by the coordinator immediately after this review (2 two-character edits, re-staged; final tree `ca61fcfd4944342967c0266d3bf0f8b314392bdf`).

**VERDICT: PASS-WITH-FINDINGS**
