# ADJ-02 — Main-agent adjudication: what the seam's typing actually catches

Three agents made different claims about whether the plan's mandated contract typing detects implementation drift. The question decides which control in §3.1 is load-bearing, so I checked it against the source myself.

## 1. The disputed claim

`INV-B` asserted that five demo data readers are **synchronous** and therefore **not assignable** to a `Promise<T>` contract member — the basis for `REFACTOR_PLAN.md:129` claiming the two variants satisfying `contracts.ts` gives "compile-time drift detection". `VER-B` revised the count (6 → 5) and used the same premise. `ADV-2` claimed the opposite: the annotation catches nothing, because those functions already return promises.

**`ADV-2` is correct and the premise both earlier agents shared is wrong.** The five functions are declared without `async` but have **no return-type annotation**, and their bodies return a service promise:

```ts
// src/runtime/adult-portal-demo.ts:15-21
export function getPortalShellData()    { return service().getShell(profileId); }
export function getPortalOverviewData() { return service().getOverview(profileId); }
// :31-33
export function getOrganizationPageData(organizationId: string) { return service().getOrganization(profileId, organizationId); }
// :61-67
export function getClassPageData(classGroupId: string) { … return service().getClass(actorId, classGroupId); }
// src/runtime/player-access-demo.ts:14-21
export function getPlayerAccessPageData(classGroupId: string) { … return new PlayerAccessService(…).getClassWorkflow(…); }
```

TypeScript infers `Promise<…>` for each, so they satisfy a `Promise<T>` contract member silently. `async function f(): Promise<X>` and `function f(): Promise<X>` are **the same type**; an interface can never distinguish them. Counting `export function` vs `export async function` is a syntactic observation that was read as a type-system one.

For completeness, the genuinely synchronous readers are `listStaticOrganizationIds` (`:69`), `listStaticClassIds` (`:73`), `listStaticResultClassIds` (`game-events-demo.ts:109`) and `listStaticResultPlayerParams` (`:113`) — annotated as returning arrays — and their server twins are synchronous too (`adult-portal-server.ts:74,78`; `game-events-server.ts:37,41`), so no drift axis exists there either.

**Consequence: the contract annotation is not the safety control. `TARGET_MODE` is.** A generated or aliased entry pointing at the wrong variant typechecks clean under the current `export *`-style shape (`VER-B`'s experiment: 0 errors across `src/`, with a positive control of 6×`TS2305`), and per `ADV-2` the explicit-annotation remedy does not close the sync/async axis either. The only control that reliably catches a wrong-mode build is an embedded mode marker asserted at runtime/build time — which is a *stated* deliverable in no version of the plan.

**One narrow real difference survives**, which is why the axis should still be recorded rather than dismissed: a non-`async` function that throws before returning its promise rejects *synchronously*, so a caller doing `try { await f() }` behaves the same but a caller doing `f().catch(…)` or `Promise.all([...])` on a throwing entry sees a different failure shape. That is a behavioral, not typing, hazard.

## 2. "Drift detection" was two different things

`VER-B` and `ADV-2` both ran a whole-program typecheck against the demo variants and both got **0 errors** — they then drew opposite conclusions because the phrase meant two things:

- `VER-B`: a generated entry that re-exports with `export *` detects nothing → therefore mandate explicit named lists.
- `ADV-2`: a **per-target `tsconfig`** (the audit's already-approved `typecheck:demo`, `docs/architecture-audit-2026-09-23.md:626`) typechecking the *call-site graph* detects a missing/renamed export at the call site — it reproduced 8× `TS2305`/`TS2724` from a shim hiding one export.

Both are right and they are not in conflict. A missing export is caught by call-site typechecking under either mechanism; sync/async and nullability drift are caught by neither. The dossier should state drift detection per axis rather than as a single claim, and should note that `VER-B`'s own two instruments are, as `ADV-2` observes, the cheap design rather than a refutation of it.

## 3. What the seam does and does not isolate

`ADV-2` measured the shipped demo bundle (`out/_next/static`): zero action ids, and no Prisma/pino/Neon strings present. `VER-B` had separately found the demo *graph* still reaching 11 `server-only` modules plus those packages. Both can hold — reachability in the module graph is not evidence of inclusion in the browser chunk. The practical conclusion is the one that matters: **the seam prevents no leakage that is not already prevented**, so "keep production infrastructure out of the demo" is not a valid argument for it, and the dossier must not list it as a benefit.

## 4. Corrections to `INV-B`/`VER-B` carried forward

- `ADV-2`'s premise check on the two-file split: `src/components/portal/use-demo-portal.ts:6` imports the **client bridge**, not a reader, and zero of the 15 readers is imported by a Client Component today. The `server-only` exposure is therefore created by §3.1's composition of items 1+2+4, not inherited from existing code — which changes it from "latent bug" to "self-inflicted risk", and is an argument for the smaller design.
- `server-only` resolves per layer (`node_modules/next/dist/build/webpack/alias/…`/`create-compiler-aliases.js:220,225` per `ADV-2`), so a `server-only` demo reader is inert in the prerender — but the package is **not installed**, and `ADV-2` reproduced `Cannot find package 'server-only'` breaking Node-side testability. Any design that adds the fence must add the dependency or the fence defeats testability, which is the seam's main stated benefit.
- The re-export question is largely settled from compiled output: Next's own action dispatch is itself a named re-export (`…_page_actions_*.js` emitting `a.s(["<42-hex id>", () => b.signOutAction], …)`), so the hop is normal rather than exotic. The residual unknown is narrower than `INV-B`'s "highest-risk": `signInAction` carries a **function-level** `"use server"` *and* would gain a Client Component importer, a combination present in **0** client chunks today. That is the spike to run, and it is one file, not a redesign.
- Mode-branch count: `ADV-2` projects 95 → 95 **+2** new assertions. The seam does not reduce `runtimeMode` branching, and roughly 30 of the 95 are genuine defects (a component branching on deployment target where a prop belongs) that can be fixed independently of it.

## 5. Position this dossier takes

`REFACTOR_PLAN.md` §3.1 mandates the generated entry; the plan is treated as fixed input, so the dossier specifies it faithfully **and** records, as a decision the human must make before Day 2, that the measured cost is roughly 2-3 days against roughly 5-6 hours for the already-audited-approved alternative (`tsconfig.demo.json` + `typecheck:demo` + vitest alias block + named contracts), with the same drift detection on the only axis that turns out to be detectable. The comparison belongs in `## Opportunities to simplify`, not in a proposal to edit the plan.

## 6. Claims in this file

Sections 1 and the demo/server reader lists are my own measurements, taken from the files cited. Section 2 reproduces `VER-B`'s and `ADV-2`'s experiments as reported. Section 3 and 4 attribute to `ADV-2`/`VER-B` and flag where each over-read its own evidence.
