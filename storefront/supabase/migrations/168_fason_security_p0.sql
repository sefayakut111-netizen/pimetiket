-- Mig 168 — Fason güvenlik P0: plain token kaldır, hash-only saklama
-- fn_generate_fason_token + fn_assign_order_to_fason güncelle; outbox'a fason_token ekle

create extension if not exists pgcrypto with schema extensions;

-- Hash-only token üret (eski aktif tokenları revoke et)
create or replace function public.fn_generate_fason_token(
  p_assignment_id uuid,
  p_fason_partner_id uuid,
  p_days integer default 7
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text;
  v_hash text;
begin
  update public.fason_access_tokens
    set revoked_at = now()
    where assignment_id = p_assignment_id
      and revoked_at is null;

  v_token := replace(gen_random_uuid()::text, '-', '') ||
             replace(gen_random_uuid()::text, '-', '');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into public.fason_access_tokens (
    token_hash, assignment_id, fason_partner_id, expires_at
  ) values (
    v_hash,
    p_assignment_id,
    p_fason_partner_id,
    now() + (p_days || ' days')::interval
  );

  return v_token;
end;
$$;

revoke execute on function public.fn_generate_fason_token(uuid, uuid, integer) from public;
grant execute on function public.fn_generate_fason_token(uuid, uuid, integer) to service_role;

-- Atama RPC — hash-only token + outbox payload'da plain (tek seferlik mail)
create or replace function public.fn_assign_order_to_fason(
  p_order_id text,
  p_fason_partner_id uuid,
  p_admin_user_id uuid,
  p_estimated_delivery date,
  p_notes text,
  p_token_days integer default 14
)
returns table(
  assignment_id uuid,
  fason_token text,
  order_status_before text,
  order_status_after text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_order record;
  v_fason record;
  v_assignment_id uuid;
  v_token text;
  v_hash text;
begin
  select id, status into v_order
    from public.orders
    where id = p_order_id
    for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  if v_order.status in ('cancelled', 'delivered') then
    raise exception 'order_status_locked:%', v_order.status
      using errcode = '22023';
  end if;

  if v_order.status = 'proof_pending' then
    raise exception 'order_proof_pending_sla'
      using errcode = '22023',
            message = 'Sipariş proof_pending — müşteri onayı bekleniyor, partner ataması yapılamaz';
  end if;

  select id, name, contact_email, active,
         contract_signed_at, contract_pdf_url, notify_email_on_assign
    into v_fason
    from public.fason_partners
    where id = p_fason_partner_id;
  if not found then
    raise exception 'fason_not_found' using errcode = 'P0002';
  end if;
  if not v_fason.active then
    raise exception 'fason_inactive' using errcode = '22023';
  end if;
  if v_fason.contract_signed_at is null
     and (v_fason.contract_pdf_url is null
          or length(trim(v_fason.contract_pdf_url)) = 0) then
    raise exception 'fason_no_contract' using errcode = '22023';
  end if;

  insert into public.order_assignments (
    order_id, fason_partner_id, status,
    assigned_by, estimated_delivery, notes
  ) values (
    p_order_id, p_fason_partner_id, 'assigned',
    p_admin_user_id, p_estimated_delivery, p_notes
  )
  returning id into v_assignment_id;

  v_token := replace(gen_random_uuid()::text, '-', '') ||
             replace(gen_random_uuid()::text, '-', '');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into public.fason_access_tokens (
    token_hash, assignment_id, fason_partner_id, expires_at
  ) values (
    v_hash, v_assignment_id, p_fason_partner_id,
    now() + (p_token_days || ' days')::interval
  );

  if coalesce(v_fason.notify_email_on_assign, true) then
    insert into public.fason_mail_outbox (
      assignment_id, template_key, to_email, subject, payload,
      status, next_retry_at
    ) values (
      v_assignment_id,
      'fason_new_assignment',
      v_fason.contact_email,
      'Yeni iş — Sipariş ' || p_order_id ||
        ' · teslim ' || coalesce(p_estimated_delivery::text, 'yakında'),
      jsonb_build_object(
        'order_id', p_order_id,
        'fason_name', v_fason.name,
        'estimated_delivery', p_estimated_delivery,
        'notes', p_notes,
        'assignment_id', v_assignment_id,
        'fason_token', v_token
      ),
      'pending',
      now()
    );
  end if;

  insert into public.order_events (
    order_id, event_type, status_after,
    actor_id, actor_role, summary, detail
  ) values (
    p_order_id, 'fason_assigned', v_order.status,
    p_admin_user_id, 'admin',
    'Fason atandı: ' || v_fason.name,
    jsonb_build_object(
      'assignment_id', v_assignment_id,
      'fason_id', p_fason_partner_id,
      'fason_name', v_fason.name,
      'estimated_delivery', p_estimated_delivery
    )
  );

  if v_order.status in ('paid', 'qc_pending', 'qc_flagged',
                        'operator_review') then
    update public.orders
      set status = 'in_production'
      where id = p_order_id;
    order_status_after := 'in_production';
  elsif v_order.status in ('ready_to_ship', 'proof_approved') then
    update public.orders
      set status = 'fason_assigned'
      where id = p_order_id;
    order_status_after := 'fason_assigned';
  else
    order_status_after := v_order.status;
  end if;

  assignment_id := v_assignment_id;
  fason_token := v_token;
  order_status_before := v_order.status;
  return next;
end;
$$;

comment on function public.fn_assign_order_to_fason(text, uuid, uuid, date, text, integer) is
  'Mig 168: hash-only token DB; outbox payload fason_token (plain tek seferlik mail).';

-- Trigger: artık yalnızca token_hash ile çalışır (plain kolon kalkıyor)
drop trigger if exists trg_fason_token_compute_hash on public.fason_access_tokens;

-- Mevcut plain değerleri temizle, kolonu kaldır
update public.fason_access_tokens
  set token = null
  where token is not null;

alter table public.fason_access_tokens
  drop column if exists token;

-- token_hash zorunlu (Mig 089 backfill; kalan geçersiz satırları sil)
delete from public.fason_access_tokens where token_hash is null;

alter table public.fason_access_tokens
  alter column token_hash set not null;

comment on column public.fason_access_tokens.token_hash is
  'Mig 168: SHA-256(token) hex — plain token DB''de saklanmaz.';
