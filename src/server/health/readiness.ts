import "server-only";

let pendingProbe: Promise<void> | undefined;

export async function checkReadiness(
  ping: () => Promise<unknown>,
  timeoutMs: number,
): Promise<boolean> {
  const probe = (pendingProbe ??= ping().then(() => undefined));
  void probe
    .finally(() => {
      if (pendingProbe === probe) pendingProbe = undefined;
    })
    .catch(() => undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      probe,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Readiness probe timed out")),
          timeoutMs,
        );
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
