# Slice 2 player access decisions

Status: Implemented for Slice 2.

## Entry and credentials

- Every QR contains the single entry URL `/jogar/?cred=<token>`. The opaque token is
  carried in the query string so the route itself has no build-time token segment.
- The GitHub Pages export therefore emits one static `/jogar/index.html` shell. Its
  client adapter reads the query string and resolves credentials from browser state,
  including slots allocated after the static build. URL construction includes the
  configured `/SMS_Portal` demo base path.
- Server credentials are 32 random bytes encoded as base64url. Only their SHA-256
  hash is stored. A credential is active until rotation; rotation sets `revokedAt` on
  the old row and creates a new credential without changing the player slot.
- A successful server entry issues a stateless, HMAC-signed launch token containing
  the participation, player, and game-session identifiers. It expires after five
  minutes and is not persisted. It is replayable during that short window. The Slice
  3 bootstrap will verify its signature and expiry and recheck credential, slot,
  class, organization, and session status before accepting it.
- Demo credentials are browser-persisted, prefixed with `demo_player_`, labelled as
  non-production, and deliberately do not depend on server secrets. Demo launch
  context is illustrative and must never be accepted by the server runtime. Browser
  storage makes newly created credentials usable after export on the same origin and
  browser; cross-device demo synchronization is intentionally not provided.
- Raw server tokens are returned only by allocation or rotation. Because the database
  cannot reconstruct them from a hash, a later "print again" operation rotates the
  credential and clearly warns that the previous printed QR becomes revoked.

## Slots and sessions

- A player slot stores only a durable internal identifier, class identifier, visible
  number, status, and timestamps. It stores no child name or profile data.
- Allocation is monotonic. A transaction reads the class allocation watermark,
  advances it, and creates the requested consecutive numbers. Numbers are never
  reused. Slots can be disabled by status but are not deleted or renumbered in V1.
- Organization administrators and teachers with an active assignment may allocate
  slots, rotate a slot credential, and start or end the session for that class.
  Platform administrators retain structural administration but do not implicitly
  operate a class. All checks run in application services and require active profile,
  organization, membership, class, and teacher assignment records.
- A game session starts as `ACTIVE` and ends as `ENDED`. Ending is final. Starting is
  rejected while another active session exists; a partial unique database index on
  `class_group_id` for active rows provides the final concurrency guard.
- Participation is created only when an active credential enters while its class has
  an active session. The unique `(gameSessionId, playerSlotId)` constraint makes entry
  idempotent. Server entry locks the credential row before checking revocation,
  then locks the active session row through the participation upsert. Rotation and
  session ending therefore serialize with QR resolution.

## Entry states

- `invalid`: the credential is missing, malformed, or unknown.
- `revoked`: the token matches a stored credential whose `revokedAt` is set.
- `inactive`: the credential is known but its slot, class, or organization is not
  active.
- `waiting`: the credential and scope are active, but the class has no active game
  session. No session or participation is created.
- `ready`: the active credential resolved an active session and participation exists;
  a short-lived launch context is returned.
- `ended`: a previously issued launch context names a session that has ended. It is a
  bootstrap concern for Slice 3; a fresh credential scan currently returns `waiting`.
- `unauthorized`: an adult is authenticated but lacks active administrative membership
  or teacher assignment for the requested class operation. It is never inferred from
  hidden navigation alone.
- `expired`: a signed launch token is past its five-minute expiry. Validation and its
  player-facing screen are introduced with the Slice 3 bootstrap endpoint.

## Database enforcement and deferrals

- The database enforces unique player number per class, unique credential hash,
  unique participation per player/session, foreign-key integrity, and at most one
  active session per class. The class allocation watermark enforces monotonic slot
  allocation without relying on the current maximum surviving row.
- Game state, launch-token consumption, GameMaker bootstrap, result and active-time
  ingestion, offline queues, and advanced reporting are intentionally deferred to
  Slice 3 or later. Slice 2 does not pass the long-lived QR credential to GameMaker.
