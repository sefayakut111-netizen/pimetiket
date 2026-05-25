import { Pim } from "@/components/Pim";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_MESSAGE =
  "Kısa süreli bakım yapılıyor. Birkaç dakika içinde tekrar deneyin.";

export default async function MaintenancePage() {
  let message = DEFAULT_MESSAGE;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("site_settings")
      .select("maintenance_message")
      .eq("id", 1)
      .maybeSingle();
    const row = data as { maintenance_message?: string | null } | null;
    if (row?.maintenance_message?.trim()) {
      message = row.maintenance_message.trim();
    }
  } catch {
    /* fail-open — varsayılan mesaj */
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-krem px-4">
      <Pim pose="think" size={120} />
      <h1 className="mt-6 text-2xl font-bold text-lacivert">Bakım yapılıyor</h1>
      <p className="mt-3 max-w-md text-center text-gri-500">{message}</p>
      <p className="mt-6 text-sm text-gri-400">
        Acil iletişim: info@pimetiket.com
      </p>
    </main>
  );
}
