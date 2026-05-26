/**
 * Pre-purchase tasarım dosyasını design_temp_uploads'a yükler.
 * DesignDropZone ile aynı init → storage → complete akışı.
 */

import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";
import { isLoggedInSync } from "@/lib/supabase/auth-bridge";

export interface TempDesignUploadResult {
  tempId: string;
  previewUrl: string;
  generatedPreviewUrl?: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
}

export async function uploadFileToTempDesign(
  file: File
): Promise<TempDesignUploadResult | null> {
  if (!isLoggedInSync()) {
    console.warn("[design-temp-upload] auth required — skip upload");
    return null;
  }

  console.log("[design-temp-upload] uploading:", file.name, file.size);

  try {
    const initRes = await fetch("/api/design/temp-upload-init", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        originalName: file.name,
        sizeBytes: file.size,
        mimeType: file.type,
      }),
    });
    if (!initRes.ok) {
      const e = await initRes.json().catch(() => ({}));
      throw new Error((e as { error?: string }).error ?? `init_${initRes.status}`);
    }
    const init = (await initRes.json()) as {
      token: string;
      storagePath: string;
      fileId: string;
    };

    const supabase = createSupabaseClient();
    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .uploadToSignedUrl(init.storagePath, init.token, file);
    if (upErr) {
      throw new Error(`upload_failed: ${upErr.message}`);
    }

    const compRes = await fetch("/api/design/temp-upload-complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fileId: init.fileId,
        storagePath: init.storagePath,
        originalName: file.name,
        sizeBytes: file.size,
        mimeType: file.type,
      }),
    });
    if (!compRes.ok) {
      const e = await compRes.json().catch(() => ({}));
      throw new Error(
        (e as { error?: string }).error ?? `complete_${compRes.status}`
      );
    }
    const comp = (await compRes.json()) as {
      tempId: string;
      previewUrl: string | null;
    };

    let generatedPreviewUrl: string | undefined;
    try {
      const { generatePreview, uploadPreviewToStorage } = await import(
        "@/lib/design-preview"
      );
      const result = await generatePreview(file);
      if (result.ok && result.blob) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const url = await uploadPreviewToStorage(
            result.blob,
            comp.tempId,
            user.id
          );
          if (url) generatedPreviewUrl = url;
        }
      }
    } catch (err) {
      console.warn("[design-temp-upload] preview generation failed:", err);
    }

    console.log("[design-temp-upload] ok tempId:", comp.tempId);

    return {
      tempId: comp.tempId,
      previewUrl: comp.previewUrl ?? "",
      generatedPreviewUrl,
      fileName: file.name,
      sizeBytes: file.size,
      mimeType: file.type,
    };
  } catch (err) {
    console.error("[design-temp-upload] failed:", err);
    return null;
  }
}
