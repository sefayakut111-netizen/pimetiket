/**
 * Pim Etiket — /admin/test-siparis-simulator
 *
 * Sefa 17 May: "sipariş simülasyonu yapıp hataları bulacağımız bir şey".
 *
 * Tek butonla 8-adım E2E akış:
 *   1. Test kullanıcı oluştur
 *   2. Sepete mock ürün
 *   3. Adres ekle
 *   4. Kurumsal fatura
 *   5. Kupon doğrula
 *   6. Order kaydet
 *   7. Mock PayTR callback
 *   8. Doğrulama (status + items + events)
 *
 * Her step yeşil/kırmızı kart. Tıklayınca data + error genişler.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Card, Eyebrow, Button, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";

type StepStatus = "pending" | "running" | "success" | "fail" | "skip";

interface SimStep {
  id: string;
  label: string;
  emoji: string;
  status: StepStatus;
  duration_ms?: number;
  error?: string;
  data?: Record<string, unknown>;
}

interface SimResult {
  ok: boolean;
  total_duration_ms: number;
  steps: SimStep[];
  test_user_id?: string;
  test_order_id?: string;
  cleanup_hint?: string;
  error?: string;
  detail?: string;
}

const STATUS_META: Record<
  StepStatus,
  { color: string; bg: string; ring: string; icon: string }
> = {
  pending: {
    color: "text-gri-500",
    bg: "bg-gri-50",
    ring: "ring-gri-200",
    icon: "⋯",
  },
  running: {
    color: "text-pim-mercan",
    bg: "bg-pim-mercan-tint",
    ring: "ring-pim-mercan",
    icon: "...",
  },
  success: {
    color: "text-yesil",
    bg: "bg-yesil-soft/50",
    ring: "ring-yesil/30",
    icon: "",
  },
  fail: {
    color: "text-kirmizi",
    bg: "bg-kirmizi/10",
    ring: "ring-kirmizi/30",
    icon: "",
  },
  skip: {
    color: "text-gri-500",
    bg: "bg-gri-50",
    ring: "ring-gri-200",
    icon: "→",
  },
};

const STATUS_LABEL: Record<StepStatus, string> = {
  pending: "Bekliyor",
  running: "Çalışıyor",
  success: "Başarılı",
  fail: "BAŞARISIZ",
  skip: "Atlandı",
};

const INITIAL_STEPS: SimStep[] = [
  { id: "user", label: "Test kullanıcı oluştur", emoji: "", status: "pending" },
  { id: "cart", label: "Sepete ürün ekle (2 kalem)", emoji: "", status: "pending" },
  { id: "address", label: "Adres ekle (Migration 044)", emoji: "", status: "pending" },
  { id: "invoice", label: "Kurumsal fatura profili (Migration 044)", emoji: "", status: "pending" },
  { id: "coupon", label: "Kupon kodu doğrula", emoji: "", status: "pending" },
  { id: "order", label: "Order kaydı oluştur", emoji: "", status: "pending" },
  { id: "callback", label: "Mock PayTR callback (paid)", emoji: "", status: "pending" },
  { id: "verify", label: "Doğrulama (status + outbox)", emoji: "", status: "pending" },
];

// Sefa 18 May v68 (admin UX denetim — kritik güvenlik):
// Sipariş simülatörü canlıda yanlışlıkla tıklanırsa gerçek finans datasına
// "test cirosu" düşüyordu. Flag default false → production'da gizle.
// NEXT_PUBLIC_ALLOW_SIMULATOR=true ile yalnız staging'de aç.
const SIMULATOR_ENABLED =
  process.env.NEXT_PUBLIC_ALLOW_SIMULATOR === "true";

export default function TestSimulatorPage() {
  const toast = useToast();
  const [result, setResult] = useState<SimResult | null>(null);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [cleaningUp, setCleaningUp] = useState(false);

  if (!SIMULATOR_ENABLED) {
    return (
      <main className="mx-auto max-w-[800px] px-4 py-10 md:px-6">
        <Card padding="p-10" className="text-center">
          <div className="mb-3 text-4xl"></div>
          <h1 className="text-xl font-semibold text-lacivert mb-2">
            Sipariş simülatörü production'da devre dışı
          </h1>
          <p className="text-[13.5px] text-gri-700 max-w-md mx-auto leading-relaxed">
            Bu araç yanlışlıkla canlı finans verisini bozmasın diye production
            ortamında kilitli. Staging'de açmak için{" "}
            <code className="rounded bg-gri-100 px-1.5 py-0.5 text-[12px]">
              NEXT_PUBLIC_ALLOW_SIMULATOR=true
            </code>{" "}
            env'i set edilmeli.
          </p>
          <Link
            href="/admin"
            className="inline-block mt-5 text-pim-mercan font-semibold text-[13px] hover:underline"
          >
            ← Dashboard'a dön
          </Link>
        </Card>
      </main>
    );
  }

  const handleRun = async () => {
    if (running) return;
    setRunning(true);
    setResult(null);
    try {
      const r = await fetch("/api/admin/test/simulate-checkout", {
        method: "POST",
      });
      const data = (await r.json()) as SimResult;
      setResult(data);
      if (data.ok) {
        toast.success(
          ` Tüm akış başarılı (${Math.round((data.total_duration_ms ?? 0) / 100) / 10} sn)`
        );
      } else if (data.error) {
        toast.error(`Simülasyon çöktü: ${data.error}`);
      } else {
        const failedSteps = data.steps?.filter((s) => s.status === "fail");
        toast.error(
          `${failedSteps?.length ?? "?"} adımda hata var, detayları aç`
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ağ hatası");
      setResult({
        ok: false,
        total_duration_ms: 0,
        steps: INITIAL_STEPS,
        error: "network",
      });
    } finally {
      setRunning(false);
    }
  };

  const handleCleanup = async () => {
    if (cleaningUp) return;
    if (
      !confirm(
        "Tüm simülasyon test verisi silinecek (test kullanıcılar + SIM order'lar). Emin misin?"
      )
    )
      return;
    setCleaningUp(true);
    try {
      const r = await fetch(
        "/api/admin/test/simulate-checkout?cleanup=1",
        { method: "POST" }
      );
      const data = (await r.json()) as {
        ok?: boolean;
        deleted_users?: number;
        deleted_orders?: number;
        error?: string;
      };
      if (data.ok) {
        toast.success(
          ` Temizlendi: ${data.deleted_users} user, ${data.deleted_orders} order silindi`
        );
        setResult(null);
      } else {
        toast.error(data.error ?? "Cleanup başarısız");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ağ hatası");
    } finally {
      setCleaningUp(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Render: ya canlı çalışıyor (result.steps) ya da initial
  const stepsToRender = result?.steps ?? INITIAL_STEPS;
  const successCount = stepsToRender.filter((s) => s.status === "success").length;
  const failCount = stepsToRender.filter((s) => s.status === "fail").length;
  const skipCount = stepsToRender.filter((s) => s.status === "skip").length;

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1080px] px-4 md:px-8">
        {/* Header */}
        <div className="mb-6">
          <Eyebrow>Test araçları</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Sipariş Simülatörü
          </h1>
          <p className="mt-1.5 text-base text-gri-700 leading-relaxed max-w-[640px]">
            Tek butonla checkout akışını end-to-end test eder.
            Her adımı backend'de çalıştırır, hatayı bulunduğu yerde gösterir.
            Solo founder için canlı izleme aracı — yeni feature deploy
            sonrası 30 saniyede tüm akışı doğrulamak için.
          </p>
        </div>

        {/* Run + Cleanup buttons */}
        <Card padding="p-5" className="mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="primary"
              size="lg"
              onClick={handleRun}
              disabled={running || cleaningUp}
            >
              {running ? "Simulasyon calisiyor..." : "Tam akis baslat"}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={handleCleanup}
              disabled={running || cleaningUp}
            >
              {cleaningUp ? " Temizleniyor..." : " Test verisini temizle"}
            </Button>
            <div className="ml-auto text-[12.5px] text-gri-700">
              {result && (
                <>
                  Süre:{" "}
                  <strong className="text-lacivert tabular-nums">
                    {(result.total_duration_ms / 1000).toFixed(2)} sn
                  </strong>{" "}
                  ·  {successCount} ·  {failCount}
                  {skipCount > 0 && <> · → {skipCount}</>}
                </>
              )}
            </div>
          </div>
        </Card>

        {/* Genel durum bandı */}
        {result && (
          <Card
            padding="p-4"
            className={cn(
              "mb-6",
              result.ok
                ? "!bg-yesil-soft/30 ring-yesil/30"
                : "!bg-kirmizi/5 ring-kirmizi/30"
            )}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[28px]">{result.ok ? "" : ""}</span>
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    "font-semibold text-[15px]",
                    result.ok ? "text-yesil" : "text-kirmizi"
                  )}
                >
                  {result.ok
                    ? "Tüm akış başarılı"
                    : result.error
                      ? `Simülasyon çöktü: ${result.error}`
                      : `${failCount} adımda hata var`}
                </div>
                <div className="text-[12.5px] text-gri-700 mt-0.5 leading-relaxed">
                  {result.ok
                    ? "Order, address, invoice, payment, callback hepsi çalışıyor. Production-ready."
                    : "Hangi adımda patladığını aşağıdaki kartlarda gör. Detay için kart başlığına tıkla."}
                </div>
              </div>
              {result.test_order_id && (
                <Link
                  href={`/admin/siparisler/${result.test_order_id}`}
                  className="text-[12.5px] font-semibold text-pim-mercan hover:underline"
                  target="_blank"
                >
                  Test order'ı aç →
                </Link>
              )}
            </div>
            {result.cleanup_hint && (
              <div className="mt-3 text-[11.5px] text-gri-700 italic">
                {result.cleanup_hint}
              </div>
            )}
            {result.detail && (
              <pre className="mt-3 text-[11px] font-mono text-kirmizi bg-white/50 p-2 rounded overflow-x-auto">
                {result.detail}
              </pre>
            )}
          </Card>
        )}

        {/* Steps */}
        <div className="space-y-2.5">
          {stepsToRender.map((step, idx) => {
            const meta = STATUS_META[step.status];
            const hasData = step.data || step.error;
            const isExpanded = expanded.has(step.id);
            return (
              <Card
                key={step.id}
                padding="p-0"
                className={cn(meta.bg, "ring-1", meta.ring, "overflow-hidden")}
              >
                <button
                  type="button"
                  onClick={() => hasData && toggleExpand(step.id)}
                  className={cn(
                    "w-full px-4 py-3.5 flex items-center gap-3 text-left",
                    hasData && "hover:bg-black/[0.02] cursor-pointer"
                  )}
                  disabled={!hasData}
                >
                  <span className="grid place-items-center w-8 h-8 rounded-full bg-white ring-1 ring-current text-[14px] shrink-0">
                    {step.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[14px] text-lacivert flex items-center gap-2">
                      <span className="text-gri-500 tabular-nums text-[11.5px]">
                        {idx + 1}.
                      </span>
                      {step.label}
                    </div>
                    {step.error && (
                      <div className="mt-1 text-[12.5px] text-kirmizi font-mono line-clamp-2">
                         {step.error}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {step.duration_ms !== undefined && (
                      <span className="text-[11.5px] text-gri-500 tabular-nums">
                        {step.duration_ms}ms
                      </span>
                    )}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11px] font-bold ring-1",
                        meta.color,
                        meta.ring
                      )}
                    >
                      {step.status === "running" ? (
                        <span className="inline-block w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      ) : (
                        meta.icon
                      )}{" "}
                      {STATUS_LABEL[step.status]}
                    </span>
                    {hasData && (
                      <span
                        className={cn(
                          "text-[14px] text-gri-500 transition-transform",
                          isExpanded && "rotate-90"
                        )}
                      >
                        ▶
                      </span>
                    )}
                  </div>
                </button>

                {hasData && isExpanded && (
                  <div className="px-4 pb-3.5 pt-1 bg-white/40 border-t border-current/10">
                    {step.error && (
                      <div className="mb-2">
                        <div className="text-[11px] font-bold uppercase tracking-[0.04em] text-kirmizi mb-1">
                          Hata
                        </div>
                        <pre className="text-[11.5px] font-mono text-kirmizi bg-white rounded p-2 overflow-x-auto leading-relaxed">
                          {step.error}
                        </pre>
                      </div>
                    )}
                    {step.data && (
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.04em] text-gri-700 mb-1">
                          Ham veri
                        </div>
                        <pre className="text-[11.5px] font-mono text-lacivert bg-white rounded p-2 overflow-x-auto leading-relaxed">
                          {JSON.stringify(step.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Empty state hint (ilk yüklemede) */}
        {!result && !running && (
          <div className="mt-8 text-center">
            <Pim pose="think" size={120} />
            <p className="mt-3 text-[13px] text-gri-700 max-w-[420px] mx-auto leading-relaxed">
              "▶ Tam akış başlat" butonuna bas, simülatör tüm checkout zincirini
              backend'de çalıştırır. Genelde 8-12 saniye sürer.
            </p>
          </div>
        )}

        {/* Açıklama kartı */}
        <Card padding="p-5" className="mt-8 !bg-krem ring-black/[0.04]">
          <h3 className="font-semibold text-[14px] mb-2"> Nasıl kullanılır?</h3>
          <ul className="text-[12.5px] text-gri-700 space-y-1.5 leading-relaxed">
            <li>
              <strong>▶ Tam akış başlat:</strong> Backend'de yeni test
              kullanıcı + sepet + adres + fatura + order + paid callback +
              doğrulama. Hata olursa hangi adımda olduğu net görünür.
            </li>
            <li>
              <strong> Test verisini temizle:</strong> Tüm simülator
              test'leri silinir (auth user + order + items + events). Production
              müşterilerini ETKİLEMEZ — sadece <code className="font-mono bg-white px-1 rounded">simulator-*@pimetiket.test</code> ve <code className="font-mono bg-white px-1 rounded">PE-YYYY-SIM*</code> formatları.
            </li>
            <li>
              <strong>Önerilen test senaryosu:</strong> Yeni bir kod commit
              ettiğinde, deploy sonrası bu sayfayı aç → ▶ bas. 8/8 yeşilse
              güvenle canlıya itebilirsin.
            </li>
            <li>
              <strong>Hata bulduğun zaman:</strong> Kart başlığına tıkla,
              "Ham veri" alanı açılır. Stack trace + parametreler görünür.
              Logu kopyala/yapıştır → bana bildir, beraber çözeriz.
            </li>
          </ul>
        </Card>
      </div>
    </main>
  );
}
