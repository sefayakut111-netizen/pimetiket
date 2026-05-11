"use client";

/**
 * Bir sipariş için tüm tasarım versiyonlarını native <details> accordion'da
 * gösterir. /siparis/[id] sayfasının altına mount edilir.
 *
 * Sefa iş kuralı: Tasarım dosyaları son siparişten 24 ay saklanır,
 * her reorder ile sayaç sıfırlanır. Müşteri bu sayfada geçmiş versiyonları
 * görür ve eskiye dönmek isterse Pim ekibine yazabilir (manuel akış —
 * "Bu versiyona dön" otomatik aksiyon değil, çünkü onaylı baskı zinciri
 * karışmasın).
 */

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  listOrderDesignHistory,
  type CustomerDesign,
  type DesignStatus,
} from "@/lib/customer-designs";

const STATUS_LABEL: Record<DesignStatus, { label: string; color: string }> = {
  uploaded: { label: "Yüklendi", color: "bg-gri-100 text-gri-700" },
  analyzing: { label: "AI inceliyor", color: "bg-pim-mercan-tint text-pim-mercan" },
  qc_passed: { label: "AI ön-kontrol geçti", color: "bg-yesil-soft text-yesil" },
  qc_warned: { label: "Uyarı var", color: "bg-sari-soft text-sari-koyu" },
  qc_failed: { label: "Yeniden yükleme gerekli", color: "bg-kirmizi-soft text-kirmizi" },
  approved: { label: "Onaylı baskı", color: "bg-yesil-soft text-yesil" },
  superseded: { label: "Eski versiyon", color: "bg-gri-100 text-gri-700" },
};

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function OrderDesignHistory({ orderId }: { orderId: string }) {
  const [files, setFiles] = useState<CustomerDesign[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void listOrderDesignHistory(orderId)
      .then((arr) => {
        if (active) setFiles(arr);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orderId]);

  if (loading || !files || files.length <= 1) {
    // 0 veya 1 dosya varken accordion göstermek anlamsız
    return null;
  }

  const activeFile = files.find((f) => f.status === "approved") ?? files[files.length - 1];
  const olderFiles = files.filter((f) => f.id !== activeFile.id);

  return (
    <Card padding="p-5">
      <details className="group">
        <summary className="cursor-pointer flex items-center justify-between gap-3 list-none">
          <div>
            <h3 className="font-semibold text-[15px] text-lacivert">
              Tasarımın geçmişi
            </h3>
            <p className="text-[12px] text-gri-700 mt-0.5">
              Bu sipariş için {files.length} versiyon var · Aktif:{" "}
              <strong>V{activeFile.version}</strong>
            </p>
          </div>
          <span
            className="text-gri-500 text-[20px] transition-transform group-open:rotate-180"
            aria-hidden="true"
          >
            ⌄
          </span>
        </summary>

        <ul className="mt-4 space-y-2">
          {olderFiles.map((f) => {
            const meta = STATUS_LABEL[f.status];
            return (
              <li
                key={f.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gri-50"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white ring-1 ring-gri-200 font-mono text-[11px] font-bold text-gri-700 shrink-0">
                    V{f.version}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-semibold text-lacivert truncate">
                      {f.originalName}
                    </div>
                    <div className="text-[11px] text-gri-700 mt-0.5">
                      {formatDate(f.uploadedAt)} · {formatBytes(f.sizeBytes)}
                    </div>
                  </div>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center h-[20px] px-2 rounded-full text-[10.5px] font-semibold shrink-0",
                    meta.color
                  )}
                >
                  {meta.label}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 text-[11.5px] text-gri-700 leading-relaxed">
          Eski bir versiyona dönmek istersen{" "}
          <a
            href="/iletisim"
            className="text-pim-mercan font-semibold hover:underline"
          >
            bize yaz
          </a>
          , aktif siparişle çakışmayacak şekilde hallederiz.
        </p>
      </details>
    </Card>
  );
}
