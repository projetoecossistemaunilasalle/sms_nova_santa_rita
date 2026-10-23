import {
  PlayerCredentialStatus,
  RecordStatus,
  GameSessionStatus,
} from "@/generated/prisma/enums";
import {
  PROTOCOL_VERSION,
  parseStateSaveRequestV2,
  type GameStateV2,
  type PlayerBootstrapV2,
  type StateSaveRequestV2,
  type SessionContentPolicyV1,
} from "@/contracts/v2";
import type { LaunchTokenContext } from "@/server/security/launch-token";
import {
  canFlushSession,
  DEFAULT_OFFLINE_FLUSH_WINDOW_SECONDS,
} from "@/application/player-access/flush-policy";

export type LaunchVerification =
  | { valid: true; payload: LaunchTokenContext }
  | { valid: false; reason: "invalid" | "expired" };

export type LaunchScope = LaunchTokenContext & {
  credentialStatus: PlayerCredentialStatus;
  playerStatus: RecordStatus;
  classStatus: RecordStatus;
  organizationStatus: RecordStatus;
  sessionStatus: GameSessionStatus;
  sessionEndedAt?: Date | null;
  contentPolicy: SessionContentPolicyV1;
};

export type StoredGameState = {
  revision: number;
  state: GameStateV2;
  contentVersion: string;
};

export interface GameStateTransaction {
  getLaunchScope(context: LaunchTokenContext): Promise<LaunchScope | null>;
  getState(playerSlotId: string): Promise<StoredGameState | null>;
  createState(
    playerSlotId: string,
    state: GameStateV2,
    contentVersion: string,
  ): Promise<boolean>;
  updateState(
    playerSlotId: string,
    expectedRevision: number,
    state: GameStateV2,
    contentVersion: string,
  ): Promise<boolean>;
}

export interface GameStateStore {
  transaction<T>(
    work: (transaction: GameStateTransaction) => Promise<T>,
  ): Promise<T>;
}

export class GameStateError extends Error {
  constructor(
    readonly code:
      | "INVALID_LAUNCH"
      | "EXPIRED_LAUNCH"
      | "INACTIVE_ACCESS"
      | "SESSION_ENDED"
      | "INVALID_REVISION",
  ) {
    super(code);
  }
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "undefined";
  }
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([left], [right]) => left.localeCompare(right),
  );
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
}

export class GameStateService {
  constructor(
    private readonly store: GameStateStore,
    private readonly verify: (token: string) => LaunchVerification,
    private readonly now: () => Date = () => new Date(),
    private readonly flushWindowSeconds = DEFAULT_OFFLINE_FLUSH_WINDOW_SECONDS,
  ) {}

  private async requireLaunch(
    token: string,
    transaction: GameStateTransaction,
    operation: "bootstrap" | "save",
  ): Promise<LaunchScope> {
    const verified = this.verify(token);
    if (!verified.valid) {
      throw new GameStateError(
        verified.reason === "expired" ? "EXPIRED_LAUNCH" : "INVALID_LAUNCH",
      );
    }
    const scope = await transaction.getLaunchScope(verified.payload);
    if (!scope) throw new GameStateError("INVALID_LAUNCH");
    if (
      scope.credentialStatus !== PlayerCredentialStatus.ACTIVE ||
      scope.playerStatus !== RecordStatus.ACTIVE ||
      scope.classStatus !== RecordStatus.ACTIVE ||
      scope.organizationStatus !== RecordStatus.ACTIVE
    ) {
      throw new GameStateError("INACTIVE_ACCESS");
    }
    if (
      operation === "bootstrap"
        ? verified.payload.purpose === "flush" ||
          scope.sessionStatus !== GameSessionStatus.ACTIVE
        : !canFlushSession(
            scope.sessionStatus,
            scope.sessionEndedAt,
            this.now(),
            this.flushWindowSeconds,
          )
    ) {
      throw new GameStateError("SESSION_ENDED");
    }
    return scope;
  }

  async bootstrap(
    token: string,
    requestId: string,
  ): Promise<PlayerBootstrapV2> {
    return this.store.transaction(async (transaction) => {
      const scope = await this.requireLaunch(token, transaction, "bootstrap");
      const current = await transaction.getState(scope.playerSlotId);
      return current
        ? {
            type: "portal.bootstrap.v2",
            request_id: requestId,
            protocol_version: PROTOCOL_VERSION,
            player_id: scope.playerSlotId,
            class_session_id: scope.gameSessionId,
            revision: current.revision,
            new_player: false,
            state: current.state,
            content_policy: scope.contentPolicy,
            stored_content_version: current.contentVersion,
          }
        : {
            type: "portal.bootstrap.v2",
            request_id: requestId,
            protocol_version: PROTOCOL_VERSION,
            player_id: scope.playerSlotId,
            class_session_id: scope.gameSessionId,
            revision: 0,
            new_player: true,
            state: null,
            content_policy: scope.contentPolicy,
            stored_content_version: null,
          };
    });
  }

  async save(token: string, input: StateSaveRequestV2) {
    const request = parseStateSaveRequestV2(input);
    return this.store.transaction(async (transaction) => {
      const scope = await this.requireLaunch(token, transaction, "save");
      const current = await transaction.getState(scope.playerSlotId);
      if (!current && request.expected_revision !== 0) {
        throw new GameStateError("INVALID_REVISION");
      }
      if (current && current.revision !== request.expected_revision) {
        if (
          current.revision === request.expected_revision + 1 &&
          current.contentVersion === request.content_version &&
          stableJson(current.state) === stableJson(request.state)
        ) {
          return {
            type: "portal.save_ok.v2" as const,
            request_id: request.request_id,
            revision: current.revision,
          };
        }
        return {
          type: "portal.save_conflict.v2" as const,
          request_id: request.request_id,
          revision: current.revision,
          state: current.state,
          stored_content_version: current.contentVersion,
        };
      }
      const saved = current
        ? await transaction.updateState(
            scope.playerSlotId,
            current.revision,
            request.state,
            request.content_version,
          )
        : await transaction.createState(
            scope.playerSlotId,
            request.state,
            request.content_version,
          );
      if (!saved) {
        const latest = await transaction.getState(scope.playerSlotId);
        if (!latest) throw new GameStateError("INVALID_REVISION");
        if (
          latest.revision === request.expected_revision + 1 &&
          latest.contentVersion === request.content_version &&
          stableJson(latest.state) === stableJson(request.state)
        ) {
          return {
            type: "portal.save_ok.v2" as const,
            request_id: request.request_id,
            revision: latest.revision,
          };
        }
        return {
          type: "portal.save_conflict.v2" as const,
          request_id: request.request_id,
          revision: latest.revision,
          state: latest.state,
          stored_content_version: latest.contentVersion,
        };
      }
      return {
        type: "portal.save_ok.v2" as const,
        request_id: request.request_id,
        revision: request.expected_revision + 1,
      };
    });
  }
}
