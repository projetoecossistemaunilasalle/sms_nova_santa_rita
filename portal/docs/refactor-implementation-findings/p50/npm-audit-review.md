# P50 — npm audit review (runbook item 5)

Date: 2026-09-26. Command: `npm audit --omit=dev` (and full `npm audit`) against the
installed lockfile, on the pinned toolchain (Node 24.19.0 / npm 11.17.0).
**No fix was applied as part of this refactor** — the runbook forbids
`npm audit fix --force`, and the one runtime-relevant bump is outside the pinned
range. Recorded disposition per finding:

| Finding | Severity | Applicability | Disposition |
| --- | --- | --- | --- |
| Next.js Unauthenticated RCE on windows-hosted servers (GHSA-p293-qw3h-jr36) | critical | The standalone server target can be Windows-hosted → **applicable** | Fix installs `next@16.3.6`, outside the pinned `16.3.2` range → requires a deliberate framework bump. **Owner action after this refactor**: bump `next`, re-run the full gate chain, then redeploy. |
| Next.js RCE in Image Optimization API with AVIF (GHSA-2xp9-vwfh-vxw4) | critical | No `next/image` import anywhere in `src` (grep = 0 hits); the demo target sets `images.unoptimized: true`. The server target keeps Image Optimization enabled by default but exposes no image routes in use. **Not reachable today** | Keep the framework bump above in mind as defense in depth. |
| sharp < 0.35.4 — libheif (GHSA-rgj7-g3m4-5g8c) | high | Optional transitive of Next's image optimization; unreachable without `next/image` usage | Reachable only after the server target starts serving optimized images; covered by the same post-refactor `next`/dep refresh. |
| ajv ReDoS with `$data` option (GHSA-2g4f-4pwh-qvx6) | moderate | npm counts it among the production findings, but the only `ajv` import in the repository is `tests/unit/v1-contracts.test.ts` (test-time contract validation); no runtime import | Not runtime-reachable; refresh opportunistically with the next dev-dep pass (`npm audit fix` suffices for this one). |
| js-yaml < 4.3.1 (GHSA-2883-xcg3-v3hh) | high | The only `dev: true` finding in the lockfile (transitive of tooling; used only by dev workflows) | Not runtime; fixable with plain `npm audit fix` — refresh opportunistically with the next dev-dep pass. |
| deepmerge-ts / mysql2 (transitive) | high | Build-time/tooling transitive (Prisma tooling chain); no runtime import; MySQL is not used (PostgreSQL only) | Not applicable to runtime; requires `--force` (outside this refactor). Revisit on the next dependency refresh. |

Summary: 7 production findings (1 critical, 5 high, 1 moderate) + 1 dev-only
(js-yaml). The only runtime-applicable item is the windows-hosted Next.js RCE,
whose fix is a deliberate `next` version bump — recorded here as the single
security follow-up for the repository owner, deliberately not executed inside
this refactor.
