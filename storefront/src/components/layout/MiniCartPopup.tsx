"use client";

/**
 * MiniCartPopup — TopBar sepet ikonu hover'da açılan mini sepet preview.
 * Desktop-only (md+); mobile'da hover yok zaten direkt /sepet'e gider.
 */

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Pim } from "@/components/Pim";
import {
  type CustomerCartItem,
  FREE_SHIPPING_THRESHOLD,
} from "@/lib/customer-cart";
import { useT } from "@/lib/i18n/context";

const fmt = (n: number) => Math.round(n).toLocaleString("tr-TR");

interface Props {
  items: CustomerCartItem[];
  subtotal: number;
  shipping: number;
  total: number;
}

export function MiniCartPopup({ items, subtotal, shipping, total }: Props) {
  const { t } = useT();

  return (
    <div className="hidden md:block absolute top-full right-0 mt-2 w-[340px] bg-white rounded-2xl shadow-2 ring-1 ring-gri-200 overflow-hidden z-50 invisible opacity-0 translate-y-2 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 pointer-events-none group-hover:pointer-events-auto">
      <div className="px-4 py-3 border-b border-gri-100 flex items-center justify-between bg-gradient-to-br from-pim-mercan-tint/30 to-white">
        <span className="font-semibold text-[14px] text-lacivert">
          {t.cart.title}
        </span>
        <span className="text-[12px] text-gri-700 tabular-nums">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="p-6 text-center">
          <Pim pose="think" size={80} bob={false} />
          <h3 className="mt-2 font-semibold text-[14px] text-lacivert">
            {t.cart.empty}
          </h3>
          <p className="text-[12px] text-gri-700 mt-1 leading-relaxed">
            {t.cart.emptyDesc}
          </p>
          <div className="mt-4 flex gap-2 justify-center">
            <Link
              href="/etiket"
              className="px-3 py-2 rounded-full bg-pim-mercan text-white text-[12px] font-semibold hover:bg-pim-mercan-koyu"
            >
              {t.nav.etiket}
            </Link>
            <Link
              href="/sticker"
              className="px-3 py-2 rounded-full ring-1 ring-gri-200 text-lacivert text-[12px] font-semibold hover:ring-pim-mercan"
            >
              {t.nav.sticker}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <ul className="max-h-[280px] overflow-y-auto divide-y divide-gri-100">
            {items.slice(0, 4).map((item) => (
              <li key={item.id} className="p-3 flex gap-3">
                <div
                  className={`grid place-items-center w-10 h-10 rounded-lg shrink-0 ${
                    item.product === "etiket"
                      ? "bg-krem"
                      : "bg-pim-mercan-tint"
                  }`}
                >
                  {item.product === "etiket" ? (
                    <Icon.Roll size={16} className="text-lacivert" />
                  ) : (
                    <Icon.Sticker size={16} className="text-pim-mercan" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13px] text-lacivert truncate">
                    {item.title}
                  </div>
                  <div className="text-[11.5px] text-gri-500 tabular-nums">
                    {item.qty.toLocaleString("tr-TR")} ×{" "}
                    {item.unit.toFixed(2).replace(".", ",")} TL
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold text-[13px] tabular-nums">
                    {fmt(item.total)} TL
                  </div>
                </div>
              </li>
            ))}
            {items.length > 4 && (
              <li className="p-2 text-center text-[12px] text-gri-500">
                +{items.length - 4}
              </li>
            )}
          </ul>

          {shipping > 0 && (
            <div className="px-3 py-2 bg-sari-soft text-sari-koyu text-[11.5px] leading-tight">
              💡 {fmt(FREE_SHIPPING_THRESHOLD - subtotal)} TL
            </div>
          )}

          <div className="p-3 border-t border-gri-100 bg-gri-50/50">
            <div className="flex justify-between text-[13px] mb-1">
              <span className="text-gri-700">{t.cart.subtotal}</span>
              <span className="font-semibold tabular-nums">
                {fmt(subtotal)} TL
              </span>
            </div>
            <div className="flex justify-between text-[13px] mb-3">
              <span className="text-gri-700">{t.cart.shipping}</span>
              <span className="font-semibold tabular-nums">
                {shipping === 0 ? (
                  <span className="text-yesil">{t.cart.free}</span>
                ) : (
                  `${fmt(shipping)} TL`
                )}
              </span>
            </div>
            <div className="flex justify-between text-[14px] mb-3 pb-3 border-b border-gri-200">
              <span className="font-semibold">{t.cart.total}</span>
              <span className="text-[16px] font-bold tabular-nums">
                {fmt(total)} TL
              </span>
            </div>
            <Link
              href="/sepet"
              className="block w-full text-center py-2 rounded-full bg-pim-mercan text-white text-[13px] font-semibold hover:bg-pim-mercan-koyu transition-colors"
            >
              {t.cart.proceedToCheckout} →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
