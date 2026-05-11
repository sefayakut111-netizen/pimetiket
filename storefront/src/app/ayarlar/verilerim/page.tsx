"use client";

/**
 * Pim Etiket — /ayarlar/verilerim
 *
 * KVKK m.11 ilgili kişi hakları self-serve sayfası:
 *   - Verilerimi indir (m.11/g — ZIP export)
 *   - Granular silme (sipariş / tasarım / Pim sohbet / yorum / profil)
 *   - Hesabımı tamamen sil (48 saat grace period)
 *
 * Sefa iş kuralı: Tasarım dosyaları "son baskıdan 24 ay" rolling window.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, Modal, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";

interface KvkkRequestRow {
  id: string;
  kind:
    | "data_export"
    | "account_delete"
    | "partial_delete"
    | "correction"
    | "objection"
    | "restriction";
  status:
    | "pending"
    | "confirmed"
    | "cancelled"
    | "processing"
    | "completed"
    | "rejected";
  scope: Record<string, boolean>;
  grace_period_until: string | null;
  cancelled_at: string | null;
  created_at: string;
  result_path: string | null;
}

const KIND_LABEL: Record<KvkkRequestRow["kind"], string> = {
  data_export: "Verilerimi indir",
  account_delete: "Hesabımı sil",
  partial_delete: "Seçili veriyi sil",
  correction: "Düzeltme talebi",
  objection: "İtiraz",
  restriction: "Sınırlandırma",
};

const STATUS_LABEL: Record<
  KvkkRequestRow["status"],
  { label: string; color: string }
> = {
  pending: { label: "E-posta onayı bekliyor", color: "bg-sari-soft text-sari-koyu" },
  confirmed: { label: "48 saat geri alma süresinde", color: "bg-pim-mercan-tint text-pim-mercan" },
  processing: { label: "İşleniyor", color: "bg-pim-mercan-tint text-pim-mercan" },
  completed: { label: "Tamamlandı", color: "bg-yesil-soft text-yesil" },
  cancelled: { label: "Vazgeçildi", color: "bg-gri-100 text-gri-700" },
  rejected: { label: "Reddedildi", color: "bg-kirmizi-soft text-kirmizi" },
};

interface ScopeMap {
  orders: boolean;
  designs: boolean;
  pim_chat: boolean;
  reviews: boolean;
  profile: boolean;
}

const DEFAULT_SCOPE: ScopeMap = {
  orders: false,
  designs: false,
  pim_chat: false,
  reviews: false,
  profile: false,
};

export default function VerilerimPage() {
  const router = useRouter();
  const toast = useToast();
  const [requests, setRequests] = useState<KvkkRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPartial, setShowPartial] = useState(false);
  const [showAccountDelete, setShowAccountDelete] = useState(false);
  const [scope, setScope] = useState<ScopeMap>(DEFAULT_SCOPE);
  const [exportSubmitting, setExportSubmitting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void fetch("/api/me/kvkk-requests", { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) {
          router.replace(`/auth?next=${encodeURIComponent("/ayarlar/verilerim")}`);
          return null;
        }
        if (!r.ok) throw new Error("list_failed");
        return r.json();
      })
      .then((json) => {
        if (json) setRequests(json.requests ?? []);
      })
      .catch(() => {
        /* silent */
      })
      .finally(() => setLoading(false));
  }, [router]);

  const requestExport = async () => {
    setExportSubmitting(true);
    try {
      const res = await fetch("/api/me/kvkk-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "data_export" }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Talep oluşturulamadı");
        return;
      }
      toast.success("Veri dışa aktarım talebin alındı. ZIP hazır olunca mail atacağız.");
      setRequests((arr) => [json.request, ...arr]);
    } finally {
      setExportSubmitting(false);
    }
  };

  const submitPartialDelete = async () => {
    if (!Object.values(scope).some(Boolean)) {
      toast.error("En az bir veri tipi seç");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/me/kvkk-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "partial_delete", scope }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Talep oluşturulamadı");
        return;
      }
      toast.success("Talebin alındı. 48 saat içinde vazgeçebilirsin.");
      setRequests((arr) => [json.request, ...arr]);
      setShowPartial(false);
      setScope(DEFAULT_SCOPE);
    } finally {
      setSubmitting(false);
    }
  };

  const submitAccountDelete = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/me/kvkk-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "account_delete" }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Talep oluşturulamadı");
        return;
      }
      toast.success("Talebin alındı. 48 saat içinde vazgeçebilirsin.");
      setRequests((arr) => [json.request, ...arr]);
      setShowAccountDelete(false);
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = async (id: string) => {
    if (!confirm("Bu talebi geri almak istediğine emin misin?")) return;
    const res = await fetch(`/api/me/kvkk-requests/${id}/cancel`, {
      method: "POST",
    });
    if (!res.ok) {
      toast.error("Geri alınamadı");
      return;
    }
    toast.success("Talep iptal edildi");
    setRequests((arr) =>
      arr.map((r) =>
        r.id === id
          ? { ...r, status: "cancelled" as const, cancelled_at: new Date().toISOString() }
          : r
      )
    );
  };

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[840px] px-6">
        <div className="mb-6">
          <Eyebrow>KVKK m.11 · Veri hakların</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Verilerim
          </h1>
          <p className="mt-1.5 text-base text-gri-700 leading-relaxed">
            Hesabındaki verileri görüntüle, indir veya sil. Saklama
            süreleri için{" "}
            <Link
              href="/kvkk#6-saklama-sureleri"
              className="text-pim-mercan font-semibold hover:underline"
            >
              KVKK metnine bak
            </Link>
            .
          </p>
        </div>

        {/* Aktif/geçmiş talepler */}
        {!loading && requests.length > 0 && (
          <Card padding="p-5" className="mb-5">
            <h2 className="font-semibold text-base mb-3">Talep geçmişin</h2>
            <ul className="space-y-2">
              {requests.map((r) => {
                const meta = STATUS_LABEL[r.status];
                const canCancel = r.status === "pending" || r.status === "confirmed";
                return (
                  <li
                    key={r.id}
                    className="flex items-start justify-between gap-3 p-3 rounded-lg bg-gri-50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[13.5px]">
                          {KIND_LABEL[r.kind]}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center h-[20px] px-2 rounded-full text-[10.5px] font-semibold",
                            meta.color
                          )}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <div className="text-[11.5px] text-gri-700 mt-1">
                        {new Date(r.created_at).toLocaleString("tr-TR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {r.grace_period_until && r.status === "confirmed" && (
                          <>
                            {" · "}
                            <strong>
                              {new Date(r.grace_period_until).toLocaleString("tr-TR", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                              })}
                            </strong>
                            &apos;e kadar vazgeçebilirsin
                          </>
                        )}
                      </div>
                    </div>
                    {canCancel && (
                      <Button variant="ghost" size="sm" onClick={() => cancelRequest(r.id)}>
                        Vazgeç
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {/* Verilerimi indir */}
        <Card padding="p-5" className="mb-4">
          <div className="flex gap-4 items-start">
            <div className="grid place-items-center w-10 h-10 rounded-xl bg-pim-mercan-tint text-pim-mercan shrink-0">
              <Icon.Box size={18} />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-base mb-1">Verilerimi indir</h2>
              <p className="text-[13px] text-gri-700 leading-relaxed mb-3">
                Hesabındaki tüm sipariş, tasarım kayıtları, adresler ve
                Pim sohbet geçmişini ZIP olarak göndereyim. Birkaç dakika
                sürebilir, e-postana atarım.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={requestExport}
                disabled={exportSubmitting}
              >
                {exportSubmitting ? "Hazırlanıyor…" : "ZIP isteğinde bulun"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Granular silme */}
        <Card padding="p-5" className="mb-4">
          <div className="flex gap-4 items-start">
            <div className="grid place-items-center w-10 h-10 rounded-xl bg-sari-soft text-sari-koyu shrink-0">
              <Icon.Info size={18} />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-base mb-1">Belirli verileri sil</h2>
              <p className="text-[13px] text-gri-700 leading-relaxed mb-3">
                Hesabın açık kalsın, sadece seçtiğin veri tipleri silinsin.
                Örnek: Pim sohbet geçmişini sil, sipariş kayıtları kalsın.{" "}
                <strong>Bu işlemler geri alınamaz</strong> (fatura kayıtları
                yasal süre dolana kadar arşivde durur).
              </p>
              <Button variant="secondary" size="sm" onClick={() => setShowPartial(true)}>
                Seçili silme talebi başlat
              </Button>
            </div>
          </div>
        </Card>

        {/* Hesabımı tamamen sil */}
        <Card padding="p-5" className="mb-4 !ring-kirmizi/30">
          <div className="flex gap-4 items-start">
            <div className="grid place-items-center w-10 h-10 rounded-xl bg-kirmizi-soft text-kirmizi shrink-0">
              <Icon.Info size={18} />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-base mb-1 text-kirmizi">
                Hesabımı tamamen sil
              </h2>
              <p className="text-[13px] text-gri-700 leading-relaxed mb-3">
                E-postanı doğrularsan 48 saat geri alma süresi başlar. Süre
                dolduğunda sipariş geçmişin, tasarımların ve adreslerin
                silinir. Fatura kayıtların yasa gereği (VUK + TTK 10 yıl)
                kilitli arşivde durur, sonra otomatik silinir.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAccountDelete(true)}
                className="!text-kirmizi"
              >
                Silme talebini başlat →
              </Button>
            </div>
          </div>
        </Card>

        {/* Bilgi: Diğer haklar */}
        <Card padding="p-5" className="!bg-krem-soft !ring-krem">
          <div className="flex gap-3 items-start">
            <Pim pose="inspect" size={64} />
            <div className="flex-1 text-[12.5px] text-gri-700 leading-relaxed">
              <h3 className="font-semibold text-[14px] text-lacivert mb-1.5">
                Diğer hakların
              </h3>
              <p>
                Yukarıdakilerin dışında <strong>düzeltme, itiraz</strong> ve{" "}
                <strong>sınırlandırma</strong> haklarını kullanmak istersen{" "}
                <Link
                  href="/iletisim"
                  className="text-pim-mercan font-semibold hover:underline"
                >
                  iletişim sayfasından
                </Link>{" "}
                bize yaz. 48 saat içinde dönüş yaparız (azami yasal süre 30 gün).
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Partial delete modal */}
      {showPartial && (
        <Modal
          open={true}
          onClose={() => setShowPartial(false)}
          title="Hangi verileri silelim?"
        >
          <p className="text-[13px] text-gri-700 leading-relaxed mb-3">
            İşaretlediğin veriler 48 saat içinde silinir. Bu işlemler{" "}
            <strong>geri alınamaz</strong>.
          </p>
          <div className="space-y-2">
            <ScopeCheckbox
              label="Pim asistanı sohbet geçmişim"
              checked={scope.pim_chat}
              onChange={(v) => setScope({ ...scope, pim_chat: v })}
            />
            <ScopeCheckbox
              label="Kayıtlı tasarımlarım"
              hint="Aktif siparişlerin etkilenmez"
              checked={scope.designs}
              onChange={(v) => setScope({ ...scope, designs: v })}
            />
            <ScopeCheckbox
              label="Yorumlarım"
              checked={scope.reviews}
              onChange={(v) => setScope({ ...scope, reviews: v })}
            />
            <ScopeCheckbox
              label="Adres defterim + profil bilgilerim"
              hint="Hesabın açık kalır ama bilgiler silinir"
              checked={scope.profile}
              onChange={(v) => setScope({ ...scope, profile: v })}
            />
            <ScopeCheckbox
              label="Sipariş geçmişim"
              hint="Fatura kayıtları yasal süre kadar arşivde kalır"
              checked={scope.orders}
              onChange={(v) => setScope({ ...scope, orders: v })}
            />
          </div>
          <div className="mt-5 flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setShowPartial(false)}>
              Vazgeç
            </Button>
            <Button variant="primary" onClick={submitPartialDelete} disabled={submitting}>
              {submitting ? "Gönderiliyor…" : "Talebimi gönder"}
            </Button>
          </div>
        </Modal>
      )}

      {/* Account delete modal */}
      {showAccountDelete && (
        <Modal
          open={true}
          onClose={() => setShowAccountDelete(false)}
          title="Hesabını gerçekten silelim mi?"
        >
          <div className="space-y-3 text-[13px] leading-relaxed text-gri-700">
            <p>
              <strong>Olacaklar:</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>48 saatlik geri alma süresi</strong> başlar — istediğin
                zaman vazgeçebilirsin.
              </li>
              <li>
                Süre dolduğunda siparişlerin, tasarımların, adreslerin ve Pim
                sohbet geçmişin silinir.
              </li>
              <li>
                Fatura kayıtların yasa gereği (VUK + TTK 10 yıl) kilitli arşivde
                durur — pazarlama veya analiz için kullanılmaz, süre dolunca
                otomatik silinir.
              </li>
              <li>
                Üretim ortağımıza önceden aktarılmış dosyalar en geç 30 gün
                içinde imha edilir.
              </li>
            </ul>
          </div>
          <div className="mt-5 flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setShowAccountDelete(false)}>
              Vazgeç
            </Button>
            <Button
              variant="primary"
              onClick={submitAccountDelete}
              disabled={submitting}
              className="!bg-kirmizi"
            >
              {submitting ? "Gönderiliyor…" : "Evet, hesabımı sil"}
            </Button>
          </div>
        </Modal>
      )}
    </main>
  );
}

function ScopeCheckbox({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-lg bg-gri-50 hover:bg-gri-100 cursor-pointer transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-pim-mercan shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-lacivert">{label}</div>
        {hint && <div className="text-[11.5px] text-gri-700 mt-0.5">{hint}</div>}
      </div>
    </label>
  );
}
