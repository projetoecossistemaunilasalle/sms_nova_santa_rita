# P40 Review A — Focused Decomposition

Independent review of the uncommitted P40 change set against
`docs/refactor-dossier/IMPLEMENTATION-READY.md` §P40 (including its Acceptance
list). Reviewer A. Read-only review; no implementation file was modified.

## Summary of changes reviewed

**(a) CSS cleanup** — `src/components/portal/portal.module.css`
(2716 lines, 696 → 400 rules), `src/components/public/public.module.css`
(638 lines, 129 → 79 rules), `src/components/marketing/marketing.module.css`
(213 lines, 91 → 29 rules). Orphan removal, dead-branch pruning from mixed
rules, plus the two repairs `mobileNavItem` (`portal.module.css:157`) and
`entryProblem` (`public.module.css:534`) and the `desktopNavItem` decision
(retained only inside `@media (max-width: 900px)`, `portal.module.css:1231`).
No stylesheet split, no parser, no selector baseline, no size gate.

**(b) Offline split** — `src/runtime/game-offline-sync.ts` (1222 lines) deleted
and replaced by `src/runtime/offline/{types,errors,canonical,indexed-db,sync-engine}.ts`
(115 / 31 / 53 / 694 / 380 lines). `game-host.tsx` and
`tests/unit/game-offline-sync.test.ts` repointed. `fake-indexeddb@^6.2.5` added
as a direct devDependency with one lifecycle regression.

**(c) Host / application / demo transaction** — new
`src/components/public/game-host-model.ts` (77, pure) and
`game-host-chrome.tsx` (159, hook-free) extracted from `game-host.tsx`
(932 → 804 lines); new `src/application/adult-portal/shell-view-model.ts` (96)
and `src/application/authorization/authorization-actor.ts` (19) with `getShell`
reduced to load/validate + delegate; `DemoAdultPortalStore.transaction` and
`DemoPlayerAccessStore.transaction` now snapshot/restore in place;
`readDemoAdultPortalState` gained structural validation. New tests in
`adult-portal-service.test.ts` (getShell table, 5 rows),
`demo-player-access.test.ts` (nested rollback, successful commit, malformed
current-version fallback) and `player-game-bridge.test.ts` (extracted model).

Verification commands run (Node 24.19.0 / npm 11.17.0):

- `npm run format:check` → "All matched files use Prettier code style!"
- `npm run lint` → clean, exit 0 (`--max-warnings=0`)
- `npx vitest run tests/unit/game-offline-sync.test.ts tests/unit/player-game-bridge.test.ts tests/unit/adult-portal-service.test.ts tests/unit/demo-player-access.test.ts`
  → 4 files / 39 tests passed
- `npm run typecheck:demo` → clean
- extra: `npx vitest run` (whole suite) → 28 files / 199 tests passed
- extra: PostCSS parse of all three stylesheets → OK (400 / 79 / 29 rules)
- extra: purpose-written selector/body/media-context differencers against
  `git show HEAD:<file>` (see Findings 0 and 5)

## Findings

### F0 — MAJOR: the duplicated policy-actor conversion was only half deduped

**File:** `src/application/player-access/service.ts:14-26`

```ts
function authorizationActor(actor: ActorSnapshot) {
  return {
    profileStatus: actor.profileStatus,
    platformRole: actor.platformRole,
    memberships: actor.memberships.map((membership) => ({
      organizationId: membership.organizationId,
      organizationStatus: membership.organizationStatus,
      role: membership.role,
      status: membership.status,
      teacherAssignments: membership.teacherAssignments,
    })),
  };
}
```

**Evidence (confirmed, not a question).** At HEAD this exact 13-line function
existed **twice**:

```
$ git show HEAD:src/application/adult-portal/service.ts  | sed -n '/^function authorizationActor/,/^}/p'
$ git show HEAD:src/application/player-access/service.ts | sed -n '/^function authorizationActor/,/^}/p'
```

Both dumps are byte-identical. P40 removed the adult-portal copy (now
`toAuthorizationActor` in `src/application/authorization/authorization-actor.ts`,
19 lines, same body plus an explicit `V1AuthorizationSnapshot` return type) and
left the player-access copy untouched:

```
$ git status --porcelain -- src/application/player-access/
(empty)
```

A normalizing comparison of the shared function's body against
`player-access/service.ts:14-26` returns `true`.

`grep -rn "authorizationActor\|authActor\|policyActor" src tests` now returns
exactly two hits, both in `src/application/player-access/service.ts`
(`:14` definition, `:57` sole call site inside `requireClassAccess`). The
duplication P40c.2 was chartered to remove still exists in `src/`.

**Why this is MAJOR and not MINOR.** §P40c.2 says "Move the duplicated policy
actor conversion to `src/application/authorization/authorization-actor.ts`", and
the assigned P40 change set explicitly names the player-access service as part
of the dedup. One of the two copies is a named runbook deliverable and it was
not delivered. There is no runtime impact (both functions are pure and
structurally identical, so `canAccessClass` receives the same object), which is
why this is not a regression — but it is a concrete, one-line-scale missed
requirement that a reviewer must not sign off as done.

**Fix:** in `src/application/player-access/service.ts`, delete the local
`authorizationActor` and import `toAuthorizationActor` from
`@/application/authorization/authorization-actor`, replacing the `:57` call.
No test change is required — the behavior is identical and
`tests/unit/demo-player-access.test.ts` / `player-game-bridge.test.ts` already
cover the policy decisions.

### F1 — MINOR: `.mobileNavItem` repair is a semantic no-op; the real fix is the class's existence

**File:** `src/components/portal/portal.module.css:157-159`

```css
.mobileNavItem {
  display: flex;
}
```

**Confirmed.** `.navLink` at `portal.module.css:99-116` already declares
`display: flex` at line 102, and `mobileNavItem` is only ever emitted together
with `navLink` (`src/components/portal/portal-navigation.tsx:37`). Inside
`@media (max-width: 900px)` the `.navLink` rule (`:1254`) sets
`flex-direction`/`justify-content` but not `display`, so the added declaration
changes nothing at any width. The repair's real effect is that the class now
exists in the module, which removes the live `class="… undefined"` token the
dossier recorded for the 45-of-104 prerendered documents
(`docs/refactor-dossier/phases/40-decomposition.md:513-519`,
`docs/refactor-dossier/reports/ADV-3-scope-and-regressions.md:78-104`).

This matches the runbook, which wins over the dossier: §P40a says "Repair the
known live missing styles `mobileNavItem` and `entryProblem`". Verified via
PostCSS that `.mobileNavItem` is now an exported class name of the module, so
the `undefined` token is gone. **No action required** — recorded so the P50
browser smoke is not read as a no-op, and so nobody later "cleans up" the
redundant declaration and reintroduces the phantom class.

### F2 — MINOR: `desktopNavItem` decision is correct, but note it is a never-taken branch

**Files:** `src/components/portal/portal.module.css:1229-1233`,
`src/components/portal/portal-navigation.tsx:37`

**Confirmed correct.** §P40a asked to "verify whether `desktopNavItem` has the
intended default outside its media rule". It does not have one, and that is the
intended default: outside the media query `.desktopNavItem` carries no
declarations, so it inherits `.navLink`'s `display: flex` (visible on desktop);
inside `@media (max-width: 900px)` it is `display: none`. The dead
`.adminNavGroup .navLabel` alternatives were pruned from the same selector list
(both unreferenced: `grep -rn "styles\.adminNavGroup\|styles\.navLabel" src tests`
→ 0 hits).

Recorded as a finding because reachability matters for the P50 smoke: every one
of the 14 nav items produced by `src/application/adult-portal/shell-view-model.ts:35-81`
and `src/components/portal/portal-navigation.tsx:66-123` sets `mobile: true`, so
the `styles.desktopNavItem` arm of the ternary is never taken at runtime
(`git grep -n "mobileNavItem" c149374 -- src` shows the same phantom at HEAD;
`docs/refactor-dossier/COMPAT-POLICY.md:37` classifies this as class A framing /
class C substance, i.e. a pre-existing defect, not a P40 regression). Keeping
the rule rather than deleting it is the correct call and matches the dossier's
explicit warning not to erase the concept. No test should be added for it.

### F3 — MINOR: `.entryProblem` repair colors a non-error state's heading

**File:** `src/components/public/public.module.css:534-536`

```css
.entryProblem h1 {
  color: var(--coral-dark);
}
```

The class is applied at three sites in
`src/components/public/player-entry-screen.tsx`: `:181` (the six terminal
failure states — correct), `:162` ("Não foi possível preparar o jogo" —
correct), and `:143` (`view.state === "scan"`, heading "Escaneie seu cartão para
jogar" — this is an instruction, not an error). The scan branch's icon is
already coral (`.entryProblemIcon`, `public.module.css:538-548`), so the result
is internally consistent, and the rule is inert against `.entryCard h1`
(`:450-460`, which sets no `color`) and inherits nothing conflicting. The
selector is also the minimal way to make `styles.entryProblem` a defined class
(the live defect), so it is the right shape. Flagged only so P50's error-state
smoke step explicitly looks at the scan screen and confirms the coral heading is
acceptable. **No code change recommended.**

### F4 — MINOR: `.summaryTextValue` was promoted out of a dead ancestor and is inert at its only usage

**File:** `src/components/portal/portal.module.css:1571-1574`
(was `.classSummaryBand .summaryTextValue` at HEAD `portal.module.css:3428`)

`.classSummaryBand` was dead, so the descendant qualifier had to go; that is the
runbook's "prune dead branches from mixed rules". However, the promoted
`(0,1,0)` rule loses to `.organizationOverview dd` (`:2527-2531`, specificity
`(0,1,1)`, and later in source order) at the only live usage,
`src/components/portal/organization-detail-screen.tsx:149`. So the promotion is
a no-op in practice. It is nevertheless **correct to keep** — `summaryTextValue`
is referenced from TS, and deleting it would recreate exactly the
used-but-undefined class defect F1/F3 exist to remove. Verified: the module
exports 169 class names and all 169 are referenced (0 defined-but-unused, 0
used-but-undefined). No action.

### F5 — INFO: CSS removals verified mechanically; no live rule was lost

Recorded because "a LIVE rule accidentally removed" is the highest risk in
P40a. Four independent differencers against `git show HEAD:<file>`:

1. **Used vs. defined.** For each of the three modules, the set of
   `styles.X` / `styles["X"]` names across every importer vs. the set of class
   names PostCSS extracts: **portal 0 missing / 0 unused (169/169); public
   0/0 (37/37); marketing 0/0 (12/12).** No dynamic `styles[...]` access
   exists (`grep -rn "styles\[" src` → 0 hits), so the census is complete.
2. **Surviving declarations.** Only two declarations exist in the new files
   that were not present at HEAD, and they are exactly the two intended
   repairs: `.mobileNavItem { display: flex }` and
   `.entryProblem h1 { color: var(--coral-dark) }`.
3. **Dropped declarations.** 25 `(class, media, declaration)` triples were
   dropped where the class is still live; every one of them came from a rule
   whose *primary* selector is dead, so the whole rule was correctly removed:
   `.demoFormDialog > p:not(.eyebrow)`, `.demoFormDialog > .field`,
   `.organizationParticipation p:not(.eyebrow)`,
   `.classToolbarActions .button` (+ `svg`),
   `.dashboardShortcuts .buttonGhost:first-child` (portal) and
   `.entryReady .entryPlayerNumber` (public). All 10 of those leading classes
   return 0 `styles.X` references in `src`/`tests`.
4. **Media context.** No surviving declaration changed its `@media` context
   (fixed-parser run: 1 "new" declaration per stylesheet, again only the two
   intended repairs). `.classGroupGrid`/`.organizationOverview` at
   `@media (max-width: 680px)` (`:2668-2671`) and `.classGroupGrid` at
   `@media (max-width: 1180px)` (`:2627-2629`) are pruned two-alternative
   rewrites of HEAD's four-alternative rule with identical bodies.
   `@media print` + `.printSheet`/`.credentialPrintCard` stay together in
   `portal.module.css` (`:2189-2247` and `:2404-2441`) as §P40a requires.

Spot-check of 12 removed selectors against surviving components — `navLabel`,
`newActivityShortcut`, `activityMark`, `materialIdentity`, `shareUrl`,
`statCard`, `dangerNotice`, `sidePanel`, `uploadPanel`, `srOnly`, `toggle`,
`adminNavGroup` — each returns 0 references in `src` and `tests`. Likewise
`hero`, `section`, `footer`, `nav`, `formRow`, `portalCta`, `missionCard`,
`routeRing`, `secondary` in marketing. The only surviving hits for
`header`/`eyebrow`/`primary` belong to `public.module.css`,
`portal.module.css` and `error.module.css` consumers respectively, and
`reportPanel` (`results-screen.tsx:179`) is a `results.module.css` consumer, so
removing it from `portal.module.css` is correct.

Two cosmetic notes, no action: splitting `.primary, .secondary` leaves two
adjacent `.primary` blocks (`public.module.css:122` and `:137`) plus
`.primary svg` (`:143`) — a faithful prune of the mixed rule; and
`.entryReady` had zero TS owners **at HEAD** (`git grep entryReady c149374 --
src` → CSS only), so its removal is pre-existing-dead rather than a P10
deletion-set orphan — still correct, marginally outside §P40a's literal
"whose only owners were deleted".

### F6 — INFO: offline split is a faithful whole-responsibility move

Confirmed by construction and by diff:

- Every old top-level block from `git show HEAD:src/runtime/game-offline-sync.ts`
  is present verbatim in one of the five new modules; the only unmatched chunk
  is the original import statement. All ten exported types/interface, the four
  error classes, `GameOfflineStore` and `openGameOfflineStore` are accounted
  for.
- `GameOfflineStore` + `openGameOfflineStore` bodies are byte-identical:
  `diff -u <old 170-505> <new 33-380>` shows only the import-block boundary and
  the relocated `createClientEventId`.
- `IndexedDbGameOfflinePersistence` is byte-identical apart from hoisting the
  module constants/types above `openDatabase` and adding `export` to
  `openDatabase` and the class.
- `canonical.ts` reproduces `parseStateConflictResponse`, `sameJson`,
  `stableJson`, `eventRequestIdentity` byte-for-byte.
- Dependency direction is correct and acyclic: `types`/`errors` are leaves,
  `canonical → types`, `indexed-db → canonical/errors/types`,
  `sync-engine → canonical/errors/indexed-db/types`. No leaf imports the
  engine; no `src/runtime/offline/index.ts` barrel exists; the old file is gone
  (`ls src/runtime/game-offline-sync.ts` → No such file) and no import anywhere
  still names it.
- The seven behavioral scenarios are byte-identical: `diff -u` over
  `HEAD:tests/unit/game-offline-sync.test.ts:281-737` vs the new
  `:292-738` reports a single trailing-brace offset and nothing else.
- The new lifecycle regression
  (`tests/unit/game-offline-sync.test.ts:741-795`) drives the **production**
  factory `openGameOfflineStore({ indexedDB: factory })` with a real
  `IDBFactory` from `fake-indexeddb` (open → `cacheBootstrap` → `enqueueState` →
  `close` → reopen → `getSyncStatus`/`getNextExpectedRevision` → raw
  `listStates` read). No mock of the store, no parity matrix, no abort case
  (correctly omitted since the transaction algorithm did not change).
- `fake-indexeddb` is a direct devDependency (`package.json:54`,
  `^6.2.5`, lockfile root devDependencies, `node_modules` 6.2.5).

### F7 — INFO: game-host split shows no behavior drift

`diff -u` between the HEAD body (`/tmp/old-game-host.tsx:95-905`) and the new
`game-host.tsx:62-804` shows only: the extracted pure functions/types, the three
inlined `playerBootstrapV1Schema.parse({...current, revision, new_player:false,
state})` calls replaced by the new `applyProgressToBootstrap` helper (identical
body, moved verbatim from `game-host-model.ts:66-77`), and the JSX replaced by
`<GameHostHeader>/<GameHostAlert>/<GameHostFrame>/<GameHostFooter>`. The chrome
JSX is character-identical apart from `formattedPlayerNumber` being inlined as
`String(playerNumber).padStart(2, "0")` and `phaseCopy` being a module constant.
`game-host-model.ts` is pure (no `"use client"`, no React import, no side
effects; only `@/contracts/v1`, a type import from
`@/application/player-access/types`, `./game-bridge` and a type import from
`./demo-game-state`). `game-host-chrome.tsx` contains no hooks. Import graph in
`src/components/public/` is acyclic. No hooks were extracted, per §P40c.1.

### F8 — MINOR: persisted demo-state validation is presence-based, not type-based

**File:** `src/runtime/adult-portal-demo-store.ts:346-397`

`isValidDemoAdultPortalState` checks `value.version !== 2`,
`typeof value.activeProfileId !== "string"`, `Array.isArray` per collection,
`isPlainObject` per entry, and `Object.hasOwn(entry, field)` per required field.
It does **not** check field types, so a current-version payload such as
`{version: 2, activeProfileId: "x", profiles: [{id: 5, displayName: null,
status: "ACTIVE", platformRole: null}], …}` passes validation and is returned as
`DemoAdultPortalState`. §P40c.5 asks that "Valid JSON with the current version
but missing or malformed required fields" fall back to the seed; a present field
with a wrong type is a defensible reading of "malformed" that is not covered.

Impact is low and degrading rather than crashing: all real writers
(`demoAdultPortalSeed` `:147-327`, credential allocation/rotation
`:902-955`, `src/runtime/demo-professional-creation.ts:52-57`) populate every
checked key, so the seed itself is never self-rejected — that is the important
safety property, and I verified it. A type-corrupt field degrades to "not
active" comparisons rather than a thrown error. All-or-nothing with no
migration-on-read, and the regression
(`tests/unit/demo-player-access.test.ts:130-144`) uses a genuine current-version
payload (`{...structuredClone(demoAdultPortalSeed), organizations: null}`) and
asserts the whole state equals the seed. **No change required**; noted so the
P50 "invalid/corrupt browser state" smoke step is understood to cover
truncation/missing-key corruption, not type-level corruption.

### F9 — MINOR: in-place rollback restores the state object, not nested identities

**File:** `src/runtime/adult-portal-demo-store.ts:444-454` (and the identical
`DemoPlayerAccessStore.transaction` at `:799-809`)

`structuredClone` → `Object.assign(this.state, before)` → `throw` is exactly
§P40c.3's "snapshot before work and restore the existing state object in place
on rejection", and both new tests assert `store.state` toBe the pre-transaction
object. Two properties worth knowing rather than fixing: (i) `Object.assign`
replaces the nested collections with the snapshot's clones, so nested array
identity is not preserved; (ii) a *new* top-level key added during `work` would
survive the rollback. Neither is reachable — `DemoAdultPortalState`
(`:122-133`) is a closed shape and every mutation site pushes into an existing
collection, and the demo flow re-reads state from `localStorage` per action
(`src/runtime/adult-portal-demo-actions.ts:47-53`) and refreshes the UI through
the `adult-portal-demo-change` event (`src/components/portal/use-demo-portal.ts:14-19`),
so no consumer holds a stale nested reference across a transaction.

### F10 — INFO: other §P40c items confirmed

- §P40c.4 demo credentials stay browser-local and non-secret:
  `src/runtime/player-access-demo-actions.ts:36` returns `{ token, tokenHash: token }`
  (the same plaintext in both fields, pre-existing), and
  `grep -rn "node:crypto\|createHmac\|createHash" src/runtime src/application src/components`
  returns only `src/server/security/*` and `src/server/db/prisma-game-event-store.ts`.
  No demo path imports server crypto, and no comment claims secure storage.
- §P40c.6 no key/version bump, correctly: the stored shape is unchanged
  (validation only), `DEMO_ADULT_PORTAL_STORAGE_KEY` is still
  `"missoes-caramelito:adult-portal:v2"` (`:137-138`) and `version: 2`.
- §P40 acceptance "no size gates/baselines": `grep` for `toMatchSnapshot`,
  `@testing-library`, `baseline`, `maxBytes`, line-count or byte-length
  assertions across `tests/` and `scripts/` returns nothing. No React Testing
  Library was added; the chrome components have no markup test, per §P40c.
- No scope creep found: the only files touched in P40 are the ones named in the
  change set. `git diff -- src/application/player-access/` being empty is the
  one *missing* edit, not an extra one.

## Verdict

**P40 satisfied: NO** — one MAJOR outstanding item (F0), everything else
verified clean.

F0 is a bounded, mechanical fix with zero behavioral risk: delete
`authorizationActor` at `src/application/player-access/service.ts:14-26`,
import `toAuthorizationActor` from
`@/application/authorization/authorization-actor`, and update the single call
site at `:57`. After that, P40 §P40a/P40b/P40c and its Acceptance list are
satisfied by what I could verify statically and by the gates: no live CSS rule
removed and no dead CSS left behind; the offline file replaced by five modules
with the correct dependency direction, no barrel, byte-faithful moves and the
seven scenarios untouched; the host split with no behavior drift; `getShell`
reduced to load/validate + delegate with a table that covers platform admin,
organization admin, teacher, inactive membership and no membership; the demo
transaction snapshotting, restoring in place and rethrowing with identity
preserved; and structural validation of persisted demo state with a
current-version regression. F1–F4 and F8–F9 are recorded observations, not
blockers.

---

## Re-review (fix round 1) — 2026-09-26

Reviewer A, delta scope: only F0. Read-only; no implementation file modified.

**Verdict: F0 (MAJOR) is RESOLVED. P40 is substantively satisfied, but NOT
ready for sign-off — the fix introduced one new MINOR finding (R1) that turns
the project's `npm run lint` gate red and therefore CI red.** R1 is a one-line
deletion; clear it and P40 is `PASS`.

### F0 — MAJOR: resolved, verified three ways

1. **The diff is exactly the prescribed edit and nothing else.**
   `git diff -- src/application/player-access/service.ts` is a 3-hunk change:
   `+import { toAuthorizationActor } from "@/application/authorization/authorization-actor";`
   at `:4`, the 13-line `function authorizationActor` block deleted (old
   `:14-26`), and the sole call site rewritten to
   `!canAccessClass(toAuthorizationActor(actor), classGroup)` at `:44`. No
   other file in the change set differs from the prior round.
2. **The duplication is gone from `src/`.** `grep -rn "function authorizationActor\|function toAuthorizationActor\|authorizationActor(" src tests --include=*.ts --include=*.tsx`
   now returns a single hit, the definition in the shared module. A broader
   structural grep for the conversion's distinctive shape
   (`profileStatus: actor.profileStatus`, `membership.organizationStatus`)
   outside `src/generated` returns the shared module plus unrelated
   `RecordStatus.ACTIVE` comparison sites in `adult-portal/service.ts`,
   `shell-view-model.ts` and `v1-policy.ts` — no second converter. The shared
   function now has 2 importers (`adult-portal/service.ts:13` with 18 call
   sites, `player-access/service.ts:4` with 1).
3. **Behavior is provably unchanged.** Whitespace-stripped comparison of
   `git show HEAD:src/application/player-access/service.ts:14-26` against
   `src/application/authorization/authorization-actor.ts:8-18` differs **only**
   in the header line (`function authorizationActor(actor: ActorSnapshot){` vs
   the shared file's `return{` slice start); the returned object body is
   byte-identical, and the shared version additionally carries the explicit
   `V1AuthorizationSnapshot` return type. No cycle risk either: the new edge
   targets a module whose only two imports are `import type`
   (`@/server/authorization/v1-policy`, `@/application/adult-portal/types`),
   both erased at build time. §P40c.2 is delivered.

### R1 — MINOR (new, introduced by this fix): dead `ActorSnapshot` import breaks the lint gate

**File:** `src/application/player-access/service.ts:5`

```ts
import type { ActorSnapshot } from "@/application/adult-portal/types";
```

`grep -n "ActorSnapshot" src/application/player-access/service.ts` returns
**one** hit — the import itself. The local function it existed for was
deleted, and the call site now passes `actor` (whose type is already
inferred from `reader.getActor` at `:35`) to the shared converter, so nothing
in the file references `ActorSnapshot` any more. The import was left behind by
the deletion.

**It is not caught by the gates the coordinator ran, and it is not cosmetic.**

```
$ npx eslint src/application/player-access/service.ts
  5:15  warning  'ActorSnapshot' is defined but never used  @typescript-eslint/no-unused-vars
✖ 1 problem (0 errors, 1 warning)          # bare eslint exits 0

$ npm run lint                               # package.json:18 → eslint . --max-warnings=0
  5:15  warning  'ActorSnapshot' is defined but never used  @typescript-eslint/no-unused-vars
✖ 1 problem (0 errors, 1 warning)
ESLint found too many warnings (maximum: 0).
LINT_EXIT=1
```

`tsc --noEmit` does **not** catch it (`tsconfig.json:7` enables `strict` but
not `noUnusedLocals`), which is why the coordinator's `tsc clean` result is
consistent with the defect still being present. `.github/workflows/ci.yml` runs
`npm run lint` as a hard step in the `gate` job with no `continue-on-error`, so
this is a red pipeline, and it is a **regression relative to the prior round**,
where I recorded `npm run lint → clean, exit 0`.

**Fix:** delete line 5. No behavior change (type-only import), no test impact.
After deleting, re-run `npm run lint` to confirm exit 0.

### Verification commands and results (Node v24.19.0, run by me)

| Command | Result |
| --- | --- |
| `npx tsc --noEmit --incremental false` | clean, exit 0 (does not catch R1) |
| `npx vitest run tests/unit/player-access-service.test.ts tests/unit/demo-player-access.test.ts tests/unit/player-access-prisma.test.ts` | 3 files / 21 tests passed, exit 0 |
| `npx vitest run` (whole suite, extra) | 28 files / 199 tests passed, exit 0 — identical to the prior round, no regressions |
| `npx prettier --check src/application/player-access/service.ts src/application/authorization/authorization-actor.ts` | "All matched files use Prettier code style!", exit 0 |
| `npx eslint src/application/player-access/service.ts` | 1 warning (R1), 0 errors |
| `npm run lint` | **exit 1** — R1 (see above) |

Scope creep: none. F1–F10 from the prior round are untouched by this fix and
their verdicts stand.
