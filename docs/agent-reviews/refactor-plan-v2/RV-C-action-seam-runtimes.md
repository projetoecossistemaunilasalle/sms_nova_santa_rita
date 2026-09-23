# RV-C — Action Seam, Static Export Blocker, Demo Runtimes & Build Tooling

**Scope:** `REFACTOR_PLAN.md` (v2.0, 244 lines) — §1 (executive summary), §3 diagram, §3.1 (Static
Export Blocker B1 + Action Seam), §3.3 (Demo persistence), §3.4 (Build tooling & environment),
§7 criteria 2 and 5.
**Role:** scoped adversarial reviewer. Read-only pass — nothing was built, installed or executed
against the tree. All build-behaviour conclusions rest on Next.js 16.3.2's own enforcement code and
the vendored docs, quoted below.
**Date:** 2026-09-23 · **Reviewer:** RV-C

Format: claim (quoted) | verdict | evidence `file:line` | severity.

---

## 0. Ground truth established first

| Item | Reality | Evidence |
| :--- | :--- | :--- |
| Next version | `16.3.2` | `package.json:35`; `node_modules/next/package.json` (`node -p require(...).version` → `16.3.2`); `node_modules/next/dist/build/index.js:2795` reports `nextVersion: "16.3.2"` |
| `output: 'export'` conditional? | Yes — demo target **and** non-dev phase only | `next.config.ts:22-32` (`phase === PHASE_DEVELOPMENT_SERVER ? { distDir: ".next-demo-dev" } : { output: "export", basePath: "/SMS_Portal" }`) — this dev carve-out is **uncommitted** (`git diff next.config.ts`) |
| `"use server"` files today | 7 files, 24 exported action functions | `entrar/actions.ts:16` (fn-level), `entrar/recuperar/actions.ts:11` (fn-level), `portal/adult-portal-actions.ts:1` (10 fns), `portal/atividades/actions.ts:1` (6 fns), `portal/player-access-actions.ts:1` (4 fns), `portal/sign-out-action.ts:1` (1 fn), `(public-play)/jogar/actions.ts:1` (1 fn) |
| Does the demo build succeed today? | Yes | `out/` (mtime 2026-09-23 02:04) contains `index.html` referencing `/SMS_Portal/_next/...` and `out/portal/turmas/{demo-turma-3a,demo-turma-4a-campos,demo-turma-5b}` — exactly the *current* `DEMO_CLASS_IDS` (`src/runtime/adult-portal-demo-store.ts:49-53`). A single `"use server"` specifier reachable in that graph would have aborted it |
| Is `out/` committed? | **No** | `.gitignore:6` `/out`; `git ls-files out` → `0` files. `out/.gitkeep`/`out/.nojekyll` are untracked leftovers |
| Last `.next/` build | server target | `.next/required-server-files.json` → `output: "standalone"`, `env.APP_RUNTIME_MODE: "server"`, and the 9 `@runtime/*` aliases serialized into the build config |

---

## 1. Finding F1 — E625 is real, correctly numbered, and a hard **build-time** failure (with one important imprecision)

> **Claim (§3.1:120):** "Next.js 16.3.2 strictly forbids `"use server"` actions under `output: 'export'` (ExportError **E625**)."

**Verdict: CONFIRMED (code + number + fatality); PARTIAL on "forbids".**

Evidence — the raise site:

```js
// node_modules/next/dist/export/index.js:357-386
let serverActionsManifest;
if (enabledDirectories.app) {
    serverActionsManifest = require(path.join(distDir, SERVER_DIRECTORY, SERVER_REFERENCE_MANIFEST + '.json'));
    if (nextConfig.output === 'export') {
        ...
        const actionIds = [...Object.keys(serverActionsManifest.node), ...Object.keys(serverActionsManifest.edge)];
        if (actionIds.some((actionId) => extractInfoFromServerReferenceId(actionId).type === 'server-action')) {
            throw new ExportError(`Server Actions are not supported with static export.\nRead more: ...`)
              , "__NEXT_ERROR_CODE", { value: "E625", ... });
        }
    }
}
```

* Code `E625` is exactly right: `node_modules/next/dist/export/index.js:380-384`. Sibling export gates
  in the same file: `E626` interception routes (`:368-372`), `E603` default image loader (`:346-354`),
  `E587` i18n (`:337-341`), `E610` no build id (`:213-216`), `E533` `fallback` pages (`:502-507`).
* Docs agree: `node_modules/next/dist/docs/01-app/02-guides/static-exports.md:274-292` lists
  **Server Actions** under "Unsupported Features"; `:294` adds that `next dev` with an export
  configuration also errors (the repo sidesteps this by not setting `output` in dev,
  `next.config.ts:26-28`).
* **Hard failure, and late:** the throw is inside `runNextExport`, called by `writeFullyStaticExport`
  (`node_modules/next/dist/build/index.js:427` → `exportApp`), which `next build` awaits at
  `build/index.js:2771-2780`. It is not a warning and there is no catch: the build dies **after**
  compile + prerender of every route, i.e. minutes in. Day-4 of the roadmap
  (`REFACTOR_PLAN.md:230`) therefore discovers a seam mistake at the very end of the feedback loop.
* **No configuration escape exists in 16.3.2.** `docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md`
  exposes only `allowedOrigins` / `bodySizeLimit` (and the legacy v13 `experimental.serverActions: true`);
  `node_modules/next/dist/server/config-schema.js:245` confirms there is no `enabled: false`.

**Imprecision (report as a wording fix, severity MINOR; its consequence is MAJOR):** Next does not
forbid *files* carrying `"use server"`; it forbids an **action id registered in the compiled graph**
(`export/index.js:375-379`). This repo demonstrates it: 24 exported server actions exist, yet the last
server build registered **17** (`.next/server/server-reference-manifest.json`, `node` = 17, `edge` = 0).
The 6 in `portal/atividades/actions.ts` and the 1 in `entrar/recuperar/actions.ts:8` are missing because
they have **zero production consumers** (grep: `createAccessLinkAction`… only `tests/unit/portal-dev-bypass-actions.test.ts:37-42`;
`requestPasswordResetAction` only its own definition). **Consequence:** deleting Generation A (§2) removes
*dead* actions and changes nothing about E625; only the 17 *live* ones matter, and those are precisely the
ones §3.1 wants to keep delegating to `"use server"`.

---

## 2. Finding F2 — §7.5's verification gate ("assert no `api/` in `out/`") cannot fail

> **Claim (§6 Day 4, `REFACTOR_PLAN.md:230`):** "Run `npm run build:demo` and verify GitHub Pages static export (assert no `api/` in `out/`)."
> **Claim (§7.5, `:244`):** "`npm run build:demo` exports the static GitHub Pages site with fully operational in-browser navigation, local persistence, and mock interactions."

**Verdict: WRONG (as a gate) — MAJOR.**

* The app has 4 route handlers — `src/app/api/v1/player/{bootstrap,state,results,active-time}/route.ts`,
  all non-GET — plus `src/proxy.ts:90`. Both are **silently dropped** by the exporter:
  `export/index.js:249-256` (`if (isAPIRoute(page)) { hasApiRoutes = true; continue; }`) and
  `export/index.js:481` for app routes. The "API routes and middleware are disabled" warning at
  `export/index.js:512-523` is guarded by `if (!options.buildExport)`, so during `next build` it does
  not even print. `out/api/` is therefore unreachable by construction today and tomorrow.
* Current state proves it: `find out -maxdepth 2 -type d -name api` → nothing, while the tree has
  `/api/v1/...` routes listed in `.next/app-path-routes-manifest.json`.
* The assertion that actually discriminates is the one the plan never states: the server-reference
  manifest for the demo build must contain **zero** `server-action` ids. Recommend replacing the gate
  with `test ! -f out/api -o ...` → better: assert `Object.keys(require('.next/server/server-reference-manifest.json').node).length === 0`
  and assert `out/index.html` exists, since `out/` is not committed and CI must build it
  (`.github/workflows/deploy.yml` already runs `npm run build:demo` and uploads `./out`).

---

## 3. Finding F3 — `@runtime/*`: 9 aliases confirmed, mechanism correctly named, replacement already exists in embryo

> **Claim (§1.1:16):** "glued to the app via 9 Turbopack build-time path aliases (`@runtime/*`)."
> **Claim (§1.1:20):** "`tsconfig.json` checks the server code, but `next.config.ts` bundles the demo code under Turbopack."
> **Claim (§3.1:121):** "Define a shared typed contract in `src/runtime/contracts.ts`."

**Verdict: CONFIRMED / PARTIAL.**

Exactly 9, enumerated from `next.config.ts:44-79` (`turbopack.resolveAlias`), with the `tsconfig.json:24-42`
counterpart (**always** the server variant) — this is the confirmed split-brain:

| # | alias | demo target (`next.config.ts`) | server target (`next.config.ts`) | `tsconfig.json` `paths` |
| :-- | :--- | :--- | :--- | :--- |
| 1 | `@runtime/sign-in-action` | `:45` `src/runtime/demo-auth-actions.ts` | `:47` `src/app/(professional)/entrar/actions.ts` | `:24` server variant |
| 2 | `@runtime/sign-out-action` | `:49` `demo-auth-actions.ts` | `:51` `portal/sign-out-action.ts` | `:25` |
| 3 | `@runtime/adult-portal` | `:53` `adult-portal-demo.ts` | `:55` `adult-portal-server.ts` | `:28` |
| 4 | `@runtime/adult-portal-actions` | `:57` `adult-portal-demo-actions.ts` | `:59` `portal/adult-portal-actions.ts` | `:29` |
| 5 | `@runtime/adult-portal-client` | `:61` `adult-portal-demo-client.ts` | `:63` `adult-portal-server-client.ts` | `:32` |
| 6 | `@runtime/player-access-actions` | `:65` `player-access-demo-actions.ts` | `:67` `portal/player-access-actions.ts` | `:35` |
| 7 | `@runtime/player-entry-action` | `:69` `player-entry-demo-actions.ts` | `:71` `(public-play)/jogar/actions.ts` | `:38` |
| 8 | `@runtime/player-access` | `:73` `player-access-demo.ts` | `:75` `player-access-server.ts` | `:41` |
| 9 | `@runtime/game-events` | `:77` `game-events-demo.ts` | `:79` `game-events-server.ts` | `:42` |

* Resolution mechanism: **bundle time** for Turbopack (`turbopack.resolveAlias`, dev *and* build),
  **typecheck time** and independently for `tsc` (`compilerOptions.paths`). No `.d.ts` shims exist —
  the only files mentioning `@runtime/` in the whole tree are `next.config.ts` and `tsconfig.json`
  (verified by grep across the repo excluding `node_modules`, `.next`, `out`, `.next-demo-dev`).
  The third resolver, `vitest.config.mts:7-9`, has **only** `@` → *no test can import the seam at all*
  (same finding in `docs/architecture-audit-2026-09-23.md:183`).
* Refinement of §1.1:20 that matters for the plan's payoff: `tsc --noEmit` *does* compile the demo
  variants as standalone modules (`tsconfig.json:45-54` includes `**/*.ts`); what is unchecked is their
  **conformance to the call sites**. So "drift is invisible" is right, "the demo code isn't typechecked"
  is imprecise.
* `src/runtime/contracts.ts` **does not exist** (`ls src/runtime/`). `src/contracts/v1/{index,parse,schemas}.ts`
  is an unrelated artifact — the GameMaker wire protocol (`schemas.ts:3-7` `GAME_STATE_MAX_UTF8_BYTES`,
  `PROTOCOL_VERSION`, `CONTENT_VERSION`) consumed by `game-host.tsx:18-22`. So §3.1 is **not** describing
  already-finished work — with one exception: the typed mutation contract already exists as
  `PortalMutation` (`src/components/portal/adult-portal-form.tsx:11-14`) and is already the prop type of
  every mutation form. Step 1 of §3.1 is ~90% written for the 17 form actions; **MINOR** (credit where due,
  and a hint that the *type* half of this plan is cheap while the *selection* half is the expensive part).

---

## 4. Finding F4 — the Action Seam is **not implementable as written**: BLOCKER

> **Claim (§3.1:122-125):** "2. Forms and buttons consume action handlers **passed through the composition seam**.
> 3. In **Server Mode**, the actions delegate to `"use server"` handlers… 4. In **Demo Mode**, the actions delegate
> to client functions… 5. This eliminates Turbopack build-time alias switching while fully satisfying Next.js 16's
> static export constraints."
> **Claim (§7.2, `:241`):** "Clean Action Seam: Actions consume typed interfaces; no `@runtime/*` file-swapping aliases in `next.config.ts`."

### 4.1 The real consumer surface (counted, not estimated)

24 `@runtime/*` import statements in 23 files, importing **38 specifiers**:

* **12 server pages/layouts** import **12 data readers** (`getPortalShellData`, `getPortalOverviewData`,
  `getClassesPageData`, `getClassPageData`, `listStaticClassIds`, `getOrganizationPageData`,
  `listStaticOrganizationIds`, `getTeamPageData`, `getPlayerAccessPageData`, `getResultReportsPageData`,
  `getClassResultsPageData`, `getPlayerResultsPageData`, `listStaticResultClassIds`,
  `listStaticResultPlayerParams`). These run at **build time** under export, in Node, where
  `window`/`localStorage` do not exist (`adult-portal-demo-store.ts:347` `typeof window === "undefined"`
  → `cloneSeed()`). A "runtime-injected" dependency does not help them: the choice must be made before
  the bundle exists.
* **12 client components** import **17 mutation/bridge functions** with these call-site counts
  (definition files excluded):
  `changeOrganizationStatusAction` 6, `resolvePlayerEntryAction` 4, `changeMembershipAction` 3,
  `assignTeacherToClassAction` / `changeClassStatusAction` / `deactivateTeacherAssignmentAction` /
  `createClassAction` / `createOrganizationAction` / `assignOrganizationAdministratorAction` /
  `assignTeacherMembershipAction` / `createDemoProfessionalAction` / `allocatePlayerSlotsAction` /
  `rotatePlayerCredentialAction` / `startClassSessionAction` / `endClassSessionAction` 2 each,
  plus `signInAction` 2, `signOutAction` 2, and the 3 client-bridge helpers
  (`loadClientPortalState`, `changeDemoProfile`, `resetDemoPortal`) 2 each.
  Files: `class-detail-screen.tsx:13`, `classes-screen.tsx:12`, `deactivate-organization-control.tsx:7`,
  `demo-role-controls.tsx:8`, `organization-detail-screen.tsx:8`, `organizations-screen.tsx:14`,
  `player-access-workflow.tsx:22`, `team-screen.tsx:16`, `use-demo-portal.ts:6`,
  `game-host.tsx:24`, `player-entry-screen.tsx:8`, `portal-shell.tsx:7`, `entrar/page.tsx:8`.

So: ~38 specifiers / ~40 local call sites would have to be threaded. That number is manageable. The
mechanism is not.

### 4.2 What concretely breaks

1. **A single seam module that statically imports both variants reproduces E625.** The demo build
   compiles the RSC/prerender graph too (`export/index.js:359` reads `.next/server/…`), so
   `import * as server from "./composition.server"` (`architecture-audit-2026-09-23.md:517-524` —
   the sketch §3.1 was distilled from) registers all 17 actions and kills `build:demo`. A
   `process.env.APP_RUNTIME_MODE === "demo" ? demo : server` ternary does **not** help: static
   `import` statements are unconditional at bundle time and dead-branch elimination does not remove
   module registration. There is no `serverActions: false` switch (§1 above). **Verdict: UNSUPPORTED
   as written — BLOCKER.** Note the plan deletes the *only* mechanism it does not replace with a named one.
2. **"Passed through the composition seam" (props/DI) is illegal for the demo half.** Props crossing a
   Server → Client boundary must be serializable, and a plain function is not:
   `docs/01-app/03-api-reference/01-directives/use-client.md:50` ("props of the Client Components must be
   serializable"), `:56` and `:70` (`onClick /* ❌ Function is not serializable */`). The one serializable
   function type is a server reference — exactly what `output: 'export'` forbids. So handlers can only be
   *imported inside client modules*, which is a module-resolution decision, i.e. the alias the plan removes.
3. **Two live call sites are Server Components binding an action straight to JSX**, and they survive demo
   mode today only because they render *different JSX per mode*: `entrar/page.tsx:73`
   `<form action={signInAction}>` inside `{isDemo ? (…) : (… )}` (`:11-12`, `:54`), and
   `portal-shell.tsx:68` inside `runtimeMode === "demo" ? <Link/> : <form action={signOutAction}>` (`:59-76`).
   The demo twins are deliberately fatal stubs (`src/runtime/demo-auth-actions.ts:1-7`
   `throw new Error("Demo sign-in uses static navigation.")`). Unifying them into one seam-driven call
   site means either a non-serializable prop into `<form action>` (prerender error) or a registered
   server action (E625). §3.1 never mentions these two sites. **MAJOR.**
4. **The seam does not remove the mode branching it implies it removes.** `runtimeMode` appears
   **95 times in 23 files** (worst: `game-host.tsx` 15, `player-access-workflow.tsx` 10,
   `portal-shell-context.tsx` 9, `portal-shell.tsx` 8, `player-entry-screen.tsx` 7, `team-screen.tsx` 7),
   because the demo needs more than different handlers: different *transports* (`game-host.tsx:291-300`
   POSTs to `/api/v1/player/*`, endpoints that do not exist in the export), a different game surface
   (`game-host.tsx:871-872` `<DemoGameAdapter/>`) and a different player-entry credential reader
   (`player-entry-credential.ts`). §7.2's criterion is also gameable: one alias renamed
   `@runtime/actions-impl` satisfies it literally. **MINOR** (criterion wording) / **MAJOR** (effort omitted).
5. **§1.1 contradicts §3.1.** §1.1:19 lists "Duplicated Server Actions (one `"use server"`, one
   `"use client"`)" as a fracture; §3.1:123-124 mandates exactly that duplication. The only removable
   duplication is the 10 wrapper functions in `adult-portal-demo-actions.ts` (223 lines) mirroring
   `adult-portal-actions.ts` (222 lines) — see F6 — and even that can only collapse into shared *logic*,
   not a shared *entry point*, because of E625.

### 4.3 What the plan should have said (evidence-backed options)

* The repo's own governance already names the escape and the plan ignores it:
  `docs/implementation/v1-architecture-plan.md:69-71` — "If the production route tree prevents a clean
  static export, **give the demo a dedicated static entry rather than weakening server behavior**."
* `docs/agent-reviews/REFACTOR_PLAN-review-2026-09-23.md:41` (the "post-audit" the v2 header cites at
  `REFACTOR_PLAN.md:5`) already resolved this: "**TRUE but overstated** — the blocker is not alias deletion
  per se, it is keeping `"use server"` on actions referenced from browser code … §3.1(c) and criterion 2
  must be reworded to **allow a per-target action entry point** — i.e. keep a two-implementation seam at
  the action layer, which is the mechanism the plan set out to destroy." v2 reworded criterion 2 (the
  "exactly one file" language is gone) but kept the alias deletion + both criteria 2 and 5, so B1 remains
  open in v2. That is a defect of *process*, not just of text. **MAJOR.**
* A workable minimum: keep **one** build-time selector (a `@runtime/target` alias or a generated
  `target.ts` written by `next-target.mjs`), typed by `contracts.ts`, with both variants implementing
  the interface; that converts 9 untyped swaps into 1 typed swap and makes drift a `tsc` error —
  honest, cheap, and E625-safe.

---

## 5. Finding F5 — §3.3 demo-store claims: localStorage yes, "cross-tab" half-true, rollback half-built, deep-link rationale wrong for created entities

> **Claim (§3.3:134):** "The Demo Adapter **must remain persistence-backed via `window.localStorage`**. A purely
> in-memory store resets on browser refresh, breaking deep links (`/portal/turmas/demo-turma-3a`), QR entries
> (`/jogar`), and multi-tab syncing."
> **Claim (§3.3:136):** "Retain `localStorage` snapshotting and the `adult-portal-demo-change` cross-tab event,
> but **implement atomic transaction rollbacks** (snapshotting state before execution and restoring on error)."

* **localStorage backing — CONFIRMED.** Key `missoes-caramelito:adult-portal:v2`
  (`src/runtime/adult-portal-demo-store.ts:137-138`), versioned read at `:346-356` (falls back to
  `cloneSeed()` on parse error or `version !== 2`), write at `:358-365`.
  *Unstated consequence worth adding:* both functions early-return off-document (`:347`, `:359`), so the
  **static HTML of every demo page is always the seed state** (and always `PLATFORM_ADMIN`,
  `:149`), with 10 screens re-reading after hydration (`use-demo-portal.ts:11-13`; consumers listed in
  `class-detail-screen.tsx:34`, `classes-screen.tsx:39`, `overview-screen.tsx:31`,
  `portal-navigation.tsx:55`, `portal-shell-context.tsx:28,53,68`, `team-screen.tsx:47`,
  `organizations-screen.tsx:42`, `organization-detail-screen.tsx:34`, `demo-role-controls.tsx:20`).
  That is a hydration-flash cost the plan's "clean adapter" should keep explicit. **MINOR.**
* **"cross-tab event" — PARTIAL.** `adult-portal-demo-change` is a `CustomEvent` dispatched on
  `window` (`:364`) and listened on `window` (`use-demo-portal.ts:14`); a `CustomEvent` **cannot** cross
  documents. The actual cross-tab mechanism is the native `storage` listener, one line below
  (`use-demo-portal.ts:15`). Retaining the CustomEvent is right; calling it "cross-tab" is wrong and will
  mislead whoever deletes the `storage` line believing it is redundant. **MINOR** (but destructive if acted on).
* **"implement atomic transaction rollbacks" — PARTIAL: half the work already exists.**
  `DemoPlayerAccessStore.transaction` already does exactly the described snapshot/restore:
  `:741-750` `const before = structuredClone(this.state); try { return await work(this) } catch { Object.assign(this.state, before); throw }`.
  `DemoAdultPortalStore.transaction` is a **no-op pass-through**: `:392-396` `return work(this)`.
  Independently, the *persistence* boundary is already atomic-by-accident: each demo action
  `readDemoAdultPortalState()` (fresh `JSON.parse`) and writes **only** on success
  (`adult-portal-demo-actions.ts:47-53`; `player-access-demo-actions.ts:80`;
  `player-entry-demo-actions.ts:39`), so a thrown error never reaches `localStorage`. Real remaining
  hazard is in-memory: the `readonly state` object (`:390`) stays partially mutated after a caught error,
  observable to code that keeps using it (e.g. the `createDemoProfessionalMembership(state, …)` flow,
  `adult-portal-demo-actions.ts:133-140`). So this is ~10 lines copying an existing pattern, not a new
  capability; the plan should say so (it is currently priced as part of a Day-2 "Refactor Demo Store into
  clean adapter with atomic rollbacks", `REFACTOR_PLAN.md:219`). **MINOR** (scope honesty).
* **Deep-link rationale — PARTIAL, and the gap is a BLOCKER for §7.5.** `generateStaticParams()` in
  `src/app/(professional)/portal/turmas/[id]/page.tsx:11-13` calls `listStaticClassIds()`, which for the
  demo returns only the 3 seeds (`src/runtime/adult-portal-demo.ts:73-75`; organizations `:69-71`).
  `out/portal/turmas/` confirms exactly 3 prerendered class pages. Therefore a class or organization
  **created inside the demo has no static page**: the in-app link cannot resolve (no RSC payload, no
  HTML) and a refresh/deep-link hits `out/404.html` on GitHub Pages (no SPA fallback). §3.3's premise —
  persistence is what protects deep links — is true only for seeded identifiers. §7.5's "fully
  operational in-browser navigation, local persistence, and mock interactions" is unattainable with
  `output: 'export'` + `generateStaticParams` unless the plan either (a) stops navigating to
  user-created demo entities (drawer/modal instead of a route), (b) ships a client-only shell for those
  routes, or (c) accepts and documents the 404. Nothing in §3.1-§3.4 or Day 4 addresses it.

---

## 6. Finding F6 — §3.4 build tooling: 2 of 3 claimed duties real, 1 fabricated, 2 omitted; the `mode.ts` "safe default" is a guard removal that breaks a test

> **Claim (§3.4:139):** "Retain `scripts/next-target.mjs` … because it performs critical tasks: blanking
> database secrets during `build:demo`, setting `NODE_ENV`, and preparing static assets."
> **Claim (§3.4:140):** "Ensure `src/runtime/mode.ts` has a safe default (`server`) so local tooling does not
> throw when `APP_RUNTIME_MODE` is unset."
> **Claim (§1.1:16):** "Generation C (Static Mock Hack): A parallel, **duplicated implementation of
> Generation B** running on `localStorage` in the browser."

`scripts/` contains exactly two files: `next-target.mjs` (71 lines) and `start.mjs` (73 lines).

| Claimed duty | Verdict | Evidence |
| :--- | :--- | :--- |
| "blanking database secrets during `build:demo`" | **CONFIRMED** (and broader than claimed) | `next-target.mjs:41-53` blanks `DATABASE_URL`, `DIRECT_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `APPLICATION_SECRET`, `ALLOWED_ORIGINS`, `AUTH_DEV_BYPASS`; the block is keyed on `target === "demo"`, **not** on `command === "build"` → `npm run dev:demo` blanks them too. |
| "setting `NODE_ENV`" | **CONFIRMED** | `next-target.mjs:32-33` (`command === "build"` → `NODE_ENV = "production"` for **both** targets). |
| "preparing static assets" | **WRONG** — MAJOR (credibility of the retention rationale) | No filesystem/asset code in `next-target.mjs` (imports are only `node:child_process`, `node:url`, `node:path`, `@next/env`). The asset copying is `start.mjs:40-49` (`cpSync` of `.next/static` and `public/`) and it belongs to the **standalone server** flow, not the demo. The static export copies `public/` itself (`export/index.js:528-533` "Copying \"public\" directory") — visible as `out/favicon.ico`, `out/icon.svg` mirroring `public/`. |
| — omitted duty | **UNSUPPORTED claim of completeness** — MINOR | `next-target.mjs:24` `loadEnvConfig(projectRoot, command === "dev")`, `:26-30` injecting `APP_RUNTIME_MODE` + `NEXT_PUBLIC_APP_RUNTIME_MODE`, `:39` pinning `AUTH_DEV_BYPASS="false"` for server builds (with a comment explaining that a *set* value beats `.env` re-reads), `:55-67` spawning `node_modules/next/dist/bin/next` directly. The AUTH_DEV_BYPASS pin is the genuinely load-bearing trick; the plan lists a non-existent one instead. |
| "Generation C … duplicated implementation of Generation B" | **PARTIAL / misleading** — MAJOR for scoping | Both twins instantiate the **same** domain service over a different adapter: read path `src/runtime/adult-portal-demo.ts:9-11` `new AdultPortalService(new DemoAdultPortalStore())`; write path `src/runtime/adult-portal-demo-actions.ts:50` `new AdultPortalService(new DemoAdultPortalStore(state))`, importing the identical zod schemas (`:7-15` vs `adult-portal-actions.ts:7-16`). Real duplication = the 10 action wrappers + adapters, not the use cases. Framing the demo as a "hack/parallel implementation" inflates §2's deletion logic and justifies the impossible §3.1 dedup. |
| "`mode.ts` … does not throw when `APP_RUNTIME_MODE` is unset" | premise **CONFIRMED**, recommendation **WRONG** — MAJOR | `src/runtime/mode.ts:10` `runtimeModeSchema.parse(environment.APP_RUNTIME_MODE)` throws on `undefined`. But: (i) the throw is an **asserted invariant** — `tests/unit/runtime-mode.test.ts:10-12` `it("does not infer a target from NODE_ENV", () => expect(() => getRuntimeMode({ NODE_ENV: "production" })).toThrow())`, which the change must delete or invert; (ii) the stated benefit is unreachable — `next.config.ts:5-7` parses the same variable *first*, and `src/server/config/env.ts:41` requires it, so unset still aborts `next dev`/`next build`; (iii) every supported entry point already sets it — `package.json:11-15` (all four via `next-target.mjs`), `vitest.config.mts:12-14` (`APP_RUNTIME_MODE: "demo"`), `.env.example:1-4`; (iv) **`server` is the unsafe direction of last resort**: `entrar/actions.ts:20` `if (getRuntimeMode() !== "server") throw` and `sign-out-action.ts:9` branch on it, `isAuthDevBypassEnabled` (`env.ts:120-123`) fails closed on a raw read, and `generateStaticParams`/`jogar/page.tsx:6-10` choose game-client behaviour from it — a silent `server` default inside a demo bundle would select production code paths in a static build, the exact failure `.env.example:1-2` and `v1-architecture-plan.md:63-66` ("Select the target with an explicit build setting rather than `NODE_ENV`… must not accidentally select production auth or persistence behavior") forbid. |

---

## 7. Cross-cutting

* **§3 diagram (lines 91-117)** is directionally accurate for the *data* flow (`Action Seam → Domain
  Services → adapters`) and matches reality: `src/application/adult-portal/ports.ts:84` and
  `player-access/ports.ts:73` already declare `transaction<T>` ports, and the Prisma
  (`src/server/db/prisma-adult-portal-store.ts:460-463` `$transaction`) and demo adapters both implement
  them. It is wrong in two drawn details: (a) it puts the seam *below* the UI ("calls via typed action
  seam") while two UI nodes are Server Components binding the handler to JSX (§4.2.3); (b) it shows only
  two leaves, but the tree has **three** switching mechanisms — aliases, `runtimeMode` props/branches
  (95 sites), and `getRuntimeMode()` inside Server Components/pages (§0 row 2, `entrar/page.tsx:11`,
  `jogar/page.tsx:6`, `portal/layout.tsx:21`) — plus a fourth, the localStorage *read* the build cannot
  see (`adult-portal-demo-store.ts:347`). The plan removes the first and never mentions the other three.
* **§3.2-adjacent, worth one line:** `out/` is gitignored (`.gitignore:6`), so "verify no `api/` in `out/`"
  and "committed `out/`" cannot both be true; CI must build it (`.github/workflows/deploy.yml:28-36`).

---

## 8. Severity roll-up

| # | Defect | Severity |
| :-- | :--- | :--- |
| F4.1/F4.2 | §3.1 steps 2-5 have no mechanism that survives E625: single seam module ⇒ registered actions ⇒ build dies; props-injection into client components ⇒ non-serializable. The plan deletes the only working mechanism without naming a replacement, and the v1 audit it cites already demanded a per-target entry point. | **BLOCKER** |
| F5.4 | Demo deep links/refresh for **user-created** entities 404: `generateStaticParams` is fixed to seed ids under `output: 'export'`. §7.5 "fully operational demo" unattainable as written. | **BLOCKER** |
| F2 | §7.5/Day-4 gate "assert no `api/` in `out/`" can never fail; route handlers and `src/proxy.ts` are dropped silently during `buildExport`. | **MAJOR** |
| F6.3 | §3.4's "preparing static assets" does not exist in `next-target.mjs` (it is `start.mjs`, for the server flow); two real duties (env loading, AUTH_DEV_BYPASS pin) are missing from the retention rationale. | **MAJOR** |
| F6.4 | §3.4's `mode.ts` default(`server`) inverts an asserted invariant (`runtime-mode.test.ts:10-12`), delivers no benefit (config + env schemas parse first), and picks the *unsafe* branch of a fail-fast design. | **MAJOR** |
| F1 (consequence) / F4.5 | "Strictly forbids `"use server"`" mis-states a manifest-level check (17 of 24 actions registered), so §2's purge buys nothing against E625; and §1.1's "duplicated server actions" framing contradicts §3.1's mandated duplication. | **MAJOR** |
| F4.4 | 95 `runtimeMode` sites / 23 files untouched by the seam; §7.2's wording is satisfiable by one renamed alias. | **MAJOR** |
| F6.2 | "Generation C = duplicated implementation of Generation B" overstates: ports, service and schemas are shared; only wrappers/adapters duplicate. | **MAJOR** (scope) |
| F3 | Aliases: 9 confirmed, mechanism named correctly; split-brain confirmed but demo files *are* typechecked standalone; `PortalMutation` already the seam type; `src/contracts/v1` is unrelated. | **MINOR** |
| F5.2 | "`adult-portal-demo-change` cross-tab event": CustomEvent is same-tab; `storage` (use-demo-portal.ts:15) does the cross-tab work. | **MINOR** (deletion hazard) |
| F5.3 | "Implement atomic transaction rollbacks" is half-existing (`DemoPlayerAccessStore:741-750`) and partly already guaranteed by write-on-success. | **MINOR** |
| F5.1 | Prerendered demo HTML is always seed/PLATFORM_ADMIN; only hydration restores localStorage. Should be stated as an accepted cost. | **MINOR** |

---

## 9. Open questions for the plan author

1. **Name the selection mechanism.** With `contracts.ts` types only, and no `@runtime/*` aliases, *which*
   physical artifact makes the demo bundle contain zero `server-action` ids while the server bundle
   contains 17? Generated `src/runtime/target.ts` written by `scripts/next-target.mjs` before `next build`?
   One surviving alias? Per-target route trees (`v1-architecture-plan.md:69-71`'s "dedicated static
   entry")? `turbopackIgnore` dynamic import (untypechecked — and would you accept that)? Answer in §3.1,
   or criterion 7.2 and 7.5 stay mutually exclusive exactly as v1's B1 said.
2. **`entrar/page.tsx:73` and `portal-shell.tsx:68`.** Under the seam, what does the demo build render for
   these two Server Component `<form action=…>` sites, and what happens if someone deletes the
   `runtimeMode` guard? Do the throwing stubs in `demo-auth-actions.ts:1-7` stay?
3. **Data readers.** 12 specifiers are consumed by async Server Components that execute during the export
   (`adult-portal-demo-store.ts:347` returns seeds off-window). Are they in the seam (§3.1 says "actions"
   only)? If yes, how is a build-time Node call "passed through" a seam without module resolution?
4. **Created demo entities.** Will the functional demo navigate to `/portal/turmas/<new-id>` at all? If
   yes, choose drawer/modal routing, or a client-routed sub-tree, or explicitly downgrade §7.5 to
   "seeded entities only".
5. **Verification.** Replace "assert no `api/` in `out/`" with (a) zero `server-action` ids in
   `.next/server/server-reference-manifest.json`, (b) presence of `out/index.html` and the 3 seed class
   pages, (c) a check that `src/proxy.ts` and the 4 `/api/v1/player/*` handlers are intentionally inert in
   the demo. Agree?
6. **`mode.ts`.** Keep the fail-fast (and keep `runtime-mode.test.ts:10-12`) and instead add a
   `README`/doctor script? Or if a default is truly wanted, justify `server` over `demo` against
   `env.ts:120-123` and `jogar/page.tsx:6-10`.
7. **§3.4 correction.** Should the retention rationale read "loads `.env`, pins `APP_RUNTIME_MODE`,
   blanks secrets, pins `AUTH_DEV_BYPASS=false` for server builds, sets `NODE_ENV=production`"? And should
   `start.mjs`'s `cpSync` be named separately?
8. **Testability.** After the refactor, does `vitest` resolve the seam (today `vitest.config.mts:7-9` has
   no `@runtime/*` entry, so no test exercises the swap)? Add the demo-variant parity test that both
   variants satisfy the interface, and a `build:demo` job to CI (deploy.yml builds Pages but never
   lints/typechecks/tests, while §6 Phase 0 and §7.4 claim CI does).
9. **Sequencing.** E625 fires only at the *end* of `build:demo` (`build/index.js:2771`). Do you want a
   Day-2 spike that builds the demo with one alias removed, before Day 3/4 spend?
