-- Mig 164: pim_conversations retention — history/facts maskeleme (KVKK m.28)

create or replace function public.fn_anonymize_old_pim_conversations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_exists boolean;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'pim_conversations'
  ) into v_exists;

  if not v_exists then
    return 0;
  end if;

  update public.pim_conversations
     set user_id = null,
         display_name = null,
         facts = '[]'::jsonb,
         history = '[]'::jsonb,
         last_summary = null
   where created_at < now() - interval '6 months'
     and (
       user_id is not null
       or display_name is not null
       or facts <> '[]'::jsonb
       or history <> '[]'::jsonb
       or last_summary is not null
     );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.fn_anonymize_old_pim_conversations()
  from public, authenticated;
grant execute on function public.fn_anonymize_old_pim_conversations()
  to service_role;
