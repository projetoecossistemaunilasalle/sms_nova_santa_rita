# Deploy the portal to Render

Operator runbook for the SMS Portal, which lives in `portal/` of the landing repository
(`projetoecossistemaunilasalle/sms_nova_santa_rita`). The landing itself stays on GitHub Pages.

## 1. Architecture

- One Render **web service** (native Node runtime, region `virginia`, plan `starter` by default) defined in the repository-root `render.yaml` (`rootDir: portal`, build filter `portal/**`).
- The service runs the Next.js 16 standalone portal:
  - Build: `npm ci && npm run build:server`
  - Start: `npm run start -- --hostname 0.0.0.0` (Render sets `PORT=10000`)
- The same origin also serves the game build committed at `public/jogo-cliente/`. No extra service is needed.
- Database: Neon Postgres 17 with Neon Auth (Better Auth).
  - Production Neon project goes in **AWS us-east-1 (N. Virginia)**, next to the Render region. Render has no South America region.
  - The dev Neon project `sms-portal-v2-dev` is in sa-east-1. It is disposable and must not be used for production.
- Health check: `/api/health/ready` (queries the DB with a 2 s timeout; Render needs a 2xx within 5 s). `/api/health/live` is liveness only and does not check the DB.
- Migrations: `preDeployCommand: npx prisma migrate deploy`, using `DIRECT_URL` (see `prisma.config.ts`). If it fails, the deploy aborts and the previous release keeps serving.
- `autoDeployTrigger: off`. Deploys are manual until the team opts in.

## 2. Environment variables

Set in `render.yaml` / `.env.example`. `sync: false` means you fill the value in the Render dashboard.

| Variable | Source | Notes |
|---|---|---|
| `NODE_VERSION` | value `24.19.0` | Matches `package.json` engines. |
| `APP_RUNTIME_MODE` | value `server` | Never `demo` in production. |
| `DATABASE_URL` | you (sync false) | Neon **pooled** connection string. |
| `DIRECT_URL` | you (sync false) | Neon **direct** connection string, used for migrations only. |
| `NEON_AUTH_BASE_URL` | you (sync false) | Auth base URL of the production branch. |
| `NEON_AUTH_COOKIE_SECRET` | Render generates once | Do not regenerate casually; it signs auth cookies. |
| `APPLICATION_SECRET` | Render generates once | **Never regenerate or rotate** without the key-ring procedure in `.env.example`. It encrypts player credentials and signs player launches. |
| `ALLOWED_ORIGINS` | derived (unset) | `scripts/start.mjs` defaults it to `RENDER_EXTERNAL_URL`. Set it explicitly (all origins, comma-separated) once a custom domain exists. |
| `GAME_CLIENT_URL` | derived (unset) | Defaults to `<RENDER_EXTERNAL_URL>/jogo-cliente/index.html`. Set explicitly with a custom domain. |
| `PLAYER_CREDENTIAL_KEY_ID` | value `default` | Key IDs are immutable. |
| `OFFLINE_FLUSH_WINDOW_SECONDS` | value `86400` | Offline records may flush for 24 h after session end. |
| `LOG_LEVEL` | value `info` | |
| `AUTH_DEV_BYPASS` | value `false` | Must stay `false` in production. |

Optional, add later in the dashboard:

- `NEON_AUTH_ADMIN_EMAIL` / `NEON_AUTH_ADMIN_PASSWORD`: needed for "Equipe > Criar conta" (team account creation). Use a dedicated service identity with the Neon Auth admin role. Never give it a portal profile, and never expose it to clients.

Intentionally unset:

- `RATE_LIMIT_CLIENT_IP_HEADER`. Render's docs do not state that its proxy strips client-supplied `X-Forwarded-For`, so IP-based limits stay off. Per-account and per-session limits still apply.

## 3. Go-live order

Before starting, confirm:

- [ ] The branch to deploy is merged and pushed (step 1).
- [ ] `public/jogo-cliente/` is committed and matches the game commit in `bundle-info.json`.
- [ ] You have the production Neon connection strings and the auth base URL ready.
- [ ] After creation, note the service URL Render assigned (it may carry a random suffix): it is needed for the Neon Auth trusted domain and the landing `PORTAL_URL`.
- [ ] Someone is available to run the smoke test (step 6) right after the first deploy.

Steps:

1. **Merge and push to the landing repository's `main`.** Render deploys `portal/` from that branch.
2. **Create the Neon production project.**
   1. Project in `aws-us-east-1`, Postgres 17, with Neon Auth enabled.
   2. Copy the pooled string into `DATABASE_URL` and the direct string into `DIRECT_URL`.
   3. Copy the branch's auth base URL into `NEON_AUTH_BASE_URL`.
   4. Add `https://<service>.onrender.com` as a Neon Auth **trusted domain**. Add the custom domain later.
3. **Create the service from the Blueprint.** In Render: New > Blueprint, select the repo and branch, and fill every `sync: false` variable from section 2.
4. **First deploy.** Watch, in order:
   1. Build (`npm ci`, `build:server`).
   2. Pre-deploy `prisma migrate deploy`. Failure stops here.
   3. Health check on `/api/health/ready`.
5. **Bootstrap the platform.**
   1. Create the first platform admin.
   2. In "Versões do jogo", import `public/jogo-cliente/content-manifest.json` and mark it current.
   3. Create the organization, staff accounts and classes.
6. **Smoke test.**
   1. Teacher login.
   2. Start a session.
   3. Join from a tablet by scanning the QR code.
   4. Play one mission.
   5. Confirm the results show that mission.
7. **Rebuild the landing page** with `PORTAL_URL=https://<service>.onrender.com` and push the landing repo.

## 4. Game updates

The game lives in the separate repo `Heroes_Trial` (checked out next to the landing repository). Its build output is committed into `portal/public/jogo-cliente/`.

1. In `Heroes_Trial`, commit all changes first. The script refuses a dirty tree unless `-AllowDirty` is passed. Avoid `-AllowDirty` for production builds.
2. In `portal/`, run `npm run bundle:game`. This runs `scripts/bundle-game.ps1`, which:
   - builds `..\..\Heroes_Trial\web-poc` (override with `GAME_PROJECT_ROOT`) with `VITE_PORTAL_ORIGINS=self` (the game expands `self` to its own origin);
   - writes `public/jogo-cliente/bundle-info.json` with the game commit and `content_version`.
3. Review and commit `portal/public/jogo-cliente`.
4. Deploy (manual, see section 5).
5. In the portal, "Versões do jogo": import `public/jogo-cliente/content-manifest.json` and mark it current.

**Save compatibility.** If `content_version` changed, existing saves with a different `stored_content_version` are refused with `CONTENT_UPGRADE_REQUIRED`. Coordinate with the class teachers before releasing such a version.

## 5. Deploy and verify

1. Render dashboard > `sms-portal` > Manual Deploy > Deploy latest commit.
2. Watch the build log and the pre-deploy step. A pre-deploy failure means no new release is live.
3. Confirm `https://<service>.onrender.com/api/health/ready` returns 2xx.
4. Run the smoke test from section 3, step 6.

## 6. Rollback

1. Render dashboard > `sms-portal` > Events (or Deploys) > select the previous successful deploy > **Rollback**.
2. Migrations are forward-only. Before rolling back across a migration, check that the older code works with the current schema. If it does not, do not roll back the code. Fix forward instead.
3. Check `/api/health/ready` after the rollback.

## 7. Operational notes

- Database access during migrations uses `DIRECT_URL`; the running app uses `DATABASE_URL` (pooled).
- Do not change `APPLICATION_SECRET` or `PLAYER_CREDENTIAL_KEY_ID` values without following the key-ring procedure in `.env.example`.
- Keep `AUTH_DEV_BYPASS=false` and `APP_RUNTIME_MODE=server` in production.

## 8. Open items and unverified points

- **Memory on Starter (512 MB).** Headroom under real class load is not measured. Watch memory during the first live classes and be ready to move to a larger plan.
- **Tablets and Safari.** Real tablets and Safari are not tested yet. A separate WebKit E2E pass is in progress.
- **Render prices.** Not checked. Confirm the current plan price before go-live.
- **Deploy branch.** `render.yaml` does not name a branch. Confirm the Render service deploys `main` of the landing repository.
- **Custom domain.** Not yet defined. When added, set `ALLOWED_ORIGINS` and `GAME_CLIENT_URL` explicitly, update, the Neon Auth trusted domains, and the landing `PORTAL_URL`.
