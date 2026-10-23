export const PLAYER_RESULTS_PAGE_SIZE = 20;

export type PlayerHistoryPage = { sessionPage?: number; resultPage?: number };

export function reportPage(
  value: unknown,
  pages = Number.MAX_SAFE_INTEGER,
): number {
  const number =
    typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return typeof number === "number" &&
    Number.isSafeInteger(number) &&
    number > 0
    ? Math.min(number, Math.max(1, pages))
    : 1;
}
