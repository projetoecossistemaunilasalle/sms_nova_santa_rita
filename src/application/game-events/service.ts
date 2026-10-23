import { PlayerCredentialStatus, RecordStatus } from "@/generated/prisma/enums";
import { AdultPortalError } from "@/application/adult-portal/errors";
import type { PlayerHistoryPage } from "./report-pagination";
import type { LaunchTokenContext } from "@/server/security/launch-token";
import {
  canFlushSession,
  DEFAULT_OFFLINE_FLUSH_WINDOW_SECONDS,
} from "@/application/player-access/flush-policy";
import {
  parseResultEventV2,
  parseActiveTimeBatchV2,
  type ActiveTimeAcknowledgementV2,
  type ActiveTimeBatchV2,
  type ResultAcknowledgementV2,
  type ResultEventV2,
} from "@/contracts/v2";
import { logger } from "@/server/observability/logger";

import type {
  GameEventReportStore,
  GameEventStore,
  GameEventTransaction,
} from "./ports";

export type LaunchVerification =
  | { valid: true; payload: LaunchTokenContext }
  | { valid: false; reason: "invalid" | "expired" };

export class GameEventError extends Error {
  constructor(
    readonly code:
      | "INVALID_LAUNCH"
      | "EXPIRED_LAUNCH"
      | "INACTIVE_ACCESS"
      | "EVENT_ID_CONFLICT",
  ) {
    super(code);
  }
}

export class GameEventService {
  constructor(
    private readonly store: GameEventStore,
    private readonly verify: (token: string) => LaunchVerification,
    private readonly now: () => Date = () => new Date(),
    private readonly flushWindowSeconds = DEFAULT_OFFLINE_FLUSH_WINDOW_SECONDS,
  ) {}

  private async requireLaunch(
    token: string,
    transaction: GameEventTransaction,
  ) {
    const verified = this.verify(token);
    if (!verified.valid) {
      throw new GameEventError(
        verified.reason === "expired" ? "EXPIRED_LAUNCH" : "INVALID_LAUNCH",
      );
    }
    const scope = await transaction.getLaunchScope(verified.payload);
    if (!scope) throw new GameEventError("INVALID_LAUNCH");
    if (
      scope.credentialStatus !== PlayerCredentialStatus.ACTIVE ||
      scope.playerStatus !== RecordStatus.ACTIVE ||
      scope.classStatus !== RecordStatus.ACTIVE ||
      scope.organizationStatus !== RecordStatus.ACTIVE
    ) {
      throw new GameEventError("INACTIVE_ACCESS");
    }
    if (
      !canFlushSession(
        scope.sessionStatus,
        scope.sessionEndedAt,
        this.now(),
        this.flushWindowSeconds,
      )
    ) {
      throw new GameEventError("INACTIVE_ACCESS");
    }
    return scope;
  }

  async submitResult(
    token: string,
    input: ResultEventV2,
  ): Promise<ResultAcknowledgementV2> {
    const event = parseResultEventV2(input);
    await this.store.transaction(async (transaction) => {
      const scope = await this.requireLaunch(token, transaction);
      const manifest = scope.contentManifest;
      const moduleId =
        manifest.missions.find((item) => item.mission_id === event.mission_id)
          ?.module_id ?? null;
      const activity = manifest.activities.find(
        (item) => item.activity_id === event.activity_id,
      );
      const known = new Set(
        activity?.metrics.map((metric) => metric.key) ?? [],
      );
      const unknownMetricKeys = Object.keys(event.result.metricas).filter(
        (key) => !known.has(key),
      );
      if (unknownMetricKeys.length)
        logger.warn(
          {
            activityId: event.activity_id,
            contentVersion: manifest.content_version,
            unknownMetricKeys,
          },
          "Game result contains metric keys absent from the session manifest",
        );
      await transaction.acceptResult(scope.participationId, event, moduleId);
    });
    return {
      type: "portal.result_ack.v2",
      client_event_id: event.client_event_id,
    };
  }

  async submitActiveTime(
    token: string,
    input: ActiveTimeBatchV2,
  ): Promise<ActiveTimeAcknowledgementV2> {
    const batch = parseActiveTimeBatchV2(input);
    await this.store.transaction(async (transaction) => {
      const scope = await this.requireLaunch(token, transaction);
      const moduleIds = new Map(
        batch.events.map((event) => [
          event.client_event_id,
          scope.contentManifest.missions.find(
            (item) => item.mission_id === event.mission_id,
          )?.module_id ?? null,
        ]),
      );
      await transaction.acceptActiveTime(
        scope.participationId,
        batch,
        moduleIds,
      );
    });
    return {
      type: "portal.active_time_ack.v2",
      acknowledged_event_ids: batch.events.map(
        ({ client_event_id }) => client_event_id,
      ),
    };
  }
}

export class GameEventReportService {
  constructor(
    private readonly reports: GameEventReportStore,
    private readonly canReadClass: (
      profileId: string,
      classGroupId: string,
    ) => Promise<void>,
    private readonly listReadableClasses: (
      profileId: string,
    ) => Promise<readonly { id: string }[]>,
  ) {}

  async listClassReports(profileId: string, moduleId?: string) {
    const classes = await this.listReadableClasses(profileId);
    return this.reports.listClassReports(
      classes.map(({ id }) => id),
      moduleId,
    );
  }

  async getClassReport(
    profileId: string,
    classGroupId: string,
    moduleId?: string,
  ) {
    await this.canReadClass(profileId, classGroupId);
    const [report] = await this.reports.listClassReports(
      [classGroupId],
      moduleId,
    );
    if (!report) {
      throw new AdultPortalError("Turma não encontrada.", "NOT_FOUND");
    }
    return report;
  }

  async getPlayerReport(
    profileId: string,
    classGroupId: string,
    playerSlotId: string,
    page?: PlayerHistoryPage,
    moduleId?: string,
  ) {
    await this.canReadClass(profileId, classGroupId);
    const report = await this.reports.getPlayerReport(
      classGroupId,
      playerSlotId,
      page,
      moduleId,
    );
    if (!report) {
      throw new AdultPortalError("Jogador não encontrado.", "NOT_FOUND");
    }
    return report;
  }
}
