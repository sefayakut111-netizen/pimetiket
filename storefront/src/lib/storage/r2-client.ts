/**
 * Cloudflare R2 Client — Cold storage helper.
 *
 * Sefa 18 May v68 (R2 cold storage paketi):
 * 3+ ay hareketsiz müşterilerin Supabase'den R2'ye taşınması için S3-uyumlu
 * Cloudflare R2 bucket'ına bağlantı. AWS SDK kullanılır (R2 S3-uyumlu).
 *
 * Maliyet: $0.015/GB/ay storage + egress ÜCRETSİZ (R2 avantajı).
 *
 * ENV variables:
 *   R2_ACCOUNT_ID — Cloudflare account ID
 *   R2_ACCESS_KEY_ID — R2 API token access key
 *   R2_SECRET_ACCESS_KEY — R2 API token secret
 *   R2_ENDPOINT — https://{account_id}.r2.cloudflarestorage.com
 *   R2_BUCKET — bucket name (pim-etiket-archive)
 *   R2_ARCHIVE_DRY_RUN — "true" ise gerçek yazma yapmaz (test mode)
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2CutlinePreviewKey, r2CutlineSvgKey } from "./buckets";

// ============================================================
// Configuration
// ============================================================

/**
 * Bucket adı tek env'den okunur: R2_BUCKET (Vercel + .env.local'da set).
 * NODE_ENV ayrımı yok — DRY_RUN flag zaten güvenlik katmanı sağlıyor.
 * Default fallback Cloudflare'deki gerçek bucket adıyla eşleşmeli (tireli).
 */
const R2_BUCKET = process.env.R2_BUCKET ?? "pim-etiket-archive";

/**
 * Yalnızca cold archive cron / archive-service için.
 * Hot path (cutline, manifest, purge, KVKK delete) bu flag'den etkilenmez.
 */
export const IS_ARCHIVE_DRY_RUN =
  (process.env.R2_ARCHIVE_DRY_RUN ?? "true").toLowerCase() === "true";

/** @deprecated IS_ARCHIVE_DRY_RUN kullanın */
export const IS_DRY_RUN = IS_ARCHIVE_DRY_RUN;

/** Lazy client — env vars set edilmeden import edilirse crash etmesin */
let _r2Client: S3Client | null = null;

function getClient(): S3Client {
  if (_r2Client) return _r2Client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint =
    process.env.R2_ENDPOINT ??
    (accountId
      ? `https://${accountId}.r2.cloudflarestorage.com`
      : undefined);

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error(
      "[r2-client] R2 env vars eksik: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, " +
        "R2_SECRET_ACCESS_KEY, R2_ENDPOINT. Vercel project settings'te tanımla."
    );
  }

  _r2Client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    // KRİTİK 1: AWS SDK v3.730+ varsayılan olarak CRC32 checksum header'ı
    // ekliyor (x-amz-sdk-checksum-algorithm). Cloudflare R2 bu yeni S3
    // header'larını tanımıyor → 403 AccessDenied. WHEN_REQUIRED ile bu
    // davranış kapatılır (sadece müşteri açıkça istediğinde checksum ekler).
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    // KRİTİK 2: Bucket EU jurisdiction'da → endpoint mecburen
    // .eu.r2.cloudflarestorage.com (default endpoint "bucket does not exist"
    // hatası verir, UI manuel upload bile fail eder).
    // R2_ENDPOINT env'i EU bucket için "https://<acc>.eu.r2.cloudflarestorage.com"
    // formatında olmalı.
    //
    // KRİTİK 3: EU jurisdiction bucket'lar virtual-hosted style subdomain
    // DNS'i (bucket.account.eu.r2.cloudflarestorage.com) DESTEKLEMİYOR
    // (Cloudflare wildcard DNS sadece default jurisdiction için). EU
    // jurisdiction'da PATH-STYLE ZORUNLU. AWS SDK default'u virtual-hosted
    // olduğu için 18 May testinde "silent ignore" (200 OK, ama Class A
    // sayılır + Storage=0) yaşandı. forcePathStyle:true ile düzeltildi.
    forcePathStyle: true,
  });

  return _r2Client;
}

// ============================================================
// Public API
// ============================================================

export interface R2UploadResult {
  success: boolean;
  key: string;
  size?: number;
  dryRun?: boolean;
  error?: string;
}

/**
 * Hot path R2 upload — cutline, fason contract vb. DRY_RUN'dan etkilenmez.
 */
export async function uploadToR2(params: {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
  metadata?: Record<string, string>;
}): Promise<R2UploadResult> {
  const size =
    typeof params.body === "string"
      ? Buffer.byteLength(params.body, "utf-8")
      : params.body.length;

  try {
    await getClient().send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType ?? "application/octet-stream",
        Metadata: params.metadata,
      })
    );
    return { success: true, key: params.key, size };
  } catch (err) {
    console.error("[r2-client] upload failed:", params.key, err);
    return {
      success: false,
      key: params.key,
      error: (err as Error).message,
    };
  }
}

/**
 * Cold archive transfer — IS_ARCHIVE_DRY_RUN=true iken gerçek yazmaz.
 */
export async function uploadToR2Archive(params: {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
  metadata?: Record<string, string>;
}): Promise<R2UploadResult> {
  const size =
    typeof params.body === "string"
      ? Buffer.byteLength(params.body, "utf-8")
      : params.body.length;

  if (IS_ARCHIVE_DRY_RUN) {
    console.log(
      `[r2-client:ARCHIVE_DRY_RUN] upload key="${params.key}" size=${size}B`
    );
    return { success: true, key: params.key, size, dryRun: true };
  }

  return uploadToR2(params);
}

/**
 * Signed URL üretir (presigned). Müşteri/Cowork erişimi için.
 * Varsayılan TTL 1 saat.
 */
export async function getSignedDownloadUrl(
  key: string,
  expiresInSeconds = 3600,
  opts?: { downloadFilename?: string; contentType?: string }
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ...(opts?.downloadFilename
      ? {
          ResponseContentDisposition: `attachment; filename="${opts.downloadFilename.replace(/"/g, "")}"`,
        }
      : {}),
    ...(opts?.contentType ? { ResponseContentType: opts.contentType } : {}),
  });
  return await getSignedUrl(getClient(), command, {
    expiresIn: expiresInSeconds,
  });
}

/** Büyük dosya direct upload için presigned PUT URL */
export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return await getSignedUrl(getClient(), command, {
    expiresIn: expiresInSeconds,
  });
}

/**
 * Dosyayı R2'den indirir (sunucu tarafında Buffer döner).
 * Restore akışında kullanılır.
 */
export async function downloadFromR2(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
  const response = await getClient().send(command);
  const chunks: Uint8Array[] = [];
  // @ts-expect-error — Body, AWS SDK v3'te Node.js Readable stream
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * KVKK silme talebi için fiziksel silme.
 * Audit log'a iz kaldırmak çağıranın sorumluluğu.
 */
export async function deleteFromR2(
  key: string
): Promise<{ success: boolean; error?: string }> {
  if (!key?.trim()) return { success: false, error: "empty_key" };
  try {
    await getClient().send(
      new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })
    );
    return { success: true };
  } catch (err) {
    console.error("[r2-client] delete failed:", key, err);
    return { success: false };
  }
}

/**
 * Dosyanın varlığını + boyutunu kontrol eder.
 * Restore öncesi sanity check için.
 */
export async function getR2ObjectInfo(key: string): Promise<{
  exists: boolean;
  size?: number;
  lastModified?: Date;
}> {
  try {
    const response = await getClient().send(
      new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key })
    );
    return {
      exists: true,
      size: response.ContentLength,
      lastModified: response.LastModified,
    };
  } catch {
    return { exists: false };
  }
}

/**
 * Klasör altındaki tüm objeleri listeler.
 * KVKK silme akışında kullanıcı arşivinin tamamını silmek için.
 */
export async function listR2Objects(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const response = await getClient().send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    response.Contents?.forEach((obj) => {
      if (obj.Key) keys.push(obj.Key);
    });
    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);
  return keys;
}

/**
 * Detaylı list — admin paneli için key + size + lastModified içerir.
 */
export interface R2ObjectInfo {
  key: string;
  size: number;
  lastModified: Date | null;
}

export async function listR2ObjectsDetailed(
  prefix: string
): Promise<R2ObjectInfo[]> {
  const items: R2ObjectInfo[] = [];
  let continuationToken: string | undefined;
  do {
    const response = await getClient().send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    response.Contents?.forEach((obj) => {
      if (obj.Key) {
        items.push({
          key: obj.Key,
          size: obj.Size ?? 0,
          lastModified: obj.LastModified ?? null,
        });
      }
    });
    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);
  return items;
}

// ============================================================
// Key Builders — tutarlı klasör yapısı
// ============================================================

export const r2KeyBuilders = {
  customerSnapshot: (userId: string) =>
    `customers/${userId}/profile-snapshot.json`,

  orderFolder: (userId: string, orderId: string) =>
    `customers/${userId}/orders/${orderId}`,

  orderDetails: (userId: string, orderId: string) =>
    `customers/${userId}/orders/${orderId}/order.json`,

  orderEvents: (userId: string, orderId: string) =>
    `customers/${userId}/orders/${orderId}/events.json`,

  designFile: (
    userId: string,
    orderId: string,
    version: number,
    originalName: string
  ) =>
    `customers/${userId}/orders/${orderId}/files/v${version}-${sanitizeFilename(originalName)}`,

  aiCheckResult: (userId: string, orderId: string, designFileId: string) =>
    `customers/${userId}/orders/${orderId}/files/${designFileId}-ai-check.json`,

  reviewSnapshot: (userId: string) => `customers/${userId}/reviews.json`,

  returnSnapshot: (userId: string) => `customers/${userId}/returns.json`,

  customerPrefix: (userId: string) => `customers/${userId}/`,

  monthlyBackup: (yearMonth: string, type: "postgres" | "storage") =>
    `backups/${yearMonth}/${type}-snapshot.${type === "postgres" ? "sql.gz" : "tar.gz"}`,

  // ============================================================
  // Sefa 19 May v68 — Müşteri baskı onay akışı (Migration 059)
  // ============================================================

  /**
   * Müşterinin baskı onay sayfasında POC ile ürettiği SVG bıçak çizgisi.
   * Her item için 1+ draft, sonunda 1 approved versiyon.
   * Path: customer-cutlines/{orderId}/{itemId}/{timestamp}.svg
   */
  cutlineDesign: (orderId: string, itemId: string, timestamp: number) =>
    r2CutlineSvgKey(orderId, itemId, timestamp),

  cutlinePreview: (orderId: string, itemId: string, timestamp: number) =>
    r2CutlinePreviewKey(orderId, itemId, timestamp),

  /**
   * Final print-ready PDF (Faz 4'te server-side üretilecek).
   * Şimdilik SVG yeterli; bu key sadece reservation.
   * Path: customer-proofs/{orderId}/{itemId}/print-ready.pdf
   */
  printReadyPdf: (orderId: string, itemId: string) =>
    `customer-proofs/${orderId}/${itemId}/print-ready.pdf`,
};

/** Filename sanitize — path traversal + special char prevention */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 200);
}

/** Konfig özet — debug için */
export function getR2Config() {
  return {
    bucket: R2_BUCKET,
    archiveDryRun: IS_ARCHIVE_DRY_RUN,
    hasCredentials: Boolean(
      process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY
    ),
    endpoint: process.env.R2_ENDPOINT ?? null,
  };
}
