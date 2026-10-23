# Portal integration handoff

Status: portal-side implementation present; real-game and staging acceptance pending.

## Implemented boundary

- `POST /api/v1/player/bootstrap` takes `{ "request_id": string }` and a
  short-lived launch bearer in `Authorization`; it returns a V1 new/returning
  player bootstrap. The bearer is rechecked against current credential, player,
  class, organization, participation, and session status.
- `POST /api/v1/player/state` takes the V1 `game.save.v1` payload and the same
  bearer. The first write expects revision 0; subsequent writes use optimistic
  revision checks. A stale divergent write returns HTTP 409 with the authoritative
  snapshot. An identical committed retry is acknowledged as success.
- `POST /api/v1/player/results` and `/api/v1/player/active-time` accept queued V1
  event envelopes, reject a reused ID with different content, and acknowledge
  exact retries. The teacher reports are class-scoped through adult application
  authorization, not navigation visibility.
- The host accepts bridge messages only from the configured iframe origin and
  window, keeps QR/launch credentials outside GameMaker, and durably queues state
  and events in IndexedDB before telling the game they are locally durable. The
  static demo uses synthetic state and does not issue production credentials.

## Verification performed

`npm run check` passes with 276 tests. Both `npm run build:demo` and
`npm run build:server` pass. In the in-app browser, a teacher started a demo
session, Player 01 entered by QR, saved one synthetic step, and rescanned to
recover revision 1; the host fit a 390px mobile viewport. Refresh after the URL
credential is scrubbed intentionally requires a rescan rather than persisting the
long-lived QR bearer.

## Acceptance still required

1. Supply an actual staging Neon connection and `GAME_CLIENT_URL`. The checked-in
   `.env` uses `ep-example...` hosts and no game URL; no migration has been applied
   to a real database.
2. Build the companion GameMaker HTML5 target, then verify its snapshot
   import/export, bridge protocol, result delivery, active-time signals, and
   conflict recovery with the portal host. The sibling `Heroes_Trial` repository
   now has V1 snapshot, browser bridge, and supported-result code, but lacks an
   HTML5 target/options configuration. Its bounded Igor Windows compile stopped
   in asset-compiler startup before GML compilation, so integration is not
   verified by an executable game build. The portal's deterministic demo is not
   proof of real-game compatibility. GameMaker now has a conservative 30-second
   engagement lease driven by observed world/minigame input and host visibility,
   with increment retry until local durability acknowledgment; its timing and
   coverage still need in-game verification. Do not substitute elapsed
   page-open time.
3. Exercise two-device state continuation, duplicate event ingestion, reporting,
   temporary offline reconnection, and QR scanning on the target tablets. These
   are acceptance gates, not prerequisites for further code hardening.
4. Remove or redirect the remaining legacy activity and Materials production
   routes after the V1 path is accepted. They are hidden from V1 navigation but
   still exist in the route tree.

Old-session offline events remain pending when a new session bootstrap replaces
the cache. They cannot be uploaded with a new launch token bound to a different
participation. Define an old-participation renewal or explicit-discard policy
before relying on offline recovery across session rollover. Bootstrap request
generations prevent delayed prior-session responses from replacing a newer cache;
the host also rejects enqueue or sync when its launch session does not match the
cached bootstrap, leaving the old events pending instead of cross-attributing them.

The IndexedDB event-request registry retains each request's client event ID and
SHA-256 content fingerprint after upload, so retries keep the original ID and
changed-content reuse is rejected. Entries are currently unbounded; any pruning
policy must preserve the supported retry window.
