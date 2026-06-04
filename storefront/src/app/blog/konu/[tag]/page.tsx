import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Pim } from "@/components/Pim";
import { Card, Eyebrow } from "@/components/ui";
import { withSocialMetadata } from "@/lib/seo/page-metadata";
import {
  getPostsByCategory,
  getPublishedPosts,
  getBlogCategoryLabel,
} from "@/lib/blog-posts";

interface Props {
  params: Promise<{ tag: string }>;
}

export async function generateStaticParams() {
  const posts = await getPublishedPosts();
  const tags = [...new Set(posts.map((p) => p.categoryRaw))];
  return tags.map((tag) => ({ tag }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  const label = getBlogCategoryLabel(tag);
  const title = `${label} — Blog · Pim Etiket`;
  const description = `Pim Etiket blog: ${label} kategorisindeki etiket ve sticker rehberleri.`;
  const canonical = `/blog/konu/${tag}`;
  return {
    title,
    description,
    alternates: { canonical },
    ...withSocialMetadata({ title, description, canonical }),
  };
}

export const revalidate = 3600;

export default async function BlogKonuPage({ params }: Props) {
  const { tag } = await params;
  const posts = await getPostsByCategory(tag);
  if (posts.length === 0) notFound();

  const label = getBlogCategoryLabel(tag);

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[1080px] px-6">
        <div className="mb-10 text-center">
          <Pim pose="happy" size={100} />
          <Eyebrow>Blog · {label}</Eyebrow>
          <h1 className="mt-3 text-[32px] font-semibold tracking-tight">
            {label} yazıları
          </h1>
          <p className="mt-2 text-gri-700">
            <Link href="/blog" className="text-pim-mercan font-medium hover:underline">
              Tüm blog
            </Link>
          </p>
        </div>
        <ul className="grid gap-4 md:grid-cols-2">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link href={`/blog/${post.slug}`} prefetch={false} className="block group">
                <Card
                  padding=""
                  className="!p-0 overflow-hidden h-full hover:-translate-y-0.5 transition-transform"
                >
                  <div
                    className={`${post.coverColor} grid place-items-center min-h-[120px] p-4 relative overflow-hidden`}
                  >
                    {post.coverImageUrl ? (
                      <Image
                        src={post.coverImageUrl}
                        alt={post.title}
                        fill
                        className="object-cover"
                        sizes="540px"
                      />
                    ) : (
                      <Pim pose="wave" size={64} />
                    )}
                  </div>
                  <div className="p-6">
                    <h2 className="text-lg font-semibold text-lacivert group-hover:text-pim-mercan transition-colors">
                      {post.title}
                    </h2>
                    <p className="mt-2 text-[14px] text-gri-700 line-clamp-2">{post.excerpt}</p>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
