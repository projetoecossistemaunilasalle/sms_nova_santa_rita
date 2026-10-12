import type { PlayerClassReport } from "@/application/game-events/ports";
import { matchesPlayerNumber } from "./portal-filters";

export type ParticipationFilter = "all" | "recorded" | "none";

export function filterReportPlayers(
  players: PlayerClassReport[],
  query: string,
  participation: ParticipationFilter,
) {
  return players.filter((player) => {
    const hasParticipation = player.participationCount > 0;
    return (
      matchesPlayerNumber(player.playerNumber, query) &&
      (participation === "all" ||
        (participation === "recorded" ? hasParticipation : !hasParticipation))
    );
  });
}

export function formatActiveTime(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min ${seconds} s`;
  return `${seconds} s`;
}
