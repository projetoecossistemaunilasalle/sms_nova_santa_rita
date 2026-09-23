import { describe, expect, it } from "vitest";

import {
  parseGameBridgeMessage,
  expectedGameOrigin,
  isTrustedGameMessage,
} from "@/components/public/game-bridge";
import {
  advanceDemoGameState,
  initialDemoGameState,
  readDemoGameSnapshot,
  saveDemoGameState,
} from "@/components/public/demo-game-state";

describe("GameMaker host bridge", () => {
  it("accepts only contract-valid inbound messages", () => {
    expect(
      parseGameBridgeMessage({
        type: "game.ready.v1",
        supported_protocol_versions: [1],
        supported_state_schema_versions: [1],
      }),
    ).toEqual({
      type: "game.ready.v1",
      supported_protocol_versions: [1],
      supported_state_schema_versions: [1],
    });
    expect(
      parseGameBridgeMessage({
        type: "game.ready.v1",
        supported_protocol_versions: [1],
        supported_state_schema_versions: [1],
        player_id: "must-not-be-present",
      }),
    ).toBeNull();
  });

  it("requires the configured origin and the exact iframe window", () => {
    const frameWindow = {} as MessageEventSource;
    const event = { origin: "https://game.example.org", source: frameWindow };

    expect(
      expectedGameOrigin("https://game.example.org/build/index.html"),
    ).toBe("https://game.example.org");
    expect(expectedGameOrigin("javascript:alert(1)")).toBeNull();
    expect(
      expectedGameOrigin("https://user:secret@game.example.org"),
    ).toBeNull();
    expect(
      isTrustedGameMessage(event, frameWindow, "https://game.example.org"),
    ).toBe(true);
    expect(
      isTrustedGameMessage(
        { ...event, origin: "https://evil.example" },
        frameWindow,
        "https://game.example.org",
      ),
    ).toBe(false);
    expect(
      isTrustedGameMessage(
        { ...event, source: {} as MessageEventSource },
        frameWindow,
        "https://game.example.org",
      ),
    ).toBe(false);
  });
});

describe("deterministic demo game adapter state", () => {
  it("produces a valid state and advances only its synthetic counter", () => {
    const initial = initialDemoGameState();
    const next = advanceDemoGameState(initial);

    expect(initial.missions.when_play_stops_being_play.data.demo_steps).toBe(0);
    expect(next.missions.when_play_stops_being_play.data.demo_steps).toBe(1);
    expect(next.progression).toEqual(initial.progression);
    expect(
      advanceDemoGameState(next).missions.when_play_stops_being_play.data
        .demo_steps,
    ).toBe(2);
  });

  it("saves by expected revision and does not overwrite a newer snapshot", () => {
    const firstRequest = {
      type: "game.save.v1" as const,
      request_id: "save-a",
      expected_revision: 0,
      state: advanceDemoGameState(initialDemoGameState()),
    };
    const first = saveDemoGameState(null, firstRequest);
    expect(first.status).toBe("saved");
    if (first.status !== "saved") return;

    const stale = saveDemoGameState(first.snapshot, firstRequest);
    expect(stale).toEqual({ status: "conflict", snapshot: first.snapshot });
    expect(readDemoGameSnapshot(JSON.stringify(first.snapshot))).toEqual({
      status: "valid",
      snapshot: first.snapshot,
    });
    expect(readDemoGameSnapshot("not-json")).toEqual({ status: "invalid" });
  });
});
