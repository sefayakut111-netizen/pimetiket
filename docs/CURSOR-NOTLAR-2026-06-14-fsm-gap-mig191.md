# Cursor Görevi — FSM 2 gap kapat (verify:fsm yakaladı)

> 14 Haz · Claude. Branch: `claude/file-review-updates-vnd6og`. **Push YOK** — Claude doğrulayacak. `npm run verify:fsm` 2 INVALID buldu; ikisi gerçek, kapatılıyor.

## 1) KOD FIX — `tracking/route.ts` `ready_to_ship→shipped` tutarsızlığı
**Dosya:** `storefront/src/app/api/admin/orders/[id]/tracking/route.ts`
**Sorun:** `ALLOWED_SHIP_FROM = ["in_production", "ready_to_ship"]` ama forward matris `ready_to_ship→shipped`'e izin vermez (yalnız `in_production→shipped`). `ready_to_ship` siparişte kargo no → transition `invalid_transition` → 400. Üretim sevkiyattan önce gelmeli; `ready_to_ship` guard'da olmamalı.
**Fix:** `ready_to_ship`'i çıkar:
```ts
const ALLOWED_SHIP_FROM: OrderStatus[] = ["in_production"];
```
(Geri kalan guard mantığı aynı — `shipped`/`delivered` idempotent atlama + `!shipResult.ok` kontrolü değişmez.)

## 2) MIGRATION — `192_fsm_forward_add_proof_pending_validating.sql` (YENİ)
> Dosya adı: en yüksek mevcut migration +1 (190'dan sonra; 191 kullanıldıysa 192). Sefa mevcut max'a göre numarala.
**Sorun:** orchestrator `runProofValidationAfterEdit` `from=['proof_pending','operator_review']→proof_validating` (forward). mig190 `operator_review→proof_validating` ekledi ama `proof_pending→proof_validating` forward'da yok (bulk'ta var). Müşteri prova düzenleme sonrası re-validation kırık.
**Fix:** forward matriste `proof_pending` dalına `proof_validating` ekle. `CREATE OR REPLACE` — mig190 gövdesiyle BİREBİR aynı, SADECE `proof_pending` satırı değişir:

```sql
-- Mig: forward matrise proof_pending->proof_validating ekle (orchestrator after-edit re-validation).
--   verify:fsm guard yakaladı. bulk'ta zaten vardı; forward'a hizalandı. Zincir tamam:
--   proof_pending->proof_validating->proof_generating(mig190)->proof_pending(mevcut).
CREATE OR REPLACE FUNCTION public.fn_is_valid_order_forward_transition(
  p_from public.order_status,
  p_to public.order_status
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_from = p_to THEN
    RETURN false;
  END IF;
  RETURN CASE p_from
    WHEN 'paid' THEN p_to IN ('qc_pending', 'awaiting_upload', 'cancelled')
    WHEN 'awaiting_upload' THEN p_to IN ('qc_pending', 'proof_pending', 'cancelled')
    WHEN 'qc_pending' THEN p_to IN (
      'proof_generating', 'human_review', 'qc_flagged',
      'ready_to_ship', 'human_review_failed', 'proof_pending', 'cancelled'
    )
    WHEN 'qc_flagged' THEN p_to IN (
      'human_review', 'ready_to_ship', 'proof_generating',
      'human_review_failed', 'proof_pending', 'cancelled'
    )
    WHEN 'human_review' THEN p_to IN (
      'proof_generating', 'human_review_failed', 'ready_to_ship', 'cancelled'
    )
    WHEN 'human_review_failed' THEN p_to IN (
      'qc_pending', 'ready_to_ship', 'proof_generating', 'cancelled'
    )
    WHEN 'proof_generating' THEN p_to IN (
      'proof_pending', 'human_review', 'operator_review'
    )
    -- proof_pending: + proof_validating (orchestrator after-edit). in_production/operator_review YOK (proof-respond legacy).
    WHEN 'proof_pending' THEN p_to IN ('proof_approved', 'proof_validating', 'cancelled')
    WHEN 'proof_validating' THEN p_to IN (
      'proof_pending', 'operator_review', 'proof_generating', 'cancelled'
    )
    WHEN 'proof_approved' THEN p_to IN ('ready_to_ship', 'operator_print_review')
    WHEN 'operator_review' THEN p_to IN (
      'proof_validating', 'proof_pending', 'cancelled'
    )
    WHEN 'operator_print_review' THEN p_to IN (
      'ready_to_ship', 'proof_generating', 'cancelled'
    )
    WHEN 'ready_to_ship' THEN p_to IN ('in_production', 'fason_assigned')
    WHEN 'fason_assigned' THEN p_to = 'in_production'
    WHEN 'in_production' THEN p_to = 'shipped'
    WHEN 'shipped' THEN p_to = 'delivered'
    WHEN 'delivered' THEN false
    WHEN 'cancelled' THEN false
    ELSE false
  END;
END;
$$;
```
Canlıya apply et. `fn_is_valid_order_bulk_transition` DEĞİŞMEZ.

## Doğrulama
1. Cursor: tracking fix + migration apply. `npm run verify:fsm` → **0 INVALID** olmalı (UNKNOWN admin_override kalır, sorun değil). `npm run build`. Commit (push yok).
2. Claude: canlı `fn_is_valid_order_forward_transition('proof_pending','proof_validating')=true` + `('ready_to_ship','shipped')` hâlâ false (değişmedi) + verify:fsm 0-INVALID çıktısı.

## DİKKAT
- ❌ `ready_to_ship→shipped`'i matrise EKLEME (üretim atlama) — tracking guard'ını daralt.
- ❌ proof_pending'e `in_production`/`operator_review` EKLEME (proof-respond legacy, mig190 kararı).
- ❌ bulk fonksiyona dokunma. ❌ Push etme.
