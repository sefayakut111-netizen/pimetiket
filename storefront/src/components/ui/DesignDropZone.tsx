/**
 * DesignDropZone — sepete eklemeden ÖNCE tasarım yükleme component'i.
 *
 * Hibrit:
 *   - Auth varsa  → /api/design/temp-upload-init → Supabase Storage
 *                   (canlı mockup için signed URL döner)
 *   - Auth yoksa  → "Giriş yap" CTA'sı (storage RLS user_id'ye bağlı)
 *
 * Kullanım: /sticker ve /etiket konfigüratör sayfalarında, sepete
 * eklemeden önce. Tasarım yüklenince state callback ile parent'a
 * iletilir; parent canlı preview'a bind eder.
 *
 * Props:
 *   - tempId / previewUrl / fileName: kontrollü değerler
 *   - onChange(state): tüm değişimleri parent'a haber ver
 *   - className: opsiyonel ek stil
 */

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useToast } from "./Toast";
import { isLoggedInSync } from "@/lib/supabase/auth-bridge";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  STORAGE_BUCKET,
} from "@/lib/storage/design-files";
import { categorizeFile, BLOCKED_FILE_MESSAGE } from "@/lib/design-file-types";

export interface DesignTempState {
  tempId: string;
  /** Orijinal dosya signed URL (raw PDF/AI/PSD bile dahil) — sipariş aşamasında
   *  ham dosya gerekiyor (kesim, baskı). Tarayıcı bunu önizleyemez. */
  previewUrl: string;
  /** Sefa 20 May v68 Migration 072: Render edilmiş PNG preview URL —
   *  Supabase Storage public bucket (design-previews). PDF/AI/PSD için pdfjs
   *  ve ag-psd ile client-side üretilir, sepette gerçek tasarımı gösterir.
   *  null ise render başarısız → sepet UI fallback logo gösterir. */
  generatedPreviewUrl?: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
}

interface DesignDropZoneProps {
  value: DesignTempState | null;
  onChange: (state: DesignTempState | null) => void;
  className?: string;
}

export function DesignDropZone({
  value,
  onChange,
  className,
}: DesignDropZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [authed, setAuthed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // Auth durumu
  useEffect(() => {
    setAuthed(isLoggedInSync());
    const handler = () => setAuthed(isLoggedInSync());
    if (typeof window !== "undefined") {
      window.addEventListener("pim_auth_signed_in", handler);
      window.addEventListener("pim_auth_signed_out", handler);
      return () => {
        window.removeEventListener("pim_auth_signed_in", handler);
        window.removeEventListener("pim_auth_signed_out", handler);
      };
    }
  }, []);

  const handleFile = async (file: File) => {
    // Client-side validation
    if (file.size > MAX_FILE_SIZE) {
      toast.error(
        `Dosya çok büyük (max ${MAX_FILE_SIZE / 1024 / 1024} MB)`
      );
      return;
    }
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
      if (categorizeFile(file.name, file.type) === "blocked") {
        toast.error(BLOCKED_FILE_MESSAGE);
        return;
      }
    }

    if (!isLoggedInSync()) {
      toast.error("Tasarım yüklemek için önce giriş yap");
      return;
    }

    // Eskisini temizle (replace senaryosu)
    if (value?.tempId) {
      try {
        await fetch(`/api/design/temp-upload-complete?id=${value.tempId}`, {
          method: "DELETE",
        });
      } catch {
        // sessizce yut, yeni upload devam etsin
      }
    }

    setUploading(true);
    setProgress(0);

    try {
      // 1) Init
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
        throw new Error(e.error ?? `init_failed_${initRes.status}`);
      }
      const init = (await initRes.json()) as {
        token: string;
        storagePath: string;
        fileId: string;
      };
      setProgress(20);

      // 2) Storage upload
      const supabase = createSupabaseClient();
      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .uploadToSignedUrl(init.storagePath, init.token, file);
      if (upErr) {
        throw new Error(`upload_failed: ${upErr.message}`);
      }
      setProgress(80);

      // 3) Complete (DB row + preview URL)
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
        throw new Error(e.error ?? `complete_failed_${compRes.status}`);
      }
      const comp = (await compRes.json()) as {
        tempId: string;
        previewUrl: string | null;
      };
      setProgress(100);

      // Sefa 20 May v68 Migration 072: Client-side preview generation
      // (PDF/AI → pdfjs, PSD → ag-psd, native image → orijinal blob).
      // Üretilen PNG design-previews bucket'a public yüklenir, sepet UI'da
      // <img src> ile gösterilir. Başarısızsa generatedPreviewUrl undefined
      // kalır, sepet fallback logo (PDF/AI/PSD rozeti) gösterir.
      let generatedPreviewUrl: string | undefined;
      try {
        const { generatePreview, uploadPreviewToStorage } = await import(
          "@/lib/design-preview"
        );
        const result = await generatePreview(file);
        if (result.ok && result.blob) {
          // Auth zaten gerekli (yukarıda check edildi)
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
        // Preview render başarısız — sessizce devam (fallback logo gösterilir)
        console.warn("[design-dropzone] preview generation failed:", err);
      }

      onChange({
        tempId: comp.tempId,
        previewUrl: comp.previewUrl ?? "",
        generatedPreviewUrl,
        fileName: file.name,
        sizeBytes: file.size,
        mimeType: file.type,
      });
      toast.success("Tasarım yüklendi — önizlemede görüyorsun 👀");
    } catch (err) {
      console.error("[design-dropzone] upload failed:", err);
      toast.error(err instanceof Error ? err.message : "Yükleme başarısız");
    } finally {
      setUploading(false);
      // Progress'i kısa süre tutup sıfırla
      setTimeout(() => setProgress(0), 1500);
    }
  };

  const handleRemove = async () => {
    if (!value) return;
    try {
      await fetch(`/api/design/temp-upload-complete?id=${value.tempId}`, {
        method: "DELETE",
      });
    } catch {
      // ignore
    }
    onChange(null);
  };

  // Drag handlers
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragActive) setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = ""; // re-upload aynı dosya tekrar tetiklesin
  };

  // ============================================================
  // Render
  // ============================================================

  // Dosya yüklenmiş — özet kart
  if (value) {
    const sizeKb = (value.sizeBytes / 1024).toFixed(1);
    return (
      <div
        className={`rounded-xl ring-1 ring-yesil/30 bg-yesil-soft p-3.5 ${className ?? ""}`}
      >
        <div className="flex items-start gap-3">
          <div className="grid place-items-center w-10 h-10 rounded-lg bg-yesil text-white shrink-0">
            <Icon.Check size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[14px] text-lacivert truncate">
                {value.fileName}
              </span>
              <span className="text-[11px] text-yesil font-bold uppercase tracking-[0.04em]">
                Önizlemede
              </span>
            </div>
            <div className="text-[12px] text-gri-700 mt-0.5">
              {sizeKb} KB · {value.mimeType.split("/").pop()}
            </div>
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="text-[12.5px] font-semibold text-pim-mercan hover:underline"
              >
                Değiştir
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="text-[12.5px] font-semibold text-gri-500 hover:text-kirmizi"
              >
                Kaldır
              </button>
            </div>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.ai,.psd,.svg,application/pdf,image/png,image/jpeg,image/svg+xml,application/illustrator,image/vnd.adobe.photoshop"
          onChange={onInputChange}
          disabled={uploading}
        />
      </div>
    );
  }

  // Sefa 18 May v68 (CRO denetim KRİTİK fix):
  // Mockup preview feature iptal edildi (varsayılan sistem). Misafir
  // kullanıcı için login CTA bloğu kaldırıldı — drop-zone misafire de
  // gösterilir. Upload denerken auth check yapılır (yoksa /auth'a redirect).
  //
  // Önceki versiyon: misafir kullanıcıya "Tasarımını şimdi yükle —
  // mockup'ta nasıl duracağını gör" + login CTA → Persona C (Canva
  // tasarımcı) hesap açmadan denemek istediğinde bounce oluyordu.

  // Auth var ya da misafir — drag-drop zone (upload deneme noktasında auth check)
  return (
    <>
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`rounded-xl ring-1 ring-dashed transition-all cursor-pointer ${
          dragActive
            ? "ring-pim-mercan bg-pim-mercan-tint/40"
            : uploading
              ? "ring-gri-300 bg-gri-50 cursor-wait"
              : "ring-gri-200 bg-gri-50 hover:ring-pim-mercan hover:bg-pim-mercan-tint/20"
        } p-5 text-center ${className ?? ""}`}
      >
        {uploading ? (
          <div>
            <div className="text-[13px] font-semibold text-lacivert mb-2">
              Yükleniyor… {progress}%
            </div>
            <div className="h-2 rounded-full bg-gri-200 overflow-hidden">
              <div
                className="h-full bg-pim-mercan transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <Icon.Plus size={24} className="text-pim-mercan mx-auto mb-2" />
            <div className="font-semibold text-[14px] text-lacivert">
              Tasarımını sürükle veya tıkla
            </div>
            <p className="text-[12px] text-gri-700 mt-1.5 leading-relaxed">
              PDF · PNG · AI · PSD · EPS — max 30 MB
            </p>
            <p className="text-[11.5px] text-gri-500 mt-2 leading-relaxed">
              Yüklersen canlı önizlemede tasarımını görürsün — beğenirsen
              sepete ekle, beğenmezsen değiştir.
            </p>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg,.ai,.psd,.svg,application/pdf,image/png,image/jpeg,image/svg+xml,application/illustrator,image/vnd.adobe.photoshop"
        onChange={onInputChange}
        disabled={uploading}
      />
    </>
  );
}
