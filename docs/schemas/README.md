# Portal V1 schemas

> **Migration status:** the Prisma model and
> [`database-model.md`](database-model.md) have been reconciled with
> [`../current-architecture.md`](../current-architecture.md) and are current. The
> remaining notes (`api-contracts.md`, `domain-rules.md`) and the shared GameMaker
> HTTP schemas still describe the earlier multi-activity/module architecture; their
> catalogue and activity-composition concepts are not the source of truth for new
> product behavior.

This directory turns the logical contracts in
[`portal-v1-specification.md`](../../portal-v1-specification.md) into implementation
decisions.

## Existing technical artifacts

| Concern | Existing artifact |
| --- | --- |
| Persistent application data | [`prisma/schema.prisma`](../../prisma/schema.prisma) and [`database-model.md`](database-model.md) |
| Shared GameMaker HTTP shapes | [`contracts/schemas`](../../contracts/schemas) |
| Professional monolith DTOs | [`api-contracts.md`](api-contracts.md), then Zod schemas created in Phase 1 |
| Endpoint behavior and authorization | [`api-contracts.md`](api-contracts.md) |
| State transitions and invariants | [`domain-rules.md`](domain-rules.md) |

The Prisma schema manages application-owned tables only. Authentication credentials,
provider accounts, password recovery data, and professional login sessions remain in
Neon Auth's `neon_auth` schema.

Neon is the selected V1 platform for both concerns. Runtime application queries use
Neon Postgres through Prisma and `@prisma/adapter-neon`; professional authentication
uses the official `@neondatabase/auth` Next.js SDK. The provider boundaries exist for
maintainability, not because the V1 provider is undecided.

The remaining legacy artifacts may still inform token security, authentication,
result idempotency, and audit design. Their module catalogue, activity draft/version,
selected game, and per-game availability concepts are legacy until replaced or
explicitly approved.

## Legacy refinements to the historical specification

The historical implementation model added two concepts that were implied, but not
fully modeled, in the earlier product specification:

- `game_versions` makes the runtime, configuration schema, and result schema used by
  an attempt historically identifiable.
- `activity_drafts` and `activity_draft_games` keep editable work separate from
  immutable `activity_versions` and `activity_version_games`.

These refinements explain the legacy model that preceded the current schema. They are
not approval to retain portal-composed activities or game catalogues in the replacement
model.

## Identifier and time conventions

- Database primary keys are UUIDs. API clients treat every identifier as an opaque
  string and must not infer its storage format.
- Examples may use readable prefixes such as `act_` or `att_`; those prefixes are
  presentation examples, not a database guarantee.
- Timestamps are UTC RFC 3339 strings in JSON and `timestamptz(3)` in PostgreSQL.
- Access-link tokens contain at least 256 bits of randomness. Only a SHA-256 digest is
  stored, as a 64-character lowercase hex value. Future play-session and attempt tokens
  follow the same rule when the game-integration contract lands.
- JSON protocol versions are positive integers. A breaking shape change increments
  `schema_version`; additive changes still require tolerant readers.

## Validation layers

1. JSON Schema rejects malformed external payloads.
2. Zod schemas generated or hand-maintained from the same contracts validate data at
   the application boundary.
3. Domain services enforce relationships, permissions, state transitions, and
   availability rules that cannot be expressed by JSON Schema.
4. PostgreSQL constraints and transactions protect persistent invariants.

JSON Schema cannot prove that a game belongs to an activity or that a module is
launchable. Those checks always remain server-side domain rules.
