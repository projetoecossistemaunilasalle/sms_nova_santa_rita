# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product purpose

Missões do Caramelito combines an authenticated professional/admin portal with a low-friction player entry flow for one existing GameMaker experience.

V1 is focused on making the full portal-to-game workflow work in production conditions. The portal prepares organizations, classes, adult permissions, player access, game context, persistence, and reporting. The existing GameMaker project remains the single gameplay runtime and source of truth for gameplay content and behavior.

The current implementation reference is
[docs/refactor-dossier/IMPLEMENTATION-READY.md](docs/refactor-dossier/IMPLEMENTATION-READY.md),
and the technical boundary is described in
[docs/current-architecture.md](docs/current-architecture.md). Older repository
documents that conflict with these are historical records, not guidance.

## Users

- **Platform administrators** manage organizations and create accounts for organization administrators or professionals.
- **Organization administrators** manage organization structure, classes, professional assignments, and staff access, and create professional accounts within their own organizations.
- **Professionals (Profissional)** include educators and PSE staff. They use already-prepared classes, prepare numbered player access with minimal setup, run classroom game sessions, and inspect class and numbered-player results.
- **Children** access the game through low-friction numbered player credentials, preferably QR codes. They do not create conventional accounts, usernames, passwords, or email-based profiles.

## V1 adult roles

V1 has three adult permission levels:

1. Platform administrator.
2. Organization administrator.
3. Professional (displayed as Profissional; legacy `TEACHER` / `teacher` identifiers remain compatible).

Teachers should not be required to create organizations, build school structure, maintain full child rosters, or administer passwords.

## Player model

V1 does not use a conventional child account model.

Each class can contain numbered player slots such as:

- Player 01
- Player 02
- Player 03

The recommended operational convention is to match those numbers to the teacher's attendance-list order. The portal does not need to store the child's name for V1.

A numbered player can own persistent game state and can have results and active-play time associated with it.

The system must not silently renumber or recycle a player slot after game state or activity has been attached to it.

## Player access

Each numbered player receives an opaque access credential, preferably represented as a QR code.

The credential is designed for speed on shared school tablets:

1. the child uses any available supported tablet;
2. the child scans their player QR;
3. the system resolves the numbered player;
4. the game loads that player's server-persisted state.

The QR credential is a bearer credential, not strong identity verification. It should be unguessable and rotatable without destroying player state.

## Classes and sessions

Classes are created by organization administrators and assigned to teachers.

A class is an organizational object, not a nominal child roster.

Player identity and game-session context are separate:

- the numbered player identifies which persistent game state is being used;
- the session/context identifies which classroom use is happening now.

The child flow must remain as low-friction as possible and must not require conventional login.

## Game state

The game must support continuation across different school tablets.

Server-side persistence is authoritative for player game state. Browser storage may support temporary offline operation, but must not be the only copy of world/progression state.

GameMaker owns the meaning and rules of game state, including gameplay progression, cosmetics, rewards, currencies, and other game-owned values. The portal/backend stores and synchronizes the state through a versioned integration contract.

## Results and usage

V1 supports both:

- class-level summaries;
- per-numbered-player results.

V1 should also support active-play time as an operational participation metric.

Active-play time should represent meaningful game activity rather than simple page-open duration.

The metric is useful for classroom follow-up and incentives, but it is not proof that a specific physical child personally used the device for every recorded second.

## Offline behavior

Temporary offline play is part of the intended V1 experience.

The client may cache synchronized state and queue supported changes or metrics locally. IndexedDB is the preferred direction for structured offline state and queued events; localStorage may still be used for small simple values where appropriate.

A device that has never loaded a player's current state cannot retrieve that state while completely offline. V1 should guarantee offline continuation after an initial synchronized load, not first-ever offline access on an unseen device.

## Cross-year continuity

V1 does not solve long-term student identity across school years.

Automatic promotion, cross-class identity migration, and mapping a player from one year's class to another are explicitly deferred.

The V1 data model should avoid blocking future migration, but no longitudinal student identity workflow should be built now.

## Materials

Materials/content management is not part of V1.

The Materials area has been removed from the portal navigation, and no V1
backend, authorization, or acceptance criterion depends on it.

Material authoring, approval, publishing, attachments, and related CMS behavior are deferred to a later product version.

## Product boundary

V1 has three connected surfaces:

1. the authenticated professional/admin portal;
2. the player entry and context-resolution surface;
3. the existing GameMaker runtime.

### Portal/backend owns

- adult authentication and authorization;
- organizations and adult team access;
- class management;
- teacher assignment;
- numbered player slots;
- player credential lifecycle;
- session/context management;
- player-state persistence services;
- result ingestion and reporting;
- active-play metrics.

### GameMaker owns

- gameplay;
- activities and minigames inside the game;
- game rules;
- world behavior;
- progression meaning;
- cosmetics and reward logic;
- production of game-side result/state events.

The portal must not become a game editor, minigame catalog, or second source of truth for gameplay behavior.

## Integration principles

- The GameMaker integration uses versioned contracts.
- Portal releases and GameMaker releases should remain independently deployable where possible.
- Player credentials and session context are separate concepts.
- Game state must not be keyed only by browser or device.
- Public/player credentials must be opaque and excluded from public discovery.
- The portal should minimize child data instead of claiming that numbered player records are fully anonymous.

## Privacy posture

V1 intentionally avoids requiring:

- child names;
- child email addresses;
- child passwords;
- birth dates;
- parent accounts;
- free-form child profile fields.

However, a numbered player with persistent state is still a persistent record. A teacher may be able to associate Player 07 with a real child through the attendance list.

The product goal is data minimization and low friction, not a claim that no association can exist.

## V1 functional focus

The production-oriented portal should concentrate on:

- Overview;
- Access / player entry management;
- Results;
- Classes;
- Team and permissions;
- Organizations.

Materials is excluded.

## Brand commitments

- Product name: Missões do Caramelito.
- Institutional context: Programa Saúde na Escola and the municipal network of Nova Santa Rita.
- Primary language: Brazilian Portuguese.
- Product communication should present the game as a tool for conversation, learning, and collective care without claiming clinical or individualized outcomes.

## Evidence and legacy documents

- The existing GameMaker project is the reference for gameplay behavior and game-owned state.
- `contracts/schemas/` contains the versioned, fixture-tested V1 transport contracts shared by the route handlers, the browser host, and GameMaker; see `contracts/schemas/README.md`.
- [docs/v1-game-integration-dossier.md](docs/v1-game-integration-dossier.md) is retained as a historical planning record; the current references are [docs/refactor-dossier/IMPLEMENTATION-READY.md](docs/refactor-dossier/IMPLEMENTATION-READY.md) and [docs/current-architecture.md](docs/current-architecture.md).
- [docs/current-architecture.md](docs/current-architecture.md) describes the current web/technical boundary.
- `portal-v1-specification.md`, older phase plans, and earlier aggregate-only/link-only assumptions are retained as historical research where they conflict with the current V1 direction.
- This repository contains no real-world outcome evidence, clinical validation, or formal compliance certification. Future work must not fabricate such evidence.
