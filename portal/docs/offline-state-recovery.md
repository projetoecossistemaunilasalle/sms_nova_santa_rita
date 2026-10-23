# Offline State Ownership and Recovery

Each loaded game instance owns the IndexedDB bootstrap generation it installed.
The host may allocate sequential revisions only for that generation and its own
queued branch. Reserving a newer bootstrap fences older instances, including
other tabs in the same session. A reopened store can flush existing records but
cannot produce new state saves until it loads a fresh bootstrap.

Before installing a bootstrap, the host attempts to flush the old state queue.
Pending state prevents gameplay from starting on an unrelated snapshot. Network
failures remain retryable. Permanent transport rejection is persisted separately
from an optimistic-concurrency conflict; both block new state saves. Independent
result and active-time uploads can still proceed under their original sessions.
Records with an unknown launch session are never assigned to the current session.

For a rejected branch, the host offers **Preservar copia local e carregar do
servidor**. This explicit action archives all dependent saves with their original
session IDs and rejection metadata in the append-only `stateBranchArchives`
IndexedDB store, then clears the active branch and reloads server progress.
The archive, clear, and generation invalidation are one transaction. Recovery
checks the rejected/conflicting request ID so a delayed action cannot discard a
replacement branch. Recovery and synchronization share the same Web Lock where
the browser supports it. Automatic conflict acknowledgement uses the same
archive mechanism before bootstrapping a new branch.

Archives are local diagnostic/recovery records, not automatic retries or server
backups. They are not merged, reassigned to another session, or sent without a
separate recovery decision. Browser storage deletion removes these copies.

Regression coverage uses the production IndexedDB adapter with `fake-indexeddb`
in `tests/unit/game-offline-branches.test.ts`, alongside the existing sync tests.
