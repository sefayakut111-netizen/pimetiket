/**
 * GET /api/admin/archive/files?userId=<uuid>
 *
 * Pim Etiket 18 May v68 (R2 cold storage admin panel):
 * Bir müşterinin R2 arşivindeki tüm dosyalarını listeler. R2 ListObjects
 * çağrısı yapar, `customers/<userId>/` prefix'i altındaki tüm objeleri
 * size + modified date ile döner.
 *
 * R2 boş veya müşteri arşivlenmemişse boş liste döner.
 */

import { NextResponse, type NextRequest } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import {
  listR2ObjectsDetailed,
  r2KeyBuilders,
  getR2Config,
} from "@/lib/storage/r2-client";

export const runtime = "nodejs";
export const maxDuration = 30;

export interface ArchiveFileItem {
  key: string;
  relative_path: string; // "profile-snapshot.json", "orders/PE-2026-1234.json"
  size_bytes: number;
  last_modified: string | null;
  category: "profile" | "order" | "design" | "review" | "return" | "other";
}

function categorizeKey(relPath: string): ArchiveFileItem["category"] {
  if (relPath.startsWith("profile-")) return "profile";
  if (relPath.startsWith("orders/")) return "order";
  if (relPath.startsWith("design-files/")) return "design";
  if (relPath.startsWith("reviews/")) return "review";
  if (relPath.startsWith("returns/")) return "return";
  return "other";
}

export async function GET(req: NextRequest) {
  const auth = await assertPermission("archive", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json(
      { error: "userId query param zorunlu" },
      { status: 400 }
    );
  }

  const prefix = r2KeyBuilders.customerPrefix(userId);

  try {
    const objects = await listR2ObjectsDetailed(prefix);

    const files: ArchiveFileItem[] = objects.map((obj) => {
      const relPath = obj.key.startsWith(prefix)
        ? obj.key.slice(prefix.length)
        : obj.key;
      return {
        key: obj.key,
        relative_path: relPath,
        size_bytes: obj.size,
        last_modified: obj.lastModified ? obj.lastModified.toISOString() : null,
        category: categorizeKey(relPath),
      };
    });

    // En son değişiklik tarihine göre sırala (yeni en üstte)
    files.sort((a, b) => {
      if (!a.last_modified) return 1;
      if (!b.last_modified) return -1;
      return b.last_modified.localeCompare(a.last_modified);
    });

    return NextResponse.json({
      files,
      total_count: files.length,
      total_size_bytes: files.reduce((s, f) => s + f.size_bytes, 0),
      prefix,
      r2: getR2Config(),
    });
  } catch (err) {
    console.error("[admin/archive/files] R2 list failed:", err);
    return NextResponse.json(
      { error: "R2 listeleme hatası", details: (err as Error).message },
      { status: 500 }
    );
  }
}
