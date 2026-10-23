import "server-only";

import { GameContentService } from "@/application/game-content/service";
import { getRuntimeMode } from "@/runtime/mode";
import { resolveGameClientUrl } from "@/server/config/game-client";
import { PrismaGameContentStore } from "@/server/db/prisma-game-content-store";
import { getMockDatabase } from "@/server/mock/session";

export async function getGameContentService(): Promise<GameContentService> {
  if (getRuntimeMode() === "demo") {
    return new GameContentService(
      (await getMockDatabase()).gameContentStore,
      () => null,
    );
  }
  return new GameContentService(new PrismaGameContentStore(), () => {
    const client = resolveGameClientUrl();
    return client.status === "configured" ? client.url : null;
  });
}
