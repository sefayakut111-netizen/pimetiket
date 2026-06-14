-- Mig 189: KVKK data_export worker — 'exporting' claim status + export TTL kolonu.
-- enum ADD VALUE: yeni değeri AYNI tx'te KULLANMA (PG kısıtı). Index predicate 'processing' only.
ALTER TYPE public.kvkk_request_status ADD VALUE IF NOT EXISTS 'exporting';

ALTER TABLE public.kvkk_requests
  ADD COLUMN IF NOT EXISTS result_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS kvkk_requests_export_claim_idx
  ON public.kvkk_requests(created_at)
  WHERE kind = 'data_export' AND status = 'processing';
