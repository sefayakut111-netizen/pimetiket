# Cursor Onay Sayfası — Bug Fix + UX İyileştirme

> Claude Code (mimari) tarafından hazırlanmıştır.
> Dosya: `src/app/onay/[orderId]/page.tsx` (1813 satır)
> 12 sorun tespit edildi: 5 fonksiyonel bug + 7 UX/UI iyileştirme.
> **Mevcut tasarım dilini koru** — sadece belirtilen sorunları düzelt.

---

## GÖREV 1/12 — Onayla Butonu Cutline Yokken Disabled Olmalı (BUG — KRİTİK)

### Konum
`src/app/onay/[orderId]/page.tsx` satır 1636-1644

### Sorun
"Bu ürünü onayla" butonu sadece `approving`, `approved` ve `help_requested` kontrolü yapıyor. Cutline henüz üretilmemişken (`activeCutline === null`) buton tıklanabilir. `handleApprove` (satır 858) `cutlineId: undefined` gönderir — cutline'sız onay kabul edilebilir, veri bütünlüğü riski.

### Fix

```typescript
// ESKİ (satır 1640-1644):
disabled={
  approving ||
  activeItem.proof_status === "approved" ||
  activeItem.proof_status === "help_requested"
}

// YENİ — cutline yoksa da devre dışı:
disabled={
  approving ||
  activeItem.proof_status === "approved" ||
  activeItem.proof_status === "help_requested" ||
  (!activeCutline && !showJpgShapeSelector)
}
```

Buton metni de güncellenmeli (satır 1646-1650):
```typescript
// ESKİ:
{approving
  ? "Onaylanıyor…"
  : activeItem.proof_status === "approved"
    ? "Onaylandı ✓"
    : "Bu ürünü onayla"}

// YENİ:
{approving
  ? "Onaylanıyor…"
  : activeItem.proof_status === "approved"
    ? "Onaylandı ✓"
    : !activeCutline && !showJpgShapeSelector
      ? "Bıçak hazırlanıyor…"
      : "Bu ürünü onayla"}
```

---

## GÖREV 2/12 — Düzenle Butonu Cutline Yokken Disabled Olmalı (BUG)

### Konum
`src/app/onay/[orderId]/page.tsx` satır 1633

### Sorun
"Bıçağı düzenle" butonu her zaman aktif. Cutline üretilirken tıklamak POC editörü açar ama ortada düzenlenecek bir şey yok.

### Fix

```typescript
// ESKİ (satır 1633):
<Button variant="secondary" size="md" onClick={handleEdit}>
  Bıçağı düzenle
</Button>

// YENİ:
<Button
  variant="secondary"
  size="md"
  onClick={handleEdit}
  disabled={!activeCutline && !showJpgShapeSelector}
>
  Bıçağı düzenle
</Button>
```

---

## GÖREV 3/12 — Önizleme Alanı SLA Expiry Durumunu Yansıtmalı (BUG)

### Konum
`src/app/onay/[orderId]/page.tsx` satır 1532-1542

### Sorun
Preview empty state her zaman "Otomatik kesim çizgisi hazırlanıyor" gösteriyor. SLA dolup operatöre düştüğünde bile bu mesaj değişmiyor → sağ alt toast "Operatöre düştü" diyor ama ana alan "hazırlanıyor" diyor → çelişki.

### Fix

SLA deadline bilgisini kullanarak empty state'i güncelle:

```typescript
// ESKİ (satır 1532-1542):
<div className="text-center text-sm text-gri-700">
  <div className="mb-2 flex justify-center opacity-50">
    <Icon.Doc size={48} />
  </div>
  <p className="font-medium">
    Otomatik kesim çizgisi hazırlanıyor
  </p>
  <p className="mt-1 text-xs">
    "Düzenle" diyerek bıçağı kendin de ayarlayabilirsin.
  </p>
</div>

// YENİ — SLA durumuna göre farklı mesaj:
(() => {
  const deadlineIso = data?.order.sla_proof_deadline;
  const slaExpired = deadlineIso
    ? new Date(deadlineIso).getTime() <= Date.now()
    : false;

  return (
    <div className="text-center text-sm text-gri-700">
      <div className="mb-2 flex justify-center opacity-50">
        {slaExpired ? <Icon.Info size={48} /> : <Icon.Doc size={48} />}
      </div>
      {slaExpired ? (
        <>
          <p className="font-medium">
            Operatörümüz bıçağı hazırlıyor
          </p>
          <p className="mt-1 text-xs">
            Birkaç saat içinde tamamlanacak. Hazır olunca mail atacağız
            — sayfayı kapatabilirsin.
          </p>
        </>
      ) : (
        <>
          <p className="font-medium">
            Otomatik kesim çizgisi hazırlanıyor
          </p>
          <p className="mt-1 text-xs">
            &quot;Düzenle&quot; diyerek bıçağı kendin de ayarlayabilirsin.
          </p>
          {/* Spinner ekle */}
          <div className="mt-3 flex justify-center">
            <span
              className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-pim-mercan border-t-transparent"
              aria-hidden="true"
            />
          </div>
        </>
      )}
    </div>
  );
})()
```

---

## GÖREV 4/12 — Config Satırında Boyut Duplikasyonu (BUG)

### Konum
`src/app/onay/[orderId]/page.tsx` satır 1272-1273

### Sorun
`{activeItem.qty} ad · {activeItem.width}×{activeItem.height}mm · {activeItem.config}` — config string'i zaten "50×50mm" içeriyor → "50 ad · 50×50mm · Kontur kesim · 50×50mm · Die-cut" çıkıyor.

### Fix

Config'den boyut bilgisini çıkar:

```typescript
// ESKİ (satır 1271-1274):
<div className="mt-0.5 text-xs text-gri-700">
  {activeItem.qty} ad · {activeItem.width}×
  {activeItem.height}mm · {activeItem.config}
</div>

// YENİ — config'den boyut kısmını temizle:
<div className="mt-0.5 text-xs text-gri-700">
  {activeItem.qty} ad · {activeItem.width}×{activeItem.height}mm
  {activeItem.config && (() => {
    const clean = activeItem.config
      .replace(/\d+×\d+\s*mm/g, "")
      .replace(/\s*·\s*·\s*/g, " · ")
      .replace(/^\s*·\s*/, "")
      .replace(/\s*·\s*$/, "")
      .trim();
    return clean ? ` · ${clean}` : "";
  })()}
</div>
```

---

## GÖREV 5/12 — Pim Mesajı Cutline Durumuna Göre Değişmeli (BUG)

### Konum
`src/app/onay/[orderId]/page.tsx` satır 1112-1122

### Sorun
Pim "İlk önizlemeye bak, kesim çizgisini incele" diyor ama cutline henüz hazır değil → bakılacak bir şey yok. Mesaj cutline durumuna göre koşullu olmalı.

### Fix

```typescript
// ESKİ (satır 1115-1121):
<p className="text-sm leading-relaxed text-lacivert">
  {summary.help_requested > 0
    ? `Bir ürün için yardım talebin açık — ...`
    : summary.approved === 0
      ? "İlk önizlemeye bak, kesim çizgisini incele. Memnunsan 'Onayla' de; bir şey değişsin istiyorsan 'Düzenle'."
      : `${summary.approved}/${summary.total} ürün onaylandı, az kaldı! ...`}
</p>

// YENİ — cutline durumuna duyarlı:
<p className="text-sm leading-relaxed text-lacivert">
  {summary.help_requested > 0
    ? `Bir ürün için yardım talebin açık — operatörümüz çözümleyince sıraya gelir. ${summary.help_requested === summary.total - summary.approved ? "Diğer ürünler de seni bekliyor değil mi?" : ""}`
    : order.status === "proof_generating" || bgGenItemId
      ? "Bıçak çizgin hazırlanıyor. Birkaç dakika sürebilir — sayfayı kapatabilirsin, hazır olunca mail atacağız."
      : summary.approved === 0
        ? "İlk önizlemeye bak, kesim çizgisini incele. Memnunsan 'Onayla' de; bir şey değişsin istiyorsan 'Düzenle'."
        : `${summary.approved}/${summary.total} ürün onaylandı, az kaldı! Kalan ${summary.total - summary.approved} ürünü de gözden geçirelim.`}
</p>
```

NOT: `bgGenItemId` state'ine erişim render scope'unda zaten mevcut.

---

## GÖREV 6/12 — Önizleme Alanına Yükleniyor Spinner Ekle (UX)

### Konum
`src/app/onay/[orderId]/page.tsx` satır 1532-1542 (GÖREV 3 ile birleştirilebilir)

### Sorun
Preview alanı büyük gri boşluk + küçük ikon. Animasyon veya spinner yok. Kullanıcı bozuk mu yükleniyor mu anlayamıyor.

### Fix
GÖREV 3'teki fix zaten spinner ekliyor. Eğer GÖREV 3 ayrı yapılacaksa, minimum olarak:

```typescript
// Mevcut empty state bloğunun altına (satır 1541 sonrası):
<div className="mt-3 flex justify-center">
  <span
    className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-pim-mercan border-t-transparent"
    aria-hidden="true"
  />
</div>
```

---

## GÖREV 7/12 — SLA Toast ve Action Bar Çakışmasını Düzelt (UX)

### Konum
- SLA toast: satır 1740 (`fixed bottom-4 right-4`)
- Action bar: satır 1623 (`sticky bottom-4`)

### Sorun
İkisi aynı anda ekranın altında görünüyor → üst üste biniyor, özellikle dar ekranlarda.

### Fix

SLA toast'ı action bar'ın üstüne taşı:

```typescript
// ESKİ (satır 1740):
<div className="fixed bottom-4 right-4 z-40 max-w-sm rounded-lg ...">

// YENİ — action bar yüksekliğini hesaba kat:
<div className="fixed bottom-20 right-4 z-40 max-w-sm rounded-lg ...">
```

Veya daha iyi: SLA bilgisini action bar'ın içine entegre et (tercih edilirse). Minimal fix: `bottom-4` → `bottom-20`.

---

## GÖREV 8/12 — Yardım İste Butonunu Görünür Yap (UX)

### Konum
`src/app/onay/[orderId]/page.tsx` satır 1624-1631

### Sorun
`variant="ghost"` ile render ediliyor → düz metin gibi duruyor, tıklanabilir olduğu belli değil.

### Fix

```typescript
// ESKİ (satır 1624-1631):
<Button
  variant="ghost"
  size="sm"
  onClick={() => setHelpOpen(true)}
  disabled={activeItem.proof_status === "help_requested"}
>
  Ekibimizden yardım iste
</Button>

// YENİ — secondary outline stili:
<Button
  variant="secondary"
  size="sm"
  onClick={() => setHelpOpen(true)}
  disabled={activeItem.proof_status === "help_requested"}
>
  Ekibimizden yardım iste
</Button>
```

---

## GÖREV 9/12 — Sol Panele Gerçek Thumbnail Ekle (UX)

### Konum
`src/app/onay/[orderId]/page.tsx` satır 1203-1211

### Sorun
Sol panel item kartlarında sadece placeholder ikon var. Birden fazla ürünlü siparişlerde kullanıcı hangisini incelediğini görsel olarak ayırt edemez.

### Fix

Design URL'ini kullanarak küçük thumbnail göster:

```typescript
// ESKİ (satır 1203-1211):
<div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gri-100 text-gri-700">
  {item.product === "sticker" ? (
    <Icon.Sticker size={32} />
  ) : (
    <Icon.Tag size={32} />
  )}
</div>

// YENİ — cutline preview varsa göster, yoksa fallback ikon:
<div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gri-100 text-gri-700">
  {(item.cutline?.preview_png_url || (item.designs?.[0]?.cutline?.preview_png_url)) ? (
    <img
      src={item.cutline?.preview_png_url || item.designs?.[0]?.cutline?.preview_png_url || ""}
      alt={item.title}
      className="h-full w-full object-contain"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
        (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
      }}
    />
  ) : null}
  <div className={item.cutline?.preview_png_url || item.designs?.[0]?.cutline?.preview_png_url ? "hidden" : ""}>
    {item.product === "sticker" ? (
      <Icon.Sticker size={32} />
    ) : (
      <Icon.Tag size={32} />
    )}
  </div>
</div>
```

NOT: `preview_png_url` R2 signed URL olabilir. Doğrudan kullanım CORS izni gerektirebilir — eğer CORS sorunu çıkarsa bu görevi atla, signed URL endpoint'i ile çözmek ayrı iş.

---

## GÖREV 10/12 — Geri Navigasyon Breadcrumb Ekle (UX)

### Konum
`src/app/onay/[orderId]/page.tsx` satır 1094-1095 (header bölümü)

### Sorun
Sipariş detayına veya panele dönmek için link yok. Tarayıcı geri tuşuna bağımlı.

### Fix

Header'ın hemen üstüne breadcrumb ekle:

```typescript
// Satır 1094'ten önce ekle (header div'inin içine, <Eyebrow> öncesine):
<Link
  href={`/siparis/${order.id}`}
  className="mb-2 inline-flex items-center gap-1 text-xs text-gri-700 hover:text-pim-mercan transition"
>
  <span>&larr;</span>
  <span>Sipariş detayına dön</span>
</Link>
```

---

## GÖREV 11/12 — Bıçak Tab Rengi Hata İzlenimi Vermesin (UX)

### Konum
`src/app/onay/[orderId]/page.tsx` satır 1434-1437

### Sorun
Aktif tab `bg-pim-mercan` (mercan/kırmızı) kullanıyor. "Bıçak" yazısı kırmızımsı kutuda → kullanıcı hata olduğunu düşünebilir.

### Fix (opsiyonel — emin değilsen ATLA)

Aktif tab'ı brand-neutral renkte yap:

```typescript
// ESKİ (satır 1435-1437):
previewLayer === layer
  ? "border-pim-mercan bg-pim-mercan text-white"
  : "border-gri-200 bg-white text-lacivert hover:border-pim-mercan/40"

// YENİ — daha nötr aktif renk:
previewLayer === layer
  ? "border-lacivert bg-lacivert text-white"
  : "border-gri-200 bg-white text-lacivert hover:border-lacivert/40"
```

NOT: Bu marka renk kararı olabilir. Sefa'ya sor — "opsiyonel" olarak işaretle.

---

## GÖREV 12/12 — SLA Expiry Sonrası Ana Alanda Net CTA (UX)

### Konum
`src/app/onay/[orderId]/page.tsx` satır 1532-1542 (GÖREV 3 ile birleştirilebilir)

### Sorun
Operatöre düştükten sonra kullanıcı ne yapacağını bilmiyor. Sayfada mı kalacak, kapatacak mı, mail mi bekleyecek belirsiz.

### Fix

GÖREV 3'teki SLA expired bloğuna CTA ekle:

```typescript
// GÖREV 3'teki slaExpired bloğunun altına:
<div className="mt-3">
  <Link
    href={`/siparis/${orderId}`}
    className="inline-flex items-center gap-1 rounded-md border border-gri-200 bg-white px-3 py-1.5 text-xs font-medium text-lacivert hover:border-pim-mercan/40 transition"
  >
    Sipariş detayına git
  </Link>
</div>
```

---

## Uygulama sırası

| # | Görev | Tür | Öncelik | Süre |
|---|-------|-----|---------|------|
| 1 | Onayla butonu disable | Bug | KRİTİK | 5 dk |
| 2 | Düzenle butonu disable | Bug | Yüksek | 2 dk |
| 3 | Preview SLA state | Bug | Yüksek | 15 dk |
| 4 | Config duplikasyon | Bug | Orta | 5 dk |
| 5 | Pim mesajı koşullu | Bug | Orta | 5 dk |
| 6 | Preview spinner | UX | Orta | 3 dk (3 ile birleşir) |
| 7 | Toast/action bar çakışma | UX | Orta | 2 dk |
| 8 | Yardım butonu görünürlük | UX | Düşük | 1 dk |
| 9 | Sol panel thumbnail | UX | Düşük | 10 dk |
| 10 | Geri navigasyon | UX | Düşük | 3 dk |
| 11 | Tab rengi (opsiyonel) | UX | Düşük | 2 dk |
| 12 | SLA expiry CTA | UX | Düşük | 3 dk (3 ile birleşir) |

Her fix sonrası: `npx tsc --noEmit` + commit (`fix(onay):` prefix).

**TEST:**
1. Cutline yokken "Bu ürünü onayla" disabled mi? ✅
2. Cutline yokken "Bıçağı düzenle" disabled mi? ✅
3. SLA dolunca preview alanı "Operatörümüz hazırlıyor" mu? ✅
4. Config satırında boyut 1 kez mi yazıyor? ✅
5. Cutline hazırlanırken Pim mesajı uygun mu? ✅
6. Preview alanında spinner dönüyor mu? ✅
7. Toast ve action bar çakışmıyor mu? ✅
8. Yardım butonu tıklanabilir duruyor mu? ✅

---

*Hazırlayan: Claude Code (mimari) · 25 May 2026*
