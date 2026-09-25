# Phase 40 — Decomposition of the oversized modules

**Goal.** Cut the four remaining god files to the sizes the evidence supports, ship the dead-CSS purge,
and refuse — with the measurement that decides each — the splits the plan asks for that this tree
cannot pay for. The refusals are deliverables: each carries its number and its re-open condition.
**Depends on.** Phase 0 (dossier §4, esp. 0.1 — `format:check` is red at `e5aaf1e` on
`REFACTOR_PLAN.md`); Phase 1 purge (§5, §6) — every CSS count below is a post-purge count; Phase 2
seam (§7) — `game-host.tsx:24` holds a live `@runtime/*` alias the seam repoints (`:23` is a
`@/application` type import; the engine import statement runs `:26-31`); human answer
**D-3 = (b)** (§3).
**Blocks.** Phase 50 (gates/CI, §9), which inherits this phase's two scripts, its boundary red set and its
selector baseline — the last of those must be handed as the **post-purge** list, not the 90-name one
(Handoff notes); any later per-screen stylesheet extraction; the `game-host` hooks ticket.

**Count labelling — canonical here and never re-justified below.** **Pre-purge** = `e5aaf1e` with
Generation A on disk; **post-purge** = the tree this phase ships into; an unlabelled count is a defect.
Tests: **27 files / 182** post-purge, 0 failed, `[V]` vs **33 / 284** pre-purge `[S]`, both from `VER-A`
N5's executed `npx vitest run --reporter=json`; static `it(`/`test(` blocks — stated as static, never as a
run — **229** pre (**234** counting the 5 `it.each` call sites, which expand at runtime) and **127** post.
Selector baseline **90** pre → **190** post → **41** residual after step 3, derived at step 2.

**Entry gate.**

- [ ] `git rev-parse --short HEAD` → purge + seam merged; `ls src/components/portal/activity-mark.tsx` → `No such file`. If Generation A is on disk, stop: every CSS number here is wrong.
- [ ] `npm run format:check` → exit 0. Measured exit 1 at `e5aaf1e` on `REFACTOR_PLAN.md`, which is fixed input, so the fix is `.prettierignore` (§4 item 0.1), not a reformat.
- [ ] `npm run lint` → exit 0 (`npx eslint . --max-warnings=0` → 0, `RV-40` row 2; re-run in this pass:
  `npx eslint src/components/public/game-host.tsx` → **exit 0, zero messages**). **What that 0 does not certify:** Refusal 1 — `react-hooks/refs` does not run on `game-host.tsx` at all on this tree, so lint-green is not evidence of hook correctness anywhere in this file, and a plugin patch can redden it with no refactor at all.
- [ ] `npm test` → **27 / 182 post-purge** (labelling note above). ~~`npm test` → `33 passed` files / `229` tests (counted statically: 33 files in `tests/unit/`, 229 `it(` blocks; the suite was not executed while writing this)~~ — **refuted as written**: a pre-purge *file* count glued to a static *case* count, printed as the output of a command that had not been run, on a gate whose own precondition is the purged tree — so it expected 57 tests that Phase 1 deletes.
- [ ] `grep -c fake-indexeddb package.json package-lock.json` → `0` `0`. Step 5 fixes it.
- [ ] Step 1's anchor table returns its stated hits. Line numbers in this file are from `e5aaf1e`; the purge and seam shift the tree.
- [ ] D-3 answered. Without an answer steps 3-4 do not run; steps 5-12 still do.

## Scope

**In scope.** `src/runtime/game-offline-sync.ts` (1,222) · `src/components/public/game-host.tsx`
(932) · `src/components/portal/portal.module.css` (4,910) · `src/application/adult-portal/service.ts`
(616) and its `authorizationActor` clone in `player-access/service.ts` ·
`DemoAdultPortalStore.transaction` · the two scripts that make the refusals enforceable.

**Out of scope — reason and who decides.** *Per-screen CSS extraction* (`plan` §4.1 items 2-4): Refusal 4;
reopening is a D-3 answer, not an implementer's judgement. *The hooks split* (`plan` §4.3 items 1, 2, 4):
Refusals 1-2 — it needs a DOM test environment that does not exist, and the owner of `vitest.config.mts`
decides when one is bought. *`REFACTOR_PLAN.md` §4 and `docs/refactor-dossier/**`*: fixed input. *The
`no-restricted-imports` rule itself* (§13.2, D-7): Phase 50 owns it, step 12 records its red set. *Named debt
(§8.5):* `src/runtime/adult-portal-demo-store.ts` (1,024 lines, no §4 step).

## Work order

**1. Re-anchor before editing anything.**

| Anchor command | Must return |
| :--- | :--- |
| `grep -n "receiveRef.current = receiveGameMessage" src/components/public/game-host.tsx` | 1 hit; 3 statements (`receiveRef`, `bootstrapRef`, `synchronizeRef`) |
| `grep -n "@media print" src/components/portal/portal.module.css` | 1 hit; block is 6 rules, 36 lines wide |
| `grep -n "DATABASE_VERSION = 3" src/runtime/game-offline-sync.ts` | 1 hit at `:24` |
| `grep -n "function authorizationActor" src/application/*/service.ts` | 2 hits |
| `wc -l src/application/adult-portal/service.ts src/components/public/game-host.tsx src/runtime/game-offline-sync.ts src/components/portal/portal.module.css` | 616 / 932 / 1,222 / 4,910 |

**If it fails:** the tree moved — re-derive the region from the anchor and record the delta in the PR
body; never apply a range blindly. **Paths, corrected against the tree:** the stylesheet is
`src/components/portal/portal.module.css`, **not** `src/styles/portal.module.css`.

**2. Selector-integrity oracle — PRECONDITION for steps 3-4.** New
`scripts/css-selector-integrity.mjs` + `tests/unit/css-selector-integrity.test.ts` + a
`--css-dir` fixture. Zero new dependencies: `postcss` is transitive-only (`npm ls postcss` → under
`next@16.3.2` and `vite`, undeclared in `package.json`), so importing it makes the gate rot the day
Next stops depending on it. Two rules:

- **A1 (hash ownership).** For each `src/**/*.module.css` file `F` and each class named in a selector
  of `F`, some importer of `F` must apply it. Resolve the **local binding name**, not the literal `styles`:
  `src/components/portal/team-screen.tsx` binds two stylesheets under two names (`styles` and `teamStyles`,
  used 6× — line-by-line bindings in the Evidence table), so a literal `styles.`-only scan credits the portal
  import (26 `styles.` uses) and reports **`team-screen.module.css`** with 0 applications: **6 false-red names
  out of that file's 6**, and a repo total of 96 instead of 90 (`STYLES-ONLY team-screen.module.css
  importers=1 unapplied=6`, `RV-40` §1.2 — `[V]`, this file's parser and a different engine agree).
  ~~"a `styles.`-only scan reports that file with 0 importers"~~ — inverted target: the zero-importer artifact
  is the *stylesheet*, not `team-screen.tsx`. Treat ``<binding>[`…`]`` as "may apply any class" — both such
  sites are in portal and both die in Phase 1, which is one reason the baseline moves (see below).
- **A2 (print pairing — the R-01 tripwire).** `@media print` must share a file with the
  `.printSheet` / `.credentialPrintCard` rules, and `data-player-print-active` must appear in that
  stylesheet and in exactly one exported TS constant (no constant exists yet; today the literal is at
  **4** sites: `player-credential-print-sheet.tsx:99`, `:101`, `:104` and `portal.module.css:4365`).
  ~~today hardcoded 3×~~ — `:104` was the missed third attribute site, already listed in this file's
  Evidence table. A 4-of-4 requirement is what makes the constant a *consolidation*, not a rename.
  <!-- COMPAT: teachers printing QR cards instead of blank paper -->

Baseline, **state-labeled** per the note above. **Pre-purge, `e5aaf1e` with Generation A on disk** `[V]`
(this file's brace-walker, re-derived independently by `RV-40` §1.2 with `postcss.parse`: 63+23+4=90, union
**415**, shared **22**, all three exact): 6 module files, 415 distinct names repo-wide; `portal.module.css`
named 319 / unapplied **63** (58 real + 5 `tone*` reached only dynamically) · `marketing.module.css` 35 /
**23** · `public.module.css` 54 / **4** · results, team-screen, error 0 → **total red set 90 names**.
**Post-purge — the tree this gate ships into** `[S]` (`RV-40` §1.2's re-run with the 40 Phase-1-deleted
importers removed from the importer sets; **not reproduced here** — step 2 re-derives it on the branch):
portal **149** · marketing **23** · public **18** → **190 names**. Both computed-access sites
(`activity-mark.tsx:22`, `materials-explorer.tsx:92`) die in Phase 1, so the "may apply any class" escape
hatch is gone post-purge — part of why the number moves. Ship A1 as a **ratchet** over the post-purge list,
not a zero-tolerance gate: baselined at 90 it is red on **100 additional names** the moment Phase 1 lands,
i.e. red on arrival on the very tree it installs into. `phases/50`'s gate inventory inherits "baseline 90"
from this file; the handoff re-issues it. The arithmetic closes after step 3: portal's 190-share (149
unapplied post-purge) *is* step 3's delete set, so the residual red set at exit is marketing 23 + public 18
= **41 names, grandfathered by name**, and `portal unapplied: 0` is step 3's Verify restated post-purge.

```js
// PROPOSAL — core of scripts/css-selector-integrity.mjs (not applied until step 2 runs)
// walk braces tracking at-rule vs style-rule context; classesNamed[F] = every `.x` in a SELECTOR of F
// classesApplied[F] = union over importers of F of `<binding>\.x` and `<binding>["x"]`, plus "any" when
// `<binding>[\`` appears (binding name from the import statement); exit 1 for the set difference that
// is not in the baseline the registry ships with, or when @media print and .printSheet's definitions
// share no file. The baseline file records WHICH TREE STATE it was cut from and prints it in the failure
// message (labelling rule above): an unlabeled baseline is the defect, not the fix.
```

**Verify:** `npx vitest run tests/unit/css-selector-integrity.test.ts` → 1 passed; and the red case
exists: `node scripts/css-selector-integrity.mjs --css-dir
tests/fixtures/css-integrity/misplaced-print` → **exit 1**, naming `printSheet` as selected inside
`@media print` and defined nowhere in that file. Without the fixture, A2 is a test that cannot fail.
**If it fails** on the real tree with anything but the baseline for the tree state you are standing on,
the parser is wrong —
`:global(…)`, `:not(.x)` and descendant subjects all produce false reds (my first attempt reported a
spurious 9, e.g. `.teamTable`, legitimately ancestor-only at `:2285`). Fix the parser; do not narrow
the rule to `portal.module.css`.

**3. Purge the dead CSS. No split.** In `portal.module.css`: delete the **149 removable classes**
(91 purge-dead + 58 never-referenced — **not** "170"), = **1,862 block-deletable lines** (289 all-dead
rules for 1,823, plus 7 mixed rules with no live driver for 39: `:3347, :3351, :3428, :4582, :4823,
:4842, :4878`), apply the **19-rule surgery** set (`:1125, :1406, :1810, :2547, :2600, :2722, :2727,
:2827, :3559, :3574, :3586, :3591, :3610, :3616, :4715, :4797` …), and drop the 3 orphaned tokens from
`src/app/globals.css`. **Ordering constraint no report states:** `--purple-dark` (`:15`) /
`--purple-light` (`:16`) are consumed **only** by `.tonePurple` (`portal.module.css:998-1001`; the first
pass cited `:997-1001`, and `:997` is blank),
reachable **only** through the dynamic sites `src/components/portal/activity-mark.tsx:22` and
`materials-explorer.tsx:92`; `--radius-micro` (`:53`) only by `:904`/`:2212`/`:4597`, all removable. So
JSX sites die (Phase 1) → then `.tone*` → then the tokens, or the token deletion is an orphan artifact.
**Divergence Δ1 vs fixed input, booked here because nothing else books it:** `plan` §4.1 item 1 credits
"Purging Generation A eliminates **1,567** physical lines of dead CSS" across "**308** distinct classes", while
`phases/10` states its purge deletes **zero** CSS — so the volume migrates into this step silently, at **1,862**
lines (a **+295**-line deviation) with a class census of **319**, 11 above `REFACTOR_PLAN.md:150`'s 308. Neither
gap is reconciled by any source `[U]`: the plan states neither its counting method nor its rule/class boundary,
and this step's 319 is a selector-name count. Deviating is correct — the lines are portal's rules and Phase 1
deletes TS/TSX and route trees — but a deviation with a number attached is booked as one.
**Verify:** `wc -l src/components/portal/portal.module.css` → ≈**3,048** post-step-3 (4,910 − 1,862; the
4,910 is the `e5aaf1e` count and Phase 1 does not move it, which is the one CSS number in this file that is
state-independent);
`node scripts/css-selector-integrity.mjs --report` → `portal unapplied: 0`; `git diff --stat` →
deletions only, 0 insertions on selector lines in the print block; `npm run build:demo` → 0.
<!-- COMPAT: every printed QR card, and the 4-8 sidebar controls that read --focus-ring-color -->
**If it fails:** a surviving `styles.X` for a deleted `X` is purge over-reach — restore that one class,
do not weaken A1. `--focus-ring-color` is **not** app-wide (declared inside `.sidebar`,
`portal.module.css:6-7`; consumed at `globals.css:120`; `.sidebar` at `portal-shell.tsx:49` is a
**sibling** of `.workspace` at `:81`), so it travels with `.sidebar`, never into a shared token block.

**4. Manual print verification — the only automated-blind check here.** `npm run build:demo`, serve
`out/`, `/SMS_Portal/portal/turmas/demo-turma-3a/` → players → "Gerar credenciais" → DevTools →
Rendering → *Emulate CSS media type: print* → one sheet, 2 columns, QR ≈58 mm, no sidebar; then
**Ctrl+P without clicking print** → **nothing** (`:4365`), i.e. the gate fails closed. Run against the
Pages-shaped build, not `dev:demo`.
**If it fails:** the print block was separated from `.printSheet`/`.credentialPrintCard` (`:4140`,
`:4146`, sole owner `player-credential-print-sheet.tsx:117,134`). Revert step 3 — and if A2 stayed
green, step 2's fixture is not exercising the real rule.

**5. Add `fake-indexeddb` as a devDependency** (`package.json`, `package-lock.json`).
**Verify:** `npm ls fake-indexeddb` → resolves under the root, not `empty`;
`grep -c fake-indexeddb package-lock.json` → ≥2; `npm test` → unchanged for its tree state: **27 / 182**
post-purge (labelling note). Installing a devDependency moves no count; if one moves, the install changed vitest.
**If it fails** (no registry access): **step 6 cannot be written and step 7 does not run** — the
characterization tests are the ones that touch `indexedDB`, so the ruling's T1-T6 have no harness without
this package, and the split is forbidden without coverage: 665 lines / 54% untested = `:493-506`(14) +
`:519-526`(8) + `:528-530`(3) + `:564-627`(64) + `:647-1222`(576). `grep -rn "indexedDB\|IDBFactory" tests`
→ 0 hits; `game-offline-sync.test.ts:35-279` fakes the `GameOfflinePersistence` **port** in memory (245
lines, 7 constructors at `:284, 320, 376, 446, 496, 611, 691`) and never touches IndexedDB.

**6. Characterization tests against CURRENT behavior.** New `tests/unit/game-offline-idb-characterization.test.ts`,
numbered **with the source series it is supposed to reproduce** (`INV-D`'s T1-T6, `reports/INV-D:719-724`),
because this step's numbering is the only thing standing between a reviewer and four silently-lost tests:
**T1** freeze DB name (`:23`), version 3 (`:24`), 5 store names (`:25-29`) and the additive-only
`onupgradeneeded` shape (`:568-603`, every branch guarded by `objectStoreNames.contains`; `oldVersion`
appears nowhere); **T2** `transact` semantics — `succeed` (`:1200-1203`) overwrites **unconditionally —
last-wins**, a `fail` after `succeed` but before `oncomplete` **aborts and rejects** (`:1186-1198`), and
resolution happens only at `oncomplete` (`:1204-1210`); **T3** IDB ↔ port-fake **twin parity** over the 7
scenarios `game-offline-sync.test.ts` already drives (guards S3/S4/S5); **T4** the legacy `eventRequests`
backfill — `INV-D:673` flags this as "**the only idb→canonical edge, the one place the split can create a
bad import**", i.e. the single test that earns its keep in step 7; **T5** conflict coercion; **T6**
`stableJson` key-order determinism, over `createClientEventId`/`sameJson`/`stableJson`/
`eventRequestIdentity` at `:519-562` — the exact block `canonical.ts` inherits; plus **T7** the
session-mismatch guard, which is this file's own addition and is not part of the ruled series.
**Ruling applied — the case this step used to carry is deleted.** ~~**T3** v2→v3 migration over pre-existing
queued rows~~ — `COMPAT-POLICY.md` §6 adopts edit 8 verbatim: "Drop the v2→v3-with-pre-existing-events
characterization case and keep **T1-T6**". The protected population is empty: the offline engine is dead in the
demo behind caller-side gates (`game-host.tsx:156, 260, 500, 715, 731, 760, 804`) and the server target has
never run, so no device holds `missoes-caramelito-game-v1` data to migrate. **The damage was not the one dead
case, it was the renumbering:** adopting it under the label "T3" displaced the real T3-T6 and pushed the count
back to six, so a reviewer checking "T1-T6 kept, per the ruling" sees six labels and four vanished risks — twin
parity, the backfill, conflict coercion, key order — one of which is the only guard on the sole idb→canonical
edge. **T1-T6 above are that series; do not renumber it again.**
<!-- COMPAT: none. Edit 8 was adopted precisely because this case protects no user; the tests that remain protect the split, which is a correctness duty (class C) -->
**Verify:** `npx vitest run tests/unit/game-offline-idb-characterization.test.ts` → **7 green against the
unsplit engine**, and `grep -c "^  it(\|^  test(" tests/unit/game-offline-idb-characterization.test.ts` →
**≥7**, one per T-label, so the series cannot be shortened by relabelling;
`grep -c indexedDB tests/unit/game-offline-idb-characterization.test.ts` → >0.
**If it fails:** the test asserts intent, not behavior — `INV-D`'s own T2c/T2d were born failing that
way (`VER-D` 2c). Rewrite to observed behavior and say so in a comment. If a T-label is missing from the
file, restore it rather than renumbering the rest.

**7. Move the engine into 7 files, no barrel.** New `src/runtime/offline/`: `types.ts` ← `:31-136` ·
`errors.ts` ← `:138-168` (leaf; both sides import it) · `canonical.ts` ← `:519-562` (**not**
`request-registry.ts`: the real registry is the `eventRequests` store, `:28`/`:595-599`, written only
in `enqueueEvent` `:1009-1096`, and it stays with storage) · `idb-database.ts` ← `:23-29` +
`:564-627` + `read`/`write`/`transact` `:1145-1221` (the only file allowed to know name and version) ·
`idb-store.ts` ← `:629-645` + `:648-960` + `:1100-1143` · `idb-event-queue.ts` ← `:962-1098` ·
`sync-engine.ts` ← `:170-491` + `:493-506` + `:508-517`. Delete `src/runtime/game-offline-sync.ts`,
repoint the only 2 importers (`game-host.tsx:26-31` — the live `@runtime/*` alias the seam repoints is the
specifier on **`:24`**, while `:23` is a `@/application` type import — and `game-offline-sync.test.ts:6-16`),
split that test file the same way, and keep all 11 consumed export names identical **as the adopted default,
not as a frozen interface** (§6/edit 8 — rationale in the Interfaces preamble).
<!-- COMPAT: nothing storage-shaped. Edit 8's ruling covers this file: the queued-events half protects an empty population (the engine is gated off in the demo and the server target has never run), so what survives here is class-C correctness — the T1 schema pin — plus the 11 names as a default -->
**Verify:** `npx tsc --noEmit --incremental false` → 0 (the flag matters: `tsconfig.json:16` sets
`incremental`, so a bare invocation rewrites the gitignored `tsconfig.tsbuildinfo` and destroys the
cold/warm evidence `phases/00` records);
`wc -l src/runtime/offline/*.ts | sort -n | tail -1` → ≤**420**;
`git grep -c openGameOfflineStore src` → `game-host.tsx: 2`, `offline/sync-engine.ts: 1` (3 occurrences
today: definition `:493`, import `game-host.tsx:27`, call `game-host.tsx:216`);
`npx vitest run tests/unit/game-offline-sync.test.ts
tests/unit/game-offline-idb-characterization.test.ts` → green; `git grep -n game-offline-sync src
tests` → 0 hits.
~~→ ≤**373**~~ and ~~`git grep -c openGameOfflineStore src` → 2~~ — both wrong against this step's own partition
(per-file ranges in the Evidence table): `idb-store.ts` is **374** lines *before* its own import block, so ≤373
was unachievable by construction; and `openGameOfflineStore` occurs **3** times, two of them in
`game-host.tsx` (import `:27`, call `:216`) — which is what the per-file counts above report.
**If it fails:** an import cycle means `errors` got inlined — restore the leaf. `idb-store.ts` is the one file
the ≤420 ceiling can catch: if it crosses it, cut at the store boundary (`:629-645` helpers vs the `:648-960`
CRUD body). **420 governs; the earlier "if it drifts past 500" tolerance is deleted** — two numbers in one step
means the implementer uses whichever one they need. Never except a file this phase created.

**8. `game-host.tsx`: ship the honest ceiling, not the hooks split.** Move the module-level types and
pure helpers `:48-101` (54 lines) → `game-host-model.ts`; the JSX `:837-931` (95 lines) →
`game-host-chrome.tsx` (≥10 props — the 8 usually listed omit `lastHostMessage` and the `:870-901`
ternary); add `src/components/public/game-sync-presenter.ts`, a pure `queue state → banner/status
view-model` function with no DOM (precedent for a `.ts` in `components/` covered by a node test:
`player-credential-printing.ts`). Fix the protocol drift: `demo-game-adapter.tsx:16-20` builds
`game.ready.v1` as an `as const` literal with `supported_protocol_versions: [1]` — route it through the
schema helper with `PROTOCOL_VERSION` / `STATE_SCHEMA_VERSION` (`contracts/v1/schemas.ts:4-5`); and
`game-host.tsx:652` hardcodes the numeral in the diagnostic string while its sibling `:668-669`
interpolates the constant. Leave `:753-757` untouched. Add cross-reference comments for the duplicated
`100` (`game-host.tsx:333` ↔ `game-offline-sync.ts:403`, now `offline/idb-event-queue.ts`) and the
two-level idempotency (`savedReplies` ⇄ `eventRequests`).
**Verify:** `wc -l src/components/public/game-host.tsx` → **≤700** (floor ≈670); `npm run lint` → 0, which is
**not** hook evidence — Refusal 1's consequence (b);
`npx vitest run tests/unit/game-sync-presenter.test.ts` → green;
`grep -c "protocol_versions: \[1\]" src/components/public/demo-game-adapter.tsx` → 0.
**If it fails:** lint red on `:753-757` means the cut deleted the **bailout site** at `:152`, so the compiler
now reaches `validateNoRefAccessInRender` (mechanism, measurement and the content-not-size proof: Refusal 1).
Do not "fix" the writes, and do **not** restore a hoisted closure to buy the silence back — reinstating the
bailout is suppression wearing the shape of a revert. A red rule is the correct result and belongs in the hooks
ticket, not in this step's diff. Bridge coverage stays 0% either way.

**9. `adult-portal`: navigation into `application/`, guard deduped.** New
`src/application/adult-portal/shell-view-model.ts` with the navigation build (`service.ts:140-195`) and
the role label (`:196-206`), returning `NavigationItemDto[]` / `PortalShellDto` (`types.ts:88-101`)
from `(ActorSnapshot, role)`. New `src/application/authorization/authorization-actor.ts` with one
`authorizationActor`: the clone at `player-access/service.ts:14-26` is **byte-identical** to
`adult-portal/service.ts:49-61` (13 lines each; block sha256 `af59f9b2e981…` for both, computed here) —
delete both copies. **Destination rule:** `src/application/**`, never `src/components/` — that would
create an `application → UI` edge existing **nowhere** today, and `AdultPortalService` already runs in
the browser (`src/runtime/adult-portal-demo-actions.ts:50`). The mapper must not import `@/server/**`
either: declare its return type structurally rather than pulling `V1AuthorizationSnapshot`
(`v1-policy.ts:20-26`; the type is declared at `:20`).
**Verify:** `wc -l src/application/adult-portal/service.ts` → **≤470** (~465 predicted — under §7.1's
500 fail line with no service split); `grep -rn "function authorizationActor" src` → 1;
`grep -rn "from \"@/components" src/application` → 0; `grep -rn "Administrador da plataforma" src` →
**1** (was 3: `service.ts:200`, `portal-shell-context.tsx:13`, `overview-screen.tsx:40`);
`npx vitest run tests/unit/adult-portal-service.test.ts tests/unit/portal-navigation.test.ts` → green.
Manual: `/portal` as each of 3 roles → identical nav and labels.
<!-- COMPAT: the shipped PortalShellDto wire shape and the per-role nav item set -->
**If it fails:** a vanished nav item means the view-model read `activeMemberships[0]` outside the guard that
produced it (`:184`). Do **not** fold the demo rebuild (`portal-navigation.tsx:60-125`) in here — it derives
items from demo state, not an `ActorSnapshot`. `getShell` has **zero** coverage (`grep -rn getShell tests` → 0),
so ship `tests/unit/shell-view-model.test.ts` with this step and treat "green" above as compiling, not verified.

**10. Close the half-built `plan` §3.3 transaction item.** `DemoAdultPortalStore.transaction`
(`src/runtime/adult-portal-demo-store.ts:392-396`) is `return work(this)`;
`DemoPlayerAccessStore.transaction` (`:741-750`) snapshots and restores. Copy the existing pattern
(~10 lines); persistence is already atomic-by-accident, so the residual hazard is `state` staying
partially mutated after a caught error.
**Verify:** a test asserting a mid-transaction throw restores `state` → green, and red when the
`Object.assign(this.state, before)` line is commented out in a scratch copy.
**If it fails:** if the snapshot breaks cross-tab sync you cloned where you should have reassigned in place —
keep the `readonly state` identity stable. Cite it as a **demo property**, not as a register row: §6/edit 6
removed `R-06` into §9.3, next to the `storage`-vs-`CustomEvent` fix at `use-demo-portal.ts:13-18` that this
warning actually rests on (class C). `phases/50`'s revised register is the authority for live handles.

**11. Ship the size ratchet as a ratchet — and make the excepted branch able to fail.** New
`scripts/size-ratchet.mjs` + written exception registry. Budgets (`plan` §7.1 / audit `:744-745`): component
250/400 · module 300/500 · CSS 300/600 · test 400/800. Rule: **new** files under their fail line; **pre-existing**
files this branch modifies strictly smaller than their merge-base **and** either under budget or listed with the
measurement.
**The design as first written was vacuous, and this plan has shipped an unfailable gate before.** For an
excepted name "`<` merge-base" was the *only* surviving constraint and `--self-test` exercised *only* the new-file
branch, so nothing in the design could fail on the branch that governs every file this sprint touches:
`portal.module.css` may regrow 3,048 → **4,909** inside the branch (1,861 lines — precisely what step 3 deletes)
with `size-ratchet`, `css-selector-integrity`, `npm run check` and CI all green. The precedent is the Day-4
"assert no `api/` in `out/`" (`REFACTOR_PLAN.md:236`), diagnosed in `CRITIQUE-governing-conflicts.md` §1 and
still recounted in `phases/00` and `phases/50` two reviews later — and step 2 of this very file concedes the
principle ("Without the fixture, A2 is a test that cannot fail"). Three changes make the weak branch live: **(i)** the registry records,
per excepted file, the merge-base line count **and the size this phase commits to** (`portal.module.css`:
merge-base 4,910, committed target ≈3,048); **(ii)** the check is red when an excepted file exceeds **its
committed target + a recorded tolerance**, not merely larger than merge-base; **(iii)** `--self-test` drives
**both** branches. Invariant: *the exception list shrinks within the sprint* — a 4th entry, or a regrow past a
committed target, is exit 1.
Post-purge census reproduced here two ways: **9 FAIL / 8 WARN** — `portal.module.css 4,910` ·
`game-offline-sync.ts 1,222` · `adult-portal-demo-store.ts 1,024` · `public.module.css 1,017` ·
`game-host.tsx 932` · `marketing.module.css 688` · `adult-portal/service.ts 616` ·
`player-access-workflow.tsx 540` · `team-screen.tsx 411` — 5 of the 9 have **no** §4 step at all. **State:**
post-Phase-1 / pre-step-3, i.e. the list the ratchet inherits, not what it prints at exit — step 3 takes
`portal.module.css` to ≈3,048 and step 7 deletes `game-offline-sync.ts` outright, so 2 of the 9 FAILs are this
phase's own work.
**Verify:** `node scripts/size-ratchet.mjs` → exit 0 listing exactly **3** exceptions
(`portal.module.css ≈3,048>600`, `game-host.tsx ≈670>400`, `adult-portal-demo-store.ts 1,024>500`).
~~exactly 4 exceptions~~ — self-refuting: the 4th name was `service.ts` at step 9's predicted ≈465 = a **WARN**
(300 < 465 ≤ 500), and the same clause says a WARN is not an exception. Reconciled: **modified WARN-band files
are not registry entries** — `service.ts ≈465` and the split test files are held to the stricter reading,
"strictly smaller than merge-base **and** under the fail line"; if `service.ts` later passes 500 it *becomes*
exception 4, which is why the script prints the list rather than asserting a constant.
`--self-test` → **exit 1 on both branches**: (a) a synthetic 501-line **new** module; (b) a registry file whose
scratch copy is **1 line larger** than its committed target. (a) alone is the vacuous design. A ratchet that
cannot go red is a report.
**If it fails:** a new file over budget gets split, never excepted; a 4th exception means the phase is doing
splits this file refuses; **a regrow on an excepted name is a revert, not a registry edit** — if editing the
list is ever the fix, the gate has already lost.

**12. Record the boundary red set; do not switch the rule on.** Measured at `e5aaf1e`:
`src/application/** → @/server/**` = **5** sites — 2 runtime (`adult-portal/service.ts:6-11` →
`canAccessClass`, `canManageClasses`, `canManageOrganizations`, `canManageOrganizationStaff`;
`player-access/service.ts:2`) and 3 **type-only** `LaunchTokenContext` (`game-events/ports.ts:7`,
`game-events/service.ts:3`, `game-state/service.ts:12`), erased at build time, so report the two classes
separately — one sits in a `ports.ts`, i.e. the port itself names an infrastructure type.
`src/application/** → @/generated/prisma/enums` = **10 files**, not the "both services" §8.4 says; surviving
`components → @/server` = 1 (`portal-shell.tsx:4`, type-only); `player-access/service.ts:3` throws **another
aggregate's** error; and 4 `application → application` cross-context imports already exist, so the audit's
`application/** → own context + contracts/v1` table (`:555-559`) needs a shared-kernel allowance before any rule
can land. Cheapest structural fix: `src/server/authorization/v1-policy.ts` is 85 lines with **exactly 3
importers** (the 2 app services + `tests/unit/v1-authorization.test.ts:6-15`) and depends only on `@/generated`
enums — relocating it to `src/application/authorization/v1-policy.ts` deletes both runtime edges and is the only
structural change here that lets the future rule ship green; **necessary, not sufficient** — the 3 type-only
edges, the 10 `@/generated` files and the 4 cross-context imports still need grandfathering, which is what this
step's red-set record is for. Decide with the Phase 50 owner.
**Verify:** `git grep -c "from \"@/server/" src/application` → 5 (3 after a relocation);
`git grep -ln "from \"@/generated" src/application` → 10; `npm run lint` → still 0 (rule not added; that 0
measures import hygiene plus whatever the hook rules happen to analyse — Refusal 1's consequence (b)).
**If it fails:** if you added the rule and it is red, revert the rule, not the imports. A boundary rule red on
merged code on its first run gets switched off, not fixed.

## Refusals

1. **`plan` §4.3 items 1, 2, 4 — the `game-host` hooks split. REFUSED — and this file's headline finding,
   corrected against itself.** 13 refs (`:114-129`) + 6 states (`:130-137`) = **19** mutable slots;
   `deliverConflict` (`:233-257`) is on both sides of any bridge/sync cut by definition; a cut leaves
   ≈**11-13 of 19** shared (`VER-D` 4b; `INV-D`'s "15" counted 7 as crossing). **[U]** — a property of a split
   that does not exist, published irreconcilably as ~16 runtime / 21 with-type bindings (`INV-D`) and ~19
   external bindings (`REFACTOR-DOSSIER.md` §8.2), so nothing below rests on it (`INV-D`'s "4 setters" is 3,
   the one checkable piece). No DOM environment exists (Refusal 2), so post-split coverage stays 0%.
   **Delivered instead:** step 8, 932 → ≈670, no hook-order risk.

   **The lint finding — this file's one telling; observation `[V]`, mechanism reversed.**
   `react-hooks/{refs,purity,set-state-in-render}` are severity **2** in the resolved config
   (`npx eslint --print-config`; plugin `eslint-plugin-react-hooks@7.1.1` via `eslint-config-next@16.3.2`,
   eslint 9.39.5) and `npm run lint` is `eslint . --max-warnings=0` — yet
   `npx eslint src/components/public/game-host.tsx` → **exit 0, 0 messages** (re-run in this pass on the
   tracked file, same result). Delete the component's middle (`sed '140,752d'`, 319 lines) and re-lint the
   *identical* statements over `--stdin --stdin-filename` → **3 × severity-2 `react-hooks/refs`** ("Cannot
   access refs during render") at `140:3, 141:3, 142:3`, and the three refs they fire on are declared above the
   cut. Size and line-count are each excluded as the cause over the same harness — the confounder battery and
   its kill-shots are recorded in this file's Evidence row on the bailout.

   ~~**the rule's analysis scales with component size**; **splitting does not move the pattern, it *newly
   exposes* it: the split is born red**; step 8's "you shortened the component enough for the rule to start
   analysing it"~~ — **FALSE AS TO CAUSE, and the true cause is worse.** An instrumented scratch copy of
   `eslint-plugin-react-hooks.development.js` (its top-level `catch (err) {}` in `runReactCompilerImpl`
   turned into `console.error` + an exported `__runCompiler`) shows the full file throwing a **`Todo`
   bailout** — `[PruneHoistedContexts] Rewrite hoisted function references`, reported at
   `game-host.tsx:152` — events `{CompileUnexpectedThrow:1, CompileError(Todo@152):1}`, **no `Refs` event**.
   The catch swallows it, so **`validateNoRefAccessInRender` never runs on this file at all**; the cut file's
   events are `CompileError(Refs)×3`. The trigger is a hoisted in-component `function` closing over
   render-scope values — `showProtocolError` at `:152` — content, not size, and non-monotone in it: blanking
   it (**13 lines**, `:141-153`) flips the *untouched* file to refs=3 while blanking `synchronizeQueue`
   (**132 lines**, `:259-390`) leaves it at 0.

   **Two consequences, stated once here; every other site points at these two.** **(a) The three violations
   are latent today, in shipped code.** Not created by the refactor: they sit in `main` unenforced, and *any*
   edit that deletes or moves the `:152` bailout site makes them visible. So "the split is born red, therefore
   do not split" is the wrong shape of argument — **the rule is silently not running on this file**, which means
   "safe to split" was never established and neither was "unsafe". A split's lint result is a coin flip on the
   bailout, not a verdict on the code.
   **(b) `npm run lint` exiting 0 on this tree is an artifact of an unimplemented compiler pass.** Any
   `react-hooks`/`react-compiler` patch that implements `PruneHoistedContexts` turns `:753-757` red on
   `e5aaf1e` with **no refactor and no code change**, and `--max-warnings=0` makes that a CI failure on an
   unrelated PR. Every gate reading lint-green as hook correctness inherits it — in this file the Entry gate,
   step 8, step 12 and the Exit gate; outside it `phases/00`'s CI prerequisites and `phases/50`'s gate
   inventory, which chain `npm run lint` into the merge gate. Cross-referenced **by section, never by line**,
   because both files are moving. **This strengthens the refusal:** the reason to defer the split is not that
   the split creates a violation, it is that nobody can currently see the one already there.
   **Re-open when:** a DOM environment is installed **and** `.test.tsx` files exist (`vitest.config.mts:16`
   collects `tests/**/*.test.ts` only, so buying `jsdom` alone changes nothing) **and** a proposed boundary
   leaves ≤4 single-owner slots per side — **and** re-run this recipe on the post-split file, because "0
   messages" there may only mean the split moved the bailout.
2. **A DOM test environment. NOT BOUGHT here.** `grep -c fake-indexeddb package-lock.json` → 0;
   `node_modules/{fake-indexeddb,jsdom,happy-dom,@testing-library}` → absent;
   `package-lock.json:13636-13637, 13668-13671` are vitest's **unfilled optional peers**. **Re-open:**
   with the test-layering ADR (audit §10.5) as its owner's decision, not a phase-level impulse.
3. **`plan` §4.4 item 2 — 3-way service split + `authorization-guards.ts`. REFUSED (over-fragmentation).** **17** public methods (org 4 / team 5 / class 6 / shell 2; `getShell:121` → `deactivateTeacherAssignment:569`) plus 3 private; step 9 reaches ≈465 lines, already under the 500 fail line, so the split buys nothing the ceiling requires — and the cross-aggregate error import at `player-access/service.ts:3` argues against it independently. **Re-open:** when a second aggregate's callers edit this file routinely, or the method count passes ~30.
4. **`plan` §4.1 items 2-4 — `primitives.module.css` + 4 per-screen modules. REFUSED (D-3 = (b)).** The
   sprint's only *silent* failure mode: class names are hashed per file and `@media print` (`:4355-4391`)
   pairs a **classless** `:global(body) > *` hide rule with `.printSheet` / `.credentialPrintCard`; splitting
   them leaves every sheet hidden with `tsc`, `eslint`, `vitest`, `prettier`, `build:demo` and the 26-document
   count all green (§11 R-01). It also misses its own aim: `VER-E`'s strict partition lands primitives ≈860 and
   residual ≈836, both over 600 — so `plan` §5.2's "Regression Risk: Low / print stylesheets work seamlessly"
   is refuted by the mechanism. Step 2 ships the precondition. **Re-open per screen, only after steps 2 and 4
   are green.**
5. **`plan` §4.2 item 3's name — `request-registry.ts`. REFUSED**; the registry is an IndexedDB store
   that must stay with storage → `canonical.ts` (step 7).
6. **A `src/runtime/offline/index.ts` barrel. REFUSED** — the ruling, not a deviation from it: edit 8 deletes
   the "keep a thin re-export" option for exactly this file. 2 importers, so repointing is cheaper and a
   byte-identical re-export buys nothing (§7.4's re-export hop is irrelevant: no server actions, not alias-reached).
7. **"§7.1 as an absolute ceiling. REFUSED — and the framing corrected.** `plan:246` *already* reads "All new
   or modified files", identical to audit `:744-745`, so there is no ratchet reading left to adopt and §8.5's
   proposal is redundant. The live problem is the reverse: the ratchet binds **by name** every file this phase
   modifies, and three cannot pass after the best cut the evidence supports — step 11's registry is §8.5's
   executable form. Separately, `tests/unit/game-offline-sync.test.ts` (728) is a **WARN**, not a FAIL (400/800):
   the review claim that it breaches §7.1 is wrong and that work item is dropped.
   **Condition on this refusal, newly recorded:** it wins the argument only against step 11's **repaired** gate.
   As first drafted the registry it substitutes for the ceiling was unfailable on the branch governing every
   file this sprint touches (step 11's vacuousness finding), so the refusal traded a ceiling nobody disputes for
   a control that certifies nothing. The verdict stands because step 11 now fails on both `--self-test` branches;
   **withdraw it if that repair is reverted.**
8. **`plan` §4.3 item 3 — "eliminate duplicate handshake code". DELETED as a work item.**
   `demo-game-adapter.tsx` has **0** occurrences of `postMessage`, `addEventListener` or origin checks;
   the only 2 `postMessage` calls are `game-host.tsx:163, 778`; `createBridgeRequestId` already lives at
   `game-bridge.ts:77` and both sides import it. Residual: `:16-20` (step 8). Also out: `plan` §3.3's
   `demo-issuer.ts` item names a file that does not exist, and the helper it names
   (`hashPlayerCredentialToken`, `src/server/security/player-credential-tokens.ts`) imports
   `node:crypto` and cannot run in a browser — R-13, not this phase's call.
9. **`plan` §4.4 item 1's destination — DEVIATION, recorded here because step 9 only argues it inline.** The
   plan asks for the navigation presenter at `src/components/portal/portal-navigation-presenter.ts`; step 9
   ships `src/application/adult-portal/shell-view-model.ts`, and the argument is step 9's destination rule: the
   function returns `NavigationItemDto[]` from an `ActorSnapshot`, so a `components/` home would create the
   `application → UI` edge that exists **nowhere** today (`grep -rn 'from "@/components' src/application` → 0
   `[V]`), and `AdultPortalService` already runs in the browser
   (`src/runtime/adult-portal-demo-actions.ts:50`). Deviating is right; what was wrong is that the other seven
   refusals carry numbers and this one carried none. **Re-open when** a UI-shaped module legitimately needs the
   file — i.e. when it renders something, which it does not.

## Exit gate

- [ ] `npx vitest run tests/unit/css-selector-integrity.test.ts` → green **and** the `misplaced-print` fixture run exits 1.
- [ ] `node scripts/css-selector-integrity.mjs --report` → the red set equals the **post-purge** baseline this branch derived, reduced by step 3's 149 to the **41** residual of step 2's arithmetic (marketing 23 + public 18, `[S]` at authoring time), and the registry header names the tree state it was cut from. An exit-gate box that reads "90" is verifying a tree that no longer exists.
- [ ] `wc -l src/components/portal/portal.module.css` → ≈3,048; `@media print` still in the same file as `:4140`/`:4146`.
- [ ] Step 4's manual print check recorded in the PR body (browser, viewport, and the "Ctrl+P without clicking print → intentionally blank" case).
- [ ] `git grep -n game-offline-sync src tests` → 0; `wc -l src/runtime/offline/*.ts | sort -n | tail -1` → **≤420** (step 7's own ranges put `idb-store.ts` at 374 source lines before its imports; the earlier ≤373 was unreachable).
- [ ] `npx vitest run` → **27 post-purge files + the 5 this phase adds** (steps 2, 6, 8, 9, 10), 0 failed, 0 skipped; `game-offline-sync.test.ts` is split in step 7, so its file count rises and its case count must not (27/182 is the post-purge side of the labelling pair). The characterization file carries **T1-T7**, demonstrably red-able against pre-move code, and the series is step 6's.
- [ ] `wc -l src/components/public/game-host.tsx` → ≤700; `npm run lint` → 0 (**not** hook evidence — Refusal 1); `grep -c "useState\|useRef" src/components/public/game-host.tsx` → still 20 (13 refs + 6 states + import line): no slot moved.
- [ ] `wc -l src/application/adult-portal/service.ts` → ≤470; `grep -rn "from \"@/components" src/application` → 0.
- [ ] `node scripts/size-ratchet.mjs` → exit 0 with exactly the **3** exceptions; `--self-test` → exit 1 on **both** the new-file and the excepted-file branch.
- [ ] `npm run check` → green (needs §4 item 0.1); `npm run build:demo` → 0; `find out -name '*.html' | wc -l` → 26 unchanged (§11.1) — read from a **freshly built local export**, since `out/` is untracked (`.gitignore:7`, `git ls-files out` → 0) and the "26 documents" is a property of the build, not of the commit.
- [ ] Offline ticket exists for Refusal 1 with "DOM test environment exists" in its precondition line **and** the `PruneHoistedContexts` bailout as its opening fact.

## Interfaces that must not change

**Two rows below are no longer constraints — the canonical statement of that ruling; steps 6, 7, 10 and
Refusal 6 point here rather than re-argue it, and §6's other consequences belong to `phases/50`, cited by
section.** `COMPAT-POLICY.md` §6 adopts edit 8, which downgrades "must remain byte-identical" / "must stay
reachable" to **defaults** on the ground that a rename is not silent (it surfaces as `TS2305`/`TS2724` at the
call site, §7.3), and edit 6, which un-freezes the demo `localStorage` key. They stay in this table because the
default is still the right call — it just is not a compat duty, and filing it as one is what made an earlier
revision of this file re-adopt a test case the owner had deleted (step 6's T3 reversal).

| Surface | Constraint | Why |
| :--- | :--- | :--- |
| `GameOfflinePersistence` + the 11 consumed exports | names unchanged — **[default, not constraint]** | 2 importers; 7 tests construct the port. §6/edit 8: a rename is caught by `tsc` at the importers, so this is a preference about churn, not a hazard |
| DB name / version 3 / 5 store names | unchanged, pinned by T1 | rename **plus** version bump silently orphans queued rows; rename alone throws `NotFoundError` loudly (`VER-D` 2a). Class **C** correctness — it outlives edit 8's empty-population argument, because the server target eventually runs |
| `PortalShellDto`, `NavigationItemDto` (`types.ts:88-101`) | shape unchanged | filled by both runtimes; crosses the RSC boundary |
| `data-player-print-active` + `.printSheet`/`.credentialPrintCard` | same file, same names | R-01 — kept in `phases/50`'s revised register, and A2 is its tripwire |
| `styles.X` names in JSX | deletions only, never renames | a rename is invisible to `tsc` and to every gate here |
| `localStorage` key/version `missoes-caramelito:adult-portal:v2` | ~~do not touch~~ **un-frozen** | §6 adopts edit 6: bump `DEMO_ADULT_PORTAL_STORAGE_KEY` to `:v3` and `version: 3` (`adult-portal-demo-store.ts:124,137-138,148`); `readDemoAdultPortalState`'s existing seed fallback (`:347-356`) *is* the migration. The "wipes demo state for existing visitors" rationale assumed a populated storage the demo never accumulated. Step 10 edits this file: if it also touches the seed path, it carries the bump rather than deferring it |
| Reader/mutation specifier names | unchanged — **[default, not constraint]** | 38 specifiers / 24 sites; drift shows at the call site as `TS2305`/`TS2724` (§7.3), which is exactly why §6/edit 8 refuses to call this a compat duty |

## Tests

**Added:** `css-selector-integrity` (+ `misplaced-print` fixture) — the one automated signal in the sprint that
can see a class-level regression, red-able *because* of the fixture; `game-offline-idb-characterization` — the
repo's first tests to touch IndexedDB, the **T1-T7** series enumerated and ruled at step 6 (T1-T2 → S1
store/version drift and S2 phantom "saved", R-11; T3-T6 → S3/S4/S5 twin parity, the `eventRequests` backfill,
conflict coercion, `stableJson` key order); `game-sync-presenter` — first automated signal on the sync banner
view-model, today reachable only through a DOM nobody renders; `shell-view-model` — net-new (role→nav mapping;
`getShell` has **zero** coverage); `adult-portal-demo-transaction` — fails without the restore line;
`size-ratchet --self-test` — **both** branches (step 11), or it proves nothing about the half of the registry
that matters.
**Cannot fail, say so plainly:** every UI assertion — nav rendering, print output, bridge behaviour, the demo
hydration flash and the cross-tab sync (retained as **demo properties** in §9.3; the `R-03`/`R-06` handles were
deleted by §6/edit 6, and dropping them from this sentence would have lost the assertions with the labels).
`vitest.config.mts:12` is `environment: "node"`, `:16` includes `tests/**/*.test.ts`, and there are **0**
`.test.tsx` in either tree state. Even `player-credential-printing.test.ts` (57 lines) tests only the data
helper `cardsForPlayerCredentialBatch` and cannot see class hashing: the one real print gate is a human with
DevTools (step 4).

## Do not touch

`REFACTOR_PLAN.md` (§4 fixed input; it is also what makes `format:check` red — fix via
`.prettierignore`, §4 item 0.1). `docs/refactor-dossier/**` other than this file.
`game-host.tsx:753-757` — the render-scope writes are load-bearing (`:754` feeds the accept/drop decision at
`:699`; `reconnectAndSync` reads `:783`; deps deliberately `[gameOrigin, runtimeMode]` at `:801`) and
**unenforced today** (Refusal 1, consequence (a)): nothing in `npm run lint` will tell you if you break them.
`.desktopNavItem` (`:2538`) — deleting it "fixes" the mobile/desktop nav defect by erasing the concept:
`.mobileNavItem` exists in **0 of 7** stylesheets while `mobile: true` is on all 14 nav items (`service.ts:146,
155, 161, 171, 177, 186, 192` + `portal-navigation.tsx:66, 75, 81, 89, 109, 115, 123`), so the false arm never
runs and 45 of 104 prerendered documents ship `class="… undefined"`. Do **not** invent a `.mobileNavItem` rule
either — that is new styling wearing a fix. ~~R-02~~ — the warning stands, the handle does not: §6/edit 10
removed R-02 from the §11 register (no phase causes it) and `phases/50`'s revised register re-confirms it
mechanically via G7 (`grep -rn "mobileNavItem" src --include=*.css` → 0 files). Cite it as a defect ticket.
`src/server/**` beyond step 12's relocation decision, and `contracts/**` — published wire schemas. The
protection is real; ~~R-16~~ is not its handle (edit 5, adopted at §6, deleted that row for mislabelling
portal↔browser HTTP vocabulary as a GameMaker counterparty). Cite **class B1**:
`contracts/schemas/README.md:85` "Frozen V1 naming" and `:88` "An incompatible rename requires protocol version
2" — B1 was re-verified after an earlier grep wrongly flagged it (§6).

## Rollback

One commit per step, independently revertable. 2 → plain revert. 3 → `git revert` restores 1,862 lines;
never `git checkout` the file, it carries step 3's whole diff. 4 → nothing to revert. 5-6 → revert the
devDependency and delete the file; the engine is untouched until 7. 7 → revert the move commit
(importers were repointed inside it, so no half state is reachable). 8-10 → revert the extraction; the
render-write pattern was never changed. 11 → the *script* is additive, but its registry is not a preference:
a wrong exception is a size claim, and a regrow on an excepted name is caught by the committed target, so the
revert is of the file, never of the list. 12 → measurement only.
**Step 6 is the one revert that deletes a guard:** it takes T1-T7 with it; if the file is edited instead of
reverted, keep the T numbering intact (step 6's ruling note). The compound hazard is 3+4: a blank print sheet
stops the phase and reverts 3 before anything continues.

## Accepted breakage

`tests/unit/game-offline-sync.test.ts` import paths (repointed by design), and the
`src/runtime/game-offline-sync.ts` module path itself — 2 in-repo importers, nothing external.
`--purple-*` and `--radius-micro` go. Marketing and public keep their unapplied class names, grandfathered by
name in step 2 — **23 + 18** post-purge — because Phase 1 deletes importers in `public.module.css`'s population
and this phase owns only `portal.module.css`: not this phase's files, not its call to purge. The dead
activities/materials demo, old `/atividade/<token>` URLs and pre-purge printed cards go too — Phase 1's
breakage; ~~D-4/R-08~~ were deleted by §6/edit 4 and the only surviving duty is B4's residue, deleting
`walkthrough.md:11`. Same for demo deep links to created entities: ~~R-04~~ was removed by §6/edit 6 into §9.3
as a documented demo property, and D-2(a) narrows plan §7.5's criterion — Phase 50's, not this phase's. If step
10 also carries edit 6's `:v3`/`version: 3` bump while it is in `adult-portal-demo-store.ts`, every visitor's
demo state resets once via the seed fallback at `:347-356`; under the adopted ruling that is accepted breakage,
not a hazard, and it must be named in the PR body either way. `game-host.tsx` stays ~270 lines over the
component ceiling and the demo store 524 over the module ceiling: recorded debt in step 11, not split for the
sake of a number.

## Handoff notes for later phases

Phase 50 owns `no-restricted-imports`: hand it step 12's census (5 + 10 + 1 surviving + 4 cross-context) and
the audit's own warning that `eslint-plugin-import` is **not installed** (`:560`, audit B7); if the `v1-policy`
relocation was taken, runtime `application → server` edges are **0** and the 3 type-only ones are the whole
grandfather list. Steps 2 and 11 are CI jobs — **and there is no `ci.yml` in this repo to add them to**: Phase
00 creates it, so both are handoffs into that file's job list, not edits. `ci.yml` must run
`npm run build:demo` **before** any assertion over `out/`, which is not committed (§6/edit 9; the `find out`
evidence is the Exit gate's).
**Three corrections this file hands forward, each of which was wrong here first** — all cited by **section**,
never by line, because the files they point into are moving. **(1)** Phase 50's gate inventory inherits a
selector-oracle "baseline **90**" from an earlier revision of this file: 90 is the pre-purge number and the CI
job installs on the post-purge tree, where the same rule is red on **190** (41 after step 3). Re-issue it from
step 2's baseline before the job lands, or the first run teaches whoever sees it to delete the gate. **(2)** Any
gate that treats `npm run lint` → 0 as evidence of React hook correctness inherits Refusal 1's bailout — say so
plainly in the job description and name the sites listed in that refusal's consequence (b). **(3)** The
`size-ratchet` CI job must run `--self-test` with **both** branches, or CI is asserting the vacuous version of
the gate.
Per-screen CSS extraction should be booked one screen at a time against the now-green oracle, starting with the
27 live classes that have ≥2 consumers. The `game-host` hooks ticket carries Refusal 1's consequence (a) as its
opening fact plus the recipe that proved it (the instrumented `runReactCompilerImpl` catch, the content-not-size
kill-shots), because its premise is no longer "the split creates a violation" but "the violation is shipped and
unenforced". The **11-13 of 19** crossing-slot measurement goes with it marked **[U]**, with `INV-D`'s ~16/21 and
dossier §8.2's ~19 named as the three irreconcilable figures, and with the DOM precondition *including* the
`.ts`-only `include`. Nobody has run the server path end-to-end (Q-6); nothing here touches a database.

## Evidence

Dossier §= `docs/refactor-dossier/REFACTOR-DOSSIER.md` (this row read `docs/REFACTOR-DOSSIER.md`, a path that
does not exist, and every `§` shorthand here resolves through it); `plan` §= `REFACTOR_PLAN.md`; audit =
`docs/architecture-audit-2026-09-23.md`; reports = `docs/refactor-dossier/reports/`. Every row was
re-measured against `e5aaf1e`. Confidence marks per `REFACTOR-DOSSIER.md` §1.1: `[V]` reproduced by two
independent agents or methods, `[S]` single source, `[U]` unresolved. `RV-40` is the refutation pass over
this file and is cited by row where it is the second measurement.

| Claim | Source / measurement |
| :--- | :--- |
| 13 refs / 6 states / 2 effects; `:753-757` load-bearing | `[V]` `:114-129`, `:130-137`, `:759`, `:803`, `:140-752` · `VER-D` 4a-4d · §8.2 · `RV-40` rows 29-30 (all counts exact; `useMemo\|useCallback\|useReducer` → 0). **The "11-13 of 19 crossing" half of this row is `[U]`**: `INV-D` says ~16 runtime / 21 with-type bindings for `synchronizeQueue`, dossier §8.2 (`REFACTOR-DOSSIER.md:439`) says "~19 external bindings (method-dependent)", and a static derivation is impossible for a split that does not exist. The refusal does not rest on it |
| ~~the split is lint-red while today's code is lint-clean **because the component is big**~~ → **the rule never runs on this file** (Refusal 1 carries the argument; this row carries the battery) | `[V]` twice. Observations that survive: `eslint --print-config` → `refs/purity/set-state-in-render = 2`, `exhaustive-deps = 1`; `eslint game-host.tsx` → **0 messages**; `sed '140,752d'` + `--stdin` → **3 × severity-2** at `140:3,141:3,142:3`, plus **37 `no-unused-vars` warnings**. Cause that replaces the size story: `runReactCompilerImpl` throws a **`Todo`** — `[PruneHoistedContexts] Rewrite hoisted function references` at `:152` — and its `catch (err) {}` swallows it, so `validateNoRefAccessInRender` is never reached; events on the full file `{CompileUnexpectedThrow:1, CompileError(Todo@152):1}`, on the cut `CompileError(Refs)×3`. Measured by `RV-40` §1.1 through an instrumented scratch copy of `eslint-plugin-react-hooks.development.js`. Kill-shots, all `[V]`: blanking `showProtocolError` (**13 lines**, `:141-153`) flips the **untouched** file to refs=3; blanking `synchronizeQueue` (**132 lines**, `:259-390`) does not; blanking `receiveGameMessage` (127 lines) flips it, blanking `saveDemoState` (69), `validLaunchToken` (27) or `getOfflineStore` (4) does not; padding the cut body to 933 lines keeps refs=3; injecting duplicate ref writes into the full file yields 0. Confounders excluded over the same harness: 613 padding lines **inside** the body (back to ~930) keep refs=3; 613 module-level lines (file back to 933) keep refs=3; the untouched 932-line file with 613 module-level lines stays at 0; stubbing the deleted `receiveGameMessage`/`synchronizeQueue` changes nothing; the three refs are declared at `:120, :128-129`, above the cut; the cut file still parses as a component, because the rule fires on it. Size is neither necessary nor sufficient. **New measurement, in no earlier report** |
| `npm run lint` → 0 is therefore not hook evidence, and a plugin bump can redden it with no code change | `[S]` — the cause is `[V]`, the forward prediction (an upstream `PruneHoistedContexts` implementation) follows from it but cannot be demonstrated without installing a second plugin version (`RV-40` §6). Carried as a risk to the merge gate, not as a measurement |
| 665 untested = 14+8+3+64+576; port fake `:35-279`; 7 tests; `fake-indexeddb` absent ×3; node env | `[V]` `INV-D:285-298` · `VER-D` 1a-1c · `package-lock.json:13636-13637, 13668-13671` (vitest's unfilled optional peers, re-read) · `vitest.config.mts:12,16` · §8.1 · `RV-40` rows 4-6, 25 (test file **728** lines, so audit `:694`'s "683" is wrong) |
| `succeed` last-wins `:1200-1203`; late `fail` rejects `:1186-1198`; resolve `:1204-1210`; DB `:564-627`; const 100 `:403` | `[V]` read · `VER-D` 2b-2c · R-11 (kept in `phases/50`'s revised register) · `RV-40` row 24 confirms no `settled` guard on `succeed` |
| step 6's characterization series is `INV-D`'s T1-T6, and the v2→v3 case is deleted | `[V]` against the ruling: `COMPAT-POLICY.md` §6 adopts edit 8 verbatim — "Drop the v2→v3-with-pre-existing-events characterization case and keep **T1-T6**". `RV-40` rows 44 + §5.1 establish the damage: the re-adopted case took the **T3** label and displaced twin parity (S3/S4/S5), the `eventRequests` backfill, conflict coercion and `stableJson` key order. `INV-D:673` on the backfill: "the only idb→canonical edge, the one place the split can create a bad import" |
| 16 exports / 11 consumed / 2 importers; 0 `runtimeMode` in the engine; ships dead in the demo | `[V]` `grep -c '^export '` = 16 · `game-host.tsx:26-31` (the `@runtime` specifier is **`:24`**; this row used to say `:24-29`, and `:23` is a `@/application` type import) + test `:6-16` · gates at `game-host.tsx:156, 260, 500, 715, 731, 760, 804` · `out/_next/static/chunks/0pvtinj9q2oay.js` = 46,032 B, referenced by `out/jogar/index.html` · §8.1 · `RV-40` rows 21-22, 48 |
| §8.1's "~162 lines of shared types unallocated" is wrong | `[V]` contradicts its own source `INV-D:131` ("it *is* allocated"); 160+650+60+350 = 1,220 of 1,222. The real defects are the two in the row above: the largest split file exceeds the ceiling this step published, and the unhomed lines are 36 rather than 24 |
| the split's per-file ceiling: assigned ranges sum to 1,186 of 1,222, `idb-store.ts` at **374** before imports | `[V]` arithmetic on this step's own ranges (106/31/44/148/374/137/346) · `RV-40` rows 27-28. So **≤373 was unachievable as written** and the "drifts past 500" fallback contradicted it; 420 now governs. The genuinely unhomed lines are **36** (the shared import block `:1-22` + 14 blank separators), not "24" — `:493-506` and `:508-517` *are* assigned, to `sync-engine.ts` |
| print block `:4355-4391` (6 rules at `:4356, 4360, 4365, 4369, 4381, 4388`); owners `:4140`/`:4146`; attr at **4** sites | `[V]` recount · `player-credential-print-sheet.tsx:97,99,101,104,117,118,134` · `portal.module.css:4365` · `VER-E` #21 · R-01 · `RV-40` rows 13-14, 17: `:4356` is `:global(body) > * { visibility: hidden; }`, `4360` carries `.printSheet,`/`.printSheet *`, and the third attribute site `:104` is in this file's own citation list — the "3×" sentence contradicted its own Evidence row |
| 319 classes = **170 live / 91 purge-dead / 58 never-referenced → 149 removable**; 1,862 lines; 4,910 → 3,048 | `[V]` — three sources now agree: own parser → 319 / 63, `VER-E` #2-4, and `RV-40` §1.3's independent `postcss` classification (**170 live / 86 purge-dead / 63 never-referenced**, same 149 removable, same **289 all-dead rules = 1,823 lines**, plus the 7 mixed rules = 39, total 1,862, 4,910−1,862=3,048). The 86/63 vs 91/58 delta is exactly the 5 `tone*` classes, i.e. one set counted with and without dynamic access. **Correction kept:** the "170 removable / 91 shared / 58 live-only" gloss is inverted; 170 is *live* |
| oracle baseline is **state-dependent**: 90 pre-purge / **190 post-purge**; 415 union; 22 shared; `teamStyles` on `team-screen.module.css` | pre-purge `[V]` (own brace-walker and `RV-40` §1.2's `postcss` engine both give 63+23+4=90, union **415**, shared **22**, i.e. 319+35+54 = 444 with 29 overlaps) · post-purge `[S]` (`RV-40` §1.2's Phase-1-excluded re-run: 149+23+18 = 190; **not reproduced here** — step 2 re-derives it on the branch) · the blind spot is on the **stylesheet**: `team-screen.tsx:31` binds `styles`→portal, `:32` binds `teamStyles`→`./team-screen.module.css`, and a `styles.`-only scan gives that file 6 false names out of 6 (`STYLES-ONLY … importers=1 unapplied=6`), not the 0-importer result this row first claimed for the component · 7 CSS files; 3 orphan tokens and their only consumers; `--focus-ring-color` not app-wide; 68 tokens; the 19 surgery and 7 no-driver rules: own parse — **new**; `globals.css:15,16,53` → `portal.module.css:998-1001`(`:997` is blank — off-by-one), 904, 2212, 4597; `portal.module.css:6-7` vs `globals.css:120` and `portal-shell.tsx:49` vs `:81`; `VER-E` #6-7 (anchors opened). Marketing and public sit outside §8.3's portal-only census, and the delete ordering is stated nowhere |
| 17 methods (4/5/6/2); nav `:140-195`; `authorizationActor` 13 lines **byte-identical**; demo store 1,024 with `:392-396` vs `:741-750`, `token: tokenHash` `:852`, `DEMO_PLAYER_TOKENS` `:140`/`:277-305` | `[V]` own enumeration · sha256 `af59f9b2e981…` for both blocks, re-hashed to `af59f9b2e981c42e094a7cecacaa100c7a6f7017476dfd85283facefa9a7b5b5` by `RV-40` row 35 · §8.4 (says `:278-305`; first hit is `:277`) · `V1AuthorizationSnapshot` is at `v1-policy.ts:20`, not `:21` |
| `application → server` 5 (2 runtime / 3 type-only); `@/generated` in **10** app files; 1 surviving `components → server`; 4 cross-context; `v1-policy.ts` 85 lines / 3 importers / enums-only | `[V]` `git grep` · §8.4 (understates the enums count); the relocation option is **new, not in the dossier** · `RV-40` rows 38-39: 6 `components → @/server` exist today, 5 of them Generation A or `status-badge.tsx`, so **1 survivor** holds, and 5+10+1+4 = **20** sites; the relocation is *necessary but not sufficient* — 3 type-only edges + 10 `@/generated` files + 4 cross-context edges still need grandfathering |
| 9 FAIL / 8 WARN post-purge; 5 offenders with no §4 step; **3** exceptions; §7.1 already reads "new or modified" in **both** documents | `[V]` own two-method census, Generation A excluded per `plan` §2.2-2.4, and `RV-40` row 41's independent census reproduces the same nine files and the same 8 WARNs · §8.5 · `plan:246` + audit `:744-745`. **"exactly 4 exceptions" is refuted by the sentence that printed it**: the 4th name, `service.ts` at step 9's predicted ≈465, is a WARN (300<465≤500) and that same clause says a WARN is not an exception — `RV-40` row 42. And `RV-40` row 43 rates the registry design **VACUOUS-GATE**: an excepted file's only constraint was `<` merge-base, so 3,048 → 4,909 passes; step 11 now records a committed target per name and `--self-test` drives both branches |
| `game-host.tsx:652` is a diagnostic string, not a wire field; the bump fails **loudly** | `[V]` `:642` uses `PROTOCOL_VERSION`; `:668` interpolates `STATE_SCHEMA_VERSION`; only `demo-game-adapter.tsx:16-20` hardcodes wire values · `VER-D` 7 (§8.2's "also hardcodes it" is loose) · `src/contracts/v1/schemas.ts:4,5` — the bare `contracts/` prefix in this row is ambiguous, the repo root has its own `contracts/` tree |
| "`out/` committed" is false; "683-line test file" is 728; 45 of 104 docs ship `undefined`; `mobile: true` × 14; `.mobileNavItem` in 0 of 7 | `[V]` `.gitignore:7` + `git ls-files out` → 0, so the token reaches the site via `deploy.yml`'s build, not a commit (edit 9, adopted at §6 — a wording fix, `main` == `origin/main` == `e5aaf1e`) · audit `:694` · `ADV-3` R1-R2, recounted here · `RV-40` row 50 re-counts all five |
| the 90-name baseline and the 33/229 test pair were **true of a tree this phase does not run on** | `[V]`/`[S]` as above. `VER-A` N5 executed `npx vitest run --reporter=json`: **33 files / 284** tests pre-purge, **27 / 182** post-purge; static `it(`/`test(` gives **229** pre-purge (**234** with the 5 `it.each` call sites) and **127** post-purge — so the printed pair was neither a run nor one state's counts (`RV-40` row 1) |
| `missoes-caramelito:adult-portal:v2`, the 11 export names and the specifier names are **defaults**, not compat constraints; `R-02/R-03/R-04/R-06/R-08/R-15/R-16` are **not** register rows | `[V]` against the ruling: `COMPAT-POLICY.md` §6 adopts edits 4, 5, 6, 7, 8, 9, 10 as written. This file carried four stale handles and one re-adopted deleted case; the register header now says outright that those seven rows "were removed by `COMPAT-POLICY.md`; the register now holds only failures a phase causes in *new* code" (edit 10). R-01, R-10, R-11, R-13 survive — `phases/50`'s revised register is the authority, cited by section |
| `plan` §4.1 item 1's **1,567** dead-CSS lines / **308** classes land here as **1,862** / **319** | Δ1, `MISSING` in `RV-40` row 52: `phases/10` states its purge deletes **zero** CSS, so the plan's CSS volume migrated into this phase with a **+295**-line delta and no refusal row. The two class counts are unreconciled `[U]` — the plan publishes neither a method nor a boundary |
