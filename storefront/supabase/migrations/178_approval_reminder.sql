-- OG-3: Onay görseli hatırlatma — istek başına max 1 müşteri maili
alter table public.approval_requests
  add column if not exists reminded_at timestamptz null;

comment on column public.approval_requests.reminded_at is
  'Müşteri hatırlatma maili gönderim zamanı — cron istek başına tek mail.';
