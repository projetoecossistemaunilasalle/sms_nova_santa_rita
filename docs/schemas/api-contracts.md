# Legacy Portal API V1 contracts

> **Not current product authority.** Professional authentication, link security,
> anonymous sessions, result idempotency, and aggregate privacy remain relevant. Module
> catalogues, portal-created activities, selected games, and per-game availability are
> from the superseded model. Define the final link and single-GameMaker handoff contract
> from [`../current-architecture.md`](../current-architecture.md) before implementation.

All external endpoints use JSON over HTTPS under `/api/v1`. Professional endpoints
authenticate with the Neon Auth session cookie issued by the official
`@neondatabase/auth` Next.js SDK. Public runtime endpoints use an
opaque activity token in the entry URL, followed by bearer play-session and attempt
tokens.

## Protocol rules

- Requests with JSON bodies require `Content-Type: application/json`.
- Runtime requests and responses carry `schema_version: 1`.
- Unknown breaking schema versions return `SCHEMA_VERSION_UNSUPPORTED`.
- Every response includes `X-Correlation-Id`. Error bodies also include that UUID.
- Tokens are redacted from logs and never returned after their initial issuance.
- Collection pagination uses an opaque signed `cursor` and a bounded `limit` of 1 to
  100. The default limit is 25. Collection responses return `items` and nullable
  `next_cursor`; malformed or context-mismatched cursors return `422 VALIDATION_FAILED`.
- Timestamps use UTC RFC 3339. IDs are opaque strings.
- Validation errors use [`api-error.v1.schema.json`](../../contracts/schemas/api-error.v1.schema.json).
- Cookie-authenticated mutations require a same-origin check and session-bound CSRF
  proof. `GET` operations never mutate state.
- Externally shared GameMaker shapes use checked-in JSON Schema. Professional monolith
  request/response DTOs use reviewed Zod schemas as their machine-readable source of
  truth because V1 exposes no third-party professional client.

## Professional endpoints

| Operation | Capability and scope | Success | Notes |
| --- | --- | --- | --- |
| `GET /modules` | `module:view` | `200` | Lists only published module versions selectable for a new activity. There is no include-unavailable option on this route. |
| `GET /module-versions/{moduleVersionId}/games` | `module:view` | `200` | Returns games, defaults, required flags, and configuration schemas for exactly the module version identified by the path. It never silently selects latest. |
| `GET /activities` | activity owner or scoped viewer | `200` | Cursor-paginated activity list filtered by the actor's owner/organization scope and optional status. |
| `POST /activities` | `activity:create` in organization | `201` | Creates an activity plus one editable draft from a published, currently selectable module version. |
| `GET /activities/{activityId}` | owner or scoped viewer | `200` | Returns draft/current version according to authorization; never returns raw link hashes or tokens. |
| `PATCH /activities/{activityId}` | owner with `activity:edit_own`, or admin | `200` | Uses optimistic concurrency through required `draft_revision`; returns `409` on a stale edit. |
| `DELETE /activities/{activityId}` | owner with `activity:edit_own`, or admin | `204` | Deletes only a never-published draft. Any existing activity version makes deletion a `409`; archive instead. |
| `POST /activities/{activityId}/publish` | owner with `activity:publish_own`, or admin | `201` | Transactionally creates immutable version rows and, on first publication, a public link. Returns the raw link exactly once. |
| `POST /activities/{activityId}/pause` | publisher of the activity | `200` | Idempotently moves `open` to `paused`; reason is required and change is audited. |
| `POST /activities/{activityId}/reopen` | publisher of the activity | `200` | Moves `paused` to `open` after re-evaluating module and game launch availability. |
| `POST /activities/{activityId}/close` | publisher of the activity | `200` | Idempotently blocks new sessions and attempts; historical reporting remains available. |
| `POST /activities/{activityId}/archive` | publisher of the activity | `200` | Moves an eligible draft/closed activity to terminal `archived`; versions and reporting remain available. |
| `POST /activities/{activityId}/links/{linkId}/revoke` | publisher of the activity | `200` | Idempotently revokes the link and blocks manifests/new attempts in sessions originating from it. Reason is required. |
| `POST /activities/{activityId}/links/{linkId}/rotate` | publisher of the activity | `201` | Atomically revokes the old link and creates a replacement. Returns the replacement URL exactly once. |
| `PUT /activities/{activityId}/links/{linkId}/expiry` | publisher of the activity | `200` | Sets a future RFC 3339 expiry or clears it with `null`; reason is required and the change is audited. |
| `PUT /activities/{activityId}/games/{gameId}/availability` | publisher of activity | `200` | Sets/removes the activity runtime override. Reason is required and every change is audited. |
| `GET /activities/{activityId}/results` | owner `results:view_own` or scoped `results:view_organization` | `200` | Aggregate-only result projection. Supports game and accepted-at date filters; no child identity dimensions. |

## Administration endpoints

| Operation | Capability | Success | Notes |
| --- | --- | --- | --- |
| `GET /admin/modules` | module availability capability | `200` | Lists all module modes for administration; separate from the selectable professional catalogue. |
| `GET /admin/games` | game availability capability | `200` | Lists all game modes and exact published runtime versions. |
| `PUT /admin/modules/{moduleId}/availability` | `catalogue:module_availability` | `200` | Requires mode and reason; writes before/after audit snapshots in the same transaction. |
| `PUT /admin/games/{gameId}/availability` | `catalogue:game_availability` | `200` | Same transactional audit rule. Blocking affects the next manifest or attempt check. |
| `GET /admin/audit-events` | relevant administration capability | `200` | Cursor-paginated audit timeline restricted to entities/scopes the actor may administer. |

Availability request body:

```json
{
  "mode": "launches_blocked",
  "reason": "Temporary operational block",
  "review_reference": null
}
```

Allowed modes are `active`, `new_activities_blocked`, `launches_blocked`, and
`archived`. A transition out of `archived` is not supported in V1. Setting a sensitive
module to `active` additionally requires `catalogue:sensitive_module_release` and a
non-empty controlled `review_reference`; the transaction writes a distinct
`sensitive_module.released` audit event. This is the V1 sensitive-release operation,
not a separate content-authoring endpoint.

Activity links are non-expiring by default (`expires_at = null`). The publisher or an
authorized administrator may supply optional `link_expires_at` during first publication
or rotation, and may later change it through the expiry endpoint. Expiry changes never
extend the lifetime of already-issued session or attempt credentials.

## User and organization administration

All operations below require `user:manage` inside the affected scope. Only a
platform-wide manager may create platform-wide assignments.

| Operation | Success | Notes |
| --- | --- | --- |
| `GET /admin/organizations` | `200` | Paginated list limited to organizations the manager may administer. |
| `POST /admin/organizations` | `201` | Creates a minimal organization with controlled `name`, `type`, and active status. |
| `PUT /admin/organizations/{organizationId}/status` | `200` | Activates/deactivates organization; deactivation does not delete memberships/history. |
| `GET /admin/professionals` | `200` | Paginated scoped profiles and memberships; never returns provider credentials or recovery data. |
| `POST /admin/professionals/invitations` | `201` | Invites through `AuthGateway`, then creates the application profile/membership/grants using the provider's stable user ID. Invitation token is never returned by this API. |
| `PUT /admin/professionals/{profileId}/status` | `200` | Activates/deactivates portal access and coordinates provider access through `AuthGateway`. |
| `PUT /admin/professionals/{profileId}/memberships/{organizationId}` | `200` | Idempotently sets membership status; body contains `status` and `reason`. |
| `POST /admin/professionals/{profileId}/memberships/{membershipId}/capabilities` | `201` or `200` replay | Grants an authorized capability/scope idempotently; body contains `capability`, `scope_organization_id`, and `reason`. |
| `DELETE /admin/professionals/{profileId}/memberships/{membershipId}/capabilities/{assignmentId}` | `204` | Revokes the exact authorized assignment and audits the removal. |

Provider invitation and application writes cannot share a database transaction. The
service uses an idempotency key and compensating provider revocation if the application
transaction fails. Phase 1 must confirm that the selected Neon Auth invitation API
returns a stable user ID; otherwise a local pending-invitation table and callback flow
must be added before implementing these routes.

## Public runtime endpoints

| Operation | Credential | Success | Important behavior |
| --- | --- | --- | --- |
| `GET /public/activities/{activityToken}` | activity token | `200` | Validates hash, expiry, revocation, and activity state; returns safe title/module metadata only. |
| `POST /public/activities/{activityToken}/play-sessions` | activity token | `201` | Rate limited. Revalidates that the activity is `open` before binding; paused, closed, or archived returns `409 ACTIVITY_NOT_OPEN` and creates no row. |
| `GET /play-sessions/{playSessionId}/manifest` | session bearer token | `200` | Returns [`session-manifest.v1`](../../contracts/schemas/session-manifest.v1.schema.json), filtered using current availability. |
| `POST /play-sessions/{playSessionId}/attempts` | session bearer token | `201` | Validates [`attempt-create-request.v1`](../../contracts/schemas/attempt-create-request.v1.schema.json), rechecks availability, and returns [`attempt-create-response.v1`](../../contracts/schemas/attempt-create-response.v1.schema.json). |
| `POST /attempts/{attemptId}/results` | attempt bearer token | `201` or `200` replay | Validates the wrapper and registered game metrics schema, then stores result and completes attempt atomically. |
| `POST /play-sessions/{playSessionId}/complete` | session bearer token | `200` | Idempotently completes the session. No additional result data is accepted in this call. |

The session token must be scoped to the path `playSessionId`; the attempt token must be
scoped to both the path `attemptId` and its owning play session. A path/body/token ID
mismatch is rejected rather than reconciled.

Each manifest game exposes stable `game_key` for portal selection plus
`runtime_key`/`runtime_version` for the fixed GameMaker registry. The attempt request
uses `game_key`; the returned context's `id_mecanica` is the selected `runtime_key`.

Session/attempt expiry is checked lazily on every credentialed access and atomically
persists `expired` when first observed. A scheduled sweep is cleanup only. Revoking,
rotating, or expiring the originating activity link blocks subsequent manifests and new
attempts for its sessions; an already-issued, unexpired attempt may still submit its
single result.

## Rate limiting

- Public link lookup/session creation, attempt creation, and result submission are
  limited by route plus an HMAC of the scoped credential or activity token.
- Professional sign-in and administrative mutations are limited by route plus actor.
- Counts use expiring PostgreSQL fixed-window buckets so multiple application instances
  share enforcement without Redis. Raw tokens, IP addresses, and device fingerprints
  are not stored in these buckets.
- Hosting ingress may provide an additional transient per-IP burst control.
- A rejected request returns `429`, `Retry-After`, the standard error envelope, and a
  correlation ID. Valid idempotent result retries remain subject to a documented bound.

## Result idempotency

The result body follows
[`attempt-result-request.v1`](../../contracts/schemas/attempt-result-request.v1.schema.json).
The server transaction locks the attempt row and applies these outcomes:

| Stored state | Incoming event | Response |
| --- | --- | --- |
| No result | Valid payload | Store result, mark attempt complete, return `201` acknowledgement with `duplicate: false`. |
| Same result and same `client_event_id` | Retry | Return original `200` acknowledgement with `duplicate: true`. |
| Different payload and same `client_event_id` | Conflict | Return `409 CONFLICT`; never replace the accepted result. |
| Existing result and different `client_event_id` | Conflict | Return `409 ATTEMPT_ALREADY_COMPLETED`. |
| No result, invalid game metrics | Invalid | Return `422 RESULT_SCHEMA_INVALID`; leave attempt issued for a corrected retry. |

Acknowledgements follow
[`attempt-result-ack.v1`](../../contracts/schemas/attempt-result-ack.v1.schema.json).

The protocol retains Portuguese GameMaker field names (`estado`, `duracao_ms`, and
`metricas`) at the adapter boundary. The application maps outcomes to the normalized
database enum (`success`, `failure`, `abandoned`).

## Aggregate results shape

The report service returns counts, rates, and supported metric aggregations only:

```json
{
  "activity_id": "opaque-id",
  "activity_version": 3,
  "participation": {
    "sessions_started": 42,
    "sessions_completed": 35,
    "completion_rate": 0.8333
  },
  "games": [
    {
      "game_key": "defesa_bolas",
      "attempts_completed": 38,
      "duration_ms": { "average": 82120, "minimum": 41200, "maximum": 140300 },
      "choices": [
        { "value": "grupo", "count": 24 },
        { "value": "individual", "count": 9 },
        { "value": "pedir_ajuda", "count": 5 }
      ],
      "metrics": {
        "bolas_bloqueadas": { "average": 17.4 },
        "bolas_perdidas": { "average": 3.1 }
      }
    }
  ]
}
```

Metric aggregation is allowlisted per game/result-schema version. The report service
must not dynamically expose every JSON key received from a client.

## HTTP status mapping

| Status | Use |
| --- | --- |
| `200` | Successful read, state mutation, completion, or idempotent replay. |
| `201` | Activity/version/link/session/attempt/result created. |
| `400` | Malformed JSON or unsupported media type. |
| `401` | Missing or invalid professional/session/attempt credential. |
| `403` | Authenticated credential lacks capability or scope. |
| `404` | Protected resource absent or deliberately concealed from the actor. |
| `409` | Invalid state transition, stale draft revision, or conflicting result. |
| `410` | Expired or revoked public link/session when disclosure is safe. |
| `422` | Structurally valid JSON violates a request or game schema. |
| `429` | Public or professional rate limit exceeded; response includes `Retry-After`. |
