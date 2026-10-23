import type { V1AuthorizationSnapshot } from "@/server/authorization/v1-policy";

import type { ActorSnapshot } from "@/application/adult-portal/types";

export function toAuthorizationActor(
  actor: ActorSnapshot,
): V1AuthorizationSnapshot {
  return {
    profileStatus: actor.profileStatus,
    platformRole: actor.platformRole,
    memberships: actor.memberships.map((membership) => ({
      organizationId: membership.organizationId,
      organizationStatus: membership.organizationStatus,
      role: membership.role,
      status: membership.status,
      teacherAssignments: membership.teacherAssignments,
    })),
  };
}
