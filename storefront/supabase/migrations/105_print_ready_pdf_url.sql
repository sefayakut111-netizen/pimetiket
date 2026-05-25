-- Migration 105: print-ready PDF URL on order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS print_ready_pdf_url text;

COMMENT ON COLUMN public.order_items.print_ready_pdf_url IS
  'Baskıya hazır birleşik PDF (tasarım + bleed + cutline) storage path';
