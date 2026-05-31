-- Tek sipariş için aynı anda yalnızca bir pending iade talebi
create unique index if not exists returns_one_pending_per_order_idx
  on public.returns (order_id)
  where status = 'pending';
