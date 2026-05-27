Partner detay sayfasi (`/admin/fason/[partnerId]`) komple UX yeniden organizasyonu. Emoji kullanma.

---

## GENEL LAYOUT DEGISIKLIGI

Mevcut: 3 tab (Atanan isler / Partner detayi / Gecmis isler) — duz liste gorunumu.

Yeni: 2 kolonlu layout — sol ana alan + sag sidebar.

```
UST: Partner adi + sehir + email + yetkinlik etiketleri + Duzenle butonu
     Sozlesme banner (imzali/imzasiz)

SOL KOLON (%60-65)                    SAG KOLON (%35-40)
┌──────────────────────────┐         ┌─────────────────────┐
│ ATANAN ISLER              │         │ PERFORMANS          │
│ [Aktif] [Tumu] [Tamam] [Sorun]│    │ Aktif is: 0         │
│                            │         │ Geciken: 0          │
│ Siparis kartlari...        │         │ Tamamlanan: 0       │
│                            │         │ Ort. skor: —        │
│ ATANABILECEK SIPARISLER    │         │ Tipik teslim: 5 gun │
│ 250520269344 · Sefa [Ata]  │         ├─────────────────────┤
│ 250520265149 · Sefa [Ata]  │         │ FIRMA BILGILERI     │
│                            │         │ Ad: Etiketbox       │
│                            │         │ Sehir: Ankara       │
│                            │         │ E-posta: aziz...    │
│                            │         ├─────────────────────┤
│                            │         │ KAPASITE            │
│                            │         │ (asagida detay)     │
└──────────────────────────┘         └─────────────────────┘
```

### Degisiklikler:
1. 3 tab KALSIN (Atanan isler / Partner detayi / Gecmis isler) — ama iceriklerini gelistir
2. Tab alani sol kolon (%60-65), sag kolon (%35-40) her zaman gorunsun
3. Sag kolon: Performans + Firma bilgileri + Kapasite — tab degistirince degismez (sabit sidebar)
4. Sol kolon: Aktif tab icerigini gosterir

---

## KAPASITE ALANI — URUN GRUBU + MALZEME HIYERARSISI

Mevcut: Duz liste "Malzeme: Holografik [Onayla]" seklinde — yanlis mantik.

Yeni: Urun grubu secilince altindaki malzemeler gosterilsin. Ayni `/admin/fason/yeni` formundaki ProductMaterialPicker mantigi.

```
KAPASITE

[x] Sticker
    [x] Tumu  (tum sticker malzemelerini secer)
    veya tek tek:
    [x] Vinil  [x] Holografik  [x] Metalize  [ ] Seffaf  [ ] Simli

[ ] Rulo Etiket
    (secilince malzeme chip'leri acilir)

[ ] Tabaka Etiket
    (secilince malzeme chip'leri acilir)
```

### Mantik:
- Urun grubu checkbox'i tiklaninca o grubun malzemeleri gosterilir
- "Tumu" secilirse o gruptaki tum malzemeler secilir
- Tek tek malzeme de secilebilir
- Urun grubu kaldirilinca o grubun malzemeleri de temizlenir
- Degisiklikler kaydet butonuyla PATCH edilir

### Urun-Malzeme haritasi:
```typescript
const PRODUCT_MATERIALS = {
  sticker: ["vinil", "transparan", "holo", "simli", "metalize"],
  rulo_etiket: ["kuse", "kraft", "beyaz_pp", "ultra_clear", "metalik"],
  tabaka_etiket: ["kuse", "kraft", "beyaz_pp"],
};
```

### Gorsellestirme:
- Secili urun grubu: koyu arka plan, check ikonu
- Secili malzeme: mercan chip
- Secilmemis malzeme: gri chip
- "Tumu" seciliyken tum chip'ler mercan

Bu alan sag sidebar'daki KAPASITE bolumunde gosterilsin. "Duzenle" modunda chip'ler tiklanabilir, normal modda sadece goruntuleme.

---

## YETKINLIK ONAYI BOLUMUNU KALDIR

Mevcut "YETKINLIK ONAYI" bolumunde her malzeme icin ayri "Onayla" butonu var. Bu gereksiz — admin zaten kapasite alaninda malzeme sec/kaldir yapiyor.

Bu bolumu tamamen KALDIR.

---

## ATANAN ISLER + ATANABILECEK SIPARISLER

Sol kolonda:

### Ust kisim: Filtreler
```
[Aktif (0)] [Tumu (0)] [Tamamlanan (0)] [Sorunlu (0)]
```

### Bos state:
```
Henuz atanan is yok. Asagidaki siparisleri bu partnere atayabilirsin.
```

### Atanabilecek siparisler (test haric):
Her satir:
```
250520269344 · Sefa Yakut · Sticker x 50 · 750 TL    [Ata]
250520265149 · Sefa Yakut · Sticker x 100 · 1.147 TL  [Ata]
```

"Ata" butonuna tiklaninca:
1. Partner sozlesmesiz ise → kirmizi uyari toast: "Sozlesme imzalanmadan atama yapilamaz"
2. Sozlesmeli ise → confirm modal: "Bu siparisi Etiketbox'a atamak istediginizden emin misiniz?"
3. Onay → API call → siparis "Partnere atandi" durumuna gecer

---

## PERFORMANS KARTI

Sag sidebar ust:
```
PERFORMANS
Aktif is:      0
Geciken:       0
Tamamlanan:    0
Ortalama skor: — (ilk 5 is tamamlaninca)
Tipik teslim:  5 gun
```

0 degerler gri, dolu degerler koyu. Skor hesaplaninca yildiz rating goster.

---

## KONTROL

Her fix sonrasi: `npx tsc --noEmit` + commit (`fix(admin):` prefix)

Test:
1. 2 kolonlu layout gorunuyor mu?
2. Tab'lar yok, sol'da isler, sag'da bilgiler
3. Kapasite: Sticker tikla → malzeme chip'leri acilsin
4. "Tumu" tikla → tum malzemeler secilsin
5. Yetkinlik onayi bolumu yok
6. Atanabilecek siparisler test haric
7. "Ata" butonu sozlesme kontrolu yapiyor
8. Performans karti sag ustte
