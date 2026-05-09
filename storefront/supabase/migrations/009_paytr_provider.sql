-- ============================================================
-- Pim Etiket — Migration 009
--
-- payments.psp_provider check constraint'ine 'paytr' eklendi.
-- Sefa karar verdi: iyzico yerine PayTR kullanılacak (komisyon
-- avantajı). Eski 'iyzico' değeri tarihsel kayıtlar için
-- (varsa) korundu.
-- ============================================================

alter table public.payments
  drop constraint if exists payments_psp_provider_check;

alter table public.payments
  add constraint payments_psp_provider_check
  check (psp_provider in (
    'paytr',
    'iyzico',     -- legacy, eski test kayıtları için
    'parampos',
    'stripe',
    'wallet',
    'transfer'
  ));

comment on column public.payments.psp_provider is
  'Ödeme sağlayıcı. Aktif: paytr. Diğerleri legacy/future-proof.';
