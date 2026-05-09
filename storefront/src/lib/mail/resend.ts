/**
 * Resend wrapper — server-only mail gönderim.
 *
 * .env:
 *   RESEND_API_KEY=re_...
 *   RESEND_FROM_EMAIL=Pim Etiket <merhaba@pimetiket.com>
 *
 * KRİTİK: Bu modül SADECE server-side import edilmelidir
 * (route handler / Server Action / Edge fn). Client'a sızdırılmaz.
 */

import "server-only";

import { Resend } from "resend";

let _client: Resend | null = null;

function getClient(): Resend {
  if (_client) return _client;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY eksik. .env.local'e ekle (server-only)."
    );
  }
  _client = new Resend(apiKey);
  return _client;
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function getDefaultFrom(): string {
  return (
    process.env.RESEND_FROM_EMAIL ?? "Pim Etiket <merhaba@pimetiket.com>"
  );
}

// ============================================================
// API
// ============================================================

export interface SendMailParams {
  to: string | string[];
  subject: string;
  /** React Email render edilmiş HTML (opsiyonel) */
  html?: string;
  /** Plain text fallback */
  text?: string;
  from?: string;
  /** Reply-to override */
  replyTo?: string;
  /** Tags — Resend dashboard filtreleme */
  tags?: Array<{ name: string; value: string }>;
}

export interface SendMailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function sendMail(
  params: SendMailParams
): Promise<SendMailResult> {
  if (!isResendConfigured()) {
    console.warn("[mail] RESEND_API_KEY eksik — mail gönderilmedi:", params.subject);
    return { ok: false, error: "not_configured" };
  }

  if (!params.html && !params.text) {
    return { ok: false, error: "missing_content" };
  }

  try {
    const client = getClient();
    const { data, error } = await client.emails.send({
      from: params.from ?? getDefaultFrom(),
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
      tags: params.tags,
    } as Parameters<typeof client.emails.send>[0]);

    if (error) {
      console.error("[mail] Resend error:", error);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    console.error("[mail] sendMail threw:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}
