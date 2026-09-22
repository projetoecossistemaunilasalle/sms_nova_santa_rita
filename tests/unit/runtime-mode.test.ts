import { describe, expect, it } from "vitest";

import { getRuntimeMode } from "@/runtime/mode";

describe("runtime mode", () => {
  it.each(["demo", "server"] as const)("accepts %s", (mode) => {
    expect(getRuntimeMode({ APP_RUNTIME_MODE: mode })).toBe(mode);
  });

  it("does not infer a target from NODE_ENV", () => {
    expect(() => getRuntimeMode({ NODE_ENV: "production" })).toThrow();
  });
});
