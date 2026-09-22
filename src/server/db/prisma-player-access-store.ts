import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  GameSessionStatus,
  PlayerCredentialStatus,
} from "@/generated/prisma/enums";
import type {
  NewSlotCredential,
  PlayerAccessStore,
  PlayerAccessTransaction,
  ResolvedCredential,
} from "@/application/player-access/ports";
import type { ActorSnapshot } from "@/application/adult-portal/types";
import { AdultPortalError } from "@/application/adult-portal/errors";

import { getPrisma } from "./client";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

const slotSelect = {
  id: true,
  classGroupId: true,
  playerNumber: true,
  status: true,
  credentials: {
    where: { status: PlayerCredentialStatus.ACTIVE },
    take: 1,
    select: { id: true, status: true },
  },
} as const;

function slotDto(record: {
  id: string;
  classGroupId: string;
  playerNumber: number;
  status: import("@/generated/prisma/enums").RecordStatus;
  credentials: Array<{
    id: string;
    status: PlayerCredentialStatus;
  }>;
}) {
  const credential = record.credentials[0] ?? null;
  return {
    id: record.id,
    classGroupId: record.classGroupId,
    playerNumber: record.playerNumber,
    status: record.status,
    credentialId: credential?.id ?? null,
    credentialStatus: credential?.status ?? null,
  };
}

class PrismaPlayerAccessReader {
  constructor(protected readonly db: DatabaseClient) {}

  async getActor(profileId: string): Promise<ActorSnapshot | null> {
    const profile = await this.db.professionalProfile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        displayName: true,
        status: true,
        platformRole: true,
        memberships: {
          select: {
            id: true,
            organizationId: true,
            role: true,
            status: true,
            organization: { select: { name: true, status: true } },
            teacherAssignments: {
              select: { id: true, classGroupId: true, status: true },
            },
          },
        },
      },
    });
    if (!profile) return null;
    return {
      profileId: profile.id,
      displayName: profile.displayName,
      profileStatus: profile.status,
      platformRole: profile.platformRole,
      memberships: profile.memberships.map((membership) => ({
        id: membership.id,
        organizationId: membership.organizationId,
        organizationName: membership.organization.name,
        organizationStatus: membership.organization.status,
        role: membership.role,
        status: membership.status,
        teacherAssignments: membership.teacherAssignments,
      })),
    };
  }

  async getClassScope(classGroupId: string) {
    const record = await this.db.classGroup.findUnique({
      where: { id: classGroupId },
      select: {
        id: true,
        organizationId: true,
        status: true,
        organization: { select: { status: true } },
      },
    });
    return record
      ? {
          id: record.id,
          organizationId: record.organizationId,
          organizationStatus: record.organization.status,
          status: record.status,
        }
      : null;
  }

  async getSlot(slotId: string) {
    const record = await this.db.playerSlot.findUnique({
      where: { id: slotId },
      select: slotSelect,
    });
    return record ? slotDto(record) : null;
  }

  async listSlots(classGroupId: string) {
    const records = await this.db.playerSlot.findMany({
      where: { classGroupId },
      orderBy: { playerNumber: "asc" },
      select: slotSelect,
    });
    return records.map(slotDto);
  }

  async getActiveSession(classGroupId: string) {
    return this.db.gameSession.findFirst({
      where: { classGroupId, status: GameSessionStatus.ACTIVE },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        classGroupId: true,
        status: true,
        startedAt: true,
        endedAt: true,
      },
    });
  }

  async resolveCredential(
    tokenHash: string,
  ): Promise<ResolvedCredential | null> {
    const record = await this.db.playerCredential.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        status: true,
        playerSlot: {
          select: {
            id: true,
            classGroupId: true,
            playerNumber: true,
            status: true,
            classGroup: {
              select: {
                id: true,
                organizationId: true,
                status: true,
                organization: { select: { status: true } },
              },
            },
          },
        },
      },
    });
    if (!record) return null;
    return {
      id: record.id,
      status: record.status,
      slot: {
        id: record.playerSlot.id,
        classGroupId: record.playerSlot.classGroupId,
        playerNumber: record.playerSlot.playerNumber,
        status: record.playerSlot.status,
      },
      classGroup: {
        id: record.playerSlot.classGroup.id,
        organizationId: record.playerSlot.classGroup.organizationId,
        organizationStatus: record.playerSlot.classGroup.organization.status,
        status: record.playerSlot.classGroup.status,
      },
    };
  }
}

class PrismaPlayerAccessTransaction
  extends PrismaPlayerAccessReader
  implements PlayerAccessTransaction
{
  override async resolveCredential(
    tokenHash: string,
  ): Promise<ResolvedCredential | null> {
    // Lock credentials before the service locks a session, matching rotation's order.
    const credentials = await this.db.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT "id"
        FROM "player_credentials"
        WHERE "token_hash" = ${tokenHash}::char(64)
        FOR UPDATE
      `,
    );
    if (credentials.length === 0) return null;
    return super.resolveCredential(tokenHash);
  }

  async allocateSlots(
    classGroupId: string,
    credentials: readonly NewSlotCredential[],
  ) {
    const counter = await this.db.classGroup.update({
      where: { id: classGroupId },
      data: { nextPlayerNumber: { increment: credentials.length } },
      select: { nextPlayerNumber: true },
    });
    const firstNumber = counter.nextPlayerNumber - credentials.length;
    const slots = [];
    for (const [index, credential] of credentials.entries()) {
      slots.push(
        await this.db.playerSlot.create({
          data: {
            classGroupId,
            playerNumber: firstNumber + index,
            credentials: { create: { tokenHash: credential.tokenHash } },
          },
          select: slotSelect,
        }),
      );
    }
    return slots.map(slotDto);
  }

  async rotateCredential(slotId: string, tokenHash: string, revokedAt: Date) {
    await this.db.playerCredential.updateMany({
      where: { playerSlotId: slotId, status: PlayerCredentialStatus.ACTIVE },
      data: { status: PlayerCredentialStatus.REVOKED, revokedAt },
    });
    await this.db.playerCredential.create({
      data: { playerSlotId: slotId, tokenHash },
    });
    const slot = await this.db.playerSlot.findUniqueOrThrow({
      where: { id: slotId },
      select: slotSelect,
    });
    return slotDto(slot);
  }

  async createSession(classGroupId: string, startedAt: Date) {
    return this.db.gameSession.create({
      data: { classGroupId, startedAt },
      select: {
        id: true,
        classGroupId: true,
        status: true,
        startedAt: true,
        endedAt: true,
      },
    });
  }

  async endSession(sessionId: string, endedAt: Date) {
    const result = await this.db.gameSession.updateMany({
      where: { id: sessionId, status: GameSessionStatus.ACTIVE },
      data: { status: GameSessionStatus.ENDED, endedAt },
    });
    if (result.count !== 1) {
      throw new AdultPortalError(
        "A turma não possui sessão ativa.",
        "CONFLICT",
      );
    }
    return this.db.gameSession.findUniqueOrThrow({
      where: { id: sessionId },
      select: {
        id: true,
        classGroupId: true,
        status: true,
        startedAt: true,
        endedAt: true,
      },
    });
  }

  async findOrCreateActiveParticipation(
    classGroupId: string,
    playerSlotId: string,
    joinedAt: Date,
  ) {
    // Keep the session locked through the upsert so ending it serializes with entry.
    const sessions = await this.db.$queryRaw<
      Array<{
        id: string;
        classGroupId: string;
        startedAt: Date;
        endedAt: Date | null;
      }>
    >(Prisma.sql`
      SELECT "id", "class_group_id" AS "classGroupId",
             "started_at" AS "startedAt", "ended_at" AS "endedAt"
      FROM "game_sessions"
      WHERE "class_group_id" = ${classGroupId}::uuid
        AND "status" = 'active'::"game_session_status"
      FOR UPDATE
    `);
    const activeSession = sessions[0];
    if (!activeSession) return null;

    const participation = await this.db.participation.upsert({
      where: {
        gameSessionId_playerSlotId: {
          gameSessionId: activeSession.id,
          playerSlotId,
        },
      },
      update: {},
      create: {
        gameSessionId: activeSession.id,
        playerSlotId,
        joinedAt,
      },
      select: {
        id: true,
        gameSessionId: true,
        playerSlotId: true,
        joinedAt: true,
      },
    });
    return {
      session: {
        ...activeSession,
        status: GameSessionStatus.ACTIVE,
      },
      participation,
    };
  }
}

export class PrismaPlayerAccessStore
  extends PrismaPlayerAccessReader
  implements PlayerAccessStore
{
  constructor(private readonly prisma: PrismaClient = getPrisma()) {
    super(prisma);
  }

  transaction<T>(work: (transaction: PlayerAccessTransaction) => Promise<T>) {
    return this.prisma
      .$transaction((transaction) =>
        work(new PrismaPlayerAccessTransaction(transaction)),
      )
      .catch((error: unknown) => {
        if (isUniqueConstraintViolation(error)) {
          throw new AdultPortalError(
            "O estado foi alterado por outra operação. Atualize e tente novamente.",
            "CONFLICT",
          );
        }
        throw error;
      });
  }
}
