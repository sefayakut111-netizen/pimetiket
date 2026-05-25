/**
 * Pim Etiket — /blog/[slug]
 */

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Pill } from "@/components/ui";
import {
  getPublishedPosts,
  getPostBySlug,
  getReadMinutes,
} from "@/lib/blog-posts";
import { getSiteImage } from "@/lib/site-images";
import {
  SchemaJsonLd,
  articleSchema,
  breadcrumbSchema,
} from "@/components/SchemaJsonLd";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const posts = await getPublishedPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Yazı bulunamadı" };
  return {
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.publishedAt,
      authors: [post.author],
    },
  };
}

const months = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function renderBody(body: string): React.ReactNode[] {
  const blocks = body.split(/\n\n+/);
  return blocks.map((block, i) => {
    const parts = block.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={j} className="text-lacivert font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={j}>{part}</span>;
    });
    return (
      <p
        key={i}
        className="text-[16px] text-gri-700 leading-relaxed mb-4 last:mb-0"
      >
        {parts}
      </p>
    );
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const [post, allPosts, defaultHero] = await Promise.all([
    getPostBySlug(slug),
    getPublishedPosts(),
    getSiteImage("blog_default_hero"),
  ]);
  if (!post) notFound();

  const idx = allPosts.findIndex((p) => p.slug === slug);
  const prev = idx > 0 ? allPosts[idx - 1] : null;
  const next = idx >= 0 && idx < allPosts.length - 1 ? allPosts[idx + 1] : null;

  const coverSrc = post.coverImageUrl ?? defaultHero?.publicUrl ?? null;

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <SchemaJsonLd
        data={articleSchema({
          title: post.title,
          description: post.excerpt,
          url: `/blog/${post.slug}`,
          publishedAt: post.publishedAt,
          image: coverSrc ?? undefined,
        })}
      />
      <SchemaJsonLd
        data={breadcrumbSchema([
          { label: "Anasayfa", url: "/" },
          { label: "Blog", url: "/blog" },
          { label: post.title, url: `/blog/${post.slug}` },
        ])}
      />

      <article className="mx-auto max-w-[760px] px-6">
        <div className="flex items-center gap-2 text-[14px] mb-6">
          <Link
            href="/"
            className="px-2 py-1 rounded text-gri-700 hover:bg-gri-100 hover:text-lacivert"
          >
            Anasayfa
          </Link>
          <Icon.ChevR size={14} className="text-gri-500" />
          <Link
            href="/blog"
            className="px-2 py-1 rounded text-gri-700 hover:bg-gri-100 hover:text-lacivert"
          >
            Blog
          </Link>
          <Icon.ChevR size={14} className="text-gri-500" />
          <span className="font-semibold truncate">{post.title}</span>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <Pill variant="mercan">{post.category}</Pill>
          <span className="text-[12px] text-gri-500">
            {getReadMinutes(post)} dk okuma
          </span>
        </div>
        <h1 className="text-[32px] md:text-[40px] font-semibold tracking-tight leading-tight mb-4">
          {post.title}
        </h1>
        <div className="flex items-center gap-3 text-[13px] text-gri-700 mb-6">
          <Pim pose="happy" size={36} bob={false} />
          <div>
            <div className="font-semibold text-lacivert">{post.author}</div>
            <div className="text-[12px] text-gri-500">
              {formatDate(post.publishedAt)}
            </div>
          </div>
        </div>

        <div
          className={`${post.coverColor} rounded-2xl grid place-items-center min-h-[240px] mb-7 overflow-hidden relative`}
        >
          {coverSrc ? (
            <Image
              src={coverSrc}
              alt={defaultHero?.altText ?? post.title}
              width={1200}
              height={630}
              sizes="(max-width: 768px) 100vw, 800px"
              className="w-full h-full object-cover max-h-[360px]"
            />
          ) : (
            <Pim pose="inspect" size={160} />
          )}
        </div>

        <p className="text-[18px] text-lacivert leading-relaxed font-medium border-l-4 border-pim-mercan pl-4 mb-7">
          {post.excerpt}
        </p>

        <div className="prose-pim">{renderBody(post.body)}</div>

        <Card padding="p-6" className="!bg-krem mt-10">
          <div className="flex gap-4 items-start">
            <Pim pose="chat" size={64} />
            <div className="flex-1">
              <h3 className="font-semibold text-base mb-1">Pim&rsquo;e sor</h3>
              <p className="text-[13.5px] text-gri-700 leading-relaxed">
                Bu konuda kafan karıştıysa sağ alt köşedeki Pim balonuna tıkla.
              </p>
            </div>
          </div>
        </Card>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-3">
          {prev ? (
            <Link
              href={`/blog/${prev.slug}`}
              className="block p-4 rounded-xl bg-white ring-1 ring-gri-200 hover:ring-pim-mercan transition-all"
            >
              <div className="text-[11.5px] text-gri-500 uppercase tracking-[0.04em] font-semibold mb-1">
                ← Önceki
              </div>
              <div className="font-semibold text-[14px] text-lacivert leading-snug">
                {prev.title}
              </div>
            </Link>
          ) : (
            <div />
          )}
          {next ? (
            <Link
              href={`/blog/${next.slug}`}
              className="block p-4 rounded-xl bg-white ring-1 ring-gri-200 hover:ring-pim-mercan transition-all text-right"
            >
              <div className="text-[11.5px] text-gri-500 uppercase tracking-[0.04em] font-semibold mb-1">
                Sonraki →
              </div>
              <div className="font-semibold text-[14px] text-lacivert leading-snug">
                {next.title}
              </div>
            </Link>
          ) : (
            <div />
          )}
        </div>

        <div className="mt-8 flex justify-center gap-3 flex-wrap">
          <Button variant="primary" size="lg" href="/etiket">
            <Icon.Roll size={18} /> Etiket bastır
          </Button>
          <Button variant="secondary" size="lg" href="/sticker">
            <Icon.Sticker size={18} /> Sticker bastır
          </Button>
        </div>
      </article>
    </main>
  );
}
