# Phase 30 composition/runtime seam — independent adversarial verification

**Verification date:** 25 September 2026  
**Repository root:** `C:\Users\Vitor\Desktop\Vinicius\Projetos\SMS_Portal`  
**Revision:** `e5aaf1e2891dbb1804950223eb9f0765e7dbeb65` (`main`)  
**Paired primary:** `docs/refactor-dossier-audit-2026-09-25/04-composition-seam-primary.md`  
**Primary target:** `docs/refactor-dossier/phases/30-composition-seam.md`  
**Mode:** read-only except this report. No source, configuration, test, or dossier file was edited. A disposable scratch copy was used for the two-hop build probe and removed; the tracked tree is unchanged.

## Executive verdict

The primary's central conclusion is **UPHELD**: the two-file design is directionally sound, but Phase 30 is not safe to execute unchanged. All three reported blockers reproduce from the literal instructions and the checked tree:

1. a `gen` command that is added to the launcher whitelist but has no early exit falls through to the unknown Next CLI command;
2. the prerequisite CI order can execute the new Vitest seam test with a server pointer while Vitest injects demo mode; and
3. the four-container bypass grep cannot coexist with the required “delegate, do not re-wire” action-module design.

The primary is **not** fully accurate as a severity register. Its M-05 is refuted: the proposed close-out already performs a full-project TypeScript check during `build:server` and another during `build:demo`, with the generated pointer changed before each build. M-03 is real as a missing unreachability assertion but is not a Major blocker when the existing demo manifest/no-E625 gate is retained. M-06 is real as a limitation of a Node-only test, but the phase does not necessarily claim browser persistence; the accurate finding is narrower.

An additional blocker was found by direct probe:

- **B-04 (new):** Phase 30's prescribed `sign-in-form.tsx` direct import of the current `signInAction` cannot work. `signInAction` is an inline-`"use server"` function, not a file-level action. Next 16.3.2 rejects a Client Component import of that inline action and also reports the transitive `server-only` import from `entrar/actions.ts` as a client-graph violation. The isolated exact-chain build failed with the framework's own error. The file-level two-hop chain, tested separately, succeeds and emits a registered server reference.

The practical disposition is therefore stronger than the primary states: branch (a) is unimplementable until B-01 through B-04 are corrected, and branch (b) is not a complete escape because the plan's sign-in component still must be redesigned to avoid the inline action.

## Replay and evidence key

All paths below are repository-relative and line numbers are one-based. Installed versions were read from this checkout:

| Component | Installed version |
| :-- | :-- |
| Next.js | `16.3.2` |
| TypeScript | `6.0.3` |
| Vitest | `4.1.11` |
| ESLint | `9.39.5` |
| npm | `11.6.0` |
| Node | `22.23.1` local runtime; repository pins `24.19.0` |

Non-mutating gates reproduced in this pass:

```text
npx tsc -p tsconfig.json --noEmit --incremental false   exit 0
npx eslint . --max-warnings=0                           exit 0 (background replay)
npx vitest run --reporter=dot                            33 files / 284 tests, exit 0
npx vitest run --no-isolate --fileParallelism=false     33 files / 284 tests, exit 0
npx prisma validate                                     valid, exit 0
npx prettier --check .                                 exit 1, only pre-existing REFACTOR_PLAN.md
npx vitest run tests/unit/game-event-ingestion.test.ts  6 tests, exit 0
```

The repository contains 9 `next.config.ts` alias keys, 9 `tsconfig.json` alias keys, 24 `from "@runtime/..."` import statements across 23 `src` files, 0 `export *`/`export {` barrels under `src/runtime`, and 7 `use server` occurrences (5 file-level modules plus 2 inline functions). `src/runtime/target.ts` and `src/runtime/readers.ts` are absent and are not currently ignored.

The ignored main `.next`/`out` artifacts were not stable during the pass: an initial read observed the 17-action server manifest and 104-file export, while a later read observed an empty server manifest and no `out/entrar/index.html`. Other Node/Chrome processes were present, and the isolated probe never wrote to the main artifact directories. The inherited artifact claims in the primary and in Phase 30's entry gate are therefore treated as observations, not fresh build proof. The Phase-30 text itself records this ordering hazard at `30-composition-seam.md:57-59`.

## Claim-by-claim verdicts

### B-01 — BLOCKER — `gen` falls through to the Next CLI: **UPHELD**

The primary is correct. `scripts/next-target.mjs:11` destructures `[command, target, ...args]`; `:13-22` accepts only `dev|build` and validates the target. After environment preparation, `:55-67` unconditionally spawns `[nextBin, command, ...args]`, and `:69-70` exits with that result. The proposed work order says to accept a third command at the whitelist and insert the emitter between the demo blanking block (`:41-53`) and `spawnSync` (`:63`), but it never says that `gen` returns before the spawn.

The behavior was reproduced without a repository write:

```text
node node_modules/next/dist/bin/next gen
status=1
"next gen" does not exist. Did you mean "next dev"?

node scripts/next-target.mjs gen demo
exit=1
Usage: node scripts/next-target.mjs <dev|build> <demo|server>
```

A literal implementation of the step therefore writes valid pointers and then reports failure. The defect is stateful: the files can be changed even though the command is red. The primary's required correction is necessary: separate the accepted-command set from the spawn condition, perform an early successful generation-only exit before `nextBin`/`spawnSync`, and test that `gen` exits zero, changes both pointers, and does not create a Next subprocess.

### B-02 — BLOCKER — CI/test ordering under D-1=(a): **UPHELD, with the primary's evidence reorganized**

This blocker is real under the phase's default branch:

- `vitest.config.mts:11-16` sets `environment: "node"` and injects `APP_RUNTIME_MODE=demo` for every test.
- The proposed seam test imports the generated `@/runtime/target` (`30-composition-seam.md:574-579`).
- The prerequisite CI proposal in `docs/refactor-dossier/phases/00-prerequisites.md:198-207` builds the **server** target first, then runs `npm test` at `:216-217`; it does not regenerate a demo seam between those legs.
- The generated entry is required to assert `TARGET_MODE !== getRuntimeMode()` at module initialization (`30-composition-seam.md:207-210`).
- With the proposed emitter, `build:server` itself leaves the server pointer on disk. Vitest then imports that server pointer under demo mode, so the module-level assertion fails before the test can exercise demo behavior.

There is also a fresh-clone failure independent of the CI ordering. `package.json:26` runs only `prisma generate` from `postinstall`. There is no current `pretypecheck` or `pretest` script; the phase only names `prebuild:demo`, `prebuild:server`, and `predev:demo` as belt-and-braces hooks (`30-composition-seam.md:190-193`). A fresh clone therefore has no generated `target.ts`/`readers.ts` before the bare `typecheck` in `package.json:20`; the new `@/runtime/*` consumers cannot typecheck until an operator performs an out-of-band `gen`.

The primary's proposed corrections are sound: either make generation self-contained on the mode each command promises to check, or add self-contained `typecheck:server`, `typecheck:demo`, and `test:demo` scripts. A script named for a target must not silently inspect whatever pointer happens to be on disk.

### B-03 — BLOCKER — the four-container grep contradicts delegation: **UPHELD**

The direct container-consumer inventory reproduces exactly as described:

```text
src/app/(professional)/portal/adult-portal-actions.ts:19
src/app/(professional)/portal/player-access-actions.ts:14
src/app/(public-play)/jogar/actions.ts:14
src/app/api/v1/player/active-time/route.ts:4
src/app/api/v1/player/bootstrap/route.ts:3
src/app/api/v1/player/results/route.ts:4
src/app/api/v1/player/state/route.ts:4
```

The three action modules are the functions the seam must delegate/re-export. A named re-export through `target.server.ts` does not remove their direct container imports. Removing those three imports would require moving/duplicating the action bodies or introducing another indirection, which conflicts with `30-composition-seam.md:145-155`'s “DELEGATE, do not re-wire” instruction and would change which module is designated a Server Action.

The four route handlers are a legitimate D-1b bypass because they are inert under `output: "export"`; the three action-module delegates are not the same category. The gate must be an explicit allowlist of permitted composition consumers, not “exactly four textual container imports.” The primary's correction is upheld.

### M-01 — MAJOR — the Day-2 spike does not establish the two-hop contract: **UPHELD and sharpened; escalated in effect**

The primary is right that the proposed spike (`30-composition-seam.md:105-136`) tests `__spike.ts -> entrar/actions.ts`, not the real `target.ts -> target.server.ts -> action-module` chain. The installed `use-server` documentation states the required shape at `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-server.md:46-48`: a Server Function used from a Client Component must be created in a dedicated file with the `use server` directive at the top, and those functions can then be imported by Client Components.

The current relevant source is:

- `src/app/(professional)/entrar/actions.ts:15-16` — `signInAction` is an inline function-level action; the file itself has no top-level directive.
- `src/app/(professional)/entrar/recuperar/actions.ts:8-11` — a second inline action, on a route whose current page is a client page with a local submit handler and no action import.
- `src/app/(professional)/portal/sign-out-action.ts:1` — file-level action, already the legal direct-import shape.
- `adult-portal-actions.ts:1`, `player-access-actions.ts:1`, and `jogar/actions.ts:1` — file-level actions.

An isolated copy was built with the exact two-hop chain. The first attempt used the current inline `signInAction` through `target.ts -> target.server.ts` and a reachable Client Component form. The build failed with Next 16.3.2's own errors:

```text
It is not allowed to define inline "use server" annotated Server Actions in Client Components.
To use Server Actions in a Client Component, you can either export them from a separate file
with "use server" at the top, or pass them down through props from a Server Component.

You're importing a module that depends on "server-only" ... but you are using it in the Pages Router.
'server-only' cannot be imported from a Client Component module
```

The import trace identified the exact path:

```text
Client Component Browser:
  src/app/(professional)/entrar/actions.ts
  src/app/phase30-probe/probe-client.tsx
```

A second isolated build replaced only the probe action with a file-level `"use server"` module. It succeeded. Its manifest contained the probe's registered id and the client chunk emitted that 42-hex id; the body marker did not appear in `.next/static`. This proves that the re-export hop itself is viable for file-level actions, but the current inline sign-in action is not.

The primary's spike correction is correct and should be strengthened: the phase must convert or otherwise isolate `signInAction` into a legal file-level Server Function before any new Client Component imports it, and must probe that exact file plus at least one existing file-level action. This is a real design defect, not only a documentation gap.

### M-02 — MAJOR — `tsconfig.demo.json` is not a target selector under (a): **UPHELD**

The phase states that, under D-1=(a), the demo config adds nothing to `paths` and relies on generation (`30-composition-seam.md:417-429`). That is accurate. TypeScript resolution is physical and environment-independent. The effective configuration shows `moduleResolution: "bundler"` and the 9 `@runtime/*` paths in `tsconfig.json:22-42`; `APP_RUNTIME_MODE` is not a TypeScript input. A config that extends the base and changes no target-relevant compiler option cannot make a stale `target.ts` resolve to the demo variant.

The phase itself names the trap at `:423-429`, but the proposed package script remains `"typecheck:demo": "tsc -p tsconfig.demo.json --noEmit"` (`:417-422`). Invoked alone, that script checks whichever physical pointer was last generated. The primary's correction is upheld. The B-02 evidence is repeated in the primary's M-02 section, but the underlying configuration claim is sound.



### M-03 — MAJOR — parity file reachability: **PARTIALLY UPHELD, downgraded to Minor/traceability**

The primary correctly identifies a missing control: `contracts.check.ts` is intended to import both variants so one `tsc` program checks them, but the phase does not state or gate that the file is unreachable from every route/client entry (`30-composition-seam.md:574-579`). The current `tsconfig.json:45-55` includes all TypeScript files, and no current file imports the proposed check file.

The impact is overstated if the demo build gate remains: a parity file that is accidentally route-reachable and imports `target.server.ts` will make the server action modules reachable from the demo bundle, and the phase already requires `build:demo` to report zero action ids / no E625 (`30-composition-seam.md:157-165`, `:531-533`). That is a failing acceptance gate, not a silent pass. The missing explicit unreachability rule is still worth adding, because it prevents diagnosing the failure after the fact, but it is not a Major blocker on its own.

Verdict: the observation is upheld; the severity should be **Minor**, with the required correction being a statement that the parity file is typecheck-only plus a negative import-closure gate.

### M-04 — MAJOR — the ESLint fence is path-scoped, not client-layer-scoped: **UPHELD**

The phase accurately acknowledges that the proposed rule is scoped to `src/components/**` (`30-composition-seam.md:316-324`) and that this is required to avoid banning the legitimate `src/app` reader imports. The limitation is nevertheless real. The installed core rule registers visitors for `ImportDeclaration`, `ExportNamedDeclaration`, `ExportAllDeclaration`, and TypeScript import-equals declarations at `node_modules/eslint/lib/rules/no-restricted-imports.js:816-828`; it does not create a general client-layer predicate and does not police every relative/dynamic form.

The rule therefore does not cover:

- a Client Component under `src/app` that imports `@/runtime/readers`;
- a component using a relative reader path; or
- a dynamic reader import that the rule does not visit.

The current tree has no such violation, and the phase explicitly records the blind spots at `:349-358`, so this is a design-coverage defect rather than a reproduced current failure. It remains Major if the seam is advertised as a client/server safety boundary. The primary's recommendation for a separate import-closure/layer gate is correct; the lint rule alone must not be described as that boundary.

### M-05 — MAJOR — the close-out overstates target-specific typechecking: **REFUTED**

The primary's evidence does not support its conclusion. The proposed close-out is:

```text
gen server && build:server && build:demo && gen demo && check
```

Under the phase's own step 5, the emitter writes the pointer before every `build`. The installed Next documentation says the CLI typecheck checks the complete project selected by `tsconfig` (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/02-typescript.md:34-40`). Therefore:

1. `gen server` sets the server pointer, then `build:server` typechecks the full project with the server variant;
2. `build:demo` first rewrites the pointer to demo, then typechecks the full project with the demo variant; and
3. `gen demo && check` runs the bare full-project `tsc --noEmit` with the demo pointer.

The phase's sentence at `30-composition-seam.md:431-438` is therefore substantively correct: the demo build is the last build to write `.next` and the pointer, and the `check` typecheck sees demo wiring. The primary's statement that the sequence “overstates” this is incorrect. The real defect is the narrower one already covered by B-02/M-02: the named `typecheck:demo` script itself is not self-validating, and the CI order does not explicitly regenerate a demo pointer before tests.



### M-06 — MAJOR — Node-only test cannot certify browser persistence: **PARTIALLY UPHELD, downgraded**

`vitest.config.mts:12` is `environment: "node"`; no jsdom, happy-dom, or Testing Library package is installed. The demo store explicitly branches on `typeof window` at `src/runtime/adult-portal-demo-store.ts:346-365`: Node reads a seed clone, while browser code reads and writes `window.localStorage` and dispatches `adult-portal-demo-change`. `use-demo-portal.ts:11-20` hydrates in `useEffect`, and `demo-role-controls.tsx:69-100` exercises browser event handlers. The installed static-export documentation likewise warns that `window`/`localStorage` are unavailable during prerender (`static-exports.md:253-270`).

The primary is correct that a Node-only seam test cannot certify localStorage persistence, cross-tab synchronization, or hydration. It is too strong if it treats “demo mutations round-trip against the seed clone” as necessarily meaning browser persistence: the phase's wording can also mean that the action is invoked and its in-memory service result is asserted. The bridge's Node safety can be tested, and existing tests already stub `window.localStorage` in `tests/unit/demo-player-access.test.ts:45-63`.

The accurate finding is: either add a browser-like/faked persistence test (and a manual browser gate) or state that the seam test covers only Node-safe exports and in-memory action results. Severity: **Minor to Major depending on whether persistence is an acceptance criterion**, not an unconditional Major.

### m-01 — MINOR — the four-route bypass count is not a stable closure gate: **UPHELD**

The four API route files are real and are correctly identified as the residual D-1b bypasses. But the proposed full-source `container"` grep counts internal container-to-container imports and the three action-module delegates as well as the four route handlers. “Exactly four” is therefore not a stable composition-closure assertion. The phase should name the four paths and explicitly allow the three action delegates.

### m-02 — MINOR — package hooks are under-specified: **UPHELD**

The installed npm implementation confirms the primary's lifecycle point: `run-script.js:118-127` constructs `pre${event}` and `post${event}` from the literal event name. A `prebuild` hook fires for `npm run build`, not automatically for `npm run build:demo`, `build:server`, or `dev:demo`. The phase correctly rejects a bare `prebuild` (`30-composition-seam.md:179-195`), but it does not give exact bodies/orderings for the new `prebuild:*`, `predev:*`, `pretypecheck`, and `pretest` contracts. Exact new script keys must be specified and tested; the four existing script bodies are protected by T1.

### m-03 — MINOR — `typecheck:demo` is not a real target in branch (a): **UPHELD**

This is the narrower form of M-02. An extending config with no target-specific override can name a build profile, but it cannot select a generated variant. Under (a), the command is only honest when immediately preceded by `gen demo` and the workspace pointer is known. The phase acknowledges the trap but leaves the package script as a bare `tsc -p` (`30-composition-seam.md:417-422`). Upheld.

### m-04 — MINOR — inherited artifact evidence is stale/mixed: **UPHELD as a limitation**

The primary's observation matches the phase's own warning at `30-composition-seam.md:57-59`: the locally inherited `out/` and `.next` manifests were produced by different builds, so a current paired server/demo baseline cannot be inferred from them. In this verification the main artifacts changed while the pass was running, which makes the warning more important. The values reported by the primary are inherited observations, not fresh proof. Upheld as a traceability/proof-strength finding, not as a source defect.

## B-04 — BLOCKER — the prescribed sign-in Client Component imports an illegal inline Server Action: **NEW**

This is the missed finding that most changes the disposition of M-01. Phase 30 step 8 orders `sign-in-form.tsx` to import the seam itself, and the server seam is specified to expose `signInAction` from `src/app/(professional)/entrar/actions.ts`. That file has no top-level directive; the action is inline at `:15-16`. The installed Next/React rule is explicit: a Server Function imported by a Client Component must come from a dedicated module with the `use server` directive at the top (`use-server.md:46-48`).

The isolated build through `target.ts -> target.server.ts -> entrar/actions.ts` failed. The framework reported:

```text
It is not allowed to define inline "use server" annotated Server Actions in Client Components.
To use Server Actions in a Client Component, you can either export them from a separate file
with "use server" at the top, or pass them down through props from a Server Component.
```

The same build also reported the current inline action's transitive `server-only` dependency from `src/server/auth/neon-server.ts` as a Client Component graph violation. A file-level probe action, routed through the identical two-hop re-export, built successfully, registered one additional manifest id, emitted that id in a client chunk, and did not leak its body marker. The seam hop is sound for file-level actions; the current sign-in implementation is not.

Required correction: make `entrar/actions.ts` a file-level `"use server"` module (moving the directive to line 1 and removing the inline directive), or keep the sign-in form as a Server Component form rather than converting it to a direct Client Component import. The phase must then rerun the exact two-hop probe for that action and at least one existing file-level action. This is independent of B-01 through B-03 and affects both D-1 branches wherever step 8 is retained.

## Confirmed mechanisms and non-defects

These parts of the primary survived independent inspection and should not be re-litigated.

1. **E625 predicate and demo-only scope.** The installed exporter requires an app directory and `output === "export"` (`node_modules/next/dist/export/index.js:357-360`), gathers node/edge ids (`:375-378`), decodes each with `extractInfoFromServerReferenceId` (`:379`), and throws E625 for any `server-action` (`:380-384`). `server-reference-info.js:35-49` confirms the inverse high-bit test. The inherited server observation was 17 node / 0 edge / 17 server actions; the inherited demo observation was 0 / 0 and 104 HTML files. Because the main artifacts changed during this pass, these are historical observations rather than a paired fresh build.

2. **The demo graph has no current Server Action target.** Eight distinct demo alias targets are directive-free or `"use client"`; the 7 `use server` occurrences are in `src/app`, none in a `src/runtime` target. The 24 `@runtime/*` statements / 23 files, 9+9 alias declarations, 15 reader exports, 11 reader specifiers, 4 static-param readers, 4 route-handler bypasses, and 7 `vi.mock("server-only")` sites all reproduce.

3. **Deleting the 9 aliases preserves `@/*`.** `tsconfig.json:22-24` retains `"@/*": ["./src/*"]`. The installed Next docs state built-in `paths`/`baseUrl` support (`01-installation.md:422-462`), and the Turbopack guide marks path aliases supported (`08-turbopack.md:114-116`). `server-only` is not resolvable as a normal package, but Next declares it at `node_modules/next/types/global.d.ts:49-63` and enforces the client/server layer; the isolated build's `server-only` error is direct proof of enforcement on this bundler.

4. **The readers/actions split is justified.** `adult-portal-server.ts:1-3`, `player-access-server.ts:1-3`, and `game-events-server.ts:1-3` carry `server-only`/request-boundary code. A generated target that re-exported readers would statically reach that graph from client consumers. Static export also lists Server Actions as unsupported (`static-exports.md:274-292`).

5. **The two Server→Client form sites are real.** `entrar/page.tsx:54-96` and `components/portal/portal-shell.tsx:59-77` currently place action functions in Server Component form JSX. The React/Next rule distinguishes serializable server references from ordinary function props (`use-client.md:50-70`; `use-server.md:46-48`). The demo branch must remain a render decision because `src/runtime/demo-auth-actions.ts:1-7` throws rather than performing navigation. The correction is to make the imported server action file-level, not to remove the demo branch.

6. **The scoped ESLint fence is an improvement over the unscoped rule.** `eslint.config.mjs:6-17` is a flat config with no current rules block. The proposed `files: ["src/components/**/*.ts", "src/components/**/*.tsx"]` scope avoids the known legitimate `src/app` reader imports; the phase also records the relative-import blind spot (`:349-358`). This is a scoped lint guard, not the full client/server boundary (M-04).

7. **The test-resolver inventory is corrected.** `vitest.config.mts:5-10` aliases only `@`; the current tests have 9 direct `@/runtime/*` statements across 6 files, all concrete demo/shared files, and 0 `@runtime/*` imports. A generated `@/runtime/target` resolves through the existing `@` alias. The full suite is green at 33 files / 284 tests in both parallel and serial modes; `game-event-ingestion.test.ts` is 6/6 and its `vi.mock("server-only")` interception works.

8. **Persistence is intentionally browser-only in the current design.** `adult-portal-demo-store.ts:346-365` returns a seed clone on the server and uses `localStorage` plus a custom event in the browser; `use-demo-portal.ts:11-20` hydrates in `useEffect`. The phase's “do not touch” of this store is consistent with the implementation. Only the scope of a Node-only seam test needs narrowing (M-06).



## Additional missed findings and corrections

### B-04 is not optional cleanup

The primary treated the sign-in conversion as a spike risk, but the direct probe shows the current prescribed conversion is already an invalid client graph. The plan's decision rule at `30-composition-seam.md:121-123` says a failed probe should stop and choose branch (b), yet branch (b) still has to define what `sign-in-form.tsx` imports. If it keeps the current inline action, the failure persists. The phase must name the file-level conversion (or explicitly retain a Server Component form) as a prerequisite, not leave it to the implementer.

### The exact client form behavior must be tested, not just registration

Registration and chunk emission prove that a file-level action reference crossed the hop. They do not prove `redirect()` behavior, `revalidatePath()` behavior, or a complete mutation round-trip after a client awaits the action. The phase's own “Interfaces that must not change” row (`:553`) requires those semantics to remain stable. A small server build probe can prove registration; a browser/runtime test is still required for behavior.

### Alias deletion and generated-file ignores are coupled

The phase's step 6 correctly adds `.gitignore`, `.prettierignore`, and `globalIgnores` entries (`:218-242`). Those three edits are not cosmetic: the generated files are ignored build output, and the phase's own claim that only the three ignore files govern the tools is correct. Keep them in the same change as the emitter and rewire.

### D-1(b) does not remove the sign-in issue

Branch (b) keeps the aliases and uses `tsconfig.demo.json`, so it avoids the generated pointer lifecycle. It does not make an inline Server Action legal to import from a new Client Component. The branch decision must therefore be followed by the B-04 correction if step 8 remains in scope.

## Required correction order

1. Decide D-1 explicitly. For (a), specify `gen` as an early-exit, atomic writer and make every mode-specific test/typecheck command generate its own pointer. For (b), record the alias deviation and do not describe generated behavior as active.
2. Correct B-04: make `entrar/actions.ts` file-level `"use server"` or retain the Server Component form. Probe `target.ts -> target.server.ts -> entrar/actions.ts` plus one existing file-level action.
3. Define the composition-consumer allowlist: three action modules plus the four D-1b API route handlers, with a negative closure assertion. Do not demand a textual count of four while preserving delegation.
4. Rewire the 23 files to `@/runtime/target`/`@/runtime/readers`, then delete all 9 alias keys from both configs in the same change. Keep `@/*`, the `env` block, and the `turbopack` shell.
5. Add the scoped lint fence plus a real client-layer/import-closure gate. State that relative, dynamic, and out-of-scope client imports are residual risks unless separately covered.
6. Make `typecheck:demo` atomic (`gen demo && tsc ...`) or give it a target-specific path map. Do not call a bare `tsc -p` a target guarantee.
7. Generate before the server build and before tests in CI, or add self-contained `typecheck:server`, `typecheck:demo`, and `test:demo` scripts. Do not defer this to a later phase's handoff.
8. Decide whether persistence is part of the seam's acceptance criteria. If yes, add a browser-like/faked persistence test and a manual multi-tab/hydration gate; if no, narrow the seam-test claim to Node-safe exports and in-memory results.
9. Add the parity-file unreachability assertion and the three ignore-file entries. Keep artifact reads immediately after the build that wrote `.next`.
10. Re-run the exact Day-2 probe, the negative `gen` test, both target typechecks/builds, the demo manifest/E625 check, the seam test, and `npm run check` on a clean clone.

## Coverage limits and integrity

- I did not run the repository's `next build`, `next dev`, or static export against the main workspace. The two-hop build was run only in a disposable scratch copy and removed after manifest/chunk inspection. Main `.next`/`out` values are concurrency-sensitive inherited observations.
- Local Node is `22.23.1`, while the repository pins `24.19.0` (`package.json:5-9`, `.node-version:1`, `.nvmrc:1`). The Next/TypeScript/ESLint/Vitest mechanics cited above were read from the installed versions, and all were independently checked where safe.
- No database migration, Neon connection, browser automation, real GameMaker client, tablet, print rendering, IndexedDB, or cross-tab session was exercised. Those remain acceptance work, not gate passes.
- The report is the only path intentionally created by this verifier. The workspace also contains a concurrent/unrelated untracked `.tmp-vitest.json` and the pre-existing untracked dossier/audit directories; none was edited or removed. No tracked source, config, test, or dossier file changed, and the scratch probe path was deleted.
