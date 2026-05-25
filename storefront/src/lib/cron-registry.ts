export const CRON_REGISTRY = [
  { name: "auto-refund", schedule: "0 2 * * *", label: "Otomatik iade (36sa)" },
  { name: "archive-inactive", schedule: "0 3 * * *", label: "Arşiv (90gün)" },
  { name: "poll-shipments", schedule: "0 */4 * * *", label: "Kargo takip" },
  { name: "process-mail-outbox", schedule: "0 3 * * *", label: "Mail kuyruğu" },
  { name: "detect-abandoned-carts", schedule: "0 4 * * *", label: "Terk sepet" },
  { name: "cleanup-orphan-previews", schedule: "0 4 * * *", label: "Orphan preview" },
  { name: "cleanup-stale-uploads", schedule: "0 4 * * *", label: "Stale upload" },
  { name: "cleanup-temp-designs", schedule: "0 4 * * *", label: "Temp tasarım" },
  { name: "paytr-reconciler", schedule: "30 3 * * *", label: "PayTR mutabakat" },
  { name: "purge-expired-designs", schedule: "0 4 * * *", label: "KVKK tasarım silme" },
  { name: "refresh-fason-scores", schedule: "0 3 * * *", label: "Partner skor" },
  { name: "request-reviews", schedule: "0 10 * * *", label: "Yorum daveti" },
  { name: "upload-reminders", schedule: "0 9 * * *", label: "Upload hatırlatma" },
  { name: "admin-daily-summary", schedule: "0 9 * * *", label: "Günlük özet" },
  { name: "auditors-daily-digest", schedule: "0 8 * * *", label: "Denetçi rapor" },
  { name: "auditors-agent", schedule: "varies", label: "Denetçi agent" },
] as const;

export type CronRegistryName = (typeof CRON_REGISTRY)[number]["name"];

/** Manuel tetikleme — registry adı → API path */
export function cronTriggerPath(cronName: string): string | null {
  if (cronName === "auditors-daily-digest") {
    return "/api/cron/auditors/daily-digest";
  }
  if (cronName === "auditors-agent") {
    return null;
  }
  return `/api/cron/${cronName}`;
}
