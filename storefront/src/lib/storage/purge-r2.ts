/**
 * KVKK purge sırasında R2 cold archive + cutline key silme.
 */

import { deleteFromR2 } from "./r2-client";

export function isR2StorageKey(path: string | null | undefined): boolean {
  if (!path?.trim()) return false;
  return (
    path.startsWith("customers/") ||
    path.startsWith("customer-cutlines/") ||
    path.startsWith("customers-hot/")
  );
}

/** Signed URL veya tam path'ten R2 object key çıkar */
export function normalizeR2Key(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.includes("://")) return trimmed.replace(/^\/+/, "");
  try {
    const u = new URL(trimmed);
    return u.pathname.replace(/^\/+/, "").split("?")[0] ?? trimmed;
  } catch {
    return trimmed;
  }
}

export async function deleteR2Keys(
  keys: Iterable<string>
): Promise<{ deleted: number; errors: number; failedKeys: string[] }> {
  const unique = [...new Set([...keys].map(normalizeR2Key).filter(Boolean))];
  let deleted = 0;
  let errors = 0;
  const failedKeys: string[] = [];

  for (const key of unique) {
    const r = await deleteFromR2(key);
    if (r.success) {
      deleted++;
    } else {
      errors++;
      failedKeys.push(key);
      console.error("[purge-r2] delete failed:", key, r.error);
    }
  }

  return { deleted, errors, failedKeys };
}
