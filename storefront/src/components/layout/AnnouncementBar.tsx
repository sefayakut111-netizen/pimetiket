"use client";

/** HAZIRAN20 kampanyası — 30 Haziran 2026 23:59 TR sonrası gizlenir. */
const CAMPAIGN_VALID_UNTIL = new Date("2026-06-30T23:59:59+03:00");

const MESSAGE = (
  <>
    <span aria-hidden>🎉</span> Açılışa özel — Haziran boyunca{" "}
    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/15 font-bold tracking-wide">
      HAZIRAN20
    </span>{" "}
    koduyla %20 indirim
  </>
);

/** Geniş ekranda track > viewport olması için yarı başına tekrar sayısı */
const MESSAGE_REPEATS_PER_HALF = 4;

function MarqueeHalf({ hidden }: { hidden?: boolean }) {
  return (
    <div
      className="flex shrink-0 items-center"
      {...(hidden ? { "aria-hidden": true as const } : {})}
    >
      {Array.from({ length: MESSAGE_REPEATS_PER_HALF }, (_, i) => (
        <span
          key={i}
          className="shrink-0 pe-12 text-[13px] font-medium leading-none whitespace-nowrap"
        >
          {MESSAGE}
        </span>
      ))}
    </div>
  );
}

export function AnnouncementBar() {
  if (new Date() > CAMPAIGN_VALID_UNTIL) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Duyuru"
      className="relative z-[60] h-10 bg-lacivert text-white border-b border-white/10"
    >
      <div className="h-full overflow-hidden group/announce">
        <div className="announce-marquee-track flex h-full w-max min-w-[200vw] items-center group-hover/announce:[animation-play-state:paused]">
          <MarqueeHalf />
          <MarqueeHalf hidden />
        </div>
      </div>
    </div>
  );
}
