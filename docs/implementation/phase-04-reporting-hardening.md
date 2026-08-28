# Phase 4: Reporting and hardening

> **Legacy detailed plan.** Reporting, privacy, retention, accessibility, backups, and
> incident readiness remain relevant. All landing migration/cutover work is cancelled,
> and per-module/per-game reporting assumptions require reconciliation with the single
> GameMaker experience. Follow
> [`../current-architecture.md`](../current-architecture.md).

## Objective

Deliver authorized aggregate reporting and complete the privacy, retention,
observability, performance, accessibility, backup, incident, and deployment-safety work
required for a controlled pilot or production launch.

## Dependency

Phase 3 exit gate is complete and representative synthetic play/result volume exists.
Report viewers, organization scopes, metric allowlists, and comparison rules must be
approved before report behavior is frozen.

## Work packages

### P4-01: Aggregate query model

- Implement the authorized `GET /api/v1/activities/{activityId}/results` Route Handler
  and the shared report service used directly by the server-rendered results page.
- Define one allowlisted aggregation descriptor per game/result-schema version,
  including count, distribution, average, minimum, and maximum operations.
- Calculate participation from distinct play sessions and completion from completed
  sessions; document the denominator for each rate.
- Query relational dimensions first and extract only approved JSON metric keys.
- Keep results reproducible from accepted attempt results; avoid an asynchronous
  aggregate store until measured query load requires it.
- Add owner, game, activity version, and accepted-at filters without child/device
  dimensions.
- Round display values in the presenter, not stored source data.

### P4-02: Reporting UI and export decision

- Build activity summary, participation/completion, predefined-choice distribution,
  supported game metrics, and availability/audit context.
- Enforce owner and explicit organization scope in the report service before querying.
- Clearly label low/zero sample sizes and avoid ranking or inferred child-level claims.
- Decide whether aggregate CSV export is needed. If approved, apply the same scope,
  filters, audit, and privacy constraints; otherwise keep export outside V1.
- Verify closed, archived, expired-link, revoked-link, and globally blocked activities
  remain reportable to authorized professionals.

### P4-03: Retention and deletion

- Convert approved retention periods into configuration with safe minimum/maximum
  validation and environment ownership.
- Implement preview/dry-run, batched execution, retry, progress metrics, and an audit
  summary for expiry/deletion jobs.
- Expire live bearer-token records promptly; delete/anonymize runtime data only under
  the approved result policy.
- Confirm foreign-key order preserves required audit/catalogue history and does not
  strand partial play data.
- Document legal/operational hold behavior if required; otherwise explicitly state it
  is unsupported and block production until resolved.

### P4-04: Observability and operations

- Instrument request rate, latency, error code, database duration, manifest generation,
  attempt issue, result acceptance/rejection, duplicate rate, retry recovery, and job
  outcomes.
- Alert on unknown game keys, schema mismatches, elevated validation failures, sustained
  `5xx`, database saturation, and Neon usage warning thresholds.
- Separate API health dashboards from pedagogical/product completion reports.
- Write runbooks for kill switch, credential compromise, failed migration, game rollback,
  database outage, retention failure, and suspected data exposure.
- Assign support and incident owners and test the escalation path.

### P4-05: Security and privacy verification

- Threat-model professional session theft, activity-token enumeration/leakage, bearer
  replay, forged results, cross-organization access, abusive session creation, and log
  disclosure.
- Verify cookie flags, CSRF protection for professional mutations, CSP, origin policy,
  security headers, dependency status, least-privilege database credentials, and secret
  rotation.
- Test rate-limit behavior and proxy/client-address trust configuration without device
  fingerprinting.
- Search UI, APIs, database columns, logs, traces, exports, and analytics for child
  identity collection or inference fields.
- Complete an external or independent review before production if required by the
  municipal security owner.

### P4-06: Performance and capacity

- Generate representative synthetic organizations, activities, sessions, attempts, and
  results at pilot scale.
- Capture `EXPLAIN (ANALYZE, BUFFERS)` for activity lists, link lookup, manifest,
  attempt issue, result acceptance, report filters, and retention batches.
- Add/revise indexes based on evidence and verify write amplification remains acceptable.
- Measure Neon scale-to-zero cold sign-in/first-play behavior and establish acceptable
  service objectives.
- Enable Neon usage alerts and apply the specification's upgrade-review thresholds.

### P4-07: Accessibility and cross-device quality

- Run automated and manual keyboard, screen reader, focus, contrast, zoom/reflow,
  reduced-motion, error identification, and touch-target checks.
- Test professional and public flows on the approved desktop/mobile/browser matrix.
- Verify QR/link entry, intermittent network behavior, game unavailable screens, and
  retry messaging with target users where approved.
- Publish accessibility claims only after the responsible reviewer approves them.

### P4-08: Backup, restore, and deployment safety

- Confirm Neon backup/restore behavior meets the approved pilot policy and document
  provider responsibilities.
- Restore into an isolated environment and verify counts, foreign keys, accepted result
  reproducibility, auth/profile linking, and audit history.
- Exercise application rollback and a forward database repair migration.
- Add a release checklist with migration lock, smoke tests, kill-switch access, and
  rollback owner.

### P4-09: Route-boundary and production cutover

- Verify `/` redirects to professional sign-in and does not render marketing content.
- Verify participant entry works only from a valid customized activity link.
- Verify the portal exposes no participant play action or public activity directory.
- Run visual regression and Playwright checks for portal and public-link states at the
  agreed desktop/mobile viewports.
- Exercise GameMaker handoff failure, recovery, and rollback behavior before cutover.

## Endpoint coverage

| Contract operation | Owning work package |
| --- | --- |
| `GET /activities/{activityId}/results` | P4-01 |

Any CSV export approved in P4-02 must be added to `api-contracts.md` before its Route
Handler is implemented; otherwise no export endpoint is part of V1.

## Required tests

- Aggregate counts/rates match raw accepted-result fixtures and remain unchanged by
  duplicate submission.
- Cross-owner and cross-organization report requests fail for every endpoint and direct
  service entry point.
- Historical reporting survives all activity/link/module/game terminal states.
- Retention dry-run and execution select the same eligible records; interrupted batches
  resume without over-deletion.
- Load tests meet the approved pilot objectives, and query plans use reviewed indexes.
- Backup restore and post-restore application smoke tests pass.
- Automated accessibility suites pass and manual findings are closed or explicitly
  accepted by the accountable owner.
- Portal and public-link visual/accessibility checks pass before domain cutover.

## Exit gate

- Specification acceptance criteria 11, the reporting portion of 12, 13, and 15 pass;
  all other acceptance criteria are rerun as regression tests.
- Every production decision in the roadmap is resolved and recorded with an owner.
- Dashboards, alerts, retention, backups, restore evidence, incident runbooks, support
  ownership, and rollback access are active before pilot users are provisioned.
- Privacy review confirms V1 neither collects nor exposes intended child identity.
- Product, pedagogy, security/privacy, accessibility, operations, and engineering owners
  approve the pilot release record.

## Rollback

Use availability kill switches to stop launches, retain professional reporting where
safe, roll back the application/game artifacts, and apply only forward database repair
migrations. Root-route, sign-in, portal, and customized-link smoke tests must pass after
rollback.
