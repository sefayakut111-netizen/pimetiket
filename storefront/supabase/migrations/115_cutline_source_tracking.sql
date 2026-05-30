-- Bıçak kaynağı izleme — embedded vs auto-generated
-- cutline_designs.cutline_source + detection_method + fn_proof_summary

alter table public.cutline_designs
  add column if not exists cutline_source text
    check (cutline_source in ('file_embedded', 'auto_generated', 'prior', 'geo_shape', 'operator'))
    default 'auto_generated';

alter table public.cutline_designs
  add column if not exists detection_method text;

comment on column public.cutline_designs.cutline_source is
  'Bıçak kaynağı: file_embedded = müşteri dosyasında zaten vardı, auto_generated = POC üretti';

-- fn_proof_summary — cutline_source + detection_method alanları (Mig 063 üzerine)
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
                    'detected_cut_contour_names', cd.detected_cut_contour_names,
                    'cutline_source', cd.cutline_source,
                    'detection_method', cd.detection_method
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
            'detected_cut_contour_names', cd.detected_cut_contour_names,
            'cutline_source', cd.cutline_source,
            'detection_method', cd.detection_method
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
