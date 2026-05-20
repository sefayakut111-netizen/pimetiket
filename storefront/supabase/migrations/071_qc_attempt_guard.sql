-- ============================================================
-- Pim Etiket — Migration 071: QC Attempt Counter Guard (P1 #7)
--
-- Sefa 20 May v68 (8-agent denetim P1 #7):
-- Sonsuz döngü riski → runOrderDesignQC her tetiklendiğinde AI'a
-- gidiyor. Müşteri bozuk dosya yükleyip duruyorsa:
--   paid → human_review → reject → admin elle qc_pending →
--   re-upload → paid → AI yine "kotu" → human_review → reject ...
--
-- Fix: orders.qc_attempt_count integer kolonu, runOrderDesignQC
-- içinde 3'ten sonra AI atlanır, status = operator_review (insan
-- kuyruğuna düşer, admin elle karar verir).
--
-- Idempotent: kolon zaten varsa atla. Mevcut siparişlerde default
-- 0 — yeni döngü guard'ı çalışır.
-- ============================================================

alter table public.orders
  add column if not exists qc_attempt_count integer not null default 0;

comment on column public.orders.qc_attempt_count is
  'P1 #7 — runOrderDesignQC her çalışmada +1. 3''e ulaşırsa AI atlanır, '
  'sipariş operator_review''a escalate olur (sonsuz döngü guard).';

-- Mevcut human_review/human_review_failed siparişlerin attempt_count'unu
-- design_quality_checks tablosundan geriye sayalım. Her order için
-- benzersiz "run" sayısı = (distinct created_at saniye granül).
-- Daha basit: aynı dakikada kaç farklı QC run var, o sipariş için
-- attempt sayısı yaklaşık.
--
-- Sefa kuralı: kesinlik şart değil — guard yeni döngülere yarar.
-- Geriye dönük: mevcut human_review_failed = 1 attempt geçti varsay,
-- guard 2 deneme daha izin verir, sonra escalate.

update public.orders o
set qc_attempt_count = greatest(1, (
  select count(distinct date_trunc('minute', d.created_at))
  from public.design_quality_checks d
  where d.order_id = o.id
))
where o.status in ('human_review', 'human_review_failed', 'proof_generating')
  and o.qc_attempt_count = 0
  and exists (
    select 1 from public.design_quality_checks
    where order_id = o.id
  );

-- Index: counter'a göre filtreleme (admin dashboard "stuck loop" widget'ı için)
create index if not exists orders_qc_attempt_count_idx
  on public.orders(qc_attempt_count)
  where qc_attempt_count >= 2;
