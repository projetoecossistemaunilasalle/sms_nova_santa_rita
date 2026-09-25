# Phase 40 decomposition — primary audit

**Audit date:** 25 September 2026  
**Primary target:** `C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\docs\refactor-dossier\phases\40-decomposition.md`  
**Related material read:** the Phase 10/30/50 handoffs, `REFACTOR_PLAN.md`, `REFACTOR-DOSSIER.md`, `COMPAT-POLICY.md`, architecture map, and the INV-D/VER-D, INV-E/VER-E, RV-40, RV-X, ADV-1, and ADV-3 evidence chains.  
**Workspace:** `main` at `e5aaf1e2891dbb1804950223eb9f0765e7dbeb65`. The dossier and audit directories were already untracked.  
**Mode:** read-only except this report.

## Executive verdict

**Phase 40 is directionally well chosen but is not implementation-ready as written.** The expensive-looking work is not all necessary: refusing the `game-host` hook split, refusing per-screen CSS extraction, and refusing a three-service split are supported by the code. The offline split, dead-CSS purge, shell view-model extraction, actor mapper deduplication, and demo transaction rollback are also defensible.

The defects are in the executable recipe and its gates:

1. The service extraction, as specified, cannot reach its own `≤470` gate.
2. The `game-host` extraction, as specified, does not account for enough lines to reach `≤700`.
3. The seven-file offline partition overlooks that the assigned ranges are methods of one private class and require an ownership redesign, not a line move.
4. The CSS “19-rule surgery set” prints only 16 anchors.
5. The manual print check asks the user to emulate print media without activating the attribute that makes the sheet visible, so its expected result is impossible.
6. A2 requires a TS constant that no step creates, while the proposed test proves only one negative fixture.
7. The exit test-file count omits both the Phase 30 seam test and the required split of the existing offline test file.
8. Phase 40 and Phase 50 specify competing size gates, and the merge-base branch is not reproducible from a normal shallow CI checkout.
9. A1's computed-access rule contradicts its own pre-purge baseline.
10. The ratchet requires the demo store to shrink, while step 10 grows it.
11. The plan spends heavily splitting IndexedDB code that the existing demo artifact already ships while leaving the demo-bundling decision unowned.
12. The characterization-series count and exit wording do not prove T1–T7 are individually present.
13. The proposed `wc … | tail -1` maximum-file gate actually returns `wc`'s total row.

No source, test, config, stylesheet, generated file, or dossier file was changed.

## Finding count

- **Blocker:** 0
- **Major:** 13
- **Minor:** 9
- **Confirmed sound groups:** 10

## Baseline replay

| Check | Result |
|---|---|
| `git rev-parse HEAD` | `e5aaf1e2891dbb1804950223eb9f0765e7dbeb65` |
| Target line counts | offline 1,222; host 932; portal CSS 4,910; adult service 616; demo store 1,024 |
| Executed Vitest | **33 files / 284 tests / 0 failed / 0 pending**, JSON reporter |
| `npx tsc --noEmit --incremental false` | exit 0; `tsconfig.tsbuildinfo` mtime remained 22 Sep 2026 23:35:26 |
| `npx eslint . --max-warnings=0` | exit 0 |
| Dependency replay | only transitive `postcss@8.5.23`; no Vitest coverage provider, fake IndexedDB, jsdom, happy-dom, or Testing Library |
| Existing export | 104 HTML files; **45** contain a class attribute with literal `undefined` |
| Existing demo bundle | `out/_next/static/chunks/0pvtinj9q2oay.js`, 46,032 bytes, contains `missoes-caramelito-game-v1` |
| Static post-purge replay | excluding Phase 10 consumers, 319 portal class definitions and 149 without a surviving static application |

The executed 284-test result confirms the dossier's pre-purge runtime total. The dossier's “static `it(`/`test(` = 229” wording is not literal: the tree has **229 `it(` declarations**, zero Vitest `test(` declarations, and five `it.each` call sites. The apparent two `test(` grep hits are `.test(` method calls.

## Findings

### M-01 — MAJOR — the specified service extraction cannot satisfy `service.ts ≤470`

**Claim attacked.** Phase 40 step 9 predicts `src/application/adult-portal/service.ts` at about 465 lines and gates it at 470 (`C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\docs\refactor-dossier\phases\40-decomposition.md:256-277`).

**Evidence.**

- The current file is 616 lines.
- The named `authorizationActor` block is 13 lines (`C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\src\application\adult-portal\service.ts:49-61`).
- The navigation block is 56 lines (`:140-195`) and the return/role-label block is 11 lines (`:196-206`).
- Removing exactly those blocks yields `616 − (13 + 56 + 11) = 536`, before replacement imports/calls.
- The inherited 440–470 estimate came from a wider cut: `getShell` + `getOverview` presentation plus five module helpers, not merely navigation and role label (`C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\docs\refactor-dossier\reports\VER-E-css-and-service-verification.md:280-283`).

**Impact.** The step red-lines at about 536. Consequently step 11's “exactly three exceptions” is also wrong: a 536-line modified service is over the 500 FAIL line and becomes a fourth exception, or the implementer must invent an unstated extraction.

**Required correction.** Either explicitly extract all shell/overview presentation helpers, state the exact remaining line budget, and retain the 500-line gate; or narrow the claim to a documented ~536-line service, add it to the exception registry, and stop claiming refusal of the three-service split is what makes the service pass.


### M-02 — MAJOR — the named `game-host` cuts leave at least 783 lines, not ≤700

**Claim attacked.** Step 8 moves 54 model lines and 95 JSX lines, adds a presenter, then requires `game-host.tsx ≤700` (`C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\docs\refactor-dossier\phases\40-decomposition.md:234-254`).

**Evidence.** The two named blocks are `48-101` (54 lines) and `837-931` (95 lines) in `C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\src\components\public\game-host.tsx`. Moving only them leaves `932 − 149 = 783` before the new chrome call site, prop type, presenter import/call, and model imports. At least **83 additional net lines** must leave the host. The phase names no source region for that extraction.

A prior estimate reached roughly 670 only by also moving transport construction (`288-305`), acknowledgement fan-out (`317-340`), and status/alert shaping (`347-367`), followed by realistic import/prop savings (`C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\docs\refactor-dossier\reports\VER-D-runtime-godfiles-verification.md:45`). The revised phase retained the target but dropped the allocation that made it plausible.

**Impact.** An implementer can complete every named edit, add a useful presenter, and still fail the exit gate by more than 80 lines. That invites extra unplanned hook/context surgery—the exact risk the refusal was meant to avoid.

**Required correction.** Publish a complete line allocation: exact blocks moved to model/chrome/presenter, estimated replacement lines, and a conservative target. If transport/ack logic is not intentionally extracted, set the honest target near 700–780 and record it. A presenter test does not substitute for proving the host shrank by the stated amount.

### M-03 — MAJOR — the offline “move” is not mechanically valid across private class methods

**Claim attacked.** Step 7 assigns source ranges to seven files as though they can be moved directly (`C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\docs\refactor-dossier\phases\40-decomposition.md:204-232`).

**Evidence.** `IndexedDbGameOfflinePersistence` is one class beginning at `C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\src\runtime\game-offline-sync.ts:647`. The proposed `idb-event-queue.ts` range `:962-1098` consists of `enqueueResult`, `enqueueActiveTime`, and private overloaded `enqueueEvent`; proposed `idb-database.ts` range `:1145-1221` consists of private `read`, `write`, and `transact` methods. The class has 13 direct calls to `this.read`/`this.write`, at `:655`, `:668`, `:693`, `:746`, `:829`, `:847`, `:890`, `:932`, `:944`, `:1008`, `:1101`, `:1117`, and `:1129`.

TypeScript cannot place methods of one class in separate modules by cutting line ranges. The implementer must redesign ownership: standalone transaction functions taking an `IDBDatabase`, a collaborator object, a base class, or free event-enqueue functions. Each choice changes imports and test seams.

**Impact.** The advertised cheap line move is actually the phase's main internal design decision. It also affects where `openGameOfflineStore` composes storage and how characterization tests instantiate it.

**Required correction.** Add a dependency/ownership sketch before step 7: proposed exports, import direction, and treatment of the 13 calls. Keep the ≤420 line gate, but do not call the operation mechanical until this seam is chosen.

### M-04 — MAJOR — the CSS surgery manifest says 19 rules but prints only 16

**Claim attacked.** Step 3 says “apply the 19-rule surgery set” and then lists starts `1125, 1406, 1810, 2547, 2600, 2722, 2727, 2827, 3559, 3574, 3586, 3591, 3610, 3616, 4715, 4797` (`C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\docs\refactor-dossier\phases\40-decomposition.md:123-140`).

**Evidence.** The verified 19-rule set also includes `:1416`, `:2535`, and `:2617`. Those are real mixed rules:

- `:1416-1420` must retain `.detailPanel` while removing dead `.panel` and `.reportPanel`.
- `:2535-2540` must retain `.sidebar > .brand`, `.sidebarProfile`, and `.desktopNavItem` while removing `.adminNavGroup .navLabel`.
- `:2617-2624` must retain `.portalLoadingGrid` while removing five dead grid classes.

**Impact.** The stated A1 exit (`portal unapplied: 0`) fails if the printed list is followed literally, but the phase's “If it fails” branch tells the implementer to restore a deleted class rather than finish the missing surgery.

**Required correction.** Print all 19 starts, identify the live selector to retain in each, and add a check that no named dead selector remains in those rules. The 1,862-line/3,048-line arithmetic itself remains supported.

### M-05 — MAJOR — the manual print procedure cannot produce its expected “one sheet”

**Claim attacked.** Step 4 tells the operator to generate credentials, emulate print media, and expect one sheet, then separately expects Ctrl+P without clicking Print to show nothing (`C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\docs\refactor-dossier\phases\40-decomposition.md:152-159`).

**Evidence.** The print CSS hides every `.printSheet` lacking `data-player-print-active` (`C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\src\components\portal\portal.module.css:4355-4391`, especially `:4365-4367`). That attribute is set only inside the Print button's `onClick` (`C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\src\components\portal\player-credential-print-sheet.tsx:90-108`). DevTools print-media emulation does not run that click handler.

**Impact.** Following the first instruction correctly yields a blank page, so the manual gate rejects a correct implementation.
**Required correction.** Split the check into two states: use the actual Print button/preview, which sets the attribute, for the two-column sheet; then emulate media or press Ctrl+P without activation and expect blank. Record both, plus viewport and base path.




### M-06 — MAJOR — A2's TS-constant contract has no implementation step and only one negative fixture

**Claim attacked.** A2 requires `data-player-print-active` to be in the stylesheet and exactly one exported TS constant, while noting that no constant exists (`C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\docs\refactor-dossier\phases\40-decomposition.md:79-85`). Step 2 is described only as a script, one test, and a `--css-dir` fixture.

**Evidence.** The current TS has three literal attribute operations at `C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\src\components\portal\player-credential-print-sheet.tsx:99-104`, plus the CSS selector at `portal.module.css:4365`. No source edit assigns those three TS sites to a constant. The proposed fixture only checks a print block selecting `.printSheet` when that class is absent from the file; it does not test the TS constant, `.credentialPrintCard`, or a same-file positive case.

**Impact.** The implementer can make the one fixture go red while A2's other clauses remain unbuilt or untested. “Exactly one exported TS constant” is also not operationally precise unless the phase names the constant and import site.

**Required correction.** Make constant creation/replacement an explicit step, e.g. export `PLAYER_PRINT_ACTIVE_ATTRIBUTE` from the sheet module and consume it at all three DOM operations. Add positive and negative tests for: same-file print pair, missing print pair, missing credential card, exactly one declaration, and zero remaining raw TS attribute literals other than the constant initializer. The existing inline hash binding at `team-screen.tsx:31-32` should also have a fixture because it caused the original false red.

### M-07 — MAJOR — the exit file count is arithmetically impossible

**Claim attacked.** The exit says “27 post-purge files + the 5 this phase adds,” while also requiring `game-offline-sync.test.ts` to be split (`C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\docs\refactor-dossier\phases\40-decomposition.md:451-463`).

**Evidence.** Post-purge is 27 files. Phase 30 adds `runtime-seam.test.ts`; Phase 40 explicitly adds five files at steps 2, 6, 8, 9, and 10; step 7 splits the existing offline test, increasing file count by at least one. The floor is therefore 27 + 1 + 5 + 1 = **34 files**, not 32. Case count also cannot “must not” move if T1–T7 alone add seven cases plus the other new tests; only the seven pre-existing offline cases should remain seven after their file split.

**Impact.** An equality gate on 32 files fails a correct implementation. A case-count equality gate to 182 fails for the intended reason.

**Required correction.** Gate on invariants, not a guessed total: all named files exist; all `*.test.ts` files are discovered; the seven original offline assertions remain seven across their split files; T1–T7 are each present; zero failures/skips. If a count is printed, derive it from the actual final file list.

### M-08 — MAJOR — two size gates are specified for the same control

**Claim attacked.** Phase 40 step 11 creates `scripts/size-ratchet.mjs` with an exception registry and committed targets (`C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\docs\refactor-dossier\phases\40-decomposition.md:291-328`). Phase 50 step 7 independently creates `scripts/check-size-budget.mjs` with `.size-baseline.json` (`C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\docs\refactor-dossier\phases\50-gates-ci-demo-docs.md:228-235`).

**Evidence.** They have different names, registries, and reduction rules: per-exception committed target versus new-violation baseline. Phase 40's handoff says Phase 50 inherits its script, while Phase 50 explicitly says “add” its own.

**Impact.** CI can enforce one and ignore the other, or implementers can maintain contradictory exception sets. The dossier already recognizes this family of double-oracle problem for CSS; repeating it for size is unnecessary scope.

**Required correction.** Choose one implementation and registry. Phase 50 should only schedule and harden the Phase 40 script. The classifier, merge-base/target semantics, and baseline must be shared. The post-purge `9 FAIL / 8 WARN` census is sound, but the script must define whether untouched debt appears in output, a baseline, or neither.

### M-09 — MAJOR — the ratchet's merge-base rule is not reproducible in the planned CI checkout

**Claim attacked.** Modified pre-existing files are judged against their merge-base line count, and excepted files carry committed targets (`C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\docs\refactor-dossier\phases\40-decomposition.md:291-325`).

**Evidence.** GitHub's current deploy checkout uses `actions/checkout@v4` without `fetch-depth: 0` (`C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\.github\workflows\deploy.yml:21-22`). The phase does not require Phase 00's future CI to fetch the base branch/history. A shallow clone may not contain the merge base at all. The phase also does not say how the script behaves on a detached PR head, a base SHA supplied by CI, or a missing/deleted registry target.

**Impact.** The most important branch can fail closed for missing history, or be implemented by skipping the comparison. `--self-test` with a synthetic file does not exercise Git graph discovery.

**Required correction.** Supply a base SHA (`${{ github.event.pull_request.base.sha }}` or an explicit env), use `fetch-depth: 0` or fetch that SHA, and make missing base/merge-base an error. Add self-tests for missing history, detached head, and deleted excepted file, or remove Git from the hot path by committing immutable base line counts per path.

## Confirmed sound decisions and measurements

1. **Dead CSS direction and count.** The current portal sheet has 319 class definitions. After excluding the Phase 10 importer set, an independent static replay found exactly 149 unapplied names. The inherited 1,823 all-dead lines + 39 block-deletable mixed lines = 1,862 and `4,910 − 1,862 = 3,048` are credible. The print classes are not in that set.
2. **CSS extraction refusal.** The blank-print mechanism is real: CSS Modules hash class names per file, the global hide at `portal.module.css:4356` is coupled to print-sheet classes, and the existing build is green despite current `undefined` classes. Refusal 4 should stand after the manual procedure is corrected.

3. **Post-purge selector ratchet need.** A1 should be based on the post-purge tree. The phase correctly replaces the old 90-only baseline with a derived post-purge baseline and a 41-name residual outside portal. A1 plus Phase 50 G7 are complementary, not interchangeable.

4. **Offline split value.** The current god file has only two import statements, 16 exports, 11 consumed export names, no module-level mutable state, and a clearly separable public engine plus IndexedDB adapter. A seven-file cap is justified once the class-ownership seam is designed.

5. **Offline characterization before movement.** T1–T7 cover the highest-risk semantics: DB/store identity, deferred transaction settlement/late failure, real-vs-memory parity, legacy event-request backfill, conflict coercion, canonical key ordering, and session mismatch. Requiring `fake-indexeddb` before the move is appropriate.

6. **Hook-split refusal.** `game-host.tsx` has 13 refs, six state slots, two effects, a shared dispatcher, dual bootstrap clocks, and a two-level idempotency cache. The 753-757 render writes are consumed by the bootstrap-accept path and reconnect handler. The phase is right not to split those owners without a DOM harness; lint-green is correctly demoted to non-evidence.

7. **Service split refusal and destination.** A three-service split introduces cross-aggregate calls and container churn. The application-layer shell view-model avoids the repository's absent `application → components` direction and is safe for the existing client-instantiated service graph.

8. **Demo transaction rollback.** `DemoPlayerAccessStore.transaction` already snapshots, restores in place, and preserves the outer state identity (`adult-portal-demo-store.ts:741-750`). Copying that behavior into `DemoAdultPortalStore.transaction` is a small correctness repair, not an unnecessary architectural split.

9. **Import-boundary census.** Five application-to-server import statements exist (two runtime, three type-only), ten application files import generated Prisma enums, and current component-to-server imports are the six listed by the dossier. After the purge, one component-to-server import is expected to remain. Moving `v1-policy.ts` is necessary to remove the two runtime edges but does not make a complete boundary rule green.

10. **Coverage limits are correctly recognized for UI behavior.** Node-only Vitest, `.test.ts`-only discovery, zero `.test.tsx`, and no browser provider mean nav rendering, bridge effects, hydration, print output, and cross-tab behavior cannot be certified by the planned unit tests. The phase appropriately requires a manual print check and labels UI assertions non-failing.

### M-10 — MAJOR — A1's “computed access may apply any class” rule contradicts its 63-name portal baseline

**Claim attacked.** A1 treats a backtick computed access as “may apply any class” (`C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\docs\refactor-dossier\phases\40-decomposition.md:69-78,103-110`), yet the same phase reports 63 unapplied portal names pre-purge, including 58 static names and five tones.

**Evidence.** The only computed sites are `activity-mark.tsx:22` and `materials-explorer.tsx:92`. Under the written “any class” rule, either site credits every class in `portal.module.css`, making portal unapplied 0, not 63. The inherited 63 requires evaluating the finite `tone*` domain, not treating the access as unconstrained.

**Impact.** An implementer following the written algorithm cannot reproduce the published pre-purge baseline. The post-purge 149 happens to be safe because both computed importers die, but the oracle's behavior on a future computed site is a whole-file blind spot.

**Required correction.** Specify a sound dynamic-access policy: parse a closed expression/pattern, accept an explicit checked registry of possible class names, or fail closed on unknown computed access. Add fixtures for `styles[\`tone${...}\`]`, unknown computed access, and a post-purge tree. Do not call the 63 baseline verified by the “any” algorithm.

### M-11 — MAJOR — the ratchet requires the demo store to shrink while step 10 grows it

**Claim attacked.** Step 11 says every modified pre-existing file must be “strictly smaller than their merge-base” and also lists `adult-portal-demo-store.ts` as an exception (`C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\docs\refactor-dossier\phases\40-decomposition.md:291-325`).

**Evidence.** The store is 1,024 lines. Step 10 adds snapshot/restore code to its five-line transaction at `adult-portal-demo-store.ts:392-396`, so the honest committed target is above 1,024. The “committed target” repair is also described as a replacement for the merge-base constraint, but the rule text keeps both joined by “and.”

**Impact.** A correct transaction fix fails the ratchet on the non-exception branch, while the exception branch is semantically unclear. This is the same gate-design confusion the phase claims to have repaired.

**Required correction.** State branches unambiguously:

- modified, non-excepted file: smaller than merge-base **and** under its FAIL ceiling;
- registry exception: at or below its committed target, with regrowth forbidden;
- new file: under its FAIL ceiling;
- missing/deleted target: hard failure.

The demo store's target must be its post-rollback line count, not 1,024. Add the demo-store regrowth case to `--self-test`.

### M-12 — MAJOR — the plan does not decide whether unreachable IndexedDB code should ship in the demo

**Claim attacked.** The phase adds a dependency, seven new IDB characterization tests, and a seven-file split, but never resolves the inherited demo-bundling question.

**Evidence.** `game-host.tsx:26-31` statically imports the whole offline graph. Runtime guards prevent its use in demo (`:156`, `:260`, `:500`, `:715`, `:731`, `:760`, `:804`), yet the existing demo export contains the DB name in `out/_next/static/chunks/0pvtinj9q2oay.js` (46,032 bytes). `next.config.ts:22-32` builds a static demo export, so this code is shipped to GitHub Pages. The inherited sequencing report called the demo-bundling decision a stop/redesign gate; Phase 40 does not accept, refuse, or ticket it.

**Impact.** The sprint pays the highest behavioral-risk package (IDB characterization and move) while a known mode-specific load decision remains unowned. Splitting the graph may make a later dynamic import cleaner, but it does not reduce shipped demo bytes by itself.
**Required correction.** Before step 5, choose and record one: (a) defer bundling with a named owner/ticket and baseline bytes; or (b) spike a server-only dynamic import at `getOfflineStore`, measure both demo and server graphs, and test loading/error behavior. Do not claim the split as a bundle optimization unless artifact bytes prove it.



### M-13 — MAJOR — the offline maximum-file command returns the total, not the maximum

**Claim attacked.** Step 7 and the exit use `wc -l src/runtime/offline/*.ts | sort -n | tail -1` to assert every file is at most 420 lines (`C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\docs\refactor-dossier\phases\40-decomposition.md:219,457`).

**Evidence.** For multiple operands, `wc -l` prints one count per file and a final `total` row. The total is the largest numeric row, so sorting numerically and taking the last row selects the sum of all offline files, not the largest file. The proposed graph's source spans alone total roughly 1,100 lines, so this command will red regardless of whether every individual file is below 420.

**Impact.** A correct split fails the headline offline gate, and an implementer may “fix” it by abandoning the seven-file ceiling or weakening the number.

**Required correction.** Remove the total before sorting, e.g. `wc -l src/runtime/offline/*.ts | sed '$d' | sort -n | tail -1`, or use a loop/`find` that emits only file counts. Add a self-test with files of 501, 400, and 100 lines: the maximum-file result must be 501 while the total row must not be consulted.



## Minor findings

### m-01 — “665 untested lines” is a source-partition estimate, not measured coverage

The arithmetic `14 + 8 + 3 + 64 + 576 = 665` is reproducible, and no current test mentions `indexedDB` or `IDBFactory`. But no coverage provider is installed and no line/branch report exists. The accurate statement is: “665 lines in the IDB composition/helpers/persistence partition have no direct automated exercise in the current suite.” After adding `fake-indexeddb`, report actual coverage for the new files; do not carry “54% untested” as an executed metric.

### m-02 — the static test count is mislabeled

`docs/refactor-dossier/phases/40-decomposition.md:17-19` says static `it(`/`test(` blocks are 229, then 234 including five `it.each` sites. The current tree has 229 `it(` sites, no Vitest `test()` sites, and five `it.each` call sites. Runtime is 284. State the regex/method explicitly to prevent the earlier file-count/static-count conflation from returning.

### m-03 — A1's name overstates its direction

A1 checks CSS definitions that no importer applies. It cannot catch an applied class with no definition; Phase 50's G7 owns that inverse direction. Rename/document it as an “unapplied-definition ratchet,” and keep the explicit statement that it cannot be the print-pairing oracle. The current phase does explain the direction, so this is nomenclature, not a missing design.

### m-04 — the shell view-model contract is under-specified

Step 9 says the new function returns `NavigationItemDto[]` / `PortalShellDto` from `(ActorSnapshot, role)`, but the cited service block leaves `effectiveRole` and `scopeLabel` behind (`adult-portal/service.ts:121-139`). Specify whether the new module owns only `buildNavigation` + `buildRoleLabel`, or the whole `PortalShellDto` including scope calculation. The golden tests must cover the chosen contract, especially the existing organization-count semantics.

### m-05 — the shared authorization mapper can still point upward

The new `application/authorization/authorization-actor.ts` is forbidden from importing server code, but the phase does not require a structural **input** type. If it imports `ActorSnapshot` from `application/adult-portal`, the supposedly shared authorization module depends on one aggregate. Declare both input and return shapes structurally (or import the canonical authorization type once the policy moves), keeping the shared mapper leafward.

### m-06 — step 9 silently expands the declared scope

Scope names the adult service and the clone, but the verification requires the platform-admin string to occur once; two surviving UI copies live in `portal-shell-context.tsx:10-16` and `overview-screen.tsx:38-43`. Either add those two files to scope or stop requiring the string-count reduction. Importing one pure role-label helper is SSR/client-safe, but it is still extra coupling not named by the scope.

### m-07 — the orphan-token deletion lacks its own exit assertion

The three globals are correctly orphaned after the purge: `--purple-dark`, `--purple-light`, and `--radius-micro` are defined at `C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\src\app\globals.css:15-16,53` and consumed only by removable portal rules. A1 reports classes, not custom properties. Add a zero-hit grep for the three tokens as a separate verify step; otherwise their deletion is untested.

### m-08 — step 8 bundles unrelated behavior repair into the structural move

Protocol-version constant fixes (`demo-game-adapter.tsx:16-20`, `game-host.tsx:652`) are real and cheap, but they are behavior/protocol repairs unrelated to shrinking the host. The phase's one-commit-per-step rollback then couples them to the extraction. Land them as their own commit/PR so a structural revert does not silently reintroduce stale protocol copy.




### m-09 — the T-label count does not prove T1–T7 exist

Step 6's `grep -c "^  it(\\|^  test(" … → ≥7` proves only seven declarations, not that T1 through T7 are each represented (`C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\docs\refactor-dossier\phases\40-decomposition.md:196-202`). A file can carry seven arbitrary tests and satisfy it. Use seven named tests (or `test.each` over a seven-entry T map) and grep each `T1`…`T7` token. The exit phrase “red-able against pre-move code” should also be replaced with “green against pre-move code and red against named behavior mutations”; characterization tests are not expected to fail on the behavior they characterize.

## Required implementation order after correction

1. **Revise the plan before editing source.** Resolve M-01 through M-13 and m-01 through m-09 in the phase text. In particular, publish the complete service/host line budgets, the offline class-ownership design, the full CSS surgery manifest, the real print procedure, and one size-gate owner.
2. **Decide the demo-bundle question.** This changes the offline module graph and therefore must precede characterization and extraction.
3. **Land A1/A2 and their red fixtures.** Establish the post-purge 190 baseline, define computed-access handling, create the print-attribute constant, and prove each fixture goes red for the intended reason.
4. **Add `fake-indexeddb`; land T1–T7 against the unsplit engine.** The tests must be green on current behavior and demonstrably red under named mutations. Do not move code in the same commit.
5. **Extract leaf modules, then the IDB database helpers, then queue/store, then composition/importers.** Run the full IDB characterization suite after each ownership change. Use a maximum-file command that excludes `wc`'s total.
6. **Land the CSS purge only after the selector/print oracles are green.** Apply all 19 mixed-rule surgeries, delete the three orphan tokens, and perform the corrected manual print check.
7. **Land host extraction.** First correct protocol constants separately, then model/chrome/presenter. Verify the final line budget and retain all 19 mutable slots in the owner component; do not perform the refused hook split.
8. **Land service/view-model and transaction work.** Choose the full service target before editing. Add shell golden tests and rollback/identity tests. Add any UI role-label consumers explicitly to scope.
9. **Install the single repaired size ratchet.** Commit final measured targets, exercise new/excepted/regrow/missing-base branches, then hand that one script to Phase 50.
10. **Run the Phase 40 exit invariants and fresh builds.** Do not use guessed file/case totals or stale `out/` artifacts.

## Behavioral risk controls

- **IDB atomicity:** T2 must pin settlement at `oncomplete`, last-write `succeed`, fail-after-succeed abort/reject, and synchronous throw. No eager-resolution rewrite.
- **Retry identity:** T4/T6 must cover the `eventRequests` backfill and canonical fingerprint across reload/key-order changes. The host's `savedReplies` cache remains intentionally separate and must be documented.
- **Session isolation:** T7 must cover stale-session state/events. The DB/store names and additive schema shape remain pinned.
- **Host bridge:** Keep the dispatcher, `bootstrapRef`, conflict refs, reply cache, and render-time ref publication in one owner. Chrome must be presentational; it must not own sync or bridge state.
- **Print:** `.printSheet`, `.credentialPrintCard`, and the print media block stay coupled. Print succeeds only after the Print button sets the active attribute; raw print media remains blank.
- **Shell roles/navigation:** Golden-test all three role label sets, all navigation item sets, multi-organization scope text, and teacher scope semantics. Do not merge the demo rebuild's distinct behavior by accident.
- **Demo transactions:** Preserve `readonly state` identity with in-place restore. Test both partial mutation and a thrown error.
- **SSR/client constraints:** Any new shell/authorization module imported by both graphs must remain a pure leaf `.ts` with no server/runtime imports. `game-host-model.ts` and the presenter must stay DOM-free; `game-host-chrome.tsx` may import `public.module.css` and React JSX only.

## Unnecessary scope removed or narrowed by this audit

- Do not buy a DOM environment merely to make the existing hook split appear testable. First establish the browser-test contract and choose a boundary that owns the shared state.
- Do not implement the three-service adult-portal split; its cross-aggregate calls and DI cost are not justified by the current ceiling once the corrected extraction target is known.
- Do not perform per-screen CSS extraction in this sprint. A2/manual print is a safety gate, not permission to move the print family.
- Do not treat the seven-file offline move as a demo bundle optimization unless fresh artifact measurements prove it.
- Do not add a second size-budget script in Phase 50.
- Do not carry type-only application→server imports as “coverage” after moving `v1-policy.ts`; report runtime and type-only edges separately.
- Do not require arbitrary string deduplication (`Administrador da plataforma` once) unless the role-label consumers are in scope and tested.
- Do not preserve export names, reader names, or mutation names as compatibility constraints; they are defaults whose drift the compiler catches.

## Assumptions and coverage limits

- The repository is the untracked-dossier working tree at `e5aaf1e`; no immutable dossier commit exists. All line citations are to that snapshot.
- Current tests, lint, and typecheck were executed. Coverage was not generated because no provider is installed; “665 untested” is treated as direct-exercise reachability, not measured coverage.
- No `next build`, `next dev`, browser/print emulation, database connection, package install, or implementation of the proposed scripts/tests was performed. Existing `.next`/`out` artifacts are dated observations and were not rebuilt.
- The 27/182 post-purge and 26-document results are inherited from the executed Phase 10 scratch verification, not re-created in this report.
- The 1,862 CSS deletion and 19-surgery measurements are corroborated by two independent inherited parsers; this report independently confirmed the 149-name post-purge static set and opened the omitted rules, but did not destructively apply the CSS edit.
- The host's “11–13 of 19 shared slots” is inherently split-dependent and remains `[U]`. The refusal instead relies on the reproduced slot inventory and concrete cross-calls.
- Browser, real IndexedDB transaction timing, server game bridge, two-device conflict recovery, hydration, and GitHub Pages deployment remain unexercised.
- The current runtime is Node 22.23.1 while the repository pins Node 24.19.0 (`package.json:5-9`); decisive build results should be re-recorded on the pinned runtime.

## Primary evidence index

- Phase and gates: `C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\docs\refactor-dossier\phases\40-decomposition.md:1-610`.
- Offline implementation: `C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\src\runtime\game-offline-sync.ts:1-1222`; tests: `C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\tests\unit\game-offline-sync.test.ts:1-728`.
- Host/client graph: `C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\src\components\public\game-host.tsx:1-932`; adapter `demo-game-adapter.tsx:1-112`; bridge `game-bridge.ts:1-84`.
- Service/store: `C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\src\application\adult-portal\service.ts:1-616`; `player-access/service.ts:1-180`; demo store `adult-portal-demo-store.ts:1-1024`.
- CSS/print: `C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\src\components\portal\portal.module.css:1-4910`, especially `:4140-4391`; print owner `player-credential-print-sheet.tsx:90-159`; globals `:1-139`.
- Tooling: `C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal\package.json:10-54`; `vitest.config.mts:5-20`; `eslint.config.mjs:1-17`; `next.config.ts:21-82`; `.github\workflows\deploy.yml:17-50`.
- Independent reports: `docs\refactor-dossier\reports\INV-D-runtime-godfiles.md`, `VER-D-runtime-godfiles-verification.md`, `INV-E-css-and-service.md`, `VER-E-css-and-service-verification.md`, `RV-40-decomposition-refutation.md`, `RV-X-cross-phase-consistency.md`, `ADV-1-sequencing-integration.md`, and `ADV-3-scope-and-regressions.md`.

## Final disposition

**Do not execute Phase 40 from the current text.** Preserve its refusals and most of its decomposition direction, but revise the plan first. The highest-priority corrections are the impossible line/file gates, the offline class-ownership design, the incomplete CSS surgery list, the impossible print check, A2's missing source/test work, and the duplicate/unreproducible size gate. After those repairs, the offline characterization → leaf extraction → CSS purge → host/service extraction → single ratchet sequence is safe enough to execute with the behavioral controls above.



