/**
 * SeoAuditor — 📈 SEO / Performance Denetçisi
 *
 * Haftalık Çarşamba 11:00. Görünürlük + teknik SEO kontrolleri.
 *
 * Kontroller: sitemap (+ malzeme landing URL'leri), blog hacmi, yasal sayfalar,
 * llms.txt, robots (AI retrieval), Search Console env, sitemap ping (Google/Bing).
 *
 * NOT: GSC Performance API (sorgu/tıklama) OAuth gerektirir — ayrı faz.
 */

import { AuditorBase } from "../_shared/base";
import type { AuditorFinding, AuditorRunResult } from "../_shared/types";
import { MATERIAL_SLUGS } from "@/lib/seo/materials";
import { pingAllSearchEngines } from "@/lib/seo/search-engine-ping";
import { fetchGscTopQueries } from "@/lib/seo/gsc-performance";
import { getSiteUrl } from "@/lib/site-url";
import { getSiteImage } from "@/lib/site-images";

const SITE_URL = () => getSiteUrl();

const TUNE = {
  minBlogPosts: 5,
  minSitemapUrls: 35, // statik + malzeme + tür landing + blog + konu
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

    const llms = await this.checkLlmsTxt();
    findings.push(...llms.findings);
    metrics.llms = llms.metrics;

    const robots = await this.checkRobotsAiRetrieval();
    findings.push(...robots.findings);
    metrics.robots = robots.metrics;

    const gsc = this.checkSearchConsoleEnv();
    findings.push(...gsc.findings);
    metrics.searchConsole = gsc.metrics;

    const gscPerf = await this.checkGscPerformance();
    findings.push(...gscPerf.findings);
    metrics.gscPerformance = gscPerf.metrics;

    const ogDefault = await this.checkOgDefault();
    findings.push(...ogDefault.findings);
    metrics.ogDefault = ogDefault.metrics;

    const pwaIcons = await this.checkPwaIcons();
    findings.push(...pwaIcons.findings);
    metrics.pwaIcons = pwaIcons.metrics;

    if (sitemap.metrics.reachable) {
      const ping = await this.pingSearchEngines();
      findings.push(...ping.findings);
      metrics.sitemapPing = ping.metrics;
    }

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
      const missingMaterials = MATERIAL_SLUGS.filter(
        (slug) => !xml.includes(`/malzeme/${slug}`)
      );

      if (urlCount < TUNE.minSitemapUrls) {
        findings.push(
          this.warning(
            "sitemap_low_url_count",
            `Sitemap ${urlCount} URL (beklenen ≥${TUNE.minSitemapUrls})`,
            `SEO deploy eksik olabilir (8 malzeme landing + statik). Search Console'da sitemap yeniden gönder; deploy sonrası otomatik ping çalışır.`,
            { urlCount, minExpected: TUNE.minSitemapUrls }
          )
        );
      } else {
        findings.push(
          this.info(
            "sitemap_ok",
            `Sitemap erişilebilir (${urlCount} URL)`,
            `${SITE_URL()}/sitemap.xml ✓ — ${urlCount} URL listelenmiş.`,
            { urlCount, sizeKB: Math.round(xml.length / 1024) }
          )
        );
      }

      if (missingMaterials.length > 0) {
        findings.push(
          this.warning(
            "sitemap_missing_material_landings",
            `${missingMaterials.length} malzeme URL'si sitemap'te yok`,
            `Eksik slug'lar: ${missingMaterials.join(", ")}. \`/malzeme/[slug]\` deploy edilmeli.`,
            { missing: missingMaterials }
          )
        );
      } else {
        findings.push(
          this.info(
            "sitemap_materials_ok",
            "8 malzeme landing sitemap'te",
            "Programatik SEO sayfaları indeks için hazır.",
            { count: MATERIAL_SLUGS.length }
          )
        );
      }

      return {
        findings,
        metrics: { reachable: true, urlCount, missingMaterials },
      };
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
      .eq("status", "published");

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

  private async checkLlmsTxt() {
    const findings: AuditorFinding[] = [];
    try {
      const res = await fetch(`${SITE_URL()}/llms.txt`, { cache: "no-store" });
      if (!res.ok) {
        findings.push(
          this.warning(
            "llms_txt_missing",
            "llms.txt erişilemiyor",
            `${SITE_URL()}/llms.txt HTTP ${res.status} — AI arama özet rehberi yok.`,
            { status: res.status }
          )
        );
        return { findings, metrics: { ok: false } };
      }
      const body = await res.text();
      const hasPim = body.includes("Pim Etiket");
      findings.push(
        this.info(
          "llms_txt_ok",
          "llms.txt erişilebilir",
          hasPim
            ? "AI özet rehberi canlı."
            : "Dosya var ama marka başlığı eksik — içeriği kontrol et.",
          { bytes: body.length }
        )
      );
      return { findings, metrics: { ok: true, bytes: body.length } };
    } catch (err) {
      findings.push(
        this.warning(
          "llms_txt_fetch_failed",
          "llms.txt fetch başarısız",
          err instanceof Error ? err.message : String(err),
          {}
        )
      );
      return { findings, metrics: { ok: false } };
    }
  }

  private async checkRobotsAiRetrieval() {
    const findings: AuditorFinding[] = [];
    try {
      const res = await fetch(`${SITE_URL()}/robots.txt`, { cache: "no-store" });
      if (!res.ok) {
        findings.push(
          this.warning(
            "robots_unreachable",
            "robots.txt erişilemiyor",
            `HTTP ${res.status}`,
            { status: res.status }
          )
        );
        return { findings, metrics: { ok: false } };
      }
      const text = await res.text();
      const perplexityOpen =
        /User-agent:\s*PerplexityBot[\s\S]*?Allow:\s*\//i.test(text);
      const gptbotBlocked =
        /User-agent:\s*GPTBot[\s\S]*?Disallow:\s*\//i.test(text);

      if (!perplexityOpen) {
        findings.push(
          this.warning(
            "robots_ai_retrieval_closed",
            "AI retrieval botları kapalı görünüyor",
            "PerplexityBot için Allow: / yok — SEO Faz 1 deploy kontrol et.",
            {}
          )
        );
      } else if (!gptbotBlocked) {
        findings.push(
          this.warning(
            "robots_training_open",
            "GPTBot engeli eksik",
            "Eğitim botu GPTBot disallow: / olmalı.",
            {}
          )
        );
      } else {
        findings.push(
          this.info(
            "robots_ai_policy_ok",
            "robots.txt AI politikası uygun",
            "Retrieval botları açık, GPTBot (training) kapalı.",
            {}
          )
        );
      }
      return { findings, metrics: { perplexityOpen, gptbotBlocked } };
    } catch (err) {
      findings.push(
        this.warning(
          "robots_fetch_failed",
          "robots.txt fetch başarısız",
          err instanceof Error ? err.message : String(err),
          {}
        )
      );
      return { findings, metrics: { ok: false } };
    }
  }

  private checkSearchConsoleEnv() {
    const findings: AuditorFinding[] = [];
    const token = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
    if (!token) {
      findings.push(
        this.warning(
          "gsc_verification_env_missing",
          "Search Console doğrulama env yok",
          "Vercel'de `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` tanımlı değil (canlıda meta tag varsa eski deploy'dan kalıyor olabilir).",
          {}
        )
      );
      return { findings, metrics: { configured: false } };
    }
    findings.push(
      this.info(
        "gsc_verification_env_ok",
        "Search Console doğrulama env tanımlı",
        "google-site-verification meta tag build'de üretilir.",
        { tokenLength: token.length }
      )
    );
    return { findings, metrics: { configured: true } };
  }

  private async checkGscPerformance() {
    const findings: AuditorFinding[] = [];
    const result = await fetchGscTopQueries(28);
    if (!result.configured) {
      findings.push(
        this.info(
          "gsc_performance_skipped",
          "GSC Performance API yapılandırılmamış",
          result.detail,
          {}
        )
      );
      return { findings, metrics: { configured: false } };
    }
    if (!result.ok) {
      findings.push(
        this.warning(
          "gsc_performance_error",
          "GSC sorgu verisi alınamadı",
          result.detail,
          {}
        )
      );
      return { findings, metrics: { configured: true, ok: false } };
    }
    const top = result.rows.slice(0, 3).map((r) => r.query).join(", ");
    findings.push(
      this.info(
        "gsc_performance_ok",
        `GSC Performance: ${result.rows.length} sorgu`,
        top ? `Örnek sorgular: ${top}` : result.detail,
        { rowCount: result.rows.length }
      )
    );
    return {
      findings,
      metrics: { configured: true, ok: true, rowCount: result.rows.length },
    };
  }

  private async checkOgDefault() {
    const findings: AuditorFinding[] = [];
    try {
      const og = await getSiteImage("og_default");
      if (og?.publicUrl) {
        findings.push(
          this.info(
            "og_default_ok",
            "og_default görseli yüklü",
            "Anasayfa Open Graph admin panelinden özelleştirilmiş.",
            { url: og.publicUrl }
          )
        );
        return { findings, metrics: { configured: true } };
      }
      findings.push(
        this.warning(
          "og_default_missing",
          "og_default görseli yok",
          "Dinamik `opengraph-image.tsx` fallback kullanılıyor. `/admin/gorseller` → og_default slot yükleyin.",
          {}
        )
      );
      return { findings, metrics: { configured: false } };
    } catch (err) {
      findings.push(
        this.warning(
          "og_default_check_failed",
          "og_default kontrolü başarısız",
          err instanceof Error ? err.message : String(err),
          {}
        )
      );
      return { findings, metrics: { configured: false } };
    }
  }

  private async checkPwaIcons() {
    const findings: AuditorFinding[] = [];
    const baseUrl = SITE_URL();
    const paths = ["/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/favicon.ico"];
    const results: Array<{ path: string; ok: boolean; status: number }> = [];

    for (const path of paths) {
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
          "pwa_icons_missing",
          `${broken.length} PWA/favicon dosyası erişilemiyor`,
          `Eksik: ${broken.map((b) => b.path).join(", ")}. \`node scripts/generate-icons.mjs\` çalıştırın.`,
          { broken }
        )
      );
    } else {
      findings.push(
        this.info(
          "pwa_icons_ok",
          "PWA ikonları erişilebilir",
          "favicon.ico, apple-touch-icon, icon-192/512 ✓",
          { count: paths.length }
        )
      );
    }
    return { findings, metrics: { total: paths.length, broken: broken.length } };
  }

  private async pingSearchEngines() {
    const findings: AuditorFinding[] = [];
    if (process.env.SEO_SKIP_SITEMAP_PING === "1") {
      return { findings, metrics: { skipped: true } };
    }
    const results = await pingAllSearchEngines();
    for (const r of results) {
      const deprecated = r.status === 404 || r.status === 410;
      if (r.ok) {
        findings.push(
          this.info(
            `sitemap_ping_${r.engine}`,
            `${r.engine} sitemap ping ✓`,
            `HTTP ${r.status} — ${r.detail.slice(0, 80)}`,
            { status: r.status }
          )
        );
      } else if (deprecated) {
        findings.push(
          this.info(
            `sitemap_ping_${r.engine}_deprecated`,
            `${r.engine} legacy ping kapalı (HTTP ${r.status})`,
            "Google/Bing ping endpoint'leri kaldırıldı. Search Console → Sitemaps → `sitemap.xml` manuel gönder / yenile.",
            { status: r.status }
          )
        );
      } else {
        findings.push(
          this.warning(
            `sitemap_ping_${r.engine}_failed`,
            `${r.engine} sitemap ping başarısız`,
            `HTTP ${r.status} — ${r.detail}`,
            { status: r.status }
          )
        );
      }
    }
    return { findings, metrics: { results } };
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
