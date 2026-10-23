# AUDIT — `REFACTOR-DOSSIER.md` correctness (final pre-hand-off pass)

**Audited:** `docs/refactor-dossier/REFACTOR-DOSSIER.md` (636 lines) + `README.md`.
**Method:** every `file:line` carrying a decision consequence opened in the real file; the disputed
numbers re-derived from `reports/` and, where cheap, from the code; three claims reproduced by
execution in scratch copies **outside** the repository (a real `git clone` with `node_modules`
junction-linked, `prisma migrate diff`/`validate` against copied schemas, `prettier --check` on the
dossier's own snippets). Nothing in the repo was modified: `git status --porcelain` after this pass
shows only `?? docs/refactor-dossier/`.
**Bias:** adversarial. What is not listed here was checked and held.

---

## Blocking errors (must fix before hand-off)

### B1 — §4 item 0.3, §9.1, §9.2, §10.1, §14 A-2: `npm run typecheck` **does** pass on a fresh clone. The claim is false, and it is the load-bearing premise of the CI design.

The dossier states as **[V]**: "`npm run typecheck` **cannot pass on a fresh clone** → `ci.yml` must
run a compile step before typecheck, and the audit's suggested ordering
(`architecture-audit-2026-09-23.md:604`) is wrong as written."

**Executed refutation.** `git clone` of this repo into a scratch dir (no `.next` — it is gitignored),
then `npx prisma generate` (exactly what `npm ci`'s `postinstall` does), then
`npx tsc -p tsconfig.json --noEmit --incremental false` → **exit 0, zero diagnostics**.

**Mechanism.** `next-env.d.ts` **is a `.d.ts` file**, and `tsconfig.json:6` sets
`"skipLibCheck": true`. Unresolvable module imports inside a `.d.ts` are not reported. A/B proof on
this repo's TypeScript 6.0.3 with a `.d.ts` importing a missing module:
`skipLibCheck: true` → exit 0; `skipLibCheck: false` → `TS2882 Cannot find module … for
side-effect import`. Lines 3-4 are therefore inert under the repo's own config.

The dossier's source admits it never ran this: `ADJ-03` ends with "**Caveat on F1** — I did not run
`tsc` on a synthetic fresh clone". The dossier promoted an explicitly-untested assertion to `[V]`.

**Consequences to repair (all five are downstream of one false premise):**
- §9.2's order `eslint → **compile to generate .next/types** → tsc --noEmit` costs a full compile per
  PR for a reason that does not exist.
- §10.1's hard edge `0.3 typecheck state ──► 0.4 ci.yml` is not a hard edge.
- §4's Gate ("`npm run check` green on a fresh clone *after* `npm ci` **plus one compile**") overstates.
- §14 A-2 `[V]` is false as written.
- §9.1's row "`npm run typecheck` as a standalone gate … needs a prior compile".

**Replacement text for §4 item 0.3, first bullet:**

> - `npm run typecheck` **does** pass on a fresh clone with no `.next` (verified: real clone +
>   `prisma generate` + `tsc --noEmit --incremental false` → exit 0). `next-env.d.ts` is a `.d.ts`
>   and `tsconfig.json:6` sets `skipLibCheck: true`, so its two `.next/types` imports on `:3-4`
>   produce no diagnostic. **A compile before typecheck is still the right CI order, but for two
>   other reasons:** (i) without `.next/types` the route-config/`params` validators are simply not
>   in the program, so typecheck passes while silently checking less; (ii) item 0.3's stale-validator
>   hazard below makes typecheck *wrong* immediately after §2.2 unless a server compile regenerates
>   them. Cite the audit's ordering (`architecture-audit-2026-09-23.md:604`) as **acceptable**, not
>   "wrong as written".

Also delete the `[V]` from that bullet (use `[S]` → then re-mark `[V]` only against the executed
result above), and change §14 A-2 to: "`npm run typecheck` is **stateful but not order-blocked**:
it passes with no `.next`, and silently skips route-config checking; after §2.2 it needs a
regenerating compile."

### B2 — §7.1 item 3 and §7.2: the nine demo alias targets are **not** `"use client"` modules.

The dossier asserts **[V]**: "all five id-producing `"use server"` files are reachable only through
the `@runtime/*` aliases, **whose nine demo targets are `"use client"` modules**." Read the first
line of each demo target:

| `next.config.ts` demo target | line 1 | `"use client"`? |
| :--- | :--- | :--- |
| `src/runtime/adult-portal-demo.ts` | `import { AdultPortalService } …` | **no** |
| `src/runtime/player-access-demo.ts` | `import { PlayerAccessService } …` | **no** |
| `src/runtime/game-events-demo.ts` | `import type {` | **no** |
| `src/runtime/demo-auth-actions.ts` | `export async function signInAction(): Promise<void> {` | **no** |
| `src/runtime/adult-portal-demo-actions.ts` | `"use client";` | yes |
| `src/runtime/adult-portal-demo-client.ts` | `"use client";` | yes |
| `src/runtime/player-access-demo-actions.ts` | `"use client";` | yes |
| `src/runtime/player-entry-demo-actions.ts` | `"use client";` | yes |

4 of the 8 distinct demo targets (covering 5 of the 9 alias slots) carry **no directive at all**.
This is not pedantry: it is the *opposite* of §7.2(a)'s point, which is that those directive-less
readers are exactly what a client component would drag into the browser graph. The conclusion of
§7.1 (the demo graph is action-free today) survives, but for the correct reason.

**Replacement:** "…only through the `@runtime/*` aliases; **none of the nine demo targets is a
`"use server"` module** — four of the eight distinct files are `"use client"`
(`adult-portal-demo-actions`, `adult-portal-demo-client`, `player-access-demo-actions`,
`player-entry-demo-actions`) and four carry **no directive** (`adult-portal-demo`,
`player-access-demo`, `game-events-demo`, `demo-auth-actions`), which is why the demo graph is
already action-free — and is also exactly the exposure §7.2(a) creates."

### B3 — §9.3 and §11 R-06: the `use-demo-portal.ts` line numbers are wrong, and following them deletes the cross-tab listener — the precise failure the row exists to prevent.

Actual file (`src/components/portal/use-demo-portal.ts`):

```
13      sync();
14      window.addEventListener("adult-portal-demo-change", sync);   ← same-tab CustomEvent
15      window.addEventListener("storage", sync);                     ← CROSS-TAB (the live mechanism)
…
17        window.removeEventListener("adult-portal-demo-change", sync);
18        window.removeEventListener("storage", sync);
```

The dossier says the `storage` listener is at **`:14`** and the `CustomEvent` at **`:13`**. `:13` is
a function call; `:14` is the CustomEvent. An implementer who "keeps `:14`, deletes `:13`", or who
cuts "`:13`" as the same-tab line, **breaks multi-tab demo sync and keeps a no-op call**. (The
error is inherited verbatim from `CRITIQUE-governing-conflicts.md` §1 row "Cross-tab demo sync" and
§4.5, which claim to be "reproduced from the actual files" — they are not.)

**Replacement (both places):** "Cross-tab sync is the **`storage`** listener at
`use-demo-portal.ts:15` (its teardown at `:18`), not the same-tab `CustomEvent`
`"adult-portal-demo-change"` at `:14` (teardown `:17`). `:13` is the initial `sync()` call. The
plan's "retain the cross-tab event" wording invites deleting `:14` — i.e. the wrong one."

### B4 — §6.5: `--shadow-database-url` is not a Prisma 7.9.1 flag. The published CI-gate command cannot run.

```
$ npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma \
    --shadow-database-url "$SHADOW_URL" --exit-code
Error: unknown or unexpected option: --shadow-database-url      (exit 1)
```

The dossier's own §6.4 flag enumeration (which is **correct and complete** for 7.9.1) does not list
it, so the document contradicts itself two paragraphs later. In Prisma 7 the shadow URL is supplied
through `prisma.config.ts` — which §6.5 has already identified as missing
`datasource.shadowDatabaseUrl`.

**Replacement:** delete the flag block and write: "In 7.9.1 there is **no** `--shadow-database-url`;
`migrate diff --from-migrations` reads the shadow URL from config. Add to `prisma.config.ts`:
`datasource: { url: process.env.DIRECT_URL ?? "", shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL }`
(both currently absent), then `npx prisma migrate diff --from-migrations prisma/migrations
--to-schema prisma/schema.prisma --exit-code` (exit **2** = drift)." Keep the "prerequisite, not a
one-liner" verdict — it is right, and the reason is stronger than stated.

### B5 — §8.1: the offline engine's demo gating is cited against the **wrong file**, and the file cited has no gating at all.

§8.1 (marked **[V]**, "Bonus finding worth its own ticket"): "the entire 1,222-line engine is dead
in demo mode — every entry path is gated at `:156`, `:260`, `:500`, `:715`, `:731`".

In `src/runtime/game-offline-sync.ts` those lines are: `:156 export class
OfflineRequestReuseError extends Error {`, `:260 async enqueueActiveTime(`, `:500 if (!factory)
throw new Error("IndexedDB is not available in this browser");`, `:715 put.onsuccess = …`,
`:731 generation,`. **None is a gate.** `grep -n "runtimeMode\|isDemoRuntime\|APP_RUNTIME_MODE"
src/runtime/game-offline-sync.ts` → **zero matches**. The five numbers are, line-for-line, the
`runtimeMode` branches in **`src/components/public/game-host.tsx`** (`:156 if (runtimeMode ===
"demo")`, `:260 if (runtimeMode !== "server") return;`, `:500`, `:715`, `:731`) — plus `:760` and
`:804`. The verdict ("dead in demo, still shipped") is correct; the evidence is filed under a file
that cannot support it, and the follow-up ticket would be written against the wrong module.

**Replacement:** "…dead in demo mode — **every call site is gated in the consumer, not the engine**:
`game-host.tsx:156,260,500,715,731` (also `:760,804`). `game-offline-sync.ts` itself contains zero
`runtimeMode`/`isDemoRuntime` references, so today the dead-code property is a caller-side accident
and any future importer will ship the engine again. That is the ticket."

### B6 — §5.2's `ajuda` row overstates CSS ownership: `textLink` is **not** exclusive to that page.

"If edited, keep the `:34-45` markup — `moduleGrid`/`moduleCard`/`moduleArt`/`textLink` are used
**only** by this page." `styles.textLink` is also used by `organization-detail-screen.tsx` and
`overview-screen.tsx` (**both survivors**) and by `atividades/[id]/page.tsx` (purged). Only
`moduleGrid`, `moduleCard`, `moduleArt` are exclusive. In a dossier whose Phase-3 rule is "assign by
sole surviving owner", publishing `textLink` as ajuda-owned invites moving or deleting a class two
live screens depend on.

**Replacement:** "`moduleGrid`/`moduleCard`/`moduleArt` are used **only** by this page; **`textLink`
is shared** with `organization-detail-screen.tsx` and `overview-screen.tsx` (both survivors), so it
is not ajuda-owned and must not be relocated with them."

### B7 — §13.2 / §7.2(c): "use an ESLint boundary rule instead of `server-only` … no new dependency" — the cited mechanism is not installed, and a path rule cannot express the guarantee being replaced.

`eslint-plugin-import` is absent from `package.json`, `node_modules/` and the lockfile, and
`eslint.config.mjs` contains only `nextVitals` + `nextTypeScript` + `prettier` + `globalIgnores`.
The audit's §8.5 (`:560`) names `eslint-plugin-import`'s `no-restricted-imports` /
`import/no-restricted-paths` specifically. Core `no-restricted-imports` (with `patterns`) needs no
dependency — but neither form can condition on the **importer** carrying `"use client"`, which is
the entire guarantee `server-only` provides. As written the swap is presented as like-for-like and
is not.

**Replacement:** "Use core ESLint `no-restricted-imports` with `patterns: ['@/runtime/*-server',
'@/runtime/readers*']` — **no new dependency**, and it is CI-visible. State the loss: this forbids
*paths*, not *client importers*, so it does not reproduce `server-only`'s guarantee that a Client
Component can never drag a reader into the browser graph; that residual needs either a
`react-server`-layer check or a hand-written rule. (`eslint-plugin-import`, which the audit's §8.5
cites, is **not installed** in this repo.)"

---

## Citation failures

| # | Dossier claim | Cited location | What it actually says | Severity |
| :--- | :--- | :--- | :--- | :--- |
| 1 | nine demo alias targets are `"use client"` modules (§7.1, §7.2) | `adult-portal-demo.ts:1`, `player-access-demo.ts:1`, `game-events-demo.ts:1`, `demo-auth-actions.ts:1` | plain imports / a bare `export async function`; **no directive** | **Blocking** (B2) |
| 2 | `storage` listener at `:14`, CustomEvent at `:13` (§9.3, §11 R-06) | `use-demo-portal.ts:13-15` | `:13 sync();` `:14` CustomEvent `:15` storage | **Blocking** (B3) |
| 3 | `migrate diff … --shadow-database-url "$SHADOW_URL" --exit-code` (§6.5) | Prisma 7.9.1 CLI | `unknown or unexpected option` | **Blocking** (B4) |
| 4 | engine "gated at `:156,:260,:500,:715,:731`" (§8.1) | `game-offline-sync.ts` | those are `game-host.tsx` lines; engine has 0 mode refs | **Blocking** (B5) |
| 5 | `textLink` used "only by this page" (§5.2) | `organization-detail-screen.tsx`, `overview-screen.tsx` | two surviving users | **Blocking** (B6) |
| 6 | "typecheck cannot pass on a fresh clone" (§4 0.3, §9.1, §10.1, A-2) | `next-env.d.ts:3-4` + `tsconfig.json:6` | `skipLibCheck: true` ⇒ no diagnostic; exit 0 verified | **Blocking** (B1) |
| 7 | "`server-only` … `ERR_MODULE_NOT_FOUND` under this Node" (§2, `ADJ-03` F3 says "this repo's own **Node 24**") | `node -v` = **v22.23.1**; `.nvmrc`/`package.json:6` pin **24.19.0** | measurement taken on an unpinned Node. `node_modules/server-only` genuinely does not exist and `next/dist/compiled/server-only` does, so the **conclusion holds**; the reason is "Vite/Node have no Next per-layer alias", not "the package is missing" | Medium — restate the reasoning; drop "Node 24" |
| 8 | "~2-3 days, **~10 files** and 6 new failure modes" (§7.5) | `ADV-2:28` "the generated design is ~2-3 days, **~14 new or rewritten files**" | dossier published 10 where its source says 14 | Medium |
| 9 | "`generateStaticParams` … three agents published 12/4, 11/4 and 5/3" (§14 Q-5) | `ADV-3:381` | the dispute is **12/4 (`VER-A`) vs 5/3 (`INV-A`)**; `11/4/15-total` is `ADV-3`'s **adjudication**, which it labels "Both published pairs are wrong". Independent check: 15 `generateStaticParams` sites in `src` ✓ | Medium — adopt 11/4/15, or say why not |
| 10 | "the four bare `redirect("/portal")` stubs … **four**, not the plan's six" (§5.6) | `REFACTOR_PLAN.md:39-41` has no "six"; the audit says **"3 redirect-stub routes"** at `:153`, `:248`, `:350` | phantom correction attributed to the wrong document. "Four" (files) is right; the conflicting published number is **three** | Medium |
| 11 | "`portal-shell-context.tsx:10-16`" as one of "four places" holding "navigation logic" (§8.4) | that range is `function roleLabel(role: …)` | role→Portuguese-string mapping; no navigation | Low-Med — relabel as "shell label mapping" |
| 12 | "`seeded DEMO_PLAYER_TOKENS` at `:278-305`" (§8.4) | `:140` is `export const DEMO_PLAYER_TOKENS = {` | `:278-305` is the seeded **credential array** that *references* it | Low |
| 13 | "`:149` fixes the role" (§9.3) | `:149` = `activeProfileId: DEMO_PROFILE_IDS.PLATFORM_ADMIN,` | the seed's `platformRole` is at `:155` | Low |
| 14 | "`vitest.config.mts:13` is `environment: "node"`" (§2; also `:13-15` in §11) | `:12` `environment: "node"`; `:13` is `env: {` | off by one | Low |
| 15 | "`isProtectedPathname` (`gateway.ts:48-54`)" (§5.5) | `:48` is `PROTECTED_PATHNAME_PREFIX`; the function is `:50-55` | off by ~2 | Low |
| 16 | "`player-access/service.ts:15`" for a "13-line" `authorizationActor` (§8.4) | function is `:14-26` (`:15` = `return {`) | 13 lines ✓, start line off by one. **Duplication itself verified byte-identical** against `adult-portal/service.ts:49-61` | Low |
| 17 | "`walkthrough.md:40-51` (12 purged routes listed as delivered)" (§9.4) | `:46` = `/portal/turmas/[id]` | **11** purged + 1 survivor | Low |
| 18 | "`status-badge.tsx` (currently 33 lines)" (§5.3) | `wc -l` = **32** | off by one | Trivial |
| 19 | "`INV-A`'s snippet … **82** chars on one line" (§5.3) | 81 chars | off by one; still `> printWidth 80`, so the verdict stands | Trivial |
| 20 | "`(frame-src` at `proxy.ts:68`)" (§5.4) | `:68` declares `frameSources`; the `frame-src` directive is emitted in the array at `:70-79` | supports the claim loosely | Trivial |
| 21 | "`adult-portal-demo.ts:15-21`" shown as one collapsed line (§7.3) | `:15-17` = `getPortalShellData`; `:19-21` = `getPortalOverviewData` | range spans two functions; the one-line form is not in the file. Substance (no `async`, no return annotation, returns a service promise) **verified** | Trivial |
| 22 | "**57** lines naming purge targets" per validator (§4 0.3) | 55 by my regex over `.next/types/validator.ts` | ≈; the decisive numbers (44 refs, 60 errors) are exact | Trivial |

**§5.3 snippet — prettier verdict (executed).** Copied verbatim to `C:\Users\...\Temp\dossier-audit\`
with a byte-copy of `.prettierrc.json`, checked with prettier 3.9.6: **`All matched files use
Prettier code style` (exit 0)**; longest line 75 ≤ 80. The §5.4 `proxy.ts` snippet is also clean
(longest 77). §5.3's "prettier-canonical" claim is **true**. Its import-path choice is also correct:
`status-badge.tsx` lives in `src/components/portal/`, so `./portal.module.css` resolves.

**§6.4's command — executed, and the adjudication is right.** `npx prisma migrate diff
--from-schema "$TMP/from.prisma" --to-schema "$TMP/to.prisma" --script` (the dossier's
**space-separated** form) works on 7.9.1 and emitted the published 8 statements
**byte-identically**: 4 `DROP CONSTRAINT`, 3 `DROP TABLE`, 1 `DROP TYPE "capability"`. Purging the
table's exact ranges yields a 251-line schema; the line-count reconciliation is
23 content lines (the file's 24th is a trailing newline) — the dossier's "publish 23" is defensible
but should say "23 content lines; `wc -l` reports 24". `ADJ-01`'s rejection of `VER-A`'s
"empty script" observation is correct.

---

## Internal inconsistencies

1. **D-3 vs §8.3 vs §13.3 — one decision, three scopes.** D-3 recommends "(b) — ship the
   **1,862-line dead purge**; defer all extraction". §13.3 repeats "1,862 lines of mechanical
   deletion". §8.3's "Ship now" is "**the 1,862-line dead purge … the 19-rule surgery set, and the
   3 orphaned tokens**". The implementer cannot tell whether the 19-selector surgery is in Phase 3.
   → Make D-3/§13.3 read "1,862-line purge + 19-rule surgery + 3 orphaned tokens" (that is §8.3's
   own ship-list) or trim §8.3.
2. **`§8.6` does not exist.** §5.7 step 9 says "Documentation pass (§8.6)". Phase 3 ends at §8.5;
   documentation is **§9.4**. Every other §5.7 cross-reference resolves.
3. **`§` notation is colliding and undefined.** §8.5's title "§7.1 file-size ratchet", §9.1's rows
   "§7.2 / §7.4 / §7.5 / §7.1", and §8.1's "§7.1's 500-line module ceiling" all mean the **plan's**
   §7.x — while §7.1/§7.2 also name the **dossier's** own sections. §1.3 defines only the
   `(INV-A §2, VER-A §0)` form. → Prefix every plan reference with `plan §`; §1.2's "§5–§8 phases in
   order" and D-2's "narrow §7.5's wording" are both unreadable as written.
4. **§1.2 vs §10.2 vs §13.10 — ordering contradicts itself.** §1.2 tells the implementer
   "§5–§8 phases **in order**"; §10.2/§13.10 say "P1 and P2 … may run in **parallel**". The parallel
   finding is the better one (its premise, 0/18, is independently confirmed below) — §1.2 needs the
   exception.
5. **§7.4's spike is invoked for a case it does not cover.** §8.1 step 5 and §13.6 justify
   "no barrel for `game-offline-sync.ts`" with "the unproven re-export hop from §7.4". §7.4's
   unknown is specifically **a server reference with a function-level `"use server"` plus a Client
   Component importer**. `game-offline-sync.ts` exports no actions and is not aliased (ADV-1:65 says
   so explicitly). → Drop the §7.4 citation there; the real reasons are "only 2 importers" and
   "byte-identical re-export buys nothing".
6. **§5.5 vs §11 R-07 assign the redaction-key edit to different phases** ("Phase 3/4" vs "P1
   reveals it"). Same item.
7. **Reader/mutation inventory drifts across sections.** §7.2 "zero of the **15** readers"; §7.7
   "**12-15** build-time data readers"; §7.7 "~**20** mutation handlers" vs §2 "**24** exported
   actions". §12 then freezes "38 specifiers / 24 import sites" (both **exact**, independently
   reproduced) but no reader/handler count is pinned. Publish one number per set.
8. **§10.1's `§2.2 route delete ──► isDemoRuntime trim` under-specifies.** 2 of the 10 purge-side
   occurrences are in `portal-view-service.ts` (**§2.3**); §5.5 says "after §2.2/§2.3". The graph
   edge should read `§2.2+§2.3`.
9. **§9.2's CI order is not the §4 order.** §4 0.4: `format:check → lint → (compile) → typecheck →
   test → build:demo → assertions → build:server`. §9.2: `npm ci → prettier → eslint → compile →
   tsc → vitest → prisma validate → migrate diff → build:demo → build:server`. `prisma validate`
   moves *after* the tests and `migrate diff` is added late; §5.7 step 3 puts the schema/migration
   work **second**, before any deletions. Pick one order and cite it in both places.
10. **§9.2's `vitest run --no-isolate` will not reliably exercise §4 0.2's bug.** §4 0.2 reproduces
    it under `vitest run --no-isolate **--fileParallelism=false**`. With isolation off but file
    parallelism on, `auth.test.ts`'s `afterEach` `delete process.env.APP_RUNTIME_MODE` may not
    precede the dependent file. §9.2's parenthetical ("exercises the ordering bug fixed in §4 item
    0.2") is unsupported; either carry `--fileParallelism=false` or drop the claim.
11. **§11 never names Phase 1b**, while D-5/D-6 (schema/`AuditEvent` rows, blocking "Phase 1") and
    R-15/R-16 are §6 work. Rows should read "P1b" so an implementer scanning phases does not conclude
    the schema phase carries no regression risk.
12. **§10.1 lists an edge with no phase owner.** `seam item 4 → CSS ownership map` is a
    Phase-2→Phase-3 edge, but D-3 removes the Phase-3 CSS extraction it guards, leaving the edge (and
    §7.6's "projection is 95 → 95 +2") pointing at work the dossier no longer schedules.

---

## Unsupported `[V]` marks (should be `[S]` or `[U]`)

`§1.1` defines `[V]` as two independent agents **or** a main-agent reproduction (`ADJ-01/02/03`
qualify). Rows below carry `[V]` on a single source, on a source that disclaims the test, or not at
all.

| Location | Claim | Why the mark is not earned | Disposition |
| :--- | :--- | :--- | :--- |
| §4 0.3 bullet 1 | typecheck cannot pass on a fresh clone | `ADJ-03`'s own "**Caveat on F1** — I did not run `tsc` on a synthetic fresh clone"; one source; and I ran it and it **passes** | **delete / rewrite (B1)** |
| §7.1 item 3 | nine demo targets are `"use client"` | one source, and false (B2) | **rewrite** |
| §8.1 | engine gated at `:156,:260,:500,:715,:731` | cited against the wrong file (B5) | **rewrite** |
| §9.3, §11 R-06 | `storage` at `:14` | `CRITIQUE` + dossier are the same measurement, not two; and it is wrong (B3) | **rewrite** |
| §6.5 | `--shadow-database-url` command | flag does not exist (B4) | **rewrite** |
| §5.2 `ajuda` row | four classes page-exclusive | refuted for `textLink` (B6) | **rewrite** |
| §2 baseline | "26 HTML docs … two independent methods (**VER-F** item 7)" | one named agent ⇒ `[S]` by §1.1 | keep `[V]` only after adding this pass's independent reproduction (104 docs − 78 purged = **26**, exact) |
| §2 baseline | "`@runtime/*` aliases: 9 + 9 … read both files" `[V]` | no agent, no reproduction recorded | trivially true; cite the reproduction or use `[S]` |
| §7.3 | "**8×** `TS2305`/`TS2724` at real call sites" | number appears only in `ADV-2`/`VER-B` prose; not reproducible without the spike | `[S]` |
| §7.5 | "Measured cost: ~5-6 hours, **4 new files** … ~**10 files** and 6 new failure modes" | `ADV-2` says 14 touched / ~14 new-or-rewritten; "4" is a derivation from §7.5's own list | `[S]`, and fix the number |
| §8.3 | "`.printSheet`/`.credentialPrintCard` **whose sole owner** is `player-credential-print-sheet.tsx`" | true for both (verified: 1 usage each) but recorded with no agent | fine as `[V]`-adjacent; add the grep |

Correctly marked: `runtimeMode` 95 [S] ✓, §7.6 bullets [S] ✓, §8.2's "Undocumented coupling" [S] ✓,
Q-1..Q-6 [U] ✓, `ADJ-01/02/03`-sourced `[V]`s ✓ (except B1).

---

## Numbers still unresolved

The dossier claims to have closed the disputed-numbers list. Nine are closed and I reproduced them
exactly; these are **not** closed or are mis-stated:

1. **`generateStaticParams`** — left `[U]` with a fabricated third pair. `ADV-3` already adjudicated
   **11 in deleted trees / 4 surviving / 15 total**; independent count of
   `grep -rc generateStaticParams src` = **15**. Adopt, or state what survives `ADV-3`'s method.
2. **"13 of the 19" (D-5) vs "the 8 dead `ApiErrorCode` members" (Q-3).** Both are real and both are
   right: `errors.ts:6-24` has exactly **19** members; `VER-C` C13 measured **13** with no emitter
   post-purge; `INV-A`'s **8** are the Generation-A-named codes at `errors.ts:14-21`. The dossier
   publishes both bare. Label them: "13 of 19 have no emitter post-purge; 8 of those are
   Generation-A vocabulary (`:14-21`)."
3. **`status-badge.tsx` = 32 lines**, not 33 (§5.3).
4. **Redirect stubs: four (files) / three (audit's route count)** — §5.6's "the plan's six" is a
   number no governing document prints (see citation failure 10).
5. **`runtimeMode` branch sites 95 vs 107 raw occurrences.** Files = 23 ✓; `grep -ro runtimeMode src`
   = **107**. §7.6's "95 → 95 +2" and "~30 of the 95" inherit the ambiguity. Publish the counting
   rule with the 95.
6. **Validators: "57 lines" per file** — 55 by my sweep (44 refs ✓, 60 errors ✓ both exact).
7. **Seam file-count: ~10 (dossier) vs ~14 (`ADV-2`)** — see §7.5 above.
8. **`walkthrough.md:40-51`: 12 routes → 11 purged** (`:46` `/portal/turmas/[id]` survives).
9. **CSS ship-set scope** (D-3 vs §8.3 vs §13.3) — three scopes, one decision.

**Verified and correctly resolved** (no action): 319 classes = 170/91/58 ✓; 1,823 → 1,862 ✓;
26 found / 19 surgery / 7 no-driver ✓; 118 / 94 / 24 / 47 (18 in `@media`) ✓ with definitions;
7,802 = 1,754 + 3,458 + 2,590 ✓; 29.3% and 22.9% ✓; 26,675 = 20,096 + 6,579 ✓; 34,012 ✓;
33→27 files, 284→182 tests, 56/24/13/5/2/2 = 102 ✓ (all executed); 26 docs ✓; 8-of-13 CHECKs ✓;
6 `gen_random_uuid()` defaults ✓; 8 statements / 23 lines ✓; 24/17/0-edge manifest ✓;
23 files / 24 statements / 38 specifiers ✓; 46 files ✓; 44 refs / 60 false errors ✓;
45 of 104 `class="… undefined"` ✓; 9 FAIL / 8 WARN ✓; 68 tokens ✓; 16 exports / 11 consumed /
2 importers ✓; 13 refs + 6 states ✓; 1,222 / 932 / 4,910 / 616 / 1,024 / 104 / 728 ✓.

---

## Commands that will not run

| Dossier location | Command | Failure | Fix |
| :--- | :--- | :--- | :--- |
| §6.5 | `npx prisma migrate diff … --shadow-database-url "$SHADOW_URL" --exit-code` | `unknown or unexpected option: --shadow-database-url` (exit 1) — no such flag in 7.9.1 | set `datasource.shadowDatabaseUrl` in `prisma.config.ts` (B4) |
| §13.2 / §7.2(c) | "ESLint boundary rule … no new dependency", citing audit §8.5 | `eslint-plugin-import` not installed; `eslint.config.mjs` has no boundary rules | use **core** `no-restricted-imports` + `patterns`, and state the lost guarantee (B7) |
| §9.2 | `vitest run --no-isolate` "exercises the ordering bug" | §4 0.2 needed `--no-isolate --fileParallelism=false`; without the second flag the bug is not guaranteed to reproduce | carry both flags or drop the rationale |
| §6.5 | `DIRECT_URL="postgres://user:***@127.0.0.1:55432/caramelito_drift"` | literal `***` in the published command; and the scheme in this repo is `postgresql://` (`prisma.config.ts:4`, `.env`) | show it as a placeholder (`<user>:<pass>`), keep the fail-fast host |
| §6.4/§6.5, any scratch copy | bare `npx prisma …` **outside** the repo root | silently installs `prisma@8.0.0-rc.15`, where `migrate` no longer exists: *"No command registered for `migrate`, did you mean `migration`?"* (this happened during this audit) | add: "run Prisma only from the repo root or via `node_modules/.bin/prisma`; bare `npx prisma` in a scratch tree resolves to Prisma 8 RC, which has renamed the command" |
| §7.4 spike | `npm run build:server` then "delete the spike afterwards" | the spike writes the **shared** `.next` (the dossier's own §4 0.3/§9.2 finding) and leaves the demo-era validators behind; also needs the 4 env vars syntactically valid (`next.config.ts:12-19`) | append "…then re-run `npm run build:server` to regenerate `.next/types` before any later typecheck" |
| §5.7 step 8 / §9.2 | `npm run build:server` then `npm run build:demo` in one shell | both write `.next` (demo **build** does not get `distDir`; only demo **dev** does — `next.config.ts:26-28`), so the manifest assertion must immediately follow the demo build | already stated in §4 0.3 and §5.7 step 8 ✓ — §9.2 should repeat it |

**Commands that DO run, verified:** `npx prisma migrate diff --from-schema A --to-schema B --script`
(space form, exact SQL reproduced) ✓; `--exit-code` semantics "Empty: 0, Error: 1, Not empty: 2" ✓
verbatim from `--help`; the flag list in §6.4 ✓ complete and accurate for 7.9.1;
`prisma migrate deploy --schema …` ✓ valid in 7.9.1; `prisma validate` ✓; `npx vitest run` ✓
(33/284/0); `npx eslint . --max-warnings=0` ✓ exit 0; `npx prettier --check .` ✓ exit 1 on
`REFACTOR_PLAN.md`; `tsc -p tsconfig.json --noEmit --incremental false` ✓ exit 0 (both with and
without `.next` — see B1). No path cited in §5–§9 was missing, except the two the dossier itself
flags (`demo-issuer.ts`, and `src/runtime/offline/` which is a target, not a source).

---

## What the dossier got right that was worth keeping

Deliberately adversarial sampling, and most of it held under execution:

- **The purge really is closed, and really is 46 files / 7,802 lines.** I rebuilt the 46-file set
  independently from `plan §2.2/§2.3/§2.4` (22 tree files + 18 + 6), reproduced
  1,754 + 3,458 + 2,590 = 7,802, and then **deleted those 46 files in a real scratch clone** with
  zero edits: `tsc` returned **exactly one** error —
  `src/components/portal/status-badge.tsx(1): TS2307 Cannot find module
  '@/server/services/portal-view-service'` — verbatim as §5.1 claims. The headline [V] is real.
- **§5.2's two plan corrections are both right and both consequential.** `ActivityStatus` has four
  members at `portal-view-service.ts:9`, so "prune three" genuinely leaves `"Encerrada"` binding the
  deleted file. And `proxy.ts:109-116` really does remove the `const referrerPolicy =` head (`:112`),
  the live `/jogar` arms (`:114-115`) and `? "no-referrer"` (`:116`) — "delete **line 113** only" is
  correct and compiles. The `frame-src` (`:68`) / `matcher` (`:137`) / print-sheet (`:22-24`) support
  is exact, and the warning that `proxy.test.ts` cannot catch a bad edit is honest.
- **§5.3 is the best page in the document.** Snippet is prettier-clean (verified: max line 75, exit
  0), all ten `recordStatusLabel` call-site line numbers are exact (`class-detail 67,143`;
  `classes 147`; `organization-detail 134,181,225`; `organizations 157`; `overview 174,220`;
  `team 341`), the three class definitions are at `:1038/:1058/:1073` as printed, and the `.toast`
  refutation of `INV-A` is correct — `demo-action-button.tsx:33` really does use it and §2 does not
  delete that file.
- **§6 is materially better than the plan it audits.** Every `schema.prisma` range in §6.2 is exact
  at HEAD, including the unlisted `:97`; I reproduced the `P1012` message **verbatim including
  `--> schema.prisma:84`** and its "renumbered by the deletions above it" annotation; the published
  SQL came out byte-identical; `ADJ-01`'s tiebreak was correct and the space-form flag works; the
  "no fifth residue" sweep and the *stronger* `RateLimitBucket` claim ("nothing in this repository's
  entire history ever read or wrote it") both check out — `git log --all -S rateLimitBucket -- src`
  is empty.
- **§7.1's E625 conclusion is right, and independently confirmable from the committed tree.** The
  on-disk `server-reference-manifest.json` shows **17 node / 0 edge** ids distributed exactly as §2
  predicts (1/1/10/4/1), with `portal/atividades/actions.ts` and `entrar/recuperar/actions.ts`
  registering **zero** — so the purge buys no E625 safety, as claimed. The 5 id-producing `"use
  server"` files have **zero** non-alias importers. `export/index.js:357-384` is the exact throw site
  and checks `type === 'server-action'`. Committing `out/` (104 docs, incl. 52 `atividade/*` pages) is
  itself the proof that today's demo export already succeeds — the dossier could have cited that and
  did not.
- **§8.3's print-hash regression is real, and the block is structured exactly as described.**
  `:4355-4391` is `@media print { :global(body) > * { visibility: hidden } … .printSheet … 
  .credentialPrintCard … }`, and both hashed classes have exactly one owner. This is the single most
  valuable finding in the dossier and it is sound. D-3's "defer the split" follows from it.
- **§4 0.1/0.2 are dead-on and cheap:** `format:check` is red on `main` on exactly one file
  (`REFACTOR_PLAN.md`), `.prettierignore` contains the four entries named, `package.json:24` does run
  it first, and `auth.test.ts:161-165` does `delete process.env.APP_RUNTIME_MODE` under a config that
  injects it. `44` refs × 3 validators → `60` false `TS2307` reproduced exactly, and the
  demo-build-shares-`.next` subtlety (`next.config.ts:26-28`) is correct.
- **§10.2's refutation of the plan's own ordering rationale is true.** I recomputed it from scratch:
  18 alias targets (17 distinct files), intersected with the independently-built 46-file purge set →
  **0**; `next.config.ts:47` → `entrar/actions.ts`, a survivor; and the plan's "20 of the 23" CSS
  overlap is really 9. P1 ∥ P2 is safe.
- **Provenance discipline.** All 25 audited single-line `file:line` cites outside the failures above
  resolved, the audit-document references (`:549-563`, `:604`, `:626-628`, `:685-687`, `:696`,
  `:725-727`, `:744-746`) all point at what is claimed of them, and the `[S]`/`[U]` marks are used
  honestly in §7.6, §8.2 and §14. The report index and per-report line counts are accurate.

**Net assessment.** The dossier's *measurements* are unusually solid — of ~120 numbers and line cites
I checked, only the ones listed above fail, and the purge-closure headline survived an independent
execution. Its *weakness is in §4 0.3 and §7's mechanism prose*: one untested premise (B1) that
propagated into five places and a `[V]` mark, plus three wrong-file/wrong-line citations (B2, B3, B5)
in exactly the sentences an implementer would execute literally. All seven blocking items are
text-level fixes; none invalidates a phase.
