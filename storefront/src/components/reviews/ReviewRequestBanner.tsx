/**
 * ReviewRequestBanner — Login sonrası TopBar altında yorum talebi banner'ı.
 *
 * Sadece kullanıcının `pending` review_request'i varsa görünür.
 * Pim'in mesajı + "Şimdi yaz" CTA + "Daha sonra" / "X" dismiss.
 *
 * Brand voice:
 *   - "Sen" dili
 *   - Abartısız
 *   - Empati zorlaması yok
 *   - 30 saniye olduğunu vurgu, kolay
 */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getMyPendingReviewRequest,
  recordBannerShown,
  dismissBanner,
  type ReviewRequest,
} from "@/lib/reviews";
import { useUser } from "@/lib/supabase/use-user";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";

export function ReviewRequestBanner() {
  const { user, displayName } = useUser();
  const [request, setRequest] = useState<ReviewRequest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    void getMyPendingReviewRequest()
      .then((r) => {
        setRequest(r);
        if (r) {
          // İlk gösterimi kaydet
          void recordBannerShown(r.id);
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  if (loading || !user || !request) return null;

  const handleLater = async () => {
    await dismissBanner(request.id, false);
    setRequest(null);
  };

  const handleClose = async () => {
    await dismissBanner(request.id, true);
    setRequest(null);
  };

  const firstName = displayName?.split(" ")[0] ?? "Selam";

  return (
    <div className="bg-gradient-to-r from-pim-mercan/10 via-yesil-soft to-pim-mercan/10 border-b border-pim-mercan/20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8 py-3 flex items-center gap-3 md:gap-4">
        <div className="hidden sm:block shrink-0">
          <Pim pose="wave" size={48} bob={false} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[13px] md:text-[13.5px] text-lacivert leading-relaxed">
            <strong className="font-semibold">{firstName},</strong> son
            siparişin teslim edildi. <span className="hidden sm:inline">3-5 cümlelik bir yorum yazarsan </span>
            <span className="sm:hidden">Yorum yazar mısın? </span>
            <span className="hidden md:inline">anasayfada paylaşmak isteriz — </span>
            <strong>30 saniyeni alır.</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/yorum-yaz/${request.order_id}`}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-pim-mercan text-white text-[12.5px] font-semibold hover:bg-pim-mercan/90 transition-colors whitespace-nowrap"
          >
            <Icon.Sparkle size={13} /> Yorum yaz
          </Link>
          <button
            type="button"
            onClick={handleLater}
            className="hidden md:inline text-[12px] text-gri-700 hover:text-lacivert font-medium underline-offset-2 hover:underline whitespace-nowrap"
          >
            Daha sonra
          </button>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Yorum bildirimini kapat"
            className="grid place-items-center w-7 h-7 rounded-full text-gri-500 hover:bg-white/50 hover:text-lacivert transition-colors"
          >
            <Icon.X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
