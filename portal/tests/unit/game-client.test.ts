import { describe, expect, it } from "vitest";

import {
  createGameLaunchUrl,
  resolveGameClientUrl,
} from "@/server/config/game-client";

describe("resolveGameClientUrl", () => {
  it("distinguishes missing, invalid, and configured values", () => {
    expect(resolveGameClientUrl("   ")).toEqual({ status: "missing" });
    expect(resolveGameClientUrl("javascript:alert(1)")).toEqual({
      status: "invalid",
    });
    expect(resolveGameClientUrl("https://game.example.org/build/")).toEqual({
      status: "configured",
      url: "https://game.example.org/build/",
    });
  });

  it("rejects URLs containing credentials", () => {
    expect(
      resolveGameClientUrl("https://user:secret@game.example.org"),
    ).toEqual({ status: "invalid" });
  });
});

describe("createGameLaunchUrl", () => {
  it("preserves configuration parameters and safely appends the activity token", () => {
    const result = new URL(
      createGameLaunchUrl(
        "https://game.example.org/build/?locale=pt-BR",
        "turma 7/A?",
      ),
    );

    expect(result.searchParams.get("locale")).toBe("pt-BR");
    expect(result.searchParams.get("activity_token")).toBe("turma 7/A?");
  });
});
