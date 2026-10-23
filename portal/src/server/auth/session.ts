/**
 * Application-owned actor and session types. Domain code and UI must depend on
 * these types (and the AuthGateway contract), never on Neon Auth SDK types,
 * which stay encapsulated behind the gateway implementation (P1-04).
 */
export type PortalActor = {
  /** `ProfessionalProfile.id` this actor is bound to. */
  profileId: string;
  /** Identifier in the external authentication provider. */
  authUserId: string;
  displayName: string;
  email: string;
};

export type ActorSession = {
  actor: PortalActor;
  expiresAt: Date;
};
