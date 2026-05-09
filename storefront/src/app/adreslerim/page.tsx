/**
 * Pim Etiket — /adreslerim (E.2.4)
 *
 * Adres listesi + ekle/düzenle/sil + default işaretleme. Mock.
 */

"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/context";

interface Address {
  id: string;
  label: string;
  name: string;
  addr: string;
  city: string;
  phone: string;
  isDefault?: boolean;
}

const INITIAL: Address[] = [
  {
    id: "a1",
    label: "Atölye",
    name: "Ahmet Yılmaz",
    addr: "Yıldırım Mh. 15. Cd. No:3 D:2",
    city: "Bursa / Yıldırım",
    phone: "+90 5XX XXX XX XX",
    isDefault: true,
  },
  {
    id: "a2",
    label: "Ev",
    name: "Ahmet Yılmaz",
    addr: "Çekirge Cd. No:42 D:7",
    city: "Bursa / Osmangazi",
    phone: "+90 5XX XXX XX XX",
  },
];

const COPY = {
  tr: {
    eyebrow: "Hesabım",
    title: "Adres defterim",
    summary: (n: number) => `${n} kayıtlı adres`,
    addNew: "Yeni adres ekle",
    addFormSoon: "Adres ekleme formu yakında (mock)",
    editFormSoon: (label: string) => `${label} düzenleme formu yakında (mock)`,
    defaultUpdated: "Varsayılan adres güncellendi",
    addressDeleted: "Adres silindi",
    emptyTitle: "Henüz adres yok",
    emptyDesc: "Sipariş verirken hızlı seçim için adres ekle.",
    defaultBadge: "Varsayılan",
    edit: "Düzenle",
    setDefault: "Varsayılan yap",
    deleteRow: "Sil",
  },
  en: {
    eyebrow: "My account",
    title: "Address book",
    summary: (n: number) =>
      `${n} saved address${n === 1 ? "" : "es"}`,
    addNew: "Add new address",
    addFormSoon: "Address form coming soon (mock)",
    editFormSoon: (label: string) => `Edit form for ${label} coming soon (mock)`,
    defaultUpdated: "Default address updated",
    addressDeleted: "Address deleted",
    emptyTitle: "No address yet",
    emptyDesc: "Add an address for quick selection at checkout.",
    defaultBadge: "Default",
    edit: "Edit",
    setDefault: "Set as default",
    deleteRow: "Delete",
  },
};

export default function AdreslerimPage() {
  const { locale } = useT();
  const c = locale === "en" ? COPY.en : COPY.tr;

  const toast = useToast();
  const [addresses, setAddresses] = useState<Address[]>(INITIAL);

  const setDefault = (id: string) => {
    setAddresses((arr) =>
      arr.map((a) => ({ ...a, isDefault: a.id === id }))
    );
    toast.success(c.defaultUpdated);
  };

  const remove = (id: string) => {
    setAddresses((arr) => arr.filter((a) => a.id !== id));
    toast.success(c.addressDeleted);
  };

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[900px] px-8">
        <div className="flex items-end justify-between gap-4 mb-7 flex-wrap">
          <div>
            <Eyebrow>{c.eyebrow}</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
              {c.title}
            </h1>
            <p className="mt-2 text-base text-gri-700">
              {c.summary(addresses.length)}
            </p>
          </div>
          <Button variant="primary" onClick={() => toast.info(c.addFormSoon)}>
            <Icon.Plus size={16} /> {c.addNew}
          </Button>
        </div>

        {addresses.length === 0 ? (
          <Card padding="p-12" className="text-center">
            <Icon.Truck size={48} className="text-gri-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">{c.emptyTitle}</h3>
            <p className="text-base text-gri-700 mb-5">{c.emptyDesc}</p>
            <Button variant="primary" onClick={() => toast.info(c.addFormSoon)}>
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
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-base">{a.label}</h3>
                    {a.isDefault && (
                      <span className="inline-flex items-center h-[20px] px-2 rounded-full bg-pim-mercan-tint text-pim-mercan text-[11px] font-semibold">
                        {c.defaultBadge}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-[13px] text-gri-700 leading-relaxed mb-4">
                  <div className="font-semibold text-lacivert">{a.name}</div>
                  <div>{a.addr}</div>
                  <div>{a.city}</div>
                  <div>{a.phone}</div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toast.info(c.editFormSoon(a.label))}
                  >
                    {c.edit}
                  </Button>
                  {!a.isDefault && (
                    <button
                      type="button"
                      onClick={() => setDefault(a.id)}
                      className="text-[13px] font-semibold text-pim-mercan hover:underline px-3"
                    >
                      {c.setDefault}
                    </button>
                  )}
                  {!a.isDefault && (
                    <button
                      type="button"
                      onClick={() => remove(a.id)}
                      className="text-[13px] font-semibold text-gri-500 hover:text-kirmizi px-3 ml-auto"
                    >
                      {c.deleteRow}
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
