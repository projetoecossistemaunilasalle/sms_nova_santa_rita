# V1 architecture implementation plan

Status: Ready for portal implementation; live GameMaker validation requires the
companion HTML5 bridge and state import/export work.
Source of truth: [`../current-architecture.md`](../current-architecture.md) and
[`../v1-game-integration-dossier.md`](../v1-game-integration-dossier.md).
Last reviewed: 22 September 2026.

## 1. Architecture review

The target architecture is coherent and appropriately limited for V1. It keeps adult
administration, classroom context, persistence, and reporting in the portal while
leaving gameplay meaning inside GameMaker. Numbered player slots are also a better fit
than either named student accounts or anonymous sessions because they support
cross-device state without requiring a nominal roster.

The repository is not currently an early implementation of that architecture. It is a
static visual demo plus a small amount of server-oriented access-link code. The first
work must therefore replace foundations rather than extend the current activity-link
model.

### Current gaps

| Area | Repository today | Required direction |
| --- | --- | --- |
| Runtime | One static-export build currently stands in for every environment | Two explicit targets: a mock-backed GitHub Pages demo and a Neon-backed Next.js server build |
| Adult authentication | Production selects the development bypass; the non-bypass gateway always returns no session | A real auth-provider adapter that resolves an active professional profile |
| Adult authorization | Generic capability grants tied to organization memberships | Explicit platform admin, organization admin, and teacher behavior with class assignment checks |
| Persistence | Organizations, memberships, capabilities, access links, audit events | Classes, teacher assignments, numbered players, credentials, sessions, state, results, and active time |
| Portal data | Most screens read in-memory fixtures | Server-side reads and mutations through application services |
| Player entry | Static `/atividade/[token]` demo links | Opaque player credential resolution plus current class-session context |
| Game contract | Legacy activity, attempt, and aggregate-result schemas | Player/session bootstrap, state load/save, result events, and active-time events |
| Reporting | Fixture-only aggregate cards | Class and numbered-player views backed by accepted events |
| Offline | Visual offline states only | IndexedDB cache and an idempotent synchronization queue |
| Navigation | Links, activities, and Materials remain central | Overview, access, results, classes, team, organizations, and limited audit |

### Review conclusions

1. Do not evolve `AccessLink` into a player record. A player is durable; its credential
   is replaceable. Model them separately from the start.
2. Do not preserve the activity builder as a hidden foundation. The one GameMaker
   runtime owns its internal activities, so the portal needs sessions and integration
   context rather than a content catalogue.
3. Keep static export as the GitHub Pages demo, but do not make production features
   conform to its limitations. The real application needs a separate server build for
   authenticated and player APIs.
4. Treat the existing portal components as visual assets, not as domain boundaries.
   Reuse their layout and styles where useful, but replace fixture-shaped service APIs.
5. Keep offline work until online load/save and event ingestion are stable. Otherwise
   the queue will encode a contract that is still changing.

## 2. Working technical decisions

These decisions keep implementation moving without adding a generalized platform.

### Runtime modes

- `demo` is a static export deployed to GitHub Pages. It uses seeded data and a small
  browser-side mock backend so organization, class, player, session, state, and report
  workflows can be demonstrated without Neon or secrets.
- `server` is the real application build. It uses the Next.js runtime, Neon Postgres,
  Prisma, Neon Auth, Server Actions, and Route Handlers.
- Select the target with an explicit build setting rather than `NODE_ENV`. GitHub Pages
  is a production build of the demo and must not accidentally select production auth
  or persistence behavior.
- Demo and server code share domain DTOs, validation schemas, and presentational
  components. They have separate composition roots: demo adapters use browser/local
  state, while server adapters use Neon and Prisma.
- Do not scatter `if (demo)` checks through domain services and components. If the
  production route tree prevents a clean static export, give the demo a dedicated
  static entry rather than weakening server behavior.

### Adult roles

- `ProfessionalProfile` represents the adult identity resolved through Neon Auth.
- A platform-level role marks platform administrators without requiring a fake
  organization membership.
- `OrganizationMembership` has one V1 role: `ORGANIZATION_ADMIN` or `TEACHER`.
- `TeacherAssignment` connects an active teacher membership to a class.
- Services enforce role and organization scope. Navigation only reflects those
  decisions; hiding a link is not authorization.
- Keep the existing capability service only while old routes are being replaced. Do
  not build a second permanent permission model alongside V1 roles.

### Organization and class scope

- Use one `Organization` as the V1 school or operating unit. Do not add a generic
  organization tree until a real hierarchy is required.
- Organization admins create classes and assign teachers.
- An organization admin may choose the initial player count. A teacher may add more
  numbered slots to an assigned class but cannot renumber or recycle used slots.

### Player and credential lifecycle

- `PlayerSlot.id` is the durable identity; `number` is only unique within one class.
- Creating slots allocates monotonically increasing numbers for that class.
- `PlayerCredential` stores a hash of an opaque token. Rotation revokes the previous
  credential without changing the player or its history.
- QR codes contain a player-entry URL. The entry handler exchanges the credential for
  a short-lived player launch session so the long-lived token is not passed into the
  game runtime.

### Class sessions

- A class may have at most one active `GameSession` in V1.
- The teacher starts, resumes, or ends that session from the class screen.
- Scanning a player QR resolves that player's class and its active session. If no
  session is active, the player sees a waiting state rather than creating a session.
- `Participation` is created when a valid player actually enters an active session.

### Game state and events

- Keep one current `GameState` row per player, containing a protocol version, an
  opaque JSON payload, and an integer revision.
- Saving state uses optimistic revision checks. A stale update receives a conflict
  response; the portal does not attempt to merge game-owned fields.
- Results and active-time increments are append-only events with a client-generated
  event ID for retry-safe ingestion.
- Result payload meaning stays opaque to the portal except for a small agreed set of
  reportable fields.
- Active time is sent in small increments while the game reports meaningful activity.
  Do not infer it only from an open browser tab.

### Next.js boundaries

- Server Components read portal data directly through server-side query/services.
- Server Actions handle simple adult form mutations.
- Versioned Route Handlers under `/api/v1` serve GameMaker and synchronization calls.
- Application services own authorization and transactions so neither pages nor Route
  Handlers become the only enforcement boundary.
- Use the Node.js runtime for database, auth, and token operations.

### Patterns used deliberately

- Ports and adapters isolate Neon Auth, Prisma, token generation, GameMaker transport,
  and demo/browser persistence. Do not wrap every internal helper or simple query.
- Application services represent complete use cases such as allocating player slots,
  starting a session, bootstrapping a player, and accepting gameplay events. They own
  authorization and transaction boundaries.
- Session and credential lifecycles use explicit enum transition functions instead of
  inheritance-heavy state objects.
- Game-state writes use optimistic concurrency. Result and active-time ingestion use
  the idempotent-consumer pattern with client event IDs.
- A GameMaker anti-corruption layer translates versioned external payloads into portal
  commands and DTOs so GML-specific field names do not spread through the application.
- Offline synchronization uses a small typed command queue, not a generic command bus
  or event framework.

## 3. Target data shape

The first production schema should contain these records:

```text
ProfessionalProfile
  platformRole?
  OrganizationMembership (role: organization admin | teacher)
    TeacherAssignment -> ClassGroup

Organization
  ClassGroup
    PlayerSlot
      PlayerCredential
      GameState
    GameSession
      Participation -> PlayerSlot
        ResultEvent
        ActiveTimeEvent
```

Required database constraints are deliberately small:

- unique membership per professional and organization;
- unique visible player number per class;
- unique credential hash;
- one current game-state row per player;
- unique participation per player and session;
- unique client event ID per event stream;
- at most one active session per class;
- no hard deletion of players with state or participation.

`AccessLink`, the legacy activity contracts, and Materials do not need an immediate
destructive migration. Stop new V1 code from depending on them, then remove them after
the replacement flow is working.

## 4. Versioned integration surface

V1 needs only four logical portal operations:

| Operation | Purpose |
| --- | --- |
| Player bootstrap | Resolve the short-lived launch session into player, class, session, protocol version, and current state |
| State save | Store a new opaque game-state payload against the expected revision |
| Result ingestion | Append one completed result event using a client event ID |
| Active-time ingestion | Append one or more active-time increments using client event IDs |

Keep JSON Schemas in `contracts/schemas/v1/` and validate the same payload shape at the
Route Handler boundary. The browser host and GameMaker should exchange only this
contract, not Prisma records or adult session data.

### Confirmed from the current GameMaker runtime

- Per-mission runtime state is stored under `global.mission_system.states` as
  `{ status, stage_id, objective, checkpoints, data }`.
- Canonical progression is separate in `global.progression` and includes coins, stars,
  completed challenges, and granted rewards. A persistent save cannot contain mission
  state alone.
- `global.activity_flow` is an in-memory room-transition contract containing
  `{ active, request, result, sequence }`.
- Activity context already carries attempt/activity/mechanic identifiers, attempt
  sequence, seed, difficulty, and flat parameters.
- Activity results are `{ estado, duracao_ms, metricas }`; supported states are
  `sucesso`, `falha`, `cancelado`, `tempo_esgotado`, and `erro_inicializacao`.
- `activity_flow.sequence` rejects a late or duplicate result for one active in-memory
  request. It must not be reused as the server `GameState.revision`, which protects a
  complete persisted player snapshot across devices.
- The game currently preserves state across room changes but has no save/load
  infrastructure across application restarts.
- The Voice Lab revision policy belongs to a separate content-import pipeline and is
  not automatically the correct policy for player game-state synchronization.

### Adopted V1 GameMaker decisions

- The persisted payload is a complete GameMaker-owned snapshot with its own
  `schema_version` and `content_version`. V1 contains mission states and canonical
  progression. It excludes derived objectives, mission definitions, room/object
  references, activity-flow state, minigame internals, UI state, and raw player
  coordinates.
- The initial state payload limit is 64 KiB. The portal treats valid payload contents
  as opaque and stores its own optimistic-concurrency `revision` beside them.
- The portal validates the transport envelope, JSON shape, size, and supported
  versions. GameMaker remains responsible for semantic invariants such as agreement
  between mission completion, reward ledgers, and progression totals.
- GameMaker provides narrow reset, validate, apply, and export operations. Import is
  atomic and occurs only at a loading/recovery boundary after mission definitions are
  registered. Invalid authoritative state blocks play rather than silently resetting
  progress.
- The browser integration uses a versioned JavaScript bridge. GameMaker owns state and
  gameplay semantics; the portal host owns credentials, IndexedDB, connectivity,
  network requests, retry, and server acknowledgements.
- A stale server revision is not merged. The host preserves independent result and
  active-time events, reloads the authoritative snapshot, and GameMaker applies it at
  a safe recovery boundary before returning to the school entry.
- Exact world position is not persisted in V1. A restored player starts at the school
  entry and the game reconstructs world presentation from mission state.
- The host allocates globally unique `client_event_id` values when durably enqueueing
  result and active-time messages. GameMaker retains one local request ID until it
  receives the IndexedDB durability acknowledgement so retries represent the same
  logical event.
- Meaningful active time is measured by GameMaker and delivered by the host. V1 uses a
  30-second engagement lease, pauses on explicit pause or focus/visibility loss, and
  flushes at most 30 seconds per event.
- A browser refresh during a minigame does not synthesize a `cancelado` result in V1.
  The last durable state resumes at the activity stage and a later launch is a new
  attempt.
- First reports show raw, supported metrics without inventing correctness: matched
  pairs and moves for Lia, block/miss/exchange/local-score values for ping-pong, and
  classified-situation count for the comfort activity.

The GameMaker repository still needs companion implementation for the HTML5 target,
bridge, snapshot lifecycle, active-time signals, stable attempt identity, and recovery
UI. Those tasks gate testing with the real game, but they do not block portal database,
API, host-queue, or demo-adapter development against the versioned schemas.

## 5. Delivery slices

### Slice 0: Runtime foundation

Outcome: GitHub Pages remains a usable mock-backed demo, and the server build can
authenticate an adult and read the database.

- Add explicit `demo` and `server` build targets. Preserve the GitHub Pages workflow
  for the demo and stop deriving application behavior only from `NODE_ENV`.
- Put demo fixtures and browser mutations behind a demo composition root that follows
  the same DTOs and validation rules as the server use cases.
- Restore liveness/readiness handlers for the server target and prepare it for a deploy
  target capable of running Next.js.
- Implement the Neon Auth gateway and remove the server build's development bypass.
- Add a request-level `requireActor` helper and role-aware authorization service.
- Add the new Prisma enums and core organization/class/role tables in a migration.
- Prove the slice with one seeded platform admin creating an organization, an
  organization admin, a class, and a teacher assignment.

Minimum verification: the GitHub Pages build still exports, the server build starts,
the migration applies to an empty database, and one role-denial test covers each of the
three adult levels.

### Slice 1: Organizations and classes

Status: Complete on 22 September 2026.

Outcome: administrators prepare the structure teachers will use.

- Replace organization, team, and class fixtures with database queries.
- Implement organization creation/status, organization membership, class creation,
  and teacher assignment.
- Make navigation role-aware and keep teachers limited to assigned classes.
- Retire the old module/game admin redirects rather than rebuilding those surfaces.
- Remove Materials from navigation and the dashboard. The old routes may remain
  unreachable until final cleanup.
- Update the demo adapter with representative organization, class, and assignment data
  so the same workflow remains explorable on GitHub Pages.

Minimum verification: perform the full setup through the UI and confirm a teacher sees
only an assigned class.

Implemented in this slice:

- application services own organization, membership, class, and teacher-assignment
  authorization, validation, scope checks, status invariants, and transaction
  boundaries;
- Prisma readers/stores provide the server persistence adapter without exposing raw
  records to Client Components;
- Server Actions resolve the authenticated profile, validate with Zod, call the
  services, and revalidate the affected routes;
- the static demo uses the same service and DTO contracts over browser-persisted mock
  state, with seeded platform-admin, organization-admin, and teacher profiles;
- the portal shell derives its role, navigation, and accessible scope from adult V1
  data; Materials and obsolete module/game administration are absent from navigation;
- the provisioning UI binds only existing `ProfessionalProfile` records. Credential
  creation and invitation remain with Neon Auth because the installed package does
  not provide a documented server-side provisioning workflow used by this portal.

### Slice 2: Numbered players and class sessions

Status: Complete on 22 September 2026.

Outcome: a teacher can prepare classroom access and a child can reach a waiting or
active session with one QR scan.

- Add `PlayerSlot`, `PlayerCredential`, `GameSession`, and `Participation`.
- Add bulk slot creation with monotonic numbering and printable QR output.
- Add single-player credential rotation and reprint.
- Add teacher controls for starting and ending the one active class session.
- Replace `/atividade/[token]` with the final player-entry route and exchange a valid
  credential for a short-lived launch session.
- Show clear invalid, revoked, no-active-session, and ready states.
- Mirror the lifecycle in the demo adapter without generating credentials that could
  be mistaken for server-issued production credentials.

Minimum verification: create 25 slots, scan one QR, rotate it, reject the old QR, and
enter an active session with the new QR.

Implemented in this slice:

- durable class-scoped player slots use a transactional allocation watermark so
  disabled or historical numbers are never recycled;
- 256-bit opaque credentials are stored only as SHA-256 hashes in production,
  rotated independently from player history, and rendered as printable QR cards;
- one partial unique index limits each class to one active session, while one unique
  participation key makes repeated player entry idempotent;
- application services authorize only active organization administrators and active
  teachers assigned to the class, including organization and class status checks;
- `/jogar/?cred=...` is a fixed static shell: the server resolves hashed credentials
  and issues a five-minute signed launch token, while the demo resolves clearly
  prefixed non-production credentials from browser state;
- invalid, revoked, inactive, waiting, and ready entry states are visible, and the
  adult UI supports allocation, credential replacement/printing, and session start/end.

See [`slice-02-player-access-decisions.md`](slice-02-player-access-decisions.md) for
the exact lifecycle and static-export decisions.

### Slice 3: Game bootstrap and cross-device state

Outcome: the real GameMaker runtime loads and saves the same player's state from two
supported devices.

- Encode the agreed V1 bootstrap, bridge-message, and state schemas in this repository.
- Add bootstrap and state-save Route Handlers plus application services.
- Add `GameState` with protocol version, opaque payload, revision, and timestamps.
- Replace the placeholder game panel with the configured GameMaker launch/bridge.
- Handle unsupported protocol versions and stale revisions with simple recoverable
  game states.
- Build the host bridge and deterministic demo adapter first, then validate the same
  messages against the actual GameMaker HTML5 build when its companion work lands.
- Add a deterministic demo GameMaker adapter for GitHub Pages after the real contract
  schemas are fixed.

Minimum verification: Device A saves state, Device B loads it, and a stale save cannot
silently overwrite the newer revision.

Contract foundation completed on 22 September 2026:

- the V1 Zod schemas, matching JSON Schemas, parsers, and deterministic valid/invalid
  fixtures are checked in;
- the contract freezes content/version ownership, state revision behavior, host event
  IDs, bridge request IDs, result metrics, active-time limits, acknowledgements, and
  typed errors;
- Route Handlers, host persistence, and the live GameMaker bridge remain to be built.

### Slice 4: Results and active time

Outcome: a teacher can see useful class and player participation after real play.

- Finalize the first result fields and active-time increment contract.
- Add retry-safe result and active-time ingestion.
- Build a top-level results view with class totals and a numbered-player table.
- Add a player detail view showing sessions, active time, and the agreed result fields.
- Replace fixture dashboard totals with small operational summaries from the same
  accepted events.

Minimum verification: retrying an event does not double count it, and the corresponding
class and player views update after one real game session.

### Slice 5: Offline continuation and rollout

Outcome: a previously synchronized player can continue through a short connection loss
and later synchronize.

- Cache the last accepted bootstrap/state in IndexedDB.
- Queue state updates, results, and active-time increments with their event IDs.
- Retry on reconnection in order, stopping on a state conflict that needs GameMaker
  resolution while still allowing independent event uploads.
- Add a compact synchronization status to the player host page.
- Remove remaining production links to legacy activities and Materials.
- Validate QR scanning, game loading, reconnection, and reporting on the target school
  tablet/browser combination.

Minimum verification: load online once, play through a temporary disconnect, reconnect,
and confirm the final state and events from another device.

## 6. First implementation backlog

The remaining work should proceed in this order. Runtime, Neon Auth, adult roles,
organization/class administration, and the V1 transport contracts are already in
place.

1. Implement bootstrap and state persistence as the first real portal-to-game slice.
2. Connect the browser host to the companion GameMaker HTML5 bridge.

Do not begin offline synchronization, advanced reporting, generalized permissions, or
legacy cleanup before item 4 works end to end.

## 7. Deliberate non-goals

This plan does not add named student profiles, parent accounts, cross-year migration,
multiple games, a configurable activity builder, Materials, complex organization
hierarchies, advanced analytics, or first-ever offline access. It also avoids making
large test and compliance programs prerequisites for functional V1 delivery. Tests are
limited to role boundaries, durable-state conflicts, idempotent event ingestion, and
the critical end-to-end workflow.
