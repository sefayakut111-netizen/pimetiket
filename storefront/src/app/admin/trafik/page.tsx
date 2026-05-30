/**
 * Pim Etiket — /admin/trafik
 *
 * GA4 Data API trafik özeti — ziyaretçi, oturum, sayfa görüntüleme,
 * kaynak kırılımı ve top sayfalar. Env yoksa kurulum kartı gösterir.
 */

import { Suspense } from "react";
import { TrafficDashboard } from "@/components/admin/TrafficDashboard";

export default function AdminTrafficPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-6">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">Trafik</h1>
        <p className="mt-1 text-sm text-gray-500">
          Site ziyaretçileri — Google Analytics 4 (admin panel)
        </p>
      </header>

      <Suspense
        fallback={
          <p className="text-sm text-gray-500">Trafik verisi yükleniyor…</p>
        }
      >
        <TrafficDashboard />
      </Suspense>
    </div>
  );
}
