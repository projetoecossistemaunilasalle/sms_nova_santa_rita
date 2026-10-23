import { describe, expect, it } from "vitest";

import {
  initialGameHostDocument,
  transitionGameHostDocument as transition,
} from "@/components/public/game-host-document";
import { newBootstrap } from "@/components/public/game-host-model";
import {
  isTrustedGameMessage,
  parseGameBridgeMessage,
} from "@/components/public/game-bridge";

function readyDocument() {
  return transition(initialGameHostDocument(), { type: "ready" });
}

function bootstrapDocument() {
  const started = transition(readyDocument(), { type: "bootstrap-started" });
  return transition(started, {
    type: "bootstrap-installed",
    bootstrap: newBootstrap("player-1", "session-1", { status: "empty" }),
    generation: started.generation,
  });
}

describe("game host document lifecycle", () => {
  it("preserves an in-flight bootstrap when ready arrives before load", () => {
    const started = transition(readyDocument(), { type: "bootstrap-started" });
    const loaded = transition(started, { type: "load" });
    expect(loaded).toBe(started);
    expect(loaded.bootstrapStarted).toBe(true);
    expect(loaded.phase).toBe("bootstrapping");

    const installed = transition(loaded, {
      type: "bootstrap-installed",
      bootstrap: newBootstrap("player-1", "session-1", { status: "empty" }),
      generation: started.generation,
    });
    const playing = transition(installed, {
      type: "bootstrap-applied",
      requestId: installed.bootstrap!.request_id,
    });
    expect(playing.branchReady).toBe(true);
    expect(playing.phase).toBe("playing");
  });

  it("keeps an installed bootstrap and accepts its receipt after load", () => {
    const installed = bootstrapDocument();
    const loaded = transition(installed, { type: "load" });
    expect(loaded).toBe(installed);
    expect(loaded.bootstrap).not.toBeNull();
    const receipt = parseGameBridgeMessage({
      type: "game.bootstrap_applied.v2",
      request_id: installed.bootstrap!.request_id,
      effective_mission_ids: ["demo_steps"],
      ignored: { mission_ids: [], presets: {}, options: [] },
    });
    expect(receipt?.type).toBe("game.bootstrap_applied.v2");
    if (receipt?.type !== "game.bootstrap_applied.v2") return;
    expect(
      transition(loaded, {
        type: "bootstrap-applied",
        requestId: receipt.request_id,
      }),
    ).toMatchObject({ branchReady: true, phase: "playing" });
  });

  it("preserves completed bootstrap, replies and non-waiting phases on load", () => {
    const installed = bootstrapDocument();
    const playing = transition(installed, {
      type: "bootstrap-applied",
      requestId: installed.bootstrap!.request_id,
    });
    playing.savedReplies.set("save-1", { type: "portal.save_ok.v2" });
    for (const phase of ["playing", "saving", "conflict", "error"] as const) {
      const state = { ...playing, phase };
      expect(transition(state, { type: "load" })).toBe(state);
    }
    expect(playing.savedReplies.has("save-1")).toBe(true);
  });

  it("waits on initial load and resets a reloaded document only on new ready", () => {
    expect(
      transition(initialGameHostDocument(), { type: "load" }),
    ).toMatchObject({ generation: 0, phase: "waiting" });
    const installed = bootstrapDocument();
    const playing = transition(installed, {
      type: "bootstrap-applied",
      requestId: installed.bootstrap!.request_id,
    });
    playing.savedReplies.set("save-1", {});
    const loaded = transition(playing, { type: "load" });
    expect(loaded).toBe(playing);

    const next = transition(loaded, { type: "ready" });
    expect(next).toMatchObject({
      generation: playing.generation + 1,
      bootstrapStarted: false,
      bootstrap: null,
      branchReady: false,
      phase: "waiting",
    });
    expect(next.savedReplies.size).toBe(0);
    expect(playing.savedReplies.size).toBe(1);
    const started = transition(next, { type: "bootstrap-started" });
    expect(transition(started, { type: "load" })).toBe(started);
  });

  it("rejects old bootstrap completions and receipts across navigation", () => {
    const previous = bootstrapDocument();
    const next = transition(previous, { type: "ready" });
    expect(
      transition(next, {
        type: "bootstrap-installed",
        bootstrap: previous.bootstrap!,
        generation: previous.generation,
      }),
    ).toBe(next);

    // A reload can retain the same WindowProxy: source/origin alone are not
    // document identity. The bootstrap request ID must match as well.
    const frameWindow = {} as MessageEventSource;
    expect(
      isTrustedGameMessage(
        { source: frameWindow, origin: "https://game.example.org" },
        frameWindow,
        "https://game.example.org",
      ),
    ).toBe(true);
    const oldReceipt = {
      type: "bootstrap-applied" as const,
      requestId: previous.bootstrap!.request_id,
    };
    expect(transition(next, oldReceipt)).toBe(next);
    const installed = transition(next, {
      type: "bootstrap-installed",
      bootstrap: {
        ...previous.bootstrap!,
        request_id: "new-document-bootstrap",
      },
      generation: next.generation,
    });
    expect(transition(installed, oldReceipt)).toBe(installed);
    expect(installed.branchReady).toBe(false);
  });

  it.each(["bootstrapping", "playing", "saving", "conflict", "error"] as const)(
    "invalidates a %s document immediately on explicit remount, before ready",
    (phase) => {
      const previous = { ...bootstrapDocument(), phase, branchReady: true };
      previous.savedReplies.set("save-1", { type: "portal.save_ok.v2" });
      const remounted = transition(previous, { type: "remount" });
      expect(remounted).toMatchObject({
        generation: previous.generation + 1,
        bootstrapStarted: false,
        bootstrap: null,
        branchReady: false,
        phase: "connecting",
      });
      expect(remounted.savedReplies.size).toBe(0);
      expect(previous.savedReplies.size).toBe(1);

      for (const state of [
        remounted,
        transition(remounted, { type: "load" }),
      ]) {
        expect(
          transition(state, {
            type: "bootstrap-installed",
            bootstrap: previous.bootstrap!,
            generation: previous.generation,
          }),
        ).toBe(state);
        expect(
          transition(state, {
            type: "bootstrap-applied",
            requestId: previous.bootstrap!.request_id,
          }),
        ).toBe(state);
      }
    },
  );

  it("waits for the recovery document's ready before starting a fresh bootstrap", () => {
    const previous = bootstrapDocument();
    const remounted = transition(previous, { type: "remount" });
    const remountedAgain = transition(remounted, { type: "remount" });
    expect(remountedAgain.generation).toBe(previous.generation + 2);
    expect(remountedAgain.phase).toBe("connecting");
    const ready = transition(remountedAgain, { type: "ready" });
    expect(ready.bootstrapStarted).toBe(false);
    const started = transition(ready, { type: "bootstrap-started" });
    const installed = transition(started, {
      type: "bootstrap-installed",
      bootstrap: newBootstrap("player-1", "session-1", { status: "empty" }),
      generation: started.generation,
    });
    expect(installed.bootstrap?.request_id).not.toBe(
      previous.bootstrap!.request_id,
    );
    expect(
      transition(installed, {
        type: "bootstrap-applied",
        requestId: installed.bootstrap!.request_id,
      }),
    ).toMatchObject({ branchReady: true, phase: "playing" });
  });
});
