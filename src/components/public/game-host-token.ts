export const LAUNCH_TOKEN_RENEWAL_LEAD_MS = 30_000;

export function hasUsableLaunchToken(
  expiresAt: number,
  now: number,
  minimumRemainingMs = 0,
): boolean {
  return Number.isFinite(expiresAt) && expiresAt > now + minimumRemainingMs;
}

export async function retryAfterUnauthorized(
  response: Response,
  send: (token: string) => Promise<Response>,
  refresh: () => Promise<string>,
): Promise<Response> {
  if (response.status !== 401) return response;

  let token: string;
  try {
    token = await refresh();
  } catch {
    return response;
  }

  return send(token);
}
