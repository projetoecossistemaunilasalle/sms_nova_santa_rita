import type { AuthGateway } from "./gateway";
import type { ActorSession } from "./session";
import { RecordStatus } from "@/generated/prisma/enums";

export class DemoAuthGateway implements AuthGateway {
  async getSession(): Promise<ActorSession | null> {
    const { findMockDatabase } = await import("@/server/mock/session");
    const database = await findMockDatabase();
    const profile = database?.state.profiles.find(
      (item) =>
        item.id === database.state.activeProfileId &&
        item.status === RecordStatus.ACTIVE,
    );
    if (!profile) return null;
    return {
      actor: {
        profileId: profile.id,
        authUserId: `mock:${profile.id}`,
        displayName: profile.displayName,
        email: profile.email ?? "demonstracao@localhost",
      },
      expiresAt: new Date(database!.expiresAt),
    };
  }
}
