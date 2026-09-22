import "server-only";

import { RecordStatus } from "@/generated/prisma/enums";

import type { AuthGateway } from "./gateway";
import type { ActorSession } from "./session";

type NeonSessionResult = {
  data?: {
    session?: { expiresAt?: Date | string };
    user?: { id?: string; name?: string | null; email?: string | null };
  } | null;
  error?: unknown;
};

type ProfileRecord = {
  id: string;
  authUserId: string;
  displayName: string;
  status: RecordStatus;
};

export type NeonSessionReader = {
  getSession(): Promise<NeonSessionResult>;
};

export type ProfessionalProfileReader = {
  findByAuthUserId(authUserId: string): Promise<ProfileRecord | null>;
};

class PrismaProfessionalProfileReader implements ProfessionalProfileReader {
  async findByAuthUserId(authUserId: string): Promise<ProfileRecord | null> {
    const { getPrisma } = await import("@/server/db/client");
    return getPrisma().professionalProfile.findUnique({
      where: { authUserId },
      select: {
        id: true,
        authUserId: true,
        displayName: true,
        status: true,
      },
    });
  }
}

class NeonServerSessionReader implements NeonSessionReader {
  async getSession(): Promise<NeonSessionResult> {
    const { getNeonAuthServer } = await import("./neon-server");
    return getNeonAuthServer().getSession();
  }
}

export class NeonAuthGateway implements AuthGateway {
  constructor(
    private readonly sessions: NeonSessionReader = new NeonServerSessionReader(),
    private readonly profiles: ProfessionalProfileReader = new PrismaProfessionalProfileReader(),
  ) {}

  async getSession(): Promise<ActorSession | null> {
    let result: NeonSessionResult;
    try {
      result = await this.sessions.getSession();
    } catch {
      return null;
    }
    const authUser = result.data?.user;
    if (result.error || !authUser?.id) return null;

    const profile = await this.profiles.findByAuthUserId(authUser.id);
    if (!profile || profile.status !== RecordStatus.ACTIVE) return null;

    const expiresAt = new Date(
      result.data?.session?.expiresAt ?? Date.now() + 5 * 60 * 1000,
    );
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      return null;
    }

    return {
      actor: {
        profileId: profile.id,
        authUserId: profile.authUserId,
        displayName: profile.displayName,
        email: authUser.email ?? "",
      },
      expiresAt,
    };
  }
}
