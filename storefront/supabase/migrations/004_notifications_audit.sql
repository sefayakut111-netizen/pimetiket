-- ============================================================
-- Pim Etiket — Migration 004
--
-- (1) notification_prefs  → Kullanıcı email + SMS opt-in tercihleri
-- (2) audit_log           → Admin işlemleri için immutable audit trail
--                           (KVKK + VUK — kim ne zaman ne yaptı)
-- ============================================================

-- ---------- 1) notification_prefs ----------
-- Tek satır per user. /bildirim-tercihleri sayfası bunu yönetir.
-- Mail/SMS gönderim öncesi server bu tabloyu sorgular.
create table if not exists public.notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Email kategorileri
  email_order_updates boolean not null default true,    -- ZORUNLU (yasal)
  email_proof_ready boolean not null default true,
  email_shipping_updates boolean not null default true,
  email_marketing boolean not null default false,       -- KVKK opt-in
  email_blog boolean not null default false,            -- KVKK opt-in
  -- SMS kategorileri
  sms_urgent_order boolean not null default true,
  sms_proof_ready boolean not null default false,
  sms_delivery boolean not null default false,
  -- Onay tarihleri (KVKK kanıtı)
  marketing_consent_at timestamptz,
  blog_consent_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.notification_prefs enable row level security;

create policy "Users can view own prefs"
  on public.notification_prefs for select
  using (auth.uid() = user_id);

create policy "Users can update own prefs"
  on public.notification_prefs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can insert own prefs"
  on public.notification_prefs for insert
  with check (auth.uid() = user_id);

drop trigger if exists notification_prefs_updated_at on public.notification_prefs;
create trigger notification_prefs_updated_at
  before update on public.notification_prefs
  for each row
  execute function public.set_updated_at();

-- Yeni kullanıcı → default prefs satırı otomatik aç
create or replace function public.handle_new_user_prefs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_prefs (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_prefs on auth.users;
create trigger on_auth_user_created_prefs
  after insert on auth.users
  for each row
  execute function public.handle_new_user_prefs();

-- ---------- 2) audit_log ----------
-- Admin işlemleri immutable log. Append-only.
-- Mevcut localStorage audit-log.ts'in DB karşılığı.
create type public.audit_action as enum (
  'order.status_change',
  'order.cancel',
  'order.refund',
  'return.approve',
  'return.reject',
  'return.refund',
  'coupon.create',
  'coupon.update',
  'coupon.delete',
  'review.approve',
  'review.reject',
  'review.delete',
  'staff.invite',
  'staff.remove',
  'staff.role_change',
  'settings.update',
  'design_file.approve',
  'design_file.reject',
  'auth.login',
  'auth.logout',
  'profile.delete'
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  -- Eylemi yapan (auth.users.id)
  actor_id uuid references auth.users(id) on delete set null,
  -- Denormalize fields — actor profil silinse de audit kalır
  actor_email text,
  actor_role text check (actor_role is null or actor_role in (
    'customer', 'admin', 'staff', 'system'
  )),
  action public.audit_action not null,
  -- Etkilenen entity (order id, return id, coupon id, vs)
  target_type text,
  target_id text,
  -- İnsana okunabilir özet (UI listesi için)
  summary text not null,
  -- Ek detay (eski-yeni değer, IP, user-agent, vs)
  detail jsonb default '{}'::jsonb,
  -- İstemci IP — request header'dan alınır
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_actor_idx
  on public.audit_log(actor_id, created_at desc);
create index if not exists audit_log_target_idx
  on public.audit_log(target_type, target_id);
create index if not exists audit_log_action_idx
  on public.audit_log(action, created_at desc);
create index if not exists audit_log_created_at_idx
  on public.audit_log(created_at desc);

alter table public.audit_log enable row level security;

-- Müşteri SADECE kendi profil/sipariş/iade ile ilgili audit'leri görebilir
-- (auth.login, auth.logout, profile.delete, kendi siparişinde değişiklik)
create policy "Users can view own audit entries"
  on public.audit_log for select
  using (auth.uid() = actor_id);

-- INSERT sadece service_role (uygulama admin işlemlerinde server-side log atar)
-- UPDATE/DELETE → ASLA. Append-only.

-- Bypass denemesi için bonus: NO ROW LEVEL constraint trigger
-- (immutable enforce — service_role bile UPDATE/DELETE yapamaz, sadece SUPERUSER)
create or replace function public.fn_audit_log_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only';
end;
$$;

drop trigger if exists audit_log_no_update on public.audit_log;
create trigger audit_log_no_update
  before update on public.audit_log
  for each row execute function public.fn_audit_log_immutable();

drop trigger if exists audit_log_no_delete on public.audit_log;
create trigger audit_log_no_delete
  before delete on public.audit_log
  for each row execute function public.fn_audit_log_immutable();

-- Helper: client-side'dan kolayca log atmak için RPC
-- (sadece authenticated, kendi adına aksiyonları için)
create or replace function public.fn_log_audit(
  p_action public.audit_action,
  p_target_type text default null,
  p_target_id text default null,
  p_summary text default '',
  p_detail jsonb default '{}'::jsonb
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
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;
  -- Müşteri sadece auth.* + profile.delete + kendi sipariş/iadesini logla
  if p_action not in (
    'auth.login', 'auth.logout', 'profile.delete'
  ) then
    raise exception 'this action requires admin role (use service_role)';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  insert into public.audit_log (
    actor_id, actor_email, actor_role,
    action, target_type, target_id, summary, detail
  ) values (
    auth.uid(), v_email, 'customer',
    p_action, p_target_type, p_target_id, p_summary, p_detail
  )
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.fn_log_audit to authenticated;

comment on function public.fn_log_audit is
  'Müşterinin kendi adına audit log atması için RPC. Sadece auth.* ve profile.delete eylemleri.';
