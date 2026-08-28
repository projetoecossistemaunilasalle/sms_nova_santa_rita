# Current implementation roadmap

This roadmap follows the current architecture in
[`docs/current-architecture.md`](../current-architecture.md). It retains the
authenticated professional/admin portal, removes the landing page, and integrates one
existing GameMaker experience reached by participants only through customized opaque
links.

## Delivery sequence

| Workstream | Outcome |
| --- | --- |
| Foundation | Deployable Next.js application, Neon persistence, professional authentication, authorization, observability, and tested integration boundaries. |
| Portal and links | Professional/admin workspace for organizations, team access, customized access links, link lifecycle controls, and audit history. |
| Game integration | Anonymous link validation, play-session credentials, one GameMaker handoff, idempotent result ingestion, and safe failure states. |
| Reporting and hardening | Aggregate reporting, privacy and retention controls, accessibility, performance, backups, incident readiness, and production rollout. |

There is no landing-page workstream. There is no module catalogue, multi-game activity
builder, or portal gameplay workstream.

## Current delivery rules

- The GameMaker repository is the source of truth for game content, activities,
  minigames, sequencing, and game-side behavior.
- The portal manages access and operational context; it does not configure the contents
  of the GameMaker game.
- A participant enters only through a customized `/atividade/[token]` link.
- Portal and public-link authorization are separate. Participants never receive
  professional credentials.
- External GameMaker contract changes update checked-in schemas, fixtures, and tests in
  both repositories before implementation merges.
- Raw link, session, and attempt tokens are never logged or stored in plaintext.
- Results remain aggregate-only and contain no child identity dimensions.
- Product-visible Portuguese copy, desktop/mobile behavior, keyboard access, and
  reduced-motion behavior are reviewed with each surface.

## Open production decisions

- Final customized-link creation, rotation, expiry, and revocation contract.
- GameMaker browser deployment URL and exact handoff parameter/payload.
- Result payload, aggregation allowlist, and report presentation.
- Organization hierarchy and authorization scope.
- Retention durations and deletion/anonymization procedures.
- Hosting region, domain, backups, monitoring, incident, and support ownership.
- Accessibility responsibility split between the host and the GameMaker runtime.

## Legacy detailed plans

The files below describe the earlier multi-activity/module proposal. They remain useful
for authentication, transaction, privacy, idempotency, and operational research, but
their catalogue, activity composition, and landing-page tasks are not executable
requirements:

- [`phase-01-foundation-contracts.md`](phase-01-foundation-contracts.md)
- [`phase-02-activity-configuration.md`](phase-02-activity-configuration.md)
- [`phase-03-game-integration.md`](phase-03-game-integration.md)
- [`phase-04-reporting-hardening.md`](phase-04-reporting-hardening.md)

Reconcile each legacy plan with the current architecture before implementing its
backend work.
