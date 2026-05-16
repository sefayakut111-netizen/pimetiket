/**
 * Pim Etiket — /fatura-bilgileri (E.2.4)
 *
 * Sefa 17 May: Kurumsal fatura profilleri (max 2 — Migration 044).
 *
 * 2 bölüm:
 *   1. Bireysel TC kimlik (profile.tc — tek değer)
 *   2. Kurumsal fatura profilleri (customer_invoice_profiles — max 2)
 *      - Liste
 *      - Yeni ekle (modal form)
 *      - Sil (confirm)
 *      - Varsayılan işaretle
 */

"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Input,
  ValidatedInput,
  Eyebrow,
  useToast,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/Icon";
import { useT } from "@/lib/i18n/context";
import { validateTcKimlik, validateVkn } from "@/lib/validation";
import {
  getMyProfile,
  updateMyInvoiceInfo,
} from "@/lib/customer-profile";
import {
  listMyInvoiceProfiles,
  createMyInvoiceProfile,
  deleteMyInvoiceProfile,
  setDefaultInvoiceProfile,
  type CustomerInvoiceProfile,
} from "@/lib/customer-invoice";
import { ensureAuthBindings } from "@/lib/customer-cart";

const COPY = {
  tr: {
    eyebrow: "Hesabım",
    title: "Fatura bilgileri",
    intro:
      "Sipariş ödendiğinde otomatik olarak fatura kesilir. Bireysel TC kimlik ve kurumsal fatura profillerini buradan yönet.",
    // Individual
    individualTitle: "Bireysel — TC Kimlik No",
    individualDesc:
      "Şahıs olarak alışveriş yaparken e-arşiv faturan TC kimlik ile kesilir (GİB e-fatura yönetmeliği).",
    tcLabel: "TC Kimlik No",
    tcPh: "11 hane",
    tcSaved: "TC kimlik kaydedildi",
    save: "Kaydet",
    // Corporate
    corporateTitle: "Kurumsal fatura profilleri",
    corporateDesc:
      "En fazla 2 kurumsal fatura profili kaydedebilirsin. Sipariş esnasında istediğini seçersin.",
    addNew: "Yeni kurumsal fatura ekle",
    limitReached:
      "Maksimum 2 kurumsal fatura kaydedebilirsin. Yeni eklemek için birini silmen lazım.",
    emptyTitle: "Henüz kayıtlı kurumsal fatura yok",
    emptyDesc:
      "Sıkça kullandığın şirket bilgilerini kaydet, sipariş esnasında otomatik gelsin.",
    defaultBadge: "Varsayılan",
    setDefault: "Varsayılan yap",
    deleteRow: "Sil",
    confirmDelete: "Bu kurumsal fatura kaydını silmek istediğine emin misin?",
    deleted: "Kurumsal fatura silindi",
    defaultUpdated: "Varsayılan kurumsal fatura güncellendi",
    profileSaved: "Kurumsal fatura kaydedildi",
    // Modal
    modalTitle: "Yeni kurumsal fatura ekle",
    labelLabel: "Etiket (opsiyonel)",
    labelPh: "Örn: Kendi şirketim, Baba şirket",
    companyNameLabel: "Şirket ünvanı",
    companyNamePh: "Tam yasal ünvan",
    vknLabel: "VKN",
    vknPh: "10 hane",
    taxOfficeLabel: "Vergi dairesi",
    taxOfficePh: "Örn: Çankaya VD",
    companyAddressLabel: "Fatura adresi",
    companyAddressPh:
      "Şirketinizin yasal adresi (Ticaret sicil adresi). Mesafeli Satış Yönetmeliği m.5/c uyumu için zorunlu.",
    setAsDefault: "Bu profili varsayılan yap",
    cancel: "İptal",
    saveProfile: "Kaydet",
    tipTitle: "İpucu:",
    tipDesc:
      "Sipariş esnasında değişiklik yaparsan, önceki siparişlerinin faturaları değişmez.",
  },
  en: {
    eyebrow: "My account",
    title: "Invoice info",
    intro:
      "An invoice is generated automatically when an order is paid. Manage your TC and corporate invoice profiles here.",
    individualTitle: "Individual — TC ID number",
    individualDesc:
      "When shopping as an individual, your e-archive invoice is issued with TC ID (Turkish tax authority requirement).",
    tcLabel: "TC ID number",
    tcPh: "11 digits",
    tcSaved: "TC saved",
    save: "Save",
    corporateTitle: "Corporate invoice profiles",
    corporateDesc:
      "Save up to 2 corporate invoice profiles. Pick one at checkout.",
    addNew: "Add new corporate invoice",
    limitReached: "Maximum 2 corporate invoices can be saved. Delete one to add new.",
    emptyTitle: "No saved corporate invoice",
    emptyDesc: "Save frequently used company info for faster checkout.",
    defaultBadge: "Default",
    setDefault: "Set default",
    deleteRow: "Delete",
    confirmDelete: "Delete this corporate invoice?",
    deleted: "Corporate invoice deleted",
    defaultUpdated: "Default corporate invoice updated",
    profileSaved: "Corporate invoice saved",
    modalTitle: "Add new corporate invoice",
    labelLabel: "Label (optional)",
    labelPh: "e.g. My company, Father's company",
    companyNameLabel: "Company legal name",
    companyNamePh: "Full legal name",
    vknLabel: "Tax number",
    vknPh: "10 digits",
    taxOfficeLabel: "Tax office",
    taxOfficePh: "e.g. Çankaya VD",
    companyAddressLabel: "Invoice address",
    companyAddressPh: "Company's legal address (required per Distance Sales Regulation).",
    setAsDefault: "Set as default",
    cancel: "Cancel",
    saveProfile: "Save",
    tipTitle: "Tip:",
    tipDesc:
      "Changes during checkout don't affect previous orders' invoices.",
  },
};

export default function FaturaBilgileriPage() {
  const { locale } = useT();
  const c = locale === "en" ? COPY.en : COPY.tr;
  const toast = useToast();

  // Individual TC
  const [tc, setTc] = useState("");
  const [savingTc, setSavingTc] = useState(false);

  // Corporate profiles
  const [profiles, setProfiles] = useState<CustomerInvoiceProfile[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    label: "",
    vkn: "",
    companyName: "",
    taxOffice: "",
    companyAddress: "",
    isDefault: false,
  });

  // Hydration
  useEffect(() => {
    ensureAuthBindings();
    void getMyProfile().then((p) => {
      if (p?.tc) setTc(p.tc);
    });
    void listMyInvoiceProfiles().then((list) => {
      setProfiles(list);
      setHydrated(true);
    });
  }, []);

  // ============================================================
  // Individual TC save
  // ============================================================

  const onSaveTc = async () => {
    if (!validateTcKimlik(tc).valid) {
      toast.error("Geçerli bir TC kimlik gir (11 hane, Maliye checksum).");
      return;
    }
    setSavingTc(true);
    const r = await updateMyInvoiceInfo({
      type: "individual",
      tc: tc.trim(),
    });
    setSavingTc(false);
    if (r.ok) toast.success(c.tcSaved);
    else toast.error(r.reason);
  };

  // ============================================================
  // Corporate profile CRUD
  // ============================================================

  const limitReached = profiles.length >= 2;

  const openAddModal = () => {
    setForm({
      label: "",
      vkn: "",
      companyName: "",
      taxOffice: "",
      companyAddress: "",
      isDefault: profiles.length === 0, // İlk kayıt default olsun
    });
    setShowModal(true);
  };

  const onSaveProfile = async () => {
    // Validation
    if (!validateVkn(form.vkn).valid) {
      toast.error("Geçerli VKN gir (10 hane).");
      return;
    }
    if (form.companyName.trim().length < 2) {
      toast.error("Şirket ünvanı zorunlu.");
      return;
    }
    if (form.taxOffice.trim().length < 2) {
      toast.error("Vergi dairesi zorunlu.");
      return;
    }
    if (form.companyAddress.trim().length < 5) {
      toast.error("Fatura adresi zorunlu (Mesafeli Satış Yönetmeliği).");
      return;
    }
    setSaving(true);
    const r = await createMyInvoiceProfile({
      label: form.label.trim() || null,
      vkn: form.vkn.trim(),
      companyName: form.companyName.trim(),
      taxOffice: form.taxOffice.trim(),
      companyAddress: form.companyAddress.trim(),
      isDefault: form.isDefault,
    });
    setSaving(false);
    if (!r.ok) {
      if (r.reason === "limit_reached") {
        toast.error(c.limitReached);
      } else if (r.reason === "auth_required") {
        toast.error("Giriş yapman gerekiyor.");
      } else {
        toast.error("Kaydedilemedi, tekrar dene.");
      }
      return;
    }
    toast.success(c.profileSaved);
    setShowModal(false);
    // Listeyi yenile
    const fresh = await listMyInvoiceProfiles();
    setProfiles(fresh);
  };

  const onDelete = async (id: string) => {
    if (typeof window !== "undefined" && !window.confirm(c.confirmDelete)) {
      return;
    }
    const r = await deleteMyInvoiceProfile(id);
    if (r.ok) {
      toast.success(c.deleted);
      const fresh = await listMyInvoiceProfiles();
      setProfiles(fresh);
    }
  };

  const onSetDefault = async (id: string) => {
    const r = await setDefaultInvoiceProfile(id);
    if (r.ok) {
      toast.success(c.defaultUpdated);
      const fresh = await listMyInvoiceProfiles();
      setProfiles(fresh);
    }
  };

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[900px] px-4 md:px-8">
        <div className="mb-7">
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            {c.title}
          </h1>
          <p className="mt-2 text-base text-gri-700 leading-relaxed">
            {c.intro}
          </p>
        </div>

        {/* ============ Bireysel TC ============ */}
        <Card padding="p-6" className="mb-6">
          <h2 className="text-lg font-semibold mb-1.5 flex items-center gap-2">
            <Icon.Box size={18} className="text-pim-mercan" />
            {c.individualTitle}
          </h2>
          <p className="text-[13px] text-gri-700 mb-5 leading-relaxed">
            {c.individualDesc}
          </p>
          <div className="flex gap-3 items-start">
            <div className="flex-1">
              <label
                htmlFor="tc-personal"
                className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1"
              >
                {c.tcLabel} <span className="text-kirmizi">*</span>
              </label>
              <ValidatedInput
                id="tc-personal"
                value={tc}
                onChange={setTc}
                validate={validateTcKimlik}
                placeholder={c.tcPh}
                maxLength={11}
                inputMode="numeric"
              />
            </div>
            <div className="pt-[26px]">
              <Button
                variant="primary"
                onClick={onSaveTc}
                disabled={savingTc || !validateTcKimlik(tc).valid}
              >
                {savingTc ? "..." : c.save}
              </Button>
            </div>
          </div>
        </Card>

        {/* ============ Kurumsal profiles ============ */}
        <Card padding="p-6">
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Icon.Box size={18} className="text-pim-mercan" />
              {c.corporateTitle}
              <span className="inline-flex items-center h-[20px] px-2 rounded-full bg-gri-100 text-gri-700 text-[11.5px] font-semibold">
                {profiles.length}/2
              </span>
            </h2>
            {!limitReached && hydrated && (
              <Button variant="primary" size="sm" onClick={openAddModal}>
                <Icon.Plus size={14} /> {c.addNew}
              </Button>
            )}
          </div>
          <p className="text-[13px] text-gri-700 mb-5 leading-relaxed">
            {c.corporateDesc}
          </p>

          {limitReached && (
            <div className="rounded-lg bg-saman/15 ring-1 ring-saman/30 px-3 py-2 text-[12.5px] text-saman-koyu mb-4">
              ℹ {c.limitReached}
            </div>
          )}

          {/* Boş durum */}
          {hydrated && profiles.length === 0 && (
            <div className="text-center py-8 border-2 border-dashed border-gri-200 rounded-lg">
              <Icon.Box size={36} className="text-gri-500 mx-auto mb-3" />
              <h3 className="font-semibold mb-1.5">{c.emptyTitle}</h3>
              <p className="text-[13px] text-gri-700 mb-4">{c.emptyDesc}</p>
              <Button variant="primary" onClick={openAddModal}>
                <Icon.Plus size={14} /> {c.addNew}
              </Button>
            </div>
          )}

          {/* Liste */}
          {profiles.length > 0 && (
            <div className="space-y-3">
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    "p-4 rounded-lg ring-[1.5px]",
                    p.isDefault
                      ? "ring-pim-mercan bg-pim-mercan-tint/20"
                      : "ring-gri-200 bg-white"
                  )}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <h3 className="font-semibold text-base truncate text-lacivert">
                        {p.label ?? p.companyName}
                      </h3>
                      {p.isDefault && (
                        <span className="inline-flex items-center h-[20px] px-2 rounded-full bg-pim-mercan-tint text-pim-mercan text-[11px] font-semibold">
                          {c.defaultBadge}
                        </span>
                      )}
                    </div>
                  </div>
                  {p.label && (
                    <div className="text-[13px] font-semibold text-lacivert mb-1">
                      {p.companyName}
                    </div>
                  )}
                  <div className="text-[13px] text-gri-700 leading-relaxed space-y-0.5">
                    <div className="font-mono text-[12.5px]">
                      VKN: {p.vkn} · {p.taxOffice}
                    </div>
                    <div className="text-[12.5px]">{p.companyAddress}</div>
                  </div>
                  <div className="flex gap-2 flex-wrap mt-3 pt-3 border-t border-gri-200">
                    {!p.isDefault && (
                      <button
                        type="button"
                        onClick={() => onSetDefault(p.id)}
                        className="text-[12.5px] font-semibold text-pim-mercan hover:underline"
                      >
                        {c.setDefault}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDelete(p.id)}
                      className="text-[12.5px] font-semibold text-kirmizi hover:underline ml-auto inline-flex items-center gap-1"
                    >
                      🗑 {c.deleteRow}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Tip */}
        <Card padding="p-5" className="!bg-krem mt-6">
          <div className="flex gap-3">
            <Icon.Info size={20} className="text-lacivert shrink-0 mt-0.5" />
            <div className="text-[13px] text-gri-700 leading-relaxed">
              <strong className="text-lacivert">{c.tipTitle}</strong>{" "}
              {c.tipDesc}
            </div>
          </div>
        </Card>
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
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="form-label"
                  className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1"
                >
                  {c.labelLabel}
                </label>
                <Input
                  id="form-label"
                  value={form.label}
                  onChange={(e) =>
                    setForm({ ...form, label: e.target.value })
                  }
                  placeholder={c.labelPh}
                />
              </div>
              <div>
                <label
                  htmlFor="form-company"
                  className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1"
                >
                  {c.companyNameLabel}{" "}
                  <span className="text-kirmizi">*</span>
                </label>
                <Input
                  id="form-company"
                  value={form.companyName}
                  onChange={(e) =>
                    setForm({ ...form, companyName: e.target.value })
                  }
                  placeholder={c.companyNamePh}
                  autoComplete="organization"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="form-vkn"
                    className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1"
                  >
                    {c.vknLabel} <span className="text-kirmizi">*</span>
                  </label>
                  <ValidatedInput
                    id="form-vkn"
                    value={form.vkn}
                    onChange={(v) => setForm({ ...form, vkn: v })}
                    validate={validateVkn}
                    placeholder={c.vknPh}
                    maxLength={10}
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label
                    htmlFor="form-tax"
                    className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1"
                  >
                    {c.taxOfficeLabel}{" "}
                    <span className="text-kirmizi">*</span>
                  </label>
                  <Input
                    id="form-tax"
                    value={form.taxOffice}
                    onChange={(e) =>
                      setForm({ ...form, taxOffice: e.target.value })
                    }
                    placeholder={c.taxOfficePh}
                    required
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="form-addr"
                  className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1"
                >
                  {c.companyAddressLabel}{" "}
                  <span className="text-kirmizi">*</span>
                </label>
                <textarea
                  id="form-addr"
                  value={form.companyAddress}
                  onChange={(e) =>
                    setForm({ ...form, companyAddress: e.target.value })
                  }
                  placeholder={c.companyAddressPh}
                  required
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-[12px] bg-white ring-1 ring-gri-200 text-[14px] text-lacivert focus:outline-none focus:ring-pim-mercan resize-none"
                />
              </div>
              <label className="flex items-start gap-2 text-[13px] text-gri-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) =>
                    setForm({ ...form, isDefault: e.target.checked })
                  }
                  className="mt-0.5 accent-pim-mercan"
                  disabled={profiles.length === 0}
                />
                <span>
                  {c.setAsDefault}
                  {profiles.length === 0 && (
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
              <Button
                variant="primary"
                onClick={onSaveProfile}
                disabled={saving}
              >
                {saving ? "..." : c.saveProfile}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
