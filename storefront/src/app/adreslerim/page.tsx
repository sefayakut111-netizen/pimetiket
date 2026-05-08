/**
 * Pim Etiket — /adreslerim (E.2.4)
 *
 * Adres listesi + ekle/düzenle/sil + default işaretleme. Mock.
 */

"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";

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

export default function AdreslerimPage() {
  const [addresses, setAddresses] = useState<Address[]>(INITIAL);

  const setDefault = (id: string) => {
    setAddresses((arr) =>
      arr.map((a) => ({ ...a, isDefault: a.id === id }))
    );
  };

  const remove = (id: string) => {
    setAddresses((arr) => arr.filter((a) => a.id !== id));
  };

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[900px] px-8">
        <div className="flex items-end justify-between gap-4 mb-7 flex-wrap">
          <div>
            <Eyebrow>Hesabım</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
              Adres defterim
            </h1>
            <p className="mt-2 text-base text-gri-700">
              {addresses.length} kayıtlı adres
            </p>
          </div>
          <Button variant="primary">
            <Icon.Plus size={16} /> Yeni adres ekle
          </Button>
        </div>

        {addresses.length === 0 ? (
          <Card padding="p-12" className="text-center">
            <Icon.Truck size={48} className="text-gri-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              Henüz adres yok
            </h3>
            <p className="text-base text-gri-700 mb-5">
              Sipariş verirken hızlı seçim için adres ekle.
            </p>
            <Button variant="primary">
              <Icon.Plus size={16} /> Yeni adres ekle
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {addresses.map((a) => (
              <Card
                key={a.id}
                padding="p-5"
                className={cn(
                  a.isDefault && "ring-2 !ring-pim-mercan"
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-base">{a.label}</h3>
                    {a.isDefault && (
                      <span className="inline-flex items-center h-[20px] px-2 rounded-full bg-pim-mercan-tint text-pim-mercan text-[11px] font-semibold">
                        Varsayılan
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
                  <Button variant="ghost" size="sm">
                    Düzenle
                  </Button>
                  {!a.isDefault && (
                    <button
                      type="button"
                      onClick={() => setDefault(a.id)}
                      className="text-[13px] font-semibold text-pim-mercan hover:underline px-3"
                    >
                      Varsayılan yap
                    </button>
                  )}
                  {!a.isDefault && (
                    <button
                      type="button"
                      onClick={() => remove(a.id)}
                      className="text-[13px] font-semibold text-gri-500 hover:text-kirmizi px-3 ml-auto"
                    >
                      Sil
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
