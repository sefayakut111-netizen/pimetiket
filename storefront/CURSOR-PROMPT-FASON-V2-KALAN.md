# SIRA 7 — Fason Detay v2 Kalan (4 görev)

> SIRA 5 Grup E (commit 50acfd6) zaten performans modal, kapasite bar, sözleşme indir, iletişim sekmesini ekledi.
> Bu prompt **kalanları** kapatır. Önce kodu kontrol et — yapılmış olanı atla.

Sayfa: `/admin/fason/[id]` (partner detay)
Referans: `@CURSOR-PROMPT-FASON-DETAY-V2.md` (orijinal — 6 görev)

---

## GÖREV 1/4 — Yetenek Bölümü: Ürün-Malzeme Hiyerarşik Seçici

### Mevcut sorun
Şu an `partner_capabilities` flat liste (örn: "kuse", "transparan", "metalik"). Hangi ürün grubunda hangi malzeme yapabildiği belirsiz.

### Çözüm
Yetenek bölümünü 2 katmanlı seçiciyle yeniden tasarla:

```
Ürün Grupları
├─ Sticker
│   ├─ ☐ Kuşe
│   ├─ ☑ Şeffaf
│   └─ ☐ Metalik
├─ Etiket (Rulo)
│   ├─ ☑ Kuşe
│   ├─ ☐ Şeffaf
│   └─ ☑ Holo
└─ Etiket (Tabaka)
    ├─ ☑ Kraft
    └─ ☑ Beyaz
```

`partner_capabilities` tablosu zaten var — schema kontrol et:
- `product_group` (text: 'sticker' | 'etiket_rulo' | 'etiket_tabaka')
- `material_key` (text)

Yoksa Migration 117'de ekle. UI'da ürün gruplarına göre accordion grupla, toggle ile yönet.

`ProductMaterialPicker` component'i `/admin/fason` listesinde zaten var — onu burada da kullan.

---

## GÖREV 2/4 — Ayrı "Yetenek Onayı" Bölümünü Kaldır

### Mevcut sorun
"Yetenek Onayı" ayrı kart olarak duruyor — yetenek değişikliği = yeni onay süreci. Bu kafa karışıklığı yaratıyor.

### Çözüm
- "Yetenek Onayı" kartını kaldır
- Yetenek tablosundaki her satıra inline **🟢 onaylı / 🟡 beklemede / 🔴 ret** rozeti
- Yetenek eklenince otomatik "beklemede", admin satır içi onay butonu (👍/👎) ile karar verir
- DB: `partner_capabilities.approval_status` (text default 'pending' check in ('pending','approved','rejected'))

Migration 117'de kolonu ekle (eğer yoksa).

---

## GÖREV 3/4 — Atanabilir Siparişler: Sözleşme Kontrolü + Onay Modalı

### Mevcut sorun
"Bu siparişi ata" butonu tıklanınca sözleşme kontrolsüz hemen atıyor.

### Çözüm
"Ata" butonuna tıklanınca onay modalı aç:

```
┌─ Siparişi {fason} partnerine ata ───────────┐
│                                              │
│ Sipariş: #00001245 - Swiss Thermo            │
│ Adet: 500 / Kuşe / 100×150mm                │
│ Teslim: 3 gün                                │
│                                              │
│ Partner durumu:                              │
│ ✓ Sözleşme imzalı (15 May 2026)             │
│ ✓ Kapasite müsait (8/12)                    │
│ ✓ "Etiket Rulo + Kuşe" yetenek onaylı       │
│                                              │
│  [İptal]              [Ata ve Bildir]       │
└──────────────────────────────────────────────┘
```

Eğer kontroller başarısızsa kırmızı uyarı + ata butonu disabled:
- ✗ Sözleşme yok → "Sözleşme yükle" linki
- ✗ Kapasite dolu → uyarı
- ✗ Yetenek yok/beklemede → "Yetenek ekle" linki

Aksiyon: mevcut `fn_assign_order_to_fason` RPC + e-posta bildirimi (zaten var).

---

## GÖREV 4/4 — Performans Kartı

### Mevcut durum
SIRA 5 Grup E'de **performans modal** eklendi (skor numarasına tıklayınca açılan popover). Bu görev ondan farklı — sürekli görünen **performans kartı**.

### Çözüm
Partner detay sağ sidebar'a (üst kısım) sürekli görünen kart:

```
┌─ Performans (Son 90 gün) ─────────┐
│                                    │
│ Genel Skor: 8.4/10  ████████░░    │
│                                    │
│ Tamamlanan:        47 sipariş      │
│ Zamanında teslim:  44 (%94)        │
│ İade oranı:        2.1% ⚠️         │
│ Ortalama hız:      2.3 gün         │
│                                    │
│ Trend: ↗ %12 (önceki 90g vs)      │
│                                    │
│           [Detayları gör →]        │
└────────────────────────────────────┘
```

Veri kaynağı: SIRA 5'te eklenmiş olan performans modal API'si (`/api/admin/fason/partners/[id]/performance` veya benzeri). Kart sadece özet, "Detayları gör" → mevcut modal.

Tıklama → mevcut modal aç (yeni API yazma).

---

## Uygulama Sırası

1. **Görev 1** — Yetenek hiyerarşik UI (45 dk) — `ProductMaterialPicker` reuse
2. **Görev 2** — Yetenek onayı kaldır + inline rozet (15 dk)
3. **Görev 3** — Atama onay modalı (20 dk)
4. **Görev 4** — Performans kartı (15 dk) — sadece UI, API mevcut

**Migration 117 (varsa yenisi)** önce DB'ye apply.

Tek commit veya 4 ayrı commit — Cursor karar versin. Önek: `feat(admin):` veya `feat(fason):`.

Her görev sonrası `npx tsc --noEmit`.

## Doğrulama

- `/admin/fason/[id]` aç → sağda performans kartı + yetenek hiyerarşi (accordion) + atama "Ata" modalı
- Yetenek onayı ayrı kart kalkmış, satır içinde 🟢/🟡/🔴 rozetler var
- Atama butonu tıkla → modal kontroller başarılı/başarısız gösteriyor
- CLAUDE.md sefaRules: cüzdan/puan yok, "Bursa" yok
