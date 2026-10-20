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
| `npm run start`                                             | Start the existing packaged server release via `scripts/start.mjs`                |
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
  It needs no Neon credentials. `npm run start:demo` launches the existing demo build
  locally. This is no longer a static export and cannot run on GitHub Pages.
- `npm run build:server` creates the standalone, server-capable Next.js build
  in `.next/`. It requires `DATABASE_URL`, `NEON_AUTH_BASE_URL`,
  `NEON_AUTH_COOKIE_SECRET`, and `APPLICATION_SECRET`. The build also packages
  `public` and `.next/static` into `.next/standalone`. `npm run start` launches
  that release unchanged through `scripts/start.mjs`, refusing missing or
  wrong-target builds. For artifact-only deployment, copy `.next/standalone`
  and run its `server.js` with Node and the production environment configured.
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

## Reliability and deployment prerequisites

- Apply pending migrations with `npx prisma migrate deploy` before deploying this
  version. The new `request_rate_limits` table supplies atomic shared limits across
  server instances; the demo never accesses it. No production database migration
  is executed automatically by the application.
- Configure readiness against `/api/health/ready` (200 or 503, database/schema
  check with `READINESS_TIMEOUT_MS`) and liveness against `/api/health/live`.
  Database outages must not trigger liveness restarts. Readiness does not check
  the external Neon Auth service.
- Login is limited to 10 attempts per account per 15 minutes; player QR entry and
  renewal to 60 requests per credential per minute; game APIs to 240 requests per
  player per minute, shared across launch-token renewals. Keys are HMAC digests,
  not stored email addresses, bearer tokens or raw IPs. Old buckets are pruned in
  bounded batches. Apply network/WAF limits as well, especially for unauthenticated
  traffic with randomized identities.
- IP limits are enabled only when `RATE_LIMIT_CLIENT_IP_HEADER` names a trusted
  proxy header (`x-real-ip`, `x-forwarded-for`, or `cf-connecting-ip`). The proxy
  must strip incoming client values, write its own client address, and prevent
  direct access to the backend. With no trusted header configured, the application
  deliberately ignores forwarded addresses. Shared school-network budgets are
  higher than per-account/player budgets.
- `OFFLINE_FLUSH_WINDOW_SECONDS=86400` permits state, results and active-time
  uploads to their **original participation** for 24 hours after session closure.
  Renewal never creates participation or grants a new bootstrap for a closed
  session. Revoked credentials and inactive players/classes/organizations remain
  denied. Records beyond the deadline stay local; they are never reassigned to a
  newer session. Reopening the same QR also attempts recovery while waiting for
  the teacher, without launching the game.
- Requests, including response-body reads, have a 15-second client timeout.
  Transient failures retry with jittered exponential backoff capped at 30 seconds;
  permanent rejections remain queued without a retry loop. Browser Web Locks
  serialize synchronization where supported; IndexedDB transactions remain the
  atomic revision-allocation mechanism. Server-wins state recovery retains the
  most recent discarded branch in IndexedDB's `stateBackups` store, rather than
  deleting the only copy. It is a local recovery aid, not a cloud backup or merge.

### Credential encryption key rotation

`PLAYER_CREDENTIAL_KEYS` is a JSON object mapping immutable key IDs to secrets
of at least 32 characters. `PLAYER_CREDENTIAL_KEY_ID` selects the encryption key.
With no key ring configured, `default` uses `APPLICATION_SECRET` for compatibility.

Before rotating, add the current secret to the ring under its existing ID (usually
`default`), add a fresh secret under a new ID, and select the new ID. Keep historical
keys available. V2 ciphertext stores the key ID; legacy V1 ciphertext is read using
the retained keys. Successfully reprinted historical credentials are re-encrypted
under the active key, without changing QR tokens, player slots or game progress.
Do not remove an old key until all rows and any restorable database backups using
it have been migrated or deliberately retired. Unreadable cards are reported as
unavailable without preventing the other cards in the class from being printed.

Restart the server after changing environment settings: validated configuration is
memoized per process. Rotating `APPLICATION_SECRET` invalidates current launch
tokens, but an active QR can renew the original participation within the flush
window. Encryption rotation does not require changing the launch-signing secret.

## Verification

### Adult account creation

In **Equipe > Criar conta ou vincular perfil**, platform administrators can create
organization administrators or professionals. Organization administrators can only
create professionals within organizations they actively administer. New accounts
receive an active profile and membership together; class assignments remain explicit.
The visible role is **Profissional**, including educators and PSE staff. Existing
`TEACHER` / `teacher` storage and authorization identifiers remain unchanged, so no
role migration is required.

Production provisioning uses the Neon Auth / Better Auth admin endpoints with an
isolated service session, never the signed-in operator's cookies. Configure
`NEON_AUTH_ADMIN_EMAIL` and `NEON_AUTH_ADMIN_PASSWORD` for a dedicated identity with
the auth provider's `admin` role in the same branch as `NEON_AUTH_BASE_URL`. Do not
give that service identity a portal profile. Keep both values in server-side secret
storage and make sure the first `ALLOWED_ORIGINS` entry is trusted by Neon Auth.
Restart after configuration changes. Without these settings, creation fails closed;
existing sign-in and profile linking continue to work.

Accounts use an administrator-supplied 12–128 character password. The portal does
not store or log passwords, send invitations, or force a first-login password
change. Share credentials through a secure channel; the provider's verification
policy still applies. All created provider identities have role `user`, even when
their portal membership is an organization administrator. Existing email addresses
are rejected rather than taken over or reset.

Creation is limited to 10 attempts per operator per 15 minutes. Provider creation
occurs outside the database transaction; authorization is rechecked before the
profile and membership are committed. If persistence fails, the new identity is
removed. Ambiguous provider responses or failed cleanup require an administrator
to inspect Neon Auth before retrying; external calls are not blindly retried.
The demo creates only session-local profiles and never stores the supplied password.

Provider API reference: [Better Auth admin plugin](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/admin.mdx).

### Checks

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
