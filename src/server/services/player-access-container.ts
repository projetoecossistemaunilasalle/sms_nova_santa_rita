import "server-only";

import { PlayerAccessService } from "@/application/player-access/service";
import { PrismaPlayerAccessStore } from "@/server/db/prisma-player-access-store";
import { SecurePlayerCredentialIssuer } from "@/server/security/player-credential-tokens";

const globalForPlayerAccess = globalThis as unknown as {
  playerAccessService?: PlayerAccessService;
};

export function getPlayerAccessService(): PlayerAccessService {
  const service =
    globalForPlayerAccess.playerAccessService ??
    new PlayerAccessService(
      new PrismaPlayerAccessStore(),
      new SecurePlayerCredentialIssuer(),
    );
  if (process.env.NODE_ENV !== "production") {
    globalForPlayerAccess.playerAccessService = service;
  }
  return service;
}
