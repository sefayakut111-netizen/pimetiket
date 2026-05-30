/**
 * Bakım modu — Edge middleware'de Supabase sorgusunu azaltmak için kısa TTL cache.
 * Her prefetch/navigasyonda DB'ye gitmek 503 burst'üne katkı yapıyordu.
 */

const TTL_MS = 60_000;

let cache: { active: boolean; at: number } | null = null;

export async function getMaintenanceModeActive(
  fetchActive: () => Promise<boolean>
): Promise<boolean> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) {
    return cache.active;
  }
  const active = await fetchActive();
  cache = { active, at: now };
  return active;
}

/** Admin bakım toggle sonrası anında yansıması için (opsiyonel) */
export function invalidateMaintenanceCache(): void {
  cache = null;
}
