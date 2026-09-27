# Phase 3: Game integration

> **Legacy detailed plan requiring contract reconciliation.** The current product hands
> participants to one existing GameMaker experience through customized opaque links.
> Any manifest, module, game registry, or per-game attempt design below is provisional
> until agreed with the GameMaker repository. Follow
> [`../current-architecture.md`](../current-architecture.md).

## Objective

Deliver anonymous public entry, short-lived play-session and attempt credentials,
server-authoritative manifests, GameMaker launch validation, and idempotent structured
result submission with bounded offline retry.

## Dependencies

- Phase 2 exit gate is complete.
- The GameMaker repository owner has accepted the checked-in V1 contracts.
- GameMaker P3-05/P3-06 implementation may begin after Phase 1 contract approval and
  run in parallel with Phase 2; only the integrated Phase 3 exit remains sequential.
- The browser export target or an approved alternative launch/hosting approach is
  decided before the phase exit gate.

## Work packages

### P3-01: Public activity entry

- Hash the supplied raw activity token before lookup and use constant-time digest
  comparison where application comparison occurs.
- Return safe public metadata only after validating link, activity, and current module
  launch state.
- Add friendly but non-sensitive invalid, expired, paused, closed, revoked, and blocked
  states.
- Apply rate limits to token lookup and session creation without creating a persistent
  device fingerprint.
- Exclude raw tokens from logs, error tracking, referrers, and analytics; configure a
  restrictive referrer policy on public activity pages.

### P3-02: Anonymous play sessions and manifests

- Create an anonymous UUID and a 256-bit session bearer token; store only its digest.
- Bind each session to the current activity version and originating link inside one
  transaction.
- Immediately before insert, revalidate that the activity is `open`; paused, closed, or
  archived returns `ACTIVITY_NOT_OPEN` and creates no session row.
- Issue a bounded session expiry and make completion/expiry idempotent.
- Enforce expiry lazily on every authenticated session/attempt access and atomically
  persist `expired` when first observed; run a scheduled sweep only for cleanup and
  operational visibility, not correctness.
- Generate manifests from the bound version while filtering current global and local
  launch blocks.
- Reject path/token scope mismatches and avoid professional cookies as authorization.
- Record structured operational events for session creation and manifest generation
  with correlation IDs, never child identity.

### P3-03: Attempt issuance

- Accept only a registered `game_key`; derive game version, activity version, sequence,
  seed, difficulty, and validated parameters server-side.
- Re-evaluate the complete availability predicate immediately before issue.
- Allocate `sequencia_tentativa` as the per-game retry ordinal within a play session and
  `numero_tentativa_atividade` as the session-wide attempt ordinal. Serialize both and
  enforce their distinct database uniqueness constraints.
- Generate a one-attempt bearer token with a short expiry and store only its digest.
- Save the exact context snapshot returned to GameMaker in the same transaction.
- Return stable unavailability/error codes from the contract.
- Apply the shared PostgreSQL-backed limiter to attempt creation, keyed by an HMAC of
  the session credential and route scope, returning `429` with `Retry-After` when the
  bound is exceeded.

### P3-04: Result acceptance and idempotency

- Validate attempt token scope, wrapper schema, game/result schema version, supported
  outcome, duration, and game-specific metrics.
- Lock the attempt and implement the idempotency table from the former
  `api-contracts.md` document (removed since this plan was written) in one
  transaction.
- Persist a canonical request digest so reuse of a `client_event_id` with altered
  content is detected rather than treated as a successful retry.
- Map Portuguese adapter outcomes to normalized domain outcomes without renaming the V1
  external fields.
- Accept a valid result for an already issued attempt even if availability was blocked
  after issue, provided token/attempt expiry rules still pass.
- Store compact allowlisted metrics only and reject non-finite, excessive, unknown, or
  mismatched values.
- Emit result acceptance/validation operational events without logging full payloads.
- Apply the shared PostgreSQL-backed limiter to result submission, keyed by an HMAC of
  the attempt credential and route scope. Idempotent retries remain allowed within the
  documented bound and return `429` with `Retry-After` when exceeded.

### P3-05: GameMaker portal adapter

- Add one persistent bootstrap controller that accepts the portal launch data and loads
  the manifest through a transport interface.
- Add a fixed local registry from `(runtime_key, runtime_version)` to known rooms and
  controller objects. Unknown entries fail closed.
- Replace hardcoded runner activity/configuration values with the server attempt
  context while preserving the existing minigame core boundary.
- Submit the structured completion result using the attempt token.
- Add and test a standards-compliant UUID v4 helper for `client_event_id`; persist one
  ID with each queued result and reuse it for every retry.
- Show safe paused, blocked, expired, unsupported-version, offline, and retry states.
- Never embed database credentials, auth administration credentials, or long-lived
  portal secrets in the game build.

### P3-06: Retry queue and development adapter

- Persist only pending result envelopes and their short-lived credentials in the
  smallest platform-appropriate local store.
- Use exponential backoff with jitter, a maximum queue length, a maximum age, and clear
  terminal handling for `4xx` contract failures.
- Remove an item only after its original or duplicate acknowledgement is validated.
- Provide a local fixture transport for Windows development that uses the exact same
  parser and registry as HTTPS transport.
- Mark fixture mode visibly and make it impossible to enable in production builds.

### P3-07: Hosting and browser boundary

- Host game artifacts on static/object hosting, not PostgreSQL.
- Apply content security policy, allowed API origins, cache versioning, compressed asset
  delivery, and rollback to the previous game build.
- Pass the launch credential without putting professional credentials or reusable
  secrets into asset URLs.
- Verify supported browsers/devices and document the approved alternative if browser
  GameMaker export is not used.

## Endpoint coverage

| Contract operation | Owning work package |
| --- | --- |
| `GET /public/activities/{activityToken}` | P3-01 |
| `POST /public/activities/{activityToken}/play-sessions` | P3-02 |
| `GET /play-sessions/{id}/manifest` | P3-02 |
| `POST /play-sessions/{id}/complete` | P3-02 |
| `POST /play-sessions/{id}/attempts` | P3-03 |
| `POST /attempts/{id}/results` | P3-04 |

## Required tests

- Contract tests cover valid/invalid manifest, attempt context, result, acknowledgement,
  and schema-version mismatch fixtures in both repositories.
- A blocked module/game or activity override removes a game from new manifests and
  rejects new attempts with the exact stable code.
- Revoking or rotating the originating link blocks new manifests/attempts in its active
  sessions while preserving the one-result allowance for already-issued attempts.
- A forged game key, mismatched ID, expired token, token replay to another attempt, and
  disabled game all fail closed.
- Concurrent attempt creation produces unique sequences.
- Repeated identical result delivery changes no counts and returns the original
  acknowledgement; a different event conflicts.
- Availability blocked after attempt issue does not erase a valid final result.
- Retry survives a simulated temporary network failure and stops on bounded limits.
- Result rate limits work across multiple application instances without storing raw
  tokens, IP addresses, or device fingerprints.
- Attempt-creation limits work across multiple instances, are scoped to the session
  credential, return `Retry-After`, and do not allocate an attempt when rejected.
- Unknown runtime keys/versions never resolve arbitrary GameMaker assets.
- End-to-end: public link -> anonymous session -> manifest -> attempt -> game completion
  -> retry-safe result -> session completion.

## Exit gate

- Specification acceptance criteria 4-5, 8-10, public-access enforcement from 12, and
  14 pass against the deployed preview API and an approved GameMaker build.
- A child flow completes without account creation or any requested identity field.
- Emergency blocks take effect at the next server validation, and in-flight accepted
  attempts can still submit once.
- Network loss/recovery and duplicate delivery have been demonstrated on a target
  device.
- The approved export/hosting target, supported device matrix, and game rollback
  procedure are documented.

## Rollback

The portal can block all new launches without deleting sessions/results. Static hosting
retains the previous game build, and the portal manifest only advertises a build/runtime
version supported by both sides.
