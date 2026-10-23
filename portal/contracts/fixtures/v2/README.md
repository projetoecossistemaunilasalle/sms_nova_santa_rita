# V2 fixture payloads

These are the cross-repo transport oracle for the portal and Heroes_Trial bridge.
All IDs are inert test labels, not credentials or child identity. V1 fixtures are
unchanged. Run `npm run test:contracts:v2` to validate every fixture with both Zod
and Ajv (including the documented JSON Schema extension keywords).

## Valid Payloads

- `game-state.json`: real current-product V3 snapshot, exported with
  `currentProductSnapshot({ armor: "equipped" })` from the read-only game file
  `Heroes_Trial/web-poc/tests/persistence/current-product-fixtures.ts`. It includes
  completed missions, accounting, progression, and equipped armor; it is not a
  hand-authored approximation. The same snapshot is embedded in returning bootstrap,
  save request, and conflict fixtures.
- `content-manifest.json`: generated from the real game catalog with
  `cd ../Heroes_Trial/web-poc && node tools/content-manifest.mjs <absolute-output-path>`.
  Content version: `heroes_trial_school_2026_10`. The exporter was also checked
  against `createCurrentContentManifest()` without modifying game sources.
- `session-content-policy.json`: one module (`saude_bucal`), its two missions,
  real activity presets, and a boolean option. Policy/manifest versions remain `1`
  inside protocol V2; the enclosing directory does not change those versions.
- `new-player-bootstrap.json`, `returning-player-bootstrap.json`: explicit
  new-player/null-state and returning-player/V3-state variants, with content policy
  and stored content version.
- `game-ready.json`, `bootstrap-applied.json`: version negotiation and policy
  application, including ignored mission IDs, presets, and options.
- `state-save-request.json`, `accepted-save.json`, `stale-revision-conflict.json`:
  optimistic revision-based save and conflict recovery.
- `result-submission.json`: pre-enqueue result without a host-assigned event ID.
  `result-lia-memory.json`, `result-pingpong-defense.json`,
  `result-comfort-traffic-light.json`, `result-brushing-teeth-practice.json`, and
  `result-smile-kit-selection.json`: one durable result per activity, using the
  actual metric keys from the game's `src/content/catalog/modules.ts` and the
  manifest's mission/content/mechanic/preset identifiers. Values are deterministic
  examples, not recordings from real players. The comfort activity only counts
  classified situations; it does not infer correctness.
- `result-acknowledgement.json`, `active-time-submission.json`,
  `active-time-batch.json`, `active-time-acknowledgement.json`: durable delivery and
  active time, with and without the optional `mission_id`.
- `local-durability-acknowledgement.json`, `local-durability-state.json`,
  `local-durability-active-time.json`: all three local durability record types.
- `visibility-focused.json`, `visibility-background-offline.json`: lifecycle flags.
- `protocol-error.json` and `protocol-error-{policy-invalid,policy-empty,
  content-upgrade-required,internal-error,load-failed}.json`: legacy validation
  failure plus every new V2 error code.

## Invalid Payloads

Each file isolates one transport violation:

- `unknown-field.json`: unknown envelope field on a closed object.
- `v1-type-literal.json`: a V1 type literal in a V2 message.
- `unsupported-state-schema-version.json`: `schema_version: 1`, not `3`.
- `oversized-state.json`: 131,072 copies of the two-byte UTF-8 character U+00E9;
  compact serialized size is 262,177 bytes, exceeding 262,144 despite the shorter
  JavaScript string length.
- `policy-unknown-key.json`: unknown policy field.
- `policy-duplicate-mission-ids.json`: repeated enabled mission ID.
- `policy-invalid-option.json`: numeric rather than boolean/string option value.
- `bad-id-preset.json`: a preset outside `^[a-z0-9_]{1,64}$`.
- `non-finite-metric.json`: JSON numeric literal `1e400`, which `JSON.parse` turns
  into `Infinity`. Do not reserialize this fixture with `JSON.stringify`, which
  would silently replace the value with `null` and lose the non-finite-number test.
- `null-state-without-new-player.json`: null state with `new_player: false`.

An empty `enabled_mission_ids` is deliberately schema-valid so the game can return
`POLICY_EMPTY`; the portal must not author/send an empty effective mission policy.

## Provenance and Regeneration

The manifest command above is the canonical generator. The snapshot export used a
throwaway Vite script in the prescribed external scratchpad, with dependency
discovery disabled and its cache redirected there. No script or fixture was added
to Heroes_Trial. Updating game-owned data means re-exporting it, then regenerating
the related envelopes and checking both repositories against this oracle.
