import "server-only";

import { AdultPortalService } from "@/application/adult-portal/service";
import {
  DemoAccountIdentityProvider,
  NeonAccountIdentityProvider,
} from "@/server/auth/account-identity-provider";
import { PrismaAdultPortalStore } from "@/server/db/prisma-adult-portal-store";
import { getRuntimeMode } from "@/runtime/mode";
import { MockAdultPortalStore } from "@/server/mock/database";
import { getMockDatabase } from "@/server/mock/session";

const globalForAdultPortal = globalThis as unknown as {
  adultPortalService?: AdultPortalService;
};

export async function getAdultPortalService(): Promise<AdultPortalService> {
  if (getRuntimeMode() === "demo") {
    return new AdultPortalService(
      new MockAdultPortalStore(await getMockDatabase()),
      new DemoAccountIdentityProvider(),
    );
  }
  const service =
    globalForAdultPortal.adultPortalService ??
    new AdultPortalService(
      new PrismaAdultPortalStore(),
      new NeonAccountIdentityProvider(),
    );
  if (process.env.NODE_ENV !== "production") {
    globalForAdultPortal.adultPortalService = service;
  }
  return service;
}
