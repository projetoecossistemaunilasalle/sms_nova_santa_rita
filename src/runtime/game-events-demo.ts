import type {
  ClassReport,
  PlayerClassReport,
  PlayerReport,
} from "@/application/game-events/ports";
import {
  DEMO_CLASS_IDS,
  demoAdultPortalSeed,
} from "@/runtime/adult-portal-demo-store";

const demoClasses = [
  { id: DEMO_CLASS_IDS.THIRD_A, name: "3º A" },
  { id: DEMO_CLASS_IDS.FIFTH_B, name: "5º B" },
  { id: DEMO_CLASS_IDS.FOURTH_A, name: "4º A" },
];

function classReport(classGroupId: string): ClassReport | null {
  const classGroup = demoClasses.find(({ id }) => id === classGroupId);
  if (!classGroup) return null;
  const slots = demoAdultPortalSeed.playerSlots.filter(
    (player) => player.classGroupId === classGroupId,
  );
  const players: PlayerClassReport[] = slots.map((player) => {
    const participations = demoAdultPortalSeed.participations.filter(
      (participation) => participation.playerSlotId === player.id,
    );
    const lastPlayedAt =
      participations
        .map(({ joinedAt }) => new Date(joinedAt))
        .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
    return {
      playerSlotId: player.id,
      playerNumber: player.playerNumber,
      playerStatus: player.status,
      participationCount: participations.length,
      totalActiveMs: 0,
      resultCount: 0,
      lastPlayedAt,
    };
  });
  const participations = demoAdultPortalSeed.participations.filter((entry) =>
    slots.some((slot) => slot.id === entry.playerSlotId),
  );
  return {
    classGroupId,
    className: classGroup.name,
    playerCount: players.length,
    participatingPlayerCount: players.filter(
      ({ participationCount }) => participationCount > 0,
    ).length,
    sessionCount: new Set(
      participations.map(({ gameSessionId }) => gameSessionId),
    ).size,
    totalActiveMs: 0,
    resultCount: 0,
    players,
  };
}

export async function getResultReportsPageData() {
  return demoClasses.map(({ id }) => classReport(id)!);
}

export async function getClassResultsPageData(classGroupId: string) {
  return classReport(classGroupId);
}

export async function getPlayerResultsPageData(
  classGroupId: string,
  playerSlotId: string,
): Promise<PlayerReport | null> {
  const report = classReport(classGroupId);
  const player = report?.players.find(
    ({ playerSlotId: id }) => id === playerSlotId,
  );
  if (!report || !player) return null;
  const participations = demoAdultPortalSeed.participations
    .filter((entry) => entry.playerSlotId === playerSlotId)
    .map((participation) => {
      const session = demoAdultPortalSeed.gameSessions.find(
        ({ id }) => id === participation.gameSessionId,
      );
      if (!session) return null;
      return {
        gameSessionId: participation.gameSessionId,
        sessionStartedAt: new Date(session.startedAt),
        sessionEndedAt: session.endedAt ? new Date(session.endedAt) : null,
        joinedAt: new Date(participation.joinedAt),
        activeTimeMs: 0,
        activeTimeEventCount: 0,
        resultCount: 0,
        results: [],
      };
    })
    .filter((entry) => entry !== null);
  return {
    classGroupId,
    className: report.className,
    playerSlotId,
    playerNumber: player.playerNumber,
    playerStatus: player.playerStatus,
    participationCount: player.participationCount,
    totalActiveMs: 0,
    resultCount: 0,
    participations,
  };
}

export function listStaticResultClassIds(): string[] {
  return demoClasses.map(({ id }) => id);
}

export function listStaticResultPlayerParams(): {
  classGroupId: string;
  playerSlotId: string;
}[] {
  return demoAdultPortalSeed.playerSlots.map(({ classGroupId, id }) => ({
    classGroupId,
    playerSlotId: id,
  }));
}
