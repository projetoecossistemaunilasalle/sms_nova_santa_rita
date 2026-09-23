# VV-C — Independent Adversarial Verification of RV-C (Action Seam & Runtimes)

**Role:** verifier (anti-review). Mission: try to REFUTE `RV-C-action-seam-runtimes.md`.
**Method:** every cited line re-opened in `node_modules/next/dist/` 16.3.2 source and vendored docs,
every repo count re-derived with fresh greps/parsers. No builds, no writes outside this file.
**Result:** the review survives adversarial checking almost entirely. Central claim F4 (the §3.1
Action Seam has no mechanism as written) is **UPHELD**; refutation attempts failed at the level that
matters (E625 is a graph-membership gate; no props/context trick evades it without *some*
per-target module-selection artifact). Four imprecisions were found, none severity-changing; two
findings the reviewer missed are added.

---

## Table — claim by claim

| # | Claim (RV-C) | Reviewer's evidence | My independent evidence | Verdict | Corrected severity |
| :-- | :--- | :--- | :--- | :--- | :--- |
| 1a | E625 is real, correctly numbered, thrown under `output:'export'` for server actions | `export/index.js:380-384` | Read the file: `throw new ExportError("Server Actions are not supported with static export…")` with `value:"E625"` at **export/index.js:380-384**; condition is `nextConfig.output === 'export'` (`:360`) + any manifest id of type `'server-action'` (`:375-379`). Crucially, unlike the i18n gate (`:336` `!options.buildExport`) and the image gate (`:343`), the server-action gate has **no `buildExport` guard** → it fires inside `next build`, not only standalone export. `node_modules/next/package.json` → `"version": "16.3.2"`. Docs concur: `static-exports.md:292` lists Server Actions under "Unsupported Features". | **UPHELD** | — |
| 1b | Reached "from `runNextExport`… fails at END of build rather than at config validation" | `build/index.js:2771-2780` | Control flow verified: `build/index.js:2771-2779` (`if (config.output === 'export')`) → `writeFullyStaticExport` (`build/index.js:427`) → `require('../export').default` = `exportApp` (`export/index.js:845-851`) → **`exportAppImpl`** (`export/index.js:181`). `grep runNextExport export/index.js` → **no match**; that is the pre-15 function name — reviewer's *chain and line numbers are right*, the intermediate name is `exportAppImpl`/`exportApp`, not `runNextExport`. Timing refinement: the throw sits at `:357-386`, i.e. **after the whole compile/manifest phase but BEFORE "Start the rendering process" (`:388`)** — so it kills the build at the *start* of the export sub-phase, not after prerendering every route. Still minutes in, still after compile, still no config-validation-stage check. | **UPHELD** (with name + timing imprecision, MINOR) | late-failure severity unchanged |
| 1c | No opt-out config exists in 16.3.2 | `config-schema.js:245`; `serverActions.md` | `config-schema.js:245-248`: `serverActions: z.object({ bodySizeLimit, allowedOrigins }).optional()` — **no `enabled`, no `impliesAllowed`** (grep for both → 0 hits anywhere in `next/dist`). `serverActions.md` documents only those two keys. No export flag disables the gate. | **UPHELD** | — |
| 2a | Demo build succeeds today *because* no `"use server"` file is reachable in the demo graph | `out/`, `.next/` forensics | `out/index.html` mtime 2026-09-23 02:04, references `/SMS_Portal/_next/…`; `out/portal/turmas/{demo-turma-3a, demo-turma-4a-campos, demo-turma-5b}` = exactly `DEMO_CLASS_IDS` (`adult-portal-demo-store.ts:49-53`). `next.config.ts:22-31` sets `output:"export"` only for `runtimeMode === "demo" && phase !== PHASE_DEVELOPMENT_SERVER` (dev carve-out `distDir:".next-demo-dev"` at `:26-27`; the config change is uncommitted per `git status`). All 7 `"use server"` files are reachable **only** through `@runtime/*` specifiers (grep: zero non-alias imports of those paths); demo aliases point at plain stubs — `src/runtime/demo-auth-actions.ts` has **no `"use server"` directive at all**, just two throwing functions (`:1-7`). | **UPHELD** | — |
| 2b | "Two Server Components bind actions straight to JSX today (`entrar/page.tsx:73`, `portal-shell.tsx:68`)" | F4.2.3 | Line-exact: `entrar/page.tsx:73` `<form className={styles.form} action={signInAction}>` inside `isDemo ? (…<Link href="/portal">…) : (…)` (`isDemo` at `:11-12, :54`); `portal-shell.tsx:68` `<form action={signOutAction}>` inside `runtimeMode === "demo" ? <Link/> : <form…>` (`:59-76`). Neither file has `"use client"` → both are Server Components. In demo mode the aliases resolve to the throwing stubs, which are never called because the JSX branch differs. | **UPHELD** | — |
| 3 | "Functions as props into Server→Client are illegal; the one serializable function is a server reference; handlers can only be imported inside client modules = the alias the plan removes" | `use-client.md:50,56,70` | Docs quoted exactly: `:50` "the props of the Client Components must be serializable", `:56` and `:70` `onClick /* ❌ Function is not serializable */`. Adjudication of the three patterns: **(a) S→C function prop = illegal** (only server references serialize — and those are E625-fatal under export); confirmed, and this is what plan §3.1 step 2 ("handlers passed through the composition seam") implies for its two Server-Component sites. **(b) C→C function prop / context = legal** — no serialization occurs inside the client graph; the reviewer's own repo evidence proves it: `PortalMutation` (`adult-portal-form.tsx:11-14`) is a function prop consumed by `"use client"` `useActionState` (`:3`). **(c) client-only module importing the handler directly = what the 12 client consumers do today.** The refutation attempt that *fails*: none of (b)/(c) escape E625, because the gate is **graph membership, not call sites** — my repo evidence: 24 exported actions exist but only **17** ids in `.next/server/server-reference-manifest.json` (`node`=17, `edge`=0; the 7 missing = 6 in `atividades/actions.ts` + `recuperar/actions.ts:8`, both with zero importers). So a seam module that *statically imports* the server variant registers those ids even under a `process.env` ternary, and the demo build dies. The reviewer's sentence "which is the alias the plan removes" is **overstated** — a module-resolution decision need not be a `next.config.ts` alias (see design section). Core verdict: no seam variant survives without *some* per-target selection artifact. | **UPHELD as to §3.1-as-written**; the "⇒ alias" clause **OVERSTATED** | BLOCKER stands |
| 3b | The two S→C sites face a binary: "non-serializable prop (prerender error) or registered server action (E625)" | F4.2.3 | **Refuted as a dichotomy** — a third legal option exists (wrap the form in a Client Component that imports the seam internally; see "missed" M3). Doesn't rescue the plan (selection problem remains). | **OVERSTATED** | MAJOR → MAJOR (plan still never mentions the sites) |
| 4a | 9 `@runtime/*` aliases | `next.config.ts:44-79`, `tsconfig.json:24-42` | Counted twice: `next.config.ts` `turbopack.resolveAlias` keys at `:44, :48, :52, :56, :60, :64, :68, :72, :76` = **9**; `tsconfig.json` `paths` `@runtime/*` at `:24-42` = **9**, all pointing at the **server** variant (split-brain confirmed). Demo targets match reviewer's table row-for-row. | **UPHELD** | — |
| 4b | `src/runtime/contracts.ts` does not exist | §F3 | `ls src/runtime/` → 16 files, no `contracts.ts`. | **UPHELD** | — |
| 4c | 24 import statements / 38 specifiers across 23 files | §4.1 | Re-derived with an AST-ish regex parser over all `src/**/*.{ts,tsx}` (multi-line imports included): **{stmts: 24, specifiers: 38, files: 23}** — exact match. Naive `grep import | wc -l` gives 16 precisely because 8 of the imports are multi-line; the reviewer's 24 is the correct number. Split confirmed: 11 server-page data-reader import files + 13 client/component files. | **UPHELD** | — |
| 4d | `runtimeMode` appears 95× in 23 files (game-host 15, player-access-workflow 10, …) | F4.4 | `grep -rn runtimeMode src/ | wc -l` = **95**; files = **23**; top counts identical: game-host.tsx 15, player-access-workflow.tsx 10, portal-shell-context.tsx 9, portal-shell.tsx 8, player-entry-screen.tsx 7, team-screen.tsx 7. | **UPHELD** | — |
| 5 | §7.5 demo deep links: `generateStaticParams` returns seed ids only → created entities 404; "fully operational" unattainable | F5.4 | Real call sites: 15 `generateStaticParams` in `src/`. The governing one: `portal/turmas/[id]/page.tsx:11-13` → `listStaticClassIds()` → `adult-portal-demo.ts:73-75` `Object.values(DEMO_CLASS_IDS)` (3 seeds; organizations at `:69-71`). `find out/portal/turmas -type d` → exactly `demo-turma-3a`, `demo-turma-4a-campos`, `demo-turma-5b` + segment dirs. After in-demo creation, `classes-screen.tsx:174-180` renders `<Link href={/portal/turmas/${id}}>` for the *new* id — under `output:'export'` no HTML/RSC payload exists for it, so even the client navigation cannot mask the failure (it ends in a full-document navigation hitting `out/404.html`; GitHub Pages has no SPA fallback, and deploy.yml just uploads `./out`). Not documented as an accepted limitation anywhere: `REFACTOR_PLAN.md:134` (§3.3) actively *invokes* deep links as the reason for localStorage. New-in-plan-analysis: **yes** for created entities. | **UPHELD** | BLOCKER stands |
| 6a | localStorage backing + `adult-portal-demo-change` event confirmed | §F5 | `adult-portal-demo-store.ts:137-138` key `missoes-caramelito:adult-portal:v2`; `:346-356` read with `typeof window === "undefined" → cloneSeed()` and version!==2 fallback; `:358-365` write + `window.dispatchEvent(new CustomEvent("adult-portal-demo-change"))` at `:364`. | **UPHELD** | — |
| 6b | "Cross-tab" is the native `storage` listener, not the CustomEvent | §F5 | `use-demo-portal.ts:14` listens `adult-portal-demo-change`, `:15` listens `"storage"` — both present; a `CustomEvent` cannot cross documents. Reviewer's correction is right and the deletion-hazard framing is fair. | **UPHELD** | MINOR |
| 6c | Rollback "half-existing": player store has snapshot/restore, adult store is a no-op | `:741-750` vs `:392-396` | Quoted from source. `DemoAdultPortalStore.transaction` → `:395` `return work(this);` (no-op). `DemoPlayerAccessStore.transaction` → `:744` `const before = structuredClone(this.state);` + try/catch restoring via `Object.assign`. Plan §3.3 ("implement atomic transaction rollbacks") indeed re-sells an existing pattern. | **UPHELD** | MINOR |
| 7a | "preparing static assets" is NOT in `next-target.mjs`; it's `start.mjs:40-49` | F6 table | Read `scripts/next-target.mjs` in full (71 lines): imports are only `node:child_process`, `node:url`, `node:path`, `@next/env`; no `fs` import, no copy code. Duties actually present: `loadEnvConfig` (`:24`), `APP_RUNTIME_MODE`+`NEXT_PUBLIC_…` injection (`:26-30`), `NODE_ENV="production"` on build (`:32-33`), `AUTH_DEV_BYPASS="false"` pin for server builds (`:39`), demo secret blanking keyed on `target === "demo"` (`:41-53` — i.e. also for `dev:demo`, broader than the plan's "during `build:demo`"), spawn of `next/dist/bin/next` (`:55-67`). Asset copying is `start.mjs:40` and `:47` (`cpSync` of `.next/static` and `public/` into `.next/standalone`) — server flow only. Static export copies `public/` itself (`out/favicon.ico`, `out/icon.svg`). | **UPHELD** | MAJOR stands |
| 7b | `mode.ts` "safe default" recommendation is wrong: throws today (confirmed), but the throw is an asserted invariant, the benefit is unreachable, and `server` is the unsafe default | F6 table row 6 | `src/runtime/mode.ts:10` `runtimeModeSchema.parse(environment.APP_RUNTIME_MODE)` → throws on `undefined` — premise confirmed. `tests/unit/runtime-mode.test.ts:11-12` `expect(() => getRuntimeMode({ NODE_ENV: "production" })).toThrow()` — the change breaks this test. Benefit dead: `next.config.ts:5-7` zod-parses `process.env.APP_RUNTIME_MODE` at config load (before any `mode.ts` call) and `package.json:12-15` routes all four npm scripts through `next-target.mjs` which always sets it; `vitest.config.mts:13` sets `demo`; so unset env fails earlier anyway. Safety: server-target code branches on the mode (`entrar/actions.ts` guard, `generateStaticParams` selection), and `docs/implementation/v1-architecture-plan.md:63-66` explicitly forbids accidentally selecting production behavior. Reviewer's line ref "10-12" vs actual 11-12: immaterial. | **UPHELD** | MAJOR stands |
| 8 | Meta-claim of RV-C §0: 7 `"use server"` files / 24 exported actions; 17 registered | §0, F1 | `grep -rln '"use server"' src/` → exactly those 7 files (`entrar/actions.ts:16` and `recuperar/actions.ts:11` are function-level directives, others file-level line 1); per-file export counts 1+1+10+6+4+1+1 = 24; manifest `node` keys = **17**, `edge` = 0. | **UPHELD** | — |

**Headline adjudication of the highest-stakes claim:** RV-C is right that §3.1 has *no mechanism as
written*. My strongest refutation attempts — client-side context/registry, C→C prop threading,
dead-branch ternaries, the two `<form action>` sites being re-fixable via client wrappers — all
still leave one unavoidable physical decision: the `"use server"` modules must be **absent from the
demo bundle graph**, because E625 checks manifest membership (proven by 24-vs-17). The plan must
name a selection artifact; §7.2 ("no `@runtime/*` aliases in `next.config.ts`") is satisfiable but
only via one of the designs below. BLOCKER verdict: **UPHELD**.

---

## A workable Action Seam design the plan could have specified (prose only, no code)

Ranked by fidelity to the plan's own criteria:

1. **Generated per-target entry (best fit; the reviewer's own §4.3 fallback, hardened).** Keep one
   untracked, git-ignored module, e.g. `src/runtime/target.ts`, that is *written* by
   `scripts/next-target.mjs` immediately before spawning `next` — one line re-exporting either
   `target.server.ts` or `target.demo.ts`. Both variant files implement the `contracts.ts`
   interface, so drift becomes a `tsc` error *today*, not at export time; the seam consumers import
   only `@/runtime/target`, a normal relative path. Zero aliases in `next.config.ts` → §7.2
   satisfied literally and in spirit; the demo graph never contains `"use server"` → E625 safe.
   Cost: the generated file must be added to the pre-render env check and CI must run the generator
   (it already does, since `build:demo` runs through `next-target.mjs`).
2. **One surviving, typed alias.** Collapse 9 untyped swaps into `@runtime/target` → one of two
   files, both checked against `contracts.ts`. Cheapest edit; but it is exactly what §7.2 forbids
   by name, so it only works if the criterion is reworded to "one typed selection point."
3. **Dedicated static entry (the repo's own governance answer).** `v1-architecture-plan.md:69-71`
   already prescribes "give the demo a dedicated static entry rather than weakening server
   behavior." Two route subtrees share the presentational client components; each page imports its
   own seam provider module directly (relative import, no alias, no generator). Selection then
   happens by *which tree was written by whom*, which Turbopack can tree-shake because the
   server-provider module is never referenced from the demo tree. This is the only design that
   removes module-resolution switching *entirely*, but it multiplies page files and the plan's Day
   1-2 never budgets it.
4. **What does NOT work (why the props idea fails as written).** Threading handlers as props from
   Server Components is illegal across the S→C boundary (docs `use-client.md:50,56,70` — verified);
   a client-only registry/context is legal *inside* the client graph (C→C props and context values
   are never serialized — already used today via `PortalMutation`), but the registry still needs a
   per-target bootstrap module, collapsing back to designs 1-3. Dynamic `import()` without
   `turbopackIgnore` bundles both variants → registers the 17 actions → E625; with
   `turbopackIgnore` it is untypechecked and fails at runtime on a static host. `process.env`
   ternaries around static imports don't strip ESM registration.
5. **Does the legal design reintroduce aliasing?** Design 1 reintroduces *selection* but not
   `next.config.ts`/`tsconfig.json` alias pairs: one generated re-export replaces all 18 alias
   entries, is typechecked against the contract, and is visible in the dependency graph. The plan
   should state this trade explicitly; §7.2's wording ("no aliases in next.config.ts") is then
   honestly achievable.
6. **The two Server-Component `<form action>` sites** are then fixed by moving each sign-in/sign-out
   form into a small Client Component that imports the seam from `@/runtime/target` internally —
   no throwing stubs (`demo-auth-actions.ts`) needed, no mode-conditional JSX at those two spots.
7. **Data readers** (12 specifiers, async Server Components executed during export) cannot go
   through a runtime seam at all — they are *build-time* calls (localStorage doesn't exist in the
   prerender Node context, `adult-portal-demo-store.ts:347` proves the fallback). They must import
   the generated `target.ts` read side (or design 3's per-tree import). §3.1 should say "actions
   and readers both resolve through the typed target module," not just "actions."

---

## Findings the reviewer missed

* **M1 — The E625 gate has no `buildExport` exemption, unlike its siblings.** `export/index.js:336`
  (i18n) and `:343` (images) are guarded by `!options.buildExport`; the server-action block
  `:357-386` is not. This *strengthens* F1 (the gate cannot be dodged by calling the export
  differently) but the reviewer didn't note the asymmetry. Also, RV-C's "after compile + prerender
  of every route" is one step too late: the throw precedes "Start the rendering process"
  (`export/index.js:388`), so Day 4 fails at the compile→export handoff, minutes earlier than
  claimed. Net: F1 conclusion intact, timing story slightly wrong.
* **M2 — `recuperar/actions.ts` is not merely "zero production consumers": it is fully orphaned.**
  Its only sibling, `entrar/recuperar/page.tsx`, is `"use client"` and never imports the action
  (uses `useState`; grep for `requestPasswordResetAction` matches only its own definition) — yet
  `out/entrar/recuperar/index.html` ships a dead page in the demo export. F1's manifest arithmetic
  is right, but this specific dead action's *page* silently exports a non-functional form.
* **M3 — A third legal fix exists for the two `<form action>` Server-Component sites** (see design
  point 6): client-wrapper + internal seam import. RV-C presented a false dichotomy
  ("non-serializable prop or registered action"); refuted at that sub-claim, though it does not
  save §3.1.
* **M4 — The repo has already disarmed every other static-export gate, which makes the plan's
  Day-4 gate even weaker than F2 says.** `images.unoptimized: true` (`next.config.ts:30`) defuses
  E603 (`export/index.js:345-354`); no interception routes exist (E626 at `:368`); `i18n` unset
  (E587). E625 is the *only* realistic export landmine left, and it is precisely the one §3.1 steps
  on — a passing `build:demo` therefore proves nothing except that the seam was wired correctly,
  which reinforces F2's demand to assert the server-reference manifest is empty (the manifest file
  `.next/server/server-reference-manifest.json` exists post-build and is trivially checkable).
* **M5 — Demo secret blanking in `next-target.mjs:41-53` is keyed on the target, not the command**,
  so `npm run dev:demo` blanks the same variables. Not a defect, but the plan's §3.4 rationale and
  RV-C's row both say "during `build:demo`"; the real scope is wider (documented behavior, worth
  one line in any corrected plan text).

## Verdict summary

RV-C severity roll-up re-rated: F4 BLOCKER **upheld** (mechanism absent as written; salvageable
only with a named selection artifact the plan deletes without replacing); F5.4 deep-link BLOCKER
**upheld** (3/3 prerendered class pages, seed-only params, no SPA fallback); F2 MAJOR upheld;
F3 fully reproduced (9/9/38/23 — every number exact); F6 both MAJOR rows upheld verbatim; F5.1-5.3
MINORs upheld verbatim. Imprecisions found: `runNextExport` naming, "after prerender of all
routes" (fails before export rendering), the two-site dichotomy in F4.2.3, and "⇒ alias" phrasing
in F4.2.2 — none change any severity. As an adversarial verifier I could not refute the review's
central claim.
