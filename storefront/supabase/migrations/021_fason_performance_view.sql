-- ============================================================
-- Pim Etiket — Migration 021: Fason Performans View + Refresh RPC
--
-- Aylık otomatik performans skorlama:
--   - Teslim zamanı %40 (estimated vs actual)
--   - Kalite (iade) %30
--   - İletişim hızı %15 (sent → in_production süre)
--   - Sorun bildirimi %15 (issue status sayısı)
--
-- Vercel daily cron /api/cron/refresh-fason-scores çağırır.
-- ============================================================

-- ---------- v_fason_performance view ----------
-- Her fason için ham metrikler — saf SQL hesap
create or replace view public.v_fason_performance as
select
  fp.id as fason_id,
  fp.name as fason_name,
  fp.active,

  -- Toplam tamamlanmış atama (shipped status)
  count(distinct oa.id) filter (where oa.status = 'shipped') as shipped_count,
  count(distinct oa.id) filter (where oa.status = 'cancelled') as cancelled_count,
  count(distinct oa.id) filter (where oa.status = 'issue') as issue_count,
  count(distinct oa.id) as total_assignments,

  -- Teslim zamanı tutturma (on-time rate)
  -- shipped olanlardan: actual_delivery <= estimated_delivery
  case
    when count(*) filter (where oa.status = 'shipped' and oa.actual_delivery is not null) > 0 then
      (count(*) filter (
        where oa.status = 'shipped'
          and oa.actual_delivery is not null
          and oa.actual_delivery <= oa.estimated_delivery
      )::numeric / count(*) filter (where oa.status = 'shipped' and oa.actual_delivery is not null))
    else null
  end as on_time_rate,

  -- İade oranı (kalite metriği)
  -- shipped olan siparişlerden iade gelmiş mi
  case
    when count(*) filter (where oa.status = 'shipped') > 0 then
      coalesce(
        (count(distinct r.order_id) filter (where r.order_id is not null)::numeric
          / count(*) filter (where oa.status = 'shipped')),
        0
      )
    else null
  end as return_rate,

  -- İletişim hızı: sent → in_production ortalama saat
  -- 24 saatten kısa = iyi
  case
    when count(*) filter (where oa.sent_at is not null and oa.in_production_at is not null) > 0 then
      avg(
        extract(epoch from (oa.in_production_at - oa.sent_at)) / 3600
      ) filter (where oa.sent_at is not null and oa.in_production_at is not null)
    else null
  end as avg_response_hours,

  -- Sorun bildirim oranı
  case
    when count(distinct oa.id) > 0 then
      (count(distinct oa.id) filter (where oa.status = 'issue')::numeric / count(distinct oa.id))
    else 0
  end as issue_rate,

  -- Son atama tarihi
  max(oa.assigned_at) as last_assigned_at

from public.fason_partners fp
left join public.order_assignments oa on oa.fason_partner_id = fp.id
left join public.returns r on r.order_id = oa.order_id
group by fp.id, fp.name, fp.active;

-- ---------- fn_refresh_fason_scores ----------
-- View'dan composite skor hesapla + cached_score güncelle
-- Skor formülü (0-1 arası):
--   - on_time_rate × 0.40   (yoksa 0.7 varsayılan)
--   - (1 - return_rate) × 0.30 (yoksa 1.0 varsayılan)
--   - response_score × 0.15 (24sa altı = 1, 48sa+ = 0)
--   - (1 - issue_rate) × 0.15
create or replace function public.fn_refresh_fason_scores()
returns table(fason_id uuid, fason_name text, new_score numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner record;
  v_score numeric(3, 2);
  v_on_time numeric;
  v_return numeric;
  v_response_score numeric;
  v_issue numeric;
begin
  for v_partner in
    select * from public.v_fason_performance where active = true
  loop
    -- Varsayılan değerlerle başla (yeni fason için)
    v_on_time := coalesce(v_partner.on_time_rate, 0.7);
    v_return := coalesce(v_partner.return_rate, 0.0);

    -- Response score: 24 saat altı = 1, 24-48 arası lineer, 48+ = 0
    if v_partner.avg_response_hours is null then
      v_response_score := 0.7;
    elsif v_partner.avg_response_hours <= 24 then
      v_response_score := 1.0;
    elsif v_partner.avg_response_hours >= 48 then
      v_response_score := 0.0;
    else
      v_response_score := (48 - v_partner.avg_response_hours) / 24;
    end if;

    v_issue := coalesce(v_partner.issue_rate, 0.0);

    -- Composite skor
    v_score := (v_on_time * 0.40) +
               ((1 - v_return) * 0.30) +
               (v_response_score * 0.15) +
               ((1 - v_issue) * 0.15);

    -- Clamp 0-1
    v_score := greatest(0, least(1, v_score));

    -- Cache güncelle
    update public.fason_partners
    set cached_score = round(v_score, 2),
        score_updated_at = now()
    where id = v_partner.fason_id;

    fason_id := v_partner.fason_id;
    fason_name := v_partner.fason_name;
    new_score := round(v_score, 2);
    return next;
  end loop;
end;
$$;

grant execute on function public.fn_refresh_fason_scores() to authenticated;
grant execute on function public.fn_refresh_fason_scores() to service_role;

-- ---------- Helper: önerilen fason seç ----------
-- Smart picker — specialty match + skor + load balance
create or replace function public.fn_suggest_fason_partner(
  p_specialty text
)
returns table(
  fason_id uuid,
  fason_name text,
  cached_score numeric,
  active_count bigint,
  reason text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    fp.id,
    fp.name,
    fp.cached_score,
    count(oa.id) filter (where oa.status in ('assigned','sent','acknowledged','in_production'))
      as active_count,
    case
      when fp.cached_score is null then 'Yeni fason, deneme önerilir'
      when fp.cached_score >= 0.9 then 'Yüksek performans (⭐ öncelikli)'
      when fp.cached_score >= 0.7 then 'Normal performans'
      else 'Düşük performans (dikkat)'
    end as reason
  from public.fason_partners fp
  left join public.order_assignments oa on oa.fason_partner_id = fp.id
  where fp.active = true
    and (p_specialty is null or p_specialty = any(fp.specialties))
    and fp.contract_signed_at is not null    -- Sözleşmesiz fason'a iş gitmez
  group by fp.id, fp.name, fp.cached_score
  order by
    coalesce(fp.cached_score, 0.5) desc,     -- Yüksek skor öne
    count(oa.id) filter (where oa.status in ('assigned','sent','acknowledged','in_production')) asc -- Az yük öne
  limit 5;
end;
$$;

grant execute on function public.fn_suggest_fason_partner(text) to authenticated;
grant execute on function public.fn_suggest_fason_partner(text) to service_role;

-- ============================================================
-- Migration 021 sonu
-- ============================================================
