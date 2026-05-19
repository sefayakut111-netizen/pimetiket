-- ============================================================
-- Migration 066 — Cutline + help request RLS policy genişletme
-- ============================================================
-- Sefa 19 May v68 (Agent denetim Backend P1 #13, P2 — backend agent):
--
-- 1. cutline_designs_owner_insert (Mig 059) sadece 'proof_pending'
--    statüsünü kapsıyordu. Mig 061'le awaiting_upload + Mig 062'yle
--    proof_generating state'leri geldi — müşteri bu aşamalarda
--    cutline INSERT yapamıyordu. Multi-design akışı sessizce kırılırdı.
--
-- 2. proof_help_requests için UPDATE policy hiç yoktu (Mig 059 sadece
--    SELECT + INSERT). Müşteri ticket açıyor, çözüldü/kapatıldı durumu
--    için update gerekirse RLS bloklar. Service role kullanılırsa zaten
--    bypass ama RLS bütünlüğü için açık güzergâh kalmamış.
-- ============================================================

-- 1) cutline_designs INSERT policy genişlet
drop policy if exists cutline_designs_owner_insert on public.cutline_designs;
create policy cutline_designs_owner_insert
  on public.cutline_designs for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.user_id = auth.uid()
        -- Mig 066: 'proof_pending' (Mig 059) + 'proof_generating' (Mig 062)
        --        + 'awaiting_upload' (Mig 061) state'leri kapsanır
        and o.status in (
          'awaiting_upload',
          'proof_generating',
          'proof_pending'
        )
    )
  );

-- 2) proof_help_requests UPDATE policy ekle (müşteri kendi ticket'ını günceller)
--    Status 'open' iken kendi user_id ile guard — admin tarafı service role.
drop policy if exists proof_help_requests_owner_update on public.proof_help_requests;
create policy proof_help_requests_owner_update
  on public.proof_help_requests for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- Yorumlar
-- ============================================================
comment on policy cutline_designs_owner_insert on public.cutline_designs is
  'Mig 066: awaiting_upload + proof_generating + proof_pending state''lerinde müşteri kendi siparişine cutline INSERT eder. Multi-design akışı bu state''lerin tümünde aktif.';

comment on policy proof_help_requests_owner_update on public.proof_help_requests is
  'Mig 066: Müşteri kendi yardım ticket''ını günceller (örn. mesaj ekler). Admin tarafı service role kullanır.';
