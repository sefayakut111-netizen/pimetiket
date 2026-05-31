-- Mig 129: fn_create_partner_with_contacts — admin guard + grant sıkılaştırma
-- Mig 086 authenticated'a execute vermişti; gövdede admin kontrolü yoktu.

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
  if not public.is_admin() then
    raise exception 'forbidden: admin required';
  end if;

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
    v_owner_email,
    v_owner_name,
    coalesce(p_partner->>'status', 'active') = 'active'
  )
  returning id into v_partner_id;

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

revoke execute on function public.fn_create_partner_with_contacts(jsonb, jsonb, jsonb, uuid)
  from authenticated;
grant execute on function public.fn_create_partner_with_contacts(jsonb, jsonb, jsonb, uuid)
  to service_role;

comment on function public.fn_create_partner_with_contacts(jsonb, jsonb, jsonb, uuid) is
  'Mig 129: is_admin() guard + service_role only. Admin panel createAdminClient() ile çağırır.';
