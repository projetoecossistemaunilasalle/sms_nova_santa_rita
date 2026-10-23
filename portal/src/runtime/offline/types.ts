import type {
  ActiveTimeBatchV2,
  PlayerBootstrapV2,
  ResultEventV2,
  StateSaveConflictV2,
  StateSaveRequestV2,
  StateSaveSuccessV2,
} from "@/contracts/v2";

export type QueuedStateSave = {
  id: number;
  playerId: string;
  requestId: string;
  request: StateSaveRequestV2;
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
  event: ResultEventV2;
  queuedAt: number;
};

export type QueuedActiveTime = {
  id: number;
  playerId: string;
  classSessionId: string;
  kind: "active_time";
  requestId: string;
  event: ActiveTimeBatchV2["events"][number];
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
  stateAcknowledgements: StateSaveSuccessV2[];
  eventAcknowledgements: Array<{
    record_type: "result" | "active_time";
    request_id: string;
    client_event_id: string;
  }>;
  conflict?: StateSaveConflictV2;
  rejection?: StateRejection;
  failedStream?: "state" | "events";
  retryable?: boolean;
};

export type GameOfflineTransport = {
  saveState(
    request: StateSaveRequestV2,
    classSessionId?: string,
  ): Promise<unknown>;
  uploadResult(event: ResultEventV2, classSessionId?: string): Promise<unknown>;
  uploadActiveTime(
    batch: ActiveTimeBatchV2,
    classSessionId?: string,
  ): Promise<unknown>;
  includePreviousSessions?: boolean;
};

export interface GameOfflinePersistence {
  close?(): void;
  getBootstrap(playerId: string): Promise<PlayerBootstrapV2 | null>;
  reserveBootstrapGeneration(playerId: string): Promise<number>;
  cacheBootstrap(
    bootstrap: PlayerBootstrapV2,
    generation: number,
  ): Promise<PlayerBootstrapV2 | null>;
  enqueueState(
    playerId: string,
    request: StateSaveRequestV2,
    classSessionId?: string,
    branch?: StateBranch,
  ): Promise<QueuedStateSave>;
  listStates(playerId: string): Promise<QueuedStateSave[]>;
  acknowledgeState(
    playerId: string,
    queued: QueuedStateSave,
    success: StateSaveSuccessV2,
  ): Promise<void>;
  blockState(playerId: string, conflict: StateSaveConflictV2): Promise<void>;
  getStateConflict(playerId: string): Promise<StateSaveConflictV2 | null>;
  rejectStateBranch(playerId: string, rejection: StateRejection): Promise<void>;
  getStateRejection(playerId: string): Promise<StateRejection | null>;
  discardStateBranch(
    playerId: string,
    expectedRequestId?: string,
  ): Promise<void>;
  enqueueResult(
    playerId: string,
    classSessionId: string,
    event: ResultEventV2,
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
