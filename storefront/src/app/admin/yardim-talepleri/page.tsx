/**
 * /admin/yardim-talepleri — thin route (deep-link uyumluluğu).
 * Ana giriş: /admin/destek?tab=yardim
 */

import { YardimPanel } from "@/components/admin/destek/YardimPanel";

export default function AdminYardimTalepleriPage() {
  return (
    <main className="container py-6">
      <YardimPanel showHeader />
    </main>
  );
}
