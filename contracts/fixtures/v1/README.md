# V1 fixture payloads

`valid/` contains deterministic transport payloads for every V1 schema, including
returning/new-player bootstrap, save acceptance/conflict, all three current activities,
pre-enqueue submissions, host-enriched durable events, active-time delivery, and bridge
lifecycle messages. GameMaker reuses `request_id` until the host acknowledges durable
enqueue; the host creates and returns the corresponding `client_event_id`.

`invalid/` contains one intentional violation per payload. `oversized-state.json` uses
33,000 copies of the two-byte UTF-8 character `é`; its compact serialized state is
66,692 bytes and proves that the limit is measured in bytes rather than JavaScript
string length. Fixture IDs are inert test labels, not credentials or child identity.
