/**
 * MultiDesignDropZone — birden fazla tasarım dosyası yükleme.
 *
 * Sefa kuralı (15 May v2): Boyut adımından sonra, tüm ürünlerde
 * (etiket + sticker) çoklu tasarım yüklenebilsin. Max 50 dosya,
 * her biri max 30 MB. Yüklemeler sıralı kutuda görünür, kullanıcı
 * sonradan eklemeye devam edebilir.
 *
 * Tek dosya modu için DesignDropZone (single-file) kullan.
 *
 * Auth varsa → /api/design/temp-upload-init → Supabase Storage (her dosya).
 * Auth yoksa → giriş yap CTA.
 *
 * NOT: Şu anki cart item modeli tek tasarım bağlar. designs[0] cart'a
 * gider, designs[1..N] metadata olarak tutulur. Backend cart genişlemesi
 * ileride yapılacak.
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
import type { DesignTempState } from "./DesignDropZone";

const MAX_FILES_PER_ORDER = 50;
const ACCEPT_ATTR =
  ".pdf,.ai,.eps,.psd,.png,.jpg,.jpeg,.svg";

interface MultiDesignDropZoneProps {
  value: DesignTempState[];
  onChange: (next: DesignTempState[]) => void;
  className?: string;
  /** Max kabul edilen dosya sayısı (default 50, Sefa kuralı). */
  maxFiles?: number;
}

export function MultiDesignDropZone({
  value,
  onChange,
  className,
  maxFiles = MAX_FILES_PER_ORDER,
}: MultiDesignDropZoneProps) {
  const [uploadingNames, setUploadingNames] = useState<string[]>([]);
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

  const handleFile = async (file: File): Promise<DesignTempState | null> => {
    // Client-side validation
    if (file.size > MAX_FILE_SIZE) {
      toast.error(
        `${file.name} çok büyük (max ${MAX_FILE_SIZE / 1024 / 1024} MB)`
      );
      return null;
    }
    if (file.type && !(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
      // Bazı browser .ai/.eps için mime type vermez; uzantı kontrolü
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (
        !ext ||
        !["pdf", "ai", "eps", "psd", "png", "jpg", "jpeg", "svg"].includes(ext)
      ) {
        toast.error(`${file.name}: desteklenmeyen format`);
        return null;
      }
    }

    setUploadingNames((prev) => [...prev, file.name]);

    try {
      // 1) Init endpoint — temp upload signed URL
      const initRes = await fetch("/api/design/temp-upload-init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }),
      });
      const initData = (await initRes.json()) as {
        ok?: boolean;
        tempId?: string;
        storagePath?: string;
        signedUploadUrl?: string;
        signedUploadToken?: string;
        error?: string;
      };
      if (!initRes.ok || !initData.ok || !initData.tempId) {
        throw new Error(initData.error ?? "Upload init başarısız");
      }

      // 2) Storage'a upload — Supabase signed URL ile
      const supabase = createSupabaseClient();
      const { error: uploadErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .uploadToSignedUrl(
          initData.storagePath!,
          initData.signedUploadToken!,
          file,
          { contentType: file.type || undefined, upsert: false }
        );
      if (uploadErr) {
        throw new Error(uploadErr.message);
      }

      // 3) Signed read URL — preview için (~1 saat geçerli)
      const { data: signed } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(initData.storagePath!, 3600);

      return {
        tempId: initData.tempId,
        previewUrl: signed?.signedUrl ?? "",
        fileName: file.name,
        sizeBytes: file.size,
        mimeType: file.type || "application/octet-stream",
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Yükleme başarısız";
      toast.error(`${file.name}: ${msg}`);
      return null;
    } finally {
      setUploadingNames((prev) => prev.filter((n) => n !== file.name));
    }
  };

  const handleFiles = async (fileList: FileList | File[]) => {
    if (!authed) {
      toast.info("Tasarım yüklemek için önce giriş yap.");
      return;
    }

    const files = Array.from(fileList);
    const remaining = maxFiles - value.length;
    if (files.length > remaining) {
      toast.error(
        `En fazla ${maxFiles} dosya. Şu anda ${value.length} dosyan var, ${remaining} dosya ekleyebilirsin.`
      );
      return;
    }

    // Paralel upload — her dosya bağımsız
    const results = await Promise.all(files.map((f) => handleFile(f)));
    const successful = results.filter(
      (r): r is DesignTempState => r !== null
    );
    if (successful.length > 0) {
      onChange([...value, ...successful]);
      toast.success(
        `${successful.length} tasarım yüklendi · Toplam ${value.length + successful.length}/${maxFiles}`
      );
    }
  };

  const handleRemove = (idx: number) => {
    const next = value.filter((_, i) => i !== idx);
    onChange(next);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const onClick = () => {
    if (!authed) {
      toast.info("Tasarım yüklemek için önce giriş yap.");
      return;
    }
    inputRef.current?.click();
  };

  const onChangeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      // Aynı dosyayı tekrar yüklemek mümkün olsun diye reset
      e.target.value = "";
    }
  };

  const totalSizeBytes = value.reduce((s, d) => s + d.sizeBytes, 0);
  const isFull = value.length >= maxFiles;
  const uploadCount = uploadingNames.length;

  // Auth yoksa: giriş yap CTA
  if (!authed) {
    return (
      <div
        className={`rounded-2xl border-2 border-dashed border-gri-300 bg-gri-50 p-6 text-center ${className ?? ""}`}
      >
        <Icon.User size={28} className="text-gri-500 mx-auto mb-2" />
        <div className="font-semibold text-[14px] text-lacivert">
          Tasarımını yüklemek için giriş yap
        </div>
        <p className="text-[12px] text-gri-700 mt-1.5 leading-relaxed">
          PDF, AI, EPS, PSD, PNG, JPG, SVG — max 30 MB her dosya, 50 dosyaya kadar
        </p>
        <Link
          href="/auth"
          className="inline-flex items-center gap-1.5 mt-3 px-4 h-9 bg-pim-mercan text-white rounded-full text-[13px] font-semibold hover:bg-pim-mercan/90 transition-colors"
        >
          Giriş yap / Üye ol
        </Link>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Drop zone (always visible — kullanıcı sonradan ekleyebilir) */}
      <div
        role="button"
        tabIndex={0}
        onClick={isFull ? undefined : onClick}
        onKeyDown={(e) => {
          if (!isFull && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onClick();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isFull) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={isFull ? undefined : onDrop}
        aria-label={`Tasarım yükle (${value.length}/${maxFiles})`}
        aria-disabled={isFull}
        className={`relative rounded-2xl border-2 border-dashed transition-all px-4 py-5 text-center ${
          isFull
            ? "border-gri-200 bg-gri-50 cursor-not-allowed opacity-60"
            : dragActive
              ? "border-pim-mercan bg-pim-mercan-tint cursor-pointer"
              : "border-gri-300 bg-gri-50 hover:border-pim-mercan hover:bg-pim-mercan-tint/30 cursor-pointer"
        }`}
      >
        {uploadCount > 0 ? (
          <>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="inline-block w-4 h-4 rounded-full border-2 border-pim-mercan border-t-transparent animate-spin" />
              <span className="font-semibold text-[13px] text-lacivert">
                {uploadCount} dosya yükleniyor…
              </span>
            </div>
            <p className="text-[11.5px] text-gri-700">
              {uploadingNames.slice(0, 3).join(", ")}
              {uploadCount > 3 ? ` +${uploadCount - 3} dosya` : ""}
            </p>
          </>
        ) : (
          <>
            <Icon.Plus size={22} className="text-pim-mercan mx-auto mb-1.5" />
            <div className="font-semibold text-[14px] text-lacivert">
              {value.length === 0
                ? "Tasarımlarını sürükle veya tıkla"
                : isFull
                  ? "Maksimum dosya sayısına ulaştın"
                  : "Yeni tasarım ekle"}
            </div>
            <p className="text-[11.5px] text-gri-700 mt-1 leading-relaxed">
              PDF, AI, EPS, PSD, PNG, JPG, SVG — max 30 MB her dosya
            </p>
            <p className="text-[11px] text-gri-500 mt-1 tabular-nums">
              {value.length}/{maxFiles} dosya · Sonradan da ekleyebilirsin
            </p>
          </>
        )}
      </div>

      {/* File list */}
      {value.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {value.map((d, i) => (
            <div
              key={d.tempId}
              className="flex items-center gap-3 bg-white border border-gri-200 rounded-xl px-3 py-2.5"
            >
              {/* Thumbnail preview if image, else file icon */}
              <div className="shrink-0 w-10 h-10 rounded-lg bg-gri-100 grid place-items-center overflow-hidden">
                {d.mimeType.startsWith("image/") && d.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={d.previewUrl}
                    alt={d.fileName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Icon.Box size={16} className="text-gri-500" />
                )}
              </div>

              {/* Name + size */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] text-gri-500 font-bold tabular-nums shrink-0">
                    #{i + 1}
                  </span>
                  <div
                    className="text-[13px] font-semibold text-lacivert truncate"
                    title={d.fileName}
                  >
                    {d.fileName}
                  </div>
                </div>
                <div className="text-[11px] text-gri-500 tabular-nums">
                  {(d.sizeBytes / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => handleRemove(i)}
                aria-label={`${d.fileName} dosyasını çıkar`}
                className="shrink-0 w-8 h-8 grid place-items-center rounded-full text-gri-500 hover:bg-kirmizi/10 hover:text-kirmizi transition-colors"
              >
                <Icon.X size={14} />
              </button>
            </div>
          ))}
          {/* Toplam özet */}
          <div className="text-[11.5px] text-gri-500 px-1 pt-1 flex items-center justify-between">
            <span>
              Toplam: <strong>{value.length}</strong> dosya ·{" "}
              {(totalSizeBytes / 1024 / 1024).toFixed(1)} MB
            </span>
            <span className="text-gri-500">
              Sonradan da ekleyebilirsin
            </span>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        onChange={onChangeInput}
        className="hidden"
        aria-hidden
      />
    </div>
  );
}
