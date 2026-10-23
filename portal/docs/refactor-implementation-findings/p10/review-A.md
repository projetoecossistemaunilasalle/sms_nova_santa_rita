# REVIEWER A — P10 (Closed Generation-A Purge)

> Note: Reviewer A's agent declined to create report files (its operating
> constraints read them as prohibiting writes). This file is a verbatim
> transcription by the coordinator of Reviewer A's final report message; no
> content was added or edited.

## Scope reviewed

Uncommitted P10 change set only; the already-reviewed P00 items (Dockerfile/.dockerignore, `.prettierignore`, `package.json` scripts, `scripts/clean-build-artifacts*`, `.github/workflows/ci.yml`, and the `auth.test.ts` env-restore helper) were excluded from judgment, except the P10 fixture edits in `tests/unit/auth.test.ts`. Overall diff: 74 files, +138 / −8633.

## Findings

### MAJOR — `docs/demo-visual-plan.md` still prescribes the deleted Generation-A tree and is linked as current guidance

`docs/demo-visual-plan.md`

- `:3` — `Status: plano de curto prazo para uma demonstração navegável e visual do SMS_Portal.` (live plan, not historical)
- `:26` — "seguindo o padrão já existente em `portal-view-service.ts`"
- `:249` — "continuar usando `src/server/services/portal-view-service.ts` para os dados existentes"
- `:334` — `src/server/services/portal-view-service.ts` listed under "Arquivos e áreas que provavelmente serão tocados"
- `:40` — `2. **Links de acesso** — /portal/atividades`; `:43` — `5. **Materiais** — /portal/materiais`; `:49` — `3. **Auditoria** — /portal/admin/auditoria`
- `:59-61` and `:337-339` — `/portal/materiais`, `/portal/materiais/novo`, `/portal/materiais/[id]/editar` proposed as new files to create
- `:166`, `:257-260`, `:292`, `:297`, `:378` — link/material/audit fixture and navigation requirements

It is linked from the root README as a current document:
`README.md:39` — `- [Visual demo plan](docs/demo-visual-plan.md) (demo reference, not V1 product authority)`. Contrast `README.md:44`, which explicitly marks the other legacy doc `(historical research only)`.

A case-insensitive grep for `histor|obsolet|deprecat|supersed` over the file returns **0 hits** — it carries no supersession banner of any kind.

This violates the P10 acceptance clause: *"Documents already and explicitly classified as historical may describe the former product, but they must not be linked as current implementation guidance."* It also falls under coupled edit 7 ("Search the whole first-party tree for imports and route strings that point to the deletion set").

**Confirmed, not a question.** Minimum close: add a superseded banner pointing at `docs/current-architecture.md` and change the README entry to match the `(historical research only)` treatment.

### MINOR — rewritten proxy comment states a rationale that is false for `/jogar`

`src/proxy.ts:108-110` — the new comment says the credential is submitted on /jogar and could leak via Referer; on the surviving route the credential is captured by the entry form and passed to a Server Action (`src/app/(public-play)/jogar/actions.ts:16-18`, `src/components/public/player-entry-screen.tsx:88-97`), never placed in the URL. The "credential leaks via Referer" reason is inherited from the deleted `/atividade/[token]` model. Condition, `no-referrer` cases, CSP, `frame-src`, matcher all correct and untouched. Recommend rewording to the real /jogar rationale.

### MINOR — `docs/schemas/README.md` still documents Generation-A access-link tokens as a current convention

`docs/schemas/README.md:38-39` — "Access-link and player-credential tokens contain at least 256 bits of randomness..." `src/server/security/tokens.ts` is deleted; only `player-credential-tokens.ts` survives. Mitigating: `model AccessLink` still exists in prisma/schema.prisma until P20. Same residue in `docs/schemas/database-model.md:173` and `:181` (P20 updates that file). Close in P10 or explicitly book for P20.

### MINOR — `DESIGN.md` still describes the deleted public entry surface as current

`DESIGN.md:250`, `:328-329` describe the opaque personal-link entry surface. No deleted path strings present; "broader copy polishing to P50" plausibly covers it. Flagged for the record.

### INFO — dead links inside an explicitly-superseded document (no action)

`docs/implementation/phase-01-foundation-contracts.md:18-19` links the deleted schema docs; that file is explicitly classified superseded by `docs/implementation/README.md:57-59`. Cosmetic.

### INFO — orphaned CSS is correct for P10

`portal.module.css:1063` (`.statusWarning`), `:1068` (`.statusDanger`) lost their only owner; P40a schedules the CSS cleanup. Not a finding.

### INFO — `apiErrorCodes` is now unenforced (deliberate)

`src/server/http/errors.ts:5-12` holds exactly the six required codes; nothing cross-checks the list anymore. Requirement mandated reduction, not enforcement. Correct as-is.

### INFO — pre-existing `walkthrough.md` / `current-architecture.md` contradiction (not P10's)

`walkthrough.md:24` claims `src/app/health/` was removed; `docs/current-architecture.md:176` still lists `/health/live`, `/health/ready` as current. Verified: no `health` hits in src/scripts; the directories are empty and untracked. Pre-existing; P50 polish.

## Verified correct

- Deletion set exact and complete (22 route-tree files, 10 services/stores, 8 components, 6 tests, 8 contract artifacts, 2 schema docs; no over-deletion beyond P00 items and coupled edit 3).
- `contracts/schemas/v1/` untouched (17 files).
- Coupled edit 1: StatusBadge behaviourally identical for the two surviving values; all 11 call sites pass `recordStatusLabel()`.
- Coupled edit 2: `isDemoRuntime` gone; `DEV_BYPASS_ACTOR` const kept, export dropped; "Links de acesso" branch removed with 0 hits; auth fixtures repointed to `/portal/turmas`, `/portal/turmas/turma-1`, `/jogar`.
- Coupled edit 3: `recuperar/page.tsx` imports only `next/link`, `useState`, `marketing.module.css`.
- Coupled edit 4: only the `/atividade/` condition removed; CSP/frame-src/matcher byte-identical; proxy test covers exactly the three required behaviors.
- Coupled edit 5: exactly the six required codes; all six emitted by surviving code; 0 removed-code strings remain (`STATE_SCHEMA_VERSION_UNSUPPORTED` is the unrelated V1 protocol code).
- Coupled edit 6: walkthrough/ajuda/current-architecture/schemas README/contracts README describe surviving boundaries only.
- Coupled edit 7: 0 hits in `src`/`tests`/`contracts` for deleted paths, module names, error codes; no permanent deletion test added.
- No redirect or compatibility shim for `/atividade/*`.
- Nav-matching regression check: all surviving items resolve correctly without the "Links de acesso" special case; "Resultados" branch still needed and intact.
- Six deleted tests covered only deleted modules (verified at HEAD); `v1-authorization.test.ts` still covers `v1-policy`.

## Verification commands and results

```
git status --short / git diff --stat         -> 74 files, +138 / -8633
git ls-tree -r HEAD -- <7 route trees>       -> 22 files, all 22 deleted
git ls-tree -r HEAD -- contracts/schemas     -> v1/ (17 files) intact
npx vitest run                               -> 28 files / 187 tests passed  (exit 0)
npx tsc --noEmit --incremental false         -> exit 0
npx eslint . --max-warnings=0                -> exit 0
```

## Verdict

**P10 satisfied: no — one MAJOR to close.** The code, contract, and test halves of P10 are fully and correctly satisfied. The single blocker is documentation-side: `docs/demo-visual-plan.md` is not classified as historical, prescribes deleted files/routes, and is linked from the root README. Add a superseded banner and re-label the README entry (or delete the document). The MINOR items (`proxy.ts` comment rationale, `docs/schemas/README.md` access-link token line, `DESIGN.md`) should be fixed in P10 or explicitly booked to P50/P20.

---

# Re-review (fix round 1) — 2026-09-26

## Scope reviewed

Delta only: the four files changed to close round-1 findings —
`docs/demo-visual-plan.md`, `README.md`, `src/proxy.ts`, `docs/schemas/README.md`
— read as a full diff plus surrounding code. Re-verified coupled edit 6 for
`docs/schemas/README.md` (its diff was larger than the single reported line, so
the whole file was re-checked, not just the edited line). Implementation code was
not modified. `DESIGN.md` (booked P50) and the `current-architecture.md` `/health`
rows (INFO, P50) were not re-opened.

## Round-1 findings: status

### MAJOR — `docs/demo-visual-plan.md` — **RESOLVED**

All three legs of the original finding are closed.

- **Not classified as historical** — `docs/demo-visual-plan.md:3-6` now opens with
  `> **Status: documento histórico.**`, names the removed generation explicitly
  (`rotas de atividades/materiais, links de acesso e serviços como portal-view-service.ts`
  "que foi removida do produto"), states "Não é orientação de implementação atual",
  and redirects to `docs/current-architecture.md` and
  `docs/refactor-dossier/IMPLEMENTATION-READY.md` (both verified to exist).
  The banner sits immediately after the H1, before the pre-existing
  "não substitui PRODUCT.md" disclaimer.
- **Prescribes deleted routes/services** — the body still does
  (`:17`, `:26`, `:44`, `:249`, `:331`, `:334`), which the acceptance clause
  explicitly permits: "Documents already and explicitly classified as historical
  may describe the former product". The banner now pre-empts the body by naming
  exactly the deleted surfaces the body proceeds to describe, so the prescriptions
  read as description of the past rather than as a live plan.
- **Linked as current guidance** — `README.md:39` is now
  `- [Visual demo plan](docs/demo-visual-plan.md) (historical demo plan — superseded, not implementation guidance)`.
  This is at least as explicit as the `(historical research only)` treatment on
  `README.md:44`. Repo-wide grep for `demo-visual-plan` confirms `README.md:39` is
  the **only** first-party link; every other hit is inside a historical review
  corpus (`docs/agent-reviews/`, `docs/refactor-dossier-audit-2026-09-25/`,
  `docs/refactor-implementation-findings/`) or the P50 to-do list at
  `IMPLEMENTATION-READY.md:431`. No current doc presents it as guidance.

### MINOR — `src/proxy.ts` comment — **RESOLVED, and the replacement is more accurate than round 1 credited**

`src/proxy.ts:108-110` now reads:

```ts
  // /jogar is the public play surface handed off to the GameMaker client.
  // Keep 'no-referrer' so nothing about the player context leaks via Referer
  // to third origins. Other routes keep a stricter default.
```

Code is byte-identical below the comment; only the four comment lines changed.
Every claim in the replacement was checked against surviving code:

- "handed off to the GameMaker client" — true.
  `src/app/(public-play)/jogar/page.tsx:3` imports `resolveGameClientUrl`, and
  `src/components/public/game-host.tsx:148-152` posts to the iframe at
  `expectedGameOrigin(gameClientUrl)`, a third origin.
- "nothing about the player context leaks via Referer to third origins" — true,
  and the real reason is stronger than round 1 assumed. Round 1 recorded that the
  credential is "never placed in the URL". That is not quite right:
  `src/components/public/player-entry-credential.ts:21-22` reads
  `url.searchParams.getAll("cred")`, so `/jogar?cred=<token>` is a real URL form
  (the scanned-QR path), stripped afterwards via `replaceState`
  (`player-entry-screen.tsx:83-84`). So the Referer concern on `/jogar` is real
  regardless of the default, since `strict-origin-when-cross-origin` still emits
  the origin. The new wording is true as written and no longer names any deleted
  surface.
- "Other routes keep a stricter default" — true; `no-referrer` is strictly more
  restrictive than `strict-origin-when-cross-origin`.

Zero hits for `atividade|activity_token|portal-view|access-link` in `src/proxy.ts`.
The three required behaviors remain covered by `tests/unit/proxy.test.ts:27-46`.

### MINOR — `docs/schemas/README.md` token line — **RESOLVED, factually re-verified**

`docs/schemas/README.md:39-40` now reads
"Player-credential tokens contain at least 256 bits of randomness. Only a SHA-256
digest is stored, as a 64-character lowercase hex value."

This is not a relabel — the claims were checked against the surviving module
`src/server/security/player-credential-tokens.ts`:

- `TOKEN_BYTES = 32` → `randomBytes(32)` = 256 bits, so "at least 256 bits" is true.
- `hashPlayerCredentialToken` = `createHash("sha256").update(token, "utf8").digest("hex")`
  → SHA-256 as hex = 64 lowercase hex characters. True.
- `src/server/security/tokens.ts` remains deleted; the module directory now holds
  only `launch-token.ts` and `player-credential-tokens.ts`.

The rest of the file's P10 diff (migration-status banner retargeted to
`contracts/schemas/v1`, the artifact table reduced to two surviving rows, removal
of the `game_versions`/`activity_drafts` "Legacy refinements" section, dropping the
`act_`/`att_` examples, dropping "availability rules" from validation layer 3, and
replacing the "JSON Schema cannot prove that a game belongs to an activity"
sentence) is squarely coupled edit 6 work and re-verified clean: zero hits for
`api-contracts|domain-rules|access-link|AccessLink|act_|att_|game_versions|activity_draft|availability`.
All four new/existing link targets resolve (`contracts/schemas/v1`,
`contracts/schemas/README.md`, `src/contracts/v1`, `prisma/schema.prisma`).

## New issues introduced by the fix round

None. No BLOCKER, MAJOR, or MINOR regressions found.

Two observations recorded at INFO, neither actionable in P10:

- **INFO** — `docs/demo-visual-plan.md:8`, the paragraph directly beneath the new
  banner, still reads "coerente com o portal profissional **atual**". The banner
  and this sentence are in tension. It does not breach the acceptance clause
  (the document is explicitly classified historical and is no longer linked as
  current guidance), and P50 already owns this file
  (`IMPLEMENTATION-READY.md:431`). Noted only so the P50 pass does not miss it.
- **INFO / correction to my own round-1 bookkeeping** — I booked the
  `docs/schemas/database-model.md` access-link residue to P20. The file is
  actually named in the P50 documentation step
  (`IMPLEMENTATION-READY.md:427-428`), not P20. P20 item 1 does remove the
  `AccessLink` model itself, so the residue disappears either way; the doc edit
  lands in P50. Residual references are `database-model.md:5` and the
  `:171-176` "Deletion policy" section ("access links"), both current-tense about
  a model P20 deletes. Not a P10 acceptance breach — no deleted path, import,
  error code, or contract artifact, and the model still exists in
  `prisma/schema.prisma`. The "Legacy model (superseded)" section at `:179-196`
  is correctly historical.

## Verification commands and results

```
export PATH="/c/Users/Vitor/tools/node-v24.19.0-win-x64:$PATH"; node -v   -> v24.19.0

git diff -- docs/demo-visual-plan.md README.md src/proxy.ts docs/schemas/README.md
   -> only the 4 intended files touched; src/proxy.ts code byte-identical
      below the comment

npx vitest run tests/unit/proxy.test.ts   -> 1 file / 5 tests passed   (exit 0)
npx vitest run                             -> 28 files / 187 tests passed (exit 0)
npx tsc --noEmit                           -> exit 0
npx eslint . --max-warnings=0              -> exit 0
npx prettier --check README.md docs/demo-visual-plan.md docs/schemas/README.md
                                             -> All matched files use Prettier code style (exit 0)
   note: `docs` is in .prettierignore, so only README.md is actually format-gated

link targets: contracts/schemas/v1, contracts/schemas/README.md, src/contracts/v1,
   docs/current-architecture.md, docs/refactor-dossier/IMPLEMENTATION-READY.md
   -> all OK
residue greps: docs/schemas/README.md, src/proxy.ts, contracts/schemas/README.md
   -> NONE (clean)
grep -rn "demo-visual-plan" -> README.md:39 is the only first-party link
```

## Verdict

**MAJOR resolved. P10 is now satisfied: yes.**

All three round-1 MINORs that were in P10 scope are closed and independently
fact-checked; the one booked to P50 (`DESIGN.md`) and both INFOs remain booked and
are unaffected. The P10 acceptance clause — "No deleted path, import, error code,
or contract artifact remains in `src`, active tests, current user docs, or the
live contract index. Documents already and explicitly classified as historical may
describe the former product, but they must not be linked as current implementation
guidance" — is now met on both halves.

No BLOCKER, MAJOR, or MINOR findings remain in the delta scope. Proceed to P20.
