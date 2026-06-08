/**
 * Bülten hoşgeldin — footer newsletter aboneliği (ticari ileti).
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, Button, Eyebrow, mailStyles, COLORS, SITE } from "./base";

export interface NewsletterWelcomeProps {
  unsubscribeUrl: string;
}

export function NewsletterWelcomeEmail({
  unsubscribeUrl,
}: NewsletterWelcomeProps) {
  return (
    <BaseLayout
      preview="Pim Etiket bültenine hoş geldin"
      unsubscribeCategory="marketing"
      unsubscribeUrl={unsubscribeUrl}
    >
      <Eyebrow>Pim&apos;in Defteri</Eyebrow>
      <Text style={mailStyles.h1}>Bültene kaydoldun</Text>
      <Text style={mailStyles.p}>
        Pim Etiket&apos;ten ara sıra yeni ürünler, baskı ipuçları ve
        atölye haberleri göndereceğiz. Spam atmayız.
      </Text>

      <Section
        style={{
          background: COLORS.krem,
          borderRadius: 12,
          padding: "16px 20px",
          margin: "20px 0",
        }}
      >
        <Text style={{ ...mailStyles.p, margin: 0, fontSize: 14 }}>
          Sticker veya etiket siparişi vermek istersen fiyatı anında
          hesaplayabilir, tasarımını yükleyip AI kalite kontrolünden
          geçirebilirsin.
        </Text>
      </Section>

      <Button href={`${SITE}/sticker`} label="Sticker fiyatına bak" />

      <Text style={mailStyles.pSecondary}>
        Hesap ayarlarından{" "}
        <a href={`${SITE}/bildirim-tercihleri`} style={{ color: COLORS.pimMercan }}>
          bildirim tercihlerini
        </a>{" "}
        istediğin zaman güncelleyebilirsin.
      </Text>
    </BaseLayout>
  );
}
