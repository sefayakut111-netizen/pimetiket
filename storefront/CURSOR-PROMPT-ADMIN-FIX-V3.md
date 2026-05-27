Admin paneli 4. kontrol raporu — kalan sorunlar. Emoji kullanma. Bu session'da sadece Cursor kod yaziyor.

---

## FIX 1 — Siparisler listesine de test filtresi uygula

Dashboard test verisini filtreliyor ama `/admin/siparisler` sayfasi hala 32 siparis gosteriyor (test dahil). Dashboard ile ayni filtre kurali uygulanmali.

`src/app/admin/siparisler/page.tsx` dosyasinda siparis listesi sorgusunda `admin-order-filters.ts`'deki test filtre fonksiyonunu kullan. Dashboard'da nasil filtreleniyorsa ayni sekilde.

Alternatif: Sayfa ustune "Test siparislerini goster" toggle ekle (varsayilan kapali). Toggle acikken tum siparisler, kapaliyken test haric gosterilsin.

Ayni filtreyi su sayfalara da uygula:
- `/admin/ai-qc/page.tsx` — AI QC kuyrugu
- `/admin/prova/page.tsx` — Prova listesi

Boylece Dashboard (14 siparis) ↔ Siparisler (14 siparis) tutarli olur.

---

## FIX 2 — Prova "36+ saat" sayimi filtreli olmali

Dashboard "36+ saattir prova yaniti yok: 3 ACIL" diyor ama "PROVA BEKLEYEN: 2". 3 > 2 tutarsizlik.

Sebep: "36+ saat" sayimi test siparislerini dahil ediyor (ornegin 00000001). Ayni test filtresini prova SLA sayimina da uygula.

Dashboard'daki SLA hesaplama kodunu bul ve test siparis filtresini ekle.

---

## FIX 3 — Sadakat KPI minimum esik

"Musterilerin %100'i tekrar siparis verdi" yaniltici — sistemde 1 aktif musteri var.

Cozum: Minimum musteri esigi ekle. 5'ten az musteride yuzde gosterme:

```typescript
if (uniqueCustomerCount < 5) {
  return "Yeterli veri yok (min. 5 musteri)";
}
```

Ayni mantigi diger "otomatik icgoru" metriklerine de uygula — orneklem 5'ten azsa yuzde/trend gosterme.

---

## FIX 4 — Iptal orani alarm rengi

Iptal orani %13, hedef <%5. Ama gorsel alarm yok.

Cozum: Iptal orani hedefi astiginda belirgin uyari goster:

```typescript
const cancelRate = ...;
const TARGET = 5;
const isOver = cancelRate > TARGET;

// Kart rengi:
className={isOver ? "text-kirmizi bg-kirmizi-soft/20 ring-kirmizi/30" : "text-yesil"}

// Ek metin:
{isOver && (
  <span className="text-xs font-semibold text-kirmizi">
    Hedefin {(cancelRate / TARGET).toFixed(1)}x ustunde
  </span>
)}
```

---

## KONTROL

Her fix sonrasi: `npx tsc --noEmit` + commit (`fix(admin):` prefix)

Test:
1. Siparisler listesi: test siparisleri filtrelenmis, Dashboard ile ayni sayi
2. Prova SLA: "36+ saat" sayisi "Prova bekleyen" sayisindan buyuk olmamali
3. Sadakat KPI: 5'ten az musteride "Yeterli veri yok" gosteriyor
4. Iptal orani: %5 ustunde kirmizi uyari
