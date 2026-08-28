import "server-only";

import { getPrisma } from "@/server/db/client";
import type {
  CapabilityReader,
  ProfileCapabilitySnapshot,
} from "@/server/services/authorization-service";

/**
 * Prisma-backed {@link CapabilityReader}. Loads the profile plus every
 * capability assignment joined with its membership in a single query with
 * nested selects, reading only the fields the authorization decision needs.
 */
export class PrismaCapabilityReader implements CapabilityReader {
  async findProfileWithAssignments(
    profileId: string,
  ): Promise<ProfileCapabilitySnapshot | null> {
    const profile = await getPrisma().professionalProfile.findUnique({
      where: { id: profileId },
      select: {
        status: true,
        memberships: {
          select: {
            status: true,
            organizationId: true,
            capabilityAssignments: {
              select: {
                capability: true,
                scopeOrganizationId: true,
              },
            },
          },
        },
      },
    });

    if (profile === null) {
      return null;
    }

    return {
      status: profile.status,
      assignments: profile.memberships.flatMap((membership) =>
        membership.capabilityAssignments.map((assignment) => ({
          capability: assignment.capability,
          scopeOrganizationId: assignment.scopeOrganizationId,
          membership: {
            status: membership.status,
            organizationId: membership.organizationId,
          },
        })),
      ),
    };
  }
}
