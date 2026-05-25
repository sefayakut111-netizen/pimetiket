"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, Eyebrow } from "@/components/ui";

interface BlogPost {
  slug: string;
  title_tr: string;
  excerpt_tr: string;
  category: string;
  read_minutes: number;
  cover_image_url?: string;
}

export function BlogPreview({ limit = 3 }: { limit?: number }) {
  const [posts, setPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    fetch(`/api/blog?limit=${limit}`)
      .then((r) => (r.ok ? r.json() : { posts: [] }))
      .then((d) => setPosts(d.posts ?? []))
      .catch(() => {});
  }, [limit]);

  if (posts.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {posts.map((post) => (
        <Link
          key={post.slug}
          href={`/blog/${post.slug}`}
          className="group rounded-2xl bg-white ring-1 ring-gri-200 overflow-hidden hover:ring-pim-mercan hover:shadow-lg transition-all"
        >
          {post.cover_image_url && (
            <div className="h-36 overflow-hidden">
              <img
                src={post.cover_image_url}
                alt={post.title_tr}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          )}
          <div className="p-5">
            <div className="text-[11px] text-gri-500 uppercase tracking-wider">
              {post.category} · {post.read_minutes} dk
            </div>
            <h3 className="mt-1.5 text-[15px] font-semibold leading-snug line-clamp-2">
              {post.title_tr}
            </h3>
            {post.excerpt_tr && (
              <p className="mt-2 text-[13px] text-gri-700 line-clamp-2">
                {post.excerpt_tr}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

/** Blog + başlık — yazı yoksa tüm section gizlenir */
export function HomeBlogSection({
  locale,
  limit = 3,
}: {
  locale: string;
  limit?: number;
}) {
  const [posts, setPosts] = useState<BlogPost[] | null>(null);

  useEffect(() => {
    fetch(`/api/blog?limit=${limit}`)
      .then((r) => (r.ok ? r.json() : { posts: [] }))
      .then((d) => setPosts(d.posts ?? []))
      .catch(() => setPosts([]));
  }, [limit]);

  if (posts === null || posts.length === 0) return null;

  return (
    <section className="py-16 bg-gri-50">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <div>
            <Eyebrow>{locale === "en" ? "Blog" : "Blog"}</Eyebrow>
            <h2 className="mt-3 text-[24px] font-semibold tracking-tight">
              {locale === "en" ? "Tips & guides" : "İpuçları ve rehberler"}
            </h2>
          </div>
          <Button variant="secondary" href="/blog" size="sm">
            {locale === "en" ? "All articles" : "Tüm yazılar"}{" "}
            <Icon.ChevR size={12} />
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group rounded-2xl bg-white ring-1 ring-gri-200 overflow-hidden hover:ring-pim-mercan hover:shadow-lg transition-all"
            >
              {post.cover_image_url && (
                <div className="h-36 overflow-hidden">
                  <img
                    src={post.cover_image_url}
                    alt={post.title_tr}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}
              <div className="p-5">
                <div className="text-[11px] text-gri-500 uppercase tracking-wider">
                  {post.category} · {post.read_minutes} dk
                </div>
                <h3 className="mt-1.5 text-[15px] font-semibold leading-snug line-clamp-2">
                  {post.title_tr}
                </h3>
                {post.excerpt_tr && (
                  <p className="mt-2 text-[13px] text-gri-700 line-clamp-2">
                    {post.excerpt_tr}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
