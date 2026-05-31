/**
 * Pim Etiket — /blog
 * ?q= arama (TopBarSearch ile uyumlu), ?page= sayfalama
 */

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Card, Eyebrow, Pill } from "@/components/ui";
import { withSocialMetadata } from "@/lib/seo/page-metadata";
import {
  filterPostsByQuery,
  getPublishedPosts,
  getPublishedPostsPaginated,
  getReadMinutes,
} from "@/lib/blog-posts";

const title = "Blog — Etiket ve sticker rehberleri";
const description =
  "Etiket malzemesi nasıl seçilir, sticker baskı ipuçları, AI ön kontrol nasıl çalışır — Pim Etiket'in marka rehberi.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/blog" },
  ...withSocialMetadata({ title, description, canonical: "/blog" }),
};

export const revalidate = 300;

const months = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

interface Props {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function BlogIndexPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  let posts: Awaited<ReturnType<typeof getPublishedPosts>>;
  let totalPages = 1;
  let currentPage = 1;

  if (q) {
    const all = await getPublishedPosts();
    posts = filterPostsByQuery(all, q);
    totalPages = 1;
    currentPage = 1;
  } else {
    const paged = await getPublishedPostsPaginated(page);
    posts = paged.posts;
    totalPages = paged.totalPages;
    currentPage = page;
  }

  const [featured, ...rest] = q ? posts : posts.length > 0 ? [posts[0], ...posts.slice(1)] : [];

  const paginationHref = (p: number) => {
    const params = new URLSearchParams();
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/blog?${qs}` : "/blog";
  };

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[1080px] px-6">
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
          {q ? (
            <p className="mt-4 text-[14px] text-gri-600">
              Arama: <strong className="text-lacivert">{q}</strong> ({posts.length} sonuç) ·{" "}
              <Link href="/blog" className="text-pim-mercan font-medium hover:underline">
                Tüm yazılar
              </Link>
            </p>
          ) : null}
        </div>

        {posts.length === 0 ? (
          <Card padding="p-12" className="text-center">
            <Pim pose="think" size={120} />
            <h2 className="mt-4 text-xl font-semibold">
              {q ? "Sonuç bulunamadı" : "Yakında yeni yazılar"}
            </h2>
            <p className="mt-2 text-gri-700">
              {q ? "Farklı bir anahtar kelime deneyin." : "Blog içerikleri hazırlanıyor."}
            </p>
          </Card>
        ) : (
          <>
            {featured && !q && currentPage === 1 && (
              <Link href={`/blog/${featured.slug}`} prefetch={false} className="block mb-8 group">
                <Card
                  padding=""
                  className="!p-0 overflow-hidden grid grid-cols-1 md:grid-cols-2 hover:-translate-y-0.5 transition-transform"
                >
                  <div
                    className={`${featured.coverColor} grid place-items-center min-h-[220px] p-8 relative overflow-hidden`}
                  >
                    {featured.coverImageUrl ? (
                      <Image
                        src={featured.coverImageUrl}
                        alt={featured.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 540px"
                      />
                    ) : (
                      <Pim pose="inspect" size={140} />
                    )}
                  </div>
                  <div className="p-7 flex flex-col">
                    <div className="flex gap-2 items-center mb-3">
                      <Pill variant="mercan">Öne çıkan</Pill>
                      <span className="text-[12px] text-gri-500">{featured.category}</span>
                    </div>
                    <h2 className="text-[22px] font-semibold tracking-tight leading-tight group-hover:text-pim-mercan transition-colors">
                      {featured.title}
                    </h2>
                    <p className="text-[14px] text-gri-700 mt-2 leading-relaxed flex-1">
                      {featured.excerpt}
                    </p>
                    <div className="text-[12px] text-gri-500 mt-3 flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-lacivert">{featured.author}</span>
                      <span>·</span>
                      <span>{formatDate(featured.publishedAt)}</span>
                      <span>·</span>
                      <span>{getReadMinutes(featured)} dk okuma</span>
                    </div>
                  </div>
                </Card>
              </Link>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(q || currentPage > 1 ? posts : rest).map((p) => (
                <Link key={p.slug} href={`/blog/${p.slug}`} prefetch={false} className="block group">
                  <Card
                    padding=""
                    className="!p-0 overflow-hidden h-full hover:-translate-y-0.5 transition-transform"
                  >
                    <div
                      className={`${p.coverColor} grid place-items-center min-h-[140px] p-5 relative overflow-hidden`}
                    >
                      {p.coverImageUrl ? (
                        <Image
                          src={p.coverImageUrl}
                          alt={p.title}
                          fill
                          className="object-cover"
                          sizes="360px"
                        />
                      ) : (
                        <Pim pose="wave" size={80} />
                      )}
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
                        <span className="font-semibold text-lacivert">{p.author}</span>
                        <span>·</span>
                        <span>{formatDate(p.publishedAt)}</span>
                        <span>·</span>
                        <span>{p.readMinutes} dk okuma</span>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>

            {!q && totalPages > 1 && (
              <nav
                className="mt-8 flex items-center justify-center gap-4 text-[14px]"
                aria-label="Blog sayfalama"
              >
                {currentPage > 1 ? (
                  <Link
                    href={paginationHref(currentPage - 1)}
                    rel="prev"
                    className="font-medium text-pim-mercan hover:underline"
                  >
                    ← Önceki
                  </Link>
                ) : null}
                <span className="text-gri-600">
                  Sayfa {currentPage} / {totalPages}
                </span>
                {currentPage < totalPages ? (
                  <Link
                    href={paginationHref(currentPage + 1)}
                    rel="next"
                    className="font-medium text-pim-mercan hover:underline"
                  >
                    Sonraki →
                  </Link>
                ) : null}
              </nav>
            )}
          </>
        )}

        <Card padding="p-8" className="mt-10 !bg-lacivert !text-white text-center">
          <h2 className="text-2xl font-semibold mb-2">Pim&rsquo;e bir konu öner</h2>
          <p className="text-[14px] text-white/75 leading-relaxed max-w-[480px] mx-auto mb-5">
            Hangi konuyu yazalım, ne öğrenmek istersin? WhatsApp veya iletişim
            formundan yazarsan listede yer alır.
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
