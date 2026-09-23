import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { parseGameStateV1, type GameStateV1 } from "@/contracts/v1";
import type {
  GameStateStore,
  GameStateTransaction,
  LaunchScope,
  StoredGameState,
} from "@/application/game-state/service";
import type { LaunchTokenContext } from "@/server/security/launch-token";

import { getPrisma } from "./client";

class PrismaGameStateTransaction implements GameStateTransaction {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async getLaunchScope(
    context: LaunchTokenContext,
  ): Promise<LaunchScope | null> {
    // Match the credential-then-session lock order used by QR entry and rotation.
    const credentials = await this.db.$queryRaw<
      Array<{ id: string }>
    >(Prisma.sql`
      SELECT "id" FROM "player_credentials"
      WHERE "id" = ${context.credentialId}::uuid FOR UPDATE
    `);
    if (credentials.length !== 1) return null;
    // Shared session locks let distinct players bootstrap/save concurrently while
    // still blocking an end-session update until this transaction completes.
    const sessions = await this.db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "game_sessions"
      WHERE "id" = ${context.gameSessionId}::uuid FOR SHARE
    `);
    if (sessions.length !== 1) return null;

    const participation = await this.db.participation.findUnique({
      where: { id: context.participationId },
      select: {
        playerSlotId: true,
        gameSessionId: true,
        gameSession: { select: { classGroupId: true, status: true } },
        playerSlot: {
          select: {
            status: true,
            classGroupId: true,
            classGroup: {
              select: {
                status: true,
                organization: { select: { status: true } },
              },
            },
          },
        },
      },
    });
    const credential = await this.db.playerCredential.findUnique({
      where: { id: context.credentialId },
      select: { playerSlotId: true, status: true },
    });
    if (
      !participation ||
      !credential ||
      participation.playerSlotId !== context.playerSlotId ||
      participation.gameSessionId !== context.gameSessionId ||
      credential.playerSlotId !== context.playerSlotId ||
      participation.playerSlot.classGroupId !==
        participation.gameSession.classGroupId
    ) {
      return null;
    }
    return {
      ...context,
      credentialStatus: credential.status,
      playerStatus: participation.playerSlot.status,
      classStatus: participation.playerSlot.classGroup.status,
      organizationStatus:
        participation.playerSlot.classGroup.organization.status,
      sessionStatus: participation.gameSession.status,
    };
  }

  async getState(playerSlotId: string): Promise<StoredGameState | null> {
    const record = await this.db.gameState.findUnique({
      where: { playerSlotId },
      select: { revision: true, payload: true },
    });
    return record
      ? { revision: record.revision, state: parseGameStateV1(record.payload) }
      : null;
  }

  async createState(
    playerSlotId: string,
    state: GameStateV1,
  ): Promise<boolean> {
    const count = await this.db.$executeRaw(Prisma.sql`
      INSERT INTO "game_states"
        ("player_slot_id", "protocol_version", "schema_version", "content_version", "payload", "revision", "updated_at")
      VALUES (${playerSlotId}::uuid, 1, ${state.schema_version}, ${state.content_version}, ${JSON.stringify(state)}::jsonb, 1, CURRENT_TIMESTAMP)
      ON CONFLICT ("player_slot_id") DO NOTHING
    `);
    return count === 1;
  }

  async updateState(
    playerSlotId: string,
    expectedRevision: number,
    state: GameStateV1,
  ): Promise<boolean> {
    const result = await this.db.gameState.updateMany({
      where: { playerSlotId, revision: expectedRevision },
      data: {
        protocolVersion: 1,
        schemaVersion: state.schema_version,
        contentVersion: state.content_version,
        payload: state as Prisma.InputJsonValue,
        revision: { increment: 1 },
      },
    });
    return result.count === 1;
  }
}

export class PrismaGameStateStore implements GameStateStore {
  constructor(private readonly db: PrismaClient = getPrisma()) {}

  transaction<T>(
    work: (transaction: GameStateTransaction) => Promise<T>,
  ): Promise<T> {
    return this.db.$transaction((transaction) =>
      work(new PrismaGameStateTransaction(transaction)),
    );
  }
}
