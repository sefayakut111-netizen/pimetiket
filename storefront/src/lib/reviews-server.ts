/**
 * Sunucu tarafı yorum istatistikleri (JSON-LD AggregateRating).
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface ReviewStats {
  count: number;
  averageRating: number;
}

export async function getPublishedReviewStats(): Promise<ReviewStats> {
  const supabase = createPublicClient();
  if (!supabase) return { count: 0, averageRating: 0 };

  const { data, error } = await supabase
    .from("reviews")
    .select("rating")
    .eq("status", "published");

  if (error || !data?.length) {
    return { count: 0, averageRating: 0 };
  }

  const count = data.length;
  const sum = data.reduce((acc, r) => acc + (r.rating ?? 0), 0);
  const averageRating = Math.round((sum / count) * 10) / 10;
  return { count, averageRating };
}
