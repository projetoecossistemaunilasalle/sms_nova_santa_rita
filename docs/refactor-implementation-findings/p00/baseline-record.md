# P00 Baseline Record

Recorded: 2026-09-26 (implementation session start)

## Checkout

- Base commit: `9467757ed436c82bdbace5a78e23b502176318e2` (docs: finalize refactor implementation runbook)
- `git status --short`: clean at session start
- Branch: `main`

## Toolchain

| Component   | Pinned (engines / .nvmrc / .node-version) | Local shell        | Used for acceptance          |
| ----------- | ----------------------------------------- | ------------------ | ---------------------------- |
| Node        | `24.19.0`                                 | `v22.23.1`         | `v24.19.0` (portable zip at `C:/Users/Vitor/tools/node-v24.19.0-win-x64`) |
| npm         | `>=11.6.0 <12` (packageManager `npm@11.6.0`) | `11.6.0`        | `11.17.0`                    |

Key package versions (from `package.json` / installed lockfile): `next@16.3.2`, `prisma@7.9.1`, `typescript@6.0.3`, `vitest@4.1.11`, `react@19.2.8`.

## Baseline command exit codes (run 2026-09-26, this checkout)

| Command                          | Exit | Notes                                                             |
| -------------------------------- | ---- | ----------------------------------------------------------------- |
| `npm run format:check`           | 1    | Only failure: `REFACTOR_PLAN.md` is unformatted (P00 item 3 addresses this via `.prettierignore`) |
| `npm run lint`                   | 0    | `eslint . --max-warnings=0` clean                                  |
| `npm run typecheck`              | 0    | `tsc --noEmit` clean                                               |
| `npm test`                       | 0    | 33 test files, 284 tests, all passed (verified under both Node 22.23.1 and Node 24.19.0) |
| `npm exec -- prisma validate`    | 0    | `prisma:validate` script does not exist yet (added in P00 item 6)  |
| `npm run build:server`           | 0    | Next.js standalone server build succeeds                           |
| `npm run build:demo`             | 0    | Next.js static export succeeds (`out/`)                            |

All commands were run serially (no concurrent target commands), from a clean-ish workspace with the pre-existing `.next`, `.next-demo-dev`, `out` directories produced by the runs themselves.

## Existing state relevant to P00

- `Dockerfile` and `.dockerignore` are checked in (to be deleted).
- `REFACTOR_PLAN.md` is not ignored by Prettier (to be added to `.prettierignore`).
- `tests/unit/auth.test.ts` `isAuthDevBypassEnabled` suite mutates `AUTH_DEV_BYPASS`, `APP_RUNTIME_MODE`, `NODE_ENV` and its `afterEach` deletes them instead of restoring captured values.
- No `clean:build` script and no `scripts/clean-build-artifacts.mjs` exist.
- No `.github/workflows/ci.yml` exists; only `.github/workflows/deploy.yml` (Pages deploy, left untouched until P50).
