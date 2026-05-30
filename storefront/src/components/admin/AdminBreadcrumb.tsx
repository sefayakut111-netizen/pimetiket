/**
 * AdminBreadcrumb — Tüm admin sayfaları için tutarlı breadcrumb.
 *
 * Sefa 18 May v68 (admin UX denetim):
 * Mevcut breadcrumb sadece bazı sayfalarda (Manuel sipariş gibi).
 * Bu component AdminShell'in üstüne otomatik takılır, pathname'i
 * parse edip breadcrumb satırı üretir.
 *
 * Path → label çevirisi:
 *   /admin → "Dashboard"
 *   /admin/siparisler → "Dashboard > Siparişler"
 *   /admin/musteriler/abc-123 → "Dashboard > Müşteriler > abc-123…"
 *   /admin/kargo/PE-2026 → "Dashboard > Kargo > PE-2026"
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminPathLabels } from "@/hooks/useAdminPathLabel";

const SEGMENT_LABELS: Record<string, string> = {
  admin: "Dashboard",
  siparisler: "Siparişler",
  "siparis-ekle": "Manuel sipariş",
  musteriler: "Müşteriler",
  yorumlar: "Yorumlar",
  iadeler: "İadeler",
  tasarimlar: "Tasarımlar",
  "ai-qc": "AI QC",
  prova: "Prova",
  fason: "Üretim Partnerleri",
  kargo: "Kargo",
  aboneler: "Aboneler",
  galeri: "Galeri",
  gorseller: "Site Görselleri",
  finans: "Finans",
  kuponlar: "Kuponlar",
  calisanlar: "Çalışanlar",
  "fiyat-hesapla": "Fiyat hesapla",
  "fiyat-hesapla-etiket": "Fiyat hesapla — etiket",
  "fiyat-hesapla-tabaka": "Fiyat hesapla — tabaka",
  denetciler: "Denetçiler",
  raporlar: "Finans & Raporlar",
  icerik: "İçerik",
  "audit-log": "Denetim kaydı",
  "kvkk-talepleri": "KVKK talepleri",
  yedekler: "Yedekler",
  arsiv: "Arşiv (R2)",
  "test-siparis-simulator": "Sipariş simülatörü",
  fiyatlar: "Fiyat yönetimi",
  ayarlar: "Ayarlar",
  profil: "Profilim & 2FA",
  bekleyen: "Bekleyen",
  ertelenenler: "Ertelenenler",
  gecmis: "Geçmiş",
  blog: "Blog",
};

function labelFor(
  segment: string,
  dynamicLabels: Record<string, string>
): string {
  if (dynamicLabels[segment]) return dynamicLabels[segment];
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  // UUID kısalt
  if (
    segment.length > 12 &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}/.test(segment)
  ) {
    return `${segment.slice(0, 8)}…`;
  }
  // PE-2026-XXXX sipariş id
  if (/^PE-\d{4}/i.test(segment)) {
    return segment;
  }
  return segment;
}

export function AdminBreadcrumb() {
  const pathname = usePathname();
  const dynamicLabels = useAdminPathLabels()?.labels ?? {};

  // /admin/foo/bar → ["admin", "foo", "bar"]
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0 || segments[0] !== "admin") return null;

  // Path zincirini kur (/admin, /admin/foo, /admin/foo/bar)
  const crumbs = segments.map((seg, i) => ({
    href: "/" + segments.slice(0, i + 1).join("/"),
    label: labelFor(seg, dynamicLabels),
    isLast: i === segments.length - 1,
  }));

  // Dashboard root sayfasındayız → gizle
  if (crumbs.length === 1) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-3 flex flex-wrap items-center gap-1.5 text-[12px] text-gri-700"
    >
      {crumbs.map((c, i) => (
        <span key={c.href} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-gri-400">›</span>}
          {c.isLast ? (
            <span className="font-semibold text-lacivert">{c.label}</span>
          ) : (
            <Link
              href={c.href}
              className="hover:text-pim-mercan transition-colors"
            >
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
