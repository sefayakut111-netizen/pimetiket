-- ============================================================
-- Pim Etiket — Migration 076: Mail Suppressions + Observability
--
-- Sefa 21 May v68 — Resend tamamlama paketi:
--   1) mail_suppressions tablosu (bounce/complaint/unsubscribe)
--   2) fason_mail_outbox kolonları (idempotency_key, delivered_at,
--      bounced_at, opened_at, complaint_at, last_event)
--   3) fn_enqueue_mail revizyonu:
--      - idempotency_key UNIQUE constraint (aynı template+target için
--        çift kayıt önlenir)
--      - suppression check (lead/marketing'i bloklar; customer/admin
--        transactional'a izin verir çünkü KVKK m.5/2-c hizmet zorunlu)
--   4) Helper RPC'ler: fn_is_suppressed, fn_record_suppression
--
-- Suppression mantığı:
--   - bounce_hard: hard bounce — tüm kategorilerden bloklar
--   - complaint: spam butonu — tüm kategorilerden bloklar
--   - unsubscribe_marketing: marketing/lead'i bloklar, transactional
--     (sipariş, kargo, KVKK zorunlu mailler) için izin verir
--   - manual_admin: admin manuel ekledi — kategori-spesifik
--
-- ============================================================

-- =========================
-- 1) mail_suppressions
-- =========================
create table if not exists public.mail_suppressions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  -- Engel tipi: hangi olaydan kaynaklı?
  suppression_type text not null
    check (suppression_type in (
      'bounce_hard',           -- Resend webhook (kalıcı bounce)
      'bounce_soft_repeated',  -- >=3 soft bounce
      'complaint',             -- Resend webhook (spam şikayeti)
      'unsubscribe_marketing', -- Kullanıcı linke tıkladı
      'unsubscribe_blog',
      'unsubscribe_all',
      'manual_admin'           -- Admin manuel ekledi
    )),
  -- Hangi kategoriler için aktif? null = tüm kategoriler
  -- Örnek: ['lead','marketing'] → sadece lead+marketing bloklanır;
  -- customer (sipariş onayı) hala gönderilir
  blocked_categories text[],
  reason text,                 -- Resend bounce mesajı veya admin notu
  source_message_id text,      -- Resend message id (varsa)
  source_event_id text,        -- Webhook event id (idempotency)
  created_at timestamp with time zone not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

-- Aynı email için aynı suppression tipini iki kere ekleme
create unique index if not exists mail_suppressions_email_type_idx
  on public.mail_suppressions(lower(email), suppression_type);

-- Webhook idempotency
create unique index if not exists mail_suppressions_source_event_idx
  on public.mail_suppressions(source_event_id)
  where source_event_id is not null;

-- Hızlı sorgu için email index
create index if not exists mail_suppressions_email_idx
  on public.mail_suppressions(lower(email));

-- =========================
-- 2) fason_mail_outbox kolonları (observability)
-- =========================
alter table public.fason_mail_outbox
  add column if not exists idempotency_key text,
  add column if not exists delivered_at timestamp with time zone,
  add column if not exists bounced_at timestamp with time zone,
  add column if not exists complaint_at timestamp with time zone,
  add column if not exists opened_at timestamp with time zone,
  add column if not exists clicked_at timestamp with time zone,
  add column if not exists last_event text,
  add column if not exists last_event_at timestamp with time zone;

-- Idempotency unique index (NULL'a izin ver — eski kayıtlar etkilenmesin)
create unique index if not exists mail_outbox_idempotency_idx
  on public.fason_mail_outbox(idempotency_key)
  where idempotency_key is not null;

-- Resend message id index (webhook lookup için kritik)
create index if not exists mail_outbox_resend_msgid_idx
  on public.fason_mail_outbox(resend_message_id)
  where resend_message_id is not null;

-- =========================
-- 3) fn_is_suppressed helper
-- =========================
-- Kategori-aware suppression check
create or replace function public.fn_is_suppressed(
  p_email text,
  p_category text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_blocked boolean := false;
begin
  if p_email is null then
    return false;
  end if;

  -- Hard bounce, complaint, unsubscribe_all → her zaman bloklar
  select exists (
    select 1 from public.mail_suppressions s
    where lower(s.email) = lower(p_email)
      and s.suppression_type in (
        'bounce_hard',
        'complaint',
        'unsubscribe_all'
      )
  ) into v_blocked;

  if v_blocked then
    return true;
  end if;

  -- Kategori-spesifik suppression
  select exists (
    select 1 from public.mail_suppressions s
    where lower(s.email) = lower(p_email)
      and (
        -- blocked_categories null = tüm kategoriler bloklanır
        s.blocked_categories is null
        -- veya kategori listede
        or p_category = any(s.blocked_categories)
      )
  ) into v_blocked;

  return v_blocked;
end;
$$;

revoke execute on function public.fn_is_suppressed(text, text) from public;
grant execute on function public.fn_is_suppressed(text, text) to authenticated, service_role;

-- =========================
-- 4) fn_record_suppression helper (webhook için)
-- =========================
create or replace function public.fn_record_suppression(
  p_email text,
  p_type text,
  p_reason text default null,
  p_source_message_id text default null,
  p_source_event_id text default null,
  p_blocked_categories text[] default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- Source event id ile idempotent
  if p_source_event_id is not null then
    select id into v_id
    from public.mail_suppressions
    where source_event_id = p_source_event_id;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  -- Aynı email+type ile UPSERT
  insert into public.mail_suppressions (
    email, suppression_type, reason, source_message_id,
    source_event_id, blocked_categories
  ) values (
    lower(p_email), p_type, p_reason, p_source_message_id,
    p_source_event_id, p_blocked_categories
  )
  on conflict (lower(email), suppression_type) do update
    set reason = coalesce(excluded.reason, mail_suppressions.reason),
        source_message_id = coalesce(
          excluded.source_message_id, mail_suppressions.source_message_id
        )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.fn_record_suppression(
  text, text, text, text, text, text[]
) from public, authenticated;
grant execute on function public.fn_record_suppression(
  text, text, text, text, text, text[]
) to service_role;

-- =========================
-- 5) fn_enqueue_mail revizyonu (suppression + idempotency)
-- =========================
drop function if exists public.fn_enqueue_mail(
  text, text, jsonb, text, text, text, text
);

create or replace function public.fn_enqueue_mail(
  p_template_key text,
  p_to_email text,
  p_payload jsonb,
  p_category text default 'customer',
  p_target_type text default null,
  p_target_id text default null,
  p_subject text default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_email text;
begin
  -- Email format check
  if p_to_email is null or length(p_to_email) < 5
     or position('@' in p_to_email) = 0 then
    raise exception 'invalid_email:%', p_to_email;
  end if;

  v_email := lower(p_to_email);

  -- Suppression check — bloklanmış email'lere kuyruğa bile alma
  if public.fn_is_suppressed(v_email, p_category) then
    -- Sessiz return null — caller bunu loglayabilir
    return null;
  end if;

  -- Idempotency check — aynı key ile kayıt varsa onun id'sini döndür
  if p_idempotency_key is not null then
    select id into v_id
    from public.fason_mail_outbox
    where idempotency_key = p_idempotency_key;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  insert into public.fason_mail_outbox (
    assignment_id,
    template_key,
    to_email,
    subject,
    payload,
    category,
    target_type,
    target_id,
    status,
    attempts,
    idempotency_key
  ) values (
    null,
    p_template_key,
    v_email,
    p_subject,
    p_payload,
    p_category,
    p_target_type,
    p_target_id,
    'pending',
    0,
    p_idempotency_key
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.fn_enqueue_mail(
  text, text, jsonb, text, text, text, text, text
) from public, authenticated;
grant execute on function public.fn_enqueue_mail(
  text, text, jsonb, text, text, text, text, text
) to service_role;

-- =========================
-- 6) RLS — admin sadece görsün
-- =========================
alter table public.mail_suppressions enable row level security;

drop policy if exists "Admin read suppressions" on public.mail_suppressions;
create policy "Admin read suppressions" on public.mail_suppressions
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

-- INSERT/UPDATE/DELETE sadece service_role (RPC üzerinden)
-- Default deny olduğu için extra policy gerekmez.

-- =========================
-- 7) Yorumlar (dokümantasyon)
-- =========================
comment on table public.mail_suppressions is
  'Mail gönderim engel listesi. Hard bounce + spam complaint + KVKK '
  'unsubscribe burada tutulur. fn_enqueue_mail RPC her insert öncesi '
  'fn_is_suppressed çağırır → bloklu adreslere kuyruğa düşmez.';

comment on column public.mail_suppressions.blocked_categories is
  'NULL = tüm kategoriler bloklanır. Aksi halde dizi: '
  '[''lead'',''marketing'']. KVKK m.5/2-c gereği transactional '
  '(customer/admin/fason) ZORUNLU mailler için unsubscribe bloklanamaz.';

comment on column public.fason_mail_outbox.idempotency_key is
  'Aynı tetik için duplicate mail önlemek. Örnek: '
  '"abandoned_cart:cart_id:2026-05-21". Aynı key ile fn_enqueue_mail '
  'çağrılırsa mevcut kaydın id''si döner.';

comment on column public.fason_mail_outbox.delivered_at is
  'Resend webhook email.delivered eventiyle set edilir.';

comment on column public.fason_mail_outbox.bounced_at is
  'Resend webhook email.bounced eventiyle set edilir.';

comment on column public.fason_mail_outbox.complaint_at is
  'Resend webhook email.complained eventiyle set edilir.';

-- ============================================================
-- Migration 076 sonu
-- ============================================================

-- APPLY ONAYI BEKLİYOR
-- Sefa: "uygula 076" dersen psql/dashboard üzerinden çalıştırılacak.
-- Verify sorgusu:
--   select tablename from pg_tables where tablename='mail_suppressions';
--   select column_name from information_schema.columns
--     where table_name='fason_mail_outbox' and column_name='idempotency_key';
