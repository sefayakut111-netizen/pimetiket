Son inceleme turu — 4 fix. Emoji kullanma. Bu session'da sadece Cursor kod yaziyor.

---

## FIX 1 — Siparis durum chip'lerini 8'e dusur

`/admin/siparisler` sayfasinda 16 durum chip'i var — cok fazla. Gruplayarak 8'e dusur:

Eski (16 chip):
Tumu, Yeni (odendi), Tasarim bekleniyor, AI kontrol, AI sorun (acil), Insan incelemesi, Operator inceliyor, Prova hazirlaniyor, Musteri onayi bekliyor, Duzenleme dogrulaniyor, Musteri onayladi, Uretime hazir, Partnere atandi, Uretimde, Kargoda, Teslim edildi, Iptal edildi

Yeni (8 chip):
```
Tumu (16) | Tasarim bekleniyor (8) | Inceleniyor (0) | Musteri onayi (2) | Uretime hazir (2) | Uretimde (1) | Kargo + Teslim (0) | Iptal (3)
```

Gruplama kurali:
- "Yeni (odendi)" → "Tasarim bekleniyor" icine
- "AI kontrol" + "AI sorun" + "Insan incelemesi" + "Operator inceliyor" → "Inceleniyor"
- "Prova hazirlaniyor" + "Duzenleme dogrulaniyor" + "Musteri onayi bekliyor" → "Musteri onayi"
- "Musteri onayladi" → "Uretime hazir" icine
- "Partnere atandi" → "Uretimde" icine
- "Kargoda" + "Teslim edildi" → "Kargo + Teslim"

Backend filtre mantigi: her chip birden fazla status'u kapsar:
```typescript
const CHIP_STATUS_MAP = {
  tasarim: ["paid", "awaiting_upload"],
  inceleniyor: ["qc_pending", "qc_flagged", "human_review", "human_review_failed", "operator_review"],
  musteri_onayi: ["proof_generating", "proof_validating", "proof_pending"],
  uretime_hazir: ["proof_approved", "ready_to_ship"],
  uretimde: ["fason_assigned", "in_production"],
  kargo_teslim: ["shipped", "delivered"],
  iptal: ["cancelled"],
};
```

---

## FIX 2 — Siparis listesi alt toplam tekrarini kaldir

Listenin en altinda "16 siparis · Toplam 36.805 ₺" yaziyor. Bu bilgi zaten ustteki KPI kartlarinda var — tekrar gereksiz.

Bu satiri KALDIR.

---

## FIX 3 — Yardim talepleri sayfasi UX duzelt

`/admin/yardim-talepleri` sayfasinda:
- Buyuk Pim avatari gereksiz yer kapliyor → KALDIR
- "UZMAN AKISI" eyebrow anlamsiz → KALDIR
- "Musteri yardim talepleri" buyuk baslik + aciklama → basit header yap

Yeni layout:
```
Yardim Talepleri
Prova asamasinda musteri yardim istedigi talepler.

[Bekleyenler (0)] [Cozulenler] [Yoksayilanlar] [Tumu]
```

Sadece baslik + tek satir aciklama + tab'lar. Avatar ve eyebrow kaldirilsin.

---

## FIX 4 — Uretim Partnerleri: sag panel yerine detay sayfasi

`/admin/fason` sayfasinda partner kartina tiklaninca sag panelde detay aciliyor. Bu onemli bir alan — ayri sayfaya gitmeli.

### 4a. Partner kartinda tiklaninca yeni sayfaya yonlendir:
```typescript
// Eski: onClick={() => setSelectedPartnerId(partner.id)} → sag panel acar
// Yeni: router.push(`/admin/fason/${partner.id}`)
```

### 4b. Yeni detay sayfasi olustur: `/admin/fason/[partnerId]/page.tsx`

Icerigi sag paneldeki ile ayni ama tam sayfa:
- Ust: Partner adi + sehir + email + yetkinlik etiketleri
- Tab 1: Atanan isler (aktif/tumu/tamamlanan/sorunlu)
- Tab 2: Partner detayi (firma bilgileri, teslim suresi, skor)
- Tab 3: Gecmis isler (tamamlanan siparisler, kalite metrikleri)
- Ust sag: "Duzenle" butonu → `/admin/fason/yeni?edit={partnerId}`
- Sozlesme durumu: imzali/imzasiz + aksiyonlar

### 4c. Sag paneli kaldir
Mevcut `selectedPartnerId` state'i ve sag panel render'ini KALDIR. Partner listesi tam genislik olsun.

### 4d. "Atanabilecek siparisler" bolumu detay sayfasinda kalsin
Sag paneldeki "ATANABILECEK SIPARISLER (4)" listesi detay sayfasinin "Atanan isler" tab'inda gosterilsin.

---

## KONTROL

Her fix sonrasi: `npx tsc --noEmit` + commit yap.

Test:
1. Siparis filtreleri 8 chip — tiklaninca dogru siparisler listeleniyor
2. Liste altinda toplam satiri yok
3. Yardim talepleri: avatar ve eyebrow yok, basit header
4. Partner kartina tikla → `/admin/fason/[id]` sayfasi aciliyor
5. Partner detay sayfasi: tab'lar, atanan isler, firma bilgileri
