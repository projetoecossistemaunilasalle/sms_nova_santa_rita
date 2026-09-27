import type { AuthGateway } from "./gateway";
import type { ActorSession, PortalActor } from "./session";

/**
 * Synthetic actor used when AUTH_DEV_BYPASS is enabled. The identifiers are
 * deliberately non-real so synthetic data can never be confused with, or leak
 * into, production accounts or logs.
 */
const DEV_BYPASS_ACTOR: PortalActor = {
  profileId: "00000000-0000-4000-8000-000000000001",
  authUserId: "dev-bypass-local",
  displayName: "Adriana Martins",
  email: "dev@localhost",
};

const DEV_BYPASS_SESSION: ActorSession = {
  actor: DEV_BYPASS_ACTOR,
  expiresAt: new Date("2099-12-31T23:59:59.000Z"),
};

/**
 * Local-development stand-in that satisfies the protected portal layout while
 * real authentication (P1-04) is not implemented. Never active in production;
 * the runtime env schema refuses to start with the bypass enabled there.
 */
export class DevBypassAuthGateway implements AuthGateway {
  getSession(): Promise<ActorSession> {
    return Promise.resolve(DEV_BYPASS_SESSION);
  }
}
