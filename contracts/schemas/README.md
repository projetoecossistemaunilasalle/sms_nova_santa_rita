# V1 portal and GameMaker contracts

This directory is the transport contract shared by `/api/v1` Route Handlers,
the browser host, the GitHub Pages demo adapter, and GameMaker fixtures. Zod schemas in
`src/contracts/v1` are the runtime authority. These JSON Schemas are generated from the
same Zod shapes and parity-tested with every committed fixture. All message objects are
closed with `additionalProperties: false`; only mission-owned `data`, presence sets,
and the documented activity parameters remain open at their stated boundary.

## Contract index

- [`v1/`](v1) — the JSON Schemas generated from the Zod shapes in
  [`src/contracts/v1`](../../src/contracts/v1): player bootstrap
  (`player-bootstrap`, `new-player-bootstrap`, `bootstrap-applied`), game host
  session (`game-ready`, `game-state`, `host-visibility`), state synchronization
  (`state-save-request`, `state-save-success`, `state-save-conflict`), results
  (`result-submission`, `result-event`, `result-acknowledgement`), active time
  (`active-time-submission`, `active-time-batch`,
  `active-time-acknowledgement`), and the `local-durability-acknowledgement` and
  `protocol-error` envelopes.
- [`../fixtures/v1`](../fixtures/v1) — the `valid/` and `invalid/` fixture sets
  parity-tested against those schemas.

## Version and ownership boundaries

- `protocol_version` versions the browser-host/GameMaker message protocol. V1 accepts
  only `1`; other versions must produce `PROTOCOL_VERSION_UNSUPPORTED` rather than a
  best-effort parse.
- `state.schema_version` versions the GameMaker save payload. V1 accepts only `1`;
  unknown versions must not be reset or overwritten.
- `content_version` is a non-empty GameMaker build/content vocabulary identifier. The
  canonical initial value is `heroes_trial_school_v1`, owned by GameMaker as a compiled
  build constant. GameMaker changes it only when persisted mission, stage, checkpoint,
  reward, or other durable identifiers become incompatible. Cosmetic changes, copy
  changes, and compatible behavior fixes do not change it. A new value requires an
  explicit GameMaker migration or an update-required response; the portal never
  rewrites game state. The V1 shape remains capable of carrying future documented
  content versions.
- Server `revision` is optimistic-concurrency metadata beside state. It is never part
  of `GameStateV1` and is unrelated to GameMaker's transient
  `activity_flow.sequence` or context `sequencia_tentativa`.
- GameMaker owns missions, progression meaning, result construction, activity
  context, active-time measurement, and semantic consistency between mission status,
  checkpoints, rewards, challenges, and totals.
- The portal owns opaque player/session identifiers, server revisions, persistence,
  validation at transport boundaries, event deduplication, connectivity signals, and
  acknowledgements. It validates state shape, supported versions, and the 65,536-byte
  serialized UTF-8 limit, but does not repair or reinterpret game state.

State deliberately excludes objectives, mission definitions, room/object references,
`activity_flow`, UI/presenter state, minigame internals, and player coordinates. A
transport may carry `state: null` only in the explicit `new_player: true` bootstrap
variant. A saved state is never null.

## Delivery and idempotency

State saves use `request_id` for bridge correlation and `expected_revision` for
optimistic concurrency. A conflict returns the authoritative complete state and its
server revision; consumers must reload it rather than merge snapshots field by field.
The host keeps independent result and active-time records queued through this recovery.

Results and active-time increments are append-only. GameMaker assigns each logical
bridge delivery a stable `request_id` and retries that ID until local durability is
acknowledged. On the first delivery, the browser host atomically allocates a globally
unique `client_event_id` and persists the request-to-event mapping with the IndexedDB
queue record. Duplicate delivery of the same request maps to the same event ID.
`client_event_id` is the server idempotency key: retries reuse it, while a genuinely new
result or time interval receives a new ID. The `*-submission` schemas describe the
pre-enqueue GameMaker message; `result-event` and `active-time-batch` describe the
host-enriched durable/server message. The local-durability acknowledgement returns the
request-to-event mapping. It means the host committed the record locally, not that the
server accepted it.

Before activity launch, the host allocates globally unique `context.id_tentativa`
using a browser UUID/ULID-capable API, including while temporarily offline. V1 accepts
UUID or ULID values. `sequencia_tentativa` and `numero_tentativa_atividade` remain
positive informational counters required by the runtime; neither is database identity,
a deduplication key, nor globally reliable cross-device ordering. Reports order/count
accepted events, and result ingestion deduplicates by `client_event_id`.

Unknown activity IDs and unknown result metrics are rejected in V1. The three known
metric sets are exact, and the nested runtime result remains
`{ estado, duracao_ms, metricas }`. No correctness or choice fields are inferred.

## Consumption

Route Handlers and demo adapters should import narrow `parse*V1` or `safeParse*V1`
functions from `src/contracts/v1`, then map the inferred DTO into application commands.
They must not expose Prisma models or duplicate schema rules. Browser/GameMaker
implementations that cannot run Zod should validate against the matching JSON Schema
and additionally enforce the documented `x-state-max-serialized-utf8-bytes` and
`x-uniqueBy` annotations.

Structural validation is intentionally not gameplay validation. Stage IDs resolving
against the current catalog, complete-status/reward agreement, authored dialogue
bounds, reward-ledger validity, and totals derived from rewards remain GameMaker-owned
semantic checks performed before export and during atomic apply.

JSON Schema validators must register both `uuid` and `ulid` string formats. Ajv 8
does not supply these formats by default; `ajv-formats` supplies UUID but ULID needs
a custom format validator. Do not disable format validation to suppress warnings.
The contract tests register both formats, in addition to the generated patterns.

## Frozen V1 naming

The checked-in ready, acknowledgement, local-durability, and typed-error field names
are canonical V1. An incompatible rename requires protocol version 2; implementations
must not silently change these V1 envelopes.

## V2 Contracts

[`v2/`](v2) contains all 19 entries of `contractSchemasV2` from
[`src/contracts/v2`](../../src/contracts/v2), including session content policy and
content manifest. Run `npm run contracts:generate` to regenerate only V2 files with
`z.toJSONSchema(schema, { target: "draft-2020-12", reused: "ref" })`; V1 is untouched.
The script uses Vite already installed with Vitest, without another dependency.
[`../fixtures/v2`](../fixtures/v2) is the shared game/portal transport oracle;
`npm run test:contracts:v2` checks schema parity, fixture acceptance/rejection, and
the generated refinement constraints with Ajv and Zod.

Protocol V2 accepts `protocol_version: 2` and opaque game state with
`schema_version: 3`. Policy and manifest have independent versions, both `1`.
The game owns `content_version`, the content catalog, metric declarations, snapshot
structure, migrations, and gameplay semantics. There is no portal-owned V2 content
version constant. The portal owns session content selection, persistence, revisions,
transport validation, and durable delivery; it never repairs or interprets snapshots.
Returning bootstrap and conflict messages carry `stored_content_version`; only an
explicit new-player bootstrap carries null state and null stored content version.

State is a plain JSON object, allows arbitrary game-owned fields, accepts only
finite numbers, has maximum depth 32 (root depth zero), and is limited to 262,144
compact serialized UTF-8 bytes. The manifest is limited to 131,072 serialized UTF-8
bytes. Neither limit is a character count or pretty-printed file-size limit.
Snapshot gameplay validity remains game-owned, not a portal field-by-field schema.

Session policy is closed, has bounded unique module/mission lists (at most 256
strings of 1-100 characters each), optional nonempty preset values, and optional
boolean/string options. The game-compatible optional maps also allow null. Empty
mission lists are transport-valid for testing `POLICY_EMPTY`, but the portal must
not send an empty effective selection. Unknown content IDs and presets are resolved
by the game and reported in `game.bootstrap_applied.v2`.

Result `metricas` is a generic plain record of at most 32 finite numeric values;
metric keys and labels come from the game manifest, not hard-coded portal activity
schemas. The backend may validate keys against the manifest. Initialization errors
still require zero duration and empty metrics. Context adds the stable `id_preset`;
active-time events optionally carry `mission_id`. V2 additionally supports
`POLICY_INVALID`, `POLICY_EMPTY`, `CONTENT_UPGRADE_REQUIRED`, `INTERNAL_ERROR`, and
`LOAD_FAILED`. `portal.configure.v2` remains reserved and is not defined.

As in V1, JSON Schema consumers must register UUID/ULID formats. V2 generation also
preserves refinement constraints via standard `uniqueItems`, `maxProperties`, and
nonblank-text patterns, plus these required custom keywords:

- `x-state-max-serialized-utf8-bytes`: compact serialized state byte limit.
- `x-state-max-depth`: maximum depth of all JSON values, including scalar leaves.
- `x-manifest-max-serialized-utf8-bytes`: compact serialized manifest byte limit.
- `x-uniqueBy`: each named event property must be unique independently in its array.

Register these keywords rather than silently ignoring them, and reject non-finite
numbers (Ajv: `strictNumbers: true`). Parity tests compare the Zod-generated core
and separately exercise these additions; schema-only validation without the custom
keywords is insufficient. Non-JSON JavaScript inputs (cycles, accessors, class
instances) must be rejected before transport, as they are by the Zod state preflight.
