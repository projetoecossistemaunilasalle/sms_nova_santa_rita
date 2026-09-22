# V1 implementation roadmap

This roadmap implements the product boundary in
[`../current-architecture.md`](../current-architecture.md) and the detailed direction in
[`../v1-game-integration-dossier.md`](../v1-game-integration-dossier.md).

The executable plan is [`v1-architecture-plan.md`](v1-architecture-plan.md). It reviews
the gap between the current demo and the target architecture, records the working
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
- Slice 2 and later remain unimplemented. In particular, there are no player slots,
  QR credentials, game sessions, result ingestion, or offline synchronization yet.

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
