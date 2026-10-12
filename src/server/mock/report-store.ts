import type {
  ClassReport,
  GameEventReportStore,
  PlayerReport,
} from "@/application/game-events/ports";
import type { DemoAdultPortalState } from "@/server/mock/seed-store";

// No invented scores: reports reflect the current roster and participation.
// Game ingestion is outside the portal mock's scope.
export class MockGameEventReportStore implements GameEventReportStore {
  constructor(private readonly state: DemoAdultPortalState) {}

  async listClassReports(
    classGroupIds: readonly string[],
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
          return {
            playerSlotId: slot.id,
            playerNumber: slot.playerNumber,
            playerStatus: slot.status,
            participationCount: entries.length,
            totalActiveMs: 0,
            resultCount: 0,
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
          totalActiveMs: 0,
          resultCount: 0,
          players,
        };
      });
  }

  async getPlayerReport(
    classGroupId: string,
    playerSlotId: string,
  ): Promise<PlayerReport | null> {
    const [report] = await this.listClassReports([classGroupId]);
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
        return session
          ? [
              {
                gameSessionId: session.id,
                sessionStartedAt: new Date(session.startedAt),
                sessionEndedAt: session.endedAt
                  ? new Date(session.endedAt)
                  : null,
                joinedAt: new Date(entry.joinedAt),
                activeTimeMs: 0,
                activeTimeEventCount: 0,
                resultCount: 0,
                results: [],
              },
            ]
          : [];
      });
    return {
      classGroupId,
      className: report.className,
      playerSlotId: player.playerSlotId,
      playerNumber: player.playerNumber,
      playerStatus: player.playerStatus,
      participationCount: player.participationCount,
      totalActiveMs: player.totalActiveMs,
      resultCount: player.resultCount,
      participations,
    };
  }
}
