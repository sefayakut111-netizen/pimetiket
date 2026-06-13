/**
 * POST /api/pim/cutline-vision-fallback
 *
 * Sefa 22 May v68 (Faz 3 — AI cutline 2. katman fallback):
 * POC editör OpenCV ile bıçak çıkaramadığında (partCount=0 veya
 * coverage>0.95 → arka plan ayrılamadı) bu endpoint devreye girer.
 * GPT-4o Vision actual preview görseline bakar ve tanı koyar:
 *   - Niye bıçak çıkmadı? (bg jpeg, çoklu obje, düşük kontrast vb.)
 *   - Müşteri ne yapmalı? (bg_remove / different_file / accept_help)
 *   - Pim'in samimi mesajı
 *
 * cutline-feedback ile farkı: bu vision-only (gerçek pixel'lere bakar),
 * cutline-feedback metadata-only (POC'un raporladığı sayılara bakar).
 *
 * MALİYET: gpt-4o (vision), ~$0.005-0.01 / çağrı (low-res 512x512 mode).
 * RATE LIMIT: Dakikada 6 (vision pahalı, sıklıkla tetiklenmemeli).
 *
 * AUTH: Sipariş sahibi (design_files ownership üzerinden).
 *
 * Frontend entegrasyonu (TODO):
 *   POC partCount===0 || coverage>0.95 olunca parent'a postMessage:
 *     { type: 'pim:cutline-fallback-needed', design_file_id, kind: 'no_contours' }
 *   Parent endpoint'i çağırır, response'u POC'a postMessage ile döner.
 */

import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";
import { OPENAI_VISION_TIMEOUT_MS } from "@/lib/http/external-timeouts";
import {
  isGlobalAiBudgetExceeded,
  logAiUsage,
} from "@/lib/pim/ai-usage-log";

export const runtime = "nodejs";
export const maxDuration = 30;

// ============================================================
// Schemas
// ============================================================

const ALLOWED_KINDS = [
  "no_contours", // OpenCV hiç path çıkaramadı (partCount=0)
  "bg_not_separable", // Coverage>0.95, arka plan ayrılmadı
  "low_confidence", // Tier=improve ama spesifik sorun yok
  "complex_multi_object", // partCount>8, çoklu obje karışıklığı
] as const;

// Sefa 22 May v68: designFileId VEYA itemId kabul edilir.
// POC iframe sadece itemId biliyor (URL param) — designFileId yok.
// Sunucu itemId'den en güncel non-superseded design_file'ı bulur.
const RequestSchema = z
  .object({
    orderId: z.string().min(1).max(64),
    designFileId: z.string().uuid().optional(),
    itemId: z.string().uuid().optional(),
    kind: z.enum(ALLOWED_KINDS),
    metadata: z
      .object({
        partCount: z.number().int().min(0).max(500).optional(),
        coverage: z.number().min(0).max(1).optional(),
        dpi: z.number().int().min(20).max(2400).optional(),
        hasAlpha: z.boolean().optional(),
      })
      .optional(),
  })
  .refine((d) => d.designFileId || d.itemId, {
    message: "designFileId veya itemId şart",
  });

const ResponseSchema = z.object({
  diagnosis: z
    .string()
    .min(20)
    .max(400)
    .describe(
      "Görsele bakarak teknik tanı (2-3 cümle, sade Türkçe). Niye bıçak çıkmadı?"
    ),
  severity: z.enum(["warn", "err"]),
  suggested_action: z.enum([
    "bg_remove", // Arka plan kaldır → tekrar dene
    "upload_transparent", // Saydam PNG/PSD versiyonunu yükle
    "upload_vector", // Vektörel (AI/EPS/SVG) yükle
    "request_help", // Operatör yardımı iste (Pim chat)
    "accept_rect", // Dikdörtgen bıçak ile devam et
  ]),
  pim_message: z
    .string()
    .min(20)
    .max(300)
    .describe(
      "Pim'in samimi 2 cümlelik öneri mesajı. Sen-dili, müşteri adıyla."
    ),
});

// ============================================================
// Prompt
// ============================================================

const KIND_LABEL: Record<(typeof ALLOWED_KINDS)[number], string> = {
  no_contours: "OpenCV hiç bıçak path'i çıkaramadı (partCount=0)",
  bg_not_separable:
    "Bıçak görselin tüm kenarlarını sardı (coverage>%95) — arka plan ayrılamadı",
  low_confidence: "Bıçak çıktı ama düşük kalite tier (improve)",
  complex_multi_object:
    "8'den fazla bağımsız parça tespit edildi — karmaşık çoklu obje",
};

function buildSystem(): string {
  return `Sen Pim'sin — Pim Etiket'in akıllı karga asistanı, baskı dosyası uzmanı.

GÖREV:
Müşterinin sticker tasarımına bakacaksın. Otomatik bıçak çıkarma (OpenCV) başarısız oldu. SEN GÖRSELİ İNCELEYIP:
1. Teknik tanı koy (diagnosis): görseldeki ne sorunlu?
2. severity seç: warn (düzeltilebilir) / err (yeni dosya lazım)
3. suggested_action seç (sabit liste)
4. Pim mesajı yaz: 2 cümle, samimi, sen-dili

TANI KATEGORİLERİ:
- "JPG/beyaz arka plan" → bg_remove (AI ile sildirelim) | warn
- "Çok karmaşık, içiçe geçmiş objeler" → upload_vector | warn
- "Resim çok kalitesiz, piksel piksel" → upload_transparent veya request_help | err
- "Şeffaf PNG ama saçaklı kenarlar" → bg_remove | warn
- "Sayfa içinde birden fazla bağımsız sticker" → kullanıcıyı uyar, hangisi kullanılacak? → request_help | warn
- "Hiç sticker yok, sadece düz fotoğraf" → upload_transparent | err
- "Vektörel ama PDF içinde gömülü resim" → upload_vector (AI/EPS) | warn

KISITLAR:
- pim_message: 2 cümle, max 60 kelime.
- diagnosis: 2-3 cümle, teknik ama anlaşılır.
- Türkçe, emoji yok, robotik klişe yok.
- "Yapay zeka olarak" / "size yardımcı" YASAK.`;
}

function buildUser(
  input: z.infer<typeof RequestSchema>,
  firstName: string | null
): string {
  const lines: string[] = [];
  lines.push(`Müşteri adı: ${firstName ?? "(bilinmiyor)"}`);
  lines.push(`Durum: ${KIND_LABEL[input.kind]}`);
  if (input.metadata?.partCount !== undefined) {
    lines.push(`POC partCount: ${input.metadata.partCount}`);
  }
  if (input.metadata?.coverage !== undefined) {
    lines.push(
      `POC coverage: %${(input.metadata.coverage * 100).toFixed(0)}`
    );
  }
  if (input.metadata?.dpi !== undefined) {
    lines.push(`Effective DPI: ${input.metadata.dpi}`);
  }
  if (input.metadata?.hasAlpha !== undefined) {
    lines.push(`Alpha kanal: ${input.metadata.hasAlpha ? "var" : "yok"}`);
  }
  return (
    "Aşağıdaki bilgilere ve ekteki görsele bakarak tanı koy:\n\n" +
    lines.join("\n")
  );
}

// ============================================================
// Vision çağrısı patlarsa: kind'a göre statik öneri
// ============================================================
function buildRuleFallback(
  input: z.infer<typeof RequestSchema>,
  firstName: string | null
): z.infer<typeof ResponseSchema> {
  const name = firstName ? `${firstName}, ` : "";
  switch (input.kind) {
    case "no_contours":
      return {
        diagnosis:
          "OpenCV ön-analizi dosyada hiç bağımsız obje bulamadı — büyük ihtimalle arka plan tamamen şeffaf değil ya da görsel düz bir fotoğraf.",
        severity: "err",
        suggested_action: "upload_transparent",
        pim_message: `${name}bu dosyadan bıçak çıkaramadım. Saydam arka planlı PNG veya vektörel bir versiyonunu yüklersek hallederim.`,
      };
    case "bg_not_separable":
      return {
        diagnosis:
          "Bıçak görselin tüm kenarlarını sardı — beyaz/renkli arka plan otomatik ayrılamadı. AI ile arka planı kaldırırsak temiz silüet çıkar.",
        severity: "warn",
        suggested_action: "bg_remove",
        pim_message: `${name}arka planı temiz ayıramadım. AI ile sildirip tekrar deneyelim mi?`,
      };
    case "low_confidence":
      return {
        diagnosis:
          "Bıçak çıktı ama tier=improve — kalite sınırda. Manuel düzenleme veya yardım iyi olur.",
        severity: "warn",
        suggested_action: "request_help",
        pim_message: `${name}bıçak çıktı ama emin değilim. İstersen sen "Bıçağı düzenle"den ayarla, ya da ekipten yardım iste.`,
      };
    case "complex_multi_object":
      return {
        diagnosis:
          "Tasarım birden fazla bağımsız obje içeriyor — her birine ayrı bıçak ya da hepsini saran tek bıçak tercih meselesi.",
        severity: "warn",
        suggested_action: "request_help",
        pim_message: `${name}içinde birden fazla parça var. Her birini ayrı sticker mı yapayım, yoksa hepsi tek mi olsun?`,
      };
  }
}

function visionFallbackResponse(
  input: z.infer<typeof RequestSchema>,
  firstName: string | null,
  reason?: string
) {
  return NextResponse.json({
    ok: true,
    fallback: true,
    ...(reason ? { fallback_reason: reason } : {}),
    ...buildRuleFallback(input, firstName),
  });
}

// ============================================================
// Handler
// ============================================================

export async function POST(req: Request) {
  // Body
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", detail: parsed.error.issues },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // Auth
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ownership check via design_files + orders.
  const admin = createAdminClient();
  type DfRow = {
    id: string;
    order_id: string;
    user_id: string;
    storage_path: string;
    mime_type: string;
  };
  let df: DfRow | null = null;
  if (input.designFileId) {
    const { data } = await admin
      .from("design_files")
      .select("id, order_id, user_id, storage_path, mime_type")
      .eq("id", input.designFileId)
      .maybeSingle();
    df = data as DfRow | null;
  } else if (input.itemId) {
    const { data } = await admin
      .from("design_files")
      .select("id, order_id, user_id, storage_path, mime_type")
      .eq("order_item_id", input.itemId)
      .eq("order_id", input.orderId)
      .neq("status", "superseded")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    df = data as DfRow | null;
  }
  if (!df || df.user_id !== user.id || df.order_id !== input.orderId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Customer name (orders.address.name)
  const { data: orderRow } = await admin
    .from("orders")
    .select("address")
    .eq("id", input.orderId)
    .maybeSingle();
  const customerName =
    (orderRow as { address?: { name?: string } | null } | null)?.address
      ?.name ?? null;
  const firstName = customerName ? customerName.split(" ")[0] : null;

  // Rate limit — vision pahalı; limit aşılırsa kural-tabanlı fallback (UI kırılmasın)
  const ip = getClientIp(req);
  const limit = await rateLimit({
    key: `pim-cutline-vision:${ip}`,
    limit: 6,
    windowMs: 60_000,
  });
  if (!limit.success) {
    return visionFallbackResponse(input, firstName, "rate_limit");
  }

  if (await isGlobalAiBudgetExceeded()) {
    return visionFallbackResponse(input, firstName, "budget");
  }

  // Signed URL — vision 1 saatlik short-lived
  const { data: signed, error: signErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(df.storage_path, 3600);
  if (signErr || !signed?.signedUrl) {
    console.error("[pim/cutline-vision-fallback] signed URL failed:", signErr);
    return visionFallbackResponse(input, firstName, "signed_url_failed");
  }

  // Vision call — image_url message + structured output
  try {
    const result = await generateObject({
      model: openai("gpt-4o"),
      schema: ResponseSchema,
      system: buildSystem(),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildUser(input, firstName) },
            { type: "image", image: signed.signedUrl },
          ],
        },
      ],
      temperature: 0.4,
      maxRetries: 2,
      abortSignal: AbortSignal.timeout(OPENAI_VISION_TIMEOUT_MS),
    });

    await logAiUsage({
      source: "cutline_vision",
      model: "gpt-4o",
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
    });

    return NextResponse.json({
      ok: true,
      ...result.object,
    });
  } catch (err) {
    console.error("[pim/cutline-vision-fallback] OpenAI error:", err);
    return visionFallbackResponse(input, firstName, "openai_error");
  }
}
