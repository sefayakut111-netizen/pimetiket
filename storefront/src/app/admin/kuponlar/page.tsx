/**
 * Pim Etiket — /admin/kuponlar
 *
 * Promo kodu yönetimi: kod, indirim tipi (%/₺), eşik, kullanım limiti,
 * tarih aralığı, aktif/pasif.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Input, Eyebrow, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { LineChart, BarChart } from "@/components/charts";

const STORAGE_KEY = "pim_coupons_v1";

type DiscountType = "percent" | "fixed";

interface Coupon {
  id: string;
  code: string;
  type: DiscountType;
  /** percent: 0-100, fixed: ₺ */
  value: number;
  /** Minimum sepet eşiği (₺) */
  minSubtotal: number;
  /** Maksimum kullanım sayısı (null = sınırsız) */
  maxUses: number | null;
  usedCount: number;
  validFrom: string;
  validTo: string;
  active: boolean;
  createdAt: number;
}

interface CouponAnalytics {
  totalUsage: number;
  totalDiscount: number;
  topCoupons: Array<{
    code: string;
    usedCount: number;
    totalDiscount: number;
  }>;
  usageTrend: Array<{
    date: string;
    count: number;
    discount: number;
  }>;
}

export default function AdminKuponlarPage() {
  const toast = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [analytics, setAnalytics] = useState<CouponAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Coupon>({
    id: "",
    code: "",
    type: "percent",
    value: 10,
    minSubtotal: 0,
    maxUses: null,
    usedCount: 0,
    validFrom: new Date().toISOString().slice(0, 10),
    validTo: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
    active: true,
    createdAt: Date.now(),
  });

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/coupons", { cache: "no-store" });
      const j = (await r.json()) as {
        ok?: boolean;
        coupons?: Coupon[];
        analytics?: CouponAnalytics;
        error?: string;
      };
      if (j.ok && j.coupons) {
        setCoupons(j.coupons);
        setAnalytics(j.analytics ?? null);
      } else if (!r.ok) {
        toast.error(j.error ?? "Kuponlar yüklenemedi");
      }
    } catch {
      toast.error("Ağ hatası");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchCoupons();
  }, [fetchCoupons]);

  useEffect(() => {
    const local = localStorage.getItem(STORAGE_KEY);
    if (!local) return;

    void (async () => {
      try {
        const parsed = JSON.parse(local) as Coupon[];
        const r = await fetch("/api/admin/coupons/migrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coupons: parsed }),
        });
        const j = (await r.json()) as { ok?: boolean; migrated?: number };
        if (j.ok) {
          localStorage.removeItem(STORAGE_KEY);
          if ((j.migrated ?? 0) > 0) {
            toast.success(`${j.migrated} kupon DB'ye aktarıldı`);
            await fetchCoupons();
          }
        }
      } catch {
        /* sessiz */
      }
    })();
  }, [fetchCoupons, toast]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.code.trim()) {
      toast.error("Kod boş olamaz");
      return;
    }
    const code = draft.code
      .trim()
      .toLocaleUpperCase("tr-TR")
      .replace(/\s+/g, "");
    if (coupons.some((c) => c.code === code)) {
      toast.error("Bu kod zaten var");
      return;
    }

    try {
      const r = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          type: draft.type,
          value: draft.value,
          minSubtotal: draft.minSubtotal,
          maxUses: draft.maxUses,
          validFrom: draft.validFrom,
          validTo: draft.validTo,
        }),
      });
      const j = (await r.json()) as { ok?: boolean; coupon?: Coupon; error?: string };
      if (!j.ok || !j.coupon) {
        toast.error(j.error ?? "Oluşturulamadı");
        return;
      }
      setCoupons((prev) => [j.coupon!, ...prev]);
      toast.success(`${code} oluşturuldu`);
      setShowForm(false);
      setDraft({
        id: "",
        code: "",
        type: "percent",
        value: 10,
        minSubtotal: 0,
        maxUses: null,
        usedCount: 0,
        validFrom: new Date().toISOString().slice(0, 10),
        validTo: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
        active: true,
        createdAt: Date.now(),
      });
    } catch {
      toast.error("Ağ hatası");
    }
  };

  const toggleActive = async (id: string) => {
    const current = coupons.find((c) => c.id === id);
    if (!current) return;

    try {
      const r = await fetch("/api/admin/coupons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active: !current.active }),
      });
      const j = (await r.json()) as { ok?: boolean; coupon?: Coupon; error?: string };
      if (!j.ok || !j.coupon) {
        toast.error(j.error ?? "Güncellenemedi");
        return;
      }
      setCoupons((prev) => prev.map((c) => (c.id === id ? j.coupon! : c)));
    } catch {
      toast.error("Ağ hatası");
    }
  };

  const remove = async (c: Coupon) => {
    if (!confirm(`${c.code} silinsin mi?`)) return;

    try {
      const r = await fetch(`/api/admin/coupons?id=${encodeURIComponent(c.id)}`, {
        method: "DELETE",
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!j.ok) {
        toast.error(j.error ?? "Silinemedi");
        return;
      }
      setCoupons((prev) => prev.filter((x) => x.id !== c.id));
      toast.info(`${c.code} silindi`);
    } catch {
      toast.error("Ağ hatası");
    }
  };

  const topPopularCode = useMemo(() => {
    if (analytics?.topCoupons[0]?.code) return analytics.topCoupons[0].code;
    const sorted = [...coupons].sort((a, b) => b.usedCount - a.usedCount);
    return sorted[0]?.code ?? "—";
  }, [analytics, coupons]);

  const trendPoints = useMemo(
    () =>
      (analytics?.usageTrend ?? []).map((d) => ({
        x: d.date.slice(5),
        y: d.count,
      })),
    [analytics]
  );

  const topBarData = useMemo(
    () =>
      (analytics?.topCoupons ?? []).map((c) => ({
        label: c.code,
        value: c.usedCount,
      })),
    [analytics]
  );

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1080px] px-6">
        <div className="flex items-end justify-between gap-6 mb-7 flex-wrap">
          <div>
            <Eyebrow>Pazarlama</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
              Kuponlar
            </h1>
            <p className="mt-1.5 text-base text-gri-700">
              {coupons.length} kupon · {coupons.filter((c) => c.active).length}{" "}
              aktif
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={() => setShowForm((v) => !v)}
          >
            <Icon.Plus size={16} /> Yeni kupon
          </Button>
        </div>

        {/* Analitik KPI */}
        {analytics && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              <Card padding="p-5">
                <div className="text-xs uppercase tracking-wide text-gri-700">
                  Toplam kullanım (30g)
                </div>
                <div className="mt-1 text-2xl font-semibold text-lacivert">
                  {analytics.totalUsage}
                </div>
              </Card>
              <Card padding="p-5">
                <div className="text-xs uppercase tracking-wide text-gri-700">
                  Toplam indirim (30g)
                </div>
                <div className="mt-1 text-2xl font-semibold text-pim-mercan">
                  ₺{analytics.totalDiscount.toLocaleString("tr-TR")}
                </div>
              </Card>
              <Card padding="p-5">
                <div className="text-xs uppercase tracking-wide text-gri-700">
                  En popüler kupon
                </div>
                <div className="mt-1 text-2xl font-semibold font-mono text-lacivert">
                  {topPopularCode}
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
              <Card padding="p-5">
                <h2 className="text-[15px] font-semibold mb-3">
                  30 gün kullanım trendi
                </h2>
                <LineChart
                  points={trendPoints}
                  height={140}
                  formatY={(n) => `${n} kullanım`}
                  emptyLabel="Son 30 günde kullanım yok"
                />
              </Card>
              <Card padding="p-5">
                <h2 className="text-[15px] font-semibold mb-3">
                  En çok kullanılan 5 kupon
                </h2>
                <BarChart
                  bars={topBarData}
                  height={140}
                  emptyLabel="Kullanım verisi yok"
                />
              </Card>
            </div>
          </>
        )}

        {/* Form */}
        {showForm && (
          <Card padding="p-6" className="mb-5">
            <h2 className="text-lg font-semibold mb-4">Yeni kupon oluştur</h2>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[13px] font-semibold mb-1.5 block">
                    Kupon kodu
                  </span>
                  <Input
                    value={draft.code}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        code: e.target.value.toLocaleUpperCase("tr-TR"),
                      })
                    }
                    placeholder="HOSGELDIN10"
                    style={{ textTransform: "uppercase" }}
                  />
                </label>
                <div>
                  <span className="text-[13px] font-semibold mb-1.5 block">
                    İndirim tipi
                  </span>
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-gri-100">
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({ ...draft, type: "percent" })
                      }
                      className={cn(
                        "h-9 rounded-full text-[13px] font-semibold transition-colors",
                        draft.type === "percent"
                          ? "bg-white text-lacivert shadow-1"
                          : "text-gri-700"
                      )}
                    >
                      Yüzde (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, type: "fixed" })}
                      className={cn(
                        "h-9 rounded-full text-[13px] font-semibold transition-colors",
                        draft.type === "fixed"
                          ? "bg-white text-lacivert shadow-1"
                          : "text-gri-700"
                      )}
                    >
                      Sabit (₺)
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-[13px] font-semibold mb-1.5 block">
                    Değer ({draft.type === "percent" ? "%" : "₺"})
                  </span>
                  <Input
                    type="number"
                    value={draft.value}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        value: Number(e.target.value) || 0,
                      })
                    }
                  />
                </label>
                <label className="block">
                  <span className="text-[13px] font-semibold mb-1.5 block">
                    Minimum sepet (₺)
                  </span>
                  <Input
                    type="number"
                    value={draft.minSubtotal}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        minSubtotal: Number(e.target.value) || 0,
                      })
                    }
                  />
                </label>
                <label className="block">
                  <span className="text-[13px] font-semibold mb-1.5 block">
                    Max kullanım (boş = sınırsız)
                  </span>
                  <Input
                    type="number"
                    value={draft.maxUses ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDraft({
                        ...draft,
                        maxUses: v ? Number(v) : null,
                      });
                    }}
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[13px] font-semibold mb-1.5 block">
                    Geçerlilik başlangıç
                  </span>
                  <Input
                    type="date"
                    value={draft.validFrom}
                    onChange={(e) =>
                      setDraft({ ...draft, validFrom: e.target.value })
                    }
                  />
                </label>
                <label className="block">
                  <span className="text-[13px] font-semibold mb-1.5 block">
                    Geçerlilik son
                  </span>
                  <Input
                    type="date"
                    value={draft.validTo}
                    onChange={(e) =>
                      setDraft({ ...draft, validTo: e.target.value })
                    }
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowForm(false)}
                >
                  İptal
                </Button>
                <Button type="submit" variant="primary">
                  Kupon oluştur <Icon.Check size={14} />
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* List */}
        {loading ? (
          <Card padding="p-12" className="text-center text-gri-700">
            Yükleniyor…
          </Card>
        ) : coupons.length === 0 ? (
          <Card padding="p-12" className="text-center">
            <Pim pose="think" size={140} />
            <h3 className="mt-4 text-xl font-semibold">Henüz kupon yok</h3>
            <p className="mt-2 text-base text-gri-700">
              İlk kupon oluştur, müşterilere ödeme sayfasında uygulansın.
            </p>
          </Card>
        ) : (
          <Card padding="p-0" className="overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead className="border-b border-gri-200 bg-gri-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    Kod
                  </th>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    İndirim
                  </th>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    Min sepet
                  </th>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    Kullanım
                  </th>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    Geçerli
                  </th>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    Durum
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gri-100">
                {coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-gri-50">
                    <td className="px-4 py-3 font-mono font-bold text-pim-mercan">
                      {c.code}
                    </td>
                    <td className="px-4 py-3 font-semibold text-lacivert tabular-nums">
                      {c.type === "percent" ? `%${c.value}` : `${c.value} ₺`}
                    </td>
                    <td className="px-4 py-3 text-gri-700 tabular-nums">
                      {c.minSubtotal > 0 ? `${c.minSubtotal} ₺+` : "Yok"}
                    </td>
                    <td className="px-4 py-3 text-gri-700 tabular-nums">
                      {c.usedCount}
                      {c.maxUses != null ? ` / ${c.maxUses}` : " / ∞"}
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-gri-700">
                      {c.validFrom} → {c.validTo}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleActive(c.id)}
                        className={cn(
                          "inline-flex items-center h-[22px] px-2 rounded-full text-[11.5px] font-semibold cursor-pointer",
                          c.active
                            ? "bg-yesil-soft text-yesil"
                            : "bg-gri-100 text-gri-700"
                        )}
                      >
                        {c.active ? "Aktif" : "Pasif"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(c)}
                      >
                        Sil
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        <div className="mt-6 flex items-center gap-3 text-[12px] text-gri-500">
          <Icon.Info size={14} />
          <span>
            Kupon uygulaması ödeme sayfasına Faz 2&rsquo;de eklenecek (kod
            input + validate). Şu an kuponlar sadece yönetilebiliyor.
          </span>
        </div>
      </div>
    </main>
  );
}
