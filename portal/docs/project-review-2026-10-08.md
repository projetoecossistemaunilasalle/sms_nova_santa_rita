# Project Review: 8 October 2026

## Verdict

The project has a coherent UI and a passing development gate, but it is not ready
for a functional sign-off. This review confirmed four high-priority behavioral
defects and two medium-priority workflow defects. Application behavior was left
unchanged; this report is the only tracked change.

## Findings

### 1. [P1] Production CSP prevents public pages from hydrating

Location: `src/proxy.ts:59`, `src/app/(public-play)/jogar/page.tsx:5`,
`src/app/(professional)/entrar/page.tsx:10`.

The proxy applies a fresh nonce and `strict-dynamic` to every page response, but
the server build prerenders `/jogar`, `/entrar`, and `/entrar/recuperar`. Their
scripts have no request nonce. Consequently, the browser blocks the scripts
needed to hydrate these pages.

Evidence: after `build:server`, `/jogar` returned HTTP 200 with a nonce-based CSP,
13 script tags, and zero script tags carrying a nonce. The page remained on
"Preparando sua entrada" instead of advancing to the scan prompt. Visiting
`/entrar?error=invalid_credentials` did not display the client-rendered error.
The production build explicitly classified these routes as static.

Impact: a production player cannot enter the game; sign-in feedback and other
client-side public-page behavior fail even though the build passes.

Recommendation: opt the affected server-target pages/layout into request-time
rendering while preserving static demo export, or adopt a CSP compatible with
prerendered documents. The installed Next.js CSP guide explicitly requires
dynamic rendering for nonce-based policies. Add a production-browser smoke test,
not just a test asserting that the proxy emits headers.

### 2. [P1] Resuming with queued saves can overwrite recovered progress

Location: `src/components/public/game-host.tsx:439`,
`src/runtime/offline/indexed-db.ts:259`.

`bootstrapServer` installs the server snapshot into the game before synchronizing
pending local saves. Those saves may represent newer local progress. Sync updates
the host's bootstrap state but does not send a replacement bootstrap to the
external game. Meanwhile, `enqueueState` silently replaces the game's expected
revision with the latest cached revision plus queue length.

Evidence: an in-memory reproduction using the actual IndexedDB implementation
and contract fixtures produced this sequence:

```text
Cached/server revision 42: 12 coins
Pending locally durable save: 20 coins
Bootstrap installed on resume: revision 42, 12 coins
Pending save synchronized: server has 20 coins at revision 43
Next save from stale game: expected revision 42, 13 coins
Queued request rewritten: expected revision 43, 13 coins
```

The rewritten request can replace the recovered 20-coin state rather than
triggering the stale-revision conflict expected by the protocol. This can occur
when the game frame restarts or the QR is rescanned before pending saves flush.

Impact: progress already acknowledged as locally durable can later be lost.

Recommendation: establish one consistent resume snapshot before allowing new
gameplay, replay or explicitly recover the pending branch, and do not promote a
stale game snapshot to a newer revision without reconciling its contents. Add a
host-level test spanning bootstrap, pending queue flush, and the next game save.

### 3. [P1] Token renewal silently changes session attribution

Location: `src/components/public/game-host.tsx:141`.

Renewal calls `resolvePlayerEntryAction(credential)` and accepts any `ready`
response without comparing its session, participation, or player context with
the original host entry. Resolving the credential selects the currently active
class session, which may be different from the session under which records were
queued. Result/time payloads do not independently carry the original session;
the server attributes them using the renewed bearer token.

Evidence: executing the actual extracted renewal function with an original
session-A entry and a session-B renewal returned and installed the session-B
token. The local queue's session check still compares against the original
session-A entry and cached bootstrap, so it does not detect this bearer change.

Impact: after a teacher ends A and starts B, reconnecting or renewing an expired
launch can submit A's results and active time against B's participation. State
writes can likewise continue under the wrong session context.

Recommendation: reject context-changing renewals and perform an explicit new
session bootstrap. Define a separate, context-bound recovery policy for flushing
old-session records. Test renewal after end/start and reconnection after expiry.

### 4. [P1] Deactivating a class makes its reactivation control unreachable

Location: `src/app/(professional)/portal/turmas/[id]/page.tsx:27`,
`src/application/player-access/service.ts:46`.

The server detail page requires both administrative class data and operational
player-access data. Organization administrators may read/manage an inactive
class, but `getClassWorkflow` rejects inactive classes through `canAccessClass`.
The page consequently redirects to `sem-acesso` before rendering the existing
"Ativar turma" control.

Evidence: using the actual services with their demo stores, deactivation followed
by `getClass` returned `status: INACTIVE, canManage: true`; the same actor's
`getClassWorkflow` returned `FORBIDDEN`. The server page combines these calls in
one `Promise.all`. The client-side demo can mask this server-only defect.

Impact: an administrator cannot undo a normal deactivation through the UI.

Recommendation: separate administrative visibility from permission to operate
players/sessions. Render inactive class details with disabled operational
controls and an available activation control. Test the full deactivate/reopen/
reactivate cycle using the server page composition.

### 5. [P2] Newly created demo classes cannot complete the advertised workflow

Location: `src/components/portal/classes-screen.tsx:169`.

Browser-created classes render as noninteractive articles instead of detail
links, while the creation instructions tell users to prepare numbered players
and credentials on the class page. Static export only generates seeded class
routes, and no equivalent client-side detail route exists for new classes.

Evidence: creating "Review Test Class" as the organization administrator
succeeded and persisted a card marked "Criada neste navegador", but the card
had no detail action. The seeded classes next to it remained navigable.

Impact: creation appears successful, but users cannot assign teachers, add
players, or start sessions for their new class. Newly created organizations
have a related detail-navigation restriction.

Recommendation: provide a statically exported client-side detail surface that
can resolve browser-created IDs, or clearly restrict creation to a preview that
does not promise the full workflow. Verify creation through first player entry.

### 6. [P2] Narrow layouts remove sign-out and demo management controls

Location: `src/components/portal/portal.module.css:1230` and `:2699`,
`src/components/portal/portal-shell.tsx:77`.

Below 900px, CSS hides the sidebar profile (the only sign-out control), help
link, and demo role/reset controls. The topbar avatar is a passive span, not a
replacement menu.

Evidence: at a 390px viewport the portal exposed navigation destinations but no
sign-out, help link, profile selector, or reset action. The overview still told
users to switch the profile "above". At desktop width these controls appeared.

Impact: adults cannot explicitly sign out on narrow/shared devices, and mobile
demo visitors cannot explore other roles or recover the demo state.

Recommendation: add an accessible mobile account/utility menu with sign-out and
the relevant demo actions. Preserve keyboard access and dialog focus behavior.

## Verification

| Check | Result |
| --- | --- |
| `npm run check` | Passed: formatting, lint, Prisma validate/generate, both typechecks, tests |
| Unit tests | 28 files, 200 tests passed |
| `npm run build:server` | Passed; public pages unexpectedly static for nonce CSP |
| `npm run build:demo` | Passed; static export verified under `/SMS_Portal/` |
| Production public entry | Failed: player entry remained in loading state |
| Demo teacher/class navigation | Passed for seeded classes |
| Demo session start | Passed, including confirmation dialog and status update |
| Demo player allocation | Passed: sequential player 04 and printable QR generated |
| Demo game entry/save | Passed: synthetic step saved and revision advanced to 1 |
| Demo administrator switching/team view | Passed at desktop width |
| Demo new-class usability | Failed: created class had no detail action |
| Mobile layout sample | Main content/navigation adapted; utility controls missing |
| `npm audit --omit=dev --audit-level=high` | Failed: 9 reported vulnerabilities, 8 high and 1 moderate |

The audit counts describe package advisories, not nine proven exploitable paths
in this application. Affected packages reported include Next.js, sharp,
source-map-js, fast-uri, ajv, and Prisma-related dependencies. Triage and a
controlled dependency upgrade are required; do not run `audit fix --force`
blindly, since the proposed changes include a Prisma major-version downgrade.

For example, the Next.js advisories for
[Pages Router SSG/ISR cache poisoning](https://github.com/vercel/next.js/security/advisories/GHSA-4jqv-mc3x-m676)
and [root catch-all cache poisoning](https://github.com/vercel/next.js/security/advisories/GHSA-mcj8-r9mp-w47p)
describe routing prerequisites that are not present here. These are
dependency-maintenance signals, not confirmed project exploits.

## UI Audit

The implementation expresses a coherent, product-specific system: operational
adult navigation is separate from QR-based player entry; state messages, role
labels, form labels, and confirmation dialogs generally match the workflows.
Visual-system integrity passes on the sampled surfaces; functional release
readiness does not.

| Dimension | Indicative Score | Evidence / Limitation |
| --- | --- | --- |
| Accessibility | 3/4 | Labeled inputs, semantic controls, status announcements, modal cancel focus; not a full WCAG audit |
| Performance | 3/4 | Both optimized builds pass; no real-device load or Lighthouse benchmark |
| Responsive design | 2/4 | Fluid main layouts, but utility functions disappear below 900px |
| Theming | 3/4 | Consistent tokens and established palette; small off-ramp literals |
| Implementation integrity | 3/4 | Coherent product language; misleading new-class follow-through |
| Total | 14/20 | Good UI foundation, not a production-readiness score |

The mechanical design detector emitted five advisory findings. Black QR ink is
intentional and should not be "fixed" to a brand color. Fluid type endpoints,
the recovery page's inline font size, and the demo scene's black shadow are
low-priority consistency observations, not release blockers. The stale design
sidecar was not regenerated as part of this review.

## Coverage Gaps

- Local database/auth URLs are example hosts and `GAME_CLIENT_URL` is unset.
  Real Neon login, migration execution, database constraints under contention,
  and the external GameMaker integration could not be validated end to end.
- The local runtime is Node 22.23.1, while the project pins Node 24.19.0. Repeat
  release validation on the pinned runtime.
- Password recovery is an explicitly documented placeholder: its submit handler
  only changes local UI state. It must not be mistaken for working recovery.
- School-tablet QR scanning, two-device continuation, expired-token offline
  recovery, and physical printing/scanning still require integration testing.
- CI checks builds and units but never boots the production artifact in a
  browser, which explains why the CSP defect survives a green gate.

## Recommended Sequence

1. Fix findings 1-4 and add production-browser and host-lifecycle regressions.
2. Triage dependency advisories and upgrade without changing Prisma generations
   unintentionally; rerun both runtime builds and the contract suite.
3. Use `$impeccable harden` for complete new-class follow-through and recovery
   states, then `$impeccable adapt` for mobile account/utility access.
4. Validate against real provisioned Neon and GameMaker environments and the
   supported school tablets.
5. Re-run `$impeccable audit`, then `$impeccable polish` after functional fixes.

These follow-ups can be performed separately or together; no production data or
credentials were changed during this review.
