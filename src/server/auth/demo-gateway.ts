import type { AuthGateway } from "./gateway";
import type { ActorSession } from "./session";

export const DEMO_SESSION: ActorSession = {
  actor: {
    profileId: "demo-professional",
    authUserId: "demo-user",
    displayName: "Adriana Martins",
    email: "demonstracao@localhost",
  },
  expiresAt: new Date("2099-12-31T23:59:59.000Z"),
};

export class DemoAuthGateway implements AuthGateway {
  getSession(): Promise<ActorSession> {
    return Promise.resolve(DEMO_SESSION);
  }
}
