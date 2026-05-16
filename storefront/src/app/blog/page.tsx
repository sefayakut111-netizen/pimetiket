/**
 * Pim Etiket — /blog
 *
 * SEO için yazı listesi. Backend swap'te `blog_posts` tablosundan okunacak.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Card, Eyebrow, Pill } from "@/components/ui";
import { BLOG_POSTS, getReadMinutes } from "@/lib/blog-posts";

export const metadata: Metadata = {
  title: "Blog — Etiket ve sticker rehberleri",
  description:
    "Etiket malzemesi nasıl seçilir, sticker baskı ipuçları, AI ön kontrol nasıl çalışır — Pim Etiket'in marka rehberi.",
  alternates: { canonical: "/blog" },
};

const months = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function BlogIndexPage() {
  const [featured, ...rest] = BLOG_POSTS;

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[1080px] px-6">
        {/* Hero */}
        <div className="mb-10 text-center">
          <Pim pose="happy" size={120} />
          <Eyebrow>Pim&rsquo;in defteri</Eyebrow>
          <h1 className="mt-3 text-[32px] md:text-[44px] font-semibold tracking-tight leading-tight">
            Etiket ve sticker rehberi
          </h1>
          <p className="mt-3 text-base text-gri-700 max-w-[560px] mx-auto leading-relaxed">
            Marka kuruyorsan veya raf etkisini büyütmek istiyorsan — burada
            Pim&rsquo;in atölye notları var.
          </p>
        </div>

        {/* Featured */}
        {featured && (
          <Link
            href={`/blog/${featured.slug}`}
            className="block mb-8 group"
          >
            <Card padding="" className="!p-0 overflow-hidden grid grid-cols-1 md:grid-cols-2 hover:-translate-y-0.5 transition-transform">
              <div
                className={`${featured.coverColor} grid place-items-center min-h-[220px] p-8`}
              >
                <Pim pose="inspect" size={140} />
              </div>
              <div className="p-7 flex flex-col">
                <div className="flex gap-2 items-center mb-3">
                  <Pill variant="mercan">Öne çıkan</Pill>
                  <span className="text-[12px] text-gri-500">
                    {featured.category}
                  </span>
                </div>
                <h2 className="text-[22px] font-semibold tracking-tight leading-tight group-hover:text-pim-mercan transition-colors">
                  {featured.title}
                </h2>
                <p className="text-[14px] text-gri-700 mt-2 leading-relaxed flex-1">
                  {featured.excerpt}
                </p>
                <div className="text-[12px] text-gri-500 mt-3 flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-lacivert">
                    {featured.author}
                  </span>
                  <span>·</span>
                  <span>{formatDate(featured.publishedAt)}</span>
                  <span>·</span>
                  <span>{getReadMinutes(featured)} dk okuma</span>
                </div>
              </div>
            </Card>
          </Link>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rest.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="block group">
              <Card padding="" className="!p-0 overflow-hidden h-full hover:-translate-y-0.5 transition-transform">
                <div
                  className={`${p.coverColor} grid place-items-center min-h-[140px] p-5`}
                >
                  <Pim pose="wave" size={80} />
                </div>
                <div className="p-5">
                  <div className="flex gap-2 items-center mb-2">
                    <Pill variant="krem">{p.category}</Pill>
                  </div>
                  <h3 className="font-semibold text-[16px] leading-snug mb-2 group-hover:text-pim-mercan transition-colors">
                    {p.title}
                  </h3>
                  <p className="text-[13px] text-gri-700 leading-relaxed line-clamp-3">
                    {p.excerpt}
                  </p>
                  <div className="text-[11.5px] text-gri-500 mt-3 flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-lacivert">
                      {p.author}
                    </span>
                    <span>·</span>
                    <span>{formatDate(p.publishedAt)}</span>
                    <span>·</span>
                    <span>{p.readMinutes} dk</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <Card padding="p-8" className="mt-10 !bg-lacivert !text-white text-center">
          <h2 className="text-2xl font-semibold mb-2">
            Pim&rsquo;e bir konu öner
          </h2>
          <p className="text-[14px] text-white/75 leading-relaxed max-w-[480px] mx-auto mb-5">
            Hangi konuyu yazalım, ne öğrenmek istersin? WhatsApp veya
            iletişim formundan yazarsan listede yer alır.
          </p>
          <Link
            href="/iletisim"
            className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-pim-mercan text-white font-semibold hover:bg-pim-mercan-koyu transition-colors"
          >
            Konu öner <Icon.ArrowR size={14} />
          </Link>
        </Card>
      </div>
    </main>
  );
}
