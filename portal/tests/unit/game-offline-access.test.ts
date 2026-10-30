import { afterEach, describe, expect, it, vi } from "vitest";

import type { PlayerEntryActionResult } from "@/application/player-access/types";
import { createGameOfflineTransport } from "@/components/public/game-offline-transport";

const entry: Extract<PlayerEntryActionResult, { state: "ready" }> = {
  state: "ready",
  classGroupId: "class",
  credentialId: "credential",
  playerSlotId: "player",
  playerNumber: 1,
  gameSessionId: "current-session",
  participationId: "participation",
  launchToken: "launch-token",
  expiresAt: new Date(Date.now() + 300_000).toISOString(),
};
const renewal = {
  ...entry,
  expiresAt: new Date(Date.now() + 300_000).toISOString(),
  purpose: "play",
};

afterEach(() => vi.unstubAllGlobals());

describe("game transport definitive access-ended notifications", () => {
  it.each([403, 410])("reports a definitive HTTP %s denial", async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({}, { status })),
    );
    const onAccessEnded = vi.fn();
    const transport = createGameOfflineTransport(
      "credential",
      "player",
      entry,
      onAccessEnded,
    );
    await expect(
      transport.post("/api/v2/player/bootstrap", {}, entry.gameSessionId),
    ).rejects.toThrow();
    expect(onAccessEnded).toHaveBeenCalledWith(entry.gameSessionId);
  });

  it("does not report the first 401 when renewing and retrying succeeds", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({}, { status: 401 }))
      .mockResolvedValueOnce(Response.json(renewal))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetcher);
    const onAccessEnded = vi.fn();
    const transport = createGameOfflineTransport(
      "credential",
      "player",
      entry,
      onAccessEnded,
    );
    await expect(
      transport.post("/api/v2/player/bootstrap", {}, entry.gameSessionId),
    ).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(onAccessEnded).not.toHaveBeenCalled();
  });

  it("reports a 401 that persists after successful renewal", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({}, { status: 401 }))
        .mockResolvedValueOnce(Response.json(renewal))
        .mockResolvedValueOnce(Response.json({}, { status: 401 })),
    );
    const onAccessEnded = vi.fn();
    const transport = createGameOfflineTransport(
      "credential",
      "player",
      entry,
      onAccessEnded,
    );
    await expect(
      transport.post("/api/v2/player/bootstrap", {}, entry.gameSessionId),
    ).rejects.toThrow();
    expect(onAccessEnded).toHaveBeenCalledWith(entry.gameSessionId);
  });

  it.each([401, 403, 410])(
    "reports a renewal HTTP %s denial",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(Response.json({}, { status: 401 }))
          .mockResolvedValueOnce(Response.json({}, { status })),
      );
      const onAccessEnded = vi.fn();
      const transport = createGameOfflineTransport(
        "credential",
        "player",
        entry,
        onAccessEnded,
      );
      await expect(
        transport.post("/api/v2/player/bootstrap", {}, entry.gameSessionId),
      ).rejects.toThrow();
      expect(onAccessEnded).toHaveBeenCalledWith(entry.gameSessionId);
    },
  );

  it.each([
    "ended",
    "revoked",
    "unauthorized",
    "invalid",
    "inactive",
    "expired",
  ])("reports a returned %s state from renewal", async (state) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ state })),
    );
    const onAccessEnded = vi.fn();
    const transport = createGameOfflineTransport(
      "credential",
      "player",
      undefined,
      onAccessEnded,
    );
    await expect(
      transport.post("/api/v2/player/bootstrap", {}, entry.gameSessionId),
    ).rejects.toThrow();
    expect(onAccessEnded).toHaveBeenCalledWith(entry.gameSessionId);
  });

  it("reports a flush-only renewal while still allowing the offline upload", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ ...renewal, purpose: "flush" }))
        .mockResolvedValueOnce(Response.json({ ok: true })),
    );
    const onAccessEnded = vi.fn();
    const transport = createGameOfflineTransport(
      "credential",
      "player",
      undefined,
      onAccessEnded,
    );
    await expect(
      transport.post("/api/v2/player/results", {}, entry.gameSessionId),
    ).resolves.toEqual({ ok: true });
    expect(onAccessEnded).toHaveBeenCalledWith(entry.gameSessionId);
  });

  it("distinguishes the ended-session 409 from ordinary save conflicts", async () => {
    const onAccessEnded = vi.fn();
    const transport = createGameOfflineTransport(
      "credential",
      "player",
      entry,
      onAccessEnded,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ type: "portal.save_conflict.v2" }, { status: 409 }),
      ),
    );
    await transport.post("/api/v2/player/state", {}, entry.gameSessionId);
    expect(onAccessEnded).not.toHaveBeenCalled();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: {
              code: "CONFLICT",
              message: "The expected state revision is not current.",
            },
          },
          { status: 409 },
        ),
      ),
    );
    await expect(
      transport.post("/api/v2/player/state", {}, entry.gameSessionId),
    ).rejects.toThrow();
    expect(onAccessEnded).not.toHaveBeenCalled();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: {
              code: "CONFLICT",
              message: "The class session has ended.",
            },
          },
          { status: 409 },
        ),
      ),
    );
    await expect(
      transport.post("/api/v2/player/bootstrap", {}, entry.gameSessionId),
    ).rejects.toThrow();
    expect(onAccessEnded).toHaveBeenCalledWith(entry.gameSessionId);
  });

  it.each([429, 500, 503, "network"])(
    "does not invalidate entry when renewal fails transiently: %s",
    async (failure) => {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(Response.json({}, { status: 401 }));
      if (failure === "network")
        fetcher.mockRejectedValueOnce(new Error("offline"));
      else
        fetcher.mockResolvedValueOnce(
          Response.json({ state: "unauthorized" }, { status: Number(failure) }),
        );
      vi.stubGlobal("fetch", fetcher);
      const onAccessEnded = vi.fn();
      const transport = createGameOfflineTransport(
        "credential",
        "player",
        entry,
        onAccessEnded,
      );
      await expect(
        transport.post("/api/v2/player/bootstrap", {}, entry.gameSessionId),
      ).rejects.toThrow();
      expect(onAccessEnded).not.toHaveBeenCalled();
    },
  );

  it("identifies historical denials separately from the running session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({}, { status: 403 })),
    );
    const onAccessEnded = vi.fn();
    const transport = createGameOfflineTransport(
      "credential",
      "player",
      entry,
      onAccessEnded,
    );
    await expect(
      transport.post("/api/v2/player/results", {}, "historical-session"),
    ).rejects.toThrow();
    expect(onAccessEnded).toHaveBeenCalledWith("historical-session");
    expect(onAccessEnded).not.toHaveBeenCalledWith(entry.gameSessionId);
  });
});
