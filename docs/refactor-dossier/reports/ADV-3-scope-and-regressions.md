# ADV-3 — Scope, silent regressions, and what to cut

**Agent:** ADV-3 (final adversarial filter before the dossier is written)
**Date:** 23 September 2026 · **Baseline:** `main` = `origin/main` = `e5aaf1e`, `git status --short` → `?? docs/refactor-dossier/`
**Target:** the consolidated P1..P4 approach (12 reports) as it would be written into the implementation dossier.
**Mandate:** over-engineering, missed regressions, deletable scope. Not a re-verification of `VER-*` measurements except where I say "I re-measured".

**Commands run (all read-only against the repo):** `git log/status/ls-files/rev-parse`, `wc`/`grep`/`find`/`ls`,
`npx prettier --check .`, `npx tsc -p tsconfig.json --noEmit --incremental false --listFilesOnly`,
`npx vitest run` (default and `--no-isolate --fileParallelism=false`), `npx vitest run --reporter=json`,
`npx prisma validate --schema <copy outside repo>`, `npx prisma migrate diff --from-schema/--to-schema --script [--exit-code]`
(scratch schemas in `%TEMP%/adv3`, `prisma/schema.prisma` untouched), one `WebFetch` of the live Pages URL,
and three own-method node censuses (CSS rule/class liveness, primitives-mixing, `styles.X` phantom detection).
**Nothing under `src/ tests/ out/ .next/ prisma/` was created, modified or deleted. No build, no `prisma generate`, no DB connection.**

---

## Headline verdict

**The plan's P1 and P0 are sound and I would not touch them. The dossier's biggest problem is P3, and the biggest single
cut available is the §4.1 CSS split and the §4.2 offline split — two work packages that are the only parts of the sprint
that can silently destroy user-visible behavior, that both manufacture new §7.1 violations, and whose measurable benefit
is negative by the plan's own budget.**

Three findings drive that:

1. **`VER-E`'s own extraction rule breaks the QR print flow, and I can name the exact mechanism.** CSS-module class names
   are hashed *per file*. `@media print` (`portal.module.css:4355-4391`) contains a classless rule
   (`:global(body) > * { visibility: hidden }` at `:4356`) plus `.printSheet` / `.credentialPrintCard` rules whose sole
   owner is `player-credential-print-sheet.tsx`. "Assign each rule to its live driver class, classless rules to the
   residual shell" — which is `VER-E`'s stated method — puts the blanket-hide in `portal.module.css` and the sheet's
   base rules in `player-access.module.css`. If the `@media print` block does not travel as one indivisible unit with
   **both** `.printSheet` and `.credentialPrintCard`, the block's selectors reference a hash that no element carries:
   everything is hidden, nothing is re-shown, **the printed output is a blank page** — and `tsc`, `eslint`, `vitest`,
   `prettier`, `build:demo` and the `out/` page count are all green. This is not a hypothetical mid-tier risk; it is what
   the plan's own algorithm produces if nobody overrides it.
2. **The `mobileNavItem`/`desktopNavItem` defect is pre-existing, not created by the split — and the split's remediation
   is the dangerous part.** Verified below.
3. **I measured the true blast radius of the primitives extraction: 47 rules** in `portal.module.css` mention ≥2 classes
   where one is in the plan's primitives set and one is not (18 of them inside `@media`). That is the number that decides
   whether the extraction is worth doing in a 3–4 day sprint. `VER-E` projected the result at ~860 (primitives) and ~836
   (residual) lines — both still failing the plan's own 600-line CSS ceiling. **You can spend the sprint's largest single
   work package and end with two files that still violate the criterion that motivated it.**

---

## Missed-regression register

Columns: **behavior** | **phase that breaks it** | **manual check (route + expected result)** | **automated assertion?**
Every "no" below is a hole the dossier must either close with a gate or close with a named manual check.

### R1 — QR credential print (blank page) · *created by P3d*

| | |
| :-- | :-- |
| **Behavior** | `player-credential-print-sheet.tsx:93-108` clears `data-player-print-active` from all `[data-player-print-sheet]` nodes, sets it on the clicked sheet, registers a one-shot `afterprint` remover, then `window.print()`. `@media print` (`portal.module.css:4355-4391`, 6 rules) does the rest: hide `body > *`, re-show `.printSheet, .printSheet *`, `display:none` for `.printSheet:not([data-player-print-active])`, 2-up grid at `:4369-4379`, `122mm` card + `58mm` QR at `:4381-4390`. |
| **Phase that breaks it** | **P3d** (§4.1 CSS modularization). Not P1 (the print family has zero purge-dead classes — all 6 `@media print` rules are live, `VER-E` #21). Also broken by renaming the attribute in the TSX, or by moving `.printSheet` alone. |
| **Manual check** | `build:demo` → serve `out/` → `/SMS_Portal/portal/turmas/demo-turma-3a/` → "Gerar credenciais" → in the issued batch, DevTools → Rendering → Emulate CSS media type **print**: expected = exactly one sheet visible, 2 columns, QR ≈58 mm, page chrome gone. Then Ctrl+P **without** clicking the print button: expected = **nothing** (`:not([data-player-print-active])`), i.e. the attribute gate must fail closed, not open. Then physical print or PDF from Chrome on a 3-credential batch: expected = 2 pages, no sidebar, no buttons, `DEMONSTRAÇÃO • SEM VALIDADE EM PRODUÇÃO` present (`runtimeMode === "demo"` branch at `:137-141`). Must be run against the **Pages-shaped build with `/SMS_Portal`**, not `dev:demo` (`VER-F`: dev has no basePath and runs the proxy). |
| **Automated?** | **No.** The one existing test, `tests/unit/player-credential-printing.test.ts`, covers the *data* helper (`cardsForPlayerCredentialBatch`), not the attribute flip and not one CSS assertion. **Fixable without a browser** — see the oracle below. |

**The gate to write (browser-free, ~30 lines, node-only):** a *cross-file selector integrity* oracle. Parse every
`src/**/*.module.css`, build `class → set(files that define it)` and `class → set(files that select it)`, and **fail if
any selector in file F uses a class that F does not define**. Rationale: because CSS Modules rewrites `.x` per file,
a selector in F naming a class defined only in G can never match — it is dead by construction. Today this is **green**
(my census: the only undefined class reachable from a selector is `mobileNavItem`, which is *referenced* from TS, not
from CSS). It goes red the moment the split misplaces `.printSheet` from `@media print`, `.demoRoleControls + .navigation`
(`:3555`, `:4897`), `.teamTable .tableHeader` (`:2286`, `:2511`, `:4241`, `:4264-4279`), `.issuedCredentialsHeader
.buttonSecondary` (`:4350`), or any of the 47 primitives-mixing rules. This is the single highest-value cheap gate in the
whole dossier and **nobody in 13 reports proposed it.** Pair it with two 3-line assertions: (a) `@media print` exists in
the same file as `.printSheet` **and** `.credentialPrintCard`; (b) the literal `data-player-print-active` appears in both
that stylesheet and a single exported constant used by the TSX (today the string is hardcoded three times:
`:99`, `:101`, and the CSS).

### R2 — Mobile vs desktop nav · **pre-existing**, and the split's fix can erase the intent

Verified independently:

- `portal-navigation.tsx:37` is `` className={`${styles.navLink} ${current ? styles.navLinkActive : ""} ${item.mobile ? styles.mobileNavItem : styles.desktopNavItem}`} ``.
- `grep -rn mobileNavItem --include=*.css src` → **0 hits in all 7 stylesheets** (my run; `VER-E` #11 same). `.desktopNavItem`
  exists exactly once, at `portal.module.css:2538`, inside `@media (max-width: 900px) { display: none }`.
- **Every** nav item in **both** runtimes carries `mobile: true`: `service.ts:146,155,161,171,177,186,192` (7) and the demo
  rebuild `portal-navigation.tsx:66,75,81,89,109,115,123` (7). So the false arm never runs.
- Empirical: `grep -rl 'class="[^"]*undefined' out --include='*.html'` → **45 of 104 documents**, e.g.
  `class="portal-module__1g8gFq__navLink  undefined"`. **Committed artifact, HEAD, today.**

**Verdict: pre-existing bug, present in the published site. The CSS split does not create it.** Consequences that *do*
belong to the split: (a) `desktopNavItem` looks deletable (its only reference is a never-taken branch) — deleting it
deletes the last trace of an intended mobile-only/desktop-only nav concept; (b) `:2535-2540` is one of the 19 surgery
rules (`.sidebar > .brand, .sidebarProfile, .adminNavGroup .navLabel, .desktopNavItem`), so the split must touch it
anyway; (c) `ADV-1`'s `class="… undefined"` gate goes **green** if you just delete the ternary, so the gate cannot tell
"fixed" from "concept silently dropped". Note the mobile design is *already* delivered by other rules in the same media
query (`:2526-2533` sidebar → 74 px bottom bar; `:2562-2571` `.navLink` → 4-column icon grid; `:2535-2537`, `:2600-2602`
hide brand/profile/help text), so nothing visual changes either way today.

**Remediation (do this, not the obvious thing):** delete the ternary's `mobile` arm **and** the `.desktopNavItem` rule
**and** the `mobile` field from `NavItem`/`NavigationItemDto`, in one commit, with a written note in the commit body that
the per-item desktop/mobile split was inert since the class never existed; open one product ticket asking whether any
item should be desktop-only. Two mechanical consequences to fold into the CSS work rather than discover later: the
`@media (max-width: 900px)` group at `:2535-2540` (`.sidebar > .brand, .sidebarProfile, .adminNavGroup .navLabel,
.desktopNavItem`) loses one of its four alternatives and is already one of the 19 surgery rules (`.adminNavGroup` has
zero `styles.` consumers per `VER-A`, so that alternative goes too); and `VER-E`'s "170 live-by-grep" count includes
`desktopNavItem`, so the census must be re-taken after the fix or the removable-class total is one too high. Manual check
at 375 px: `/SMS_Portal/portal/` → bottom bar with the same item set as desktop, active item highlighted, no literal
`undefined` in the DOM. **Do not invent a `.mobileNavItem` rule** — that adds styling that has never existed and is a
visual change disguised as a fix.

### R3 — Demo role switcher, "Restaurar demo", and the hydration flash · *P3c/P3d*

`use-demo-portal.ts:8-22`: `useState(null)` + `useEffect(sync)` → **first client render always sees `null`**, so every
demo page paints the *server-seed* identity/nav/scope and then swaps to the *localStorage* profile. Three components
subscribe independently (`portal-navigation.tsx:55`, `portal-shell-context.tsx:28,53,68`), so the swap is not atomic:
for one frame the topbar scope and the sidebar nav can disagree.

**P3d hazard:** the switcher's CSS is a *move-unit* with an adjacency rule — `.demoRoleControls + .navigation` at
`:3555` and again inside a media query at `:4897`, plus `:3501-3545`. `VER-E` hazard 7 already shows this family was
omitted from `INV-E`'s residual list. Split `demoRoleControls` (demo-owned) from `navigation` (shell-owned) and the
layout below the switcher collapses on every demo page — visible to a stakeholder in the first five seconds of the
demo, invisible to every gate.

**Extra defect I found that P3c must not "unify":** `portal-shell-context.tsx:34` reads
`const role = demo ? demoRole(demo) : shell.effectiveRole;` — it checks the *presence of demo state* but **not**
`runtimeMode`, unlike `:30` and `:55` which check `runtimeMode === "demo" && demo`. The only thing keeping production
clean today is that the server alias target returns `null` unconditionally
(`adult-portal-server-client.ts:3-5`). That is the same asymmetry `VER-B` drift axis **A2** describes
(`DemoAdultPortalState` vs `… | null`). If P2a's `contracts.ts` unifies the two signatures in the wrong direction, or
if `readers.demo.ts` is ever reachable from the hosted build, **a production teacher sees a "Restaurar demo" button and a
demo-derived role**. `tsc` cannot see it (demo-variant typecheck is green, `VER-B` #17), `vitest` cannot (node env,
demo-only), lint cannot. Manual check after P2a **and after P2b**: hosted build → `/entrar` (server mode) → real sign-in
→ expected: no demo role strip in the sidebar, no `Restaurar demo`, and the role line equals
`Administrador da plataforma` / `Administrador da organização` / `Professor` from `shell.effectiveRole`.
**Automated:** none. Cheap fix worth taking now: add `runtimeMode === "demo" &&` at `:34` (one token, closes a
defense-in-depth gap independently of the seam).

**Preserve, do not "simplify":** `use-demo-portal.ts:14` (`adult-portal-demo-change` CustomEvent) is same-tab only;
`:15` (`storage`) is what actually crosses tabs. The plan's §3.3 "multi-tab syncing" line points at the wrong one
(`CRITIQUE` §4.5). Manual check: two tabs of `/SMS_Portal/portal/`, switch profile in one → the other's sidebar identity
and nav update within one event loop without reload.

### R4 — Deep links to demo-created entities · *pre-existing; P1 makes it worse in kind, not degree*

- Already false today: `out/404.html` (7,277 B, "Página não encontrada") is what GitHub Pages serves for any path it has
  no document for, and created entities get ids `demo-<kind>-<uuid>` (`adult-portal-demo-store.ts:334-341`) which
  `generateStaticParams` can never enumerate. `REFACTOR_PLAN.md:143` ("falls back to the `/portal/turmas` list") is wrong.
- **New with P1:** `/atividade/[token]` is **52 of the 104 currently-published documents**. I verified the live site:
  `https://niciniv.github.io/SMS_Portal/atividade/7FQ-29M/` returns **HTTP 200** today with an access-link launch page —
  and that exact URL is *published in this repo* at `walkthrough.md:11`. After the purge it serves `404.html`.
  Under `output: 'export'` there is **no** redirect primitive (`VER-A` R5: no `redirects()`, no `_redirects` — and Pages
  ignores it anyway; `public/` holds only `.gitkeep .nojekyll favicon.ico icon.svg`). And no shim could preserve the
  links anyway: their backing table is `DROP TABLE access_links` in migration 6.
- **Also nobody owns it:** `/portal/resultados/**` reads `demoAdultPortalSeed` (`game-events-demo.ts:11-14`), never
  `readDemoAdultPortalState()`, and `results-screen.tsx:1` is a Server Component → demo-created rows are invisible in
  results **in memory**, not just after refresh. No phase in P1..P4 fixes this and no report says §7.5 will therefore
  ship false. See §Behavior-change vs declared-preservation B6.

### R5 — Sign-in / sign-out becoming Client Components · *P2b*

`entrar/page.tsx` is a **synchronous** Server Component that branches at `:10-12` on `getRuntimeMode()`:
demo renders read-only inputs + `<Link href="/portal">Entrar na demonstração` (`:73` region); server renders
`<form action={signInAction}>` with `name="email"`/`name="password"`. `portal-shell.tsx:59-77` is the same shape for
sign-out (`<Link href="/entrar" aria-label="Sair do portal" className={styles.logoutButton}>` vs
`<form action={signOutAction}>`).

- **No-JS submission:** already broken today in the hosted build (a React form action with no `method` degrades to a GET
  to the current URL and no server handling). P2b **must not be sold as fixing it**, and cannot be fixed
  unilaterally: React forbids `method`/`encType` alongside a function action (`VER-B` #12/#15). Manual check: hosted
  build, DevTools → disable JavaScript → `/entrar` → submit → expected: unchanged behavior (fails) — if the check shows
  a *different* failure (e.g. no form in the HTML at all), the conversion moved the branch into a client-only path.
- **basePath:** `VER-B` #15 confirmed `<form method="get" action="/portal/">` would bypass `/SMS_Portal` and 404 on
  Pages. Add: `router.push("/portal")` from `next/navigation` **does** apply basePath, so the client-handler variant is
  safe — say so, or an implementer will over-avoid and leave a `<Link>` where a button was specified.
- **Prerender diff:** the assertion to keep is `out/entrar/index.html` has **0 `<form` tags** and the literal
  `Entrar na demonstração` (both true today; I confirmed the demo branch is a `Link`). If P2b-i converts the *demo*
  half into a client form, the demo's sign-in becomes JS-dependent markup that used to be static — that is a
  user-visible regression on the entry point of the whole demo.
- **Neon Auth external redirect:** `entrar/actions.ts` calls `redirect()` at `:21,25,29,34,37` and the demo twin
  **throws** (`demo-auth-actions.ts:2,6`). `redirect()` is illegal in a client event handler (`VER-B` #14), so the
  runtimeMode branch is permanent. Anyone "unifying" the two actions produces a demo that throws on submit.
- **CSS:** the two new owner files move `styles.logoutButton` (from `portal.module.css`) and 12 classes from
  `marketing.module.css` (688 lines, a §7.1 CSS FAIL that §4.1's title never names). `ADV-1` row 3/12 is right; the
  consequence is that P2b-i **must** precede the CSS owner map, which `VER-E`'s numbers do not yet reflect.

### R6 — Credential redaction asymmetry · *revealed, not caused, by P1*

`logger.ts:3-20` is the pino `redact.paths` list; `:11-12` are `"activityToken"`, `"attemptToken"`. I confirmed:

- Both keys are Generation-A URL params; every consumer is in the §2 deletion set. Post-purge they are dead config.
- **`cred` is not in the list.** But the leak is *not* live: `src/server/http/route.ts:20-24` logs only
  `request.nextUrl.pathname`, not `search`; the only other logger call site in the repo is
  `portal/atividades/actions.ts:202/212`, deleted by §2.2; `src/proxy.ts` logs nothing. So **P1 does not make this
  worse — it reveals stale redaction config next to a live bearer-in-URL flow** (`player-credential-print-sheet.tsx:23`).
- The **real** unguarded invariant is that pino `redact` never masks secrets *inside* message strings. A single future
  change from `path: request.nextUrl.pathname` to `url: request.nextUrl.href`, or an `Error` whose message embeds
  `?cred=…`, writes live player credentials into stdout/Logtail and **no test, lint rule or type can object**. Note the
  credential-bearing routes are POST-only (`grep 'export.*GET' src/app/**/route.ts` → 0, `VER-F` D10), so today nothing
  even touches a query string server-side.
- The *other* live exposure — `Referer` leakage of `?cred=` into the cross-origin GameMaker iframe — is held shut by
  `proxy.ts:112-118`'s `no-referrer` branch on `/jogar`, which §2.1.3's `:109-116` range would delete
  (`VER-A` §5.2, `TS1128` + live security regression). That one is a **P1-created** regression and is already
  correctly blocked; keep the line-113-only edit and add a manual check: `/jogar/?cred=demo_player_seed_third_a_01_active`
  → DevTools Network → the iframe request to the game client must carry **no** `Referer`.
- Action for the dossier: delete `:11-12`, add `"cred"`, and write the two-line test that pins `withHttpContext` to
  pathname-only logging. Cost: 10 minutes. This is the cheapest security item in the sprint and it is currently unowned.

### R7 — Day-1 typecheck poisoned by build artifacts · *P1; remedy is half-wrong in ADV-1*

I reproduced `ADV-1`'s finding exactly and then found the part it missed.

- Program is 1,706 files (`tsc --noEmit --incremental false --listFilesOnly`), of which **12 come from three artifact
  dirs**: `.next/types/`, `.next/dev/types/`, `.next-demo-dev/dev/types/` × {`cache-life.d.ts`, `root-params.d.ts`,
  `routes.d.ts`, `validator.ts`} — plus `next-env.d.ts`.
- Each `validator.ts` is **448 lines with 44 `typeof import(` refs, 20 of which name §2.2 purge targets** (e.g.
  `typeof import("../../src/app/(professional)/portal/admin/auditoria/page.js")`) → up to **60 false `TS2307`s** on any
  machine that has ever run a build. `VER-A`'s headline "exactly one tsc error" was run in scratch trees **without
  `.next`** — it proves the fresh-clone shape only.
- **Correct remedy: delete the caches *and* exclude them *and* re-run a build — in that order.**
  (a) `rm -rf .next .next-demo-dev .next-demo-build` before Day 1's typecheck: they are pure build output and Next
  regenerates them from the current tree on the next `dev`/`build`. Regeneration alone is not enough because Day 1's
  gate *is* the typecheck, and (b) `exclude: ["node_modules", ".next", ".next-demo-dev", ".next-demo-build"]` is what
  makes it permanent and fixes the CI-vs-local asymmetry. Do **not** try to "regenerate without deleting" — Next writes
  `validator.ts` per route set only during a build, which is exactly the step the purge has to prove.
- **What `ADV-1` (and `VER-F` D6) missed:** `next-env.d.ts:3-4` — a **tracked** file — contains
  `import "./.next/types/routes.d.ts"` and `import "./.next/types/root-params.d.ts"`. An `exclude` entry does not
  remove an imported file from the program. So `.next/types/routes.d.ts` is **un-excludable**, and it holds the full
  37-entry `AppRoutes` string union (`:4`) including `/portal/atividades`, `/portal/materiais/nova`,
  `/atividade/[token]`. Consequence, and it is the *opposite* direction from `ADV-1`'s alarm: after the purge, a stale
  `routes.d.ts` keeps deleted routes **type-valid**, so `href="/portal/atividades"` on a surviving page compiles green
  and 404s on Pages. `tsc` can therefore *never* be the dead-link gate. I verified the good news independently: no
  surviving file and no surviving prerendered document links into the deletion set
  (`grep -rnE 'href=\{?["`]/(portal/(atividades|materiais|modulos|admin/(jogos|modulos|auditoria))|atividade)' src`
  → hits only inside §2.2/§2.3 files; the same grep over `out/*.html` outside the deleted trees → **0**). So the purge
  is clean today; the *protection* must come from a link check over `out/`, which is in `ADV-1`'s P4 list and should be
  promoted to P0 so it runs from Day 1.
- **Other generated-type directories with the same problem: none.** `.next/standalone/node_modules/**` holds two `.ts`
  files (sonic-boom, thread-stream) and they are **not** in the program (TypeScript's implicit `node_modules` exclusion
  applies at any depth) — confirmed against the 1,706-file list. `src/generated/prisma` is a different class of the same
  disease: 24 files in the program, still containing `AccessLink.ts` / `CapabilityAssignment.ts` / `RateLimitBucket.ts`
  (4,424 lines) until `prisma generate` runs, all `@ts-nocheck` so they cannot error, and they are exactly why
  `prisma generate` must precede `typecheck` (C19's stale-client window). §3.2's `exclude` of `src/generated` closes it.

### R8 — Offline-sync split hazards that no gate sees · *P3a*

Registering these because they are the price of doing §4.2 this sprint, not because they change my recommendation:

| Behavior | Phase | Manual check | Automated? |
| :-- | :-- | :-- | :-- |
| A DB rename or version bump with `onupgradeneeded`'s `if (!contains)` guards and **no `oldVersion` handling anywhere in the file** strands existing rows *silently* — but only when the version moves; a pure rename without a bump throws `NotFoundError` loudly (`VER-D` 2a) | P3a (moves `DATABASE_NAME`/version across files) | Server mode only; **cannot be exercised** (no DB has ever existed, audit R1) | No. Mitigation is structural: one exported `const` in one leaf file + a comment. `T1` "freeze" test proposed by `INV-D` is correct. |
| `transact` resolves only at `oncomplete` (`:1204-1210`); eager resolve would ack a "saved" that never committed. `INV-D`'s own `T2(c)/(d)` assert the *wrong* semantics (last-wins; fail-before-oncomplete aborts and rejects) → **T2 as written is born red on the unsplit file** (`VER-D` C5) | P3a | server-mode only | No — and the proposed test would have wasted an hour blaming `fake-indexeddb` |
| The pt-BR storage-unavailable copy (`:500` → `:375`, `openGameOfflineStore`) is user-visible and moves in step A7; `T1-T7` don't assert it | P3a | `/jogar` with DevTools → Application → clear IndexedDB + throw on open | No |
| `store.close()` (`:176-178`) and the port's optional `close?.()` (`:100`) have **zero call sites**; the lazy singleton lives for the tab (`game-host.tsx:125`). A new `offline/index.ts` that "tidies up" by closing on mount/unmount is a behavior change | P3a | long session with repeated sync | No |
| 46,032-byte dead chunk shipped to GitHub Pages (`out/jogar/index.html` → `0pvtinj9q2oay.js`, contains `missoes-caramelito-game-v1`) | untouched by all phases | bundle inspection | `VER-D`'s mode-boundary bundle gate (a) — **this is the part of §4.2 worth keeping** |

### R9 — Misc unregistered items worth one line each

- **`.statusWarning` / `.statusDanger`** lose their only *badge* consumer under E1 but stay grep-reachable via
  `"Convite pendente"` and `includes("bloquead")` (`VER-E` hazard 9). Do not delete those rules in P1's CSS sweep; delete
  them in P3d only after a data-level check.
- **`demo-action-button.tsx` (39 lines, 0 importers) is the only consumer of `.toast`** (`:33`). `ADV-1` §1 left the CSS
  census "pending a decision". **Decide it now: delete the file.** Then `.toast` + `toastIn` (`:2463-2493`, ~30 lines +
  keyframes) die cleanly and `VER-E`'s primitives list drops the `toast` family it otherwise had to carry.
- **`RATE_LIMITED`:** deleting it from `errors.ts:11` while
  `contracts/schemas/api-error.v1.schema.json:21` keeps it splits the TS union from the published wire vocabulary —
  and **no test loads either** (`VER-C` C14: the JSON is not in `contractSchemasV1` and lives outside the glob
  `tests/unit/v1-contracts.test.ts:32-38` reads; its only self-reference in the repo is its own `$id`). Observable
  consequence: none today; guaranteed drift tomorrow. See B4.
- **`AuditEvent` kept-but-writerless**: no page, no writer, no reader, no test, and `docs/schemas/database-model.md:49,50,52,86`
  still advertises the three dropped tables. `PRODUCT.md:139` claims "administrative traceability" is portal-owned.
  Nobody in P1..P4 owns either the doc or the product statement.

---

## Recommended reduced scope and deferred debt

Ranked against the plan's own declared goals (`REFACTOR_PLAN.md:6`: *"lean … codebase with a working demo ready in
3–4 days"*, plus modularity and separation of concerns).

### Ship in the sprint

| # | Work | One-line justification |
| :-- | :-- | :-- |
| 1 | **P0 in full**, exactly as `ADV-1` ordered it (`.prettierignore` first, `auth.test.ts` restore, `tsconfig` `exclude`, demo `distDir` for all phases, §7.1 tool + baseline allowlist, boundary lint via **core `no-restricted-imports`**, `typecheck:demo` + vitest `server-only` stub + `.tsx` include, `ci.yml` **last**). | It is the only work in the sprint that makes every later commit verifiable, and 8 of its 9 items are one-to-five lines. `ADV-1`'s ordering is correct and I re-verified both red legs (`prettier --check` → `REFACTOR_PLAN.md`; `vitest --no-isolate --fileParallelism=false` → 1 file failed, reproduced). |
| 2 | **P1 purge as two commits** (`status-badge.tsx` prettier form, then 46 files + `proxy.ts:113` only + the 8 schema deletions incl. `:97` + hand-authored 8-statement migration + `prisma validate → generate → rm -rf .next* → typecheck → lint → test`). | Proven by execution (`VER-A`), proven again by me for the schema blocker and the SQL. 7,802 lines and 4 of the 9 §7.1 FAILs for ~90 minutes of mechanical work. Highest value/risk ratio in the plan. |
| 3 | **Dead-CSS purge only**: 1,862 block-deletable lines, 19 selector-surgery rules, strict ordering *after* P1, with the cross-file selector oracle (R1) landed **before** the first CSS commit. | It is the only part of §4.1 that reduces a real number (4,910 → ~3,048) and it introduces **zero** cross-file selector hazards, because nothing moves between files. |
| 4 | **P2a** (`contracts.ts`, explicit named export lists, non-imported parity file, 5 sync demo readers → async, `listStatic*` left sync, `TARGET_MODE` assert inside function bodies). | Delivers 100 % of the seam's *actual* rationale (typecheck the demo half — `VER-F` established E625 is not failing), is purely additive, and can run in parallel with P1 (`ADV-1`). |
| 5 | **P2b-i**: the two Client Components (`sign-in-form.tsx`, `sign-out-button.tsx`), nothing else. | Small, changes CSS class ownership so it must precede the CSS dump, and retires the "any CC can reach a `"use server"` module" footgun. Assert `out/entrar/index.html` shape before/after. |
| 6 | **`portal/ajuda` content decision** (new; §Behavior-change B1) and the **`logger.ts` one-liner** (R6). | Both are user-visible product-surface items created/left by P1 and neither is in any phase. |
| 7 | **`game-host.tsx` 5-line protocol-version fix** (`demo-game-adapter.tsx:16-20` + the second hardcode at `game-host.tsx:652`) and **offline mode-boundary bundle gate** (`VER-D` item (a)). | The version fix is a real latent defect costing 5 lines; the bundle gate is a demo-relevant 46 KB win that needs no file moves. |
| 8 | **S6 — the pure dead-CSS deletion as its own commit**: fix the 45 prerendered `class="… undefined"` tokens (R2's nav ternary + `materials-explorer.tsx` leaving with P1), then delete the **149 removable classes / 1,862 block-deletable lines** (91 purge-dead + 58 never-referenced), handling the 19 surgery rules, all gated on the **class→component manifest** (R1's oracle + the `:3555`/`:4897`/`@media print` special cases). | It is the sprint's largest visible-output bug *and* its largest pure-deletion win, and both live entirely inside `portal.module.css` — no split required. I deliberately do **not** publish a narrower "delete only the `activity*`/`material*` styles" figure: my own family-scoped counts did not reproduce cleanly across two methods, whereas `VER-E`'s 149 / 1,862 / 19 triple has been produced by two independent parsers and my rule/class harvest confirms its inputs (696 rules, 319 classes, 149 removable). Take the verified whole set, not an unverified subset. |
| 9 | **Two node-only CSS gates in `ci.yml`**, written before any CSS commit: (a) cross-file selector integrity, (b) the `out/**/*.html` `undefined`-token assertion and link check. | ~40 lines of script total, no browser, no dependency; (a) is the only automated signal in the entire plan that can see a class-level regression, and (b) is already proven red-able today by `ADV-1`. |
| 10 | **Resolve the open deletion decisions** so the CSS census stops being conditional: delete `demo-action-button.tsx` (39 lines, 0 importers → `.toast` + `toastIn`, ~30 CSS lines) and keep `base-url.ts` / `getGameClientUrl` / `createGameLaunchUrl` out or in, in writing. | `ADV-1` §1 flagged that "the closed manifest" is pending a yes/no that moves `VER-E`'s numbers; a dossier cannot ship a census that depends on an unmade call. |

### Cut from the sprint — strongest case for not doing it now

| Item | Strongest case against | Verdict |
| :-- | :-- | :-- |
| **§4.1 primitives.module.css + 4 per-screen CSS modules** | (i) 47 rules mix a primitives class with a non-primitives class, 18 inside `@media` — the extraction is what *creates* the silent-breakage class in R1/R3; (ii) `VER-E`'s own strict partition projects `primitives` ≈860 and residual ≈836 lines, i.e. **both still fail §7.1's 600 CSS ceiling**, so the package cannot be accepted against the criterion it serves; (iii) it manufactures new WARNs (`player-access` 527, `portal-loading` 420) and a 46-line `overview-screen.module.css` nobody needs; (iv) `composes` has **zero** precedent in 7 stylesheets and needs its own spike under Turbopack; (v) the visual payoff is invisible to every stakeholder check on Day 4. | **CUT.** Ship the purge (item 3) and stop. |
| **§4.2 `game-offline-sync.ts` → 7 files** | 2 importers, 11 of 16 names used, zero private-symbol coupling — so the split buys **readability only**. 665 of its 1,222 lines are untested and untestable without a new devDep; its failure modes are silent data stranding; it *creates* a §7.1 FAIL (`idb-store.ts` 657 > 500) and a fresh WARN; and the whole engine is dead in the demo and has never run against a database (R1). Doing it in a 3–4 day sprint means refactoring code you cannot execute, cannot test, and cannot deploy. | **CUT the move.** Keep: the version/name freeze to one leaf const, the `T1/T2(fixed)/T5/T6` characterization tests (**which `VER-D` proves need no `fake-indexeddb`**), the 5-line pt-BR-string assertion in T5, and the mode-boundary bundle gate. Reopen when a server-mode DB exists. |
| **§4.3 `game-host.tsx` decomposition (chrome + presenter, 932 → ~670)** | `VER-D` already refused the hooks half and I have no reason to revisit it. The remaining half is 262 lines out of a file **no phase plans to touch again**, requires ≥10 new props, must carry the 1,017-line `public.module.css` import (a §4.1 blind spot), sits behind a react-hooks rule set at severity 2 (`VER-D` 8b: `refs/purity/set-state-in-render/immutability` all `[2]`) so every step risks a lint-red it cannot explain, and the file's two live product defects (`H4` token-renewal race `:165-190`, `H5` `handleFrameLoad` partial reset `:817-823` — both verified by me) are **server-mode paths that no environment in existence exercises**. | **CUT from this sprint.** Keep the 5-line version fix; open H4/H5 as named behaviour tickets with the DOM-test precondition attached, per `ADV-1`. |
| **§3.1 step 5: delete the 9 `@runtime/*` aliases** (+ the generated-file half) | This is the only item I would **reverse** in the consensus. The 9 aliases are currently the repo's **only working structural fence** between the demo graph and the 5 `"use server"` modules; the demo manifest is already 0 ids and E625 already passes (`VER-F`). Deleting them replaces a build-graph fact with a lint rule + a `TARGET_MODE` assert, adds a gitignored-file hazard class with 7 documented failure modes (`VER-B`'s table), and its sole headline benefit — vitest can resolve the seam — needs three config changes that are cheaper than the generator and do not require the aliases to die. `NOTE-00` §4 concedes "the generated file is *not* required for E625 safety". | **DEFER.** Change §7.2's alias clause into "seam parity typechecks + boundary lint is on", and let the alias removal ride with the first sprint that actually runs a demo-target test. |
| **§4.4 shell view-model module** | Do the **narrow** version: `buildNavigation(role, activeMembershipOrganizationId)` into `src/application/adult-portal/` (pure, testable, and it deletes a genuinely **duplicated nav table** — 65 lines in `portal-navigation.tsx:60-125` plus `roleLabel` again at `portal-shell-context.tsx:10-16`), plus the 11-line `authorizationActor` dedupe from `player-access/service.ts:15-25`. **Skip** `buildRoleLabel`/`buildScopeLabel` unification: `service.ts:129-139` counts *organizations* while `adult-portal-helpers.ts:98-121` counts *classes* for teachers, so collapsing them changes visible Portuguese copy in the topbar (`"N turmas atribuídas"` → `"N organizações acessíveis"`). That is a product decision, not a refactor. | **REDUCE** to navigation + the guard dedupe. Prerequisite: 1 test for `buildNavigation` (today `getShell` has 0) and a golden-string test for whatever scope label you decide to keep. |
| **§6 Day 4 "assert no `api/` in `out/`"** | Cannot fail (`CRITIQUE` §1, `INV-F` O6). Replace with `app-path-routes-manifest.json` keys + the 26-document set decomposed in the CI comment + the link check + the `undefined`-class gate. | Already agreed; listed so the dossier does not resurrect it. |
| **A CI database + `migrate diff --from-migrations` drift gate** | Genuinely right eventually. Not this sprint: the key does not exist in `prisma.config.ts:6-11`, `--from-migrations` refuses to run without it (`VER-C` C10), and the property it protects (migration history reproduces the schema) has never been at risk because **no database has ever existed**. Do the **one-off local proof** instead: throwaway Docker Postgres 16, `DIRECT_URL=… npx prisma migrate deploy && … migrate status` on Day 1 — closes audit R1 in 10 minutes and gives you the first applied history in the project's life. | **DEFER the CI job; DO the local deploy once.** |

### Where the deferred debt gets recorded

1. **`docs/refactor-dossier/deferred-debt.md`** — one table, ≤14 rows, written *in the same PR that cuts each item*, with
   columns `item | why deferred | risk if never done | re-open trigger`. Rows: CSS primitives+screen modules; offline
   7-file move; game-host decomposition; `@runtime/*` alias removal + generated seam; `adult-portal-demo-store.ts`
   (1,024 FAIL, edited by §3.3 with no §4 owner); `public.module.css` (1,017) and `marketing.module.css` (688);
   `player-access-workflow.tsx` (540) and `team-screen.tsx` (411); `results.module.css` `.summaryCard` fork;
   `AuditEvent` (no writer, no UI); `RATE_LIMITED` + `api-error.v2` narrowing; `database-model.md` (7 documented tables
   vs 13 surviving models); `/health/*` docs that are already false (`VER-F` O2 — **not** purge-caused, so record it as
   pre-existing or Day 4 gets blamed); H4/H5.
2. **§7.1's budget list must ship with a named-exception column** (`P0.5`'s baseline allowlist is the mechanism). An
   unwired budget plus an undeclared exception is how every one of these becomes permanent.
3. **GitHub issues** for H4, H5, the nav desktop/mobile intent question, and the demo results-screen seed-vs-LiveState
   gap (R4). `ADV-1` is right that "refuse" without a ticket is how both become silent.

---

## Over-engineering flags

Judged against a present requirement that exists in *this* tree today, not a plausible next one.

| Proposed | Smaller intervention with the same effect | Verdict |
| :-- | :-- | :-- |
| **Two generated seam files (`target.ts`, `readers.ts`) + `contracts.ts` + parity file + `TARGET_MODE` marker + prerender assertions** | `contracts.ts` + explicit named export lists + the non-imported parity file + `typecheck:demo` + `no-restricted-imports`. This is exactly `ADV-1`'s P2a, and it is mechanism-neutral: `VER-B` #17 proves the mechanism adds **zero** discriminating power (whole `src/` graph against all nine demo variants = 0 errors either way). | Split it. The 5-item half is justified (present requirement: `tsconfig.json:24-42` pins the server variants, so the demo half is *never* typechecked). The 2 generated files serve **no** present requirement — E625 passes today. |
| **`TARGET_MODE` assert** | Keep it — but inside exported function bodies. At module scope it re-arms `VER-F` D1's order-dependence and would land as a fake bug in `mode.ts`. | Not over-engineering; 3 lines; it is the *only* gate for the one failure that can ship (`VER-B` #20). |
| **7-file `src/runtime/offline/` folder** | 0 file moves + 1 frozen `const` + 3 characterization tests. If a move is ever done, the natural cut is **2** files (engine vs IDB adapter), since `VER-D`'s own graph shows `canonical.ts` is a leaf and `errors.ts` is only needed to break one cycle. | Over-built. 7 files for a module with 2 importers and 11 used names. The extra 5 files each become new §7.1 surface. |
| **`primitives.module.css` + 4 screen modules (5 new files, 1 rewritten)** | Dead-CSS purge + the cross-file selector oracle. Requirement satisfied by the purge: 4,910 → ~3,048 and 91 purge-dead classes gone. | Over-built, and by the plan's own arithmetic the result still fails the plan's own budget. **This is the sprint's largest over-engineering item.** |
| **`shell-view-model.ts` as a new module with three builders** | One function (`buildNavigation`) in the existing `src/application/adult-portal/` folder; leave label helpers in `adult-portal-helpers.ts`, which already has a test file and is the repo's real convention. | Partly over-built. The duplicate nav table is a real defect; the label unification is a product change wearing a refactor's clothes. |
| **`migrate diff --from-migrations` + `datasource.shadowDatabaseUrl` + CI Postgres** | Hand-author 8 statements (I re-generated them: 23 lines, 4 `DROP CONSTRAINT` + 3 `DROP TABLE` + 1 `DROP TYPE`), eyeball them, add 5 greps, then one manual Docker `migrate deploy` to close R1. `ADJ-01` §3 already says 8 statements is small enough that eyeballing *is* the correct control. | The drift gate is the right long-term shape but it needs a config key, a service, and a resolved `VER-A`/`ADJ-01` contradiction. Out of a 4-day sprint. |
| **`eslint-plugin-import` (audit §8.5 boundary rules)** | Core `no-restricted-imports` with `patterns` — zero new packages, works on the *string*, which is exactly what a seam boundary is. | Avoidable dependency. Also flag: `eslint-plugin-boundaries` will mis-parse Next's `(professional)` / `(public-play)` group folders. |
| **`postcss`-based CSS oracle** | A 40-line brace-walk over raw text. `VER-E` proved one works (its 696-rule / 319-class counts are what I reproduced independently). | Minor — but see the dependency note: if you *do* use postcss, **declare it**; today it is transitive-only. |
| **`out/` "no `api/`" assertion; absolute page-count assertions** | `app-path-routes-manifest.json` keys + route-tree derivation, decomposed in the comment. | Already refuted by three reports; on the list only so the dossier doesn't re-adopt it. |
| **A separate `ci.yml` *and* branch protection *and* keeping `deploy.yml` independent** | One workflow: `verify` job → `build` (`needs: verify`) → `deploy` (`needs: build`). `ADV-1`'s strongest idea and it removes the repo-settings dependency for the `push: main` path. | Not over-engineering — the *opposite*: the corpus's version depends on a settings screen nobody can audit from the repo. History: 13 of 14 first-parent commits on `main` are direct pushes. |

**One caution against repeating `INV-E`'s error:** I audited the plan's *actual* §4.1 ask (primitives + 4 named screen
modules + residual shell = 6 files), not an inflated 12-file straw man. My objection stands on the plan's own numbers.

---

## Behavior change vs declared preservation

`REFACTOR_PLAN.md:6` declares "zero legacy backward-compatibility requirement"; §1.2 declares the purge a closed sweep.
Checked against `PRODUCT.md`, that covers *most* of it. These do not:

| # | Change | Declared? | Assessment |
| :-- | :-- | :-- | :-- |
| **B1** | **52 published `/atividade/*` URLs become 404**, including `https://niciniv.github.io/SMS_Portal/atividade/7FQ-29M/` which I confirmed is **live HTTP 200 right now** and which `walkthrough.md:11` publishes as the student viewer example. | Not declared. §2.2's reason column says "Legacy session-token entry. Replaced by `/jogar` + QR bearer credentials" — true of the *code*, silent about the *live site*. | **A product sunset, not a refactor.** No shim exists (R4) and none could work (the token table is dropped). Required: one paragraph in the Day-4 doc update, delete/redirect the `walkthrough.md:11` line, and a stakeholder sentence saying "the old QR cards you may have printed stop working on Day 1." |
| **B2** | `/portal/ajuda` (survives, linked from the topbar `Ajuda` on **every portal page**, `portal-shell.tsx:91`) describes four flows, ~3.5 of which the purge deletes: `Links de acesso`, `Status e validade` ("pause, reabra, encerre ou defina a expiração de um acesso"), `Acesso anônimo` ("o jogo abre pelo link personalizado"), and `Resultados coletivos` whose "sem identificar participantes" contradicts V1's numbered-slot reporting. | §2.1.3 says only "remove topics referencing deleted activity links". | **Under-specified to the point of a defect.** After the literal instruction the page still tells a teacher to do three things that no longer exist. Either rewrite all four topics or delete the page (it's already half-fake: every card's "Abrir orientação" is a `<span className={styles.textLink}>` with no href). Manual check: `/SMS_Portal/portal/ajuda/`. |
| **B3** | Materials, activities CMS, modules, shared access links. | Declared and **consistent with product truth**: `PRODUCT.md:115-119` defers Materials explicitly; `PRODUCT.md:143-153` gives "activities and minigames" to GameMaker and forbids the portal becoming "a game editor … or second source of truth". | Clean. No stakeholder demo surface lost that `PRODUCT.md` still claims. |
| **B4** | `RATE_LIMITED` removed from `errors.ts:11` **and/or** `contracts/schemas/api-error.v1.schema.json:21`. | §2.5.4 frames it as cleanup. | **It is a GameMaker-facing error-vocabulary change.** Verified: nothing loads the JSON (`VER-C` C14), 13 of 19 members have no emitter post-purge, and `apiErrorCodes` is a plain array with no `Record<ApiErrorCode,…>` map, so shrinking it compiles everywhere. Recommendation: touch **neither** on Day 1 (delete `RateLimitBucket` + `errors.ts:11` only if you also accept the split), and log the narrowing of all 13 dead members as one declared `api-error.v2` change. |
| **B5** | `AuditEvent` kept, writerless, with `/portal/admin/auditoria` deleted. | §2.5.5 keeps it "for future V1 administrative logging"; §2.2 deletes the page. | **Coherent as a code decision, unowned as a product claim.** `PRODUCT.md:139` lists "administrative traceability where required" under *Portal/backend owns*. From Day 1 there is no UI, no writer, no reader. `CRITIQUE` C7 is right that the dossier must record it "so nobody fixes the empty page later" — and additionally must state that **no compliance or traceability claim may be made** until V1 audit lands. Also `docs/schemas/database-model.md` still documents three dropped tables and calls itself current. |
| **B6** | §7.5 "fully operational demo … with local persistence". | Declared as a success criterion. | **The criterion is unachievable as worded and the sprint does not fix either cause**: created-entity deep links 404 (`generateStaticParams`), and `/portal/resultados/**` reads the seed not the live state so created rows are invisible even before refresh. Both are pre-existing; the refactor will be *reported* as meeting §7.5 unless the wording is corrected to "seeded routes only, in-app navigation, plus this manual checklist". `VER-F`'s (c)+(a) resolution is right. |
| **B7** | Deleting `.toast`/`.statusWarning`-adjacent CSS, or `desktopNavItem`, as "incidental" cleanups. | Not declared. | Each is invisible in `out/`. Rule to adopt: **a CSS deletion is only "dead" if a class is unreferenced by surviving TS *and* not reachable from a never-taken branch** (`desktopNavItem` passes the first and fails the second). |
| **B8** | §3.3 "hash demo tokens with `hashPlayerCredentialToken`". | Declared as a plan item, but **the plan cites a file that does not exist** (`demo-issuer.ts`; the code is `adult-portal-demo-store.ts:852/893` + `player-access-demo-actions.ts:36`). | **Implementable only with a different function.** `hashPlayerCredentialToken` is `createHash` from `node:crypto` (`src/server/security/player-credential-tokens.ts:1,12-14`) and the demo path executes **in the browser**. The demo half needs `crypto.subtle.digest` (async → `issueCredentials`/`resolveCredential` signature change) or a declared pure-JS SHA-256. Also: the demo's `resolveCredential(tokenHash)` matches on `tokenHash` and today's seed stores `token === tokenHash` for all four `DEMO_PLAYER_TOKENS`, so hashing at rest must keep the raw recoverable **at issue time only** (the print sheet already promises exactly that at `:86-88`), and `tests/unit/demo-player-access.test.ts:29,120-160` — which survives the purge and pins the seeded raw-token round trip — will go red and must be updated deliberately. **This is the one §3.3 line with a real chance of breaking the demo's QR flow, and the plan gives a filename that does not exist.** |

---

## Final publishable numbers

All re-measured by me at `e5aaf1e` unless marked `VER-*`. Where a dispute is definitional I publish both, labelled.
Where a `VER-*` number is wrong I say so — three are.

| Quantity | Publish | Definition | Command |
| :-- | :-- | :-- | :-- |
| **Purge volume** | **46 files / 7,802 physical lines** (§2.2 22/1,754 · §2.3 18/3,458 · §2.4 6/2,590); auditoria **73**, not the plan's 95 | Tracked files, physical newline-terminated lines, expansion of `REFACTOR_PLAN.md` §2.2 trees + §2.3 files + §2.4 files | `C1` below |
| **Purge share** | **29.25 % of handwritten TypeScript** · **22.94 % of handwritten code incl. CSS modules** · 22.75 % incl. root configs+scripts | Bases: handwritten TS in `src` + `tests` with `src/generated` excluded = **26,675** (20,096 + 6,579); + `src/**/*.css` 7,337 = **34,012**; + 283 lines of root configs/scripts = 34,295. The purge deletes **zero** CSS files, so 29.25 % is the like-for-like figure and the plan's "~29 %" is **right**; `VER-A` wins this dispute, and 22.9 % must always carry the words "including CSS in the base" | `C2` below |
| **Test count** | **33 files / 284 tests → 27 files / 182 tests** (−102, −35.9 %), **0 failures at baseline** | Measured by running the suite with a JSON reporter and summing `assertionResults`, not by arithmetic. Per-file: 56 + 24 + 13 + 5 + 2 + 2 = 102 | `npx vitest run --reporter=json --outputFile=…` then sum `testResults[].assertionResults[]` |
| **Exported documents** | **104 HTML → 26** (78 removed with §2.2) | Physical `*.html` under `out/` from the last demo build, and route-tree derivation (12 static docs + 11 `generateStaticParams` expansions + `_not-found` + `404/index.html` + `404.html` = 26). Never assert an absolute number without the derivation in the comment (`VER-F` O4) | `C3` below |
| **`portal.module.css`** | **4,910 lines / 696 rules / 319 distinct classes / 170 live∩defined / 149 removable / 1 phantom** | My own brace-walk + `styles.X` census over surviving importers reproduces `VER-E` digit-for-digit on rules (696), classes (319), dead (149) and the 27 shared. My live set is 171 because it includes `mobileNavItem`, which is *undefined* — i.e. live-by-grep, dead-by-render | `wc -l src/components/portal/portal.module.css`; see the census scripts in this report's method block |
| **Dead CSS (dispute 1,823 vs 1,862)** | Publish **both**: **1,823** = union of source lines of the **289** rules in which *every* selector class is dead; **1,862** = that plus the **7** "mixed" rules (**39** lines) that have a dead driver in every comma-alternative and therefore block-delete cleanly (296 rules). Residual **3,048**. Physical diff ≈2,158 with blank separators | Both `INV-E` and `VER-E` by postcss-walk and hand brace-walk; I did **not** reproduce the union independently (my crude span logic under-counts) so do not re-derive it — cite `VER-E` | rule-level: parse, keep rules with all classes ∉ live, union `[start,end]` |
| **The plan's 1,567** | **Superseded, do not publish.** | `VER-E` tried 13 methods and hit none; the plan's methodology is undocumented and its own baseline (4,910 / 68 tokens) matches HEAD, so it is not file drift | — |
| **Selector surgery (26 vs 19)** | Publish **19 rules / 122 lines** as the work; footnote **26 / 161** as `INV-E`'s looser definition ("counts any live class in any selector position") | `VER-E` #6 | as above, mixed set minus the 7 |
| **Shared classes** | **27** (≥2 surviving consumers) | Reproduced by me name-for-name: `field`5, `demoScopeNotice`5, `button`4, `input`4, `formError`4, `select`3, `textLink`3, `sectionHeader`3, `managementPanel`3, + 18 at 2 | `node` census over surviving `portal.module.css` importers, counting distinct files per `styles.X` |
| **Coupled rules (118 vs 24)** | Publish **three**, labelled: **118** = rules whose live classes are used by ≥2 surviving files (`VER-E` census); **24** = rules with ≥2 live classes and **no single surviving owner file** (`VER-E` actionable hazard); **47 = mine** = rules whose selector mentions ≥2 classes where ≥1 is in the plan's primitives candidate set and ≥1 is not (**18 inside `@media`**) — the *primitives-extraction* blast radius, and the number that should drive the §4.1 decision | My set: primitives list = `VER-E`'s corrected extraction row (30 families). Cross-check: my "≥2 class tokens" count is **119**, adjacent to `VER-E`'s 118 (one is a `@media` wrapper attribution edge case) | rule harvest + `PRIM` set membership, both in the method block above |
| **Untested offline lines** | **665 of 1,222 (54.4 %) physical** | Lines unreachable from `tests/unit/game-offline-sync.test.ts`'s 9 imported names with `MemoryOfflinePersistence` injected (493-506, 519-526, 528-530, 564-627, 647-1222). Caveats `VER-D` adds and I honour: 31-136 and 629-645 are *type-only*, and ~15-20 % of the 576 class lines are blank/brace, so **statement-level ≈570-590**. I independently confirmed **zero** test references to `indexedDB` / `IDBFactory` / `openGameOfflineStore` | `grep -rn "indexedDB\|IDBFactory\|openGameOfflineStore" tests` → 0 hits |
| **game-host crossing slots (15 vs 11-13)** | Publish **"13 mutable slots + 2 render-time trampolines (`:128/:129`), of which 11-13 are shared across the bridge/sync boundary"**. Never "15 of 19" | `VER-D` 4b's honest restatement; 19 total slots (13 `useRef` + 6 `useState`) confirmed by both | `grep -c "useRef(\|useState(" src/components/public/game-host.tsx` |
| **Migration 6 (23 vs 24 lines)** | **8 statements / 23 lines / 613 bytes.** "24" counts a trailing blank. `--exit-code`: empty → 0, non-empty → 2 (both reproduced) | 4 × `DROP CONSTRAINT` (all owned by the dropped tables), 3 × `DROP TABLE`, 1 × `DROP TYPE "capability"`. I re-generated it byte-identically and **`VER-A` §6-B's "empty diff, exit 0" does not reproduce** — third independent non-empty result (`ADJ-01`, `VER-C`, me) | `git show HEAD:prisma/schema.prisma > /tmp/base.prisma`; build corrected copy (8 deletions incl. `:97`); `npx prisma migrate diff --from-schema /tmp/base.prisma --to-schema /tmp/corrected.prisma --script -o mig6.sql` |
| **CHECK constraints (8 vs 11)** | **8 on surviving tables** (13 named CHECKs in the chain; 5 die with `access_links` ×3 and `rate_limit_buckets` ×2). `INV-C`'s 11 is wrong and self-contradicted by its own table. Plus 2 partial unique indexes (`3:56`, `3:58`) and 6 `gen_random_uuid()` defaults (`2:47,2:60,3:8,3:20,3:31,3:43`) invisible to the datamodel | `C7` below |
| **`generateStaticParams` (12/4 vs 5/3)** | **11 in deleted trees / 4 surviving / 15 total.** **Both published pairs are wrong**: `INV-A`'s 5/3 and `VER-A`'s 12/4. Deleted: atividades ×5 (`[id]`, `[id]/compartilhar`, `/conflito`, `/editar`, `/resultados`), materiais ×1, modulos ×1, atividade ×4. Survivors: `admin/organizacoes/[id]`, `turmas/[id]`, `resultados/[classGroupId]`, `resultados/[classGroupId]/players/[playerSlotId]`. Conclusion unaffected (all 4 survivors read only through `@runtime/*`) | `grep -rn generateStaticParams src \| wc -l` → 15; then classify by prefix |
| **Redirect stubs (4 vs 6)** | **4**: `portal/modulos/page.tsx`, `portal/modulos/[id]/page.tsx`, `portal/admin/jogos/page.tsx`, `portal/admin/modulos/page.tsx` | `grep -rln "redirect("` over `src/app/**/page.tsx` and keep those whose only statement is a redirect to `/portal` |
| **Prerendered `undefined` class tokens** | **45 of 104 documents** | My count matches `ADV-1`. Sample: `out/portal/index.html` → `class="portal-module__1g8gFq__navLink  undefined"` (3 links) | `grep -rl 'class="[^"]*undefined' out --include='*.html' \| wc -l` |
| **Stale generated `validator.ts`** | **3 copies** in the typecheck program (448 lines each, 44 `typeof import(` refs, **20** naming purge targets → up to **60** false `TS2307`); **12** artifact files among the 1,706 program files | `npx tsc -p tsconfig.json --noEmit --incremental false --listFilesOnly \| grep -E '\.next' ` |
| **§7.1 census** | baseline **13 FAIL / 12 WARN** → post-purge **9 FAIL / 8 WARN**; importers 37 → 22 | `VER-F`'s tracked-universe method, reproduced by it twice; I confirmed the 22 and the 46/7,802 inputs | `git ls-files` universe, `wc -l`, category from path+extension, budgets at `REFACTOR_PLAN.md:247-250` |
| **Demo duplication** | 10 wrapper functions + 4 adapter files (`adult-portal-demo-actions.ts` 223 lines vs `adult-portal-actions.ts` 222), **one shared domain service on both sides** — not a duplicated domain | `CRITIQUE` §2.1; relevant because it bounds how much of §2's "purge the fork" framing is true |

### The commands, verbatim (Git Bash, run from the repo root at `e5aaf1e`)

```bash
# C1 — purge volume (expect 22/1,754 + 18/3,458 + 6/2,590 = 46 files / 7,802 lines)
find 'src/app/(professional)/portal/atividades' 'src/app/(professional)/portal/materiais' \
     'src/app/(professional)/portal/modulos' 'src/app/(professional)/portal/admin/jogos' \
     'src/app/(professional)/portal/admin/modulos' 'src/app/(professional)/portal/admin/auditoria' \
     'src/app/(public-play)/atividade' -type f -print0 | xargs -0 cat | wc -l          # 1754
cat src/server/services/portal-view-service.ts src/server/services/access-link-service.ts \
    src/server/db/prisma-access-link-store.ts src/server/services/public-link-service.ts \
    src/server/services/link-status.ts src/server/services/audit-actions.ts \
    src/server/services/authorization-service.ts src/server/db/prisma-capability-reader.ts \
    src/server/services/service-container.ts src/server/security/tokens.ts \
    src/components/portal/activity-builder.tsx src/components/portal/activity-controls.tsx \
    src/components/portal/activity-mark.tsx src/components/portal/material-editor.tsx \
    src/components/portal/materials-explorer.tsx src/components/portal/class-groups-explorer.tsx \
    src/components/portal/share-actions.tsx src/components/public/public-state.tsx | wc -l  # 3458
cat tests/unit/{access-link-service,authorization,access-link-tokens,link-status,portal-dev-bypass-actions,portal-dev-bypass}.test.ts | wc -l  # 2590

# C2 — denominators (expect 20096, 6579, 7337 -> 26,675 / 34,012 / 34,295)
git ls-files src | grep -E '\.tsx?$' | grep -v '^src/generated/' | xargs wc -l | tail -1   # 20096
git ls-files tests | grep -E '\.tsx?$' | xargs wc -l | tail -1                             # 6579
git ls-files src | grep -E '\.css$' | xargs wc -l | tail -1                               # 7337
git ls-files | grep -vE '^(src|tests|docs|contracts|public|prisma)/' | grep -E '\.(ts|mts|mjs)$' | xargs wc -l | tail -1  # 283

# C3 — exported documents (expect 104, then 78, then 26)
find out -name '*.html' | wc -l
find 'out/atividade' 'out/portal/atividades' 'out/portal/materiais' 'out/portal/modulos' \
     'out/portal/admin/jogos' 'out/portal/admin/modulos' 'out/portal/admin/auditoria' -name '*.html' | wc -l
find out -name '*.html' | grep -cEv '^out/(atividade/|portal/(atividades|materiais|modulos)/|portal/admin/(jogos|modulos|auditoria)/)'

# C4/C5 — CSS census (expect: 4910 lines; rules 696; defined classes 319; live-by-grep 171 -> live∩defined 170;
#          dead 149; shared ≥2 consumers 27; phantom referenced-but-undefined = mobileNavItem)
#          Method: strip /* */ comments, brace-walk, a rule = selector prelude .. its closing '}' line;
#          live = union of styles.X / styles["X"] across surviving *.tsx/*.ts that import portal.module.css.
wc -l src/components/portal/portal.module.css
grep -rn 'generateStaticParams' src | wc -l                                               # C6: 15 (11 deleted / 4 surviving)
grep -rl 'class="[^"]*undefined' out --include='*.html' | wc -l                           # C6b: 45 (of 104)
npx tsc -p tsconfig.json --noEmit --incremental false --listFilesOnly | grep -cE '\.next'  # C8: 12 artifact files (3 validator.ts)
# C7 — CHECK recount (expect 13 named CHECKs total, 8 on surviving tables)
grep -rnE 'CONSTRAINT "[a-z0-9_]+(_check|_positive)"' prisma/migrations | wc -l           # 13
grep -rlnE 'CONSTRAINT "[a-z0-9_]+_check"' prisma/migrations                              # access_links/rate_limit_buckets rows are 0_init:163,166,169,172,175
# C9 — migration 6, fully offline (expect P1012 for the plan-literal set; valid + 8 statements / 23 lines for the corrected set)
mkdir -p /tmp/smsadv3 && git show HEAD:prisma/schema.prisma > /tmp/smsadv3/base.prisma
#   ... delete the 8 ranges [18-28],[65],[79],[80],[97],[245-260],[261-280],[299-310] into /tmp/smsadv3/corrected.prisma (expect 247 lines)
npx prisma validate --schema /tmp/smsadv3/corrected.prisma                                # valid
npx prisma migrate diff --from-schema /tmp/smsadv3/base.prisma --to-schema /tmp/smsadv3/corrected.prisma \
    --script -o /tmp/smsadv3/mig6.sql && wc -lc /tmp/smsadv3/mig6.sql                     # 23 lines / 613 bytes / 8 statements
```

`C1`–`C9` are all read-only. `C9`'s deleted-line ranges are `VER-C`'s recipe (247-line result); the `[245,280]`
single-range form in `VER-C` is equivalent to my two ranges plus the blank separators.

---

## New dependencies: needed / avoidable

Nothing below is installed. I verified `node_modules` and `package-lock.json` directly: `fake-indexeddb`, `jsdom`,
`happy-dom`, `@testing-library/*`, `eslint-plugin-import`, `eslint-plugin-boundaries` all **absent** (jsdom/happy-dom
appear only as unfilled peer entries; `grep -c fake-indexeddb package-lock.json` → 0). The only installed ESLint plugin
is `eslint-plugin-react-hooks`.

| Package / facility | Needed? | Why | Risk of adding it |
| :-- | :-- | :-- | :-- |
| **`fake-indexeddb`** (devDep) | **Only if** `VER-D`'s T3/T4 run this sprint. **Avoidable** if §4.2's file move is cut, because T1/T2/T5/T6 need no fake (stub factory suffices) | T3 needs multi-entry index keys, `autoIncrement`, unique-add failures and **request-event ordering inside one transaction** — hand-faking that re-implements IndexedDB | Low. One devDep line. It does **not** re-trigger `postinstall: prisma generate` any more than any other install does (`VER-D` dismissed that argument and so do I). Real risk is maintenance: a fake that drifts from Chrome's IDB gives *false confidence*, which is worse than the honest 0 % coverage today. |
| **`happy-dom` or `jsdom`** (devDep) | **Avoidable this sprint.** Needed only for the print-attribute and DOM-class tests I am deferring | Three config changes are prerequisites before *any* component test can even load (`VER-D` "missed" #2: `vitest.config.mts:16` include can't see `.test.tsx`; `:5-11` has no `@runtime/*` alias; `game-host.tsx:24` imports an unresolvable specifier; `server-only` is uninstalled so a reader import throws). Buying the environment alone yields 0 new tests — that is the trap |
| **`@testing-library/*`** | **Avoidable.** If a DOM test is ever written, `happy-dom` + `querySelector` covers the print-attribute flip without a library | Adds a React-version coupling surface (React 19.2.8) for one test |
| **`eslint-plugin-import`** (audit §8.5) | **Avoidable — use core `no-restricted-imports` with `patterns`.** The requirement is "nothing outside `src/runtime/` may import `@/runtime/*-server`, `@/runtime/*-demo*`, or any `"use server"` module", which is a *string* property | Zero benefit here; each added plugin must pass `eslint . --max-warnings=0` on a clean tree and every CI leg is now slower |
| **`eslint-plugin-boundaries`** | **Avoidable**, strongly. Its folder heuristics will mis-read Next route groups `(professional)` / `(public-play)` | False positives → the rule gets disabled, which is worse than never adding it |
| **`postcss`** | **Avoidable** if the CSS oracle is a brace-walk; **required to be declared** if it isn't. Today it is present only transitively (`node_modules/postcss` = 8.5.23, pulled by Next) | A repo test importing a transitive dep breaks silently the day Next's bundler stops depending on it. If you use it, add it as a devDependency — 1 line, ~zero risk |
| **CI database service container** | **Avoidable in CI this sprint.** Do the **one-off local** throwaway-Docker `migrate deploy` to close audit R1 | Any CI job holding `DIRECT_URL` is the single change that could point `migrate deploy` at a real Neon branch: I re-confirmed `VER-C` C25's mechanism matters — the datasource url comes from **`DIRECT_URL`**, and `migrate deploy` will ignore a `DATABASE_URL=` override. Also `VER-F` D3: **`DIRECT_URL` must appear in no `ci.yml` job that doesn't migrate** |
| **`datasource.shadowDatabaseUrl`** in `prisma.config.ts` | **Avoidable this sprint** (it exists only to unlock `migrate diff --from-migrations`, which I am deferring) | Adding it makes a previously-refusing command run, i.e. it turns an "unproven gate" into an "active gate with 6 known `DROP DEFAULT` drift objects" (`VER-C` C9c). That deserves its own change, not a Day-1 side effect |
| **`server-only` as a real package** | **Avoidable.** It resolves in `tsc` only via `next/types/global.d.ts`'s ambient `declare module` and in builds only via Next's compiler alias table (`VER-B` #16). For vitest, add `resolve.alias["server-only"] → <empty stub>` to `vitest.config.mts` — **this is P0.7 and it is a config line, not a dependency** | Installing the real package would make vitest *throw* where it currently can't resolve, which is not an improvement |
| **GitHub branch protection** (not a package, but a new external dependency of the plan) | **Avoidable if `ADV-1`'s single-workflow proposal is taken**: add `verify` to `deploy.yml` and make `build`/`deploy` `needs: verify`. I verified `deploy.yml`'s shape — `build` (checkout → `npm ci` → `build:demo` → upload `./out`) then `deploy` (`needs: build`), no `pull_request`, no lint/tsc/test | The settings-route alternative depends on a screen no gate can audit, and history says it has never been honored: **13 of 14 first-parent commits on `main` are direct pushes**, including `c149374` (the commit that added `game-host.tsx` and the 1,024-line demo store) |

---

## What I would refuse to implement

Each with the sentence I would write in the PR instead.

1. **§4.1 items 2-3 — `primitives.module.css` and the four per-screen stylesheets.**
   *Refusing because: the extraction creates 47 cross-file selector couplings (18 inside `@media`), can silently blank
   the QR print output and collapse the demo role switcher, and by `VER-E`'s own strict partition leaves both
   `primitives` (~860) and the residual shell (~836) above the 600-line budget the work is supposed to satisfy.
   I ship the 1,862-line dead purge, the 19 surgery rules, and the cross-file selector oracle, and I reopen the
   extraction with a browser test in hand.*
2. **§4.2 — the 7-file move of `game-offline-sync.ts`.**
   *Refusing because: 2 importers, 665 unexecutable untested lines, a silent row-stranding failure mode, one new §7.1
   FAIL (`idb-store.ts` 657) and one new WARN created by the plan itself, in a feature that is dead in the demo and has
   never run against a database. I ship the version/name freeze, the four fake-free characterization tests with
   `VER-D`'s corrected `T2` semantics, the pt-BR string assertion, and the mode-boundary bundle gate.*
3. **§4.3 — `game-host.tsx` chrome/presenter extraction.**
   *Refusing for this sprint because: 262 lines out of a file nothing else will touch, ≥10 new props, `public.module.css`
   entanglement, severity-2 `react-hooks` rules at every step, and two live server-mode defects (`H4`, `H5`) the split
   cannot surface because no environment runs them. I ship the 5-line protocol-version fix (both hardcodes) and open
   H4/H5 as tickets.*
4. **§3.1 step 5 — deleting the 9 `@runtime/*` aliases**, and with it the generated-`target.ts` machinery.
   *Refusing because: it removes the only structural fence the repo has working today, adds a gitignored-file hazard class
   with seven documented failure modes including fresh-clone breakage, and its stated payoff (E625) is already passing —
   `build:demo` exported 104 documents with the full Generation-A graph present. I ship `contracts.ts`, the explicit named
   export lists, the parity file, `typecheck:demo`, and the boundary lint rule, all of which are mechanism-neutral.*
5. **A gitignored generated file inside `src/`.**
   *Refusing because: `npm ci && npm run check` breaks on a clean clone, `prettier --check` will police it if committed and
   cannot see it if not, two dev servers share one source file, and a stale-in-the-wrong-direction copy is caught by
   nothing. If a selector is required, use the env-conditional alias value `NOTE-00` §4 already priced at zero new files.*
6. **Editing `REFACTOR_PLAN.md` to fix `format:check`.**
   *Refusing because: the corpus's own scope rule makes the plan fixed input, and `ADV-1` item 18 is the correct
   resolution — `.prettierignore` gains `REFACTOR_PLAN.md`. That is also the first commit of the entire refactor, or
   `ci.yml` is born red and every later exit criterion is unsatisfiable.*
7. **`prisma migrate dev`, `prisma db push`, or any `migrate deploy` invoked without an explicit `DIRECT_URL` override.**
   *Refusing because: `migrate dev` needs a shadow DB and offers a reset; a datamodel-driven regeneration emits 6
   `ALTER COLUMN DROP DEFAULT`; and `DATABASE_URL=` on the command line is ignored, so the plan-literal command sends the
   whole `0→6` chain to the placeholder Neon host — or to a real branch the moment `.env` is filled.*
8. **"Fixing" `mobileNavItem` by writing a `.mobileNavItem` rule.**
   *Refusing because: it adds styling that has never rendered, on the strength of a class name that never existed. The
   defect is 7 `mobile: true` literals plus one un-exercised false arm; the fix is to delete the ternary with a written
   note and open a product question about desktop-only items.*
9. **Reporting §7.5 as met.**
   *Refusing because: created-entity deep links 404 and `/portal/resultados/**` reads the seed, both pre-existing and
   unfixed by any phase. §7.5 is reworded to "seeded routes + in-app navigation" and the manual checklist is run against
   the Pages-shaped artifact with `/SMS_Portal`, not `dev:demo`.*
10. **Any new DOM/browser test environment "while we're in there".**
    *Refusing because three config changes must land before a single component test can load, none of them is the
    environment purchase, and the sprint's coverage gap is better closed by two node-only oracles (cross-file CSS selector
    integrity, and the 5-line credential round trip that `tests/unit/demo-player-access.test.ts` already half-provides).*
