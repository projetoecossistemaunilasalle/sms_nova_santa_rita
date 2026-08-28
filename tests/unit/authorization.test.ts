import { describe, expect, it } from "vitest";

import { Capability, RecordStatus } from "@/generated/prisma/enums";
import { HttpError } from "@/server/http/errors";
import {
  type CapabilityAssignmentRecord,
  type CapabilityReader,
  AuthorizationService,
} from "@/server/services/authorization-service";

const ORG_A = "0b0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a";
const ORG_B = "1b1b1b1b-1b1b-4b1b-9b1b-1b1b1b1b1b1b";
const ORG_C = "2c2c2c2c-2c2c-4c2c-8c2c-2c2c2c2c2c2c";

const PROFILE_ID = "7d7d7d7d-7d7d-4d7d-8d7d-7d7d7d7d7d7d";
const MISSING_PROFILE_ID = "00000000-0000-4000-8000-000000000000";

/**
 * In-memory CapabilityReader fake. Unit tests exercise the pure decision
 * logic without a database or server-only imports.
 */
function fakeReader(
  profiles: Record<
    string,
    { status: RecordStatus; assignments: CapabilityAssignmentRecord[] }
  >,
): CapabilityReader {
  return {
    async findProfileWithAssignments(profileId: string) {
      const profile = profiles[profileId];
      if (profile === undefined) {
        return null;
      }
      return { status: profile.status, assignments: profile.assignments };
    },
  };
}

/** Builds one flattened assignment record with an ACTIVE membership by default. */
function assignment(options: {
  capability: Capability;
  scopeOrganizationId: string | null;
  membershipOrganizationId: string;
  membershipStatus?: RecordStatus;
}): CapabilityAssignmentRecord {
  return {
    capability: options.capability,
    scopeOrganizationId: options.scopeOrganizationId,
    membership: {
      status: options.membershipStatus ?? RecordStatus.ACTIVE,
      organizationId: options.membershipOrganizationId,
    },
  };
}

describe("AuthorizationService.canUse", () => {
  it("loads one profile snapshot for multiple capability decisions", async () => {
    let readCount = 0;
    const reader: CapabilityReader = {
      async findProfileWithAssignments(profileId: string) {
        readCount += 1;
        if (profileId !== PROFILE_ID) {
          return null;
        }
        return {
          status: RecordStatus.ACTIVE,
          assignments: [
            assignment({
              capability: Capability.USER_MANAGE,
              scopeOrganizationId: null,
              membershipOrganizationId: ORG_A,
            }),
            assignment({
              capability: Capability.ORGANIZATION_MANAGE,
              scopeOrganizationId: ORG_A,
              membershipOrganizationId: ORG_A,
            }),
          ],
        };
      },
    };
    const service = new AuthorizationService(reader);

    await expect(
      service.resolveEffectiveScopes(PROFILE_ID, [
        Capability.USER_MANAGE,
        Capability.ORGANIZATION_MANAGE,
        Capability.AUDIT_VIEW,
        Capability.ORGANIZATION_MANAGE,
      ]),
    ).resolves.toEqual([
      { kind: "platform" },
      { kind: "organizations", organizationIds: [ORG_A] },
      { kind: "denied" },
      { kind: "organizations", organizationIds: [ORG_A] },
    ]);
    expect(readCount).toBe(1);
  });

  it("allows the assigned organization through an active membership and denies other organizations", async () => {
    const service = new AuthorizationService(
      fakeReader({
        [PROFILE_ID]: {
          status: RecordStatus.ACTIVE,
          assignments: [
            assignment({
              capability: Capability.LINK_VIEW,
              scopeOrganizationId: ORG_A,
              membershipOrganizationId: ORG_A,
            }),
          ],
        },
      }),
    );

    await expect(
      service.canUse(PROFILE_ID, Capability.LINK_VIEW, ORG_A),
    ).resolves.toBe(true);
    await expect(
      service.canUse(PROFILE_ID, Capability.LINK_VIEW, ORG_B),
    ).resolves.toBe(false);
    await expect(
      service.canUse(PROFILE_ID, Capability.LINK_VIEW, ORG_C),
    ).resolves.toBe(false);
  });

  it("allows a platform-wide assignment for any organization and without an organization", async () => {
    const service = new AuthorizationService(
      fakeReader({
        [PROFILE_ID]: {
          status: RecordStatus.ACTIVE,
          assignments: [
            assignment({
              capability: Capability.LINK_MANAGE,
              scopeOrganizationId: null,
              membershipOrganizationId: ORG_A,
            }),
          ],
        },
      }),
    );

    await expect(
      service.canUse(PROFILE_ID, Capability.LINK_MANAGE, ORG_A),
    ).resolves.toBe(true);
    await expect(
      service.canUse(PROFILE_ID, Capability.LINK_MANAGE, ORG_C),
    ).resolves.toBe(true);
    await expect(
      service.canUse(PROFILE_ID, Capability.LINK_MANAGE),
    ).resolves.toBe(true);
  });

  it("unions organization scopes held through several memberships", async () => {
    const service = new AuthorizationService(
      fakeReader({
        [PROFILE_ID]: {
          status: RecordStatus.ACTIVE,
          assignments: [
            assignment({
              capability: Capability.RESULTS_VIEW_ORGANIZATION,
              scopeOrganizationId: ORG_A,
              membershipOrganizationId: ORG_A,
            }),
            assignment({
              capability: Capability.RESULTS_VIEW_ORGANIZATION,
              scopeOrganizationId: ORG_B,
              membershipOrganizationId: ORG_B,
            }),
          ],
        },
      }),
    );

    await expect(
      service.canUse(PROFILE_ID, Capability.RESULTS_VIEW_ORGANIZATION, ORG_A),
    ).resolves.toBe(true);
    await expect(
      service.canUse(PROFILE_ID, Capability.RESULTS_VIEW_ORGANIZATION, ORG_B),
    ).resolves.toBe(true);
    await expect(
      service.canUse(PROFILE_ID, Capability.RESULTS_VIEW_ORGANIZATION, ORG_C),
    ).resolves.toBe(false);
    await expect(
      service.canUse(PROFILE_ID, Capability.RESULTS_VIEW_ORGANIZATION),
    ).resolves.toBe(true);
  });

  it("denies everything for an inactive profile", async () => {
    const service = new AuthorizationService(
      fakeReader({
        [PROFILE_ID]: {
          status: RecordStatus.INACTIVE,
          assignments: [
            assignment({
              capability: Capability.LINK_VIEW,
              scopeOrganizationId: ORG_A,
              membershipOrganizationId: ORG_A,
            }),
          ],
        },
      }),
    );

    await expect(
      service.canUse(PROFILE_ID, Capability.LINK_VIEW, ORG_A),
    ).resolves.toBe(false);
    await expect(
      service.canUse(PROFILE_ID, Capability.LINK_VIEW),
    ).resolves.toBe(false);
  });

  it("denies everything for an archived profile", async () => {
    const service = new AuthorizationService(
      fakeReader({
        [PROFILE_ID]: {
          status: RecordStatus.ARCHIVED,
          assignments: [
            assignment({
              capability: Capability.ORGANIZATION_MANAGE,
              scopeOrganizationId: null,
              membershipOrganizationId: ORG_A,
            }),
          ],
        },
      }),
    );

    await expect(
      service.canUse(PROFILE_ID, Capability.ORGANIZATION_MANAGE, ORG_A),
    ).resolves.toBe(false);
    await expect(
      service.canUse(PROFILE_ID, Capability.ORGANIZATION_MANAGE),
    ).resolves.toBe(false);
  });

  it("denies everything when the profile does not exist", async () => {
    const service = new AuthorizationService(fakeReader({}));

    await expect(
      service.canUse(MISSING_PROFILE_ID, Capability.USER_MANAGE, ORG_A),
    ).resolves.toBe(false);
    await expect(
      service.canUse(MISSING_PROFILE_ID, Capability.USER_MANAGE),
    ).resolves.toBe(false);
  });

  it("denies an assignment granted through an inactive membership", async () => {
    const service = new AuthorizationService(
      fakeReader({
        [PROFILE_ID]: {
          status: RecordStatus.ACTIVE,
          assignments: [
            assignment({
              capability: Capability.AUDIT_VIEW,
              scopeOrganizationId: ORG_A,
              membershipOrganizationId: ORG_A,
              membershipStatus: RecordStatus.INACTIVE,
            }),
          ],
        },
      }),
    );

    await expect(
      service.canUse(PROFILE_ID, Capability.AUDIT_VIEW, ORG_A),
    ).resolves.toBe(false);
    await expect(
      service.canUse(PROFILE_ID, Capability.AUDIT_VIEW),
    ).resolves.toBe(false);
  });

  it("denies an assignment granted through an archived membership", async () => {
    const service = new AuthorizationService(
      fakeReader({
        [PROFILE_ID]: {
          status: RecordStatus.ACTIVE,
          assignments: [
            assignment({
              capability: Capability.LINK_VIEW,
              scopeOrganizationId: null,
              membershipOrganizationId: ORG_A,
              membershipStatus: RecordStatus.ARCHIVED,
            }),
          ],
        },
      }),
    );

    await expect(
      service.canUse(PROFILE_ID, Capability.LINK_VIEW, ORG_A),
    ).resolves.toBe(false);
    await expect(
      service.canUse(PROFILE_ID, Capability.LINK_VIEW),
    ).resolves.toBe(false);
  });

  it("denies a capability held for one organization when queried for another", async () => {
    const service = new AuthorizationService(
      fakeReader({
        [PROFILE_ID]: {
          status: RecordStatus.ACTIVE,
          assignments: [
            assignment({
              capability: Capability.LINK_MANAGE,
              scopeOrganizationId: ORG_A,
              membershipOrganizationId: ORG_A,
            }),
          ],
        },
      }),
    );

    await expect(
      service.canUse(PROFILE_ID, Capability.LINK_MANAGE, ORG_B),
    ).resolves.toBe(false);
  });

  it("denies a capability that is not assigned at all", async () => {
    const service = new AuthorizationService(
      fakeReader({
        [PROFILE_ID]: {
          status: RecordStatus.ACTIVE,
          assignments: [
            assignment({
              capability: Capability.USER_MANAGE,
              scopeOrganizationId: ORG_A,
              membershipOrganizationId: ORG_A,
            }),
          ],
        },
      }),
    );

    await expect(
      service.canUse(PROFILE_ID, Capability.AUDIT_VIEW, ORG_A),
    ).resolves.toBe(false);
    await expect(
      service.canUse(PROFILE_ID, Capability.AUDIT_VIEW),
    ).resolves.toBe(false);
  });

  it("grants access by the assignment scope, not by the membership organization", async () => {
    // Membership in ORG_A carrying a grant scoped to ORG_B: the scope governs
    // where the capability applies; the membership only gates validity.
    const service = new AuthorizationService(
      fakeReader({
        [PROFILE_ID]: {
          status: RecordStatus.ACTIVE,
          assignments: [
            assignment({
              capability: Capability.RESULTS_VIEW_ORGANIZATION,
              scopeOrganizationId: ORG_B,
              membershipOrganizationId: ORG_A,
            }),
          ],
        },
      }),
    );

    await expect(
      service.canUse(PROFILE_ID, Capability.RESULTS_VIEW_ORGANIZATION, ORG_B),
    ).resolves.toBe(true);
    await expect(
      service.canUse(PROFILE_ID, Capability.RESULTS_VIEW_ORGANIZATION, ORG_A),
    ).resolves.toBe(false);
  });

  it("denies unknown runtime capability values passed via a cast, without throwing", async () => {
    const bogusCapability = "not:a:capability" as Capability;
    const service = new AuthorizationService(
      fakeReader({
        [PROFILE_ID]: {
          status: RecordStatus.ACTIVE,
          assignments: [
            assignment({
              capability: Capability.LINK_VIEW,
              scopeOrganizationId: null,
              membershipOrganizationId: ORG_A,
            }),
          ],
        },
      }),
    );

    await expect(
      service.canUse(PROFILE_ID, bogusCapability, ORG_A),
    ).resolves.toBe(false);
    await expect(service.canUse(PROFILE_ID, bogusCapability)).resolves.toBe(
      false,
    );
    await expect(
      service.resolveEffectiveScope(PROFILE_ID, bogusCapability),
    ).resolves.toEqual({ kind: "denied" });
    await expect(
      service.assertCanUse(PROFILE_ID, bogusCapability, ORG_A),
    ).rejects.toBeInstanceOf(HttpError);
  });
});

describe("AuthorizationService.resolveEffectiveScope", () => {
  it("returns the deduplicated union of organization scopes across memberships", async () => {
    const service = new AuthorizationService(
      fakeReader({
        [PROFILE_ID]: {
          status: RecordStatus.ACTIVE,
          assignments: [
            assignment({
              capability: Capability.LINK_VIEW,
              scopeOrganizationId: ORG_A,
              membershipOrganizationId: ORG_A,
            }),
            assignment({
              capability: Capability.LINK_VIEW,
              scopeOrganizationId: ORG_B,
              membershipOrganizationId: ORG_B,
            }),
            // Same capability and scope reached through a third membership.
            assignment({
              capability: Capability.LINK_VIEW,
              scopeOrganizationId: ORG_A,
              membershipOrganizationId: ORG_C,
            }),
          ],
        },
      }),
    );

    await expect(
      service.resolveEffectiveScope(PROFILE_ID, Capability.LINK_VIEW),
    ).resolves.toEqual({
      kind: "organizations",
      organizationIds: [ORG_A, ORG_B],
    });
  });

  it("returns the platform kind when a platform-wide assignment exists alongside organization scopes", async () => {
    const service = new AuthorizationService(
      fakeReader({
        [PROFILE_ID]: {
          status: RecordStatus.ACTIVE,
          assignments: [
            assignment({
              capability: Capability.USER_MANAGE,
              scopeOrganizationId: ORG_A,
              membershipOrganizationId: ORG_A,
            }),
            assignment({
              capability: Capability.USER_MANAGE,
              scopeOrganizationId: null,
              membershipOrganizationId: ORG_B,
            }),
          ],
        },
      }),
    );

    await expect(
      service.resolveEffectiveScope(PROFILE_ID, Capability.USER_MANAGE),
    ).resolves.toEqual({ kind: "platform" });
  });

  it("returns the platform kind for a platform-wide assignment", async () => {
    const service = new AuthorizationService(
      fakeReader({
        [PROFILE_ID]: {
          status: RecordStatus.ACTIVE,
          assignments: [
            assignment({
              capability: Capability.AUDIT_VIEW,
              scopeOrganizationId: null,
              membershipOrganizationId: ORG_A,
            }),
          ],
        },
      }),
    );

    await expect(
      service.resolveEffectiveScope(PROFILE_ID, Capability.AUDIT_VIEW),
    ).resolves.toEqual({ kind: "platform" });
  });

  it("returns denied when no usable assignment exists for the capability", async () => {
    const service = new AuthorizationService(
      fakeReader({
        [PROFILE_ID]: {
          status: RecordStatus.ACTIVE,
          assignments: [],
        },
      }),
    );

    await expect(
      service.resolveEffectiveScope(PROFILE_ID, Capability.LINK_VIEW),
    ).resolves.toEqual({ kind: "denied" });
  });

  it("returns denied for an inactive profile even with assignments on paper", async () => {
    const service = new AuthorizationService(
      fakeReader({
        [PROFILE_ID]: {
          status: RecordStatus.INACTIVE,
          assignments: [
            assignment({
              capability: Capability.LINK_VIEW,
              scopeOrganizationId: null,
              membershipOrganizationId: ORG_A,
            }),
          ],
        },
      }),
    );

    await expect(
      service.resolveEffectiveScope(PROFILE_ID, Capability.LINK_VIEW),
    ).resolves.toEqual({ kind: "denied" });
  });

  it("returns denied for a missing profile", async () => {
    const service = new AuthorizationService(fakeReader({}));

    await expect(
      service.resolveEffectiveScope(MISSING_PROFILE_ID, Capability.LINK_VIEW),
    ).resolves.toEqual({ kind: "denied" });
  });

  it("ignores assignments granted through inactive memberships when resolving scope", async () => {
    const service = new AuthorizationService(
      fakeReader({
        [PROFILE_ID]: {
          status: RecordStatus.ACTIVE,
          assignments: [
            assignment({
              capability: Capability.LINK_VIEW,
              scopeOrganizationId: ORG_A,
              membershipOrganizationId: ORG_A,
              membershipStatus: RecordStatus.INACTIVE,
            }),
            assignment({
              capability: Capability.LINK_VIEW,
              scopeOrganizationId: ORG_B,
              membershipOrganizationId: ORG_B,
            }),
          ],
        },
      }),
    );

    await expect(
      service.resolveEffectiveScope(PROFILE_ID, Capability.LINK_VIEW),
    ).resolves.toEqual({
      kind: "organizations",
      organizationIds: [ORG_B],
    });
  });
});

describe("AuthorizationService.assertCanUse", () => {
  it("throws an HttpError with code FORBIDDEN and status 403 on denial", async () => {
    const service = new AuthorizationService(
      fakeReader({
        [PROFILE_ID]: {
          status: RecordStatus.ACTIVE,
          assignments: [
            assignment({
              capability: Capability.LINK_VIEW,
              scopeOrganizationId: ORG_A,
              membershipOrganizationId: ORG_A,
            }),
          ],
        },
      }),
    );

    const denial = service.assertCanUse(
      PROFILE_ID,
      Capability.LINK_VIEW,
      ORG_B,
    );
    await expect(denial).rejects.toBeInstanceOf(HttpError);
    await expect(denial).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
  });

  it("throws on denial when the capability is not assigned at all", async () => {
    const service = new AuthorizationService(
      fakeReader({
        [PROFILE_ID]: {
          status: RecordStatus.ACTIVE,
          assignments: [],
        },
      }),
    );

    await expect(
      service.assertCanUse(PROFILE_ID, Capability.USER_MANAGE),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("throws on denial for a missing profile", async () => {
    const service = new AuthorizationService(fakeReader({}));

    await expect(
      service.assertCanUse(MISSING_PROFILE_ID, Capability.LINK_VIEW, ORG_A),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("does not throw when the capability is allowed", async () => {
    const service = new AuthorizationService(
      fakeReader({
        [PROFILE_ID]: {
          status: RecordStatus.ACTIVE,
          assignments: [
            assignment({
              capability: Capability.LINK_VIEW,
              scopeOrganizationId: ORG_A,
              membershipOrganizationId: ORG_A,
            }),
          ],
        },
      }),
    );

    await expect(
      service.assertCanUse(PROFILE_ID, Capability.LINK_VIEW, ORG_A),
    ).resolves.toBeUndefined();
    await expect(
      service.assertCanUse(PROFILE_ID, Capability.LINK_VIEW),
    ).resolves.toBeUndefined();
  });
});
