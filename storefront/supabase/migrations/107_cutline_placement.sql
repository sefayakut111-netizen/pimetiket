-- POC editör: görsel yerleşimi ve bıçak referans boyutu (re-edit için)
ALTER TABLE cutline_designs
  ADD COLUMN IF NOT EXISTS placement_json jsonb,
  ADD COLUMN IF NOT EXISTS cutline_width_mm numeric,
  ADD COLUMN IF NOT EXISTS cutline_height_mm numeric;

COMMENT ON COLUMN cutline_designs.placement_json IS 'POC image_placement: { x, y, scale } canvas px';
COMMENT ON COLUMN cutline_designs.cutline_width_mm IS 'Bıçak referans genişliği (mm) — circle modda max(w,h)';
COMMENT ON COLUMN cutline_designs.cutline_height_mm IS 'Bıçak referans yüksekliği (mm)';
