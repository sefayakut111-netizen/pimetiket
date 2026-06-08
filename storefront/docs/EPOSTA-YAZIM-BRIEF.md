# Pim Etiket — E-posta Yazım Brief'i (29 e-posta)

> Cowork (Claude) hazırladı — 6 Haz 2026. İki araştırmanın (web best-practice + kod tabanı) sentezi. Yazım faslının girdisi.

## Teknik zemin (koddan doğrulandı)

- **Altyapı:** Resend + React Email (TSX). Şablonlar `src/lib/mail/templates/*.tsx`, ortak `base.tsx` layout.
- **Gönderen:** `Pim Etiket <info@pimetiket.com>`. Kuyruk: `fason_mail_outbox` → cron → Resend.
- **Mevcut 13 şablon** (çoğu müşteri transactional'ı zaten var): order-confirmation, order-delivered, proof-ready, proof-help-resolved, qc-flagged, qc-rejected, shipment-status, shipping-update, order-proof-required, order-proof-reminder, order-proof-approved, order-upload-reminder, base.
- **Yazım işi = (a)** mevcut 13'ün dilini brief'e göre cilalamak **(b)** eksik 🔴'ları sıfırdan yazmak (auth 21-23, iade 24-27, iptal 28, ödeme başarısız 29) **(c)** ilişki/admin eksiklerini tamamlamak.
- **Base layout** footer + KVKK dipnotu + (ticari ise) unsubscribe'ı otomatik basıyor → gövdeye tekrar koyma.

## Doğrulanmış link rotaları

| Amaç | Rota |
|---|---|
| Sipariş detay/takip | `/siparis/[id]` |
| Prova onay | `/onay/[orderId]` · düzenle `/onay/[orderId]/duzenle/[itemId]` |
| Sepet | `/sepet` · Siparişlerim `/siparislerim` · İadelerim `/iadelerim` |
| Destek `/destek` · İade talebi `/iade-talep` | |
| Bildirim tercihleri `/bildirim-tercihleri` · çıkış `/bildirim-tercihleri/cikis?t=TOKEN` | |
| Şifre sıfırla `/sifre-sifirla` · Giriş `/auth` | |
| Yorum yaz `/yorum-yaz/[orderId]` | |
| Konfigüratör `/sticker` · `/etiket` | |

Mutlak URL: `https://pimetiket.com` + rota. Değişkenler: orderId (12 hane), tracking_number, carrier_name, estimated_delivery, customerName, items[], total.

## Ortak şablon iskeleti (her e-posta)

1. Logo (küçük) · 2. H1: ne oldu (tek cümle) · 3. 1-2 cümle ana mesaj + sırada ne var · 4. **TEK birincil CTA (buton, fiille başlar, altında metin-link yedeği)** · 5. detay bloğu (no/tutar/tarih) · 6. yardım satırı + destek linki · 7. footer (base'den).

## Ton & kurallar

- Müşteriye **"sen"**, fason/partnere **"siz"**. Samimi ama abartısız; "süresiz/ömür boyu" yok, dalkavukluk yok, **marka kıyaslaması yok**. Terminoloji: "folyo (vinil)".
- Konu satırı: **30-50 karakter**, sipariş/takip no koy, en fazla 1 emoji (güvenlik/yasal e-postada **emoji yok**). Preheader konuyu **tekrarlamaz**, ek bağlam verir.
- Kritik bilgi HTML metin (image-off uyumu), görsellere alt text.

## Görsel kuralı (e-posta bazında)

- **Görsel YOK / neredeyse düz metin:** şifre sıfırlama, e-posta onay, ödeme başarısız, iade/para iadesi onayları, tüm admin/fason bildirimleri. (güven + deliverability)
- **Görsel DEĞERLİ:** prova hazır/onay (etiketin önizleme görseli — zorunlu), sipariş onayı & kargo (küçük ürün thumbnail), teslim/yorum daveti, hoşgeldin, terk sepet (sepetteki ürün), bülten.

## KVKK / İYS sınıflandırması (KRİTİK)

**Transactional (izinsiz gönderilir, unsubscribe KONMAZ):** 1 Sipariş Onayı, 2 Tasarım Yükleme Hatırlatma, 3 Prova Hazır, 4 Prova Hatırlatma, 5 QC Uyarı, 6 QC Red, 7 Kargo Durumu, 8 Kargo Takip, 9 Teslim, 12 Destek Alındı, 13 Destek Yanıtı, 21 Email Onay, 22 Şifre Sıfırlama, 23 Üyelik Hoşgeldin (içine pazarlama girmezse), 24-27 İade akışı, 28 Sipariş İptali, 29 Ödeme Başarısız. + tüm Admin/Fason (15-20).

**Ticari ileti (İYS onayı + opt-out ZORUNLU, sadece onaylı listeye):** 10 Yorum Daveti, 11 Terk Sepet, 14 Newsletter Hoşgeldin.

> Kural: transactional e-postaya pazarlama/indirim karıştırma → yoksa ticari iletiye döner.

## Web araştırma bulguları (doğrulandı — 6 Haz 2026)

- **Konu ≤50 karakter**, fiil + veri (no/takip). **Preheader** konuyu tekrarlamaz, eylem bağlamı ekler (iki satırlık başlık gibi).
- **Tek sütun, mobil öncelikli** (açılmaların %60+'ı mobil). Birincil CTA **fold üstünde**; buton **dokunma hedefi ≥44×44px**.
- **Deliverability:** SPF + DKIM + DMARC zorunlu; transactional ile pazarlamayı **ayrı subdomain/akış**ta tut; **no-reply'dan kaçın** → `info@pimetiket.com` doğru (Gmail/Outlook no-reply'ı spam'e atabilir).
- **Türkiye İYS (ticari ileti):** transactional bildirimler (tahsilat, teslimat, üyelik/abonelik, bilgilendirme) **onaydan muaf — AMA içinde mal/hizmet tanıtımı/özendirme YAPILAMAZ** (yoksa ticari iletiye döner). Ticari iletiler (10,11,14) için İYS kaydı + onay zorunlu. **Ret talebi 3 iş günü içinde İYS'ye işlenmeli** (gecikme = ileti başına ceza).

## AI müdahale haritası (Sefa kararı, 6 Haz 2026)

İlke: **AI yalnız "iç/teknik bağlamı müşteriye uygun dile çevirmek" gerektiğinde girer; matbu (sabit veri/güvenlik) kısımlara girmez.**

- 🟢 **AI yazar:** 5 QC Uyarı, 6 QC Red (mevcut `design-qc` çıktısını müşteri diline çevir), 26 İade Reddedildi (operatör notu → kibar gerekçe), 28 Sipariş İptali (sebep), 16 Günlük Özet (admin, doğal dil özet).
- 🟡 **AI opsiyonel (kişiselleştirme):** 10 Yorum Daveti (alınan ürüne atıf), 11 Terk Sepet (sepet ürünü), 13 Destek Yanıtı (taslak, insan onayıyla).
- 🔴 **AI girmez (matbu/güvenlik):** 1, 3, 8, 9, 21, 22, 23, 24, 25, 27, 29 + tüm saf-veri kargo/sipariş bildirimleri.

İki güvenlik kuralı (her AI'lı e-posta): (1) AI yalnız bilinen gerçeği yeniden ifade eder, **uydurmaz**; sefaRules geçerli. (2) AI başarısızsa **sabit fallback metne** düşer — e-posta asla boş/bozuk gitmez.

## Yazım sırası önerisi

1. **🔴 Eksikler önce** (en kritik, hiç yok): 21-22 auth (Türkçe+marka), 23 üyelik hoşgeldin, 24-27 iade akışı, 28 iptal, 29 ödeme başarısız.
2. **Mevcut 13'ü brief'e göre cilala** (ton + görsel + KVKK uyumu).
3. **İlişki/admin tamamla:** 10 yorum daveti, 11 terk sepet, 14 bülten hoşgeldin, 15-20 admin/fason.

## Çıktı formatı (her e-posta için)

`Tür (transactional/ticari) · Konu satırı · Preheader · Gövde (TR) · Birincil CTA + rota · Görsel (var/yok + ne) · Tetik · Notlar`
