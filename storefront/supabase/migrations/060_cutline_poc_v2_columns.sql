-- ============================================================
-- Pim Etiket — Migration 060: Cutline POC v2 (malzeme + white plan + tier)
--
-- Sefa 19 May v68 (POC v2 güncellemesi):
-- pim_etiket_poc.html (3266 satıra çıktı) artık şunları üretiyor:
--   1. Malzeme tipi seçimi (paper/transparent/metallic/holographic)
--   2. Beyaz plan (white underbase) — şeffaf/metalize için altına beyaz mürekkep
--      5 mod: off/full/smart/ai/custom
--   3. Tier sınıflandırma — pro/standard/improve
--   4. SVG export 2 spot color grup (CutContour + White)
--
-- NOT (Sefa kararı): Fiyatlandırmaya etkisi YOKTUR. Malzeme + white plan
-- maliyetleri konfigüratör adımında zaten hesaba katılıyor; onay sayfası
-- sadece bu kararı GÖRSELLEŞTİRİR ve operatör manifestine taşır.
--
-- Bu migration:
--   1. cutline_designs'e 6 yeni kolon
--   2. fn_proof_summary RPC'sini yeni alanlarla güncelle
-- ============================================================

-- ============================================================
-- 1) cutline_designs — POC v2 alanları
-- ============================================================
alter table public.cutline_designs
  add column if not exists material_type text
    check (material_type in ('paper','transparent','metallic','holographic')),
  add column if not exists white_plan_mode text
    check (white_plan_mode in ('off','full','smart','ai','custom')),
  add column if not exists white_plan_path_count integer default 0,
  add column if not exists has_custom_white_plan boolean default false,
  add column if not exists tier text
    check (tier in ('pro','standard','improve')),
  add column if not exists detected_cut_contour_names jsonb default '[]'::jsonb;

comment on column public.cutline_designs.material_type is
  'POC v2 malzeme seçimi. Fiyat etkisi YOK (konfigüratörde belirleniyor); '
  'beyaz plan akışını ve operatör manifestini etkiler.';
comment on column public.cutline_designs.white_plan_mode is
  'White underbase üretim modu. Şeffaf/metalize/holografik için kritik.';
comment on column public.cutline_designs.tier is
  'Pim AI sınıflandırması: pro=tasarımcı dosyası, standard=otomatik temiz, '
  'improve=geliştirilmesi gereken (bg removal vb).';

-- ============================================================
-- 2) fn_proof_summary — yeni alanları döndür
-- ============================================================
-- Mig 059'daki versiyonu rewrite ediyoruz — cutline JSON'una 5 yeni alan
create or replace function public.fn_proof_summary(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_row record;
  v_items_json jsonb;
  v_uid uuid := auth.uid();
begin
  select * into v_order_row from public.orders
   where id = p_order_id;
  if v_order_row is null then
    return jsonb_build_object('error', 'order_not_found');
  end if;
  if v_order_row.user_id <> v_uid then
    return jsonb_build_object('error', 'forbidden');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', oi.id,
        'product', oi.product,
        'title', oi.title,
        'config', oi.config,
        'width', oi.width,
        'height', oi.height,
        'qty', oi.qty,
        'unit', oi.unit,
        'total', oi.total,
        'meta', oi.meta,
        'proof_status', oi.proof_status,
        'proof_viewed_at', oi.proof_viewed_at,
        'proof_approved_at', oi.proof_approved_at,
        'cutline', (
          select jsonb_build_object(
            'id', cd.id,
            'svg_url', cd.svg_url,
            'preview_png_url', cd.preview_png_url,
            'source', cd.source,
            'mode', cd.mode,
            'offset_mm', cd.offset_mm,
            'dpi', cd.dpi,
            'width_mm', cd.width_mm,
            'height_mm', cd.height_mm,
            'pim_feedback', cd.pim_feedback,
            'pim_severity', cd.pim_severity,
            'status', cd.status,
            -- POC v2 alanları (Mig 060):
            'material_type', cd.material_type,
            'white_plan_mode', cd.white_plan_mode,
            'white_plan_path_count', cd.white_plan_path_count,
            'has_custom_white_plan', cd.has_custom_white_plan,
            'tier', cd.tier,
            'detected_cut_contour_names', cd.detected_cut_contour_names
          )
          from public.cutline_designs cd
          where cd.order_item_id = oi.id
          order by cd.created_at desc
          limit 1
        ),
        'help_request', (
          select jsonb_build_object(
            'id', phr.id,
            'message', phr.message,
            'status', phr.status,
            'created_at', phr.created_at,
            'resolution_note', phr.resolution_note
          )
          from public.proof_help_requests phr
          where phr.order_item_id = oi.id
            and phr.status in ('open','in_progress')
          order by phr.created_at desc
          limit 1
        )
      )
      order by oi.id
    ),
    '[]'::jsonb
  )
    into v_items_json
  from public.order_items oi
  where oi.order_id = p_order_id;

  return jsonb_build_object(
    'order', jsonb_build_object(
      'id', v_order_row.id,
      'status', v_order_row.status,
      'subtotal', v_order_row.subtotal,
      'shipping', v_order_row.shipping,
      'total', v_order_row.total,
      'address', v_order_row.address,
      'created_at', v_order_row.created_at
    ),
    'items', v_items_json,
    'summary', (
      select jsonb_build_object(
        'total', count(*),
        'pending', count(*) filter (where proof_status = 'pending'),
        'viewed', count(*) filter (where proof_status = 'viewed'),
        'approved', count(*) filter (where proof_status = 'approved'),
        'edited', count(*) filter (where proof_status = 'edited'),
        'help_requested', count(*) filter (where proof_status = 'help_requested')
      )
      from public.order_items
      where order_id = p_order_id
    )
  );
end;
$$;

grant execute on function public.fn_proof_summary(text) to authenticated;
