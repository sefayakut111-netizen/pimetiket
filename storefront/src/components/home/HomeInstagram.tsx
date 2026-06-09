"use client";

import Image from "next/image";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { useSiteImage } from "@/lib/site-images-client";

const INSTAGRAM_SLOTS = [
  "home_instagram_1",
  "home_instagram_2",
  "home_instagram_3",
  "home_instagram_4",
  "home_instagram_5",
  "home_instagram_6",
] as const;

interface HomeInstagramProps {
  locale: string;
}

function InstagramCell({
  slot,
  index,
}: {
  slot: (typeof INSTAGRAM_SLOTS)[number];
  index: number;
}) {
  const image = useSiteImage(slot);

  return (
    <a
      href="https://instagram.com/pimetiket"
      target="_blank"
      rel="noopener noreferrer"
      className="group relative aspect-square rounded-xl overflow-hidden ring-1 ring-black/[0.06] bg-pim-mercan-tint/40 hover:ring-pim-mercan/30 transition-all"
      aria-label={`Instagram gönderisi ${index + 1}`}
    >
      {image ? (
        <Image
          src={image.publicUrl}
          alt={image.altText ?? `Pim Etiket Instagram ${index + 1}`}
          fill
          sizes="(max-width: 640px) 33vw, 16vw"
          className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-pim-mercan-koyu/40">
          <Icon.Instagram size={28} />
        </div>
      )}
    </a>
  );
}

export function HomeInstagram({ locale }: HomeInstagramProps) {
  const isEn = locale === "en";

  return (
    <section className="py-16 md:py-20 bg-gri-50">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
          <div>
            <h2 className="text-[24px] md:text-[32px] font-semibold tracking-tight leading-tight">
              {isEn ? "Follow us on Instagram" : "Bizi Instagram'da takip edin"}
            </h2>
            <p className="mt-2 text-[14px] md:text-base text-gri-700 max-w-[480px] leading-relaxed">
              {isEn
                ? "Inspirations, behind the scenes, customer projects"
                : "İlham, üretim sahne arkası, müşteri projeleri"}
            </p>
          </div>
          <Button
            variant="secondary"
            href="https://instagram.com/pimetiket"
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
          >
            <Icon.Instagram size={16} /> @pimetiket
          </Button>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-4">
          {INSTAGRAM_SLOTS.map((slot, i) => (
            <InstagramCell key={slot} slot={slot} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
