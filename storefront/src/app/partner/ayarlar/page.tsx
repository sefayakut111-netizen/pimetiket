/**
 * /partner/ayarlar
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Skeleton, useToast } from "@/components/ui";

interface SettingsPayload {
  company: {
    name: string;
    taxNumber: string | null;
    taxOffice: string | null;
    addressLine: string | null;
    city: string | null;
    town: string | null;
  };
  contact: {
    id: string;
    name: string;
    email: string;
    phone: string;
    pendingEmail?: string | null;
  } | null;
  capabilities: {
    productTypes: string[];
    materials: string[];
  };
  notifications: {
    emailOnAssign: boolean;
    smsOnUrgent: boolean;
  };
}

export default function PartnerSettingsPage() {
  const toast = useToast();
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [emailOnAssign, setEmailOnAssign] = useState(true);
  const [smsOnUrgent, setSmsOnUrgent] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/partner/settings", { cache: "no-store" });
      if (!res.ok) throw new Error("load failed");
      const j = (await res.json()) as SettingsPayload;
      setData(j);
      if (j.contact) {
        setContactName(j.contact.name);
        setContactPhone(j.contact.phone);
        setContactEmail(j.contact.email);
        setPendingEmail(j.contact.pendingEmail ?? null);
      }
      setEmailOnAssign(j.notifications.emailOnAssign);
      setSmsOnUrgent(j.notifications.smsOnUrgent);
    } catch {
      toast.error("Ayarlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const verifyEmail = async () => {
    if (!verifyCode.trim()) {
      toast.error("6 haneli doğrulama kodunu girin");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("/api/partner/settings/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: verifyCode.trim() }),
      });
      const json = (await res.json()) as { error?: string; email?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Doğrulama başarısız");
        return;
      }
      toast.success("E-posta adresiniz doğrulandı ve güncellendi");
      setVerifyCode("");
      void load();
    } catch {
      toast.error("Doğrulama başarısız");
    } finally {
      setVerifying(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/partner/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contact: {
            name: contactName.trim(),
            phone: contactPhone.trim(),
            email: contactEmail.trim(),
          },
          notifications: {
            emailOnAssign,
            smsOnUrgent,
          },
        }),
      });
      const json = (await res.json()) as {
        emailPendingVerification?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        toast.error(json.error ?? "Kayıt başarısız");
        return;
      }
      if (json.emailPendingVerification) {
        toast.success(
          json.message ??
            "Doğrulama kodu yeni e-posta adresine gönderildi."
        );
      } else {
        toast.success("Ayarlar kaydedildi");
      }
      void load();
    } catch {
      toast.error("Kayıt başarısız");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 pb-24">
        <Skeleton className="mb-4 h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-sm text-gri-700">
        Ayarlar yüklenemedi.
      </div>
    );
  }

  const { company, capabilities } = data;

  return (
    <div className="p-4 md:p-6 pb-24 lg:pb-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-lacivert">Ayarlar</h1>
      <p className="mt-1 text-sm text-gri-700">
        Firma bilgilerin ve bildirim tercihlerin.
      </p>

      <section className="mt-6 rounded-2xl border border-gri-200 bg-white p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gri-600">
          Firma bilgileri
        </h2>
        <p className="mt-1 text-[12px] text-gri-500">
          Değiştirmek için{" "}
          <a
            href="mailto:info@pimetiket.com"
            className="text-pim-mercan font-semibold hover:underline"
          >
            info@pimetiket.com
          </a>
          &apos;a yazın.
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Firma" value={company.name} />
          <Row label="Vergi no" value={company.taxNumber ?? "—"} />
          <Row label="Vergi dairesi" value={company.taxOffice ?? "—"} />
          <Row label="Adres" value={company.addressLine ?? "—"} />
          <Row
            label="İl / İlçe"
            value={[company.city, company.town].filter(Boolean).join(" / ") || "—"}
          />
        </dl>
      </section>

      <section className="mt-4 rounded-2xl border border-gri-200 bg-white p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gri-600">
          İletişim
        </h2>
        <div className="mt-4 space-y-3">
          <Field label="Yetkili adı">
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="w-full rounded-lg border border-gri-200 px-3 py-2 text-[13px]"
            />
          </Field>
          <Field label="Telefon">
            <input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full rounded-lg border border-gri-200 px-3 py-2 text-[13px]"
              placeholder="5XX XXX XX XX"
            />
          </Field>
          <Field label="E-posta">
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full rounded-lg border border-gri-200 px-3 py-2 text-[13px]"
            />
            {pendingEmail && (
              <p className="mt-2 text-[12px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                <strong>{pendingEmail}</strong> adresine doğrulama kodu gönderildi.
                Kodu girmeden aktif e-posta değişmez.
              </p>
            )}
          </Field>
          {pendingEmail && (
            <Field label="E-posta doğrulama kodu">
              <div className="flex gap-2">
                <input
                  value={verifyCode}
                  onChange={(e) =>
                    setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputMode="numeric"
                  placeholder="6 haneli kod"
                  className="flex-1 rounded-lg border border-gri-200 px-3 py-2 text-[13px] tracking-widest"
                />
                <Button
                  variant="secondary"
                  onClick={() => void verifyEmail()}
                  disabled={verifying}
                >
                  {verifying ? "…" : "Doğrula"}
                </Button>
              </div>
            </Field>
          )}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-gri-200 bg-white p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gri-600">
          Malzeme kapasitesi
        </h2>
        <p className="mt-1 text-[12px] text-gri-500">
          Admin tarafından yönetilir.
        </p>
        <div className="mt-3">
          <p className="text-[12px] font-semibold text-gri-700 mb-1">
            Ürün grupları
          </p>
          <div className="flex flex-wrap gap-1.5">
            {capabilities.productTypes.length === 0 ? (
              <span className="text-sm text-gri-500">—</span>
            ) : (
              capabilities.productTypes.map((p) => (
                <span
                  key={p}
                  className="rounded-full bg-pim-mercan-tint px-2.5 py-1 text-[11px] font-semibold text-pim-mercan"
                >
                  {p}
                </span>
              ))
            )}
          </div>
        </div>
        <div className="mt-3">
          <p className="text-[12px] font-semibold text-gri-700 mb-1">
            Malzemeler
          </p>
          <div className="flex flex-wrap gap-1.5">
            {capabilities.materials.length === 0 ? (
              <span className="text-sm text-gri-500">—</span>
            ) : (
              capabilities.materials.map((m) => (
                <span
                  key={m}
                  className="rounded-full bg-gri-100 px-2.5 py-1 text-[11px] font-semibold text-lacivert"
                >
                  {m}
                </span>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-gri-200 bg-white p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gri-600">
          Bildirim tercihleri
        </h2>
        <div className="mt-4 space-y-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Yeni iş atandığında e-posta</span>
            <input
              type="checkbox"
              checked={emailOnAssign}
              onChange={(e) => setEmailOnAssign(e.target.checked)}
              className="h-5 w-5 rounded border-gri-300"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Acil iş atandığında SMS</span>
            <input
              type="checkbox"
              checked={smsOnUrgent}
              onChange={(e) => setSmsOnUrgent(e.target.checked)}
              className="h-5 w-5 rounded border-gri-300"
            />
          </label>
        </div>
      </section>

      <div className="mt-6 flex justify-end">
        <Button variant="primary" onClick={() => void save()} disabled={saving}>
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-gri-600">{label}</dt>
      <dd className="font-medium text-lacivert">{value}</dd>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[12px] font-semibold text-gri-700">
        {label}
      </label>
      {children}
    </div>
  );
}
