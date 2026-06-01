-- Mig 132: fason_access_tokens max_use_count + fn_validate_fason_token limit

alter table public.fason_access_tokens
  add column if not exists max_use_count int not null default 200;

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

grant execute on function public.fn_validate_fason_token(text) to authenticated;
grant execute on function public.fn_validate_fason_token(text) to service_role;

comment on function public.fn_validate_fason_token(text) is
  'Mig 132: max_use_count (default 200) aşılırsa token_limit_exceeded. Hash lookup Mig 089.';
