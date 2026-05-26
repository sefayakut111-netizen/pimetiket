-- ============================================================
-- Migration 107 — Multi-design supersede düzeltmesi
--
-- Sorun: fn_supersede_old_versions, version < new.version ile
-- eski kayıtları supersede ediyordu. Multi-design'da v1–v4 paralel
-- slot (Tasarım 1–4); v4 eklenince v1–v3 siliniyordu.
--
-- Düzeltme: Aynı (order_id, order_item_id, version) için yalnızca
-- eski kayıt supersede edilir — yeni versiyon yükleme akışı.
-- ============================================================

create or replace function public.fn_supersede_old_versions()
returns trigger
language plpgsql
as $$
begin
  if new.order_item_id is not null then
    update public.design_files
      set status = 'superseded'
      where order_id = new.order_id
        and order_item_id = new.order_item_id
        and id <> new.id
        and version = new.version
        and status not in ('approved', 'superseded');
  end if;
  return new;
end;
$$;

comment on function public.fn_supersede_old_versions is
  'Aynı slot (version) için eski design_file kaydını superseded yapar. Multi-design slotları birbirini etkilemez.';
