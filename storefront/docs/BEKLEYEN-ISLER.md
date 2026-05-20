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
