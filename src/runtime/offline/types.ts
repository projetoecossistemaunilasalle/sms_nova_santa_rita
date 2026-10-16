import type {
  ActiveTimeBatchV1,
  PlayerBootstrapV1,
  ResultEventV1,
  StateSaveConflictV1,
  StateSaveRequestV1,
  StateSaveSuccessV1,
} from "@/contracts/v1";

export type QueuedStateSave = {
  id: number;
  playerId: string;
  requestId: string;
  request: StateSaveRequestV1;
  queuedAt: number;
  classSessionId?: string;
  branchGeneration?: number;
};

export type StateBranch = { generation: number; baseRevision: number };
export type StateRejection = { requestId: string; status?: number };

export type QueuedResult = {
  id: number;
  playerId: string;
  classSessionId: string;
  kind: "result";
  requestId: string;
  event: ResultEventV1;
  queuedAt: number;
};

export type QueuedActiveTime = {
  id: number;
  playerId: string;
  classSessionId: string;
  kind: "active_time";
  requestId: string;
  event: ActiveTimeBatchV1["events"][number];
  queuedAt: number;
};

export type QueuedEvent = QueuedResult | QueuedActiveTime;

export type EventRequestReceipt = {
  requestId: string;
  clientEventId: string;
};

export type EventRequestIdentity = {
  canonicalContent: string;
  fingerprint: string;
};

export type GameOfflineSyncStatus = {
  queuedStates: number;
  queuedResults: number;
  queuedActiveTime: number;
  stateBlocked: boolean;
  rejection?: StateRejection;
};

export type GameOfflineSyncReport = {
  state: "synced" | "pending" | "blocked";
  savedStates: number;
  uploadedResults: number;
  uploadedActiveTimeEvents: number;
  stateAcknowledgements: StateSaveSuccessV1[];
  eventAcknowledgements: Array<{
    record_type: "result" | "active_time";
    request_id: string;
    client_event_id: string;
  }>;
  conflict?: StateSaveConflictV1;
  rejection?: StateRejection;
  failedStream?: "state" | "events";
  retryable?: boolean;
};

export type GameOfflineTransport = {
  saveState(
    request: StateSaveRequestV1,
    classSessionId?: string,
  ): Promise<unknown>;
  uploadResult(event: ResultEventV1, classSessionId?: string): Promise<unknown>;
  uploadActiveTime(
    batch: ActiveTimeBatchV1,
    classSessionId?: string,
  ): Promise<unknown>;
  includePreviousSessions?: boolean;
};

export interface GameOfflinePersistence {
  close?(): void;
  getBootstrap(playerId: string): Promise<PlayerBootstrapV1 | null>;
  reserveBootstrapGeneration(playerId: string): Promise<number>;
  cacheBootstrap(
    bootstrap: PlayerBootstrapV1,
    generation: number,
  ): Promise<PlayerBootstrapV1 | null>;
  enqueueState(
    playerId: string,
    request: StateSaveRequestV1,
    classSessionId?: string,
    branch?: StateBranch,
  ): Promise<QueuedStateSave>;
  listStates(playerId: string): Promise<QueuedStateSave[]>;
  acknowledgeState(
    playerId: string,
    queued: QueuedStateSave,
    success: StateSaveSuccessV1,
  ): Promise<void>;
  blockState(playerId: string, conflict: StateSaveConflictV1): Promise<void>;
  getStateConflict(playerId: string): Promise<StateSaveConflictV1 | null>;
  rejectStateBranch(playerId: string, rejection: StateRejection): Promise<void>;
  getStateRejection(playerId: string): Promise<StateRejection | null>;
  discardStateBranch(
    playerId: string,
    expectedRequestId?: string,
  ): Promise<void>;
  enqueueResult(
    playerId: string,
    classSessionId: string,
    event: ResultEventV1,
    identity: EventRequestIdentity,
  ): Promise<EventRequestReceipt>;
  enqueueActiveTime(
    playerId: string,
    classSessionId: string,
    event: QueuedActiveTime["event"],
    identity: EventRequestIdentity,
  ): Promise<EventRequestReceipt>;
  listEvents(playerId: string, classSessionId?: string): Promise<QueuedEvent[]>;
  acknowledgeEvent(queued: QueuedEvent): Promise<void>;
  status(playerId: string): Promise<GameOfflineSyncStatus>;
}
