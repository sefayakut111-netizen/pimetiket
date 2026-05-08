/**
 * Pim Etiket — /cuzdan (E.2.4)
 *
 * Cüzdan bakiyesi + para yatır + işlem geçmişi tablosu. Mock.
 */

"use client";

import { useState } from "react";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Input, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";

interface Transaction {
  id: string;
  date: string;
  type: "deposit" | "purchase" | "refund" | "bonus";
  desc: string;
  amount: number;
}

const TRANSACTIONS: Transaction[] = [
  { id: "t9", date: "8 May 2026", type: "refund", desc: "İade bonusu — PE-1175 hatalı kargo", amount: 120 },
  { id: "t8", date: "5 May 2026", type: "purchase", desc: "Sipariş PE-2026-1182", amount: -4250 },
  { id: "t7", date: "2 May 2026", type: "purchase", desc: "Sipariş PE-2026-1175", amount: -1750 },
  { id: "t6", date: "28 Nis 2026", type: "deposit", desc: "Cüzdana yatırma — kredi kartı", amount: 5000 },
  { id: "t5", date: "21 Nis 2026", type: "purchase", desc: "Sipariş PE-2026-1167", amount: -1050 },
  { id: "t4", date: "20 Nis 2026", type: "bonus", desc: "Hoş geldin bonusu", amount: 100 },
  { id: "t3", date: "20 Nis 2026", type: "deposit", desc: "Cüzdana yatırma — kredi kartı", amount: 3000 },
];

const TYPE_META: Record<
  Transaction["type"],
  { label: string; color: string; bg: string }
> = {
  deposit: { label: "Yatırma", color: "text-yesil", bg: "bg-yesil-soft" },
  purchase: { label: "Sipariş", color: "text-lacivert", bg: "bg-gri-100" },
  refund: { label: "İade", color: "text-yesil", bg: "bg-yesil-soft" },
  bonus: { label: "Bonus", color: "text-pim-mercan", bg: "bg-pim-mercan-tint" },
};

const fmt = (n: number) => Math.abs(Math.round(n)).toLocaleString("tr-TR");

export default function CuzdanPage() {
  const [showDeposit, setShowDeposit] = useState(false);
  const [amount, setAmount] = useState("");

  const balance = TRANSACTIONS.reduce((sum, t) => sum + t.amount, 0);
  const totalIn = TRANSACTIONS.filter((t) => t.amount > 0).reduce(
    (s, t) => s + t.amount,
    0
  );
  const totalOut = Math.abs(
    TRANSACTIONS.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0)
  );

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[1100px] px-8">
        <div className="mb-7">
          <Eyebrow>Hesabım</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Cüzdanım
          </h1>
        </div>

        {/* Balance card */}
        <div className="rounded-2xl p-7 mb-4 bg-gradient-to-br from-lacivert to-[#2C3849] text-white relative overflow-hidden">
          <div
            aria-hidden
            className="absolute -top-10 -right-10 w-[160px] h-[160px] rounded-full bg-pim-mercan opacity-20"
          />
          <div className="relative">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
              <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-white/60">
                Mevcut bakiye
              </div>
              <span className="inline-flex items-center gap-1.5 h-[26px] px-3 rounded-full bg-yesil-soft text-yesil text-[12px] font-semibold">
                Cüzdandan ödeyince +%2 indirim
              </span>
            </div>
            <div className="text-[44px] md:text-[56px] font-bold tracking-[-0.02em] leading-none">
              {fmt(balance)}{" "}
              <span className="text-2xl font-semibold opacity-70">TL</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 max-w-[400px]">
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-[11.5px] uppercase tracking-[0.04em] text-white/60 font-semibold">
                  Toplam yatırılan
                </div>
                <div className="text-lg font-bold mt-1">+{fmt(totalIn)} TL</div>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-[11.5px] uppercase tracking-[0.04em] text-white/60 font-semibold">
                  Toplam harcanan
                </div>
                <div className="text-lg font-bold mt-1">−{fmt(totalOut)} TL</div>
              </div>
            </div>

            <div className="mt-6 flex gap-3 flex-wrap">
              {!showDeposit ? (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => setShowDeposit(true)}
                >
                  <Icon.Plus size={16} /> Para yatır
                </Button>
              ) : (
                <div className="flex gap-2 items-end flex-wrap">
                  <label className="block">
                    <span className="text-[12px] font-semibold mb-1.5 block text-white/80">
                      Yatırılacak tutar (TL)
                    </span>
                    <Input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="500"
                      className="!h-11 !w-[200px] !bg-white/10 !text-white !ring-white/20 placeholder:!text-white/40"
                    />
                  </label>
                  <Button variant="primary" size="lg">
                    Yatır <Icon.ArrowR />
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={() => {
                      setShowDeposit(false);
                      setAmount("");
                    }}
                    className="!text-white/70 hover:!bg-white/10"
                  >
                    Vazgeç
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick deposit chips */}
        {!showDeposit && (
          <div className="flex gap-2 flex-wrap mb-6">
            <span className="text-[13px] font-semibold text-gri-700 self-center mr-2">
              Hızlı yatırma:
            </span>
            {[500, 1000, 2500, 5000].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setAmount(String(n));
                  setShowDeposit(true);
                }}
                className="px-4 py-2 rounded-full bg-white ring-1 ring-gri-200 text-[13px] font-semibold hover:ring-pim-mercan hover:text-pim-mercan transition-colors"
              >
                {n.toLocaleString("tr-TR")} TL
              </button>
            ))}
          </div>
        )}

        {/* Transactions */}
        <Card padding="p-0">
          <div className="px-6 py-4 border-b border-gri-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold">İşlem geçmişi</h2>
            <span className="text-[13px] text-gri-700">
              {TRANSACTIONS.length} işlem
            </span>
          </div>
          <div className="divide-y divide-gri-100">
            {TRANSACTIONS.map((t) => {
              const meta = TYPE_META[t.type];
              return (
                <div
                  key={t.id}
                  className="px-6 py-4 flex items-center gap-4"
                >
                  <span
                    className={cn(
                      "inline-flex items-center h-[22px] px-2 rounded-full text-[11.5px] font-semibold shrink-0",
                      meta.bg,
                      meta.color
                    )}
                  >
                    {meta.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[14px] truncate">
                      {t.desc}
                    </div>
                    <div className="text-[12px] text-gri-700 mt-0.5">
                      {t.date}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "font-bold text-base shrink-0",
                      t.amount > 0 ? "text-yesil" : "text-lacivert"
                    )}
                  >
                    {t.amount > 0 ? "+" : "−"}
                    {fmt(t.amount)} TL
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Pim CTA */}
        <Card padding="p-5" className="mt-4 !bg-krem">
          <div className="flex gap-4 items-center">
            <Pim pose="happy" size={80} bob={false} />
            <div className="flex-1">
              <h3 className="font-bold text-base">
                Cüzdandan ödemenin avantajı
              </h3>
              <p className="text-[13px] text-gri-700 mt-1 leading-relaxed">
                Sipariş esnasında cüzdandan ödemeyi seçersen{" "}
                <strong className="text-yesil">+%2 indirim</strong>{" "}
                kazanırsın. Bakiyen yetmezse kart ile fark tamamlanır.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
