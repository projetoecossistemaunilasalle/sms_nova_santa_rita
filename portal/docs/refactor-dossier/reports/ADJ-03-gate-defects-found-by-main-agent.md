# ADJ-03 — Main-agent findings: three gates that cannot pass as specified

Measured directly in this repo on 2026-09-23. Each one invalidates a verification step that `REFACTOR_PLAN.md` §6/§7 depends on, and none was identified with a concrete mechanism before now.

## F1 — ~~`npm run typecheck` cannot pass on a fresh clone~~ **REFUTED by execution; kept as a corrected record**

> **Correction (2026-09-23, `AUDIT-dossier-correctness.md` B1).** The claim below is **false**, and the dossier has been fixed. A real `git clone` with no `.next`, followed by `prisma generate` and `tsc --noEmit --incremental false`, exits **0**. Mechanism: `next-env.d.ts` **is a `.d.ts`**, and `tsconfig.json:6` sets `skipLibCheck: true`, so unresolvable module imports inside it are not reported at all — A/B proof on this repo's TypeScript 6.0.3 gives exit 0 with `skipLibCheck: true` and `TS2882` with it off. The caveat at the foot of this file, "I did not run `tsc` on a synthetic fresh clone", was the tell: an inference was written up as measured. What survives is only the weaker statement below — a compile before typecheck is still worth ordering, because without `.next/types` the route/params validators are simply absent and typecheck silently checks **less**, and because F2 makes it actively wrong after the route deletions.

`next-env.d.ts` is a **tracked** file and its last two lines are:

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
import "./.next/types/routes.d.ts";        // next-env.d.ts:3
import "./.next/types/root-params.d.ts";   // next-env.d.ts:4
```

`.next/` is gitignored (`.gitignore:5-7`) and is created only by `next dev`/`next build`. On a clean checkout, after `npm ci` (whose `postinstall` runs `prisma generate` and nothing else — `package.json:31`), both imports resolve to nothing, so `tsc --noEmit` fails with `TS2307` before any refactor work is considered.

**Consequences, restated after the refutation:**
- Nothing about §7.3's "typecheck executes cleanly" changes — it is green on a bare clone as well as on a warm one.
- A compile step in `ci.yml` is a **coverage** improvement, not an unblocker: without `.next/types` the route-config and `params` validators are absent from the program, so typecheck passes while silently checking less. The audit's ordering at `architecture-audit-2026-09-23.md:604` is therefore **acceptable**, not wrong as written.
- `typecheck` is still **stateful**: it validates against whatever `.next/types` the last build left behind, and combined with F2 that makes it actively *wrong* immediately after §2.2's route deletions until a compile regenerates them. **F2 stands uncorrupted** — the stale-validator hazard was executed and reproduced (44 references, 60 false `TS2307`).

## F2 — Day 1's typecheck will report up to 60 **false** errors from stale generated validators

Next writes a per-build `validator.ts` that typechecks the route tree, and it lands inside the gitignored dist directories:

```
.next/types/validator.ts
.next/dev/types/validator.ts
.next-demo-dev/dev/types/validator.ts
```

Each currently contains **44** `typeof import(…)` references, of which **57 lines** name routes inside the §2.2 purge set (`atividades`, `materiais`, `modulos`, `atividade/`). `tsconfig.json:46-54` includes exactly those globs (`.next/types/**/*.ts`, `.next/dev/types/**/*.ts`, `.next-demo-dev/types/**/*.ts`, `.next-demo-dev/dev/types/**/*.ts`) in the program, while `exclude` is only `["node_modules"]`.

So the moment §2.2 deletes the route trees, these three surviving generated files reference modules that no longer exist. `typeof import("./gone/page.js")` is a resolution error (`TS2307`), which `VER-A` would see as a wall of errors indistinguishable from a genuine dangling import — and, worse, an implementer could reasonably "fix" by deleting real code.

This also explains a discrepancy in the evidence: `VER-A`'s otherwise-decisive "deleting the 46 files yields exactly one error" proof ran in scratch trees **without** a `.next` directory, so it never exercised this path. Both results are correct for their respective trees.

**Remedy, and why the obvious one fails:** regenerating the validators requires running `next dev` or `next build`, and the demo build writes to the **server** dist directory too (`VER-F`/`ADV-1` established both targets share `.next`), so "just rebuild" changes what a later manifest assertion reads. The safe ordering is: delete the routes, then run the **server** target compile to regenerate `.next/types/validator.ts`, then typecheck, and only afterwards run the demo build whose manifest assertion must read a manifest it just wrote. Simply removing the `.next/types` globs from `tsconfig.include` does **not** help, because `**/*.ts` in the same `include` array still matches those paths and `exclude` does not list them.

## F3 — `server-only` is not installed, so the seam's proposed fence destroys its own main benefit

`import "server-only"` appears at the top of at least ten first-party modules (`src/runtime/adult-portal-server.ts:1`, `player-access-server.ts:1`, `game-events-server.ts:1`, `src/server/db/client.ts`, the Prisma stores, the Neon gateways). The package is **not** a dependency: it is absent from `package.json` and from `node_modules`. It resolves only because Next aliases it per compilation layer, and `tsc` accepts it because `next-env.d.ts:1` pulls in Next's ambient types.

Outside Next, it does not resolve. Verified in this repo's own Node 24:

```
$ node -e "import('server-only').then(…).catch(e => console.log(e.code))"
ERR_MODULE_NOT_FOUND
```

Two conclusions follow, and they cut against each other:

1. **`vitest` cannot import any module carrying `import "server-only"`.** `vitest.config.mts:13` runs `environment: "node"` with only the `@` alias, so there is no Next layer to resolve the specifier. `INV-B`'s and `ADV-2`'s proposed remedy — put `import "server-only"` on **both** reader variants, including the demo one, so a client component can never drag readers into the browser graph — would therefore make the demo readers **untestable in vitest**. That kills the one concrete payoff `NOTE-00` §4 identified for the generated-entry design (the seam becoming resolvable to tests without alias config). The fence and the benefit are mutually exclusive as specified.
2. The `server-only` guard is **not** currently protecting anything from a bundler standpoint in tests, and any design that relies on it must add the package as a real devDependency first — a new third-party dependency introduced purely to keep a type-level fence testable.

**What to do instead:** if the goal is "readers must never be imported by client components", prefer an explicit ESLint boundary rule (the audit's own §8.5 mechanism, `docs/architecture-audit-2026-09-23.md:549-563`) over a runtime throw that the test runner cannot load. A lint rule is checkable in CI, needs no new package, and does not obstruct vitest.

## F4 — related, for the CI section: `.prettierignore` does not cover generated sources

`.prettierignore` currently lists `.next`, `node_modules`, `src/generated`, `package-lock.json`, `contracts`, `docs`, `portal-v1-specification.md`, `prisma/schema.prisma`. A generated `src/runtime/target.ts` would be **policed** by `prettier --check .`, so if the generator's emitted formatting differs at all from Prettier's, `npm run check` fails on a file nobody wrote by hand — one of `INV-B`'s "three CI landmines", now with the exact missing line identified. Note also that `REFACTOR_PLAN.md` is not ignored, which is why `format:check` is already red on `main` (`VER-A` B3) and therefore why `ci.yml` must not be the first thing merged.

## Resolution of the F1 caveat

The caveat below was written before the audit ran and is now **answered, against F1**: `AUDIT-dossier-correctness.md` B1 performed exactly the missing experiment — a real clone with no `.next`, `prisma generate`, then `tsc --noEmit --incremental false` — and got **exit 0**. F1 is therefore refuted and has been rewritten above; F2, F3 and F4 all survived their own execution checks (F3's *reason* was corrected from "package missing from the registry" to "no per-layer resolver outside Next"). The lesson recorded here is the one worth keeping: an inference from file contents is not a measurement, and this dossier's convention only permits `[V]` for the latter.

<details><summary>Original caveat, retained verbatim</summary>

I did not run `tsc` on a synthetic fresh clone (that would mean deleting `.next`, which is evidence for F2 and the build-order analysis). F1 is derived from the tracked `next-env.d.ts` contents plus the `.gitignore` entries, both of which I read directly. An implementer can confirm in one command on a scratch clone: `git clean -xdn` output plus `npx tsc --noEmit`.

</details>
