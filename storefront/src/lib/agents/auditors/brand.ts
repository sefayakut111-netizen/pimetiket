/**
 * BrandAuditor — 🎨 Marka Tutarlılık Denetçisi
 *
 * Haftalık Cuma 14:00. Yazı/dil/marka tutarlılığı kontrolü.
 *
 * 3 kontrol:
 *   A. i18n parity (TR vs EN anahtarlar tutarlı mı)
 *   B. Yazım tutarsızlığı tespiti (yasak/önerilen kelimeler)
 *   C. Maskot kullanımı (info — Sefa manuel)
 *
 * NOT: Build-time statik kod analizi yapamayız (auditor runtime'da DB
 * çalışır). Bu yüzden çoğu kontrol "info" — gerçek statik analiz için
 * GitHub Actions / pre-commit hook gerekli (Sefa'nın gelecek dalga işi).
 */

import { AuditorBase } from "../_shared/base";
import type { AuditorFinding, AuditorRunResult } from "../_shared/types";

// Sefa marka kararı — bu kelimeler kullanılmamalı
const DISCOURAGED_PHRASES = [
  "Lütfen tıklayınız",
  "Aşağıda yer almaktadır",
  "buyurunuz",
  "mevcuttur",
  "tarafınıza",
];

const ENCOURAGED_TONE = ["sen", "bastır", "hadi"];

export class BrandAuditor extends AuditorBase {
  constructor() {
    super("brand", "v1");
  }

  protected async runChecks(): Promise<AuditorRunResult> {
    const findings: AuditorFinding[] = [];
    const metrics: Record<string, unknown> = {};

    // Blog yazılarındaki yazım kontrol
    const blogTone = await this.checkBlogTone();
    findings.push(...blogTone.findings);
    metrics.blogTone = blogTone.metrics;

    // i18n TR/EN parity kontrolü
    const i18nParity = await this.checkI18nParity();
    findings.push(...i18nParity.findings);
    metrics.i18nParity = i18nParity.metrics;

    findings.push(
      this.info(
        "brand_guide_reminder",
        `Marka rehberi hatırlatması`,
        `Pim Etiket tonu: "sen" hitabı, samimi-profesyonel denge, resmi/robotik dilden uzak. Yeni içerikleri bu rehbere göre üret:\n- ✓ "Etiketini bastıralım"\n- ✗ "Etiketinizin baskısı için talebinizi iletiniz"`,
        { encouraged: ENCOURAGED_TONE, discouraged: DISCOURAGED_PHRASES }
      )
    );

    const counts = countFindings(findings);
    return {
      findings,
      summary:
        counts.warning === 0
          ? "Marka tonu tutarlı."
          : `${counts.warning} ton uyarısı.`,
      summaryMd: buildSummaryMd(findings, counts),
      metricsSnapshot: metrics,
    };
  }

  // A) Blog ton kontrolü
  private async checkBlogTone() {
    const findings: AuditorFinding[] = [];

    const { data } = await this.admin
      .from("blog_posts")
      .select("id, slug, title, body_md")
      .eq("is_published", true)
      .limit(50);

    const posts = (data ?? []) as Array<{
      id: string;
      slug: string;
      title: string;
      body_md: string | null;
    }>;

    if (posts.length === 0) return { findings, metrics: { checked: 0 } };

    const issues: Array<{ slug: string; phrase: string; title: string }> = [];

    for (const post of posts) {
      const content = `${post.title}\n${post.body_md ?? ""}`;
      for (const phrase of DISCOURAGED_PHRASES) {
        if (content.includes(phrase)) {
          issues.push({ slug: post.slug, phrase, title: post.title });
        }
      }
    }

    if (issues.length === 0) {
      findings.push(
        this.info(
          "blog_tone_ok",
          `${posts.length} blog yazısı ton kontrolünden geçti`,
          `Resmi/robotik kalıplara rastlanmadı.`,
          { checked: posts.length }
        )
      );
    } else {
      findings.push(
        this.warning(
          "blog_tone_issues",
          `${issues.length} blog yazısında ton uyarısı`,
          `Aşağıdaki yazılarda Pim marka tonu dışına çıkan kalıplar bulundu:\n${issues
            .slice(0, 10)
            .map(
              (i) => `- **${i.title}** (/${i.slug}) — yasak kalıp: "${i.phrase}"`
            )
            .join("\n")}`,
          { issues }
        )
      );
    }

    return {
      findings,
      metrics: { checked: posts.length, issues: issues.length },
    };
  }

  // i18n TR/EN parity — translation dosyalarında eksik key tespiti
  // Note: bu agent run-time'da çalışır, build artifact'lerine bakar.
  // Static analysis için ESLint pre-commit hook daha sağlıklı, ama bu
  // canlı sistemde "Sefa eklediği TR key'i EN'e çevirmedi mi" tespiti yapar.
  private async checkI18nParity() {
    const findings: AuditorFinding[] = [];

    try {
      // Dynamic import — runtime'da locale dosyalarını oku
      const { tr } = await import("@/lib/i18n/translations/tr");
      const { en } = await import("@/lib/i18n/translations/en");

      const flattenKeys = (
        obj: Record<string, unknown>,
        prefix = ""
      ): string[] => {
        const keys: string[] = [];
        for (const [k, v] of Object.entries(obj)) {
          const full = prefix ? `${prefix}.${k}` : k;
          if (v && typeof v === "object" && !Array.isArray(v)) {
            keys.push(...flattenKeys(v as Record<string, unknown>, full));
          } else {
            keys.push(full);
          }
        }
        return keys;
      };

      const trKeys = new Set(flattenKeys(tr as Record<string, unknown>));
      const enKeys = new Set(flattenKeys(en as Record<string, unknown>));

      const onlyInTr = [...trKeys].filter((k) => !enKeys.has(k));
      const onlyInEn = [...enKeys].filter((k) => !trKeys.has(k));

      if (onlyInTr.length > 0 || onlyInEn.length > 0) {
        findings.push(
          this.warning(
            "i18n_parity",
            `i18n eksik: TR-only ${onlyInTr.length} / EN-only ${onlyInEn.length}`,
            `İki dil arasında **${onlyInTr.length + onlyInEn.length}** key uyumsuzluğu:\n${onlyInTr.length > 0 ? `\nTR'de var, EN'de yok:\n${onlyInTr.slice(0, 10).map((k) => `- ${k}`).join("\n")}` : ""}${onlyInEn.length > 0 ? `\n\nEN'de var, TR'de yok:\n${onlyInEn.slice(0, 10).map((k) => `- ${k}`).join("\n")}` : ""}`,
            {
              onlyInTr: onlyInTr.slice(0, 50),
              onlyInEn: onlyInEn.slice(0, 50),
              trCount: trKeys.size,
              enCount: enKeys.size,
            }
          )
        );
      } else {
        findings.push(
          this.info(
            "i18n_parity_ok",
            `i18n TR/EN tutarlı (${trKeys.size} key)`,
            `Translation parity ✓`,
            { count: trKeys.size }
          )
        );
      }

      return {
        findings,
        metrics: {
          trKeys: trKeys.size,
          enKeys: enKeys.size,
          missing: onlyInTr.length + onlyInEn.length,
        },
      };
    } catch (err) {
      // Build artifact'leri runtime'da erişilemiyorsa skip
      return {
        findings,
        metrics: {
          skipped: true,
          error: err instanceof Error ? err.message : String(err),
        },
      };
    }
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
    `# 🎨 Marka Tutarlılık Raporu`,
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
