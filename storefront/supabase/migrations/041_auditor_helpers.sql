-- ============================================================
-- Pim Etiket — Migration 041: Auditor yardımcı RPC'ler
--
-- Sefa (16 May): Compliance + Security auditor'ların ihtiyacı
-- olan yardımcı SQL fonksiyonları.
--
-- 3 fonksiyon:
--   1. fn_process_kvkk_deletion(p_request_id)
--      → KVKK silme talebini anonymize ederek işle
--   2. fn_recent_failed_logins(p_since, p_threshold)
--      → audit_log'tan brute force pattern tespit (stub şimdilik)
--   3. fn_log_failed_login(p_email, p_ip, p_user_agent)
--      → app tarafından çağrılır, fn_recent_failed_logins'e veri
-- ============================================================


-- ============================================================
-- 1) fn_process_kvkk_deletion — KVKK silme aksiyonu
-- ============================================================
-- ComplianceAuditor önerdiği aksiyon Sefa onayladığında çağrılır.
-- Hard delete YAPMAZ — anonymization uygular (VUK 5 yıl saklama).
--
-- Yapacaklar:
--   - profiles: display_name → 'Silinmiş Kullanıcı', phone → null
--   - kvkk_requests: status='processed', processed_at, processed_by
--   - audit_log: işlem kaydı
--
-- ÖNEMLI: Sipariş + ödeme verisi kalır (VUK gereği).

create or replace function public.fn_process_kvkk_deletion(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request kvkk_requests%rowtype;
  v_user_id uuid;
begin
  -- 1) Request'i bul ve kilit
  select * into v_request
  from kvkk_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'KVKK request not found: %', p_request_id;
  end if;

  if v_request.status not in ('confirmed', 'pending') then
    raise exception 'KVKK request status invalid for processing: %', v_request.status;
  end if;

  v_user_id := v_request.user_id;

  -- 2) profiles anonymize
  update profiles
  set
    display_name = 'Silinmiş Kullanıcı',
    phone = null,
    updated_at = now()
  where id = v_user_id;

  -- 3) auth.users metadata (banned_until = epoch sonsuza kadar)
  -- NOT: Supabase'in resmi yöntemi GoTrue admin API. Buradan
  -- doğrudan auth.users update'i risky — sadece soft mark.
  -- Auditor sistemi opsiyonel olarak GoTrue API çağırabilir
  -- (auth.admin.deleteUser veya banned_until set).

  -- 4) kvkk_requests güncelle
  update kvkk_requests
  set
    status = 'processed',
    processed_at = now(),
    admin_note = coalesce(admin_note, '') ||
      e'\n[' || now()::text || '] Auditor tarafından otomatik işlendi (compliance agent onayı).'
  where id = p_request_id;

  -- 5) audit_log kaydı
  insert into audit_log (
    actor_id, actor_email, actor_role,
    action, target_type, target_id,
    summary, detail
  ) values (
    null, 'auditor@pimetiket.com', 'admin',
    'profile.delete', 'kvkk_request', p_request_id::text,
    'KVKK silme talebi auditor ile işlendi',
    jsonb_build_object(
      'kvkk_request_id', p_request_id,
      'user_id', v_user_id,
      'kind', v_request.kind,
      'auditor', 'compliance',
      'processed_at', now()
    )
  );

  return jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'user_id', v_user_id,
    'processed_at', now()
  );
end;
$$;

grant execute on function public.fn_process_kvkk_deletion(uuid) to authenticated, service_role;

comment on function public.fn_process_kvkk_deletion(uuid) is
  'KVKK silme talebini anonymize ederek işler. Audit kaydı bırakır. VUK 5 yıl gereği hard delete yapmaz.';


-- ============================================================
-- 2) fn_recent_failed_logins — Brute force tespit
-- ============================================================
-- SecurityAuditor brute force kontrolü için kullanır.
-- Custom event tablosundan veriyi çeker (fn_log_failed_login ile yazılır).
--
-- Şu an için stub döndürür — boş array. Sefa app'inde failed
-- login logging eklediğinde gerçek veri buradan çıkar.
--
-- Stub karşılığı: SecurityAuditor.checkBruteForce graceful skip yapar.

create table if not exists public.auth_failed_logins (
  id bigserial primary key,
  email text,
  ip inet,
  user_agent text,
  failure_reason text,
  attempted_at timestamptz not null default now()
);

create index if not exists auth_failed_logins_ip_idx
  on public.auth_failed_logins (ip, attempted_at desc);
create index if not exists auth_failed_logins_email_idx
  on public.auth_failed_logins (email, attempted_at desc);
create index if not exists auth_failed_logins_recent_idx
  on public.auth_failed_logins (attempted_at desc);

-- Auto-purge: 7 günden eski kayıtları sil (cron veya manuel)
-- (Index'le hızlı: WHERE attempted_at < now() - interval '7 days')

comment on table public.auth_failed_logins is
  'Başarısız giriş denemeleri. SecurityAuditor brute force tespiti için kullanır.';


create or replace function public.fn_recent_failed_logins(
  p_since timestamptz,
  p_threshold integer default 10
)
returns table (
  ip text,
  email text,
  count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    host(afl.ip) as ip,
    afl.email,
    count(*) as count
  from auth_failed_logins afl
  where afl.attempted_at >= p_since
    and afl.ip is not null
  group by host(afl.ip), afl.email
  having count(*) >= p_threshold
  order by count desc
  limit 50;
$$;

grant execute on function public.fn_recent_failed_logins(timestamptz, integer)
  to authenticated, service_role;

comment on function public.fn_recent_failed_logins(timestamptz, integer) is
  'Verilen pencerede threshold üstünde failed login yapan IP+email grupları. Brute force tespiti için.';


-- ============================================================
-- 3) fn_log_failed_login — App tarafından çağrılır
-- ============================================================
-- Auth endpoint'inde "şifre yanlış" durumunda çağrılır.
-- Service-role ile erişilebilir (RLS bypass).

create or replace function public.fn_log_failed_login(
  p_email text,
  p_ip inet,
  p_user_agent text default null,
  p_reason text default 'password_invalid'
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into auth_failed_logins (email, ip, user_agent, failure_reason)
  values (p_email, p_ip, p_user_agent, p_reason);
$$;

grant execute on function public.fn_log_failed_login(text, inet, text, text)
  to authenticated, service_role;

comment on function public.fn_log_failed_login(text, inet, text, text) is
  'App''ın auth endpoint''i tarafından çağrılır — başarısız giriş kaydı.';


-- ============================================================
-- 4) RLS — auth_failed_logins
-- ============================================================
alter table public.auth_failed_logins enable row level security;

-- Sadece admin/staff okur
drop policy if exists "auth_failed_logins_admin_read" on public.auth_failed_logins;
create policy "auth_failed_logins_admin_read"
  on public.auth_failed_logins for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );


-- ============================================================
-- 5) Cleanup cron alternatifi — manuel çağrılır
-- ============================================================
-- 30+ gün eski failed login kayıtlarını sil.
-- Auditor data_hygiene tarafından önerilen aksiyon olabilir.

create or replace function public.fn_cleanup_old_failed_logins(
  p_days integer default 30
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from auth_failed_logins
  where attempted_at < now() - (p_days || ' days')::interval;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

grant execute on function public.fn_cleanup_old_failed_logins(integer)
  to authenticated, service_role;


-- ============================================================
-- Migration 041 sonu
-- ============================================================
