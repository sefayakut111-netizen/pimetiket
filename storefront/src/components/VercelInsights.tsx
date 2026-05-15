/**
 * VercelInsights — Vercel Speed Insights + Analytics, consent-gated.
 *
 * KVKK uyum: kullanıcı "analytics" izni vermeden Vercel'in pageview + Core
 * Web Vitals beacon'ları gönderilmez. Çerez bandosu kabul edilince mount
 * olur, geri çekilirse unmount olur (script kaldırılır).
 */

"use client";

import { useEffect, useState } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { hasConsent, readConsent } from "@/lib/cookie-consent";

export function VercelInsights() {
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);

  useEffect(() => {
    setAnalyticsAllowed(hasConsent("analytics"));

    const handler = () => {
      const consent = readConsent();
      setAnalyticsAllowed(Boolean(consent?.categories.analytics));
    };

    if (typeof window !== "undefined") {
      window.addEventListener("pim_consent_changed", handler);
      return () => window.removeEventListener("pim_consent_changed", handler);
    }
  }, []);

  if (!analyticsAllowed) return null;

  return (
    <>
      <SpeedInsights />
      <VercelAnalytics />
    </>
  );
}
