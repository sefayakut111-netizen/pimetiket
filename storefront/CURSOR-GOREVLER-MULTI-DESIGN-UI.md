# Cursor — Multi-Design Tasarım Gösterimi (Sepet + Ödeme + Sipariş Detay)

> Claude Code (mimari) tarafından hazırlanmıştır · 26 May 2026
> Kullanıcı 2 tasarımlı sipariş verdi ama her yerde sadece 1 tasarım görünüyor.
> 3 sayfa + 1 bileşen düzeltilmeli.

---

## SORUN

`CustomerCartItem` interface'inde:
- `designPreviewUrl` → birinci tasarımın preview'i
- `additionalDesigns[]` → diğer tasarımların listesi (tempId, previewUrl, fileName, sizeBytes, mimeType)
- `designCount` → toplam tasarım sayısı

AMA sepet, ödeme özeti ve sipariş detayda sadece `designPreviewUrl` gösteriliyor. `additionalDesigns` tamamen göz ardı ediliyor.

## BEKLENEN DAVRANŞ

2 tasarımlı sipariş kartı şöyle görünmeli:

```
┌─────────────────────────────────────────────┐
│  [🖼️1] [🖼️2]  Sticker · Opak Folyo + Yok  │
│                 Kare · 60×60mm · Die-cut     │
│                 2 tasarım × 100 = 200 adet   │
│                 3.372 ₺                      │
└─────────────────────────────────────────────┘
```

Tasarım thumbnail'ları yan yana, küçük (40×40 veya 48×48), grup olarak gösterilmeli.

---

## GÖREV 1/4 — Sepet Sayfası: Tüm Tasarım Thumbnail'larını Göster

### Dosya
`src/app/sepet/page.tsx`

### Kontrol et
1. Sepet kartında `designPreviewUrl` nasıl gösteriliyor? (muhtemelen `DesignThumb` bileşeni)
2. `additionalDesigns` hiç kullanılıyor mu?

### Fix
Mevcut tek thumbnail yerine tüm tasarımların mini grid'ini göster:

```typescript
// Tasarım thumbnail grid bileşeni (inline veya ayrı):
function DesignThumbnailGroup({ item }: { item: CustomerCartItem }) {
  const allPreviews = [
    item.designPreviewUrl ? { url: item.designPreviewUrl, name: item.designFileName } : null,
    ...(item.additionalDesigns ?? []).map((d) => ({ url: d.previewUrl, name: d.fileName })),
  ].filter(Boolean);

  if (allPreviews.length === 0) {
    return <FallbackIcon product={item.product} />;
  }

  return (
    <div className="flex gap-1 flex-wrap">
      {allPreviews.map((p, i) => (
        <div key={i} className="w-12 h-12 rounded-md overflow-hidden bg-gri-100 ring-1 ring-gri-200 shrink-0">
          <img src={p.url} alt={p.name ?? `Tasarım ${i + 1}`} className="w-full h-full object-contain" loading="lazy" />
        </div>
      ))}
    </div>
  );
}
```

Mevcut tek `DesignThumb` çağrısını `DesignThumbnailGroup` ile değiştir.

---

## GÖREV 2/4 — Ödeme Özeti: Tüm Tasarımları Göster

### Dosya
`src/app/odeme/page.tsx`

### Sorun
Sağ sidebar'daki sipariş özeti kartında tek thumbnail gösteriliyor.

### Fix
Aynı `DesignThumbnailGroup` pattern'ini kullan. Ödeme özetindeki item listesinde:

```typescript
// Mevcut tek DesignThumb yerine:
<DesignThumbnailGroup item={item} />
```

Eğer ödeme sayfasında `CustomerCartItem` tipinde erişim varsa direkt kullan. Yoksa cart item'dan preview listesi çıkar.

---

## GÖREV 3/4 — Sipariş Detay: Tüm Tasarımları Göster

### Dosya
`src/app/siparis/[id]/page.tsx`

### Sorun
Sipariş özeti kartında `SiparisOzetiDesignThumb` tek dosya gösteriyor. Multi-design siparişlerde diğer dosyalar görünmüyor.

### Fix

1. `upload-status` veya `design-url` endpoint'inden tüm design_files'ı al (GÖREV: CURSOR-GOREVLER-TASARIM-YONETIMI Görev 1 bunu yapıyor)
2. Sipariş özeti kartında tüm dosyaların mini thumbnail'larını göster:

```typescript
// order.items[].designFiles varsa (upload-status'tan):
<div className="flex gap-1 flex-wrap mt-1">
  {item.designFiles?.map((df) => (
    <div key={df.id} className="w-10 h-10 rounded overflow-hidden bg-gri-100 shrink-0">
      {df.previewUrl ? (
        <img src={df.previewUrl} className="w-full h-full object-contain" loading="lazy" />
      ) : (
        <FileTypeIcon mimeType={df.mimeType} />
      )}
    </div>
  ))}
</div>
```

---

## GÖREV 4/4 — "Tasarım dosyası" Bölümünde Tüm Dosyaları Listele

### Dosya
`src/app/siparis/[id]/page.tsx`

### Sorun
Sipariş detayın alt kısmında "Tasarım dosyası" bölümü tek dosya gösteriyor. 2+ tasarımlı siparişte hepsi listelemeli.

### Fix
`design_files` endpoint'inden tüm dosyaları çek ve her birini satır olarak göster:

```typescript
{designFiles.map((df, i) => (
  <div key={df.id} className="flex items-center gap-3 py-2 border-b border-gri-100 last:border-0">
    <div className="w-12 h-12 rounded-lg overflow-hidden bg-gri-100 shrink-0">
      {df.previewUrl ? (
        <img src={df.previewUrl} className="w-full h-full object-contain" />
      ) : (
        <FileTypeIcon mimeType={df.mimeType} />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium truncate">{df.fileName}</div>
      <div className="text-xs text-gri-500">
        {(df.sizeBytes / 1024 / 1024).toFixed(1)} MB · {df.status === "qc_passed" ? "✅" : df.status === "analyzing" ? "⏳" : "📁"}
      </div>
    </div>
    <span className="text-xs text-gri-400">Tasarım {i + 1}</span>
  </div>
))}
```

---

## UYGULAMA SIRASI

| # | Görev | Dosya | Süre |
|---|-------|-------|------|
| 1 | Sepet thumbnail grid | sepet/page.tsx | 15 dk |
| 2 | Ödeme özeti thumbnail | odeme/page.tsx | 10 dk |
| 3 | Sipariş detay özet thumbnail | siparis/[id]/page.tsx | 10 dk |
| 4 | Tasarım dosyası listesi | siparis/[id]/page.tsx | 10 dk |

Her görev sonrası: `npx tsc --noEmit` + commit (`feat(multi-design):` prefix)

---

## TEST

```
1. 2 tasarımlı sticker konfigüre et → sepete ekle
2. /sepet → 2 thumbnail yan yana görünmeli ✅
3. /odeme → sağ sidebar'da 2 thumbnail görünmeli ✅
4. Sipariş ver → /siparis/[id] → özette 2 thumbnail görünmeli ✅
5. "Tasarım dosyası" bölümünde 2 dosya listelemeli ✅
6. 1 tasarımlı sipariş → tek thumbnail, normal görünüm ✅
```

---

*Hazırlayan: Claude Code (mimari) · 26 May 2026*
