/**
 * Pim Etiket — /adreslerim (E.2.4)
 *
 * Sefa 17 May: Adres yönetim sayfası — MAX 5 (Migration 044 trigger).
 * Çalışan ekle/sil/varsayılan modal + form.
 */

"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import {
  Button,
  Card,
  Input,
  Eyebrow,
  useToast,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/context";
import {
  listMyAddresses,
  createMyAddress,
  setDefaultAddress as dbSetDefault,
  deleteMyAddress as dbDelete,
  type CustomerAddress,
} from "@/lib/customer-profile";
import { ensureAuthBindings } from "@/lib/customer-cart";
import { isLoggedInSync } from "@/lib/supabase/auth-bridge";
import { TR_IL_LIST, getIlceler } from "@/lib/locations/tr-locations";
import {
  parseTrPhoneToLocal,
  dbPhoneToInputValue,
} from "@/lib/validation/phone-tr";

const COPY = {
  tr: {
    eyebrow: "Hesabım",
    title: "Adres defterim",
    summary: (n: number) => `${n}/5 kayıtlı adres`,
    intro:
      "Sipariş esnasında hızlı seçim için adreslerini buradan yönet. Maksimum 5 adres kaydedebilirsin.",
    addNew: "Yeni adres ekle",
    limitReached:
      "Maksimum 5 adres kaydedebilirsin. Yeni eklemek için birini silmen lazım.",
    emptyTitle: "Henüz adres yok",
    emptyDesc: "Sipariş verirken hızlı seçim için adres ekle.",
    defaultBadge: "Varsayılan",
    setDefault: "Varsayılan yap",
    deleteRow: "Sil",
    confirmDelete: "Bu adresi silmek istediğine emin misin?",
    deleted: "Adres silindi",
    defaultUpdated: "Varsayılan adres güncellendi",
    addressSaved: "Adres kaydedildi",
    // Modal
    modalTitle: "Yeni adres ekle",
    labelLabel: "Etiket",
    labelPh: "Ev / Ofis / Atölye",
    nameLabel: "Ad Soyad",
    namePh: "Sefa Yakut",
    addrLabel: "Adres (mahalle + sokak + no)",
    addrPh: "Beştepeler Mah. Nergis Sok. No:7/2",
    cityLabel: "Şehir",
    districtLabel: "İlçe",
    phoneLabel: "Telefon",
    saveDefault: "Bu adresi varsayılan yap",
    cancel: "İptal",
    save: "Kaydet",
  },
  en: {
    eyebrow: "My account",
    title: "Address book",
    summary: (n: number) => `${n}/5 saved addresses`,
    intro:
      "Manage your addresses for quick checkout selection. Up to 5 addresses can be saved.",
    addNew: "Add new address",
    limitReached: "Maximum 5 addresses can be saved. Delete one to add new.",
    emptyTitle: "No address yet",
    emptyDesc: "Add an address for quick selection at checkout.",
    defaultBadge: "Default",
    setDefault: "Set as default",
    deleteRow: "Delete",
    confirmDelete: "Delete this address?",
    deleted: "Address deleted",
    defaultUpdated: "Default address updated",
    addressSaved: "Address saved",
    modalTitle: "Add new address",
    labelLabel: "Label",
    labelPh: "Home / Office / Workshop",
    nameLabel: "Full name",
    namePh: "John Doe",
    addrLabel: "Street address",
    addrPh: "123 Main St, Apt 7",
    cityLabel: "City",
    districtLabel: "District",
    phoneLabel: "Phone",
    saveDefault: "Set as default",
    cancel: "Cancel",
    save: "Save",
  },
};

export default function AdreslerimPage() {
  const { locale } = useT();
  const c = locale === "en" ? COPY.en : COPY.tr;
  const toast = useToast();

  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    label: "",
    name: "",
    addr: "",
    city: "",
    district: "",
    phone: "",
    isDefault: false,
  });

  useEffect(() => {
    ensureAuthBindings();
    void (async () => {
      const fromDb = await listMyAddresses();
      setAddresses(fromDb);
      setHydrated(true);
    })();
  }, []);

  const limitReached = addresses.length >= 5;

  const openAddModal = () => {
    if (limitReached) {
      toast.error(c.limitReached);
      return;
    }
    setForm({
      label: "",
      name: "",
      addr: "",
      city: "",
      district: "",
      phone: "",
      isDefault: addresses.length === 0,
    });
    setShowModal(true);
  };

  const onSave = async () => {
    if (!isLoggedInSync()) {
      toast.error("Giriş yapman gerekiyor.");
      return;
    }
    if (form.name.trim().length < 2) {
      toast.error("Ad Soyad girmen lazım.");
      return;
    }
    if (form.addr.trim().length < 4) {
      toast.error("Açık adres girmen lazım.");
      return;
    }
    if (!form.city) {
      toast.error("Şehir seçmen lazım.");
      return;
    }
    if (!form.district) {
      toast.error("İlçe seçmen lazım.");
      return;
    }
    if (form.phone.trim().length < 10) {
      toast.error("Telefon numarası girmen lazım (10 hane).");
      return;
    }
    setSaving(true);
    const combinedAddr = [form.addr, form.district, form.city, "Türkiye"]
      .filter((s) => s && s.trim().length > 0)
      .join(", ");
    const r = await createMyAddress({
      label: form.label.trim() || null,
      name: form.name.trim(),
      addr: combinedAddr,
      city: form.city,
      phone: form.phone.startsWith("+90") ? form.phone : `+90${form.phone}`,
      isDefault: form.isDefault,
    });
    setSaving(false);
    if (!r) {
      toast.error("Kaydedilemedi (5 limit aşılmış olabilir).");
      return;
    }
    toast.success(c.addressSaved);
    setShowModal(false);
    const fresh = await listMyAddresses();
    setAddresses(fresh);
  };

  const setDefault = async (id: string) => {
    const r = await dbSetDefault(id);
    if (r.ok) {
      setAddresses((arr) =>
        arr.map((a) => ({ ...a, isDefault: a.id === id }))
      );
      toast.success(c.defaultUpdated);
    }
  };

  const remove = async (id: string) => {
    if (typeof window !== "undefined" && !window.confirm(c.confirmDelete)) {
      return;
    }
    const r = await dbDelete(id);
    if (r.ok) {
      setAddresses((arr) => arr.filter((a) => a.id !== id));
      toast.success(c.deleted);
    }
  };

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[900px] px-4 md:px-8">
        <div className="flex items-end justify-between gap-4 mb-7 flex-wrap">
          <div>
            <Eyebrow>{c.eyebrow}</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
              {c.title}
            </h1>
            <p className="mt-2 text-base text-gri-700">
              {c.summary(addresses.length)}
            </p>
            <p className="mt-1 text-[13px] text-gri-500 leading-relaxed max-w-[600px]">
              {c.intro}
            </p>
          </div>
          {!limitReached && hydrated && (
            <Button variant="primary" onClick={openAddModal}>
              <Icon.Plus size={16} /> {c.addNew}
            </Button>
          )}
        </div>

        {limitReached && (
          <div className="mb-4 rounded-lg bg-saman/15 ring-1 ring-saman/30 px-4 py-3 text-[13px] text-saman-koyu">
            ℹ {c.limitReached}
          </div>
        )}

        {hydrated && addresses.length === 0 ? (
          <Card padding="p-12" className="text-center">
            <Icon.Truck size={48} className="text-gri-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">{c.emptyTitle}</h3>
            <p className="text-base text-gri-700 mb-5">{c.emptyDesc}</p>
            <Button variant="primary" onClick={openAddModal}>
              <Icon.Plus size={16} /> {c.addNew}
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {addresses.map((a) => (
              <Card
                key={a.id}
                padding="p-5"
                className={cn(a.isDefault && "ring-2 !ring-pim-mercan")}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <h3 className="font-semibold text-base truncate">
                      {a.label ?? "Adres"}
                    </h3>
                    {a.isDefault && (
                      <span className="inline-flex items-center h-[20px] px-2 rounded-full bg-pim-mercan-tint text-pim-mercan text-[11px] font-semibold shrink-0">
                        {c.defaultBadge}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-[13px] text-gri-700 leading-relaxed mb-4">
                  <div className="font-semibold text-lacivert">{a.name}</div>
                  <div>{a.addr}</div>
                  <div>{a.city}</div>
                  <div className="font-mono">{a.phone}</div>
                </div>
                <div className="flex gap-2 flex-wrap pt-3 border-t border-gri-200">
                  {!a.isDefault && (
                    <button
                      type="button"
                      onClick={() => setDefault(a.id)}
                      className="text-[13px] font-semibold text-pim-mercan hover:underline"
                    >
                      {c.setDefault}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(a.id)}
                    className="text-[13px] font-semibold text-kirmizi hover:underline ml-auto inline-flex items-center gap-1"
                  >
                    🗑 {c.deleteRow}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ============ ADD MODAL ============ */}
      {showModal && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/40 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <Card
            padding="p-6"
            className="max-w-[540px] w-full max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-xl font-semibold mb-4">{c.modalTitle}</h3>
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="form-addr-label"
                  className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1"
                >
                  {c.labelLabel}{" "}
                  <span className="text-gri-500 normal-case font-normal tracking-normal">
                    (opsiyonel)
                  </span>
                </label>
                <Input
                  id="form-addr-label"
                  value={form.label}
                  onChange={(e) =>
                    setForm({ ...form, label: e.target.value })
                  }
                  placeholder={c.labelPh}
                />
              </div>
              <div>
                <label
                  htmlFor="form-addr-name"
                  className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1"
                >
                  {c.nameLabel} <span className="text-kirmizi">*</span>
                </label>
                <Input
                  id="form-addr-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={c.namePh}
                  autoComplete="name"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="form-addr-phone"
                  className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1"
                >
                  {c.phoneLabel} <span className="text-kirmizi">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="flex items-center gap-1.5 px-3 h-12 rounded-[12px] bg-gri-50 ring-1 ring-gri-200 text-[14px] font-semibold text-lacivert shrink-0">
                    🇹🇷 <span>+90</span>
                  </div>
                  <Input
                    id="form-addr-phone"
                    placeholder="5XX XXX XX XX"
                    value={dbPhoneToInputValue(form.phone)}
                    onChange={(e) => {
                      // Sefa 17 May P0-1: helper kullan
                      const local10 = parseTrPhoneToLocal(e.target.value);
                      setForm({ ...form, phone: local10 });
                    }}
                    autoComplete="tel-national"
                    inputMode="tel"
                    maxLength={10}
                    required
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="form-addr-addr"
                  className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1"
                >
                  {c.addrLabel} <span className="text-kirmizi">*</span>
                </label>
                <Input
                  id="form-addr-addr"
                  value={form.addr}
                  onChange={(e) => setForm({ ...form, addr: e.target.value })}
                  placeholder={c.addrPh}
                  autoComplete="street-address"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1">
                    {c.cityLabel} <span className="text-kirmizi">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={form.city}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          city: e.target.value,
                          district: "",
                        })
                      }
                      autoComplete="address-level1"
                      required
                      className="w-full h-11 pl-3 pr-9 rounded-lg bg-white ring-1 ring-gri-200 text-[13.5px] text-lacivert focus:outline-none focus:ring-pim-mercan appearance-none cursor-pointer"
                    >
                      <option value="">Seç...</option>
                      {TR_IL_LIST.map((il) => (
                        <option key={il} value={il}>
                          {il}
                        </option>
                      ))}
                    </select>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gri-500 pointer-events-none"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1">
                    {c.districtLabel}{" "}
                    <span className="text-kirmizi">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={form.district}
                      onChange={(e) =>
                        setForm({ ...form, district: e.target.value })
                      }
                      autoComplete="address-level2"
                      required
                      disabled={!form.city}
                      className="w-full h-11 pl-3 pr-9 rounded-lg bg-white ring-1 ring-gri-200 text-[13.5px] text-lacivert focus:outline-none focus:ring-pim-mercan disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer"
                    >
                      <option value="">
                        {form.city ? "Seç..." : "Önce şehir seç"}
                      </option>
                      {getIlceler(form.city).map((ilce) => (
                        <option key={ilce} value={ilce}>
                          {ilce}
                        </option>
                      ))}
                    </select>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gri-500 pointer-events-none"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
              </div>
              <label className="flex items-start gap-2 text-[13px] text-gri-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) =>
                    setForm({ ...form, isDefault: e.target.checked })
                  }
                  className="mt-0.5 accent-pim-mercan"
                  disabled={addresses.length === 0}
                />
                <span>
                  {c.saveDefault}
                  {addresses.length === 0 && (
                    <span className="text-[11.5px] text-gri-500 italic block mt-0.5">
                      (İlk kayıt otomatik varsayılan olur)
                    </span>
                  )}
                </span>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setShowModal(false)}
                disabled={saving}
              >
                {c.cancel}
              </Button>
              <Button variant="primary" onClick={onSave} disabled={saving}>
                {saving ? "..." : c.save}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
