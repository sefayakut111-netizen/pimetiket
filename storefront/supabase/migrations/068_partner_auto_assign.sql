-- ============================================================
-- Migration 068 — Üretim Partneri otomatik atama trigger
-- ============================================================
-- Sefa 20 May v68 (Faz 3 — otomatik iş akışı):
--
-- Müşteri /onay'da tüm provaları onayladı → orders.status = 'proof_approved'
-- → DB trigger (mevcut Mig 059 trg_proof_approved) → 'ready_to_ship'
--
-- ŞİMDİ (Mig 068): status 'ready_to_ship'e geçtiğinde:
--   1. site_settings.partner_auto_assign_enabled FALSE ise no-op (admin manuel)
--   2. Order items'tan product_type + material set'i çıkar
--   3. fn_find_best_partner (Mig 067) çağır
--   4. Bulundu → fn_assign_order_to_fason çağır (Mig 024 — mevcut atomic
--      atama + token + mail outbox)
--   5. Bulunamadı → no-op (status ready_to_ship kalır, admin atar)
--
-- FEATURE FLAG: Default kapalı (site_settings.partner_auto_assign_enabled).
-- Sefa /admin/ayarlar'dan açar, ilk 5 sipariş manuel olarak izledikten
-- sonra otomasyona geçer.
-- ============================================================

-- 1) site_settings'a auto_assign flag ekle
alter table public.site_settings
  add column if not exists partner_auto_assign_enabled boolean not null default false;

comment on column public.site_settings.partner_auto_assign_enabled is
  'Mig 068: TRUE ise orders.status=ready_to_ship trigger otomatik partner atar. FALSE (default) ise admin /admin/siparisler/[id]''den manuel atar.';

-- ============================================================
-- 2) Item material → capability_value map (sticker + etiket)
-- ============================================================
create or replace function public.fn_map_item_to_capability(
  p_product text,           -- 'sticker' | 'etiket'
  p_meta jsonb              -- order_items.meta
)
returns table (
  product_type text,
  material text
)
language plpgsql
immutable
as $$
declare
  v_material_id text;
  v_form_factor text;
begin
  v_material_id := lower(coalesce(p_meta->>'materialId', p_meta->>'material', ''));
  v_form_factor := lower(coalesce(p_meta->>'formFactor', ''));

  -- product_type derivation
  if p_product = 'sticker' then
    product_type := 'sticker';
  elsif v_form_factor = 'tabaka' then
    product_type := 'sheet_label';
  else
    product_type := 'roll_label';  -- default rulo
  end if;

  -- material derivation (capability_value)
  material := case
    -- sticker materials
    when v_material_id in ('vinil', 'opak', 'opakpp', 'beyaz') then 'paper'
    when v_material_id in ('transparan', 'seffaf', 'ultra', 'ultraclear') then 'transparent'
    when v_material_id in ('holo', 'holografik', 'holographic') then 'holographic'
    when v_material_id in ('simli', 'metalik', 'metalize', 'metallic') then 'metallic'
    -- etiket materials
    when v_material_id in ('kuse', 'kraft', 'kuşe') then 'paper'
    else null  -- bilinmeyen → material filter atla
  end;

  return next;
end;
$$;

-- ============================================================
-- 3) Auto-assign trigger function
-- ============================================================
create or replace function public.fn_auto_assign_partner_on_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
  v_first_item record;
  v_cap record;
  v_partner record;
  v_assignment_id uuid;
  v_total numeric;
  v_existing int;
  v_estimated_delivery date;
begin
  -- Sadece 'ready_to_ship'e geçişte tetikle
  if not (
    (TG_OP = 'UPDATE' and OLD.status <> 'ready_to_ship' and NEW.status = 'ready_to_ship')
    or (TG_OP = 'INSERT' and NEW.status = 'ready_to_ship')
  ) then
    return NEW;
  end if;

  -- Feature flag kontrol
  select partner_auto_assign_enabled into v_enabled
    from public.site_settings where id = 1;
  if not coalesce(v_enabled, false) then
    return NEW;
  end if;

  -- Zaten aktif atama var mı? (Mig 018 partial unique index zaten korur
  -- ama exception fırlatmadan kontrol et)
  select count(*) into v_existing
    from public.order_assignments
    where order_id = NEW.id
      and status in ('assigned', 'sent', 'acknowledged', 'in_production', 'ready');
  if v_existing > 0 then
    return NEW;  -- Manuel atama yapılmış, dokunma
  end if;

  -- İlk item'dan product_type + material türet (multi-item ise ilk item kuralı)
  select oi.product, oi.meta into v_first_item
    from public.order_items oi
    where oi.order_id = NEW.id
    order by oi.id
    limit 1;
  if not found then
    return NEW;
  end if;

  select * into v_cap
    from public.fn_map_item_to_capability(v_first_item.product, v_first_item.meta);
  if v_cap.product_type is null then
    return NEW;  -- bilinmeyen ürün → admin manuel
  end if;

  v_total := NEW.total;

  -- En uygun partner bul
  select partner_id, default_lead_days into v_partner
    from public.fn_find_best_partner(v_cap.product_type, v_cap.material, v_total)
    limit 1;
  if v_partner.partner_id is null then
    -- Eligible partner yok — admin manuel atayacak
    return NEW;
  end if;

  v_estimated_delivery := (current_date + v_partner.default_lead_days * interval '1 day')::date;

  -- Mevcut atomic atama RPC'sini çağır (Mig 024)
  -- assigned_by null kabul edilmez (auth.users FK) → null olabilir, set null ile FK uyumlu
  begin
    perform public.fn_assign_order_to_fason(
      NEW.id,
      v_partner.partner_id,
      null,                       -- p_admin_user_id (otomatik → audit_log'da null görünür)
      v_estimated_delivery,
      'Otomatik atama (capability match): ' || v_cap.product_type
        || coalesce(' + ' || v_cap.material, ''),
      14
    );
  exception when others then
    -- Atama başarısız → no-op, admin manuel atar; trigger sessiz kalır
    -- (raise notice 'auto_assign_failed: %', SQLERRM;)
    return NEW;
  end;

  return NEW;
end;
$$;

-- ============================================================
-- 4) Trigger orders.status değişiminde
-- ============================================================
drop trigger if exists trg_auto_assign_partner on public.orders;
create trigger trg_auto_assign_partner
  after update of status on public.orders
  for each row
  when (NEW.status = 'ready_to_ship' and OLD.status <> 'ready_to_ship')
  execute function public.fn_auto_assign_partner_on_ready();

-- ============================================================
-- Comments
-- ============================================================
comment on function public.fn_auto_assign_partner_on_ready is
  'Mig 068: orders.status=ready_to_ship trigger. site_settings.partner_auto_assign_enabled TRUE ise capability-based en iyi partner''a otomatik atama (Mig 024 fn_assign_order_to_fason çağrılır — token + mail outbox dahil). Aksi takdirde no-op.';

comment on function public.fn_map_item_to_capability is
  'Mig 068: order_items.meta material/formFactor → partner_capabilities lookup için product_type + material türetir. Bilinmeyen material → null (material filter atlanır).';
