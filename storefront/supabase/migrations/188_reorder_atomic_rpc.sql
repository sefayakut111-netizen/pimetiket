-- Mig 188: atomik gallery + product_cards reorder RPC (mig-180 REVOKE/GRANT deseni)

-- gallery (0-indexli, partition yok) — route idx ile aynı
CREATE OR REPLACE FUNCTION public.fn_reorder_gallery(p_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows integer;
BEGIN
  IF p_ids IS NULL OR array_length(p_ids,1) IS NULL THEN RETURN 0; END IF;
  UPDATE public.gallery_items AS g SET sort_order = (ord.idx - 1), updated_at = now()
    FROM unnest(p_ids) WITH ORDINALITY AS ord(id, idx) WHERE g.id = ord.id;
  GET DIAGNOSTICS v_rows = ROW_COUNT; RETURN v_rows;
END; $$;

-- product_cards (1-indexli, product_type partition) — route idx+1 ile aynı
CREATE OR REPLACE FUNCTION public.fn_reorder_product_cards(p_product_type text, p_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows integer;
BEGIN
  IF p_product_type NOT IN ('etiket','sticker') THEN RAISE EXCEPTION 'invalid_product_type'; END IF;
  IF p_ids IS NULL OR array_length(p_ids,1) IS NULL THEN RETURN 0; END IF;
  UPDATE public.product_cards AS c SET sort_order = ord.idx, updated_at = now()
    FROM unnest(p_ids) WITH ORDINALITY AS ord(id, idx)
   WHERE c.id = ord.id AND c.product_type = p_product_type;
  GET DIAGNOSTICS v_rows = ROW_COUNT; RETURN v_rows;
END; $$;

REVOKE ALL ON FUNCTION public.fn_reorder_gallery(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_reorder_product_cards(text, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reorder_gallery(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_reorder_product_cards(text, uuid[]) TO service_role;
