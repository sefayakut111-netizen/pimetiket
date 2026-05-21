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

import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/assert-admin";

export const dynamic = "force-dynamic";

interface BackupItem {
  key: string;
  week: string;
  year: string;
  stamp: string;
  size_bytes: number;
  modified_at: string;
}

interface R2ListXmlObject {
  Key: string;
  LastModified: string;
  Size: string;
}

export async function GET() {
  // Sefa 21 May v68: inline auth → assertAdmin helper.
  // Backups kritik — staff yetmez, sadece admin role.
  const auth = await assertAdmin();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;

  if (!accountId || !accessKey || !secretKey || !bucket) {
    return NextResponse.json({
      backups: [],
      configured: false,
      message:
        "R2 yedek bağlantısı yapılandırılmamış. docs/BACKUP_SETUP.md adım 4'e bak.",
    });
  }

  // R2 S3-uyumlu ListObjectsV2 — AWS SigV4 imzalama gerekli.
  // Bağımlılık eklemeden basit Web Crypto API ile imzala.
  try {
    const items = await listR2Backups({
      accountId,
      accessKey,
      secretKey,
      bucket,
      prefix: "weekly/",
    });
    return NextResponse.json({
      backups: items,
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

// ============================================================
// R2 S3-compatible signed request (SigV4)
// ============================================================

async function listR2Backups(input: {
  accountId: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  prefix: string;
}): Promise<BackupItem[]> {
  const { accountId, accessKey, secretKey, bucket, prefix } = input;
  // Sefa 18 May v68 (yedek R2 403 fix):
  // EU jurisdiction bucket'lar için endpoint'in .eu.r2.cloudflarestorage.com
  // olması zorunlu (default endpoint silent 403 dönüyor, "Access Denied"
  // hatası). R2_ENDPOINT env'inden host parse, yoksa EU default kullan.
  const envEndpoint = process.env.R2_ENDPOINT;
  const host = envEndpoint
    ? new URL(envEndpoint).host
    : `${accountId}.eu.r2.cloudflarestorage.com`;
  const path = `/${bucket}`;
  const query = `list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=500`;
  const url = `https://${host}${path}?${query}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const region = "auto";
  const service = "s3";

  const payloadHash = await sha256Hex("");

  // Canonical request
  const canonicalHeaders =
    `host:${host}\n` + `x-amz-content-sha256:${payloadHash}\n` + `x-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest =
    `GET\n` +
    `${path}\n` +
    `${query}\n` +
    `${canonicalHeaders}\n` +
    `${signedHeaders}\n` +
    `${payloadHash}`;

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign =
    `AWS4-HMAC-SHA256\n` +
    `${amzDate}\n` +
    `${credentialScope}\n` +
    `${await sha256Hex(canonicalRequest)}`;

  const kDate = await hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, "aws4_request");
  const signature = await hmacHex(kSigning, stringToSign);

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      authorization,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`R2 list failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const xml = await res.text();
  const items = parseListObjectsXml(xml);

  // Sadece manifest.json'lara bak — her yedek için 1 satır
  const manifests = items.filter((i) => i.Key.endsWith("/manifest.json"));

  return manifests
    .map((m): BackupItem => {
      // weekly/2026/W19-2026-05-11/manifest.json
      const segs = m.Key.split("/");
      const year = segs[1] ?? "";
      const folderName = segs[2] ?? "";
      const weekMatch = folderName.match(/^W(\d+)-(.+)$/);
      return {
        key: m.Key.replace(/\/manifest\.json$/, ""),
        week: weekMatch?.[1] ?? "?",
        year,
        stamp: weekMatch?.[2] ?? folderName,
        size_bytes: parseInt(m.Size, 10) || 0,
        modified_at: m.LastModified,
      };
    })
    .sort((a, b) =>
      b.modified_at.localeCompare(a.modified_at)
    );
}

function parseListObjectsXml(xml: string): R2ListXmlObject[] {
  const objects: R2ListXmlObject[] = [];
  const regex = /<Contents>([\s\S]*?)<\/Contents>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const body = match[1];
    const key = body.match(/<Key>([\s\S]*?)<\/Key>/)?.[1] ?? "";
    const lastModified =
      body.match(/<LastModified>([\s\S]*?)<\/LastModified>/)?.[1] ?? "";
    const size = body.match(/<Size>([\s\S]*?)<\/Size>/)?.[1] ?? "0";
    objects.push({ Key: key, LastModified: lastModified, Size: size });
  }
  return objects;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(
  key: string | Uint8Array,
  data: string
): Promise<Uint8Array> {
  const keyBuf =
    typeof key === "string" ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuf as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(data)
  );
  return new Uint8Array(sig);
}

async function hmacHex(key: Uint8Array, data: string): Promise<string> {
  const sig = await hmac(key, data);
  return Array.from(sig)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
