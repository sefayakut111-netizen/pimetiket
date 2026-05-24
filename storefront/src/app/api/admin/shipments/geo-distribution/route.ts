/**
 * GET /api/admin/shipments/geo-distribution
 *
 * Sefa 18 May v68 (Faz 3 — kargo paneli haritası):
 * İl bazlı kargo dağılımı + ortalama teslim süresi.
 *
 * Response:
 *   {
 *     cities: [
 *       { city: "İstanbul", count: 142, avg_days: 1.2, delivered: 130, failed: 2 },
 *       { city: "Ankara", count: 47, avg_days: 2.1, ... },
 *       ...
 *     ],
 *     total_cities: 23,
 *     // Türkiye haritasında il kodu/adı eşlemesi için
 *     fastest_city: { city: "İstanbul", avg_days: 1.2 },
 *     slowest_city: { city: "Hakkari", avg_days: 5.8 }
 *   }
 *
 * Son 90 günlük data baz alınır (yeterli istatistik için).
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export interface CityShipmentStat {
  city: string;
  count: number;
  avg_days: number | null;
  delivered: number;
  failed: number;
  in_transit: number;
}

export interface GeoDistributionResponse {
  cities: CityShipmentStat[];
  total_cities: number;
  fastest_city: { city: string; avg_days: number } | null;
  slowest_city: { city: string; avg_days: number } | null;
}

// TR illeri normalize map (yaygın yazım farklarını handle)
const CITY_NORMALIZE: Record<string, string> = {
  istanbul: "İstanbul",
  "ı̇stanbul": "İstanbul",
  ankara: "Ankara",
  izmir: "İzmir",
  "i̇zmir": "İzmir",
  bursa: "Bursa",
  antalya: "Antalya",
  adana: "Adana",
  konya: "Konya",
  gaziantep: "Gaziantep",
  kayseri: "Kayseri",
  diyarbakir: "Diyarbakır",
  mersin: "Mersin",
  eskisehir: "Eskişehir",
  samsun: "Samsun",
  denizli: "Denizli",
  trabzon: "Trabzon",
  malatya: "Malatya",
  erzurum: "Erzurum",
  van: "Van",
  manisa: "Manisa",
  sanliurfa: "Şanlıurfa",
  kocaeli: "Kocaeli",
  hatay: "Hatay",
  balikesir: "Balıkesir",
  sakarya: "Sakarya",
  tekirdag: "Tekirdağ",
  aydin: "Aydın",
};

function normalizeCity(raw: string | null): string | null {
  if (!raw) return null;
  const key = raw
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
  return CITY_NORMALIZE[key] ?? raw.trim();
}

export async function GET() {
  const auth = await assertPermission("shipments", "view");
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const ninetyDaysAgo = new Date(
    Date.now() - 90 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Sefa 18 May v68 (admin denetim — schema fix):
  // orders.address JSONB kolon; city ayrı sütun değil.
  const { data, error } = await supabase
    .from("order_assignments")
    .select(
      `shipped_at, tracking_status, tracking_delivered_at,
       orders!inner(address)`
    )
    .not("tracking_number", "is", null)
    .gte("shipped_at", ninetyDaysAgo);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = {
    shipped_at: string;
    tracking_status: string | null;
    tracking_delivered_at: string | null;
    orders: { address: { city?: string } | null };
  };

  const rows = (data ?? []) as unknown as Row[];

  // Şehir bazlı aggregate
  type CityAccum = {
    count: number;
    delivered: number;
    failed: number;
    in_transit: number;
    totalDays: number;
    deliveredWithDays: number;
  };

  const cityMap = new Map<string, CityAccum>();
  const day = 24 * 60 * 60 * 1000;

  for (const row of rows) {
    const city = normalizeCity(row.orders.address?.city ?? null);
    if (!city) continue;

    const acc = cityMap.get(city) ?? {
      count: 0,
      delivered: 0,
      failed: 0,
      in_transit: 0,
      totalDays: 0,
      deliveredWithDays: 0,
    };
    acc.count++;

    if (row.tracking_delivered_at) {
      acc.delivered++;
      const days =
        (new Date(row.tracking_delivered_at).getTime() -
          new Date(row.shipped_at).getTime()) /
        day;
      if (days > 0 && days < 30) {
        acc.totalDays += days;
        acc.deliveredWithDays++;
      }
    } else if (
      row.tracking_status === "failed" ||
      row.tracking_status === "returned"
    ) {
      acc.failed++;
    } else {
      acc.in_transit++;
    }

    cityMap.set(city, acc);
  }

  const cities: CityShipmentStat[] = Array.from(cityMap.entries())
    .map(([city, a]) => ({
      city,
      count: a.count,
      avg_days:
        a.deliveredWithDays > 0
          ? Math.round((a.totalDays / a.deliveredWithDays) * 10) / 10
          : null,
      delivered: a.delivered,
      failed: a.failed,
      in_transit: a.in_transit,
    }))
    .sort((a, b) => b.count - a.count);

  // En hızlı ve en yavaş şehir (min 3 teslim örnek olan)
  const citiesWithAvg = cities.filter(
    (c) => c.avg_days !== null && c.delivered >= 3
  );
  const sortedByAvg = [...citiesWithAvg].sort(
    (a, b) => (a.avg_days ?? 0) - (b.avg_days ?? 0)
  );
  const fastest = sortedByAvg[0]
    ? { city: sortedByAvg[0].city, avg_days: sortedByAvg[0].avg_days! }
    : null;
  const slowest = sortedByAvg[sortedByAvg.length - 1]
    ? {
        city: sortedByAvg[sortedByAvg.length - 1].city,
        avg_days: sortedByAvg[sortedByAvg.length - 1].avg_days!,
      }
    : null;

  const response: GeoDistributionResponse = {
    cities,
    total_cities: cities.length,
    fastest_city: fastest,
    slowest_city: slowest,
  };

  return NextResponse.json(response);
}
