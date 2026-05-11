-- ============================================================
-- Pim Etiket — Migration 026: Tasarım Dosyası Saklama & Storage Hibrit
--
-- Sefa iş kuralı:
--   Tasarım dosyaları min 24 ay saklanır. Tekrar baskı (reorder) gelirse
--   son siparişten itibaren 24 ay daha uzar (rolling window).
--   Tasarım dosyası iş sürekliliğinin temeli — müşteri "geçen yıl
--   bastığım etiketten 5000 daha" diyebilmeli.
--
-- KVKK uyumu:
--   m.5/2-c "sözleşmenin ifası" gerekçesi (devamı için zorunlu)
--   m.4 orantılılık — "müşteri talep edebilir" net iş gerekçesi
--
-- Eklenenler:
--   - storage_provider enum ('supabase' | 'r2') — gelecek cold storage için
--   - archived_at, archive_path — R2'ye taşıma sonrası
--   - last_used_at — son baskı/atama zamanı (reorder her güncellenir)
--   - deletion_due_at — silme zamanı (24 ay + her reorder ile uzar)
--   - checksum_verified — R2 taşıma sonrası doğrulama
--   - reorder_count — pazarlama/CRM için
--
-- Yeni:
--   - fn_renew_design_retention(order_id) — reorder geldiğinde çağrılır
--   - 2 partial index — cold storage + silme cron filtre'i
-- ============================================================

-- ---------- storage_provider enum ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'storage_provider') then
    create type public.storage_provider as enum ('supabase', 'r2');
  end if;
end$$;

-- ---------- design_files alanları ----------
alter table public.design_files
  add column if not exists storage_provider public.storage_provider
    not null default 'supabase',
  add column if not exists archived_at timestamptz,
  add column if not exists archive_path text,
  add column if not exists checksum_verified boolean,
  add column if not exists last_used_at timestamptz default now(),
  add column if not exists deletion_due_at timestamptz,
  add column if not exists reorder_count integer not null default 0;

-- last_used_at + deletion_due_at backfill — mevcut dosyalar için
-- uploaded_at baz alınır; deletion_due_at = uploaded_at + 24 ay
update public.design_files
  set last_used_at = coalesce(last_used_at, uploaded_at),
      deletion_due_at = coalesce(deletion_due_at, uploaded_at + interval '24 months')
  where last_used_at is null or deletion_due_at is null;

-- ---------- Partial index: cold storage migration cron filter ----------
-- "approved + supabase + son kullanım 12+ ay önce" — R2'ye aday
create index if not exists design_files_cold_candidate_idx
  on public.design_files(last_used_at)
  where status = 'approved'
    and storage_provider = 'supabase'
    and archived_at is null;

-- ---------- Partial index: KVKK silme cron filter ----------
create index if not exists design_files_deletion_due_idx
  on public.design_files(deletion_due_at)
  where deletion_due_at is not null;

-- ---------- fn_renew_design_retention ----------
-- Müşteri tekrar baskı (reorder) yaptığında çağrılır. Bu order'a ait
-- aktif design_files satırlarının last_used_at + deletion_due_at
-- alanlarını güncelle, reorder_count artır.
--
-- Mantık:
--   - Yeni siparişten 24 ay sonra silme zamanı (rolling window)
--   - reorder_count++
--
-- Çağrı yerleri:
--   - Customer reorder akışı (sepete ekleme + sipariş tamamlanınca)
--   - Admin manuel sipariş (tekrar baskı niyetiyle)
create or replace function public.fn_renew_design_retention(
  p_source_order_id text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  -- Sadece henüz silinmemiş ve r2'ye taşınmamış aktif dosyaları yenile
  -- (R2'deki dosyalar için ayrı "uyandır" mekaniği gelecek)
  update public.design_files
    set last_used_at = now(),
        deletion_due_at = now() + interval '24 months',
        reorder_count = reorder_count + 1,
        updated_at = now()
    where order_id = p_source_order_id
      and status = 'approved'
      and archived_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.fn_renew_design_retention(text)
  from public, authenticated;
grant execute on function public.fn_renew_design_retention(text)
  to service_role;

-- ---------- fn_purge_expired_designs ----------
-- Daily cron — deletion_due_at geçmiş dosyaları "soft-delete" işaretle.
-- Asıl Storage delete cron'ın 2. fazında ayrı yapılır (audit izi için
-- önce kayıt soft-delete kalır, 30 gün sonra Storage'dan hard delete).
create or replace function public.fn_purge_expired_designs()
returns table(
  design_id uuid,
  order_id text,
  user_id uuid,
  storage_path text,
  was_archived boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.design_files
    set status = 'superseded',   -- soft-delete; status enum'a 'expired' eklemek migration daha gerek
        updated_at = now()
    where deletion_due_at < now()
      and status not in ('superseded')
    returning
      id, design_files.order_id, design_files.user_id,
      design_files.storage_path, archived_at is not null;
end;
$$;

revoke execute on function public.fn_purge_expired_designs()
  from public, authenticated;
grant execute on function public.fn_purge_expired_designs()
  to service_role;

-- ============================================================
-- Migration 026 sonu
-- ============================================================
