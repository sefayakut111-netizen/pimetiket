-- ============================================================
-- Pim Etiket — Migration 025: Fason performans view fix + outbox TTL
--
-- (1) v_fason_performance bug fix:
--     `returns` join'i `r.order_id = oa.order_id` üzerinden cross-join
--     etkisi yaratıyordu. Bir order'a 2 iade gelirse `count(*)`
--     denominator'ları çoklanıyordu (shipped sayısı için
--     `count(distinct oa.id)` doğru ama return_rate paydası
--     `count(*) filter where shipped` non-distinct → bozuk oran).
--     Çözüm: returns'u CTE içinde distinct'le, scalar subquery ile çek.
--
-- (2) fason_mail_outbox.payload PII saklama minimizasyonu (KVKK m.4):
--     sent/failed kayıtlarda fason_token + order_id payload'da
--     süresiz kalıyordu. 30 gün sonra payload'u NULL'la
--     (audit fields kalır: status, attempts, sent_at, resend_message_id).
-- ============================================================

-- ---------- v_fason_performance — bug fix ----------
create or replace view public.v_fason_performance as
with
  -- Her assignment için 1 satır + iade var mı bayrağı
  oa_enriched as (
    select
      oa.id,
      oa.fason_partner_id,
      oa.order_id,
      oa.status,
      oa.sent_at,
      oa.in_production_at,
      oa.assigned_at,
      oa.actual_delivery,
      oa.estimated_delivery,
      exists (
        select 1 from public.returns r
          where r.order_id = oa.order_id
      ) as has_return
    from public.order_assignments oa
  )
select
  fp.id as fason_id,
  fp.name as fason_name,
  fp.active,

  -- Toplam tamamlanmış atama
  count(*) filter (where oae.status = 'shipped') as shipped_count,
  count(*) filter (where oae.status = 'cancelled') as cancelled_count,
  count(*) filter (where oae.status = 'issue') as issue_count,
  count(oae.id) as total_assignments,

  -- Teslim zamanı tutturma (on-time rate)
  case
    when count(*) filter (
      where oae.status = 'shipped' and oae.actual_delivery is not null
    ) > 0 then
      (count(*) filter (
        where oae.status = 'shipped'
          and oae.actual_delivery is not null
          and oae.actual_delivery <= oae.estimated_delivery
      )::numeric
       / count(*) filter (where oae.status = 'shipped' and oae.actual_delivery is not null))
    else null
  end as on_time_rate,

  -- İade oranı: shipped olanlardan kaçında iade var?
  -- Artık `has_return` bool sayesinde join çoklanması yok.
  case
    when count(*) filter (where oae.status = 'shipped') > 0 then
      (count(*) filter (where oae.status = 'shipped' and oae.has_return)::numeric
        / count(*) filter (where oae.status = 'shipped'))
    else null
  end as return_rate,

  -- İletişim hızı
  case
    when count(*) filter (where oae.sent_at is not null and oae.in_production_at is not null) > 0 then
      avg(
        extract(epoch from (oae.in_production_at - oae.sent_at)) / 3600
      ) filter (where oae.sent_at is not null and oae.in_production_at is not null)
    else null
  end as avg_response_hours,

  -- Sorun bildirim oranı
  case
    when count(oae.id) > 0 then
      (count(*) filter (where oae.status = 'issue')::numeric / count(oae.id))
    else 0
  end as issue_rate,

  max(oae.assigned_at) as last_assigned_at

from public.fason_partners fp
left join oa_enriched oae on oae.fason_partner_id = fp.id
group by fp.id, fp.name, fp.active;

-- ---------- fn_cleanup_outbox_payload ----------
-- 30 gün önce sent/failed (max attempt) olan kayıtların payload'unu NULL'la.
-- order_id ve fason_token gibi PII alanları payload jsonb'inde idi.
create or replace function public.fn_cleanup_outbox_payload()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.fason_mail_outbox
    set payload = '{}'::jsonb,
        updated_at = now()
    where (status = 'sent' and sent_at < now() - interval '30 days')
       or (status = 'failed'
           and updated_at < now() - interval '30 days'
           and (next_retry_at is null or attempts >= 6));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.fn_cleanup_outbox_payload()
  from public, authenticated;
grant execute on function public.fn_cleanup_outbox_payload()
  to service_role;

-- ============================================================
-- Migration 025 sonu
-- ============================================================
