# NOTE-00 — Next.js 16.3 mechanism survey for the dual-runtime seam

**Author:** main agent (not a subagent). **Purpose:** establishes, from the vendored docs and the shipped source in this `node_modules`, which module-selection mechanisms Next 16.3.2 actually offers, so the dossier's "alternatives considered" section is grounded rather than recalled. **Status: to be attacked by the adversarial pass.**

All findings below were read out of this repository's own `node_modules/next/dist/` today. Nothing here is inferred from memory of other Next versions.

---

## 1. What E625 actually checks (`export/index.js:357-384`)

```js
let serverActionsManifest;
if (enabledDirectories.app) {
    serverActionsManifest = require(join(distDir, SERVER_DIRECTORY, SERVER_REFERENCE_MANIFEST + '.json'));
    if (nextConfig.output === 'export') {
        ...
        const actionIds = [
            ...Object.keys(serverActionsManifest.node),
            ...Object.keys(serverActionsManifest.edge)
        ];
        if (actionIds.some((id) => extractInfoFromServerReferenceId(id).type === 'server-action')) {
            throw new ExportError('Server Actions are not supported with static export.') // E625
        }
    }
}
```

Three properties of this code decide the whole design conversation:

1. **It reads the manifest the build produced**, not the source tree. A file may contain `"use server"` and be perfectly fine; what fails is an *id of type `server-action` appearing in `server-reference-manifest.json`*. Verified against this repo: **24** exported action functions across **7** `"use server"` files, but **17** ids in the last server build's manifest (`node` 17, `edge` 0) — the 7-gap is the set with no production consumer, including all 6 in `portal/atividades/actions.ts`.
2. **There is no guard and no opt-out.** The only enclosing condition is `enabledDirectories.app`. `docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md` exposes exactly two options, `allowedOrigins` and `bodySizeLimit` — no `enabled: false`. Sibling export gates in the same function are `E626` (interception-route rewrites, `:364-372`), so this is the family of "hard structural" checks.
3. **It fires after compilation and prerendering**, inside `runNextExport` which `next build` awaits at the end. A mistake in the seam therefore surfaces minutes into the build, at the last step of the feedback loop — which is why the dossier must put a cheap discriminating assertion in Day 2 rather than trusting Day 4 to catch it.

**Therefore the requirement is exact and testable:** in the demo build, nothing in the compiled graph may reach a `"use server"` module. This is a *reachability* property of the bundle graph, which is why any design that makes both variants statically reachable from one shared module fails — including the governing audit's `composition.ts` ternary (see `docs/refactor-dossier/CRITIQUE-governing-conflicts.md` §2).

## 2. Mechanism 1 — `turbopack.ignoreIssue` cannot bypass it

`docs/.../turbopackIgnoreIssue.md` (introduced `v16.2.0`, so available here): filters **Turbopack compile issues** by `path`/`title`/`description` out of CLI output and the error overlay. It is not a general error-suppression switch, and E625 is not a Turbopack issue — it is an `ExportError` thrown by the exporter in Node after the compile step. **Ruled out.**

## 3. Mechanism 2 — conditional `resolveAlias` is the wrong axis

`docs/.../turbopack.md:341-351`:

> Turbopack also supports conditional aliasing through this field, similar to Node.js' conditional exports. **At the moment only the `browser` condition is supported.**

Tempting shape, and it fails for a precise reason: `browser` selects by *side of the render*, not by *deployment target*.

- The demo's 12 build-time **data readers** are imported by async Server Components and `generateStaticParams`, which execute in **Node** during the export → a `browser:` alias would hand them the **server** variant → Prisma/Neon calls during a static build. Wrong.
- The **mutations** are imported by Client Components → would resolve to the browser variant **in the server build too**, silently stripping production persistence from the hosted app. Worse.

**Ruled out.** The axis Next offers is server/browser; the axis this project needs is demo-target/server-target. They are orthogonal.

## 4. Mechanism 3 — one surviving alias (`@runtime/target`) vs the plan's generated file

Both satisfy §1. The plan (`REFACTOR_PLAN.md:125-131`) mandates the generated `src/runtime/target.ts`; a single env-conditional alias in `next.config.ts` is the same property with less machinery, because `next.config.ts:5-7` already parses `APP_RUNTIME_MODE` at config load.

| Dimension | Single alias | Generated `target.ts` (plan) |
| :--- | :--- | :--- |
| E625-safe | Yes | Yes |
| Contract typing (`satisfies`) | Yes | Yes |
| `tsc` sees the *build's* variant | No — `tsconfig.json` cannot be env-conditional, so it pins one variant and the other's conformance to call sites goes unchecked (the exact split-brain today) | No, unless the file is regenerated before `typecheck`; otherwise same limitation |
| **vitest resolution** | **Needs a new `resolve.alias` block** — `vitest.config.mts:5-11` today aliases only `@`, which is why no test exercises the seam at all | **Free** — the file is a real path under `src/`, reachable as `@/runtime/target` with zero config change |
| ESLint / editor / `prettier --check` | alias-aware only in ESLint via settings | ordinary file, everything resolves |
| Failure modes | none beyond config | file absent, file stale (built for the other target), two devs' generated files differing, a `git add -A` committing it, a watcher rebuild loop |
| Requires `.gitignore` addition | no | yes (`target.ts` is currently not ignored; only `/src/generated/prisma` is, `.gitignore:26`) |
| Dev-server behavior | unchanged | `next dev` must pick up a rewritten file on target switch; `.next-demo-dev` vs `.next` are separate distDirs (`next.config.ts:26-28`), so a stale cache is possible |

**Preliminary conclusion (dossier should carry both):** the generated file is *not* required for E625 safety; its real payoff is that the seam becomes an ordinary module that **vitest, eslint and the editor can resolve without any alias configuration**, which is currently the single biggest testability hole in the dual-runtime design (no test can import the seam today). That is a legitimate reason to prefer it. The trade is a new class of build-hygiene failure (absent/stale/committed generated file) that the plan does not yet address; the dossier must specify how those are detected — e.g. `predev`/`prebuild` generation, a first-line `import { APP_RUNTIME_MODE } from` marker in the generated file, an assertion in `npm run typecheck`, and a `.gitignore` entry.

## 5. Mechanism 4 — `dynamic import()` with a magic ignore comment

Would need `import()` of a computed specifier plus suppression of the bundler's resolution of the other branch; §2 shows `ignoreIssue` is the only suppression knob and it does not apply to exporter errors, and the imported module would be untypechecked at the call site. **Ruled out** on both correctness and the repo's own strictness posture (`tsconfig.json:8-10` `strict` + `noUncheckedIndexedAccess`).

## 6. What remains after the survey

Only two mechanisms can hold the property in §1: a build-time module selector (alias or generated file), or two separate route trees / build entries (`docs/implementation/v1-architecture-plan.md:69-71`, "give the demo a dedicated static entry"). The second multiplies the route tree the plan is trying to shrink. The dossier's job is therefore not to find a third option but to make the chosen one precise: exact contract surface, exact per-file changes, and the generated-file hygiene rules §4 flags as missing.

## 7. Verification requests for the adversarial pass

1. Re-open `export/index.js` and confirm the §1 quote and that nothing between `build/index.js` and the exporter catches `E625` (e.g. a `continueOnError` path).
2. Confirm the 24/17 counts independently, and confirm the 7 unreferenced actions are exactly the 6 in `portal/atividades/actions.ts` plus 1 in `entrar/recuperar/actions.ts`.
3. Attack §4's vitest claim: does a test importing `@/runtime/target` actually work, given the demo variant touches `window`/`localStorage` at import time and `vitest.config.mts:13` sets `environment: "node"`? If not, the generated file's headline advantage evaporates and the single-alias option wins.
4. Attack §3: is there any Next 16.3 flag that changes the *prerender* environment for static export such that a `browser` condition would apply to `generateStaticParams` execution? (Believed no; verify against `docs/01-app/02-guides/static-exports.md`.)
5. Confirm whether `output: 'export'` builds even *need* the `"use server"` modules excluded from `tsc`, or only from the bundle graph — i.e. can both variants sit in the TypeScript program harmlessly? (Needed to know whether the `satisfies` parity check file may import both.)
