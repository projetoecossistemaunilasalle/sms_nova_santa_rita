# V2 Portal ↔ Game Contract (Draft)

Status: **draft for review** — not approved. Game-side phase 1 groundwork
(content manifest, enabled-missions session policy) exists in Heroes_Trial
`web-poc/`, still carried by the V1 bridge; the V2 messages are not implemented.
Date: 2026-10-22.
Scope: SMS_Portal (host, API, data model, adult UI) and Heroes_Trial `web-poc/`
(the maintained Phaser game). GameMaker is not a target of this contract.

This draft replaces the four-mission V1 projection with a contract for the current
six-mission game, and adds a game-published **content manifest** plus a
portal-authored **session content policy**, so a session can choose which
modules/missions appear.

Retrocompatibility with V1 is not a requirement (see Heroes_Trial
`docs/maintenance_cutover/save_and_parity.md`, "Latest-Version Policy"). No
production portal data exists yet, so V1 rows need no migration.

## 1. Principles

1. **The game defines content; the portal selects from it.** The portal never
   authors missions, activities, parameters, rewards or routing. It only chooses
   among IDs the game publishes, by stable ID. This keeps PRODUCT.md's rule that the
   portal is not a game editor.
2. **Game state stays opaque to the portal.** The portal checks transport shape,
   versions and size; the game validates semantics. Field-level server merges stay
   forbidden.
3. **Allowlist, not exclusion list.** A session states what is enabled. New missions
   in a later game build never appear in a session that did not select them.
4. **Hidden is not deleted.** Disabling a mission for a session hides it; its saved
   progress, rewards and paid cosmetics remain untouched.
5. **Stable IDs are the compatibility layer.** Published mission, activity,
   checkpoint, skin, module and preset IDs are never renamed (already a game rule).
6. **Origins are explicit.** The game accepts a parent portal only from a
   build-time allowlist (§9).

## 2. Current game facts this draft relies on

Verified in `Heroes_Trial/web-poc/src` on 2026-10-22.

| Mission ID | Title (PT-BR) | Activity ID | Mechanic | Current tunable `parametros` |
| --- | --- | --- | --- | --- |
| `lia_memory` | Atitudes positivas | `lia_memory` | `memory_pairs` | `pares_para_concluir: 4` |
| `pingpong_soccer` | Futebol no pátio | `pingpong_defense` | `defesa_bolas` | `velocidade_bola: 320`, `quantidade_bolas: 4`, `trocas_para_concluir: 15` |
| `respect_also_cares` | Respeitar também é cuidar | `comfort_traffic_light` | `comfort_traffic_light_drag` | `total_cards: 4` |
| `when_play_stops_being_play` | Quando a brincadeira deixa de ser brincadeira? | — (dialogue/investigation) | — | — |
| `brushing_teeth` | Escovando com Nico | `brushing_teeth_practice` | `brush_drag_regions` | none |
| `smile_kit` | Kit do Sorriso | `smile_kit_selection` | `daily_dental_care_selection` | none |

Current result metrics: `pares`, `jogadas` (Lia); `bolas_bloqueadas`,
`bolas_perdidas`, `trocas_concluidas`, `pontuacao_local` (Ping-Pong);
`situacoes_classificadas` (Respect); `regioes_limpas`, `limpeza`,
`distancia_escovada` (Brushing); `acertos`, `erros` (Smile Kit).

Current save is `V3Snapshot` (`src/integration/persistence/snapshot-v3.ts`):
`{ schema_version: 3, history: V2Snapshot, skins: SkinState }`, max 262,144 UTF-8
bytes. `history` carries earned progression, reward/challenge ledgers,
`archived_missions` for missions removed from the catalog, and a game-local
`session { id, started_at, revision }`. `skins` carries paid ownership
(`default`, `medieval_armor`, `vampire`) and the equipped skin.

Existing groundwork reused here: `portal.configure.v1` and an optional `config` on
`portal.bootstrap.v1` already drive `validateSessionPolicy`
(`src/integration/portal/session-policy.ts`), which hides missions/characters in
the world coordinator. Gaps: its allowlists and dependency table cover only the
four V1 missions, it uses exclusion semantics, and `difficulty` is validated but
never read by any activity.

## 3. Versions and identifiers

| Identifier | Owner | Meaning | V2 value |
| --- | --- | --- | --- |
| `protocol_version` | shared | Host↔game message protocol | `2` (V2 accepts only `2`) |
| `state.schema_version` | game | Save payload format | `3` |
| `content_version` | game | Durable ID vocabulary (missions, stages, checkpoints, rewards, skins, modules, presets) | Build constant, e.g. `heroes_trial_school_2026_10` (**proposed**) |
| `manifest_version` | game | Content-manifest file format | `1` |
| `policy_version` | portal | Session content-policy format | `1` |
| server `revision` | portal | Optimistic concurrency, beside state, never inside it | unchanged |

`content_version` changes only when a durable ID becomes incompatible. Adding a
mission, module or preset is compatible and does **not** require a new
`content_version`; it only produces a new manifest (new `build_id`).

All V2 message types use the `.v2` suffix. A V1 message received by a V2 peer
produces `PROTOCOL_VERSION_UNSUPPORTED`.

## 4. Content manifest (game → portal)

### 4.1 Source and distribution

- The game gains one authored file, `src/content/catalog/modules.ts`, declaring
  modules (§4.3), per-activity presets (§4.4), metric descriptors and session
  options. Everything else is derived from the composed catalog.
- `npm run build` emits `dist/content-manifest.json` (Vite plugin
  `tools/content-manifest.mjs`, also runnable as a CLI). It is derived from the
  composed catalog at build time, so there is no hand-edited copy to drift.
- The manifest carries no build identity: the build ID is a hash computed after it
  (`offline-shell.json`). The portal records `buildId` from `offline-shell.json`
  and, when present, `sourceCommit` from `release.json`, at import time.
- The portal imports a manifest by fetching `<GAME_CLIENT_URL>/content-manifest.json`
  server-side (an explicit admin action or deploy step), validating it, and storing
  it immutably (§7.1). Sessions reference the stored row, never a live URL.
- Demo mode loads a committed fixture manifest.

### 4.2 Shape

```json
{
  "manifest_version": 1,
  "content_version": "heroes_trial_school_2026_10",
  "modules": [
    {
      "module_id": "convivencia",
      "title": "Convivência e respeito",
      "summary": "Inclusão, limites do corpo e o que fazer diante do bullying.",
      "order": 1,
      "mission_ids": ["lia_memory", "pingpong_soccer", "respect_also_cares", "when_play_stops_being_play"]
    },
    {
      "module_id": "saude_bucal",
      "title": "Saúde bucal",
      "summary": "Escovação e cuidados diários com os dentes.",
      "order": 2,
      "mission_ids": ["brushing_teeth", "smile_kit"]
    }
  ],
  "missions": [
    {
      "mission_id": "pingpong_soccer",
      "module_id": "convivencia",
      "title": "Futebol no pátio",
      "summary": "Convidar quem ficou de fora para jogar.",
      "activity_ids": ["pingpong_defense"],
      "completion_reward": { "coins": 10, "stars": 1 }
    }
  ],
  "activities": [
    {
      "activity_id": "pingpong_defense",
      "mission_id": "pingpong_soccer",
      "content_id": "inclusao_no_recreio",
      "mechanic_id": "defesa_bolas",
      "activity_version": 1,
      "title": "Defesa de bolas",
      "presets": [
        { "preset_id": "padrao", "label": "Padrão", "default": true }
      ],
      "metrics": [
        { "key": "bolas_bloqueadas", "label": "Bolas defendidas", "kind": "count" },
        { "key": "bolas_perdidas", "label": "Bolas perdidas", "kind": "count" },
        { "key": "trocas_concluidas", "label": "Trocas concluídas", "kind": "count" },
        { "key": "pontuacao_local", "label": "Pontuação", "kind": "score" }
      ]
    }
  ],
  "session_options": [
    { "option_id": "skin_shop", "type": "boolean", "default": true, "label": "Loja de visuais" }
  ]
}
```

The module grouping, summaries, activity titles and metric labels above are
**placeholders**; the actual grouping is a pedagogical decision (§12). The
`completion_reward` is the real authored value (every current mission grants
10 coins and 1 star) and is derived from the catalog, not written by hand.

### 4.3 Rules

- Every catalog mission appears exactly once in `missions` and in exactly one
  module. Every activity appears exactly once.
- `module_id`, `preset_id`, `option_id`: lowercase `[a-z0-9_]{1,64}`, stable once
  published.
- Titles, summaries and labels are PT-BR display copy; changing them is not a
  content-version change.
- `metrics[].kind` is one of `count`, `score`, `ratio`, `duration_ms`, `measure`
  (a continuous value without a fixed unit, e.g. brushing distance). Descriptors
  only label metrics; they never claim correctness the activity does not measure
  (for example, Respect's `situacoes_classificadas` is not a correctness score).
- Characters, rooms, zones, stages and asset keys are **not** in the manifest. They
  are game internals; the V1 `excluded_characters` concept is dropped from the
  public contract.
- Max manifest size: 131,072 UTF-8 bytes.

### 4.4 Presets

A preset is a named, game-owned set of activity parameters. The portal sends only
`preset_id`; the game maps it to `parametros`. Every activity has exactly one
`default: true` preset, `padrao`, equal to today's parameters. Additional presets
(e.g. `facil`, `desafio`) are added only when the game team defines their values;
activities without tunables (Brushing, Smile Kit today) expose `padrao` only, and
the portal hides the preset control for them.

The 1–5 `difficulty` number is removed from the session policy. The activity
context's `dificuldade` field remains as recorded by the game.

### 4.5 Session options

Boolean or enum switches the game already knows how to honour. Initial candidate:
`skin_shop` (show or hide the cosmetic shop; ownership and equipped skin are
unaffected). Others (voice, subtitles, text size, session time limit) are added
only once implemented in the game. The portal renders options generically from
the manifest.

## 5. Session content policy (portal → game)

### 5.1 Shape

```json
{
  "policy_version": 1,
  "authored_content_version": "heroes_trial_school_2026_10",
  "enabled_module_ids": ["saude_bucal"],
  "enabled_mission_ids": ["brushing_teeth", "smile_kit"],
  "activity_presets": { "brushing_teeth_practice": "padrao" },
  "options": { "skin_shop": false }
}
```

- `enabled_mission_ids` is **authoritative** and resolved by the portal when the
  session starts. `enabled_module_ids` is kept for display and reporting only.
- An empty policy is invalid. "Everything" is expressed by listing every mission;
  the portal's "Todo o conteúdo" shortcut does this.
- `activity_presets` may omit activities; omitted means `padrao`. `options` may
  omit options; omitted means the manifest default.
- The policy is resolved and frozen when the session starts. It does not change
  for that session in phase 1.

### 5.2 Game enforcement

1. Validate shape. Unknown `policy_version` → `POLICY_INVALID`.
2. Intersect `enabled_mission_ids` with the build's catalog. Unknown IDs are
   ignored and reported back (§6, `bootstrap_applied`). An empty intersection →
   `POLICY_EMPTY`; the host shows "Conteúdo indisponível nesta versão do jogo".
3. Unknown preset IDs fall back to `padrao` and are reported. Unknown options are
   ignored and reported.
4. Disabled missions are hidden in presence (NPCs, markers, prompts) through the
   existing coordinator policy hook. They are **not** routed through
   `archived_missions`, which remains reserved for missions removed from the
   catalog.
5. Disabled mission state is exported unchanged on every save, including a
   mission that was `active` when it became disabled. Re-enabling resumes it.
6. Starter zones (`starter_role_ids`, `exclusive_when_active`) must not strand
   the player when their starter mission is disabled. This needs explicit tests for
   each zone.
7. Rewards, wallet, challenge ledger and skins are global to the player and never
   filtered by the policy.
8. Standalone mode (landing page, `catalog-local-v3`) has no policy: everything is
   enabled, as today.

### 5.3 Offline

The policy arrives in the bootstrap and is cached by the host with it in
IndexedDB. Offline continuation uses the cached policy.

## 6. Messages

Message rules not stated here (IDs, local-durability acks, retry/backoff, one save
in flight, conflict reload) are carried over unchanged from V1.

| Message | Direction | Change from V1 |
| --- | --- | --- |
| `game.ready.v2` | game → host | + `content_version` |
| `portal.bootstrap.v2` | host → game | + `content_policy`, + `stored_content_version`; `state` is a V3 snapshot (or `null` with `new_player: true`) |
| `game.bootstrap_applied.v2` | game → host | + `effective_mission_ids`, + `ignored` (`{ mission_ids, presets, options }`) |
| `game.save.v2` | game → host | + `content_version` beside `state`; `state` is V3 |
| `portal.save_ok.v2` | host → game | unchanged shape |
| `portal.save_conflict.v2` | host → game | `state` is V3, + `stored_content_version` |
| `game.result.v2` | game → host | context gains `id_preset`; nested `{ estado, duracao_ms, metricas }` unchanged |
| `game.active_time.v2` | game → host | each event gains optional `mission_id` (present in `dialogue`/`activity` mode) |
| `portal.result_ack.v2`, `portal.active_time_ack.v2`, `portal.local_durable.v2`, `portal.visibility.v2` | host → game | version suffix only |
| `protocol.error.v2` | both | keeps the V1 codes; adds `POLICY_INVALID`, `POLICY_EMPTY`, `CONTENT_UPGRADE_REQUIRED` |
| `portal.configure.v2` | host → game | **reserved** for phase 3 live policy changes; not sent in phase 1 |

### 6.1 Examples

```json
{ "type": "game.ready.v2", "supported_protocol_versions": [2], "supported_state_schema_versions": [3],
  "content_version": "heroes_trial_school_2026_10" }
```

```json
{
  "type": "portal.bootstrap.v2",
  "request_id": "01J...",
  "protocol_version": 2,
  "player_id": "opaque-player-id",
  "class_session_id": "opaque-class-session-id",
  "revision": 42,
  "stored_content_version": "heroes_trial_school_2026_10",
  "state": { "schema_version": 3, "history": {}, "skins": {} },
  "content_policy": { "policy_version": 1, "authored_content_version": "heroes_trial_school_2026_10",
    "enabled_module_ids": ["saude_bucal"], "enabled_mission_ids": ["brushing_teeth", "smile_kit"],
    "activity_presets": {}, "options": { "skin_shop": false } }
}
```

```json
{ "type": "game.bootstrap_applied.v2", "request_id": "01J...",
  "effective_mission_ids": ["brushing_teeth", "smile_kit"],
  "ignored": { "mission_ids": [], "presets": {}, "options": [] } }
```

```json
{ "type": "game.save.v2", "request_id": "01J...", "expected_revision": 42,
  "content_version": "heroes_trial_school_2026_10",
  "state": { "schema_version": 3, "history": {}, "skins": {} } }
```

(`history`/`skins` abbreviated; real messages carry the complete V3 snapshot.)

### 6.2 Content-version handling

- `stored_content_version` newer than the game build → the game refuses with
  `CONTENT_UPGRADE_REQUIRED` and never overwrites the state. The host shows an
  "atualize o jogo" screen and reloads the game shell.
- `stored_content_version` older than the build → the game migrates or refuses,
  as it does for local saves today; it never silently resets.
- A policy authored against another content version still applies by stable
  mission ID (§5.2 step 2).

### 6.3 Portal-side validation of state

The portal checks only:
- `state` is a plain JSON object with integer `schema_version` in the supported set
  (`[3]`);
- the serialized size is ≤ 262,144 UTF-8 bytes, depth ≤ 32, numbers are finite;
- `content_version` is non-empty, ≤ 200 chars.

`GAME_STATE_MAX_UTF8_BYTES` moves from 65,536 to 262,144 and
`GAME_REQUEST_MAX_BYTES` from 90,000 to 300,000.

### 6.4 Server revision vs. `history.session.revision`

The V3 snapshot carries a game-local `session.revision`. The server `revision`
stays authoritative for concurrency and is never read from state. Whether the game
should mirror the server revision into `history.session` in portal mode is an open
point (§12).

## 7. Portal data model

Changes against `prisma/schema.prisma`.

### 7.1 New: `GameContentManifest`

```prisma
model GameContentManifest {
  id             String   @id @default(uuid()) @db.Uuid
  contentVersion String   @map("content_version") @db.VarChar(200)
  buildId        String   @unique @map("build_id") @db.VarChar(100)
  sourceCommit   String   @map("source_commit") @db.VarChar(64)
  manifestHash   String   @map("manifest_hash") @db.Char(64)   // SHA-256 of canonical JSON
  payload        Json     @db.JsonB
  importedAt     DateTime @default(now()) @map("imported_at") @db.Timestamptz(3)
  importedById   String?  @map("imported_by_id") @db.Uuid
  isCurrent      Boolean  @default(false) @map("is_current")
  gameSessions   GameSession[]

  @@index([contentVersion])
  @@map("game_content_manifests")
}
```

Rows are immutable after import. Exactly one row has `isCurrent = true`, enforced
by a partial unique index in the migration. Only platform administrators import a
manifest or mark it current.

### 7.2 `ClassGroup`: default content

```prisma
  defaultContentSelection Json? @map("default_content_selection") @db.JsonB
```

Holds `{ enabled_module_ids, enabled_mission_ids, activity_presets, options }`
**without** freezing a content version. It is re-resolved against the current
manifest at each session start, so missions added to a selected module appear
automatically. `null` means "Todo o conteúdo".

### 7.3 `GameSession`: frozen policy

```prisma
  contentManifestId String  @map("content_manifest_id") @db.Uuid
  contentPolicy     Json    @map("content_policy") @db.JsonB   // the exact §5.1 object sent to the game
  startedById       String? @map("started_by_id") @db.Uuid
  contentManifest   GameContentManifest @relation(fields: [contentManifestId], references: [id], onDelete: Restrict)
```

### 7.4 `GameState`

Shape unchanged. V2 rows have `protocolVersion = 2`, `schemaVersion = 3`. The
size limit changes as in §6.3.

### 7.5 Events: reporting dimensions

- `ResultEvent`: + `moduleId String? @db.VarChar(64)`, + `presetId String? @db.VarChar(64)`;
  index `@@index([moduleId, receivedAt])`.
- `ActiveTimeEvent`: + `missionId String? @db.VarChar(100)`, + `moduleId String? @db.VarChar(64)`.

`moduleId` is denormalized at ingestion from the participation's session manifest,
so SQL aggregation stays a single `GROUP BY` and reports are unaffected by later
regrouping. Events naming a mission absent from that manifest store
`moduleId = null` and are still accepted.

### 7.6 Phase 2 (optional): organization scope

`Organization.allowedModuleIds Json?` lets an organization administrator limit which
modules its classes may select, for example when a school's programme covers only
oral health. `null` = all.

## 8. Portal application and UI changes

### 8.1 Services

- `GameContentService`: import/validate/list manifests, `current()`, and
  `resolvePolicy(selection, manifest) → ContentPolicyV1` (module → mission
  expansion, preset/option defaults, empty-selection rejection).
- `PlayerAccessService.startSession(profileId, classGroupId, selection?)`:
  resolves the selection (explicit, else class default, else everything) against
  the current manifest, stores `contentManifestId` + `contentPolicy` in the same
  transaction as the session row.
- `GameStateService.bootstrap`: emits `portal.bootstrap.v2` with the session's
  `contentPolicy`.
- `GameEventService`: validates `.v2` events, derives `moduleId`, stores
  `presetId`/`missionId`.
- New Zod schemas in `src/contracts/v2/`, generated JSON Schemas in
  `contracts/schemas/v2/`, fixtures in `contracts/fixtures/v2/`, with the same
  parity tests as V1. V1 contract code is deleted once V2 lands.

### 8.2 Session start (class page, `player-access-workflow.tsx`)

Goal: keep the one-click start for teachers; choosing content is optional.

- **No active session.** The card keeps the primary **Iniciar sessão** button,
  which starts with the class default. Beneath it, a one-line summary of what will
  be played ("Saúde bucal · 2 missões") and a secondary **Escolher conteúdo**
  button.
- **Escolher conteúdo** opens a dialog (same `<dialog>` pattern as the end-session
  confirmation):
  - one card per module, in manifest order: checkbox, title, summary, "N missões";
  - expanding a module lists its missions with checkboxes, so a teacher can pick
    single missions;
  - "Ajustes" (collapsed): a Padrão/Fácil/Desafio segmented control only for
    activities with more than one preset, and the manifest's session options;
  - "Salvar como padrão da turma" checkbox;
  - live summary "4 missões · 3 atividades"; **Iniciar sessão** is disabled when
    nothing is selected.
- **Active session.** The card shows chips for the session's modules (or "Todo o
  conteúdo"). Content cannot be changed until the session ends (phase 1).
- **Class settings.** A "Conteúdo padrão" section on `/portal/turmas/[id]` edits
  `defaultContentSelection` with the same picker.
- **Results.** `/portal/resultados/[classGroupId]` gains a module filter and
  per-module totals. Metric labels come from the manifest instead of hard-coded
  keys.
- **Platform admin.** `/portal/admin` gains "Versões do jogo": list imported
  manifests, import from `GAME_CLIENT_URL`, mark current.

Authorization: assigned professionals and organization administrators may choose
session content and edit the class default; only platform administrators import
manifests. Phase 2 organization limits filter the picker.

### 8.3 Player host

- `game-host.tsx` speaks `.v2` only; it caches `content_policy` with the bootstrap
  in IndexedDB.
- `CONTENT_UPGRADE_REQUIRED` shows a PT-BR "atualizando o jogo" screen and reloads
  the iframe once; repeated failure shows a "chame o professor" screen.
- `POLICY_EMPTY` shows "O conteúdo escolhido não está disponível nesta versão do
  jogo. Avise o professor."

## 9. Origins and hosting

- The game reads `VITE_PORTAL_ORIGINS` (comma-separated, exact origins) at build
  time. Portal mode is selected only when embedded and the parent origin is in that
  list. The localhost-only rule in `src/integration/selection.ts` stays for dev
  builds. No URL parameter can widen the list.
- Recommended deployment: serve the game build from the portal's own origin under
  a fixed path (e.g. `/jogo-cliente/`), via the reverse proxy or the portal's static
  files. Then `GAME_CLIENT_URL` and `frame-src` are same-origin and
  `VITE_PORTAL_ORIGINS` is the portal origin alone.
- The landing page keeps embedding the standalone build (`catalog-local-v3`);
  it never receives portal permissions.

## 10. Work items

### Heroes_Trial (`web-poc/`)

1. `src/content/catalog/modules.ts`: modules, presets (`padrao` = today's values),
   metric descriptors, session options.
2. Manifest generator + build output `dist/content-manifest.json` + parity test
   against the composed catalog.
3. `session-policy.ts`: derive IDs and dependencies from the catalog; switch to
   `enabled_mission_ids`; apply presets in each activity context factory; record
   `id_preset`; drop public character exclusion and the numeric difficulty.
4. Honour `skin_shop` option in the shop entry point.
5. `src/integration/portal/`: V2 types, validators and bridge on top of the V3
   snapshot; remove the V1 projection from portal mode.
6. `selection.ts`: build-time origin allowlist.
7. Tests: policy intersection/empty/unknown IDs; disabled in-progress mission
   round-trips unchanged; no starter-zone dead ends for every subset of modules;
   presets reach `parametros`; content-upgrade refusal; origin allowlist.
8. Replace the remaining `current_time`-based attempt ID in Smile Kit
   (`smile-kit/module.ts`) with `createAttemptIdV1`, as the other activities do.

### SMS_Portal

1. Prisma migration for §7 (manifest table, class default, session policy, event
   dimensions).
2. `src/contracts/v2` + JSON Schemas + fixtures + parity tests; size limits.
3. Services per §8.1; host `.v2` per §8.3.
4. UI per §8.2; demo mock with a fixture manifest.
5. Reports: module filter/grouping, manifest-driven metric labels.
6. Update README, PRODUCT.md and current-architecture.md: Phaser game, not
   GameMaker; the "selects, never authors" rule.

### Shared

1. End-to-end Playwright run: portal (server mode, Neon dev branch) + game build
   served same-origin; start a session with one module; QR entry; bootstrap;
   disabled mission absent; save/conflict; results with `moduleId`; offline
   queue and later upload; content-upgrade path.

## 11. Phases

1. **Phase 1 — contract + module selection.** Everything in §§3–9 except
   presets beyond `padrao`, organization limits and live changes.
2. **Phase 2 — tuning and governance.** Additional presets with game-defined
   values, organization-level module limits, per-module reports.
3. **Phase 3 — live control and sequencing.** `portal.configure.v2` applied at a
   safe boundary during a session; ordered module paths ("trilhas") that unlock in
   sequence.

## 12. Open decisions

- **Module grouping, titles and summaries** (pedagogy team). The two-module split
  in §4.2 is only an example.
- **Preset values** for Lia, Ping-Pong and Respect beyond `padrao`, and whether
  Brushing/Smile Kit need tunables.
- **Initial session options** beyond `skin_shop`.
- **`content_version` naming** and who bumps it.
- Whether the game mirrors the server revision into `history.session.revision` in
  portal mode (§6.4).
- Whether teachers may change content mid-session (phase 3) or only between
  sessions.
- Whether organization administrators can restrict modules (phase 2) and
  whether classes may override that.
- Retention of `contentPolicy` and manifests after classes are archived.
- Carried over from the V1 audit, to re-check against the Phaser code: the
  active-time inactivity threshold (30 s proposed) and durable attempt numbering.
