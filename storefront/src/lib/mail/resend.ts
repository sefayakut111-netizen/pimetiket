/**
 * Resend wrapper — server-only mail gönderim.
 *
 * .env:
 *   RESEND_API_KEY=re_...
 *   RESEND_FROM_EMAIL=Pim Etiket <info@pimetiket.com>
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
    process.env.RESEND_FROM_EMAIL ?? "Pim Etiket <info@pimetiket.com>"
  );
}

/** RESEND_FROM_EMAIL içinden domain çıkar — örn. info@pimetiket.com → pimetiket.com */
export function getFromDomain(): string {
  const from = getDefaultFrom();
  const match = from.match(/@([a-z0-9.-]+\.[a-z]{2,})>/i);
  if (match?.[1]) return match[1].toLowerCase();
  const plain = from.match(/@([a-z0-9.-]+\.[a-z]{2,})/i);
  return plain?.[1]?.toLowerCase() ?? "pimetiket.com";
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

export type ResendDomainStatus =
  | "not_started"
  | "pending"
  | "verified"
  | "failed"
  | "temporary_failure"
  | string;

export interface ResendDomainInfo {
  ok: boolean;
  domain: string;
  status?: ResendDomainStatus;
  region?: string;
  sending?: string;
  records?: Array<{
    record: string;
    name: string;
    type: string;
    value: string;
    status?: string;
    priority?: number;
  }>;
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

/**
 * Resend API üzerinden domain doğrulama durumunu okur.
 * /admin/mail-health dashboard'unda DNS adımlarını göstermek için.
 */
export async function getResendDomainStatus(
  domain = getFromDomain()
): Promise<ResendDomainInfo> {
  if (!isResendConfigured()) {
    return { ok: false, domain, error: "not_configured" };
  }

  try {
    const client = getClient();
    const { data, error } = await client.domains.list();

    if (error) {
      return { ok: false, domain, error: error.message };
    }

    const match = (data?.data ?? []).find(
      (d) => d.name?.toLowerCase() === domain.toLowerCase()
    );

    if (!match) {
      return {
        ok: false,
        domain,
        error: `domain_not_found_in_resend:${domain}`,
      };
    }

    const { data: detail, error: detailErr } = await client.domains.get(
      match.id
    );

    if (detailErr || !detail) {
      return {
        ok: true,
        domain: match.name,
        status: match.status,
        region: match.region,
        sending: match.capabilities?.sending,
        error: detailErr?.message,
      };
    }

    return {
      ok: true,
      domain: detail.name,
      status: detail.status,
      region: detail.region,
      sending: detail.capabilities?.sending,
      records: (detail.records ?? []).map((r) => ({
        record: r.record,
        name: r.name,
        type: r.type,
        value: r.value,
        status: r.status,
        ...("priority" in r && typeof r.priority === "number"
          ? { priority: r.priority }
          : {}),
      })),
    };
  } catch (err) {
    return {
      ok: false,
      domain,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}
