import {
  activeTimeAcknowledgementV1Schema,
  activeTimeBatchV1Schema,
  activeTimeSubmissionV1Schema,
  bootstrapAppliedV1Schema,
  gameReadyV1Schema,
  gameStateV1Schema,
  hostVisibilityV1Schema,
  localDurabilityAcknowledgementV1Schema,
  newPlayerBootstrapV1Schema,
  playerBootstrapV1Schema,
  protocolErrorV1Schema,
  resultAcknowledgementV1Schema,
  resultEventV1Schema,
  resultSubmissionV1Schema,
  serializedStateUtf8Bytes,
  stateSaveConflictV1Schema,
  stateSaveRequestV1Schema,
  stateSaveSuccessV1Schema,
  type GameStateV1,
} from "./schemas";

export { serializedStateUtf8Bytes };

export function parseGameStateV1(input: unknown): GameStateV1 {
  return gameStateV1Schema.parse(input);
}

export function safeParseGameStateV1(input: unknown) {
  return gameStateV1Schema.safeParse(input);
}

export const parsePlayerBootstrapV1 = (input: unknown) =>
  playerBootstrapV1Schema.parse(input);
export const safeParsePlayerBootstrapV1 = (input: unknown) =>
  playerBootstrapV1Schema.safeParse(input);

export const parseNewPlayerBootstrapV1 = (input: unknown) =>
  newPlayerBootstrapV1Schema.parse(input);
export const safeParseNewPlayerBootstrapV1 = (input: unknown) =>
  newPlayerBootstrapV1Schema.safeParse(input);
export const parseGameReadyV1 = (input: unknown) => gameReadyV1Schema.parse(input);
export const safeParseGameReadyV1 = (input: unknown) =>
  gameReadyV1Schema.safeParse(input);
export const parseBootstrapAppliedV1 = (input: unknown) =>
  bootstrapAppliedV1Schema.parse(input);
export const safeParseBootstrapAppliedV1 = (input: unknown) =>
  bootstrapAppliedV1Schema.safeParse(input);
export const parseStateSaveRequestV1 = (input: unknown) =>
  stateSaveRequestV1Schema.parse(input);
export const safeParseStateSaveRequestV1 = (input: unknown) =>
  stateSaveRequestV1Schema.safeParse(input);
export const parseStateSaveSuccessV1 = (input: unknown) =>
  stateSaveSuccessV1Schema.parse(input);
export const safeParseStateSaveSuccessV1 = (input: unknown) =>
  stateSaveSuccessV1Schema.safeParse(input);
export const parseStateSaveConflictV1 = (input: unknown) =>
  stateSaveConflictV1Schema.parse(input);
export const safeParseStateSaveConflictV1 = (input: unknown) =>
  stateSaveConflictV1Schema.safeParse(input);
export const parseResultEventV1 = (input: unknown) =>
  resultEventV1Schema.parse(input);
export const safeParseResultEventV1 = (input: unknown) =>
  resultEventV1Schema.safeParse(input);
export const parseResultSubmissionV1 = (input: unknown) =>
  resultSubmissionV1Schema.parse(input);
export const safeParseResultSubmissionV1 = (input: unknown) =>
  resultSubmissionV1Schema.safeParse(input);
export const parseResultAcknowledgementV1 = (input: unknown) =>
  resultAcknowledgementV1Schema.parse(input);
export const safeParseResultAcknowledgementV1 = (input: unknown) =>
  resultAcknowledgementV1Schema.safeParse(input);
export const parseActiveTimeBatchV1 = (input: unknown) =>
  activeTimeBatchV1Schema.parse(input);
export const safeParseActiveTimeBatchV1 = (input: unknown) =>
  activeTimeBatchV1Schema.safeParse(input);
export const parseActiveTimeSubmissionV1 = (input: unknown) =>
  activeTimeSubmissionV1Schema.parse(input);
export const safeParseActiveTimeSubmissionV1 = (input: unknown) =>
  activeTimeSubmissionV1Schema.safeParse(input);
export const parseActiveTimeAcknowledgementV1 = (input: unknown) =>
  activeTimeAcknowledgementV1Schema.parse(input);
export const safeParseActiveTimeAcknowledgementV1 = (input: unknown) =>
  activeTimeAcknowledgementV1Schema.safeParse(input);
export const parseLocalDurabilityAcknowledgementV1 = (input: unknown) =>
  localDurabilityAcknowledgementV1Schema.parse(input);
export const safeParseLocalDurabilityAcknowledgementV1 = (input: unknown) =>
  localDurabilityAcknowledgementV1Schema.safeParse(input);
export const parseHostVisibilityV1 = (input: unknown) =>
  hostVisibilityV1Schema.parse(input);
export const safeParseHostVisibilityV1 = (input: unknown) =>
  hostVisibilityV1Schema.safeParse(input);
export const parseProtocolErrorV1 = (input: unknown) =>
  protocolErrorV1Schema.parse(input);
export const safeParseProtocolErrorV1 = (input: unknown) =>
  protocolErrorV1Schema.safeParse(input);
