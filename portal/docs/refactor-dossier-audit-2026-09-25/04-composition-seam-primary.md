# Phase 30 composition/runtime-seam primary audit

**Audit date:** 25 September 2026  
**Primary subject:** `docs/refactor-dossier/phases/30-composition-seam.md`  
**Mode:** read-only except this report  
**Workspace revision:** `e5aaf1e2891dbb1804950223eb9f0765e7dbeb65`; the dossier and audit directories were already untracked at the start.

## Executive verdict

**The two-file design is directionally sound, but Phase 30 is not executable safely or coherently as written.** The installed Next.js source confirms the dossier's E625 analysis, the existing `@/*` path remains usable after deleting the nine `@runtime/*` aliases, the action/readers split is the right cross-runtime boundary, and the stated inventory is substantially accurate. However, the default generated branch has three independent execution blockers: its proposed `gen` command still falls through to `next gen`; its new seam test is ordered against a server-generated pointer by the prerequisite CI; and its composition-root grep contradicts the mandated delegation design.

I recommend choosing D-1 explicitly, but treating branch (a) as unimplementable until B-01 through B-03 are corrected. Branch (b) avoids the generated-file lifecycle but remains a deliberate deviation from the zero-alias requirement and needs the corrections below.

### Finding count

- **Blocker: 3**
- **Major: 6**
- **Minor: 4**
- **Confirmed/observation groups: 8**

## Findings

### B-01 — BLOCKER — adding `gen` to the whitelist does not make `gen` a generator-only command

**Claim under attack.** Phase 30 says to add `gen` to `scripts/next-target.mjs`'s command validation and place the emitter before `spawnSync` (`docs/refactor-dossier/phases/30-composition-seam.md:167-177`), then invokes `node scripts/next-target.mjs gen demo|server` as the prerequisite to typecheck and tests (`:179-195`, `:410-438`).

**Evidence.**

- The current launcher destructures `[command, target, ...args]` at `scripts/next-target.mjs:11` and accepts only `dev|build` at `:13-22`.
- After environment preparation it unconditionally executes the Next CLI with that same command at `scripts/next-target.mjs:55-67`, then exits with that status at `:69-70`.
- The work order says the emitter writes “before spawning” but never says that `command === "gen"` returns before `nextBin` is spawned. Run literally, the change accepts `gen`, writes the files, and then asks Next to execute an unrelated `gen` command.

**Impact.** Every named generation command on which typecheck, tests, close-out, rollback, and CI depend can write a correct pointer and still return failure. The failure is especially harmful because the files are stateful: the command may have changed `target.ts`/`readers.ts` before reporting red.

**Required correction.** Specify an early generation-only exit after successful, preferably atomic, writes and before `nextBin`/`spawnSync`. The accepted command set and the spawn condition must be different concepts. Add a negative test that `gen` exits zero, changes both pointers, and does **not** invoke a Next subprocess.

### B-02 — BLOCKER — under D-1=(a), the prerequisite CI runs the new seam test against a server pointer

**Claim under attack.** The added test imports `@/runtime/target` while Vitest injects demo mode (`docs/refactor-dossier/phases/30-composition-seam.md:572-579`); the handoff says CI must remember `gen <mode>` (`:672-679`).

**Evidence.**

- Vitest globally injects `APP_RUNTIME_MODE=demo` at `vitest.config.mts:11-15`.
- The new test is specified to import the generated target at `phases/30-composition-seam.md:574-577`.
- The Phase-00 CI proposal builds the **server** target first at `docs/refactor-dossier/phases/00-prerequisites.md:198-207`, then runs `npm test` at `:216-217`; it generates no demo seam between them.
- The generated entry is required to assert `TARGET_MODE === getRuntimeMode()` at module initialization (`phases/30-composition-seam.md:207-210`). A server pointer plus Vitest's demo environment therefore fails before the test can exercise demo behavior.
- Phase 30 calls the CI change a Phase-4 handoff (`:672-679`) even though Phase 00 is a prerequisite and its CI is intended to block every later merge. A later handoff does not make the Phase-30 PR green.

There is a second fresh-clone failure: `tsconfig.json:45-55` includes all TypeScript files, while `target.ts` and `readers.ts` are intended to be gitignored and absent until generation. `npm ci` generates only Prisma (`package.json:26`); neither `pretypecheck` nor `pretest` is added. `npm ci && npm run check` on a clean clone therefore reaches typecheck without the seam unless the operator performs an out-of-band generation.

**Impact.** The exact artifact the phase exists to make testable makes the prerequisite test order red under its default branch. It also defeats the stated fresh-clone/local-CI reproducibility.

**Required correction.** Phase 30 must own the earliest necessary generation path, not defer it. Either add self-contained `pretypecheck`/`pretest` generation for the mode each command promises to check and update CI to call `gen demo` before tests, or add self-contained `typecheck:server`, `typecheck:demo`, and `test:demo` scripts that generate first. Do not call a script `typecheck:demo` or `test:demo` if it silently checks the last pointer on disk.

### B-03 — BLOCKER — step 9's four-import exit gate contradicts step 3's delegation design

**Claim under attack.** Step 3 requires `target.server.ts` and `readers.server.ts` to delegate to existing composition roots rather than rewire adapters (`phases/30-composition-seam.md:145-155`). Step 9 then says the three action modules “move behind” the seam and requires a full-source container grep to leave only four route-handler imports (`:283-295`).

**Evidence.**

- The three action implementations directly import their real containers: `src/app/(professional)/portal/adult-portal-actions.ts:18-19`, `src/app/(professional)/portal/player-access-actions.ts:13-14`, and `src/app/(public-play)/jogar/actions.ts:14`.
- The server action modules are the functions the seam must delegate/re-export; moving their bodies into directive-free `target.server.ts` would also require re-designating Server Functions.
- A named re-export through `target.server.ts` does not remove those direct imports from the action modules. A subsequent repository-wide grep still sees all seven current non-reader container consumers: three action modules and four API route handlers.
- Removing the three action imports would require a new indirection or physical relocation that the work order does not specify and that conflicts with “DELEGATE, do not re-wire.”

**Impact.** The prescribed implementation and prescribed exit gate cannot both be true. An implementer is pushed either to duplicate/move action definitions or to leave a knowingly red gate.

**Required correction.** Define the allowed composition-consumer set. The three action modules may legitimately remain internal delegates behind the seam; the known bypasses are the four API route handlers under D-1b. Gate on “no container consumer outside the explicit allowlist,” not on an absolute count of four textual imports. Moving composition out of action modules is a separate refactor and must be specified and tested as one.

### M-01 — MAJOR — the Day-2 spike does not establish the actual two-hop target/barrel contract

**Claim under attack.** The pre-alias-deletion spike tests one hop, `__spike.ts -> entrar/actions.ts` (`phases/30-composition-seam.md:105-123`), and the work order proposes the real `client -> target.ts -> target.server.ts -> action module` chain (`:145-177`).

**Evidence.** The installed `use-server` guide documents importing a Server Function from its dedicated source file (`node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-server.md:46-97`) but does not document arbitrary re-export barrels. The proposed spike omits `target.server.ts`; it also tests the inline `"use server"` function at `src/app/(professional)/entrar/actions.ts:15-16`, while 16 registered actions come from four file-level `"use server"` modules (`adult-portal-actions.ts:1`, `player-access-actions.ts:1`, `jogar/actions.ts:1`, and `sign-out-action.ts:1`). Static export hard-fails on every registered Server Action (`node_modules/next/dist/export/index.js:357-385`).

**Impact.** A successful one-hop probe does not prove the two-hop design, and it does not cover file-level action modules. This is the linchpin of the server build and the generated branch's key new assumption.

**Required correction.** Spike the exact generated pointer plus server variant, using at least one file-level action and the inline auth action. Assert registration and a client reference for both, and run one mutation round-trip. Keep the probe out of route reachability except during the measured build.

### M-02 — MAJOR — `tsconfig.demo.json` is not a target typecheck under D-1=(a)

**Claim under attack.** Phase 30 says that under (a) the demo config “adds nothing to `paths` and relies on generation” (`phases/30-composition-seam.md:417-429`).

**Evidence.** Extending `tsconfig.json` with no target-specific compiler options merely typechecks whichever physical variant the last generated pointer names. An environment prefix cannot change TypeScript resolution: `APP_RUNTIME_MODE` is not read by `tsc`; the phase itself deletes that inert prefix at `:534-538`. The config's name therefore promises target identity that the file does not encode.

**Impact.** A stale or forgotten `gen` command can make `npm run typecheck:demo` report green while checking server wiring. The phase acknowledges the trap but does not make the command self-validating.

**Required correction.** Under (a), either make `typecheck:demo` atomically run `gen demo && tsc ...` (and add the server equivalent), or use a genuinely target-specific config/path map. Under (b), the demo `paths` override is the target selector, so the command is meaningful.

**Evidence.**

- Vitest globally injects `APP_RUNTIME_MODE=demo` at `vitest.config.mts:11-15`.
- The new test is specified to import the generated target at `phases/30-composition-seam.md:574-577`.
- The Phase-00 CI proposal builds the **server** target first at `docs/refactor-dossier/phases/00-prerequisites.md:198-207`, then runs `npm test` at `:216-217`; it generates no demo seam between them.
- The generated entry is required to assert `TARGET_MODE === getRuntimeMode()` at module initialization (`phases/30-composition-seam.md:207-210`). A server pointer plus Vitest's demo environment therefore fails before the test can exercise demo behavior.
- Phase 30 calls the CI change a Phase-4 handoff (`:672-679`) even though Phase 00 is a prerequisite and its CI is intended to block every later merge. A later handoff does not make the Phase-30 PR green.

There is a second fresh-clone failure: `tsconfig.json:45-55` includes all TypeScript files, while `target.ts` and `readers.ts` are intended to be gitignored and absent until generation. `npm ci` generates only Prisma (`package.json:26`); neither `pretypecheck` nor `pretest` is added. `npm ci && npm run check` on a clean clone therefore reaches typecheck without the seam unless the operator performs an out-of-band generation.

**Impact.** The exact artifact the phase exists to make testable makes the prerequisite test order red under its default branch. It also defeats the stated fresh-clone/local-CI reproducibility.

**Required correction.** Phase 30 must own the earliest necessary generation path, not defer it. Either add self-contained `pretypecheck`/`pretest` generation for the mode each command promises to check and update CI to call `gen demo` before tests, or add self-contained `typecheck:server`, `typecheck:demo`, and `test:demo` scripts that generate first. Do not call a script `typecheck:demo` or `test:demo` if it silently checks the last pointer on disk.
### M-03 — MAJOR — the parity check is not ordered safely against the target graph

**Claim under attack.** `contracts.check.ts` is added to make one `tsc` check both variants (`phases/30-composition-seam.md:574-579`).

**Evidence.** A parity file must be included by `tsconfig.json` but unreachable from every route entry/client component. The current include glob admits it (`tsconfig.json:45-55`), but the phase supplies no route-unreachability assertion. If `contracts.check.ts` imports `target.server.ts` from a route-reachable graph, the demo build makes the server action modules reachable and E625 fires.

**Required correction.** State that the parity file is typecheck-only and gate that no application/runtime/component file imports it. Verify the demo manifest remains zero after adding it.

### M-04 — MAJOR — the proposed ESLint fence is path-scoped, not client-layer-scoped

**Claim under attack.** Step 10 offers a `no-restricted-imports` rule scoped to `src/components/**` (`phases/30-composition-seam.md:297-374`).

**Evidence.** The phase accurately records that the rule is scoped by directory, not by `"use client"`, and that a relative reader import is not matched (`:349-358`). The installed rule implementation registers visitors for `ImportDeclaration`, `ExportNamedDeclaration`, and `ExportAllDeclaration` (`node_modules/eslint/lib/rules/no-restricted-imports.js:817-824`), not dynamic `import()` or CommonJS `require()`. A client component under `src/app`, or any component using a relative/dynamic/require reader specifier, is outside the rule's enforcement.

**Required correction.** Scope the claim precisely. Add a separate import-closure/route-layer gate, or use a plugin/rule that can inspect client-layer modules and dynamic forms. At minimum, add a negative gate for `src/app/**` and relative/dynamic imports.

### M-05 — MAJOR — the close-out sequence overstates target-specific typechecking

**Claim under attack.** Close-out runs `gen server && build:server && build:demo && gen demo && check` and says the typecheck leg honestly sees demo wiring (`phases/30-composition-seam.md:431-438`).

**Evidence.** `next build` typechecks the complete project selected by `tsconfig.json`, including tests and included `.next` trees (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/02-typescript.md:34-40`). It does not switch the `tsconfig` target. `build:server` typechecks the whole project while the generated pointer is server; `build:demo` typechecks it while the pointer is demo. The subsequent bare `check` typechecks the whole project again with the demo pointer, but `tsconfig.demo.json` is not part of `check` (`package.json:20-24`).

**Required correction.** Publish an explicit matrix: server generation → server typecheck/build, demo generation → demo typecheck/build, then leave the workspace in a documented mode. Do not describe the bare `check` leg as a target-specific typecheck.

### M-06 — MAJOR — persistence and hydration are outside the proposed seam test environment

**Claim under attack.** The added test is described as proving “demo mutations round-trip” and “bridges are Node-safe” (`phases/30-composition-seam.md:574-577`).

**Evidence.** `vitest.config.mts:11-16` uses `environment: "node"` and no browser shim. The demo store returns a seed clone when `window` is undefined (`src/runtime/adult-portal-demo-store.ts:346-360`), while actual persistence uses `window.localStorage` (`:348-364`). The bridge is exercised in browser-only code (`use-demo-portal.ts:11-20`, `demo-role-controls.tsx:69-100`). No installed `jsdom`, `happy-dom`, or equivalent is present.

**Required correction.** Either install a browser-like test environment and add persistence/multiple-tab coverage, or explicitly scope the seam test to Node-safe exports and add a manual browser persistence gate. Do not call a Node-only test a persistence round-trip.

### m-01 — MINOR — the phase's “four route handlers” bypass count is correct, but its stated grep is not a stable gate

The four API route files are real and the demo exporter does not include them, but “expected 4” is a source-policy count, not proof of composition closure. The phase should name the four paths and permit the three action-module delegates explicitly (see B-03).

### m-02 — MINOR — the package script rule and new hooks are under-specified

Phase 30 says only new package keys may be added (`:71-73`, `:618-625`) but does not provide exact hook bodies or ordering. npm's installed implementation expands `pre${event}`/`post${event}` for the literal event (`C:/Program Files/nodejs/node_modules/npm/lib/commands/run-script.js:118-126`), so `prebuild` does not run for `build:demo` or `build:server`. The phase correctly rejects a bare `prebuild`; the exact `prebuild:*`, `predev:*`, `pretest`, and `pretypecheck` contracts still need to be stated if hooks are retained.

### m-03 — MINOR — the `typecheck:demo` branch is not a real TypeScript target in (a)

This is the narrower form of M-02: an extending config with no override can still be useful for naming, but it should not be represented as target selection. The phase acknowledges the trap (`:423-429`) yet leaves the package script as a bare `tsc -p` (`:417-422`).

### m-04 — MINOR — the local-artifact evidence is stale relative to the claimed paired build

The checked workspace has `.next/server/server-reference-manifest.json` and `.next/BUILD_ID` from 23 September 02:05, while `out/entrar/index.html` is from 02:04. The phase itself records this mismatch (`phases/30-composition-seam.md:57-59`). It is useful as a warning about build ordering, but it is not a current demo/server baseline. No build was run in this audit; the values are explicitly labeled inherited artifact observations.


## Confirmed mechanisms and non-defects

These are not findings against Phase 30; they are the parts that survived independent inspection.

1. **E625 predicate and ordering.** The installed exporter requires an app directory and `nextConfig.output === "export"` (`node_modules/next/dist/export/index.js:357-360`), gathers `node` and `edge` manifest ids (`:375-378`), decodes each with `extractInfoFromServerReferenceId` (`:379`), and throws E625 for any `server-action` (`:380-384`). `server-reference-info.js:35-49` confirms the inverse bit test. The current manifest has 17 node ids, 0 edge ids, all 17 server actions; the current `out` export has 104 HTML files and no `<form` in `out/entrar/index.html`. These are inherited artifacts, not a fresh build.

2. **The demo graph currently has no `use server` target.** All eight distinct demo action/bridge targets are directive-free or `"use client"`; the seven `"use server"` files are under `src/app` and none is a runtime target. The 24 source `@runtime/*` statements occur in 23 files, with 11 client-module consumers and 12 server-module consumers. The phase's 9+9 alias count, 15 reader exports, 11 reader import specifiers, 4 static-param readers, 4 route-handler bypasses, and 7 `vi.mock("server-only")` sites reproduce from the checked tree.

3. **Alias deletion preserves the ordinary `@/*` path.** `tsconfig.json:22-24` retains `"@/*": ["./src/*"]`; the installed Next installation documents built-in `paths`/`baseUrl` support and says Turbopack reads them (`node_modules/next/dist/docs/01-app/01-getting-started/01-installation.md:422-462`; `node_modules/next/dist/docs/01-app/03-api-reference/08-turbopack.md:115`). `server-only` is not a normal installed package (`require.resolve` returns `MODULE_NOT_FOUND`), but Next's global declarations make the type import legal (`node_modules/next/types/global.d.ts:49-63`) and its compiler/layer machinery applies the boundary (`node_modules/next/dist/build/webpack-config.js:1131-1184`).

4. **The action/readers split is justified.** The three server reader modules import `server-only` and `connection` (`src/runtime/adult-portal-server.ts:1-3`, `player-access-server.ts:1-3`, `game-events-server.ts:1-3`). Keeping readers in a separate generated entry prevents a client import of `target.ts` from statically reaching the Prisma/Neon reader graph. Static export itself does not support Server Actions (`node_modules/next/dist/docs/01-app/02-guides/static-exports.md:274-292`).

5. **The two Server→Client form sites are real and the phase's direction is sound.** `entrar/page.tsx:54-95` and `components/portal/portal-shell.tsx:59-77` currently pass action functions from Server Components. The installed docs distinguish serializable server references from ordinary function props (`use-client.md:50-70`; `07-mutating-data.md:172-198`), and `use-server.md:46-97` shows the direct Client Component import pattern. The demo branch should remain a render decision because the current demo auth functions throw (`src/runtime/demo-auth-actions.ts:1-7`).

6. **The scoped ESLint rule is better than the unscoped rule.** `eslint.config.mjs:6-17` is a flat config with no current rules block; the proposed `files: ["src/components/**/*.ts", "src/components/**/*.tsx"]` scope prevents the known legitimate app-page reader imports from being rejected. The phase correctly records that relative imports remain a blind spot (`:349-358`). See M-04 for the remaining limitation.

7. **The test-resolver inventory is corrected, not merely disputed.** `vitest.config.mts:5-10` aliases only `@`; tests have nine direct `@/runtime/*` statements across six files, all concrete demo/shared files, and zero `@runtime/*` imports. A generated `@/runtime/target` is reachable through the existing `@` alias. The full current suite passes 33 files / 284 tests; the targeted `game-event-ingestion` test passes 6/6, proving the existing `vi.mock("server-only")` interception works in this Vitest setup.

8. **Persistence is intentionally browser-only in the current design.** `adult-portal-demo-store.ts:346-365` uses a seed clone on the server and `localStorage` in the browser; `use-demo-portal.ts:11-20` hydrates in `useEffect`; the static export docs explicitly warn that browser APIs are unavailable during prerender (`static-exports.md:253-269`). Phase 30's “do not touch” of this store is consistent with the current implementation, but its proposed Node-only seam test cannot certify it (M-06).




## Recommended implementation order and gates

1. Resolve D-1 in writing. If choosing (a), make the generator a first-class, side-effecting `gen` subcommand with an early exit and deterministic/atomic writes; if choosing (b), retain a recorded alias deviation and do not describe branch (a)'s generated behavior as active.
2. Define exact contracts and parity-file unreachability before wiring imports. Use named exports only; never `export *` from a client boundary. The parity file may import both variants for `tsc`, but no route/component/runtime entry may import it.
3. Delegate server action modules and reader modules to the four existing containers. Replace the absolute “only four container imports” grep with an explicit allowlist of the three action delegates plus four API route handlers.
4. Rewire the 23 files to two stable paths: client/action/bridge consumers to `@/runtime/target`; server reader consumers to `@/runtime/readers`. Delete all nine alias keys from both configs in the same change. Keep the current `"@/*"` path.
5. Add the two client form components with `"use client"` and direct seam imports; retain `<Link>` for demo/basePath behavior. Spike the exact two-hop server-action chain before relying on it.
6. Add scoped import lint plus an import-closure/layer gate. The lint rule alone is not a server/client security boundary.
7. Make generation and target checks self-contained: server generation → server typecheck/build/action-manifest assertion; demo generation → demo typecheck/build/E625/export assertions; demo generation → seam tests. Serialize artifact reads immediately after the build that wrote them.
8. Add browser persistence coverage if persistence is part of the seam's acceptance criteria; otherwise narrow the test claim and document the manual gate.

## Coverage and limitations

- I did not run `next build` or `next dev`; both mutate `.next*`/`out` and the brief restricted this audit to the assigned report. E625, manifest, export, and build-gate claims are therefore source-verified or inherited-artifact observations, not fresh-build proof.
- The local runtime is Node `22.23.1` (`node --version`), while the repository pins Node `24.19.0` (`package.json:5-9`, `.node-version:1`, `.nvmrc:1`). Installed package versions are Next `16.3.2`, TypeScript `6.0.3`, ESLint `9.39.5`, and Vitest `4.1.11`; mechanics were read from that install.
- Current non-mutating checks: `tsc --noEmit --incremental false` exit 0; `eslint . --max-warnings=0` exit 0; full Vitest exit 0 (33 files/284 tests); Prisma validate exit 0; Prettier check exit 1 on the pre-existing `REFACTOR_PLAN.md`. No source, config, or dossier file was edited.
- The exact barrel/action-hop behavior, a fresh `gen` implementation, and the proposed seam test cannot be proven without implementing or building the proposed artifacts; those are explicitly marked as required spikes/corrections rather than silently assumed.
- Cross-runtime persistence, browser hydration, API route behavior, and deployment to GitHub Pages/Neon were not exercised. The phase's own accepted breakage and D-1b remain the correct places to record those residuals.

## Primary references

- `docs/refactor-dossier/phases/30-composition-seam.md:61-216` (scope, generator, split, mode assertions)
- `docs/refactor-dossier/phases/30-composition-seam.md:244-374` (rewiring, action form split, bypass count, ESLint fence)
- `docs/refactor-dossier/phases/30-composition-seam.md:376-438` (Vitest resolution, target typecheck, close-out)
- `docs/refactor-dossier/phases/30-composition-seam.md:515-600` (exit gates and test limits)
- `scripts/next-target.mjs:11-70`; `package.json:10-26`; `tsconfig.json:11-55`; `vitest.config.mts:5-20`
- `node_modules/next/dist/export/index.js:357-385`; `node_modules/next/dist/shared/lib/server-reference-info.js:35-49`
- `node_modules/next/dist/docs/01-app/01-getting-started/01-installation.md:422-462`; `.../08-turbopack.md:115`; `.../static-exports.md:253-292`
- `node_modules/next/types/global.d.ts:49-63`; `node_modules/next/dist/build/webpack-config.js:1131-1184`
- `src/runtime/adult-portal-demo-store.ts:123-138,346-365`; `src/runtime/adult-portal-server.ts:1-17`; `src/runtime/player-access-server.ts:1-14`; `src/runtime/game-events-server.ts:1-17`
- `docs/refactor-dossier/phases/00-prerequisites.md:198-237`; `.github/workflows/deploy.yml:21-39`
