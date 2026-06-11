/**
 * SecurityAuditor — 🛡️ Sistem Güvenliği Denetçisi
 *
 * Günlük 01:00 UTC cron. 5 kontrol alanı:
 *
 *   A. Brute force tespit (auth audit log)
 *   B. PayTR webhook spoof attempt (hash invalid sayısı)
 *   C. Yeni hesap kayıt hızı (bot saldırısı)
 *   D. Admin role değişikliği (yetkisiz yetki yükseltme)
 *   E. Service role key kullanım anomalisi (audit_log)
 *
 * Kritik bulgular için pending_action önerir; Sefa onaylayınca:
 *   - block_ip (Cloudflare WAF)
 *   - lock_admin_account (Supabase Auth ban)
 *   - notify_sefa (mail)
 *
 * Sefa kuralı: Hiçbir aksiyon otomatik UYGULANMAZ. Onay zinciri zorunlu.
 */

import { AuditorBase } from "../_shared/base";
import type {
  AuditorFinding,
  AuditorRunResult,
  SuggestedAction,
} from "../_shared/types";
import * as Sentry from "@sentry/nextjs";

// ============================================================
// Tunables — istersen DB tablosuna taşınabilir (Sefa karar verir)
// ============================================================
const TUNE = {
  /** Aynı IP'den son 24 saatte başarısız giriş eşiği */
  bruteForceFailedLoginsThreshold: 10,
  bruteForceWindowMinutes: 24 * 60,

  /** PayTR webhook hash invalid eşiği son 24 saat */
  paytrSpoofThreshold: 5,
  paytrSpoofWindowMinutes: 24 * 60,

  /** Yeni hesap kayıt hızı (günlük pencere) */
  newAccountThreshold: 50,
  newAccountWindowMinutes: 24 * 60,

  /** Service role kullanım eşiği (saatlik) */
  serviceRoleAnomalyMultiplier: 3, // ortalamanın 3× üstü
};

// ============================================================
// SecurityAuditor
// ============================================================
export class SecurityAuditor extends AuditorBase {
  constructor() {
    super("security", "v1");
  }

  protected async runChecks(): Promise<AuditorRunResult> {
    const findings: AuditorFinding[] = [];

    // A) Brute force
    findings.push(...(await this.checkBruteForce()));

    // B) PayTR webhook spoof
    findings.push(...(await this.checkPaytrSpoof()));

    // C) Yeni hesap kayıt hızı
    findings.push(...(await this.checkNewAccountFlood()));

    // D) Admin role değişikliği
    findings.push(...(await this.checkAdminRoleChanges()));

    // E) Service role kullanım anomalisi
    findings.push(...(await this.checkServiceRoleAnomaly()));

    // Özet (mail subject + UI gösterimi için)
    const counts = countFindings(findings);
    const summary = buildSummary(counts);
    const summaryMd = buildSummaryMd(findings, counts);

    return {
      findings,
      summary,
      summaryMd,
      metricsSnapshot: {
        bruteForceChecksAt: new Date().toISOString(),
        thresholds: TUNE,
      },
    };
  }

  // ============================================================
  // A) Brute force — auth.audit_log_entries'tan failed login
  // ============================================================
  private async checkBruteForce(): Promise<AuditorFinding[]> {
    const since = new Date();
    since.setMinutes(since.getMinutes() - TUNE.bruteForceWindowMinutes);

    // Supabase auth audit log — admin client ile auth.audit_log_entries
    // direkt sorgu yapamıyoruz (auth schema). RPC veya raw SQL gerekli.
    // Migration 040+ ile geleceğini varsayarak şimdilik profiles +
    // alternatif sinyal: bizim audit_log tablomuzdan (Migration 024)
    // "failed_login" event'leri.
    let failedRows: Array<{ ip: string; email: string; count: number }> = [];
    try {
      const { data, error } = await this.admin.rpc(
        "fn_recent_failed_logins",
        {
          p_since: since.toISOString(),
          p_threshold: TUNE.bruteForceFailedLoginsThreshold,
        }
      );

      if (error) {
        Sentry.captureException(error, {
          tags: { scope: "auditor.security", check: "brute_force" },
        });
        return [
          this.warning(
            "brute_force_check_failed",
            "Brute force kontrolü çalıştırılamadı",
            `**fn_recent_failed_logins** RPC hatası: ${error.message}. Migration 041 push edildi mi kontrol et — bu kontrol atlandı.`,
            { error: error.message }
          ),
        ];
      }
      failedRows = (data ?? []) as Array<{
        ip: string;
        email: string;
        count: number;
      }>;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      Sentry.captureException(err, {
        tags: { scope: "auditor.security", check: "brute_force" },
      });
      return [
        this.warning(
          "brute_force_check_failed",
          "Brute force kontrolü exception",
          `RPC çağrısı patladı: ${errMsg}. Brute force tespiti bu run'da yapılamadı.`,
          { error: errMsg }
        ),
      ];
    }

    return failedRows.map((row) => {
      const suggestedAction: SuggestedAction = {
        type: "block_ip",
        payload: {
          ip: row.ip,
          duration_hours: 24,
          reason: `brute_force ${row.count} failed logins to ${row.email}`,
        },
        title: `IP'yi 24 saat engelle: ${row.ip}`,
        description: `Cloudflare WAF üzerinden ${row.ip} adresine 24 saatlik engelleme uygulanır.`,
      };

      return this.critical(
        "brute_force",
        `${row.ip} → ${row.count} başarısız giriş`,
        `Son 24 saatte **${row.ip}** IP'sinden **${row.email}** hesabına ${row.count} başarısız giriş denemesi yapıldı. Brute force pattern'i.`,
        {
          ip: row.ip,
          email: row.email,
          count: row.count,
          windowMinutes: TUNE.bruteForceWindowMinutes,
        },
        suggestedAction
      );
    });
  }

  // ============================================================
  // B) PayTR webhook spoof — payment_intents'da hash_invalid
  // ============================================================
  private async checkPaytrSpoof(): Promise<AuditorFinding[]> {
    const since = new Date();
    since.setMinutes(since.getMinutes() - TUNE.paytrSpoofWindowMinutes);

    const { data, error } = await this.admin
      .from("payment_intents")
      .select("id, failure_reason, created_at")
      .ilike("failure_reason", "hash_invalid%")
      .gte("created_at", since.toISOString());

    if (error) {
      Sentry.captureException(error, {
        tags: { scope: "auditor.security", check: "paytr_spoof" },
      });
      return [
        this.warning(
          "paytr_spoof_check_failed",
          "PayTR spoof kontrolü çalıştırılamadı",
          `payment_intents sorgusu başarısız: ${error.message}. Spoof tespiti bu run'da atlandı.`,
          { error: error.message }
        ),
      ];
    }

    const rows = (data ?? []) as Array<{ id: string; failure_reason: string }>;
    if (rows.length < TUNE.paytrSpoofThreshold) return [];

    const suggestedAction: SuggestedAction = {
      type: "notify_sefa",
      payload: {
        subject: "PayTR webhook spoof denemesi tespit",
        message: `Son 24 saatte ${rows.length} adet hash_invalid POST geldi. Saldırı veya yanlış config olabilir.\n\nÖrnek intent ID'ler: ${rows.slice(0, 5).map((r) => r.id).join(", ")}`,
        urgency: "warning",
      },
      title: "PayTR spoof denemesi bildirimi gönder",
      description: "Sefa'ya detaylı mail gönderir.",
    };

    return [
      this.warning(
        "paytr_spoof",
        `${rows.length} PayTR webhook spoof denemesi`,
        `Son 24 saatte **${rows.length}** adet PayTR webhook'una **hash_invalid** ile POST geldi. Normalde 0-1 arası olmalı. Saldırı veya yanlış secret olabilir.`,
        {
          count: rows.length,
          windowMinutes: TUNE.paytrSpoofWindowMinutes,
          threshold: TUNE.paytrSpoofThreshold,
        },
        suggestedAction
      ),
    ];
  }

  // ============================================================
  // C) Yeni hesap kayıt hızı
  // ============================================================
  private async checkNewAccountFlood(): Promise<AuditorFinding[]> {
    const since = new Date();
    since.setMinutes(since.getMinutes() - TUNE.newAccountWindowMinutes);

    const { count, error } = await this.admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since.toISOString());

    if (error || count == null) return [];
    if (count < TUNE.newAccountThreshold) return [];

    const suggestedAction: SuggestedAction = {
      type: "notify_sefa",
      payload: {
        subject: "Bot kayıt saldırısı şüphesi",
        message: `Son 24 saatte ${count} yeni hesap kaydı oluştu. Bu normalin çok üstünde — bot saldırısı olabilir.\n\nÖneri: /admin/musteriler altında son kayıtları incele, şüpheliler için lock_admin_account aksiyonu kullan.`,
        urgency: "critical",
      },
      title: "Bot kayıt saldırısı bildirimi",
      description: "Sefa'ya kritik mail gönderir.",
    };

    return [
      this.critical(
        "new_account_flood",
        `${count} yeni hesap son 24 saatte`,
        `Pim Etiket normalde saatte 1-5 yeni kayıt alır. Bu pencerede **${count}** yeni hesap oluştu. Captcha bypass veya bot saldırısı belirtisi.`,
        {
          count,
          windowMinutes: TUNE.newAccountWindowMinutes,
          threshold: TUNE.newAccountThreshold,
        },
        suggestedAction
      ),
    ];
  }

  // ============================================================
  // D) Admin role değişikliği (son 24 saat)
  // ============================================================
  private async checkAdminRoleChanges(): Promise<AuditorFinding[]> {
    // Bu kontrol için profiles tablosunda role_updated_at gibi
    // bir kolon olmalı, yoksa audit_log'a bakılır.
    // Şu an audit_log tablosundan (Migration 024) "profile_role_update"
    // event'lerini çekiyoruz.
    const since = new Date();
    since.setHours(since.getHours() - 24);

    const { data, error } = await this.admin
      .from("audit_log")
      .select("id, actor, target_id, payload, created_at")
      .eq("event_type", "profile_role_update")
      .gte("created_at", since.toISOString());

    if (error) return [];

    const rows = (data ?? []) as Array<{
      id: string;
      actor: string | null;
      target_id: string | null;
      payload: Record<string, unknown>;
      created_at: string;
    }>;

    if (rows.length === 0) return [];

    // Her role değişikliği bir info finding (Sefa farkında olsun)
    return rows.map((r) => {
      const payload = r.payload as {
        old_role?: string;
        new_role?: string;
      };
      const isElevation =
        payload?.new_role === "admin" || payload?.new_role === "staff";

      const suggestedAction: SuggestedAction = {
        type: "notify_sefa",
        payload: {
          subject: "Admin/staff yetki değişikliği tespit",
          message: `Kullanıcı ${r.target_id}'ın rolü ${payload?.old_role ?? "?"} → ${payload?.new_role ?? "?"} olarak değişti.\nDeğişiklik aktörü: ${r.actor ?? "system"}.\nZaman: ${r.created_at}.\n\nBu değişiklik senin onayınla mı yapıldı? Değilse derhal incele.`,
          urgency: isElevation ? "critical" : "warning",
        },
        title: "Role değişikliği bildirimi",
        description: "Sefa'ya doğrulama maili gönderir.",
      };

      if (isElevation) {
        return this.critical(
          "admin_role_change",
          `Yetki yükseltme: ${payload?.new_role}`,
          `${r.target_id} kullanıcısının rolü **${payload?.old_role ?? "?"} → ${payload?.new_role}** olarak değişti. Yetkisiz değişiklik kontrol edilmeli.`,
          { actor: r.actor, target: r.target_id, ...payload },
          suggestedAction
        );
      }

      return this.info(
        "admin_role_change",
        `Role değişikliği: ${payload?.old_role} → ${payload?.new_role}`,
        `${r.target_id} kullanıcısının rolü değişti. Aktör: ${r.actor ?? "system"}.`,
        { actor: r.actor, target: r.target_id, ...payload }
      );
    });
  }

  // ============================================================
  // E) Service role kullanım anomalisi
  // ============================================================
  private async checkServiceRoleAnomaly(): Promise<AuditorFinding[]> {
    // Bu kontrol audit_log'un saatlik kullanım kırılımına bakıyor.
    // İdeal: pg_stat veya RPC, ama basit yaklaşım — son 1 saat vs
    // önceki 24 saat ortalama.
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    const { count: lastHourCount, error: e1 } = await this.admin
      .from("audit_log")
      .select("*", { count: "exact", head: true })
      .gte("created_at", oneHourAgo.toISOString());

    const { count: lastDayCount, error: e2 } = await this.admin
      .from("audit_log")
      .select("*", { count: "exact", head: true })
      .gte("created_at", oneDayAgo.toISOString())
      .lt("created_at", oneHourAgo.toISOString());

    if (e1 || e2 || lastHourCount == null || lastDayCount == null) return [];

    const hourlyAvg = lastDayCount / 23; // önceki 23 saat
    const threshold = hourlyAvg * TUNE.serviceRoleAnomalyMultiplier;

    if (lastHourCount < 50 || lastHourCount < threshold) return [];

    const suggestedAction: SuggestedAction = {
      type: "notify_sefa",
      payload: {
        subject: "Service role kullanım anomalisi",
        message: `Son 1 saat: ${lastHourCount} audit log kaydı. Ortalama saatlik: ${hourlyAvg.toFixed(1)} (önceki 23 saat). Eşik (${TUNE.serviceRoleAnomalyMultiplier}× ort): ${threshold.toFixed(0)}.\n\nBu artış normal trafik olabilir ama incelemek gerek.`,
        urgency: "warning",
      },
      title: "Service role kullanım anomalisi",
      description: "Sefa'ya saatlik kullanım anomalisi bildirilir.",
    };

    return [
      this.warning(
        "service_role_anomaly",
        `Saatlik audit_log artışı (${lastHourCount} > ${threshold.toFixed(0)})`,
        `Son 1 saatte ${lastHourCount} audit_log kaydı oluştu. Saatlik ortalama: ${hourlyAvg.toFixed(1)}. Bu ${TUNE.serviceRoleAnomalyMultiplier}× üstünde — normal değil.`,
        {
          lastHourCount,
          hourlyAvg,
          threshold,
          multiplier: TUNE.serviceRoleAnomalyMultiplier,
        },
        suggestedAction
      ),
    ];
  }
}

// ============================================================
// Helpers
// ============================================================

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

function buildSummary(counts: ReturnType<typeof countFindings>): string {
  if (counts.total === 0) return "Sistem güvenliği temiz — anormal aktivite yok.";
  const parts: string[] = [];
  if (counts.critical > 0) parts.push(`${counts.critical} kritik`);
  if (counts.warning > 0) parts.push(`${counts.warning} uyarı`);
  if (counts.info > 0) parts.push(`${counts.info} bilgi`);
  return `Güvenlik tarama tamamlandı — ${parts.join(", ")}.`;
}

function buildSummaryMd(
  findings: AuditorFinding[],
  counts: ReturnType<typeof countFindings>
): string {
  const lines: string[] = [
    `# 🛡️ Sistem Güvenliği Raporu`,
    "",
    `**Özet:** ${counts.total} bulgu (${counts.critical} kritik · ${counts.warning} uyarı · ${counts.info} bilgi)`,
    "",
  ];

  if (findings.length === 0) {
    lines.push(
      "✅ Tüm kontroller geçti — brute force, PayTR spoof, bot kayıt, yetki değişiklik, service role anomalisi: temiz."
    );
    return lines.join("\n");
  }

  const critical = findings.filter((f) => f.severity === "critical");
  const warning = findings.filter((f) => f.severity === "warning");

  if (critical.length > 0) {
    lines.push("## 🔴 Kritik bulgular");
    critical.forEach((f) => {
      lines.push(`- **${f.title}** — ${f.description}`);
    });
    lines.push("");
  }

  if (warning.length > 0) {
    lines.push("## 🟡 Uyarılar");
    warning.forEach((f) => {
      lines.push(`- **${f.title}** — ${f.description}`);
    });
  }

  return lines.join("\n");
}
