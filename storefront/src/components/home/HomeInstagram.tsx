"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import type { InstagramFeedPost, InstagramFeedResponse } from "@/lib/instagram/types";
import { INSTAGRAM_PROFILE_URL } from "@/lib/instagram/types";

interface HomeInstagramProps {
  locale: string;
}

function InstagramCell({
  post,
  index,
}: {
  post: InstagramFeedPost;
  index: number;
}) {
  return (
    <a
      href={post.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative aspect-square rounded-xl overflow-hidden ring-1 ring-black/[0.06] bg-pim-mercan-tint/40 hover:ring-pim-mercan/30 transition-all"
      aria-label={post.altText ?? `Instagram gönderisi ${index + 1}`}
    >
      <Image
        src={post.imageUrl}
        alt={post.altText ?? `Pim Etiket Instagram ${index + 1}`}
        fill
        sizes="(max-width: 640px) 33vw, 16vw"
        className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
        unoptimized={post.imageUrl.includes("cdninstagram.com")}
      />
    </a>
  );
}

function PlaceholderCell({ index }: { index: number }) {
  return (
    <a
      href={INSTAGRAM_PROFILE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative aspect-square rounded-xl overflow-hidden ring-1 ring-black/[0.06] bg-pim-mercan-tint/40 hover:ring-pim-mercan/30 transition-all"
      aria-label={`Instagram gönderisi ${index + 1}`}
    >
      <div className="absolute inset-0 grid place-items-center text-pim-mercan-koyu/40">
        <Icon.Instagram size={28} />
      </div>
    </a>
  );
}

export function HomeInstagram({ locale }: HomeInstagramProps) {
  const isEn = locale === "en";
  const [feed, setFeed] = useState<InstagramFeedResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/instagram")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: InstagramFeedResponse | null) => {
        if (!cancelled && data) setFeed(data);
      })
      .catch(() => {
        if (!cancelled) setFeed({ posts: [], source: "empty", handle: "pimetiket" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const posts = feed?.posts ?? [];

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
            href={INSTAGRAM_PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
          >
            <Icon.Instagram size={16} /> @{feed?.handle ?? "pimetiket"}
          </Button>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-4">
          {posts.length > 0
            ? posts.map((post, i) => (
                <InstagramCell key={post.id} post={post} index={i} />
              ))
            : Array.from({ length: 6 }, (_, i) => (
                <PlaceholderCell key={i} index={i} />
              ))}
        </div>
      </div>
    </section>
  );
}
