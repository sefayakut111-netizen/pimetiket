-- ============================================================
-- Pim Etiket — Migration 020: Fason Access Tokens + Mail Outbox
--
-- 🛠️ Mühendis denetimi P0 sonrası:
--   - Signed URL 7 gün YERINE: token-based proxy + her tıklamada fresh 15dk URL
--   - Resend down olunca sipariş takılmasın: outbox + retry cron
-- ============================================================

-- ---------- fason_access_tokens ----------
-- Fason web form auth için magic-link benzeri token.
-- /fason/order/[id]/update?t=<token> ile çalışır.
create table if not exists public.fason_access_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,                          -- UUID hex (32 char)
  assignment_id uuid not null references public.order_assignments(id) on delete cascade,
  fason_partner_id uuid not null references public.fason_partners(id) on delete cascade,
  expires_at timestamp with time zone not null,        -- Teslim+7 gün önerilir
  revoked_at timestamp with time zone,                 -- Manuel iptal
  -- Audit
  created_at timestamp with time zone default now(),
  last_used_at timestamp with time zone,
  use_count integer not null default 0
);

create index if not exists fason_tokens_active_idx
  on public.fason_access_tokens(token)
  where revoked_at is null;

create index if not exists fason_tokens_assignment_idx
  on public.fason_access_tokens(assignment_id);

-- ---------- fason_link_access_log ----------
-- Her tasarım dosyası tıklamasını logla
create table if not exists public.fason_link_access_log (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.order_assignments(id) on delete cascade,
  token_id uuid references public.fason_access_tokens(id) on delete set null,
  accessed_at timestamp with time zone default now(),
  ip_address text,
  user_agent text,
  action text not null default 'download', -- 'download'|'preview'|'status_update'
  success boolean default true
);

create index if not exists fason_access_log_assignment_idx
  on public.fason_link_access_log(assignment_id, accessed_at desc);

-- ---------- fason_mail_outbox ----------
-- Resend down olursa sipariş takılmasın
create table if not exists public.fason_mail_outbox (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.order_assignments(id) on delete cascade,
  template_key text not null,            -- 'fason_new_assignment','customer_in_production' vb.
  to_email text not null,
  subject text,
  payload jsonb not null,                 -- Template değişkenleri
  status text not null default 'pending', -- pending|sending|sent|failed
  attempts integer not null default 0,
  last_error text,
  next_retry_at timestamp with time zone,
  sent_at timestamp with time zone,
  resend_message_id text,                 -- Resend response ID
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists mail_outbox_pending_idx
  on public.fason_mail_outbox(next_retry_at)
  where status in ('pending', 'failed');

create index if not exists mail_outbox_assignment_idx
  on public.fason_mail_outbox(assignment_id);

-- ---------- Helper: token üret ----------
-- Format: 32 char hex (gen_random_uuid'in hyphenless hex)
create or replace function public.fn_generate_fason_token(
  p_assignment_id uuid,
  p_fason_partner_id uuid,
  p_days integer default 7
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  v_token := replace(gen_random_uuid()::text, '-', '') ||
             replace(gen_random_uuid()::text, '-', '');
  -- 64 char unique token

  insert into public.fason_access_tokens (
    token, assignment_id, fason_partner_id, expires_at
  ) values (
    v_token,
    p_assignment_id,
    p_fason_partner_id,
    now() + (p_days || ' days')::interval
  );

  return v_token;
end;
$$;

grant execute on function public.fn_generate_fason_token(uuid, uuid, integer) to authenticated;
grant execute on function public.fn_generate_fason_token(uuid, uuid, integer) to service_role;

-- ---------- Helper: token doğrula ----------
create or replace function public.fn_validate_fason_token(p_token text)
returns table(
  assignment_id uuid,
  fason_partner_id uuid,
  order_id text,
  is_valid boolean,
  reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token_row record;
begin
  select t.id as token_id, t.assignment_id, t.fason_partner_id,
         t.expires_at, t.revoked_at, oa.order_id
  into v_token_row
  from public.fason_access_tokens t
  join public.order_assignments oa on oa.id = t.assignment_id
  where t.token = p_token;

  if not found then
    assignment_id := null; fason_partner_id := null; order_id := null;
    is_valid := false; reason := 'token_not_found';
    return next;
    return;
  end if;

  if v_token_row.revoked_at is not null then
    assignment_id := v_token_row.assignment_id;
    fason_partner_id := v_token_row.fason_partner_id;
    order_id := v_token_row.order_id;
    is_valid := false; reason := 'token_revoked';
    return next;
    return;
  end if;

  if v_token_row.expires_at < now() then
    assignment_id := v_token_row.assignment_id;
    fason_partner_id := v_token_row.fason_partner_id;
    order_id := v_token_row.order_id;
    is_valid := false; reason := 'token_expired';
    return next;
    return;
  end if;

  -- Geçerli — last_used_at + use_count güncelle
  update public.fason_access_tokens
    set last_used_at = now(),
        use_count = use_count + 1
    where token = p_token;

  assignment_id := v_token_row.assignment_id;
  fason_partner_id := v_token_row.fason_partner_id;
  order_id := v_token_row.order_id;
  is_valid := true; reason := 'ok';
  return next;
end;
$$;

grant execute on function public.fn_validate_fason_token(text) to authenticated;
grant execute on function public.fn_validate_fason_token(text) to service_role;

-- ---------- RLS ----------
alter table public.fason_access_tokens enable row level security;
alter table public.fason_link_access_log enable row level security;
alter table public.fason_mail_outbox enable row level security;

-- Hepsi sadece admin/staff (service role bypass)
drop policy if exists "Admin only" on public.fason_access_tokens;
create policy "Admin only" on public.fason_access_tokens for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'staff')));

drop policy if exists "Admin only" on public.fason_link_access_log;
create policy "Admin only" on public.fason_link_access_log for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'staff')));

drop policy if exists "Admin only" on public.fason_mail_outbox;
create policy "Admin only" on public.fason_mail_outbox for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'staff')));

-- ============================================================
-- Migration 020 sonu
-- ============================================================
