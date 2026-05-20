-- ============================================================
-- Pim Etiket — Migration 070: Proof Pending SLA Kaskadı (P1 #10)
--
-- Sefa 20 May v68 (8-agent denetim P1 #10):
-- Mig 017'deki 36 saat = otomatik iade kuralı korunur (anayasa).
-- Tek değişiklik: 12 saat civarı **pre-warning** (hatırlatma) maili.
--
-- Müşteri davranışı: prova mailini görmemiş olabilir → 36'te sessizce
-- iade → şikayet. Pre-warning ile "iade öncesi son şans" anonsu yapılır.
--
-- Vercel Hobby cron limiti = günde 1 kez (02:00). 12 saat = idealde
-- ayrı bir kontrol ama tek cron ile yaklaşımlar:
--   • Her sipariş için event log'da "reminder_12h_sent" varsa atla
--   • 12sa ≤ yaş < 36sa → reminder action
--   • yaş ≥ 36sa → refund action
--
-- RPC yapısı: action+order_id+user_id+hours döndürür, route.ts hangi
-- maili göndereceğine veya iade tetikleyeceğine bakar.
--
-- ⚠️ Mig 017 (fn_auto_refund_stale_proofs) DEPRECATED edilmez —
-- gerivansızlık için bırakılır, sadece artık çağrılmaz. P1 #10 cron
-- bu yeni RPC'yi çağırır.
-- ============================================================

create or replace function public.fn_process_proof_pending_sla()
returns table(
  order_id text,
  user_id uuid,
  action text,           -- 'reminder' | 'refund'
  hours_since_proof numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_hours numeric;
  v_reminder_sent boolean;
begin
  for v_order in
    select id, proof_uploaded_at, user_id, status
    from public.orders
    where status = 'proof_pending'
      and proof_uploaded_at is not null
      and proof_uploaded_at < now() - interval '12 hours'
    order by proof_uploaded_at asc
  loop
    v_hours := extract(epoch from (now() - v_order.proof_uploaded_at)) / 3600;

    -- 36+ saat: otomatik iade (Mig 017 mantığı korundu)
    if v_hours >= 36 then
      update public.orders
      set status = 'cancelled'
      where id = v_order.id;

      insert into public.order_events (
        order_id, event_type, status_after, actor_role, summary, detail
      ) values (
        v_order.id,
        'auto_refund_stale_proof',
        'cancelled',
        'system',
        '36 saat onaysız iade — müşteri prova onayı vermedi',
        jsonb_build_object('auto', true, 'hours_since_proof', v_hours)
      );

      order_id := v_order.id;
      user_id := v_order.user_id;
      action := 'refund';
      hours_since_proof := v_hours;
      return next;

    -- 12-36 saat aralığı: hatırlatma (idempotent — daha önce gönderilmediyse)
    else
      select exists (
        select 1
        from public.order_events
        where order_events.order_id = v_order.id
          and event_type = 'proof_reminder_12h_sent'
      ) into v_reminder_sent;

      if not v_reminder_sent then
        insert into public.order_events (
          order_id, event_type, actor_role, summary, detail
        ) values (
          v_order.id,
          'proof_reminder_12h_sent',
          'system',
          '12 saat onaysız — hatırlatma maili kuyruğa alındı',
          jsonb_build_object('hours_since_proof', v_hours)
        );

        order_id := v_order.id;
        user_id := v_order.user_id;
        action := 'reminder';
        hours_since_proof := v_hours;
        return next;
      end if;
    end if;
  end loop;
end;
$$;

grant execute on function public.fn_process_proof_pending_sla() to authenticated;
grant execute on function public.fn_process_proof_pending_sla() to service_role;

comment on function public.fn_process_proof_pending_sla() is
  'P1 #10 SLA kaskadı — 12sa pre-warning + 36sa auto-refund. Mig 017''yi soft-replace eder, cron tarafından günlük çağrılır.';
