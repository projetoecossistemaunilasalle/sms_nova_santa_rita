# Game Integration And Verification

The Pages game at `/sms_nova_santa_rita/jogo/` runs the maintained Phaser
implementation in an isolated iframe. Explicit `catalog-local-v3` mode retains
the six-mission catalog, five activities, owned skins and local progress. It does
not introduce a new portal protocol or publish the GameMaker reference runner.

## Rebuild And Publish

From a clean, current `Heroes_Trial` checkout, run in this repository:

```powershell
npm run build:jogo
node scripts/sync-bundles.mjs --jogo
npm test
npm run build
npm run verify:dist
npm run test:jogo:browser
```

The game build uses the shared maintenance mutex and relative Vite asset paths.
It creates `runtime/pages-source.json` before generating the hashed offline shell.
`jogo/release.json` identifies the source commit and exact build. Sync validates
all listed assets, the worker identity and provenance before swapping bundles;
unexpected files are rejected except the font's required license. The final
site verifier checks provenance again and validates the configured Pages paths.

Commit only the intended integration changes and `public/jogo/`, then push to
`main`. The existing Pages workflow tests, builds, validates and publishes the
committed artifact. Unrelated local landing edits need not be included.

## Browser Coverage

The integration script tests 1440x900, 2560x1440, 768x1024, 390x844, 320x568
and 844x390 using disposable Edge contexts. Touch contexts use DPR 2. Coverage
includes menu art, scrollable instructions, keyboard/touch start, all eight
world destinations, nested asset loading, normal-page scrolling, fullscreen
entry/exit, portrait/landscape resizing, settings and V3 save restoration.
Unit tests cover unavailable/denied fullscreen and invalid replacement builds.

## Verification On 2026-10-12

The integrated source is `Heroes_Trial@60f34d6`; the Phaser gameplay/assets from
the latest fetched `84e44ca` are unchanged by the verification repairs. The
published build ID is `2a0bd202a9f64d2e765a00ea`.

The independently assembled release artifact passed 39 site tests, the static
build/verifier and all six browser sizes. Game verification passed 1,261 current
unit tests, 21 tooling checks, strict types, architecture and asset checks.
The initial broad Release run passed 40/41 browser tests; its stale hover-color
assertion was fixed and rechecked in a 16/16 activity/menu/loading run. A separate
4/4 mobile-controls run verified real touch-event interaction, settings, focus,
input ownership and preserved positions. Joystick dragging is not claimed.

The required native reference verifier initially exposed stale startup/line-ending
assertions and diagnostic launches trapped at the new menu. Narrow corrections
preserved PNG hashes, retained normal menu launches and restored the single
diagnostic owner. The fresh native rerun passed 233 Python tests, asset checks,
Igor compilation, normal-launch smoke and all 18 in-engine contracts. Two
conflicting diagnostic-mode launches were also correctly rejected. The original
failing evidence is retained; a single fresh whole Release-wrapper pass is not
claimed.

Local evidence is in `../.preview/game-pages-20261012-local-pass/` and the game's
`.gm-build/landing-{integration-release,latest-ui,native,mobile-controls}-20261012-*`
directories. Live verification is recorded separately after Pages deployment.

Test the actual deployment with:

```powershell
$env:GAME_PAGE_URL = 'https://projetoecossistemaunilasalle.github.io/sms_nova_santa_rita/jogo/'
$env:GAME_EXPECTED_COMMIT = '<source commit from public/jogo/release.json>'
$env:GAME_EVIDENCE_DIR = '<absolute, new evidence directory>'
npm run test:jogo:browser
```

`GAME_PROJECT_ROOT` (absolute path to the game's `web-poc` folder) overrides the
default sibling `../Heroes_Trial/web-poc` for `build:jogo` and `sync-bundles --jogo`.

`GAME_DIST_DIR` can select an independently assembled release artifact, excluding
unrelated working-tree edits. `GAME_PROJECT_ROOT` selects the maintained game's
Playwright installation. Evidence contains screenshots and a result report with
the tested release identity.

## Limits

Edge viewport/touch emulation is not physical iPhone/Android, Safari, audible
playback or minimum-device performance acceptance. Native Computer Use was
blocked by its browser URL confidence check during this verification; no native
UI verification is claimed. The game's worker registration is deliberately
restricted to localhost, so Pages requires connectivity despite retaining local
progress. Existing dependency audit findings are outside this integration;
the locked dependency versions were not changed.
