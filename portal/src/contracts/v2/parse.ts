import {
  activeTimeAcknowledgementV2Schema,
  activeTimeBatchV2Schema,
  activeTimeEventV2Schema,
  activeTimeSubmissionV2Schema,
  activityContextV2Schema,
  bootstrapAppliedV2Schema,
  contentManifestV1Schema,
  gameReadyV2Schema,
  gameStateV2Schema,
  hostVisibilityV2Schema,
  localDurabilityAcknowledgementV2Schema,
  newPlayerBootstrapV2Schema,
  playerBootstrapV2Schema,
  protocolErrorV2Schema,
  resultAcknowledgementV2Schema,
  resultEventV2Schema,
  resultSubmissionV2Schema,
  serializedStateUtf8Bytes,
  sessionContentPolicyV1Schema,
  stateSaveConflictV2Schema,
  stateSaveRequestV2Schema,
  stateSaveSuccessV2Schema,
  type GameStateV2,
} from "./schemas";

export { serializedStateUtf8Bytes };

export function parseGameStateV2(input: unknown): GameStateV2 {
  return gameStateV2Schema.parse(input);
}

export function safeParseGameStateV2(input: unknown) {
  return gameStateV2Schema.safeParse(input);
}

export const parseSessionContentPolicyV1 = (input: unknown) =>
  sessionContentPolicyV1Schema.parse(input);
export const safeParseSessionContentPolicyV1 = (input: unknown) =>
  sessionContentPolicyV1Schema.safeParse(input);
export const parseContentManifestV1 = (input: unknown) =>
  contentManifestV1Schema.parse(input);
export const safeParseContentManifestV1 = (input: unknown) =>
  contentManifestV1Schema.safeParse(input);
export const parsePlayerBootstrapV2 = (input: unknown) =>
  playerBootstrapV2Schema.parse(input);
export const safeParsePlayerBootstrapV2 = (input: unknown) =>
  playerBootstrapV2Schema.safeParse(input);
export const parseNewPlayerBootstrapV2 = (input: unknown) =>
  newPlayerBootstrapV2Schema.parse(input);
export const safeParseNewPlayerBootstrapV2 = (input: unknown) =>
  newPlayerBootstrapV2Schema.safeParse(input);
export const parseGameReadyV2 = (input: unknown) => gameReadyV2Schema.parse(input);
export const safeParseGameReadyV2 = (input: unknown) =>
  gameReadyV2Schema.safeParse(input);
export const parseBootstrapAppliedV2 = (input: unknown) =>
  bootstrapAppliedV2Schema.parse(input);
export const safeParseBootstrapAppliedV2 = (input: unknown) =>
  bootstrapAppliedV2Schema.safeParse(input);
export const parseStateSaveRequestV2 = (input: unknown) =>
  stateSaveRequestV2Schema.parse(input);
export const safeParseStateSaveRequestV2 = (input: unknown) =>
  stateSaveRequestV2Schema.safeParse(input);
export const parseStateSaveSuccessV2 = (input: unknown) =>
  stateSaveSuccessV2Schema.parse(input);
export const safeParseStateSaveSuccessV2 = (input: unknown) =>
  stateSaveSuccessV2Schema.safeParse(input);
export const parseStateSaveConflictV2 = (input: unknown) =>
  stateSaveConflictV2Schema.parse(input);
export const safeParseStateSaveConflictV2 = (input: unknown) =>
  stateSaveConflictV2Schema.safeParse(input);
export const parseActivityContextV2 = (input: unknown) =>
  activityContextV2Schema.parse(input);
export const safeParseActivityContextV2 = (input: unknown) =>
  activityContextV2Schema.safeParse(input);
export const parseResultEventV2 = (input: unknown) => resultEventV2Schema.parse(input);
export const safeParseResultEventV2 = (input: unknown) =>
  resultEventV2Schema.safeParse(input);
export const parseResultSubmissionV2 = (input: unknown) =>
  resultSubmissionV2Schema.parse(input);
export const safeParseResultSubmissionV2 = (input: unknown) =>
  resultSubmissionV2Schema.safeParse(input);
export const parseResultAcknowledgementV2 = (input: unknown) =>
  resultAcknowledgementV2Schema.parse(input);
export const safeParseResultAcknowledgementV2 = (input: unknown) =>
  resultAcknowledgementV2Schema.safeParse(input);
export const parseActiveTimeEventV2 = (input: unknown) =>
  activeTimeEventV2Schema.parse(input);
export const safeParseActiveTimeEventV2 = (input: unknown) =>
  activeTimeEventV2Schema.safeParse(input);
export const parseActiveTimeBatchV2 = (input: unknown) =>
  activeTimeBatchV2Schema.parse(input);
export const safeParseActiveTimeBatchV2 = (input: unknown) =>
  activeTimeBatchV2Schema.safeParse(input);
export const parseActiveTimeSubmissionV2 = (input: unknown) =>
  activeTimeSubmissionV2Schema.parse(input);
export const safeParseActiveTimeSubmissionV2 = (input: unknown) =>
  activeTimeSubmissionV2Schema.safeParse(input);
export const parseActiveTimeAcknowledgementV2 = (input: unknown) =>
  activeTimeAcknowledgementV2Schema.parse(input);
export const safeParseActiveTimeAcknowledgementV2 = (input: unknown) =>
  activeTimeAcknowledgementV2Schema.safeParse(input);
export const parseLocalDurabilityAcknowledgementV2 = (input: unknown) =>
  localDurabilityAcknowledgementV2Schema.parse(input);
export const safeParseLocalDurabilityAcknowledgementV2 = (input: unknown) =>
  localDurabilityAcknowledgementV2Schema.safeParse(input);
export const parseHostVisibilityV2 = (input: unknown) =>
  hostVisibilityV2Schema.parse(input);
export const safeParseHostVisibilityV2 = (input: unknown) =>
  hostVisibilityV2Schema.safeParse(input);
export const parseProtocolErrorV2 = (input: unknown) =>
  protocolErrorV2Schema.parse(input);
export const safeParseProtocolErrorV2 = (input: unknown) =>
  protocolErrorV2Schema.safeParse(input);
