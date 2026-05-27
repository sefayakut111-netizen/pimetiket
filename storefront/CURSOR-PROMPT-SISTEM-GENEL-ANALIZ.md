Pim Etiket storefront'ta son 3 gunde 119 commit yapildi. Cok fazla degisiklik oldu. Simdi tum sistemi bastan sona analiz et, hatalari bul ve duzelt.

Her baslik icin: ilgili dosyalari oku, TypeScript hatalari kontrol et, runtime hata riskleri ara, UX tutarsizliklari tespit et. Sorun bulursan duzelt + commit yap. Sorun yoksa "temiz" yaz.

Emoji kullanma. Bu session'da sadece Cursor kod yaziyor.

---

# BASLIK 1: MUSTERI AKISI (oncelik: en yuksek)

Musteri konfiguratordan siparis onayina kadar tum akisi kontrol et.

Dosyalar:
- `src/app/sticker/page.tsx` + `src/app/sticker/yapilandir/page.tsx`
- `src/app/etiket/page.tsx` + `src/app/etiket/yapilandir/page.tsx`
- `src/app/sepet/page.tsx`
- `src/app/odeme/page.tsx`
- `src/app/odeme-sonuc/page.tsx`
- `src/app/siparis/[id]/page.tsx`
- `src/app/siparis/[id]/tasarim-yukle/page.tsx`
- `src/app/onay/[orderId]/page.tsx`
- `src/app/onay/[orderId]/duzenle/[itemId]/page.tsx`
- `src/app/onay/[orderId]/tamamlandi/page.tsx`
- `src/app/panelim/page.tsx`
- `src/app/siparislerim/page.tsx`
- `src/app/tasarimlarim/page.tsx`

Kontrol:
- Her sayfada TypeScript hatasi var mi?
- Import'lar gecerli mi (silinen/tasinen modul referansi)?
- State yonetimi dogru mu (sonsuz render dongusu, eksik dependency)?
- API cagrilari dogru endpoint'e mi gidiyor?
- Fiyat hesaplamalari NaN/undefined donuyor mu?
- Status gecisleri dogru mu (proof_pending → approved, vs)?
- Multi-design akisi calisiyor mu?
- Responsive/mobil bozuk mu?

Sorun bulursan duzelt + `fix(customer):` prefix ile commit.

---

# BASLIK 2: ADMIN PANEL — OPERASYON

Dosyalar:
- `src/app/admin/page.tsx` (dashboard)
- `src/app/admin/siparisler/page.tsx`
- `src/app/admin/siparis-ekle/page.tsx`
- `src/app/admin/ai-qc/page.tsx`
- `src/app/admin/prova/page.tsx` + `src/app/admin/prova/[orderId]/page.tsx`
- `src/app/admin/kargo/page.tsx` + `src/app/admin/kargo/[orderId]/page.tsx`
- `src/app/admin/fason/page.tsx` + `src/app/admin/fason/yeni/page.tsx`
- `src/components/layout/AdminShell.tsx`

Kontrol:
- Dashboard KPI'lari dogru hesaplaniyor mu?
- Test verisi filtreleri tutarli mi (tum sayfalarda ayni kural)?
- Sidebar badge sayilari sayfalarla uyumlu mu?
- Status Turkcelestirme her yerde uygulanmis mi?
- Cron saglik gostergesi dogru mu?
- Durum guncelleme dropdown'lari dogru gecisler mi?
- Toplu islem (checkbox + bulk action) calisiyor mu?

Sorun bulursan duzelt + `fix(admin-ops):` prefix ile commit.

---

# BASLIK 3: ADMIN PANEL — MUSTERI/ICERIK/YONETIM

Dosyalar:
- `src/app/admin/musteriler/page.tsx` + `src/app/admin/musteriler/[id]/page.tsx`
- `src/app/admin/yorumlar/page.tsx`
- `src/app/admin/iadeler/page.tsx`
- `src/app/admin/tasarimlar/page.tsx`
- `src/app/admin/yardim-talepleri/page.tsx`
- `src/app/admin/destek/page.tsx`
- `src/app/admin/urunler/page.tsx`
- `src/app/admin/aboneler/page.tsx`
- `src/app/admin/blog/page.tsx`
- `src/app/admin/site-gorselleri/page.tsx` (veya benzeri)
- `src/app/admin/odemeler/page.tsx` (veya finans/raporlar)
- `src/app/admin/kuponlar/page.tsx`
- `src/app/admin/calisanlar/page.tsx`

Kontrol:
- Musteriler sayfasi veri cekiyor mu (M1 fix calisiyor mu)?
- Test verisi filtreleri tum sayfalarda var mi?
- Chip/tab sayimlari dogru mu?
- Blog silme confirm modal var mi?
- Kupon "En populer" 0 kullanimda dogru metin mi?
- Odemeler musteri kolonu dolu mu?
- Finans rakamlari Dashboard ile tutarli mi?
- RBAC: operasyon rolu finans erisimi engelleniyor mu?
- Calisan kaldirma tek admin guard calisiyor mu?

Sorun bulursan duzelt + `fix(admin-crm):` prefix ile commit.

---

# BASLIK 4: ADMIN PANEL — SISTEM

Dosyalar:
- `src/app/admin/ayarlar/page.tsx`
- `src/app/admin/denetciler/page.tsx` + alt sayfalari
- `src/app/admin/profil/page.tsx` (veya profilim)
- `src/app/admin/yedekler/page.tsx`
- `src/app/admin/arsiv/page.tsx`
- `src/app/admin/kvkk-talepleri/page.tsx`
- `src/app/admin/denetim-kaydi/page.tsx` (veya audit log)
- Cron izleme sayfasi

Kontrol:
- Ayarlar formu DB'den deger cekiyor mu (S6 fix)?
- Sifre degistirme eski sifre istiyor mu (S17 fix)?
- Sistem menusu 404 vermiyor mu (S2 fix)?
- Audit log filtre/donem calisiyor mu?
- Cron confirm modal calisiyor mu?
- Fiyat operasyon toggle tutarli mi?
- Varsayilana sifirla confirm modal var mi?

Sorun bulursan duzelt + `fix(admin-sys):` prefix ile commit.

---

# BASLIK 5: FIYAT MOTORU + HESAPLAYICI

Dosyalar:
- `src/lib/pricing-calc.ts`
- `src/lib/pricing-config-types.ts`
- `src/lib/pricing-dual-price.ts`
- `src/lib/pricing-diff.ts`
- `src/lib/pricing-engine/` (tum dosyalar)
- `src/lib/sticker-customer-pricing.ts`
- `src/lib/etiket-customer-pricing.ts`
- `src/lib/customer-pricing-from-config.ts`
- `src/components/admin/pricing/StickerCalculator.tsx`
- `src/app/admin/fiyatlar/page.tsx`

Kontrol:
- Dual-price (alis/satis) her yerde tutarli mi?
- `margin` ve `cargo` sticker/tabaka'dan tamamen kaldirilmis mi?
- `m2_sell_try` / `sheet_sell_try` fallback'ler calisiyor mu?
- Hesaplayici site fiyati = musteri konfigurator fiyati mi (ayni parametrede)?
- NaN/undefined/Infinity riski var mi?
- Tier carpanlari dogru mu?
- Etiket rulo (pricebook) bozulmamis mi?

Sorun bulursan duzelt + `fix(pricing):` prefix ile commit.

---

# BASLIK 6: PARTNER PANELI

Dosyalar:
- `src/app/partner/layout.tsx`
- `src/app/partner/page.tsx`
- `src/app/partner/siparisler/page.tsx`
- `src/app/partner/siparisler/[id]/page.tsx`
- `src/app/partner/ayarlar/page.tsx`
- `src/app/partner/giris/page.tsx`
- `src/components/partner/` (tum bilesenler)
- `src/app/api/partner/` (tum endpoint'ler)

Kontrol:
- Sidebar navigasyon calisiyor mu?
- Dashboard stat kartlari dogru mu?
- Acil siradakiler dogru filtreleniyor mu?
- Indirme butonlari (Goruntu/Bicak/Goruntu+Bicak) calisiyor mu?
- Durum guncelleme akisi dogru mu?
- Ayarlar sayfasi profil yukluyor mu?
- OTP login calisiyor mu?
- Site header partner modunda gizleniyor mu?

Sorun bulursan duzelt + `fix(partner):` prefix ile commit.

---

# BASLIK 7: AI + PIM SOHBET + POC EDITOR

Dosyalar:
- `src/lib/agents/run-order-qc.ts`
- `src/lib/agents/design-qc.ts`
- `src/lib/agents/schedule-order-design-qc.ts`
- `src/lib/agents/run-order-cutline.ts`
- `src/components/pim/PimChat.tsx`
- `src/lib/pim/personas.ts`
- `src/lib/pim/navigation-tools.ts`
- `src/app/api/pim/chat/route.ts`
- `public/poc.html`
- `src/app/onay/[orderId]/duzenle/[itemId]/page.tsx`

Kontrol:
- QC pipeline calisabiliyor mu (import'lar, fonksiyon imzalari)?
- Pim chat markdown link yasagi uygulanmis mi?
- `renderMessageText()` fallback link renderer calisiyor mu?
- POC editor tasarim otomatik yukluyor mu?
- Vision fallback hook calisiyor mu?

Sorun bulursan duzelt + `fix(ai):` prefix ile commit.

---

# BASLIK 8: API + BACKEND + GUVENLIK

Dosyalar:
- `src/app/api/payment/callback/route.ts`
- `src/app/api/payment/init/route.ts`
- `src/app/api/design/upload-complete/route.ts`
- `src/app/api/orders/admin-bypass-promote/route.ts`
- `src/app/api/orders/[id]/advance-status/route.ts`
- `src/app/api/admin/` (rastgele 10 endpoint sec ve kontrol et)
- `src/middleware.ts`
- `src/lib/supabase/admin.ts` + `server.ts`

Kontrol:
- Payment callback race condition fix'i yerinde mi?
- Admin bypass promote + QC await calisiyor mu?
- Auth middleware dogru koruma yapiyor mu?
- CORS/CSP header'lari dogru mu?
- Rate limiting uygulanmis mi?
- Hassas endpoint'lerde assertAdmin/assertPermission var mi?

Sorun bulursan duzelt + `fix(api):` prefix ile commit.

---

# BASLIK 9: TYPESCRIPT + BUILD + GENEL

Son kontrol:
```bash
npx tsc --noEmit
npm run build
```

- TypeScript 0 hata olmali
- Build warning'leri listele (error olmamali)
- Kullanilmayan import'lari temizle
- `console.log` debug satirlari kalmiyor olmali
- `.env.example` guncel mi?

Sorun bulursan duzelt + `chore(cleanup):` prefix ile commit.

---

# CIKTI

Tum basliklar bittikten sonra ozet rapor yaz:

```
BASLIK 1 (Musteri akisi): X sorun bulundu, Y duzeltildi
BASLIK 2 (Admin operasyon): ...
BASLIK 3 (Admin CRM/icerik): ...
BASLIK 4 (Admin sistem): ...
BASLIK 5 (Fiyat motoru): ...
BASLIK 6 (Partner): ...
BASLIK 7 (AI/Pim/POC): ...
BASLIK 8 (API/Backend): ...
BASLIK 9 (Build/TS): ...

TOPLAM: X sorun bulundu, Y duzeltildi, Z uyari (dusuk oncelik)
```
