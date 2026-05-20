/**
 * Design Preview · unified dispatcher (Sefa 20 May v68)
 *
 * Kullanıcı konfigüratörde dosya yüklediğinde generatePreview(file) çağrılır.
 * MIME/uzantıya göre doğru render motoruna yönlendirilir; başarısızsa null
 * döner — caller (MultiDesignUploader, sepet UI) fallback logo gösterir.
 *
 * Desteklenen tipler:
 *   - image/png, image/jpeg, image/webp, image/svg+xml, image/gif → native
 *     (browser zaten render eder; sadece Blob URL döneriz)
 *   - application/pdf → pdfjs (ilk sayfa)
 *   - .ai → pdfjs (PDF-compatible AI)
 *   - .psd → ag-psd composite
 *   - .eps → desteklenmiyor (postscript, client'ta render zor) → null
 *
 * Dönüş: Blob (PNG render edilmiş) veya null. Caller bunu
 * URL.createObjectURL ile preview, ardından Supabase Storage'a upload eder.
 */

export type DesignFileKind =
  | "image" // PNG/JPG/WebP/SVG/GIF — native
  | "pdf" // application/pdf
  | "ai" // Adobe Illustrator (PDF-compatible)
  | "psd" // Adobe Photoshop
  | "eps" // PostScript (preview yok, fallback logo)
  | "unknown";

export interface DesignPreviewResult {
  /** Blob — preview PNG (image tipi için orijinal dosya Blob'u) */
  blob: Blob | null;
  /** Tanımlanan dosya tipi */
  kind: DesignFileKind;
  /** Render başarılı mı (false ise caller fallback logo göstermeli) */
  ok: boolean;
  /** Hata mesajı (debug için) */
  error?: string;
}

function getExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

export function detectKind(file: File): DesignFileKind {
  const ext = getExtension(file.name);
  const mime = file.type.toLowerCase();

  if (mime.startsWith("image/") && mime !== "image/vnd.adobe.photoshop") {
    return "image";
  }
  if (mime === "application/pdf" || ext === ".pdf") return "pdf";
  if (ext === ".ai" || mime === "application/illustrator") return "ai";
  if (ext === ".psd" || mime === "image/vnd.adobe.photoshop") return "psd";
  if (ext === ".eps" || mime === "application/postscript") return "eps";
  return "unknown";
}

export async function generatePreview(file: File): Promise<DesignPreviewResult> {
  const kind = detectKind(file);

  try {
    switch (kind) {
      case "image": {
        // Native image — orijinal File zaten browser'da render edilir
        return { blob: file, kind, ok: true };
      }
      case "pdf":
      case "ai": {
        const { generatePdfPreview } = await import("./pdf-preview");
        const blob = await generatePdfPreview(file);
        return { blob, kind, ok: true };
      }
      case "psd": {
        const { generatePsdPreview } = await import("./psd-preview");
        const blob = await generatePsdPreview(file);
        return { blob, kind, ok: true };
      }
      case "eps":
      case "unknown":
      default:
        return { blob: null, kind, ok: false, error: "Preview desteklenmiyor" };
    }
  } catch (err) {
    return {
      blob: null,
      kind,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Tek-çağrı yardımcı: File → Supabase Storage'a yüklenmiş kalıcı PNG URL.
 *
 * Sefa 20 May v68 (test geri bildirim): "önizleme gözükmüyor".
 * Sebep: MultiDesignUploader'da native image (PNG/JPG) için sadece blob URL
 * üretiliyordu (URL.createObjectURL). Auth modda DB'ye blob URL yazılıyor,
 * sayfa refresh sonrası blob URL session yok → sepet UI önizleme 404.
 *
 * Çözüm: Bu helper hem native image (file'ı direkt yükle) hem PDF/PSD/AI
 * (render + yükle) için tek-çağrı kalıcı URL döner. Auth yoksa blob URL
 * (session boyunca geçerli) döner.
 *
 * Sticker/Etiket konfigüratörü addToCustomerCart önce bu helper'ı çağırır.
 */
export async function persistDesignPreview(
  file: File,
  designId: string
): Promise<string | null> {
  try {
    const { getCurrentUser } = await import("@/lib/supabase/auth-bridge");
    const user = await getCurrentUser();

    const kind = detectKind(file);
    let blob: Blob | null = null;

    if (kind === "image") {
      // Native image — dosyanın kendisi preview
      blob = file;
    } else {
      // PDF/PSD/AI/EPS — render gerek
      const result = await generatePreview(file);
      if (result.ok && result.blob) blob = result.blob;
    }

    if (!blob) return null;

    // Auth yoksa blob URL (session) — guest checkout
    if (!user) return URL.createObjectURL(blob);

    // Auth varsa Supabase Storage'a yükle, kalıcı URL al
    const url = await uploadPreviewToStorage(blob, designId, user.id);
    // Upload başarısızsa blob URL fallback (kullanıcı session içinde önizler)
    return url ?? URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/**
 * Preview Blob → Supabase Storage upload. Public URL döner.
 * Bucket: `design-previews` (Migration 072 referansı, public read).
 *
 * Sefa 20 May v68: Bucket henüz yok ise (storage migration ileride) bu
 * fonksiyon sessizce null döner — sepet UI orijinal dosya yüklendiğinde
 * blob URL ile çalışmaya devam eder, kalıcı önizleme sonra eklenir.
 */
export async function uploadPreviewToStorage(
  previewBlob: Blob,
  designId: string,
  userId: string | null
): Promise<string | null> {
  if (!userId) return null; // guest mode → kalıcı storage yok, blob URL kullanılır

  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const path = `${userId}/${designId}.png`;
    const { error } = await supabase.storage
      .from("design-previews")
      .upload(path, previewBlob, {
        contentType: "image/png",
        upsert: true,
        cacheControl: "31536000", // 1 yıl — preview değişmez
      });
    if (error) {
      console.warn("[design-preview] upload error:", error.message);
      return null;
    }
    const { data } = supabase.storage
      .from("design-previews")
      .getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.warn("[design-preview] upload exception:", err);
    return null;
  }
}
