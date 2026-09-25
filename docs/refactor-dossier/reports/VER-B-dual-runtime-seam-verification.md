# VER-B — Refutation pass on `INV-B-dual-runtime-seam.md` (§3.1 generated `src/runtime/target.ts`)

**Target:** `docs/refactor-dossier/reports/INV-B-dual-runtime-seam.md`, evaluating `REFACTOR_PLAN.md` v2.1 §3.1.
**Method:** read-only. Nothing under `src/`, `out/`, `.next/`, `.next-demo-dev/` was created, edited or
deleted. Commands run: `npx tsc --noEmit` (repo project + two synthetic projects living in `%TEMP%`),
`npx eslint . --max-warnings=0`, `npx vitest run`, `node` forensics over `.next/**/*.json`,
`.next/static/chunks/*.js`, `out/**/*.html`, `tsconfig.tsbuildinfo`,
`node_modules/next/dist/**`, and the `@next/swc-win32-x64-msvc` binary. All scratch scripts were
written outside the repo.

**Headline:** INV-B is **substantially correct and unusually well-cited** — 24 of its material claims
survive, several of which I could prove more strongly than it did (see "Where INV-B under-claimed").
But its **single most important assertion is mis-scoped**: the `server-only` defect it calls "the one
genuine design flaw in §3.1" is *prospective in this codebase* and its stated *consequence* ("breaks
the SERVER build", "Turbopack rejects outright") is not established and is probably the wrong failure
mode. Its "3 drift axes" claim is **empirically true and I proved it** (its own argument was only
reasoned). Its R1 open risk is **~85% resolvable in the affirmative from source** and it left that
evidence on the table.

Delegated away per instruction and **not** re-litigated here: whether an empty demo manifest is a
valid export proxy (VER-F), and the shared-`.next` distDir build-order hazard (VER-F).

---

## Verdict table

| # | INV-B claim (abbreviated) | Verdict | Independent evidence |
| :-- | :-- | :-- | :-- |
| 1 | Consumer inventory is **24 statements / 38 specifiers / 23 files** | **CONFIRMED** | My own brace-aware parser over `src/**` + `tests/**` returns exactly 24/38/23 for `@runtime/*` specifiers. Per-table split is wrong (see §Claims that did not survive, C-1). |
| 2 | `portal/atividades/actions.ts:1` is file-level `"use server"` with 6 exported actions, inside the live route tree | **CONFIRMED** | `:1` = `"use server"`; exports at `:219,298,364,405,446,477` = exactly 6. |
| 3 | Its **only** importer anywhere is `tests/unit/portal-dev-bypass-actions.test.ts:43` | **CONFIRMED (exhaustive)** | `grep -rn "atividades"` over all `.ts/.tsx/.mts/.js/.mjs/.json` outside `node_modules/.next/out`: the only `from`-clause match is that test, via the alias-free path `@/app/(professional)/portal/atividades/actions`. All other hits are `href`/`revalidatePath`/`router.push` **strings**, prose, or a test fixture (`auth.test.ts:146-147`). No `vi.mock`/`jest.mock` names any `*action*` module (searched `mock\(['"].*action` across `src`+`tests` → 0). Relative-import sweep (`from ['"].*action`) finds no `./actions` importer of it. |
| 4 | `entrar/recuperar/actions.ts` `requestPasswordResetAction` has **zero** importers | **CONFIRMED** | Repo-wide grep: 1 hit = its own definition at `:8`. The sibling `recuperar/page.tsx` is `"use client"` and does **not** import it. |
| 5 | Manifest = 17 node ids, 0 edge; `24 − 17 = 7` = the 6 `atividades` + 1 `recuperar` | **CONFIRMED — and stronger than claimed** | See §Registration mechanism. The 7 absent ids are provable **per file**, not inferred from counts. |
| 6 | Registration is transitive reachability from a route entry, not route-tree membership | **CONFIRMED** | `app-paths-manifest.json` lists `/portal/atividades/page` and `/entrar/recuperar/page` as compiled entries (44 entries total) while both action files register 0 ids. Same tree, same compile, different registration. This is the decisive natural experiment and it is real. |
| 7 | `signOutAction` → 28 workers because `portal/layout.tsx` renders it into every portal route | **CONFIRMED** | Manifest `workers` for `…signOutAction` = 28, keys are `app/(professional)/portal/**/page`. |
| 8 | E625 is a manifest-membership test at `export/index.js:357-386`, no `!options.buildExport` guard, no opt-out | **CONFIRMED** | Read directly: `:358` `enabledDirectories.app`, `:359` unconditional `require(...SERVER_REFERENCE_MANIFEST+'.json')`, `:360` `output === 'export'`, `:375-378` id union, `:379` `.some(… type === 'server-action')`, `:380-384` `E625`. Siblings `:336` (E587) and `:343` (E603) **do** carry `!options.buildExport`. `config-schema.js:245-248` = `{ bodySizeLimit, allowedOrigins }` only. |
| 9 | Failure ordering: after compile + app-dir typecheck, before HTML | **CONFIRMED** | `build/index.js:1068-1073` ("For app directory, we run type checking after build"), `:1782` `exportConfig`, `:1910-1914` `exportApp({buildExport:true})`, `:428-430` the second call site. |
| 10 | **§3.1 as written breaks the SERVER build** because the seam drags `server-only` into the client graph and "Turbopack rejects it outright" | **OVERSTATED** (severity + certainty) / **CONFIRMED as a structural hazard of the plan's composition** | See §server-only analysis. Correct direction, wrong calibration: no Client Component imports a reader **today** (0 of 15 readers), so the defect is created by the §3.1(1)+(2)+(4) *composition*, not by existing code; and the failure I can actually prove is a **top-level `throw` bundled into the browser chunk** (runtime), with a Turbopack build-time diagnostic *plausible but unproven*. It cannot be asserted as "the server build fails". |
| 11 | Asymmetry: a `"use server"` module imported by a Client Component yields a client **reference stub**, not the implementation | **CONFIRMED — hard proof added** | Built client chunks contain `createServerReference("<42-hex id>", callServer, void 0, findSourceMapURL, "createClassAction")` and re-export it under the original name (`e.s(["changeOrganizationStatusAction",0,s],59891)`). Zero occurrences of the implementation string `"Não foi possível concluir a operação"` and zero of `@prisma/client` / `neon-gateway` in `.next/static/**`. |
| 12 | A **plain** async function passed to a Client Component throws "Functions cannot be passed directly…" | **CONFIRMED** | Extracted from the `app-page-turbo.runtime.dev.js.map` sources, module `react-server-dom-turbopack-server.node.development.js`, `serializeTypedObject`: `if ("function"===typeof value){ if (isClientReference(value)) … ; if (value.$$typeof===SERVER_REFERENCE_TAG) return serializeServerReference(…); … throw 'Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server".' }`. Sibling messages for `/^on[A-Z]/` and children also verified verbatim. |
| 13 | §3.1(4)'s rationale is backwards; the legal shape is "Client Component imports the seam, receives only serializable data" | **CONFIRMED** | `07-mutating-data.md:172` = literal heading `### Passing actions as props` with a working example through `:198`. `04-glossary.md:238` corroborates: "When passed as a prop to a Client Component or bound to a form action, they are called Server Actions." `use-server.md:46` = "Using Server Functions in a Client Component"… "import them from a file that has the `use server` directive". |
| 14 | `redirect()` cannot be called from a client event handler → the `runtimeMode` branch survives as a render decision | **CONFIRMED** | `redirect.md:54` verbatim: "`redirect` can be called in Client Components during the rendering process but not in event handlers. You can use the [`useRouter` hook]… instead." |
| 15 | `<form method="get">` fallback bypasses `basePath` → `<Link>` must stay for demo | **CONFIRMED** | `basePath.md:22` verbatim: "When linking to other pages using `next/link` and `next/router` the `basePath` will be automatically applied." `next.config.ts:28` sets `basePath:'/SMS_Portal'` for demo-prod only; `:37-40` `APP_BASE_PATH` mirrors it. React's `encType`/`method`-with-function-action restriction is consistent with the flight source. |
| 16 | `server-only` is not installed; builds anyway; vitest cannot resolve it | **CONFIRMED** | `node_modules/server-only` **absent**; `package-lock.json` has `node_modules/client-only` (`:7475`) and no `server-only`. tsc passes because `next-env.d.ts:1` `/// <reference types="next" />` → `next/index.d.ts:1` `/// <reference types="./types/global" />` → `next/types/global.d.ts` `declare module 'server-only' {}` (with the comment "TSC *doesn't check side-effecting imports*"). Bundlers work because Next *aliases* the specifier: `create-compiler-aliases.js:220` (server → `server-only/empty`), `:225` (client → `server-only/index`), and the same table is compiled into the Turbopack native module. |
| 17 | All 3 real drift axes survive a wrong-mode `tsc` | **CONFIRMED — empirically proven (INV-B only reasoned it)** | See §Drift axes. I typechecked the entire `src/` graph against **all 9 demo variants** out-of-repo: **0 errors**; and the repo's own all-server config: **0 errors**; positive control (one alias pointed at `src/runtime/mode.ts`) → 6 × `TS2305`. So both variants currently satisfy every call site. |
| 18 | A non-imported parity file lets one `tsc` run check both variants; ESLint/Prettier police it; Next never bundles it | **CONFIRMED** | Natural experiment: `entrar/recuperar/actions.ts` has **no importer** yet (a) `tsc --listFiles` includes it, (b) `tsconfig.tsbuildinfo` carries its `fileInfos.version`, (c) `npx eslint "…recuperar/actions.ts"` exits 0 (i.e. in scope, no error), (d) `npx prettier --check` on it exits 0, (e) it registers **0** action ids → nothing compiled it. `tsconfig.json:45-54` `include` is `**/*.ts`/`**/*.tsx`/`**/*.mts`, so any new `src/runtime/*.ts` is in the program. |
| 19 | ESLint will not need to resolve the seam, and `--max-warnings=0` turns `no-unused-vars` into a CI failure | **CONFIRMED** | `eslint-config-next/dist/typescript.js:33-39` = `[...typescripteslint.configs.recommended, {rules:{'@typescript-eslint/no-unused-vars':'warn','@typescript-eslint/no-unused-expressions':'warn'}}]` — **non-type-aware** recommended, and both downgraded to *warn*; `package.json:17` is `eslint . --max-warnings=0`. (INV-B's line cite `:26-32` is off by ~7; substance exact.) Baseline `npx eslint . --max-warnings=0` → **exit 0** today. |
| 20 | Stale **demo** `target.ts` during `build:server` is caught by **nothing** and can ship | **CONFIRMED** | (a) `tsc`: proven — demo-variant typecheck is green (#17). (b) `npm test`: `vitest.config.mts:5-11` aliases only `@`, so no test reaches the seam; `npx vitest run` baseline exit 0. (c) `lint`: resolution-free (#19). (d) `next build` for the *server* target never touches E625 (`:360` requires `output === 'export'`). So the only gate left is a deliberate cross-check. |
| 21 | `.gitignore` has no entry for a generated file inside `src/` | **CONFIRMED** | `.gitignore` ends at `:27` `/src/generated/prisma`; no `target.ts`. |
| 22 | `.prettierignore` does not cover `src` → a generated file **is** policed | **CONFIRMED** | `.prettierignore` = `.next`, `node_modules`, `src/generated`, `package-lock.json`, `contracts`, `docs`, `portal-v1-specification.md`, `prisma/schema.prisma`. `src/runtime` is not covered; `package.json:19` is `prettier --check .`. |
| 23 | `scripts/next-target.mjs` currently generates nothing and has no `node:fs` | **CONFIRMED** | Read in full: **70 lines** (INV-B says 71). Imports `:1-4` = `node:child_process`, `node:url`, `node:path`, `@next/env` — no `fs`. Validates `command` at `:13-18`, `target` at `:19-22`; `loadEnvConfig` at `:24`; demo env blanking `:41-53`; `spawnSync` `:63-67`; `process.exit` `:70`. It is purely an env-and-spawn wrapper. |
| 24 | Turbopack reads `tsconfig.json` `paths`, so `@/runtime/target` needs no new alias | **CONFIRMED** (doc + behaviour) | `08-turbopack.md:113` verbatim: "**Path Aliases** | **Supported** | Reads `tsconfig.json`'s `paths` and `baseUrl`, matching Next.js behavior." Behaviour corroborated: 40+ `@/application/…`, `@/runtime/mode`, `@/server/…` specifiers already resolve with no `next.config.ts` entry. |
| 25 | …"so both configs must lose the aliases in the same commit **or the demo silently resolves server variants**" | **WRONG (the word "silently")** | The alias values in `tsconfig.json:24-42` are all **server** variants, incl. `@runtime/adult-portal-actions` → `adult-portal-actions.ts` (`"use server"`) and `@runtime/player-access-actions`, `@runtime/player-entry-action`, `@runtime/sign-in-action`, `@runtime/sign-out-action`. If `turbopack.resolveAlias` were deleted while `paths` survived, the demo build would resolve 5 `"use server"` modules into the graph → **E625 fires, loudly**. If the reverse, `tsc` emits TS2307 in ~23 importers. Both orderings fail noisily. The *pairing* requirement is right; "silently" is not. |
| 26 | `tsc --incremental` versions files by content hash, so byte-identical regeneration is free | **CONFIRMED** | `tsconfig.json:16` `incremental: true` (note: the task brief's "`:8`" is wrong — line 8 is `noUncheckedIndexedAccess`). `node_modules/typescript/lib/_tsc.js:129562 function getSourceFileVersionAsHashFromText`, consumed at `:129600 result.version = getSourceFileVersionAsHashFromText(...)`. `tsconfig.tsbuildinfo` inspected: `fileInfos[i].version` is a **64-hex SHA-256** (e.g. `./src/runtime/mode.ts` → `5899cef3…`, `signature 2205c16f…`). |
| 27 | R6: 95 `runtimeMode` occurrences in 23 files remain after §3.1 | **CONFIRMED exactly** | `grep -rn runtimeMode --include=*.ts --include=*.tsx src \| wc -l` = **95**; distinct files = **23**; top: `game-host.tsx` 15, `player-access-workflow.tsx` 10, `portal-shell-context.tsx` 9, `portal-shell.tsx` 8. |
| 28 | R2 "6 sync demo readers" must become async | **WRONG (count)** — 5, not 6 | `adult-portal-demo.ts:15,19,31,61` (4) + `player-access-demo.ts:14` (1) = **5** sync-vs-async pairs. INV-B's own line cites list 5; its prose says 6 in two places. |
| 29 | R1 (does a server reference survive a barrel hop?) is **UNVERIFIED** and the top unknown | **OVERSTATED as unknown** → now ~85% **YES** | The serializer dispatches on a **runtime value marker**, not syntax or import path (#12: `value.$$typeof === SERVER_REFERENCE_TAG`; `isClientReference(value)`), and the client layer emits named stubs we can read in the shipped chunks (#11). A re-export moves the same object. No restriction string exists in the native binary (searched `"Server Actions cannot be re-exported"`, `"is not allowed to be exported"`, all → miss). Details and the residual risk in §R1. |
| 30 | "There is no `ci.yml`; only `deploy.yml` runs `npm ci` then `npm run build:demo`" | **CONFIRMED** | `.github/workflows/` contains **only** `deploy.yml`; `:31` `npm ci`, `:34` `npm run build:demo`, `:37-39` upload `./out`. |

---

## Registration mechanism: what is provable vs inferred

**The task brief's hypothesis — "if ids cannot be mapped to files, say the mechanism is inferred from
counts" — is refuted in the favourable direction. The manifest on disk maps every id to a source file
and an exported name.**

`.next/server/server-reference-manifest.json` shape:

```
top keys: [ 'node', 'edge', 'encryptionKey' ]
node = 17, edge = 0
per-entry keys: workers, filename, exportedName
```

`filename` + `exportedName` are first-class fields. So registration is **directly observable per
module**, not inferred. Full dump (sorted by file):

| `filename :: exportedName` | workers |
| :-- | --: |
| `src/app/(professional)/entrar/actions.ts :: $$RSC_SERVER_ACTION_0` | 1 |
| `src/app/(professional)/portal/adult-portal-actions.ts :: assignOrganizationAdministratorAction` | 1 |
| `… adult-portal-actions.ts :: assignTeacherMembershipAction` | 1 |
| `… adult-portal-actions.ts :: assignTeacherToClassAction` | 1 |
| `… adult-portal-actions.ts :: changeClassStatusAction` | 1 |
| `… adult-portal-actions.ts :: changeMembershipAction` | 1 |
| `… adult-portal-actions.ts :: changeOrganizationStatusAction` | 2 |
| `… adult-portal-actions.ts :: createClassAction` | 1 |
| `… adult-portal-actions.ts :: createDemoProfessionalAction` | 1 |
| `… adult-portal-actions.ts :: createOrganizationAction` | 1 |
| `… adult-portal-actions.ts :: deactivateTeacherAssignmentAction` | 1 |
| `src/app/(professional)/portal/player-access-actions.ts :: allocatePlayerSlotsAction` | 1 |
| `… player-access-actions.ts :: endClassSessionAction` | 1 |
| `… player-access-actions.ts :: rotatePlayerCredentialAction` | 1 |
| `… player-access-actions.ts :: startClassSessionAction` | 1 |
| `src/app/(professional)/portal/sign-out-action.ts :: signOutAction` | **28** |
| `src/app/(public-play)/jogar/actions.ts :: resolvePlayerEntryAction` | 1 |

Cross-checked against the source: the 7 `"use server"` files export **24** actions
(`adult-portal-actions` 10, `player-access-actions` 4, `atividades/actions` 6, `sign-out-action` 1,
`entrar/actions` 1, `jogar/actions` 1, `recuperar/actions` 1). The 7 missing ones are **exactly**
`atividades/actions.ts :: {create,update,revoke,pause,resume,rotate}AccessLink*` (6) and
`entrar/recuperar/actions.ts :: requestPasswordResetAction` (1) — zero entries with those filenames.

**Provable from disk (no inference):**
1. A file-level `"use server"` module with 6 exports and 0 importers registers 0 ids while its sibling
   `page.tsx` **is** a compiled entry (`app-paths-manifest.json` → `/portal/atividades/page`,
   `/entrar/recuperar/page`, 44 entries total). ⇒ registration ⊄ route-tree membership.
2. `sign-out-action.ts` fans out to 28 workers through one `portal/layout.tsx` import ⇒ one seam
   import multiplies across entries (INV-B's "enforce it at the seam, not the call sites" argument).
3. The `$$RSC_SERVER_ACTION_0` naming for `entrar/actions.ts` is confirmed, matching the function-level
   `"use server"` at `entrar/actions.ts:16` (and `recuperar/actions.ts:11` uses the same shape).
4. Type bit decoding confirmed against `shared/lib/server-reference-info.js:35-38,47`
   (`infoByte = parseInt(id.slice(0,2),16)`, `typeBit = infoByte>>7&1`, `type = typeBit===1 ?
   'use-cache' : 'server-action'`). All 17 ids begin `40`/`60` → top bit clear → all server-actions.
   The `60`/`40` split as "used-arg mask" is consistent with `argMask = infoByte>>1&0x3f` at `:38`.

**Still inferred (state it plainly):** the *rule* "the compiled unit is the transitive import closure
of route entries" is inferred from (a) 24-export/17-id correspondence, (b) the two zero-importer files
being the exact delta, (c) 0 action markup in `out/`. No counterexample was found, and INV-B's
"unreferenced module is never compiled" is a correct restatement. The one mechanism I could **not**
verify statically is whether *unreached-but-reachable* exports of a reached `"use server"` file also
register — they do here (all 10 of `adult-portal-actions.ts` register, reached via 6 import sites),
which is consistent and mildly supports "registration is per-module, not per-binding". That is a
Day-2-relevant nuance: **the seam cannot register a subset.** If `target.server.ts` reaches
`adult-portal-actions.ts`, all 10 register even if only 4 are used.

**Where INV-B under-claimed:** it argued from `24 − 17 = 7` plus greps. It never mentioned that
`filename`/`exportedName` exist in the manifest — the fields that turn its "inferred" into "proven".
Its verdict on §3.1(1) is right for a stronger reason than it gave.

---

## server-only / client-graph analysis (importer table + the minimal correct seam shape)

### Importer table — the 24 sites, classified by *directive* and by *reader vs action*

Server-component importers (**13 statements / 17 specifiers / 12 files**). `use client` verified absent
at line 1 of each.

| Site | Spec | reader/action | Server impl reaches `server-only` / `next/server`? |
| :-- | --: | :-- | :-- |
| `portal/layout.tsx:9` | `getPortalShellData` | **reader** | yes / yes |
| `portal/page.tsx:3` | `getPortalOverviewData` | reader | yes / yes |
| `portal/turmas/page.tsx:3` | `getClassesPageData` | reader | yes / yes |
| `portal/turmas/[id]/page.tsx:6` | `getClassPageData`,`listStaticClassIds` | reader ×2 | yes / yes |
| `portal/turmas/[id]/page.tsx:7` | `getPlayerAccessPageData` | reader | yes / yes |
| `admin/organizacoes/page.tsx:3` | `getOrganizationsPageData` | reader | yes / yes |
| `admin/organizacoes/[id]/page.tsx:6` | `getOrganizationPageData`,`listStaticOrganizationIds` | reader ×2 | yes / yes |
| `admin/equipe/page.tsx:3` | `getTeamPageData` | reader | yes / yes |
| `resultados/page.tsx:2` | `getResultReportsPageData` | reader | yes / yes |
| `resultados/[classGroupId]/page.tsx:5` | `getClassResultsPageData`,`listStaticResultClassIds` | reader ×2 | yes / yes |
| `resultados/[classGroupId]/players/[playerSlotId]/page.tsx:5` | `getPlayerResultsPageData`,`listStaticResultPlayerParams` | reader ×2 | yes / yes |
| `entrar/page.tsx:8` | `signInAction` | **action** (`"use server"` origin) | stub in client layer |
| `components/portal/portal-shell.tsx:7` | `signOutAction` | **action** (`"use server"` origin) | stub in client layer |

Client importers (**11 statements / 21 specifiers / 11 files**). All verified `"use client"` at `:1`.

| Site | Spec | class |
| :-- | --: | :-- |
| `class-detail-screen.tsx:9` | 3 mutations | action |
| `classes-screen.tsx:12` | 1 | action |
| `deactivate-organization-control.tsx:7` | 1 | action |
| `organization-detail-screen.tsx:8` | 1 | action |
| `organizations-screen.tsx:11` | 2 | action |
| `player-access-workflow.tsx:17` | 4 | action |
| `team-screen.tsx:11` | 4 | action |
| `demo-role-controls.tsx:5` | 2 | bridge (d) |
| `use-demo-portal.ts:6` | 1 | bridge (d) |
| `player-entry-screen.tsx:8` | 1 | action (query) |
| `game-host.tsx:24` | 1 | action (query, token refresh) |

**⇒ 15 of 15 readers are imported exclusively from Server Components. 0 of the 11 client files imports
a reader.** INV-B's R9 says exactly this and it is correct.

### So is the flaw structural or prospective?

**Both, and the distinction matters for the fix's priority:**

* **Prospective in the code as it stands.** Nothing today puts `server-only` in a client graph. Verified
  empirically: `.next/static/**` (31 chunks) contains **no** `@prisma/client`, no `neon-gateway`, and no
  occurrence of the server implementations. The three `src/runtime/*-server.ts` files are reached only
  from the 12 server-component files.
* **Structural in the plan's composition.** §3.1(1) says `target.ts` *re-exports* a variant; §3.1(2) says
  that one contract covers "**actions AND build-time data readers**"; §3.1(4) requires **Client
  Components that import the seam**. The only re-export shape an implementer reaches for is `export *`,
  and once `target.server.ts` aggregates readers + actions, a client file importing `signInAction`
  makes `adult-portal-server.ts` a *static dependency of a client module*. The plan gives no instruction
  that would avoid this. So: **the defect is created by the plan's own three items composing, not by an
  implementer mistake** — but it is *not* triggered by any existing import edge.

### Severity calibration — where INV-B is OVERSTATED

What I can actually prove about the mechanism:

| Layer | Evidence | Effect |
| :-- | :-- | :-- |
| Module resolution | `create-compiler-aliases.js:220` server layer → `server-only/empty` (0 bytes); `:225` client layer → `server-only/index`. The **same table is compiled into the Turbopack native module** (binary strings `server-only` → `next/dist/compiled/server-only/empty` at `@83241136`, and a second table `client-only/error` + `server-only/index` at `@83241715`). | In the client layer, `import "server-only"` resolves to `node_modules/next/dist/compiled/server-only/index.js`, whose **entire body is `throw new Error("This module cannot be imported from a Client Component module. It should only be used from a Server Component.")`**. A bare side-effect import cannot be tree-shaken ⇒ top-level throw in a browser chunk ⇒ **runtime crash**, not a build failure. |
| Webpack build-time error | `webpack-config.js:1156-1185`: `next-invalid-import-error-loader` on `/^server-only$/` for `issuerLayer: {not: [...serverOnly, ...neutralTarget]}` → "cannot be imported from a Client Component module". | **Webpack only.** Next 16.3.2 builds with Turbopack, so this rule is not on the demo/server path today. INV-B cites it as the webpack "equivalent", which is fair, but its headline sentence ("Turbopack rejects outright") leans on it. |
| Turbopack build-time diagnostic | Native binary contains `@83333569`: `'client-only' … cannot be imported from a Client Component module … 'server-only'`, and `@83185968` the analogous `'next/root-params' cannot be imported from a Client Component module. It should only be used from a Server Component.` | A **message exists** in the Turbopack build, but I could not establish whether it is emitted as a fatal issue or only used at runtime, and `turbopack.ignoreIssue` would not be consulted for the exporter anyway. **UNPROVEN.** |
| Second, harder fence (INV-B under-weights) | `adult-portal-server.ts:3`, `game-events-server.ts:3`, `player-access-server.ts:3` all `import { connection } from "next/server"`. | `next/server` in a client layer is a well-known hard error class (the binary carries an `next/server` client-proxy table at `@83428930` alongside `client-only`/`server-only`/`react-dom/client`). This makes the merged-seam shape **more** clearly broken than `server-only` alone — and it is the argument I would use, not `server-only`. |
| Pruning | `config-shared.d.ts:1813` `turbopackInferModuleSideEffects: true` (default) | Could silently remove an unused reader re-export from a client entry. INV-B is **right** that a correctness property must not depend on this, and right that it is unverified. |

**Corrected statement:** a single merged seam makes `server-only` + `next/server` + Prisma/Neon *statically
reachable from Client Components*. Depending on side-effect inference this yields either a Turbopack
build-time issue or, worse, a **green build whose demo page throws in the browser at hydration**. Either
outcome is unacceptable; neither is reliably "the server build fails". The fix is identical either way,
so this correction changes the report's *rhetoric and gate design*, not its conclusion.

### The asserted asymmetry: CONFIRMED, with the real mechanism

`"use server"` module → Client Component: the bundler emits a **client-layer module** for the origin file
whose named exports are `createServerReference` stubs. Observed verbatim in
`.next/static/chunks/1_n4gwrdejd7x.js`:

```js
let s=(0,a.createServerReference)("602190b2405f71a0042515f4275ffd5aab1b4d0dc4",a.callServer,void 0,a.findSourceMapURL,"changeOrganizationStatusAction");
e.s(["changeOrganizationStatusAction",0,s],59891);
```

and the implementation is absent from every client chunk. So a `"use server"` boundary *is* a bundling
boundary, and it is what keeps today's client bundles clean even though `player-access-workflow.tsx`
imports a module whose graph reaches Prisma and Neon. A **plain** async function has no such boundary:
its module body is bundled verbatim. That asymmetry is exactly why `readers.server.ts`/`readers.demo.ts`
must be fenced by `server-only` (a marker) while the *action* half needs no fence at all (the directive
already fences it).

### Is INV-B's proposed fix minimal and correct?

**Directionally correct, slightly over-built.** Its fix = two generated files (`target.ts`, `readers.ts`),
`server-only` on **both** reader variants, a types-only `contracts.ts`, and a non-imported parity file.
That is the right shape. Three refinements:

1. **`server-only` on `readers.demo.ts` is a good idea but is not a new fence.** My reachability probe
   shows the demo graph **already** contains 11 `server-only` modules (`src/server/db/client.ts`,
   `prisma-*-store.ts`, `src/server/services/*-container.ts`, `src/server/auth/neon-gateway.ts`,
   `neon-server.ts`) and `pino`, `@prisma/adapter-neon`, `@prisma/adapter-pg`,
   `@prisma/client/runtime/*`, `@neondatabase/auth/next/server` — because `@/server/**` is imported by
   *concrete* paths and the 9 aliases fence nothing else. Those modules are in the **prerender (RSC)
   layer**, where `server-only` maps to `empty`, so today's `out/` succeeds. Therefore adding
   `server-only` to `readers.demo.ts` costs nothing and buys a real client-graph fence — but nobody should
   believe the seam "isolates the server graph". It does not, and cannot, at §3.1's scope.
2. **Use `next/server` as the fence argument, not `server-only`.** The readers already import
   `connection` from `next/server` (`*-server.ts:3`); `readers.demo.ts` does not need it and would not
   have it, so the *only* thing that makes the demo reader half fenced is the explicitly added
   `server-only`. Say that in the file header, or a Day-4 reviewer will "clean up" the seemingly
   contradictory import.
3. **A genuinely smaller alternative exists and INV-B listed it (option a) without connecting it here:**
   keep ONE generated file for actions+bridges and simply **do not route readers through the seam at all**
   — leave `@/runtime/adult-portal`, `@/runtime/player-access`, `@/runtime/game-events` as the three
   remaining generated entries, i.e. two generated files instead of one, which is the same answer. The
   only *strictly* smaller option is one generated `target.ts` + one generated `readers.ts`, which is
   exactly INV-B's proposal. So: **accepted, it is minimal.** 2 files, not 1, is the smallest shape that
   is not a comment.

---

## Is plan §3.1 item 4 implementable as written?

**No — as *rationalised*; yes — as *action*. And INV-B is right about why.**

The plan's operative instruction is "Convert `<form action={signInAction}>` and `<form action={signOutAction}>`
into small Client Components **so action handlers can be passed** without violating the Server→Client
serializability boundary." Splitting that:

* **The code change is implementable and safe.** Move the markup into `sign-in-form.tsx` /
  `sign-out-button.tsx` as `"use client"`. Both current hosts are Server Components:
  `entrar/page.tsx:10` is a **synchronous** SC (`getRuntimeMode()` at `:11`, `isDemo` at `:12`, branch at
  `:54`, `<form className={styles.form} action={signInAction}>` at `:73`, `name="email"` `:78` /
  `name="password"` `:86`), and `portal-shell.tsx:36` `PortalShell` takes `runtimeMode: RuntimeMode` as a
  **prop** (`:43`, supplied by `portal/layout.tsx:33`) and branches at `:59-77`
  (`<Link href="/entrar" aria-label="Sair do portal" className={styles.logoutButton}>` demo, `<form action={signOutAction}>` server).
* **The stated reason is inverted.** Passing a *server reference* as a prop is documented and legal
  (`07-mutating-data.md:172-198`, `04-glossary.md:238`). What is illegal is passing a *plain* function —
  and in demo mode `signInAction` **is** plain (`demo-auth-actions.ts:1` is an undirected async fn). So
  prop-passing works only in server mode and fails exactly in demo, which is the opposite of the plan's
  justification. INV-B's verdict "**Cannot work as rationalised; works differently**" is correct.
* **The design that works in both modes needs no passing at all**: the Client Component imports the seam
  itself and receives only serializable data. Today's `runtimeMode` prop is already exactly that.
* **Follow-on claims verified:**
  – `redirect()` cannot run in a client event handler (`redirect.md:54`), so the demo auth pair cannot be
  typed as "the same function". `entrar/actions.ts` calls `redirect()` at `:21,25,29,34,37` and
  `sign-out-action.ts:12`; the demo variants **throw** (`demo-auth-actions.ts:2` `"Demo sign-in uses
  static navigation."`, `:6` sign-out likewise). ⇒ the `runtimeMode` branch **survives as a render
  decision**. CONFIRMED.
  – A `<form method="get" action="/portal/">` fallback would bypass `basePath` (`basePath.md:22` — only
  `next/link`/`next/router` get the prefix), and the repo already hand-manages this in
  `src/app/page.tsx`, `adult-portal-helpers.ts`, `player-credential-print-sheet.tsx` via
  `process.env.APP_BASE_PATH`. ⇒ `<Link>` must stay for demo. CONFIRMED.
  – React forbids `method`/`encType` with a function action, so a unified no-JS `<form>` is not
  expressible. Consistent with the flight source; I did not locate the exact message string in the
  Turbopack-suffixed bundle (found it via the `.map` family only). Mildly weaker than INV-B implies.

**One thing INV-B does not say and Day 2 must:** converting these two hosts to Client Components **changes
what is prerendered**. `entrar/page.tsx` is currently a synchronous SC; making the form a CC means the
`/entrar` route gains a client chunk and the `Suspense`/`useSearchParams` boundary at `:31-35` must stay
server-rendered or the demo HTML changes. `out/entrar/index.html` today contains **0 `<form` tags** and the
literal text `Entrar na demonstração` — that is the assertion to lock in as the demo-mode gate, and it
holds now, so it is a usable before/after baseline.

---

## Drift axes table (demo vs server variants)

Resolved name-by-name from the 9 alias pairs (`next.config.ts:43-80` for demo, `tsconfig.json:24-42`
for server). ✓ = the pair typechecks against the other variant.

| Alias | Demo file | Server file | Drift found | Survives wrong-mode `tsc`? |
| :-- | :-- | :-- | :-- | :-- |
| `@runtime/adult-portal` | `adult-portal-demo.ts` | `adult-portal-server.ts` | **A1** 4 sync (`:15,19,31,61`) vs 6 async (`:16,20,24,47,59,70`) + 2 sync `listStatic*` (`:74,78`) both sides | ✓ (call sites `await` / `Promise.all`) |
| `@runtime/player-access` | `player-access-demo.ts` | `player-access-server.ts` | **A1** `:14` sync vs `:8` async; demo issuer stub `:10` throws `Static demo reads never issue player credentials.` | ✓ |
| `@runtime/game-events` | `game-events-demo.ts` | `game-events-server.ts` | **A1** none (both async; `listStatic*` `:109,113` vs `[]` at `:37,41`); **A4** server `getPlayerResultsPageData:26` is *unannotated* (inferred), demo `:68` annotates `Promise<PlayerReport \| null>` | ✓ |
| `@runtime/turmas…`/`admin/…`/`layout` | — | — | all read through `@runtime/adult-portal` | — |
| `@runtime/adult-portal-client` | `adult-portal-demo-client.ts` | `adult-portal-server-client.ts` | **A2** `loadClientPortalState(): DemoAdultPortalState` vs `: DemoAdultPortalState \| null` (`server-client.ts:3-5`) | ✓ (`use-demo-portal.ts:9,12` store `\| null`) |
| `@runtime/sign-in-action` | `demo-auth-actions.ts` | `entrar/actions.ts` | **A3** `signInAction()` 0 params vs `signInAction(formData: FormData)`; **A5** demo *throws* `:2`; server calls `redirect()` `:21,25,29,34,37` | ✓ (fewer params is assignable to the form-action slot) |
| `@runtime/sign-out-action` | `demo-auth-actions.ts` | `portal/sign-out-action.ts` | **A5** throws vs `redirect('/entrar')`; **A4** demo file exports **both** auth names ⇒ surface differs per mode | ✓ |
| `@runtime/adult-portal-actions` | `adult-portal-demo-actions.ts` (`"use client"` `:1`) | `portal/adult-portal-actions.ts` (`"use server"` `:1`) | **A6** only `_`-prefixed param-name differences; **A4** none | ✓ |
| `@runtime/player-access-actions` | `player-access-demo-actions.ts` (`"use client"` `:1`) | `portal/player-access-actions.ts` (`"use server"` `:1`) | **A4** demo also exports **class** `DemoPlayerCredentialIssuer` (`:31`) | ✓ |
| `@runtime/player-entry-action` | `player-entry-demo-actions.ts` | `public-play/jogar/actions.ts` | **A5** `demo_launch_<uuid>` vs HMAC with `APPLICATION_SECRET`; same type | ✓ |

**The 3 axes INV-B means are A1 (sync↔async), A2 (nullability), A3 (arity).** All three exist, all three
are real, and — this is the part worth stating flatly — **`export *` without an annotation lets all three
through in both directions.**

**Empirical proof (new; INV-B only reasoned this).** Three `tsc` runs, whole `src/` graph, only the 9
`@runtime/*` paths varied:

| Config | Resolution | Errors |
| :-- | :-- | --: |
| repo `tsconfig.json` | all 9 → **server** variants | **0** (baseline) |
| `%TEMP%\wrongmode\tsconfig.demo-in-server-shape.json` | all 9 → **demo** variants | **0** |
| `%TEMP%\wrongmode\tsconfig.positive-control.json` | 8 → demo, `@runtime/game-events` → `src/runtime/mode.ts` | **6 × TS2305** (`getResultReportsPageData`, `getClassResultsPageData`, `listStaticResultClassIds`, `getPlayerResultsPageData`, `listStaticResultPlayerParams`) |

The positive control proves the alias wiring is live, so the zero-error demo run is a true result:
**§3.1(2)'s "ensuring compile-time drift detection" does not exist today and will not exist from
`export *` alone.** INV-B's claim CONFIRMED, and now demonstrated rather than argued.

**A4 is a 4th axis INV-B omits.** With `export *`, the seam's *public type* is literally different per
mode: demo exposes `DemoPlayerCredentialIssuer` (a class) and both auth functions from one module, server
does not. Any consumer that happens to use one of those compiles in demo and breaks in server. This is an
independent argument for an **explicit named list** in the generated file, over and above the annotation
argument.

---

## Generated-file hazards and the exact mitigations

What `scripts/next-target.mjs` does today: **generates nothing.** It validates argv (`:13-22`), loads
`.env` (`:24`), builds an env object (`:26-53`), `spawnSync(process.execPath, [nextBin, command, ...args])`
(`:63-67`), exits `result.status ?? 1` (`:70`). No `node:fs`, no write, no marker. It also already
blanks `DATABASE_URL`, `DIRECT_URL`, `NEON_AUTH_*`, `APPLICATION_SECRET`, `ALLOWED_ORIGINS`,
`AUTH_DEV_BYPASS` for demo (`:41-53`) and pins `AUTH_DEV_BYPASS=false` for a server build (`:39`) — so it
*is* the right place for the seam write, exactly between `:24` and `:63`.

| Hazard | Caught today by | Verified how | Mitigation (exact) |
| :-- | :-- | :-- | :-- |
| File **absent** | `tsc` (TS2307 × ~23 importers) and `next build`'s own typecheck (`build/index.js:1068-1073`) | `tsc` baseline green today only because `paths` supply it | Also `postinstall`-time pregenerate, mirroring `package.json:26` `prisma generate`. Without it **`npm ci && npm run check` fails on a fresh clone** and any future `ci.yml` typecheck job must generate first. |
| Present, **stale demo** mode during `build:server` | **NOTHING** | Proven: demo-variant typecheck = 0 errors; `npm test` cannot reach the seam (`vitest.config.mts:6-9` aliases only `@`; baseline `vitest run` exit 0); lint is non-type-aware; E625 requires `output==='export'` (`export/index.js:360`) | **Gate both directions at prerender**, in the generated-file consumers: `if (TARGET_MODE !== getRuntimeMode()) throw new Error(...)` inside `readers.server.ts` and `target.server.ts` (`getRuntimeMode()` is at `src/runtime/mode.ts:7-11` and throws on a missing/invalid `APP_RUNTIME_MODE`). This is 3 lines, no tooling, and it converts the only shippable failure into a prerender abort. |
| Present, **stale server** mode during `build:demo` | E625 (`export/index.js:379-384`) — after compile + typecheck, before HTML | Read directly | Accept the cost; do not add a second mechanism. |
| Variants **export different names** (A4) | `tsc` only *if* the parity file exists | — | `src/runtime/contracts.check.ts`, non-imported, with `export`ed bindings (`export const demoConforms: TargetActions & TargetClientBridge = demoTarget;`) so `no-unused-vars` (warn × `--max-warnings=0`) cannot fire. |
| **Committed** by accident | `.gitignore` — currently **no** entry (ends `:27`) | Read directly | Add `/src/runtime/target.ts` and `/src/runtime/readers.ts`. |
| **Not prettier-clean** | `format:check` **will** catch it (`.prettierignore` has no `src` entry) | Read directly; `npx prettier --check` on an unimported `src` file exits 0, so the file *is* in scope | Emit prettier-clean bytes matching `.prettierrc.json` (2-space, double quotes, trailing commas — the current `src` style) **or** add the two paths to `.prettierignore`. Prefer emitting clean bytes; a gitignored+prettierignored generated file inside `src/` is invisible to every check. |
| Two concurrent dev servers share one seam | nothing | `next.config.ts:26-27` gives `npm run dev` → `.next` and `npm run dev:demo` → `.next-demo-dev`, but the *source* seam is shared | Document "one working copy, one target", or write a `.next/target-mode` sentinel. Do not attempt to solve it in the generator. |
| `next dev`/`next build` invoked directly | `next.config.ts:5-7` `z.enum(["demo","server"]).parse(process.env.APP_RUNTIME_MODE)` → `ZodError` at config load | Read directly | None needed; the existing fail-fast is correct and the generator must not weaken it with a default. |

**INV-B's write-only-on-change rule is right and now grounded:** `tsconfig.json:16` `incremental: true`,
`tsconfig.tsbuildinfo` stores 64-hex SHA-256 per file (`./src/runtime/mode.ts` → `5899cef3…`), computed by
`getSourceFileVersionAsHashFromText` (`_tsc.js:129562`, called at `:129600`). Byte-identical regeneration ⇒
identical `version` ⇒ the ~23 dependents are not rechecked; a stray `mode=demo` comment flip ⇒ rehash ⇒
effectively a full recheck. Note the header comment *contains the mode*, so the mode genuinely differs —
the rule protects against the *same*-mode no-op run, which is what repeats.

**Verdict on INV-B's requirement-5 table: it survives in full**, and its "asymmetric detection is a trap
for CI" framing is the report's most actionable line.

---

## R1 spike design

### What can be settled read-only (INV-B left this on the table)

**Recognition is by a runtime marker on the value, not by syntactic position.** From
`react-server-dom-turbopack-server.node.development.js` (via the shipped source map):

```js
if ("function" === typeof value) {
  if (isClientReference(value)) return serializeClientReference(request, parent, parentPropertyName, value);
  if (value.$$typeof === SERVER_REFERENCE_TAG) return serializeServerReference(request, value);
  …
  throw Error('Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server"…')
```

`serializeServerReference(request, value)` takes **the value**; the id travels on the object. And on the
client side, the per-action module already exports through a **named-export table**
(`e.s(["changeOrganizationStatusAction",0,s],59891)`), i.e. the construct the barrel hop needs already
exists one level down. Negative searches: `@next/swc-win32-x64-msvc.node` contains
`Only async functions are allowed to be exported in a … file.` (`@83432889`) and the
`registerServerReference` / `encryptActionBoundArgs` client-reference table (`@83428930`), but
**no** `Server Actions cannot be re-exported`, **no** `is not allowed to be exported`. The vendored docs
(`server-actions.md`, `use-server.md:46-97`, `07-mutating-data.md`) contain **no** re-export prohibition.

**Confidence the reference survives a barrel hop: HIGH (~85%).** The residual 15% is not "does identity
survive" — it does — but:
* **R1a.** INV-B's proposed generated shape is `const target: Contract = serverTarget; export const { signInAction, … } = target;`. That is a **value destructuring from an object at module init**, so the seam's exports are *not* statically-named re-exports. React's progressive-enhancement path needs `encodeFormAction`/`$$formAction` on the reference; if any of that is resolved statically by the bundler rather than from the marker, the object hop loses it. This is the realistic failure and it is specific to the shape INV-B recommends.
* **R1b.** Registration is per-*module*-reachable, so `target.server.ts` reaching `adult-portal-actions.ts` registers all 10 exports regardless of use (observed). Expected, harmless, but the Day-2 baseline count must be 17, not "the ones I wired".
* **R1c.** `ensureServerEntryExports` (`next-flight-loader/action-validate.js:14-24`, `E352`: "A `\"use server\"` file can only export async functions, found X") must never see the seam files. Hence: **no directive on any seam or variant file.** Note `player-access-demo-actions.ts:31` exports a **class**, which would trip E352 if the demo variant were ever folded into a directive-bearing file.

### The exact minimal spike (≤20 minutes, 5 lines, run first thing Day 2)

Do it with **one throwaway file and one existing action**, before writing `contracts.ts`.

1. `src/runtime/__r1-probe.ts` — *deliberately the destructuring shape, not `export *`*:
   ```ts
   import { changeClassStatusAction } from "@runtime/adult-portal-actions";
   const impl = { changeClassStatusAction };
   export const { changeClassStatusAction: probeAction } = impl;
   ```
2. Wire it into one existing **client** call site by adding one import and swapping one existing slot —
   `src/components/portal/class-detail-screen.tsx`: add
   `import { probeAction } from "@/runtime/__r1-probe";` and change the existing
   `<AdultPortalForm action={changeClassStatusAction}` (`:71`) to `action={probeAction}`.
3. `npm run build:server` then
   `node -e "const m=require('./.next/server/server-reference-manifest.json');console.log(Object.keys(m.node).length)"`
4. `npm run dev`, open `/portal/turmas/<seeded>`, submit the status form once.
5. **Delete both scratch edits** (they are the only writes; keep them uncommitted).

**Observables that decide it:**
* manifest count **stays 17** (not 18, not 16) and the `filename` set is unchanged ⇒ the hop neither
  duplicates nor drops registration. A new id whose `exportedName` is `probeAction` ⇒ the transform
  re-keyed the action by the seam's binding name; **that is a silent behaviour change** (the id is
  `filename::exportedName`), and the fix is to re-export under the *original* name only.
* the browser's submitted flight carries `changeClassStatusAction`'s existing id
  (`60…` in the manifest) and the mutation persists ⇒ R1a is dead.
* **failure signature to watch for:** build succeeds, page throws in the browser with
  `A "use server" file can only export async functions` / or the form does a **GET navigation to the page
  URL** instead of a flight POST ⇒ `encodeFormAction` was lost through the object hop. If you see this,
  switch the generated file to **named re-exports of the origin bindings**
  (`export { changeClassStatusAction } from "./target.server"`), which keeps the value destructuring out
  of the reference path — and record that in `contracts.ts` docs as a constraint, not a style choice.

**Cheaper pre-flight that costs 0 builds:** spike only step 3 with a `readers`-half probe — add
`import { getPortalShellData } from "@/runtime/target";` to one `"use client"` file and run
`npm run build:server`. That single run simultaneously answers R1, the merged-seam severity question
(build error vs runtime throw), and whether `turbopackInferModuleSideEffects` prunes the unused chain.
**Sequence the probe so one build answers three unknowns.**

---

## Claims that did not survive

**C-1 — the per-table specifier split (arithmetic).** "Table 1 — Server Components (13 statements,
**18** specifiers)" and "Table 2 — Client Components (11 statements, **20** specifiers)". True split is
**13/17** and **11/21**. The grand totals (24/38/23) are exact, and Table 2's own rows sum to 21
excluding the `portal-shell.tsx` row INV-B deliberately duplicated. Cosmetic, but it is the kind of
number a Day-2 implementer will diff against.

**C-2 — "6 sync demo readers".** Five: `adult-portal-demo.ts:15,19,31,61` + `player-access-demo.ts:14`.
Its own citation lists five. Stated twice ("The 6 sync demo readers must become async", R2).

**C-3 — "the demo silently resolves server variants" (§3.1(5) rationale).** The pairing requirement is
correct; the word *silently* is not. `tsconfig.json:24-42` point at 5 `"use server"` modules, so
losing only `turbopack.resolveAlias` makes `build:demo` register action ids → **E625, loud**. Losing only
`paths` → TS2307 in ~23 files → **loud**. The real reason to delete them together is that a leftover
`paths` entry keeps a *second, untyped* resolution channel alive for `tsc`/vitest/editors — a
maintainability argument, not a silent-failure one.

**C-4 — severity of the `server-only` defect: "breaks the SERVER build", "Turbopack rejects it
outright".** The hazard is real (see §server-only analysis) but the *provable* worst case is a
top-level `throw new Error("This module cannot be imported from a Client Component module…")`
(`next/dist/compiled/server-only/index.js`) bundled into a browser chunk — i.e. a **green build that
crashes at hydration** — unless Turbopack's own build-time diagnostic (message present in the native
binary at `@83333569`) fires as a fatal issue, which I could not establish without a build. The fix is
unchanged; the *gate* changes: "server build fails" is not a safe expectation, so the manifest/`TARGET_MODE`
gates are load-bearing, not belt-and-braces.

**C-5 — the `create-compiler-aliases.js` path.** Cited as `…/build/lib/create-compiler-aliases.js`
implicitly (the file is at `node_modules/next/dist/build/create-compiler-aliases.js`; there is no
`build/lib/` copy) — but its line numbers `220-228` are **exact** for the real file, so this is a path
typo, not a wrong citation. Likewise `is-app-page-route.js:13` (the `endsWith('/page')` is `:12`),
`eslint-config-next/dist/typescript.js:26-32` (actually `:33-39`), `next-target.mjs` "71 lines" (70) and
its `:14-21`/`:60-65` cites (`:13-22`/`:63-67`). Line drift is systematic (~3-7 lines) and every one of
them still lands inside the cited construct. Not material.

**C-6 — "`after()` … only `game-host-token.ts:20` `await refresh()`".** `grep -rn "\bafter("` over `src`
returns **nothing**. Conclusion (no exposure) is right; the cited hit is not there.

**C-7 — R1 rated "UNVERIFIED — the single highest-risk unknown".** Downgraded: ~85% resolvable from
source and shipped-chunk evidence already in the tree (see §R1). It still deserves the spike, but it is
not the "redesign the whole seam if it fails" risk INV-B describes, and rating it highest-risk
*before* reading `serializeTypedObject` was a missed 20 minutes.

**C-8 — "the manifest's presence with `node:{}` after a demo build" is only inferred.** INV-B flags this
itself. Left open, correctly, for VER-F.

**Nothing else in the report's substance fell.** Its citations of `export/index.js`,
`config-schema.js`, `build/index.js`, `jest.js:191-192`, `config-shared.d.ts:1811-1813`,
`08-turbopack.md:113`, `07-mutating-data.md:172-198`, `redirect.md:54`, `basePath.md:22`,
`next/types/global.d.ts`, `tsconfig.json:45-54`/`:16`, `docs/architecture-audit-2026-09-23.md:183`,
`docs/implementation/v1-architecture-plan.md:63-66,69-71`, `v1…69-71`, `.gitignore:26-27`, the
`out/` structure (3 seeded classes, 2 seeded orgs, `404.html`), the 95/23 `runtimeMode` count, and the
whole `contracts.ts` signature inventory all check out verbatim. Citation quality is well above the
house average for this dossier.

---

## What Day 2 must actually contain

**Files (net):** `src/runtime/contracts.ts` (types only), `target.ts` *(generated)*,
`target.server.ts`, `target.demo.ts`, `readers.ts` *(generated)*, `readers.server.ts`,
`readers.demo.ts`, `contracts.check.ts` (parity, unimported),
`src/components/portal/sign-in-form.tsx`, `sign-out-button.tsx`;
`sign-in-form`/`sign-out-button` **import the seam themselves** and take `runtimeMode` as a prop.
**Delete** `demo-auth-actions.ts` (both exports throw today) once `sign-in-form`/`sign-out-button` own
navigation. **`src/runtime/target.ts` must NOT carry any directive** in either file or in any variant
(E352; `player-access-demo-actions.ts:31` exports a class).

**Order (the sequencing is the actual deliverable, not the file list):**

1. **The combined probe first** (§R1): one build answers R1 + merged-seam severity + side-effect pruning.
   Stop-and-redesign trigger: the form does a plain GET instead of a flight POST.
2. **`contracts.ts` + the two seams with explicit named export lists** — not `export *` (proven useless:
   demo-mode typecheck is green; and A4 makes `export *` change the public surface per mode).
   `server-only` on **both** reader variants, with a header comment that demo reads execute in the
   prerender Node context (`adult-portal-demo-store.ts:347` `if (typeof window === "undefined") return
   cloneSeed()`), so a reviewer doesn't delete it as a contradiction.
   **Make the 5 sync demo readers `async`** (`adult-portal-demo.ts:15,19,31,61`,
   `player-access-demo.ts:14`); leave the four `listStatic*` **synchronous** (all 4 call sites declare
   sync `generateStaticParams`, and the server variants return `[]` at `adult-portal-server.ts:74,78` /
   `game-events-server.ts:37,41`).
3. **`TARGET_MODE` cross-check at prerender**, in both directions — the only gate for the one failure
   that can ship (proven: `tsc`/`lint`/`test` are all blind to it).
4. **Then** the 24 import-site rewiring, then the form→CC conversions (assert against the current
   `out/entrar/index.html`: 0 `<form`, contains `Entrar na demonstração`), **then** delete both alias
   blocks in the same commit.
5. **Generator work in `next-target.mjs`:** add `node:fs`, insert the write between `:24` (`loadEnvConfig`)
   and `:63` (`spawnSync`) so a bad invocation cannot leave a half-written seam, write only on content
   change (SHA-256 `incremental` reasoning above), emit prettier-clean bytes, and add the two paths to
   `.gitignore`. Refuse to run without an explicit target — `:13-22` already does this for
   `command`/`target`; never add a default (that is why §3.4's "safe default" was dropped).

**Omissions that could sink Day 2 (not in INV-B):**

* **O1 — `next/server` is a second fence and a better argument.** All three server readers import
  `connection` from `next/server` at `:3`, and `portal/layout.tsx:3` does too (guarded by
  `runtimeMode === "server"` at `:22`). Any "single seam" defence must cite `next/server`, not only
  `server-only`; and `connection()` means the readers are *dynamic-rendering* functions, so a demo
  reader must not be given one.
* **O2 — the demo graph is not server-free and the seam will not make it so.** Static closure of the 44
  route entries in **demo** mode still reaches 11 `server-only` modules plus `pino`,
  `@prisma/adapter-neon`, `@prisma/adapter-pg`, `@prisma/client/runtime/*` and
  `@neondatabase/auth/next/server`, because `@/server/**` is imported by concrete `@/…` paths that §3.1
  never touches. Two consequences: nobody should claim §3.1 isolates anything, and **any Day-2 edit that
  converts `src/server/auth/gateway.ts:26`'s dynamic `await import("./neon-gateway")` into a static
  import, or hoists `getServerRuntimeEnv()` to module scope, can break `build:demo` under
  `next-target.mjs:41-53`'s blanked env.** Add that to the Day-2 "do not touch" list.
* **O3 — `qrcode` reaches the *browser* from a Client Component**
  (`player-credential-print-sheet.tsx:4`, `"use client"`). It survives only because the package declares
  `browser: { './lib/index.js': './lib/browser.js', fs: false }`. Do not "tidy" that import into
  `readers.*`; it is a client dependency in both modes, and it is the one Node-named package that must
  stay in the client graph.
* **O4 — export-name sets differ per mode (axis A4).** `demo-auth-actions.ts` exports *both* auth names,
  `player-access-demo-actions.ts` additionally exports the class `DemoPlayerCredentialIssuer`, and
  **two aliases collapse onto one demo file** (`@runtime/sign-in-action` and `@runtime/sign-out-action`
  → both `demo-auth-actions.ts`), so the demo side has 8 targets for 9 aliases. A generated file that
  assumes 1:1 alias↔file parity will mis-wire the auth pair.
* **O5 — no seam test is possible in server mode.** `vitest.config.mts:12-15` is
  `environment: "node"` with `env.APP_RUNTIME_MODE: "demo"` only. INV-B's gate 5 therefore exercises one
  half. A two-project vitest config (or a second env) is needed for the server half; and any test
  importing the readers needs `resolve.alias: { "server-only": <empty stub> }`, because `server-only` is
  **not installed** and Vite has no ambient mercy (unlike tsc, which is saved by
  `next/types/global.d.ts`). Also note Vite's `@` alias is a **string prefix**, so `@runtime/x` currently
  mis-resolves toward `src/runtime/x` before failing — after §3.1(5) that path disappears, but the error
  message today is confusing enough to waste an hour.
* **O6 — re-baseline the count, don't assert it.** `24` exported actions / `17` registered is the
  Generation-A-inclusive baseline; 6 of the 7 unregistered live in the tree §2 deletes. Gate as
  `== 0` server-action ids for demo, `> 0` **plus a printed count** for server; `== 17` will rot the same
  week.
* **O7 — fresh-clone breakage.** `npm ci` runs only `prisma generate` (`package.json:26`). A gitignored
  seam therefore does not exist until a `next-target.mjs` run, so `npm run check` (`:21`, =
  `format:check && lint && typecheck && test`) fails on a fresh clone. Either pregenerate in
  `postinstall` or make the first CI step generate. There is still no `ci.yml`.
* **O8 — registration is per-module.** If `target.server.ts` reaches `adult-portal-actions.ts`, **all 10**
  exports register even if the UI wires 4. §3.1(3)'s "demo imports zero `use server`" is therefore the
  only property that matters; do not attempt partial exposure as an optimisation.
