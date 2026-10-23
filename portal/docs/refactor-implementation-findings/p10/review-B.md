# P10 Review — Reviewer B (independent)

Date: 2026-09-26. Scope: uncommitted P10 changes (`git status --short`, `git diff HEAD`), reviewed against `docs/refactor-dossier/IMPLEMENTATION-READY.md` §P10 (read in full by this reviewer). P00 files in the working tree (Dockerfile/.dockerignore, .prettierignore, package.json scripts, scripts/clean-build-artifacts*, ci.yml, auth.test.ts env-restore helper) were excluded from P10 judgment. review-A.md and verification-*.md were not read.

## Summary of changes reviewed

Deletion set (verified against the manifest, item by item):

- Route trees: `src/app/(professional)/portal/atividades/` (8 files), `portal/materiais/` (3), `portal/modulos/` (2), `portal/admin/{jogos,modulos,auditoria}/` (1 each), `src/app/(public-play)/atividade/[token]/` (5 files incl. layout, `[state]`, `jogar`, `jogar/[state]`). All deleted; `find src/app` confirms no residue and the surviving tree is intact (`portal/`, `portal/admin/{organizacoes,equipe}`, `portal/{turmas,resultados,ajuda,sem-acesso,sessao-expirada}`, `(public-play)/jogar/`, 4 `api/v1/player` routes).
- Services/stores/security: access-link-service, portal-view-service, prisma-access-link-store, authorization-service, audit-actions, public-link-service, security/tokens, prisma-capability-reader, service-container, link-status — all deleted. Surviving `src/server/services/` holds only the four containers; `src/server/security/` retains launch-token.ts and player-credential-tokens.ts (not in the manifest — correct).
- Components: material-editor, activity-builder, class-groups-explorer, share-actions, activity-controls, materials-explorer, public-state, activity-mark — all deleted.
- Six tests deleted; 28 test files remain (27 pre-existing + P00's clean-build-artifacts test).
- Contract artifacts: 6 root `contracts/schemas/*.v1.schema.json` + `contracts/schemas/games/` (2 schemas) + `docs/schemas/api-contracts.md` + `docs/schemas/domain-rules.md` — all deleted. `contracts/schemas/v1/` untouched: all 17 schemas and README present; `contracts/fixtures/v1/{valid,invalid}` present.
- `src/app/(professional)/entrar/recuperar/actions.ts` deleted; the surviving `recuperar/page.tsx` is a `"use client"` component importing only next/link, react, and marketing CSS — no actions import. Zero references to `requestPasswordReset` anywhere.

Coupled edits (all verified in diff and in file):

1. `status-badge.tsx`: `Status` reduced to `"Ativa" | "Inativa"`; `ActivityStatus` import gone; tone is `statusPositive` for "Ativa", `statusNeutral` otherwise (both classes exist in `portal.module.css:1058,1073`). All 12 call sites pass `recordStatusLabel(...)`, which already returns exactly `"Ativa" | "Inativa"` (`adult-portal-helpers.ts:15-17`) — type-safe, no tone regression possible. `statusWarning`/`statusDanger` are now unused CSS (P40a owns CSS cleanup; correctly left).
2. `runtime/mode.ts`: `isDemoRuntime` removed (6-line diff; zero remaining references). `dev-bypass-gateway.ts`: `export` dropped from `DEV_BYPASS_ACTOR`, constant kept and used internally at line 17. `adult-portal-helpers.ts`: the `"Links de acesso"` branch removed; the `exact` and `"Resultados"` branches are untouched, so surviving nav matching is unchanged. `auth.test.ts` fixtures: `/portal/atividades` cases replaced with `/portal/turmas`/`/portal/turmas/turma-1`, and `/atividade/token/jogar` replaced with `/jogar` (both still exercise the same `isProtectedPathname` prefix/negative logic).
3. `proxy.ts`: single hunk — only the `/atividade/` disjunct removed; comment rewritten to describe `/jogar` + credential only; `/jogar` exact and `/jogar/` prefix `no-referrer` preserved; CSP, frame origins, matcher untouched (no other hunks in the file). `proxy.test.ts` gained exactly three cases covering those behaviors (all pass).
4. `errors.ts`: `apiErrorCodes` reduced to exactly the six required codes. All six are actively emitted in src (44 occurrences across the surviving player routes/services); every removed code (`RESOURCE_NOT_FOUND`, `RATE_LIMITED`, `SERVICE_UNAVAILABLE`, `ACTIVITY_*`, `MODULE_LAUNCHES_BLOCKED`, `GAME_*`, `ATTEMPT_ALREADY_COMPLETED`, `RESULT_SCHEMA_INVALID`, `SCHEMA_VERSION_UNSUPPORTED`) has zero references in src/tests/scripts. (`STATE_SCHEMA_VERSION_UNSUPPORTED` in game-host/contracts is a distinct surviving v1 protocol code — not a hit.)
5. Docs: `walkthrough.md` lost the public activity URL, the `/atividade/*` + atividades/materiais/modulos `generateStaticParams` inventory, the `DEV_BYPASS_ACTOR` line, and the portal-view-service fixture claims; no residual deleted-route mentions remain (only the substring inside "Interatividade"). `ajuda/page.tsx` lost the three Generation-A topics and keeps "Resultados coletivos". `docs/current-architecture.md` route table now lists `/jogar` instead of `/atividade/[token]` and drops the reconcilation caveat; Materials section updated to state the nav entry was removed. `docs/schemas/README.md` now points at `contracts/schemas/v1` and `src/contracts/v1`, with the legacy-artifact paragraphs and `act_`/`att_` and access-link-bit-length legacy notes removed or generalized. `contracts/schemas/README.md` gained a contract index listing exactly the 17 v1 schemas + fixtures and fixes "future `/api/v1`" → `/api/v1`; field names it cites (`sequencia_tentativa`, `numero_tentativa_atividade`) verified present in `src/contracts/v1/schemas.ts:163-164`.
6. Whole first-party search (grep over `src/`, `tests/`, `scripts/`, current docs): zero hits for deleted module paths, deleted symbols, deleted routes, deleted error codes, or deleted contract artifacts. Remaining `AccessLink` references are only inside generated `src/generated/prisma/*` output (regenerated from schema.prisma; model removal is P20's manifest, correctly not done in P10). Hits in `docs/refactor-dossier/**` and `docs/agent-reviews/**` are explicitly historical evidence. No over-deletion: every deleted file maps 1:1 to the manifest (plus the known P00 set).

Probes run (Node 24.19.0): `vitest run` on proxy/auth/demo-portal-helpers (24 tests) and runtime-mode/portal-navigation/http/v1-authorization (13 tests) — 37/37 green.

## Findings

1. **MINOR** — `docs/schemas/README.md:38` — "Access-link and player-credential tokens contain at least 256 bits of randomness" retains Access-link as a current token convention although the entire access-link feature (service, store, routes, UI) was deleted in this phase. Factually still true of the residual Prisma model until P20, but once P20 removes the `AccessLink` model this line should drop the "Access-link" half; P20 step 7 only names `database-model.md`, so this line could otherwise survive P20 by accident. Confirmed (question only re: which phase fixes it).
2. **MINOR (pre-existing, P50-candidate)** — `docs/current-architecture.md:176` — route table still lists `/health/live`, `/health/ready`, which do not exist in `src/app` (verified absent at HEAD too; removal is recorded in `walkthrough.md:24` as a prior demo adaptation, not Generation A). Not introduced by P10 and not Generation-A material, so not a P10 violation; flagged because P10 edited the adjacent rows of this same table under "describe only the surviving route boundaries."
3. **INFO** — `docs/implementation/phase-01-foundation-contracts.md:18-19` hyperlinks the now-deleted `docs/schemas/domain-rules.md` and `docs/schemas/api-contracts.md`. The runbook preamble classifies `docs/implementation/*` as historical evidence and P50 step 3 owns its review; nothing current links to it as implementation guidance (README.md:43 links it as "Implementation roadmap"). Not a P10 violation.
4. **INFO** — `README.md:39` links `docs/demo-visual-plan.md` (which still describes `/portal/atividades` and access links) but explicitly labels it "demo reference, not V1 product authority" — satisfies the "must not be linked as current implementation guidance" criterion; P50 reviews the file itself.
5. **INFO** — `ajuda/page.tsx` now renders a single topic; page structure, imports, and its `moduleGrid`/`moduleCard`/`moduleArt` CSS hooks remain intact. Broader content polish is explicitly P50 per runbook step 6.
6. **INFO** — `statusWarning`/`statusDanger` in `portal.module.css:1063,1068` are now unreferenced by any component. Correct to leave in P10; P40a owns dead-selector removal.

No CRITICAL or MAJOR findings. No missed deletions, no over-deletion, no dangling imports/routes/codes in src or active tests, no contract-tree damage, no surviving-flow regression found (nav matching, StatusBadge tone, proxy behaviors, and error-code consumption all verified as above).

## Verdict

**P10 satisfied: yes.** The deletion set matches the manifest exactly, all seven coupled edits are implemented as specified, the live contract index and current docs describe only surviving boundaries (historical references are either labeled or outside current guidance), and my independent greps plus targeted vitest probes (37 tests green) found no residue of the purged Generation A in first-party code, active tests, or current documentation. The two MINOR items are transitional/pre-existing doc wording, both within the runbook's deferred scope (P20/P50).

---

## Re-review (fix round 1)

Date: 2026-09-26. Delta scope only: the three fixes applied on top of the round-1 reviewed tree (docs/demo-visual-plan.md, README.md, docs/schemas/README.md, src/proxy.ts — all uncommitted, so reviewed via `git diff` plus in-file reads). review-A.md and verification-*.md still not read. Read-only; no implementation files touched.

### Fix 1 — demo-visual-plan historical classification — CLOSED

- `docs/demo-visual-plan.md:3-6`: new top-of-file blockquote banner ("**Status: documento histórico.** …") replaces the old short-term "Status:" line. It is in Portuguese, names the removed generation explicitly (rotas de atividades/materiais, links de acesso, `portal-view-service.ts`), states it is not current implementation guidance, and points to `docs/current-architecture.md` and `docs/refactor-dossier/IMPLEMENTATION-READY.md` — both verified to exist. The body still describes the old generation (expected and now correctly framed).
- `README.md:39` link label is now "(historical demo plan — superseded, not implementation guidance)" — strictly stronger than the round-1 "demo reference, not V1 product authority" wording. This also upgrades my round-1 INFO #4.

### Fix 2 — schemas README token convention — CLOSED

- `docs/schemas/README.md:38` now reads "Player-credential tokens contain at least 256 bits of randomness. Only a SHA-256 digest is stored, as a 64-character lowercase hex value." The stale "Access-link" half is gone.
- Claim verified against code: `src/server/security/player-credential-tokens.ts` uses `randomBytes(32)` (256 bits) → base64url 43-char token, and `createHash("sha256").digest("hex")` (64 lowercase hex chars). Digest-only persistence confirmed in `src/server/db/prisma-player-access-store.ts` (`token_hash` `char(64)` lookups; `src/application/player-access/service.ts:88` propagates only `tokenHash`).
- Consistency grep over current docs (`docs/*.md`, `README.md`, `walkthrough.md`, `PRODUCT.md`, `DESIGN.md`): no remaining claim of Access-link tokens as a current convention; the "256 bits" rule now appears exactly once, correctly scoped. Remaining "access link" mentions are only in the historical audit doc and refactor-dossier. This also removes the round-1 P20-accident risk (the line surviving P20 with stale wording), so no P20 follow-up is needed for it.

### Fix 3 — proxy comment rationale — CLOSED

- `src/proxy.ts:108-110` now reads: "/jogar is the public play surface handed off to the GameMaker client. Keep 'no-referrer' so nothing about the player context leaks via Referer to third origins." The false HEAD rationale (activity tokens in URL forwarded via `?activity_token`) is gone.
- Verified accurate: `/jogar` renders `PlayerEntryScreen` → `GameHost`, which iframes the configured GameMaker client (`src/components/public/game-host.tsx:879-887`, `src={gameClientUrl}`), and CSP `frame-src` includes `gameClientOrigin()` — i.e., a genuine third-origin handoff, which `no-referrer` on `/jogar` and `/jogar/*` (code unchanged by this fix; the `/atividade/` disjunct removal was part of the round-1 reviewed base diff) correctly guards. The code/test coupling from round 1 is untouched.
- INFO (carry-over, not new): the trailing sentence "Other routes keep a stricter default." is retained verbatim from HEAD. `strict-origin-when-cross-origin` is the modern browser default (stricter than the legacy default) though looser than `/jogar`'s `no-referrer`; the phrasing is at most ambiguous, pre-existing, and not introduced or worsened by this fix. No action required.

### Verification runs (Node 24.19.0)

- `npx vitest run tests/unit/proxy.test.ts` — 5/5 pass (vitest 4.1.11).
- `npx tsc --noEmit` — clean, exit 0.

### Delta verdict

**Fixes hold up; P10 still satisfied: yes.** All three fixes close their findings accurately (each verified against code, not just wording), with no new issues introduced. Round-1 MINOR #2 (`docs/current-architecture.md` `/health` rows) remains booked to P50 as before and is unaffected by this round.
