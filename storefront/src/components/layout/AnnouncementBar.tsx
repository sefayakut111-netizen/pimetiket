"use client";

import { useEffect, useState } from "react";

import { CAMPAIGN_CODE, isCampaignActive } from "@/lib/campaign";

/** Kullanıcı kapatınca tercih burada saklanır (denetim P1-10). */
const DISMISS_KEY = "pim_announce_haziran20_dismissed";

const MESSAGES = [
  <>
    <span aria-hidden>🎉</span> Açılışa özel — Haziran boyunca{" "}
    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/15 font-bold tracking-wide">
      {CAMPAIGN_CODE}
    </span>{" "}
    koduyla %20 indirim
  </>,
] as const;

/** Geniş ekranda track > viewport olması için yarı başına tekrar sayısı */
const MESSAGE_REPEATS_PER_HALF = 8;

function MarqueeHalf({ hidden }: { hidden?: boolean }) {
  return (
    <div
      className="flex shrink-0 items-center"
      {...(hidden ? { "aria-hidden": true as const } : {})}
    >
      {Array.from({ length: MESSAGE_REPEATS_PER_HALF }, (_, repeatIdx) =>
        MESSAGES.map((message, msgIdx) => (
          <span
            key={`${repeatIdx}-${msgIdx}`}
            className="shrink-0 pe-12 text-[13px] font-medium leading-none whitespace-nowrap"
          >
            {message}
          </span>
        ))
      )}
    </div>
  );
}

export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(false);

  // Kapatma tercihini mount'tan sonra oku (SSR/hydration uyumlu — ilk render
  // her zaman barı gösterir, dismissed sonradan true olur).
  useEffect(() => {
    try {
      // localStorage client-only → mount sonrası tek sefer okunur (SSR/hydration
      // uyumlu kalsın diye ilk render barı gösterir, dismissed sonradan set olur).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
    } catch {
      /* localStorage erişilemezse barı göstermeye devam et */
    }
  }, []);

  if (!isCampaignActive() || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* sessiz geç */
    }
  };

  return (
    <div
      role="region"
      aria-label="Duyuru"
      className="relative z-[60] h-10 bg-lacivert text-white border-b border-white/10"
    >
      <div className="h-full overflow-hidden group/announce pe-10">
        <div className="announce-marquee-track flex h-full w-max min-w-[200vw] items-center group-hover/announce:[animation-play-state:paused]">
          <MarqueeHalf />
          <MarqueeHalf hidden />
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Duyuruyu kapat"
        className="absolute right-0 top-0 bottom-0 z-10 grid w-10 place-items-center bg-lacivert text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60"
      >
        <span aria-hidden className="text-[18px] leading-none">
          ×
        </span>
      </button>
    </div>
  );
}
