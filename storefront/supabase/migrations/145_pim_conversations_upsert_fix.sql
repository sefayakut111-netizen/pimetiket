-- Mig 145: pim_conversations upsert/RLS düzeltmesi
-- Partial unique index + upsert bazen 500 veriyordu; tam unique + update WITH CHECK.

drop index if exists public.pim_conversations_user_idx;

create unique index if not exists pim_conversations_user_id_key
  on public.pim_conversations(user_id);

drop policy if exists "pim_conv_own_update" on public.pim_conversations;
create policy "pim_conv_own_update" on public.pim_conversations
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
