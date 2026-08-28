import { describe, expect, it } from "vitest";

import { resolveLinkStatus } from "@/server/services/link-status";

const PAST = new Date("2026-01-01T00:00:00.000Z");
const FUTURE = new Date("2099-01-01T00:00:00.000Z");

describe("resolveLinkStatus", () => {
  it("returns Aberta for a live non-expiring link", () => {
    expect(
      resolveLinkStatus({
        revokedAt: null,
        pausedAt: null,
        expiresAt: null,
      }),
    ).toBe("Aberta");
  });

  it("returns Aberta while the expiry is still in the future", () => {
    expect(
      resolveLinkStatus({
        revokedAt: null,
        pausedAt: null,
        expiresAt: FUTURE,
      }),
    ).toBe("Aberta");
  });

  it("returns Pausada for a paused link even when it is also expired", () => {
    // Mirrors public-link precedence: pause outranks expiry.
    expect(
      resolveLinkStatus({
        revokedAt: null,
        pausedAt: PAST,
        expiresAt: PAST,
      }),
    ).toBe("Pausada");
  });

  it("returns Encerrada for an expired link that is not paused", () => {
    expect(
      resolveLinkStatus({
        revokedAt: null,
        pausedAt: null,
        expiresAt: PAST,
      }),
    ).toBe("Encerrada");
  });

  it("returns Encerrada for a revoked link, outranking pause and expiry", () => {
    expect(
      resolveLinkStatus({
        revokedAt: PAST,
        pausedAt: PAST,
        expiresAt: FUTURE,
      }),
    ).toBe("Encerrada");
    expect(
      resolveLinkStatus({
        revokedAt: PAST,
        pausedAt: null,
        expiresAt: null,
      }),
    ).toBe("Encerrada");
  });
});
