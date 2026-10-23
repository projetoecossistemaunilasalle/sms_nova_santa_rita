# Portal UX journeys

## Scope

This pass preserves the existing Caramelito identity and Portuguese interface.
It focuses on task discovery, navigation, classroom preparation, administration,
and results. Existing server authorization and the concurrent QR retrieval work
remain the source of truth.

## Teacher: prepare an existing class

1. Sign in as Carla Freitas in the local demonstration.
2. In Overview, select **Abrir turma 3º A**. A teacher with multiple active
   classes instead opens the class directory.
3. Use **Exibir QR codes da turma** to retrieve existing cards. Do not create
   new players for returning children. The existing QR retrieval flow explains
   any legacy credentials that cannot be recovered.
4. Use **Adicionar jogadores** only for children without a number; enter an
   explicit quantity and generate their cards.
5. Start the session when the tablets are ready. Starting is one action;
   ending still requires confirmation because it blocks new entries.
6. Open **Ver resultados da turma** without searching the Results directory.

## Organization administrator: find and prepare a class

1. Expand **Demonstração local** and switch to Lucas Ribeiro.
2. Open **Turmas**. Search by class or organization and filter active/inactive
   classes. A no-match state offers **Limpar filtros**.
3. Expand **Nova turma**. When only one active organization is available, it
   is already selected. Create the class, then open its card.
4. Use **Gerenciar professores** to reach assignments. If no eligible teacher
   is available, follow **Gerenciar equipe**.
5. Removing a teacher or deactivating the class describes the consequences
   and requires confirmation. Cancel or Escape must not submit the operation.

## Teacher: follow up on participation

1. Open the class, then **Ver resultados da turma**, or use **Resultados**.
2. Select **Jogador 01** to inspect session participation.
3. Results remains the selected navigation destination on both class and
   player pages. Return links identify whether they lead to reports or access
   management.
4. On a phone, class active time remains visible. Detailed table columns can
   be scrolled horizontally, including by keyboard in the named region.
5. Empty reports link back to the next useful preparation step.

## Platform administrator: locate an organization

1. Switch to Adriana Martins and open **Organizações**.
2. Search by organization name or type; accents and case do not matter.
3. Expand **Nova organização** only when creating a unit.
4. On a narrow screen, status and labeled class/team counts remain visible
   rather than disappearing with desktop table columns.

## Shared usability checks

- Keyboard users can skip navigation directly to main content.
- Help stays available on mobile; the bottom navigation reserves safe-area space.
- Demo controls remain accessible but no longer occupy the first screen.
- Empty states within a page use a second-level heading rather than another h1.
- Destructive class operations use a native modal with cancel focus and Escape.
- Search is local to the currently authorized directory; it does not broaden access.

## Limits

Live checks use the session-isolated local demonstration, not production data.
Real authentication, GameMaker gameplay, printer output, assistive-technology
announcements, and very large production directories need separate validation.

## Verification performed

- Desktop (1365 x 900) and phone layouts (390 x 844 and 320 x 740).
- Teacher: overview shortcut, start session, cancel ending with Escape, confirm
  ending, class report, player report, selected navigation throughout.
- Organization administrator: unmatched search, clear filters, create a class
  with the single organization preselected, cancel deactivation, deactivate,
  verify session controls are disabled, and reactivate.
- Platform administrator: mobile organization status/counts and preservation of
  entered form values after server validation fails.
- After an approved demo server restart: retrieve three existing QR cards,
  create one player, reload, retrieve four cards, and verify the original three
  QR images are unchanged and print controls are enabled. No physical print job
  was sent.
- Added unit coverage for nested result navigation, route segment boundaries,
  base paths, and accent-insensitive multiword directory searches.

## Follow-up: manage an existing team

Example intent: "Find Carla's access at my school and check what she can do."

1. Open **Equipe** and search for Carla, the organization, or the role.
2. Filter active or inactive memberships. **Limpar filtros** recovers from an
   unmatched search; the count announces how many memberships match.
3. Read the professional's organization, role, and status together, including
   on a phone. An organization administrator cannot change administrator roles.
4. Select **Desativar**. The confirmation names the person and organization,
   explains the loss of access and that the membership can be reactivated.
5. Cancel or press Escape to leave the membership unchanged. Platform-level
   role changes also explain the resulting permissions before submission.
6. For a new membership, expand **Adicionar à equipe**. A single active
   organization is preselected; provisioning instructions are available under
   **O profissional não aparece na lista?** rather than blocking the directory.

Gaps addressed: the original setup guide and form pushed routine management
below the fold; phone rows hid the role, organization and status; access changes
submitted without explaining their consequences. The refined screen uses a
compact summary, a searchable directory, and responsive rows retaining context.

## Follow-up: find players without recorded participation

Example intent: "Which player numbers still have no participation recorded?"

1. Open **Resultados**, choose **3º A**, then **Sem participação**.
2. The list includes only numbers with zero recorded participations across the
   class history, not just players with zero result events or zero active time.
3. Enter **02** in **Número do jogador** to locate that exact player. Leading
   zeros are accepted; searching for 2 does not accidentally match 12 or 20.
4. Open **Jogador 02** for session history, or follow **Acessos e sessão da
   turma** to check classroom preparation.
5. An unmatched number has a clear recovery action that resets both filters.

Gaps addressed: teachers previously had to scan every row; there was no direct
number lookup or participation filter. Selected filters now have visible and
accessible pressed states, counts, and a mobile horizontal-scroll hint.
The interface explicitly says that missing records do not prove absence from
class, because game data may not yet be synchronized.

### Follow-up verification (2026-10-11)

- Browser checks in the existing local demo at 1365 x 900, 390 x 844 and
  320 x 740; the final 320px team layout has no document-level horizontal overflow.
- Team search with no matches, clearing filters, visible mobile role/status,
  single-organization default, and deactivation confirmation with cancel focus
  and Escape dismissal. No access changes were submitted.
- Combined participation and exact-number filters, empty-filter recovery and
  navigation to an individual player's report.
- All 221 unit tests passed, including five new filtering/formatting tests;
  TypeScript and targeted ESLint checks passed.
- Existing sign-in, backend adapters, authorization rules, QR credential work,
  and other in-progress changes were preserved.

### Remaining product gaps

- Inviting/provisioning a new adult still requires an external administrator;
  the interface explains this but does not pretend to send an invitation.
- Participation filters cover the full class history, not attendance for a
  chosen lesson. A date/session filter would need an explicit reporting contract.
- Production authentication, assistive-technology announcements and actual
  classroom/offline behavior still require dedicated acceptance testing.

## Follow-up: recover one card without replacing the whole roster

Example intent: "Player 02 needs another copy of their card."

1. Open **Turmas**, then the class. Enter **02** in **Número do jogador**.
2. The roster shows only Player 02, not 12 or 20. Select **Exibir QR deste
   jogador** to retrieve that player's existing card for printing.
3. Retrieval does not rotate a credential. **Trocar QR** remains separate and
   explains invalidation, preserved progress, and the reprint alternative.
4. Open the player's results and use browser Back: the number filter remains.
   Reload also preserves it. **Limpar busca** returns to all players/cards.
5. An unmatched number has a recovery message and clear-search action. A class
   with no active player credential explains why starting a session is disabled.

## Follow-up: manage the team of a specific organization

Example intent: "Check only the professionals at EMEF Victor Aggens."

1. Open **Organizações**, then **EMEF Victor Aggens** and **Gerenciar equipe**.
2. The organization filter is selected by ID, not an ambiguous name search.
   Combine it with a professional search and membership status filter.
3. Reload or return with browser Back without losing the filters. Clear them
   together using **Limpar filtros**.
4. Expand **Adicionar à equipe**: the active organization is preselected in the
   form. Creating a membership still requires the existing authorization checks.
5. For an organization lacking an administrator, **Vincular administrador**
   opens the membership form with that organization selected.
6. Platform administrators see class summaries without links into class routes
   their role cannot access. Organization administrators retain scoped class
   management links. **Todas as organizações** provides an explicit return.

### UI and verification for this pass

- Retained the established Portuguese copy, cream/green palette, rounded type,
  and existing work. No backend authorization or credential contract changes.
- Compacted the class identity/status header and mobile player rows; kept
  player number, status, results and QR action together. Organization summary
  columns now match the actual three metrics, and filter selects shrink safely.
- Live local-demo checks: desktop 1365 x 900, mobile 390 x 844 and 320 x 740;
  exact player lookup, single-card retrieval, enabled print control, Back
  restoration, Escape cancellation, scoped organization-to-team navigation,
  reload persistence and organization preselection. No print job or membership
  mutation was submitted. Roster and team pages had no detected horizontal
  overflow at 320px.
- All 227 unit tests passed, including six query/number-filter regression tests.
  TypeScript and targeted ESLint passed. Physical printing, production auth,
  and screen-reader announcements remain unverified in this pass.
