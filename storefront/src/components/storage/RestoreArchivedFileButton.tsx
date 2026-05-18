/**
 * RestoreArchivedFileButton — Arşivdeki tasarım dosyasını çağırma butonu.
 *
 * Sefa 18 May v68 (R2 cold storage paketi):
 * Müşteri sipariş detay sayfasında, arşivdeki dosyaya bu butonla erişir.
 * /api/customer/design-files/[id]/restore-url endpoint'ine POST atar,
 * 1 saatlik signed URL alır, yeni sekmede açar.
 *
 * Kullanım:
 *   {designFile.archive_status === "cold" && (
 *     <RestoreArchivedFileButton designFileId={designFile.id} />
 *   )}
 */

"use client";

import { useState } from "react";
import { useToast } from "@/components/ui";

interface Props {
  designFileId: string;
  fileName?: string;
  className?: string;
}

export function RestoreArchivedFileButton({
  designFileId,
  fileName,
  className = "",
}: Props) {
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/customer/design-files/${designFileId}/restore-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error ?? "Dosya getirilemedi");
        return;
      }

      const data = await res.json();
      if (data.url) {
        // Yeni sekmede aç
        window.open(data.url, "_blank", "noopener,noreferrer");
        toast.success("Dosya yeni sekmede açılıyor");
      } else {
        toast.error("Geçersiz cevap");
      }
    } catch (err) {
      console.error("Restore failed:", err);
      toast.error("Bağlantı hatası — tekrar deneyin");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`rounded-xl bg-saman/20 ring-1 ring-saman-koyu/30 p-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-[20px]">
          📦
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[14px] text-lacivert">
            Bu dosya arşivde
          </div>
          <p className="text-[12.5px] text-gri-700 mt-0.5 leading-relaxed">
            {fileName ? (
              <>
                <strong>{fileName}</strong> arşivlenmiş. Getirmek 2-3 saniye
                sürer.
              </>
            ) : (
              <>3 aydan eski sipariş — dosya soğuk depoda. Getirmek 2-3 saniye sürer.</>
            )}
          </p>
          <button
            type="button"
            onClick={handleClick}
            disabled={loading}
            className="mt-3 inline-flex items-center gap-2 h-9 px-4 rounded-full bg-pim-mercan text-white text-[13px] font-semibold hover:bg-pim-mercan-koyu disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="opacity-25"
                  />
                  <path
                    d="M4 12a8 8 0 018-8"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="opacity-75"
                  />
                </svg>
                Getiriliyor…
              </>
            ) : (
              <>📥 Dosyayı Getir</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
