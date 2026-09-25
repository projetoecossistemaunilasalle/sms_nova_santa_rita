# INV-B — Does the plan's dual-runtime seam actually work, mechanically?

**Scope:** `REFACTOR_PLAN.md` v2.1 §3.1 (steps 1-5), the 24 `@runtime/*` consumer sites, and the
Next.js 16.3.2 export/bundling mechanics that decide them.
**Method:** read-only. Every claim below is re-derived from this tree's files and this tree's
`node_modules/next/dist/…` (16.3.2, `node_modules/next/package.json`), plus live forensics on
`.next/server/server-reference-manifest.json` and `out/`. No builds were run, no code changed.
**Companion:** `NOTE-00-next16-mechanism-survey.md` (same folder) established the mechanism space;
this report answers its §7 verification requests 1, 2, 3 and 5 and supersedes it where more precise.

---

## Verdict on plan §3.1

**WORKS-WITH-CHANGES.** The core choice — a generated per-target entry re-exporting one of two
contract-conforming files — is mechanically sound, and the decisive question resolves in its favour.
Four of the five items are implementable as written; two need changes, and one is wrong as stated.

| §3.1 item | Verdict | Why |
| :-- | :-- | :-- |
| 1 generated `src/runtime/target.ts` | **Works** | An unreferenced module is never compiled. Proof: `src/app/(professional)/portal/atividades/actions.ts:1` is a file-level `"use server"` module with 6 exported actions, sits inside the live route tree, and registers **zero** ids, because its only importer anywhere is a test (`tests/unit/portal-dev-bypass-actions.test.ts:43`). Route-tree membership is irrelevant; only entry-reachability counts. |
| 2 both satisfy `contracts.ts` | **Works with changes** | `export *` from the generated file makes the seam's public type *the variant's* type, so call sites are checked against whichever mode happened to be generated last. 3 of 3 real drift axes today are invisible to a single-mode `tsc` (§Regressions R2). The generated file must be annotated with the contract, and a non-imported parity file is needed to check *both* variants in one pass. |
| 3 demo imports zero `"use server"` → 0 ids → passes E625 | **Works** | Confirmed by the same 0-of-6 evidence above, and by `out/` being a successful demo export of a tree that contains 24 actions. |
| 4 `<form action>` sites → Client Components "so action handlers can be passed" | **Cannot work as rationalised; works differently** | Passing a *server reference* as a prop is legal (`07-mutating-data.md:172-198`), so the stated problem does not exist on the server side; and passing a *plain function* is exactly what is illegal (`app-page-turbo.runtime.dev.js` flight serializer: `Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server"`). The legal shape is the one VV-C called M3: the Client Component **imports the seam itself** and receives only serializable data (`runtimeMode`) as a prop. |
| 5 delete the 9 aliases | **Works, and the deletion is not the risky part** | `08-turbopack.md:113`: Turbopack reads `tsconfig.json` `paths` itself, so both config files must lose the entries in the same commit or the demo silently resolves server variants. |

**The one genuine design flaw in §3.1 is not listed in §3.1:** step 2 mandates that *one* seam cover
"actions AND build-time data readers". All three server reader modules carry
`import "server-only"` (`src/runtime/adult-portal-server.ts:1`,
`src/runtime/player-access-server.ts:1`, `src/runtime/game-events-server.ts:1`), and step 4 requires
Client Components to import the seam. In the **server** build that places `server-only`, `next/server`
and the Prisma/Neon chain into the client bundle graph, which Turbopack rejects outright
(`@next/swc-win32-x64-msvc.node` carries the build-time message
`'server-only' … cannot be imported from a Client Component module`; the webpack equivalent is
`node_modules/next/dist/build/webpack-config.js:1156-1183`, and
`node_modules/next/dist/compiled/server-only/index.js:1` is a bare `throw`). The fix is one extra
generated file, not a redesign: split the seam into a UI-safe half and a server-only read half (§Per-item
requirements 2, `contracts.ts` surface).

---

## Consumer inventory (counted, not estimated)

Parsed over `src/**/*.{ts,tsx}` with a brace-aware import parser: **24 statements / 38 specifiers /
23 files** — matches `VV-C…:41` exactly. Class key: **(a)** build-time data reader, **(b)** mutation
called from a Client Component, **(c)** `"use server"` action bound directly to JSX `action=`,
**(d)** bridge/helper.

### Table 1 — Server Components (13 statements, 18 specifiers)

| Import site | Kind | Specifier | Class | Server impl (directive) | Demo impl | Throws? |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `src/app/(professional)/portal/layout.tsx:9` | async SC | `getPortalShellData` | a | `adult-portal-server.ts:16` async, `server-only:1` | `adult-portal-demo.ts:15` **sync** | no |
| `…/portal/page.tsx:3` | async SC | `getPortalOverviewData` | a | `…server.ts:20` async | `…demo.ts:19` **sync** | no |
| `…/portal/turmas/page.tsx:3` | async SC | `getClassesPageData` | a | `…server.ts:59` async | `…demo.ts:45` async | no |
| `…/portal/turmas/[id]/page.tsx:6` | async SC | `getClassPageData` | a | `…server.ts:70` async | `…demo.ts:61` **sync** | no |
| ‴ (same statement) | | `listStaticClassIds` | a (`generateStaticParams`, `:11-13`) | `…server.ts:78` sync → `[]` | `…demo.ts:73` sync → 3 ids | no |
| `…/portal/turmas/[id]/page.tsx:7` | async SC | `getPlayerAccessPageData` | a | `player-access-server.ts:8` async, `server-only:1` | `player-access-demo.ts:14` **sync** | no (but its issuer stub `player-access-demo.ts:8-12` throws `Static demo reads never issue player credentials`) |
| `…/admin/organizacoes/page.tsx:3` | async SC | `getOrganizationsPageData` | a | `…server.ts:24` async | `…demo.ts:23` async | no |
| `…/admin/organizacoes/[id]/page.tsx:6` | async SC | `getOrganizationPageData` | a | `…server.ts:38` async | `…demo.ts:31` **sync** | no |
| ‴ | | `listStaticOrganizationIds` | a (`generateStaticParams:13-15`) | `…server.ts:74` → `[]` | `…demo.ts:69` → 2 ids | no |
| `…/admin/equipe/page.tsx:3` | async SC | `getTeamPageData` | a | `…server.ts:47` async | `…demo.ts:35` async | no |
| `…/resultados/page.tsx:2` | async SC | `getResultReportsPageData` | a | `game-events-server.ts:15` async, `server-only:1` | `game-events-demo.ts:60` async | no |
| `…/resultados/[classGroupId]/page.tsx:5` | async SC | `getClassResultsPageData`, `listStaticResultClassIds` | a, a(gsp `:11-13`) | `…:19`, `…:37` → `[]` | `…:64`, `…:109` → 3 | no |
| `…/resultados/[classGroupId]/players/[playerSlotId]/page.tsx:5` | async SC | `getPlayerResultsPageData`, `listStaticResultPlayerParams` | a, a(gsp `:11-13`) | `…:26`, `…:41` → `[]` | `…:68`, `…:113` | no |
| `…/(professional)/entrar/page.tsx:8` | sync SC | `signInAction` | **c** (`<form … action={signInAction}>` at `:73`, inside `{isDemo ? … : …}` `:54`) | `entrar/actions.ts:15` **function-level** `"use server"` `:16`; body throws nothing, calls `redirect()` at `:21,25,29,34,37` | `demo-auth-actions.ts:1` `signInAction(): Promise<void>` — **`throw new Error("Demo sign-in uses static navigation.")`** | **yes (demo)** |

`src/components/portal/portal-shell.tsx:7` (`signOutAction`, class **c**, `<form action=…>` at `:68`
inside `runtimeMode === "demo" ? <Link/> : …` `:59-77`) is also a Server Component and is repeated in
Table 2 for call-site symmetry; it is *not* a client file. Server impl
`src/app/(professional)/portal/sign-out-action.ts:1` file-level `"use server"`, `:8`
`signOutAction(): Promise<void>`, `redirect('/entrar')` at `:12`. Demo impl
`demo-auth-actions.ts:5` — **`throw`** `:6`.

### Table 2 — Client Components / client hooks (11 statements, 20 specifiers)

All 11 files begin `"use client"` (verified at line 1 of each).

| Import site | Specifiers | Class | Server impl | Demo impl | Called via |
| :-- | :-- | :-- | :-- | :-- | :-- |
| `src/components/portal/portal-shell.tsx:7` | `signOutAction` | c (+ S→C JSX) | `portal/sign-out-action.ts:8` (file-level) | `demo-auth-actions.ts:5` throws | bound to `<form action>` `:68` (server branch only) |
| `…/class-detail-screen.tsx:9` | `assignTeacherToClassAction`, `changeClassStatusAction`, `deactivateTeacherAssignmentAction` | b | `portal/adult-portal-actions.ts:192,178,207` (file-level `:1`) | `adult-portal-demo-actions.ts:196,183,209` (`"use client"` `:1`) | `<AdultPortalForm action=…>` `:178,71,147` → `useActionState` (`adult-portal-form.tsx:31`) |
| `…/classes-screen.tsx:12` | `createClassAction` | b | `…actions.ts:160` | `…demo-actions.ts:170` | `<AdultPortalForm action=>` `:90` |
| `…/deactivate-organization-control.tsx:7` | `changeOrganizationStatusAction` | b | `…actions.ts:77` | `…demo-actions.ts:86` | `useActionState(async (prev,fd)=>{…}, init)` `:24-33`, `<form action={formAction}>` `:86` |
| `…/organization-detail-screen.tsx:8` | `changeOrganizationStatusAction` | b | `…actions.ts:77` | `…demo-actions.ts:86` | `<AdultPortalForm action=>` `:95` |
| `…/organizations-screen.tsx:11` | `changeOrganizationStatusAction`, `createOrganizationAction` | b | `…actions.ts:77,63` | `…demo-actions.ts:86,73` | `<AdultPortalForm action=>` `:79,169` |
| `…/player-access-workflow.tsx:17` | `allocatePlayerSlotsAction`, `endClassSessionAction`, `rotatePlayerCredentialAction`, `startClassSessionAction` | b | `portal/player-access-actions.ts:55,128,82,110` (file-level `:1`) | `player-access-demo-actions.ts:94,132,114,144` (`"use client"` `:1`) | `useActionState` `:129,208,325`; `formAction` `:151,241,400`; one **runtime-selected** action `:324` `const action = active ? endClassSessionAction : startClassSessionAction` |
| `…/team-screen.tsx:11` | `assignOrganizationAdministratorAction`, `assignTeacherMembershipAction`, `changeMembershipAction`, `createDemoProfessionalAction` | b | `…actions.ts:98,116,146,133` | `…demo-actions.ts:99,113,157,126` | `<AdultPortalForm action=>` `:140,223,346,376` |
| `…/demo-role-controls.tsx:5` | `changeDemoProfile`, `resetDemoPortal` | **d** | `adult-portal-server-client.ts:7,11` — no-ops (`void profileId`, `{}`) | `adult-portal-demo-client.ts:14,18` (`"use client"` `:1`) — real localStorage mutations | direct calls in `onClick` |
| `…/use-demo-portal.ts:6` | `loadClientPortalState` | **d** | `adult-portal-server-client.ts:3` → `null` | `adult-portal-demo-client.ts:10` → `DemoAdultPortalState` (non-null) | inside `useEffect` `:11-15` |
| `src/components/public/player-entry-screen.tsx:8` | `resolvePlayerEntryAction` | b (query) | `jogar/actions.ts:16` (file-level `:1`) — hashes token, mints HMAC launch token with `APPLICATION_SECRET` `:31-40` | `player-entry-demo-actions.ts:23` (`"use client"` `:1`) — `demo_launch_<uuid>` `:15-21` | `await` in an async fn `:72` |
| `src/components/public/game-host.tsx:24` | `resolvePlayerEntryAction` | b (query, token refresh) | ‴ | ‴ | `await` at `:182` inside a bearer-refresh path |

**Totals:** 15 class-(a) specifiers (12 page-scoped reads + 3 `generateStaticParams` readers… precisely:
9 `@runtime/adult-portal` + 1 `@runtime/player-access` + 5 `@runtime/game-events` = **15**);
**3** class-(d) bridges; **18** class-(b)/(c) action specifiers, of which exactly **2** are JSX-bound
server references in Server Components (class c) and **16** are client-invoked.

Note: `signInAction` is the only seam member whose server form is a **function-level** `"use server"`
declared *inside* the exported function (`entrar/actions.ts:16`), which is why it registers under the
generated name `$$RSC_SERVER_ACTION_0` rather than `signInAction` in the manifest.

### The 17-vs-24 gap, explained from the live manifest

`.next/server/server-reference-manifest.json` from the last `build:server`
(`.next/required-server-files.json` → `output:"standalone"`, `APP_RUNTIME_MODE:"server"`):

```
node = 17 ids, edge = 0
  sign-out-action.ts::signOutAction                                  → 28 workers
  adult-portal-actions.ts::{10 exports}                              → 1-2 workers each
  player-access-actions.ts::{4 exports}                              → 1 worker
  entrar/actions.ts::$$RSC_SERVER_ACTION_0                           → 1 worker
  jogar/actions.ts::resolvePlayerEntryAction                         → 1 worker
```

`24 − 17 = 7` = the 6 exports of `portal/atividades/actions.ts` plus the 1 export of
`entrar/recuperar/actions.ts` — the two `"use server"` files with **no importer in `src/` at all**
(verified: `grep` for `requestPasswordResetAction` matches only its own definition at
`entrar/recuperar/actions.ts:8`; `atividades/actions.ts` is imported only by
`tests/unit/portal-dev-bypass-actions.test.ts:43`). Their sibling pages *are* compiled
(`.next/server/app-paths-manifest.json` lists `/portal/atividades/page`, `/entrar/recuperar/page`),
and neither file still trips the export — **which is the direct answer to the decisive question**:
Next compiles the transitive import closure of route entries only; it does not compile every file
under `src/app/`, and it does not register an action that nothing imports.

The 17 registrations come from `signOutAction` being imported by `portal-shell.tsx`, which
`portal/layout.tsx` renders into all 28 portal entries — i.e. one seam import multiplies across
workers, which is why the seam (not the call sites) is the right place to enforce the property.

### E625 exact mechanics in 16.3.2

* Throw site: `node_modules/next/dist/export/index.js:357-386`. Conditions: `enabledDirectories.app`
  (`:358`) and `nextConfig.output === 'export'` (`:360`), then
  `[...Object.keys(manifest.node), ...Object.keys(manifest.edge)].some(id =>
  extractInfoFromServerReferenceId(id).type === 'server-action')` (`:375-379`), error code `E625`
  (`:380-384`).
* It is a **manifest-membership** test, not a source test. `use-cache` ids are exempt:
  `node_modules/next/dist/shared/lib/server-reference-info.js:35-38` — `typeBit = infoByte >> 7 & 1`;
  `typeBit === 1 → 'use-cache'` else `'server-action'`. All 17 ids here start `60`/`40`
  (`0x60 = 0b01100000`, `0x40 = 0b01000000`, top bit clear) → all 17 are server-actions; the second
  nibble is the used-arg mask (`60` = 2 args = `(previous, formData)`; `40` = 1 arg).
* Unlike its siblings, the gate has **no `!options.buildExport` guard** — compare `:336` (i18n `E587`)
  and `:343` (images `E603`). Both `exportApp` invocations reach it.
* **No opt-out**: `node_modules/next/dist/server/config-schema.js:245-248` defines
  `serverActions: { bodySizeLimit, allowedOrigins }` only; there is no `enabled`.
  `turbopack.ignoreIssue` filters *compile* issues, not exporter errors (NOTE-00 §2).
* **Failure ordering correction to both RV-C and VV-C.** `next build` runs: compile → app-dir type
  check (`node_modules/next/dist/build/index.js:1068-1073`, "For app directory, we run type checking
  after build") → static generation, which itself calls `exportApp({buildExport: true, nextConfig:
  exportConfig})` at `build/index.js:1910-1921` with `exportConfig = {...config}` (`:1783`) so
  `output:'export'` is inherited → E625 fires **there**, before any HTML is written, and again in
  `writeFullyStaticExport` (`:2771-2779` → `:427-437`). So the seam mistake surfaces after
  compile + typecheck but *before* the render loop — earlier than "after prerendering every route",
  and later than "config validation". Feedback cost is roughly one compile, not one full build.

---

## `contracts.ts` surface

Derived from the actual signatures above. Two interfaces, because the two halves have different
bundle-safety properties.

```ts
// src/runtime/contracts.ts — types only, no implementation, imports nothing from server/demo
import type { ActionResult } from "@/application/adult-portal/types";      // :112-116
import type { PlayerAccessActionResult } from "@/application/player-access/types"; // :51-56
import type { PlayerEntryActionResult } from "@/application/player-access/types";  // :80-86
import type { ClassDetailDto, OrganizationDetailDto, … } from "@/application/adult-portal/types";
import type { DemoAdultPortalState } from "@/runtime/adult-portal-demo-store";     // :123-135

/** UI-safe half: importable from Client Components in BOTH targets. */
export interface TargetActions {
  // --- auth (see "Per-item requirement 4": semantics differ per target, see below) ---
  signInAction(formData: FormData): Promise<void>;
  signOutAction(): Promise<void>;

  // --- adult portal mutations: all (previous, formData) => ActionResult ---
  createOrganizationAction(prev: ActionResult, fd: FormData): Promise<ActionResult>;
  changeOrganizationStatusAction(prev: ActionResult, fd: FormData): Promise<ActionResult>;
  assignOrganizationAdministratorAction(prev: ActionResult, fd: FormData): Promise<ActionResult>;
  assignTeacherMembershipAction(prev: ActionResult, fd: FormData): Promise<ActionResult>;
  createDemoProfessionalAction(prev: ActionResult, fd: FormData): Promise<ActionResult>;
  changeMembershipAction(prev: ActionResult, fd: FormData): Promise<ActionResult>;
  createClassAction(prev: ActionResult, fd: FormData): Promise<ActionResult>;
  changeClassStatusAction(prev: ActionResult, fd: FormData): Promise<ActionResult>;
  assignTeacherToClassAction(prev: ActionResult, fd: FormData): Promise<ActionResult>;
  deactivateTeacherAssignmentAction(prev: ActionResult, fd: FormData): Promise<ActionResult>;

  // --- player access mutations ---
  allocatePlayerSlotsAction(prev: PlayerAccessActionResult, fd: FormData): Promise<PlayerAccessActionResult>;
  rotatePlayerCredentialAction(prev: PlayerAccessActionResult, fd: FormData): Promise<PlayerAccessActionResult>;
  startClassSessionAction(prev: PlayerAccessActionResult, fd: FormData): Promise<PlayerAccessActionResult>;
  endClassSessionAction(prev: PlayerAccessActionResult, fd: FormData): Promise<PlayerAccessActionResult>;

  // --- player entry (query invoked from the client, not a mutation) ---
  resolvePlayerEntryAction(token: string): Promise<PlayerEntryActionResult>;
}

/** Client-only bridge helpers; server variant is a typed no-op. */
export interface TargetClientBridge {
  loadClientPortalState(): DemoAdultPortalState | null;   // null on the server target
  changeDemoProfile(profileId: string): void;
  resetDemoPortal(): void;
}

/** Server-side half. NEVER importable from a Client Component. Mark both variants server-only. */
export interface TargetReaders {
  // awaited by async Server Components — declare async, make the demo variants `async` too
  getPortalShellData(): Promise<PortalShellDto>;
  getPortalOverviewData(): Promise<PortalOverviewDto>;
  getOrganizationsPageData(): Promise<{ organizations: OrganizationSummaryDto[]; canCreate: boolean; role: AdultRole }>;
  getOrganizationPageData(id: string): Promise<OrganizationDetailDto>;
  getTeamPageData(): Promise<{ members: TeamMemberDto[]; organizations: OrganizationSummaryDto[]; profiles: ProfessionalOptionDto[]; role: AdultRole }>;
  getClassesPageData(): Promise<{ classes: ClassSummaryDto[]; organizations: OrganizationSummaryDto[]; role: AdultRole }>;
  getClassPageData(id: string): Promise<ClassDetailDto>;
  getPlayerAccessPageData(id: string): Promise<ClassWorkflowDto>;
  getResultReportsPageData(): Promise<ClassReport[]>;
  getClassResultsPageData(id: string): Promise<ClassReport | null>;
  getPlayerResultsPageData(classGroupId: string, playerSlotId: string): Promise<PlayerReport | null>;

  // static-param readers stay synchronous: called from generateStaticParams which returns arrays
  // (turmas/[id]/page.tsx:11-13, organizacoes/[id]/page.tsx:13-15,
  //  resultados/[classGroupId]/page.tsx:11-13, …/players/[…]/page.tsx:11-13)
  listStaticClassIds(): string[];
  listStaticOrganizationIds(): string[];
  listStaticResultClassIds(): string[];
  listStaticResultPlayerParams(): { classGroupId: string; playerSlotId: string }[];
}

/** A mutation the UI can hand to useActionState / <AdultPortalForm action=>. */
export type PortalMutation = (previous: ActionResult, formData: FormData) => Promise<ActionResult>;
// already exists at src/components/portal/adult-portal-form.tsx:11-14 — reuse it, do not redefine.
```

Shape notes that are forced by the code, not chosen:

1. **The 6 sync demo readers must become `async`.** `TargetReaders` says `Promise<T>`;
   `adult-portal-demo.ts:15,19,31,61` and `player-access-demo.ts:14` are sync `function`s and are not
   assignable. Call sites need no change (`turmas/[id]/page.tsx:24-27` already awaits through
   `Promise.all`, which accepts non-promises today — that is exactly why the drift is invisible).
   `listStatic*` must **not** be made async-capable-only: `generateStaticParams` is declared sync in
   all four call sites, and `adult-portal-server.ts:74-79` / `game-events-server.ts:37-46` return `[]`.
2. **`loadClientPortalState` is nullable.** `adult-portal-server-client.ts:3` returns `null`;
   `adult-portal-demo-client.ts:10` returns non-null. Union is the only sound type, and
   `use-demo-portal.ts:8-12` already stores `| null`.
3. **The auth pair cannot share one honest type.** See next section.

### What the types cannot express (and what breaks when a server action becomes a plain async fn)

| Unexpressible property | Server target | Demo target | Consequence |
| :-- | :-- | :-- | :-- |
| Cache invalidation | `revalidatePath()` per path list (`adult-portal-actions.ts:52`, `player-access-actions.ts:50-52`) | none; the UI re-reads via the `adult-portal-demo-change` CustomEvent (`adult-portal-demo-store.ts:364`) + `storage` (`use-demo-portal.ts:14-15`) | `Promise<ActionResult>` hides "the route's RSC cache is now stale". A future reader who writes `await createClassAction(...)` then expects fresh server data gets stale data in the server target only if they also forgot `useActionState`'s automatic refresh. Contract should carry the path list in its name/doc, not its type. |
| Navigation | `redirect()` throws `NEXT_REDIRECT` from the action (`entrar/actions.ts:21,25,29,34,37`; `sign-out-action.ts:12`) | impossible: `redirect.md:54` — "`redirect` can be called in Client Components during the rendering process **but not in event handlers**. You can use the `useRouter` hook instead" | `Promise<void>` means "returns" on one side and "never returns, navigates" on the other. `sign-in-form.tsx` must therefore own the navigation, or the demo branch must stay a `<Link>`. |
| Progressive enhancement / no-JS | Server reference: React encodes the action id into the submitted form, so a pre-hydration submit still works (`07-mutating-data.md:132` for Server Components, `:170` for Client Components) | plain function: nothing to encode; a JS-less submit POSTs to the page URL and does nothing (there is no server) | Acceptable for a demo, but the plan should not claim the two are interchangeable. Also: a function `action` forbids `method`/`encType` — React throws `Cannot specify a encType or method for a form that specifies a function as the action` (flight source in `app-page-turbo.runtime.dev.js.map`), so a `<form method="get">` fallback and a function action cannot coexist on one element. |
| `useActionState` payload shape | React supplies `(previousState, formData)`; the bound value must be a function of that arity | identical signature works | Nothing breaks — the repo already calls both halves through `useActionState` (`adult-portal-form.tsx:31`, `player-access-workflow.tsx:129`, `deactivate-organization-control.tsx:24`). React 19 renamed `useFormState`; no `useFormState` remains in `src/`. |
| Cryptographic weight of a return value | `resolvePlayerEntryAction` returns an HMAC launch token minted with `APPLICATION_SECRET` (`jogar/actions.ts:31-40`) | returns `demo_launch_<uuid>` (`player-entry-demo-actions.ts:15-21`) | Same `PlayerEntryActionResult` type, different trust. The seam type cannot (and need not) encode it, but the offline/bearer path in `game-host.tsx:182-192` inherits the difference. |
| `after()` | unused today (`grep` for `after(` in `src/` → only `game-host-token.ts:20` `await refresh()`, unrelated) | n/a | No current exposure; if `after()` is ever added to a server action it becomes another inexpressible asymmetry. |

---

## Per-item implementation requirements

### 1. Generation of `src/runtime/target.ts` (and the second seam file)

`scripts/next-target.mjs` (71 lines) currently has **no `node:fs` import** — its imports are
`node:child_process`, `node:url`, `node:path`, `@next/env` (`:1-4`) — so it must gain
`mkdirSync`/`writeFileSync`. Insert the write after `loadEnvConfig` (`:24`) and the env/target
validation (`:14-21`), before the spawn (`:60-65`), so a bad invocation never leaves a half-written
seam.

**Required content shape** (this is the load-bearing detail; a bare `export *` is not enough):

```ts
// src/runtime/target.ts — GENERATED by scripts/next-target.mjs. DO NOT EDIT. mode=demo
import { demoTarget } from "./target.demo";
import type { TargetActions, TargetClientBridge } from "./contracts";

export const TARGET_MODE = "demo" as const;
const target: TargetActions & TargetClientBridge = demoTarget;   // <-- the contract is the public type
export const {
  signInAction, signOutAction,
  createOrganizationAction, /* …15 more… */ resolvePlayerEntryAction,
  loadClientPortalState, changeDemoProfile, resetDemoPortal,
} = target;
```

Annotating `const target` with the contract before destructuring is what makes the seam's type
identical in both modes, and therefore what makes one `tsc` run meaningful and the generated file's
*mis*mode undetectable-by-design (mitigated in requirement 5a). `export * from "./target.demo"`
instead would type every consumer against whichever variant was generated last.

Emit the same shape for `src/runtime/readers.ts` over `TargetReaders`, with
`import "server-only"` present in **both** `readers.server.ts` and `readers.demo.ts` (the demo readers
are only ever called from async Server Components and `generateStaticParams`, i.e. the RSC layer,
where `server-only` resolves to the inert module — `create-compiler-aliases.js:220-228` shows the
server layer maps it to `server-only/empty`). That converts the "a Client Component must not import
the read half" rule from a comment into a Turbopack build error.

Byte-stability: write only if content differs (`if (readFileSync(p,'utf8') !== next) writeFileSync(...)`),
so `tsc --incremental` and Turbopack caches are not invalidated by a no-op run — see requirement 5.

### 2. `contracts.ts` and the two variant files

* Split as above: `target.server.ts` / `target.demo.ts` (UI-safe: 17 actions + 3 bridges) and
  `readers.server.ts` / `readers.demo.ts` (15 readers). Reason: the single-file version of step 2
  puts `adult-portal-server.ts:1`'s `import "server-only"` into the client graph in the server build
  (see Verdict). Whether Turbopack's default inference (`config-shared.d.ts:1813
  turbopackInferModuleSideEffects: true`) prunes the unused re-export is **UNVERIFIED**, and a hard
  correctness property must not depend on it.
* Add a **parity file that nothing imports**, e.g. `src/runtime/contracts.check.ts`:
  ```ts
  import { serverTarget } from "./target.server";
  import { demoTarget } from "./target.demo";
  import type { TargetActions, TargetClientBridge } from "./contracts";
  export type ServerConforms = typeof serverTarget extends TargetActions & TargetClientBridge ? true : never;
  export const demoConforms: TargetActions & TargetClientBridge = demoTarget;
  ```
  Because it is not reachable from a route entry, Turbopack never compiles it (proven by
  `atividades/actions.ts` above), yet `tsconfig.json:45-54` `include: ["**/*.ts"]` typechecks it, so
  **both** variants are validated against the contract in a single `npm run typecheck`, in either
  mode. This is what actually delivers §3.1(2)'s "compile-time drift detection"; the plan's phrasing
  does not, on its own.
* Do not make any seam file a `"use server"` module: `ensureServerEntryExports` enforces at runtime
  that a `"use server"` file exports only functions
  (`node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js:14-24`,
  error `E352`), and the native transform repeats it
  (`next-swc…node`: `Only async functions are allowed to be exported in a "use server" file`). The
  seam re-exports and object literals must live in directive-free files.
* Make the demo variants plain `async function`s (no directive needed — `"use client"` on
  `adult-portal-demo-actions.ts:1` etc. is what they are today and it is harmless in the client
  layer, but the seam file itself should carry no directive so it can be imported from either layer's
  *Server* half too, e.g. `entrar/page.tsx`).
* Delete the throwing stubs only if the demo auth pair gets real behaviour
  (`demo-auth-actions.ts:2,6`). With the recommended `sign-in-form.tsx`/`sign-out-button.tsx`
  (requirement 4) they become dead code and should be deleted in the same commit; leaving them means
  a demo user who ever triggers the path gets an uncaught `Error` instead of navigation.

### 3. Rewire the 24 import sites

Mechanical, but the split decides the target path for each class:

| Class | New specifier | Count |
| :-- | :-- | :-- |
| (a) readers, 12 statements in 11 Server Component files | `from "@/runtime/readers"` | 15 specifiers |
| (b) mutations/queries in 11 client files | `from "@/runtime/target"` | 16 specifiers |
| (c) the 2 JSX-bound actions | move into `sign-in-form.tsx` / `sign-out-button.tsx`, then `from "@/runtime/target"` | 2 |
| (d) bridges | `from "@/runtime/target"` | 3 |

No new alias is needed: `@/*` → `./src/*` (`tsconfig.json:23`) is already read by **both** `tsc` and
Turbopack (`08-turbopack.md:113` "Path Aliases — Supported — Reads `tsconfig.json`'s `paths` and
`baseUrl`"), which is exactly how every `@/application/...` import in this app already works without
any `next.config.ts` entry.

### 4. The two `<form action>` sites

**What they render today.** `entrar/page.tsx` is a synchronous Server Component (`:10`) that branches
on `isDemo = getRuntimeMode() === "demo"` (`:11-12`, branch at `:54`): demo → a read-only email/password
pair plus `<Link href="/portal">` (`:68-70`); server → `<form className={styles.form}
action={signInAction}>` (`:73-95`). `PortalShell` (`portal-shell.tsx:36`) is a Server Component
receiving `runtimeMode: RuntimeMode` as a prop (`:38`, passed from `portal/layout.tsx:31`); the logout
slot branches at `:59-77`: demo → `<Link href="/entrar" aria-label="Sair do portal">` (`:60-66`),
server → `<form action={signOutAction}>` (`:68-76`).

**Minimal correct implementation.** Client Components that **import the seam internally** and receive
only serializable data. No function crosses the S→C boundary in either direction:

* `src/components/portal/sign-out-button.tsx` (`"use client"`): `import { signOutAction } from
  "@/runtime/target"`, prop `runtimeMode: RuntimeMode` (or a narrower `demoSignOutHref`), demo branch
  keeps `next/link`'s `<Link href="/entrar">` (the existing `styles.logoutButton` markup, so CSS does
  not churn), server branch keeps `<form action={signOutAction}>`.
* `src/components/portal/sign-in-form.tsx` (`"use client"`): imports `signInAction`; server branch
  renders the existing `<form action={signInAction}>` with the same `name="email"`/`name="password"`
  fields (`entrar/page.tsx:74-94`), demo branch renders the read-only inputs + `<Link href="/portal">`
  (`:55-71`). `SignInError` stays where it is (`:31-35`, wrapped in `Suspense` because it uses
  `useSearchParams` — `sign-in-error.tsx:3,8`).

**Why prop-passing a server reference is allowed and a plain function is not.** A `"use server"`
export crossing into a Client Component is serialized as an *id*, not as a callable — that is the
whole design of the flight serializer, and it is documented as a supported pattern
(`07-mutating-data.md:172-198` "Passing actions as props", and `use-server.md:46-97` "Using Server
Functions in a Client Component", which is literally "import it from the `use server` file"). A
non-reference function hits the serializer's fallback and throws
`Functions cannot be passed directly to Client Components unless you explicitly expose it by marking
it with "use server"` (extracted from `node_modules/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js.map`,
flight `serializeTypedObject`; sibling messages `Event handlers cannot be passed to Client Component
props.` for `/^on[A-Z]/` props and `Functions are not valid as a child of Client Components.` for
children). So:

* **Server-only world:** both designs work (import or prop).
* **Demo world:** only *import inside the client module* works, because the value is a plain
  function. ⇒ **the demo needs the import, not the prop.** This is why §3.1(4)'s phrase "so action
  handlers can be passed" describes the one design that cannot work in the demo, while the design
  that does work needs no passing at all. VV-C's M3 had already refuted the dichotomy; this closes it.

**`basePath` consequences.** `basePath: "/SMS_Portal"` is set only for the demo production target
(`next.config.ts:28`) and `APP_BASE_PATH` mirrors it (`:36-39`), being `""` for both the server target
and demo *dev*. `next/link` prefixes automatically (`basePath.md:22` "When linking to other pages
using `next/link` and `next/router` the `basePath` will be automatically applied"), which is why
today's demo branches work with plain `href="/portal"` / `href="/entrar"`. A hand-written
`<form method="get" action="/portal/">` would **bypass** `basePath` and 404 on GitHub Pages; the
repo already carries the workaround pattern three times (`src/app/page.tsx:1`
`` `${process.env.APP_BASE_PATH ?? ""}/entrar/` ``,
`src/components/portal/adult-portal-helpers.ts:126-130`,
`src/components/portal/player-credential-print-sheet.tsx:21-22`). Because React forbids
`method`/`encType` alongside a function action, a no-JS GET fallback is not expressible on the same
element — so keep `<Link>` for demo (an anchor works without JS and gets the prefix for free) and do
not try to unify the two into one `<form>`. `trailingSlash: true` (`:29`) means the demo hrefs should
keep the trailing-slash-free form and let Next normalize, as today.

**Neon Auth external login.** The server half of the seam reaches
`getNeonAuthServer().signIn.email(...)` / `.signOut()` (`entrar/actions.ts:32`,
`sign-out-action.ts:10`) through `src/server/auth/neon-server.ts:1` (`import "server-only"`,
`createNeonAuth` at `:13-20` with `NEON_AUTH_BASE_URL` + cookie secret). None of that can exist in a
static export, so the demo `signInAction` must *not* be typed as "does the same thing"; the honest
demo contract is "navigate to `/portal`". Session in the demo comes from
`src/server/auth/demo-gateway.ts:4-17` (`DEMO_SESSION`, `expiresAt` year 2099) selected at
`src/server/auth/gateway.ts:36-38`, which is what lets `portal/layout.tsx:24-26` pass at prerender.
`entrar/recuperar/page.tsx` is already a `"use client"` page whose sibling
`recuperar/actions.ts:8-11` has no importer at all, so the shipped `out/entrar/recuperar/index.html`
is a dead form — VV-C's M2, still true, and the seam should not be blamed for it.

### 5. Generated-file hazards, and the gates that catch them

| Failure | Detected by | Notes |
| :-- | :-- | :-- |
| **File absent** | `tsc --noEmit`: TS2307 in all 23 importers; also `next build`'s own type check (`build/index.js:1068-1073`) | `npm test` does **not** catch it (no test imports the seam — `vitest.config.mts:5-11` aliases only `@`, and the 9 existing runtime tests import concrete files, see `tests/unit/adult-portal-service.test.ts:11`, `demo-player-access.test.ts:16-21`, `game-offline-sync.test.ts:16`, `runtime-mode.test.ts:3`, `demo-professional-creation.test.ts:8-9`, `demo-portal-helpers.test.ts:18`). Asymmetric detection is a trap for CI. |
| **File present, wrong/stale mode → demo build** | E625 (`export/index.js:380-384`), i.e. after compile + typecheck | Loud, and the plan's criterion 2 gate makes it explicit. |
| **File present, wrong mode → server build** | **Nothing.** `build:server` succeeds and ships a localStorage-backed demo as the production app | This is the worst case and the exact inversion of the repo's own guardrail `docs/implementation/v1-architecture-plan.md:63-66` ("must not accidentally select production auth or persistence behavior"). Must be gated: assert `TARGET_MODE === getRuntimeMode()` and, for `build:server`, that the manifest is non-empty. |
| **Two variants export different names** | one `tsc` run, *only if* the parity file of requirement 2 exists | With `export *` and no parity file you must typecheck twice (once per generated mode) to see it. |
| **Committed by accident** | `.gitignore` gap | `.gitignore` ends at `:26-27` (`/src/generated/prisma`); there is no entry for `target.ts`. Add `/src/runtime/target.ts` and `/src/runtime/readers.ts`. Precedent: the Prisma client is a gitignored generated module *inside* `src/` produced by `postinstall` (`package.json:26`). |
| **Not prettier-clean** | `npm run format:check` (`package.json:19`, `prettier --check .`; `.prettierignore` does not cover `src`) | Emit already-formatted bytes matching `.prettierrc.json`, or add the files to `.prettierignore`. Trivially fixable, and a guaranteed red CI otherwise. |
| **`const target: … = …` flagged by lint** | `npm run lint` is `eslint . --max-warnings=0` (`package.json:17`) and `eslint-config-next/dist/typescript.js:26-32` downgrades `@typescript-eslint/no-unused-vars`/`no-unused-expressions` to **warn** — a warning is a CI failure here | Any "unused" parity-check binding must be `export`ed. ESLint does **not** need to resolve `@/runtime/target`: `nextTypeScript` is `typescript-eslint.configs.recommended`, not type-aware, so unresolved modules are not lint errors. |

`tsc --incremental` behaviour (`tsconfig.json:16`, cache file `tsconfig.tsbuildinfo` gitignored at
`.gitignore:19`): TS stores a per-file `version` derived from a SHA-256 of the file **text**
(`node_modules/typescript/lib/_tsc.js:129562 getSourceFileVersionAsHashFromText`, consumed at
`_tsc.js:126174` `const version2 = sourceFile.version`, written into `fileInfos` at
`_tsc.js:126187-126193`). Therefore: regenerated **identical bytes → same version → no recheck of
the 23 dependents** (cost is one hash); **different bytes → every dependent re-checks**, which for
this graph is effectively a full typecheck. Hence the write-only-on-change rule in requirement 1.

Turbopack in dev: the generator runs *before* `spawn` (`next-target.mjs:60-65`), so `next dev` only
ever sees a complete file. The realistic hazard is two concurrent dev servers in one working copy
(`npm run dev` + `npm run dev:demo`) — they use separate `distDir`s (`.next` vs `.next-demo-dev`,
`next.config.ts:26-27`) but **share** the generated seam, so the later writer silently rebinds the
earlier server. Whether a mid-flight rewrite is picked up cleanly by Turbopack's watcher is
**UNVERIFIED** (no build run in this pass); the cheap mitigation is a lock/target file
(`.next/target-mode`) or simply documenting that one working copy runs one target at a time.

`next dev`/`next build` invoked directly (bypassing the npm scripts): `next.config.ts:5-7`
`z.enum(["demo","server"]).parse(process.env.APP_RUNTIME_MODE)` throws a `ZodError` at config load,
so the seam file's absence is never reached. That existing fail-fast is the reason the plan's §3.4
"safe default" idea was correctly dropped; the same posture should apply to the generator — it should
refuse to run without an explicit target (`next-target.mjs:14-21` already validates
`command`/`target` and exits 1), never default.

---

## Config & tooling changes

Non-`next` consumers that must resolve the seam, and what changes for each:

| Tool | Today | Change required |
| :-- | :-- | :-- |
| `tsc --noEmit` (`package.json:20`) | `tsconfig.json:24-42` supplies 9 `@runtime/*` paths, **all server variants** (the split-brain); `include: ["**/*.ts","**/*.tsx","**/*.mts"]` (`:45-53`) already typechecks *both* variants standalone, so what is unchecked is variant-vs-call-site conformance | Delete `tsconfig.json:24-42` (9 entries). `@/*` (`:23`) is sufficient for `@/runtime/target` and `@/runtime/readers`. **`src/runtime/target.ts` must be in the program** — it is, twice over: `include` glob, and transitively via `.next/types/validator.ts` / `.next/dev/types/validator.ts`, which `import type { … } from "../../../src/app/…/page.js"` for every route (`:53,62,71,80,…` of the current 448-line generated file) and thus pull the whole app graph. `exclude` is not needed for it; note that plan §3.2's `src/generated/**` exclusion does **not** break `@/generated/prisma/enums` (excluded files still enter via imports). |
| Turbopack (dev and build) | `next.config.ts:43-79` `turbopack.resolveAlias`, 9 keys | Delete the whole `turbopack.resolveAlias` block (the `turbopack` key at `:42-80` becomes empty → drop it). Keep `env.APP_RUNTIME_MODE` (`:36`) and `APP_BASE_PATH` (`:37-40`) — both still consumed at runtime (`src/server/config/env.ts:41`, `env.ts:121`). Do **not** move the seam into `tsconfig.json:paths` as a substitute: Turbopack reads `paths` too (`08-turbopack.md:113`), so it would keep working while reintroducing the untyped swap §7.2 forbids. |
| vitest (`vitest.config.mts:5-11`) | aliases **only** `@`; no `@runtime` alias, therefore **no test can import the seam today** — matches `docs/architecture-audit-2026-09-23.md:183` "Coverage of the runtime swap: none possible" | **No change needed** to resolve `@/runtime/target` — that is the generated file's real payoff over an alias. But a test that imports the **readers** half (or the server actions' transitive graph) needs `resolve.alias: { "server-only": <empty stub> }`, mirroring what Next itself does for Jest (`node_modules/next/dist/build/jest/jest.js:191-192` `'^server-only$': require.resolve('./__mocks__/empty.js')`), because the `server-only` package is **not installed** in this repo (only `client-only` is; `next/types/global.d.ts:49-63` declares the module for TypeScript and notes "TSC *doesn't check side-effecting imports*"). Vite has no such mercy. The existing pattern for testing server action modules is full `vi.mock` of the transitive graph (`tests/unit/player-access-actions.test.ts:13-24`, `portal-dev-bypass-actions.test.ts:3-15`). |
| ESLint (`eslint.config.mjs:7-17`) | flat config: `nextVitals`, `nextTypeScript`, `prettier`, `globalIgnores([".next/**",".next-demo-dev/**","out/**","coverage/**","src/generated/**"])` | No resolution work. Keep the generated files **linted** (they are ordinary code and the `no-unused-vars`/`max-warnings=0` interaction above is worth catching). Only add an ignore if the generator's header comment ever trips a rule. |
| Prettier | `.prettierignore:1-10` (no `src` entries) | Generator emits prettier-clean bytes; otherwise add the two generated paths. |
| Prisma (`prisma.config.ts`, `postinstall` `package.json:26`) | does not touch `@runtime` | No change. Its `postinstall` is the precedent for "generate a missing gitignored module inside `src/` at install time" — see the recommended `pregenerate` wiring below. |
| `.next/types` | generated by Next; validated by `tsc` | No change; it is the strongest argument that a missing seam file is caught at typecheck rather than at export. |
| GitHub Actions | only `.github/workflows/deploy.yml` exists — `pages` build runs `npm ci` then `npm run build:demo` (`:30-34`) and uploads `./out` (`:36-39`). There is **no `ci.yml`** (plan §6 Day 0 and §7.4 assume one) | `build:demo` already regenerates via `next-target.mjs`, so deploy is safe. A future lint/typecheck job must generate first: e.g. `"typecheck": "node scripts/next-target.mjs prepare server && tsc --noEmit"` or a dedicated `node scripts/gen-target.mjs <mode>` step, plus a `git diff --exit-code` style check that the generated file is never committed. |

Net new files: `src/runtime/contracts.ts`, `contracts.check.ts`, `target.ts` (generated),
`target.server.ts`, `target.demo.ts`, `readers.ts` (generated), `readers.server.ts`,
`readers.demo.ts`, `src/components/portal/sign-in-form.tsx`, `sign-out-button.tsx`.
Net deletions: `src/runtime/demo-auth-actions.ts`, `src/runtime/adult-portal-{server,demo}{,-client}.ts`
and the 9 alias blocks (their contents move into the variant files).

---

## Regressions and edge cases

**R1 — the barrel re-export of server references is the linchpin and is undocumented.** Every
vendored example imports a server action *from the `"use server"` file itself*
(`use-server.md:46-97`, `07-mutating-data.md:134-165`). Today's aliases do exactly that (the specifier
resolves to the real file). The new design inserts a re-export hop (`page.tsx → @/runtime/target →
target.server.ts → entrar/actions.ts`). If the reference survives, `build:server` still registers 17
ids and a mutation round-trips in `next dev`; if it does not, the whole seam shape is wrong and the
fallback is two generated files that *are* the alias target (i.e. generate `target.server.ts`'s body
per mode) or requirement 2's split plus one alias. **UNVERIFIED — must be a Day-2 spike run before
anything else, cost ≈ 1 build.** This is the single highest-risk unknown in §3.1 and the plan does not
mention it.

**R2 — drift detection is weaker than §3.1(2) claims, in the specific way that matters.** All three
real signature differences today survive a wrong-mode typecheck: 6 demo readers are sync where the
server ones are `async` (`adult-portal-demo.ts:15,19,31,61`, `player-access-demo.ts:14`) and every
call site awaits, so `Promise.all([getClassPageData(id), getPlayerAccessPageData(id)])`
(`turmas/[id]/page.tsx:24-27`) typechecks either way; `loadClientPortalState()` non-null vs `| null`
is assignable into `useState<DemoAdultPortalState | null>` (`use-demo-portal.ts:8-12`); and
`signInAction()` with zero parameters is still assignable to React's form-action slot. Mitigation:
the contract-annotated generated file + `contracts.check.ts` (requirements 1-2).

**R3 — the silent wrong-mode server build** (row 3 of the table in requirement 5) is the only failure
that can ship. Gate it.

**R4 — hydration flash is unchanged but becomes structural.** Prerendered demo HTML is always the
seed/`PLATFORM_ADMIN` snapshot (`adult-portal-demo-store.ts:347` returns `cloneSeed()` when
`typeof window === "undefined"`; `:149` pins the active profile), with 10 screens re-reading after
mount via `use-demo-portal.ts:11-15`. Verified in `out/portal/turmas/index.html`, which contains
`3º A` and `demo-turma-3a`. The seam must not tempt anyone into making a reader client-side.

**R5 — `generateStaticParams` still fixes the demo to seeds.** `listStaticClassIds()` → 3 ids
(`adult-portal-demo.ts:73-75`, `DEMO_CLASS_IDS` at `…-store.ts:49-53`), and `out/portal/turmas/` has
exactly those 3. A demo-created class/organization therefore 404s on refresh (no SPA fallback;
`out/404.html` exists and `deploy.yml` uploads `./out` verbatim). The seam does not touch this; the
"functional demo" criterion has to stay scoped to seeded routes or be fixed separately.

**R6 — mode branching does not shrink.** 95 `runtimeMode` occurrences in 23 files remain after
§3.1(1-5); the seam replaces only the 24 module-resolution branches. Most of the 95 are genuinely
different *renderings and transports* (`game-host.tsx` 15, incl. POSTs to `/api/v1/player/*` at
`:288-302` and `<DemoGameAdapter/>` at `:871-872`; `player-access-workflow.tsx` 10;
`portal-shell-context.tsx` 9). Requirement 4 in fact **keeps** the branch inside two new client
files. Anyone reading §3.1 as "mode checks go away" will be disappointed; §7.2's alias criterion is
the only thing that actually closes.

**R7 — the Generation A purge buys zero E625 safety** (already in RV-C F1, re-confirmed here): 6 of
the 7 unregistered actions are exactly the `atividades` ones §2 deletes. Conversely, if the purge
also removes a *registered* action, the discriminating count in "Verification gates" must be
re-baselined the same day.

**R8 — two dev servers, one seam file** (requirement 5) and the shared `.next` Turbopack filesystem
cache for `build:demo`/`build:server` (`config-shared.d.ts:1811-1812`, both
`turbopackFileSystemCacheFor{Dev,Build}: true`). Cache keys are content-addressed, so this is a
"blame it before you blame us" item, but a `--no-cache` reproduction step belongs in the Day-2 runbook.

**R9 — `server-only` on the demo readers is new.** Today `adult-portal-demo.ts` has no directive, so
accidental client import of a demo reader is silently possible; adding it to `readers.demo.ts` (per
requirement 2) turns an existing latent bug into a build error. If any client file currently imports
a reader, that error appears on first wiring — the inventory shows none (all 15 readers are imported
only from the 11 Server Component files), so it should be a no-op.

---

## Verification gates that actually discriminate

Ordered by cost. Each is written so a specific failure makes it fail, and each is checked in both
modes.

1. **Manifest emptiness for demo / non-emptiness for server.**
   `node -e "const m=require('./.next/server/server-reference-manifest.json');const ids=[...Object.keys(m.node),...Object.keys(m.edge)].filter(i=>parseInt(i.slice(0,2),16)>>7===0); if(process.env.APP_RUNTIME_MODE==='demo'?ids.length:ids.length!==17)process.exit(1)"`
   — the `type==='server-action'` filter replicates `export/index.js:375-379` (`typeBit = infoByte>>7&1`).
   Count 17 is today's server baseline; re-baseline after §2's purge. This is the *only* gate that
   proves §3.1(3). Note the manifest is `require`d unconditionally at `export/index.js:359`, so its
   presence with `node:{}` after a demo build is itself an assertion (inferred from the passing
   `out/` export; verify literally once).
2. **`out/` structural assertions** instead of the unfalsifiable "no `api/` in `out/`"
   (RV-C F2 — `export/index.js:249-257` skips `isAPIRoute`, and app route handlers are keyed
   `…/route` in `.next/server/app-paths-manifest.json` while `isAppPageRoute()` requires a trailing
   `/page` (`node_modules/next/dist/lib/is-app-page-route.js:13`), so they can never appear):
   assert `out/index.html`, `out/entrar/index.html` contains `Entrar na demonstração` and **no**
   `<form` action markup, `out/portal/turmas/{demo-turma-3a,demo-turma-4a-campos,demo-turma-5b}/index.html`
   exist, and `grep -c '\$ACTION_ID' out/**/*.html` is 0.
3. **Seam mode cross-check at build time.** Generated `TARGET_MODE` constant (requirement 1)
   compared against `getRuntimeMode()` inside `readers.server.ts`/`target.server.ts` —
   `if (TARGET_MODE !== getRuntimeMode()) throw new Error(…)`. Kills R3's silent-shipping case in
   both directions, at prerender time, with no tooling.
4. **`tsc --noEmit` twice only if you skip requirement 2's parity file.** With
   `src/runtime/contracts.check.ts` one run in any mode checks both variants against the contract
   (both files are already in the program via `tsconfig.json:45-54`); without it, CI must run
   `gen demo && tsc` and `gen server && tsc` or drift is invisible.
5. **A seam unit test that could not exist before.** `tests/unit/runtime-target.test.ts` importing
   `@/runtime/target` under `vitest.config.mts:13` `environment: "node"`: assert the demo mutations
   round-trip against the seed clone (`readDemoAdultPortalState()` → `:346-356`) and that the bridges
   are Node-safe (`adult-portal-demo-client.ts` only touches `window` through the store's guarded
   `read`/`write` at `:347,359`). This answers `NOTE-00 §7.3`: it works, and it is the concrete
   payoff that a `@runtime/*` alias never delivered. Do **not** import the readers/server actions
   without a `server-only` stub alias (Config table, vitest row).
6. **The R1 spike, as its own gate:** wire `target.server.ts` first, run `npm run build:server`,
   assert gate 1's `=== 17`, then in `npm run dev` submit one `AdultPortalForm` and confirm the
   mutation persists and `revalidatePath` refreshes the list. If this fails, stop and redesign.
7. **`npm run check` after touching the generated files while they are absent** (delete them and
   confirm `typecheck` fails loudly, `test` does *not*, and `format:check`/`lint` stay green) — a
   deliberate negative test of the detection asymmetry in requirement 5.

---

## Alternatives considered

| # | Design | E625 | Cost | Simpler than §3.1 Design 1? |
| :-- | :-- | :-- | :-- | :-- |
| **a** | **One surviving alias** `@runtime/target` → variant, in `next.config.ts:43-79` only, both variants `satisfies` the contract | ✅ same reachability property | Zero new build hygiene: no absent/stale/committed file, no prettier/lint interaction, works with `next dev` invoked directly, no `.gitignore` change. Loses: vitest/editor resolution of the seam (`vitest.config.mts:5-11` would need an alias — 4 lines, one time), and §7.2's literal wording. Note the reverse trick is *not* safe: putting the swap in `tsconfig.json:paths` alone would still switch the bundle (Turbopack reads `paths`, `08-turbopack.md:113`) but re-creates the untyped split-brain. | **Comparable, slightly simpler to operate, slightly harder to test.** `NOTE-00 §4` scored `tsc` "No" for both, which is right, and its "vitest free" row survives (see gate 5). If the team's real pain is "no test exercises the swap", the generated file wins on that axis alone. |
| **b** | Conditional `import()` with `/* turbopackIgnore: true */` | ✅ the ignored specifier is not bundled | `08-turbopack.md:135` + `lazy-loading.md:181-193`: the comment *leaves the import expression as-is*, i.e. resolution happens at runtime in a context where the module does not exist on a static host; and magic comments "do not work with static `import`" so the readers (called from `generateStaticParams`, synchronously at `turmas/[id]/page.tsx:11-13`) cannot use it. Untypechecked at the call site against `tsconfig.json:8-10` `strict`+`noUncheckedIndexedAccess`. | **No.** Strictly worse; only the "make the other variant invisible to the graph" trick is shared. |
| **c** | **Dedicated static entry / two route trees** (`docs/implementation/v1-architecture-plan.md:69-71`) | ✅ by construction — the demo tree never references a `"use server"` module | Removes module-resolution switching entirely (each page file imports its own variant by relative path); no generated file, no alias. Cost: 11 more page/layout files (one per seam-consuming route), duplicated `generateStaticParams` and metadata, and it multiplies the tree §2 is trying to shrink; the 12 client components stay shared. | **No for this sprint.** Right long-term shape if the demo ever grows its own IA; Day 1-2 never budgets it, and it does not remove the need for a *client-side* seam for the 16 client mutations. |
| **d** | **All mutations become client-side `POST`s to route handlers; drop `"use server"` entirely** | ✅ vacuously — 0 action ids exist in either target | Verifies as impossible **for the demo**: `output:'export'` drops route handlers (`export/index.js:249-257`; `.next/server/app-paths-manifest.json` shows `/api/v1/player/state/route`, and `isAppPageRoute()` requires `/page`), and GitHub Pages serves only static files (`deploy.yml:30-39`), so a demo `POST /api/v1/...` 405s/404s. The demo therefore still needs an in-browser transport, i.e. the same seam one layer down (fetch vs function call). It *is* what the player path already does (`game-host.tsx:288-302` + `runtime/game-offline-sync.ts` transport, with `components/public/demo-game-adapter.tsx` as the browser-side fake). Real cost: 15 mutations × (handler + validation + session/CSRF re-check + `revalidatePath` → manual `refresh()` from `next/cache`), losing the `(previous, formData)` + no-JS-submit ergonomics that `AdultPortalForm` depends on today. | **No.** Unifies the transport, not the seam, and re-implements 24 handlers for a property the generated file gets for free. |
| **e** | **Drop static export; deliver the demo from a server** (e.g. a per-branch preview with `output:'standalone'` and demo env) | ✅ the gate is never reached (`export/index.js:360` requires `output === 'export'`) | Eliminates E625 *and* R5's seeded-routes-only limitation and the hydration/404 story in one stroke, but forfeits the product commitment "GitHub Pages demo" (`PRODUCT.md`, `deploy.yml`, `next.config.ts:28` `basePath:'/SMS_Portal'`), and the demo would then need a real backend or a client-side fake anyway. | **No** as a plan item — but it is the honest answer to "is the static-export constraint worth its cost?", and belongs to the product owner, not the refactor. |

**Honest bottom line:** Design 1 is the right pick, and the corpus's argument for it (a graph-membership
gate cannot be dodged by props or ternaries) holds — I could not construct a legal alternative that
keeps §7.2 and §7.5 simultaneously. What the plan is missing is not a different design but three
mechanical specifics: the seam must be **contract-annotated rather than `export *`**, it must be
**two generated files rather than one** (server-only readers), and the **wrong-mode server build must
be gated** because nothing catches it. Plus one unproven assumption (R1) that should be spent as a
Day-2 spike before the alias deletion, not discovered on Day 4.

---

## Open questions

1. **R1 / barrel re-export.** Does a server reference survive `target.ts → target.server.ts →
   "use server" file` in Turbopack 16.3.2, in *both* layers (RSC bind at `entrar/page.tsx:73` and
   client `formAction` at `player-access-workflow.tsx:151`)? If not, which fallback is acceptable:
   per-mode generated *implementation* files (no barrel), or one surviving alias (option a)?
   Not answerable without running a build.
2. **Tree shaking.** Does `turbopackInferModuleSideEffects` (`config-shared.d.ts:1813`) in fact prune
   an unused reader re-export out of a client entry, making a single merged `target.ts` viable? Even
   if a probe shows it does, requirement 2 recommends not relying on it; the question is whether to
   *test* that assumption (a deliberate `readers.server.ts` import from a client component to confirm
   the build fails) or simply enforce it with `server-only` as recommended.
3. **Server-action arity in the contract.** `signInAction(formData)` must be `(formData: FormData) =>
   Promise<void>` on the server, but the demo cannot navigate from an event handler
   (`redirect.md:54`). Accept "the demo variant is a no-op and `sign-in-form.tsx` owns the `<Link>`"
   (keeps the mode branch, kills `demo-auth-actions.ts`), or widen the contract to
   `Promise<{ navigateTo?: string }>` and have the client navigate in both modes (kills the branch,
   but changes the server action's response shape and gives up the no-JS submit at
   `entrar/page.tsx:73`)? Product call, not a technical one.
4. **Manifest count baseline drift.** Gate 1 asserts `17`. Is the Day-2 assertion `== N` (brittle
   across §2's purge and any action added later) or `> 0` (robust, weaker)? Recommend `> 0` for
   `build:server` plus a printed count, and `== 0` for demo.
5. **Where does `readers.demo.ts` get its "server-only" property documented?** It is the first module
   in this repo where a *demo* file carries `import "server-only"`; it reads as a contradiction unless
   the file header explains that demo reads happen in the prerender Node context
   (`adult-portal-demo-store.ts:347`).
6. **Dev ergonomics.** Should `scripts/next-target.mjs` refuse to overwrite a `target.ts` whose
   `TARGET_MODE` differs from the requested target while another `next dev` holds `.next`/
   `.next-demo-dev`? (R3's dev-side analogue.) Or is "one working copy, one target" a documented rule?
7. **CI shape.** There is no `.github/workflows/ci.yml` yet (only `deploy.yml`). Should the typecheck
   job generate the seam for *both* modes and run `tsc` twice, or rely on requirement 2's parity file
   and run once? The parity file makes one run sufficient; without it, twice is mandatory.
