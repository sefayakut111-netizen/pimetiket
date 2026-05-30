"use client";

/**
 * Pim Etiket — Sticker çoklu tasarım yükleyici
 *
 * Sefa kuralı 11 May (Madde 9):
 *   "Müşteri kaç tasarım yükleyeceğinin sayısını girebilecek.
 *    Tüm görselleri yüklediğinde istediği görsele tıkladığında onun
 *    önizlemesini görebilecek."
 *
 * Konfigüratörde local-preview thumbnail grid:
 *   - PDF/PNG/JPEG kabul edilir (15 MB max)
 *   - URL.createObjectURL ile preview (server upload yok bu aşamada)
 *   - Sepete eklemeden sonra /siparis/[id]'de gerçek upload yapılır
 *   - Thumbnail tıklayınca büyük lightbox modal
 *   - "Kaç tasarım yükleyeceksin" input designCount'u set eder
 *
 * State parent component'ten geliyor (controlled).
 */

import { useRef, useState, useEffect } from "react";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  generatePreview,
  detectKind,
  type DesignFileKind,
} from "@/lib/design-preview";
import { categorizeFile, BLOCKED_FILE_MESSAGE } from "@/lib/design-file-types";
import { track } from "@/lib/analytics/posthog-events";
import {
  detectFileDimensions,
  type DetectedDimensions,
} from "@/lib/design-dimensions";

export interface PendingDesign {
  id: string;
  file: File;
  /** Orijinal dosya blob URL (yine de tutarız — lightbox/download için) */
  previewUrl: string;
  /** Sefa 20 May v68: Render edilmiş preview (PDF/AI/PSD için PNG dataURL/blob URL).
   *  Native image (PNG/JPG/SVG/WebP) için previewUrl ile aynı.
   *  null ise render başarısız → fallback logo gösterilir. */
  generatedPreviewUrl: string | null;
  /** Tanımlanan dosya tipi — fallback logo seçimi için */
  kind: DesignFileKind;
  /** Preview render durumu */
  previewStatus: "pending" | "ready" | "failed";
  name: string;
  sizeBytes: number;
  mimeType: string;
  detectedDimensions?: DetectedDimensions | null;
}

interface Props {
  designCount: number;
  onDesignCountChange: (n: number) => void;
  designs: PendingDesign[];
  onDesignsChange: (designs: PendingDesign[]) => void;
  /** Adet (her tasarımdan kaç ürün) */
  qtyPerDesign: number;
  /** Max tasarım sayısı, default 50 */
  maxCount?: number;
  /** Ürün etiketi (Sefa kuralı 15 May v6 — etiket+sticker shared):
   *  "sticker" → "...= 250 sticker"
   *  "etiket"  → "...= 250 etiket" */
  productLabel?: string;
  onDimensionsDetected?: (dims: DetectedDimensions) => void;
}

// PDF/PNG/JPG/AI/PSD/SVG — EPS desteklenmez
const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30 MB

function isAcceptedFile(file: File): boolean {
  return categorizeFile(file.name, file.type) !== "blocked";
}

/**
 * Fallback logo — preview üretilemediği dosya tipleri için (EPS, başarısız
 * AI render, vb.). Native image değilse her zaman fallback'e de hazırız —
 * ama generatedPreviewUrl varsa onu öncelikli kullanırız.
 */
function FormatBadge({ kind }: { kind: DesignFileKind }) {
  const config = {
    pdf: { bg: "#E33", text: "PDF", color: "#fff" },
    ai: { bg: "#330000", text: "Ai", color: "#FF9A00" },
    psd: { bg: "#001E36", text: "Ps", color: "#31A8FF" },
    eps: { bg: "#5A5A5A", text: "EPS", color: "#fff" },
    image: { bg: "#888", text: "IMG", color: "#fff" },
    unknown: { bg: "#999", text: "?", color: "#fff" },
  }[kind];
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center rounded"
      style={{ background: config.bg, color: config.color }}
    >
      <div className="font-bold text-[28px] leading-none tracking-tight">
        {config.text}
      </div>
    </div>
  );
}

export function MultiDesignUploader({
  designCount,
  onDesignCountChange,
  designs,
  onDesignsChange,
  qtyPerDesign,
  maxCount = 50,
  productLabel = "sticker",
  onDimensionsDetected,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [lightbox, setLightbox] = useState<PendingDesign | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Sefa 20 May v68: Async preview render sırasında designs state stale
  // kalabilir (kullanıcı yeni dosya eklerse). Latest snapshot için ref.
  const designsRef = useRef<PendingDesign[]>(designs);
  useEffect(() => {
    designsRef.current = designs;
  }, [designs]);
  // Sefa 18 May v67: 'tasarım kısmında adet yazmasın, kullanıcı yazsın'
  // designCount input ilk başta boş gözüksün → touched mantığı
  const [designCountTouched, setDesignCountTouched] = useState(false);
  const touchDesignCount = () => setDesignCountTouched(true);

  const handleFiles = async (files: FileList | File[]) => {
    setError(null);
    const arr = Array.from(files);
    const maxAllowed = (maxCount ?? 50) - designs.length;
    if (maxAllowed <= 0) {
      setError(
        `Maksimum tasarım sayısına (${maxCount ?? 50}) ulaştın.`
      );
      return;
    }
    const accepted: PendingDesign[] = [];
    const existingKeys = new Set(
      designs.map((d) => `${d.name}__${d.sizeBytes}`)
    );
    const newKeys = new Set<string>();
    const hadNoDesigns = designs.length === 0;
    for (const file of arr.slice(0, maxAllowed)) {
      if (!isAcceptedFile(file)) {
        setError(
          `${file.name}: Sadece PDF, PNG, JPG, AI, PSD veya SVG dosyaları kabul ediliyor.`
        );
        continue;
      }
      if (file.size <= 0) {
        setError(`${file.name}: Boş dosya yüklenemez.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(
          `${file.name}: 30 MB üstü dosya kabul edilmiyor (her dosya max 30 MB).`
        );
        continue;
      }
      const dupKey = `${file.name}__${file.size}`;
      if (existingKeys.has(dupKey) || newKeys.has(dupKey)) {
        setError(
          `${file.name}: Bu dosya zaten yüklendi (aynı ad + boyut).`
        );
        continue;
      }
      newKeys.add(dupKey);
      const previewUrl = URL.createObjectURL(file);
      const uid =
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
      const kind = detectKind(file);

      let detectedDimensions: DetectedDimensions | null | undefined;
      const dims = await detectFileDimensions(file);
      if (dims && dims.source !== "unsupported" && dims.widthMm > 0) {
        if (hadNoDesigns && accepted.length === 0 && onDimensionsDetected) {
          onDimensionsDetected(dims);
        }
        detectedDimensions = dims;
      }

      accepted.push({
        id: uid,
        file,
        previewUrl,
        generatedPreviewUrl: kind === "image" ? previewUrl : null,
        kind,
        previewStatus: kind === "image" ? "ready" : "pending",
        name: file.name,
        sizeBytes: file.size,
        mimeType: file.type,
        detectedDimensions,
      });
    }
    if (arr.length > maxAllowed) {
      setError(
        `${maxAllowed} dosya eklendi — seçimdeki ${arr.length - maxAllowed} dosya maksimum limit nedeniyle atlandı.`
      );
    }
    if (accepted.length > 0) {
      const merged = [...designs, ...accepted];
      if (merged.length > designCount) {
        onDesignCountChange(merged.length);
      }
      onDesignsChange(merged);
      track("design_uploaded", {
        product: "sticker",
        fileType: accepted[0]?.mimeType ?? accepted[0]?.file.type ?? "unknown",
        fileSize: accepted.reduce((sum, d) => sum + d.sizeBytes, 0),
        designCount: merged.length,
      });
      // Her PDF/AI/PSD için arka planda render başlat; sonuç hazır olunca
      // designs state'i güncelle (parent setDesigns callback). EPS/unknown
      // direkt failed → fallback badge.
      const needsRender = accepted.filter(
        (d) => d.previewStatus === "pending"
      );
      void Promise.allSettled(
        needsRender.map(async (d) => {
          const result = await generatePreview(d.file);
          // Latest designs state'i parent'tan yeniden almak için snapshot al
          // değil — burada onDesignsChange ile mevcut listeyi güncelliyoruz.
          // Race condition: kullanıcı arada bir tasarımı silebilir → o
          // durumda d.id artık listede yok, güncelleme no-op.
          updateDesignPreview(d.id, result.blob, result.ok);
        })
      );
    }
  };

  // Preview render sonucu state'i güncelle — latest snapshot via ref
  // (async race condition için, yukarıda useEffect ile sync ediliyor)
  const updateDesignPreview = (
    id: string,
    previewBlob: Blob | null,
    ok: boolean
  ) => {
    const latest = designsRef.current;
    onDesignsChange(
      latest.map((d) => {
        if (d.id !== id) return d;
        if (
          d.generatedPreviewUrl &&
          d.generatedPreviewUrl.startsWith("blob:") &&
          d.generatedPreviewUrl !== d.previewUrl
        ) {
          URL.revokeObjectURL(d.generatedPreviewUrl);
        }
        const url = previewBlob ? URL.createObjectURL(previewBlob) : null;
        return {
          ...d,
          generatedPreviewUrl: url,
          previewStatus: ok
            ? ("ready" as const)
            : ("failed" as const),
        };
      })
    );
  };

  const removeDesign = (id: string) => {
    const target = designs.find((d) => d.id === id);
    if (target) {
      if (target.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(target.previewUrl);
      }
      if (
        target.generatedPreviewUrl &&
        target.generatedPreviewUrl.startsWith("blob:") &&
        target.generatedPreviewUrl !== target.previewUrl
      ) {
        URL.revokeObjectURL(target.generatedPreviewUrl);
      }
    }
    const remaining = designs.filter((d) => d.id !== id);
    onDesignsChange(remaining);
    if (remaining.length < designCount) {
      onDesignCountChange(Math.max(1, remaining.length));
    }
  };

  // Sefa 18 May v57: totalQty hesaplaması kaldırıldı (UI'dan 'tasarım =
  // X etiket' satırı çıkarıldı, kullanım yok)
  const progress = `${designs.length} / ${designCount}`;
  const isComplete = designs.length >= designCount;
  const [dragActive, setDragActive] = useState(false);

  // Sefa kuralı (16 May): sürükle-bırak özelliği. Kart üzerine dosya
  // bırakılırsa otomatik upload tetiklenir.
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isComplete) setDragActive(true);
  };
  const handleDragLeave = () => setDragActive(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (isComplete) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-3">
      {/* Adet × Tasarım sayısı özeti */}
      <div className="rounded-xl bg-gradient-to-br from-pim-mercan-tint to-krem-soft p-4 ring-1 ring-pim-mercan/20">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-gri-700">Her tasarımdan</span>
          <strong className="text-pim-mercan tabular-nums">
            {qtyPerDesign.toLocaleString("tr-TR")}
          </strong>
          <span className="text-gri-700">adet × </span>
          <div className="inline-flex items-stretch rounded-full ring-1 ring-gri-200 bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => {
                touchDesignCount();
                onDesignCountChange(Math.max(1, designCount - 1));
              }}
              disabled={designCount <= 1}
              aria-label="Tasarım sayısı azalt"
              className="w-8 h-8 grid place-items-center text-sm font-semibold text-gri-700 hover:bg-gri-100 disabled:opacity-30"
            >
              −
            </button>
            <input
              type="number"
              value={designCountTouched || designs.length > 0 ? designCount : ""}
              placeholder="örn. 1"
              autoComplete="off"
              onChange={(e) => {
                touchDesignCount();
                const n = parseInt(e.target.value, 10);
                if (Number.isFinite(n)) {
                  onDesignCountChange(Math.max(1, Math.min(maxCount, n)));
                }
              }}
              min={1}
              max={maxCount}
              aria-label="Tasarım sayısı"
              className="w-16 h-8 text-center text-[13px] font-semibold text-lacivert tabular-nums border-x border-gri-200 focus:outline-none focus:bg-pim-mercan-tint/30"
            />
            <button
              type="button"
              onClick={() => {
                // Sefa 18 May v68: İlk basışta + → 1 göster (input "" idi
                // designCount state 1, touched true olduğunda 1 görünür).
                // Eski davranış: input "" iken + bastığında 2'ye atlıyordu.
                if (!designCountTouched) {
                  touchDesignCount();
                  // designCount zaten 1, sadece touched true olsun, "1" görünür
                  return;
                }
                onDesignCountChange(Math.min(maxCount, designCount + 1));
              }}
              disabled={designCount >= maxCount}
              aria-label="Tasarım sayısı artır"
              className="w-8 h-8 grid place-items-center text-sm font-semibold text-gri-700 hover:bg-gri-100 disabled:opacity-30"
            >
              +
            </button>
          </div>
          <span className="text-gri-700">tasarım</span>
          {/* Sefa 18 May v57: 'tasarım = 1.000 etiket' 2. satır kaldırıldı
              (toplam adet hesabı görsel olarak gereksizdi) */}
        </div>
        <p className="text-[11.5px] text-gri-700 mt-2 leading-relaxed">
          Tüm tasarımlarda aynı malzeme + ölçü + yüzey kullanılır; sadece
          görsel değişir.
        </p>
      </div>

      {/* Upload + thumbnail grid */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-[13.5px] text-lacivert">
            Dosyalarını yükle
            <span className="ml-2 text-[11px] font-normal text-gri-500">
              (sürükle bırak ile)
            </span>
          </h4>
          <span
            className={cn(
              "text-[11.5px] font-semibold tabular-nums",
              isComplete ? "text-yesil" : "text-gri-700"
            )}
          >
            {progress}
          </span>
        </div>

        {/* Drop zone wrapper — kart üzerine dosya bırakılırsa upload tetikler */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 p-2 rounded-xl transition-all",
            dragActive
              ? "bg-pim-mercan-tint ring-2 ring-pim-mercan ring-dashed"
              : "ring-2 ring-transparent"
          )}>
          {designs.map((d) => (
            <div key={d.id} className="relative">
              <div className="relative aspect-square group">
              <button
                type="button"
                onClick={() => setLightbox(d)}
                className="w-full h-full rounded-lg overflow-hidden ring-1 ring-gri-200 hover:ring-pim-mercan bg-white"
                aria-label={`${d.name} önizle`}
              >
                {d.previewStatus === "pending" ? (
                  // Render bekliyor — küçük spinner
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gri-50 text-gri-500">
                    <div className="w-5 h-5 border-2 border-pim-mercan border-t-transparent rounded-full animate-spin" />
                    <span className="text-[9px] mt-1 uppercase">Render</span>
                  </div>
                ) : d.generatedPreviewUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={d.generatedPreviewUrl}
                    alt={d.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <FormatBadge kind={d.kind} />
                )}
              </button>
              <button
                type="button"
                onClick={() => removeDesign(d.id)}
                aria-label={`${d.name} kaldır`}
                className="absolute -top-2 -right-2 grid place-items-center w-8 h-8 rounded-full bg-kirmizi text-white text-[14px] shadow-1 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity touch-manipulation"
              >
                ×
              </button>
              <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-gradient-to-t from-black/60 to-transparent text-white text-[9px] text-center truncate rounded-b-lg">
                {d.name}
              </div>
              </div>
              {d.detectedDimensions &&
                d.detectedDimensions.source !== "unsupported" && (
                  <div className="mt-1 text-[11px] text-gri-500 leading-tight">
                    Tespit edilen ölçü: {d.detectedDimensions.widthMm}×
                    {d.detectedDimensions.heightMm}mm
                    {d.detectedDimensions.confidence === "estimated" && (
                      <span className="text-gri-400 ml-1">(yaklaşık)</span>
                    )}
                  </div>
                )}
            </div>
          ))}

          {/* Add button — designCount'a göre kalan slot kadar tekrar */}
          {!isComplete && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="aspect-square rounded-lg ring-1 ring-dashed ring-gri-300 bg-gri-50 hover:bg-white hover:ring-pim-mercan-soft text-gri-700 hover:text-pim-mercan flex flex-col items-center justify-center transition-colors"
              aria-label="Tasarım ekle"
            >
              <Icon.Plus size={18} />
              <span className="text-[10.5px] font-semibold mt-0.5">Ekle</span>
            </button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.ai,.psd,.svg,application/pdf,image/png,image/jpeg,image/svg+xml,application/illustrator,image/vnd.adobe.photoshop"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFiles(e.target.files);
              e.target.value = ""; // tekrar aynı dosyayı seçebilsin
            }
          }}
        />

        {/* Sefa 18 May v64 ux/a11y fix: role=alert + ikon prefix
            (color-only mesaj WCAG 1.4.1 fail önlemi) */}
        {error && (
          <div
            role="alert"
            className="mt-2 flex items-start gap-1.5 text-[12px] text-kirmizi"
          >
            <span aria-hidden className="shrink-0">
              ⚠
            </span>
            <span>{error}</span>
          </div>
        )}

        {/* Sefa 18 May v68 (UX uzman 3.6): "50 dosyaya kadar" kaldırıldı —
            sayaç 0/{designCount} ile çelişiyordu (designCount=1 iken "50"
            karışıklık yaratıyordu). Limit sayacı sayaç bölümünde dinamik. */}
        <p className="text-[11.5px] text-gri-700 mt-2 leading-relaxed">
          <strong className="text-lacivert">PDF · PNG · JPG · AI · PSD · EPS</strong>
          {" · "}max 30 MB/dosya
        </p>
        {/* Sefa 20 May v68: "💡 Tasarımları şimdi yüklemek zorunda
            değilsin..." satırı kaldırıldı — aynı içerik konfigüratör
            sayfasında "Sonra yükleme akışı aktif:" baloncuğunda
            zaten gösteriliyor (duplicate temizlendi). */}
      </div>

      {/* Lightbox modal */}
      {lightbox && (
        <Modal
          open={true}
          onClose={() => setLightbox(null)}
          title={lightbox.name}
          maxWidthClassName="max-w-[840px]"
        >
          <div className="aspect-[16/10] bg-gri-100 rounded-lg overflow-hidden flex items-center justify-center">
            {lightbox.previewStatus === "pending" ? (
              <div className="text-center text-gri-700">
                <div className="w-10 h-10 border-3 border-pim-mercan border-t-transparent rounded-full animate-spin mx-auto" />
                <div className="mt-3 text-[13px]">Preview üretiliyor…</div>
              </div>
            ) : lightbox.generatedPreviewUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={lightbox.generatedPreviewUrl}
                alt={lightbox.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center text-gri-700">
                <div className="w-24 h-24 mx-auto">
                  <FormatBadge kind={lightbox.kind} />
                </div>
                <div className="mt-3 text-[13px]">
                  {lightbox.kind === "eps"
                    ? "EPS önizlemesi konfigüratörde yok."
                    : "Önizleme üretilemedi (dosya korumalı veya bozuk olabilir)."}
                  <br />
                  Sipariş detayında tam görüntü.
                </div>
              </div>
            )}
          </div>
          <p className="mt-3 text-[12.5px] text-gri-700">
            {(lightbox.sizeBytes / 1024).toFixed(1)} KB ·{" "}
            {lightbox.mimeType.split("/")[1]?.toUpperCase()}
          </p>
        </Modal>
      )}
    </div>
  );
}
