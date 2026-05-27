/**
 * Cron kayıt defteri — vercel.json ile senkron tutulmalı.
 * Admin cron-status / system-health bu listeyi kullanır.
 */
export const CRON_REGISTRY = [
  { name: "auto-refund", schedule: "0 2 * * *", label: "Otomatik iade (36sa)" },
  { name: "process-mail-outbox", schedule: "5 2 * * *", label: "Mail kuyruğu" },
  { name: "refresh-fason-scores", schedule: "0 3 * * *", label: "Partner skor" },
  { name: "cleanup-temp-designs", schedule: "15 3 * * *", label: "Temp tasarım" },
  { name: "paytr-reconciler", schedule: "30 3 * * *", label: "PayTR mutabakat" },
  { name: "archive-inactive", schedule: "30 3 * * *", label: "Arşiv (90gün)" },
  { name: "cleanup-stale-uploads", schedule: "45 3 * * *", label: "Stale upload" },
  { name: "purge-expired-designs", schedule: "0 4 * * *", label: "KVKK tasarım silme" },
  { name: "cleanup-orphan-previews", schedule: "0 4 * * 0", label: "Orphan preview" },
  { name: "auditors-security", schedule: "0 1 * * *", label: "Denetçi: güvenlik" },
  { name: "auditors-workflow", schedule: "0 5 * * *", label: "Denetçi: iş akışı" },
  { name: "auditors-finance", schedule: "0 6 * * *", label: "Denetçi: finans" },
  { name: "admin-daily-summary", schedule: "0 6 * * *", label: "Günlük özet" },
  { name: "auditors-daily-digest", schedule: "0 8 * * *", label: "Denetçi rapor" },
  { name: "auditors-ai_cost", schedule: "30 9 * * *", label: "Denetçi: AI maliyet" },
  { name: "auditors-compliance", schedule: "30 10 * * *", label: "Denetçi: uyumluluk" },
  { name: "detect-abandoned-carts", schedule: "0 10 * * *", label: "Terk sepet" },
  { name: "request-reviews", schedule: "0 11 * * *", label: "Yorum daveti" },
  { name: "auditors-seo", schedule: "0 11 * * 3", label: "Denetçi: SEO" },
  { name: "upload-reminders", schedule: "0 12 * * *", label: "Upload hatırlatma" },
  { name: "auditors-brand", schedule: "0 14 * * 5", label: "Denetçi: marka" },
  { name: "poll-shipments", schedule: "0 9 * * *", label: "Kargo takip" },
  { name: "auditors-data_hygiene", schedule: "0 3 * * 0", label: "Denetçi: veri hijyeni" },
  { name: "auditors-customer_health", schedule: "0 10 * * 1", label: "Denetçi: müşteri sağlığı" },
] as const;

export type CronRegistryName = (typeof CRON_REGISTRY)[number]["name"];

/** Manuel tetikleme — registry adı → API path */
export function cronTriggerPath(cronName: string): string | null {
  if (cronName === "auditors-daily-digest") {
    return "/api/cron/auditors/daily-digest";
  }
  if (cronName.startsWith("auditors-")) {
    const auditor = cronName.replace(/^auditors-/, "");
    return `/api/cron/auditors/${auditor}`;
  }
  return `/api/cron/${cronName}`;
}
