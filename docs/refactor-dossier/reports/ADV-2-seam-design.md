# ADV-2 — Adversarial attack on the §3.1 generated-seam *design conclusion*

**Target:** not the line counts. The conclusion: *"replace this repo's 9 `@runtime/*`
build-time aliases with generated per-target entry files."*
**Method:** read-only against tracked files. `git status --short` at the end of this pass is still
`?? docs/refactor-dossier/`, and `tsconfig.tsbuildinfo` md5 is `252a0a7726f8e6d88e4fa82633cb4796` —
byte-identical to the value VER-F recorded, so nothing I ran perturbed the tree.
**Commands run:** `npx tsc --noEmit` (repo + 5 synthetic projects built in
`%TEMP%\adv2`, all scratch outside the repo), `npx vitest run` (repo baseline + 2 probe configs
against scratch test files in `%TEMP%\adv2\aliasprobe`), `node` forensics over
`.next/server/server-reference-manifest.json`, `.next/server/chunks/ssr/*_actions_*.js`,
`.next/static/chunks/*.js`, `out/_next/static/chunks/*.js`, `node_modules/next/dist/**`
(`export/index.js`, `build/webpack/loaders/next-flight-loader/index.js`,
`build/create-compiler-aliases.js`, `server/app-render/action-handler.js`), and string probes of
`@next/swc-win32-x64-msvc.node`. No `next build`, no `next dev`, no database contact.

---

## Verdict: **build the cheap version**

Do **not** generate `src/runtime/target.ts` / `readers.ts`. Land the *typing* conclusions of
INV-B/VER-B (an explicit named surface, `satisfies` against a real contract, a non-imported parity
file) on top of the **existing 9 aliases**, and add the three artifacts that actually close the two
real holes: `tsconfig.demo.json` + `typecheck:demo`, and a `resolve.alias` block in
`vitest.config.mts`.

**Cost:** ~5-6 h, 14 files touched, **0 new runtime/build machinery, 0 new failure modes, 0
import-site rewrites, 0 unverified Next internals.** The generated design is ~2-3 days, ~14 new or
rewritten files, and 6 new failure modes, of which VER-B itself proves two are invisible to every
existing gate.

### The single strongest argument against my own recommendation

The cheap option **preserves a second, independent resolution channel and doubles it.** Aliases are
consulted separately by `tsc` (`tsconfig.json:24-42`) and by Turbopack (`next.config.ts:42-80`); the
cheap option adds a *third* table (`tsconfig.demo.json`), so the same 9 names are hand-maintained in
**three** places whose only tie is a 27-line textual duplication, and nothing but a build catches a
`paths` block that drifts from `resolveAlias`. Worse, it cannot express *"no Client Component may
import a data reader"*, because there is no single module to fence: the boundary rule must enumerate
`@/runtime/adult-portal`, `@/runtime/player-access`, `@/runtime/game-events` (3 patterns) instead of
one seam path, and it must be a lint rule (declared intent) rather than `server-only` (a bundler
error). If the project's real goal were *"one seam, enforced by the compiler, forever"*, the
generated file would be the better answer and my recommendation would be wrong. I am recommending
the cheap version because **none of the three goals the generated design is sold on is actually
outstanding** — E625 does not fire today, server infra does not reach the demo browser bundle today,
and 95 `runtimeMode` branches survive it — so the durability argument is weighing a risk that this
codebase has not been shown to carry.

### Why the conclusion collapses: the motivation was already false when it was adopted

`REFACTOR_PLAN.md:124` and `:130` sell §3.1 as the thing that "effortlessly pass[es] E625".
`VER-F` §"Which rationale is true" demolished that: the demo build **already** registers 0 action
ids, and §3.1(3) *preserves* a property that already holds. I re-derived it independently from this
repo's own shipped demo bundle rather than from a dev manifest:

| Probe over `out/_next/static` (31 JS chunks — the actual `build:demo` output) | Result |
| :-- | --: |
| files containing a 42-hex action id | **0** |
| occurrences of `@prisma/client` / `PrismaClient` / `pino` / `neon-gateway` / `getNeonAuthServer` / `APPLICATION_SECRET` / `server-only` | **0** each |
| the one chunk containing the string `createServerReference` | the react-flight **factory definition** (`r.createServerReference=function(e,t){…}`), not a registration |

So the demo browser bundle is provably action-free *and* server-infra-free today, and what makes it
so is the `"use server"` boundary (`VER-B` #11), not the alias set. Once the build-failure rationale
is gone, §3.1 is left selling type-safety and testability — and **both are delivered by the
audit's own already-approved Phase 1**, `docs/architecture-audit-2026-09-23.md:626-628`:

> 4. Add `tsconfig.demo.json` (paths -> demo variants) and a `typecheck:demo` npm script; run both in CI.
> 5. Add `resolve.alias` entries for `@/runtime/*` in `vitest.config.mts`; add one smoke test per contract member…

I ran both of those steps literally, out of repo, and they work:

```
%TEMP%\adv2\paths.demo.json   — repo tsconfig, all 9 @runtime/* → demo variants
  → npx tsc -p … --noEmit                       → EXIT 0   (whole src/ + tests/ graph)
%TEMP%\adv2\paths.rename.json — one alias → a shim exposing 1 of 9 names
  → npx tsc -p … --noEmit                       → 8 × TS2305/TS2724 at the real call sites
%TEMP%\adv2\aliasprobe\vitest.probe.mts — 3 alias lines, `@runtime/*` ordered before `@`
  → npx vitest run --config …                   → 1 passed in 300 ms
     (awaited getPortalShellData() → effectiveRole === "platform_admin";
      loadClientPortalState() → object; listStaticClassIds().length === 3)
```

**That is the decisive comparison.** The audit's cheap step 4 already delivers the drift detection
§3.1(2) promises (rename/missing export → loud TS2305 at call sites, in the demo shape), and cheap
step 5 already delivers the seam testability that `NOTE-00 §4` scored as *the generated file's one
real payoff* — in 3 checked-in alias lines, deterministic, no generator. The dossier would be
discarding an approved design for a novel one **to buy two things it can already have.**

`VER-B` #17 is the smoking gun it never noticed: its own drift experiment *was* the cheap
option's mechanism. It typechecked all of `src/` against "all 9 demo variants" via a synthetic
`tsconfig` in `%TEMP%`, got 0 errors, and recorded that as a refutation of `INV-B` — without ever
observing that the refuting instrument is a shippable 20-line file.

---

## Attack 1: cost comparison (hours, files, gates)

| Dimension | **Cheap:** keep 9 aliases + `tsconfig.demo.json` + `typecheck:demo` + vitest aliases + `satisfies` | **Generated:** `target.ts` + `readers.ts` per VER-B's "Day 2 must actually contain" |
| :-- | :-- | :-- |
| New files | `tsconfig.demo.json`, `src/runtime/contracts.ts`, `contracts.check.ts`, 1 seam test file (**4**) | `contracts.ts`, `contracts.check.ts`, `target.ts`*(gen)*, `target.server.ts`, `target.demo.ts`, `readers.ts`*(gen)*, `readers.server.ts`, `readers.demo.ts`, `sign-in-form.tsx`, `sign-out-button.tsx` (**10**) |
| Existing files edited | `package.json` (1 script + `check`), `vitest.config.mts` (3-9 alias lines), 9 variant files (`satisfies`), `ci.yml` (+2 lines) ≈ **13** | the 4 alias/config files (`next.config.ts`, `tsconfig.json`, `.gitignore`, `.prettierignore`), `scripts/next-target.mjs` (new `node:fs` write path), **23 files / 24 import statements rewired**, 5 demo readers made `async`, `next-target.mjs` + `postinstall`/`pretest` wiring, 2 route hosts converted SC→CC ≈ **35+** |
| Net new *executable machinery* | none | a code generator with byte-stability, prettier-conformance, refuse-without-target, and write-ordering constraints, run before every `dev`/`build` |
| New failure modes introduced | 3 path tables to keep textually in sync (all divergences loud: TS2307 or E625) | **6**: file absent · stale-mode→demo build (E625, after compile+typecheck) · **stale-mode→server build (caught by nothing; ships a localStorage demo as production)** · committed generated file · `format:check` red · two concurrent dev servers sharing one seam (`npm run dev` + `dev:demo` have separate `distDir`s but one source file) |
| Catches the "ships silently" mode? | n/a — the mode cannot exist (resolution is a function of `APP_RUNTIME_MODE`, already Zod-parsed at `next.config.ts:5-7`) | requires a **new** `TARGET_MODE !== getRuntimeMode()` prerender assert ×2. This is a control for a hazard the design itself creates. |
| Fresh clone / CI | `npm ci && npm run check` works unchanged | `check` **fails on a fresh clone** (VER-B O7) until `postinstall` pregenerate or an explicit generate step exists |
| Tests the seam? | yes — proven above, 300 ms, deterministic | yes, but **mode-dependent on whatever build a dev last ran**: `package.json:21` is bare `vitest run`, it does not invoke `next-target.mjs`, so `@/runtime/target` resolves to the stale on-disk variant. The alias block is strictly *more* deterministic here. |
| Server-variant tests | neither option has them. `vitest.config.mts:11-15` is one node project with `APP_RUNTIME_MODE: "demo"`; a second project is needed either way (VER-B O5). **The generated design's headline testability win is one-sided.** |
| Typechecks both variants per `tsc` run? | No — two runs. Measured cost: cold `tsc --noEmit --incremental false` = ~6.7 s (VER-F), so **~14 s** for both. | Yes, via `contracts.check.ts`. Saves ~7 s of CI. |
| E625 safety | unchanged (already holds; `resolveAlias` is global, not per-route) | unchanged (already holds) |
| Realistic effort | **5-6 h** | **2-3 days** (the audit's own estimate for a *smaller* Phase 1: "1.5-3 days") |

**What the generated design buys beyond the cheap option, precisely:** (i) one `tsc` invocation
instead of two (~7 s); (ii) a single public surface that cannot expose a surplus name (the
`export {…}` list — but the cheap option gets the same by never importing a non-contract alias
member); (iii) **nine aliases become zero aliases.** That is the complete list, and (iii) is
aesthetic: `VER-B` C-3 already downgraded INV-B's "silently resolves server variants" scare to "a
maintainability argument, not a silent-failure one". **One alias instead of nine, plus a generator to
manage it.** That is the textbook definition of the overengineering the guiding principle forbids.

---

## Attack 3: is the two-file design even implementable?

**Yes — and the brief's stated reason for doubting it rests on a false premise.** But the *directive
rule* is not the one the dossier states.

### The premise is wrong: `use-demo-portal.ts` is not a reader

`src/components/portal/use-demo-portal.ts:6` imports **`loadClientPortalState`**, which `INV-B`
itself classes **(d) bridge**, not (a) reader. Re-counted here: 15 of 15 reader specifiers are
imported only from the 12 Server Component files; **0** from any `"use client"` file. So "the demo
readers run in the browser after hydration" is not true of any reader — hydration re-reads go
through the bridge half, which the design does *not* fence. The hazard the brief asks me to find
does not exist on the readers half; it exists on the **bridge** half, and the design happens to get
it right by accident (bridges live in `target.ts`).

### Why `server-only` on the *demo* reader variant is coherent

`server-only` is resolved **per compile layer, not per file** —
`node_modules/next/dist/build/create-compiler-aliases.js`:

```
:219  return isServer ? { 'server-only$': 'next/dist/compiled/server-only/empty',   ...
:224              ... : { 'server-only$': 'next/dist/compiled/server-only/index',   ...
```

`server-only/empty` is 0 bytes; `server-only/index` is a bare top-level `throw`. The demo readers
execute only in `generateStaticParams` and async Server Components — both **Node/RSC layer** during
the export — so the directive resolves to the empty module. This repo already proves it:
`adult-portal-server.ts:1`, `player-access-server.ts:1`, `game-events-server.ts:1` all carry
`import "server-only"` and `out/` contains 104 exported documents. **A `server-only` demo reader
does not break the browser build; a `server-only` *client-imported* module does.** The fence is
therefore real and correctly placed, and `VER-B` C-4's severity re-calibration ("a green build that
crashes at hydration") applies only to the *merged* single-file seam that the split exists to
replace.

### The correct arrangement, stated as a rule (this is what the dossier should say)

The split is **not** "actions vs readers". It is *"does this code ever execute in the browser?"*

| Half | Runs in browser? | `server-only`? | Why |
| :-- | :-- | :-- | :-- |
| readers (15) | never — RSC + `generateStaticParams` only | **both variants, yes** | a fence, not a fix. In demo it converts a *currently-working* mistake (a client file reading localStorage would run fine) into a build error in both modes. That is its whole value. |
| mutations/queries (18) | yes in demo (plain fns); stubbed in server | **no** | the `"use server"` directive is already the fence (`VER-B` #11) |
| bridges (3) | **yes, always** (`adult-portal-demo-client.ts` reads `localStorage`) | **must never** | fencing it would break the demo at hydration — this is where the brief's fear actually belongs |

### Three defects in the design *as stated* (all fixable, none fatal)

1. **`INV-B` requirement 2's directive advice is actively wrong for the demo half.** It says the
   seam file should carry no directive "so it can be imported from either layer's *Server* half too,
   e.g. `entrar/page.tsx`" — while `target.demo.ts` aggregates four modules that carry
   `"use client"`: `adult-portal-demo-actions.ts:1`, `player-access-demo-actions.ts:1`,
   `player-entry-demo-actions.ts:1`, `adult-portal-demo-client.ts:1`. An undirected barrel that
   re-exports a client boundary, imported by a Server Component, yields
   `registerClientReference` proxies whose invocation throws
   *"Attempted to call X() from the server but X is on the client"* — a string present in
   `@next/swc-win32-x64-msvc.node` at `@83186566`, so Turbopack implements it. **Mandatory:** strip
   the redundant `"use client"` from those 4 leaves before folding them into a variant (safe — the
   boundary is already established by all 11 importing files' line 1).
2. **`export *` is forbidden by Next itself, which nobody cited.**
   `next-flight-loader/index.js:105-111` hard-errors
   `It's currently unsupported to use "export *" in a client boundary. Please use named exports
   instead.` (E46). `VER-B` justified the named list on *type* grounds only and proved those weak
   (see Attack 5). The bundler argument is the load-bearing one — and it is missing from the file
   that mandates the rule.
3. **The fence costs testability the repo has for free today, and I broke it on purpose.**
   `%TEMP%\adv2\aliasprobe\gen\readers.demo.fenced.ts` = `adult-portal-demo.ts` + `import
   "server-only"`, identical test otherwise:
   ```
   FAIL seam.test.ts — Error: Cannot find package 'server-only'
        at readers.demo.fenced.ts:1:1     (Duration 194ms)
   ```
   `server-only` is genuinely not installed (`node_modules/server-only` absent; `package-lock.json`
   carries only `client-only`). So `INV-B` gate 5 ("a seam unit test that could not exist before")
   is **false as soon as its own requirement 2 lands**: fencing `readers.demo.ts` destroys the one
   thing it claims to buy, and the rescue is a vitest `resolve.alias` stub — which then makes the
   fence inert in the one place a developer would see it fire. `REFACTOR_PLAN.md` and both reports
   present the fence as free. It is not.

---

## Attack 4: R1 resolution + the exact Day-2 spike

### Settled from this repo's own compiled output — no reasoning required

`INV-B` rated the re-export hop "the single highest-risk unknown in §3.1"; `VER-B` got it to ~85% by
reading the flight serializer. The mechanism is stronger than either of them claimed: **Next's
server-action dispatch *is* a named re-export through an intermediate module.** Three facts, each
read out of `e5aaf1e`:

1. **The id is bound to the function object, and the marker function returns that same object.**
   `.next/server/chunks/ssr/[root-of-the-server]__0388x3u._.js` (compiled
   `portal/player-access-actions.ts`):
   ```js
   ensureServerEntryExports([r,s,t,u]),
   registerServerReference(r,"603876f8e987873fcb20726cc85908d64946875c52",null),
   registerServerReference(s,"60d76d4778638f6f9faf036214a9c4a844c50c3fe3",null), …
   ```
   and the runtime it calls (same build, module `23932`'s neighbour):
   `c.registerServerReference=function(a,b,c){return A(a,b,null,c),a}` — **returns `a` unchanged**.
   Any number of re-export hops moves the same object.
2. **Dispatch indexes a generated per-worker module by id.**
   `node_modules/next/dist/server/app-render/action-handler.js:816-818`:
   ```js
   const actionMod  = await ComponentMod.__next_app__.require(actionModId);
   const actionHandler = actionMod[actionId];
   ```
   and `actionMod` is a file this repo already ships —
   `.next/server/chunks/ssr/1ja3_portal_resultados_[classGroupId]_players_[playerSlotId]_page_actions_1bac705.js`,
   280 bytes, whose entire body is:
   ```js
   a.s(["00a9543d569a149851c699b7d0e296e744ccccab12",()=>b.signOutAction],48038)
   ```
   i.e. `export const <actionId> = () => originModule.signOutAction` — a **named re-export of a
   server reference**, which is exactly the construct the plan is afraid of. The seam barrel never
   appears in this path.
3. **Client-layer named stubs already exist and already cross one boundary.**
   `.next/static/chunks/1jog54l9252qe.js`:
   `createServerReference("40457200db3d54600617fe920881684323c5ade4a4", callServer, void 0,
   findSourceMapURL, "resolvePlayerEntryAction")`.

The `INLINE_ACTION_PREFIX = '$$RSC_SERVER_ACTION_'` special-case at `action-handler.js:831` turned
out to be **dev request-logging only** (gated at `:822` on `NODE_ENV === 'development'`), not
dispatch — so the inline directive in `entrar/actions.ts:16` is not a dispatch hazard either.

**Residual: ~3%.** Not "does the hop work" — it demonstrably does.

### The one combination that has genuinely never been exercised here (this is the real R1)

Which action names are present in the server build's **client** chunks today:

| Action | directive style | importers today | in `.next/static/chunks`? |
| :-- | :-- | :-- | :-- |
| `resolvePlayerEntryAction` | file-level `"use server"` | **client components** | **yes (1)** |
| `createClassAction` | file-level `"use server"` | **client components** | **yes (1)** |
| `signOutAction` | file-level `"use server"` | SC only | **no (0)** |
| `signInAction` | **function-level `"use server"` inside the body** (`entrar/actions.ts:16`) | SC only | **no (0)**, and `$$RSC_SERVER_ACTION` appears nowhere either |

File-level directive + client importer + a hop = proven. The novel thing §3.1(4) creates is
**`sign-in-form.tsx` (a Client Component) importing an inline-directive action through two
undirected barrels, where no client chunk in this repo has ever contained that reference at all.**
That is the residual, and it is narrow, named, and cheap to kill.

### Exact Day-2 spike (≤20 min, 5 scratch files, 1 build, 1 dev submit)

Sequence it so **one build answers four questions** (R1, inline-directive, merged-seam severity,
side-effect pruning). Do it on a scratch clone outside the repo, or on a throwaway branch.

1. `src/runtime/spike.target.server.ts` (~6 lines)
   ```ts
   export { signInAction } from "@/app/(professional)/entrar/actions";
   export { signOutAction } from "@/app/(professional)/portal/sign-out-action";
   export { createClassAction } from "@/app/(professional)/portal/adult-portal-actions";
   ```
2. `src/runtime/spike.target.demo.ts` (~5 lines) — `export { getPortalShellData } from
   "./adult-portal-demo";` plus `import "server-only";` on line 1 (tests the fence on a *demo* file).
3. `src/runtime/spike.target.ts` (~2 lines) — `export * from "./spike.target.server";` — deliberately
   the shape the design forbids, to see whether E46-style handling exists in Turbopack.
4. `src/components/portal/spike-sign-in.tsx` (~10 lines, `"use client"`) — imports `signInAction`
   from `@/runtime/spike.target` and `getPortalShellData` from the same barrel (**the merged-seam
   probe: a client component statically depending on the reader half**), renders
   `<form action={signInAction}><button>spike</button></form>`.
5. Mount it once in `src/app/(professional)/entrar/page.tsx` (one import, one JSX line).

Commands and the observables that decide it:

```bash
npm run build:server
node -e 'const m=require("./.next/server/server-reference-manifest.json");
  const ids=Object.keys(m.node);
  console.log("ids:",ids.length);                                   // 17  → hop is transparent
  console.log("by file:", ids.map(i=>m.node[i].filename+":"+m.node[i].exportedName)
    .filter(s=>/entrar|sign-out/.test(s)));                         // origin path, original names
node -e 'const fs=require("fs");let n=0;for(const f of fs.readdirSync(".next/static/chunks"))
  {const s=fs.readFileSync(".next/static/chunks/"+f,"utf8");
   if(/createServerReference\("[0-9a-f]{42}"/.test(s))n++;}console.log(n)'
grep -c "getPortalShellData\|PrismaClient\|neon-gateway" .next/static/chunks/*.js
npm run dev   # then submit the spike form once
```

| Observable | Meaning |
| :-- | :-- |
| count **stays 17**, `filename`/`exportedName` still name the origin | hop is transparent; **R1 dead, proceed** |
| a new id whose `exportedName` is a spike name | transform re-keyed by the seam binding — re-export **under the original names only** |
| manifest drops to 16 | the inline directive did not survive the hop → **use `export {x} from` (proven form), not a destructured object; if that also fails, fall back to one surviving `@runtime/*` alias** |
| `build:server` fails on `getPortalShellData` reaching a client entry | `turbopackInferModuleSideEffects` does **not** prune → the two-file split is mandatory (good news: settled, not assumed) |
| build is **green** but `PrismaClient` matches a `.next/static` chunk | `VER-B` C-4 confirmed: it is a runtime throw, not a build error → `server-only` + a manifest gate are load-bearing, not belt-and-braces |
| dev submit: flight `POST` + mutation persists | fully resolved |
| dev submit: plain **GET navigation to the page URL** | progressive-enhancement form action lost → abandon the merged barrel for the auth pair and keep `<form>` in the SC |

**And one mandated change to the design regardless of the outcome:** replace `INV-B` requirement 1's
`const target: Contract = serverTarget; export const { a, b } = target;` with
**`export { a, b } from "./target.server"`** and move the contract check to the non-imported
`contracts.check.ts`. The destructured-object form is the *only* part of R1 that was ever
non-trivial (`VER-B` R1a), it is the form the compiled evidence shows Next does **not** use, it
forces every `createServerReference` stub to be evaluated at module init (which defeats the very
side-effect inference that would rescue a merged seam), and the annotation buys nothing — see below.

---

## Attack 5: drift experiment reproduced? — Reproduced, and it refutes the design's own typing story

### 1. VER-B's three runs: reproduced exactly

| Config (all in `%TEMP%\adv2`, repo untouched) | Result |
| :-- | :-- |
| repo `tsconfig.json` (9 → server), `--incremental false` | **0 errors** |
| `paths.demo.json` (9 → demo variants) | **0 errors** |
| `paths.control.json` (`@runtime/adult-portal` → `src/runtime/mode.ts`) | **11 errors: 9 × TS2305 + 2 × TS7006** — resolution confirmed live |

So "a wrong-mode tree typechecks clean" is **true and reproduced**, and `export *` cannot fix it.
Agreed.

### 2. But the *proposed cure* also does nothing. New experiment.

`INV-B` requirement 2's load-bearing claim: *"`adult-portal-demo.ts:15,19,31,61` and
`player-access-demo.ts:14` are sync `function`s and are **not assignable** [to `Promise<T>`]"*;
`VER-B` repeated it and made "make the 5 sync demo readers `async`" a Day-2 step. **That is false.**
Revealing the real inferred types out of repo:

```ts
const probeDemo: number = adultDemo.getPortalShellData;
// TS2322: Type '() => Promise<PortalShellDto>' is not assignable to type 'number'.
const probeDemoClass: number = adultDemo.getClassPageData;
// TS2322: Type '(classGroupId: string) => Promise<ClassDetailDto>' is not assignable to type 'number'.
```

The "sync" demo readers `return service().getShell(...)` where `getShell` is `async`
(`src/application/adult-portal/service.ts:121`), so their inferred return type is **already
`Promise<…>`**. A sync function returning a Promise *is* assignable to a `Promise<T>` slot. Then the
full-axis probe against a hand-written contract over the **real** types:

```ts
interface Readers { getPortalShellData(): Promise<PortalShellDto>; /* …5 more… */ }
export const a1Demo:  Readers = Object.assign({}, adultDemo,  paDemo);   // A1 sync↔async  → NO ERROR
export const a1Server: Readers = Object.assign({}, adultServer, paServer);               //        → NO ERROR
interface Bridge { loadClientPortalState(): DemoAdultPortalState | null }
export const a2Server: Bridge = serverClient;   // A2 nullability → NO ERROR (INV-B *chose* the union)
interface SignIn { signInAction(fd: FormData): Promise<void> }
export const a3Demo:   SignIn = { signInAction: async () => {} };  // A3 arity → NO ERROR
export const a4Extra:  Readers = paDemoActions;   // A4 surplus class export → only TS2740 for the
                                                  // *missing* names; surplus names are never flagged
```

**Every one of the drift axes the contract is supposed to police passes the contract silently.**
The only errors were `BridgeNonNull` (which arises *because* INV-B deliberately picked the union as
"the only sound type" — the design chooses its own blindness) and a missing-name case. So:

- **`contracts.ts` + `satisfies` detects zero drift that `tsconfig.demo.json` does not already
  detect — and detects strictly *less*, because it checks against a hand-written interface while
  `typecheck:demo` checks against the 24 real call sites.** The parity file's genuine value is
  narrow: it lets one `tsc` run cover both variants (worth ~7 s), and it fails on a *missing*
  contract member. Nothing more.
- The **`TARGET_MODE` assert is therefore not a belt to the parity file's braces — it is the only
  control that catches the one failure mode that can ship** (stale demo seam during `build:server`:
  `tsc` blind per #17 above, `vitest` blind per `vitest.config.mts:5-11`, `lint` non-type-aware,
  E625 requires `output === 'export'`). `VER-B` reached this conclusion; the framing it inherited
  ("the parity file is what delivers §3.1(2)") does not survive the experiment.
- The **named export list still earns its place, but for a reason neither report gave**: not types —
  `next-flight-loader/index.js:105-111` makes `export *` across a client boundary a *hard build
  error* (E46). That is the argument to put in the dossier; the typing argument is not one.

**Net:** §3.1(2)'s "ensuring compile-time drift detection" is achieved by the cheap option
(`typecheck` + `typecheck:demo` + `satisfies`), is *not* improved by generating files, and the
generated design's extra type machinery should be reduced to one `contracts.check.ts` and two
`TARGET_MODE` asserts if anyone insists on building it.

---

## What the seam legitimately fixes vs what it only renames

### Fixes nothing that is broken today

| Claimed | Reality, re-verified |
| :-- | :-- |
| "passes E625" | `out/_next/static`: 0 action ids, 0 server-infra strings, 104 documents exported. Property already holds. |
| "isolates production infrastructure from the browser" | It does not, and cannot, at §3.1's scope (see below). |
| "compile-time drift detection" | Delivered by `typecheck:demo`; the contract adds none (Attack 5). |
| "removes mode branching" | See below. Net negative. |
| "one seam instead of nine aliases" | True. Cosmetic. |

### Does the seam isolate anything? (Attack 2)

**No.** I verified both halves of `VER-B` O2 and corrected its scope:

- **Browser graph: already clean, and not because of the aliases.** `out/_next/static` (demo) and
  the server build's `.next/static/**` contain no `@prisma/client`, no `neon-gateway`, no `pino`, no
  implementation strings. Two mechanisms do this, and **neither is `@runtime/*`**: (1) the
  `"use server"` directive *is* a bundling boundary — a client importer gets
  `createServerReference(...)` and nothing else; (2) the `@/server/**` specifiers in `src/components`
  are **all `import type`** (`activity-controls.tsx:4`, `class-groups-explorer.tsx:6`,
  `material-editor.tsx:9`, `materials-explorer.tsx:6`, `portal-shell.tsx:4`, `status-badge.tsx:1`) —
  erased, so they never were runtime edges. The 9 aliases fence **nothing**.
- **Prerender/Node graph: reaches server infra, unavoidably, and the seam does not touch it.** The
  real entry is not the seam at all: `src/app/api/v1/player/state/route.ts:4-11` statically imports
  `@/server/services/game-state-container` → `@/server/db/client` → `@prisma/adapter-neon`, and
  declares `export const runtime = "nodejs"`. All four `api/v1/player/*` handlers are POST-only
  (re-verified: `grep "export async function GET|POST|…"` over `src/app` → **0 matches**), so the
  exporter drops them from `out/` but the compile still loads Prisma and `pino` in Node. Also
  `src/application/adult-portal/service.ts:11` and `src/application/player-access/service.ts:2`
  import `@/server/authorization/v1-policy` **by concrete path**, so the *domain layer the demo is
  built on* already reaches into `@/server/` — the seam is on the wrong seam line.
- **So is it architectural or cosmetic?** On isolation: **cosmetic, and the dossier must stop
  implying otherwise.** On *naming*: architectural, but `VER-F` already showed the clause that
  discriminates is the alias count, not the manifest.
- **What would actually reduce demo reachability of server infra** (and it is *not* in §3.1's
  scope, so it should be stated as a separate, probably declined, item): (a) stop compiling the
  `api/v1/**` tree in demo mode — there is no per-target route exclusion in Next 16.3.2, so this
  means either moving handlers under a directory the demo build generates away (more generation
  machinery, same class of cost this report argues against) or accepting it; (b) re-point the two
  `@/server/authorization/v1-policy` value imports at `src/application/authorization/` (the file the
  purge already touches), which is a **2-line, zero-machinery fix** and the only genuine layering
  defect in the demo graph. Recommend (b), decline (a), and delete "isolates the server graph" from
  the seam's rationale.

### The 95 `runtimeMode` branches: what deletes, what stays, what is a defect

Re-measured: **95 occurrences / 23 files**, exactly. Classification of all 95:

| Category | Sites | Seam's effect |
| :-- | --: | :-- |
| `import { getRuntimeMode } from "@/runtime/mode"` | 17 | unchanged (18 after adding `contracts`-side asserts) |
| `runtimeMode: RuntimeMode;` prop-type declarations | 17 | unchanged |
| prop threading (`runtimeMode={…}`) / `useEffect` dep arrays | 17 | unchanged |
| **explicit decision points `runtimeMode === / !==`** | **34** | **unchanged** |
| derived `isDemo` / `isDemoRuntime()` references | 10 | unchanged |

Plus the module-resolution decisions the aliases **already** moved into `next.config.ts` — the seam
moves them again and deletes nothing. **After the design lands: 34 → 34 decision points, plus 2 new
`TARGET_MODE !== getRuntimeMode()` asserts, and `INV-B` requirement 4 relocates ~9 of them from
`entrar/page.tsx`/`portal-shell.tsx` into two new client components.** `VER-B` R6 said the count
"does not shrink"; the honest statement is **it grows by two.**

**Which sites are genuine defects (branching on deployment target when the fact should be a prop or
a DTO field)?**

- **Defect, ~10 branches + ~10 prop types + ~10 threading sites ≈ 30 of the 95:** the "this is a
  demo, data lives in your browser" notice — `classes-screen.tsx:76`, `organizations-screen.tsx:64`,
  `overview-screen.tsx:69`, `class-detail-screen.tsx:92`, `organization-detail-screen.tsx:114`,
  `team-screen.tsx:93`+`128`, `player-credential-print-sheet.tsx:137`,
  `player-entry-screen.tsx:103`+`116`+`144`, `portal-shell.tsx:51` (`<DemoRoleControls/>`). One
  concern wearing eleven faces. Fix: put `demoNotice: boolean` on `PortalShellDto` (the reader
  already returns `effectiveRole`, so the channel exists) or extract one `<DemoOnly>` component, and
  **delete the `runtimeMode` prop from 8 components**. Zero new machinery, ~1 h, and it is the only
  item in this whole area that reduces a count. **Independent of the seam.**
- **Defect, 3-4 sites:** `portal-shell-context.tsx:30,55,70` and `portal-navigation.tsx:58` all test
  `runtimeMode === "demo" && demo` — the presence of the `demo` prop already implies demo. Two props
  encoding one fact; the belt is the bug. `team-screen.tsx:93`+`:99` likewise branch `demo &&` and
  `server &&` on the same slot: one ternary.
- **Defect, 2 sites, and the seam makes these *worse*:** `entrar/actions.ts:20-22`
  (`if (getRuntimeMode() !== "server") redirect("/portal")`) and
  `portal/sign-out-action.ts:9-11` (`if (getRuntimeMode() === "server") …`). Both are
  **provably-constant guards inside single-target modules** — the file is only in the server graph,
  and `next.config.ts:5-7` pins the mode, so one arm is dead code. Note what that means: the server
  `signInAction` **already implements the demo behaviour** ("navigate to `/portal`"), which makes
  `demo-auth-actions.ts:2`'s `throw new Error("Demo sign-in uses static navigation.")` redundant
  with a live implementation sitting in the other file. Deleting 5 lines fixes this; generating two
  files leaves a branch in `target.server.ts` whose whole purpose is to say "I am the server target".
- **Inherent, must remain render decisions, do not touch:** `layout.tsx:22`
  (`await connection()` only in the dynamic target), `game-host.tsx` 15 sites (API `POST` vs the
  IndexedDB offline queue, `<iframe>` vs `<DemoGameAdapter/>`), `player-access-workflow.tsx`'s 3 real
  branches, `jogar/page.tsx:8`, and the demo auth `<Link>` (because
  `redirect.md:54`: "`redirect` can be called in Client Components during the rendering process
  **but not in event handlers**").
- **Deleted by the purge, not the seam:** 5 sites in `(public-play)/atividade/[token]/**`
  (`jogar/page.tsx:11`, `jogar/[state]/page.tsx:41`, `[token]/page.tsx:11`,
  `[token]/[state]/page.tsx:48`, `[token]/layout.tsx:21`).

**"What does done look like":** after §3.1, 34 behavioural branches and 34 `runtimeMode` prop
declarations. After the two bullet fixes above, ~24 branches and 8 fewer components that know the
deployment target exists. **That is the real goal, and the generated seam contributes nothing to it.**

---

## Contract surface (real signatures) and where it cannot be expressed

Built from the consumer inventory against the actual sources (not `INV-B`'s transcription).
**15** reader specifiers = 11 page-scoped reads + 4 sync static-param readers (`INV-B`'s "12 page-scoped
+ 3 generateStaticParams" is miscounted; the totals per module are `adult-portal-server.ts` 7+2,
`player-access-server.ts` 1+0, `game-events-server.ts` 3+2); **14** mutations
(`(prev, formData) ⇒ …`); 1 client-invoked query; 2 auth actions; 3 bridges ⇒ **20 members on the
UI-safe seam, 35 in total**. (Note `VER-B` C-1: `INV-B`'s per-table specifier split was 18/20;
the true split is 17/21.)

```ts
// ── readers ── 11 awaited by async Server Components
getPortalShellData():     Promise<PortalShellDto>            // server.ts:16 / demo.ts:15
getPortalOverviewData():  Promise<PortalOverviewDto>
getOrganizationsPageData(): Promise<{ organizations: OrganizationSummaryDto[]; canCreate: boolean; role: AdultRole }>
getOrganizationPageData(id: string): Promise<OrganizationDetailDto>   // ← the ONLY annotated pair
getTeamPageData():        Promise<{ members: TeamMemberDto[]; organizations: OrganizationSummaryDto[]; profiles: ProfessionalOptionDto[]; role: AdultRole }>
getClassesPageData():     Promise<{ classes: ClassSummaryDto[]; organizations: OrganizationSummaryDto[]; role: AdultRole }>
getClassPageData(id: string):                Promise<ClassDetailDto>
getPlayerAccessPageData(id: string):         Promise<ClassWorkflowDto>
getResultReportsPageData():                  Promise<ClassReport[]>
getClassResultsPageData(id: string):         Promise<ClassReport | null>
getPlayerResultsPageData(classGroupId: string, playerSlotId: string): Promise<PlayerReport | null>
// + 4 sync static-param readers: listStaticClassIds/listStaticOrganizationIds(): string[],
//   listStaticResultClassIds(): string[],
//   listStaticResultPlayerParams(): { classGroupId: string; playerSlotId: string }[]
// ── mutations, all (previous, formData) => … ──
createOrganization / changeOrganizationStatus / assignOrganizationAdministrator /
assignTeacherMembership / createDemoProfessional / changeMembership / createClass /
changeClassStatus / assignTeacherToClass / deactivateTeacherAssignment
                                   (prev: ActionResult,             fd: FormData) => Promise<ActionResult>
allocatePlayerSlots / rotatePlayerCredential / startClassSession / endClassSession
                                   (prev: PlayerAccessActionResult, fd: FormData) => Promise<PlayerAccessActionResult>
// ── query from the client ──
resolvePlayerEntryAction(token: string): Promise<PlayerEntryActionResult>
// ── bridges ──
loadClientPortalState(): DemoAdultPortalState | null ; changeDemoProfile(id: string): void ; resetDemoPortal(): void
```

**Two honesty findings the current `contracts.ts` sketch does not admit.**

1. **Half the surface is unannotated, so `satisfies` has less to check than the contract implies.**
   Measured by parsing every seam declaration's return annotation (both variants, 35 members each):
   **server side 16 of 35 carry an explicit annotation, 19 do not; demo side 16 of 35.** The bare
   ones are not scattered — they cluster exactly where the contract is widest:
   `adult-portal-actions.ts:63,77,98,116,146,160,178,192,207` (9 of the 10 mutations unannotated),
   `adult-portal-server.ts:16,20,24,47,59,70` (6 of 9 readers), `game-events-server.ts:15,19,26`,
   `player-access-server.ts:8`, and on the demo side `adult-portal-demo.ts:15,19,23,31,35,45,61`,
   `game-events-demo.ts:60,64`, `player-access-demo.ts:14`,
   `adult-portal-demo-actions.ts:73,86,99,113,157,170,183,196,209`. Every one of those resolves to a
   structurally-identical `Promise<ActionResult>` / `Promise<Dto>` by inference, so
   `satisfies` passes without ever being told what the type is. Writing a 35-member contract to
   police 19 inferred signatures produces a file whose passing is uninformative.
   **Cheaper, equivalent, and it improves every caller (not just the seam):** add the missing return
   annotations *at the declarations* — ~19 one-line edits, no new file, no new machinery — then let
   `typecheck` + `typecheck:demo` police the pairs against the real call sites.
2. **`PortalMutation` is in the wrong layer to reuse.** `INV-B` says "already exists at
   `src/components/portal/adult-portal-form.tsx:11-14` — reuse it, do not redefine." It lives inside a
   `"use client"` React component module (`:1`). A types-only `src/runtime/contracts.ts` importing it
   makes `src/runtime/**` depend on `src/components/**` — a layer inversion that every boundary rule
   in `CRITIQUE` C5 is trying to *prevent*, and one a lint rule would flag if the rule existed. Move
   it to `src/application/adult-portal/types.ts` (which already owns `ActionResult` at `:112`) or
   accept the inversion knowingly. Also: `contracts` **already means something else in this repo** —
   the GameMaker-facing wire schemas at root `contracts/{v1,schemas,fixtures}` and
   `src/contracts/v1/index.ts` (which itself uses `export *`). Naming the seam file
   `src/runtime/contracts.ts` puts two unrelated definitions of "contract" one directory apart. If
   anything is generated, call it `src/runtime/surface.ts`.

**Members whose signature cannot be expressed without leaking a Next-specific type or a lie.**
Measured answer: **none leak a type** — which is itself the finding.

| Pressure point | Leaks a Next type? | Honest verdict |
| :-- | :-- | :-- |
| `FormData` | **No** — `lib.dom` (`tsconfig.json:4`); no import | Fine. `NextRequest`/`NextResponse` appear only in `src/app/api/**` and `src/proxy.ts`, never in a seam member. |
| `revalidatePath(paths)` inside 14 mutations (`adult-portal-actions.ts:52`, `player-access-actions.ts:50-52`) | No | `Promise<ActionResult>` hides "the RSC cache is now stale". **Equally hidden behind today's aliases** — not a seam argument. Mitigation is a doc-comment carrying the path list, as `INV-B` says. |
| `redirect()` typed `Promise<void>` (`entrar/actions.ts:21,25,29,34,37`; `sign-out-action.ts:12`) | No | **This is the one genuinely unexpressible member.** The type means "returns"; the behaviour means "never returns, navigates". And the demo *cannot* do it from an event handler (`redirect.md:54`). Two honest shapes, and the choice is a product call: (A) accept it and keep the demo branch a `<Link>` (`VER-B` #14/#15 prove `redirect()` cannot run there and a hand-written `<form method="get">` bypasses `basePath`); or (B) change the contract to `Promise<{ navigateTo?: string }>` so the client owns navigation in *both* modes and the branch dies — at the cost of the server target's no-JS submit. `INV-B` left this as Open Question 3; it should be answered before Day 2, because **the design currently ships a 35-member contract containing one member that lies about its return type.** |
| `resolvePlayerEntryAction` → HMAC launch token vs `demo_launch_<uuid>` | No | Same type, different trust; the contract cannot and need not encode it. |
| `useActionState` binding | No | `PortalMutation` already satisfies React's `(previous, payload)` slot; both halves are already driven through `useActionState` (`adult-portal-form.tsx:31`, `player-access-workflow.tsx:129`, `deactivate-organization-control.tsx:24`). No `useFormState` survives in `src/`. |
| surplus demo-only exports (axis A4: `player-access-demo-actions.ts:31` exports `class DemoPlayerCredentialIssuer`) | No | Caught by neither `satisfies` nor the annotation (Attack 5); caught only by an explicit `export {…}` list, whose real justification is the **E46 bundler rule**, not types. Note the class export would also trip `E352` (`action-validate.js:14-24`) if a variant were ever given a `"use server"` directive — so the "no directive on any seam file" rule is correct and load-bearing. |

**So the boundary is expressible.** The problem is the opposite of the one `INV-B` feared: the
contract is *so* expressible that it degenerates to the structural types both variants already share,
and therefore detects nothing. **A boundary that cannot fail is not a boundary.** The real
boundaries in this repo are (1) `"use server"`, which is enforced by the bundler and already works,
and (2) `no-restricted-imports` lint patterns, which are enforced by CI and are absent — and which
the plan dropped (`CRITIQUE` C5) while keeping the far more expensive generated fence.

---

## If we build it anyway: mandatory controls

Ordered by whether the design survives without them. **C1-C4 are the two I would die on; C1 in
particular is what makes the design's own argument collapse.**

| # | Control | Why it is non-negotiable |
| :-- | :-- | :-- |
| **C1** | **Add `resolve.alias: { "server-only": <empty stub> }` to `vitest.config.mts` in the same commit as `import "server-only"` on `readers.demo.ts`, and add a seam test that calls all 11 page-scoped readers + 4 `listStatic*` in demo mode.** | Proven breakage: the fence makes the demo readers untestable (`Cannot find package 'server-only'`, reproduced at 194 ms) — destroying the design's own headline justification. Also record in the file header that the fence is inert in tests, so nobody believes the test is exercising it. |
| **C2** | **`TARGET_MODE` prerender assert in all four consumer paths, plus `> 0` ids + printed count for `build:server` and `== 0` for `build:demo`.** | VER-B #20: the stale-demo-seam-during-`build:server` case is caught by **nothing** and ships a localStorage-backed demo as the production app — the exact inversion of `docs/implementation/v1-architecture-plan.md:63-66`. This is the only gate with teeth, not a nicety. Never assert `== 17`: 6 of the 24 exported actions live in the tree §2 deletes (VER-B O6). |
| **C3** | **Named `export { a, b } from "./x.server"` only. No `export *`. No `const target: Contract = …; export const { … } = target;`. No directive on any seam, variant, or `contracts` file. Strip the 4 `"use client"` directives from the demo leaves.** | E46 makes `export *` across a client boundary a hard build error in Next's own loader; the inline-directive + CC + barrel combination is the sole genuine R1 residual; `E352` (`action-validate.js:14-24`) fires on `player-access-demo-actions.ts:31`'s class; and an undirected barrel over `"use client"` modules imported by an SC yields `registerClientReference` proxies. All four are load-bearing, none is style. |
| **C4** | **`pregen` npm script, `postinstall` hook, and a CI job that fails if `git status --porcelain` shows either generated path.** Plus the Day-2 "do not touch" list: `src/server/auth/gateway.ts:27`'s dynamic `await import("./neon-gateway")` stays dynamic and `getServerRuntimeEnv()` is never hoisted to module scope, because `scripts/next-target.mjs:41-53` blanks `DATABASE_URL`/`DIRECT_URL`/`NEON_AUTH_*`/`APPLICATION_SECRET` for demo. | `npm ci && npm run check` **fails on a fresh clone** today (VER-B O7). C4's second half is the one hazard that can silently break `build:demo` from an unrelated file. |
| **C5** | **`no-restricted-imports` patterns**: `@/server/**` and `@/app/**/*actions*` forbidden outside `src/runtime/**` and `src/app/api/**`; and `@/runtime/readers` forbidden in any file containing `"use client"`. Core ESLint, zero new deps (`eslint-plugin-import` is **not** installed — verified). | C5 is `CRITIQUE` C5: once the aliases are gone nothing structurally stops a component importing `target.server.ts` directly and re-breaking `build:demo`, and `tsc` will not catch it — the exporter will, minutes in. Cheapest guard in the whole dossier, and it is also the boundary rule the contract pretends to be. |
| **C6** | **Byte-stable writes** (write only on content change), prettier-clean emitted bytes, `.gitignore` for both paths, and a documented **"one working copy, one target"** rule. | `tsconfig.json:16` `incremental: true` with SHA-256 per-file versions: flipping the `mode=demo` comment rehashes and re-checks ~23 dependents. `npm run dev` and `npm run dev:demo` have separate `distDir`s (`next.config.ts:26-27`) but **share** the source seam. |
| **C7** | **Re-baseline `out/entrar/index.html` before/after the SC→CC conversions**: assert it still contains `Entrar na demonstração` and **0 `<form` tags**. | `entrar/page.tsx:10` is a synchronous SC today; a client `sign-in-form.tsx` gives `/entrar` a client chunk and can change what is prerendered, including whether the `useSearchParams` `Suspense` boundary at `:31-35` survives. This is a usable green baseline that the design can silently move. |
| **C8** | **Re-scope the goal sentence.** Replace "one entry point / isolates the server graph / removes mode branching" with: *"one typed contract, two build-time-selected entries, zero duplicated logic below them"* — and state that E625 already passes, that the demo graph reaches Prisma via `src/app/api/v1/player/*/route.ts:4-11` and `src/application/*/service.ts` → `@/server/authorization/v1-policy`, and that this refactor changes neither. | `CRITIQUE` §2.1 already wrote the correct sentence and nobody carried it into §3.1. A design sold on three benefits it does not deliver will be deleted by the next person who measures it. |

---

## Recommendations

1. **Build the cheap version.** `tsconfig.demo.json` + `typecheck:demo` (in `check`) + the
   `vitest.config.mts` `@runtime/*` alias block + `satisfies`/return annotations on the 9 variant
   pairs + `no-restricted-imports`. All five are audit-approved (`:620-628`, `:741`) or `CRITIQUE`
   C5. ~5-6 h, no generator, no R1 residual, no fresh-clone breakage, and the drift detection is
   *stronger* than the seam's because it runs against the 24 real call sites.
2. **Keep three things from the attacked design:** the non-imported parity file (one `tsc` covers
   both variants — cheap, works, `VER-B` #18 proved Next never bundles an unreferenced module), the
   explicit named-surface discipline (E46), and the `TARGET_MODE`-style cross-check **as a test**
   rather than a prerender throw.
3. **Do the two 1-hour fixes the seam only renames:** collapse the ~30 demo-notice `runtimeMode`
   sites into one `demoNotice` on `PortalShellDto` / a `<DemoOnly>` primitive, and delete the
   provably-constant mode guards at `entrar/actions.ts:20-22` and `sign-out-action.ts:9-11`.
4. **Answer Open Question 3 before Day 2** (`Promise<void>` + `redirect()` vs
   `Promise<{ navigateTo?: string }>`). It is the only member whose type must lie, and the answer
   determines whether `sign-in-form.tsx` exists at all.
5. **Fix the dossier's two factual errors wherever they are quoted:** `INV-B`'s "the 6 [5] sync demo
   readers are not assignable" (false — they already return `Promise<T>`), and `INV-B` gate 5's "a
   seam unit test that could not exist before … it works" (false once its own `server-only` fence
   lands).
