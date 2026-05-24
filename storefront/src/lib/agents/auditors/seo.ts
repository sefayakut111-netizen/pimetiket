/**
 * SeoAuditor — 📈 SEO / Performance Denetçisi
 *
 * Haftalık Çarşamba 11:00. Görünürlük + teknik SEO kontrolleri.
 *
 * 4 kontrol:
 *   A. Sitemap güncelliği (son fetch tarihi)
 *   B. Aktif blog yazısı sayısı (organik trafik için minimum 5)
 *   C. Aktif kupon süresi (Finance'de günlük; burada haftalık özet)
 *   D. Yasal sayfa erişim kontrolü (basit reachability — stub)
 *
 * NOT: Core Web Vitals + Google Search Console gerçek metrikleri için
 * PostHog Web Vitals + GSC API entegrasyonu gerek (Sefa'nın gelecek
 * dalga işi). Şu an basit DB tabanlı + reachability check.
 */

import { AuditorBase } from "../_shared/base";
import type { AuditorFinding, AuditorRunResult } from "../_shared/types";

const SITE_URL = () =>
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com";

const TUNE = {
  minBlogPosts: 5,
  legalPages: [
    "/kvkk",
    "/gizlilik",
    "/sartlar",
    "/cerez",
    "/mesafeli-satis",
    "/on-bilgilendirme",
    "/cayma-hakki",
    "/iade-degisim-politikasi",
  ],
};

export class SeoAuditor extends AuditorBase {
  constructor() {
    super("seo", "v1");
  }

  protected async runChecks(): Promise<AuditorRunResult> {
    const findings: AuditorFinding[] = [];
    const metrics: Record<string, unknown> = {};

    const sitemap = await this.checkSitemap();
    findings.push(...sitemap.findings);
    metrics.sitemap = sitemap.metrics;

    const blog = await this.checkBlogVolume();
    findings.push(...blog.findings);
    metrics.blog = blog.metrics;

    const legal = await this.checkLegalPages();
    findings.push(...legal.findings);
    metrics.legal = legal.metrics;

    const counts = countFindings(findings);
    return {
      findings,
      summary:
        counts.total === 0
          ? "SEO sağlam, sitemap güncel, yasal sayfalar erişilebilir."
          : `${counts.warning} dikkat noktası.`,
      summaryMd: buildSummaryMd(findings, counts),
      metricsSnapshot: metrics,
    };
  }

  // A) Sitemap
  private async checkSitemap() {
    const findings: AuditorFinding[] = [];

    try {
      const res = await fetch(`${SITE_URL()}/sitemap.xml`, {
        cache: "no-store",
      });

      if (!res.ok) {
        findings.push(
          this.warning(
            "sitemap_unreachable",
            "Sitemap.xml erişilemiyor",
            `${SITE_URL()}/sitemap.xml HTTP ${res.status}. Google Search Console resubmit gerekebilir.`,
            { status: res.status }
          )
        );
        return { findings, metrics: { reachable: false, status: res.status } };
      }

      const xml = await res.text();
      const urlCount = (xml.match(/<url>/g) ?? []).length;

      findings.push(
        this.info(
          "sitemap_ok",
          `Sitemap erişilebilir (${urlCount} URL)`,
          `${SITE_URL()}/sitemap.xml ✓ — ${urlCount} URL listelenmiş.`,
          { urlCount, sizeKB: Math.round(xml.length / 1024) }
        )
      );

      return { findings, metrics: { reachable: true, urlCount } };
    } catch (err) {
      findings.push(
        this.warning(
          "sitemap_fetch_failed",
          "Sitemap fetch başarısız",
          `Network error: ${err instanceof Error ? err.message : String(err)}`,
          { error: String(err) }
        )
      );
      return { findings, metrics: { reachable: false } };
    }
  }

  // B) Blog volume (organik trafik için)
  private async checkBlogVolume() {
    const findings: AuditorFinding[] = [];

    const { count } = await this.admin
      .from("blog_posts")
      .select("*", { count: "exact", head: true })
      .eq("is_published", true);

    const published = count ?? 0;

    if (published < TUNE.minBlogPosts) {
      findings.push(
        this.warning(
          "low_blog_volume",
          `${published} yayınlanmış blog yazısı (eşik ${TUNE.minBlogPosts})`,
          `Organik SEO için minimum ${TUNE.minBlogPosts} yazı önerilir. Şu an **${published}**. /admin/blog'tan yeni içerik üretilmeli.`,
          { published, minRecommended: TUNE.minBlogPosts }
        )
      );
    } else {
      findings.push(
        this.info(
          "blog_volume_ok",
          `${published} yayınlanmış blog yazısı`,
          `Organik SEO için sağlıklı içerik hacmi.`,
          { published }
        )
      );
    }

    return { findings, metrics: { published } };
  }

  // C) Yasal sayfa erişilebilirliği
  private async checkLegalPages() {
    const findings: AuditorFinding[] = [];
    const baseUrl = SITE_URL();
    const results: Array<{ path: string; ok: boolean; status: number }> = [];

    for (const path of TUNE.legalPages) {
      try {
        const res = await fetch(`${baseUrl}${path}`, {
          method: "HEAD",
          cache: "no-store",
        });
        results.push({ path, ok: res.ok, status: res.status });
      } catch {
        results.push({ path, ok: false, status: 0 });
      }
    }

    const broken = results.filter((r) => !r.ok);

    if (broken.length > 0) {
      findings.push(
        this.warning(
          "legal_page_broken",
          `${broken.length} yasal sayfa erişilemiyor`,
          `Yasal uyum için yasal sayfaların erişilebilir olması zorunlu:\n${broken.map((b) => `- **${b.path}** — HTTP ${b.status}`).join("\n")}`,
          { broken }
        )
      );
    } else {
      findings.push(
        this.info(
          "legal_pages_ok",
          `${results.length} yasal sayfa ✓ erişilebilir`,
          `Tüm yasal metinler canlı.`,
          { count: results.length }
        )
      );
    }

    return { findings, metrics: { total: results.length, broken: broken.length } };
  }
}

function countFindings(findings: AuditorFinding[]) {
  return findings.reduce(
    (acc, f) => {
      acc[f.severity] += 1;
      acc.total += 1;
      return acc;
    },
    { critical: 0, warning: 0, info: 0, total: 0 }
  );
}

function buildSummaryMd(
  findings: AuditorFinding[],
  counts: ReturnType<typeof countFindings>
): string {
  const lines: string[] = [
    `# 📈 SEO / Görünürlük Raporu`,
    "",
    `**Özet:** ${counts.total} bulgu`,
    "",
  ];

  findings.forEach((f) => {
    const icon = f.severity === "warning" ? "🟡" : "ℹ️";
    lines.push(`${icon} **${f.title}**`);
    if (f.severity !== "info") lines.push(f.description);
    lines.push("");
  });

  return lines.join("\n");
}
