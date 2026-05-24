/**
 * tokens_used smoke test — gerçek GPT-4o Vision çağrısı + DB insert doğrulaması.
 * Storage'da dosya yoksa public test görseli kullanır.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

for (const name of [".env.local", ".env.agent"]) {
  const p = resolve(root, name);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

if (!process.env.OPENAI_API_KEY) {
  console.log(JSON.stringify({ ok: false, reason: "no_openai_key" }));
  process.exit(0);
}

const { runDesignQC } = await import("../src/lib/agents/design-qc.ts");

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Önce DB'deki raster dosya + storage; yoksa sabit test görseli
let fileUrl = null;
let fileFormat = "png";
let orderId = null;
let designFileId = null;
let printWidthMm = 50;
let printHeightMm = 50;
let productType = "etiket";

const { data: candidate } = await admin
  .from("design_files")
  .select("id, order_id, mime_type, storage_path")
  .not("order_id", "is", null)
  .or("mime_type.ilike.image/png,mime_type.ilike.image/jpeg")
  .limit(1)
  .maybeSingle();

if (candidate) {
  const { data: signed } = await admin.storage
    .from("designs")
    .createSignedUrl(candidate.storage_path, 3600);
  if (signed?.signedUrl) {
    fileUrl = signed.signedUrl;
    orderId = candidate.order_id;
    designFileId = candidate.id;
    fileFormat = candidate.mime_type.includes("jpeg") ? "jpeg" : "png";
    const { data: item } = await admin
      .from("order_items")
      .select("width, height, product")
      .eq("order_id", candidate.order_id)
      .limit(1)
      .maybeSingle();
    if (item) {
      printWidthMm = item.width;
      printHeightMm = item.height;
      productType = item.product;
    }
  }
}

if (!fileUrl) {
  // Storage'da obje yok — OpenAI Vision smoke için küçük public PNG
  fileUrl = "https://picsum.photos/200/300.jpg";
  fileFormat = "jpeg";
  orderId = candidate?.order_id ?? "SMOKE-QC-TEST";
  designFileId = candidate?.id ?? null;
}

const result = await runDesignQC({
  fileUrl,
  fileFormat,
  printWidthMm,
  printHeightMm,
  productType,
});

const { data: inserted, error } = await admin
  .from("design_quality_checks")
  .insert({
    order_id: orderId,
    design_file_id: designFileId,
    file_format: fileFormat,
    print_width_mm: printWidthMm,
    print_height_mm: printHeightMm,
    product_type: productType,
    verdict: result.verdict,
    score: result.score,
    model: result.model,
    duration_ms: result.durationMs,
    cost_usd: result.costUsd,
    tokens_used: result.tokensUsed ?? null,
  })
  .select("id, tokens_used, model")
  .single();

if (error) {
  console.log(JSON.stringify({ ok: false, reason: error.message }));
  process.exit(1);
}

const ok =
  result.model === "gpt-4o"
    ? inserted?.tokens_used != null && Number(inserted.tokens_used) > 0
    : true;

console.log(
  JSON.stringify({
    ok,
    model: result.model,
    tokensUsed: result.tokensUsed,
    dbTokensUsed: inserted?.tokens_used,
    usedFallbackImage: !candidate || !designFileId,
  })
);

if (inserted?.id) {
  await admin.from("design_quality_checks").delete().eq("id", inserted.id);
}

process.exit(ok ? 0 : 1);
