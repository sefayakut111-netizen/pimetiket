"use client";

/**
 * Pim Etiket — /admin/blog
 * Blog yazıları CRUD (blog_posts tablosu).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
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
import { slugifyTitle, calculateReadMinutes } from "@/lib/blog-slug";
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

function postReadMinutes(post: BlogPostRow): number {
  return post.read_minutes ?? calculateReadMinutes(post.body_tr);
}

export function BlogTab() {
  const toast = useToast();
  const [posts, setPosts] = useState<BlogPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BlogPostRow | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<BlogPostRow | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const uploadCover = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Kapak görseli en fazla 5 MB olabilir");
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("JPG, PNG veya WebP yükleyin");
      return;
    }

    setCoverUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const sigRes = await fetch("/api/admin/blog/upload-cover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ extension: ext }),
      });
      const sigJson = (await sigRes.json()) as {
        error?: string;
        uploadUrl?: string;
        publicUrl?: string;
      };
      if (!sigRes.ok || !sigJson.uploadUrl || !sigJson.publicUrl) {
        toast.error(sigJson.error ?? "Upload URL alınamadı");
        return;
      }

      const putRes = await fetch(sigJson.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "content-type": file.type },
      });
      if (!putRes.ok) {
        toast.error("Dosya yüklenemedi");
        return;
      }

      setDraft((d) => ({ ...d, cover_image_url: sigJson.publicUrl! }));
      toast.success("Kapak görseli yüklendi");
    } catch {
      toast.error("Yükleme hatası");
    } finally {
      setCoverUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
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
        cover_image_url: draft.cover_image_url?.trim() || null,
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
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/blog?id=${encodeURIComponent(post.id)}`,
        { method: "DELETE" }
      );
      const json = (await res.json()) as { ok?: boolean };
      if (!json.ok) {
        toast.error("Silinemedi");
        return;
      }
      toast.info("Silindi");
      setDeleteTarget(null);
      await refresh();
    } finally {
      setDeleting(false);
    }
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
                  <th className="px-4 py-3 font-semibold">SEO</th>
                  <th className="px-4 py-3 font-semibold">OG</th>
                  <th className="px-4 py-3 font-semibold">Okuma</th>
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
                    <td className="px-4 py-3 text-xs text-gri-500 max-w-[180px]">
                      {p.seo_description?.trim() ? (
                        <span className="text-yesil font-semibold" title={p.seo_description}>
                          SEO tamam
                          <span className="block text-gri-600 font-normal truncate mt-0.5">
                            {p.seo_description.slice(0, 60)}
                            {p.seo_description.length > 60 ? "…" : ""}
                          </span>
                        </span>
                      ) : (
                        <span className="text-kirmizi font-semibold">SEO eksik</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gri-500">
                      {p.cover_image_url ? (
                        <img
                          src={p.cover_image_url}
                          alt=""
                          className="w-8 h-8 rounded object-cover ring-1 ring-gri-200"
                        />
                      ) : (
                        <span className="text-gri-500">Görsel yok</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gri-600 tabular-nums">
                      {postReadMinutes(p)} dk
                    </td>
                    <td className="px-4 py-3 text-gri-700 tabular-nums">
                      {formatDate(p.published_at ?? p.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                        Düzenle
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(p)}>
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
            </div>
            <div className="block">
              <span className="text-[13px] font-semibold mb-2 block">Kapak görseli</span>
              <div className="flex flex-wrap items-start gap-4">
                {draft.cover_image_url ? (
                  <div className="relative w-full max-w-[280px] aspect-[16/9] rounded-xl overflow-hidden ring-1 ring-gri-200">
                    <Image
                      src={draft.cover_image_url}
                      alt={draft.title_tr?.trim() || "Kapak önizleme"}
                      fill
                      className="object-cover"
                      sizes="280px"
                    />
                  </div>
                ) : (
                  <div className="w-full max-w-[280px] aspect-[16/9] rounded-xl bg-gri-100 ring-1 ring-gri-200 grid place-items-center text-[12px] text-gri-500">
                    Kapak seçilmedi (opsiyonel)
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadCover(file);
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={coverUploading}
                    onClick={() => coverInputRef.current?.click()}
                  >
                    {coverUploading ? "Yükleniyor…" : "Dosya seç"}
                  </Button>
                  {draft.cover_image_url ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDraft({ ...draft, cover_image_url: "" })}
                    >
                      Kapağı kaldır
                    </Button>
                  ) : null}
                </div>
              </div>
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

        <Modal
          open={deleteTarget != null}
          onClose={() => setDeleteTarget(null)}
          title="Yazıyı sil"
          maxWidthClassName="max-w-md"
        >
          <p className="text-[13px] text-gri-700 leading-relaxed">
            &quot;{deleteTarget?.title_tr}&quot; yazısını silmek istediğinizden
            emin misiniz? Bu işlem geri alınamaz.
          </p>
          <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gri-200">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              İptal
            </Button>
            <Button
              variant="primary"
              disabled={deleting || !deleteTarget}
              className="!bg-kirmizi hover:!bg-kirmizi/90"
              onClick={() => deleteTarget && void removePost(deleteTarget)}
            >
              {deleting ? "Siliniyor…" : "Sil"}
            </Button>
          </div>
        </Modal>
      </div>
    </main>
  );
}
