-- Partner panel: acil işaretleme + bildirim tercihleri
ALTER TABLE order_assignments
  ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false;

ALTER TABLE fason_partners
  ADD COLUMN IF NOT EXISTS notify_email_on_assign boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_sms_on_urgent boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN order_assignments.is_urgent IS 'Admin tarafından acil işaretlendi';
COMMENT ON COLUMN fason_partners.notify_email_on_assign IS 'Yeni iş atandığında e-posta bildirimi';
COMMENT ON COLUMN fason_partners.notify_sms_on_urgent IS 'Acil iş atandığında SMS bildirimi';
