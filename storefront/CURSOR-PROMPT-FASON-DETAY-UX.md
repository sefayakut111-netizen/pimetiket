Partner detay sayfasi UX iyilestirme — 8 fix. Emoji kullanma. Bu session'da sadece Cursor kod yaziyor.

Dosya: `src/app/admin/fason/[partnerId]/page.tsx`

---

## FIX 1 — Baslik ve breadcrumb UUID yerine partner adi

Eski:
- Sayfa basligi: "Fason / 7da5703d-3995-43f8-ba62-5cc6147183a0"
- Breadcrumb: "Dashboard > Uretim Partnerleri > 7da5703d..."

Yeni:
- Sayfa basligi: "Etiketbox ltd sti"
- Breadcrumb: "Dashboard > Uretim Partnerleri > Etiketbox ltd sti"

Partner adi API'den zaten geliyor — baslik ve breadcrumb'da `partner.name` kullan.

---

## FIX 2 — Sozlesme durumu banner

Sayfanin ustune (baslik altina) sozlesme durumu banner'i ekle:

```tsx
{!partner.contractSignedAt ? (
  <div className="rounded-lg bg-kirmizi-soft/20 border border-kirmizi/20 p-3 flex items-center justify-between">
    <div>
      <span className="text-sm font-semibold text-kirmizi">Sozlesme imzalanmamis</span>
      <p className="text-xs text-gri-600 mt-0.5">KVKK m.12 geregi siparis atanamaz.</p>
    </div>
    <div className="flex gap-2">
      <Button size="sm" variant="primary" onClick={handleSignContract}>
        Imzalandi olarak isaretle
      </Button>
      <Button size="sm" variant="ghost" href={`mailto:${partner.email}?subject=KVKK Sozlesmesi`}>
        Sozlesme talep et
      </Button>
    </div>
  </div>
) : (
  <div className="rounded-lg bg-yesil-soft/20 border border-yesil/20 p-2 text-sm text-yesil">
    Sozlesme imzali — {new Date(partner.contractSignedAt).toLocaleDateString("tr-TR")}
  </div>
)}
```

---

## FIX 3 — Yetkinlik etiketleri tutarli renk

"Sticker" kirmizi, digerler gri — renk mantigi belirsiz.

Tum yetkinlik etiketleri ayni stilde olsun (aktif = lacivert/koyu, pasif = gri):

```tsx
const chipClass = "rounded-full px-3 py-1 text-xs font-medium bg-gri-100 text-lacivert";
```

Veya urun tipine gore renk:
- Sticker → mercan
- Rulo/Tabaka → lacivert
- Malzeme (Holografik, Metalize, Seffaf, Kagit) → gri

---

## FIX 4 — Atanabilecek siparisler test filtresi

"ATANABILECEK SIPARISLER (4)" listesinde "Admin Test" siparisleri var.

Test siparislerini filtrele — `isTestOrderLike` helper'i kullan:

```
Eski: 270520268437 · Admin Test / 260520265554 · Admin Test / 250520269344 · Sefa Yakut / 250520265149 · Sefa Yakut
Yeni: 250520269344 · Sefa Yakut / 250520265149 · Sefa Yakut (2 atanabilir siparis)
```

---

## FIX 5 — Bos state kartlari kompakt

"AKTIF IS: 0" ve "GECIKEN: 0" kartlari cok buyuk. 0 iken kompakt goster:

```tsx
{activeCount === 0 && delayedCount === 0 ? (
  <p className="text-sm text-gri-500">Henuz atanan is yok.</p>
) : (
  <div className="grid grid-cols-2 gap-4">
    <StatCard label="AKTIF IS" value={activeCount} />
    <StatCard label="GECIKEN" value={delayedCount} />
  </div>
)}
```

---

## FIX 6 — Partner detayi tab icerigi

"Partner detayi" tab'i acildiginda ne gosterecek? Su bilgileri ekle:

```
Firma bilgileri:
  Ad: Etiketbox ltd sti
  Sehir: Ankara
  E-posta: azizarda@etiketbox.com
  Tipik teslim: 5 gun

Kapasite:
  Urun gruplari: Sticker
  Malzemeler: Holografik, Metalize, Seffaf, Kagit

Performans:
  Ortalama skor: — (ilk 5 is tamamlaninca hesaplanir)
  Tamamlanan is: 0
  Sorunlu is: 0
```

---

## FIX 7 — Gecmis isler tab icerigi

"Gecmis isler" tab'i acildiginda tamamlanan siparisleri listele. Bos ise:

```
Henuz tamamlanan is yok. Ilk siparis atandiginda burada gorunur.
```

---

## FIX 8 — "Ata" butonlari belirgin

"Ata →" linkleri kucuk ve fark edilmiyor. Buton seklinde yap:

```tsx
<Button size="sm" variant="primary" onClick={() => handleAssign(orderId)}>
  Ata
</Button>
```

---

## KONTROL

Her fix sonrasi: `npx tsc --noEmit` + commit (`fix(admin):` prefix)
