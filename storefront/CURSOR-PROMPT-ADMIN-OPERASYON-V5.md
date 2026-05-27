Admin paneli 7. kontrol — kalan 8 fix. Emoji kullanma. Bu session'da sadece Cursor kod yaziyor.

---

## FIX 1 — Iptal orani karti kirmizi alarm

Dashboard iptal orani %19 ama diger KPI'larla ayni renkte. Hedef %5 asildiysa kart belirgin olmali.

```typescript
const isOverTarget = cancelRate > 5;

// Kart wrapper:
className={isOverTarget ? "ring-2 ring-kirmizi bg-kirmizi-soft/10" : ""}
```

Ayrica karta tiklaninca `/admin/siparisler?status=cancelled` filtresine gitsin (drill-down).

---

## FIX 2 — Prova iptal orani Dashboard'a ekle

Prova sayfasinda "3 onay / 3 iptal" var ama Dashboard'da bu metrik yok. Dashboard'a yeni KPI ekle:

```
PROVA IPTAL ORANI: %50 (3/6)
```

Hesap: prova akisindaki toplam siparislerden iptal edilenlerin orani. Son 30 gun bazli.

Eger oran %30'u asiyorsa kirmizi uyari goster.

---

## FIX 3 — SLA bekleme suresi saat olarak goster

Dashboard "36+ saattir prova yaniti yok: 2" diyor ama gercek bekleme 120 saat.

Her SLA asimli siparis icin gercek bekleme suresini goster:

```
Eski: "36+ saattir prova yaniti yok · 2"
Yeni: "Prova yaniti yok · 2 siparis (en eski: 5 gun)"
```

Prova sayfasindaki SLA kartlarinda da her siparis icin gercek bekleme suresi yazsin:
```
Eski: "SLA ASILDI"
Yeni: "SLA ASILDI · 120 saat (5 gun)"
```

---

## FIX 4 — Manuel siparis 0 TL guard

`/admin/siparis-ekle` sayfasinda toplam 0 TL iken "Olustur" butonu aktif olmamali.

```typescript
const canCreate = totalAmount > 0 && items.length > 0;

<Button disabled={!canCreate}>
  Olustur ve detaya git
</Button>

{totalAmount === 0 && items.length > 0 && (
  <p className="text-sm text-kirmizi mt-2">Birim fiyat girilmeden siparis olusturulamaz.</p>
)}
```

---

## FIX 5 — Prova "Uretime al" partner kontrolu

`/admin/prova` sayfasinda "Uretime al" butonu partner atanmadan da aktif. Tiklaninca siparis "Uretime hazir" olur ama partner atanamaz — kilit.

Butona partner kontrolu ekle:

```typescript
const hasActivePartner = partnerCount > 0 && hasContractedPartner;

// Butonda:
{!hasActivePartner ? (
  <Button disabled title="Sozlesmeli partner yok — once partner sozlesmesi tamamlanmali">
    Uretime al (partner yok)
  </Button>
) : (
  <Button onClick={handleMoveToProduction}>Uretime al</Button>
)}
```

Veya daha basit: butona tikladiginda partner yoksa toast uyarisi goster ve durumu degistirme.

---

## FIX 6 — Uretim akisi bos adimlari sadelestir

Dashboard uretim akisi kartinda 4 adim "—" gosteriyor (URETIME HAZIR / URETIMDE / KARGODA / TESLIM). Hepsi bos — tekrarliyor.

0 siparisi olan ardisik adimlar icin tek satir ozet goster:

```
Eski:
  URETIME HAZIR: 2 · —
  URETIMDE: 1 · —
  KARGODA: 0 · —
  TESLIM: 0 · —

Yeni:
  URETIME HAZIR: 2
  URETIMDE: 1
  Kargoda ve teslim: henuz siparis yok
```

Veya: 0 siparis + sure "—" olan adimi gizle, sadece dolu olanları goster.

---

## FIX 7 — Partner kartina sozlesme aksiyonu

`/admin/fason` sayfasinda partner karti "Sozlesmesiz" uyarisi gosteriyor ama aksiyon yok.

Karta buton ekle:

```tsx
{!partner.contractSignedAt && (
  <div className="mt-3 flex gap-2">
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        // contract_signed_at = now() olarak guncelle
        // VEYA PDF upload modal ac
      }}
    >
      Sozlesme imzalandi olarak isaretle
    </Button>
    <Button
      variant="ghost"
      size="sm"
      href={`mailto:${partner.email}?subject=KVKK Veri Isleyici Sozlesmesi`}
    >
      Sozlesme talep et (e-posta)
    </Button>
  </div>
)}
```

"Sozlesme imzalandi" butonu `fason_partners.contract_signed_at` kolonunu NOW() ile doldurur. Admin panelden hizli islem.

API: `PATCH /api/admin/fason/partners/[id]` body: `{ contractSignedAt: new Date().toISOString() }`

---

## FIX 8 — Hatirlat butonu log/gecmis

`/admin/prova` sayfasindaki siparis kartlarinda "Hatırlat" butonu var ama:
- Daha once kac kere hatirlatildi gorulmüyor
- Son hatirlatma ne zaman bilinmiyor

Siparis kartina hatirlama logunu ekle:

```tsx
{lastReminderAt && (
  <span className="text-xs text-gri-500">
    Son hatirlatma: {formatRelativeTime(lastReminderAt)}
  </span>
)}
```

Hatirlatma gonderildiginde `order_events` tablosuna `proof_reminder_sent` event'i yaziliyor (FIX 1 migration 111'de eklendi). Bu event'leri sorgula ve kartda goster.

Ayrica: Ayni siparis icin 24 saat icinde birden fazla hatirlatma engelle (spam koruma).

---

## KONTROL

Her fix sonrasi: `npx tsc --noEmit` + commit (`fix(admin):` prefix)
