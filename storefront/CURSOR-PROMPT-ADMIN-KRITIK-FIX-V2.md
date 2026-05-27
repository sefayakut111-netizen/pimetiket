Admin paneli 3. kontrol raporu — hala açık kritik ve önemli sorunlar. Sırayla düzelt. Emoji kullanma, SVG ikon kullan.

---

## FIX 1 — Migration 110 DB'ye uygulanmamış (3 cron hatası)

Migration dosyası (`supabase/migrations/110_fix_missing_columns.sql`) oluşturuldu ama production Supabase'e uygulanmamış. Dosyayı kontrol et, yoksa oluştur ve içeriği doğrula:

```sql
-- 1a. fn_process_proof_pending_sla fonksiyonu
CREATE OR REPLACE FUNCTION fn_process_proof_pending_sla()
RETURNS TABLE(order_id TEXT, hours_since_proof NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT o.id::TEXT, EXTRACT(EPOCH FROM (NOW() - o.updated_at)) / 3600.0
  FROM orders o
  WHERE o.status = 'proof_pending'
    AND o.updated_at < NOW() - INTERVAL '36 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1b. design_files.created_at kolonu
ALTER TABLE design_files ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 1c. orders.paid_at kolonu
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
UPDATE orders SET paid_at = updated_at WHERE status NOT IN ('draft', 'pending') AND paid_at IS NULL;
```

Bu SQL'i Supabase Dashboard → SQL Editor'de çalıştır. Cron hataları bir sonraki tetiklemede düzelir.

Ayrıca cron'ların bu kolonları nasıl kullandığını kontrol et — eğer cron kodu `created_at` veya `paid_at` sorgularken farklı bir kolon adı kullanıyorsa düzelt.

---

## FIX 2 — Cron toplam sayısı tutarsızlığı (15 vs 16)

Dashboard cron özeti "12/15 · 3 hata" diyor ama listede 16 cron var.

`src/app/admin/page.tsx` veya cron monitoring bileşeninde toplam sayımı nasıl hesaplanıyor kontrol et. `vercel.json`'daki cron sayısını say ve özet sayısıyla eşleştir.

Muhtemelen bir cron listeye dahil edilmemiş veya exclude edilmiş. Toplam sayıyı `vercel.json`'daki gerçek cron sayısıyla eşitle.

---

## FIX 3 — AI QC dosyasız sipariş için guard

`src/app/admin/ai-qc/page.tsx` dosyasında:

Sipariş `qc_flagged` durumunda ama tasarım dosyası yoksa:
- Onayla butonu DISABLED olmalı (dosyasız onay anlamsız)
- "Tasarım dosyası bulunamadı — müşteriyle iletişime geç veya siparişi iptal et" uyarısı göster
- Reddet + İptal butonu aktif kalmalı

```typescript
// Kart render'ında:
const hasDesignFile = item.designFiles && item.designFiles.length > 0;

{!hasDesignFile && (
  <div className="rounded-lg bg-kirmizi-soft/30 border border-kirmizi/20 p-3 text-sm text-kirmizi mb-3">
    Tasarim dosyasi bulunamadi. Musteriye ulasip dosya yuklemesini isteyin veya siparisi iptal edin.
  </div>
)}

// Onayla butonu:
<Button disabled={!hasDesignFile} ...>Onayla</Button>
```

---

## FIX 4 — Sipariş badge sayım uyumsuzluğu (30 vs 32)

Sidebar'da "Siparisler 30", listede "32 siparis". Fark muhtemelen iptal edilen 2 siparis.

Cozum: Badge'de cancelled hariç sayiyi goster + tooltip ekle:

```typescript
// Badge hesaplamasinda:
const activeCount = orders.filter(o => o.status !== 'cancelled').length;

// Tooltip:
title={`${activeCount} aktif siparis (${totalCount - activeCount} iptal)`}
```

---

## FIX 5 — Prova sayfasi sure etiketi netlestir

Prova sayfasinda "Ort. surec: 6.5 gun" yaziyor ama ne olduğu belirsiz.

Cozum: Etiketi netlestir:
```
Eski: "Ort. surec: 6.5 gun"
Yeni: "Siparis → onay arasi ort.: 6.5 gun"
```

---

## FIX 6 — "Bugunku kargoya verilecek" sayim kontrolu

Dashboard'da "Bugün kargoya verilecek 1 ACIL" diyor ama uretimde 2 siparis var.

Filtreleme kriterini kontrol et — muhtemelen "tahmini teslim tarihi bugun" olan siparisler sayiliyor. Sayi dogru mu, kriter ne? Eger yanlissa duzelt, dogruysa kriteri aciklayan tooltip ekle.

---

## FIX 7 — Test verisini metriklerden filtrele

Top musteriler listesinde "Admin Test" ve "Test Musteri" gorunuyor. Bu test verisi prod metriklerini bozuyor.

Cozum: Dashboard metrik sorgularinda test siparislerini filtrele:

```typescript
// Test siparis/musteri filtreleme:
.filter(o => !o.customerName?.toLowerCase().includes('test'))
.filter(o => !o.id.includes('TEST'))
.filter(o => o.id !== '00000001')
```

Veya daha temiz: orders tablosunda `is_test` boolean kolonu ekle, test siparislerini isaretled ve metrik sorgularinda `WHERE is_test = false` filtresi kullan.

---

## KONTROL

Her fix sonrasi: `npx tsc --noEmit` + commit (`fix(admin):` prefix)

Test:
1. Cron monitoring: 16/16 veya hata sayisi dogru
2. AI QC: dosyasiz sipariste onayla disabled + uyari mesaji
3. Sidebar: siparis badge tutarli
4. Prova: sure etiketi net
5. Dashboard: test verisi metriklerden filtrelenmis
