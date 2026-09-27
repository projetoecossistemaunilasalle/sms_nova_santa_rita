# V1 Game Integration Dossier

> **Status: historical planning record.** This dossier recorded the V1 product
> and integration direction when it was written. It has been superseded by
> [`refactor-dossier/IMPLEMENTATION-READY.md`](refactor-dossier/IMPLEMENTATION-READY.md)
> and [`current-architecture.md`](current-architecture.md); the body below is
> kept unedited for historical research and must not be followed as current
> guidance.

Status: V1 product and implementation direction  
Last aligned: 22 September 2026  
Scope: first production-capable version of the portal working end to end with the existing GameMaker game

## 1. Purpose

V1 should prove one complete operational loop:

1. administrators prepare the organization and classes;
2. teachers use already-prepared classes with very little setup;
3. children enter the game quickly through numbered player access;
4. the same player can continue the same game state across different school tablets;
5. the game reports usage and results back to the portal;
6. authorized adults can inspect class and per-player activity without requiring a full child account.

The priority is the portal-to-game workflow. The Materials area is explicitly deferred to a later version and must not drive V1 architecture, navigation, or delivery.

## 2. V1 product boundary

V1 contains three connected surfaces:

- the authenticated professional/admin portal;
- the low-friction player entry flow;
- the existing GameMaker runtime.

The portal owns organizational structure, adult access, class setup, player access credentials, session/context management, reporting, and persistence services required by the game.

GameMaker remains the source of truth for gameplay content, rules, world behavior, cosmetics, rewards, and the meaning of game-state fields.

The integration between the portal backend and GameMaker must remain versioned so that portal releases and game releases can evolve independently.

## 3. Adult access model

V1 uses three adult permission levels.

### Level 1: Platform administrator

Responsibilities:

- create and manage organizations;
- assign or manage organization administrators;
- inspect platform-wide administrative information;
- perform platform-level support and oversight.

A platform administrator should not be required for routine classroom operation.

### Level 2: Organization administrator

Responsibilities:

- manage the organization;
- create and maintain classes;
- assign teachers to classes;
- manage organization-level staff access;
- perform the structural setup that teachers should not have to do during normal use.

This role owns class administration in V1.

### Level 3: Teacher

Responsibilities:

- access only assigned classes;
- prepare the numbered player slots needed for a class;
- start or select the game session/context for classroom use;
- distribute or use player QR codes;
- view class results and numbered-player results.

The teacher workflow must be optimized for speed rather than configurability. Routine use should not require the teacher to create organizations, build class structures, create child accounts, manage passwords, or enter a roster.

## 4. Class model

Classes are created by the organization administrator and assigned to teachers.

A class is an organizational object, not a child roster.

Example:

```text
Organization
  School / unit
    Class 2A
      assigned teacher(s)
      player slots
      game sessions
```

The portal does not require a nominal list of students for V1.

## 5. Numbered player model

V1 should use numbered player slots instead of conventional child accounts.

Example:

```text
Player 01
Player 02
Player 03
...
Player 25
```

The recommended classroom convention is:

```text
Player 01 = first child on the teacher's attendance list
Player 02 = second child on the attendance list
Player 03 = third child on the attendance list
...
```

This association exists operationally for the teacher. The portal does not need to store the child's name to make the numbered result useful.

### Why this model exists

It provides enough continuity to support:

- individual game state;
- individual activity history;
- active-play time;
- per-player results;
- cross-device continuation;

without requiring:

- child email addresses;
- child passwords;
- parent accounts;
- a complete student roster;
- a conventional registration flow.

### Stability rule

Once a numbered player has game state or activity associated with it, the system must not silently renumber or recycle that slot for another child.

If a new child joins a class, the safest default is to create an additional player slot instead of renumbering existing players.

## 6. Player access and QR codes

Each numbered player receives a fast access credential, preferably represented as a QR code and backed by an opaque high-entropy token.

The intended experience is:

```text
child picks up any available school tablet
        |
scans their player QR code
        |
system resolves the numbered player
        |
game loads that player's current state
```

There is no username/password login for the child in V1.

### Security model

The QR code is a bearer credential. Possession of the credential can be enough to open that player profile.

This means V1 does not prove the physical identity of the child using the device. The design intentionally favors low friction over strong identity assurance.

Required operational controls:

- credentials must be unguessable;
- a lost or exposed credential should be replaceable;
- replacing a credential must not destroy the player's game state;
- player credentials must not be exposed through public indexes or discovery routes.

## 7. Player identity scope

V1 intentionally avoids solving long-term student identity across school years.

Within the active class cycle, the numbered player identity must be stable enough to keep game state and history.

The following is explicitly deferred:

- automatic promotion from one year's class to another;
- preserving the same school identity when a child changes class;
- mapping Player 07 in one class to a different player number in a later class;
- longitudinal student records across years.

This is a future migration problem, not a V1 requirement.

V1 data structures should avoid making future migration impossible, but no cross-year identity workflow should be built now.

## 8. Game state persistence

The game must support continuation across different school tablets.

Therefore, browser storage cannot be the authoritative source of world state.

The backend must persist the player's game state or a versioned representation of it. The state may include, depending on the GameMaker contract:

- world/progression state;
- unlocked cosmetics or skins;
- currencies or rewards;
- checkpoints;
- other persistent game-owned values.

The portal should not interpret game-specific business rules unless the contract explicitly requires it. GameMaker owns the meaning of these values.

A player should be able to use Tablet A today and Tablet B later and continue from the state stored for the same numbered player.

## 9. Session and player context

Player identity and classroom/game session context are separate concepts.

Player answers:

> Who is this game state associated with?

Session/context answers:

> Which classroom use or game session is happening now?

Conceptually:

```text
Class
  |
  +-- Player 07
  |
  +-- Session A
  +-- Session B

Player 07 + Session B = participation
```

The exact entry UX for combining the player's QR credential with the active session should be kept as low-friction as possible.

Preferred V1 direction:

1. teacher selects or starts the current class session;
2. child scans only their player QR;
3. the backend resolves both the player and the active class/session context;
4. GameMaker receives the resolved context.

If the final GameMaker integration requires a different sequence, the invariant remains: do not require the child to type credentials or complete a conventional login flow.

## 10. Results model

V1 results are no longer aggregate-only.

The portal should support both:

- class-level summaries;
- results associated with a numbered player.

The portal does not need the child's name to show:

```text
Player 07
active time: 42 min
sessions played: 4
results: ...
```

The teacher can interpret Player 07 using the class attendance order.

The result contract must be agreed with the GameMaker project before production. The portal must not invent a second gameplay scoring model.

## 11. Active-play time

The stakeholders want a way to use participation or time played as an incentive signal.

V1 should track active gameplay time, not merely page-open duration.

Preferred behavior:

- count time while gameplay is active;
- pause or stop accumulation when the game is backgrounded, inactive, or otherwise not meaningfully running;
- store time in small resumable increments;
- associate time with the numbered player and relevant session;
- synchronize pending time when connectivity returns.

This metric is an operational indicator, not cryptographic proof that a specific physical child personally used the device for every recorded second.

## 12. Offline behavior

Offline resilience is part of the intended V1 game experience.

The authoritative persistent state remains server-side, but the client may cache state and queue changes locally.

Recommended browser-storage split:

- `localStorage` only for small simple values when appropriate;
- IndexedDB for structured cached state, queued events, pending metrics, or larger offline data.

Expected flow:

```text
ONLINE
server state -> game
game changes -> server

TEMPORARILY OFFLINE
last synchronized state -> game
game changes -> local queue

CONNECTION RETURNS
local queue -> synchronization -> server
```

### Offline limitation

A tablet that has never loaded a player's current state cannot retrieve that state while completely offline.

V1 should therefore guarantee offline continuation after an initial synchronized load on that device. Supporting a first-ever login on an unseen device with no network would require a separate pre-synchronization workflow and is outside the current requirement.

## 13. Synchronization considerations

Offline synchronization must distinguish between event-like data and mutable game state.

Event-like data can include:

- active-time increments;
- completed interactions;
- result events;
- session participation.

Mutable state can include:

- inventory;
- currencies;
- cosmetics;
- world progression.

The final conflict policy must be defined together with the GameMaker state contract.

V1 should avoid assuming that "last write wins" is safe for every game-owned value.

## 14. Materials is deferred

The Materials area is not part of V1.

For V1:

- do not prioritize Materials implementation;
- do not make Materials a dependency of the game workflow;
- remove or hide the Materials navigation entry from the production V1 experience;
- preserve any existing demo/research code only if it does not increase maintenance or block delivery;
- revisit content/material publishing in a later product version.

No V1 acceptance criterion should depend on material authoring, approval, publishing, attachments, or a content-management workflow.

## 15. V1 navigation and functional focus

The production-oriented V1 portal should concentrate on:

- Overview;
- Access / player entry management;
- Results;
- Classes;
- Team and permissions;
- Organizations;
- Audit or administrative traceability where required.

Materials is excluded.

Existing demo navigation is not itself a production requirement. Screens should exist only where they support the end-to-end workflow.

## 16. Conceptual data model

This is a conceptual direction, not a final Prisma schema.

```text
Organization
  |
  +-- OrganizationMembership
  |
  +-- ClassGroup
        |
        +-- TeacherAssignment
        |
        +-- PlayerSlot
        |     |
        |     +-- PlayerCredential
        |     +-- GameState
        |
        +-- GameSession
              |
              +-- Participation
                    |
                    +-- Result
                    +-- ActiveTimeEvent
```

### Important modeling constraints

- `PlayerSlot` is not a full student profile.
- No name is required on `PlayerSlot` for V1.
- the visible player number is scoped to a class;
- an internal database identifier must be separate from the visible player number;
- QR credentials must be rotatable without changing the player record;
- game state must not be keyed only by browser/device;
- session records must remain distinct from persistent player game state.

## 17. GameMaker integration responsibilities

The versioned integration contract should eventually cover at least:

### Portal/backend to game

- resolved player identifier/context;
- class/session context;
- current game-state payload or state reference;
- protocol/schema version.

### Game to portal/backend

- updated persistent game state;
- result events;
- active-time events or resumable usage metrics;
- synchronization metadata required for offline recovery.

The portal must not own minigame definitions, game sequencing, skin rules, reward rules, or gameplay logic.

## 18. Privacy posture

V1 intentionally minimizes child data.

The portal should not require:

- child name;
- email;
- password;
- date of birth;
- parent account;
- free-form child profile data.

However, a numbered player with persistent game state is still a persistent record and must be handled carefully.

The product should not claim that a record is fully anonymous merely because the portal does not store the child's name. The teacher may still be able to associate Player 07 with a real child through the attendance list.

The practical goal is data minimization, not pretending that no association exists.

## 19. Required changes from the current repository assumptions

The current repository documentation and demo were built around several assumptions that are now outdated.

V1 must replace these assumptions:

### Old assumption: participants are anonymous play sessions only

New direction: numbered player slots provide persistent game continuity and per-player reporting without full child accounts.

### Old assumption: results are aggregate-only

New direction: class aggregates remain useful, but results may also be associated with a numbered player.

### Old assumption: public access is only a session link

New direction: player QR credentials are required for persistent player access. Session/context still exists separately.

### Old assumption: classes have no player-level structure

New direction: classes contain numbered player slots, but not a conventional nominal student roster.

### Old assumption: professional roles can remain generic

New direction: V1 explicitly distinguishes platform administrator, organization administrator, and teacher.

### Old assumption: Materials is part of the near-term portal surface

New direction: Materials is deferred beyond V1.

## 20. V1 acceptance criteria

V1 is functionally complete when the following end-to-end path works:

1. a platform administrator can establish an organization and organization admin access;
2. an organization administrator can create a class and assign a teacher;
3. the teacher can prepare the required number of numbered players with minimal interaction;
4. each numbered player can receive a QR-based access credential;
5. a child can enter using that credential without username/password registration;
6. the same numbered player can use different supported school tablets and recover the same server-persisted game state;
7. the teacher can run or select the relevant class game session/context;
8. the GameMaker runtime receives the player and session context it needs;
9. game state can be saved and loaded;
10. active-play time can be recorded;
11. results can be associated with the class and numbered player;
12. temporary offline play can queue supported changes and synchronize after reconnection;
13. the teacher can inspect useful class and numbered-player results;
14. Materials is not required for any of the above.

## 21. Explicitly deferred

The following should not block V1:

- Materials/content-management workflows;
- nominal child roster management;
- child email/password authentication;
- parent/family accounts;
- automatic student promotion between school years;
- longitudinal identity across classes and years;
- advanced identity verification;
- first-ever offline access on a device with no cached player state;
- complex analytics beyond the metrics required for classroom use;
- configurable gameplay content in the portal;
- multiple game runtimes or a minigame catalog.

## 22. Implementation order

A sensible implementation sequence is:

1. align the data model around organizations, classes, adult roles, and numbered player slots;
2. implement production adult authentication and authorization;
3. implement organization-admin class management and teacher assignment;
4. implement player-slot generation and QR credential lifecycle;
5. define the versioned GameMaker player/session/state contract;
6. implement cross-device game-state load/save;
7. implement result and active-time ingestion;
8. implement teacher-facing results;
9. add offline queueing and synchronization behavior;
10. remove or hide Materials from the V1 production navigation;
11. harden audit, credential rotation, authorization, and failure states;
12. validate the complete workflow on the actual school tablet/browser environment.

## 23. Open implementation questions

These questions should be resolved during implementation, without reopening the product scope unless necessary:

- whether the teacher or organization administrator sets the initial player count;
- the exact UI for activating a class/session before children scan their player QR codes;
- how GameMaker serializes persistent state;
- the conflict policy for concurrent or offline state updates;
- which result fields are useful enough to expose in V1;
- the inactivity threshold used for active-play time;
- how long inactive class/player records are retained;
- whether audit history is required for every player-state action or only adult administrative actions.

These are implementation details within the V1 direction, not reasons to reintroduce a full child account system.
