-- ============================================================
-- Migration 153: mail_outbox target_type — ticket desteği
-- Destek talebi mail bildirimi (admin_new_support_ticket) için.
-- Idempotent: constraint drop + yeniden oluştur.
-- ============================================================

alter table public.fason_mail_outbox
  drop constraint if exists fason_mail_outbox_target_type_check;

alter table public.fason_mail_outbox
  add constraint fason_mail_outbox_target_type_check
  check (target_type in (
    'assignment',
    'order',
    'subscriber',
    'user',
    'cart',
    'ticket',
    null
  ));

comment on column public.fason_mail_outbox.target_type is
  'Polymorphic ref tipi: assignment | order | subscriber | user | cart | ticket';
