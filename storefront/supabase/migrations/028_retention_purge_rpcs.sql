-- ============================================================
-- Pim Etiket — Migration 028: Saklama Süresi Sonu Otomasyon RPC'leri
--
-- Daily cron (/api/cron/purge-expired-designs) tarafından çağrılır.
-- KVKK m.4 (orantılılık) + Yönetmelik m.5/2 (periyodik imha) gereği.
--
-- 3 RPC:
--   1. fn_mark_expired_designs_for_deletion()
--      → deletion_due_at geçmiş ve henüz silinmemiş dosyaları işaretle.
--      Asıl Storage delete cron'un Node-side ikinci aşamasında yapılır
--      (audit izi için). Bu RPC sadece soft-delete işaretler.
--
--   2. fn_anonymize_old_pim_conversations()
--      → 6 aydan eski pim_conversations satırlarının PII'sini kaldır.
--      pim_conversations tablosu HENÜZ oluşturulmadı (Sefa kararı:
--      localStorage yeter, WAU > 200 olunca DB'ye geç). Bu RPC stub
--      olarak yer tutar — tablo gelince çalışır hale gelir.
--
--   3. fn_purge_legal_expired_orders()
--      → 10 yılı aşmış sipariş kayıtlarını siler (VUK + TTK sonu).
--      Şu an gerçek silme yapmaz, sadece adayları sayar (alarm).
--      İlk gerçek silme 2036 sonrası — uzak gelecek. Cron çalışsın,
--      kayıt birikmesin.
--
-- Tüm RPC'ler service_role-only.
-- ============================================================

-- ---------- 1) fn_mark_expired_designs_for_deletion ----------
create or replace function public.fn_mark_expired_designs_for_deletion()
returns table(
  design_id uuid,
  order_id text,
  user_id uuid,
  storage_path text,
  deletion_due_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sadece 'approved' veya 'qc_passed' status'undeki dosyalar için.
  -- 'superseded' zaten eski versiyon, 'uploaded' aktif iş — bunlara
  -- dokunma.
  return query
  update public.design_files df
    set status = 'superseded',
        updated_at = now()
    where df.deletion_due_at is not null
      and df.deletion_due_at < now()
      and df.status in ('approved', 'qc_passed', 'qc_warned')
      and df.archived_at is null      -- R2'ye taşınmadıysa
    returning df.id, df.order_id, df.user_id, df.storage_path, df.deletion_due_at;
end;
$$;

revoke execute on function public.fn_mark_expired_designs_for_deletion()
  from public, authenticated;
grant execute on function public.fn_mark_expired_designs_for_deletion()
  to service_role;

-- ---------- 2) fn_anonymize_old_pim_conversations (STUB) ----------
-- pim_conversations tablosu henüz yok. Bu RPC tablo gelince çalışsın
-- diye yer tutar. IF EXISTS guard ile tablo yokken sessizce 0 döner.
create or replace function public.fn_anonymize_old_pim_conversations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_exists boolean;
begin
  -- Tablo var mı kontrolü
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'pim_conversations'
  ) into v_exists;

  if not v_exists then
    return 0;
  end if;

  -- Pim sohbeti 6 aydan eskiyse anonimleştir
  -- 1) user_id NULL
  -- 2) Mesaj içerikteki email/telefon regex maskele (basit)
  --
  -- NOT: Bu STUB. Tablo gelince content alanı regex ile maskelenmeli.
  -- Şu an sadece user_id NULL'a düşürür (KVKK m.28/1-b kısmen).
  execute format(
    'update public.pim_conversations
       set user_id = null
     where created_at < now() - interval ''6 months''
       and user_id is not null'
  );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.fn_anonymize_old_pim_conversations()
  from public, authenticated;
grant execute on function public.fn_anonymize_old_pim_conversations()
  to service_role;

-- ---------- 3) fn_purge_legal_expired_orders ----------
-- 10 yılı aşmış sipariş kayıtlarını ALARM olarak sayar.
-- Gerçek silme: ilk 10 yıl 2036'da dolacak — uzak gelecek.
-- Şu an yalnız sayım: "kaç adet sipariş 10 yıl sınırına yaklaştı?"
create or replace function public.fn_count_legal_purge_candidates()
returns table(
  candidate_count bigint,
  oldest_order_date timestamptz,
  warn_30day_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    count(*) filter (where created_at < now() - interval '10 years')
      as candidate_count,
    min(created_at) as oldest_order_date,
    count(*) filter (
      where created_at < now() - interval '10 years' + interval '30 days'
        and created_at >= now() - interval '10 years'
    ) as warn_30day_count
  from public.orders;
end;
$$;

revoke execute on function public.fn_count_legal_purge_candidates()
  from public, authenticated;
grant execute on function public.fn_count_legal_purge_candidates()
  to service_role;

-- ============================================================
-- Migration 028 sonu
-- ============================================================
