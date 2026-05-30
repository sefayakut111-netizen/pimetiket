import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EditorShell from "@/components/editor/EditorShell";

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ sablon?: string }>;
}) {
  const params = await searchParams;
  const sablon = params.sablon?.trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = sablon
      ? `/editor?sablon=${encodeURIComponent(sablon)}`
      : "/editor";
    redirect(`/auth?next=${encodeURIComponent(next)}`);
  }

  return (
    <Suspense
      fallback={
        <main className="py-16 text-center text-gri-600 text-[14px]">
          Editör yükleniyor…
        </main>
      }
    >
      <EditorShell />
    </Suspense>
  );
}
