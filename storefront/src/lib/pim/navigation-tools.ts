/**
 * Pim navigation + proof context tools (all personas).
 */

import { tool } from "ai";
import { z } from "zod";
import { ETIKET_ENABLED } from "@/lib/etiket-feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";

function buildConfiguratorUrl(params: {
  product: "sticker" | "etiket";
  material?: string;
  width?: number;
  height?: number;
  qty?: number;
}): { type: "redirect"; url: string; label: string } {
  if (params.product === "etiket" && !ETIKET_ENABLED) {
    return {
      type: "redirect",
      url: "/etiket",
      label: "Etiket sayfasına git (yakında)",
    };
  }

  const base = params.product === "sticker" ? "/sticker" : "/etiket";
  const qs = new URLSearchParams();
  if (params.material) qs.set("material", params.material);
  if (params.width) qs.set("width", String(params.width));
  if (params.height) qs.set("height", String(params.height));
  if (params.qty) qs.set("qty", String(params.qty));
  const query = qs.toString();
  const label =
    params.product === "sticker"
      ? "Sticker konfigüratörüne git"
      : "Etiket konfigüratörüne git";
  return {
    type: "redirect",
    url: query ? `${base}?${query}` : base,
    label,
  };
}

function buildOrderUrl(
  orderId: string,
  page: "detail" | "proof" | "upload"
): { type: "redirect"; url: string; label: string } {
  const paths = {
    detail: `/siparis/${orderId}`,
    proof: `/onay/${orderId}`,
    upload: `/siparis/${orderId}/tasarim-yukle`,
  } as const;
  const labels = {
    detail: "Sipariş detayına git",
    proof: "Provayı incele",
    upload: "Tasarım yükle",
  } as const;
  return {
    type: "redirect",
    url: paths[page],
    label: labels[page],
  };
}

function orderOwnedByUser(
  orderUserId: string,
  callerUserId: string | null
): boolean {
  if (!callerUserId) return false;
  return orderUserId === callerUserId;
}

export const redirectToConfiguratorTool = tool({
  description:
    "Müşteriyi etiket veya sticker konfigüratörüne yönlendir. Fiyat ve ürün seçimi için.",
  inputSchema: z.object({
    product: z.enum(["sticker", "etiket"]),
    material: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    qty: z.number().optional(),
  }),
  execute: async (input) => buildConfiguratorUrl(input),
});

export function createRedirectToOrderTool(callerUserId: string | null) {
  return tool({
    description:
      "Müşteriyi sipariş detay, prova onay veya tasarım yükleme sayfasına yönlendir.",
    inputSchema: z.object({
      orderId: z.string().describe("Sipariş numarası (PE-2026-XXXX)"),
      page: z
        .enum(["detail", "proof", "upload"])
        .default("detail")
        .describe("detail=sipariş, proof=onay, upload=tasarım yükleme"),
    }),
    execute: async ({ orderId, page }) => {
      if (!callerUserId) {
        return {
          type: "redirect" as const,
          blocked: true,
          message: "Giriş yapman gerekiyor.",
        };
      }

      const admin = createAdminClient();
      const { data: order } = await admin
        .from("orders")
        .select("id, user_id")
        .ilike("id", orderId)
        .maybeSingle();
      const orderRow = order as { id: string; user_id: string } | null;

      if (!orderRow || !orderOwnedByUser(orderRow.user_id, callerUserId)) {
        return {
          type: "redirect" as const,
          blocked: true,
          message: "Sipariş bulunamadı.",
        };
      }

      return buildOrderUrl(orderRow.id, page);
    },
  });
}

export function createPimNavTools(callerUserId: string | null) {
  const getProofStatusTool = tool({
    description:
      "Siparişin prova durumu, AI kontrol sonucu, bıçak ve beyaz katman bilgisi.",
    inputSchema: z.object({
      orderId: z.string().describe("Sipariş numarası"),
    }),
    execute: async ({ orderId }) => {
      if (!callerUserId) {
        return { found: false, message: "Giriş yapman gerekiyor." };
      }

      const admin = createAdminClient();
      const { data: order } = await admin
        .from("orders")
        .select("id, status, user_id")
        .ilike("id", orderId)
        .maybeSingle();
      const orderRow = order as {
        id: string;
        status: string;
        user_id: string;
      } | null;
      if (!orderRow || !orderOwnedByUser(orderRow.user_id, callerUserId)) {
        return { found: false, message: "Sipariş bulunamadı" };
      }

      const { data: validation } = await admin
        .from("proof_validations")
        .select(
          "ai_verdict, ai_pim_message, ai_cutline, ai_white_layer, final_verdict, rule_issues"
        )
        .eq("order_id", orderRow.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const v = validation as {
        ai_verdict: string | null;
        ai_pim_message: string | null;
        ai_cutline: { issues_tr?: string[] } | null;
        ai_white_layer: { issues_tr?: string[] } | null;
        final_verdict: string | null;
        rule_issues: Array<{ message_tr?: string }> | null;
      } | null;

      const { data: cutlines } = await admin
        .from("cutline_designs")
        .select("status, white_plan_mode, tier")
        .eq("order_id", orderRow.id)
        .neq("status", "superseded")
        .limit(5);

      const cls = (cutlines ?? []) as Array<{
        status: string;
        white_plan_mode: string | null;
        tier: string | null;
      }>;

      const cutlineIssues = v?.ai_cutline?.issues_tr ?? [];
      const whiteIssues = v?.ai_white_layer?.issues_tr ?? [];
      const whiteLayerStatus =
        cls.find((c) => c.white_plan_mode && c.white_plan_mode !== "off")
          ?.white_plan_mode ?? "off";

      return {
        found: true,
        orderId: orderRow.id,
        status: orderRow.status,
        aiVerdict: v?.ai_verdict ?? v?.final_verdict ?? null,
        cutlineIssues,
        whiteLayerStatus,
        whiteLayerIssues: whiteIssues,
        ruleIssues: (v?.rule_issues ?? [])
          .map((i) => i.message_tr)
          .filter(Boolean),
        pimSuggestion: v?.ai_pim_message ?? null,
        redirect: buildOrderUrl(
          orderRow.id,
          orderRow.status === "proof_pending" ? "proof" : "detail"
        ),
      };
    },
  });

  const createProofHelpRequestTool = tool({
    description:
      "Müşterinin prova/bıçak sorununu operatöre iletir — yardım talebi oluşturur.",
    inputSchema: z.object({
      orderId: z.string().describe("Sipariş numarası"),
      itemId: z.string().optional().describe("Sipariş kalemi id (opsiyonel)"),
      issue: z.string().describe("Müşterinin tarif ettiği sorun"),
    }),
    execute: async ({ orderId, itemId, issue }) => {
      if (!callerUserId) {
        return { ticketCreated: false, message: "Giriş yapman gerekiyor." };
      }

      const admin = createAdminClient();
      const { data: order } = await admin
        .from("orders")
        .select("id, user_id, status")
        .ilike("id", orderId)
        .maybeSingle();
      const orderRow = order as {
        id: string;
        user_id: string;
        status: string;
      } | null;

      if (!orderRow || !orderOwnedByUser(orderRow.user_id, callerUserId)) {
        return { ticketCreated: false, message: "Sipariş bulunamadı." };
      }
      if (orderRow.status !== "proof_pending") {
        return {
          ticketCreated: false,
          message: `Bu aşamada yardım talebi açılamaz (${orderRow.status}).`,
        };
      }

      let targetItemId = itemId;
      if (!targetItemId) {
        const { data: items } = await admin
          .from("order_items")
          .select("id")
          .eq("order_id", orderRow.id)
          .limit(1);
        targetItemId = (items as Array<{ id: string }> | null)?.[0]?.id;
      }
      if (!targetItemId) {
        return { ticketCreated: false, message: "Sipariş kalemi bulunamadı." };
      }

      const message = issue.trim().slice(0, 1000);
      if (!message) {
        return { ticketCreated: false, message: "Sorun açıklaması gerekli." };
      }

      const { error: hrErr } = await admin.from("proof_help_requests").insert({
        order_id: orderRow.id,
        order_item_id: targetItemId,
        user_id: orderRow.user_id,
        message,
        status: "open",
      });

      if (hrErr) {
        console.error("[pim/create_proof_help_request]", hrErr);
        return {
          ticketCreated: false,
          message: "Talep oluşturulamadı, lütfen tekrar dene.",
        };
      }

      await admin
        .from("order_items")
        .update({ proof_status: "help_requested" })
        .eq("id", targetItemId)
        .eq("order_id", orderRow.id);

      await admin.from("order_events").insert([
        {
          order_id: orderRow.id,
          event_type: "proof_help_requested",
          status_after: orderRow.status,
          actor_id: orderRow.user_id,
          actor_role: "customer",
          summary: `Pim chat yardım talebi: ${message.slice(0, 80)}`,
          detail: { item_id: targetItemId, via: "pim_chat" },
        },
      ]);

      return {
        ticketCreated: true,
        message:
          "Uzman ekibimize ilettim, en kısa sürede dönüş yapacaklar. Prova sayfasından da durumu takip edebilirsin.",
        redirect: buildOrderUrl(orderRow.id, "proof"),
      };
    },
  });

  return {
    redirect_to_configurator: redirectToConfiguratorTool,
    redirect_to_order: createRedirectToOrderTool(callerUserId),
    get_proof_status: getProofStatusTool,
    create_proof_help_request: createProofHelpRequestTool,
  };
}

/** @deprecated createPimNavTools(userId) kullan */
export const PIM_NAV_TOOLS = createPimNavTools(null);
