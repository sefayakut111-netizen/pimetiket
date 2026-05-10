-- ============================================================
-- Pim Etiket — Migration 014: Prova Dosyaları
--
-- Operatör müşteri tasarımını hazırladıktan sonra prova dosyasını
-- (PDF/PNG) sisteme yükler. orders tablosuna 3 kolon eklenir.
-- ============================================================

alter table public.orders
  add column if not exists proof_storage_path text,
  add column if not exists proof_uploaded_at timestamp with time zone,
  add column if not exists proof_uploaded_by uuid references auth.users(id);

create index if not exists orders_proof_pending_idx
  on public.orders(status)
  where status = 'proof_pending';
