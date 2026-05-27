Auto-refund cron tam SLA kaskadini ekle + kalan 2 kozmetik fix. Emoji kullanma.

## FIX 1 — fn_process_proof_pending_sla tam versiyon

Supabase'de yeni migration olustur: `supabase/migrations/111_proof_sla_cascade.sql`

Fonksiyon su mantikla calissin:

1. proof_pending durumunda 12+ saat gecen siparisler -> action: 'reminder' (hatirlatma maili)
2. proof_pending durumunda 36+ saat gecen siparisler -> action: 'refund' (otomatik iptal + iade)

```sql
CREATE OR REPLACE FUNCTION fn_process_proof_pending_sla()
RETURNS TABLE(
  order_id TEXT,
  user_id UUID,
  hours_since_proof NUMERIC,
  action TEXT
) AS $$
BEGIN
  RETURN QUERY
  -- 36+ saat: iptal + iade
  SELECT
    o.id::TEXT,
    o.user_id,
    EXTRACT(EPOCH FROM (NOW() - o.updated_at)) / 3600.0,
    'refund'::TEXT
  FROM orders o
  WHERE o.status = 'proof_pending'
    AND o.updated_at < NOW() - INTERVAL '36 hours'
  UNION ALL
  -- 12-36 saat: hatirlatma
  SELECT
    o.id::TEXT,
    o.user_id,
    EXTRACT(EPOCH FROM (NOW() - o.updated_at)) / 3600.0,
    'reminder'::TEXT
  FROM orders o
  WHERE o.status = 'proof_pending'
    AND o.updated_at < NOW() - INTERVAL '12 hours'
    AND o.updated_at >= NOW() - INTERVAL '36 hours'
    AND NOT EXISTS (
      SELECT 1 FROM order_events e
      WHERE e.order_id = o.id
        AND e.event_type = 'proof_reminder_sent'
        AND e.created_at > NOW() - INTERVAL '24 hours'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Sonra `/api/cron/auto-refund/route.ts` dosyasini kontrol et — fonksiyondan donen action'a gore:
- `reminder` -> mail_outbox'a hatirlatma maili ekle + order_events'e 'proof_reminder_sent' yaz
- `refund` -> order status'u 'cancelled' yap + order_events'e 'auto_refund_sla' yaz + mail_outbox'a iptal bildirimi ekle

Cron'un mevcut kodunu oku ve bu mantiga uyarla. Eksik alanlar varsa ekle.

## FIX 2 — Top sehirler siralama (ciro DESC)

Dashboard'daki top sehirler listesi alfabe sirasinda. Ciro buyukten kucuge sirala.

Ilgili kodu bul (muhtemelen `src/app/admin/page.tsx` veya dashboard API) ve sort kriterini degistir:

```typescript
// Eski: alfabe veya adet sirasi
// Yeni: ciro DESC
cities.sort((a, b) => b.revenue - a.revenue);
```

## FIX 3 — AI Kontrol karti 0 sipariste sure gostermesin

Dashboard'da "AI KONTROL: 0 · 34.6sa" gorünuyor. 0 siparis varken ortalama sure anlamsiz.

```typescript
// 0 siparis ise sure yerine "—" goster
const displayDuration = count > 0 ? `${avgHours.toFixed(1)}sa` : "—";
```

## KONTROL

Her fix sonrasi: `npx tsc --noEmit` + commit
FIX 1 icin migration SQL'ini Supabase'de calistirmak gerekiyor — scripte yaz ve kullaniciya soyle.
