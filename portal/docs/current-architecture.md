# Current product architecture

Status: Current source of truth for product boundaries and web surfaces.  
Last aligned: 10 October 2026.

For the implementation-ready plan, see
[refactor-dossier/IMPLEMENTATION-READY.md](refactor-dossier/IMPLEMENTATION-READY.md).
The [v1-game-integration-dossier.md](v1-game-integration-dossier.md) is retained as a
historical planning record.

## Product boundary

Missões do Caramelito has three connected runtime surfaces:

1. the authenticated professional/admin portal;
2. the player entry/context-resolution surface;
3. the maintained external Phaser runtime (`Heroes_Trial/web-poc`).

There is no marketing or institutional landing page. The root route redirects to the professional sign-in surface.

The portal and backend own organizational context, adult access, classes, numbered player access, persistence services, session context, result ingestion, and reporting.

The maintained Phaser game owns the single gameplay experience, including activities/minigames, gameplay rules, world behavior, progression meaning, and game-specific state semantics. The portal selects content, never authors it. V2 imports the game's content manifest and freezes a resolved content policy and manifest reference per session; later defaults or manifest imports cannot change that session's bootstrap policy.

## Adult authorization model

V1 explicitly uses three adult levels.

| Level | Role | Primary responsibilities |
| --- | --- | --- |
| 1 | Platform administrator | Organizations, organization administrators, platform oversight |
| 2 | Organization administrator | Organization staff, classes, teacher assignment, structural setup |
| 3 | Teacher | Assigned classes, player-slot preparation, classroom sessions, results |

Teachers should not need to create organizations, maintain nominal student rosters, or administer child passwords.

## Player model

The old anonymous-session-only model is no longer sufficient for V1.

A class can contain numbered player slots, for example `Player 01` through `Player 25`.

A numbered player:

- has an internal stable identifier separate from the visible class number;
- may own persistent game state;
- may receive an opaque QR credential;
- may accumulate session participation, active-play time, and results;
- does not require a stored child name, email, or password.

The recommended classroom convention is to align visible player numbers with attendance-list order outside the portal.

The visible number is scoped to the class and must not be treated as a global student identity.

## Player credential model

Player QR codes are bearer credentials backed by opaque high-entropy tokens.

Required properties:

- unguessable;
- not publicly enumerable;
- rotatable without changing the underlying player;
- usable from different supported tablets;
- distinct from adult authentication.

Possession of a QR credential does not prove the physical identity of the user. V1 accepts this tradeoff to keep classroom access fast.

Authorized adults can reopen and print the active QR codes for their class without
rotating credentials or invalidating printed cards. Tokens are looked up by their
SHA-256 digest and retained as authenticated AES-256-GCM ciphertext, using a
domain-separated key derived from `APPLICATION_SECRET`. Keep this secret durable
and backed up: changing or losing it makes stored QR codes unrecoverable. Revoked
credentials have their ciphertext cleared. Raw tokens are returned only by
authenticated, class-scoped issuance and display actions, never in workflow reads.

Apply the `20261011000000_reprint_player_credentials` migration before deploying
this feature. Existing hash-only credentials remain valid but cannot be recovered;
the portal explicitly lists these players and never silently rotates their codes.
An adult may choose an individual, confirmed replacement to make an old slot's
new code recoverable. Mock workspaces use a private, session-lived encryption key
and retain their seeded and newly issued codes across page reloads in that session.

## Class and session model

Classes are created by organization administrators and assigned to teachers.

A class is not a conventional roster.

Player identity and session context are separate:

```text
Class
  +-- Player 07
  +-- Session A
  +-- Session B

Player 07 + Session B = Participation
```

Preferred V1 flow:

1. teacher starts or selects the current class session/context;
2. child scans their player QR;
3. backend resolves player plus class/session context;
4. Phaser receives the required context and frozen session policy through `/api/v2/player/bootstrap`.

The final entry sequence may be adjusted to fit the Phaser contract, but the child must not be forced through a conventional username/password login.

## Game-state persistence

Cross-device continuation is a V1 requirement.

The authoritative game state must be persisted server-side. Browser storage may cache synchronized state for offline operation but is not the source of truth.

The Phaser game owns the state schema semantics. The portal/backend provides durable storage and synchronization through a versioned contract.

State can include game-owned concepts such as progression, cosmetics, currencies, rewards, checkpoints, or other values defined by the Phaser game.

## Results and active time

Results are no longer aggregate-only.

V1 supports:

- class summaries;
- per-numbered-player results;
- player/session participation;
- active-play time.

Active-play time should track meaningful gameplay rather than simply elapsed time with a page open.

## Offline architecture

Temporary offline operation is expected after an initial synchronized load.

Client persistence:

- Portal mock state lives only in session-isolated server memory, not localStorage.
- IndexedDB for structured cached state, queued events, pending metrics, and larger offline data (implemented in `src/runtime/offline/`).

Conceptual flow:

```text
online: server state -> game -> server updates
offline: cached state -> game -> local queue
reconnected: local queue -> synchronization -> server
```

A first-ever access on an unseen device while fully offline is not a V1 guarantee.

The integration must define a conflict strategy for game state updated from multiple devices or offline branches.

## Conceptual data model

The implemented Prisma schema matches these concepts. The exact tables, columns,
indexes, and database rules are documented in
[schemas/database-model.md](schemas/database-model.md). The migration history is a
single post-refactor baseline: `prisma/migrations/0_init` creates the entire
surviving schema in one step and replaced the earlier incremental migrations.

Concepts:

```text
Organization
  +-- OrganizationMembership
  +-- ClassGroup
        +-- TeacherAssignment
        +-- PlayerSlot
        |     +-- PlayerCredential
        |     +-- GameState
        +-- GameSession
              +-- Participation
                    +-- Result
                    +-- ActiveTimeEvent
```

Important invariants:

- `PlayerSlot` is not a full student profile;
- visible player number is class-scoped;
- internal player ID is separate from visible number;
- credentials rotate independently from player state;
- game state is not tied to a browser/device;
- session participation is separate from persistent world state;
- existing player slots are not silently renumbered after state/results exist.

## Route boundary

| Route | Audience | Current behavior |
| --- | --- | --- |
| `/` | Anyone | Redirects to `/entrar`; no marketing landing page |
| `/entrar`, `/entrar/recuperar` | Adults | Professional/admin sign-in (Neon Auth in server mode, demonstration entry in demo mode) and a recovery placeholder |
| `/portal` | Authenticated adults | Overview plus layout, loading, and state screens (`ajuda`, `sem-acesso`, `sessao-expirada`) |
| `/portal/admin/organizacoes`, `/portal/admin/organizacoes/[id]` | Platform and organization administrators | Organizations and their structure |
| `/portal/admin/equipe` | Administrators | Adult profiles and memberships |
| `/portal/turmas`, `/portal/turmas/[id]` | Organization admins and teachers | Classes; the class detail page hosts the session control, numbered players, and QR credentials |
| `/portal/resultados`, `/portal/resultados/[classGroupId]`, `/portal/resultados/[classGroupId]/players/[playerSlotId]` | Authorized adults | Class and per-player reports |
| `/jogar` | Players | Credential entry through the `?cred=` parameter carried by the printed QR, then handoff to the Phaser client |
| `/api/v2/player/{bootstrap,state,results,active-time}` | Browser game host | V2 transport contract endpoints |

There is no `/health` route; the former liveness and readiness handlers were
removed and have not been reintroduced.

## Materials

Materials is explicitly deferred beyond V1.

The Materials navigation entry has been removed from the portal, and no V1
backend, authorization, or acceptance criterion depends on Materials.

## Phaser contract

The V2 transport contract (JSON Schemas in
[`../contracts/schemas/v2`](../contracts/schemas/v2) with runtime Zod authority and
parity fixtures; protocol rules in
[`../contracts/schemas/README.md`](../contracts/schemas/README.md)) covers at least:

### Backend to Phaser

- resolved player context;
- class/session context;
- current game state or state reference;
- schema/protocol version.

### Phaser to backend

- updated persistent game state;
- result events;
- active-time events or resumable usage metrics;
- synchronization metadata needed for offline recovery.

The portal must not create a second model for minigames, progression rules, cosmetics, rewards, or gameplay sequencing.

## Privacy and security invariants

- Adult portal routes require authentication and server-side authorization.
- Child/player access does not require conventional account registration.
- No child name, email, password, date of birth, or parent account is required for V1.
- Player credentials are opaque, unguessable, and excluded from public discovery.
- Player state is persistent and therefore must be handled as a durable record even when no name is stored.
- The product should describe the model as data-minimized, not automatically fully anonymous.
- Authorization must enforce organization/class boundaries for adult result access.
- Phaser game URLs and integration origins must remain allowlisted/configured.

## Cross-year continuity

Automatic player migration between school years or classes is out of V1 scope.

V1 must not build:

- automatic promotion;
- longitudinal school identity;
- automatic mapping from one class's player number to another;
- nominal student history across years.

The data model should avoid blocking a future migration feature, but the migration workflow is intentionally deferred.

## Runtime targets and entries

One server application supports two infrastructure modes:

- **Real infrastructure** (`npm run dev`, `npm run build:server`, `npm run start`):
  Prisma/Neon Postgres persistence and Neon Auth.
- **Local mock** (`npm run dev:demo`, `npm run build:demo`, `npm run start:demo`):
  the same server routes, readers, actions, screens, authorization and application
  services, backed by adapters under `src/server/mock/`. Both builds are standalone;
  GitHub Pages/static export is no longer supported.

Generated `src/runtime/actions.ts` and `src/runtime/readers.ts` re-export the same
tracked `*.shared.ts` barrels in both modes. Infrastructure selection happens in
`src/server/services/` and the auth gateway, not in portal components. Mock-only
profile switching and reset controls are environment tooling, not product workflows.
Adult identity creation is not simulated as a portal feature: fixture profiles are
already provisioned, and the real membership actions grant their access.

Each mock sign-in creates an opaque HttpOnly, SameSite=Lax cookie identifying a
private in-memory workspace. It survives reloads but expires after eight hours;
sign-out, explicit reset and process restart discard changes. The registry admits
at most 128 sessions and prunes expired entries. All mock adapters share a per-workspace
transaction queue with rollback and atomic snapshot publication. No real database or
auth provider is contacted in mock mode. Defaults bind the mock to loopback; public
staging deployment would require revisiting session storage, HTTPS and capacity.
Mock reports use the live workspace and the production report authorization service;
activity scores remain empty because game ingestion is outside this portal refactor.

Application services are assembled by the four surviving containers under
`src/server/services/` (`adult-portal-container.ts`, `game-state-container.ts`,
`game-event-container.ts`, `player-access-container.ts`); the service
implementations live under `src/application/` (`adult-portal`, `player-access`,
`game-state`, `game-events`, plus the shared `authorization` actor). The former
`service-container.ts` was deleted with the access-link generation.

## Runtime configuration

The server target validates `DATABASE_URL`, `NEON_AUTH_BASE_URL`,
`NEON_AUTH_COOKIE_SECRET`, and `APPLICATION_SECRET` at configuration load.
Additional variables cover `DIRECT_URL` (Prisma CLI migrations),
`ALLOWED_ORIGINS` (browser origins accepted by cookie-authenticated routes),
`GAME_CLIENT_URL` (the browser Phaser build URL), and the opt-in
`AUTH_DEV_BYPASS` development flag, which is rejected in a production server
runtime. `.env.example` documents example values; final production values are
set at deployment, and integration origins remain allowlisted rather than
free-form.

## Implementation status

The server target now has adult role and class administration, numbered player
slots, rotatable QR credentials, class sessions, a versioned player bootstrap,
revisioned server game state, retry-safe result and active-time ingestion, and
class/player reports. The static demo preserves the same entry workflow with a
clearly synthetic game adapter. The browser host uses a versioned bridge and an
IndexedDB queue; the server remains the authoritative state source.

These implementations are not yet a production-verified V1. The single baseline
migration (`prisma/migrations/0_init`) has not been applied to a real Neon
environment; `.env.example` ships example hosts. The maintained Phaser HTML5 build,
two-device state continuity, reconnection, and school-tablet QR flow still need
end-to-end validation. See the implementation roadmap for slice-level status.

Older Prisma models, JSON contracts, and implementation plans written for previous
product assumptions remain migration research unless explicitly aligned with the
V1 dossier and this document.
