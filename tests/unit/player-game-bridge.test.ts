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
  contentErrorRecovery,
  DEMO_CONTENT_VERSION,
  errorMessageForEntry,
  newBootstrap,
  readResponseJson,
} from "@/components/public/game-host-model";

describe("V2 game host bridge", () => {
  it("rejects the old V1 protocol and accepts complete V2 bootstrap receipts", () => {
    expect(
      parseGameBridgeMessage({
        type: "game.ready.v1",
        supported_protocol_versions: [1],
        supported_state_schema_versions: [1],
      }),
    ).toBeNull();
    expect(
      parseGameBridgeMessage({
        type: "game.bootstrap_applied.v2",
        request_id: "bootstrap-1",
        effective_mission_ids: ["brushing_teeth"],
        ignored: { mission_ids: [], presets: {}, options: [] },
      }),
    ).not.toBeNull();
  });
  it("accepts only contract-valid inbound messages", () => {
    expect(
      parseGameBridgeMessage({
        type: "game.ready.v2",
        supported_protocol_versions: [2],
        supported_state_schema_versions: [3],
        content_version: "current-content",
      }),
    ).toEqual({
      type: "game.ready.v2",
      supported_protocol_versions: [2],
      supported_state_schema_versions: [3],
      content_version: "current-content",
    });
    expect(
      parseGameBridgeMessage({
        type: "game.ready.v2",
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

    expect(initial.demo_steps).toBe(0);
    expect(next.demo_steps).toBe(1);
    expect(next.schema_version).toBe(3);
    expect(advanceDemoGameState(next).demo_steps).toBe(2);
  });

  it("saves by expected revision and does not overwrite a newer snapshot", () => {
    const firstRequest = {
      type: "game.save.v2" as const,
      request_id: "save-a",
      expected_revision: 0,
      content_version: DEMO_CONTENT_VERSION,
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
  it("reloads content once and then directs the player to the professor", () => {
    expect(contentErrorRecovery("CONTENT_UPGRADE_REQUIRED", false)).toEqual({
      reload: true,
      message: "Atualizando o jogo. Aguarde um momento.",
    });
    expect(contentErrorRecovery("CONTENT_UPGRADE_REQUIRED", true)).toEqual({
      reload: false,
      message:
        "Não foi possível atualizar o jogo. Chame o professor para continuar.",
    });
    expect(contentErrorRecovery("POLICY_EMPTY", false)).toEqual({
      reload: false,
      message:
        "O conteúdo escolhido não está disponível nesta versão do jogo. Avise o professor.",
    });
    expect(contentErrorRecovery("INTERNAL_ERROR", false)).toBeNull();
  });
  it("derives a bootstrap from the saved snapshot or as a new player", () => {
    const fresh = newBootstrap("player-1", "session-1", { status: "empty" });
    expect(fresh).toMatchObject({
      type: "portal.bootstrap.v2",
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
      DEMO_CONTENT_VERSION,
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
