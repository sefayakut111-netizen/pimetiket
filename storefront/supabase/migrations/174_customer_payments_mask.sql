-- Y1: Müşteri payments.psp_raw okuyamasın — maskeli view + doğrudan tablo SELECT kapat.
-- Admin/service_role psp_raw görmeye devam eder.

drop policy if exists "Users can view own payments" on public.payments;

create or replace view public.v_customer_payments as
select
  p.id,
  p.order_id,
  p.psp_provider,
  p.psp_transaction_id,
  p.amount,
  p.currency,
  p.status,
  p.card_masked,
  p.installment,
  p.failure_reason,
  p.created_at,
  p.completed_at
from public.payments p
where exists (
  select 1
  from public.orders o
  where o.id = p.order_id
    and o.user_id = auth.uid()
);

comment on view public.v_customer_payments is
  'Müşteri ödeme özeti — psp_raw HARİÇ. Doğrudan payments tablosu müşteriye kapalı.';

grant select on public.v_customer_payments to authenticated;
revoke select on public.payments from authenticated;
