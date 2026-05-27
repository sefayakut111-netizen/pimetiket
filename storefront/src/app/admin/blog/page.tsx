"use client";

/**
 * Pim Etiket — /admin/blog
 * Blog yazıları CRUD (blog_posts tablosu).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import {
  Button,
  Card,
  Eyebrow,
  Input,
  Modal,
  useToast,
  Skeleton,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { StatusDot, type DotColor } from "@/components/admin/ui";
import { slugifyTitle } from "@/lib/blog-slug";
import type { BlogPostRow, BlogPostStatus } from "@/app/api/admin/blog/route";

type StatusFilter = "all" | BlogPostStatus;

const CATEGORIES = [
  "genel",
  "rehber",
  "teknoloji",
  "pazarlama",
  "trend",
  "teknik",
  "karsilastirma",
  "hakkimizda",
] as const;

const STATUS_META: Record<BlogPostStatus, { label: string; dot: DotColor }> = {
  draft: { label: "taslak", dot: "gri" },
  published: { label: "yayında", dot: "yesil" },
  archived: { label: "arşiv", dot: "gri" },
};

function StatusBadge({ status }: { status: BlogPostStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusDot color={meta.dot} />
      {meta.label}
    </span>
  );
}

const emptyDraft = (): Partial<BlogPostRow> & { title_tr: string; body_tr: string } => ({
  title_tr: "",
  body_tr: "",
  excerpt_tr: "",
  slug: "",
  category: "genel",
  status: "draft",
  seo_title: "",
  seo_description: "",
  cover_image_url: "",
  author_name: "Pim Etiket",
});

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminBlogPage() {
  const toast = useToast();
  const [posts, setPosts] = useState<BlogPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BlogPostRow | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/blog", { cache: "no-store" });
      const json = (await res.json()) as { ok?: boolean; posts?: BlogPostRow[] };
      if (!res.ok || !json.ok) throw new Error("fetch_failed");
      setPosts(json.posts ?? []);
    } catch {
      toast.error("Blog yazıları yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (filter === "all") return posts;
    return posts.filter((p) => p.status === filter);
  }, [posts, filter]);

  const openNew = () => {
    setEditing(null);
    setDraft(emptyDraft());
    setModalOpen(true);
  };

  const openEdit = (post: BlogPostRow) => {
    setEditing(post);
    setDraft({ ...post });
    setModalOpen(true);
  };

  const savePost = async (publish = false) => {
    if (!draft.title_tr?.trim() || !draft.body_tr?.trim()) {
      toast.error("Başlık ve içerik zorunlu");
      return;
    }
    setSaving(true);
    try {
      const slug =
        draft.slug?.trim() ||
        slugifyTitle(draft.title_tr) ||
        slugifyTitle("yazi");
      const status: BlogPostStatus = publish
        ? "published"
        : (draft.status as BlogPostStatus) ?? "draft";

      const payload = {
        ...draft,
        slug,
        status,
      };

      const res = await fetch("/api/admin/blog", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editing ? { id: editing.id, ...payload } : payload
        ),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        post?: BlogPostRow;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.post) {
        toast.error(json.error ?? "Kaydedilemedi");
        return;
      }
      toast.success(publish ? "Yayınlandı" : "Kaydedildi");
      setModalOpen(false);
      await refresh();
    } catch {
      toast.error("Ağ hatası");
    } finally {
      setSaving(false);
    }
  };

  const removePost = async (post: BlogPostRow) => {
    if (!confirm(`"${post.title_tr}" silinsin mi?`)) return;
    const res = await fetch(`/api/admin/blog?id=${encodeURIComponent(post.id)}`, {
      method: "DELETE",
    });
    const json = (await res.json()) as { ok?: boolean };
    if (!json.ok) {
      toast.error("Silinemedi");
      return;
    }
    toast.info("Silindi");
    await refresh();
  };

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
          <div>
            <Eyebrow>İçerik</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
              Blog Yönetimi
            </h1>
            <p className="mt-1.5 text-base text-gri-700">
              {posts.length} yazı ·{" "}
              {posts.filter((p) => p.status === "published").length} yayında
            </p>
          </div>
          <Button variant="primary" size="lg" onClick={openNew}>
            <Icon.Plus size={16} /> Yeni yazı
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap mb-5">
          {(
            [
              ["all", "Tümü"],
              ["published", "Yayında"],
              ["draft", "Taslak"],
              ["archived", "Arşiv"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[13px] font-semibold transition-colors",
                filter === key
                  ? "bg-lacivert text-white"
                  : "bg-gri-100 text-gri-700 hover:bg-gri-200"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : filtered.length === 0 ? (
          <Card padding="p-12" className="text-center">
            <Pim pose="think" size={120} />
            <h3 className="mt-4 text-xl font-semibold">Henüz yazı yok</h3>
            <p className="mt-2 text-gri-700">İlk blog yazını oluştur.</p>
          </Card>
        ) : (
          <Card padding="p-0" className="overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead className="border-b border-gri-200 bg-gri-50">
                <tr>
                  <th className="px-4 py-3 font-semibold">Başlık</th>
                  <th className="px-4 py-3 font-semibold">Kategori</th>
                  <th className="px-4 py-3 font-semibold">Durum</th>
                  <th className="px-4 py-3 font-semibold">Tarih</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gri-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gri-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-lacivert">{p.title_tr}</div>
                      <div className="text-[11px] text-gri-500 font-mono">{p.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-gri-700">{p.category}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-gri-700 tabular-nums">
                      {formatDate(p.published_at ?? p.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                        Düzenle
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void removePost(p)}>
                        Sil
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editing ? "Yazıyı düzenle" : "Yeni blog yazısı"}
          maxWidthClassName="max-w-3xl"
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <label className="block">
              <span className="text-[13px] font-semibold mb-1 block">Başlık (TR)</span>
              <Input
                value={draft.title_tr ?? ""}
                onChange={(e) => {
                  const title_tr = e.target.value;
                  setDraft((d) => ({
                    ...d,
                    title_tr,
                    slug: d.slug || slugifyTitle(title_tr),
                  }));
                }}
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold mb-1 block">Slug</span>
              <Input
                value={draft.slug ?? ""}
                onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[13px] font-semibold mb-1 block">Kategori</span>
                <select
                  value={draft.category ?? "genel"}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-white ring-1 ring-gri-200 text-[13px]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[13px] font-semibold mb-1 block">Kapak görseli URL</span>
                <Input
                  value={draft.cover_image_url ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, cover_image_url: e.target.value })
                  }
                  placeholder="https://..."
                />
              </label>
            </div>
            <label className="block">
              <span className="text-[13px] font-semibold mb-1 block">Özet</span>
              <Input
                value={draft.excerpt_tr ?? ""}
                onChange={(e) => setDraft({ ...draft, excerpt_tr: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold mb-1 block">İçerik (TR)</span>
              <textarea
                value={draft.body_tr ?? ""}
                onChange={(e) => setDraft({ ...draft, body_tr: e.target.value })}
                rows={12}
                className="w-full px-3 py-2 rounded-lg bg-white ring-1 ring-gri-200 text-[13px] leading-relaxed"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold mb-1 block">SEO başlık</span>
              <Input
                value={draft.seo_title ?? ""}
                onChange={(e) => setDraft({ ...draft, seo_title: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold mb-1 block">SEO açıklama</span>
              <Input
                value={draft.seo_description ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, seo_description: e.target.value })
                }
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gri-200">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              İptal
            </Button>
            <Button variant="secondary" disabled={saving} onClick={() => void savePost(false)}>
              Taslak kaydet
            </Button>
            <Button variant="primary" disabled={saving} onClick={() => void savePost(true)}>
              Yayınla
            </Button>
          </div>
        </Modal>
      </div>
    </main>
  );
}
