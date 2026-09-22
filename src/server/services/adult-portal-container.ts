import "server-only";

import { AdultPortalService } from "@/application/adult-portal/service";
import { PrismaAdultPortalStore } from "@/server/db/prisma-adult-portal-store";

const globalForAdultPortal = globalThis as unknown as {
  adultPortalService?: AdultPortalService;
};

export function getAdultPortalService(): AdultPortalService {
  const service =
    globalForAdultPortal.adultPortalService ??
    new AdultPortalService(new PrismaAdultPortalStore());
  if (process.env.NODE_ENV !== "production") {
    globalForAdultPortal.adultPortalService = service;
  }
  return service;
}
