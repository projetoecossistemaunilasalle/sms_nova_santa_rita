# V1 implementation roadmap

This roadmap implements the product boundary in
[`../current-architecture.md`](../current-architecture.md) and the detailed direction in
[`../v1-game-integration-dossier.md`](../v1-game-integration-dossier.md).

The historical plan is [`v1-architecture-plan.md`](v1-architecture-plan.md); it is
superseded by [`../refactor-dossier/IMPLEMENTATION-READY.md`](../refactor-dossier/IMPLEMENTATION-READY.md).
It reviewed
the gap between the current demo and the target architecture, recorded the working
technical decisions, and divides delivery into end-to-end slices.

## Delivery order

| Slice | Usable outcome |
| --- | --- |
| 0. Runtime foundation | GitHub Pages remains a static mock-backed demo while the server build uses Neon Auth and database access. |
| 1. Organizations and classes | Platform and organization admins can manage staff, classes, and teacher assignments. |
| 2. Player access and sessions | Teachers can prepare numbered players, issue QR credentials, and activate one class session. |
| 3. Game state integration | A QR entry resolves player/session context and the game can load and save versioned state across devices. |
| 4. Results and active time | Game events are ingested once and teachers can inspect class and per-player activity. |
| 5. Offline and rollout | Previously loaded players can continue temporarily offline and synchronize on reconnection. |

## Current status

- Slice 0 is complete: the repository has explicit static-demo and server targets,
  Neon Auth is behind the authentication gateway, and the initial V1 adult/class
  schema migration is present.
- Slice 1 is complete: organizations, adult memberships, classes, and teacher
  assignments are handled by authorized application services; server pages use
  Prisma and Server Actions; the GitHub Pages build uses browser-persisted demo
  state with a role switcher.
- The V1 GameMaker transport contract is frozen in JSON Schema and Zod, with fixtures
  covering bootstrap, state saves and conflicts, results, active time, visibility,
  acknowledgements, and typed errors.
- Slice 2 is complete: classes have durable monotonic player slots, rotatable QR
  credentials, one active game session, idempotent participation, and a fixed player
  entry route. The GitHub Pages demo mirrors the workflow in browser-persisted state.
- Slices 3-5 have portal-side implementations in the current working tree:
  bootstrap/revisioned state, the browser bridge and demo adapter, retry-safe
  result/time ingestion, teacher reports, and the IndexedDB synchronization queue.
  They are not yet accepted end to end: migrations, real GameMaker HTML5 integration,
  two-device behavior, reconnect, and school-tablet QR/reporting checks remain.

Slice 2 lifecycle and static-hosting decisions are recorded in
[`slice-02-player-access-decisions.md`](slice-02-player-access-decisions.md).
The newer portal integration and verification boundary is recorded in
[`slice-03-05-portal-handoff.md`](slice-03-05-portal-handoff.md).

The structural debt accumulated by the three coexisting generations (demo CMS, V1 platform, static mock) and the
phased plan to remove it are recorded in the
[23 September 2026 architecture audit](../architecture-audit-2026-09-23.md). That audit is historical evidence of the
pre-refactor state; the debt it describes has since been addressed by the refactor recorded in
[`../refactor-dossier/IMPLEMENTATION-READY.md`](../refactor-dossier/IMPLEMENTATION-READY.md).

Each slice ends with a demonstrable workflow. Broad hardening, large test matrices, and
secondary administration features should not delay the first complete portal-to-game
loop.

## Superseded plans

The following files describe older activity-builder, module-catalogue, anonymous-link,
and aggregate-only assumptions. They remain historical research, not executable V1
plans:

- [`phase-01-foundation-contracts.md`](phase-01-foundation-contracts.md)
- [`phase-02-activity-configuration.md`](phase-02-activity-configuration.md)
- [`phase-03-game-integration.md`](phase-03-game-integration.md)
- [`phase-04-reporting-hardening.md`](phase-04-reporting-hardening.md)

Do not implement tasks from those files unless they are explicitly carried into the
current V1 plan.
