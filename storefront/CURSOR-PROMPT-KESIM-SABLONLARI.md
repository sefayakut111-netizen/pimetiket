# Kesim Bıçağı (Die-Cut) Şablon Kütüphanesi — `/sablonlar`

## AMAÇ
Sefa, 65 farklı 1:1 ölçekli **kesim bıçağı (die-cut) şablonu** çizdi (vektörel). Her şablon
2 kesim setinde (KissCut / ThruCut) ve 3 formatta (PDF / AI / EPS) var → toplam 390 dosya.

Bunları `/sablonlar` altında **herkesin anlayacağı, güzel bir UX** ile yayınlayacağız:
- **Herkes görebilir / önizleyebilir** (anonim dahil).
- **Sadece üyeler (oturum açmış kullanıcı) dosya indirebilir.**

Header'a (sol üst nav) **"Şablonlar"** girişi eklenecek.

## KAYNAK DOSYALAR (yerel — Sefa'nın masaüstü)
```
C:\Users\msı\Desktop\Pim-Etiket-Bicak-Sablonlari\
  OKU.txt                          → teknik açıklama (oku)
  Katalog.pdf                      → tüm şekillerin görsel listesi
  KissCut-CutContour-Magenta\      → kontur / kiss-cut seti (spot: CutContour, %100 magenta)
    PDF\ AI\ EPS\  →  Yuvarlak\ Kare\ Dikdortgen\ Oval\ Bumper\
  ThruCut-Mavi\                    → tam kesim seti (spot: ThruCut, mavi) — geometri birebir aynı
    PDF\ AI\ EPS\  →  Yuvarlak\ Kare\ Dikdortgen\ Oval\ Bumper\
```
İki setin **geometrisi birebir aynıdır**; fark sadece kesim çizgisinin spot rengi/adıdır.

### Şekil envanteri (65 şablon)
| Kategori | Ölçüler (mm) | Köşe varyantı | Adet |
|---|---|---|---|
| Yuvarlak (çap) | 25,30,40,50,60,70,80,90,100,110,120,130 | — | 12 |
| Kare | 25,30,40,50 | keskin + yuvarlak-r3 | 8 |
| Dikdörtgen (GxY) | 40x25,40x30,50x30,50x40,60x40,70x40,70x50,80x50,90x50,90x60,100x50,100x70,120x80,148x105,100x150 | keskin + yuvarlak-r3 | 30 |
| Oval (GxY) | 40x25,40x30,45x30,50x30,55x35,60x40,65x45,80x50,90x60,100x70 | — | 10 |
| Bumper (GxY) | 100x40,150x50,200x60,250x75,300x100 | yuvarlak-r6 | 5 |

### Dosya adı kalıpları
- `Yuvarlak_Cap{N}mm.{ext}`
- `Kare_{N}x{N}_{keskin|yuvarlak-r3}.{ext}`
- `Dikdortgen_{G}x{Y}_{keskin|yuvarlak-r3}.{ext}`
- `Oval_{G}x{Y}.{ext}`
- `Bumper_{G}x{Y}_r6.{ext}`

Yol: `{set-dizini}\{FORMAT}\{Kategori}\{dosya}.{ext}`
(`set-dizini` = `KissCut-CutContour-Magenta` | `ThruCut-Mavi`; `FORMAT` = `PDF|AI|EPS`; `Kategori` = `Yuvarlak|Kare|Dikdortgen|Oval|Bumper`)

---

## MİMARİ KARARLAR (uygula, değiştirme)

1. **Depolama:** Dosyalar **Cloudflare R2**'ye yüklenir (mevcut `pim-etiket-archive` bucket, egress ücretsiz). Prefix:
   `templates/die-cut/{set}/{format}/{category}/{fileBase}.{ext}`
   örn: `templates/die-cut/kisscut/pdf/yuvarlak/Yuvarlak_Cap50mm.pdf`
   `public/` KULLANMA — public klasör gating'siz, üye kapısını kıramayız.
2. **Üye kapısı sunucuda:** Sayfa herkese açık. İndirme **route handler**'dan geçer; handler
   `supabase.auth.getUser()` ile oturum kontrol eder, yoksa 401 döner. Üye ise R2 **signed URL** (5 dk) döner.
   Pattern referansı: `src/app/api/customer/design-files/[id]/restore-url/route.ts`.
3. **Önizmeler programatik SVG:** PDF/AI/EPS'ten thumbnail ÜRETME. Tüm şekiller geometrik
   (daire/elips/yuvarlatılmış dikdörtgen) ve ölçüler bizde var → her kartta **inline SVG** çiziyoruz
   (doğru en-boy oranı + kesim spot rengi). Ekstra görsel dosyası yok.
4. **DB migration YOK.** Statik manifest + R2 key + auth kontrolü yeterli. (İstersek sadece PostHog event.)
5. **Tek doğruluk kaynağı:** `src/lib/templates/die-cut-templates.ts` manifest'i hem sayfa (render)
   hem API (key doğrulama) tarafından kullanılır. API yalnızca manifest'te olan id+set+format için signed URL üretir (path traversal / keyfi R2 okuma engeli).
6. CLAUDE.md sefaRules geçerli: cüzdan / puan / üyelik indirimi mantığı **ekleme**. Bu özellik bunlardan bağımsız.

---

## ÇÖZÜM — 7 GÖREV

---

### GÖREV 1/7 — Manifest + tip + key builder

#### Yeni dosya: `src/lib/templates/die-cut-templates.ts`

65 şablonu **programatik üret** (elle 65 satır yazma). Tip + builder + liste:

```typescript
/**
 * Kesim bıçağı (die-cut) şablon kütüphanesi — tek doğruluk kaynağı.
 * Hem /sablonlar Kesim sekmesi (render) hem indirme API'si (key doğrulama) kullanır.
 *
 * Geometri OKU.txt'ten; iki set (KissCut/ThruCut) geometrik olarak birebir aynı.
 * R2 key: templates/die-cut/{set}/{format}/{category}/{fileBase}.{ext}
 */

export type CutSet = "kisscut" | "thrucut";
export type TemplateFormat = "pdf" | "ai" | "eps";
export type ShapeCategory =
  | "yuvarlak"
  | "kare"
  | "dikdortgen"
  | "oval"
  | "bumper";

export interface DieCutTemplate {
  /** Kararlı id — URL/manifest anahtarı. örn: "yuvarlak-cap50", "kare-50x50-r3" */
  id: string;
  category: ShapeCategory;
  /** Kullanıcıya görünen etiket. örn: "Yuvarlak Ø50 mm" */
  label: string;
  widthMm: number;
  heightMm: number;
  /** Köşe yarıçapı mm (0 = keskin; daire/oval'de yok sayılır) */
  cornerRadiusMm: number;
  /** Önizleme şekli */
  shape: "circle" | "ellipse" | "rect";
  /** Yerel/R2 dosya kök adı (uzantısız), set & format dizinleri hariç */
  fileBase: string;
}

const CUT_SETS: Record<CutSet, { dir: string; label: string; spot: string; color: string; desc: string }> = {
  kisscut: {
    dir: "KissCut-CutContour-Magenta",
    label: "KissCut (Kontur)",
    spot: "CutContour",
    color: "#E5007E", // önizleme magenta
    desc: "Yarım kesim — sadece etiket katmanı kesilir, arka kağıt (liner) bütün kalır. Sticker/etiket soyularak çıkar.",
  },
  thrucut: {
    dir: "ThruCut-Mavi",
    label: "ThruCut (Tam kesim)",
    spot: "ThruCut",
    color: "#0047FF", // önizleme mavi
    desc: "Tam kesim — kağıt boydan boya kesilir, parça tamamen ayrılır. Kartela / askılı etiket / ayrı parça için.",
  },
};

const FORMAT_DIR: Record<TemplateFormat, string> = { pdf: "PDF", ai: "AI", eps: "EPS" };
const CATEGORY_DIR: Record<ShapeCategory, string> = {
  yuvarlak: "Yuvarlak",
  kare: "Kare",
  dikdortgen: "Dikdortgen",
  oval: "Oval",
  bumper: "Bumper",
};

// --- Üretim ---
const YUVARLAK = [25, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130];
const KARE = [25, 30, 40, 50];
const DIKDORTGEN: Array<[number, number]> = [
  [40, 25], [40, 30], [50, 30], [50, 40], [60, 40], [70, 40], [70, 50],
  [80, 50], [90, 50], [90, 60], [100, 50], [100, 70], [120, 80], [148, 105], [100, 150],
];
const OVAL: Array<[number, number]> = [
  [40, 25], [40, 30], [45, 30], [50, 30], [55, 35], [60, 40], [65, 45], [80, 50], [90, 60], [100, 70],
];
const BUMPER: Array<[number, number]> = [
  [100, 40], [150, 50], [200, 60], [250, 75], [300, 100],
];

function build(): DieCutTemplate[] {
  const out: DieCutTemplate[] = [];

  for (const d of YUVARLAK) {
    out.push({
      id: `yuvarlak-cap${d}`,
      category: "yuvarlak",
      label: `Yuvarlak Ø${d} mm`,
      widthMm: d, heightMm: d, cornerRadiusMm: d / 2, shape: "circle",
      fileBase: `Yuvarlak_Cap${d}mm`,
    });
  }
  for (const s of KARE) {
    out.push({
      id: `kare-${s}x${s}-keskin`, category: "kare",
      label: `Kare ${s}×${s} mm · keskin köşe`,
      widthMm: s, heightMm: s, cornerRadiusMm: 0, shape: "rect",
      fileBase: `Kare_${s}x${s}_keskin`,
    });
    out.push({
      id: `kare-${s}x${s}-r3`, category: "kare",
      label: `Kare ${s}×${s} mm · yuvarlak köşe (r3)`,
      widthMm: s, heightMm: s, cornerRadiusMm: 3, shape: "rect",
      fileBase: `Kare_${s}x${s}_yuvarlak-r3`,
    });
  }
  for (const [w, h] of DIKDORTGEN) {
    out.push({
      id: `dikdortgen-${w}x${h}-keskin`, category: "dikdortgen",
      label: `Dikdörtgen ${w}×${h} mm · keskin köşe`,
      widthMm: w, heightMm: h, cornerRadiusMm: 0, shape: "rect",
      fileBase: `Dikdortgen_${w}x${h}_keskin`,
    });
    out.push({
      id: `dikdortgen-${w}x${h}-r3`, category: "dikdortgen",
      label: `Dikdörtgen ${w}×${h} mm · yuvarlak köşe (r3)`,
      widthMm: w, heightMm: h, cornerRadiusMm: 3, shape: "rect",
      fileBase: `Dikdortgen_${w}x${h}_yuvarlak-r3`,
    });
  }
  for (const [w, h] of OVAL) {
    out.push({
      id: `oval-${w}x${h}`, category: "oval",
      label: `Oval ${w}×${h} mm`,
      widthMm: w, heightMm: h, cornerRadiusMm: 0, shape: "ellipse",
      fileBase: `Oval_${w}x${h}`,
    });
  }
  for (const [w, h] of BUMPER) {
    out.push({
      id: `bumper-${w}x${h}`, category: "bumper",
      label: `Bumper ${w}×${h} mm · yuvarlak köşe (r6)`,
      widthMm: w, heightMm: h, cornerRadiusMm: 6, shape: "rect",
      fileBase: `Bumper_${w}x${h}_r6`,
    });
  }
  return out;
}

export const DIE_CUT_TEMPLATES: DieCutTemplate[] = build();

export const DIE_CUT_BY_ID: Map<string, DieCutTemplate> = new Map(
  DIE_CUT_TEMPLATES.map((t) => [t.id, t])
);

export const CUT_SET_META = CUT_SETS;

export const CATEGORY_LABELS: Record<ShapeCategory, string> = {
  yuvarlak: "Yuvarlak",
  kare: "Kare",
  dikdortgen: "Dikdörtgen",
  oval: "Oval",
  bumper: "Bumper / Tampon",
};

/** R2 object key — manifest doğrulamasından SONRA çağrılır */
export function dieCutR2Key(
  t: DieCutTemplate,
  set: CutSet,
  format: TemplateFormat
): string {
  return `templates/die-cut/${set}/${format}/${t.category}/${t.fileBase}.${format}`;
}

/** İndirilen dosyanın kullanıcıya görünecek adı */
export function dieCutDownloadFilename(
  t: DieCutTemplate,
  set: CutSet,
  format: TemplateFormat
): string {
  const setTag = set === "kisscut" ? "KissCut" : "ThruCut";
  return `${t.fileBase}_${setTag}.${format}`;
}

/** Yerel kaynak yolu (sadece upload script'i için) */
export function dieCutLocalRelPath(
  t: DieCutTemplate,
  set: CutSet,
  format: TemplateFormat
): string {
  const setDir = CUT_SETS[set].dir;
  return `${setDir}/${FORMAT_DIR[format]}/${CATEGORY_DIR[t.category]}/${t.fileBase}.${format}`;
}

export const ALL_CUT_SETS: CutSet[] = ["kisscut", "thrucut"];
export const ALL_FORMATS: TemplateFormat[] = ["pdf", "ai", "eps"];
```

**Doğrulama:** `DIE_CUT_TEMPLATES.length === 65`. `DIE_CUT_BY_ID.get("yuvarlak-cap50")` dolu döner.

---

### GÖREV 2/7 — R2 toplu yükleme script'i

#### Yeni dosya: `scripts/upload-die-cut-templates.mjs`

`scripts/upload-cards.mjs` ve `src/lib/storage/r2-client.ts` config'ini referans al. Yerel klasörü
gezip 390 dosyayı R2'ye yükler. **R2 client config'i r2-client.ts ile birebir aynı olmalı**
(`forcePathStyle: true`, `requestChecksumCalculation: "WHEN_REQUIRED"`, `responseChecksumValidation: "WHEN_REQUIRED"`, EU endpoint).

```javascript
#!/usr/bin/env node
/**
 * upload-die-cut-templates.mjs — Kesim bıçağı şablonlarını R2'ye yükle (390 dosya).
 *
 * Usage:
 *   node scripts/upload-die-cut-templates.mjs "C:\\Users\\msı\\Desktop\\Pim-Etiket-Bicak-Sablonlari"
 *   node scripts/upload-die-cut-templates.mjs <kaynak> --dry
 *
 * ENV (.env.local): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// .env.local yükle (process.loadEnvFile Node 20.6+; yoksa dotenv kullan)
try { process.loadEnvFile?.(resolve(process.cwd(), ".env.local")); } catch {}

const SRC = process.argv[2];
const DRY = process.argv.includes("--dry");
if (!SRC) { console.error("Kaynak klasör ver."); process.exit(1); }

const SETS = { kisscut: "KissCut-CutContour-Magenta", thrucut: "ThruCut-Mavi" };
const FORMATS = { pdf: "PDF", ai: "AI", eps: "EPS" };
const CATEGORIES = ["Yuvarlak", "Kare", "Dikdortgen", "Oval", "Bumper"];
const CT = { pdf: "application/pdf", ai: "application/illustrator", eps: "application/postscript" };

// die-cut-templates.ts'teki üretimle AYNI listeyi burada da kur (mjs import edemiyoruz,
// ts-node yoksa). En basiti: fileBase listesini doğrudan klasörden okumak yerine
// manifest üretimini tekrar et — VEYA kategorileri glob ile gez. Glob ile gezelim:
import { readdirSync } from "fs";
import { join } from "path";

const R2_BUCKET = process.env.R2_BUCKET ?? "pim-etiket-archive";
const client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
  forcePathStyle: true,
});

let ok = 0, fail = 0, skip = 0;
for (const [set, setDir] of Object.entries(SETS)) {
  for (const [fmt, fmtDir] of Object.entries(FORMATS)) {
    for (const cat of CATEGORIES) {
      const dir = join(SRC, setDir, fmtDir, cat);
      if (!existsSync(dir)) { console.warn("YOK:", dir); continue; }
      for (const file of readdirSync(dir)) {
        if (!file.toLowerCase().endsWith("." + fmt)) continue;
        const key = `templates/die-cut/${set}/${fmt}/${cat.toLowerCase()}/${file}`;
        if (DRY) { console.log("[dry]", key); skip++; continue; }
        try {
          await client.send(new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: key,
            Body: readFileSync(join(dir, file)),
            ContentType: CT[fmt],
            CacheControl: "public, max-age=31536000, immutable",
          }));
          ok++;
          if (ok % 50 === 0) console.log(`  ...${ok} yüklendi`);
        } catch (e) {
          fail++;
          console.error("FAIL:", key, e.message);
        }
      }
    }
  }
}
console.log(`\nBitti. ok=${ok} fail=${fail} skip(dry)=${skip}`);
```

> NOT: Kategori klasör adı küçük harfe çevriliyor (`Dikdortgen` → `dikdortgen`) — manifest'teki
> `category` ile eşleşmeli. `dieCutR2Key` ile aynı key formatını üretir.

**Doğrulama:** Önce `--dry` ile çalıştır → 390 satır key listesi. Sonra gerçek yükle → `ok=390 fail=0`.
Cloudflare R2 panelinde `templates/die-cut/kisscut/pdf/yuvarlak/Yuvarlak_Cap50mm.pdf` görünmeli.

---

### GÖREV 3/7 — `getSignedDownloadUrl`'e content-disposition desteği

#### Dosya: `src/lib/storage/r2-client.ts`

Mevcut `getSignedDownloadUrl(key, expiresInSeconds=3600)` fonksiyonunu, tarayıcının dosyayı
**indirmesi** (açması değil) ve doğru dosya adını kullanması için opsiyonel parametreyle genişlet:

```typescript
export async function getSignedDownloadUrl(
  key: string,
  expiresInSeconds = 3600,
  opts?: { downloadFilename?: string; contentType?: string }
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ...(opts?.downloadFilename
      ? {
          ResponseContentDisposition: `attachment; filename="${opts.downloadFilename.replace(/"/g, "")}"`,
        }
      : {}),
    ...(opts?.contentType ? { ResponseContentType: opts.contentType } : {}),
  });
  return await getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}
```

Mevcut çağrılar (`restore-service.ts` vb.) `opts` vermediği için davranış değişmez.

**Doğrulama:** TypeScript derlenir; mevcut restore akışı etkilenmez.

---

### GÖREV 4/7 — İndirme API'si (üye kapısı)

#### Yeni dosya: `src/app/api/sablonlar/kesim/download/route.ts`

```typescript
/**
 * GET /api/sablonlar/kesim/download?id=...&set=kisscut|thrucut&format=pdf|ai|eps
 *
 * Kesim bıçağı şablonu indirme — ÜYE KAPISI.
 *   - Oturum yoksa 401 { error, requiresAuth: true }.
 *   - Üye ise R2 signed URL (5 dk) döner: { url, filename, expiresAt }.
 *   - Sadece manifest'te olan id/set/format için (keyfi R2 okuma engeli).
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSignedDownloadUrl } from "@/lib/storage/r2-client";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import {
  DIE_CUT_BY_ID,
  dieCutR2Key,
  dieCutDownloadFilename,
} from "@/lib/templates/die-cut-templates";

export const runtime = "nodejs";

const Query = z.object({
  id: z.string().min(1).max(80),
  set: z.enum(["kisscut", "thrucut"]),
  format: z.enum(["pdf", "ai", "eps"]),
});

const CT = { pdf: "application/pdf", ai: "application/illustrator", eps: "application/postscript" } as const;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = Query.safeParse({
    id: url.searchParams.get("id"),
    set: url.searchParams.get("set"),
    format: url.searchParams.get("format"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }
  const { id, set, format } = parsed.data;

  const tpl = DIE_CUT_BY_ID.get(id);
  if (!tpl) {
    return NextResponse.json({ error: "Şablon bulunamadı" }, { status: 404 });
  }

  // Üye kapısı
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Dosyayı indirmek için üye girişi gerekli.", requiresAuth: true },
      { status: 401 }
    );
  }

  // Rate limit — üye başına dakikada 30 indirme
  const ip = getClientIp(req);
  const limit = await rateLimit({ key: `tpl-dl:${user.id}:${ip}`, limit: 30, windowMs: 60_000 });
  if (!limit.success) {
    return NextResponse.json({ error: "Çok fazla istek, biraz bekle." }, { status: 429 });
  }

  const key = dieCutR2Key(tpl, set, format);
  const filename = dieCutDownloadFilename(tpl, set, format);
  const signed = await getSignedDownloadUrl(key, 300, {
    downloadFilename: filename,
    contentType: CT[format],
  });

  return NextResponse.json({
    url: signed,
    filename,
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
  });
}
```

> `rateLimit` imzası: `rateLimit({ key, limit, windowMs })` → `{ success, ... }` (`src/lib/rate-limit.ts`).

**Doğrulama:**
- Çıkış yapmışken `GET /api/sablonlar/kesim/download?id=yuvarlak-cap50&set=kisscut&format=pdf` → 401 `requiresAuth:true`.
- Üye iken aynı istek → 200 + `url` (R2 signed). URL'yi açınca `Yuvarlak_Cap50mm_KissCut.pdf` iner.
- Geçersiz id → 404.

---

### GÖREV 5/7 — SVG önizleme bileşeni

#### Yeni dosya: `src/components/templates/ShapePreview.tsx`

Şekli doğru en-boy oranında, kesim spot renginde çizer. Sabit kutuya (ör. yükseklik) sığdırır.

```typescript
"use client";

import type { DieCutTemplate, CutSet } from "@/lib/templates/die-cut-templates";
import { CUT_SET_META } from "@/lib/templates/die-cut-templates";

export function ShapePreview({
  tpl,
  set,
  box = 120,
}: {
  tpl: DieCutTemplate;
  set: CutSet;
  box?: number; // px — şeklin sığacağı kare alan
}) {
  const color = CUT_SET_META[set].color;
  const pad = 10;
  const maxDim = Math.max(tpl.widthMm, tpl.heightMm);
  const scale = (box - pad * 2) / maxDim;
  const w = tpl.widthMm * scale;
  const h = tpl.heightMm * scale;
  const cx = box / 2;
  const cy = box / 2;
  const strokeW = 1.5;

  return (
    <svg
      width={box}
      height={box}
      viewBox={`0 0 ${box} ${box}`}
      role="img"
      aria-label={tpl.label}
      className="shrink-0"
    >
      {tpl.shape === "circle" && (
        <circle cx={cx} cy={cy} r={w / 2} fill="none" stroke={color} strokeWidth={strokeW} />
      )}
      {tpl.shape === "ellipse" && (
        <ellipse cx={cx} cy={cy} rx={w / 2} ry={h / 2} fill="none" stroke={color} strokeWidth={strokeW} />
      )}
      {tpl.shape === "rect" && (
        <rect
          x={cx - w / 2}
          y={cy - h / 2}
          width={w}
          height={h}
          rx={tpl.cornerRadiusMm * scale}
          ry={tpl.cornerRadiusMm * scale}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
        />
      )}
    </svg>
  );
}
```

**Doğrulama:** `Yuvarlak Ø50` daire, `Dikdörtgen 100×50` yatay dikdörtgen, `Oval 60×40` elips,
`Bumper 200×60` çok yatık yuvarlak köşeli dikdörtgen olarak görünür. Renk: kisscut=magenta, thrucut=mavi.

---

### GÖREV 6/7 — `/sablonlar`'ı iki sekmeli hub yap + Kesim sekmesi

Mevcut `src/app/sablonlar/page.tsx` bir **lead magnet** (e-posta karşılığı tasarım şablonu).
Onu silme — sekmeye taşı.

#### 6a. Mevcut içeriği bileşene taşı
- `src/app/sablonlar/page.tsx`'teki tüm lead-magnet JSX/mantığını yeni dosyaya kopyala:
  **`src/components/templates/TasarimSablonlari.tsx`** (default export bir bileşen, `"use client"`).
  İçindeki `<main className="py-10 pb-24">` sarmalını kaldır (hub sarmalayacak), iç içeriği döndür.

#### 6b. Kesim sekmesi bileşeni
- **Yeni dosya: `src/components/templates/KesimSablonlari.tsx`** (`"use client"`).
  Özellikler:
  - **Hero / açıklama (sade dil):**
    > "Kesim bıçağı = etiketinin tam kesileceği çizgi. Tasarımını bu şablona göre hazırla;
    > baskıda makine tam bu hattan keser. Hepsi **1:1 ölçekli** — açtığında gerçek boyutta gelir."
  - **KissCut vs ThruCut açıklama kartları** — `CUT_SET_META[*].desc` metinleriyle. Altında
    katlanır (`<details>`) "Tasarımcıysan teknik detay": spot renk adları (CutContour=magenta,
    ThruCut=mavi), 0.3pt dolgusuz çizgi, 3mm bleed (OKU.txt'ten özetle).
  - **Filtre çubuğu:**
    - Set seçimi (segment kontrol): KissCut / ThruCut → seçilen `set` tüm kartların önizleme rengini + indirme setini belirler.
    - Kategori sekmeleri: Hepsi / Yuvarlak / Kare / Dikdörtgen / Oval / Bumper (`CATEGORY_LABELS`).
    - Arama input'u: `label`/ölçü içinde filtre (örn "50", "100x70").
  - **Kart grid'i** (`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3`):
    - `<ShapePreview tpl set box={120} />`
    - `tpl.label` + ölçü rozet(ler)i (`Ø{d}` veya `{w}×{h} mm`, köşe notu).
    - 3 indirme butonu: **PDF · AI · EPS** (`<DownloadButton tpl set format />`).
  - Mevcut UI bileşenlerini kullan: `Card`, `Button`, `Pill`, `Eyebrow`, `Input` (`@/components/ui`), `Icon` (`@/components/Icon`).

  **İndirme butonu davranışı** (aynı dosyada küçük bir alt-bileşen):
  ```typescript
  // useUser() ile oturum bilinir. Tıklayınca:
  //  - üye değil → toast/uyarı + /auth?next=/sablonlar linki (indirme YAPMA)
  //  - üye → fetch(`/api/sablonlar/kesim/download?id=${tpl.id}&set=${set}&format=${format}`)
  //          200 ise data.url'i yeni sekmede aç / window.location ile indir.
  //          401 ise üye-ol uyarısı (token süresi dolmuş olabilir).
  ```
  `useToast` (`@/components/ui`) ile geri bildirim ver. İndirme başlarken butonu `disabled`/spinner yap.

  > Üye değilken indirme butonları **görünür ama tıklayınca üye-ol'a yönlendirir** — Sefa'nın isteği:
  > "kullanıcılar görebilsin ama dosyaları sadece üyeler indirebilsin". (Sunucu zaten 401 ile gerçek kapı.)

#### 6c. Hub sayfası
- **`src/app/sablonlar/page.tsx`'i yeniden yaz:** `"use client"`, sekme state'i `useSearchParams`'tan
  okunur (`?tab=kesim` varsayılan, `?tab=tasarim`). Üstte sekme çubuğu:
  - **Kesim Şablonları** (varsayılan, `<KesimSablonlari/>`)
  - **Tasarım Şablonları** (`<TasarimSablonlari/>`)
  `<main className="py-10 pb-24"><div className="mx-auto max-w-[1100px] px-4 md:px-8">…</div></main>` sarmalı.
  Sekme değişince `router.replace` ile URL query güncellensin (paylaşılabilir link).
  `useSearchParams` Suspense gerektirir → sayfayı `<Suspense>` ile sarmalayan ince bir wrapper kullan
  (veya hub'ı bir alt bileşene alıp page'de `<Suspense fallback={...}><Hub/></Suspense>`).

#### 6d. Layout / SEO
- `src/app/sablonlar/layout.tsx` metadata'sını güncelle: başlık/desc artık iki tür şablonu da kapsasın
  (örn. "Etiket Şablonları — Kesim Bıçağı (Die-Cut) + Tasarım Şablonları"). `canonical: /sablonlar` kalır.

**Doğrulama:**
- `/sablonlar` → varsayılan **Kesim Şablonları** sekmesi, 65 kart, filtreler çalışır.
- `/sablonlar?tab=tasarim` → eski lead magnet aynen çalışır (form + e-posta).
- Anonim kullanıcı kartları görür; PDF'e basınca üye-ol uyarısı. Giriş yapınca dosya iner.

---

### GÖREV 7/7 — Nav "Şablonlar" girişi + i18n + footer

#### 7a. i18n nav anahtarı
- `src/lib/i18n/translations/tr.ts` → `nav` objesine: `templates: "Şablonlar",`
- `src/lib/i18n/translations/en.ts` → `nav` objesine: `templates: "Templates",`
- `src/lib/i18n/types.ts` → `nav` tipine `templates: string;` ekle (TranslationDict tip uyumu).

#### 7b. Header nav
- `src/components/layout/TopBar.tsx` → `navItems` dizisine ekle (Blog'dan önce veya sonra, Sticker'dan sonra mantıklı):
  ```typescript
  { href: "/sticker", label: t.nav.sticker },
  { href: "/sablonlar", label: t.nav.templates },   // ← yeni
  { href: "/blog", label: t.nav.blog },
  ```
  Aktif state için: `/sablonlar` ve alt query'lerde highlight olması yeterli (`pathname === item.href` mevcut mantık yeter; istersen `pathname?.startsWith("/sablonlar")`).

#### 7c. Footer linki
- `src/components/layout/Footer.tsx:37` — "Ücretsiz şablonlar" → href `/sablonlar?tab=tasarim`
  (lead magnet'e direkt gitsin). İstersen ikinci bir link "Kesim şablonları" → `/sablonlar?tab=kesim` ekle.

**Doğrulama:** Header'da (masaüstü + mobil drawer) "Şablonlar" görünür, tıklayınca `/sablonlar` açılır,
aktifken vurgulanır.

---

## GENEL DOĞRULAMA (bitince)
1. `node scripts/upload-die-cut-templates.mjs "<kaynak>" --dry` → 390 key; sonra gerçek yükleme `ok=390`.
2. `npm run lint` ve `tsc` temiz (yeni dosyalar tip hatası vermez).
3. `/sablonlar` → Kesim sekmesi 65 kart; set/kategori/arama filtreleri çalışır; SVG önizlemeler doğru oran/renk.
4. Anonim: indirme → üye-ol uyarısı. Üye: PDF/AI/EPS iner, dosya adı `<base>_KissCut.<ext>` / `_ThruCut.<ext>`.
5. `/sablonlar?tab=tasarim` lead magnet bozulmadan çalışır.
6. Header + mobil menüde "Şablonlar" linki.

## DEĞİŞECEK / EKLENECEK DOSYALAR
**Yeni:**
- `src/lib/templates/die-cut-templates.ts`
- `scripts/upload-die-cut-templates.mjs`
- `src/app/api/sablonlar/kesim/download/route.ts`
- `src/components/templates/ShapePreview.tsx`
- `src/components/templates/KesimSablonlari.tsx`
- `src/components/templates/TasarimSablonlari.tsx`

**Düzenlenecek:**
- `src/lib/storage/r2-client.ts` (content-disposition opsiyonu)
- `src/app/sablonlar/page.tsx` (hub'a çevir)
- `src/app/sablonlar/layout.tsx` (metadata)
- `src/lib/i18n/translations/tr.ts`, `en.ts`, `src/lib/i18n/types.ts` (nav.templates)
- `src/components/layout/TopBar.tsx` (navItems)
- `src/components/layout/Footer.tsx` (link)
</content>
</invoke>
