-- ============================================================
-- Migration 063 — Multi-design proof support
-- ============================================================
-- Sefa 19 May v68 (E2E akış — C öbeği multi-design):
-- Önceki davranış: cutline_designs sadece order_item_id'ye bağlıydı.
-- Sorun: bir order_item'a 5 tasarım yüklenirse, 5 ayrı cutline üretilmeli
-- ama mevcut model "item başına tek cutline" varsayıyor.
--
-- Yeni davranış:
--   cutline_designs.design_file_id (nullable, geriye uyumlu)
--     → her design_file için kendi cutline'i
--   fn_proof_summary item başına designs[] array'i döndürür
--     → her design_file: { file metadata + cutline (en güncel non-superseded) }
--
-- order_items.cutline_design_id kalır ama "default/primary cutline" anlamında
-- (geriye uyumluluk). Yeni kod path'ı designs[] kullanır.

-- ============================================================
-- 1) cutline_designs.design_file_id — bireysel tasarıma bağlama
-- ============================================================
alter table public.cutline_designs
  add column if not exists design_file_id uuid
    references public.design_files(id) on delete set null;

create index if not exists cutline_designs_design_file_id_idx
  on public.cutline_designs(design_file_id)
  where design_file_id is not null;

comment on column public.cutline_designs.design_file_id is
  'Hangi design_files satırı için üretildi. Multi-design proof için kritik. '
  'NULL ise eski (Mig 062 öncesi) item-bağlı cutline; yeni kod design_file_id kullanır.';

-- ============================================================
-- 2) fn_proof_summary — designs[] array ile rewrite
-- ============================================================
-- Her order_item için designs[] çıkar; her design_file kendi cutline'ı ile
-- birlikte. Eski "cutline" alanı geriye uyumluluk için en güncel cutline'ı
-- döndürmeye devam eder (eğer designs boşsa item-bağlı en güncel cutline).
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
        -- Multi-design: her design_file kendi cutline'ı ile
        'designs', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'design_file_id', df.id,
                'file_name', df.original_name,
                'mime_type', df.mime_type,
                'size_bytes', df.size_bytes,
                'version', df.version,
                'design_status', df.status,
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
                    'material_type', cd.material_type,
                    'white_plan_mode', cd.white_plan_mode,
                    'white_plan_path_count', cd.white_plan_path_count,
                    'has_custom_white_plan', cd.has_custom_white_plan,
                    'tier', cd.tier,
                    'detected_cut_contour_names', cd.detected_cut_contour_names
                  )
                  from public.cutline_designs cd
                  where cd.design_file_id = df.id
                    and cd.status <> 'superseded'
                  order by cd.created_at desc
                  limit 1
                )
              )
              order by df.version, df.original_name
            ),
            '[]'::jsonb
          )
          from public.design_files df
          where df.order_item_id = oi.id
            and df.status <> 'superseded'
        ),
        -- Geriye uyumluluk: item-bağlı en güncel cutline (designs[] boşsa veya
        -- design_file_id null olan eski Mig 059/060 kayıtlar için).
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
            'material_type', cd.material_type,
            'white_plan_mode', cd.white_plan_mode,
            'white_plan_path_count', cd.white_plan_path_count,
            'has_custom_white_plan', cd.has_custom_white_plan,
            'tier', cd.tier,
            'detected_cut_contour_names', cd.detected_cut_contour_names
          )
          from public.cutline_designs cd
          where cd.order_item_id = oi.id
            and cd.status <> 'superseded'
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
      'created_at', v_order_row.created_at,
      -- Mig 062: 5 dk SLA deadline (proof_generating'da set edilir)
      'sla_proof_deadline', v_order_row.sla_proof_deadline
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

-- ============================================================
-- 3) order_items.proof_status — multi-design'da nasıl hesaplanır?
-- ============================================================
-- Mig 059 tek cutline varsayıyordu. Multi-design'da bir item'ın N tasarımı var
-- ve her birinin kendi proof durumu olabilir. Pragmatik karar:
--   - Item proof_status = "tüm tasarımları onaylanmış mı?" (en kötü statü)
--   - Müşteri onaylarken her tasarımı tek tek onaylar (yeni approve endpoint
--     design_file_id kabul edecek — D öbeğinde bunu güncellemedim, sıradaki adım)

-- ============================================================
-- ROLLBACK NOTU
-- ============================================================
-- 1. fn_proof_summary'i Mig 060 haline döndür.
-- 2. cutline_designs.design_file_id kolonunu drop et (FK önce drop).
