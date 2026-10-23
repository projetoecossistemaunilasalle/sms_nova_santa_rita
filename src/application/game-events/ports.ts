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
  attemptId: string;
  state: string;
  durationMs: number;
  metrics: Record<string, number>;
  receivedAt: Date;
};

export type PlayerClassReport = {
  playerSlotId: string;
  playerNumber: number;
  playerStatus: RecordStatus;
  participationCount: number;
  totalActiveMs: number;
  resultCount: number;
  lastPlayedAt: Date | null;
};

export type ClassReport = {
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
  listClassReports(classGroupIds: readonly string[]): Promise<ClassReport[]>;
  getPlayerReport(
    classGroupId: string,
    playerSlotId: string,
    page?: PlayerHistoryPage,
  ): Promise<PlayerReport | null>;
}

export type GameEventReportStore = GameEventReportReader;
