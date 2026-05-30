/**
 * POST /api/admin/orders/bypass-checkout
 *
 * Admin ödeme sayfası "ödeme atla" — yalnızca admin/staff.
 * fn_create_order service_role ile çağrılır (Mig 114).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { assertAdmin } from "@/lib/supabase/assert-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCartPricing } from "@/lib/payment-validation";
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
  shape: z.string().nullish(),
  cut: z.string().nullish(),
  softCorners: z.boolean().nullish(),
  material: z.string().nullish(),
  finish: z.string().nullish(),
  hediyeAdet: z.number().nullish(),
  materialId: z.string().nullish(),
  coatingId: z.string().nullish(),
  customizationId: z.string().nullish(),
  winding: z.number().nullish(),
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

export async function POST(req: Request) {
  const auth = await assertAdmin();
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const calcSubtotal = body.items.reduce((s, i) => s + i.total, 0);
  if (Math.abs(calcSubtotal - body.subtotal) > 0.05) {
    return NextResponse.json(
      { error: "subtotal_mismatch", expected: calcSubtotal },
      { status: 400 }
    );
  }
  const calcTotal = body.subtotal + body.shipping;
  if (Math.abs(calcTotal - body.total) > 0.05) {
    return NextResponse.json(
      { error: "total_mismatch", expected: calcTotal },
      { status: 400 }
    );
  }

  const itemsForValidation = body.items.map((item, idx) => ({
    id: `bypass-${idx}`,
    product: item.product,
    title: item.title,
    config: item.config,
    width: item.width,
    height: item.height,
    qty: item.qty,
    unit: item.unit,
    total: item.total,
    meta: item.meta,
    shape: item.shape,
    cut: item.cut,
    material: item.material,
    finish: item.finish,
    coatingId: item.coatingId,
    customizationId: item.customizationId,
    materialId: item.materialId,
    designCount:
      item.meta && typeof item.meta.designCount === "number"
        ? item.meta.designCount
        : null,
  }));

  const pricingValidation = await validateCartPricing(
    itemsForValidation,
    body.subtotal
  );
  if (!pricingValidation.ok) {
    console.warn("[admin/bypass-checkout] pricing validation failed:", {
      adminId: auth.user.id,
      failures: pricingValidation.failures,
    });
    return NextResponse.json(
      { error: "pricing_validation_failed" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const payload: ServerCreateOrderPayload = {
    userId: auth.user.id,
    items: body.items as ServerCreateOrderPayload["items"],
    address: body.address,
    invoice: {
      type: body.invoice.type,
      tc: body.invoice.tc ?? undefined,
      vkn: body.invoice.vkn ?? undefined,
      companyName: body.invoice.companyName ?? undefined,
      taxOffice: body.invoice.taxOffice ?? undefined,
    },
    payment: { method: "card", masked: "**** 0000 (admin bypass)" },
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
