import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  PlayerBootstrapV1,
  ResultSubmissionV1,
  StateSaveRequestV1,
} from "@/contracts/v1";
import { createGameOfflineTransport } from "@/components/public/game-offline-transport";
import { recoverOfflinePlayerQueue } from "@/components/public/recover-offline-queue";
import { openGameOfflineStore } from "@/runtime/offline/sync-engine";
import {
  fetchGameJson,
  GameSyncRetryScheduler,
  GameTransportError,
} from "@/runtime/offline/network";

const fixture = <T>(name: string): T =>
  JSON.parse(
    readFileSync(
      resolve(process.cwd(), "contracts", "fixtures", "v1", "valid", name),
      "utf8",
    ),
  );
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function mockServer(playerSlotId: string, refuse?: string) {
  const uploads: string[] = [];
  const fetcher = vi.fn(async (path: string, options: RequestInit) => {
    const body = JSON.parse(String(options.body));
    if (path.endsWith("refresh")) {
      if (body.gameSessionId === refuse)
        return Response.json({ error: {} }, { status: 403 });
      return Response.json({
        state: "ready",
        playerSlotId,
        gameSessionId: body.gameSessionId,
        participationId: `participation-${body.gameSessionId}`,
        purpose: "flush",
        launchToken: `token-${body.gameSessionId}`,
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      });
    }
    uploads.push((options.headers as Record<string, string>).Authorization!);
    return Response.json(
      path.endsWith("/state")
        ? {
            type: "portal.save_ok.v1",
            request_id: body.request_id,
            revision: body.expected_revision + 1,
          }
        : {
            type: "portal.result_ack.v1",
            client_event_id: body.client_event_id,
          },
    );
  });
  vi.stubGlobal("fetch", fetcher);
  return { fetcher, uploads };
}

describe("offline transport reliability", () => {
  it("aborts hung requests and also bounds a hanging response body", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    const hung = vi.fn(
      (_path: string | URL | Request, options?: RequestInit) => {
        signal = options?.signal;
        return new Promise<Response>(() => {});
      },
    );
    const request = fetchGameJson("/hung", {}, hung, 100);
    const rejected = expect(request).rejects.toBeInstanceOf(GameTransportError);
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
    expect(signal?.aborted).toBe(true);
    const bodyRequest = fetchGameJson(
      "/body",
      {},
      vi.fn(
        async () =>
          ({ json: () => new Promise(() => {}) }) as unknown as Response,
      ),
      100,
    );
    const bodyRejected =
      expect(bodyRequest).rejects.toBeInstanceOf(GameTransportError);
    await vi.advanceTimersByTimeAsync(100);
    await bodyRejected;
  });

  it("retries with bounded jittered backoff and cancels scheduled work on reset", async () => {
    vi.useFakeTimers();
    const retry = vi.fn();
    const scheduler = new GameSyncRetryScheduler(retry, () => 1);
    scheduler.schedule();
    scheduler.schedule();
    await vi.advanceTimersByTimeAsync(1999);
    expect(retry).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(retry).toHaveBeenCalledTimes(1);
    scheduler.schedule();
    await vi.advanceTimersByTimeAsync(3999);
    expect(retry).toHaveBeenCalledTimes(1);
    scheduler.reset();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("never sends an old-session payload with a refreshed new-session bearer", async () => {
    const fetcher = vi.fn<
      (path: string, options: RequestInit) => Promise<Response>
    >(async () =>
      Response.json({
        state: "ready",
        playerSlotId: "player",
        gameSessionId: "new",
        participationId: "participation-new",
        purpose: "play",
        launchToken: "new-token",
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const transport = createGameOfflineTransport(
      "a".repeat(43),
      "player",
    ).forSession("old");
    await expect(
      transport.uploadResult(fixture("result-lia-memory.json")),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(fetcher.mock.calls[0]![1]!.body as string).gameSessionId,
    ).toBe("old");
  });

  it("flushes results from multiple historical sessions using each original session token", async () => {
    const store = await openGameOfflineStore({ indexedDB: new IDBFactory() });
    const bootstrap = fixture<PlayerBootstrapV1>(
      "returning-player-bootstrap.json",
    );
    const result = fixture<ResultSubmissionV1>("result-submission.json");
    const { uploads } = mockServer(bootstrap.player_id);
    try {
      await store.cacheBootstrap(bootstrap);
      await store.enqueueResult(bootstrap.player_id, result);
      await store.cacheBootstrap({ ...bootstrap, class_session_id: "new" });
      await store.enqueueResult(bootstrap.player_id, {
        ...result,
        request_id: "new-result",
      });
      const report = await store.sync(
        bootstrap.player_id,
        createGameOfflineTransport(
          "a".repeat(43),
          bootstrap.player_id,
        ).forSession("new"),
        undefined,
        "new",
      );
      expect(report.uploadedResults).toBe(2);
      expect(uploads).toEqual([
        `Bearer token-${bootstrap.class_session_id}`,
        "Bearer token-new",
      ]);
      expect(report.state).toBe("synced");
    } finally {
      store.close();
    }
  });

  it("retains records past the flush deadline without blocking valid newer-session events", async () => {
    const store = await openGameOfflineStore({ indexedDB: new IDBFactory() });
    const bootstrap = fixture<PlayerBootstrapV1>(
      "returning-player-bootstrap.json",
    );
    const result = fixture<ResultSubmissionV1>("result-submission.json");
    mockServer(bootstrap.player_id, bootstrap.class_session_id);
    try {
      await store.cacheBootstrap(bootstrap);
      await store.enqueueResult(bootstrap.player_id, result);
      await store.cacheBootstrap({ ...bootstrap, class_session_id: "new" });
      await store.enqueueResult(bootstrap.player_id, {
        ...result,
        request_id: "new-result",
      });
      const report = await store.sync(
        bootstrap.player_id,
        createGameOfflineTransport(
          "a".repeat(43),
          bootstrap.player_id,
        ).forSession("new"),
      );
      expect(report.uploadedResults).toBe(1);
      expect(report.retryable).toBe(false);
      expect(
        (await store.getSyncStatus(bootstrap.player_id)).queuedResults,
      ).toBe(1);
    } finally {
      store.close();
    }
  });

  it("recovers state and events when the QR is reopened with no active session", async () => {
    const factory = new IDBFactory();
    vi.stubGlobal("indexedDB", factory);
    const store = await openGameOfflineStore({ indexedDB: factory });
    const bootstrap = fixture<PlayerBootstrapV1>(
      "returning-player-bootstrap.json",
    );
    const { uploads } = mockServer(bootstrap.player_id);
    await store.cacheBootstrap(bootstrap);
    await store.enqueueState(
      bootstrap.player_id,
      fixture<StateSaveRequestV1>("state-save-request.json"),
    );
    await store.enqueueResult(
      bootstrap.player_id,
      fixture<ResultSubmissionV1>("result-submission.json"),
    );
    store.close();
    const recovered = await recoverOfflinePlayerQueue(
      "a".repeat(43),
      bootstrap.player_id,
    );
    expect(recovered?.savedStates).toBe(1);
    expect(recovered?.uploadedResults).toBe(1);
    expect(uploads).toEqual([
      `Bearer token-${bootstrap.class_session_id}`,
      `Bearer token-${bootstrap.class_session_id}`,
    ]);
  });
});
