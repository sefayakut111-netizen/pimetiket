"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { Pill } from "./Pill";
import { Button } from "./Button";
import { cn } from "@/lib/cn";

type Variant = "quiet" | "bold";

interface Upsell {
  msg: string;
  onClick: () => void;
}

interface SummaryItem {
  icon?: string;        // emoji veya kısa metin (örn "📦")
  label: string;        // örn "Toplam rulo"
  value: string;        // örn "5 rulo"
}

interface PriceCardProps {
  variant?: Variant;
  topLabel: string; // "TOPLAM" | "SEÇİMİN"
  total: number;
  unitPrice: ReactNode;
  savingsLabel?: string | null;
  upsell?: Upsell | null;
  deliveryDate: string;
  /** Üretim süresi aralığı — delivery-promise modülünden */
  deliveryPromiseRange?: string;
  deliveryPromiseNote?: string;
  ctaLabel: string;
  /** Sepete ekleme devam ederken buton devre dışı + yükleme metni */
  ctaLoading?: boolean;
  onCta?: () => void;
  footnote?: string | null;
  className?: string;
  /** Sefa 18 May v62: İşlem özeti satırları (örn rulo + toplam adet).
   *  Caller içeriği belirler, locale-aware string'ler. */
  summaryItems?: SummaryItem[];
  /** Sefa 21 May v68 (konfigüratör denetim #4): henüz tamamlanmamış
   *  zorunlu adım sayısı + ilk adımın adı. Pozitif ise özet ve fiyat
   *  varsayılan değerlere göre tahmini olarak gösterildiği belirtilir. */
  pendingStepsCount?: number;
  firstPendingStepLabel?: string;
  /** Eksik adım uyarısına tıklanınca ilgili adıma scroll + burst. */
  onPendingStepsClick?: () => void;
}

/**
 * Sepete ekle CTA + toplam fiyat kartı. İki bilinçli varyant:
 *   - "quiet": beyaz card + gradient top stripe (etiket — profesyonel sakin)
 *   - "bold":  lacivert gradient + mercan accent (sticker — enerjik premium)
 *
 * v1-jsx'teki ~100 satır inline price card'ı.
 */
export function PriceCard({
  variant = "quiet",
  topLabel,
  total,
  unitPrice,
  savingsLabel,
  upsell,
  deliveryDate,
  deliveryPromiseRange,
  deliveryPromiseNote,
  ctaLabel,
  ctaLoading = false,
  onCta,
  footnote,
  className,
  summaryItems,
  pendingStepsCount,
  firstPendingStepLabel,
  onPendingStepsClick,
}: PriceCardProps) {
  const fmt = (n: number) => Math.round(n).toLocaleString("tr-TR");

  const pendingWarning =
    pendingStepsCount && pendingStepsCount > 0 ? (
      onPendingStepsClick ? (
        <button
          type="button"
          onClick={onPendingStepsClick}
          className={cn(
            "mb-4 w-full rounded-lg bg-sari-soft ring-1 ring-sari/30 px-3.5 py-2.5",
            "text-[12.5px] text-lacivert text-left transition-colors",
            "hover:bg-sari/20 hover:ring-sari/50 cursor-pointer"
          )}
        >
          <span className="font-semibold">Varsayılan seçimlerle fiyat</span> —{" "}
          <strong>{pendingStepsCount} adımı</strong> kişiselleştirebilirsin
          {firstPendingStepLabel ? ` (önce "${firstPendingStepLabel}")` : ""}.
          Seçim değiştikçe fiyat güncellenir.{" "}
          <span className="font-semibold text-pim-mercan underline underline-offset-2">
            Adıma git →
          </span>
        </button>
      ) : (
        <div className="mb-4 rounded-lg bg-sari-soft ring-1 ring-sari/30 px-3.5 py-2.5 text-[12.5px] text-lacivert">
          <span className="font-semibold">Varsayılan seçimlerle fiyat</span> —{" "}
          <strong>{pendingStepsCount} adımı</strong> kişiselleştirebilirsin
          {firstPendingStepLabel ? ` (önce "${firstPendingStepLabel}")` : ""}.
          Seçim değiştikçe fiyat güncellenir.
        </div>
      )
    ) : null;

  if (variant === "bold") {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-xl mt-2 p-6",
          "bg-gradient-to-br from-lacivert to-lacivert-soft text-white",
          className
        )}
      >
        <div
          aria-hidden
          className="absolute -top-10 -right-10 w-[140px] h-[140px] rounded-full bg-pim-mercan opacity-15"
        />
        <div className="relative flex justify-between items-center gap-4">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-white/60">
              {topLabel}
            </div>
            <div
              key={Math.round(total)}
              className="animate-count-pulse text-[32px] font-bold tracking-tight mt-1"
            >
              {fmt(total)} <span className="text-lg opacity-70">₺</span>
            </div>
            <div className="text-[13px] text-white/70 mt-1">{unitPrice}</div>
          </div>
          {savingsLabel && (
            <span
              className="inline-flex items-center h-8 px-3.5 rounded-full bg-pim-mercan text-white text-[13px] font-semibold cursor-help"
              title="En küçük adetin birim fiyatına göre indirim. Daha fazla adet = daha düşük birim fiyat."
            >
              {savingsLabel}
            </span>
          )}
        </div>

        {pendingWarning}

        <div className="relative mt-4 flex flex-col gap-1 px-3.5 py-2.5 rounded-lg bg-white/10 text-[13px]">
          <div className="flex items-center gap-2.5">
            <Icon.Calendar size={14} />
            <span>
              Tahmini teslim: <strong>{deliveryDate}</strong>
            </span>
          </div>
          {deliveryPromiseRange ? (
            <span className="text-white/75 text-[12px] pl-[22px]">
              Üretim: <strong>{deliveryPromiseRange}</strong>
              {deliveryPromiseNote ? ` · ${deliveryPromiseNote}` : ""}
            </span>
          ) : null}
        </div>

        <Button
          variant="primary"
          size="lg"
          block
          onClick={onCta}
          disabled={ctaLoading}
          className="relative mt-4"
        >
          {ctaLoading ? "Sepete ekleniyor…" : ctaLabel}{" "}
          {!ctaLoading && <Icon.ArrowR />}
        </Button>

        {footnote && (
          <div className="relative mt-2.5 text-[13px] text-center text-white/60">
            {footnote}
          </div>
        )}
      </div>
    );
  }

  // "quiet" (default)
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg mt-2 p-6 bg-white shadow-1 ring-1 ring-black/[0.04]",
        className
      )}
    >
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pim-mercan to-turuncu"
      />

      <div className="flex justify-between items-end gap-4 mb-4">
        <div>
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
            {topLabel}
          </div>
          <div
            key={Math.round(total)}
            className="animate-count-pulse text-[38px] font-bold tracking-tight leading-none"
          >
            {fmt(total)}{" "}
            <span className="text-[22px] font-semibold text-gri-700">₺</span>
          </div>
          <div className="text-[13px] text-gri-700 mt-1.5">{unitPrice}</div>
        </div>
        {savingsLabel && (
          <Pill variant="yesil" className="mb-1.5">
            {savingsLabel}
          </Pill>
        )}
      </div>

      {/* Sefa 21 May v68 (konfigüratör denetim #4): henüz tamamlanmamış
          zorunlu adımlar varken özet ve fiyat varsayılan değerlerle
          tahmini gösterildiği için kullanıcıya uyar. */}
      {pendingWarning}

      {/* Sefa 18 May v62: İşlem özeti — caller satır listesi geçer.
          v63 UX/A11y reviewer fix:
          - Eyebrow rengi mercan (2.42:1 fail) → kahve (~13:1, WCAG AAA)
          - <section aria-label> + sr-only <h2> → ekran okuyucu için
            başlık-liste ilişkisi kuruldu (sayfa h1 sonrası h2) */}
      {summaryItems && summaryItems.length > 0 && (
        <section
          aria-label="İşlem özeti"
          className="mb-4 rounded-lg bg-krem-soft/70 ring-1 ring-krem-koyu/30 px-3.5 py-2.5"
        >
          <h2 className="sr-only">İşlem özeti</h2>
          <div
            aria-hidden
            className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-kahve mb-1.5"
          >
            İşlem özeti
          </div>
          <ul className="space-y-1">
            {summaryItems.map((item, i) => (
              <li
                key={i}
                className="flex items-baseline gap-1.5 text-[13px] text-lacivert leading-snug"
              >
                {item.icon && (
                  <span aria-hidden className="text-[14px]">
                    {item.icon}
                  </span>
                )}
                <span className="text-gri-700">{item.label}:</span>
                <strong className="font-semibold tabular-nums">
                  {item.value}
                </strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {upsell && (
        <button
          type="button"
          onClick={upsell.onClick}
          className={cn(
            "flex items-center gap-2.5 w-full px-3.5 py-3 mb-3",
            "rounded-lg bg-sari-soft border border-dashed border-sari",
            "text-left text-[14px] font-semibold text-sari-koyu"
          )}
        >
          <span className="text-lg">💡</span>
          <span className="flex-1">{upsell.msg}</span>
          <Icon.ArrowR size={14} />
        </button>
      )}

      <div className="flex flex-col gap-1 px-3.5 py-2.5 mb-4 rounded-lg bg-gri-50 text-[13px]">
        <div className="flex items-center gap-2.5">
          <Icon.Calendar size={16} />
          <span>
            Tahmini teslim: <strong>{deliveryDate}</strong>
          </span>
        </div>
        {deliveryPromiseRange ? (
          <span className="text-gri-700 text-[12px] pl-[26px]">
            Üretim: <strong>{deliveryPromiseRange}</strong>
            {deliveryPromiseNote ? ` · ${deliveryPromiseNote}` : ""}
          </span>
        ) : null}
      </div>

      <Button
        variant="primary"
        size="lg"
        block
        onClick={onCta}
        disabled={ctaLoading}
      >
        {ctaLoading ? "Sepete ekleniyor…" : ctaLabel}{" "}
        {!ctaLoading && <Icon.ArrowR />}
      </Button>

      {footnote && (
        <div className="mt-2.5 text-[13px] text-center text-gri-500">
          {footnote}
        </div>
      )}
    </div>
  );
}
