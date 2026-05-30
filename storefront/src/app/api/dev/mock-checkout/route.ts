/**
 * POST /api/dev/mock-checkout
 *
 * PayTR yapılandırılmamış local/dev ortamda test siparişi.
 * Production'da 404 — ücretsiz sipariş açığı yok.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createPaidOrderViaServiceRole,
  type ServerCreateOrderPayload,
} from "@/lib/payment/server-create-order";

const CartItemSchema = z.object({
  product: z.enum(["sticker", "etiket"]),
  title: z.string().min(1),
  config: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  qty: z.number().int().positive(),
  unit: z.number().nonnegative(),
  total: z.number().nonnegative(),
  meta: z.record(z.string(), z.unknown()).nullish(),
  designTempId: z.string().nullish(),
});

const BodySchema = z.object({
  items: z.array(CartItemSchema).min(1),
  address: z.object({
    label: z.string().nullish(),
    name: z.string().min(1),
    addr: z.string().min(1),
    city: z.string().min(1),
    phone: z.string().min(1),
  }),
  invoice: z.object({
    type: z.enum(["individual", "corporate"]),
    tc: z.string().nullish(),
    vkn: z.string().nullish(),
    companyName: z.string().nullish(),
    taxOffice: z.string().nullish(),
  }),
  subtotal: z.number().nonnegative(),
  shipping: z.number().nonnegative(),
  total: z.number().positive(),
  estimatedDelivery: z.string().optional(),
});

function devMockCheckoutBlocked(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.VERCEL_ENV === "production") return true;
  return process.env.ENABLE_DEV_ENDPOINTS !== "true";
}

export async function POST(req: Request) {
  if (devMockCheckoutBlocked()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const admin = createAdminClient();
  const payload: ServerCreateOrderPayload = {
    userId: user.id,
    items: body.items as ServerCreateOrderPayload["items"],
    address: body.address,
    invoice: {
      type: body.invoice.type,
      tc: body.invoice.tc ?? undefined,
      vkn: body.invoice.vkn ?? undefined,
      companyName: body.invoice.companyName ?? undefined,
      taxOffice: body.invoice.taxOffice ?? undefined,
    },
    payment: { method: "card", masked: "**** **** **** 0000" },
    subtotal: body.subtotal,
    shipping: body.shipping,
    total: body.total,
    estimatedDelivery: body.estimatedDelivery,
  };

  const result = await createPaidOrderViaServiceRole(admin, payload);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, orderId: result.orderId });
}
