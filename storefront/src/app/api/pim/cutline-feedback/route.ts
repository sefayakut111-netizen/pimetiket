/**
 * POST /api/pim/cutline-feedback
 *
 * Sefa 19 May v68 (POC v2 — Pim AI entegrasyonu):
 * pim_etiket_poc.html'in kural-tabanlı `generatePimComment()` çıktısı
 * yerine, GPT-4o-mini ile **kişiselleştirilmiş**, **doğal dilde** yorum
 * üretir. Müşterinin metadata'sına bakar:
 *   - source: vector / vector-with-cutline / raster
 *   - tier: pro / standard / improve
 *   - material_type: paper / transparent / metallic / holographic
 *   - white_plan_mode: off / full / smart / ai / custom
 *   - mode: contour / hull / rect / circle
 *   - offset_mm, dpi, part_count, coverage
 *   - issue_hints[]: POC'un kendi tespit ettiği uyarılar
 *
 * Çıktı: 2-3 cümle Pim tonunda + severity + opsiyonel aksiyon önerisi
 *
 * MALİYET: gpt-4o-mini, ~$0.0002 / çağrı. 100 onay/gün = ~$0.60/ay.
 *
 * AUTH: Sipariş sahibi (order/item kontrolü RPC fn_proof_summary ile aynı).
 * RATE LIMIT: Dakikada 20 (pim/chat'ten daha cömert, çünkü tek-shot).
 *
 * NOT: Pim Etiket'in mevcut Pim sohbet bot'u (sağ alt köşe) bu
 * endpoint'ten BAĞIMSIZ çalışır; o GPT-4o + streaming + tool calling,
 * burası GPT-4o-mini + generateObject + schema validation.
 */

import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { OPENAI_MINI_TIMEOUT_MS } from "@/lib/http/external-timeouts";
import {
  isGlobalAiBudgetExceeded,
  logAiUsage,
} from "@/lib/pim/ai-usage-log";

export const runtime = "nodejs";
export const maxDuration = 15;

// ============================================================
// Schemas
// ============================================================

const ALLOWED_SOURCES = ["raster", "vector", "vector-with-cutline", "psd"] as const;
const ALLOWED_TIERS = ["pro", "standard", "improve"] as const;
const ALLOWED_MATERIALS = [
  "paper",
  "transparent",
  "metallic",
  "holographic",
] as const;
const ALLOWED_WHITE_MODES = [
  "off",
  "full",
  "smart",
  "ai",
  "custom",
] as const;
const ALLOWED_MODES = ["contour", "hull", "rect", "circle"] as const;

const RequestSchema = z.object({
  orderId: z.string().min(1).max(64),
  itemId: z.string().uuid(),
  // POC v2 metadata
  source: z.enum(ALLOWED_SOURCES),
  tier: z.enum(ALLOWED_TIERS),
  material_type: z.enum(ALLOWED_MATERIALS).default("paper"),
  white_plan_mode: z.enum(ALLOWED_WHITE_MODES).default("off"),
  mode: z.enum(ALLOWED_MODES),
  offset_mm: z.number().min(-5).max(20),
  dpi: z.number().int().min(20).max(2400),
  part_count: z.number().int().min(0).max(500),
  coverage: z.number().min(0).max(1).optional(),
  detected_cut_contour_names: z.array(z.string()).max(10).optional(),
  // POC'un kendi tespit ettiği uyarılar (preflight issues)
  issue_hints: z.array(z.string().max(200)).max(10).optional(),
  // Beyaz plan path sayısı (white plan modu off değilse anlamlı)
  white_plan_path_count: z.number().int().min(0).max(10000).optional(),
});

const FeedbackSchema = z.object({
  feedback: z
    .string()
    .min(20)
    .max(500)
    .describe(
      "Pim'in 2-3 cümlelik samimi yorumu. Türkçe, sen-dili, müşteri adıyla."
    ),
  severity: z
    .enum(["ok", "warn", "err"])
    .describe(
      "ok=baskıya hazır, warn=küçük iyileştirme önerisi, err=ciddi sorun"
    ),
  suggested_action: z
    .enum(["approve", "bg_remove", "increase_dpi", "edit_cutline", "request_help", "none"])
    .describe("Müşteriye önerilen sonraki adım."),
});

// ============================================================
// Prompt builder
// ============================================================

const MATERIAL_LABEL: Record<(typeof ALLOWED_MATERIALS)[number], string> = {
  paper: "normal kağıt",
  transparent: "şeffaf folyo",
  metallic: "metalize",
  holographic: "holografik",
};

const WHITE_MODE_LABEL: Record<(typeof ALLOWED_WHITE_MODES)[number], string> = {
  off: "kapalı",
  full: "tam kaplama (silüetin tamamına beyaz)",
  smart: "akıllı (koyu renklerin altına)",
  ai: "AI mod (bağımsız parçalar dahil)",
  custom: "tasarımcı kendi white spot color'ını koymuş",
};

const MODE_LABEL: Record<(typeof ALLOWED_MODES)[number], string> = {
  contour: "kontur (silüete sadık)",
  hull: "çevresel (tek parça)",
  rect: "dikdörtgen",
  circle: "yuvarlak",
};

function buildSystemPrompt(): string {
  return `Sen Pim'sin — Pim Etiket'in akıllı karga asistanı. Müşteri baskı önizleme sayfasında bıçak çizgisini görüyor, sen ona kısa-net yorum yapacaksın.

ROL:
- Müşterinin tasarımına/bıçağa bakıp 2-3 cümle samimi, doğal yorum üret.
- Sen-dili kullan. Resmi DEĞİL. ("yüklemişsin", "deneyelim mi", "az kaldı" gibi).
- Müşteri adı verilirse cümleye doğal kat ("Mehmet, vektörel dosya iyi olmuş").
- "Müşterimiz, kullanıcımız" gibi yapay ifadeler ASLA.

KISITLAR:
- Maks 3 cümle, 60-100 kelime arası.
- Emoji kullanma (UI zaten rozet gösteriyor).
- "AI olarak", "size yardımcı olmak için" gibi robotik klişe YASAK.
- Tahmin etme — sana verilen metadata'ya bağlı kal.
- "Profesyonel" / "Standart" / "İyileştir" etiketlerini metinde tekrar söyleme (UI zaten gösteriyor) — bunun yerine sebebini doğal anlat.

SEVERITY MANTIK:
- tier=pro VEYA source=vector-with-cutline → severity=ok, suggested_action=approve
- tier=improve + coverage>0.95 → severity=warn, suggested_action=bg_remove
- tier=improve + dpi<150 → severity=err, suggested_action=increase_dpi
- tier=improve + (alpha sorun) → severity=warn, suggested_action=bg_remove
- part_count=0 → severity=err, suggested_action=request_help
- part_count>8 → severity=warn, suggested_action=edit_cutline (hull modu öner)
- offset_mm=0 → severity=ok, suggested_action=approve (POC zaten 0.3mm telafi etti)
- diğer → severity=ok, suggested_action=approve

MALZEME / BEYAZ PLAN:
- material=transparent/metallic/holographic ise beyaz plana DEĞİN (operatör için kritik).
- white_plan_mode=custom → "tasarımcının kendi beyazını kullanıyoruz".
- white_plan_mode=off + material!=paper → uyar! Beyaz plansız şeffaf basılırsa renkler soluk çıkar.

ÖRNEKLER:
- "Vektörel dosya yüklemişsin, bıçağı kontur modunda 2mm dışından çıkardım. 8 parça temiz ayrıldı, baskıya hazır görünüyor."
- "PDF'inin içine gömülü CutContour buldum, bıçak senin tasarımcının çizdiği şekilde duruyor — dokunmadım, doğrudan onaylayabilirsin."
- "Görsel kenarlarını takip ediyor — arka planı temiz ayıramadım. AI ile sildirmeyi denersek çok daha temiz bir bıçak çıkar."
- "Şeffaf folyo seçtin, beyaz planı tam kaplama yaptım — renklerin canlı kalsın. Bıçak çevreden 2mm geçiyor."`;
}

function buildUserPrompt(
  input: z.infer<typeof RequestSchema>,
  firstName: string | null,
  itemTitle: string | null
): string {
  const lines: string[] = [];
  lines.push(`Müşteri adı: ${firstName ?? "(bilinmiyor)"}`);
  if (itemTitle) lines.push(`Ürün: ${itemTitle}`);
  lines.push(`Dosya kaynağı: ${input.source}`);
  lines.push(`Tier: ${input.tier}`);
  lines.push(`Malzeme: ${MATERIAL_LABEL[input.material_type]}`);
  lines.push(
    `Beyaz plan: ${WHITE_MODE_LABEL[input.white_plan_mode]} ${input.white_plan_path_count ? `(${input.white_plan_path_count} parça)` : ""}`
  );
  lines.push(`Kesim modu: ${MODE_LABEL[input.mode]}`);
  lines.push(`Kesim mesafesi: ${input.offset_mm.toFixed(1)}mm`);
  lines.push(`Çözünürlük: ${input.dpi} DPI`);
  lines.push(`Tespit edilen parça sayısı: ${input.part_count}`);
  if (typeof input.coverage === "number") {
    lines.push(
      `Bıçak kaplama oranı: %${(input.coverage * 100).toFixed(0)}${input.coverage > 0.95 ? " (çok yüksek — arka plan ayrılamadı olabilir)" : ""}`
    );
  }
  if (input.detected_cut_contour_names?.length) {
    lines.push(
      `Dosyada bulunan gömülü bıçak isimleri: ${input.detected_cut_contour_names.join(", ")}`
    );
  }
  if (input.issue_hints?.length) {
    lines.push(`POC ön kontrol uyarıları: ${input.issue_hints.join(" / ")}`);
  }

  return (
    "Aşağıdaki metadata ile bu müşterinin bıçak önizlemesi için kısa Pim yorumu üret:\n\n" +
    lines.join("\n")
  );
}

// ============================================================
// Handler
// ============================================================

export async function POST(req: Request) {
  // Rate limit — dakikada 20 (kullanıcının değiştirdiği her slider ile çağrılabilir)
  const ip = getClientIp(req);
  const limit = await rateLimit({
    key: `pim-cutline-feedback:${ip}`,
    limit: 20,
    windowMs: 60_000,
  });
  if (!limit.success) {
    return NextResponse.json(
      { error: "rate_limit_exceeded", retryAfter: limit.retryAfter },
      {
        status: 429,
        headers: {
          "retry-after": String(limit.retryAfter),
          "x-ratelimit-remaining": String(limit.remaining),
        },
      }
    );
  }

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

  // Order ownership check
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("user_id, status, address")
    .eq("id", input.orderId)
    .maybeSingle();
  const orderRow = order as {
    user_id: string;
    status: string;
    address: { name?: string } | null;
  } | null;
  if (!orderRow || orderRow.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Item ownership check
  const { data: itemRow } = await admin
    .from("order_items")
    .select("id, title")
    .eq("id", input.itemId)
    .eq("order_id", input.orderId)
    .maybeSingle();
  const itemData = itemRow as { id: string; title: string } | null;
  if (!itemData) {
    return NextResponse.json(
      { error: "item_not_found" },
      { status: 404 }
    );
  }

  // Customer name
  const customerName = orderRow.address?.name ?? null;
  const firstName = customerName ? customerName.split(" ")[0] : null;

  if (await isGlobalAiBudgetExceeded()) {
    const fallback = buildFallbackFeedback(input, firstName);
    return NextResponse.json({
      ok: true,
      ...fallback,
      fallback: true,
    });
  }

  // OpenAI çağrısı (schema-validated, kısa response)
  try {
    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: FeedbackSchema,
      system: buildSystemPrompt(),
      prompt: buildUserPrompt(input, firstName, itemData.title),
      temperature: 0.6,
      maxRetries: 2,
      abortSignal: AbortSignal.timeout(OPENAI_MINI_TIMEOUT_MS),
    });

    await logAiUsage({
      source: "cutline_feedback",
      model: "gpt-4o-mini",
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
    });

    return NextResponse.json({
      ok: true,
      ...result.object,
      // Frontend, severity'e göre rozet rengi ayarlayabilir
    });
  } catch (err) {
    console.error("[pim/cutline-feedback] OpenAI error:", err);
    // Fallback: kural-tabanlı basit metin döndür (UI crash olmasın)
    const fallback = buildFallbackFeedback(input, firstName);
    return NextResponse.json({
      ok: true,
      ...fallback,
      fallback: true,
    });
  }
}

// ============================================================
// Fallback — OpenAI hata verirse veya quota dolarsa
// ============================================================
function buildFallbackFeedback(
  input: z.infer<typeof RequestSchema>,
  firstName: string | null
): z.infer<typeof FeedbackSchema> {
  const name = firstName ? `${firstName}, ` : "";

  if (input.source === "vector-with-cutline") {
    return {
      feedback: `${name}dosyanın içinde gömülü bıçak buldum, senin tasarımcının çizdiği şekilde koruyoruz. Direkt onaylayabilirsin.`,
      severity: "ok",
      suggested_action: "approve",
    };
  }
  if (input.tier === "pro") {
    return {
      feedback: `${name}vektörel dosya yüklemişsin — temiz bir bıçak çıkardım. Baskıya hazır görünüyor.`,
      severity: "ok",
      suggested_action: "approve",
    };
  }
  if (input.part_count === 0) {
    return {
      feedback: `${name}bıçak üretemedim. Görselin şeffaf arka plana sahip olduğundan emin ol veya yardım iste.`,
      severity: "err",
      suggested_action: "request_help",
    };
  }
  if (typeof input.coverage === "number" && input.coverage > 0.95) {
    return {
      feedback: `${name}bıçak görsel kenarını takip ediyor — arka planı temiz ayıramadım. AI ile arka planı sildirmeyi denersek çok daha temiz bir sonuç çıkar.`,
      severity: "warn",
      suggested_action: "bg_remove",
    };
  }
  if (input.dpi < 150) {
    return {
      feedback: `${name}görselin ${input.dpi} DPI'da gelmiş — baskıda pikselli çıkar. 300 DPI bir versiyonun varsa onunla devam edelim.`,
      severity: "err",
      suggested_action: "increase_dpi",
    };
  }
  return {
    feedback: `${name}bıçak ${MODE_LABEL[input.mode]} modunda ${input.offset_mm.toFixed(1)}mm mesafede üretildi, ${input.part_count} parça temiz çıktı.`,
    severity: "ok",
    suggested_action: "approve",
  };
}
