-- ============================================================
-- Pim Etiket — Migration 035: Mail Outbox Generic Extension
--
-- fason_mail_outbox şu an SADECE fason atama maillerini taşıyor:
--   assignment_id NOT NULL → her satır order_assignments'a bağlı.
--
-- Audit P0: Lead welcome / abandoned cart / review request gibi
-- generic mailler de mail outbox altyapısını kullansın. Resend
-- aktifleşince hepsi tek noktadan gönderilir, retry/backoff aynı.
--
-- Bu migration:
--   1) assignment_id NULL'a izin ver
--   2) target_type + target_id (polymorphic ref — orders/email_subscriber/user)
--   3) Indeksleri güncelle
--   4) "category" sütunu (fason / customer / lead) — admin filter için
-- ============================================================

-- 1) assignment_id NULL'a izin ver
alter table public.fason_mail_outbox
  alter column assignment_id drop not null;

-- 2) target ref'leri
alter table public.fason_mail_outbox
  add column if not exists target_type text
    check (target_type in (
      'assignment',
      'order',
      'subscriber',
      'user',
      'cart',
      null
    )),
  add column if not exists target_id uuid,
  add column if not exists category text
    check (category in ('fason', 'customer', 'lead', 'admin'))
    default 'fason';

-- Mevcut kayıtların category'sini set et
update public.fason_mail_outbox
  set category = 'fason',
      target_type = 'assignment',
      target_id = assignment_id
  where category is null;

-- 3) Yeni indeksler — kategori-bazlı filter için
create index if not exists mail_outbox_category_idx
  on public.fason_mail_outbox(category, status)
  where status in ('pending', 'failed');

create index if not exists mail_outbox_target_idx
  on public.fason_mail_outbox(target_type, target_id);

-- 4) Yorumlar
comment on column public.fason_mail_outbox.category is
  'Mail kategorisi: fason (atölyeye), customer (müşteriye sipariş), '
  'lead (email signup welcome), admin (operatör bildirimi)';

comment on column public.fason_mail_outbox.target_type is
  'Polymorphic ref tipi: assignment | order | subscriber | user | cart';

comment on column public.fason_mail_outbox.target_id is
  'Polymorphic ref id (assignment_id, order_id, subscriber.id veya user.id)';

-- 5) RPC: generic mail enqueue
-- assignment_id'siz mail eklemek için. customer_review_request, lead_welcome,
-- abandoned_cart gibi.
create or replace function public.fn_enqueue_mail(
  p_template_key text,
  p_to_email text,
  p_payload jsonb,
  p_category text default 'customer',
  p_target_type text default null,
  p_target_id uuid default null,
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
  text, text, jsonb, text, text, uuid, text
) from public, authenticated;
grant execute on function public.fn_enqueue_mail(
  text, text, jsonb, text, text, uuid, text
) to service_role;

-- ============================================================
-- Migration 035 sonu
-- ============================================================
