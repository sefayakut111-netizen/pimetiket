-- ============================================================
-- Pim Etiket — Migration 012: Funnel Avg Durations RPC
--
-- Dashboard funnel kartlarında her durumda ortalama bekleme süresini
-- göstermek için. order_events log'undan hesaplar.
--
-- Mantık:
--   - order_events'te aynı order_id için status_after = X eventi
--   - Sıradaki event başka status'a geçişi temsil eder
--   - Aradaki süre = X durumunda geçirilen zaman
--   - Tüm siparişler için status'a göre AVG
-- ============================================================

create or replace function public.fn_funnel_avg_durations()
returns table(
  status public.order_status,
  avg_seconds numeric,
  sample_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with events_ordered as (
    select
      order_id,
      status_after,
      created_at,
      lead(created_at) over (partition by order_id order by created_at) as next_at
    from public.order_events
    where status_after is not null
  ),
  durations as (
    select
      status_after as status,
      extract(epoch from (next_at - created_at)) as duration_sec
    from events_ordered
    where next_at is not null
  )
  select
    status,
    coalesce(avg(duration_sec), 0)::numeric as avg_seconds,
    count(*)::bigint as sample_count
  from durations
  where duration_sec > 0
  group by status;
$$;

grant execute on function public.fn_funnel_avg_durations() to authenticated;

-- Adminlerin çalıştırabilmesi için RLS guard yok (security definer + admin endpoint)
