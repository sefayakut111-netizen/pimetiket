/**
 * Pim Etiket — /admin/ai-qc (E.3)
 *
 * AI ön kontrolünden flag'lenen siparişlerin manuel inceleme kuyruğu.
 * Her flag için: sebep, severity, müşteriye gönderilecek mesaj, onay/red.
 */

"use client";

import { useState } from "react";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";

type Severity = "warning" | "fatal";

interface Flag {
  id: string;
  category: "renk" | "cozunurluk" | "marka" | "yazim" | "boyut" | "guvenlik";
  severity: Severity;
  message: string;
}

interface QCItem {
  orderId: string;
  customer: string;
  product: string;
  fileName: string;
  uploadedAt: string;
  flags: Flag[];
}

const QUEUE: QCItem[] = [
  {
    orderId: "PE-2026-1188",
    customer: "Mehmet Kahveci",
    product: "Etiket × 2.500 (Kraft + mat selefon)",
    fileName: "kahve_v2.pdf",
    uploadedAt: "8 May 14:25",
    flags: [
      {
        id: "f1",
        category: "renk",
        severity: "warning",
        message: "CMYK renk uzayı kullanılmamış (RGB tespit edildi). Baskıda renk farkı olabilir.",
      },
      {
        id: "f2",
        category: "yazim",
        severity: "warning",
        message: "İçerik metninde olası yazım hatası: 'kahveçi' → 'kahveci' olabilir mi?",
      },
    ],
  },
  {
    orderId: "PE-2026-1190",
    customer: "Festival Co.",
    product: "Sticker × 1.000 (Holografik)",
    fileName: "festival_logo.ai",
    uploadedAt: "8 May 13:50",
    flags: [
      {
        id: "f3",
        category: "marka",
        severity: "fatal",
        message: "Tasarımda 3. taraf logosu (örn: Nike-tarzı tik) tespit edildi. Marka hakkı ihlali olabilir, üretmeden önce müşteri onayı + kanıt iste.",
      },
    ],
  },
  {
    orderId: "PE-2026-1192",
    customer: "Çiçekçi Atölye",
    product: "Etiket × 1.000 (Beyaz semi-glos)",
    fileName: "cicek_son.pdf",
    uploadedAt: "8 May 12:18",
    flags: [
      {
        id: "f4",
        category: "cozunurluk",
        severity: "warning",
        message: "DPI 192 — 300+ önerilir. Detay kaybolabilir.",
      },
    ],
  },
];

const CAT_META: Record<
  Flag["category"],
  { label: string; icon: React.ReactNode }
> = {
  renk: { label: "Renk", icon: <Icon.Sparkle size={14} /> },
  cozunurluk: { label: "Çözünürlük", icon: <Icon.Info size={14} /> },
  marka: { label: "Marka/Telif", icon: <Icon.Star size={14} /> },
  yazim: { label: "Yazım", icon: <Icon.Info size={14} /> },
  boyut: { label: "Boyut", icon: <Icon.Box size={14} /> },
  guvenlik: { label: "Güvenlik", icon: <Icon.Bolt size={14} /> },
};

export default function AdminAiQcPage() {
  const [items, setItems] = useState(QUEUE);
  const [activeIdx, setActiveIdx] = useState(0);

  const active = items[activeIdx];

  const decide = (action: "approve" | "reject") => {
    setItems((arr) => arr.filter((_, i) => i !== activeIdx));
    setActiveIdx((i) => Math.max(0, Math.min(i, items.length - 2)));
    void action;
  };

  if (items.length === 0) {
    return (
      <main className="py-12">
        <div className="mx-auto max-w-[600px] px-6 text-center">
          <Pim pose="happy" size={160} />
          <h1 className="mt-4 text-[28px] font-semibold tracking-tight">
            Kuyruk temiz! 🎉
          </h1>
          <p className="mt-3 text-base text-gri-700 leading-relaxed">
            Tüm AI flag'leri inceledin. Pim memnun. Yeni flag geldiğinde
            burada görünür.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="mb-6">
          <Eyebrow>AI QC kuyruğu</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Manuel kontrol kuyruğu
          </h1>
          <p className="mt-1.5 text-base text-gri-700">
            {items.length} sipariş AI ön kontrolünde flag aldı, manuel
            inceleme bekliyor.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
          {/* Queue list */}
          <Card padding="p-2">
            <div className="flex flex-col gap-1">
              {items.map((q, i) => {
                const fatal = q.flags.some((f) => f.severity === "fatal");
                return (
                  <button
                    key={q.orderId}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    className={cn(
                      "text-left p-3 rounded-lg transition-colors",
                      activeIdx === i
                        ? "bg-lacivert text-white"
                        : "hover:bg-gri-100"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[12px] opacity-80">
                        {q.orderId}
                      </span>
                      {fatal && (
                        <span className="inline-flex items-center h-[18px] px-1.5 rounded-full bg-kirmizi text-white text-[10px] font-bold">
                          FATAL
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-[13px] truncate">
                      {q.customer}
                    </div>
                    <div
                      className={cn(
                        "text-[11.5px] mt-0.5",
                        activeIdx === i ? "text-white/70" : "text-gri-700"
                      )}
                    >
                      {q.flags.length} flag · {q.uploadedAt}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Detail */}
          <div className="flex flex-col gap-4">
            {/* Order header */}
            <Card padding="p-6">
              <div className="flex justify-between items-start gap-4 flex-wrap">
                <div>
                  <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
                    {active.orderId}
                  </div>
                  <h2 className="text-xl font-semibold mt-1">
                    {active.customer}
                  </h2>
                  <div className="text-[13px] text-gri-700 mt-1">
                    {active.product}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11.5px] uppercase tracking-[0.04em] text-gri-700 font-semibold">
                    Yüklenen dosya
                  </div>
                  <div className="font-mono text-[13px] mt-1">
                    {active.fileName}
                  </div>
                  <div className="text-[12px] text-gri-700 mt-0.5">
                    {active.uploadedAt}
                  </div>
                </div>
              </div>
            </Card>

            {/* Preview placeholder */}
            <Card padding="" className="!p-0 overflow-hidden">
              <div className="aspect-[16/9] bg-gri-100 grid place-items-center">
                <div className="text-center px-6 py-12">
                  <Icon.Box size={48} className="text-gri-500 mx-auto mb-3" />
                  <div className="font-semibold text-lacivert mb-1">
                    Tasarım önizlemesi
                  </div>
                  <div className="text-[13px] text-gri-700 max-w-[400px] mx-auto leading-relaxed">
                    Burada yüklenen dosyanın PDF/AI thumbnail'i gösterilir.
                    Yakınlaştırma + bbox highlight ile flag'lenen alanlar
                    işaretlenir.
                  </div>
                </div>
              </div>
            </Card>

            {/* Flags */}
            <Card padding="p-6">
              <h3 className="font-semibold text-lg mb-4">
                Tespit edilen sorunlar ({active.flags.length})
              </h3>
              <div className="space-y-3">
                {active.flags.map((f) => {
                  const meta = CAT_META[f.category];
                  return (
                    <div
                      key={f.id}
                      className={cn(
                        "p-4 rounded-lg ring-1",
                        f.severity === "fatal"
                          ? "bg-kirmizi/5 ring-kirmizi/30"
                          : "bg-sari-soft ring-sari/30"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full text-[11.5px] font-semibold",
                            f.severity === "fatal"
                              ? "bg-kirmizi text-white"
                              : "bg-sari text-[#7A560A]"
                          )}
                        >
                          {meta.icon}
                          {f.severity === "fatal" ? "FATAL" : "WARNING"}
                        </span>
                        <span className="text-[13px] font-semibold text-lacivert">
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-[14px] text-gri-700 leading-relaxed">
                        {f.message}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Decision buttons */}
              <div className="mt-6 flex flex-wrap gap-3 items-center">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => decide("approve")}
                  className="!bg-yesil hover:!bg-[#22a862]"
                >
                  <Icon.Check size={16} /> Onayla → Üretime
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => decide("reject")}
                >
                  Müşteriye düzeltme iste
                </Button>
                <Button variant="ghost">
                  <Icon.ChatBubble size={14} /> Notla iletişim
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
