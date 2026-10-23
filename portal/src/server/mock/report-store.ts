import type {
  ClassReport,
  GameEventReportStore,
  ModuleReportTotals,
  PlayerReport,
} from "@/application/game-events/ports";
import { demoGameContentSeed } from "@/server/mock/content-seed";
import {
  demoGameEvents,
  type DemoGameEvents,
} from "@/server/mock/demo-game-events";
import type { DemoAdultPortalState } from "@/server/mock/seed-store";
import {
  reportPage,
  type PlayerHistoryPage,
} from "@/application/game-events/report-pagination";

type MissionModules = {
  missions: ReadonlyArray<{ mission_id: string; module_id: string }>;
};

// Same ordering as the Prisma store: by module id, "no module" last.
function sortedTotals(totals: Map<string | null, ModuleReportTotals>) {
  return [...totals.values()].sort((a, b) =>
    a.moduleId === b.moduleId
      ? 0
      : a.moduleId === null
        ? 1
        : b.moduleId === null
          ? -1
          : a.moduleId.localeCompare(b.moduleId),
  );
}

function combineModuleTotals(totals: ModuleReportTotals[]) {
  const modules = new Map<string | null, ModuleReportTotals>();
  for (const total of totals) {
    const previous = modules.get(total.moduleId);
    modules.set(total.moduleId, {
      moduleId: total.moduleId,
      totalActiveMs: (previous?.totalActiveMs ?? 0) + total.totalActiveMs,
      resultCount: (previous?.resultCount ?? 0) + total.resultCount,
    });
  }
  return sortedTotals(modules);
}

// Reports reflect the current roster and participation plus the few committed
// demo events (module derived from the mission via the fixture manifest).
// Game ingestion is outside the portal mock's scope.
export class MockGameEventReportStore implements GameEventReportStore {
  private readonly missionModules: ReadonlyMap<string, string>;

  constructor(
    private readonly state: DemoAdultPortalState,
    private readonly events: DemoGameEvents = demoGameEvents,
    manifest: MissionModules = demoGameContentSeed()[0]!.payload,
  ) {
    this.missionModules = new Map(
      manifest.missions.map((mission) => [
        mission.mission_id,
        mission.module_id,
      ]),
    );
  }

  private moduleOf(missionId: string): string | null {
    return this.missionModules.get(missionId) ?? null;
  }

  // Events of the given participations, filtered before aggregating.
  private totalsFor(participationIds: ReadonlySet<string>, moduleId?: string) {
    const keep = (event: { participationId: string; missionId: string }) =>
      participationIds.has(event.participationId) &&
      (moduleId === undefined || this.moduleOf(event.missionId) === moduleId);
    const active = this.events.activeTimeEvents.filter(keep);
    const results = this.events.resultEvents.filter(keep);
    const totals = new Map<string | null, ModuleReportTotals>();
    const entry = (missionId: string) => {
      const key = this.moduleOf(missionId);
      let total = totals.get(key);
      if (!total) {
        total = { moduleId: key, totalActiveMs: 0, resultCount: 0 };
        totals.set(key, total);
      }
      return total;
    };
    for (const event of active)
      entry(event.missionId).totalActiveMs += event.activeMs;
    for (const event of results) entry(event.missionId).resultCount += 1;
    return {
      moduleTotals: sortedTotals(totals),
      totalActiveMs: active.reduce((sum, event) => sum + event.activeMs, 0),
      resultCount: results.length,
      activeTimeEventCount: active.length,
      results,
    };
  }

  async listClassReports(
    classGroupIds: readonly string[],
    moduleId?: string,
  ): Promise<ClassReport[]> {
    return this.state.classes
      .filter((classGroup) => classGroupIds.includes(classGroup.id))
      .map((classGroup) => {
        const slots = this.state.playerSlots.filter(
          (slot) => slot.classGroupId === classGroup.id,
        );
        const players = slots.map((slot) => {
          const entries = this.state.participations.filter(
            (entry) => entry.playerSlotId === slot.id,
          );
          const totals = this.totalsFor(
            new Set(entries.map((entry) => entry.id)),
            moduleId,
          );
          return {
            playerSlotId: slot.id,
            playerNumber: slot.playerNumber,
            playerStatus: slot.status,
            participationCount: entries.length,
            totalActiveMs: totals.totalActiveMs,
            resultCount: totals.resultCount,
            moduleTotals: totals.moduleTotals,
            lastPlayedAt: entries.length
              ? new Date(
                  Math.max(
                    ...entries.map((entry) =>
                      new Date(entry.joinedAt).getTime(),
                    ),
                  ),
                )
              : null,
          };
        });
        return {
          classGroupId: classGroup.id,
          className: classGroup.name,
          playerCount: players.length,
          participatingPlayerCount: players.filter(
            (player) => player.participationCount > 0,
          ).length,
          sessionCount: new Set(
            this.state.participations
              .filter((entry) =>
                slots.some((slot) => slot.id === entry.playerSlotId),
              )
              .map((entry) => entry.gameSessionId),
          ).size,
          totalActiveMs: players.reduce(
            (sum, player) => sum + player.totalActiveMs,
            0,
          ),
          resultCount: players.reduce(
            (sum, player) => sum + player.resultCount,
            0,
          ),
          moduleTotals: combineModuleTotals(
            players.flatMap((player) => player.moduleTotals),
          ),
          players,
        };
      });
  }

  async getPlayerReport(
    classGroupId: string,
    playerSlotId: string,
    page: PlayerHistoryPage = {},
    moduleId?: string,
  ): Promise<PlayerReport | null> {
    const [report] = await this.listClassReports([classGroupId], moduleId);
    const player = report?.players.find(
      (item) => item.playerSlotId === playerSlotId,
    );
    if (!report || !player) return null;
    const participations = this.state.participations
      .filter((entry) => entry.playerSlotId === playerSlotId)
      .flatMap((entry) => {
        const session = this.state.gameSessions.find(
          (item) =>
            item.id === entry.gameSessionId &&
            item.classGroupId === classGroupId,
        );
        if (!session) return [];
        const totals = this.totalsFor(new Set([entry.id]), moduleId);
        return [
          {
            gameSessionId: session.id,
            sessionStartedAt: new Date(session.startedAt),
            sessionEndedAt: session.endedAt ? new Date(session.endedAt) : null,
            joinedAt: new Date(entry.joinedAt),
            activeTimeMs: totals.totalActiveMs,
            activeTimeEventCount: totals.activeTimeEventCount,
            resultCount: totals.resultCount,
            results: totals.results
              .toSorted(
                (a, b) =>
                  b.receivedAt.localeCompare(a.receivedAt) ||
                  b.id.localeCompare(a.id),
              )
              .map((event) => ({
                id: event.id,
                activityId: event.activityId,
                missionId: event.missionId,
                moduleId: this.moduleOf(event.missionId),
                presetId: null,
                attemptId: event.attemptId,
                state: event.state,
                durationMs: event.durationMs,
                metrics: {},
                metricLabels: {},
                receivedAt: new Date(event.receivedAt),
              })),
            moduleTotals: totals.moduleTotals,
          },
        ];
      });
    participations.sort(
      (a, b) =>
        b.joinedAt.getTime() - a.joinedAt.getTime() ||
        b.gameSessionId.localeCompare(a.gameSessionId),
    );
    const sessionPages = Math.max(1, participations.length);
    const sessionPage = reportPage(page.sessionPage, sessionPages);
    return {
      classGroupId,
      className: report.className,
      playerSlotId: player.playerSlotId,
      playerNumber: player.playerNumber,
      playerStatus: player.playerStatus,
      participationCount: player.participationCount,
      totalActiveMs: player.totalActiveMs,
      resultCount: player.resultCount,
      moduleTotals: player.moduleTotals,
      participations: participations.slice(sessionPage - 1, sessionPage),
      history: { sessionPage, sessionPages, resultPage: 1, resultPages: 1 },
    };
  }
}
