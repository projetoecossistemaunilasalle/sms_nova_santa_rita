import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { readGameEventRequest } from "@/server/http/game-event-route";
import { readGameRequest } from "@/server/http/game-state-route";

function streamedRequest(chunks: Uint8Array[], headers?: HeadersInit) {
  let nextChunk = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[nextChunk++];
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });

  return {
    request: { body, headers: new Headers(headers) } as Request,
    wasCancelled: () => cancelled,
  };
}

const readers: readonly [string, (request: Request) => Promise<unknown>][] = [
  ["state", (request) => readGameRequest(request, "save")],
  ["events", (request) => readGameEventRequest(request, "result")],
];

describe("game API request body limits", () => {
  for (const [kind, read] of readers) {
    it(`rejects an oversized declared ${kind} body before parsing`, async () => {
      const { request, wasCancelled } = streamedRequest(
        [new Uint8Array([123])],
        { "content-length": "300001" },
      );

      await expect(read(request)).rejects.toMatchObject({ status: 413 });
      expect(wasCancelled()).toBe(true);
    });

    it(`cancels an oversized streamed ${kind} body before buffering it all`, async () => {
      const { request, wasCancelled } = streamedRequest([
        new Uint8Array(300_000),
        new Uint8Array(1),
      ]);

      await expect(read(request)).rejects.toMatchObject({ status: 413 });
      expect(wasCancelled()).toBe(true);
    });
  }
});
