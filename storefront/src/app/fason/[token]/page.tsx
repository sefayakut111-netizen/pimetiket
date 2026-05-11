/**
 * /fason/[token] — Fason web form (public, token-auth)
 *
 * Mobile-first, font 16px+, kontrast yüksek (50+ yaş ustası kullanır).
 * Pim Etiket logo üstte ama mascot YOK (operasyonel sayfa).
 *
 * Akış:
 *   1. /api/fason/info/[token] çağır → sipariş özeti
 *   2. Tasarım dosyasını indir (1 buton)
 *   3. Durum güncelle: Aldım / Üretimde / Hazır / Kargoya verdim / Bir terslik var
 *   4. "Bir terslik var" → kategori seç + açıklama + opsiyonel foto
 *   5. Kargoya verdim → kargo firma + takip no
 */

"use client";

import { use, useEffect, useState } from "react";
import {
  FASON_ACTION_LABELS,
  ISSUE_CATEGORIES,
  type IssueCategory,
} from "@/lib/fason/status-labels";

interface OrderInfo {
  assignment: {
    id: string;
    status: string;
    estimated_delivery: string | null;
    notes: string | null;
    assigned_at: string;
    acknowledged_at: string | null;
    in_production_at: string | null;
    ready_at: string | null;
    shipped_at: string | null;
    tracking_company: string | null;
    tracking_number: string | null;
  };
  order: {
    id: string;
    address: { name: string; addr: string; city: string; phone: string };
    created_at: string;
  };
  items: Array<{
    product: string;
    title: string;
    config: string;
    width: number;
    height: number;
    qty: number;
    meta: Record<string, unknown>;
  }>;
  fasonName: string | null;
  downloadUrl: string;
}

type ViewState = "loading" | "ready" | "issue-form" | "shipping-form" | "done" | "error";

export default function FasonOrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [info, setInfo] = useState<OrderInfo | null>(null);
  const [view, setView] = useState<ViewState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Issue form
  const [issueCategory, setIssueCategory] = useState<IssueCategory>("dosya");
  const [issueDescription, setIssueDescription] = useState("");

  // Shipping form
  const [trackingCompany, setTrackingCompany] = useState("Yurtiçi Kargo");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");

  // Load info
  useEffect(() => {
    fetch(`/api/fason/info/${token}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          setError(j.error ?? "Erişim sağlanamadı");
          setView("error");
          return null;
        }
        return r.json();
      })
      .then((data: OrderInfo | null) => {
        if (data) {
          setInfo(data);
          setView("ready");
        }
      })
      .catch(() => {
        setError("Bağlantı hatası");
        setView("error");
      });
  }, [token]);

  const doAction = async (
    action: "acknowledge" | "in_production" | "ready" | "shipped" | "issue",
    extra?: Record<string, unknown>
  ) => {
    setBusy(true);
    try {
      const res = await fetch("/api/fason/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action, ...extra }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "Güncelleme başarısız");
        return;
      }
      // Refresh info
      const refreshed = await fetch(`/api/fason/info/${token}`, {
        cache: "no-store",
      });
      if (refreshed.ok) {
        const data = (await refreshed.json()) as OrderInfo;
        setInfo(data);
        setView(action === "shipped" ? "done" : "ready");
        setIssueDescription("");
      }
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setBusy(false);
    }
  };

  if (view === "loading") {
    return (
      <main className="min-h-screen bg-krem grid place-items-center p-6">
        <div className="text-lacivert text-[16px]">Yükleniyor…</div>
      </main>
    );
  }

  if (view === "error" || !info) {
    return (
      <main className="min-h-screen bg-krem grid place-items-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-[420px] text-center shadow-2">
          <div className="text-[48px] mb-3">⚠️</div>
          <h1 className="text-[20px] font-bold text-lacivert mb-2">
            Erişim sağlanamadı
          </h1>
          <p className="text-[15px] text-gri-700 leading-relaxed mb-4">
            {error ?? "Link süresi dolmuş veya geçersiz olabilir."}
          </p>
          <p className="text-[13px] text-gri-500">
            Sefa&apos;ya yaz: info@pimetiket.com
          </p>
        </div>
      </main>
    );
  }

  const item = info.items[0];
  const status = info.assignment.status;
  const acknowledged = !!info.assignment.acknowledged_at;

  return (
    <main className="min-h-screen bg-krem">
      {/* Header */}
      <header className="bg-lacivert text-white p-5 shadow-1">
        <div className="max-w-[600px] mx-auto flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] text-white/60">
              Pim Etiket
            </div>
            <div className="text-[16px] font-bold mt-0.5">
              {info.fasonName ?? "Fason ortağı"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-white/60">Sipariş</div>
            <div className="font-mono font-bold text-[15px]">{info.order.id}</div>
          </div>
        </div>
      </header>

      <div className="max-w-[600px] mx-auto p-5 space-y-5">
        {/* Sipariş Özeti */}
        <section className="bg-white rounded-2xl p-5 shadow-1 ring-1 ring-gri-200">
          <h2 className="text-[16px] font-bold text-lacivert mb-3">
            🎨 İş detayı
          </h2>
          <div className="space-y-2 text-[15px]">
            {info.items.map((it, i) => (
              <div key={i} className="border-b border-gri-100 pb-2 last:border-0">
                <div className="font-semibold">{it.title}</div>
                <div className="text-gri-700 text-[14px]">{it.config}</div>
                <div className="text-pim-mercan font-bold mt-1">
                  {it.width}×{it.height} mm · {it.qty.toLocaleString("tr-TR")} adet
                </div>
              </div>
            ))}
          </div>
          {info.assignment.notes && (
            <div className="mt-3 p-3 bg-sari-soft text-[14px] rounded-lg">
              📝 <strong>Not:</strong> {info.assignment.notes}
            </div>
          )}
          {info.assignment.estimated_delivery && (
            <div className="mt-3 text-[14px] text-gri-700">
              📅 Teslim tarihi:{" "}
              <strong className="text-lacivert">
                {new Date(info.assignment.estimated_delivery).toLocaleDateString(
                  "tr-TR",
                  { day: "numeric", month: "long", year: "numeric" }
                )}
              </strong>
            </div>
          )}
        </section>

        {/* Kargo Adresi */}
        <section className="bg-white rounded-2xl p-5 shadow-1 ring-1 ring-gri-200">
          <h2 className="text-[16px] font-bold text-lacivert mb-3">
            📍 Kargo adresi
          </h2>
          <div className="text-[15px] leading-relaxed">
            <div className="font-semibold">{info.order.address.name}</div>
            <div className="text-gri-700">{info.order.address.addr}</div>
            <div className="text-gri-700">{info.order.address.city}</div>
            <div className="text-gri-700 mt-1">
              📞 {info.order.address.phone}
            </div>
          </div>
        </section>

        {/* Tasarım dosyası indir */}
        <section className="bg-white rounded-2xl p-5 shadow-1 ring-1 ring-gri-200">
          <h2 className="text-[16px] font-bold text-lacivert mb-3">
            📎 Tasarım dosyası
          </h2>
          <a
            href={info.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center bg-pim-mercan hover:bg-[#E63E40] text-white font-bold text-[17px] py-4 rounded-xl transition-colors min-h-[56px]"
          >
            Dosyayı indir
          </a>
          <p className="text-[13px] text-gri-500 mt-3">
            Her tıklama loglanır. Sadece bu sipariş için kullan, başkasıyla paylaşma.
          </p>
        </section>

        {/* Durum güncelleme butonları */}
        {view === "ready" && (
          <section className="bg-white rounded-2xl p-5 shadow-1 ring-1 ring-gri-200">
            <h2 className="text-[16px] font-bold text-lacivert mb-1">
              🔧 Durum güncelle
            </h2>
            <p className="text-[13px] text-gri-700 mb-4">
              Şu anki durum:{" "}
              <strong className="text-pim-mercan">{status}</strong>
            </p>

            <div className="space-y-2.5">
              {!acknowledged && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => doAction("acknowledge")}
                  className="w-full bg-pim-mercan-tint text-pim-mercan font-bold text-[16px] py-4 rounded-xl min-h-[56px] disabled:opacity-50"
                >
                  ✓ {FASON_ACTION_LABELS.acknowledge}
                </button>
              )}

              {status !== "in_production" && status !== "ready" && status !== "shipped" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => doAction("in_production")}
                  className="w-full bg-yesil-soft text-yesil font-bold text-[16px] py-4 rounded-xl min-h-[56px] disabled:opacity-50"
                >
                  🔨 {FASON_ACTION_LABELS.inProduction}
                </button>
              )}

              {status === "in_production" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => doAction("ready")}
                  className="w-full bg-yesil text-white font-bold text-[16px] py-4 rounded-xl min-h-[56px] disabled:opacity-50"
                >
                  📦 {FASON_ACTION_LABELS.ready}
                </button>
              )}

              {status === "ready" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setView("shipping-form")}
                  className="w-full bg-lacivert text-white font-bold text-[16px] py-4 rounded-xl min-h-[56px] disabled:opacity-50"
                >
                  🚚 {FASON_ACTION_LABELS.shipped}
                </button>
              )}

              {status !== "shipped" && status !== "issue" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setView("issue-form")}
                  className="w-full bg-kirmizi/10 text-kirmizi font-bold text-[16px] py-4 rounded-xl min-h-[56px] disabled:opacity-50"
                >
                  ⚠️ {FASON_ACTION_LABELS.issue}
                </button>
              )}
            </div>
          </section>
        )}

        {/* Issue form */}
        {view === "issue-form" && (
          <section className="bg-white rounded-2xl p-5 shadow-1 ring-1 ring-kirmizi/30">
            <h2 className="text-[16px] font-bold text-kirmizi mb-2">
              ⚠️ Bir terslik var
            </h2>
            <p className="text-[14px] text-gri-700 mb-4">
              Ne oldu, sence nasıl çözeriz?
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[14px] font-semibold text-lacivert mb-2">
                  Kategori:
                </label>
                <div className="space-y-2">
                  {ISSUE_CATEGORIES.map((cat) => (
                    <label
                      key={cat.id}
                      className="flex items-center gap-3 p-3 border-2 border-gri-200 rounded-xl cursor-pointer hover:border-pim-mercan"
                    >
                      <input
                        type="radio"
                        name="category"
                        value={cat.id}
                        checked={issueCategory === cat.id}
                        onChange={(e) =>
                          setIssueCategory(e.target.value as IssueCategory)
                        }
                        className="w-5 h-5 accent-pim-mercan"
                      />
                      <span className="text-[15px]">{cat.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[14px] font-semibold text-lacivert mb-2">
                  Açıklama:
                </label>
                <textarea
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  rows={4}
                  placeholder="Ne olduğunu, mümkünse nasıl çözüleceğini anlat..."
                  className="w-full p-3 text-[15px] border-2 border-gri-200 rounded-xl focus:border-pim-mercan focus:outline-none min-h-[120px]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setView("ready")}
                  disabled={busy}
                  className="flex-1 bg-gri-100 text-gri-700 font-bold py-4 rounded-xl min-h-[56px]"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  disabled={busy || issueDescription.trim().length < 5}
                  onClick={() =>
                    doAction("issue", {
                      issue: {
                        category: issueCategory,
                        description: issueDescription.trim(),
                      },
                    })
                  }
                  className="flex-1 bg-kirmizi text-white font-bold py-4 rounded-xl min-h-[56px] disabled:opacity-50"
                >
                  Sefa&apos;ya bildir
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Shipping form */}
        {view === "shipping-form" && (
          <section className="bg-white rounded-2xl p-5 shadow-1 ring-1 ring-lacivert/30">
            <h2 className="text-[16px] font-bold text-lacivert mb-2">
              🚚 Kargo bilgisi
            </h2>
            <p className="text-[14px] text-gri-700 mb-4">
              Kargo bilgisini gir, müşteriye takip linki yollayayım.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[14px] font-semibold text-lacivert mb-2">
                  Kargo firması:
                </label>
                <select
                  value={trackingCompany}
                  onChange={(e) => setTrackingCompany(e.target.value)}
                  className="w-full p-4 text-[16px] border-2 border-gri-200 rounded-xl focus:border-pim-mercan focus:outline-none"
                >
                  <option>Yurtiçi Kargo</option>
                  <option>Aras Kargo</option>
                  <option>MNG Kargo</option>
                  <option>PTT Kargo</option>
                  <option>Sürat Kargo</option>
                  <option>HepsiJet</option>
                  <option>Trendyol Express</option>
                </select>
              </div>

              <div>
                <label className="block text-[14px] font-semibold text-lacivert mb-2">
                  Takip numarası:
                </label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value.trim())}
                  placeholder="örn. 1234567890"
                  className="w-full p-4 text-[16px] border-2 border-gri-200 rounded-xl focus:border-pim-mercan focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[14px] font-semibold text-lacivert mb-2">
                  Takip linki <span className="text-gri-500">(varsa)</span>:
                </label>
                <input
                  type="url"
                  value={trackingUrl}
                  onChange={(e) => setTrackingUrl(e.target.value.trim())}
                  placeholder="https://..."
                  className="w-full p-4 text-[16px] border-2 border-gri-200 rounded-xl focus:border-pim-mercan focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setView("ready")}
                  disabled={busy}
                  className="flex-1 bg-gri-100 text-gri-700 font-bold py-4 rounded-xl min-h-[56px]"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  disabled={busy || trackingNumber.length < 3}
                  onClick={() =>
                    doAction("shipped", {
                      tracking: {
                        company: trackingCompany,
                        number: trackingNumber,
                        url: trackingUrl || undefined,
                      },
                    })
                  }
                  className="flex-1 bg-yesil text-white font-bold py-4 rounded-xl min-h-[56px] disabled:opacity-50"
                >
                  Kargoyu kaydet
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Done */}
        {view === "done" && (
          <section className="bg-yesil-soft rounded-2xl p-6 text-center shadow-1 ring-1 ring-yesil/30">
            <div className="text-[48px] mb-3">✅</div>
            <h2 className="text-[20px] font-bold text-yesil mb-2">
              Tamam, kargo kaydı yapıldı
            </h2>
            <p className="text-[15px] text-yesil/80">
              Sefa müşteriye kargo bilgisini yollayacak. Eline sağlık!
            </p>
          </section>
        )}

        {/* Footer info */}
        <footer className="text-center text-[12px] text-gri-500 py-4">
          Sorun olursa Sefa&apos;ya yaz: info@pimetiket.com
          <br />
          Bu sayfa sadece sana özel — başkasıyla paylaşma.
        </footer>
      </div>
    </main>
  );
}
