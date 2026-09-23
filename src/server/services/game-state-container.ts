import "server-only";

import { GameStateService } from "@/application/game-state/service";
import { PrismaGameStateStore } from "@/server/db/prisma-game-state-store";
import { getServerRuntimeEnv } from "@/server/config/env";
import { verifyLaunchToken } from "@/server/security/launch-token";

export function getGameStateService(): GameStateService {
  return new GameStateService(new PrismaGameStateStore(), (token) =>
    verifyLaunchToken(token, getServerRuntimeEnv().APPLICATION_SECRET),
  );
}
