# Manuel Sipariş Hazırlama — Feature Spec

**Tarih**: 2026-05-09
**Durum**: PLANLAMA (kod yazılmadı, Block C.8'e eklendi)
**İstemci**: Sefa (operatör tarafı)

---

## Problem

Müşterilerin bir kısmı configurator'dan sipariş vermez:

- Telefon / WhatsApp ile arıyor → Sefa hesaplıyor → "Sana link atayım, ödeyiver"
- Karmaşık iş, configurator'a sığmayan istek
- Pazarlık edilen özel fiyat
- Tekrar baskı (eski sipariş üzerinden)

Sefa'nın işi:

1. Admin'de hızlıca sipariş hazırla
2. Müşteriye **tıklanır link** gönder (WhatsApp/Email)
3. Müşteri linke girer → adresini gir → öde → bitir
4. Standart sipariş akışı devreye girer (AI QC, prova, üretim)

---

## UX akışı

### Sefa tarafı: `/admin/manuel-siparis`

```
┌─ Yeni Manuel Sipariş ────────────────────────────────┐
│                                                       │
│ 1. MÜŞTERİ                                            │
│    [ Mevcut müşteri ara ▾ ]  veya  [ + Yeni müşteri ]│
│    Ad: Ahmet Yılmaz                                   │
│    E-posta: ahmet@…                                   │
│    Telefon: +90 5XX…                                  │
│                                                       │
│ 2. ÜRÜN                                               │
│    ◉ Sticker   ○ Etiket                              │
│                                                       │
│ 3. KONFİGÜRASYON                                      │
│    Boyut: [50] × [50] mm                              │
│    Adet:  [tier butonları: 25/50/100/250/500/1000]   │
│    Kesim: ◉ Tabaka  ○ Die-cut                         │
│                                                       │
│ 4. FİYAT                                              │
│    Otomatik hesap: 1.250 TL (KDV dahil)              │
│    □ Manuel fiyata geç                                │
│      └─ Manuel fiyat: [____] TL                       │
│      └─ Sebep: [özel indirim, sözleşmeli müşteri…]   │
│                                                       │
│ 5. NOTLAR                                             │
│    [textarea — özel istek, teslim notu vb]           │
│                                                       │
│ 6. LİNK GEÇERLİLİK                                    │
│    [7 gün ▾]  (3 gün / 7 gün / 14 gün / sınırsız)    │
│                                                       │
│ [ İptal ]                          [ Link Oluştur → ]│
└───────────────────────────────────────────────────────┘
```

Link oluşunca:

```
┌─ Link Hazır ──────────────────────────────────────────┐
│                                                       │
│ ✅ PE-MNL-A8K3X9 oluşturuldu                          │
│                                                       │
│ https://pimetiket.com/sepet/PE-MNL-A8K3X9             │
│ ⏱ 7 gün geçerli (16 May 2026'a kadar)                │
│                                                       │
│ [ 📋 Linki kopyala ]                                  │
│ [ 💬 WhatsApp'tan gönder ]  ← önceden hazır metin    │
│ [ 📧 E-posta gönder ]       ← otomatik gider         │
│                                                       │
│ Önizle: [ Müşteri görünümü ↗ ]                       │
└───────────────────────────────────────────────────────┘
```

### Müşteri tarafı: `/sepet/PE-MNL-A8K3X9`

```
┌──────────────────────────────────────────────────────┐
│ Pim Etiket — Senin için hazırlandı 👋                │
│                                                      │
│ Ahmet, Sefa senin için bir sipariş hazırladı:       │
│                                                      │
│ ┌─ Sipariş Özeti ──────────────────────────────┐    │
│ │ 50×50 mm sticker · 250 adet · Tabaka kesim   │    │
│ │ Üretim: 260 (10 hediye)                      │    │
│ │ Teslim: 7-10 iş günü                         │    │
│ │                                               │    │
│ │ TOPLAM: 1.250 TL (KDV dahil)                 │    │
│ │                                               │    │
│ │ Not: "Aciliyet var, en kısa sürede"          │    │
│ └───────────────────────────────────────────────┘    │
│                                                      │
│ Teslimat adresi:  [ adres seç / yeni ekle ]          │
│ Fatura bilgisi:   [ TC kimlik / VKN gir ]            │
│                                                      │
│ [ Onayla ve Öde — 1.250 TL ]                         │
│                                                      │
│ Soru var mı? Pim'e yazabilirsin (sağ alt) ya da     │
│ doğrudan WhatsApp: +90 5XX XXX XX XX                 │
└──────────────────────────────────────────────────────┘
```

Müşteri "Onayla ve Öde" → standart `/odeme` flow + 3DS → ödeme onayı → sipariş.

---

## Backend mimarisi

### Yeni tablo: `manual_order_drafts`

```sql
CREATE TABLE manual_order_drafts (
  id UUID PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,            -- "PE-MNL-A8K3X9" (operatör paylaşır)

  -- Operatör
  created_by_admin_id UUID NOT NULL,
  notes_internal TEXT,                   -- Sefa'nın iç notu (müşteri görmez)

  -- Müşteri
  customer_id UUID,                      -- mevcut müşteri varsa
  customer_email TEXT,                   -- yeni müşteri ise
  customer_name TEXT,
  customer_phone TEXT,

  -- Ürün + konfig
  product TEXT NOT NULL,                 -- 'sticker' | 'etiket'
  config_snapshot JSONB NOT NULL,        -- {W, H, qty, cut, mode, ...}

  -- Fiyat (snapshot, parametre değişse de değişmez)
  pricing_quote JSONB NOT NULL,          -- computeCost() çıktısı tam JSON
  manual_price_override NUMERIC(10,2),   -- nullable, varsa quote yerine bu kullanılır
  manual_price_reason TEXT,              -- audit için

  -- Müşteri-yüzü notu
  notes_customer TEXT,                   -- müşteri linke girince görür

  -- Geçerlilik
  expires_at TIMESTAMPTZ,                -- nullable = sınırsız
  status TEXT NOT NULL DEFAULT 'pending',
    -- 'pending' (link açıldı, ödenmedi)
    -- 'viewed' (müşteri tıkladı)
    -- 'paid' (ödeme tamam, sipariş düştü)
    -- 'expired' (süresi dolmuş)
    -- 'cancelled' (Sefa iptal etti)

  -- İlgili kayıtlar
  order_id UUID,                         -- ödendiğinde Medusa order'a bağlanır

  created_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,                 -- müşteri ilk açtığı zaman
  paid_at TIMESTAMPTZ
);

CREATE INDEX ON manual_order_drafts (token);
CREATE INDEX ON manual_order_drafts (customer_id);
CREATE INDEX ON manual_order_drafts (status, expires_at);
```

### Token format

`PE-MNL-XXXXXX` — toplam 13 char, prefix + 6 char base32 (rakam+harf, çok benzeyenler kaldırılır: 0/O, 1/I/L).

**Generate**: `crypto.randomBytes(5).toString('hex')` veya `nanoid(6, alfabe)`.

**Çakışma**: Doğum tarihi paradoksu — 6 char base32 = 32^6 = 1B kombinasyon. 1000 link içinde çakışma olasılığı %0.0001. Yine de DB UNIQUE constraint var, çakışırsa retry.

### API endpoint'leri

```
POST   /admin/manual-orders          → draft oluştur, token döner
GET    /admin/manual-orders          → liste (Sefa için)
GET    /admin/manual-orders/:id      → detay + müşteri durumu
PATCH  /admin/manual-orders/:id      → güncelle (TTL uzat, iptal et)
DELETE /admin/manual-orders/:id      → iptal (cascade ödeme yapılmadıysa)

GET    /api/cart/by-token/:token     → müşteri tarafı, draft bilgisi döner
POST   /api/cart/by-token/:token/checkout → standart checkout flow'a aktar
```

---

## Storefront UI eklemeleri

### Yeni route: `/sepet/[token]/page.tsx`

- Server component, `[token]` param ile draft fetch
- Token expired → 410 Gone + "Sefa'ya WhatsApp at, yeni link iste"
- Token paid → "Sipariş alındı, takibi şu link" → /siparis/[id]
- Token pending → yukarıdaki müşteri UI

### `/sepet/page.tsx` ile çakışma

Mevcut `/sepet` standart sepet (manual değil). Manuel link `/sepet/[token]` olduğu için route conflict olmaz (Next.js dynamic segment).

---

## Notification'lar

### Müşteriye

- Link oluşturulunca: e-posta + opsiyonel WhatsApp metni
- Link açılınca (viewed_at): yok
- Link 24 saat öncesi expire: hatırlatma maili
- Ödeme onaylanınca: standart sipariş onay maili

### Sefa'ya (admin)

- Link 24 saat geçti hâlâ açılmamış: "Müşteri linke bakmadı"
- Link açıldı ama ödenmedi 48 saat: "Müşteri girdi ama ödemedi, hatırlatayım mı?"
- Ödeme onaylandı: standart sipariş bildirim
- Link süresi doldu: yok (status auto-update)

Bunlar `qc-pipeline` modülündeki cron + webhook altyapısıyla aynı pattern.

---

## Pim agent entegrasyonu

Manuel sipariş feature'ı **Pim Faz 2 (Tasarımcı Pim)** ile sinerji yaratır:

- Müşteri /sepet/[token]'a girince Pim açılış mesajı:
  > "Selam Ahmet, Sefa senin için bu siparişi hazırladı. Bir sorun olursa söyle, hallederim."
- Müşteri "fiyatı pahalı" derse Pim: "Sefa ile konuşayım, sana dönelim mi?" → operatöre escalation
- Müşteri "boyutu değiştirmek istiyorum" derse Pim: "Bu link sabit. Sefa yeni link gönderecek, ona ileteyim mi?"

Bu Block D.1 / D.2 ile birlikte gelecek.

---

## Açık sorular (Sefa'ya)

| # | Konu | Önerim |
|---|---|---|
| 1 | Token format — 6 char (`PE-MNL-A8K3X9`) yeterli mi yoksa 8 char daha güvenli mi? | 6 char yeter, çakışma riski yok |
| 2 | Default TTL — 3 gün mü 7 gün mü? | 7 gün |
| 3 | Manuel fiyat override yetkisi — sadece Sefa mı, diğer operatörler de mi? | Sefa onayı + audit log |
| 4 | Sefa link'i nasıl gönderecek — kopyala / WhatsApp / email — hepsini mi? | Üçü de buton, esnek |
| 5 | Müşteri linke tıklayınca **hesap oluşmalı mı** yoksa **anonim ödeme** mi? | Anonim ödeme + opsiyonel "hesap oluştur" checkbox |
| 6 | Link'in URL hostu — `pimetiket.com/sepet/[token]` mı yoksa kısa subdomain `pe.li/A8K3X9` mı? | Şimdilik ana domain, kısa subdomain L'den sonra |
| 7 | Etiket modülü için aynı flow — sticker'la birlikte mi geliyor yoksa sticker önce mi? | Sticker önce (Block A bittiğinde), etiket modülü gelince genişler |
| 8 | Ödeme yapılınca lot otomatik atanır mı yoksa Sefa onaylayınca mı? | Otomatik (manuel sipariş zaten Sefa onaylı) |

---

## Bağımlılık + sıralama

**Block C.8** olarak konumlandı — eski lineer plan'da yoktu, yeni sıralama:

- C.1-C.5 önce gelmeli (Medusa SDK + auth + cart + customer pages)
- C.4 (payment) — manuel sipariş ödeme yapacaksa zorunlu
- A bitmeli (pricing quote için)
- B bitmeli (DB tablo için)

**Süre tahmini**: 1.5-2 gün
- Admin UI (Manuel Sipariş formu): 4 saat
- Backend API + token system + draft CRUD: 4 saat
- Customer-facing /sepet/[token] sayfası: 3 saat
- Email/WhatsApp/notification entegrasyonu: 2 saat
- Test + edge case'ler (expired, paid, çakışma): 2 saat

---

## V1 sonrası genişlemeler (scope-out)

- **Operatör chat**: Müşteri linke girip soru sorarsa Sefa anlık görsün (intercom benzeri)
- **Toplu manuel sipariş**: Bir müşteri için birden çok line (sepet halinde gönder)
- **Şablon sipariş**: Sık kullanılan konfigürasyonları kaydet, sonraki manuel sipariş için "şu şablondan başla"
- **Komisyonlu satış**: Linki paylaşan partner/distribütör komisyon alır (referral kod)
- **Otomatik fiyat görüşme**: Müşteri "indirim?" derse Pim sınırlı yetkiyle pazarlık eder
- **Yinelenen abonelik**: Aynı sipariş aylık/3-aylık tekrarlar (subscription model)
