import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getDevBypassAccessLink,
  listAccessLinks,
} from "@/server/services/portal-view-service";

describe("portal development bypass fixtures", () => {
  it("derives persisted-shaped links from the shared portal fixtures", () => {
    const link = getDevBypassAccessLink("turma-5b");

    expect(link).toMatchObject({
      id: "turma-5b",
      label: "Turma 5B",
      audience: "Turma 5B · EMEF Victor Aggens",
      organizationId: "0b0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a",
      revokedAt: null,
      pausedAt: null,
    });
    expect(link?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(link?.expiresAt?.toISOString()).toBe("2026-08-31T02:59:59.999Z");
  });

  it("returns no fixture for unknown detail ids without needing a store", () => {
    expect(getDevBypassAccessLink("missing-link")).toBeUndefined();
    expect(listAccessLinks().map((link) => link.id)).toEqual([
      "habitos-saudaveis",
      "turma-5b",
    ]);
  });
});
