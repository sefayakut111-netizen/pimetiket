-- F4 Model B: partner kargo adresi görüntüleme audit aksiyonu
alter type public.audit_action add value if not exists 'partner.address_viewed';
