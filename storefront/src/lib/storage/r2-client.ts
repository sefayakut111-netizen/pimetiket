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

// ============================================================
// Configuration
// ============================================================

/**
 * Bucket adı tek env'den okunur: R2_BUCKET (Vercel + .env.local'da set).
 * NODE_ENV ayrımı yok — DRY_RUN flag zaten güvenlik katmanı sağlıyor.
 * Default fallback Cloudflare'deki gerçek bucket adıyla eşleşmeli (tireli).
 */
const R2_BUCKET = process.env.R2_BUCKET ?? "pim-etiket-archive";

/** DRY_RUN modu — gerçek yazma yapmaz, sadece log basar. İlk hafta için
 *  güvenlik kalkanı. Sefa ENV'de R2_ARCHIVE_DRY_RUN=false yapınca aktif olur. */
export const IS_DRY_RUN =
  (process.env.R2_ARCHIVE_DRY_RUN ?? "true").toLowerCase() === "true";

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
 * R2'ye dosya yükler. Buffer, Uint8Array veya string destekler.
 *
 * DRY_RUN modunda gerçek upload yapmaz, sadece log basar (sadece success
 * + dryRun flag döner).
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

  if (IS_DRY_RUN) {
    console.log(
      `[r2-client:DRY_RUN] upload key="${params.key}" size=${size}B ` +
        `contentType="${params.contentType ?? "application/octet-stream"}"`
    );
    return { success: true, key: params.key, size, dryRun: true };
  }

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
 * Signed URL üretir (presigned). Müşteri/Cowork erişimi için.
 * Varsayılan TTL 1 saat.
 */
export async function getSignedDownloadUrl(
  key: string,
  expiresInSeconds = 3600
): Promise<string> {
  if (IS_DRY_RUN) {
    return `https://dry-run.pimetiket.local/${key}?expires=${expiresInSeconds}`;
  }
  const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
  return await getSignedUrl(getClient(), command, {
    expiresIn: expiresInSeconds,
  });
}

/**
 * Dosyayı R2'den indirir (sunucu tarafında Buffer döner).
 * Restore akışında kullanılır.
 */
export async function downloadFromR2(key: string): Promise<Buffer> {
  if (IS_DRY_RUN) {
    throw new Error("[r2-client:DRY_RUN] downloadFromR2 dry-run'da çalışmaz");
  }
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
): Promise<{ success: boolean; dryRun?: boolean }> {
  if (IS_DRY_RUN) {
    console.log(`[r2-client:DRY_RUN] delete key="${key}"`);
    return { success: true, dryRun: true };
  }
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
  if (IS_DRY_RUN) {
    return { exists: true, size: 0, lastModified: new Date() };
  }
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
  if (IS_DRY_RUN) {
    console.log(`[r2-client:DRY_RUN] list prefix="${prefix}"`);
    return [];
  }
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
  if (IS_DRY_RUN) {
    console.log(`[r2-client:DRY_RUN] list-detailed prefix="${prefix}"`);
    return [];
  }
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
    `customer-cutlines/${orderId}/${itemId}/${timestamp}.svg`,

  /**
   * POC canvas snapshot — preview thumbnail.
   * Onay sayfasında liste yanında küçük görsel için.
   * Path: customer-cutlines/{orderId}/{itemId}/{timestamp}-preview.png
   */
  cutlinePreview: (orderId: string, itemId: string, timestamp: number) =>
    `customer-cutlines/${orderId}/${itemId}/${timestamp}-preview.png`,

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
    dryRun: IS_DRY_RUN,
    hasCredentials: Boolean(
      process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY
    ),
  };
}
