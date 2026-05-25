# Cursor Fiyat Yönetimi İyileştirmeleri — `/admin/fiyatlar`

> Claude Code (mimari) tarafından hazırlanmıştır.
> Mevcut sayfa: `src/app/admin/fiyatlar/page.tsx`
> 8 görev, sırayla uygulanacak.

---

## GÖREV 1/8 — İnteraktif Simülasyon Paneli (P1)

### Sorun
Mevcut preview sadece 1 sabit örnek gösteriyor (ör: 50×50mm 250 adet). Sefa farklı kombinasyonları göremeden fiyat ayarlıyor.

### Dosya: `src/app/admin/fiyatlar/page.tsx`

Mevcut `SCOPE_PREVIEW_DEFAULTS` sabit değerleri kullanılıyor. Bunun yerine interaktif form yap.

### Değişiklik

Mevcut sağ panel preview bölümünü şu yapıyla değiştir:

```typescript
// Mevcut sabit preview state'leri:
// const [previewMaterialId, setPreviewMaterialId] = useState<string>("");
// const [previewOptions, setPreviewOptions] = useState<Record<string, string | string[]>>({});

// YENİ — interaktif kontroller ekle:
const defaults = SCOPE_PREVIEW_DEFAULTS[scope];
const [previewWidth, setPreviewWidth] = useState(defaults.width);
const [previewHeight, setPreviewHeight] = useState(defaults.height);
const [previewQty, setPreviewQty] = useState(defaults.qty);
```

Preview paneli UI:

```
┌─ Canlı Simülasyon ──────────────────────────────┐
│                                                   │
│ Boyut:  [__50__] × [__50__] mm                   │
│                                                   │
│ Adet:   [25] [50] [100] [250] [500] [1000]      │
│         veya özel: [____]                         │
│                                                   │
│ Malzeme: [Vinil ▼]  (mevcut dropdown koru)       │
│ Kaplama: [Mat ▼]    (mevcut dropdown koru)       │
│                                                   │
│ ─────────────────────────────────────────────────│
│                                                   │
│ 🏷 Birim fiyat:        2,51 ₺                    │
│ 📦 Ara toplam:          627 ₺                    │
│ 💰 KDV (%20):          125 ₺                    │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ 🧾 MÜŞTERİ TOPLAM:     752 ₺                    │
│                                                   │
│ ─── Maliyet Kırılımı (sadece admin görür) ──── │
│                                                   │
│ 🏭 Partner maliyeti:    439 ₺                    │
│ 💵 Senin kârın:         188 ₺                    │
│ 📊 Kâr marjı:           %25                      │
│ 💳 PSP komisyon:         15 ₺                    │
│                                                   │
│ ─── Uyarılar ──────────────────────────────────│
│ ⚠️ Kâr marjı %15 altında (eşik: %20)            │  ← koşullu
│ ⚠️ Birim fiyat rakipten %30 yüksek              │  ← koşullu (ref varsa)
└──────────────────────────────────────────────────┘
```

### Kâr kırılımı hesabı

```typescript
// previewResult zaten mevcut — calculatePrice veya quoteRuloFromPricebook döndürüyor
// Ekle: maliyet kırılımı

const costBreakdown = useMemo(() => {
  if (!previewResult || !previewResult.ok) return null;

  const total = previewResult.total;           // KDV dahil müşteri fiyatı
  const vatAmount = total - (total / (1 + draft.vat.pct / 100));
  const subtotal = total - vatAmount;
  const feeAmount = subtotal * (draft.operation.fee_pct / 100);
  const marginAmount = (subtotal - feeAmount) * (draft.margin.pct / (100 + draft.margin.pct));
  const partnerCost = subtotal - feeAmount - marginAmount;
  const profitPct = subtotal > 0 ? (marginAmount / subtotal) * 100 : 0;

  return {
    subtotal, vatAmount, total,
    feeAmount, marginAmount, partnerCost, profitPct,
  };
}, [previewResult, draft]);
```

### Kâr uyarısı

```typescript
// Kâr marjı %15 altındaysa sarı uyarı
{costBreakdown && costBreakdown.profitPct < 15 && (
  <div className="mt-2 text-[12px] text-sari-koyu bg-sari-soft/30 rounded px-3 py-2">
    ⚠️ Kâr marjı %{costBreakdown.profitPct.toFixed(1)} — eşik %15 altında
  </div>
)}
```

### Doğrulama
- Boyut/adet/malzeme değiştir → fiyat anında güncelleniyor
- Kâr kırılımı doğru hesaplanıyor
- Düşük kâr uyarısı çalışıyor
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 2/8 — Toplu Fiyat Karşılaştırma Matrisi (P1)

### Sorun
Sefa bir malzemeyi değiştirdiğinde tüm boyut × adet kombinasyonlarındaki etkiyi göremez.

### Dosya: `src/components/admin/pricing/PriceMatrix.tsx` (yeni)

```typescript
interface PriceMatrixProps {
  config: ProfileConfig;
  scope: 'sticker' | 'etiket_rulo' | 'etiket_tabaka';
  materialId: string;
  selectedOptions: Record<string, string | string[]>;
}

// Boyut × adet matrisi — tüm kombinasyonlar
const SIZE_PRESETS = [
  { w: 30, h: 30, label: '30×30' },
  { w: 50, h: 50, label: '50×50' },
  { w: 75, h: 75, label: '75×75' },
  { w: 100, h: 100, label: '100×100' },
  { w: 150, h: 150, label: '150×150' },
];

// Scope'a göre adet kademeleri
const QTY_PRESETS: Record<string, number[]> = {
  sticker: [25, 50, 100, 250, 500, 1000],
  etiket_rulo: [1000, 3000, 5000, 10000],
  etiket_tabaka: [250, 500, 1000, 2500, 5000],
};
```

Her hücrede KDV dahil müşteri fiyatı gösterilir. Hoverde detay tooltip:
```
50×50 / 250 adet
Birim: 2,51 ₺
Toplam: 752 ₺ (KDV dahil)
Kâr: 188 ₺ (%25)
```

### Entegrasyon

`/admin/fiyatlar` sayfasında simülasyon panelinin altına "📊 Fiyat Tablosu" butonu ekle. Tıklanınca `PriceMatrix` component'i açılır (collapse/expand).

```typescript
const [showMatrix, setShowMatrix] = useState(false);

// Simülasyon panelinin altına:
<Button variant="ghost" size="sm" onClick={() => setShowMatrix(s => !s)}>
  {showMatrix ? 'Tabloyu gizle' : '📊 Fiyat tablosu'}
</Button>

{showMatrix && (
  <PriceMatrix
    config={draft}
    scope={scope}
    materialId={previewMaterialId}
    selectedOptions={previewOptions}
  />
)}
```

### Tablo stili

```
┌───────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│ Vinil+Mat │  25 ad  │  50 ad  │ 100 ad  │ 250 ad  │ 500 ad  │ 1000 ad │
├───────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ 30×30 mm  │  12,50₺ │  22,00₺ │  38,00₺ │   85₺   │  155₺   │  280₺   │
│ 50×50 mm  │  18,50₺ │  32,00₺ │  58,00₺ │  127₺   │  235₺   │  420₺   │
│ 75×75 mm  │  28,00₺ │  48,00₺ │  87,00₺ │  190₺   │  352₺   │  630₺   │
│ 100×100mm │  42,00₺ │  72,00₺ │   130₺  │  285₺   │  528₺   │  945₺   │
│ 150×150mm │  78,00₺ │ 135,00₺ │   245₺  │  535₺   │  990₺   │ 1.770₺  │
└───────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘

Renk kodlama:
- Yeşil: kâr > %25
- Sarı: kâr %15-25
- Kırmızı: kâr < %15
```

### Doğrulama
- "Fiyat tablosu" butonu → matris açılıyor
- Tüm hücreler hesaplanıyor (loading yok, client-side calc)
- Hover → detay tooltip
- Renk kodlama çalışıyor
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 3/8 — Rakip Referans Fiyat Alanı (P1)

### Sorun
Sefa fiyatı belirlerken rakip referansı yok.

### Değişiklik 1: Type güncelle

`src/lib/pricing-config-types.ts` → `MaterialItem` interface'ine ekle:

```typescript
export interface MaterialItem {
  id: string;
  name: string;
  m2_cost_try?: number;
  sheet_cost_try?: number;
  desc?: string;
  competitor_ref?: string;    // 🆕 Rakip referans notu (ör: "stickeryolla ~15₺/m²")
}
```

### Değişiklik 2: Admin UI

`/admin/fiyatlar/page.tsx` malzeme satırlarında, maliyet input'unun yanına küçük referans alanı ekle:

```
Vinil  m²: [12,50₺]  Ref: [stickeryolla ~15₺/m²]  📊
                                                      ↑ opsiyonel, hesaba girmez
```

```typescript
// Malzeme satırında mevcut m2_cost input'unun yanına:
<input
  type="text"
  placeholder="Rakip ref (opsiyonel)"
  value={mat.competitor_ref ?? ''}
  onChange={(e) => updateMaterial(idx, { competitor_ref: e.target.value })}
  className="w-48 text-[12px] text-gri-500 border-0 border-b border-dashed border-gri-300 bg-transparent px-1 py-0.5 focus:border-pim-mercan focus:outline-none"
/>
```

### Simülasyon panelinde göster

Eğer seçili malzemenin `competitor_ref` varsa, simülasyon panelinde küçük bilgi:

```typescript
{selectedMaterial?.competitor_ref && (
  <div className="text-[11px] text-gri-500 mt-1">
    📊 Rakip ref: {selectedMaterial.competitor_ref}
  </div>
)}
```

### Doğrulama
- Malzemeye rakip ref yaz → kaydet → yeniden yükle → korunmuş
- Simülasyon panelinde ref görünüyor
- Hesaplamaya etkisi yok (sadece bilgi)
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 4/8 — Malzeme Aktif/Pasif Toggle (P2)

### Sorun
Malzemeyi geçici kapatma yok — silmek zorunda.

### Değişiklik 1: Type güncelle

`src/lib/pricing-config-types.ts` → `MaterialItem` interface'ine:

```typescript
export interface MaterialItem {
  // ... mevcut alanlar ...
  active?: boolean;           // 🆕 undefined = true (geriye uyum)
}
```

### Değişiklik 2: Admin UI

Her malzeme satırının başına toggle ekle:

```typescript
<button
  type="button"
  onClick={() => updateMaterial(idx, { active: !(mat.active ?? true) })}
  className={cn(
    "w-8 h-5 rounded-full transition-colors flex items-center px-0.5",
    (mat.active ?? true) ? "bg-yesil" : "bg-gri-300"
  )}
>
  <span className={cn(
    "w-4 h-4 bg-white rounded-full transition-transform",
    (mat.active ?? true) ? "translate-x-3" : "translate-x-0"
  )} />
</button>
```

Pasif malzeme satırını `opacity-40` yap.

### Değişiklik 3: Müşteri tarafı filtrele

`src/lib/customer-pricing-from-config.ts` veya konfigüratör sayfalarında, `config.materials` kullanırken:

```typescript
const activeMaterials = config.materials.filter(m => m.active !== false);
```

Bu değişiklik konfigüratör sayfalarında da yapılmalı (`/etiket/yapilandir`, `/sticker/yapilandir`).

### Doğrulama
- Toggle kapat → malzeme soluk görünüyor
- Kaydet → müşteri tarafında bu malzeme görünmüyor
- Toggle aç → geri geliyor
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 5/8 — Kaplama ₺ Karşılığı Göster (P2)

### Sorun
"+15%" yazıyor ama ₺ etkisi belirsiz.

### Değişiklik

Her option satırında mevcut `pct_add` input'unun yanına hesaplanmış ₺ etkisi göster.

```typescript
// Mevcut option satırında, pct input'unun sağına:
const impactTry = useMemo(() => {
  if (!previewResult?.ok) return null;
  // Simülasyon'daki birim fiyata bu option'ın etkisi
  const basePricePerUnit = previewResult.unitPrice;
  return basePricePerUnit * (item.pct_add / 100);
}, [previewResult, item.pct_add]);

// UI:
<span className="text-[11px] text-gri-500 ml-2">
  {impactTry !== null
    ? `≈ +${impactTry.toFixed(2).replace('.', ',')}₺/birim @ ${previewQty} ad`
    : ''}
</span>
```

Sonuç:
```
Mat kaplama    +[15]%   ≈ +1,88₺/birim @ 250 ad
Parlak kaplama +[15]%   ≈ +1,88₺/birim @ 250 ad
Soft touch     +[30]%   ≈ +3,76₺/birim @ 250 ad
```

### Doğrulama
- Her option satırında ₺ etkisi görünüyor
- Simülasyondaki boyut/adet değişince ₺ de güncelleniyor
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 6/8 — Sticky Kaydet Bar (P2)

### Sorun
Uzun formda kaydet butonu sayfanın altında kaybolur.

### Değişiklik

`/admin/fiyatlar/page.tsx` — `isDirty` true olduğunda sayfanın altında sticky bar göster.

Mevcut kaydet butonunu koru (yukarıda), ek olarak sticky bar ekle:

```typescript
// return'ün en sonuna (</main> öncesine):
{isDirty && activeTab === "config" && (
  <div className="fixed bottom-0 left-0 right-0 z-40 lg:left-[248px] bg-white border-t border-gri-200 shadow-lg px-6 py-3">
    <div className="mx-auto max-w-[1400px] flex items-center justify-between">
      <div className="flex items-center gap-2 text-[13px]">
        <span className="text-sari-koyu font-medium">
          ✏ {draftFormDiff.length} değişiklik kaydedilmemiş
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm("Değişiklikleri iptal et?")) void refresh();
          }}
        >
          İptal
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Kaydediliyor..." : "Canlıya kaydet"}
        </Button>
      </div>
    </div>
  </div>
)}
```

`lg:left-[248px]` → admin sidebar genişliği kadar kaydır (desktop'ta sidebar var).

### Doğrulama
- Bir malzeme değiştir → sticky bar altta görünüyor
- Kaydet → bar kaybolur
- İptal → form eski haline dönüyor
- Mobile'da da çalışıyor (sidebar kapalı)
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 7/8 — PriceBook CSV Import/Export (P2)

### Sorun
20 hücreye tek tek tıklamak zahmetli. Partner fiyat tablosu CSV ile geliyor.

### Dosya: `src/components/admin/pricing/PriceBookPanel.tsx` güncelle

İki buton ekle: "CSV İndir" + "CSV Yükle"

### CSV Export

```typescript
function exportCsv(snapshot: PricebookSnapshot, materialKey: string) {
  const matrix = snapshot.matrices[materialKey];
  if (!matrix) return;

  const sizeAxes = snapshot.size_axes;
  const qtyAxes = snapshot.qty_axes;

  let csv = 'boyut_mm,' + qtyAxes.join(',') + '\n';

  for (const size of sizeAxes) {
    const sizeLabel = `${size.width}x${size.height}`;
    const row = qtyAxes.map(qty => {
      const cell = matrix.cells.find(
        c => c.width === size.width && c.height === size.height && c.qty === qty
      );
      return cell?.price_per_unit?.toFixed(4) ?? '';
    });
    csv += sizeLabel + ',' + row.join(',') + '\n';
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pricebook-${materialKey}-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

### CSV Import

```typescript
function importCsv(file: File, materialKey: string): Promise<CellUpdate[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.trim().split('\n');
      const header = lines[0].split(',');
      // header[0] = "boyut_mm", header[1..] = qty values
      const qtyAxes = header.slice(1).map(Number);

      const updates: CellUpdate[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const [w, h] = cols[0].split('x').map(Number);
        for (let j = 0; j < qtyAxes.length; j++) {
          const price = parseFloat(cols[j + 1]);
          if (!isNaN(price) && price > 0) {
            updates.push({ width: w, height: h, qty: qtyAxes[j], price_per_unit: price });
          }
        }
      }
      resolve(updates);
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
```

### UI

PriceBook panelinde malzeme seçicinin yanına:

```
[kuse ▼] [kraft] [beyaz] [ultra] [metalik]    [📥 CSV İndir] [📤 CSV Yükle]
```

CSV Yükle tıklanınca `<input type="file" accept=".csv">` açılır → parse → hücreleri güncelle → "X hücre güncellendi" toast.

### Şablon referans

Mevcut `docs/samples/partner-pricebook-kuse.csv` dosyası örnek format. Import bu formatı kabul etmeli.

### Doğrulama
- CSV İndir → dosya iniyor, doğru format
- CSV Yükle → hücreler güncelleniyor
- Geçersiz CSV → hata mesajı (toast)
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 8/8 — Fiyat Değişiklik Bildirimi (P3)

### Sorun
Fiyat değişince aktif sepetlerdeki eski fiyat snapshot'ı kesilebilir.

### Değişiklik 1: Kaydet sonrası bildirim

`handleSave` fonksiyonunda, başarılı kayıt sonrası:

```typescript
if (j.ok) {
  toast.success("✓ Canlıya kaydedildi");

  // Aktif sepet uyarısı
  const cartRes = await fetch("/api/admin/cart-stats");
  const cartData = await cartRes.json();
  if (cartData.activeCarts > 0) {
    toast.info(
      `ℹ️ ${cartData.activeCarts} aktif sepet var — müşteriler eski fiyatla devam edebilir.`,
      { duration: 8000 }
    );
  }

  await refresh();
}
```

### Değişiklik 2: Basit cart-stats API

`src/app/api/admin/cart-stats/route.ts` (yeni):

```typescript
// GET — aktif sepet sayısı (son 24 saat güncellenmiş)
// assertPermission("orders", "view")
// Supabase: SELECT COUNT(*) FROM cart_items WHERE updated_at > now() - interval '24 hours'
// Response: { activeCarts: number }
```

### Değişiklik 3: Audit log kaydı

`/api/admin/pricing` PUT handler'da kayıt sonrası:

```typescript
// Mevcut history kaydının yanı sıra audit_log'a da yaz:
await admin.from("audit_log").insert({
  actor_id: auth.user.id,
  actor_role: auth.role,
  action: "pricing_config_updated",
  resource_type: "pricing_config",
  resource_id: scope,
  metadata: {
    changes_count: draftFormDiff.length,
    scope,
  },
});
```

### Doğrulama
- Fiyat değiştir + kaydet → aktif sepet sayısı bildirim
- audit_log tablosunda `pricing_config_updated` kaydı
- `npx tsc --noEmit` → 0 hata

---

## Uygulama Sırası

| # | Görev | Süre |
|---|---|---|
| 1 | İnteraktif simülasyon paneli | 2 saat |
| 2 | Toplu fiyat matrisi | 1.5 saat |
| 3 | Rakip referans alanı | 30 dk |
| 4 | Malzeme aktif/pasif toggle | 30 dk |
| 5 | Kaplama ₺ karşılığı | 45 dk |
| 6 | Sticky kaydet bar | 20 dk |
| 7 | PriceBook CSV import/export | 1 saat |
| 8 | Fiyat değişiklik bildirimi | 1 saat |

Her görev sonrası: `npx tsc --noEmit` + commit.

---

*Hazırlayan: Claude Code (mimari) · 25 May 2026*
