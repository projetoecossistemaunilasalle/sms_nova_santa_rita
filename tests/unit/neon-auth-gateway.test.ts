import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/db/client", () => ({ getPrisma: vi.fn() }));

import { RecordStatus } from "@/generated/prisma/enums";
import { NeonAuthGateway } from "@/server/auth/neon-gateway";

const authenticatedSession = {
  data: {
    user: {
      id: "neon-user-1",
      name: "Provider Name",
      email: "teacher@example.org",
    },
    session: { expiresAt: "2099-01-01T00:00:00.000Z" },
  },
};

describe("NeonAuthGateway", () => {
  it("maps a verified Neon identity to its active professional profile", async () => {
    const gateway = new NeonAuthGateway(
      { getSession: vi.fn(async () => authenticatedSession) },
      {
        findByAuthUserId: vi.fn(async () => ({
          id: "profile-1",
          authUserId: "neon-user-1",
          displayName: "Portal Name",
          status: RecordStatus.ACTIVE,
        })),
      },
    );

    await expect(gateway.getSession()).resolves.toMatchObject({
      actor: {
        profileId: "profile-1",
        authUserId: "neon-user-1",
        displayName: "Portal Name",
        email: "teacher@example.org",
      },
    });
  });

  it.each([RecordStatus.INACTIVE, RecordStatus.ARCHIVED])(
    "rejects a %s professional profile",
    async (status) => {
      const gateway = new NeonAuthGateway(
        { getSession: vi.fn(async () => authenticatedSession) },
        {
          findByAuthUserId: vi.fn(async () => ({
            id: "profile-1",
            authUserId: "neon-user-1",
            displayName: "Portal Name",
            status,
          })),
        },
      );

      await expect(gateway.getSession()).resolves.toBeNull();
    },
  );

  it("rejects missing authentication and missing profiles", async () => {
    const unauthenticated = new NeonAuthGateway(
      { getSession: vi.fn(async () => ({ data: null })) },
      { findByAuthUserId: vi.fn() },
    );
    await expect(unauthenticated.getSession()).resolves.toBeNull();

    const missingProfile = new NeonAuthGateway(
      { getSession: vi.fn(async () => authenticatedSession) },
      { findByAuthUserId: vi.fn(async () => null) },
    );
    await expect(missingProfile.getSession()).resolves.toBeNull();
  });
});
