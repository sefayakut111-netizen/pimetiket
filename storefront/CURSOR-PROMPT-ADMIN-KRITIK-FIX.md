Admin panelinde tespit edilen kritik ve önemli sorunlar. Sırayla düzelt. Bu session'da sadece Cursor kod yazıyor.

---

## FIX 1 — Eksik DB kolonları ve fonksiyonlar (3 cron hatası)

Yeni migration dosyası oluştur: `supabase/migrations/110_fix_missing_columns.sql`

### 1a. `fn_process_proof_pending_sla` fonksiyonu eksik
`auto-refund` cron'u bu fonksiyonu çağırıyor ama DB'de yok. Oluştur:

```sql
CREATE OR REPLACE FUNCTION fn_process_proof_pending_sla()
RETURNS TABLE(order_id TEXT, hours_since_proof NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, EXTRACT(EPOCH FROM (NOW() - o.updated_at)) / 3600.0
  FROM orders o
  WHERE o.status = 'proof_pending'
    AND o.updated_at < NOW() - INTERVAL '36 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 1b. `design_files.created_at` kolonu eksik
`cleanup-stale-uploads` cron'u bu kolonu kullanıyor. Ekle:

```sql
ALTER TABLE design_files ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
```

### 1c. `orders.paid_at` kolonu eksik
`upload-reminders` cron'u bu kolonu kullanıyor. Ekle:

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Mevcut paid siparişler için backfill (created_at'ten)
UPDATE orders SET paid_at = updated_at
WHERE status NOT IN ('draft', 'pending') AND paid_at IS NULL;
```

Migration'ı Supabase SQL Editor'de çalıştır veya `supabase db push` ile uygula.
Sonra: `npx tsc --noEmit` + commit.

---

## FIX 2 — Sidebar badge sayım uyumsuzlukları

### 2a. Siparişler badge'i
`src/components/layout/AdminShell.tsx` veya sidebar bileşeninde "Siparişler" badge sayısını bul. İptal edilmişler dahil mi hariç mi tutarsız.

Çözüm: Badge'i sipariş listesiyle aynı kaynaktan hesapla — `cancelled` hariç aktif sipariş sayısı.

### 2b. Üretim Partnerleri badge'i
Badge "4" gösteriyor ama sayfada "1 ortak" var. Badge muhtemelen `partner_contacts` veya `fason_partners` sayısı — ama sayfa sadece aktif partnerleri gösteriyor.

Çözüm: Badge'i sayfa ile aynı filtreden hesapla — `is_active = true` olan partner sayısı.

---

## FIX 3 — Status enum Türkçeleştirme (admin tarafı)

Admin sipariş listesinde ve AI QC sayfasında teknik enum'lar görünüyor: `qc_flagged`, `ready_to_ship`, `human_review_failed`, `proof_generating`.

Müşteri tarafında `getCustomerStatusInfo()` var (`src/lib/customer-status.ts`). Admin tarafı için de benzer mapping oluştur veya mevcut olanı kullan:

```typescript
const ADMIN_STATUS_LABELS: Record<string, string> = {
  paid: "Ödendi",
  awaiting_upload: "Tasarım bekleniyor",
  qc_pending: "AI kontrol bekliyor",
  qc_flagged: "AI uyarı verdi",
  human_review: "Operatör inceliyor",
  human_review_failed: "Operatör reddetti",
  operator_review: "Operatör kuyruğunda",
  proof_generating: "Bıçak hazırlanıyor",
  proof_pending: "Müşteri onayı bekliyor",
  proof_validating: "Prova kontrol ediliyor",
  proof_approved: "Prova onaylandı",
  ready_to_ship: "Üretime hazır",
  fason_assigned: "Partnere atandı",
  in_production: "Üretimde",
  shipped: "Kargoda",
  delivered: "Teslim edildi",
  cancelled: "İptal edildi",
};
```

Bu mapping'i admin sipariş listesi, AI QC kuyruğu ve dashboard'da kullan. Teknik enum asla kullanıcıya gösterilmesin.

---

## FIX 4 — Dashboard uyarı çiftleşmesi

`src/app/admin/page.tsx` dosyasında üst kısımda sarı uyarı banner'ları + altta "Bugün ne yapmalıyım?" kartı aynı bilgiyi tekrar ediyor:
- "3 müşteriden 48 saatten fazla prova yanıtı yok" ↔ "36+ saattir prova yanıtı yok 3 ACİL"
- "4 sipariş üretime hazır ama partnere atanmadı" ↔ "Partnere atanacak 4"

Çözüm: Üstteki sarı uyarı banner'larını KALDIR. Sadece "Bugün ne yapmalıyım?" kartı kalsın — orada zaten aynı bilgi var. Banner'lar gereksiz tekrar.

---

## FIX 5 — Prova süre etiketleri netleştir

Dashboard'da "Prova yanıt süresi: 1.9 gün" — bu prova oluşturulduktan sonraki bekleme süresi.
Prova sayfasında "Ort. süreç: 6.5 gün" — bu sipariş açıldıktan sonraki toplam süre.

İkisi farklı metrik ama aynı gibi okunuyor.

Çözüm: Etiketleri netleştir:
- Dashboard: "Prova bekleme: 1.9 gün" (prova oluşturulduktan sonra müşteri yanıt süresi)
- Prova sayfası: "Sipariş → onay toplam: 6.5 gün" (sipariş açılışından prova onayına)

---

## FIX 6 — "Bugün ne yapmalıyım" rozeti açıklama

Kartta sağ üstte "9" rozeti var ama ne olduğu belirsiz.

Çözüm: Rozetin yanına "bekleyen iş" veya tooltip ekle:
```tsx
<span title="Toplam bekleyen aksiyon sayısı">9 bekleyen</span>
```

---

## FIX 7 — Cron hata sayısı düzelt

Dashboard "Cron 14/16 · 2 hata" diyor ama gerçekte 3 hata var.

Çözüm: Cron monitoring endpoint'ini kontrol et — hata sayısını doğru hesapla. Son 24 saatteki başarısız cron'ları say.

---

## KONTROL

Her fix sonrası: `npx tsc --noEmit` + commit (`fix(admin):` prefix)

Test:
1. Dashboard açılıyor, uyarı çiftleşmesi yok
2. Sidebar badge'leri sayfa listeleriyle tutarlı
3. Status enum'lar Türkçe gösteriliyor
4. Cron hata sayısı doğru
5. Prova süre etiketleri net
