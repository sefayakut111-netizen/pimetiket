import { assertPermission } from "@/lib/supabase/assert-permission";
/**
 * GET /api/admin/backups
 *
 * Cloudflare R2'deki haftalık yedek dosyalarını listeler. Admin
 * /admin/yedekler sayfası bu endpoint'i kullanır.
 *
 * R2 ENV yoksa boş liste ile mesaj döner (kurulum bekleniyor).
 *
 * Restore mekaniği bu endpoint'te YOK — restore manuel pg_restore
 * komutuyla yapılır (docs/BACKUP_SETUP.md adım 6). Sayfa sadece
 * görüntüleme + indirme linki gösterir.
 */

import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface BackupItem {
  key: string;
  week: string;
  year: string;
  stamp: string;
  size_bytes: number;
  modified_at: string;
}

export async function GET() {
  // Sefa 21 May v68: inline auth → assertAdmin helper.
  // Backups kritik — staff yetmez, sadece admin role.
  const auth = await assertPermission("backups", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Yedek bucket'ı storage'dan AYRI — R2_BACKUP_* öncelik, yoksa R2_* (geriye uyum)
  const accountId =
    process.env.R2_BACKUP_ACCOUNT_ID ?? process.env.R2_ACCOUNT_ID;
  const accessKey =
    process.env.R2_BACKUP_ACCESS_KEY_ID ?? process.env.R2_ACCESS_KEY_ID;
  const secretKey =
    process.env.R2_BACKUP_SECRET_ACCESS_KEY ?? process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BACKUP_BUCKET ?? "pimetiket-backups";

  if (!accountId || !accessKey || !secretKey || !bucket) {
    return NextResponse.json({
      backups: [],
      configured: false,
      message:
        "R2 yedek bağlantısı yapılandırılmamış. docs/BACKUP_SETUP.md adım 4'e bak.",
    });
  }

  const client = new S3Client({
    region: "auto",
    endpoint:
      process.env.R2_BACKUP_ENDPOINT ??
      `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    forcePathStyle: true,
  });

  try {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: "weekly/",
        MaxKeys: 500,
      })
    );
    const contents = res.Contents ?? [];
    const manifests = contents.filter((o) => o.Key?.endsWith("/manifest.json"));
    const backups: BackupItem[] = manifests
      .map((m) => {
        const segs = (m.Key ?? "").split("/");
        const year = segs[1] ?? "";
        const folderName = segs[2] ?? "";
        const weekMatch = folderName.match(/^W(\d+)-(.+)$/);
        return {
          key: (m.Key ?? "").replace(/\/manifest\.json$/, ""),
          week: weekMatch?.[1] ?? "?",
          year,
          stamp: weekMatch?.[2] ?? folderName,
          size_bytes: m.Size ?? 0,
          modified_at: m.LastModified?.toISOString() ?? "",
        };
      })
      .sort((a, b) => b.modified_at.localeCompare(a.modified_at));

    return NextResponse.json({
      backups,
      configured: true,
    });
  } catch (err) {
    console.error("[admin/backups]", err);
    return NextResponse.json(
      {
        backups: [],
        configured: true,
        error:
          err instanceof Error ? err.message : "R2'den liste alınamadı",
      },
      { status: 500 }
    );
  }
}
