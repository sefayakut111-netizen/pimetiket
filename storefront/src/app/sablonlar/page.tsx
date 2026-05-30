import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { SablonlarHub } from "./SablonlarHub";

export default async function SablonlarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="py-10 pb-24">
      <div className="mx-auto max-w-[1100px] px-4 md:px-8">
        <Suspense
          fallback={
            <div className="py-20 text-center text-gri-600 text-[14px]">
              Şablonlar yükleniyor…
            </div>
          }
        >
          <SablonlarHub isMember={Boolean(user)} />
        </Suspense>
      </div>
    </main>
  );
}
