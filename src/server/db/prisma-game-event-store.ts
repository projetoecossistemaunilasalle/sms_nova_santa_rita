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
  ClassReport,
} from "@/application/game-events/ports";
import { GameEventError } from "@/application/game-events/service";
import {
  PLAYER_RESULTS_PAGE_SIZE,
  reportPage,
  type PlayerHistoryPage,
} from "@/application/game-events/report-pagination";
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

type ClassReportRow = {
  classGroupId: string;
  className: string;
  sessionCount: bigint;
  playerSlotId: string | null;
  playerNumber: number | null;
  playerStatus: import("@/generated/prisma/enums").RecordStatus | null;
  participationCount: bigint;
  totalActiveMs: bigint;
  resultCount: bigint;
  lastPlayedAt: Date | null;
};

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
        gameSession: {
          select: { id: true, classGroupId: true, status: true, endedAt: true },
        },
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
      sessionEndedAt: participation.gameSession.endedAt,
    };
  }

  async listClassReports(classGroupIds: readonly string[]) {
    if (classGroupIds.length === 0) return [];
    // Aggregate streams independently before joining: joining raw event tables
    // together would multiply results by active-time rows and corrupt totals.
    const rows = await this.db.$queryRaw<ClassReportRow[]>(Prisma.sql`
      WITH classes AS (
        SELECT "id", "name" FROM "class_groups"
        WHERE "id" IN (${Prisma.join(classGroupIds.map((id) => Prisma.sql`${id}::uuid`))})
      ), players AS (
        SELECT s.* FROM "player_slots" s JOIN classes c ON c."id" = s."class_group_id"
      ), participations AS (
        SELECT p.*, s."class_group_id" FROM "participations" p JOIN players s ON s."id" = p."player_slot_id"
      ), results AS (
        SELECT e."participation_id", COUNT(*) AS count, MAX(e."received_at") AS latest
        FROM "result_events" e JOIN participations p ON p."id" = e."participation_id"
        GROUP BY e."participation_id"
      ), active_time AS (
        SELECT e."participation_id", SUM(e."active_ms") AS total, MAX(e."received_at") AS latest
        FROM "active_time_events" e JOIN participations p ON p."id" = e."participation_id"
        GROUP BY e."participation_id"
      ), totals AS (
        SELECT p."player_slot_id", COUNT(*) AS participations,
          SUM(COALESCE(r.count, 0))::bigint AS results,
          SUM(COALESCE(a.total, 0))::bigint AS active_ms,
          MAX(GREATEST(p."joined_at", r.latest, a.latest)) AS latest
        FROM participations p
        LEFT JOIN results r ON r."participation_id" = p."id"
        LEFT JOIN active_time a ON a."participation_id" = p."id"
        GROUP BY p."player_slot_id"
      ), sessions AS (
        SELECT "class_group_id", COUNT(DISTINCT "game_session_id") AS count
        FROM participations GROUP BY "class_group_id"
      )
      SELECT c."id" AS "classGroupId", c."name" AS "className",
        COALESCE(g.count, 0)::bigint AS "sessionCount",
        s."id" AS "playerSlotId", s."player_number" AS "playerNumber", s."status" AS "playerStatus",
        COALESCE(t.participations, 0)::bigint AS "participationCount",
        COALESCE(t.active_ms, 0)::bigint AS "totalActiveMs",
        COALESCE(t.results, 0)::bigint AS "resultCount", t.latest AS "lastPlayedAt"
      FROM classes c
      LEFT JOIN players s ON s."class_group_id" = c."id"
      LEFT JOIN totals t ON t."player_slot_id" = s."id"
      LEFT JOIN sessions g ON g."class_group_id" = c."id"
      ORDER BY c."name", c."id", s."player_number"
    `);
    const reports = new Map<string, ClassReport>();
    for (const row of rows) {
      let report = reports.get(row.classGroupId);
      if (!report) {
        report = {
          classGroupId: row.classGroupId,
          className: row.className,
          sessionCount: Number(row.sessionCount),
          playerCount: 0,
          participatingPlayerCount: 0,
          totalActiveMs: 0,
          resultCount: 0,
          players: [],
        };
        reports.set(row.classGroupId, report);
      }
      if (
        !row.playerSlotId ||
        row.playerNumber === null ||
        row.playerStatus === null
      )
        continue;
      const player = {
        playerSlotId: row.playerSlotId,
        playerNumber: row.playerNumber,
        playerStatus: row.playerStatus,
        participationCount: Number(row.participationCount),
        totalActiveMs: Number(row.totalActiveMs),
        resultCount: Number(row.resultCount),
        lastPlayedAt: row.lastPlayedAt,
      };
      report.players.push(player);
      report.playerCount++;
      if (player.participationCount > 0) report.participatingPlayerCount++;
      report.totalActiveMs += player.totalActiveMs;
      report.resultCount += player.resultCount;
    }
    return [...reports.values()];
  }

  async getPlayerReport(
    classGroupId: string,
    playerSlotId: string,
    page: PlayerHistoryPage = {},
  ): Promise<PlayerReport | null> {
    const player = await this.db.playerSlot.findFirst({
      where: { id: playerSlotId, classGroupId },
      select: {
        id: true,
        playerNumber: true,
        status: true,
        classGroup: { select: { id: true, name: true } },
        _count: { select: { participations: true } },
      },
    });
    if (!player) return null;

    const sessionPages = Math.max(1, player._count.participations);
    const sessionPage = reportPage(page.sessionPage, sessionPages);
    const [totalActive, resultCount, sessions] = await Promise.all([
      this.db.activeTimeEvent.aggregate({
        where: { participation: { playerSlotId } },
        _sum: { activeMs: true },
      }),
      this.db.resultEvent.count({ where: { participation: { playerSlotId } } }),
      this.db.participation.findMany({
        where: { playerSlotId },
        orderBy: [{ joinedAt: "desc" }, { id: "desc" }],
        skip: sessionPage - 1,
        take: 1,
        select: {
          id: true,
          gameSessionId: true,
          joinedAt: true,
          gameSession: { select: { startedAt: true, endedAt: true } },
          _count: { select: { resultEvents: true, activeTimeEvents: true } },
        },
      }),
    ]);
    const participation = sessions[0];
    const resultPages = Math.max(
      1,
      Math.ceil(
        (participation?._count.resultEvents ?? 0) / PLAYER_RESULTS_PAGE_SIZE,
      ),
    );
    const resultPage = reportPage(page.resultPage, resultPages);
    const participations: PlayerReport["participations"] = [];
    if (participation) {
      const [active, events] = await Promise.all([
        this.db.activeTimeEvent.aggregate({
          where: { participationId: participation.id },
          _sum: { activeMs: true },
        }),
        this.db.resultEvent.findMany({
          where: { participationId: participation.id },
          orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
          skip: (resultPage - 1) * PLAYER_RESULTS_PAGE_SIZE,
          take: PLAYER_RESULTS_PAGE_SIZE,
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
        }),
      ]);
      participations.push({
        gameSessionId: participation.gameSessionId,
        sessionStartedAt: participation.gameSession.startedAt,
        sessionEndedAt: participation.gameSession.endedAt,
        joinedAt: participation.joinedAt,
        activeTimeMs: Number(active._sum.activeMs ?? 0),
        activeTimeEventCount: participation._count.activeTimeEvents,
        resultCount: participation._count.resultEvents,
        results: events.map((event) => ({
          id: event.id,
          activityId: event.activityId,
          missionId: event.missionId,
          attemptId: event.attemptId,
          state: event.resultState,
          durationMs: Number(event.durationMs),
          metrics: metricsDto(event.metrics),
          receivedAt: event.receivedAt,
        })),
      });
    }

    return {
      classGroupId: player.classGroup.id,
      className: player.classGroup.name,
      playerSlotId: player.id,
      playerNumber: player.playerNumber,
      playerStatus: player.status,
      participationCount: player._count.participations,
      totalActiveMs: Number(totalActive._sum.activeMs ?? 0),
      resultCount,
      history: { sessionPage, sessionPages, resultPage, resultPages },
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
