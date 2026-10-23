import "server-only";

import { PlayerAccessService } from "@/application/player-access/service";
import { PrismaPlayerAccessStore } from "@/server/db/prisma-player-access-store";
import { SecurePlayerCredentialIssuer } from "@/server/security/player-credential-tokens";
import { SecurePlayerCredentialCipher } from "@/server/security/player-credential-cipher";
import { getServerRuntimeEnv } from "@/server/config/env";
import { getRuntimeMode } from "@/runtime/mode";
import { MockPlayerAccessStore } from "@/server/mock/database";
import { getMockDatabase } from "@/server/mock/session";

const globalForPlayerAccess = globalThis as unknown as {
  playerAccessService?: PlayerAccessService;
};

export async function getPlayerAccessService(): Promise<PlayerAccessService> {
  if (getRuntimeMode() === "demo") {
    const database = await getMockDatabase();
    return new PlayerAccessService(
      new MockPlayerAccessStore(database),
      new SecurePlayerCredentialIssuer(),
      database.credentialCipher,
    );
  }
  const service =
    globalForPlayerAccess.playerAccessService ??
    new PlayerAccessService(
      new PrismaPlayerAccessStore(),
      new SecurePlayerCredentialIssuer(),
      new SecurePlayerCredentialCipher(
        getServerRuntimeEnv().APPLICATION_SECRET,
        {
          keyId: getServerRuntimeEnv().PLAYER_CREDENTIAL_KEY_ID,
          keys: getServerRuntimeEnv().PLAYER_CREDENTIAL_KEYS,
        },
      ),
      () => new Date(),
      getServerRuntimeEnv().OFFLINE_FLUSH_WINDOW_SECONDS,
    );
  if (process.env.NODE_ENV !== "production") {
    globalForPlayerAccess.playerAccessService = service;
  }
  return service;
}
