"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "announce-haziran20-dismissed";

const MESSAGE = (
  <>
    <span aria-hidden>🎉</span> Açılışa özel — Haziran boyunca{" "}
    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/15 font-bold tracking-wide">
      HAZIRAN20
    </span>{" "}
    koduyla %20 indirim
  </>
);

export function AnnouncementBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
      setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Duyuru"
      className="relative z-[60] h-9 md:h-10 bg-lacivert text-white border-b border-white/10"
    >
      <div className="mx-auto max-w-[1280px] h-full px-4 md:px-8 flex items-center gap-2">
        <div className="flex-1 min-w-0 overflow-hidden group/announce">
          <div className="announce-marquee-track flex w-max gap-16 pr-16 group-hover/announce:[animation-play-state:paused]">
            <span className="text-[12.5px] md:text-[13px] font-medium whitespace-nowrap py-2">
              {MESSAGE}
            </span>
            <span
              className="text-[12.5px] md:text-[13px] font-medium whitespace-nowrap py-2 announce-marquee-duplicate"
              aria-hidden
            >
              {MESSAGE}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Duyuruyu kapat"
          className="shrink-0 grid place-items-center w-7 h-7 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        >
          <span aria-hidden className="text-lg leading-none">
            ×
          </span>
        </button>
      </div>
    </div>
  );
}
