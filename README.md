# Missoes do Caramelito Portal and Game Host

This workspace contains the authenticated professional/admin portal, the low-friction player entry surface, and backend integration for one existing GameMaker experience.

There is no marketing landing page.

V1 is focused on the complete portal-to-game workflow: organizations and classes are prepared by administrators, teachers use already-prepared classes, children enter through numbered player QR credentials, game state persists across supported school tablets, and results/active time return to authorized adults.

Materials/content management is deferred beyond V1.

## V1 scope

- Three adult access levels: platform administrator, organization administrator, and teacher.
- Organization administrators create classes and assign teachers.
- Teachers work with assigned classes and should have minimal setup burden.
- Children do not create conventional username/password accounts.
- Classes use numbered player slots rather than a nominal child roster.
- Player QR credentials support fast access on shared tablets.
- Player game state must persist server-side and work across devices.
- Results may be associated with both the class and numbered player.
- Active-play time is a supported classroom participation metric.
- Temporary offline operation should queue supported changes and synchronize after reconnection.
- Cross-year player migration is deferred.
- Materials is not part of V1.

## Product boundary

The portal/backend owns adult access, organizational structure, classes, player credentials, session context, persistence services, reporting, and integration boundaries.

The existing GameMaker project owns gameplay content, activities/minigames, game rules, world behavior, progression semantics, cosmetics, rewards, and other gameplay logic.

The portal must not become a minigame catalog or game editor.

## Documents

- [Product truth](PRODUCT.md)
- [Current architecture and route boundaries](docs/current-architecture.md)
- [Implementation-ready refactor dossier](docs/refactor-dossier/IMPLEMENTATION-READY.md) (current implementation reference)
- [Database model](docs/schemas/database-model.md) and [Prisma schema](prisma/schema.prisma)
- [V1 game integration dossier](docs/v1-game-integration-dossier.md) (historical planning record — superseded, not implementation guidance)
- [Visual demo plan](docs/demo-visual-plan.md) (historical demo plan — superseded, not implementation guidance)
- [Design system](DESIGN.md)
- [Runtime JSON Schemas](contracts/schemas)
- [Implementation roadmap](docs/implementation/README.md)
- [Legacy portal proposal](portal-v1-specification.md) (historical research only)

## Current application structure

```text
src/
  app/
    (professional)/ authenticated professional/admin portal routes
    (public-play)/   player entry surface (/jogar)
    api/v1/          player bootstrap, state, results, and active-time route handlers
  components/
    portal/          professional/admin shell and workflow components
    public/          player entry and GameMaker game-host components
    shared/          cross-surface primitives
  runtime/           shared server entry points and offline modules
  server/
    auth/ authorization/ config/ db/ http/ mock/ observability/ security/ services/
```

The portal has one route tree, one set of screens and server actions, and shared
application services. The composition roots choose Prisma/Neon adapters for
real infrastructure or session-isolated in-memory adapters under
`src/server/mock/` for the local demo. No portal state or authorization is
recomputed in browser localStorage.

## Local setup

The runtime is pinned to Node.js `24.19.0` and npm `11.6.x`. Use `.nvmrc` or your Node version manager before installing dependencies.

```bash
npm install
cp .env.example .env.local
npm run dev
```

For a working local portal without database or auth credentials, run:

```bash
npm run dev:demo
```

Open [the local portal](http://127.0.0.1:3000/entrar) and choose **Entrar na
demonstração**. The mock binds to loopback by default. Use **Perfil demonstrado**
to switch between seeded professionals, and **Restaurar demo** to reset only
your workspace. Changes survive navigation and reloads, but expire after eight
hours or when you sign out or restart the server. Tabs in the same browser
session share a workspace; separate browser sessions are isolated.

`npm run dev` uses real infrastructure and validates database and Neon Auth
settings in `.env.local`.

## Commands

| Command                                                     | Purpose                                                                           |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `npm run dev` / `npm run dev:demo`                          | Develop against the server or demo target                                         |
| `npm run build` (`build:server`)                            | Standalone server build in `.next/`                                               |
| `npm run build:demo`                                        | Standalone local mock build in `.next/`                                           |
| `npm run start`                                             | Build and start the standalone server via `scripts/start.mjs`                     |
| `npm run typecheck` / `typecheck:server` / `typecheck:demo` | Generate runtime entries, then run `tsc` for the selected target                  |
| `npm test`                                                  | Generate the demo runtime entries, then run Vitest                                |
| `npm run clean:build`                                       | Remove build artifacts from a fixed allowlist                                     |
| `npm run check`                                             | Format, lint, Prisma validation and generation, both typechecks, and one test run |

Dev/build/test/typecheck commands generate `src/runtime/actions.ts` and
`src/runtime/readers.ts` from the same tracked `*.shared.ts` barrels in both
modes. Do not run concurrent builds/dev servers from one checkout: both use
`.next/`.

## Runtime targets

- `npm run build:demo` builds the same server application with mock adapters.
  It needs no Neon credentials. `npm run start:demo` rebuilds and launches it
  locally. This is no longer a static export and cannot run on GitHub Pages.
- `npm run build:server` creates the standalone, server-capable Next.js build
  in `.next/`. It requires `DATABASE_URL`, `NEON_AUTH_BASE_URL`,
  `NEON_AUTH_COOKIE_SECRET`, and `APPLICATION_SECRET`. `npm run start` rebuilds
  and launches it through `scripts/start.mjs`.
- `npm run build` is intentionally an alias for `build:server`.

In server mode, an adult must first exist in Neon Auth and have a matching active
`ProfessionalProfile`. Organization/team screens bind that already-provisioned
profile to an application-owned membership; the portal does not create passwords or
silently synthesize authentication identities.

## CI and deployment

`.github/workflows/ci.yml` is the only workflow. Its gate job runs formatting,
lint, Prisma validation, both typechecks, the server build, the demo build, and
the unit tests on every pull request and every push to `main`. GitHub Pages
publication has been removed because the mock now needs a Node.js server.
Deployment to the planned physical Windows Server host is not configured yet.

## Verification

```bash
npm run check
npm run build:demo
npm run build:server
```

The local mock exercises portal authorization, organizations, memberships,
classes, teacher assignments, numbered players, credential rotation, and class
sessions through the production application code. Reports reflect the current
mock roster and participation but do not invent game results. Neon authentication,
durable database behavior, cross-device QR access, and GameMaker synchronization
still require real integration testing. The mock is single-process development
infrastructure, not a production or multi-instance persistence solution.
