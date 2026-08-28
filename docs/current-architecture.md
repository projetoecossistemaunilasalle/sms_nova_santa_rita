# Current product architecture

Status: Current source of truth for product boundaries and web surfaces.

Last aligned: 23 August 2026.

## Product boundary

Missões do Caramelito has two web surfaces and one external game runtime:

1. The authenticated portal is the professional and administrative workspace.
2. The public activity host resolves customized opaque links and hands participants to
   the game.
3. The existing GameMaker project owns the single game experience, including all
   activities and minigames contained inside it.

There is no marketing or institutional landing page. The root route redirects to the
professional sign-in screen.

## Responsibilities

| Surface | Owns | Must not own |
| --- | --- | --- |
| Professional portal | Authentication, organizations, team access, customized link management, aggregate results, and audit history | Game selection, module composition, minigame configuration, participant gameplay, or public discovery |
| Public activity host | Opaque-link validation, safe entry/unavailable states, and the GameMaker handoff | Account creation, portal navigation, activity discovery, or content authoring |
| GameMaker runtime | The complete interactive experience, its activities/minigames, runtime behavior, and game-side result production | Professional authentication, organization management, or link administration |

## Route boundary

| Route | Audience | Behavior |
| --- | --- | --- |
| `/` | Anyone | Temporary redirect to `/entrar`; it renders no landing page. |
| `/entrar` | Professionals | Public sign-in surface for the portal. |
| `/portal/**` | Authenticated professionals/admins | Operational portal. It manages access links and aggregate information for the one GameMaker experience. |
| `/atividade/[token]` | Participants with a customized link | Validates or represents the link and offers the next step into the game. |
| `/atividade/[token]/jogar` | Participants with a valid link | Embeds or opens the configured GameMaker client and passes the opaque activity token. |
| `/health/live`, `/health/ready` | Operations | Liveness and database-backed readiness checks. |

Participant gameplay has no portal shortcut. A customized activity link is the only
supported public path into the game.

## Portal terminology

- **Game experience** means the single existing GameMaker game: Missões do Caramelito.
- **Access link** means one customized opaque URL created for a class, group, or other
  authorized distribution context.
- **Play session** means one anonymous run started from an access link.
- **Result** means aggregate-safe data returned by the GameMaker integration.

Do not use **activity** in portal copy to mean a separately composed set of modules or
minigames. Activities and minigames live inside the GameMaker project.

## Link and handoff flow

1. A professional creates or manages an access link in the authenticated portal.
2. The system creates a high-entropy opaque token and stores only the required secure
   representation of that token.
3. The participant opens the customized `/atividade/[token]` URL without signing in.
4. The public host validates the link state and shows only safe public information.
5. The host sends the participant to the single GameMaker client configured by
   `GAME_CLIENT_URL`, preserving the activity token as integration context.
6. Game-side results return through the versioned integration contract and are exposed
   to authorized portal users only in aggregate-safe form.

The exact API payload and result contract must be agreed with the GameMaker repository
before production. The web UI must not invent a second content or sequencing model.

## Security and privacy invariants

- Portal routes require professional authentication and server-side authorization.
- Public links are opaque, unguessable, revocable, and excluded from logs and analytics
  wherever possible.
- Participants do not create accounts or provide names, emails, enrollment numbers, or
  free-form identifying text.
- The GameMaker URL is allowlisted through configuration and CSP `frame-src`.
- Portal pages may list links for authorized management and sharing, but never present
  them as participant discovery/navigation or expose a portal-side play button.
- Results are collective; the product does not create individual child profiles or
  histories.

## Runtime configuration

| Variable | Purpose |
| --- | --- |
| `GAME_CLIENT_URL` | Deployed browser URL for the existing GameMaker client. |
| `DATABASE_URL` / `DIRECT_URL` | Runtime and migration database connections. |
| `NEON_AUTH_BASE_URL` / `NEON_AUTH_COOKIE_SECRET` | Professional portal authentication. |
| `APPLICATION_SECRET` | Application signing/HMAC secret. |
| `AUTH_DEV_BYPASS` | Local development only; rejected when enabled in production. |

## Implementation status

The repository currently contains a navigable portal and public-link UI backed by
demonstration view data. The final customized-link persistence, token lifecycle,
GameMaker handoff contract, authentication provider integration, result ingestion, and
reporting queries still require production implementation and approval.

The Prisma model, JSON contracts, schema notes, historical portal specification, and
detailed phase plans were written for an earlier multi-activity/module architecture.
They are retained as migration research, not as current product authority. They must be
reconciled with this document before their related backend work is implemented.
