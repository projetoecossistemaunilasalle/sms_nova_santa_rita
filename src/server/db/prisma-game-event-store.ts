import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { ActiveTimeBatchV1, ResultEventV1 } from "@/contracts/v1";
import type {
  EventLaunchScope,
  GameEventReportStore,
  GameEventStore,
  GameEventTransaction,
  PlayerReport,
} from "@/application/game-events/ports";
import { GameEventError } from "@/application/game-events/service";
import type { LaunchTokenContext } from "@/server/security/launch-token";

import { getPrisma } from "./client";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "undefined";
  }
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([left], [right]) => left.localeCompare(right),
  );
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
}

function eventIdConflict(): never {
  throw new GameEventError("EVENT_ID_CONFLICT");
}

function metricsDto(value: Prisma.JsonValue): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number",
    ),
  );
}

const reportClassSelect = {
  id: true,
  name: true,
  playerSlots: {
    orderBy: { playerNumber: "asc" },
    select: {
      id: true,
      playerNumber: true,
      status: true,
      participations: {
        select: {
          joinedAt: true,
          gameSessionId: true,
          resultEvents: { select: { receivedAt: true } },
          activeTimeEvents: { select: { activeMs: true, receivedAt: true } },
        },
      },
    },
  },
} as const;

type ClassReportRecord = Prisma.ClassGroupGetPayload<{
  select: typeof reportClassSelect;
}>;

function classReportDto(record: ClassReportRecord) {
  const players = record.playerSlots.map((player) => {
    const participations = player.participations;
    const activityDates = participations.flatMap((participation) => [
      participation.joinedAt,
      ...participation.resultEvents.map(({ receivedAt }) => receivedAt),
      ...participation.activeTimeEvents.map(({ receivedAt }) => receivedAt),
    ]);
    return {
      playerSlotId: player.id,
      playerNumber: player.playerNumber,
      playerStatus: player.status,
      participationCount: participations.length,
      totalActiveMs: participations.reduce(
        (total, participation) =>
          total +
          participation.activeTimeEvents.reduce(
            (sum, event) => sum + event.activeMs,
            0,
          ),
        0,
      ),
      resultCount: participations.reduce(
        (total, participation) => total + participation.resultEvents.length,
        0,
      ),
      lastPlayedAt:
        activityDates.length === 0
          ? null
          : activityDates.reduce((latest, date) =>
              date > latest ? date : latest,
            ),
    };
  });
  const participations = record.playerSlots.flatMap(
    ({ participations: rows }) => rows,
  );

  return {
    classGroupId: record.id,
    className: record.name,
    playerCount: record.playerSlots.length,
    participatingPlayerCount: players.filter(
      ({ participationCount }) => participationCount > 0,
    ).length,
    sessionCount: new Set(
      participations.map(({ gameSessionId }) => gameSessionId),
    ).size,
    totalActiveMs: players.reduce(
      (total, player) => total + player.totalActiveMs,
      0,
    ),
    resultCount: players.reduce(
      (total, player) => total + player.resultCount,
      0,
    ),
    players,
  };
}

class PrismaGameEventReader {
  constructor(protected readonly db: DatabaseClient) {}

  async getLaunchScope(
    context: LaunchTokenContext,
  ): Promise<EventLaunchScope | null> {
    const participation = await this.db.participation.findUnique({
      where: { id: context.participationId },
      select: {
        id: true,
        gameSessionId: true,
        playerSlotId: true,
        playerSlot: {
          select: {
            status: true,
            classGroupId: true,
            classGroup: {
              select: {
                id: true,
                status: true,
                organization: { select: { status: true } },
              },
            },
          },
        },
        gameSession: { select: { id: true, classGroupId: true, status: true } },
      },
    });
    if (
      !participation ||
      participation.playerSlotId !== context.playerSlotId ||
      participation.gameSessionId !== context.gameSessionId ||
      participation.playerSlot.classGroupId !==
        participation.gameSession.classGroupId
    ) {
      return null;
    }
    const credential = await this.db.playerCredential.findFirst({
      where: {
        id: context.credentialId,
        playerSlotId: context.playerSlotId,
      },
      select: { status: true },
    });
    if (!credential) return null;
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

  async listClassReports(classGroupIds: readonly string[]) {
    if (classGroupIds.length === 0) return [];
    const records = await this.db.classGroup.findMany({
      where: { id: { in: [...classGroupIds] } },
      orderBy: { name: "asc" },
      select: reportClassSelect,
    });
    return records.map(classReportDto);
  }

  async getPlayerReport(
    classGroupId: string,
    playerSlotId: string,
  ): Promise<PlayerReport | null> {
    const player = await this.db.playerSlot.findFirst({
      where: { id: playerSlotId, classGroupId },
      select: {
        id: true,
        playerNumber: true,
        status: true,
        classGroup: { select: { id: true, name: true } },
        participations: {
          orderBy: { joinedAt: "desc" },
          select: {
            id: true,
            gameSessionId: true,
            joinedAt: true,
            gameSession: { select: { startedAt: true, endedAt: true } },
            resultEvents: {
              orderBy: { receivedAt: "desc" },
              select: {
                id: true,
                activityId: true,
                missionId: true,
                attemptId: true,
                resultState: true,
                durationMs: true,
                metrics: true,
                receivedAt: true,
              },
            },
            activeTimeEvents: { select: { activeMs: true } },
          },
        },
      },
    });
    if (!player) return null;

    const participations = player.participations.map((participation) => ({
      gameSessionId: participation.gameSessionId,
      sessionStartedAt: participation.gameSession.startedAt,
      sessionEndedAt: participation.gameSession.endedAt,
      joinedAt: participation.joinedAt,
      activeTimeMs: participation.activeTimeEvents.reduce(
        (total, event) => total + event.activeMs,
        0,
      ),
      activeTimeEventCount: participation.activeTimeEvents.length,
      resultCount: participation.resultEvents.length,
      results: participation.resultEvents.map((event) => ({
        id: event.id,
        activityId: event.activityId,
        missionId: event.missionId,
        attemptId: event.attemptId,
        state: event.resultState,
        durationMs: Number(event.durationMs),
        metrics: metricsDto(event.metrics),
        receivedAt: event.receivedAt,
      })),
    }));

    return {
      classGroupId: player.classGroup.id,
      className: player.classGroup.name,
      playerSlotId: player.id,
      playerNumber: player.playerNumber,
      playerStatus: player.status,
      participationCount: participations.length,
      totalActiveMs: participations.reduce(
        (total, participation) => total + participation.activeTimeMs,
        0,
      ),
      resultCount: participations.reduce(
        (total, participation) => total + participation.resultCount,
        0,
      ),
      participations,
    };
  }
}

class PrismaGameEventTransaction
  extends PrismaGameEventReader
  implements GameEventTransaction
{
  override async getLaunchScope(context: LaunchTokenContext) {
    const credentials = await this.db.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT "id"
        FROM "player_credentials"
        WHERE "id" = ${context.credentialId}::uuid
        FOR UPDATE
      `,
    );
    if (credentials.length === 0) return null;
    return super.getLaunchScope(context);
  }

  async acceptResult(participationId: string, event: ResultEventV1) {
    const payload = event as unknown as Prisma.InputJsonValue;
    const result = await this.db.resultEvent.createMany({
      data: [
        {
          id: randomUUID(),
          participationId,
          clientEventId: event.client_event_id,
          requestId: event.request_id,
          activityId: event.activity_id,
          missionId: event.mission_id,
          attemptId: event.context.id_tentativa,
          resultState: event.result.estado,
          durationMs: BigInt(event.result.duracao_ms),
          metrics: event.result.metricas as Prisma.InputJsonValue,
          payload,
        },
      ],
      skipDuplicates: true,
    });
    if (result.count === 1) return;

    const existing = await this.db.resultEvent.findUnique({
      where: { clientEventId: event.client_event_id },
      select: { participationId: true, payload: true },
    });
    if (
      !existing ||
      existing.participationId !== participationId ||
      stableJson(existing.payload) !== stableJson(event)
    ) {
      eventIdConflict();
    }
  }

  async acceptActiveTime(participationId: string, batch: ActiveTimeBatchV1) {
    const rows = batch.events.map((event) => ({
      id: randomUUID(),
      participationId,
      clientEventId: event.client_event_id,
      requestId: event.request_id,
      activeMs: event.active_ms,
      mode: event.mode,
    }));
    await this.db.activeTimeEvent.createMany({
      data: rows,
      skipDuplicates: true,
    });
    const existing = await this.db.activeTimeEvent.findMany({
      where: {
        clientEventId: { in: rows.map(({ clientEventId }) => clientEventId) },
      },
      select: {
        participationId: true,
        clientEventId: true,
        requestId: true,
        activeMs: true,
        mode: true,
      },
    });
    const eventsById = new Map(
      batch.events.map((event) => [event.client_event_id, event]),
    );
    if (existing.length !== batch.events.length) eventIdConflict();
    for (const saved of existing) {
      const incoming = eventsById.get(saved.clientEventId);
      if (
        !incoming ||
        saved.participationId !== participationId ||
        saved.requestId !== incoming.request_id ||
        saved.activeMs !== incoming.active_ms ||
        saved.mode !== incoming.mode
      ) {
        eventIdConflict();
      }
    }
  }
}

export class PrismaGameEventStore
  extends PrismaGameEventReader
  implements GameEventStore, GameEventReportStore
{
  constructor(private readonly prisma: PrismaClient = getPrisma()) {
    super(prisma);
  }

  transaction<T>(work: (transaction: GameEventTransaction) => Promise<T>) {
    return this.prisma.$transaction((transaction) =>
      work(new PrismaGameEventTransaction(transaction)),
    );
  }
}
