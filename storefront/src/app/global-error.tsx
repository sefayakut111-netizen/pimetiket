/**
 * Root layout hatalarını yakalar — error.tsx bunları göremez.
 * Kendi <html>/<body> gerekli (App Router).
 */
"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

export default function RootGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#f8f9fb",
          color: "#1a2744",
        }}
      >
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div style={{ maxWidth: 480, textAlign: "center" }}>
            <h1 style={{ fontSize: "1.75rem", marginBottom: 12 }}>
              Beklenmedik bir hata oluştu
            </h1>
            <p style={{ color: "#64748b", lineHeight: 1.6, marginBottom: 24 }}>
              Sayfayı yenilemeyi dene. Sorun devam ederse destek ekibimize yaz.
            </p>
            {error.digest && (
              <p
                style={{
                  fontFamily: "monospace",
                  fontSize: 12,
                  color: "#64748b",
                  marginBottom: 24,
                }}
              >
                ref: {error.digest}
              </p>
            )}
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => reset()}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: "#e85d4a",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Tekrar dene
              </button>
              <Link
                href="/"
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  color: "#1a2744",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Anasayfa
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
