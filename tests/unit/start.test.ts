import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(() => ({ status: 0 })),
}));
vi.mock("@next/env", () => ({
  default: { loadEnvConfig: vi.fn() },
}));
vi.mock("../../scripts/standalone-release.mjs", () => ({
  standaloneServer: vi.fn(() => "server.js"),
}));

const originalArgv = process.argv;
const startScript = "../../scripts/start.mjs";

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.argv = [process.execPath, "scripts/start.mjs"];
  for (const name of [
    "RENDER_EXTERNAL_URL",
    "RENDER_EXTERNAL_HOSTNAME",
    "ALLOWED_ORIGINS",
    "GAME_CLIENT_URL",
  ]) {
    vi.stubEnv(name, "");
  }
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Error(`exit:${code}`);
  });
});

afterEach(() => {
  process.argv = originalArgv;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function start() {
  await expect(import(startScript)).rejects.toThrow("exit:0");
  expect(console.error).not.toHaveBeenCalled();
  expect(spawnSync).toHaveBeenCalledOnce();
  return vi.mocked(spawnSync).mock.calls[0]![2]!.env!;
}

describe("Render startup defaults", () => {
  it("does not parse malformed Render values when both explicit settings exist", async () => {
    vi.stubEnv("RENDER_EXTERNAL_URL", "not a URL");
    vi.stubEnv("RENDER_EXTERNAL_HOSTNAME", "not a hostname");
    vi.stubEnv("ALLOWED_ORIGINS", "https://custom.example");
    vi.stubEnv("GAME_CLIENT_URL", "https://game.example/index.html");
    const env = await start();
    expect(env.ALLOWED_ORIGINS).toBe("https://custom.example");
    expect(env.GAME_CLIENT_URL).toBe("https://game.example/index.html");
  });

  it("defaults empty settings from the external URL origin", async () => {
    vi.stubEnv("RENDER_EXTERNAL_URL", "https://portal.onrender.com/path");
    vi.stubEnv("RENDER_EXTERNAL_HOSTNAME", "fallback.onrender.com");
    const env = await start();
    expect(env.ALLOWED_ORIGINS).toBe("https://portal.onrender.com");
    expect(env.GAME_CLIENT_URL).toBe(
      "https://portal.onrender.com/jogo-cliente/index.html",
    );
  });

  it.each(["ALLOWED_ORIGINS", "GAME_CLIENT_URL"])(
    "preserves explicit %s while defaulting the missing setting",
    async (name) => {
      vi.stubEnv("RENDER_EXTERNAL_URL", "https://portal.onrender.com");
      vi.stubEnv(name, "https://custom.example");
      const env = await start();
      expect(env[name]).toBe("https://custom.example");
      expect(env.ALLOWED_ORIGINS).toBe(
        name === "ALLOWED_ORIGINS"
          ? "https://custom.example"
          : "https://portal.onrender.com",
      );
      expect(env.GAME_CLIENT_URL).toBe(
        name === "GAME_CLIENT_URL"
          ? "https://custom.example"
          : "https://portal.onrender.com/jogo-cliente/index.html",
      );
    },
  );

  it.each(["", "not a URL", "file:///tmp/server", "https://"])(
    "uses the hostname when the external URL is %j",
    async (value) => {
      vi.stubEnv("RENDER_EXTERNAL_URL", value);
      vi.stubEnv("RENDER_EXTERNAL_HOSTNAME", "fallback.onrender.com");
      const env = await start();
      expect(env.ALLOWED_ORIGINS).toBe("https://fallback.onrender.com");
      expect(env.GAME_CLIENT_URL).toBe(
        "https://fallback.onrender.com/jogo-cliente/index.html",
      );
    },
  );

  it.each([
    ["not a URL", ""],
    ["not a URL", "not a hostname"],
    ["", "not a hostname"],
    ["", "https://portal.onrender.com"],
    ["", "portal.onrender.com/path"],
  ])(
    "reports invalid Render configuration (%j, %j) without a stack",
    async (url, hostname) => {
      vi.stubEnv("RENDER_EXTERNAL_URL", url);
      vi.stubEnv("RENDER_EXTERNAL_HOSTNAME", hostname);
      await expect(import(startScript)).rejects.toThrow("exit:1");
      expect(console.error).toHaveBeenCalledExactlyOnceWith(
        "Invalid Render configuration: set RENDER_EXTERNAL_URL to a valid HTTP(S) URL or RENDER_EXTERNAL_HOSTNAME to a valid hostname.",
      );
      expect(spawnSync).not.toHaveBeenCalled();
    },
  );

  it("does not add defaults without Render metadata", async () => {
    vi.stubEnv("RENDER_EXTERNAL_URL", undefined);
    vi.stubEnv("RENDER_EXTERNAL_HOSTNAME", undefined);
    const env = await start();
    expect(env.ALLOWED_ORIGINS).toBe("");
    expect(env.GAME_CLIENT_URL).toBe("");
  });

  it("ignores malformed Render metadata in demo mode", async () => {
    process.argv.push("--demo");
    vi.stubEnv("RENDER_EXTERNAL_URL", "not a URL");
    vi.stubEnv("RENDER_EXTERNAL_HOSTNAME", "not a hostname");
    const env = await start();
    expect(env.APP_RUNTIME_MODE).toBe("demo");
    expect(env.ALLOWED_ORIGINS).toBe("");
    expect(env.GAME_CLIENT_URL).toBe("");
  });
});
