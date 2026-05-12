"use client";

/**
 * Pim Etiket — /admin/yedekler
 *
 * Cloudflare R2'deki haftalık DR yedeklerin read-only listesi.
 * Restore mekaniği bu sayfada YOK — manuel pg_restore komutuyla
 * yapılır (docs/BACKUP_SETUP.md adım 6). Sayfa sadece:
 *   - Hangi yedekler var (manifest.json bazlı)
 *   - Boyutları + tarihleri
 *   - "Restore tatbikatı" hatırlatması (3 ayda bir)
 *
 * KVKK m.12 veri güvenliği + ISO 27001 best practice.
 */

import { useEffect, useState } from "react";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Card, Eyebrow, Button, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";

interface BackupItem {
  key: string;
  week: string;
  year: string;
  stamp: string;
  size_bytes: number;
  modified_at: string;
}

interface BackupApiResponse {
  backups: BackupItem[];
  configured: boolean;
  message?: string;
  error?: string;
}

function fmtSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export default function AdminYedeklerPage() {
  const [data, setData] = useState<BackupApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/admin/backups", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error ?? `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((json: BackupApiResponse) => setData(json))
      .catch((err) => setError(err.message ?? "Yedek listesi alınamadı"))
      .finally(() => setLoading(false));
  }, []);

  const latest = data?.backups[0];
  const latestDaysAgo = latest ? daysSince(latest.modified_at) : null;

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1080px] px-6">
        <div className="mb-6">
          <Eyebrow>Sistem · Felaket kurtarma</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Yedekler
          </h1>
          <p className="mt-1.5 text-base text-gri-700 leading-relaxed">
            Cloudflare R2&apos;deki haftalık tam yedek arşivi. Supabase Pro
            7-gün backup&apos;ından bağımsız ek katman.{" "}
            <a
              href="https://github.com/sefayakut111-netizen/pimetiket/blob/main/storefront/docs/BACKUP_SETUP.md"
              target="_blank"
              className="text-pim-mercan font-semibold hover:underline"
              rel="noreferrer"
            >
              Kurulum rehberi →
            </a>
          </p>
        </div>

        {/* Configuration warning */}
        {data && !data.configured && (
          <Card padding="p-5" className="mb-5 !bg-sari-soft !ring-sari/30">
            <div className="flex items-start gap-3">
              <Icon.Info size={18} className="text-sari-koyu shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold text-[14.5px] text-sari-koyu mb-1">
                  R2 yedek bağlantısı yapılandırılmamış
                </h2>
                <p className="text-[12.5px] text-gri-700 leading-relaxed">
                  {data.message ??
                    "GitHub Secrets'a R2 credential'larını ekle, ilk backup workflow'unu çalıştır."}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Health check */}
        {latest && latestDaysAgo != null && (
          <Card
            padding="p-5"
            className={cn(
              "mb-5 !ring-1",
              latestDaysAgo > 14
                ? "!bg-kirmizi-soft !ring-kirmizi/30"
                : latestDaysAgo > 9
                  ? "!bg-sari-soft !ring-sari/30"
                  : "!bg-yesil-soft !ring-yesil/30"
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "text-[24px]",
                  latestDaysAgo > 14
                    ? "text-kirmizi"
                    : latestDaysAgo > 9
                      ? "text-sari-koyu"
                      : "text-yesil"
                )}
                aria-hidden="true"
              >
                {latestDaysAgo > 14 ? "⚠️" : latestDaysAgo > 9 ? "⏰" : "✅"}
              </span>
              <div className="flex-1">
                <h2 className="font-semibold text-[14.5px] mb-1">
                  {latestDaysAgo > 14
                    ? "Yedek 14 günden eski — workflow çalışmıyor olabilir"
                    : latestDaysAgo > 9
                      ? "Yedek 9 günden eski — bir tetik kaçırılmış"
                      : "Son yedek taze"}
                </h2>
                <p className="text-[12.5px] text-gri-700 leading-relaxed">
                  Son yedek <strong>{fmtDate(latest.modified_at)}</strong> ·{" "}
                  {latestDaysAgo === 0
                    ? "bugün"
                    : latestDaysAgo === 1
                      ? "dün"
                      : `${latestDaysAgo} gün önce`}
                  . Beklenen: her Pazar.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Backups list */}
        <Card padding="p-0">
          <div className="px-5 py-3 border-b border-gri-100 flex items-center justify-between">
            <h2 className="font-semibold text-base">
              Haftalık yedekler {data && `(${data.backups.length})`}
            </h2>
            <span className="text-[11.5px] text-gri-700">
              R2 lifecycle ile 180 gün sonra otomatik silinir
            </span>
          </div>

          {loading && (
            <div className="p-4">
              <Skeleton.AdminTable rows={4} />
            </div>
          )}

          {!loading && error && (
            <div className="p-8 text-center">
              <div className="text-[14px] text-kirmizi font-semibold mb-2">
                Hata
              </div>
              <p className="text-[12.5px] text-gri-700">{error}</p>
            </div>
          )}

          {!loading && !error && data && data.backups.length === 0 && (
            <div className="p-12 text-center">
              <Pim pose="think" size={120} />
              <h3 className="mt-3 font-semibold text-base">
                Henüz yedek yok
              </h3>
              <p className="mt-2 text-[13px] text-gri-700 max-w-[420px] mx-auto leading-relaxed">
                İlk yedek otomatik olarak gelecek Pazar 03:00 UTC&apos;de
                alınacak. Manuel tetikleme için GitHub → Actions sekmesinden
                workflow&apos;u çalıştırabilirsin.
              </p>
            </div>
          )}

          {!loading && !error && data && data.backups.length > 0 && (
            <ul className="divide-y divide-gri-100">
              {data.backups.map((b, idx) => (
                <li
                  key={b.key}
                  className="px-5 py-3 flex items-center gap-3"
                >
                  <span
                    className={cn(
                      "inline-flex items-center justify-center h-6 px-2 rounded-full text-[10.5px] font-semibold shrink-0 tabular-nums",
                      idx === 0
                        ? "bg-yesil-soft text-yesil"
                        : "bg-gri-100 text-gri-700"
                    )}
                  >
                    {b.year} · W{b.week}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[12.5px] text-lacivert truncate">
                      {b.key}
                    </div>
                    <div className="text-[11.5px] text-gri-700 mt-0.5 tabular-nums">
                      {fmtDate(b.modified_at)} · manifest{" "}
                      {fmtSize(b.size_bytes)}
                    </div>
                  </div>
                  {idx === 0 && (
                    <span className="text-[10.5px] font-semibold text-yesil">
                      EN SON
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Restore guidance */}
        <Card padding="p-5" className="mt-5 !bg-krem-soft !ring-krem">
          <div className="flex gap-3 items-start">
            <Pim pose="inspect" size={64} />
            <div className="flex-1">
              <h3 className="font-semibold text-[14.5px] text-lacivert mb-1.5">
                Restore tatbikatı (3 ayda bir)
              </h3>
              <p className="text-[12.5px] text-gri-700 leading-relaxed mb-3">
                Yedek var demek <strong>kurtarılabilir</strong> demek değil.
                Yılda 4 kez yeni boş bir Supabase projesine bir yedek
                restore et — komut dizisi rehberde adım 6&apos;da.
              </p>
              <Button
                variant="secondary"
                size="sm"
                href="https://github.com/sefayakut111-netizen/pimetiket/blob/main/storefront/docs/BACKUP_SETUP.md#6-restore-tatbikatı-3-ayda-bir-30-dk"
              >
                <Icon.Doc size={14} /> Restore rehberini aç
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
