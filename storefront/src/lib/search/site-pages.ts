import { matchesQuery } from "./strip-diacritics";

export type SiteSearchResult = {
  href: string;
  label: string;
  subtitle?: string;
  group: string;
};

type SitePage = SiteSearchResult & {
  keywords: string[];
  memberOnly?: boolean;
};

const PAGES: SitePage[] = [
  {
    href: "/",
    label: "Anasayfa",
    keywords: ["anasayfa", "home", "pim"],
    group: "Sayfalar",
  },
  {
    href: "/sticker",
    label: "Sticker",
    keywords: ["sticker", "cikartma", "çıkartma", "etiket"],
    group: "Sayfalar",
  },
  {
    href: "/sticker/yapilandir",
    label: "Sticker sipariş ver",
    keywords: ["sticker", "siparis", "yapilandir", "konfigurator"],
    group: "Sayfalar",
  },
  {
    href: "/etiket",
    label: "Etiket",
    keywords: ["etiket", "rulo", "baskı"],
    group: "Sayfalar",
  },
  {
    href: "/etiket/yapilandir",
    label: "Etiket sipariş ver",
    keywords: ["etiket", "siparis", "yapilandir", "konfigurator"],
    group: "Sayfalar",
  },
  {
    href: "/sablonlar",
    label: "Şablonlar",
    keywords: ["sablon", "template", "kesim", "tasarim"],
    group: "Sayfalar",
  },
  {
    href: "/sablonlar?tab=kesim",
    label: "Kesim şablonları",
    keywords: ["kesim", "die cut", "bicak", "pdf"],
    group: "Sayfalar",
  },
  {
    href: "/sablonlar?tab=tasarim",
    label: "Tasarım şablonları",
    keywords: ["tasarim", "ucretsiz", "sablon"],
    group: "Sayfalar",
  },
  {
    href: "/editor",
    label: "Editör",
    keywords: ["editor", "duzenle", "tasarim", "online"],
    group: "Sayfalar",
    memberOnly: true,
  },
  {
    href: "/panelim",
    label: "Panelim",
    keywords: ["panel", "hesap", "dashboard"],
    group: "Hesabım",
    memberOnly: true,
  },
  {
    href: "/siparislerim",
    label: "Siparişlerim",
    keywords: ["siparis", "orders", "takip"],
    group: "Hesabım",
    memberOnly: true,
  },
  {
    href: "/tasarimlarim",
    label: "Tasarımlarım",
    keywords: ["tasarim", "dosya", "yukleme"],
    group: "Hesabım",
    memberOnly: true,
  },
  {
    href: "/blog",
    label: "Blog",
    keywords: ["blog", "yazi", "makale"],
    group: "Sayfalar",
  },
  {
    href: "/sepet",
    label: "Sepet",
    keywords: ["sepet", "cart"],
    group: "Sayfalar",
  },
  {
    href: "/sss",
    label: "SSS",
    keywords: ["sss", "sik sorulan", "yardim", "faq"],
    group: "Destek",
  },
  {
    href: "/destek",
    label: "Destek talebi",
    keywords: ["destek", "yardim", "iletisim"],
    group: "Destek",
  },
  {
    href: "/iletisim",
    label: "İletişim",
    keywords: ["iletisim", "contact", "telefon"],
    group: "Destek",
  },
  {
    href: "/hakkimizda",
    label: "Hakkımızda",
    keywords: ["hakkimizda", "about"],
    group: "Sayfalar",
  },
];

export function searchSitePages(
  query: string,
  opts?: { member?: boolean; limit?: number }
): SiteSearchResult[] {
  const q = query.trim();
  if (q.length < 1) return [];
  const limit = opts?.limit ?? 8;
  const member = opts?.member ?? false;

  return PAGES.filter((p) => {
    if (p.memberOnly && !member) return false;
    return matchesQuery(q, p.label, p.href, ...p.keywords);
  })
    .slice(0, limit)
    .map(({ href, label, subtitle, group }) => ({
      href,
      label,
      subtitle,
      group,
    }));
}
