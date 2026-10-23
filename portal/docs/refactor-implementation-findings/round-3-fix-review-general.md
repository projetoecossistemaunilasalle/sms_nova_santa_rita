# Round 3 fix review — general verification

- Round: 3 (fix-round verification, general reviewer)
- Date: 2026-09-27
- Round-2 state tree: `b708da2eb46611e3f39ec078357ef2aa28a9df37`
- Round-3 (current index) tree: `bc5c14caf550226c268100fed44c7cb7be5f3caf`
- Delta: 18 files, 426 insertions / 215 deletions, all staged; working tree == index (`git diff --name-only` empty). Untracked files are review dossiers and `.zcodeignore` only.
- Tool versions: Node **v22.23.1** on the verification shell (repo/CI pin **24.19.0** — see findings), npm 11.6.0, next **16.3.6**, eslint-config-next 16.3.6, sharp 0.35.4 (transitive via next), prisma 7.9.1, vitest 4.1.11, Turbopack builds.
- Method: independent re-execution of every gate and a re-run of the decisive F1 A/B experiment; fix log read as claim sheet only.

## F1 decisive probe — `"use server"` header on the generated server actions barrel

Round 2 claimed a build with the header **succeeds**; the fix agent claimed it **fails** on next 16.3.2/16.3.6. I re-ran the experiment independently on the current tree, next 16.3.6 (Turbopack).

**Critical methodology discovery first:** `npm run build:server` (`node scripts/next-target.mjs build server`) regenerates `src/runtime/actions.ts` from the in-script template via `writeRuntimeEntries(target)` (scripts/next-target.mjs:113) *before* spawning `next build`. My first naive run — header prepended to the file, then `npm run build:server` — therefore **succeeded (exit 0)**: the generator silently overwrote the header before Next saw it. A bare `npm run build:server` can never test the header; the header must come from the generator template (what the fix agent did by temporarily editing `scripts/next-target.mjs`) or the build must be invoked directly.

**Controlled direct-build probe (header on file, env replicated exactly from next-target.mjs minus the regeneration prelude):**

```
APP_RUNTIME_MODE=server NEXT_PUBLIC_APP_RUNTIME_MODE=server NODE_ENV=production \
  AUTH_DEV_BYPASS=false node node_modules/next/dist/bin/next build
```

Result: **exit 1 — build FAILS**, exactly as the fix agent claimed:

```
▲ Next.js 16.3.6 (Turbopack)
> Build error occurred
Error: Turbopack build failed with 39 errors:
./src/runtime/actions.ts:3:1
Error: Only async functions are allowed to be exported in a "use server" file.
```

plus 38 cascading errors of the form `Error: Export allocatePlayerSlotsAction doesn't exist in target module` (one per re-exported action name; 1 + 38 = 39 total errors). Error-count and message match the fix agent's claim line for line.

**Conclusion: the round-2 "header builds fine" claim is REFUTED.** On next 16.3.6 (Turbopack) a `"use server"` re-export barrel is unbuildable; the fix agent's skip of F1 was correct, and the resulting generated `actions.ts` starting with `export {` (no header) is the only buildable shape. One wording amendment for the record: the failure manifests at `next build` — phrasing it as "`npm run build:server` fails" is only true when the header is delivered through the generator template (as the fix agent actually did), because `build:server` itself rewrites the file first.

Probe cleanup: backup restored over `src/runtime/actions.ts`, `node scripts/next-target.mjs gen server` re-run, and `npm run build:server` confirmed passing afterwards (exit 0, "Compiled successfully", 20/20 static pages). Probe log preserved at `$TMP/f1probe/` (session temp).

## Command log (gates, serial; all exit 0)

| # | Command | Exit | Duration | Key result |
| --- | --- | --- | --- | --- |
| 1 | `npm run clean:build` | 0 | 3.3s | Removed `.next`, `out` |
| 2 | `npm run format:check` | 0 | 2.5s | All matched files use Prettier code style |
| 3 | `npm run lint` | 0 | 6.2s | eslint clean (`--max-warnings=0`) |
| 4 | `npm run prisma:validate` | 0 | 1.5s | Schema valid |
| 5 | `npm run typecheck:server` | 0 | 5.2s | gen server + tsc clean |
| 6 | `npm run typecheck:demo` | 0 | 5.2s | gen demo + tsc clean |
| 7 | `npm test` | 0 | 2.3s | **28 files / 200 tests passed** |
| 8 | `npm run build:server` | 0 | 13.7s | Compiled successfully, 20/20 static pages (Next 16.3.6 Turbopack) |
| 9 | `npm run build:demo` | 0 | 12.4s | Compiled successfully, 31/31 static pages |
| 10 | Generated-entry inspection | 0 | — | See below |
| — | `npm audit` (F2) | 0 | — | 6 vulnerabilities (1 moderate, 5 high) |
| — | `npm ls next eslint-config-next sharp` (F2) | 0 | — | next 16.3.6, eslint-config-next 16.3.6, sharp 0.35.4 — package.json + lockfile agree |

Gate 10 detail (after the probe restore and final `gen server`):

- `src/runtime/actions.ts` (server): bare re-export barrel, first line `export {`, last block `} from "./actions.server";` — **no** `"use server"` header (correct per F1 skip).
- `src/runtime/actions.ts` (demo, observed after `build:demo`): bare re-export from `./actions.demo`, **directive-free** (0 matches for `use server`/`use client`/`server-only`).
- `src/runtime/readers.ts` (server): starts `import "server-only";` then re-exports; `src/runtime/client.ts`: starts `"use client";` then re-exports (by design in both targets).
- All three generated entries confirmed gitignored (`.gitignore:30-32`).

## Per-fix verification

| Fix | Status | Evidence |
| --- | --- | --- |
| F1 — `"use server"` header | **SKIPPED CORRECTLY** (verified) | Probe above: direct build fails on 16.3.6 with the exact claimed error, 39 errors, exit 1. Round-2 claim refuted. |
| F2 — next bump | **SATISFIED** | next 16.3.6 / eslint-config-next 16.3.6 / sharp 0.35.4 installed and matching package.json + lockfile; audit down to 6 advisories, next critical pair (GHSA-p293-qw3h-jr36, GHSA-2xp9-vwfh-vxw4) and sharp advisory gone (absent from audit output). |
| F3 — dead icon variants | **SATISFIED** | `rg '"book"\|"edit"\|"link"\|"paperclip"' src/` → 0 hits; `IconName` union in `src/components/shared/icon.tsx` contains neither of the four (33 members, `"module"` untouched as scoped). |
| F4 — merged import | **SATISFIED** | `src/app/(professional)/portal/turmas/[id]/page.tsx`: single multi-name import from `@/runtime/readers` (`getClassPageData`, `getPlayerAccessPageData`, `listStaticClassIds`); typecheck gates pass. |
| F5 — gitignore temp files | **SATISFIED** | `.gitignore:33` `/src/runtime/*.tmp`; `git check-ignore -v src/runtime/actions.ts.tmp` → matched (exit 0, porcelain silent); temp file removed after probe. |
| F6 — temp-dir leak in test | **SATISFIED** | `tests/unit/clean-build-artifacts.test.ts` passes; clean-build-* dir count in OS temp identical (30) before vs after the run — zero new leaks. |
| F7 — historical-doc hygiene | **SATISFIED** | Repo-wide: 0 markdown links to `schemas/api-contracts.md` / `schemas/domain-rules.md` (rg exit 1). Remaining mentions are backticked prose marked as removed (phase-01: "both documents were removed with the retired contract set"; runbook removal list) or dated audit/dossier records. |
| F8 — logger redaction | **SATISFIED** | `src/server/observability/logger.ts:33-34` adds `"entryCredential"` + `"*.entryCredential"`; `tests/unit/http.test.ts` includes the key (lines 66, 118); 4/4 tests pass. |
| F9 — DESIGN.md nav accuracy | **SATISFIED** | DESIGN.md:258 and :329 both say four-column grid with fifth item wrapping; `src/components/portal/portal.module.css:1246` `.navigation` (mobile media query) `grid-template-columns: repeat(4, minmax(0, 1fr))` — they agree. |
| F10 — clone assertion | **SATISFIED** | `tests/unit/demo-player-access.test.ts:145` `expect(fallback).not.toBe(demoAdultPortalSeed)`; 8/8 tests pass. |

## Audit delta (F2)

Baseline (next 16.3.2) per fix log: 8 vulnerabilities (1 moderate, 6 high, 1 critical) including the next critical RCE pair and sharp <0.35.4. Now: **6 vulnerabilities (1 moderate, 5 high)** — ajv (moderate, ReDoS), deepmerge-ts (high, stack exhaustion, via @prisma/config), js-yaml (high), mysql2 (2 high: auth-plugin downgrade, zlib inflate bomb). All four packages: no imports anywhere in `src/` (grep 0 hits). Classification: deepmerge-ts/js-yaml/mysql2 are dev-tooling chains (prisma CLI; mysql2 is additionally an **optional peer** of better-auth, never imported for the Postgres/Neon stack). One nuance: ajv@8.17.1 and mysql2@3.15.3 are also reachable through runtime dependency *chains* (@neondatabase/auth-ui → @hookform/resolvers → ajv; better-auth optional peer → mysql2) even though the app never imports them — no fix version exists in-range for ajv 8.17.1 per the advisory. Substance of the "dev-only" claim holds; see MINOR-3.

## Findings

- **CRITICAL:** none.
- **MAJOR:** none.
- **MINOR-1 (F1 runbook wording):** the fix log and generator comment state the header "fails `npm run build:server`"; precisely, `build:server` regenerates the entry before Next runs (scripts/next-target.mjs:113), so the failure manifests only when the header is delivered via the generator template (the fix agent's actual method, reproduced here) or via direct `next build`. Amend the wording so future readers don't "verify" the claim with a doomed naive test (prepend + `build:server`) that trivially passes.
- **MINOR-2 (historical temp residue):** 30 pre-fix `clean-build-*` directories remain in the OS temp dir (newest Sep 27 01:18, i.e. before the fix). No new ones are created anymore; harmless residue, optional one-time cleanup.
- **MINOR-3 (audit nuance):** ajv@8.17.1 sits under the runtime dependency chain via @neondatabase/auth-ui → @hookform/resolvers (not app-imported, no patched version in range); "all dev-only" is accurate in substance but ajv is runtime-chain-adjacent rather than purely dev.
- **INFO-1:** verification shell ran Node v22.23.1 vs repo/CI pin 24.19.0; all gates pass on v22. Node 24 execution remains an inherent release/CI check.
- **INFO-2:** lockfile's missing `"dev": true` markers on the 27 `@img/sharp-*`/`@img/sharp-libvips-*` optional platform-binary entries persist (npm 11.6.0 writer); observation only, as flagged by the fix log.
- **INFO-3:** the F1 probe's naive first attempt (exit 0) is itself useful evidence that `build:server` self-heals the generated entry — worth one sentence in current-architecture docs if regeneration semantics are ever changed.

## READY ASSESSMENT

**Ready.** Every applied fix (F2-F10) is independently verified against the actual tree and behavior; the single skipped fix (F1) is correct — the decisive probe was re-run independently and the round-2 claim it was based on is refuted with the exact predicted error on next 16.3.6. All ten gates pass (format, lint, prisma validate, both typechecks, 200/200 tests, both Turbopack builds), the working tree matches the index, and the generated runtime entries are in the correct, documented shape in both targets. Remaining items are the F1 wording amendment (MINOR-1), optional historical temp cleanup, and the inherent release checks (Node 24 pin on CI/deploy, deploy-time secret/env checks) — none block.

VERDICT: PASS-WITH-FINDINGS
