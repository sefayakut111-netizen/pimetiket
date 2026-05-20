/**
 * Pim Etiket — /iade-talep
 *
 * Müşteri iade başlatma formu. Sipariş seç + sebep + açıklama + foto.
 *
 * NOT: Kişiselleştirilmiş ürünlerde TKHK m.15/b ile cayma hakkı yok,
 * AMA üretim hatası / kargo hasarı / yanlış ürün için iade hakkı kalır.
 * Form sebepleri bu çerçevede.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  listCustomerOrders,
  refreshCustomerOrders,
  type CustomerOrder,
} from "@/lib/customer-order";
import { createReturn, type ReturnReason } from "@/lib/customer-return";
import { ensureAuthBindings } from "@/lib/customer-cart";
import { useT } from "@/lib/i18n/context";

const REASON_OPTIONS: ReturnReason[] = [
  "uretim_hatasi",
  "kargo_hasari",
  "yanlis_urun",
  "kalite_problemi",
  "diger",
];

const COPY = {
  tr: {
    breadPanel: "Panelim",
    breadReturns: "İadelerim",
    breadNew: "Yeni iade talebi",
    eyebrow: "İade talebi",
    titleEmpty: "İade için uygun sipariş yok",
    descEmpty:
      "İade sadece üretime alınmış, kargoya verilmiş veya teslim edilmiş siparişler için açıktır. Henüz uygun siparişin görünmüyor.",
    backToOrders: "Siparişlerime bak",
    contactUs: "Bize yaz",
    title: "Sipariş iade talebi oluştur",
    intro: (
      <>
        Üretim hatası, kargo hasarı, yanlış ürün gibi durumlarda iade talebi
        açabilirsin. <strong>Kişiselleştirilmiş ürünlerde</strong> cayma hakkı
        yok (TKHK m.15/b), ama üretim hatası bizim sorumluluğumuz.
      </>
    ),
    step1: "1. Sipariş",
    step2: "2. Sebep",
    step3: "3. Açıklama (en az 20 karakter)",
    step4: "4. Görseller (opsiyonel ama önerilir)",
    descriptionPh:
      "Sorunu kısa anlat: ne bekliyordun, ne aldın? Boyut, renk, kargo durumu… Pim mümkün olduğunca hızlı çözer.",
    photoIntro:
      "Üretim hatası / kargo hasarı için fotoğraf çok yardımcı olur. Aldığın ürünü ve problemi gösteren 1-3 foto yükle.",
    addMock: "Foto ekle (mock)",
    photoMockNote: (
      <>Gerçek dosya yükleme akışı Faz 2&rsquo;de aktif olacak.</>
    ),
    cancel: "İptal",
    submit: "İade talebi gönder",
    submitting: "Gönderiliyor...",
    loading: "Yükleniyor…",
    multiOrder: (n: number) => `${n} ürünlük sipariş`,
    pcs: "adet",
    currency: "₺",
    remove: "Kaldır",
    mockAdded: (file: string) =>
      `${file} eklendi (mock — gerçek upload Faz 2)`,
    requestCreated: (id: string) =>
      `İade talebi oluşturuldu: ${id.slice(0, 8)}…`,
    unexpectedErr: "Beklenmedik hata",
    reasonLabel: {
      yanlis_urun: "Yanlış ürün geldi",
      uretim_hatasi: "Üretim hatası (renk/baskı bozuk)",
      kargo_hasari: "Kargo hasarı",
      kalite_problemi: "Kalite problemi",
      diger: "Diğer",
    } as Record<ReturnReason, string>,
    locale: "tr-TR",
  },
  en: {
    breadPanel: "Dashboard",
    breadReturns: "My returns",
    breadNew: "New return request",
    eyebrow: "Return request",
    titleEmpty: "No eligible order for return",
    descEmpty:
      "Returns are only available for orders that are in production, in transit, or delivered. You don't have an eligible order yet.",
    backToOrders: "View my orders",
    contactUs: "Contact us",
    title: "Open a return request",
    intro: (
      <>
        You can open a return request for production errors, shipping damage,
        or wrong items. <strong>Personalized products</strong> have no
        cancellation right (Turkish Consumer Law art.15/b), but production
        errors are our responsibility.
      </>
    ),
    step1: "1. Order",
    step2: "2. Reason",
    step3: "3. Description (at least 20 characters)",
    step4: "4. Photos (optional but recommended)",
    descriptionPh:
      "Briefly describe the issue: what did you expect, what did you get? Size, color, shipping condition… Pim will resolve it as fast as possible.",
    photoIntro:
      "For production errors / shipping damage, photos help a lot. Upload 1-3 photos showing the product and the issue.",
    addMock: "Add photo (mock)",
    photoMockNote: <>Real file upload will be active in Phase 2.</>,
    cancel: "Cancel",
    submit: "Submit return request",
    submitting: "Submitting...",
    loading: "Loading…",
    multiOrder: (n: number) => `Order with ${n} items`,
    pcs: "units",
    currency: "TRY",
    remove: "Remove",
    mockAdded: (file: string) =>
      `${file} added (mock — real upload in Phase 2)`,
    requestCreated: (id: string) => `Return request created: ${id.slice(0, 8)}…`,
    unexpectedErr: "Unexpected error",
    reasonLabel: {
      yanlis_urun: "Wrong product received",
      uretim_hatasi: "Production error (color/print)",
      kargo_hasari: "Shipping damage",
      kalite_problemi: "Quality issue",
      diger: "Other",
    } as Record<ReturnReason, string>,
    locale: "en-US",
  },
};

export default function IadeTalepPage() {
  const { locale } = useT();
  const c = locale === "en" ? COPY.en : COPY.tr;

  const router = useRouter();
  const toast = useToast();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState<ReturnReason>("uretim_hatasi");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    ensureAuthBindings();
    void refreshCustomerOrders().then(() => {
      const eligible = listCustomerOrders().filter(
        (o) =>
          o.status === "delivered" ||
          o.status === "shipped" ||
          o.status === "in_production"
      );
      setOrders(eligible);
      setHydrated(true);
    });
  }, []);

  const selectedOrder = orders.find((o) => o.id === orderId);
  const canSubmit =
    orderId && description.trim().length >= 20 && !loading;

  const onAddMockFile = () => {
    const fileName = `foto_${Date.now() % 10000}.jpg`;
    setAttachments((arr) => [...arr, fileName]);
    toast.info(c.mockAdded(fileName));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !selectedOrder) return;
    setLoading(true);
    try {
      const created = await createReturn({
        orderId,
        customerName: selectedOrder.address.name,
        customerEmail: "musteri@ornek.com", // auth gelene kadar
        reason,
        description: description.trim(),
        attachments,
      });
      toast.success(c.requestCreated(created.id));
      setTimeout(() => {
        router.push("/iadelerim");
      }, 800);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : c.unexpectedErr);
      setLoading(false);
    }
  };

  if (!hydrated) {
    return (
      <main className="bg-gri-50 min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[480px] px-6 text-center text-gri-500">
          {c.loading}
        </div>
      </main>
    );
  }

  if (orders.length === 0) {
    return (
      <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[520px] px-6 text-center">
          <Pim pose="think" size={140} />
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <h1 className="mt-3 text-[26px] md:text-[32px] font-semibold tracking-tight">
            {c.titleEmpty}
          </h1>
          <p className="mt-3 text-base text-gri-700 leading-relaxed">
            {c.descEmpty}
          </p>
          <div className="mt-6 flex gap-3 justify-center flex-wrap">
            <Button variant="primary" size="lg" href="/siparislerim">
              {c.backToOrders}
            </Button>
            {/* Sefa 17 May P2-30: link hedefi (/iletisim) belirsizdi —
                buton label'ına "→ İletişim sayfasına git" suffix eklendi */}
            <Button variant="secondary" size="lg" href="/iletisim">
              <Icon.ChatBubble size={16} /> {c.contactUs} → İletişim
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[760px] px-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[14px] mb-5">
          <Link
            href="/panelim"
            className="px-2 py-1 rounded text-gri-700 hover:bg-gri-100 hover:text-lacivert"
          >
            {c.breadPanel}
          </Link>
          <Icon.ChevR size={14} className="text-gri-500" />
          <Link
            href="/iadelerim"
            className="px-2 py-1 rounded text-gri-700 hover:bg-gri-100 hover:text-lacivert"
          >
            {c.breadReturns}
          </Link>
          <Icon.ChevR size={14} className="text-gri-500" />
          <span className="font-semibold">{c.breadNew}</span>
        </div>

        <div className="mb-6">
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            {c.title}
          </h1>
          <p className="mt-2 text-base text-gri-700 leading-relaxed">
            {c.intro}
          </p>
        </div>

        <form onSubmit={onSubmit}>
          {/* Step 1 — Sipariş seç */}
          <Card padding="p-6" className="mb-4">
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-3">
              {c.step1}
            </div>
            <div className="flex flex-col gap-2">
              {orders.map((o) => {
                const totalQty = o.items.reduce((s, i) => s + i.qty, 0);
                const title =
                  o.items.length === 1
                    ? o.items[0].title
                    : c.multiOrder(o.items.length);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setOrderId(o.id)}
                    aria-pressed={orderId === o.id}
                    className={cn(
                      "text-left p-3.5 rounded-lg ring-[1.5px] transition-all",
                      orderId === o.id
                        ? "ring-pim-mercan bg-pim-mercan-tint/40"
                        : "ring-gri-200 bg-white hover:ring-pim-mercan-soft"
                    )}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[12.5px] text-gri-700">
                          {o.id}
                        </div>
                        <div className="font-semibold text-[15px] mt-0.5 truncate">
                          {title}
                        </div>
                        <div className="text-[12.5px] text-gri-500 mt-0.5">
                          {totalQty.toLocaleString(c.locale)} {c.pcs} ·{" "}
                          {Math.round(o.total).toLocaleString(c.locale)}{" "}
                          {c.currency}
                        </div>
                      </div>
                      {orderId === o.id && (
                        <span className="grid place-items-center w-6 h-6 rounded-full bg-pim-mercan text-white shrink-0">
                          <Icon.Check size={12} />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Step 2 — Sebep */}
          <Card padding="p-6" className="mb-4">
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-3">
              {c.step2}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {REASON_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  aria-pressed={reason === r}
                  className={cn(
                    "text-left p-3 rounded-lg ring-[1.5px] transition-all text-[13.5px]",
                    reason === r
                      ? "ring-pim-mercan bg-pim-mercan-tint/40 font-semibold text-lacivert"
                      : "ring-gri-200 bg-white hover:ring-pim-mercan-soft text-gri-700"
                  )}
                >
                  {c.reasonLabel[r]}
                </button>
              ))}
            </div>
          </Card>

          {/* Step 3 — Açıklama */}
          <Card padding="p-6" className="mb-4">
            <label className="block">
              <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-3">
                {c.step3}
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={c.descriptionPh}
                rows={5}
                className="block w-full px-3.5 py-2.5 rounded-[12px] bg-white text-[14px] text-lacivert ring-1 ring-gri-200 focus:outline-none focus:ring-pim-mercan focus:shadow-[0_0_0_4px_var(--color-pim-mercan-tint)] transition-shadow resize-none"
              />
              <div className="text-[12px] text-gri-500 mt-1.5 tabular-nums">
                {description.length}/500
              </div>
            </label>
          </Card>

          {/* Step 4 — Foto (mock) */}
          <Card padding="p-6" className="mb-4">
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-3">
              {c.step4}
            </div>
            <p className="text-[13px] text-gri-700 mb-3 leading-relaxed">
              {c.photoIntro}
            </p>
            <div className="flex gap-2 flex-wrap mb-3">
              {attachments.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-pim-mercan-tint text-pim-mercan text-[12px] font-semibold"
                >
                  <Icon.Box size={12} /> {f}
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments((arr) => arr.filter((x) => x !== f))
                    }
                    className="ml-1 hover:text-pim-mercan-koyu"
                    aria-label={c.remove}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onAddMockFile}
              disabled={attachments.length >= 3}
            >
              <Icon.Plus size={14} /> {c.addMock}
            </Button>
            <div className="text-[11.5px] text-gri-500 mt-3 leading-relaxed">
              {c.photoMockNote}
            </div>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
            >
              {c.cancel}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={!canSubmit}
            >
              {loading ? c.submitting : c.submit}{" "}
              {!loading && <Icon.ArrowR />}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
