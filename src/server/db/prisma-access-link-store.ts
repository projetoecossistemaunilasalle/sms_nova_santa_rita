import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { getPrisma } from "@/server/db/client";
import { HttpError } from "@/server/http/errors";
import type {
  AccessLinkRecord,
  AccessLinkStore,
  AuditEventInput,
} from "@/server/services/access-link-service";

/**
 * Client type shared by the root store (full `PrismaClient`) and the
 * transaction-scoped store (`Prisma.TransactionClient`, the same client with
 * transaction-denied methods omitted from the type).
 */
type StoreClient = Prisma.TransactionClient;

/** Exact columns read for every access-link row; nothing else is fetched. */
const accessLinkSelect = {
  id: true,
  organizationId: true,
  createdById: true,
  label: true,
  audience: true,
  tokenHash: true,
  expiresAt: true,
  revokedAt: true,
  pausedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AccessLinkSelect;

type AccessLinkRow = Prisma.AccessLinkGetPayload<{
  select: typeof accessLinkSelect;
}>;

/** Deterministic listing order: newest first, then by id for stability. */
const listOrderBy = [{ createdAt: "desc" }, { id: "asc" }] as const;

function toRecord(row: AccessLinkRow): AccessLinkRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    createdById: row.createdById,
    label: row.label,
    audience: row.audience,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    pausedAt: row.pausedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Prisma-backed {@link AccessLinkStore}.
 *
 * Invariants:
 * - Audit writes go through {@link recordAudit} on the same store instance as
 *   the link mutation, so when the service wraps its work in `transaction`
 *   the audit row joins that transaction and commits or rolls back with it.
 *   Outside a transaction both writes run on the shared client.
 * - Only `tokenHash` (the digest) is ever written; raw tokens never reach
 *   this adapter.
 * - `transaction` is only ever started on the root store (constructed with
 *   the full PrismaClient); the tx-scoped store handed to the callback never
 *   calls it, matching Prisma's no-nested-interactive-transactions rule.
 */
export class PrismaAccessLinkStore implements AccessLinkStore {
  private readonly client: StoreClient;

  constructor(client?: StoreClient) {
    this.client = client ?? getPrisma();
  }

  async findById(id: string): Promise<AccessLinkRecord | null> {
    const row = await this.client.accessLink.findUnique({
      where: { id },
      select: accessLinkSelect,
    });
    return row === null ? null : toRecord(row);
  }

  async findByTokenHash(tokenHash: string): Promise<AccessLinkRecord | null> {
    const row = await this.client.accessLink.findUnique({
      where: { tokenHash },
      select: accessLinkSelect,
    });
    return row === null ? null : toRecord(row);
  }

  async listByOrganizationIds(
    organizationIds: string[],
  ): Promise<AccessLinkRecord[]> {
    if (organizationIds.length === 0) {
      return [];
    }
    const rows = await this.client.accessLink.findMany({
      where: { organizationId: { in: organizationIds } },
      select: accessLinkSelect,
      orderBy: [...listOrderBy],
    });
    return rows.map(toRecord);
  }

  async listAll(): Promise<AccessLinkRecord[]> {
    const rows = await this.client.accessLink.findMany({
      select: accessLinkSelect,
      orderBy: [...listOrderBy],
    });
    return rows.map(toRecord);
  }

  async insert(data: {
    organizationId: string;
    createdById: string;
    label: string;
    audience: string;
    tokenHash: string;
    expiresAt: Date | null;
    /** Persisted as-is; new links default to null when omitted. */
    pausedAt?: Date | null;
    id?: string;
    now: Date;
  }): Promise<AccessLinkRecord> {
    const row = await this.client.accessLink.create({
      data: {
        ...(data.id === undefined ? {} : { id: data.id }),
        organizationId: data.organizationId,
        createdById: data.createdById,
        label: data.label,
        audience: data.audience,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        ...(data.pausedAt === undefined ? {} : { pausedAt: data.pausedAt }),
        createdAt: data.now,
        updatedAt: data.now,
      },
      select: accessLinkSelect,
    });
    return toRecord(row);
  }

  async revoke(id: string, now: Date): Promise<void> {
    // Conditional update: only revoke if the link is still active. This makes
    // concurrent rotations serialize correctly: the second transaction will see
    // `count === 0` and fail rather than creating two replacements.
    const result = await this.client.accessLink.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: now, updatedAt: now },
    });

    if (result.count === 1) return;

    // No row updated: distinguish between missing id and already-revoked.
    const row = await this.client.accessLink.findUnique({
      where: { id },
      select: { revokedAt: true },
    });
    if (row === null) {
      throw new HttpError(404, "RESOURCE_NOT_FOUND", "Access link not found.");
    }
    throw new HttpError(
      409,
      "CONFLICT",
      "The access link has already been revoked.",
    );
  }

  async replaceToken(
    id: string,
    data: { tokenHash: string; expiresAt: Date | null },
    now: Date,
  ): Promise<void> {
    // Conditional update: only swap the token on a still-active link, so a
    // concurrent revoke wins and rotation can never resurrect a revoked row.
    // The link id is preserved by construction; only the digest (and expiry)
    // change, keeping every URL/audit reference anchored to one row.
    const result = await this.client.accessLink.updateMany({
      where: { id, revokedAt: null },
      data: {
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        updatedAt: now,
      },
    });

    if (result.count === 1) return;

    // No row updated: distinguish between missing id and already-revoked.
    const row = await this.client.accessLink.findUnique({
      where: { id },
      select: { revokedAt: true },
    });
    if (row === null) {
      throw new HttpError(404, "RESOURCE_NOT_FOUND", "Access link not found.");
    }
    throw new HttpError(
      409,
      "CONFLICT",
      "The access link has already been revoked.",
    );
  }

  async pause(id: string, now: Date): Promise<void> {
    // Conditional update: only pause a still-active link, so a concurrent
    // revoke wins and pausing never resurrects or mutates a revoked link.
    const result = await this.client.accessLink.updateMany({
      where: { id, revokedAt: null },
      data: { pausedAt: now, updatedAt: now },
    });

    if (result.count === 1) return;

    // No row updated: distinguish between missing id and already-revoked.
    const row = await this.client.accessLink.findUnique({
      where: { id },
      select: { revokedAt: true },
    });
    if (row === null) {
      throw new HttpError(404, "RESOURCE_NOT_FOUND", "Access link not found.");
    }
    throw new HttpError(
      409,
      "CONFLICT",
      "The access link has already been revoked.",
    );
  }

  async resume(id: string, now: Date): Promise<void> {
    // Conditional update: only resume a still-active link, so a concurrent
    // revoke wins and resuming never mutates a revoked link.
    const result = await this.client.accessLink.updateMany({
      where: { id, revokedAt: null },
      data: { pausedAt: null, updatedAt: now },
    });

    if (result.count === 1) return;

    // No row updated: distinguish between missing id and already-revoked.
    const row = await this.client.accessLink.findUnique({
      where: { id },
      select: { revokedAt: true },
    });
    if (row === null) {
      throw new HttpError(404, "RESOURCE_NOT_FOUND", "Access link not found.");
    }
    throw new HttpError(
      409,
      "CONFLICT",
      "The access link has already been revoked.",
    );
  }

  async setExpiry(
    id: string,
    expiresAt: Date | null,
    now: Date,
  ): Promise<void> {
    // Conditional update: do not mutate a revoked link. Concurrent revoke vs
    // setExpiry will serialize via the row's revokedAt guard.
    const result = await this.client.accessLink.updateMany({
      where: { id, revokedAt: null },
      data: { expiresAt, updatedAt: now },
    });

    if (result.count === 1) return;

    const row = await this.client.accessLink.findUnique({
      where: { id },
      select: { revokedAt: true },
    });
    if (row === null) {
      throw new HttpError(404, "RESOURCE_NOT_FOUND", "Access link not found.");
    }
    throw new HttpError(
      409,
      "CONFLICT",
      "The access link has already been revoked.",
    );
  }

  async updateMetadata(
    id: string,
    data: { label?: string; audience?: string; expiresAt?: Date | null },
    now: Date,
  ): Promise<void> {
    if (
      data.label === undefined &&
      data.audience === undefined &&
      data.expiresAt === undefined
    ) {
      return;
    }
    const updateData: Prisma.AccessLinkUpdateManyMutationInput = {
      updatedAt: now,
    };
    if (data.label !== undefined) updateData.label = data.label;
    if (data.audience !== undefined) updateData.audience = data.audience;
    if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt;

    const result = await this.client.accessLink.updateMany({
      where: { id, revokedAt: null },
      data: updateData,
    });

    if (result.count === 1) return;

    const row = await this.client.accessLink.findUnique({
      where: { id },
      select: { revokedAt: true },
    });
    if (row === null) {
      throw new HttpError(404, "RESOURCE_NOT_FOUND", "Access link not found.");
    }
    throw new HttpError(
      409,
      "CONFLICT",
      "The access link has already been revoked.",
    );
  }

  async recordAudit(event: AuditEventInput): Promise<void> {
    await this.client.auditEvent.create({
      data: {
        actorId: event.actorId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        ...(event.before === undefined
          ? {}
          : { before: event.before as Prisma.InputJsonValue }),
        ...(event.after === undefined
          ? {}
          : { after: event.after as Prisma.InputJsonValue }),
        ...(event.reason === undefined ? {} : { reason: event.reason }),
        correlationId: event.correlationId ?? "",
      },
      select: { id: true },
    });
  }

  async transaction<T>(fn: (tx: AccessLinkStore) => Promise<T>): Promise<T> {
    // Safe by construction: `transaction` is only invoked on stores built
    // from the full PrismaClient (see class invariants). A tx-scoped store
    // calling this would make Prisma reject the nested transaction anyway.
    const root = this.client as PrismaClient;
    return root.$transaction(async (tx) => fn(new PrismaAccessLinkStore(tx)));
  }
}
