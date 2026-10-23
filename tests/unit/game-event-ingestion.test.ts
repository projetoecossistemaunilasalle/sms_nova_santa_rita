import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  GameSessionStatus,
  PlayerCredentialStatus,
  RecordStatus,
} from "@/generated/prisma/enums";
import type { LaunchTokenContext } from "@/server/security/launch-token";
import { PrismaGameEventStore } from "@/server/db/prisma-game-event-store";
import {
  GameEventError,
  GameEventReportService,
  GameEventService,
} from "@/application/game-events/service";
import type { ResultEventV2 } from "@/contracts/v2";
import { demoGameContentSeed } from "@/server/mock/content-seed";
import { logger } from "@/server/observability/logger";

const launchContext: LaunchTokenContext = {
  credentialId: "credential-1",
  participationId: "participation-1",
  playerSlotId: "player-1",
  gameSessionId: "session-1",
};

function fixture() {
  const results = new Map<string, Record<string, unknown>>();
  const activeTime = new Map<string, Record<string, unknown>>();
  const db = {
    $queryRaw: vi.fn(async () => [{ id: launchContext.credentialId }]),
    participation: {
      findUnique: vi.fn(async () => ({
        id: launchContext.participationId,
        gameSessionId: launchContext.gameSessionId,
        playerSlotId: launchContext.playerSlotId,
        playerSlot: {
          status: RecordStatus.ACTIVE,
          classGroupId: "class-1",
          classGroup: {
            id: "class-1",
            status: RecordStatus.ACTIVE,
            organization: { status: RecordStatus.ACTIVE },
          },
        },
        gameSession: {
          contentManifest: { payload: demoGameContentSeed()[0]!.payload },
          id: launchContext.gameSessionId,
          classGroupId: "class-1",
          status: GameSessionStatus.ENDED,
          endedAt: new Date(),
        },
      })),
    },
    playerCredential: {
      findFirst: vi.fn(async () => ({ status: PlayerCredentialStatus.ACTIVE })),
    },
    resultEvent: {
      createMany: vi.fn(
        async ({ data }: { data: Record<string, unknown>[] }) => {
          const event = data[0]!;
          const id = event.clientEventId as string;
          if (results.has(id)) return { count: 0 };
          results.set(id, event);
          return { count: 1 };
        },
      ),
      findUnique: vi.fn(
        async ({ where }: { where: { clientEventId: string } }) => {
          const event = results.get(where.clientEventId);
          return event
            ? { participationId: event.participationId, payload: event.payload }
            : null;
        },
      ),
    },
    activeTimeEvent: {
      createMany: vi.fn(
        async ({ data }: { data: Record<string, unknown>[] }) => {
          let count = 0;
          for (const event of data) {
            const id = event.clientEventId as string;
            if (activeTime.has(id)) continue;
            activeTime.set(id, event);
            count += 1;
          }
          return { count };
        },
      ),
      findMany: vi.fn(
        async ({ where }: { where: { clientEventId: { in: string[] } } }) =>
          where.clientEventId.in.flatMap((id) => {
            const event = activeTime.get(id);
            return event
              ? [
                  {
                    participationId: event.participationId,
                    clientEventId: event.clientEventId,
                    requestId: event.requestId,
                    activeMs: event.activeMs,
                    mode: event.mode,
                    missionId: event.missionId,
                  },
                ]
              : [];
          }),
      ),
    },
    $transaction: async <T>(work: (transaction: unknown) => Promise<T>) =>
      work(db),
  };
  const store = new PrismaGameEventStore(db as never);
  const service = new GameEventService(store, (token) =>
    token === "valid"
      ? { valid: true, payload: launchContext }
      : { valid: false, reason: "invalid" },
  );
  return { activeTime, db, results, service };
}

function resultEvent(): ResultEventV2 {
  return {
    type: "game.result.v2",
    request_id: "request-result-1",
    client_event_id: "result-event-1",
    activity_id: "lia_memory",
    mission_id: "lia_memory",
    context: {
      id_tentativa: "d86d68e4-a6bd-4f26-8e9d-78b57f01fac2",
      id_atividade: "atitudes_positivas",
      id_mecanica: "memory_pairs",
      id_preset: "padrao",
      versao_atividade: 1,
      id_casa: 0,
      sequencia_tentativa: 1,
      numero_tentativa_atividade: 1,
      semente: 2,
      dificuldade: 1,
      parametros: { pares_para_concluir: 5 },
    },
    result: {
      estado: "sucesso",
      duracao_ms: 18_000,
      metricas: { pares: 5, jogadas: 8 },
    },
  };
}

describe("game event ingestion", () => {
  it("derives dimensions from the participation's manifest and stores the preset", async () => {
    const { db, results, activeTime, service } = fixture();
    await service.submitResult("valid", resultEvent());
    expect(results.get("result-event-1")).toMatchObject({
      moduleId: "convivencia",
      presetId: "padrao",
      missionId: "lia_memory",
    });
    await service.submitActiveTime("valid", {
      type: "game.active_time.v2",
      events: [
        {
          request_id: "t1",
          client_event_id: "t1",
          active_ms: 10,
          mode: "activity",
          mission_id: "brushing_teeth",
        },
        {
          request_id: "t2",
          client_event_id: "t2",
          active_ms: 20,
          mode: "dialogue",
          mission_id: "new_mission",
        },
        {
          request_id: "t3",
          client_event_id: "t3",
          active_ms: 30,
          mode: "exploration",
        },
      ],
    });
    expect(activeTime.get("t1")).toMatchObject({
      moduleId: "saude_bucal",
      missionId: "brushing_teeth",
    });
    expect(activeTime.get("t2")).toMatchObject({
      moduleId: null,
      missionId: "new_mission",
    });
    expect(activeTime.get("t3")).toMatchObject({
      moduleId: null,
      missionId: null,
    });
    expect(db.participation.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          gameSession: expect.objectContaining({
            select: expect.objectContaining({
              contentManifest: { select: { payload: true } },
            }),
          }),
        }),
      }),
    );
  });

  it("accepts unknown missions and logs unknown metric keys without discarding them", async () => {
    const { results, service } = fixture();
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    try {
      const event = resultEvent();
      event.mission_id = "new_mission";
      event.result.metricas = { pares: 5, game_added_metric: 7 };
      await expect(service.submitResult("valid", event)).resolves.toMatchObject(
        { type: "portal.result_ack.v2" },
      );
      expect(results.get(event.client_event_id)).toMatchObject({
        moduleId: null,
        metrics: event.result.metricas,
      });
      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({
          activityId: "lia_memory",
          unknownMetricKeys: ["game_added_metric"],
        }),
        expect.any(String),
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("validates V2 results and active time before storing anything", async () => {
    const { results, activeTime, service } = fixture();
    await expect(
      service.submitResult("valid", {
        ...resultEvent(),
        type: "game.result.v1",
      } as never),
    ).rejects.toThrow();
    await expect(
      service.submitResult("valid", {
        ...resultEvent(),
        context: { ...resultEvent().context, id_preset: "" },
      }),
    ).rejects.toThrow();
    await expect(
      service.submitActiveTime("valid", {
        type: "game.active_time.v2",
        events: [
          {
            request_id: "bad",
            client_event_id: "bad",
            active_ms: 30_001,
            mode: "activity",
          },
        ],
      }),
    ).rejects.toThrow();
    expect(results.size).toBe(0);
    expect(activeTime.size).toBe(0);
  });

  it("treats a changed active-time mission on a reused event ID as a conflict", async () => {
    const { service } = fixture();
    const batch = {
      type: "game.active_time.v2" as const,
      events: [
        {
          request_id: "t",
          client_event_id: "t",
          active_ms: 10,
          mode: "dialogue" as const,
          mission_id: "lia_memory",
        },
      ],
    };
    await service.submitActiveTime("valid", batch);
    await expect(
      service.submitActiveTime("valid", {
        ...batch,
        events: [{ ...batch.events[0]!, mission_id: "smile_kit" }],
      }),
    ).rejects.toMatchObject({ code: "EVENT_ID_CONFLICT" });
  });

  it("rejects late event uploads after 24 hours without inserting any result", async () => {
    const { db, results, service } = fixture();
    const participation = await db.participation.findUnique();
    participation.gameSession.endedAt = new Date(
      Date.now() - 24 * 60 * 60 * 1000 - 1000,
    );
    db.participation.findUnique.mockResolvedValue(participation);
    await expect(
      service.submitResult("valid", resultEvent()),
    ).rejects.toMatchObject({ code: "INACTIVE_ACCESS" });
    expect(results.size).toBe(0);
  });
  it("accepts result retries once and permits a brief flush after session end", async () => {
    const { db, results, service } = fixture();
    const event = resultEvent();

    const first = await service.submitResult("valid", event);
    const retry = await service.submitResult("valid", event);

    expect(first).toEqual({
      type: "portal.result_ack.v2",
      client_event_id: event.client_event_id,
    });
    expect(retry).toEqual(first);
    expect(results.size).toBe(1);
    expect(db.$queryRaw).toHaveBeenCalledTimes(2);
    expect(db.resultEvent.createMany).toHaveBeenCalledTimes(2);
  });

  it("rejects reuse of a result event ID for a different payload", async () => {
    const { service } = fixture();
    const event = resultEvent();
    await service.submitResult("valid", event);
    const altered = {
      ...event,
      result: { ...event.result, duracao_ms: 19_000 },
    } as ResultEventV2;

    await expect(service.submitResult("valid", altered)).rejects.toMatchObject({
      code: "EVENT_ID_CONFLICT",
    } satisfies Partial<GameEventError>);
  });

  it("deduplicates active-time batches and rejects event ID collisions", async () => {
    const { activeTime, service } = fixture();
    const batch = {
      type: "game.active_time.v2" as const,
      events: [
        {
          request_id: "request-time-1",
          client_event_id: "time-event-1",
          active_ms: 30_000,
          mode: "exploration" as const,
        },
        {
          request_id: "request-time-2",
          client_event_id: "time-event-2",
          active_ms: 15_000,
          mode: "activity" as const,
        },
      ],
    };

    const first = await service.submitActiveTime("valid", batch);
    const retry = await service.submitActiveTime("valid", batch);

    expect(first).toEqual({
      type: "portal.active_time_ack.v2",
      acknowledged_event_ids: ["time-event-1", "time-event-2"],
    });
    expect(retry).toEqual(first);
    expect(activeTime.size).toBe(2);
    await expect(
      service.submitActiveTime("valid", {
        ...batch,
        events: [{ ...batch.events[0]!, active_ms: 10_000 }],
      }),
    ).rejects.toMatchObject({ code: "EVENT_ID_CONFLICT" });
  });

  it("rejects invalid launch tokens before inserting events", async () => {
    const { db, results, service } = fixture();
    await expect(
      service.submitResult("invalid", resultEvent()),
    ).rejects.toMatchObject({
      code: "INVALID_LAUNCH",
    });
    expect(results.size).toBe(0);
    expect(db.participation.findUnique).not.toHaveBeenCalled();
  });
});

describe("game event reporting authorization", () => {
  it("only queries reports for classes returned by the authorized portal service", async () => {
    const reports = {
      listClassReports: vi.fn(async (classIds: readonly string[]) =>
        classIds.map((id) => ({ classGroupId: id })),
      ),
      getPlayerReport: vi.fn(),
    };
    const service = new GameEventReportService(
      reports as never,
      vi.fn(async () => {}),
      async () => [{ id: "visible-class" }],
    );

    await expect(service.listClassReports("teacher-profile")).resolves.toEqual([
      { classGroupId: "visible-class" },
    ]);
    expect(reports.listClassReports).toHaveBeenCalledWith(
      ["visible-class"],
      undefined,
    );
  });

  it("forwards optional module filters and player pages after authorization", async () => {
    const reports = {
      listClassReports: vi.fn(async () => [{ classGroupId: "visible-class" }]),
      getPlayerReport: vi.fn(async () => ({ playerSlotId: "player" })),
    };
    const access = vi.fn(async () => {});
    const service = new GameEventReportService(
      reports as never,
      access,
      async () => [{ id: "visible-class" }],
    );
    await service.listClassReports("teacher", "module");
    await service.getClassReport("teacher", "visible-class", "module");
    const page = { sessionPage: 2, resultPage: 3 };
    await service.getPlayerReport(
      "teacher",
      "visible-class",
      "player",
      page,
      "module",
    );
    expect(reports.listClassReports).toHaveBeenNthCalledWith(
      1,
      ["visible-class"],
      "module",
    );
    expect(reports.listClassReports).toHaveBeenNthCalledWith(
      2,
      ["visible-class"],
      "module",
    );
    expect(reports.getPlayerReport).toHaveBeenCalledWith(
      "visible-class",
      "player",
      page,
      "module",
    );
    expect(access).toHaveBeenCalledWith("teacher", "visible-class");
  });

  it("does not query a class report when the adult access check denies it", async () => {
    const reports = {
      listClassReports: vi.fn(),
      getPlayerReport: vi.fn(),
    };
    const service = new GameEventReportService(
      reports as never,
      async () => {
        throw new Error("forbidden");
      },
      async () => [],
    );

    await expect(
      service.getClassReport("teacher-profile", "other-class"),
    ).rejects.toThrow("forbidden");
    expect(reports.listClassReports).not.toHaveBeenCalled();
  });
});
