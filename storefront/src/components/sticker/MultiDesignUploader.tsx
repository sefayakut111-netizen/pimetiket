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

import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/ui";
import { cn } from "@/lib/cn";

export interface PendingDesign {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
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
}

// Sefa 18 May v54: Tüm uploader'lar standart kural —
// 50 dosya × 30 MB her biri, PDF/PNG/AI/PSD/EPS.
// AI/PSD/EPS için tarayıcı MIME döndürmez → uzantı kontrolü baz alınır.
const ALLOWED_EXTENSIONS = [".pdf", ".png", ".ai", ".psd", ".eps"] as const;
const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30 MB

function getExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

function isAcceptedFile(file: File): boolean {
  const ext = getExt(file.name);
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
}

function isImage(mime: string): boolean {
  return mime === "image/png";
}

export function MultiDesignUploader({
  designCount,
  onDesignCountChange,
  designs,
  onDesignsChange,
  qtyPerDesign,
  maxCount = 50,
  productLabel = "sticker",
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [lightbox, setLightbox] = useState<PendingDesign | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = (files: FileList | File[]) => {
    setError(null);
    const arr = Array.from(files);
    const remaining = Math.max(0, designCount - designs.length);
    if (remaining === 0) {
      setError(
        `Hedef tasarım sayısına (${designCount}) ulaştın. Daha çok yüklemek için yukarıdan tasarım sayısını artır.`
      );
      return;
    }
    const accepted: PendingDesign[] = [];
    // Sefa 18 May v64: Duplicate kontrolü — aynı dosya (ad + boyut)
    // tekrar yüklenmesin. Set'te mevcut dosyalar referans alınır.
    const existingKeys = new Set(
      designs.map((d) => `${d.name}__${d.sizeBytes}`)
    );
    const newKeys = new Set<string>(); // aynı batch içinde de duplicate engelle
    for (const file of arr.slice(0, remaining)) {
      if (!isAcceptedFile(file)) {
        setError(
          `${file.name}: Sadece PDF, PNG, AI, PSD, EPS dosyaları kabul ediliyor.`
        );
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
      accepted.push({
        id: uid,
        file,
        previewUrl,
        name: file.name,
        sizeBytes: file.size,
        mimeType: file.type,
      });
    }
    if (accepted.length > 0) {
      onDesignsChange([...designs, ...accepted]);
    }
  };

  const removeDesign = (id: string) => {
    const target = designs.find((d) => d.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    onDesignsChange(designs.filter((d) => d.id !== id));
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
              onClick={() => onDesignCountChange(Math.max(1, designCount - 1))}
              disabled={designCount <= 1}
              aria-label="Tasarım sayısı azalt"
              className="w-8 h-8 grid place-items-center text-sm font-semibold text-gri-700 hover:bg-gri-100 disabled:opacity-30"
            >
              −
            </button>
            <input
              type="number"
              value={designCount}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (Number.isFinite(n)) {
                  onDesignCountChange(Math.max(1, Math.min(maxCount, n)));
                }
              }}
              min={1}
              max={maxCount}
              aria-label="Tasarım sayısı"
              className="w-14 h-8 text-center text-[13px] font-semibold text-lacivert tabular-nums border-x border-gri-200 focus:outline-none focus:bg-pim-mercan-tint/30"
            />
            <button
              type="button"
              onClick={() =>
                onDesignCountChange(Math.min(maxCount, designCount + 1))
              }
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
            <div key={d.id} className="relative aspect-square group">
              <button
                type="button"
                onClick={() => setLightbox(d)}
                className="w-full h-full rounded-lg overflow-hidden ring-1 ring-gri-200 hover:ring-pim-mercan bg-white"
                aria-label={`${d.name} önizle`}
              >
                {isImage(d.mimeType) ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={d.previewUrl}
                    alt={d.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gri-500 p-1">
                    <span className="text-[28px] leading-none mb-0.5">📄</span>
                    <span className="text-[10px] uppercase">PDF</span>
                  </div>
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
          accept=".pdf,.png,.ai,.psd,.eps,application/pdf,image/png"
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

        <p className="text-[11.5px] text-gri-700 mt-2 leading-relaxed">
          <strong className="text-lacivert">PDF · PNG · AI · PSD · EPS</strong>
          {" · "}max 30 MB/dosya · 50 dosyaya kadar.
        </p>
        {/* Sefa 18 May v64: Eksik dosya / hiç dosya yüklenmemiş durumda
            bilgi mesajı — sepete eklemeyi engellemiyoruz, sadece bilgilendiriyoruz */}
        <p className="mt-1.5 text-[11.5px] text-gri-700 leading-relaxed">
          {designs.length < designCount && (
            <>
              💡 Tasarımları şimdi yüklemek zorunda değilsin. Eksik kalanları{" "}
              <strong className="text-lacivert">sipariş onayından sonra</strong>{" "}
              detay sayfasından veya tek PDF içinde yükleyebilirsin.
            </>
          )}
        </p>
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
            {isImage(lightbox.mimeType) ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={lightbox.previewUrl}
                alt={lightbox.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center text-gri-700">
                <div className="text-[64px]">📄</div>
                <div className="mt-2 text-[13px]">
                  PDF önizlemesi konfigüratörde yok.
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
