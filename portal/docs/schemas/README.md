# Portal V1 schemas

> **Migration status:** the Prisma model and
> [`database-model.md`](database-model.md) have been reconciled with
> [`../current-architecture.md`](../current-architecture.md) and are current. The
> shared GameMaker HTTP transport schemas live in
> [`../../contracts/schemas/v1`](../../contracts/schemas/v1); see their
> [README](../../contracts/schemas/README.md) for the protocol rules.

This directory records the implementation decisions behind the current schema.
The historical logical contracts live in
[`portal-v1-specification.md`](../../portal-v1-specification.md), which is
retained as historical research only.

## Existing technical artifacts

| Concern | Existing artifact |
| --- | --- |
| Persistent application data | [`prisma/schema.prisma`](../../prisma/schema.prisma) and [`database-model.md`](database-model.md) |
| Shared GameMaker HTTP shapes | [`contracts/schemas/v1`](../../contracts/schemas/v1) |
| Runtime transport validation | Zod schemas in [`src/contracts/v1`](../../src/contracts/v1) |

The Prisma schema manages application-owned tables only. Authentication credentials,
provider accounts, password recovery data, and professional login sessions remain in
Neon Auth's `neon_auth` schema.

Neon is the selected V1 platform for both concerns. Runtime application queries use
Neon Postgres through Prisma and `@prisma/adapter-neon`; professional authentication
uses the official `@neondatabase/auth` Next.js SDK. The provider boundaries exist for
maintainability, not because the V1 provider is undecided.

## Identifier and time conventions

- Database primary keys are UUIDs. API clients treat every identifier as an opaque
  string and must not infer its storage format.
- Examples may use readable prefixes; those prefixes are presentation examples, not a
  database guarantee.
- Timestamps are UTC RFC 3339 strings in JSON and `timestamptz(3)` in PostgreSQL.
- Player-credential tokens contain at least 256 bits of randomness.
  Only a SHA-256 digest is stored, as a 64-character lowercase hex value.
- JSON protocol versions are positive integers. A breaking shape change increments
  `schema_version`; additive changes still require tolerant readers.

## Validation layers

1. JSON Schema rejects malformed external payloads.
2. Zod schemas generated or hand-maintained from the same contracts validate data at
   the application boundary.
3. Domain services enforce relationships, permissions, and state transitions that
   cannot be expressed by JSON Schema.
4. PostgreSQL constraints and transactions protect persistent invariants.

Structural validation is intentionally not gameplay validation. Gameplay-owned
semantic checks remain GameMaker's responsibility.
