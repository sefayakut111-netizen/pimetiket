-- Mig 187: shipment event dedup key — assignment_id dahil (append-only). mig052 stili.
drop index if exists public.uniq_shipment_event_dedupe;
create unique index if not exists uniq_shipment_event_dedupe
  on public.shipment_status_events(order_id, assignment_id, status, event_time);
comment on index public.uniq_shipment_event_dedupe is
  'M7 FAZ4: dedup per (order_id, assignment_id, status, event_time) — append-only; şube/re-shipment event korunur.';
