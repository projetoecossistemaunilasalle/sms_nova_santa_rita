import "server-only";

import {
  GameEventReportService,
  GameEventService,
} from "@/application/game-events/service";
import { PrismaGameEventStore } from "@/server/db/prisma-game-event-store";
import { getAdultPortalService } from "@/server/services/adult-portal-container";
import { getServerRuntimeEnv } from "@/server/config/env";
import { verifyLaunchToken } from "@/server/security/launch-token";
import { getRuntimeMode } from "@/runtime/mode";
import { getMockDatabase } from "@/server/mock/session";
import { MockGameEventReportStore } from "@/server/mock/report-store";

const globalForGameEvents = globalThis as unknown as {
  gameEventService?: GameEventService;
  gameEventReportService?: GameEventReportService;
};

function eventStore() {
  return new PrismaGameEventStore();
}

export function getGameEventService(): GameEventService {
  const service =
    globalForGameEvents.gameEventService ??
    new GameEventService(
      eventStore(),
      (token) =>
        verifyLaunchToken(token, getServerRuntimeEnv().APPLICATION_SECRET),
      () => new Date(),
      getServerRuntimeEnv().OFFLINE_FLUSH_WINDOW_SECONDS,
    );
  if (process.env.NODE_ENV !== "production") {
    globalForGameEvents.gameEventService = service;
  }
  return service;
}

export async function getGameEventReportService(): Promise<GameEventReportService> {
  const portal = await getAdultPortalService();
  if (getRuntimeMode() === "demo") {
    return new GameEventReportService(
      new MockGameEventReportStore((await getMockDatabase()).state),
      async (profileId, classGroupId) => {
        await portal.getClass(profileId, classGroupId);
      },
      (profileId) => portal.listClasses(profileId),
    );
  }
  const service =
    globalForGameEvents.gameEventReportService ??
    new GameEventReportService(
      eventStore(),
      async (profileId, classGroupId) => {
        await portal.getClass(profileId, classGroupId);
      },
      (profileId) => portal.listClasses(profileId),
    );
  if (process.env.NODE_ENV !== "production") {
    globalForGameEvents.gameEventReportService = service;
  }
  return service;
}
