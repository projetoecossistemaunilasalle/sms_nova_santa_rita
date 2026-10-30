import { afterEach, describe, expect, it, vi } from "vitest";

import { readPlayerEntryWithResume } from "@/components/public/player-entry-credential";
import {
  currentNavigationType,
  forgetPlayerEntry,
  PLAYER_ENTRY_MAX_AGE_MS,
  PLAYER_ENTRY_STORAGE_KEY,
  playerEntrySessionStorage,
  readResumablePlayerEntry,
  rememberPlayerEntry,
} from "@/components/public/player-entry-resume";

const nowMs = 1_800_000_000_000;
const reload = { navigationType: "reload", wasDiscarded: false, nowMs };

function storageWith(value: string | null = null) {
  const records = new Map<string, string>();
  if (value !== null) records.set(PLAYER_ENTRY_STORAGE_KEY, value);
  return {
    getItem: vi.fn((key: string) => records.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      records.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      records.delete(key);
    }),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("per-tab player entry resume", () => {
  it("remembers a versioned entry and resumes on reload, refreshing its age", () => {
    const storage = storageWith();
    rememberPlayerEntry(storage, "player-token", nowMs - 100);
    expect(JSON.parse(storage.getItem(PLAYER_ENTRY_STORAGE_KEY)!)).toEqual({
      v: 1,
      token: "player-token",
      savedAt: nowMs - 100,
    });
    expect(readResumablePlayerEntry(storage, reload)).toBe("player-token");
    rememberPlayerEntry(storage, "player-token", nowMs);
    expect(JSON.parse(storage.getItem(PLAYER_ENTRY_STORAGE_KEY)!).savedAt).toBe(
      nowMs,
    );
  });

  it.each(["navigate", "prerender", "unknown"])(
    "clears a stored entry on %s navigation",
    (navigationType) => {
      const storage = storageWith();
      rememberPlayerEntry(storage, "old-child", nowMs);
      expect(
        readResumablePlayerEntry(storage, { ...reload, navigationType }),
      ).toBeNull();
      expect(storage.getItem(PLAYER_ENTRY_STORAGE_KEY)).toBeNull();
    },
  );

  it.each([
    { navigationType: "back_forward", wasDiscarded: false },
    { navigationType: "navigate", wasDiscarded: true },
  ])("allows restoration with %j", (navigation) => {
    const storage = storageWith();
    rememberPlayerEntry(storage, "player-token", nowMs);
    expect(
      readResumablePlayerEntry(storage, { ...reload, ...navigation }),
    ).toBe("player-token");
  });

  it("accepts the exact max age, but rejects stale and future records", () => {
    const storage = storageWith();
    rememberPlayerEntry(storage, "token", nowMs - PLAYER_ENTRY_MAX_AGE_MS);
    expect(readResumablePlayerEntry(storage, reload)).toBe("token");
    for (const savedAt of [nowMs - PLAYER_ENTRY_MAX_AGE_MS - 1, nowMs + 1]) {
      rememberPlayerEntry(storage, "token", savedAt);
      expect(readResumablePlayerEntry(storage, reload)).toBeNull();
      expect(storage.getItem(PLAYER_ENTRY_STORAGE_KEY)).toBeNull();
    }
  });

  it.each([
    "not json",
    "null",
    "[]",
    "{}",
    JSON.stringify({ v: 2, token: "token", savedAt: nowMs }),
    JSON.stringify({ v: 1, token: 12, savedAt: nowMs }),
    JSON.stringify({ v: 1, token: "", savedAt: nowMs }),
    JSON.stringify({ v: 1, token: " token ", savedAt: nowMs }),
    JSON.stringify({ v: 1, token: "token", savedAt: String(nowMs) }),
    JSON.stringify({ v: 1, token: "token", savedAt: null }),
  ])("clears malformed record %s", (value) => {
    const storage = storageWith(value);
    expect(readResumablePlayerEntry(storage, reload)).toBeNull();
    expect(storage.getItem(PLAYER_ENTRY_STORAGE_KEY)).toBeNull();
  });

  it("tolerates null storage and throwing get/set/remove methods", () => {
    const fail = () => {
      throw new Error("Storage disabled");
    };
    for (const storage of [
      null,
      { getItem: fail, setItem: fail, removeItem: fail },
    ]) {
      expect(() => rememberPlayerEntry(storage, "token", nowMs)).not.toThrow();
      expect(() => forgetPlayerEntry(storage)).not.toThrow();
      expect(readResumablePlayerEntry(storage, reload)).toBeNull();
    }
    const storage = storageWith();
    Object.defineProperty(storage, "getItem", { get: fail });
    expect(readResumablePlayerEntry(storage, reload)).toBeNull();
    vi.stubGlobal(
      "window",
      Object.defineProperty({}, "sessionStorage", { get: fail }),
    );
    expect(playerEntrySessionStorage()).toBeNull();
  });

  it("forgets only the player entry", () => {
    const storage = storageWith();
    storage.setItem("other", "keep");
    rememberPlayerEntry(storage, "token", nowMs);
    forgetPlayerEntry(storage);
    expect(storage.getItem(PLAYER_ENTRY_STORAGE_KEY)).toBeNull();
    expect(storage.getItem("other")).toBe("keep");
  });
});

describe("URL credential versus stored entry", () => {
  it("a new URL credential overrides stored entry and is stripped from history", () => {
    const storage = storageWith();
    rememberPlayerEntry(storage, "previous-child", nowMs);
    const result = readPlayerEntryWithResume(
      "https://example.test/jogar?cred=new-child&keep=1#game",
      null,
      storage,
      reload,
    );
    expect(result.token).toBe("new-child");
    expect(result.historyUrl).toBe("/jogar?keep=1#game");
    expect(storage.getItem(PLAYER_ENTRY_STORAGE_KEY)).toBeNull();
    expect(
      readPlayerEntryWithResume(
        `https://example.test${result.historyUrl}`,
        result.token,
        storage,
        reload,
      ).shouldResolve,
    ).toBe(false);
  });

  it.each(["?cred=", "?cred=first&cred=second"])(
    "forgets stored entry for an unusable URL credential %s",
    (query) => {
      const storage = storageWith();
      rememberPlayerEntry(storage, "previous-child", nowMs);
      const result = readPlayerEntryWithResume(
        `https://example.test/jogar${query}`,
        null,
        storage,
        reload,
      );
      expect(result.token).toBeNull();
      expect(result.credentialMissing).toBe(false);
      expect(storage.getItem(PLAYER_ENTRY_STORAGE_KEY)).toBeNull();
    },
  );

  it("resumes only a credential-free restoration, otherwise selects scan", () => {
    const storage = storageWith();
    rememberPlayerEntry(storage, "token", nowMs);
    expect(
      readPlayerEntryWithResume(
        "https://example.test/jogar",
        null,
        storage,
        reload,
      ).token,
    ).toBe("token");
    expect(
      readPlayerEntryWithResume("https://example.test/jogar", null, storage, {
        ...reload,
        navigationType: "navigate",
      }),
    ).toMatchObject({ token: null, credentialMissing: true });
  });
});

describe("navigation type detection", () => {
  it("uses navigation timing before legacy navigation", () => {
    vi.stubGlobal("performance", {
      getEntriesByType: () => [{ type: "back_forward" }],
      navigation: { type: 1 },
    });
    expect(currentNavigationType()).toBe("back_forward");
  });

  it.each([
    [1, "reload"],
    [2, "back_forward"],
    [0, "navigate"],
  ])("falls back from legacy type %s to %s", (type, expected) => {
    vi.stubGlobal("performance", { navigation: { type } });
    expect(currentNavigationType()).toBe(expected);
  });

  it("defaults safely when performance is missing or throws", () => {
    vi.stubGlobal("performance", undefined);
    expect(currentNavigationType()).toBe("navigate");
    vi.stubGlobal("performance", {
      getEntriesByType() {
        throw new Error("Unavailable");
      },
    });
    expect(currentNavigationType()).toBe("navigate");
  });
});
