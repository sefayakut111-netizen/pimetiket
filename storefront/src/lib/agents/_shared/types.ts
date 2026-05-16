/**
 * Pim Etiket — Auditor framework type definitions.
 *
 * 9 domain denetçi agent'ın ortak TypeScript şeması.
 * Migration 040 ile bu tipler DB tablolarına maps eder.
 */

// ============================================================
// Auditor identity
// ============================================================

/** Domain agent isimleri — DB'de auditor_name kolonuyla eşleşir. */
export const AUDITOR_NAMES = [
  "security",        // 🛡️ Sistem Güvenliği
  "finance",         // 💰 Muhasebe
  "workflow",        // ⚙️ İş Akışı
  "compliance",      // ⚖️ Mevzuat
  "data_hygiene",    // 🧹 Veri Hijyen
  "customer_health", // 😊 Müşteri Memnuniyeti
  "seo",             // 📈 SEO / Performance
  "ai_cost",         // 💸 AI Maliyet
  "brand",           // 🎨 Marka Tutarlılığı
] as const;

export type AuditorName = (typeof AUDITOR_NAMES)[number];

/** İnsan-okunur etiket (UI'da gösterilir). */
export const AUDITOR_LABELS: Record<AuditorName, string> = {
  security: "Sistem Güvenliği",
  finance: "Muhasebe",
  workflow: "İş Akışı",
  compliance: "Mevzuat",
  data_hygiene: "Veri Hijyen",
  customer_health: "Müşteri Memnuniyeti",
  seo: "SEO / Performance",
  ai_cost: "AI Maliyet",
  brand: "Marka Tutarlılığı",
};

/** Emoji (kart başlığı için). */
export const AUDITOR_EMOJI: Record<AuditorName, string> = {
  security: "🛡️",
  finance: "💰",
  workflow: "⚙️",
  compliance: "⚖️",
  data_hygiene: "🧹",
  customer_health: "😊",
  seo: "📈",
  ai_cost: "💸",
  brand: "🎨",
};

// ============================================================
// Severity + Status
// ============================================================

export type Severity = "info" | "warning" | "critical";
export type RunStatus = "running" | "success" | "failed" | "timeout";
export type PendingActionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "snoozed"
  | "applied"
  | "failed";
export type TriggerType = "cron" | "manual" | "webhook";
export type ActionResult = "success" | "failed" | "partial";

// ============================================================
// Finding — bir tespit
// ============================================================

export interface AuditorFinding {
  /** Karşılık geldiği veri kategorisi (örn "brute_force", "stale_intent"). */
  category: string;
  severity: Severity;
  /** Sefa'ya gösterilecek başlık (kısa). */
  title: string;
  /** Detaylı açıklama (markdown OK). */
  description: string;
  /** Veri snapshot — UI'da göstermek için (örn IP, sayılar). */
  data?: Record<string, unknown>;
  /** Eğer aksiyon öneriliyorsa: */
  suggestedAction?: SuggestedAction;
}

export interface SuggestedAction {
  /** Aksiyon tipi — actions/ klasöründeki dosyaya karşılık gelir. */
  type: string;
  /** Aksiyon parametreleri (örn { ip: "1.2.3.4", duration: 86400 }). */
  payload: Record<string, unknown>;
  /** Sefa'ya gösterilecek aksiyon başlığı. */
  title: string;
  /** Detaylı açıklama. */
  description: string;
}

// ============================================================
// Run result — Auditor.run() döndürür
// ============================================================

export interface AuditorRunResult {
  findings: AuditorFinding[];
  /** Bir cümle özet (mail başlığında kullanılır). */
  summary: string;
  /** Detaylı markdown rapor (mail body + UI). */
  summaryMd?: string;
  /** Trend grafikleri için metrik snapshot. */
  metricsSnapshot?: Record<string, unknown>;
}

// ============================================================
// Database row types — Supabase row'larına karşılık gelir
// ============================================================

export interface AuditorRunRow {
  id: string;
  auditor_name: AuditorName;
  auditor_version: string;
  trigger_type: TriggerType;
  triggered_by: string | null;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  status: RunStatus;
  findings_count: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  summary: string | null;
  summary_md: string | null;
  metrics_snapshot: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
}

export interface AuditorFindingRow {
  id: string;
  run_id: string;
  auditor_name: AuditorName;
  severity: Severity;
  category: string;
  title: string;
  description: string;
  data: Record<string, unknown> | null;
  suggested_action_type: string | null;
  suggested_action_payload: Record<string, unknown> | null;
  suggested_action_description: string | null;
  created_at: string;
}

export interface AuditorPendingActionRow {
  id: string;
  finding_id: string | null;
  run_id: string;
  auditor_name: AuditorName;
  action_type: string;
  action_payload: Record<string, unknown>;
  title: string;
  description: string;
  severity: Severity;
  status: PendingActionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  snooze_until: string | null;
  applied_at: string | null;
  apply_error: string | null;
  apply_result: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditorActionLogRow {
  id: string;
  pending_action_id: string;
  executed_at: string;
  executed_by: string | null;
  result: ActionResult;
  affected_rows: number | null;
  affected_ids: Record<string, unknown> | null;
  external_call: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
}

// ============================================================
// API response types — dashboard component'leri kullanır
// ============================================================

export interface AuditorLatestRunSummary {
  auditorName: AuditorName;
  latestRunId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  status: RunStatus | null;
  findingsCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  summary: string | null;
}

export interface PendingCountSummary {
  criticalPending: number;
  warningPending: number;
  infoPending: number;
  totalPending: number;
}
