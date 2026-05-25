-- Müşteri düzenleme sonrası AI tekrar kontrol durumu (3-10sn)
-- NOT: ALTER TYPE ... ADD VALUE transaction içinde çalışmaz — tek başına apply edilmeli.
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'proof_validating' AFTER 'proof_pending';
