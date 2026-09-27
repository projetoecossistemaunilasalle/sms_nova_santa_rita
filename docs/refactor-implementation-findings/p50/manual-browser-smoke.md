# P50 Manual Browser Smoke — Static Export

Date: 2026-09-26/27. Export: post-P50 `npm run build:demo` (`out/`), served locally at
`http://127.0.0.1:4173/SMS_Portal/` with a throwaway static server (not committed).
Browser: ZCode in-app Chromium (viewport 1280×720 and 390×844).

## Environment findings (not product defects)

1. **The in-app browser never fires `requestAnimationFrame`** even though
   `document.visibilityState === "visible"`. React's streamed-content reveal
   (`$RC`/`$RV` in Next's static export) waits on rAF, so every page whose HTML
   contains a Suspense fallback showed the loading skeleton forever. Verified NOT a
   product defect: the currently deployed **pre-refactor** demo
   (https://niciniv.github.io/SMS_Portal/portal/) behaves byte-identically in the
   same browser, and the export structure (`B:0` template + `S:0` hidden content +
   `$RC` swap) is identical. With a rAF shim injected by the throwaway server, all
   content renders immediately. Real browsers fire rAF; no product change needed.
2. **localStorage is isolated per tab** in this browser, so the two-tab state
   update check could not be exercised here. The designed mechanism
   (`use-demo-portal` listening to the `storage` event on the shared
   `missoes-caramelito:adult-portal:v2` key) is unchanged from pre-refactor code.

## Checklist results

| Runbook smoke item | Result |
| --- | --- |
| Seeded organization, class, result, player-detail routes | PASS — overview (EMEF Victor Aggens, 2 turmas), turmas list (3º A, 5º B), class detail, resultados (3 turmas, live participation from my session), class results, player detail (Player 01, session history) all render seeded content |
| Demo sign-in/out | PASS — `/entrar/` demo link → portal as Adriana (platform admin); "Sair do portal" → `/entrar/` |
| One organization or class mutation | PASS — class mutations exercised (see credentials below); profile switch re-renders shell (platform admin ↔ org admin ↔ teacher scopes, nav items change correctly) |
| Credential allocation | PASS — "Criar e gerar QR" ×1 created Jogador 04–08 (next-number sequence), success message shown, print sheet opened with QR cards |
| Credential rotation | PASS — "Trocar QR" for Jogador 01 → confirmation → old credential revoked (REVOKED in state), new active credential issued, fresh QR on sheet |
| Credential entry | PASS — `/jogar/?cred=<player-01 token>` resolves the player, scrubs the token from the URL (`replaceState`), game host renders "Jogo pronto"; demo adapter "Registrar um passo" advances the counter 00→02 |
| Print | PASS (static verification) — compiled `@media print` rules: `body>*{visibility:hidden}` (chrome hidden), `.printSheet:not([data-player-print-active]){display:none}` (ordinary print does not reveal the hidden sheet), `.printSheet{grid-template-columns:repeat(2,minmax(0,1fr))}` (QR cards in two columns); sheet visually verified on screen with QR data-URL images and "DEMONSTRAÇÃO • SEM VALIDADE EM PRODUÇÃO" headers |
| Reload + same-tab state updates | PASS — re-entering with the same credential resumes the persisted counter (02 steps, IndexedDB persistence via `src/runtime/offline`); portal profile switch and all mutations re-render in place |
| Two-tab state updates | NOT TESTABLE here — IAB isolates localStorage per tab (tab A read `organization-admin`, tab B read `teacher` simultaneously). Mechanism unchanged from pre-refactor (shared key + `storage` event listener) |
| Invalid/corrupt browser state → seed fallback | PASS — wrote valid-JSON version-2 payload with `organizations: null`, `profiles: "oops"`, `memberships: 42`; reload restored the fresh seed (4 profiles, default actor, correct overview) |
| Mobile navigation | PASS — at 390×844 the sidebar becomes the fixed bottom bar (74px, dark green) with the profile's nav items; scope-gated content renders correctly (platform admin sees the "Turmas são gerenciadas pelas organizações" state card) |
| One error state | PASS — `/jogar/?cred=invalid_token_999` → "Este QR não foi reconhecido" with guidance, URL scrubbed |
| Base-path links | PASS — every rendered link carries `/SMS_Portal/` (checked on entrar, portal, turmas, resultados, ajuda) |

## Observations (non-blocking)

- The class-creation form still says "O acesso numerado de jogadores será
  configurado em um próximo slice" — stale copy on `portal/turmas` (the numbered
  access exists); candidate for a future copy pass, not part of the runbook's P50 list.
- The IAB click interception times out on button/link clicks; smoke used in-page
  `.click()` dispatches, which exercise the same React handlers.
