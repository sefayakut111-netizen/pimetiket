-- ============================================================
-- Migration 136 — Akış P1 (fason güvenlik + token + arşiv retention)
-- A1 auto_assign log · A6 token grant revoke · A7 outbox token · A9 validate/increment split
-- C3 expired cold · C4 renew cold retention
-- ============================================================

-- ---------- A1: auto-assign trigger — exception log (Mig 068) ----------
create or replace function public.fn_auto_assign_partner_on_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
  v_first_item record;
  v_cap record;
  v_partner record;
  v_assignment_id uuid;
  v_total numeric;
  v_existing int;
  v_estimated_delivery date;
begin
  if not (
    (TG_OP = 'UPDATE' and OLD.status <> 'ready_to_ship' and NEW.status = 'ready_to_ship')
    or (TG_OP = 'INSERT' and NEW.status = 'ready_to_ship')
  ) then
    return NEW;
  end if;

  select partner_auto_assign_enabled into v_enabled
    from public.site_settings where id = 1;
  if not coalesce(v_enabled, false) then
    return NEW;
  end if;

  select count(*) into v_existing
    from public.order_assignments
    where order_id = NEW.id
      and status in ('assigned', 'sent', 'acknowledged', 'in_production', 'ready');
  if v_existing > 0 then
    return NEW;
  end if;

  select oi.product, oi.meta into v_first_item
    from public.order_items oi
    where oi.order_id = NEW.id
    order by oi.id
    limit 1;
  if not found then
    return NEW;
  end if;

  select * into v_cap
    from public.fn_map_item_to_capability(v_first_item.product, v_first_item.meta);
  if v_cap.product_type is null then
    return NEW;
  end if;

  v_total := NEW.total;

  select partner_id, default_lead_days into v_partner
    from public.fn_find_best_partner(v_cap.product_type, v_cap.material, v_total)
    limit 1;
  if v_partner.partner_id is null then
    return NEW;
  end if;

  v_estimated_delivery := (current_date + v_partner.default_lead_days * interval '1 day')::date;

  begin
    perform public.fn_assign_order_to_fason(
      NEW.id,
      v_partner.partner_id,
      null,
      v_estimated_delivery,
      'Otomatik atama (capability match): ' || v_cap.product_type
        || coalesce(' + ' || v_cap.material, ''),
      14
    );
  exception when others then
    insert into public.order_events (
      order_id, event_type, actor_role, summary, detail
    ) values (
      NEW.id,
      'auto_assign_failed',
      'system',
      SQLERRM,
      jsonb_build_object('sqlstate', SQLSTATE)
    );
    return NEW;
  end;

  return NEW;
end;
$$;

-- ---------- A6/A9: fn_validate_fason_token — doğrula only (use_count ayrı RPC) ----------
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
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select t.id as token_id, t.assignment_id, t.fason_partner_id,
         t.expires_at, t.revoked_at, t.use_count, t.max_use_count, oa.order_id
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

  if v_token_row.use_count >= v_token_row.max_use_count then
    assignment_id := v_token_row.assignment_id;
    fason_partner_id := v_token_row.fason_partner_id;
    order_id := v_token_row.order_id;
    is_valid := false; reason := 'token_limit_exceeded';
    return next;
    return;
  end if;

  assignment_id := v_token_row.assignment_id;
  fason_partner_id := v_token_row.fason_partner_id;
  order_id := v_token_row.order_id;
  is_valid := true; reason := 'ok';
  return next;
end;
$$;

revoke execute on function public.fn_validate_fason_token(text) from authenticated;
grant execute on function public.fn_validate_fason_token(text) to service_role;

-- ---------- A9: başarılı download sonrası use_count artır ----------
create or replace function public.fn_increment_fason_token_use(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_updated int;
begin
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  update public.fason_access_tokens
    set last_used_at = now(),
        use_count = use_count + 1
    where token_hash = v_hash
      and revoked_at is null;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke execute on function public.fn_increment_fason_token_use(text) from public, authenticated;
grant execute on function public.fn_increment_fason_token_use(text) to service_role;

-- ---------- A7: fn_assign_order_to_fason — outbox'ta ham token yok (Mig 095 taban) ----------
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
set search_path = public
as $$
declare
  v_order record;
  v_fason record;
  v_assignment_id uuid;
  v_token text;
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
         contract_signed_at, contract_pdf_url
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

  insert into public.fason_access_tokens (
    token, assignment_id, fason_partner_id, expires_at
  ) values (
    v_token, v_assignment_id, p_fason_partner_id,
    now() + (p_token_days || ' days')::interval
  );

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
      'assignment_id', v_assignment_id
    ),
    'pending',
    now()
  );

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

-- ---------- C3: süresi geçmiş cold dosyalar da işaretlensin ----------
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
  return query
  update public.design_files df
    set status = 'superseded',
        updated_at = now()
    where df.deletion_due_at is not null
      and df.deletion_due_at < now()
      and df.status in ('approved', 'qc_passed', 'qc_warned')
    returning df.id, df.order_id, df.user_id, df.storage_path, df.deletion_due_at;
end;
$$;

-- ---------- C4: reorder → cold dosya retention da uzasın ----------
create or replace function public.fn_renew_design_retention(
  p_source_order_id text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.design_files
    set last_used_at = now(),
        deletion_due_at = now() + interval '24 months',
        reorder_count = reorder_count + 1,
        updated_at = now()
    where order_id = p_source_order_id
      and status in ('approved', 'qc_passed', 'qc_warned');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.fn_validate_fason_token(text) is
  'Mig 136: doğrulama only — use_count fn_increment_fason_token_use ile (başarılı download sonrası).';

comment on function public.fn_increment_fason_token_use(text) is
  'Mig 136: fason download başarılı olduktan sonra use_count++ (service_role).';

comment on function public.fn_assign_order_to_fason(text, uuid, uuid, date, text, integer) is
  'Mig 136: outbox payload ham token içermez — mail worker assignment_id ile çözer.';
