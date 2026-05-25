"use client";

import { Pim } from "@/components/Pim";
import { Button } from "@/components/ui";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <Pim pose="sad" size={100} />
      <h2 className="mt-4 text-xl font-semibold text-lacivert">
        Dashboard yüklenirken hata oluştu
      </h2>
      <p className="mt-2 text-sm text-gri-500 max-w-md text-center">
        {error.message || "Beklenmeyen bir hata. Sayfayı yenile veya tekrar dene."}
      </p>
      <Button variant="primary" onClick={reset} className="mt-4">
        Tekrar dene
      </Button>
    </div>
  );
}
