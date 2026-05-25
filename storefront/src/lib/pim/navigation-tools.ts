/**
 * Pim navigation + proof context tools (all personas).
 */

import { tool } from "ai";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

function buildConfiguratorUrl(params: {
  product: "sticker" | "etiket";
  material?: string;
  width?: number;
  height?: number;
  qty?: number;
}): { type: "redirect"; url: string; label: string } {
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

export const redirectToOrderTool = tool({
  description:
    "Müşteriyi sipariş detay, prova onay veya tasarım yükleme sayfasına yönlendir.",
  inputSchema: z.object({
    orderId: z.string().describe("Sipariş numarası (PE-2026-XXXX)"),
    page: z
      .enum(["detail", "proof", "upload"])
      .default("detail")
      .describe("detail=sipariş, proof=onay, upload=tasarım yükleme"),
  }),
  execute: async ({ orderId, page }) => buildOrderUrl(orderId, page),
});

export const getProofStatusTool = tool({
  description:
    "Siparişin prova durumu, AI kontrol sonucu, bıçak ve beyaz katman bilgisi.",
  inputSchema: z.object({
    orderId: z.string().describe("Sipariş numarası"),
  }),
  execute: async ({ orderId }) => {
    const admin = createAdminClient();
    const { data: order } = await admin
      .from("orders")
      .select("id, status")
      .ilike("id", orderId)
      .maybeSingle();
    const orderRow = order as { id: string; status: string } | null;
    if (!orderRow) {
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

export const PIM_NAV_TOOLS = {
  redirect_to_configurator: redirectToConfiguratorTool,
  redirect_to_order: redirectToOrderTool,
  get_proof_status: getProofStatusTool,
};
