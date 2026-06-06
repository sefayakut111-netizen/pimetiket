"use client";

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
  return (
    <div
      role="region"
      aria-label="Duyuru"
      className="relative z-[60] h-10 bg-lacivert text-white border-b border-white/10"
    >
      <div className="h-full overflow-hidden group/announce">
        <div className="announce-marquee-track flex h-full w-max items-center group-hover/announce:[animation-play-state:paused]">
          <span className="shrink-0 pe-12 text-[13px] font-medium leading-none whitespace-nowrap">
            {MESSAGE}
          </span>
          <span
            className="shrink-0 pe-12 text-[13px] font-medium leading-none whitespace-nowrap"
            aria-hidden
          >
            {MESSAGE}
          </span>
        </div>
      </div>
    </div>
  );
}
