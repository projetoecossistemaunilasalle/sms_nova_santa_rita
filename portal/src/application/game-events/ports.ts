import type {
  ActiveTimeBatchV2,
  ResultEventV2,
  ContentManifestV1,
} from "@/contracts/v2";
import type { PlayerHistoryPage } from "./report-pagination";
import type {
  GameSessionStatus,
  PlayerCredentialStatus,
  RecordStatus,
} from "@/generated/prisma/enums";
import type { LaunchTokenContext } from "@/server/security/launch-token";

export type EventLaunchScope = LaunchTokenContext & {
  credentialStatus: PlayerCredentialStatus;
  playerStatus: RecordStatus;
  classStatus: RecordStatus;
  organizationStatus: RecordStatus;
  sessionStatus: GameSessionStatus;
  sessionEndedAt?: Date | null;
  contentManifest: ContentManifestV1;
};

export interface GameEventTransaction {
  getLaunchScope(context: LaunchTokenContext): Promise<EventLaunchScope | null>;
  acceptResult(
    participationId: string,
    event: ResultEventV2,
    moduleId: string | null,
  ): Promise<void>;
  acceptActiveTime(
    participationId: string,
    batch: ActiveTimeBatchV2,
    moduleIds: ReadonlyMap<string, string | null>,
  ): Promise<void>;
}

export interface GameEventStore {
  transaction<T>(
    work: (transaction: GameEventTransaction) => Promise<T>,
  ): Promise<T>;
}

export type EventReportResult = {
  id: string;
  activityId: string;
  missionId: string;
  moduleId: string | null;
  presetId: string | null;
  attemptId: string;
  state: string;
  durationMs: number;
  metrics: Record<string, number>;
  metricLabels: Record<string, string>;
  receivedAt: Date;
};

export type ModuleReportTotals = {
  moduleId: string | null;
  totalActiveMs: number;
  resultCount: number;
};

export type PlayerClassReport = {
  moduleTotals: ModuleReportTotals[];
  playerSlotId: string;
  playerNumber: number;
  playerStatus: RecordStatus;
  participationCount: number;
  totalActiveMs: number;
  resultCount: number;
  lastPlayedAt: Date | null;
};

export type ClassReport = {
  moduleTotals: ModuleReportTotals[];
  classGroupId: string;
  className: string;
  playerCount: number;
  participatingPlayerCount: number;
  sessionCount: number;
  totalActiveMs: number;
  resultCount: number;
  players: PlayerClassReport[];
};

export type PlayerParticipationReport = {
  moduleTotals: ModuleReportTotals[];
  gameSessionId: string;
  sessionStartedAt: Date;
  sessionEndedAt: Date | null;
  joinedAt: Date;
  activeTimeMs: number;
  activeTimeEventCount: number;
  resultCount: number;
  results: EventReportResult[];
};

export type PlayerReport = {
  moduleTotals: ModuleReportTotals[];
  history: {
    sessionPage: number;
    sessionPages: number;
    resultPage: number;
    resultPages: number;
  };
  classGroupId: string;
  className: string;
  playerSlotId: string;
  playerNumber: number;
  playerStatus: RecordStatus;
  participationCount: number;
  totalActiveMs: number;
  resultCount: number;
  participations: PlayerParticipationReport[];
};

export interface GameEventReportReader {
  // Filters event totals/history, not roster, session or participation counts.
  // Null module IDs in totals retain unattributed (e.g. free-play) time.
  listClassReports(
    classGroupIds: readonly string[],
    moduleId?: string,
  ): Promise<ClassReport[]>;
  getPlayerReport(
    classGroupId: string,
    playerSlotId: string,
    page?: PlayerHistoryPage,
    moduleId?: string,
  ): Promise<PlayerReport | null>;
}

export type GameEventReportStore = GameEventReportReader;
