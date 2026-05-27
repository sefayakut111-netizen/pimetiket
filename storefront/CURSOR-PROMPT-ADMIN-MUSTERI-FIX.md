Admin paneli musteri bolumu — 11 fix. Emoji kullanma. Bu session'da sadece Cursor kod yaziyor.

---

## FIX 1 — /admin/musteriler veri cekme hatasi (KRITIK)

Sayfa "Musteri verisi su an cekilemiyor" hatasi gosteriyor ama Dashboard'da musteri verisi var (Sefa Yakut 16 siparis).

Debug adimlari:
1. `src/app/admin/musteriler/page.tsx` dosyasini oku
2. Hangi API endpoint'i cagiriyor bul (muhtemelen `/api/admin/customers` veya benzeri)
3. O endpoint'i oku — hata nerede? Supabase sorgusu mi patlak, auth mi eksik, tablo mi yok?
4. Dashboard'daki top musteri verisi hangi endpoint'ten geliyor karsilastir
5. Hatanin kok sebebini bul ve duzelt
6. Sayfayi test et — KPI'lar ve musteri listesi dolmali

---

## FIX 2 — AI kuyrugundaki takili dosyalari repair et

Tasarimlar sayfasinda 18 dosya "AI isliyor" durumunda 1+ gundur takili.

Repair script olustur: `scripts/dev/repair-stuck-ai-files.mjs`

```javascript
// design_files tablosunda status='analyzing' ve created_at < 1 saat once olan dosyalari
// status='uploaded' yaparak QC'nin tekrar tetiklenmesini sagla

const { data: stuck } = await supabase
  .from("design_files")
  .select("id, order_id, status, created_at")
  .eq("status", "analyzing")
  .lt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

// Her biri icin status'u 'uploaded' yap ve QC'yi yeniden tetikle
for (const file of stuck) {
  await supabase.from("design_files").update({ status: "uploaded" }).eq("id", file.id);
  // scheduleOrderDesignQC tetikle
}
```

Ayrica: `/admin/tasarimlar` sayfasinda "Takili dosyalari yeniden isle" butonu ekle (admin aksiyon).

---

## FIX 3 — Tasarimlar test filtresi

Siparisler/Prova/AI QC sayfalarinda "Test siparislerini goster" toggle var ama Tasarimlar'da yok.

Ayni `admin-order-filters.ts` fonksiyonunu kullanarak test verisini filtrele. Toggle ekle:

```
(18 test dosyasi gizli) [Test dosyalarini goster]
```

---

## FIX 4 — Tasarimlar chip sayimlari

Filtre chip'lerinde sayi yok: "Tumü / Yuklendi / AI isliyor / AI ✓ / Uyari / Sorunlu / Onayli"

Sayi ekle: "Tumü (25) / Yuklendi (3) / AI isliyor (18) / AI ✓ (2) / Uyari (2)"

---

## FIX 5 — Tasarimlar AI sonuc detayi

Dosya kartlarinda sadece "AI ✓" veya "! 1" uyari ikonu var. Detay yok.

Her kartta AI kontrol sonucunu kisa ozet olarak goster:

```
Eski: "AI ✓"
Yeni: "AI ✓ · 300 DPI · RGB"

Eski: "! 1"
Yeni: "! DPI dusuk (72)" veya "! CMYK degil"
```

`design_quality_checks` tablosundan veya `design_files.ai_check` JSONB'den kontrol sonuclarini cek.

---

## FIX 6 — Yorumlar sol menu badge

Sol menude "Yorumlar" yaninda badge yok. Bekleyen (moderasyon gerektiren) yorum sayisini badge olarak goster.

```tsx
// AdminShell.tsx sidebar'da:
{ label: "Yorumlar", href: "/admin/yorumlar", badge: pendingReviewCount }
```

0 ise badge gosterme. 1+ ise sayi goster.

---

## FIX 7 — Iadeler: iptal vs iade aciklamasi

Iadeler sayfasinda 0 iade var ama Dashboard'da %19 iptal orani var. Operatör karistirir.

Sayfa ustune aciklama ekle:

```tsx
<p className="text-sm text-gri-600 mb-4">
  Iade = teslim edildikten sonra musteri geri gondermesi.
  Iptal = siparis uretime girmeden vazgecme.
  Iptal edilen siparisleri Siparisler sayfasindan gorebilirsin.
</p>
```

---

## FIX 8 — Destek vs Yardim Talepleri aciklama

Iki sayfanin farki belirsiz. Her sayfanin basina tek satirlik aciklama ekle:

Yardim Talepleri sayfasi:
```
Prova asamasinda "Ekibimizden yardim iste" tiklayan musterilerin talepleri.
```

Destek sayfasi:
```
Genel musteri destek talepleri — iletisim formu, e-posta ve Pim sohbet uzerinden gelen.
```

---

## FIX 9 — Destek: operatör ticket olusturma

Destek sayfasinda "Yeni destek talebi olustur" butonu yok. Operatör musteri adina ticket acabilmeli.

Sayfa ustune buton ekle:

```tsx
<Button variant="primary" size="sm" onClick={() => setCreateModalOpen(true)}>
  Yeni talep olustur
</Button>
```

Modal: musteri sec (arama) + konu + aciklama + oncelik (normal/yuksek/acil).

API yoksa basit bir `support_tickets` tablosu INSERT'i yeterli.

---

## FIX 10 — KVKK saklama suresi bilgisi

Tasarimlar sayfasinda dosyalarin ne zaman silinecegi yazmiyor.

Sayfa ustune bilgi notu ekle:

```tsx
<p className="text-xs text-gri-500">
  Tasarim dosyalari teslimden 90 gun sonra otomatik imha edilir (KVKK m.7).
</p>
```

---

## FIX 11 — Iptal edilmis siparis dosyasi KVKK kontrolu

Iptal edilen siparislerin tasarim dosyalari hala storage'da duruyor. `purge-expired-designs` cron'u sadece teslim edilmis siparislere mi bakiyor kontrol et.

Iptal edilen siparisler icin de 30 gun sonra dosya temizligi eklenmeli:

```sql
-- purge-expired-designs cron'unda:
WHERE (o.status = 'delivered' AND o.updated_at < NOW() - INTERVAL '90 days')
   OR (o.status = 'cancelled' AND o.updated_at < NOW() - INTERVAL '30 days')
```

---

## KONTROL

Her fix sonrasi: `npx tsc --noEmit` + commit (`fix(admin):` prefix)

FIX 1 en kritik — musteri sayfasi calismadan CRM modulu kullanilmaz.
FIX 2 icin repair script'i olustur ama calistirmadan kullaniciya sor.
