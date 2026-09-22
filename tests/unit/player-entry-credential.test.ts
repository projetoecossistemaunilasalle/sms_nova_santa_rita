import { describe, expect, it } from "vitest";

import { readPlayerEntryCredential } from "@/components/public/player-entry-credential";

describe("player entry credential URL handling", () => {
  it("keeps the cached credential on a Strict Mode effect replay", () => {
    const firstRead = readPlayerEntryCredential(
      "https://example.test/jogar/?cred=one-time-token&campaign=classroom#entry",
      null,
    );
    const replayRead = readPlayerEntryCredential(
      `https://example.test${firstRead.historyUrl}`,
      firstRead.token,
    );

    expect(firstRead).toEqual({
      token: "one-time-token",
      historyUrl: "/jogar/?campaign=classroom#entry",
      shouldResolve: true,
    });
    expect(replayRead).toEqual({
      token: "one-time-token",
      historyUrl: "",
      shouldResolve: false,
    });
  });

  it("removes all credentials and rejects ambiguous query parameters", () => {
    expect(
      readPlayerEntryCredential(
        "https://example.test/jogar/?cred=first&cred=second&keep=1",
        null,
      ),
    ).toEqual({
      token: null,
      historyUrl: "/jogar/?keep=1",
      shouldResolve: true,
    });
  });
});
