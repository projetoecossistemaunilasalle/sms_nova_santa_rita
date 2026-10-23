import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { checkReadiness } from "@/server/health/readiness";
afterEach(() => {
  vi.useRealTimers();
});
describe("readiness checks", () => {
  it("reports successful probes and fails closed on database errors", async () => {
    expect(await checkReadiness(async () => 1, 100)).toBe(true);
    expect(
      await checkReadiness(async () => {
        throw new Error("private-db-url");
      }, 100),
    ).toBe(false);
  });
  it("bounds response time and coalesces concurrent hung probes", async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    const ping = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const first = checkReadiness(ping, 100);
    const second = checkReadiness(ping, 100);
    await vi.advanceTimersByTimeAsync(100);
    expect(await first).toBe(false);
    expect(await second).toBe(false);
    expect(ping).toHaveBeenCalledTimes(1);
    finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(await checkReadiness(async () => 1, 100)).toBe(true);
  });
});
