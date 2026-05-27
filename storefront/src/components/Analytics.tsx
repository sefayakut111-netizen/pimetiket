/**
 * Analytics — sadece kullanıcı consent verdiyse GA4/PostHog yükler.
 *
 * KVKK uyumluluğu: çerez izni verilmeden önce HİÇBİR analitik script
 * yüklenmez (cookie set edilmez). Consent gelince Script tag eklenir.
 *
 * Env:
 *   NEXT_PUBLIC_GA4_MEASUREMENT_ID  → GA4 (örn: G-XXXXXXX)
 *   NEXT_PUBLIC_POSTHOG_KEY         → PostHog
 *   NEXT_PUBLIC_POSTHOG_HOST        → https://eu.i.posthog.com (KVKK için EU)
 */

"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { hasConsent, readConsent } from "@/lib/cookie-consent";

// Vercel env'lerine kopyala-yapıştır sırasında değerin başına/sonuna TAB
// veya boşluk sızabiliyor (12 May Sefa raporu: POSTHOG_HOST'un başında
// charCode 9). Tüm public env değişkenlerini trim ediyoruz — gelecek
// için defensive guard.
const trimEnv = (v: string | undefined): string | undefined => {
  if (!v) return v;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
};

const GA4_ID = trimEnv(process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID);
const POSTHOG_KEY = trimEnv(process.env.NEXT_PUBLIC_POSTHOG_KEY);
const POSTHOG_HOST =
  trimEnv(process.env.NEXT_PUBLIC_POSTHOG_HOST) ??
  "https://eu.i.posthog.com";

export function Analytics() {
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);

  useEffect(() => {
    setAnalyticsAllowed(hasConsent("analytics"));

    const handler = () => {
      const consent = readConsent();
      const allowed = Boolean(consent?.categories.analytics);
      setAnalyticsAllowed(allowed);

      if (
        !allowed &&
        typeof window !== "undefined" &&
        window.posthog &&
        typeof window.posthog.opt_out_capturing === "function"
      ) {
        try {
          window.posthog.opt_out_capturing();
          window.posthog.reset?.();
        } catch {
          /* silent */
        }
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("pim_consent_changed", handler);
      return () => window.removeEventListener("pim_consent_changed", handler);
    }
  }, []);

  if (!analyticsAllowed) return null;

  return (
    <>
      {/* GA4 */}
      {GA4_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('consent', 'default', {
                'ad_storage': 'denied',
                'analytics_storage': 'granted',
                'ad_user_data': 'denied',
                'ad_personalization': 'denied'
              });
              gtag('config', '${GA4_ID}', {
                anonymize_ip: true,
                cookie_flags: 'SameSite=None;Secure'
              });
            `}
          </Script>
        </>
      )}

      {/* PostHog (EU host — KVKK) */}
      {POSTHOG_KEY && (
        <Script id="posthog-init" strategy="afterInteractive">
          {`
            !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
            posthog.init('${POSTHOG_KEY}', {
              api_host: '${POSTHOG_HOST}',
              persistence: 'localStorage+cookie',
              capture_pageview: true,
              capture_pageleave: true,
              autocapture: true
            });
          `}
        </Script>
      )}
    </>
  );
}
