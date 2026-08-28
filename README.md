# Missoes do Caramelito Portal and Activity Host

This workspace contains the authenticated professional/admin portal and the public
activity-link surface for one existing GameMaker experience. There is no marketing
landing page. Participants do not enter through the portal: they open a customized
opaque activity link and are handed off to the configured game client.

## Scope

- The professional/admin portal is an authenticated work surface for the operational
  and administrative workflows supported by the product.
- The public activity route accepts a customized opaque token and exposes only the
  entry, unavailable, or handoff state needed for that link.
- Portal navigation must not launch gameplay, enumerate public activity links for
  participant discovery, or act as a game/minigame catalog.
- `GAME_CLIENT_URL` identifies the deployed GameMaker client that receives the activity
  handoff. The existing GameMaker project owns the single game experience.

The link shape is an implementation detail of the link system. In the current Next.js
route tree, the public activity boundary is represented by
`src/app/(public-play)/atividade/[token]`. A generated link is the only public entry
point; do not add a marketing homepage or a portal shortcut into gameplay.

## Documents

- [Product truth](PRODUCT.md)
- [Current architecture and route boundaries](docs/current-architecture.md)
- [Design system](DESIGN.md)
- [Runtime JSON Schemas](contracts/schemas)
- [Database schema](prisma/schema.prisma)
- [Implementation roadmap](docs/implementation/README.md)
- [Legacy portal proposal](portal-v1-specification.md) (historical research only)

## Application structure

```text
src/
  app/
    (professional)/ authenticated professional/admin portal routes
    (public-play)/   customized activity-link entry and state routes
    health/          liveness and readiness route handlers
  components/
    portal/          professional/admin shell and workflow components
    public/          activity entry, handoff, and unavailable states
    shared/          cross-surface primitives
  server/
    config/ db/ http/ observability/ services/
```

The portal and public activity route are separate surfaces. Portal services enforce
professional/admin authentication and authorization; public services resolve the
opaque link and prepare the GameMaker handoff. The exact handoff payload and transport
are defined by the versioned GameMaker integration contract, not by a portal-created
game or minigame catalog.

## Local setup

The runtime is pinned to Node.js `24.19.0` and npm `11.6.x`. Use `.nvmrc` or your Node
version manager before installing dependencies.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `GAME_CLIENT_URL` in `.env.local` to the deployed URL of the existing GameMaker
client. Configure the Neon database and Neon Auth values for the authenticated portal;
`AUTH_DEV_BYPASS` is for local development only and must remain disabled in production.
Replace every example secret and deployment URL before using a shared environment.

The local application is available at `http://localhost:3000`. Liveness is exposed at
`/health/live`; readiness is exposed at `/health/ready` and performs a time-bounded
database query when database-backed services are configured.

To preview the production server locally, run:

```bash
npm start
```

Use `npm start -- --port 3010` to select another port.

## Verification

```bash
npm run check
npm run build
```

The production image uses the Next.js standalone output and runs as an unprivileged
`nextjs` user:

```bash
docker build -t missoes-caramelito-portal .
docker run --env-file .env.local -p 3000:3000 missoes-caramelito-portal
```
