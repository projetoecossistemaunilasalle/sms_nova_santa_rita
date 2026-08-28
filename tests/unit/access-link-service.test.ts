import { describe, expect, it, vi } from "vitest";

import type { PortalActor } from "@/server/auth/session";
import { Capability, RecordStatus } from "@/generated/prisma/enums";
import { HttpError } from "@/server/http/errors";
import { hashToken } from "@/server/security/tokens";
import {
  type CapabilityAssignmentRecord,
  type CapabilityReader,
  AuthorizationService,
} from "@/server/services/authorization-service";
import {
  type AccessLinkRecord,
  type AccessLinkStore,
  type AuditEventInput,
  AccessLinkService,
} from "@/server/services/access-link-service";
import { resolvePublicLink } from "@/server/services/public-link-service";

// `public-link-service` imports "server-only", a guard package that Next.js
// aliases away at build time and that plain Node/vitest cannot resolve.
// Stubbing it keeps the guard out of the way for unit tests.
vi.mock("server-only", () => ({}));

const ORG_A = "0b0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a";
const ORG_B = "1b1b1b1b-1b1b-4b1b-9b1b-1b1b1b1b1b1b";

const MANAGER_PROFILE_ID = "7d7d7d7d-7d7d-4d7d-8d7d-7d7d7d7d7d7d";
const PLATFORM_PROFILE_ID = "8e8e8e8e-8e8e-4e8e-8e8e-8e8e8e8e8e8e";
const VIEWER_PROFILE_ID = "9f9f9f9f-9f9f-4f9f-8f9f-9f9f9f9f9f9f";
const OTHER_ORG_MANAGER_PROFILE_ID = "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1";
const MANAGE_ONLY_PROFILE_ID = "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2";
const EMPTY_PROFILE_ID = "c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3";

const FIXED_NOW = new Date("2026-08-23T12:00:00.000Z");
const FIXED_PAST = new Date("2026-08-01T12:00:00.000Z");
const FIXED_FUTURE = new Date("2026-09-01T12:00:00.000Z");
const OTHER_FUTURE = new Date("2026-09-15T09:30:00.000Z");
const SEED_EARLIER = new Date("2026-08-18T10:00:00.000Z");
const SEED_LATER = new Date("2026-08-19T10:00:00.000Z");

const LINK_A1 = "11111111-1111-4111-8111-111111111111";
const LINK_A2 = "22222222-2222-4222-8222-222222222222";
const LINK_B1 = "33333333-3333-4333-8333-333333333333";
const MISSING_LINK_ID = "00000000-0000-4000-8000-000000000000";

type FakeAuditRow = AuditEventInput;

/**
 * In-memory AccessLinkStore with real rollback semantics: `transaction`
 * snapshots links and audit rows and restores them when the callback
 * rejects, so a failed transaction leaves no partial state behind.
 */
class FakeAccessLinkStore implements AccessLinkStore {
  readonly links = new Map<string, AccessLinkRecord>();
  readonly audits: FakeAuditRow[] = [];
  /** When set, every insert call rejects with this error (on demand). */
  insertFailure?: Error;
  /** When set, every replaceToken call rejects with this error (on demand). */
  replaceTokenFailure?: Error;
  private idCounter = 0;

  private nextId(): string {
    this.idCounter += 1;
    return `00000000-0000-4000-8000-${String(this.idCounter).padStart(12, "0")}`;
  }

  seed(data: {
    id: string;
    organizationId: string;
    createdById?: string;
    label?: string;
    audience?: string;
    expiresAt?: Date | null;
    revokedAt?: Date | null;
    pausedAt?: Date | null;
    createdAt?: Date;
  }): AccessLinkRecord {
    const createdAt = data.createdAt ?? SEED_EARLIER;
    const record: AccessLinkRecord = {
      id: data.id,
      organizationId: data.organizationId,
      createdById: data.createdById ?? MANAGER_PROFILE_ID,
      label: data.label ?? "Seeded link",
      audience: data.audience ?? "Seeded audience",
      tokenHash: hashToken(`seed-token-${data.id}`),
      expiresAt: data.expiresAt ?? null,
      revokedAt: data.revokedAt ?? null,
      pausedAt: data.pausedAt ?? null,
      createdAt,
      updatedAt: createdAt,
    };
    this.links.set(record.id, record);
    return structuredClone(record);
  }

  async findById(id: string): Promise<AccessLinkRecord | null> {
    const record = this.links.get(id);
    return record === undefined ? null : structuredClone(record);
  }

  async findByTokenHash(tokenHash: string): Promise<AccessLinkRecord | null> {
    for (const record of this.links.values()) {
      if (record.tokenHash === tokenHash) return structuredClone(record);
    }
    return null;
  }

  async listByOrganizationIds(
    organizationIds: string[],
  ): Promise<AccessLinkRecord[]> {
    const wanted = new Set(organizationIds);
    return [...this.links.values()]
      .filter((link) => wanted.has(link.organizationId))
      .sort(byListOrder)
      .map((link) => structuredClone(link));
  }

  async listAll(): Promise<AccessLinkRecord[]> {
    return [...this.links.values()]
      .sort(byListOrder)
      .map((link) => structuredClone(link));
  }

  async insert(data: {
    organizationId: string;
    createdById: string;
    label: string;
    audience: string;
    tokenHash: string;
    expiresAt: Date | null;
    pausedAt?: Date | null;
    id?: string;
    now: Date;
  }): Promise<AccessLinkRecord> {
    if (this.insertFailure !== undefined) {
      throw this.insertFailure;
    }
    const record: AccessLinkRecord = {
      id: data.id ?? this.nextId(),
      organizationId: data.organizationId,
      createdById: data.createdById,
      label: data.label,
      audience: data.audience,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      revokedAt: null,
      pausedAt: data.pausedAt ?? null,
      createdAt: data.now,
      updatedAt: data.now,
    };
    this.links.set(record.id, record);
    return structuredClone(record);
  }

  async revoke(id: string, now: Date): Promise<void> {
    const record = this.links.get(id);
    if (record === undefined) {
      throw new Error(`FakeAccessLinkStore: missing link ${id}`);
    }
    if (record.revokedAt !== null) {
      throw new HttpError(
        409,
        "CONFLICT",
        "The access link has already been revoked.",
      );
    }
    this.links.set(id, { ...record, revokedAt: now, updatedAt: now });
  }

  async replaceToken(
    id: string,
    data: { tokenHash: string; expiresAt: Date | null },
    now: Date,
  ): Promise<void> {
    if (this.replaceTokenFailure !== undefined) {
      throw this.replaceTokenFailure;
    }
    const record = this.links.get(id);
    if (record === undefined) {
      throw new Error(`FakeAccessLinkStore: missing link ${id}`);
    }
    if (record.revokedAt !== null) {
      throw new HttpError(
        409,
        "CONFLICT",
        "The access link has already been revoked.",
      );
    }
    // Same row, same id: only the digest and expiry change.
    this.links.set(id, {
      ...record,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      updatedAt: now,
    });
  }

  async pause(id: string, now: Date): Promise<void> {
    const record = this.links.get(id);
    if (record === undefined) {
      throw new Error(`FakeAccessLinkStore: missing link ${id}`);
    }
    if (record.revokedAt !== null) {
      throw new HttpError(
        409,
        "CONFLICT",
        "The access link has already been revoked.",
      );
    }
    this.links.set(id, { ...record, pausedAt: now, updatedAt: now });
  }

  async resume(id: string, now: Date): Promise<void> {
    const record = this.links.get(id);
    if (record === undefined) {
      throw new Error(`FakeAccessLinkStore: missing link ${id}`);
    }
    if (record.revokedAt !== null) {
      throw new HttpError(
        409,
        "CONFLICT",
        "The access link has already been revoked.",
      );
    }
    this.links.set(id, { ...record, pausedAt: null, updatedAt: now });
  }

  async setExpiry(
    id: string,
    expiresAt: Date | null,
    now: Date,
  ): Promise<void> {
    const record = this.links.get(id);
    if (record === undefined) {
      throw new Error(`FakeAccessLinkStore: missing link ${id}`);
    }
    if (record.revokedAt !== null) {
      throw new HttpError(
        409,
        "CONFLICT",
        "The access link has already been revoked.",
      );
    }
    this.links.set(id, { ...record, expiresAt, updatedAt: now });
  }

  async updateMetadata(
    id: string,
    data: { label?: string; audience?: string; expiresAt?: Date | null },
    now: Date,
  ): Promise<void> {
    const record = this.links.get(id);
    if (record === undefined) {
      throw new Error(`FakeAccessLinkStore: missing link ${id}`);
    }
    if (record.revokedAt !== null) {
      throw new HttpError(
        409,
        "CONFLICT",
        "The access link has already been revoked.",
      );
    }
    this.links.set(id, {
      ...record,
      ...(data.label !== undefined ? { label: data.label } : {}),
      ...(data.audience !== undefined ? { audience: data.audience } : {}),
      ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt } : {}),
      updatedAt: now,
    });
  }

  async recordAudit(event: AuditEventInput): Promise<void> {
    this.audits.push({ ...event });
  }

  async transaction<T>(fn: (tx: AccessLinkStore) => Promise<T>): Promise<T> {
    const linksSnapshot = structuredClone([...this.links.entries()]);
    const auditsSnapshot = structuredClone(this.audits);
    try {
      return await fn(this.txView());
    } catch (error) {
      this.links.clear();
      for (const [id, link] of linksSnapshot) {
        this.links.set(id, link);
      }
      this.audits.length = 0;
      this.audits.push(...auditsSnapshot);
      throw error;
    }
  }

  /** Store view handed to transaction callbacks; rejects nesting. */
  private txView(): AccessLinkStore {
    return {
      findById: (id) => this.findById(id),
      findByTokenHash: (hash) => this.findByTokenHash(hash),
      listByOrganizationIds: (ids) => this.listByOrganizationIds(ids),
      listAll: () => this.listAll(),
      insert: (data) => this.insert(data),
      revoke: (id, now) => this.revoke(id, now),
      replaceToken: (id, data, now) => this.replaceToken(id, data, now),
      pause: (id, now) => this.pause(id, now),
      resume: (id, now) => this.resume(id, now),
      setExpiry: (id, expiresAt, now) => this.setExpiry(id, expiresAt, now),
      updateMetadata: (id, data, now) => this.updateMetadata(id, data, now),
      recordAudit: (event) => this.recordAudit(event),
      transaction: () => {
        throw new Error("Nested transactions are not supported.");
      },
    };
  }
}

/** Same ordering contract as the Prisma adapter: createdAt desc, then id. */
function byListOrder(a: AccessLinkRecord, b: AccessLinkRecord): number {
  const byCreated = b.createdAt.getTime() - a.createdAt.getTime();
  if (byCreated !== 0) {
    return byCreated;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

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

function assignment(options: {
  capability: Capability;
  scopeOrganizationId: string | null;
  membershipOrganizationId: string;
}): CapabilityAssignmentRecord {
  return {
    capability: options.capability,
    scopeOrganizationId: options.scopeOrganizationId,
    membership: {
      status: RecordStatus.ACTIVE,
      organizationId: options.membershipOrganizationId,
    },
  };
}

function makeAuthorizationService(): AuthorizationService {
  return new AuthorizationService(
    fakeReader({
      [MANAGER_PROFILE_ID]: {
        status: RecordStatus.ACTIVE,
        assignments: [
          assignment({
            capability: Capability.LINK_VIEW,
            scopeOrganizationId: ORG_A,
            membershipOrganizationId: ORG_A,
          }),
          assignment({
            capability: Capability.LINK_MANAGE,
            scopeOrganizationId: ORG_A,
            membershipOrganizationId: ORG_A,
          }),
        ],
      },
      [PLATFORM_PROFILE_ID]: {
        status: RecordStatus.ACTIVE,
        assignments: [
          assignment({
            capability: Capability.LINK_VIEW,
            scopeOrganizationId: null,
            membershipOrganizationId: ORG_A,
          }),
          assignment({
            capability: Capability.LINK_MANAGE,
            scopeOrganizationId: null,
            membershipOrganizationId: ORG_A,
          }),
        ],
      },
      [VIEWER_PROFILE_ID]: {
        status: RecordStatus.ACTIVE,
        assignments: [
          assignment({
            capability: Capability.LINK_VIEW,
            scopeOrganizationId: ORG_A,
            membershipOrganizationId: ORG_A,
          }),
        ],
      },
      [OTHER_ORG_MANAGER_PROFILE_ID]: {
        status: RecordStatus.ACTIVE,
        assignments: [
          assignment({
            capability: Capability.LINK_VIEW,
            scopeOrganizationId: ORG_B,
            membershipOrganizationId: ORG_B,
          }),
          assignment({
            capability: Capability.LINK_MANAGE,
            scopeOrganizationId: ORG_B,
            membershipOrganizationId: ORG_B,
          }),
        ],
      },
      [MANAGE_ONLY_PROFILE_ID]: {
        status: RecordStatus.ACTIVE,
        assignments: [
          assignment({
            capability: Capability.LINK_MANAGE,
            scopeOrganizationId: ORG_A,
            membershipOrganizationId: ORG_A,
          }),
        ],
      },
      [EMPTY_PROFILE_ID]: {
        status: RecordStatus.ACTIVE,
        assignments: [],
      },
    }),
  );
}

function actorFor(profileId: string): PortalActor {
  return {
    profileId,
    authUserId: `auth-${profileId}`,
    displayName: "Test Actor",
    email: "actor@example.com",
  };
}

/** Deterministic, valid-format (43-char base64url) token factory. */
function makeDeterministicTokenFactory(): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `t${String(counter).padStart(4, "0")}`.padEnd(43, "x");
  };
}

function createHarness(): {
  service: AccessLinkService;
  store: FakeAccessLinkStore;
} {
  const store = new FakeAccessLinkStore();
  const service = new AccessLinkService({
    store,
    authorization: makeAuthorizationService(),
    clock: { now: () => new Date(FIXED_NOW.getTime()) },
    tokenFactory: makeDeterministicTokenFactory(),
  });
  return { service, store };
}

/** True when `needle` appears anywhere in the JSON structure of `value`. */
function deepContains(value: unknown, needle: string): boolean {
  if (typeof value === "string") {
    return value.includes(needle);
  }
  if (Array.isArray(value)) {
    return value.some((item) => deepContains(item, needle));
  }
  if (value !== null && typeof value === "object") {
    return Object.values(value).some((item) => deepContains(item, needle));
  }
  return false;
}

/** Proves an audit row carries no token material: no raw token, no digest. */
function expectNoTokenMaterial(event: FakeAuditRow, token: string): void {
  expect(deepContains(event, token)).toBe(false);
  expect(deepContains(event, hashToken(token))).toBe(false);
}

async function expectHttpError(
  promise: Promise<unknown>,
  status: number,
  code: string,
): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(HttpError);
  await expect(promise).rejects.toMatchObject({ status, code });
}

describe("AccessLinkService.createAccessLink", () => {
  it("creates a non-expiring link, persists only the digest, and returns the raw token exactly once", async () => {
    const { service, store } = createHarness();

    const { link, token } = await service.createAccessLink(
      actorFor(MANAGER_PROFILE_ID),
      { organizationId: ORG_A, label: "Class 5-A", audience: "Students" },
    );

    // Deterministic factory token, returned to the caller only.
    expect(token).toBe(`t${String(1).padStart(4, "0")}`.padEnd(43, "x"));
    expect(link.tokenHash).toBe(hashToken(token));
    expect(link.tokenHash).not.toBe(token);
    expect(link.expiresAt).toBeNull();
    expect(link.revokedAt).toBeNull();
    expect(link.organizationId).toBe(ORG_A);
    expect(link.createdById).toBe(MANAGER_PROFILE_ID);
    expect(link.label).toBe("Class 5-A");
    expect(link.audience).toBe("Students");
    expect(link.createdAt).toEqual(FIXED_NOW);

    // The store holds exactly one row and never the raw token.
    expect(store.links.size).toBe(1);
    expect(store.links.get(link.id)?.tokenHash).toBe(hashToken(token));
    expect(deepContains([...store.links.values()], token)).toBe(false);

    // One audit row without token material.
    expect(store.audits).toHaveLength(1);
    const audit = store.audits[0]!;
    expect(audit).toMatchObject({
      actorId: MANAGER_PROFILE_ID,
      action: "access_link.created",
      entityType: "access_link",
      entityId: link.id,
      after: { label: "Class 5-A", audience: "Students", expiresAt: null },
    });
    expect(audit.before).toBeUndefined();
    expect(audit.reason).toBeUndefined();
    expectNoTokenMaterial(audit, token);
  });

  it("trims label and audience and audits a future expiry as ISO", async () => {
    const { service, store } = createHarness();

    const { link } = await service.createAccessLink(
      actorFor(MANAGER_PROFILE_ID),
      {
        organizationId: ORG_A,
        label: "  Class 5-A  ",
        audience: "  Students  ",
        expiresAt: FIXED_FUTURE,
      },
    );

    expect(link.label).toBe("Class 5-A");
    expect(link.audience).toBe("Students");
    expect(link.expiresAt).toEqual(FIXED_FUTURE);
    expect(store.audits[0]?.after).toEqual({
      label: "Class 5-A",
      audience: "Students",
      expiresAt: FIXED_FUTURE.toISOString(),
    });
  });

  it("treats an explicit null expiry as non-expiring", async () => {
    const { service, store } = createHarness();

    const { link } = await service.createAccessLink(
      actorFor(MANAGER_PROFILE_ID),
      {
        organizationId: ORG_A,
        label: "Class 5-A",
        audience: "Students",
        expiresAt: null,
      },
    );

    expect(link.expiresAt).toBeNull();
    expect(store.audits[0]?.after).toMatchObject({ expiresAt: null });
  });

  it("propagates the correlationId into the audit row", async () => {
    const { service, store } = createHarness();
    const correlationId = "5d5d5d5d-5d5d-4d5d-8d5d-5d5d5d5d5d5d";

    await service.createAccessLink(
      actorFor(MANAGER_PROFILE_ID),
      { organizationId: ORG_A, label: "Class 5-A", audience: "Students" },
      correlationId,
    );

    expect(store.audits[0]?.correlationId).toBe(correlationId);
  });

  it("denies creation without LINK_MANAGE and persists nothing", async () => {
    const { service, store } = createHarness();

    await expectHttpError(
      service.createAccessLink(actorFor(VIEWER_PROFILE_ID), {
        organizationId: ORG_A,
        label: "Class 5-A",
        audience: "Students",
      }),
      403,
      "FORBIDDEN",
    );
    await expectHttpError(
      service.createAccessLink(actorFor(EMPTY_PROFILE_ID), {
        organizationId: ORG_A,
        label: "Class 5-A",
        audience: "Students",
      }),
      403,
      "FORBIDDEN",
    );

    expect(store.links.size).toBe(0);
    expect(store.audits).toHaveLength(0);
  });

  it("denies creation in an organization outside the actor scope", async () => {
    const { service, store } = createHarness();

    await expectHttpError(
      service.createAccessLink(actorFor(MANAGER_PROFILE_ID), {
        organizationId: ORG_B,
        label: "Class 5-A",
        audience: "Students",
      }),
      403,
      "FORBIDDEN",
    );

    expect(store.links.size).toBe(0);
  });

  it("rejects an empty or whitespace label", async () => {
    const { service, store } = createHarness();

    await expectHttpError(
      service.createAccessLink(actorFor(MANAGER_PROFILE_ID), {
        organizationId: ORG_A,
        label: "",
        audience: "Students",
      }),
      400,
      "VALIDATION_FAILED",
    );
    await expect(
      service.createAccessLink(actorFor(MANAGER_PROFILE_ID), {
        organizationId: ORG_A,
        label: "   ",
        audience: "Students",
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_FAILED",
      details: [{ path: "label" }],
    });

    expect(store.links.size).toBe(0);
  });

  it("rejects a label or audience longer than 200 characters", async () => {
    const { service, store } = createHarness();
    const tooLong = "a".repeat(201);

    await expect(
      service.createAccessLink(actorFor(MANAGER_PROFILE_ID), {
        organizationId: ORG_A,
        label: tooLong,
        audience: "Students",
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_FAILED",
      details: [{ path: "label" }],
    });
    await expect(
      service.createAccessLink(actorFor(MANAGER_PROFILE_ID), {
        organizationId: ORG_A,
        label: "Class 5-A",
        audience: tooLong,
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_FAILED",
      details: [{ path: "audience" }],
    });

    expect(store.links.size).toBe(0);
  });

  it("rejects an empty audience", async () => {
    const { service, store } = createHarness();

    await expect(
      service.createAccessLink(actorFor(MANAGER_PROFILE_ID), {
        organizationId: ORG_A,
        label: "Class 5-A",
        audience: "   ",
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_FAILED",
      details: [{ path: "audience" }],
    });

    expect(store.links.size).toBe(0);
  });

  it("rejects a past or current expiry", async () => {
    const { service, store } = createHarness();

    await expectHttpError(
      service.createAccessLink(actorFor(MANAGER_PROFILE_ID), {
        organizationId: ORG_A,
        label: "Class 5-A",
        audience: "Students",
        expiresAt: FIXED_PAST,
      }),
      400,
      "VALIDATION_FAILED",
    );
    await expectHttpError(
      service.createAccessLink(actorFor(MANAGER_PROFILE_ID), {
        organizationId: ORG_A,
        label: "Class 5-A",
        audience: "Students",
        expiresAt: FIXED_NOW,
      }),
      400,
      "VALIDATION_FAILED",
    );

    expect(store.links.size).toBe(0);
    expect(store.audits).toHaveLength(0);
  });
});

describe("AccessLinkService.rotateAccessLink", () => {
  it("replaces the token on the SAME row, atomically with one audit row", async () => {
    const { service, store } = createHarness();
    const seeded = store.seed({ id: LINK_A1, organizationId: ORG_A });
    const oldTokenHash = seeded.tokenHash;

    const { link, token } = await service.rotateAccessLink(
      actorFor(MANAGER_PROFILE_ID),
      LINK_A1,
      {},
    );

    // Rotation preserves the link id: exactly one row remains and it keeps
    // its identity, creation metadata and active status.
    expect(store.links.size).toBe(1);
    expect(link.id).toBe(LINK_A1);
    const rotated = store.links.get(LINK_A1)!;
    expect(rotated.id).toBe(LINK_A1);
    expect(rotated.organizationId).toBe(ORG_A);
    expect(rotated.label).toBe("Seeded link");
    expect(rotated.audience).toBe("Seeded audience");
    expect(rotated.createdById).toBe(MANAGER_PROFILE_ID);
    expect(rotated.createdAt).toEqual(SEED_EARLIER);
    expect(rotated.revokedAt).toBeNull();
    expect(rotated.expiresAt).toBeNull();

    // The token digest changed on that same row; the old digest no longer
    // resolves anywhere.
    expect(rotated.tokenHash).toBe(hashToken(token));
    expect(rotated.tokenHash).not.toBe(oldTokenHash);
    expect(await store.findByTokenHash(oldTokenHash)).toBeNull();

    // One audit row anchored to the SAME entity id.
    expect(store.audits).toHaveLength(1);
    const audit = store.audits[0]!;
    expect(audit).toMatchObject({
      actorId: MANAGER_PROFILE_ID,
      action: "access_link.rotated",
      entityType: "access_link",
      entityId: LINK_A1,
      before: { previousExpiresAt: null },
      after: {
        label: "Seeded link",
        audience: "Seeded audience",
        expiresAt: null,
      },
    });
    expectNoTokenMaterial(audit, token);
  });

  it("store-level replaceToken refuses to mutate a revoked link", async () => {
    const store = new FakeAccessLinkStore();
    store.seed({
      id: LINK_A1,
      organizationId: ORG_A,
      revokedAt: FIXED_PAST,
    });

    await expectHttpError(
      store.replaceToken(
        LINK_A1,
        { tokenHash: hashToken("t0001".padEnd(43, "x")), expiresAt: null },
        FIXED_NOW,
      ),
      409,
      "CONFLICT",
    );
  });

  it("keeps the previous expiry when expiresAt is undefined", async () => {
    const { service, store } = createHarness();
    store.seed({ id: LINK_A1, organizationId: ORG_A, expiresAt: FIXED_FUTURE });

    const { link } = await service.rotateAccessLink(
      actorFor(MANAGER_PROFILE_ID),
      LINK_A1,
      {},
    );

    expect(link.expiresAt).toEqual(FIXED_FUTURE);
    expect(store.audits[0]?.before).toEqual({
      previousExpiresAt: FIXED_FUTURE.toISOString(),
    });
    expect(store.audits[0]?.after).toMatchObject({
      expiresAt: FIXED_FUTURE.toISOString(),
    });
  });

  it("clears the expiry when expiresAt is null", async () => {
    const { service, store } = createHarness();
    store.seed({ id: LINK_A1, organizationId: ORG_A, expiresAt: FIXED_FUTURE });

    const { link } = await service.rotateAccessLink(
      actorFor(MANAGER_PROFILE_ID),
      LINK_A1,
      { expiresAt: null },
    );

    expect(link.expiresAt).toBeNull();
    expect(store.audits[0]?.after).toMatchObject({ expiresAt: null });
  });

  it("sets a new future expiry when a Date is provided", async () => {
    const { service, store } = createHarness();
    store.seed({ id: LINK_A1, organizationId: ORG_A, expiresAt: FIXED_FUTURE });

    const { link } = await service.rotateAccessLink(
      actorFor(MANAGER_PROFILE_ID),
      LINK_A1,
      { expiresAt: OTHER_FUTURE },
    );

    expect(link.expiresAt).toEqual(OTHER_FUTURE);
    expect(store.audits[0]?.after).toMatchObject({
      expiresAt: OTHER_FUTURE.toISOString(),
    });
  });

  it("returns 404 for a missing link, before authorization", async () => {
    const { service, store } = createHarness();

    await expectHttpError(
      service.rotateAccessLink(
        actorFor(MANAGER_PROFILE_ID),
        MISSING_LINK_ID,
        {},
      ),
      404,
      "RESOURCE_NOT_FOUND",
    );
    // Even an actor with no capabilities at all sees 404, not 403.
    await expectHttpError(
      service.rotateAccessLink(actorFor(EMPTY_PROFILE_ID), MISSING_LINK_ID, {}),
      404,
      "RESOURCE_NOT_FOUND",
    );

    expect(store.links.size).toBe(0);
    expect(store.audits).toHaveLength(0);
  });

  it("returns 409 when the link is already revoked, without side effects", async () => {
    const { service, store } = createHarness();
    store.seed({
      id: LINK_A1,
      organizationId: ORG_A,
      revokedAt: FIXED_PAST,
    });

    await expectHttpError(
      service.rotateAccessLink(actorFor(MANAGER_PROFILE_ID), LINK_A1, {}),
      409,
      "CONFLICT",
    );

    expect(store.links.size).toBe(1);
    expect(store.audits).toHaveLength(0);
  });

  it("denies rotation in an organization outside the actor scope", async () => {
    const { service, store } = createHarness();
    store.seed({ id: LINK_A1, organizationId: ORG_A });

    await expectHttpError(
      service.rotateAccessLink(
        actorFor(OTHER_ORG_MANAGER_PROFILE_ID),
        LINK_A1,
        {},
      ),
      403,
      "FORBIDDEN",
    );

    expect(store.links.get(LINK_A1)?.revokedAt).toBeNull();
    expect(store.audits).toHaveLength(0);
  });

  it("rolls back the token swap and audit when the update fails", async () => {
    const { service, store } = createHarness();
    const seeded = store.seed({ id: LINK_A1, organizationId: ORG_A });
    const replaceFailure = new Error("simulated replaceToken failure");
    store.replaceTokenFailure = replaceFailure;

    await expect(
      service.rotateAccessLink(actorFor(MANAGER_PROFILE_ID), LINK_A1, {}),
    ).rejects.toBe(replaceFailure);

    // The link keeps its old digest and nothing was audited.
    expect(store.links.size).toBe(1);
    expect(store.links.get(LINK_A1)?.tokenHash).toBe(seeded.tokenHash);
    expect(store.audits).toHaveLength(0);

    // The failure is on demand: clearing it lets rotation succeed on the
    // same row.
    store.replaceTokenFailure = undefined;
    const { link, token } = await service.rotateAccessLink(
      actorFor(MANAGER_PROFILE_ID),
      LINK_A1,
      {},
    );
    expect(link.id).toBe(LINK_A1);
    expect(store.links.get(LINK_A1)?.tokenHash).toBe(hashToken(token));
    expect(store.audits).toHaveLength(1);
    expect(store.audits[0]?.entityId).toBe(LINK_A1);
  });

  it("rejects a past replacement expiry without mutating anything", async () => {
    const { service, store } = createHarness();
    store.seed({ id: LINK_A1, organizationId: ORG_A });

    await expectHttpError(
      service.rotateAccessLink(actorFor(MANAGER_PROFILE_ID), LINK_A1, {
        expiresAt: FIXED_PAST,
      }),
      400,
      "VALIDATION_FAILED",
    );

    expect(store.links.get(LINK_A1)?.revokedAt).toBeNull();
    expect(store.links.size).toBe(1);
    expect(store.audits).toHaveLength(0);
  });
});

describe("AccessLinkService.revokeAccessLink", () => {
  it("revokes and audits a trimmed reason", async () => {
    const { service, store } = createHarness();
    store.seed({ id: LINK_A1, organizationId: ORG_A });

    await service.revokeAccessLink(
      actorFor(MANAGER_PROFILE_ID),
      LINK_A1,
      "  classroom finished  ",
      "6e6e6e6e-6e6e-4e6e-8e6e-6e6e6e6e6e6e",
    );

    expect(store.links.get(LINK_A1)?.revokedAt).toEqual(FIXED_NOW);
    expect(store.audits).toHaveLength(1);
    expect(store.audits[0]).toMatchObject({
      actorId: MANAGER_PROFILE_ID,
      action: "access_link.revoked",
      entityType: "access_link",
      entityId: LINK_A1,
      reason: "classroom finished",
      correlationId: "6e6e6e6e-6e6e-4e6e-8e6e-6e6e6e6e6e6e",
    });
  });

  it("revokes without a reason and omits it from the audit row", async () => {
    const { service, store } = createHarness();
    store.seed({ id: LINK_A1, organizationId: ORG_A });

    await service.revokeAccessLink(actorFor(MANAGER_PROFILE_ID), LINK_A1);

    expect(store.links.get(LINK_A1)?.revokedAt).toEqual(FIXED_NOW);
    expect(store.audits[0]?.reason).toBeUndefined();
  });

  it("returns 404 for a missing link", async () => {
    const { service, store } = createHarness();

    await expectHttpError(
      service.revokeAccessLink(actorFor(MANAGER_PROFILE_ID), MISSING_LINK_ID),
      404,
      "RESOURCE_NOT_FOUND",
    );
    expect(store.audits).toHaveLength(0);
  });

  it("returns 409 on double revoke", async () => {
    const { service, store } = createHarness();
    store.seed({
      id: LINK_A1,
      organizationId: ORG_A,
      revokedAt: FIXED_PAST,
    });

    await expectHttpError(
      service.revokeAccessLink(actorFor(MANAGER_PROFILE_ID), LINK_A1),
      409,
      "CONFLICT",
    );
    expect(store.audits).toHaveLength(0);
  });

  it("rejects an empty or oversized reason", async () => {
    const { service, store } = createHarness();
    store.seed({ id: LINK_A1, organizationId: ORG_A });

    await expect(
      service.revokeAccessLink(actorFor(MANAGER_PROFILE_ID), LINK_A1, "   "),
    ).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_FAILED",
      details: [{ path: "reason" }],
    });
    await expect(
      service.revokeAccessLink(
        actorFor(MANAGER_PROFILE_ID),
        LINK_A1,
        "r".repeat(501),
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_FAILED",
      details: [{ path: "reason" }],
    });

    expect(store.links.get(LINK_A1)?.revokedAt).toBeNull();
    expect(store.audits).toHaveLength(0);
  });

  it("denies revocation without LINK_MANAGE", async () => {
    const { service, store } = createHarness();
    store.seed({ id: LINK_A1, organizationId: ORG_A });

    await expectHttpError(
      service.revokeAccessLink(actorFor(VIEWER_PROFILE_ID), LINK_A1),
      403,
      "FORBIDDEN",
    );
    await expectHttpError(
      service.revokeAccessLink(actorFor(OTHER_ORG_MANAGER_PROFILE_ID), LINK_A1),
      403,
      "FORBIDDEN",
    );

    expect(store.links.get(LINK_A1)?.revokedAt).toBeNull();
    expect(store.audits).toHaveLength(0);
  });
});

describe("AccessLinkService.pauseAccessLink", () => {
  it("pauses without changing the token and audits pausedAt null → timestamp", async () => {
    const { service, store } = createHarness();
    const seeded = store.seed({ id: LINK_A1, organizationId: ORG_A });

    await service.pauseAccessLink(
      actorFor(MANAGER_PROFILE_ID),
      LINK_A1,
      "  recess until friday  ",
      "7f7f7f7f-7f7f-4f7f-8f7f-7f7f7f7f7f7f",
    );

    const paused = store.links.get(LINK_A1)!;
    expect(paused.pausedAt).toEqual(FIXED_NOW);
    // Pausing keeps the same secret: the digest is untouched.
    expect(paused.tokenHash).toBe(seeded.tokenHash);
    expect(paused.revokedAt).toBeNull();

    expect(store.audits).toHaveLength(1);
    expect(store.audits[0]).toMatchObject({
      actorId: MANAGER_PROFILE_ID,
      action: "access_link.paused",
      entityType: "access_link",
      entityId: LINK_A1,
      before: { pausedAt: null },
      after: { pausedAt: FIXED_NOW.toISOString() },
      reason: "recess until friday",
      correlationId: "7f7f7f7f-7f7f-4f7f-8f7f-7f7f7f7f7f7f",
    });
  });

  it("pauses without a reason and omits it from the audit row", async () => {
    const { service, store } = createHarness();
    store.seed({ id: LINK_A1, organizationId: ORG_A });

    await service.pauseAccessLink(actorFor(MANAGER_PROFILE_ID), LINK_A1);

    expect(store.links.get(LINK_A1)?.pausedAt).toEqual(FIXED_NOW);
    expect(store.audits[0]?.reason).toBeUndefined();
  });

  it("scrubs a pasted raw token out of the audited reason", async () => {
    const { service, store } = createHarness();
    store.seed({ id: LINK_A1, organizationId: ORG_A });
    // A full raw access-link token pasted into the free-text reason.
    const pastedToken = "t4242".padEnd(43, "x");

    await service.pauseAccessLink(
      actorFor(MANAGER_PROFILE_ID),
      LINK_A1,
      `Pausado após vazamento do token ${pastedToken}`,
    );

    expect(store.audits).toHaveLength(1);
    const audit = store.audits[0]!;
    expect(audit.reason).toBe("Pausado após vazamento do token [redacted]");
    // The secret never reaches the persisted audit payload verbatim.
    expect(deepContains(audit, pastedToken)).toBe(false);
    expect(deepContains(audit, hashToken(pastedToken))).toBe(false);
  });

  it("scrubs a pasted raw token out of a revoke reason too", async () => {
    const { service, store } = createHarness();
    store.seed({ id: LINK_A1, organizationId: ORG_A });
    const pastedToken = "r1337".padEnd(43, "x");

    await service.revokeAccessLink(
      actorFor(MANAGER_PROFILE_ID),
      LINK_A1,
      `Encerrado após vazamento do token ${pastedToken}`,
    );

    expect(store.audits).toHaveLength(1);
    const audit = store.audits[0]!;
    expect(audit.reason).toBe("Encerrado após vazamento do token [redacted]");
    expect(deepContains(audit, pastedToken)).toBe(false);
    expect(deepContains(audit, hashToken(pastedToken))).toBe(false);
  });

  it("rejects an empty or oversized reason", async () => {
    const { service, store } = createHarness();
    store.seed({ id: LINK_A1, organizationId: ORG_A });

    await expect(
      service.pauseAccessLink(actorFor(MANAGER_PROFILE_ID), LINK_A1, "   "),
    ).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_FAILED",
      details: [{ path: "reason" }],
    });
    await expect(
      service.pauseAccessLink(
        actorFor(MANAGER_PROFILE_ID),
        LINK_A1,
        "r".repeat(501),
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_FAILED",
      details: [{ path: "reason" }],
    });

    expect(store.links.get(LINK_A1)?.pausedAt).toBeNull();
    expect(store.audits).toHaveLength(0);
  });

  it("returns 404 for a missing link, before authorization", async () => {
    const { service, store } = createHarness();

    await expectHttpError(
      service.pauseAccessLink(actorFor(MANAGER_PROFILE_ID), MISSING_LINK_ID),
      404,
      "RESOURCE_NOT_FOUND",
    );
    // Even an actor with no capabilities at all sees 404, not 403.
    await expectHttpError(
      service.pauseAccessLink(actorFor(EMPTY_PROFILE_ID), MISSING_LINK_ID),
      404,
      "RESOURCE_NOT_FOUND",
    );

    expect(store.links.size).toBe(0);
    expect(store.audits).toHaveLength(0);
  });

  it("returns 409 when the link is already revoked", async () => {
    const { service, store } = createHarness();
    store.seed({
      id: LINK_A1,
      organizationId: ORG_A,
      revokedAt: FIXED_PAST,
    });

    await expectHttpError(
      service.pauseAccessLink(actorFor(MANAGER_PROFILE_ID), LINK_A1),
      409,
      "CONFLICT",
    );
    expect(store.audits).toHaveLength(0);
  });

  it("denies pausing without LINK_MANAGE", async () => {
    const { service, store } = createHarness();
    store.seed({ id: LINK_A1, organizationId: ORG_A });

    await expectHttpError(
      service.pauseAccessLink(actorFor(VIEWER_PROFILE_ID), LINK_A1),
      403,
      "FORBIDDEN",
    );
    await expectHttpError(
      service.pauseAccessLink(actorFor(OTHER_ORG_MANAGER_PROFILE_ID), LINK_A1),
      403,
      "FORBIDDEN",
    );

    expect(store.links.get(LINK_A1)?.pausedAt).toBeNull();
    expect(store.audits).toHaveLength(0);
  });
});

describe("AccessLinkService.resumeAccessLink", () => {
  it("clears pausedAt on a paused link and audits the transition", async () => {
    const { service, store } = createHarness();
    store.seed({
      id: LINK_A1,
      organizationId: ORG_A,
      pausedAt: FIXED_PAST,
    });

    await service.resumeAccessLink(
      actorFor(MANAGER_PROFILE_ID),
      LINK_A1,
      "8a8a8a8a-8a8a-4a8a-8a8a-8a8a8a8a8a8a",
    );

    expect(store.links.get(LINK_A1)?.pausedAt).toBeNull();
    expect(store.links.get(LINK_A1)?.revokedAt).toBeNull();
    expect(store.audits).toHaveLength(1);
    expect(store.audits[0]).toMatchObject({
      actorId: MANAGER_PROFILE_ID,
      action: "access_link.resumed",
      entityType: "access_link",
      entityId: LINK_A1,
      before: { pausedAt: FIXED_PAST.toISOString() },
      after: { pausedAt: null },
      correlationId: "8a8a8a8a-8a8a-4a8a-8a8a-8a8a8a8a8a8a",
    });
  });

  it("is a no-op without an audit row when the link is not paused", async () => {
    const { service, store } = createHarness();
    store.seed({ id: LINK_A1, organizationId: ORG_A });

    await service.resumeAccessLink(actorFor(MANAGER_PROFILE_ID), LINK_A1);

    expect(store.links.get(LINK_A1)?.pausedAt).toBeNull();
    expect(store.audits).toHaveLength(0);
  });

  it("returns 404 for a missing link and 409 for a revoked link", async () => {
    const { service, store } = createHarness();
    store.seed({
      id: LINK_A1,
      organizationId: ORG_A,
      revokedAt: FIXED_PAST,
    });

    await expectHttpError(
      service.resumeAccessLink(actorFor(MANAGER_PROFILE_ID), MISSING_LINK_ID),
      404,
      "RESOURCE_NOT_FOUND",
    );
    await expectHttpError(
      service.resumeAccessLink(actorFor(MANAGER_PROFILE_ID), LINK_A1),
      409,
      "CONFLICT",
    );
    expect(store.audits).toHaveLength(0);
  });

  it("denies resuming without LINK_MANAGE", async () => {
    const { service, store } = createHarness();
    store.seed({
      id: LINK_A1,
      organizationId: ORG_A,
      pausedAt: FIXED_PAST,
    });

    await expectHttpError(
      service.resumeAccessLink(actorFor(VIEWER_PROFILE_ID), LINK_A1),
      403,
      "FORBIDDEN",
    );

    expect(store.links.get(LINK_A1)?.pausedAt).toEqual(FIXED_PAST);
    expect(store.audits).toHaveLength(0);
  });
});

describe("AccessLinkService.setAccessLinkExpiry", () => {
  it("sets a future expiry and audits before/after expiry only", async () => {
    const { service, store } = createHarness();
    store.seed({ id: LINK_A1, organizationId: ORG_A });

    await service.setAccessLinkExpiry(
      actorFor(MANAGER_PROFILE_ID),
      LINK_A1,
      FIXED_FUTURE,
    );

    expect(store.links.get(LINK_A1)?.expiresAt).toEqual(FIXED_FUTURE);
    expect(store.audits).toHaveLength(1);
    const audit = store.audits[0]!;
    expect(audit).toMatchObject({
      action: "access_link.expiry_changed",
      entityId: LINK_A1,
      before: { expiresAt: null },
      after: { expiresAt: FIXED_FUTURE.toISOString() },
    });
    expect(Object.keys(audit.before as object)).toEqual(["expiresAt"]);
    expect(Object.keys(audit.after as object)).toEqual(["expiresAt"]);
  });

  it("clears the expiry with null", async () => {
    const { service, store } = createHarness();
    store.seed({ id: LINK_A1, organizationId: ORG_A, expiresAt: FIXED_FUTURE });

    await service.setAccessLinkExpiry(
      actorFor(MANAGER_PROFILE_ID),
      LINK_A1,
      null,
    );

    expect(store.links.get(LINK_A1)?.expiresAt).toBeNull();
    expect(store.audits[0]).toMatchObject({
      before: { expiresAt: FIXED_FUTURE.toISOString() },
      after: { expiresAt: null },
    });
  });

  it("rejects a past expiry", async () => {
    const { service, store } = createHarness();
    store.seed({ id: LINK_A1, organizationId: ORG_A, expiresAt: FIXED_FUTURE });

    await expectHttpError(
      service.setAccessLinkExpiry(
        actorFor(MANAGER_PROFILE_ID),
        LINK_A1,
        FIXED_PAST,
      ),
      400,
      "VALIDATION_FAILED",
    );

    expect(store.links.get(LINK_A1)?.expiresAt).toEqual(FIXED_FUTURE);
    expect(store.audits).toHaveLength(0);
  });

  it("returns 409 for a revoked link", async () => {
    const { service, store } = createHarness();
    store.seed({
      id: LINK_A1,
      organizationId: ORG_A,
      revokedAt: FIXED_PAST,
    });

    await expectHttpError(
      service.setAccessLinkExpiry(
        actorFor(MANAGER_PROFILE_ID),
        LINK_A1,
        FIXED_FUTURE,
      ),
      409,
      "CONFLICT",
    );
  });

  it("returns 404 for a missing link and 403 outside scope", async () => {
    const { service, store } = createHarness();
    store.seed({ id: LINK_A1, organizationId: ORG_A });

    await expectHttpError(
      service.setAccessLinkExpiry(
        actorFor(MANAGER_PROFILE_ID),
        MISSING_LINK_ID,
        FIXED_FUTURE,
      ),
      404,
      "RESOURCE_NOT_FOUND",
    );
    await expectHttpError(
      service.setAccessLinkExpiry(
        actorFor(OTHER_ORG_MANAGER_PROFILE_ID),
        LINK_A1,
        FIXED_FUTURE,
      ),
      403,
      "FORBIDDEN",
    );

    expect(store.audits).toHaveLength(0);
  });
});

describe("AccessLinkService.getAccessLink", () => {
  it("returns the link with LINK_VIEW on the link organization", async () => {
    const { service, store } = createHarness();
    store.seed({ id: LINK_A1, organizationId: ORG_A });

    const link = await service.getAccessLink(
      actorFor(VIEWER_PROFILE_ID),
      LINK_A1,
    );

    expect(link.id).toBe(LINK_A1);
    expect(link.tokenHash).toBe(hashToken(`seed-token-${LINK_A1}`));
  });

  it("returns 404 for a missing link, before authorization", async () => {
    const { service } = createHarness();

    await expectHttpError(
      service.getAccessLink(actorFor(MANAGER_PROFILE_ID), MISSING_LINK_ID),
      404,
      "RESOURCE_NOT_FOUND",
    );
    await expectHttpError(
      service.getAccessLink(actorFor(EMPTY_PROFILE_ID), MISSING_LINK_ID),
      404,
      "RESOURCE_NOT_FOUND",
    );
  });

  it("returns 403 for a link outside the actor scope", async () => {
    const { service, store } = createHarness();
    store.seed({ id: LINK_A1, organizationId: ORG_A });

    await expectHttpError(
      service.getAccessLink(actorFor(OTHER_ORG_MANAGER_PROFILE_ID), LINK_A1),
      403,
      "FORBIDDEN",
    );
  });

  it("requires LINK_VIEW: LINK_MANAGE alone does not grant reads", async () => {
    const { service, store } = createHarness();
    store.seed({ id: LINK_A1, organizationId: ORG_A });

    await expectHttpError(
      service.getAccessLink(actorFor(MANAGE_ONLY_PROFILE_ID), LINK_A1),
      403,
      "FORBIDDEN",
    );
  });
});

describe("AccessLinkService.listAccessLinks", () => {
  function seedOrganizations(store: FakeAccessLinkStore): void {
    store.seed({ id: LINK_A1, organizationId: ORG_A, createdAt: SEED_EARLIER });
    store.seed({ id: LINK_A2, organizationId: ORG_A, createdAt: SEED_LATER });
    store.seed({ id: LINK_B1, organizationId: ORG_B, createdAt: SEED_EARLIER });
  }

  it("limits an organization-scoped actor to its own organization, newest first", async () => {
    const { service, store } = createHarness();
    seedOrganizations(store);

    const links = await service.listAccessLinks(actorFor(VIEWER_PROFILE_ID));

    expect(links.map((link) => link.id)).toEqual([LINK_A2, LINK_A1]);
  });

  it("lets a platform actor list everything", async () => {
    const { service, store } = createHarness();
    seedOrganizations(store);

    const links = await service.listAccessLinks(actorFor(PLATFORM_PROFILE_ID));

    expect(links.map((link) => link.id)).toEqual([LINK_A2, LINK_A1, LINK_B1]);
  });

  it("filters by organizationId inside the actor scope", async () => {
    const { service, store } = createHarness();
    seedOrganizations(store);

    const viewerLinks = await service.listAccessLinks(
      actorFor(VIEWER_PROFILE_ID),
      ORG_A,
    );
    expect(viewerLinks.map((link) => link.id)).toEqual([LINK_A2, LINK_A1]);

    const platformLinks = await service.listAccessLinks(
      actorFor(PLATFORM_PROFILE_ID),
      ORG_B,
    );
    expect(platformLinks.map((link) => link.id)).toEqual([LINK_B1]);
  });

  it("rejects an organizationId outside the actor scope with FORBIDDEN", async () => {
    const { service, store } = createHarness();
    seedOrganizations(store);

    await expectHttpError(
      service.listAccessLinks(actorFor(VIEWER_PROFILE_ID), ORG_B),
      403,
      "FORBIDDEN",
    );
  });

  it("rejects listing without LINK_VIEW, even with LINK_MANAGE", async () => {
    const { service, store } = createHarness();
    seedOrganizations(store);

    await expectHttpError(
      service.listAccessLinks(actorFor(MANAGE_ONLY_PROFILE_ID)),
      403,
      "FORBIDDEN",
    );
    await expectHttpError(
      service.listAccessLinks(actorFor(EMPTY_PROFILE_ID)),
      403,
      "FORBIDDEN",
    );
  });
});

describe("resolvePublicLink", () => {
  /** Valid-format (43-char base64url) raw public token for the seeded hash. */
  const RAW_TOKEN = "t0001".padEnd(43, "x");

  function seedWithToken(
    store: FakeAccessLinkStore,
    data: {
      id: string;
      organizationId?: string;
      expiresAt?: Date | null;
      revokedAt?: Date | null;
      pausedAt?: Date | null;
    },
  ): void {
    const record = store.seed({
      id: data.id,
      organizationId: data.organizationId ?? ORG_A,
      expiresAt: data.expiresAt,
      revokedAt: data.revokedAt,
      pausedAt: data.pausedAt,
    });
    // Re-key the seeded link to the digest of the known raw token so the
    // resolution lookup can find it.
    const stored = store.links.get(record.id)!;
    stored.tokenHash = hashToken(RAW_TOKEN);
  }

  function resolveWith(
    store: FakeAccessLinkStore,
  ): ReturnType<typeof resolvePublicLink> {
    return resolvePublicLink(RAW_TOKEN, {
      store,
      clock: { now: () => new Date(FIXED_NOW.getTime()) },
    });
  }

  it("resolves a live, non-expiring link as valid", async () => {
    const { store } = createHarness();
    seedWithToken(store, { id: LINK_A1 });

    const resolution = await resolveWith(store);

    expect(resolution.status).toBe("valid");
  });

  it("returns paused for a paused link that is not revoked or expired", async () => {
    const { store } = createHarness();
    seedWithToken(store, {
      id: LINK_A1,
      expiresAt: FIXED_FUTURE,
      pausedAt: FIXED_PAST,
    });

    const resolution = await resolveWith(store);

    expect(resolution.status).toBe("paused");
    if (resolution.status === "paused") {
      expect(resolution.link.id).toBe(LINK_A1);
      expect(resolution.link.pausedAt).toEqual(FIXED_PAST);
    }
  });

  it("lets revocation outrank a pause", async () => {
    const { store } = createHarness();
    seedWithToken(store, {
      id: LINK_A1,
      revokedAt: FIXED_PAST,
      pausedAt: FIXED_PAST,
    });

    const resolution = await resolveWith(store);

    expect(resolution).toMatchObject({ status: "revoked" });
  });

  it("keeps expiry ranked below pause and above valid", async () => {
    const expiredHarness = createHarness();
    seedWithToken(expiredHarness.store, {
      id: LINK_A1,
      expiresAt: FIXED_PAST,
    });
    const expired = await resolveWith(expiredHarness.store);

    const validHarness = createHarness();
    seedWithToken(validHarness.store, {
      id: LINK_A2,
      expiresAt: FIXED_FUTURE,
    });
    const valid = await resolveWith(validHarness.store);

    expect(expired.status).toBe("expired");
    expect(valid.status).toBe("valid");
  });
});
