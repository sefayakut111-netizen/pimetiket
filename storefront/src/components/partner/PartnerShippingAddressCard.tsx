"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import type { PartnerFullShippingAddress } from "@/lib/fason/redact-order-address";

interface PartnerShippingAddressCardProps {
  orderId: string;
  assignmentStatus: string;
  onError?: (message: string) => void;
}

export function PartnerShippingAddressCard({
  orderId,
  assignmentStatus,
  onError,
}: PartnerShippingAddressCardProps) {
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [shipping, setShipping] = useState<PartnerFullShippingAddress | null>(
    null
  );

  const canReveal =
    assignmentStatus === "ready" || assignmentStatus === "in_production";

  if (!canReveal) return null;

  const revealAddress = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/partner/orders/${orderId}/shipping-info`,
        { cache: "no-store" }
      );
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        shipping?: PartnerFullShippingAddress;
        message?: string;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.shipping) {
        onError?.(json.message ?? json.error ?? "Adres alınamadı");
        return;
      }
      setShipping(json.shipping);
      setRevealed(true);
    } catch {
      onError?.("Bağlantı hatası");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-gri-600">
        Teslimat adresi
      </p>
      <p className="mt-1 text-[13px] text-gri-700">
        Müşteriye kargolamak için tam adres ve iletişim bilgisi.
      </p>

      {!revealed ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-3"
          disabled={loading}
          onClick={() => void revealAddress()}
        >
          {loading ? "Yükleniyor…" : "Adresi göster"}
        </Button>
      ) : shipping ? (
        <dl className="mt-3 space-y-2 text-[13px] text-lacivert">
          <div>
            <dt className="text-[11px] font-semibold uppercase text-gri-600">
              Alıcı
            </dt>
            <dd>{shipping.recipientName}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase text-gri-600">
              Telefon
            </dt>
            <dd>
              <a
                href={`tel:${shipping.phone.replace(/\s/g, "")}`}
                className="text-pim-mercan hover:underline"
              >
                {shipping.phone}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase text-gri-600">
              Adres
            </dt>
            <dd className="leading-snug">
              {shipping.addressLine}
              {shipping.district ? `, ${shipping.district}` : ""}
              {shipping.city ? ` / ${shipping.city}` : ""}
              {shipping.postalCode ? ` · ${shipping.postalCode}` : ""}
            </dd>
          </div>
        </dl>
      ) : null}

      <p className="mt-3 text-[11px] leading-snug text-gri-600">
        Bu bilgiyi yalnız bu siparişin kargolanması için kullanabilirsin.
      </p>
    </Card>
  );
}
