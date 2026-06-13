import "server-only";

/**
 * fetch + AbortSignal.timeout — dış API çağrıları askıda kalmasın.
 */
export async function fetchWithTimeout(
  url: string | URL,
  init: RequestInit & { timeoutMs: number }
): Promise<Response> {
  const { timeoutMs, ...rest } = init;
  return fetch(url, {
    ...rest,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/** AbortError / timeout ayrımı için yardımcı */
export function isFetchTimeoutError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "AbortError" || err.name === "TimeoutError")
  );
}
