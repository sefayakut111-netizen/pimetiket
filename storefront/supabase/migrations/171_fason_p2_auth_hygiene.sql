-- Migration 171 — Fason P2 auth hijyeni
-- P2#16: partner_contacts email unique (case-insensitive)
-- P2#17: pending email doğrulama kolonları

-- Duplicate email varsa owner öncelikli tek kayıt bırak; diğerlerine suffix ekle
update public.partner_contacts pc
set email = pc.email || '.legacy.' || left(pc.id::text, 8)
where pc.id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by lower(email)
        order by
          case when role = 'owner' then 0 when role = 'operator' then 1 else 2 end,
          created_at asc
      ) as rn
    from public.partner_contacts
  ) ranked
  where rn > 1
);

create unique index if not exists partner_contacts_email_unique_ci
  on public.partner_contacts (lower(email));

alter table public.partner_contacts
  add column if not exists pending_email varchar(150),
  add column if not exists pending_email_otp_hash varchar(64),
  add column if not exists pending_email_expires_at timestamptz;
