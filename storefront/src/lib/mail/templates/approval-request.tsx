/**
 * Onay görseli isteği — müşteri bildirimi.
 * Tetik: admin/partner approval-request POST (istek başına 1 mail).
 */

import { Link, Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, Button, Eyebrow, mailStyles, COLORS, SITE } from "./base";

export interface ApprovalRequestProps {
  orderId: string;
  title: string;
  assetCount: number;
}

export function ApprovalRequestEmail({
  orderId,
  title,
  assetCount,
}: ApprovalRequestProps) {
  const approvalUrl = `${SITE}/onay/${orderId}`;

  return (
    <BaseLayout preview="Onayını bekleyen görsel var.">
      <Eyebrow>Sipariş #{orderId}</Eyebrow>
      <Text style={mailStyles.h1}>
        Siparişin için onayını bekleyen görsel var
      </Text>
      <Text style={mailStyles.p}>
        {orderId} numaralı siparişinde yeni bir onay görseli isteği var.
        İnceleyip onaylayabilir veya değişiklik isteyebilirsin.
      </Text>

      <Section style={mailStyles.card}>
        <Text
          style={{ ...mailStyles.p, margin: 0, fontSize: 14, lineHeight: 1.7 }}
        >
          <strong>İstek:</strong> {title}
          <br />
          <strong>Görsel:</strong> {assetCount} dosya
        </Text>
      </Section>

      <Section
        style={{
          background: COLORS.krem,
          border: `2px solid ${COLORS.pimMercan}`,
          borderRadius: 12,
          padding: "20px",
          margin: "24px 0",
          textAlign: "center" as const,
        }}
      >
        <Button href={approvalUrl} label="Görselleri incele ve yanıtla" />
      </Section>

      <Text style={mailStyles.pSecondary}>
        Sorun olursa{" "}
        <Link href={`${SITE}/destek`} style={{ color: COLORS.pimMercan }}>
          destek
        </Link>{" "}
        üzerinden bize yazabilirsin.
      </Text>
    </BaseLayout>
  );
}
