# Slice 2 implementation handoff

Snapshot: 22 September 2026, after the Slice 2 implementation and verification
commands ran in the current workspace.

This records the original handoff snapshot. The continuation outcome is at the end
of the document.

## Where work stopped

The Slice 2 implementation is present in the working tree and both runtime builds
compile. The work stopped before the requested independent final review and before
creating any Slice 2 commits. No migration was applied to a real Neon database and no
manual tablet/browser QR scan was performed. The requested static-export check was
verified at the route/build-output level: the demo emits a fixed `out/jogar/index.html`
shell, and the QR builder constructs URLs with the `/SMS_Portal/jogar/` base path.

The committed baseline remains `835c207` on `main` (the branch is already four commits
ahead of `origin/main` from the approved foundation). There are no new Slice 2 commits.
The handoff document itself is the only file added for this handoff request.

## Implemented workflow

1. An authorized organization administrator or assigned teacher opens a class and
   allocates one to 100 consecutive numbered players.
2. The server generates a 256-bit opaque token. The database receives only its
   SHA-256 hash; the raw token is returned once to the UI and encoded locally into a
   printable QR card. Demo tokens are browser-persisted and begin with
   `demo_player_`.
3. The adult can replace a player's credential. Rotation revokes the old credential
   without changing the player slot; the old QR resolves to `revoked`. The printable
   token is not recoverable after reload, so generating it again rotates the
   credential and invalidates the prior print.
4. The adult starts or ends the class's current session. The database partial unique
   index prevents two active sessions for one class.
5. A player scans `/jogar/?cred=<token>`. The fixed client-rendered route reads and
   removes the query from browser history, then calls the runtime-specific resolver.
   A valid credential without an active session sees `waiting`; it creates no
   participation. With an active session it creates or reuses the unique player/session
   participation and sees `ready`.
6. On the server, a ready entry receives a stateless HMAC-SHA256 launch token with a
   five-minute expiration. On the demo it receives a clearly non-production launch
   value. Neither launch value is yet consumed by GameMaker.

The GitHub Pages build does not need to know credential values or dynamic token paths
at build time. It emits one static `/jogar/index.html`; query parameters select the
credential only after the shell loads. Slots created after export work on the same
browser/origin because the demo stores their token and revocation history in
`localStorage`. This mock does not synchronize teacher state to a different device.

## Main changes

- `prisma/schema.prisma` and `prisma/migrations/3_slice_02_player_access/migration.sql`
  add the credential/session enums and `PlayerSlot`, `PlayerCredential`,
  `GameSession`, and `Participation` models. `ClassGroup.nextPlayerNumber` is the
  allocation watermark.
- `src/application/player-access/` provides shared DTOs, ports, validation, and
  application services. The service enforces active-profile, organization, class,
  membership, role, and assignment checks rather than relying on page visibility.
- `src/server/db/prisma-player-access-store.ts` implements the Prisma adapter. It
  allocates using the class counter, rotates credentials transactionally, and uses an
  upsert for idempotent participation.
- `src/server/security/player-credential-tokens.ts` issues/hashes player tokens;
  `src/server/security/launch-token.ts` signs and verifies short-lived launch claims.
- `src/app/(professional)/portal/player-access-actions.ts` exposes the adult
  mutations. `src/app/(public-play)/jogar/` supplies the fixed public route and server
  resolver.
- `src/runtime/adult-portal-demo-store.ts` has a v2 browser state with player slots,
  credential tombstones, sessions, and participations. The demo action modules use the
  shared `PlayerAccessService` to preserve behavior parity.
- `src/components/portal/class-detail-screen.tsx` now includes the player/session
  workflow. The new workflow and print-sheet components provide slot allocation,
  credential rotation, locally generated QR cards, print-all, and session controls.
  The public entry component distinguishes invalid, revoked, inactive, waiting,
  ready, ended, unauthorized, and expired copy.
- Runtime aliases and base-path wiring are in `next.config.ts` and `tsconfig.json`;
  `src/proxy.ts` sets `no-referrer` for player-entry paths.
- `docs/implementation/README.md`, `docs/implementation/v1-architecture-plan.md`, and
  `docs/implementation/slice-02-player-access-decisions.md` record the roadmap and
  implementation decisions.

## Decisions and boundaries

- QR route: one static `/jogar/` path with a `cred` query parameter, not a dynamic
  token path. Demo URLs include `/SMS_Portal`; update `APP_BASE_PATH` if the GitHub
  Pages project path changes.
- Server credential entropy: 32 random bytes, base64url-encoded. Persist only the
  SHA-256 hash. Keep revoked credential rows so old QR codes resolve distinctly from
  unknown credentials.
- Slot numbers are unique per class and monotonic. The watermark avoids reuse even if
  an old slot row is removed outside the application. Current service/UI has no slot
  disable or delete action, although the schema uses `RecordStatus`; do not add hard
  deletion or recycling without revisiting history constraints.
- Session transition is `ACTIVE -> ENDED`; ending is final. The partial unique index
  on active sessions is the concurrency guard. Participation is unique per
  `(game_session_id, player_slot_id)`.
- A launch token is stateless and replayable within its five-minute lifetime. Slice 3
  must verify signature/expiry and re-check that its credential, slot, class,
  organization, and session are still active before bootstrap. Rotation and ending a
  session should invalidate an outstanding token by those checks.
- `waiting` creates no participation; `ready` creates it. A fresh QR scan after a
  session ended returns `waiting`. The `ended` and `expired` UI states exist for the
  later launch/bootstrap boundary and are not emitted by current QR resolution.
- Cross-device state, GameMaker bootstrap, launch-token consumption, game-state
  persistence, results, active time, offline queues, reporting, and advanced analytics
  remain Slice 3 or later.
- Full decision details are in
  [`slice-02-player-access-decisions.md`](slice-02-player-access-decisions.md).

## Verification at handoff

The following commands passed against the current working tree:

- `npm run prisma:generate`
- `npx prisma validate`
- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test:contracts` (59 tests)
- `npm test` (22 files, 234 tests)
- `npm run build:demo` (static route `/jogar` emitted)
- `npm run build:server` with fake valid build-time database/auth/secret values
- `git diff --check`

The Impeccable detector reported one advisory for literal `#000000` in the QR
generator. That color is intentional: QR modules are black on white for reliable
scanning and print contrast. A full human visual review and physical QR scan remain
unperformed.

## Original handoff checklist

1. Perform the requested focused read-only review for authorization gaps, races,
   migration/index correctness, demo/server parity, missing critical tests, and static
   export behavior. Treat the review as a final integration gate; there was no reviewer
   result at the point of handoff.
2. In a browser, create demo slots after the export, print or inspect a generated QR,
   open its `/SMS_Portal/jogar/?cred=...` URL, and exercise waiting, ready, and revoked
   states. Confirm that a `demo_launch_` value never crosses into the server runtime.
3. Review the extra build/auth edits in `next.config.ts` and
   `scripts/next-target.mjs` before committing. The current diff removes the config-time
   `AUTH_DEV_BYPASS === "false"` assertion and sets it to false during server builds;
   runtime validation still rejects an enabled bypass in production, but this change
   is outside the player-access domain and needs an explicit acceptance decision.
4. Decide whether the UI's current “Trocar QR” control is sufficiently clear as the
   only way to print an existing slot again. The old QR must be described as invalidated
   because the raw server token cannot be recovered from its stored hash.
5. If review and manual checks pass, create logical, non-amending commits for the
   schema/core, server/demo adapters, UI, and documentation. Do not stage
   `walkthrough.md`.
6. Apply the forward migration in the intended server environment and verify it
   against the deployed database before enabling the production workflow.

## Working-tree cautions

- The feature changes are uncommitted. `git status` includes modified and untracked
  Slice 2 files; review the complete status before staging.
- `walkthrough.md` was already untracked user data and must remain untouched,
  unstaged, and uncommitted.
- Build outputs are generated locally. Do not add them to the commits.
- `next-env.d.ts` was regenerated during the Next build and is no longer listed as
  modified in the latest status snapshot.

## Continuation outcome

- Independent review identified stale printable QR cards, a session-end/entry race,
  and a credential-rotation/entry race. The print UI now hides invalidated cards;
  server entry locks the credential and active session rows through participation
  creation. Expected uniqueness races return domain conflicts.
- Session and QR-rotation confirmations use labelled in-page modal dialogs rather
  than browser confirmation prompts. Player entry also preserves its credential
  through a React Strict Mode effect replay.
- The refreshed static export was exercised in a browser: the fixed
  `/SMS_Portal/jogar/` route showed waiting, ready, and revoked states for seeded
  credentials, removed `cred` from the visible URL, and used in-page confirmation
  dialogs for session and rotation actions. A new slot and printable QR were
  generated after export. A physical tablet QR scan and mobile modal pass were
  not performed.
- `npm run check` passed with 24 test files and 245 tests. `npx prisma validate`,
  `npm run build:demo`, `npm run build:server`, and `git diff --check` passed.
  The server build was also run with `AUTH_DEV_BYPASS=true` in its caller environment;
  the build script pinned it to false, while runtime validation still rejects a
  production bypass. These build/auth changes are accepted for this slice.
- The one-time print sheet can become stale if another tab or adult rotates the
  same credential without this page refreshing. Revalidate before printing in
  that situation; live multi-client synchronization is not part of Slice 2.
- No migration was applied to a real Neon database. Apply and verify the forward
  migration in the intended server environment before enabling the production
  workflow. The session/credential locking behavior has unit coverage but has
  not been exercised by a real-database concurrency test.
