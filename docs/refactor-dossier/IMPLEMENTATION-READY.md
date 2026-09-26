# Refactor Implementation Runbook

Revision: 2026-09-26. Inspected checkout: `780b0a8`. This is the only
implementation work order for the refactor. `REFACTOR_PLAN.md`, the older
`phases/*.md`, dossier reports, root `implementation_plan.md`, and
`docs/implementation/*` are requirement or historical evidence, not parallel
instructions. When they conflict with this runbook, this runbook wins.

## Scope and Fixed Decisions

1. There is no backward-compatibility requirement for Generation A. Delete its
   routes, services, schema, tests, CSS, URLs, and browser state without shims,
   redirects, compatibility barrels, migration-on-read code, or deprecation
   periods.
2. Current V1 contracts are not legacy. Preserve the GameMaker protocol schemas,
   Portuguese wire values, credential behavior, authorization rules, and the
   server/demo product flows that remain after the purge.
3. Replace the nine build-time `@runtime/*` aliases with generated runtime entry
   files. Keep actions, readers, and browser client helpers as three distinct
   entry points so their Next.js boundaries are explicit.
4. The demo statically exports only seeded dynamic routes. Objects created in
   browser state remain usable on already-exported list and workflow screens,
   but the UI must not link them to unseeded dynamic detail URLs. No
   implementation work will make arbitrary new IDs navigable or refreshable on
   a static host.
5. Keep CSS Modules. Purge dead Generation-A CSS and repair live missing styles,
   but do not split the surviving stylesheet merely to satisfy a line target.
6. Decompose by ownership, not by a numeric line budget. Do not add size ratchets,
   selector inventories, exact export-path snapshots, or tests for documents,
   CSS text, generated HTML, workflow text, or other static artifacts.
7. Add tests only for behavior changed or put at risk by the refactor. Preserve
   the existing domain, security, contract, and offline-sync suites. One normal
   Vitest run is the permanent gate; do not duplicate it in serial mode or rerun
   `test:contracts` after the full suite.
8. Docker is not a supported build or deployment target for this version. Remove
   the checked-in `Dockerfile` and `.dockerignore`; do not replace them, add a
   container build, or add Docker-specific documentation or tests.

The repository pins Node `24.19.0` and npm `>=11.6.0 <12`; the inspected shell
uses Node `22.23.1`. Implementation acceptance must run on the pinned versions.
Before changing Next.js code, reread the installed guides under
`node_modules/next/dist/docs/` for `use-server`, Server/Client Components,
TypeScript, and static exports. The installed version, not remembered framework
behavior, is authoritative.

## Delivery Order

Land `P00 -> P10 -> P20 -> P30 -> P40 -> P50`. P10 and P20 may be one PR so the
Generation-A code and schema disappear atomically. P40 may be several small PRs
in the listed order. Every merge must pass the gates that exist at that point.

Do not run `prisma migrate dev`, `prisma db push`, or `prisma migrate reset`.
Local development, implementation acceptance, and CI must not require a
database: the demo runs locally without one, and the server target must build
without connecting while remaining ready to plug into PostgreSQL. The only
database-connected step is the explicit disposable-database release validation
in the Database and Rollback section below. Use the repository-local Prisma CLI
through npm scripts or `npm exec -- prisma`. Use an existing disposable managed
PostgreSQL environment for that release validation; do not add Docker setup for
it.
Stop dev servers before switching targets or cleaning build output; generated
runtime entries and `.next` are intentionally
single-target workspace state and concurrent target commands are unsupported.

## P00: Reproducible Baseline and CI

**Change set**

1. Record `git status --short`, the base commit, Node/npm versions, and the exit
   codes of the existing format, lint, typecheck, test, Prisma validation, server
   build, and demo build commands. Do not reuse old dossier counts as evidence.
2. Delete `Dockerfile` and `.dockerignore`. The server build remains a supported
   Next.js artifact, but container packaging and container validation are outside
   this version.
3. Add `REFACTOR_PLAN.md` to `.prettierignore`; it is a fixed requirement record,
   not a file this refactor should reformat.
4. Fix `tests/unit/auth.test.ts` so each environment variable it mutates is
   restored to its captured prior value, including `APP_RUNTIME_MODE`. Add one
   regression that starts with a nonempty value and proves restoration.
5. Add `scripts/clean-build-artifacts.mjs` and `clean:build`. The script has a
   fixed allowlist for `.next`, `.next-demo-dev`, `out`, and root TypeScript
   build-info files. It accepts no caller-supplied path, resolves every target
   inside the repository, and rejects junctions/symlinks that could escape it.
   Add one focused escape regression; do not build a general filesystem-fixture
   suite.
6. Add `prisma:validate` as an npm script running `prisma validate`. Invoke that
   script everywhere so validation always uses the repository-local Prisma CLI.
7. Add `.github/workflows/ci.yml` for pull requests and pushes to `main`. Use the
   pinned Node version, `npm ci`, `npm run clean:build`, format, lint, local Prisma
   validation, the current test/typecheck commands, then both builds serially.
   Use loopback/`.invalid` CI-only server configuration and non-secret 32+
   character placeholder secrets. Do not add Postgres, a shadow database, or
   schema-drift infrastructure.

**Acceptance**

- The baseline is reproducible on the pinned toolchain.
- `npm test` passes once in its normal mode and the environment restoration test
  is order independent.
- CI runs real commands, but no separate unit tests parse or snapshot its YAML.
- No Docker build, container workflow, `Dockerfile`, or `.dockerignore` remains.
- Pages deployment remains unchanged until P50; do not claim it is gated yet.

## P10: Closed Generation-A Purge

Delete the following exact route trees:

- `src/app/(professional)/portal/atividades/`
- `src/app/(professional)/portal/materiais/`
- `src/app/(professional)/portal/modulos/`
- `src/app/(professional)/portal/admin/jogos/`
- `src/app/(professional)/portal/admin/modulos/`
- `src/app/(professional)/portal/admin/auditoria/`
- `src/app/(public-play)/atividade/[token]/`

Delete these services, stores, and components:

- `src/server/services/access-link-service.ts`
- `src/server/services/portal-view-service.ts`
- `src/server/db/prisma-access-link-store.ts`
- `src/server/services/authorization-service.ts`
- `src/server/services/audit-actions.ts`
- `src/server/services/public-link-service.ts`
- `src/server/security/tokens.ts`
- `src/server/db/prisma-capability-reader.ts`
- `src/server/services/service-container.ts`
- `src/server/services/link-status.ts`
- `src/components/portal/material-editor.tsx`
- `src/components/portal/activity-builder.tsx`
- `src/components/portal/class-groups-explorer.tsx`
- `src/components/portal/share-actions.tsx`
- `src/components/portal/activity-controls.tsx`
- `src/components/portal/materials-explorer.tsx`
- `src/components/public/public-state.tsx`
- `src/components/portal/activity-mark.tsx`

Delete the six tests that exclusively cover those modules:

- `tests/unit/access-link-service.test.ts`
- `tests/unit/authorization.test.ts`
- `tests/unit/portal-dev-bypass-actions.test.ts`
- `tests/unit/access-link-tokens.test.ts`
- `tests/unit/link-status.test.ts`
- `tests/unit/portal-dev-bypass.test.ts`

Delete the Generation-A contract artifacts and their two wholly legacy schema
documents. The current GameMaker contract is the `contracts/schemas/v1/` tree and
must remain untouched:

- `contracts/schemas/api-error.v1.schema.json`
- `contracts/schemas/attempt-create-request.v1.schema.json`
- `contracts/schemas/attempt-create-response.v1.schema.json`
- `contracts/schemas/attempt-result-ack.v1.schema.json`
- `contracts/schemas/attempt-result-request.v1.schema.json`
- `contracts/schemas/session-manifest.v1.schema.json`
- `contracts/schemas/games/`
- `docs/schemas/api-contracts.md`
- `docs/schemas/domain-rules.md`

Apply these coupled edits in the same change:

1. Reduce `StatusBadge` to `"Ativa" | "Inativa"`; remove its dependency on
   `ActivityStatus` while preserving the existing positive/neutral styles.
2. Remove the now-unused `isDemoRuntime`, drop only the `export` modifier from
   `DEV_BYPASS_ACTOR` while keeping the constant for the gateway's internal use,
   remove the `Links de acesso` branch in `adult-portal-helpers.ts`, and update
   auth fixtures that point at deleted routes.
3. Delete the unreferenced placeholder
   `src/app/(professional)/entrar/recuperar/actions.ts`; the surviving recovery
   page is a client-side demonstration and does not import it.
4. In `src/proxy.ts`, remove only the `/atividade/` referrer-policy condition
   and remove or rewrite the adjacent public-activity-token comment so it
   describes only the surviving `/jogar` behavior. Preserve `/jogar` and
   `/jogar/` as `no-referrer`, the CSP, frame origins, and matcher. Update the
   existing proxy test for those three behaviors.
5. Reduce `apiErrorCodes` to the six codes emitted by the surviving player HTTP
   routes: `AUTHENTICATION_REQUIRED`, `FORBIDDEN`, `VALIDATION_FAILED`,
   `CONFLICT`, `INTERNAL_SERVER_ERROR`, and `SESSION_EXPIRED`. Do not preserve
   unused Generation-A error names.
6. Remove every retired Generation-A route and symbol claim from `walkthrough.md`,
   including the public activity URL, route inventory, and `DEV_BYPASS_ACTOR`
   description. Update the live help page in the same phase so it no longer
   advertises access-link or link-status workflows. Also update
   `docs/current-architecture.md`, `docs/schemas/README.md`, and
   `contracts/schemas/README.md` so the current documentation and contract index
   describe only the surviving route and schema boundaries. Leave broader copy
   polishing to P50; none of these edits needs a test.
7. Search the whole first-party tree for imports and route strings that point to
   the deletion set. Review the diff rather than adding a permanent deletion or
   export-path test.

**Acceptance**

- No deleted path, import, error code, or contract artifact remains in `src`,
  active tests, current user docs, or the live contract index. Documents already
  and explicitly classified as historical may describe the former product, but
  they must not be linked as current implementation guidance.
- Format, lint, typecheck, normal tests, and both builds pass after a clean.
- The static demo builds successfully. Do not snapshot its exact HTML file list;
  the build and P50 manual browser smoke are the useful assertions.
- `/atividade/*` is allowed to break with no redirect or compatibility test.

## P20: Clean Schema Baseline

There is no deployed-database compatibility requirement. Replace the old
incremental migration history with one post-refactor baseline rather than adding
`6_drop_generation_a`. If implementation discovers a real database whose data
must survive, stop: preserving it is a separate migration project and is outside
this runbook.

1. Remove `Capability`, `CapabilityAssignment`, `AccessLink`, `RateLimitBucket`,
   and `AuditEvent` from `prisma/schema.prisma`.
2. Remove all inverses: `ProfessionalProfile.createdAccessLinks` and
   `.auditEvents`; `Organization.scopedCapabilities` and `.accessLinks`; and
   `OrganizationMembership.capabilityAssignments`.
3. Set `DIRECT_URL` in the same process to a non-secret dummy PostgreSQL URL,
   then generate a new migration from the final schema into a temporary file with
   `npm exec -- prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`.
   This schema-to-schema diff does not connect to that URL, but Prisma 7.9.1 can
   otherwise exit successfully with empty output because `prisma.config.ts` has
   no CLI datasource. Treat empty output, or output without the expected
   surviving `CREATE TABLE` statements, as failure. Only replace
   `prisma/migrations/0_init/migration.sql` after those checks pass; delete
   migration directories 1 through 5 and keep the PostgreSQL
   `migration_lock.toml`.
4. Preserve the database rules Prisma cannot express: the eight surviving CHECK
   constraints on player number, game-state revision/protocol/schema, result
   duration/state, and active-time duration/mode; and the two partial unique
   indexes allowing one active credential per slot and one active session per
   class. The required names are `player_slots_player_number_positive`, the
   three `game_states_*_check` constraints, the two `result_events_*_check`
   constraints, the two `active_time_events_*_check` constraints,
   `player_credentials_one_active_per_slot`, and
   `game_sessions_one_active_per_class`. Review their columns and predicates in
   the final SQL.
5. Prisma does not emit those ten rules. Append their reviewed SQL statements to
   the temporary generated migration before it replaces `0_init`; do not copy a
   whole historical migration or assume the generator preserved them.
6. Do not copy the six historical `gen_random_uuid()` defaults. The application
   writes these IDs through Prisma's `@default(uuid())`; raw-SQL insert support is
   not a current product contract.
7. Run `npm run prisma:validate` and `npm run prisma:generate`, then search
   first-party source for the removed model/enum/property names. Update
   `docs/schemas/database-model.md` in the same phase.

**Acceptance**

- The final schema contains 12 models and five enums.
- The new `0_init` creates only the surviving model and enum set and includes the
  ten named database rules above.
- Prisma validation/generation, typecheck, tests, and both builds pass from clean
  generated output.
- No migration SQL snapshot, historical-file immutability test, or generated
  client-shape test is added. SQL review plus Prisma/build gates are sufficient.
- Any existing environment is recreated from the new baseline; no upgrade or
  rollback path for the deleted schema is promised.

## P30: Generated Runtime Entries

### Target Shape

Create concrete entries that re-export existing implementations:

| Concern                          | Server              | Demo              | Generated consumer entry |
| -------------------------------- | ------------------- | ----------------- | ------------------------ |
| Mutations/auth/player entry      | `actions.server.ts` | `actions.demo.ts` | `actions.ts`             |
| Page/static-param readers        | `readers.server.ts` | `readers.demo.ts` | `readers.ts`             |
| Browser demo bridge/no-op bridge | `client.server.ts`  | `client.demo.ts`  | `client.ts`              |

The generated files contain a directive header where required, followed only by
literal named re-exports for the selected target. Server `actions.ts` starts with
`"use server"`; demo `actions.ts` remains directive-free so its functions are
ordinary browser-callable async functions. `readers.ts` imports `server-only`;
`client.ts` starts with `"use client"`. Action implementations remain in their
dedicated files with module-level `"use server"` where applicable. Convert
`src/app/(professional)/entrar/actions.ts` from a function-level directive to a
module-level `"use server"` file.
Do not wrap actions in ordinary closures, pass reader functions through React
props, or create another Prisma client/composition root.

Do not add a separate runtime-contract test framework. Both target typechecks
compile every consumer against the selected concrete exports and are the drift
check. Continue using the application DTOs already shared by both variants.

### Generation and Scripts

1. Extend `scripts/next-target.mjs` with `gen demo|server`. Validate arguments,
   write the three deterministic entries, and exit before invoking Next. Generate
   the selected entries before every `dev` and `build` command.
2. Git-ignore the three generated files and exclude them from Prettier/ESLint.
   Concrete variants remain tracked and checked.
3. Target commands self-prepare; no command may depend on whichever entry was
   left by a previous command:

| Script                                                   | Behavior                                                                           |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `typecheck:server`                                       | Generate server entries, then run full-project `tsc --noEmit --incremental false`. |
| `typecheck:demo`                                         | Generate demo entries, then run the same full-project check.                       |
| `typecheck`                                              | Run both target checks serially.                                                   |
| `test` / `test:watch`                                    | Generate demo entries, then run Vitest in the existing demo environment.           |
| `dev`, `dev:demo`, `build:server`, `build:demo`, `build` | Preserve current meanings and generate before Next starts.                         |
| `check`                                                  | Format check, lint, Prisma validation, one Prisma generation, both typechecks, and one normal test run. |

Implement the non-Next commands as explicit package-script chains, for example
`node scripts/next-target.mjs gen demo && vitest run` and the equivalent watch
and typecheck commands. Do not rely on npm `pre*` hooks: `prebuild` does not run
for `build:demo` or `build:server`. `check` must run `npm run prisma:generate`
once after `prisma:validate` and before either typecheck so a local gate cannot
validate a stale untracked Prisma client. Do not run generation once per target.

Atomic replacement of each file is useful; a cross-process lock manager and a
failure-fixture matrix are not. The documented operating rule is one target
command at a time in a checkout.

### Rewire

1. Repoint all current `@runtime/*` imports to `@/runtime/actions`,
   `@/runtime/readers`, or `@/runtime/client` by responsibility.
2. Remove all nine `@runtime/*` aliases from `next.config.ts` and `tsconfig.json`.
   Keep the ordinary `@/*` path mapping.
3. Keep sign-in and sign-out forms as Server Component forms; no new client form
   wrappers are needed. Client components may import file-level Server Actions
   through the generated action entry as supported by the installed Next guide.
4. Keep existing server readers delegating to the surviving containers. The four
   API route handlers and action implementations remain legitimate composition
   consumers; do not add an artificial import-count gate.

**Acceptance**

- Starting with all generated entries absent, `typecheck:server`,
  `typecheck:demo`, `npm test`, `build:server`, and `build:demo` each prepare what
  they need and pass when run serially.
- No `@runtime/` import or config key remains.
- The demo static export succeeds, which is the authoritative check that no
  Server Action is reachable in that target. Do not snapshot manifest IDs or
  exact action counts.
- No custom import-graph parser, negative graph-fixture suite, or generated-file
  unit test is introduced.

## P40: Focused Decomposition

### P40a: CSS Cleanup

After P10, remove selector blocks whose only owners were deleted and prune dead
branches from mixed rules. Repair the known live missing styles
`mobileNavItem` and `entryProblem`; verify whether `desktopNavItem` has the
intended default outside its media rule. Keep the credential print activation,
sheet, card, and `@media print` rules together in `portal.module.css`.

Do not introduce a CSS parser, selector baseline, stylesheet split, or size gate.
Use source search during the edit, then validate representative desktop, mobile,
error, and print states in the P50 manual browser smoke.

### P40b: Offline Sync

Split `src/runtime/game-offline-sync.ts` by ownership:

- `offline/types.ts`: persistence/transport contracts and queue/result types.
- `offline/errors.ts`: public offline error classes.
- `offline/canonical.ts`: stable JSON, request identity, and pure conflict parsing.
- `offline/indexed-db.ts`: database open/upgrade and IndexedDB persistence.
- `offline/sync-engine.ts`: `GameOfflineStore` orchestration and public factory.

Dependencies flow from the engine to persistence and leaf modules, never back to
the engine. Move whole responsibilities; do not split methods by line range or
pass unbound class methods. Repoint `game-host.tsx` and the existing offline test,
then delete the old file without a compatibility barrel.

Keep the existing seven behavioral offline scenarios and change only their import
paths. Add `fake-indexeddb` as a direct dev dependency for one focused production
persistence lifecycle regression: open, enqueue/persist, close, reopen, and read.
Cover abort in that test only if the transaction algorithm changes; do not add a
full fake-versus-IndexedDB parity matrix.

### P40c: Host, Application, and Demo Transaction

1. Extract pure host state/message parsing to `game-host-model.ts` and rendering
   chrome to `game-host-chrome.tsx`. Keep effects, refs, listener lifecycle,
   launch-token renewal, queue order, and retry orchestration in `game-host.tsx`.
   Do not extract hooks in this refactor.
2. Move complete portal-shell construction to
   `src/application/adult-portal/shell-view-model.ts`, taking actor and effective
   role explicitly. Move the duplicated policy actor conversion to
   `src/application/authorization/authorization-actor.ts`. Keep `getShell`
   responsible for loading/validating the actor and delegating. Extend the
   existing adult-portal suite with a compact `getShell` table for platform admin,
   organization admin, teacher, and inactive/no-membership scope.
3. Fix `DemoAdultPortalStore.transaction` to snapshot before work and restore the
   existing state object in place on rejection. Add focused assertions for a
   nested rollback preserving object identity and for a successful commit.
4. Keep demo credentials explicitly browser-local and non-secret. Do not import
   server HMAC/Node crypto into the demo or hash a second copy of a raw demo token
   and describe that as secure storage.
5. Validate persisted demo portal state before returning it. Valid JSON with the
   current version but missing or malformed required fields is corrupt and must
   fall back to a fresh clone of the current seed. Keep this validation focused
   on the persisted state contract; do not add migration-on-read behavior. Add
   one regression to the existing demo-state test coverage using a malformed
   current-version value.
6. If this phase changes the stored demo-state shape, bump its key/version and
   fall back to the current seed. Do not add migration-on-read compatibility.

Use the existing bridge and adult-portal service suites to protect the extracted
logic; extend those files only where a moved branch lacks behavioral coverage.
Do not add React Testing Library solely to test presentation markup.

**Acceptance**

- The old offline file is gone, imports point directly at owned modules, and no
  new dependency cycle or compatibility barrel exists.
- Existing offline, bridge, adult-portal, player-access, security, and contract
  tests pass, plus the focused IndexedDB lifecycle, `getShell`, and two demo
  transaction checks and the malformed persisted-state fallback check.
- Both targets typecheck/build and the manual host flow remains ready for P50.
- File sizes are recorded for review but are not pass/fail criteria.

## P50: Security, Documentation, Deployment, and Acceptance

1. Extend logger redaction for `cred`, `launchToken`, player credential values,
   and credential hashes. Keep HTTP logs to pathname rather than full URL. Add
   one output-level regression proving a sentinel credential in structured and
   URL-shaped input is not emitted.
2. Finish polishing the live help page for organizations, classes, players,
   credentials, and results after P10's required factual cleanup. This is content
   work and needs no unit test.
3. Update current documentation: `README.md`, `DESIGN.md`, `PRODUCT.md`,
   `docs/current-architecture.md`, `docs/schemas/database-model.md`,
   `docs/schemas/README.md`, `contracts/schemas/README.md`, and `walkthrough.md`.
   Ensure none presents Docker as a supported build or deployment target. Review
   `docs/implementation/v1-architecture-plan.md`,
   `docs/v1-game-integration-dossier.md`, `docs/demo-visual-plan.md`, and root
   `implementation_plan.md`; correct current claims or label them historical.
   Do not test documentation structure.
4. Fold Pages publication into `ci.yml`: the gate job builds the demo once and,
   only on a successful push to `main`, uploads `out` as the Pages artifact. A
   dependent deploy job uses that artifact with Pages/OIDC permissions scoped to
   that job. Preserve the `github-pages` environment and deployment URL, and put
   the existing `pages` concurrency group on the deploy job with
   `cancel-in-progress: false` so PR gate jobs are not serialized. Delete the
   independent push-triggered `deploy.yml`; do not rebuild or search for a
   "latest" artifact in a second workflow.
5. Run `npm audit` against the installed lockfile and review applicable runtime
   findings. Do not run `npm audit fix --force` as part of this refactor.
6. After the first successful real CI run, give the exact gate job name to the
   repository administrator to make required on `main`, and record the run URL
   and resulting branch-protection setting. Local workflow text is not evidence
   that merge protection is active.

### Final CI Sequence

1. Checkout, pinned Node, `npm ci`, `npm run clean:build`.
2. `npm run format:check`, `npm run lint`, `npm run prisma:validate`.
3. `npm run typecheck:server`, then `npm run build:server`.
4. `npm test` once; it prepares the demo entries.
5. `npm run typecheck:demo`, then `npm run build:demo`.
6. On a successful `main` push only, upload `out` and deploy it in the dependent
   Pages job.

Do not add exact route/action inventories, workflow-parser fixtures, deliberate
failure fixtures, CSS/size baselines, or duplicated serial/contract test legs.

### Manual Browser Smoke

Serve the actual static export at `/SMS_Portal/` and check:

- seeded organization, class, result, and player-detail routes;
- demo sign-in/out and one organization or class mutation;
- credential allocation, rotation, entry, and print;
- reload plus same-tab and two-tab state updates;
- invalid/corrupt browser state falling back to the seed;
- mobile navigation, one error state, and base-path links;
- print mode shows QR cards in two columns without portal chrome, while ordinary
  browser print outside the print action does not reveal the hidden sheet.

## Database and Rollback

The database deliverable is a clean initialization baseline, not an upgrade.
Before deploying, the owner must confirm the target may be recreated and that no
data needs preservation. Apply the baseline only to an empty/disposable database,
then exercise auth, authorization, credential, bootstrap, state, result, and
active-time flows. `prisma.config.ts` obtains its CLI datasource from
`DIRECT_URL`, not `DATABASE_URL`: set `DIRECT_URL` explicitly in the same process
that runs each Prisma command rather than relying on `.env`. Before applying the
baseline, record the parsed host and database name without credentials and
confirm through the provider or a catalog query that the target has no application
tables or prior `_prisma_migrations` history. Record the output of
`npm exec -- prisma migrate deploy` and `npm exec -- prisma migrate status`, then
inspect the catalog to confirm the eight CHECK constraints and two partial unique
indexes are present.
This is a release check on one disposable database, not a recurring CI database,
a Docker environment, or a migration-history compatibility test. If data
preservation is requested, stop and design a separate forward migration; do not
quietly restore compatibility scope here.

With that disposable database connected, check the server target's no-JavaScript
sign-in, authorization for the three surviving roles, four player API routes,
`/jogar` referrer policy, idempotent event submission, state conflict handling,
and one offline retry. Real `Heroes_Trial`, tablet, and two-device checks remain
release checks. None of these database-connected checks is a prerequisite for
local development or CI.

Rollback code by reverting a whole phase and rebuilding both targets. Roll back
Pages by redeploying the last successful artifact. Roll back a recreated database
from its approved backup or by recreating it from the intended baseline; Git
revert is not database recovery.

## Evidence Used

Three independent GPT-5.6 Luna/max reviews inspected the dossier, current code,
and test scope. The implementation choices above also reflect the installed
Next.js 16.3.2 guides and the September 25 audit set. The older dossier remains
useful evidence for the closed deletion manifest and discovered edge cases, but
none of its superseded gates or compatibility rulings are additional work.
