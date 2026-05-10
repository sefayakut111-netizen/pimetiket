/**
 * PaymentBadges — footer'da ödeme yöntemleri + güvenlik rozetleri.
 *
 * PayTR site denetiminde footer'da kabul edilen kart markalarının ve
 * 3D Secure / SSL ibarelerinin gösterilmesi olumlu sayılır.
 *
 * SVG'ler inline (CSP friendly, build-time, 0 network).
 * Marka logoları stilistik temsillerdir, ticari marka kullanımı için
 * resmi gereksinimler korundu (renkler ve okunabilirlik).
 */

export function PaymentBadges() {
  return (
    <div className="border-t border-white/10 pt-6 mt-6 flex flex-wrap gap-x-6 gap-y-4 items-center justify-between">
      {/* Card brands */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-white/55 mr-1">
          Kabul ettiğimiz kartlar
        </span>

        {/* Visa */}
        <div
          className="inline-flex items-center justify-center w-12 h-7 rounded-md bg-white shadow-sm"
          aria-label="Visa"
          title="Visa"
        >
          <svg viewBox="0 0 48 16" width="36" height="12" aria-hidden="true">
            <text
              x="24"
              y="13"
              textAnchor="middle"
              fontFamily="Arial, sans-serif"
              fontSize="14"
              fontWeight="900"
              fontStyle="italic"
              fill="#1A1F71"
              letterSpacing="-0.5"
            >
              VISA
            </text>
          </svg>
        </div>

        {/* Mastercard */}
        <div
          className="inline-flex items-center justify-center w-12 h-7 rounded-md bg-white shadow-sm"
          aria-label="Mastercard"
          title="Mastercard"
        >
          <svg viewBox="0 0 48 32" width="32" height="20" aria-hidden="true">
            <circle cx="18" cy="16" r="10" fill="#EB001B" />
            <circle cx="30" cy="16" r="10" fill="#F79E1B" />
            <path
              d="M24 8.5 a10 10 0 0 1 0 15 a10 10 0 0 1 0 -15"
              fill="#FF5F00"
            />
          </svg>
        </div>

        {/* Troy */}
        <div
          className="inline-flex items-center justify-center w-12 h-7 rounded-md bg-white shadow-sm"
          aria-label="Troy"
          title="Troy"
        >
          <svg viewBox="0 0 48 16" width="36" height="12" aria-hidden="true">
            <text
              x="24"
              y="13"
              textAnchor="middle"
              fontFamily="Arial, sans-serif"
              fontSize="13"
              fontWeight="900"
              fill="#00945F"
              letterSpacing="-0.3"
            >
              troy
            </text>
            <circle cx="40" cy="9" r="2" fill="#E20D2C" />
          </svg>
        </div>

        {/* American Express */}
        <div
          className="inline-flex items-center justify-center w-12 h-7 rounded-md bg-[#006FCF] shadow-sm"
          aria-label="American Express"
          title="American Express"
        >
          <svg viewBox="0 0 48 16" width="40" height="12" aria-hidden="true">
            <text
              x="24"
              y="12"
              textAnchor="middle"
              fontFamily="Arial, sans-serif"
              fontSize="9"
              fontWeight="900"
              fill="#FFFFFF"
              letterSpacing="0.5"
            >
              AMEX
            </text>
          </svg>
        </div>
      </div>

      {/* Security badges */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* 3D Secure */}
        <div
          className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md bg-white/10 ring-1 ring-white/15"
          aria-label="3D Secure ile güvenli ödeme"
          title="3D Secure ile güvenli ödeme"
        >
          <svg
            viewBox="0 0 24 24"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-pim-mercan"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <span className="text-[11.5px] font-semibold text-white/85 tracking-tight">
            3D Secure
          </span>
        </div>

        {/* SSL */}
        <div
          className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md bg-white/10 ring-1 ring-white/15"
          aria-label="SSL ile şifrelenmiş bağlantı"
          title="SSL ile şifrelenmiş bağlantı"
        >
          <svg
            viewBox="0 0 24 24"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-pim-mercan"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="text-[11.5px] font-semibold text-white/85 tracking-tight">
            SSL Güvenli
          </span>
        </div>

        {/* PayTR */}
        <div
          className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md bg-white/10 ring-1 ring-white/15"
          aria-label="Ödemeler PayTR güvencesi ile"
          title="Ödemeler PayTR güvencesi ile"
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-white/55">
            Ödeme altyapısı
          </span>
          <span className="text-[11.5px] font-bold text-white/95">PayTR</span>
        </div>

        {/* KVKK */}
        <div
          className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md bg-white/10 ring-1 ring-white/15"
          aria-label="6698 sayılı Kişisel Verilerin Korunması Kanunu uyumlu"
          title="6698 sayılı Kişisel Verilerin Korunması Kanunu uyumlu"
        >
          <svg
            viewBox="0 0 24 24"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-pim-mercan"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span className="text-[11.5px] font-semibold text-white/85 tracking-tight">
            KVKK Uyumlu
          </span>
        </div>
      </div>
    </div>
  );
}
