-- ============================================================
-- Pim Etiket — Migration 089: Fason Token Hash Storage
-- ============================================================
--
-- Sefa 23 May v68. Güvenlik analizi P1.8.
-- Tam liste: memory/project_security_findings_2026_05_23.md
--
-- Sorun:
--   fason_access_tokens.token plain text 64-hex saklanıyor (Mig 020:14).
--   Token şiddetle güçlü (128-bit entropi) — brute-force pratik değil
--   AMA DB dump leak senaryosunda tokenlar direkt kullanılabilir.
--   Saldırgan replicaya erişirse partner downloadlarına ulaşır.
--
-- Çözüm:
--   1. token_hash kolonu ekle (sha256 hex = 64 char)
--   2. INSERT/UPDATE trigger ile token_hash otomatik hesapla
--   3. Mevcut tokenları backfill (plain → hash)
--   4. fn_validate_fason_token: gelen plain token'ı hash'le, hash'le match
--   5. Yeni indexlerle lookup hash üzerinden
--
-- Backward compat:
--   - token plain kolonu DROP edilmez bu turda. Endpoint'ler aynı
--     plain token URL'de taşımaya devam ediyor; DB'de hash saklı.
--   - Future Mig 09x: token plain kolonunu NULL'a setle ve drop et.
--
-- Single-use / daily limit:
--   Bu migration kapsamında değil — Mig 020 fason_link_access_log
--   zaten kullanım say tutuyor. Endpoint katmanında future patch ile
--   "use_count > N → revoke" eklenebilir.
-- ============================================================

-- pgcrypto için extensions şeması (Supabase default)
-- digest() fonksiyonu burada
create extension if not exists pgcrypto with schema extensions;

-- 1) token_hash kolonu (Supabase managed env'da extensions schema)
alter table public.fason_access_tokens
  add column if not exists token_hash text;

-- 2) Trigger: INSERT/UPDATE'de token_hash otomatik hesapla
create or replace function public.fn_fason_token_compute_hash()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.token is not null and new.token_hash is null then
    new.token_hash := encode(extensions.digest(new.token, 'sha256'), 'hex');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fason_token_compute_hash on public.fason_access_tokens;
create trigger trg_fason_token_compute_hash
  before insert or update of token on public.fason_access_tokens
  for each row execute function public.fn_fason_token_compute_hash();

-- 3) Backfill mevcut tokenlar
update public.fason_access_tokens
  set token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
  where token_hash is null
    and token is not null;

-- 4) Hash lookup index (active tokenlar için)
create index if not exists fason_tokens_hash_active_idx
  on public.fason_access_tokens(token_hash)
  where revoked_at is null and token_hash is not null;

-- 5) fn_validate_fason_token replace — hash karşılaştırma
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
set search_path = public, extensions
as $$
declare
  v_token_row record;
  v_hash text;
begin
  -- Sefa 23 May v68 (P1.8): plain token'ı hash'le, hash ile lookup
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select t.id as token_id, t.assignment_id, t.fason_partner_id,
         t.expires_at, t.revoked_at, oa.order_id
  into v_token_row
  from public.fason_access_tokens t
  join public.order_assignments oa on oa.id = t.assignment_id
  where t.token_hash = v_hash;

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

  -- Geçerli — last_used_at + use_count güncelle (hash ile WHERE)
  update public.fason_access_tokens
    set last_used_at = now(),
        use_count = use_count + 1
    where token_hash = v_hash;

  assignment_id := v_token_row.assignment_id;
  fason_partner_id := v_token_row.fason_partner_id;
  order_id := v_token_row.order_id;
  is_valid := true; reason := 'ok';
  return next;
end;
$$;

-- Grant — Mig 020'deki yapı korunur
grant execute on function public.fn_validate_fason_token(text) to authenticated;
grant execute on function public.fn_validate_fason_token(text) to service_role;

comment on function public.fn_validate_fason_token(text) is
  'Mig 089 P1.8: Plain token alır, SHA-256 hash''leyip token_hash ile '
  'karşılaştırır. DB dump senaryosunda tokenlar direkt kullanılamaz.';

comment on column public.fason_access_tokens.token_hash is
  'Mig 089 P1.8: SHA-256(token) hex. Mevcut tokenlar trigger ile '
  'otomatik hesaplandı, yeni INSERT''lerde de aynı trigger çalışır.';

-- ============================================================
-- Migration 089 sonu
-- ============================================================
-- Rollback:
--   drop trigger if exists trg_fason_token_compute_hash on public.fason_access_tokens;
--   drop function if exists public.fn_fason_token_compute_hash();
--   alter table public.fason_access_tokens drop column if exists token_hash;
--   -- fn_validate_fason_token önceki versiyonu Mig 020'den re-apply
-- ============================================================
