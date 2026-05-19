/**
 * Pim Etiket — /admin/arsiv/[userId]
 *
 * Sefa 18 May v68 (R2 cold storage admin panel):
 * Bir müşterinin R2 arşivindeki tüm dosyalarını listeler. Admin bir
 * dosyaya tıklayınca → modal açılır → "İndirme sebebi" zorunlu →
 * onay sonrası 1 saatlik signed URL açılır + archive_events'e audit log
 * düşer (KVKK m.11/h).
 *
 * Yapı:
 *   - Üstte müşteri özeti (geri linkiyle)
 *   - Kategori gruplaması (Profile / Orders / Designs / Reviews / Returns)
 *   - Her satırda: dosya adı, boyut, son değişiklik, "İndir" butonu
 *   - Modal: dosya bilgisi + reason text + "Aç" / "İptal"
 */

"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import {
  Card,
  Eyebrow,
  Skeleton,
  Button,
  useToast,
  Modal,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import type { ArchiveFileItem } from "@/app/api/admin/archive/files/route";

const CATEGORY_META: Record<
  ArchiveFileItem["category"],
  { label: string; emoji: string }
> = {
  profile: { label: "Profil snapshot", emoji: "👤" },
  order: { label: "Sipariş kayıtları", emoji: "📦" },
  design: { label: "Tasarım dosyaları", emoji: "🎨" },
  review: { label: "Yorumlar", emoji: "⭐" },
  return: { label: "İadeler", emoji: "↩️" },
  other: { label: "Diğer", emoji: "📄" },
};

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
}

export default function ArchiveCustomerDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const toast = useToast();

  const [files, setFiles] = useState<ArchiveFileItem[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const [dryRun, setDryRun] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalFile, setModalFile] = useState<ArchiveFileItem | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/archive/files?userId=${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          toast.error(data.error);
          return;
        }
        setFiles(data.files ?? []);
        setTotalSize(data.total_size_bytes ?? 0);
        setDryRun(data.dry_run ?? false);
      })
      .catch((e) => {
        if (!cancelled) toast.error(`Yükleme hatası: ${e.message}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, toast]);

  async function openSignedUrl() {
    if (!modalFile) return;
    if (!reason.trim()) {
      toast.error("İndirme sebebi zorunlu (KVKK audit için)");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/archive/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          r2Key: modalFile.key,
          reason: reason.trim(),
          ttlSeconds: 3600,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Signed URL alınamadı");
        return;
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
      toast.success("Dosya yeni sekmede açıldı");
      setModalFile(null);
      setReason("");
    } catch (e) {
      toast.error(`Hata: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  // Kategoriye göre gruplama
  const grouped = files.reduce(
    (acc, f) => {
      (acc[f.category] ??= []).push(f);
      return acc;
    },
    {} as Record<ArchiveFileItem["category"], ArchiveFileItem[]>
  );

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-6 md:px-6">
      <Link
        href="/admin/arsiv"
        className="mb-4 inline-flex items-center gap-1 text-[13px] text-gri-700 hover:text-pim-mercan"
      >
        ← Arşiv listesine dön
      </Link>

      <div className="mb-6">
        <Eyebrow>R2 Cold Storage</Eyebrow>
        <h1 className="mt-1 text-2xl font-bold text-lacivert md:text-3xl">
          Müşteri Arşiv Dosyaları
        </h1>
        <p className="mt-1 text-sm text-gri-700">
          User UUID:{" "}
          <code className="rounded bg-gri-100 px-1.5 py-0.5 text-[12px]">
            {userId}
          </code>
        </p>
      </div>

      {/* Özet kutu */}
      <Card className="mb-4 grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
        <div>
          <div className="text-[12px] text-gri-700">Toplam dosya</div>
          <div className="text-2xl font-bold text-lacivert">
            {loading ? <Skeleton className="h-7 w-12" /> : files.length}
          </div>
        </div>
        <div>
          <div className="text-[12px] text-gri-700">Toplam boyut</div>
          <div className="text-2xl font-bold text-lacivert">
            {loading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              formatBytes(totalSize)
            )}
          </div>
        </div>
        <div>
          <div className="text-[12px] text-gri-700">Mod</div>
          <div
            className={cn(
              "text-sm font-medium",
              dryRun ? "text-sari-koyu" : "text-yesil-koyu"
            )}
          >
            {dryRun ? "🧪 DRY_RUN (test)" : "🔥 Canlı R2"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[12px] text-gri-700">Erişim</div>
          <div className="text-sm font-medium text-gri-700">
            Audit log düşer
          </div>
        </div>
      </Card>

      {/* Kategori grupları */}
      {loading ? (
        <Card className="p-6">
          <Skeleton className="h-32 w-full" />
        </Card>
      ) : files.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="mb-2 text-4xl">📭</div>
          <h2 className="text-lg font-semibold text-lacivert">
            Arşivde dosya yok
          </h2>
          <p className="mt-1 text-sm text-gri-700">
            Bu müşteri için R2'de hiçbir dosya bulunamadı. Müşteri henüz
            arşivlenmemiş veya DRY_RUN modunda işaretlenmiş olabilir.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {(Object.keys(grouped) as ArchiveFileItem["category"][]).map(
            (cat) => (
              <Card key={cat}>
                <div className="border-b border-gri-200 px-4 py-3">
                  <h3 className="text-sm font-semibold text-lacivert">
                    {CATEGORY_META[cat].emoji} {CATEGORY_META[cat].label} (
                    {grouped[cat].length})
                  </h3>
                </div>
                <div className="divide-y divide-gri-100">
                  {grouped[cat].map((f) => (
                    <div
                      key={f.key}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-gri-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-lacivert">
                          {f.relative_path}
                        </div>
                        <div className="text-[12px] text-gri-500">
                          {formatBytes(f.size_bytes)} ·{" "}
                          {formatDate(f.last_modified)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setModalFile(f)}
                      >
                        📥 İndir
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            )
          )}
        </div>
      )}

      {/* Modal */}
      {modalFile && (
        <Modal
          open={true}
          onClose={() => {
            setModalFile(null);
            setReason("");
          }}
          title="Arşivden Dosya İndir"
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-gri-50 p-3">
              <div className="text-[12px] text-gri-700">Dosya</div>
              <div className="break-all text-sm font-medium text-lacivert">
                {modalFile.relative_path}
              </div>
              <div className="mt-1 text-[12px] text-gri-500">
                {formatBytes(modalFile.size_bytes)} ·{" "}
                {formatDate(modalFile.last_modified)}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[12.5px] font-medium text-lacivert">
                İndirme sebebi <span className="text-kirmizi">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Örn: Müşteri WhatsApp talebi #1234 — eski sipariş PE-2026-... için tasarım dosyası"
                className="w-full rounded-lg border border-gri-200 px-3 py-2 text-sm focus:border-pim-mercan focus:outline-none focus:ring-2 focus:ring-pim-mercan/20"
              />
              <p className="mt-1 text-[11.5px] text-gri-500">
                KVKK m.11/h gereği bu erişim audit log'a kaydedilir. Sebep
                belirtmek zorunludur.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setModalFile(null);
                  setReason("");
                }}
                disabled={submitting}
              >
                İptal
              </Button>
              <Button
                onClick={openSignedUrl}
                disabled={submitting || !reason.trim()}
              >
                {submitting ? "Hazırlanıyor..." : "Aç (1 saat geçerli)"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
