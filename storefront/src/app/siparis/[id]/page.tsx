/**
 * Pim Etiket — /siparis/[id] (E.2.2)
 *
 * Sipariş detayı dynamic route. Statü timeline + dosya yükleme +
 * prova onay + ürün özeti + adres + ödeme + kargo takip.
 *
 * Mock data — gerçek bağlantı I adımında.
 */

"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Pim, PimMini } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, StageDot } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  getCustomerOrder,
  type CustomerOrder,
} from "@/lib/customer-order";
import type { OrderStatus } from "@/lib/order";

const PHASES = [
  { id: "konfigure", label: "Konfigüre" },
  { id: "odeme", label: "Ödendi" },
  { id: "dosya", label: "Dosya yüklendi" },
  { id: "ai", label: "AI kontrol" },
  { id: "operator", label: "Operatör onayı" },
  { id: "prova", label: "Prova bekleniyor" },
  { id: "uretim", label: "Üretimde" },
  { id: "kargo", label: "Kargoda" },
  { id: "teslim", label: "Teslim edildi" },
] as const;

/** OrderStatus → PHASES index map */
function statusToPhaseIndex(status: OrderStatus): number {
  switch (status) {
    case "paid":
      return 1; // Ödendi
    case "qc_pending":
      return 3; // AI kontrol
    case "qc_flagged":
    case "operator_review":
      return 4; // Operatör onayı
    case "proof_pending":
      return 5; // Prova bekleniyor
    case "in_production":
      return 6; // Üretimde
    case "shipped":
      return 7; // Kargoda
    case "delivered":
      return 8; // Teslim edildi
    default:
      return 1;
  }
}

const fmt = (n: number) => Math.round(n).toLocaleString("tr-TR");
const fmtUnit = (n: number) => n.toFixed(2).replace(".", ",");

const INVOICE_LABEL: Record<"individual" | "corporate", string> = {
  individual: "Bireysel (e-arşiv)",
  corporate: "Kurumsal (e-fatura)",
};

const PAYMENT_METHOD_LABEL: Record<"card" | "wallet" | "transfer", string> = {
  card: "Kredi kartı",
  wallet: "Cüzdan bakiyesi",
  transfer: "Havale / EFT",
};

export default function SiparisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [proofApproved, setProofApproved] = useState(false);
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setOrder(getCustomerOrder(id));
    setHydrated(true);
  }, [id]);

  // Hydration guard
  if (!hydrated) {
    return (
      <main className="bg-gri-50 min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[680px] px-6 text-center text-gri-500">
          Yükleniyor…
        </div>
      </main>
    );
  }

  // Order not found
  if (!order) {
    return (
      <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[560px] px-6 text-center">
          <Pim pose="think" size={140} />
          <h1 className="mt-3 text-[26px] md:text-[32px] font-semibold tracking-tight">
            Sipariş bulunamadı
          </h1>
          <p className="mt-3 text-base text-gri-700 leading-relaxed">
            <strong className="font-mono">{id}</strong> numaralı sipariş bu
            cihazda kayıtlı değil. Başka bir cihazdan bakmış olabilirsin.
          </p>
          <div className="mt-6 flex gap-3 justify-center flex-wrap">
            <Button variant="primary" size="lg" href="/siparislerim">
              Siparişlerime dön
            </Button>
            <Button variant="secondary" size="lg" href="/etiket">
              Yeni sipariş
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // Header için title üret — tek item ise onun başlığı, çoksa özet
  const title =
    order.items.length === 1
      ? order.items[0].title
      : `${order.items.length} ürünlük sipariş`;

  const orderDate = new Date(order.createdAtIso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const deliveryDate = order.estimatedDelivery
    ? new Date(order.estimatedDelivery).toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "-";
  const phaseIdx = statusToPhaseIndex(order.status);

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[14px] mb-5">
          <Link
            href="/panelim"
            className="px-2 py-1 rounded text-gri-700 hover:bg-gri-100 hover:text-lacivert"
          >
            Panelim
          </Link>
          <Icon.ChevR size={14} className="text-gri-500" />
          <Link
            href="/siparislerim"
            className="px-2 py-1 rounded text-gri-700 hover:bg-gri-100 hover:text-lacivert"
          >
            Siparişlerim
          </Link>
          <Icon.ChevR size={14} className="text-gri-500" />
          <span className="font-semibold">{id}</span>
        </div>

        {/* Header */}
        <div className="flex items-end justify-between gap-6 mb-7 flex-wrap">
          <div>
            <Eyebrow>Sipariş</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight leading-tight">
              {title}
            </h1>
            <div className="flex items-center gap-3 mt-2 text-[13px] text-gri-700 flex-wrap">
              <span className="font-semibold uppercase tracking-[0.04em] font-mono">
                {order.id}
              </span>
              <span>·</span>
              <span>Sipariş tarihi: {orderDate}</span>
              <span>·</span>
              <span>
                Tahmini teslim:{" "}
                <strong className="text-lacivert">{deliveryDate}</strong>
              </span>
            </div>
          </div>
          <Button variant="secondary" href="/etiket">
            <Icon.Bolt size={14} /> Tekrar sipariş
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
          {/* MAIN */}
          <div className="flex flex-col gap-6">
            {/* Vertical timeline */}
            <Card padding="p-6">
              <h2 className="text-xl font-semibold mb-5">Sipariş yolculuğu</h2>
              <ol className="flex flex-col gap-0">
                {PHASES.map((p, i) => {
                  const state =
                    i < phaseIdx ? "done" : i === phaseIdx ? "curr" : "todo";
                  return (
                    <li
                      key={p.id}
                      className="flex gap-4 relative pb-5 last:pb-0"
                    >
                      {/* Vertical line */}
                      {i < PHASES.length - 1 && (
                        <span
                          aria-hidden
                          className="absolute left-[13px] top-8 bottom-0 w-0.5"
                          style={{
                            background:
                              i < phaseIdx
                                ? "var(--color-yesil)"
                                : "var(--color-gri-200)",
                          }}
                        />
                      )}
                      <StageDot
                        state={state}
                        label={state === "curr" ? i + 1 : i + 1}
                      />
                      <div className="flex-1 pt-0.5">
                        <div
                          className={cn(
                            "font-semibold text-[15px]",
                            state === "todo" && "text-gri-500"
                          )}
                        >
                          {p.label}
                        </div>
                        {state === "curr" && (
                          <div className="text-[13px] text-gri-700 mt-0.5">
                            Sıradaki adım — Pim sana ne yapacağını söylüyor.
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>

            {/* Proof canvas — current phase'e göre */}
            {phaseIdx === 5 && !proofApproved && (
              <Card padding="" className="!p-0 overflow-hidden">
                <div className="bg-gradient-to-br from-pim-mercan-tint to-krem-soft p-6 border-b border-gri-200">
                  <div className="flex gap-4 items-start">
                    <PimMini pose="inspect" size={56} />
                    <div className="flex-1">
                      <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-pim-mercan">
                        Aksiyon gerekli
                      </div>
                      <h3 className="font-semibold text-xl mt-1.5">
                        Provanı incele ve onayla
                      </h3>
                      <p className="text-[14px] text-gri-700 mt-2 leading-relaxed">
                        AI ön kontrolünden geçti, operatörümüz baktı —
                        tasarımının matbaa öncesi nasıl görüneceğini hazırladık.
                        Yakınlaştır, kontrol et, onayla.
                      </p>
                    </div>
                  </div>
                </div>
                {/* Mock proof canvas */}
                <div className="bg-gri-100 p-8 grid place-items-center min-h-[280px]">
                  <div className="bg-white rounded-lg shadow-2 p-6 max-w-[360px] w-full">
                    <div className="aspect-[4/5] bg-krem rounded-md grid place-items-center mb-3">
                      <div className="text-center">
                        <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-lacivert/60 mb-1">
                          {order.items[0]?.title.split("·")[0].trim() ?? "Ürün"}
                        </div>
                        <div className="text-[22px] font-bold text-lacivert">
                          {order.address.name.split(" ")[0]}
                        </div>
                        <div className="text-[10px] text-gri-700 mt-1">
                          DOĞAL · ORGANİK · 100ml
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between text-[11px] text-gri-500">
                      <span>Boyut: {order.items[0]?.width}×{order.items[0]?.height}mm</span>
                      <span>%100 önizleme</span>
                    </div>
                  </div>
                </div>
                <div className="p-6 border-t border-gri-200 bg-white">
                  <p className="text-[13px] text-gri-700 leading-relaxed mb-4">
                    <strong className="text-lacivert">Renk uyarısı:</strong>{" "}
                    Ekrandaki renkler matbaa baskısından küçük ölçüde farklı
                    çıkabilir. CMYK kalibrasyonu fason ortakla aynı.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="primary"
                      onClick={() => setProofApproved(true)}
                      className="!bg-yesil hover:!bg-[#22a862]"
                    >
                      <Icon.Check size={14} /> Provayı onayla
                    </Button>
                    <Button variant="secondary">Değişiklik iste</Button>
                    <Button variant="ghost">
                      <Icon.Box size={14} /> PDF indir
                    </Button>
                  </div>
                </div>
              </Card>
            )}
            {proofApproved && (
              <div className="rounded-2xl p-6 bg-yesil-soft ring-1 ring-yesil/30 flex gap-4 items-center">
                <div className="grid place-items-center w-12 h-12 rounded-full bg-yesil text-white shrink-0">
                  <Icon.Check size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-base">
                    Prova onayın alındı 🎉
                  </h3>
                  <p className="text-[13px] text-gri-700 mt-0.5">
                    Sipariş üretime gönderildi. Yaklaşık 5 gün içinde kargoya
                    verilir.
                  </p>
                </div>
              </div>
            )}

            {/* File upload card */}
            <DesignUploadCard orderId={order.id} />
          </div>

          {/* SIDE — özet bilgileri */}
          <div className="flex flex-col gap-4">
            {/* Order summary */}
            <Card padding="p-6">
              <h3 className="font-semibold text-base mb-4">Sipariş özeti</h3>
              <ul className="flex flex-col gap-3 text-[13px]">
                {order.items.map((item) => (
                  <li
                    key={item.id}
                    className="pb-3 border-b border-gri-100 last:border-0 last:pb-0"
                  >
                    <div className="flex justify-between gap-3 items-baseline">
                      <span className="font-semibold text-lacivert text-[13.5px] truncate flex-1 min-w-0">
                        {item.title}
                      </span>
                      <span className="font-semibold tabular-nums shrink-0">
                        {fmt(item.total)} TL
                      </span>
                    </div>
                    <div className="text-[12px] text-gri-500 mt-1 leading-relaxed">
                      {item.config}
                    </div>
                    <div className="text-[12px] text-gri-700 mt-1 tabular-nums">
                      {item.qty.toLocaleString("tr-TR")} adet ×{" "}
                      {fmtUnit(item.unit)} TL
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 pt-3 border-t border-gri-200 space-y-1.5 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-gri-700">Ara toplam</span>
                  <span className="font-semibold tabular-nums">
                    {fmt(order.subtotal)} TL
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gri-700">Kargo</span>
                  <span className="font-semibold tabular-nums">
                    {order.shipping === 0 ? (
                      <span className="text-yesil">Ücretsiz</span>
                    ) : (
                      `${fmt(order.shipping)} TL`
                    )}
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t-2 border-lacivert flex justify-between items-baseline">
                <span className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
                  TOPLAM
                </span>
                <span className="text-2xl font-bold tabular-nums">
                  {fmt(order.total)}{" "}
                  <span className="text-base text-gri-700">TL</span>
                </span>
              </div>
              <div className="text-[11.5px] text-gri-700 text-right mt-1">
                KDV dahil
              </div>
            </Card>

            {/* Shipping */}
            <Card padding="p-6">
              <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                <Icon.Truck size={16} /> Teslimat
              </h3>
              <div className="text-[13px] text-gri-700 space-y-1.5 leading-relaxed">
                {order.address.label && (
                  <div className="inline-flex items-center h-[20px] px-2 rounded-full bg-gri-100 text-gri-700 text-[11px] font-semibold mb-1">
                    {order.address.label}
                  </div>
                )}
                <div className="font-semibold text-lacivert">
                  {order.address.name}
                </div>
                <div>{order.address.addr}</div>
                <div>{order.address.city}</div>
                <div>{order.address.phone}</div>
              </div>
            </Card>

            {/* Payment */}
            <Card padding="p-6">
              <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                <Icon.Wallet size={16} /> Ödeme
              </h3>
              <div className="text-[13px] text-gri-700 space-y-1.5 leading-relaxed">
                <div>{PAYMENT_METHOD_LABEL[order.payment.method]}</div>
                {order.payment.masked && (
                  <div className="font-mono">{order.payment.masked}</div>
                )}
                <div className="text-[11.5px] text-gri-500 mt-2">
                  Fatura: {INVOICE_LABEL[order.invoice.type]}
                </div>
              </div>
            </Card>

            {/* Pim help */}
            <Card padding="p-5" className="!bg-krem">
              <div className="flex gap-3 items-center">
                <Pim pose="chat" size={64} bob={false} />
                <div>
                  <div className="font-bold text-sm">Pim&rsquo;e sor</div>
                  <div className="text-[11.5px] text-gri-700 mt-0.5">
                    Bu sipariş hakkında soru?
                  </div>
                  <button className="text-[12.5px] font-semibold text-pim-mercan mt-2 hover:underline">
                    Sohbeti aç →
                  </button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

// ============================================================
// DesignUploadCard — sipariş detayında tasarım upload UI
// ============================================================

interface UploadedFile {
  name: string;
  size: number;
  uploadedAt: number;
  /** AI flagleri — mock */
  flags: Array<{ kind: "ok" | "warning" | "error"; message: string }>;
}

const STORAGE_KEY_FILES = "pim_design_files_v1";

function loadFiles(orderId: string): UploadedFile[] {
  if (typeof window === "undefined") return [];
  try {
    const all = JSON.parse(
      localStorage.getItem(STORAGE_KEY_FILES) ?? "{}"
    ) as Record<string, UploadedFile[]>;
    return all[orderId] ?? [];
  } catch {
    return [];
  }
}

function saveFiles(orderId: string, files: UploadedFile[]): void {
  if (typeof window === "undefined") return;
  try {
    const all = JSON.parse(
      localStorage.getItem(STORAGE_KEY_FILES) ?? "{}"
    ) as Record<string, UploadedFile[]>;
    all[orderId] = files;
    localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(all));
  } catch {
    // ignore
  }
}

function DesignUploadCard({ orderId }: { orderId: string }) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    setFiles(loadFiles(orderId));
    setHydrated(true);
  }, [orderId]);

  const handleMockUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAnalyzing(true);
    setTimeout(() => {
      const flagSet: UploadedFile["flags"] = [
        { kind: "ok", message: "Çözünürlük 320 DPI — baskı için yeterli" },
        { kind: "ok", message: "CMYK renk uzayı tespit edildi" },
      ];
      if (Math.random() < 0.3) {
        flagSet.push({
          kind: "warning",
          message: "Kenar boşluğu 2mm'in altında — kesim kayması riskli",
        });
      }
      const fresh: UploadedFile = {
        name: file.name,
        size: file.size,
        uploadedAt: Date.now(),
        flags: flagSet,
      };
      const next = [fresh, ...files];
      setFiles(next);
      saveFiles(orderId, next);
      setAnalyzing(false);
    }, 1500);
    event.target.value = "";
  };

  const handleRemove = (name: string) => {
    if (!confirm("Bu dosya silinsin mi?")) return;
    const next = files.filter((f) => f.name !== name);
    setFiles(next);
    saveFiles(orderId, next);
  };

  if (!hydrated) return null;

  return (
    <Card padding="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Tasarım dosyası</h2>
        <label className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-full bg-pim-mercan text-white text-[13px] font-semibold cursor-pointer hover:bg-pim-mercan-koyu transition-colors">
          <Icon.Plus size={14} />
          {analyzing ? "Yükleniyor..." : "Dosya yükle"}
          <input
            type="file"
            className="hidden"
            accept=".pdf,.ai,.eps,.psd,.png,.jpg,.svg"
            onChange={handleMockUpload}
            disabled={analyzing}
          />
        </label>
      </div>

      {files.length === 0 ? (
        <div className="rounded-lg bg-gri-50 ring-1 ring-dashed ring-gri-200 p-8 text-center">
          <Icon.Box size={36} className="text-gri-500 mx-auto mb-3" />
          <h3 className="font-semibold text-lacivert mb-1">
            Henüz tasarım yüklemedin
          </h3>
          <p className="text-[13px] text-gri-700 max-w-[400px] mx-auto leading-relaxed">
            PDF, AI, EPS, PSD, PNG, JPG, SVG kabul ederim. Yükledikten sonra
            Pim AI saniyeler içinde DPI / CMYK / boşluk kontrolü yapar.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {files.map((f) => {
            const date = new Date(f.uploadedAt).toLocaleString("tr-TR", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            });
            const sizeKb = (f.size / 1024).toFixed(1);
            const hasError = f.flags.some((fl) => fl.kind === "error");
            const hasWarning = f.flags.some((fl) => fl.kind === "warning");
            return (
              <div
                key={f.name}
                className="flex items-start gap-3 p-4 rounded-lg bg-gri-50 ring-1 ring-gri-200"
              >
                <div className="grid place-items-center w-11 h-11 rounded-lg bg-pim-mercan-tint text-pim-mercan shrink-0">
                  <Icon.Box size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[14px] truncate">
                      {f.name}
                    </span>
                    {hasError ? (
                      <span className="inline-flex items-center h-[20px] px-1.5 rounded-full bg-kirmizi/10 text-kirmizi text-[11px] font-bold">
                        AI flag
                      </span>
                    ) : hasWarning ? (
                      <span className="inline-flex items-center h-[20px] px-1.5 rounded-full bg-sari-soft text-[#7A560A] text-[11px] font-bold">
                        Uyarı
                      </span>
                    ) : (
                      <span className="inline-flex items-center h-[20px] px-1.5 rounded-full bg-yesil-soft text-yesil text-[11px] font-bold">
                        AI geçti
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-gri-700 mt-0.5">
                    {sizeKb} KB · {date}
                  </div>
                  <div className="mt-2 space-y-1">
                    {f.flags.map((fl, i) => (
                      <div
                        key={i}
                        className="text-[12px] flex items-start gap-1.5"
                      >
                        <span
                          className={cn(
                            fl.kind === "ok" && "text-yesil",
                            fl.kind === "warning" && "text-[#7A560A]",
                            fl.kind === "error" && "text-kirmizi"
                          )}
                        >
                          {fl.kind === "ok"
                            ? "✓"
                            : fl.kind === "warning"
                              ? "⚠"
                              : "✗"}
                        </span>
                        <span className="text-gri-700 leading-relaxed">
                          {fl.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(f.name)}
                  className="text-gri-500 hover:text-kirmizi text-[12px] font-semibold shrink-0"
                  aria-label="Kaldır"
                >
                  Kaldır
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 text-[11.5px] text-gri-500">
        <Icon.Info size={12} />
        <span>
          Mock yükleme — gerçek dosya storage Faz 2&rsquo;de Supabase Storage
          ile aktif olacak.
        </span>
      </div>
    </Card>
  );
}
