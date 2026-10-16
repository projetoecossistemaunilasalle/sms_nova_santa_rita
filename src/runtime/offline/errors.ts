export class OfflineStateBlockedError extends Error {
  constructor() {
    super(
      "State synchronization is blocked until GameMaker resolves the server conflict",
    );
    this.name = "OfflineStateBlockedError";
  }
}

export class OfflineBootstrapMissingError extends Error {
  constructor() {
    super(
      "An online player bootstrap is required before using the offline queue",
    );
    this.name = "OfflineBootstrapMissingError";
  }
}

export class OfflineRequestReuseError extends Error {
  constructor() {
    super("A bridge request_id was reused with a different payload");
    this.name = "OfflineRequestReuseError";
  }
}

export class OfflineSessionMismatchError extends Error {
  constructor() {
    super("Cached player session does not match the active launch session");
    this.name = "OfflineSessionMismatchError";
  }
}

export class OfflineBranchChangedError extends Error {
  constructor() {
    super(
      "Another game instance owns this player's state; reload before saving",
    );
    this.name = "OfflineBranchChangedError";
  }
}
