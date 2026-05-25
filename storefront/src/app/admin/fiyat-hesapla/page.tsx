import { redirect } from "next/navigation";

export default function Page() {
  redirect("/admin/fiyatlar?tab=calculator&scope=sticker");
}
