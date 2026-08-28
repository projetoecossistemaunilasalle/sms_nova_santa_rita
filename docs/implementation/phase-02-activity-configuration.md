# Phase 2: Activity configuration

> **Legacy detailed plan.** The portal now manages customized access links for one
> existing GameMaker experience. It does not compose activities from modules or games.
> Link lifecycle, professional administration, audit, and authorization research below
> may be reused only after alignment with
> [`../current-architecture.md`](../current-architecture.md).

## Objective

Allow authorized professionals to create, configure, preview, publish, share, pause,
reopen, close, and report-safe archive activities. Add global and per-activity
availability controls with immutable publication snapshots and audit history.

## Dependency

Phase 1 exit gate is complete. Catalogue versions and game configuration schemas exist
for every selectable game.

## Work packages

### P2-01: Draft creation and editing

- Implement `POST /api/v1/activities` and the equivalent server-side application
  service used by portal pages.
- Create `activities`, `activity_drafts`, and default `activity_draft_games` in one
  transaction from one exact module version.
- Preselect `enabled_by_default` games and prevent required games from being disabled
  without the administrative override capability.
- Validate configuration against the selected game version schema on every write.
- Require `draft_revision` optimistic concurrency for edits and return `409 CONFLICT`
  without overwriting another edit.
- Implement `DELETE /api/v1/activities/{activityId}` only for a never-published draft;
  reject deletion once any immutable activity version exists.
- Build accessible module selection, game selection, configuration, and saved-state UI.

### P2-02: Preview and publication

- Build preview entirely from server-validated draft data.
- In one serializable/retryable transaction, lock the activity/draft, revalidate
  authorization and availability, allocate the next version number, create immutable
  activity version/game snapshots, and update `current_version_id`.
- On first publication, generate a 256-bit opaque link token, store only its SHA-256
  digest, and return the raw URL exactly once.
- Default the first link to no expiry. Allow the publisher to supply an optional future
  `link_expires_at`; persist `null` when omitted.
- Preserve the existing active link on later publication unless the user explicitly
  rotates or revokes it.
- Treat first publication as a new activity: its module and selected games must be
  `active`. A revision of an already-published activity may use
  `new_activities_blocked` catalogue items only when their stable module/game identities
  already appear in the current version; it may not introduce a newly blocked item.
- Generate QR codes locally from the public URL; do not send activity links to a
  third-party QR service.
- Record publication and any required-game override in the audit log.

### P2-03: Lifecycle and link controls

- Implement pause, reopen, close, archive, link revoke, and link rotate services using
  the domain state machine.
- Reopening rechecks global module/game launch availability; it never clears an
  administrator's block.
- Make pause/close/revoke idempotent and return the current state on safe retries.
- Rotation creates a new link and revokes the previous link atomically. Revocation or
  rotation blocks manifests and new attempts for sessions created through the old link;
  already-issued attempts retain the documented one-result submission allowance.
- Warn the professional about that active-session impact before revoke or rotation.
- Show link expiry/revocation state to authorized professionals without exposing its
  digest.
- Implement the link-expiry mutation for a future timestamp or `null`, require a reason,
  and audit before/after values. Rotation accepts the same optional expiry and otherwise
  creates a non-expiring replacement.
- Preserve versions and reporting relations after close, revoke, or archive.

### P2-04: Per-activity game kill switch

- Implement upsert/remove of `activity_game_overrides` by stable game identity.
- Require a controlled reason, actor, before/after values, and correlation ID.
- Prevent re-enable when the module/game is still globally non-launchable; report the
  effective cause clearly.
- Surface effective availability separately from the stored local override in the UI.

### P2-05: Global administration controls

- Implement module and game availability mutations for the two catalogue capabilities.
- Validate allowed transitions, require a reason, and store state plus audit event in
  one transaction.
- Show the impact before confirmation: new activities, new sessions, new attempts, and
  historical results.
- Add an audit timeline filtered by module, game, activity, actor, and timestamp.
- Implement cursor-paginated `GET /api/v1/admin/modules`,
  `GET /api/v1/admin/games`, and `GET /api/v1/admin/audit-events` for their authorized
  scopes.
- Require the sensitive-module release capability before a sensitive module can become
  active/selectable. The availability mutation requires both catalogue-availability
  and sensitive-release capabilities plus a controlled `review_reference`, and writes
  a distinct sensitive-release audit event.

### P2-06: Professional and organization administration

- Implement `user:manage` services and admin routes for organization creation/status,
  professional invitation/activation/deactivation, membership status, and capability
  grant/revoke.
- Keep Neon Auth public registration disabled. Wrap Neon Auth invitation/provisioning
  behind the auth gateway and validate during Phase 1 whether Neon Auth returns a stable
  user ID before acceptance; add local pending-invitation persistence before Phase 2 if
  it does not.
- Apply application state only after provider success, with explicit compensation and
  retry handling when provider and database operations cannot share a transaction.
- Limit a manager to grants inside their authorized scope; only a platform-wide
  `user:manage` assignment can grant platform-wide capabilities.
- Audit invitation, activation/deactivation, organization/membership status, and every
  capability change without logging invitation tokens.
- Provide the minimum admin UI needed to provision controlled pilot accounts and revoke
  access; bulk import and complex hierarchy remain outside V1.

### P2-07: Professional activity workspace

- Implement cursor-paginated `GET /api/v1/activities` and scoped
  `GET /api/v1/activities/{activityId}` reads used by the workspace.
- Add activity list/detail screens with owner, organization, status, current version,
  draft revision, link status, and last update.
- Support owner views and explicit organization-scoped viewer access without relying
  on client-side hiding.
- Provide clear empty, stale edit, unavailable, forbidden, and terminal-state screens.
- Add responsive and keyboard-accessible dialog/form behavior; restore focus after
  publish and lifecycle actions.

## Endpoint coverage

| Contract operation | Owning work package |
| --- | --- |
| `POST /activities`, `PATCH /activities/{id}`, `DELETE /activities/{id}` | P2-01 |
| `POST /activities/{id}/publish` | P2-02 |
| Pause, reopen, close, archive, link revoke/rotate/expiry | P2-03 |
| `PUT /activities/{id}/games/{gameId}/availability` | P2-04 |
| Admin module/game reads and availability mutations; audit-event list | P2-05 |
| Organization/professional/invitation/membership/capability admin routes | P2-06 |
| `GET /activities` and `GET /activities/{id}` | P2-07 |

`GET /activities/{id}/results` is intentionally owned by Phase 4 P4-01.

## Required tests

- Two concurrent publications allocate distinct monotonically increasing versions or
  cleanly reject the stale draft; they never create partial rows.
- Optional games can be disabled, required games cannot be disabled without the
  capability, and the override is audited.
- A globally blocked game cannot be selected or published into a new version.
- Draft configuration outside the registered game schema is rejected.
- Published snapshots remain byte-for-byte stable after draft edits and availability
  changes.
- Pause, close, archive, expiry, revoke, and rotation enforce the state table while
  preserving authorized reads.
- New/rotated links are non-expiring when expiry is omitted; only an authorized
  publisher can set/clear future expiry, and every change is audited.
- Deleting a never-published draft cascades only mutable draft rows; published activities
  cannot be deleted through the V1 service.
- Global and activity availability changes contain actor, reason, previous value, new
  value, timestamp, and correlation ID.
- Every professional/admin mutation has owner, scoped viewer, unrelated user, inactive
  user, and platform administrator authorization cases.
- Invitation, activation, membership, and capability tests prevent privilege escalation,
  duplicate global grants, orphan provider invitations, and raw-token logging.
- Every cookie-authenticated mutation rejects invalid CSRF/origin input and is covered
  by the professional actor rate limit.
- Activity/admin/professional/audit lists enforce stable cursor pagination, the default
  and maximum limits, tamper rejection, scope filters, and no duplicate/skipped rows.
- Playwright covers create -> configure -> preview -> publish -> QR/link -> pause ->
  reopen -> close at desktop and mobile widths.

## Exit gate

- Specification acceptance criteria 1-3, 6-7, and the lifecycle-control portion of 12
  pass in a preview environment. Criteria 4-5 and public enforcement of 12 are Phase 3
  runtime gates.
- An authorized professional can complete the full activity lifecycle without direct
  database or administrator intervention.
- Kill switches affect effective server state immediately while historical rows remain
  unchanged.
- Link tokens meet entropy/storage rules and are absent from logs, analytics, audit
  JSON, and server-rendered pages after the one-time response.
- Product and pedagogy approve the activity preview and configuration limits for the
  first module.
- An administrator can provision, scope, deactivate, and revoke every professional
  account needed for the pilot without direct database edits.

## Rollback

Feature flags can hide activity authoring and administration screens while retaining
read access. Forward migrations remain in place; rollback never deletes published
versions or audit events.
