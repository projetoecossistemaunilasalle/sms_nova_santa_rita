export type GameClientResolution =
  | { status: "configured"; url: string }
  | { status: "missing" }
  | { status: "invalid" };

const allowedProtocols = new Set(["http:", "https:"]);

/**
 * Resolve the maintained Phaser game (Heroes_Trial/web-poc) at request time
 * without exposing the environment variable to the client bundle.
 */
export function resolveGameClientUrl(
  value = process.env.GAME_CLIENT_URL,
): GameClientResolution {
  const rawValue = value?.trim();

  if (!rawValue) {
    return { status: "missing" };
  }

  try {
    const url = new URL(rawValue);

    if (
      !allowedProtocols.has(url.protocol) ||
      url.username !== "" ||
      url.password !== ""
    ) {
      return { status: "invalid" };
    }

    return { status: "configured", url: url.toString() };
  } catch {
    return { status: "invalid" };
  }
}

export const getGameClientUrl = resolveGameClientUrl;

/**
 * Keep the public activity token scoped to the one game launch. Existing
 * query parameters on the configured client URL are preserved.
 */
export function createGameLaunchUrl(clientUrl: string, activityToken: string) {
  const url = new URL(clientUrl);
  url.searchParams.set("activity_token", activityToken);
  return url.toString();
}
