/**
 * POST /api/editor/pim-command — Pim editör komut iskeleti (Dalga 3 / Faz 1).
 * Whitelist validate + canlı ürün sınırları enjeksiyonu. LLM entegrasyonu sonraki faz.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getLivePricingConfig } from "@/lib/pricing-config";
import { lookupSizeReference, SIZE_REFERENCES } from "@/lib/editor/size-references";
import {
  PimCommandRequestSchema,
  type PimEditorCommand,
} from "@/lib/editor/pim-command-schema";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const STICKER_LIMITS = {
  minWidthMm: 25,
  maxWidthMm: 400,
  minHeightMm: 25,
  maxHeightMm: 650,
  minQty: 25,
  maxQty: 1000,
} as const;

function resolveReferenceCommand(text: string): PimEditorCommand | null {
  const ref = lookupSizeReference(text);
  if (!ref) return null;
  return {
    action: "set_size_from_reference",
    referenceKey: ref.labelTr,
    estimatedWidthMm: ref.widthMm,
    estimatedHeightMm: ref.heightMm,
    confidence: 1,
    isEstimate: false,
  };
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limit = await rateLimit({
    key: `editor-pim-command:${ip}`,
    limit: 30,
    windowMs: 60_000,
  });
  if (!limit.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof PimCommandRequestSchema>;
  try {
    body = PimCommandRequestSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  let command = body.command ?? null;
  if (!command && body.message) {
    command = resolveReferenceCommand(body.message);
    if (!command) {
      return NextResponse.json({
        ok: true,
        command: {
          action: "clarify",
          question:
            "Boyutu mm veya santim olarak yazar mısın? (Örn: 50 mm veya 5 cm)",
        } satisfies PimEditorCommand,
        limits: STICKER_LIMITS,
        references: SIZE_REFERENCES.map((r) => ({
          label: r.labelTr,
          widthMm: r.widthMm,
          heightMm: r.heightMm,
          shape: r.shape,
        })),
      });
    }
  }

  if (!command) {
    return NextResponse.json({ error: "command_or_message_required" }, { status: 400 });
  }

  const pricing = await getLivePricingConfig("sticker").catch(() => null);

  return NextResponse.json({
    ok: true,
    command,
    limits: STICKER_LIMITS,
    liveConfigLoaded: pricing != null,
    references: SIZE_REFERENCES.map((r) => ({
      label: r.labelTr,
      widthMm: r.widthMm,
      heightMm: r.heightMm,
      shape: r.shape,
    })),
  });
}
