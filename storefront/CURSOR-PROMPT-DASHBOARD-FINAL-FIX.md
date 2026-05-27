Dashboard son analiz — 8 fix. Emoji kullanma. Bu session'da sadece Cursor kod yaziyor.

---

## FIX 1 — Ciro rakamlarini tek kaynaktan hesapla (KRITIK)

3 ekranda 3 farkli ciro:
- Dashboard 7g: 30.036 TL (13 siparis)
- Finans bu ay: 64.559 TL (27 siparis)
- Odemeler: 34.541 TL (14 islem)

Sorun: Her sayfa farkli sorgu/filtre kullaniyor (test dahil/haric, donem, tablo).

Cozum: Tek helper fonksiyon olustur ve 3 sayfa da onu kullansin:

```typescript
// src/lib/admin/revenue-stats.ts
export async function getRevenueStats(admin, options: {
  period: "today" | "7d" | "30d" | "month" | "all";
  excludeTest?: boolean;
}) {
  // payment_intents (status=consumed) + orders JOIN
  // excludeTest = true ise test siparisleri haric
  // Ayni sorgu, ayni filtre, ayni sonuc
  return {
    totalRevenue,    // tahsil edilen (payment_intents consumed)
    orderTotal,      // siparis tutari (orders SUM)
    orderCount,
    paymentCount,
    cancelledAmount,
    difference,      // siparis - tahsilat farki
  };
}
```

Dashboard, Finans ve Odemeler bu helper'i kullansin. Donem parametresi farkli olabilir ama ayni donemde ayni rakam cikmali.

---

## FIX 2 — Dashboard AI kuyrugu gercek durumu yansitsin

Dashboard "AI / OPERATOR KUYRUGU: 0 — kuyruk temiz" diyor ama Tasarimlar'da 18 dosya "AI isliyor" stuck.

Kontrol et: Dashboard AI kuyrugu nereden hesaplaniyor?
- Eger `orders.status = 'qc_pending'` sayiyorsa → dosya bazli degil siparis bazli, yanlis
- `design_files.status = 'analyzing'` sayisi da gosterilmeli

Cozum:
```typescript
const aiQueueCount = orders.filter(o => o.status === 'qc_pending' || o.status === 'qc_flagged').length;
const stuckDesignCount = designFiles.filter(f => f.status === 'analyzing' && ageHours > 1).length;

// Gosterim:
if (stuckDesignCount > 0) {
  return `${aiQueueCount} siparis + ${stuckDesignCount} takili dosya`;
}
```

---

## FIX 3 — Iptal ve teslimat acil banner

Iptal %19 ve "0 teslimat" dashboard'da kucuk KPI kartlarinda gizli. Bunlar en ustte kirmizi banner olmali.

Dashboard'in en ustune (cron/mail/DB bandinin altina) acil uyari ekle:

```tsx
{cancelRate > 10 && (
  <div className="rounded-lg bg-kirmizi-soft/30 border border-kirmizi/30 p-3 flex items-center gap-3">
    <span className="w-2 h-2 rounded-full bg-kirmizi shrink-0" />
    <span className="text-sm font-semibold text-kirmizi">
      Iptal orani %{cancelRate} — hedefin {(cancelRate/5).toFixed(1)}x ustunde.
      {deliveredCount === 0 && " Henuz hic teslimat yapilmadi."}
    </span>
    <Link href="/admin/siparisler?status=cancelled" className="text-xs text-kirmizi underline ml-auto">
      Iptal listesi
    </Link>
  </div>
)}
```

Prova iptal orani %50 icin de ayni mantik:
```tsx
{proofCancelRate > 30 && (
  <div className="rounded-lg bg-sari-soft/30 border border-sari/30 p-3 text-sm">
    Prova iptal orani %{proofCancelRate} (hedef <%30) — musteri prova asamasinda kaybiyor.
  </div>
)}
```

---

## FIX 4 — "5 bekleyen" rozeti aciklama

Header'da "5 bekleyen" rozeti var ama liste 3 satir gosteriyor (Prova 2 + Partner 2 + Kargo 1 = 5 item, 3 kategori).

Rozeti netlestir:
```
Eski: "5 bekleyen"
Yeni: "3 gorev (5 siparis)"
```

Veya tooltip ekle: "3 kategoride toplam 5 siparis aksiyon bekliyor"

---

## FIX 5 — DB health check iyilestir

"DB: ✓" gosteriyor ama musteriler sayfasi patlak. Sadece connection check degil, kritik endpoint'leri de kontrol et:

```typescript
const dbHealth = {
  connection: true,  // mevcut
  customersApi: await fetch("/api/admin/customers").then(r => r.ok).catch(() => false),
  ordersApi: await fetch("/api/admin/orders?limit=1").then(r => r.ok).catch(() => false),
};

// Gosterim:
if (!dbHealth.customersApi || !dbHealth.ordersApi) {
  return "DB: ! API hatasi"; // sari uyari
}
return "DB: ✓";
```

Veya basitce: DB ✓ yerine "DB: ✓ · API: ✓" iki ayri gosterge.

---

## FIX 6 — Yogunluk haritasi + grafik timezone tutarliligi

Siparis sayisi grafigi ve yogunluk haritasi farkli timezone kullanabilir (UTC vs Europe/Istanbul).

Her iki grafikte de ayni timezone kullan:
```typescript
// Tum tarih gruplama islemlerinde:
const tz = "Europe/Istanbul";
const localDate = new Date(order.created_at).toLocaleString("tr-TR", { timeZone: tz });
```

---

## FIX 7 — Acil rozeti tutarli kriter

"Prova yaniti yok" = ACIL rozeti var
"Partnere atanacak" = rozet YOK
"Bugun kargoya" = ACIL rozeti var

Tutarli kural: SLA asildiysa ACIL, asilmadiysa normal. Veya hepsine ACIL ver:

```typescript
const isUrgent = item.count > 0; // hepsi acil — bekleyen is var
```

---

## FIX 8 — Calismayan CTA'lari gizle

Dashboard kisa yol butonlarindan:
- "Yorum onayi: Bekleyen review" → 0 bekleyen yorum var, CTA bos
- "Kupon ekle" → kupon checkout'ta calismadigi icin anlamsiz

0 bekleyen yorum varsa CTA gizle:
```typescript
{pendingReviews > 0 && <QuickActionButton label="Yorum onayi" ... />}
```

Kupon CTA'si icin: kupon sistemi checkout'a entegre edilene kadar disable veya gizle.

---

## KONTROL

Her fix sonrasi: `npx tsc --noEmit` + commit (`fix(admin):` prefix)

Test:
1. Dashboard ciro = Finans ciro = Odemeler ciro (ayni donemde)
2. AI kuyrugu gercek stuck dosyalari gosteriyor
3. Iptal %19 + 0 teslimat ustte kirmizi banner
4. "5 bekleyen" rozeti acik
5. DB health API kontrolu yapiyor
6. Yogunluk haritasi TR timezone
7. Acil rozeti tutarli
8. Calismayan CTA'lar gizli
