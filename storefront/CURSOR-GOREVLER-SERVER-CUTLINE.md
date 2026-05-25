# Cursor — Server-Side Cutline Üretimi (Puppeteer Headless)

> Claude Code (mimari) tarafından hazırlanmıştır · 26 May 2026
> Bıçak üretimini client-side'dan server-side'a taşır.
> Müşterinin /onay sayfasını açmasına bağımlılık KALKAR.
> **CURSOR-GOREVLER-ODEME-SONRASI-KOMPLE.md tamamlandıktan sonra yapılmalı.**

---

## SORUN

Bıçak çizimi (cutline) şu an sadece `/onay` sayfasındaki hidden iframe ile üretiliyor (client-side OpenCV.js). Müşteri bu sayfayı hiç açmazsa:
- Bıçak asla üretilmez
- 5dk SLA dolar → operatöre düşer
- Sipariş sonsuza kadar takılır

## ÇÖZÜM

QC geçtikten sonra bıçağı SERVER-SIDE üret. Aynı `poc.html` dosyasını Puppeteer headless Chrome ile çalıştır. Müşteri `/onay`'a geldiğinde bıçak ZATEN hazır olur.

---

## GÖREV 1/6 — Puppeteer + Chromium Dependency Ekle

### Komut

```bash
npm install puppeteer-core @sparticuz/chromium
```

`@sparticuz/chromium` Vercel serverless'ta çalışan minimal Chromium binary'si. `puppeteer-core` tarayıcıyı kontrol eder.

### package.json kontrolü
- `puppeteer-core` (NOT `puppeteer` — kendi Chrome indirmez)
- `@sparticuz/chromium` (Vercel lambda uyumlu, ~50MB)

---

## GÖREV 2/6 — Cutline Generator Lib Oluştur

### Yeni Dosya
`src/lib/agents/generate-cutline-headless.ts`

### Kod

```typescript
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

interface CutlineResult {
  svg: string;
  preview_png_base64: string | null;
  meta: Record<string, unknown>;
}

/**
 * Headless Puppeteer ile POC'u çalıştırıp bıçak üretir.
 * poc.html?autoSave=1&headless=1 → postMessage "pim-cutline-saved" bekler.
 */
export async function generateCutlineHeadless(args: {
  designUrl: string;
  designName: string;
  designMime: string;
  material: string;
  orderId: string;
  itemId: string;
  siteUrl: string;
}): Promise<CutlineResult | null> {
  // Dynamic import — sadece bu fonksiyon çağrıldığında yükle
  const chromium = await import("@sparticuz/chromium");
  const puppeteer = await import("puppeteer-core");

  let browser = null;
  try {
    browser = await puppeteer.default.launch({
      args: chromium.default.args,
      defaultViewport: { width: 1280, height: 900 },
      executablePath: await chromium.default.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();

    // postMessage yakalamak için promise
    const cutlinePromise = new Promise<CutlineResult | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 90000); // 90sn timeout

      page.exposeFunction("__pimCutlineSaved", (data: string) => {
        clearTimeout(timeout);
        try {
          const parsed = JSON.parse(data) as {
            svg?: string;
            preview_png_base64?: string | null;
            meta?: Record<string, unknown>;
          };
          if (parsed.svg && parsed.meta) {
            resolve({
              svg: parsed.svg,
              preview_png_base64: parsed.preview_png_base64 ?? null,
              meta: parsed.meta,
            });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });

      page.exposeFunction("__pimCutlineFailed", (_err: string) => {
        clearTimeout(timeout);
        resolve(null);
      });
    });

    // postMessage intercept — POC'un parent.postMessage'ını yakala
    await page.evaluateOnNewDocument(() => {
      const origPostMessage = window.parent.postMessage.bind(window.parent);
      window.parent.postMessage = (msg: unknown, target?: string) => {
        const d = msg as { type?: string } | undefined;
        if (d?.type === "pim-cutline-saved") {
          (window as unknown as { __pimCutlineSaved: (s: string) => void })
            .__pimCutlineSaved(JSON.stringify(msg));
        } else if (d?.type === "pim-cutline-auto-failed" || d?.type === "pim-poc-error") {
          (window as unknown as { __pimCutlineFailed: (s: string) => void })
            .__pimCutlineFailed(JSON.stringify(msg));
        }
        origPostMessage(msg, target ?? "*");
      };
    });

    // POC'u aç
    const params = new URLSearchParams({
      embed: "1",
      designUrl: args.designUrl,
      designName: args.designName,
      designMime: args.designMime,
      material: args.material,
      mode: "contour",
      autoSave: "1",
      headless: "1",
      orderId: args.orderId,
      itemId: args.itemId,
    });

    await page.goto(`${args.siteUrl}/poc.html?${params.toString()}`, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Sonucu bekle
    const result = await cutlinePromise;
    return result;
  } catch (err) {
    console.error("[cutline-headless] error:", err);
    return null;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
```

### Notlar
- `@sparticuz/chromium` Vercel'de çalışır (lambda layer)
- Dynamic import ile lazy load — her request'te yüklenmez
- 90sn timeout — POC OpenCV.js yükleme + contour extraction süresi
- postMessage intercept: POC `parent.postMessage` çağrısını yakalayıp Node.js'e aktarır

---

## GÖREV 3/6 — Cutline Orchestrator (QC Sonrası Tetik)

### Yeni Dosya
`src/lib/agents/run-order-cutline.ts`

### Kod

```typescript
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { generateCutlineHeadless } from "./generate-cutline-headless";
import { categorizeFile } from "@/lib/design-file-types";
import { SITE_URL } from "@/lib/env";

/**
 * Siparişteki tüm item'lar için server-side bıçak üretir.
 * QC geçtikten sonra çağrılır (run-order-qc.ts'den).
 */
export async function runOrderCutlineGeneration(
  admin: SupabaseClient<Database>,
  orderId: string
): Promise<{ generated: number; failed: number }> {
  const siteUrl = SITE_URL();
  let generated = 0;
  let failed = 0;

  // Sipariş item'larını al
  const { data: items } = await admin
    .from("order_items")
    .select("id, product, width, height, meta")
    .eq("order_id", orderId);

  if (!items || items.length === 0) return { generated: 0, failed: 0 };

  for (const item of items) {
    const itemMeta = item.meta as Record<string, unknown> | null;

    // Bu item için design_files al
    const { data: designFiles } = await admin
      .from("design_files")
      .select("id, storage_path, original_name, mime_type, status")
      .eq("order_item_id", item.id)
      .in("status", ["uploaded", "analyzing", "qc_passed", "qc_warned"]);

    if (!designFiles || designFiles.length === 0) continue;

    for (const df of designFiles) {
      // JPG/JPEG → qc_only, bıçak üretilemez (geometrik shape gerekir)
      const category = categorizeFile(df.original_name, df.mime_type);
      if (category === "qc_only") continue; // JPG — müşteri /onay'da shape seçer
      if (category === "blocked") continue;

      // Mevcut cutline var mı kontrol et
      const { count: existingCutline } = await admin
        .from("cutline_designs")
        .select("id", { count: "exact", head: true })
        .eq("order_item_id", item.id)
        .eq("design_file_id", df.id)
        .in("status", ["draft", "auto_generated", "approved"]);

      if (existingCutline && existingCutline > 0) continue; // Zaten var

      // Signed URL al
      const { data: signedData } = await admin.storage
        .from("design-files")
        .createSignedUrl(df.storage_path, 300); // 5dk

      if (!signedData?.signedUrl) {
        failed++;
        continue;
      }

      // Material mapping
      const materialRaw = String(itemMeta?.material_type ?? itemMeta?.material ?? "paper");
      const material =
        materialRaw === "transparan" || materialRaw === "transparent" ? "transparent"
        : materialRaw === "holo" || materialRaw === "holographic" ? "holographic"
        : materialRaw === "simli" || materialRaw === "metallic" ? "metallic"
        : "paper";

      // Headless cutline üret
      const result = await generateCutlineHeadless({
        designUrl: signedData.signedUrl,
        designName: df.original_name,
        designMime: df.mime_type,
        material,
        orderId,
        itemId: item.id,
        siteUrl,
      });

      if (!result) {
        failed++;
        // Event log
        await admin.from("order_events").insert([{
          order_id: orderId,
          event_type: "cutline_generation_failed",
          status_after: null,
          actor_id: "system",
          actor_role: "system",
          summary: `Otomatik bıçak üretilemedi: ${df.original_name}`,
          detail: { itemId: item.id, designFileId: df.id },
        }]);
        continue;
      }

      // save-edit endpoint'ine POST et (internal)
      try {
        const saveRes = await fetch(`${siteUrl}/api/orders/${orderId}/proof/${item.id}/save-edit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            svg: result.svg,
            preview_png_base64: result.preview_png_base64,
            auto: true,
            design_file_id: df.id,
            ...result.meta,
          }),
        });

        if (saveRes.ok) {
          generated++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }
  }

  // Tüm cutline'lar üretildiyse status güncelle
  if (generated > 0 && failed === 0) {
    await admin
      .from("orders")
      .update({ status: "proof_pending" })
      .eq("id", orderId)
      .eq("status", "proof_generating");

    // Müşteriye mail at
    await admin.from("mail_outbox").insert([{
      to_email: null, // mail trigger user_id'den çeker
      template: "proof_ready",
      payload: { order_id: orderId },
      order_id: orderId,
    }]).catch(() => {});
  }

  return { generated, failed };
}
```

---

## GÖREV 4/6 — QC Pipeline'a Cutline Tetikleyici Ekle

### Dosya
`src/lib/agents/run-order-qc.ts`

### Konum
QC aggregate verdict hesaplandıktan sonra (status güncelleme bloğu, satır ~415-422 civarı).

### Fix

```typescript
// QC sonucu proof_generating ise → cutline üretimini başlat
// ESKİ:
// status = "proof_generating" → sadece DB update
// Müşteri /onay'ı açınca client-side iframe üretiyordu

// YENİ — server-side cutline tetikle:
if (nextStatus === "proof_generating") {
  await admin
    .from("orders")
    .update({ status: "proof_generating" })
    .eq("id", orderId);

  // Server-side cutline üretimini başlat (background)
  try {
    const { after } = await import("next/server");
    after(async () => {
      const { runOrderCutlineGeneration } = await import("./run-order-cutline");
      await runOrderCutlineGeneration(admin, orderId);
    });
  } catch {
    // after() yoksa (local dev) → fire-and-forget
    import("./run-order-cutline").then(({ runOrderCutlineGeneration }) => {
      void runOrderCutlineGeneration(admin, orderId).catch((err) => {
        console.error("[cutline-gen] background error:", err);
      });
    });
  }
}
```

### Notlar
- `after()` pattern mevcut QC scheduling ile aynı (schedule-order-design-qc.ts)
- Vercel'de lambda response'tan sonra background'da çalışır
- Cutline üretimi 30-90sn sürebilir — `after()` bunu tolere eder

---

## GÖREV 5/6 — Cutline Generation API Endpoint (Fallback + Manuel Tetik)

### Yeni Dosya
`src/app/api/agents/cutline-generate/route.ts`

### Amaç
Admin panelden veya cron'dan cutline üretimini manuel tetikleyebilmek. Ayrıca `after()` çalışmazsa fallback.

### Kod

```typescript
import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runOrderCutlineGeneration } from "@/lib/agents/run-order-cutline";

export const maxDuration = 120; // 2dk Vercel timeout

export async function POST(req: NextRequest) {
  // Admin auth kontrolü
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { orderId?: string };
  if (!body.orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const result = await runOrderCutlineGeneration(admin, body.orderId);

  return NextResponse.json({
    ok: true,
    generated: result.generated,
    failed: result.failed,
  });
}
```

---

## GÖREV 6/6 — Onay Sayfası: Server Cutline Varsa İframe Atla

### Dosya
`src/app/onay/[orderId]/page.tsx`

### Konum
Background auto-cutline useEffect (satır ~677-764)

### Sorun
Şu an her zaman client-side iframe tetikleniyor. Server-side cutline zaten ürettiyse iframe gereksiz.

### Fix

```typescript
// Satır ~677 — useEffect başlangıcı:
// Mevcut: cutline'sız her design için iframe queue oluştur

// YENİ — önce mevcut cutline kontrol et (server-side üretmiş olabilir):
useEffect(() => {
  if (!data) return;
  if (bgGenItemId) return; // Zaten iframe aktif

  // Cutline'sız design_file bul
  let candidate = null;
  for (const item of data.items) {
    if (item.proof_status === "approved") continue;
    // ... mevcut candidate bulma kodu ...

    // YENİ: designs array'deki her design'ın cutline'ı var mı kontrol et
    if (item.designs && item.designs.length > 0) {
      const noCutDesign = item.designs.find(
        (d) =>
          !d.cutline &&
          categorizeFile(d.file_name, d.mime_type) !== "qc_only"
      );
      if (noCutDesign) {
        candidate = { /* ... */ };
        break;
      }
    } else if (!item.cutline) {
      candidate = { /* ... */ };
      break;
    }
  }

  // Candidate yoksa → tüm cutline'lar hazır (server-side üretilmiş)
  // İframe'e gerek yok
  if (!candidate) return;

  // ... mevcut iframe kodu devam eder (fallback olarak kalır) ...
}, [data, bgGenItemId, orderId]);
```

Bu değişiklik minimal — mevcut logic'i bozmaz. Server-side cutline varsa iframe atlanır. Yoksa (JPG, veya server-side başarısız olduysa) client-side fallback devreye girer.

---

## UYGULAMA SIRASI

| # | Görev | Dosya | Süre |
|---|-------|-------|------|
| 1 | Dependencies | package.json | 2 dk |
| 2 | Headless generator | lib/agents/generate-cutline-headless.ts | 30 dk |
| 3 | Orchestrator | lib/agents/run-order-cutline.ts | 20 dk |
| 4 | QC pipeline tetik | lib/agents/run-order-qc.ts | 10 dk |
| 5 | API endpoint | api/agents/cutline-generate/route.ts | 10 dk |
| 6 | Onay sayfası iframe skip | onay/[orderId]/page.tsx | 10 dk |

**Her görev sonrası:** `npx tsc --noEmit` + commit (`feat(cutline):` prefix)

---

## TEST

```
1. Sticker sipariş ver + tasarım yükle (PNG) + ödeme yap
2. QC geçtikten sonra status → proof_generating olmalı ✅
3. Server-side cutline üretimi otomatik başlamalı ✅
4. 30-90sn bekle → cutline_designs row INSERT edilmeli ✅
5. Status → proof_pending olmalı ✅
6. /onay sayfasını aç → cutline ZATEN HAZIR olmalı ✅
7. İframe açılmamalı (cutline var) ✅
8. "Bu ürünü onayla" butonu aktif olmalı ✅

Edge case — JPG dosya:
9. JPG yükle → server-side cutline üretilMEZ (qc_only) ✅
10. /onay'da JpgShapeSelector gösterilmeli ✅

Edge case — Server-side başarısız:
11. Cutline üretilemezse → /onay'da client-side iframe devreye girer ✅
12. İframe de başarısız → 5dk SLA → operatöre düşer ✅
```

---

## MİMARİ NOT

```
ÖNCE (client-side bağımlı):
  QC geçti → proof_generating → MÜŞTERİ /onay AÇAR → iframe → bıçak → proof_pending

SONRA (server-side):
  QC geçti → proof_generating → SERVER bıçak üretir → proof_pending → müşteri gelir → hazır!
  (client-side iframe FALLBACK olarak kalır — JPG + hata durumları için)
```

---

*Hazırlayan: Claude Code (mimari) · 26 May 2026*
