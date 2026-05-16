/**
 * Aksiyon: block_ip — Cloudflare WAF üzerinden IP engelleme.
 *
 * Payload:
 *   { ip: string, duration_hours?: number (default 24), reason?: string }
 *
 * Çalışma şekli:
 *   - Cloudflare API'sine POST /accounts/:id/rules/lists/:list_id/items
 *   - Pim Etiket bir "blocked_ips" IP list'i tutar (Sefa CF'de oluşturur)
 *   - Liste WAF rule'una bağlı: "if ip.src in $blocked_ips → block"
 *
 * Env'de eksik bilgi olursa graceful: "config missing" döner,
 * audit log'a yazılır ama gerçek block YAPMAZ. Bu sayede dev
 * ortamında test edilebilir.
 *
 * Sefa'ya not (16 May):
 *   - CLOUDFLARE_ACCOUNT_ID env'de var (Adım 1'de .env.agent'tan)
 *   - CLOUDFLARE_API_TOKEN — Sefa'nın eklemesi gerek (Cloudflare → My Profile →
 *     API Tokens → "Edit zone DNS + Account.Lists Write" izinli token)
 *   - CLOUDFLARE_BLOCKED_IPS_LIST_ID — Sefa CF'de "Account → Configurations →
 *     Lists → Create list (IP)" sonrası ID buraya eklenir
 */

import type { ActionHandler } from "../_shared/proposal";

const CF_API = "https://api.cloudflare.com/client/v4";

interface BlockIpPayload {
  ip: string;
  duration_hours?: number;
  reason?: string;
}

const blockIp: ActionHandler = async ({ payload }) => {
  const { ip, duration_hours: durationHours = 24, reason = "auditor_decision" } =
    payload as unknown as BlockIpPayload;

  if (!ip || typeof ip !== "string") {
    return {
      result: "failed",
      error: "Invalid payload: 'ip' field is required (string)",
    };
  }

  // IP format validation (basit IPv4/IPv6 sanity)
  const isValidIp =
    /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) ||
    /^[0-9a-fA-F:]+$/.test(ip);
  if (!isValidIp) {
    return {
      result: "failed",
      error: `Invalid IP format: ${ip}`,
    };
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const listId = process.env.CLOUDFLARE_BLOCKED_IPS_LIST_ID;

  if (!accountId || !apiToken || !listId) {
    // Config eksik — graceful return. Audit log "partial" + Sefa görür.
    return {
      result: "partial",
      affectedRows: 0,
      affectedIds: { ip },
      externalCall: {
        skipped: true,
        reason: "cloudflare_config_missing",
        missing: [
          !accountId && "CLOUDFLARE_ACCOUNT_ID",
          !apiToken && "CLOUDFLARE_API_TOKEN",
          !listId && "CLOUDFLARE_BLOCKED_IPS_LIST_ID",
        ].filter(Boolean),
        wouldBlock: { ip, durationHours, reason },
      },
      error:
        "Cloudflare config eksik. Sefa CLOUDFLARE_API_TOKEN + CLOUDFLARE_BLOCKED_IPS_LIST_ID env'lerini eklemeli.",
    };
  }

  // Cloudflare API: List'e IP ekle
  // Endpoint: POST /accounts/:id/rules/lists/:list_id/items
  // Body: [{ ip: "1.2.3.4", comment: "auditor: brute_force" }]
  try {
    const res = await fetch(
      `${CF_API}/accounts/${accountId}/rules/lists/${listId}/items`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            ip,
            comment: `auditor:${reason}; expires_after_${durationHours}h`,
          },
        ]),
      }
    );

    const json = (await res.json()) as {
      success?: boolean;
      errors?: Array<{ message: string }>;
      result?: { operation_id?: string };
    };

    if (!res.ok || !json.success) {
      const errMsg =
        json.errors?.map((e) => e.message).join("; ") ??
        `HTTP ${res.status}`;
      return {
        result: "failed",
        affectedRows: 0,
        externalCall: {
          httpStatus: res.status,
          cloudflareResponse: json,
        },
        error: `Cloudflare API: ${errMsg}`,
      };
    }

    return {
      result: "success",
      affectedRows: 1,
      affectedIds: { ip },
      externalCall: {
        httpStatus: res.status,
        operationId: json.result?.operation_id ?? null,
        listId,
        durationHours,
      },
    };
  } catch (err) {
    return {
      result: "failed",
      error: `Cloudflare network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
};

export default blockIp;
