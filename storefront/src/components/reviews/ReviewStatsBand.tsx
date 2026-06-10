import type { ReviewStats } from "@/lib/reviews-server";

const MIN_REVIEWS = 5;

interface ReviewStatsBandProps {
  stats: ReviewStats;
  className?: string;
}

/** ★ X.X · N yorum — N < 5 ise render etmez. */
export function ReviewStatsBand({ stats, className }: ReviewStatsBandProps) {
  if (stats.count < MIN_REVIEWS) return null;

  return (
    <p
      className={
        className ??
        "text-[14px] font-medium text-gri-700 tracking-tight"
      }
    >
      <span className="text-pim-mercan" aria-hidden>
        ★
      </span>{" "}
      {stats.averageRating.toFixed(1)} · {stats.count.toLocaleString("tr-TR")}{" "}
      yorum
    </p>
  );
}
