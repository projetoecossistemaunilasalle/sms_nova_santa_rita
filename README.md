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
- [V1 game integration dossier](docs/v1-game-integration-dossier.md)
- [Current architecture and route boundaries](docs/current-architecture.md)
- [Visual demo plan](docs/demo-visual-plan.md) (demo reference, not V1 product authority)
- [Design system](DESIGN.md)
- [Runtime JSON Schemas](contracts/schemas)
- [Database schema](prisma/schema.prisma)
- [Implementation roadmap](docs/implementation/README.md) (must be reconciled with the V1 dossier)
- [Legacy portal proposal](portal-v1-specification.md) (historical research only)

## Current application structure

```text
src/
  app/
    (professional)/ authenticated professional/admin portal routes
    (public-play)/   current demo public/player route surface
    health/          liveness and readiness route handlers
  components/
    portal/          professional/admin shell and workflow components
    public/          player/activity entry and unavailable states
    shared/          cross-surface primitives
  server/
    config/ db/ http/ observability/ services/
```

The current static/demo route and data model predate the numbered-player V1 direction. Do not treat the demo's anonymous session-link model or aggregate-only reporting as final architecture.

## Local setup

The runtime is pinned to Node.js `24.19.0` and npm `11.6.x`. Use `.nvmrc` or your Node version manager before installing dependencies.

```bash
npm install
cp .env.example .env.local
npm run dev
```

The local application is available at `http://localhost:3000`.

## Verification

```bash
npm run check
npm run build
```

The repository currently also supports a static GitHub Pages demo configuration. That demo is useful for visual validation but does not represent production persistence, authentication, player identity, or GameMaker synchronization.
