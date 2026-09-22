# Current product architecture

Status: Current source of truth for product boundaries and web surfaces.  
Last aligned: 22 September 2026.

For detailed V1 requirements and implementation direction, see [v1-game-integration-dossier.md](v1-game-integration-dossier.md).

## Product boundary

Missões do Caramelito has three connected runtime surfaces:

1. the authenticated professional/admin portal;
2. the player entry/context-resolution surface;
3. the existing external GameMaker runtime.

There is no marketing or institutional landing page. The root route redirects to the professional sign-in surface.

The portal and backend own organizational context, adult access, classes, numbered player access, persistence services, session context, result ingestion, and reporting.

The existing GameMaker project owns the single gameplay experience, including activities/minigames, gameplay rules, world behavior, progression meaning, and game-specific state semantics.

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
4. GameMaker receives the required context.

The final entry sequence may be adjusted to fit the GameMaker contract, but the child must not be forced through a conventional username/password login.

## Game-state persistence

Cross-device continuation is a V1 requirement.

The authoritative game state must be persisted server-side. Browser storage may cache synchronized state for offline operation but is not the source of truth.

GameMaker owns the state schema semantics. The portal/backend provides durable storage and synchronization through a versioned contract.

State can include game-owned concepts such as progression, cosmetics, currencies, rewards, checkpoints, or other values defined by GameMaker.

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

Recommended client persistence:

- `localStorage` for small simple values where useful;
- IndexedDB for structured cached state, queued events, pending metrics, and larger offline data.

Conceptual flow:

```text
online: server state -> game -> server updates
offline: cached state -> game -> local queue
reconnected: local queue -> synchronization -> server
```

A first-ever access on an unseen device while fully offline is not a V1 guarantee.

The integration must define a conflict strategy for game state updated from multiple devices or offline branches.

## Conceptual data model

The current Prisma schema predates the player-slot direction and must be reconciled before production implementation.

Target concepts:

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

The existing route tree still represents the current demo implementation, not the final V1 player-entry design.

| Route | Audience | Current / target behavior |
| --- | --- | --- |
| `/` | Anyone | Redirects to `/entrar`; no marketing landing page |
| `/entrar` | Adults | Professional/admin sign-in |
| `/portal/**` | Authenticated adults | Operational portal, authorized by role and organization |
| existing `/atividade/[token]` routes | Players | Legacy/demo session-link entry surface to be reconciled with player QR + session context |
| `/health/live`, `/health/ready` | Operations | Liveness and readiness |

Do not treat the current `/atividade/[token]` route shape as the final V1 identity model. The final public/player route may change when player credentials and session context are implemented.

## Materials

Materials is explicitly deferred beyond V1.

The production V1 experience should remove or hide the Materials navigation entry.

Existing demo or research code may remain temporarily if it does not block delivery, but no V1 backend, authorization, or acceptance criterion should depend on Materials.

## GameMaker contract

The versioned contract should cover at least:

### Backend to GameMaker

- resolved player context;
- class/session context;
- current game state or state reference;
- schema/protocol version.

### GameMaker to backend

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
- GameMaker URLs and integration origins must remain allowlisted/configured.

## Cross-year continuity

Automatic player migration between school years or classes is out of V1 scope.

V1 must not build:

- automatic promotion;
- longitudinal school identity;
- automatic mapping from one class's player number to another;
- nominal student history across years.

The data model should avoid blocking a future migration feature, but the migration workflow is intentionally deferred.

## Runtime configuration

Existing runtime variables remain relevant where their implementation survives the static demo transition.

Production configuration will need to cover:

- GameMaker deployment URL/origin;
- database connectivity;
- adult authentication;
- application signing/secrets;
- player credential signing/token security where applicable;
- integration/synchronization configuration.

Exact variable names should be finalized during implementation rather than inferred from the demo deployment.

## Implementation status

The repository currently contains a navigable static/demo portal and public-link UI backed by demonstration data.

Production implementation still requires substantial reconciliation, including:

- final adult authentication/authorization;
- class persistence and teacher assignment;
- numbered player-slot persistence;
- player QR credential lifecycle;
- GameMaker player/session/state contract;
- server-side game-state persistence;
- result ingestion;
- active-time ingestion;
- teacher-facing reporting;
- offline queue/synchronization behavior;
- production route design for player entry;
- production removal/hiding of Materials.

Older Prisma models, JSON contracts, and implementation plans were written for previous product assumptions. They are migration research until aligned with the V1 dossier and this document.
