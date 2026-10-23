import { describe, expect, it } from "vitest";
import type { PlayerClassReport } from "@/application/game-events/ports";
import {
  filterReportPlayers,
  formatActiveTime,
} from "@/components/portal/results-helpers";
import { RecordStatus } from "@/generated/prisma/enums";

const players: PlayerClassReport[] = [1, 7, 17].map((playerNumber) => ({
  playerSlotId: `player-${playerNumber}`,
  playerNumber,
  playerStatus: RecordStatus.ACTIVE,
  participationCount: playerNumber === 7 ? 0 : 1,
  totalActiveMs: 0,
  resultCount: 0,
  moduleTotals: [],
  lastPlayedAt: null,
}));

describe("class participation filters", () => {
  it("shows the complete roster by default without changing its order", () => {
    expect(filterReportPlayers(players, "", "all")).toEqual(players);
  });

  it("finds a player by exact number, including a padded number", () => {
    expect(filterReportPlayers(players, " 07 ", "all")).toEqual([players[1]]);
    expect(filterReportPlayers(players, "1", "all")).toEqual([players[0]]);
  });

  it("uses recorded participation, not activity duration or result count", () => {
    expect(filterReportPlayers(players, "", "recorded")).toEqual([
      players[0],
      players[2],
    ]);
    expect(filterReportPlayers(players, "", "none")).toEqual([players[1]]);
  });

  it("combines filters and safely handles unmatched or invalid numbers", () => {
    expect(filterReportPlayers(players, "7", "recorded")).toEqual([]);
    for (const query of ["99", "abc", "1.0", "-1", "1e0"]) {
      expect(filterReportPlayers(players, query, "all")).toEqual([]);
    }
    expect(filterReportPlayers([], "", "none")).toEqual([]);
  });
});

describe("active time display", () => {
  it("keeps seconds, minutes and hours readable without rounding up", () => {
    expect(formatActiveTime(0)).toBe("0 s");
    expect(formatActiveTime(59999)).toBe("59 s");
    expect(formatActiveTime(61000)).toBe("1 min 1 s");
    expect(formatActiveTime(3660000)).toBe("1 h 1 min");
  });
});
