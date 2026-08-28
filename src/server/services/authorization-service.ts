import { Capability, RecordStatus } from "@/generated/prisma/enums";
import { cache } from "react";

import { HttpError } from "@/server/http/errors";

/**
 * One capability grant flattened with the membership context the decision
 * needs. The scope lives on the grant itself: `scopeOrganizationId` null means
 * platform-wide; any other value limits the grant to that organization. The
 * membership only gates validity (`status`) and records the organization the
 * profile belongs to — it never widens the grant's scope.
 */
export type CapabilityAssignmentRecord = {
  capability: Capability;
  /** null = platform-wide scope. */
  scopeOrganizationId: string | null;
  membership: {
    status: RecordStatus;
    organizationId: string;
  };
};

/** Profile row plus every capability assignment joined with its membership. */
export type ProfileCapabilitySnapshot = {
  status: RecordStatus;
  assignments: CapabilityAssignmentRecord[];
};

/**
 * Port behind the authorization service. Implementations load data; the pure
 * decision logic stays in this module so it can be unit tested without a
 * database or server-only imports.
 */
export type CapabilityReader = {
  /**
   * Returns the profile row plus ALL capability assignments joined with their
   * membership for the profile, or null when the profile does not exist.
   */
  findProfileWithAssignments(
    profileId: string,
  ): Promise<ProfileCapabilitySnapshot | null>;
};

/**
 * Deny-by-default outcome of scope resolution: no usable grant, one
 * platform-wide grant, or the deduplicated union of granted organization ids.
 */
export type EffectiveCapabilityScope =
  | { readonly kind: "denied" }
  | { readonly kind: "platform" }
  | { readonly kind: "organizations"; readonly organizationIds: string[] };

const DENIED_SCOPE: EffectiveCapabilityScope = { kind: "denied" };

/**
 * React owns the lifetime of this cache. It deduplicates concurrent reads
 * during one server render without retaining a profile snapshot between
 * requests (or between users).
 */
const readProfileCapabilitySnapshot = cache(
  (reader: CapabilityReader, profileId: string) =>
    reader.findProfileWithAssignments(profileId),
);

/** Runtime mirror of the generated Capability enum for fail-closed validation. */
const KNOWN_CAPABILITIES: readonly string[] = Object.values(Capability);

/**
 * Capability authorization decisions.
 *
 * Invariants (deny by default):
 * - A missing profile, or a profile whose status is not ACTIVE, denies
 *   everything.
 * - An assignment counts only when its membership status is ACTIVE.
 * - `scopeOrganizationId` null is platform-wide and supersedes any
 *   organization scope for the same capability; a non-null scope grants only
 *   that organization. V1 performs no parent/child organization inference.
 * - Capability values that are not known enum members (for example unexpected
 *   runtime strings cast with `as`) are denied gracefully, never thrown on.
 */
export class AuthorizationService {
  constructor(private readonly reader: CapabilityReader) {}

  /**
   * Resolves the effective scope in which the profile may use a capability:
   * denied, platform-wide, or the deduplicated union of organization scopes
   * the profile holds the capability in. A platform-wide assignment wins over
   * organization-scoped assignments for the same capability.
   */
  async resolveEffectiveScope(
    profileId: string,
    capability: Capability,
  ): Promise<EffectiveCapabilityScope> {
    const usableAssignments = await this.loadUsableAssignments(
      profileId,
      capability,
    );

    return resolveScopeFromAssignments(usableAssignments);
  }

  /**
   * Resolves several capabilities from one profile snapshot. This is useful
   * for server-rendered navigation, where several links can depend on the
   * same profile and should not each issue their own database read.
   *
   * Results preserve the input order, including repeated capabilities and
   * unknown runtime values, which are denied just like {@link
   * resolveEffectiveScope}.
   */
  async resolveEffectiveScopes(
    profileId: string,
    capabilities: readonly Capability[],
  ): Promise<EffectiveCapabilityScope[]> {
    if (capabilities.length === 0) {
      return [];
    }

    const knownCapabilities = new Set(
      capabilities.filter((capability) =>
        KNOWN_CAPABILITIES.includes(capability),
      ),
    );
    if (knownCapabilities.size === 0) {
      return capabilities.map(() => DENIED_SCOPE);
    }

    const profile = await this.loadProfileCapabilitySnapshot(profileId);
    if (profile === null || profile.status !== RecordStatus.ACTIVE) {
      return capabilities.map(() => DENIED_SCOPE);
    }

    const scopes = new Map<string, EffectiveCapabilityScope>();
    for (const capability of knownCapabilities) {
      const assignments = profile.assignments.filter(
        (assignment) =>
          assignment.capability === capability &&
          assignment.membership.status === RecordStatus.ACTIVE,
      );
      scopes.set(capability, resolveScopeFromAssignments(assignments));
    }

    return capabilities.map(
      (capability) => scopes.get(capability) ?? DENIED_SCOPE,
    );
  }

  /**
   * Boolean decision for a capability. With `organizationId`: allowed iff a
   * platform-wide assignment exists or an organization-scoped assignment
   * matches that organization. Without `organizationId`: allowed iff any
   * valid assignment exists (for listing across allowed organizations).
   */
  async canUse(
    profileId: string,
    capability: Capability,
    organizationId?: string,
  ): Promise<boolean> {
    const usableAssignments = await this.loadUsableAssignments(
      profileId,
      capability,
    );

    if (organizationId === undefined) {
      return usableAssignments.length > 0;
    }
    return usableAssignments.some(
      (assignment) =>
        assignment.scopeOrganizationId === null ||
        assignment.scopeOrganizationId === organizationId,
    );
  }

  /**
   * Same decision as {@link canUse}, throwing an HttpError envelope (403,
   * FORBIDDEN) on denial. Protected service methods call this even when the
   * route handler already checked, so the rule is enforced at the boundary
   * that owns it.
   */
  async assertCanUse(
    profileId: string,
    capability: Capability,
    organizationId?: string,
  ): Promise<void> {
    const allowed = await this.canUse(profileId, capability, organizationId);
    if (!allowed) {
      // Generic message on purpose: never reveal whether the profile,
      // membership, or capability caused the denial.
      throw new HttpError(403, "FORBIDDEN", "Access denied.");
    }
  }

  /**
   * Loads the assignments that may actually grant `capability`: the requested
   * capability must be a known enum value, the profile must exist with status
   * ACTIVE, and each returned assignment matches the capability through an
   * ACTIVE membership.
   */
  private async loadUsableAssignments(
    profileId: string,
    capability: Capability,
  ): Promise<CapabilityAssignmentRecord[]> {
    if (!KNOWN_CAPABILITIES.includes(capability)) {
      return [];
    }

    const profile = await this.loadProfileCapabilitySnapshot(profileId);
    if (profile === null || profile.status !== RecordStatus.ACTIVE) {
      return [];
    }

    return profile.assignments.filter(
      (assignment) =>
        assignment.capability === capability &&
        assignment.membership.status === RecordStatus.ACTIVE,
    );
  }

  private loadProfileCapabilitySnapshot(profileId: string) {
    return readProfileCapabilitySnapshot(this.reader, profileId);
  }
}

function resolveScopeFromAssignments(
  assignments: readonly CapabilityAssignmentRecord[],
): EffectiveCapabilityScope {
  const organizationIds = new Set<string>();
  let platformWide = false;
  for (const assignment of assignments) {
    if (assignment.scopeOrganizationId === null) {
      platformWide = true;
    } else {
      organizationIds.add(assignment.scopeOrganizationId);
    }
  }

  if (platformWide) {
    return { kind: "platform" };
  }
  if (organizationIds.size === 0) {
    return DENIED_SCOPE;
  }
  return { kind: "organizations", organizationIds: [...organizationIds] };
}
