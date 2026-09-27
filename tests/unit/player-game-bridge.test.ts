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
import {
  applyProgressToBootstrap,
  errorMessageForEntry,
  newBootstrap,
  readResponseJson,
} from "@/components/public/game-host-model";

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

describe("player host model", () => {
  it("derives a bootstrap from the saved snapshot or as a new player", () => {
    const fresh = newBootstrap("player-1", "session-1", { status: "empty" });
    expect(fresh).toMatchObject({
      type: "portal.bootstrap.v1",
      revision: 0,
      new_player: true,
      state: null,
      player_id: "player-1",
      class_session_id: "session-1",
    });

    const state = advanceDemoGameState(initialDemoGameState());
    const returning = newBootstrap("player-1", "session-1", {
      status: "valid",
      snapshot: { revision: 3, state },
    });
    expect(returning).toMatchObject({
      revision: 3,
      new_player: false,
      state,
    });
  });

  it("applies authoritative progress onto the bootstrap as a returning player", () => {
    const base = newBootstrap("player-1", "session-1", { status: "empty" });
    const updated = applyProgressToBootstrap(
      base,
      7,
      advanceDemoGameState(initialDemoGameState()),
    );

    expect(updated).toMatchObject({ revision: 7, new_player: false });
    expect(updated.request_id).toBe(base.request_id);
    expect(updated.player_id).toBe("player-1");
  });

  it("maps entry failures to orientation copy and reads response JSON defensively", async () => {
    expect(errorMessageForEntry({ state: "ended" })).toContain("encerrada");
    expect(errorMessageForEntry({ state: "expired" })).toContain(
      "Escaneie o QR novamente",
    );
    expect(
      errorMessageForEntry({
        state: "waiting",
        classGroupId: "class-1",
        playerSlotId: "slot-1",
        playerNumber: 1,
      }),
    ).toContain("não está jogando");
    expect(errorMessageForEntry({ state: "revoked" })).toContain(
      "não está mais disponível",
    );

    await expect(
      readResponseJson(Response.json({ ok: true })),
    ).resolves.toEqual({ ok: true });
    await expect(
      readResponseJson(new Response("not-json")),
    ).resolves.toBeNull();
  });
});
