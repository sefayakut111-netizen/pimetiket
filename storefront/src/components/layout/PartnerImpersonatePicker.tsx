/**
 * Pim Etiket — Partner Impersonate Picker
 * Sefa 23 May v68
 *
 * AdminShell topbar/sidebar "Partner görünümü" butonu için modal'lı seçici.
 * Tıklanınca tüm partner kayıtları listelenir, seçilince magic-link
 * üretilip yeni sekmede partner panelinde otomatik login olunur.
 *
 * Akış:
 *   1. Trigger button click → modal aç
 *   2. GET /api/admin/fason/partners → liste
 *   3. Search box + scrollable list
 *   4. Item click → POST /api/admin/impersonate/partner
 *   5. Response.url window.open ile yeni sekmede
 *
 * Görünüm: "Müşteri görünümü" rozeti ile aynı stil — tutarlılık.
 */

"use client";

import { useEffect, useState } from "react";

interface PartnerListItem {
  id: string;
  name: string;
  short_name?: string | null;
  city?: string | null;
  status?: "active" | "paused" | "terminated";
  contact_email: string;
}

interface ApiResp {
  partners?: PartnerListItem[];
  error?: string;
}

export function PartnerImpersonatePicker({
  variant,
}: {
  variant: "topbar" | "sidebar";
}) {
  const [open, setOpen] = useState(false);
  const [partners, setPartners] = useState<PartnerListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || partners.length > 0 || loading) return;
    setLoading(true);
    setError(null);
    void fetch("/api/admin/fason/partners", { cache: "no-store" })
      .then((r) => r.json() as Promise<ApiResp>)
      .then((j) => {
        if (j.error) {
          setError(j.error);
          return;
        }
        setPartners(j.partners ?? []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Bilinmeyen hata");
      })
      .finally(() => setLoading(false));
  }, [open, partners.length, loading]);

  // ESC ile modal kapat
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  async function handlePick(partner: PartnerListItem) {
    if (impersonatingId) return;
    if (
      !confirm(
        `${partner.name} olarak partner panelini açacaksın.\n\nUYARI: Magic-link aynı tarayıcı session'ını override edebilir. Admin oturumunu korumak için INCOGNITO PENCEREDE açılan URL'i yapıştırman önerilir.\n\nDevam edilsin mi?`
      )
    )
      return;
    setImpersonatingId(partner.id);
    try {
      const res = await fetch("/api/admin/impersonate/partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partner_id: partner.id }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        url?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok || !j.ok || !j.url) {
        alert(
          "Impersonation hatası: " +
            (j.message ?? j.error ?? `HTTP ${res.status}`)
        );
        return;
      }
      window.open(j.url, "_blank", "noopener,noreferrer");
      setOpen(false);
    } catch (err) {
      alert("Hata: " + (err instanceof Error ? err.message : "Bilinmeyen"));
    } finally {
      setImpersonatingId(null);
    }
  }

  const filtered = query
    ? partners.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          (p.short_name ?? "").toLowerCase().includes(query.toLowerCase()) ||
          (p.city ?? "").toLowerCase().includes(query.toLowerCase()) ||
          p.contact_email.toLowerCase().includes(query.toLowerCase())
      )
    : partners;

  // Tetik buton — variant'a göre stil
  const triggerCls =
    variant === "topbar"
      ? "hidden md:inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-lacivert/10 text-lacivert text-[12.5px] font-semibold hover:bg-lacivert/15 transition-colors"
      : "w-full flex items-center gap-2 h-9 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[12.5px] font-semibold transition-colors";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerCls}
        title="Bir partner seç ve panelini incele"
      >
        <span aria-hidden>📦</span>
        Partner görünümü
        {variant === "sidebar" && (
          <span className="ml-auto opacity-70" aria-hidden>
            →
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 p-4 pt-[10vh] backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gri-200 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-lacivert">
                  📦 Partner Görünümü Seç
                </h2>
                <p className="mt-0.5 text-[12px] text-gri-700">
                  Hangi partnerin paneline geçmek istersin?
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gri-700 hover:text-lacivert text-xl leading-none"
                aria-label="Kapat"
              >
                ×
              </button>
            </div>

            <div className="p-4">
              <input
                type="search"
                placeholder="Ada, şehre, e-postaya göre ara..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="mb-3 w-full rounded-lg border border-gri-200 px-3 py-2 text-sm"
                autoFocus
              />

              {loading ? (
                <div className="py-8 text-center text-sm text-gri-700">
                  Yükleniyor...
                </div>
              ) : error ? (
                <div className="rounded-lg bg-kirmizi-soft p-4 text-sm text-kirmizi">
                  Hata: {error}
                </div>
              ) : partners.length === 0 ? (
                <div className="py-8 text-center text-sm text-gri-700">
                  Hiç partner kaydı bulunamadı.
                  <br />
                  <a
                    href="/admin/fason/yeni"
                    className="mt-2 inline-block font-semibold text-pim-mercan hover:underline"
                  >
                    Yeni partner ekle →
                  </a>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-6 text-center text-sm text-gri-700">
                  "{query}" için sonuç yok.
                </div>
              ) : (
                <ul className="max-h-[50vh] divide-y divide-gri-100 overflow-y-auto rounded-lg border border-gri-200">
                  {filtered.map((p) => {
                    const isBusy = impersonatingId === p.id;
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => handlePick(p)}
                          disabled={!!impersonatingId}
                          className="block w-full px-4 py-3 text-left hover:bg-gri-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold text-sm text-lacivert truncate">
                                {p.name}
                                {p.city && (
                                  <span className="ml-2 text-[11px] font-normal text-gri-700">
                                    · {p.city}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-gri-700 truncate">
                                {p.contact_email}
                              </div>
                            </div>
                            <div className="text-[11px] font-semibold text-pim-mercan shrink-0">
                              {isBusy ? "Açılıyor..." : "Aç ▶"}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <p className="mt-3 text-[11px] text-gri-700">
                💡 <strong>Önerim:</strong> Önce yeni bir <kbd>Incognito</kbd>{" "}
                penceresi aç, oraya açılan URL'i yapıştır — admin oturumunu
                korumak için.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
