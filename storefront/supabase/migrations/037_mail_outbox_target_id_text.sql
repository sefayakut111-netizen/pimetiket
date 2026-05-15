-- ============================================================
-- Pim Etiket — Migration 037: mail_outbox.target_id uuid → text
--
-- Engineering P0 (4-agent audit, 2026-05-15):
--   Migration 035 fason_mail_outbox.target_id sütununu uuid olarak
--   tanımladı. Ancak orders.id TEXT formatında (PE-2026-XXXX). Bu
--   yüzden /api/cron/request-reviews → fn_enqueue_mail(target_id =>
--   order.id) çağrıları sessizce başarısız oluyor — invoice mail
--   asla outbox'a düşmüyor.
--
-- Bu migration:
--   1) fason_mail_outbox.target_id sütununu uuid → text yap
--   2) fn_enqueue_mail RPC'sini p_target_id text imzasıyla yeniden
--      oluştur (uuid varyantını drop et)
--   3) Index'i yeniden yarat (text üzerinde)
--   4) Mevcut uuid değerleri text'e otomatik cast edilir (PG implicit)
-- ============================================================

-- 1) Mevcut RPC'yi drop et (imza değişeceği için)
drop function if exists public.fn_enqueue_mail(
  text, text, jsonb, text, text, uuid, text
);

-- 2) Index'i drop et (sütun tipi değişeceği için)
drop index if exists public.mail_outbox_target_idx;

-- 3) Sütun tipini değiştir — uuid → text (implicit cast güvenli)
alter table public.fason_mail_outbox
  alter column target_id type text using target_id::text;

-- 4) Index'i yeniden yarat
create index if not exists mail_outbox_target_idx
  on public.fason_mail_outbox(target_type, target_id);

-- 5) RPC'yi text imzayla yeniden oluştur
create or replace function public.fn_enqueue_mail(
  p_template_key text,
  p_to_email text,
  p_payload jsonb,
  p_category text default 'customer',
  p_target_type text default null,
  p_target_id text default null,
  p_subject text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- Email format check (minimal)
  if p_to_email is null or length(p_to_email) < 5 or position('@' in p_to_email) = 0 then
    raise exception 'invalid_email:%', p_to_email;
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
    attempts
  ) values (
    null,
    p_template_key,
    lower(p_to_email),
    p_subject,
    p_payload,
    p_category,
    p_target_type,
    p_target_id,
    'pending',
    0
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.fn_enqueue_mail(
  text, text, jsonb, text, text, text, text
) from public, authenticated;
grant execute on function public.fn_enqueue_mail(
  text, text, jsonb, text, text, text, text
) to service_role;

-- 6) Yorum güncelle
comment on column public.fason_mail_outbox.target_id is
  'Polymorphic ref id (assignment_id uuid, order_id text PE-2026-XXXX, '
  'subscriber.id uuid veya user.id uuid). Tip TEXT — order_id formatı için.';

-- ============================================================
-- Migration 037 sonu
-- ============================================================
