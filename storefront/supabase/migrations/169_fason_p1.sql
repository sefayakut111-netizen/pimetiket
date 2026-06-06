-- Mig 169 — Fason P1: partner_review atama, issue unique index, is_urgent temizle

-- P1#10: Kapasite sayımı issue dahil → partial unique index de issue içermeli
drop index if exists public.order_assignments_one_active_idx;

create unique index order_assignments_one_active_idx
  on public.order_assignments(order_id)
  where status in (
    'assigned', 'sent', 'acknowledged', 'in_production', 'ready', 'issue'
  );

-- P1#6: Atama sonrası müşteri-onaylı kalemleri partner_review'e geçir (Mig 084)
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
  v_items_updated integer;
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

  update public.order_items
    set proof_status = 'partner_review'
    where order_id = p_order_id
      and proof_status = 'approved';
  get diagnostics v_items_updated = row_count;

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
      'estimated_delivery', p_estimated_delivery,
      'items_to_partner_review', v_items_updated
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
  'Mig 169: atama sonrası proof_status partner_review; hash-only token (Mig 168).';

-- P1#12: Yarım is_urgent özelliği — kolon kaldır (SLA tabanlı acil kuyruk kalır)
alter table public.order_assignments
  drop column if exists is_urgent;
