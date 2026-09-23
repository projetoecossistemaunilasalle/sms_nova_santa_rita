import "server-only";

import {
  GameEventReportService,
  GameEventService,
} from "@/application/game-events/service";
import { PrismaGameEventStore } from "@/server/db/prisma-game-event-store";
import { getAdultPortalService } from "@/server/services/adult-portal-container";
import { getServerRuntimeEnv } from "@/server/config/env";
import { verifyLaunchToken } from "@/server/security/launch-token";

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
    new GameEventService(eventStore(), (token) =>
      verifyLaunchToken(token, getServerRuntimeEnv().APPLICATION_SECRET),
    );
  if (process.env.NODE_ENV !== "production") {
    globalForGameEvents.gameEventService = service;
  }
  return service;
}

export function getGameEventReportService(): GameEventReportService {
  const service =
    globalForGameEvents.gameEventReportService ??
    new GameEventReportService(
      eventStore(),
      async (profileId, classGroupId) => {
        await getAdultPortalService().getClass(profileId, classGroupId);
      },
      (profileId) => getAdultPortalService().listClasses(profileId),
    );
  if (process.env.NODE_ENV !== "production") {
    globalForGameEvents.gameEventReportService = service;
  }
  return service;
}
