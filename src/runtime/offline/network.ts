export const GAME_REQUEST_TIMEOUT_MS = 15_000;

export class GameTransportError extends Error {
  constructor(
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super("The game request could not be completed.");
  }
}

export async function fetchGameJson(
  path: string,
  options: RequestInit,
  fetcher: typeof fetch = fetch,
  timeoutMs = GAME_REQUEST_TIMEOUT_MS,
): Promise<{ response: Response; payload: unknown }> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetcher(path, {
          ...options,
          signal: controller.signal,
        });
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          if (response.ok) throw new GameTransportError(false, response.status);
          payload = null;
        }
        return { response, payload };
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new GameTransportError(true));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function retryableHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export class GameSyncRetryScheduler {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private attempt = 0;
  constructor(
    private readonly retry: () => void,
    private readonly random = Math.random,
  ) {}

  schedule(): void {
    if (this.timer !== undefined) return;
    const ceiling = Math.min(30_000, 2_000 * 2 ** Math.min(this.attempt++, 4));
    this.timer = setTimeout(
      () => {
        this.timer = undefined;
        this.retry();
      },
      ceiling / 2 + (this.random() * ceiling) / 2,
    );
  }

  reset(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.attempt = 0;
  }
}
