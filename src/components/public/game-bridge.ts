import {
  safeParseActiveTimeSubmissionV2,
  safeParseBootstrapAppliedV2,
  safeParseGameReadyV2,
  safeParseProtocolErrorV2,
  safeParseResultSubmissionV2,
  safeParseStateSaveRequestV2,
  type ActiveTimeSubmissionV2,
  type BootstrapAppliedV2,
  type GameReadyV2,
  type ProtocolErrorV2,
  type ResultSubmissionV2,
  type StateSaveRequestV2,
} from "@/contracts/v2";

export type GameBridgeMessage =
  | GameReadyV2
  | BootstrapAppliedV2
  | StateSaveRequestV2
  | ResultSubmissionV2
  | ActiveTimeSubmissionV2
  | ProtocolErrorV2;

export function parseGameBridgeMessage(
  value: unknown,
): GameBridgeMessage | null {
  const ready = safeParseGameReadyV2(value);
  if (ready.success) return ready.data;

  const bootstrapApplied = safeParseBootstrapAppliedV2(value);
  if (bootstrapApplied.success) return bootstrapApplied.data;

  const stateSave = safeParseStateSaveRequestV2(value);
  if (stateSave.success) return stateSave.data;

  const result = safeParseResultSubmissionV2(value);
  if (result.success) return result.data;

  const activeTime = safeParseActiveTimeSubmissionV2(value);
  if (activeTime.success) return activeTime.data;

  const protocolError = safeParseProtocolErrorV2(value);
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
