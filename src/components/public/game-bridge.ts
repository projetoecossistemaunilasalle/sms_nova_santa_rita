import {
  safeParseActiveTimeSubmissionV1,
  safeParseBootstrapAppliedV1,
  safeParseGameReadyV1,
  safeParseProtocolErrorV1,
  safeParseResultSubmissionV1,
  safeParseStateSaveRequestV1,
  type ActiveTimeSubmissionV1,
  type BootstrapAppliedV1,
  type GameReadyV1,
  type ProtocolErrorV1,
  type ResultSubmissionV1,
  type StateSaveRequestV1,
} from "@/contracts/v1";

export type GameBridgeMessage =
  | GameReadyV1
  | BootstrapAppliedV1
  | StateSaveRequestV1
  | ResultSubmissionV1
  | ActiveTimeSubmissionV1
  | ProtocolErrorV1;

export function parseGameBridgeMessage(
  value: unknown,
): GameBridgeMessage | null {
  const ready = safeParseGameReadyV1(value);
  if (ready.success) return ready.data;

  const bootstrapApplied = safeParseBootstrapAppliedV1(value);
  if (bootstrapApplied.success) return bootstrapApplied.data;

  const stateSave = safeParseStateSaveRequestV1(value);
  if (stateSave.success) return stateSave.data;

  const result = safeParseResultSubmissionV1(value);
  if (result.success) return result.data;

  const activeTime = safeParseActiveTimeSubmissionV1(value);
  if (activeTime.success) return activeTime.data;

  const protocolError = safeParseProtocolErrorV1(value);
  if (protocolError.success) return protocolError.data;

  return null;
}

export function expectedGameOrigin(gameUrl: string): string | null {
  try {
    const url = new URL(gameUrl);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username !== "" ||
      url.password !== ""
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

export function isTrustedGameMessage(
  event: Pick<MessageEvent, "origin" | "source">,
  frameWindow: MessageEventSource | null,
  gameOrigin: string,
): boolean {
  return (
    frameWindow !== null &&
    event.origin === gameOrigin &&
    event.source === frameWindow
  );
}

export function createBridgeRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  const randomPart = Math.random().toString(36).slice(2);
  return `host-${Date.now().toString(36)}-${randomPart}`;
}
