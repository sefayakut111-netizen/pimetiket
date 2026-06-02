/**
 * RollMiniBar — rulo segmentleri yatay bar.
 *
 * sticker-fiyatlama.html v0.3 → roll-mini visualization port'u.
 *
 * Her tabaka bir segment:
 *   - used: dolu (mercan #FF6B5B)
 *   - fire: son rulodaki kullanılmamış slot (cream zigzag)
 *   - empty: yeni rulonun kullanılmayan slotu (gri)
 */

import type { GeometryResult } from "@/lib/pricing-engine";
import { cn } from "@/lib/cn";
import { computeMiniBarSegments } from "@/components/pricing/layout-helpers";

interface RollMiniBarProps {
  geometry: GeometryResult;
}

export function DiecutFireBar({ geometry }: RollMiniBarProps) {
  const total = geometry.totalM2;
  if (total <= 0) return null;
  const usedPct = Math.min(100, (geometry.stickerArea / total) * 100);
  const firePct = Math.max(0, 100 - usedPct);
  return (
    <div
      className="flex items-stretch p-1 bg-gri-50 rounded-lg h-9 gap-px"
      role="img"
      aria-label={`Sticker alanı %${usedPct.toFixed(0)} · fire %${firePct.toFixed(0)}`}
    >
      <div
        className="rounded-sm bg-pim-mercan"
        style={{ flex: usedPct }}
        title={`Sticker alanı: %${usedPct.toFixed(0)}`}
      />
      <div
        className="rounded-sm bg-[repeating-linear-gradient(45deg,#E8DBC4_0_4px,#DDD0B8_4px_8px)]"
        style={{ flex: firePct }}
        title={`Fire: %${firePct.toFixed(0)}`}
      />
    </div>
  );
}

export function RollMiniBar({ geometry }: RollMiniBarProps) {
  const segments = computeMiniBarSegments(geometry);
  const totalSlots = geometry.roll.rollsNeeded * geometry.roll.sheetsPerRoll;

  if (totalSlots === 0) return null;

  // Her bir segment'in ayrı kutucuk olarak gösterilmesi
  // çok fazla tabaka olunca dağılır — gruplu göstermek daha temiz
  // Eğer total > 30 ise gruplu, değilse tek tek
  if (totalSlots <= 30) {
    return (
      <div
        className="flex items-stretch gap-1 p-2 bg-gri-50 rounded-lg h-9"
        role="img"
        aria-label={`Rulo doluluk: ${geometry.fit.sheetsNeeded}/${totalSlots} tabaka`}
      >
        {segments.flatMap((seg, segIdx) =>
          Array.from({ length: seg.count }).map((_, i) => (
            <div
              key={`${segIdx}-${i}`}
              className={cn(
                "flex-1 rounded-sm",
                seg.type === "used" && "bg-pim-mercan",
                seg.type === "fire" && "bg-[repeating-linear-gradient(45deg,#E8DBC4_0_4px,#DDD0B8_4px_8px)]",
                seg.type === "empty" && "bg-krem"
              )}
            />
          ))
        )}
      </div>
    );
  }

  // Çok tabaka varsa proportional bar (segments sıralı)
  return (
    <div
      className="flex items-stretch p-1 bg-gri-50 rounded-lg h-9 gap-px"
      role="img"
      aria-label={`Rulo doluluk: ${geometry.fit.sheetsNeeded}/${totalSlots} tabaka`}
    >
      {segments.map((seg, idx) => (
        <div
          key={idx}
          className={cn(
            "rounded-sm",
            seg.type === "used" && "bg-pim-mercan",
            seg.type === "fire" && "bg-[repeating-linear-gradient(45deg,#E8DBC4_0_4px,#DDD0B8_4px_8px)]",
            seg.type === "empty" && "bg-krem"
          )}
          style={{ flex: seg.count }}
          title={`${seg.type === "used" ? "Dolu" : seg.type === "fire" ? "Fire" : "Boş"}: ${seg.count} tabaka`}
        />
      ))}
    </div>
  );
}
