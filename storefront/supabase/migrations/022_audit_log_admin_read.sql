-- ============================================================
-- Pim Etiket — Migration 022: Admin audit_log read policy
--
-- Sorun:
--   Migration 004 audit_log RLS sadece "actor_id = auth.uid()" izin
--   verir. Admin /admin/audit-log sayfası boş görünüyordu (admin
--   kendi audit kayıtlarını görüyor, başkalarınınkini görmüyor).
--
-- Çözüm:
--   Admin/staff rolü için "tüm kayıtları görebilir" politikası ekle.
-- ============================================================

drop policy if exists "Admin can view all audit entries" on public.audit_log;
create policy "Admin can view all audit entries"
  on public.audit_log for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('admin', 'staff')
    )
  );

-- ============================================================
-- Migration 022 sonu
-- ============================================================
