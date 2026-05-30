import { redirect } from "next/navigation";

/** Eski /admin/raporlar — Finans & Raporlar birleşik sayfaya yönlendir */
export default function Page() {
  redirect("/admin/finans?tab=detail");
}
