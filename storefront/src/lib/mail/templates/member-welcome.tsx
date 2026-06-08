/**
 * Üyelik hoşgeldin — transactional, ticari değil.
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, Button, Eyebrow, mailStyles, COLORS, SITE } from "./base";

export interface MemberWelcomeProps {
  customerName: string;
}

export function MemberWelcomeEmail({ customerName }: MemberWelcomeProps) {
  const firstName = customerName.split(" ")[0] || customerName;

  return (
    <BaseLayout preview="Pim Etiket'e hoş geldin">
      <Eyebrow>Hoş geldin</Eyebrow>
      <Text style={mailStyles.h1}>Hoş geldin, {firstName}</Text>
      <Text style={mailStyles.p}>
        Pim Etiket hesabın hazır. Sticker ve etiket siparişlerini buradan
        yönetebilirsin.
      </Text>

      <Section
        style={{
          background: COLORS.krem,
          borderRadius: 12,
          padding: "16px 20px",
          margin: "20px 0",
        }}
      >
        <Text style={{ ...mailStyles.label, marginTop: 0 }}>NELER YAPABİLİRSİN?</Text>
        <Text style={{ ...mailStyles.p, margin: "8px 0 0", fontSize: 14 }}>
          • Sticker / etiket fiyatını anında hesapla
          <br />
          • Tasarımını yükle, AI kalite kontrolünden geçir
          <br />
          • Prova onayı ver, üretim ve kargoyu takip et
          <br />• Sipariş geçmişin ve iade taleplerin tek yerde
        </Text>
      </Section>

      <Button href={`${SITE}/sticker`} label="Sticker fiyatına bak" />

      <Text style={{ ...mailStyles.pSecondary, fontSize: 13 }}>
        Hesap ayarların{" "}
        <a href={`${SITE}/panelim`} style={{ color: COLORS.brand }}>
          panelim
        </a>{" "}
        sayfasında. Bildirim tercihlerini{" "}
        <a href={`${SITE}/bildirim-tercihleri`} style={{ color: COLORS.brand }}>
          buradan
        </a>{" "}
        yönetebilirsin.
      </Text>
    </BaseLayout>
  );
}
