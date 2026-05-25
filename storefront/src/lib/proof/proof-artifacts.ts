import { createAdminClient } from "@/lib/supabase/admin";
import { SUPABASE_STORAGE_BUCKETS } from "@/lib/storage/buckets";

const BUCKET = SUPABASE_STORAGE_BUCKETS.designPreviews;

export async function uploadProofArtifact(
  orderId: string,
  itemId: string,
  kind: string,
  body: Buffer,
  contentType = "image/png"
): Promise<{ storagePath: string; signedUrl: string | null }> {
  const admin = createAdminClient();
  const storagePath = `proof/${orderId}/${itemId}/${kind}.png`;

  const { error } = await admin.storage.from(BUCKET).upload(storagePath, body, {
    contentType,
    upsert: true,
  });
  if (error) {
    throw new Error(`proof artifact upload failed: ${error.message}`);
  }

  const { data } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);

  return { storagePath, signedUrl: data?.signedUrl ?? null };
}

export async function uploadPrintReadyPdf(
  orderId: string,
  itemId: string,
  pdfBytes: Uint8Array
): Promise<{ storagePath: string }> {
  const admin = createAdminClient();
  const storagePath = `print-ready/${orderId}/${itemId}.pdf`;
  const { error } = await admin.storage
    .from(SUPABASE_STORAGE_BUCKETS.designs)
    .upload(storagePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (error) {
    throw new Error(`print-ready upload failed: ${error.message}`);
  }
  return { storagePath };
}

export async function signedProofArtifactUrl(
  storagePath: string,
  ttlSeconds = 3600
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, ttlSeconds);
  return data?.signedUrl ?? null;
}
