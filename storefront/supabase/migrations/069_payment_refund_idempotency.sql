-- ============================================================
-- Migration 069 — Refund idempotency guard
-- ============================================================
-- Sefa 20 May v68 (Agent denetim P0 #2):
-- QA agent: Müşteri /iade-talep + auto-refund cron paralel çalışırsa
-- 2 ayrı POST /api/payment/refund tetiklenir, ikisi de SELECT existing
-- check'inden geçer (race window) → PayTR'e ÇİFT refund call → çift
-- para iadesi → kayıp.
--
-- ÇÖZÜM: 2 katmanlı guard
--   1. Partial unique index — bir order için aynı anda max 1 aktif
--      refund kaydı (processing veya success).
--   2. Refund endpoint: PayTR call'dan ÖNCE INSERT placeholder
--      (status='processing') yap. Unique violation → 409 "already in
--      progress". PayTR call sadece insert başarılı ise yapılır.
--
-- 'processing' yeni status — payments tablosunda status text constraint
-- zaten varsa kabul eder (Mig 020 / sonraki). Eğer CHECK varsa
-- (success|failed|pending) 'processing' eklenmeli.
-- ============================================================

-- 1) payments.status check'i 'processing' ile genişlet (varsa)
do $$
begin
  if exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'payments_status_check'
  ) then
    alter table public.payments drop constraint payments_status_check;
  end if;
end$$;

alter table public.payments
  add constraint payments_status_check
  check (status in ('pending', 'processing', 'success', 'failed', 'cancelled'));

-- 2) Partial unique index — bir order için aktif refund max 1
--    (processing + success kombine sayılır)
drop index if exists payments_one_active_refund_per_order;
create unique index payments_one_active_refund_per_order
  on public.payments (order_id)
  where action in ('refund', 'partial_refund')
    and status in ('processing', 'success');

comment on index public.payments_one_active_refund_per_order is
  'Mig 069: Bir order için aynı anda max 1 aktif refund (processing veya success). PayTR çift refund call race condition''ını DB seviyesinde engeller. Failed refund yeniden denenebilir (bu indexte sayılmaz).';
