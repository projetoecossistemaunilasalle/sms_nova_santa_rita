# Phase 1: Foundation and contracts

> **Legacy detailed plan.** Authentication, authorization, observability, and contract
> testing remain relevant. Catalogue/module/game-version work belongs to the superseded
> multi-activity model and must not be implemented as written. Follow
> [`../current-architecture.md`](../current-architecture.md). The container/Docker
> build steps in this file are obsolete: Docker is not a supported build or
> deployment target for the current version.

## Objective

Produce a deployable Next.js modular-monolith shell connected to Neon Postgres and Neon
Auth, with an application-owned data model, versioned runtime contracts, professional
authentication boundary, capability authorization, catalogue persistence, and CI. No
public child runtime is exposed in this phase.

## Inputs

- [`prisma/schema.prisma`](../../prisma/schema.prisma)
- The former `docs/schemas/domain-rules.md` and `docs/schemas/api-contracts.md`
  (both documents were removed with the retired contract set)
- [`contracts/schemas`](../../contracts/schemas)

## Work packages

### P1-01: Repository and runtime shell

- Create `missoes-caramelito-platform` using Next.js 16 App Router, React 19.2,
  strict TypeScript, Node 24, and the agreed package manager.
- Establish the structure from the specification: `app`, `components`, `server`,
  `contracts`, `prisma`, and `tests`.
- Pin runtime/dependency versions, commit the lockfile, add `.env.example`, and validate
  environment variables with Zod at process startup.
- Require and document `DATABASE_URL`, `DIRECT_URL`, `NEON_AUTH_BASE_URL`, and
  `NEON_AUTH_COOKIE_SECRET`; fail startup without the applicable runtime values.
- Add `/health/live` without external checks and `/health/ready` with a bounded database
  check. Neither endpoint discloses connection or auth details.
- Create a production multi-stage Dockerfile that runs as a non-root user.
- Add structured logging with generated/forwarded correlation IDs and a redaction list.
- Implement shared HTTP response/error adapters that attach `X-Correlation-Id` to every
  response and serialize every failure through the versioned API error envelope.
- Add production security headers: a nonce-compatible CSP, HSTS, `nosniff`, restrictive
  framing/referrer policy, and explicit allowed origins.

### P1-02: Database baseline

- Configure Prisma 7 with `@prisma/adapter-neon`, pooled application `DATABASE_URL`,
  and direct migration `DIRECT_URL` in the deployment command.
- Create a dedicated Neon development project and a separate Neon pilot/production
  project. Use development-project branches for previews; never branch real production
  professional accounts into development.
- Review `schema.prisma` against the installed Prisma version, then generate and commit
  the baseline migration.
- Add SQL checks Prisma cannot express: positive version/position/revision values,
  valid duration ranges, lowercase 64-character token digests, close/archive timestamp
  consistency, positive rate-limit counts, and required games enabled by default.
- Add a `NULLS NOT DISTINCT` unique index for platform-wide capability assignments so
  a nullable global scope cannot create duplicate grants.
- Add migration tests from both an empty database and the last released schema.
- Seed synthetic organizations, professional profiles, capabilities, one module, one
  `defesa_bolas` game version, one module version, and its JSON schemas.
- Confirm application migrations do not manage or modify the `neon_auth` schema.
- Establish the query-review checklist used from Phase 1 onward: representative
  synthetic row counts, captured `EXPLAIN` output, expected index/scan behavior, and a
  recorded reviewer. Phase 4 adds `ANALYZE`, load, and capacity depth.

### P1-03: Contract package and fixtures

- Move/copy the checked-in JSON schemas into the platform package without altering
  their stable `$id` values.
- Implement matching Zod boundary schemas and a test that every checked-in example is
  valid under JSON Schema and Zod.
- Treat JSON Schema as the source of truth for externally shared GameMaker contracts.
  Professional monolith routes use reviewed Zod DTOs as their machine-readable source
  because there is no third-party professional API client in V1.
- Add invalid fixtures for unknown fields, missing fields, invalid versions, excessive
  metrics, and unsupported game keys.
- Publish a transport-neutral fixture manifest, attempt response, result request, and
  acknowledgement for GameMaker development.
- Add a contract-change checklist requiring schema, examples, portal tests, GameMaker
  adapter tests, and compatibility notes.
- Implement the shared Zod cursor/limit schemas, signed opaque cursor codec, collection
  response shape, and invalid/context-mismatch handling used by every list route.

### P1-04: Authentication gateway

- Define `AuthGateway.getSession()` and application-owned actor/session types so domain
  services do not import Neon Auth SDK types.
- Install and pin the official `@neondatabase/auth` Next.js SDK. Configure Neon Auth
  with `createNeonAuth({ baseUrl, cookies: { secret } })`, expose its route handler and
  middleware, disable public registration, and use secure production cookie settings.
- Validate the supported invitation API in a proof: stable user ID availability,
  invitation expiry/revocation, callback behavior, and compensation after an application
  write failure. Record whether local pending-invitation persistence is required.
- Add a controlled, idempotent command to bind the first Neon Auth user to an active
  professional profile and platform-wide administration capabilities.
- Implement sign-in, sign-out, expired-session handling, and protected route layout.
- Ensure children/public runtime paths never enter Neon Auth and never create auth users.
- Keep Prisma migrations restricted to application-owned tables. Never create, rename,
  drop, or migrate Neon Auth's `neon_auth` schema.

### P1-05: Capability authorization

- Implement an `AuthorizationService` over active profile, membership, capability, and
  explicit organization scope.
- Treat null scope as platform-wide only for assignments created by an administrator.
- Provide service-level guards for each capability in the specification.
- Deny by default for inactive profiles, inactive memberships, missing scopes, and
  unrecognized capabilities.
- Define the service guards and audit action names later used by capability grant/revoke
  and professional activation/deactivation operations in Phase 2.

### P1-06: Catalogue foundation

- Implement repositories and read services for modules, module versions, games, game
  versions, and module-version games.
- Enforce version immutability in services and database permissions/triggers if the
  operational model permits them.
- Implement `GET /api/v1/modules` and exact-version
  `GET /api/v1/module-versions/{moduleVersionId}/games` behind `module:view`; never
  infer a latest version in the second route.
- Resolve new-activity selectability separately from launchability.
- Add administrator-only seed/import commands for catalogue versions; full content
  authoring remains out of V1.

### P1-07: Web security and rate-limit baseline

- Implement CSRF protection for every cookie-authenticated mutation: verify configured
  origin/host, require a session-bound token or framework-equivalent protection, and
  never mutate on `GET`.
- Implement a PostgreSQL-backed fixed-window limiter keyed by an HMAC of actor or
  credential plus route scope; never persist raw credentials or child/device identity.
- Add a transient ingress/IP burst limit when the selected host supports it. The
  application limiter remains authoritative across multiple instances without Redis.
- Apply conservative actor-scoped limits to professional sign-in and administration
  routes, with `429`, `Retry-After`, and correlation IDs.
- Add cleanup for expired `rate_limit_buckets` as an operational job.

### P1-08: CI and preview deployment

- Run formatting, linting, strict type checking, unit tests, JSON Schema validation,
  migration tests, integration tests, and a Playwright auth smoke test in CI.
- Create preview deployment using a branch from the development Neon project.
- Run migrations as a single deployment job, never at every instance startup.
- Add dependency, secret, and container vulnerability scanning with an explicit triage
  policy.

## Endpoint coverage

| Contract operation | Owning work package |
| --- | --- |
| Neon Auth handler, sign-in, and sign-out | P1-04 |
| `GET /api/v1/modules` | P1-06 |
| `GET /api/v1/module-versions/{moduleVersionId}/games` | P1-06 |
| `/health/live` and `/health/ready` | P1-01 |

## Required tests

- Authentication adapter returns application-owned actor types and handles missing,
  expired, and inactive sessions.
- Every capability is allowed only for a matching active assignment and scope.
- Platform-wide assignments cannot be self-created through normal membership paths.
- Catalogue read filters correctly distinguish `active`,
  `new_activities_blocked`, `launches_blocked`, and `archived`.
- Published module/game versions reject update/delete through application services.
- All valid runtime fixtures pass; each deliberately invalid fixture fails for the
  expected reason.
- Baseline migration and seed run twice safely where commands are documented as
  idempotent.
- Cookie-authenticated mutations reject missing/foreign origins and invalid CSRF
  tokens; rate-limit counters work across two application instances.
- Success and failure responses always carry the same correlation ID in the header,
  structured log, and error body where applicable.
- Cursor pagination rejects tampering/context reuse, respects the default and 1-100
  bounds, and traverses stable-sort fixtures without duplicate or skipped records.
- Catalogue reads use the requested exact module version and have reviewed baseline
  `EXPLAIN` output.

## Exit gate

- A preview deployment starts from an empty database and passes readiness checks.
- The preview uses its Neon branch for both application data and Neon Auth, and sign-in
  succeeds through the official Neon Auth SDK.
- A provisioned professional signs in and sees only modules allowed by capability and
  availability rules.
- The data model, JSON schemas, error envelope, and outcome-language mapping have
  engineering and GameMaker-owner approval.
- Authorization tests cover every Phase 1 protected operation.
- Redaction tests prove that raw auth and synthetic fixture tokens do not appear in logs
  or browser bundles.

## Rollback

Roll back the application image independently. Before pilot data exists, the baseline
migration may be replaced through normal review; after shared environments contain
data, all schema corrections use forward-only migrations.
