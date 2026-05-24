-- ============================================================
-- Pim Etiket — Migration 086: Partner Contract Alignment
-- ============================================================
--
-- Sefa 23 May v68. Güvenlik analizi bulguları P0.7 + P0.8.
-- Tam liste: memory/project_security_findings_2026_05_23.md
--
-- Sorun:
--   Mig 067 ile yeni partner formu eklendi. Form contract_pdf_url
--   gönderiyor; fason_partners.contract_signed_at otomatik set
--   ediliyor (now()) AMA sadece form contract_pdf_url key'i içeriyorsa.
--   Mig 024 fn_assign_order_to_fason `contract_signed_at IS NULL` →
--   fason_no_contract reddediyor. Eğer yeni partner formu PDF
--   yüklemeden açılırsa atama her zaman patlar; Mig 068 auto-assign
--   trigger'ı bunu sessizce yutar → "neden hiç atama yok" bug'ı.
--
--   Ayrıca fn_find_best_partner sözleşmeyi hiç kontrol etmiyor —
--   sözleşmesiz partner UI'da öneri olarak çıkar.
--
--   Mig 067 fn_create_partner_with_contacts owner email yoksa
--   'placeholder@pimetiket.com' fallback yazıyor — KVKK info-leak.
--
-- Çözüm:
--   1) fn_assign_order_to_fason kontrolünü genişlet:
--        contract_signed_at IS NOT NULL OR contract_pdf_url IS NOT NULL
--   2) fn_find_best_partner WHERE'a aynı kontrolü ekle (öneri eligible)
--   3) fn_create_partner_with_contacts placeholder fallback yerine
--      RAISE EXCEPTION ('owner_contact_email_required')
-- ============================================================


-- ------------------------------------------------------------
-- 1) fn_assign_order_to_fason — contract kontrol genişlet
-- ------------------------------------------------------------
-- Mig 024'ün tam halini koruyarak yalnızca SELECT alanları + kontrol
-- bloğu güncellendi (satır 53-66 mantığı). Diğer adımlar (assignment,
-- token, outbox, order_events, status update) bire bir aynı.
-- ------------------------------------------------------------

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
  -- 1) Sipariş kontrolü
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

  -- 2) Fason kontrolü (active + sözleşme: signed_at VEYA pdf_url)
  --    Mig 086: yeni form contract_pdf_url üzerinden gelir; eski
  --    flow contract_signed_at manuel set ediyordu. İkisini de kabul.
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

  -- 3) Assignment INSERT
  insert into public.order_assignments (
    order_id, fason_partner_id, status,
    assigned_by, estimated_delivery, notes
  ) values (
    p_order_id, p_fason_partner_id, 'assigned',
    p_admin_user_id, p_estimated_delivery, p_notes
  )
  returning id into v_assignment_id;

  -- 4) Token üret
  v_token := replace(gen_random_uuid()::text, '-', '') ||
             replace(gen_random_uuid()::text, '-', '');

  insert into public.fason_access_tokens (
    token, assignment_id, fason_partner_id, expires_at
  ) values (
    v_token, v_assignment_id, p_fason_partner_id,
    now() + (p_token_days || ' days')::interval
  );

  -- 5) Mail outbox
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
      'fason_token', v_token
    ),
    'pending',
    now()
  );

  -- 6) Order events log
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

  -- 7) Orders status → in_production
  if v_order.status in ('paid', 'qc_pending', 'qc_flagged',
                        'operator_review', 'proof_pending') then
    update public.orders
      set status = 'in_production'
      where id = p_order_id;
    order_status_after := 'in_production';
  else
    order_status_after := v_order.status;
  end if;

  assignment_id := v_assignment_id;
  fason_token := v_token;
  order_status_before := v_order.status;
  return next;
end;
$$;

-- Grant Mig 024'tekiyle aynı kalır
revoke execute on function public.fn_assign_order_to_fason(text, uuid, uuid, date, text, integer)
  from public, authenticated;
grant execute on function public.fn_assign_order_to_fason(text, uuid, uuid, date, text, integer)
  to service_role;

comment on function public.fn_assign_order_to_fason(text, uuid, uuid, date, text, integer) is
  'Mig 086: Sözleşme kontrolü genişletildi — contract_signed_at VEYA '
  'contract_pdf_url yeterli. Mig 067 yeni form ile uyum.';


-- ------------------------------------------------------------
-- 2) fn_find_best_partner — sözleşme kontrolü ekle
-- ------------------------------------------------------------
-- Mig 067 fn_find_best_partner sözleşmesiz partner'ı UI'da öneri
-- olarak çıkarıyordu. Auto-assign trigger önerilen partner'a atama
-- yapmaya çalışınca fn_assign... `fason_no_contract` ile patlıyordu.
-- WHERE'a sözleşme kontrolü ekleniyor — eligible pool tutarlı.
-- ------------------------------------------------------------

create or replace function public.fn_find_best_partner(
  p_product_type text,
  p_material text,
  p_order_amount numeric default 0
)
returns table (
  partner_id uuid,
  partner_name text,
  default_lead_days int,
  cached_score numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    p.id,
    p.name,
    p.default_lead_days,
    p.cached_score
  from public.fason_partners p
  where p.status = 'active'
    -- Mig 086: sözleşme zorunlu (PDF veya signed)
    and (
      p.contract_signed_at is not null
      or (p.contract_pdf_url is not null and length(trim(p.contract_pdf_url)) > 0)
    )
    -- product_type capability match
    and exists (
      select 1 from public.partner_capabilities pc
      where pc.partner_id = p.id
        and pc.capability_type = 'product_type'
        and pc.capability_value = p_product_type
    )
    -- material capability match
    and (
      p_material is null
      or exists (
        select 1 from public.partner_capabilities pc
        where pc.partner_id = p.id
          and pc.capability_type = 'material'
          and pc.capability_value = p_material
      )
    )
    and (p.min_order_amount_try is null or p.min_order_amount_try <= p_order_amount)
  order by
    coalesce(p.cached_score, 0.5) desc,
    p.default_lead_days asc;
end;
$$;

grant execute on function public.fn_find_best_partner(text, text, numeric)
  to authenticated;

comment on function public.fn_find_best_partner(text, text, numeric) is
  'Mig 086: Sözleşmesiz partner artık önerilmez. WHERE clause''a '
  'contract_signed_at OR contract_pdf_url kontrolü eklendi.';


-- ------------------------------------------------------------
-- 3) fn_create_partner_with_contacts — placeholder fallback kaldır
-- ------------------------------------------------------------
-- Mig 067 satır 209-213: owner contact email'i yoksa
-- 'placeholder@pimetiket.com' yazılıyordu. Sipariş bildirim mailleri
-- bu adrese gidiyor → KVKK info-leak + spam.
-- Çözüm: fonksiyonun başında owner email zorunluluğu hard-fail.
-- ------------------------------------------------------------

create or replace function public.fn_create_partner_with_contacts(
  p_partner jsonb,
  p_contacts jsonb,
  p_capabilities jsonb,
  p_admin_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id uuid;
  v_contact jsonb;
  v_cap jsonb;
  v_owner_email text;
  v_owner_name text;
begin
  -- Mig 086: Owner contact email zorunlu — placeholder fallback kaldırıldı.
  select c->>'email', c->>'name'
    into v_owner_email, v_owner_name
    from jsonb_array_elements(p_contacts) c
    where c->>'role' = 'owner'
    limit 1;

  if v_owner_email is null
     or length(trim(v_owner_email)) = 0
     or v_owner_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'owner_contact_email_required'
      using errcode = '22023',
            hint = 'p_contacts must include one entry with role=owner and a valid email';
  end if;

  -- 1) Partner INSERT
  insert into public.fason_partners (
    name, short_name, tax_number, tax_office,
    address_line, city, town,
    status, default_lead_days, express_lead_time_days, min_order_amount_try,
    payment_term, iban, contract_pdf_url, contract_uploaded_at,
    notes, created_by, updated_by,
    contact_email, contact_person,
    active
  ) values (
    p_partner->>'name',
    p_partner->>'short_name',
    p_partner->>'tax_number',
    p_partner->>'tax_office',
    p_partner->>'address_line',
    p_partner->>'city',
    p_partner->>'town',
    coalesce(p_partner->>'status', 'active'),
    coalesce((p_partner->>'default_lead_time_days')::int, 7),
    nullif(p_partner->>'express_lead_time_days', '')::int,
    nullif(p_partner->>'min_order_amount_try', '')::numeric,
    p_partner->>'payment_term',
    p_partner->>'iban',
    p_partner->>'contract_pdf_url',
    case when p_partner ? 'contract_pdf_url' and p_partner->>'contract_pdf_url' is not null
         then now() else null end,
    p_partner->>'notes',
    p_admin_id,
    p_admin_id,
    -- Mig 086: artık zorunlu owner email (yukarıda validate edildi)
    v_owner_email,
    v_owner_name,
    coalesce(p_partner->>'status', 'active') = 'active'
  )
  returning id into v_partner_id;

  -- 2) Contacts INSERT (her role)
  for v_contact in select * from jsonb_array_elements(p_contacts)
  loop
    if (v_contact->>'name') is not null and length(v_contact->>'name') > 0 then
      insert into public.partner_contacts (
        partner_id, role, name, title, email, phone_e164, auto_notification
      ) values (
        v_partner_id,
        v_contact->>'role',
        v_contact->>'name',
        v_contact->>'title',
        v_contact->>'email',
        v_contact->>'phone_e164',
        coalesce((v_contact->>'auto_notification')::boolean, false)
      );
    end if;
  end loop;

  -- 3) Capabilities INSERT
  for v_cap in select * from jsonb_array_elements(p_capabilities)
  loop
    insert into public.partner_capabilities (
      partner_id, capability_type, capability_value
    ) values (
      v_partner_id,
      v_cap->>'type',
      v_cap->>'value'
    )
    on conflict (partner_id, capability_type, capability_value) do nothing;
  end loop;

  return v_partner_id;
end;
$$;

grant execute on function public.fn_create_partner_with_contacts(jsonb, jsonb, jsonb, uuid)
  to authenticated;

comment on function public.fn_create_partner_with_contacts(jsonb, jsonb, jsonb, uuid) is
  'Mig 086: Owner contact email zorunlu (regex validate). Placeholder '
  'fallback kaldırıldı — eskiden owner email yoksa placeholder@pimetiket.com '
  'yazılırdı, KVKK info-leak. Şimdi hard-fail.';


-- ============================================================
-- Migration 086 sonu
-- ============================================================
-- Test öncesi backfill:
--   Mig 067 sonrası kayıtlı partnerlardan placeholder email içeren
--   olabilir. Önce sorgu:
--     select id, name, contact_email
--       from public.fason_partners
--       where contact_email = 'placeholder@pimetiket.com';
--   Varsa Sefa elle düzeltir (gerçek owner email girer) — sonra Mig 086
--   uygulanır.
-- ============================================================
