import { GameSessionStatus } from "@/generated/prisma/enums";

export const DEFAULT_OFFLINE_FLUSH_WINDOW_SECONDS = 24 * 60 * 60;

export function canFlushSession(
  status: GameSessionStatus,
  endedAt: Date | null | undefined,
  now: Date,
  windowSeconds = DEFAULT_OFFLINE_FLUSH_WINDOW_SECONDS,
): boolean {
  if (status === GameSessionStatus.ACTIVE) return true;
  return (
    status === GameSessionStatus.ENDED &&
    !!endedAt &&
    endedAt <= now &&
    now.getTime() < endedAt.getTime() + windowSeconds * 1000
  );
}
