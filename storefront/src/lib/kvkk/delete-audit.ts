/**
 * KVKK delete follow-up audit — processed silme taleplerinde R2 arşiv
 * temizliğini doğrular (SADECE okur, otomatik silmez).
 */

import { listR2Objects, r2KeyBuilders } from "@/lib/storage/r2-client";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface KvkkDeleteAuditIssue {
  requestId: string;
  kind: string;
  objectsFound: number;
}

export interface KvkkDeleteAuditReport {
  checked: number;
  clean: number;
  pending_cleanup: number;
  issues: KvkkDeleteAuditIssue[];
  r2Configured: boolean;
}

interface ProcessedDeleteRow {
  id: string;
  user_id: string;
  kind: string;
  scope: Record<string, boolean> | null;
}

function r2PrefixesForRequest(
  userId: string,
  kind: string,
  scope: Record<string, boolean> | null
): string[] {
  if (kind === "account_delete") {
    return [r2KeyBuilders.customerPrefix(userId)];
  }
  if (kind !== "partial_delete" || !scope) {
    return [];
  }
  const prefixes: string[] = [];
  if (scope.profile) {
    prefixes.push(r2KeyBuilders.customerSnapshot(userId));
  }
  if (scope.reviews) {
    prefixes.push(r2KeyBuilders.reviewSnapshot(userId));
  }
  if (scope.orders || scope.designs) {
    prefixes.push(`${r2KeyBuilders.customerPrefix(userId)}orders/`);
  }
  return prefixes;
}

async function countR2ObjectsForPrefixes(prefixes: string[]): Promise<number> {
  let total = 0;
  for (const prefix of prefixes) {
    const keys = await listR2Objects(prefix);
    total += keys.length;
  }
  return total;
}

/**
 * İşlenmiş hesap/kısmi silme taleplerini R2'de doğrular.
 * PII: yanıtta user_id yok — yalnızca requestId.
 */
export async function runKvkkDeleteAudit(
  admin: SupabaseClient
): Promise<KvkkDeleteAuditReport> {
  const { data, error } = await admin
    .from("kvkk_requests")
    .select("id, user_id, kind, scope")
    .in("kind", ["account_delete", "partial_delete"])
    .eq("status", "completed")
    .not("processed_at", "is", null)
    .order("processed_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as ProcessedDeleteRow[];
  const issues: KvkkDeleteAuditIssue[] = [];
  let clean = 0;

  let r2Configured = true;
  try {
    for (const row of rows) {
      const prefixes = r2PrefixesForRequest(row.user_id, row.kind, row.scope);
      if (prefixes.length === 0) {
        clean++;
        continue;
      }

      let objectsFound = 0;
      try {
        objectsFound = await countR2ObjectsForPrefixes(prefixes);
      } catch (err) {
        r2Configured = false;
        console.error(
          "[kvkk/delete-audit] R2 list failed for request",
          row.id,
          err instanceof Error ? err.message : err
        );
        throw err;
      }

      if (objectsFound > 0) {
        issues.push({
          requestId: row.id,
          kind: row.kind,
          objectsFound,
        });
      } else {
        clean++;
      }
    }
  } catch {
    return {
      checked: rows.length,
      clean,
      pending_cleanup: issues.length,
      issues,
      r2Configured: false,
    };
  }

  return {
    checked: rows.length,
    clean,
    pending_cleanup: issues.length,
    issues,
    r2Configured,
  };
}
