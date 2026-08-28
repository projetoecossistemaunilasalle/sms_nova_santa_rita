import { PrismaCapabilityReader } from "@/server/db/prisma-capability-reader";
import { PrismaAccessLinkStore } from "@/server/db/prisma-access-link-store";
import { AccessLinkService } from "@/server/services/access-link-service";
import { AuthorizationService } from "@/server/services/authorization-service";

const globalForServices = globalThis as unknown as {
  authorizationService?: AuthorizationService;
  accessLinkService?: AccessLinkService;
};

/**
 * Composition root for domain services. Wires Prisma-backed ports into the
 * pure service implementations; unit tests construct their own fakes instead
 * of reaching for this container.
 */
export function getAuthorizationService(): AuthorizationService {
  const service =
    globalForServices.authorizationService ??
    new AuthorizationService(new PrismaCapabilityReader());

  if (process.env.NODE_ENV !== "production") {
    globalForServices.authorizationService = service;
  }

  return service;
}

/** System clock port used by lifecycle services. */
const systemClock = { now: () => new Date() };

export function getAccessLinkService(): AccessLinkService {
  const service =
    globalForServices.accessLinkService ??
    new AccessLinkService({
      store: new PrismaAccessLinkStore(),
      authorization: getAuthorizationService(),
      clock: systemClock,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForServices.accessLinkService = service;
  }

  return service;
}
