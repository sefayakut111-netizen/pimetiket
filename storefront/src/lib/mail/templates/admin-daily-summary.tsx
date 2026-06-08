/**
 * Günlük özet (16) — admin iç bildirim.
 * Tür: İç bildirim · Tetik: Günlük cron · AI: {aiSummary} (boşsa fallback ham sayılar).
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, Button, Eyebrow, mailStyles, SITE } from "./base";

export interface AdminDailySummaryProps {
  date: string;
  /** AI doğal dil özet. Boşsa fallback (ham sayılar) kullanılır. */
  aiSummary?: string;
  /** Fallback: ham sayı listesi (AI yoksa/başarısızsa). */
  fallbackStats?: string;
}

export function AdminDailySummaryEmail({
  date,
  aiSummary,
  fallbackStats,
}: AdminDailySummaryProps) {
  const summary =
    aiSummary?.trim() ||
    fallbackStats?.trim() ||
    "Dün için özet verisi bulunamadı.";

  return (
    <BaseLayout preview={`Günlük özet — ${date}`}>
      <Eyebrow>{date}</Eyebrow>
      <Text style={mailStyles.h1}>Günaydın. Dünün özeti:</Text>
      <Section style={mailStyles.card}>
        <Text
          style={{
            ...mailStyles.p,
            margin: 0,
            whiteSpace: "pre-wrap",
            lineHeight: 1.7,
          }}
        >
          {summary}
        </Text>
      </Section>
      <Button href={`${SITE}/admin`} label="Panele git" />
    </BaseLayout>
  );
}
