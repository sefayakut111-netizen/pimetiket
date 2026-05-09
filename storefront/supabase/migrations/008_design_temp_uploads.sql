-- ============================================================
-- Pim Etiket — Migration 008
--
-- Pre-purchase tasarım yükleme — müşteri konfigüre ederken sepete
-- eklemeden önce tasarım yükleyebilir, canlı mockup'ta görür.
--
-- Akış:
--   1. /sticker veya /etiket'te DesignDropZone'a dosya at
--   2. /api/design/temp-upload-init → signed URL (storage path:
--      temp/<userId>/<uuid>.<ext>)
--   3. Browser → Supabase Storage upload
--   4. /api/design/temp-upload-complete → design_temp_uploads INSERT
--   5. Cart item insert'inde design_temp_id reference tutulur
--   6. /api/payment/callback'te success'te → temp file rename edilir
--      (designs/<orderId>/<uuid>.<ext>) + design_files row açılır
--      (status=uploaded, AI check başlar)
--
-- Cleanup: 24 saat sonra promoted_to NULL olan temp upload'lar
-- silinir (cron + storage delete).
-- ============================================================

create table if not exists public.design_temp_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Storage path: temp/<userId>/<uuid>.<ext>
  storage_path text not null,
  original_name text not null,
  size_bytes bigint not null check (size_bytes > 0),
  mime_type text not null,
  sha256 text,
  -- Sipariş açıldıktan sonra design_files row'ına link
  promoted_to uuid references public.design_files(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
    default (now() + interval '24 hours')
);

create index if not exists design_temp_uploads_user_idx
  on public.design_temp_uploads(user_id, created_at desc);
create index if not exists design_temp_uploads_expires_idx
  on public.design_temp_uploads(expires_at)
  where promoted_to is null;
create index if not exists design_temp_uploads_path_idx
  on public.design_temp_uploads(storage_path);

alter table public.design_temp_uploads enable row level security;

-- Müşteri sadece kendi temp upload'larını görür
create policy "Users can view own temp uploads"
  on public.design_temp_uploads for select
  using (auth.uid() = user_id);

create policy "Users can create own temp uploads"
  on public.design_temp_uploads for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own pending temp uploads"
  on public.design_temp_uploads for delete
  using (auth.uid() = user_id and promoted_to is null);

-- ---------- cart_items: design_temp_id ekle ----------
-- Müşteri sticker/etiket konfigüre ederken yüklediği tasarımı bu cart
-- item'a bağlar. Order create'te promote edilir.
alter table public.cart_items
  add column if not exists design_temp_id uuid
    references public.design_temp_uploads(id) on delete set null;

create index if not exists cart_items_design_temp_idx
  on public.cart_items(design_temp_id)
  where design_temp_id is not null;

-- ---------- Storage RLS update — temp/ path support ----------
-- Mevcut policy (mig 006): kullanıcı sadece designs/<orderId>/<file>
-- pattern'ına yazabilir. Şimdi ek pattern: designs/temp/<userId>/<file>
-- (orderId yerine "temp" prefix + user klasörü).

-- INSERT: temp pattern için ayrı policy
drop policy if exists "Users can upload to own temp folder" on storage.objects;
create policy "Users can upload to own temp folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'designs'
    and (storage.foldername(name))[1] = 'temp'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- SELECT: kullanıcı kendi temp klasörünü okuyabilir
drop policy if exists "Users can read own temp uploads" on storage.objects;
create policy "Users can read own temp uploads"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'designs'
    and (storage.foldername(name))[1] = 'temp'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- DELETE: temp dosyayı kullanıcı silebilir (replace senaryosu)
drop policy if exists "Users can delete own temp uploads" on storage.objects;
create policy "Users can delete own temp uploads"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'designs'
    and (storage.foldername(name))[1] = 'temp'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- ---------- Cleanup helper (cron job için) ----------
-- 24 saat sonra promote edilmemiş temp upload'ları temizle.
-- Sefa pg_cron extension açtıktan sonra şu şekilde çağrılabilir:
--   select cron.schedule('cleanup-temp-designs', '0 3 * * *',
--     'select public.fn_cleanup_temp_designs()');
create or replace function public.fn_cleanup_temp_designs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_path text;
begin
  -- Storage cleanup uygulama tarafında yapılır (storage admin client gerekir).
  -- Burada sadece DB row'larını siliyoruz.
  -- TODO: Edge function veya cron worker'dan storage.deleteObject çağrı.
  for v_path in
    select storage_path from public.design_temp_uploads
    where promoted_to is null
      and expires_at < now()
  loop
    -- Storage'dan temizleme uygulama yapacak (NOTIFY veya cron)
    null;
  end loop;

  delete from public.design_temp_uploads
    where promoted_to is null
      and expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on table public.design_temp_uploads is
  'Pre-purchase tasarım upload staging — sepete eklemeden önce yüklenen dosyalar. 24h TTL, sipariş açılınca design_files row''a promote edilir.';
