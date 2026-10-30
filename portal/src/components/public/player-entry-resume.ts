export const PLAYER_ENTRY_STORAGE_KEY = "missoes-caramelito:player-entry:v1";
export const PLAYER_ENTRY_MAX_AGE_MS = 12 * 60 * 60 * 1_000;

export type PlayerEntryStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
> | null;

export type PlayerEntryNavigation = {
  navigationType: string;
  wasDiscarded: boolean;
  nowMs: number;
};

export function playerEntrySessionStorage(): PlayerEntryStorage {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function forgetPlayerEntry(storage: PlayerEntryStorage): void {
  try {
    storage?.removeItem(PLAYER_ENTRY_STORAGE_KEY);
  } catch {
    // Storage can be disabled by browser policy.
  }
}

export function rememberPlayerEntry(
  storage: PlayerEntryStorage,
  token: string,
  nowMs: number,
): void {
  try {
    storage?.setItem(
      PLAYER_ENTRY_STORAGE_KEY,
      JSON.stringify({ v: 1, token, savedAt: nowMs }),
    );
  } catch {
    // Entry remains usable even when tab storage is unavailable.
  }
}

export function readResumablePlayerEntry(
  storage: PlayerEntryStorage,
  { navigationType, wasDiscarded, nowMs }: PlayerEntryNavigation,
): string | null {
  try {
    if (
      wasDiscarded ||
      navigationType === "reload" ||
      navigationType === "back_forward"
    ) {
      const record: unknown = JSON.parse(
        storage?.getItem(PLAYER_ENTRY_STORAGE_KEY) ?? "null",
      );
      if (
        record &&
        typeof record === "object" &&
        "v" in record &&
        record.v === 1 &&
        "token" in record &&
        typeof record.token === "string" &&
        record.token.length > 0 &&
        record.token.trim() === record.token &&
        "savedAt" in record &&
        typeof record.savedAt === "number" &&
        Number.isFinite(record.savedAt) &&
        Number.isFinite(nowMs) &&
        record.savedAt <= nowMs &&
        nowMs - record.savedAt <= PLAYER_ENTRY_MAX_AGE_MS
      )
        return record.token;
    }
  } catch {
    // Treat unreadable records like invalid records, never as authorization.
  }
  forgetPlayerEntry(storage);
  return null;
}

export function currentNavigationType(): string {
  try {
    const entry = performance.getEntriesByType?.("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    if (entry?.type) return entry.type;
  } catch {
    // Older browsers may only expose performance.navigation.
  }
  try {
    const type = performance.navigation?.type;
    if (type === 1) return "reload";
    if (type === 2) return "back_forward";
  } catch {
    // A missing performance API is a fresh navigation, not a resume.
  }
  return "navigate";
}
