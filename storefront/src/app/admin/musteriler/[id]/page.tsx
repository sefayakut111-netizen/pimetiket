/**
 * Pim Etiket — /admin/musteriler/[id] (Sefa 17 May 360° rewrite)
 *
 * 2-kolon layout:
 *   SOL  → Profil + KPI + Durum + 8 hızlı aksiyon
 *   SAĞ  → Activity timeline + Internal notes + Son siparişler
 *
 * Veri: GET /api/admin/customers/[id] (fn_admin_customer_360 RPC)
 * Aksiyonlar: notes, tags, grant-credit, send-email, suspend, reset-password
 */

"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Card, Eyebrow, Button, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import type {
  AdminCustomerWithSegment,
} from "@/app/api/admin/customers/route";

interface Note {
  id: string;
  body: string;
  pinned: boolean;
  author_name: string | null;
  created_at: string;
}

interface ActivityItem {
  ref_id: string;
  user_id: string;
  created_at: string;
  kind: string;
  title: string;
  detail: string;
  emoji: string;
}

interface OrderRow {
  id: string;
  status: string;
  total: number;
  created_at: string;
  items_count: number;
}

interface LoyaltyGrant {
  id: string;
  amount_try: number;
  reason: string;
  status: string;
  created_at: string;
}

interface Customer360 {
  overview: AdminCustomerWithSegment;
  recent_activity: ActivityItem[];
  orders: OrderRow[];
  notes: Note[];
  tags: string[];
  loyalty_grants: LoyaltyGrant[];
}

const SEGMENT_META: Record<
  string,
  { label: string; emoji: string; color: string; bg: string }
> = {
  vip: { label: "VIP", emoji: "⭐", color: "text-sari-koyu", bg: "bg-sari-soft" },
  repeat: {
    label: "Tekrar",
    emoji: "🔁",
    color: "text-yesil",
    bg: "bg-yesil-soft",
  },
  new: {
    label: "Yeni",
    emoji: "✨",
    color: "text-pim-mercan",
    bg: "bg-pim-mercan-tint",
  },
  risk: {
    label: "Risk",
    emoji: "⚠",
    color: "text-saman-koyu",
    bg: "bg-saman/15",
  },
  lost: {
    label: "Kayıp",
    emoji: "💤",
    color: "text-kirmizi",
    bg: "bg-kirmizi/10",
  },
  no_order: {
    label: "Sipariş yok",
    emoji: "🆕",
    color: "text-gri-700",
    bg: "bg-gri-100",
  },
};

const fmt = (n: number) => Math.round(n).toLocaleString("tr-TR");

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "Az önce";
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa önce`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function waLink(phone: string | null): string {
  if (!phone) return "#";
  const digits = phone.replace(/\D/g, "");
  const trimmed = digits.startsWith("90")
    ? digits
    : digits.startsWith("0")
      ? `9${digits}`
      : `90${digits}`;
  return `https://wa.me/${trimmed}`;
}

function telLink(phone: string | null): string {
  if (!phone) return "#";
  const digits = phone.replace(/\D/g, "");
  const e164 = digits.startsWith("90")
    ? `+${digits}`
    : digits.startsWith("0")
      ? `+9${digits}`
      : `+90${digits}`;
  return `tel:${e164}`;
}

type ModalKind = "email" | "credit" | "tag" | "suspend" | "note" | null;

export default function AdminMusteriDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const toast = useToast();
  const [data, setData] = useState<Customer360 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalKind, setModalKind] = useState<ModalKind>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/customers/${id}`, {
        cache: "no-store",
      });
      const j = (await r.json()) as {
        ok?: boolean;
        data?: Customer360;
        error?: string;
      };
      if (!j.ok || !j.data) {
        setError(j.error ?? "fetch_failed");
        setData(null);
      } else {
        setError(null);
        setData(j.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "network");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Modal handlers ===========================================================

  const handleNote = async (body: string, pinned: boolean) => {
    const r = await fetch(`/api/admin/customers/${id}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body, pinned }),
    });
    const j = (await r.json()) as { ok?: boolean; error?: string };
    if (j.ok) {
      toast.success("Not eklendi");
      setModalKind(null);
      await refresh();
    } else toast.error(j.error ?? "Hata");
  };

  const handleEmail = async (subject: string, bodyText: string) => {
    const r = await fetch(`/api/admin/customers/${id}/send-email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject, body_text: bodyText }),
    });
    const j = (await r.json()) as { ok?: boolean; error?: string };
    if (j.ok) {
      toast.success("Email kuyruğa eklendi (cron 5dk içinde gönderir)");
      setModalKind(null);
      await refresh();
    } else toast.error(j.error ?? "Hata");
  };

  const handleCredit = async (amount: number, reason: string) => {
    const r = await fetch(`/api/admin/customers/${id}/grant-credit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount_try: amount, reason }),
    });
    const j = (await r.json()) as { ok?: boolean; error?: string };
    if (j.ok) {
      toast.success(`${amount} TL kontör verildi`);
      setModalKind(null);
      await refresh();
    } else toast.error(j.error ?? "Hata");
  };

  const handleTag = async (tag: string) => {
    const r = await fetch(`/api/admin/customers/${id}/tags`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tag }),
    });
    const j = (await r.json()) as { ok?: boolean; tag?: string; error?: string };
    if (j.ok) {
      toast.success(`Tag eklendi: ${j.tag}`);
      setModalKind(null);
      await refresh();
    } else toast.error(j.error ?? "Hata");
  };

  const handleRemoveTag = async (tag: string) => {
    if (!confirm(`"${tag}" tag'ini kaldırmak istediğine emin misin?`)) return;
    const r = await fetch(
      `/api/admin/customers/${id}/tags?tag=${encodeURIComponent(tag)}`,
      { method: "DELETE" }
    );
    const j = (await r.json()) as { ok?: boolean };
    if (j.ok) {
      toast.success("Tag kaldırıldı");
      await refresh();
    }
  };

  const handleVipToggle = async () => {
    const hasVip = data?.tags.includes("vip") ?? false;
    if (hasVip) {
      await handleRemoveTag("vip");
    } else {
      await handleTag("vip");
    }
  };

  const handleSuspend = async (
    until: "permanent" | null,
    reason: string
  ) => {
    const r = await fetch(`/api/admin/customers/${id}/suspend`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ until, reason }),
    });
    const j = (await r.json()) as { ok?: boolean; error?: string };
    if (j.ok) {
      toast.success(until ? "Hesap donduruldu" : "Hesap aktif");
      setModalKind(null);
      await refresh();
    } else toast.error(j.error ?? "Hata");
  };

  const handlePasswordReset = async () => {
    if (
      !confirm(
        "Şifre sıfırlama maili göndermek istediğine emin misin? Müşteriye reset linki mail gider."
      )
    )
      return;
    const r = await fetch(`/api/admin/customers/${id}/reset-password`, {
      method: "POST",
    });
    const j = (await r.json()) as {
      ok?: boolean;
      sent_to?: string;
      error?: string;
    };
    if (j.ok) {
      toast.success(`Reset maili gönderildi: ${j.sent_to}`);
      await refresh();
    } else toast.error(j.error ?? "Hata");
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("Bu notu silmek istediğine emin misin?")) return;
    const r = await fetch(
      `/api/admin/customers/${id}/notes?noteId=${noteId}`,
      { method: "DELETE" }
    );
    const j = (await r.json()) as { ok?: boolean };
    if (j.ok) {
      toast.success("Not silindi");
      await refresh();
    }
  };

  // Render ===================================================================

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <div className="h-8 bg-gri-100 rounded animate-pulse w-1/3 mb-4" />
          <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
            <div className="h-[500px] bg-gri-100 rounded-2xl animate-pulse" />
            <div className="h-[500px] bg-gri-100 rounded-2xl animate-pulse" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="py-12">
        <div className="mx-auto max-w-[640px] px-4 text-center">
          <Pim pose="sad" size={160} />
          <h1 className="mt-4 text-[24px] font-semibold">
            Müşteri bulunamadı
          </h1>
          <p className="mt-2 text-base text-gri-700">
            {error ?? "Veri okunamadı."}
          </p>
          <Link
            href="/admin/musteriler"
            className="mt-4 inline-flex items-center gap-1 text-pim-mercan font-semibold"
          >
            ← Müşteri listesine dön
          </Link>
        </div>
      </main>
    );
  }

  const o = data.overview;
  const segment = SEGMENT_META[o.segment] ?? SEGMENT_META.no_order;
  const isBanned =
    o.banned_until && new Date(o.banned_until).getTime() > Date.now();
  const hasVip = data.tags.includes("vip");

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        {/* Breadcrumb */}
        <div className="text-[12.5px] text-gri-700 mb-3 flex items-center gap-1.5">
          <Link href="/admin/musteriler" className="hover:text-pim-mercan">
            Müşteriler
          </Link>
          <Icon.ChevR size={12} />
          <span className="font-semibold text-lacivert">
            {o.display_name ?? o.email}
          </span>
        </div>

        {/* Header */}
        <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
          <div>
            <Eyebrow>Müşteri 360°</Eyebrow>
            <h1 className="mt-2 text-[26px] md:text-[32px] font-semibold tracking-tight flex items-center gap-3 flex-wrap">
              {o.display_name ?? o.email.split("@")[0]}
              <span
                className={cn(
                  "inline-flex items-center gap-1 h-[26px] px-2.5 rounded-full text-[12px] font-bold",
                  segment.bg,
                  segment.color
                )}
              >
                {segment.emoji} {segment.label}
              </span>
              {isBanned && (
                <span className="inline-flex items-center h-[26px] px-2.5 rounded-full bg-kirmizi/10 text-kirmizi text-[12px] font-bold">
                  🚫 DONDURULMUŞ
                </span>
              )}
              {hasVip && (
                <span className="inline-flex items-center h-[26px] px-2.5 rounded-full bg-sari-soft text-sari-koyu text-[12px] font-bold">
                  ⭐ VIP
                </span>
              )}
            </h1>
            <div className="mt-2 text-[13px] text-gri-700">
              {o.email} · Üye: {timeAgo(o.registered_at)}
              {o.last_sign_in_at && (
                <> · Son giriş: {timeAgo(o.last_sign_in_at)}</>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
          {/* SOL — Profil + KPI + Durum + Aksiyonlar */}
          <div className="space-y-4">
            {/* KPI mini-cards */}
            <Card padding="p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10.5px] uppercase tracking-[0.04em] text-gri-500 font-bold">
                    LTV (Ciro)
                  </div>
                  <div className="text-xl font-bold tabular-nums text-yesil mt-0.5">
                    {fmt(o.total_revenue)} TL
                  </div>
                </div>
                <div>
                  <div className="text-[10.5px] uppercase tracking-[0.04em] text-gri-500 font-bold">
                    AOV (Ort.)
                  </div>
                  <div className="text-xl font-bold tabular-nums text-lacivert mt-0.5">
                    {fmt(o.avg_order)} TL
                  </div>
                </div>
                <div>
                  <div className="text-[10.5px] uppercase tracking-[0.04em] text-gri-500 font-bold">
                    Sipariş
                  </div>
                  <div className="text-xl font-bold tabular-nums text-lacivert mt-0.5">
                    {o.order_count}
                    {o.active_orders > 0 && (
                      <span className="ml-1.5 text-[11px] text-pim-mercan">
                        ({o.active_orders} aktif)
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[10.5px] uppercase tracking-[0.04em] text-gri-500 font-bold">
                    Kontör
                  </div>
                  <div className="text-xl font-bold tabular-nums text-pim-mercan mt-0.5">
                    {fmt(o.total_loyalty_granted)} TL
                  </div>
                </div>
              </div>
            </Card>

            {/* Hesap durumu */}
            <Card padding="p-4">
              <h3 className="font-semibold text-[14px] mb-2.5 text-lacivert">
                Hesap durumu
              </h3>
              <div className="space-y-1.5 text-[12.5px]">
                <StatusRow
                  ok={!!o.email_confirmed_at}
                  label="Email doğrulanmış"
                  hint={
                    o.email_confirmed_at
                      ? fmtDateTime(o.email_confirmed_at)
                      : "Henüz doğrulanmamış"
                  }
                />
                <StatusRow
                  ok={o.has_2fa}
                  label="2FA (TOTP) aktif"
                  hint={o.has_2fa ? "Authenticator app" : "Kapalı"}
                />
                <StatusRow
                  ok={o.marketing_subscribed}
                  label="Pazarlama izni"
                  hint={
                    o.marketing_subscribed
                      ? "Email subscriber"
                      : "Subscribe değil"
                  }
                />
                {o.phone && (
                  <div className="flex items-center justify-between py-1 text-gri-700">
                    <span>📞 Telefon</span>
                    <span className="font-mono text-lacivert">{o.phone}</span>
                  </div>
                )}
                {o.invoice_type && (
                  <div className="flex items-center justify-between py-1 text-gri-700">
                    <span>📄 Fatura</span>
                    <span className="font-semibold text-lacivert">
                      {o.invoice_type === "corporate" ? "Kurumsal" : "Bireysel"}
                    </span>
                  </div>
                )}
              </div>
            </Card>

            {/* Tags */}
            <Card padding="p-4">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="font-semibold text-[14px] text-lacivert">
                  Etiketler
                </h3>
                <button
                  type="button"
                  onClick={() => setModalKind("tag")}
                  className="text-[12px] font-semibold text-pim-mercan hover:underline"
                >
                  + Ekle
                </button>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {data.tags.length === 0 && (
                  <span className="text-[12px] text-gri-500 italic">
                    Henüz etiket yok
                  </span>
                )}
                {data.tags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="inline-flex items-center gap-1 h-[22px] px-2 rounded-full bg-gri-100 text-gri-700 text-[11.5px] font-semibold hover:bg-kirmizi/10 hover:text-kirmizi"
                    title="Tıkla kaldır"
                  >
                    {t} ✕
                  </button>
                ))}
              </div>
            </Card>

            {/* Hızlı aksiyonlar */}
            <Card padding="p-4">
              <h3 className="font-semibold text-[14px] mb-3 text-lacivert">
                ⚡ Hızlı aksiyonlar
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {o.phone && (
                  <>
                    <ActionBtn
                      icon="💬"
                      label="WhatsApp"
                      href={waLink(o.phone)}
                      external
                    />
                    <ActionBtn
                      icon="📞"
                      label="Telefon"
                      href={telLink(o.phone)}
                    />
                  </>
                )}
                <ActionBtn
                  icon="📧"
                  label="Email at"
                  onClick={() => setModalKind("email")}
                />
                <ActionBtn
                  icon="🎁"
                  label="Kontör ver"
                  onClick={() => setModalKind("credit")}
                />
                <ActionBtn
                  icon={hasVip ? "⭐" : "☆"}
                  label={hasVip ? "VIP kaldır" : "VIP işaretle"}
                  onClick={() => void handleVipToggle()}
                  variant={hasVip ? "primary" : "default"}
                />
                <ActionBtn
                  icon="📝"
                  label="Not ekle"
                  onClick={() => setModalKind("note")}
                />
                <ActionBtn
                  icon="🛒"
                  label="Manuel sipariş"
                  href={`/admin/siparis-ekle?user=${o.user_id}`}
                />
                <ActionBtn
                  icon="🔄"
                  label="Şifre sıfır"
                  onClick={() => void handlePasswordReset()}
                />
                <ActionBtn
                  icon={isBanned ? "✓" : "🚫"}
                  label={isBanned ? "Banı kaldır" : "Hesap dondur"}
                  onClick={() => setModalKind("suspend")}
                  variant={isBanned ? "default" : "danger"}
                />
                <ActionBtn
                  icon="🗑"
                  label="KVKK sil"
                  href={`/admin/kvkk-talepleri?user=${o.user_id}`}
                  variant="danger"
                />
              </div>
            </Card>
          </div>

          {/* SAĞ — Activity timeline + Notes + Orders */}
          <div className="space-y-6">
            {/* Recent activity */}
            <Card padding="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-[18px] text-lacivert">
                  📌 Aktivite akışı
                </h2>
                <span className="text-[11.5px] text-gri-500">
                  Son {data.recent_activity.length} olay
                </span>
              </div>
              {data.recent_activity.length === 0 ? (
                <div className="text-center py-8 text-[13px] text-gri-500 italic">
                  Henüz hiç aktivite yok
                </div>
              ) : (
                <ol className="relative space-y-3">
                  <span
                    aria-hidden
                    className="absolute left-[14px] top-2 bottom-2 w-px bg-gri-200"
                  />
                  {data.recent_activity.map((a, i) => (
                    <li key={`${a.ref_id}-${i}`} className="relative pl-10">
                      <span
                        aria-hidden
                        className="absolute left-2 top-1.5 grid place-items-center w-6 h-6 rounded-full bg-white ring-2 ring-gri-200 text-[12px]"
                      >
                        {a.emoji}
                      </span>
                      <div className="rounded-lg bg-gri-50 p-3">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <span className="font-semibold text-[12.5px] text-lacivert">
                            {a.title}
                          </span>
                          <span className="text-[11px] text-gri-500">
                            {timeAgo(a.created_at)}
                          </span>
                        </div>
                        {a.detail && (
                          <div className="text-[12px] text-gri-700 mt-1 leading-relaxed line-clamp-3">
                            {a.detail}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            {/* Internal notes */}
            <Card padding="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-[18px] text-lacivert">
                  📝 Internal notlar
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setModalKind("note")}
                >
                  + Yeni not
                </Button>
              </div>
              {data.notes.length === 0 ? (
                <div className="text-center py-6 text-[13px] text-gri-500 italic">
                  Operatör notu yok. "+ Yeni not" ile ekle.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {data.notes.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        "rounded-lg p-3.5 ring-1",
                        n.pinned
                          ? "bg-pim-mercan-tint/30 ring-pim-mercan-soft"
                          : "bg-gri-50 ring-gri-200"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <div className="text-[11px] text-gri-500">
                          {n.pinned && (
                            <span className="text-pim-mercan font-bold mr-1.5">
                              📌
                            </span>
                          )}
                          {n.author_name ?? "admin"} ·{" "}
                          {fmtDateTime(n.created_at)}
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeleteNote(n.id)}
                          className="text-[11px] text-gri-500 hover:text-kirmizi"
                          aria-label="Notu sil"
                        >
                          🗑
                        </button>
                      </div>
                      <div className="text-[13px] text-lacivert whitespace-pre-wrap leading-relaxed">
                        {n.body}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Son siparişler */}
            {data.orders.length > 0 && (
              <Card padding="p-5">
                <h2 className="font-semibold text-[18px] text-lacivert mb-4">
                  🛒 Son siparişler
                </h2>
                <div className="space-y-2">
                  {data.orders.map((o) => (
                    <Link
                      key={o.id}
                      href={`/admin/siparisler/${o.id}`}
                      className="block rounded-lg bg-gri-50 ring-1 ring-gri-200 p-3 hover:ring-pim-mercan hover:-translate-y-0.5 transition-all"
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <div className="font-mono font-semibold text-[12.5px] text-lacivert">
                            {o.id}
                          </div>
                          <div className="text-[11px] text-gri-500 mt-0.5">
                            {fmtDateTime(o.created_at)} · {o.items_count} kalem
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold tabular-nums">
                            {fmt(o.total)} TL
                          </div>
                          <div className="text-[10.5px] text-gri-500 uppercase tracking-[0.04em] mt-0.5">
                            {o.status}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Modallar */}
      {modalKind === "note" && (
        <NoteModal
          onClose={() => setModalKind(null)}
          onSave={(body, pinned) => void handleNote(body, pinned)}
        />
      )}
      {modalKind === "email" && (
        <EmailModal
          email={o.email}
          onClose={() => setModalKind(null)}
          onSave={(sub, body) => void handleEmail(sub, body)}
        />
      )}
      {modalKind === "credit" && (
        <CreditModal
          onClose={() => setModalKind(null)}
          onSave={(amount, reason) => void handleCredit(amount, reason)}
        />
      )}
      {modalKind === "tag" && (
        <TagModal
          existing={data.tags}
          onClose={() => setModalKind(null)}
          onSave={(tag) => void handleTag(tag)}
        />
      )}
      {modalKind === "suspend" && (
        <SuspendModal
          currentlyBanned={!!isBanned}
          onClose={() => setModalKind(null)}
          onSave={(until, reason) => void handleSuspend(until, reason)}
        />
      )}
    </main>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function StatusRow({
  ok,
  label,
  hint,
}: {
  ok: boolean;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-1.5">
        <span className={ok ? "text-yesil" : "text-gri-500"}>
          {ok ? "✓" : "✗"}
        </span>
        <span className="text-gri-700">{label}</span>
      </div>
      <span className="text-[11px] text-gri-500">{hint}</span>
    </div>
  );
}

interface ActionBtnProps {
  icon: string;
  label: string;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  variant?: "default" | "primary" | "danger";
}

function ActionBtn({
  icon,
  label,
  onClick,
  href,
  external,
  variant = "default",
}: ActionBtnProps) {
  const cls = cn(
    "inline-flex items-center gap-1.5 h-10 px-2.5 rounded-lg text-[12px] font-semibold transition-all justify-start",
    "ring-1 hover:-translate-y-0.5",
    variant === "primary" &&
      "bg-pim-mercan-tint ring-pim-mercan text-pim-mercan",
    variant === "danger" && "bg-white ring-gri-200 text-kirmizi hover:ring-kirmizi",
    variant === "default" && "bg-white ring-gri-200 text-lacivert hover:ring-pim-mercan"
  );
  if (href) {
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className={cls}
      >
        <span className="text-[14px]">{icon}</span>
        <span className="truncate">{label}</span>
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      <span className="text-[14px]">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

// Modal wrapper ===============================================================

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      <Card
        padding="p-6"
        className="max-w-[520px] w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[18px] font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gri-500 hover:text-lacivert text-[18px]"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>
        {children}
      </Card>
    </div>
  );
}

function NoteModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (body: string, pinned: boolean) => void;
}) {
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  return (
    <ModalShell title="📝 Yeni internal not" onClose={onClose}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={6}
        placeholder="Bu müşteri için içsel not yaz (sadece operatörler görür)..."
        className="w-full px-3 py-2.5 rounded-[12px] bg-white ring-1 ring-gri-200 text-[14px] focus:outline-none focus:ring-pim-mercan resize-none"
      />
      <label className="flex items-center gap-2 mt-3 text-[13px] cursor-pointer">
        <input
          type="checkbox"
          checked={pinned}
          onChange={(e) => setPinned(e.target.checked)}
          className="accent-pim-mercan w-4 h-4"
        />
        📌 Üstte sabitle
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          İptal
        </Button>
        <Button
          variant="primary"
          onClick={() => onSave(body, pinned)}
          disabled={body.trim().length < 2}
        >
          Kaydet
        </Button>
      </div>
    </ModalShell>
  );
}

function EmailModal({
  email,
  onClose,
  onSave,
}: {
  email: string;
  onClose: () => void;
  onSave: (subject: string, body: string) => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  return (
    <ModalShell title="📧 Email gönder" onClose={onClose}>
      <div className="text-[12px] text-gri-700 mb-3">
        Alıcı: <strong className="text-lacivert">{email}</strong>
      </div>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Konu (2-120 karakter)"
        className="w-full px-3 h-11 rounded-[12px] bg-white ring-1 ring-gri-200 text-[14px] focus:outline-none focus:ring-pim-mercan mb-3"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={8}
        placeholder="Mesajın..."
        className="w-full px-3 py-2.5 rounded-[12px] bg-white ring-1 ring-gri-200 text-[14px] focus:outline-none focus:ring-pim-mercan resize-none"
      />
      <div className="mt-3 text-[11.5px] text-gri-500 italic">
        ℹ Mail outbox'a düşer, cron 5dk içinde Resend ile gönderir. Customer
        notes'a da log atılır.
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          İptal
        </Button>
        <Button
          variant="primary"
          onClick={() => onSave(subject, body)}
          disabled={subject.trim().length < 2 || body.trim().length < 10}
        >
          Gönder
        </Button>
      </div>
    </ModalShell>
  );
}

function CreditModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (amount: number, reason: string) => void;
}) {
  const [amount, setAmount] = useState(50);
  const [reason, setReason] = useState("");
  const PRESETS = [10, 25, 50, 100, 250];
  return (
    <ModalShell title="🎁 Kontör ver" onClose={onClose}>
      <div className="text-[12.5px] font-semibold text-gri-700 mb-2">
        Miktar (TL)
      </div>
      <div className="flex gap-2 flex-wrap mb-3">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setAmount(p)}
            className={cn(
              "px-3 h-10 rounded-full text-[13px] font-semibold transition-colors",
              amount === p
                ? "bg-pim-mercan text-white"
                : "bg-gri-100 text-gri-700 hover:bg-gri-200"
            )}
          >
            {p} TL
          </button>
        ))}
      </div>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        min={1}
        max={1000}
        className="w-full px-3 h-11 rounded-[12px] bg-white ring-1 ring-gri-200 text-[14px] focus:outline-none focus:ring-pim-mercan mb-3 tabular-nums"
      />
      <div className="text-[12.5px] font-semibold text-gri-700 mb-2">
        Sebep
      </div>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Örn: doğum günü hediyesi, şikayet özür, kampanya"
        className="w-full px-3 h-11 rounded-[12px] bg-white ring-1 ring-gri-200 text-[14px] focus:outline-none focus:ring-pim-mercan"
      />
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          İptal
        </Button>
        <Button
          variant="primary"
          onClick={() => onSave(amount, reason)}
          disabled={
            amount < 1 || amount > 1000 || reason.trim().length < 2
          }
        >
          {amount} TL ver
        </Button>
      </div>
    </ModalShell>
  );
}

function TagModal({
  existing,
  onClose,
  onSave,
}: {
  existing: string[];
  onClose: () => void;
  onSave: (tag: string) => void;
}) {
  const [tag, setTag] = useState("");
  const SUGGESTED = ["vip", "b2b", "ozel-ilgi", "iade-riski", "kurumsal"];
  const filtered = SUGGESTED.filter((s) => !existing.includes(s));
  return (
    <ModalShell title="🏷 Etiket ekle" onClose={onClose}>
      <input
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        placeholder="Etiket adı (2-40 karakter)"
        className="w-full px-3 h-11 rounded-[12px] bg-white ring-1 ring-gri-200 text-[14px] focus:outline-none focus:ring-pim-mercan"
      />
      {filtered.length > 0 && (
        <>
          <div className="mt-3 text-[12px] text-gri-500">Önerilen:</div>
          <div className="flex gap-1.5 flex-wrap mt-1.5">
            {filtered.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setTag(s)}
                className="inline-flex items-center h-[24px] px-2.5 rounded-full bg-gri-100 text-gri-700 text-[11.5px] font-semibold hover:bg-pim-mercan-tint"
              >
                + {s}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          İptal
        </Button>
        <Button
          variant="primary"
          onClick={() => onSave(tag)}
          disabled={tag.trim().length < 2}
        >
          Ekle
        </Button>
      </div>
    </ModalShell>
  );
}

function SuspendModal({
  currentlyBanned,
  onClose,
  onSave,
}: {
  currentlyBanned: boolean;
  onClose: () => void;
  onSave: (until: "permanent" | null, reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <ModalShell
      title={currentlyBanned ? "✓ Hesap dondurma kaldır" : "🚫 Hesap dondur"}
      onClose={onClose}
    >
      <p className="text-[13px] text-gri-700 leading-relaxed mb-3">
        {currentlyBanned
          ? "Bu hesabın dondurulmasını kaldıracak — kullanıcı tekrar login olabilir."
          : "Hesabı dondurur — kullanıcı login olamaz. Reversible (geri açılabilir). Hesap silme YERINE bunu tercih et (KVKK m.11/e 30 günlük geri alma penceresi)."}
      </p>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Sebep (2-200 karakter)"
        className="w-full px-3 h-11 rounded-[12px] bg-white ring-1 ring-gri-200 text-[14px] focus:outline-none focus:ring-pim-mercan"
      />
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          İptal
        </Button>
        <Button
          variant="primary"
          onClick={() =>
            onSave(currentlyBanned ? null : "permanent", reason)
          }
          disabled={reason.trim().length < 2}
        >
          {currentlyBanned ? "Banı kaldır" : "Hesabı dondur"}
        </Button>
      </div>
    </ModalShell>
  );
}
