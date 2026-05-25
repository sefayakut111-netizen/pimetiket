/**
 * /admin/mail-health
 *
 * Sefa 21 May v68 — Resend mail observability dashboard.
 *
 * Görünür:
 *   - Resend bağlantı durumu (API key, webhook secret, unsubscribe secret)
 *   - 24sa istatistikleri (enqueued, sent, delivered, bounce, complaint, opened, clicked)
 *   - Kategori bazlı kırılım
 *   - Suppression listesi (manuel ekle/kaldır)
 *   - Failed mailler (son 20)
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, Button, Input, Eyebrow } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/cn";

type MailHealthTab = "status" | "templates";

interface Stats24h {
  enqueued: number;
  sent: number;
  delivered: number;
  bounced: number;
  complaint: number;
  opened: number;
  clicked: number;
  failed: number;
  pending: number;
}

interface RatesPct {
  deliveryRate: number;
  bounceRate: number;
  complaintRate: number;
  openRate: number;
  clickRate: number;
}

interface CategoryStat {
  category: string;
  count: number;
  sent: number;
  failed: number;
  delivered: number;
}

interface Suppression {
  id: string;
  email: string;
  type: string;
  reason: string | null;
  created_at: string;
}

interface FailedMail {
  id: string;
  template_key: string;
  to_email: string;
  last_error: string | null;
  attempts: number;
  next_retry_at: string | null;
  created_at: string;
  category: string | null;
}

interface HealthData {
  ok: boolean;
  resend: {
    configured: boolean;
    webhook_configured: boolean;
    unsubscribe_configured: boolean;
    from_address: string | null;
  };
  stats24h: Stats24h;
  ratesPct: RatesPct;
  byCategory: CategoryStat[];
  suppressionsCount: Record<string, number>;
  suppressions: Suppression[];
  failedRecent: FailedMail[];
  timestamp: string;
}

const SUPPRESSION_LABELS: Record<string, string> = {
  bounce_hard: "Kalıcı bounce",
  bounce_soft_repeated: "Tekrarlanan soft bounce",
  complaint: "Spam şikayeti",
  unsubscribe_marketing: "Pazarlama unsubscribe",
  unsubscribe_blog: "Blog unsubscribe",
  unsubscribe_all: "Tüm pazarlama (unsubscribe)",
  manual_admin: "Admin manuel",
};

const CATEGORY_LABELS: Record<string, string> = {
  fason: "Üretim partneri",
  customer: "Müşteri (transactional)",
  lead: "Lead / marketing",
  admin: "Admin bildirimi",
  unknown: "Tanımsız",
};

export default function AdminMailHealthPage() {
  const [activeTab, setActiveTab] = useState<MailHealthTab>("status");
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Add form state
  const [addEmail, setAddEmail] = useState("");
  const [addReason, setAddReason] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/mail-health", { cache: "no-store" });
      const json = (await res.json()) as HealthData & {
        error?: string;
        fix?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Bilinmeyen hata");
        setData(null);
      } else {
        setData(json);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "fetch_error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addSuppression = useCallback(async () => {
    if (!addEmail || !addEmail.includes("@")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/mail-suppressions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: addEmail,
          type: "manual_admin",
          reason: addReason || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        alert("Hata: " + (json.error ?? "bilinmiyor"));
      } else {
        setAddEmail("");
        setAddReason("");
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }, [addEmail, addReason, refresh]);

  const removeSuppression = useCallback(
    async (id: string) => {
      if (!confirm("Bu suppression kaydı silinecek. Onaylıyor musun?")) return;
      setBusy(true);
      try {
        const res = await fetch("/api/admin/mail-suppressions", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          alert("Hata: " + (json.error ?? "bilinmiyor"));
        } else {
          await refresh();
        }
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const totalSuppressions = useMemo(
    () =>
      data
        ? Object.values(data.suppressionsCount).reduce((a, b) => a + b, 0)
        : 0,
    [data]
  );

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        {/* Header */}
        <div className="flex items-end justify-between gap-6 mb-7 flex-wrap">
          <div>
            <Eyebrow>Mail Operasyon</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
              Mail Health
            </h1>
            <p className="mt-1.5 text-base text-gri-700">
              Son 24 saat — gönderim, bounce, complaint, unsubscribe
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => void refresh()}
              disabled={loading || busy}
            >
              <Icon.Refresh size={16} className="mr-1.5" />
              Yenile
            </Button>
            <Link href="/admin">
              <Button variant="ghost">
                <Icon.ChevR size={16} className="mr-1.5 rotate-180" />
                Panel
              </Button>
            </Link>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl bg-gri-100 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("status")}
            className={cn(
              "px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors",
              activeTab === "status"
                ? "bg-white text-lacivert shadow-1"
                : "text-gri-700 hover:text-lacivert"
            )}
          >
            Durum
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("templates")}
            className={cn(
              "px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors",
              activeTab === "templates"
                ? "bg-white text-lacivert shadow-1"
                : "text-gri-700 hover:text-lacivert"
            )}
          >
            Şablonlar
          </button>
        </div>

        {activeTab === "templates" && <MailTemplatesTab />}

        {activeTab === "status" && (
          <>
        {/* Error band */}
        {error && (
          <Card className="mb-6 border-kirmizi/30 bg-kirmizi/5 p-4">
            <p className="text-sm text-kirmizi-koyu">
              <strong>Veri çekilemedi:</strong> {error}
            </p>
            <details className="mt-2 text-xs text-gri-700">
              <summary className="cursor-pointer">Olası sebepler</summary>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                <li>
                  <code>42703</code>: Migration 076 production'a uygulanmamış —
                  observability kolonları eksik
                </li>
                <li>
                  <code>42P01</code>: <code>mail_suppressions</code> tablosu yok —
                  Migration 076 uygula
                </li>
                <li>403: Admin oturumu kapalı, /auth'tan giriş yap</li>
              </ul>
            </details>
          </Card>
        )}

        {/* Loading */}
        {loading && !data && (
          <Card className="p-8 text-center text-gri-700">Yükleniyor…</Card>
        )}

        {data && (
          <>
            {/* Connection status */}
            <Card className="mb-6 p-5">
              <h2 className="text-lg font-semibold mb-3">
                Resend bağlantı durumu
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <StatusPill
                  label="API key"
                  ok={data.resend.configured}
                  okText="Aktif"
                  failText="RESEND_API_KEY eksik"
                />
                <StatusPill
                  label="Webhook"
                  ok={data.resend.webhook_configured}
                  okText="Doğrulanabilir"
                  failText="WEBHOOK_SECRET eksik"
                />
                <StatusPill
                  label="Unsubscribe"
                  ok={data.resend.unsubscribe_configured}
                  okText="Token üretilebilir"
                  failText="SECRET eksik"
                />
                <div className="flex flex-col">
                  <span className="text-xs text-gri-700">Gönderici</span>
                  <span className="text-sm font-mono break-all">
                    {data.resend.from_address ?? "(set edilmedi)"}
                  </span>
                </div>
              </div>
            </Card>

            {/* 24h KPI grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Kpi
                label="Kuyruğa atılan"
                value={data.stats24h.enqueued}
                hint="Son 24 saat"
              />
              <Kpi
                label="Resend'e iletilen"
                value={data.stats24h.sent}
                hint={`${data.stats24h.pending} bekliyor · ${data.stats24h.failed} failed`}
              />
              <Kpi
                label="Mailbox'a düşen"
                value={data.stats24h.delivered}
                hint={`%${data.ratesPct.deliveryRate} delivery rate`}
                tone={data.ratesPct.deliveryRate >= 95 ? "good" : data.ratesPct.deliveryRate >= 85 ? "warn" : "bad"}
              />
              <Kpi
                label="Bounce + Complaint"
                value={data.stats24h.bounced + data.stats24h.complaint}
                hint={`bounce %${data.ratesPct.bounceRate} · spam %${data.ratesPct.complaintRate}`}
                tone={
                  data.ratesPct.bounceRate > 5 || data.ratesPct.complaintRate > 0.3
                    ? "bad"
                    : "good"
                }
              />
              <Kpi
                label="Open rate"
                value={`%${data.ratesPct.openRate}`}
                hint={`${data.stats24h.opened} açıldı`}
              />
              <Kpi
                label="Click rate"
                value={`%${data.ratesPct.clickRate}`}
                hint={`${data.stats24h.clicked} tıklandı`}
              />
              <Kpi
                label="Suppression"
                value={totalSuppressions}
                hint="Toplam aktif kayıt"
                tone={totalSuppressions > 50 ? "warn" : undefined}
              />
              <Kpi
                label="Failed (geri çekiliyor)"
                value={data.stats24h.failed}
                hint="Max 6 deneme, exp backoff"
                tone={data.stats24h.failed > 5 ? "warn" : undefined}
              />
            </div>

            {/* Kategori bazlı kırılım */}
            <Card className="mb-6 p-5">
              <h2 className="text-lg font-semibold mb-3">
                Kategori bazlı (son 24sa)
              </h2>
              {data.byCategory.length === 0 ? (
                <p className="text-sm text-gri-700">Veri yok</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gri-700 border-b border-gri-200">
                      <th className="py-2">Kategori</th>
                      <th className="py-2">Toplam</th>
                      <th className="py-2">Sent</th>
                      <th className="py-2">Delivered</th>
                      <th className="py-2">Failed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byCategory.map((c) => (
                      <tr key={c.category} className="border-b border-gri-100">
                        <td className="py-2 font-medium">
                          {CATEGORY_LABELS[c.category] ?? c.category}
                        </td>
                        <td className="py-2">{c.count}</td>
                        <td className="py-2">{c.sent}</td>
                        <td className="py-2">{c.delivered}</td>
                        <td
                          className={cn(
                            "py-2",
                            c.failed > 0 ? "text-kirmizi-koyu" : ""
                          )}
                        >
                          {c.failed}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            {/* Suppression ekle */}
            <Card className="mb-6 p-5">
              <h2 className="text-lg font-semibold mb-3">
                Manuel suppression ekle
              </h2>
              <p className="text-xs text-gri-700 mb-3">
                Bu email'e <strong>tüm kategorilerde</strong> mail gönderimi
                durdurulur (hard suppression). KVKK aydınlatma maili
                gönderilmeyi gerektiren özel talepler için sadece bunu kullan.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Input
                  type="email"
                  placeholder="email@domain.com"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  className="min-w-[280px]"
                />
                <Input
                  type="text"
                  placeholder="Sebep (opsiyonel)"
                  value={addReason}
                  onChange={(e) => setAddReason(e.target.value)}
                  className="min-w-[260px]"
                />
                <Button
                  variant="primary"
                  onClick={() => void addSuppression()}
                  disabled={!addEmail || busy}
                >
                  <Icon.Plus size={16} className="mr-1.5" />
                  Ekle
                </Button>
              </div>
            </Card>

            {/* Suppression listesi */}
            <Card className="mb-6 p-5">
              <h2 className="text-lg font-semibold mb-3">
                Suppression listesi (son 100)
              </h2>
              {data.suppressions.length === 0 ? (
                <p className="text-sm text-gri-700">
                  Hiç suppression kaydı yok — temiz liste 👍
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-gri-700 border-b border-gri-200">
                        <th className="py-2">Email</th>
                        <th className="py-2">Tür</th>
                        <th className="py-2">Sebep</th>
                        <th className="py-2">Tarih</th>
                        <th className="py-2 text-right">Aksiyon</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.suppressions.map((s) => (
                        <tr
                          key={s.id}
                          className="border-b border-gri-100"
                        >
                          <td className="py-2 font-mono text-xs">
                            {s.email}
                          </td>
                          <td className="py-2">
                            <SuppressionBadge type={s.type} />
                          </td>
                          <td className="py-2 text-gri-700 max-w-[300px] truncate">
                            {s.reason ?? "—"}
                          </td>
                          <td className="py-2 text-xs text-gri-700">
                            {new Date(s.created_at).toLocaleString(
                              "tr-TR",
                              {
                                timeZone: "Europe/Istanbul",
                                dateStyle: "short",
                                timeStyle: "short",
                              }
                            )}
                          </td>
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() => void removeSuppression(s.id)}
                              className="text-xs text-kirmizi-koyu hover:underline disabled:opacity-50"
                              disabled={busy}
                            >
                              Kaldır
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Failed mailler */}
            <Card className="mb-6 p-5">
              <h2 className="text-lg font-semibold mb-3">
                Failed mailler (geri çekiliyor)
              </h2>
              {data.failedRecent.length === 0 ? (
                <p className="text-sm text-gri-700">
                  Failed mail yok — gönderim akışı sağlıklı 👍
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-gri-700 border-b border-gri-200">
                        <th className="py-2">Template</th>
                        <th className="py-2">Alıcı</th>
                        <th className="py-2">Kategori</th>
                        <th className="py-2">Deneme</th>
                        <th className="py-2">Son hata</th>
                        <th className="py-2">Sonraki deneme</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.failedRecent.map((f) => (
                        <tr
                          key={f.id}
                          className="border-b border-gri-100"
                        >
                          <td className="py-2 font-mono text-xs">
                            {f.template_key}
                          </td>
                          <td className="py-2 font-mono text-xs">
                            {f.to_email}
                          </td>
                          <td className="py-2 text-xs text-gri-700">
                            {f.category ?? "—"}
                          </td>
                          <td className="py-2">{f.attempts}/6</td>
                          <td className="py-2 text-xs text-kirmizi-koyu max-w-[280px] truncate">
                            {f.last_error ?? "—"}
                          </td>
                          <td className="py-2 text-xs text-gri-700">
                            {f.next_retry_at
                              ? new Date(f.next_retry_at).toLocaleString(
                                  "tr-TR",
                                  {
                                    timeZone: "Europe/Istanbul",
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  }
                                )
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <p className="text-xs text-gri-700 text-right mt-2">
              Son güncelleme:{" "}
              {new Date(data.timestamp).toLocaleString("tr-TR", {
                timeZone: "Europe/Istanbul",
              })}
            </p>
          </>
        )}
          </>
        )}
      </div>
    </main>
  );
}

interface MailTemplateItem {
  key: string;
  label: string;
  subject: string;
}

function MailTemplatesTab() {
  const [templates, setTemplates] = useState<MailTemplateItem[]>([]);
  const [fromAddress, setFromAddress] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/mail-templates", { cache: "no-store" });
        const json = (await res.json()) as {
          ok?: boolean;
          templates?: MailTemplateItem[];
          from?: string;
        };
        if (json.ok && json.templates) {
          setTemplates(json.templates);
          setFromAddress(json.from ?? null);
          if (json.templates[0]) {
            setSelectedKey(json.templates[0].key);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadPreview = useCallback(async (key: string) => {
    setPreviewLoading(true);
    setSelectedKey(key);
    try {
      const res = await fetch(
        `/api/admin/mail-templates?key=${encodeURIComponent(key)}&preview=true`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as {
        ok?: boolean;
        html?: string;
        subject?: string;
      };
      if (json.ok) {
        setPreviewHtml(json.html ?? null);
        setPreviewSubject(json.subject ?? null);
      }
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedKey) void loadPreview(selectedKey);
  }, [selectedKey, loadPreview]);

  const sendTest = async () => {
    if (!selectedKey) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/mail-templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateKey: selectedKey,
          recipientEmail: testEmail.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; to?: string };
      if (!json.ok) {
        alert(`Gönderilemedi: ${json.error ?? "bilinmiyor"}`);
      } else {
        alert(`Test mail gönderildi: ${json.to}`);
      }
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <Card className="p-8 text-center text-gri-700">Şablonlar yükleniyor…</Card>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-3">Mail şablonları</h2>
        <ul className="space-y-1 max-h-[520px] overflow-y-auto">
          {templates.map((t) => (
            <li key={t.key}>
              <button
                type="button"
                onClick={() => void loadPreview(t.key)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg text-[13px] transition-colors",
                  selectedKey === t.key
                    ? "bg-pim-mercan-tint text-lacivert font-semibold"
                    : "hover:bg-gri-50 text-gri-700"
                )}
              >
                <span className="block font-medium">{t.label}</span>
                <span className="block text-[11px] text-gri-500 font-mono mt-0.5">
                  {t.key}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-semibold mb-1">Önizleme</h2>
        {previewSubject && (
          <p className="text-sm text-gri-700 mb-1">
            <strong>Konu:</strong> {previewSubject}
          </p>
        )}
        {fromAddress && (
          <p className="text-xs text-gri-500 mb-4 font-mono">From: {fromAddress}</p>
        )}

        {previewLoading ? (
          <div className="h-[420px] flex items-center justify-center text-gri-700">
            Render ediliyor…
          </div>
        ) : previewHtml ? (
          <iframe
            title="Mail önizleme"
            srcDoc={previewHtml}
            className="w-full h-[420px] rounded-lg border border-gri-200 bg-white"
            sandbox=""
          />
        ) : (
          <div className="h-[420px] flex items-center justify-center text-gri-700">
            Şablon seçin
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2 items-end">
          <label className="flex-1 min-w-[200px]">
            <span className="text-xs text-gri-700 block mb-1">
              Test gönder (boş = admin email)
            </span>
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="admin@pimetiket.com"
            />
          </label>
          <Button
            variant="primary"
            onClick={() => void sendTest()}
            disabled={!selectedKey || sending}
          >
            Test gönder
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// Helper bileşenler
// ============================================================
function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-yesil-koyu"
      : tone === "warn"
      ? "text-amber-700"
      : tone === "bad"
      ? "text-kirmizi-koyu"
      : "text-lacivert";
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-gri-700">
        {label}
      </div>
      <div className={cn("mt-1 text-2xl font-semibold", toneClass)}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-gri-700">{hint}</div>}
    </Card>
  );
}

function StatusPill({
  label,
  ok,
  okText,
  failText,
}: {
  label: string;
  ok: boolean;
  okText: string;
  failText: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gri-700">{label}</span>
      <span
        className={cn(
          "mt-0.5 inline-flex items-center gap-1.5 text-sm font-medium",
          ok ? "text-yesil-koyu" : "text-kirmizi-koyu"
        )}
      >
        <span
          className={cn(
            "inline-block w-2 h-2 rounded-full",
            ok ? "bg-yesil" : "bg-kirmizi"
          )}
        />
        {ok ? okText : failText}
      </span>
    </div>
  );
}

function SuppressionBadge({ type }: { type: string }) {
  const label = SUPPRESSION_LABELS[type] ?? type;
  const cls =
    type === "bounce_hard" || type === "complaint"
      ? "bg-kirmizi/10 text-kirmizi-koyu"
      : type.startsWith("unsubscribe_")
      ? "bg-amber-50 text-amber-700"
      : "bg-gri-100 text-lacivert";
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        cls
      )}
    >
      {label}
    </span>
  );
}
