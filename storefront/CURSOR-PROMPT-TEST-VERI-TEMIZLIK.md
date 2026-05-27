Production veritabanindan test/eski format siparis verilerini temizle. Emoji kullanma.

## ADIM 1 — Test siparislerini tespit et

Supabase'den su siparisleri bul:
- ID'si `00000001` olan
- ID'si `PE-2026-TEST` ile baslayan (PE-2026-TEST5 gibi)
- Musteri adi "Admin Test" veya "Test Musteri" olan siparisler
- ID formati eski format olan (8 haneli sayi: 00000001, 00000002 gibi)

SQL:
```sql
SELECT id, status, created_at,
  (SELECT display_name FROM profiles WHERE profiles.id = orders.user_id) as customer
FROM orders
WHERE id = '00000001'
   OR id LIKE 'PE-2026-TEST%'
   OR user_id IN (
     SELECT id FROM profiles
     WHERE display_name ILIKE '%test%'
       OR display_name ILIKE '%admin test%'
   )
ORDER BY created_at;
```

## ADIM 2 — Repair script olustur

`scripts/dev/cleanup-test-orders.mjs` olustur:

```javascript
// Test siparislerini cancelled yapip iliskili verileri temizle
// DIKKAT: Production'da calistirmadan once listeyi Sefa'ya onayla

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // 1. Test siparisleri bul
  const { data: testOrders } = await supabase
    .from("orders")
    .select("id, status, user_id, created_at")
    .or("id.eq.00000001,id.like.PE-2026-TEST%");

  console.log("Test siparisleri:", testOrders?.length ?? 0);
  testOrders?.forEach(o => console.log(`  ${o.id} — ${o.status} — ${o.created_at}`));

  if (!testOrders || testOrders.length === 0) {
    console.log("Temizlenecek siparis yok.");
    return;
  }

  // 2. Siparisleri cancelled yap
  const ids = testOrders.map(o => o.id);
  for (const id of ids) {
    // order_items
    await supabase.from("order_items").delete().eq("order_id", id);
    // design_files
    await supabase.from("design_files").delete().eq("order_id", id);
    // cutline_designs — order_item_id uzerinden
    // order_events
    await supabase.from("order_events").delete().eq("order_id", id);
    // order_assignments
    await supabase.from("order_assignments").delete().eq("order_id", id);
    // siparisin kendisi
    await supabase.from("orders").delete().eq("id", id);

    console.log(`SILINDI: ${id}`);
  }

  console.log(`Toplam ${ids.length} test siparisi silindi.`);
}

main().catch(console.error);
```

## ADIM 3 — Scripti calistir

```bash
cd pim-etiket/core/storefront
node scripts/dev/cleanup-test-orders.mjs
```

Calistirmadan once listeyi konsola yazdir, Sefa'ya onayla. Onay sonrasi sil.

## ADIM 4 — Eski ID formatli siparisleri de kontrol et

Eski format ID'ler (270520268437 gibi 12 haneli sayi) gercek siparis olabilir — bunlari SILME. Sadece `00000001` ve `PE-2026-TEST*` tipindeki acik test verilerini temizle.

`npx tsc --noEmit` + commit (`chore(cleanup):` prefix).
