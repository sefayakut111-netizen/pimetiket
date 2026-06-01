/**
 * POST /api/editor/pim-command — Pim editör komut (kural + LLM).
 * Whitelist validate + canlı ürün sınırları. gpt-4o-mini fallback.
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
import {
  buildReferenceReply,
  clampPimCommand,
  resolvePimCommandWithLlm,
  STICKER_LIMITS,
} from "@/lib/editor/pim-command-llm";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 15;

function resolveReferenceCommand(text: string): {
  command: PimEditorCommand;
  reply: string;
} | null {
  const ref = lookupSizeReference(text);
  if (!ref) return null;
  const command = clampPimCommand({
    action: "set_size_from_reference",
    referenceKey: ref.labelTr,
    estimatedWidthMm: ref.widthMm,
    estimatedHeightMm: ref.heightMm,
    confidence: 1,
    isEstimate: false,
  });
  return {
    command,
    reply: buildReferenceReply(
      ref.labelTr,
      ref.widthMm,
      ref.heightMm,
      ref.shape
    ),
  };
}

function fallbackClarify(): { command: PimEditorCommand; reply: string } {
  return {
    command: {
      action: "clarify",
      question:
        "Boyutu mm veya santim olarak yazar mısın? (Örn: 50 mm veya 5 cm)",
    },
    reply:
      "Şimdilik basit komutları anlıyorum — boyut, kesim şekli, arka plan silme gibi. Net bir mm/cm değeri yazarsan uygularım.",
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
  let reply: string | null = null;

  if (!command && body.message) {
    const refResult = resolveReferenceCommand(body.message);
    if (refResult) {
      command = refResult.command;
      reply = refResult.reply;
    } else {
      const llmResult = await resolvePimCommandWithLlm(body.message);
      if (llmResult) {
        command = llmResult.command;
        reply = llmResult.reply;
      } else {
        const fb = fallbackClarify();
        command = fb.command;
        reply = fb.reply;
      }
    }
  }

  if (!command) {
    return NextResponse.json({ error: "command_or_message_required" }, { status: 400 });
  }

  command = clampPimCommand(command);

  if (!reply) {
    if (command.action === "clarify") {
      reply = command.question;
    } else if (command.action === "reject") {
      reply = command.reason;
    } else {
      reply = "Tamam, uyguladım.";
    }
  }

  const pricing = await getLivePricingConfig("sticker").catch(() => null);

  return NextResponse.json({
    ok: true,
    command,
    reply,
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
