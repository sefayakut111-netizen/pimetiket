# Mail Template Taslakları — Fason Aktarım

> ⚠️ **AVUKAT + SEFA ONAYI BEKLİYOR** · Tüm template'ler Resend gelince kod tabanına aktarılacak.
> **Tarih:** 11 Mayıs 2026 · **Versiyon:** Taslak 1.0
> **Brand voice:** Türk esnaf samimiyeti, "sen" hitap, max 2-3 cümle, dalkavuk/abartı YASAK

---

## 1) Fason'a Giden — "Yeni İş" (Resend `fason_new_assignment`)

**Subject:** `Yeni iş — Sipariş #{{order_id}} · teslim {{delivery_date}}`

**Reply-To:** `info@pimetiket.com`

**Body (plain + HTML):**

```
Selam {{fason_name}},

Yeni iş geldi. Detaylar aşağıda:

📦 Sipariş #{{order_id}}
👤 Müşteri: {{customer_name}}
📍 Teslim: {{customer_address}}
📞 İrtibat: {{customer_phone}}

🎨 Ürün:
- {{product_type}} ({{material}}, {{coating}}, {{customization}})
- Ölçü: {{width}}×{{height}} mm
- Adet: {{qty}}
- Kesim: {{cut_type}}

📅 Teslim: {{delivery_date}} ({{lead_days}} iş günü)

🤖 AI dosya kontrolü:
{{ai_check_summary}}

📎 Tasarım dosyası:
{{download_link}}

(Link 7 gün geçerli. Açtığında loglanır.)

Durum güncellemek için:
{{status_update_link}}

Soru olursa Sefa'ya yaz.

— Pim Etiket
```

**HTML versiyonu:**
- Header: Pim Etiket logo (lacivert background, white logo) — 60px yüksek
- Body: max-width 600px, padding 24px, font Nunito 16px
- "Tasarım dosyası" butonu: mercan #FF4D4F, beyaz text, 16px padding, rounded-xl
- "Durum güncelle" butonu: lacivert outline, mercan hover
- Footer: gri text "Pim Etiket — pimetiket.com — kvkk@pimetiket.com"

---

## 2) Fason'a Giden — "Link Yenilendi" (Resend `fason_link_renewed`)

**Subject:** `Sipariş #{{order_id}} dosya linki yenilendi`

**Body:**

```
Selam {{fason_name}},

Sipariş #{{order_id}} için dosya linki süresi doldu, yenisini gönderiyorum:

📎 {{new_download_link}}
(72 saat geçerli)

— Pim Etiket
```

---

## 3) Müşteriye — "Üretim Hattına Alındı" (Resend `customer_in_production`)

**Subject:** `Siparişin üretim hattına alındı · #{{order_id}}`

**Body:**

```
Selam {{customer_name}},

Etiketlerin üretim hattına girdi. Tahmini teslim: {{delivery_date}}.

Hazır olunca kargo bilgisini yollarım.

Sipariş detayı: {{order_url}}

— Pim Etiket
```

**HTML:**
- Pim mascot pose="excited" 80px üstte
- Status timeline (5 adım): ✓ Ödendi · ✓ Dosya geldi · ⚙️ Üretimde · ⏳ Kargo · ⏳ Teslim
- Mercan CTA: "Sipariş detayı"

---

## 4) Müşteriye — "Kargoya Verildi" (Resend `customer_shipped`)

**Subject:** `Sipariş #{{order_id}} kargoya verildi 📦`

**Body:**

```
Selam {{customer_name}},

Hazır! Etiketlerin yola çıktı.

📦 Kargo: {{cargo_company}}
🔢 Takip: {{tracking_number}}
🔗 Takip linki: {{tracking_url}}

Tahmini teslim 1-2 gün içinde. Sorun olursa söyle.

— Pim Etiket
```

---

## 5) Müşteriye — "Üretimde Gecikme" (Resend `customer_issue_delay`)

**Subject:** `Sipariş #{{order_id}} hakkında küçük bir not`

**Body:**

```
Selam {{customer_name}},

Sipariş #{{order_id}} üretiminde küçük bir gecikme oldu, hallediyorum.
Tahmini yeni teslim: {{new_delivery_date}}.

Detay için sayfaya bak: {{order_url}}
Soru olursa hemen yaz.

— Pim Etiket
```

> ⚠️ "Fason" / "atölye sorunu" kelimesi MÜŞTERİYE asla yazılmaz. Operasyon arka planda kalır.

---

## 6) Müşteriye — "Otomatik İade" (Resend `customer_auto_refund`)

**Subject:** `Sipariş #{{order_id}} iade edildi`

**Body:**

```
Selam {{customer_name}},

Sipariş #{{order_id}} için prova onayını 36 saat içinde alamadım.
Sistem otomatik iade başlattı.

💰 İade tutarı: {{refund_amount}} TL
💳 İade yolu: Karta (7-14 iş günü banka süresi)

Bu sefer olmadı, bir sonrakine bekleriz. Soru olursa yaz.

— Pim Etiket
```

---

## 7) Sefa'ya İç Bildirim — "Fason Sorun Bildirdi" (Resend `internal_fason_issue`)

**Subject:** `🚨 Fason sorun bildirdi — Sipariş #{{order_id}}`

**Body:**

```
{{fason_name}} sipariş #{{order_id}} için sorun bildirdi.

Kategori: {{issue_category}}
Açıklama: {{issue_description}}
{{#if photo_url}}
Foto: {{photo_url}}
{{/if}}

Admin panelden detaya bak: {{admin_url}}

— Pim Etiket Sistemi
```

> Bu mail Sefa'nın kendi info@ adresine gider; müşteri görmez.

---

## 8) Müşteri Yorum Daveti — (Faz 2'de, Resend `customer_review_request`)

**Subject:** `Sipariş #{{order_id}} elinde — nasıl geçti?`

**Body:**

```
Selam {{customer_name}},

Etiketlerin eline ulaştı sanırım. Nasıl geldiler?

İlk müşterilerimden birisin, yorumun çok değerli — hem
gelecek müşterilere yardım eder, hem ben işi daha iyi yapayım.

⭐ 1 dakikada yorumla: {{review_url}}

Bonus: Yorumun yayınlanınca bir sonraki siparişin için
100 TL kupon yollarım.

— Pim Etiket
```

> Bu mail KVKK rıza gerektirir mi avukata sor — pazarlama mı sayılır, sözleşme ifası mı?

---

## Stil Kuralları (Hepsine Geçerli)

### TON
- "Sen" hitap, "Siz" YASAK
- "Selam {{ad}}" açılış (Türk esnaf)
- Cümleler kısa, max 3 satır
- Emoji: max 1-2 mail başına (CTA'da YASAK, header'da OK)

### YASAK
- "Mükemmel/Harika/Süper/Muhteşem"
- "Tabii ki, mutluluk duyarım..."
- "Sayın ___ Bey/Hanım" (müşteri tarafı)
- "Atölye/fason" kelimesi (MÜŞTERİ tarafı)
- "Tasarımcı Pim/Kargocu Pim" (alt persona)
- Cüzdan/puan/üyelik indirimi

### HTML KISITLAR
- max-width: 600px (mobil için)
- Inline CSS (mail client'larda style tag kırılır)
- Touch target ≥ 44px (CTA buton)
- Font 16px body (50+ yaş okumak için)
- Renkler: Pim Etiket palette (#FF4D4F mercan, #1F2A4D lacivert, #F5DBC4 krem)
- Logo: PNG fallback (SVG bazı mail client'larda render etmez)

### IMZA & FOOTER
```
— Pim Etiket
pimetiket.com · kvkk@pimetiket.com

Sefa Yakut Kırtasiye Baskı Ticaret Ltd. Şti.
Doğanbey VD / 7580607612

Bu maili hata olarak aldıysan görmezden gel —
biz öyle bir liste tutmuyoruz.
```

---

> **AVUKAT İÇİN NOT:**
> 1. Müşteri yorum daveti (#8) — pazarlama mı, sözleşme ifası mı? KVKK rıza gerek mi?
> 2. Mail içinde müşteri PII'si ne kadar gizlenmeli? Adres tam gösterilebilir mi?
> 3. "Bonus 100 TL kupon" yorum karşılığı — tüketici hukuku açısından yanıltıcı mı?
> 4. Otomatik iade mailinde "PayTR otomatik iade başlattı" şeklinde sözleşmesel atıf eklenmeli mi?
