# Bekleyen İşler

Sefa'nın aldığı UX/yasal denetim raporundan (21 May 2026 v68) ertelenen
maddeler. Bu dosya hatırlatma listesi — Sefa zamanı geldiğinde uygula.

## 🔴 Acil (yasal)

### Telefon numarası eklenmesi
**Risk:** Mesafeli Sözleşmeler Yönetmeliği m.5/1-a satıcı telefon bilgisini
"açık ve anlaşılır" şekilde istiyor. Şu an sitede telefon yok — tüketici
şikayetinde eksik bilgilendirme olarak değerlendirilebilir.

**Bilgi geldiğinde aşağıdaki dosyalara ekle:**
- `src/components/layout/Footer.tsx` — şirket iletişim bloğu
- `src/app/iletisim/page.tsx` — iletişim kanalları listesi
- `src/app/mesafeli-satis/page.tsx` — SATICI bilgileri bloğu (m.1)
- `src/app/on-bilgilendirme/page.tsx` — SATICI bilgileri (m.1)
- `src/app/kvkk/page.tsx` — Veri Sorumlusu iletişim
- `src/lib/mail/templates.ts` — sipariş onay/iade mail imzaları

**Hatırlatma:** Sefa telefon numarasını aldığında bu listedeki 6 dosya tek
seferde güncellensin. WhatsApp linki de aynı numaradan yönlendirilecekse
İletişim sayfasında da WhatsApp blok aktif olur (bkz. P2 #9).

---

## 🟠 Önemli (yasal/teknik — bilgi/karar gerek)

### AI sohbet açık rıza modal (KVKK m.9)
**Şu an:** Pim sohbeti açıldığında otomatik kabul varsayılıyor.

**Yapılması gereken:** İlk sohbet öncesi modal:
> "Bu sohbet OpenAI (ABD)'ye veri aktarır. Sohbet içerikleri yapay zekayla
> işlenir. Kabul ediyor musun?"
> [Kabul Ediyorum] [Vazgeç]

Kabul → localStorage `pim_ai_chat_consent_v1` = true. Sonraki sohbetler
sessizce açılır. Vazgeç → modal kapanır, sohbet açılmaz.

**Risk:** KVKK Kurulu denetiminde "açık rıza" tanımına uymuyor.

### Çerez bandı varlık kontrolü
**Şu an:** Çerez bandı görünmüyor (Sefa raporu). GA4/PostHog rıza
olmadan çalışıyorsa KVKK ihlali.

**Doğrula:**
1. Incognito mode'da /anasayfa aç — çerez bandı çıkıyor mu?
2. Eğer çıkmıyorsa: çerez bandı componenti eksik veya rıza state'i
   yanlış default true.
3. "Reddet" butonu "Kabul" kadar erişilebilir mi (WCAG)?

**Çözüm:** `src/components/CookieBanner.tsx` mevcut mu kontrol et + RootLayout'a
ekle. GA/PostHog init rıza state'inden sonra.

### Pim chatbot canlı yanıt kontrolü
**Sefa raporu:** Pim "şablon yok" diyor ama /sablonlar var; "Canva'da RGB
bırak" diyor (yanlış — CMYK doğru).

**Personas dosyası DOĞRU** (src/lib/pim/personas.ts line 137, 161-173).
Canlı yanıt sorunu varsa:
- OpenAI API yanıt çeşitliliği (temperature)
- System prompt'ta personas.ts gerçekten kullanılıyor mu?
- Konuşma geçmişi /sohbet hangi sayfada açılıyor — örnek diyaloglar
  hardcoded ise temizle.

### Pim AI cevaplarına test soruları
1. "Hazır şablon var mı?" → Doğru cevap: "/sablonlar'da 60+ şablon var"
2. "Canva'da CMYK yok ne yapayım?" → Doğru: "RGB indir, biz çeviriyoruz,
   %5-10 sapma olağan"
3. "Etiket kaç günde gelir?" → Doğru: "10 iş günü kargoya verilir"
4. "Sticker kaç günde gelir?" → Doğru: "5 iş günü kargoya verilir"

---

## 🟢 İyileştirme (zaman bulduğunda)

- Galeri sayfası gerçek içerikle dolsun (boş + tek yorum "öne çıkan" eksik)
- Blog "1 dk okuma" göstergesi içerik uzaması ile otomatik düzelir
- Anasayfa "Nasıl çalışır" akış sırası: "Konfigüre → Öde → Tasarımı yükle
  → Provayı onayla → Teslim al" (eski "yükle → öde" çelişkisi)

---

## 🔴 Admin denetim raporu (21 May 2026 — production debug gerek)

### Müşteriler CRM API (P0 #3 — production-only sorun?)
**Frontend + Backend kod tutarlı**, DB'de `v_admin_customers` view'da 3 müşteri var,
service_role çağrı yapıyor. Lokalde çalışıyor görünüyor.

**Sefa production'da "Müşteri verisi şu an çekilemiyor" hatası alıyor.**

**Debug adımları:**
1. Vercel deploy logs (Functions tab) — `/api/admin/customers` çağrısı kontrol
2. Console error: "view query failed" log'u dikkate al
3. ENV vars: `SUPABASE_SERVICE_ROLE_KEY` Vercel'de set mi?
4. Migration 046'nın view DEFINER ayarları production'a aynen geçti mi?

Düzelme: Bekleyen — production logs gerek.

## 🟠 Admin P1/P2 düzeltmeleri — TAMAMLANDI (21 May 2026 v68)

Tüm admin denetim P1+P2 (P2 #12 PayTR hariç) commit'lendi:
- ✅ P2 #9 KDV, #10 city normalize, #11 üretim toplam, #13 sidebar badge
- ✅ P2 #14 kronolojik sort, #15 İadeler tab/stat, #16 separator, #17 breadcrumb
- ✅ P2 #18 HOSGELDIN10 TR locale
- ✅ P1 #5 Kargo empty state, #6 Tasarımlar loading, #7 Ürünler skeleton, #8 Aboneler skeleton

P2 #12 PayTR aktif değil ama Kart %100 — **Sefa kararı: bu alana dokunulmadı** (manuel test sonrası ele alınacak).

---

## 🔴 Site denetim raporu (21 May 2026 v68) — ATLANAN/NOT EDİLEN

### DB encoding cleanup (Site P0 #1 takip)
**Sorun:** /etiket ve /sticker liste sayfalarındaki kart başlık/açıklamaları DB'de bozuk Türkçe karakter ("�zel", "Sil�etine") olarak saklı. Migration 074 INSERT encoding hatası.

**Yapılan:** Client-side guard eklendi (page.tsx) — bozuk karakter algılanırsa fallback hardcoded array kullanılıyor, kullanıcı bozuk metin görmüyor.

**Bekleyen:** Migration 075 — `product_cards` tablosundaki bozuk satırları UPDATE ile düzelt. Sefa onayı sonrası uygulanacak. Pattern:
```sql
UPDATE product_cards SET title_tr = '...doğru metin...' WHERE id = '...';
```

### Bumper render bug (Site P2 #18)
**Sorun:** `/sticker/yapilandir?form=&shape=bumper` URL'inde sayfa render olmuyor, sadece comment article dönüyor.

**Reprod gerek:** Lokalde tekrarlanmadı (cutMode=diecut default, shape=bumper valid). Production'da test edilmeli — belki SSR cache veya hidration sorunu.

### /yorumlar ve /galeri içerik dolumu
**Sorun:** Her iki sayfa da DB'den çekiyor, gerçek müşteri verisi gelene kadar boş kalıyor.

**Karar:** Boş state'leri açıklayıcı — fallback yok (TKHK m.61 yanıltıcı reklam riski). İlk gerçek yorum/galeri öğesi gelince otomatik dolar. Geçici nav gizleme YOK (Sefa istemedi).

### Şablonlar 60+ tutarlılık (Site P1 #10)
**Sorun:** "60+ hazır şablon" ifadesi 3 yerde yazılı ama 12 kategoride somut sayım yapılmamış.

**Karar:** "60+" pazarlama ifadesi, gerçek şablon sayısı arttıkça güncellenecek. Şu an müdahale edilmedi.

---

## 🟢 Ürün denetim raporu (21 May 2026 v68) — TAMAMLANDI

24 madde commit'lendi (acea2b1 + 9aba1fe + fc931e6):
- ✅ P0 #1 tabaka özet sarım/rulo, #2 Bumper preset, #3 oval label, #4 sticker dinamik boyut, #5 ?material= pre-select
- ✅ P1 #6 Şeffaf "şekil" fix, #7 Title Case, #8 material default seffaf, #10 deliveryEstimate saat sıfırlama, #11 savings tooltip, #12 binlik ayraç
- ✅ P2 #14 sticker title, #15+16 Tabaka Sticker, #18 default qty 250, #19 köşe tooltip, #20 schema TR, #21 "Açık ve net", #22 slider tic, #24 adedi yazım

**Atlanan:** #9 rulo varyant fiyat (shape fiyatı kasıtlı etkilemiyor — material #6 ile çözüldü), #13 footer parens (kod doğru — cache görüntü), #17 default boyut Bumper farklı (kasıtlı), #23 kart açıklamaları admin DB'den (manuel Sefa).

---

## 🟢 Konfigüratör denetim raporu (21 May 2026 v68) — TAMAMLANDI

10 madde commit'lendi (fc931e6 + bu commit):
- ✅ P0 #1 sessiz fail (touched temizlenince toast düzgün çalışıyor), #2+#10 touched vs unlocked ayrımı (kendi bug fix'im), #4 PriceCard "Tahmini fiyat" uyarı bandı
- ✅ #5 Önizleme görselleri — shape'e göre dinamik render (circle Ø, oval ellipse, square eş kenar, bumper özel pad, kiss-cut taşıyıcı kağıt, diecut dashed outline, transparan checker, sketch mode showBrand=false)
- ✅ P1+P2 #3 FormSection inert, #6 sticky bar aria-label, #7 Ø format, #8 geçersiz URL toast

**Atlanan:** #9 Kaplama/Yüzey terminoloji (kasıtlı farklı kavramlar — Sefa kararı).

---

## 🟡 Site denetim P2 #18 takip — Bumper render bug
**Durum:** Lokalde reprod edilemedi. Sefa "/sticker/yapilandir?form=&shape=bumper sayfası kopuk" demişti — şu an URL routing fix'leri (P0 #2, konfigüratör #2) sonrası test edilmeli. Production'da hâlâ varsa SSR cache veya hidration sorunu.
