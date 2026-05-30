-- Migration 123: Operatör CRM müşteri notu — customers.update
-- Activity log POST customers.update kullanır (customers.create değil).

UPDATE public.admin_role_permissions
SET can_update = true
WHERE role = 'operations' AND module = 'customers';
