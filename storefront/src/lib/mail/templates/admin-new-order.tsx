/**
 * Yeni sipariş bildirimi (15) — admin iç bildirim.
 * Tür: İç bildirim · Tetik: Yeni ödeme alındı · Görsel: Yok.
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, Button, Eyebrow, mailStyles, SITE } from "./base";

export interface AdminNewOrderProps {
  orderId: string;
  total: string;
  customerName: string;
  items: string;
  status: string;
}

export function AdminNewOrderEmail({
  orderId,
  total,
  customerName,
  items,
  status,
}: AdminNewOrderProps) {
  return (
    <BaseLayout preview={`Yeni sipariş — ${orderId} · ${total}`}>
      <Eyebrow>Yeni sipariş</Eyebrow>
      <Text style={mailStyles.h1}>Yeni sipariş geldi</Text>
      <Section style={mailStyles.card}>
        <Text
          style={{ ...mailStyles.p, margin: 0, fontSize: 14, lineHeight: 1.8 }}
        >
          <strong>No:</strong> {orderId}
          <br />
          <strong>Tutar:</strong> {total}
          <br />
          <strong>Müşteri:</strong> {customerName}
          <br />
          <strong>Ürünler:</strong> {items}
          <br />
          <strong>Durum:</strong> {status}
        </Text>
      </Section>
      <Button href={`${SITE}/admin/siparisler`} label="Siparişi aç" />
    </BaseLayout>
  );
}
